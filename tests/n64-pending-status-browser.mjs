import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createServer } from 'vite';
import { expect } from '@playwright/test';
import { bootSettings } from './helpers/settings-0397.mjs';
import { withIsolatedLocalBrowser } from '../../../scripts/ops-supervisor-v4/isolated-local-browser.mjs';
const taskId = 'continuous-n64-automatic-pending-status-20261018';
const runId = '6861a024-18c5-420c-8a43-3a7a3c198ff2';
const taskFile = `C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/${taskId}.json`;
const origin = 'http://127.0.0.1:21664';
const evidencePath = 'tests/n64-auto-pending-evidence.json';
let prior = []; try { prior = JSON.parse(await readFile(evidencePath, 'utf8')).preservedInitialFailures || []; } catch {}

const results = [];
const server = await createServer({ configFile: false, root: process.cwd(), server: { host: '127.0.0.1', port: 21664, strictPort: true, hmr: false } });
let failure;
try {
 await server.listen();
 await withIsolatedLocalBrowser({ taskFile, runId, url: origin, timeoutMs: 120000 }, async ({ createContext }) => {
  for (const width of [1280, 390]) {
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
    const before = { gets, authWrites, paints: __paints, sync: __syncSchedules };
    for (let i = 0; i < 20; i++) { window.dispatchEvent(new Event('focus')); document.dispatchEvent(new Event('visibilitychange')); }
    await new Promise(r => setTimeout(r, 300));
    const delta = { writes: authWrites - before.authWrites, paints: __paints - before.paints, sync: __syncSchedules - before.sync };
    if (gets !== before.gets) throw Error('Unmounted return listeners issued an Auth read');
    settings.onMount(); return delta;
   });
   await page.waitForTimeout(400);
   await page.evaluate(() => { gets = 0; });
   const pending = page.locator('[data-email-change-pending]');
   const completed = page.locator('[data-email-change-completed]');
   const busy = page.locator('[data-email-change-checking]');
   const url = page.url();
   await expect(page.locator('[data-email-change-check]')).toHaveCount(0);
   await expect(page.getByRole('button', { name: 'تحقق من التغيير' })).toHaveCount(0);
   await expect(pending).toContainText('حدّث الصفحة');
   // The original mount made a fresh read even though the prior mount cached this context.
   await page.evaluate(() => { gets = 0; settings.onMount(); });
   await expect.poll(() => page.evaluate(() => gets)).toBe(1);
   await expect(busy).toHaveCount(0);
   // First provider confirmation remains pending in this same document.
   await page.evaluate(() => window.dispatchEvent(new Event('focus')));
   await expect.poll(() => page.evaluate(() => gets)).toBe(2);
   await expect(busy).toHaveCount(0);
   await expect(pending).toBeVisible(); await expect(completed).toHaveCount(0);
   const cooldown = await page.evaluate(async () => {
    const before = { gets, authWrites, paints: __paints, sync: __syncSchedules };
    for (let i = 0; i < 20; i++) { window.dispatchEvent(new Event('focus')); document.dispatchEvent(new Event('visibilitychange')); }
    await new Promise(r => setTimeout(r, 300));
    return { gets: gets - before.gets, writes: authWrites - before.authWrites, paints: __paints - before.paints, sync: __syncSchedules - before.sync };
   });
   assert.equal(cooldown.gets, 0);
   assert.deepEqual({ writes: cooldown.writes, paints: cooldown.paints, sync: cooldown.sync }, eventBaseline);
   await mkdir('tests/fixtures/n64-auto-pending', { recursive: true });
   assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
   await page.locator('.settings-email-field').evaluate(el => el.scrollIntoView({ block: 'center' }));
   await page.locator('.settings-email-field').screenshot({ path: `tests/fixtures/n64-auto-pending/pending-${width}.png` });
   // Failure on a later return is neutral; ordinary error retry joins just one read.
   await page.evaluate(() => { window.realNow = Date.now; window.clockOffset = 31000; Date.now = () => realNow() + clockOffset; mode = 'fail'; window.dispatchEvent(new Event('focus')); });
   await expect(page.locator('.settings-email-field')).toContainText('تعذر التحقق من البريد');
   await expect(pending).toBeVisible(); await expect(completed).toHaveCount(0); await expect(busy).toHaveCount(0);
   const retry = page.locator('[data-act="retry-email-verification"]');
   const beforeBurst = await page.evaluate(() => { mode = 'hold'; return gets; });
   await retry.click();
   await expect(retry).toBeDisabled();
   await expect(retry).toHaveAttribute('aria-busy', 'true');
   await expect(busy).toBeVisible();
   await page.evaluate(() => { for (let i = 0; i < 20; i++) { window.dispatchEvent(new Event('focus')); document.dispatchEvent(new Event('visibilitychange')); settings.actions['retry-email-verification'](); } });
   assert.equal(await page.evaluate(() => gets), beforeBurst + 1);
   await page.evaluate(() => { mode = 'pending'; releaseRead(); });
   await expect(retry).toHaveCount(0); await expect(busy).toHaveCount(0);
   // Both confirmations completed: fresh server email AND cleared pending are required.
   await page.evaluate(() => { clockOffset += 31000; serverUser = { ...serverUser, email: 'pending@example.test', new_email: 'pending@example.test' }; window.dispatchEvent(new Event('focus')); });
   await expect(page.locator('[data-account-email]')).toHaveText('pending@example.test');
   await expect(completed).toHaveCount(0); await expect(pending).toBeVisible();
   await page.evaluate(() => { clockOffset += 31000; serverUser.new_email = ''; document.dispatchEvent(new Event('visibilitychange')); });
   await expect(completed).toBeVisible(); await expect(pending).toHaveCount(0);
   assert.equal(page.url(), url); assert.equal(await page.evaluate(() => Boolean(documentMarker)), true);
   await page.locator('.settings-email-field').evaluate(el => el.scrollIntoView({ block: 'center' }));
   await page.locator('.settings-email-field').screenshot({ path: `tests/fixtures/n64-auto-pending/completed-${width}.png` });
   assert.equal(await page.evaluate(async () => { const s = await import('/src/store.js'); return s.getActiveWorkspace().type === 'account' && s.getActiveWorkspace().authUserId === cloud.user.id; }), true);
   // Real send handler shows automatic guidance, retaining Close.
   await page.locator('[data-act="change-email"]').click();
   await page.locator('[name="newEmail"]').fill('next@example.test');
   await page.locator('button[form="email-change-form"]').click();
   await expect(page.locator('[data-email-change-sending]')).toContainText('لتحديث الحالة تلقائيًا');
   await expect(page.locator('button[form="email-change-form"]')).toHaveCount(0);
   await expect(page.locator('.sheet__foot [data-sheet-close]')).toBeFocused();
   await page.locator('.sheet__foot [data-sheet-close]').click();
   // Wrong-owner server result never completes; no guard is disabled.
   await page.evaluate(() => { mode = 'wrong-owner'; clockOffset += 31000; window.dispatchEvent(new Event('focus')); });
   await expect(page.locator('.settings-email-field')).toContainText('تعذر التحقق من البريد');
   await expect(completed).toHaveCount(0);
   await expect(page.locator('[data-account-email]')).toHaveText('pending@example.test');
   // In-flight owner switch uses the actual cloud context/persisted-owner guard.
   await page.evaluate(() => { mode = 'hold'; }); await retry.click(); await expect(retry).toBeDisabled();
   await page.evaluate(() => {
    const next = { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', email: 'other@example.test' };
    cloud.setMockAuth(next, { ...cloud.session, user: next });
    localStorage.setItem(cloud.AUTH_STORAGE_KEY, JSON.stringify(cloud.session));
    releaseRead({ ...serverUser, email: 'next@example.test', new_email: '' });
   });
   await page.waitForTimeout(150);
   assert.equal(await page.evaluate(() => cloud.user.email), 'other@example.test');
   await expect(completed).toHaveCount(0);
   assert.equal(await page.evaluate(() => { const n = gets; for (let i = 0; i < 10; i++) window.dispatchEvent(new Event('focus')); settings.actions['retry-email-verification'](); return gets - n; }), 0);
   assert.equal(await page.evaluate(() => { const n = gets; cloud.setMockAuth(null, null); settings.actions['retry-email-verification'](); window.dispatchEvent(new Event('focus')); settings.onUnmount(); document.dispatchEvent(new Event('visibilitychange')); return gets - n; }), 0);
   // Restore synthetic owner with stale persisted pending; actual reload must read the server.
   const reloadUser = await page.evaluate(() => {
    const u = { ...serverUser, email: 'pending@example.test', new_email: 'next@example.test' };
    localStorage.setItem(cloud.AUTH_STORAGE_KEY, JSON.stringify({ access_token: 'account-profile-test-token', refresh_token: 'account-profile-test-refresh', expires_at: 4102444800, user: u }));
    return { ...u, email: 'next@example.test', new_email: '' };
   });
   let reloadReads = 0;
   await page.route('**/auth/v1/user', route => { reloadReads++; return route.fulfill({ json: reloadUser }); });
   await page.reload();
   await expect(page.locator('[data-account-email]')).toHaveText('next@example.test');
   // Boot may refresh identity before settings captures the request; current email is authoritative.
   await expect(pending).toHaveCount(0);
   await expect(page.locator('[data-email-change-check]')).toHaveCount(0);
   assert.ok(reloadReads >= 1);
   assert.equal(await page.evaluate(async () => { const c = await import('/src/lib/cloud.js'), s = await import('/src/store.js'); return s.getActiveWorkspace().authUserId === c.user.id && c.user.email === 'next@example.test'; }), true);
   assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
   await page.locator('.settings-email-field').evaluate(el => el.scrollIntoView({ block: 'center' }));
   await page.locator('.settings-email-field').screenshot({ path: `tests/fixtures/n64-auto-pending/reloaded-${width}.png` });
   assert.deepEqual(boot.errors, []);
   results.push({ width, freshMountDespiteCache: true, originalDocumentAutomaticCompletion: true, firstConfirmationPending: true, pendingMustBeCleared: true, failureNeutralAndRetry: true, inFlightJoin: true, cooldown, unchangedAppEventBaseline: eventBaseline, wrongOwnerRejected: true, ownerSwitchRejected: true, noSessionAndUnmountCleanup: true, actualReloadRecovery: true, reloadReads, responsiveNoOverflow: true, realAccountStoreEntry: true });
   await context.close();
  }
 });
} catch (error) { failure = error; prior.push(error.stack); }
finally { await server.close(); }
const hashes = {};
for (const file of ['src/views/settings.js', 'src/lib/cloud.js', 'sw.js']) hashes[file] = createHash('sha256').update(await readFile(file)).digest('hex');
const cloudCRLF = createHash('sha256').update((await readFile('src/lib/cloud.js', 'utf8')).replace(/\r?\n/g, '\r\n')).digest('hex');
assert.equal(cloudCRLF, '992bf9d6d26cdb49b582088275f4df7e5d7df99715ebebeedd2b28744948d08f');
await writeFile(evidencePath, JSON.stringify({ taskId, runId, status: failure ? 'FAIL' : 'PASS', results, sourceSha256: hashes, reusedCloudCRLFSha256: cloudCRLF, preservedInitialFailures: prior, reusedEvidence: 'tests/n64-bounded-verification-evidence.json: unchanged cloud owner/deadline/dedup/late-response/refresh implementation; no live certification.', scope: 'Actual application DOM/handlers/source CSS over isolated loopback with fabricated provider. Existing helper incomplete Sync fixtures retained, no whole-Sync claim.', ownedBrowserAndServerClosed: true }, null, 2) + '\n');
if (failure) throw failure;
console.log(JSON.stringify(results));
