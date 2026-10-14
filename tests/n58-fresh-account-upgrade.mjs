// AI: actual installed HTTP app/store upgrade, native persisted synthetic accounts.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createServer} from 'vite';
import {withIsolatedLocalBrowser} from '../../../scripts/ops-supervisor-v4/isolated-local-browser.mjs';
import {openReadyServedDemo} from './helpers/served-demo-readiness.mjs';
const taskFile='C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/continuous-n58-fresh-account-calendar-foundation-20261014.json';
const runId='ef502f1b-29ef-496e-8611-21d74fda045e';
const base='a256a1cce6f0368a1a4dbe3dc24ead677cfaf0d5',saved='9603682900001d29ad8ccdb95d7ce26c5357a2f9';
const historical=JSON.parse(await fs.readFile('tests/n58-fresh-account-baseline.json','utf8')).checks[0].snapshot.local;
const old=execFileSync('git',['show',base+':src/store.js'],{encoding:'utf8'}),prior=execFileSync('git',['show',saved+':src/store.js'],{encoding:'utf8'});
const url='http://127.0.0.1:4199';let phase='baseline';
const server=await createServer({configFile:false,root:process.cwd(),logLevel:'error',define:{'import.meta.env.DEV':'false','import.meta.env.PROD':'true'},
 plugins:[{name:'n58-owned-synthetic-source-upgrade',enforce:'pre',transform(code,id){
  const file=id.split('?')[0];
  if(file.endsWith('/src/store.js'))return phase==='baseline'?old:phase==='saved'?prior:code;
  if(file.endsWith('/src/lib/cloud.js'))return code.replace("'https://xlrubcwjqktzzunrvuns.supabase.co'",JSON.stringify(url));
 }}],server:{host:'127.0.0.1',port:4199,strictPort:true}});
const result={runId,base,saved,cases:[],scope:'LOCAL synthetic read-only upgrade; no hosted/service acceptance'};
const snapshot=async page=>{
 let checkpoint;for(let attempt=0;attempt<100;attempt++){
 checkpoint=await page.evaluate(async()=>{
 const s=await import('/src/store.js'),d=await import('/src/lib/db.js'),c=await import('/src/lib/cloud.js'),w=s.getActiveWorkspace(),database=d.getActiveDatabaseName();
 if(document.readyState!=='complete'||!s.state.ready||c.user?.id!==w?.authUserId||w?.databaseName!==database)return {pending:true,observed:{user:c.user?.id,workspace:w,database}};
 const stores=['years','terms','calendars','calendarDays','sessions','outbox','subjects','sections','teachings','students','enrollments','items','scores','device','profile'];
 const data=Object.fromEntries(await Promise.all(stores.map(async n=>[n,await d.getAll(n)])));
 if(s.getActiveWorkspace()!==w||d.getActiveDatabaseName()!==database)throw Error('Checkpoint changed');
 return {owner:w.authUserId,database,receipt:await d.readInitialRestoreReceipt(),data};
});
 if(!checkpoint.pending)return checkpoint;await page.waitForTimeout(100);
 }throw Error('Current document checkpoint unavailable: '+JSON.stringify(checkpoint));
};
try{
 await server.listen();
 await withIsolatedLocalBrowser({taskFile,runId,url,timeoutMs:120000},async({createContext})=>{
  for(const kind of ['populated','populated-legacy-overlap','rejected-missing-term']){
   phase='baseline';server.moduleGraph.invalidateAll();
   const context=await createContext({locale:'ar-SA',viewport:{width:390,height:844}}),page=await context.newPage();
   let documentPhase='baseline';const errors=[];
   page.on('framenavigated',frame=>{if(frame===page.mainFrame())documentPhase=phase;});
   page.on('pageerror',e=>errors.push({documentPhase,message:e.message}));
   // A genuine limited/offline read surface, not a guard bypass. HTTP app is
   // served locally; no transport/Sync or renewal is allowed to certify writes.
   await page.addInitScript(()=>Object.defineProperty(navigator,'onLine',{get:()=>false}));
   await page.addInitScript(()=>{if(!localStorage.getItem('rakeezx-auth-v2-xl-rubcwjqktzzunrvuns'))sessionStorage.setItem('rakeezx-demo-session-v1','preparing');});
   await openReadyServedDemo(page,url);
   const seeded=await page.evaluate(async({kind,historical})=>{
    const s=await import('/src/store.js'),d=await import('/src/lib/db.js'),c=await import('/src/lib/cloud.js'),m=await import('/src/models.js'),w=await import('/src/lib/workspaces.js'),p=await import('/src/lib/calendar-presets.js');
    s.deactivateWorkspace('owned-upgrade-fixture');sessionStorage.removeItem('rakeezx-demo-session-v1');
    const owner='a5800000-0000-4000-8000-'+(kind==='populated'?'000000000011':kind==='populated-legacy-overlap'?'000000000012':'000000000013');
    const receipt={ownerId:owner,protocol:'CORE_V2',restoreId:'n58-upgrade-'+kind,manifestHash:'synthetic-'+kind,completedAt:1};
    const registry=w.createWorkspaceRegistry();
    const pending=await registry.beginAccountRestore(owner,receipt);await registry.finalizeAccountRestore(owner,receipt);
    const resolved=await w.resolveWorkspace({type:'account',authUserId:owner},{registry});await registry.close();
    const session={access_token:'synthetic-local-only',user:{id:owner,email:'upgrade@example.invalid'},expires_at:4102444800};
    localStorage.setItem(c.AUTH_STORAGE_KEY,JSON.stringify(session));c.setMockAuth(session.user,session);
    const records=p.calendarPresetRecords(p.getCalendarPreset());
    const terms=kind==='rejected-missing-term'?records.terms.slice(0,1):records.terms;
    if(kind==='populated-legacy-overlap')terms.push(m.makeTerm({id:'legacy:extra',yearId:records.year.id,index:3,startDate:'2026-10-01',endDate:'2026-12-01',status:'closed'}));
    const rejected=historical.outbox.find(x=>x.store==='years'&&x.op==='create'&&x.state==='rejected');
    const dependent=historical.outbox.filter(x=>x.store!=='years'&&['blocked','rejected'].includes(x.state)).slice(0,64);
    const outbox=kind==='rejected-missing-term'?[rejected,...dependent].map(x=>({...x,ownerId:owner,workspaceOwnerId:owner})):[];
    const teaching={...m.makeTeaching({id:'upgrade:teaching',sectionId:'upgrade:section',subjectId:'sub:digital-skills',termId:terms[0].id}),serverRevision:1};
    const context={yearId:records.year.id,termId:terms[0].id,presetId:'sa-general-1448-1449',selectionRevision:7,kind:'remote',source:'custom',label:'Recorded earlier'};
    const rows={years:[records.year],terms,calendars:[records.calendar],calendarDays:records.calendarDays,outbox,
     sessions:kind==='rejected-missing-term'?[]:[m.makeSession({id:'upgrade:recorded',teachingId:teaching.id,date:'2026-09-23',period:1,status:'held',calendarContext:context}),m.makeSession({id:'upgrade:unknown',teachingId:teaching.id,date:'2026-09-23',period:2,status:'held'})],
     subjects:[m.makeSubject()],sections:kind==='rejected-missing-term'?[]:[m.makeSection({id:'upgrade:section',yearId:records.year.id,grade:4,label:'أ'})],teachings:kind==='rejected-missing-term'?[]:[teaching],
     students:kind==='rejected-missing-term'?[]:[{id:'upgrade:student',name:'طالب محلي',status:'active'}],enrollments:kind==='rejected-missing-term'?[]:[m.makeEnrollment({id:'upgrade:enrollment',studentId:'upgrade:student',sectionId:'upgrade:section',rollNo:9})],
     items:kind==='rejected-missing-term'?[]:[m.makeItem({id:'upgrade:item',teachingId:teaching.id,name:'اختبار',max:10})],scores:kind==='rejected-missing-term'?[]:[{id:'upgrade:score',studentId:'upgrade:student',itemId:'upgrade:item',value:8}],
     profile:[{...m.makeProfile({teacherName:'معلم الترقية',phone:'0500000001'}),serverRevision:1}],
     device:[m.makeDevice({deviceId:'upgrade-device',activeYearId:records.year.id,activeTermId:terms[0].id,schemaVersion:8,initialRestoreReceipt:receipt})]};
    s.activateWorkspace(resolved.workspace);
    // One initial native fixture import into this context's new owned database.
    // From this checkpoint onwards: no clear, repair, replay or replacement.
    const {device,...initial}=rows;
    await d.importInitialRestoreSnapshot(initial,device[0],{assertAccess(){if(c.user?.id!==owner)throw Error('Fixture owner changed');}});
    await s.init();return {owner,database:pending.databaseName};
   },{kind,historical});
   await page.reload({waitUntil:'domcontentloaded'});
   await page.waitForFunction(async owner=>{const s=await import('/src/store.js');return s.state.ready&&s.getActiveWorkspace()?.authUserId===owner;},seeded.owner);
   const before=await snapshot(page);assert.equal(before.receipt.ownerId,seeded.owner);
   await page.goto(url+'/#/calendar');await page.getByRole('button',{name:'إعدادات التقويم والمنطقة',exact:true}).waitFor();
   phase='saved';server.moduleGraph.invalidateAll();
   await page.reload({waitUntil:'domcontentloaded'});
   await page.waitForFunction(async owner=>{const s=await import('/src/store.js');return s.state.ready&&s.getActiveWorkspace()?.authUserId===owner&&s.state.years.length>0;},seeded.owner);
   assert.deepEqual(await snapshot(page),before);
   const savedError=await page.evaluate(async()=>{const s=await import('/src/store.js');try{s.termsOf(s.state.years[0]?.id);return null;}catch(e){return e.message;}});
   if(kind!=='populated')assert.match(savedError,/Calendar resolution failed/);
   phase='corrected';server.moduleGraph.invalidateAll();
   await page.reload({waitUntil:'domcontentloaded'});
   await page.getByRole('button',{name:'إعدادات التقويم والمنطقة',exact:true}).waitFor({timeout:15000});
   assert.deepEqual(await snapshot(page),before);
   if(kind!=='populated')assert.ok((await page.locator('.calendar-year').innerText()).includes('بيانات التقويم غير مكتملة'));
   await page.getByRole('button',{name:'إعدادات التقويم والمنطقة',exact:true}).click();
   assert.equal(await page.locator('[data-act="set-region"]').evaluateAll(nodes=>nodes.every(n=>n.disabled&&n.getAttribute('aria-disabled')==='true'&&getComputedStyle(n).cursor==='not-allowed'&&Number(getComputedStyle(n).opacity)<1)),true);
   assert.equal(await page.locator('link[href*="calendar-work-0417.css"]').evaluateAll(nodes=>nodes.length===1&&!!nodes[0].sheet),true);
   await page.getByRole('dialog').getByRole('button',{name:'تم',exact:true}).click();
   await page.locator('.teacher-mini-hub-trigger, .topbar__teacher-btn').filter({visible:true}).first().click();
   await page.locator('.mini-hub-sheet').waitFor();
   const reading=await page.evaluate(async()=>{const s=await import('/src/store.js');return {status:s.calendarReadStatus(s.state.years[0].id),ranges:s.calendarRangesOf().length,terms:s.termsOf(s.state.years[0].id).map(x=>x.id),eligible:s.isSessionEligibleDate('2026-10-14'),presentation:s.state.sessions.map(x=>s.sessionStatusPresentation(x))};});
   if(kind!=='populated'){assert.equal(reading.status.ok,false);assert.equal(reading.eligible,false);}
   if(kind==='rejected-missing-term'){assert.equal(reading.terms.length,1);assert.equal(before.data.outbox.length,65);}
   assert.ok(reading.ranges>0);assert.deepEqual(await snapshot(page),before);assert.deepEqual(errors.filter(e=>e.documentPhase==='corrected'),[]);
   const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
   result.cases.push({kind,savedError,originalPageErrors:errors.filter(e=>e.documentPhase==='saved'),reading,checkpointUnchanged:true,beforeSha256:digest(before),afterSha256:digest(await snapshot(page)),actualHoldCSS:true,owner:before.owner,database:before.database,retainedOutbox:before.data.outbox.length});
   await context.close();
  }
 });
 result.status='PASS';
}catch(error){result.status='FAIL';result.error=error.message;process.exitCode=1;}
finally{await server.close();await fs.writeFile('tests/n58-fresh-account-upgrade.json',JSON.stringify(result,null,2)+'\n');}
console.log(JSON.stringify(result));
