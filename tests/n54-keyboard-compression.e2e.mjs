import { test, expect, chromium, webkit } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bootSettings } from './helpers/settings-0397.mjs';

// Actual Product DOM/CSS and handlers. All remote transport is intercepted by
// bootSettings; its disposable account exists only in this fresh browser context.
const baseline = process.env.N54_EXPECT_BASELINE === '1';
// Same raw ESM HTTP serving used by first-run-ux.e2e.mjs. Vite's DEV
// anonymous workspace fallback intentionally bypasses the Production landing.
async function staticApp() {
  const root=fileURLToPath(new URL('../',import.meta.url));
  const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2','.webmanifest':'application/manifest+json'};
  const server=createServer(async(req,res)=>{
    const pathname=new URL(req.url,'http://localhost').pathname;
    const relative=pathname==='/'?'index.html':decodeURIComponent(pathname).slice(1);
    const file=path.resolve(root,relative);
    if(!file.startsWith(root) || !/^(index\.html|manifest\.webmanifest|src\/|assets\/)/.test(relative))return res.writeHead(403).end();
    try {res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'}).end(await readFile(file));}
    catch {res.writeHead(404).end();}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  return {url:`http://127.0.0.1:${server.address().port}`,close:()=>new Promise(resolve=>server.close(resolve))};
}
async function compress(page, height, top = 0) {
  await page.evaluate(({height, top}) => {
    Object.defineProperties(visualViewport, {
      height: {configurable:true, value:height},
      offsetTop: {configurable:true, value:top},
      scale: {configurable:true, value:1},
    });
    visualViewport.dispatchEvent(new Event('resize'));
  }, {height, top});
  await expect.poll(() => page.evaluate(() => parseFloat(document.documentElement.style.getPropertyValue('--visible-viewport-height')))).toBe(height);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
async function measurements(sheet) {
  return sheet.evaluate(e => {
    const m = n => {const r=n.getBoundingClientRect(),s=getComputedStyle(n);return {top:r.top,bottom:r.bottom,height:r.height,clientHeight:n.clientHeight,scrollHeight:n.scrollHeight,scrollTop:n.scrollTop,overflow:s.overflowY,fontSize:s.fontSize};};
    return {viewport:{height:visualViewport.height,top:visualViewport.offsetTop,scale:visualViewport.scale,width:innerWidth},sheet:m(e),head:m(e.querySelector('.sheet__head')),body:m(e.querySelector('.sheet__body')),foot:m(e.querySelector('.sheet__foot')),field:m(e.querySelector('input:required')),dir:document.documentElement.dir};
  });
}
async function reachable(sheet, selector) {
  const control=sheet.locator(selector);
  await control.scrollIntoViewIfNeeded();
  await readable(control);
}
async function readable(control) {
  await expect.poll(() => control.evaluate(e => {
    const r=e.getBoundingClientRect(),v=visualViewport;
    const x=r.left+r.width/2,y=r.top+r.height/2;
    return r.height>=20 && r.top>=v.offsetTop && r.bottom<=v.offsetTop+v.height && e.contains(document.elementFromPoint(x,y));
  })).toBe(true);
}
async function captureViewport(page, info, name) {
  await page.screenshot({path:info.outputPath(name),clip:{x:0,y:0,width:await page.evaluate(()=>innerWidth),height:await page.evaluate(()=>visualViewport.height)}});
}
for (const [engine, launcher] of [['chromium',chromium],['webkit',webkit]]) {
  for (const width of [320,390]) test(`N54 ${engine} ${width}: compression and recovery`, async ({baseURL}, info) => {
    test.setTimeout(60000);
    const browser=await launcher.launch();
    const context=await browser.newContext({baseURL,viewport:{width,height:562},hasTouch:true,locale:'ar-SA',serviceWorkers:'block'});
    const page=await context.newPage(), snapshots=[];
    try {
      const {requests}=await bootSettings(page);
      // A local synthetic signed-out state reaches the retained Mini Hub login
      // sheet without sending mail or altering a real account/workspace.
      await page.evaluate(async () => (await import('/src/lib/cloud.js')).setMockAuth(null,null));
      await page.locator('[data-act="open-teacher-mini-hub"]').filter({visible:true}).first().click();
      await page.locator('[data-act="mini-hub-login"]').click();
      const sheet=page.locator('.sheet-backdrop').last().locator('.sheet');
      const field=sheet.locator('[name=email]');
      await field.fill('synthetic@example.test');
      await field.focus();
      snapshots.push({stage:'normal',...await measurements(sheet)});
      await compress(page,227);
      const crushed=await measurements(sheet); snapshots.push({stage:'compressed',...crushed});
      await captureViewport(page,info,baseline?'before.png':'after-focused.png');
      if (baseline) {
        expect(crushed.sheet.height).toBeLessThanOrEqual(215);
        expect(crushed.body.clientHeight).toBeLessThan(80);
        expect(crushed.body.overflow).toBe('auto');
        expect(crushed.head.height+crushed.foot.height).toBeGreaterThan(crushed.body.clientHeight);
      } else {
        expect(crushed.sheet.overflow).toBe('auto');
        expect(crushed.body.overflow).toBe('visible');
        expect(crushed.body.height).toBeGreaterThan(80);
        expect(crushed.dir).toBe('rtl');
        await expect(field).toBeFocused();
        await readable(field); // automatic reveal, before any test scrolling
        expect(parseFloat(crushed.field.fontSize)).toBeGreaterThanOrEqual(16);
        expect(crushed.field.height).toBeGreaterThanOrEqual(44);
        await reachable(sheet,'[name=email]');
        await reachable(sheet,'[data-email-otp-email-step] .field__label');
        await reachable(sheet,'[form="mini-hub-login-form"]');
        await captureViewport(page,info,'after-action.png');
        await reachable(sheet,'.sheet__head [data-sheet-close]');
        for(let cycle=0;cycle<3;cycle++) {
          await field.blur(); await compress(page,562);
          await expect.poll(() => sheet.evaluate(e=>e.classList.contains('sheet--page'))).toBe(false);
          await field.focus(); await compress(page,227,cycle===1?35:0);
          await expect(field).toBeFocused(); await readable(field);
          await expect(field).toHaveValue('synthetic@example.test');
          await reachable(sheet,'[form="mini-hub-login-form"]');
          snapshots.push({stage:`cycle-${cycle}`,...await measurements(sheet)});
        }
        await page.setViewportSize({width:844,height:390}); await compress(page,227);
        await field.focus(); await readable(field);
        await reachable(sheet,'[form="mini-hub-login-form"]');
        await page.setViewportSize({width,height:562}); await compress(page,562);
        await field.blur();
        await expect.poll(() => sheet.evaluate(e=>e.classList.contains('sheet--page'))).toBe(false);
        snapshots.push({stage:'restored',...await measurements(sheet)});
        await expect(field).toHaveValue('synthetic@example.test');
        await reachable(sheet,'.sheet__head [data-sheet-close]');
        await sheet.locator('.sheet__head [data-sheet-close]').click();
        await expect(page.locator('.sheet-backdrop')).toHaveCount(1);
        await expect(page.locator('[data-act="mini-hub-login"]')).toBeFocused();
        await page.keyboard.press('Escape');
        await expect(page.locator('.sheet-backdrop')).toHaveCount(0);
        expect(await page.locator('body').evaluate(e=>e.classList.contains('has-modal'))).toBe(false);
      }
      expect(requests.some(url=>/\/otp|\/verify|provision_account_profile/.test(url))).toBe(false);
      await writeFile(info.outputPath('measurements.json'),JSON.stringify({engine,browserVersion:browser.version(),baseline,snapshots,physicalIPhone:'NOT_RUN',realNetwork:0},null,2));
    } finally {await context.close();await browser.close();}
  });
  if (!baseline) test(`N54 ${engine}: profile email modal, mount while compressed, native resize and desktop`, async ({baseURL}, info) => {
    test.setTimeout(60000);
    const browser=await launcher.launch();
    const context=await browser.newContext({baseURL,viewport:{width:390,height:562},hasTouch:true,serviceWorkers:'block'});
    const page=await context.newPage(),snapshots=[];
    try {
      const {requests}=await bootSettings(page);
      await compress(page,227);
      await page.locator('[data-act=change-email]').focus();
      // Keyboard activation preserves an explicit opener across engines;
      // WebKit pointer activation intentionally blurs buttons before click.
      await page.locator('[data-act=change-email]').press('Enter');
      const sheet=page.locator('.sheet'),field=sheet.locator('[name=newEmail]');
      await field.fill('new-synthetic@example.test');
      await expect(sheet).toHaveClass(/sheet--page/);
      await readable(field);
      for (let cycle=0;cycle<2;cycle++) {
        await reachable(sheet,'.field__label');
        await reachable(sheet,'[form=email-change-form]');
        await reachable(sheet,'.sheet__head [data-sheet-close]');
        await field.blur();await compress(page,562);await expect(sheet).not.toHaveClass(/sheet--page/);
        expect(await sheet.evaluate(e=>e.scrollTop)).toBe(0);
        expect(await sheet.locator('.sheet__body').evaluate(e=>e.scrollTop)).toBe(0);
        await field.focus();await compress(page,227);await readable(field);
        snapshots.push({stage:`profile-cycle-${cycle}`,...await measurements(sheet)});
      }
      await captureViewport(page,info,'profile-compressed.png');
      // Restore the native browser viewport, then genuinely resize it. This is
      // separate evidence from the controlled visual-only keyboard fixture.
      await page.evaluate(() => {delete visualViewport.height;delete visualViewport.offsetTop;delete visualViewport.scale;});
      await page.setViewportSize({width:390,height:227});
      await field.focus();await readable(field);await expect(sheet).toHaveClass(/sheet--page/);
      await page.setViewportSize({width:390,height:562});await field.blur();
      await expect(sheet).not.toHaveClass(/sheet--page/);
      await expect(field).toHaveValue('new-synthetic@example.test');
      await sheet.locator('.sheet__head [data-sheet-close]').click();
      await expect(page.locator('[data-act=change-email]')).toBeFocused();
      expect(await page.locator('[data-account-email]').textContent()).toBe('teacher@example.test');
      expect(requests.some(url=>/\/otp|\/verify|provision_account_profile/.test(url))).toBe(false);
      await context.close();
      const desktop=await browser.newContext({baseURL,viewport:{width:1280,height:720},serviceWorkers:'block'});
      try {
        const p=await desktop.newPage();await bootSettings(p);
        await p.locator('[data-act=change-email]').click();
        const modal=p.locator('.sheet');
        await expect(modal).not.toHaveClass(/sheet--page/);
        const normal=await measurements(modal);snapshots.push({stage:'desktop',...normal});
        expect(normal.sheet.scrollHeight).toBe(normal.sheet.clientHeight);
        await readable(modal.locator('[name=newEmail]'));
        await readable(modal.locator('[form=email-change-form]'));
        await p.setViewportSize({width:1280,height:350});
        await expect(modal).not.toHaveClass(/sheet--page/);
        await reachable(modal,'[name=newEmail]');await reachable(modal,'[form=email-change-form]');
        await p.keyboard.press('Escape');await expect(p.locator('.sheet')).toHaveCount(0);
      } finally {await desktop.close();}
      await writeFile(info.outputPath('measurements.json'),JSON.stringify({engine,browserVersion:browser.version(),snapshots,physicalIPhone:'NOT_RUN',realNetwork:0},null,2));
    } finally {await context.close();await browser.close();}
  });
  if (!baseline) test(`N54 ${engine}: actual signed-out landing retains inline email and back`, async ({baseURL}, info) => {
    const app=await staticApp();
    const browser=await launcher.launch();
    const context=await browser.newContext({baseURL:app.url,viewport:{width:390,height:562},hasTouch:true,serviceWorkers:'block'});
    try {
      const page=await context.newPage(),remote=[];
      await context.route('https://*.supabase.co/**',route=>{remote.push(route.request().url());return route.abort();});
      await page.goto('/#/');
      await page.locator('[data-workspace-login]').click();
      await expect(page.locator('.n56-auth')).toBeVisible();
      await expect(page.locator('.sheet')).toHaveCount(0);
      await expect(page.locator('.n56-auth [name=email]')).toBeFocused();
      await page.locator('[data-n56-back]').click();
      await expect(page.locator('[data-workspace-login]')).toBeFocused();
      expect(remote).toEqual([]);
      await writeFile(info.outputPath('route.json'),JSON.stringify({engine,route:'signed-out landing -> start -> inline email -> back',reportedLandingEmailSheet:'absent on current base; reproduced retained Product Mini Hub email sheet separately',realNetwork:0},null,2));
    } finally {await context.close();await browser.close();await app.close();}
  });
}
