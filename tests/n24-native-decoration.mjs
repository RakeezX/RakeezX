/** Real app print proof using Chromium's DEFAULT template class conventions.
 * .text is essential: Chromium's own setupHeaderFooterTemplate uses it to
 * suppress decorations intersecting the CSS page area. No report is authored here.
 * https://raw.githubusercontent.com/chromium/chromium/main/components/printing/resources/print_header_footer_template_page.html
 */
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {withIsolatedLocalBrowser} from '../../../scripts/ops-supervisor-v4/isolated-local-browser.mjs';
import {openReadyServedDemo} from './helpers/served-demo-readiness.mjs';
import {seed} from './n24-fixture.mjs';
const phase=process.argv[2],runId=process.argv[3];
assert.ok(['control','candidate','metadata'].includes(phase)&&runId,'Explicit phase/run identity required');
const root=resolve('.'),output=`test-results/n24-native/${phase}`;
const taskFile='C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/continuous-n24-clean-print-filename-20261014.json';
const server=createServer(async(req,res)=>{try{
 const pathname=new URL(req.url,'http://127.0.0.1').pathname;
 const file=resolve(root,pathname==='/'?'index.html':'.'+decodeURIComponent(pathname));
 if(!file.startsWith(root+sep))throw Error('Outside root');
 res.setHeader('Content-Type',{'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2'}[extname(file)]??'application/octet-stream');
 res.end(await readFile(file));
}catch{res.writeHead(404);res.end();}});
await mkdir(output,{recursive:true});await new Promise(done=>server.listen(0,'127.0.0.1',done));
const url='http://127.0.0.1:'+server.address().port;
const results={};
try {await withIsolatedLocalBrowser({taskFile,runId,url,timeoutMs:120000},async({createContext})=>{
 const ctx=await createContext({viewport:{width:1280,height:900},locale:'ar-SA',timezoneId:'Asia/Riyadh'});
 results.engine=ctx.browser().version();
 await ctx.addInitScript(()=>sessionStorage.setItem('rakeezx-demo-session-v1','preparing'));
 const page=await ctx.newPage();await openReadyServedDemo(page,url);
 await seed(page,{count:220,long:true,sessions:16,distinct:true});
 await page.evaluate(async()=>{const s=await import('/src/store.js');await s.patchProfile({schoolName:'مدرسة المعرفة والعلوم المتقدمة للتعليم العام في المنطقة الشرقية والرياض'});});
 // Keep this same synthetic document: a query navigation would reload Demo
 // and replace its seeded fixture. Only the printable URL needs a sentinel.
 await page.evaluate(()=>history.replaceState(null,'','?N24_URL_SENTINEL=1'+location.hash));
 const surfaces=[{name:'grades',tab:'grades'},{name:'roster',tab:'roster'},{name:'execution',route:'/reports/execution'},{name:'cross-grades',route:'/reports/grades'},{name:'cross-followup',route:'/reports/followup'}];
 for(const surface of phase==='control'?surfaces.slice(0,2):surfaces){
  await page.goto(url+'/?N24_URL_SENTINEL=1#'+(surface.route??'/teaching/print-teaching/reports'));
  await page.locator(surface.tab?'.report-tabs':surface.name==='execution'?'.execution-report-page':`[data-report-kind="${surface.name==='cross-followup'?'followup':'grades'}"]`).waitFor();
  if(surface.tab)await page.locator(`[data-act="tab"][data-tab="${surface.tab}"]`).click();
  await page.evaluate(()=>document.fonts.ready);
  if(phase==='metadata') {
   for(const width of [320,390]) {
    await page.setViewportSize({width,height:844});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
    if(surface.tab)await page.locator('[data-act="toggle-a4"]').click();
    await page.waitForFunction(()=>!document.querySelector('#toast')?.classList.contains('is-on'));
    const check=async()=>{
     await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
     const headers=page.locator('.printhead:visible');
     assert.equal(await headers.evaluateAll(els=>els.some(el=>el.scrollWidth>el.clientWidth+1)),false,'Header overflow');
     assert.equal(await page.locator('.printhead:visible dd').evaluateAll(els=>els.some(el=>el.scrollWidth>el.clientWidth+1)),false,'Metadata value overflow');
     if(await headers.count()) {
      const layout=await headers.first().evaluate(el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,width:r.width,viewport:innerWidth,scrollX,children:[...el.querySelectorAll('.printhead__title,.printhead__brand,.printhead__meta,dd')].map(x=>{const b=x.getBoundingClientRect();return {className:x.className,left:b.left,right:b.right,width:b.width};})};});
      assert.ok(layout.left>=-1 && layout.right<=width+1 && layout.children.every(c=>c.left>=layout.left-1&&c.right<=layout.right+1),'Metadata/title remains inside visible header');
      await writeFile(output+`/${surface.name}-${width}-${await page.evaluate(()=>matchMedia('print').matches?'print':'screen')}-geometry.json`,JSON.stringify(layout,null,2));
      await headers.first().evaluate(el=>el.scrollIntoView({block:'center'}));
      // A print-media locator screenshot can relayout its clip in RTL.
      // Capture the actual supported viewport after centering the header.
      await page.screenshot({path:output+`/${surface.name}-${width}-${await page.evaluate(()=>matchMedia('print').matches?'print':'screen')}.png`});
     }
    };
    await check();if(surface.tab)await page.locator('[data-act="toggle-a4"]').click();
    await page.emulateMedia({media:'print'});assert.ok(await page.locator('.printhead:visible').count());await check();
    if(surface.tab) {
     // Actual A4 print from the 320/390 context, with native decorations ON.
     // PDF gives physical-page evidence independent of screenshot clipping.
     const original=await page.title();await page.evaluate(()=>document.title='N24_TITLE_SENTINEL');
     await page.pdf({path:output+`/${surface.name}-${width}.pdf`,preferCSSPageSize:true,displayHeaderFooter:true});
     await page.evaluate(t=>document.title=t,original);
    }
    await page.emulateMedia({media:'screen'});
   }
   results[surface.name]={widths:[320,390],screenAndPrint:true};
   console.log('PASS changed print spacing + metadata '+surface.name+' 320/390');continue;
  }
  const data=await page.evaluate(async()=>{const s=await import('/src/store.js');const {studentTotal}=await import('/src/models.js');const {roster,items,ctx}=s.teachingContext('print-teaching');return {ids:roster.map(x=>x.id),totals:roster.map(x=>studentTotal(items,ctx[x.id])),rows:[...document.querySelectorAll('.report-document tbody tr:not(.report-ending-row),.report-results tbody tr:not(.report-ending-row)')].map(x=>x.textContent.trim().replace(/\s+/g,' '))};});
  const pending=page.waitForEvent('download');await page.locator('[data-act="csv"],[data-act="n70-csv"]').last().click();const stream=await(await pending).createReadStream();let csv='';for await(const chunk of stream)csv+=chunk;
  const baseline=JSON.parse(await readFile('test-results/n24-clean/before-chromium/data.json','utf8'))[surface.name];
  assert.deepEqual({...data,csv},baseline,'Original values/CSV preserved');
  await page.evaluate(()=>{window.__nativePrint=[];window.print=()=>{window.__nativePrint.push(document.title);window.dispatchEvent(new Event('afterprint'));};});
  const title=await page.title();await page.locator('[data-act="print"],[data-act="n70-print"]').last().click();
  if(await page.locator('#pre-print-form').count())await page.locator('button[form="pre-print-form"]').click();
  await page.waitForFunction(()=>window.__nativePrint.length===1);
  assert.equal(await page.title(),title);
  await page.emulateMedia({media:'print'});await page.evaluate(()=>document.title='N24_TITLE_SENTINEL');
  const headerTemplate='<div class="text left">N24_DATE_SENTINEL <span class="date"></span></div><div class="title text center"></div>';
  const footerTemplate='<div class="url text left grow"></div><div class="text right"><span class="pageNumber"></span>/<span class="totalPages"></span></div>';
  await page.pdf({path:output+'/'+surface.name+'.pdf',preferCSSPageSize:true,displayHeaderFooter:true,headerTemplate,footerTemplate});
  // Independent native default-template path; enable decorations and let the
  // browser supply its own date/title/URL/page-number template unchanged.
  await page.pdf({path:output+'/'+surface.name+'-native.pdf',preferCSSPageSize:true,displayHeaderFooter:true});
  results[surface.name]={...data,csv,filename:await page.evaluate(()=>window.__nativePrint[0]),rules:await page.locator('[data-report-page-size]').evaluateAll(els=>els.map(el=>el.textContent))};
  await page.evaluate(t=>document.title=t,title);await page.emulateMedia({media:'screen'});
  console.log('PASS actual app '+phase+' '+surface.name+' values/CSV/print action; headers ENABLED in both PDF paths');
 }
 await writeFile(output+'/data.json',JSON.stringify(results,null,2));
});}finally{await new Promise(done=>server.close(done));console.log('Owned browser/server closed');}
