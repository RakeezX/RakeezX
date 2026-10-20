import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createServer } from 'vite';
import { expect } from '@playwright/test';
import { bootSettings } from '../helpers/settings-0397.mjs';
import { SUPABASE_URL } from '../../src/lib/cloud.js';
import { withIsolatedLocalBrowser } from '../../../../scripts/ops-supervisor-v4/isolated-local-browser.mjs';

const taskId = 'continuous-n64-expired-request-neutral-settings-20261020';
const runId = '0b5a8eae-c3fe-442b-814a-797d2687dfb8';
const origin = 'http://127.0.0.1:19965';
const owner = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const results = [];
const server = await createServer({ configFile: false, root: process.cwd(), server: { host: '127.0.0.1', port: 19965, strictPort: true, hmr: false } });
try {
  await server.listen();
  await withIsolatedLocalBrowser({ taskFile: `C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/${taskId}.json`, runId, url: origin, timeoutMs: 60000 }, async ({ createContext }) => {
    const context = await createContext({ viewport: { width: 390, height: 900 }, locale: 'ar-SA' });
    const page = await context.newPage();
    const goto = page.goto.bind(page);
    page.goto = (url, options) => goto(new URL(url, origin).href, options);
    const mutations = [], errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (request.url().includes('/auth/v1/') && request.method() !== 'GET') mutations.push(request.method()); });
    await bootSettings(page, { pending: true });
    let response = { id: owner, email: 'teacher@example.test', new_email: 'pending@example.test', email_change_sent_at: new Date(Date.now() - 901000).toISOString() };
    await page.route(`${SUPABASE_URL}/auth/v1/user`, route => route.fulfill({ json: response }));
    await page.reload();
    await expect(page.locator('[data-settings-profile]')).toBeVisible();
    await expect.poll(async () => page.evaluate(async () => (await import('/src/lib/cloud.js')).user.email_change_sent_at)).toBe(response.email_change_sent_at);
    // Assert against rendered actual settings, including profile attention and all hints.
    await expect(page.locator('[data-account-email]')).toHaveText('teacher@example.test');
    await expect(page.locator('[data-act="change-email"]')).toBeVisible();
    await expect(page.locator('[data-email-change-pending], [data-email-change-expired], [data-email-change-completed], [data-email-change-instructions], [data-email-change-unknown]')).toHaveCount(0);
    assert.ok(!(await page.locator('.settings-page').innerText()).includes('انتهت مهلة تأكيد الطلب'));
    assert.ok(!(await page.locator('.settings-page').innerText()).includes('تغيير البريد قيد التأكيد'));
    const checkpoint = await page.evaluate(async () => {
      const cloud = await import('/src/lib/cloud.js'), store = await import('/src/store.js');
      return { owner: cloud.user.id, workspaceOwner: store.getActiveWorkspace().authUserId, pending: cloud.user.new_email, email: cloud.user.email };
    });
    assert.deepEqual(checkpoint, { owner, workspaceOwner: owner, pending: 'pending@example.test', email: 'teacher@example.test' });
    assert.equal(await page.locator('.settings-email-line').evaluate(el => getComputedStyle(el).display), 'flex');
    await page.locator('[data-account-email]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'tests/n64-neutral-expired-20261020/neutral.png' });
    results.push({ expiredNeutral: true, currentEmailAndChangeAction: true, noReplacementReminder: true, providerMetadataPreserved: true, actualOwnerStoreAndSourceCSS: true });
    response = { ...response, email_change_sent_at: new Date().toISOString() };
    await page.evaluate(async () => (await import('/src/views/settings.js')).default.onMount());
    await expect(page.locator('[data-email-change-pending]')).toBeVisible();
    await expect(page.locator('[data-email-change-instructions]')).toHaveCount(1);
    await expect(page.locator('[data-email-change-completed]')).toHaveCount(0);
    results.push({ nonexpiredPendingInstructionsPreserved: true });
    response = { id: owner, email: 'pending@example.test' };
    await page.evaluate(async () => (await import('/src/views/settings.js')).default.onMount());
    await expect(page.locator('[data-email-change-completed]')).toHaveText('تم اعتماد البريد الإلكتروني الجديد.');
    await expect(page.locator('[data-account-email]')).toHaveText('pending@example.test');
    await expect(page.locator('[data-email-change-pending]')).toHaveCount(0);
    assert.deepEqual(mutations, []);
    assert.deepEqual(errors, []);
    results.push({ verifiedSuccessPreserved: true, authMutations: mutations, pageErrors: errors });
    await context.close();
  });
} finally { await server.close(); }
const sourceSha256 = createHash('sha256').update(await readFile('src/views/settings.js')).digest('hex');
await writeFile('tests/n64-neutral-expired-20261020/result.json', JSON.stringify({ taskId, runId, sourceSha256, results, reusedEvidence: 'tests/n64-expiry-20261020/result.json; unchanged time/owner/request/failure logic', ownedBrowserAndServerClosed: true, liveJourney: 'NOT_RUN' }, null, 2) + '\n');
console.log(JSON.stringify(results));
