// AI: actual app/OTP handlers, source CSS, real workspace/lease guards; loopback-only synthetic Auth.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {execFileSync} from 'node:child_process';
import {withIsolatedLocalBrowser} from 'file:///C:/Users/Abody/Projects/RakeezX/scripts/ops-supervisor-v4/isolated-local-browser.mjs';
const taskId='continuous-n112-logged-out-login-banner-20261019',runId='f6c1b1a8-5116-4eb6-9aee-8443038ea4db';
const baseline=process.argv.includes('--baseline'),root=resolve('.'),owner='a1120000-0000-4000-8000-000000000001';
let expired=false,rejectOtp=true,userReads=0;
const evidence={taskId,runId,baseline,checks:[],errors:[]};
const session=()=>({access_token:'synthetic-n112-only',refresh_token:'synthetic-n112-refresh',expires_at:Math.floor(Date.now()/1000)+3600,user:{id:owner,email:'n112@example.test'}});
const server=createServer(async(req,res)=>{try{
 const pathname=new URL(req.url,'http://localhost').pathname;
 if(pathname.startsWith('/__auth/')){
  res.setHeader('Content-Type','application/json');
  if(pathname.endsWith('/otp'))return res.writeHead(204).end();
  if(pathname.endsWith('/verify'))return res.writeHead(rejectOtp?400:200).end(JSON.stringify(rejectOtp?{message:'Invalid OTP',code:'otp_invalid'}:session()));
  if(pathname.endsWith('/user')){userReads++;return res.writeHead(expired?401:200).end(JSON.stringify(expired?{message:'Expired synthetic session'}:session().user));}
  return res.writeHead(404).end('{}');
 }
 const file=resolve(root,pathname==='/'?'index.html':'.'+decodeURIComponent(pathname));
 if(!file.startsWith(root+sep))throw Error('Outside app root');
 let body=await readFile(file);
 if(baseline&&pathname==='/src/app.js')body=execFileSync('git',['show','80d7a264596cb38c1856796c0c30c23dbbb6b49f:src/app.js']);
 // Only the transport base changes. All Auth requests, persistence and notifications remain real source.
 if(pathname==='/src/lib/cloud.js')body=body.toString().replace("export const SUPABASE_URL = 'https://xlrubcwjqktzzunrvuns.supabase.co';","export const SUPABASE_URL = location.origin + '/__auth';");
 res.setHeader('Content-Type',{'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2','.png':'image/png','.webmanifest':'application/manifest+json'}[extname(file)]??'application/octet-stream');
 res.setHeader('Cache-Control','no-store');res.end(body);
}catch{res.writeHead(404).end();}});
const record=(name,detail)=>evidence.checks.push({name,status:'PASS',evidence:detail});
const checkpoint=page=>page.evaluate(async()=>{
 const s=await import('/src/store.js'),db=await import('/src/lib/db.js');
 return {workspace:s.getActiveWorkspace(),data:await Promise.all(['students','scores','outbox','sessions','device'].map(n=>db.getAll(n)))};
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const url='http://127.0.0.1:'+server.address().port;
await mkdir('tests/fixtures/n112-1019',{recursive:true});
try{
 await withIsolatedLocalBrowser({taskFile:'C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/'+taskId+'.json',runId,url,timeoutMs:90000},async({createContext})=>{
  const context=await createContext({viewport:{width:390,height:844},locale:'ar-SA'}),page=await context.newPage();
  page.setDefaultTimeout(10000);page.on('pageerror',e=>evidence.errors.push(e.message));
  await page.goto(url);await page.locator('[data-workspace-login]').waitFor();
  // Prepare a small restored account using the existing registry and DB APIs before real boot.
  await page.evaluate(async({owner,session})=>{
   const w=await import('/src/lib/workspaces.js'),db=await import('/src/lib/db.js'),c=await import('/src/lib/cloud.js');
   db.selectDatabase(await w.accountWorkspaceDatabaseName(owner));await db.openDB();
   const receipt={ownerId:owner,protocol:'CORE_V2',restoreId:'n112-restore',manifestHash:'n112-manifest',completedAt:Date.now()};
   await db.put('device',{id:'device',initialRestoreReceipt:receipt});
   const registry=w.createWorkspaceRegistry();try{
    await registry.beginAccountRestore(owner,receipt);await registry.updateAccountRestore(owner,receipt.restoreId,{phase:'RESTORE_COMPLETE'});await registry.finalizeAccountRestore(owner,receipt);
   }finally{await registry.close();}
   localStorage.setItem(c.AUTH_STORAGE_KEY,JSON.stringify(session));
  },{owner,session:session()});
  await page.reload();await page.locator('.layout').waitFor();
  await page.waitForFunction(async()=>{const s=await import('/src/store.js');return s.state.ready&&s.getOfflineLeaseStatus().state==='NORMAL';});
  // Read owner, DB and restore receipt together in this post-reload document.
  const ready=await page.evaluate(async()=>{const s=await import('/src/store.js'),db=await import('/src/lib/db.js');return {owner:s.getActiveWorkspace().authUserId,database:s.getActiveWorkspace().databaseName,actual:db.getActiveDatabaseName(),receipt:(await db.get('device','device')).initialRestoreReceipt.ownerId};});
  assert.equal(ready.owner,owner);assert.equal(ready.receipt,owner);assert.equal(ready.database,ready.actual);
  await page.evaluate(async({owner})=>{
   const db=await import('/src/lib/db.js');
   await db.put('students',{id:'n112-student',ownerId:owner,name:'Synthetic',deleted:false});
   await db.put('scores',{id:'n112-score',ownerId:owner,value:7,studentId:'n112-student'});
   await db.put('outbox',{id:'n112-pending',ownerId:owner,state:'pending',store:'scores',recordId:'n112-score',lastError:{message:'synthetic pending'}});
  },{owner});
  const before=await checkpoint(page);
  expired=true;
  await page.evaluate(async()=>{const c=await import('/src/lib/cloud.js');try{await c.verifyCurrentAuthIdentity(c.user.id);}catch{}});
  const banner=page.locator('.offline-lease-notice');await banner.waitFor();
  if(baseline){
   assert.equal(await banner.locator('button').innerText(),'التحقق من الحساب');
   record('baseline_reproduced','Expired Auth identity leaves the top banner asking for account verification.');return;
  }
  assert.equal(await banner.locator('button').innerText(),'تسجيل الدخول');
  assert.equal(await banner.locator('[data-act="renew-offline-lease"]').count(),0);
  assert.equal(await banner.evaluate(e=>getComputedStyle(e).display),'flex');
  await page.screenshot({path:'tests/fixtures/n112-1019/signed-out.png'});
  await banner.locator('button').click();await page.locator('#mini-hub-login-form').waitFor();
  await page.locator('#mini-hub-login-form input[name=email]').fill('n112@example.test');
  await page.getByRole('button',{name:'إرسال رمز التحقق',exact:true}).click();
  await page.locator('#mini-hub-login-form input[name=token]').fill('123456');
  await page.getByRole('button',{name:'تحقق وتسجيل الدخول',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('[data-email-otp-feedback]')?.textContent||!document.querySelector('button[form="mini-hub-login-form"]').disabled);
  assert.equal(await banner.locator('button').innerText(),'تسجيل الدخول');
  record('rejected_login_preserves_warning','An invalid synthetic OTP leaves the login banner and pending local data intact.');
  rejectOtp=false;expired=false;const readsBefore=userReads;
  await page.getByRole('button',{name:'تحقق وتسجيل الدخول',exact:true}).click();
  await banner.waitFor({state:'detached'});
  await page.waitForFunction(async()=>{const s=await import('/src/store.js');return s.getOfflineLeaseStatus().state==='NORMAL';});
  assert.ok(userReads>readsBefore,'Successful OTP must verify the owned identity before lease renewal');
  assert.deepEqual(await checkpoint(page),before);
  record('n112_logged_out_login_route_and_automatic_banner_clear','Real expired-identity notification → existing login sheet → rejected OTP retained warning → successful OTP and guarded /user verification cleared banner without refresh or extra action; owner/receipt/DB and pending/grade/history rows unchanged.');
  // A verified owner with an aged receipt remains offline-capable and gets connection copy.
  await page.evaluate(async()=>{
   const s=await import('/src/store.js'),l=await import('/src/lib/offline-lease.js');s.getOfflineLeaseStatus();
   const aged=l.createOfflineLease({now:()=>Date.now()-8*86400000});
   aged.setContext(s.getActiveWorkspace(),s.getActiveWorkspace().authUserId);
   await aged.renew(async id=>({id,source:'supabase-auth-user',verifiedAt:Date.now()-8*86400000}));
  });
  await context.setOffline(true);
  await page.evaluate(async()=>{const c=await import('/src/lib/cloud.js');try{await c.verifyCurrentAuthIdentity(c.user.id);}catch{}const a=await import('/src/app.js');a.repaint();});
  await page.locator('[data-act="renew-offline-lease"]').waitFor();
  assert.equal(await banner.locator('[data-act="mini-hub-login"]').count(),0);
  const offline=await page.evaluate(async()=>{const s=await import('/src/store.js'),c=await import('/src/lib/cloud.js');return {lease:s.getOfflineLeaseStatus(),auth:c.authStatus().state};});
  assert.equal(offline.auth,'authenticated');assert.equal(offline.lease.state,'REMINDER');assert.equal(offline.lease.editable,true);
  assert.deepEqual(await checkpoint(page),before);
  await page.screenshot({path:'tests/fixtures/n112-1019/offline-verified.png'});
  record('offline_verified_distinction','Offline /user network failure retains authenticated owner, editable REMINDER and account-verification action; no login prompt and no Product data changes.');
  assert.deepEqual(evidence.errors,[]);
 });
}catch(error){evidence.failure=error.stack;throw error;}
finally{await new Promise(done=>server.close(done));await writeFile('tests/n112-1019'+(baseline?'-baseline':'-browser')+'.json',JSON.stringify(evidence,null,2)+'\n');}
console.log(JSON.stringify(evidence,null,2));
