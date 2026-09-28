import { test, chromium, webkit, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile,writeFile,stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { AUTH_STORAGE_KEY } from '../src/lib/cloud.js';
// A separate read-only static root allows this regression to run against an unchanged baseline.
const ROOT=process.env.N47_SOURCE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OWNER='80808080-8080-4080-8080-808080808080';
const SESSION={access_token:'synthetic-n40-0382',refresh_token:'synthetic-n40-refresh',expires_at:4102444800,user:{id:OWNER,email:'n40-audit@example.test'}};
const mime={'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.png':'image/png','.json':'application/json','.webmanifest':'application/manifest+json','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/__audit_fixture__')return res.writeHead(200,{'Content-Type':'text/html'}).end('<!doctype html><title>synthetic fixture</title>');
  const f=path.resolve(ROOT,url.pathname==='/'?'index.html':decodeURIComponent(url.pathname).slice(1));
  if(!f.startsWith(path.resolve(ROOT)+path.sep)||url.pathname.split('/').some(x=>x.startsWith('.')))return res.writeHead(403).end();
  try{if(!(await stat(f)).isFile())throw Error();res.writeHead(200,{'Content-Type':mime[path.extname(f)]||'application/octet-stream'}).end(await readFile(f));}
  catch{res.writeHead(404).end();}
});
let host;
test.beforeAll(async()=>{
  host=process.env.N47_PREVIEW_URL;
  if(host){assert(/^https:\/\/[a-z0-9-]+\.rakeezx\.pages\.dev$/.test(host),'explicit isolated Product Preview required');return;}
  await new Promise(r=>server.listen(0,'127.0.0.1',r));host='http://127.0.0.1:'+server.address().port;
});
test.afterAll(async()=>{if(server.listening)await new Promise(r=>server.close(r));});
const scenarios=[[1920,1080],[1440,900],[1440,800],[1366,768],[1366,720],[1280,700],[1024,650],[1280,600],[390,844],[320,740]].map(([width,height])=>({width,height}));
// Effective CSS viewport and density equivalent to 1366x768 at 125%; not native browser zoom.
scenarios.push({width:1092,height:614,deviceScaleFactor:1.25});
function contract(profile,state,status){return {ownerId:OWNER,profileStatus:status,profile,access:{grantType:'beta_full',status:'active',source:'public_beta'},provisioning:{state,version:1,foundationHash:state==='READY'?'synthetic-n40-foundation':null}};}
async function stateOf(page){return page.locator('[data-profile-form]').evaluateAll(nodes=>nodes.map(n=>{const s=getComputedStyle(n);return {value:n.dataset.profileForm,pressed:n.getAttribute('aria-pressed'),class:n.className,bg:s.backgroundColor,color:s.color,shadow:s.boxShadow};}));}
for(const engine of ['chromium','webkit'])for(const config of scenarios){
test('N47 '+engine+' '+config.width+'x'+config.height+(config.deviceScaleFactor?' 125%-equivalent':''),async({},testInfo)=>{
 const browser=await (engine==='chromium'?chromium:webkit).launch();
 try {
 const ctx=await browser.newContext({viewport:{width:config.width,height:config.height},deviceScaleFactor:config.deviceScaleFactor||1,hasTouch:config.width<700,serviceWorkers:'block'});
 const page=await ctx.newPage(),errors=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await ctx.routeWebSocket('**/*',ws=>ws.close());
 await ctx.route('**/*',route=>{
 const url=new URL(route.request().url());
 if(url.origin===host){
   if(url.pathname==='/__audit_fixture__')return route.fulfill({contentType:'text/html',body:'<!doctype html><title>Synthetic N47 fixture</title>'});
   return route.continue();
 }
 requests.push(url.pathname);
 if(url.pathname.startsWith('/auth/v1/'))return route.fulfill({json:SESSION.user});
 if(url.pathname.endsWith('/account_contract')||url.pathname.endsWith('/provision_account_profile'))return route.fulfill({json:contract({teacherName:'',phone:'',schoolName:'',teacherForm:'feminine'},'PROFILE_REQUIRED','PENDING_PROFILE')});
 return route.abort();
 });
 await page.goto(host+'/__audit_fixture__');
 await page.evaluate(({key,session})=>localStorage.setItem(key,JSON.stringify(session)),{key:AUTH_STORAGE_KEY,session:SESSION});
 await page.goto(host+'/');await expect(page.locator('[data-account-profile-form]')).toBeVisible();
 const snapshots=[];
 for(const theme of ['light','dark']){
 await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
 const m=await geometry(page);snapshots.push({theme,...m});
 if(config.width>=700){
 assert(m.document.scrollHeight<=m.document.clientHeight,'document has no vertical scroll');
 assert.equal(m.outer.scrollHeight,m.outer.clientHeight,'desktop must have no unused scroll range');
 assert(m.form.top>=0&&m.form.bottom<=config.height,'whole panel fits');
 assert.equal(m.form.scrollHeight,m.form.clientHeight,'form content is not internally clipped');
 assert(m.action.top>=0&&m.action.bottom<=config.height,'primary action is visible without scrolling');
 assert(m.required.every(e=>e.height>0&&e.top>=0&&e.bottom<=config.height),'all required content is visible without scrolling');
 }else if(config.width===320){assert(m.outer.scrollHeight>m.outer.clientHeight,'genuinely tall mobile content remains scrollable');}
 assert(m.controls.every(c=>c.height>=44),'existing touch targets stay intact');
 await assertSelected(page,'feminine');
 await page.locator('[data-profile-form=masculine]').click();await assertSelected(page,'masculine');
 await page.locator('[data-profile-form=feminine]').click();await assertSelected(page,'feminine');
 await page.screenshot({path:testInfo.outputPath(theme+'.png'),fullPage:true});
 }
 if(config.width<700){
 for(let cycle=0;cycle<2;cycle++){
 await simulate(page,360);await page.locator('[name=schoolName]').focus();
 await expect.poll(()=>visible(page,'[name=schoolName]',360)).toBe(true);
 const action=page.locator('[type=submit]');await action.scrollIntoViewIfNeeded();
 assert(await visible(page,'[type=submit]',360));
 const short=await geometry(page);assert(short.outer.scrollHeight>short.outer.clientHeight);
 snapshots.push({keyboardCycle:cycle,...short});
 await action.click(); // Native required validation; no account submission.
 await expect(page.locator('[name=teacherName]')).toBeFocused();
 await expect.poll(()=>visible(page,'[name=teacherName]',360)).toBe(true);
 await simulate(page,config.height);await page.locator('[name=teacherName]').blur();
 }
 // Also exercise actual browser resize, without synthetic visualViewport overrides.
 await page.evaluate(()=>{delete visualViewport.height;delete visualViewport.offsetTop;});
 await page.setViewportSize({width:config.width,height:360});await page.locator('[name=schoolName]').focus();
 await expect.poll(()=>visible(page,'[name=schoolName]',360)).toBe(true);
 await page.setViewportSize({width:config.width,height:config.height});
 await expect.poll(()=>page.evaluate(()=>parseFloat(document.documentElement.style.getPropertyValue('--visible-viewport-height')))).toBe(config.height);
 assert.equal(await page.locator('[data-account-profile-required]').evaluate(e=>getComputedStyle(e).overflowY),'auto');
 }
 assert.equal(await page.locator('html').getAttribute('dir'),'rtl');
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 assert.equal(await page.locator('body').evaluate(e=>getComputedStyle(e).overflowY==='hidden'),false);
 assert.deepEqual(errors,[]);assert(!requests.some(p=>p.includes('complete_account_profile')));
 const evidence=JSON.stringify({engine,config,snapshots,errors,realBackendRequests:0},null,2);
 await writeFile(testInfo.outputPath('measurements.json'),evidence);
 await testInfo.attach('N47-measurements',{body:evidence,contentType:'application/json'});
 await ctx.close();
 }finally{await browser.close();}
});
}
async function geometry(page){return page.evaluate(()=>{
 const measure=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height,clientHeight:e.clientHeight,scrollHeight:e.scrollHeight,scrollTop:e.scrollTop,paddingTop:s.paddingTop,paddingBottom:s.paddingBottom,gap:s.gap}};
 const outer=document.querySelector('[data-account-profile-required]'),form=document.querySelector('[data-account-profile-form]');
 const doc=document.documentElement;
 return {viewport:{width:innerWidth,height:innerHeight,visibleHeight:visualViewport.height,density:devicePixelRatio},document:{clientHeight:doc.clientHeight,scrollHeight:doc.scrollHeight,bodyScrollHeight:document.body.scrollHeight},outer:measure(outer),form:measure(form),action:measure(form.querySelector('[type=submit]')),controls:[...form.querySelectorAll('input,button')].map(measure),required:[...form.querySelectorAll('.first-run-status__brand,.first-run-status__copy,.field__label,.field__hint,input,button')].map(measure)};
});}
async function simulate(page,height){
 await page.evaluate(h=>{Object.defineProperty(visualViewport,'height',{configurable:true,value:h});Object.defineProperty(visualViewport,'offsetTop',{configurable:true,value:0});visualViewport.dispatchEvent(new Event('resize'));},height);
 await expect.poll(()=>page.evaluate(()=>parseFloat(document.documentElement.style.getPropertyValue('--visible-viewport-height')))).toBe(height);
}
async function visible(page,selector,height){return page.locator(selector).evaluate((e,h)=>{const r=e.getBoundingClientRect();return r.top>=0&&r.bottom<=h},height);}
async function assertSelected(page,value){
  const nodes=await stateOf(page);
  assert.equal(nodes.length,2);
  assert.equal(nodes.filter(n=>n.class.split(' ').includes('is-on')).length,1);
  assert.equal(nodes.filter(n=>n.pressed==='true').length,1);
  const selected=nodes.find(n=>n.value===value),other=nodes.find(n=>n.value!==value);
  assert(selected.class.split(' ').includes('is-on'));
  assert.equal(selected.pressed,'true');assert.equal(other.pressed,'false');
  assert.notEqual(selected.bg,other.bg,'selected state must be visibly distinct');
  assert.notEqual(selected.color,other.color,'existing selected text treatment is applied');
}
