// AI-authored: bounded source and real-browser v92 -> v93 upgrade proof.
import assert from 'node:assert/strict';
import {readFile,writeFile,access} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {start} from './server.mjs';
const canonical='C:/Users/Abody/Projects/RakeezX',taskId='n88-pwa-sw-safe-1028',runId='bc2dc652-b0cb-4e6e-8398-014eb71217be';
const dir='tests/n88-pwa-sw-safe-20261028',base='9dc2acf8ce7cc070657116658a010cd0dd77adb0';
const lease=(name,action)=>execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-File',canonical+'/scripts/ops-supervisor-v4/resource-lease.ps1','-Name',name,'-Action',action,'-TaskFile',canonical+'/artifacts/ops-supervisor-v4/queue/'+taskId+'.json','-RuntimeRoot',canonical+'/artifacts/ops-supervisor-v4','-WaitSeconds','0','-OwnerToken',runId],{encoding:'utf8',windowsHide:true,timeout:20000}).trim();
const hash=s=>createHash('sha256').update(s).digest('hex');
const report={taskId,runId,base,startedAt:new Date().toISOString(),checks:[],matrix:[],cleanup:{},providerOperations:0};
const owned=[];let browser,server,stage='source';
const assets=['/src/views/student-portal-class.js','/src/styles/student-portal-class.css','/src/lib/student-portal-class-client.js'];
async function boot(page,url){
 await page.goto(url);await page.waitForFunction(()=>!!window.compactFixture);
 await page.evaluate(()=>window.compactFixture.seedUnknown=true);
 await page.getByRole('link',{name:/مساحة الطلاب/}).first().click();
 await page.waitForFunction(()=>document.querySelector('.n88-class')?.getAttribute('aria-busy')==='false');
 await page.locator('[data-action=open-guidance]').waitFor();
}
try{
 const sw=await readFile('sw.js','utf8'),prior=execFileSync('git',['show',base+':sw.js'],{encoding:'utf8'});
 assert.equal(sw,prior.replace("const VERSION = 'rakeezx-v92';","const VERSION = 'rakeezx-v93';"));
 execFileSync('node',['--check','sw.js']);
 const manifest=[...sw.match(/const SHELL = \[([\s\S]*?)\n\];/)[1].matchAll(/'\.\/([^']*)'/g)].map(m=>m[1]);
 for(const a of assets)assert.ok(manifest.includes(a.slice(1)));
 for(const a of manifest)if(a)await access(a.split('?')[0]);
 report.checks.push({name:'source_manifest_syntax',status:'PASS',evidence:'Only VERSION changes v92 to v93; every other byte (Push, cache cleanup, private exclusions, full shell) equals remote base; all shell paths exist and SW syntax passes.'});
 for(const name of ['integration','browser']){assert.match(lease(name,'acquire'),/^(ACQUIRED|ALREADY OWNED)/);owned.push(name);}
 stage='browser';server=await start();const origin=new URL(server.url).origin;
 const {chromium}=createRequire(canonical+'/package.json')('playwright');browser=await chromium.launch({headless:true});
 for(const width of [320,390]){
  // Each width gets a disposable browser context and its own genuine old SW install.
  server.old?.();
  const context=await browser.newContext({serviceWorkers:'allow',viewport:{width,height:1000}});
  await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort('blockedbyclient'));
  const page=await context.newPage();page.setDefaultTimeout(20000);
  try{
   stage=`${width}:old-install`;await page.goto(origin+'/');await page.waitForFunction(()=>!!window.compactFixture);
   await page.evaluate(async()=>{await navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'});await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)await new Promise(r=>navigator.serviceWorker.addEventListener('controllerchange',r,{once:true}));});
   assert.deepEqual(await page.evaluate(()=>caches.keys()),['rakeezx-v92']);
   const old=await page.evaluate(async paths=>Object.fromEntries(await Promise.all(paths.map(async p=>[p,await (await (await caches.open('rakeezx-v92')).match(p)).text()]))),assets);
   // A separate namespace and synthetic IDB marker must survive generation cleanup.
   await page.evaluate(async()=>{await (await caches.open('synthetic-unrelated')).put('/synthetic-marker',new Response('preserve'));await new Promise((resolve,reject)=>{const q=indexedDB.open('synthetic-preserve',1);q.onupgradeneeded=()=>q.result.createObjectStore('marker');q.onsuccess=()=>{q.result.close();resolve();};q.onerror=reject;});});
   stage=`${width}:update`;server.deploy();
   await page.evaluate(async()=>{const changed=new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}));const r=await navigator.serviceWorker.getRegistration();await r.update();await changed;});
   await page.waitForFunction(async paths=>{const keys=await caches.keys();if(!keys.includes('rakeezx-v93')||keys.includes('rakeezx-v92'))return false;const c=await caches.open('rakeezx-v93');return (await Promise.all(paths.map(p=>c.match(p)))).every(Boolean);},assets);
   const current=await page.evaluate(async paths=>Object.fromEntries(await Promise.all(paths.map(async p=>[p,await (async()=>{const c=await caches.open('rakeezx-v93'),r=await c.match(p);if(!r)throw Error('Missing '+p+' keys '+JSON.stringify((await c.keys()).map(k=>k.url)));return r.text();})()]))),assets);
   for(const a of assets){let source=await readFile('.'+a,'utf8');if(a.endsWith('/student-portal-class.js'))source=source.replace('runtime.mountClassService(target,','window.compactFixture.mount(target,');assert.equal(current[a],source);if(!a.includes('/lib/'))assert.notEqual(old[a],current[a]);}
   await boot(page,server.url.replace('/#','/?upgraded=93#'));
   assert.equal(await page.locator('.n88-code-management').evaluate(e=>e.open),false);
   assert.equal(await page.locator('[data-code]').count(),0);
   assert.equal(await page.locator('[data-action=batch]').isDisabled(),true);
   stage=`${width}:private-online`;
   assert.equal(await page.evaluate(async()=> (await fetch('/api/n88/synthetic-private')).json().then(x=>x.token)),'SYNTHETIC_PRIVATE_SENTINEL');
   const privatePaths=['/api/n88/synthetic-private','/api/n88/synthetic-context','/api/n88/student/read','/api/n44/status','/s/synthetic','/student/synthetic','/n88-private/synthetic'];
   for(const p of privatePaths)await page.evaluate(p=>fetch(p).catch(()=>null),p);
   stage=`${width}:offline`;await context.setOffline(true);
   // Exact cached teacher bytes, real DOM and handlers with no network available.
   for(const a of assets)assert.equal(await page.evaluate(p=>fetch(p,{cache:'reload'}).then(r=>r.text()),a),current[a]);
   await page.locator('[data-action=open-guidance]').click();await page.locator('[data-guidance-source]').waitFor();
   await page.locator('[data-action=open-settings]').click();assert.equal(await page.locator('[name=grades]').isVisible(),true);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   await page.screenshot({path:`${dir}/offline-${width}.png`,fullPage:true});
   for(const p of privatePaths)assert.equal(await page.evaluate(async p=>{try{await fetch(p,{cache:'reload'});return 'response';}catch{return 'unavailable';}},p),'unavailable');
   const cacheAudit=await page.evaluate(async()=>{const {AUTH_STORAGE_KEY}=await import('/src/lib/cloud.js');const token=JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY)).access_token;const out=[];for(const name of await caches.keys()){const c=await caches.open(name);for(const k of await c.keys()){const t=await (await c.match(k)).text();out.push({name,path:new URL(k.url).pathname,privateSentinel:t.includes('SYNTHETIC_PRIVATE_SENTINEL'),authToken:!!token&&t.includes(token),session:t.includes('access_token')&&new URL(k.url).pathname==='/api/n88/synthetic-context'});}}return out;});
   assert.ok(cacheAudit.every(x=>!privatePaths.includes(x.path)&&!x.privateSentinel&&!x.authToken&&!x.session));
   assert.equal(await page.evaluate(async()=> (await (await caches.open('synthetic-unrelated')).match('/synthetic-marker')).text()),'preserve');
   assert.ok(await page.evaluate(async()=> (await indexedDB.databases()).some(d=>d.name==='synthetic-preserve')));
   // Real owner entry guard: invalidate synthetic owner; existing private DOM is cleared.
   await page.locator('.n88-code-management>summary').click();
   await page.locator('.n88-class-roster>li').first().waitFor();
   assert.equal(await page.locator('.n88-class-roster>li').count(),28);
   await page.evaluate(()=>window.n88Fixture.switchOwner());
   await page.waitForFunction(()=>!document.querySelector('[data-code]')&&!document.querySelector('.n88-class-roster'));
   assert.equal(await page.evaluate(()=>window.compactFixture.calls.filter(c=>!['list','guidance-list'].includes(c.action)).length),0);
   // Cold offline navigation uses the real cached shell; synthetic session context is unavailable and cannot restore private roster.
   const cold=await context.newPage();await cold.goto(server.url.replace('/#','/?cold=1#'));
   await cold.locator('.empty--error[role=alert]').waitFor({timeout:15000});
   assert.match(await cold.locator('.empty__title').textContent(),/تعذّر فتح سجلّك/);
   assert.equal(await cold.locator('.n88-class-roster,[data-code]').count(),0);await cold.screenshot({path:`${dir}/cold-offline-${width}.png`});await cold.close();
   report.matrix.push({width,coldOfflineSessionFailClosed:true,oldGeneration:92,newGeneration:93,oldRetired:true,assets:assets.map(a=>({path:a,oldHash:hash(old[a]),newHash:hash(current[a])})),offlineActualTeacherHandlers:true,overflow:false,privateNetworkOnly:true,unrelatedCacheAndIdbPreserved:true,ownerInvalidation:true,mutations:0,cacheAudit});
  }finally{await context.close();}
 }
 report.checks.push({name:'real_browser_upgrade_offline_private',status:'PASS',evidence:'320/390px fresh Chromium contexts: actual full v92 shell with pre-N88 teacher assets -> actual v93 SW; v92 retired, all 3 teacher assets refreshed, offline source bytes/DOM handlers, collapsed private roster, disabled uncertain issuance, private network-only failure, owner invalidation and unrelated cache/IDB preservation.'});
 report.status='PASS';
}catch(e){report.status='FAIL';report.failure={stage,message:e.message,stack:e.stack};process.exitCode=1;}
finally{await browser?.close();await server?.close();report.cleanup.browserAndServerClosed=true;for(const name of owned.reverse())report.cleanup[name]=lease(name,'release');report.completedAt=new Date().toISOString();await writeFile(`${dir}/${report.status==='PASS'?'result':'failure-'+Date.now()}.json`,JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({status:report.status,checks:report.checks,matrix:report.matrix.map(({cacheAudit,...m})=>m),failure:report.failure,cleanup:report.cleanup}));
