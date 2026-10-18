/** AI: owned loopback read-only example server, no proxy, services, credentials or persistence. */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = new URL('../../../', import.meta.url);
export const graphFiles = [
  'src/views/student-portal-login.js', 'src/styles/student-portal-login.css', 'src/styles/app.css',
  'src/lib/student-portal-unified-client.js', 'src/lib/rakeez-datetime-values.js',
  'src/lib/brand.js', 'src/lib/dom.js', 'src/lib/visible-numerals.js', 'src/lib/visible-viewport.js',
  ...['light', 'dark'].flatMap(mode => ['standard', 'compact'].map(size => `assets/header-${mode}-${size}.svg`))
];
const files = new Set([...graphFiles, ...['index.html','example.mjs','projection.mjs'].map(p => 'tests/fixtures/n88-student-brand/' + p)]);
export async function startExample({ port = 18988, ttlMs = 20 * 60 * 1000 } = {}) {
  if (!Number.isInteger(ttlMs) || ttlMs < 1000 || ttlMs > 30 * 60 * 1000) throw Error('TTL must be 1s–30min');
  const server = createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store'); res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'self'; connect-src 'none'; style-src 'self' 'unsafe-inline'; img-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
    try {
      const url = new URL(req.url, 'http://127.0.0.1');
      const file = url.pathname === '/' ? 'tests/fixtures/n88-student-brand/index.html' : url.pathname.slice(1);
      if (req.method !== 'GET' || url.search || !files.has(file)) { res.writeHead(404).end(); return; }
      const type = file.split('.').pop();
      res.setHeader('Content-Type', { html:'text/html; charset=utf-8', js:'text/javascript', mjs:'text/javascript', css:'text/css', svg:'image/svg+xml' }[type]);
      res.end(await readFile(new URL(file, root)));
    } catch { res.writeHead(500).end(); }
  });
  await new Promise((done, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', done); });
  let closed = false;
  const close = async () => { if (closed) return; closed = true; clearTimeout(timer); await new Promise(done => { server.close(done); server.closeAllConnections(); }); };
  const timer = setTimeout(() => { void close(); }, ttlMs);
  return { url: `http://127.0.0.1:${server.address().port}/`, close };
}
if (process.argv[1] && fileURLToPath(import.meta.url) === fileURLToPath(new URL('file:///' + process.argv[1].replaceAll('\\', '/')))) {
  const example = await startExample();
  console.log(`Fabricated student example: ${example.url} (20-minute TTL; Ctrl+C closes owned server)`);
  for (const signal of ['SIGINT','SIGTERM']) process.once(signal, () => { void example.close(); });
}
