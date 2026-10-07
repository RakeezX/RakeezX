import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const OWNER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';

test('N77 embedded Postgres cascade is owner-bound, scope-aware and replayable', async () => {
  const pg = new PGlite();
  try {
    await pg.exec(`create schema auth; create role authenticated; create role anon; create role service_role;
      create table auth.users(id uuid primary key); create table auth.current_identity(id uuid not null);
      insert into auth.users values ('${OWNER}'),('${OTHER}'); insert into auth.current_identity values ('${OWNER}');
      create function auth.uid() returns uuid language sql stable security definer set search_path=''
        as $$select id from auth.current_identity limit 1$$;`);
    const root = new URL('../supabase/migrations/', import.meta.url);
    const files = (await readdir(root)).filter((name) => /^(?:\d{4}_|2026\d{10}_)/.test(name) &&
      !name.startsWith('20260926115629_')).sort(); // Realtime is external to embedded Postgres.
    for (const name of files) await pg.exec((await readFile(new URL(name, root), 'utf8')).replace(/^\uFEFF/, ''));
    const privileges = (await pg.query(`select
      has_function_privilege('authenticated','rakeezx.n77_delete_teaching(text,text,text,text,text,boolean)','execute') a,
      has_function_privilege('anon','rakeezx.n77_delete_teaching(text,text,text,text,text,boolean)','execute') b`)).rows[0];
    assert.deepEqual(privileges, { a: true, b: false });
    await pg.query(`insert into rakeezx.years(id,label,hijri_start,hijri_end,status) values('y','Year',1470,1471,'active')`);
    await pg.query(`insert into rakeezx.terms(id,year_id,name,"index",status) values('term','y','Term',1,'active')`);
    await pg.query(`insert into rakeezx.subjects(id,name,slug) values('s1','One','one'),('s2','Two','two')`);
    await pg.query(`insert into rakeezx.sections(id,year_id,grade,label,name) values('sec','y',5,'A','A')`);
    await pg.query(`insert into rakeezx.teachings(id,section_id,subject_id,term_id) values('t1','sec','s1','term'),('t2','sec','s2','term')`);
    await pg.query(`insert into rakeezx.items(id,teaching_id,name,max) values('i1','t1','Item',10),('i2','t2','Item',10)`);
    await pg.query(`insert into rakeezx.students(id,name) values('student','Shared')`);
    await pg.query(`insert into rakeezx.enrollments(id,student_id,section_id,start_date,status) values('en','student','sec','2026-09-01','active')`);
    await pg.query(`insert into rakeezx.scores(id,student_id,item_id,value) values('score1','student','i1',5),('score2','student','i2',7)`);
    await pg.query(`select set_config('rakeezx.score_domain_write','on',false)`);
    await pg.query(`insert into rakeezx.score_subitems(id,item_id,name,value) values('subitem1','i1','Part',5)`);
    await pg.query(`insert into rakeezx.score_subitem_completions(id,student_id,subitem_id,checked) values('completion1','student','subitem1',true)`);
    await pg.query(`select set_config('rakeezx.score_domain_write','off',false)`);
    await pg.query(`insert into rakeezx.slots(id,teaching_id,weekday,period) values('slot1','t1',1,1)`);
    await pg.query(`insert into rakeezx.sessions(id,teaching_id,date,period,slot_id) values('session1','t1','2026-10-07',1,'slot1')`);
    await pg.query(`select set_config('rakeezx.sync_v2_attendance_snapshot','on',false)`);
    await pg.query(`insert into rakeezx.session_roster_snapshots(id,session_id,teaching_id,section_id,captured_at,members) values('snapshot1','session1','t1','sec',now(),'[]')`);
    await pg.query(`select set_config('rakeezx.sync_v2_attendance_snapshot','off',false)`);
    await pg.query(`insert into rakeezx.attendance(id,student_id,session_id,teaching_id,date,status) values('att1','student','session1','t1','2026-10-07','present')`);
    await pg.query(`insert into rakeezx.logs(id,student_id,teaching_id,session_id,date,kind,delta) values('log1','student','t1','session1','2026-10-07','participation',1)`);
    await pg.query(`insert into rakeezx.notes(id,student_id,teaching_id,session_id,text,date,kind) values('note1','student','t1','session1','Note','2026-10-07','teacher')`);
    await pg.query(`insert into rakeezx.class_rules(id,teaching_id,icon_key,text) values('rule1','t1','shield','Rule')`);
    await pg.query(`insert into rakeezx.group_arrangements(id,teaching_id,groups) values('groups1','t1','[]')`);
    await pg.query(`insert into rakeezx.class_goals(id,teaching_id,run_id,date,text,duration_minutes,reward_points,state,started_at)
      values('goal1','t1','run1','2026-10-07','Goal',10,2,'active',now())`);
    await pg.query(`insert into rakeezx.class_charter_selections(id,teaching_id,selected_rule_ids) values('charter1','t1',array['rule1'])`);
    await pg.query(`insert into rakeezx.closed_term_reports(id,term_id,year_id,version,source_manifest,payload,device_id)
      values('mixed-report','term','y',1,'[]','{"teachingDocuments":[{"teaching":{"id":"t1"}},{"teaching":{"id":"t2"}}]}','device')`);
    const mixedBytes = (await pg.query(`select payload::text bytes from rakeezx.closed_term_reports where id='mixed-report'`)).rows[0].bytes;
    await pg.query(`update auth.current_identity set id='${OTHER}'`);
    await pg.query(`insert into rakeezx.years(id,label,hijri_start,hijri_end,status) values('y','Other Year',1470,1471,'active')`);
    await pg.query(`insert into rakeezx.terms(id,year_id,name,"index",status) values('term','y','Other Term',1,'active')`);
    await pg.query(`insert into rakeezx.subjects(id,name,slug) values('s1','Other One','one')`);
    await pg.query(`insert into rakeezx.sections(id,year_id,grade,label,name) values('sec','y',5,'A','Other A')`);
    await pg.query(`insert into rakeezx.teachings(id,section_id,subject_id,term_id) values('t1','sec','s1','term')`);
    await pg.query(`update auth.current_identity set id='${OWNER}'`);
    const preview = (await pg.query(`select rakeezx.n77_delete_teaching('t1','sec') result`)).rows[0].result;
    assert.equal(preview.scope,'teaching');
    assert.deepEqual(preview.teachingIds,['t1']);
    await assert.rejects(pg.query(`select rakeezx.apply_sync_v2_lifecycle_command('old-delete','device','delete_class','sec',1)`), /N77 Delete requires/);
    await pg.query(`update auth.current_identity set id='${OTHER}'`);
    const otherPreview = (await pg.query(`select rakeezx.n77_delete_teaching('t1','sec') result`)).rows[0].result;
    assert.equal(otherPreview.ownerId,OTHER);
    assert.equal(otherPreview.scope,'section');
    await assert.rejects(pg.query(`select rakeezx.n77_delete_teaching('t1','sec',$1,'other-stale','device',true)`,[preview.fingerprint]), /N77 scope is stale/);
    await pg.query(`update auth.current_identity set id='${OWNER}'`);
    await assert.rejects(pg.query(`select rakeezx.n77_delete_teaching('t1','sec','stale','m-stale','device',true)`), /N77 scope is stale/);
    await pg.exec(`create function rakeezx.n77_test_fail() returns trigger language plpgsql as $$begin raise exception 'injected cascade failure'; end$$;
      create trigger n77_test_fail before update on rakeezx.class_rules for each row execute function rakeezx.n77_test_fail();`);
    await assert.rejects(pg.query(`select rakeezx.n77_delete_teaching('t1','sec',$1,'m-fail','device',true)`,[preview.fingerprint]), /injected cascade failure/);
    assert.equal((await pg.query(`select deleted_at is null live from rakeezx.score_subitems where id='subitem1'`)).rows[0].live,true);
    assert.equal((await pg.query(`select deleted_at is null live from rakeezx.teachings where owner_id=$1 and id='t1'`,[OWNER])).rows[0].live,true);
    await pg.exec(`drop trigger n77_test_fail on rakeezx.class_rules; drop function rakeezx.n77_test_fail();`);
    const result = (await pg.query(`select rakeezx.n77_delete_teaching('t1','sec',$1,'m1','device',true) result`,[preview.fingerprint])).rows[0].result;
    assert.equal(result.outcome,'deleted');
    assert.deepEqual((await pg.query(`select id from rakeezx.teachings where owner_id=$1 and section_id='sec' and deleted_at is null`,[OWNER])).rows.map((r)=>r.id),['t2']);
    assert.deepEqual((await pg.query(`select id from rakeezx.scores where deleted_at is null`)).rows.map((r)=>r.id),['score2']);
    for (const [table,id] of [['score_subitems','subitem1'],['score_subitem_completions','completion1'],
      ['slots','slot1'],['sessions','session1'],['session_roster_snapshots','snapshot1'],
      ['attendance','att1'],['logs','log1'],['notes','note1'],['class_rules','rule1'],
      ['group_arrangements','groups1'],['class_charter_selections','charter1'],['class_goals','goal1']]) {
      assert.equal((await pg.query(`select deleted_at is not null gone from rakeezx.${table} where owner_id=$1 and id=$2`,[OWNER,id])).rows[0].gone,true,table);
    }
    assert.equal((await pg.query(`select deleted_at is null kept from rakeezx.teachings where owner_id=$1 and id='t1'`,[OTHER])).rows[0].kept,true);
    assert.equal((await pg.query(`select payload::text bytes from rakeezx.closed_term_reports where id='mixed-report'`)).rows[0].bytes,mixedBytes);
    assert.deepEqual((await pg.query(`select rakeezx.n77_delete_teaching('t1','sec',$1,'m1','device',true) result`,[preview.fingerprint])).rows[0].result,result);
    const final = (await pg.query(`select rakeezx.n77_delete_teaching('t2','sec') result`)).rows[0].result;
    assert.equal(final.scope,'section');
    await pg.query(`select rakeezx.n77_delete_teaching('t2','sec',$1,'m2','device',true)`,[final.fingerprint]);
    assert.equal((await pg.query(`select deleted_at is not null gone from rakeezx.sections where owner_id=$1 and id='sec'`,[OWNER])).rows[0].gone,true);
    assert.equal((await pg.query(`select deleted_at is null kept from rakeezx.students where owner_id=$1 and id='student'`,[OWNER])).rows[0].kept,true);
    assert.equal((await pg.query(`select payload::text bytes from rakeezx.closed_term_reports where id='mixed-report'`)).rows[0].bytes,mixedBytes);
    await assert.rejects(pg.query(`insert into rakeezx.enrollments(id,student_id,section_id,start_date,status) values('stale','student','sec','2026-10-01','active')`), /N77 section is unavailable/);
  } finally { await pg.close(); }
});
