import { test, expect } from '@playwright/test';
import { createAttendanceServer } from './helpers/attendance-server-fixture.mjs';
import { SYNC_V2_SCHEMAS } from '../src/lib/sync-v2.js';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const OWNER = '11111111-1111-4111-8111-111111111111';
const baseline = process.env.RAKEEZX_READ_BASELINE === '1';
const hash = '#/teaching/override-teaching/attendance?session=override-session';
test.use({ serviceWorkers: 'block', timezoneId: 'Asia/Riyadh' });

for (const { rosterSize, observation } of [{ rosterSize: 33, observation: '19:25' },
  { rosterSize: 37, observation: '09:33' }, { rosterSize: 30, observation: '19:25' }]) {
test(`two real browser clients (${rosterSize}, ${observation}): writer ACK, capped receiver, Home/Attendance, reload and lifecycle`, async ({ browser }, testInfo) => {
  test.setTimeout(120_000);
  const server = await createAttendanceServer();
  const contexts = [];
  const requests = [], evidence = [], errors = [], external = [];
  let cap = rosterSize === 37 ? 73 : 10, failLater = false;
  try {
    // Synthetic roster members; SQL times preserve the known label defect.
    await server.pg.exec(`update rakeezx.sessions set date='2026-10-01', start_time='07:31:00',end_time='08:01:00' where id='override-session';
      insert into rakeezx.slots(id,teaching_id,weekday,period) values('synthetic-slot','override-teaching',1,2);`);
    for (let i = 0; i < rosterSize - 3; i++) {
      await server.pg.query(`insert into rakeezx.students(id,name,status) values($1,$2,'active')`, [`student-${i}`, `Synthetic ${i}`]);
      await server.pg.query(`insert into rakeezx.enrollments(id,student_id,section_id,roll_no,status,start_date)
        values($1,$2,'override-section',$3,'active','2026-08-01')`, [`en-${i}`, `student-${i}`, i + 4]);
    }
    // Distinct historical dates share the same capped owner attendance table.
    // Target-session completeness is produced only by the writer's real controls.
    if (rosterSize === 37) {
      for (let i = 0; i < 33; i++) {
        const date = new Date(Date.UTC(2026, 7, 20 + i)).toISOString().slice(0, 10);
        await server.pg.query(`insert into rakeezx.sessions(id,teaching_id,date,period,status,start_time,end_time)
          values($1,'override-teaching',$2,3,'scheduled','07:15:00','08:01:00.250000')`, [`history-${i}`, date]);
        await server.pg.query(`insert into rakeezx.attendance(id,session_id,student_id,teaching_id,date,status)
          select $1 || ':' || id,$1,id,'override-teaching',$2,'present' from rakeezx.students`, [`history-${i}`, date]);
      }
    }
    const initial = Object.fromEntries(await Promise.all(Object.entries(SYNC_V2_SCHEMAS).map(async ([store, schema]) =>
      [store, await server.fetchRecords(schema.entity)])));
    async function device(label, viewport) {
      const context = await browser.newContext({ viewport, serviceWorkers: 'block', timezoneId: 'Asia/Riyadh' });
      contexts.push(context);
      await context.addInitScript(() => {
        window.syntheticOnline = false;
        Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => window.syntheticOnline });
        Object.defineProperty(navigator, 'locks', { configurable: true, value: undefined });
      });
      await context.route('**/*', async route => {
        const url = new URL(route.request().url());
        if (url.hostname === '127.0.0.1') return route.continue();
        if (url.hostname !== 'xlrubcwjqktzzunrvuns.supabase.co' || !url.pathname.startsWith('/rest/v1/')) {
          external.push(url.hostname); return route.abort('blockedbyclient');
        }
        const entity = url.pathname.split('/').at(-1);
        if (url.pathname.includes('/rpc/')) {
          const body = route.request().postDataJSON() ?? {};
          if (entity === 'score_foundation_capability' || entity === 'owner_sync_change_marker') {
            return route.fulfill({ status: 404, json: { code: 'PGRST202', message: 'Synthetic advisory/capability unavailable' } });
          }
          let result;
          if (entity === 'apply_sync_v2_attendance_command') result = await server.applyAttendanceCommand({
            mutationId: body.p_mutation_id, deviceId: body.p_device_id, attendanceId: body.p_attendance_id,
            sessionId: body.p_session_id, studentId: body.p_student_id, baseRevision: body.p_base_revision,
            patch: body.p_patch, clientUpdatedAt: body.p_client_updated_at });
          else if (entity === 'apply_sync_v2_fill_attendance_command') result = await server.applyFillAttendanceCommand({
            mutationId: body.p_mutation_id, deviceId: body.p_device_id, sessionId: body.p_session_id,
            status: body.p_status, clientUpdatedAt: body.p_client_updated_at });
          else throw new Error(`Unexpected synthetic RPC ${entity}`);
          return route.fulfill({ json: result });
        }
        expect(url.searchParams.get('owner_id')).toBe(`eq.${OWNER}`);
        const offset = Number(url.searchParams.get('offset') ?? 0);
        const limit = Number(url.searchParams.get('limit') ?? 500);
        requests.push({ label, entity, offset });
        if (failLater && label === 'reader' && entity === 'attendance' && offset > 0) {
          return route.fulfill({ status: 503, json: { message: 'Synthetic later-page failure' } });
        }
        const rows = (await server.fetchRecords(entity)).sort((a, b) => String(a.id ?? a.owner_id).localeCompare(String(b.id ?? b.owner_id)));
        const page = rows.slice(offset, offset + Math.min(limit, entity === 'attendance' ? cap : 500));
        return route.fulfill({ json: page, headers: { 'Access-Control-Expose-Headers': 'Content-Range',
          'Content-Range': page.length ? `${offset}-${offset + page.length - 1}/${rows.length}` : `*/${rows.length}` } });
      });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      await page.clock.install({ time: new Date(`2026-10-01T${observation}:00+03:00`) });
      await page.goto('/');
      await page.waitForFunction(() => window.__syncModule && window.store?.state.ready);
      await expect(page.locator('.page--home')).toBeVisible();
      await page.evaluate(async records => {
        const db = await import('/src/lib/db.js');
        const { decodeSyncV2Canonical } = await import('/src/lib/sync-v2.js');
        await window.store.save(Object.fromEntries(Object.entries(records).map(([store, rows]) =>
          [store, rows.map(row => decodeSyncV2Canonical(store, row))])), { queue: false });
        await window.store.patchDevice({ activeYearId: 'override-year', activeTermId: 'override-term' }, { queue: false });
        await db.clearStore('outbox');
      }, { ...initial, attendance: label === 'reader' ? initial.attendance.slice(0, 7) : initial.attendance });
      await authenticate(page);
      return page;
    }
    async function authenticate(page) {
      await page.evaluate(async owner => {
        const cloud = await import('/src/lib/cloud.js');
        cloud.setMockAuth({ id: owner }, { access_token: 'synthetic-only', expires_at: Date.now() / 1000 + 3600 });
      }, OWNER);
    }
    async function sync(page) {
      const began = performance.now(), before = requests.length;
      const outcome = await page.evaluate(async () => {
        window.syntheticOnline = true;
        const result = await window.__syncModule.syncAll({ full: true });
        const summary = await window.__syncModule.getSyncOperationalSummary();
        window.syntheticOnline = false;
        return { result, summary };
      });
      evidence.push({ stage: 'sync-http-observation', localMockElapsedMs: Math.round(performance.now() - began),
        requests: requests.length - before, result: outcome.result, summary: outcome.summary });
      return outcome;
    }
    async function counts(page, stage) {
      const data = await page.evaluate(async () => {
        const db = await import('/src/lib/db.js');
        const all = await db.getAll('attendance');
        const persisted = all.filter(r => r.sessionId === 'override-session' && !r.deleted);
        const inMemory = window.store.attendanceIn('override-session');
        const derived = window.store.attendanceCompleteness(window.store.getSession('override-session'));
        return { persisted: persisted.length, inMemory: inMemory.length, recorded: derived.recorded,
          expected: derived.expected, state: derived.state, ids: persisted.map(r => r.id).sort(),
          memoryIds: inMemory.map(r => r.id).sort(), totalPersisted: all.length, allIds: all.map(r => r.id).sort() };
      });
      expect(data.persisted).toBe(data.inMemory); expect(data.persisted).toBe(data.recorded);
      expect(data.ids).toEqual(data.memoryIds); evidence.push({ stage, ...data });
      return data;
    }
    async function attendance(page) {
      await page.evaluate(hash => { location.hash = hash; }, hash);
      await expect(page.locator('.att-row')).toHaveCount(rosterSize);
    }
    async function home(page, count) {
      await page.evaluate(() => { location.hash = '#/'; });
      await expect(page.locator('.home-session-row[data-session-id="override-session"]')).toContainText(`${count}/${rosterSize}`);
    }
    const writer = await device('writer', { width: 1280, height: 900 });
    const reader = await device('reader', { width: 390, height: 850 });
    await attendance(writer);
    await writer.locator('[data-act="set"][data-id="override-a"][data-status="present"]').click();
    expect((await sync(writer)).result).toBe(true);
    expect((await sync(reader)).result).toBe(true);
    expect((await counts(reader, 'partial')).recorded).toBe(1);
    const originalDevice = await reader.evaluate(() => window.store.state.device.deviceId);
    await attendance(reader);
    await expect(reader.locator('.att-pill')).toContainText(`1 من ${rosterSize}`);
    await expect(reader.getByRole('status', { name: 'حالة الرصد: غير مكتمل' })).toBeVisible();
    await reader.evaluate(() => { location.hash = '#/'; });
    await expect(reader.locator('.today-focus')).toHaveAttribute('data-session-id', 'override-session');
    await expect(reader.locator('.today-focus')).toContainText('رصد حضور معلّق');
    await expect(reader.locator('.today-focus')).not.toContainText('قادمة');
    expect((await counts(reader, 'ended-partial-label')).state).toBe('pending');
    await writer.locator('[data-act="fill-present"]').click();
    await expect(writer.locator('.att-pill')).toContainText(`${rosterSize} من ${rosterSize}`);
    await writer.locator('[data-act="set"][data-id="override-c"][data-status="absent"]').click();
    expect((await sync(writer)).result).toBe(true);
    const canonical = (await server.fetchRecords('attendance')).filter(row => row.session_id === 'override-session');
    expect(canonical).toHaveLength(rosterSize);
    expect(server.calls.length).toBe(3); // record + fill + explicit change
    expect((await sync(reader)).summary.state).toBe('synced');
    const received = baseline ? 10 : rosterSize;
    const recovered = await counts(reader, 'capped-complete');
    expect(recovered.recorded).toBe(received);
    expect(recovered.state).toBe('completed');
    expect(recovered.ids).toEqual(canonical.map(row => row.id).sort());
    expect(recovered.allIds).toEqual((await server.fetchRecords('attendance')).map(row => row.id).sort());
    expect(await reader.evaluate(() => window.store.state.device.deviceId)).toBe(originalDevice);
    expect(await reader.evaluate(async () => (await (await import('/src/lib/db.js')).getAll('outbox')).length)).toBe(0);
    await attendance(reader);
    await expect(reader.locator('.att-pill')).toContainText(`${received} من ${rosterSize}`);
    await home(reader, received);
    await expect(reader.locator('.home-session-row[data-session-id="override-session"]')).toContainText('تم رصد الحضور');
    if (baseline) await expect(reader.locator('.home-session-state')).toContainText('قادمة');
    expect((await sync(reader)).result).toBe(true);
    expect((await counts(reader, 'repeated')).recorded).toBe(received);
    await reader.reload();
    await reader.waitForFunction(() => window.__syncModule && window.store?.state.ready);
    await authenticate(reader);
    await home(reader, received);
    await attendance(reader);
    await expect(reader.locator('.att-pill')).toContainText(`${received} من ${rosterSize}`);
    expect((await counts(reader, 'reload')).recorded).toBe(received);
    for (const event of ['pageshow', 'visibilitychange', 'online']) {
      // Resume triggers a full pull only after the existing five-minute stale threshold.
      await reader.clock.fastForward(5 * 60 * 1000 + 1);
      const before = requests.filter(r => r.label === 'reader' && r.entity === 'attendance').length;
      await reader.evaluate(event => {
        window.syntheticOnline = true;
        if (event === 'visibilitychange') document.dispatchEvent(new Event(event));
        else window.dispatchEvent(new Event(event));
      }, event);
      await expect.poll(() => requests.filter(r => r.label === 'reader' && r.entity === 'attendance').length).toBeGreaterThan(before);
      await expect.poll(() => reader.evaluate(async () => (await window.__syncModule.getSyncOperationalSummary()).state)).toBe('synced');
      await reader.evaluate(() => { window.syntheticOnline = false; });
      expect((await counts(reader, event)).recorded).toBe(received);
    }
    cap = 500;
    expect((await sync(reader)).result).toBe(true);
    expect((await counts(reader, 'uncapped')).recorded).toBe(rosterSize);
    await home(reader, rosterSize);
    // A synthetic non-teaching exception hides Home sessions without deleting history.
    await reader.evaluate(async () => {
      await window.store.save({ calendars: [{ id: 'synthetic-calendar', yearId: 'override-year', source: 'custom' }],
        calendarDays: [{ id: 'synthetic-exception', calendarId: 'synthetic-calendar', date: '2026-10-01', kind: 'suspension', label: 'Synthetic exception' }] }, { queue: false });
    });
    await expect(reader.locator('.home-session-row')).toHaveCount(0);
    expect((await counts(reader, 'calendar-exception')).recorded).toBe(rosterSize);
    await attendance(reader);
    await expect(reader.locator('.att-pill')).toContainText(`${rosterSize} من ${rosterSize}`);
    if (!baseline) {
      cap = 10; failLater = true;
      const before = await reader.evaluate(() => window.store.state.device.lastSyncAt);
      const failed = await sync(reader);
      expect(failed.result).toBe(false); expect(failed.summary.state).toBe('error');
      expect(failed.summary.cloudSyncHealthy).toBe(false);
      expect(await reader.evaluate(() => window.store.state.device.lastSyncAt)).toBe(before);
      expect((await counts(reader, 'later-page-failure')).recorded).toBe(rosterSize);
      failLater = false;
      expect((await sync(reader)).summary.state).toBe('synced');
    }
    expect(errors).toEqual([]); expect(external).toEqual([]);
    const output = new URL(`../test-results/evidence/ATTENDANCE-INCIDENT-INTEGRATION-0456.3/ui-${rosterSize}.json`, import.meta.url);
    await mkdir(new URL('../test-results/evidence/ATTENDANCE-INCIDENT-INTEGRATION-0456.3/', import.meta.url), { recursive: true });
    await writeFile(output, JSON.stringify({ baseline, rosterSize, observation, httpMetadata: 'mocked PostgREST exact count/range',
      canonicalTableRows: (await server.fetchRecords('attendance')).length, migrations: server.migrations, evidence, requests }, null, 2));
    await testInfo.attach('synthetic-count-evidence', { path: fileURLToPath(output), contentType: 'application/json' });
  } finally { for (const context of contexts) await context.close(); await server.close(); }
});
}
