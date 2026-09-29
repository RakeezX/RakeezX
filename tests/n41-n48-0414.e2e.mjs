import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { seedClaimedWorkspace, bootDemoSettings } from './helpers/settings-0397.mjs';
import { SUPABASE_URL } from '../src/lib/cloud.js';

const sizes=[[1440,900],[1366,768],[1024,768],[768,1024],[390,844],[320,740]];
const name='عبدالله بن أحمد المعبدي';
async function boot(page,{teacherName=name,teacherForm='masculine',theme='light',state='synced',install='manual'}={}) {
 const errors=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.routeWebSocket('wss://*.supabase.co/**',s=>s.close());
 await page.route(`${SUPABASE_URL}/**`,route=>{
  const req=route.request();requests.push({url:req.url(),method:req.method()});
  if(req.url().endsWith('/rpc/account_contract'))return route.fulfill({json:{ownerId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',profileStatus:'READY',profile:{teacherName,teacherForm,phone:'0500000000',schoolName:'مدرسة الاختبار'},access:{grantType:'beta_full',status:'active',source:'public_beta',expiresAt:null}}});
  if(req.url().endsWith('/auth/v1/user'))return route.fulfill({json:{id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',email:'teacher@example.test'}});
  if(req.url().endsWith('/rpc/apply_sync_v2_mutation')){
   const p=req.postDataJSON();return route.fulfill({json:{mutationId:p.p_mutation_id,entity:p.p_entity,recordId:p.p_record_id,canonicalId:p.p_record_id,outcome:'applied',appliedGroups:Object.keys(p.p_patch||{}),conflictedGroups:[],resultRevision:1,canonical:{id:p.p_record_id,...p.p_patch,revision:1,field_revisions:{},deleted_at:null}}});
  }
  return route.fulfill({json:[]});
 });
 await page.addInitScript(({install,offline})=>{
  if(install==='installed')Object.defineProperty(navigator,'standalone',{get:()=>true});
  if(install==='native'){window.installCalls=0;window.deferredInstallPrompt={prompt(){window.installCalls++;},userChoice:Promise.resolve({outcome:'dismissed'})};}
  if(offline)Object.defineProperty(navigator,'onLine',{get:()=>false});
 },{install,offline:state==='offline'});
 await seedClaimedWorkspace(page);
 await page.evaluate(async ({teacherName,teacherForm,theme,state})=>{
  const request=indexedDB.open('rakeezx');
  const database=await new Promise((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
  const tx=database.transaction(['profile','device','outbox'],'readwrite');
  for(const [storeName,patch] of [['profile',{teacherName,teacherForm,schoolName:'مدرسة الاختبار'}],['device',{theme,lastSyncAt:Date.now()}]]){
   const table=tx.objectStore(storeName),r=table.get(storeName);r.onsuccess=()=>table.put({...r.result,...patch});
  }
  await new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});database.close();
 },{teacherName,teacherForm,theme,state});
 await page.goto('/#/');
 await expect(page.locator('.hero__hello')).toBeVisible();
 await settle(page);
 return {errors,requests};
}
async function settle(page){await page.waitForFunction(async()=>{const sync=await import('/src/lib/sync.js');const summary=await sync.getSyncOperationalSummary();return summary.state==='synced'&&!summary.automaticSyncActive&&summary.queuedCount===0;});}
async function openHub(page){const button=page.locator('[data-act="open-teacher-mini-hub"]:visible');await button.focus();await button.press('Enter');await expect(page.locator('.mini-hub-backdrop .sheet')).toBeVisible();await page.locator('.mini-hub-backdrop').evaluate(async node=>{await Promise.allSettled(node.querySelector('.sheet').getAnimations().map(animation=>animation.finished));});return button;}
async function safe(page,evidence){expect(evidence.errors).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);await expect(page.locator('html')).toHaveAttribute('dir','rtl');}
async function storedName(page){return page.evaluate(async()=>{const r=indexedDB.open('rakeezx');const d=await new Promise(resolve=>r.onsuccess=()=>resolve(r.result));const tx=d.transaction('profile'),q=tx.objectStore('profile').get('profile');const record=await new Promise(resolve=>q.onsuccess=()=>resolve(q.result));d.close();return record.teacherName;});}

for(const [width,height]of sizes)for(const theme of ['light','dark'])test(`approved shell + Mini Hub ${width}x${height} ${theme}`,async({page},info)=>{
 await page.setViewportSize({width,height});const evidence=await boot(page,{theme});
 const desktop=width>=900;
 await expect(page.locator('.teacher-mini-hub-trigger__name')).toHaveText('عبدالله المعبدي');
 await expect(page.locator('.teacher-mini-hub-trigger__avatar')).toHaveText('ع ا');
 await expect(page.locator('.teacher-mini-hub-trigger__sub')).toHaveCount(0);
 await expect(page.locator('.hero__hello')).toContainText(desktop?'عبدالله المعبدي':'أستاذ');
 if(!desktop){await expect(page.locator('.home-greeting--compact')).not.toContainText('عبدالله');await expect(page.locator('.compact-identity')).toBeVisible();}
 else await expect(page.locator('.compact-identity')).toBeHidden();
 const quick=page.getByRole('button',{name:theme==='light'?'تفعيل الوضع الداكن':'تفعيل الوضع الفاتح'});
 const box=await quick.boundingBox();expect(box.width).toBeGreaterThanOrEqual(44);expect(box.height).toBeGreaterThanOrEqual(44);
 if(!desktop){const id=await page.locator('.compact-identity').boundingBox();expect(box.x).toBeGreaterThanOrEqual(id.x+id.width);}
 const opener=await openHub(page);const sheet=page.locator('.mini-hub-backdrop .sheet');
 await expect(sheet.locator('.mini-hub-name')).toHaveText('عبدالله المعبدي');
 await expect(sheet.locator('.center-email')).toHaveText('teacher@example.test');await expect(sheet.locator('.center-email')).toHaveAttribute('dir','ltr');
 await expect(sheet).not.toContainText('مدرسة الاختبار');await expect(sheet.locator('.mini-hub-account')).toHaveCount(0);
 await expect(sheet.locator('.mini-hub-pwa h3')).toHaveText('تطبيق ركيز على هذا الجهاز');
 await expect(sheet.locator('[data-act=mini-hub-pwa-guide]')).toHaveText('إرشادات التثبيت');
 await expect(sheet).not.toContainText('ثبّته للوصول السريع');
 if(width===1440||width===390)await page.screenshot({path:info.outputPath(`mini-hub-${width}-${theme}.png`)});
 const geometry=await sheet.evaluate(node=>{const r=node.getBoundingClientRect(),main=document.querySelector('.main').getBoundingClientRect(),body=node.querySelector('.sheet__body');return{center:r.x+r.width/2,target:main.x+main.width/2,vertical:r.y+r.height/2,scroll:body.scrollHeight-body.clientHeight};});
 if(desktop){expect(Math.abs(geometry.center-geometry.target)).toBeLessThanOrEqual(1);expect(Math.abs(geometry.vertical-height/2)).toBeLessThanOrEqual(1);expect(geometry.scroll).toBeLessThanOrEqual(1);}
 for(const control of await sheet.locator('button:not([disabled]),a,summary').all()){const r=await control.boundingBox();if(r)expect(r.height).toBeGreaterThanOrEqual(44);}
 await sheet.locator('summary').click();await expect(sheet.locator('details')).toHaveAttribute('open','');
 await sheet.getByRole('link',{name:'الدعم'}).focus();await page.keyboard.press('Tab');await expect(sheet.getByRole('button',{name:'إغلاق'})).toBeFocused();await page.keyboard.press('Shift+Tab');await expect(sheet.getByRole('link',{name:'الدعم'})).toBeFocused();
 await page.keyboard.press('Escape');await expect(sheet).toHaveCount(0);await expect(opener).toBeFocused();
 await quick.click();await expect(page.locator('html')).toHaveAttribute('data-theme',theme==='light'?'dark':'light');await settle(page);await page.waitForLoadState('networkidle');await page.reload();await expect(page.locator('.hero__hello')).toBeVisible();await settle(page);await page.waitForLoadState('networkidle');await expect(page.locator('html')).toHaveAttribute('data-theme',theme==='light'?'dark':'light');
 expect(await storedName(page)).toBe(name);
 await openHub(page);await page.locator('.sheet a[href="#/settings"]').click();await expect(page.locator('[data-settings-profile]')).toBeVisible();await page.locator('[data-settings-profile] summary').click();await expect(page.locator('[name=schoolName]')).toHaveValue('مدرسة الاختبار');
 for(const option of ['auto','light','dark'])await expect(page.locator(`[data-act=theme][data-theme=${option}]`)).toBeVisible();
 await openHub(page);await page.locator('.sheet a[href="#/support"]').click();await expect(page).toHaveURL(/#\/support/);
 await page.goto('/#/teaching/synthetic');await expect(page.locator('.class-context-nav')).toBeVisible();await expect(page.locator('[data-act=open-teacher-mini-hub]')).toHaveCount(0);await expect(page.locator('[data-act=quick-theme]')).toHaveCount(0);await expect(page.locator('[data-app-status]')).toHaveCount(1);
 await safe(page,evidence);
});
for(const system of ['light','dark'])test(`AUTO opposite persists / OS change ${system}`,async({page})=>{
 await page.emulateMedia({colorScheme:system});await page.setViewportSize({width:390,height:844});const evidence=await boot(page,{theme:'auto'});
 await page.getByRole('button',{name:system==='light'?'تفعيل الوضع الداكن':'تفعيل الوضع الفاتح'}).click();await expect(page.locator('html')).toHaveAttribute('data-theme',system==='light'?'dark':'light');await page.reload();await expect(page.locator('html')).toHaveAttribute('data-theme',system==='light'?'dark':'light');await safe(page,evidence);
});
for(const state of ['synced','pending','blocked','rejected','error','offline'])test(`authoritative Sync presentation ${state}`,async({page})=>{
 const evidence=await boot(page);await openHub(page);
 // Exercise the real shared renderer with explicit operational summaries. Do not
 // enqueue artificial mutations that the live coordinator would immediately drain.
 await page.locator('.mini-hub-sync').evaluate(async(node,state)=>{
  const {renderSyncOperationalSection}=await import('/src/lib/sync-operational-ui.js');
  node.innerHTML=renderSyncOperationalSection({state,lastSuccessfulSyncAt:Date.now(),queuedCount:state==='synced'?0:1,actionableSyncIssue:['blocked','rejected','error'].includes(state),localWorkSaved:true},{compact:true});
 },state);
 const sheet=page.locator('.sheet');const expected={synced:'متزامن',pending:'تغييرات بانتظار المزامنة',blocked:'تغييرات تنتظر بيانات مرتبطة',rejected:'تعذر اعتماد بعض التغييرات',error:'تعذر إكمال المزامنة',offline:'غير متصل'}[state];
 await expect(sheet.locator('.badge')).toHaveText(expected);await expect(sheet.locator('[data-act=mini-hub-sync-now]')).toHaveCount(['rejected','offline'].includes(state)?0:1);
 if(state==='rejected')await expect(sheet.getByRole('link',{name:'تحتاج مساعدة؟'})).toBeVisible();
 await sheet.locator('summary').click();await expect(sheet.locator('details')).toContainText('آخر مزامنة ناجحة');await safe(page,evidence);
});
for(const install of ['native','installed','manual'])test(`existing PWA action ${install}`,async({page})=>{
 await page.setViewportSize({width:390,height:844});const evidence=await boot(page,{install});await openHub(page);
 if(install==='installed'){await expect(page.locator('.mini-hub-installed')).toHaveText('مثبّت');await expect(page.locator('.mini-hub-pwa button')).toHaveCount(0);}
 else if(install==='native'){await page.getByRole('button',{name:'تثبيت ركيز',exact:true}).click();expect(await page.evaluate(()=>window.installCalls)).toBe(1);await expect(page.locator('.mini-hub-installed')).toHaveCount(0);}
 else {await page.getByRole('button',{name:'إرشادات التثبيت',exact:true}).click();await expect(page).toHaveURL(/#\/settings/);await page.locator('[data-act=install-guide]').click();await expect(page.locator('.n43-install-guide')).toBeVisible();}
 await safe(page,evidence);
});
test('names/gender persist unchanged, abbreviate presentation only',async({page})=>{
 const evidence=await boot(page,{teacherForm:'feminine',teacherName:'  سارة  بنت أحمد  الحازمي  '});await expect(page.locator('.home-greeting--desktop')).toContainText('أستاذة سارة الحازمي');await expect(page.locator('.teacher-mini-hub-trigger__avatar')).toHaveText('س ا');expect(await storedName(page)).toBe('  سارة  بنت أحمد  الحازمي  ');await safe(page,evidence);
});
test('Demo exit + theme + teaching isolation',async({page})=>{
 await page.setViewportSize({width:390,height:844});const evidence=await bootDemoSettings(page);await page.goto('/#/');await expect(page.locator('.hero__hello')).toHaveText('أهلاً بك في مساحة تجريبية');await expect(page.locator('.explicit-demo-exit')).toContainText('الخروج من التجربة');await expect(page.locator('.explicit-demo-exit')).toContainText('بيانات تجريبية');await page.locator('[data-act=quick-theme]').click();await page.goto('/#/teaching/synthetic');await expect(page.locator('[data-act=demo-login]')).toHaveCount(0);await expect(page.locator('[data-act=quick-theme]')).toHaveCount(0);await page.goto('/#/');await Promise.all([page.waitForEvent('load'),page.locator('.explicit-demo-exit').click()]);await expect(page.locator('.hero__hello')).toBeVisible();await expect(page.locator('.explicit-demo-exit')).toHaveCount(0);expect(await page.evaluate(()=>sessionStorage.getItem('rakeezx-demo-session-v1'))).toBeNull();expect(evidence.requests).toEqual([]);await safe(page,evidence);
});
test('Mini Hub accessibility in keyboard flow',async({page})=>{
 await page.setViewportSize({width:390,height:844});const evidence=await boot(page);await openHub(page);
 const report=await new AxeBuilder({page}).include('.mini-hub-backdrop').analyze();
 expect(report.violations).toEqual([]);await safe(page,evidence);
});
