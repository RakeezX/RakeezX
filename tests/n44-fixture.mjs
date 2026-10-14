/** Disposable local identities/DBs only. No service credentials or live transport. */
import * as m from '../src/models.js';
export const owner = 'a4400000-0000-4000-8000-000000000001';
export const otherOwner = 'b4400000-0000-4000-8000-000000000002';
export const fixedNow = new Date('2026-10-14T09:45:00+03:00').getTime();
export function fixture(ownerId = owner) {
  const own = row => ({ ...row, ownerId, serverRevision: 1 });
  const year = own(m.makeYear({ id:'n44-year' }));
  const term = own(m.makeTerm({ id:'n44-term', yearId:year.id, startDate:'2026-10-01', endDate:'2026-11-01' }));
  return {
    profile:[own(m.makeProfile({ teacherName:'Synthetic N44' }))],
    device:[m.makeDevice({ schemaVersion:8, deviceId:'n44-device', activeYearId:'n44-old-year', activeTermId:'n44-old-term',
      accountProvisioningReceipt:{ ownerId, contractVersion:1, foundationHash:'n44-synthetic-foundation' } })],
    years:[year, own(m.makeYear({ id:'n44-old-year', status:'archived', hijriStart:1447 }))],
    terms:[term, own(m.makeTerm({ id:'n44-old-term', yearId:'n44-old-year', status:'closed', startDate:'2025-10-01', endDate:'2025-11-01' }))],
    subjects:[own(m.makeSubject({ id:'n44-subject', name:'<img src=x onerror=alert(1)> رياضيات' }))],
    sections:[own(m.makeSection({ id:'n44-section', yearId:year.id, grade:5, label:'أ' }))],
    teachings:[own(m.makeTeaching({ id:'n44-teaching', termId:term.id, sectionId:'n44-section', subjectId:'n44-subject' })),
      own(m.makeTeaching({ id:'n44-historical', termId:'n44-old-term', sectionId:'n44-section', subjectId:'n44-subject' })),
      { ...m.makeTeaching({ id:'n44-foreign', termId:term.id, sectionId:'n44-section', subjectId:'n44-subject' }), ownerId:otherOwner }],
    sessions:[own(m.makeSession({ id:'n44-session', teachingId:'n44-teaching', date:'2026-10-14', startTime:'10:00', endTime:'10:45' })),
      own(m.makeSession({ id:'n44-past', teachingId:'n44-teaching', date:'2026-10-14', startTime:'08:00', endTime:'08:45', period:2 })),
      own(m.makeSession({ id:'n44-cancelled', teachingId:'n44-teaching', date:'2026-10-14', startTime:'10:00', endTime:'10:45', status:'cancelled', period:3 })),
      own(m.makeSession({ id:'n44-history-session', teachingId:'n44-historical', date:'2026-10-14', startTime:'10:00', endTime:'10:45' })),
      own(m.makeSession({ id:'n44-foreign-session', teachingId:'n44-foreign', date:'2026-10-14', startTime:'10:00', endTime:'10:45' }))],
    items:[own(m.makeItem({ id:'n44-item', teachingId:'n44-teaching', name:'واجب', scoreMode:'subitems', max:10 }))],
    scoreSubitems:[own(m.makeScoreSubitem({ id:'n44-due', itemId:'n44-item', name:'<script>alert(2)</script> نشاط', value:2, dueDate:'2026-10-14' })),
      own(m.makeScoreSubitem({ id:'n44-soon', itemId:'n44-item', name:'قريب', value:2, dueDate:'2026-10-16' })),
      own(m.makeScoreSubitem({ id:'n44-not-started', itemId:'n44-item', value:2, startDate:'2026-10-15', dueDate:'2026-10-16' })),
      own(m.makeScoreSubitem({ id:'n44-too-far', itemId:'n44-item', value:2, dueDate:'2026-10-17' })),
      own(m.makeScoreSubitem({ id:'n44-overdue', itemId:'n44-item', value:2, dueDate:'2026-10-13' }))],
    calendars:[own(m.makeCalendar({ id:'n44-old-calendar', yearId:'n44-old-year', source:'custom' }))],
    calendarDays:[own({ id:'n44-old-holiday', calendarId:'n44-old-calendar', date:'2026-10-14', kind:'holiday' })],
  };
}
export async function prepareAccount(ownerId = owner) {
  const store = await import('../src/store.js'), db = await import('../src/lib/db.js'), cloud = await import('../src/lib/cloud.js');
  const { createWorkspaceRegistry, resolveWorkspace } = await import('../src/lib/workspaces.js');
  store.deactivateWorkspace();
  const session = { access_token:'synthetic-local-only-n44', expires_at:4102444800, user:{ id:ownerId } };
  localStorage.setItem(cloud.AUTH_STORAGE_KEY, JSON.stringify(session));
  cloud.setMockAuth(session.user, session);
  const registry = createWorkspaceRegistry();
  let workspace;
  try {
    await registry.registerProvisionedAccount(ownerId, { ownerId, contractVersion:1, foundationHash:'n44-synthetic-foundation' });
    workspace = (await resolveWorkspace({ type:'account', authUserId:ownerId }, { registry })).workspace;
  } finally { await registry.close(); }
  store.activateWorkspace(workspace);
  for (const [name, rows] of Object.entries(fixture(ownerId))) await db.putMany(name, rows);
  await store.init();
  return { owner:workspace.authUserId, database:workspace.databaseName, receipt:store.state.device.accountProvisioningReceipt, ready:store.state.ready };
}
