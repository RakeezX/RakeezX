import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir } from 'node:fs/promises';

test.use({ ...(process.env.RAKEEZX_E2E_BASE_URL ? { baseURL: process.env.RAKEEZX_E2E_BASE_URL } : {}) });
test.setTimeout(120_000);

const output = 'test-results/home-mobile-account';
const widths = [320, 360, 384, 390, 412];
const stateText = {
  synced: 'متزامن',
  pending: 'تغييرات بانتظار المزامنة',
  error: 'تعذر إكمال المزامنة',
  blocked: 'تغييرات تنتظر بيانات مرتبطة',
  rejected: 'تعذر اعتماد بعض التغييرات',
  offline: 'غير متصل',
};

async function seedHeader(page, { signedIn = true, name = 'عبدالله', state = 'synced' } = {}) {
  return page.evaluate(async ({ signedIn, name, state }) => {
    const cloud = await import('/src/lib/cloud.js');
    const db = await import('/src/lib/db.js');
    const sync = await import('/src/lib/sync.js');
    cloud.setMockBackend({
      async fetchRecords() { return []; },
      async applySyncV2Mutation(envelope) {
        return {
          mutationId: envelope.mutationId,
          entity: envelope.entity,
          recordId: envelope.recordId,
          canonicalId: envelope.recordId,
          outcome: 'applied',
          appliedGroups: Object.keys(envelope.patch ?? {}),
          conflictedGroups: [],
          resultRevision: 1,
          canonical: { id: envelope.recordId, ...(envelope.patch ?? {}), revision: 1, field_revisions: {}, deleted_at: null },
        };
      },
    });
    cloud.setMockAuth(
      signedIn ? { id: 'home-account-owner', email: 'teacher@example.test' } : null,
      signedIn ? { access_token: 'test-only' } : null,
    );
    await db.clearStore('outbox');
    await window.store.patchProfile({ teacherName: name }, { queue: false });
    if (signedIn && ['pending', 'error', 'blocked', 'rejected'].includes(state)) {
      await db.put('outbox', {
        id: `home-account-${state}`,
        protocol: 'v2',
        state: state === 'error' ? 'failed' : state,
        store: 'profile',
        recordId: 'profile',
        sequence: 1,
        patch: { teacherName: name },
      });
    }
    sync.state.status = 'idle';
    sync.state.lastSyncedAt = state === 'synced' ? Date.UTC(2026, 8, 15, 8, 30) : null;
    const summary = await sync.getSyncOperationalSummary();
    window.store.repaint();
    return summary;
  }, { signedIn, name, state });
}

async function expectNoOverflow(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

async function accountGeometry(page) {
  return page.locator('.topbar__teacher-btn--home-account').evaluate((node) => {
    const box = node.getBoundingClientRect();
    const label = node.querySelector('.topbar__account-name');
    const led = node.querySelector('.topbar__teacher-sync');
    return {
      width: box.width,
      height: box.height,
      labelNowrap: getComputedStyle(label).whiteSpace === 'nowrap',
      labelTruncated: label.scrollWidth > label.clientWidth,
      ledWidth: led?.getBoundingClientRect().width ?? 0,
      ledHeight: led?.getBoundingClientRect().height ?? 0,
    };
  });
}

test.beforeEach(async ({ page }) => {
  await mkdir(output, { recursive: true });
  await page.goto('/#/');
  await page.waitForFunction(() => window.store?.state?.ready && window.__syncModule);
});

test('real Mobile Home binds the compact signed-in account button to authoritative Sync states', async ({ page, context }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.setViewportSize({ width: 390, height: 844 });

  for (const state of ['synced', 'pending', 'error', 'blocked', 'rejected']) {
    const summary = await seedHeader(page, { state });
    expect(summary.state).toBe(state);
    const button = page.locator('.topbar__teacher-btn--home-account');
    await expect(button).toContainText('عبدالله');
    await expect(button).toHaveAttribute('aria-label', new RegExp(stateText[state]));
    await expect(button.locator('.topbar__teacher-sync')).toHaveClass(new RegExp(`sync-dot--${state}`));
    const geometry = await accountGeometry(page);
    expect(geometry).toMatchObject({ height: 48, labelNowrap: true, labelTruncated: false, ledWidth: 8, ledHeight: 8 });
    await expectNoOverflow(page);
    if (['synced', 'pending', 'error'].includes(state)) {
      await page.screenshot({ path: `${output}/${state}-390-light.png`, animations: 'disabled' });
    }
  }

  await context.setOffline(true);
  const offline = await seedHeader(page, { state: 'offline' });
  expect(offline.state).toBe('offline');
  await expect(page.locator('.topbar__teacher-btn--home-account')).toHaveAttribute('aria-label', /غير متصل/);
  await expect(page.locator('.topbar__teacher-sync')).toHaveClass(/sync-dot--offline/);
  await page.screenshot({ path: `${output}/offline-390-light.png`, animations: 'disabled' });
  await context.setOffline(false);

  await page.locator('.topbar__teacher-btn--home-account').click();
  await expect(page.locator('.mini-hub-sheet')).toBeVisible();
  await page.getByRole('button', { name: 'إغلاق', exact: true }).last().click();
  expect(errors).toEqual([]);
});

test('signed-out and no-name states keep the existing Teacher Center action without a Sync LED', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedHeader(page, { signedIn: false, name: 'عبدالله', state: 'synced' });
  const button = page.locator('.topbar__teacher-btn--home-account');
  await expect(button.locator('.topbar__account-name')).toHaveText('تسجيل الدخول');
  await expect(button.locator('.topbar__teacher-sync')).toHaveCount(0);
  expect((await accountGeometry(page)).height).toBe(48);
  await page.screenshot({ path: `${output}/signed-out-390-light.png`, animations: 'disabled' });
  await button.click();
  await expect(page.locator('.mini-hub-sheet')).toBeVisible();
  await expect(page.locator('[data-act="mini-hub-login"]')).toBeVisible();
  await page.getByRole('button', { name: 'إغلاق', exact: true }).last().click();

  await seedHeader(page, { signedIn: true, name: '', state: 'synced' });
  await expect(button.locator('.topbar__account-name')).toHaveText('إكمال الحساب');
  await expect(button.locator('.topbar__teacher-sync')).toHaveCount(1);
  await expect(button).toHaveAttribute('aria-label', /إكمال الحساب، متزامن/);
  await page.screenshot({ path: `${output}/no-name-390-light.png`, animations: 'disabled' });
});

test('mobile widths, themes, long names and retained shortcuts remain stable', async ({ page }) => {
  const longName = 'عبدالله محمد عبدالرحمن القحطاني';
  for (const theme of ['light', 'dark']) {
    await page.evaluate(async theme => {
      await window.store.patchDevice({ theme }, { queue: false });
      window.store.applyTheme();
    }, theme);
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    for (const width of widths) {
      await page.setViewportSize({ width, height: 844 });
      await seedHeader(page, { signedIn: true, name: longName, state: 'synced' });
      const geometry = await accountGeometry(page);
      expect(geometry.height).toBe(48);
      expect(geometry.labelNowrap).toBe(true);
      expect(geometry.labelTruncated).toBe(true);
      expect(geometry.ledWidth).toBe(8);
      await expect(page.locator('.mobile-brand')).toBeVisible();
      expect((await page.locator('.mobile-brand img:visible').boundingBox()).width)
        .toBeCloseTo(Math.min(220, Math.max(199, width * .225 + 127)), 1);
      await expect(page.locator('.topbar__teacher-btn--home-account')).toBeVisible();
      expect(await page.locator('.topbar').evaluate(node => {
        const brand = node.querySelector('.mobile-brand').getBoundingClientRect();
        const account = node.querySelector('.topbar__teacher-btn--home-account').getBoundingClientRect();
        return brand.right <= account.left || account.right <= brand.left;
      })).toBe(true);
      await expect(page.locator('.home-shortcuts .tile')).toHaveCount(4);
      await expectNoOverflow(page);
      if (width === 320 && theme === 'light') {
        await page.screenshot({ path: `${output}/long-name-320-light.png`, animations: 'disabled' });
      }
      if (width === 390 && theme === 'dark') {
        await page.screenshot({ path: `${output}/full-home-390-dark.png`, fullPage: true, animations: 'disabled' });
      }
    }
  }
  const hrefs = await page.locator('.home-shortcuts .tile').evaluateAll(nodes => nodes.map(node => node.getAttribute('href')));
  expect(hrefs).toEqual(['#/classes', '#/schedule', '#/reports', '#/calendar']);
  expect((await new AxeBuilder({ page }).include('.topbar').include('.home-shortcuts').analyze()).violations).toEqual([]);
});
