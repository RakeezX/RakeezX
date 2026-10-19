import test from 'node:test';
import assert from 'node:assert/strict';
import { makeSlot } from '../src/models.js';
import { encodeSyncV2Patch, decodeSyncV2Canonical } from '../src/lib/sync-v2.js';

// Diagnostic only: confirms why the existing protocol cannot implement N122.
// A PASS here is NOT the requested Product save/reload/edit/delete acceptance.
test('N122 diagnostic: standalone activity and waiting collapse to the same Sync payload', () => {
  const fixture = { id: 'n122-synthetic-slot', teachingId: null, weekday: 1, period: 2,
    termId: 'n122-synthetic-term' };
  const activity = makeSlot({ ...fixture, kind: 'activity' });
  const waiting = makeSlot({ ...fixture, kind: 'waiting' });
  assert.equal(activity.kind, 'activity');
  assert.equal(waiting.kind, 'waiting');
  const activityPatch = encodeSyncV2Patch('slots', activity);
  const waitingPatch = encodeSyncV2Patch('slots', waiting);
  assert.deepEqual(activityPatch, { teaching_id: null, weekday: 1, period: 2 });
  assert.deepEqual(waitingPatch, activityPatch);
  const canonical = decodeSyncV2Canonical('slots', { id: fixture.id, ...activityPatch });
  assert.equal(canonical.teachingId, null);
  assert.equal(Object.hasOwn(canonical, 'kind'), false);
  assert.equal(Object.hasOwn(canonical, 'termId'), false);
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
});
