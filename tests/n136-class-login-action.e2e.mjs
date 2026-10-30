// AI N136: real app DOM/handlers/CSS and real class guard; no remote account calls.
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {expect} from '@playwright/test';
import {withIsolatedLocalBrowser} from '../../../scripts/ops-supervisor-v4/isolated-local-browser.mjs';
import {openReadyServedDemo} from './helpers/served-demo-readiness.mjs';
import {n136LocalScope} from '../playwright-n135.config.mjs';

// Only the read-only Sync presentation snapshot is controlled. The store, Auth,
// owner/lease checks, shell, repaint, CSS and login handlers run unchanged.
const server=await createServer({define:{'import.meta.env.DEV':false},plugins:[{
  name:'n136-synthetic-summary',enforce:'pre',
  transform(source,id) {
    if(id.replaceAll('\\','/').endsWith('/src/lib/sync.js')) {
      const marker='export function getSyncOperationalSummarySnapshot() {';
      assert.ok(source.includes(marker));
      return source.replace(marker,marker+'\n  if(globalThis.__n136Summary) return globalThis.__n136Summary;');
    }
  },
}],server:{host:'127.0.0.1',port:53136,strictPort:true,hmr:false}});
try {
 await server.listen();
 await withIsolatedLocalBrowser({...n136LocalScope,timeoutMs:110000},async({createContext})=>{
  // Original PR scenario: ordinary Demo missing-class guard and existing login sheet.
  const context=await createContext({viewport:{width:320,height:844},locale:'ar-SA'});
  await context.addInitScript(()=>sessionStorage.setItem('rakeezx-demo-session-v1','preparing'));
  const page=await context.newPage();
  await page.clock.setFixedTime(new Date('2026-09-09T08:20:00+03:00'));
  await openReadyServedDemo(page,n136LocalScope.url);
  await page.goto(n136LocalScope.url+'/#/teaching/missing-fixture');
  const notice=page.locator('[data-class-access-status="verification"]');
  await expect(notice).toBeVisible();
  await expect(notice).toContainText('يلزم تسجيل الدخول');
  await expect(notice).toContainText('بياناتك المحلية محفوظة');
  await notice.getByRole('button',{name:'تسجيل الدخول',exact:true}).click();
  await expect(page.locator('#mini-hub-login-form')).toBeVisible();
  await expect(notice).toBeVisible();
  assert.equal(await page.evaluate(async()=>(await import('/src/store.js')).classOperationsStatus('missing-fixture')),'verification');
  await context.close();
  console.log('PASS original Demo class-login action; real guard remains closed');

  // Owner-bound synthetic account, prepared by the existing N147 registry pattern.
  const account=await createContext({viewport:{width:390,height:844},locale:'ar-SA'});
  const p=await account.newPage();
  await p.goto(n136LocalScope.url+'/#/about');
  await expect(p.locator('.about-public')).toBeVisible();
  await p.evaluate(async()=>{
    const owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const w=await import('/src/lib/workspaces.js'),d=await import('/src/lib/db.js'),c=await import('/src/lib/cloud.js');
    const registry=w.createWorkspaceRegistry();
    const receipt={ownerId:owner,contractVersion:1,foundationHash:'n136-synthetic'};
    try {
      const record=await registry.registerProvisionedAccount(owner,receipt);
      d.selectDatabase(record.databaseName);
      await d.put('device',{id:'device',deviceId:'device:n136',schemaVersion:d.DB_VERSION,accountProvisioningReceipt:receipt});
    } finally {await registry.close();}
    localStorage.setItem(c.AUTH_STORAGE_KEY,JSON.stringify({access_token:'n136-synthetic-token',refresh_token:'n136-synthetic-refresh',expires_at:4102444800,user:{id:owner,email:'n136@example.test'}}));
  });
  await account.addInitScript(()=>{globalThis.__n136Summary={state:'auth_required',failedCount:0,rejectedCount:0,blockedCount:0};});
  await p.goto(n136LocalScope.url+'/#/settings');
  await expect(p.locator('.layout')).toBeVisible();
  // Existing test seam removes the in-memory identity without relaxing any guard.
  // No reload: the already owner-bound workspace remains for the fail-closed entry.
  await p.evaluate(async()=>{
    (await import('/src/lib/cloud.js')).setMockAuth(null,null);
    (await import('/src/router.js')).go('/teaching/missing-fixture');
  });
  const gate=p.locator('[data-class-access-status="verification"]');
  await expect(gate).toBeVisible();
  const checkpoint=await p.evaluate(async()=>{
    const s=await import('/src/store.js'),d=await import('/src/lib/db.js');
    return {workspace:s.getActiveWorkspace(),db:d.getActiveDatabaseName(),status:s.classOperationsStatus('missing-fixture'),lease:s.getOfflineLeaseStatus()};
  });
  assert.equal(checkpoint.workspace.type,'account');
  assert.equal(checkpoint.workspace.authUserId,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  assert.equal(checkpoint.db,checkpoint.workspace.databaseName);
  assert.equal(checkpoint.status,'verification');
  assert.ok(['REMINDER','LIMITED'].includes(checkpoint.lease.state),JSON.stringify(checkpoint));
  await expect(p.locator('[data-app-status]')).toBeHidden();
  await expect(p.locator('[data-offline-lease]')).toHaveCount(0);
  await expect(gate.getByRole('button',{name:'تسجيل الدخول',exact:true})).toHaveCount(1);
  await gate.getByRole('button',{name:'تسجيل الدخول',exact:true}).click();
  await expect(p.locator('#mini-hub-login-form')).toBeVisible();
  await expect(gate).toBeVisible();
  // Existing pageshow handler repaints the real status strip from the fixture.
  for(const summary of [
    {state:'auth_required',failedCount:1},
    {state:'auth_required',rejectedCount:1},
    {state:'blocked',blockedCount:1},
    {state:'auth_required',reasonCategory:'workspace_ownership_blocked',reasonLabel:'Synthetic ownership conflict'},
  ]) {
    await p.evaluate(summary=>{globalThis.__n136Summary=summary;dispatchEvent(new Event('pageshow'));},summary);
    await expect(p.locator('[data-app-status]')).toBeVisible();
    await expect(gate).toBeVisible();
    console.log('PASS non-auth failure visible '+JSON.stringify(summary));
  }
  await p.evaluate(()=>{globalThis.__n136Summary={state:'auth_required'};dispatchEvent(new Event('pageshow'));});
  await expect(p.locator('[data-app-status]')).toBeHidden();
  // Different route has no class action, so its auth strip must remain visible.
  await p.evaluate(async()=>(await import('/src/router.js')).go('/settings'));
  await expect(p.locator('[data-app-status]')).toBeVisible();
  await expect(p.locator('[data-offline-lease]')).toBeVisible();
  console.log('PASS owner-bound account DOM: auth dedupe, lease dedupe, repaint, unrelated errors and route negatives; '+JSON.stringify(checkpoint));
  await account.close();
 });
} finally {await server.close();}
