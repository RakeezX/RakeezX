import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

// Test-only PostgreSQL; never connects to Supabase or reads Production data.
export async function createAttendanceServer() {
  const pg = new PGlite();
  const owner = '11111111-1111-4111-8111-111111111111';
  await pg.exec(`
    create schema auth;
    create role authenticated;
    create role anon;
    create table auth.users(id uuid primary key);
    insert into auth.users values ('${owner}');
    create function auth.uid() returns uuid language sql stable as $$select '${owner}'::uuid$$;
  `);
  for (const name of [
    '0001_core_schema.sql', '0002_indexes_triggers_rls.sql', '0003_hybrid_calendar.sql',
    '0004_student_notes.sql', '0007_sections_active_normalized_identity.sql',
    '0008_enrollment_membership_operations.sql', '0009_transfer_and_renumber_rosters.sql',
    '0010_profile_report_principal_name.sql', '0011_session_roster_snapshots.sql',
    '0012_sync_v2_server_protocol.sql', '0013_sync_v2_enrollment_commands.sql',
    '0014_sync_v2_attendance_snapshot_commands.sql', '0015_sync_v2_lifecycle_commands.sql',
    '0016_sync_v2_teaching_creation_commands.sql', '0017_sync_v2_bulk_attendance_commands.sql',
  ]) {
    await pg.exec((await readFile(new URL(`../../supabase/migrations/${name}`, import.meta.url), 'utf8')).replace(/^\uFEFF/, ''));
  }
  await pg.exec(`
    insert into rakeezx.profile(owner_id) values ('${owner}');
    insert into rakeezx.years(id,label,hijri_start,hijri_end,status) values ('override-year','اختبار',1450,1451,'active');
    insert into rakeezx.terms(id,year_id,name,"index",status,start_date,end_date)
      values ('override-term','override-year','اختبار',1,'active','2026-08-01','2026-10-01');
    insert into rakeezx.terms(id,year_id,name,"index",status,start_date,end_date)
      values ('override-term-2','override-year','اختبار ٢',2,'upcoming','2026-10-02','2026-12-31');
    insert into rakeezx.subjects(id,name,slug) values ('override-subject','اختبار','override-subject');
    insert into rakeezx.sections(id,year_id,grade,label,name) values ('override-section','override-year',4,'اختبار','اختبار');
    insert into rakeezx.teachings(id,section_id,subject_id,term_id)
      values ('override-teaching','override-section','override-subject','override-term');
    insert into rakeezx.students(id,name,status) values
      ('override-a','طالب اختبار أ','active'),('override-b','طالب اختبار ب','active'),('override-c','طالب اختبار ج','active');
    insert into rakeezx.enrollments(id,student_id,section_id,roll_no,status,start_date) values
      ('override-en-a','override-a','override-section',1,'active','2026-08-01'),
      ('override-en-b','override-b','override-section',2,'active','2026-08-01'),
      ('override-en-c','override-c','override-section',3,'active','2026-08-01');
    insert into rakeezx.sessions(id,teaching_id,date,period,status)
      values ('override-session','override-teaching','2026-09-06',1,'scheduled');
  `);
  const calls = [];
  const readable = new Set(['profile','years','terms','subjects','sections','teachings','students','enrollments','sessions','attendance','session_roster_snapshots']);
  return {
    calls,
    pg,
    async fetchRecords(entity) {
      if (!readable.has(entity)) return [];
      // Match PostgREST JSON dates rather than PGlite's native Date objects.
      return (await pg.query(`select to_jsonb(t) as record from rakeezx.${entity} t where owner_id=$1`, [owner])).rows.map((row)=>row.record);
    },
    async applyFillAttendanceCommand(e) {
      calls.push(structuredClone(e));
      return (await pg.query('select rakeezx.apply_sync_v2_fill_attendance_command($1,$2,$3,$4,$5) as result',
        [e.mutationId,e.deviceId,e.sessionId,e.status,e.clientUpdatedAt])).rows[0].result;
    },
    async applyAttendanceCommand(e) {
      calls.push(structuredClone(e));
      return (await pg.query('select rakeezx.apply_sync_v2_attendance_command($1,$2,$3,$4,$5,$6,$7::jsonb,$8) as result',
        [e.mutationId,e.deviceId,e.attendanceId,e.sessionId,e.studentId,e.baseRevision,JSON.stringify(e.patch),e.clientUpdatedAt])).rows[0].result;
    },
    close: () => pg.close(),
  };
}
