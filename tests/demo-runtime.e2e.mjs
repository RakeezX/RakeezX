import { test, expect } from '@playwright/test';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AUTH_STORAGE_KEY } from '../src/lib/cloud.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.css': 'text/css', '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.png': 'image/png' };

async function startStaticServer() {
  const server = http.createServer(async (request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    const file = path.resolve(ROOT, relative);
    if (!file.startsWith(`${ROOT}${path.sep}`)) return response.writeHead(403).end();
    try {
      if (!(await stat(file)).isFile()) throw new Error('not a file');
      response.writeHead(200, { 'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
      createReadStream(file).pipe(response);
    } catch { response.writeHead(404).end(); }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { url: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((resolve) => server.close(resolve)) };
}

test.describe('isolated Demo runtime', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('https://*.supabase.co/**', (route) => route.abort());
  });

  async function enterDemo(page) {
    const gateAction = page.getByRole('button', { name: 'جرّب ركيز', exact: true });
    if (!await gateAction.isVisible().catch(() => false)) {
      await page.getByRole('button', { name: /مركز تحكم/ }).click();
    }
    await page.getByRole('button', { name: 'جرّب ركيز', exact: true }).click();
  }

  async function freezeLocalDate(page, isoDate) {
    await page.addInitScript(({ isoDate }) => {
      const NativeDate = Date;
      const fixed = new NativeDate(`${isoDate}T09:00:00`).getTime();
      globalThis.Date = class extends NativeDate {
        constructor(...args) { super(...(args.length ? args : [fixed])); }
        static now() { return fixed; }
      };
    }, { isoDate });
  }

  const todayState = (page, date) => page.evaluate(async (date) => ({
    sessions: window.store.sessionsOn(date).map((session) => ({
      id: session.id, teachingId: session.teachingId, slotId: session.slotId, period: session.period,
    })),
    slots: window.store.allSlots().filter((slot) => !slot.deleted).map((slot) => ({
      teachingId: slot.teachingId, weekday: slot.weekday, period: slot.period,
    })),
    outbox: (await (await import('/src/lib/db.js')).getAll('outbox')).length,
  }), date);

  test('first school-day entry materializes normal today sessions before Home and remains idempotent', async ({ page }) => {
    const monday = '2026-09-21';
    await freezeLocalDate(page, monday);
    let cloudRequests = 0;
    await page.unroute('https://*.supabase.co/**');
    await page.route('https://*.supabase.co/**', (route) => { cloudRequests += 1; return route.abort(); });
    await page.goto('/');
    await enterDemo(page);
    await expect(page.locator('[data-demo-indicator]')).toBeVisible();
    await expect(page.locator('.home-sessions')).toBeVisible();

    const first = await todayState(page, monday);
    expect(first.sessions).toHaveLength(2);
    expect(first.outbox).toBe(0);
    expect(new Set(first.sessions.map((session) => session.id)).size).toBe(2);
    expect(first.sessions.every((session) => session.teachingId && session.slotId)).toBe(true);
    expect(first.slots).toHaveLength(10);
    expect(first.slots.reduce((counts, slot) => counts.set(slot.weekday, (counts.get(slot.weekday) ?? 0) + 1), new Map())).toEqual(new Map([[0, 2], [1, 2], [2, 2], [3, 2], [4, 2]]));
    expect(first.slots.reduce((counts, slot) => counts.set(slot.teachingId, (counts.get(slot.teachingId) ?? 0) + 1), new Map())).toEqual(new Map([
      ['demo:teaching:1', 2], ['demo:teaching:2', 2], ['demo:teaching:3', 2], ['demo:teaching:4', 2], ['demo:teaching:5', 2],
    ]));
    expect(new Set(first.slots.map((slot) => `${slot.weekday}:${slot.period}`)).size).toBe(10);

    await page.reload();
    await expect(page.locator('[data-demo-indicator]')).toBeVisible();
    expect((await todayState(page, monday)).sessions).toEqual(first.sessions);

    await page.goto('/#/teaching/demo:teaching:3/sessions');
    await expect(page.locator('[data-demo-indicator]')).toBeVisible();
    expect((await todayState(page, monday)).sessions).toEqual(first.sessions);
    expect(cloudRequests).toBe(0);
  });

  test('later school date materializes once while Friday creates no artificial sessions', async ({ browser }) => {
    const verifyDate = async (date, expected) => {
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.route('https://*.supabase.co/**', (route) => route.abort());
      await freezeLocalDate(page, date);
      await page.goto('/');
      await enterDemo(page);
      await expect(page.locator('[data-demo-indicator]')).toBeVisible();
      expect((await todayState(page, date)).sessions).toHaveLength(expected);
      await page.reload();
      expect((await todayState(page, date)).sessions).toHaveLength(expected);
      await context.close();
    };
    await verifyDate('2026-09-22', 2);
    await verifyDate('2026-09-25', 0);
  });

  test('enters explicitly, persists local edits without outbox, resets, and exits', async ({ page }) => {
    await page.goto('/');
    await enterDemo(page);
    await expect(page.locator('[data-demo-indicator]')).toContainText('الوضع التجريبي');
    await expect(page.getByText('معلم ركيز', { exact: true }).first()).toBeVisible();

    const initial = await page.evaluate(async () => {
      const open = indexedDB.open('rakeezx-demo', 7);
      const database = await new Promise((resolve, reject) => { open.onsuccess = () => resolve(open.result); open.onerror = () => reject(open.error); });
      const read = (store) => new Promise((resolve, reject) => {
        const request = database.transaction(store).objectStore(store).getAll();
        request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
      });
      const result = { students: (await read('students')).length, sections: (await read('sections')).length, outbox: (await read('outbox')).length };
      database.close();
      return result;
    });
    expect(initial).toEqual({ students: 115, sections: 5, outbox: 0 });

    await page.goto('/#/settings');
    await expect(page.locator('[data-demo-settings]')).toBeVisible();
    await expect(page.locator('[data-account-email]')).toHaveCount(0);
    await page.locator('input[name="teacherName"]').fill('تعديل تجريبي');
    await page.locator('input[name="teacherName"]').blur();
    await page.reload();
    await expect(page.locator('input[name="teacherName"]')).toHaveValue('تعديل تجريبي');
    expect(await page.evaluate(async () => {
      const open = indexedDB.open('rakeezx-demo', 7);
      const database = await new Promise((resolve, reject) => { open.onsuccess = () => resolve(open.result); open.onerror = () => reject(open.error); });
      const request = database.transaction('outbox').objectStore('outbox').getAll();
      const rows = await new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
      database.close(); return rows.length;
    })).toBe(0);

    await page.getByRole('button', { name: 'إعادة ضبط البيانات التجريبية', exact: true }).first().click();
    await page.locator('[data-demo-reset-confirm]').click();
    await expect(page.locator('input[name="teacherName"]')).toHaveValue('معلم ركيز');
    expect((await todayState(page, new Date().toISOString().slice(0, 10))).outbox).toBe(0);
    await page.getByRole('button', { name: 'الخروج من التجربة', exact: true }).first().click();
    await expect(page.locator('[data-demo-indicator]')).toHaveCount(0);
    await expect(page.locator('[data-demo-indicator]')).toHaveCount(0);
  });

  test('separate context has no Demo marker or Product data exposure', async ({ browser, page }) => {
    await page.goto('/');
    await enterDemo(page);
    await expect(page.locator('[data-demo-indicator]')).toBeVisible();
    const isolated = await browser.newContext();
    const other = await isolated.newPage();
    await other.route('https://*.supabase.co/**', (route) => route.abort());
    await other.goto('/');
    await other.getByRole('button', { name: /مركز تحكم/ }).click();
    await expect(other.getByRole('button', { name: 'جرّب ركيز', exact: true })).toBeVisible();
    await expect(other.locator('[data-demo-indicator]')).toHaveCount(0);
    await isolated.close();
  });

  test('representative Product routes render the seeded workspace without cloud traffic', async ({ page }) => {
    let cloudRequests = 0;
    await page.unroute('https://*.supabase.co/**');
    await page.route('https://*.supabase.co/**', (route) => { cloudRequests += 1; return route.abort(); });
    await page.goto('/');
    await enterDemo(page);
    for (const route of ['/#/classes', '/#/schedule', '/#/reports', '/#/calendar', '/#/settings', '/#/settings/backup']) {
      await page.goto(route);
      await expect(page.locator('[data-demo-indicator]')).toBeVisible();
      await expect(page.locator('.empty--error')).toHaveCount(0);
    }
    await expect(page.locator('[data-demo-cloud-unavailable]')).toBeVisible();
    expect(cloudRequests).toBe(0);
  });

  test('realistic roster, numeric sections, two-period schedule, and standard timing profiles render in Product pages', async ({ page }) => {
    await page.goto('/');
    await enterDemo(page);
    await expect(page.getByText('5 فصلاً هذا الفصل', { exact: true })).toBeVisible();

    await page.goto('/#/classes');
    await expect(page.locator('.class-card')).toHaveCount(5);
    await expect(page.locator('.class-card__title')).toHaveText([
      'الرابع الابتدائي / 1', 'الرابع الابتدائي / 2', 'الخامس الابتدائي / 1',
      'الخامس الابتدائي / 2', 'السادس الابتدائي / 1',
    ]);
    await expect(page.locator('.class-card__count')).toHaveText(['23 طالبًا', '25 طالبًا', '21 طالبًا', '24 طالبًا', '22 طالبًا']);

    await page.goto('/#/teaching/demo:teaching:1/students');
    await expect(page.locator('.roster-row')).toHaveCount(23);
    const names = (await page.locator('.roster-row .row__title').allTextContents()).map((name) => name.trim());
    expect(new Set(names).size).toBe(23);
    expect(new Set(names.map((name) => name.split(' ').at(-1))).size).toBeGreaterThanOrEqual(15);

    await page.goto('/#/schedule');
    await expect(page.locator('.slot')).toHaveCount(10);

    await page.goto('/#/schedule/times');
    await expect(page.locator('.timing-profile-card__name')).toHaveText([
      'التوقيت الصيفي', 'التوقيت الشتوي', 'توقيت رمضان', 'التوقيت المدمج',
    ]);
    await expect(page.getByText('التوقيت التجريبي', { exact: true })).toHaveCount(0);
  });

  test('same-profile tabs share Demo persistence while another browser context stays isolated', async ({ page }) => {
    await page.goto('/');
    await enterDemo(page);
    const second = await page.context().newPage();
    await second.route('https://*.supabase.co/**', (route) => route.abort());
    await second.goto('/#/settings');
    await expect(second.locator('[data-demo-indicator]')).toBeVisible();
    await page.goto('/#/settings');
    await page.locator('input[name="schoolName"]').fill('مدرسة متعددة التبويبات');
    await page.locator('input[name="schoolName"]').blur();
    await second.reload();
    await expect(second.locator('input[name="schoolName"]')).toHaveValue('مدرسة متعددة التبويبات');
    await second.close();
  });

  test('Demo reloads offline after online initialization', async ({ page, context }) => {
    const server = await startStaticServer();
    const failures = [];
    page.on('pageerror', (error) => failures.push(`page:${error.message}`));
    page.on('requestfailed', (request) => failures.push(`request:${request.url()}:${request.failure()?.errorText}`));
    try {
      await page.goto(server.url);
      await enterDemo(page);
      await expect(page.locator('[data-demo-indicator]')).toBeVisible();
      await expect.poll(() => page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())?.active), { timeout: 10_000 }).toBe(true);
      if (!await page.evaluate(() => !!navigator.serviceWorker.controller)) {
        await page.reload();
        await expect(page.locator('[data-demo-indicator]')).toBeVisible();
      }
      await context.setOffline(true);
      await page.reload();
      await expect(page.locator('[data-demo-indicator]'), failures.join('\n')).toBeVisible({ timeout: 10_000 });
      await expect(page.locator('.empty--error')).toHaveCount(0);
      await context.setOffline(false);
    } finally {
      await context.setOffline(false);
      await server.close();
    }
  });

  test('authenticated identity clears Demo activation before workspace routing', async ({ page }) => {
    await page.goto('/');
    await enterDemo(page);
    await page.evaluate(({ authKey }) => {
      localStorage.setItem(authKey, JSON.stringify({
        access_token: 'demo-replacement-token', refresh_token: 'demo-replacement-refresh', expires_at: 4_102_444_800,
        user: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', email: 'synthetic@example.test' },
      }));
    }, { authKey: AUTH_STORAGE_KEY });
    await page.reload();
    await expect(page.locator('[data-demo-indicator]')).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('rakeezx-demo-active-v1'))).toBeNull();
  });
});
