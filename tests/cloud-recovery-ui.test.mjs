import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cloudRecoveryEntryState,
  cloudRecoveryErrorPresentation,
  groupCloudRestoreEntries,
  summarizeCloudRestorePlan,
} from '../src/lib/cloud-recovery-ui.js';

const entries = [
  { store: 'students', classification: 'SAFE_APPLY', operation: 'create' },
  { store: 'students', classification: 'SAFE_APPLY', operation: 'patch' },
  { store: 'students', classification: 'SAFE_APPLY', operation: 'delete' },
  { store: 'students', classification: 'KEEP_SERVER', reason: 'backup-unchanged' },
  { store: 'students', classification: 'KEEP_SERVER', reason: 'server-only' },
  { store: 'students', classification: 'CONFLICT', reason: 'same-field-change' },
  { store: 'sections', classification: 'INVALID', reason: 'closed-term-lifecycle-requires-specialized-review' },
];

test('cloud recovery presentation classifies every runtime plan state without manual choices', () => {
  assert.deepEqual(entries.map(cloudRecoveryEntryState), [
    'add', 'update', 'delete', 'keep', 'cloudOnly', 'blocked', 'blocked',
  ]);
  assert.deepEqual(summarizeCloudRestorePlan({ entries }), {
    add: 1, update: 1, delete: 1, keep: 1, cloudOnly: 1, blocked: 2,
  });
});

test('cloud recovery review groups friendly categories and explains blockers', () => {
  const groups = groupCloudRestoreEntries({ entries });
  assert.equal(groups[0].state, 'blocked');
  assert.equal(groups.filter((group) => group.state === 'blocked').length, 2);
  assert.equal(groups.some((group) => group.label === 'الطلاب' && /لا يمكن الاختيار تلقائيًا/.test(group.reason)), true);
  assert.equal(groups.some((group) => group.label === 'الشُعب' && /فصل دراسي مغلق/.test(group.reason)), true);
  assert.equal(groups.some((group) => group.state === 'cloudOnly' && /السحابي فقط/.test(group.reason)), true);
  assert.equal(groups.some((group) => 'id' in group || 'entity' in group), false);
});

test('cloud recovery errors stay actionable and distinguish finalized cloud recovery', () => {
  assert.deepEqual(cloudRecoveryErrorPresentation({ code: 'AUTH_REQUIRED' }), {
    code: 'AUTH_REQUIRED', title: 'يلزم تسجيل الدخول',
    message: 'سجّل الدخول من مركز المعلّم، ثم أعد المحاولة.', kind: 'auth',
  });
  assert.match(cloudRecoveryErrorPresentation({ code: 'OFFLINE' }).title, /الاتصال/);
  assert.match(cloudRecoveryErrorPresentation({ code: 'RESTORE_SYNC_NOT_HEALTHY' }).title, /المزامنة/);
  assert.equal(cloudRecoveryErrorPresentation({ code: 'LOCAL_RECONCILIATION_REQUIRED' }).title, 'اكتملت الاستعادة في السحابة');
  assert.match(cloudRecoveryErrorPresentation({ code: 'UNSUPPORTED_BACKUP_VERSION' }).message, /V4/);
});
