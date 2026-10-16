import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {tmpdir} from 'node:os';
import AxeBuilder from '@axe-core/playwright';
import {withIsolatedLocalBrowser} from 'file:///C:/Users/Abody/Projects/RakeezX/scripts/ops-supervisor-v4/isolated-local-browser.mjs';
import {openReadyServedDemo} from './helpers/served-demo-readiness.mjs';
import {AUTH_STORAGE_KEY,SUPABASE_URL} from '../src/lib/cloud.js';
const root=resolve('.'),taskId='continuous-n88-guest-hash-entry-20261017',runId='01344bf4-1b58-4920-a310-ca7f888c4d89';
// Same static actual-source HTTP pattern used by existing app boot/Demo tests.
const server=createServer(async(req,res)=>{try{
 const pathname=new URL(req.url,'http://localhost').pathname;
 const file=resolve(root,pathname==='/'?'index.html':'.'+decodeURIComponent(pathname));
 if(!file.startsWith(root+sep))throw Error('outside root');
 res.setHeader('Content-Type',{'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'}[extname(file)]??'application/octet-stream');
 res.setHeader('Cache-Control','no-store');res.end(await readFile(file));
}catch{res.writeHead(404).end();}});
await new Promise((done,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',done);});
const origin='http://127.0.0.1:'+server.address().port;
const accountOnly=process.env.N88_CHECK==='account';
const visualOnly=process.env.N88_CHECK==='visual';
const previous=accountOnly||visualOnly?JSON.parse(await readFile(new URL('./n88-guest-hash-entry-browser.json',import.meta.url),'utf8')):null;
const results=previous?.results??[],report=(name,evidence)=>{results.push({name,status:'PASS',evidence});console.log('PASS',name,JSON.stringify(evidence));};
try {
 await withIsolatedLocalBrowser({taskFile:'C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/'+taskId+'.json',runId,url:origin,timeoutMs:120000},async({createContext})=>{
  if(visualOnly){
   for(const [width,theme] of [[320,'light'],[1280,'dark']]){
    const ctx=await createContext({viewport:{width,height:1000}}),page=await ctx.newPage();
    await page.goto(origin+'/#/n88-invite-lab');await page.locator('[data-n88-public]').waitFor();
    await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
    const scan=await new AxeBuilder({page}).include('[data-n88-public]').analyze();assert.deepEqual(scan.violations,[]);
    const screenshot=resolve(tmpdir(),'n88-'+runId+'-'+width+'.png');await page.screenshot({path:screenshot,fullPage:true});
    report('visual-accessibility-'+width,{theme,axeViolations:0,screenshot});await ctx.close();
   }
   return;
  }
  if(!accountOnly){
  for(const width of [320,390,768,1280]){
   const ctx=await createContext({viewport:{width,height:900},locale:'ar-SA'}),page=await ctx.newPage();
   const requests=[],errors=[];page.on('request',r=>requests.push(r.url()));page.on('pageerror',e=>errors.push(e.message));
   await ctx.addInitScript(()=>{
    window.__privateCalls=[];
    for(const key of ['open','databases']){const f=indexedDB[key].bind(indexedDB);indexedDB[key]=(...args)=>{window.__privateCalls.push('idb:'+key);return f(...args);};}
    for(const key of ['getItem','setItem','removeItem','clear']){const f=Storage.prototype[key];Storage.prototype[key]=function(...args){window.__privateCalls.push('storage:'+key+':'+(args[0]??''));return f.apply(this,args);};}
    for(const key of ['fetch','WebSocket','XMLHttpRequest']){const f=window[key];window[key]=function(...args){window.__privateCalls.push(key);return key==='fetch'?f(...args):new f(...args);};}
   });
   await page.goto(origin+'/#/n88-invite-lab');
   await page.locator('[data-n88-public]').waitFor();
   assert.equal(await page.title(),'تجربة دعوة الطالب — رَكيز المعلم');
   assert.ok(await page.getByText('نموذج تجريبي دون بيانات طلاب أو دخول فعلي',{exact:true}).isVisible());
   assert.equal(await page.locator('[data-workspace-gate],input[type=password],input[type=email]').count(),0);
   for(const theme of ['light','dark']){
    await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
    const style=await page.locator('.n88-guest').evaluate(e=>({bg:getComputedStyle(e).backgroundColor,dir:getComputedStyle(e.querySelector('main')).direction}));
    assert.equal(style.dir,'rtl');assert.equal(style.bg,theme==='dark'?'rgb(16, 28, 32)':'rgb(238, 245, 243)');
   }
   await page.locator('[data-open]').focus();await page.keyboard.press('Enter');
   await page.locator('[data-student]').waitFor();assert.equal(await page.locator('h2').evaluate(e=>e===document.activeElement),true);
   assert.equal(await page.locator('progress').getAttribute('value'),'1');
   await page.locator('[data-reset]').click();
   assert.equal(await page.locator('[data-open]').evaluate(e=>e===document.activeElement),true);
   await page.locator('input').fill('NOT-A-REAL-CODE');await page.locator('input').press('Enter');
   assert.equal(await page.locator('input').getAttribute('aria-invalid'),'true');
   await page.locator('input').fill(' demo-only ');await page.locator('input').press('Enter');await page.locator('[data-student]').waitFor();
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
   assert.deepEqual(await page.evaluate(()=>window.__privateCalls),['storage:getItem:rakeezx-theme']); // pre-existing shared head theme read only
   assert.equal(requests.some(u=>/app-update|\/app.js|\/store.js|\/lib\/(cloud|db|workspaces)/.test(u)),false);
   assert.equal(requests.some(u=>new URL(u).origin!==origin),false);assert.deepEqual(errors,[]);
   report('guest-'+width,{themes:['light','dark'],keyboard:true,manualFallback:true,privateCalls:'only unchanged head theme read',requests:requests.map(u=>new URL(u).pathname)});
   if(width===390){
    await page.getByRole('link',{name:'العودة لرَكيز المعلم'}).click();await page.locator('[data-workspace-login]').waitFor();
    assert.equal(await page.locator('[data-n88-public]').count(),0);report('guest-back-link','normal visitor application mounted after leaving hash');
   }
   await ctx.close();
  }
  {const ctx=await createContext(),page=await ctx.newPage();
   await page.route('**/src/views/n88-public-guest.js',r=>r.abort('failed'));
   await page.goto(origin+'/#/n88-invite-lab');await page.getByText(/تعذّر تحميل نموذج الدعوة التجريبي/).waitFor();
   await page.getByRole('link',{name:'العودة لرَكيز المعلم'}).click();await page.locator('[data-workspace-login]').waitFor();
   report('import-failure','visible safe fallback and functional back link');await ctx.close();}
  for(const hash of ['#/','#/classes','#/n88-invite-lab?extra=1','#/n88-invite-lab/']){
   const ctx=await createContext(),page=await ctx.newPage(),requests=[];page.on('request',r=>requests.push(r.url()));
   await page.goto(origin+'/'+hash);await page.locator('[data-workspace-login]').waitFor();
   assert.ok(requests.some(u=>u.endsWith('/src/lib/app-update.js')));assert.ok(requests.some(u=>u.endsWith('/src/app.js')));
   assert.equal(await page.locator('[data-n88-public]').count(),0);
   await page.locator('[data-workspace-login]').click();await page.locator('#first-run-inline-form input[name=email]').waitFor();
   report('visitor-'+hash,'actual visitor and login form; full normal module graph, no public mock');await ctx.close();
  }
  {const ctx=await createContext();
   await ctx.addInitScript(()=>sessionStorage.setItem('rakeezx-demo-session-v1','preparing'));
   const page=await ctx.newPage(),demo=await openReadyServedDemo(page,origin);
   await page.reload();await page.locator('.layout').waitFor();
   const resumed=await page.evaluate(async()=>{const s=await import('/src/store.js');return {type:s.getActiveWorkspace()?.type,ready:s.state.ready,students:s.state.students.length};});
   assert.equal(resumed.type,'demo');assert.equal(resumed.ready,true);assert.ok(resumed.students>0);
   report('demo-other-hash',{demo,resumed,scope:'local persisted Demo; no Service Worker/installed-PWA certification'});await ctx.close();}
  }
  // Reuse the existing account-switch fixture pattern: claimed synthetic owner,
  // local data and cached synthetic identity. Remote requests are fulfilled in memory.
  {const ctx=await createContext(),page=await ctx.newPage(),owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
   await page.goto(origin+'/');await page.locator('[data-workspace-login]').waitFor();
   await page.evaluate(async({owner,key})=>{
    const d=await import('/src/lib/db.js'),{createWorkspaceRegistry}=await import('/src/lib/workspaces.js');
    d.selectDatabase('rakeezx');await d.put('device',{id:'device',deviceId:'n88-synthetic',schemaVersion:d.DB_VERSION,workspaceClaim:{version:1,state:'claimed',ownerId:owner,claimId:'n88-claim',databaseName:'rakeezx'}});
    await d.put('profile',{id:'profile',teacherName:'معلم اصطناعي',schoolName:'مدرسة اصطناعية',serverRevision:1});d.closeDB();
    const r=createWorkspaceRegistry();await r.registerLegacyClaim(owner,{claimId:'n88-claim',evidenceHash:'n88-synthetic'});await r.close();
    localStorage.setItem(key,JSON.stringify({access_token:'n88-synthetic-token',refresh_token:'n88-synthetic-refresh',expires_at:4102444800,user:{id:owner,email:'teacher@example.test'}}));
   },{owner,key:AUTH_STORAGE_KEY});
   await ctx.route(SUPABASE_URL+'/**',route=>{
    const p=new URL(route.request().url()).pathname;
    if(p.endsWith('/user'))return route.fulfill({json:{id:owner,email:'teacher@example.test'}});
    if(p.endsWith('/account_contract'))return route.fulfill({json:{ownerId:owner,profileStatus:'READY',profile:{teacherName:'معلم اصطناعي',phone:'0500000001',teacherForm:'masculine'},access:{grantType:'beta_full',status:'active'},provisioning:null}});
    if(p.endsWith('/score_foundation_capability'))return route.fulfill({json:{scoreDomainVersion:1,restoreProtocol:'CORE_V2'}});
    if(p.endsWith('/n71_restore_capability'))return route.fulfill({status:404,json:{code:'PGRST202'}});
    return route.fulfill({json:[]});
   });
   await page.goto(origin+'/#/');
   // A fragment-only goto keeps the visitor document alive; bootstrap needs a new document.
   await page.reload();
   await page.locator('.layout').waitFor({timeout:15000}).catch(async e=>{throw Error(e.message+' BODY: '+await page.locator('body').innerText());});
   const checkpoint=await page.evaluate(async()=>{
    const s=await import('/src/store.js'),d=await import('/src/lib/db.js');const w=s.getActiveWorkspace(),device=await d.get('device','device');
    return {ready:s.state.ready,type:w?.type,owner:w?.authUserId,database:d.getActiveDatabaseName(),claimOwner:device.workspaceClaim?.ownerId,teacher:s.state.profile.teacherName,layout:!!document.querySelector('.layout')};
   });
   assert.deepEqual(checkpoint,{ready:true,type:'account',owner,database:'rakeezx',claimOwner:owner,teacher:'معلم اصطناعي',layout:true});
   report('synthetic-account-bootstrap',checkpoint);await ctx.close();}
 });
}finally{
 server.closeAllConnections();await new Promise(done=>server.close(done));
 await writeFile(new URL('./n88-guest-hash-entry-browser.json',import.meta.url),JSON.stringify({taskId,runId,originalReportedURL:'https://rakeezx.com/#/n88-invite-lab',target:origin,scope:'actual source application on task-owned loopback; no Production claim',results,cleanup:'isolated helper closes owned contexts/browser; server closed in finally'},null,2)+'\n');
}
