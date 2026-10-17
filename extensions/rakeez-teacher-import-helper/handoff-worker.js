// AI: no school access, relay, persistent storage, or app write capability.
import { APP_ORIGIN, HANDOFF_TTL, handoffRoute, validateHandoff } from './handoff-protocol.js';
let serial = Promise.resolve();
const enqueue = operation => { const result = serial.then(operation); serial = result.catch(()=>{}); return result; };
const key = nonce => 'handoff:' + nonce;
async function erase(nonce) { await chrome.storage.session.remove(key(nonce)); await chrome.alarms.clear(key(nonce)); }
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
  enqueue(async()=>{
    if (message?.type === 'n36-cancel') { await clearAll(); return {ok:true}; }
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
    const url = APP_ORIGIN + '/' + handoffRoute(chrome.runtime.id, nonce);
    // Bind the claim to the exact newly created app tab, before navigating it.
    const tab = await chrome.tabs.create({url:'about:blank',active:false,windowId:sender.tab?.windowId});
    try {
      await chrome.storage.session.set({[key(nonce)]:{...await seal(envelope),tabId:tab.id,url,runnerTabId:sender.tab?.id}});
      await chrome.alarms.create(key(nonce), {when:Math.min(Date.now()+HANDOFF_TTL,envelope.expiresAt)});
      await chrome.tabs.update(tab.id,{url,active:true});
    } catch (error) { await erase(nonce); await chrome.tabs.remove(tab.id); throw error; }
    return {ok:true,actionId:nonce};
  }).then(reply,()=>reply({ok:false,code:'HANDOFF_UNAVAILABLE'}));
  return true;
});
chrome.runtime.onMessageExternal.addListener((message, sender, reply) => {
  enqueue(async()=>{
    if (!message || !['n36-claim','n36-cancel','n36-outcome'].includes(message.type) || !/^[a-f0-9]{64}$/.test(message.nonce)) throw Error('HANDOFF_REQUEST');
    if(message.type==='n36-outcome'){
      const k='receipt:'+message.nonce,r=(await chrome.storage.session.get(k))[k];
      const u=new URL(sender.url??'https://invalid.invalid');
      if(!r||r.outcome||sender.id||sender.origin!==APP_ORIGIN||u.origin!==APP_ORIGIN||u.pathname!=='/'||u.search||sender.tab?.id!==r.tabId||Date.now()>=r.expiresAt)throw Error('RECEIPT_SENDER');
      const o=message.outcome;
      if(!o||Object.keys(o).sort().join()!=='added,existing,remaining,status,total'||!['saved','existing','unknown'].includes(o.status)||!['added','existing','remaining','total'].every(k=>Number.isSafeInteger(o[k])&&o[k]>=0&&o[k]<=300)||o.total!==r.total)throw Error('RECEIPT_SCHEMA');
      if(o.status!=='unknown'&&(o.remaining!==0||o.added+o.existing!==r.total))throw Error('RECEIPT_INCOMPLETE');
      await chrome.storage.session.set({[k]:{...r,outcome:o}});return {ok:true};
    }
    const record = (await chrome.storage.session.get(key(message.nonce)))[key(message.nonce)];
    if (!record || sender.id || sender.origin !== APP_ORIGIN || sender.url !== record.url || sender.tab?.id !== record.tabId) throw Error('HANDOFF_SENDER');
    // Delete before reply; serialized claims cannot replay, even across worker wakeups.
    await erase(message.nonce);
    if (message.type === 'n36-cancel') return {ok:true};
    const envelope=await open(record);
    await chrome.storage.session.set({['receipt:'+message.nonce]:{tabId:record.tabId,runnerTabId:record.runnerTabId,total:envelope.rows.length,expiresAt:envelope.expiresAt}});
    await chrome.alarms.create(key(message.nonce),{when:envelope.expiresAt});
    return {ok:true,envelope};
  }).then(reply,()=>reply({ok:false,code:'HANDOFF_EXPIRED_OR_DENIED'}));
  return true;
});
chrome.alarms.onAlarm.addListener(alarm=>{if(alarm.name.startsWith('handoff:')) enqueue(async()=>{await erase(alarm.name.slice(8));await chrome.storage.session.remove('receipt:'+alarm.name.slice(8));});});
chrome.tabs.onRemoved.addListener(tabId=>enqueue(async()=>{
  const all = await chrome.storage.session.get(null);
  for (const [k,v] of Object.entries(all)) if((k.startsWith('handoff:')||k.startsWith('receipt:'))&&(v.tabId===tabId||v.runnerTabId===tabId)){await erase(k.slice(8));await chrome.storage.session.remove('receipt:'+k.slice(8));}
}));
