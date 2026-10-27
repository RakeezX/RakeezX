/** AI-authored: HTTP host mounts the actual dormant component, not a lookalike. */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../../', import.meta.url));
export async function start() {
  const server = createServer(async (req, res) => {
    try {
      const u = new URL(req.url, 'http://127.0.0.1');
      if (req.method !== 'GET') throw Error('read_only');
      res.setHeader('cache-control', 'no-store');
      if (u.pathname === '/') {
        res.setHeader('content-type', 'text/html; charset=utf-8');
        return res.end('<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>N88 — مراجعة محلية خاملة</title><main id="review"></main><script type="module" src="/tests/n88-content-publication-v2-20261028/mount.mjs"></script></html>');
      }
      const wanted = path.resolve(root, '.' + decodeURIComponent(u.pathname));
      if (!wanted.startsWith(path.resolve(root) + path.sep) || !/^\/(src\/(lib|vendor\/flatpickr|styles)\/|drafts\/n88-student-portal\/publication-v2-review\.inactive\.|tests\/n88-content-publication-v2-20261028\/(mount|fixture)\.mjs$)/.test(u.pathname)) throw Error('outside_fixture');
      const body = await readFile(wanted);
      res.setHeader('content-type', ({ '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css' })[path.extname(wanted)] ?? 'application/octet-stream');
      res.end(body);
    } catch { res.writeHead(404); res.end('Fixture resource unavailable'); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  return { url: `http://127.0.0.1:${server.address().port}/`, async close() { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); } };
}
