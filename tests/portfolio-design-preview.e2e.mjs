import { test, expect } from '@playwright/test';
const entry='/#/reports/portfolio-preview';
const sameOriginOnly=async(context,baseURL)=>{
 const origin=new URL(baseURL).origin;
 await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort('blockedbyclient'));
 await context.routeWebSocket('**/*',socket=>socket.close());
 await context.addInitScript(()=>{
   sessionStorage.setItem('rakeezx-demo-session-v1','active');
   window.__portfolioPrintCalls=0;
   window.print=()=>{window.__portfolioPrintCalls++;};
 });
};
async function ready(page){
 await page.waitForFunction(async()=>{
   const s=await import('/src/store.js');
   return s.state.ready && s.getActiveWorkspace()?.type==='demo' && s.teachings().length>0;
 });
 await page.locator('.boot').waitFor({state:'detached'});
 await expect(page.locator('[data-folio-document]')).toBeVisible();
}

test('four coherent Arabic A4 pages render actual scoped Demo evidence and print without mutating records',async({page,context,baseURL},info)=>{
 await sameOriginOnly(context,baseURL);
 const errors=[];
 page.on('pageerror',e=>errors.push(e.stack||e.message));
 page.on('console',m=>{if(m.type()==='error' && !m.text().startsWith('[vite] failed to connect to websocket.'))errors.push(m.text())});
 await page.goto(entry);
 await ready(page);
 const sheets=page.locator('[data-portfolio-page]');
 await expect(sheets).toHaveCount(4);
 await expect(page.locator('link[data-rakeez-portfolio-style]')).toHaveAttribute('rel','stylesheet');
 await expect(page.locator('.folio-cover')).toContainText('شواهد الأداء');
 await expect(page.locator('.folio-contents__row')).toHaveCount(11);
 await expect(page.locator('.folio-contents__row').nth(8)).toContainText('الإدارة الصفية');
 await expect(page.locator('.folio-coverage__row')).toHaveCount(11);
 await expect(page.locator('.folio-coverage')).toContainText('لا تمثل تقييمًا');
 const demo=await page.evaluate(async()=>{
  const s=await import('/src/store.js'), m=await import('/src/lib/portfolio-design-preview.js');
  const report=s.executionReport({yearId:s.activeYear()?.id,termId:s.activeTerm()?.id});
  const found=s.teachings().map(t=>({t,e:m.portfolioAttendanceEvidence(report,t.id)})).sort((a,b)=>b.e.recordedSessions-a.e.recordedSessions)[0];
  return {expected:found.e.recordedSessions,id:found.t.id,rows:found.e.rows.length};
 });
 expect(demo.expected).toBeGreaterThan(0);
 await page.locator('select[data-change="teaching"]').selectOption(demo.id);
 await expect(page.locator('.folio-evidence__metrics strong').first()).toHaveText(new Intl.NumberFormat('ar-SA',{useGrouping:false}).format(demo.expected));
 await expect(page.locator('.folio-evidence')).toContainText('سجلات الحضور المؤرخة في ركيز');
 await expect(page.locator('.folio-evidence')).toContainText('لا تظهر أسماء الطلاب');
 await expect(page.locator('.folio-coverage__status.is-present')).toHaveCount(1);
 const before=await page.evaluate(async()=>JSON.stringify((await import('/src/store.js')).state));
 await page.screenshot({path:info.outputPath('portfolio-desktop-full.png'),fullPage:true,animations:'disabled'});
 await page.getByRole('button',{name:/طباعة \/ PDF/}).click();
 await expect.poll(()=>page.evaluate(()=>window.__portfolioPrintCalls)).toBe(1);
 const pdf=await page.pdf({path:info.outputPath('portfolio-4pages.pdf'),preferCSSPageSize:true,printBackground:true});
 expect(pdf.subarray(0,5).toString()).toBe('%PDF-');
 expect((pdf.toString('latin1').match(/\/Type\s*\/Page\b/g)||[]).length).toBe(4);
 await page.emulateMedia({media:'print'});
 await page.screenshot({path:info.outputPath('portfolio-print-layout.png'),fullPage:true,animations:'disabled'});
 await page.emulateMedia({media:'screen'});
 const after=await page.evaluate(async()=>JSON.stringify((await import('/src/store.js')).state));
 expect(after).toBe(before);
 expect(errors).toEqual([]);
});

test('narrow mobile layout, page navigation and private in-memory optional image',async({page,context,baseURL},info)=>{
 await sameOriginOnly(context,baseURL);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewportSize({width:390,height:844});
 await page.goto(entry);await ready(page);
 await expect(page.locator('[data-portfolio-page]')).toHaveCount(4);
 await page.locator('button[data-page="4"]').click();
 await expect(page.locator('[data-portfolio-page="4"]')).toBeVisible();
 const input=page.locator('input[type="file"][data-change="photo"]');
 // Pixel is deliberately synthetic; no external user document/photo enters this test.
 const tiny=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4//8/AwAI/AL+SY4UiwAAAABJRU5ErkJggg==','base64');
 await input.setInputFiles({name:'local-test.png',mimeType:'image/png',buffer:tiny});
 await expect(page.locator('.folio-evidence__photo')).toBeVisible();
 await expect(page.locator('.folio-toolbar__helper')).toContainText('local-test.png');
 await page.screenshot({path:info.outputPath('portfolio-mobile.png'),fullPage:true,animations:'disabled'});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByRole('button',{name:'إزالة الصورة'}).click();
 await expect(page.locator('.folio-evidence__image-placeholder')).toContainText('لم تُرفق صورة');
 expect(errors).toEqual([]);
});
