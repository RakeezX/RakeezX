// AI-authored: shared leased, fresh synthetic PWA context. No live account or remote request.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
import {start} from './server.mjs';
const canonical='C:/Users/Abody/Projects/RakeezX',taskId='continuous-n88-content-priority-after-n130-20261027',runId='87b53fe5-2574-46b3-86e5-35363518d70b',taskFile=`${canonical}/artifacts/ops-supervisor-v4/queue/${taskId}.json`;
const lease=(name,action)=>execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-File',canonical+'/scripts/ops-supervisor-v4/resource-lease.ps1','-Name',name,'-Action',action,'-TaskFile',taskFile,'-RuntimeRoot',canonical+'/artifacts/ops-supervisor-v4','-WaitSeconds','0','-OwnerToken',runId],{encoding:'utf8',windowsHide:true,timeout:20000}).trim();
let server,browser,context;const owned=[],report={status:'FAIL',checks:[],cleanup:{}};
try{
 for(const name of ['integration','browser']){assert.match(lease(name,'acquire'),/^(ACQUIRED|ALREADY OWNED)/);owned.push(name);}
 server=await start();const origin=new URL(server.url).origin;
 const {chromium}=createRequire(canonical+'/package.json')('playwright');browser=await chromium.launch({headless:true});context=await browser.newContext({serviceWorkers:'allow',viewport:{width:390,height:1000}});
 await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort('blockedbyclient'));
 const page=await context.newPage();page.setDefaultTimeout(15000);await page.goto(server.url);await page.waitForFunction(()=>!!window.compactFixture);await page.getByRole('link',{name:/مساحة الطلاب/}).first().click();await page.locator('[data-code] input').first().waitFor();
 await page.evaluate(async()=>{await navigator.serviceWorker.register('/sw.js');await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)await new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}));});
 assert.equal(await page.evaluate(async()=> (await caches.keys()).includes('rakeezx-v92')),true);
 await context.setOffline(true);
 for(const path of ['/src/views/student-portal-class.js','/src/styles/student-portal-class.css']){
  const text=await page.evaluate(async path=>{const response=await fetch(path,{cache:'reload'});if(!response.ok)throw Error('Offline shell asset missing');return response.text();},path);const source=await readFile('.'+path,'utf8');assert.equal(text,path.endsWith('.js')?source.replace('runtime.mountClassService(target,','window.compactFixture.mount(target,'):source);
 }
 await page.locator('[data-action=open-guidance]').click();await page.locator('[data-guidance-source]').waitFor();assert.equal(await page.locator('[name=executionInstructions]').isVisible(),true);
 await page.locator('[data-action=open-settings]').click();assert.equal(await page.locator('[name=grades]').isVisible(),true);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 const privateResult=await page.evaluate(async()=>{try{await fetch('/api/n88/student/read',{cache:'reload'});return 'unexpected response';}catch{return 'offline unavailable';}});assert.equal(privateResult,'offline unavailable');
 await page.screenshot({path:'tests/n88-portal-content-priority-20261027/pwa-offline-editors.png',fullPage:false,mask:[page.locator('[data-code] input')]});
 report.status='PASS';report.checks=['Actual v92 Service Worker installed/controlled a fresh synthetic loopback context; current teacher view (existing synthetic mount seam only) and exact CSS bytes served after browser offline switch.','Actual mounted teacher component remains usable offline: explicit guidance/settings navigation and 390px no overflow, using synthetic ports.','Student private API remains network-only and unavailable offline; no private cache fallback.'];
 report.limitations='Synthetic PWA source/layout check, not live account/Sync, production served-asset or cold offline account boot certification. Student private offline availability is deliberately not enabled.';
}catch(e){report.failure={message:e.message,stack:e.stack};process.exitCode=1;}
finally{await context?.close();await browser?.close();await server?.close();report.cleanup.ownedContextBrowserServerClosed=true;for(const name of owned.reverse())report.cleanup[name]=lease(name,'release');await writeFile(`tests/n88-portal-content-priority-20261027/pwa-${report.status==='PASS'?'result':'failure-'+Date.now()}.json`,JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify(report));
