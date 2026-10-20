import assert from 'node:assert/strict';
import { writeFile, readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createServer } from 'vite';
import { expect } from '@playwright/test';
import { bootSettings } from '../helpers/settings-0397.mjs';
import { SUPABASE_URL } from '../../src/lib/cloud.js';
import { withIsolatedLocalBrowser } from '../../../../scripts/ops-supervisor-v4/isolated-local-browser.mjs';

const taskId = 'continuous-n64-abandoned-pending-expiry-20261020';
const runId = 'e1881199-ce7a-427a-b749-51bb3149ba9d';
const baseline = process.argv.includes('--baseline');
const origin = 'http://127.0.0.1:19964';
const now = Date.parse('2026-10-20T09:00:00Z');
const owner = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const oldEmail = 'teacher@example.test', target = 'pending@example.test';
const user = (age = 900001) => ({ id: owner, email: oldEmail, new_email: target, email_change_sent_at: new Date(now - age).toISOString() });
const results = [];
const server = await createServer({ configFile: false, root: process.cwd(), plugins: baseline ? [{ name: 'record-unchanged-baseline', enforce: 'pre', load(id) {
  if (id.replaceAll('\\', '/').endsWith('/src/views/settings.js')) return execFileSync('git', ['show', '7a68241d47c4501b224ac237a36e9d44c4a377ea:src/views/settings.js'], { encoding: 'utf8' });
} }] : [], server: { host: '127.0.0.1', port: 19964, strictPort: true, hmr: false } });
try {
  await server.listen();
  await withIsolatedLocalBrowser({ taskFile: `C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/${taskId}.json`, runId, url: origin, timeoutMs: 120000 }, async ({ createContext }) => {
    const context = await createContext({ viewport: { width: 390, height: 900 }, locale: 'ar-SA' });
    const page = await context.newPage();
    const missingResources = [];
    page.on('response', res => { if (res.status() === 404) missingResources.push(res.url()); });
    const goto = page.goto.bind(page);
    page.goto = (url, options) => goto(new URL(url, origin).href, options);
    await page.clock.install({ time: now });
    const boot = await bootSettings(page, { pending: true });
    let response = user(), failure = false, puts = 0, reads = 0;
    await page.route(`${SUPABASE_URL}/auth/v1/user`, async route => {
      if (route.request().method() === 'PUT') {
        puts++;
        const email = route.request().postDataJSON().email;
        // Deliberately omit new_email: exercise the existing view-local accepted target.
        response = { id: owner, email: oldEmail, new_email: '', email_change_sent_at: new Date(now).toISOString() };
        assert.equal(email, 'fresh@example.test');
      } else reads++;
      await route.fulfill(failure ? { status: 500, json: { message: 'synthetic verification unavailable' } } : { json: response });
    });
    const settle = async () => { for (let i = 0; i < 6; i++) { await new Promise(resolve => setTimeout(resolve, 40)); await page.clock.runFor(32); } };
    const noSuccess = () => expect(page.locator('[data-email-change-completed]')).toHaveCount(0);
    const noPending = () => expect(page.locator('[data-email-change-pending]')).toHaveCount(0);
    const checkpoint = async () => page.evaluate(async () => {
      const cloud = await import('/src/lib/cloud.js'), store = await import('/src/store.js');
      if (cloud.user?.id !== store.getActiveWorkspace()?.authUserId) throw Error('Actual account/store owner mismatch');
      return { email: cloud.user.email, pending: cloud.user.new_email, owner: cloud.user.id, workspaceType: store.getActiveWorkspace().type };
    });
    const refresh = async () => {
      await page.reload();
      await expect(page.locator('[data-settings-profile]')).toBeVisible();
      await expect.poll(() => reads).toBeGreaterThan(0);
      await expect.poll(async () => (await checkpoint()).pending).toBe(response.new_email);
    };
    await refresh();
    if (baseline) {
      await expect(page.locator('[data-email-change-pending]')).toBeVisible();
      await noSuccess();
      results.push({ reproduced: 'Expired provider request still displayed pending after actual reload', ageMs: 900001, checkpoint: await checkpoint() });
    } else {
      await expect(page.locator('[data-email-change-expired]')).toBeVisible();
      await noPending(); await noSuccess();
      assert.deepEqual(await checkpoint(), { email: oldEmail, pending: target, owner, workspaceType: 'account' });
      assert.equal(await page.locator('.settings-email-line').evaluate(el => getComputedStyle(el).display), 'flex', 'Actual application source CSS');
      results.push({ expiredReload: true, providerMetadataPreserved: true, originalEmailPreserved: true, actualOwnerStoreEntry: true, sourceCSS: true });
      await page.screenshot({ path: 'tests/n64-expiry-20261020/expired.png', fullPage: true });

      // Just before and exactly at 900 seconds; owned expiry timer updates without a request.
      await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
      const frozen = await page.evaluate(() => Date.now());
      response = { ...user(), email_change_sent_at: new Date(frozen - 899000).toISOString() };
      await page.evaluate(async () => (await import('/src/views/settings.js')).default.onMount());
      await expect.poll(async () => page.evaluate(async () => (await import('/src/lib/cloud.js')).user.email_change_sent_at)).toBe(response.email_change_sent_at);
      await page.clock.runFor(32);
      await expect(page.locator('[data-email-change-pending]')).toBeVisible();
      const boundaryReads = reads;
      await page.clock.runFor(967);
      await expect(page.locator('[data-email-change-pending]')).toBeVisible();
      await page.clock.runFor(1);
      await page.clock.runFor(32);
      await expect(page.locator('[data-email-change-expired]')).toBeVisible();
      await noPending(); await noSuccess();
      assert.equal(reads, boundaryReads, 'Expiry itself never renews or sends/reads Auth');
      results.push({ beforeBoundary: true, exactBoundary: true, expiryTimerNoAuth: true });

      // Return/focus must expire presentation even if background timers were suspended.
      await page.clock.setSystemTime(now + 2000);
      response = user(100); reads = 0;
      await page.evaluate(async () => (await import('/src/views/settings.js')).default.onMount());
      await page.clock.runFor(32);
      await expect(page.locator('[data-email-change-pending]')).toBeVisible();
      await page.clock.setSystemTime(now + 900000);
      await page.evaluate(() => dispatchEvent(new Event('focus')));
      await page.clock.runFor(32);
      await expect(page.locator('[data-email-change-expired]')).toBeVisible();
      await settle();
      await noSuccess();
      results.push({ returnAfterSuspendedTime: true });

      // A failed fresh identity read cannot imply success, even after expiry.
      failure = true;
      await page.evaluate(async () => (await import('/src/views/settings.js')).default.onMount());
      await settle();
      await expect(page.locator('[data-act="retry-email-verification"]')).toBeVisible();
      await noSuccess(); await noPending();
      await expect(page.locator('[data-account-email]')).toHaveText(oldEmail);
      failure = false;
      results.push({ failedReadNeutral: true });

      // Missing, invalid and future timestamps never fabricate a pending lifetime.
      for (const sentAt of [undefined, 'invalid', new Date(now + 5000000).toISOString()]) {
        response = { ...user(), email_change_sent_at: sentAt };
        await page.evaluate(async () => (await import('/src/views/settings.js')).default.onMount());
        await settle();
        await expect(page.locator('[data-email-change-unknown]')).toBeVisible();
        await noPending(); await noSuccess();
      }
      results.push({ unavailableTimestampNeutral: true, invalidAndFutureNeutral: true });

      // Fresh request through the actual dialog, real cloud owner guard and synthetic PUT.
      await page.clock.setSystemTime(now);
      await page.locator('[data-act="change-email"]').click();
      await page.locator('#email-change-form [name="newEmail"]').fill('fresh@example.test');
      await page.locator('button[form="email-change-form"]').click();
      await settle();
      await expect(page.locator('[data-email-change-accepted]')).toBeVisible();
      await page.locator('.sheet__foot [data-sheet-close]').click();
      await expect(page.locator('[data-email-change-pending]')).toBeVisible();
      assert.equal(puts, 1);
      await noSuccess();
      await expect(page.locator('[data-account-email]')).toHaveText(oldEmail);
      await page.clock.setSystemTime(now + 900000);
      await page.evaluate(() => dispatchEvent(new Event('focus')));
      await settle();
      await expect(page.locator('[data-email-change-expired]')).toBeVisible();
      await noPending(); await noSuccess();
      results.push({ freshRequest: true, actualDialogHandlerAndOwnerGuard: true, viewLocalPendingExpires: true, syntheticPuts: puts });

      // Real completion still requires matching fresh owner-verified identity, even after expiry.
      response = { id: owner, email: 'fresh@example.test' };
      await page.evaluate(async () => (await import('/src/views/settings.js')).default.onMount());
      await settle();
      await expect(page.locator('[data-email-change-completed]')).toBeVisible();
      await expect(page.locator('[data-account-email]')).toHaveText('fresh@example.test');
      await noPending();
      results.push({ actualVerifiedSuccessAfterExpiry: true });

      // Actual wrong-owner guard rejects a foreign provider response.
      response = { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', email: 'foreign@example.test' };
      await page.evaluate(async () => (await import('/src/views/settings.js')).default.onMount());
      await settle();
      await expect(page.locator('[data-act="retry-email-verification"]')).toBeVisible();
      assert.equal((await checkpoint()).email, 'fresh@example.test');
      assert.ok(!(await page.locator('.settings-page').innerText()).includes('foreign@example.test'));
      // Changing the rendered owner discards all previous presentation state.
      const switched = await page.evaluate(async () => {
        const cloud = await import('/src/lib/cloud.js');
        cloud.setMockAuth({ id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', email: 'other@example.test' }, { access_token: 'synthetic-other' });
        const view = (await import('/src/views/settings.js')).default;
        const html = String(view.render());
        view.onUnmount();
        cloud.setMockAuth(null, null);
        return html;
      });
      assert.ok(!switched.includes('data-email-change-completed') && !switched.includes('data-email-change-pending') && !switched.includes('data-email-change-expired'));
      results.push({ wrongOwnerReadRejected: true, ownerSwitchDiscardsState: true });
      assert.ok(missingResources.every(url => url === `${origin}/api/n44/push/config`), 'Only the unrelated local N44 config endpoint may be absent');
      assert.deepEqual(boot.errors.filter(e => !/status of (500|404) /.test(e)), []);
      results.push({ missingResources: [...new Set(missingResources)], syntheticExpected500: true });
    }
    await context.close();
  });
} finally { await server.close(); }
const sourceSha256 = createHash('sha256').update(await readFile('src/views/settings.js')).digest('hex');
await writeFile(`tests/n64-expiry-20261020/${baseline ? 'baseline-failure' : 'result'}.json`, JSON.stringify({ taskId, runId, mode: baseline ? 'original-failure-reproduction' : 'candidate', baseSha: '7a68241d47c4501b224ac237a36e9d44c4a377ea', sourceSha256: baseline ? null : sourceSha256, results, ownedBrowserAndServerClosed: true, liveJourney: 'NOT_RUN; synthetic HTTP application checks only' }, null, 2) + '\n');
console.log(JSON.stringify(results));
