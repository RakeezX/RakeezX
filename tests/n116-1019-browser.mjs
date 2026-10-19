// AI-authored: actual application and account ownership guards, synthetic loopback only.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { withIsolatedLocalBrowser } from '../../../scripts/ops-supervisor-v4/isolated-local-browser.mjs';
import { openReadyServedDemo } from './helpers/served-demo-readiness.mjs';
import { fixture, owner, capability } from './n73-account-flow-fixture.mjs';
import * as m from '../src/models.js';

const taskId = 'continuous-n116-lesson-generation-on-demand-20261019';
const runId = 'df7d23e0-8d02-4090-af18-92974aac704f';
const root = resolve('.'), date = '2027-05-02', data = fixture();
const owned = row => ({ ...row, ownerId: owner, serverRevision: 1 });
data.terms[0] = owned(m.makeTerm({ id: 'n73-term', yearId: 'n73-year', startDate: '2027-05-01', endDate: '2027-05-10', status: 'active' }));
data.timeProfiles = [owned(m.makeTimeProfile({ id: 'tp:n116', periods: [1, 2, 3].map(period => ({ period, start: `0${period + 6}:00`, end: `0${period + 6}:45` })) }))];
data.profile[0].activeTimeProfileId = 'tp:n116';
data.calendars = [owned(m.makeCalendar({ id: 'cal:n116', yearId: 'n73-year', source: 'custom' }))];
data.slots = [1, 2, 3].map(period => owned(m.makeSlot({ teachingId: 'n73-source', weekday: 0, period })));
data.slots.push(owned(m.makeSlot({ teachingId: 'n73-target', weekday: 0, period: 1 })));
data.enrollments = data.students.map((s, i) => owned(m.makeEnrollment({ id: 'e:n116:' + i, studentId: s.id, sectionId: 'n73-source-section' })));
data.sessions = [owned(m.makeSession({ teachingId: 'n73-source', date: '2027-05-01', period: 1, status: 'held', startTime: '07:00', endTime: '07:45' }))];
data.attendance = [owned({ id: m.attendanceId(data.students[0].id, data.sessions[0].id), studentId: data.students[0].id, sessionId: data.sessions[0].id, teachingId: 'n73-source', date: '2027-05-01', status: 'present', deleted: false })];
const evidence = { taskId, runId, checks: [], errors: [] };
try { const prior = JSON.parse(await readFile('tests/n116-1019-browser.json', 'utf8')); evidence.previousFailures = [...(prior.previousFailures ?? []), ...(prior.failure ? [prior.failure] : [])]; } catch {}
const record = (name, detail) => evidence.checks.push({ name, status: 'PASS', evidence: detail });
const server = createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    if (pathname.startsWith('/__n73/')) {
      res.setHeader('Content-Type', 'application/json');
      const name = pathname.slice(7);
      if (name === 'fixture') return res.end(JSON.stringify(data));
      if (name === 'auth') return res.end(JSON.stringify({ id: owner, source: 'supabase-auth-user', verifiedAt: new Date('2027-05-02T04:10:00Z').getTime() }));
      if (name === 'capability') return res.end(JSON.stringify(capability));
      throw Error('Unexpected synthetic service request: ' + name);
    }
    const file = resolve(root, pathname === '/' ? 'index.html' : '.' + decodeURIComponent(pathname));
    if (!file.startsWith(root + sep)) throw Error('Outside root');
    res.setHeader('Content-Type', { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' }[extname(file)] ?? 'application/octet-stream');
    res.end(await readFile(file));
  } catch (e) { res.writeHead(404); res.end(e.message); }
});
const checkpoint = page => page.evaluate(async () => {
  const d = await import('/src/lib/db.js');
  return Object.fromEntries(await Promise.all(['sessions', 'attendance', 'scores', 'outbox'].map(async n => [n, await d.getAll(n)])));
});
try {
  await new Promise((done, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', done); });
  const url = 'http://127.0.0.1:' + server.address().port;
  await withIsolatedLocalBrowser({ taskFile: `C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/${taskId}.json`, runId, url, timeoutMs: 110000 }, async ({ createContext }) => {
    const context = await createContext({ viewport: { width: 1100, height: 900 }, locale: 'ar-SA', timezoneId: 'Asia/Riyadh' });
    await context.addInitScript(() => sessionStorage.setItem('rakeezx-demo-session-v1', 'preparing'));
    const page = await context.newPage(); page.setDefaultTimeout(8000);
    page.on('pageerror', e => evidence.errors.push(e.message));
    await page.clock.setFixedTime(new Date('2027-05-02T04:10:00Z'));
    await openReadyServedDemo(page, url);
    await page.evaluate(async () => {
      await (await import('/tests/n73-account-flow-fixture.mjs')).prepareAccount();
      const s = await import('/src/store.js'), d = await import('/src/lib/db.js');
      const owner = s.getActiveWorkspace().authUserId;
      const receipt = { ownerId: owner, contractVersion: 1, foundationHash: 'n116-synthetic' };
      s.state.device.accountProvisioningReceipt = receipt;
      await d.put('device', s.state.device);
      s.activateWorkspace({ ...s.getActiveWorkspace(), workspaceKind: 'account-provisioned', leaseGeneration: JSON.stringify([owner, null, null, receipt]) });
      await (await import('/src/lib/offline-lease.js')).runtimeOfflineLease().renew(async () => ({ id: owner, source: 'supabase-auth-user', verifiedAt: Date.now() }));
      s.assertClassOperationsAccess('n73-source');
    });
    const before = await checkpoint(page);
    await page.evaluate(() => location.hash = '#/');
    const card = page.locator('[data-session-id="se:n73-source:2027-05-02:1"]').first();
    await card.waitFor();
    assert.notEqual(await card.evaluate(e => getComputedStyle(e).display), 'none');
    assert.equal((await checkpoint(page)).sessions.length, 1, 'Home projects without writing');
    await page.evaluate(() => { dispatchEvent(new Event('pageshow')); document.dispatchEvent(new Event('visibilitychange')); });
    assert.equal((await checkpoint(page)).sessions.length, 1, 'Wake does not generate the day');
    record('read_only_cards_and_wake', 'Actual Home DOM/CSS shows unopened lessons; Home entry and wake persist no sessions.');

    // The card keeps N121 class navigation separate from exact-session attendance navigation.
    await card.locator('.home-lesson-class-link').click();
    await page.waitForFunction(() => location.hash.includes('/teaching/n73-source') && !location.hash.includes('attendance'));
    assert.equal((await checkpoint(page)).sessions.length, 1);
    await page.evaluate(() => location.hash = '#/');
    await page.locator('a[href="#/teaching/n73-source/attendance?session=se:n73-source:2027-05-02:2"]').first().click();
    await page.waitForFunction(async () => (await import('/src/store.js')).getSession('se:n73-source:2027-05-02:2'));
    await page.locator('[data-act="pick-session"][data-id="se:n73-source:2027-05-02:2"][aria-pressed="true"]').waitFor();
    let cp = await checkpoint(page);
    assert.equal(cp.sessions.length, 2);
    assert.equal(cp.sessions.some(s => s.id === 'se:n73-source:2027-05-02:1'), false);
    assert.equal(cp.sessions.some(s => s.teachingId === 'n73-target'), false);
    assert.equal(cp.outbox.length, 1);
    assert.equal(cp.outbox[0].ownerId, owner); assert.equal(cp.outbox[0].state, 'pending');
    const opened = cp.sessions.find(s => s.date === date);
    assert.equal(opened.projected, undefined);
    assert.equal(opened.startTime, '08:00');
    record('exact_card_entry', 'Class card opens class without creation; exact period-2 attendance link creates only period 2 with one owner-bound pending command, no fake ACK.');

    await page.locator('[data-act="pick-session"][data-id="se:n73-source:2027-05-02:1"]').click();
    await page.waitForFunction(async () => (await import('/src/store.js')).getSession('se:n73-source:2027-05-02:1'));
    await page.locator('[data-act="prev-day"]').click();
    await page.waitForFunction(() => document.querySelector('.datebar__label')?.textContent.includes('السبت'));
    assert.equal((await checkpoint(page)).sessions.length, 3);
    await page.locator('[data-act="next-day"]').click();
    await page.waitForFunction(() => document.querySelector('.datebar__label')?.textContent.includes('الأحد'));
    assert.equal((await checkpoint(page)).sessions.length, 3);
    record('session_and_date_handlers', 'Actual period switch creates only selected period; history date and return retain identities without backfill.');

    await page.evaluate(async () => (await import('/src/store.js')).setCalendarDay('cal:n116', '2027-05-02', 'holiday', 'Synthetic holiday/study'));
    await page.evaluate(() => location.hash = '#/teaching/n73-source/attendance?session=se:n73-source:2027-05-02:3');
    await page.locator('.empty__title').filter({ hasText: '\u0644\u0627 \u062a\u0648\u062c\u062f \u062d\u0635\u0629 \u0645\u062c\u062f\u0648\u0644\u0629 \u0644\u0647\u0630\u0627 \u0627\u0644\u064a\u0648\u0645' }).waitFor();
    assert.equal((await checkpoint(page)).sessions.length, 3, 'Stale exact link on holiday must not create');
    await page.evaluate(async () => (await import('/src/store.js')).setCalendarDay('cal:n116', '2027-05-02', 'study', 'Synthetic holiday/study'));
    // A genuine local persistence failure must leave no optimistic session/command.
    await page.evaluate(() => {
      const original = IDBDatabase.prototype.transaction;
      globalThis.__n116RestoreTransaction = () => IDBDatabase.prototype.transaction = original;
      IDBDatabase.prototype.transaction = function(names, mode, ...rest) {
        if (mode === 'readwrite' && Array.from(names).includes('sessions') && Array.from(names).includes('outbox')) {
          throw new Error('N116 synthetic persistence failure');
        }
        return original.call(this, names, mode, ...rest);
      };
      location.hash = '#/teaching/n73-target/attendance?session=se:n73-target:2027-05-02:1';
    });
    try { await page.locator('#toast').filter({ hasText: 'N116 synthetic persistence failure' }).waitFor(); }
    finally { await page.evaluate(() => globalThis.__n116RestoreTransaction()); }
    const failed = await checkpoint(page);
    assert.equal(failed.sessions.length, 3);
    assert.equal(failed.outbox.filter(r => r.store === 'sessions' && r.recordId.includes('n73-target')).length, 0);
    assert.equal(await page.evaluate(async () => (await import('/src/store.js')).getSession('se:n73-target:2027-05-02:1')), null);
    record('holiday_entry_and_failure', 'Actual attendance mount rejects stale holiday link; injected IndexedDB transaction failure is shown in toast and creates neither memory/durable session nor command.');

    const result = await page.evaluate(async () => {
      const s = await import('/src/store.js'), d = await import('/src/lib/db.js');
      const request = () => s.ensureSessionsForDate('2027-05-02', { teachingId: 'n73-source', period: 3 });
      await s.setCalendarDay('cal:n116', '2027-05-02', 'holiday', 'مصطنع');
      const holiday = await request();
      await s.setCalendarDay('cal:n116', '2027-05-02', 'study', 'مصطنع');
      await s.patch('timeProfiles', 'tp:n116', { periods: [1, 2, 3].map(period => ({ period, start: '10:00', end: '10:45' })) });
      const simultaneous = await Promise.all([request(), request(), request()]);
      const repeated = await request();
      const created = s.getSession('se:n73-source:2027-05-02:3');
      // Existing timing and history must remain frozen after calendar/timing edits.
      const old = s.getSession('se:n73-source:2027-05-02:2');
      return { holiday, simultaneous, repeated, created, old, outbox: await d.getAll('outbox') };
    });
    assert.equal(result.holiday.created, 0);
    assert.equal(result.created.startTime, '10:00'); assert.equal(result.old.startTime, '08:00');
    assert.equal(result.repeated.created, 0);
    assert.equal(result.outbox.filter(r => r.store === 'sessions' && r.recordId === result.created.id).length, 1);
    record('calendar_and_idempotency', 'Holiday-before-open creates none; reopening study day uses current timing; concurrent/repeated requests retain one durable session command and old timing.');

    const guards = await page.evaluate(async () => {
      const s = await import('/src/store.js'), d = await import('/src/lib/db.js'), c = await import('/src/lib/cloud.js');
      const request = () => s.ensureSessionsForDate('2027-05-02', { teachingId: 'n73-target', period: 1 });
      const rejected = [];
      const teaching = s.state.teachings.find(t => t.id === 'n73-target'), original = teaching.ownerId;
      teaching.ownerId = 'foreign'; try { await request(); } catch { rejected.push('foreign-parent'); } finally { teaching.ownerId = original; }
      const workspace = s.getActiveWorkspace();
      s.activateWorkspace({ ...workspace, ownershipState: 'unresolved' });
      try { await request(); } catch { rejected.push('unresolved-owner'); } finally { s.activateWorkspace(workspace); }
      const auth = c.user, session = c.session; c.setMockAuth({ id: 'foreign-auth' }, { ...session, user: { id: 'foreign-auth' } });
      try { await request(); } catch { rejected.push('foreign-auth'); } finally { c.setMockAuth(auth, session); }
      const lease = (await import('/src/lib/offline-lease.js')).runtimeOfflineLease();
      lease.invalidate('n116-synthetic-limited');
      try { await request(); } catch { rejected.push('limited-lease'); }
      await lease.renew(async () => ({ id: workspace.authUserId, source: 'supabase-auth-user', verifiedAt: Date.now() }));
      const controller = new AbortController(); controller.abort();
      await s.ensureSessionsForDate('2027-05-02', { teachingId: 'n73-target', period: 1, signal: controller.signal });
      // A tombstone arriving from another tab is present in the DB before this document sees it.
      const tombstone = { ...s.projectedSessionsForDate('2027-05-02').find(t => t.teachingId === 'n73-target'), deleted: true };
      delete tombstone.projected;
      await d.put('sessions', tombstone);
      const tombstoned = await request();
      return { rejected, tombstoned, outbox: await d.getAll('outbox'), target: s.getSession(tombstone.id), hold: s.CALENDAR_PRESET_SWITCH_TEMPORARY_HOLD };
    });
    assert.deepEqual(guards.rejected, ['foreign-parent', 'unresolved-owner', 'foreign-auth', 'limited-lease']);
    assert.equal(guards.tombstoned.created, 0); assert.equal(guards.tombstoned.skipped, 1); assert.equal(guards.target, null);
    assert.equal(guards.outbox.some(r => r.store === 'sessions' && r.recordId.includes('n73-target')), false);
    assert.equal(guards.hold, true);
    cp = await checkpoint(page);
    assert.deepEqual(cp.attendance, before.attendance); assert.deepEqual(cp.scores, before.scores);
    assert.deepEqual(cp.sessions.find(s => s.date === '2027-05-01'), before.sessions[0]);
    record('guards_tombstones_history', 'Real account/store guards reject foreign parent, unresolved owner and foreign Auth; pre-abort writes none; durable unseen tombstone is retained; attendance/grades/history unchanged; calendar switch hold active.');
    await page.evaluate(() => location.hash = '#/');
    await page.locator('.today-focus').waitFor();
    await mkdir('tests/fixtures/n116-1019', { recursive: true });
    await page.screenshot({ path: 'tests/fixtures/n116-1019/home.png' });
    assert.deepEqual(evidence.errors, []);
    record('n116_on_demand_session_generation_calendar_change_idempotent_history_safe', 'PASS: affected actual app HTTP DOM/handlers/CSS and owner-bound store scenarios; synthetic only, no hosted Sync certification.');
  });
} catch (error) { evidence.failure = error.stack; throw error; }
finally {
  server.closeAllConnections(); await new Promise(done => server.close(done));
  await writeFile('tests/n116-1019-browser.json', JSON.stringify(evidence, null, 2) + '\n');
}
console.log(JSON.stringify(evidence, null, 2));
