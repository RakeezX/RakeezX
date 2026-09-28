import { test, expect, chromium, webkit } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { SUPABASE_URL } from '../src/lib/cloud.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PREVIEW = process.env.N37_PREVIEW_URL;
if (PREVIEW && !/^https:\/\/[a-z0-9-]+\.rakeezx\.pages\.dev\/?$/.test(PREVIEW)) throw new Error('N37 smoke requires an isolated Pages Preview URL');
const MIME = {
  '.css': 'text/css', '.html': 'text/html', '.js': 'text/javascript',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json',
  '.png': 'image/png', '.ico': 'image/x-icon',
};
let host;

test.beforeAll(async () => {
  const server = http.createServer(async (request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    const file = path.resolve(ROOT, relative);
    if (!file.startsWith(ROOT + path.sep)) return response.writeHead(403).end();
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
  host = { server, url: `http://127.0.0.1:${server.address().port}` };
});

test.afterAll(async () => {
  await new Promise((resolve, reject) => host.server.close((error) => error ? reject(error) : resolve()));
});

async function openFirstRun(page) {
  await page.route(`${SUPABASE_URL}/auth/v1/**`, (route) => route.fulfill({ status: 204 }));
  await page.route(`${SUPABASE_URL}/rest/v1/**`, (route) => route.fulfill({ json: [] }));
  await page.goto(`${PREVIEW || host.url}/#/`);
  return page.locator('[data-workspace-gate]');
}

const benefits = [
  ['كل شغلك في مكان واحد', 'فصولك وطلابك وجدولك كلها قدامك، مرتبة وواضحة.'],
  ['رصد أسرع وأسهل', 'حضور طلابك ودرجاتهم مرتبة مع كل فصل، وتوصل لها بسرعة وقت الرصد.'],
  ['تلقى المعلومة وقت ما تحتاجها', 'كشوف وتقارير وسجل الطالب، مرتبة وسهلة الوصول.'],
  ['يومك مرتب', 'حصصك ومواعيدك قدامك، مرتبة في الجدول والتقويم الدراسي.'],
];
const continuity = [
  ['شغلك ما يوقف', 'حتى بدون اتصال'],
  ['كل شيء يتحدّث ويتزامن', 'تلقائيًا عند رجوع الإنترنت'],
  ['مساحتك معك', 'من أي جهاز بعد تسجيل الدخول'],
];
for (const [engine, launcher] of Object.entries({ chromium, webkit })) {
  for (const [width, height] of [[1920,1080],[1440,900],[1366,768],[1024,768],[768,1024],[390,844],[320,740]]) {
    test(`${engine} N37 copy, fidelity, inert rendering ${width}x${height}`, async ({}, info) => {
      const browser = await launcher.launch();
      try {
        for (const theme of ['light', 'dark']) {
          const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block', reducedMotion: 'reduce' });
          try {
            const page = await context.newPage();
            const errors = [], writes = [];
            page.on('pageerror', e => errors.push(e.message));
            page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
            page.on('request', r => { if (r.url().startsWith(SUPABASE_URL) && !['GET','HEAD'].includes(r.method())) writes.push(r.url()); });
            const gate = await openFirstRun(page);
            await expect(gate.locator('h1')).toHaveText('لأن وقتك للتعليم، مو للتنقّل بين الأدوات.');
            await page.evaluate(t => document.documentElement.dataset.theme = t, theme);
            await expect(gate.locator('.n37-identity > span:last-child')).toHaveText('ركيزة المعلم الرقمية');
            await expect(gate.locator('.n37-message p')).toHaveText('ركيز يجمع فصولك وطلابك وحضورك ودرجاتك وتقاريرك في مكان واحد.');
            for (let i=0; i<4; i++) {
              const article = gate.locator('.n37-benefits article').nth(i);
              await expect(article.locator('h2')).toHaveText(benefits[i][0]);
              await expect(article.locator('p')).toHaveText(benefits[i][1]);
              await expect(article.locator('svg')).toHaveCount(1);
            }
            for (let i=0; i<3; i++) {
              const item = gate.locator('.n37-continuity__item').nth(i);
              await expect(item.locator('strong')).toHaveText(continuity[i][0]);
              await expect(item.locator('div > span')).toHaveText(continuity[i][1]);
              await expect(item.locator('svg')).toHaveCount(1);
            }
            await expect(gate.locator('[data-workspace-login] strong')).toHaveText('ابدأ مع ركيز المعلم');
            await expect(gate.locator('[data-workspace-login] span')).toHaveText('إنشاء حساب أو تسجيل الدخول');
            await expect(gate.locator('[data-workspace-demo] strong')).toHaveText('جرّب ركيز المعلم');
            await expect(gate.locator('[data-workspace-demo] span')).toHaveText('استكشف ركيز بنفسك، بدون حساب');
            await expect(gate.locator(`.brand-lockup__image--${theme}`)).toBeVisible();
            expect(await gate.locator(`.brand-lockup__image--${theme}`).evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
            await expect(gate.locator('.n37-atmosphere')).toHaveAttribute('aria-hidden', 'true');
            await expect(gate.locator('.n37-atmosphere')).toHaveCSS('pointer-events','none');
            expect(await gate.evaluate(e => ['::before','::after'].map(p => getComputedStyle(e,p).content))).toEqual(['none','none']);
            const geometry = await page.evaluate(async () => {
              const registry = await new Promise((resolve,reject) => { const r=indexedDB.open('rakeezx-workspace-registry'); r.onsuccess=()=>resolve(r.result); r.onerror=()=>reject(r.error); });
              const workspaceCount = await new Promise((resolve,reject) => { const r=registry.transaction('workspaces','readonly').objectStore('workspaces').count(); r.onsuccess=()=>resolve(r.result); r.onerror=()=>reject(r.error); });
              registry.close();
              const rect = s => { const r=document.querySelector(s).getBoundingClientRect(); return { x:r.x,y:r.y,bottom:r.bottom,width:r.width,height:r.height }; };
              return { width:innerWidth, height:innerHeight, scrollWidth:document.documentElement.scrollWidth, scrollHeight:document.documentElement.scrollHeight,
                direction:getComputedStyle(document.querySelector('main')).direction,
                identity:rect('.n37-identity'), message:rect('.n37-message'), actions:rect('.n37-actions'), benefits:rect('.n37-benefits'), continuity:rect('.n37-continuity'),
                articles:[...document.querySelectorAll('.n37-benefits article')].map(a=>a.getBoundingClientRect().x),
                databases:(await indexedDB.databases()).map(d=>d.name), workspaceCount, ready:window.store?.state?.ready === true };
            });
            expect(geometry.direction).toBe('rtl');
            expect(geometry.scrollWidth).toBe(width);
            expect(geometry.databases).toEqual(['rakeezx-workspace-registry']);
            expect(geometry.workspaceCount).toBe(0);
            expect(geometry.ready).toBe(false);
            if (width >= 1000) {
              expect(geometry.scrollHeight).toBe(height);
              expect(geometry.continuity.bottom).toBeLessThanOrEqual(height);
              for(let i=1;i<4;i++) expect(geometry.articles[i]).toBeLessThan(geometry.articles[i-1]);
              await expect(gate.locator('.n37-ring')).toBeVisible();
            } else {
              await expect(gate.locator('.n37-ring')).toBeHidden();
              for(const [a,b] of [['identity','message'],['message','actions'],['actions','benefits'],['benefits','continuity']]) expect(geometry[a].bottom).toBeLessThanOrEqual(geometry[b].y);
              expect(await gate.locator('main').evaluate(m => [...m.children].filter(e=>!e.matches('.n37-atmosphere')).map(e=>e.className))).toEqual(['n37-identity','n37-message','n37-actions','n37-benefits','n37-continuity']);
              if(width<=390) { expect(geometry.scrollHeight).toBeGreaterThan(height); expect(geometry.scrollHeight).toBeLessThan(width===390?1200:1230); }
            }
            expect(writes).toEqual([]);
            expect(errors).toEqual([]);
            if(width===1440 || width===390) expect((await new AxeBuilder({page}).include('[data-workspace-gate]').analyze()).violations).toEqual([]);
            await page.screenshot({path:info.outputPath(`${theme}.png`),fullPage:true});
            await info.attach(`${theme}-geometry`,{body:JSON.stringify(geometry,null,2),contentType:'application/json'});
          } finally { await context.close(); }
        }
      } finally { await browser.close(); }
    });
  }
  test(`${engine} N37 keyboard opens the unchanged real OTP sheet`, async () => {
    const browser = await launcher.launch();
    try {
      const page = await browser.newPage();
      await openFirstRun(page);
      const login=page.locator('[data-workspace-login]');
      await login.focus();
      await expect(login).toBeFocused();
      await expect(login).toHaveCSS('outline-style','solid');
      await page.keyboard.press('Enter');
      await expect(page.locator('.sheet-backdrop [role=dialog]')).toBeVisible();
      await expect(page.locator('input[name=email]')).toBeVisible();
      await expect(page.locator('input[name=email]')).toHaveAttribute('type','email');
      await expect(page.locator('.sheet-backdrop .n37-landing')).toHaveCount(0);
    } finally { await browser.close(); }
  });
}

