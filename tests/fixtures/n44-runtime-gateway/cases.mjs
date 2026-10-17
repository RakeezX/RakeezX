/** Loopback HTTP -> actual boundary -> actual SQL repository. Synthetic trusted ports only. */
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import { createRuntime, listenRuntime, preflight, parseBody } from '../../../drafts/n44-push/runtime-gateway.mjs';
import { createPostgresRepository } from '../../../drafts/n44-push/postgres-repository.mjs';

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const RID = '11111111-1111-4111-8111-111111111111';
export async function qualify({ a, sql, report, pool }) {
  report.cases = [];
  const check = async (name, work) => {
    const c = { name, status: 'RUNNING' }; report.cases.push(c);
    try { c.evidence = await work(); c.status = 'PASS'; }
    catch (e) { c.status = 'FAIL'; throw e; }
  };
  // Local stubs only, no hosted service or real Auth. Same fixture RLS convention
  // as the already-qualified repository; no replay of its SQL test suite.
  await a.query(`create role anon nologin; create role authenticated nologin;
    create role n44_runtime_probe nologin nosuperuser nobypassrls inherit;
    grant authenticated to n44_runtime_probe;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('n44.fixture_uid',true),'')::uuid$$;
    grant usage on schema auth to n44_runtime_probe; grant execute on function auth.uid() to n44_runtime_probe;`);
  await a.query('insert into auth.users values ($1)', [A]); await a.query(sql);
  await a.query('grant usage on schema n44_push_draft to n44_runtime_probe; grant select,insert,update,delete on all tables in schema n44_push_draft to n44_runtime_probe');
  const p = pool(); let acquisitions = 0, failCommit = false, sends = 0, closeCalls = 0;
  const acquire = async () => {
    acquisitions++;
    const c = await p.connect();
    return { async query(text, values) {
      if (text === 'commit' && failCommit) { failCommit = false; throw Error('PRIVATE synthetic commit failure'); }
      const answer = await c.query(text, values);
      if (text.startsWith('begin')) {
        await c.query('set local role n44_runtime_probe');
        await c.query("select set_config('n44.fixture_uid',$1,true)", [A]);
      }
      return answer;
    }, release: e => c.release(e) };
  };
  const repo = createPostgresRepository({ acquire });
  const now = Date.now(), expiry = now + 3600000;
  const context = { workspaceId: 'workspace', deviceId: 'device', active: true, sessionId: 'session',
    sessionRevision: 'revision', sessionExpiresAt: expiry, consentRevision: 'consent', pushConsent: true,
    preferences: { lesson: true, due: true, lessonMinutes: 15, dueDays: [3,2,1,0], timezone: 'Asia/Riyadh', quiet: null } };
  const put = change => repo.writeContexts(A, tx => tx.set('contexts', '["workspace","device"]', { ...context, ...change }));
  await put({});
  const body = { registrationId: RID, workspaceId: 'workspace', deviceId: 'device', sessionRevision: 'revision',
    consent: { revision: 'consent', push: true }, subscription: { endpoint: 'https://push.example.test/fake',
      keys: { p256dh: `BA${'A'.repeat(85)}`, auth: 'A'.repeat(22) } } };
  const payload = { id: 'lesson:session:2026-10-18:12:00:13:00', kind: 'lesson', expiresAt: expiry,
    actionPath: '/teaching/teaching/attendance?session=session' };
  let allow = true, denyOwner = false, authDelay = 0, protectDelay = 0, invalidated = false, batch = [], throwSend = false;
  // Owned native-driver identity verification launches PowerShell for cold
  // connections; allow it within the normal 5s request budget, not 700ms.
  const config = { enabled: true, deliveryEnabled: true, requestDeadlineMs: 5000,
    applicationOrigins: ['https://app.example.test'], providerOrigins: ['https://push.example.test'] };
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  const ports = { acquire,
    async verifySession(token) { if (authDelay) await delay(authDelay); return token === 'Bearer synthetic' ?
      { ownerId: A, sessionId: 'session', sessionRevision: 'revision', expiresAt: expiry } : null; },
    async protect() { if (protectDelay) await delay(protectDelay); return { sealed: 'FAKE-NOT-CRYPTO',
      fingerprint: 'a'.repeat(64), bindingFingerprint: 'b'.repeat(64) }; },
    ingress: { async take({ kind }) { return allow && !(denyOwner && kind === 'owner'); } },
    authoritative: { serializedWriters: true, recompute(_tx, _r, id) { return !invalidated && id === payload.id ? payload : null; } },
    schedule: { async batch() { return batch; }, async owners() { return [A]; } },
    sender: { async send() {
      sends++;
      // A second actual SQL connection observes sending before network invocation.
      const rows = await a.query('select state from n44_push_draft.deliveries where owner_id=$1', [A]);
      assert.ok(rows.rows.some(r => r.state === 'sending'));
      if (throwSend) throw Error('PRIVATE synthetic unknown send outcome');
      return 'accepted';
    } },
    async close() { closeCalls++; },
  };
  const runtime = createRuntime(config, ports);
  assert.equal(runtime.preflight.status, 'configured');
  const listener = await listenRuntime(runtime, { host: '127.0.0.1', port: 0 });
  const port = listener.address.port;
  report.http = { host: '127.0.0.1', port, synthetic: true };
  const request = (raw = JSON.stringify(body), change = {}) => new Promise((resolve, reject) => {
    const r = http.request({ host: '127.0.0.1', port, path: change.path ?? '/n44/push/register', method: change.method ?? 'POST',
      headers: { Origin: 'https://app.example.test', Authorization: 'Bearer synthetic', 'Content-Type': 'application/json', ...change.headers } }, res => {
      let text = ''; res.setEncoding('utf8'); res.on('data', c => text += c);
      res.on('end', () => resolve({ code: res.statusCode, body: JSON.parse(text), headers: res.headers }));
    }); r.on('error', reject); r.end(raw);
  });
  const status = async (raw, code, value, change) => {
    const r = await request(raw, change); assert.equal(r.code, code); assert.deepEqual(r.body, { status: value });
    assert.equal(r.headers['cache-control'], 'no-store'); assert.equal(r.headers['access-control-allow-origin'], undefined);
  };
  try {
    await check('ingress, route, strict JSON, unverified auth, and deadline reject before repository acquisition', async () => {
      const before = acquisitions;
      for (const raw of ['{', JSON.stringify(body).slice(0,-1) + ',"workspaceId":"foreign"}',
        '{"a":{"x":1,"\\u0078":2}}', ' '.repeat(12289), '[true,]', '{"a":01}', 'null']) await status(raw, 400, 'rejected');
      await status(undefined, 403, 'rejected', { headers: { Origin: 'https://foreign.test' } });
      await status(undefined, 403, 'rejected', { headers: { Origin: '' } });
      await status(undefined, 400, 'rejected', { headers: { 'Content-Type': 'text/plain' } });
      await status(undefined, 400, 'rejected', { headers: { Origin: ['https://app.example.test', 'https://app.example.test'] } });
      await status(undefined, 400, 'rejected', { headers: { 'Content-Encoding': 'gzip' } });
      await status(Buffer.from([0xff]), 400, 'rejected');
      await status(undefined, 401, 'rejected', { headers: { Authorization: 'Bearer forged' } });
      await status(undefined, 404, 'rejected', { path: '/n44/push/deliver' });
      await status(undefined, 404, 'rejected', { method: 'OPTIONS' });
      allow = false; await status(undefined, 429, 'limited'); allow = true;
      denyOwner = true; await status(undefined, 429, 'limited'); denyOwner = false;
      authDelay = 5200; await status(undefined, 503, 'unavailable'); authDelay = 0;
      protectDelay = 5200; await status(undefined, 503, 'unavailable'); protectDelay = 0;
      await delay(5300); assert.equal(acquisitions, before, 'late auth/protect must never reach SQL');
      assert.throws(() => parseBody('{"x":1,"\\u0078":2}'));
      return 'Real loopback HTTP, no SQL acquisition or mutation for malformed/oversize/duplicate/origin/auth/rate/deadline failures; late completion drained.';
    });
    await check('actual HTTP registration, SQL commit failure, receipt replay and current context', async () => {
      await status(JSON.stringify({ ...body, ownerId: A }), 400, 'rejected');
      failCommit = true; await status(undefined, 503, 'unavailable');
      assert.equal((await a.query('select count(*)::int as n from n44_push_draft.registrations')).rows[0].n, 0);
      await status(undefined, 200, 'registered'); await status(undefined, 200, 'registered');
      assert.equal((await a.query('select count(*)::int as n from n44_push_draft.registrations')).rows[0].n, 1);
      await put({ pushConsent: false }); await status(undefined, 400, 'rejected'); await put({});
      return 'Actual registration boundary and actual PostgreSQL repository commit/readback; failed COMMIT rolled back; same original UUID reconciles to one row; serialized current consent checked.';
    });
    await check('private scheduler committed-permit fence, replay suppression, cleanup and original revoke', async () => {
      batch = [{ ownerId: A, registrationId: RID, payload }];
      assert.deepEqual(await runtime.runDelivery(), { status: 'completed', count: 1 });
      assert.equal(sends, 1); await runtime.runDelivery(); assert.equal(sends, 1);
      payload.id = 'lesson:session-2:2026-10-18:12:00:13:00';
      failCommit = true; assert.equal((await runtime.runDelivery()).status, 'unavailable'); assert.equal(sends, 1);
      throwSend = true; await runtime.runDelivery(); assert.equal(sends, 2);
      throwSend = false; await runtime.runDelivery(); assert.equal(sends, 2);
      assert.equal((await a.query("select count(*)::int as n from n44_push_draft.deliveries where state='uncertain'")).rows[0].n, 1);
      await status(undefined, 404, 'rejected', { path: '/n44/push/cleanup' });
      await put({ active: false }); assert.equal((await runtime.runCleanup()).status, 'completed');
      const row = (await a.query('select state,sealed from n44_push_draft.registrations')).rows[0];
      assert.deepEqual(row, { state: 'revoked', sealed: null });
      await status(JSON.stringify({ registrationId: RID, workspaceId: 'workspace', deviceId: 'device' }), 200, 'revoked', { path: '/n44/push/revoke' });
      await put({}); await status(undefined, 400, 'rejected');
      return 'Actual private delivery entry observed committed sending through independent SQL connection before fake sender; one invocation across replay; cleanup erases sealed material and original UUID cannot resurrect.';
    });
    await check('single disabled preflight and construction cannot activate dependencies', async () => {
      const disabled = createRuntime(); assert.equal(disabled.preflight.status, 'disabled');
      assert.ok(disabled.preflight.missing.includes('current_session_verifier'));
      assert.ok(disabled.preflight.missing.includes('serialized_current_state_writers'));
      assert.ok(disabled.preflight.missing.includes('audited_sender'));
      assert.equal(preflight({ ...config, deliveryEnabled: false }, ports).status, 'disabled');
      assert.deepEqual(await disabled.runDelivery(), { status: 'disabled' }); await disabled.close();
      batch = Array(101).fill({ ownerId: A, registrationId: RID, payload });
      assert.equal((await runtime.runDelivery()).status, 'unavailable'); assert.equal(sends, 2);
      return 'No defaults/credentials/network activation; absent required ports produce one explicit disabled preflight; private batch bounded at 100.';
    });
    report.checks.push({ name: 'n44_actual_http_registration_and_private_runtime_composition', status: 'PASS', evidence: 'See cases: actual loopback registration/replay + SQL readbacks; private committed-permit sender observation, cleanup and original revoke.' });
    report.checks.push({ name: 'n44_ingress_auth_body_commit_failure_and_disabled_preflight', status: 'PASS', evidence: 'See cases: ingress/body/origin/auth/rate/deadline no-acquisition negatives; COMMIT rollback; current context and disabled preflight.' });
  } finally {
    await listener.close(); await runtime.close(); assert.equal(closeCalls, 1);
    assert.deepEqual(await runtime.runCleanup(), { status: 'disabled' });
    const rebound = net.createServer(); await new Promise((resolve, reject) => { rebound.once('error', reject); rebound.listen({ host: '127.0.0.1', port, exclusive: true }, resolve); });
    await new Promise(resolve => rebound.close(resolve)); report.http.closedAndRebound = true;
  }
}
