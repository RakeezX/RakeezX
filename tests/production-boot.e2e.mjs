import { test, expect } from '@playwright/test';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = {
  '.css': 'text/css', '.html': 'text/html', '.js': 'text/javascript',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
};

async function startStaticServer() {
  const server = http.createServer(async (request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    const file = path.resolve(ROOT, relative);
    if (!file.startsWith(ROOT + path.sep)) {
      response.writeHead(403).end();
      return;
    }
    try {
      const info = await stat(file);
      if (!info.isFile()) throw new Error('not a file');
      response.writeHead(200, { 'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream' });
      createReadStream(file).pipe(response);
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return { server, url: `http://127.0.0.1:${port}` };
}

async function verifyBoot(context, url) {
  const page = await context.newPage();
  const errors = [];
  const failed = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('requestfailed', (request) => failed.push(request.url()));
  await page.goto(`${url}/#/`, { waitUntil: 'networkidle' });
  const workspaceGate = page.locator('[data-workspace-gate]');
  await expect(workspaceGate).toHaveAttribute('data-workspace-code', 'WORKSPACE_NOT_READY');
  await expect(workspaceGate).toHaveAttribute('data-workspace-reason', 'workspace-not-provisioned');
  await expect(workspaceGate.getByRole('heading', { name: 'رَكيزة المعلم الرقمية', exact: true })).toBeVisible();
  await expect(workspaceGate.getByText('كل ما يحتاجه المعلم، في مكان واحد.', { exact: true })).toBeVisible();
  await expect(workspaceGate.getByRole('button', { name: 'ابدأ مع ركيز', exact: true })).toBeVisible();
  await expect(page.locator('.boot')).toHaveCount(0);
  expect(await page.evaluate(() => typeof window.store)).toBe('undefined');
  expect(failed).toEqual([]);
  expect(errors).toEqual([]);
}

test('raw static production deployment boots with and without service worker registration', async ({ browser }) => {
  const { server, url } = await startStaticServer();
  const noWorker = await browser.newContext({ serviceWorkers: 'block' });
  const normal = await browser.newContext();

  try {
    await verifyBoot(noWorker, url);
    await verifyBoot(normal, url);
    await expect.poll(() => normal.serviceWorkers().length).toBe(1);
  } finally {
    await noWorker.close();
    await normal.close();
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
