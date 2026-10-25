// AI: bounded mounted actual-handler regression over owned loopback HTTP.
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { withIsolatedLocalBrowser } from 'file:///C:/Users/Abody/Projects/RakeezX/scripts/ops-supervisor-v4/isolated-local-browser.mjs';
const taskId = 'continuous-n44-settings-context-recovery-20261026';
const runId = '22edd3b9-a0c5-4a41-9961-000efc3c2b31';
const dir = 'tests/n44-settings-context-recovery-20261026', root = process.cwd();
const red = process.argv.includes('--red');
const receipt = { taskId, runId, phase: red ? 'red' : 'green', checks: [], realPush: 'NOT_RUN', osArrival: 'NOT_PROVEN' };
receipt.sourceHashes = Object.fromEntries(await Promise.all([
  'src/views/notification-settings.js', 'src/repaint.js', 'src/lib/dom.js',
  'src/store.js', 'src/lib/cloud.js', 'src/lib/notification-events.js',
  'src/lib/notification-push-runtime.js', 'src/styles/notifications.css',
].map(async file => [file, createHash('sha256').update((await readFile(file, 'utf8')).replace(/\r\n/g, '\n')).digest('hex')])));
const mime = { '.mjs': 'text/javascript', '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const server = http.createServer(async (req, res) => {
  const file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
  if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
  try { const data = await readFile(file); res.writeHead(200, { 'content-type': mime[path.extname(file)] ?? 'application/octet-stream' }); res.end(data); }
  catch { res.writeHead(404).end(); }
});
const pass = (name, evidence) => receipt.checks.push({ name, status: 'PASS', evidence });
try {
  await new Promise(ok => server.listen(0, '127.0.0.1', ok));
  const url = `http://127.0.0.1:${server.address().port}/${dir}/host.html`;
  await withIsolatedLocalBrowser({ taskFile: `C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/${taskId}.json`, runId, url, timeoutMs: 120000 }, async ({ createContext }) => {
    const ctx = await createContext({ viewport: { width: 390, height: 844 }, locale: 'ar-SA', timezoneId: 'Asia/Riyadh' });
    const page = await ctx.newPage(); page.setDefaultTimeout(10000);
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(url); await page.waitForFunction(() => window.h?.ready);
    assert.equal(await page.locator('[data-n44-support]').count(), 1);
    const before = await page.evaluate(() => ({ paints: h.paints, requests: h.requests, context: h.store.getActiveWorkspace().databaseName }));
    assert.equal(await page.evaluate(() => h.reset()), 0, 'private DOM clears synchronously');
    await page.waitForTimeout(60);
    const after = await page.evaluate(() => ({ support: h.root.querySelectorAll('[data-n44-support]').length, buttons: h.root.querySelectorAll('button').length, paints: h.paints, requests: h.requests, config: h.runtime.snapshot().configOutcome, context: h.store.getActiveWorkspace().databaseName }));
    receipt.readinessReset = { before, after };
    if (red) {
      assert.equal(after.support, 0); assert.equal(after.buttons, 0);
      receipt.checks.push({ name: 'n44_settings_actual_empty_mount_red_green', status: 'FAIL', evidence: 'Actual baseline onMount validate clears settings during same-owner readiness reset; after settled rebind Support/buttons remain zero with no repaint.' });
      await page.screenshot({ path: `${dir}/red-empty.png`, fullPage: true });
      return;
    }
    assert.equal(after.support, 1); assert.ok(after.buttons > 0); assert.equal(after.paints, before.paints + 1); assert.equal(after.requests, before.requests); assert.equal(after.config, null); assert.equal(after.context, before.context);
    // Rebind actual runtime explicitly, then reset/rebind within one task. Final
    // markup equals pre-clear markup: real renderRegions must still repair DOM.
    await page.evaluate(async () => { await h.runtime.refresh(); h.paint(); });
    await page.evaluate(async () => { h.reset(); await h.runtime.refresh(); });
    await page.waitForTimeout(60); assert.equal(await page.locator('[data-n44-support]').count(), 1);
    const identical = await page.evaluate(() => {
      const stable = () => String(h.view.render()).replace(/data-n44-recovery="\d+"/, 'data-n44-recovery="revision"');
      const before = stable();
      h.store.state.ready = false; h.signal();
      const cleared = h.root.querySelector('.n44-settings').childElementCount;
      // No intervening render/runtime reset: the safe generated HTML returns
      // exactly to its prior value while its live region has been emptied.
      h.store.state.ready = true; h.signal();
      return { cleared, identical: before === stable() };
    });
    assert.deepEqual(identical, { cleared: 0, identical: true });
    await page.waitForTimeout(60); assert.equal(await page.locator('[data-n44-support]').count(), 1);
    receipt.identicalMarkupRecovery = identical;
    pass('n44_settings_actual_empty_mount_red_green', 'Baseline FAIL preserved. Actual runtime invalidation + same-owner ready reset and rebind recover without reload, including identical renderRegions markup.');
    // Actual deactivation calls subscribers BEFORE activeWorkspace changes.
    const transition = await page.evaluate(() => { h.store.deactivateWorkspace('synthetic-transition'); return { children: h.root.querySelector('.n44-settings').childElementCount, oldOwner: h.root.textContent.includes(h.owner) }; });
    assert.deepEqual(transition, { children: 0, oldOwner: false });
    await page.waitForTimeout(60); assert.match(await page.locator('.n44-settings').innerText(), /تتوفر إعدادات/);
    await page.evaluate(async () => { await h.arrange(h.otherOwner); h.signal(); });
    await page.waitForTimeout(60);
    assert.equal(await page.locator('[data-n44-support]').count(), 1);
    assert.equal(await page.locator('.n44-settings').evaluate(el => el.textContent.includes(h.owner)), false);
    assert.equal(await page.locator('.n44-settings').evaluate(el => el.textContent.includes(h.otherOwner)), true);
    await page.evaluate(() => { h.cloud.setMockAuth(null, null); localStorage.removeItem(h.cloud.AUTH_STORAGE_KEY); h.signal(); });
    await page.waitForTimeout(60); assert.match(await page.locator('.n44-settings').innerText(), /تتوفر إعدادات/);
    // Null scope is represented as an empty dataset string: repeated unavailable
    // notifications must settle without a recursive paint loop.
    const noctx = await page.evaluate(() => { const n = h.paints; for (let i=0;i<30;i++) h.signal(); return n; });
    await page.waitForTimeout(60); assert.equal(await page.evaluate(n => h.paints - n, noctx), 0);
    await page.evaluate(async () => { await h.arrange(); h.signal(); }); await page.waitForTimeout(60);
    const burst = await page.evaluate(() => { const n = { paints: h.paints, requests: h.requests }; for(let i=0;i<50;i++) h.signal(); return n; });
    await page.waitForTimeout(60);
    assert.ok(await page.evaluate(n => h.paints === n.paints && h.requests === n.requests, burst));
    const notifications = await page.evaluate(async () => {
      const before = { paints: h.paints, requests: h.requests };
      // Real cloud subscription notifications with same-owner local Auth data;
      // future expiry prevents refresh/network, and no real account is involved.
      for (let i=0;i<20;i++) {
        localStorage.setItem(h.cloud.AUTH_STORAGE_KEY, JSON.stringify({ ...h.cloud.session, user: { ...h.cloud.user, user_metadata: { syntheticBurst: i } } }));
        await h.cloud.init();
      }
      h.store.state.profile.teacherName = 'transient synthetic notification';
      await Promise.all(Array.from({ length: 10 }, () => h.store.refreshSyncedState()));
      return before;
    });
    await page.waitForTimeout(60);
    // DB reads complete in a later task than the synchronous cloud burst, so
    // these are two bounded bursts, not one scheduling turn.
    const notificationResult = await page.evaluate(n => ({ paints: h.paints - n.paints, requests: h.requests - n.requests }), notifications);
    receipt.notificationBursts = notificationResult;
    assert.equal(notificationResult.paints, 0); assert.equal(notificationResult.requests, 0);
    const unmount = await page.evaluate(() => { h.reset(); const n = h.paints; h.unmount(); h.signal(); return n; });
    await page.waitForTimeout(60); assert.equal(await page.evaluate(() => h.paints), unmount); assert.equal(await page.locator('#main').innerText(), 'Other route');
    await page.evaluate(() => h.mount());
    pass('n44_settings_privacy_deferred_recovery_and_unmount_fences', 'Actual store deactivation clears before context switch; B-only recovery, logout/no-context safe text, real same-owner cloud/store notifications coalesce and obsolete deferred unmount callback is fenced.');
    await page.evaluate(() => h.manualPort());
    assert.deepEqual(await page.evaluate(() => ({ reads: h.port.reads, stops: h.port.stops })), { reads: 0, stops: 0 });
    for (const [width, theme] of [[320, 'dark'], [390, 'light']]) {
      await page.setViewportSize({ width, height: 844 }); await page.evaluate(t => document.documentElement.dataset.theme = t, theme);
      assert.equal(await page.locator('[data-n44-support]').count(), 1); assert.equal(await page.locator('[data-n44-support]').evaluate(el => el.open), false);
      await page.locator('[data-n44-support] > summary').focus(); await page.keyboard.press('Enter');
      assert.equal(await page.locator('[data-n44-support]').evaluate(el => el.open), true);
      assert.equal(await page.locator('[data-n44-support] > summary').evaluate(el => el === document.activeElement), true);
      await page.locator('[data-act="notification-push"]').focus();
      assert.equal(await page.locator('[data-act="notification-push"]').evaluate(el => el === document.activeElement), true);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1); assert.equal(overflow, false);
      await page.screenshot({ path: `${dir}/${width}-${theme}.png`, fullPage: true });
      await page.locator('[data-n44-support] > summary').click();
    }
    // Actual delegated action + epoch fences, using only the view port above.
    await page.locator('[data-n44-support] > summary').click();
    await page.locator('[data-act="notification-device-outcome"]').click();
    assert.equal(await page.locator('[data-act="notification-device-outcome"]').isDisabled(), true);
    await page.locator('[data-act="notification-push"]').click();
    await page.evaluate(() => h.port.resolve({ stage: 'display-accepted', minute: Math.floor(Date.now()/60000), present: true }));
    await page.waitForTimeout(30);
    assert.equal(await page.locator('[data-n44-device-outcome]').count(), 0);
    assert.deepEqual(await page.evaluate(() => ({ reads: h.port.reads, stops: h.port.stops })), { reads: 1, stops: 1 });
    // Pending old-owner result must not appear in the next safe context.
    await page.evaluate(() => h.manualPort());
    await page.locator('[data-act="notification-device-outcome"]').click();
    await page.evaluate(async () => { h.store.deactivateWorkspace(); await h.arrange(h.otherOwner); h.signal(); h.port.resolve({ stage: 'received', minute: null, present: null }); });
    await page.waitForTimeout(30); assert.equal(await page.locator('[data-n44-device-outcome]').count(), 0);
    // A pending manual read and a recovery request both become obsolete at unmount.
    await page.evaluate(() => h.manualPort());
    await page.locator('[data-n44-support] > summary').click();
    await page.locator('[data-act="notification-device-outcome"]').click();
    const late = await page.evaluate(() => { h.signal(); h.unmount(); const n = h.paints; h.port.resolve({ stage: 'received', minute: null, present: null }); return n; });
    await page.waitForTimeout(30); assert.equal(await page.evaluate(() => h.paints), late); assert.equal(await page.locator('#main').innerText(), 'Other route');
    assert.deepEqual(errors, []); receipt.pageErrors = errors;
    pass('n44_settings_recovery_no_automatic_io_and_actual_layout', 'Actual view/CSS at 320 dark + 390 light: one collapsed Support, Stop + keyboard focus, no overflow. View-only manual port: zero automatic reads/Stop calls; pending disabled, Stop/owner/unmount fence late outcomes. Actual runtime recovery adds zero configuration calls. Native/real Push NOT_RUN.');
    await page.evaluate(async () => { h.view.onUnmount(); await h.runtime.dispose(); h.store.deactivateWorkspace('owned-test-cleanup'); });
  });
} catch (e) { receipt.error = e.stack; process.exitCode = 1; }
finally { await new Promise(ok => server.close(ok)); await writeFile(`${dir}/${red ? 'red' : 'green'}.json`, JSON.stringify(receipt, null, 2) + '\n'); }
console.log(JSON.stringify(receipt, null, 2));
