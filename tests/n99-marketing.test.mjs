import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createMarketingAnalytics, MARKETING_COLLECTOR } from '../src/lib/marketing-analytics.js';

function fixture(overrides = {}, eligible = () => true) {
  const requests = [], values = new Map(), timers = new Map();
  const environment = {
    location: { protocol: 'https:', hostname: 'rakeezx.com', search: '?email=private@example.test', hash: '#/teaching/private/grades' },
    navigator: { onLine: true }, AbortController,
    sessionStorage: { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v) },
    setTimeout: fn => { const id = timers.size + 1; timers.set(id, fn); return id; },
    clearTimeout: id => timers.delete(id),
    fetch: (url, options) => { requests.push({ url, options }); return Promise.resolve({ ok: true }); },
    ...overrides,
  };
  return { environment, requests, values, timers, analytics: createMarketingAnalytics({ environment, eligible }) };
}

test('n99_public_only_allowlist: two boolean attempts survive document reload; unknown events rejected', async () => {
  const f = fixture();
  for (const name of ['campaign_landing', 'demo_started', 'campaign_landing', 'demo_started', 'grades', '__proto__', 'identify']) f.analytics.track(name);
  const reloaded = createMarketingAnalytics({ environment: f.environment, eligible: () => true });
  reloaded.track('campaign_landing'); reloaded.track('demo_started');
  assert.equal(f.requests.length, 2);
  assert.deepEqual([...f.values.values()], ['true', 'true']);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.timers.size, 0);
});

test('n99_no_sensitive_event_data: exact constant JSON and credential/referrer protection', () => {
  const f = fixture(); f.analytics.track('campaign_landing');
  const { url, options } = f.requests[0];
  assert.equal(url, MARKETING_COLLECTOR);
  assert.deepEqual(JSON.parse(options.body), { type: 'event', payload: {
    website: 'a0f3bd66-07fc-4082-956d-70c17ff621c5', hostname: 'rakeezx.com',
    url: '/', title: 'رَكيز المعلم', name: 'campaign_landing', data: {},
  } });
  assert.equal(options.credentials, 'omit'); assert.equal(options.referrerPolicy, 'no-referrer');
  assert.equal(options.redirect, 'error');
});

test('n99_old_key_dedupe_transition: an already-counted landing tab does not emit under the new name', () => {
  const f = fixture();
  f.values.set('rakeezx-marketing-landing_view', 'true');
  f.analytics.track('campaign_landing');
  assert.equal(f.requests.length, 0);
  assert.equal(f.values.get('rakeezx-marketing-landing_view'), 'true');
  assert.equal(f.values.has('rakeezx-marketing-campaign_landing'), false);
});

test('connect-only CSP preserves the app endpoints and the offline shell contains only the first-party module', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const policy = html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)[1];
  assert.equal(policy, "connect-src 'self' https://xlrubcwjqktzzunrvuns.supabase.co wss://xlrubcwjqktzzunrvuns.supabase.co https://cloud.umami.is");
  assert.doesNotMatch(html, /<script[^>]+(?:cloud|gateway)\.umami\.is/);
  const sw = await readFile(new URL('../sw.js', import.meta.url), 'utf8');
  assert.match(sw, /'\.\/src\/lib\/marketing-analytics\.js'/);
  assert.doesNotMatch(sw, /umami\.is/);
});

test('DNT/GPC/offline/Preview/localhost/unknown/account/storage refusal send zero', () => {
  for (const overrides of [
    { navigator: { onLine: false } }, { navigator: { onLine: true, doNotTrack: '1' } },
    { navigator: { onLine: true, doNotTrack: 'yes' } }, { doNotTrack: '1' },
    { navigator: { onLine: true, globalPrivacyControl: true } },
    { location: { protocol: 'https:', hostname: 'candidate.rakeezx.pages.dev' } },
    { location: { protocol: 'http:', hostname: 'localhost' } },
    { location: { protocol: 'http:', hostname: 'rakeezx.com' } },
    { sessionStorage: { getItem() { throw new Error('denied'); } } },
    { sessionStorage: null },
  ]) {
    const f = fixture(overrides); f.analytics.track('campaign_landing'); f.analytics.track('demo_started');
    assert.equal(f.requests.length, 0);
  }
  for (const eligible of [() => false, () => undefined, () => { throw new Error('unknown'); }]) {
    const f = fixture({}, eligible); f.analytics.track('campaign_landing'); assert.equal(f.requests.length, 0);
  }
});

test('eligibility is rechecked at dispatch; pending requests abort on account entry and timeout', () => {
  let checks = 0;
  const race = fixture({}, () => ++checks === 1);
  race.analytics.track('campaign_landing'); assert.equal(race.requests.length, 0);
  const f = fixture({ fetch: (url, options) => { f.requests.push({ url, options }); return new Promise(() => {}); } });
  f.analytics.track('campaign_landing');
  f.analytics.stop(); assert.equal(f.requests[0].options.signal.aborted, true);
  f.analytics.track('demo_started'); assert.equal(f.requests.length, 1);
  const timed = fixture({ fetch: (url, options) => { timed.requests.push({ url, options }); return new Promise(() => {}); } });
  timed.analytics.track('campaign_landing'); [...timed.timers.values()][0]();
  assert.equal(timed.requests[0].options.signal.aborted, true);
});

test('n99_blocked_tracker_is_nonblocking: rejection and synchronous fetch failure stay silent with no retry', async () => {
  for (const fetch of [() => Promise.reject(new Error('blocked')), () => { throw new Error('blocked'); }]) {
    const f = fixture({ fetch });
    assert.doesNotThrow(() => f.analytics.track('campaign_landing'));
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(f.timers.size, 0);
    f.analytics.track('campaign_landing'); assert.equal(f.values.size, 1);
  }
});

const campaign = { utm_source: 'test', utm_medium: 'test', utm_campaign: 'tracking_check', utm_content: 'properties_check' };
const publicLocation = search => ({ protocol: 'https:', hostname: 'rakeezx.com', pathname: '/', hash: '', search });
const query = '?' + new URLSearchParams(campaign);
const savedKey = 'rakeezx-marketing-campaign-v1';

test('n99_both_event_data_payloads: exact four keys survive navigation and document reload', () => {
  const f = fixture({ location: publicLocation(query + '&utm_term=private&email=private@example.test&sessionId=secret') });
  f.analytics.capturePublicEntry(); f.analytics.track('campaign_landing');
  f.environment.location = publicLocation('?utm_campaign=overwrite');
  f.analytics.capturePublicEntry();
  f.environment.location = { ...publicLocation(''), hash: '#/classes' };
  f.analytics.stop({ preserveCampaign: true });
  const next = createMarketingAnalytics({ environment: f.environment, eligible: () => true });
  next.capturePublicEntry(); next.track('demo_started');
  assert.deepEqual(f.requests.map(r => JSON.parse(r.options.body).payload.data), [campaign, campaign]);
  assert.deepEqual(JSON.parse(f.values.get(savedKey)), campaign);
  for (const r of f.requests) assert.doesNotMatch(r.options.body, /private|secret|overwrite|utm_term|sessionId/);
});

test('n99_campaign_privacy: bounded vocabulary/readable slugs reject identities and encoded delimiters', () => {
  for (const value of ['private@example.test', 'https://private.test', 'name\nsecret', '{"email":"secret"}',
    'abc%26email%3Dprivate', 'foo%2Dbar', 'student_123456789', 'a0f3bd66-07fc-4082-956d-70c17ff621c5',
    'd4e5f6a7b8c9', 'qzxvbnmlkjhg', 'abcdefghijklmno', 'AbCdEfGhIjKlMn', 'a'.repeat(49)]) {
    const f = fixture({ location: publicLocation(`?utm_source=${value}&utm_medium=${value}&utm_campaign=${value}&utm_content=${value}`) });
    f.analytics.capturePublicEntry(); f.analytics.track('campaign_landing');
    assert.deepEqual(JSON.parse(f.requests[0].options.body).payload.data, {}, value);
    assert.equal(f.values.get(savedKey), '{}');
  }
  const valid = fixture({ location: publicLocation('?utm_source=whatsapp&utm_medium=social&utm_campaign=back_to_school_2026&utm_content=demo_button') });
  valid.analytics.capturePublicEntry(); valid.analytics.track('campaign_landing');
  assert.deepEqual(JSON.parse(valid.requests[0].options.body).payload.data, {
    utm_source: 'whatsapp', utm_medium: 'social', utm_campaign: 'back_to_school_2026', utm_content: 'demo_button',
  });
  const partial = fixture({ location: publicLocation('?utm_source=test&utm_content=demo_button&utm_campaign=first&utm_campaign=second') });
  partial.analytics.capturePublicEntry(); partial.analytics.track('demo_started');
  assert.deepEqual(JSON.parse(partial.requests[0].options.body).payload.data, { utm_source: 'test', utm_content: 'demo_button' });
});

test('n99_first_empty_entry/account/privacy guards: no recapture or inherited tab campaign', () => {
  const f = fixture({ location: publicLocation('') });
  f.analytics.capturePublicEntry(); f.environment.location.search = query;
  f.analytics.capturePublicEntry(); f.analytics.track('campaign_landing');
  assert.deepEqual(JSON.parse(f.requests[0].options.body).payload.data, {});
  f.analytics.stop(); assert.equal(f.values.get(savedKey), 'disabled');
  const next = createMarketingAnalytics({ environment: f.environment, eligible: () => true });
  next.capturePublicEntry(); next.track('demo_started'); assert.equal(f.requests.length, 1);
  const fresh = fixture({ location: publicLocation('') });
  fresh.analytics.capturePublicEntry(); fresh.analytics.track('campaign_landing');
  assert.deepEqual(JSON.parse(fresh.requests[0].options.body).payload.data, {});
  for (const overrides of [
    { navigator: { onLine: true, globalPrivacyControl: true } },
    { navigator: { onLine: true, doNotTrack: '1' } }, { navigator: { onLine: false } },
    { location: { ...publicLocation(query), hostname: 'preview.pages.dev' } },
    { location: { ...publicLocation(query), hash: '#/account' } },
  ]) {
    const blocked = fixture({ location: publicLocation(query), ...overrides });
    blocked.analytics.capturePublicEntry(); assert.equal(blocked.values.has(savedKey), false);
  }
  const unknown = fixture({ location: publicLocation(query) }, () => false);
  unknown.analytics.capturePublicEntry(); assert.equal(unknown.values.size, 0);
  const privacy = fixture({ location: publicLocation(query) });
  privacy.analytics.capturePublicEntry(); privacy.environment.navigator.globalPrivacyControl = true;
  privacy.analytics.track('demo_started'); assert.equal(privacy.requests.length, 0);
});

test('n99_storage_tamper/failure: sanitize restored data, fail silently without retry', () => {
  const f = fixture();
  f.values.set(savedKey, JSON.stringify({ ...campaign, email: 'private@example.test', utm_content: 'https://private.test' }));
  f.analytics.track('demo_started');
  assert.deepEqual(JSON.parse(f.requests[0].options.body).payload.data, {
    utm_source: 'test', utm_medium: 'test', utm_campaign: 'tracking_check',
  });
  for (const storage of [null, { getItem() { throw Error('read denied'); } },
    { getItem() { return null; }, setItem() { throw Error('write denied'); } }]) {
    const denied = fixture({ location: publicLocation(query), sessionStorage: storage });
    assert.doesNotThrow(() => { denied.analytics.capturePublicEntry(); denied.analytics.track('campaign_landing'); denied.analytics.stop(); });
    assert.equal(denied.requests.length, 0);
  }
});
