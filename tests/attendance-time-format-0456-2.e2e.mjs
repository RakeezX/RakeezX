import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

test.use({ serviceWorkers: 'block', timezoneId: 'Asia/Riyadh' });

let server;
let host;
const root = process.cwd();

test.beforeAll(async () => {
  const mime = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
  server = createServer(async (request, response) => {
    const url = new URL(request.url, 'http://local');
    const file = path.resolve(root, url.pathname === '/' ? 'index.html' : url.pathname.slice(1));
    if (!file.startsWith(root + path.sep)) return response.writeHead(403).end();
    try {
      if (!(await stat(file)).isFile()) throw new Error('not a file');
      response.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
      response.end(await readFile(file));
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  host = `http://127.0.0.1:${server.address().port}`;
});

test.afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

test('Demo Home and Sessions classify second-format ended periods without changing persisted records', async ({ page }) => {
  const errors = [];
  const productRequests = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.context().route('https://xlrubcwjqktzzunrvuns.supabase.co/**', (route) => {
    productRequests.push(route.request().url());
    return route.abort();
  });
  // Keep the real Demo boot and store, with a bounded synthetic roster.
  await page.context().route('**/src/lib/demo-workspace.js', async (route) => {
    const response = await route.fetch();
    return route.fulfill({ response, body: (await response.text()).replace(
      /const CLASS_PLAN = Object.freeze\(\[[\s\S]*?\]\);/,
      "const CLASS_PLAN = Object.freeze([{grade:4,label:1,students:1,slots:[[0,1]]}]);",
    ) });
  });
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('rakeezx-demo-session-v1')) sessionStorage.setItem('rakeezx-demo-session-v1', 'preparing');
  });
  await page.clock.setFixedTime(new Date('2026-09-09T09:33:00+03:00'));
  await page.goto(host + '/#/');
  await expect(page.getByRole('button', { name: /الخروج من التجربة/ })).toBeVisible();

  const ids = await page.evaluate(async () => {
    const store = await import('/src/store.js');
    const section = await store.createSection({ grade: 5, label: 'وقت', name: 'فصل الوقت' });
    const teaching = await store.createTeaching({ sectionId: section.id, subjectId: store.subjects()[0].id });
    const first = await store.addStudent(section.id, 'طالب اصطناعي أول');
    await store.addStudent(section.id, 'طالب اصطناعي ثان');
    await store.addSlot(teaching.id, 3, 8);
    const ids = { teaching: teaching.id };
    for (const [kind, period, startTime, endTime] of [
      ['completed', 1, '06:30:00', '07:00:00'],
      ['partial', 3, '07:15:00', '08:01:00'],
      ['pending', 4, '08:02:00', '08:30:00.250'],
      ['future', 8, '20:00:00', '20:45:00'],
    ]) ids[kind] = (await store.ensureSession(teaching.id, '2026-09-09', period, { startTime, endTime })).id;
    await store.fillAttendance(ids.completed, 'present');
    await store.setAttendance(ids.partial, first.id, 'present');
    return ids;
  });
  await page.goto(host + '/#/');
  await page.waitForFunction(async ids => {
    const store = await import('/src/store.js');
    return store.state.ready && ['completed', 'partial', 'pending', 'future'].every(kind => store.getSession(ids[kind]));
  }, ids);
  const row = (kind) => page.locator(`.home-session-row[data-session-id="${ids[kind]}"]`);
  const snapshot = () => page.evaluate(async (ids) => {
    const db = await import('/src/lib/db.js');
    const store = await import('/src/store.js');
    return {
      sessions: ['completed', 'partial', 'pending', 'future'].map((kind) => store.getSession(ids[kind])),
      attendance: (await db.getAll('attendance')).filter((item) => Object.values(ids).includes(item.sessionId)).sort((a, b) => a.id.localeCompare(b.id)),
      productOutbox: await db.getAll('outbox'),
    };
  }, ids);
  const before = await snapshot();
  expect(before.productOutbox).toEqual([]);

  for (const observedAt of ['09:33:00', '19:25:00']) {
    await page.clock.setFixedTime(new Date(`2026-09-09T${observedAt}+03:00`));
    await page.reload();
    await expect(page.locator('.today-focus')).toHaveAttribute('data-session-id', ids.pending);
    await expect(page.locator('.today-focus')).toContainText('رصد حضور معلّق');
    await expect(row('partial')).toContainText('رصد الحضور غير مكتمل');
    await expect(row('partial')).toContainText('1/2 مرصود');
    await expect(row('completed')).toContainText('تم رصد الحضور');
    await expect(row('future')).toContainText('قادمة');
    await expect(page.locator('.home-sessions .badge--warn')).toContainText('بانتظار الرصد 1');
  }

  await row('partial').click();
  await expect(page.getByRole('status', { name: 'حالة الرصد: غير مكتمل' })).toBeVisible();
  await page.goto(host + `/#/teaching/${ids.teaching}/sessions`);
  await expect(page.getByText('لم يُرصد الحضور', { exact: true }).first()).toBeVisible();
  expect(await snapshot()).toEqual(before);
  expect(productRequests).toEqual([]);
  expect(errors).toEqual([]);
});
