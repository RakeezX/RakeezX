import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

global.document = { documentElement: { setAttribute() {}, removeAttribute() {}, classList: { add() {}, remove() {} } }, querySelector: () => ({ setAttribute() {} }) };
global.matchMedia = () => ({ matches: false });

import * as db from '../src/lib/db.js';
import * as store from '../src/store.js';
import { SYNC_V2_SCHEMAS, decodeSyncV2Canonical, encodeSyncV2Patch } from '../src/lib/sync-v2.js';

const OWNER = '11111111-1111-4111-8111-111111111111';
const migrationFiles = [
  '0001_core_schema.sql', '0002_indexes_triggers_rls.sql', '0003_hybrid_calendar.sql', '0004_student_notes.sql',
  '0007_sections_active_normalized_identity.sql', '0008_enrollment_membership_operations.sql',
  '0009_transfer_and_renumber_rosters.sql', '0010_profile_report_principal_name.sql',
  '0011_session_roster_snapshots.sql', '0012_sync_v2_server_protocol.sql',
  '0013_sync_v2_enrollment_commands.sql', '0014_sync_v2_attendance_snapshot_commands.sql',
  '0015_sync_v2_lifecycle_commands.sql', '0016_sync_v2_teaching_creation_commands.sql',
  '0017_sync_v2_bulk_attendance_commands.sql', '0018_profile_active_time_profile.sql', '0019_class_rules.sql',
];
const migrations = await Promise.all(migrationFiles.map((name) =>
  readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8')));
let pg;

before(async () => {
  pg = new PGlite();
  await pg.exec(`
    create schema auth;
    create role authenticated;
    create role anon;
    create table auth.users(id uuid primary key);
    create table auth.current_identity(id uuid not null);
    insert into auth.users values ('${OWNER}');
    insert into auth.current_identity values ('${OWNER}');
    create function auth.uid() returns uuid language sql stable security definer set search_path = ''
      as $$select id from auth.current_identity limit 1$$;
  `);
  for (const migration of migrations) await pg.exec(migration.replace(/^\uFEFF/, ''));
});

test.after(() => {
  store.closeChannel();
  db.closeDB();
});
after(async () => { await pg.close(); });

async function fresh() {
  await db.clearAll();
  await store.init();
}

async function teachingFixture() {
  const section = await store.createSection({ grade: 5, label: 'ق', name: 'فصل القوانين' });
  const teaching = await store.createTeaching({ sectionId: section.id });
  return { section, teaching };
}

test('class rules validate, persist offline, queue generic V2 mutations, and preserve creation order', async () => {
  await fresh();
  const { teaching } = await teachingFixture();

  assert.equal(await store.addClassRule({ teachingId: teaching.id, iconKey: 'star', text: '   ' }), null);
  assert.equal(await store.addClassRule({ teachingId: teaching.id, iconKey: 'غير-مفتاح', text: 'قاعدة' }), null);

  const first = await store.addClassRule({ teachingId: teaching.id, iconKey: 'star', text: '  نبدأ بهدوء  ', createdAt: 10 });
  const second = await store.addClassRule({ teachingId: teaching.id, iconKey: 'check', text: 'نحترم الجميع', createdAt: 20 });
  assert.ok(first && second);
  assert.deepEqual(store.classRulesOf(teaching.id).map((rule) => rule.id), [first.id, second.id]);
  assert.equal(first.text, 'نبدأ بهدوء');

  const queued = await db.getAll('outbox');
  const creates = queued.filter((entry) => entry.store === 'classRules');
  assert.equal(creates.length, 2);
  assert.equal(creates.every((entry) => entry.protocol === 'v2' && entry.op === 'create'), true);
  assert.equal(creates[0].patch.teaching_id, teaching.id);

  await store.editClassRule(first.id, { iconKey: 'book-open', text: 'نستمع باحترام' });
  assert.equal(store.classRulesOf(teaching.id)[0].iconKey, 'book-open');
  assert.equal(store.classRulesOf(teaching.id)[0].text, 'نستمع باحترام');
  assert.equal(await store.editClassRule(first.id, { text: 'x'.repeat(241) }), null);
});

test('class-rule evidence is preserved by archive and blocks destructive teaching/class deletion', async () => {
  await fresh();
  const { section, teaching } = await teachingFixture();
  const rule = await store.addClassRule({ teachingId: teaching.id, iconKey: 'shield', text: 'نحافظ على الأدوات' });
  assert.ok(rule);

  await assert.rejects(store.deleteTeaching(teaching.id), /بيانات محفوظة/);
  await assert.rejects(store.deleteClass(section.id), /استخدم الأرشفة/);
  await store.archiveSection(section.id);
  assert.equal(store.state.classRules.find((item) => item.id === rule.id)?.deleted, false);
  assert.equal(store.classRulesOf(teaching.id).length, 1);

  await fresh();
  const nextSection = await store.createSection({ grade: 6, label: 'م', name: 'فصل آخر' });
  const subject = await store.createSubject({ name: 'المهارات' });
  const nextTeaching = await store.createTeaching({ sectionId: nextSection.id, subjectId: subject.id });
  const nextRule = await store.addClassRule({ teachingId: nextTeaching.id, iconKey: 'users', text: 'نتعاون' });
  await assert.rejects(store.deleteClass(nextSection.id), /استخدم الأرشفة/);
  assert.equal(store.state.classRules.find((item) => item.id === nextRule.id)?.deleted, false);
});

test('class rules have a constrained generic V2 wire shape and retain server creation time on bootstrap', () => {
  assert.deepEqual(SYNC_V2_SCHEMAS.classRules, {
    entity: 'class_rules',
    fields: { teachingId: 'teaching_id', iconKey: 'icon_key', text: 'text' },
    references: { teachingId: 'teachings' },
  });
  assert.deepEqual(
    encodeSyncV2Patch('classRules', { teachingId: 'teaching-1', iconKey: 'star', text: 'قاعدة' }),
    { teaching_id: 'teaching-1', icon_key: 'star', text: 'قاعدة' },
  );
  const canonical = decodeSyncV2Canonical('classRules', {
    id: 'rule-1', teaching_id: 'teaching-1', icon_key: 'star', text: 'قاعدة',
    created_at: '2026-09-08T10:00:00.000Z', revision: 3,
    field_revisions: { identity: 1, icon: 2, text: 3 }, deleted_at: null, client_updated_at: 42,
  });
  assert.equal(canonical.createdAt, Date.parse('2026-09-08T10:00:00.000Z'));
  assert.equal(canonical.serverRevision, 3);
});

test('class-rules migration enforces owner-scoped RLS, no anonymous grant, and teaching tombstone cascade', async () => {
  await pg.query(`insert into rakeezx.years(id, label, hijri_start, hijri_end, status, client_updated_at, device_id)
    values ('year:rules', 'سنة القوانين', 1448, 1449, 'active', 1, 'seed')`);
  await pg.query(`insert into rakeezx.terms(id, year_id, name, "index", status, client_updated_at, device_id)
    values ('term:rules', 'year:rules', 'الفصل الأول', 1, 'active', 1, 'seed')`);
  await pg.query(`insert into rakeezx.subjects(id, name, slug, client_updated_at, device_id)
    values ('subject:rules', 'المهارات', 'skills-rules', 1, 'seed')`);
  await pg.query(`insert into rakeezx.sections(id, year_id, grade, label, name, client_updated_at, device_id)
    values ('section:rules', 'year:rules', 5, 'ق', 'فصل القوانين', 1, 'seed')`);
  await pg.query(`insert into rakeezx.teachings(id, section_id, subject_id, term_id, client_updated_at, device_id)
    values ('teaching:rules', 'section:rules', 'subject:rules', 'term:rules', 1, 'seed')`);
  await pg.query(`insert into rakeezx.class_rules(id, teaching_id, icon_key, text, client_updated_at, device_id)
    values ('rule:db', 'teaching:rules', 'shield', 'نحافظ على الأدوات', 1, 'seed')`);
  const inserted = (await pg.query(`select owner_id, revision, field_revisions from rakeezx.class_rules where id = 'rule:db'`)).rows[0];
  assert.equal(inserted.owner_id, OWNER);
  assert.equal(inserted.revision, 1);
  assert.deepEqual(inserted.field_revisions, { icon: 1, identity: 1, text: 1 });

  await pg.query(`update rakeezx.teachings set deleted_at = '2026-09-08T12:00:00Z' where id = 'teaching:rules'`);
  const rule = (await pg.query(`select deleted_at from rakeezx.class_rules where id = 'rule:db'`)).rows[0];
  assert.ok(rule.deleted_at, 'server-side teaching lifecycle must not leave a live rule orphan');
  const table = (await pg.query(`select relrowsecurity, relforcerowsecurity from pg_class where oid = 'rakeezx.class_rules'::regclass`)).rows[0];
  assert.deepEqual(table, { relrowsecurity: true, relforcerowsecurity: true });
  const privileges = (await pg.query(`select
    has_table_privilege('anon', 'rakeezx.class_rules', 'select') as anon_select,
    has_table_privilege('anon', 'rakeezx.class_rules', 'insert') as anon_insert,
    has_table_privilege('authenticated', 'rakeezx.class_rules', 'select') as authenticated_select`)).rows[0];
  assert.deepEqual(privileges, { anon_select: false, anon_insert: false, authenticated_select: true });
});
