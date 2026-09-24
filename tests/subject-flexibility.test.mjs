import 'fake-indexeddb/auto';
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';

import * as db from '../src/lib/db.js';
import * as cloud from '../src/lib/cloud.js';
import { activateSyntheticAccountWorkspace } from './helpers/synthetic-workspace.mjs';
import { buildBackup } from '../src/lib/export.js';
import {
  BUILTIN_SUBJECTS, customSubjectSlug, matchBuiltinSubject, normalizeSubjectName,
  subjectCatalogOptions, validateCustomSubjectName,
} from '../src/lib/subject-catalog.js';
import * as store from '../src/store.js';
import { itemScore, makeSubject } from '../src/models.js';

global.document = {
  documentElement: { setAttribute() {}, removeAttribute() {}, classList: { add() {}, remove() {} } },
  querySelector: () => ({ setAttribute() {} }),
};
global.matchMedia = () => ({ matches: false });

before(async () => {
  cloud.setMockBackend({ getScoreFoundationCapability: () => ({ scoreDomainVersion: 1,
    restoreProtocol: 'CORE_V2', backupVersion: 5, copyDomainVersion: 1 }) });
  await activateSyntheticAccountWorkspace();
});

after(() => {
  cloud.setMockBackend(null);
  store.closeChannel();
  db.closeDB();
});

async function fresh() {
  await db.clearAll();
  store.state.ready = false;
  await store.init();
}

test('built-in catalog has stable concise identities and forgiving Arabic/English aliases', () => {
  assert.deepEqual(BUILTIN_SUBJECTS.map((subject) => subject.name), [
    'القرآن والإسلامية', 'العربية', 'الرياضيات', 'العلوم', 'الإنجليزية', 'الاجتماعيات',
    'المهارات الرقمية', 'الفنية', 'البدنية', 'الحياتية والأسرية', 'التفكير الناقد', 'التقنية الرقمية',
  ]);
  assert.equal(new Set(BUILTIN_SUBJECTS.map((subject) => subject.id)).size, 12);
  assert.equal(matchBuiltinSubject('  اللُّغَة   العَرَبِيَّة  ')?.id, 'sub:arabic');
  assert.equal(matchBuiltinSubject('SOCIAL-STUDIES')?.id, 'sub:social-studies');
  assert.equal(matchBuiltinSubject('الحاسب الآلي')?.id, 'sub:digital-skills');
  assert.equal(normalizeSubjectName('إنجليزي'), normalizeSubjectName('انجليزي'));
});

test('custom subject validation and natural identity are deterministic without changing its display label', () => {
  const first = validateCustomSubjectName('  علم   الأرض  ');
  const same = validateCustomSubjectName('عِلْم الأرض');
  assert.deepEqual(first, { ok: true, name: 'علم الأرض', normalized: 'علم الارض' });
  assert.equal(same.normalized, first.normalized);
  assert.equal(customSubjectSlug(first.name), customSubjectSlug(same.name));
  assert.equal(validateCustomSubjectName('   ').ok, false);
  assert.equal(validateCustomSubjectName('x'.repeat(61)).ok, false);
  assert.equal(validateCustomSubjectName('***').ok, false);
  assert.equal(validateCustomSubjectName('Earth Science').ok, true);
});

test('picker options put used subjects first without precreating the full catalog', () => {
  const records = [
    { id: 'sub:digital-skills', name: 'المهارات الرقمية', slug: 'digital-skills' },
    { id: 'sub:custom', name: 'الروبوت', slug: 'custom-robot' },
  ];
  const options = subjectCatalogOptions(records, ['sub:custom']);
  assert.equal(options.length, 13);
  assert.equal(options.find((option) => option.subjectId === 'sub:custom')?.used, true);
  assert.equal(options.filter((option) => option.used).length, 1);
  assert.equal(options.filter((option) => option.builtin).length, 12);

  const legacy = subjectCatalogOptions([{ id: 'sub:computer', name: 'الحاسب الآلي', slug: 'computer' }], ['sub:computer']);
  const digital = legacy.find((option) => option.name === 'المهارات الرقمية');
  assert.equal(digital.token, 'subject:sub:computer');
  assert.equal(digital.used, true);
  assert.equal(legacy.length, 12, 'the legacy alias must not appear as a duplicate custom subject');
});

test('custom and alias-equivalent subjects are reused, persist offline, queue V2, and enter V5 backup', async () => {
  await fresh();
  const arabic = await store.resolveSubjectSelection({ token: 'custom', customName: 'اللغة العربية' });
  assert.equal(arabic.id, 'sub:arabic');
  assert.equal((await store.resolveSubjectSelection({ token: 'builtin:arabic' })).id, arabic.id);

  const custom = await store.resolveSubjectSelection({ token: 'custom', customName: '  علم   الأرض  ' });
  const duplicate = await store.resolveSubjectSelection({ token: 'custom', customName: 'عِلْم الأرض' });
  assert.equal(duplicate.id, custom.id);
  assert.equal(custom.name, 'علم الأرض');
  assert.match(custom.id, /^sub:/);
  assert.equal(store.subjects().filter((subject) => normalizeSubjectName(subject.name) === 'علم الارض').length, 1);

  const queued = (await db.getAll('outbox')).filter((entry) => entry.store === 'subjects' && entry.recordId === custom.id);
  assert.equal(queued.length, 1);
  assert.equal(queued[0].protocol, 'v2');
  assert.equal(queued[0].op, 'create');
  assert.equal(queued[0].patch.slug, custom.slug);

  await db.closeDB();
  store.state.ready = false;
  await store.init();
  assert.equal(store.getSubject(custom.id)?.name, 'علم الأرض');
  const backup = await buildBackup({ sourceOwnerId: 'subject-test-owner', backupId: 'subject-test-backup' });
  assert.equal(backup.version, 5);
  assert.equal(backup.data.subjects.some((subject) => subject.id === custom.id), true);
});

test('a proven legacy subject alias keeps its existing production identity', async () => {
  await db.clearAll();
  const legacy = makeSubject({ id: 'sub:computer', name: 'الحاسب الآلي', slug: 'computer' });
  await db.put('subjects', legacy);
  store.state.ready = false;
  await store.init();
  const resolved = await store.resolveSubjectSelection({ token: 'builtin:digital-skills' });
  assert.equal(resolved.id, legacy.id);
  assert.equal(store.getSubject('sub:digital-skills'), null);
  assert.equal(store.subjects().filter((subject) => ['computer', 'digital-skills'].includes(subject.slug)).length, 1);
});

test('the same custom subject identity supports reviewed grade portability across sections', async () => {
  await fresh();
  const subject = await store.resolveSubjectSelection({ token: 'custom', customName: 'علوم الأرض' });
  const x = await store.createSection({ grade: 5, label: 'س', name: 'الخامس / س' });
  const y = await store.createSection({ grade: 5, label: 'ص', name: 'الخامس / ص' });
  const teachingX = await store.createTeaching({ sectionId: x.id, subjectId: subject.id });
  const teachingY = await store.createTeaching({ sectionId: y.id, subjectId: subject.id });
  const student = await store.addStudent(x.id, 'طالب المادة المخصصة');
  const itemX = store.items(teachingX.id).find((item) => item.auto == null);
  const itemY = store.items(teachingY.id).find((item) => item.name === itemX.name && item.max === itemX.max && item.auto == null);
  await store.setScore(student.id, itemX.id, 8);
  await store.transferStudent(student.id, y.id, { date: '2026-09-10' });
  assert.equal(itemScore(itemY, store.studentContext(student.id, teachingY.id)), null,
    'matching subject and item names never grant portability automatically');
  await store.linkPortableScoreItems(itemX.id, itemY.id, { confirmed: true });
  assert.equal(itemScore(itemY, store.studentContext(student.id, teachingY.id)), 8);
  assert.equal(store.getSubject(teachingX.subjectId)?.id, store.getSubject(teachingY.subjectId)?.id);
  const frozen = store.buildClosedTermReportPayload(teachingX.termId).teachingDocuments
    .find((document) => document.teaching.id === teachingX.id);
  assert.equal(frozen.subject.id, subject.id);
  assert.equal(frozen.subject.name, 'علوم الأرض');
});
