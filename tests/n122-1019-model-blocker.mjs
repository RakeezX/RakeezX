import test from 'node:test';
import assert from 'node:assert/strict';
import { makeSlot } from '../src/models.js';
import { encodeSyncV2Patch, decodeSyncV2Canonical } from '../src/lib/sync-v2.js';

// Original failing representation is preserved in commit 70973d46. This is now
// the regression for the qualified local protocol extension, not rendered UI.
test('N122: standalone activity and waiting retain distinct kinds and term in Sync', () => {
  const fixture = { id: 'n122-synthetic-slot', teachingId: null, weekday: 1, period: 2,
    termId: 'n122-synthetic-term' };
  const activity = makeSlot({ ...fixture, kind: 'activity' });
  const waiting = makeSlot({ ...fixture, kind: 'waiting' });
  assert.equal(activity.kind, 'activity');
  assert.equal(waiting.kind, 'waiting');
  const activityPatch = encodeSyncV2Patch('slots', activity);
  const waitingPatch = encodeSyncV2Patch('slots', waiting);
  assert.deepEqual(activityPatch, { teaching_id: null, weekday: 1, period: 2, kind: 'activity', term_id: fixture.termId });
  assert.deepEqual(waitingPatch, { ...activityPatch, kind: 'waiting' });
  const canonical = decodeSyncV2Canonical('slots', { id: fixture.id, ...activityPatch });
  assert.equal(canonical.teachingId, null);
  assert.equal(canonical.kind, 'activity');
  assert.equal(canonical.termId, fixture.termId);
});

test('N122 diagnostic control: existing academic slot identity survives the same codec', () => {
  const original = makeSlot({ id: 'n122-existing-slot', teachingId: 'n122-existing-teaching', weekday: 1, period: 1 });
  const canonical = decodeSyncV2Canonical('slots', {
    id: original.id, ...encodeSyncV2Patch('slots', original),
  });
  assert.equal(canonical.id, original.id);
  assert.equal(canonical.teachingId, original.teachingId);
  assert.equal(canonical.weekday, original.weekday);
  assert.equal(canonical.period, original.period);
  const legacy = decodeSyncV2Canonical('slots', { id: original.id, teaching_id: original.teachingId, weekday: 1, period: 1 });
  assert.equal(legacy.kind, 'teaching');
  assert.equal(legacy.termId, null);
});
