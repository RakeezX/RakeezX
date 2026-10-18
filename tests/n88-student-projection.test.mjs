// AI: targeted pure-module/model equivalence and server omission tests.
import test from 'node:test';
import assert from 'node:assert/strict';
import { itemScore, studentTotal, sectionLabel } from '../src/models.js';
import { projectSubitemScore } from '../src/lib/score-foundation.js';
import { projectStudentPortal, studentPortalPublicationBindings, studentPortalProjectionQuality } from '../drafts/n88-student-portal/student-projection.mjs';
import { validateVisibilityPolicy, VISIBILITY_FIELDS } from '../drafts/n88-student-portal/visibility-policy.mjs';
import { fixture } from './fixtures/n88-student-projection/canonical.mjs';
function publish(input, fields = VISIBILITY_FIELDS) {
  const binding = studentPortalPublicationBindings(input);
  input.visibility = { version: 'n88-visibility-v1', ...Object.fromEntries(['ownerId','studentId','enrollmentId','classId','termId'].map(key => [key,input[key]])),
    scopeStamp: binding.scopeStamp, fields: Object.fromEntries(fields.map(key => [key,true])),
    sources: binding.sources.map((source, index) => ({ ...source, publicationId: `00000000-0000-4000-8000-${String(index + 1).padStart(12,'0')}` })) };
  return input;
}
const unavailable = (input, requirement) => assert.throws(() => projectStudentPortal(input), error =>
  error.message === 'n88_projection_unavailable' && (!requirement || error.requirement === requirement));

test('n88_projection_matches_existing_teacher_scoring_and_canonical_task_states', () => {
  const input = publish(fixture()), c = input.canonical, out = projectStudentPortal(input);
  const ctx = { scoresByItem: Object.fromEntries(c.scores.filter(row => row.studentId === input.studentId).map(row => [row.itemId,row])),
    logs: c.logs.filter(row => row.studentId === input.studentId), classHasParticipation: true,
    attendance: c.attendance.filter(row => row.studentId === input.studentId) };
  assert.deepEqual(out.grades.items.map(row => row.value), c.items.map(item => itemScore(item,ctx)));
  assert.deepEqual(out.grades.items.map(row => row.value), [8,0,null,4,8,4]);
  const total = studentTotal(c.items,ctx);
  assert.deepEqual(out.grades.total, { earned: total.earned, possible: total.outOfGraded });
  assert.equal(out.profile.classLabel, sectionLabel(c.sections[0]));
  assert.equal(out.work.completed.length,2);
  assert.deepEqual(out.work.completed.map(row => row.completionState),['regular','late']);
  assert.equal(out.work.required[0].title,'مطلوب متأخر');
  assert.equal(out.work.required[0].completionState,'unrecorded');
  assert.equal(out.work.scheduled[0].title,'قادم');
  assert.equal(out.work.scheduled[0].startDate,'2026-10-20');
  assert.equal(out.version,'n88-student-v3');
});

test('n88_projection_server_visibility_current_membership_and_lifecycle_isolation', () => {
  const input = publish(fixture());
  const before = structuredClone(input);
  const json = JSON.stringify(projectStudentPortal(input));
  for (const secret of ['PRIVATE_NOTE','OTHER_NAME','OTHER_GRADE','synthetic-owner','enrollment','studentId','ownerId','teachingId','sourceId','scopeStamp']) assert.ok(!json.includes(secret),secret);
  assert.deepEqual(input,before,'pure projection does not mutate source or policy');
  assert.deepEqual(projectStudentPortal(fixture()), {version:'n88-student-v3'});
  for (const field of VISIBILITY_FIELDS) {
    const single = projectStudentPortal(publish(fixture(),[field]));
    assert.deepEqual(Object.keys(single),['version', ['name','class'].includes(field)?'profile':field==='grades'?'grades':'work']);
    if (single.profile) assert.deepEqual(Object.keys(single.profile),[field==='name'?'name':'classLabel']);
    if (single.work) assert.deepEqual(Object.keys(single.work),[field]);
  }
  const hidden = publish(fixture(),[]);
  assert.deepEqual(projectStudentPortal(hidden),{version:'n88-student-v3'});
});

test('explicit source publication, partial total omission and old portal labels have no authority', () => {
  const input = publish(fixture());
  input.visibility.sources = input.visibility.sources.filter(source => !['direct','overdue'].includes(source.sourceId));
  input.canonical.publications = [{ status:'done', published:true, title:'PRIVATE_EDITORIAL', source:{itemId:'missing'} }];
  const out = projectStudentPortal(input);
  assert.equal(out.grades.items.length,5);
  assert.ok(!Object.hasOwn(out.grades,'total'));
  assert.equal(out.work.required.length,0);
  assert.ok(!JSON.stringify(out).includes('PRIVATE_EDITORIAL'));
});

for (const [label, mutate] of [
  ['foreign policy', i => {i.visibility.ownerId='foreign';}],
  ['wrong term', i => {i.termId='old';}],
  ['ended membership', i => {i.canonical.enrollments[0].endDate='2026-10-18';}],
  ['future enrollment', i => {i.canonical.enrollments[0].startDate='2026-10-20';}],
  ['archived class', i => {i.canonical.sections[0].status='archived';}],
  ['deleted student', i => {i.canonical.students[0].deleted=true;}],
  ['withdrawn student', i => {i.canonical.students[0].status='withdrawn';}],
  ['expired term', i => {i.canonical.terms[0].endDate='2026-10-17';}],
  ['deleted year', i => {i.canonical.years[0].deleted=true;}],
  ['foreign membership', i => {i.canonical.enrollments[0].ownerId='foreign';}],
  ['ambiguous enrollment', i => {i.canonical.enrollments.push({...i.canonical.enrollments[0],id:'duplicate'});}],
  ['restore membership revision', i => {i.canonical.enrollments[0].revision='3';}],
  ['teaching lifecycle revision', i => {i.canonical.teachings[0].revision='3';}],
  ['missing snapshot family', i => {delete i.canonical.logs;}],
  ['duplicate score', i => {i.canonical.scores.push({...i.canonical.scores[0],id:'duplicate'});}],
  ['duplicate completion', i => {i.canonical.scoreSubitemCompletions.push({...i.canonical.scoreSubitemCompletions[0],id:'duplicate'});}],
]) test(`fail closed: ${label}`, () => { const i=publish(fixture());mutate(i);unavailable(i); });

test('source deletion/restore/edits cannot silently republish, explicit current teacher choice can', () => {
  const i=publish(fixture());
  i.canonical.scoreSubitems[2].deleted=true;
  assert.equal(projectStudentPortal(i).work.required.length,0);
  i.canonical.scoreSubitems[2].deleted=false;i.canonical.scoreSubitems[2].revision='3';
  assert.equal(projectStudentPortal(i).work.required.length,0);
  publish(i);
  assert.equal(projectStudentPortal(i).work.required.length,1);
  i.canonical.items[0].revision='2';
  assert.ok(!projectStudentPortal(i).grades.items.some(row => row.label==='مباشر'));
});

test('auto unrecorded vs zero, excused attendance and subitem missing/manual zero use real model', () => {
  const i=fixture();i.canonical.logs=[];i.canonical.attendance=[];
  const sub=i.canonical.items.at(-1);
  i.canonical.scoreSubitemCompletions=[];
  const score=i.canonical.scores.at(-1);
  Object.assign(score,projectSubitemScore(sub,i.canonical.scoreSubitems,[],null,{studentId:i.studentId,ownerId:i.ownerId}));
  let out=projectStudentPortal(publish(i));
  assert.deepEqual(out.grades.items.slice(3).map(row=>row.value),[null,null,null]);
  Object.assign(score,projectSubitemScore(sub,i.canonical.scoreSubitems,[],0,{studentId:i.studentId,ownerId:i.ownerId}));
  out=projectStudentPortal(i);
  assert.equal(out.grades.items.at(-1).value,0);
  i.canonical.logs=[{...fixture().canonical.logs[1]}];
  assert.equal(projectStudentPortal(i).grades.items[3].value,0,'class recording establishes real zero for own empty logs');
});

test('foreign owner rows do not enter grades or work even with colliding IDs', () => {
  const i=publish(fixture()), before=projectStudentPortal(i);
  for (const table of ['scores','scoreSubitems','scoreSubitemCompletions','logs','attendance']) {
    i.canonical[table].push(...i.canonical[table].map(row=>({...row,ownerId:'foreign',value:99,delta:99,name:'FOREIGN_TASK'})));
  }
  assert.deepEqual(projectStudentPortal(i),before);
});

test('unknown policy fields, malformed grants and duplicate identities are rejected', () => {
  for (const mutate of [p=>{p.fields.notes=true;},p=>{p.fields.grades='true';},p=>{p.sources[0].privateNote='secret';},p=>{p.sources.push(p.sources[0]);},p=>{p.sources[0].publicationId='student';},p=>{p.extra=true;}]) {
    const p=publish(fixture()).visibility;mutate(p);assert.throws(()=>validateVisibilityPolicy(p),/n88_visibility_invalid/);
  }
});

test('inconsistent atomic score or unsupported portable source is explicit unavailable, never invented', () => {
  const i=publish(fixture());i.canonical.scores.at(-1).value=9;
  unavailable(i,'canonical_atomic_subitem_score');
  const p=fixture();p.canonical.items[0].portabilityGroupId='reviewed-transfer';publish(p);
  assert.throws(()=>projectStudentPortal(p),error=>error.requirement.includes('portableScoresByItem/portableAutomaticByItem'));
  assert.equal(studentPortalProjectionQuality(p).grades.available,false);
  assert.ok(studentPortalProjectionQuality(i).work.unavailable.includes('no active teacher completion workflow'));
});

test('all 64 visibility combinations omit disabled sections and keys on server', () => {
  for (let mask=0;mask<64;mask++) {
    const fields=VISIBILITY_FIELDS.filter((_,index)=>mask & (1<<index));
    const out=projectStudentPortal(publish(fixture(),fields));
    assert.equal(Object.hasOwn(out,'profile'),fields.includes('name')||fields.includes('class'));
    assert.equal(Object.hasOwn(out,'grades'),fields.includes('grades'));
    for (const [field,key] of [['name','name'],['class','classLabel']]) assert.equal(Object.hasOwn(out.profile??{},key),fields.includes(field));
    for (const field of ['required','completed','scheduled']) assert.equal(Object.hasOwn(out.work??{},field),fields.includes(field));
    assert.equal(Object.hasOwn(out,'work'),fields.some(field=>['required','completed','scheduled'].includes(field)));
  }
});

test('cross term/class work and grades stay excluded; old source item restore requires deliberate publication', () => {
  const i=publish(fixture());
  i.canonical.teachings.push({...i.canonical.teachings[0],id:'old-teaching',termId:'old-term'});
  i.canonical.items.push({...i.canonical.items[0],id:'old-item',teachingId:'old-teaching',name:'PRIVATE_OLD_ITEM'});
  i.canonical.scoreSubitems.push({...i.canonical.scoreSubitems[0],id:'old-task',itemId:'old-item',name:'PRIVATE_OLD_TASK'});
  assert.ok(!JSON.stringify(projectStudentPortal(i)).includes('PRIVATE_OLD'));
  const source=i.canonical.items[0];
  source.deleted=true;
  assert.ok(!projectStudentPortal(i).grades.items.some(row=>row.label==='مباشر'));
  source.deleted=false;source.revision='3';
  assert.ok(!projectStudentPortal(i).grades.items.some(row=>row.label==='مباشر'));
  publish(i);
  assert.ok(projectStudentPortal(i).grades.items.some(row=>row.label==='مباشر'));
});

test('time changes scheduling only, saved completion does not come from deadline or old done label', () => {
  const i=publish(fixture());i.now='2026-10-26';
  const out=projectStudentPortal(i);
  assert.equal(out.work.scheduled.length,0);
  assert.equal(out.work.completed.length,2);
  assert.equal(out.work.required.length,2);
  assert.equal(out.work.required.find(row=>row.title==='قادم').completionState,'unrecorded');
  i.canonical.scoreSubitemCompletions[0].completionState='late';
  Object.assign(i.canonical.scores.at(-1),projectSubitemScore(i.canonical.items[5],i.canonical.scoreSubitems,i.canonical.scoreSubitemCompletions,1,{studentId:i.studentId,ownerId:i.ownerId}));
  assert.equal(projectStudentPortal(i).work.completed[0].completionState,'late');
});
