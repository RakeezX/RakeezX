// AI: corrected native-like storage boundary: storage reads never execute in the source document.
// Copied from worker-fixture.mjs; prior observations and original harness remain immutable in the parent commit.
import fs from 'node:fs';import {execFileSync} from 'node:child_process';import vm from 'node:vm';import path from 'node:path';import {webcrypto} from 'node:crypto';
export async function backgroundFixture({app,source,base,runtimeFiles=null,onRead=async()=>{},onAfterRead=async()=>{},data={},evidence={reads:0,navigation:[],deliveries:[],claims:[],outcomes:[]},freezePhase=null,original=false,popupDocumentId=undefined,wrongCurrentWindow=false,onStorage=async()=>{},holdHome=false,denySource=false,selectionChanged=false,styleCostMs=0,scriptDelayMs=0,inlineCounters=true,sourceDocumentNumber=null}){
 const clockStart=Date.now();let styleCalls=0;const counters={};let pendingFetches=0,pendingReadProofs=0,sourceStage='initial';
 const now=()=>clockStart+(Date.now()-clockStart)+styleCalls*styleCostMs;
 class WorkDate extends Date{static now(){return now();}}
 const measure=async(name,fn)=>{const start=Date.now(),virtual=now();try{return await fn();}finally{const r=counters[name]??={count:0,wallMs:0,modeledMs:0};r.count=Math.min(10000,r.count+1);r.wallMs=Math.min(3600000,r.wallMs+Date.now()-start);r.modeledMs=Math.min(3600000,r.modeledMs+now()-virtual);}};
 const id='a'.repeat(32),listeners={internal:[],external:[],alarm:[],removed:[]},alarms=new Map();let active=true,homeRelease=null,homeEntered=false,guardRelease=null,guardEntered=false,documentId='app-document-1',sourceDocument=sourceDocumentNumber??(Number(data['n36:background-job']?.sourceDocument?.split('-').at(-1))||1),freezeResolve;
 const frozen=new Promise(r=>freezeResolve=r),never=()=>new Promise(()=>{}),live=fn=>async(...args)=>active?fn(...args):never();
 const chrome={runtime:{id,getURL:p=>'chrome-extension://'+id+'/'+p,onMessage:{addListener:f=>listeners.internal.push(f)},onMessageExternal:{addListener:f=>listeners.external.push(f)}},
 storage:{session:{get:live(async k=>{realm.storageJSON=JSON.stringify(k===null?data:Object.hasOwn(data,k)?{[k]:data[k]}:{});return vm.runInContext('JSON.parse(storageJSON)',realm);}),set:live(async o=>{Object.assign(data,structuredClone(o));await onStorage(structuredClone(o));if(freezePhase&&data['n36:background-job']?.phase===freezePhase){active=false;freezeResolve();return never();}}),remove:live(async k=>{delete data[k];})}},
 alarms:{create:live(async(n,v)=>alarms.set(n,v)),clear:live(async n=>alarms.delete(n)),onAlarm:{addListener:f=>listeners.alarm.push(f)}},
 tabs:{query:live(async q=>{evidence.queries??=[];evidence.queries.push(structuredClone(q));return q.active?(wrongCurrentWindow&&q.currentWindow?[]:[{id:selectionChanged&&q.windowId?8:7,windowId:1,active:true,url:source.url(),status:'complete'}]):[{id:99,windowId:1,url:app.url()}];}),get:live(async id=>({id,windowId:1,active:true,url:id===7?source.url():app.url(),status:'complete'})),create:async()=>{throw Error('NEW_TAB_FORBIDDEN');},update:live(async(id,o)=>{if(id!==7||!o.url||new URL(o.url).origin!==base)throw Error('NAVIGATION_FORBIDDEN');evidence.navigation.push(o.url);await source.goto(o.url);sourceDocument++;return {id,url:source.url()};}),remove:async()=>{throw Error('REMOVE_TAB_FORBIDDEN');},onUpdated:{addListener(){}},onRemoved:{addListener:f=>listeners.removed.push(f)}},
 scripting:{executeScript:live(async input=>measure(input.files?'script-load':input.target.tabId===99?'app-guard':input.func.name==='readAutomaticTeacherPage'?'source-'+input.args[0]:input.func.name==='readSourceReportPage'?'report-'+input.args[0]:input.func.toString()==='()=>location.href'?(sourceStage==='read'||sourceStage==='guard'?'descriptor-post-read':'descriptor-pre-read'):'cleanup',async()=>{
  if(input.target.tabId===7&&input.func?.name==='readAutomaticTeacherPage'&&input.args?.[0]==='read-proof'&&pendingFetches)pendingReadProofs=Math.min(10000,pendingReadProofs+1);
  const isFetch=input.target.tabId===7&&input.func?.name==='readSourceReportPage'&&input.args?.[0]==='fetch';if(isFetch)pendingFetches++;
  try{await new Promise(r=>setTimeout(r,scriptDelayMs));
  if(input.target.tabId===7&&denySource)throw Error('Synthetic source access not granted');
  const page=input.target.tabId===7?source:app;
  if(input.files){for(const file of input.files)await page.addScriptTag({url:base+'/extensions/rakeez-teacher-import-helper/'+file});return [];}
  if(input.target.tabId===7&&['readAutomaticTeacherPage','readSourceReportPage'].includes(input.func.name)){evidence.reads++;if(['students','fetch'].includes(input.args?.[0]))evidence.rosterReads=(evidence.rosterReads??0)+1;}
  if(input.target.tabId===7){if(input.files)sourceStage='load';else if(input.func.name==='readAutomaticTeacherPage')sourceStage='read';else if(input.func.name==='readSourceReportPage')sourceStage=input.args?.[0]==='guard'?'guard':'fetch';else sourceStage='descriptor';}
  await onRead(input,data,evidence);
  if(input.args?.[0]?.schema==='rakeez-extension-names'){evidence.envelopes??=[];evidence.envelopes.push(structuredClone(input.args[0]));}
  if(input.args?.[0]?.nonce)evidence.deliveries.push(input.args[0].nonce);
  if(holdHome&&input.target.tabId===7&&input.func.name==='readAutomaticTeacherPage'&&input.args?.[0]==='home'&&!homeEntered){homeEntered=true;await new Promise(r=>homeRelease=r);}
  if(input.target.tabId===7&&input.func.name==='readAutomaticTeacherPage'&&input.args?.[0]==='guard'&&data['n36:background-job']?.phase==='collect'&&!guardEntered){guardEntered=true;await new Promise(r=>guardRelease=r);}
  let result;
  if(inlineCounters){
   const sampled=await page.evaluate(async({func,args,sample})=>{
    const result=await new Function('args','return ('+func+')(...args)')(args);
    return {result,...(sample?{styleCalls:globalThis.fixtureStyleCalls??0}:{})};
   },{func:input.func.toString(),args:input.args??[],sample:input.target.tabId===7});
   result=sampled.result;styleCalls=Math.max(styleCalls,sampled.styleCalls??0);
  }else{
   // Reconstruct the first resumed observation only; this extra source round-trip is not the default.
   result=await page.evaluate(({func,args})=>new Function('args','return ('+func+')(...args)')(args),{func:input.func.toString(),args:input.args??[]});
   if(input.target.tabId===7&&['readAutomaticTeacherPage','readSourceReportPage'].includes(input.func.name))styleCalls=Math.max(styleCalls,await source.evaluate(()=>globalThis.fixtureStyleCalls??0));
  }
  const snapshotDocument=input.target.tabId===7?'source-document-'+sourceDocument:documentId;
  await onAfterRead(input,result,data,evidence,{pendingFetches,pendingReadProofs,snapshotDocument});
  return [{frameId:0,documentId:snapshotDocument,result}];
 }finally{if(isFetch)pendingFetches--;}
 }))}};
 const realm=vm.createContext({URL,TextEncoder,TextDecoder,crypto:webcrypto,Date:WorkDate,chrome,console,setTimeout,clearTimeout,queueMicrotask});const modules=new Map(),dir=path.resolve('extensions/rakeez-teacher-import-helper');
 function module(file){if(modules.has(file))return modules.get(file);const relative=path.relative(dir,file).replaceAll('\\','/');let code=runtimeFiles?Buffer.from(runtimeFiles[relative]).toString('utf8'):original?execFileSync('git',['show','b990848dc3b0300bcb8f4ea56c992dce7cb2d063:extensions/rakeez-teacher-import-helper/'+relative],{encoding:'utf8'}):fs.readFileSync(file,'utf8');if(file.endsWith('handoff-protocol.js'))code=code.replace('https://rakeezx.com',base);const m=new vm.SourceTextModule(code,{context:realm,identifier:file});modules.set(file,m);return m;}
 const entry=module(path.join(dir,'handoff-worker.js'));await entry.link((specifier,parent)=>module(path.resolve(path.dirname(parent.identifier),specifier)));await entry.evaluate();
 const send=(kind,m,sender)=>new Promise((resolve,reject)=>{realm.messageJSON=JSON.stringify(m);const value=vm.runInContext('JSON.parse(messageJSON)',realm);let accepted=false;for(const f of listeners[kind])accepted=f(value,sender,r=>resolve(JSON.parse(JSON.stringify(r))))||accepted;if(!accepted)resolve({ok:false});});
 return {metrics:()=>({styleCalls:Math.min(100000000,styleCalls),pendingReadProofs,wallMs:Date.now()-clockStart,modeledMs:Math.round(now()-clockStart),counters}),data,evidence,alarms,frozen,query:q=>chrome.tabs.query(q),releaseHome(){homeRelease?.();},get homeEntered(){return homeEntered;},release(){guardRelease?.();},get guardEntered(){return guardEntered;},kill(){active=false;},changeSourceDocument(){sourceDocument++;},removed(id){for(const f of listeners.removed)f(id);},changeAppDocument(){documentId='different-app-document';},
 internal:(m,override={})=>{evidence.messages??=[];evidence.messages.push(structuredClone(m));return send('internal',m,{id,url:chrome.runtime.getURL('popup.html'),...(popupDocumentId?{documentId:popupDocumentId}:{}),...override});},
 external:(m,override={})=>{evidence.claims.push(m.type);if(m.type==='n36-outcome')evidence.outcomes.push(structuredClone(m.outcome));return send('external',m,{url:app.url(),origin:base,tab:{id:99},documentId,...override});},
 async wake(){for(const f of listeners.alarm)f({name:'n36:background-wake'});},
 async wait(predicate,ms=15000){const end=Date.now()+ms;while(Date.now()<end){if(predicate(data))return;for(const [name,a] of alarms)if(a.when<=now()){alarms.delete(name);for(const f of listeners.alarm)f({name});}await new Promise(r=>setTimeout(r,30));}throw Error('Worker fixture deadline: '+JSON.stringify(data['n36:background-view']));}
 };
}
