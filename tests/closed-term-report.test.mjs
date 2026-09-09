import 'fake-indexeddb/auto';
import test, { after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

import * as db from '../src/lib/db.js';
import * as cloud from '../src/lib/cloud.js';
import * as store from '../src/store.js';
import * as sync from '../src/lib/sync.js';
import { createSyncV2Engine } from '../src/lib/sync-v2.js';
import {
  defaultItemsFor, makeEnrollment, makeSection, makeSession, makeStudent, makeSubject, makeTeaching, makeTerm, makeYear,
} from '../src/models.js';

global.document = { documentElement: { setAttribute() {}, removeAttribute() {}, classList: { add() {}, remove() {} } }, querySelector: () => ({ setAttribute() {} }) };
global.matchMedia = () => ({ matches: false });

const authoritative = (record, revision = 1) => ({ ...record, canonicalId: record.id, serverRevision: revision, fieldRevisions: { all: revision } });

async function resetLocal() {
  cloud.setMockBackend(null);
  cloud.setMockAuth(null, null);
  await db.clearAll();
  store.state.ready = false;
  await store.init();
  await db.clearStore('outbox');
  await store.patch('profile', 'profile', { teacherName: 'معلم اختبار', schoolName: 'مدرسة اختبار', serverRevision: 1 }, null, { queue: false });
}

async function localFixture(suffix = 'closed') {
  const year = authoritative(makeYear({ id: `year:${suffix}`, hijriStart: 1470, label: '1470-1471' }));
  const term = authoritative(makeTerm({ id: `term:${suffix}`, yearId: year.id, index: 1, name: 'الفصل الأول', status: 'active' }));
  const subject = authoritative(makeSubject({ id: `subject:${suffix}`, name: 'رياضيات', slug: `math-${suffix}` }));
  const section = authoritative(makeSection({ id: `section:${suffix}`, yearId: year.id, grade: 5, label: 'أ' }));
  const teaching = authoritative(makeTeaching({ id: `teaching:${suffix}`, sectionId: section.id, subjectId: subject.id, termId: term.id }));
  const student = authoritative(makeStudent({ id: `student:${suffix}`, name: 'طالب محفوظ' }));
  const enrollment = authoritative(makeEnrollment({ id: `enrollment:${suffix}`, studentId: student.id, sectionId: section.id, rollNo: 7 }));
  const items = defaultItemsFor(teaching.id).map((item, index) => authoritative({ ...item, id: `item:${suffix}:${index}` }));
  const session = authoritative(makeSession({ id: `session:${suffix}`, teachingId: teaching.id, date: '2026-09-08', period: 2,
    startTime: '08:00', endTime: '08:45', status: 'held' }));
  const rosterSnapshot = authoritative({ id: `snapshot:${suffix}`, sessionId: session.id, teachingId: teaching.id, sectionId: section.id,
    capturedAt: 1, members: [{ studentId: student.id, rollNo: 7 }], state: 'complete', deleted: false, updatedAt: 1 });
  const attendance = authoritative({ id: `attendance:${suffix}`, studentId: student.id, sessionId: session.id, teachingId: teaching.id,
    date: session.date, status: 'present', note: '', deleted: false, updatedAt: 1 });
  const score = authoritative({ id: `score:${suffix}`, studentId: student.id, itemId: items[1].id, value: 8, deleted: false, updatedAt: 1 });
  const log = authoritative({ id: `log:${suffix}`, studentId: student.id, teachingId: teaching.id, sessionId: session.id,
    date: session.date, kind: 'participation', delta: 2, tag: '', note: '', deleted: false, updatedAt: 1 });
  const note = authoritative({ id: `note:${suffix}`, studentId: student.id, teachingId: teaching.id, sessionId: session.id,
    date: session.date, kind: 'teacher', text: 'ملاحظة ثابتة', deleted: false, updatedAt: 1 });
  await store.save({ years: [year], terms: [term], subjects: [subject], sections: [section], teachings: [teaching], students: [student],
    enrollments: [enrollment], items, sessions: [session], sessionRosterSnapshots: [rosterSnapshot], attendance: [attendance],
    scores: [score], logs: [log], notes: [note] }, { queue: false });
  await store.patchDevice({ activeYearId: year.id, activeTermId: term.id }, { queue: false });
  return { year, term, subject, section, teaching, student, enrollment, items, session, rosterSnapshot, attendance, score, log, note };
}

beforeEach(resetLocal);

test('frozen report payload retains identity, membership, grading inputs/results, sessions, attendance, and notes', async () => {
  const f = await localFixture('facts');
  const manifest = store.closedTermSourceManifest(f.term.id);
  const payload = store.buildClosedTermReportPayload(f.term.id);
  const document = payload.teachingDocuments[0];
  assert.equal(manifest.every((entry) => entry.revision === 1), true);
  assert.deepEqual(manifest.map((entry) => entry.entity).includes('session_roster_snapshots'), true);
  assert.equal(payload.identity.term.status, 'closed');
  assert.equal(document.roster[0].name, 'طالب محفوظ');
  assert.equal(document.roster[0].rollNo, 7);
  assert.equal(document.membership[0].studentId, f.student.id);
  assert.equal(document.items.length, 5);
  assert.equal(document.gradeResults[0].itemResults.find((row) => row.itemId === f.items[1].id).value, 8);
  assert.equal(document.gradeResults[0].itemResults.find((row) => row.itemId === f.items[0].id).value, 2);
  assert.equal(document.attendanceDocument.sessions[0].startTime, '08:00');
  assert.equal(document.attendanceDocument.records[0].records[0].status, 'present');
  assert.equal(document.notes[0].text, 'ملاحظة ثابتة');
  assert.equal(payload.executionDocument.rows[0].session.id, f.session.id);
});

test('complete snapshot is the only closed-term report source and remains stable after live changes', async () => {
  const f = await localFixture('stable');
  const payload = store.buildClosedTermReportPayload(f.term.id);
  const report = authoritative({ id: 'closed-report:stable:1', termId: f.term.id, yearId: f.year.id, version: 1,
    supersedesId: null, sourceManifest: store.closedTermSourceManifest(f.term.id), payload, state: 'complete', createdAt: 1, deleted: false, updatedAt: 1 });
  await store.save({ closedTermReports: [report] }, { queue: false });
  await store.patch('terms', f.term.id, { status: 'closed' }, null, { queue: false });

  await store.patch('students', f.student.id, { name: 'اسم حي متغير' }, null, { queue: false });
  await store.patch('items', f.items[1].id, { name: 'بند حي متغير', max: 99 }, null, { queue: false });
  await store.patch('scores', f.score.id, { value: 1 }, null, { queue: false });
  await store.patch('sessions', f.session.id, { startTime: '12:00' }, null, { queue: false });

  const context = store.teachingContext(f.teaching.id);
  assert.equal(context.roster[0].name, 'طالب محفوظ');
  assert.equal(context.items[1].name, 'الواجبات');
  assert.equal(context.ctx[f.student.id].scoresByItem[f.items[1].id].value, 8);
  assert.equal(store.attendanceReportContext(f.teaching.id).sessions[0].startTime, '08:00');
  assert.equal(store.executionReport({ yearId: f.year.id, termId: f.term.id }).rows[0].session.startTime, '08:00');
  assert.equal(store.closedTermReportState(f.term.id).state, 'complete');
  await assert.rejects(store.patch('closedTermReports', report.id, { version: 2 }), /الأمر الخادمي/);
});

test('legacy closed terms remain explicitly unresolved and are never projected from current data', async () => {
  const f = await localFixture('legacy');
  await store.patch('terms', f.term.id, { status: 'closed' }, null, { queue: false });
  assert.deepEqual(store.closedTermReportState(f.term.id), { state: 'legacy-unresolved', report: null, versions: 0 });
  await assert.rejects(store.patch('terms', f.term.id, { name: 'تغيير' }), /أمر التقارير المخصص/);
});

test('specialized client command reconciles canonical report and term atomically and clears its outbox', async () => {
  const f = await localFixture('client');
  const queued = await store.queueClosedTermReport({ termId: f.term.id });
  const outbox = await db.getAll('outbox');
  assert.equal(outbox.length, 1);
  assert.equal(outbox[0].command, 'term-report:close');
  const engine = createSyncV2Engine({ database: db, transport: {
    async applyClosedTermReportCommand(envelope) {
      assert.equal(envelope.mutationId, queued.mutationId);
      return {
        mutationId: envelope.mutationId, outcome: 'complete',
        report: { id: envelope.reportId, term_id: envelope.termId, year_id: f.year.id, version: 1, supersedes_id: null,
          source_manifest: envelope.sourceManifest, payload: envelope.payload, state: 'complete', created_at: new Date().toISOString(),
          revision: 1, field_revisions: { snapshot: 1 }, deleted_at: null, client_updated_at: Date.now() },
        term: { id: f.term.id, year_id: f.year.id, calendar_id: null, index: 1, name: f.term.name, start_date: null, end_date: null,
          status: 'closed', revision: 2, field_revisions: { status: 2 }, deleted_at: null, client_updated_at: Date.now() },
      };
    },
  } });
  const result = await engine.dispatchPending();
  assert.deepEqual({ acknowledged: result.acknowledged, failed: result.failed, blocked: result.blocked }, { acknowledged: 1, failed: 0, blocked: 0 });
  assert.equal((await db.getAll('outbox')).length, 0);
  assert.equal((await db.get('terms', f.term.id)).status, 'closed');
  assert.equal((await db.get('closedTermReports', queued.reportId)).state, 'complete');
});

test('term closure refuses unresolved Sync V2 work before it queues a report command', async () => {
  const f = await localFixture('blocked');
  cloud.setMockAuth({ access_token: 'test-token' }, { id: 'owner:test' });
  cloud.setMockBackend({ async fetchRecords() { return []; } });
  await db.put('outbox', {
    id: 'v2:rejected', protocol: 'v2', mutationId: 'rejected', deviceId: 'device', store: 'students', entity: 'students',
    recordId: 'missing', serverRecordId: 'missing', canonicalId: 'missing', logicalRecordKey: 'students:missing',
    op: 'patch', baseRevision: 1, patch: { name: 'x' }, localPatch: { name: 'x' }, fields: ['name'], groups: [],
    dependencies: [], sequence: 1, clientUpdatedAt: 1, queuedAt: 1, state: 'rejected', attemptCount: 1,
  });
  await assert.rejects(sync.finalizeClosedTermReport(f.term.id), /المزامنة.*المعلقة/);
  assert.equal((await db.getAll('outbox')).some((row) => String(row.command ?? '').startsWith('term-report:')), false);
  assert.equal(store.closedTermReportState(f.term.id).state, 'open');
  cloud.setMockBackend(null);
  cloud.setMockAuth(null, null);
});

const OWNER_A = '11111111-1111-4111-8111-111111111111';
const OWNER_B = '22222222-2222-4222-8222-222222222222';
const migrationFiles = [
  '0001_core_schema.sql','0002_indexes_triggers_rls.sql','0003_hybrid_calendar.sql','0004_student_notes.sql',
  '0007_sections_active_normalized_identity.sql','0008_enrollment_membership_operations.sql','0009_transfer_and_renumber_rosters.sql',
  '0010_profile_report_principal_name.sql','0011_session_roster_snapshots.sql','0012_sync_v2_server_protocol.sql',
  '0013_sync_v2_enrollment_commands.sql','0014_sync_v2_attendance_snapshot_commands.sql','0015_sync_v2_lifecycle_commands.sql',
  '0016_sync_v2_teaching_creation_commands.sql','0017_sync_v2_bulk_attendance_commands.sql','0018_profile_active_time_profile.sql',
  '0019_class_rules.sql','0020_support_requests.sql','0021_section_archive_lifecycle.sql','0022_closed_term_reports.sql',
];

test('native authority atomically closes, rejects stale sources, replays idempotently, versions corrections, and enforces immutability/RLS grants', async () => {
  const pg = new PGlite();
  try {
    await pg.exec(`create schema auth; create role authenticated; create role anon;
      create table auth.users(id uuid primary key); create table auth.current_identity(id uuid not null);
      insert into auth.users values ('${OWNER_A}'),('${OWNER_B}'); insert into auth.current_identity values ('${OWNER_A}');
      create function auth.uid() returns uuid language sql stable security definer set search_path=''
        as $$select id from auth.current_identity limit 1$$;`);
    for (const name of migrationFiles) await pg.exec((await readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8')).replace(/^\uFEFF/, ''));
    await pg.exec(`
      insert into rakeezx.profile(teacher_name) values('معلم');
      insert into rakeezx.years(id,label,hijri_start,hijri_end,status) values('year:closed','1470',1470,1471,'active');
      insert into rakeezx.terms(id,year_id,name,"index",status) values('term:closed','year:closed','الفصل الأول',1,'active');
      insert into rakeezx.subjects(id,name,slug) values('subject:closed','رياضيات','math-closed');
      insert into rakeezx.sections(id,year_id,grade,label,name) values('section:closed','year:closed',5,'أ','الخامس أ');
      insert into rakeezx.teachings(id,section_id,subject_id,term_id) values('teaching:closed','section:closed','subject:closed','term:closed');
      insert into rakeezx.students(id,name) values('student:closed','طالب محفوظ');
      insert into rakeezx.enrollments(id,student_id,section_id,roll_no,status) values('enrollment:closed','student:closed','section:closed',7,'active');
      insert into rakeezx.items(id,teaching_id,name,max,"order") values('item:closed','teaching:closed','الواجبات',10,1);
      insert into rakeezx.scores(id,student_id,item_id,value) values('score:closed','student:closed','item:closed',8);
      insert into rakeezx.sessions(id,teaching_id,date,period,start_time,end_time,status) values('session:closed','teaching:closed','2026-09-08',2,'08:00','08:45','held');
      select pg_catalog.set_config('rakeezx.sync_v2_attendance_snapshot','on',true);
      insert into rakeezx.session_roster_snapshots(id,session_id,teaching_id,section_id,captured_at,members,state)
        values('snapshot:closed','session:closed','teaching:closed','section:closed',now(),'[{"studentId":"student:closed","rollNo":7}]','complete');
      insert into rakeezx.attendance(id,student_id,session_id,teaching_id,date,status) values('attendance:closed','student:closed','session:closed','teaching:closed','2026-09-08','present');
      insert into rakeezx.logs(id,student_id,teaching_id,session_id,date,kind,delta) values('log:closed','student:closed','teaching:closed','session:closed','2026-09-08','participation',2);
      insert into rakeezx.notes(id,student_id,teaching_id,session_id,date,kind,text) values('note:closed','student:closed','teaching:closed','session:closed','2026-09-08','teacher','ملاحظة');
    `);
    const manifest1 = (await pg.query(`select rakeezx.closed_term_source_manifest($1,'term:closed') manifest`, [OWNER_A])).rows[0].manifest;
    const payload1 = { schemaVersion: 1, identity: { term: { id: 'term:closed' } },
      teachingDocuments: [{ teaching: { id: 'teaching:closed' } }], executionDocument: {} };

    await pg.query(`update rakeezx.items set name='واجبات معدلة' where id='item:closed'`);
    const stale = (await pg.query(`select rakeezx.apply_sync_v2_closed_term_report_command(
      'mutation:stale','device','close','term:closed','report:stale',null,$1::jsonb,$2::jsonb,1) result`,
    [JSON.stringify(manifest1), JSON.stringify(payload1)])).rows[0].result;
    assert.equal(stale.outcome, 'rejected_source_changed');
    assert.equal((await pg.query(`select status from rakeezx.terms where id='term:closed'`)).rows[0].status, 'active');
    assert.equal((await pg.query(`select count(*)::int n from rakeezx.closed_term_reports`)).rows[0].n, 0);

    const manifest2 = (await pg.query(`select rakeezx.closed_term_source_manifest($1,'term:closed') manifest`, [OWNER_A])).rows[0].manifest;
    const close = async () => (await pg.query(`select rakeezx.apply_sync_v2_closed_term_report_command(
      'mutation:close','device','close','term:closed','report:v1',null,$1::jsonb,$2::jsonb,2) result`,
    [JSON.stringify(manifest2), JSON.stringify(payload1)])).rows[0].result;
    const v1 = await close();
    assert.equal(v1.outcome, 'complete');
    assert.deepEqual(await close(), v1);
    assert.equal((await pg.query(`select status from rakeezx.terms where id='term:closed'`)).rows[0].status, 'closed');
    assert.equal((await pg.query(`select count(*)::int n from rakeezx.closed_term_reports`)).rows[0].n, 1);
    assert.equal((await pg.query(`select count(*)::int n from rakeezx.sync_mutation_receipts where mutation_id='mutation:close'`)).rows[0].n, 1);
    await assert.rejects(pg.query(`update rakeezx.closed_term_reports set version=2 where id='report:v1'`), /immutable/);
    await assert.rejects(pg.query(`delete from rakeezx.closed_term_reports where id='report:v1'`), /immutable/);
    await assert.rejects(pg.query(`update rakeezx.terms set name='تغيير غير مسموح' where id='term:closed'`), /Closed term is immutable/);

    await pg.query(`update rakeezx.items set max=11 where id='item:closed'`);
    const manifest3 = (await pg.query(`select rakeezx.closed_term_source_manifest($1,'term:closed') manifest`, [OWNER_A])).rows[0].manifest;
    const payload2 = structuredClone(payload1); payload2.teachingDocuments[0].marker = 'corrected';
    const v2 = (await pg.query(`select rakeezx.apply_sync_v2_closed_term_report_command(
      'mutation:correct','device','correct','term:closed','report:v2','report:v1',$1::jsonb,$2::jsonb,3) result`,
    [JSON.stringify(manifest3), JSON.stringify(payload2)])).rows[0].result;
    assert.equal(v2.report.version, 2);
    assert.equal(v2.report.supersedes_id, 'report:v1');
    assert.equal((await pg.query(`select count(*)::int n from rakeezx.closed_term_reports`)).rows[0].n, 2);
    assert.equal((await pg.query(`select payload#>>'{teachingDocuments,0,marker}' marker from rakeezx.closed_term_reports where id='report:v1'`)).rows[0].marker, null);

    const privileges = (await pg.query(`select
      has_table_privilege('authenticated','rakeezx.closed_term_reports','select') authenticated_select,
      has_table_privilege('authenticated','rakeezx.closed_term_reports','insert') authenticated_insert,
      has_table_privilege('anon','rakeezx.closed_term_reports','select') anonymous_select,
      has_function_privilege('authenticated','rakeezx.apply_sync_v2_closed_term_report_command(text,text,text,text,text,text,jsonb,jsonb,bigint)','execute') authenticated_rpc,
      has_function_privilege('anon','rakeezx.apply_sync_v2_closed_term_report_command(text,text,text,text,text,text,jsonb,jsonb,bigint)','execute') anonymous_rpc`)).rows[0];
    assert.deepEqual(privileges, { authenticated_select: true, authenticated_insert: false, anonymous_select: false, authenticated_rpc: true, anonymous_rpc: false });

    const rls = (await pg.query(`select relrowsecurity, relforcerowsecurity
      from pg_class where oid='rakeezx.closed_term_reports'::regclass`)).rows[0];
    assert.deepEqual(rls, { relrowsecurity: true, relforcerowsecurity: true });
    await pg.exec(`update auth.current_identity set id='${OWNER_B}'; set role authenticated;`);
    try {
      assert.equal((await pg.query(`select count(*)::int n from rakeezx.closed_term_reports`)).rows[0].n, 0);
    } finally {
      await pg.exec(`reset role; update auth.current_identity set id='${OWNER_A}';`);
    }
  } finally {
    await pg.close();
  }
});

after(async () => {
  store.closeChannel();
  await db.closeDB();
});
