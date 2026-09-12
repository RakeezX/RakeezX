import test from 'node:test';
import assert from 'node:assert/strict';

import {
  friendlySessionDeleteReason,
  sessionDeletePresentation,
  sessionDeleteQueuedCopy,
} from '../src/lib/session-delete-ui.js';

test('a pristine scheduled session is the only deletable presentation', () => {
  assert.deepEqual(sessionDeletePresentation(), {
    deletable: true,
    restored: false,
    primaryReason: '',
    additionalCount: 0,
  });
});

test('local evidence is presented in a stable friendly priority without exposing reason codes', () => {
  const result = sessionDeletePresentation({ evidence: ['content', 'attendance', 'makeup'] });
  assert.equal(result.deletable, false);
  assert.equal(result.restored, false);
  assert.equal(result.primaryReason, 'توجد سجلات حضور مرتبطة بهذه الحصة.');
  assert.equal(result.additionalCount, 2);
  assert.equal(friendlySessionDeleteReason('class_goal'), 'يوجد هدف صفي مرتبط بهذه الحصة.');
  assert.equal(friendlySessionDeleteReason('roster_snapshot'), 'يوجد كشف طلاب محفوظ مرتبط بهذه الحصة.');
  assert.equal(friendlySessionDeleteReason('unknown-server-reason'), 'تحتوي الحصة على بيانات محفوظة.');
});

test('archived and server-restored sessions remain visibly protected', () => {
  const archived = sessionDeletePresentation({ archived: true });
  assert.equal(archived.deletable, false);
  assert.match(archived.primaryReason, /مؤرشف/);

  const restored = sessionDeletePresentation({
    evidence: ['status'],
    deleteProtection: { reason: 'attendance', mutationId: 'm:1' },
  });
  assert.equal(restored.deletable, false);
  assert.equal(restored.restored, true);
  assert.equal(restored.primaryReason, 'توجد سجلات حضور مرتبطة بهذه الحصة.');

  const reconciling = sessionDeletePresentation({ cloudReconciliation: true });
  assert.equal(reconciling.deletable, false);
  assert.match(reconciling.primaryReason, /تحديث البيانات/);
});

test('queued deletion copy distinguishes offline, active sync, and local-only states', () => {
  assert.equal(
    sessionDeleteQueuedCopy({ online: false, syncStatus: 'pending' }),
    'تم طلب حذف الحصة، وستتم مزامنته عند توفر الاتصال.',
  );
  assert.equal(
    sessionDeleteQueuedCopy({ online: true, syncStatus: 'pending' }),
    'تم طلب حذف الحصة، وجارٍ مزامنة التغيير.',
  );
  assert.equal(
    sessionDeleteQueuedCopy({ online: true, syncStatus: 'auth_required' }),
    'تم طلب حذف الحصة وحُفظ التغيير على هذا الجهاز.',
  );
});
