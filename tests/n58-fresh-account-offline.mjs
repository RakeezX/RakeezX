// AI: reuse n94-ui-offline-shell's actual HTTP app/SW + served Demo helper.
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from '@playwright/test';
import {openReadyServedDemo} from './helpers/served-demo-readiness.mjs';
const runId='ba07cfbe-1861-4a6b-a4b1-2137ec432a26';
const lease=JSON.parse((await fs.readFile('C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/leases/browser.json','utf8')).replace(/^\uFEFF/,''));
assert.equal(lease.owner.token,runId);
const root=fileURLToPath(new URL('..',import.meta.url));
const mime={'.js':'text/javascript','.html':'text/html','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
const server=http.createServer(async(req,res)=>{
 const file=path.resolve(root,new URL(req.url,'http://127.0.0.1').pathname.replace(/^\/+/, '')||'index.html');
 if(!file.startsWith(root))return res.writeHead(403).end();
 try{res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});res.end(await fs.readFile(file));}catch{res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const url=`http://127.0.0.1:${server.address().port}`;
let browser,context;
const evidence={runId,url,scope:'Fresh synthetic Demo offline Calendar read; no account/hosted acceptance'};
try{
 browser=await chromium.launch({headless:true});
 context=await browser.newContext({viewport:{width:390,height:844}});
 await context.route('**/*',route=>new URL(route.request().url()).origin===url?route.continue():route.abort());
 await context.addInitScript(()=>sessionStorage.setItem('rakeezx-demo-session-v1','preparing'));
 const page=await context.newPage();page.setDefaultTimeout(20000);
 await openReadyServedDemo(page,url);
 await page.evaluate(()=>navigator.serviceWorker.ready);await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
 evidence.cached=await page.evaluate(async()=>!!await caches.match(new URL('/src/lib/calendar-runtime.js',location.origin).href));
 assert.equal(evidence.cached,true);
 await context.setOffline(true);await page.goto(url+'/#/calendar');
 await page.getByRole('button',{name:'إعدادات التقويم والمنطقة',exact:true}).click();
 assert.equal(await page.locator('[data-act="set-region"]').evaluateAll(rows=>rows.every(r=>r.disabled)),true);
 await page.getByRole('dialog').getByRole('button',{name:'تم',exact:true}).click();
 const result=await page.evaluate(async()=>{
  const s=await import('/src/store.js'),d=await import('/src/lib/db.js');
  return {ready:s.state.ready,ranges:s.calendarRangesOf().length,calendar:s.effectiveCalendar(s.activeYear().id).ok,
   outbox:(await d.getAll('outbox')).length,css:!!document.querySelector('link[href*="calendar-work-0417.css"]')?.sheet};
 });
 assert.equal(result.ready,true);assert.equal(result.calendar,true);assert.ok(result.ranges>0);assert.equal(result.css,true);assert.equal(result.outbox,0);
 evidence.result=result;evidence.status='PASS';
}catch(error){evidence.status='FAIL';evidence.error=error.message;process.exitCode=1;}
finally{await context?.close();await browser?.close();await new Promise(resolve=>server.close(resolve));await fs.writeFile('tests/n58-fresh-account-offline.json',JSON.stringify(evidence,null,2)+'\n');}
console.log(JSON.stringify(evidence));
