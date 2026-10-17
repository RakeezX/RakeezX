// AI: real extension DOM/handlers/CSS, bounded loopback synthetic contexts only.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createServer} from 'node:http';
import {resolve,extname,sep} from 'node:path';
import {withIsolatedLocalBrowser} from '../../../scripts/ops-supervisor-v4/isolated-local-browser.mjs';
const taskId='continuous-n36-popup-width-top-diagnostics-module-load-0511-20261017',runId='b2e99f0f-39a6-4e33-8cad-39697097e090';
const taskFile='C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/'+taskId+'.json';
const root=resolve('.'),base='http://127.0.0.1:49451',dir='/extensions/rakeez-teacher-import-helper/',baseSha='e1950472da7abd53bd520dad2beac791146b298f';
let mode='normal';const checks=[];
const server=createServer(async(req,res)=>{try{
 const u=new URL(req.url,base),file=resolve(root,'.'+decodeURIComponent(u.pathname));
 if(!file.startsWith(root+sep))throw Error('outside');
 if(mode==='failed'&&['popup.js','categories-popup.js','run-controller.js'].some(n=>u.pathname===dir+n)){res.writeHead(404);return res.end();}
 if(mode==='protocol-failed'&&u.pathname===dir+'handoff-protocol.js'){res.writeHead(404);return res.end();}
 res.setHeader('content-type',({'.html':'text/html;charset=utf-8','.js':'text/javascript','.css':'text/css'})[extname(file)]||'application/octet-stream');
 if(extname(file)==='.html')res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'none'; object-src 'none'");
 const data=mode==='before'&&u.pathname===dir+'popup.css'?execFileSync('git',['show',baseSha+':'+u.pathname.slice(1)]):await fs.readFile(file);res.end(data);
}catch{res.writeHead(404);res.end();}});
const record=(name,evidence)=>{checks.push({name,status:'PASS',evidence});console.log('PASS '+name);};
async function setup(createContext,width=430,run=false,health='ready'){
 const context=await createContext({viewport:{width,height:900},locale:'ar-SA'}),page=await context.newPage();
 await page.addInitScript(({base,dir,health})=>{
  window.writes=[];window.failCopy=false;
  Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>{if(window.failCopy)throw Error('NotAllowedError');window.writes.push(text);}}});
  window.chrome={runtime:{getManifest:()=>({version:'0.5.11'}),getURL:p=>base+dir+p,sendMessage:async()=>{if(health==='timeout')return new Promise(()=>{});if(health==='invalidated')throw Error('Extension context invalidated.');return {ok:true,health:'ready'};}},tabs:{onRemoved:{addListener(){}},onUpdated:{addListener(){}}}};
 },{base,dir,health});
 await page.goto(base+dir+'popup.html'+(run?'?run=synthetic-secret-token':''));
 return {context,page};
}
async function copy(page){await page.locator('#copy-safe-report').click();return JSON.parse(await page.evaluate(()=>window.writes.at(-1)));}
try{
 await new Promise((r,j)=>{server.once('error',j);server.listen(49451,'127.0.0.1',r);});
 await withIsolatedLocalBrowser({taskFile,runId,url:base,timeoutMs:120000},async({createContext})=>{
  mode='before';let {context,page}=await setup(createContext,30);
  const before=await page.evaluate(()=>document.documentElement.getBoundingClientRect().width);assert.equal(before,30);await context.close();
  mode='normal';({context,page}=await setup(createContext,30));
  const after=await page.evaluate(()=>({root:document.documentElement.getBoundingClientRect().width,body:document.body.getBoundingClientRect().width,main:document.querySelector('main').getBoundingClientRect().width,scroll:document.body.scrollWidth}));
  assert.deepEqual(after,{root:430,body:430,main:430,scroll:430});await context.close();
  const responsive=[];
  for(const width of [320,390,1280]){
   ({context,page}=await setup(createContext,width,true));
   await page.waitForFunction(()=>typeof window.n36BeforeExport==='function');
   const result=await page.evaluate(()=>({viewport:innerWidth,scroll:document.documentElement.scrollWidth,body:document.body.getBoundingClientRect().width,button:document.querySelector('#copy-safe-report').getBoundingClientRect().toJSON()}));
   assert.ok(result.scroll<=width);assert.ok(result.body<=840);assert.ok(result.button.x>=0&&result.button.right<=width);responsive.push(result);
   await context.close();
  }
  record('n36_popup_intrinsic_width_regression_and_responsive_run_page',{before,after,responsive,native:'See native.json; HTTP shrink viewport is not native action proof.'});
  ({context,page}=await setup(createContext,430,true));
  await page.waitForFunction(()=>typeof window.n36BeforeExport==='function');
  let report=await copy(page);assert.equal(report.collection.stage,'idle');assert.ok(Object.values(report.health.modules).every(v=>v==='ready'));
  // Actual summary/review handler with fabricated aggregates and fabricated rows only.
  await page.evaluate(()=>{
   const rows=Array.from({length:303},(_,i)=>({name:'طالب مصطنع '+String.fromCharCode(1575+i%28)+String.fromCharCode(1575+Math.floor(i/28)),classroom:'خامس '+(i%10+1)}));
   window.n36Diagnostics.publish({stage:'partial',observed:303,coverage:'partial',terminal:'unproven',endpoint:'none',currentPage:7});
   window.dispatchEvent(new CustomEvent('n36:source-roster',{detail:{rows,complete:false,coverage:'partial',hasNextReport:false,processedReportPages:7,excluded:0}}));
  });
  assert.match(await page.locator('#source-class-summary').textContent(),/303.*10/);
  await fs.mkdir('tests/fixtures/n36-popup-width-diagnostics',{recursive:true});
  await page.screenshot({path:'tests/fixtures/n36-popup-width-diagnostics/run-summary.png',fullPage:true});
  report=await copy(page);assert.equal(report.collection.valid,303);assert.equal(report.collection.classes,10);assert.equal(report.collection.processedPages,7);assert.equal(report.collection.coverage,'partial');
  const snapshot=await page.locator('#source-class-summary').textContent();await copy(page);assert.equal(await page.locator('#source-class-summary').textContent(),snapshot);
  // Unknown keys, prototypes, accessor values and hostile exception strings never serialize.
  await page.evaluate(()=>{
   const secret='PRIVACY_SENTINEL_student_token_school_credential';
   document.querySelector('#table').value=secret;
   window.n36Diagnostics.publish(Object.assign(Object.create({valid:999}),{teacher:secret,stage:secret}));
   window.n36Diagnostics.publish({constructor:secret,__proto__:null,unknown:secret,coverage:secret,observed:secret,transfer:secret,receipt:secret});
   window.n36Diagnostics.publish(Object.defineProperty({},'valid',{enumerable:true,get(){throw Error(secret);}}));
   window.dispatchEvent(new ErrorEvent('error',{message:secret,filename:'https://secret.invalid/token/handoff-protocol.js?'+secret}));
   window.dispatchEvent(new PromiseRejectionEvent('unhandledrejection',{promise:Promise.resolve(),reason:Error(secret)}));
   const script=document.createElement('script');script.src='/private/'+secret+'/handoff-protocol.js?'+secret;script.dispatchEvent(new Event('error')); // not attached/fetched
  });
  report=await copy(page);const text=JSON.stringify(report);assert.ok(text.length<6000);assert.doesNotMatch(text,/PRIVACY_SENTINEL|طالب|خامس|secret|http|synthetic-secret-token/);assert.equal(report.collection.observed,null);assert.equal(report.collection.valid,null);
  assert.ok(report.errors.every(e=>['RUNTIME_ERROR','MODULE_OR_RUNTIME_REJECTION'].includes(e.code)&&e.asset==='unknown'));
  await page.evaluate(()=>{window.failCopy=true;});await page.locator('#copy-safe-report').click();assert.equal(await page.locator('#safe-report').isVisible(),true);
  assert.match(await page.locator('#safe-report-status').textContent(),/تعذّر/);assert.doesNotMatch(await page.locator('#safe-report').inputValue(),/PRIVACY_SENTINEL/);
  await page.evaluate(async()=>{window.failCopy=false;await window.n36BeforeExport().catch(()=>{});});
  report=await copy(page);assert.equal(report.collection.stage,'expired');assert.equal(report.collection.classes,null);assert.equal(report.errors.length,0);await context.close();
  for(mode of ['failed','protocol-failed']){
   ({context,page}=await setup(createContext,430,true));
   report=await copy(page);assert.equal(report.health.bootstrap,'ready');assert.equal(report.health.modules['categories-popup.js'],'not-available');
   if(mode==='failed')assert.ok(report.errors.some(e=>e.code==='MODULE_RESOURCE_LOAD_FAILED'));
   assert.doesNotMatch(JSON.stringify(report),/synthetic-secret-token|chrome-extension:|http/);await context.close();
  }
  mode='normal';
  for(const health of ['timeout','invalidated']){
   ({context,page}=await setup(createContext,430,false,health));
   if(health==='timeout')await page.waitForTimeout(1600);
   report=await copy(page);assert.equal(report.health.background,health==='timeout'?'timeout':'context-invalidated');
   assert.ok(report.errors.some(e=>e.code===(health==='timeout'?'BACKGROUND_TIMEOUT':'EXTENSION_CONTEXT_INVALIDATED')));await context.close();
  }
  record('n36_top_diagnostics_independent_main_failure_clipboard_fallback_and_privacy','Real DOM top button before run, synthetic 303/10/7 partial summary/review handler, actual pre-export expiry/clear handler, health timeout/context invalidation, failed entry ESM, failed protocol import, write failure selectable fallback; prototype/accessor/unknown/sentinel/error allowlists; no collection mutation on copy.');
 });
 await fs.writeFile('tests/n36-popup-width-diagnostics-browser.json',JSON.stringify({taskId,runId,baseSha,status:'PASS',checks},null,2)+'\n');
}finally{await new Promise(r=>server.close(r));}
