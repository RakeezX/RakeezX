import test from 'node:test';
import assert from 'node:assert/strict';
import { verifiedEmailFeedback as next } from '../src/lib/settings-profile-ui.js';

test('N64 only verified same-owner email equality retires pending and completes', () => {
  const pending = next(null, { ownerId: 'a', email: 'old@test', pendingEmail: ' NEW@test ' });
  assert.equal(pending.requestedEmailChange, 'new@test');
  assert.equal(pending.completed, false);
  const unverified = next(pending, { ownerId: 'a', email: 'new@test' });
  assert.equal(unverified.completed, false, 'A response/local value alone is insufficient');
  assert.equal(next(pending, { ownerId: 'a', email: 'old@test', verified: true }).completed, false);
  const complete = next(pending, { ownerId: 'a', email: 'NEW@test', verified: true });
  assert.equal(complete.completed, true);
  assert.equal(complete.requestedEmailChange, '');
  assert.equal(next(complete, { ownerId: 'a', email: 'new@test' }).requestedEmailChange, '');
  assert.equal(next(complete, { ownerId: 'a', email: 'other@test' }).completed, false);
});
test('N64 owner switch, unknown new email and unrelated reload cannot announce completion', () => {
  const pending = next(null, { ownerId: 'a', email: 'old@test', pendingEmail: 'new@test' });
  for (const [state, ownerId] of [[pending, 'b'], [null, 'a']]) {
    const result = next(state, { ownerId, email: 'new@test', verified: true });
    assert.equal(result.completed, false);
    assert.equal(result.requestedEmailChange, '');
  }
});
