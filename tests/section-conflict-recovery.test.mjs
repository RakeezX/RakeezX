import test, { beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import * as cloud from '../src/lib/cloud.js';
import * as sync from '../src/lib/sync.js';
import * as store from '../src/store.js';
import * as db from '../src/lib/db.js';

globalThis.document = { documentElement: { setAttribute() {}, removeAttribute() {} }, querySelector: () => null };
globalThis.matchMedia = () => ({ matches: false });

const OWNER = 'owner:test';
const A = 'sec:local-A';
const B = 'sec:canonical-B';
const T = 'teaching:unchanged';
const STAMP = 1_700_000_000_000;
const HISTORY = ['slots', 'sessions', 'attendance', 'items', 'scores', 'notes'];
const SCOPE = ['sections', 'teachings', 'enrollments', 'outbox'];
const snapshot = async (names = SCOPE) => Object.fromEntries(await Promise.all(names.map(async (name) => [name, await db.getAll(name)])));
const section = (id = B, extra = {}) => ({ id, owner_id: OWNER, year_id: 'year:test', grade: 4, label: '1',
  name: 'Canonical TEST section', color: '#2563eb', order: 2, client_updated_at: STAMP, deleted_at: null, ...extra });
const PG_ERROR = { code: '23505', message: 'duplicate key value violates unique constraint "sections_natural_uniq"',
  details: 'Key (owner_id, year_id, grade, label) already exists.', hint: null };

let backend;
let rekeys;

class Backend {
  records = {};
  requests = [];
  attempts = [];
  writes = [];
  failureTable = 'sections';
  failures = 1;
  error = PG_ERROR;
  onConflict = null;
  hideBroadSections = true;
  scopeRows = null;
  scopeError = null;
  exact = new Map();

  async fetch(value, options = {}) {
    const url = new URL(value);
    assert.match(url.pathname, /^\/rest\/v1\/[^/]+$/);
    const table = url.pathname.split('/').at(-1);
    const query = url.searchParams;
    const method = options.method ?? 'GET';
    this.requests.push({ url, table, method });
    if (method === 'GET') {
      assert.equal(query.get('owner_id'), `eq.${cloud.user.id}`);
      let rows = (this.records[table] ?? []).filter((row) => row.owner_id === cloud.user.id);
      if (table === 'sections' && query.has('year_id')) {
        if (this.scopeError) throw this.scopeError;
        assert.equal(query.get('order'), 'id.asc');
        assert.equal(query.get('limit'), '1000');
        assert.equal(query.has('label'), false, 'raw label must never restrict candidate discovery');
        assert.equal(query.has('deleted_at'), false, 'tombstones must remain visible');
        rows = this.scopeRows ?? rows.filter((row) => row.year_id === query.get('year_id').slice(3) && String(row.grade) === query.get('grade').slice(3));
      } else if (table === 'sections' && query.has('id')) {
        const id = query.get('id').slice(3);
        assert.equal(query.get('limit'), '1');
        if (this.exact.has(id)) {
          const override = this.exact.get(id);
          if (override instanceof Error) throw override;
          rows = override;
        } else rows = rows.filter((row) => row.id === id);
      } else if (table === 'sections' && this.hideBroadSections) rows = [];
      if (Array.isArray(rows) && query.get('select') !== '*') {
        rows = rows.map((row) => Object.fromEntries(query.get('select').split(',').map((key) => [key, row[key]])));
      }
      return new Response(JSON.stringify(rows));
    }
    assert.equal(method, 'POST');
    const rows = JSON.parse(options.body);
    assert.ok(Array.isArray(rows));
    assert.ok(rows.every((row) => row.owner_id === OWNER));
    this.attempts.push({ table, rows: structuredClone(rows) });
    if (table === this.failureTable && this.failures > 0) {
      this.failures--;
      await this.onConflict?.();
      // Real parsed PostgREST error boundary, not a hand-built JS exception.
      return new Response(JSON.stringify(this.error), { status: 409 });
    }
    this.writes.push({ table, rows: structuredClone(rows) });
    const target = this.records[table] ??= [];
    for (const row of rows) {
      const index = target.findIndex((record) => record.id === row.id);
      if (index < 0) target.push(row);
      else target[index] = row;
    }
    return new Response(null, { status: 204 });
  }
}

beforeEach(async (t) => {
  backend = new Backend();
  rekeys = 0;
  t.mock.method(globalThis, 'fetch', (...args) => backend.fetch(...args));
  t.mock.method(console, 'log', () => {});
  t.mock.method(console, 'warn', () => {});
  const original = IDBDatabase.prototype.transaction;
  t.mock.method(IDBDatabase.prototype, 'transaction', function (names, mode, ...args) {
    if (mode === 'readwrite' && Array.isArray(names) && names.length === 4 && SCOPE.every((name) => names.includes(name))) rekeys++;
    return original.call(this, names, mode, ...args);
  });
  cloud.setMockBackend(null);
  cloud.setMockAuth({ id: OWNER }, { access_token: 'fictional-test-token' });
  await db.clearAll();
  for (const name of Object.keys(store.state)) if (Array.isArray(store.state[name])) store.state[name] = [];
  store.state.profile = null;
  store.state.device = null;
  await store.patchDevice({ deviceId: 'test-device', lastSyncAt: 0 });
  sync.state.status = 'idle';
  sync.state.results = {};
});
after(() => { cloud.setMockAuth(null, null); store.closeChannel(); db.closeDB(); });

async function fixture({ remote = [], label = '1', history = false } = {}) {
  const parents = {
    years: [{ id: 'year:test', label: 'TEST year', updatedAt: STAMP }],
    terms: [{ id: 'term:test', yearId: 'year:test', name: 'TEST term', updatedAt: STAMP }],
    subjects: [{ id: 'subject:test', name: 'TEST subject', updatedAt: STAMP }],
  };
  await store.save(parents, { queue: false });
  for (const [table, rows] of Object.entries(parents)) backend.records[table] = rows.map((row) => ({
    id: row.id, owner_id: OWNER, year_id: row.yearId, name: row.name, label: row.label,
    client_updated_at: row.updatedAt, deleted_at: null,
  }));
  backend.records.sections = structuredClone(remote);
  await store.save({
    sections: [{ id: A, yearId: 'year:test', grade: 4, label, name: 'Local TEST section', updatedAt: STAMP }],
    teachings: [{ id: T, sectionId: A, subjectId: 'subject:test', termId: 'term:test', updatedAt: STAMP }],
    students: [{ id: 'student:test', name: 'Fictional TEST student', updatedAt: STAMP }],
    enrollments: [{ id: 'enrollment:unchanged', sectionId: A, studentId: 'student:test', rollNo: 1, updatedAt: STAMP }],
  });
  if (history) await store.save({
    slots: [{ id: 'slot:test', teachingId: T, weekday: 0, period: 1, updatedAt: STAMP }],
    sessions: [{ id: 'session:test', teachingId: T, slotId: 'slot:test', date: '2026-08-01', period: 1, status: 'completed', updatedAt: STAMP }],
    attendance: [{ id: 'attendance:test', teachingId: T, studentId: 'student:test', sessionId: 'session:test', status: 'present', updatedAt: STAMP }],
    items: [{ id: 'item:test', teachingId: T, name: 'TEST homework', max: 10, category: 'homework', updatedAt: STAMP }],
    scores: [{ id: 'score:test', studentId: 'student:test', itemId: 'item:test', value: 8, updatedAt: STAMP }],
    notes: [{ id: 'note:test', studentId: 'student:test', teachingId: T, date: '2026-08-01', text: 'TEST history', updatedAt: STAMP }],
  });
}

const scopeCalls = () => backend.requests.filter((request) => request.url.searchParams.has('year_id'));
const attemptedA = () => backend.attempts.filter((write) => write.table === 'sections').flatMap((write) => write.rows).filter((row) => row.id === A);

async function assertBlocked(code) {
  const before = await snapshot();
  await sync.syncStudents();
  const result = sync.state.results.structural;
  assert.equal(result.status, 'error');
  assert.equal(result.code, code);
  assert.equal(result.databaseError.code, '23505');
  assert.deepEqual(await snapshot(), before);
  assert.equal(rekeys, 0);
  assert.equal(attemptedA().length, 1);
  assert.equal(backend.writes.length, 0);
  return result;
}

test('A: race recovers once, retains history and immutable IDs, and the next complete sync has no A or outbox churn', async () => {
  await fixture({ history: true });
  const historyBefore = await snapshot(HISTORY);
  backend.onConflict = () => { backend.records.sections.push(section()); };
  assert.equal(await sync.syncAll(), true);
  assert.equal(rekeys, 1);
  assert.equal(attemptedA().length, 1);
  assert.equal(scopeCalls().length, 1);
  assert.equal(await db.get('sections', A), undefined);
  assert.equal((await db.get('sections', B)).name, 'Canonical TEST section');
  assert.equal((await db.get('sections', B)).updatedAt, STAMP);
  assert.equal((await db.get('teachings', T)).sectionId, B);
  assert.equal((await db.get('enrollments', 'enrollment:unchanged')).sectionId, B);
  for (const table of ['teachings', 'enrollments']) {
    const sent = backend.writes.filter((write) => write.table === table).flatMap((write) => write.rows);
    assert.ok(sent.length > 0);
    assert.ok(sent.every((row) => row.section_id === B));
  }
  assert.deepEqual(await snapshot(HISTORY), historyBefore);
  assert.deepEqual(await db.getAll('outbox'), []);
  assert.equal(backend.records.sections.some((row) => row.id === A), false);
  const firstScope = backend.requests.findIndex((request) => request.url.searchParams.has('year_id'));
  assert.ok(firstScope > backend.requests.findIndex((request) => request.table === 'sections' && request.method === 'POST'));
  const exactIds = backend.requests.filter((request) => request.url.searchParams.has('id')).map((request) => request.url.searchParams.get('id'));
  assert.ok(exactIds.includes(`eq.${A}`));
  assert.ok(exactIds.includes(`eq.${B}`));
  db.closeDB();
  const before = await snapshot();
  assert.equal(await sync.syncAll(), true);
  assert.deepEqual(await snapshot(), before);
  assert.equal(rekeys, 1);
  assert.equal(scopeCalls().length, 1);
  assert.equal(attemptedA().length, 1);
});

test('B: pre-existing B remains hidden from every broad fetch; scoped discovery and exact enrollment parents allow completion', async () => {
  await fixture({ remote: [section()] });
  assert.equal(await sync.syncAll(), true);
  assert.equal(sync.state.results.students.status, 'success');
  assert.equal(rekeys, 1);
  assert.equal(attemptedA().length, 1);
  assert.equal((await db.get('enrollments', 'enrollment:unchanged')).sectionId, B);
});

test('C: future normalized-index conflict matches Alef/digit variants without changing the original cloud label', async () => {
  await fixture({ label: '  أ   ١۲ ', remote: [section(B, { label: 'ا 12' })] });
  backend.error = { ...PG_ERROR, message: 'duplicate key violates future normalized section identity index' };
  await sync.syncStructural();
  assert.equal(sync.state.results.structural.status, 'success');
  assert.equal((await db.get('sections', B)).label, 'ا 12');
  assert.equal(rekeys, 1);
});

test('D: multiple normalized active candidates block before exact checks or rekey', async () => {
  await fixture({ label: 'أ', remote: [section(B, { label: 'ا' }), section('sec:C', { label: 'آ' })] });
  const result = await assertBlocked('SECTION_IDENTITY_AMBIGUOUS_REMOTE_DUPLICATES');
  assert.equal(result.retryable, false);
});

test('E: A hidden from candidate response but exact-present alongside B cannot be merged', async () => {
  await fixture({ remote: [section()] });
  backend.exact.set(A, [section(A)]);
  await assertBlocked('SECTION_IDENTITY_AMBIGUOUS_REMOTE_DUPLICATES');
});

test('F: failed candidate query is retryable/non-authoritative and preserves the original conflict', async () => {
  await fixture({ remote: [section()] });
  backend.scopeError = new Error('TEST offline');
  const result = await assertBlocked('SECTION_IDENTITY_CANDIDATE_LOOKUP_INCOMPLETE');
  assert.equal(result.retryable, true);
  assert.equal(result.recovery.reason, 'unknown');
});

test('G: exactly 1000 candidates is overflow, not evidence of uniqueness', async () => {
  await fixture({ remote: [section()] });
  backend.scopeRows = Array.from({ length: 1000 }, (_, index) => section(`sec:${index}`, { label: index ? `other-${index}` : '1' }));
  const result = await assertBlocked('SECTION_IDENTITY_CANDIDATE_LOOKUP_INCOMPLETE');
  assert.equal(result.recovery.reason, 'overflow');
});

test('H: old raw-constraint tombstone conflict blocks automatic retries without clearing pending data', async (t) => {
  await fixture({ label: '2', remote: [section(B, { label: '2', deleted_at: '2026-08-01T00:00:00Z' })] });
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const before = await snapshot();
  assert.equal(await sync.syncAll(), false);
  assert.equal(sync.state.status, 'error');
  assert.equal(sync.state.results.structural.code, 'SECTION_NATURAL_KEY_BLOCKED_BY_TOMBSTONE');
  assert.equal(sync.state.results.structural.retryable, false);
  t.mock.timers.tick(10000);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(attemptedA().length, 1);
  assert.equal(scopeCalls().length, 1);
  assert.equal(rekeys, 0);
  assert.deepEqual(await snapshot(), before);
});

test('I: unrelated 23505 retains original message/code/details/hint/status and diagnostic context', async () => {
  await fixture({ remote: [section(B, { label: 'different' })] });
  backend.error = { code: '23505', message: 'Unrelated TEST constraint', details: 'TEST details', hint: 'TEST hint' };
  const result = await assertBlocked('23505');
  assert.equal(result.error, backend.error.message);
  assert.deepEqual(result.databaseError, { ...backend.error, status: 409 });
  assert.equal(result.recovery.reason, 'no-verified-natural-match');
});

test('one failed bulk POST recovers A and retries unrelated C once using fresh payloads', async () => {
  await fixture({ remote: [section()] });
  await store.save({ sections: [{ id: 'sec:C', yearId: 'year:test', grade: 4, label: '3', updatedAt: STAMP }] });
  await sync.syncStructural();
  assert.equal(sync.state.results.structural.status, 'success');
  const attempts = backend.attempts.filter((write) => write.table === 'sections');
  assert.deepEqual(attempts.map((write) => write.rows.map((row) => row.id).sort()), [[A, 'sec:C'].sort(), ['sec:C']]);
  assert.equal(scopeCalls().length, 1, 'one scoped lookup per year/grade in this failed operation');
  assert.equal(backend.records.sections.some((row) => row.id === 'sec:C'), true);
});

test('a second failed POST escapes without a second recovery attempt', async () => {
  await fixture({ remote: [section()] });
  await store.save({ sections: [{ id: 'sec:C', yearId: 'year:test', grade: 4, label: '3', updatedAt: STAMP }] });
  backend.failures = 2;
  await sync.syncStructural();
  assert.equal(sync.state.results.structural.code, '23505');
  assert.equal(backend.attempts.filter((write) => write.table === 'sections').length, 2);
  assert.equal(attemptedA().length, 1);
  assert.equal(scopeCalls().length, 1);
  assert.equal(rekeys, 1);
  assert.ok(await db.get('outbox', 'sections:sec:C'));
});

test('23505 from another table never enters section recovery', async () => {
  await fixture();
  backend.records.subjects = [];
  backend.failureTable = 'subjects';
  await sync.syncStructural();
  assert.equal(sync.state.results.structural.code, '23505');
  assert.equal(scopeCalls().length, 0);
  assert.equal(rekeys, 0);
});

test('message-only duplicate text without SQLSTATE does not authorize recovery', async () => {
  await fixture({ remote: [section()] });
  backend.error = { message: PG_ERROR.message };
  await sync.syncStructural();
  assert.equal(sync.state.results.structural.status, 'error');
  assert.equal(scopeCalls().length, 0);
  assert.equal(rekeys, 0);
});

test('candidate request uses encoded owner/year/grade, full mapper metadata and includes tombstones', async () => {
  const owner = 'owner & عربي';
  const yearId = 'year:test /أ&';
  cloud.setMockAuth({ id: owner }, { access_token: 'test' });
  backend.scopeRows = [section(B, { owner_id: owner, year_id: yearId, deleted_at: '2026-08-01T00:00:00Z' })];
  const result = await cloud.fetchSectionCandidates({ yearId, grade: 4 });
  assert.equal(result.authoritative, true);
  assert.equal(result.status, 'complete');
  assert.equal(result.rows[0].deleted_at, '2026-08-01T00:00:00Z');
  assert.equal(result.rows[0].client_updated_at, STAMP);
  const url = scopeCalls()[0].url;
  assert.equal(url.pathname, '/rest/v1/sections');
  assert.equal(url.searchParams.get('year_id'), `eq.${yearId}`);
  assert.equal(url.searchParams.get('grade'), 'eq.4');
  assert.ok(url.href.includes(encodeURIComponent(owner)));
  assert.ok(url.href.includes(encodeURIComponent(yearId)));
});

for (const count of [0, 999, 1000]) {
  test(`candidate completeness boundary: ${count} rows`, async () => {
    backend.scopeRows = Array.from({ length: count }, (_, index) => section(`sec:${index}`));
    const result = await cloud.fetchSectionCandidates({ yearId: 'year:test', grade: 4 });
    assert.equal(result.authoritative, count < cloud.SECTION_CANDIDATE_LIMIT);
    assert.equal(result.status, count < 1000 ? 'complete' : 'overflow');
  });
}

test('candidate authentication failure and malformed/wrong-owner responses never prove completeness', async () => {
  cloud.setMockAuth(null, null);
  assert.equal((await cloud.fetchSectionCandidates({ yearId: 'year:test', grade: 4 })).authoritative, false);
  assert.equal(backend.requests.length, 0);
  cloud.setMockAuth({ id: OWNER }, { access_token: 'test' });
  for (const rows of [{ invalid: true }, [section(B, { owner_id: 'another-owner' })]]) {
    backend.scopeRows = rows;
    const result = await cloud.fetchSectionCandidates({ yearId: 'year:test', grade: 4 });
    assert.equal(result.authoritative, false);
    assert.deepEqual(result.rows, []);
  }
});

for (const id of [A, B]) {
  test(`unknown exact ${id} after a verified 23505 candidate does not permit rekey`, async () => {
    await fixture({ remote: [section()] });
    backend.exact.set(id, new Error('TEST exact lookup failure'));
    await assertBlocked('SECTION_IDENTITY_PRESENCE_UNKNOWN');
  });
}
