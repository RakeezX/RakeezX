// AI: local fabricated account binding; actual account command/ownership guard.
import { mountTeacherService, teacherBinding } from '/src/lib/student-portal-runtime.js';
import { createSyncOwnershipGuard } from '/src/lib/sync-ownership.js';
const context = await (await fetch('/review/context', { cache: 'no-store' })).json();
const workspace = { id: 'synthetic-review', type: 'account', authUserId: context.ownerId,
  ownershipState: 'claimed', syncEligible: true, databaseName: 'synthetic-review-only' };
const cloud = { user: { id: context.ownerId }, session: { access_token: context.token }, authStatus: () => ({ state: 'authenticated' }) };
const store = { getActiveWorkspace: () => workspace, activeEnrollment: () => ({ id: context.enrollmentId, revision: context.revision, status: 'active' }) };
const guard = createSyncOwnershipGuard({ workspace });
mountTeacherService(document.getElementById('review-teacher'), {
  readiness: context.readiness, getBinding: write => teacherBinding({ cloud, store, studentId: 'student', guard }, write),
});
