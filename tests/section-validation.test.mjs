import test, { beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import * as db from '../src/lib/db.js';
import * as store from '../src/store.js';
import { activateSyntheticAccountWorkspace } from './helpers/synthetic-workspace.mjs';

const originalDocument = globalThis.document;
const originalMatchMedia = globalThis.matchMedia;

globalThis.document = {
  documentElement: {
    setAttribute() {},
    removeAttribute() {},
    classList: { add() {}, remove() {} },
  },
  querySelector: () => ({ setAttribute() {} }),
};
globalThis.matchMedia = () => ({ matches: false });

beforeEach(async () => {
  await activateSyntheticAccountWorkspace();
  await db.clearAll();
  await store.init();
  for (const name of Object.keys(store.state)) if (Array.isArray(store.state[name])) store.state[name] = [];
  await store.save({
    years: [{ id:'year:A', label:'TEST year A' }, { id:'year:B', label:'TEST year B' }],
    terms: [{ id:'term:test', yearId:'year:A', name:'TEST term', index:1 }],
    subjects: [{ id:'subject:test', name:'TEST subject', slug:'test-subject' }],
  });
  await store.patchDevice({ activeYearId:'year:A', activeTermId:'term:test' });
});
after(() => {
  store.closeChannel();
  db.closeDB();
  if (originalDocument === undefined) delete globalThis.document;
  else globalThis.document = originalDocument;
  if (originalMatchMedia === undefined) delete globalThis.matchMedia;
  else globalThis.matchMedia = originalMatchMedia;
});

for (const [first, duplicate] of [['1','1'], ['1','١'], ['1','۱'], ['أ','ا'], ['أ','إ'], ['أ','آ'], ['أ','ٱ'], [' أ   ١ ', 'ا 1']]) {
  test(`active normalized label ${JSON.stringify(first)} rejects creation/edit to ${JSON.stringify(duplicate)} without changing stored labels`, async () => {
    const a = await store.createSection({ grade:4, label:first });
    const b = await store.createSection({ grade:4, label:'different' });
    const before = await db.getAll('outbox');
    await assert.rejects(store.createSection({ grade:4, label:duplicate }), /موجود مسبق/);
    await assert.rejects(store.editSection(b.id, { grade:4, label:duplicate }), /موجود مسبق/);
    assert.equal((await db.get('sections', a.id)).label, first);
    assert.equal((await db.get('sections', b.id)).label, 'different');
    assert.deepEqual(await db.getAll('outbox'), before);
  });
}

test('different labels/grades/years are allowed; edit validation uses the edited section year, not active device year', async () => {
  const a = await store.createSection({ grade:4, label:'1', yearId:'year:A' });
  await store.createSection({ grade:4, label:'2', yearId:'year:A' });
  await store.createSection({ grade:5, label:'1', yearId:'year:A' });
  await store.createSection({ grade:4, label:'1', yearId:'year:B' });
  await store.patchDevice({ activeYearId:'year:B' });
  await assert.rejects(store.createSection({ grade:4, label:'١', yearId:'year:A' }), /موجود مسبق/);
  await assert.rejects(store.editSection(a.id, { grade:4, label:'2' }), /موجود مسبق/);
});

test('unvalidated direct Delete leaves section, Teaching and items intact', async () => {
  const a = await store.createSection({ grade:4, label:'أ' });
  const teaching = await store.createTeaching({ sectionId:a.id, subjectId:'subject:test', termId:'term:test' });
  const itemIds = store.items(teaching.id).map((item) => item.id);
  await assert.rejects(store.deleteClass(a.id), /اختيار المادة/);
  assert.equal((await db.get('sections', a.id)).deleted, false);
  assert.equal((await db.get('teachings', teaching.id)).deleted, false);
  for (const id of itemIds) assert.equal((await db.get('items', id)).deleted, false);
});
