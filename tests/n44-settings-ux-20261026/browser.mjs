// AI: real served application, real account store/guards/handlers/CSS, synthetic runtime snapshots.
import assert from 'node:assert/strict';
import http from 'node:http';
import { expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import path from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import { withIsolatedLocalBrowser } from 'file:///C:/Users/Abody/Projects/RakeezX/scripts/ops-supervisor-v4/isolated-local-browser.mjs';
import { openReadyServedDemo } from '../helpers/served-demo-readiness.mjs';
const taskId = 'continuous-n44-user-settings-simplification-20261026';
const runId = '5bfa6d74-f0cf-4c82-b46e-549faef46dd1';
const root = process.cwd(), out = path.join(root, 'tests/n44-settings-ux-20261026');
const requests = [], checks = [], layouts = [];
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };
const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://127.0.0.1');
  if (u.pathname.startsWith('/api/')) { requests.push(u.pathname); res.writeHead(200, { 'content-type': 'application/json' }); return res.end('{"status":"disabled"}'); }
  const file = path.resolve(root, '.' + decodeURIComponent(u.pathname === '/' ? '/index.html' : u.pathname));
  if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
  try { const body = await readFile(file); res.writeHead(200, { 'content-type': mime[path.extname(file)] ?? 'application/octet-stream' }); res.end(body); } catch { res.writeHead(404).end(); }
});
const pass = (name, evidence) => { checks.push({ name, status: 'PASS', evidence }); console.log('PASS ' + name); };
async function fixture(page) {
  return page.evaluate(async () => {
    const f = await import('/tests/n44-fixture.mjs');
    await f.prepareAccount();
    const s = await import('/src/store.js'), c = await import('/src/lib/cloud.js');
    const context = (await import('/src/lib/notification-events.js')).currentNotificationContext(s, c);
    if (!context || context.ownerId !== f.owner || s.getActiveWorkspace()?.authUserId !== f.owner || s.state.device.accountProvisioningReceipt.ownerId !== f.owner) throw Error('Missing current-document owner checkpoint');
    const n = window.settingsFixture = { calls: { source: 0, verify: 0, disable: 0, optIn: 0, preferences: 0 } };
    n.push = { available: false, cleanupAvailable: false, cleanupBusy: false, status: 'unavailable', eligibility: { reason: 'configuration_disabled', configuration: 'disabled' }, configOutcome: { httpStatus: 200, phase: 'complete' } };
    const source = i => ({ ...context, parentId: 'synthetic-source-' + i, name: 'مصدر تجريبي ' + i, childIds: ['synthetic-child-' + i], teachingId: 'synthetic-teaching', termId: 'synthetic-term', yearId: 'synthetic-year', sectionId: 'synthetic-section', subjectId: 'synthetic-subject', deleted: i > 0, token: 'synthetic-token-' + i });
    n.ui = { canVerify: false, verifying: false, reminders: [{ id: 'synthetic-event', title: 'تذكير تجريبي', body: 'بند حالي', targetId: 'synthetic-child-0', itemId: 'synthetic-source-0', teachingId: 'synthetic-teaching', token: 'synthetic-reminder' }], sources: Array.from({ length: 31 }, (_, i) => source(i)) };
    n.runtime = { snapshot: () => n.push, normalUiSnapshot: () => n.ui,
      async readSourceStatus(token) { n.calls.source++; const r = n.ui.sources.find(r => r.token === token); n.ui.sourceStatus = { token, status: r.deleted ? 'cleanup_confirmed' : 'confirmed', canonical: { parent: { id: r.parentId, revision: 2 }, children: [{ id: r.childIds[0], revision: 2 }] }, ...(r.deleted ? { cleanupReceipt: { command: 'delete_item', outcome: 'deleted', mutationId: 'synthetic-receipt', targetId: r.parentId, deviceId: context.deviceId, clientUpdatedAt: 123 } } : {}) }; },
      async verifyReminder(token) { n.calls.verify++; n.ui.verification = { token, status: 'confirmed', authorization: { httpStatus: 200, authorizationStatus: 'authorized', attempts: 1 }, sourceStamp: 'synthetic-stamp', registrationId: 'synthetic-registration', canonicalAck: true, workerBindingMatches: true, subscriptionPresent: true, consentTrue: true }; },
      async disable() { n.calls.disable++; n.push.status = 'unsubscribed'; n.push.cleanupAvailable = false; return { status: 'revoked' }; },
      async optIn() { n.calls.optIn++; return { status: 'unavailable' }; },
      async preferencesChanged() { n.calls.preferences++; },
    };
    (await import('/src/lib/notification-push-runtime.js')).setPushRuntime(n.runtime);
    return { owner: context.ownerId, database: s.getActiveWorkspace().databaseName, receipt: s.state.device.accountProvisioningReceipt.ownerId };
  });
}
const repaint = page => page.evaluate(async () => (await import('/src/app.js')).repaint());
const calls = page => page.evaluate(() => ({ ...settingsFixture.calls }));
async function geometry(page, width, scheme, label = 'default') {
  await page.setViewportSize({ width, height: 900 });
  await page.evaluate(s => document.documentElement.setAttribute('data-theme', s), scheme);
  const data = await page.evaluate(() => {
    const root = document.querySelector('.n44-settings-page');
    const visible = el => el.checkVisibility();
    const bad = [...root.querySelectorAll('button,summary,a')].filter(visible).filter(el => { const r = el.getBoundingClientRect(); return r.width < 44 || r.height < 44 || r.left < -1 || r.right > innerWidth + 1; }).map(el => el.textContent);
    return { overflow: document.documentElement.scrollWidth > innerWidth + 1 || root.scrollWidth > root.clientWidth + 1, bad, direction: getComputedStyle(root).direction, text: getComputedStyle(root).color, background: getComputedStyle(document.querySelector('.n44-preference')).backgroundColor };
  });
  assert.equal(data.overflow, false, JSON.stringify(data)); assert.deepEqual(data.bad, []); assert.equal(data.direction, 'rtl');
  const accessibility = await new AxeBuilder({ page }).include('.n44-settings-page').withRules(['color-contrast', 'button-name', 'aria-valid-attr-value']).analyze();
  assert.deepEqual(accessibility.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) })), [], 'Affected contrast and control semantics');
  layouts.push({ width, scheme, label, ...data, contrastViolations: accessibility.violations.length });
  await page.screenshot({ path: path.join(out, `${label}-${scheme}-${width}.png`), fullPage: true });
}
try {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  await withIsolatedLocalBrowser({ taskFile: `C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/${taskId}.json`, runId, url: base, timeoutMs: 120000 }, async ({ createContext }) => {
    const context = await createContext({ viewport: { width: 390, height: 900 }, locale: 'ar-SA', timezoneId: 'Asia/Riyadh' });
    await context.addInitScript(() => sessionStorage.setItem('rakeezx-demo-session-v1', 'preparing'));
    const page = await context.newPage(); page.setDefaultTimeout(8000);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await openReadyServedDemo(page, base);
    const checkpoint = await fixture(page); assert.equal(checkpoint.owner, checkpoint.receipt); assert.ok(checkpoint.database);
    await page.evaluate(() => { location.hash = '#/settings/notifications'; });
    await page.locator('[data-n44-support]').waitFor();
    const support = page.locator('[data-n44-support]');
    assert.equal(await support.count(), 1); assert.equal(await support.evaluate(el => el.open), false);
    const text = await page.locator('.n44-settings').innerText();
    assert.ok(text.includes('الإشعارات') && text.includes('تذكيرات الحصص') && text.includes('تذكيرات تسليم البنود'));
    for (const secret of [checkpoint.owner, checkpoint.database, 'synthetic-source-', 'HTTP', 'هوية الحساب']) assert.ok(!text.includes(secret), secret);
    assert.equal(await page.locator('[data-act="notification-push"]').count(), 0);
    const baseline = requests.length;
    for (const scheme of ['light', 'dark']) for (const width of [320, 390, 1280]) await geometry(page, width, scheme);
    await page.locator('[data-n44-support] > summary').focus(); await page.keyboard.press('Enter');
    assert.equal(await support.evaluate(el => el.open), true);
    assert.equal(await page.locator('[data-n44-deleted-sources]').evaluate(el => el.open), false);
    assert.ok((await page.locator('[data-n44-deleted-sources] > summary').innerText()).includes('30'));
    assert.equal(await page.locator('[data-n44-source]:visible').count(), 1);
    await page.locator('[data-n44-current-identity] > summary').click();
    assert.ok((await page.locator('[data-n44-current-identity]').innerText()).includes(checkpoint.owner));
    await repaint(page); assert.equal(await support.evaluate(el => el.open), true);
    assert.deepEqual((await calls(page)).source, 0); assert.equal((await calls(page)).verify, 0);
    await page.locator('[data-n44-support] > summary').focus(); await page.keyboard.press('Space');
    await repaint(page); assert.equal(await support.evaluate(el => el.open), false);
    assert.equal(await page.locator('[data-n44-support] > summary').evaluate(el => el === document.activeElement), true);
    pass('n44_settings_default_user_hierarchy_and_support_disclosure', 'Actual account UI: one closed bottom Support, no visible IDs/HTTP; 30 deleted sources grouped closed; keyboard open/close persists only explicit same-context choice; zero automatic source/verification calls.');
    await page.locator('[data-minutes="30"]').click();
    await expect(page.locator('[data-minutes="30"]')).toHaveAttribute('aria-pressed', 'true');
    await page.locator('[data-kind="lesson"]').focus(); await page.keyboard.press('Space');
    await expect(page.locator('[data-kind="lesson"]')).toHaveAttribute('aria-checked', 'false');
    assert.equal(await page.locator('[data-kind="lesson"]').evaluate(el => el === document.activeElement), true);
    await page.keyboard.press('Space'); await expect(page.locator('[data-minutes="30"]')).toHaveAttribute('aria-pressed', 'true');
    await page.locator('[data-day="2"]').click();
    await expect(page.locator('[data-day="2"]')).toHaveAttribute('aria-checked', 'false');
    await page.evaluate(() => { settingsFixture.push.available = true; settingsFixture.push.status = 'subscribed'; settingsFixture.push.cleanupBusy = true; }); await repaint(page);
    await expect(page.locator('[data-act="notification-push"]')).toBeDisabled();
    await page.evaluate(() => { settingsFixture.push.cleanupBusy = false; }); await repaint(page);
    await page.locator('[data-act="notification-push-quiet"]').click();
    await expect(page.locator('[data-act="notification-push-quiet"]')).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('[data-act="notification-push"]')).toHaveText('إيقاف تذكيرات الجهاز');
    await page.locator('[data-act="notification-push"]').click();
    await page.waitForFunction(() => settingsFixture.calls.disable === 1);
    await page.evaluate(() => { settingsFixture.push.available = false; settingsFixture.push.eligibility.reason = 'browser_unsupported'; }); await repaint(page);
    await expect(page.locator('[data-act="notification-push-quiet"]')).toBeDisabled();
    await expect(page.locator('[data-act="notification-push-quiet"]')).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('[data-day="2"]')).toHaveAttribute('aria-checked', 'false');
    assert.ok((await page.locator('[data-n44-push-eligibility]').innerText()).includes('لا يدعم'));
    assert.equal(await page.locator('[data-act="notification-push"]').count(), 0);
    await page.evaluate(() => { settingsFixture.push.status = 'cleanup_pending'; settingsFixture.push.cleanupAvailable = true; }); await repaint(page);
    assert.equal(await page.locator('[data-act="notification-push"]').innerText(), 'إعادة محاولة الإيقاف');
    await page.locator('[data-act="notification-push"]').click(); assert.equal((await calls(page)).disable, 2); assert.equal((await calls(page)).optIn, 0);
    await page.locator('[data-n44-support] > summary').click();
    await page.locator('[data-n44-source="synthetic-source-0"] summary').click();
    await page.locator('[data-n44-source="synthetic-source-0"] [data-act="notification-source-status"]').click();
    await expect(page.locator('[data-n44-source-status="confirmed"]')).toHaveCount(1);
    await page.locator('[data-n44-deleted-sources] > summary').click();
    await page.locator('[data-n44-source="synthetic-source-1"] summary').click();
    await page.locator('[data-n44-source="synthetic-source-1"] [data-act="notification-source-status"]').click();
    await page.locator('[data-n44-deleted-sources] > summary').click();
    assert.ok((await page.locator('[data-n44-cleanup-receipt]').textContent()).includes('synthetic-receipt'));
    assert.equal(await page.locator('[data-n44-cleanup-receipt]').isVisible(), true);
    await page.evaluate(() => { settingsFixture.ui.canVerify = true; }); await repaint(page);
    await page.locator('[data-act="notification-verify"]').click();
    await expect(page.locator('[data-n44-authorization-receipt]')).toBeVisible();
    assert.equal((await calls(page)).source, 2); assert.equal((await calls(page)).verify, 1);
    await geometry(page, 320, 'dark', 'support');
    await page.evaluate(() => { settingsFixture.ui.verification.status = 'unknown'; settingsFixture.ui.sourceStatus.status = 'pending'; }); await repaint(page);
    await page.locator('[data-n44-support] > summary').click();
    assert.ok((await page.locator('.n44-settings').innerText()).includes('لن تُعاد المحاولة تلقائيًا'));
    assert.ok((await page.locator('.n44-settings').innerText()).includes('حفظ المصدر لم يُؤكد'));
    // Identity remains discoverable even when no config outcome or source exists.
    await page.evaluate(() => { settingsFixture.push.configOutcome = null; settingsFixture.ui = { canVerify: false, reminders: [], sources: [] }; }); await repaint(page);
    assert.equal(await support.evaluate(el => el.open), false);
    await page.locator('[data-n44-support] > summary').click(); await page.locator('[data-n44-current-identity] > summary').click();
    assert.ok((await page.locator('[data-n44-current-identity]').innerText()).includes(checkpoint.owner));
    const staleGuard = await page.evaluate(async () => {
      const view = (await import('/src/views/notification-settings.js')).default;
      const old = document.querySelector('[data-minutes="30"]');
      const source = document.createElement('button'); source.dataset.scope = old.dataset.scope; source.dataset.choice = 'synthetic-token-0';
      const before = { ...settingsFixture.calls };
      const store = await import('/src/store.js'); store.deactivateWorkspace();
      const clearedSynchronously = !document.querySelector('[data-n44-current-identity]') && !document.querySelector('[data-n44-support]');
      await view.actions['notification-source-status'](source); await view.actions['notification-verify'](source); await view.actions['notification-push'](source); view.actions['notification-minutes'](old);
      return { before, after: { ...settingsFixture.calls }, clearedSynchronously };
    });
    assert.equal(staleGuard.clearedSynchronously, true); assert.deepEqual(staleGuard.before, staleGuard.after);
    await page.evaluate(async () => { const f = await import('/tests/n44-fixture.mjs'); await f.prepareAccount(f.otherOwner); }); await repaint(page);
    assert.equal(await support.evaluate(el => el.open), false);
    assert.ok(!(await support.textContent()).includes(checkpoint.owner));
    assert.equal(requests.length, baseline, 'settings interactions added no service request');
    assert.deepEqual(errors, []);
    pass('n44_settings_cleanup_and_owner_context_fences', 'Disabled/unsupported states show no activation; cleanupPending invokes existing Stop despite unavailable activation; manual source/cleanup/authorization selectors retained; real store timing/category/focus preserved; deactivation synchronously clears private DOM and stale actions are owner-guarded; new owner Support closed.');
    pass('n44_settings_actual_responsive_keyboard_no_extra_requests', 'Actual HTTP application/CSS: 320/390/1280 in light/dark plus expanded Support at 320 dark, RTL/no overflow, visible controls >=44px; keyboard disclosure/category and focus preserved; no additional service requests, source reads or verification without explicit action. Screenshots saved for inspection.');
  });
  await writeFile(path.join(out, 'result.json'), JSON.stringify({ taskId, runId, checks, layouts, serviceRequests: requests.length, syntheticOnly: true }, null, 2) + '\n');
} finally { await new Promise(resolve => server.close(resolve)); }
