import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.setTimeout(90_000);

async function boot(page) {
  await page.route('**/rest/v1/**', (route) => route.fulfill({ json: [] }));
  await page.goto('/');
  await page.waitForFunction(() => window.store?.state?.ready && window.__syncModule && document.querySelector('.topbar'));
}

// Test-only IndexedDB evidence is consumed by the unmodified Production summary.
async function seedSummary(page, state = 'synced', historical = false, count = 1, last = Date.UTC(2026, 8, 13, 9, 30)) {
  return page.evaluate(async ({ state, historical, count, last }) => {
    const db = await import('/src/lib/db.js');
    const cloud = await import('/src/lib/cloud.js');
    const sync = await import('/src/lib/sync.js');
    cloud.setMockAuth({ id: 'sync-ux-test-owner', email: 'teacher@example.test' }, { access_token: 'test-only' });
    await db.clearStore('outbox');
    await db.remove('sessions', 'private-session-fixture');
    if (historical) await db.put('sessions', {
      id: 'private-session-fixture', updatedAt: 1,
      syncConflicts: [{ lifecycle: 'historical_reconciled', mutationId: 'private-mutation', rejectedPatch: { name: 'PRIVATE STUDENT' }, recordedAt: 1 }],
    });
    if (state !== 'synced') for (let index = 0; index < count; index++) await db.put('outbox', {
      id: `private-outbox-fixture-${index}`, protocol: 'v2', state: state === 'error' ? 'failed' : state,
      store: 'sessions', recordId: 'private-session-fixture', sequence: 1,
      patch: { note: 'PRIVATE PAYLOAD' }, lastError: 'PRIVATE RAW ERROR',
    });
    // Deliberately retain the obsolete conflict marker: the summary must overrule it.
    sync.state.status = historical ? 'conflicted' : 'idle';
    sync.state.lastSyncedAt = last;
    return sync.getSyncOperationalSummary();
  }, { state, historical, count, last });
}

async function openCenter(page) {
  await page.locator('[data-act="open-teacher-mini-hub"]').filter({ visible: true }).first().click();
  const section = page.locator('.mini-hub-sync');
  await expect(section).toBeVisible();
  return section;
}

test('current operational states and historical evidence have distinct actions and privacy-safe details', async ({ page }) => {
  await boot(page);
  const cases = [
    ['synced', false, 'متزامن'], ['synced', true, 'متزامن'],
    ['pending', false, 'تغييرات بانتظار المزامنة'], ['pending', true, 'تغييرات بانتظار المزامنة'],
    ['error', false, 'تعذر إكمال المزامنة'],
    ['blocked', false, 'تغييرات تنتظر بيانات مرتبطة'], ['blocked', true, 'تغييرات تنتظر بيانات مرتبطة'],
    ['rejected', false, 'تعذر اعتماد بعض التغييرات'],
  ];
  for (const [state, historical, title] of cases) {
    const summary = await seedSummary(page, state, historical);
    expect(summary.state).toBe(state);
    expect(summary.historicalConflictCount).toBe(historical ? 1 : 0);
    const section = await openCenter(page);
    await expect(section.locator('.badge')).toHaveText(title);
    await expect(section.locator('details')).not.toHaveAttribute('open');
    await expect(section.locator('.mini-hub-sync__meta p')).toHaveCount(1);
    await expect(section.locator('.mini-hub-sync__meta')).not.toContainText(/يمكنك متابعة|اختلافات مزامنة|الأقسام المعنية/);
    if (['synced', 'pending'].includes(state)) await expect(section.locator('.mini-hub-sync__meta')).not.toContainText('بياناتك محفوظة');
    if (state === 'synced') await expect(section.locator('.mini-hub-sync__meta')).toContainText('آخر مزامنة:');
    if (state === 'pending') await expect(section.locator('.mini-hub-sync__meta')).toHaveText('تغيير واحد محفوظ');
    await expect(section).toContainText('آخر مزامنة ناجحة:');
    await expect(section).not.toContainText('توجد تغييرات تحتاج مراجعة');
    const help = section.getByRole('link', { name: 'تحتاج مساعدة؟' });
    await expect(help).toHaveCount(['error', 'blocked', 'rejected'].includes(state) ? 1 : 0);
    await expect(section.getByRole('button', { name: 'مزامنة الآن' })).toHaveCount(state === 'rejected' ? 0 : 1);
    if (historical) await expect(section.locator('.mini-hub-sync__historical')).not.toBeVisible();
    await section.locator('summary').click();
    const details = section.locator('.mini-hub-sync__detail-content');
    if (['synced', 'pending'].includes(state)) {
      await expect(details).not.toContainText(/لم تبدأ مزامنة|بياناتك محفوظة|يمكنك متابعة|توجد تغييرات محفوظة|بياناتك الحالية متزامنة/);
    } else {
      await expect(details).toContainText('بياناتك محفوظة على هذا الجهاز.');
      await expect(details).toContainText('يمكنك متابعة العمل غير المرتبط بهذه التغييرات.');
    }
    await expect(section).not.toContainText('تغييرات محلية بانتظار اكتمال المزامنة:');
    if (historical) {
      await expect(section.locator('.mini-hub-sync__historical')).toHaveText('اختلافات مزامنة سابقة تمت معالجتها: 1');
      await expect(section.locator('.mini-hub-sync__historical')).not.toHaveClass(/warn|danger/);
    }
    await expect(section).not.toContainText(/private-|PRIVATE|recordId|mutationId|syncConflicts|rejectedPatch|receipt/);
    if (state !== 'synced') await expect(section).toContainText('الجدول والحصص');
    await page.getByRole('button', { name: 'إغلاق', exact: true }).click();
  }
});

test('active synchronization and a real retryable transport failure use the runtime summary and safe actions', async ({ page }) => {
  await boot(page);
  await seedSummary(page);
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  await page.route('**/rest/v1/**', async (route) => {
    await gate;
    await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'PRIVATE SERVER ERROR' }) });
  });
  await page.evaluate(async () => {
    const sync = await import('/src/lib/sync.js');
    void sync.syncAll({ full: true });
  });
  const section = await openCenter(page);
  await expect(section.locator('.badge')).toHaveText('جارٍ مزامنة التغييرات');
  await expect(section.getByRole('button', { name: 'جارٍ المزامنة…' })).toBeDisabled();
  await expect(section.getByRole('link', { name: 'تحتاج مساعدة؟' })).toHaveCount(0);
  await expect(section.locator('.mini-hub-sync__meta p')).toHaveCount(1);
  for (const width of [320, 390, 412, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const theme of ['light', 'dark']) {
      await page.evaluate((theme) => document.documentElement.setAttribute('data-theme', theme), theme);
      expect(await section.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    }
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(() => section.locator('.sync-dot').evaluate((el) => {
    const style = getComputedStyle(el);
    return style.animationName === 'none' || style.animationDuration.split(',').every((value) => parseFloat(value) <= .01);
  })).toBe(true);
  await section.locator('summary').click();
  await section.locator('summary').focus();
  release();
  await expect(section.locator('.badge')).toHaveText('تعذر إكمال المزامنة');
  await expect(section).toContainText('سنحاول المزامنة مرة أخرى تلقائيًا.');
  await expect(section.locator('details')).toHaveAttribute('open', '');
  await expect(section.locator('summary')).toBeFocused();
  await expect(section).not.toContainText('PRIVATE SERVER ERROR');
  const help = section.getByRole('link', { name: 'تحتاج مساعدة؟' });
  await expect(help).toHaveAttribute('href', '#/support');
  await help.click();
  await expect(page).toHaveURL(/#\/support$/);
  await expect(page.locator('.mini-hub-sync')).toHaveCount(0);
});

test('Teacher Center remains compact, accessible and overflow-free at every requested width and theme', async ({ page }, testInfo) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await boot(page);
  for (const [state, historical, first] of [
    ['pending', false, true], ['synced', false], ['synced', true],
    ['pending', false], ['pending', true], ['error', false], ['blocked', false], ['rejected', false],
  ]) {
    await seedSummary(page, state, historical, first ? 111 : 1, first ? 0 : undefined);
    const section = await openCenter(page);
    if (first) {
      await expect(section.locator('.badge')).toHaveText('محلي');
      await expect(section.locator('.mini-hub-sync__state')).toHaveText('حالة المزامنة: محلي');
      await expect(section.locator('.mini-hub-sync__meta')).toHaveText('111 تغييرًا محفوظًا');
      await expect(section.getByRole('button', { name: 'مزامنة الآن' })).toBeEnabled();
    }
    for (const width of [320, 390, 412, 1280, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const theme of ['light', 'dark']) {
        await page.evaluate((theme) => document.documentElement.setAttribute('data-theme', theme), theme);
        // Crossing the sheet's desktop breakpoint starts its scale-in animation.
        // Wait for that real lifecycle before measuring rendered touch targets.
        await page.locator('.sheet').evaluate(async (el) => {
          await Promise.all(el.getAnimations().map((animation) => animation.finished.catch(() => {})));
        });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), `${state} ${width} ${theme}`).toBe(true);
        expect(await section.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
        for (const action of await section.locator('button, a, summary').all()) {
          // Measure the settled target, not the existing sheet's scale-in frame.
          await expect.poll(async () => (await action.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
        }
        await expect(section.locator('details')).not.toHaveAttribute('open');
        await expect(section.locator('.mini-hub-sync__meta p')).toHaveCount(1);
        await page.screenshot({ path: testInfo.outputPath(`${first ? 'first-sync' : state}-${historical ? 'history' : 'clean'}-${width}-${theme}.png`), animations: 'disabled' });
        await section.locator('summary').click();
        if (first) await expect(section.locator('.mini-hub-sync__detail-content').getByText('بانتظار المزامنة: 111', { exact: true })).toHaveCount(1);
        if (first) {
          await expect(section.locator('.mini-hub-sync__detail-content')).not.toContainText(/لم تبدأ مزامنة|بياناتك محفوظة|يمكنك متابعة/);
          await expect(section.locator('.mini-hub-sync__detail-content')).toContainText('آخر مزامنة ناجحة: لم تتم بعد');
          await page.screenshot({ path: testInfo.outputPath(`first-sync-details-${width}-${theme}.png`), animations: 'disabled' });
        }
        expect(await section.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
        await section.locator('summary').click();
      }
    }
    await page.setViewportSize({ width: 390, height: 900 });
    const result = await new AxeBuilder({ page }).include('.mini-hub-sync').analyze();
    expect(result.violations).toEqual([]);
    await section.locator('summary').focus();
    await page.keyboard.press('Enter');
    await expect(section.locator('summary')).toBeFocused();
    await page.getByRole('button', { name: 'إغلاق', exact: true }).click();
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await seedSummary(page, 'pending');
  await openCenter(page);
  await expect.poll(() => page.locator('.mini-hub-sync .sync-dot').evaluate((el) => getComputedStyle(el).animationName)).toBe('none');
  expect(errors).toEqual([]);
});
