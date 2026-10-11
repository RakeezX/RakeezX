import test from 'node:test';
import assert from 'node:assert/strict';
import { achievementCard, achievementPng, drawAchievementCard } from '../src/lib/student-achievements.js';

const input = {
  studentId: 'private-id',
  history: { logs: [{ record: { studentId: 'private-id', kind: 'participation', delta: 1, otp: 'secret' } }],
    attendance: [{ record: { studentId: 'private-id', status: 'present', date: 'private-date' } }] },
  items: [{ id: 'private-item', max: 10 }],
  gradeCtx: { scoresByItem: { 'private-item': { studentId: 'private-id', value: 10 } } },
  notes: 'private-note', credentials: 'private-token',
};

test('export requires opt-in, uses fixed positive allowlist and excludes attendance/private profile data', () => {
  assert.deepEqual(achievementCard(input).evidence, []);
  assert.equal(achievementCard(input, { studentName: 'اسم خاص' }).name, '');
  const before = structuredClone(input);
  const card = achievementCard(input, { selected: ['participation', 'scores', 'attendance', 'notes', 'credentials'], studentName: 'اسم خاص' });
  assert.deepEqual(card.evidence.map(f => [f.key, f.count]), [['participation', 1], ['scores', 1]]);
  assert.equal(card.name, '');
  assert.equal(/private|secret|otp|attendance|notes|credentials|اسم خاص/.test(JSON.stringify(card)), false);
  assert.deepEqual(input, before);
  assert.equal(achievementCard(input, { includeName: true, studentName: 'اسم\u202e خاص' }).name, 'اسم خاص');
});

test('empty, negative, unconfirmed, auto and other-student evidence never generates medals', () => {
  const invalid = structuredClone(input);
  invalid.history.logs[0].record.delta = -1;
  invalid.items[0].auto = 'attendance';
  assert.deepEqual(achievementCard(invalid, { selected: ['participation', 'scores'] }).evidence, []);
  invalid.items[0].auto = null;
  invalid.gradeCtx.scoresByItem['private-item'].studentId = 'other';
  assert.deepEqual(achievementCard(invalid, { selected: ['participation', 'scores'] }).evidence, []);
  assert.deepEqual(achievementCard({ studentId: 'A', history: { logs: [], attendance: [] }, items: [], gradeCtx: {} }, { selected: ['scores'] }).evidence, []);
});

test('Canvas paints selected safe evidence only offline and PNG requires explicit teacher confirmation', async () => {
  const text = [];
  let encodes = 0;
  const ctx = new Proxy({ fillText: value => text.push(value) }, { get: (target, key) => target[key] ?? (() => {}) });
  const canvas = { getContext: () => ctx, toBlob: (callback, type) => { encodes++; callback(new Blob(['PNG'], { type })); } };
  const card = achievementCard(input, { selected: ['participation'], demo: true });
  const fetchBefore = globalThis.fetch;
  globalThis.fetch = () => { throw new Error('Unexpected external request'); };
  try {
    drawAchievementCard(canvas, card);
    assert.equal(canvas.width, 1000);
    assert.equal(canvas.height, 1040);
    assert.ok(text.includes('مشاركات إيجابية'));
    assert.ok(text.includes('بيانات تجريبية · رَكيز المعلم'));
    assert.equal(text.some(value => /private|secret|حضور|درجة/.test(value)), false);
    await assert.rejects(achievementPng(canvas, card));
    await assert.rejects(achievementPng(canvas, card, 'true'));
    await assert.rejects(achievementPng(canvas, achievementCard(input), true));
    assert.equal(encodes, 0);
    assert.equal((await achievementPng(canvas, card, true)).type, 'image/png');
    assert.equal(encodes, 1);
  } finally { globalThis.fetch = fetchBefore; }
});
