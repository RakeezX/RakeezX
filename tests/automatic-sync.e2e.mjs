import { test, expect } from '@playwright/test';

const CLOUD_URL = 'https://bmekljhmepgkhywjzkdx.supabase.co/rest/v1/';
const TABLES = ['years', 'terms', 'subjects', 'sections', 'teachings', 'students', 'enrollments', 'items', 'scores', 'time_profiles', 'slots', 'sessions', 'attendance', 'notes'];

function createCloud() {
  const tables = Object.fromEntries(TABLES.map((name) => [name, []]));
  let profile = { teacher_name: 'معلم سحابي', school_name: 'مدرسة سحابية', phone: '', client_updated_at: Date.now() - 5_000 };
  let nextProfileWrite = null;
  return {
    async route(page) {
      await page.route(`${CLOUD_URL}*`, async (route) => {
        const request = route.request();
        const table = new URL(request.url()).pathname.split('/').pop();
        if (table === 'profile') {
          if (request.method() === 'GET') return route.fulfill({ json: profile ? [profile] : [] });
          if (nextProfileWrite) {
            const gate = nextProfileWrite; nextProfileWrite = null; gate.started(); await gate.wait;
          }
          const patch = JSON.parse(request.postData() ?? '{}');
          profile = { ...profile, ...patch };
          return route.fulfill({ json: [profile] });
        }
        if (request.method() === 'GET') return route.fulfill({ json: tables[table] ?? [] });
        if (request.method() === 'POST') {
          for (const record of JSON.parse(request.postData() ?? '[]')) {
            const list = tables[table] ??= [];
            const index = list.findIndex((item) => item.id === record.id);
            if (index < 0) list.push({ ...record }); else list[index] = { ...record };
          }
          return route.fulfill({ json: [] });
        }
        return route.fulfill({ json: [] });
      });
    },
    profile: () => profile,
    holdNextProfileWrite() {
      let started; let release;
      const startedPromise = new Promise((resolve) => { started = resolve; });
      const wait = new Promise((resolve) => { release = resolve; });
      nextProfileWrite = { started, wait };
      return { started: startedPromise, release };
    },
  };
}

async function authenticated(page, cloud) {
  await page.addInitScript(() => localStorage.setItem('rakeezx-auth', JSON.stringify({
    access_token: 'auto-sync-test-token', user: { id: 'auto-sync-test-user' },
  })));
  await cloud.route(page);
}

test('automatic sync pulls on authenticated boot and pushes profile changes without controls', async ({ browser }) => {
  test.setTimeout(45_000);
  const cloud = createCloud();
  const contextA = await browser.newContext();
  const pageA = await contextA.newPage();
  await authenticated(pageA, cloud);
  await pageA.goto('/#/settings');
  await pageA.waitForFunction(() => window.store && window.__syncModule?.state.status === 'synced');
  await expect(pageA.locator('input[name="teacherName"]')).toHaveValue('معلم سحابي');

  await pageA.evaluate(() => window.store.patchProfile({ teacherName: 'معلم تلقائي A' }));
  await pageA.waitForFunction(() => window.__syncModule.state.status === 'synced' && window.store.state.profile.teacherName === 'معلم تلقائي A');
  await expect.poll(() => cloud.profile().teacher_name).toBe('معلم تلقائي A');

  const contextB = await browser.newContext();
  const pageB = await contextB.newPage();
  await authenticated(pageB, cloud);
  await pageB.goto('/#/settings');
  await pageB.waitForFunction(() => window.__syncModule?.state.status === 'synced');
  await expect(pageB.locator('input[name="teacherName"]')).toHaveValue('معلم تلقائي A');
  await expect(pageB.getByRole('button', { name: 'مزامنة الآن' })).toBeVisible();
  await expect(pageB.getByText('اختبار المزامنة')).toHaveCount(0);

  await contextA.close();
  await contextB.close();
});

test('offline profile edits remain local and automatically drain on reconnect', async ({ browser }) => {
  test.setTimeout(45_000);
  const cloud = createCloud();
  const context = await browser.newContext();
  const page = await context.newPage();
  await authenticated(page, cloud);
  await page.goto('/#/settings');
  await page.waitForFunction(() => window.__syncModule?.state.status === 'synced');

  await context.setOffline(true);
  await page.evaluate(() => window.store.patchProfile({ schoolName: 'مدرسة اختبار دون اتصال' }));
  await page.waitForFunction(() => window.__syncModule.state.status === 'offline');
  expect(await page.evaluate(async () => (await (await import('/src/lib/db.js')).getAll('outbox')).some((entry) => entry.store === 'profile'))).toBe(true);

  await context.setOffline(false);
  await page.waitForFunction(() => window.__syncModule.state.status === 'synced');
  await expect.poll(() => cloud.profile().school_name).toBe('مدرسة اختبار دون اتصال');
  expect(await page.evaluate(async () => (await (await import('/src/lib/db.js')).getAll('outbox')).some((entry) => entry.store === 'profile'))).toBe(false);
  await context.close();
});
test('a mutation during an active upload remains queued for a single follow-up pass', async ({ browser }) => {
  test.setTimeout(45_000);
  const cloud = createCloud();
  const context = await browser.newContext();
  const page = await context.newPage();
  await authenticated(page, cloud);
  await page.goto('/#/settings');
  await page.waitForFunction(() => window.__syncModule?.state.status === 'synced');

  const gate = cloud.holdNextProfileWrite();
  await page.evaluate(() => window.store.patchProfile({ teacherName: 'معلم أثناء المزامنة ١' }));
  await gate.started;
  await page.evaluate(() => window.store.patchProfile({ teacherName: 'معلم أثناء المزامنة ٢' }));
  gate.release();

  await expect.poll(() => cloud.profile().teacher_name, { timeout: 10_000 }).toBe('معلم أثناء المزامنة ٢');
  await page.waitForFunction(async () => (await (await import('/src/lib/db.js')).getAll('outbox')).every((entry) => entry.store !== 'profile'));
  expect(await page.evaluate(() => window.__syncModule.state.status)).toBe('synced');
  await context.close();
});