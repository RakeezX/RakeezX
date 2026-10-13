import 'fake-indexeddb/auto';
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { installRealtimeFixture } from './helpers/realtime-server-fixture.mjs';
import * as db from '../src/lib/db.js';
import * as store from '../src/store.js';
import { encodeSyncV2Patch, decodeSyncV2Canonical, createSyncV2Engine } from '../src/lib/sync-v2.js';
import { resolveCalendarRuntime } from '../src/lib/calendar-runtime.js';
import { IsolatedIndexedDb } from './helpers/isolated-indexed-db.mjs';
import { readCompleteTable } from '../src/lib/complete-read.js';

// Original blocker source is preserved at ee3e2a6. probe-02.tap is LOST,
// NOT RECOVERED; these runs are new verification, not historical originals.
// Correction probes retain direct-write rejection and add the valid scoped path.
// Full frozen migration chain in disposable PGlite; fake IndexedDB only.
const OWNER='44444444-4444-4444-8444-444444444444';
const PRESET='sa-general-1448-1449';
const year={id:'probe-year',label:'Synthetic',hijriStart:1448,hijriEnd:1449,calendarPresetId:PRESET,status:'active',serverRevision:2};
const terms=[
  {id:'probe-t1',yearId:year.id,name:'One',index:1,startDate:'2026-08-23',endDate:'2027-01-07',status:'active',serverRevision:1},
  {id:'probe-t2',yearId:year.id,name:'Two',index:2,startDate:'2027-01-17',endDate:'2027-06-24',status:'upcoming',serverRevision:1},
  {id:'probe-t3',yearId:year.id,name:'Custom',index:3,startDate:'2027-07-05',endDate:'2027-08-01',status:'upcoming',serverRevision:1},
];
const pair={startDate:'2027-07-10',endDate:'2027-08-10'};
global.document={documentElement:{setAttribute(){},removeAttribute(){},classList:{add(){},remove(){}}},querySelector:()=>({setAttribute(){}})};
global.matchMedia=()=>({matches:false});
let pg;
const mutate=async(entity,id,mutation,operation,patch,base=0)=>(await pg.query(
  `select rakeezx.apply_sync_v2_mutation($1,$2,$3,'probe',$4,$5::jsonb,$6,10) r`,
  [entity,id,mutation,base,JSON.stringify(patch),operation])).rows[0].r;

before(async()=>{
  pg=new PGlite();
  await pg.exec(`create schema auth; create role authenticated; create role anon; create role service_role;
    create table auth.users(id uuid primary key); insert into auth.users values('${OWNER}');
    create function auth.uid() returns uuid language sql stable as $$select '${OWNER}'::uuid$$;
    grant usage on schema auth to authenticated,anon;`);
  await installRealtimeFixture(pg);
  const directory=new URL('../supabase/migrations/',import.meta.url);
  const migrations=(await readdir(directory)).filter(name => name.endsWith('.sql') && name <= '20261004070002_n58_effective_scope_revalidation.sql').sort();
  const n58 = migrations.filter(name => name.includes('_n58_'));
  assert.equal(migrations.length,41);
  assert.equal(n58.at(-1),'20261004070002_n58_effective_scope_revalidation.sql');
  for(const name of [...migrations.filter(name => !n58.includes(name)), ...n58])
    await pg.exec((await readFile(new URL(name,directory),'utf8')).replace(/^\uFEFF/,''));
  await pg.exec(`set role authenticated;
    insert into rakeezx.years(id,label,hijri_start,hijri_end,status) values('probe-year','Synthetic',1448,1449,'active');
    insert into rakeezx.terms(id,year_id,name,"index",start_date,end_date,status) values
      ('probe-t1','probe-year','One',1,'2026-08-23','2027-01-07','active'),
      ('probe-t2','probe-year','Two',2,'2027-01-17','2027-06-24','upcoming'),
      ('probe-t3','probe-year','Custom',3,'2027-07-05','2027-08-01','upcoming');`);
  const selected=await mutate('years',year.id,'probe-select','patch',{calendar_preset_id:PRESET},1);
  assert.equal(selected.outcome,'applied');
  await mutate('calendars','probe-scope','probe-create-scope','create',{year_id:year.id,source:'custom',preset_id:PRESET});
  db.selectDatabase('rakeezx-user-44444444444444448444444444444444');
  await store.init();
  store.state.years=[year]; store.state.terms=structuredClone(terms);
  await db.put('years',year); await db.putMany('terms',terms);
  for(const entry of await db.getAll('outbox')) await db.remove('outbox',entry.id);
});
after(async()=>{store.closeChannel();db.closeDB();await pg?.close();});

test('CORRECTED CLIENT: extra-term edit queues scoped dates atomically and reaches ordinary Sync', async () => {
  const updated = await store.updateTermDates('probe-t3',pair.startDate,pair.endDate);
  assert.equal(updated.startDate,pair.startDate);
  assert.equal((await db.get('terms','probe-t3')).endDate,terms[2].endDate);
  const queued = (await db.getAll('outbox')).find(e => e.store === 'calendars' && e.op === 'patch');
  assert.deepEqual(queued.patch.term_date_overrides['probe-t3'],{start_date:pair.startDate,end_date:pair.endDate});
  assert.ok(queued.dependencies.some(d => d.store === 'terms' && d.recordId === 'probe-t3'));
  const engine = createSyncV2Engine({ database:db, transport:{ applyMutation: m => mutate(m.entity,m.recordId,m.mutationId,m.operation,m.patch,m.baseRevision) } });
  const result = await engine.dispatchPending();
  assert.equal(result.failed,0); assert.equal(result.blocked,0);
  assert.equal((await db.getAll('outbox')).length,0);
  const receiver = (await pg.query(`select * from rakeezx.calendars where id='probe-scope'`)).rows.map(row => decodeSyncV2Canonical('calendars',row));
  assert.equal(receiver[0].termDateOverrides['probe-t3'].endDate,pair.endDate);
  assert.deepEqual((await pg.query(`select start_date::text s,end_date::text e from rakeezx.terms where id='probe-t3'`)).rows[0],{s:'2027-07-05',e:'2027-08-01'});
  await assert.rejects(mutate('terms','probe-t3','direct-rejection','patch',{start_date:pair.startDate,end_date:pair.endDate},1),/N58_USE_SCOPED_TERM_OVERRIDES/);
});

test('CORRECTED: extra-term override reaches scoped storage and the resolver',async()=>{
  const result=await mutate('calendars','probe-scope','probe-extra-override','patch',{
    term_date_overrides:{'probe-t3':{start_date:pair.startDate,end_date:pair.endDate}}
  },(await pg.query(`select revision from rakeezx.calendars where id='probe-scope'`)).rows[0].revision);
  assert.equal(result.outcome,'applied');
  const projected=resolveCalendarRuntime({year,terms,presetId:PRESET,customizations:[{
    yearId:year.id,presetId:PRESET,termDateOverrides:[{termId:'probe-t3',...pair}],exceptions:[]
  }]});
  assert.equal(projected.ok,true);
  assert.equal(projected.terms.find(t=>t.id==='probe-t3').startDate,pair.startDate);
  assert.equal(projected.terms.find(t=>t.id==='probe-t3').officialStartDate,undefined);
});

test('DIRECT WRITE GUARD: raw dated term creation is rejected after selection',async()=>{
  const extra={id:'probe-t4',yearId:year.id,name:'Another custom term',index:4,
    startDate:'2027-08-11',endDate:'2027-08-20',status:'upcoming'};
  await assert.rejects(mutate('terms',extra.id,'probe-create-extra','create',encodeSyncV2Patch('terms',extra)),/N58_USE_SCOPED_TERM_OVERRIDES/);
  assert.equal((await pg.query(`select count(*)::int n from rakeezx.terms where id='probe-t4'`)).rows[0].n,0);
});

test('CORRECTED: all extra indices retain independent preset overrides, raw fallback and undated identities',async()=>{
  const expanded=structuredClone(terms);
  for(const index of [4,5,6]) {
    const extra={id:`probe-t${index}`,yearId:year.id,name:'Custom',index,status:'upcoming'};
    expanded.push(extra);
    assert.equal((await mutate('terms',extra.id,`extra-identity-${index}`,'create',encodeSyncV2Patch('terms',extra))).outcome,'applied');
  }
  const overrides=Object.fromEntries([3,4,5,6].map(index=>[`probe-t${index}`,{
    start_date:`2027-${String(index+5).padStart(2,'0')}-01`,end_date:`2027-${String(index+5).padStart(2,'0')}-10`} ]));
  const before=JSON.stringify(expanded);
  const result=await mutate('calendars','probe-scope','all-extras','patch',{term_date_overrides:overrides},2);
  assert.equal(result.outcome,'applied');
  const customizations=[{yearId:year.id,presetId:PRESET,termDateOverrides:Object.entries(overrides).map(([termId,dates])=>({termId,startDate:dates.start_date,endDate:dates.end_date}))}];
  const resolve=presetId=>resolveCalendarRuntime({year,terms:expanded,presetId,customizations});
  const general=resolve(PRESET),western=resolve('sa-western-1448-1449');
  assert.equal(general.ok,true); assert.equal(western.ok,true);
  for(const index of [3,4,5,6]) assert.equal(general.terms.find(t=>t.index===index).startDate,overrides[`probe-t${index}`].start_date);
  assert.equal(western.terms.find(t=>t.index===3).startDate,terms[2].startDate);
  assert.equal(western.terms.find(t=>t.index===4).startDate,undefined);
  assert.deepEqual(resolve(PRESET),general);assert.equal(JSON.stringify(expanded),before);
  for(const invalid of [
    {foreign:{start_date:'2027-08-01',end_date:'2027-08-10'}},
    {'probe-t3':{start_date:'2027-02-30',end_date:'2027-08-10'}},
    {'probe-t3':{start_date:'2027-01-01',end_date:'2027-08-10'}},
    {'probe-t3':{start_date:'2027-08-01'}},
  ]) await assert.rejects(mutate('calendars','probe-scope',`invalid-${JSON.stringify(invalid)}`,'patch',{term_date_overrides:invalid},3),/N58_INVALID|N58_OVERLAPPING/);
});


test('CLIENT: offline dated/undated additions retain independent scopes and reach a second receiver', async () => {
  await pg.exec(`reset role; insert into auth.users values('55555555-5555-4555-8555-555555555555');
    create or replace function auth.uid() returns uuid language sql stable as $$select '55555555-5555-4555-8555-555555555555'::uuid$$; set role authenticated;`);
  const y = { ...year, id:'add-year' };
  const ts = terms.slice(0,2).map(t => ({ ...t, id:`add-t${t.index}`, yearId:y.id }));
  await pg.exec(`insert into rakeezx.years(id,label,hijri_start,hijri_end,status) values('add-year','Synthetic',1448,1449,'active');
    insert into rakeezx.terms(id,year_id,name,"index",status) values('add-t1','add-year','One',1,'active'),('add-t2','add-year','Two',2,'upcoming');`);
  const selected = await mutate('years',y.id,'add-selection','patch',{calendar_preset_id:PRESET},1);
  Object.assign(y,decodeSyncV2Canonical('years',selected.canonical));
  store.state.years.push(y); store.state.terms.push(...ts);
  await db.put('years',y); await db.putMany('terms',ts);
  await pg.exec(`insert into rakeezx.terms(id,year_id,name,"index",status) values('canonical-extra','add-year','Extra',3,'upcoming');`);
  const extra = await store.createTerm({yearId:y.id,index:3,name:'Extra',status:'upcoming',startDate:'2027-07-05',endDate:'2027-07-15'});
  const undated = await store.createTerm({yearId:y.id,index:4,name:'Undated',status:'upcoming'});
  assert.equal((await db.get('terms',extra.id)).startDate,null);
  assert.equal(store.effectiveTerm(extra.id).startDate,'2027-07-05');
  const before = await db.getAll('outbox');
  await assert.rejects(store.createTerm({yearId:y.id,index:7,name:'Unsupported',status:'upcoming'}),/Invalid term identity: invalid-terms/);
  assert.deepEqual(await db.getAll('outbox'),before,'unsupported undated identity writes nothing');
  assert.ok(before.some(row => row.store==='terms' && row.recordId===extra.id));
  assert.ok(before.some(row => row.store==='calendars' && row.patch.term_date_overrides?.[extra.id]));
  db.closeDB(); assert.deepEqual(await db.getAll('outbox'),before);
  let fail = true;
  const engine = createSyncV2Engine({database:db,transport:{applyMutation: m => {
    if(fail) {fail=false;throw new Error('synthetic interrupted command');}
    return mutate(m.entity,m.recordId,m.mutationId,m.operation,m.patch,m.baseRevision);
  }}});
  assert.equal((await engine.dispatchPending()).failed,1);
  assert.ok((await db.getAll('outbox')).length);
  const retry = await engine.dispatchPending(); assert.equal(retry.failed,0); assert.equal(retry.blocked,0);
  assert.equal((await db.getAll('outbox')).length,0);
  const receivedTerms = (await pg.query(`select * from rakeezx.terms where year_id='add-year'`)).rows.map(r=>decodeSyncV2Canonical('terms',r));
  const receivedCalendars = (await pg.query(`select * from rakeezx.calendars where year_id='add-year'`)).rows.map(r=>decodeSyncV2Canonical('calendars',r));
  const scope = receivedCalendars.find(c=>c.presetId===PRESET);
  assert.deepEqual(scope.termDateOverrides['canonical-extra'],{startDate:'2027-07-05',endDate:'2027-07-15'});
  assert.equal(scope.termDateOverrides[extra.id],undefined);
  assert.equal(receivedTerms.find(t=>t.id==='canonical-extra').startDate,null);
  assert.equal(receivedTerms.find(t=>t.index===4).startDate,null);
  const input={year:y,terms:receivedTerms,presetId:PRESET,customizations:receivedCalendars.map(c=>({yearId:y.id,presetId:c.presetId,termDateOverrides:Object.entries(c.termDateOverrides).map(([termId,pair])=>({termId,...pair}))}))};
  const g=resolveCalendarRuntime(input),w=resolveCalendarRuntime({...input,presetId:'sa-western-1448-1449'});
  assert.equal(g.ok,true);assert.equal(w.ok,true);
  assert.equal(g.terms.find(t=>t.id==='canonical-extra').startDate,'2027-07-05');
  assert.equal(w.terms.find(t=>t.id==='canonical-extra').startDate,null);
  assert.deepEqual(resolveCalendarRuntime(input),g);assert.ok(undated.id);
});

test('CLIENT: offline selection/session/attendance uses exact acknowledged revision', async () => {
  store.state.years = await db.getAll('years'); store.state.terms = await db.getAll('terms'); store.state.calendars = await db.getAll('calendars');
  const W='sa-western-1448-1449';
  await pg.exec(`insert into rakeezx.subjects(id,name,slug) values('add-sub','Synthetic','synthetic');
    insert into rakeezx.sections(id,year_id,grade,label,name) values('add-sec','add-year',4,'A','Synthetic');
    insert into rakeezx.teachings(id,section_id,subject_id,term_id) values('add-teaching','add-sec','add-sub','add-t1');
    insert into rakeezx.students(id,name) values('add-student','Synthetic');
    insert into rakeezx.enrollments(id,student_id,section_id,start_date,status) values('add-enrollment','add-student','add-sec','2026-08-23','active');`);
  for(const [local,table] of [['subjects','subjects'],['sections','sections'],['teachings','teachings'],['students','students'],['enrollments','enrollments']]) {
    const records=(await pg.query(`select * from rakeezx.${table}`)).rows.map(r=>decodeSyncV2Canonical(local,r));
    await db.putMany(local,records);store.state[local]=records;
  }
  assert.equal((await store.applyCalendarPreset(W,{yearId:'add-year'})).ok,true);
  const timing = store.activeTimeProfile();
  const timingReceipt = await mutate('time_profiles',timing.id,'add-timing','create',encodeSyncV2Patch('timeProfiles',timing));
  const canonicalTiming = decodeSyncV2Canonical('timeProfiles',timingReceipt.canonical);
  await db.put('timeProfiles',canonicalTiming);
  store.state.timeProfiles = store.state.timeProfiles.map(row => row.id === canonicalTiming.id ? canonicalTiming : row);
  const session=await store.ensureSession('add-teaching','2026-10-04',1);
  const local=await db.get('sessions',session.id);
  assert.equal(local.calendarContext.presetId,W);assert.equal(local.calendarContext.selectionRevision,undefined);
  const engine=createSyncV2Engine({database:db,transport:{
    applyMutation:m=>mutate(m.entity,m.recordId,m.mutationId,m.operation,m.patch,m.baseRevision),
    applyAttendanceCommand:async m=>(await pg.query(`select rakeezx.apply_sync_v2_attendance_command($1,'probe',$2,$3,$4,$5,$6::jsonb,12) r`,[m.mutationId,m.attendanceId,m.sessionId,m.studentId,m.baseRevision,JSON.stringify(m.patch)])).rows[0].r,
  }});
  await engine.queueAttendanceCommand({attendanceId:'add-attendance',sessionId:session.id,studentId:'add-student',patch:{status:'present',note:''}});
  const queued=await db.getAll('outbox');
  assert.ok(queued.some(m=>m.store==='years'));assert.ok(queued.some(m=>m.store==='sessions'));assert.ok(queued.some(m=>m.command==='attendance:record'));
  const synced=await engine.dispatchPending();assert.equal(synced.failed,0);assert.equal(synced.blocked,0,JSON.stringify(await db.getAll('outbox')));
  assert.equal((await db.getAll('outbox')).length,0);
  const serverYear=(await pg.query(`select * from rakeezx.years where id='add-year'`)).rows[0];
  const serverSession=(await pg.query(`select * from rakeezx.sessions where id=$1`,[session.id])).rows[0];
  assert.equal(serverSession.calendar_context.selectionRevision,serverYear.field_revisions.calendar_selection);
  assert.deepEqual({...serverSession.calendar_context,selectionRevision:undefined},{...local.calendarContext,selectionRevision:undefined});
  assert.equal((await pg.query(`select status from rakeezx.attendance where student_id='add-student'`)).rows[0].status,'present');
});

test('TWO ISOLATED CLIENTS: canonical selection, nested dates and scoped exception CRUD converge', async () => {
  const receiver = new IsolatedIndexedDb('n58-receiver');
  const fetchRecords = async entity => (await pg.query(`select * from rakeezx.${entity}`)).rows;
  const transport = { fetchRecords, applyMutation:m=>mutate(m.entity,m.recordId,m.mutationId,m.operation,m.patch,m.baseRevision) };
  const a = createSyncV2Engine({database:db,transport});
  const b = createSyncV2Engine({database:receiver,transport});
  try {
    for (const name of ['years','terms','calendars','calendarDays','sessions','teachings']) await b.pullStore(name);
    assert.equal((await receiver.get('years','add-year')).calendarPresetId,'sa-western-1448-1449');
    assert.equal((await receiver.getAll('outbox')).length,0);
    await b.commitMutation({store:'years',recordId:'add-year',op:'patch',patch:{calendarPresetId:PRESET}});
    assert.equal((await b.dispatchPending()).failed,0);
    await a.pullStore('years');
    assert.equal((await db.get('years','add-year')).calendarPresetId,PRESET);
    const scope = (await receiver.getAll('calendars')).find(c=>c.yearId==='add-year' && c.presetId===PRESET);
    await b.commitMutation({store:'calendars',recordId:scope.id,op:'patch',patch:{termDateOverrides:{'canonical-extra':{startDate:'2027-07-07',endDate:'2027-07-17'}}}});
    assert.equal((await b.dispatchPending()).failed,0);
    await a.pullStore('calendars');
    assert.equal((await db.get('calendars',scope.id)).termDateOverrides['canonical-extra'].startDate,'2027-07-07');
    await b.commitMutation({store:'calendarDays',recordId:'receiver-exception',op:'create',create:{id:'receiver-exception',calendarId:scope.id,date:'2026-10-05',kind:'suspension',label:'Synthetic scoped'}});
    assert.equal((await b.dispatchPending()).failed,0); await a.pullStore('calendarDays');
    assert.equal((await db.get('calendarDays','receiver-exception')).kind,'suspension');
    await b.commitMutation({store:'calendarDays',recordId:'receiver-exception',op:'patch',patch:{kind:'remote',label:'Edited'}});
    assert.equal((await b.dispatchPending()).failed,0); await a.pullStore('calendarDays');
    assert.equal((await db.get('calendarDays','receiver-exception')).kind,'remote');
    await b.commitMutation({store:'calendarDays',recordId:'receiver-exception',op:'delete'});
    assert.equal((await b.dispatchPending()).failed,0); await a.pullStore('calendarDays');
    assert.equal((await db.get('calendarDays','receiver-exception')).deleted,true);
    receiver.close(); assert.equal((await receiver.get('calendarDays','receiver-exception')).deleted,true);
    // A failed later page must not hydrate even the first page over local intent.
    const before = await db.getAll('years');
    const failing = createSyncV2Engine({database:db,transport:{fetchRecords:()=>readCompleteTable({ownerId:'55555555-5555-4555-8555-555555555555',pageSize:1,fetchPage:async ({offset})=>{
      if(offset) throw new Error('synthetic later-page failure');
      return {data:[{...(await fetchRecords('years'))[0],label:'Must not hydrate'}],contentRange:'0-0/2'};
    }})}});
    await assert.rejects(failing.pullStore('years'),/later-page failure/);
    assert.deepEqual(await db.getAll('years'),before);
    assert.equal((await receiver.getAll('outbox')).length,0);
  } finally { receiver.close(); }
});

test('STALE PRECONDITION: session and attendance intent survive rejection without relabeling', async () => {
  for (const name of ['years','terms','calendars']) store.state[name]=await db.getAll(name);
  const session = await store.ensureSession('add-teaching','2026-10-06',1);
  const factual = structuredClone((await db.get('sessions',session.id)).calendarContext);
  const calls=[]; let raced=false;
  const engine=createSyncV2Engine({database:db,transport:{applyMutation:async m=>{
    calls.push(structuredClone(m));
    if(m.entity==='sessions' && !raced) {
      raced=true;
      const row=(await pg.query(`select revision from rakeezx.years where id='add-year'`)).rows[0];
      await mutate('years','add-year','other-client-switch','patch',{calendar_preset_id:'sa-western-1448-1449'},row.revision);
    }
    return mutate(m.entity,m.recordId,m.mutationId,m.operation,m.patch,m.baseRevision);
  },applyAttendanceCommand:()=>{throw new Error('dependent attendance must not dispatch');}}});
  await engine.queueAttendanceCommand({attendanceId:'stale-attendance',sessionId:session.id,studentId:'add-student',patch:{status:'present'}});
  const first=await engine.dispatchPending();assert.equal(first.failed,1);assert.equal(first.blocked,1);
  const pending=await db.getAll('outbox');assert.equal(pending.length,2);
  assert.match(pending.find(m=>m.store==='sessions').lastError.message,/N58_STALE_CALENDAR_SELECTION/);
  assert.deepEqual((await db.get('sessions',session.id)).calendarContext,factual);
  db.closeDB();assert.deepEqual(await db.getAll('outbox'),pending);
  await engine.dispatchPending();
  assert.deepEqual(calls[1],calls[0],'locked transport context/revision retained on retry');
  assert.equal((await pg.query(`select count(*)::int n from rakeezx.sessions where id=$1`,[session.id])).rows[0].n,0);
  assert.equal((await pg.query(`select count(*)::int n from rakeezx.attendance where id='stale-attendance'`)).rows[0].n,0);
  assert.equal((await db.getAll('outbox')).length,2);
});

test('OLD SELECTED-PRESET SESSION: locked rejection survives unrelated Sync, reload and candidate upgrade', async () => {
  const client = new IsolatedIndexedDb('n58-old-session-rejection');
  const sessionId = 'old-contextless-session';
  const yearId = 'probe-year';
  const teachingId = 'old-session-teaching';
  const calls = [];
  const transport = { applyMutation: async mutation => {
    calls.push(structuredClone(mutation));
    return mutate(mutation.entity,mutation.recordId,mutation.mutationId,mutation.operation,mutation.patch,mutation.baseRevision);
  } };
  const oldSender = createSyncV2Engine({database:client,transport});
  try {
    await pg.exec(`reset role;
      create or replace function auth.uid() returns uuid language sql stable as $$select '${OWNER}'::uuid$$;
      set role authenticated;
      insert into rakeezx.subjects(id,name,slug)
      values('old-session-subject','Synthetic','old-session-subject');
      insert into rakeezx.sections(id,year_id,grade,label,name)
      values('old-session-section','${yearId}',4,'A','Synthetic');
      insert into rakeezx.teachings(id,section_id,subject_id,term_id)
      values('${teachingId}','old-session-section','old-session-subject','probe-t1');`);
    assert.equal((await pg.query('select calendar_preset_id from rakeezx.years where id=$1',[yearId])).rows[0].calendar_preset_id,PRESET);
    const teaching=(await pg.query('select * from rakeezx.teachings where id=$1',[teachingId])).rows[0];
    await client.applyBatch({teachings:{put:[decodeSyncV2Canonical('teachings',teaching)]}});
    const serverBefore=(await pg.query('select id,calendar_context from rakeezx.sessions order by id')).rows;
    const old=await oldSender.commitMutation({store:'sessions',recordId:sessionId,op:'create',
      patch:{teachingId,date:'2026-10-09',period:1}});
    assert.equal(Object.hasOwn(old.mutation.patch,'calendar_context'),false,'old sender omitted creation-time provenance');
    const rejected=await oldSender.dispatchPending();
    assert.deepEqual(rejected,{attempted:1,acknowledged:0,failed:0,blocked:1});
    const locked=(await client.getAll('outbox'))[0];
    assert.equal(locked.state,'rejected');
    assert.equal(locked.envelopeLocked,true);
    assert.equal(locked.attemptCount,1);
    assert.match(locked.lastError.message,/N58_SESSION_CONTEXT_REQUIRED/);
    assert.equal(Object.hasOwn(locked.patch,'calendar_context'),false);
    assert.equal((await oldSender.status()).state,'rejected');
    assert.equal((await oldSender.status()).rejected,1);
    assert.deepEqual((await pg.query('select id,calendar_context from rakeezx.sessions order by id')).rows,serverBefore);

    await oldSender.commitMutation({store:'students',recordId:'old-session-unrelated-student',op:'create',patch:{name:'Unrelated synthetic'}});
    const unrelated=await oldSender.dispatchPending();
    assert.equal(unrelated.acknowledged,1);
    assert.equal(unrelated.failed,0);
    assert.equal((await pg.query("select count(*)::int n from rakeezx.students where id='old-session-unrelated-student'")).rows[0].n,1);
    assert.deepEqual(await client.get('outbox',locked.id),locked,'unrelated success does not clear or alter rejection');
    assert.equal((await oldSender.status()).rejected,1);

    client.close(); // Reload the same durable fake IndexedDB with the candidate engine.
    const upgraded=createSyncV2Engine({database:client,transport});
    assert.deepEqual(await client.get('outbox',locked.id),locked);
    assert.equal((await upgraded.status()).state,'rejected');
    assert.equal((await upgraded.status()).rejected,1);
    assert.deepEqual(await upgraded.dispatchPending(),{attempted:0,acknowledged:0,failed:0,blocked:1});
    assert.deepEqual(await client.get('outbox',locked.id),locked,'upgrade neither retries nor invents context');
    assert.equal(calls.filter(call=>call.recordId===sessionId).length,1);
    assert.deepEqual((await pg.query('select id,calendar_context from rakeezx.sessions order by id')).rows,serverBefore);
  } finally { client.close(); }
});
