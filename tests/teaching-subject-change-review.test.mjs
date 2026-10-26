import test from 'node:test';
import assert from 'node:assert/strict';
import { STORES } from '../src/lib/db.js';
import { DEFAULT_ITEMS } from '../src/models.js';
import { reviewTeachingSubjectChange as review } from '../src/lib/teaching-subject-change-review.js';

const OWNER='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const FOREIGN='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const source='teaching:old',section='section:4',term='term:1',year='year:1448';
const oldSubject='subject:science',newSubject='subject:math';
const rows=(...names)=>Object.fromEntries(names.map(name=>[name,[]]));
function fixture() {
  const data=rows(...STORES);
  data.years=[{id:year,ownerId:OWNER,status:'active'}];
  data.terms=[{id:term,ownerId:OWNER,yearId:year,status:'active'}];
  data.sections=[{id:section,ownerId:OWNER,yearId:year,grade:4,label:'1',status:'active'}];
  data.subjects=[{id:oldSubject,ownerId:OWNER,name:'العلوم'},
                 {id:newSubject,ownerId:OWNER,name:'الرياضيات'}];
  data.teachings=[{id:source,ownerId:OWNER,sectionId:section,termId:term,
    subjectId:oldSubject,serverRevision:1}];
  data.students=[{id:'student:s1',name:'خصوصي - لا يظهر في الخطة'},
                 {id:'student:s2',name:'خصوصي 2'}];
  data.enrollments=[{id:'en:s1',sectionId:section,studentId:'student:s1',status:'active'},
                    {id:'en:s2',sectionId:section,studentId:'student:s2',status:'active'}];
  data.items=DEFAULT_ITEMS.map((x,i)=>({...x,id:'item:'+i,teachingId:source,
    order:i,deleted:false}));
  return data;
}
const plan=(data,options={})=>review({snapshot:data,teachingId:source,
  targetSubjectId:newSubject,ownerId:OWNER,currentTermId:term,...options});
const actualCounts=(p,name)=>p.affected?.recordCounts?.[name]?.count??0;

test('pristine subject correction preflight keeps shared roster and is never a write authorization',()=>{
  const data=fixture();
  const before=structuredClone(data);
  const p=plan(data);
  assert.equal(p.status,'preflight_ready');
  assert.equal(p.reason,'pristine_subject_selection_correction');
  assert.equal(p.canCommit,false);
  assert.equal(p.requiresServerCAS,true);
  assert.equal(p.suggestedAction,'prepare_authorized_subject_rebind');
  assert.equal(p.affected.sharedStudents,2);
  assert.equal(p.affected.defaultAssessmentItems,5);
  assert.equal(p.affected.assessmentDefaultsUnchanged,true);
  assert.equal(actualCounts(p,'scores'),0);
  assert.deepEqual(data,before);
  assert.doesNotMatch(JSON.stringify(p),/خصوصي|student:s1/);
});

test('same subject is unchanged and requires no destructive operation',()=>{
  const p=plan(fixture(),{targetSubjectId:oldSubject});
  assert.equal(p.status,'unchanged');
  assert.equal(p.canCommit,false);
});

test('cannot open second copy of an already active subject Teaching',()=>{
  const data=fixture();
  data.teachings.push({id:'teaching:math',sectionId:section,termId:term,
    subjectId:newSubject});
  const p=plan(data);
  assert.equal(p.status,'target_exists');
  assert.equal(p.suggestedAction,'open_existing_teaching');
});

test('historical scores are preserved; no silent cross-subject grade transfer',()=>{
  const data=fixture();
  data.scores=[{id:'score:1',itemId:'item:1',studentId:'student:s1',
    value:18,serverRevision:4}];
  const p=plan(data);
  assert.equal(p.status,'review_required');
  assert.equal(p.reason,'linked_teaching_history_requires_choice');
  assert.equal(p.suggestedAction,'add_teaching_keep_existing_history');
  assert.equal(p.automaticScoreTransfer,false);
  assert.equal(actualCounts(p,'scores'),1);
  assert.equal(data.scores[0].value,18);
  assert.equal(p.canCommit,false);
});

test('attendance, sessions, schedule, notes and reports are individually included',()=>{
  const data=fixture();
  data.slots=[{id:'slot:1',teachingId:source}];
  data.sessions=[{id:'session:1',teachingId:source}];
  data.attendance=[{id:'att:1',sessionId:'session:1',studentId:'student:s1'}];
  data.logs=[{id:'log:1',teachingId:source}];
  data.notes=[{id:'note:1',sessionId:'session:1'}];
  data.closedTermReports=[{id:'report:1',payload:{teaching:{id:source}}}];
  const p=plan(data);
  assert.equal(p.status,'review_required');
  for(const name of ['slots','sessions','attendance','logs','notes','closedTermReports'])
    assert.equal(actualCounts(p,name),1,name);
  assert.equal(p.affected.sharedStudents,2);
});

test('subitem completions and submissions are reached through their parents',()=>{
  const data=fixture();
  data.scoreSubitems=[{id:'subitem:1',itemId:'item:1'}];
  data.scoreSubitemCompletions=[{id:'done:1',subitemId:'subitem:1',studentId:'student:s1'}];
  data.assignments=[{id:'assignment:1',teachingId:source}];
  data.submissions=[{id:'submission:1',assignmentId:'assignment:1',studentId:'student:s1'}];
  const p=plan(data);
  for(const name of ['scoreSubitems','scoreSubitemCompletions','assignments','submissions'])
    assert.equal(actualCounts(p,name),1,name);
});

test('curriculum sidecars require explicit V2 binding transition, never silent relabel',()=>{
  const data=fixture();
  data.teachingCourseBindings=[{id:'binding:1',teachingId:source,
    subjectId:oldSubject,sectionId:section}];
  data.sectionCurriculumScopes=[{id:'scope:1',sectionId:section}];
  const p=plan(data);
  assert.equal(p.status,'review_required');
  assert.equal(p.affected.includesCurriculumLinks,true);
  assert.equal(actualCounts(p,'teachingCourseBindings'),1);
});

test('edited default distributions invalidate simple correction eligibility',()=>{
  const data=fixture();
  data.items[0].max=12;
  const p=plan(data);
  assert.equal(p.status,'review_required');
  assert.equal(p.affected.assessmentDefaultsUnchanged,false);
});

test('pending mutation cannot be removed or migrated just by local UI state',()=>{
  const data=fixture();
  data.outbox=[{id:'items:item:0',store:'items',recordId:'item:0',
    state:'pending',protocol:'v2'}];
  const p=plan(data);
  assert.equal(p.status,'review_required');
  assert.equal(p.reason,'pending_sync_requires_reconciliation');
  assert.equal(p.affected.pendingOutbox,1);
  assert.equal(p.suggestedAction,'wait_for_sync_then_review');
});

test('incomplete cross-device local snapshot cannot authorize subject correction',()=>{
  const data=fixture();
  delete data.attendance;
  const p=plan(data);
  assert.equal(p.status,'blocked');
  assert.equal(p.reason,'incomplete_local_snapshot');
  assert.ok(p.missingStores.includes('attendance'));
});

test('foreign owner identity is always rejected',()=>{
  const data=fixture();
  data.teachings[0].ownerId=FOREIGN;
  const p=plan(data);
  assert.equal(p.status,'blocked');
  assert.equal(p.reason,'foreign_owner_record');
});

test('closed term and archived section cannot be edited',()=>{
  const closed=fixture();closed.terms[0].status='closed';
  assert.equal(plan(closed).reason,'historical_scope_readonly');
  const archived=fixture();archived.sections[0].status='archived';
  assert.equal(plan(archived).reason,'historical_scope_readonly');
});

test('unknown destination or changed academic context is blocked',()=>{
  const data=fixture();
  assert.equal(plan(data,{targetSubjectId:'missing'}).reason,'academic_identity_incomplete');
  assert.equal(plan(data,{currentTermId:'other'}).reason,'different_active_term');
  data.terms[0].yearId='another-year';
  assert.equal(plan(data).reason,'academic_identity_incomplete');
});

test('no personal names or raw grade rows are included even for used Teaching',()=>{
  const data=fixture();
  data.scores=[{id:'score:secret',itemId:'item:1',studentId:'student:s1',value:20,
    note:'private should not be surfaced'}];
  const p=plan(data);
  assert.equal(actualCounts(p,'scores'),1);
  const serialized=JSON.stringify(p);
  assert.ok(!serialized.includes('private should not be surfaced'));
  assert.ok(!serialized.includes('خصوصي'));
  assert.ok(!serialized.includes('score:secret'));
});
