import test from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';

global.document = { documentElement: { setAttribute() {}, removeAttribute() {}, classList: { add() {}, remove() {} } }, querySelector: () => ({ setAttribute() {} }) };
global.matchMedia = () => ({ matches: false });

import * as db from '../src/lib/db.js';
import * as store from '../src/store.js';
import { SYNC_V2_SCHEMAS, decodeSyncV2Canonical, encodeSyncV2Patch } from '../src/lib/sync-v2.js';

test.after(() => {
  store.closeChannel();
  db.closeDB();
});

async function fresh() {
  await db.clearAll();
  await store.init();
}

async function teachingFixture() {
  const section = await store.createSection({ grade: 5, label: 'ق', name: 'فصل القوانين' });
  const teaching = await store.createTeaching({ sectionId: section.id });
  return { section, teaching };
}

test('class rules validate, persist offline, queue generic V2 mutations, and preserve creation order', async () => {
  await fresh();
  const { teaching } = await teachingFixture();

  assert.equal(await store.addClassRule({ teachingId: teaching.id, iconKey: 'star', text: '   ' }), null);
  assert.equal(await store.addClassRule({ teachingId: teaching.id, iconKey: 'غير-مفتاح', text: 'قاعدة' }), null);

  const first = await store.addClassRule({ teachingId: teaching.id, iconKey: 'star', text: '  نبدأ بهدوء  ', createdAt: 10 });
  const second = await store.addClassRule({ teachingId: teaching.id, iconKey: 'check', text: 'نحترم الجميع', createdAt: 20 });
  assert.ok(first && second);
  assert.deepEqual(store.classRulesOf(teaching.id).map((rule) => rule.id), [first.id, second.id]);
  assert.equal(first.text, 'نبدأ بهدوء');

  const queued = await db.getAll('outbox');
  const creates = queued.filter((entry) => entry.store === 'classRules');
  assert.equal(creates.length, 2);
  assert.equal(creates.every((entry) => entry.protocol === 'v2' && entry.op === 'create'), true);
  assert.equal(creates[0].patch.teaching_id, teaching.id);

  await store.editClassRule(first.id, { iconKey: 'book-open', text: 'نستمع باحترام' });
  assert.equal(store.classRulesOf(teaching.id)[0].iconKey, 'book-open');
  assert.equal(store.classRulesOf(teaching.id)[0].text, 'نستمع باحترام');
  assert.equal(await store.editClassRule(first.id, { text: 'x'.repeat(241) }), null);
});

test('class-rule tombstones converge with teaching and class lifecycle deletes without orphan live rules', async () => {
  await fresh();
  const { section, teaching } = await teachingFixture();
  const rule = await store.addClassRule({ teachingId: teaching.id, iconKey: 'shield', text: 'نحافظ على الأدوات' });
  assert.ok(rule);

  await store.deleteTeaching(teaching.id);
  assert.equal(store.state.classRules.find((item) => item.id === rule.id)?.deleted, true);
  assert.equal(store.classRulesOf(teaching.id).length, 0);

  const subject = await store.createSubject({ name: 'المهارات' });
  const nextTeaching = await store.createTeaching({ sectionId: section.id, subjectId: subject.id });
  const nextRule = await store.addClassRule({ teachingId: nextTeaching.id, iconKey: 'users', text: 'نتعاون' });
  await store.deleteClass(section.id);
  assert.equal(store.state.classRules.find((item) => item.id === nextRule.id)?.deleted, true);
  const lifecycle = (await db.getAll('outbox')).filter((entry) => entry.command?.startsWith('lifecycle:'));
  assert.equal(lifecycle.length >= 1, true);
});

test('class rules have a constrained generic V2 wire shape and retain server creation time on bootstrap', () => {
  assert.deepEqual(SYNC_V2_SCHEMAS.classRules, {
    entity: 'class_rules',
    fields: { teachingId: 'teaching_id', iconKey: 'icon_key', text: 'text' },
    references: { teachingId: 'teachings' },
  });
  assert.deepEqual(
    encodeSyncV2Patch('classRules', { teachingId: 'teaching-1', iconKey: 'star', text: 'قاعدة' }),
    { teaching_id: 'teaching-1', icon_key: 'star', text: 'قاعدة' },
  );
  const canonical = decodeSyncV2Canonical('classRules', {
    id: 'rule-1', teaching_id: 'teaching-1', icon_key: 'star', text: 'قاعدة',
    created_at: '2026-09-08T10:00:00.000Z', revision: 3,
    field_revisions: { identity: 1, icon: 2, text: 3 }, deleted_at: null, client_updated_at: 42,
  });
  assert.equal(canonical.createdAt, Date.parse('2026-09-08T10:00:00.000Z'));
  assert.equal(canonical.serverRevision, 3);
});
