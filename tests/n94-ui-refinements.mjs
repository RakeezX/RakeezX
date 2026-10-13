// Actual app modules, dynamic sheets, delegates and CSS, isolated synthetic Demo.
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { openReadyServedDemo } from './helpers/served-demo-readiness.mjs';
const root = fileURLToPath(new URL('..',import.meta.url));
const directory = path.join(os.tmpdir(),'rakeez-n94-ui-30ab4451');
await mkdir(directory,{recursive:true});
const mime={'.js':'text/javascript','.mjs':'text/javascript','.html':'text/html','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
const server=http.createServer(async(req,res)=>{
  const file=path.resolve(root,new URL(req.url,'http://127.0.0.1').pathname.replace(/^\/+/, '')||'index.html');
  if(!file.startsWith(root))return res.writeHead(403).end();
  try{res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(await readFile(file));}catch{res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`;
let browser,context,page;
const evidence={base,checks:[],layouts:[],directory};
try{
 browser=await chromium.launch({headless:true});
 context=await browser.newContext({viewport:{width:390,height:844},locale:'ar-SA',timezoneId:'Asia/Riyadh',serviceWorkers:'block'});
 await context.route('https://*.supabase.co/**',route=>route.abort());
 page=await context.newPage();page.setDefaultTimeout(20000);page.setDefaultNavigationTimeout(20000);const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.clock.setFixedTime(new Date('2026-10-13T06:00:00Z'));
 await page.goto(base);await page.evaluate(()=>sessionStorage.setItem('rakeezx-demo-session-v1','preparing'));await page.reload();
 await openReadyServedDemo(page,base);console.log("demo ready");
 const fixture=await page.evaluate(async()=>{
   const s=await import('/src/store.js');
   const item=s.state.items.find(row=>row.scoreMode==='subitems'&&row.distributionMode==='manual'&&!row.deleted);
   const definitions=s.scoreSubitemsOf(item.id);
   const student=s.teachingContext(item.teachingId).roster.find(row=>!s.state.scoreSubitemCompletions.some(c=>c.studentId===row.id&&c.subitemId===definitions[0].id&&c.checked));
   const direct=s.items(item.teachingId).find(row=>row.scoreMode!=='subitems'&&!row.auto);
   await s.patch('items',direct.id,{name:' الوَاجِبَات '});
   return {itemId:item.id,teachingId:item.teachingId,studentId:student.id,definitions,directId:direct.id};
 });
 await page.goto(`${base}/#/teaching/${fixture.teachingId}/items`);
 await page.locator(`[data-act="configure"][data-id="${fixture.directId}"]`).click();
 let dialog=page.getByRole('dialog');await dialog.waitFor();
 assert.equal(await dialog.locator('[data-subitem-name]').inputValue(),'واجب1');
 await dialog.locator('[data-subitem-add]').click();
 assert.deepEqual(await dialog.locator('[data-subitem-name]').evaluateAll(inputs=>inputs.map(i=>i.value)),['واجب1','واجب2']);
 await dialog.locator('[data-subitem-name]').first().fill('اسمي المخصص');
 await dialog.locator('[data-subitem-add]').click();
 assert.deepEqual(await dialog.locator('[data-subitem-name]').evaluateAll(inputs=>inputs.map(i=>i.value)),['اسمي المخصص','واجب2','واجب1']);
 await page.waitForFunction(()=>[...document.querySelectorAll('[data-subitem-start]')].every(i=>!!i._flatpickr));
 assert.ok((await dialog.locator('[data-subitem-start]').evaluateAll(inputs=>inputs.map(i=>i.value))).every(v=>v===''));
 await dialog.locator('[data-sheet-close]').first().click();await dialog.waitFor({state:'detached'});
 evidence.checks.push('n94_parent_derived_names');console.log('names pass');
 await page.locator(`[data-act="configure"][data-id="${fixture.itemId}"]`).click();dialog=page.getByRole('dialog');await dialog.waitFor();
 const first=dialog.locator('[data-subitem-row]').first();
 await page.waitForFunction(()=>!!document.querySelector('[data-subitem-start]')?._flatpickr);
 assert.deepEqual(await dialog.locator('[data-subitem-name]').evaluateAll(inputs=>inputs.map(i=>i.value)),fixture.definitions.map(d=>d.name));
 const bounds=await first.locator('[data-subitem-start]').evaluate(i=>({type:i.type,scope:i.dataset.rakeezDateScope,min:i._flatpickr.config.minDate.toLocaleDateString('en-CA'),max:i._flatpickr.config.maxDate.toLocaleDateString('en-CA')}));
 assert.deepEqual(bounds,{type:'text',scope:'planning',min:'2026-08-01',max:'2027-12-31'});
 await first.locator('[data-subitem-start]').fill('٢٠٢٦-١٠-١٢');
 assert.equal(await first.locator('[data-subitem-start]').inputValue(),'2026-10-12');
 await first.locator('[data-subitem-due]').fill('2026-10-11');await dialog.locator('[data-save-subitems]').click();
 await page.locator('#toast').filter({hasText:'موعد التسليم لا يسبق البداية'}).waitFor();
 for(const invalid of ['2026-07-31','2028-01-01']){
  await first.locator('[data-subitem-start]').fill(invalid);
  assert.equal(await first.locator('[data-subitem-start]').evaluate(i=>i.checkValidity()),false);
 }
 await first.locator('[data-subitem-start]').fill('');await first.locator('[data-subitem-due]').fill('2026-10-12');
 const latePoints=Number((fixture.definitions[0].value/2).toFixed(2));await first.locator('[data-subitem-late]').fill(String(latePoints));
 for(const width of [320,390]){
  await page.setViewportSize({width,height:844});
  const fields=await dialog.locator('.n94-definition-details input').evaluateAll(inputs=>inputs.map(i=>{const b=i.getBoundingClientRect();return {left:b.left,right:b.right,height:b.height};}));
  assert.ok(fields.every(b=>b.left>=0&&b.right<=width&&b.height>=44));
 }
 await dialog.locator('[data-save-subitems]').click();await page.getByRole('button',{name:'تأكيد التغيير',exact:true}).click();
 await page.locator('#toast').filter({hasText:'حُفظ توزيع العناصر'}).waitFor();
 const saved=await page.evaluate(async id=>(await import('/src/store.js')).scoreSubitemsOf(id),fixture.itemId);
 assert.deepEqual(saved.map(d=>[d.id,d.createdAt,d.name]),fixture.definitions.map(d=>[d.id,d.createdAt,d.name]));
 assert.equal(saved[0].startDate,null);assert.equal(saved[0].dueDate,'2026-10-12');
 evidence.checks.push('n94_approved_date_controls');console.log('dates pass');
 await page.goto(`${base}/#/teaching/${fixture.teachingId}/grades`);await page.locator(`[data-act="pick"][data-id="${fixture.itemId}"]`).click();
 await page.waitForFunction(()=>!!document.querySelector('#n94-grades-style')?.sheet);
 assert.equal(await page.locator('.n94-completion-legend').count(),1);
 assert.equal((await page.locator('.n94-completion-legend').textContent()).replace(/\s+/g,''),'غيرمرصودمتأخرعادي/بعذر');
 const button=()=>page.locator(`[data-act="subitem-completion"][data-student="${fixture.studentId}"][data-subitem="${fixture.definitions[0].id}"]`);
 const expectState=async state=>page.waitForFunction(({studentId,id,state})=>document.querySelector(`[data-student="${studentId}"][data-subitem="${id}"]`)?.classList.contains('n94-completion--'+state),{studentId:fixture.studentId,id:fixture.definitions[0].id,state});
 for(const state of ['unrecorded','late','regular','unrecorded']){
  await expectState(state);
  if(state!=='unrecorded')assert.ok((await button().textContent()).includes(String(state==='late'?latePoints:fixture.definitions[0].value)));
  for(const width of [320,390])for(const theme of ['light','dark']){
   await page.setViewportSize({width,height:844});await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
   const rendered=await button().evaluate(el=>{const r=el.getBoundingClientRect(),c=getComputedStyle(el),line=el.querySelector('.n94-cell-line');return {left:r.left,right:r.right,height:r.height,text:el.textContent,label:el.getAttribute('aria-label'),title:el.title,whiteSpace:getComputedStyle(line).whiteSpace,color:c.color,background:c.backgroundColor,overflow:document.documentElement.scrollWidth>innerWidth};});
   assert.ok(rendered.left>=0&&rendered.right<=width&&rendered.height>=44);assert.equal(rendered.overflow,false);assert.equal(rendered.whiteSpace,'nowrap');
   assert.doesNotMatch(rendered.text,/غير مرصود|مقبول بعذر|عادي|متأخر/);assert.equal(rendered.label,rendered.title);assert.ok(rendered.label.includes({unrecorded:'غير مرصود',late:'متأخر',regular:'عادي'}[state]));
   const lum=c=>{const a=c.match(/\d+/g).slice(0,3).map(Number).map(x=>x/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return .2126*a[0]+.7152*a[1]+.0722*a[2];};
   const a=lum(rendered.color),b=lum(rendered.background);assert.ok((Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5);
   const screenshot=`${state}-${theme}-${width}.png`;await page.screenshot({path:path.join(directory,screenshot),fullPage:true});evidence.layouts.push({state,width,theme,...rendered,screenshot});
  }
  if(evidence.layouts.length<16){await page.waitForTimeout(500);await button().focus();await button().press('Enter');}
 }
 evidence.checks.push('n94_compact_cells_legend');assert.deepEqual(errors,[]);
 console.log(JSON.stringify({status:'PASS',checks:evidence.checks,directory}));
}finally{
 await context?.close();await browser?.close();await new Promise(resolve=>server.close(resolve));
 await writeFile(path.join(directory,'result.json'),JSON.stringify(evidence,null,2));
}


