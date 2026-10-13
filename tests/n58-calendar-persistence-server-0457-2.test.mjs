import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { installRealtimeFixture } from './helpers/realtime-server-fixture.mjs';
import { CALENDAR_PRESETS } from '../src/lib/calendar-presets.js';
import { buildAccountFoundationDefaults } from '../src/lib/account-provisioning.js';

// Pinned N58 migration snapshot; later independent server migrations are outside this local contract.
// Disposable PostgreSQL SQL/RPC tests. Auth and Realtime are synthetic fixtures;
// this is NOT PostgREST HTTP, a live Supabase test, or browser certification.
const A='11111111-1111-4111-8111-111111111111';
const B='22222222-2222-4222-8222-222222222222';
const G='sa-general-1448-1449', W='sa-western-1448-1449';
const HEAD='20261004070002_n58_effective_scope_revalidation.sql';
let pg, beforeHistory, migrations;
const query = async (sql,args=[]) => (await pg.query(sql,args)).rows;
const row = async (table,id) => (await query(`select to_jsonb(t) r from rakeezx.${table} t where owner_id=auth.uid() and id=$1`,[id]))[0]?.r;
const use = async owner => { await pg.exec('reset role'); await pg.query('update auth.current_identity set id=$1',[owner]); await pg.exec('set role authenticated'); };
const mutate = async (entity,id,mutation,operation,patch={},base=0) => (await query(
  `select rakeezx.apply_sync_v2_mutation($1,$2,$3,'synthetic', $4,$5::jsonb,$6,10) r`,
  [entity,id,mutation,base,JSON.stringify(patch),operation]))[0].r;
const context = async (preset=G) => ({yearId:'y',termId:'t1',presetId:preset,
  selectionRevision:(await row('years','y')).field_revisions.calendar_selection,kind:'study',label:'Synthetic',source:'default'});
const history = async () => ({ sessions:await query('select to_jsonb(t) r from rakeezx.sessions t order by id'),
  attendance:await query('select to_jsonb(t) r from rakeezx.attendance t order by id'),
  logs:await query('select to_jsonb(t) r from rakeezx.logs t order by id'),
  rosters:await query('select to_jsonb(t) r from rakeezx.session_roster_snapshots t order by id') });
const manifest = async (v5=false) => (await query(`select rakeezx.${v5?'sync_v2_restore_manifest_score_v2':'sync_v2_restore_manifest_full'}(auth.uid()) r`))[0].r;
async function restore(id,operations,v5=false) {
  const source=await manifest(v5), hash='a'.repeat(64);
  const stage=(await query(`select rakeezx.${v5?'stage_sync_v2_restore_score_v2':'stage_sync_v2_restore'}($1,$2,$3,$4::jsonb,$5::jsonb) r`,
    [id,hash,v5?5:4,JSON.stringify(source),JSON.stringify(operations)]))[0].r;
  const finalize=async ()=>(await query(`select rakeezx.${v5?'finalize_sync_v2_restore_score_v2':'finalize_sync_v2_restore'}($1,$2,$3) r`,[id,hash,stage.stageHash]))[0].r;
  return {stage,finalize};
}

before(async () => {
  pg=new PGlite();
  await pg.exec(`create schema auth; create role authenticated; create role anon; create role service_role;
    create table auth.users(id uuid primary key); insert into auth.users values('${A}'),('${B}');
    create table auth.current_identity(id uuid); insert into auth.current_identity values('${A}');
    create function auth.uid() returns uuid language sql stable security definer set search_path='' as
      $$select id from auth.current_identity limit 1$$;
    grant usage on schema auth to authenticated,anon;`);
  await installRealtimeFixture(pg);
  const directory=new URL('../supabase/migrations/',import.meta.url);
  migrations=(await readdir(directory)).filter(name => name.endsWith('.sql') && name <= '20261004070002_n58_effective_scope_revalidation.sql').sort();
  const n58 = migrations.filter(name => name.includes('_n58_'));
  assert.equal(migrations.length,41); assert.equal(n58.at(-1),HEAD); assert.equal(migrations.at(-1),HEAD);
  for(const name of migrations.filter(name => !n58.includes(name))) await pg.exec((await readFile(new URL(name,directory),'utf8')).replace(/^\uFEFF/,''));
  await pg.exec(`insert into rakeezx.years(id,label,hijri_start,hijri_end,status) values('y','Synthetic',1448,1449,'active');
    insert into rakeezx.calendars(id,year_id,source,label) values('legacy','y','custom','Unattributed'),('official','y','moe','Official');
    insert into rakeezx.calendar_days(id,calendar_id,date,kind,label) values
      ('legacy-day','legacy','2026-10-01','holiday','Unattributed'),('official-day','official','2026-09-23','national','Official');
    insert into rakeezx.terms(id,year_id,name,"index",start_date,end_date,status,calendar_id) values
      ('t1','y','One',1,'2026-08-30','2027-01-07','active','official'),
      ('t2','y','Two',2,'2027-01-17','2027-07-01','upcoming','official');
    insert into rakeezx.subjects(id,name,slug) values('subject','Synthetic','synthetic');
    insert into rakeezx.sections(id,year_id,grade,label,name) values('section','y',4,'A','Synthetic');
    insert into rakeezx.teachings(id,section_id,subject_id,term_id) values('teaching','section','subject','t1');
    insert into rakeezx.students(id,name,status) values('student','Synthetic','active');
    insert into rakeezx.enrollments(id,student_id,section_id,roll_no,start_date,status) values('en','student','section',1,'2026-08-01','active');
    insert into rakeezx.sessions(id,teaching_id,date,period,status) values('history','teaching','2026-09-06',1,'held');
    insert into rakeezx.attendance(id,student_id,session_id,teaching_id,date,status) values('att','student','history','teaching','2026-09-06','present');
    insert into rakeezx.logs(id,student_id,teaching_id,session_id,date,kind,delta) values('log','student','teaching','history','2026-09-06','participation',1);
    insert into rakeezx.calendar_days(id,calendar_id,date,kind,label,deleted_at) values('dead-day','legacy','2026-10-02','event','Historical tombstone',now());`);
  beforeHistory=await history();
  for(const name of n58) await pg.exec(await readFile(new URL(name,directory),'utf8'));
  await use(A);
});
after(async()=>{await pg?.close();});

test('N58 after the current N03 schema preserves existing history without enrollment/backfill',async()=>{
  const afterHistory=await history();
  afterHistory.sessions.forEach(({r})=>{assert.equal(r.calendar_context,null);delete r.calendar_context;});
  assert.deepEqual(afterHistory,beforeHistory);
  assert.equal((await row('years','y')).calendar_preset_id,null);
  assert.equal((await row('calendars','legacy')).preset_id,null);
  assert.deepEqual((await row('calendars','legacy')).term_date_overrides,{});
  assert.ok((await row('calendar_days','dead-day')).deleted_at);
});

test('resulting maps retain score fields and add coherent Calendar groups',async()=>{
  const map=async entity=>(await query('select rakeezx.sync_v2_field_map($1) m',[entity]))[0].m;
  assert.equal((await map('years')).calendar_preset_id,'calendar_selection');
  assert.equal((await map('calendars')).term_date_overrides,'term_dates');
  assert.equal((await map('calendars')).preset_id,'identity');
  assert.equal((await map('sessions')).calendar_context,'identity');
  assert.ok((await map('items')).score_mode); assert.ok(await map('score_subitems'));
});

test('supported selection is owner-derived, retryable, revisioned and history-silent',async()=>{
  const before=await history();
  const first=await mutate('years','y','select-g','patch',{calendar_preset_id:G},1);
  assert.equal(first.outcome,'applied');
  assert.deepEqual(await mutate('years','y','select-g','patch',{calendar_preset_id:G},1),first);
  assert.deepEqual(await history(),before);
  assert.equal((await row('years','y')).calendar_preset_id,G);
  await assert.rejects(mutate('years','y','select-invalid','patch',{calendar_preset_id:'general'},2),/N58_UNSUPPORTED_YEAR_PRESET/);
  await assert.rejects(pg.exec(`insert into rakeezx.years(id,label,hijri_start,hijri_end,calendar_preset_id) values('wrong','Wrong',1450,1451,'${G}')`),/N58_UNSUPPORTED_YEAR_PRESET/);
  await assert.rejects(pg.exec('update rakeezx.years set calendar_preset_id=null where id=\'y\''),/N58_SELECTED_YEAR_IDENTITY_BLOCKED/);
  await assert.rejects(pg.exec("update rakeezx.years set hijri_start=1450 where id='y'"),/N58_UNSUPPORTED_YEAR_PRESET/);
});

test('General and Western scopes coexist with legacy and canonicalize independently',async()=>{
  for(const [id,preset] of [['g',G],['w',W]]) {
    const patch={year_id:'y',source:'custom',preset_id:preset,label:id};
    assert.equal((await mutate('calendars',id,`create-${id}`,'create',patch)).outcome,'applied');
    const duplicate=await mutate('calendars',`${id}-other`,`canonical-${id}`,'create',patch);
    assert.equal(duplicate.outcome,'canonicalized');
    assert.equal(duplicate.canonical.id,id);
    await mutate('calendar_days',`day-${id}`,`day-create-${id}`,'create',{calendar_id:id,date:'2026-11-29',kind:id==='g'?'holiday':'study',label:id});
  }
  assert.equal((await query("select count(*)::int n from rakeezx.calendars where year_id='y'"))[0].n,4);
  assert.equal((await row('calendar_days','day-g')).kind,'holiday');
  assert.equal((await row('calendar_days','day-w')).kind,'study');
  await assert.rejects(pg.exec(`insert into rakeezx.calendars(id,year_id,source,preset_id) values('duplicate','y','custom','${G}')`),/calendars_preset_source_uniq/);
  await assert.rejects(pg.exec(`insert into rakeezx.calendars(id,year_id,source,preset_id) values('bad-scope','y','moe','${G}')`),/N58_INVALID_CUSTOM_SCOPE/);
});

test('identity cannot be reassigned through SQL or Sync',async()=>{
  await assert.rejects(pg.exec(`update rakeezx.calendars set preset_id='${W}' where id='g'`),/N58_IMMUTABLE_CALENDAR_SCOPE/);
  await assert.rejects(mutate('calendars','g','scope-reassign','patch',{preset_id:W},1),/N58_IMMUTABLE_CALENDAR_SCOPE/);
  await assert.rejects(pg.exec("update rakeezx.calendar_days set calendar_id='w' where id='day-g'"),/N58_IMMUTABLE_DAY_IDENTITY/);
  await assert.rejects(pg.exec("update rakeezx.terms set \"index\"=3 where id='t1'"),/N58_IMMUTABLE_TERM_IDENTITY/);
  await assert.rejects(pg.exec(`update rakeezx.calendars set owner_id='${B}' where id='g'`),/N58_IMMUTABLE_RECORD_IDENTITY/);
});

test('overrides validate existing same-year terms, complete dates and effective nonoverlap',async()=>{
  for(const value of [null,[],{unknown:{start_date:'2026-08-23',end_date:'2027-01-07'}},
    {t1:{start_date:'2026-08-23'}},{t1:null},{t1:{start_date:'2026-02-30',end_date:'2027-01-07'}},
    {t1:{start_date:'2027-01-08',end_date:'2027-01-07'}},
    {t1:{start_date:'2026-08-23',end_date:'2027-01-17'}},
    {t2:{start_date:'2027-01-07',end_date:'2027-06-24'}},
    {t1:{start_date:'2026-08-23',end_date:'2027-01-07',extra:true}}]) {
    await assert.rejects(pg.query("update rakeezx.calendars set term_date_overrides=$1::jsonb where id='g'",[JSON.stringify(value)]),/N58_INVALID|N58_OVERLAPPING|not-null/);
  }
  const value={t1:{start_date:'2026-08-24',end_date:'2027-01-10'},t2:{start_date:'2027-01-18',end_date:'2027-06-25'}};
  const result=await mutate('calendars','g','overrides','patch',{term_date_overrides:value},1);
  assert.equal(result.outcome,'applied');assert.deepEqual((await row('calendars','g')).term_date_overrides,value);
});

test('override object is replaced atomically; stale group conflicts retain independent labels',async()=>{
  const stale=await mutate('calendars','g','stale-overrides','patch',{
    term_date_overrides:{t1:{start_date:'2026-09-01',end_date:'2027-01-01'}},label:'Independent'},1);
  assert.equal(stale.outcome,'applied_with_conflicts');assert.deepEqual(stale.conflictedGroups,['term_dates']);
  assert.equal((await row('calendars','g')).label,'Independent');
  assert.ok((await row('calendars','g')).term_date_overrides.t2);
  const base=(await row('calendars','g')).revision;
  await mutate('calendars','g','remove-t1','patch',{term_date_overrides:{t2:{start_date:'2027-01-18',end_date:'2027-06-25'}}},base);
  assert.equal((await row('calendars','g')).term_date_overrides.t1,undefined);
  await mutate('calendars','g','remove-all','patch',{term_date_overrides:{}},(await row('calendars','g')).revision);
  assert.deepEqual((await row('calendars','g')).term_date_overrides,{});
});

test('minimal SQL default bounds agree with each existing catalog, including one-sided overrides',async()=>{
  for(const preset of CALENDAR_PRESETS) {
    const id=preset.id===G?'g':'w',first=preset.terms.find(t=>t.index===1),second=preset.terms.find(t=>t.index===2);
    const update=value=>pg.query('update rakeezx.calendars set term_date_overrides=$1::jsonb where id=$2',[JSON.stringify(value),id]);
    await update({t1:{start_date:first.startDate,end_date:first.endDate},t2:{start_date:second.startDate,end_date:second.endDate}});
    await assert.rejects(update({t1:{start_date:first.startDate,end_date:second.startDate}}),/N58_OVERLAPPING/);
    await assert.rejects(update({t2:{start_date:first.endDate,end_date:second.endDate}}),/N58_OVERLAPPING/);
    await update({});
  }
});

test('old REST and generic RPC writes cannot reseed, retire or bypass scoped overrides',async()=>{
  const probes=["update rakeezx.calendars set deleted_at=now() where id='official'",
    "delete from rakeezx.calendars where id='official'","delete from rakeezx.years where id='y'",
    "update rakeezx.years set deleted_at=now() where id='y'",
    "update rakeezx.calendar_days set kind='study' where id='official-day'",
    "insert into rakeezx.calendar_days(id,calendar_id,date,kind) values('unscoped','legacy','2026-12-01','study')",
    "delete from rakeezx.calendar_days where id='legacy-day'",
    "update rakeezx.terms set start_date='2026-09-01' where id='t1'",
    "update rakeezx.terms set calendar_id='g' where id='t1'",
    "update rakeezx.terms set deleted_at=now() where id='t1'",
    "insert into rakeezx.sessions(id,teaching_id,date,period) values('missing-context','teaching','2026-10-04',1)"];
  for(const sql of probes) await assert.rejects(pg.exec(sql),/N58_|permission denied/);
  await assert.rejects(mutate('calendar_days','official-day','old-reseed','delete',{},(await row('calendar_days','official-day')).revision),/N58_UNSCOPED_DAY_WRITE_BLOCKED/);
  await assert.rejects(mutate('terms','t1','old-dates','patch',{start_date:'2026-09-01'},(await row('terms','t1')).revision),/N58_USE_SCOPED_TERM_OVERRIDES/);
  await assert.rejects(mutate('sessions','old-new','old-generate','create',{teaching_id:'teaching',date:'2026-10-05',period:1}),/N58_SESSION_CONTEXT_REQUIRED/);
});

test('old client rejection leaves no receipt and a corrected retry can recover',async()=>{
  const id='old-client-retry',mutation='old-client-create',base={teaching_id:'teaching',date:'2026-10-08',period:1};
  await assert.rejects(mutate('sessions',id,mutation,'create',base),/N58_SESSION_CONTEXT_REQUIRED/);
  assert.equal(await row('sessions',id),undefined);
  assert.equal((await query('select count(*)::int n from rakeezx.sync_mutation_receipts where owner_id=auth.uid() and mutation_id=$1',[mutation]))[0].n,0);
  const recorded={...await context(),kind:'holiday',source:'custom',label:'Historical client observation'};
  assert.equal((await mutate('sessions',id,mutation,'create',{...base,calendar_context:recorded})).outcome,'applied');
  assert.deepEqual((await row('sessions',id)).calendar_context,recorded);
});

test('valid context is immutable, bound to owner/year/term and authoritative selection revision',async()=>{
  const ctx=await context();
  for(const bad of [{...ctx,yearId:'other'},{...ctx,termId:'t2'},{...ctx,presetId:W},{...ctx,selectionRevision:1},
    {...ctx,selectionRevision:'2'},{...ctx,selectionRevision:2.5},{...ctx,source:'unknown'},{...ctx,kind:'unknown'},
    {...ctx,label:null},{...ctx,extra:true},{}]) {
    await assert.rejects(mutate('sessions','bad-context',`invalid-${JSON.stringify(bad)}`,'create',{
      teaching_id:'teaching',date:'2026-10-06',period:1,calendar_context:bad}),/N58_INVALID_SESSION_CONTEXT|N58_STALE_CALENDAR_SELECTION/);
  }
  assert.equal((await mutate('sessions','new','create-context','create',{
    teaching_id:'teaching',date:'2026-10-06',period:1,calendar_context:ctx})).outcome,'applied');
  await assert.rejects(pg.exec("update rakeezx.sessions set calendar_context=null where id='new'"),/N58_IMMUTABLE_SESSION_CONTEXT/);
  await assert.rejects(mutate('sessions','history','backfill','patch',{calendar_context:ctx},1),/N58_IMMUTABLE_SESSION_CONTEXT/);
  await assert.rejects(pg.exec("update rakeezx.sessions set date='2026-10-07' where id='new'"),/N58_IMMUTABLE_SESSION_IDENTITY/);
});

test('selection switching does not touch sessions; stale generation rejects while label edits do not',async()=>{
  const before=await history(),old=await context();
  const base=(await row('years','y')).revision;
  await mutate('years','y','switch-w','patch',{calendar_preset_id:W},base);
  assert.deepEqual(await history(),before);
  await assert.rejects(mutate('sessions','stale','stale-new','create',{
    teaching_id:'teaching',date:'2026-10-07',period:1,calendar_context:old}),/N58_STALE_CALENDAR_SELECTION/);
  const current=await context(W);
  await mutate('years','y','year-label','patch',{label:'Independent'},(await row('years','y')).revision);
  assert.equal((await mutate('sessions','new-w','new-western','create',{
    teaching_id:'teaching',date:'2026-10-07',period:1,calendar_context:current})).outcome,'applied');
  const conflict=await mutate('years','y','stale-selection','patch',{calendar_preset_id:G},base);
  assert.equal(conflict.outcome,'conflict'); assert.equal((await row('years','y')).calendar_preset_id,W);
});

test('explicit status/reason and attendance commands remain available on historical sessions',async()=>{
  const result=await mutate('sessions','history','history-status','patch',{status:'held',reason:'Explicit'},1);
  assert.equal(result.outcome,'applied');assert.equal((await row('sessions','history')).calendar_context,null);
  const attendance=(await query(`select rakeezx.apply_sync_v2_attendance_command(
    'safe-attendance','synthetic','att','history','student',$1,'{"status":"late"}'::jsonb,11) r`,[(await row('attendance','att')).revision]))[0].r;
  assert.ok(attendance);
  assert.equal((await row('attendance','att')).status,'late');
  assert.equal((await row('logs','log')).delta,1);
});

test('moving historical sessions or Teaching parents to an unselected year cannot bypass identity guards',async()=>{
  await pg.exec(`insert into rakeezx.years(id,label,hijri_start,hijri_end) values('legacy-year','Synthetic',1450,1451);
    insert into rakeezx.terms(id,year_id,name,"index") values('legacy-term','legacy-year','Synthetic',1);
    insert into rakeezx.sections(id,year_id,grade,label,name) values('legacy-section','legacy-year',4,'B','Synthetic');
    insert into rakeezx.teachings(id,section_id,subject_id,term_id) values('legacy-teaching','legacy-section','subject','legacy-term');`);
  const prior=await row('sessions','history');
  await assert.rejects(pg.exec("update rakeezx.sessions set teaching_id='legacy-teaching' where id='history'"),/N58_IMMUTABLE_SESSION_IDENTITY/);
  await assert.rejects(pg.exec("update rakeezx.teachings set section_id='legacy-section',term_id='legacy-term' where id='teaching'"),/N58_IMMUTABLE_TEACHING_PARENT/);
  await assert.rejects(pg.exec("update rakeezx.sections set year_id='legacy-year' where id='section'"),/N58_IMMUTABLE_TEACHING_PARENT/);
  assert.deepEqual(await row('sessions','history'),prior);
});

test('Calendar tombstones are permanent; scoped days retain renewed-ID lifecycle',async()=>{
  await mutate('calendar_days','day-g','delete-g-day','delete',{},(await row('calendar_days','day-g')).revision);
  assert.equal((await mutate('calendar_days','day-g-renewed','renew-day','create',{
    calendar_id:'g',date:'2026-11-29',kind:'remote',label:'Renewed'})).outcome,'applied');
  assert.equal((await mutate('calendar_days','day-g','dead-retry','patch',{kind:'study'},1)).outcome,'tombstoned');
  await mutate('calendars','w','delete-w-calendar','delete',{},(await row('calendars','w')).revision);
  assert.equal((await mutate('calendars','w-new','no-reuse-calendar','create',{year_id:'y',source:'custom',preset_id:W})).outcome,'tombstoned');
});

test('V4 and V5 canonical restore preserve omitted fields, context and tombstones',async()=>{
  const prior={year:await row('years','y'),cal:await row('calendars','g'),session:await row('sessions','new'),dead:await row('calendars','w')};
  for(const v5 of [false,true]) {
    const staged=await restore(`safe-${v5}`,[{entity:'years',recordId:'y',operation:'patch',baseRevision:(await row('years','y')).revision,
      patch:{label:`Restored-${v5}`},clientUpdatedAt:12},
      {entity:'sessions',recordId:'new',operation:'patch',baseRevision:(await row('sessions','new')).revision,
        patch:{note:`Restored-${v5}`},clientUpdatedAt:12},
      {entity:'calendars',recordId:'g',operation:'patch',baseRevision:(await row('calendars','g')).revision,
        patch:{term_date_overrides:{t1:{start_date:'2026-08-25',end_date:'2027-01-07'}}},clientUpdatedAt:12} ],v5);
    const result=await staged.finalize();assert.deepEqual(await staged.finalize(),result);
    assert.equal(result.canonical.years.find(r=>r.id==='y').calendar_preset_id,W);
    assert.deepEqual(result.canonical.sessions.find(r=>r.id==='new').calendar_context,prior.session.calendar_context);
    assert.equal(result.canonical.calendars.find(r=>r.id==='g').preset_id,G);
    assert.deepEqual(result.canonical.calendars.find(r=>r.id==='w'),prior.dead);
  }
  assert.deepEqual((await row('sessions','new')).calendar_context,prior.session.calendar_context);
  assert.equal((await row('sessions','new')).date,prior.session.date);
});

test('old restore bypasses roll back atomically and cannot erase configuration',async()=>{
  for(const v5 of [false,true]) {
    for(const [entity,id,patch] of [['years','y',{calendar_preset_id:null}],['terms','t1',{start_date:'2026-09-01'}],
      ['calendar_days','official-day',{kind:'study'}],['sessions','new',{calendar_context:null}]]) {
      const prior=await row(entity,id);
      const staged=await restore(`unsafe-${v5}-${entity}`,[{entity,recordId:id,operation:'patch',baseRevision:prior.revision,patch,clientUpdatedAt:13}],v5);
      await assert.rejects(staged.finalize(),/N58_/);assert.deepEqual(await row(entity,id),prior);
    }
    const before=await history();
    const staged=await restore(`unsafe-new-${v5}`,[{entity:'sessions',recordId:'restore-unscoped',operation:'create',baseRevision:0,
      patch:{teaching_id:'teaching',date:'2026-10-08',period:1},clientUpdatedAt:13}],v5);
    await assert.rejects(staged.finalize(),/N58_SESSION_CONTEXT_REQUIRED/);assert.deepEqual(await history(),before);
  }
  await assert.rejects(pg.exec('select * from rakeezx.n58_restore_transactions'),/permission denied/);
  await assert.rejects(pg.exec(`insert into rakeezx.n58_restore_transactions values('${A}',txid_current(),'forged')`),/permission denied/);
});

test('fresh V5 backup restore retains stable IDs and older recorded preset without guessed backfill',async()=>{
  const canonical=(await query('select rakeezx.sync_v2_restore_canonical_score_v2(auth.uid()) r'))[0].r;
  const entities=['years','calendars','terms','subjects','sections','teachings','students','enrollments','sessions','attendance','logs','calendar_days'];
  const operations=[];
  for(const entity of entities) {
    const map=(await query('select rakeezx.sync_v2_field_map($1) m',[entity]))[0].m;
    for(const record of canonical[entity]) {
      // Legacy/scoped tombstones survive create_deleted via existing finalizer.
      operations.push({entity,recordId:record.id,operation:record.deleted_at?'create_deleted':'create',baseRevision:0,
        patch:Object.fromEntries(Object.keys(map).filter(k=>Object.hasOwn(record,k)).map(k=>[k,record[k]])),clientUpdatedAt:record.client_updated_at??0});
    }
  }
  await use(B);
  const staged=await restore('fresh-v5',operations,true);
  const result=await staged.finalize();
  for(const entity of ['years','terms','teachings','sessions','attendance','logs','calendar_days']) {
    assert.deepEqual(result.canonical[entity].map(r=>r.id).sort(),canonical[entity].map(r=>r.id).sort());
  }
  assert.equal((await row('years','y')).calendar_preset_id,W);
  assert.deepEqual((await row('sessions','new')).calendar_context,canonical.sessions.find(r=>r.id==='new').calendar_context);
  assert.equal((await row('sessions','history')).calendar_context,null);
  assert.equal((await row('attendance','att')).status,'late');
  assert.ok((await row('calendars','w')).deleted_at);
  await use(A);
});

test('A/B RLS, owner FKs and SECURITY DEFINER ACL/search_path remain hardened',async()=>{
  await use(B);
  assert.equal((await query("select count(*)::int n from rakeezx.years where owner_id=$1",[A]))[0].n,0);
  assert.equal((await query("update rakeezx.years set label='Intrusion' where owner_id=$1 returning id",[A])).length,0);
  await assert.rejects(query('select rakeezx.sync_v2_restore_canonical_score_v2($1)',[A]),/owner mismatch/i);
  await assert.rejects(query(`insert into rakeezx.calendars(id,owner_id,year_id,preset_id) values('cross-owner',$1,'a-only',$2)`,[A,G]),/N58_INVALID_CUSTOM_SCOPE|foreign key/);
  await assert.rejects(query(`update rakeezx.calendars set term_date_overrides=$1::jsonb where id='g'`,[JSON.stringify({'a-only-term':{start_date:'2026-08-23',end_date:'2027-01-07'}})]),/N58_INVALID_TERM_OVERRIDE_PAIR/);
  await use(A);
  const functions=await query(`select p.proname,p.proconfig from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='rakeezx' and p.prosecdef and (p.proname like 'n58_%' or p.proname in
      ('sync_v2_field_map','sync_v2_natural_key','finalize_sync_v2_restore','finalize_sync_v2_restore_score_v2'))`);
  assert.ok(functions.length>=7);for(const fn of functions) assert.ok(fn.proconfig.some(v=>/^search_path=(""|)$/.test(v)),fn.proname);
  for(const [signature,allowed] of [['sync_v2_field_map(text)',true],['sync_v2_natural_key(text,jsonb)',false],
    ['sync_v2_field_map_before_n58(text)',false],['n58_guard_calendar_contract()',false],
    ['n58_restore_creating_year(uuid,text)',false],['n58_validate_effective_year(uuid,text)',false],
    ['n58_revalidate_effective_scope_change()',false],['finalize_sync_v2_restore_before_n58(text,text,text)',false],
    ['finalize_sync_v2_restore_score_v2_before_n58(text,text,text)',false]]) {
    const acl=(await query(`select has_function_privilege('authenticated',$1,'execute') a,has_function_privilege('anon',$1,'execute') n`,[`rakeezx.${signature}`]))[0];
    assert.equal(acl.a,allowed,signature);assert.equal(acl.n,false,signature);
  }
  await pg.exec('set role anon');
  await assert.rejects(pg.exec("select rakeezx.sync_v2_field_map('years')"),/permission denied/);
  await assert.rejects(pg.exec('select * from rakeezx.years'),/permission denied/);
  await use(A);
});

test('actual provisioning stays unselected; READY retry/snapshot cannot erase N58 fields',async()=>{
  const C='33333333-3333-4333-8333-333333333333';
  await pg.exec(`reset role; insert into auth.users values('${C}')`); await use(C);
  await query('select rakeezx.provision_account_profile()');
  await query("select rakeezx.complete_account_profile('Synthetic','0500000003','masculine',null)");
  await query('select rakeezx.begin_account_provisioning()');
  const defaults=buildAccountFoundationDefaults();
  const provision=async ()=>(await query('select rakeezx.provision_account_workspace($1::jsonb) r',[JSON.stringify(defaults)]))[0].r;
  const initial=await provision();
  assert.equal(initial.snapshot.years[0].calendar_preset_id,null);
  const y=initial.snapshot.years[0];
  await mutate('years',y.id,'fresh-select','patch',{calendar_preset_id:G},y.revision);
  await mutate('calendars','fresh-g','fresh-calendar','create',{year_id:y.id,source:'custom',preset_id:G,
    term_date_overrides:{[initial.snapshot.terms[0].id]:{start_date:'2026-08-24',end_date:'2027-01-07'}}});
  const retry=await provision();
  assert.equal(retry.snapshot.years[0].calendar_preset_id,G);
  const custom=retry.snapshot.calendars.find(r=>r.id==='fresh-g');
  assert.equal(custom.preset_id,G); assert.equal(Object.keys(custom.term_date_overrides).length,1);
  await use(A);
});

test('fresh restore reference checks roll back all rows and leave no privilege marker or receipt',async()=>{
  const D='44444444-4444-4444-8444-444444444444';
  await pg.exec(`reset role; insert into auth.users values('${D}')`); await use(D);
  const create=(entity,recordId,patch)=>({entity,recordId,operation:'create',baseRevision:0,patch,clientUpdatedAt:1});
  const year=create('years','fresh-invalid',{label:'Synthetic',hijri_start:1448,hijri_end:1449,calendar_preset_id:G});
  for(const v5 of [false,true]) {
    const missing=await restore(`missing-terms-${v5}`,[year],v5);
    await assert.rejects(missing.finalize(),/N58_EXISTING_TERMS_REQUIRED/);
    assert.equal(await row('years','fresh-invalid'),undefined);
    const invalid=await restore(`invalid-overrides-${v5}`,[year,
      create('calendars','fresh-invalid-g',{year_id:'fresh-invalid',source:'custom',preset_id:G,
        term_date_overrides:{foreign:{start_date:'2026-08-23',end_date:'2027-01-07'}}}),
      create('terms','fresh-t1',{year_id:'fresh-invalid',name:'One',index:1}),
      create('terms','fresh-t2',{year_id:'fresh-invalid',name:'Two',index:2})],v5);
    await assert.rejects(invalid.finalize(),/N58_INVALID_TERM_OVERRIDE_PAIR/);
    assert.equal(await row('years','fresh-invalid'),undefined);assert.equal(await row('calendars','fresh-invalid-g'),undefined);
  }
  await pg.exec('reset role');
  assert.equal((await query('select count(*)::int n from rakeezx.n58_restore_transactions'))[0].n,0);
  assert.equal((await query('select count(*)::int n from rakeezx.sync_restore_receipts where owner_id=$1',[D]))[0].n,0);
  await use(A);
});

test('RED: every effective scope is rechecked on selection and switch, including inclusive edges',async()=>{
  const E='55555555-5555-4555-8555-555555555555';
  await pg.exec(`reset role; insert into auth.users values('${E}')`); await use(E);
  await pg.exec(`insert into rakeezx.years(id,label,hijri_start,hijri_end) values('edge-year','Synthetic',1448,1449);
    insert into rakeezx.terms(id,year_id,name,"index",start_date,end_date) values
      ('edge-1','edge-year','One',1,null,null),('edge-2','edge-year','Two',2,null,null),
      ('edge-3','edge-year','Three',3,'2027-06-25','2027-06-30'),
      ('edge-4','edge-year','Four',4,'2027-07-11','2027-07-20'),
      ('edge-5','edge-year','Five',5,'2027-07-21','2027-07-30'),
      ('edge-6','edge-year','Six',6,'2027-07-31','2027-08-10');
    insert into rakeezx.calendars(id,year_id,source,preset_id) values('edge-g','edge-year','custom','${G}');`);
  await pg.exec(`update rakeezx.years set calendar_preset_id='${G}' where id='edge-year'`);
  const prior=await row('years','edge-year');
  await assert.rejects(pg.exec(`update rakeezx.years set calendar_preset_id='${W}' where id='edge-year'`),/N58_OVERLAPPING_TERM_OVERRIDES/);
  assert.deepEqual(await row('years','edge-year'),prior,'failed switch is atomic');
  await pg.exec(`insert into rakeezx.calendars(id,year_id,source,preset_id,term_date_overrides)
    values('edge-w','edge-year','custom','${W}',
      '{"edge-3":{"start_date":"2027-07-02","end_date":"2027-07-10"}}')`);
  await pg.exec(`update rakeezx.years set calendar_preset_id='${W}' where id='edge-year'`);
  assert.equal((await row('years','edge-year')).calendar_preset_id,W);
  await assert.rejects(pg.exec(`update rakeezx.calendars set deleted_at=now() where id='edge-w'`),/N58_OVERLAPPING_TERM_OVERRIDES/);
  assert.equal((await row('calendars','edge-w')).deleted_at,null);
  await assert.rejects(pg.exec(`update rakeezx.calendars set term_date_overrides=
    '{"edge-3":{"start_date":"2027-07-01","end_date":"2027-07-10"}}' where id='edge-w'`),/N58_OVERLAPPING_TERM_OVERRIDES/);
  await use(A);
});

test('RED: raw changes to terms 3-6 recheck prepared scopes and roll back, scoped by owner',async()=>{
  const E='77777777-7777-4777-8777-777777777777';
  await pg.exec(`reset role; insert into auth.users values('${E}')`); await use(E);
  await pg.exec(`insert into rakeezx.years(id,label,hijri_start,hijri_end) values('raw-year','Synthetic',1448,1449);
    insert into rakeezx.terms(id,year_id,name,"index",start_date,end_date) values
      ('raw-1','raw-year','One',1,null,null),('raw-2','raw-year','Two',2,null,null),
      ('raw-3','raw-year','Three',3,'2027-07-05','2027-07-10'),
      ('raw-4','raw-year','Four',4,'2027-07-11','2027-07-20'),
      ('raw-5','raw-year','Five',5,'2027-07-21','2027-07-30'),
      ('raw-6','raw-year','Six',6,'2027-07-31','2027-08-10');
    insert into rakeezx.calendars(id,year_id,source,preset_id) values
      ('raw-g','raw-year','custom','${G}'),('raw-w','raw-year','custom','${W}');`);
  for(const sql of [
    "update rakeezx.terms set end_date='2027-07-21' where id='raw-4'",
    "update rakeezx.terms set start_date='2027-07-30' where id='raw-6'",
    "update rakeezx.terms set start_date='2026-08-30',end_date='2026-09-01' where id='raw-3'",
  ]) await assert.rejects(pg.exec(sql),/N58_OVERLAPPING_TERM_OVERRIDES/);
  assert.equal((await row('terms','raw-4')).end_date,'2027-07-20');
  assert.equal((await row('terms','raw-6')).start_date,'2027-07-31');
  const prior=await row('terms','raw-4');
  const staged=await restore('raw-existing-overlap',[{entity:'terms',recordId:'raw-4',operation:'patch',
    baseRevision:prior.revision,patch:{end_date:'2027-07-21'},clientUpdatedAt:12}]);
  await assert.rejects(staged.finalize(),/N58_OVERLAPPING_TERM_OVERRIDES/);
  assert.deepEqual(await row('terms','raw-4'),prior,'existing-year restore is atomic');
  await use(B);
  assert.equal((await query(`select count(*)::int n from rakeezx.terms where year_id='raw-year'`))[0].n,0);
  assert.equal((await query(`update rakeezx.terms set end_date='2027-07-22' where id='raw-4' returning id`)).length,0);
  await use(E);
  await assert.rejects(query(`update rakeezx.calendars set term_date_overrides=$1::jsonb where id='raw-g'`,
    [JSON.stringify({'t1':{start_date:'2026-08-23',end_date:'2027-01-07'}})]),/N58_INVALID_TERM_OVERRIDE_PAIR/);
  await use(A);
});

test('RED: fresh restore rejects default-scope overlap after term creation and rolls back receipt',async()=>{
  const F='66666666-6666-4666-8666-666666666666';
  await pg.exec(`reset role; insert into auth.users values('${F}')`); await use(F);
  const create=(entity,recordId,patch)=>({entity,recordId,operation:'create',baseRevision:0,patch,clientUpdatedAt:1});
  for(const v5 of [false,true]) {
    const id=`fresh-overlap-${v5}`;
    const ops=[create('years',id,{label:'Synthetic',hijri_start:1448,hijri_end:1449,calendar_preset_id:G}),
      create('terms',`${id}-1`,{year_id:id,name:'One',index:1}),
      create('terms',`${id}-2`,{year_id:id,name:'Two',index:2}),
      create('terms',`${id}-3`,{year_id:id,name:'Three',index:3,start_date:'2027-01-07',end_date:'2027-01-08'})];
    const staged=await restore(id,ops,v5);
    await assert.rejects(staged.finalize(),/N58_OVERLAPPING_TERM_OVERRIDES/);
    assert.equal(await row('years',id),undefined);
    assert.equal(await row('terms',`${id}-3`),undefined);
  }
  await pg.exec('reset role');
  assert.equal((await query(`select count(*)::int n from rakeezx.sync_restore_receipts where owner_id=$1`,[F]))[0].n,0);
  assert.equal((await query(`select count(*)::int n from rakeezx.n58_restore_transactions where owner_id=$1`,[F]))[0].n,0);
  await use(A);
});
