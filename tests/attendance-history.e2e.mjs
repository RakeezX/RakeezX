import { test, expect } from '@playwright/test';
import { createAttendanceServer } from './helpers/attendance-server-fixture.mjs';

test.use({ ...(process.env.RAKEEZX_ATTENDANCE_TEST_URL ? { baseURL: process.env.RAKEEZX_ATTENDANCE_TEST_URL } : {}) });

const STORES = [
  'profile', 'years', 'terms', 'subjects', 'sections', 'teachings',
  'students', 'enrollments', 'slots', 'sessions', 'attendance', 'sessionRosterSnapshots',
];
const ATTENDANCE_ROUTE = '/#/teaching/override-teaching/attendance?session=override-session';

async function fetchCanonical(server, entity) {
  if (entity === 'slots') {
    return (await server.pg.query('select to_jsonb(t) as record from rakeezx.slots t')).rows.map((row) => row.record);
  }
  return server.fetchRecords(entity === 'sessionRosterSnapshots' ? 'session_roster_snapshots' : entity);
}

async function applyMutation(server, envelope) {
  return (await server.pg.query(
    'select rakeezx.apply_sync_v2_mutation($1,$2,$3,$4,$5,$6::jsonb,$7,$8) as result',
    [
      envelope.entity, envelope.recordId, envelope.mutationId, envelope.deviceId,
      envelope.baseRevision, JSON.stringify(envelope.patch ?? {}), envelope.operation,
      envelope.clientUpdatedAt ?? null,
    ],
  )).rows[0].result;
}

async function installEngine(page) {
  await page.waitForFunction(() => window.store?.state.ready);
  await page.evaluate(async () => {
    const database = await import('/src/lib/db.js');
    const { createSyncV2Engine } = await import('/src/lib/sync-v2.js');
    window.attendanceHistoryEngine = createSyncV2Engine({
      database,
      transport: {
        fetchRecords: (entity) => window.attendanceHistoryRpc({ method: 'fetchRecords', args: entity }),
        applyMutation: (args) => window.attendanceHistoryRpc({ method: 'applyMutation', args }),
        applyFillAttendanceCommand: (args) => window.attendanceHistoryRpc({ method: 'applyFillAttendanceCommand', args }),
        applyAttendanceCommand: (args) => window.attendanceHistoryRpc({ method: 'applyAttendanceCommand', args }),
      },
    });
  });
}

async function setupDevice(page, server) {
  await page.route('**/*.supabase.co/**', (route) => route.abort('blockedbyclient'));
  await page.exposeFunction('attendanceHistoryRpc', ({ method, args }) => {
    if (method === 'fetchRecords') return fetchCanonical(server, args);
    if (method === 'applyMutation') return applyMutation(server, args);
    return server[method](args);
  });
  const records = Object.fromEntries(await Promise.all(
    STORES.map(async (store) => [store, await fetchCanonical(server, store)]),
  ));
  await page.goto('/');
  await page.waitForFunction(() => window.store?.state.ready);
  await page.evaluate(async (canonical) => {
    const database = await import('/src/lib/db.js');
    const { decodeSyncV2Canonical } = await import('/src/lib/sync-v2.js');
    await window.store.save(Object.fromEntries(Object.entries(canonical).map(([store, rows]) => [
      store,
      rows.map((row) => decodeSyncV2Canonical(store, row)),
    ])), { queue: false });
    await window.store.patchDevice({ activeYearId: 'override-year', activeTermId: 'override-term' });
    await database.clearStore('outbox');
  }, records);
  await installEngine(page);
}

test('attendance remains historical after recurring slot edit and Sync V2 convergence', async ({ page, browser }) => {
  test.setTimeout(60_000);
  const server = await createAttendanceServer();
  const peerContext = await browser.newContext({ viewport: { width: 390, height: 850 } });
  const errors = [];
  const watchErrors = (target) => {
    target.on('pageerror', (error) => errors.push(error.message));
    target.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
  };
  watchErrors(page);

  try {
    await server.pg.exec(`
      insert into rakeezx.slots(id,teaching_id,weekday,period)
        values ('history-slot','override-teaching',0,1);
      update rakeezx.sessions set slot_id='history-slot' where id='override-session';
    `);
    await setupDevice(page, server);

    await page.goto('/#/schedule');
    const firstPeriodSlot = page.locator('.slot').filter({
      has: page.locator('.slot__period-num', { hasText: /^1$/ }),
    });
    await expect(firstPeriodSlot.locator('.slot__period-num')).toHaveText('1');
    await expect(firstPeriodSlot.locator('[data-act="edit"]')).toHaveAttribute('data-id', 'history-slot');

    await page.goto(ATTENDANCE_ROUTE);
    await expect(page.locator('.att-row')).toHaveCount(3);
    for (const [studentId, status] of [
      ['override-a', 'present'], ['override-b', 'absent'], ['override-c', 'excused'],
    ]) {
      await page.locator(`[data-act="set"][data-id="${studentId}"][data-status="${status}"]`).click();
    }
    const attendancePush = await page.evaluate(async () => {
      const result = await window.attendanceHistoryEngine.dispatchPending();
      await window.store.refreshSyncedState();
      return result;
    });
    expect(attendancePush).toMatchObject({ acknowledged: 3, failed: 0, blocked: 0 });

    const historical = await page.evaluate(async () => {
      const database = await import('/src/lib/db.js');
      const session = await database.get('sessions', 'override-session');
      const rows = (await database.getAll('attendance'))
        .filter((row) => row.sessionId === session.id && !row.deleted)
        .sort((left, right) => left.studentId.localeCompare(right.studentId));
      return {
        session: { id: session.id, date: session.date, period: session.period, slotId: session.slotId },
        attendance: rows.map(({ studentId, status, sessionId, teachingId, date }) => ({ studentId, status, sessionId, teachingId, date })),
      };
    });
    expect(historical.session).toEqual({ id: 'override-session', date: '2026-09-06', period: 1, slotId: 'history-slot' });
    expect(historical.attendance.map((row) => row.status)).toEqual(['present', 'absent', 'excused']);

    await page.reload();
    await installEngine(page);
    await expect(page.locator('[data-id="override-b"][data-status="absent"]')).toHaveClass(/is-on/);

    await page.goto('/#/schedule');
    await page.locator('[data-act="edit"][data-id="history-slot"]').click();
    await page.selectOption('select[name="weekday"]', '1');
    await page.selectOption('select[name="period"]', '4');
    await page.click('button[form="slot-form"]');
    await expect(page.locator('#toast')).toContainText('تم تعديل');
    const slotPush = await page.evaluate(async () => {
      const result = await window.attendanceHistoryEngine.dispatchPending();
      await window.store.refreshSyncedState();
      return result;
    });
    expect(slotPush).toMatchObject({ acknowledged: 1, failed: 0, blocked: 0 });

    expect(await page.evaluate(async (snapshot) => {
      const database = await import('/src/lib/db.js');
      const session = await database.get('sessions', snapshot.session.id);
      const attendance = (await database.getAll('attendance'))
        .filter((row) => row.sessionId === snapshot.session.id && !row.deleted)
        .sort((left, right) => left.studentId.localeCompare(right.studentId))
        .map(({ studentId, status, sessionId, teachingId, date }) => ({ studentId, status, sessionId, teachingId, date }));
      return { session: { id: session.id, date: session.date, period: session.period, slotId: session.slotId }, attendance };
    }, historical)).toEqual(historical);

    await page.goto('/#/teaching/override-teaching/reports');
    await page.locator('[data-act="tab"][data-tab="attendance"]').click();
    await expect(page.locator('.gtable--report')).toContainText('طالب اختبار أ');
    await expect(page.locator('.gtable--report')).toContainText('طالب اختبار ب');
    await expect(page.locator('.gtable--report')).toContainText('طالب اختبار ج');

    const peer = await peerContext.newPage();
    watchErrors(peer);
    await setupDevice(peer, server);
    await peer.goto(ATTENDANCE_ROUTE);
    await expect(peer.locator('.att-row')).toHaveCount(3);
    await expect(peer.locator('[data-id="override-b"][data-status="absent"]')).toHaveClass(/is-on/);
    const peerState = await peer.evaluate(async () => {
      const database = await import('/src/lib/db.js');
      const slot = await database.get('slots', 'history-slot');
      const session = await database.get('sessions', 'override-session');
      const rows = (await database.getAll('attendance')).filter((row) => row.sessionId === session.id && !row.deleted);
      return {
        slot: { id: slot.id, weekday: slot.weekday, period: slot.period },
        session: { id: session.id, date: session.date, period: session.period, slotId: session.slotId },
        attendanceCount: rows.length,
        uniqueStudents: new Set(rows.map((row) => row.studentId)).size,
      };
    });
    expect(peerState).toEqual({
      slot: { id: 'history-slot', weekday: 1, period: 4 },
      session: historical.session,
      attendanceCount: 3,
      uniqueStudents: 3,
    });
    await peer.goto('/#/teaching/override-teaching/sessions');
    await expect(peer.getByText('تم رصد الحضور', { exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    await peerContext.close();
    await server.close();
  }
});
