// AI-authored: N119 actual application sorting regression with synthetic owner-bound data.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {execFileSync} from 'node:child_process';
import {withIsolatedLocalBrowser} from 'file:///C:/Users/Abody/Projects/RakeezX/scripts/ops-supervisor-v4/isolated-local-browser.mjs';
import {openReadyServedDemo} from './helpers/served-demo-readiness.mjs';
import {syntheticService,owner} from './n73-account-flow-fixture.mjs';
import {makeStudent,makeEnrollment,sortStudents} from '../src/models.js';

const taskId='continuous-n119-alphabetic-display-roll-number-20261019';
const runId=process.env.N119_RUN_ID;
assert.ok(runId,'N119_RUN_ID must identify the active attempt');
const baseSha='644e6896c24e02e00d46c558a0f87c563f644870';
const baseline=process.argv.includes('--baseline'),root=resolve('.'),service=syntheticService(),data=service.current;
const owned=row=>({...row,ownerId:owner,serverRevision:1});
// Old source numbers deliberately disagree with current alphabetic display numbers.
const fixture=[['a','أحمد',91],['b','بندر',2],['k','خالد',1],['h','حاتم',99],['z','أَحْمَد',7]];
data.students=fixture.map(([id,name])=>owned({...makeStudent({id:'n119-'+id,name}),sourceId:'external-'+id}));
data.enrollments=fixture.map(([id,,rollNo])=>owned(makeEnrollment({id:'n119-en-'+id,studentId:'n119-'+id,sectionId:'n73-source-section',rollNo,startDate:id==='h'?'2026-10-19':'2026-08-01'})));
data.items=data.items.slice(0,1);
data.scores=[owned({id:'n119-score',studentId:'n119-k',itemId:data.items[0].id,value:8})];
data.sessions=[owned({id:'n119-history-session',teachingId:'n73-source',date:'2026-10-18',period:1,status:'held'})];
data.sessionRosterSnapshots=[owned({id:'n119-history-roster',sessionId:'n119-history-session',teachingId:'n73-source',state:'complete',members:[{studentId:'n119-k',rollNo:1}]})];
const expected=sortStudents(data.students).map(row=>row.name), numbers=['1','2','3','4','5'];
assert.deepEqual(sortStudents(data.students).map(s=>s.id),['n119-a','n119-z','n119-b','n119-h','n119-k']);
assert.deepEqual(sortStudents([...data.students].reverse()).map(s=>s.id),sortStudents(data.students).map(s=>s.id));
const originals=new Map(baseline?['grades','reports'].map(view=>['/src/views/'+view+'.js',execFileSync('git',['show',baseSha+':src/views/'+view+'.js'])]):[]);
const evidence={taskId,runId,baseSha,mode:baseline?'original-source-reproduction':'candidate',checks:[],errors:[]};
const server=createServer(async(req,res)=>{
 try{
  const pathname=new URL(req.url,'http://127.0.0.1').pathname;
  if(pathname.startsWith('/__n73/')){let body='';for await(const part of req)body+=part;res.setHeader('content-type','application/json');res.end(JSON.stringify(await service.request(pathname.slice(7),JSON.parse(body||'{}'))));return;}
  const file=resolve(root,pathname==='/'?'index.html':'.'+decodeURIComponent(pathname));
  if(!file.startsWith(root+sep))throw Error('Outside task root');
  res.setHeader('content-type',{'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2','.webmanifest':'application/manifest+json'}[extname(file)]??'application/octet-stream');
  res.end(originals.get(pathname)??await readFile(file));
 }catch(e){res.writeHead(404);res.end(e.message);}
});
const snapshot=page=>page.evaluate(async()=>{const db=await import('/src/lib/db.js');return Object.fromEntries(await Promise.all(db.STORES.filter(n=>n!=='device').map(async n=>[n,await db.getAll(n)])));});
async function rows(page,rowSelector,nameSelector,numberSelector,wantNames=expected,wantNumbers=numbers){
 await page.locator(rowSelector).first().waitFor();
 assert.deepEqual(await page.locator(rowSelector).locator(nameSelector).allTextContents(),wantNames);
 assert.deepEqual(await page.locator(rowSelector).locator(numberSelector).allTextContents(),wantNumbers);
}
try{
 await new Promise((done,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',done);});
 const url='http://127.0.0.1:'+server.address().port;
 await withIsolatedLocalBrowser({taskFile:'C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/'+taskId+'.json',runId,url,timeoutMs:90000},async({createContext})=>{
  const context=await createContext({viewport:{width:1280,height:900},locale:'ar-SA'});
  await context.addInitScript(()=>sessionStorage.setItem('rakeezx-demo-session-v1','preparing'));
  const page=await context.newPage();page.setDefaultTimeout(7000);page.on('pageerror',e=>evidence.errors.push(e.message));
  await openReadyServedDemo(page,url);
  const ready=await page.evaluate(async()=>{await(await import('/tests/n36-receiver-fixture.mjs')).prepareNamesAccount();const store=await import('/src/store.js');return {workspace:store.getActiveWorkspace(),lease:store.getOfflineLeaseStatus()};});
  assert.equal(ready.workspace.authUserId,owner);assert.equal(ready.lease.editable,true);
  const before=await snapshot(page);
  await page.evaluate(()=>location.hash='#/teaching/n73-source/students');
  await rows(page,'.roster-row','.row__title','.rollno');
  await page.locator('[data-input="search"]').fill('خالد');
  await rows(page,'.roster-row','.row__title','.rollno',['خالد'],['5']);
  await page.evaluate(()=>location.hash='#/teaching/n73-source/grades');
  await rows(page,'.graderow','.graderow__name strong','.rollno');
  assert.equal(await page.locator('.graderow').first().evaluate(el=>getComputedStyle(el).display),'grid');
  await page.locator('[data-change="sort"]').selectOption('roll');
  if(baseline){
   const observed=await page.locator('.graderow .graderow__name strong').allTextContents();assert.notDeepEqual(observed,expected);
   evidence.originalRollOrder=observed;
  }else{
   await rows(page,'.graderow','.graderow__name strong','.rollno');
   await page.locator('[data-change="sort"]').selectOption('name');
   await rows(page,'.graderow','.graderow__name strong','.rollno');
   await page.locator('[data-input="search"]').fill('خالد');
   await rows(page,'.graderow','.graderow__name strong','.rollno',['خالد'],['5']);
   await page.locator('[data-change="sort"]').selectOption('roll');
   await rows(page,'.graderow','.graderow__name strong','.rollno',['خالد'],['5']);
   await page.locator('[data-input="search"]').fill('3');
   await rows(page,'.graderow','.graderow__name strong','.rollno',['بندر'],['3']);
   await page.locator('[data-input="search"]').fill('');
   await page.locator('[data-act="mode"][data-mode="table"]').click();
   await rows(page,'.gtable tbody tr','.gtable__sticky a','.gtable__roll');
  }
  await page.evaluate(()=>location.hash='#/teaching/n73-source/reports');
  await page.locator('[data-act="tab"][data-tab="roster"]').click();
  await rows(page,'.report-document .gtable--report tbody tr:not(.report-ending-row)','th','td:first-child');
  await page.locator('[data-change="sort"]').selectOption('roll');
  if(baseline){
   const observed=await page.locator('.report-document .gtable--report tbody tr:not(.report-ending-row) th').allTextContents();assert.notDeepEqual(observed,expected);
   evidence.originalReportRollOrder=observed;
  }else{
   await rows(page,'.report-document .gtable--report tbody tr:not(.report-ending-row)','th','td:first-child');
   await page.locator('[data-change="sort"]').selectOption('name');
   await rows(page,'.report-document .gtable--report tbody tr:not(.report-ending-row)','th','td:first-child');
   await page.locator('[data-act="tab"][data-tab="grades"]').click();
   await rows(page,'.report-document .gtable--report tbody tr:not(.report-ending-row)','th','td:first-child');
  }
  assert.deepEqual(await snapshot(page),before);
  assert.equal(service.evidence.commits,0);assert.deepEqual(evidence.errors,[]);
  evidence.checks.push({name:baseline?'original_roll_sort_mismatch_reproduced':'n119_alphabetic_display_roll_matches_old_new_students_stable_identity',status:'PASS',evidence:baseline?'Original real grades/reports sort handlers reorder displayed 1..5 by saved source numbers.':'Actual HTTP app roster, grade item/table and report DOM: mixed old/new active students, tied Arabic names, default/name/roll sorts agree on display 1..5; name/number filters retain full-roster rank. All persisted non-device stores (including owner, source IDs, enrollment IDs/numbers, history, grades and outbox) unchanged; zero synthetic service commits or page errors. Fresh isolated context and source CSS; owned browser and server closed in finally.'});
 });
}catch(error){evidence.failure={message:error.message,stack:error.stack};process.exitCode=1;}
finally{await new Promise(resolve=>server.close(resolve));await writeFile('tests/n119-1019-'+(baseline?'baseline':'browser')+'.json',JSON.stringify(evidence,null,2)+'\n');}
console.log(JSON.stringify(evidence,null,2));
