import 'fake-indexeddb/auto';
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import * as db from '../src/lib/db.js';
import * as store from '../src/store.js';
import * as cloud from '../src/lib/cloud.js';
import { createSyncV2Engine } from '../src/lib/sync-v2.js';
import { runtimeSyncOwnershipGuard } from '../src/lib/sync-ownership.js';
import { activateSyntheticAccountWorkspace, SYNTHETIC_WORKSPACE_OWNER } from './helpers/synthetic-workspace.mjs';
import { makeEnrollment, makeItem, makeSection, makeStudent, makeSubject,
  makeTeaching, makeTerm, makeYear } from '../src/models.js';
import { distributeAutomatically, projectSubitemScore } from '../src/lib/score-foundation.js';

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

async function fixture() {
  await db.clearAll();
  await store.init();
  const year = makeYear({ id: 'score-foundation:year' });
  const term = makeTerm({ id: 'score-foundation:term', yearId: year.id });
  const subject = makeSubject({ id: 'score-foundation:subject' });
  const section = makeSection({ id: 'score-foundation:section', yearId: year.id, grade: 4 });
  const teaching = makeTeaching({ id: 'score-foundation:teaching', sectionId: section.id,
    subjectId: subject.id, termId: term.id });
  const student = makeStudent({ id: 'score-foundation:student' });
  const item = makeItem({ id: 'score-foundation:item', teachingId: teaching.id, max: 10 });
  await store.save({ years: [year], terms: [term], subjects: [subject], sections: [section],
    teachings: [teaching], students: [student], enrollments: [makeEnrollment({ studentId: student.id,
      sectionId: section.id })], items: [item] });
  return { student, item };
}

test('two-decimal automatic distribution and null versus explicit zero', () => {
  assert.deepEqual(distributeAutomatically(10, 3), [3.33, 3.33, 3.34]);
  const item = { max: 10 };
  const definitions = [{ id: 'one', value: 6 }, { id: 'two', value: 5 }];
  assert.equal(projectSubitemScore(item, definitions, [], null).value, null);
  assert.equal(projectSubitemScore(item, definitions, [], 0).value, 0);
  assert.deepEqual(projectSubitemScore(item, definitions,
    [{ subitemId: 'one', checked: true }], 5), {
    derivedValue: 6, manualValue: 4, value: 10, manualClamped: true,
  });
  assert.equal(projectSubitemScore(item, definitions, definitions.map((row) => ({
    subitemId: row.id, checked: true,
  })), null).value, 10);
});

test('projection boundary ignores foreign student, item, and owner components', () => {
  const item = { id: 'scoped:item', max: 10 };
  const definitions = [
    { id: 'scoped:three', itemId: item.id, value: 3 },
    { id: 'foreign:item-sub', itemId: 'other:item', value: 9 },
  ];
  const completions = [
    { studentId: 'A', subitemId: 'scoped:three', checked: true },
    { studentId: 'B', subitemId: 'scoped:three', checked: false },
    { studentId: 'B', subitemId: 'foreign:item-sub', checked: true },
    { studentId: 'B', subitemId: 'scoped:three', checked: true, ownerId: 'other-owner' },
  ];
  assert.throws(() => projectSubitemScore(item, definitions, completions, null),
    /Student identity is required/);
  assert.equal(projectSubitemScore(item, definitions, completions, null,
    { studentId: 'B', ownerId: 'owner-A' }).value, null);
  assert.equal(projectSubitemScore(item, definitions, completions, 0,
    { studentId: 'B', ownerId: 'owner-A' }).value, 0);
  assert.equal(projectSubitemScore(item, definitions, completions, null,
    { studentId: 'A', ownerId: 'owner-A' }).value, 3);
});

test('unsupported server rejects SUBITEM configuration while DIRECT score remains writable', async () => {
  const { item, student } = await fixture();
  cloud.setMockBackend({ getScoreFoundationCapability: () => null });
  try {
    const proposed = { scoreMode: 'subitems', distributionMode: 'auto',
      subitems: [{ name: 'واجب 1' }] };
    const preview = store.previewScoreConfiguration(item.id, proposed);
    await assert.rejects(() => store.applyConfirmedScoreConfiguration(item.id, proposed,
      { expectedVersion: preview.expectedVersion, confirmed: true }), /capability is unavailable/);
    assert.equal(store.state.items.find((row) => row.id === item.id).scoreMode, 'direct');
    assert.equal(store.scoreSubitemsOf(item.id).length, 0);
    await store.setScore(student.id, item.id, 4);
    assert.equal(store.scoresOf(student.id).find((row) => row.itemId === item.id)?.value, 4);
  } finally {
    cloud.setMockBackend({ getScoreFoundationCapability: () => ({ scoreDomainVersion: 1,
      restoreProtocol: 'CORE_V2', backupVersion: 5, copyDomainVersion: 1 }) });
  }
});

test('completion/manual/final projection is one local transaction and survives reload', async () => {
  const { item, student } = await fixture();
  const proposed = { scoreMode: 'subitems', distributionMode: 'auto', subitems: [
    { name: 'واجب 1' }, { name: 'واجب 2' }, { name: 'واجب 3' },
  ] };
  const preview = store.previewScoreConfiguration(item.id, proposed);
  await store.applyConfirmedScoreConfiguration(item.id, proposed,
    { expectedVersion: preview.expectedVersion, confirmed: true });
  const [first, second] = store.scoreSubitemsOf(item.id);
  assert.equal(first.value, 3.33);
  assert.equal(second.value, 3.33);
  await store.setScoreSubitemCompletion(student.id, first.id, true);
  const accepted = await store.setScoreManualContribution(student.id, item.id, 8);
  assert.equal(accepted.score.manualValue, 6.67);
  assert.equal(accepted.score.value, 10);
  await store.setScoreSubitemCompletion(student.id, second.id, true);
  assert.equal(store.scoresOf(student.id).find((row) => row.itemId === item.id)?.value, 10);
  await store.setScoreSubitemCompletion(student.id, first.id, false);
  const local = store.scoresOf(student.id).find((row) => row.itemId === item.id);
  assert.equal(local.derivedValue, 3.33);
  assert.equal(local.manualValue, 3.34, 'previously accepted manual amount does not secretly grow again');
  assert.equal(local.value, 6.67);
  const scoreOutbox = await db.getAll('outbox');
  assert.ok(scoreOutbox.some((row) => row.command === 'score:configure'));
  assert.ok(scoreOutbox.some((row) => row.command === 'score:set_completion'));
  assert.ok(scoreOutbox.some((row) => row.command === 'score:set_manual'));
  assert.ok(!scoreOutbox.some((row) => row.store === 'scores' && row.op !== 'command'),
    'subitem numeric projection is never a separate generic mutation');
  await db.closeDB();
  store.state.ready = false;
  await store.init();
  const restored = store.scoresOf(student.id).find((row) => row.itemId === item.id);
  assert.equal(restored.value, 6.67);
  assert.equal(store.state.scoreSubitemCompletions.filter((row) => row.checked).length, 1);
  assert.equal(store.state.scoreSubitemCompletions.filter((row) => !row.checked).length, 1);
});

test('per-student prepared scores never inherit another student completion or manual cap', async () => {
  const { item, student: a } = await fixture();
  const b = makeStudent({ id: 'score-foundation:student:b' });
  const c = makeStudent({ id: 'score-foundation:student:c' });
  await store.save({ students: [b, c], enrollments: [b, c].map((row) =>
    makeEnrollment({ studentId: row.id, sectionId: 'score-foundation:section' })) });
  const proposed = { scoreMode: 'subitems', distributionMode: 'manual', subitems: [
    { name: 'ثلاث', value: 3 }, { name: 'خمس', value: 5 }, { name: 'اثنتان', value: 2 },
  ] };
  await store.applyConfirmedScoreConfiguration(item.id, proposed,
    { expectedVersion: store.previewScoreConfiguration(item.id, proposed).expectedVersion, confirmed: true });
  const [three, five, two] = store.scoreSubitemsOf(item.id);
  await store.setScoreSubitemCompletion(a.id, three.id, true);
  assert.equal(store.scoresOf(a.id).find((row) => row.itemId === item.id).derivedValue, 3);
  assert.equal(store.scoresOf(b.id).find((row) => row.itemId === item.id), undefined,
    'blank B remains unrecorded when A checks a shared definition');
  const bManual = await store.setScoreManualContribution(b.id, item.id, 4);
  assert.deepEqual([bManual.derivedValue, bManual.manualValue, bManual.value], [0, 4, 4]);
  await store.setScoreSubitemCompletion(c.id, three.id, true);
  assert.equal(store.scoresOf(c.id).find((row) => row.itemId === item.id).value, 3);
  await store.setScoreSubitemCompletion(a.id, three.id, false);
  assert.equal(store.scoresOf(c.id).find((row) => row.itemId === item.id).value, 3,
    'unchecking A does not change C');
  assert.equal(store.scoresOf(b.id).find((row) => row.itemId === item.id).value, 4);
  await store.setScoreSubitemCompletion(a.id, three.id, true);
  await store.setScoreSubitemCompletion(a.id, five.id, true);
  await store.setScoreSubitemCompletion(b.id, two.id, true);
  const capped = await store.setScoreManualContribution(b.id, item.id, 9);
  assert.deepEqual([capped.derivedValue, capped.manualValue, capped.value], [2, 8, 10],
    'A derived 8 cannot reduce B remaining capacity');
  await db.closeDB();
  store.state.ready = false;
  await store.init();
  assert.equal(store.scoresOf(a.id).find((row) => row.itemId === item.id).derivedValue, 8);
  assert.deepEqual(store.scoresOf(b.id).find((row) => row.itemId === item.id) && [
    store.scoresOf(b.id).find((row) => row.itemId === item.id).derivedValue,
    store.scoresOf(b.id).find((row) => row.itemId === item.id).manualValue,
    store.scoresOf(b.id).find((row) => row.itemId === item.id).value,
  ], [2, 8, 10]);
  assert.equal(store.scoresOf(c.id).find((row) => row.itemId === item.id).value, 3);
});

test('score domain outbox retries the same command and adopts one canonical projection', async () => {
  const { item, student } = await fixture();
  await db.clearStore('outbox');
  await db.put('items', { ...item, scoreMode: 'subitems', distributionMode: 'manual',
    serverRevision: 1 });
  await db.put('students', { ...student, serverRevision: 1 });
  await db.put('scoreSubitems', { id: 'score-foundation:sub:retry', itemId: item.id,
    name: 'three', value: 3, order: 0, serverRevision: 1 });
  await store.refreshSyncedState();
  const local = await store.setScoreSubitemCompletion(student.id, 'score-foundation:sub:retry', true);
  const command = (await db.getAll('outbox')).find((row) => row.command === 'score:set_completion');
  assert.ok(command);
  let calls = 0;
  const sent = [];
  const transport = { async applyScoreSubitemCommand(envelope) {
    calls++;
    sent.push(structuredClone(envelope));
    const receipt = { mutationId: envelope.mutationId,
      score: { id: local.score.id, student_id: student.id, item_id: item.id,
        value: 3, derived_value: 3, manual_value: null, revision: 1, deleted_at: null },
      completion: { id: local.completion.id, student_id: student.id,
        subitem_id: 'score-foundation:sub:retry', checked: true,
        revision: 1, deleted_at: null } };
    if (calls === 1) throw new Error('synthetic timeout after server commit');
    return receipt;
  } };
  const engine = createSyncV2Engine({ database: db, transport,
    ownershipGuard: runtimeSyncOwnershipGuard,
    currentAuthenticatedUserId: () => SYNTHETIC_WORKSPACE_OWNER });
  assert.equal((await engine.dispatchPending()).failed, 1);
  const pending = (await db.getAll('outbox')).find((row) => row.id === command.id);
  assert.equal(pending.attemptCount, 1);
  assert.equal((await engine.dispatchPending()).acknowledged, 1);
  assert.equal(calls, 2);
  assert.equal(sent[0].mutationId, sent[1].mutationId);
  assert.equal((await db.getAll('outbox')).length, 0);
  assert.equal((await db.get('scores', local.score.id)).value, 3);
  assert.equal((await db.get('scores', local.score.id)).serverRevision, 1);
  assert.equal((await db.get('scoreSubitemCompletions', local.completion.id)).serverRevision, 1);
});

test('atomic cloud score snapshot repairs stale local projection from authoritative components', async () => {
  const { item, student } = await fixture();
  const second = makeStudent({ id: 'score-foundation:snapshot-other-student' });
  await db.put('students', second);
  await db.clearStore('outbox');
  const scoreId = 'score-foundation:snapshot-score';
  const subitemId = 'score-foundation:snapshot-subitem';
  const completionId = 'score-foundation:snapshot-completion';
  await db.put('items', { ...item, scoreMode: 'subitems', distributionMode: 'manual', serverRevision: 1 });
  await db.put('scoreSubitems', { id: subitemId, itemId: item.id, name: 'three', value: 3,
    order: 0, serverRevision: 1 });
  await db.put('scoreSubitemCompletions', { id: completionId, studentId: student.id,
    subitemId, checked: false, serverRevision: 1 });
  await db.put('scores', { id: scoreId, itemId: item.id, studentId: student.id,
    derivedValue: 0, manualValue: 5, value: 5, serverRevision: 1 });
  const owner_id = SYNTHETIC_WORKSPACE_OWNER;
  const snapshot = {
    items: [{ id: item.id, owner_id, teaching_id: item.teachingId, name: item.name,
      max: 10, score_mode: 'subitems', distribution_mode: 'manual', revision: 2, deleted_at: null }],
    score_subitems: [{ id: subitemId, owner_id, item_id: item.id, name: 'three', value: 3,
      order: 0, revision: 2, deleted_at: null }],
    score_subitem_completions: [{ id: completionId, owner_id, student_id: student.id,
      subitem_id: subitemId, checked: true, revision: 2, deleted_at: null }],
    scores: [{ id: scoreId, owner_id, student_id: student.id, item_id: item.id,
      derived_value: 3, manual_value: 5, value: 8, revision: 2, deleted_at: null },
    { id: 'score-foundation:snapshot-other-score', owner_id, student_id: second.id,
      item_id: item.id, derived_value: 0, manual_value: 4, value: 4,
      revision: 2, deleted_at: null }],
  };
  const transport = { fetchRecords: async () => [], getScoreDomainSnapshot: async () => snapshot };
  const engine = createSyncV2Engine({ database: db, transport,
    ownershipGuard: runtimeSyncOwnershipGuard,
    currentAuthenticatedUserId: () => SYNTHETIC_WORKSPACE_OWNER });
  const pulled = await engine.pullAll({ stores: ['scores'], scoreDomainSnapshot: true });
  assert.deepEqual(pulled.failures, []);
  assert.equal((await db.get('scores', scoreId)).value, 8);
  assert.equal((await db.get('scores', 'score-foundation:snapshot-other-score')).value, 4,
    'the second student receives only their own cloud manual value');
  assert.equal((await db.get('scoreSubitemCompletions', completionId)).checked, true);
  const corrupted = structuredClone(snapshot);
  corrupted.scores[0].value = 9;
  transport.getScoreDomainSnapshot = async () => corrupted;
  const failed = await engine.pullAll({ stores: ['scores'], scoreDomainSnapshot: true });
  assert.equal(failed.failures.length, 1);
  assert.match(failed.failures[0].error.message, /projection disagrees/);
  assert.equal((await db.get('scores', scoreId)).value, 8,
    'inconsistent cloud response cannot partially replace the local score');
});

test('distribution copy queues one domain command and retry preserves cloned identities', async () => {
  const { item } = await fixture();
  await db.clearStore('outbox');
  const sourceTeaching = store.state.teachings.find((row) => row.id === item.teachingId);
  const sourceSection = store.state.sections.find((row) => row.id === sourceTeaching.sectionId);
  const targetSection = makeSection({ id: 'score-foundation:target-section',
    yearId: sourceSection.yearId, grade: sourceSection.grade, label: 'B' });
  const targetTeaching = makeTeaching({ id: 'score-foundation:target-teaching',
    sectionId: targetSection.id, subjectId: sourceTeaching.subjectId,
    termId: sourceTeaching.termId, serverRevision: 1 });
  await db.put('sections', { ...targetSection, serverRevision: 1 });
  await db.put('teachings', targetTeaching);
  await db.put('items', { ...item, scoreMode: 'subitems', distributionMode: 'manual',
    serverRevision: 1 });
  await db.put('scoreSubitems', { id: 'score-foundation:copy-source-sub',
    itemId: item.id, name: 'three', value: 3, order: 0, serverRevision: 1 });
  await store.refreshSyncedState();
  const copied = await store.applyScoreDistributionCopy(sourceTeaching.id, [targetTeaching.id]);
  assert.equal(copied.itemIds.length, 1);
  assert.equal(copied.subitemIds.length, 1);
  const commands = await db.getAll('outbox');
  assert.equal(commands.length, 1);
  assert.equal(commands[0].command, 'score:copy_definition');
  const copiedItem = await db.get('items', copied.itemIds[0]);
  const copiedSubitem = await db.get('scoreSubitems', copied.subitemIds[0]);
  let calls = 0;
  const sent = [];
  const engine = createSyncV2Engine({ database: db,
    transport: { async applyScoreDistributionCopyCommand(envelope) {
      calls++;
      sent.push(structuredClone(envelope));
      if (calls === 1) throw new Error('synthetic timeout after copy commit');
      return { mutationId: envelope.mutationId,
        item: { id: copiedItem.id, teaching_id: targetTeaching.id, name: copiedItem.name,
          max: copiedItem.max, score_mode: 'subitems', distribution_mode: 'manual',
          distribution_version: 1, distribution_origin_id: item.id,
          portability_group_id: null, revision: 1, deleted_at: null },
        subitems: [{ id: copiedSubitem.id, item_id: copiedItem.id, name: copiedSubitem.name,
          value: 3, order: 0, distribution_version: 1, revision: 1, deleted_at: null }],
        scores: [] };
    } }, ownershipGuard: runtimeSyncOwnershipGuard,
    currentAuthenticatedUserId: () => SYNTHETIC_WORKSPACE_OWNER });
  assert.equal((await engine.dispatchPending()).failed, 1);
  assert.equal((await engine.dispatchPending()).acknowledged, 1);
  assert.equal(calls, 2);
  assert.equal(sent[0].mutationId, sent[1].mutationId);
  assert.equal(sent[0].newItemId, sent[1].newItemId);
  assert.deepEqual(sent[0].subitemIds, sent[1].subitemIds);
  assert.equal((await db.getAll('outbox')).length, 0);
  assert.equal((await db.get('items', copiedItem.id)).serverRevision, 1);
  assert.equal((await db.get('scoreSubitems', copiedSubitem.id)).serverRevision, 1);
  assert.equal((await db.getAll('scores')).length, 0);
});

test('distribution copy accepts only an explicit nonempty eligible subset', async () => {
  const { item, student } = await fixture();
  await db.clearStore('outbox');
  const source = store.state.teachings.find((row) => row.id === item.teachingId);
  const sourceSection = store.state.sections.find((row) => row.id === source.sectionId);
  const targets = [];
  for (let index = 1; index <= 4; index++) {
    const section = makeSection({ id: `subset:section:${index}`, yearId: sourceSection.yearId,
      grade: sourceSection.grade, label: String(index + 1) });
    const teaching = makeTeaching({ id: `subset:teaching:${index}`, sectionId: section.id,
      subjectId: source.subjectId, termId: source.termId, serverRevision: 1 });
    await db.put('sections', section);
    await db.put('teachings', teaching);
    targets.push(teaching);
  }
  const existing = makeItem({ id: 'subset:existing', teachingId: targets[0].id,
    name: 'بند مستقل', max: 15, order: 1 });
  await db.put('items', existing);
  await db.put('scores', { id: 'subset:existing-score', itemId: existing.id,
    studentId: student.id, value: 7 });
  await store.refreshSyncedState();
  const beforeUnselected = [1, 3].map((index) => store.state.items
    .filter((row) => row.teachingId === targets[index].id));
  const selected = [targets[2].id, targets[0].id];
  const copied = await store.applyScoreDistributionCopy(source.id, selected);
  assert.deepEqual(copied.classifications.map((row) => row.teachingId), [...selected].sort());
  assert.equal(copied.itemIds.length, 2);
  assert.deepEqual([1, 3].map((index) => store.state.items
    .filter((row) => row.teachingId === targets[index].id)), beforeUnselected);
  assert.deepEqual(await db.get('scores', 'subset:existing-score'), {
    id: 'subset:existing-score', itemId: existing.id, studentId: student.id, value: 7,
  });
  assert.ok(copied.itemIds.every((id) => store.state.items.find((row) => row.id === id)
    .portabilityGroupId === null));
  const count = store.state.items.length;
  const reject = async (ids) => {
    await assert.rejects(() => store.applyScoreDistributionCopy(source.id, ids));
    assert.equal(store.state.items.length, count);
  };
  await reject([]);
  await reject([targets[0].id, targets[0].id]);
  await reject([targets[0].id, 'subset:unknown']);
  await reject([source.id]);
  const otherYear = makeYear({ id: 'subset:other-year' });
  const otherTerm = makeTerm({ id: 'subset:other-term', yearId: sourceSection.yearId });
  const otherSubject = makeSubject({ id: 'subset:other-subject' });
  await db.put('years', otherYear);
  await db.put('terms', otherTerm);
  await db.put('subjects', otherSubject);
  for (const [name, yearId, grade, subjectId, termId] of [
    ['grade', sourceSection.yearId, sourceSection.grade + 1, source.subjectId, source.termId],
    ['year', otherYear.id, sourceSection.grade, source.subjectId, source.termId],
    ['term', sourceSection.yearId, sourceSection.grade, source.subjectId, otherTerm.id],
    ['subject', sourceSection.yearId, sourceSection.grade, otherSubject.id, source.termId],
  ]) {
    const section = makeSection({ id: `subset:${name}:section`, yearId, grade, label: name });
    const teaching = makeTeaching({ id: `subset:${name}:teaching`, sectionId: section.id,
      subjectId, termId });
    await db.put('sections', section);
    await db.put('teachings', teaching);
  }
  await store.refreshSyncedState();
  for (const name of ['grade', 'year', 'term', 'subject']) {
    await reject([targets[0].id, `subset:${name}:teaching`]);
  }
  const remaining = await store.applyScoreDistributionCopy(source.id, [targets[1].id]);
  assert.equal(remaining.itemIds.length, 1);
  assert.equal(store.state.items.length, count + 1);
});

after(async () => { store.closeChannel(); await db.closeDB(); cloud.setMockBackend(null); });
