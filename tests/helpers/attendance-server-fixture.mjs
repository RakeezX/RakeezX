import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { installRealtimeFixture } from './realtime-server-fixture.mjs';
import { SYNC_V2_SCHEMAS } from '../../src/lib/sync-v2.js';

// Test-only PostgreSQL; never connects to Supabase or reads Production data.
export async function createAttendanceServer() {
  const pg = new PGlite();
  const owner = '11111111-1111-4111-8111-111111111111';
  await pg.exec(`
    create schema auth;
    create role authenticated;
    create role anon;
    create role service_role;
    create table auth.users(id uuid primary key);
    insert into auth.users values ('${owner}');
    create function auth.uid() returns uuid language sql stable as $$select '${owner}'::uuid$$;
  `);
  await installRealtimeFixture(pg);
  const directory = new URL('../../supabase/migrations/', import.meta.url);
  const migrations = (await readdir(directory)).sort().filter((name) => /^\d.*\.sql$/.test(name));
  for (const name of migrations) {
    await pg.exec((await readFile(new URL(name, directory), 'utf8')).replace(/^\uFEFF/, ''));
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
  const readable = new Set(Object.values(SYNC_V2_SCHEMAS).map((schema) => schema.entity));
  return {
    calls,
    migrations,
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
