// AI: actual popup DOM, modules and CSS over owned loopback HTTP. Fabricated transport only.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import {withIsolatedLocalBrowser} from '../scripts/ops-supervisor-v4/isolated-local-browser.mjs';
const root=process.cwd(), result={checks:[],synthetic:true,accountWrites:'NOT_RUN'};
const server=http.createServer(async(req,res)=>{try{
 const u=new URL(req.url,'http://127.0.0.1'),file=path.resolve(root,'.'+decodeURIComponent(u.pathname));
 if(!file.startsWith(root+path.sep))throw Error('outside');
 res.setHeader('content-type',({'.html':'text/html;charset=utf-8','.js':'text/javascript','.css':'text/css'})[path.extname(file)]||'application/octet-stream');
 res.end(await fs.readFile(file));
}catch{res.writeHead(404);res.end();}});
try{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const origin='http://127.0.0.1:'+server.address().port;
 await withIsolatedLocalBrowser({taskFile:'C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/continuous-n36-actual-transfer-local-update-copy-20261019.json',runId:'fe5829e6-1f04-4655-a82a-ca7cedcf3934',url:origin,timeoutMs:45000},async({createContext})=>{
  const context=await createContext({viewport:{width:430,height:900},locale:'ar-SA'}),page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await context.addInitScript(()=>{
   window.__sent=[];window.__fail=true;window.__receipts={};
   const event={addListener(){}};
   window.chrome={runtime:{getManifest:()=>({version:'0.5.13'}),onMessage:event,async sendMessage(m){
    if(m.type==='n36-health')return {ok:true,health:'ready'};
    if(m.type==='n36-create'){
     __sent.push(m.envelope);
     if(__fail)return {ok:false,code:'APP_CHANGED'};
     const id=String(__sent.length).padStart(64,'0');__receipts[id]=m.envelope.rows.length;
     return {ok:true,actionId:id};
    }
    if(m.type==='n36-result'){const n=__receipts[m.actionId];return {ok:true,status:'saved',added:n,existing:0,remaining:0,total:n};}
    return {ok:true};
   }},tabs:{onRemoved:event,onUpdated:event}};
  });
  await page.goto(origin+'/extensions/rakeez-teacher-import-helper/popup.html?run=synthetic');
  await page.waitForFunction(()=>!!window.n36HasSourceRoster);
  await page.evaluate(()=>{
   window.n36AutomaticBatch='a'.repeat(64);
   window.n36BeforeExport=async()=>{};
   window.n36HandoffSource=()=>({source:'madrasati',scope:'reviewed-run'});
   const letters=['ألف','باء','جيم','دال','هاء','واو','زاي','حاء','طاء','ياء'];
   const rows=letters.flatMap((label,c)=>Array.from({length:c<3?31:30},(_,n)=>({name:'طالب '+letters[Math.floor(n/10)]+' '+letters[n%10],classroom:'خامس '+label})));
   window.dispatchEvent(new CustomEvent('n36:source-roster',{detail:{rows,complete:false,coverage:'partial',hasNextReport:false,processedReportPages:7,excluded:0}}));
  });
  await page.locator('#run-status').filter({hasText:'فصول لم يتأكد'}).waitFor();
  assert.equal(await page.evaluate(()=>__sent.length),1,'A destination rejection stops automatic retries and retains all unsent classes');
  assert.match(await page.locator('#handoff-status').innerText(),/APP_CHANGED/);
  assert.match(await page.locator('#handoff-status').innerText(),/ارجع إلى تبويب ركيز/);
  assert.doesNotMatch(await page.locator('#source-class-status').innerText(),/للمراجعة/);
  assert.equal(await page.locator('#noor-controls').isVisible(),false);
  assert.equal(await page.locator('#partial-approval').isVisible(),false);
  assert.equal(await page.locator('#handoff-transfer').isVisible(),false);
  await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>{window.__safeReport=JSON.parse(text);}},configurable:true}));
  await page.locator('#copy-safe-report').click();
  const safe=await page.evaluate(()=>__safeReport);
  assert.equal(safe.collection.failure,'APP_CHANGED');assert.equal(safe.collection.valid,303);assert.equal(safe.collection.receipt,'unknown');
  assert.ok(!JSON.stringify(safe).includes('طالب'));
  result.checks.push('303 fabricated names / 10 classes / partial: rejected first sends terminate truthfully, keep cursors, show APP_CHANGED and actionable help, no class review');
  await page.screenshot({path:'tests/fixtures/n36-review-1400/failure.png',fullPage:true});
  await page.evaluate(()=>{__fail=false;});
  await page.locator('#source-retry').click();
  await page.locator('#run-status').filter({hasText:'اكتمل استيراد الأسماء المتاحة'}).waitFor({timeout:20000});
  const sent=await page.evaluate(()=>__sent);
  assert.equal(sent.length,11);
  assert.equal(sent.slice(1).reduce((n,e)=>n+e.rows.length,0),303);
  assert.ok(sent.every(e=>e.complete===false));
  assert.match(await page.locator('#run-status').innerText(),/التغطية جزئية/);
  assert.match(await page.locator('#run-counts').innerText(),/303.*10/);
  assert.equal(await page.locator('#source-retry').isVisible(),false);
  await page.screenshot({path:'tests/fixtures/n36-review-1400/saved-partial.png',fullPage:true});
  result.checks.push('Single explicit resume sends exactly the same owned pending rows; only fabricated canonical-shaped ACKs advance cursors, partial remains partial, summary survives erasure');
  assert.deepEqual(errors,[]);
 });
 result.status='PASS';
}catch(error){result.status='FAIL';result.failure=error.stack;process.exitCode=1;}
finally{await new Promise(r=>server.close(r));await fs.writeFile('tests/n36-review-1400-copy.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));}
