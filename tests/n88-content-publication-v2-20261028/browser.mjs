/** AI-authored: actual dormant module DOM/handlers/CSS via owned loopback HTTP. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { start } from './host.mjs';
import { withIsolatedLocalBrowser } from 'file:///C:/Users/Abody/Projects/RakeezX/scripts/ops-supervisor-v4/isolated-local-browser.mjs';
const canonical = 'C:/Users/Abody/Projects/RakeezX';
const taskId = 'continuous-n88-work-and-grades-publication-contract-20261028', runId = 'bd46ac28-a9c6-4e00-97a1-9aac2d27dc11';
const taskFile = `${canonical}/artifacts/ops-supervisor-v4/queue/${taskId}.json`;
const lease = action => execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-File', canonical + '/scripts/ops-supervisor-v4/resource-lease.ps1', '-Name', 'integration', '-Action', action, '-TaskFile', taskFile, '-RuntimeRoot', canonical + '/artifacts/ops-supervisor-v4', '-WaitSeconds', '0', '-OwnerToken', runId], { encoding: 'utf8', windowsHide: true, timeout: 20000 }).trim();
const dir = 'tests/n88-content-publication-v2-20261028';
const report = { taskId, runId, check: 'n88_v2_inactive_review_ui_and_zero_live_data_service_ops', status: 'FAIL',
  realAccountOperations: 0, providerOperations: 0, checks: [], pageErrors: [], externalRequests: [], cleanup: {} };
let server, owned = false;
try {
  lease('acquire'); owned = true;
  server = await start();
  await withIsolatedLocalBrowser({ taskFile, runId, url: server.url }, async ({ createContext }) => {
    const context = await createContext({ viewport: { width: 1100, height: 900 }, locale: 'ar-SA' });
    const page = await context.newPage();
    page.on('pageerror', e => report.pageErrors.push(e.message));
    page.on('request', r => { if (new URL(r.url()).origin !== new URL(server.url).origin) report.externalRequests.push(r.url()); });
    await page.goto(server.url);
    await page.waitForFunction(() => !!window.review);
    assert.equal(await page.locator('article').count(), 3);
    assert.equal(await page.locator('article input:checked').count(), 0);
    assert.match(await page.locator('article').first().textContent(), /2026-10-26.*2026-10-30/);
    assert.equal(await page.locator('article').first().evaluate(n => getComputedStyle(n).borderRadius), '12px');
    assert.equal(await page.locator('[name=dueDate]').evaluate(n => !!n._flatpickr && n.dataset.rakeezDateScope === 'planning'), true);
    await page.locator('article').first().locator('[data-flag=required]').check();
    assert.equal(await page.locator('article').first().locator('[data-flag=grade]').isChecked(), false);
    await page.locator('article').nth(1).locator('[data-flag=grade]').check();
    report.checks.push('Actual source rows, dates, CSS and independent draft checkbox handlers PASS');
    await page.locator('[name=title]').fill('<img src=x onerror=alert(1)> مهمة المعلم');
    await page.locator('[name=description]').fill('شرح محلي <script>bad()</script>');
    await page.locator('[name=startDate]').fill('٢٠٢٦-١٠-٢٨');
    assert.equal(await page.locator('[name=startDate]').inputValue(), '2026-10-28');
    await page.locator('[name=link]').fill('javascript:alert(1)');
    await page.getByRole('button', { name: 'إضافة إلى المسودة المحلية' }).click();
    assert.equal(await page.locator('article').count(), 3);
    assert.match(await page.getByRole('status').textContent(), /HTTPS/);
    await page.locator('[name=link]').fill('https://example.test/lesson');
    await page.getByRole('button', { name: 'إضافة إلى المسودة المحلية' }).click();
    assert.equal(await page.locator('article').count(), 4);
    const manual = page.locator('article').last();
    assert.equal(await manual.locator('input:checked').count(), 0);
    assert.equal(await manual.locator('img,script').count(), 0);
    assert.equal(await manual.locator('[data-flag=grade]').count(), 0);
    assert.equal(await manual.locator('a').getAttribute('rel'), 'noopener noreferrer');
    assert.equal(await manual.locator('a').getAttribute('referrerpolicy'), 'no-referrer');
    assert.match(await manual.textContent(), /2026-10-28/);
    await manual.locator('[data-flag=scheduled]').check();
    report.checks.push('Manual XSS text, approved date adapter, rejected unsafe link, safe explicit anchor, private defaults PASS');
    await page.screenshot({ path: `${dir}/review-desktop.png`, fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: `${dir}/review-mobile.png`, fullPage: true });
    await page.evaluate(() => {
      window.reviewFixture.data.scoreSubitems[0].name = 'تمارين الكسور بعد التعديل';
      window.review.refresh(window.reviewFixture);
    });
    assert.equal(await page.locator('article').first().locator('input:checked').count(), 0);
    assert.equal(await page.locator('article').nth(1).locator('[data-flag=grade]').isChecked(), true);
    await page.evaluate(() => {
      const f = window.reviewFixture;
      f.data.scoreSubitems[1].deleted = true;
      f.data.scoreSubitems.push({ ...f.data.scoreSubitems[0], id: 'new-source', name: 'بند أُضيف للتوزيع' });
      window.review.refresh(f);
    });
    assert.equal(await page.locator('article').filter({ hasText: 'مراجعة الجمع' }).count(), 0);
    assert.equal(await page.locator('article').filter({ hasText: 'بند أُضيف للتوزيع' }).locator('input:checked').count(), 0);
    await page.evaluate(() => {
      const f = structuredClone(window.reviewFixture); f.scope.ownerId = 'fake-new-owner'; f.data.ownerId = f.scope.ownerId;
      for (const key of ['teachings', 'sections', 'terms']) f.data[key].forEach(r => { r.ownerId = f.scope.ownerId; });
      f.data.items = []; f.data.scoreSubitems = []; window.review.refresh(f);
    });
    assert.equal(await page.locator('article').count(), 0);
    assert.equal(await page.locator('[name=title]').inputValue(), '');
    assert.equal(await page.evaluate(() => {
      try { window.review.refresh({ ...window.reviewFixture, scope: { ...window.reviewFixture.scope, unexpected: true } }); }
      catch { return window.review.snapshot() === null; }
      return false;
    }), true);
    assert.equal(await page.getByRole('form', { name: 'إضافة مهمة يدوية للمسودة' }).count(), 0);
    assert.equal(await page.evaluate(() => Object.keys(localStorage).length), 0);
    await page.reload(); await page.waitForFunction(() => !!window.review);
    assert.equal(await page.locator('article input:checked').count(), 0);
    report.checks.push('390px layout, source rename/add/remove defaults, owner-switch clear, malformed scope fails closed and reload discards local draft PASS');
    await page.evaluate(() => window.review.destroy());
    assert.equal(await page.locator('.n88-publication-review').count(), 0);
    assert.deepEqual(report.pageErrors, []); assert.deepEqual(report.externalRequests, []);
  });
  report.status = 'PASS';
} catch (error) { report.error = error.message; process.exitCode = 1; }
finally {
  if (server) { await server.close(); report.cleanup.serverClosed = true; }
  report.cleanup.browserClosedByCanonicalHelper = true;
  if (owned) { report.cleanup.integrationLeaseRelease = lease('release'); }
  await writeFile(`${dir}/browser-evidence.json`, JSON.stringify(report, null, 2) + '\n');
}
console.log(JSON.stringify(report, null, 2));
