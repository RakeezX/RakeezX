import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDayTargets,
  applyToOtherSchoolDays,
  setTargetDaySelected,
  selectedTargetDays,
  hasSelectedTargetDifference,
} from '../src/lib/day-targeting.js';

test('normal save targets only the current school day', () => {
  const targets = createDayTargets(2);
  assert.deepEqual(selectedTargetDays(targets), [2]);
  assert.equal(hasSelectedTargetDifference(targets, [{ period: 1 }], () => [{ period: 2 }]), false);
  assert.throws(() => createDayTargets(5), RangeError);
  assert.throws(() => setTargetDaySelected(targets, 1, true), RangeError);
});

test('explicit expansion selects other school days and each can be unchecked', () => {
  const initial = createDayTargets(2);
  const expanded = applyToOtherSchoolDays(initial);
  assert.deepEqual(selectedTargetDays(initial), [2]);
  assert.deepEqual(selectedTargetDays(expanded), [0, 1, 2, 3, 4]);
  const unchecked = setTargetDaySelected(setTargetDaySelected(expanded, 0, false), 4, false);
  assert.deepEqual(selectedTargetDays(unchecked), [1, 2, 3]);
  assert.deepEqual(selectedTargetDays(setTargetDaySelected(unchecked, 4, true)), [1, 2, 3, 4]);
  assert.throws(() => setTargetDaySelected(expanded, 2, false), RangeError);
  assert.throws(() => setTargetDaySelected(expanded, 6, true), RangeError);
});

test('manual and generated timing drafts use the same difference check', () => {
  const proposed = { periods: [{ period: 1, start: '07:00', end: '07:45' }], recess: { afterPeriod: 0 } };
  const existing = new Map([
    [0, { recess: { afterPeriod: 0 }, periods: [{ end: '07:45', start: '07:00', period: 1 }] }],
    [1, { periods: [{ period: 1, start: '08:00', end: '08:45' }], recess: { afterPeriod: 0 } }],
    [3, null],
  ]);
  const targets = applyToOtherSchoolDays(createDayTargets(2));
  const existingForDay = (day) => existing.get(day);
  for (const draftSource of ['manual', 'generator']) {
    assert.equal(hasSelectedTargetDifference(targets, proposed, existingForDay), true, draftSource);
  }
  const withoutConflict = setTargetDaySelected(targets, 1, false);
  assert.equal(hasSelectedTargetDifference(withoutConflict, proposed, existingForDay), false);
  assert.equal(hasSelectedTargetDifference(withoutConflict, proposed, () => undefined), false);
});
