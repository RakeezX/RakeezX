import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
export const OWNER = '11111111-1111-4111-8111-111111111111';

export async function lifecycleServer(options = {}) {
  const pg = new PGlite();
  await installLifecycleServer(pg, options);
  return pg;
}

export async function installLifecycleServer(pg, { migration29 = true, migration30 = migration29 } = {}) {
  await pg.exec(`create schema auth; create role authenticated; create role anon;
    create table auth.users(id uuid primary key); create table auth.current_identity(id uuid);
    insert into auth.users values ('${OWNER}'); insert into auth.current_identity values ('${OWNER}');
    create function auth.uid() returns uuid language sql stable security definer set search_path=''
      as $$select id from auth.current_identity limit 1$$;
    grant usage on schema auth to authenticated, anon;`);
  const directory = new URL('../../supabase/migrations/', import.meta.url);
  for (const name of (await readdir(directory)).sort().filter((name) => /^\d+.*\.sql$/.test(name) &&
      (Number(name.slice(0, 4)) <= 26 || (migration29 && Number(name.slice(0, 4)) === 29) ||
       (migration30 && Number(name.slice(0, 4)) === 30)))) {
    await pg.exec((await readFile(new URL(name, directory), 'utf8')).replace(/^\uFEFF/, ''));
  }
}

let yearNumber = 1470;
export async function academicFixture(pg, suffix) {
  const f = Object.fromEntries(['year', 'term', 'subject', 'section', 'destination', 'teaching', 'student', 'enrollment', 'session', 'item']
    .map((name) => [name, `${name}:${suffix}`]));
  const start = yearNumber++;
  await pg.query(`insert into rakeezx.years(id,label,hijri_start,hijri_end,status) values($1,$1,$2,$3,'active')`, [f.year, start, start + 1]);
  await pg.query(`insert into rakeezx.terms(id,year_id,name,"index",status) values($1,$2,$1,1,'active')`, [f.term, f.year]);
  await pg.query(`insert into rakeezx.subjects(id,name,slug) values($1,$1,$1)`, [f.subject]);
  for (const section of [f.section, f.destination]) await pg.query(`insert into rakeezx.sections(id,year_id,grade,label,name)
    values($1,$2,4,$1,$1)`, [section, f.year]);
  await pg.query(`insert into rakeezx.teachings(id,section_id,subject_id,term_id) values($1,$2,$3,$4)`, [f.teaching, f.section, f.subject, f.term]);
  await pg.query(`insert into rakeezx.students(id,name,status) values($1,'طالب اصطناعي','active')`, [f.student]);
  await pg.query(`insert into rakeezx.enrollments(id,student_id,section_id,roll_no,start_date,status)
    values($1,$2,$3,1,'2026-08-01','active')`, [f.enrollment, f.student, f.section]);
  await pg.query(`insert into rakeezx.sessions(id,teaching_id,date,period) values($1,$2,'2026-08-02',1)`, [f.session, f.teaching]);
  await pg.query(`insert into rakeezx.items(id,teaching_id,name,max) values($1,$2,'اختبار',10)`, [f.item, f.teaching]);
  return f;
}

export async function lifecycle(pg, command, payload, mutationId = `${command}:${payload.studentId}`, device = 'device-a') {
  return (await pg.query(`select rakeezx.apply_student_lifecycle_command($1,$2,$3,$4::jsonb,100) result`,
    [mutationId, device, command, JSON.stringify(payload)])).rows[0].result;
}

export async function evidence(pg, f, kind) {
  if (kind === 'attendance') await pg.query(`insert into rakeezx.attendance(id,student_id,session_id,teaching_id,date,status)
    values($1,$2,$3,$4,'2026-08-02','present')`, [`attendance:${f.student}`, f.student, f.session, f.teaching]);
  if (kind === 'scores') await pg.query(`insert into rakeezx.scores(id,student_id,item_id,value) values($1,$2,$3,0)`, [`score:${f.student}`, f.student, f.item]);
  if (kind === 'logs') await pg.query(`insert into rakeezx.logs(id,student_id,teaching_id,date,kind,delta)
    values($1,$2,$3,'2026-08-02','participation',1)`, [`log:${f.student}`, f.student, f.teaching]);
  if (kind === 'notes') await pg.query(`insert into rakeezx.notes(id,student_id,date,text) values($1,$2,'2026-08-02','ملاحظة')`, [`note:${f.student}`, f.student]);
  if (kind === 'inline-note') await pg.query(`update rakeezx.students set note='ملاحظة' where id=$1`, [f.student]);
  if (kind === 'roster-snapshot') {
    await pg.query(`select set_config('rakeezx.sync_v2_attendance_snapshot','on',false)`);
    await pg.query(`insert into rakeezx.session_roster_snapshots(id,session_id,teaching_id,section_id,captured_at,members,state)
      values($1,$2,$3,$4,clock_timestamp(),$5::jsonb,'complete')`, [`snapshot:${f.student}`, f.session, f.teaching, f.section,
      JSON.stringify([{ studentId: f.student, rollNo: 1 }])]);
    await pg.query(`select set_config('rakeezx.sync_v2_attendance_snapshot','off',false)`);
  }
  if (kind === 'closed-term-report') await pg.query(`insert into rakeezx.closed_term_reports
    (id,term_id,year_id,version,source_manifest,payload,device_id) values($1,$2,$3,1,'[]',$4::jsonb,'seed')`,
    [`report:${f.student}`, f.term, f.year, JSON.stringify({ student: { id: f.student } })]);
  if (kind === 'membership-history') await pg.query(`update rakeezx.enrollments set status='transferred',end_date='2026-08-03' where id=$1`, [f.enrollment]);
  if (kind === 'archived') await pg.query(`select rakeezx.apply_sync_v2_section_lifecycle_command($1,'seed','archive_class',$2,'2026-08-03',10)`, [`archive:${f.student}`, f.section]);
}

export class LifecycleBackend {
  constructor(pg) { this.pg = pg; this.operations = []; this.enrollmentUpserts = 0; this.calls = []; this.records = {}; }
  async fetchRecords(table) {
    if (!/^[a-z_]+$/.test(table)) throw new Error('Invalid test table');
    // Match PostgREST JSON date strings, not native PostgreSQL Date objects.
    const rows = (await this.pg.query(`select to_jsonb(t) record from rakeezx.${table} t where owner_id=$1`, [OWNER])).rows.map((row) => row.record);
    this.records[table] = structuredClone(rows);
    return rows;
  }
  async applySyncV2Mutation(e) {
    if (e.entity === 'enrollments') this.enrollmentUpserts++;
    return (await this.pg.query(`select rakeezx.apply_sync_v2_mutation($1,$2,$3,$4,$5,$6::jsonb,$7,$8) result`,
      [e.entity, e.recordId, e.mutationId, e.deviceId, e.baseRevision, JSON.stringify(e.patch), e.operation, e.clientUpdatedAt])).rows[0].result;
  }
  async applySyncV2EnrollmentCommand(e) {
    const result = (await this.pg.query(`select rakeezx.apply_sync_v2_enrollment_command($1,$2,$3,$4::jsonb,$5) result`,
      [e.mutationId, e.deviceId, e.command, JSON.stringify(e.payload), e.clientUpdatedAt])).rows[0].result;
    this.operations.push({ type: e.command, ...result });
    return result;
  }
  async previewStudentRemoval(studentId, enrollmentId, revision) {
    return (await this.pg.query(`select rakeezx.preview_student_removal($1,$2,$3) result`,
      [studentId, enrollmentId, revision])).rows[0].result;
  }
  async applyStudentLifecycleCommand(e) {
    this.calls.push(structuredClone(e));
    const result = (await this.pg.query(`select rakeezx.apply_student_lifecycle_command($1,$2,$3,$4::jsonb,$5) result`,
      [e.mutationId, e.deviceId, e.command, JSON.stringify(e.payload), e.clientUpdatedAt])).rows[0].result;
    if (this.loseResponse) { this.loseResponse = false; throw new Error('Synthetic lost response after commit'); }
    return result;
  }
  activeRolls(section) { return (this.records.enrollments ?? []).filter((row) => row.section_id === section && row.status === 'active' && !row.deleted_at && row.roll_no != null).map((row) => row.roll_no); }
  assertNoDuplicateActiveRolls() {
    const keys = (this.records.enrollments ?? []).filter((row) => row.status === 'active' && !row.deleted_at && row.roll_no != null)
      .map((row) => `${row.section_id}:${row.roll_no}`);
    if (new Set(keys).size !== keys.length) throw new Error('Duplicate active rolls');
  }
}
