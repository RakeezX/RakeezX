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
    url: '/', title: 'رَكيز المعلم', name: 'campaign_landing',
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
