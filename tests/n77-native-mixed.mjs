// Focused immutable mixed-snapshot boundary on an owned disposable native PG17
// cluster. Historical source-identical cascade/atomicity evidence is reused.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { visibleClosedTermReport, deletionScope } from '../src/lib/restore-deletion-scope.js';
import { pathToFileURL } from 'node:url';
const {default:pg}=await import(pathToFileURL('C:/Users/Abody/Projects/RakeezX/artifacts/n77-native-pg17/client/node_modules/pg/lib/index.js').href);

const artifacts='C:/Users/Abody/Projects/RakeezX/artifacts';
const binaries=artifacts+'/n77-native-pg17/package/native/bin';
const root=path.resolve('test-results/n77-native-'+crypto.randomUUID());
const data=path.join(root,'cluster'), log=path.join(root,'postgres.log');
const historical=artifacts+'/n13-n77-native-pg-convergence-20261008-0528';
const oldRoot='C:/Users/Abody/Projects/RakeezX/.worktrees/n13-d104-n77-overlap-reconcile-20261008';
const n77='supabase/migrations/20261007230123_n77_server_validated_delete.sql';
const hash=b=>createHash('sha256').update(b).digest('hex');
const normalized=b=>b.toString('utf8').replaceAll('\r\n','\n');
const command=(name,args)=>execFileSync(path.join(binaries,name+'.exe'),args,{windowsHide:true,stdio:'ignore'});
let started=false,client;
await fs.mkdir(root,{recursive:true});
// A second invocation never touches an existing cluster.
await fs.mkdir(data);
try {
  command('initdb',['-D',data,'-U','postgres','-A','trust','--encoding=UTF8','--locale=C']);
  command('pg_ctl',['-D',data,'-l',log,'-o','-h 127.0.0.1 -p 55497','-w','start']);started=true;
  client=new pg.Client({host:'127.0.0.1',port:55497,user:'postgres',database:'postgres'});await client.connect();
  const version=(await client.query('select version()')).rows[0].version;assert.match(version,/^PostgreSQL 17\.6 /);
  await client.query(`create schema auth;create schema realtime;
    create role authenticated;create role anon;create role service_role;
    create table auth.users(id uuid primary key,email text);
    create function auth.uid() returns uuid language sql stable security definer set search_path=''
      as $$select nullif(pg_catalog.current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to authenticated,anon;
    create table realtime.messages(extension text,topic text);alter table realtime.messages enable row level security;
    create function realtime.topic() returns text language sql stable as $$select pg_catalog.current_setting('realtime.topic',true)$$;
    create function realtime.send(jsonb,text,text,boolean) returns void language sql as $$select$$;`);
  const historyBytes=await fs.readFile(historical+'/migration-load.log');
  const historyText=historyBytes.subarray(0,2).equals(Buffer.from([255,254]))?historyBytes.toString('utf16le'):historyBytes.toString('utf8');
  const entries=historyText.split(/\r?\n/)
    .filter(line=>line.startsWith('PASS ')).map(line=>line.split(' ').slice(1,3));
  assert.equal(entries.length,42,'exact historical initialization chain');
  const bindings=[];
  for(const[name,expected]of entries){
    const old=await fs.readFile(path.join(oldRoot,'supabase/migrations',name));assert.equal(hash(old),expected,name);
    const sql=name.includes('n77_server_validated_delete')?await fs.readFile(n77):old;
    if(name.includes('n77_server_validated_delete'))assert.equal(normalized(sql),normalized(old));
    await client.query(sql.toString('utf8').replace(/^\uFEFF/,''));bindings.push({name,sha256:hash(sql),historicalSha256:expected});
  }
  const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  await client.query("insert into auth.users(id,email) values($1,'native-synthetic@example.invalid')",[A]);
  await client.query("select set_config('request.jwt.claim.sub',$1,false)",[A]);
  await client.query(`insert into rakeezx.years(id,label,hijri_start,hijri_end) values('y','synthetic',1500,1501);
    insert into rakeezx.terms(id,year_id,name,"index") values('term','y','synthetic',1);
    insert into rakeezx.subjects(id,name,slug) values('sub1','synthetic1','synthetic1'),('sub2','synthetic2','synthetic2');
    insert into rakeezx.sections(id,year_id,grade,label,name) values('section','y',4,'N77','synthetic'),('outside','y',5,'N77','synthetic');
    insert into rakeezx.teachings(id,section_id,subject_id,term_id) values('gone','section','sub1','term'),('last','section','sub2','term'),('kept','outside','sub1','term');
    insert into rakeezx.students(id,name) values('shared','synthetic');
    insert into rakeezx.enrollments(id,student_id,section_id) values('inside-en','shared','section'),('outside-en','shared','outside');
    insert into rakeezx.items(id,teaching_id,name,max) values('inside-item','gone','synthetic',10),('outside-item','kept','synthetic',10);`);
  const report={id:'mixed',termId:'term',payload:{teachingDocuments:[
    {teaching:{id:'gone'},section:{id:'section'},membership:[{id:'inside-en',status:'active'}]},
    {teaching:{id:'last'},section:{id:'section'},membership:[{id:'inside-en',status:'active'}]},
    {teaching:{id:'kept'},section:{id:'outside'},membership:[{id:'outside-en',status:'active'}]}]},
    sourceManifest:[{entity:'teachings',id:'gone',revision:1},{entity:'teachings',id:'last',revision:1},{entity:'teachings',id:'kept',revision:1}]};
  await client.query(`insert into rakeezx.closed_term_reports(id,term_id,year_id,version,source_manifest,payload,device_id)
    values('mixed','term','y',1,$1,$2,'native')`,[JSON.stringify(report.sourceManifest),JSON.stringify(report.payload)]);
  const bytes=async()=>(await client.query("select to_jsonb(r)::text bytes from rakeezx.closed_term_reports r where id='mixed'")).rows[0].bytes;
  const before=await bytes();await client.query('set role authenticated');
  const call=async(id,commit=false,plan=null)=>(await client.query('select rakeezx.n77_delete_teaching($1,$2,$3,$4,$5,$6) receipt',
    [id,'section',plan?.fingerprint,commit?'mixed-'+id:null,commit?'native':null,commit])).rows[0].receipt;
  const selected=await call('gone');assert.equal(selected.scope,'teaching');await call('gone',true,selected);assert.equal(await bytes(),before);
  const selectedData={sections:[{id:'section'},{id:'outside'}],teachings:[
    {id:'gone',sectionId:'section',deleted:true},{id:'last',sectionId:'section'},{id:'kept',sectionId:'outside'}]};
  const subjectProjection=visibleClosedTermReport(report,deletionScope(selectedData,selectedData));
  assert.deepEqual(subjectProjection.payload.teachingDocuments.map(d=>d.teaching.id),['last','kept']);
  const final=await call('last');assert.equal(final.scope,'section');await call('last',true,final);assert.equal(await bytes(),before);
  const finalData={sections:[{id:'section',deleted:true},{id:'outside'}],teachings:[
    {id:'gone',sectionId:'section',deleted:true},{id:'last',sectionId:'section',deleted:true},{id:'kept',sectionId:'outside'}]};
  const finalProjection=visibleClosedTermReport(report,deletionScope(finalData,finalData));
  assert.deepEqual(finalProjection.payload.teachingDocuments.map(d=>d.teaching.id),['kept']);
  assert.equal((await client.query("select count(*)::int n from rakeezx.enrollments where id='outside-en' and deleted_at is null")).rows[0].n,1);
  assert.equal((await client.query("select count(*)::int n from rakeezx.students where id='shared' and deleted_at is null")).rows[0].n,1);
  const evidence={status:'PASS',version,bindings,reportBytesSha256:hash(before),subjectScope:selected.scope,finalScope:final.scope,
    immutableBytesUnchanged:true,subjectVisible:['last','kept'],finalVisible:['kept'],sharedStudentOutsideEnrollmentPreserved:true};
  await fs.writeFile(path.join(root,'evidence.json'),JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence));
}finally{
  await client?.end();if(started)command('pg_ctl',['-D',data,'-m','fast','-w','stop']);
}
