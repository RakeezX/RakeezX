import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CURRICULUM_CONTEXT_VERSION,evaluateSectionCurriculumScope,
  evaluateTeachingCourseBinding,compatibilityDecision,
} from '../src/lib/curriculum-context-v2.js';
const OWNER='00000000-0000-4000-8000-000000000001';
const base={ownerId:OWNER,sectionId:'sec:demo-1',yearId:'y:1448-1449'};
const scope=(overrides={})=>evaluateSectionCurriculumScope({...base,program:'general',stage:'primary',level:'4',legacyGrade:4,...overrides});
const link=(x, name, rest={})=>evaluateTeachingCourseBinding({
  ownerId:OWNER,sectionScope:x,sectionId:x.sectionId,teachingId:'tch:demo',
  subjectId:'sub:science',termId:'tm:demo',name,...rest,
});
test('contract version 2',()=>assert.equal(CURRICULUM_CONTEXT_VERSION,2));
test('grade 4 can be represented in a draft without production write',()=>{
 const x=scope();assert.equal(x.state,'draft');assert.equal(x.legacyGrade,4);
 assert.equal(x.writeAllowed,false);assert.equal(x.ownerVerifiedByProvider,false);
});
test('explicit owner and section are required',()=>{
 assert.throws(()=>scope({ownerId:''}),/owner/);assert.throws(()=>scope({sectionId:'\n'}),/section/);
});
test('same section and owner gives stable identity',()=>assert.equal(scope().identity,scope().identity));
test('different owner gives different identity',()=>assert.notEqual(scope().identity,scope({ownerId:'another'}).identity));
test('other programme for same section is not silently adopted',()=>{
 const x=scope();assert.equal(scope({program:'tahfiz',previousScope:x}).reason,'existing_cohort_curriculum_conflict');
});
test('owner mismatch is blocked',()=>{
 const x=scope();assert.equal(scope({ownerId:'different',previousScope:x}).reason,'owner_section_year_mismatch');
});
test('legacy fourth grade cannot be relabeled as intermediate',()=>assert.equal(scope({stage:'middle'}).reason,'legacy_grade_mismatch'));
test('unlisted programme is not fabricated',()=>assert.equal(scope({program:'fake'}).reason,'no_verified_scope_in_guide'));
test('tahfiz scope is distinct',()=>assert.notEqual(scope().scopeKey,scope({program:'tahfiz'}).scopeKey));
test('kindergarten is a real level, not fabricated grade 13',()=>{
 const x=scope({program:'early_childhood',stage:'kindergarten',level:'3',legacyGrade:null});
 assert.equal(x.state,'draft');assert.equal(x.legacyGrade,null);
 assert.equal(compatibilityDecision(x).status,'v2_section_required');
});
test('nursery weaning has no numeric grade',()=>{
 const x=scope({program:'early_childhood',stage:'nursery',level:'weaning',legacyGrade:null});
 assert.equal(x.state,'draft');assert.equal(x.legacyGrade,null);
});
test('legacy grade 13 is blocked',()=>assert.equal(scope({legacyGrade:13}).state,'blocked'));
test('even legacy-compatible sections require a V2 sync rollout',()=>assert.equal(compatibilityDecision(scope()).requiresMigration,true));
test('applicability for 1448 is not invented',()=>assert.equal(scope().editionConfirmedFor1448,false));
test('real course attaches to verified indexed curriculum scope',()=>{
 const x=scope(),y=link(x,'العلوم');
 assert.equal(y.state,'draft');assert.equal(y.courseName,'العلوم');assert.equal(y.writeAllowed,false);
});
test('foreign grade course is rejected',()=>assert.equal(link(scope(),'اللغة الصينية').reason,'course_not_in_section_scope'));
test('another owner cannot attach teaching',()=>assert.equal(link(scope(),'العلوم',{ownerId:'foreign'}).reason,'unverified_owner_or_section_scope'));
test('different course assignments share one cohort identity, not teaching IDs',()=>{
 const x=scope(),a=link(x,'العلوم'),b=link(x,'الرياضيات',{teachingId:'tch:math'});
 assert.notEqual(a.identity,b.identity);assert.equal(a.sectionScopeIdentity,b.sectionScopeIdentity);
});
test('each course retains source PDF page',()=>assert.match(link(scope(),'العلوم').sourceUrl,/sncc.gov.sa.*#page=/));
test('computer engineering final year requires exact track',()=>{
 const x=scope({stage:'secondary',level:'3',legacyGrade:12,track:'computer_engineering'});
 assert.equal(x.state,'draft');
 assert.equal(link(x,'الأمن السيبراني').state,'draft');
});
test('general vs engineering track cannot merge into the same previously defined cohort',()=>{
 const x=scope({stage:'secondary',level:'3',legacyGrade:12,track:'computer_engineering'});
 const y=scope({stage:'secondary',level:'3',legacyGrade:12,track:'general',previousScope:x});
 assert.equal(y.state,'conflict');
});
test('no stateful persistence functions in pure V2 contract',()=>{
 const x=scope();assert.equal(x.storage,'requires_new_versioned_sync_contract');
 assert.equal(x.ownerVerifiedByProvider,false);
});
