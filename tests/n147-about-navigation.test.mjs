// AI N147: actual app boot/router/store/CSS; disposable synthetic contexts, no remote writes.
import test from 'node:test';
import assert from 'node:assert/strict';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'vite';
import {expect} from '@playwright/test';
import {withIsolatedLocalBrowser} from '../../../scripts/ops-supervisor-v4/isolated-local-browser.mjs';
import {openReadyServedDemo} from './helpers/served-demo-readiness.mjs';

const base='http://127.0.0.1:53147';
const owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const taskId='continuous-n147-about-navigation-readme-20261030';
const runId='df93f67e-94bf-42a5-bfe0-6d27f04383d5';
const sections=['about-faq','about-terms','about-privacy','about-contact'];
async function noOverflow(page,width) {
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`overflow at ${width}`);
}
async function jumpSections(page) {
  for(const id of sections) {
    const control=page.locator(`[data-about-section="${id}"]`);
    await expect(control).toHaveAttribute('type','button');
    await control.focus();
    await page.keyboard.press(id==='about-terms'?'Space':'Enter');
    await expect(page.locator('#'+id)).toBeFocused();
    await expect(page).toHaveURL(base+'/#/about');
  }
}
async function checkpoint(page,type) {
  // Re-read owner/database/receipt in this document, including after reload.
  const result=await page.evaluate(async()=>{
    const s=await import('/src/store.js'),d=await import('/src/lib/db.js'),c=await import('/src/lib/cloud.js');
    return {ready:s.state.ready,workspace:s.getActiveWorkspace(),db:d.getActiveDatabaseName(),
      receipt:s.state.device?.accountProvisioningReceipt,authOwner:c.user?.id};
  });
  assert.equal(result.ready,true);assert.equal(result.workspace.type,type);
  await expect(page.locator('.layout')).toBeVisible();
  await expect(page.locator('.sidebar')).toHaveCount(1);
  await expect(page.locator('.about-public')).toHaveCount(0);
  if(type==='account') {
    assert.equal(result.authOwner,owner);assert.equal(result.workspace.authUserId,owner);
    assert.equal(result.db,result.workspace.databaseName);
    assert.equal(result.receipt.ownerId,owner);assert.equal(result.receipt.foundationHash,'n147-synthetic');
  } else assert.equal(result.db,'rakeezx-demo');
}
async function prepareAccount(page) {
  await page.goto(base+'/#/about');await expect(page.locator('.about-public')).toBeVisible();
  await page.evaluate(async(owner)=>{
    const w=await import('/src/lib/workspaces.js'),d=await import('/src/lib/db.js'),c=await import('/src/lib/cloud.js');
    const registry=w.createWorkspaceRegistry();
    const receipt={ownerId:owner,contractVersion:1,foundationHash:'n147-synthetic'};
    try {
      const record=await registry.registerProvisionedAccount(owner,receipt);
      d.selectDatabase(record.databaseName);
      await d.put('device',{id:'device',deviceId:'device:n147',schemaVersion:d.DB_VERSION,accountProvisioningReceipt:receipt});
    } finally {await registry.close();}
    localStorage.setItem(c.AUTH_STORAGE_KEY,JSON.stringify({access_token:'n147-synthetic-token',refresh_token:'n147-synthetic-refresh',expires_at:4102444800,user:{id:owner,email:'n147@example.test'}}));
  },owner);
  await page.goto(base+'/#/settings');await expect(page.locator('.layout')).toBeVisible();
}

test(process.env.N147_REMAINING_ONLY ? 'N147 corrected owner-reload negative and storage-failure remainder' : 'N147 ready Demo/account reload navigation, public guard and responsive actual About', {timeout:120000},async()=>{
 const server=await createServer({define:{'import.meta.env.DEV':false},server:{host:'127.0.0.1',port:53147,strictPort:true,hmr:false}});
 try {
  await server.listen();
  await withIsolatedLocalBrowser({taskFile:`C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/${taskId}.json`,runId,url:base,timeoutMs:110000},async({createContext})=>{
   for(const width of (process.env.N147_REMAINING_ONLY?[]:[320,360,1280])) {
    const context=await createContext({viewport:{width,height:900},locale:'ar-SA'});
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base+'/#/about');await expect(page.locator('.about-public')).toBeVisible();
    assert.equal(await page.evaluate(async()=>(await import('/src/store.js')).getActiveWorkspace()),null);
    await jumpSections(page);await noOverflow(page,width);
    const privacy=page.locator('#about-privacy');
    for(const fact of ['مومباي، الهند','خارج السعودية','النسخ الاحتياطية','التصحيح','الحذف','الزيارات والأداء']) await expect(privacy).toContainText(fact);
    await expect(page.locator('.about-page')).not.toContainText('Cloudflare');
    await expect(page.locator('.about-page')).not.toContainText('Umami');
    await page.reload();await expect(page.locator('.about-public')).toBeVisible();
    await page.getByRole('link',{name:'رجوع',exact:true}).click();await expect(page.locator('[data-workspace-gate]')).toBeVisible();
    await page.goto(base+'/#/classes');await expect(page.locator('[data-workspace-gate]')).toBeVisible();await expect(page.locator('.layout')).toHaveCount(0);
    assert.deepEqual(errors,[]);await context.close();
    console.log(`PASS public About, reload, keyboard sections, protected guard, width ${width}`);
   }
   for(const type of (process.env.N147_REMAINING_ONLY?['account']:['demo','account'])) for(const width of (process.env.N147_REMAINING_ONLY?[1280]:[320,360,1280])) {
    const context=await createContext({viewport:{width,height:900},locale:'ar-SA'});
    if(type==='demo') await context.addInitScript(()=>{if(!sessionStorage.getItem('rakeezx-demo-session-v1'))sessionStorage.setItem('rakeezx-demo-session-v1','preparing');});
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    if(type==='demo') {await openReadyServedDemo(page,base);await page.evaluate(async()=>(await import('/src/router.js')).go('/settings'));}
    else await prepareAccount(page);
    const entry=page.locator('a.settings-destination[href="#/about"]');await expect(entry).toBeVisible();
    await entry.focus();await page.keyboard.press('Enter');await expect(page.locator('.about-page')).toBeVisible();
    await checkpoint(page,type);await jumpSections(page);await noOverflow(page,width);
    await page.reload();await expect(page.locator('.about-page')).toBeVisible();await checkpoint(page,type);
    await jumpSections(page);await noOverflow(page,width);
    if(width===1280) await expect(page.locator('.sidebar')).toBeVisible();
    await page.screenshot({path:join(tmpdir(),`n147-${type}-${width}.png`),fullPage:true});
    await page.getByRole('link',{name:'رجوع',exact:true}).click();await expect(page).toHaveURL(base+'/#/settings');await expect(entry).toBeVisible();
    await checkpoint(page,type);assert.deepEqual(errors,[]);
    if(type==='account'&&width===1280) {
      // Another cached identity must not inherit this account's ready shell.
      await page.evaluate(async()=>{const c=await import('/src/lib/cloud.js');const session=JSON.parse(localStorage.getItem(c.AUTH_STORAGE_KEY));session.user.id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';localStorage.setItem(c.AUTH_STORAGE_KEY,JSON.stringify(session));});
      await page.goto(base+'/#/about');await page.reload();await expect(page.locator('.about-public')).toBeVisible();await expect(page.locator('.layout')).toHaveCount(0);
    }
    await context.close();console.log(`PASS ${type} shell, four sections, reload, return, width ${width}`);
   }
   const context=await createContext();const page=await context.newPage();
   await page.addInitScript(()=>{indexedDB.open=()=>{throw new Error('N147 synthetic storage unavailable');};});
   await page.goto(base+'/#/about');await expect(page.locator('.about-public')).toBeVisible();
   await page.goto(base+'/#/classes');await expect(page.getByRole('alert')).toContainText('تعذّر فتح سجلّك');await expect(page.locator('.layout')).toHaveCount(0);
   await context.close();console.log('PASS public About during storage failure; protected route stays closed');
  });
 } finally {await server.close();}
});
