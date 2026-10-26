import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {indexedDB} from 'fake-indexeddb';
import {PGlite} from '@electric-sql/pglite';
import {openCurriculumV2ResearchStore} from './curriculum-v2-indexeddb-research.mjs';
import {evaluateSectionCurriculumScope,evaluateTeachingCourseBinding} from '../../../../src/lib/curriculum-context-v2.js';
import {v2ScopeToCloud,v2ScopeFromCloud,v2BindingToCloud,v2BindingFromCloud} from '../../../../src/lib/curriculum-v2-sync-contract.js';
const file=fileURLToPath(new URL('./curriculum_v2_sidecars_RESEARCH_ONLY.sql',import.meta.url));
const OWNER='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const schema=[
'create schema auth;','create role authenticated nologin;','create role anon nologin;',
'create schema rakeezx;',
"create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;",
'grant usage on schema auth to authenticated;',
'grant execute on function auth.uid() to authenticated;',
'create table rakeezx.years(owner_id uuid not null,id text not null,primary key(owner_id,id));',
'create table rakeezx.subjects(owner_id uuid not null,id text not null,primary key(owner_id,id));',
'create table rakeezx.sections(owner_id uuid not null,id text not null,year_id text not null,grade int,primary key(owner_id,id));',
'create table rakeezx.teachings(owner_id uuid not null,id text not null,section_id text not null,subject_id text not null,term_id text not null,primary key(owner_id,id));'
].join('\n');
async function put(db,table,source){
 const keys=Object.keys(source);
 const sql='insert into rakeezx.'+table+' ('+keys.map(k=>'"'+k+'"').join(',')+') values ('+
   keys.map((_,i)=>'$'+(i+1)).join(',')+')';
 await db.query(sql,Object.values(source));
}
async function one(db,table,id){
 const rows=(await db.query('select * from rakeezx.'+table+' where id=$1',[id])).rows;
 assert.equal(rows.length,1);
 return rows[0];
}
test('OFFLINE -> local PGlite RLS -> second IndexedDB prototype -> tombstone roundtrip',async t=>{
 const pg=new PGlite();
 const A_NAME='rakeez-v2-research-devicea-20261025';
 const B_NAME='rakeez-v2-research-deviceb-20261025';
 let tick=1793000101000;
 const a=openCurriculumV2ResearchStore({databaseName:A_NAME,indexedDB,currentOwner:()=>OWNER,clock:()=>++tick});
 let b=openCurriculumV2ResearchStore({databaseName:B_NAME,indexedDB,currentOwner:()=>OWNER,clock:()=>++tick});
 try{
  await pg.exec(schema);
  await pg.query('insert into rakeezx.years(owner_id,id) values ($1,$2)',[OWNER,'y:1448-1449']);
  await pg.query('insert into rakeezx.subjects(owner_id,id) values ($1,$2)',[OWNER,'sub:science']);
  await pg.query('insert into rakeezx.sections(owner_id,id,year_id,grade) values ($1,$2,$3,$4)',[OWNER,'sec:A','y:1448-1449',4]);
  await pg.query('insert into rakeezx.teachings(owner_id,id,section_id,subject_id,term_id) values ($1,$2,$3,$4,$5)',[OWNER,'tch:A:science','sec:A','sub:science','tm:one']);
  await pg.exec(await readFile(file,'utf8'));
  await pg.exec('set role authenticated');
  await pg.query("select set_config('request.jwt.claim.sub',$1,false)",[OWNER]);

  const sectionDraft=evaluateSectionCurriculumScope({
   ownerId:OWNER,sectionId:'sec:A',yearId:'y:1448-1449',
   program:'general',stage:'primary',level:'4',legacyGrade:4
  });
  const courseDraft=evaluateTeachingCourseBinding({
   ownerId:OWNER,sectionScope:sectionDraft,sectionId:'sec:A',
   teachingId:'tch:A:science',subjectId:'sub:science',termId:'tm:one',name:'العلوم'
  });
  await t.test('device A drafts survive IndexedDB before cloud',async()=>{
   await a.putScope(sectionDraft);
   await a.putBinding(courseDraft);
   assert.equal((await a.scopes(OWNER)).length,1);
   assert.equal((await a.bindings(OWNER)).length,1);
  });
  await t.test('device A sends exact allowlisted V2 envelopes to RLS protected PostgreSQL',async()=>{
   const scope=(await a.scopes(OWNER))[0],binding=(await a.bindings(OWNER))[0];
   await put(pg,'section_curriculum_scopes',v2ScopeToCloud(scope,OWNER,{deviceId:'test-device-A'}));
   await put(pg,'teaching_course_bindings',v2BindingToCloud(binding,OWNER,{deviceId:'test-device-A'}));
   assert.equal((await one(pg,'section_curriculum_scopes',scope.id)).owner_id,OWNER);
   assert.equal((await one(pg,'teaching_course_bindings',binding.id)).course_kind,'course');
  });
  await t.test('device B independently imports source-verified cloud payloads',async()=>{
   const cloudScope=await one(pg,'section_curriculum_scopes',sectionDraft.identity);
   const cloudCourse=await one(pg,'teaching_course_bindings',courseDraft.identity);
   await b.importRemoteScope(v2ScopeFromCloud(cloudScope,OWNER));
   await b.importRemoteBinding(v2BindingFromCloud(cloudCourse,OWNER));
   const saved=(await b.scopes(OWNER))[0],course=(await b.bindings(OWNER))[0];
   assert.equal(saved.program,'general');
   assert.equal(saved.sectionId,'sec:A');
   assert.equal(course.name,'العلوم');
   assert.equal(course.sectionScopeIdentity,saved.id);
  });
  await t.test('device B reopens database and retains independently imported identities',async()=>{
   await b.close();
   b=openCurriculumV2ResearchStore({databaseName:B_NAME,indexedDB,currentOwner:()=>OWNER,clock:()=>++tick});
   assert.equal((await b.scopes(OWNER))[0].id,sectionDraft.identity);
   assert.equal((await b.bindings(OWNER))[0].id,courseDraft.identity);
  });
  await t.test('one account cannot query another user during provider RLS session',async()=>{
   await pg.query("select set_config('request.jwt.claim.sub',$1,false)",[B]);
   const x=(await pg.query('select count(*)::int as n from rakeezx.section_curriculum_scopes')).rows[0];
   assert.equal(x.n,0);
   await pg.query("select set_config('request.jwt.claim.sub',$1,false)",[OWNER]);
  });
  await t.test('device A retires course first then section with local tombstones',async()=>{
   await a.retireBinding(OWNER,courseDraft.identity);
   await a.retireScope(OWNER,sectionDraft.identity);
   assert.equal((await a.bindings(OWNER))[0].deleted,true);
   assert.equal((await a.scopes(OWNER))[0].deleted,true);
  });
  await t.test('retired course and section reach PostgreSQL without physical DELETE',async()=>{
   const lc=(await a.bindings(OWNER))[0],ls=(await a.scopes(OWNER))[0];
   const rc=v2BindingToCloud(lc,OWNER),rs=v2ScopeToCloud(ls,OWNER);
   await pg.query('update rakeezx.teaching_course_bindings set deleted_at=$1,client_updated_at=$2 where owner_id=$3 and id=$4',
     [rc.deleted_at,rc.client_updated_at,OWNER,lc.id]);
   await pg.query('update rakeezx.section_curriculum_scopes set deleted_at=$1,client_updated_at=$2 where owner_id=$3 and id=$4',
     [rs.deleted_at,rs.client_updated_at,OWNER,ls.id]);
   assert.ok((await one(pg,'section_curriculum_scopes',ls.id)).deleted_at);
   assert.ok((await one(pg,'teaching_course_bindings',lc.id)).deleted_at);
  });
  await t.test('device B replays dependency-ordered tombstones safely',async()=>{
   const remoteBinding=v2BindingFromCloud(await one(pg,'teaching_course_bindings',courseDraft.identity),OWNER);
   const remoteScope=v2ScopeFromCloud(await one(pg,'section_curriculum_scopes',sectionDraft.identity),OWNER);
   await b.importRemoteBinding(remoteBinding);
   await b.importRemoteScope(remoteScope);
   assert.equal((await b.scopes(OWNER))[0].deleted,true);
   assert.equal((await b.bindings(OWNER))[0].deleted,true);
  });
  await t.test('closed and reopened device B keeps tombstones (no resurrection)',async()=>{
   await b.close();
   b=openCurriculumV2ResearchStore({databaseName:B_NAME,indexedDB,currentOwner:()=>OWNER,clock:()=>++tick});
   assert.equal((await b.scopes(OWNER))[0].deleted,true);
   assert.equal((await b.bindings(OWNER))[0].deleted,true);
   await assert.rejects(b.putScope(sectionDraft),/TOMBSTONE_MUST_NOT_RESURRECT/);
  });
 }finally{
  await Promise.allSettled([a.close(),b.close(),pg.close()]);
  indexedDB.deleteDatabase(A_NAME);
  indexedDB.deleteDatabase(B_NAME);
 }
});
