import { spawnSync } from 'node:child_process';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createServer } from 'node:net';
import path from 'node:path';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
const shared='C:/Users/Abody/Projects/RakeezX/artifacts/n77-native-pg17';
const {default:pg}=await import(pathToFileURL(shared+'/client/node_modules/pg/lib/index.js'));
const artifact=path.resolve(process.argv.includes('--calm') ? 'test-results/n90-calm-native' : process.argv.includes('--progressive') ? 'test-results/n90-unified-progressive-native' : process.argv.includes('--browser-only') ? 'test-results/n90-unified-native-browser' : 'test-results/n90-unified-native'),cluster=path.join(artifact,'cluster');
await mkdir(artifact,{recursive:true});
const socket=createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));
const run=(name,args)=>{const r=spawnSync(shared+'/package/native/bin/'+name+'.exe',args,{encoding:'utf8',windowsHide:true,timeout:30000});if(r.status!==0)throw Error(r.stderr||r.error||r.stdout);};
let started=false,client;const checks=[];const record=(name,evidence)=>{checks.push({name,status:'PASS',evidence});console.log('PASS '+name);};
const OWNER='a9000000-0000-4000-8000-000000000001',OTHER='b9000000-0000-4000-8000-000000000002';
const migration='20261013122332_n90_reviewed_grade_import.sql',sql=await readFile('supabase/migrations/'+migration,'utf8');
const sha256=createHash('sha256').update(sql).digest('hex');let functions;
try {
  run('initdb',['-D',cluster,'-U','postgres','--auth=trust','--encoding=UTF8','--no-locale']);
  run('pg_ctl',['-D',cluster,'-l',path.join(artifact,'server.log'),'-o',`-h 127.0.0.1 -p ${port}`,'-w','start']);started=true;
  client=new pg.Client({host:'127.0.0.1',port,user:'postgres',database:'postgres'});await client.connect();
  const q=(s,v)=>client.query(s,v);
  await q(`create schema auth;create schema realtime;create role authenticated;create role anon;create role service_role;
    create table auth.users(id uuid primary key,email text);
    create function auth.uid() returns uuid language sql stable security definer set search_path='' as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to authenticated,anon;
    create table realtime.messages(extension text,topic text);alter table realtime.messages enable row level security;
    create function realtime.topic() returns text language sql stable as $$select current_setting('realtime.topic',true)$$;
    create function realtime.send(jsonb,text,text,boolean) returns void language sql as $$select$$;
    insert into auth.users values('${OWNER}','a@example.invalid'),('${OTHER}','b@example.invalid');
    select set_config('request.jwt.claim.sub','${OWNER}',false);`);
  for(const name of (await readdir('supabase/migrations')).sort().filter(n=>/^00\d+.*\.sql$/.test(n))) await q((await readFile('supabase/migrations/'+name,'utf8')).replace(/^\uFEFF/,''));
  await q(sql);
  await q(await readFile('supabase/migrations/20261014100000_n90_unified_student_grade_import.sql','utf8'));
  const {unifiedNativeChecks}=await import('./n90-unified-native-checks.mjs');
  functions=(await q(`select p.proname,md5(p.prosrc) body_md5,pg_get_functiondef(p.oid) definition,p.proacl::text acl,p.prosecdef,p.proconfig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='rakeezx' and p.proname in ('reviewed_grade_import_capability','apply_reviewed_grade_import') order by 1`)).rows;
  assert.equal(functions.length,2);for(const f of functions){assert.equal(f.prosecdef,true);assert.ok(!f.acl.includes('anon=')&&!f.acl.includes(',=')&&f.acl.includes('authenticated=X'));}
  await q(`insert into rakeezx.years(id,label,hijri_start,hijri_end) values('y','Synthetic',1450,1451);
    insert into rakeezx.terms(id,year_id,name,"index",status) values('term','y','Synthetic',1,'active');
    insert into rakeezx.terms(id,year_id,name,"index",status) values('term2','y','Upcoming',2,'upcoming');
    insert into rakeezx.subjects(id,name,slug) values('subject','Synthetic','n90');
    insert into rakeezx.sections(id,year_id,grade,label,name) values('section','y',4,'1','4/1');
    insert into rakeezx.teachings(id,section_id,subject_id,term_id) values('t','section','subject','term');
    insert into rakeezx.students(id,name) values('a','أحمد سالم'),('b','سعيد علي'),('outside','Outside');
    insert into rakeezx.enrollments(id,student_id,section_id) values('ea','a','section'),('eb','b','section');
    insert into rakeezx.items(id,teaching_id,name,max) values('i','t','Exam',20),('auto','t','Auto',20);
    update rakeezx.items set auto='attendance' where id='auto';
    insert into rakeezx.scores(id,student_id,item_id,value) values('s','a','i',10);`);
  if (!process.argv.includes('--browser-only')) checks.push(...await unifiedNativeChecks({q,owner:OWNER,other:OTHER}));
  if (!process.argv.includes('--browser-only') && !process.argv.includes('--unified-only')) {
  const revision=async(table,id)=>(await q(`select revision from rakeezx.${table} where id=$1`,[id])).rows[0].revision;
  const batch=async()=>({teachingId:'t',termId:'term',teachingRevision:await revision('teachings','t'),newItems:[],overwriteConfirmed:true,cells:[
    {studentId:'a',itemId:'i',itemRevision:await revision('items','i'),max:20,scoreId:'s',scoreRevision:await revision('scores','s'),old:Number((await q("select value from rakeezx.scores where id='s'")).rows[0].value),value:12.5},
    {studentId:'b',itemId:'i',itemRevision:await revision('items','i'),max:20,scoreId:null,scoreRevision:0,old:null,value:0}]});
  const apply=(id,b,device='native')=>q('select rakeezx.apply_reviewed_grade_import($1,$2,$3) result',[id,device,b]).then(r=>r.rows[0].result);
  const state=()=>q('select (select jsonb_agg(to_jsonb(i) order by id) from rakeezx.items i) items,(select jsonb_agg(to_jsonb(s) order by id) from rakeezx.scores s) scores,(select count(*)::int from rakeezx.score_domain_receipts) receipts').then(r=>r.rows[0]);
  const original=await state(),review=await batch();
  for(const [name,edit] of [
    ['invalid',b=>b.cells[1].value=21],['duplicate',b=>b.cells.push(b.cells[0])],['missing-overwrite',b=>b.overwriteConfirmed=false],
    ['outside',b=>b.cells[1].studentId='outside'],['max',b=>b.cells[1].max=19],['revision',b=>b.cells[1].itemRevision=0],
    ['automatic',b=>b.cells[1].itemId='auto'],['null',b=>b.cells[1].value=null]]) {
    const b=structuredClone(review);edit(b);await assert.rejects(()=>apply(name,b));assert.deepEqual(await state(),original);
  }
  record('native_whole_batch_validation','Bad late cell, duplicate, overwrite, owner enrollment, maxima, revisions, automatic and NULL reject whole batch with no receipt or partial grade.');
  await q(`select set_config('request.jwt.claim.sub','${OTHER}',false);set role authenticated;`);
  await assert.rejects(()=>apply('foreign',review));assert.equal((await q('select * from rakeezx.scores')).rowCount,0);
  await assert.rejects(()=>q('select * from rakeezx.score_domain_receipts where owner_id=$1',[OWNER]).then(r=>{assert.equal(r.rowCount,0);throw Error('checked');}));
  await q(`reset role;select set_config('request.jwt.claim.sub','${OWNER}',false)`);assert.deepEqual(await state(),original);
  record('native_owner_isolation','Authenticated B cannot read A grades/receipts or commit A batch.');
  await q("update rakeezx.scores set value=11 where id='s'");const stale=await state();await assert.rejects(()=>apply('stale',review),e=>e.code==='PT409');assert.deepEqual(await state(),stale);
  const current=await batch();
  await q(`create function rakeezx.n90_test_failure() returns trigger language plpgsql as $$begin if new.student_id='b' then raise exception 'synthetic late failure';end if;return new;end$$;
    create trigger n90_test_failure before insert on rakeezx.scores for each row execute function rakeezx.n90_test_failure();`);
  await assert.rejects(()=>apply('failure',current),/synthetic late failure/);assert.deepEqual(await state(),stale);
  await q('drop trigger n90_test_failure on rakeezx.scores;drop function rakeezx.n90_test_failure()');
  record('native_stale_and_injected_rollback','Changed cell PT409; native failure after earlier write rolls back entire transaction including receipt.');
  const receipt=await apply('ok',current);assert.deepEqual(await apply('ok',current),receipt);
  await q("update rakeezx.scores set value=7 where id='s'");assert.deepEqual(await apply('ok',current),receipt);assert.equal(Number((await q("select value from rakeezx.scores where id='s'")).rows[0].value),7);
  const changed=structuredClone(current);changed.cells[0].value=8;await assert.rejects(()=>apply('ok',changed),e=>e.code==='22023');
  record('native_lost_ack_idempotent_no_overwrite','Exact retry returns saved receipt even after another cell edit, leaves later 7 unchanged, changed envelope under same ID refused. Zero retained duplicate mutations.');
  const n=await batch();n.cells=[{studentId:'a',itemId:'new',max:5,itemRevision:0,scoreId:null,scoreRevision:0,old:null,value:4}];n.newItems=[{id:'new',name:'Explicit manual',max:5}];
  const created=await apply('create',n);assert.equal(created.items[0].score_mode,'direct');assert.equal(created.items[0].auto,null);assert.equal(created.scores[0].value,4);
  assert.deepEqual(await apply('create',n),created);
  const bad=structuredClone(n);bad.newItems[0].id='new2';bad.cells[0].itemId='new2';bad.cells[0].value=6;const prior=await state();await assert.rejects(()=>apply('create-fail',bad));assert.deepEqual(await state(),prior);
  record('native_explicit_new_item_atomic','Named maximum-backed direct item and marks created together; invalid mark rolls back new item; retry preserves identity.');
  await q('set role anon');await assert.rejects(()=>apply('anon',n),e=>e.code==='42501');await q('reset role');
  record('native_source_ACL','Exact SQL SHA256 '+sha256+'; both new functions security definer/search_path empty; execute authenticated only; reused existing owner receipt ACL/RLS.');
  }
  if(process.argv.includes('--calm')) checks.push(...await (await import('./n90-grade-ux-standalone.mjs')).browserFlow({q,owner:OWNER}));
  if(!process.argv.includes('--calm') && (process.argv.includes('--browser') || process.argv.includes('--browser-only'))) checks.push(...await (await import('./n90-unified-browser.mjs')).browserFlow({q,owner:OWNER}));
} finally {
  await client?.end();if(started)run('pg_ctl',['-D',cluster,'-w','-m','fast','stop']);
  assert.ok(cluster.startsWith(path.resolve('test-results')+path.sep));await rm(cluster,{recursive:true,force:true});
  await writeFile(path.join(artifact,'result.json'),JSON.stringify({migration,sha256,functions,checks,ownedServerStopped:true,ownedClusterRemoved:true},null,2));
}
