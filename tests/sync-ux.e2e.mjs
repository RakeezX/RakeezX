import { test, expect } from '@playwright/test';

const CLOUD_URL = 'https://bmekljhmepgkhywjzkdx.supabase.co/rest/v1/';

function mockCloud() {
  const tables = {};
  const calls = { get: {}, post: {} };
  let failing = false;
  return {
    tables,
    calls,
    fail(value) { failing = value; },
    async route(page) {
      await page.route(`${CLOUD_URL}*`, async (route) => {
        const request = route.request();
        const table = new URL(request.url()).pathname.split('/').pop();
        const kind = request.method() === 'GET' ? 'get' : 'post';
        calls[kind][table] = (calls[kind][table] ?? 0) + 1;
        if (failing) {
          await route.fulfill({ status: 503, json: { message: 'temporary test failure' } });
          return;
        }
        if (request.method() === 'GET') {
          await route.fulfill({ json: tables[table] ?? [] });
          return;
        }
        if (request.method() === 'POST') {
          const body = JSON.parse(request.postData() ?? '[]');
          const records = Array.isArray(body) ? body : [body];
          const rows = (tables[table] ??= []);
          for (const record of records) {
            const index = rows.findIndex((row) => row.id === record.id);
            if (index < 0) rows.push({ ...record });
            else rows[index] = { ...rows[index], ...record };
          }
          await route.fulfill({ json: [] });
          return;
        }
        await route.fulfill({ status: 200, json: [] });
      });
    },
  };
}

test('automatic sync is quiet, coalesced, resumes pending writes, and retries a temporary failure', async ({ page, context }) => {
  test.setTimeout(30_000);
  const cloud = mockCloud();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  await page.addInitScript(() => {
    localStorage.setItem('rakeezx-auth', JSON.stringify({
      access_token: 'sync-ux-test-token', user: { id: 'sync-ux-test-user' },
    }));
  });
  await cloud.route(page);
  await page.goto('/#/classes');
  await page.waitForFunction(() => window.store?.state?.ready && window.__syncModule?.state.status === 'synced');

  // Nearby writes share the 900ms automatic-sync window rather than starting a storm.
  const beforeWrites = cloud.calls.get.years ?? 0;
  await page.evaluate(async () => {
    await window.store.save({ years: [
      { id: 'sync-ux:year:a', label: 'أ', hijriStart: 1450, hijriEnd: 1451, status: 'active' },
    ] });
    await window.store.save({ years: [
      { id: 'sync-ux:year:b', label: 'ب', hijriStart: 1451, hijriEnd: 1452, status: 'active' },
    ] });
  });
  await page.waitForFunction(() => window.__syncModule.state.status === 'synced' &&
    window.store.state.years.some((item) => item.id === 'sync-ux:year:b'));
  expect((cloud.calls.get.years ?? 0) - beforeWrites).toBe(1);
  expect(cloud.tables.years.map((item) => item.id)).toEqual(expect.arrayContaining(['sync-ux:year:a', 'sync-ux:year:b']));

  // Offline writes remain local; the online event resumes them automatically.
  await context.setOffline(true);
  await page.evaluate(() => window.store.save({ years: [{
    id: 'sync-ux:year:offline', label: 'دون اتصال', hijriStart: 1452, hijriEnd: 1453, status: 'active',
  }] }));
  await page.waitForFunction(() => window.__syncModule.state.status === 'offline');
  // The development shell is not precached; restore transport before reloading
  // so this test exercises IndexedDB/outbox persistence rather than asset cache.
  await context.setOffline(false);
  await page.reload();
  await page.waitForFunction(() => window.store?.state?.ready === true && window.__syncModule);
  await expect.poll(() => page.evaluate(() => window.store.state.years.some((item) => item.id === 'sync-ux:year:offline'))).toBe(true);
  await page.waitForFunction(() => window.__syncModule.state.status === 'synced' &&
    window.store.state.years.some((item) => item.id === 'sync-ux:year:offline'));
  expect(cloud.tables.years.some((item) => item.id === 'sync-ux:year:offline')).toBe(true);

  // A failed upload keeps the outbox pending and the bounded automatic retry succeeds later.
  cloud.fail(true);
  const beforeFailure = cloud.calls.get.years ?? 0;
  await page.evaluate(() => window.store.save({ years: [{
    id: 'sync-ux:year:retry', label: 'إعادة', hijriStart: 1453, hijriEnd: 1454, status: 'active',
  }] }));
  await expect.poll(() => cloud.calls.get.years ?? 0).toBeGreaterThan(beforeFailure);
  cloud.fail(false);
  await page.waitForFunction(() => window.__syncModule.state.status === 'synced', null, { timeout: 10_000 });
  await expect.poll(() => cloud.tables.years.some((item) => item.id === 'sync-ux:year:retry')).toBe(true);

  // Resume is quiet: stale state requests sync without replacing the active page.
  const stayedMounted = await page.evaluate(async () => {
    const shell = document.getElementById('main').firstElementChild;
    window.__syncModule.state.lastSyncedAt = 0;
    document.dispatchEvent(new Event('visibilitychange'));
    await new Promise((resolve) => setTimeout(resolve, 50));
    return shell.isConnected;
  });
  expect(stayedMounted).toBe(true);

  // The visible fallback still requests a full sync without a success toast.
  const beforeManual = cloud.calls.get.years ?? 0;
  await page.locator('.teacher-mini-hub-trigger').click();
  await page.locator('[data-act="mini-hub-sync-now"]').click();
  await expect.poll(() => cloud.calls.get.years ?? 0).toBeGreaterThan(beforeManual);
  await expect(page.locator('#toast')).not.toHaveClass(/is-on/);

  // A genuinely newer remote record still reaches the visible page.
  const remote = cloud.tables.years.find((item) => item.id === 'sync-ux:year:a');
  remote.label = 'تحديث سحابي';
  remote.client_updated_at = Date.now() + 10_000;
  const remoteResult = await page.evaluate(async () => {
    const shell = document.getElementById('main').firstElementChild;
    await window.__syncModule.syncAll({ full: true });
    await new Promise((resolve) => setTimeout(resolve, 50));
    return {
      rendered: !shell.isConnected,
      label: window.store.state.years.find((item) => item.id === 'sync-ux:year:a')?.label,
    };
  });
  expect(remoteResult).toEqual({ rendered: true, label: 'تحديث سحابي' });
  expect(errors.filter((message) => !message.includes('503'))).toEqual([]);
});
