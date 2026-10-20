// AI: real service-worker module, fabricated Chrome APIs in a separate realm.
// Origin is fixture configuration only: HTTPS production -> owned loopback.
import fs from 'node:fs/promises';
import vm from 'node:vm';import {execFileSync} from 'node:child_process';
import {webcrypto} from 'node:crypto';
export async function workerFixture(page,base,{legacy=false}={}){
 const dir='extensions/rakeez-teacher-import-helper/',id='a'.repeat(32),data={},listeners={};
 const evidence={navigation:[],received:[],claims:[],envelopes:[],outcomes:[],documentId:'synthetic-document-one'};
 const chrome={runtime:{id,getURL:p=>'chrome-extension://'+id+'/'+p,onMessage:{addListener:f=>listeners.internal=f},onMessageExternal:{addListener:f=>listeners.external=f}},
 storage:{session:{get:async k=>structuredClone(k===null?data:Object.hasOwn(data,k)?{[k]:data[k]}:{}),set:async o=>Object.assign(data,structuredClone(o)),remove:async k=>{delete data[k];}}},
 alarms:{create:async()=>{},clear:async()=>true,onAlarm:{addListener:f=>listeners.alarm=f}},
 tabs:{query:async()=>[{id:99,url:page.url()}],get:async()=>({id:99,url:page.url()}),create:async()=>{throw Error('Unexpected new app tab');},update:async(_,o)=>{evidence.navigation.push(o);throw Error('Unexpected app navigation');},remove:async()=>{},onRemoved:{addListener:f=>listeners.removed=f}},
 scripting:{executeScript:async input=>{
  const result=await page.evaluate(({func,args})=>new Function('args','return ('+func+')(...args)')(args),{func:input.func.toString(),args:input.args??[]});
  if(input.args?.[0]?.nonce)evidence.received.push({accepted:result});
  return [{frameId:0,documentId:evidence.documentId,result}];
 }}};
 const realm=vm.createContext({URL,TextEncoder,TextDecoder,crypto:webcrypto,chrome,console});
 const read=async f=>legacy?execFileSync('git',['show','8afa42609cdd9ec228169fc01fd9c985444417bf:'+dir+f],{encoding:'utf8'}):fs.readFile(dir+f,'utf8');
 vm.runInContext((await read('handoff-protocol.js')).replace('https://rakeezx.com',base).replaceAll('export ',''),realm);
 vm.runInContext((await read('handoff-worker.js')).replace(/^import .*?;\r?\n/m,''),realm);
 const send=(kind,message,sender)=>new Promise((done,reject)=>{
  const timer=setTimeout(()=>reject(Error('Chrome fixture reply deadline')),10000);
  realm.messageJSON=JSON.stringify(message);
  const accepted=listeners[kind](vm.runInContext('JSON.parse(messageJSON)',realm),sender,r=>{clearTimeout(timer);done(JSON.parse(JSON.stringify(r)));});
  if(!accepted){clearTimeout(timer);done({ok:false});}
 });
 return {evidence,data,
  internal:(m,override={})=>{if(m.type==='n36-create')evidence.envelopes.push(structuredClone(m.envelope));return send('internal',m,{id,url:chrome.runtime.getURL('popup.html')+'?run=actual-save',...(legacy?{tab:{id:7,windowId:1}}:{documentId:'synthetic-popup-document'}),...override});},
  external:(m,override={})=>{if(m.type==='n36-outcome')evidence.outcomes.push(structuredClone(m.outcome));evidence.claims.push({type:m.type});return send('external',m,{url:page.url(),origin:base,tab:{id:99},documentId:evidence.documentId,...override});},
 };
}
