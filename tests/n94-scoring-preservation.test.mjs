import 'fake-indexeddb/auto';
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import * as db from '../src/lib/db.js';
import * as store from '../src/store.js';
import * as cloud from '../src/lib/cloud.js';
import { n13Account } from './n13-fixture.mjs';
import { runtimeOfflineLease } from '../src/lib/offline-lease.js';
import { makeYear, makeTerm, makeSubject, makeSection, makeTeaching, makeStudent, makeEnrollment,
  makeItem, itemScore, makeScoreSubitem } from '../src/models.js';
import { projectSubitemScore, subitemCompletionState, subitemSelectedPoints } from '../src/lib/score-foundation.js';
import { inlineQuickLog, recordInlineQuickLog, flushInlineQuickLogEffect } from '../src/views/grades.js';
import { setRepaint } from '../src/repaint.js';
global.document = { documentElement: { setAttribute() {}, removeAttribute() {}, classList: { add() {}, remove() {} } },
  querySelector: () => ({ setAttribute() {} }), getElementById: () => null };
global.matchMedia = () => ({ matches: false }); global.CSS = { escape: (value) => value };
setRepaint(() => {});

test('legacy/late/equal projection preserves parent/manual/student/owner bounds', () => {
  const item = { id: 'item', max: 10 };
  const definitions = [makeScoreSubitem({ id: 'sub', itemId: 'item', value: 6, latePoints: 2 }),
    makeScoreSubitem({ id: 'other', itemId: 'other-item', value: 20 })];
  const legacy = { studentId: 'A', subitemId: 'sub', checked: true };
  assert.equal(projectSubitemScore(item, definitions, [legacy], null, { studentId: 'A' }).value, 6);
  const late = { ...legacy, completionState: 'late' };
  assert.deepEqual(projectSubitemScore(item, definitions, [late], 100, { studentId: 'A' }),
    { value: 10, derivedValue: 2, manualValue: 8, manualClamped: true });
  assert.equal(projectSubitemScore(item, definitions, [late], null, { studentId: 'B' }).value, null);
  assert.equal(projectSubitemScore(item, [{ ...definitions[0], ownerId: 'B' }], [late], null,
    { studentId: 'A', ownerId: 'A' }).value, null);
  const equal = { ...definitions[0], latePoints: 6 };
  assert.equal(subitemSelectedPoints(equal, late), 6); assert.equal(subitemSelectedPoints(equal, legacy), 6);
  assert.equal(subitemCompletionState(late), 'late'); assert.equal(subitemCompletionState(legacy), 'regular');
  assert.equal(projectSubitemScore(item, definitions, [], 0, { studentId: 'A' }).value, 0);
  assert.equal(projectSubitemScore(item, definitions, [], null, { studentId: 'A' }).value, null);
});

test('N84 actual Quick Log command remains durable/idempotent and manual/attendance stay separate', async () => {
  await n13Account(); await store.init();
  store.getOfflineLeaseStatus();
  await runtimeOfflineLease().renew(async () => ({ id: store.getActiveWorkspace().authUserId,
    source: 'supabase-auth-user', verifiedAt: Date.now() }));
  const year=makeYear({id:'n94:y'}), term=makeTerm({id:'n94:term',yearId:year.id}), subject=makeSubject({id:'n94:subject'});
  const section=makeSection({id:'n94:section',yearId:year.id,grade:4});
  const teaching=makeTeaching({id:'n94:t',sectionId:section.id,subjectId:subject.id,termId:term.id});
  const students=['n94:A','n94:B'].map(id=>makeStudent({id,name:id}));
  const participation=makeItem({id:'n94:p',name:'مشاركة',teachingId:teaching.id,auto:'participation',max:10,perPoint:2});
  const attendance=makeItem({id:'n94:a',name:'حضور',teachingId:teaching.id,auto:'attendance',max:10});
  const manual=makeItem({id:'n94:m',name:'يدوي',teachingId:teaching.id,max:10});
  await store.save({years:[year],terms:[term],subjects:[subject],sections:[section],teachings:[teaching],students,
    enrollments:students.map(student=>makeEnrollment({studentId:student.id,sectionId:section.id})),items:[participation,attendance,manual]});
  await store.setScore(students[0].id,manual.id,7);
  const button=(id,delta)=>({dataset:{workspace:store.getActiveWorkspace().id,item:id,student:students[0].id,delta:String(delta)},
    closest:()=>({querySelectorAll:()=>[{disabled:false},{disabled:false}]})});
  assert.ok(String(inlineQuickLog(participation,students[0])).includes('n84-log'));
  assert.equal(String(inlineQuickLog(attendance,students[0])),''); assert.equal(String(inlineQuickLog(manual,students[0])),'');
  for(const [delta,points] of [[1,2],[-1,0]]) {
    const count=store.state.logs.length;
    await Promise.all([recordInlineQuickLog(button(participation.id,delta),null,{id:teaching.id}),
      recordInlineQuickLog(button(participation.id,delta),null,{id:teaching.id})]);
    assert.equal(store.state.logs.length,count+1);
    assert.equal(itemScore(participation,store.teachingContext(teaching.id).ctx[students[0].id]),points);
    assert.ok(await db.get('logs',store.state.logs.at(-1).id));
    flushInlineQuickLogEffect({querySelector:()=>null});
  }
  const count=store.state.logs.length;
  await recordInlineQuickLog(button(attendance.id,1),null,{id:teaching.id});
  await recordInlineQuickLog(button(manual.id,1),null,{id:teaching.id});
  const foreign=button(participation.id,1);foreign.dataset.workspace='wrong';
  await recordInlineQuickLog(foreign,null,{id:teaching.id});assert.equal(store.state.logs.length,count);
  await db.closeDB();store.state.ready=false;await store.init();
  const ctx=store.teachingContext(teaching.id).ctx;
  assert.equal(itemScore(participation,ctx[students[0].id]),0);assert.equal(itemScore(participation,ctx[students[1].id]),0);
  assert.equal(itemScore(manual,ctx[students[0].id]),7);
  assert.equal(itemScore(attendance,{attendance:[{status:'absent'}]}),9);
  assert.equal(store.state.scores.filter(row=>row.itemId===participation.id).length,0);
});
after(async()=>{store.closeChannel();await db.closeDB();cloud.setMockAuth(null,null);});
