import test from 'node:test';
import assert from 'node:assert/strict';
import {
 v2ScopeToCloud,v2ScopeFromCloud,
 v2BindingToCloud,v2BindingFromCloud,
 reconcileV2Research,V2_SYNC_RESEARCH_FIELDS
} from '../src/lib/curriculum-v2-sync-contract.js';
import {
 evaluateSectionCurriculumScope,evaluateTeachingCourseBinding
} from '../src/lib/curriculum-context-v2.js';
const OWNER='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const now=1793000101000;
const draft=evaluateSectionCurriculumScope({
 ownerId:OWNER,sectionId:'sec:A',yearId:'y:1448-1449',
 program:'general',stage:'primary',level:'4',legacyGrade:4
});
const local={
 id:draft.identity,ownerId:OWNER,sectionId:draft.sectionId,
 yearId:draft.yearId,scopeKey:draft.scopeKey,
 program:draft.program,stage:draft.stage,level:draft.level,track:draft.track,
 edition:draft.edition,updatedAt:now,deleted:false
};
const draftCourse=evaluateTeachingCourseBinding({
 ownerId:OWNER,sectionScope:draft,sectionId:'sec:A',
 teachingId:'tch:A:science',subjectId:'sub:science',termId:'tm:one',name:'العلوم'
});
const binding={
 id:draftCourse.identity,ownerId:OWNER,sectionId:'sec:A',
 sectionScopeIdentity:draft.identity,teachingId:'tch:A:science',
 subjectId:'sub:science',termId:'tm:one',courseKey:draftCourse.courseKey,
 name:'العلوم',sourceUrl:draftCourse.sourceUrl,edition:'sixth',
 updatedAt:now,deleted:false
};
test('scope toCloud maps all required fields, without creating authorized writes',()=>{
 const v=v2ScopeToCloud(local,OWNER,{deviceId:'research-fixture'});
 assert.equal(v.owner_id,OWNER);assert.equal(v.section_id,'sec:A');
 assert.equal(v.program_key,'general');assert.equal(v.edition_year_verified,false);
 assert.equal(v.client_updated_at,now);assert.equal(v.deleted_at,null);
 assert.deepEqual(Object.keys(v),V2_SYNC_RESEARCH_FIELDS.scope);
});
test('scope fromCloud roundtrip preserves immutable identity',()=>{
 const v=v2ScopeFromCloud(v2ScopeToCloud(local,OWNER),OWNER);
 for(const k of ['id','ownerId','sectionId','yearId','scopeKey','program','stage','level','track','edition'])
  assert.equal(v[k],local[k],k);
 assert.equal(v.updatedAt,now);assert.equal(v.deleted,false);
});
test('PostgreSQL Date objects retain millisecond-accurate V2 tombstones',()=>{
 const instant=now+123;
 const deletedScope={...local,updatedAt:instant,deleted:true,
   deletedAt:new Date(instant).toISOString()};
 const encodedScope=v2ScopeToCloud(deletedScope,OWNER);
 encodedScope.deleted_at=new Date(instant);
 const mappedScope=v2ScopeFromCloud(encodedScope,OWNER);
 assert.equal(mappedScope.deletedAt,deletedScope.deletedAt);
 assert.equal(mappedScope.updatedAt,instant);
 const deletedBinding={...binding,updatedAt:instant,deleted:true,
   deletedAt:new Date(instant).toISOString()};
 const encodedBinding=v2BindingToCloud(deletedBinding,OWNER);
 encodedBinding.deleted_at=new Date(instant);
 assert.equal(v2BindingFromCloud(encodedBinding,OWNER).deletedAt,deletedBinding.deletedAt);
});
test('scope cannot be converted under other owner context',()=>{
 assert.throws(()=>v2ScopeToCloud(local,OTHER),/V2_OWNER_CONTEXT_MISMATCH/);
 assert.throws(()=>v2ScopeFromCloud(v2ScopeToCloud(local,OWNER),OTHER),/V2_OWNER_CONTEXT_MISMATCH/);
});
test('cloud mapping has no unknown writable columns',()=>{
 const v=v2ScopeToCloud({...local,secret:'never-transfer'},OWNER);
 assert.equal('secret' in v,false);
});
test('binding toCloud retains teaching, source, section, page and revision',()=>{
 const v=v2BindingToCloud(binding,OWNER);
 assert.equal(v.teaching_id,'tch:A:science');
 assert.equal(v.section_scope_id,draft.identity);
 assert.equal(v.course_name,'العلوم');
 assert.equal(v.course_kind,'course');
 assert.equal(typeof v.source_page,'number');
 assert.equal(v.edition_year_verified,false);
 assert.deepEqual(Object.keys(v),V2_SYNC_RESEARCH_FIELDS.binding);
});
test('binding fromCloud roundtrip retains identifiers and official name',()=>{
 const row=v2BindingFromCloud(v2BindingToCloud(binding,OWNER),OWNER);
 for(const k of ['id','ownerId','sectionId','sectionScopeIdentity','teachingId','subjectId',
                  'termId','courseKey','name','edition','updatedAt','sourceUrl'])
  assert.equal(row[k],binding[k],k);
});
test('cannot change owner during binding conversion',()=>{
 assert.throws(()=>v2BindingToCloud(binding,OTHER),/V2_OWNER_CONTEXT_MISMATCH/);
 assert.throws(()=>v2BindingFromCloud(v2BindingToCloud(binding,OWNER),OTHER),/V2_OWNER_CONTEXT_MISMATCH/);
});
test('soft deletion maps to a dated tombstone, not physical delete',()=>{
 const v=v2ScopeToCloud({...local,deleted:true,updatedAt:now+1200},OWNER);
 assert.equal(v.deleted_at,new Date(now+1200).toISOString());
 assert.equal(v2ScopeFromCloud(v,OWNER).deleted,true);
});
test('newer remote scope metadata can be reconciled after immutable checks',()=>{
 const y={...local,updatedAt:now+100,sourceStatus:'re-reviewed'};
 assert.equal(reconcileV2Research(local,y,{kind:'scope',expectedOwner:OWNER}).status,'remote_newer');
});
test('changed programme is never silently resolved by newest timestamp',()=>{
 const y={...local,program:'tahfiz',updatedAt:now+400};
 assert.match(reconcileV2Research(local,y,{kind:'scope',expectedOwner:OWNER}).reason,/immutable_program/);
});
test('different section/cohort not merged',()=>{
 const y={...local,sectionId:'sec:B',updatedAt:now+400};
 assert.equal(reconcileV2Research(local,y,{kind:'scope',expectedOwner:OWNER}).status,'conflict');
});
test('same timestamp with different values returns conflict',()=>{
 const y={...binding,updatedAt:now,name:'مادة مختلفة'};
 assert.equal(reconcileV2Research(binding,y,{kind:'binding',expectedOwner:OWNER}).reason,'same_revision_different_values');
});
test('newer remote tombstone supersedes active local safely',()=>{
 const y={...local,deleted:true,deletedAt:new Date(now+100).toISOString(),updatedAt:now+100};
 assert.equal(reconcileV2Research(local,y,{kind:'scope',expectedOwner:OWNER}).status,'remote_tombstone');
});
test('stale tombstone versus newer live local requires review',()=>{
 const y={...local,deleted:true,deletedAt:new Date(now-100).toISOString(),updatedAt:now-100};
 assert.equal(reconcileV2Research(local,y,{kind:'scope',expectedOwner:OWNER}).reason,'tombstone_resurrection_requires_review');
});
test('a deleted scope cannot resurrect from a newer remote live row',()=>{
 const x={...local,deleted:true,deletedAt:new Date(now+10).toISOString(),updatedAt:now+10};
 const y={...local,deleted:false,updatedAt:now+20};
 assert.equal(reconcileV2Research(x,y,{kind:'scope',expectedOwner:OWNER}).status,'conflict');
});
test('remote different course identity never overwrites local teaching mapping',()=>{
 const y={...binding,courseKey:'another-course',updatedAt:now+100};
 assert.equal(reconcileV2Research(binding,y,{kind:'binding',expectedOwner:OWNER}).reason,'immutable_courseKey');
});
test('local newer remains authoritative only with matching immutable identity',()=>{
 const x={...binding,updatedAt:now+200};
 assert.equal(reconcileV2Research(x,binding,{kind:'binding',expectedOwner:OWNER}).status,'local_newer');
});
test('cross owner sidecar merge never occurs',()=>{
 assert.throws(()=>reconcileV2Research(local,{...local,ownerId:OTHER},{kind:'scope',expectedOwner:OWNER}),/OWNER_CONTEXT_MISMATCH/);
});
test('unknown table kind fails closed',()=>{
 assert.throws(()=>reconcileV2Research(local,local,{kind:'untrusted',expectedOwner:OWNER}),/UNKNOWN_RECORD_KIND/);
});

test('kindergarten learning_domain survives explicit cloud roundtrip',()=>{
 const src={...binding,kind:'learning_domain'};
 const cloud=v2BindingToCloud(src,OWNER);
 assert.equal(cloud.course_kind,'learning_domain');
 const mapped=v2BindingFromCloud(cloud,OWNER);
 assert.equal(mapped.kind,'learning_domain');
});
test('course kind is immutable and must never change silently to learning domain',()=>{
 const first={...binding,kind:'course'},second={...binding,kind:'learning_domain',updatedAt:now+100};
 assert.equal(reconcileV2Research(first,second,{kind:'binding',expectedOwner:OWNER}).reason,'immutable_kind');
});
test('invalid source course kind cannot be submitted',()=>{
 assert.throws(()=>v2BindingToCloud({...binding,kind:'unknown'},OWNER),/V2_INVALID_COURSE_KIND/);
});
