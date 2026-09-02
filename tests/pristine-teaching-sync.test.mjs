import test, { before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import 'fake-indexeddb/auto';
import * as db from '../src/lib/db.js';
import * as store from '../src/store.js';
import * as cloud from '../src/lib/cloud.js';
import * as sync from '../src/lib/sync.js';
import { makeTeaching, defaultItemsFor, studentTotal } from '../src/models.js';

globalThis.document = { documentElement: { setAttribute() {}, removeAttribute() {} }, querySelector: () => null };
globalThis.matchMedia = () => ({ matches: false });
const OWNER = '11111111-1111-4111-8111-111111111111';
const STAMP = 1700000000000, YEAR = 'year:TEST', TERM = 'term:TEST', SUBJECT = 'subject:TEST', B = 'sec:TEST-cloud';
const TB = makeTeaching({ sectionId: B, subjectId: SUBJECT, termId: TERM, updatedAt: STAMP });
const core = (await readFile(new URL('../supabase/migrations/0001_core_schema.sql', import.meta.url), 'utf8')).replace(/^\uFEFF/, '');
const migration = await readFile(new URL('../supabase/migrations/0007_sections_active_normalized_identity.sql', import.meta.url), 'utf8');
const tables = new Set([...core.matchAll(/create table rakeezx\.(\w+) \(/g)].map(match => match[1]));
const disk = async () => Object.fromEntries(await Promise.all(db.STORES.map(async name => [name, await db.getAll(name)])));
const businessDisk = async () => Object.fromEntries(Object.entries(await disk()).filter(([name]) => name !== 'device'));
let pg, backend, calls;
before(async () => {
  pg = new PGlite(); // In-memory PostgreSQL; never connects to a live service.
  await pg.exec(`create schema auth; create table auth.users(id uuid primary key);
    insert into auth.users values('${OWNER}');
    create function auth.uid() returns uuid language sql immutable as $$select '${OWNER}'::uuid$$;`);
});
beforeEach(async t => {
  t.mock.method(console, 'log', () => {}); t.mock.method(console, 'warn', () => {});
  await db.clearAll();
  for (const name of Object.keys(store.state)) if (Array.isArray(store.state[name])) store.state[name] = [];
  store.state.device = null; store.state.profile = null;
  sync.state.status = 'idle'; sync.state.results = {};
  cloud.setMockBackend(null); cloud.setMockAuth(null, null);
  await pg.exec('drop schema if exists rakeezx cascade;'); // ONLY the in-memory fixture.
  await pg.exec(core); await pg.exec(migration);
  await pg.query(`insert into rakeezx.years(id,label,hijri_start,hijri_end,client_updated_at) values($1,'TEST year',1448,1449,$2)`, [YEAR, STAMP]);
  await pg.query(`insert into rakeezx.terms(id,year_id,name,"index",client_updated_at) values($1,$2,'TEST term',1,$3)`, [TERM, YEAR, STAMP]);
  await pg.query(`insert into rakeezx.subjects(id,name,slug,client_updated_at) values($1,'TEST subject','test',$2)`, [SUBJECT, STAMP]);
  await pg.query(`insert into rakeezx.sections(id,year_id,grade,label,name,client_updated_at) values($1,$2,4,'1','TEST class',$3)`, [B, YEAR, STAMP]);
  await pg.query(`insert into rakeezx.teachings(id,section_id,subject_id,term_id,client_updated_at) values($1,$2,$3,$4,$5)`, [TB.id, B, SUBJECT, TERM, STAMP]);
  for (const item of defaultItemsFor(TB.id)) {
    await pg.query(`insert into rakeezx.items(id,teaching_id,name,max,"order",auto,per_point,penalty,client_updated_at)
      values($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [item.id, TB.id, item.name, item.max, item.order, item.auto, item.perPoint, item.penalty, STAMP]);
  }
  await store.save({ years: [{ id: YEAR, label: 'TEST year', hijriStart: 1448, hijriEnd: 1449, updatedAt: STAMP }],
    terms: [{ id: TERM, yearId: YEAR, name: 'TEST term', index: 1, updatedAt: STAMP }],
    subjects: [{ id: SUBJECT, name: 'TEST subject', slug: 'test', updatedAt: STAMP }] }, { queue: false });
  await store.patchDevice({ activeYearId: YEAR, activeTermId: TERM, deviceId: 'TEST-device-A' });
  await store.init(); // Include normal local boot defaults before taking reload/no-op snapshots.
  calls = { exact: [], fetch: [], upload: [] };
  backend = {
    async fetchRecords(table) {
      assert.ok(tables.has(table)); calls.fetch.push(table);
      // PostgREST returns PostgreSQL numeric columns as JSON numbers. PGlite's
      // direct SQL numeric decoder returns strings; use PostgreSQL's real JSON
      // serialization to exercise the same parsed-body contract as Production.
      return (await pg.query(`select row_to_json(r) as record from rakeezx.${table} r where owner_id=$1`, [OWNER])).rows.map(row => row.record);
    },
    async fetchTeachingPresence(id) {
      calls.exact.push(id);
      return (await pg.query(`select id,owner_id,section_id,subject_id,term_id,deleted_at from rakeezx.teachings where owner_id=$1 and id=$2 limit 1`, [OWNER, id])).rows;
    },
    async upsertRecords(table, records) {
      calls.upload.push({ table, records: structuredClone(records) });
      throw new Error(`Unexpected upload in canonical-only fixture: ${table}`);
    },
  };
  cloud.setMockBackend(backend); cloud.setMockAuth({ id: OWNER }, { access_token: 'TEST-token' });
});
after(async () => { cloud.setMockBackend(null); cloud.setMockAuth(null, null); store.closeChannel(); db.closeDB(); await pg.close(); });

async function fresh({ adopted = false } = {}) {
  const section = await store.createSection({ grade: 4, label: '١' });
  const ta = await store.createTeaching({ sectionId: section.id, subjectId: SUBJECT, termId: TERM });
  const items = structuredClone(store.items(ta.id));
  if (adopted) {
    await store.rekeyLocalSectionIdentity({ fromSectionId: section.id,
      canonicalSection: { id: B, yearId: YEAR, grade: 4, label: '1', name: 'TEST class', updatedAt: STAMP, deleted: false } });
  }
  return { section, ta, items };
}
const sqlSnapshot = async () => Object.fromEntries(await Promise.all(['sections', 'teachings', 'items', 'students', 'enrollments', 'scores', 'sessions'].map(async table =>
  [table, (await pg.query(`select * from rakeezx.${table} order by id`)).rows])));

test('fresh two-device class converges through actual section + teaching + scoring sync, never uploads TA/defaults, total remains 100', async () => {
  const f = await fresh();
  const cloudBefore = await sqlSnapshot();
  assert.equal(await sync.syncAll({ full: false }), true);
  assert.equal(sync.state.results.structural.status, 'success');
  assert.equal(sync.state.results.scoring.status, 'success');
  assert.equal(sync.state.results.scoring.stats.items.pulled, 5);
  assert.equal(await db.get('sections', f.section.id), undefined);
  assert.equal(await db.get('teachings', f.ta.id), undefined);
  assert.ok(await db.get('teachings', TB.id));
  for (const item of f.items) assert.equal(await db.get('items', item.id), undefined);
  assert.equal((await db.getAll('teachings')).length, 1);
  assert.equal((await db.getAll('items')).length, 5);
  assert.deepEqual(await db.getAll('outbox'), []);
  assert.deepEqual(await db.getAll('enrollments'), []);
  assert.equal(studentTotal(store.items(TB.id), { classHasParticipation: false, scoresByItem: {}, attendance: [], logs: [] }).outOfAll, 100);
  assert.deepEqual(await sqlSnapshot(), cloudBefore);
  assert.deepEqual(calls.upload, []);
  assert.deepEqual(calls.exact.sort(), [f.ta.id, TB.id].sort());
  // Immediate orchestrator repeat and explicit later structural/scoring pull are no-ops.
  const converged = await businessDisk();
  calls.exact.length = 0;
  assert.equal(await sync.syncAll({ full: false }), true);
  db.closeDB(); await store.init();
  const stats = await sync.syncScoring();
  for (const stat of Object.values(stats)) assert.deepEqual(stat, { pushed: 0, pulled: 0 });
  assert.deepEqual(await businessDisk(), converged);
  assert.deepEqual(calls.upload, []); assert.deepEqual(calls.exact, []);
  assert.deepEqual(await sqlSnapshot(), cloudBefore);
});

test('delayed peer invalidation cannot upload abandoned TA/defaults from stale in-memory snapshots', async () => {
  const f = await fresh({ adopted: true });
  const stale = { teachings: structuredClone(store.state.teachings), items: structuredClone(store.state.items) };
  assert.equal(await sync.syncAll({ full: false }), true);
  Object.assign(store.state, stale); // Another tab has not received the committed invalidation.
  const before = await businessDisk();
  const stats = await sync.syncScoring();
  assert.equal(sync.state.results.structural.status, 'success');
  assert.equal(sync.state.results.scoring.status, 'success');
  for (const stat of Object.values(stats)) assert.deepEqual(stat, { pushed: 0, pulled: 0 });
  assert.deepEqual(calls.upload, []);
  assert.deepEqual(await businessDisk(), before);
  assert.equal(await db.get('teachings', f.ta.id), undefined);
});

test('non-pristine conflict preserves all data and pending work and schedules no automatic retry', async t => {
  const f = await fresh({ adopted: true });
  await store.save({ scores: [{ id: 'score:TEST', itemId: f.items[1].id, studentId: 'student:TEST', value: 7 }] });
  const before = await disk(), cloudBefore = await sqlSnapshot();
  const timer = t.mock.method(globalThis, 'setTimeout');
  for (let run = 0; run < 2; run++) {
    assert.equal(await sync.syncAll({ full: false }), false);
    assert.equal(sync.state.results.structural.code, 'TEACHING_IDENTITY_CONFLICT_REQUIRES_RESOLUTION');
    assert.equal(sync.state.results.structural.retryable, false);
    assert.equal(sync.state.results.structural.recovery.reason, 'linked-data:scores');
    assert.deepEqual(await disk(), before);
    assert.deepEqual(await sqlSnapshot(), cloudBefore);
  }
  assert.equal(timer.mock.calls.some(call => call.arguments[1] === 900), false, 'No endless conflict retry timer');
  assert.deepEqual(calls.upload, []);
});

for (const scenario of ['TA-present', 'TA-tombstone', 'unknown', 'missing-auth', 'TB-tombstone', 'TB-absent', 'TB-key-changed', 'wrong-owner', 'auth-race']) {
  test(`${scenario} exact presence fails closed before any local adoption or upload`, async t => {
    const f = await fresh({ adopted: true });
    const original = backend.fetchTeachingPresence;
    backend.fetchTeachingPresence = async id => {
      const rows = await original(id);
      if (id === f.ta.id && (scenario === 'TA-present' || scenario === 'TA-tombstone')) {
        return [{ id, owner_id: OWNER, section_id: 'sec:old', subject_id: SUBJECT, term_id: TERM,
          deleted_at: scenario === 'TA-tombstone' ? '2026-08-01T00:00:00Z' : null }];
      }
      if (scenario === 'unknown') throw new Error('TEST network unavailable');
      if (id === TB.id) {
        if (scenario === 'TB-tombstone') return [{ ...rows[0], deleted_at: '2026-08-01T00:00:00Z' }];
        if (scenario === 'TB-absent') return [];
        if (scenario === 'TB-key-changed') return [{ ...rows[0], subject_id: 'subject:changed' }];
        if (scenario === 'wrong-owner') return [{ ...rows[0], owner_id: '22222222-2222-4222-8222-222222222222' }];
        if (scenario === 'auth-race') cloud.setMockAuth({ id: OWNER }, { access_token: 'TEST-new-session' });
      }
      return rows;
    };
    if (scenario === 'missing-auth') cloud.setMockAuth({ id: OWNER }, {});
    const before = await disk();
    const timer = t.mock.method(globalThis, 'setTimeout');
    assert.equal(await sync.syncAll({ full: false }), false);
    const code = scenario.startsWith('TA-') ? 'TEACHING_IDENTITY_AMBIGUOUS_REMOTE_DUPLICATES'
      : ['unknown', 'missing-auth', 'wrong-owner', 'auth-race'].includes(scenario) ? 'TEACHING_IDENTITY_PRESENCE_UNKNOWN'
      : 'TEACHING_IDENTITY_CONFLICT_REQUIRES_RESOLUTION';
    assert.equal(sync.state.results.structural.code, code);
    assert.equal(sync.state.results.structural.retryable, false);
    assert.deepEqual(await disk(), before); assert.deepEqual(calls.upload, []);
    assert.equal(timer.mock.calls.some(call => call.arguments[1] === 900), false);
  });
}

test('meaningful peer-tab write during exact cloud lookup is rechecked inside the atomic adoption transaction', async () => {
  const f = await fresh({ adopted: true });
  const original = backend.fetchTeachingPresence;
  backend.fetchTeachingPresence = async id => {
    if (id === TB.id) await db.put('notes', { id: 'note:concurrent', teachingId: f.ta.id, text: 'TEST peer work' });
    return original(id);
  };
  assert.equal(await sync.syncAll({ full: false }), false);
  assert.equal(sync.state.results.structural.recovery.reason, 'linked-data:notes');
  assert.ok(await db.get('teachings', f.ta.id));
  assert.equal((await db.getAll('items')).length, 5);
  assert.equal((await db.get('notes', 'note:concurrent')).text, 'TEST peer work');
  assert.deepEqual(calls.upload, []);
});

test('offline attempt preserves creation proof and succeeds after connectivity returns', async t => {
  const f = await fresh();
  const before = await disk();
  const prior = Object.getOwnPropertyDescriptor(navigator, 'onLine');
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
  t.after(() => { if (prior) Object.defineProperty(navigator, 'onLine', prior); else delete navigator.onLine; });
  assert.equal(await sync.syncAll({ full: false }), false);
  assert.equal(sync.state.status, 'offline'); assert.deepEqual(await disk(), before);
  assert.deepEqual(calls.exact, []);
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  assert.equal(await sync.syncAll({ full: false }), true);
  assert.equal(await db.get('teachings', f.ta.id), undefined);
  assert.deepEqual(await db.getAll('outbox'), []);
});
