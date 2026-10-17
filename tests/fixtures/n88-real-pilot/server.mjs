import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { createFixture } from './fixture.mjs';
import { PRIVATE_HEADERS } from '../../../drafts/n88-student-portal/service.mjs';
export async function startPilotServer() {
  const root = resolve('.'); let fixture;
  const server = createServer(async (req, res) => {
    try {
      for (const [name, value] of Object.entries(PRIVATE_HEADERS)) res.setHeader(name, value);
      const pathname = new URL(req.url, 'http://127.0.0.1').pathname;
      if (pathname.startsWith('/api/n88/')) {
        if (req.url.includes('?')) { res.writeHead(400); res.end(); return; }
        let raw = ''; for await (const part of req) { raw += part; if (raw.length > 4096) { res.writeHead(413); res.end(); return; } }
        const result = await fixture.service({ path: pathname.slice('/api/n88'.length), method: req.method,
          headers: req.headers, body: raw ? JSON.parse(raw) : {}, sourceKey: req.socket.remoteAddress });
        res.writeHead(result.status, { ...result.headers, 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result.body)); return;
      }
      const route = ['/student', '/teacher'].includes(pathname) ? '/tests/fixtures/n88-real-pilot/index.html' : pathname === '/' ? '/index.html' : pathname;
      if (!/^\/(src\/|assets\/|drafts\/n88-student-portal\/portal.css$|drafts\/n88-student-portal\/teacher-controller.js$|tests\/fixtures\/n88-real-pilot\/(index.html|entry.js)$|index.html$|build-meta.json$)/.test(route) || route.includes('..')) throw Error('not served');
      const file = resolve(root, '.' + route);
      if (!file.startsWith(root + sep)) throw Error('not served');
      res.setHeader('Content-Type', { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' }[extname(file)] || 'application/octet-stream');
      res.end(await readFile(file));
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise((ok, fail) => { server.once('error', fail); server.listen(0, '127.0.0.1', ok); });
  const url = 'http://127.0.0.1:' + server.address().port;
  fixture = createFixture(url);
  return { url, get fixture() { return fixture; }, reset() { fixture = createFixture(url); },
    close: async () => { server.closeAllConnections(); await new Promise(ok => server.close(ok)); } };
}
