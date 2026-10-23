// AI-authored parser-seam reproduction, not a portal response capture or app UI acceptance.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createServer} from 'node:http';
import {resolve,sep} from 'node:path';
import {execFileSync} from 'node:child_process';
import {chromium} from '@playwright/test';
import {sourceHTML,dash,timetable} from '../n36-lesson-link-20261023/source.mjs';

const taskId='continuous-n36-actual-timetable-dom-20261023',runId='370692a5-ce70-4d20-965e-ba09b56c10e4';
const root=resolve('.'),folder='tests/n36-actual-timetable-20261023/';let base;
const taskFile='C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/'+taskId+'.json';
const lease=action=>execFileSync('powershell.exe',['-NoProfile','-File','C:/Users/Abody/Projects/RakeezX/scripts/ops-supervisor-v4/resource-lease.ps1','-Name','browser','-Action',action,'-TaskFile',taskFile,'-OwnerToken',runId,'-WaitSeconds','0'],{encoding:'utf8'}).trim();
const link='/SchoolSchedule/Schedule/ManageLecture?SchoolId='+'a'.repeat(32)+'&lectureId=1&dateTicks=638900000000000000&subjectId=2&classroomId=3';
// Observed tag/class nesting, blank corner, explicit headers, subject/class label roles.
// All IDs, dashboard, CSS and omitted/decorative descendants are fabricated. This
// reproduces a parser seam; it does not claim to reproduce the server's GET bytes.
const structure='<div class="hijriSchedule teacherSchedule table-responsive dga-table"><table class="table table-sm table-bordered"><tr><th></th><th>الحصة\nالأولى</th></tr><tr><th>الأحد</th><td class="day-cell text-center"><div class="cs-lesson-card "><a href="'+link+'"><div class="schedule-card done"><div class="title"><h2>المهارات الرقمية</h2></div><small>خامس 5</small></div></a></div></td></tr></table></div>';
let variant='style',browser,context,leased=false;
const result={taskId,runId,baseSha:'7fa9b61259df3036caf8e6eda6bf03196d7d4d2e',scope:'synthetic parser seam only; no rendered application UI PASS',cases:[],externalRequests:[]};
const server=createServer(async(req,res)=>{try{
 const u=new URL(req.url,base);res.setHeader('content-type','text/html;charset=utf-8');
 if(u.pathname===dash)return res.end(sourceHTML(u,{count:2}));
 if(u.pathname===new URL(timetable,base).pathname)return res.end((variant==='style'?'<style>.schedule-card{display:flex}</style>':variant==='stylesheet'?'<link rel="stylesheet" href="/fabricated.css">':variant==='hidden-css'?'<style>.schedule-card{display:none}</style>':'')+structure);
 const file=resolve(root,'.'+u.pathname);assert.ok(file.startsWith(root+sep));res.setHeader('content-type','text/javascript');res.end(await fs.readFile(file));
 }catch(e){res.writeHead(404);res.end('not found');}});
try{
 lease('acquire');leased=true;await new Promise((r,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',r);});base='http://127.0.0.1:'+server.address().port;
 // Shared phase, not the non-live isolated-phase exception: this card has a live
 // authorization reference. Fresh synthetic context, loopback only, no profiles.
 browser=await chromium.launch({headless:true});context=await browser.newContext({serviceWorkers:'block'});
 await context.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin===base)return route.continue();result.externalRequests.push(u.origin);return route.abort();});
 const page=await context.newPage();await page.goto(base+dash);
 await page.evaluate(async()=>{
  await import('/extensions/rakeez-teacher-import-helper/route-diagnostics.js');
  const {readAutomaticTeacherPage}=await import('/extensions/rakeez-teacher-import-helper/selection.js');
  const home=readAutomaticTeacherPage('home');if(!home.ok)throw Error(home.code);
  window.context={...home.runContext,sourceURL:location.href,setupKind:'timetable',requestId:'fixture|timetable',readJobId:'fixture',remainingMs:8000};
  const proof=readAutomaticTeacherPage('read-proof',null,window.context);if(!proof.ok)throw Error(proof.code);window.context.readProof=proof.proof;
 });
 for(variant of ['style','stylesheet','hidden-css','no-css']){
  const value=await page.evaluate(async path=>(await import('/extensions/rakeez-teacher-import-helper/source-adapter.js')).readSourceReportPage('fetch',{...window.context,path}),timetable);
  if(variant==='no-css'){
   assert.equal(value.ok,true,JSON.stringify(value));assert.equal(value.tables.length,1);assert.equal(value.tables[0].text,'اليوم\tالحصة\tالفصل\tالمادة\nالأحد\t1\tخامس 5\tالمهارات الرقمية');
  }else{
   assert.equal(value.ok,false,JSON.stringify(value));assert.equal(value.code,'SCHOOL_CONTEXT_UNCONFIRMED');assert.equal(value.setupRejectReason,'response-school-absent');assert.ok(!value.tables?.length);
  }
  result.cases.push({variant,status:'PASS',ok:value.ok,code:value.code??null,setupRejectReason:value.setupRejectReason??null,syntheticMapping:variant==='no-css'?value.tables[0].text:null});
 }
 assert.deepEqual(result.externalRequests,[]);
 // A fetched response remains inert, including its stylesheet; no lesson route is used.
 result.sourceResponseRelation='UNKNOWN: actual rendered DOM observed; actual collector GET response not observed';
 result.productFilesUnchanged=execFileSync('git',['diff','--name-only','HEAD','--','extensions/rakeez-teacher-import-helper','assets/extensions','src/views/class-import-center.js','src/lib/teacher-setup-import.js','src/lib/n36-extension-protocol.js','sw.js'],{encoding:'utf8'}).trim()==='';assert.equal(result.productFilesUnchanged,true);
 result.status='PASS';
}catch(e){result.status='FAIL';result.error=e.stack;process.exitCode=1;}
finally{
 await context?.close().catch(()=>{});await browser?.close().catch(()=>{});if(server.listening)await new Promise(r=>server.close(r));
 result.resources={serverClosed:!server.listening,browserClosed:!browser?.isConnected(),leaseRelease:leased?lease('release'):'not acquired'};
 await fs.writeFile(folder+'reproduction.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}
