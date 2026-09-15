import test, { before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { normalizeSectionLabel, normalizeSearchText } from '../src/models.js';

const OWNER = '11111111-1111-4111-8111-111111111111';
const STAMP = 1700000000000;
const migration = await readFile(new URL('../supabase/migrations/0007_sections_active_normalized_identity.sql', import.meta.url), 'utf8');
const core = await readFile(new URL('../supabase/migrations/0001_core_schema.sql', import.meta.url), 'utf8');
const sectionDDL = core.match(/create table rakeezx\.sections \([\s\S]*?\n\);/)[0];
let pg;

before(async () => {
  pg = new PGlite();
  await pg.exec(`create schema auth; create table auth.users (id uuid primary key);
    insert into auth.users values ('${OWNER}');
    create function auth.uid() returns uuid language sql immutable as $$select '${OWNER}'::uuid$$;`);
});

beforeEach(async () => {
  await pg.exec(`drop schema if exists rakeezx cascade; create schema rakeezx;
    create table rakeezx.years (owner_id uuid, id text, primary key(owner_id,id));
    insert into rakeezx.years values ('${OWNER}', 'year:test'); ${sectionDDL}`);
});

after(async () => { await pg.close(); });

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

test('JS/SQL parity covers whitespace, digit sets, Alef variants, null and deliberately distinct letters', async () => {
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

test('active/tombstone raw-identical pair is permitted after replacement', async () => {
  await insert('sec:old', '1', true);
  await assert.rejects(insert('sec:new', '1'), { code: '23505' });
  await pg.exec(migration);
  await insert('sec:new', '1');
  assert.equal((await rows()).length, 2);
});

test('active Alef plus differently-spelled tombstone migrates without rewriting either row', async () => {
  await insert('sec:active', 'أ');
  await insert('sec:deleted', 'ا', true);
  const beforeRows = await rows();
  await pg.exec(migration);
  assert.deepEqual(await rows(), beforeRows);
});

for (const labels of [['أ','ا'], ['١','1']]) {
  test(`active normalized duplicates ${labels.join('/')} roll back function/index changes and retain old protection`, async () => {
    await insert('sec:A', labels[0]); await insert('sec:B', labels[1]);
    const beforeRows = await rows();
    await assert.rejects(pg.exec(migration), { code: '23505' });
    await pg.exec('rollback');
    assert.equal(await oldConstraint(), 1);
    assert.deepEqual(await rows(), beforeRows);
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
