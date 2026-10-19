// AI-authored N120: actual application reports, disposable local Demo only.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { expect } from '@playwright/test';
import { withIsolatedLocalBrowser } from '../../../../scripts/ops-supervisor-v4/isolated-local-browser.mjs';
import { openReadyServedDemo } from '../helpers/served-demo-readiness.mjs';
const base='http://127.0.0.1:5134', root=fileURLToPath(new URL('../../',import.meta.url));
const output=new URL('./',import.meta.url), evidence={baseline:{},checks:[],layouts:[]};
const server=await createServer({root,server:{host:'127.0.0.1',port:5134,strictPort:true}});
const original=new Map(['src/views/reports.js','src/views/execution-report.js','src/styles/filters.css'].map(p=>['/'+p,execFileSync('git',['show','98885befd4f13c02210661309a4add21e04c72ca:'+p])]));
try {
 await server.listen();
 await withIsolatedLocalBrowser({taskFile:'C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/continuous-n120-report-specific-filter-options-20261019.json',runId:'1a69fc7e-f539-4339-9046-7e36101784b7',url:base,timeoutMs:120000},async({createContext})=>{
  for(const baseline of [true,false]) {
   const context=await createContext({viewport:{width:1440,height:1000},locale:'ar-SA'});
   const page=await context.newPage(); page.setDefaultTimeout(10000);
   if(baseline)await page.route('**/*',route=>{const p=new URL(route.request().url()).pathname;return original.has(p)?route.fulfill({status:200,contentType:p.endsWith('.css')?'text/css':'text/javascript',body:original.get(p)}):route.fallback();});
   await page.addInitScript(()=>sessionStorage.setItem('rakeezx-demo-session-v1','preparing'));
   await openReadyServedDemo(page,base);
   await page.evaluate(async()=>{
    const s=await import('/src/store.js'),yearId=s.activeYear().id,termId=s.activeTerm().id;
    await s.save({
     sections:[{id:'rf-sec',yearId,grade:9,label:'1'}],subjects:[{id:'rf-sub',name:'مادة الفلاتر'}],teachings:[{id:'rf-t',sectionId:'rf-sec',subjectId:'rf-sub',termId}],
     students:[{id:'rf-b',name:'بدر اختبار'},{id:'rf-a',name:'أحمد اختبار'}],
     enrollments:[{id:'rf-eb',studentId:'rf-b',sectionId:'rf-sec',rollNo:1,status:'active'},{id:'rf-ea',studentId:'rf-a',sectionId:'rf-sec',rollNo:2,status:'active'}],
     items:[{id:'rf-i',teachingId:'rf-t',name:'اختبار',max:10}],scores:[{id:'rf-sa',studentId:'rf-a',itemId:'rf-i',value:2},{id:'rf-sb',studentId:'rf-b',itemId:'rf-i',value:9}],
     sessions:[{id:'rf-d1',teachingId:'rf-t',date:'2026-09-01',period:1},{id:'rf-d2',teachingId:'rf-t',date:'2026-09-02',period:1},{id:'rf-pending',teachingId:'rf-t',date:'2026-09-03',period:1},{id:'rf-future',teachingId:'rf-t',date:'2026-11-01',period:1},{id:'rf-excluded',teachingId:'rf-t',date:'2026-09-04',period:1,status:'cancelled_holiday'}]
    });
    for(const id of ['rf-d1','rf-d2'])await s.fillAttendance(id,'present');
    await s.setAttendance('rf-d1','rf-a','absent');await s.setAttendance('rf-d2','rf-b','absent');
   });
   const data=()=>page.evaluate(async()=>{const s=await import('/src/store.js');return JSON.stringify([s.state.scores,s.state.attendance,s.state.sessions,s.state.enrollments]);});
   const before=await data();
   const go=async p=>{if(page.url()===base+'/#/'+p){await page.goto(base+'/#/reports');await page.locator('.reports-index-page').waitFor();}await page.goto(base+'/#/'+p);await page.locator(p==='reports/execution'?'.execution-report-page':p.startsWith('reports/')?'.n70-report-page':'.print-report--grades').waitFor();await page.waitForTimeout(180);};
   const select=(key)=>page.locator(`[data-change="${key}"]`);
   const options=()=>select('sort').locator('option').evaluateAll(els=>els.map(e=>e.value));
   const first=()=>page.locator('.report-document tbody tr').first();
   const tab=async key=>{await page.locator(`[data-tab="${key}"]`).click();await page.locator('.print-report--'+key).waitFor();await page.waitForTimeout(100);};
   const changeDate=async(key,value)=>{await select(key).evaluate((el,v)=>{el.value=v;el.dispatchEvent(new Event('change',{bubbles:true}));},value);};
   const settle=()=>page.evaluate(async()=>{await document.fonts.ready;await new Promise(r=>setTimeout(r,120));});
   async function geometry(){await settle();return page.locator('.report-filter-bar').evaluate(bar=>{const r=bar.getBoundingClientRect();return {x:r.x,y:r.y+scrollY,width:r.width,height:r.height,pageOverflow:document.documentElement.scrollWidth>innerWidth,rtl:getComputedStyle(bar).direction,wrap:getComputedStyle(bar).flexWrap,overflow:bar.scrollWidth>bar.clientWidth,controls:[...bar.querySelectorAll('input:not([type="hidden"]):not(.flatpickr-mobile),select,button')].map(e=>{const r=e.getBoundingClientRect();return {y:r.y+scrollY,height:r.height,width:r.width};})};});}
   async function stable(name,action){const a=await geometry();await action();const b=await geometry();for(const k of ['x','y','width','height'])assert.ok(Math.abs(a[k]-b[k])<=1,name+' geometry '+k);evidence.checks.push(name);}
   async function layout(name){const g=await geometry();assert.equal(g.pageOverflow,false,name+' page overflow');assert.equal(g.rtl,'rtl');assert.equal(g.wrap,'nowrap');assert.ok(g.controls.every(c=>c.height>=44&&c.width>0));assert.ok(Math.max(...g.controls.map(c=>c.y))<Math.min(...g.controls.map(c=>c.y+c.height)),name+' one row');if(page.viewportSize().width===390){assert.equal(g.overflow,true);await page.locator('.report-filter-bar button').last().focus();const r=await page.locator('.report-filter-bar button').last().boundingBox();assert.ok(r.x>=0&&r.x+r.width<=390,'keyboard reaches overflow action');}await page.screenshot({path:fileURLToPath(new URL(name+'-'+page.viewportSize().width+'.png',output))});evidence.layouts.push({name,viewportWidth:page.viewportSize().width,...g});}
   await go('teaching/rf-t/reports');await tab('roster');
   if(baseline){evidence.baseline.rosterOptions=await options();assert.ok(evidence.baseline.rosterOptions.includes('score_desc'));await tab('attendance');await changeDate('filter-start','2026-09-02');await changeDate('filter-end','2026-09-02');await select('sort').selectOption('absent_desc');await page.waitForTimeout(180);const b=await first().innerText();assert.match(b,/أحمد/);evidence.baseline.attendanceAbsenceSortIgnoredInSelectedRange=true;await go('reports/execution');assert.equal(await page.locator('.report-filter-bar').count(),0);evidence.baseline.executionUnifiedBarAbsent=true;await context.close();continue;}
   assert.deepEqual(await options(),['default','name','roll']);
   await select('sort').selectOption('name');await expect(first()).toContainText('أحمد');await select('sort').selectOption('roll');await expect(first()).toContainText('أحمد');
   await tab('grades');assert.deepEqual(await options(),['default','name','roll','score_desc','score_asc']);await expect(select('sort')).toHaveValue('default');
   await select('sort').selectOption('score_asc');await expect(first()).toContainText('أحمد');await select('sort').selectOption('score_desc');await expect(first()).toContainText('بدر');
   await tab('support');assert.deepEqual(await options(),['default','name','roll','score_desc','score_asc','absent_desc']);await select('sort').selectOption('name');await expect(page.locator('.report-document .support-report-screen .row').first()).toContainText('أحمد');
   await tab('attendance');assert.deepEqual(await options(),['default','name','roll','absent_desc']);
   await select('sort').selectOption('name');await expect(first()).toContainText('أحمد');await select('sort').selectOption('roll');await expect(first()).toContainText('أحمد');
   await changeDate('filter-end','2026-09-01');await select('sort').selectOption('absent_desc');await expect(first()).toContainText('أحمد');
   await changeDate('filter-start','2026-09-02');await changeDate('filter-end','2026-09-02');await expect(first()).toContainText('بدر');
   await page.locator('[data-mode="detailed"]').click();await expect(first()).toContainText('بدر');
   const dl=page.waitForEvent('download');await page.locator('[data-act="csv"]').click();const download=await dl;const stream=await download.createReadStream();let csv='';for await(const part of stream)csv+=part.toString('utf8');assert.ok(csv.indexOf('بدر')<csv.indexOf('أحمد'),'CSV respects attendance ordering');
   await page.locator('[data-act="reset-filters"]').click();await expect(select('filter-start')).toHaveValue('');await expect(select('filter-end')).toHaveValue('');await expect(select('sort')).toHaveValue('default');
   evidence.checks.push('report-specific-options; roster/grade/support/attendance ordering; date-range absence ordering; detailed and CSV; scoped reset');
   for(const width of [1440,390]){
    await page.setViewportSize({width,height:1000});await go('teaching/rf-t/reports');await tab('attendance');await layout('attendance');await stable('attendance-name-'+width,()=>select('sort').selectOption('name'));await stable('attendance-mode-'+width,()=>page.locator('[data-mode="detailed"]').click());
    await go('reports/grades');await layout('aggregate-grades');assert.deepEqual(await select('n70-filter').locator('option').evaluateAll(es=>es.map(e=>e.value)),['all','recorded','missing']);await stable('aggregate-filter-'+width,()=>select('n70-filter').selectOption('missing'));
    await go('reports/followup');await layout('aggregate-followup');assert.deepEqual(await select('n70-filter').locator('option').evaluateAll(es=>es.map(e=>e.value)),['all','grades','absence','participation','missing']);await select('n70-teaching').selectOption('rf-t');await select('n70-filter').selectOption('grades');await expect(page.locator('.n70-record')).toHaveCount(1);await expect(page.locator('.n70-record')).toContainText('أحمد');await page.locator('[data-act="n70-reset"]').click();await expect(select('n70-filter')).toHaveValue('all');
    await go('reports/execution');await layout('execution');await select('teaching').selectOption('rf-t');
    for(const status of ['pending','completed','future','excluded']){await stable('execution-'+status+'-'+width,()=>select('status').selectOption(status));const rows=page.locator('.report-results .gtable--report tbody tr:not(.report-ending-row)');await expect(rows).toHaveCount(status==='completed'?2:1);}
    await page.locator('[data-act="reset-filters"]').click();await expect(select('status')).toHaveValue('all');await expect(select('teaching')).toHaveValue('all');
    await select('teaching').selectOption('rf-t');await changeDate('from','2026-09-02');await changeDate('to','2026-09-02');await expect(page.locator('.report-results .gtable--report tbody tr:not(.report-ending-row)')).toHaveCount(1);await page.locator('[data-act="reset-filters"]').click();await expect(select('from')).toHaveValue('');await expect(select('to')).toHaveValue('');
   }
   assert.equal(await data(),before,'read-only report controls preserve scores, attendance, sessions and enrollment records');await context.close();
  }
 });
 evidence.status='PASS';await writeFile(new URL('evidence.json',output),JSON.stringify(evidence,null,2)+'\n');console.log('PASS n120_report_context_options_semantics_and_stable_compact_bar');
}catch(error){evidence.error=String(error);await writeFile(new URL('last-failure.json',output),JSON.stringify(evidence,null,2)+'\n');throw error;}finally{await server.close();}
