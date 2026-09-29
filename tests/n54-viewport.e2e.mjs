import { test, expect, chromium, webkit } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { bootSettings } from './helpers/settings-0397.mjs';
import { AUTH_STORAGE_KEY } from '../src/lib/cloud.js';

// Real Product controls, disposable storage, synthetic VisualViewport only.
// Every non-static request is fulfilled locally; never send real OTP/account data.
let host, server;
test.beforeAll(async () => {
  host = process.env.N54_PREVIEW_URL;
  if (host) {
    expect(host).toMatch(/^https:\/\/[a-z0-9-]+\.rakeezx\.pages\.dev$/);
    return;
  }
  const root = process.cwd();
  server = createServer(async (req, res) => {
    const file = path.resolve(root, new URL(req.url, 'http://localhost').pathname.slice(1) || 'index.html');
    if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
    try {
      if (!(await stat(file)).isFile()) throw Error();
      const mime = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.png': 'image/png' };
      res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' }).end(await readFile(file));
    } catch { res.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  host = `http://127.0.0.1:${server.address().port}`;
});
test.afterAll(async () => { if (server) await new Promise(resolve => server.close(resolve)); });

async function settle(page) {
  await page.evaluate(async () => {
    await Promise.all(document.getAnimations().map(animation => animation.finished.catch(() => {})));
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  });
}
async function geometry(page, selector) {
  return page.evaluate(selector => {
    const vv = visualViewport, bounds = el => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, height: r.height, left: r.left, right: r.right, scrollTop: el.scrollTop, maxScroll: el.scrollHeight - el.clientHeight };
    };
    const field = document.querySelector(selector), body = field?.closest('.sheet__body');
    const f = bounds(field), b = bounds(body), top = Math.max(vv.offsetTop, b?.top ?? -Infinity), bottom = Math.min(vv.offsetTop + vv.height, b?.bottom ?? Infinity);
    const foot = document.querySelector('.sheet__foot'), action = foot?.querySelector('.btn--primary');
    return {
      innerHeight, visual: { height: vv.height, top: vv.offsetTop, scale: vv.scale },
      cssHeight: document.documentElement.style.getPropertyValue('--visible-viewport-height'),
      sheet: bounds(document.querySelector('.sheet')), head: bounds(document.querySelector('.sheet__head')), body: b, field: f, foot: bounds(foot), action: bounds(action),
      visible: !!f && f.bottom > top && f.top < bottom,
      contained: !!f && (f.height > bottom - top ? f.top >= top - 1 && f.top < bottom : f.top >= top - 1 && f.bottom <= bottom + 1),
      font: field ? getComputedStyle(field).fontSize : null,
      active: document.activeElement?.name || document.activeElement?.tagName,
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
      locked: document.body.classList.contains('has-modal'),
    };
  }, selector);
}
async function simulate(page, height, top = 0, scale = 1, event = 'resize') {
  await page.evaluate(({ height, top, scale, event }) => {
    Object.defineProperties(visualViewport, { height: { configurable: true, value: height }, offsetTop: { configurable: true, value: top }, scale: { configurable: true, value: scale } });
    visualViewport.dispatchEvent(new Event(event));
  }, { height, top, scale, event });
  await settle(page);
}
async function visible(page, selector) {
  try { await expect.poll(async () => (await geometry(page, selector)).contained).toBe(true); }
  catch(error) { console.log('N54 failed geometry',selector,await geometry(page,selector)); throw error; }
  const g = await geometry(page, selector);
  expect(g.overflow).toBe(false);
  if (g.action) { expect(g.action.top).toBeGreaterThanOrEqual(g.visual.top - 1); expect(g.action.bottom).toBeLessThanOrEqual(g.visual.top + g.visual.height + 1); expect(g.action.height).toBeGreaterThanOrEqual(44); }
  return g;
}
async function fixture(engine, viewport) {
  const browser = await (engine === 'webkit' ? webkit : chromium).launch();
  const context = await browser.newContext({ viewport, baseURL: host, serviceWorkers: 'block', reducedMotion: 'reduce' });
  const page = await context.newPage(), errors = [], intercepted = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await context.routeWebSocket('**/*', socket => socket.close());
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin === host) return route.continue();
    intercepted.push({ path: url.pathname, method: route.request().method() });
    return route.fulfill({ json: {} });
  });
  return { browser, context, page, errors, intercepted };
}
const layouts = [[390,844],[393,852],[375,812],[360,800],[412,915],[320,740]];
for (const engine of ['chromium', 'webkit']) {
  for (const [width, height] of layouts) test(`N54 ${engine} Auth lifecycle ${width}x${height}`, async ({}, info) => {
    const f = await fixture(engine, { width, height }), { page } = f, snapshots = [];
    try {
      await page.goto('/');
      const opener = page.locator('[data-workspace-login]');
      await opener.focus();
      // WebKit pointer clicks do not retain button focus. Use keyboard entry
      // here to verify the existing opener-restoration accessibility contract.
      if(engine==='webkit') await opener.press('Enter'); else await opener.click();
      await settle(page);
      await page.locator('[name=email]').evaluate(el => el.blur()); snapshots.push({ phase:'before-focus', ...await geometry(page, '[name=email]') });
      await page.locator('[name=email]').focus(); await settle(page);
      expect((await geometry(page, '[name=email]')).font).toBe('16px');
      for (const theme of ['light','dark']) {
        await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
        for (const scale of [1,1.10,1.25]) for (const small of [520,480,430,350,300]) {
          await simulate(page, small, scale === 1 ? 0 : 80, scale);
          snapshots.push({ theme, phase:'email-shrink', ...await visible(page, '[name=email]') });
        }
      }
      await page.screenshot({ path: info.outputPath('email-zoom-short.png') });
      // Panning updates geometry but must not fight an intentional body scroll.
      await page.locator('.sheet__body').evaluate(el => el.scrollTop = el.scrollHeight);
      const scroll = await page.locator('.sheet__body').evaluate(el => el.scrollTop);
      await simulate(page,300,100,1.25,'scroll');
      expect(await page.locator('.sheet__body').evaluate(el => el.scrollTop)).toBeCloseTo(scroll,0);
      await simulate(page,height); await page.locator('[name=email]').focus();
      await page.locator('[name=email]').fill('n54@example.test');
      await page.getByRole('button',{name:'إرسال رمز التحقق',exact:true}).click();
      await expect(page.locator('[data-email-otp-code-step]')).toBeVisible();
      await simulate(page,350,100,1.25); snapshots.push({ phase:'otp', ...await visible(page,'[name=token]') });
      expect(Number.parseFloat((await geometry(page,'[name=token]')).font)).toBeGreaterThanOrEqual(23);
      await page.locator('[data-email-otp-change]').click(); await simulate(page,430,0,1.10); await visible(page,'[name=email]');
      await simulate(page,height); expect((await geometry(page,'[name=email]')).cssHeight).toBe(`${height}px`);
      expect(await page.locator('.sheet__body').evaluate(el=>el.scrollTop)).toBe(0);
      expect(await page.evaluate(()=>document.documentElement.hasAttribute('data-viewport-compressed'))).toBe(false);
      await page.keyboard.press('Escape'); await expect(opener).toBeFocused();
      expect(await page.evaluate(() => document.body.classList.contains('has-modal'))).toBe(false);
      await opener.click(); await simulate(page,430); await visible(page,'[name=email]');
      await page.keyboard.press('Tab'); expect(await page.locator('.sheet').evaluate(el => el.contains(document.activeElement))).toBe(true);
      await page.getByRole('button',{name:'إغلاق',exact:true}).click(); await simulate(page,height);
      expect(await page.evaluate(() => document.body.classList.contains('has-modal'))).toBe(false);
      expect(f.intercepted).toEqual([{path:'/auth/v1/otp',method:'POST'}]);
      expect(f.errors).toEqual([]);
    } finally { await info.attach('geometry',{body:JSON.stringify(snapshots,null,2),contentType:'application/json'}); await f.browser.close(); }
  });
  test(`N54 ${engine} required profile and desktop/tablet`, async ({}, info) => {
    const f = await fixture(engine,{width:390,height:844}), {page} = f, snapshots=[];
    try {
      const owner='44444444-4444-4444-8444-444444444444', user={id:owner,email:'n54@example.test'};
      await page.route('**/*.supabase.co/**', route => route.fulfill({json:route.request().url().includes('/auth/')?user:{ownerId:owner,profileStatus:'PENDING_PROFILE',profile:{teacherName:'',phone:'',schoolName:'',teacherForm:'masculine'},access:{grantType:'beta_full',status:'active',source:'public_beta'},provisioning:{state:'PROFILE_REQUIRED',version:1,foundationHash:null}}}));
      await page.addInitScript(({key,user}) => localStorage.setItem(key,JSON.stringify({access_token:'synthetic-n54',refresh_token:'synthetic',expires_at:4102444800,user})),{key:AUTH_STORAGE_KEY,user});
      await page.goto('/'); await page.locator('[data-account-profile-form]').waitFor();
      for (const scale of [1,1.25]) {
        await page.locator('[name=schoolName]').focus(); await simulate(page,350,80,scale); snapshots.push(await visible(page,'[name=schoolName]'));
        await page.locator('[data-account-profile-form] [type=submit]').scrollIntoViewIfNeeded();
        expect((await geometry(page,'[data-account-profile-form] [type=submit]')).visible).toBe(true);
        await simulate(page,844);
      }
      await page.evaluate(() => { delete visualViewport.height; delete visualViewport.offsetTop; delete visualViewport.scale; });
      for (const size of [{width:1440,height:900},{width:1366,height:768},{width:768,height:1024}]) {
        await page.setViewportSize(size); await settle(page);
        const action=await geometry(page,'[data-account-profile-form] [type=submit]');
        expect(action.contained).toBe(true); expect(action.overflow).toBe(false);
        expect(await page.evaluate(() => document.documentElement.hasAttribute('data-viewport-compressed'))).toBe(false);
      }
      expect(f.errors).toEqual([]);
    } finally { await info.attach('profile',{body:JSON.stringify(snapshots,null,2),contentType:'application/json'}); await f.browser.close(); }
  });
  test(`N54 ${engine} ordinary page scroll owner, no gratuitous scrolling`, async ({}) => {
    const f=await fixture(engine,{width:390,height:844}),{page}=f;
    try {
      await page.goto('/'); await page.locator('[data-workspace-login]').waitFor();
      await page.evaluate(() => {
        const app=document.querySelector('#app');
        app.innerHTML='<main style="height:844px;overflow-y:auto" id="ordinary"><div style="height:600px"></div><label>حقل<input class="input" id="lower"></label><div style="height:600px"></div></main>';
      });
      await page.locator('#lower').evaluate(el => el.focus({preventScroll:true})); await simulate(page,350,80,1.25);
      await visible(page,'#lower');
      const before=await page.locator('#ordinary').evaluate(el=>el.scrollTop);
      await page.locator('#lower').evaluate(el=>el.dispatchEvent(new FocusEvent('focusin',{bubbles:true}))); await settle(page);
      expect(await page.locator('#ordinary').evaluate(el=>el.scrollTop)).toBe(before);
      await simulate(page,844); expect(f.errors).toEqual([]);
    } finally { await f.browser.close(); }
  });
  test(`N54 ${engine} real Demo HIGH/MEDIUM sheets`, async ({}, info) => {
    const f=await fixture(engine,{width:390,height:844}),{page}=f,snapshots=[];
    try {
      // Bound the genuine Demo seed, retaining its existing handlers/isolation.
      await page.route('**/src/lib/demo-workspace.js',async route=>{
        const response=await route.fetch();
        await route.fulfill({response,body:(await response.text()).replace(/const CLASS_PLAN = Object.freeze\(\[[\s\S]*?\]\);/,'const CLASS_PLAN = Object.freeze([{grade:4,label:1,students:2,slots:[[0,1]]}]);')});
      });
      await page.addInitScript(()=>sessionStorage.setItem('rakeezx-demo-session-v1','preparing'));
      await page.goto('/'); await page.locator('[data-demo-indicator]:visible').waitFor();
      const ids=await page.evaluate(async()=>{const s=await import('/src/store.js');return {teaching:s.teachings()[0].id,student:s.students(s.teachings()[0].id)[0].id};});
      const cases=[
        // Route-specific controls wait for asynchronous view loading; a generic
        // "add" selector can still belong to the previous hash-route view.
        ['calendar','/#/calendar','button[aria-label="إضافة فترة أو استثناء"]','[name=label]'],
        ['score-item',`/#/teaching/${ids.teaching}/items`,'button[aria-label="بند جديد"]','[name=max]'],
        ['roster-paste',`/#/teaching/${ids.teaching}/students`,'[data-act=import]','#names-box'],
        ['student-note',`/#/student/${ids.student}`,'[data-act=add-note]','#student-note-text'],
        ['timing-model','/#/schedule/times','[data-act=edit-times]','input[data-key=start]'],
        ['class-create','/#/classes','button[data-act=add]:has-text("إضافة فصل")','[name=label]'],
        ['student-create',`/#/teaching/${ids.teaching}/students`,'button[aria-label="طالب جديد"]','[name=name]'],
        ['home-search','/#/','[data-act=student-search]','[data-student-query]'],
      ];
      for(const [name,url,trigger,field] of cases){
        await page.goto(url);
        if(name==='student-note') await page.locator('.student-notes-history summary').click();
        await page.locator(trigger).first().click(); await page.locator('.sheet').waitFor();
        await page.locator(field).first().evaluate(el=>el.focus({preventScroll:true}));
        for(const scale of [1,1.25]) {
          await simulate(page,350,80,scale); const selector=field;
          snapshots.push({name,...await visible(page,selector)});
          expect(Number.parseFloat((await geometry(page,selector)).font)).toBeGreaterThanOrEqual(16);
        }
        await page.getByRole('button',{name:'إغلاق',exact:true}).last().click(); await simulate(page,844);
        expect(await page.evaluate(()=>document.body.classList.contains('has-modal'))).toBe(false);
      }
      // Exercise the real dated-session editor, without saving the synthetic session.
      await page.evaluate(async id=>{const s=await import('/src/store.js');const session=await s.ensureSession(id,'2026-09-29',1,{startTime:'09:00',endTime:'09:45'});const {openSessionEditor}=await import('/src/lib/session-editor-ui.js');void openSessionEditor(session);},ids.teaching);
      await page.locator('.sheet').waitFor();
      const reason=page.locator('#ses-reason');
      await reason.evaluate(el=>el.focus({preventScroll:true})); await simulate(page,350,80,1.25);
      const selector=await reason.evaluate(el=>{el.dataset.n54Field='reason';return '[data-n54-field=reason]';});
      snapshots.push({name:'session-editor',...await visible(page,selector)});
      await page.keyboard.press('Escape'); await simulate(page,844);
      expect(f.intercepted).toEqual([]); expect(f.errors).toEqual([]);
    } finally { await info.attach('surfaces',{body:JSON.stringify(snapshots,null,2),contentType:'application/json'}); await f.browser.close(); }
  });
  test(`N54 ${engine} actual Settings, change email and Support`,async ({},info)=>{
    const f=await fixture(engine,{width:390,height:844}),{page}=f,snapshots=[];
    try {
      const mocked=await bootSettings(page);
      await page.locator('[data-settings-profile]').evaluate(el=>el.open=true);
      await page.locator('[name=phone]').evaluate(el=>el.focus({preventScroll:true}));
      await simulate(page,350,80,1.25); snapshots.push({name:'settings',...await visible(page,'[name=phone]')});
      await simulate(page,844); await page.locator('[data-act=change-email]').click();
      await simulate(page,350,80,1.25); snapshots.push({name:'change-email',...await visible(page,'[name=newEmail]')});
      await page.keyboard.press('Escape'); await simulate(page,844);
      await page.goto('/#/support'); await page.locator('[name=message]').waitFor();
      await page.locator('[name=message]').evaluate(el=>el.focus({preventScroll:true}));
      await simulate(page,430,80,1.25); snapshots.push({name:'support',...await visible(page,'[name=message]')});
      await page.locator('.support-submit').scrollIntoViewIfNeeded();
      // A user can scroll the natural document to the visible-area action.
      // Native scrollIntoView alone uses the layout viewport in this emulation.
      await page.locator('.support-submit').evaluate(el=>{const r=el.getBoundingClientRect();window.scrollBy(0,r.bottom-(visualViewport.offsetTop+visualViewport.height)+12);});
      expect((await geometry(page,'.support-submit')).visible).toBe(true);
      await simulate(page,844); expect(mocked.errors).toEqual([]); expect(f.errors).toEqual([]);
      expect(mocked.requests.every(url=>!url.includes('/auth/v1/otp')&&!url.includes('submit_support')&&!url.includes('update_account_email'))).toBe(true);
    } finally { await info.attach('ordinary-product-forms',{body:JSON.stringify(snapshots,null,2),contentType:'application/json'}); await f.browser.close(); }
  });
}
