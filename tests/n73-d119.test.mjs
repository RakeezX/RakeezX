import 'fake-indexeddb/auto';
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as db from '../src/lib/db.js';
import * as store from '../src/store.js';
import { demoDescriptor } from '../src/lib/workspaces.js';
import { planDistribution, distributionTargets } from '../src/lib/score-foundation.js';
import { itemScore } from '../src/models.js';
import itemsView from '../src/views/items.js';

global.document = { documentElement: { setAttribute() {}, removeAttribute() {}, classList: { add() {}, remove() {} } }, querySelector: () => ({ setAttribute() {} }) };
global.matchMedia = () => ({ matches: false });
before(async () => { await store.activateWorkspace(demoDescriptor()); });
after(async () => { store.closeChannel(); await db.closeDB(); });

function data() {
  return {
    terms: [{ id: 'term', yearId: 'year' }],
    sections: [1, 2, 3].map(n => ({ id: `section${n}`, yearId: 'year', grade: 4, name: `4/${n}` })),
    teachings: [1, 2, 3].map(n => ({ id: `t${n}`, sectionId: `section${n}`, termId: 'term', subjectId: 'math' })),
    students: [{ id: 'student' }, { id: 'student2' }],
    items: [{ id: 'source', teachingId: 't1', name: 'Exam', max: 20, order: 0, scoreMode: 'direct' },
      { id: 'target', teachingId: 't2', name: ' Exam ', max: 25, order: 1, scoreMode: 'direct' },
      { id: 'extra', teachingId: 't2', name: 'Extra', max: 5, order: 2 }],
    scores: [{ id: 'sourceScore', itemId: 'source', studentId: 'student', value: 19 },
      { id: 'targetScore', itemId: 'target', studentId: 'student', value: 23 },
      { id: 'targetScore2', itemId: 'target', studentId: 'student2', value: 18 },
      { id: 'extraScore', itemId: 'extra', studentId: 'student', value: 4 }],
    scoreSubitems: [], scoreSubitemCompletions: [], units: [], lessons: [],
  };
}
async function fixture(rows = data()) {
  await db.clearAll();
  for (const [name, values] of Object.entries(rows)) for (const row of values) await db.put(name, row);
  await store.init(); return rows;
}
async function apply(targets = ['t2'], removeItemIds = []) {
  const review = store.reviewScoreDistributionCopy('t1', targets, { removeItemIds });
  return store.applyReviewedScoreDistribution('t1', targets, { expectedToken: review.token, removeItemIds, confirmed: true });
}

test('persisted clamp, same parent identity, extras KEEP, missing contains no source grades, repeat no-op', async () => {
  await fixture();
  await apply(['t2', 't3']);
  assert.equal((await db.get('scores', 'targetScore')).value, 20);
  assert.equal((await db.get('scores', 'targetScore2')).value, 18);
  assert.equal((await db.get('items', 'target')).max, 20);
  assert.equal((await db.get('scores', 'extraScore')).value, 4);
  assert.equal((await db.get('scores', 'sourceScore')).value, 19);
  const clone = (await db.getAll('items')).find(row => row.teachingId === 't3');
  assert.ok(clone);
  assert.equal((await db.getAll('scores')).some(row => row.itemId === clone.id), false);
  await db.closeDB(); await store.init();
  assert.equal(store.state.scores.find(row => row.id === 'targetScore').value, 20);
  const before = await db.getAll('items');
  assert.equal((await apply(['t2', 't3'])).changedCount, 0);
  assert.deepEqual(await db.getAll('items'), before);
  assert.deepEqual(await db.getAll('outbox'), []);
});

test('increase preserves clamped persisted score; cannot resurrect 23', async () => {
  await fixture(); await apply();
  await db.put('items', { ...(await db.get('items', 'source')), max: 30 }); await store.init();
  await apply(); assert.equal((await db.get('scores', 'targetScore')).value, 20);
});

test('score-changing apply needs confirmation; stale DB scores abort all selected targets', async () => {
  await fixture(); const review = store.reviewScoreDistributionCopy('t1', ['t2', 't3']);
  await assert.rejects(store.applyReviewedScoreDistribution('t1', ['t2', 't3'], { expectedToken: review.token }), /تأكيد/);
  await db.put('scores', { ...(await db.get('scores', 'targetScore')), value: 22 });
  await assert.rejects(store.applyReviewedScoreDistribution('t1', ['t2', 't3'], { expectedToken: review.token, confirmed: true }), /تغيّر/);
  assert.equal((await db.get('items', 'target')).max, 25);
  assert.equal((await db.getAll('items')).some(row => row.teachingId === 't3'), false);
});

test('duplicate name, duplicate origin and many-to-one mapping exclude only the affected target', async () => {
  for (const variant of ['name', 'origin', 'source']) {
    const rows = data();
    if (variant === 'source') rows.items.push({ ...rows.items[0], id: 'source2' });
    else rows.items.push({ ...rows.items[1], id: 'duplicate' });
    if (variant === 'origin') for (const row of rows.items.filter(row => row.teachingId === 't2' && row.name.trim() === 'Exam')) row.distributionOriginId = 'source';
    await fixture(rows);
    const before = await db.getAll('items');
    const review = store.reviewScoreDistributionCopy('t1', ['t2', 't3']);
    assert.equal(review.excludedTargets[0].teachingId, 't2');
    assert.match(review.excludedTargets[0].reason, /مكرر/);
    assert.deepEqual(review.targets.map(row => row.teachingId), ['t3']);
    assert.deepEqual(await db.getAll('items'), before);
    await store.applyReviewedScoreDistribution('t1', ['t2', 't3'], { expectedToken: review.token, confirmed: true });
    assert.deepEqual((await db.getAll('items')).filter(row => row.teachingId === 't2'),
      before.filter(row => row.teachingId === 't2'));
  }
});

test('auto/manual transition discards stale manual evidence; target context calculates automatic value', async () => {
  const rows = data(); rows.items[0].auto = 'participation'; rows.items[0].perPoint = 2;
  await fixture(rows); await apply();
  assert.equal((await db.get('scores', 'targetScore')).value, null);
  const target = await db.get('items', 'target'); assert.equal(target.auto, 'participation');
  assert.equal(target.portabilityGroupId, null);
  assert.equal(itemScore(target, { classHasParticipation: true, logs: [{ kind: 'participation', delta: 3 }],
    scoresByItem: { target: { value: 23 } } }), 6, 'automatic value uses target logs, not prior manual score');
  await db.put('scores', { ...(await db.get('scores', 'targetScore')), value: 17, manualValue: 17 });
  await db.put('items', { ...(await db.get('items', 'source')), auto: null }); await store.init();
  await apply(); assert.equal((await db.get('scores', 'targetScore')).value, null);
  assert.equal((await db.get('scores', 'targetScore')).manualValue, null);
});

test('ambiguous subitems and orphan evidence abort every target; unrelated subject is untouched', async () => {
  const rows = data();
  rows.items.push({ id: 'otherSubject', teachingId: 'independent', name: 'Exam', max: 40 });
  rows.scores.push({ id: 'otherScore', itemId: 'otherSubject', studentId: 'student', value: 39 });
  await fixture(rows); await apply(['t2', 't3']);
  assert.equal((await db.get('scores', 'otherScore')).value, 39);
  for (const kind of ['duplicate', 'orphan']) {
    const bad = data();
    bad.items[0].scoreMode = bad.items[1].scoreMode = 'subitems';
    bad.items[0].distributionMode = bad.items[1].distributionMode = 'manual';
    bad.scoreSubitems = [{ id: 'subSource', itemId: 'source', name: 'A', value: 4, order: 0 },
      { id: 'subTarget', itemId: 'target', name: 'A', value: 4, order: 0 }];
    if (kind === 'duplicate') bad.scoreSubitems.push({ ...bad.scoreSubitems[1], id: 'duplicate' });
    else bad.scoreSubitemCompletions.push({ id: 'orphan', subitemId: 'subTarget', studentId: 'missing', checked: true });
    await fixture(bad);
    const before = await db.getAll('items');
    await assert.rejects(store.applyReviewedScoreDistribution('t1', ['t3', 't2'], { expectedToken: 'not-used', confirmed: true }));
    assert.deepEqual(await db.getAll('items'), before);
  }
});

test('subitem matching preserves owned identity/completion, removed definitions tombstone completions atomically', async () => {
  const rows = data();
  rows.items[0] = { ...rows.items[0], scoreMode: 'subitems', distributionMode: 'manual' };
  rows.items[1] = { ...rows.items[1], scoreMode: 'subitems', distributionMode: 'manual' };
  rows.scoreSubitems = [{ id: 's1', itemId: 'source', name: 'A', value: 3, order: 0 },
    { id: 'tSub', itemId: 'target', name: 'A', value: 5, order: 0 },
    { id: 'removed', itemId: 'target', name: 'B', value: 8, order: 1 }];
  rows.scoreSubitemCompletions = [{ id: 'completion', subitemId: 'tSub', studentId: 'student', checked: true },
    { id: 'removedCompletion', subitemId: 'removed', studentId: 'student', checked: true }];
  rows.scores[1] = { ...rows.scores[1], value: 15, derivedValue: 13, manualValue: 2 };
  await fixture(rows); await apply();
  assert.equal((await db.get('scoreSubitems', 'tSub')).value, 3);
  assert.equal((await db.get('scoreSubitemCompletions', 'completion')).checked, true);
  assert.equal((await db.get('scoreSubitemCompletions', 'removedCompletion')).deleted, true);
  assert.equal((await db.get('scores', 'targetScore')).value, 5);
});

test('explicit extra removal touches only owned rows; arbitrary removal rejected', async () => {
  await fixture();
  assert.throws(() => store.reviewScoreDistributionCopy('t1', ['t2'], { removeItemIds: ['source'] }), /extra/);
  await apply(['t2'], ['extra']);
  assert.equal((await db.get('items', 'extra')).deleted, true);
  assert.equal((await db.get('scores', 'extraScore')).deleted, true);
  assert.equal((await db.get('scores', 'sourceScore')).deleted, undefined);
});

test('owner isolation and independent subject/year/grade/term boundaries', () => {
  const rows = data();
  for (const variant of ['subjectId', 'termId']) {
    const isolated = structuredClone(rows); isolated.teachings[1][variant] = 'different';
    assert.equal(distributionTargets(isolated, 't1').some(row => row.id === 't2'), false);
  }
  for (const variant of ['grade', 'yearId']) {
    const isolated = structuredClone(rows); isolated.sections[1][variant] = 'different';
    assert.equal(distributionTargets(isolated, 't1').some(row => row.id === 't2'), false);
  }
  rows.scores[1].ownerId = 'foreign';
  assert.throws(() => planDistribution(rows, 't1', ['t2']), /owner/);
  rows.scores[1].ownerId = null; rows.scoreSubitems.push({ id: 'foreignSub', itemId: 'target', name: 'X', value: 1, ownerId: 'foreign' });
  assert.throws(() => planDistribution(rows, 't1', ['t2']), /owner/);
});

test('D105 parent rename after copy preserves identities, scoring evidence and separate edit actions', async () => {
  const rows = data();
  rows.items[0] = { ...rows.items[0], scoreMode: 'subitems', distributionMode: 'manual' };
  rows.items[1] = { ...rows.items[1], scoreMode: 'subitems', distributionMode: 'manual' };
  rows.scoreSubitems = [{ id: 'sourceSub', itemId: 'source', name: 'A', value: 5, order: 0 },
    { id: 'targetSub', itemId: 'target', name: 'A', value: 5, order: 0 }];
  rows.scoreSubitemCompletions = [{ id: 'checked', subitemId: 'targetSub', studentId: 'student', checked: true }];
  rows.scores[1] = { ...rows.scores[1], value: 7, derivedValue: 5, manualValue: 2 };
  await fixture(rows); await apply();
  const before = await db.get('items', 'target');
  const subitems = await db.getAll('scoreSubitems');
  const completions = await db.getAll('scoreSubitemCompletions');
  const scores = await db.getAll('scores');
  const markup = String(itemsView.render({ id: 't2' }));
  assert.equal((markup.match(/data-act="edit" data-id="target"/g) ?? []).length, 1);
  assert.equal((markup.match(/data-act="configure" data-id="target"/g) ?? []).length, 1);
  assert.match(markup, /البنود الفرعية/);
  assert.ok(await store.patch('items', 'target', { name: 'Renamed parent' }));
  const after = await db.get('items', 'target');
  for (const key of Object.keys(before).filter(key => !['name', 'updatedAt'].includes(key))) {
    assert.deepEqual(after[key], before[key], key);
  }
  assert.deepEqual(await db.getAll('scoreSubitems'), subitems);
  assert.deepEqual(await db.getAll('scoreSubitemCompletions'), completions);
  assert.deepEqual(await db.getAll('scores'), scores);
  await db.closeDB(); await store.init();
  assert.equal(store.state.items.find(row => row.id === 'target').name, 'Renamed parent');
});

test('N01 repeated whole-distribution apply cannot duplicate parents or subitems', async () => {
  const rows = data();
  rows.items[0] = { ...rows.items[0], scoreMode: 'subitems', distributionMode: 'auto' };
  rows.scoreSubitems = [{ id: 'sourceSub1', itemId: 'source', name: 'A', value: 10, order: 0 },
    { id: 'sourceSub2', itemId: 'source', name: 'B', value: 10, order: 1 }];
  await fixture(rows); await apply(['t3']);
  const items = await db.getAll('items');
  const subitems = await db.getAll('scoreSubitems');
  await db.closeDB(); await store.init();
  assert.equal((await apply(['t3'])).changedCount, 0);
  assert.deepEqual(await db.getAll('items'), items);
  assert.deepEqual(await db.getAll('scoreSubitems'), subitems);
  assert.deepEqual(await db.getAll('outbox'), []);
});
