import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {IDBFactory} from 'fake-indexeddb';
import {PGlite} from '@electric-sql/pglite';
import * as db from '../src/lib/db.js';
import {evaluateSectionCurriculumScope,evaluateTeachingCourseBinding}
  from '../src/lib/curriculum-context-v2.js';
import {createCurriculumV2StagingBridge}
  from '../src/lib/curriculum-v2-staging-bridge.js';
import {v2ScopeToCloud,v2ScopeFromCloud,v2BindingToCloud,v2BindingFromCloud}
  from '../src/lib/curriculum-v2-sync-contract.js';
import {buildBackup,validateBackupIntegrity}
  from '../src/lib/export.js';
import {N71_V2_RESEARCH_STORES,planN71V2ResearchRestore}
  from '../src/lib/curriculum-v2-n71-stage.js';
import {createN71V2DemoRestore}
  from '../src/lib/curriculum-v2-n71-demo-restore.js';
import {assertCurriculumV2CloudPayloadSupported}
  from '../src/lib/curriculum-v2-cloud-restore-gate.js';

globalThis.crypto??=webcrypto;
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const YEAR='y:1448',SEC='sec:A',TERM='tm:1';
const SUB='sub:science',TCH='tch:A:science';
const idbBefore=globalThis.indexedDB;
const dbA=new IDBFactory(),dbB=new IDBFactory();
let actor=A,clock=1793010203040;
db.selectDatabase('rakeezx-demo');
db.setProductWriteGuard(()=>{});
function use(factory){db.closeDB();globalThis.indexedDB=factory;}
const legacy={
  years:[{id:YEAR,ownerId:A,status:'active',label:'1448–1449',updatedAt:100}],
  terms:[{id:TERM,ownerId:A,yearId:YEAR,status:'active',index:1,updatedAt:101}],
  sections:[{id:SEC,ownerId:A,yearId:YEAR,grade:4,label:'1',updatedAt:102}],
  subjects:[{id:SUB,ownerId:A,name:'العلوم',updatedAt:103}],
  teachings:[{id:TCH,ownerId:A,sectionId:SEC,subjectId:SUB,termId:TERM,updatedAt:104}],
  students:[{id:'student:A',ownerId:A,name:'مصطنع',updatedAt:105}],
  enrollments:[{id:'en:A',ownerId:A,sectionId:SEC,studentId:'student:A',
    status:'active',updatedAt:106}],
  items:[{id:'item:A',ownerId:A,teachingId:TCH,name:'الاختبار',max:20,updatedAt:107}],
  scores:[{id:'score:A',ownerId:A,itemId:'item:A',studentId:'student:A',
    value:17,updatedAt:108}],
};
const empty=()=>Object.fromEntries(N71_V2_RESEARCH_STORES.map(x=>[x,[]]));
const PG_FIXTURE=[
  'create schema auth;',
  'create role authenticated nologin;',
  'create role anon nologin;',
  'create schema rakeezx;',
  "create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;",
  'grant usage on schema auth to authenticated;',
  'grant execute on function auth.uid() to authenticated;',
  'create table rakeezx.years(owner_id uuid not null,id text not null,primary key(owner_id,id));',
  'create table rakeezx.subjects(owner_id uuid not null,id text not null,primary key(owner_id,id));',
  'create table rakeezx.sections(owner_id uuid not null,id text not null,year_id text not null,grade int not null,label text,primary key(owner_id,id),foreign key(owner_id,year_id) references rakeezx.years(owner_id,id));',
  'create table rakeezx.teachings(owner_id uuid not null,id text not null,section_id text not null,subject_id text not null,term_id text not null,primary key(owner_id,id),foreign key(owner_id,section_id) references rakeezx.sections(owner_id,id));',
  'create table rakeezx.students(owner_id uuid not null,id text not null,name text,primary key(owner_id,id));',
  'create table rakeezx.scores(owner_id uuid not null,id text not null,value int,primary key(owner_id,id));',
].join('\n');
const sqlV2=new URL('../docs/automation-evidence/20261026/curriculum_v2_staging_candidate_NOT_DEPLOYED.sql',import.meta.url);
const sqlJournal=new URL('../docs/automation-evidence/20261026/n71_v2_atomic_journal_RESEARCH_ONLY.sql',import.meta.url);
const sourceDigest=pg=>pg.query(
  'select rakeezx.n71_v2_research_source_digest() as digest'
).then(x=>x.rows[0].digest);
const stage=async(pg,rid,hash,revision,envelope,expectedDigest=null)=>{
  const digest=expectedDigest??await sourceDigest(pg);
  const result=await pg.query(
    'select rakeezx.n71_v2_research_stage($1,$2,$3,$4,$5) as result',
    [rid,hash,revision,digest,JSON.stringify(envelope)]);
  return result.rows[0].result;
};
const finalize=(pg,rid,hash,stageHash)=>pg.query(
  'select rakeezx.n71_v2_research_finalize($1,$2,$3) as result',
  [rid,hash,stageHash]).then(x=>x.rows[0].result);
const owner=(pg,id)=>pg.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);
const ensure=(v,msg)=>{if(!v)throw Error(msg);};

test('N71 V2 Product backup A → real PGlite journal/sidecars → fresh Product B (synthetic only)',async t=>{
 const pg=new PGlite();
 try{
   use(dbA);
   await db.clearAll();await db.putAcross(legacy);
   const sectionScope=evaluateSectionCurriculumScope({
     ownerId:A,sectionId:SEC,yearId:YEAR,program:'general',stage:'primary',
     level:'4',legacyGrade:4,
   });
   const link=evaluateTeachingCourseBinding({
     ownerId:A,sectionScope,sectionId:SEC,teachingId:TCH,
     subjectId:SUB,termId:TERM,name:'العلوم',
   });
   const bridge=createCurriculumV2StagingBridge({
     database:db,currentOwner:()=>actor,clock:()=>++clock,allowSyntheticWrites:true,
   });
   await bridge.saveScope(sectionScope);
   await bridge.saveBinding(link);
   const backup=await buildBackup({
     sourceOwnerId:A,backupId:'synthetic-n71-v2-a-to-b-20261026',
   });
   const backupHash=backup.backupHash;
   await t.test('A generated a genuinely hashed V5 backup with V2 and real grade, not Outbox',async()=>{
     assert.equal((await validateBackupIntegrity(backup)).integrity,'verified');
     assert.equal(backup.data.scores[0].value,17);
     assert.equal(backup.data.teachingCourseBindings.length,1);
     assert.equal(backup.data.sectionCurriculumScopes.length,1);
     assert.equal('outbox' in backup.data,false);
     assert.throws(()=>assertCurriculumV2CloudPayloadSupported(backup),
       e=>e?.code==='CURRICULUM_V2_CLOUD_RESTORE_NOT_READY');
   });

   const serverBefore={...empty(),...structuredClone(legacy)};
   const planned=await planN71V2ResearchRestore({
     payload:backup,serverData:serverBefore,ownerId:A,
     ownerHistoryRevision:'7',verifiedProvider:true,
   });
   assert.equal(planned.syntheticWouldInsert,2);
   assert.equal(planned.productionReady,false);
   const transfer={
     scopes:backup.data.sectionCurriculumScopes.map(x=>v2ScopeToCloud(x,A)),
     bindings:backup.data.teachingCourseBindings.map(x=>v2BindingToCloud(x,A)),
   };
   assert.equal(transfer.scopes[0].section_id,SEC);
   assert.equal(transfer.bindings[0].teaching_id,TCH);

   await pg.exec(PG_FIXTURE);
   await pg.query('insert into rakeezx.years(owner_id,id) values($1,$2)',[A,YEAR]);
   await pg.query('insert into rakeezx.subjects(owner_id,id) values($1,$2)',[A,SUB]);
   await pg.query("insert into rakeezx.sections(owner_id,id,year_id,grade,label) values($1,$2,$3,4,'1')",[A,SEC,YEAR]);
   await pg.query('insert into rakeezx.teachings(owner_id,id,section_id,subject_id,term_id) values($1,$2,$3,$4,$5)',[A,TCH,SEC,SUB,TERM]);
   await pg.query("insert into rakeezx.students(owner_id,id,name) values($1,'student:A','SYNTHETIC')",[A]);
   await pg.query("insert into rakeezx.scores(owner_id,id,value) values($1,'score:A',17)",[A]);
   await pg.exec(await readFile(sqlV2,'utf8'));
   await pg.exec(await readFile(sqlJournal,'utf8'));
   await pg.query('insert into rakeezx.n71_v2_research_owner_revision(owner_id,revision) values($1,7)',[A]);
   await pg.exec('set role authenticated');await owner(pg,A);

   let stageReceipt;
   await t.test('A stage request is durable but has zero sidecar writes before finalize',async()=>{
     stageReceipt=await stage(pg,'n71:A-to-B',backupHash,7,transfer);
     assert.equal(stageReceipt.protocol,'N71_V2_RESEARCH_ONLY');
     assert.equal(stageReceipt.state,'staged');
     assert.equal(stageReceipt.stageHash.length,64);
     assert.equal((await pg.query('select count(*)::int n from rakeezx.section_curriculum_scopes')).rows[0].n,0);
   });
   let committed;
   await t.test('lost server finalize reply replays one durable immutable receipt',async()=>{
     await finalize(pg,'n71:A-to-B',backupHash,stageReceipt.stageHash); // simulated response lost
     committed=await finalize(pg,'n71:A-to-B',backupHash,stageReceipt.stageHash);
     const repeated=await stage(pg,'n71:A-to-B',backupHash,7,transfer,
       stageReceipt.sourceDigest);
     assert.equal(repeated.state,'finalized');
     assert.equal(Number(committed.ownerRevision),8);
     assert.equal(committed.receipt.addedScopes,1);
     assert.equal(committed.receipt.addedBindings,1);
     assert.equal(committed.canonicalDigest.length,64);
     const saved=(await pg.query('select revision from rakeezx.n71_v2_research_owner_revision')).rows[0];
     assert.equal(Number(saved.revision),8);
   });
   const [scopeSql,bindingSql]=await Promise.all([
     pg.query('select * from rakeezx.section_curriculum_scopes'),
     pg.query('select * from rakeezx.teaching_course_bindings'),
   ]);
   const providerRows={
     ...serverBefore,
     sectionCurriculumScopes:scopeSql.rows.map(x=>v2ScopeFromCloud(x,A)),
     teachingCourseBindings:bindingSql.rows.map(x=>v2BindingFromCloud(x,A)),
   };
   assert.equal(providerRows.sectionCurriculumScopes.length,1);
   assert.equal(providerRows.teachingCourseBindings.length,1);
   await t.test('server canonical V2 records are still tied to A original Subject and cohort',async()=>{
     const stage=await planN71V2ResearchRestore({
       payload:backup,serverData:providerRows,ownerId:A,
       ownerHistoryRevision:'8',verifiedProvider:true,
     });
     assert.equal(stage.syntheticWouldInsert,0);
     assert.equal(stage.decisions.length,2);
     assert.ok(stage.decisions.every(row=>row.decision==='KEEP_SERVER'));
   });
   use(dbB);await db.clearAll();
   const receiver=createN71V2DemoRestore({
     database:db,currentOwner:()=>actor,enabled:true,
   });
   await t.test('B installs the verified research projection atomically, no duplicate grade/roster',async()=>{
     const state=await receiver.intoFresh({
       ownerId:A,payload:backup,serverData:providerRows,ownerHistoryRevision:'8',
     });
     assert.equal(state.status,'synthetic_restored');
     assert.equal(state.cloudRestoreSupported,false);
     assert.equal(state.serverConfirmed,false);
     assert.equal((await db.get('scores','score:A')).value,17);
     assert.equal((await db.getAll('students')).length,1);
     assert.equal((await db.getAll('enrollments')).length,1);
     assert.equal((await db.get('teachingCourseBindings',link.identity)).teachingId,TCH);
     assert.equal((await db.get('sectionCurriculumScopes',sectionScope.identity)).sectionId,SEC);
     assert.deepEqual(await db.getAll('outbox'),[]);
   });
   await t.test('B reload leaves grade, IDs and official V6 course binding unchanged',async()=>{
     use(dbB);
     assert.equal((await db.get('scores','score:A')).value,17);
     assert.equal((await db.get('teachings',TCH)).subjectId,SUB);
     assert.equal((await db.get('teachingCourseBindings',link.identity)).subjectId,SUB);
     assert.equal((await db.getAll('sectionCurriculumScopes')).length,1);
     assert.equal((await db.getAll('students')).length,1);
   });
   await t.test('B repeated restore cannot replace any existing grades or replay Outbox',async()=>{
     await assert.rejects(receiver.intoFresh({
       ownerId:A,payload:backup,serverData:providerRows,ownerHistoryRevision:'8',
     }),e=>e?.code==='N71_V2_FRESH_RECEIVER_REQUIRED');
     assert.equal((await db.get('scores','score:A')).value,17);
   });
 }finally{
   db.closeDB();db.setProductWriteGuard(null);
   globalThis.indexedDB=idbBefore;
   await pg.close();
 }
});
