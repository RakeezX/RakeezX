import 'fake-indexeddb/auto';
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

import * as db from '../src/lib/db.js';
import * as store from '../src/store.js';
import { createSyncV2Engine } from '../src/lib/sync-v2.js';
import {
  defaultItemsFor, makeClassRule, makeEnrollment, makeSection, makeSession, makeSlot, makeStudent,
  makeSubject, makeTeaching, makeTerm, makeYear, shiftDate, todayISO, weekday,
} from '../src/models.js';

global.document = { documentElement: { setAttribute() {}, removeAttribute() {}, classList: { add() {}, remove() {} } }, querySelector: () => ({ setAttribute() {} }) };
global.matchMedia = () => ({ matches: false });

const authoritative = (record, revision = 1) => ({ ...record, canonicalId: record.id, serverRevision: revision });

async function resetLocal() {
  await db.clearAll();
  store.state.ready = false;
  await store.init();
  await db.clearStore('outbox');
}

async function localFixture(suffix = 'archive') {
  const today = todayISO();
  const year = authoritative(makeYear({ id: `year:${suffix}`, hijriStart: 1470 }));
  const term = authoritative(makeTerm({ id: `term:${suffix}`, yearId: year.id, index: 1,
    startDate: shiftDate(today, -2), endDate: shiftDate(today, 2), status: 'active' }));
  const subject = authoritative(makeSubject({ id: `subject:${suffix}`, name: `مادة ${suffix}`, slug: `subject-${suffix}` }));
  const section = authoritative(makeSection({ id: `section:${suffix}`, yearId: year.id, grade: 5, label: suffix }));
  const teaching = authoritative(makeTeaching({ id: `teaching:${suffix}`, sectionId: section.id, subjectId: subject.id, termId: term.id }));
  const items = defaultItemsFor(teaching.id).map((item) => authoritative(item));
  await store.save({ years: [year], terms: [term], subjects: [subject], sections: [section], teachings: [teaching], items }, { queue: false });
  await store.patchDevice({ activeYearId: year.id, activeTermId: term.id }, { queue: false });
  return { today, year, term, subject, section, teaching, items };
}

test('SECTION-ARCHIVE local lifecycle preserves evidence and excludes operational work', async () => {
  await resetLocal();
  const f = await localFixture('retained');
  const student = authoritative(makeStudent({ id: 'student:retained', name: 'طالب محفوظ' }));
  const enrollment = authoritative(makeEnrollment({ id: 'enrollment:retained', studentId: student.id, sectionId: f.section.id, rollNo: 1 }));
  const slot = authoritative(makeSlot({ id: 'slot:retained', teachingId: f.teaching.id, weekday: weekday(f.today), period: 1 }));
  const session = authoritative(makeSession({ id: 'session:retained', teachingId: f.teaching.id, slotId: slot.id,
    date: shiftDate(f.today, -1), period: 1, status: 'held' }));
  const score = authoritative({ id: 'score:retained', studentId: student.id, itemId: f.items[1].id, value: 8, deleted: false, updatedAt: 1 });
  const note = authoritative({ id: 'note:retained', studentId: student.id, teachingId: f.teaching.id, sessionId: session.id,
    text: 'ملاحظة محفوظة', date: session.date, kind: 'teacher', deleted: false, updatedAt: 1 });
  const log = authoritative({ id: 'log:retained', studentId: student.id, teachingId: f.teaching.id, sessionId: session.id,
    date: session.date, kind: 'participation', delta: 1, tag: '', note: '', deleted: false, updatedAt: 1 });
  const attendance = authoritative({ id: 'attendance:retained', studentId: student.id, sessionId: session.id,
    teachingId: f.teaching.id, date: session.date, status: 'present', note: '', deleted: false, updatedAt: 1 });
  const snapshot = authoritative({ id: 'snapshot:retained', sessionId: session.id, teachingId: f.teaching.id,
    sectionId: f.section.id, capturedAt: 1, state: 'complete', members: [{ studentId: student.id, rollNo: 1 }], deleted: false, updatedAt: 1 });
  const classRule = authoritative(makeClassRule({ id: 'rule:retained', teachingId: f.teaching.id,
    iconKey: 'shield', text: 'نحافظ على السجل', createdAt: 1, updatedAt: 1 }));
  const destination = authoritative(makeSection({ id: 'section:destination', yearId: f.year.id, grade: 6, label: 'د' }));
  await store.save({ students: [student], sections: [destination], enrollments: [enrollment], slots: [slot], sessions: [session],
    sessionRosterSnapshots: [snapshot], attendance: [attendance], scores: [score], notes: [note], logs: [log], classRules: [classRule] }, { queue: false });

  const before = Object.fromEntries(['teachings','students','enrollments','items','scores','slots','sessions','sessionRosterSnapshots','attendance','notes','logs','classRules']
    .map((name) => [name, structuredClone(store.state[name])]));
  const archived = await store.archiveSection(f.section.id, f.today);
  assert.equal(archived.status, 'archived');
  assert.equal(archived.archiveDate, f.today);
  assert.ok(archived.archivedAt);
  for (const [name, rows] of Object.entries(before)) assert.deepEqual(store.state[name], rows, `${name} changed during archive`);
  assert.equal(store.sections(f.year.id).some((row) => row.id === f.section.id), false);
  assert.equal(store.teachings(f.term.id).some((row) => row.id === f.teaching.id), false);
  assert.equal(store.sessionsOn(session.date).some((row) => row.id === session.id), false);
  assert.equal(store.sessionsOf(f.teaching.id).some((row) => row.id === session.id), true);
  assert.equal(store.executionReport({ yearId: f.year.id, termId: f.term.id }).teachings.length, 0);
  assert.deepEqual(await store.ensureSessionsForDate(f.today), { created: 0, existing: 0, skipped: 0 });
  await assert.rejects(store.setScore(student.id, f.items[1].id, 9), /الفصل مؤرشف/);
  await assert.rejects(store.addLog({ teachingId: f.teaching.id, studentId: student.id, kind: 'participation', delta: 1 }), /الفصل مؤرشف/);
  assert.equal(await store.transferStudent(student.id, destination.id), null);
  await assert.rejects(store.withdrawStudent(student.id), /الفصل مؤرشف/);
  await assert.rejects(store.patch('sections', f.section.id, { status: 'active', archivedAt: null, archiveDate: null }), /أمر دورة الحياة/);
  await assert.rejects(store.deleteClass(f.section.id), { code: 'N77_CLIENT_UPDATE_REQUIRED' });
  assert.equal((await db.getAll('outbox')).some((row) => row.command === 'lifecycle:archive_class'), true);
});

test('P0 blocks legacy pristine and retained shell Delete before local mutation', async () => {
  await resetLocal();
  const pristine = await localFixture('pristine');
  assert.deepEqual(store.sectionDeleteEvidence(pristine.section.id), []);
  const before = await Promise.all(db.STORES.map((name) => db.getAll(name)));
  await assert.rejects(store.deleteClass(pristine.section.id), { code: 'N77_CLIENT_UPDATE_REQUIRED' });
  assert.deepEqual(await Promise.all(db.STORES.map((name) => db.getAll(name))), before);
  assert.equal(store.getSection(pristine.section.id).id, pristine.section.id);

  await resetLocal();
  const retained = await localFixture('guarded');
  await store.save({ slots: [makeSlot({ id: 'slot:guarded', teachingId: retained.teaching.id, weekday: 0, period: 1 })] }, { queue: false });
  await assert.rejects(store.deleteTeaching(retained.teaching.id), { code: 'N77_CLIENT_UPDATE_REQUIRED' });
  await assert.rejects(store.deleteClass(retained.section.id), { code: 'N77_CLIENT_UPDATE_REQUIRED' });
});

test('validated reopen remains archived offline, rejects conflicts, then adopts server authority', async () => {
  await resetLocal();
  const safe = await localFixture('reopen');
  await store.archiveSection(safe.section.id, safe.today);
  const commands = [];
  const engine = createSyncV2Engine({ database: db, transport: {
    async applySectionLifecycleCommand(envelope) {
      commands.push(envelope);
      const active = envelope.command === 'reopen_class';
      return { mutationId: envelope.mutationId, outcome: active ? 'reopened' : 'archived', section: {
        id: safe.section.id, year_id: safe.year.id, grade: 5, label: 'reopen', name: safe.section.name,
        color: safe.section.color, order: 0, status: active ? 'active' : 'archived',
        archived_at: active ? null : new Date().toISOString(), archive_date: active ? null : safe.today,
        revision: active ? 3 : 2, field_revisions: { lifecycle: active ? 3 : 2 }, deleted_at: null, client_updated_at: Date.now(),
      } };
    },
  } });
  assert.equal((await engine.dispatchPending()).acknowledged, 1);
  await store.refreshSyncedState();
  assert.equal(store.getSection(safe.section.id).status, 'archived');
  assert.deepEqual(await store.reopenSection(safe.section.id), { ok: true, status: 'pending-server-validation' });
  assert.equal(store.getSection(safe.section.id).status, 'archived');
  assert.equal((await engine.dispatchPending()).acknowledged, 1);
  await store.refreshSyncedState();
  assert.equal(store.getSection(safe.section.id).status, 'active');
  assert.deepEqual(commands.map((row) => row.command), ['archive_class', 'reopen_class']);

  await resetLocal();
  const archived = await localFixture('conflict-a');
  const activeSection = authoritative(makeSection({ id: 'section:conflict-b', yearId: archived.year.id, grade: 6, label: 'ب' }));
  const activeTeaching = authoritative(makeTeaching({ id: 'teaching:conflict-b', sectionId: activeSection.id,
    subjectId: archived.subject.id, termId: archived.term.id }));
  await store.save({ sections: [activeSection], teachings: [activeTeaching], items: defaultItemsFor(activeTeaching.id).map((item) => authoritative(item)) }, { queue: false });
  await store.save({ slots: [
    makeSlot({ id: 'slot:conflict-a', teachingId: archived.teaching.id, weekday: 1, period: 2 }),
    makeSlot({ id: 'slot:conflict-b', teachingId: activeTeaching.id, weekday: 1, period: 2 }),
  ] }, { queue: false });
  await store.archiveSection(archived.section.id, archived.today);
  assert.equal(store.validateSectionReopen(archived.section.id).reason, 'slot-conflict');
  assert.equal((await store.reopenSection(archived.section.id)).ok, false);
});

test('legacy local section records normalize to active without lifecycle outbox work', async () => {
  await db.clearAll();
  await db.put('sections', { id: 'section:legacy', yearId: 'year:legacy', grade: 4, label: 'أ', name: '4/أ', color: '#0f766e', order: 0, deleted: false, updatedAt: 1 });
  store.state.ready = false;
  await store.init();
  const section = store.getSection('section:legacy');
  assert.deepEqual({ status: section.status, archivedAt: section.archivedAt, archiveDate: section.archiveDate },
    { status: 'active', archivedAt: null, archiveDate: null });
  assert.equal((await db.getAll('outbox')).some((row) => row.store === 'sections' && row.recordId === section.id), false);
});

const OWNER = '11111111-1111-4111-8111-111111111111';
const migrationFiles = [
  '0001_core_schema.sql','0002_indexes_triggers_rls.sql','0003_hybrid_calendar.sql','0004_student_notes.sql',
  '0007_sections_active_normalized_identity.sql','0008_enrollment_membership_operations.sql','0009_transfer_and_renumber_rosters.sql',
  '0010_profile_report_principal_name.sql','0011_session_roster_snapshots.sql','0012_sync_v2_server_protocol.sql',
  '0013_sync_v2_enrollment_commands.sql','0014_sync_v2_attendance_snapshot_commands.sql','0015_sync_v2_lifecycle_commands.sql',
  '0016_sync_v2_teaching_creation_commands.sql','0017_sync_v2_bulk_attendance_commands.sql','0018_profile_active_time_profile.sql',
  '0019_class_rules.sql','0020_support_requests.sql','0021_section_archive_lifecycle.sql',
];

test('server authority enforces archive, pristine delete, stale-write rejection, and validated reopen', async () => {
  const pg = new PGlite();
  try {
    await pg.exec(`create schema auth; create role authenticated; create role anon;
      create table auth.users(id uuid primary key); create table auth.current_identity(id uuid not null);
      insert into auth.users values ('${OWNER}'); insert into auth.current_identity values ('${OWNER}');
      create function auth.uid() returns uuid language sql stable security definer set search_path=''
        as $$select id from auth.current_identity limit 1$$;`);
    for (const name of migrationFiles) await pg.exec((await readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8')).replace(/^\uFEFF/, ''));
    const privileges = (await pg.query(`select
      has_function_privilege('authenticated','rakeezx.apply_sync_v2_section_lifecycle_command(text,text,text,text,date,bigint)','execute') authenticated,
      has_function_privilege('anon','rakeezx.apply_sync_v2_section_lifecycle_command(text,text,text,text,date,bigint)','execute') anonymous`)).rows[0];
    assert.equal(privileges.authenticated, true);
    assert.equal(privileges.anonymous, false);
    await pg.query(`insert into rakeezx.years(id,label,hijri_start,hijri_end,status) values('year:archive','سنة',1470,1471,'active')`);
    await pg.query(`insert into rakeezx.terms(id,year_id,name,"index",status) values('term:archive','year:archive','فصل',1,'active')`);
    await pg.query(`insert into rakeezx.subjects(id,name,slug) values('subject:archive','مادة','archive')`);
    const seedSection = async (id, label) => pg.query(`insert into rakeezx.sections(id,year_id,grade,label,name) values($1,'year:archive',5,$2,$2)`, [id,label]);
    const createTeaching = async (suffix, sectionId) => (await pg.query(`select rakeezx.apply_sync_v2_teaching_creation_command($1,'device',$2,$3,'subject:archive','term:archive',0,$4::jsonb,1) result`,
      [`mutation:teaching:${suffix}`,`teaching:${suffix}`,sectionId,JSON.stringify([0,1,2,3,4].map((n)=>`item:${suffix}:${n}`))])).rows[0].result;
    const sectionLifecycle = async (mutation, command, sectionId, date = null) => (await pg.query(
      `select rakeezx.apply_sync_v2_section_lifecycle_command($1,'device',$2,$3,$4::date,2) result`, [mutation,command,sectionId,date])).rows[0].result;
    const lifecycle = async (mutation, command, id) => (await pg.query(
      `select rakeezx.apply_sync_v2_lifecycle_command($1,'device',$2,$3,3) result`, [mutation,command,id])).rows[0].result;

    await seedSection('section:pristine','أ');
    assert.equal((await pg.query(`select status,archived_at,archive_date from rakeezx.sections where id='section:pristine'`)).rows[0].status, 'active');
    await createTeaching('pristine','section:pristine');
    const pristineDelete = await lifecycle('mutation:delete:pristine','delete_class','section:pristine');
    assert.equal(pristineDelete.outcome, 'deleted');
    assert.deepEqual(await lifecycle('mutation:delete:pristine','delete_class','section:pristine'), pristineDelete);
    assert.match((await lifecycle('mutation:delete:pristine:stale','delete_class','section:pristine')).outcome, /deleted/);

    await seedSection('section:retained','ب');
    await createTeaching('retained','section:retained');
    await pg.query(`insert into rakeezx.sessions(id,teaching_id,date,period) values('session:retained','teaching:retained','2026-09-09',1)`);
    const archived = await sectionLifecycle('mutation:archive','archive_class','section:retained','2026-09-09');
    assert.equal(archived.outcome, 'archived');
    assert.equal((await pg.query(`select count(*)::int n from rakeezx.sessions where id='session:retained' and deleted_at is null`)).rows[0].n, 1);
    await assert.rejects(pg.query(`select rakeezx.apply_sync_v2_mutation('sections','section:retained','mutation:stale-section','stale-device',2,'{"name":"stale"}'::jsonb,'patch',4)`), /Archived section is read-only/);
    await assert.rejects(pg.query(`select rakeezx.apply_sync_v2_mutation('sessions','session:retained','mutation:stale','stale-device',1,'{"note":"stale"}'::jsonb,'patch',4)`), /Archived section is read-only/);
    await assert.rejects(lifecycle('mutation:delete:retained','delete_class','section:retained'), /Retained records require archive/);

    const reopened = await sectionLifecycle('mutation:reopen','reopen_class','section:retained');
    assert.equal(reopened.outcome, 'reopened');
    assert.equal(reopened.section.status, 'active');

    await pg.query(`insert into rakeezx.slots(id,teaching_id,weekday,period) values
      ('slot:retained','teaching:retained',1,2)`);
    await sectionLifecycle('mutation:archive:again','archive_class','section:retained','2026-09-09');
    await assert.rejects(pg.query(`insert into rakeezx.sessions(id,teaching_id,date,period) values
      ('session:stale-new','teaching:retained','2026-09-10',2)`), /Archived section is read-only/);
    await seedSection('section:other','ج');
    await createTeaching('other','section:other');
    await assert.rejects(pg.query(`update rakeezx.teachings set section_id='section:other' where id='teaching:retained'`), /Archived section is read-only/);
    await pg.query(`insert into rakeezx.slots(id,teaching_id,weekday,period) values
      ('slot:other','teaching:other',1,2)`);
    const rejected = await sectionLifecycle('mutation:reopen:conflict','reopen_class','section:retained');
    assert.equal(rejected.outcome, 'rejected_slot_conflict');
    assert.equal(rejected.section.status, 'archived');
  } finally {
    await pg.close();
  }
});

after(async () => {
  store.closeChannel();
  await db.closeDB();
});
