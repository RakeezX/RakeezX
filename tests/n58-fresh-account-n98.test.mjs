// AI: existing N98 assertions, with missing N101 parent fixture supplied. Original failure retained in scoped evidence.
import 'fake-indexeddb/auto';
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { sortStudents, displayRoster } from '../src/models.js';
import * as store from '../src/store.js';
import * as db from '../src/lib/db.js';

global.document = { documentElement: { setAttribute() {}, removeAttribute() {}, classList: { add() {}, remove() {} } }, querySelector: () => ({ setAttribute() {} }) };
global.matchMedia = () => ({ matches: false });
after(() => { store.closeChannel(); db.closeDB(); });
const three = [
  { id: 'a', name: 'أحمد', rollNo: 91, enrollmentId: 'en-a' },
  { id: 'b', name: 'بندر', rollNo: 2, enrollmentId: 'en-b' },
  { id: 'k', name: 'خالد', rollNo: 1, enrollmentId: 'en-k' },
];
const hatim = { id: 'h', name: 'حاتم', rollNo: 99, enrollmentId: 'en-h' };
const pairs = rows => rows.map(s => [s.id, s.displayNo]);

test('n98_default_order_identity: old rolls, add/rename/remove, immutable identities and full-roster numbering', () => {
  const four = [...three, hatim];
  const before = structuredClone(four);
  assert.deepEqual(pairs(displayRoster(three)), [['a', 1], ['b', 2], ['k', 3]]);
  assert.deepEqual(pairs(displayRoster(four)), [['a', 1], ['b', 2], ['h', 3], ['k', 4]]);
  assert.deepEqual(pairs(displayRoster(four).filter(s => s.id === 'k')), [['k', 4]]);
  assert.deepEqual(pairs(displayRoster(four.map(s => s.id === 'k' ? { ...s, name: 'إبراهيم' } : s))), [['k', 1], ['a', 2], ['b', 3], ['h', 4]]);
  assert.deepEqual(pairs(displayRoster(four.filter(s => s.id !== 'b'))), [['a', 1], ['h', 2], ['k', 3]]);
  assert.deepEqual(four, before);
  assert.deepEqual(sortStudents(four).map(s => [s.id, s.rollNo, s.enrollmentId]), [['a',91,'en-a'],['b',2,'en-b'],['h',99,'en-h'],['k',1,'en-k']]);
});

test('equal/diacritic names use stable IDs, independent of input order and rolls', () => {
  const rows = [{id:'z',name:'أَحْمَد',rollNo:1},{id:'a',name:'أحمد',rollNo:90},{id:'m',name:'أحمد',rollNo:3}];
  assert.deepEqual(sortStudents(rows).map(s=>s.id), ['a','m','z']);
  assert.deepEqual(sortStudents(rows.reverse()).map(s=>s.id), ['a','m','z']);
});

test('existing store roster reads/projections leave persisted rows, grade links, snapshots and outbox unchanged', async () => {
  await db.clearAll(); await store.init();
  await store.save({
    years: [{id:'n98-year',hijriStart:1450,hijriEnd:1451,status:'active'}],
    terms: [{id:'n98-term',yearId:'n98-year',index:1,status:'active'}],
    sections: [{id:'n98-section',yearId:'n98-year',grade:4,label:'أ'}],
    teachings: [{id:'n98-teaching',sectionId:'n98-section',termId:'n98-term',subjectId:'n98-subject'}],
    students: [...three,hatim].map(({rollNo,enrollmentId,...s})=>({...s,status:'active'})),
    enrollments: [...three,hatim].map(s=>({id:s.enrollmentId,studentId:s.id,sectionId:'n98-section',rollNo:s.rollNo,status:'active'})),
    scores: [{id:'score-k',studentId:'k',itemId:'item',value:8}],
    sessions: [{id:'n98-session',teachingId:'n98-teaching',date:'2026-10-13',period:1}],
    sessionRosterSnapshots: [{id:'n98-snapshot',sessionId:'n98-session',state:'complete',members:[{studentId:'k',rollNo:1},{studentId:'a',rollNo:91}]}],
  });
  const tables=['students','enrollments','scores','sessionRosterSnapshots','outbox'];
  const before = await Promise.all(tables.map(t=>db.getAll(t)));
  for(let i=0;i<3;i++) {
    assert.deepEqual(pairs(displayRoster(store.students('n98-teaching'))), [['a',1],['b',2],['h',3],['k',4]]);
    assert.deepEqual(pairs(displayRoster(store.sessionRoster(store.getSession('n98-session')).members,store.students('n98-teaching'))), [['a',1],['k',4]]);
    assert.equal(store.scoresOf('k')[0].value,8);
  }
  assert.deepEqual(await Promise.all(tables.map(t=>db.getAll(t))),before);
});
