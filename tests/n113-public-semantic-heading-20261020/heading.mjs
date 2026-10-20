import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { withIsolatedLocalBrowser } from 'file:///C:/Users/Abody/Projects/RakeezX/scripts/ops-supervisor-v4/isolated-local-browser.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const file = resolve(root, pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, ''));
    if (!file.startsWith(resolve(root) + sep) || !(await stat(file)).isFile()) throw Error('Not a source file');
    response.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    response.end(await readFile(file));
  } catch { response.writeHead(404).end(); }
});

try {
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(15331, '127.0.0.1', resolve); });
  await withIsolatedLocalBrowser({
    taskFile: 'C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/continuous-n113-current-public-semantic-heading-20261020.json',
    runId: 'ca36e715-c4c1-4ac7-995e-7076fe15dcf0', url: 'http://127.0.0.1:15331/', timeoutMs: 45000,
  }, async ({ createContext, url }) => {
    const noJs = await createContext({ viewport: { width: 1366, height: 900 } });
    const initial = await noJs.newPage();
    // Hold the actual static boot DOM in place: the normal entry module import
    // is replaced with an empty module while inline theme setup still runs.
    await initial.route('**/src/lib/app-update.js', route => route.fulfill({ status:200, contentType:'text/javascript', body:'' }));
    await initial.goto(url);
    const heading = initial.getByRole('heading', { level: 1, name: 'رَكيز المعلم' });
    await heading.waitFor();
    const boot = await initial.evaluate(() => {
      const h = document.querySelector('#app h1');
      const rect = selector => { const r = document.querySelector(selector).getBoundingClientRect(); return { x:r.x, y:r.y, width:r.width, height:r.height }; };
      return {
        h1Count: document.querySelectorAll('#app h1').length,
        headingClass: h.className,
        headingRect: { width:h.getBoundingClientRect().width, height:h.getBoundingClientRect().height },
        composition: rect('.boot__composition'), mark: rect('.boot__mark'), message: rect('.boot__msg'), progress: rect('.boot__progress'),
        layoutWithoutHeading: (() => {
          const h=document.querySelector('#app h1'); const display=h.style.display;
          h.style.display='none';
          const result=['.boot__composition','.boot__mark','.boot__msg','.boot__progress'].map(rect);
          h.style.display=display;
          return result;
        })(),
        title: document.title,
        images: [...document.querySelectorAll('.boot__mark img')].map(img => ({ alt:img.getAttribute('alt'), hidden:img.getAttribute('aria-hidden') })),
        markHidden: document.querySelector('.boot__mark').getAttribute('aria-hidden'),
        brandCssLoaded: [...document.styleSheets].some(sheet => sheet.href?.includes('/src/styles/app.css')),
      };
    });
    assert.equal(boot.h1Count, 1);
    assert.equal(boot.headingClass, 'sr-only');
    assert.deepEqual(boot.headingRect, { width: 1, height: 1 });
    assert.deepEqual(boot.images, [{ alt:'', hidden:'true' }, { alt:'', hidden:'true' }]);
    assert.equal(boot.markHidden, 'true');
    assert.equal(boot.brandCssLoaded, true);
    assert.deepEqual(boot.layoutWithoutHeading, [boot.composition,boot.mark,boot.message,boot.progress]);
    assert.ok(boot.mark.y >= boot.composition.y && boot.message.y >= boot.mark.y && boot.progress.y >= boot.message.y);
    assert.match(boot.title, /رَكيز المعلم — إدارة الفصول والطلاب والحضور والدرجات/);
    console.log(JSON.stringify({ check:'n113_public_initial_heading_accessibility_no_visual_change', status:'PASS', boot }, null, 2));
    await noJs.close();

    const appContext = await createContext({ viewport: { width: 1366, height: 900 } });
    const app = await appContext.newPage();
    await app.goto(`${url}#/`);
    await app.locator('[data-workspace-gate]').waitFor({ timeout: 15000 });
    const mounted = await app.evaluate(() => ({
      bootHeadingCount: document.querySelectorAll('#app > .boot h1').length,
      h1Count: document.querySelectorAll('#app h1').length,
      gateMounted: Boolean(document.querySelector('[data-workspace-gate]')),
      logoLabels: [...document.querySelectorAll('#app [role="img"]')].map(node => node.getAttribute('aria-label')),
    }));
    assert.equal(mounted.gateMounted, true);
    assert.equal(mounted.bootHeadingCount, 0);
    assert.ok(mounted.h1Count <= 1, `Expected no duplicate heading after boot, found ${mounted.h1Count}`);
    assert.deepEqual(mounted.logoLabels, ['رَكيز المعلم']);
    console.log(JSON.stringify({ check:'n113_current_title_and_decorative_images_preserved', status:'PASS', title:boot.title, images:boot.images, mounted }, null, 2));
    await appContext.close();
  });
} finally {
  await new Promise(resolve => server.close(resolve));
}
