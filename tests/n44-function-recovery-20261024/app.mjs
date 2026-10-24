// AI: actual application HTTP DOM, handlers, CSS, owner guard; synthetic native ports only.
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import {readFile, writeFile} from 'node:fs/promises';
import {createECDH} from 'node:crypto';
import {withIsolatedLocalBrowser} from '../../scripts/ops-supervisor-v4/isolated-local-browser.mjs';
import {openReadyServedDemo} from '../helpers/served-demo-readiness.mjs';
import {installNative} from '../n44-confirmed-projection-20261024/runtime.mjs';
const baseline = process.argv.includes('--baseline');
const taskId='continuous-n44-projection-and-preference-recovery-isolated-20261024', runId='307de1f7-0481-4f93-b3ca-8b3d69c5bae1';
const report={baseline, checks:[], cleanup:{}};
const pass=(name,evidence)=>report.checks.push({name,status:'PASS',evidence});
const curve=createECDH('prime256v1');curve.generateKeys();const publicKey=curve.getPublicKey().toString('base64url');
let enabled=false, remote=null, receipt=null, failRevoke=false, failUpdate=false, calls=[], loseStop=false, projectionMode='normal', materialized=new Map();
const root=process.cwd(), mime={'.js':'text/javascript','.mjs':'text/javascript','.html':'text/html','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2'};
const server=http.createServer(async(req,res)=>{
 const u=new URL(req.url,'http://127.0.0.1');
 if(u.pathname.startsWith('/api/n44/')){
  let raw='';for await(const p of req)raw+=p;const b=JSON.parse(raw);calls.push({path:u.pathname,body:b,authorization:req.headers.authorization});let v={status:'disabled'};
  if(u.pathname.endsWith('/push/config')&&enabled)v={status:'ready',protocol:'n44-browser-v2',capability:'n44-single-device-20261019-v1',serviceRevision:'n44-browser-service-v2',serviceSourceSha:'a'.repeat(40),publicKey,expiresAt:Date.now()+3600000,deliveryEnabled:false,schedulerEnabled:false};
  if(u.pathname.endsWith('/context/read'))v={protocol:'n44-browser-v2',status:remote?'current':'absent',context:remote,registration:receipt,expectedRevision:null};
  if(u.pathname.endsWith('/context/update')){
   if(failUpdate)return res.writeHead(503).end();
   if(b.expectedRevision!==(remote?.consentRevision??null))return res.writeHead(200,{'content-type':'application/json'}).end(JSON.stringify({status:'stale'}));
   remote={...b,active:true,sessionRevision:'synthetic-session',consentRevision:crypto.randomUUID(),sessionExpiresAt:Date.now()+3600000};
   receipt=null;v={status:'updated',context:remote};
   if(loseStop && b.pushConsent===false){loseStop=false;return req.socket.destroy();}
  }
  if(u.pathname.endsWith('/push/register')){receipt??={status:'registered',registrationId:b.registrationId,expiresAt:Date.now()+1800000};v=receipt;}
  if(u.pathname.endsWith('/push/revoke')){if(failRevoke)return res.writeHead(503).end();receipt=null;v={status:'revoked'};}
  if(u.pathname.endsWith('/events/update')){
   const key=b.kind+':'+b.sourceId;
   if(projectionMode==='unknown')v={status:'unknown',sourceStamp:'c'.repeat(64)};
   else if(projectionMode==='empty'){materialized.delete(key);v={status:'updated',sourceStamp:null};}
   else {materialized.set(key,'b'.repeat(64));v={status:'updated',sourceStamp:'b'.repeat(64)};}
  }
  res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});return res.end(JSON.stringify(v));
 }
 const file=path.resolve(root,'.'+decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname));
 if(!file.startsWith(root+path.sep))return res.writeHead(403).end();
 try{res.writeHead(200,{'content-type':mime[path.extname(file)]??'application/octet-stream'});res.end(await readFile(file));}catch{res.writeHead(404).end();}
});
const snapshot=page=>page.evaluate(()=> n44Runtime.snapshot());
const paint=page=>page.evaluate(async()=>{(await import('/src/app.js')).repaint();});
try{
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));const url='http://127.0.0.1:'+server.address().port;
 await withIsolatedLocalBrowser({taskFile:'C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/'+taskId+'.json',runId,url,timeoutMs:120000},async({createContext})=>{
  async function setup(){enabled=false;remote=null;receipt=null;calls=[];failRevoke=false;failUpdate=false;loseStop=false;materialized=new Map();const context=await createContext({viewport:{width:390,height:844},locale:'ar-SA',timezoneId:'Asia/Riyadh'});await context.addInitScript(installNative);const page=await context.newPage();page.setDefaultTimeout(8000);await openReadyServedDemo(page,url);enabled=true;
   assert.deepEqual(await page.evaluate(async()=> (await import('/tests/n44-confirmed-projection-20261024/engine.mjs')).prepare()),{ownerMatches:true,receiptMatches:true,editable:true});
   await page.evaluate(async()=>{window.n44Runtime=(await import('/src/lib/notification-push-runtime.js')).getPushRuntime();});await page.locator('[data-act="notification-push"]').click();await page.waitForFunction(()=> n44Runtime.snapshot().status==='subscribed');await page.evaluate(async()=> (await import('/src/lib/notification-push-runtime.js')).getPushRuntime().optIn());await page.waitForFunction(()=>n44Native.inflight===0&&performance.now()-(n44Native.lastProjection??0)>100);return {context,page};}
  {
   const {context,page}=await setup();failRevoke=true;
   await page.evaluate(async()=>{window.n44Runtime=(await import('/src/lib/notification-push-runtime.js')).getPushRuntime();});await page.locator('[data-act="notification-push"]').click();await page.waitForFunction(()=> n44Runtime.snapshot().status==='cleanup_pending' && !n44Runtime.snapshot().cleanupBusy);await paint(page);
   if(baseline){assert.equal((await snapshot(page)).available,false);assert.equal(await page.locator('[data-act="notification-push"]').count(),0);pass('reproduced inaccessible cleanup retry','Actual disable fails revoke; available=false; actual settings DOM has no retry.');}
   else{
    assert.equal((await snapshot(page)).available,false);assert.equal((await snapshot(page)).cleanupAvailable,true);
    const retry=page.getByRole('button',{name:'إعادة محاولة الإيقاف',exact:true});assert.equal(await retry.count(),1);assert.equal(await retry.isEnabled(),true);
    failRevoke=false;const retried=page.waitForResponse(r=>r.url().endsWith('/context/update')&&r.request().postDataJSON().pushConsent===false);await retry.click();await retried;await page.waitForFunction(()=> n44Runtime.snapshot().status==='unsubscribed');
    assert.equal(remote.pushConsent,false);assert.equal(receipt,null);assert.equal(await page.evaluate(()=>n44Native.subscription),null);pass('owned failed revoke retry via actual settings DOM','Visible enabled retry completes original cleanup, consent false and unsubscribe; no new registration.');
    await paint(page);assert.equal(await page.locator('[data-act="notification-push"]').innerText(),'تفعيل تذكيرات الجهاز');
   }await context.close();
  }
  for(const selector of ['[data-act="notification-minutes"][data-minutes="30"]','[data-act="notification-day"][data-day="1"]','[data-act="notification-category"][data-kind="due"]','[data-act="notification-push-quiet"]']){
   const {context,page}=await setup();const registrations=calls.filter(x=>x.path.endsWith('/push/register')).length;
   const stopped=page.waitForResponse(r=>r.url().endsWith('/context/update')&&r.request().postDataJSON().pushConsent===false);await page.locator(selector).click();await stopped;await page.waitForFunction(()=> n44Runtime.snapshot().status==='unsubscribed');await paint(page);
   assert.equal(remote.pushConsent,false,JSON.stringify({selector,calls}));assert.equal(receipt,null);assert.equal(calls.filter(x=>x.path.endsWith('/push/register')).length,registrations);
   if(baseline){assert.equal(await page.getByText('أُوقفت تذكيرات الجهاز بعد تعديل التفضيلات. أعد تفعيلها لتطبيق التفضيلات الجديدة.',{exact:true}).count(),0);}
   else{
    assert.equal(await page.getByText('أُوقفت تذكيرات الجهاز بعد تعديل التفضيلات. أعد تفعيلها لتطبيق التفضيلات الجديدة.',{exact:true}).count(),1,JSON.stringify(await snapshot(page)));
    const selected=remote.preferences;if(selector.includes('minutes'))assert.equal(selected.lessonMinutes,30);if(selector.includes('notification-day'))assert.equal(selected.dueDays.includes(1),false);if(selector.includes('notification-category'))assert.equal(selected.due,false);if(selector.includes('quiet'))assert.deepEqual(selected.quiet,{start:1320,end:420});
    await page.evaluate(async()=>{window.n44Runtime=(await import('/src/lib/notification-push-runtime.js')).getPushRuntime();});await page.locator('[data-act="notification-push"]').click();await page.waitForFunction(()=> n44Runtime.snapshot().status==='subscribed');assert.equal(remote.pushConsent,true);assert.equal(calls.filter(x=>x.path.endsWith('/push/register')).length,registrations+1);
    assert.equal(await page.getByText('أُوقفت تذكيرات الجهاز بعد تعديل التفضيلات. أعد تفعيلها لتطبيق التفضيلات الجديدة.',{exact:true}).count(),0);
   }pass((baseline?'reproduced silent stop ':'explicit preference stop/re-opt-in ')+selector,'Actual delegated handler; consent false; no implicit registration; selected preferences applied.');await context.close();
  }
  if(!baseline){
   const {context,page}=await setup();failRevoke=true;await page.locator('[data-act="notification-push"]').click();await page.waitForFunction(()=> n44Runtime.snapshot().cleanupAvailable===true && !n44Runtime.snapshot().cleanupBusy);await paint(page);
   const oldScope=await page.locator('[data-act="notification-push"]').getAttribute('data-scope');
   await page.evaluate(async()=>{const c=await import('/src/lib/cloud.js');c.setMockAuth({id:'b4400000-0000-4000-8000-000000000002'},{access_token:'foreign-synthetic'});});
   const before=calls.length;assert.equal((await snapshot(page)).cleanupAvailable,false);
   await page.evaluate(async oldScope=>{const v=(await import('/src/views/notification-settings.js')).default;await v.actions['notification-push']({dataset:{scope:oldScope}});const r=(await import('/src/lib/notification-push-runtime.js')).getPushRuntime();return r.disable();},oldScope);
   assert.equal(calls.length,before);pass('owner switch refuses stale settings handler and direct cleanup retry','Original cleanup association retained; foreign binding cannot use retry, consent update or registration.');await context.close();
   const second=await setup();failUpdate=true;await second.page.locator('[data-act="notification-minutes"][data-minutes="30"]').click();await second.page.waitForFunction(()=> n44Runtime.snapshot().status==='cleanup_pending' && !n44Runtime.snapshot().cleanupBusy);await paint(second.page);assert.equal(await second.page.getByRole('button',{name:'إعادة محاولة الإيقاف',exact:true}).count(),1);failUpdate=false;await second.page.getByRole('button',{name:'إعادة محاولة الإيقاف',exact:true}).click();await second.page.waitForFunction(()=> n44Runtime.snapshot().status==='unsubscribed');assert.equal(remote.preferences.lessonMinutes,30);assert.equal(remote.pushConsent,false);
   const geometry=await second.page.locator('.n44-settings-page').evaluate(el=>({visible:getComputedStyle(el).display!=='none',overflow:document.documentElement.scrollWidth>innerWidth+1}));assert.deepEqual(geometry,{visible:true,overflow:false});pass('failed context update retry and source CSS','Failed response preserves retry and latest preferences; actual 390px application DOM visible without horizontal overflow.');await second.context.close();
   const lost=await setup();loseStop=true;await lost.page.locator('[data-act="notification-push-quiet"]').click();await lost.page.waitForFunction(()=>n44Runtime.snapshot().status==='cleanup_pending'&&!n44Runtime.snapshot().cleanupBusy);await paint(lost.page);assert.equal(remote.pushConsent,false);
   assert.equal(await lost.page.getByText('لم يكتمل الإيقاف. أعد المحاولة.',{exact:true}).count(),1);assert.equal(await lost.page.getByText('أُوقفت تذكيرات الجهاز بعد تعديل التفضيلات. أعد تفعيلها لتطبيق التفضيلات الجديدة.',{exact:true}).count(),0);
   const writes=calls.filter(x=>x.path.endsWith('/context/update')).length;
   assert.equal((await lost.page.evaluate(()=>n44Runtime.optIn())).status,'unavailable');await lost.page.evaluate(()=>n44Runtime.refresh());assert.equal((await snapshot(lost.page)).available,false);
   await lost.page.getByRole('button',{name:'إعادة محاولة الإيقاف',exact:true}).click();await lost.page.waitForFunction(()=>n44Runtime.snapshot().status==='unsubscribed');assert.equal(calls.filter(x=>x.path.endsWith('/context/update')).length,writes);assert.equal(calls.filter(x=>x.path.endsWith('/push/register')).length,1);pass('actual runtime lost committed stop ACK and explicit readback retry','Network response lost after synthetic commit; opt-in/focus blocked while UNKNOWN; owned retry only reads committed consent false/quiet preferences, no replay/registration.');await lost.context.close();
   projectionMode='empty';const projected=await setup();
   const project=async()=>{await projected.page.evaluate(async()=>{const s=await import('/src/store.js'),c=await import('/src/lib/cloud.js');await n44Runtime.projectConfirmedSources({workspace:s.getActiveWorkspace(),session:c.session});});await projected.page.waitForFunction(()=>n44Native.inflight===0&&performance.now()-(n44Native.lastProjection??0)>100);};
   calls=[];projectionMode='normal';await projected.page.evaluate(async()=>{await (await import('/src/store.js')).renameScoreParent('n44-item','Current canonical edited parent');});await project();
   const due=calls.filter(x=>x.path.endsWith('/events/update')&&x.body.sourceId==='n44-due');assert.ok(due.length);assert.equal(due[0].body.expectedStamp,null);assert.equal(materialized.get('due:n44-due'),'b'.repeat(64));
   const count=materialized.size;projectionMode='unknown';await project();projectionMode='normal';calls=[];await project();assert.equal(calls.find(x=>x.path.endsWith('/events/update')&&x.body.sourceId==='n44-due').body.expectedStamp,'b'.repeat(64));assert.equal(materialized.size,count);pass('actual runtime canonical ACK after empty projection and UNKNOWN stamp retention','Real store rename/receipt/handler; runtime carries null after empty, retains last acknowledged stamp after UNKNOWN, repeats without duplicate synthetic events. Backend computation separately qualified in native PG.');await projected.context.close();
  }
 });report.cleanup.browserClosed=true;
}catch(e){report.failure={message:e.message,stack:e.stack,calls,remote};process.exitCode=1;console.error(e);}
finally{server.closeAllConnections();await new Promise(ok=>server.close(ok));report.cleanup.serverClosed=true;report.status=process.exitCode?'FAIL':'PASS';await writeFile('tests/n44-function-recovery-20261024/'+(baseline?'app-before.json':'app.json'),JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify(report));
