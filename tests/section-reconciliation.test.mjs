import test, { beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import * as db from '../src/lib/db.js';
import * as store from '../src/store.js';
import * as sync from '../src/lib/sync.js';
import * as cloud from '../src/lib/cloud.js';

globalThis.document = { documentElement: { setAttribute() {}, removeAttribute() {} }, querySelector: () => null };
globalThis.matchMedia = () => ({ matches: false });

const OWNER = 'owner:test';
const A = 'sec:local-A';
const B = 'sec:remote-B';
const STAMP = 1_700_000_000_000;
const SCOPE = ['sections', 'teachings', 'enrollments', 'outbox'];
const snapshot = async () => Object.fromEntries(await Promise.all(SCOPE.map(async (name) => [name, await db.getAll(name)])));
const remoteSection = (id = B, extra = {}) => ({ id, owner_id: OWNER, year_id: 'year:test', grade: 4,
  label: 'ا 1', name: 'Canonical TEST section', color: '#2563eb', order: 3,
  deleted_at: null, client_updated_at: STAMP, ...extra });

let backend;
let rekeys;
let warnings;

// Exercise the real cloud.request()/fetchSectionPresence() boundary. Broad
// discovery and exact-ID responses are independently controlled (no inferred absence).
class Backend {
  records = {};
  requests = [];
  writes = [];
  exact = new Map();
  rawExact = new Map();
  broadSections = null;
  onExact = null;

  async fetch(value, options = {}) {
    const url = new URL(value);
    assert.equal(url.origin, 'https://bmekljhmepgkhywjzkdx.supabase.co');
    assert.match(url.pathname, /^\/rest\/v1\/[^/]+$/);
    const table = url.pathname.split('/').at(-1);
    const query = url.searchParams;
    const method = options.method ?? 'GET';
    this.requests.push({ table, method, id: query.get('id') });
    if (method === 'GET') {
      assert.equal(query.get('owner_id'), `eq.${OWNER}`);
      let rows = (this.records[table] ?? []).filter((row) => row.owner_id === OWNER);
      if (query.has('id')) {
        assert.equal(table, 'sections');
        assert.equal(query.get('limit'), '1');
        assert.equal(query.get('select'), 'id,owner_id,year_id,grade,label,deleted_at');
        const id = query.get('id').slice(3);
        if (this.rawExact.has(id)) return new Response(JSON.stringify(this.rawExact.get(id)));
        if (this.exact.has(id)) {
          const override = this.exact.get(id);
          if (override instanceof Error) throw override;
          rows = override;
        } else rows = rows.filter((row) => row.id === id);
        await this.onExact?.(id);
        rows = rows.map((row) => Object.fromEntries(query.get('select').split(',').map((key) => [key, row[key]])));
      } else if (table === 'sections' && this.broadSections) rows = this.broadSections;
      return new Response(JSON.stringify(rows));
    }
    assert.equal(method, 'POST');
    const rows = JSON.parse(options.body);
    assert.ok(Array.isArray(rows));
    for (const row of rows) {
      assert.equal(row.owner_id, OWNER);
      if (table === 'sections' && !row.deleted_at && (this.records.sections ?? []).some((existing) =>
        existing.id !== row.id && !existing.deleted_at && existing.year_id === row.year_id &&
        existing.grade === row.grade && existing.label === row.label)) {
        throw new Error('duplicate key value violates unique constraint "sections_natural_uniq"');
      }
    }
    this.writes.push({ table, rows: structuredClone(rows) });
    const target = this.records[table] ??= [];
    for (const row of rows) {
      const index = target.findIndex((existing) => existing.id === row.id);
      if (index < 0) target.push(row);
      else target[index] = row;
    }
    return new Response(null, { status: 204 });
  }
}

beforeEach(async (t) => {
  backend = new Backend();
  rekeys = 0;
  warnings = [];
  t.mock.method(globalThis, 'fetch', (...args) => backend.fetch(...args));
  t.mock.method(console, 'log', () => {});
  t.mock.method(console, 'warn', (...args) => warnings.push(args));
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

async function fixture({ localId = A, localLabel = ' أ   ١ ', remote = [remoteSection()] } = {}) {
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
    sections: [{ id: localId, yearId: 'year:test', grade: 4, label: localLabel, name: 'Local TEST section', updatedAt: STAMP }],
    teachings: [{ id: 'teaching:unchanged', sectionId: localId, subjectId: 'subject:test', termId: 'term:test', updatedAt: STAMP }],
    students: [{ id: 'student:test', name: 'Fictional TEST student', updatedAt: STAMP }],
    enrollments: [{ id: 'enrollment:unchanged', sectionId: localId, studentId: 'student:test', rollNo: 1, updatedAt: STAMP }],
  });
}

async function assertBlocked(code, retryable, before) {
  await sync.syncStudents();
  assert.equal(sync.state.results.structural.status, 'error');
  assert.equal(sync.state.results.structural.code, code);
  assert.equal(sync.state.results.structural.retryable, retryable);
  assert.equal(sync.state.results.students.status, 'error');
  assert.equal(rekeys, 0);
  assert.deepEqual(await snapshot(), before);
  assert.equal(backend.writes.length, 0);
}

test('ordinary adoption runs before payload construction; same-cycle dependencies use B and repeated full sync converges', async () => {
  await fixture({ localLabel: 'ا 1' }); // Also reproduces the exact RAW unique-constraint collision.
  const staleA = store.state.sections[0];
  const staleTeaching = store.state.teachings[0];
  assert.equal(await sync.syncAll(), true);
  assert.equal(sync.state.results.structural.status, 'success');
  assert.equal(sync.state.results.students.status, 'success');
  assert.equal(rekeys, 1, 'the real atomic helper ran once');
  assert.equal(await db.get('sections', A), undefined);
  const canonical = await db.get('sections', B);
  assert.equal(canonical.name, 'Canonical TEST section');
  assert.equal(canonical.color, '#2563eb');
  assert.equal(canonical.order, 3);
  assert.equal(canonical.updatedAt, STAMP, 'presence projection must not zero the full-row timestamp');
  assert.equal(staleA.id, A);
  assert.equal(staleTeaching.sectionId, A, 'old snapshot really is stale');
  assert.equal(store.state.sections.some((row) => row.id === A), false);
  assert.equal(store.getTeaching('teaching:unchanged').sectionId, B);
  assert.equal((await db.get('enrollments', 'enrollment:unchanged')).sectionId, B);
  assert.equal(backend.writes.some((write) => write.table === 'sections'), false);
  for (const table of ['teachings', 'enrollments']) {
    const rows = backend.writes.filter((write) => write.table === table).flatMap((write) => write.rows);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].section_id, B);
  }
  const exactRequests = backend.requests.filter((request) => request.id);
  assert.deepEqual(exactRequests.map((request) => request.id).sort(), [`eq.${A}`, `eq.${B}`]);
  const presenceIndex = backend.requests.findIndex((request) => request.id === `eq.${B}`);
  assert.ok(backend.requests.findIndex((request) => request.method === 'POST' && request.table === 'teachings') > presenceIndex);
  assert.ok(backend.requests.findIndex((request) => request.method === 'POST' && request.table === 'enrollments') > presenceIndex);
  assert.deepEqual(await db.getAll('outbox'), []);
  const before = await snapshot();
  const writes = backend.writes.length;
  db.closeDB();
  assert.equal(await sync.syncAll(), true);
  assert.equal(sync.state.status, 'synced');
  assert.deepEqual(await snapshot(), before);
  assert.equal(backend.writes.length, writes);
  assert.equal(rekeys, 1);
  assert.equal(backend.requests.filter((request) => request.id).length, 2);
  assert.deepEqual(warnings, []);
});

test('same technical ID preserves the existing timestamp-based section edit sync with no rekey or presence calls', async () => {
  await fixture({ localId: B, localLabel: 'ا 1' });
  await store.patch('sections', B, { name: 'Edited TEST name' });
  await sync.syncStructural();
  assert.equal(sync.state.results.structural.status, 'success');
  assert.equal(rekeys, 0);
  assert.equal(backend.requests.some((request) => request.id), false);
  assert.equal(backend.records.sections[0].name, 'Edited TEST name');
});

test('A omitted from a limited broad response but present by exact ID rejects both-remote ambiguity', async () => {
  await fixture();
  backend.records.sections.push(remoteSection(A));
  backend.broadSections = [remoteSection(B)];
  await assertBlocked('SECTION_IDENTITY_AMBIGUOUS_REMOTE_DUPLICATES', false, await snapshot());
  assert.deepEqual(backend.requests.filter((request) => request.id).map((request) => request.id).sort(), [`eq.${A}`, `eq.${B}`]);
});

for (const id of [A, B]) {
  test(`unknown exact presence for ${id} defers reconciliation without writes`, async () => {
    await fixture();
    backend.exact.set(id, new Error('TEST network failure'));
    await assertBlocked('SECTION_IDENTITY_PRESENCE_UNKNOWN', true, await snapshot());
  });
}

test('a tombstone in broad discovery is never a canonical candidate', async () => {
  await fixture({ remote: [remoteSection(B, { deleted_at: '2026-09-01T00:00:00Z' })] });
  await sync.syncStructural();
  assert.equal(sync.state.results.structural.status, 'success');
  assert.equal(rekeys, 0);
  assert.equal(backend.requests.some((request) => request.id), false);
  assert.equal((await db.get('teachings', 'teaching:unchanged')).sectionId, A);
  assert.equal((await db.get('sections', B)).deleted, true);
});

for (const [label, exact] of [
  ['tombstoned', [remoteSection(B, { deleted_at: '2026-09-01T00:00:00Z' })]],
  ['absent', []],
  ['different natural identity', [remoteSection(B, { label: 'Other TEST section' })]],
]) {
  test(`B becoming ${label} after discovery defers without canonical adoption`, async () => {
    await fixture();
    backend.exact.set(B, exact);
    await assertBlocked('SECTION_IDENTITY_CANDIDATE_CHANGED', true, await snapshot());
  });
}

test('multiple active normalized candidates are ambiguous; no arbitrary selection or writes', async () => {
  await fixture({ remote: [remoteSection(B, { label: 'أ ١' }), remoteSection('sec:C', { label: 'ا 1' })] });
  await assertBlocked('SECTION_IDENTITY_AMBIGUOUS_REMOTE_DUPLICATES', false, await snapshot());
  assert.equal(backend.requests.some((request) => request.id), false);
});

test('approved normalization folds whitespace, Arabic/Persian digits and Alef variants', async () => {
  await fixture({ localLabel: '  إآٱأا   ١۲  ', remote: [remoteSection(B, { label: 'ااااا 12' })] });
  await sync.syncStructural();
  assert.equal(sync.state.results.structural.status, 'success');
  assert.equal(rekeys, 1);
  assert.equal(await db.get('sections', A), undefined);
});

for (const [name, localLabel, remote] of [
  ['ta marbuta/ha', 'ة', remoteSection(B, { label: 'ه' })],
  ['alef maqsura/ya', 'ى', remoteSection(B, { label: 'ي' })],
  ['grade', 'ا 1', remoteSection(B, { grade: 5 })],
  ['academic year', 'ا 1', remoteSection(B, { year_id: 'year:other' })],
]) {
  test(`different ${name} is not an equivalent section`, async () => {
    await fixture({ localLabel, remote: [remote] });
    await sync.syncStructural();
    assert.equal(sync.state.results.structural.status, 'success');
    assert.equal(rekeys, 0);
    assert.equal((await db.get('teachings', 'teaching:unchanged')).sectionId, A);
  });
}

test('a local metadata edit during the exact lookups invalidates adoption evidence', async () => {
  await fixture();
  backend.onExact = async (id) => {
    if (id === B) await store.patch('sections', A, { grade: 5 });
  };
  await sync.syncStructural();
  assert.equal(sync.state.results.structural.code, 'SECTION_IDENTITY_LOCAL_CHANGED');
  assert.equal(rekeys, 0);
  assert.equal((await db.get('sections', A)).grade, 5);
  assert.equal((await db.get('teachings', 'teaching:unchanged')).sectionId, A);
  assert.equal(backend.writes.length, 0);
});

test('a malformed successful exact-A response is unknown, never authoritative absence', async () => {
  await fixture();
  backend.rawExact.set(A, { unexpected: 'not a row array' });
  await assertBlocked('SECTION_IDENTITY_PRESENCE_UNKNOWN', true, await snapshot());
});

test('a local edit queued immediately before the rekey transaction must not be adopted using stale validation', async (t) => {
  await fixture();
  const edited = { ...(await db.get('sections', A)), grade: 5, updatedAt: STAMP + 1 };
  const original = IDBDatabase.prototype.transaction;
  let editedBeforeRekey = false;
  t.mock.method(IDBDatabase.prototype, 'transaction', function (names, mode, ...args) {
    if (!editedBeforeRekey && mode === 'readwrite' && Array.isArray(names) && names.length === 4 && SCOPE.every((name) => names.includes(name))) {
      editedBeforeRekey = true;
      // IndexedDB serializes this peer edit before the adoption transaction.
      original.call(this, ['sections'], 'readwrite').objectStore('sections').put(edited);
    }
    return original.call(this, names, mode, ...args);
  });
  await sync.syncStructural();
  assert.equal(editedBeforeRekey, true);
  assert.equal(sync.state.results.structural.code, 'SECTION_IDENTITY_LOCAL_CHANGED');
  assert.deepEqual(await db.get('sections', A), edited);
  assert.equal(await db.get('sections', B), undefined);
  assert.equal((await db.get('teachings', 'teaching:unchanged')).sectionId, A);
  assert.ok(await db.get('outbox', `sections:${A}`));
  assert.equal(backend.writes.length, 0);
});
