import 'fake-indexeddb/auto';
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import * as db from '../src/lib/db.js';
import * as store from '../src/store.js';
import { runtimeOfflineLease } from '../src/lib/offline-lease.js';
import { setMockAuth, AUTH_STORAGE_KEY } from '../src/lib/cloud.js';
import { makeSection, makeStudent, makeEnrollment } from '../src/models.js';
import { previewStudentRows } from '../src/lib/student-import.js';

global.document = { documentElement: { setAttribute() {}, removeAttribute() {}, classList: { add() {}, remove() {} } }, querySelector: () => ({ setAttribute() {} }) };
const values=new Map();global.localStorage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k),key:i=>[...values.keys()][i]??null,get length(){return values.size;}};
global.matchMedia = () => ({ matches: false });
after(() => { store.closeChannel(); db.closeDB(); });

test('guarded import commits students, enrollment and owner-bound outbox together, no scores; persisted drift and abort roll back', async () => {
  const ownerId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  store.activateWorkspace({ id: 'n12:account', type: 'account', databaseName: 'rakeezx-user-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', broadcastChannelName: 'n12-account-test', ownershipState: 'claimed', syncEligible: true, authUserId: ownerId, leaseGeneration: JSON.stringify([ownerId,null,null,null]) });
  await db.clearAll();
  await store.init();
  setMockAuth({ id: ownerId }, { access_token: 'synthetic-only' });
  localStorage.setItem(AUTH_STORAGE_KEY,JSON.stringify({access_token:'synthetic-only',user:{id:ownerId}}));store.getOfflineLeaseStatus();
  await runtimeOfflineLease().renew(async()=>({id:ownerId,source:'supabase-auth-user',verifiedAt:Date.now()}));
  const section = makeSection({ id: 'n12:section', yearId: 'n12:year', grade: 4, label: 'أ' });
  await store.save({ sections: [section] });
  const rows = [['طالب اصطناعي جديد']];
  const preview = previewStudentRows(rows, 0, false, []);
  const verifyCurrent = (snapshot) => {
    const ids = new Set(snapshot.enrollments.filter((row) => row.sectionId === section.id && row.status === 'active' && !row.deleted).map((row) => row.studentId));
    const roster = snapshot.students.filter((row) => ids.has(row.id) && !row.deleted);
    assert.deepEqual(previewStudentRows(rows, 0, false, roster).entries, preview.entries);
  };
  const beforeScores = await db.getAll('scores');
  assert.equal((await store.importStudents(section.id, preview.names, { verifyCurrent })).added, 1);
  assert.equal((await db.getAll('students')).length, 1);
  assert.equal((await db.getAll('enrollments')).length, 1);
  assert.deepEqual(await db.getAll('scores'), beforeScores);
  const queue = await db.getAll('outbox');
  assert.ok(queue.some((row) => row.store === 'students'));
  assert.ok(queue.some((row) => row.store === 'enrollments'));
  assert.ok(queue.every((row) => row.ownerId === ownerId));
  await assert.rejects(store.importStudents(section.id, preview.names, { verifyCurrent }));
  assert.equal((await db.getAll('students')).length, 1);
  assert.deepEqual(await db.getAll('outbox'), queue);

  const controller = new AbortController(); controller.abort();
  await assert.rejects(store.importStudents(section.id, ['طالب إلغاء'], { verifyCurrent() {}, signal: controller.signal }));
  assert.equal((await db.getAll('students')).length, 1);

  // A different tab's persisted student is absent from this tab's memory.
  const other = makeStudent({ id: 'n12:other-tab', name: 'طالب تبويب آخر' });
  await db.putAcross({ students: [other], enrollments: [makeEnrollment({ studentId: other.id, sectionId: section.id, rollNo: 2 })] });
  const stale = previewStudentRows([['طالب تبويب آخر']], 0, false, store.sectionRoster(section.id));
  assert.equal(stale.counts.new, 1);
  await assert.rejects(store.importStudents(section.id, stale.names, { verifyCurrent(snapshot) {
    assert.equal(previewStudentRows([['طالب تبويب آخر']], 0, false, snapshot.students).counts.new, 1);
  } }));
  assert.equal((await db.getAll('students')).length, 2);
});
