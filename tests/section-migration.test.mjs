import test, { before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import 'fake-indexeddb/auto';
import { normalizeSectionLabel, normalizeSearchText, makeSection, makeTeaching } from '../src/models.js';
import * as store from '../src/store.js';
import * as db from '../src/lib/db.js';
import * as cloud from '../src/lib/cloud.js';
import * as sync from '../src/lib/sync.js';

globalThis.document = { documentElement: { setAttribute() {}, removeAttribute() {} }, querySelector: () => null };
globalThis.matchMedia = () => ({ matches: false });
const OWNER = '11111111-1111-4111-8111-111111111111';
const STAMP = 1700000000000;
const migration = await readFile(new URL('../supabase/migrations/0007_sections_active_normalized_identity.sql', import.meta.url), 'utf8');
const core = await readFile(new URL('../supabase/migrations/0001_core_schema.sql', import.meta.url), 'utf8');
const sectionDDL = core.match(/create table rakeezx\.sections \([\s\S]*?\n\);/)[0];
let pg;
before(async () => {
  pg = new PGlite(); // Ephemeral WASM PostgreSQL only. No connection string/live DB.
  await pg.exec(`create schema auth; create table auth.users (id uuid primary key);
    insert into auth.users values ('${OWNER}');
    create function auth.uid() returns uuid language sql immutable as $$select '${OWNER}'::uuid$$;`);
});
beforeEach(async () => {
  // This schema exists ONLY inside this test's in-memory PGlite instance.
  await pg.exec(`drop schema if exists rakeezx cascade; create schema rakeezx;
    create table rakeezx.years (owner_id uuid, id text, primary key(owner_id,id));
    insert into rakeezx.years values ('${OWNER}', 'year:test'); ${sectionDDL}`);
});
after(async () => { cloud.setMockBackend(null); cloud.setMockAuth(null, null); store.closeChannel(); db.closeDB(); await pg.close(); });

async function insert(id, label, deleted = false, grade = 4) {
  await pg.query(`insert into rakeezx.sections(id,owner_id,year_id,grade,label,name,client_updated_at,deleted_at)
    values ($1,$2,'year:test',$3,$4,'TEST section',$5,$6)`, [id, OWNER, grade, label, STAMP, deleted ? '2026-08-01T00:00:00Z' : null]);
}
const rows = async () => (await pg.query('select * from rakeezx.sections order by id')).rows;
const oldConstraint = async () => (await pg.query("select 1 from pg_constraint where conname='sections_natural_uniq'")).rows.length;

test('migration creates the active index before dropping the old constraint, inside one transaction', async () => {
  assert.match(migration, /^begin;/i);
  assert.ok(migration.indexOf('create unique index') < migration.indexOf('alter table rakeezx.sections drop constraint'));
  assert.match(migration, /commit;\s*$/i);
  await pg.exec(migration);
  assert.equal(await oldConstraint(), 0);
  const index = (await pg.query("select indexdef from pg_indexes where indexname='sections_active_normalized_natural_uniq'")).rows[0];
  assert.match(index.indexdef, /WHERE \(deleted_at IS NULL\)/);
  assert.equal((await pg.query("select provolatile from pg_proc where proname='normalize_section_label'")).rows[0].provolatile, 'i');
});

test('JS/SQL parity covers all ECMAScript whitespace, digit sets, Alef variants, null and deliberately distinct letters', async () => {
  await pg.exec(migration);
  const whitespace = [9,10,11,12,13,32,160,5760,...Array.from({ length:11 },(_,i)=>8192+i),8232,8233,8239,8287,12288,65279];
  const fixtures = [null, '', '  أ   إ آ ٱ ا ', '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹', 'ة ه ى ي', '\u0085أ\u0085', '\u180eأ\u180e', '\u200bأ\u200b',
    ...whitespace.map((code) => `${String.fromCodePoint(code)}أ${String.fromCodePoint(code).repeat(3)}١${String.fromCodePoint(code)}`)];
  for (const label of fixtures) {
    const normalized = (await pg.query('select rakeezx.normalize_section_label($1) as value', [label])).rows[0].value;
    assert.equal(normalized, normalizeSectionLabel(label), JSON.stringify(label));
  }
  for (const [query, name] of [['احمد','أحمد'],['ابراهيم','إبراهيم'],['ادم','آدم'],['١','1']]) assert.equal(normalizeSearchText(query), normalizeSearchText(name));
  assert.notEqual(normalizeSectionLabel('ة'), normalizeSectionLabel('ه'));
  assert.notEqual(normalizeSectionLabel('ى'), normalizeSectionLabel('ي'));
});

test('active/tombstone raw-identical pair is permitted after replacement (impossible to seed under the old raw constraint)', async () => {
  await insert('sec:old', '1', true);
  await assert.rejects(insert('sec:new', '1'), { code: '23505' });
  await pg.exec(migration);
  await insert('sec:new', '1');
  assert.equal((await rows()).length, 2);
});

test('active Alef plus differently-spelled tombstone migrates without rewriting either row', async () => {
  await insert('sec:active', 'أ');
  await insert('sec:deleted', 'ا', true);
  const before = await rows();
  await pg.exec(migration);
  assert.deepEqual(await rows(), before);
});

for (const labels of [['أ','ا'], ['١','1']]) {
  test(`active normalized duplicates ${labels.join('/')} roll back function/index changes and retain old protection`, async () => {
    await insert('sec:A', labels[0]); await insert('sec:B', labels[1]);
    const before = await rows();
    await assert.rejects(pg.exec(migration), { code: '23505' });
    await pg.exec('rollback');
    assert.equal(await oldConstraint(), 1);
    assert.deepEqual(await rows(), before);
    assert.equal((await pg.query("select 1 from pg_indexes where indexname='sections_active_normalized_natural_uniq'")).rows.length, 0);
    assert.equal((await pg.query("select 1 from pg_proc where proname='normalize_section_label'")).rows.length, 0);
    await assert.rejects(insert('sec:duplicate', labels[0]), { code: '23505' });
  });
}

test('new index enforces active normalization and allows distinct grades/letters plus delete/recreate with a fresh ID', async () => {
  await pg.exec(migration);
  await insert('sec:old', '١');
  await assert.rejects(insert('sec:blocked', '1'), { code: '23505' });
  await insert('sec:other-grade', '1', false, 5);
  await insert('sec:ta', 'ة'); await insert('sec:ha', 'ه');
  await insert('sec:maqsura', 'ى'); await insert('sec:ya', 'ي');
  await pg.query("update rakeezx.sections set deleted_at=now() where id='sec:old'");
  await insert('sec:new', '1');
  const result = await rows();
  assert.ok(result.find((row) => row.id === 'sec:old').deleted_at);
  assert.equal(result.find((row) => row.id === 'sec:new').deleted_at, null);
});

async function seedDevice(label, id) {
  await db.clearAll();
  for (const name of Object.keys(store.state)) if (Array.isArray(store.state[name])) store.state[name] = [];
  store.state.profile = null; store.state.device = null;
  await store.patchDevice({ deviceId: 'test-device', activeYearId: 'year:test' });
  await store.save({ years: [{ id: 'year:test', label: 'TEST year', updatedAt: STAMP }] }, { queue: false });
  await store.save({ sections: [makeSection({ id, yearId: 'year:test', grade:4, label, updatedAt: STAMP })] });
  sync.state.status = 'idle'; sync.state.results = {};
}
function sqlBackend() {
  return {
    async fetchRecords(table) {
      if (table === 'sections') return (await pg.query('select * from rakeezx.sections where owner_id=$1', [OWNER])).rows;
      if (table === 'years') return [{ id:'year:test', owner_id:OWNER, label:'TEST year', client_updated_at:STAMP }];
      return [];
    },
    async upsertRecords(table, records) {
      assert.equal(table, 'sections');
      for (const rec of records) {
        await pg.query(`insert into rakeezx.sections(id,owner_id,year_id,grade,label,name,color,"order",client_updated_at,deleted_at)
          values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) on conflict(owner_id,id) do update set label=excluded.label,deleted_at=excluded.deleted_at`,
        [rec.id,OWNER,rec.year_id,rec.grade,rec.label,rec.name,rec.color,rec.order,rec.client_updated_at,rec.deleted_at]);
      }
    },
  };
}

test('actual migrated SQL permits tombstone-only recreation through sync; no adoption/resurrection/outbox loop', async (t) => {
  t.mock.method(console, 'log', () => {});
  await insert('sec:tombstone', '2', true);
  await pg.exec(migration);
  cloud.setMockBackend(sqlBackend()); cloud.setMockAuth({ id:OWNER }, {});
  await seedDevice('2', 'sec:new');
  assert.equal(await sync.syncAll({ full:false }), true);
  assert.equal(sync.state.results.structural.status, 'success');
  assert.equal((await rows()).length, 2);
  assert.equal((await db.get('sections','sec:tombstone')).deleted, true);
  assert.equal((await db.get('sections','sec:new')).deleted, false);
  assert.deepEqual(await db.getAll('outbox'), []);
  assert.equal((await sync.syncStructural()).sections.pushed, 0);
});

test('two independent local section identities converge to one migrated SQL identity with clean outboxes', async (t) => {
  t.mock.method(console, 'log', () => {});
  await pg.exec(migration);
  cloud.setMockBackend(sqlBackend()); cloud.setMockAuth({ id:OWNER }, {});
  await seedDevice('١', 'sec:device-A');
  assert.equal(await sync.syncAll({ full:false }), true);
  await seedDevice('1', 'sec:device-B');
  assert.equal(await sync.syncAll({ full:false }), true);
  assert.equal(await db.get('sections','sec:device-B'), undefined);
  assert.ok(await db.get('sections','sec:device-A'));
  assert.equal((await rows()).length, 1);
  assert.deepEqual(await db.getAll('outbox'), []);
});

test('characterize unresolved safety boundary: independently created duplicate teachings cannot be silently merged by section-only adoption', async (t) => {
  // This is a BLOCKER characterization, not a successful end-to-end class sync.
  // D1 permits proven pristine creation only; this legacy/no-receipt fixture
  // remains blocked, now before SQL upload rather than at the unique constraint.
  t.mock.method(console, 'log', () => {});
  t.mock.method(console, 'warn', () => {});
  await pg.exec(migration);
  await pg.exec(`create table rakeezx.subjects(owner_id uuid,id text,primary key(owner_id,id));
    create table rakeezx.terms(owner_id uuid,id text,primary key(owner_id,id));
    insert into rakeezx.subjects values ('${OWNER}','subject:test');
    insert into rakeezx.terms values ('${OWNER}','term:test');
    ${core.match(/create table rakeezx\.teachings \([\s\S]*?\n\);/)[0]}`);
  await insert('sec:cloud', '1');
  const remoteTeaching=makeTeaching({sectionId:'sec:cloud',subjectId:'subject:test',termId:'term:test',updatedAt:STAMP});
  await pg.query(`insert into rakeezx.teachings(id,owner_id,section_id,subject_id,term_id,client_updated_at)
    values($1,$2,'sec:cloud','subject:test','term:test',$3)`,[remoteTeaching.id,OWNER,STAMP]);
  const backend=sqlBackend();
  const originalFetch=backend.fetchRecords;
  const originalUpsert=backend.upsertRecords;
  const failures=[];
  backend.fetchRecords=async(table)=>{
    if(table==='teachings') return (await pg.query('select * from rakeezx.teachings where owner_id=$1',[OWNER])).rows;
    if(table==='terms') return [{id:'term:test',owner_id:OWNER,year_id:'year:test',name:'TEST term',index:1,client_updated_at:STAMP}];
    if(table==='subjects') return [{id:'subject:test',owner_id:OWNER,name:'TEST subject',client_updated_at:STAMP}];
    return originalFetch(table);
  };
  backend.upsertRecords=async(table,records)=>{
    if(table!=='teachings') return originalUpsert(table,records);
    for(const record of records) {
      try {
        await pg.query(`insert into rakeezx.teachings(id,owner_id,section_id,subject_id,term_id,client_updated_at)
          values($1,$2,$3,$4,$5,$6) on conflict(owner_id,id) do update set section_id=excluded.section_id`,
        [record.id,OWNER,record.section_id,record.subject_id,record.term_id,record.client_updated_at]);
      } catch(error) { failures.push({code:error.code,constraint:error.constraint}); throw error; }
    }
  };
  backend.fetchTeachingPresence=async(id)=>(await pg.query('select * from rakeezx.teachings where owner_id=$1 and id=$2 limit 1',[OWNER,id])).rows;
  cloud.setMockBackend(backend); cloud.setMockAuth({id:OWNER},{access_token:'TEST'});
  await seedDevice('١','sec:local');
  const localTeaching=makeTeaching({sectionId:'sec:local',subjectId:'subject:test',termId:'term:test',updatedAt:STAMP});
  await store.save({teachings:[localTeaching]});
  assert.equal(await sync.syncAll({full:false}),false,'Unresolved class-level convergence must not be reported as success');
  assert.deepEqual(failures,[]);
  assert.equal(sync.state.results.structural.code,'TEACHING_IDENTITY_CONFLICT_REQUIRES_RESOLUTION');
  assert.equal(sync.state.results.structural.recovery.reason,'creation-proof-missing');
  assert.equal((await db.get('teachings',localTeaching.id)).sectionId,'sec:cloud');
  assert.equal((await db.get('teachings',localTeaching.id)).id,localTeaching.id);
  assert.equal((await pg.query('select id from rakeezx.teachings')).rows[0].id,remoteTeaching.id);
  assert.ok((await db.getAll('outbox')).some(entry=>entry.recordId===localTeaching.id));
});
