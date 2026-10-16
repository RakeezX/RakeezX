import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {withIsolatedLocalBrowser} from 'file:///C:/Users/Abody/Projects/RakeezX/scripts/ops-supervisor-v4/isolated-local-browser.mjs';
import {openReadyServedDemo} from './helpers/served-demo-readiness.mjs';
const root=resolve('.'),checks=[];
const server=createServer(async(req,res)=>{try{
 const pathname=new URL(req.url,'http://127.0.0.1').pathname;
 const file=resolve(root,pathname==='/'?'index.html':'.'+decodeURIComponent(pathname));
 if(!file.startsWith(root+sep))throw Error('Outside task root');
 res.setHeader('Content-Type',{'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2'}[extname(file)]??'application/octet-stream');
 res.end(await readFile(file));
}catch{res.writeHead(404);res.end();}});
try{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const url='http://127.0.0.1:'+server.address().port;
 await withIsolatedLocalBrowser({taskFile:'C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/continuous-n88-safe-invite-ux-lab-20261016.json',runId:'ee4bc264-cfb8-4d13-b350-588ea35d102d',url,timeoutMs:120000},async({createContext})=>{
 for(const width of [320,390,768,1280])for(const theme of ['light','dark']){
  const context=await createContext({viewport:{width,height:900},locale:'ar-SA',colorScheme:theme});
  await context.addInitScript(()=>sessionStorage.setItem('rakeezx-demo-session-v1','preparing'));
  const page=await context.newPage(); const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await openReadyServedDemo(page,url);
  await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
  await page.evaluate(()=>{location.hash='/n88-invite-lab';});
  await page.locator('[data-n88-lab]').waitFor();
  const dbBefore=await page.evaluate(async()=>{const d=await import('/src/lib/db.js');return Object.fromEntries(await Promise.all(d.STORES.map(async name=>[name,await d.getAll(name)])));});
  assert.equal(await page.evaluate(async()=>{
   const s=await import('/src/store.js'),v=(await import('/src/views/n88-student-invite-lab.js')).default;
   const saved=Object.getOwnPropertyDescriptors(s.state);
   try {
    for(const key of Object.keys(saved))Object.defineProperty(s.state,key,{configurable:true,get(){throw Error('Private store read: '+key);}});
    return String(v.render()).includes('نموذج تجريبي ببيانات افتراضية فقط');
   }finally{Object.defineProperties(s.state,saved);}
  }),true,'View must not read any store records');
  const before=await page.evaluate(()=>({local:{...localStorage},session:{...sessionStorage}}));
  const requests=[];page.on('request',r=>requests.push(r.url()));
  await page.locator('[data-n88-open]').focus();await page.keyboard.press('Enter');
  await page.locator('[data-n88-student]').waitFor();
  assert.equal(await page.locator('[data-n88-heading]').evaluate(el=>document.activeElement===el),true);
  assert.ok((await page.locator('[data-n88-student]').innerText()).includes('8 من 10'));
  assert.equal(await page.locator('[data-n88-student] a').count(),0);
  await page.locator('[data-n88-reset]').click();
  await page.locator('#n88-code').fill('not-a-credential');
  await page.locator('#n88-code').press('Enter');
  assert.equal(await page.locator('#n88-code').getAttribute('aria-invalid'),'true');
  await page.locator('#n88-code').fill('demo-only');await page.locator('#n88-code').press('Enter');
  await page.locator('[data-n88-student]').waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  assert.equal(await page.locator('[data-n88-lab]').evaluate(el=>getComputedStyle(el).direction),'rtl');
  await page.locator('[data-n88-reset]').click();
  await page.keyboard.press('Tab');
  assert.equal(await page.locator('#n88-code').evaluate(el=>document.activeElement===el&&getComputedStyle(el).outlineStyle!=='none'),true);
  for(const el of await page.locator('[data-n88-lab] button').all()){
   const b=await el.boundingBox();assert.ok(b.height>=44&&b.x>=0&&b.x+b.width<=width+1);
  }
  assert.deepEqual(await page.evaluate(()=>({local:{...localStorage},session:{...sessionStorage}})),before);
  assert.deepEqual(requests,[],'Invite actions must issue zero requests');
  assert.deepEqual(await page.evaluate(async()=>{const d=await import('/src/lib/db.js');return Object.fromEntries(await Promise.all(d.STORES.map(async name=>[name,await d.getAll(name)])));}),dbBefore,'All IndexedDB stores unchanged');
  // Actual handlers work without network; SW is blocked by the isolated phase.
  await context.setOffline(true);
  await page.locator('[data-n88-open]').click();await page.locator('[data-n88-student]').waitFor();
  await context.setOffline(false);
  await page.locator('[data-n88-lab] a[href="#/"]').click();
  await page.waitForFunction(()=>location.hash==='#/');
  await page.goBack();await page.locator('[data-n88-form]').waitFor();
  assert.equal(await page.locator('#n88-code').inputValue(),'');
  // Change actual store workspace metadata in this disposable synthetic context.
  // No authentication, account creation, DB writes or remote fixture.
  await page.evaluate(async()=>{
   const s=await import('/src/store.js');const workspace=s.getActiveWorkspace();
   s.activateWorkspace({...workspace,type:'account',syncEligible:false});
   // Existing mounted handler must also refuse after a workspace change.
   document.querySelector('[data-n88-open]').click();
   if(document.querySelector('[data-n88-student]'))throw Error('Stale handler allowed account');
   (await import('/src/repaint.js')).repaint();
  });
  await page.locator('[data-n88-denied]').waitFor();
  assert.equal(await page.locator('[data-n88-open],[data-n88-student],#n88-code').count(),0);
  assert.equal(await page.locator('[data-n88-denied] a').getAttribute('href'),'#/');
  assert.deepEqual(errors,[]);
  checks.push({name:`${width}_${theme}_actual_app`,status:'PASS',evidence:'Real Demo route: link/manual/invalid input, keyboard focus, RTL, no overflow, 44px controls, zero action requests or local/session/IndexedDB changes, private-store getter traps, stale-handler guard, offline loaded handlers, back/reset, actual account-workspace denial. SW disabled; no installed-offline certification.'});
  await context.close();
 }
 });
}finally{await new Promise(r=>server.close(r));}
await writeFile('tests/n88-student-invite-lab-browser.json',JSON.stringify({checks,resourceCleanup:'Owned browser contexts/browser and task loopback server closed in finally.'},null,2)+'\n');
console.log(JSON.stringify(checks,null,2));
