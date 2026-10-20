// AI: explicit session jobs use the existing source readers and guarded app transport only.
import { APP_ORIGIN, HANDOFF_TTL, RECEIVER_CAPABILITY, handoffRoute, validateHandoff } from './handoff-protocol.js';
let serial = Promise.resolve();
const enqueue = operation => { const result = serial.then(operation); serial = result.catch(()=>{}); return result; };
const runnerMatches=(v,s)=>s.jobId?v.jobId===s.jobId:!v.jobId&&v.runnerTabId===s.tab?.id&&(!v.runnerDocumentId||v.runnerDocumentId===s.documentId);
const key = nonce => 'handoff:' + nonce;
async function erase(nonce) { await chrome.storage.session.remove(key(nonce)); await chrome.alarms.clear(key(nonce)); }
async function revokeBatch(k,v){
  try{await chrome.scripting.executeScript({target:{tabId:v.tabId,frameIds:[0]},world:'MAIN',func:id=>window.rakeezCancelNamesBatch?.(id),args:[k.slice(6)]});}catch{/* Closed/navigated app cannot keep this document grant. */}
  await chrome.storage.session.remove(k);await chrome.alarms.clear(k);
}
async function clearAll(sender) {
  const entries = await chrome.storage.session.get(null);
  for (const k of Object.keys(entries).filter(k=>(k.startsWith('handoff:')||k.startsWith('receipt:'))&&runnerMatches(entries[k],sender))) {await erase(k.slice(8));await chrome.storage.session.remove('receipt:'+k.slice(8));}
}
// AES-GCM at rest in the extension-only session area. The transient key shares
// that private boundary; this does not claim protection from a compromised browser.
async function seal(envelope) {
  const raw=crypto.getRandomValues(new Uint8Array(32)),iv=crypto.getRandomValues(new Uint8Array(12));
  const secret=await crypto.subtle.importKey('raw',raw,'AES-GCM',false,['encrypt']);
  const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv},secret,new TextEncoder().encode(JSON.stringify(envelope)));
  return {raw:[...raw],iv:[...iv],ciphertext:[...new Uint8Array(ciphertext)]};
}
async function open(record) {
  const secret=await crypto.subtle.importKey('raw',new Uint8Array(record.raw),'AES-GCM',false,['decrypt']);
  const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:new Uint8Array(record.iv)},secret,new Uint8Array(record.ciphertext));
  return validateHandoff(JSON.parse(new TextDecoder().decode(plain)));
}
async function handleTransport(message,sender){
    if(sender.jobId&&message.type!=='n36-cancel'){
      const job=(await chrome.storage.session.get('n36:background-job'))['n36:background-job'];
      if(!job||job.id!==sender.jobId||Date.now()>=job.expiresAt||job.expires&&Date.now()>=job.expires)throw Error('BATCH_EXPIRED');
    }
    if(!sender.jobId&&(message.actionId&&message.type==='n36-create'||message.defer||message.type==='n36-check'||message.type==='n36-deliver'))throw Error('HANDOFF_REQUEST');
    if(message.type==='n36-deliver'){
      const k=key(message.actionId),h=(await chrome.storage.session.get(k))[k],receipt=(await chrome.storage.session.get('receipt:'+message.actionId))['receipt:'+message.actionId];
      if(receipt&&runnerMatches(receipt,sender))return {ok:true,actionId:message.actionId};
      if(!h||!runnerMatches(h,sender))throw Error('HANDOFF_EXPIRED');
      await handleTransport({type:'n36-check',batchId:message.batchId},sender);
      const received=await chrome.scripting.executeScript({target:{tabId:h.tabId,frameIds:[0]},world:'MAIN',func:(request,id)=>window.rakeezReceiveNamesBatch?.(request,id)===true,args:[{extensionId:chrome.runtime.id,nonce:message.actionId},message.batchId]});
      if(received.length!==1||received[0].frameId!==0||received[0].documentId!==h.documentId||received[0].result!==true)throw Error('APP_CHANGED');
      return {ok:true,actionId:message.actionId};
    }
    if (message?.type === 'n36-begin') {
      // Only the explicit runner may bind an already-open authenticated app.
      if(!sender.jobId&&sender.tab?.id==null&&(!sender.documentId||typeof sender.documentId!=='string'))throw Error('APP_DOCUMENT_BINDING');
      const tabs=await chrome.tabs.query({url:APP_ORIGIN+'/*',...(sender.jobId?{windowId:sender.windowId}:sender.tab?.windowId!=null?{windowId:sender.tab.windowId}:{currentWindow:true})});
      if(tabs.length!==1)throw Error('OPEN_ONE_RAKEEZ_TAB');
      const tab=tabs[0];
      const result=await chrome.scripting.executeScript({target:{tabId:tab.id,frameIds:[0]},world:'MAIN',func:async()=>{
        if(document.querySelector('.sheet,[role=dialog],[aria-busy=true]')||document.activeElement?.matches('input,textarea,select,[contenteditable=true]'))return {code:'APP_FINISH_CURRENT_EDIT'};
        const deadline=Date.now()+15000;
        while(typeof window.rakeezBeginNamesBatch!=='function'&&Date.now()<deadline)await new Promise(r=>setTimeout(r,50));
        if(typeof window.rakeezBeginNamesBatch!=='function'||window.rakeezNamesCapability?.()!=='source-profile-quiet-v1')return {code:'APP_UPDATE_REQUIRED'};
        return window.rakeezBeginNamesBatch();
      }});
      if(result.length!==1||result[0]?.frameId!==0)throw Error('APP_FRAME');
      if(typeof result[0].documentId!=='string'||!result[0].documentId)throw Error('APP_DOCUMENT_BINDING');
      if(['APP_UPDATE_REQUIRED','APP_FINISH_CURRENT_EDIT'].includes(result[0]?.result?.code))throw Error(result[0].result.code);
      const batchId=result[0]?.result;
      if(!/^[a-f0-9]{64}$/.test(batchId))throw Error('APP_NOT_READY');
      await chrome.storage.session.set({['batch:'+batchId]:{tabId:tab.id,documentId:result[0].documentId,jobId:sender.jobId??null,runnerTabId:sender.tab?.id??null,runnerDocumentId:sender.documentId??null,receiverCapability:RECEIVER_CAPABILITY,expiresAt:Date.now()+1800000}});
      await chrome.alarms.create('batch:'+batchId,{when:Date.now()+1800000});
      return {ok:true,batchId,receiverCapability:RECEIVER_CAPABILITY,...(sender.jobId?{appTabId:tab.id}:{})};
    }
    if (message?.type === 'n36-cancel') { await clearAll(sender);const all=await chrome.storage.session.get(null);for(const [k,v] of Object.entries(all))if(k.startsWith('batch:')&&runnerMatches(v,sender)){await revokeBatch(k,v);} return {ok:true}; }
    if(message?.type==='n36-result'){
      if(!/^[a-f0-9]{64}$/.test(message.actionId))throw Error('RECEIPT_KEY');
      const k='receipt:'+message.actionId,r=(await chrome.storage.session.get(k))[k];
      if(!r){const h=(await chrome.storage.session.get(key(message.actionId)))[key(message.actionId)];return {ok:true,status:h&&runnerMatches(h,sender)?'pending':'expired'};}
      if(!runnerMatches(r,sender)||Date.now()>=r.expiresAt)return {ok:true,status:'expired'};
      if(!r.outcome)return {ok:true,status:'pending'};
      if(!sender.jobId){await chrome.storage.session.remove(k);await chrome.alarms.clear(key(message.actionId));}
      return {ok:true,...r.outcome};
    }
    if(message?.type==='n36-check'){
      const b=(await chrome.storage.session.get('batch:'+message.batchId))['batch:'+message.batchId];
      if(!b||!runnerMatches(b,sender)||Date.now()>=b.expiresAt)throw Error('BATCH_EXPIRED');
      const tab=await chrome.tabs.get(b.tabId),u=new URL(tab.url);
      if(u.origin!==APP_ORIGIN||u.pathname!=='/'||u.search)throw Error('APP_CHANGED');
      const r=await chrome.scripting.executeScript({target:{tabId:b.tabId,frameIds:[0]},world:'MAIN',func:id=>window.rakeezNamesCapability?.()==='source-profile-quiet-v1'&&window.rakeezCheckNamesBatch?.(id)===true,args:[message.batchId]});
      if(r.length!==1||r[0].frameId!==0||r[0].documentId!==b.documentId)throw Error('APP_CHANGED');
      if(!message.wait&&r[0].result!==true)throw Error('APP_CHANGED');
      return {ok:true,ready:r[0].result===true};
    }
    if (message?.type !== 'n36-create') throw Error('HANDOFF_REQUEST');
    const envelope = validateHandoff(message.envelope);
    const nonce = message.actionId ?? [...crypto.getRandomValues(new Uint8Array(32))].map(v=>v.toString(16).padStart(2,'0')).join('');
    if(sender.jobId){
      if(!/^[a-f0-9]{64}$/.test(nonce))throw Error('HANDOFF_REQUEST');
      const old=(await chrome.storage.session.get(key(nonce)))[key(nonce)]??(await chrome.storage.session.get('receipt:'+nonce))['receipt:'+nonce];
      if(old){if(!runnerMatches(old,sender))throw Error('HANDOFF_SENDER');return {ok:true,actionId:nonce};}
    }
    let url = APP_ORIGIN + '/' + handoffRoute(chrome.runtime.id, nonce);
    // Bind v2 to the Start document and existing tab; v1 retains the newly-created-tab contract.
    const batch=envelope.version>=2?(await chrome.storage.session.get('batch:'+envelope.batchId))['batch:'+envelope.batchId]:null;
    if(envelope.version>=2&&(!batch||!runnerMatches(batch,sender)||batch.receiverCapability!==RECEIVER_CAPABILITY||Date.now()>=batch.expiresAt))throw Error('BATCH_EXPIRED');
    const tab = batch ? await chrome.tabs.get(batch.tabId) : await chrome.tabs.create({url:'about:blank',active:false,windowId:sender.tab?.windowId});
    if(batch){
      const u=new URL(tab.url);
      if(u.origin!==APP_ORIGIN||u.pathname!=='/'||u.search)throw Error('APP_CHANGED');
      url=tab.url;
      // The current document and app capability, not a cached tabs URL/hash, own the batch.
      const checks=await chrome.scripting.executeScript({target:{tabId:tab.id,frameIds:[0]},world:'MAIN',func:id=>window.rakeezNamesCapability?.()==='source-profile-quiet-v1'&&window.rakeezCheckNamesBatch?.(id)===true,args:[envelope.batchId]});
      if(checks.length!==1||checks[0].frameId!==0||checks[0].documentId!==batch.documentId||checks[0].result!==true)throw Error('APP_CHANGED');
    }
    if(!sender.jobId)await clearAll(sender);
    try {
      await chrome.storage.session.set({[key(nonce)]:{...await seal(envelope),tabId:tab.id,url,documentId:batch?.documentId??null,jobId:sender.jobId??null,runnerTabId:sender.tab?.id??null,runnerDocumentId:sender.documentId??null}});
      await chrome.alarms.create(key(nonce), {when:Math.min(Date.now()+HANDOFF_TTL,envelope.expiresAt)});
      if(sender.jobId&&message.defer)return {ok:true,actionId:nonce};
      if(batch){
        // Current document receiver claims the nonce without changing route,
        // opening an import page, or creating another app tab. Do not await its
        // async claim here: claims use this same serialized worker mailbox.
        const received=await chrome.scripting.executeScript({target:{tabId:tab.id,frameIds:[0]},world:'MAIN',func:(request,id)=>window.rakeezReceiveNamesBatch?.(request,id)===true,args:[{extensionId:chrome.runtime.id,nonce},envelope.batchId]});
        if(received.length!==1||received[0].frameId!==0||received[0].documentId!==batch.documentId||received[0].result!==true)throw Error('APP_CHANGED');
      }else await chrome.tabs.update(tab.id,{url,active:true});
    } catch (error) { await erase(nonce); if(!batch)await chrome.tabs.remove(tab.id); throw error; }
    return {ok:true,actionId:nonce};

}

import {createBackgroundRunner} from './background-runner.js';
// AI: background authority is a stored explicit job, never a fabricated popup sender.
async function transport(message,authority){return enqueue(()=>handleTransport(message,authority));}
const background=createBackgroundRunner({transport});
chrome.runtime.onMessage.addListener((message,sender,reply)=>{
 const expected=new URL(chrome.runtime.getURL('popup.html'));let caller;try{caller=new URL(sender.url);}catch{return;}
 if(sender.id!==chrome.runtime.id||caller.protocol!==expected.protocol||caller.hostname!==expected.hostname||caller.pathname!==expected.pathname||sender.frameId!=null&&![-1,0].includes(sender.frameId))return;
 if(message?.type==='n36-health'&&Object.keys(message).join()==='type'){reply({ok:true,health:'ready'});return;}
 const operation=message?.type?.startsWith('n36-job-')?background.message(message,sender):transport(message,sender);
 operation.then(reply,e=>reply({ok:false,code:/^[A-Z_]+$/.test(e.message)?e.message:'HANDOFF_UNAVAILABLE'}));return true;
});
chrome.runtime.onMessageExternal.addListener((message, sender, reply) => {
  enqueue(async()=>{
    if (!message || !['n36-claim','n36-cancel','n36-outcome'].includes(message.type) || !/^[a-f0-9]{64}$/.test(message.nonce)) throw Error('HANDOFF_REQUEST');
    if(message.type==='n36-outcome'){
      const k='receipt:'+message.nonce,r=(await chrome.storage.session.get(k))[k];
      const u=new URL(sender.url??'https://invalid.invalid');
      if(!r||(r.outcome&&!(r.jobId&&r.outcome.status==='unknown'&&['saved','existing'].includes(message.outcome?.status)))||sender.id||sender.origin!==APP_ORIGIN||u.origin!==APP_ORIGIN||u.pathname!=='/'||u.search||sender.tab?.id!==r.tabId||r.documentId&&sender.documentId!==r.documentId||Date.now()>=r.expiresAt)throw Error('RECEIPT_SENDER');
      const o=message.outcome;
      const expected=['added','existing','remaining','status','total',...(r.version===3&&o?.setup?['setup']:[]),...(o?.failure?['failure']:[])].sort().join();
      if(!o||Object.keys(o).sort().join()!==expected||!['saved','existing','unknown'].includes(o.status)||!['added','existing','remaining','total'].every(k=>Number.isSafeInteger(o[k])&&o[k]>=0&&o[k]<=300)||o.total!==r.total)throw Error('RECEIPT_SCHEMA');
      if(o.failure&&(o.status!=='unknown'||Object.keys(o.failure).sort().join()!=='code,phase,step'||!['profile','batch'].includes(o.failure.phase)||!['validation','transaction','readback'].includes(o.failure.step)||!['SETUP_PROFILE_CHANGED','SETUP_PROFILE_OWNER','OFFLINE_LEASE_LIMITED','DataError','DataCloneError','QuotaExceededError','AbortError','ConstraintError','CLASS_MAPPING_REQUIRED','CLASS_ARCHIVED_OR_AMBIGUOUS','BATCH_OWNER_OR_SESSION_CHANGED','BATCH_PERSISTED_TERM_CHANGED','BATCH_PERSISTED_CONTEXT_CHANGED','WRITE_FAILED'].includes(o.failure.code)))throw Error('RECEIPT_FAILURE');
      if(r.version===3&&o.status!=='unknown'&&(!o.setup||!Array.isArray(o.setup.details)||!o.setup.details.length))throw Error('RECEIPT_SETUP');
      if(o.setup){const v=o.setup;if(r.version!==3||!['existing,missing,saved,unresolved','details,existing,missing,saved,unresolved'].includes(Object.keys(v).sort().join())||!['saved','existing','unresolved'].every(k=>Number.isSafeInteger(v[k])&&v[k]>=0&&v[k]<=1200)||!Array.isArray(v.missing)||v.missing.length>6||v.missing.some(c=>!['teacher','school','principal','department','classes','timetable'].includes(c)))throw Error('RECEIPT_SETUP');if(v.details&&(!Array.isArray(v.details)||v.details.length>36||v.details.some(d=>!d||Object.keys(d).sort().join()!=='count,field,reason'||!['teacher','school','principal','department','classes','timetable'].includes(d.field)||!['saved','current','missing','conflict','unsupported','ambiguous','unrecognized'].includes(d.reason)||!Number.isSafeInteger(d.count)||d.count<1||d.count>1200)))throw Error('RECEIPT_SETUP');}
      if(o.status!=='unknown'&&(o.remaining!==0||o.added+o.existing!==r.total))throw Error('RECEIPT_INCOMPLETE');
      await chrome.storage.session.set({[k]:{...r,outcome:o}});queueMicrotask(()=>background.wake());return {ok:true};
    }
    const record = (await chrome.storage.session.get(key(message.nonce)))[key(message.nonce)];
    if (!record || sender.id || sender.origin !== APP_ORIGIN || sender.tab?.id !== record.tabId) throw Error('HANDOFF_SENDER');
    if(record.documentId){
      // Chrome MessageSender.url is the original document URL after hash navigation.
      // Require the original document AND read back the actual exact current nonce route.
      const u=new URL(sender.url??'https://invalid.invalid'),tab=await chrome.tabs.get(record.tabId);
      if(sender.documentId!==record.documentId||u.origin!==APP_ORIGIN||u.pathname!=='/'||u.search||tab.url!==record.url)throw Error('HANDOFF_DOCUMENT_OR_ROUTE');
    }else if(sender.url!==record.url)throw Error('HANDOFF_SENDER');
    if (message.type === 'n36-cancel'){await erase(message.nonce);return {ok:true};}
    if((await chrome.storage.session.get('receipt:'+message.nonce))['receipt:'+message.nonce])throw Error('HANDOFF_ALREADY_CLAIMED');
    const envelope=await open(record);
    await chrome.storage.session.set({['receipt:'+message.nonce]:{tabId:record.tabId,documentId:record.documentId,jobId:record.jobId??null,runnerTabId:record.runnerTabId,runnerDocumentId:record.runnerDocumentId,total:envelope.rows.length,version:envelope.version,expiresAt:Date.now()+HANDOFF_TTL}});
    await erase(message.nonce);
    await chrome.alarms.create(key(message.nonce),{when:Date.now()+HANDOFF_TTL});
    return {ok:true,envelope};
  }).then(reply,error=>reply({ok:false,code:/^[A-Z_]+$/.test(error.message)?error.message:'HANDOFF_EXPIRED_OR_DENIED'}));
  return true;
});
chrome.alarms.onAlarm.addListener(alarm=>{if(alarm.name.startsWith('batch:'))enqueue(()=>chrome.storage.session.remove(alarm.name));if(alarm.name.startsWith('handoff:')) enqueue(async()=>{await erase(alarm.name.slice(8));await chrome.storage.session.remove('receipt:'+alarm.name.slice(8));});});
chrome.tabs.onRemoved.addListener(tabId=>enqueue(async()=>{
  const all = await chrome.storage.session.get(null);
  for(const [k,v] of Object.entries(all))if(k.startsWith('batch:')&&(v.tabId===tabId||v.runnerTabId===tabId)){await revokeBatch(k,v);}
  for (const [k,v] of Object.entries(all)) if((k.startsWith('handoff:')||k.startsWith('receipt:'))&&(v.tabId===tabId||v.runnerTabId===tabId)){await erase(k.slice(8));await chrome.storage.session.remove('receipt:'+k.slice(8));}
}));

background.bootstrap().catch(()=>{});
