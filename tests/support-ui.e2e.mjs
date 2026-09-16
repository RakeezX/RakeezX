import { test, expect } from '@playwright/test';

const TEST_ORIGIN = process.env.RAKEEZX_E2E_BASE_URL || 'http://127.0.0.1:5173';
import AxeBuilder from '@axe-core/playwright';

test.setTimeout(90_000);

const SUPPORT_ENDPOINT = '**/rest/v1/support_requests';
const SUPPORT_EMAIL = 'support@rakeezx.com';
const CONTACT_DISCLOSURE = 'سيُرفق اسم حسابك وبريده الإلكتروني لتمكين فريق الدعم من التواصل معك، إضافةً إلى معلومات تقنية عامة وآمنة، دون بيانات الطلاب أو كلمات المرور.';

async function waitForApp(page) {
  await page.waitForFunction(() => window.store?.state?.ready === true);
}

async function openSupport(page) {
  await page.goto('/#/support');
  await waitForApp(page);
  await expect(page.getByRole('heading', { name: 'كيف يمكننا مساعدتك؟' })).toBeVisible();
}

async function authenticate(page) {
  await page.evaluate(async () => {
    const cloud = await import('/src/lib/cloud.js');
    const { repaint } = await import('/src/repaint.js');
    cloud.setMockAuth(
      { id: 'support-ui-owner', email: 'teacher@example.test' },
      { access_token: 'support-ui-token', user: { id: 'support-ui-owner', email: 'teacher@example.test' } },
    );
    repaint();
  });
  await expect(page.getByText('يلزم تسجيل الدخول لإرسال طلب دعم من داخل التطبيق.')).toHaveCount(0);
}

async function expectNoOverflow(page, label) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), label).toBe(true);
}

test('Support is reachable from Teacher Center and Settings and always exposes direct email', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: TEST_ORIGIN });
  await page.goto('/');
  await waitForApp(page);

  await page.locator('[data-act="open-teacher-mini-hub"]').filter({ visible: true }).first().click();
  const centerLink = page.getByRole('link', { name: /الدعم/ }).filter({ visible: true });
  await expect(centerLink).toBeVisible();
  await centerLink.click();
  await expect(page).toHaveURL(/#\/support$/);

  const emailLink = page.getByRole('link', { name: SUPPORT_EMAIL });
  await expect(emailLink).toHaveAttribute('href', `mailto:${SUPPORT_EMAIL}`);
  const copyButton = page.getByRole('button', { name: 'نسخ البريد' });
  await expect(copyButton).toBeEnabled();
  await copyButton.click();
  await expect(page.locator('#toast')).toContainText('تم نسخ بريد الدعم');
  await expect(page.locator('.support-version-row')).toContainText('الإصدار');
  await expect(page.locator('.support-version-row')).toContainText('البناء');

  await page.goto('/#/settings');
  await waitForApp(page);
  const settingsLink = page.getByRole('link', { name: /الدعم/ });
  await expect(settingsLink).toHaveAttribute('href', '#/support');
  await settingsLink.click();
  await expect(page).toHaveURL(/#\/support$/);

  await page.evaluate(async () => {
    const cloud = await import('/src/lib/cloud.js');
    cloud.setMockAuth({ id: 'support-context-owner' }, { access_token: 'test-only' });
    const sync = await import('/src/lib/sync.js');
    sync.state.status = 'error';
    await sync.getSyncOperationalSummary();
    location.hash = '#/calendar';
  });
  await expect(page).toHaveURL(/#\/calendar$/);
  const contextualSupport = page.getByRole('link', { name: 'تحتاج مساعدة؟' });
  await expect(contextualSupport).toBeVisible();
  await expect(contextualSupport).toHaveAttribute('href', '#/support');
  await contextualSupport.click();
  await expect(page).toHaveURL(/#\/support$/);
  expect(new URL(page.url()).hash).toBe('#/support');
});

test('Support keeps direct email available while in-app submission reflects auth and offline states', async ({ page, context }) => {
  await openSupport(page);
  await expect(page.getByText('يلزم تسجيل الدخول لإرسال طلب دعم من داخل التطبيق.')).toBeVisible();
  await expect(page.getByText(CONTACT_DISCLOSURE)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'إرسال', exact: true })).toBeDisabled();
  await expect(page.getByRole('link', { name: SUPPORT_EMAIL })).toBeVisible();
  await expect(page.getByRole('link', { name: 'تحتاج مساعدة؟' })).toHaveCount(0);

  await authenticate(page);
  await context.setOffline(true);
  await expect(page.getByText('إرسال الطلب من داخل التطبيق يحتاج اتصالًا بالإنترنت.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'إرسال', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'نسخ البريد' })).toBeEnabled();
  await expect(page.getByRole('link', { name: 'تحتاج مساعدة؟' })).toHaveCount(0);
  await context.setOffline(false);
  await expect(page.getByText('إرسال الطلب من داخل التطبيق يحتاج اتصالًا بالإنترنت.')).toHaveCount(0);
});

test('Support automatically attaches only safe diagnostics to all V1 request types and hides raw failures', async ({ page }) => {
  const payloads = [];
  let failNext = false;
  await page.route(SUPPORT_ENDPOINT, async (route) => {
    payloads.push(JSON.parse(route.request().postData() ?? '{}'));
    if (failNext) {
      await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'raw-secret-server-detail' }) });
      return;
    }
    await route.fulfill({ status: 201, body: '' });
  });

  await openSupport(page);
  await authenticate(page);

  const type = page.getByLabel('نوع الطلب');
  const message = page.getByLabel('رسالتك');
  const submit = page.getByRole('button', { name: 'إرسال', exact: true });

  const disclosure = page.getByText(CONTACT_DISCLOSURE);
  await expect(disclosure).toBeVisible();
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  await page.getByRole('button', { name: 'عرض المعلومات التقنية' }).click();
  const preview = page.locator('#support-diagnostics-preview');
  await expect(preview).toBeVisible();
  const previewKeys = await preview.locator('[data-diagnostic-key]').evaluateAll((nodes) => nodes.map((node) => node.dataset.diagnosticKey));
  const allowed = new Set(['appVersion', 'buildSha', 'buildTimestamp', 'timestamp', 'timezone', 'deviceCategory', 'browser', 'browserVersion', 'mobile', 'viewport', 'pwaStandalone', 'online', 'syncState', 'pendingMutations', 'failedMutations', 'pendingCount', 'failedCount', 'blockedCount', 'rejectedCount', 'historicalConflictCount', 'actionableSyncIssue', 'lastSuccessfulSyncAt', 'routeCategory']);
  expect(previewKeys.length).toBeGreaterThan(5);
  expect(previewKeys.every((key) => allowed.has(key))).toBe(true);
  await expect(preview).not.toContainText(/طالب|فصل|رمز دخول|support-ui-token|#\/support/i);

  await expect(submit).toBeDisabled();
  await message.fill('أ');
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(page.locator('.support-result.is-success')).toContainText('تم إرسال طلبك بنجاح.');
  expect(payloads[0].type).toBe('technical');
  expect(payloads[0].message).toBe('أ');
  expect(payloads[0].diagnostics.routeCategory).toBe('support');
  for (const key of ['pendingCount', 'failedCount', 'blockedCount', 'rejectedCount', 'historicalConflictCount']) {
    expect(Number.isInteger(payloads[0].diagnostics[key]), `${key} must be a safe integer`).toBe(true);
  }
  expect(typeof payloads[0].diagnostics.actionableSyncIssue).toBe('boolean');

  await type.selectOption('suggestion');
  await expect(disclosure).toBeVisible();
  await message.fill('ن'.repeat(4000));
  await submit.click();
  await expect.poll(() => payloads.length).toBe(2);
  expect(payloads[1].type).toBe('suggestion');
  expect(payloads[1].message).toHaveLength(4000);
  expect(payloads[1].diagnostics.routeCategory).toBe('support');
  expect(JSON.stringify(payloads[1].diagnostics)).not.toMatch(/token|student|class|owner|routePath|outbox/i);

  await type.selectOption('inquiry');
  await expect(disclosure).toBeVisible();
  await message.fill('أحتاج مساعدة في استخدام الميزة.');
  failNext = true;
  await submit.click();
  await expect(page.getByRole('alert')).toContainText('تعذّر إرسال الطلب الآن');
  await expect(page.getByRole('alert')).not.toContainText('raw-secret-server-detail');
  expect(payloads.at(-1).type).toBe('inquiry');

  for (const payload of payloads) {
    expect(payload.diagnostics.routeCategory).toBe('support');
    expect(Object.keys(payload.diagnostics).every((key) => allowed.has(key))).toBe(true);
    expect(JSON.stringify(payload.diagnostics)).not.toMatch(/token|student|class|owner|routePath|outbox/i);
  }
});

test('Support remains accessible, focused, and overflow-free across responsive light/dark states', async ({ page }) => {
  const errors = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(error.message));

  await openSupport(page);
  await authenticate(page);

  for (const width of [320, 390, 412, 1280, 1440]) {
    await page.setViewportSize({ width, height: width < 600 ? 844 : 900 });
    for (const theme of ['light', 'dark']) {
      await page.evaluate((value) => document.documentElement.setAttribute('data-theme', value), theme);
      await expectNoOverflow(page, `${width}px ${theme}`);
      await expect(page.getByRole('link', { name: /إرسال بريد/ })).toBeVisible();
      if (width < 600) {
        const copyBox = await page.getByRole('button', { name: 'نسخ البريد' }).boundingBox();
        expect(copyBox?.height).toBeGreaterThanOrEqual(44);
      }
    }
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
  const accessibility = await new AxeBuilder({ page }).include('.support-page').analyze();
  expect(accessibility.violations).toEqual([]);

  await page.locator('body').click({ position: { x: 1, y: 1 } });
  await page.keyboard.press('Tab');
  await expect(page.locator(':focus-visible')).toBeVisible();
  expect(errors).toEqual([]);
});
