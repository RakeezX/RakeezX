import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {withIsolatedLocalBrowser} from '../../../scripts/ops-supervisor-v4/isolated-local-browser.mjs';
import {openReadyServedDemo} from './helpers/served-demo-readiness.mjs';
import {seed} from './n24-fixture.mjs';

const onlyMobile=process.argv[2]==='mobile';
const onlyScopes=process.argv[2]==='scopes';
const onlyWide=process.argv[2]==='wide';
const onlySurface=['grades','detailed','roster'].includes(process.argv[2])?process.argv[2]:null;
const phase=onlyMobile||onlyScopes||onlyWide||onlySurface?'after':process.argv[2] ?? 'after', root=resolve('.'), output=`test-results/n24/${phase}`;
const taskFile='C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/continuous-n24-report-design-after-current-20261013.json';
const runId='60661dff-1000-48b4-b4f1-7b9248d33ba6';
const server=createServer(async(req,res)=>{
  try {
    const pathname=new URL(req.url,'http://127.0.0.1').pathname;
    const file=resolve(root,pathname==='/'?'index.html':'.'+decodeURIComponent(pathname));
    if(!file.startsWith(root+sep))throw Error('Outside application root');
    res.setHeader('Content-Type',{'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2'}[extname(file)]??'application/octet-stream');
    res.end(await readFile(file));
  }catch{res.writeHead(404);res.end();}
});
const surfaces=[
  {name:'grades',tab:'grades'}, {name:'roster',tab:'roster'},
  {name:'attendance',tab:'attendance'}, {name:'detailed',tab:'attendance',detailed:true},
  {name:'support',tab:'support'}, {name:'execution',route:'/reports/execution'},
  {name:'cross-grades',route:'/reports/grades'}, {name:'cross-followup',route:'/reports/followup'},
];
async function readySurface(page,surface) {
  await page.locator(surface.tab?'.report-tabs':surface.name==='execution'?'.execution-report-page':`[data-report-kind="${surface.name==='cross-followup'?'followup':'grades'}"]`).waitFor({state:'visible'});
}
await mkdir(output,{recursive:true});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const url='http://127.0.0.1:'+server.address().port;
const results=onlySurface?JSON.parse(await readFile(output+'/data.json','utf8')):{};
try {
 await withIsolatedLocalBrowser({taskFile,runId,url,timeoutMs:120000},async({createContext})=>{
  const ctx=await createContext({viewport:{width:1280,height:900},locale:'ar-SA',timezoneId:'Asia/Riyadh'});
  await ctx.addInitScript(()=>{if(!sessionStorage.getItem('rakeezx-demo-session-v1'))sessionStorage.setItem('rakeezx-demo-session-v1','preparing');});
  const page=await ctx.newPage();
  await openReadyServedDemo(page,url);
  for(const size of onlyMobile||onlyScopes||onlyWide?[]:['small','multi']) {
   await seed(page,{count:size==='small'?8:85,long:true,sessions:16,distinct:true});
   for(const surface of onlySurface?surfaces.filter(s=>s.name===onlySurface):surfaces) {
    const name=size+'-'+surface.name;
    await page.goto(url+'/#'+(surface.route??'/teaching/print-teaching/reports'));
    await readySurface(page,surface);
    if(surface.tab)await page.locator(`[data-act="tab"][data-tab="${surface.tab}"]`).click();
    if(surface.detailed)await page.locator('[data-act="att-mode"][data-mode="detailed"]').click();
    await page.evaluate(()=>document.fonts.ready);
    const data=await page.evaluate(async()=>{
      const store=await import('/src/store.js');
      const {studentTotal}=await import('/src/models.js');
      const {roster,items,ctx}=store.teachingContext('print-teaching');
      return {
        ids:roster.map(s=>s.id), totals:roster.map(s=>studentTotal(items,ctx[s.id])),
        rows:[...document.querySelectorAll('.report-document tbody tr:not(.report-ending-row),.report-results tbody tr:not(.report-ending-row)')].map(tr=>tr.textContent.trim().replace(/\s+/g,' ')),
        links:[...document.querySelectorAll('.report-document a,.report-results a')].map(a=>a.getAttribute('href')),
        attendance:store.state.attendance.filter(a=>a.teachingId==='print-teaching'),
      };
    });
    const csvButton=page.locator('[data-act="csv"],[data-act="n70-csv"]').last();
    const downloadPromise=page.waitForEvent('download');await csvButton.click();
    const download=await downloadPromise;const stream=await download.createReadStream();let csv='';for await(const chunk of stream)csv+=chunk;
    results[name]={...data,csv};
    if(phase==='after')assert.deepEqual(results[name],JSON.parse(await readFile('test-results/n24/before/data.json','utf8'))[name],name+' data/CSV changed');
    if(size==='small')await page.screenshot({path:output+'/'+name+'-screen.png',fullPage:true});
    // Exercise the real print handler and its confirmation; PDF uses this same document.
    await page.evaluate(()=>{window.__n24Print=0;window.print=()=>{window.__n24Print++;};});
    await page.locator('[data-act="print"],[data-act="n70-print"]').last().click();
    if(await page.locator('#pre-print-form').count())await page.locator('button[form="pre-print-form"]').click();
    await page.waitForFunction(()=>window.__n24Print===1);
    await page.emulateMedia({media:'print'});
    assert.equal(await page.locator('.printhead').isVisible(),true);
    assert.equal(await page.locator('.report-workspace__head').isVisible(),false);
    assert.equal(await page.locator('.report-filters:visible,.report-toolbar:visible,.report-actions:visible').count(),0);
    assert.equal(await page.locator('.print-report button:visible,.print-report input:visible,.print-report select:visible,.n34-help-launcher:visible,.app-status-strip:visible').count(),0);
    if(phase==='after') {
      assert.equal(await page.locator('.printhead__date').count(),0);
      assert.equal(await page.locator('.print-report__footer').count(),1);
      assert.equal(await page.locator('.printhead').evaluate(el=>el.scrollWidth>el.clientWidth+1),false);
    }
    await page.pdf({path:output+'/'+name+'.pdf',preferCSSPageSize:true,printBackground:false});
    await page.emulateMedia({media:'screen'});
    console.log('PASS '+phase+' '+name);
   }
  }
  if(!onlyMobile&&!onlyScopes&&!onlyWide)await writeFile(output+'/data.json',JSON.stringify(results,null,2));
  if(onlyWide) {
    await seed(page,{count:8,long:true,sessions:1,distinct:true});
    await page.evaluate(async()=>{
      const store=await import('/src/store.js');
      await store.save({items:Array.from({length:10},(_,i)=>({id:'wide-item-'+i,teachingId:'print-teaching',name:'المهارات التطبيقية والتقويم المستمر '+(i+1),max:10}))});
    });
    await page.goto(url+'/#/teaching/print-teaching/reports');await readySurface(page,{tab:'grades'});
    assert.equal(await page.locator('.report-document .grades-report-screen thead th').count(),16);
    const expected=await page.evaluate(async()=>{
      const store=await import('/src/store.js');const {studentTotal}=await import('/src/models.js');
      const {roster,items,ctx}=store.teachingContext('print-teaching');
      return {names:items.map(i=>i.name),totals:roster.map(s=>studentTotal(items,ctx[s.id]).earned)};
    });
    await page.evaluate(()=>{window.__n24Print=0;window.print=()=>window.__n24Print++;});
    await page.locator('[data-act="print"]').last().click();await page.locator('button[form="pre-print-form"]').click();
    await page.waitForFunction(()=>window.__n24Print===1);
    await page.emulateMedia({media:'print'});
    assert.equal(await page.locator('.grades-report-screen').isVisible(),false);
    assert.equal(await page.locator('.grades-report-print').isVisible(),true);
    const headers=await page.locator('.grades-report-print thead').evaluateAll(heads=>heads.map(head=>[...head.querySelectorAll('th')].slice(2,-2).map(th=>th.childNodes[0].textContent)));
    assert.deepEqual(headers.flat(),expected.names);
    for(const table of await page.locator('.grades-report-print table').all()) {
      const totals=await table.locator('tbody tr:not(.report-ending-row)').evaluateAll(rows=>rows.map(tr=>Number(tr.children[tr.children.length-2].textContent)));
      assert.deepEqual(totals,expected.totals);
    }
    assert.equal(await page.locator('.grades-report-print .gtable').evaluateAll(tables=>tables.some(el=>el.getBoundingClientRect().width>document.querySelector('.report-document').getBoundingClientRect().width+1)),false);
    await page.pdf({path:output+'/wide-grades.pdf',preferCSSPageSize:true,printBackground:false});
    await page.emulateMedia({media:'screen'});
    for(const width of [320,390]) {
      await page.setViewportSize({width,height:844});
      assert.equal(await page.locator('.grades-report-print').isVisible(),false);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
      await page.locator('[data-act="print"]').last().click({trial:true});
      await page.screenshot({path:output+'/'+width+'-wide-grades.png'});
    }
    await writeFile(output+'/wide-grades.json',JSON.stringify({headers,totals:expected.totals,screenColumns:16},null,2));
    console.log('PASS all 16 screen columns retained in 3 readable print groups; complete totals unchanged');
  }
  if(onlyScopes) {
    await seed(page,{count:8,long:true,sessions:16,distinct:true});
    await page.goto(url+'/#/teaching/print-teaching/reports');await readySurface(page,{tab:'grades'});
    await page.locator('[data-change="sort"]').selectOption('roll');
    const links=await page.locator('.report-document tbody a').evaluateAll(els=>els.map(el=>el.getAttribute('href')));
    assert.deepEqual(links,Array.from({length:8},(_,i)=>`#/student/print-student-${i}`));
    assert.equal(await page.locator('.report-document input,.report-document button').count(),0);
    await page.locator('[data-act="tab"][data-tab="attendance"]').click();
    for(const [field,date] of [['filter-start','2026-08-03'],['filter-end','2026-08-05']]) {
      const input=page.locator(`[data-change="${field}"]`);
      assert.equal(await input.evaluate(el=>!!el._flatpickr && el.dataset.rakeezDateScope==='historical'),true);
      await input.fill(date);await input.dispatchEvent('change');
    }
    await page.locator('[data-act="att-mode"][data-mode="detailed"]').click();
    await page.waitForFunction(()=>document.querySelector('.report-document .gtable thead tr')?.children.length===8);
    assert.equal(await page.locator('.report-document .gtable tbody tr:not(.report-ending-row)').count(),8);
    const selected=await page.evaluate(async()=>{
      const store=await import('/src/store.js');const {attendanceSessionsInRange}=await import('/src/views/reports.js');
      return attendanceSessionsInRange(store.attendanceReportContext('print-teaching'),'2026-08-03','2026-08-05').map(s=>s.id);
    });
    assert.deepEqual(selected,['print-session-2','print-session-3','print-session-4']);
    await page.goto(url+'/#/reports/grades');await readySurface(page,{name:'cross-grades'});
    await page.locator('[data-input="n70-search"]').fill('أحمد');
    await page.waitForFunction(()=>document.querySelectorAll('.n70-record').length===1);
    assert.ok((await page.locator('.n70-person').textContent()).includes('أحمد'));
    await page.locator('[data-act="n70-reset"]').click();
    await page.waitForFunction(()=>document.querySelectorAll('.n70-record').length===8);
    await writeFile(output+'/scopes.json',JSON.stringify({rollOrder:links,selectedSessions:selected,crossSearchAndReset:true,approvedDateAdapter:true},null,2));
    console.log('PASS actual sort, date range, cross-class search/reset and read-only grade DOM');
  }
  if(phase==='after'&&!onlySurface&&!onlyScopes&&!onlyWide) {
   if(onlyMobile)await seed(page,{count:85,long:true,sessions:16,distinct:true});
   for(const width of [320,390]) {
    await page.setViewportSize({width,height:844});
    for(const surface of surfaces) {
     await page.goto(url+'/#'+(surface.route??'/teaching/print-teaching/reports'));
     await readySurface(page,surface);
     if(surface.tab)await page.locator(`[data-act="tab"][data-tab="${surface.tab}"]`).click();
     if(surface.detailed)await page.locator('[data-act="att-mode"][data-mode="detailed"]').click();
     assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,width+' '+surface.name+' overflow');
     await page.evaluate(()=>scrollTo(0,0));
     await page.screenshot({path:output+'/'+width+'-'+surface.name+'-controls.png',fullPage:false});
     // Trial click uses Playwright's detached-element retry and checks actual
     // reachability after the responsive app's scheduled repaint.
     await page.locator('[data-act="print"],[data-act="n70-print"]').last().click({trial:true});
     assert.equal(await page.locator('[data-act="print"],[data-act="n70-print"]').last().isVisible(),true);
     await page.screenshot({path:output+'/'+width+'-'+surface.name+'.png',fullPage:false});
     console.log('PASS mobile '+width+' '+surface.name);
    }
   }
   await page.setViewportSize({width:1280,height:900});
   await seed(page,{count:8,long:true,sessions:16,distinct:true});
   for(const tab of ['grades','attendance','support']) {
     await page.goto(url+'/#/teaching/print-teaching/reports');
     await readySurface(page,{tab});
     await page.locator(`[data-act="tab"][data-tab="${tab}"]`).click();
     if(!await page.locator('.a4-sheet').count())await page.locator('[data-act="toggle-a4"]').click();
     await page.locator('.a4-sheet').screenshot({path:output+'/a4-'+tab+'.png'});
     await page.locator('[data-act="toggle-a4"]').click();
   }
  }
 });
}finally{await new Promise(done=>server.close(done));}
console.log('Owned browser contexts and server closed.');
