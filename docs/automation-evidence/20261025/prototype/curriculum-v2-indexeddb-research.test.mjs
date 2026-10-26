import test from 'node:test';
import assert from 'node:assert/strict';
import {indexedDB} from 'fake-indexeddb';
import {openCurriculumV2ResearchStore} from './curriculum-v2-indexeddb-research.mjs';
import {evaluateSectionCurriculumScope as scope,
 evaluateTeachingCourseBinding as course} from '../../../../src/lib/curriculum-context-v2.js';
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const repoName='rakeez-v2-research-owner-test-20261025';
const mkScope=(owner=A,extra={})=>scope({ownerId:owner,sectionId:'sec:A',
 yearId:'y:1448-1449',program:'general',stage:'primary',level:'4',
 legacyGrade:4,...extra});
const mkBinding=(parent,extra={})=>course({ownerId:parent.ownerId,
 sectionScope:parent,sectionId:parent.sectionId,
 teachingId:'tch:A:science',subjectId:'sub:science',termId:'tm:one',
 name:'العلوم',...extra});
test('V2 research IndexedDB: persistent demo sidecars with owner guards and tombstones',async t=>{
 let active=A;
 let db=openCurriculumV2ResearchStore({databaseName:repoName,indexedDB,currentOwner:()=>active});
 try{
  const a=mkScope();
  await t.test('records only known research database names',async()=>{
   assert.throws(()=>openCurriculumV2ResearchStore({databaseName:'rakeezx',indexedDB,currentOwner:()=>A}),/RESEARCH_DB_ONLY/);
  });
  await t.test('creates a research scope from pure V2 draft',async()=>{
   const stored=await db.putScope(a);
   assert.equal(stored.ownerId,A);assert.equal(stored.syncStatus,'research_local_only');
   assert.equal((await db.scopes(A)).length,1);
  });
  await t.test('reopening research database recovers scope',async()=>{
   await db.close();
   db=openCurriculumV2ResearchStore({databaseName:repoName,indexedDB,currentOwner:()=>active});
   const rows=await db.scopes(A);
   assert.equal(rows.length,1);assert.equal(rows[0].id,a.identity);
  });
  await t.test('B cannot read A scope with A owner argument',async()=>{
   active=B;
   await assert.rejects(db.scopes(A),/OWNER_CONTEXT_CHANGED/);
   assert.equal((await db.scopes(B)).length,0);
  });
  await t.test('B can store independent same section id under B ownership',async()=>{
   const b=mkScope(B);
   const stored=await db.putScope(b);
   assert.notEqual(stored.id,a.identity);
   assert.equal((await db.scopes(B)).length,1);
   active=A;assert.equal((await db.scopes(A)).length,1);
  });
  await t.test('changing A scope programme without explicit review blocked',async()=>{
   const different=mkScope(A,{program:'tahfiz',previousScope:null});
   await assert.rejects(db.putScope(different),/SECTION_SCOPE_MUTATION_REQUIRES_REVIEW/);
   assert.equal((await db.scopes(A))[0].program,'general');
  });
  await t.test('cannot invent live duplicate cohort scope',async()=>{
   // PGlite enforces uniqueness on id changes; IndexedDB also verifies active section.
   const fake={...a,identity:'scope:other-generation'};
   await assert.rejects(db.putScope(fake),/ACTIVE_SECTION_SCOPE_CONFLICT/);
  });
  const c=mkBinding(a);
  await t.test('binds source course with same owner+section',async()=>{
   const r=await db.putBinding(c);
   assert.equal(r.sectionId,'sec:A');
   assert.match(r.sourceUrl,/sncc.gov.sa/);
  });
  await t.test('course binding survives simulated app restart',async()=>{
   await db.close();
   db=openCurriculumV2ResearchStore({databaseName:repoName,indexedDB,currentOwner:()=>active});
   assert.equal((await db.bindings(A)).length,1);
  });
  await t.test('foreign actor cannot write A course',async()=>{
   active=B;
   await assert.rejects(db.putBinding(c),/OWNER_CONTEXT_CHANGED/);
   active=A;
  });
  await t.test('course cannot be linked to unrelated cohort',async()=>{
   const wrong={...c,identity:'binding:wrong-cohort',sectionId:'sec:B'};
   await assert.rejects(db.putBinding(wrong),/PARENT_OWNER_SECTION_SCOPE_MISMATCH/);
  });
  await t.test('existing course identity cannot be silently rebound',async()=>{
   const changed={...c,courseKey:'other-source-course'};
   await assert.rejects(db.putBinding(changed),/COURSE_BINDING_CHANGE_REQUIRES_REVIEW/);
  });
  await t.test('active course prevents removing cohort context',async()=>{
   await assert.rejects(db.retireScope(A,a.identity),/ACTIVE_BINDINGS_PREVENT_SCOPE_RETIREMENT/);
  });
  await t.test('soft deleted course stays tombstoned, not resurrected',async()=>{
   await db.retireBinding(A,c.identity);
   let rows=await db.bindings(A);assert.equal(rows.length,1);
   assert.equal(rows[0].deleted,true);
   await assert.rejects(db.putBinding(c),/TOMBSTONE_MUST_NOT_RESURRECT/);
  });
  await t.test('retire scope only after all active course links retired',async()=>{
   const retired=await db.retireScope(A,a.identity);
   assert.equal(retired.deleted,true);
   await assert.rejects(db.putScope(a),/TOMBSTONE_MUST_NOT_RESURRECT/);
  });
  await t.test('tombstones survive reload, no physical deletion',async()=>{
   await db.close();
   db=openCurriculumV2ResearchStore({databaseName:repoName,indexedDB,currentOwner:()=>active});
   assert.equal((await db.scopes(A))[0].deleted,true);
   assert.equal((await db.bindings(A))[0].deleted,true);
   active=B;assert.equal((await db.scopes(B))[0].deleted,false);
  });
 }finally{
  await db.close();
  indexedDB.deleteDatabase(repoName);
 }
});
