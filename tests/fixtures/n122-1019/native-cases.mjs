// AI: one bounded native qualification against real public Product protocol.
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const A='11111111-1111-4111-8111-111111111111', B='22222222-2222-4222-8222-222222222222';
export async function qualify({a,b,sql,report,root}) {
  const q=(s,v=[])=>a.query(s,v);
  const check=async(name,fn)=>{const e={name,status:'FAIL'};report.checks.push(e);await fn();e.status='PASS';};
  const fail=async(s,v,code)=>{let actual;try{await q(s,v);}catch(e){actual=e.code;}assert.equal(actual,code);report.negativeSqlstates.push({expected:code,actual});};
  // Unchanged standard synthetic bootstrap identities only. No Product roles or
  // LOGINs are added by N122, and no shared cluster/hosted role is modified.
  await q(`create schema auth; create schema realtime;
    create role authenticated nologin; create role anon nologin; create role service_role nologin;
    create table auth.users(id uuid primary key,email text);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to authenticated,anon;
    create table realtime.messages(extension text,topic text); alter table realtime.messages enable row level security;
    create function realtime.topic() returns text language sql stable as $$select current_setting('realtime.topic',true)$$;
    create function realtime.send(jsonb,text,text,boolean) returns void language sql as $$select$$;`);
  // Only public-domain prerequisite schema, no staged N44/N88 private schemas.
  const dir=path.join(root,'supabase/migrations');
  const n58=['20261004070000_n58_calendar_persistence.sql','20261004070001_n58_extra_term_compatibility.sql','20261004070002_n58_effective_scope_revalidation.sql'];
  const names=[...await readdir(dir),...n58].filter(n=>n.endsWith('.sql')&&n<'20261018000000').sort();
  for(const n of names) {try{await q((n58.includes(n)?execFileSync('C:/Program Files/Git/cmd/git.exe',['show','4fa6fb8b98415a42dd0a835bfdd7038ab65b8979:supabase/migrations/'+n],{encoding:'utf8',maxBuffer:20000000}):await readFile(path.join(dir,n),'utf8')).replace(/^\uFEFF/,'').replaceAll('\r\n','\n'));}catch(e){throw Error(`Public bootstrap ${n}: ${e.code} ${e.message}`);}}
  report.bootstrap=names;
  await q(`insert into auth.users(id) values('${A}'),('${B}'); select set_config('request.jwt.claim.sub','${A}',false);`);
  await q(`insert into rakeezx.years(id,label,hijri_start,hijri_end) values('n122-y','synthetic',1500,1501);
    insert into rakeezx.terms(id,year_id,name,"index",status) values('n122-t','n122-y','synthetic',1,'active');
    insert into rakeezx.subjects(id,name,slug) values('n122-sub','synthetic','n122-sub');
    insert into rakeezx.sections(id,year_id,grade,label,name) values('n122-sec','n122-y',4,'A','synthetic');
    insert into rakeezx.teachings(id,section_id,subject_id,term_id) values('n122-tch','n122-sec','n122-sub','n122-t');
    insert into rakeezx.slots(id,teaching_id,weekday,period) values('n122-legacy','n122-tch',1,1);`);
  const before=(await q("select to_jsonb(s) as row from rakeezx.slots s where id='n122-legacy'")).rows[0].row;
  await check('exact_append_only_migration_and_legacy_no_rewrite',async()=>{
    await q(sql);
    const row=(await q("select to_jsonb(s) as row from rakeezx.slots s where id='n122-legacy'")).rows[0].row;
    assert.deepEqual(row,{...before,kind:'teaching',term_id:null});
    const r=(await q("select relrowsecurity,relforcerowsecurity from pg_class where oid='rakeezx.slots'::regclass")).rows[0];
    assert.deepEqual(r,{relrowsecurity:true,relforcerowsecurity:true});
  });
  await q(`select set_config('request.jwt.claim.sub','${B}',false);
    insert into rakeezx.years(id,label,hijri_start,hijri_end) values('n122-by','synthetic',1500,1501);
    insert into rakeezx.terms(id,year_id,name,"index") values('n122-bt','n122-by','synthetic',1);
    select set_config('request.jwt.claim.sub','${A}',false); set role authenticated;`);
  let seq=0;
  const mutate=async(id,patch,revision=0,op='create',mid='n122-m'+(++seq))=>(await q('select rakeezx.apply_sync_v2_mutation($1,$2,$3,$4,$5,$6::jsonb,$7,$8) result',['slots',id,mid,'n122-device',revision,JSON.stringify(patch),op,1000])).rows[0].result;
  const rejectMutation=async(id,patch,code)=>fail('select rakeezx.apply_sync_v2_mutation($1,$2,$3,$4,0,$5::jsonb,$6,1000)', ['slots',id,'n122-reject-'+id,'n122-device',JSON.stringify(patch),'create'],code);
  await check('owner_term_kind_checks_and_rls',async()=>{
    // Direct DML is intentionally denied by the existing public protocol guard.
    await fail("insert into rakeezx.slots(id,kind,term_id,weekday,period) values('direct-dml','activity','n122-t',2,1)",[],'42501');
    await rejectMutation('foreign-term',{kind:'activity',term_id:'n122-bt',weekday:2,period:1},'23503');
    await rejectMutation('bad-kind',{kind:'bogus',term_id:'n122-t',weekday:2,period:1},'23514');
    await rejectMutation('null-academic',{kind:'teaching',weekday:2,period:1},'23514');
    await rejectMutation('fake-parent',{kind:'activity',teaching_id:'n122-tch',term_id:'n122-t',weekday:2,period:1},'23514');
    await rejectMutation('missing-term',{kind:'waiting',term_id:'missing',weekday:2,period:1},'23503');
    assert.equal((await q('select count(*)::int n from rakeezx.terms where owner_id=$1',[B])).rows[0].n,0);
  });
  let activity,waiting;
  await check('actual_protocol_roundtrip_revision_idempotent_receipt_and_conflict',async()=>{
    activity=await mutate('n122-a',{kind:'activity',teaching_id:null,term_id:'n122-t',weekday:1,period:2});
    waiting=await mutate('n122-w',{kind:'waiting',teaching_id:null,term_id:'n122-t',weekday:1,period:3});
    for(const [r,k] of [[activity,'activity'],[waiting,'waiting']]) {assert.equal(r.outcome,'applied');assert.equal(r.canonical.kind,k);assert.equal(r.canonical.term_id,'n122-t');assert.equal(r.canonical.teaching_id,null);assert.equal(r.resultRevision,1);}
    const replay=await mutate('n122-a',{kind:'activity',teaching_id:null,term_id:'n122-t',weekday:1,period:2},0,'create','n122-m1');
    assert.deepEqual(replay,activity);
    await fail('select rakeezx.apply_sync_v2_mutation($1,$2,$3,$4,0,$5::jsonb,$6,1001)', ['slots','n122-a','n122-m1','n122-device',JSON.stringify({period:4}),'create'],'22023');
    const edited=await mutate('n122-a',{kind:'waiting'},1,'patch');assert.equal(edited.canonical.kind,'waiting');assert.equal(edited.resultRevision,2);
    const stale=await mutate('n122-a',{kind:'activity'},1,'patch');assert.notEqual(stale.outcome,'applied');assert.equal(stale.canonical.kind,'waiting');
    await rejectMutation('n122-conflict',{kind:'activity',term_id:'n122-t',weekday:1,period:2},'23505');
    const academic=await mutate('n122-academic',{teaching_id:'n122-tch',weekday:2,period:1});assert.equal(academic.canonical.kind,'teaching');
  });
  await check('class_reopen_preserves_independent_occupancy',async()=>{
    await q("select rakeezx.apply_sync_v2_section_lifecycle_command('n122-archive','n122-device','archive_class','n122-sec','2026-10-19',1234)");
    await mutate('n122-occupied',{kind:'activity',term_id:'n122-t',weekday:1,period:1});
    const r=(await q("select rakeezx.apply_sync_v2_section_lifecycle_command('n122-reopen','n122-device','reopen_class','n122-sec',null,1235) r")).rows[0].r;
    assert.equal(r.outcome,'rejected_slot_conflict');
    assert.equal((await q("select kind from rakeezx.slots where id='n122-occupied'")).rows[0].kind,'activity');
  });
  await check('tombstone_stale_patch_and_restore_canonical_preserve_kind_term',async()=>{
    const deleted=await mutate('n122-w',{},waiting.resultRevision,'delete');assert.equal(deleted.outcome,'deleted');assert.ok(deleted.canonical.deleted_at);
    const late=await mutate('n122-w',{period:4},waiting.resultRevision,'patch');assert.notEqual(late.outcome,'applied');assert.ok(late.canonical.deleted_at);
    const snapshot=(await q('select rakeezx.n71_restore_canonical(auth.uid()) r')).rows[0].r;
    const row=snapshot.slots.find(s=>s.id==='n122-w');assert.equal(row.kind,'waiting');assert.equal(row.term_id,'n122-t');assert.ok(row.deleted_at);
    // Actual restore finalizer uses the same extended field map and row guards.
    const manifest=(await q('select rakeezx.n71_restore_manifest(auth.uid()) r')).rows[0].r;
    const operations=[{entity:'slots',recordId:'n122-restored',operation:'create',baseRevision:0,patch:{kind:'waiting',teaching_id:null,term_id:'n122-t',weekday:3,period:1},clientUpdatedAt:2000}];
    const staged=(await q('select rakeezx.stage_n71_restore($1,$2,5,$3::jsonb,$4::jsonb,auth.uid()) r',['n122-restore','a'.repeat(64),JSON.stringify(manifest),JSON.stringify(operations)])).rows[0].r;
    const finalized=(await q('select rakeezx.finalize_n71_restore($1,$2,$3) r',['n122-restore','a'.repeat(64),staged.stageHash])).rows[0].r;
    const restored=finalized.canonical.slots.find(s=>s.id==='n122-restored');assert.equal(restored.kind,'waiting');assert.equal(restored.term_id,'n122-t');
  });
  await check('foreign_owner_protocol_cannot_read_or_modify_a',async()=>{
    await b.query(`select set_config('request.jwt.claim.sub','${B}',false);set role authenticated;`);
    assert.equal((await b.query("select count(*)::int n from rakeezx.slots where id='n122-a'")).rows[0].n,0);
    const r=(await b.query("select rakeezx.apply_sync_v2_mutation('slots','n122-a','n122-foreign','n122-device',1,'{\"period\":5}'::jsonb,'patch',3000) r")).rows[0].r;
    assert.equal(r.outcome,'not_found');
  });
}
