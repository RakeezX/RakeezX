import {spawnSync,execFileSync} from 'node:child_process';
import {mkdir,readFile,readdir,rm,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createServer} from 'node:net';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const shared='C:/Users/Abody/Projects/RakeezX/artifacts/n77-native-pg17';
const {default:pg}=await import(pathToFileURL(shared+'/client/node_modules/pg/lib/index.js'));
const artifact=path.resolve('test-results/n100-automatic-native'),cluster=path.join(artifact,'cluster');
await mkdir(artifact,{recursive:true});
const socket=createServer();await new Promise(done=>socket.listen(0,'127.0.0.1',done));
const port=socket.address().port;await new Promise(done=>socket.close(done));
const run=(name,args)=>{const r=spawnSync(shared+'/package/native/bin/'+name+'.exe',args,{encoding:'utf8',windowsHide:true,timeout:30000});if(r.status!==0)throw Error(r.error??r.stderr??r.stdout);};
const OWNER='a7300000-0000-4000-8000-000000000001',OTHER='b7300000-0000-4000-8000-000000000002';
const checks=[],record=(name,evidence)=>{checks.push({name,status:'PASS',evidence});console.log('PASS '+name);};
const migration='supabase/migrations/20261014090000_n100_automatic_safe_copy.sql';
const sql=await readFile(migration,'utf8'),hash=createHash('sha256').update(sql).digest('hex');
const source=JSON.parse(await readFile('tests/n100-automatic-provider-source.json','utf8'));
let started=false,client,functions;
try {
  run('initdb',['-D',cluster,'-U','postgres','--auth=trust','--encoding=UTF8','--no-locale']);
  run('pg_ctl',['-D',cluster,'-l',path.join(artifact,'server.log'),'-o',`-h 127.0.0.1 -p ${port}`,'-w','start']);started=true;
  client=new pg.Client({host:'127.0.0.1',port,user:'postgres',database:'postgres'});await client.connect();
  const q=(text,values)=>client.query(text,values);
  await q(`create schema auth;create schema realtime;create role authenticated;create role anon;create role service_role;
    create table auth.users(id uuid primary key,email text);
    create function auth.uid() returns uuid language sql stable security definer set search_path='' as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to authenticated,anon;
    create table realtime.messages(extension text,topic text);alter table realtime.messages enable row level security;
    create function realtime.topic() returns text language sql stable as $$select current_setting('realtime.topic',true)$$;
    create function realtime.send(jsonb,text,text,boolean) returns void language sql as $$select$$;
    insert into auth.users values('${OWNER}','a@example.invalid'),('${OTHER}','b@example.invalid');
    select set_config('request.jwt.claim.sub','${OWNER}',false);`);
  for(const file of (await readdir('supabase/migrations')).sort().filter(name=>/^00\d+.*\.sql$/.test(name))) await q((await readFile('supabase/migrations/'+file,'utf8')).replace(/^\uFEFF/,''));
  await q(await readFile('supabase/migrations/20261012120000_n73_distribution_apply.sql','utf8'));
  await q('alter function rakeezx.sync_v2_field_map(text) rename to sync_v2_field_map_before_n71');
  for(const file of ['20261012234116_n94_subitem_dates_late_scoring.sql','20261013083000_n73_n94_compatibility.sql','20261013090000_n73_distribution_error_contract.sql']) await q(await readFile('supabase/migrations/'+file,'utf8'));
  await q(await readFile('supabase/migrations/20261013101500_n100_preserve_target_marks.sql','utf8'));
  for(const row of source) {
    assert.equal((await q('select md5(prosrc) hash from pg_proc where oid=$1::regprocedure',[row.signature])).rows[0].hash,row.body_md5);
    // ACTUAL provider functions, not an independently reimplemented SQL engine.
    await q(row.definition);
  }
  const routines=()=>q(`select p.oid::regprocedure::text signature,md5(p.prosrc) body_md5,pg_get_functiondef(p.oid) definition,p.proacl::text acl,p.prosecdef,p.proconfig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='rakeezx' and p.proname in ('n73_build_distribution','n73_distribution_state','plan_score_distribution','apply_score_distribution_plan','score_distribution_capability') order by 1`);
  const beforeFunctions=(await routines()).rows;
  const fieldMaps=await rpcMap(q);
  // A review created by the shipped four-argument RPC must remain applicable.
  await q(`insert into rakeezx.years(id,label,hijri_start,hijri_end) values('old-y','Legacy synthetic',1448,1449);
    insert into rakeezx.terms(id,year_id,name,"index") values('old-term','old-y','Legacy',1);
    insert into rakeezx.subjects(id,name,slug) values('old-subject','Legacy','legacy-n100');
    insert into rakeezx.sections(id,year_id,grade,label,name) values('old-s1','old-y',3,'1','3/1'),('old-s2','old-y',3,'2','3/2');
    insert into rakeezx.teachings(id,section_id,subject_id,term_id) values('old-t1','old-s1','old-subject','old-term'),('old-t2','old-s2','old-subject','old-term');
    insert into rakeezx.students(id,name) values('old-student','Legacy synthetic');
    insert into rakeezx.items(id,teaching_id,name,max,"order") values('old-source','old-t1','Legacy',10,0),('old-target','old-t2','Legacy',12,0);
    insert into rakeezx.scores(id,student_id,item_id,value) values('old-source-score','old-student','old-source',9),('old-target-score','old-student','old-target',11);`);
  const oldPlan=(await q("select rakeezx.plan_score_distribution('pre-n100','old-t1',array['old-t2']) result")).rows[0].result;
  await q(sql);functions=(await routines()).rows;
  assert.deepEqual(await rpcMap(q),fieldMaps);
  await q('select rakeezx.apply_score_distribution_plan($1,$2,$3,$4,true)',['pre-n100-apply','native',oldPlan.planId,oldPlan.token]);
  assert.equal((await q("select value from rakeezx.scores where id='old-target-score'")).rows[0].value,'10.00');
  assert.equal((await q("select value from rakeezx.scores where id='old-source-score'")).rows[0].value,'9.00');
  await assert.rejects(()=>q(sql),/N100 provider source\/ACL changed/);await q('rollback');
  assert.deepEqual((await routines()).rows,functions);
  for(const prior of beforeFunctions) {
    const next=functions.find(row=>row.signature===prior.signature);
    for(const key of ['acl','prosecdef','proconfig']) assert.deepEqual(next[key],prior[key]);
  }
  assert.equal((await q("select has_function_privilege('authenticated','rakeezx.n73_build_distribution(text,text[],text[],text)','EXECUTE') allowed")).rows[0].allowed,false);
  assert.equal((await q("select has_function_privilege('anon','rakeezx.plan_score_distribution(text,text,text[],text[],text)','EXECUTE') allowed")).rows[0].allowed,false);
  record('n100_server_source_binding',`Exact five provider bodies hash-matched before loading single migration ${hash}; signatures/ACL/security/search_path retained, compatible overloads of existing names only, private builder denied; no table/schema/Auth changes.`);
  const rpc=async(name,values)=>(await q(`select rakeezx.${name}(${values.map((_,i)=>'$'+(i+1)).join(',')}) result`,values)).rows[0].result;
  const plan=(id,targets=['t2','t3'],mode='automatic-safe')=>rpc('plan_score_distribution',[id,'t1',targets,[],mode]);
  const apply=(p,id)=>rpc('apply_score_distribution_plan',[id,'n100-native',p.planId,p.token,true]);
  const state=()=>rpc('n73_distribution_state',['t1',['t2','t3','t4']]);
  await q(`insert into rakeezx.years(id,label,hijri_start,hijri_end) values('y','Synthetic',1450,1451);
    insert into rakeezx.terms(id,year_id,name,"index") values('term','y','Synthetic',1);
    insert into rakeezx.subjects(id,name,slug) values('subject','Synthetic','n100');
    insert into rakeezx.sections(id,year_id,grade,label,name) values('s1','y',4,'1','4/1'),('s2','y',4,'2','4/2'),('s3','y',4,'3','4/3'),('s4','y',4,'4','4/4');
    insert into rakeezx.teachings(id,section_id,subject_id,term_id) values('t1','s1','subject','term'),('t2','s2','subject','term'),('t3','s3','subject','term'),('t4','s4','subject','term');
    insert into rakeezx.students(id,name) values('src-student','Source'),('regular','Regular'),('late','Late'),('unmarked','Unmarked');
    begin;select set_config('rakeezx.score_domain_write','on',true);
    insert into rakeezx.items(id,teaching_id,name,max,"order",score_mode,distribution_mode) values
      ('source','t1','Homework',10,0,'subitems','manual'),('target','t2','  Homework  ',10,0,'subitems','manual'),('extra','t2','Extra',5,1,'direct','auto');
    insert into rakeezx.score_subitems(id,item_id,name,value,"order",late_points,start_date,due_date,created_at) values
      ('sd1','source','New first',3,0,1,'2026-11-01','2026-11-02','2026-01-01'),('sd2','source','New second',2,1,1,'2026-11-03','2026-11-04','2026-01-01'),
      ('td1','target','Old first',3,0,1,'2026-09-01','2026-09-02','2026-02-01'),('td2','target','Old second',2,1,1,null,null,'2026-02-02');
    insert into rakeezx.score_subitem_completions(id,student_id,subitem_id,checked,completion_state) values
      ('src-c','src-student','sd1',true,'regular'),('reg-c','regular','td1',true,'regular'),('late-c','late','td2',true,'late'),('empty-c','unmarked','td1',false,null);
    insert into rakeezx.scores(id,student_id,item_id,value,manual_value,derived_value) values
      ('src-score','src-student','source',9,6,3),('reg-score','regular','target',5,2,3),('late-score','late','target',2,1,1),('empty-score','unmarked','target',null,null,0),('extra-score','regular','extra',4,null,null);commit;`);
  const original=await state(),p=await plan('preserve');
  assert.equal(p.mode,'automatic-safe');assert.equal(p.changedCount,2);
  assert.equal(p.targets[0].impact[0].preservedScores,3);assert.equal(p.targets[0].impact[0].preservedCompletions,3);
  assert.equal(p.operations.some(op=>['scores','score_subitem_completions'].includes(op.entity)),false);
  assert.equal(p.operations.some(op=>op.patch.created_at),false);
  await assert.rejects(()=>plan('preserve',['t2','t3'],'definitions'),/Plan ID reused/);
  const legacy=await rpc('plan_score_distribution',['legacy','t1',['t2'],[]]);
  assert.equal(legacy.mode,'definitions');assert.notEqual(legacy.token,p.token);
  const receipt=await apply(p,'apply-preserve');assert.deepEqual(await apply(p,'apply-preserve'),receipt);
  const after=await state();
  assert.deepEqual(after.scores,original.scores);assert.deepEqual(after.score_subitem_completions,original.score_subitem_completions);
  for(const id of ['td1','td2']) {
    const before=original.score_subitems.find(row=>row.id===id),next=after.score_subitems.find(row=>row.id===id),src=original.score_subitems.find(row=>row.id==='sd'+id.at(-1));
    assert.equal(next.name,src.name);assert.equal(next.start_date,src.start_date);assert.equal(next.due_date,src.due_date);assert.equal(next.created_at,before.created_at);
  }
  for(const row of after.score_subitems.filter(row=>row.item_id!=='source'&&row.item_id!=='target')) assert.ok(new Date(row.created_at)>new Date('2026-10-01'));
  assert.equal(receipt.scores.some(row=>row.id==='src-score'),false);
  assert.equal(receipt.score_subitem_completions.some(row=>row.id==='src-c'),false);
  assert.equal((await plan('repeat')).changedCount,0);
  record('n100_target_identity_marks_dates_preserved','Actual SQL ordinal label/date apply retains target td1/td2, complete regular5/manual2, late2/manual1, NULL/unmarked and all completion identities/states byte-for-byte; createdAt historical, new identities actual creation; no source scores in operations/receipt; exact receipt retry and subsequent no-op.');
  // Stale score, date, completion and mapping inputs reject every selected target.
  for(const [index,update] of ["update rakeezx.scores set value=6 where id='reg-score'","update rakeezx.score_subitems set due_date='2026-12-01' where id='td1'","update rakeezx.score_subitem_completions set completion_state='late' where id='reg-c'","update rakeezx.score_subitems set distribution_origin_id='changed' where id='td2'"].entries()) {
    const stale=await plan('stale-'+index);await q(`begin;select set_config('rakeezx.score_domain_write','on',true);${update};commit;`);
    const before=await state();await assert.rejects(()=>apply(stale,'stale-apply-'+index),/changed since review/);assert.deepEqual(await state(),before);
    // Restore only the synthetic mutation for the next isolated local case.
    await q(`begin;select set_config('rakeezx.score_domain_write','on',true);
      update rakeezx.scores set value=5 where id='reg-score';update rakeezx.score_subitems set due_date='2026-11-02' where id='td1';
      update rakeezx.score_subitem_completions set completion_state='regular' where id='reg-c';update rakeezx.score_subitems set distribution_origin_id='sd2' where id='td2';commit;`);
  }
  await q(`select set_config('request.jwt.claim.sub','${OTHER}',false);set role authenticated;`);
  assert.equal((await q('select * from rakeezx.score_distribution_plans')).rows.length,0);
  await assert.rejects(()=>apply(p,'foreign'),/unavailable/);await assert.rejects(()=>plan('foreign-plan'),/unavailable/);
  await q(`reset role;select set_config('request.jwt.claim.sub','${OWNER}',false);`);
  // Force the last target's update to fail and prove earlier updates roll back.
  await q(`begin;select set_config('rakeezx.score_domain_write','on',true);update rakeezx.score_subitems set name='Changed again' where id='sd1';commit;
    create function public.n100_test_failure() returns trigger language plpgsql as $$begin if new.teaching_id='t3' then raise exception 'synthetic final target failure';end if;return new;end$$;
    create trigger n100_test_failure before update on rakeezx.items for each row execute function public.n100_test_failure();`);
  const atomic=await plan('atomic'),atomicBefore=await state();await assert.rejects(()=>apply(atomic,'atomic-apply'),/synthetic final target failure/);
  assert.deepEqual(await state(),atomicBefore);await q('drop trigger n100_test_failure on rakeezx.items;drop function public.n100_test_failure()');
  record('n100_owner_atomic_retry_and_no_source_scores','Real authenticated/RLS foreign owner denial; stale score/date/completion/origin fingerprints reject all targets; final-target exception rolls back preceding target writes; exact idempotent receipt; source student 9 differs from target 5/2/NULL and never appears in target payload.');
  for(const [index,update] of ["update rakeezx.score_subitems set value=4 where id='td1'","update rakeezx.score_subitems set late_points=2 where id='td1'","update rakeezx.score_subitems set \"order\"=1 where id='td1'","update rakeezx.items set max=11 where id='target'","update rakeezx.score_subitems set deleted_at=clock_timestamp() where id='td2'","update rakeezx.items set distribution_mode='auto' where id='target'"].entries()) {
    await q(`begin;select set_config('rakeezx.score_domain_write','on',true);${update};commit;`);
    const before=await state(),review=await plan('incompatible-'+index,['t2']);assert.equal(review.targets.length,1);assert.equal(review.targets[0].impact[0].retained,true);assert.equal(review.excludedTargets.length,0);assert.equal(review.operations.length,0);assert.deepEqual(await state(),before);
    await q(`begin;select set_config('rakeezx.score_domain_write','on',true);update rakeezx.score_subitems set value=3,late_points=1,"order"=0 where id='td1';update rakeezx.score_subitems set deleted_at=null where id='td2';update rakeezx.items set max=10,distribution_mode='manual' where id='target';commit;`);
  }
  await q(`begin;select set_config('rakeezx.score_domain_write','on',true);insert into rakeezx.items(id,teaching_id,name,max,"order") values('duplicate','t2','homework',10,2);commit;`);
  const ambiguous=await plan('duplicate',['t2']);assert.equal(ambiguous.targets.length,1);assert.equal(ambiguous.operations.length,0);assert.equal(ambiguous.targets[0].impact[0].retained,true);assert.match(ambiguous.targets[0].impact[0].reason,/مكرر/);
  record('n100_ambiguous_mapping_non_destructive','Count/order/regular weight/late weight/max/normalized duplicate mappings fail closed with clear per-target review and zero operations; extras retained, definitions-only remains callable.');
  // Mixed safe addition + conflicting recorded parent: no target grade/structure write.
  await q(`begin;select set_config('rakeezx.score_domain_write','on',true);
    insert into rakeezx.items(id,teaching_id,name,max,"order") values('new-direct','t1','New direct',5,1);
    update rakeezx.scores set value=0,manual_value=0 where id='reg-score';commit;`);
  const mixed=await plan('partial',['t2','t4']);
  assert.equal(mixed.targets.length,2);assert.equal(mixed.targets[0].impact.some(row=>row.retained),true);
  assert.equal(Number(mixed.targets[0].afterTotal),30);
  assert.equal(mixed.operations.some(op=>['scores','score_subitem_completions'].includes(op.entity)),false);
  const zeroBefore=(await state()).scores;await apply(mixed,'partial-apply');assert.deepEqual((await state()).scores,zeroBefore);
  assert.equal((await q("select count(*) n from rakeezx.items where teaching_id='t2' and name='homework' and deleted_at is null")).rows[0].n,'1');
  record('n100_partial_conflict_zero_and_totals','Duplicate recorded parent retained, independent safe addition committed; exact actual total; recorded zero/manual zero and source grades untouched; empty target receives definitions.');
  // Unmarked definitions can refresh incompatible configuration; recorded zero cannot.
  await q(`begin;select set_config('rakeezx.score_domain_write','on',true);
    insert into rakeezx.items(id,teaching_id,name,max,"order") values('blank-direct','t3','New direct',8,1);
    insert into rakeezx.scores(id,item_id,student_id,value) values('blank-score','blank-direct','unmarked',null);commit;`);
  const blank=await plan('blank',['t3']);assert.equal(Number(blank.targets[0].impact.find(row=>row.name==='New direct').max),5);
  // Target gains a mark after review: all definitions, even another target, remain unchanged.
  await q(`begin;select set_config('rakeezx.score_domain_write','on',true);update rakeezx.scores set value=0 where id='blank-score';commit;`);
  const gainedBefore=await state();await assert.rejects(()=>apply(blank,'blank-stale'),/changed since review/);assert.deepEqual(await state(),gainedBefore);
  const zero=await plan('zero',['t3']);assert.equal(zero.targets[0].impact.find(row=>row.name==='New direct').retained,true);
  assert.equal(zero.operations.some(op=>op.id==='blank-direct'),false);
  await q(`begin;select set_config('rakeezx.score_domain_write','on',true);update rakeezx.scores set value=null where id='blank-score';commit;`);
  const empty=await plan('blank-refresh',['t3']);await apply(empty,'blank-refresh-apply');
  assert.equal((await q("select max from rakeezx.items where id='blank-direct'")).rows[0].max,'5.00');
  assert.equal((await q("select value from rakeezx.scores where id='blank-score'")).rows[0].value,null);
  record('n100_unmarked_refresh_and_mark_gain_race','Actual SQL NULL definition refresh preserves blank value; a gained recorded zero invalidates reviewed plan atomically, and fresh plan retains incompatible max without clamp.');
  // Source-of-truth participation record exists with no materialized score.
  await q(`begin;select set_config('rakeezx.score_domain_write','on',true);
    update rakeezx.items set auto='participation',max=8 where id='blank-direct';
    insert into rakeezx.logs(id,student_id,teaching_id,date,kind,delta) values('automatic-log','unmarked','t3','2026-10-14','participation',2);commit;`);
  const automatic=await plan('automatic',['t3']);assert.equal(automatic.targets[0].impact.find(row=>row.name==='New direct').retained,true);
  assert.equal(automatic.operations.some(op=>op.id==='blank-direct'),false);
  const automaticBefore=await state();await apply(automatic,'automatic-apply');assert.deepEqual(await state(),automaticBefore);
  record('n100_automatic_source_of_truth','Automatic target is protected without a cached score; incompatible type/max never rewrites definition or target events.');
  // Existing unmarked label-only children preserve identities even without origins.
  await q(`begin;select set_config('rakeezx.score_domain_write','on',true);
    update rakeezx.score_subitems set distribution_origin_id=null,name='Old blank label' where item_id in(select id from rakeezx.items where teaching_id='t4' and score_mode='subitems');
    update rakeezx.items set distribution_origin_id=null where teaching_id='t4';commit;`);
  const blankSubs=(await state()).score_subitems.filter(row=>row.item_id!=='source'&&row.item_id!=='target'&&
    (automaticBefore.items.find(item=>item.id===row.item_id)?.teaching_id==='t4'));
  const labels=await plan('unmarked-labels',['t4']);await apply(labels,'unmarked-labels-apply');
  const labelsAfter=await state();
  for(const before of blankSubs) {
    const after=labelsAfter.score_subitems.find(row=>row.id===before.id);assert.equal(after.deleted_at,null);assert.equal(after.created_at,before.created_at);
    assert.equal(after.name,labelsAfter.score_subitems.find(row=>row.id===after.distribution_origin_id).name);
  }
  assert.equal(labels.operations.some(op=>['scores','score_subitem_completions'].includes(op.entity)),false);
  record('n100_unmarked_label_only_identity','Native server preserves existing unmarked child IDs/createdAt by compatible ordinal correspondence without origins, while updating labels and persisting stable origins; no score/completion writes.');

} finally {
  await client?.end();if(started)run('pg_ctl',['-D',cluster,'-w','-m','fast','stop']);
  assert.ok(cluster.startsWith(path.resolve('test-results')+path.sep));await rm(cluster,{recursive:true,force:true});
  await writeFile(path.join(artifact,'result.json'),JSON.stringify({candidate:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),migration,hash,functions,checks,ownedServerStopped:true,ownedClusterRemoved:true},null,2));
}
async function rpcMap(q) {
  return (await q("select x entity,rakeezx.sync_v2_field_map(x) fields from unnest(array['items','scores','score_subitems','score_subitem_completions']) x order by 1")).rows;
}
