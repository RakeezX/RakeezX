// AI: ordinary shared browser phase for this live-authorized card's local tests.
import {execFileSync} from 'node:child_process';import {chromium} from '@playwright/test';
export async function withSharedLocalBrowser({taskFile,runId,url,timeoutMs=120000},check){
 const origin=new URL(url).origin;if(!/^http:\/\/127\.0\.0\.1:\d+$/.test(origin))throw Error('Loopback origin required');
 const lease=action=>{for(let i=0;;i++){try{return execFileSync('powershell.exe',['-NoProfile','-File','C:/Users/Abody/Projects/RakeezX/scripts/ops-supervisor-v4/resource-lease.ps1','-Name','browser','-Action',action,'-TaskFile',taskFile,'-OwnerToken',runId,'-WaitSeconds','0'],{encoding:'utf8'}).trim();}catch(e){if(i>=2||!String(e.stderr).includes('being used by another process'))throw e;Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,150);}}};
 let browser,timer,leased=false;const contexts=[];
 try{lease('acquire');leased=true;browser=await chromium.launch({headless:true});const createContext=async options=>{const c=await browser.newContext({...options,serviceWorkers:'block'});contexts.push(c);await c.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());return c;};return await Promise.race([check({createContext,origin}),new Promise((_,j)=>{timer=setTimeout(()=>j(Error('Owned shared check deadline')),timeoutMs);})]);}
 finally{clearTimeout(timer);for(const c of contexts)await c.close().catch(()=>{});await browser?.close().catch(()=>{});if(leased)lease('release');}
}
