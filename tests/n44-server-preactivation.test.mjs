import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRegistrationBoundary, validateSubscription } from '../drafts/n44-push/registration.mjs';
import { createDeliveryBoundary, quietNow } from '../drafts/n44-push/delivery.mjs';
import { LIMITS } from '../drafts/n44-push/shared.mjs';
import { fixture, RID, RID2, NOW, payload, subscription } from './fixtures/n44-server-preactivation/fakes.mjs';

test('registration: independent auth, self-asserted/foreign owner, strict consent and stale contexts', async () => {
  const f = fixture();
  assert.equal((await f.registration.register({ verified: true, ownerId: 'owner-A' }, f.body())).status, 'rejected');
  for (const field of ['ownerId', 'verified', 'user_metadata']) {
    assert.equal((await f.registration.register('valid-test-transport', { ...f.body(), [field]: 'owner-A' })).status, 'rejected');
  }
  f.auth.ownerId = 'owner-B'; assert.equal((await f.register()).status, 'rejected');
  f.auth.ownerId = 'owner-A';
  for (const change of [() => { f.context.active = false; }, () => { f.context.sessionRevision = 'revision-2'; },
    () => { f.context.consentRevision = 'consent-2'; }, () => { f.context.pushConsent = false; },
    () => { f.context.sessionExpiresAt = NOW; }]) {
    const previous = structuredClone(f.context); change();
    assert.equal((await f.register()).status, 'rejected'); f.context = previous;
  }
  const noConsent = f.body(); noConsent.consent.push = false;
  assert.equal((await f.registration.register('valid-test-transport', noConsent)).status, 'rejected');
  f.auth.expiresAt = NOW; assert.equal((await f.register()).status, 'rejected');
  assert.equal(f.sends.length, 0);
});

test('registration: endpoint boundary, disabled origins, key sizes and immutable input', async () => {
  const f = fixture();
  assert.equal(validateSubscription(subscription()), null);
  for (const endpoint of ['http://push.example.test/d', 'https://127.0.0.1/d', 'https://localhost/d',
    'https://push.example.test:443/d', 'https://user@push.example.test/d', 'https://push.example.test/d#x',
    'https://evil.test/d', 'https://push.example.test/' + 'a'.repeat(2048)]) {
    const body = f.body(); body.subscription.endpoint = endpoint;
    assert.equal((await f.registration.register('valid-test-transport', body)).status, 'rejected', endpoint);
  }
  for (const [key, value] of [['auth', 'x'], ['auth', 'A'.repeat(21) + 'B'],
    ['p256dh', 'Z'.repeat(87)], ['p256dh', 'BQ' + 'A'.repeat(85)], ['auth', { toString: () => 'A'.repeat(22) }]]) {
    const sub = subscription(); sub.keys[key] = value;
    assert.equal(validateSubscription(sub, ['https://push.example.test']), null);
  }
  const accessor = f.body();
  Object.defineProperty(accessor.subscription, 'endpoint', { enumerable: true, get() { throw Error('must not execute'); } });
  assert.equal((await f.registration.register('valid-test-transport', accessor)).status, 'rejected');
  const body = f.body();
  f.protectHook = async () => { body.workspaceId = 'foreign-workspace'; };
  assert.equal((await f.registration.register('valid-test-transport', body)).status, 'registered');
  assert.equal(f.state().registrations.get(RID).workspaceId, 'workspace-A');
});

test('registration: global endpoint collision, per-context/device ceiling and mutation budgets', async () => {
  const f = fixture(); await f.register();
  f.auth.ownerId = 'owner-B';
  f.extraContexts.set(JSON.stringify(['owner-B', 'workspace-B', 'device-B']), structuredClone(f.context));
  const body = { ...f.body(), registrationId: RID2, workspaceId: 'workspace-B', deviceId: 'device-B' };
  assert.equal((await f.registration.register('valid-test-transport', body)).status, 'rejected');
  assert.equal(f.owners.get('owner-B').registrations.size, 0);
  assert.equal(f.endpoints.get('a'.repeat(64)).ownerId, 'owner-A');

  const g = fixture();
  const registration = createRegistrationBoundary({ verifySession: g.verifySession, repository: g.repository,
    protect: async sub => ({ sealed: 'fake-sealed', bindingFingerprint: 'b'.repeat(64), fingerprint: sub.endpoint.endsWith('1') ? '1'.repeat(64) :
      sub.endpoint.endsWith('2') ? '2'.repeat(64) : sub.endpoint.endsWith('3') ? '3'.repeat(64) : '4'.repeat(64) }),
    clock: () => g.now, approvedOrigins: ['https://push.example.test'] });
  for (let i = 1; i <= 4; i++) {
    const next = g.body(); next.registrationId = `${i}`.repeat(8) + '-1111-4111-8111-111111111111';
    next.deviceId = `device-${i}`; next.subscription.endpoint = `https://push.example.test/device-${i}`;
    g.extraContexts.set(JSON.stringify(['owner-A', 'workspace-A', next.deviceId]), structuredClone(g.context));
    assert.equal((await registration.register('valid-test-transport', next)).status, i <= LIMITS.devices ? 'registered' : 'limited');
  }
  const h = fixture();
  await h.repository.atomic('owner-A', tx => tx.set('budgets', 'register', {
    bucket: Math.floor(NOW / 3600_000), count: LIMITS.registrationWritesPerHour, expiresAt: NOW + 3600_000 }));
  assert.equal((await h.register()).status, 'limited');
});

test('registration: duplicate races, protected secrets, original-only revoke and no resurrection', async () => {
  const f = fixture();
  assert.deepEqual((await Promise.all(Array.from({ length: 12 }, () => f.register()))).map(r => r.status), Array(12).fill('registered'));
  assert.equal(f.state().registrations.size, 1);
  const alteredKeys = f.body(); alteredKeys.subscription.keys.auth = 'B' + 'A'.repeat(21);
  assert.equal((await f.registration.register('valid-test-transport', alteredKeys)).status, 'rejected');
  assert.equal(JSON.stringify([...f.state().registrations.values()]).includes('push.example.test'), false);
  const wrong = { registrationId: RID, workspaceId: 'workspace-other', deviceId: 'device-A' };
  assert.equal((await f.registration.revoke('valid-test-transport', wrong)).status, 'rejected');
  f.auth.sessionId = 'new-session'; assert.equal((await f.revoke()).status, 'rejected'); f.auth.sessionId = 'session-A';
  f.auth.ownerId = 'owner-B'; assert.equal((await f.revoke()).status, 'revoked');
  assert.equal(f.state().registrations.get(RID).state, 'active'); f.auth.ownerId = 'owner-A';
  assert.equal((await f.revoke()).status, 'revoked'); assert.equal((await f.revoke()).status, 'revoked');
  assert.equal(f.state().registrations.get(RID).sealed, null); assert.equal(f.endpoints.size, 0);
  assert.equal((await f.register()).status, 'rejected');
  assert.equal((await f.deliver()).status, 'suppressed');
});

test('registration: asynchronous stale/logout/owner/workspace/device switches reject and errors are private', async () => {
  for (const mutate of [f => { f.context.active = false; }, f => { f.context.sessionRevision = 'revision-2'; },
    f => { f.context = null; }, f => { f.now = f.auth.expiresAt; }]) {
    const f = fixture(); f.protectHook = async () => mutate(f);
    assert.equal((await f.register()).status, 'rejected'); assert.equal(f.state()?.registrations.size ?? 0, 0);
  }
  const f = fixture(); f.protectHook = () => { throw Error('PRIVATE endpoint owner-A keys'); };
  assert.deepEqual(await f.register(), { status: 'unavailable' });
});

test('delivery: concurrent duplicate reservations across independent instances and immutable identity', async () => {
  const f = fixture(); await f.register();
  const other = createDeliveryBoundary(f.deliveryOptions);
  const results = await Promise.all(Array.from({ length: 30 }, (_, i) =>
    (i % 2 ? other : f.delivery).deliver('owner-A', RID, payload())));
  assert.equal(f.sends.length, 1); assert.equal(results.filter(r => r.status === 'sent').length, 1);
  assert.equal(results.filter(r => r.status === 'duplicate').length, 29);
  for (const change of [{ expiresAt: payload().expiresAt + 1000 }, { actionPath: '/teaching/other/attendance?session=session-1' }])
    assert.equal((await f.deliver({ ...payload(), ...change })).status, 'conflict');
  const body = { ...f.body(), registrationId: RID2 };
  assert.equal((await f.registration.register('valid-test-transport', body)).status, 'limited');
  assert.equal(f.state().deliveries.size, 1);
});

test('delivery: disabled by default, current context/preference/timing/quiet/zone and injected event recomputation', async () => {
  const disabled = createDeliveryBoundary({});
  assert.equal((await disabled.deliver()).status, 'disabled');
  for (const change of [f => { f.context.active = false; }, f => { f.context.pushConsent = false; },
    f => { f.context.sessionRevision = 'new'; }, f => { f.context.consentRevision = 'new'; },
    f => { f.context.sessionExpiresAt = NOW; }, f => { f.eventDeleted = true; },
    f => { f.context.preferences.lesson = false; }, f => { f.context.preferences.lessonMinutes = 9; },
    f => { f.context.preferences.dueDays = [9]; }, f => { f.context.preferences.timezone = 'invalid-zone'; },
    f => { f.context.preferences.quiet = { start: 11 * 60, end: 13 * 60 }; }]) {
    const f = fixture(); await f.register(); change(f);
    assert.equal((await f.deliver()).status, 'suppressed'); assert.equal(f.sends.length, 0);
    f.context = structuredClone(fixture().context); f.eventDeleted = false;
    assert.equal((await f.deliver()).status, 'duplicate'); assert.equal(f.sends.length, 0);
  }
  assert.equal(quietNow({ timezone: 'Asia/Riyadh', quiet: { start: 23 * 60, end: 13 * 60 } }, NOW), true);
  assert.equal(quietNow({ timezone: 'UTC', quiet: { start: 23 * 60, end: 13 * 60 } }, NOW), true);
  assert.equal(quietNow({ timezone: 'Asia/Riyadh', quiet: { start: 12 * 60, end: 13 * 60 } }, NOW), true);
  assert.equal(quietNow({ timezone: 'UTC', quiet: { start: 12 * 60, end: 13 * 60 } }, NOW), false);
  assert.equal(quietNow({ timezone: 'UTC', quiet: { start: 0, end: 0 } }, NOW), true);
});

test('delivery: due category and recomputed route/expiry/promise mismatches fail closed', async () => {
  const due = { id: 'due:subitem-1:2026-10-18:2026-10-17', kind: 'due', expiresAt: NOW + 3600_000,
    actionPath: '/teaching/teaching-1/items' };
  const f = fixture(); await f.register(); f.recompute = () => due;
  assert.equal((await f.deliver(due)).status, 'sent');
  const g = fixture(); await g.register(); g.recompute = () => due; g.context.preferences.due = false;
  assert.equal((await g.deliver(due)).status, 'suppressed'); assert.equal(g.sends.length, 0);
  for (const resolver of [() => ({ ...payload(), expiresAt: payload().expiresAt + 1 }),
    () => ({ ...payload(), actionPath: '/teaching/foreign/attendance?session=session-1' }),
    () => Promise.resolve(payload())]) {
    const h = fixture(); await h.register(); h.recompute = resolver;
    assert.equal((await h.deliver()).status, 'suppressed'); assert.equal(h.sends.length, 0);
  }
});

test('delivery: definitive non-acceptance retry/backoff and bounded attempt ceiling', async () => {
  const f = fixture(); await f.register(); f.outcome = 'not_accepted_retryable';
  assert.equal((await f.deliver()).status, 'retry');
  assert.equal((await f.deliver()).status, 'backoff');
  f.now += 60_000; assert.equal((await f.deliver()).status, 'retry');
  f.now += 120_000; assert.equal((await f.deliver()).status, 'suppressed');
  f.now += 240_000; assert.equal((await f.deliver()).status, 'duplicate');
  assert.equal(f.sends.length, LIMITS.attempts);
});

test('delivery: revocation/expiry/preference/deleted event changes before retry prevent sending', async () => {
  for (const change of [async f => { await f.revoke(); }, async f => { f.now = payload().expiresAt; },
    async f => { f.eventDeleted = true; }, async f => { f.context.preferences.lesson = false; },
    async f => { f.context.preferences.quiet = { start: 0, end: 0 }; }]) {
    const f = fixture(); await f.register(); f.outcome = 'not_accepted_retryable';
    await f.deliver(); f.now += 60_000; await change(f); await f.deliver();
    assert.equal(f.sends.length, 1);
  }
  const f = fixture(); await f.register(); f.now = payload().expiresAt;
  assert.equal((await f.deliver()).status, 'rejected');
  f.now = NOW; f.state().highWater = payload().expiresAt;
  assert.equal((await f.deliver()).status, 'expired'); assert.equal(f.sends.length, 0);
});

test('delivery: uncertain exceptions/unknown outcomes/crash reconciliation never retry', async () => {
  for (const outcome of ['uncertain', 'unknown', 500]) {
    const f = fixture(); await f.register(); f.outcome = outcome;
    assert.deepEqual(await f.deliver(), { status: 'uncertain' });
    f.now += 100_000; assert.equal((await f.deliver()).status, 'duplicate'); assert.equal(f.sends.length, 1);
  }
  const f = fixture(); await f.register(); f.throwSend = true;
  assert.deepEqual(await f.deliver(), { status: 'uncertain' });
  const g = fixture(); await g.register();
  g.sendHook = async () => { g.failCommit = true; };
  assert.equal((await g.deliver()).status, 'unavailable'); // completion commit failed, sending persisted
  g.now += LIMITS.uncertainMs;
  await g.delivery.cleanup('owner-A');
  assert.equal([...g.state().deliveries.values()][0].state, 'uncertain');
  assert.equal((await g.deliver()).status, 'duplicate'); assert.equal(g.sends.length, 1);
  const h = fixture(); await h.register(); h.failCommit = true;
  assert.equal((await h.deliver()).status, 'unavailable'); assert.equal(h.sends.length, 0);
  assert.equal(h.state().deliveries.size, 0); // rollback model
});

test('delivery: dead 404/410 removes only original endpoint and cleanup bounds retention', async () => {
  for (const outcome of [404, 410]) {
    const f = fixture(); await f.register(); f.outcome = outcome;
    assert.equal((await f.deliver()).status, 'dead');
    assert.equal(f.state().registrations.get(RID).sealed, null); assert.equal(f.endpoints.size, 0);
    assert.equal((await f.deliver()).status, 'duplicate'); assert.equal(f.sends.length, 1);
    f.now += 2 * 86400_000 + 1;
    assert.equal((await f.delivery.cleanup('owner-A')).status, 'cleaned');
    assert.equal(f.state().registrations.size, 0); assert.equal(f.state().deliveries.size, 0); assert.equal(f.state().budgets.size, 0);
  }
  const f = fixture(); await f.register(); f.context.active = false;
  await f.delivery.cleanup('owner-A'); assert.equal(f.state().registrations.get(RID).sealed, null);
});

test('delivery: atomic rate limits fail closed and do not evict unexpired idempotency keys', async () => {
  for (const [key, windowMs, count] of [['hour:device-A', 3600_000, LIMITS.sendsPerHour],
    ['day:device-A', 86400_000, LIMITS.sendsPerDay], ['owner-day', 86400_000, LIMITS.ownerSendsPerDay]]) {
    const f = fixture(); await f.register();
    await f.repository.atomic('owner-A', tx => tx.set('budgets', key, {
      bucket: Math.floor(NOW / windowMs), count, expiresAt: NOW + windowMs }));
    assert.equal((await f.deliver()).status, 'limited'); assert.equal(f.sends.length, 0);
  }
  const f = fixture(); await f.register();
  for (let i = 0; i < LIMITS.jobs; ++i) f.state().deliveries.set(String(i), { key: String(i), expiresAt: NOW + 100_000 });
  assert.equal((await f.deliver()).status, 'limited'); assert.equal(f.state().deliveries.size, LIMITS.jobs);
});

test('cleanup/revoke: commit failure remains retryable, removes only original UUID, late sends stay fenced', async () => {
  const f = fixture(); await f.register(); f.failCommit = true;
  assert.equal((await f.revoke()).status, 'unavailable');
  assert.equal(f.state().registrations.get(RID).state, 'active'); assert.equal(f.endpoints.size, 1);
  assert.equal((await f.revoke()).status, 'revoked');
  // A deliberate new binding after original revocation; old cleanup cannot erase it.
  const next = { ...f.body(), registrationId: RID2 };
  assert.equal((await f.registration.register('valid-test-transport', next)).status, 'registered');
  assert.equal((await f.revoke()).status, 'revoked');
  assert.equal(f.state().registrations.get(RID2).state, 'active'); assert.equal(f.endpoints.size, 1);
  const g = fixture(); await g.register();
  g.sendHook = async () => { await g.revoke(); };
  assert.equal((await g.deliver()).status, 'uncertain');
  assert.equal([...g.state().deliveries.values()][0].state, 'uncertain');
  assert.equal((await g.deliver()).status, 'duplicate'); assert.equal(g.sends.length, 1);
  const h = fixture(); await h.register(); h.context.active = false; h.failCommit = true;
  assert.equal((await h.delivery.cleanup('owner-A')).status, 'unavailable');
  assert.equal(h.state().registrations.get(RID).state, 'active');
  assert.equal((await h.delivery.cleanup('owner-A')).status, 'cleaned');
  assert.equal(h.state().registrations.get(RID).sealed, null);
});

test('inactivity/privacy: imports and construction have no capability side effects, no application import', () => {
  const code = `const deny = () => { throw Error('forbidden capability'); };
    for (const name of ['fetch', 'WebSocket', 'EventSource', 'setTimeout', 'setInterval']) globalThis[name] = deny;
    for (const name of ['localStorage', 'Notification', 'navigator']) Object.defineProperty(globalThis, name, { get: deny, configurable: true });
    const registration = await import('./drafts/n44-push/registration.mjs');
    const delivery = await import('./drafts/n44-push/delivery.mjs');
    registration.createRegistrationBoundary({}); delivery.createDeliveryBoundary({});`;
  execFileSync(process.execPath, ['--input-type=module', '-e', code], { cwd: new URL('..', import.meta.url), stdio: 'pipe' });
  const imports = spawnSync('git', ['grep', '-n', '-E', 'drafts/n44-push|n44-push/(registration|delivery|shared)', '--',
    'src', 'supabase', 'scripts', 'sw.js', 'index.html'], { encoding: 'utf8', stdio: 'pipe' });
  assert.equal(imports.status, 1, imports.stdout + imports.stderr); // git's no-match status
  assert.equal(imports.stdout, '');
});

test('gate: documented SQL/live NOT_RUN and concrete remaining activation gates', () => {
  const readme = readFileSync(new URL('../drafts/n44-push/README.md', import.meta.url), 'utf8');
  for (const word of ['NOT_RUN', 'schema-proposal.sql', 'N78', 'VAPID', 'atomic', 'redirect', 'cost', 'RLS', 'pilot']) assert.ok(readme.includes(word), word);
});
