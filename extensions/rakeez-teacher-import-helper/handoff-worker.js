// AI: no school access, relay, persistent storage, or app write capability.
import { APP_ORIGIN, HANDOFF_TTL, handoffRoute, validateHandoff } from './handoff-protocol.js';
let serial = Promise.resolve();
const enqueue = operation => { const result = serial.then(operation); serial = result.catch(()=>{}); return result; };
const key = nonce => 'handoff:' + nonce;
async function erase(nonce) { await chrome.storage.session.remove(key(nonce)); await chrome.alarms.clear(key(nonce)); }
async function revokeBatch(k,v){
  try{await chrome.scripting.executeScript({target:{tabId:v.tabId,frameIds:[0]},world:'MAIN',func:id=>window.rakeezCancelNamesBatch?.(id),args:[k.slice(6)]});}catch{/* Closed/navigated app cannot keep this document grant. */}
  await chrome.storage.session.remove(k);await chrome.alarms.clear(k);
}
async function clearAll() {
  const entries = await chrome.storage.session.get(null);
  for (const k of Object.keys(entries).filter(k=>k.startsWith('handoff:')||k.startsWith('receipt:'))) {await erase(k.slice(8));await chrome.storage.session.remove('receipt:'+k.slice(8));}
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
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (sender.id !== chrome.runtime.id || !sender.url || new URL(sender.url).origin !== new URL(chrome.runtime.getURL('popup.html')).origin || new URL(sender.url).pathname !== '/popup.html') return;
  // AI: health has an exact no-payload schema, after the existing sender guard.
  if(message?.type==='n36-health'){
    if(Object.getPrototypeOf(message)!==Object.prototype||Object.keys(message).join()!=='type')return;
    reply({ok:true,health:'ready'});return;
  }
  enqueue(async()=>{
    if (message?.type === 'n36-begin') {
      // Only the explicit runner may bind an already-open authenticated app.
      const tabs=await chrome.tabs.query({url:APP_ORIGIN+'/*',windowId:sender.tab?.windowId});
      if(tabs.length!==1)throw Error('OPEN_ONE_RAKEEZ_TAB');
      const tab=tabs[0];
      const result=await chrome.scripting.executeScript({target:{tabId:tab.id,frameIds:[0]},world:'MAIN',func:async()=>{
        if(document.querySelector('.sheet,[role=dialog],[aria-busy=true]')||document.activeElement?.matches('input,textarea,select,[contenteditable=true]'))throw Error('APP_FINISH_CURRENT_EDIT');
        const deadline=Date.now()+15000;
        while(typeof window.rakeezBeginNamesBatch!=='function'&&Date.now()<deadline)await new Promise(r=>setTimeout(r,50));
        if(typeof window.rakeezBeginNamesBatch!=='function')throw Error('APP_UPDATE_REQUIRED');
        return window.rakeezBeginNamesBatch();
      }});
      if(result.length!==1||result[0]?.frameId!==0)throw Error('APP_FRAME');
      if(typeof result[0].documentId!=='string'||!result[0].documentId)throw Error('APP_DOCUMENT_BINDING');
      const batchId=result[0]?.result;
      if(!/^[a-f0-9]{64}$/.test(batchId))throw Error('APP_NOT_READY');
      await chrome.storage.session.set({['batch:'+batchId]:{tabId:tab.id,documentId:result[0].documentId,runnerTabId:sender.tab?.id,expiresAt:Date.now()+1800000}});
      await chrome.alarms.create('batch:'+batchId,{when:Date.now()+1800000});
      return {ok:true,batchId};
    }
    if (message?.type === 'n36-cancel') { await clearAll();const all=await chrome.storage.session.get(null);for(const [k,v] of Object.entries(all))if(k.startsWith('batch:')&&v.runnerTabId===sender.tab?.id){await revokeBatch(k,v);} return {ok:true}; }
    if(message?.type==='n36-result'){
      if(!/^[a-f0-9]{64}$/.test(message.actionId))throw Error('RECEIPT_KEY');
      const k='receipt:'+message.actionId,r=(await chrome.storage.session.get(k))[k];
      if(!r){const h=(await chrome.storage.session.get(key(message.actionId)))[key(message.actionId)];return {ok:true,status:h?.runnerTabId===sender.tab?.id?'pending':'expired'};}
      if(r.runnerTabId!==sender.tab?.id||Date.now()>=r.expiresAt)return {ok:true,status:'expired'};
      if(!r.outcome)return {ok:true,status:'pending'};
      await chrome.storage.session.remove(k);await chrome.alarms.clear(key(message.actionId));
      return {ok:true,...r.outcome};
    }
    if (message?.type !== 'n36-create') throw Error('HANDOFF_REQUEST');
    const envelope = validateHandoff(message.envelope);
    await clearAll();
    const nonce = [...crypto.getRandomValues(new Uint8Array(32))].map(v=>v.toString(16).padStart(2,'0')).join('');
    let url = APP_ORIGIN + '/' + handoffRoute(chrome.runtime.id, nonce);
    // Bind v2 to the Start document and existing tab; v1 retains the newly-created-tab contract.
    const batch=envelope.version>=2?(await chrome.storage.session.get('batch:'+envelope.batchId))['batch:'+envelope.batchId]:null;
    if(envelope.version>=2&&(!batch||batch.runnerTabId!==sender.tab?.id||Date.now()>=batch.expiresAt))throw Error('BATCH_EXPIRED');
    const tab = batch ? await chrome.tabs.get(batch.tabId) : await chrome.tabs.create({url:'about:blank',active:false,windowId:sender.tab?.windowId});
    if(batch){
      const u=new URL(tab.url);
      if(u.origin!==APP_ORIGIN||u.pathname!=='/'||u.search)throw Error('APP_CHANGED');
      url=tab.url;
      // The current document and app capability, not a cached tabs URL/hash, own the batch.
      const checks=await chrome.scripting.executeScript({target:{tabId:tab.id,frameIds:[0]},world:'MAIN',func:id=>window.rakeezCheckNamesBatch?.(id)===true,args:[envelope.batchId]});
      if(checks.length!==1||checks[0].frameId!==0||checks[0].documentId!==batch.documentId||checks[0].result!==true)throw Error('APP_CHANGED');
    }
    try {
      await chrome.storage.session.set({[key(nonce)]:{...await seal(envelope),tabId:tab.id,url,documentId:batch?.documentId??null,runnerTabId:sender.tab?.id}});
      await chrome.alarms.create(key(nonce), {when:Math.min(Date.now()+HANDOFF_TTL,envelope.expiresAt)});
      if(batch){
        // Current document receiver claims the nonce without changing route,
        // opening an import page, or creating another app tab. Do not await its
        // async claim here: claims use this same serialized worker mailbox.
        const received=await chrome.scripting.executeScript({target:{tabId:tab.id,frameIds:[0]},world:'MAIN',func:(request,id)=>window.rakeezReceiveNamesBatch?.(request,id)===true,args:[{extensionId:chrome.runtime.id,nonce},envelope.batchId]});
        if(received.length!==1||received[0].frameId!==0||received[0].documentId!==batch.documentId||received[0].result!==true)throw Error('APP_CHANGED');
      }else await chrome.tabs.update(tab.id,{url,active:true});
    } catch (error) { await erase(nonce); if(!batch)await chrome.tabs.remove(tab.id); throw error; }
    return {ok:true,actionId:nonce};
  }).then(reply,error=>reply({ok:false,code:['OPEN_ONE_RAKEEZ_TAB','APP_FINISH_CURRENT_EDIT','APP_UPDATE_REQUIRED','APP_FRAME','APP_DOCUMENT_BINDING','APP_NOT_READY','BATCH_EXPIRED','APP_CHANGED','HANDOFF_SCHEMA','HANDOFF_SETUP','HANDOFF_BATCH','HANDOFF_LIMIT_OR_EXPIRED','HANDOFF_VALUE','HANDOFF_DUPLICATE'].includes(error.message)?error.message:'HANDOFF_UNAVAILABLE'}));
  return true;
});
chrome.runtime.onMessageExternal.addListener((message, sender, reply) => {
  enqueue(async()=>{
    if (!message || !['n36-claim','n36-cancel','n36-outcome'].includes(message.type) || !/^[a-f0-9]{64}$/.test(message.nonce)) throw Error('HANDOFF_REQUEST');
    if(message.type==='n36-outcome'){
      const k='receipt:'+message.nonce,r=(await chrome.storage.session.get(k))[k];
      const u=new URL(sender.url??'https://invalid.invalid');
      if(!r||r.outcome||sender.id||sender.origin!==APP_ORIGIN||u.origin!==APP_ORIGIN||u.pathname!=='/'||u.search||sender.tab?.id!==r.tabId||r.documentId&&sender.documentId!==r.documentId||Date.now()>=r.expiresAt)throw Error('RECEIPT_SENDER');
      const o=message.outcome;
      const expected=['added','existing','remaining','status','total',...(r.version===3&&o?.setup?['setup']:[]),...(o?.failure?['failure']:[])].sort().join();
      if(!o||Object.keys(o).sort().join()!==expected||!['saved','existing','unknown'].includes(o.status)||!['added','existing','remaining','total'].every(k=>Number.isSafeInteger(o[k])&&o[k]>=0&&o[k]<=300)||o.total!==r.total)throw Error('RECEIPT_SCHEMA');
      if(o.failure&&(o.status!=='unknown'||Object.keys(o.failure).sort().join()!=='code,phase,step'||!['profile','batch'].includes(o.failure.phase)||!['validation','transaction','readback'].includes(o.failure.step)||!['SETUP_PROFILE_CHANGED','SETUP_PROFILE_OWNER','OFFLINE_LEASE_LIMITED','DataError','DataCloneError','QuotaExceededError','AbortError','ConstraintError','CLASS_MAPPING_REQUIRED','CLASS_ARCHIVED_OR_AMBIGUOUS','BATCH_OWNER_OR_SESSION_CHANGED','BATCH_PERSISTED_TERM_CHANGED','BATCH_PERSISTED_CONTEXT_CHANGED','WRITE_FAILED'].includes(o.failure.code)))throw Error('RECEIPT_FAILURE');
      if(o.setup){const v=o.setup;if(r.version!==3||!['existing,missing,saved,unresolved','details,existing,missing,saved,unresolved'].includes(Object.keys(v).sort().join())||!['saved','existing','unresolved'].every(k=>Number.isSafeInteger(v[k])&&v[k]>=0&&v[k]<=1200)||!Array.isArray(v.missing)||v.missing.length>6||v.missing.some(c=>!['teacher','school','principal','department','classes','timetable'].includes(c)))throw Error('RECEIPT_SETUP');if(v.details&&(!Array.isArray(v.details)||v.details.length>36||v.details.some(d=>!d||Object.keys(d).sort().join()!=='count,field,reason'||!['teacher','school','principal','department','classes','timetable'].includes(d.field)||!['saved','current','missing','conflict','unsupported','ambiguous','unrecognized'].includes(d.reason)||!Number.isSafeInteger(d.count)||d.count<1||d.count>1200)))throw Error('RECEIPT_SETUP');}
      if(o.status!=='unknown'&&(o.remaining!==0||o.added+o.existing!==r.total))throw Error('RECEIPT_INCOMPLETE');
      await chrome.storage.session.set({[k]:{...r,outcome:o}});return {ok:true};
    }
    const record = (await chrome.storage.session.get(key(message.nonce)))[key(message.nonce)];
    if (!record || sender.id || sender.origin !== APP_ORIGIN || sender.tab?.id !== record.tabId) throw Error('HANDOFF_SENDER');
    if(record.documentId){
      // Chrome MessageSender.url is the original document URL after hash navigation.
      // Require the original document AND read back the actual exact current nonce route.
      const u=new URL(sender.url??'https://invalid.invalid'),tab=await chrome.tabs.get(record.tabId);
      if(sender.documentId!==record.documentId||u.origin!==APP_ORIGIN||u.pathname!=='/'||u.search||tab.url!==record.url)throw Error('HANDOFF_DOCUMENT_OR_ROUTE');
    }else if(sender.url!==record.url)throw Error('HANDOFF_SENDER');
    // Delete before reply; serialized claims cannot replay, even across worker wakeups.
    await erase(message.nonce);
    if (message.type === 'n36-cancel') return {ok:true};
    const envelope=await open(record);
    await chrome.storage.session.set({['receipt:'+message.nonce]:{tabId:record.tabId,documentId:record.documentId,runnerTabId:record.runnerTabId,total:envelope.rows.length,version:envelope.version,expiresAt:Date.now()+HANDOFF_TTL}});
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
