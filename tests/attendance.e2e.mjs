import { test, expect } from '@playwright/test';
import { createAttendanceServer } from './helpers/attendance-server-fixture.mjs';

test.use({ baseURL: process.env.RAKEEZX_ATTENDANCE_TEST_URL ?? 'http://localhost:5173' });

const STORES = [
  'profile', 'years', 'terms', 'subjects', 'sections', 'teachings',
  'students', 'enrollments', 'sessions', 'attendance', 'sessionRosterSnapshots',
];
const ROUTE = '/#/teaching/override-teaching/attendance?session=override-session';

async function installEngine(page) {
  await page.waitForFunction(() => window.store?.state.ready);
  await page.evaluate(async () => {
    const database = await import('/src/lib/db.js');
    const { createSyncV2Engine } = await import('/src/lib/sync-v2.js');
    window.attendanceE2eEngine = createSyncV2Engine({
      database,
      transport: {
        fetchRecords: (entity) => window.attendanceE2eRpc({ method: 'fetchRecords', args: entity }),
        applyFillAttendanceCommand: (args) => window.attendanceE2eRpc({ method: 'applyFillAttendanceCommand', args }),
        applyAttendanceCommand: (args) => window.attendanceE2eRpc({ method: 'applyAttendanceCommand', args }),
      },
    });
  });
}

async function setupDevice(page, server) {
  // This test never reaches Supabase; all server work uses isolated PostgreSQL.
  // Keep the app's automatic coordinator offline so the explicit isolated V2
  // engine is the only dispatcher; page assets and the test RPC remain local.
  await page.addInitScript(() => Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false }));
  await page.route('**/*.supabase.co/**', (route) => route.abort('blockedbyclient'));
  await page.exposeFunction('attendanceE2eRpc', ({ method, args }) => server[method](args));
  const records = Object.fromEntries(await Promise.all(
    STORES.map(async (store) => [
      store,
      await server.fetchRecords(store === 'sessionRosterSnapshots' ? 'session_roster_snapshots' : store),
    ]),
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
  await page.goto(ROUTE);
  await expect(page.locator('.att-row')).toHaveCount(3);
}

async function expectStates(page, states) {
  for (const [studentId, status] of Object.entries(states)) {
    await expect(page.locator(`[data-act="set"][data-id="${studentId}"][data-status="${status}"]`)).toHaveClass(/is-on/);
  }
}

test('current Sync V2 attendance persists, acknowledges, and converges in both directions', async ({ page, browser }) => {
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
    await setupDevice(page, server);
    await page.locator('[data-act="set"][data-id="override-a"][data-status="present"]').click();
    await page.locator('[data-act="set"][data-id="override-b"][data-status="absent"]').click();
    await page.locator('[data-act="set"][data-id="override-c"][data-status="excused"]').click();
    const initial = { 'override-a': 'present', 'override-b': 'absent', 'override-c': 'excused' };
    await expectStates(page, initial);

    const queued = await page.evaluate(async () => {
      const database = await import('/src/lib/db.js');
      return (await database.getAll('outbox')).map(({ command, state }) => ({ command, state }));
    });
    expect(queued).toHaveLength(3);
    expect(queued.every((entry) => entry.command === 'attendance:record' && entry.state === 'pending')).toBe(true);

    const pushed = await page.evaluate(async () => {
      const result = await window.attendanceE2eEngine.dispatchPending();
      await window.store.refreshSyncedState();
      return result;
    });
    expect(pushed).toMatchObject({ acknowledged: 3, failed: 0, blocked: 0 });
    expect(await page.evaluate(async () => (await (await import('/src/lib/db.js')).getAll('outbox')).length)).toBe(0);

    await page.reload();
    await installEngine(page);
    await expectStates(page, initial);

    const peer = await peerContext.newPage();
    watchErrors(peer);
    await setupDevice(peer, server);
    await expectStates(peer, initial);

    // A later explicit action on the second client is authoritative and returns to the first.
    await peer.locator('[data-act="set"][data-id="override-c"][data-status="late"]').click();
    const reverse = await peer.evaluate(async () => {
      const result = await window.attendanceE2eEngine.dispatchPending();
      await window.store.refreshSyncedState();
      const database = await import('/src/lib/db.js');
      const pending = (await database.getAll('outbox')).map(({ command, state, lastError, blockedReason }) => ({
        command, state, lastError, blockedReason,
      }));
      return { result, pending };
    });
    expect(reverse.result, JSON.stringify(reverse.pending)).toMatchObject({ acknowledged: 1, failed: 0, blocked: 0 });
    await page.evaluate(async () => {
      await window.attendanceE2eEngine.pullAll({ stores: ['attendance', 'sessionRosterSnapshots'] });
      await window.store.refreshSyncedState();
    });
    const final = { 'override-a': 'present', 'override-b': 'absent', 'override-c': 'late' };
    await expectStates(page, final);
    await expectStates(peer, final);

    for (const target of [page, peer]) {
      const local = await target.evaluate(async () => {
        const database = await import('/src/lib/db.js');
        const rows = (await database.getAll('attendance'))
          .filter((row) => row.sessionId === 'override-session' && !row.deleted);
        return {
          count: rows.length,
          unique: new Set(rows.map((row) => `${row.sessionId}:${row.studentId}`)).size,
          statuses: rows.sort((left, right) => left.studentId.localeCompare(right.studentId)).map((row) => row.status),
        };
      });
      expect(local).toEqual({ count: 3, unique: 3, statuses: ['present', 'absent', 'late'] });
    }
    const remote = await server.fetchRecords('attendance');
    expect(remote).toHaveLength(3);
    expect(new Set(remote.map((row) => `${row.session_id}:${row.student_id}`)).size).toBe(3);
    expect(errors).toEqual([]);
  } finally {
    await peerContext.close();
    await server.close();
  }
});
