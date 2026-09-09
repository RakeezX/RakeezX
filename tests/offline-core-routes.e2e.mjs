import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';

test('unvisited core routes and dependencies open offline from the installed shell', async ({ browser }) => {
  const root = process.cwd();
  const server = http.createServer(async (req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    if (pathname === '/cache-bootstrap') {
      return res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end('<!doctype html><title>cache bootstrap</title>');
    }
    const file = path.resolve(root, pathname === '/' ? 'index.html' : pathname.slice(1));
    if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
    try {
      const content = await readFile(file);
      const type = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' }[path.extname(file)] ?? 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': type }).end(content);
    } catch { res.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const base = `http://127.0.0.1:${server.address().port}`;
    await page.goto(base + '/cache-bootstrap');
    await page.evaluate(() => caches.open('rakeezx-v7'));
    await page.goto(base + '/#/classes');
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForFunction(async () => {
      if ((await caches.keys()).includes('rakeezx-v7')) return false;
      const cache = await caches.open('rakeezx-v9');
      return (await Promise.all(['src/lib/sync-v2.js', 'src/lib/avatar.js', 'src/lib/report-print.js', 'src/views/archive.js', 'src/views/execution-report.js', 'src/views/class-rules.js'].map(p => cache.match(new URL(p, location.href))))).every(Boolean);
    });
    await page.evaluate(async () => {
      const store = await import('/src/store.js');
      const section = await store.createSection({ grade: 4, label: 'TEST' });
      const teaching = await store.createTeaching({ sectionId: section.id, subjectId: store.subjects()[0].id });
      window.testTeaching = teaching.id;
    });
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    const teaching = await page.evaluate(() => window.testTeaching);
    await context.setOffline(true);
    for (const route of [`/teaching/${teaching}/students`, '/archive', '/reports/execution']) {
      await page.goto(base + '/#' + route);
      await expect(page.locator('.topbar__title')).toBeVisible();
      await expect(page.locator('#toast')).not.toHaveText('تعذّر فتح هذه الشاشة');
      if (route.endsWith('/students')) {
        await page.locator('[data-act="add"]').first().click();
        await expect(page.getByRole('dialog')).toBeVisible();
        await page.locator('[data-sheet-close]').first().click();
      }
    }
    expect(errors).toEqual([]);
  } finally {
    await context.close();
    await new Promise(resolve => server.close(resolve));
  }
});
