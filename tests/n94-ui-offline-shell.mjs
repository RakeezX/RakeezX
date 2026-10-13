// Affected offline first-visit check: actual SW/application in a fresh Demo.
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { openReadyServedDemo } from './helpers/served-demo-readiness.mjs';
const root=fileURLToPath(new URL('..',import.meta.url));
const directory=path.join(os.tmpdir(),'rakeez-n94-ui-30ab4451');await mkdir(directory,{recursive:true});
const mime={'.js':'text/javascript','.html':'text/html','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
const server=http.createServer(async(req,res)=>{
 const file=path.resolve(root,new URL(req.url,'http://127.0.0.1').pathname.replace(/^\/+/, '')||'index.html');
 if(!file.startsWith(root))return res.writeHead(403).end();
 try{res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});res.end(await readFile(file));}catch{res.writeHead(404).end();}
});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`;
let browser,context,page;const evidence={base,requests:[]};
try{
 browser=await chromium.launch({headless:true});context=await browser.newContext({viewport:{width:390,height:844}});
 await context.route('https://*.supabase.co/**',route=>route.abort());page=await context.newPage();page.setDefaultTimeout(20000);
 await page.goto(base);await page.evaluate(()=>sessionStorage.setItem('rakeezx-demo-session-v1','preparing'));await page.reload();
 await openReadyServedDemo(page,base);
 await page.evaluate(()=>navigator.serviceWorker.ready);await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
 evidence.cached=await page.evaluate(async()=>Object.fromEntries(await Promise.all(['src/views/items.js','src/lib/subitem-default-name.js','src/styles/grades.css'].map(async p=>[p,!!await caches.match(new URL(p,location.origin).href)]))));
 const teachingId=await page.evaluate(async()=>(await import('/src/store.js')).teachings()[0].id);
 await context.setOffline(true);await page.goto(`${base}/#/teaching/${teachingId}/items`);
 const result=await page.locator('[data-act="configure"]').first().waitFor({timeout:8000}).then(()=>true,()=>false);
 evidence.offlineItemsRendered=result;evidence.text=await page.locator('body').innerText();
 await page.screenshot({path:path.join(directory,'offline-first-items.png'),fullPage:true});
 console.log(JSON.stringify(evidence));
 assert.equal(result,true,'fresh installed shell must open subitem editor before its first online visit');
}finally{
 await context?.close();await browser?.close();await new Promise(resolve=>server.close(resolve));
 await writeFile(path.join(directory,'offline-shell-result.json'),JSON.stringify(evidence,null,2));
}
