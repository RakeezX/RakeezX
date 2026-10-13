import fs from 'node:fs/promises';import path from 'node:path';import {createRequire} from 'node:module';
const ROOT='C:/Users/Abody/Projects/RakeezX';const normalize=p=>path.win32.normalize(p).toLowerCase();
export function validateLocalBrowserTask(task,{taskFile,runId,url,activationId}) {
 const target=new URL(url);if(!['http:','https:'].includes(target.protocol)||!['127.0.0.1','localhost','[::1]'].includes(target.hostname)||target.username||target.password||!target.port)throw Error('Only an explicit task-owned loopback HTTP(S) origin is allowed');
 if(task.status!=='running'||task.activationId!==activationId||task.attempt?.runId!==runId||!['local','synthetic'].includes(task.executionMode)||task.liveMutation||task.liveAuthorizationRef||task.resourceClass==='live-mutation')throw Error('Only an active local/synthetic non-live task may use this isolated phase');
 if(!/^[a-z0-9][a-z0-9._-]{0,159}$/.test(task.id??'')||normalize(taskFile)!==normalize(ROOT+'/artifacts/ops-supervisor-v4/queue/'+task.id+'.json')||normalize(task.worktreePath)!==normalize(ROOT+'/.worktrees/'+task.id))throw Error('Canonical task/worktree identity mismatch');
 return target.origin;
}
export async function withIsolatedLocalBrowser({taskFile,runId,url,engine='chromium',timeoutMs=45000},check) {
 if(typeof check!=='function'||!['chromium','webkit','firefox'].includes(engine)||!Number.isInteger(timeoutMs)||timeoutMs<1000||timeoutMs>120000)throw Error('Invalid bounded local browser check');
 const read=async f=>JSON.parse((await fs.readFile(f,'utf8')).replace(/^\uFEFF/,''));const task=await read(taskFile),config=await read(ROOT+'/artifacts/ops-supervisor-v4/workflow-v5.json');
 const origin=validateLocalBrowserTask(task,{taskFile,runId,url,activationId:config.controller.activationId});
 const req=createRequire(ROOT+'/package.json'),playwright=req('playwright');let browser,timer;const contexts=[];
 try {
  browser=await playwright[engine].launch({headless:true});
  const createContext=async (options={})=>{const safeKeys=new Set(['viewport','locale','colorScheme','reducedMotion','deviceScaleFactor','isMobile','hasTouch','timezoneId']);if(Object.keys(options).some(key=>!safeKeys.has(key)))throw Error('Only visual-emulation options are allowed; no saved profile, credentials, proxy or CSP bypass');const c=await browser.newContext({...options,serviceWorkers:'block'});contexts.push(c);await c.route('**/*',route=>{let allowed=false;try{allowed=new URL(route.request().url()).origin===origin;}catch{}return allowed?route.continue():route.abort('blockedbyclient');});return c;};
  const limited=new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Owned isolated browser check deadline exceeded')),timeoutMs);timer.unref?.();});
  return await Promise.race([check({createContext,url,origin,taskId:task.id,runId}),limited]);
 } finally {clearTimeout(timer);for(const c of contexts)await c.close().catch(()=>{});if(browser)await browser.close().catch(()=>{});}
}
