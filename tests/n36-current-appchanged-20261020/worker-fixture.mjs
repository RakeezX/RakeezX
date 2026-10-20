// Focused transport seam: expose the existing serialized transport and suppress collector scheduling only; all receiver/nonce/schema/owner guards remain real. No source coordinator is run.
// AI: actual ESM worker handlers, synthetic Chrome API boundary; persistent session across fresh realms.
import fs from 'node:fs';import {execFileSync} from 'node:child_process';import vm from 'node:vm';import path from 'node:path';import {webcrypto} from 'node:crypto';
export async function backgroundFixture({app,source,base,data={},evidence={reads:0,navigation:[],deliveries:[],claims:[],outcomes:[]},freezePhase=null,reportedWorker=false}){
 const id='a'.repeat(32),listeners={internal:[],external:[],alarm:[],removed:[]},alarms=new Map();let active=true,documentId='app-document-1',sourceDocument=Number(data['n36:background-job']?.sourceDocument?.split('-').at(-1))||1,freezeResolve;
 const frozen=new Promise(r=>freezeResolve=r),never=()=>new Promise(()=>{}),live=fn=>async(...args)=>active?fn(...args):never();
 const chrome={runtime:{id,getURL:p=>'chrome-extension://'+id+'/'+p,onMessage:{addListener:f=>listeners.internal.push(f)},onMessageExternal:{addListener:f=>listeners.external.push(f)}},
 storage:{session:{get:live(async k=>structuredClone(k===null?data:Object.hasOwn(data,k)?{[k]:data[k]}:{})),set:live(async o=>{Object.assign(data,structuredClone(o));if(freezePhase&&data['n36:background-job']?.phase===freezePhase){active=false;freezeResolve();return never();}}),remove:live(async k=>{delete data[k];})}},
 alarms:{create:live(async(n,v)=>alarms.set(n,v)),clear:live(async n=>alarms.delete(n)),onAlarm:{addListener:f=>listeners.alarm.push(f)}},
 tabs:{query:live(async q=>q.active?[{id:7,windowId:1,url:source.url(),status:'complete'}]:[{id:99,windowId:1,url:app.url()}]),get:live(async id=>({id,url:id===7?source.url():app.url(),status:'complete'})),create:async()=>{throw Error('NEW_TAB_FORBIDDEN');},update:live(async(id,o)=>{if(id!==7||!o.url||new URL(o.url).origin!==base)throw Error('NAVIGATION_FORBIDDEN');evidence.navigation.push(o.url);await source.goto(o.url);sourceDocument++;return {id,url:source.url()};}),remove:async()=>{throw Error('REMOVE_TAB_FORBIDDEN');},onUpdated:{addListener(){}},onRemoved:{addListener:f=>listeners.removed.push(f)}},
 scripting:{executeScript:live(async input=>{
  const page=input.target.tabId===7?source:app;
  if(input.files){for(const file of input.files)await page.addScriptTag({url:base+'/extensions/rakeez-teacher-import-helper/'+file});return [];}
  if(input.target.tabId===7&&['readAutomaticTeacherPage','readSourceReportPage'].includes(input.func.name))evidence.reads++;
  if(input.args?.[0]?.nonce)evidence.deliveries.push(input.args[0].nonce);
  const result=await page.evaluate(({func,args})=>new Function('args','return ('+func+')(...args)')(args),{func:input.func.toString(),args:input.args??[]});
  return [{frameId:0,documentId:input.target.tabId===7?'source-document-'+sourceDocument:documentId,result}];
 })}};
 const realm=vm.createContext({URL,TextEncoder,TextDecoder,crypto:webcrypto,chrome,console,setTimeout,clearTimeout,queueMicrotask});const modules=new Map(),dir=path.resolve('extensions/rakeez-teacher-import-helper');
 function module(file){if(modules.has(file))return modules.get(file);let code=reportedWorker&&file.endsWith('handoff-worker.js')?execFileSync('git',['show','91b12fa2c6488c74a8cda81650861cbe1b13e870:extensions/rakeez-teacher-import-helper/handoff-worker.js'],{encoding:'utf8'}):fs.readFileSync(file,'utf8');if(!reportedWorker&&file.endsWith('handoff-worker.js')){code=code.replace('queueMicrotask(()=>background.wake());','').replace('background.bootstrap().catch(()=>{});','');code+='\nexport {transport as fixtureTransport};';}if(file.endsWith('handoff-protocol.js'))code=code.replace('https://rakeezx.com',base);const m=new vm.SourceTextModule(code,{context:realm,identifier:file});modules.set(file,m);return m;}
 const entry=module(path.join(dir,'handoff-worker.js'));await entry.link((specifier,parent)=>module(path.resolve(path.dirname(parent.identifier),specifier)));await entry.evaluate();
 const send=(kind,m,sender)=>new Promise((resolve,reject)=>{realm.messageJSON=JSON.stringify(m);const value=vm.runInContext('JSON.parse(messageJSON)',realm);let accepted=false;for(const f of listeners[kind])accepted=f(value,sender,r=>resolve(JSON.parse(JSON.stringify(r))))||accepted;if(!accepted)resolve({ok:false});});
 return {data,evidence,alarms,frozen,kill(){active=false;},changeSourceDocument(){sourceDocument++;},removed(id){for(const f of listeners.removed)f(id);},changeAppDocument(){documentId='different-app-document';},
 async background(m){const jobId='f'.repeat(64);if(!data['n36:background-job'])data['n36:background-job']={id:jobId,expiresAt:Date.now()+300000,createdAt:Date.now(),phase:'binding',visited:[],rosterSchools:[],series:[]};realm.messageJSON=JSON.stringify(m);const r=await entry.namespace.fixtureTransport(vm.runInContext('JSON.parse(messageJSON)',realm),{jobId,windowId:1});return JSON.parse(JSON.stringify(r));},
 internal:(m,override={})=>send('internal',m,{id,url:chrome.runtime.getURL('popup.html'),documentId:'popup-document-1',...override}),
 external:(m,override={})=>{evidence.claims.push(m.type);if(m.type==='n36-outcome')evidence.outcomes.push(structuredClone(m.outcome));return send('external',m,{url:app.url(),origin:base,tab:{id:99},documentId,...override});},
 async wake(){for(const f of listeners.alarm)f({name:'n36:background-wake'});},
 async wait(predicate,ms=15000){const end=Date.now()+ms;while(Date.now()<end){if(predicate(data))return;await new Promise(r=>setTimeout(r,30));}throw Error('Worker fixture deadline: '+JSON.stringify(data['n36:background-view']));}
 };
}
