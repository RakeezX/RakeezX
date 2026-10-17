import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createServer } from 'vite';
import { expect } from '@playwright/test';
import { bootSettings } from './helpers/settings-0397.mjs';
import { withIsolatedLocalBrowser } from '../../../scripts/ops-supervisor-v4/isolated-local-browser.mjs';
const taskId = 'continuous-n64-pending-server-status-check-20261017';
const runId = '43666eba-56cf-4f83-8da3-57af4b39f015';
const taskFile = `C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/${taskId}.json`;
const origin = 'http://127.0.0.1:20664';
const evidencePath = 'tests/n64-pending-status-evidence.json';
let prior = []; try { prior = JSON.parse(await readFile(evidencePath, 'utf8')).preservedInitialFailures || []; } catch {}
if (!prior.length) prior.push('Initial evidence writer compared LF checkout bytes with prior CRLF evidence hash and failed after browser phase; fixed explicit line-ending normalization, retained exact Git blob identity f88450d7109f8bdfc6d500f108edb7d7616e6bc9.');
const results = [];
const server = await createServer({ configFile: false, root: process.cwd(), server: { host: '127.0.0.1', port: 20664, strictPort: true, hmr: false } });
let failure;
try {
 await server.listen();
 await withIsolatedLocalBrowser({ taskFile, runId, url: origin, timeoutMs: 120000 }, async ({ createContext }) => {
  for (const width of [1280, 320]) {
   const context = await createContext({ viewport: { width, height: 900 }, locale: 'ar-SA' });
   const page = await context.newPage();
   const goto = page.goto.bind(page); page.goto = (url, options) => goto(new URL(url, origin).href, options);
   for (const [file, needle, counter] of [
    ['src/app.js', 'function paint() {', '__paints'],
    ['src/lib/sync.js', 'function scheduleAutomaticSync({ full = false, immediate = false, remote = false } = {}) {', '__syncSchedules'],
   ]) {
    const source = await readFile(file, 'utf8'); assert.ok(source.includes(needle));
    await page.route(`**/${file}`, route => route.fulfill({ contentType: 'text/javascript', body: source.replace(needle, `${needle} window.${counter} = (window.${counter} || 0) + 1;`) }));
   }
   const boot = await bootSettings(page, { pending: true });
   await page.waitForTimeout(800);
   await page.evaluate(async () => {
    window.cloud = await import('/src/lib/cloud.js'); window.settings = (await import('/src/views/settings.js')).default;
    window.originalFetch = fetch; window.gets = 0; window.puts = 0; window.mode = 'pending';
    window.serverUser = { ...cloud.user }; window.documentMarker = {};
    window.authWrites = 0; const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function(k, v) { if (k === cloud.AUTH_STORAGE_KEY) authWrites++; return set.call(this, k, v); };
    window.fetch = async (url, options) => {
     if (!String(url).endsWith('/auth/v1/user')) return originalFetch(url, options);
     if (options?.method === 'PUT') { puts++; serverUser = { ...cloud.user, new_email: JSON.parse(options.body).email }; return Response.json(serverUser); }
     gets++;
     if (mode === 'fail') throw new TypeError('Synthetic network failure');
     if (mode === 'hold') return new Promise(resolve => { window.releaseRead = payload => resolve(Response.json(payload || serverUser)); });
     if (mode === 'wrong-owner') return Response.json({ ...serverUser, id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' });
     return Response.json(serverUser);
    };
   });
   // Compare the unchanged application's own visibility/Sync listeners; never disable them.
   const eventBaseline = await page.evaluate(async () => {
    settings.onUnmount();
    await new Promise(r => setTimeout(r, 300));
    const before = { authWrites, paints: __paints, sync: __syncSchedules };
    for (let i = 0; i < 20; i++) { window.dispatchEvent(new Event('focus')); document.dispatchEvent(new Event('visibilitychange')); }
    await new Promise(r => setTimeout(r, 300));
    const delta = { writes: authWrites - before.authWrites, paints: __paints - before.paints, sync: __syncSchedules - before.sync };
    settings.onMount(); return delta;
   });
   await page.waitForTimeout(400);
   await page.evaluate(() => { gets = 0; });
   const check = page.locator('[data-email-change-check]');
   await expect(check).toHaveText('تحقق من التغيير');
   await expect(check).toHaveAttribute('type', 'button');
   const url = page.url();
   // Manual bypasses the successful mount cache in the ORIGINAL document.
   await check.click(); await expect(check).toBeEnabled();
   assert.equal(await page.evaluate(() => gets), 1);
   await expect(page.locator('[data-email-change-pending]')).toBeVisible();
   await expect(page.locator('[data-email-change-completed]')).toHaveCount(0);
   await mkdir('tests/fixtures/n64-pending-status', { recursive: true });
   await page.screenshot({ path: `tests/fixtures/n64-pending-status/pending-${width}.png` });
   // A successful pending send retains a real sheet and Close.
   await page.locator('[data-act="change-email"]').click();
   await page.locator('[name="newEmail"]').fill('next@example.test');
   await page.locator('button[form="email-change-form"]').click();
   await expect(page.locator('[data-email-change-sending]')).toContainText('بعد تأكيد الرسالتين، ارجع إلى هذه النافذة للتحقق من التغيير.');
   await expect(page.getByRole('dialog')).toBeVisible();
   await expect(page.locator('button[form="email-change-form"]')).toHaveCount(0);
   await expect(page.locator('.sheet__foot [data-sheet-close]')).toBeFocused();
   await mkdir('tests/fixtures/n64-pending-status', { recursive: true });
   await page.screenshot({ path: `tests/fixtures/n64-pending-status/dialog-${width}.png` });
   await page.locator('.sheet__foot [data-sheet-close]').click();
   await expect(page.getByRole('dialog')).toHaveCount(0);
   // Network failure is neutral, immediate manual retry is not subject to event cooldown.
   await page.evaluate(() => { mode = 'fail'; });
   await check.click(); await expect(check).toBeEnabled();
   await expect(page.locator('.settings-email-field')).toContainText('تعذر التحقق من البريد');
   await expect(page.locator('[data-email-change-completed]')).toHaveCount(0);
   await page.evaluate(() => { mode = 'pending'; });
   await page.locator('[data-act="retry-email-verification"]').filter({ hasText: 'إعادة المحاولة' }).click();
   await expect(page.locator('.settings-email-field')).not.toContainText('تعذر التحقق من البريد');
   // Burst joins an existing read. Disabled button and no synthetic click fanout.
   const beforeBurst = await page.evaluate(() => { mode = 'hold'; return gets; });
   await check.click(); await expect(check).toBeDisabled(); await expect(check).toHaveAttribute('aria-busy', 'true');
   await page.evaluate(() => {
    for (let i = 0; i < 20; i++) { window.dispatchEvent(new Event('focus')); document.dispatchEvent(new Event('visibilitychange')); settings.actions['retry-email-verification'](); }
   });
   assert.equal(await page.evaluate(() => gets), beforeBurst + 1);
   await page.evaluate(() => { mode = 'pending'; releaseRead(); }); await expect(check).toBeEnabled();
   // First return still pending; second event burst within cooldown has zero effects.
   await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
   await expect(check).toBeEnabled(); await page.waitForTimeout(150);
   await expect(page.locator('[data-email-change-pending]')).toBeVisible();
   const cooldown = await page.evaluate(async () => {
    const before = { gets, authWrites, paints: __paints, sync: __syncSchedules };
    for (let i = 0; i < 20; i++) { window.dispatchEvent(new Event('focus')); document.dispatchEvent(new Event('visibilitychange')); }
    await new Promise(r => setTimeout(r, 150));
    return { gets: gets - before.gets, writes: authWrites - before.authWrites, paints: __paints - before.paints, sync: __syncSchedules - before.sync };
   });
   assert.equal(cooldown.gets, 0);
   assert.deepEqual({ writes: cooldown.writes, paints: cooldown.paints, sync: cooldown.sync }, eventBaseline, 'Settings adds no write/paint/Sync fanout over existing visibility listeners');
   // Advance only the event clock; actual server read after both confirmations.
   await page.evaluate(() => {
    window.realNow = Date.now; Date.now = () => realNow() + 31000;
    serverUser = { ...serverUser, email: 'next@example.test', new_email: '' };
    window.dispatchEvent(new Event('focus'));
   });
   await expect(page.locator('[data-email-change-completed]')).toBeVisible();
   await expect(page.locator('[data-account-email]')).toHaveText('next@example.test');
   await expect(check).toHaveCount(0); await expect(page.locator('[data-email-change-pending]')).toHaveCount(0);
   assert.equal(page.url(), url); assert.equal(await page.evaluate(() => Boolean(documentMarker)), true);
   // Visible controls stay usable; change-email validates against Auth rather than stale contract.
   await page.locator('[data-act="change-email"]').click();
   await page.locator('[name="newEmail"]').fill('next@example.test');
   await page.locator('button[form="email-change-form"]').click();
   await expect(page.locator('[data-email-change-error]')).toContainText('مختلفًا');
   await page.locator('[name="newEmail"]').fill('third@example.test');
   await page.locator('button[form="email-change-form"]').click();
   await expect(page.locator('[data-email-change-sending]')).toContainText('بعد تأكيد الرسالتين');
   await page.locator('.sheet__foot [data-sheet-close]').click();
   // Manual completion without any focus/reopen.
   await page.evaluate(() => { serverUser = { ...serverUser, email: 'third@example.test', new_email: '' }; });
   await check.click();
   await expect(page.locator('[data-account-email]')).toHaveText('third@example.test');
   await expect(page.locator('[data-email-change-completed]')).toBeVisible();
   assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
   await page.screenshot({ path: `tests/fixtures/n64-pending-status/completed-${width}.png` });
   assert.equal(await page.evaluate(async () => { const s = await import('/src/store.js'); return s.getActiveWorkspace().type === 'account' && s.getActiveWorkspace().authUserId === cloud.user.id; }), true);
   // Unmounted listeners produce no read. Reopen recovers pending from Auth.
   await page.evaluate(() => { settings.onUnmount(); serverUser = { ...serverUser, new_email: 'fourth@example.test' }; cloud.setMockAuth(serverUser, { ...cloud.session, user: serverUser }); localStorage.setItem(cloud.AUTH_STORAGE_KEY, JSON.stringify(cloud.session)); });
   const unmounted = await page.evaluate(() => { const n = gets; window.dispatchEvent(new Event('focus')); document.dispatchEvent(new Event('visibilitychange')); return gets - n; });
   assert.equal(unmounted, 0);
   await page.evaluate(async () => { (await import('/src/repaint.js')).repaint(); settings.onMount(); });
   await expect(check).toBeVisible(); await expect(check).toBeEnabled();
   await page.evaluate(() => { mode = 'wrong-owner'; });
   await check.click(); await expect(check).toBeEnabled();
   await expect(page.locator('[data-email-change-completed]')).toHaveCount(0);
   await expect(page.locator('[data-account-email]')).toHaveText('third@example.test');
   // In-flight owner switch: real cloud guard rejects the old result.
   await page.evaluate(() => { mode = 'hold'; }); await check.click();
   await page.evaluate(() => {
    const next = { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', email: 'other@example.test' };
    cloud.setMockAuth(next, { ...cloud.session, user: next });
    localStorage.setItem(cloud.AUTH_STORAGE_KEY, JSON.stringify(cloud.session));
    releaseRead({ ...serverUser, email: 'fourth@example.test', new_email: '' });
   });
   await page.waitForTimeout(150);
   assert.equal(await page.evaluate(() => cloud.user.email), 'other@example.test');
   await expect(page.locator('[data-email-change-completed]')).toHaveCount(0);
   const switched = await page.evaluate(() => { const n = gets; for (let i = 0; i < 10; i++) window.dispatchEvent(new Event('focus')); settings.actions['retry-email-verification'](); return gets - n; }); assert.equal(switched, 0);
   assert.equal(await page.evaluate(() => { const n = gets; cloud.setMockAuth(null, null); settings.actions['retry-email-verification'](); window.dispatchEvent(new Event('focus')); settings.onUnmount(); return gets - n; }), 0);
   assert.deepEqual(boot.errors, []);
   results.push({ width, originalDocumentManualAndFocusCompletion: true, pendingFirstConfirmation: true, dialogCloseGuidance: true, failureImmediateRetry: true, inFlightJoin: true, cooldown, unchangedAppEventBaseline: eventBaseline, ownerSwitchRejected: true, wrongOwnerRejected: true, noSessionNeutral: true, unmountCleanupAndReopenPending: true, responsiveNoOverflow: true, realAccountStoreEntry: true });
   await context.close();
  }
 });
} catch (error) { failure = error; prior.push(error.stack); }
finally { await server.close(); }
const hashes = {};
for (const file of ['src/views/settings.js', 'src/lib/cloud.js', 'sw.js']) hashes[file] = createHash('sha256').update(await readFile(file)).digest('hex');
const cloudCRLF = createHash('sha256').update((await readFile('src/lib/cloud.js', 'utf8')).replace(/\r?\n/g, '\r\n')).digest('hex');
assert.equal(cloudCRLF, '992bf9d6d26cdb49b582088275f4df7e5d7df99715ebebeedd2b28744948d08f', 'Unchanged cloud deadline/dedup/owner implementation');
await writeFile(evidencePath, JSON.stringify({ taskId, runId, status: failure ? 'FAIL' : 'PASS', results, sourceSha256: hashes, reusedCloudCRLFSha256: cloudCRLF, preservedInitialFailures: prior, reusedEvidence: 'tests/n64-bounded-verification-evidence.json: exact unchanged cloud.js SHA; existing 12s deadline/late response and refresh checks. No live certification.', scope: 'Actual application DOM/handlers/CSS; canonical isolated loopback synthetic Auth; external requests and Service Workers blocked. Existing helper Sync fixture limitations retained; unchanged-event scheduling measured, no whole-Sync claim.', ownedBrowserAndServerClosed: true }, null, 2) + '\n');
if (failure) throw failure;
console.log(JSON.stringify(results));
