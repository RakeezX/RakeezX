// AI N145: affected real application route, keyboard, navigation and CSS checks only.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'vite';
import {expect} from '@playwright/test';
import {withIsolatedLocalBrowser} from '../../../scripts/ops-supervisor-v4/isolated-local-browser.mjs';
import {openReadyServedDemo} from './helpers/served-demo-readiness.mjs';

const url='http://127.0.0.1:53145';
test('N145 actual public About and Settings navigation on phone and desktop', {timeout:120000}, async()=>{
  const sw=await readFile(new URL('../sw.js',import.meta.url),'utf8');
  // Dependency proof only: isolated contexts intentionally block SW registration.
  for(const dependency of ['views/about.js','lib/brand.js','lib/build-meta.js','generated/build-meta.generated.js','lib/dom.js']) assert.ok(sw.includes(`./src/${dependency}`),dependency);
  const server=await createServer({define:{'import.meta.env.DEV':false},server:{host:'127.0.0.1',port:53145,strictPort:true,hmr:false}});
  try{
    await server.listen();
    await withIsolatedLocalBrowser({taskFile:'C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/continuous-n145-about-privacy-terms-20261030.json',runId:'05c97c2c-6b6e-45e7-a646-650ec6eea417',url,timeoutMs:110000},async({createContext})=>{
      for(const width of [320,360,1280]){
        const context=await createContext({viewport:{width,height:900},locale:'ar-SA'});
        const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
        await page.goto(url+'/#/about');
        await expect(page.locator('.about-page')).toBeVisible();
        assert.equal(await page.evaluate(async()=>(await import('/src/store.js')).getActiveWorkspace()),null);
        for(const heading of ['أسئلة شائعة','شروط الاستخدام','سياسة الخصوصية','التواصل والدعم']) await expect(page.getByRole('heading',{name:heading,exact:true})).toBeVisible();
        await expect(page.locator('.about-email')).toHaveAttribute('href','mailto:support@rakeezx.com');
        const version=await page.evaluate(async()=>(await import('/src/lib/build-meta.js')).BUILD_META.appVersion);
        await expect(page.locator('[data-about-version]')).toContainText(version);
        await expect(page.locator('time')).toHaveAttribute('datetime','2026-10-30');
        const privacy=page.locator('#about-privacy');
        for(const fact of ['مقدمي خدمات الاستضافة والسحابة','النسخ الاحتياطية','التصحيح','الحذف']) await expect(privacy).toContainText(fact);
        const jump=page.getByRole('button',{name:'سياسة الخصوصية',exact:true});await jump.focus();await page.keyboard.press('Enter');
        await expect(privacy).toBeFocused();await expect(page).toHaveURL(url+'/#/about');
        const question=page.getByText('هل ركيز جهة تعليمية رسمية؟',{exact:true});await question.focus();await page.keyboard.press('Enter');
        await expect(question.locator('..')).toHaveAttribute('open','');
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`overflow at ${width}`);
        await page.screenshot({path:join(tmpdir(),`n145-about-${width}.png`),fullPage:true});
        await page.getByRole('link',{name:'رجوع',exact:true}).click();
        await expect(page.locator('[data-workspace-gate]')).toBeVisible();
        // The informational exception never admits a protected route.
        await page.goto(url+'/#/classes');await expect(page.locator('[data-workspace-gate]')).toBeVisible();
        await expect(page.locator('.layout')).toHaveCount(0);
        assert.deepEqual(errors,[]);await context.close();
      }
      for(const width of [320,1280]){
        const context=await createContext({viewport:{width,height:900},locale:'ar-SA'});
        await context.addInitScript(()=>sessionStorage.setItem('rakeezx-demo-session-v1','preparing'));
        const page=await context.newPage();await openReadyServedDemo(page,url);
        await page.evaluate(async()=>{(await import('/src/router.js')).go('/settings');});
        const entry=page.locator('a.settings-destination[href="#/about"]');await expect(entry).toBeVisible();
        await entry.focus();await page.keyboard.press('Enter');
        await expect(page.locator('.about-page')).toBeVisible();
        await expect(page.locator('.sheet')).toHaveCount(0);
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`shell overflow at ${width}`);
        await page.getByRole('link',{name:'رجوع',exact:true}).click();
        await expect(page).toHaveURL(url+'/#/settings');await expect(entry).toBeVisible();
        await context.close();
      }
    });
  }finally{await server.close();}
});

