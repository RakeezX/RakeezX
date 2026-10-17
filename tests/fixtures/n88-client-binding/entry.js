// AI: synthetic composition of actual app modules; no replacement UI or CSS.
import { mountTeacherService, mountStudentService, teacherBinding } from '/src/lib/student-portal-runtime.js';
import { createSyncOwnershipGuard } from '/src/lib/sync-ownership.js';
const root = document.getElementById('pilot');
const readiness = { enabled: true, serviceRevision: 'n88-existing-host-v1' };
if (location.pathname.startsWith('/off')) {
  window.portal = location.pathname.endsWith('teacher') ? mountTeacherService(root) : mountStudentService(root);
} else if (location.pathname === '/teacher') {
  const context = await (await fetch('/fixture/context')).json();
  let listeners = new Set();
  const cloud = { user: { id: context.ownerId }, session: { access_token: context.token }, authStatus: () => ({state: 'authenticated'}) };
  const workspace = { id: 'synthetic-account', type: 'account', authUserId: context.ownerId, ownershipState: 'claimed', syncEligible: true, databaseName: 'synthetic-only' };
  let writable = true;
  const actualGuard = createSyncOwnershipGuard({ workspace });
  const guard = { ...actualGuard, bindNewCommand(command) { if (!writable) throw Error('synthetic lease denied'); return actualGuard.bindNewCommand(command); } };
  const store = { getActiveWorkspace: () => workspace, activeEnrollment: () => ({ id: context.enrollmentId, revision: context.revision, status: 'active' }) };
  window.switchOwner = () => { cloud.user = { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' }; listeners.forEach(fn => fn()); };
  window.expireLease = () => { writable = false; };
  window.portal = mountTeacherService(root, { readiness, getBinding: write => teacherBinding({ cloud, store, studentId: 'student', guard }, write), subscribe: fn => { listeners.add(fn); return () => listeners.delete(fn); } });
} else {
  window.portal = mountStudentService(root, { readiness });
}
