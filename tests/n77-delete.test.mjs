import 'fake-indexeddb/auto';
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import * as db from '../src/lib/db.js';
import * as store from '../src/store.js';
import { setMockAuth, setMockBackend } from '../src/lib/cloud.js';
import { localDeleteWrites, validateDeletePlan, DELETE_RETRY_MESSAGE, DELETE_SERVER_UNAVAILABLE_MESSAGE, DELETE_STALE_MESSAGE } from '../src/lib/n77-delete.js';
import { makeSection, makeTeaching } from '../src/models.js';

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
globalThis.localStorage = { setItem() {}, removeItem() {}, getItem() { return null; } };
Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true });
globalThis.document = { documentElement: { setAttribute() {}, removeAttribute() {}, classList: { add() {}, remove() {} } }, querySelector: () => ({ setAttribute() {} }) };
globalThis.matchMedia = () => ({ matches: false });
globalThis.fetch = async (url) => {
  if (String(url).endsWith('/auth/v1/user')) return new Response(JSON.stringify({ id: A }), { status: 200 });
  throw new Error(`Unexpected network call: ${url}`);
};
after(() => { setMockBackend(null); store.deactivateWorkspace(); });

const section = makeSection({ id: 'n77:section', yearId: 'year', grade: 5, label: 'أ' });
const t1 = makeTeaching({ id: 'n77:t1', sectionId: section.id, subjectId: 'subject:1', termId: 'term' });
const t2 = makeTeaching({ id: 'n77:t2', sectionId: section.id, subjectId: 'subject:2', termId: 'term' });
const row = (id, more = {}) => ({ id, updatedAt: 1, deleted: false, ...more });
const plan = (teachingId, scope, fingerprint) => ({ ownerId: A, sectionId: section.id,
  selectedTeachingId: teachingId, scope, teachingIds: [teachingId], fingerprint });

async function setup() {
  if (store.getActiveWorkspace()) { await db.clearAll(); store.deactivateWorkspace(); }
  store.activateWorkspace({ type: 'account', ownershipState: 'claimed', syncEligible: true,
    authUserId: A, databaseName: 'rakeezx-user-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    broadcastChannelName: 'n77-test' });
  setMockAuth({ id: A }, { access_token: 'test-token', user: { id: A } });
  await store.init();
  await store.save({ sections: [section], teachings: [t1, t2],
    students: [row('student:shared')],
    enrollments: [row('enrollment:1', { studentId: 'student:shared', sectionId: section.id })],
    items: [row('item:1', { teachingId: t1.id }), row('item:2', { teachingId: t2.id })],
    scoreSubitems: [row('subitem:1', { itemId: 'item:1' })],
    scoreSubitemCompletions: [row('completion:1', { studentId: 'student:shared', subitemId: 'subitem:1' })],
    scores: [row('score:1', { studentId: 'student:shared', itemId: 'item:1' }),
      row('score:2', { studentId: 'student:shared', itemId: 'item:2' })],
    sessions: [row('session:1', { teachingId: t1.id })],
    attendance: [row('attendance:1', { studentId: 'student:shared', teachingId: t1.id, sessionId: 'session:1' })],
    notes: [row('note:1', { studentId: 'student:shared', teachingId: t1.id })],
    assignments: [row('assignment:1', { teachingId: t1.id })],
    submissions: [row('submission:1', { assignmentId: 'assignment:1', studentId: 'student:shared' })],
    closedTermReports: [row('report:mixed', { payload: { teachingDocuments: [{ teaching: { id: t1.id } }, { teaching: { id: t2.id } }] } })],
  }, { queue: false });
  await db.clearStore('outbox');
}

test('N77 server preview, subject-only cascade, final Section and immutable snapshot', async () => {
  await setup();
  const originalReport = structuredClone(await db.get('closedTermReports', 'report:mixed'));
  const calls = [];
  setMockBackend({ n77DeleteTeaching: async (input) => {
    calls.push(input);
    const current = plan(input.teachingId, input.teachingId === t1.id ? 'teaching' : 'section',
      input.teachingId === t1.id ? 'fingerprint-1' : 'fingerprint-2');
    return input.commit ? { ...current, mutationId: input.mutationId, cascadeTeachingIds: [input.teachingId], orphanStudentIds: [], outcome: 'deleted' } : current;
  } });
  const first = await store.previewDeleteTeaching(t1.id);
  assert.equal(first.scope, 'teaching');
  await store.deleteTeaching(t1.id, first);
  for (const [name, id] of [['teachings',t1.id],['items','item:1'],['scoreSubitems','subitem:1'],
    ['scoreSubitemCompletions','completion:1'],['scores','score:1'],['sessions','session:1'],
    ['attendance','attendance:1'],['notes','note:1'],['assignments','assignment:1'],['submissions','submission:1']]) {
    assert.equal((await db.get(name,id)).deleted, true, `${name}:${id}`);
  }
  for (const [name, id] of [['sections',section.id],['teachings',t2.id],['scores','score:2'],
    ['students','student:shared'],['enrollments','enrollment:1']]) assert.equal((await db.get(name,id)).deleted, false, `${name}:${id}`);
  assert.deepEqual(await db.get('closedTermReports', 'report:mixed'), originalReport);
  const second = await store.previewDeleteTeaching(t2.id);
  assert.equal(second.scope, 'section');
  await store.deleteTeaching(t2.id, second);
  assert.equal((await db.get('sections',section.id)).deleted, true);
  assert.equal((await db.get('enrollments','enrollment:1')).deleted, true);
  assert.equal((await db.get('students','student:shared')).deleted, false);
  assert.deepEqual(await db.get('closedTermReports', 'report:mixed'), originalReport);
  assert.equal(calls.filter((call) => call.commit).length, 2);
});

test('N77 failure before acknowledgement leaves Product rows intact and retries one server mutation', async () => {
  await setup();
  let committed = false;
  const ids = [];
  setMockBackend({ n77DeleteTeaching: async (input) => {
    const current = plan(t1.id, 'teaching', 'stable-scope');
    if (!input.commit) return current;
    ids.push(input.mutationId);
    if (!committed) { committed = true; throw new Error('lost acknowledgement'); }
    return { ...current, mutationId: input.mutationId, cascadeTeachingIds: [t1.id], orphanStudentIds: [], outcome: 'deleted' };
  } });
  const preview = await store.previewDeleteTeaching(t1.id);
  assert.equal((await db.get('teachings', t1.id)).deleted, false);
  await assert.rejects(store.deleteTeaching(t1.id, preview), /تعذّر تأكيد نتيجة الحذف/);
  assert.equal((await db.get('teachings', t1.id)).deleted, false);
  assert.equal((await db.get('items', 'item:1')).deleted, false);
  await assert.rejects(db.put('items', row('late:item', { teachingId: t1.id })), /Resume pending N77 Delete/);
  const retry = await store.previewDeleteTeaching(t1.id);
  await store.deleteTeaching(t1.id, retry);
  assert.deepEqual(ids, [ids[0], ids[0]]);
  assert.equal((await db.get('teachings', t1.id)).deleted, true);
  assert.equal((await db.get('device', 'device')).n77DeleteIntent, null);
});

test('N77 unverified receipt cannot start local cascade; exact retry completes', async () => {
  await setup();
  let first = true;
  const ids = [];
  setMockBackend({ n77DeleteTeaching: async (input) => {
    const current = plan(t1.id, 'teaching', 'receipt-scope');
    if (!input.commit) return current;
    ids.push(input.mutationId);
    const receipt = { ...current, mutationId: input.mutationId, cascadeTeachingIds: [t1.id], orphanStudentIds: [], outcome: 'deleted' };
    if (first) { first = false; return { ...receipt, ownerId: B }; }
    return receipt;
  } });
  const preview = await store.previewDeleteTeaching(t1.id);
  await assert.rejects(store.deleteTeaching(t1.id, preview), /تعذّر تأكيد نتيجة الحذف/);
  assert.equal((await db.get('teachings', t1.id)).deleted, false);
  assert.ok((await db.get('device', 'device')).n77DeleteIntent);
  const workspace = store.getActiveWorkspace();
  store.deactivateWorkspace();
  store.activateWorkspace(workspace);
  await store.init();
  await store.deleteTeaching(t1.id, await store.previewDeleteTeaching(t1.id));
  assert.deepEqual(ids, [ids[0], ids[0]]);
  assert.equal((await db.get('teachings', t1.id)).deleted, true);
});

test('N77 stale server scope, offline entry and owner switch fail before destructive writes', async () => {
  await setup();
  setMockBackend({ n77DeleteTeaching: async (input) => {
    if (input.commit) throw Object.assign(new Error('scope moved'), { code: '22023' });
    return plan(t1.id, 'teaching', 'stale-scope');
  } });
  const preview = await store.previewDeleteTeaching(t1.id);
  await assert.rejects(store.deleteTeaching(t1.id, preview), /تغيّرت بيانات الفصل/);
  assert.equal((await db.get('teachings', t1.id)).deleted, false);
  assert.equal((await db.get('sections', section.id)).deleted, false);
  setMockAuth({ id: B }, { access_token: 'b-token', user: { id: B } });
  await assert.rejects(store.deleteTeaching(t1.id, preview), /تعذّر تأكيد نتيجة الحذف/);
  assert.equal((await db.get('teachings', t1.id)).deleted, false);
  setMockAuth({ id: A }, { access_token: 'a-token', user: { id: A } });
  globalThis.navigator.onLine = false;
  await assert.rejects(store.previewDeleteTeaching(t1.id), /يتطلب حذف الفصل اتصالًا/);
  assert.equal((await db.get('teachings', t1.id)).deleted, false);
  globalThis.navigator.onLine = true;
});

test('N77 preview distinguishes offline from unavailable server validation without local deletion', async () => {
  await setup();
  globalThis.navigator.onLine = false;
  await assert.rejects(store.previewDeleteTeaching(t1.id), { message: DELETE_RETRY_MESSAGE });
  globalThis.navigator.onLine = true;
  setMockBackend({ n77DeleteTeaching: async () => {
    throw Object.assign(new Error('Could not find the function rakeezx.n77_delete_teaching'), { code: 'PGRST202' });
  } });
  await assert.rejects(store.previewDeleteTeaching(t1.id), { message: DELETE_SERVER_UNAVAILABLE_MESSAGE });
  setMockBackend({ n77DeleteTeaching: async () => { throw new Error('server unavailable'); } });
  await assert.rejects(store.previewDeleteTeaching(t1.id), { message: DELETE_SERVER_UNAVAILABLE_MESSAGE });
  for (const [name, id] of [['teachings', t1.id], ['sections', section.id], ['items', 'item:1']]) {
    assert.equal((await db.get(name, id)).deleted, false);
  }
  assert.equal((await db.get('device', 'device')).n77DeleteIntent, undefined);
});

test('N77 preview rejects owner, workspace and stale scope before local deletion', async () => {
  await setup();
  setMockAuth({ id: B }, { access_token: 'b-token', user: { id: B } });
  await assert.rejects(store.previewDeleteTeaching(t1.id), { message: DELETE_SERVER_UNAVAILABLE_MESSAGE });
  setMockAuth({ id: A }, { access_token: 'a-token', user: { id: A } });
  setMockBackend({ n77DeleteTeaching: async () => ({ ...plan(t1.id, 'teaching', 'f'), ownerId: B }) });
  await assert.rejects(store.previewDeleteTeaching(t1.id), { message: DELETE_STALE_MESSAGE });
  setMockBackend({ n77DeleteTeaching: async () => plan(t1.id, 'teaching', 'f') });
  assert.deepEqual(await store.previewDeleteTeaching(t1.id), plan(t1.id, 'teaching', 'f'));
  assert.equal((await db.get('teachings', t1.id)).deleted, false);
  assert.equal((await db.get('device', 'device')).n77DeleteIntent, undefined);
});

test('N77 plan rejects foreign owner and stale scope before local writes', () => {
  assert.throws(() => validateDeletePlan({ ...plan(t1.id, 'teaching', 'x'), ownerId: B },
    { teachingId: t1.id, sectionId: section.id, ownerId: A }), /تغيّرت بيانات الفصل/);
  assert.throws(() => validateDeletePlan({ ...plan(t1.id, 'section', 'x'), teachingIds: [t1.id,t2.id] },
    { teachingId: t1.id, sectionId: section.id, ownerId: A }), /تغيّرت بيانات الفصل/);
});

test('N77 transaction plan covers descendants while preserving sibling and out-of-scope student', () => {
  const device = row('device', { n77DeleteIntent: { mutationId: 'm1' } });
  const current = { device: [device], outbox: [], teachings: [t1,t2], items: [row('i1',{teachingId:t1.id}),row('i2',{teachingId:t2.id})],
    scoreSubitems: [row('si',{itemId:'i1'})], scoreSubitemCompletions: [row('c',{subitemId:'si'})],
    assignments: [row('a',{teachingId:t1.id})], submissions: [row('s',{assignmentId:'a'})],
    students: [row('shared')], enrollments: [row('e',{sectionId:section.id,studentId:'shared'})], sections: [section] };
  const writes = localDeleteWrites(current, { ...plan(t1.id,'teaching','f'), mutationId:'m1', orphanStudentIds:[] }, 9);
  assert.deepEqual(writes.teachings.put.map((r)=>r.id), [t1.id]);
  assert.deepEqual(writes.scoreSubitems.put.map((r)=>r.id), ['si']);
  assert.deepEqual(writes.scoreSubitemCompletions.put.map((r)=>r.id), ['c']);
  assert.deepEqual(writes.assignments.put.map((r)=>r.id), ['a']);
  assert.deepEqual(writes.submissions.put.map((r)=>r.id), ['s']);
  assert.equal(writes.students, undefined);
  assert.equal(writes.enrollments, undefined);
  assert.equal(writes.sections, undefined);
  assert.equal(DELETE_STALE_MESSAGE.includes('لم تتغير'), true);
});
