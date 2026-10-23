// AI: affected real mounted account/store/native IDB transaction checks, no external service.
import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {createServer} from 'node:http';import {resolve,extname,sep} from 'node:path';
import {withIsolatedLocalBrowser} from '../../../../scripts/ops-supervisor-v4/isolated-local-browser.mjs';
const taskId='continuous-n36-0539-profile-transaction-continuation-20261023',runId='ea53b34e-ed33-4ee6-b0e9-659a62fc8a2e',base='http://127.0.0.1:49974',root=resolve('.'),folder='tests/n36-0539-profile-transaction-20261023/';
const server=createServer(async(req,res)=>{try{const u=new URL(req.url,base),f=resolve(root,u.pathname==='/'?'index.html':'.'+decodeURIComponent(u.pathname));assert.ok(f.startsWith(root+sep));let bytes=await fs.readFile(f);if(u.pathname==='/')bytes=Buffer.from(bytes.toString().replace(/<script type="module">[\s\S]*?<\/script>/,'<script type="module" src="/tests/n36-complete-import-outcome-20261023/bootstrap.mjs"></script>'));res.setHeader('content-type',({'.html':'text/html;charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2'})[extname(f)]||'application/octet-stream');res.end(bytes);}catch(e){res.writeHead(404);res.end(e.message);}});
const result={taskId,runId,cases:[]};
try{await new Promise(r=>server.listen(49974,'127.0.0.1',r));await withIsolatedLocalBrowser({taskFile:'C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/'+taskId+'.json',runId,url:base,timeoutMs:120000},async({createContext})=>{
for(const mode of ['ack-noop','unrelated-edit','own-defaults','same-field','foreign','session','term','rollback']){
const c=await createContext({viewport:{width:1100,height:900},locale:'ar-SA'}),row={mode};try{const app=await c.newPage();await app.goto(base+'/#/classes/koshoof?import=1');await app.waitForFunction(()=>window.fixtureReady&&window.releaseAuth);await app.evaluate(()=>{window.authReleased=true;window.releaseAuth();});await app.waitForFunction(async()=>{const s=await import('/src/store.js');return s.state.ready&&s.getOfflineLeaseStatus().editable;});
row.proof=await app.evaluate(async mode=>{
const s=await import('/src/store.js'),d=await import('/src/lib/db.js'),cl=await import('/src/lib/cloud.js'),v=await import('/src/lib/sync-v2.js'),g=await import('/src/lib/sync-ownership.js');
const serial=x=>JSON.stringify(x),check=(ok,label)=>{if(!ok)throw Error(label);};
// Ordinary own edit uses the actual generic patchProfile path (raw shape), then
// setup must tolerate defaults while preserving the unrelated edited phone.
if(mode==='own-defaults')await s.patchProfile({phone:'0500000002'});
const prior=structuredClone(s.state.profile),raw=await d.get('profile','profile'),outbox=await d.getAll('outbox');
let changes={teacherName:prior.teacherName},expected=null;
if(mode==='ack-noop'){const engine=v.createSyncV2Engine({database:d,ownershipGuard:g.runtimeSyncOwnershipGuard,currentAuthenticatedUserId:()=>cl.user.id});await engine.reconcilePull('profile',[{id:'profile',owner_id:cl.user.id,revision:Number(raw.serverRevision??0)+1,deleted_at:null,...v.encodeSyncV2Patch('profile',raw)}]);}
if(mode==='unrelated-edit'){await d.put('profile',{...raw,phone:'0500000003'});changes={schoolName:'مدرسة اصطناعية'};}
if(mode==='same-field'){await d.put('profile',{...raw,teacherName:'تحرير متزامن'});expected='SETUP_PROFILE_CHANGED';}
if(mode==='foreign'){await d.put('profile',{...raw,ownerId:'b7300000-0000-4000-8000-000000000002'});expected='SETUP_PROFILE_OWNER';}
const original=IDBDatabase.prototype.transaction;
if(['session','term','rollback'].includes(mode)){
IDBDatabase.prototype.transaction=function(names,kind,...args){
if(kind==='readwrite'&&Array.isArray(names)&&names.includes('profile')&&names.includes('years')&&!window.injected){window.injected=true;
if(mode==='session')cl.setMockAuth(cl.user,{...cl.session,access_token:'changed-synthetic'});
if(mode==='term'){const tx=original.call(this,['device'],'readwrite'),r=tx.objectStore('device').get('device');r.onsuccess=()=>tx.objectStore('device').put({...r.result,activeTermId:'foreign-term'});}
if(mode==='rollback'){const tx=original.call(this,names,kind,...args);const put=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(value,...a){if(this.name==='outbox'){IDBObjectStore.prototype.put=put;throw new DOMException('Synthetic storage exhaustion','QuotaExceededError');}return put.call(this,value,...a);};return tx;}
}return original.call(this,names,kind,...args);};
expected=mode==='session'?'SETUP_PROFILE_OWNER':mode==='term'?'BATCH_PERSISTED_TERM_CHANGED':'QuotaExceededError';changes={schoolName:'مدرسة اصطناعية'};
}
const before=await d.get('profile','profile'),beforeOutbox=await d.getAll('outbox');let error=null,returned,verified=0;
try{returned=await s.importSetupProfile(changes,{sourceWins:true,verifyCurrent(current){verified++;if(current&&mode==='term'&&current.device.find(d=>d.id==='device').activeTermId==='foreign-term')throw Error('BATCH_PERSISTED_TERM_CHANGED');}});}catch(e){error=e.code??e.message;}
IDBDatabase.prototype.transaction=original;
const after=await d.get('profile','profile'),afterOutbox=await d.getAll('outbox');
if(expected){check(error===expected,'Expected '+expected+' got '+error);check(serial(before)===serial(after),'failed profile transaction leaked');check(serial(beforeOutbox)===serial(afterOutbox),'failed outbox transaction leaked');}
else{check(!error,'unexpected '+error);check(verified>0,'missing source guard');check(returned.teacherName===changes.teacherName||returned.schoolName===changes.schoolName,'authoritative return');if(mode==='unrelated-edit'){check(after.phone==='0500000003','unrelated edit lost');const added=afterOutbox.filter(e=>!beforeOutbox.some(b=>b.id===e.id));check(added.length===1,'changed field envelope count');check(serial(added[0].fields)===serial(['school_name']),'extra changed fields');}else{check(serial(before)===serial(after),'no-op profile write');check(serial(beforeOutbox)===serial(afterOutbox),'no-op outbox write');check(s.state.profile.serverRevision===after.serverRevision,'no-op returned stale revision');}}
return {error,verified,beforeRevision:before.serverRevision,afterRevision:after.serverRevision,extraOutbox:afterOutbox.length-beforeOutbox.length,phonePreserved:after.phone===before.phone,storageRollback:mode==='rollback'&&serial(before)===serial(after)};
},mode);row.status='PASS';console.log('PASS '+mode);
}catch(e){row.status='FAIL';row.error=e.stack;console.error(e.stack);process.exitCode=1;}finally{await c.close();result.cases.push(row);}
}
});}finally{await new Promise(r=>server.close(r));result.resources={serverClosed:!server.listening,isolatedBrowserFinally:true};await fs.writeFile(folder+'store-checks.json',JSON.stringify(result,null,2)+'\n');}
