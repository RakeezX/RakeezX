import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { withIsolatedLocalBrowser } from 'file:///C:/Users/Abody/Projects/RakeezX/scripts/ops-supervisor-v4/isolated-local-browser.mjs';

// Serve the actual application, including its module graph and source CSS.
// Same static source-serving pattern as tests/n37-landing-0392.e2e.mjs.
// Vite's DEV mode enables legacy workspace bootstrap and is not a public-entry fixture.
const root = fileURLToPath(new URL('../../', import.meta.url));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain', '.xml': 'application/xml' };
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const file = resolve(root, pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, ''));
    if (!file.startsWith(resolve(root) + sep) || !(await stat(file)).isFile()) throw Error('Not a public file');
    response.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    response.end(await readFile(file));
  } catch { response.writeHead(404).end(); }
});
try {
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(15329, '127.0.0.1', resolve); });
  await withIsolatedLocalBrowser({
    taskFile: 'C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/continuous-n113-indexed-public-search-relevance-20261019.json',
    runId: 'b21c55d4-c6e8-427d-afa4-9e18749cbe57', url: 'http://127.0.0.1:15329/',
  }, async ({ createContext, url }) => {
    const context = await createContext({ viewport: { width: 1366, height: 900 } });
    const page = await context.newPage();
    await page.goto(url);
    try {
      await page.locator('[data-workspace-gate] .n37-message p').waitFor({ timeout: 15000 });
    } catch (error) {
      console.error('Actual app DOM at failure:', await page.locator('body').innerText());
      throw error;
    }
    const observed = await page.evaluate(async () => {
      const meta = key => document.querySelector(`meta[name="${key}"],meta[property="${key}"]`)?.content;
      const gate = document.querySelector('[data-workspace-gate]');
      return {
        title: document.title, description: meta('description'),
        titles: [meta('og:title'), meta('twitter:title')],
        descriptions: [meta('og:description'), meta('twitter:description')],
        canonical: document.querySelector('link[rel="canonical"]').href,
        structured: JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent),
        text: gate.innerText, visible: gate.getBoundingClientRect().height > 0 && getComputedStyle(gate).display !== 'none',
        cssLoaded: [...document.styleSheets].some(sheet => sheet.href?.includes('/src/styles/')),
        robotsMeta: [...document.querySelectorAll('meta[name="robots"],meta[name="googlebot"]')].map(m => m.content),
        robots: await (await fetch('/robots.txt')).text(), sitemap: await (await fetch('/sitemap.xml')).text(),
      };
    });
    assert.equal(observed.canonical, 'https://rakeezx.com/');
    assert.match(observed.title, /رَكيز المعلم.*إدارة الفصول والطلاب/);
    for (const word of ['المعلم', 'الفصول', 'الطلاب', 'الحضور', 'الدرجات', 'جدول الحصص', 'التقارير']) assert.ok(observed.description.includes(word), word);
    for (const title of observed.titles) assert.equal(title, observed.title);
    for (const description of observed.descriptions) assert.equal(description, observed.description);
    assert.equal(observed.structured.description, observed.description);
    assert.equal(observed.structured.name, 'رَكيز المعلم');
    assert.equal(observed.structured.url, observed.canonical);
    assert.equal(observed.visible, true);
    assert.equal(observed.cssLoaded, true);
    assert.match(observed.text, /ركيز يجمع فصولك وطلابك وحضورك ودرجاتك وتقاريرك في مكان واحد/);
    assert.match(observed.text, /جدول|الجدول/);
    assert.ok(observed.robotsMeta.every(value => !/noindex|none/i.test(value)));
    assert.match(observed.robots, /Allow: \/\s/);
    assert.match(observed.robots, /Sitemap: https:\/\/rakeezx.com\/sitemap.xml/);
    assert.deepEqual([...observed.sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(m => m[1]), ['https://rakeezx.com/']);
    // Exercise the existing public login handler without submitting credentials.
    await page.locator('[data-workspace-login]').click();
    await page.locator('input[type="email"]').waitFor({ state: 'visible' });
    console.log(JSON.stringify({ check: 'n113_truthful_indexed_public_teacher_relevance_and_private_exclusion', status: 'PASS', ...observed }, null, 2));
  });
} finally {
  await new Promise(resolve => server.close(resolve));
}
