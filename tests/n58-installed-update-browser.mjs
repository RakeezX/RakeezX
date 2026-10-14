// AI: real historical/current app DOM, handlers, CSS, HTTP cache and Service Workers.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {resolve,extname} from 'node:path';
import {openReadyServedDemo} from './helpers/served-demo-readiness.mjs';
const require=createRequire('C:/Users/Abody/Projects/RakeezX/package.json');
const {chromium}=require('playwright');
const root=resolve('.'), old='89a162adff6d82eccc95f4605c9c7a99c1ada472', base='20e41701cc41437ff367675ff2c9cc8dd6db0ce8';
const older=execFileSync('git',['rev-parse','1328171'],{encoding:'utf8'}).trim();
const fixed=process.argv.includes('--fixed'), blobs=new Map(), hits=[];
const headerRules=(await readFile(resolve(root,'_headers'),'utf8').catch(()=>''))
 .split(/\r?\n(?=\/)/).map(rule=>({path:rule.match(/^\/[^\r\n]+|^\/\s*$/m)?.[0]?.trim(),value:rule.match(/Cache-Control:\s*([^\r\n]+)/i)?.[1]})).filter(r=>r.path&&r.value);
const currentHeader=path=>headerRules.find(r=>r.path.endsWith('*')?('/'+path).startsWith(r.path.slice(0,-1)):r.path===('/'+path)||path==='index.html'&&r.path==='/')?.value;
let release=old, noSW=false, realBoot=false, blockedAsset=null;
const bridge='\nexport const upgradeTest={resolve,actions:GLOBAL_ACTIONS,handlers:()=>({...GLOBAL_ACTIONS,...view?.actions}),register:registerServiceWorker,setSync(v){syncModule=v;},refresh:refreshSyncOperationalUI};';
async function source(path){
 if(release==='candidate')return readFile(resolve(root,path));
 const key=release+':'+path;if(!blobs.has(key))blobs.set(key,execFileSync('git',['show',key],{maxBuffer:16e6,stdio:['ignore','pipe','ignore']}));return blobs.get(key);
}
const server=createServer(async(req,res)=>{try{
 const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\//,'')||'index.html';
 if(path.includes('..')||(noSW&&path==='sw.js'))throw Error('missing');
 if(path===blockedAsset){res.writeHead(503).end();return;}
 let body=await source(path);
 if(path==='src/app.js')body=(realBoot?body.toString():body.toString().replace(/\nboot\(\);/,'\n// Test transport prepares a synthetic owner instead of remote boot.'))+bridge;
 const type={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json','.woff2':'font/woff2'}[extname(path)];
 res.setHeader('Content-Type',type||'application/octet-stream');
 res.setHeader('Cache-Control',release==='candidate'?(currentHeader(path)||'public, max-age=14400, must-revalidate'):'public, max-age=14400, must-revalidate');
 hits.push({release,path,cache:req.headers['cache-control']||null});res.end(body);
 }catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(4197,'127.0.0.1',r));
const url='http://127.0.0.1:4197', owner='a5800000-0000-4000-8000-000000000011';
async function attach(page,seed=false,count=64,activeOwner=owner,newSession=false){
 if(release==='candidate')await page.evaluate(async()=>{if(document.querySelector('script[src="src/lib/app-update.js"]'))await(await import('/src/lib/app-update.js')).startup;});
 await page.evaluate(async({owner,seed,count,newSession})=>{
  const app=await import('/src/app.js'),s=await import('/src/store.js'),db=await import('/src/lib/db.js'),c=await import('/src/lib/cloud.js');
  window.h=app.upgradeTest;window.s=s;window.db=db;window.c=c;
  if(seed||newSession)localStorage.setItem(c.AUTH_STORAGE_KEY,JSON.stringify({access_token:'synthetic-only',expires_at:Math.floor(Date.now()/1000)+3600,user:{id:owner}}));
  const session=JSON.parse(localStorage.getItem(c.AUTH_STORAGE_KEY));
  if(session?.user?.id!==owner)throw Error('Reload changed the expected synthetic owner/session');
  c.setMockAuth(session.user,session);
  c.setMockBackend({async fetchRecords(){return [];},async applySyncV2(){throw Error('No outbox dispatch authorized');}});
  const workspace={id:'account:n58-upgrade',type:'account',authUserId:owner,databaseName:await(await import('/src/lib/workspaces.js')).accountWorkspaceDatabaseName(owner),broadcastChannelName:'n58-upgrade',ownershipState:'claimed',syncEligible:true,leaseGeneration:JSON.stringify([owner,null,null,null])};
  s.activateWorkspace(workspace);
  await(await import('/src/lib/offline-lease.js')).runtimeOfflineLease().renew(async()=>({id:owner,source:'supabase-auth-user',verifiedAt:Date.now()}));
  await s.init();
  if(seed){
   // Initial synthetic fixture preparation, before any frozen rejection exists.
   // No database/cache reset occurs during the old→new upgrade.
   await db.clearStore('outbox');
   await db.put('profile',{...s.state.profile,teacherName:'Synthetic teacher',schoolName:'Synthetic school',phone:'0500000001'});
   await db.put('scores',{id:'grade-sentinel',value:19,studentId:'synthetic-student',itemId:'synthetic-item'});
   await db.putMany('outbox',Array.from({length:count},(_,i)=>({id:'held-'+i,ownerId:owner,protocol:'v2',store:i?'calendarDays':'years',entity:i?'calendarDays':'years',state:count===64?(i?'blocked':'rejected'):(i<65?'rejected':'pending'),lastError:{code:'22023',message:'N58 academic rejection'},dependsOn:i?['held-0']:[],updatedAt:1})));
   const cache=await caches.open('unrelated-sentinel');await cache.put('/unrelated-sentinel',new Response('keep'));
   await s.init();
  }
  const summary={state:'rejected',rejectedCount:count===64?1:65,blockedCount:count===64?63:0,pendingCount:count===64?0:2,failedCount:0,queuedCount:count,affectedCategories:['academic'],actionableSyncIssue:true,localWorkSaved:true};
  h.setSync({getSyncOperationalSummary:async()=>summary,getSyncOperationalSummarySnapshot:()=>summary,syncAll:async()=>{throw Error('No retry');}});
  const dom=await import('/src/lib/dom.js');dom.delegate(document.getElementById('app'),h.handlers);dom.delegate(document.getElementById('modal-root'),h.handlers);
  (await import('/src/router.js')).onNavigate(h.resolve);location.hash='/calendar';await h.resolve();await h.refresh();
 },{owner:activeOwner,seed,count,newSession});
 await page.getByRole('button',{name:'إعدادات التقويم والمنطقة',exact:true}).waitFor();
}
async function snapshot(page){return page.evaluate(async()=>({owner:s.getActiveWorkspace().authUserId,auth:localStorage.getItem(c.AUTH_STORAGE_KEY),database:db.getActiveDatabaseName(),rows:Object.fromEntries(await Promise.all(db.STORES.map(async n=>[n,await db.getAll(n)]))),unrelated:await(await caches.open('unrelated-sentinel')).match('/unrelated-sentinel').then(r=>r.text())}));}
async function inspect(page){
 await page.getByRole('button',{name:'إعدادات التقويم والمنطقة',exact:true}).click();
 const cards=page.locator('[data-act="set-region"]');await cards.first().waitFor();
 const result={hold:await page.locator('#calendar-switch-hold').count(),disabled:await cards.evaluateAll(ns=>ns.every(n=>n.disabled)),repair:null};
 await page.getByRole('dialog').getByRole('button',{name:'تم',exact:true}).click();
 await page.locator('[data-act="open-teacher-mini-hub"]:visible').first().click();
 result.repair=await page.locator('[data-act="review-session-repair"]').count();await page.keyboard.press('Escape');return result;
}
const blockExternal=()=>{const fetch0=window.fetch;window.fetch=(input,init)=>new URL(typeof input==='string'?input:input.url,location.href).origin===location.origin?fetch0(input,init):Promise.reject(Error('Synthetic test: external transport forbidden'));window.WebSocket=class{constructor(){throw Error('Synthetic test: external socket forbidden');}};};
let browser;
try{
 browser=await chromium.launch({headless:true});
 for(const scenario of ['v62','http-no-sw','older-sw']){
  release=scenario==='older-sw'?older:old;noSW=scenario==='http-no-sw';
  const context=await browser.newContext({serviceWorkers:'allow',locale:'ar-SA',viewport:{width:390,height:844}});
  // Block external transport in the document, without Playwright routing (which disables HTTP cache).
  await context.addInitScript(blockExternal);
  const page=await context.newPage();page.setDefaultTimeout(20000);
  await page.goto(url+'/#/calendar');await attach(page,true,scenario==='older-sw'?67:64);
  if(!noSW){await page.evaluate(()=>h.register());await page.waitForFunction(()=>!!navigator.serviceWorker.controller);await page.reload();await attach(page);}
  const initial=await inspect(page);assert.equal(initial.hold,0);assert.equal(initial.disabled,false);
  const before=await snapshot(page);assert.equal(before.rows.outbox.length,scenario==='older-sw'?67:64);
  // Exercise the old visible region choice on a separate fresh synthetic owner,
  // leaving the exact 1+63 / 65+2 source-rejection fixture untouched.
  const reproducer=await context.newPage();await reproducer.goto(url+'/#/calendar');
  await attach(reproducer,false,64,'a5800000-0000-4000-8000-000000000013',true);
  await reproducer.getByRole('button',{name:'إعدادات التقويم والمنطقة',exact:true}).click();
  const selectedBefore=await reproducer.evaluate(()=>s.activeYear().calendarPresetId);
  await reproducer.locator('[data-act="set-region"]:not([aria-pressed="true"])').first().click();
  await reproducer.waitForFunction(previous=>window.s.activeYear().calendarPresetId!==previous,selectedBefore);
  await reproducer.waitForFunction(()=>!document.querySelector('[data-act="set-region"]'));
  await reproducer.close();await page.evaluate(auth=>localStorage.setItem(c.AUTH_STORAGE_KEY,auth),before.auth);
  console.log('REPRO '+scenario+': exact old visible region choice changes the synthetic account preset');
  release=fixed?'candidate':base;const mark=hits.length;
  let after;
  for(let i=0;i<3;i++){await page.reload();await attach(page,false,scenario==='older-sw'?67:64);after=await inspect(page);if(!noSW)await page.evaluate(()=>h.register());await page.waitForTimeout(1200);}
  console.log(JSON.stringify({scenario,oldRelease:scenario==='older-sw'?older:old,target:release,initial,after,networkCalendar:hits.slice(mark).filter(x=>x.path==='src/views/calendar.js'),networkSW:hits.slice(mark).filter(x=>x.path==='sw.js')}));
  if(fixed){
   assert.equal(after.hold,1);assert.equal(after.disabled,true);assert.equal(after.repair,0);assert.deepEqual(await snapshot(page),before);
   await page.getByRole('button',{name:'إعدادات التقويم والمنطقة',exact:true}).click();
   const target=page.locator('[data-act="set-region"]:not([aria-pressed="true"])').first();
   assert.equal(await target.evaluate(n=>getComputedStyle(n).cursor), 'not-allowed');await target.evaluate(n=>{n.disabled=false;n.click();});
   assert.match(await page.locator('#toast').innerText(),/تغيير التقويم متوقف/);
   const denied=await page.evaluate(async()=>{const current=s.activeYear().calendarPresetId,p=await import('/src/lib/calendar-presets.js');return s.applyCalendarPreset(current===p.WESTERN_1448_1449_PRESET_ID?p.GENERAL_1448_1449_PRESET_ID:p.WESTERN_1448_1449_PRESET_ID,{activate:true});});
   assert.equal(denied.reason,'calendar-switch-temporary-hold');assert.deepEqual(await snapshot(page),before);
   await page.getByRole('dialog').getByRole('button',{name:'تم',exact:true}).click();
   // Close/reopen the page without reinstalling or resetting its browser/storage.
   await page.close();const restarted=await context.newPage();await restarted.goto(url+'/#/calendar');await attach(restarted,false,scenario==='older-sw'?67:64);assert.deepEqual(await snapshot(restarted),before);assert.equal((await inspect(restarted)).hold,1);
   if(!noSW){await restarted.evaluate(()=>h.register());await restarted.waitForTimeout(2000);await context.setOffline(true);await restarted.reload();await attach(restarted,false,scenario==='older-sw'?67:64);assert.equal((await inspect(restarted)).hold,1);assert.deepEqual(await snapshot(restarted),before);await context.setOffline(false);}
   // A different fresh owner in this already-used browser must inherit code,
   // never the prior account's records. Keep the original owner's DB intact.
   const freshPage=await context.newPage();await freshPage.goto(url+'/#/calendar');
   const freshOwner='a5800000-0000-4000-8000-000000000012';
   await attach(freshPage,false,64,freshOwner,true);const fresh=await snapshot(freshPage);
   assert.equal(fresh.owner,freshOwner);assert.notEqual(fresh.database,before.database);
   assert.deepEqual(fresh.rows.scores,[]);assert.ok(fresh.rows.outbox.every(r=>r.ownerId===freshOwner&&r.bootstrap===true));assert.equal((await inspect(freshPage)).hold,1);
   // Unchanged eligible repair through the upgraded actual teacher-center UI.
   await freshPage.evaluate(async()=>{
    const auth=x=>({...x,serverRevision:1,deleted:false});
    const data={years:[auth({id:'y',hijriStart:1448,hijriEnd:1449,label:'1448',calendarPresetId:'sa-western-1448-1449',fieldRevisions:{calendar_selection:3}})],terms:[auth({id:'term',yearId:'y',name:'term',startDate:'2026-08-01',endDate:'2026-12-31'})],sections:[auth({id:'section',yearId:'y',name:'class'})],subjects:[auth({id:'subject'})],teachings:[auth({id:'teaching',termId:'term',sectionId:'section',subjectId:'subject'})],sessions:[{id:'session',canonicalId:'session',teachingId:'teaching',date:'2026-10-14',period:1,status:'planned',serverRevision:0,deleted:false}],outbox:[{id:'v2:original',protocol:'v2',entity:'sessions',store:'sessions',recordId:'session',serverRecordId:'session',logicalRecordKey:'sessions:session',ownerId:c.user.id,mutationId:'original',deviceId:'synthetic',op:'create',state:'rejected',baseRevision:0,queuedAt:Date.parse('2026-10-14T12:00:00Z'),sequence:1,envelopeLocked:true,attemptCount:1,localPatch:{teachingId:'teaching',date:'2026-10-14',period:1,status:'planned'},patch:{teaching_id:'teaching',date:'2026-10-14',period:1,status:'planned'},lastError:{code:'22023',message:'N58_SESSION_CONTEXT_REQUIRED',at:3},dependencies:[]}]};
    for(const [name,rows]of Object.entries(data))await db.putMany(name,rows);
    const plan=await s.reviewRejectedSessionRepairs();if(!plan.entries.some(e=>e.status==='review'))throw Error('Eligible fixture invalid');await h.refresh();
   });
   const eligibleBefore=await snapshot(freshPage);
   await freshPage.locator('[data-act="open-teacher-mini-hub"]:visible').first().click();await freshPage.locator('[data-act="review-session-repair"]').click();
   assert.equal(await freshPage.locator('[data-confirm-session-repair]').isDisabled(),true);await freshPage.locator('[data-repair-entry]').check();assert.equal(await freshPage.locator('[data-confirm-session-repair]').isEnabled(),true);
   await freshPage.keyboard.press('Escape');await freshPage.keyboard.press('Escape');assert.deepEqual(await snapshot(freshPage),eligibleBefore);
   await freshPage.close();await restarted.evaluate(auth=>localStorage.setItem(c.AUTH_STORAGE_KEY,auth),before.auth);await restarted.reload();await attach(restarted,false,scenario==='older-sw'?67:64);assert.deepEqual(await snapshot(restarted),before);
   console.log('PASS '+scenario+': old→new UI, stale handler/store HOLD, owner/all IDB rows/grades/outbox/unrelated cache, restart'+(!noSW?' and offline':''));
  }
  await context.close();
 }
 if(fixed){
  release='candidate';realBoot=true;noSW=false;
  for(const path of ['index.html','sw.js','src/lib/app-update.js','src/store.js','src/views/calendar.js']){
   const response=await fetch(url+'/'+path);assert.equal(response.headers.get('cache-control'),'no-cache, max-age=0, must-revalidate');
   const actual=Buffer.from(await response.arrayBuffer()),expected=await readFile(resolve(root,path));assert.equal(createHash('sha256').update(actual).digest('hex'),createHash('sha256').update(expected).digest('hex'));
  }
  console.log('PASS ordinary uncached static URL bytes and actual _headers directives; browser cached-path network traces above');
  const context=await browser.newContext({serviceWorkers:'allow',locale:'ar-SA',viewport:{width:390,height:844}});
  await context.addInitScript(blockExternal);await context.addInitScript(()=>{if(!sessionStorage.getItem('rakeezx-demo-session-v1'))sessionStorage.setItem('rakeezx-demo-session-v1','preparing');});
  const page=await context.newPage();await openReadyServedDemo(page,url);
  await page.waitForFunction(async()=>navigator.serviceWorker.controller&&!!(await(await caches.open('rakeezx-v63')).match('./src/lib/app-update.js')));
  await page.goto(url+'/#/calendar');await page.getByRole('button',{name:'إعدادات التقويم والمنطقة',exact:true}).click();assert.equal(await page.locator('#calendar-switch-hold').count(),1);await page.keyboard.press('Escape');
  await context.setOffline(true);await page.reload();await page.locator('.boot').waitFor({state:'detached'});
  await page.waitForFunction(async()=>{const s=await import('/src/store.js');return s.state.ready&&s.getActiveWorkspace()?.type==='demo'&&document.querySelector('.layout');});
  await page.getByRole('button',{name:'إعدادات التقويم والمنطقة',exact:true}).click();assert.equal(await page.locator('#calendar-switch-hold').count(),1);
  await context.close();console.log('PASS real unchanged boot → startup → current SW shell → offline reload: existing served Demo helper, actual handlers/CSS');
  // Failure must not start an old/mixed graph, nor automatically reload/retry.
  noSW=true;blockedAsset='src/store.js';
  const failed=await browser.newContext({serviceWorkers:'allow'});await failed.addInitScript(blockExternal);await failed.addInitScript(()=>localStorage.setItem('pending-edit-sentinel','keep'));
  const failedPage=await failed.newPage();await failedPage.goto(url);await failedPage.getByRole('button',{name:'إعادة المحاولة',exact:true}).waitFor();
  assert.equal(await failedPage.locator('.layout').count(),0);assert.equal(await failedPage.evaluate(()=>localStorage.getItem('pending-edit-sentinel')),'keep');
  blockedAsset=null;await failedPage.getByRole('button',{name:'إعادة المحاولة',exact:true}).click();await failedPage.locator('[data-workspace-login]').waitFor();assert.equal(await failedPage.evaluate(()=>localStorage.getItem('pending-edit-sentinel')),'keep');
  await failed.close();console.log('PASS bootstrap failed refresh waits for explicit retry, then real signed-out boot; no reload/storage reset');
 }
}finally{await browser?.close();await new Promise(r=>server.close(r));}
