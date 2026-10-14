import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {execFileSync} from 'node:child_process';
import {chromium} from '@playwright/test';
const lease=JSON.parse((await readFile('C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/leases/browser.json','utf8')).replace(/^\uFEFF/,''));
assert.equal(lease.taskId,'continuous-n101-reviewed-rejected-session-repair-20261014');assert.equal(lease.owner.token,'445614fc-3975-4a8c-814f-0fc8be85d6a3');
const root=resolve('.');let current=false,browser,context,timer;
const server=createServer(async(req,res)=>{try{
 const pathname=new URL(req.url,'http://localhost').pathname;
 const file=resolve(root,pathname==='/'?'index.html':'.'+decodeURIComponent(pathname));
 if(!file.startsWith(root+sep))throw Error('outside root');
 res.setHeader('Content-Type',{'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'}[extname(file)]??'application/octet-stream');
 res.setHeader('Cache-Control','no-store');
 res.end(await readFile(file));
}catch{res.writeHead(404).end();}});
await new Promise(done=>server.listen(0,'127.0.0.1',done));const origin='http://127.0.0.1:'+server.address().port;
try{
 browser=await chromium.launch({headless:true});timer=setTimeout(()=>browser.close(),90000);timer.unref();
 context=await browser.newContext({viewport:{width:1280,height:844},serviceWorkers:'allow'});
 await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort('blockedbyclient'));
 const page=await context.newPage();await page.goto(origin+'/');
 await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
 if(!await page.evaluate(()=>!!navigator.serviceWorker.controller))await page.reload();
 const routing=await readFile('src/lib/session-recovery.js','utf8');
 const dependencies=await page.evaluate(async()=>{const cache=await caches.open('rakeezx-v61');return Promise.all(['/src/app.js','/src/lib/db.js','/src/lib/workspaces.js','/src/lib/workspace-routing.js','/src/lib/initial-restore.js','/src/lib/account-provisioning.js','/src/lib/session-recovery.js','/src/lib/sync-v2.js','/src/lib/calendar-presets.js'].map(async file=>({file,present:!!await cache.match(file)})));});
 assert.ok(dependencies.every(d=>d.present));
 await context.setOffline(true);await page.reload();await page.locator('[data-workspace-login]').waitFor();
 const cached=await page.evaluate(async()=>({source:await(await fetch('/src/lib/session-recovery.js')).text(),keys:await caches.keys()}));assert.equal(cached.source,routing);assert.ok(cached.keys.includes('rakeezx-v61'));
 console.log('PASS n101_actual_repair_ui_and_shell: actual v61 Service Worker caches required repair dependencies and exact session-recovery source; app and repair module reload offline over HTTP');
}finally{clearTimeout(timer);if(context)await context.close();if(browser)await browser.close();await new Promise((r,j)=>server.close(e=>e?j(e):r()));}
