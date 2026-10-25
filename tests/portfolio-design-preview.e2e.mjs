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
 await expect(page.locator('.folio-coverage')).toContainText('أعمال وإنجازات المعلم');
 const demo=await page.evaluate(async()=>{
  const s=await import('/src/store.js'), m=await import('/src/lib/portfolio-design-preview.js');
  const year=s.activeYear();
  const groups=s.termsOf(year.id).map(term=>({
    report:s.executionReport({yearId:year.id,termId:term.id}),
    teachings:s.teachings(term.id).map(t=>({
      ...t,sectionLabel:s.sectionLabel(s.getSection(t.sectionId)),
      subjectName:s.getSubject(t.subjectId)?.name || '',
    })),
  }));
  const e=m.portfolioYearEvidence(groups);
  return {expected:e.recordedSessions,classes:e.sectionCount,subjects:e.subjectCount,rows:e.rows.length};
 });
 expect(demo.expected).toBeGreaterThan(0);
 expect(demo.classes).toBeGreaterThan(1);
 await expect(page.locator('select[data-change="teaching"]')).toHaveCount(0);
 await expect(page.locator('.folio-evidence__metrics strong').first()).toHaveText(new Intl.NumberFormat('ar-SA',{useGrouping:false}).format(demo.expected));
 await expect(page.locator('.folio-cover')).toContainText('ملف الإنجاز المهني');
 await expect(page.locator('.folio-cover')).not.toContainText('فصول المعلم');
 await expect(page.locator('.folio-suggestion-studio')).toContainText('شواهد يقترحها ركيز من عملك');
 await expect(page.locator('.folio-suggestion-studio__choice.is-selected')).toContainText('متابعة رصد حضور الطلاب');
 await expect(page.locator('.folio-evidence')).toContainText('جميع الفصول والمواد');
 await expect(page.locator('.folio-coverage')).not.toContainText('لم يُضف');
 await expect(page.locator('.folio-coverage')).not.toContainText('حدود هذا النموذج');
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
 // Test images are synthetic one-pixel PNGs; no user/private asset enters fixtures.
 const tiny=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4//8/AwAI/AL+SY4UiwAAAABJRU5ErkJggg==','base64');
 await input.setInputFiles([
   {name:'image-a.png',mimeType:'image/png',buffer:tiny},
   {name:'image-b.png',mimeType:'image/png',buffer:tiny},
 ]);
 await expect(page.locator('.folio-evidence__gallery-item')).toHaveCount(2);
 await page.getByRole('combobox',{name:'توزيع الصور'}).selectOption('three');
 await expect(page.locator('.folio-evidence__gallery--three')).toBeVisible();
 await page.getByRole('button',{name:'تأخير الصورة'}).first().click();
 await expect(page.locator('.folio-evidence__gallery-item').first()).toContainText('image-b.png');
 await page.getByRole('combobox',{name:'معيار الشاهد'}).selectOption('07');
 await expect(page.locator('.folio-evidence__gallery-item')).toHaveCount(0);
 await input.setInputFiles({name:'educational-tool.png',mimeType:'image/png',buffer:tiny});
 await expect(page.locator('.folio-evidence__gallery-item')).toHaveCount(1);
 await page.getByRole('combobox',{name:'معيار الشاهد'}).selectOption('09');
 await expect(page.locator('.folio-evidence__gallery-item')).toHaveCount(2);
 await page.screenshot({path:info.outputPath('portfolio-mobile.png'),fullPage:true,animations:'disabled'});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByRole('button',{name:'حذف الصورة'}).first().click();
 await expect(page.locator('.folio-evidence__gallery-item')).toHaveCount(1);
 expect(errors).toEqual([]);
});

test('photo arrangements fit A4 export and are independently scoped to the selected criterion',async({page,context,baseURL},info)=>{
 await sameOriginOnly(context,baseURL);
 await page.goto(entry); await ready(page);
 const tiny=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4//8/AwAI/AL+SY4UiwAAAABJRU5ErkJggg==','base64');
 await page.locator('input[data-change="photo"]').setInputFiles(
   Array.from({length:6},(_,i)=>({name:'sample-'+(i+1)+'.png',mimeType:'image/png',buffer:tiny})));
 await expect(page.locator('.folio-evidence__gallery-item')).toHaveCount(6);
 for(const columns of ['one','two','three']) {
   await page.getByRole('combobox',{name:'توزيع الصور'}).selectOption(columns);
   await page.emulateMedia({media:'print'});
   const bounds=await page.evaluate(()=>[...document.querySelectorAll('[data-portfolio-page]')]
     .filter(p=>Number(p.dataset.portfolioPage)>=4)
     .map(p=>({
       page:Number(p.dataset.portfolioPage),
       bottom:p.querySelector('.folio-evidence__gallery')?.getBoundingClientRect().bottom,
       footerTop:p.querySelector('.folio-sheet__footer').getBoundingClientRect().top,
     })));
   for(const row of bounds) expect(row.bottom,columns+' gallery page '+row.page+' must fit A4').toBeLessThanOrEqual(row.footerTop-5);
   const pdf=await page.pdf({path:info.outputPath('portfolio-gallery-'+columns+'.pdf'),preferCSSPageSize:true,printBackground:true});
   expect((pdf.toString('latin1').match(/\/Type\s*\/Page\b/g)||[]).length).toBe(({one:5,two:5,three:4}[columns]));
   await page.emulateMedia({media:'screen'});
 }
 await page.getByRole('combobox',{name:'معيار الشاهد'}).selectOption('07');
 await expect(page.locator('.folio-evidence__gallery-item')).toHaveCount(0);
});


test('manual witness needs only a title, description and photo; automatic records stay separate', async({page,context,baseURL},info)=>{
 await sameOriginOnly(context,baseURL);
 await page.goto(entry); await ready(page);
 await page.getByRole('combobox',{name:'معيار الشاهد'}).selectOption('03');
 await expect(page.locator('.folio-suggestion-studio__choice.is-selected')).toContainText('إضافة شاهد خاص بي');
 await expect(page.getByRole('button',{name:/طباعة \/ PDF/})).toBeDisabled();
 await page.getByRole('textbox',{name:'عنوان الشاهد'}).fill('التواصل التربوي مع أولياء الأمور');
 await page.getByRole('textbox',{name:'عنوان الشاهد'}).blur();
 await page.getByRole('textbox',{name:'وصف الشاهد'}).fill('متابعة التواصل مع الأسر عبر قنوات التواصل المعتمدة.');
 await page.getByRole('textbox',{name:'وصف الشاهد'}).blur();
 const tiny=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4//8/AwAI/AL+SY4UiwAAAABJRU5ErkJggg==','base64');
 await page.locator('input[data-change="photo"]').setInputFiles({name:'contact.png',mimeType:'image/png',buffer:tiny});
 await expect(page.locator('.folio-evidence')).toContainText('متابعة التواصل مع الأسر');
 await expect(page.getByRole('button',{name:/طباعة \/ PDF/})).toBeEnabled();
 const pdf=await page.pdf({path:info.outputPath('folio-manual-parent-communication.pdf'),preferCSSPageSize:true,printBackground:true});
 expect((pdf.toString('latin1').match(/\/Type\s*\/Page\b/g)||[]).length).toBe(4);
 await page.getByRole('combobox',{name:'معيار الشاهد'}).selectOption('09');
 await expect(page.locator('.folio-evidence__gallery-item')).toHaveCount(0);
 await page.getByRole('combobox',{name:'معيار الشاهد'}).selectOption('03');
 await expect(page.locator('.folio-evidence__gallery-item')).toHaveCount(1);
});

test('scheduled work suggestions require teacher review while saved attendance needs none',async({page,context,baseURL})=>{
 await sameOriginOnly(context,baseURL);
 await page.goto(entry);await ready(page);
 await expect(page.getByRole('button',{name:/طباعة \/ PDF/})).toBeEnabled();
 await page.getByRole('combobox',{name:'معيار الشاهد'}).selectOption('01');
 const planned=page.locator('.folio-suggestion-studio__choice').filter({hasText:'الجدول الدراسي الأسبوعي'});
 if(await planned.count()){
   await planned.click();
   await expect(page.getByRole('button',{name:/طباعة \/ PDF/})).toBeDisabled();
   await page.getByText('راجعت بيانات هذا الشاهد وأؤكد صحة ما أضيف إليه').click();
   await expect(page.getByRole('button',{name:/طباعة \/ PDF/})).toBeEnabled();
   await expect(page.locator('.folio-evidence')).toContainText('الجدول الدراسي الأسبوعي');
 }
});
