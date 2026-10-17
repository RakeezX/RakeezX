import fs from 'node:fs/promises';import path from 'node:path';import {createRequire} from 'node:module';
const ROOT='C:/Users/Abody/Projects/RakeezX';const normalize=p=>path.win32.normalize(p).toLowerCase();
export function validateLocalBrowserTask(task,{taskFile,runId,url,activationId}) {
 const target=new URL(url);if(!['http:','https:'].includes(target.protocol)||!['127.0.0.1','localhost','[::1]'].includes(target.hostname)||target.username||target.password||!target.port)throw Error('Only an explicit task-owned loopback HTTP(S) origin is allowed');
 if(task.status!=='running'||task.activationId!==activationId||task.attempt?.runId!==runId||!['local','synthetic'].includes(task.executionMode)||task.liveMutation||task.liveAuthorizationRef||task.resourceClass==='live-mutation')throw Error('Only an active local/synthetic non-live task may use this isolated phase');
 if(!/^[a-z0-9][a-z0-9._-]{0,159}$/.test(task.id??'')||normalize(taskFile)!==normalize(ROOT+'/artifacts/ops-supervisor-v4/queue/'+task.id+'.json')||normalize(task.worktreePath)!==normalize(ROOT+'/.worktrees/'+task.id))throw Error('Canonical task/worktree identity mismatch');
 return target.origin;
}
export async function withIsolatedLocalBrowser({taskFile,runId,url,engine='chromium',timeoutMs=45000,syntheticAppOrigin=null},check) {
 if(typeof check!=='function'||!['chromium','webkit','firefox'].includes(engine)||!Number.isInteger(timeoutMs)||timeoutMs<1000||timeoutMs>120000)throw Error('Invalid bounded local browser check');
 const read=async f=>JSON.parse((await fs.readFile(f,'utf8')).replace(/^\uFEFF/,''));const task=await read(taskFile),config=await read(ROOT+'/artifacts/ops-supervisor-v4/workflow-v5.json');
 const origin=validateLocalBrowserTask(task,{taskFile,runId,url,activationId:config.controller.activationId});
 const fixtureOrigin=validateSyntheticAppOrigin(task,syntheticAppOrigin);
 const req=createRequire(ROOT+'/package.json'),playwright=req('playwright');let browser,timer;const contexts=[];
 try {
  browser=await playwright[engine].launch({headless:true,...(fixtureOrigin?{args:['--disable-background-networking','--disable-component-update','--disable-sync','--no-first-run','--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1, EXCLUDE [::1]']}: {})});
  const createContext=async (options={})=>{const safeKeys=new Set(['viewport','locale','colorScheme','reducedMotion','deviceScaleFactor','isMobile','hasTouch','timezoneId']);if(Object.keys(options).some(key=>!safeKeys.has(key)))throw Error('Only visual-emulation options are allowed; no saved profile, credentials, proxy or CSP bypass');const c=await browser.newContext({...options,serviceWorkers:'block'});contexts.push(c);if(fixtureOrigin){if(typeof c.routeWebSocket!=='function')throw Error('WebSocket isolation unavailable');await c.routeWebSocket('**/*',ws=>ws.close());}await c.route('**/*',async route=>{let requested;try{requested=new URL(route.request().url());}catch{return route.abort('blockedbyclient');}if(requested.origin===origin)return route.continue();if(fixtureOrigin&&requested.origin===fixtureOrigin){try{return await route.fulfill(await syntheticAppResource(requested.href,{origin,fixtureOrigin,method:route.request().method()}));}catch{return route.abort('blockedbyclient');}}return route.abort('blockedbyclient');});return c;};
  const limited=new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Owned isolated browser check deadline exceeded')),timeoutMs);timer.unref?.();});
  return await Promise.race([check({createContext,url,origin,fixtureOrigin,taskId:task.id,runId}),limited]);
 } finally {clearTimeout(timer);for(const c of contexts)await c.close().catch(()=>{});if(browser)await browser.close().catch(()=>{});}
}

export function validateSyntheticAppOrigin(task,wanted) {
 if(wanted==null)return null;
 if(task.id!=='continuous-n36-final-receiver-journey-20261018'||task.syntheticBrowserFixtureOrigin!=='https://rakeezx.com'||wanted!=='https://rakeezx.com')throw Error('Synthetic fixture origin is not authorized for this task');
 return wanted;
}
export async function syntheticAppResource(requestUrl,{origin,fixtureOrigin,method='GET',fetcher=fetch,timeoutMs=5000,maxBytes=4194304}){
 const base=new URL(origin),u=new URL(requestUrl);
 if(!['http:','https:'].includes(base.protocol)||!['127.0.0.1','localhost','[::1]'].includes(base.hostname)||!base.port||base.username||base.password||fixtureOrigin!=='https://rakeezx.com'||u.origin!==fixtureOrigin||u.username||u.password||!['GET','HEAD'].includes(method))throw Error('Synthetic resource denied');
 const mapped=new URL(origin);mapped.pathname=u.pathname;mapped.search=u.search;mapped.hash='';
 if(mapped.origin!==base.origin||!Number.isSafeInteger(maxBytes)||maxBytes<1||maxBytes>4194304||!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>5000)throw Error('Synthetic resource bounds denied');
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
 try{
  const response=await fetcher(mapped.href,{method,redirect:'error',credentials:'omit',cache:'no-store',signal:controller.signal,headers:{Accept:'*/*'}});
  if(response.status>=300&&response.status<400||response.url&&new URL(response.url).origin!==base.origin)throw Error('Synthetic resource redirect denied');
  if(Number(response.headers.get('content-length')||0)>maxBytes)throw Error('Synthetic resource oversized');
  let size=0;const chunks=[];if(method!=='HEAD'&&response.body){const reader=response.body.getReader();try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxBytes)throw Error('Synthetic resource oversized');chunks.push(Buffer.from(value));}}finally{await reader.cancel().catch(()=>{});}}
  return {status:response.status,headers:{'content-type':response.headers.get('content-type')||'application/octet-stream','cache-control':'no-store','referrer-policy':'no-referrer'},body:Buffer.concat(chunks)};
 }finally{clearTimeout(timer);}
}
