import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {sha256Hex,backupHashInput} from '../src/lib/export.js';
import {evaluateSectionCurriculumScope,evaluateTeachingCourseBinding} from '../src/lib/curriculum-context-v2.js';
import {N71_V2_RESEARCH_PROTOCOL,N71_V2_RESEARCH_STORES,planN71V2ResearchRestore as plan} from '../src/lib/curriculum-v2-n71-stage.js';
import {PORTABLE_CLOUD_RESTORE_STORES,planCloudRestore} from '../src/lib/backup-v2.js';
import {classifyN71V2SourceCompleteness} from '../src/lib/curriculum-v2-n71-source-compat.js';
globalThis.crypto ??= webcrypto;

const OWNER='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const sectionId='sec:synthetic-four-a',yearId='y:1448-1449',teachingId='tch:science';
const termId='tm:one',subjectId='sub:science';
const dScope=evaluateSectionCurriculumScope({
 ownerId:OWNER,sectionId,yearId,program:'general',
 stage:'primary',level:'4',legacyGrade:4,
});
const dCourse=evaluateTeachingCourseBinding({
 ownerId:OWNER,sectionScope:dScope,sectionId,teachingId,subjectId,
 termId,name:'العلوم',
});
assert.equal(dScope.state,'draft');
assert.equal(dCourse.state,'draft');
const stamp=1793000101000;
const scope=()=>({
 id:dScope.identity,ownerId:OWNER,sectionId,yearId,
 program:'general',stage:'primary',level:'4',track:null,
 edition:dScope.edition,scopeKey:dScope.scopeKey,sourceUrl:dScope.dataSource,
 legacyGrade:4,updatedAt:stamp,deleted:false,serverRevision:null,
});
const binding=()=>({
 id:dCourse.identity,ownerId:OWNER,sectionId,sectionScopeIdentity:dScope.identity,
 teachingId,subjectId,termId,courseKey:dCourse.courseKey,
 name:'العلوم',kind:'course',edition:'sixth',sourceUrl:dCourse.sourceUrl,
 sourcePage:Number(dCourse.sourceUrl.match(/#page=(\d+)/)[1]),
 updatedAt:stamp,deleted:false,serverRevision:null,
});
const ancestors=()=>({
 years:[{id:yearId,ownerId:OWNER,label:'1448-1449'}],
 terms:[{id:termId,ownerId:OWNER,yearId}],
 sections:[{id:sectionId,ownerId:OWNER,yearId,grade:4,label:'1'}],
 subjects:[{id:subjectId,ownerId:OWNER,name:'العلوم'}],
 teachings:[{id:teachingId,ownerId:OWNER,sectionId,subjectId,termId}],
 students:[{id:'student:1',ownerId:OWNER,name:'Synthetic-only'}],
 items:[{id:'item:1',ownerId:OWNER,teachingId,max:20}],
 scores:[{id:'score:1',ownerId:OWNER,itemId:'item:1',studentId:'student:1',value:16}],
});
const empty=()=>Object.fromEntries(N71_V2_RESEARCH_STORES.map(name=>[name,[]]));
const payloadData=()=>({
 ...empty(),...ancestors(),
 sectionCurriculumScopes:[scope()],teachingCourseBindings:[binding()],
});
const server=({withParents=true,withSidecars=false}={})=>({
 ...empty(),...(withParents?ancestors():{}),
 ...(withSidecars?{
   sectionCurriculumScopes:[scope()],
   teachingCourseBindings:[binding()],
 }:{}),
});
async function backup(data=payloadData()){
 const baselines=Object.fromEntries(Object.entries(data).map(([k,list])=>
  [k,list.map(row=>({id:row.id,revision:0,fieldRevisions:{},deleted:row.deleted===true,value:null}))]));
 const p={app:'rakeezx',version:5,backupId:'synthetic-n71-v2-001',
  sourceOwnerId:OWNER,exportedAt:'2026-10-26T10:00:00.000Z',data,baselines};
 p.backupHash=await sha256Hex(backupHashInput(p));
 return p;
}
const request=async(data=payloadData(),cloud=server(),ownerHistoryRevision='1')=>
 plan({payload:await backup(data),serverData:cloud,ownerId:OWNER,
  ownerHistoryRevision,verifiedProvider:true});
const rejects=(code)=>e=>e.code===code || String(e.code??'').startsWith(code);

test('N71 V2 full-domain research staging is owner-safe and never deploys',async t=>{
 await t.test('V2 manifest includes all N71 V1 stores, plus exact two sidecars',()=>{
   assert.equal(N71_V2_RESEARCH_STORES.length,PORTABLE_CLOUD_RESTORE_STORES.length+2);
   assert.equal(new Set(N71_V2_RESEARCH_STORES).size,N71_V2_RESEARCH_STORES.length);
   assert.ok(N71_V2_RESEARCH_STORES.indexOf('sectionCurriculumScopes')>
     N71_V2_RESEARCH_STORES.indexOf('sections'));
   assert.ok(N71_V2_RESEARCH_STORES.indexOf('teachingCourseBindings')>
     N71_V2_RESEARCH_STORES.indexOf('teachings'));
 });
 await t.test('new V2 restore stage preserves legacy score + students and both sidecars',async()=>{
   const cloud=server({withParents:true,withSidecars:false});
   const before=structuredClone(cloud);
   const result=await request(payloadData(),cloud);
   assert.equal(result.protocol,N71_V2_RESEARCH_PROTOCOL);
   assert.equal(result.syntheticWouldInsert,2);
   assert.equal(result.productionReady,false);
   assert.equal(result.canonicalSidecars.sectionCurriculumScopes[0].id,dScope.identity);
   assert.equal(result.canonicalSidecars.teachingCourseBindings[0].id,dCourse.identity);
   assert.equal(result.stores.length,N71_V2_RESEARCH_STORES.length);
   assert.ok(result.manifestDigest.length===64);
   assert.deepEqual(cloud,before);
   assert.equal(cloud.scores[0].value,16);
   assert.equal(cloud.students[0].id,'student:1');
 });
 await t.test('repeat of identical snapshot retains identities and stable manifest',async()=>{
   const rows=server({withSidecars:true});
   const a=await request(payloadData(),rows);
   const b=await request(payloadData(),rows);
   assert.equal(a.syntheticWouldInsert,0);
   assert.equal(a.manifestDigest,b.manifestDigest);
   assert.ok(a.decisions.every(x=>x.decision==='KEEP_SERVER'));
 });
 await t.test('cannot bypass existing N71 V1 feature gate by declaring a V2 plan',async()=>{
   const p=await backup();
   assert.throws(()=>planCloudRestore(p,{}),rejects('CURRICULUM_V2_CLOUD_RESTORE_NOT_READY'));
 });
 await t.test('stage refuses unverified or missing provider evidence',async()=>{
   await assert.rejects(plan({payload:await backup(),serverData:server(),
     ownerId:OWNER,ownerHistoryRevision:'1',verifiedProvider:false}),
    rejects('N71_V2_SIMULATION_PROVIDER_REQUIRED'));
 });
 await t.test('signed backup hash mismatch fails even when record shapes are valid',async()=>{
   const p=await backup();
   p.data.sectionCurriculumScopes[0].program='tahfiz';
   await assert.rejects(plan({payload:p,serverData:server(),
    ownerId:OWNER,ownerHistoryRevision:'1',verifiedProvider:true}),
    rejects('N71_V2_BACKUP_INTEGRITY_INVALID'));
 });
 await t.test('backup must explicitly contain the two sidecar stores',async()=>{
   const p=await backup();delete p.data.teachingCourseBindings;
   delete p.baselines.teachingCourseBindings;
   p.backupHash=await sha256Hex(backupHashInput(p));
   await assert.rejects(plan({payload:p,serverData:server(),
     ownerId:OWNER,ownerHistoryRevision:'1',verifiedProvider:true}),
    rejects('N71_V2_BACKUP_STORE_MISSING:teachingCourseBindings'));
 });
 await t.test('legacy V5 source missing BOTH V2 sidecars is reported, never silently upgraded',async()=>{
   const p=await backup();
   for(const name of ['sectionCurriculumScopes','teachingCourseBindings']){
     delete p.data[name];
     delete p.baselines[name];
   }
   p.backupHash=await sha256Hex(backupHashInput(p));
   const compat=classifyN71V2SourceCompleteness(p);
   assert.equal(compat.status,'legacy_v5_review_required');
   assert.equal(compat.shapeEligibleForV2Planning,false);
   assert.equal(compat.canCommit,false);
   assert.equal(compat.requiresLegacySourceReview,true);
   assert.equal(compat.serverSidecarsMustBePreserved,true);
   await assert.rejects(plan({payload:p,serverData:server({withSidecars:true}),
     ownerId:OWNER,ownerHistoryRevision:'1',verifiedProvider:true}),
     rejects('N71_V2_LEGACY_V5_NOT_SILENTLY_COMPLETE'));
 });
 await t.test('V5 source with all explicit sidecars is recognized as full V2',async()=>{
   const p=await backup();
   const compat=classifyN71V2SourceCompleteness(p);
   assert.equal(compat.status,'full_v2_backup');
   assert.equal(compat.shapeEligibleForV2Planning,true);
   assert.equal(compat.canCommit,false);
   assert.equal(compat.productionEligible,false);
   const partial=structuredClone(p);
   delete partial.baselines.sectionCurriculumScopes;
   assert.equal(classifyN71V2SourceCompleteness(partial).status,'partial_v2_invalid');
 });
 await t.test('server snapshot missing one V2 store is not full-domain restore',async()=>{
   const cloud=server();delete cloud.sectionCurriculumScopes;
   await assert.rejects(request(payloadData(),cloud),rejects('N71_V2_SERVER_STORE_MISSING:sectionCurriculumScopes'));
 });
 await t.test('other owner backup or fake owner row always rejected',async()=>{
   const p=await backup();p.sourceOwnerId=OTHER;
   p.backupHash=await sha256Hex(backupHashInput(p));
   await assert.rejects(plan({payload:p,serverData:server(),
    ownerId:OWNER,ownerHistoryRevision:'1',verifiedProvider:true}),
    rejects('N71_V2_BACKUP_OWNER_MISMATCH'));
   const data=payloadData();data.sectionCurriculumScopes[0].ownerId=OTHER;
   await assert.rejects(request(data),rejects('N71_V2_CROSS_OWNER:sectionCurriculumScopes'));
 });
 await t.test('empty owner requires actual history zero, rather than unproven overwrite',async()=>{
   await assert.rejects(request(payloadData(),server({withParents:false}),null),
     rejects('N71_V2_EMPTY_OWNER_HISTORY_NOT_PROVEN'));
   const stage=await request(payloadData(),server({withParents:false}),'0');
   assert.equal(stage.syntheticWouldInsert,2);
 });
 await t.test('active tombstone on server cannot be resurrected from old backup',async()=>{
   const cloud=server({withSidecars:true});
   for(const store of ['sectionCurriculumScopes','teachingCourseBindings']){
    cloud[store][0].deleted=true;
    cloud[store][0].deletedAt=new Date(stamp).toISOString();
   }
   await assert.rejects(request(payloadData(),cloud),
     rejects('N71_V2_TOMBSTONE_RESURRECTION'));
 });
 await t.test('live child pointing to deleted section or scope never restores',async()=>{
   const data=payloadData();data.sections[0].deleted=true;
   await assert.rejects(request(data),rejects('N71_V2_DELETION_ANCESTRY_CONFLICT:sections'));
   const data2=payloadData();data2.sectionCurriculumScopes[0].deleted=true;
   data2.sectionCurriculumScopes[0].deletedAt=new Date(stamp).toISOString();
   await assert.rejects(request(data2),rejects('N71_V2_LIVE_DELETED_ANCESTOR'));
 });
 await t.test('changed programme under same section identity is a conflict',async()=>{
   const data=payloadData();data.sectionCurriculumScopes[0].program='tahfiz';
   await assert.rejects(request(data),rejects('N71_V2_SCOPE_SOURCE_INVALID'));
 });
 await t.test('course association must agree with teaching/subject/term',async()=>{
   const data=payloadData();data.teachingCourseBindings[0].subjectId='sub:forged';
   await assert.rejects(request(data),rejects('N71_V2_BINDING_PARENT_MISMATCH'));
   const data2=payloadData();data2.teachingCourseBindings[0].sourceUrl='https://example.org/';
   await assert.rejects(request(data2),rejects('N71_V2_BINDING_SOURCE_INVALID'));
 });
 await t.test('no two active curricula for the same section, including server-only rows',async()=>{
   const data=payloadData(),cloud=server();
   const extra={...scope(),id:'unexpected:second-scope',updatedAt:stamp+2};
   cloud.sectionCurriculumScopes.push(extra);
   await assert.rejects(request(data,cloud),rejects('N71_V2_SCOPE_SOURCE_INVALID'));
 });
 await t.test('existing server-side V2 rows not in backup are never dropped',async()=>{
   const data=payloadData();data.sectionCurriculumScopes=[];data.teachingCourseBindings=[];
   const cloud=server({withSidecars:true});
   const x=await request(data,cloud);
   assert.equal(x.syntheticWouldInsert,0);
   assert.equal(x.canonicalSidecars.sectionCurriculumScopes.length,1);
   assert.equal(x.canonicalSidecars.teachingCourseBindings.length,1);
 });
 await t.test('deleted backup row cannot silently replace active current server row',async()=>{
   const data=payloadData();data.sectionCurriculumScopes[0].deleted=true;
   data.sectionCurriculumScopes[0].deletedAt=new Date(stamp).toISOString();
   await assert.rejects(request(data,server({withSidecars:true})),
     rejects('N71_V2_ACTIVE_CONFLICT:sectionCurriculumScopes'));
 });
 await t.test('invalid future server revision fails with no writes',async()=>{
   const cloud=server({withSidecars:true});
   cloud.sectionCurriculumScopes[0].serverRevision=-1;
   await assert.rejects(request(payloadData(),cloud),
     rejects('N71_V2_SERVER_ROW_INVALID:sectionCurriculumScopes'));
 });
 await t.test('N77 tombstoned score item cannot be used to revive old grade',async()=>{
   const data=payloadData(),cloud=server();
   data.items[0].deleted=true;
   cloud.items[0].deleted=true;
   await assert.rejects(request(data,cloud),rejects('N71_V2_DELETED_ANCESTOR:scores'));
 });
 await t.test('a missing Subject parent cannot create an orphan active Teaching',async()=>{
   const data=payloadData(),cloud=server();
   data.subjects=[];cloud.subjects=[];
   await assert.rejects(request(data,cloud),
     rejects('N71_V2_GRAPH_PARENT_MISSING:subjects'));
 });
 await t.test('a score linked to a nonexistent student is not restorable',async()=>{
   const data=payloadData(),cloud=server();
   data.scores[0].studentId='student:missing';
   cloud.scores[0].studentId='student:missing';
   await assert.rejects(request(data,cloud),
     rejects('N71_V2_GRAPH_PARENT_MISSING:students'));
 });
 await t.test('two semesters cannot be mixed by a Teaching belonging to another year',async()=>{
   const data=payloadData(),cloud=server();
   for(const collection of [data,cloud]){
     collection.years.push({id:'year:other',ownerId:OWNER});
     collection.terms.push({id:'term:other',ownerId:OWNER,yearId:'year:other'});
     collection.teachings[0].termId='term:other';
   }
   await assert.rejects(request(data,cloud),
     rejects('N71_V2_GRAPH_ACADEMIC_YEAR_MISMATCH'));
 });
 await t.test('same revision but modified current grade must alter canonical digest',async()=>{
   const baseline=await request(payloadData(),server());
   const changed=server();
   changed.scores[0].value=8;
   const updated=await request(payloadData(),changed);
   assert.notEqual(updated.manifestDigest,baseline.manifestDigest);
   assert.equal(updated.syntheticWouldInsert,baseline.syntheticWouldInsert);
 });
 await t.test('same sidecar identity and revision with changed review note has a different digest',async()=>{
   const baseline=await request(payloadData(),server({withSidecars:true}));
   const changed=server({withSidecars:true});
   changed.sectionCurriculumScopes[0].reviewStatus='teacher_reviewed';
   const updated=await request(payloadData(),changed);
   assert.notEqual(updated.manifestDigest,baseline.manifestDigest);
   assert.ok(updated.decisions.every(d=>d.decision==='KEEP_SERVER'));
 });
 await t.test('unknown server history prevents claimed owner snapshot plan',async()=>{
   await assert.rejects(request(payloadData(),server(),null),
     rejects('N71_V2_SERVER_HISTORY_NOT_PROVEN'));
 });
});
