import { spawnSync, execFileSync } from 'node:child_process';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createServer } from 'node:net';
import path from 'node:path';
import assert from 'node:assert/strict';
import { DEFAULT_TIME_PROFILES } from '../src/models.js';
import { encodeSyncV2Patch } from '../src/lib/sync-v2.js';
import { pathToFileURL } from 'node:url';
const shared='C:/Users/Abody/Projects/RakeezX/artifacts/n77-native-pg17';
const {default:pg}=await import(pathToFileURL(shared+'/client/node_modules/pg/lib/index.js'));
const artifact=path.resolve('test-results/n90-current-source-native'),cluster=path.join(artifact,'cluster');
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
  const n58=['20261004070000_n58_calendar_persistence.sql','20261004070001_n58_extra_term_compatibility.sql','20261004070002_n58_effective_scope_revalidation.sql'];
  for(const name of [...await readdir('supabase/migrations'),...n58].sort().filter(n=>/^\d+.*\.sql$/.test(n))) {
    if(name==='20261014090000_n100_automatic_safe_copy.sql') {
      for(const row of JSON.parse(await readFile('tests/n100-automatic-provider-source.json','utf8'))) {
        await q(row.definition);assert.equal((await q('select md5(prosrc) hash from pg_proc where oid=$1::regprocedure',[row.signature])).rows[0].hash,row.body_md5);
      }
    }
    const body=n58.includes(name)?execFileSync('git',['show','4fa6fb8b98415a42dd0a835bfdd7038ab65b8979:supabase/migrations/'+name],{encoding:'utf8',maxBuffer:20000000}):await readFile('supabase/migrations/'+name,'utf8');
    await q(body.replace(/^\uFEFF/,'').replaceAll('\r\n','\n'));
  }
  assert.ok((await q("select pg_get_functiondef('rakeezx.n58_guard_calendar_contract()'::regprocedure) definition")).rows[0].definition.includes('N58_SESSION_CONTEXT_REQUIRED'));
  functions=(await q(`select p.proname,md5(p.prosrc) body_md5,pg_get_functiondef(p.oid) definition,p.proacl::text acl,p.prosecdef,p.proconfig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='rakeezx' and p.proname in ('reviewed_grade_import_capability','apply_reviewed_grade_import') order by 1`)).rows;
  assert.equal(functions.length,2);for(const f of functions){assert.equal(f.prosecdef,true);assert.ok(!f.acl.includes('anon=')&&!f.acl.includes(',=')&&f.acl.includes('authenticated=X'));}
  if (process.argv.includes('--service-readback')) {
    // Local-only provider-history stand-in; validate the exact new verifier before any hosted fixture.
    await q('create schema supabase_migrations;create table supabase_migrations.schema_migrations(version text,name text,statements text[])');
    await q('insert into supabase_migrations.schema_migrations values($1,$2,$3)', ['20261014100000','n90_unified_student_grade_import',[await readFile('supabase/migrations/20261014100000_n90_unified_student_grade_import.sql','utf8')]]);
    const results=await q(await readFile('tests/n90-service-readback.sql','utf8'));
    const result=results.at(-1).rows[0];
    assert.equal(result.transactional_proof.fixtureRolledBack,true);
    assert.equal(result.transactional_proof.checks.length,8);
    assert.equal(result.functions.length,4);assert.equal(result.migration_records.length,1);
    await writeFile(path.join(artifact,'service-readback.json'),JSON.stringify(result,null,2));
    record('n90_complete_hosted_verifier_local_certification','Exact hosted verification SQL passed with eight ACL/owner/atomicity/retry checks and full synthetic rollback on current native schema before service provisioning.');
  } else {
  await q(`insert into rakeezx.years(id,label,hijri_start,hijri_end) values('y','Synthetic',1448,1449);
    insert into rakeezx.terms(id,year_id,name,"index",status,start_date,end_date) values('term','y','Synthetic',1,'active','2026-08-23','2027-01-07');
    insert into rakeezx.terms(id,year_id,name,"index",status,start_date,end_date) values('term2','y','Upcoming',2,'upcoming','2027-01-17','2027-06-24');
    insert into rakeezx.subjects(id,name,slug) values('subject','Synthetic','n90');
    insert into rakeezx.sections(id,year_id,grade,label,name) values('section','y',4,'1','4/1');
    insert into rakeezx.teachings(id,section_id,subject_id,term_id) values('t','section','subject','term');
    insert into rakeezx.students(id,name) values('a','أحمد سالم'),('b','سعيد علي'),('outside','Outside');
    insert into rakeezx.enrollments(id,student_id,section_id) values('ea','a','section'),('eb','b','section');
    insert into rakeezx.items(id,teaching_id,name,max) values('i','t','Exam',20),('auto','t','Auto',20);
    update rakeezx.items set auto='attendance' where id='auto';
    insert into rakeezx.scores(id,student_id,item_id,value) values('s','a','i',10);`);
  for(const profile of DEFAULT_TIME_PROFILES) { const patch=encodeSyncV2Patch('timeProfiles',profile); const keys=Object.keys(patch); await q('insert into rakeezx.time_profiles(id,'+keys.map(k=>'"'+k+'"').join(',')+') values('+['$1',...keys.map((k,i)=>'$'+(i+2))].join(',')+')',[profile.id,...keys.map(k=>patch[k]!==null&&typeof patch[k]==='object'?JSON.stringify(patch[k]):patch[k])]); }
  const revision=(await q("select revision from rakeezx.years where id='y'")).rows[0].revision;
  await q("select rakeezx.apply_sync_v2_mutation(p_entity=>'years',p_record_id=>'y',p_mutation_id=>'current-select-G',p_device_id=>'native',p_base_revision=>$1,p_operation=>'patch',p_patch=>$2)",[revision,{calendar_preset_id:'sa-general-1448-1449'}]);
  checks.push(...await (await import('./n90-current-source-browser.mjs')).browserFlow({q,owner:OWNER}));
  }
} finally {
  await client?.end();if(started)run('pg_ctl',['-D',cluster,'-w','-m','fast','stop']);
  assert.ok(cluster.startsWith(path.resolve('test-results')+path.sep));await rm(cluster,{recursive:true,force:true});
  await writeFile(path.join(artifact,'result.json'),JSON.stringify({migration,sha256,functions,checks,ownedServerStopped:true,ownedClusterRemoved:true},null,2));
}
