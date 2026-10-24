import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {withIsolatedLocalBrowser} from '../../../scripts/ops-supervisor-v4/isolated-local-browser.mjs';
import {openReadyServedDemo} from './helpers/served-demo-readiness.mjs';
import {seed} from './n24-fixture.mjs';
const phase=process.argv[2]??'after', engine=process.argv[3]??'chromium';
const mobileOnly=process.argv[4]==='mobile';
const surfaceFilter=process.argv[5]?.split(',');
const root=resolve('.'), output=`test-results/n24-clean/${phase}-${engine}`;
const taskFile='C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/continuous-n24-clean-print-filename-20261014.json';
const runId='138e1001-c8a6-4c59-af07-b05af5d0bfb6';
const server=createServer(async(req,res)=>{try {
  const file=resolve(root,new URL(req.url,'http://127.0.0.1').pathname==='/'?'index.html':'.'+decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname));
  if(!file.startsWith(root+sep))throw Error('Outside root');
  res.setHeader('Content-Type',{'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2'}[extname(file)]??'application/octet-stream');
  res.end(await readFile(file));
}catch{res.writeHead(404);res.end();}});
await mkdir(output,{recursive:true});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const url='http://127.0.0.1:'+server.address().port;
const results={};
try {await withIsolatedLocalBrowser({taskFile,runId,url,engine,timeoutMs:120000},async({createContext})=>{
  const ctx=await createContext({viewport:{width:1280,height:900},locale:'ar-SA',timezoneId:'Asia/Riyadh'});
  console.log(engine+' '+ctx.browser().version());
  await ctx.addInitScript(()=>sessionStorage.setItem('rakeezx-demo-session-v1','preparing'));
  const page=await ctx.newPage();await openReadyServedDemo(page,url);
  if(phase==='after')await page.evaluate(async()=>{
    const {printReport,reportFilename}=await import('/src/lib/report-print.js');
    const original=document.title, route=location.href;
    const safe=reportFilename('تقرير <>:"/\\|?* .','2026-10-14');
    if(/[<>:"/\\|?*]/.test(safe))throw Error('Reserved filename chars');
    window.print=()=>{throw Error('Synthetic dialog error');};
    if(await printReport('تقرير اختبار')!==false)throw Error('Failed dialog did not return false');
    if(document.title!==original)throw Error('Exception did not restore title');
    window.print=()=>{};if(await printReport('تقرير إلغاء')!==true)throw Error('Prepared dialog did not print');
    if(document.title===original)throw Error('Async dialog title restored too early');
    window.dispatchEvent(new Event('afterprint'));
    if(document.title!==original)throw Error('Cancel did not restore title');
    if(await printReport('تقرير تعديل')!==true)throw Error('Prepared dialog did not print');document.title='عنوان مسار جديد';window.dispatchEvent(new Event('afterprint'));
    if(document.title!=='عنوان مسار جديد' || location.href!==route)throw Error('Route title clobbered');document.title=original;
  });
  await seed(page,{count:220,long:true,sessions:16,distinct:true});
  await page.evaluate(async()=>{const s=await import('/src/store.js');await s.patchProfile({schoolName:'مدرسة المعرفة والعلوم المتقدمة للتعليم العام في المنطقة الشرقية والرياض'});});
  for(const surface of [{name:'grades',tab:'grades'},{name:'roster',tab:'roster'},{name:'execution',route:'/reports/execution'},{name:'cross-grades',route:'/reports/grades'},{name:'cross-followup',route:'/reports/followup'}].filter(s=>!surfaceFilter || surfaceFilter.includes(s.name))) {
    await page.goto(url+'/#'+(surface.route??'/teaching/print-teaching/reports'));
    await page.locator(surface.tab?'.report-tabs':surface.name==='execution'?'.execution-report-page':`[data-report-kind="${surface.name==='cross-followup'?'followup':'grades'}"]`).waitFor();
    if(surface.tab)await page.locator(`[data-act="tab"][data-tab="${surface.tab}"]`).click();
    await page.evaluate(()=>document.fonts.ready);
    const snapshot=await page.evaluate(async()=>{const s=await import('/src/store.js');const {studentTotal}=await import('/src/models.js');const {roster,items,ctx}=s.teachingContext('print-teaching');return {ids:roster.map(x=>x.id),totals:roster.map(x=>studentTotal(items,ctx[x.id])),rows:[...document.querySelectorAll('.report-document tbody tr:not(.report-ending-row),.report-results tbody tr:not(.report-ending-row)')].map(x=>x.textContent.trim().replace(/\s+/g,' '))};});
    const dp=page.waitForEvent('download');await page.locator('[data-act="csv"],[data-act="n70-csv"]').last().click();const stream=await (await dp).createReadStream();let csv='';for await(const chunk of stream)csv+=chunk;
    results[surface.name]={...snapshot,csv};
    if(phase==='after')assert.deepEqual(results[surface.name],JSON.parse(await readFile('test-results/n24-clean/before-chromium/data.json','utf8'))[surface.name]);
    for(const width of [320,390]) {
      await page.setViewportSize({width,height:844});
      if(phase==='after')assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
      if(surface.tab)await page.locator('[data-act="toggle-a4"]').click();
      if(phase==='after') {
        assert.equal(await page.locator('.printhead:visible').evaluateAll(els=>els.some(el=>el.scrollWidth>el.clientWidth+1)),false);
        const links=await page.locator('.printhead__brand a,.print-report__footer a').evaluateAll(a=>a.map(x=>x.getAttribute('href')));
        assert.ok(links.length>=2 && links.every(x=>x==='https://rakeezx.com/'));
      }
      await page.screenshot({path:output+`/${surface.name}-${width}.png`});
      if(await page.locator('.printhead:visible').count()) {
        await page.waitForFunction(()=>!document.querySelector('#toast')?.classList.contains('is-on'));
        await page.locator('.printhead:visible').first().evaluate(el=>el.scrollIntoView({block:'center'}));
        await page.locator('.printhead:visible').first().screenshot({path:output+`/${surface.name}-${width}-metadata.png`});
      }
      if(surface.tab)await page.locator('[data-act="toggle-a4"]').click();
      if(mobileOnly) {
        await page.emulateMedia({media:'print'});
        assert.equal(await page.locator('.printhead:visible').first().evaluate(el=>el.scrollWidth>el.clientWidth+1),false);
        await page.locator('.printhead:visible').first().screenshot({path:output+`/${surface.name}-${width}-print-metadata.png`});
        await page.emulateMedia({media:'screen'});
      }
    }
    if(mobileOnly){console.log('PASS screen/print metadata '+surface.name+' 320/390');continue;}
    await page.setViewportSize({width:1280,height:900});
    const original=await page.title(), route=page.url();
    await page.evaluate(()=>{window.__print=[];window.print=()=>{window.__print.push(document.title);window.dispatchEvent(new Event('afterprint'));};});
    await page.locator('[data-act="print"],[data-act="n70-print"]').last().click();
    if(await page.locator('#pre-print-form').count())await page.locator('button[form="pre-print-form"]').click();
    await page.waitForFunction(()=>window.__print.length===1);
    if(phase==='after') {
      const title=await page.evaluate(()=>window.__print[0]);assert.match(title,/ - ركيز المعلم - \d{4}-\d{2}-\d{2}$/);assert.equal(await page.title(),original);assert.equal(page.url(),route);
      results[surface.name].filename=title;
    }
    await page.emulateMedia({media:'print'});
    if(engine==='chromium') {
      await page.evaluate(()=>document.title='N24_TITLE_SENTINEL');
      await writeFile(output+'/'+surface.name+'-styles.json',JSON.stringify(await page.evaluate(()=>({rules:[...document.styleSheets].flatMap(s=>{try{return [...s.cssRules].map(r=>r.cssText).filter(r=>r.includes('@page'));}catch{return [];}}),padding:getComputedStyle(document.querySelector('.print-report')).padding,clone:getComputedStyle(document.querySelector('.print-report')).boxDecorationBreak})),null,2));
      await page.pdf({path:output+'/'+surface.name+'.pdf',preferCSSPageSize:true,displayHeaderFooter:true,
        headerTemplate:'<div style="font-size:8px;width:100%;margin:0 24px;display:flex;justify-content:space-between"><span>N24_DATE_SENTINEL <span class="date"></span></span><span class="title"></span></div>',
        footerTemplate:'<div style="font-size:8px;width:100%;margin:0 24px;display:flex;justify-content:space-between"><span>N24_URL_SENTINEL <span class="url"></span></span><span><span class="pageNumber"></span>/<span class="totalPages"></span></span></div>'});
      await page.evaluate(t=>document.title=t,original);
    }
    await page.emulateMedia({media:'screen'});console.log('PASS '+phase+' '+engine+' '+surface.name);
  }
  if(!mobileOnly)await writeFile(output+'/data.json',JSON.stringify(results,null,2));
});}finally{await new Promise(done=>server.close(done));console.log('Owned server/browser closed');}
