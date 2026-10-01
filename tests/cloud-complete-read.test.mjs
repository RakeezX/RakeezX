import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as cloud from '../src/lib/cloud.js';
import * as db from '../src/lib/db.js';
import { createSyncV2Engine, SYNC_V2_SCHEMAS, decodeSyncV2Canonical } from '../src/lib/sync-v2.js';
import { fetchCanonicalRestoreSnapshot } from '../src/lib/backup-v2.js';
import { collectLegacyCanonicalEvidence } from '../src/lib/workspace-claim.js';
import { acquireConsistentCoreSnapshot } from '../src/lib/initial-restore.js';
import { runtimeSyncOwnershipGuard, LEGACY_UNCLAIMED_SYNC_WORKSPACE } from '../src/lib/sync-ownership.js';

const OWNER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const baseline = process.env.RAKEEZX_READ_BASELINE === '1';
const rowsOf = (n) => Array.from({ length: n }, (_, i) => ({ id: `a-${String(i).padStart(5, '0')}`,
  owner_id: OWNER, revision: 1, student_id: `s-${i % 37}`, session_id: `session-${Math.floor(i / 37)}`,
  teaching_id: 'teaching-a', date: `2026-09-${String(i % 28 + 1).padStart(2, '0')}`, status: 'present', deleted_at: null }));

async function mockHttp(run, { tables = {}, cap = 73, intercept } = {}) {
  const prior = global.fetch;
  const calls = [];
  cloud.setMockBackend(null);
  cloud.setMockAuth({ id: OWNER }, { access_token: 'synthetic', refresh_token: 'synthetic-refresh', expires_at: Date.now() / 1000 + 3600 });
  runtimeSyncOwnershipGuard.setWorkspace(LEGACY_UNCLAIMED_SYNC_WORKSPACE);
  global.fetch = async (url, options) => {
    const parsed = new URL(url);
    const entity = parsed.pathname.split('/').at(-1);
    const offset = Number(parsed.searchParams.get('offset') ?? 0);
    const limit = Number(parsed.searchParams.get('limit') ?? 500);
    const call = { entity, offset, limit, options, url: parsed }; calls.push(call);
    const overridden = await intercept?.(call, calls);
    if (overridden) return overridden;
    assert.equal(parsed.searchParams.get('owner_id'), `eq.${OWNER}`);
    if (!baseline) {
      assert.equal(parsed.searchParams.get('order'), entity === 'profile' ? 'owner_id.asc' : 'id.asc');
      assert.equal(options.headers.Prefer, 'count=exact');
    }
    const all = tables[entity] ?? [];
    const data = all.slice(offset, offset + Math.min(limit, cap));
    return new Response(JSON.stringify(data), { status: offset + data.length < all.length ? 206 : 200, headers: {
      'Content-Type': 'application/json', 'Content-Range': data.length ? `${offset}-${offset + data.length - 1}/${all.length}` : `*/${all.length}`,
    } });
  };
  try { return await run(calls); }
  finally { global.fetch = prior; cloud.setMockAuth(null, null); runtimeSyncOwnershipGuard.setWorkspace(LEGACY_UNCLAIMED_SYNC_WORKSPACE); }
}

for (const n of [0, 4, 5, 6, 1207]) {
  test(`${baseline ? 'baseline subset' : 'complete read'}: ${n} rows with a smaller server cap`, async () => {
    const cap = n > 1000 ? 73 : 5;
    await mockHttp(async (calls) => {
      for (let pull = 0; pull < 2; pull++) {
        const rows = await cloud.fetchRecords('attendance');
        assert.equal(rows.length, baseline ? Math.min(n, cap) : n);
        assert.deepEqual(rows.map(r => r.id), rowsOf(baseline ? Math.min(n, cap) : n).map(r => r.id));
      }
      assert.equal(calls.length, 2 * (baseline ? 1 : Math.max(1, Math.ceil(n / cap))));
    }, { tables: { attendance: rowsOf(n) }, cap });
  });
}

test('owner-scoped profile singleton uses its supported key', { skip: baseline }, async () => {
  await mockHttp(async () => assert.equal((await cloud.fetchRecords('profile')).length, 1),
    { tables: { profile: [{ owner_id: OWNER, revision: 1 }] } });
});

test('every Sync entity uses a supported order and backup reads receive complete tables', { skip: baseline }, async () => {
  const tables = Object.fromEntries(Object.values(SYNC_V2_SCHEMAS).map(({ entity }) =>
    [entity, entity === 'profile' ? [{ owner_id: OWNER, revision: 1 }] : rowsOf(6)]));
  tables.attendance = rowsOf(1207);
  await mockHttp(async () => {
    for (const entity of Object.keys(tables)) assert.equal((await cloud.fetchRecords(entity)).length, tables[entity].length);
    const backup = await fetchCanonicalRestoreSnapshot({ version: 5 });
    assert.equal(backup.attendance.length, 1207);
    assert.equal(backup.students.length, 6);
    assert.equal(backup.profile.length, 1);
  }, { tables, cap: 5 });
});

test('workspace evidence finds a canonical identity beyond the first page', { skip: baseline }, async () => {
  await db.clearAll();
  const students = rowsOf(620).map(row => ({ ...row, name: 'Synthetic', status: 'active' }));
  const canonical = decodeSyncV2Canonical('students', students.at(-1));
  await db.put('students', { ...canonical, serverCanonical: canonical });
  await mockHttp(async () => {
    const result = await collectLegacyCanonicalEvidence({ database: db });
    const student = result.canonicalEvidence.find(row => row.store === 'students');
    assert.equal(student.remotePresent, true);
    assert.equal(student.localHash, student.remoteHash);
  }, { tables: { students } });
  await db.clearAll();
});

test('Sync reconciliation retains local rows, tombstones and pending attendance intent', { skip: baseline }, async () => {
  await db.clearAll();
  const engine = createSyncV2Engine({ database: db, transport: { fetchRecords: cloud.fetchRecords } });
  await db.put('attendance', { id: 'local-retained', studentId: 'local-student', sessionId: 'local-session', status: 'present' });
  await db.put('attendance', { id: 'a-00000', studentId: 's-0', sessionId: 'session-0', status: 'present', serverRevision: 1 });
  await engine.queueAttendanceCommand({ attendanceId: 'a-00000', sessionId: 'session-0', studentId: 's-0', patch: { status: 'absent' } });
  const rows = rowsOf(1207); rows[1].deleted_at = '2026-10-01T00:00:00Z';
  await mockHttp(async () => {
    assert.equal((await engine.pullAll({ stores: ['attendance'] })).failures.length, 0);
    assert.equal((await db.getAll('attendance')).length, 1208);
    assert.equal((await db.get('attendance', 'a-00000')).status, 'absent');
    assert.equal((await db.get('attendance', 'a-00001')).deleted, true);
    assert.equal((await db.getAll('outbox')).length, 1);
  }, { tables: { attendance: rows } });
  await db.clearAll();
});

test('later-page failure returns no partial table for reconciliation', { skip: baseline }, async () => {
  await db.clearAll();
  await db.put('attendance', { id: 'local-retained', status: 'present' });
  const engine = createSyncV2Engine({ database: db, transport: { fetchRecords: cloud.fetchRecords } });
  await mockHttp(async () => {
    const pulled = await engine.pullAll({ stores: ['attendance'] });
    assert.equal(pulled.failures.length, 1);
    assert.deepEqual((await db.getAll('attendance')).map(r => r.id), ['local-retained']);
  }, { tables: { attendance: rowsOf(150) }, intercept: ({ offset }) => {
    if (offset > 0) throw new Error('synthetic later page network failure');
  } });
  await db.clearAll();
});

for (const kind of ['missing-count', 'non-array', 'repeated', 'wrong-range', 'changed-count', 'empty-early', 'owner-mismatch', 'account-change', 'account-round-trip', 'workspace-change']) {
  test(`fails closed: ${kind}`, { skip: baseline }, async () => {
    await mockHttp(async () => assert.rejects(cloud.fetchRecords('attendance'), /cloud read|Cloud read/i),
      { tables: { attendance: rowsOf(150) }, intercept: ({ offset }) => {
        if (kind === 'account-change' && offset) cloud.setMockAuth({ id: OTHER }, { access_token: 'other-synthetic' });
        if (kind === 'account-round-trip' && offset) {
          cloud.setMockAuth({ id: OTHER }, { access_token: 'other-synthetic' });
          cloud.setMockAuth({ id: OWNER }, { access_token: 'synthetic-again' });
        }
        if (kind === 'workspace-change' && offset) runtimeSyncOwnershipGuard.setWorkspace({ type: 'demo', ownershipState: 'demo', syncEligible: false });
        if (['account-change', 'account-round-trip', 'workspace-change'].includes(kind)) return;
        if (!offset && !['missing-count', 'non-array', 'owner-mismatch'].includes(kind)) return;
        let data = rowsOf(73), range = `${offset}-${offset + 72}/150`;
        if (kind === 'missing-count') range = '0-72/*';
        if (kind === 'non-array') data = { invalid: true };
        if (kind === 'wrong-range') range = '0-72/150';
        if (kind === 'changed-count') { data = rowsOf(150).slice(offset, offset + 73); range = `${offset}-${offset + 72}/151`; }
        if (kind === 'empty-early') { data = []; range = '*/150'; }
        if (kind === 'owner-mismatch') data[0].owner_id = OTHER;
        return new Response(JSON.stringify(data), { headers: { 'Content-Range': range } });
      } });
  });
}

test('request bounds fail rather than certify completion', { skip: baseline }, async () => {
  const { readCompleteTable } = await import('../src/lib/complete-read.js');
  await assert.rejects(readCompleteTable({ ownerId: OWNER, maxPages: 2, fetchPage: async ({ offset }) =>
    ({ data: [rowsOf(3)[offset]], contentRange: `${offset}-${offset}/3` }) }), /page bound/);
  await assert.rejects(readCompleteTable({ ownerId: OWNER, maxRows: 2, fetchPage: async () =>
    ({ data: rowsOf(3), contentRange: '0-2/3' }) }), /row bound/);
});

test('same-owner Auth refresh between pages preserves the complete read', { skip: baseline }, async () => {
  global.localStorage = { setItem() {}, removeItem() {} };
  let refreshed = false;
  await mockHttp(async () => assert.equal((await cloud.fetchRecords('attendance')).length, 150),
    { tables: { attendance: rowsOf(150) }, intercept: ({ entity, offset, options }) => {
      if (entity === 'token') {
        refreshed = true;
        return new Response(JSON.stringify({ access_token: 'refreshed-synthetic', refresh_token: 'refresh',
          user: { id: OWNER }, expires_at: Date.now() / 1000 + 3600 }));
      }
      if (offset && !refreshed) return new Response('{}', { status: 401 });
      if (offset && refreshed) assert.equal(options.headers.Authorization, 'Bearer refreshed-synthetic');
    } });
  assert.equal(refreshed, true);
});

test('a late Auth refresh cannot restore an account that changed while awaited', { skip: baseline }, async () => {
  global.localStorage = { setItem() {}, removeItem() {} };
  await mockHttp(async () => {
    cloud.setMockAuth({ id: OWNER }, { access_token: 'expired', refresh_token: 'synthetic', expires_at: 1 });
    await assert.rejects(cloud.fetchRecords('attendance'), error => error.code === 'AUTH_CONTEXT_CHANGED');
    assert.equal(cloud.user.id, OTHER);
  }, { intercept: ({ entity }) => {
    assert.equal(entity, 'token');
    cloud.setMockAuth({ id: OTHER }, { access_token: 'other-synthetic' });
    return new Response(JSON.stringify({ access_token: 'old-owner-result', user: { id: OWNER } }));
  } });
});

test('Initial Restore rejects a capped incomplete page via its unchanged manifest validation', async () => {
  const attendance = rowsOf(6);
  const manifest = attendance.map(r => ({ entity: 'attendance', id: r.id, revision: 1, deleted: false }));
  const restoreCloud = { getSyncV2RestoreManifestFull: async () => manifest,
    fetchRestoreEntityPage: async (entity, { offset, limit }) => entity === 'attendance' ? attendance.slice(offset, offset + Math.min(limit, 5)) : [] };
  await assert.rejects(acquireConsistentCoreSnapshot({ ownerId: OWNER, cloud: restoreCloud }),
    error => error.code === 'RESTORE_FAILED' && error.cause?.code === 'RESTORE_SNAPSHOT_MISMATCH');
  restoreCloud.fetchRestoreEntityPage = async (entity, { offset, limit }) => entity === 'attendance' ? attendance.slice(offset, offset + limit) : [];
  const result = await acquireConsistentCoreSnapshot({ ownerId: OWNER, cloud: restoreCloud });
  assert.equal(result.snapshot.attendance.length, 6);
});

for (const during of ['page-body', 'refresh-body']) {
  test(`logout while awaiting ${during} rejects the old read`, { skip: baseline }, async () => {
    let began, release;
    const started = new Promise(resolve => { began = resolve; });
    const gate = new Promise(resolve => { release = resolve; });
    await mockHttp(async () => {
      if (during === 'refresh-body') cloud.setMockAuth({ id: OWNER },
        { access_token: 'expired', refresh_token: 'synthetic', expires_at: 1 });
      const pull = cloud.fetchRecords('attendance');
      await started;
      cloud.setMockAuth(null, null);
      release();
      await assert.rejects(pull, error => ['CLOUD_READ_CONTEXT_CHANGED', 'AUTH_CONTEXT_CHANGED'].includes(error.code));
      assert.equal(cloud.user, null); assert.equal(cloud.session, null);
    }, { tables: { attendance: rowsOf(150) }, intercept: ({ entity, offset }) => {
      if (during === 'page-body' && offset === 73) {
        const response = new Response(JSON.stringify(rowsOf(150).slice(73, 146)),
          { status: 206, headers: { 'Content-Range': '73-145/150' } });
        const read = response.text.bind(response);
        response.text = async () => { began(); await gate; return read(); };
        return response;
      }
      if (during === 'refresh-body' && entity === 'token') {
        const response = new Response(JSON.stringify({ access_token: 'old-result', user: { id: OWNER } }));
        const read = response.json.bind(response);
        response.json = async () => { began(); await gate; return read(); };
        return response;
      }
    } });
  });
}
