import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';

// AI N143: shared focused SQL fixture: the unchanged attendance RPC and its declared migrations.
// The generic all-migrations helper fails before this gate on an unrelated N58
// prerequisite (n58_guard_calendar_contract). Keep that original setup failure;
// reproduce THIS protocol against its real SQL, without changing any SQL guard.
export async function createN143AttendanceServer() {
  const {PGlite} = await import('@electric-sql/pglite');
  const {installRealtimeFixture} = await import('./helpers/realtime-server-fixture.mjs');
  const pg = new PGlite(), calls = [];
  try {
    await pg.exec(`create schema auth; create role authenticated; create role anon; create role service_role;
      create table auth.users(id uuid primary key);
      insert into auth.users values ('11111111-1111-4111-8111-111111111111');
      create function auth.uid() returns uuid language sql stable as $$select '11111111-1111-4111-8111-111111111111'::uuid$$;`);
    await installRealtimeFixture(pg);
    const directory = new URL('../supabase/migrations/',import.meta.url);
    for (const name of (await readdir(directory)).sort().filter(n=>/^\d.*\.sql$/.test(n) && Number(n.slice(0,4)) <= 29)) {
      await pg.exec((await readFile(new URL(name,directory),'utf8')).replace(/^\uFEFF/,''));
    }
    await pg.exec(await readFile(new URL('../supabase/migrations/20261030190000_n143_selected_attendance_command.sql',import.meta.url),'utf8'));
    await pg.exec(`insert into rakeezx.profile(owner_id) values (auth.uid());
      insert into rakeezx.years(id,label,hijri_start,hijri_end,status) values ('override-year','اختبار',1450,1451,'active');
      insert into rakeezx.terms(id,year_id,name,"index",status,start_date,end_date) values ('override-term','override-year','اختبار',1,'active','2026-08-01','2026-10-01');
      insert into rakeezx.subjects(id,name,slug) values ('override-subject','اختبار','override-subject');
      insert into rakeezx.sections(id,year_id,grade,label,name) values ('override-section','override-year',4,'اختبار','اختبار');
      insert into rakeezx.teachings(id,section_id,subject_id,term_id) values ('override-teaching','override-section','override-subject','override-term');
      insert into rakeezx.students(id,name,status) values ('override-a','طالب اصطناعي أ','active'),('override-b','طالب اصطناعي ب','active'),('override-c','طالب اصطناعي ج','active');
      insert into rakeezx.enrollments(id,student_id,section_id,roll_no,status,start_date) values
        ('en-a','override-a','override-section',1,'active','2026-08-01'),('en-b','override-b','override-section',2,'active','2026-08-01'),('en-c','override-c','override-section',3,'active','2026-08-01');
      insert into rakeezx.sessions(id,teaching_id,date,period,status) values ('override-session','override-teaching','2026-09-06',1,'scheduled');`);
    return {pg,calls,close:()=>pg.close(),fetchRecords:async entity=>{
      if (!['students','sessions','attendance'].includes(entity)) return [];
      return (await pg.query(`select to_jsonb(t) as record from rakeezx.${entity} t where owner_id=auth.uid()`)).rows.map(r=>r.record);
    },applyFillAttendanceCommand:async e=>{
      calls.push(structuredClone(e));
      return (await pg.query('select rakeezx.apply_sync_v2_fill_attendance_command($1,$2,$3,$4,$5) as result',
        [e.mutationId,e.deviceId,e.sessionId,e.status,e.clientUpdatedAt])).rows[0].result;
    },applySelectedAttendanceCommand:async e=>{
      calls.push(structuredClone(e));
      return (await pg.query('select rakeezx.apply_sync_v2_selected_attendance_command($1,$2,$3,$4::text[],$5,$6) as result',
        [e.mutationId,e.deviceId,e.sessionId,e.studentIds,e.status,e.clientUpdatedAt])).rows[0].result;
    },applyAttendanceCommand:async e=>{
      return (await pg.query('select rakeezx.apply_sync_v2_attendance_command($1,$2,$3,$4,$5,$6,$7::jsonb,$8) as result',
        [e.mutationId,e.deviceId,e.attendanceId,e.sessionId,e.studentId,e.baseRevision,JSON.stringify(e.patch),e.clientUpdatedAt])).rows[0].result;
    }};
  } catch (error) { await pg.close(); throw error; }
}

test('n143_selected_rpc_atomicity_replay_and_live_definition local qualification', {timeout:120000}, async()=>{
  const server=await createN143AttendanceServer(), pg=server.pg;
  const call=(mutationId,studentIds,status='present',sessionId='override-session')=>server.applySelectedAttendanceCommand({
    mutationId,deviceId:'n143-local-device',sessionId,studentIds,status,clientUpdatedAt:1800000000000});
  const counts=async()=> (await pg.query(`select
    (select count(*)::int from rakeezx.attendance) as attendance,
    (select count(*)::int from rakeezx.session_roster_snapshots) as snapshots,
    (select count(*)::int from rakeezx.sync_mutation_receipts) as receipts`)).rows[0];
  try {
    const before=await counts();
    for (const ids of [[],['override-a','override-a'],['override-a','foreign'],[null],[''],null]) {
      await assert.rejects(call('bad-list',ids));
      assert.deepEqual(await counts(),before);
    }
    for (const status of ['invalid',null]) await assert.rejects(call('bad-status',['override-a'],status));
    await assert.rejects(call('bad-session',['override-a'],'present','missing-session'));
    assert.deepEqual(await counts(),before);
    const [marked,selected]=await Promise.all([
      server.applyAttendanceCommand({mutationId:'competing',deviceId:'local',attendanceId:'att:override-a:override-session',
        sessionId:'override-session',studentId:'override-a',baseRevision:0,patch:{status:'excused'},clientUpdatedAt:1800000000000}),
      call('selected',['override-a','override-b']),
    ]);
    assert.equal(marked.attendance.status,'excused');
    assert.deepEqual(selected.applied.map(r=>r.student_id),['override-b']);
    assert.equal(selected.skipped[0].status,'excused');
    assert.deepEqual((await server.fetchRecords('attendance')).map(r=>r.student_id).sort(),['override-a','override-b']);
    assert.deepEqual(await call('selected',['override-a','override-b']),selected);
    await assert.rejects(call('selected',['override-c']),/different request/);
    await assert.rejects(call('selected',['override-a','override-b'],'late'),/different request/);
    for (const [index,status] of ['present','late','absent','excused'].entries()) {
      const sessionId=`preserve-${index}`;
      await pg.query(`insert into rakeezx.sessions(id,teaching_id,date,period,status) values($1,'override-teaching','2026-09-06',$2,'scheduled')`,[sessionId,index+2]);
      const mark=await server.applyAttendanceCommand({mutationId:`mark-${index}`,deviceId:'local',attendanceId:`att:override-a:${sessionId}`,
        sessionId,studentId:'override-a',baseRevision:0,patch:{status},clientUpdatedAt:1800000000000});
      const result=await call(`preserve-${index}`,['override-a'],'present',sessionId);
      assert.equal(result.applied.length,0);
      assert.deepEqual(result.skipped[0],mark.attendance);
    }
    const snapshot=await counts();
    await pg.exec(`create or replace function auth.uid() returns uuid language sql stable as $$select null::uuid$$;`);
    await assert.rejects(call('no-owner',['override-c']),/Authentication required/);
    await pg.exec(`create or replace function auth.uid() returns uuid language sql stable as $$select '22222222-2222-4222-8222-222222222222'::uuid$$;`);
    await assert.rejects(call('other-owner',['override-c']),/session is unavailable/);
    await pg.exec(`create or replace function auth.uid() returns uuid language sql stable as $$select '11111111-1111-4111-8111-111111111111'::uuid$$;`);
    assert.deepEqual(await counts(),snapshot);
    await pg.exec(`update rakeezx.enrollments set status='withdrawn',end_date='2026-09-01' where student_id='override-c';`);
    await assert.rejects(call('inactive',['override-c']),/enrollment is inactive/);
    assert.deepEqual(await counts(),snapshot);
    const acl=(await pg.query(`select
      has_function_privilege('anon','rakeezx.apply_sync_v2_selected_attendance_command(text,text,text,text[],text,bigint)','EXECUTE') as anon,
      has_function_privilege('authenticated','rakeezx.apply_sync_v2_selected_attendance_command(text,text,text,text[],text,bigint)','EXECUTE') as authenticated`)).rows[0];
    assert.deepEqual(acl,{anon:false,authenticated:true});
  } finally {await server.close();}
});

test('n143_existing_full_roster_fill_unchanged', {timeout:120000},async()=>{
  const server=await createN143AttendanceServer();
  try {
    const receipt=await server.applyFillAttendanceCommand({mutationId:'whole-roster',deviceId:'local',sessionId:'override-session',status:'absent',clientUpdatedAt:1800000000000});
    assert.equal(receipt.applied.length,3);
    assert.ok(receipt.applied.every(r=>r.status==='absent'));
    assert.equal(server.calls[0].studentIds,undefined);
  } finally {await server.close();}
});

test('n143_selected_status_store_sync_atomicity_and_partial_failure', {timeout:120000},async()=>{
  await import('fake-indexeddb/auto');
  globalThis.document={documentElement:{setAttribute(){},removeAttribute(){},classList:{add(){},remove(){}}},querySelector:()=>({setAttribute(){}})};
  globalThis.matchMedia=()=>({matches:false});
  const db=await import('../src/lib/db.js'), store=await import('../src/store.js'), cloud=await import('../src/lib/cloud.js');
  const {prepareAccount}=await import('./n44-fixture.mjs');
  const {runtimeOfflineLease}=await import('../src/lib/offline-lease.js');
  const {runtimeSyncOwnershipGuard}=await import('../src/lib/sync-ownership.js');
  const {createSyncV2Engine}=await import('../src/lib/sync-v2.js');
  const owner='11111111-1111-4111-8111-111111111111';
  const previousFetch=globalThis.fetch;
  globalThis.fetch=async()=>{throw Error('N143 forbids network');};
  db.closeDB();
  const server=await createN143AttendanceServer();
  try {
    const values=new Map();
    globalThis.localStorage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)};
    globalThis.indexedDB=new (await import('fake-indexeddb')).IDBFactory();
    await prepareAccount(owner);
    store.getOfflineLeaseStatus();
    await runtimeOfflineLease().renew(async()=>({id:owner,source:'supabase-auth-user',verifiedAt:Date.now()}));
    await store.patchDevice({activeYearId:'n44-year',activeTermId:'n44-term'});
    await store.refreshSyncedState();
    const section=await store.createSection({grade:4,label:'143'});
    const canonical=row=>({...row,ownerId:owner,serverRevision:1,canonicalId:row.id,deleted:false});
    await store.save({
      subjects:[canonical({id:'override-subject',name:'اصطناعي'})],
      teachings:[canonical({id:'override-teaching',sectionId:section.id,subjectId:'override-subject',termId:store.activeTerm().id})],
      students:['a','b','c'].map(id=>canonical({id:`override-${id}`,name:`طالب اصطناعي ${id}`,status:'active'})),
      enrollments:['a','b','c'].map((id,i)=>canonical({id:`en-${id}`,studentId:`override-${id}`,sectionId:section.id,status:'active',rollNo:i+1})),
      sessions:['present','late','absent','excused'].map((status,i)=>canonical({id:i===0?'override-session':`status-${status}`,teachingId:'override-teaching',date:'2026-09-06',period:i+1,status:'scheduled'})),
    },{queue:false});
    await db.clearStore('outbox');
    const invalidBefore=await db.getAll('attendance');
    for (const status of [null,'unknown',{},['late']]) await assert.rejects(store.fillSelectedAttendance('override-session',['override-b'],{status}));
    assert.deepEqual(await db.getAll('attendance'),invalidBefore);
    assert.equal((await db.getAll('outbox')).length,0);
    let body;
    globalThis.fetch=async(url,options)=>{
      assert.ok(String(url).endsWith('/rpc/apply_sync_v2_selected_attendance_command'));
      body=JSON.parse(options.body);
      const receipt=await server.applySelectedAttendanceCommand({mutationId:body.p_mutation_id,deviceId:body.p_device_id,
        sessionId:body.p_session_id,studentIds:body.p_student_ids,status:body.p_status,clientUpdatedAt:body.p_client_updated_at});
      return new Response(JSON.stringify(receipt),{status:200,headers:{'Content-Type':'application/json'}});
    };
    const engine=createSyncV2Engine({database:db,ownershipGuard:runtimeSyncOwnershipGuard,currentAuthenticatedUserId:()=>cloud.user?.id});
    for (const [i,status] of ['present','late','absent','excused'].entries()) {
      const sessionId=i===0?'override-session':`status-${status}`;
      if(i)await server.pg.query(`insert into rakeezx.sessions(id,teaching_id,date,period,status) values($1,'override-teaching','2026-09-06',$2,'scheduled')`,[sessionId,i+1]);
      const outcome=await store.fillSelectedAttendance(sessionId,['override-b'],i?{status}:undefined);
      assert.deepEqual(outcome,{saved:1,skipped:0});
      const rows=await db.getAll('outbox');
      assert.equal(rows.length,1);assert.equal(rows[0].ownerId,owner);
      assert.equal(rows[0].command,'attendance:selected-fill');
      assert.deepEqual(rows[0].patch.studentIds,['override-b']);assert.equal(rows[0].patch.status,status);
      const result=await engine.dispatchPending();
      assert.equal(result.acknowledged,1);
      assert.deepEqual(body.p_student_ids,['override-b']);assert.equal(body.p_status,status);
      assert.equal((await db.getAll('outbox')).length,0);
      const remote=(await server.fetchRecords('attendance')).filter(r=>r.session_id===sessionId);
      assert.deepEqual(remote.map(r=>[r.student_id,r.status]),[['override-b',status]]);
      const repeated=await store.fillSelectedAttendance(sessionId,['override-b'],{status:'absent'});
      assert.deepEqual(repeated,{saved:0,skipped:1});assert.equal((await db.getAll('outbox')).length,0);
    }
    const before=await db.getAll('attendance');
    const schedule=await db.get('sessions','override-session');
    await db.put('sessions',{...schedule,startTime:'09:00',endTime:'09:40'});
    await assert.rejects(store.fillSelectedAttendance('override-session',['override-c'],{status:'late'}),/TEAMS_WRITE_FAILED/);
    assert.deepEqual(await db.getAll('attendance'),before);assert.equal((await db.getAll('outbox')).length,0);
    await db.put('sessions',schedule);
    const student=await db.get('students','override-c');
    await db.put('students',{...student,ownerId:'22222222-2222-4222-8222-222222222222'});
    await assert.rejects(store.fillSelectedAttendance('override-session',['override-c']));
    assert.deepEqual(await db.getAll('attendance'),before);
    assert.equal((await db.getAll('outbox')).length,0);
    await db.put('students',student);
    cloud.setMockAuth({id:'22222222-2222-4222-8222-222222222222'},null);
    await assert.rejects(store.fillSelectedAttendance('override-session',['override-c']));
    assert.deepEqual(await db.getAll('attendance'),before);
    assert.equal((await db.getAll('outbox')).length,0);
  } finally {
    globalThis.fetch=previousFetch;
    store.deactivateWorkspace(); db.closeDB();
    cloud.setMockAuth(null,null);
    await server.close();
  }
});

