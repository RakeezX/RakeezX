import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { normalizePushPayload, safePushAction, createPushDedupe } from '../src/lib/notification-push-core.js';
import { createPushClient } from '../src/lib/notification-push-client.js';
import { notificationScope, MAX_EVENT_AGE_MS } from '../src/lib/notification-center.js';

const now = 1000000;
const payload = () => ({ id: 'lesson:session-1:2026-10-17', kind: 'lesson', expiresAt: now + 60000,
  actionPath: '/teaching/teaching-1/attendance?session=session-1' });
const defer = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
function fixture() {
  // SYNTHETIC verified gateway, not a server-ownership proof. No accounts/network.
  const f = { context: { mode: 'account', verified: true, ownerId: 'fake-owner-A', workspaceId: 'fake-db-A',
    deviceId: 'fake-device', authRevision: 'fake-session-1' }, gesture: true, permission: 'granted',
    supported: true, accepted: true, authorized: true, removeOK: true, clock: now, calls: [], diagnostics: [] };
  const subscription = { endpoint: 'PRIVATE-SYNTHETIC-ENDPOINT', keys: { auth: 'PRIVATE-SYNTHETIC-KEY' },
    async unsubscribe() { f.calls.push('unsubscribe'); return true; } };
  f.browser = { supported: () => f.supported, hasUserActivation: () => f.gesture, permission: () => f.permission,
    async requestPermission() { f.calls.push('permission'); if (f.permissionWait) await f.permissionWait.promise; return f.permission; },
    async subscribe() { f.calls.push('subscribe'); if (f.subscribeWait) await f.subscribeWait.promise; return subscription; },
    navigate(path) { f.calls.push(['navigate', path]); } };
  f.gateway = {
    async register(ctx, sub) { f.calls.push('register'); assert.equal(sub, subscription);
      if (f.registerWait) await f.registerWait.promise;
      // Independent fake authorization, not acceptance of verified:true alone.
      return f.accepted && ctx.ownerId === 'fake-owner-A' && ctx.workspaceId === 'fake-db-A'; },
    async remove(ctx, sub) { f.calls.push(['remove', ctx.ownerId]); assert.equal(sub, subscription); return f.removeOK; },
    async authorizeEvent(ctx) { f.calls.push('authorize'); if (f.actionWait) await f.actionWait.promise;
      return f.authorized && ctx.ownerId === 'fake-owner-A' && ctx.workspaceId === 'fake-db-A'; },
  };
  f.client = createPushClient({ browser: f.browser, gateway: f.gateway, getVerifiedContext: () => f.context,
    clock: () => f.clock, resolveAction: () => f.destination ?? payload().actionPath, diagnostic: code => f.diagnostics.push(code) });
  return f;
}
const started = async (f, name) => {
  for (let i = 0; i < 20 && !f.calls.includes(name); i++) await Promise.resolve();
  assert.ok(f.calls.includes(name));
};

test('n44_push_payload_expiry_dedupe_and_safe_action_contract', () => {
  assert.deepEqual(normalizePushPayload(payload(), now), payload());
  assert.equal(safePushAction('/teaching/a/items'), '/teaching/a/items');
  for (const path of ['https://evil.test', '//evil.test', 'javascript:alert(1)', '/teaching/../items',
    '/teaching/%2F/items', '/teaching/%252e/items', '/teaching/%ZZ/items', '/teaching/a/items#x',
    '/teaching/a/items?redirect=evil', '/teaching/a/attendance?session=s&url=x', '/teaching/a\\b/items']) {
    assert.equal(safePushAction(path), null, path);
  }
  for (const bad of [null, [], { ...payload(), unknown: 'x' }, { ...payload(), ownerId: 'spoof' },
    { ...payload(), body: 'private student' }, { ...payload(), id: '<script>' }, { ...payload(), kind: 'marketing' },
    { ...payload(), expiresAt: now }, { ...payload(), expiresAt: now + MAX_EVENT_AGE_MS + 1 },
    { ...payload(), actionPath: '/teaching/a/items' }, { id: 'missing' },
    JSON.parse('{"__proto__":{},"id":"x","kind":"due","expiresAt":9999999,"actionPath":"/teaching/a/items"}')]) {
    assert.equal(normalizePushPayload(bad, now), null);
  }
  const getter = { ...payload() }; Object.defineProperty(getter, 'id', { get() { throw Error('must not read getter'); } });
  assert.equal(normalizePushPayload(getter, now), null);
  const symbols = { ...payload(), [Symbol('hidden')]: 1 };
  assert.equal(normalizePushPayload(symbols, now), null);
  const ledger = createPushDedupe();
  const scope = notificationScope(fixture().context);
  assert.equal(ledger.claim(scope, payload(), now), 'claimed');
  assert.equal(ledger.claim(scope, payload(), now), 'duplicate'); // uncertain send/retry
  assert.equal(ledger.claim(scope + '-other-device', payload(), now), 'claimed');
  assert.equal(ledger.claim(scope, payload(), now + 60000), 'invalid');
  assert.equal(ledger.claim(scope, payload(), now), 'invalid'); // rollback cannot resurrect
  const bounded = createPushDedupe();
  for (let i = 0; i < 100; i++) assert.equal(bounded.claim(scope, { ...payload(), id: `event:${i}` }, now), 'claimed');
  assert.equal(bounded.claim(scope, { ...payload(), id: 'overflow' }, now), 'capacity');
  assert.equal(bounded.claim(scope, { ...payload(), id: 'event:0' }, now), 'duplicate');
});

test('n44_push_explicit_consent_owner_context_revoke_with_fake_gateway', async () => {
  for (const [patch, status] of [[{ gesture: false }, 'gesture_required'], [{ supported: false }, 'unsupported'],
    [{ permission: 'denied' }, 'denied'], [{ permission: 'default' }, 'unsubscribed']]) {
    const f = Object.assign(fixture(), patch);
    assert.deepEqual(f.calls, []);
    assert.equal((await f.client.optIn()).status, status);
    assert.ok(!f.calls.includes('subscribe'));
  }
  const f = fixture();
  assert.equal((await f.client.optIn()).status, 'subscribed');
  assert.equal((await f.client.optIn()).status, 'subscribed');
  assert.equal(f.calls.filter(x => x === 'subscribe').length, 1);
  assert.equal((await f.client.revoke()).status, 'revoked');
  assert.ok(f.calls.includes('unsubscribe'));
  assert.deepEqual(f.calls.find(Array.isArray), ['remove', 'fake-owner-A']);
  const spoof = fixture(); spoof.context.ownerId = 'self-asserted-owner';
  assert.equal((await spoof.client.optIn()).status, 'registration_rejected');
  assert.ok(spoof.calls.includes('unsubscribe'));
  const unverified = fixture(); unverified.context.verified = false;
  assert.equal((await unverified.client.optIn()).status, 'unverified');
  const revoked = fixture(); await revoked.client.optIn(); revoked.permission = 'denied';
  assert.equal((await revoked.client.optIn()).status, 'revoked');
  const empty = fixture(); empty.browser.subscribe = async () => null;
  assert.equal((await empty.client.optIn()).status, 'unsubscribed');
});

test('owner/workspace/device/session switches at each async boundary and logout reject stale work', async () => {
  for (const boundary of ['permission', 'subscribe', 'register']) {
    for (const field of ['ownerId', 'workspaceId', 'deviceId', 'authRevision']) {
      const f = fixture(), wait = defer(); f[boundary + 'Wait'] = wait;
      const result = f.client.optIn(); await started(f, boundary);
      f.context = { ...f.context, [field]: 'changed' };
      wait.resolve();
      assert.equal((await result).status, 'stale_context');
      if (boundary !== 'permission') assert.ok(f.calls.includes('unsubscribe'));
      if (boundary === 'register') assert.deepEqual(f.calls.find(Array.isArray), ['remove', 'fake-owner-A']);
    }
  }
  const f = fixture(); f.registerWait = defer();
  const result = f.client.optIn(); await started(f, 'register');
  f.context = null; await f.client.revoke(); f.registerWait.resolve();
  assert.equal((await result).status, 'stale_context');
  assert.ok(f.calls.includes('unsubscribe'));
  const active = fixture(); await active.client.optIn(); active.context.workspaceId = 'other';
  assert.equal((await active.client.optIn()).status, 'stale_context');
  for (const boundary of ['subscribe', 'register']) {
    const revoked = fixture(); revoked[boundary + 'Wait'] = defer();
    const result = revoked.client.optIn(); await started(revoked, boundary);
    assert.equal((await revoked.client.optIn()).status, 'busy');
    revoked.permission = 'denied'; revoked[boundary + 'Wait'].resolve();
    assert.equal((await result).status, 'revoked');
    assert.ok(revoked.calls.includes('unsubscribe'));
  }
});

test('cleanup failures stay retryable, private and block later subscription', async () => {
  const f = fixture(); await f.client.optIn(); f.removeOK = false;
  assert.equal((await f.client.revoke()).status, 'cleanup_pending');
  assert.equal((await f.client.optIn()).status, 'cleanup_pending');
  f.removeOK = true;
  assert.equal((await f.client.revoke()).status, 'revoked');
  assert.equal(f.calls.filter(x => x === 'unsubscribe').length, 1, 'do not repeat successful local cleanup');
  const fault = fixture(); fault.gateway.register = async () => { throw Error('PRIVATE-SYNTHETIC-ENDPOINT'); };
  assert.equal((await fault.client.optIn()).status, 'unavailable');
  assert.ok(fault.calls.includes('unsubscribe'));
  assert.ok(!JSON.stringify([f.diagnostics, fault.diagnostics, fault.client]).includes('PRIVATE'));
});

test('n44_current_source_binding_keeps_explicit_optin_and_worker_handler', () => {
  const actual = execFileSync('git', ['grep', '--untracked', '-l', 'notification-push-', '--', 'src', 'sw.js'], { encoding: 'utf8' });
  assert.deepEqual(actual.trim().split(/\r?\n/).filter(Boolean), [
    'src/app.js',
    'src/lib/notification-push-client.js',
    'src/lib/notification-push-runtime.js',
    'src/views/notification-settings.js',
    'sw.js',
  ]);
  const src = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
  assert.match(src('src/lib/notification-push-client.js'), /browser\.hasUserActivation\(\)/);
  assert.match(src('src/lib/notification-push-client.js'), /browser\.requestPermission\(\)/);
  assert.match(src('src/lib/notification-push-client.js'), /gateway\.register\(/);
  assert.match(src('src/lib/notification-push-runtime.js'), /supportedPushConfiguration/);
  assert.match(src('src/views/notification-settings.js'), /data-act="notification-push"/);
  assert.match(src('sw.js'), /self\.addEventListener\('push',/);
  assert.match(src('sw.js'), /self\.addEventListener\('notificationclick',/);
  // This is a wiring guard, not a claim that a real device received a Push.
});

test('action independently authorized and re-derived with current owner, expiry and destination', async () => {
  const f = fixture(); assert.equal((await f.client.applyAction(payload())).status, 'action_applied');
  for (const patch of [{ authorized: false }, { destination: '/teaching/deleted/items' }, { clock: now + 60000 },
    { context: null }]) {
    const denied = Object.assign(fixture(), patch);
    assert.equal((await denied.client.applyAction(payload())).status, 'action_rejected');
    assert.ok(!denied.calls.some(Array.isArray));
  }
  for (const change of ['switch', 'logout', 'expiry']) {
    const stale = fixture(); stale.actionWait = defer(); const result = stale.client.applyAction(payload());
    await started(stale, 'authorize');
    if (change === 'switch') stale.context.workspaceId = 'changed';
    if (change === 'logout') await stale.client.revoke();
    if (change === 'expiry') stale.clock += 60000;
    stale.actionWait.resolve(); assert.equal((await result).status, 'action_rejected');
    assert.ok(!stale.calls.some(Array.isArray));
  }
});

test('n44_inactive_import_no_network_permission_SW_or_existing_UI_changes', () => {
  // Fresh process: any access to live-capability globals during module import fails.
  execFileSync(process.execPath, ['--input-type=module', '-e', `
    for (const key of ['fetch', 'Notification', 'navigator', 'localStorage', 'setTimeout', 'setInterval'])
      Object.defineProperty(globalThis, key, { configurable: true, get() { throw Error('unexpected ' + key); } });
    await import('./src/lib/notification-push-client.js');
    await import('./src/lib/notification-push-core.js');
  `], { cwd: new URL('..', import.meta.url), stdio: 'pipe' });
  for (const path of ['src/lib/notification-push-core.js', 'src/lib/notification-push-client.js']) {
    const source = readFileSync(new URL('../' + path, import.meta.url), 'utf8');
    assert.ok(!/\b(fetch|localStorage|console|setTimeout|setInterval|showNotification)\s*[.(]/.test(source));
  }
});
