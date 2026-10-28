// AI-authored: synthetic canonical projection and actual client boundary checks.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from '../fixtures/n88-student-projection/canonical.mjs';
import { sectionLabel } from '../../src/models.js';
import { projectStudentPortal, studentPortalPublicationBindings } from '../../drafts/n88-student-portal/student-projection.mjs';
import { VISIBILITY_FIELDS } from '../../drafts/n88-student-portal/visibility-policy.mjs';
import { projectUnifiedStudentData, createUnifiedStudentPortalClient } from '../../src/lib/student-portal-unified-client.js';

const keys = ['ownerId','studentId','enrollmentId','classId','termId'];
function membership(size) {
  const input = fixture(), c = input.canonical;
  const student = c.students[0], enrollment = c.enrollments[0];
  c.students = size ? [student] : [];
  c.enrollments = size ? [enrollment] : [];
  for (let n = 1; n < size; n++) {
    c.students.push({...student,id:`peer-${n}`,name:`PRIVATE_PEER_${n}`});
    c.enrollments.push({...enrollment,id:`peer-enrollment-${n}`,studentId:`peer-${n}`});
  }
  student.teacherSecret = 'PRIVATE_TEACHER_SECRET';
  student.receipt = 'PRIVATE_RECEIPT';
  return input;
}
function publish(input, fields = {}) {
  const binding = studentPortalPublicationBindings(input);
  input.visibility = {version:'n88-visibility-v1',...Object.fromEntries(keys.map(k => [k,input[k]])),
    scopeStamp:binding.scopeStamp,fields,
    sources:binding.sources.map((s,n) => ({...s,publicationId:`00000000-0000-4000-8000-${String(n+1).padStart(12,'0')}`}))};
  return input;
}
const profile = input => ({name:input.canonical.students[0].name,classLabel:sectionLabel(input.canonical.sections[0])});
function profileOnly(input) {
  const before = structuredClone(input), out = projectStudentPortal(input);
  assert.deepEqual(out,{version:'n88-student-v3',profile:profile(input)});
  assert.deepEqual(projectUnifiedStudentData(out),out,'actual client accepts both identity fields without content');
  assert.deepEqual(input,before,'projection is pure');
  for (const forbidden of ['PRIVATE_', 'OTHER_', 'ownerId', 'studentId', 'enrollment', 'scopeStamp',
    'publicationId', 'grades', 'work', 'sources', 'total', 'scheduled']) {
    assert.ok(!JSON.stringify(out).includes(forbidden),forbidden);
  }
  return out;
}
function denied(input) {
  let disclosed;
  assert.throws(() => {disclosed = projectStudentPortal(input);}, /n88_projection_unavailable|n88_visibility_invalid/);
  assert.equal(disclosed,undefined,'no response, including no profile, on rejection');
}

for (const size of [0,1,28,50]) {
  test(`owned membership ${size}: absent/null/legacy hidden policies`, () => {
    if (!size) {
      const input = membership(0);
      denied(input);
      input.visibility = {fields:{name:true,class:true}};
      denied(input);
      return;
    }
    profileOnly(membership(size));
    const nullInput = membership(size); nullInput.visibility = null; profileOnly(nullInput);
    profileOnly(publish(membership(size)));
    profileOnly(publish(membership(size),Object.fromEntries(VISIBILITY_FIELDS.map(k => [k,false]))));
    // Unsaved teacher defaults have no authority: only input.visibility is used.
    const unsaved = membership(size);
    unsaved.fields = {required:true,completed:true,scheduled:true}; unsaved.policyRevision = 0;
    profileOnly(unsaved);
    const corrupt = publish(membership(size)); corrupt.visibility.fields.grades = 'true'; denied(corrupt);
  });
  if (!size) continue;
  test(`owned membership ${size}: all 64 legacy field choices retain independent content decisions`, () => {
    const all = projectStudentPortal(publish(membership(size),Object.fromEntries(VISIBILITY_FIELDS.map(k => [k,true]))));
    assert.deepEqual(all.grades.items.map(row => row.value),[8,0,null,4,8,4]);
    assert.deepEqual(all.work.completed.map(row => row.completionState),['regular','late']);
    assert.equal(all.work.required.length,1); assert.equal(all.work.scheduled.length,1);
    for (let mask = 0; mask < 64; mask++) {
      const fields = Object.fromEntries(VISIBILITY_FIELDS.map((k,n) => [k,!!(mask & (1 << n))]));
      const input = publish(membership(size),fields), out = projectStudentPortal(input);
      const expected = {version:all.version,profile:profile(input)};
      if (fields.grades) expected.grades = all.grades;
      for (const k of ['required','completed','scheduled']) if (fields[k]) (expected.work ??= {})[k] = all.work[k];
      assert.deepEqual(out,expected,`mask ${mask}`);
      assert.deepEqual(projectUnifiedStudentData(out),out,'actual output allowlist roundtrip');
    }
  });
}

const mutations = [
  ['wrong owner',i => {i.ownerId = 'retired-owner';}],
  ['wrong student',i => {i.studentId = 'unknown-student';}],
  ['removed enrollment',i => {i.canonical.enrollments = [];}],
  ['foreign enrollment',i => {i.canonical.enrollments[0].ownerId = 'other-owner';}],
  ['ended enrollment',i => {i.canonical.enrollments[0].endDate = '2026-10-17';}],
  ['duplicate enrollment',i => {i.canonical.enrollments.push({...i.canonical.enrollments[0],id:'duplicate'});}],
  ['retired student',i => {i.canonical.students[0].status = 'withdrawn';}],
  ['archived section',i => {i.canonical.sections[0].archivedAt = '2026-10-17';}],
  ['deleted year',i => {i.canonical.years[0].deleted = true;}],
  ['wrong year',i => {i.canonical.terms[0].yearId = 'other-year';}],
  ['expired term',i => {i.canonical.terms[0].endDate = '2026-10-17';}],
  ['future term',i => {i.canonical.terms[0].startDate = '2026-10-20';}],
  ['retired term',i => {i.canonical.terms[0].status = 'archived';}],
  ['unversioned canonical source',i => {i.canonical.students[0].revision = '0';}],
  ['incomplete canonical snapshot',i => {delete i.canonical.scores;}],
];
for (const [label,mutate] of mutations) test(`no identity disclosure: ${label}, policy absent and present`, () => {
  for (const withPolicy of [false,true]) {
    const input = withPolicy ? publish(membership(28)) : membership(28);
    mutate(input); denied(input);
  }
});

test('non-null policy must match every scope key and current canonical scope revisions', () => {
  for (const key of [...keys,'scopeStamp']) {
    const input = publish(membership(50));
    input.visibility[key] = key === 'scopeStamp' ? '0'.repeat(64) : 'foreign'; denied(input);
  }
  for (const table of ['years','terms','sections','students','enrollments','teachings']) {
    const input = publish(membership(28)); input.canonical[table][0].revision = '2'; denied(input);
  }
  const current = membership(1);
  current.canonical.students[0].name = 'اسم اصطناعي محدث';
  current.canonical.students[0].revision = '2';
  current.canonical.sections[0].label = 'ب'; current.canonical.sections[0].revision = '3';
  profileOnly(current); // no saved policy: current canonical identity only
  profileOnly(publish(current)); // deliberately rebound policy
});

test('item/subitem source invalidation still omits content without changing own scope identity', () => {
  const input = publish(membership(28),{grades:true,required:true,completed:true,scheduled:true});
  input.canonical.items[0].revision = '2';
  input.canonical.scoreSubitems[2].revision = '2';
  const out = projectStudentPortal(input);
  assert.deepEqual(out.profile,profile(input));
  assert.equal(out.grades.items.length,5); assert.ok(!Object.hasOwn(out.grades,'total'));
  assert.equal(out.work.required.length,0);
  assert.equal(out.work.completed.length,2); assert.equal(out.work.scheduled.length,1);
});

test('actual client read accepts profile-only response and retires a canceled late response', async () => {
  const out = projectStudentPortal(membership(50));
  const ready = createUnifiedStudentPortalClient({fetch:async () => new Response(JSON.stringify(out),{headers:{'content-type':'application/json'}})});
  try { assert.deepEqual(await ready.read(),out); } finally {ready.dispose();}
  let release, signal;
  const client = createUnifiedStudentPortalClient({fetch:async (_url,init) => {
    signal = init.signal;
    await new Promise(resolve => {release = resolve;});
    return new Response(JSON.stringify(out),{headers:{'content-type':'application/json'}});
  }});
  try {
    const pending = client.read();
    const rejected = assert.rejects(pending,error => error.kind === 'stale');
    client.invalidate('context'); assert.equal(signal.aborted,true); release(); await rejected;
  } finally {client.dispose();}
});
