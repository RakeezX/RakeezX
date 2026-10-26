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
 await expect(page.locator('[data-folio-focus]')).toBeVisible();
 await expect(page.locator('[data-folio-document]')).toBeAttached();
}

async function chooseCriterion(page,number){
  const target=page.locator(`.folio-criteria__item[data-id="${number}"]`);
  if(!(await target.isVisible()))await page.locator('[data-act="toggle-criteria"]').click();
  await target.click();
  await expect(target).toHaveClass(/is-selected/);
}

test('four coherent Arabic A4 pages render actual scoped Demo evidence and print without mutating records',async({page,context,baseURL},info)=>{
 await sameOriginOnly(context,baseURL);
 const errors=[];
 page.on('pageerror',e=>errors.push(e.stack||e.message));
 page.on('console',m=>{if(m.type()==='error' && !m.text().startsWith('[vite] failed to connect to websocket.'))errors.push(m.text())});
 await page.goto(entry);
 await ready(page);
 const sheets=page.locator('[data-portfolio-page]');
 expect(await sheets.count()).toBeGreaterThanOrEqual(4);
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
 await expect(page.locator('.folio-focus .folio-evidence__metrics strong').first()).toHaveText(new Intl.NumberFormat('ar-SA',{useGrouping:false}).format(demo.expected));
 await expect(page.locator('.folio-cover')).toContainText('ملف الإنجاز المهني');
 await expect(page.locator('.folio-cover')).not.toContainText('فصول المعلم');
 await expect(page.locator('.folio-suggestion-studio')).toContainText('شواهد الإدارة الصفية');
 await expect(page.locator('.folio-suggestion-studio__choice.is-selected')).toContainText('متابعة رصد حضور الطلاب');
 await expect(page.locator('.folio-evidence')).toContainText('جميع الفصول والمواد');
 await expect(page.locator('.folio-coverage')).not.toContainText('لم يُضف');
 await expect(page.locator('.folio-coverage')).not.toContainText('حدود هذا النموذج');
 const before=await page.evaluate(async()=>JSON.stringify((await import('/src/store.js')).state));
 await page.screenshot({path:info.outputPath('portfolio-desktop-full.png'),fullPage:true,animations:'disabled'});
 await page.getByRole('button',{name:/PDF/}).click();
 await expect.poll(()=>page.evaluate(()=>window.__portfolioPrintCalls)).toBe(1);
 const pdf=await page.pdf({path:info.outputPath('portfolio-4pages.pdf'),preferCSSPageSize:true,printBackground:true});
 expect(pdf.subarray(0,5).toString()).toBe('%PDF-');
 expect((pdf.toString('latin1').match(/\/Type\s*\/Page\b/g)||[]).length).toBe(await page.locator('[data-portfolio-page]').count());
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
 expect(await page.locator('[data-portfolio-page]').count()).toBeGreaterThanOrEqual(4);
 await expect(page.locator('[data-folio-focus]')).toBeVisible();
 await expect(page.locator('[data-focus-page="4"]')).toBeVisible();
 const input=page.locator('input[type="file"][data-change="photo"]');
 // Test images are synthetic one-pixel PNGs; no user/private asset enters fixtures.
 const tiny=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4//8/AwAI/AL+SY4UiwAAAABJRU5ErkJggg==','base64');
 await input.setInputFiles([
   {name:'image-a.png',mimeType:'image/png',buffer:tiny},
   {name:'image-b.png',mimeType:'image/png',buffer:tiny},
 ]);
 await expect(page.locator('.folio-focus .folio-evidence__gallery-item')).toHaveCount(2);
 await page.getByRole('combobox',{name:'توزيع الصور'}).selectOption('three');
 await expect(page.locator('.folio-focus .folio-evidence__gallery--three')).toBeVisible();
 await page.getByRole('button',{name:'تأخير الصورة'}).first().click();
 await expect(page.locator('.folio-focus .folio-evidence__gallery-item').first()).toContainText('image-b.png');
 await chooseCriterion(page,'07');
 await expect(page.locator('.folio-focus .folio-evidence__gallery-item')).toHaveCount(0);
 await input.setInputFiles({name:'educational-tool.png',mimeType:'image/png',buffer:tiny});
 await expect(page.locator('.folio-focus .folio-evidence__gallery-item')).toHaveCount(1);
 await chooseCriterion(page,'09');
 await expect(page.locator('.folio-focus .folio-evidence__gallery-item')).toHaveCount(2);
 await page.screenshot({path:info.outputPath('portfolio-mobile.png'),fullPage:true,animations:'disabled'});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByRole('button',{name:'حذف الصورة'}).first().click();
 await expect(page.locator('.folio-focus .folio-evidence__gallery-item')).toHaveCount(1);
 expect(errors).toEqual([]);
});

test('photo arrangements fit A4 export and are independently scoped to the selected criterion',async({page,context,baseURL},info)=>{
 await sameOriginOnly(context,baseURL);
 await page.goto(entry); await ready(page);
 const tiny=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4//8/AwAI/AL+SY4UiwAAAABJRU5ErkJggg==','base64');
 await page.locator('input[data-change="photo"]').setInputFiles(
   Array.from({length:6},(_,i)=>({name:'sample-'+(i+1)+'.png',mimeType:'image/png',buffer:tiny})));
 await expect(page.locator('.folio-focus .folio-evidence__gallery-item')).toHaveCount(6);
 for(const columns of ['one','two','three']) {
   await page.getByRole('combobox',{name:'توزيع الصور'}).selectOption(columns);
   await page.emulateMedia({media:'print'});
   const bounds=await page.evaluate(()=>[...document.querySelectorAll('[data-portfolio-page]')]
     .filter(p=>Number(p.dataset.portfolioPage)>=4 && p.querySelector('.folio-evidence__gallery'))
     .map(p=>({
       page:Number(p.dataset.portfolioPage),
       bottom:p.querySelector('.folio-evidence__gallery').getBoundingClientRect().bottom,
       footerTop:p.querySelector('.folio-sheet__footer').getBoundingClientRect().top,
     })));
   for(const row of bounds) expect(row.bottom,columns+' gallery page '+row.page+' must fit A4').toBeLessThanOrEqual(row.footerTop-5);
   const pdf=await page.pdf({path:info.outputPath('portfolio-gallery-'+columns+'.pdf'),preferCSSPageSize:true,printBackground:true});
   expect((pdf.toString('latin1').match(/\/Type\s*\/Page\b/g)||[]).length).toBe(await page.locator('[data-portfolio-page]').count());
   await page.emulateMedia({media:'screen'});
 }
 await chooseCriterion(page,'07');
 await expect(page.locator('.folio-focus .folio-evidence__gallery-item')).toHaveCount(0);
});


test('manual witness needs only a title, description and photo; automatic records stay separate', async({page,context,baseURL},info)=>{
 await sameOriginOnly(context,baseURL);
 await page.goto(entry); await ready(page);
 await chooseCriterion(page,'03');
 await page.getByRole('button',{name:/شاهد جديد/}).click();
 await expect(page.locator('.folio-suggestion-studio__choice.is-selected')).toContainText('شاهد جديد');
 await expect(page.getByRole('button',{name:/PDF/})).toBeEnabled();
 await page.getByRole('textbox',{name:'عنوان الشاهد'}).fill('التواصل التربوي مع أولياء الأمور');
 await page.getByRole('textbox',{name:'عنوان الشاهد'}).blur();
 await page.getByRole('textbox',{name:'وصف الشاهد'}).fill('متابعة التواصل مع الأسر عبر قنوات التواصل المعتمدة.');
 await page.getByRole('textbox',{name:'وصف الشاهد'}).blur();
 const tiny=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4//8/AwAI/AL+SY4UiwAAAABJRU5ErkJggg==','base64');
 await page.locator('input[data-change="photo"]').setInputFiles({name:'contact.png',mimeType:'image/png',buffer:tiny});
 await expect(page.locator('.folio-focus .folio-evidence__description-edit')).toHaveValue('متابعة التواصل مع الأسر عبر قنوات التواصل المعتمدة.');
 await expect(page.getByRole('button',{name:/PDF/})).toBeEnabled();
 const pdf=await page.pdf({path:info.outputPath('folio-manual-parent-communication.pdf'),preferCSSPageSize:true,printBackground:true});
 expect((pdf.toString('latin1').match(/\/Type\s*\/Page\b/g)||[]).length).toBe(await page.locator('[data-portfolio-page]').count());
 await chooseCriterion(page,'09');
 await expect(page.locator('.folio-focus .folio-evidence__gallery-item')).toHaveCount(0);
 await chooseCriterion(page,'03');
 await expect(page.locator('.folio-focus .folio-evidence__gallery-item')).toHaveCount(1);
});

test('teacher can edit recorded work directly without repetitive confirmation dialogs',async({page,context,baseURL})=>{
 await sameOriginOnly(context,baseURL);
 await page.goto(entry);await ready(page);
 await expect(page.getByRole('button',{name:/PDF/})).toBeEnabled();
 await chooseCriterion(page,'01');
 const planned=page.locator('.folio-suggestion-studio__choice').filter({hasText:'الجدول الدراسي الأسبوعي'});
 if(await planned.count()){
   await planned.click();
   await expect(page.getByRole('button',{name:/PDF/})).toBeEnabled();
   await expect(page.locator('input[type="checkbox"][data-change="confirm-suggestion"]')).toHaveCount(0);
   await expect(page.locator('.folio-focus .folio-evidence__title-edit')).toHaveValue('الجدول الدراسي الأسبوعي');
 }
});


test('ready strategy and games examples open in-place; each witness owns independent photos',async({page,context,baseURL},info)=>{
 await sameOriginOnly(context,baseURL);
 await page.goto(entry);await ready(page);
 await chooseCriterion(page,'04');
 expect(await page.locator('.folio-suggestion-studio__choice').count()).toBeGreaterThanOrEqual(5);
 const plan=page.locator('.folio-suggestion-studio__choice').filter({hasText:'استراتيجية فكّر'});
 await expect(plan).toBeVisible();
 await plan.click();
 await expect(page.locator('.folio-focus .folio-evidence__title-edit')).toHaveValue('استراتيجية فكّر – زاوج – شارك');
 await expect(page.locator('.folio-focus .folio-evidence__illustration')).toContainText('تفكير فردي');
 await expect(page.getByRole('button',{name:/PDF/})).toBeEnabled();
 await expect(page.locator('input[type="checkbox"][data-change="confirm-suggestion"]')).toHaveCount(0);
 const file=page.locator('.folio-evidence__media-tools input[data-change="photo"]');
 await expect(file).toHaveCount(1);
 await expect(page.locator('.folio-toolbar input[type="file"]')).toHaveCount(0);
 const tiny=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4//8/AwAI/AL+SY4UiwAAAABJRU5ErkJggg==','base64');
 await file.setInputFiles({name:'think-pair-share.png',mimeType:'image/png',buffer:tiny});
 await expect(page.locator('.folio-focus .folio-evidence__gallery-item')).toHaveCount(1);
 await expect(page.locator('.folio-focus .folio-evidence__illustration')).toHaveCount(0);
 const game=page.locator('.folio-suggestion-studio__choice').filter({hasText:'التعلم باللعب'});
 await game.click();
 await expect(page.locator('.folio-focus .folio-evidence__title-edit')).toHaveValue('التعلم باللعب');
 await expect(page.locator('.folio-focus .folio-evidence__illustration')).toContainText('اللعبة التعليمية');
 await expect(page.locator('.folio-focus .folio-evidence__gallery-item')).toHaveCount(0);
 await page.locator('.folio-evidence__media-tools input[data-change="photo"]').setInputFiles({
   name:'learning-game.png',mimeType:'image/png',buffer:tiny,
 });
 await expect(page.locator('.folio-focus .folio-evidence__gallery-item')).toHaveCount(1);
 await plan.click();
 await expect(page.locator('.folio-focus .folio-evidence__gallery-item')).toHaveCount(1);
 await expect(page.locator('.folio-focus .folio-evidence__gallery-item').first()).toContainText('think-pair-share.png');
 await chooseCriterion(page,'07');
 await expect(page.locator('.folio-suggestion-studio')).toContainText('الألعاب التعليمية الرقمية');
 await page.screenshot({path:info.outputPath('strategy-ready-templates.png'),fullPage:true});
});

test('details for Madrasati and Noor are optional, not repeated or printed as evidence',async({page,context,baseURL},info)=>{
 await sameOriginOnly(context,baseURL);
 await page.goto(entry);await ready(page);
 await expect(page.locator('.folio-suggestion-studio__details')).toBeVisible();
 await expect(page.locator('.folio-suggestion-studio__details')).not.toHaveAttribute('open',/./);
 await page.locator('.folio-suggestion-studio__details summary').click();
 await expect(page.locator('.folio-suggestion-studio__details-body')).toBeVisible();
 await expect(page.locator('input[type="checkbox"][data-change="confirm-suggestion"]')).toHaveCount(0);
 await page.emulateMedia({media:'print'});
 await expect(page.locator('.folio-suggestion-studio')).toBeHidden();
 await expect(page.locator('.folio-evidence__media-tools')).toBeHidden();
 const pdf=await page.pdf({path:info.outputPath('portfolio-no-editing-controls.pdf'),preferCSSPageSize:true,printBackground:true});
 expect((pdf.toString('latin1').match(/\/Type\s*\/Page\b/g)||[]).length).toBe(await page.locator('[data-portfolio-page]').count());
});


test('ready teaching strategy includes a truthful visual diagram that is replaced by teacher photos',async({page,context,baseURL},info)=>{
 await sameOriginOnly(context,baseURL);
 await page.goto(entry);await ready(page);
 await chooseCriterion(page,'04');
 await expect(page.locator('.folio-focus .folio-evidence__illustration')).toContainText('تفكير فردي');
 await page.screenshot({path:info.outputPath('strategy-default-visual.png'),fullPage:true,animations:'disabled'});
 await page.locator('[data-act="toggle-witness-in-file"]').click();
 await page.emulateMedia({media:'print'});
 const rect=await page.evaluate(()=>{
   const p=[...document.querySelectorAll('.folio-export-witness')].find(x=>x.textContent.includes('استراتيجية فكّر'));
   return {bottom:p.querySelector('.folio-evidence__illustration').getBoundingClientRect().bottom,
     footer:p.querySelector('.folio-sheet__footer').getBoundingClientRect().top};
 });
 expect(rect.bottom).toBeLessThan(rect.footer-5);
 const pdf=await page.pdf({path:info.outputPath('strategy-default-visual.pdf'),preferCSSPageSize:true,printBackground:true});
 expect((pdf.toString('latin1').match(/\/Type\s*\/Page\b/g)||[]).length).toBe(await page.locator('[data-portfolio-page]').count());
 await page.emulateMedia({media:'screen'});
 const tiny=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4//8/AwAI/AL+SY4UiwAAAABJRU5ErkJggg==','base64');
 await page.locator('.folio-evidence__media-tools input[data-change="photo"]').setInputFiles({
   name:'real-activity.png',mimeType:'image/png',buffer:tiny,
 });
 await expect(page.locator('.folio-focus .folio-evidence__illustration')).toHaveCount(0);
 await expect(page.locator('.folio-focus .folio-evidence__gallery-item')).toHaveCount(1);
});


test('criteria rail supports fast navigation, personal aliases, extra sections and non-destructive hiding',async({page,context,baseURL})=>{
 await sameOriginOnly(context,baseURL);
 await page.goto(entry);await ready(page);
 await expect(page.locator('.folio-criteria__item')).toHaveCount(11);
 await chooseCriterion(page,'04');
 await expect(page.locator('.folio-evidence')).toContainText('التنوع في استراتيجيات التدريس');
 await page.locator('[data-act="edit-criterion-row"][data-id="04"]').click();
 await page.getByRole('textbox',{name:'اسم القسم في ملفي'}).fill('استراتيجيات تدريس متنوعة');
 await page.getByRole('textbox',{name:'اسم القسم في ملفي'}).blur();
 await expect(page.locator('.folio-contents')).toContainText('استراتيجيات تدريس متنوعة');
 await expect(page.locator('.folio-criteria__item[data-id="04"]')).toContainText('استراتيجيات تدريس متنوعة');
 await page.getByRole('button',{name:'الاسم الأصلي'}).click();
 await expect(page.locator('.folio-contents')).toContainText('التنوع في استراتيجيات التدريس');
 await page.getByRole('button',{name:'تم',exact:true}).click();
 await page.locator('input[data-change="criterion-inclusion"][data-id="04"]').uncheck();
 await expect(page.locator('.folio-contents__row')).toHaveCount(10);
 await expect(page.getByRole('button',{name:/PDF/})).toBeEnabled();
 await page.locator('input[data-change="criterion-inclusion"][data-id="04"]').check();
 await expect(page.locator('.folio-contents__row')).toHaveCount(11);
 await page.getByRole('button',{name:'+ إضافة قسم خاص'}).click();
 await expect(page.locator('.folio-criteria__item')).toHaveCount(12);
 await page.getByRole('textbox',{name:'اسم القسم في ملفي'}).fill('مبادرات المعلم');
 await page.getByRole('textbox',{name:'اسم القسم في ملفي'}).blur();
 await expect(page.locator('.folio-contents__row').filter({hasText:'مبادرات المعلم'})).toHaveCount(1);
 await page.getByRole('button',{name:'حذف القسم الخاص'}).click();
 await expect(page.locator('.folio-criteria__item')).toHaveCount(11);
 await expect(page.locator('.folio-contents__row').filter({hasText:'مبادرات المعلم'})).toHaveCount(0);
});

test('library switches type, filters live, hides/restores templates and keeps separate personal witnesses',async({page,context,baseURL})=>{
 await sameOriginOnly(context,baseURL);
 await page.goto(entry);await ready(page);
 await chooseCriterion(page,'04');
 await page.getByRole('button',{name:'نماذج جاهزة'}).click();
 await expect(page.locator('.folio-library__filter.is-active')).toContainText('نماذج جاهزة');
 const search=page.getByRole('textbox',{name:'بحث في الشواهد'});
 await search.fill('التعلم باللعب');
 await expect(page.locator('[data-library-card]:visible')).toHaveCount(1);
 await expect(page.locator('[data-library-card]:visible')).toContainText('التعلم باللعب');
 await search.fill('');
 const template=page.locator('[data-library-card]').filter({hasText:'التعلم باللعب'});
 await template.click();
 await page.getByRole('button',{name:'إخفاء من مكتبتي'}).click();
 await expect(page.locator('[data-library-card]').filter({hasText:'التعلم باللعب'})).toHaveCount(0);
 await page.getByRole('button',{name:/إظهار الشواهد المخفية/}).click();
 await expect(page.locator('[data-library-card]').filter({hasText:'التعلم باللعب'})).toHaveCount(1);
 const add=page.locator('[data-act="manual-suggestion"]');
 await add.click();
 await page.getByRole('textbox',{name:'عنوان الشاهد'}).fill('أول تجربة خاصة');
 await page.getByRole('textbox',{name:'عنوان الشاهد'}).blur();
 const tiny=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4//8/AwAI/AL+SY4UiwAAAABJRU5ErkJggg==','base64');
 await page.locator('input[data-change="photo"]').setInputFiles({name:'first.png',mimeType:'image/png',buffer:tiny});
 await expect(page.locator('.folio-focus .folio-evidence__gallery-item')).toHaveCount(1);
 await add.click();
 await page.getByRole('textbox',{name:'عنوان الشاهد'}).fill('تجربة ثانية');
 await page.getByRole('textbox',{name:'عنوان الشاهد'}).blur();
 await expect(page.locator('.folio-focus .folio-evidence__gallery-item')).toHaveCount(0);
 await page.getByRole('button',{name:'شواهدي'}).click();
 await expect(page.locator('[data-library-card]')).toHaveCount(2);
 await page.locator('[data-library-card]').filter({hasText:'أول تجربة خاصة'}).click();
 await expect(page.locator('.folio-focus .folio-evidence__gallery-item')).toHaveCount(1);
 await page.getByRole('button',{name:'حذف شاهدي'}).click();
 await expect(page.locator('[data-library-card]')).toHaveCount(1);
 await expect(page.locator('[data-library-card]')).toContainText('تجربة ثانية');
});

test('attendance chart and photos coexist and each section can be hidden or restored',async({page,context,baseURL},info)=>{
 await sameOriginOnly(context,baseURL);
 await page.goto(entry);await ready(page);
 await expect(page.locator('.folio-focus .folio-evidence__chart')).toBeVisible();
 const tiny=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4//8/AwAI/AL+SY4UiwAAAABJRU5ErkJggg==','base64');
 await page.locator('input[data-change="photo"]').setInputFiles([
   {name:'attendance-a.png',mimeType:'image/png',buffer:tiny},
   {name:'attendance-b.png',mimeType:'image/png',buffer:tiny},
 ]);
 await expect(page.locator('.folio-focus .folio-evidence__chart')).toBeVisible();
 await expect(page.locator('.folio-focus .folio-evidence__gallery-item')).toHaveCount(2);
 await expect(page.locator('[data-focus-continuation="5"]')).toBeVisible();
 const pages=await page.pdf({path:info.outputPath('attendance-chart-plus-photos.pdf'),preferCSSPageSize:true,printBackground:true});
 expect((pages.toString('latin1').match(/\/Type\s*\/Page\b/g)||[]).length).toBe(await page.locator('[data-portfolio-page]').count());
  await page.locator('input[data-section="chart"]').uncheck();
 await expect(page.locator('.folio-focus .folio-evidence__chart')).toHaveCount(0);
 await expect(page.locator('[data-focus-continuation="5"]')).toHaveCount(0);
 const restored=await page.locator('input[data-section="chart"]');
 await restored.check();
 await expect(page.locator('.folio-focus .folio-evidence__chart')).toBeVisible();
 await expect(page.locator('.folio-focus .folio-evidence__gallery-item')).toHaveCount(2);
 await expect(page.locator('[data-focus-continuation="5"]')).toBeVisible();
});

test('personal witnesses reorder, edited names remain searchable and photo deletes can be undone',async({page,context,baseURL})=>{
  await sameOriginOnly(context,baseURL);
  await page.goto(entry);await ready(page);
  await chooseCriterion(page,'04');
  const add=page.getByRole('button',{name:'+ شاهد جديد'});
  await add.click();
  await page.getByRole('textbox',{name:'عنوان الشاهد'}).fill('تجربتي الخاصة الأولى');
  await page.getByRole('textbox',{name:'عنوان الشاهد'}).blur();
  const tiny=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4//8/AwAI/AL+SY4UiwAAAABJRU5ErkJggg==','base64');
  await page.locator('input[data-change="photo"]').setInputFiles({name:'my-evidence.png',mimeType:'image/png',buffer:tiny});
  await add.click();
  await page.getByRole('textbox',{name:'عنوان الشاهد'}).fill('تجربتي الخاصة الثانية');
  await page.getByRole('textbox',{name:'عنوان الشاهد'}).blur();
  await page.getByRole('button',{name:'شواهدي'}).click();
  await expect(page.locator('[data-library-card]')).toHaveCount(2);
  await expect(page.locator('[data-library-card]').first()).toContainText('الأولى');
  await page.getByRole('button',{name:'تقديم شاهدي'}).click();
  await expect(page.locator('[data-library-card]').first()).toContainText('الثانية');
  await page.locator('[data-library-card]').filter({hasText:'الأولى'}).click();
  await page.getByRole('button',{name:'حذف شاهدي'}).click();
  await expect(page.locator('[data-library-card]')).toHaveCount(1);
  await page.locator('.folio-undo').getByRole('button',{name:'تراجع'}).click();
  await expect(page.locator('[data-library-card]')).toHaveCount(2);
  await expect(page.locator('.folio-focus .folio-evidence__gallery-item')).toHaveCount(1);
  const search=page.getByRole('textbox',{name:'بحث في الشواهد'});
  await search.fill('تجربتي الخاصة الأولى');
  await expect(page.locator('[data-library-card]:visible')).toHaveCount(1);
  await search.fill('');
  await page.getByRole('button',{name:'حذف جميع الصور'}).click();
  await expect(page.locator('.folio-focus .folio-evidence__gallery-item')).toHaveCount(0);
  await page.locator('.folio-undo').getByRole('button',{name:'تراجع'}).click();
  await expect(page.locator('.folio-focus .folio-evidence__gallery-item')).toHaveCount(1);
  await page.getByRole('button',{name:'حذف الصورة'}).click();
  await expect(page.locator('.folio-focus .folio-evidence__gallery-item')).toHaveCount(0);
  await page.locator('.folio-undo').getByRole('button',{name:'تراجع'}).click();
  await expect(page.locator('.folio-focus .folio-evidence__gallery-item')).toHaveCount(1);
});

test('custom criterion deletion is reversible with its name, own witness and photo',async({page,context,baseURL})=>{
  await sameOriginOnly(context,baseURL);
  await page.goto(entry);await ready(page);
  await page.getByRole('button',{name:'+ إضافة قسم خاص'}).click();
  await page.getByRole('textbox',{name:'اسم القسم في ملفي'}).fill('مبادراتي الخاصة');
  await page.getByRole('textbox',{name:'اسم القسم في ملفي'}).blur();
  await page.getByRole('button',{name:'+ شاهد جديد'}).click();
  await page.getByRole('textbox',{name:'عنوان الشاهد'}).fill('مشروع القراءة');
  await page.getByRole('textbox',{name:'عنوان الشاهد'}).blur();
  const tiny=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4//8/AwAI/AL+SY4UiwAAAABJRU5ErkJggg==','base64');
  await page.locator('input[data-change="photo"]').setInputFiles({name:'initiative.png',mimeType:'image/png',buffer:tiny});
  await page.getByRole('button',{name:'حذف القسم الخاص'}).click();
  await expect(page.locator('.folio-criteria__item')).toHaveCount(11);
  await page.locator('.folio-undo').getByRole('button',{name:'تراجع'}).click();
  await expect(page.locator('.folio-criteria__item')).toHaveCount(12);
  await expect(page.locator('.folio-criteria__item').last()).toContainText('مبادراتي الخاصة');
  await expect(page.getByRole('textbox',{name:'عنوان الشاهد'})).toHaveValue('مشروع القراءة');
  await expect(page.locator('.folio-focus .folio-evidence__gallery-item')).toHaveCount(1);
});

test('annual portfolio assembles custom and template witnesses across criteria into one ordered printable file',async({page,context,baseURL},info)=>{
  await sameOriginOnly(context,baseURL);
  await page.goto(entry);await ready(page);
  await expect(page.locator('[data-folio-focus]')).toBeVisible();
  await expect(page.locator('[data-folio-document]')).toBeHidden();
  const sourceBefore=await page.evaluate(async()=>JSON.stringify((await import('/src/store.js')).state));
  await chooseCriterion(page,'04');
  await page.locator('[data-library-card]').filter({hasText:'التعلم باللعب'}).click();
  await page.locator('[data-act="toggle-witness-in-file"]').click();
  await expect(page.locator('[data-act="toggle-witness-in-file"]')).toHaveAttribute('aria-pressed','true');
  await page.getByRole('textbox',{name:'عنوان الشاهد'}).fill('استراتيجية اللعب المحررة');
  await page.getByRole('textbox',{name:'عنوان الشاهد'}).blur();
  await page.getByRole('button',{name:'+ شاهد جديد'}).click();
  await page.getByRole('textbox',{name:'عنوان الشاهد'}).fill('نشاط خاص إضافي');
  await page.getByRole('textbox',{name:'عنوان الشاهد'}).blur();
  await page.getByRole('textbox',{name:'وصف الشاهد'}).fill('وصف تجريبي لأنشطة المعلم.');
  await page.getByRole('textbox',{name:'وصف الشاهد'}).blur();
  const tiny=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4//8/AwAI/AL+SY4UiwAAAABJRU5ErkJggg==','base64');
  await page.locator('input[data-change="photo"]').setInputFiles({name:'extra-witness.png',mimeType:'image/png',buffer:tiny});
  await chooseCriterion(page,'07');
  await page.locator('[data-library-card]').filter({hasText:'الألعاب التعليمية الرقمية'}).click();
  await page.locator('[data-act="toggle-witness-in-file"]').click();
  await chooseCriterion(page,'09');
  await page.locator('input[data-change="photo"]').setInputFiles([
    {name:'chart-photo-1.png',mimeType:'image/png',buffer:tiny},
    {name:'chart-photo-2.png',mimeType:'image/png',buffer:tiny},
  ]);
  await expect(page.locator('.folio-focus .folio-evidence__chart')).toBeVisible();
  await page.locator('.folio-criteria__all').click();
  await expect(page.locator('[data-folio-document]')).toBeVisible();
  await expect(page.locator('[data-folio-focus]')).toBeHidden();
  await expect(page.locator('.folio-contents__rows')).toContainText('التنوع في استراتيجيات التدريس');
  await expect(page.locator('.folio-document')).toContainText('استراتيجية اللعب المحررة');
  await expect(page.locator('.folio-document')).toContainText('نشاط خاص إضافي');
  await expect(page.locator('.folio-document')).toContainText('الألعاب التعليمية الرقمية');
  const pages=page.locator('[data-portfolio-page]');
  const numbers=await pages.evaluateAll(rows=>rows.map(r=>Number(r.dataset.portfolioPage)));
  expect(numbers).toEqual(Array.from({length:numbers.length},(_,i)=>i+1));
  expect(numbers.length).toBeGreaterThanOrEqual(8);
  await expect(page.getByRole('button',{name:'مشاركة الرابط'})).toBeDisabled();
  await expect(page.getByRole('button',{name:'رمز QR'})).toBeDisabled();
  const sourceAfter=await page.evaluate(async()=>JSON.stringify((await import('/src/store.js')).state));
  expect(sourceAfter).toBe(sourceBefore);
  await page.emulateMedia({media:'print'});
  const overflows=await page.evaluate(()=>[...document.querySelectorAll('.folio-export-witness')].flatMap(sheet=>{
    const foot=sheet.querySelector('.folio-sheet__footer'),limit=foot?.getBoundingClientRect().top??Infinity;
    return [...sheet.querySelectorAll('.folio-evidence__gallery,.folio-evidence__metrics,.folio-evidence__chart,.folio-evidence__table,.folio-evidence__steps')]
      .filter(el=>{const css=getComputedStyle(el);return css.display!=='none';})
      .filter(el=>el.getBoundingClientRect().bottom>limit-4)
      .map(el=>({page:sheet.dataset.portfolioPage,section:el.className,
        by:Math.round(el.getBoundingClientRect().bottom-limit)}));
  }));
  expect(overflows).toEqual([]);
  const pdf=await page.pdf({path:info.outputPath('complete-annual-portfolio.pdf'),preferCSSPageSize:true,printBackground:true});
  expect((pdf.toString('latin1').match(/\/Type\s*\/Page\b/g)||[]).length).toBe(numbers.length);
  await page.emulateMedia({media:'screen'});
  await page.locator('.folio-criteria__item[data-id="04"]').click();
  await expect(page.locator('[data-folio-focus]')).toBeVisible();
  await expect(page.locator('[data-folio-document]')).toBeHidden();
});

test('criteria edit action is visible beside the section and checkmark controls inclusion on mobile',async({page,context,baseURL},info)=>{
 await sameOriginOnly(context,baseURL);
 await page.setViewportSize({width:390,height:844});
 await page.goto(entry);await ready(page);
 await page.locator('[data-act="toggle-criteria"]').click();
 const row=page.locator('.folio-criteria__row').filter({has:page.locator('.folio-criteria__item[data-id="04"]')});
 await expect(page.locator('.folio-criteria__legend')).toContainText('علامة الصح');
 await expect(row.getByRole('button',{name:/تعديل اسم/})).toBeVisible();
 const checked=row.getByRole('checkbox',{name:/إدراج/});
 await expect(checked).toBeChecked();
 await checked.uncheck();
 await expect(checked).not.toBeChecked();
 await expect(page.locator('.folio-contents__row')).toHaveCount(10);
 await expect(row.locator('.folio-criteria__item')).toHaveClass(/is-excluded/);
 await checked.check();
 await expect(checked).toBeChecked();
 await expect(page.locator('.folio-contents__row')).toHaveCount(11);
 await row.getByRole('button',{name:/تعديل اسم/}).click();
 await expect(row.locator('.folio-criteria__inline-editor')).toBeVisible();
 const name=row.getByRole('textbox',{name:'اسم القسم في ملفي'});
 await name.fill('استراتيجيات التعلم المخصصة');
 await name.blur();
 await expect(row.locator('.folio-criteria__item')).toContainText('استراتيجيات التعلم المخصصة');
 await expect(page.locator('.folio-contents')).toContainText('استراتيجيات التعلم المخصصة');
 await row.getByRole('button',{name:'تم',exact:true}).click();
 await expect(row.locator('.folio-criteria__inline-editor')).toHaveCount(0);
 await row.getByRole('button',{name:/تعديل اسم/}).click();
 await row.getByRole('button',{name:'الاسم الأصلي'}).click();
 await expect(row.locator('.folio-criteria__item')).toContainText('التنوع في استراتيجيات التدريس');
 await row.getByRole('button',{name:'تم',exact:true}).click();
 await page.getByRole('button',{name:'+ إضافة قسم خاص'}).click();
 const added=page.locator('.folio-criteria__row').filter({has:page.locator('.folio-criteria__item[data-id="12"]')});
 await expect(added.locator('.folio-criteria__inline-editor')).toBeVisible();
 await added.getByRole('textbox',{name:'اسم القسم في ملفي'}).fill('مبادرات المعلم');
 await added.getByRole('textbox',{name:'اسم القسم في ملفي'}).blur();
 await expect(added.locator('.folio-criteria__item')).toContainText('مبادرات المعلم');
 await added.getByRole('checkbox',{name:/إدراج/}).uncheck();
 await expect(added.locator('.folio-criteria__item')).toHaveClass(/is-excluded/);
 await added.getByRole('checkbox',{name:/إدراج/}).check();
 await page.locator('.folio-criteria').screenshot({path:info.outputPath('criteria-actions-mobile.png'),animations:'disabled'});
});

test('one criterion library supports individual hide, restore and adding back to the annual file',async({page,context,baseURL})=>{
 await sameOriginOnly(context,baseURL);
 await page.goto(entry);await ready(page);
 await chooseCriterion(page,'03');
 await expect(page.locator('[data-library-card]')).toHaveCount(3);
 const a='لقاءات أولياء الأمور',b='رسائل التوعية والتوجيه للأسر';
 await page.locator('[data-library-card]').filter({hasText:a}).click();
 await expect(page.locator('.folio-library__guidance')).toContainText('نموذج مقترح، وليس إثبات تنفيذ');
 await page.getByRole('button',{name:'إخفاء من مكتبتي'}).click();
 await page.locator('[data-library-card]').filter({hasText:b}).click();
 await page.getByRole('button',{name:'إخفاء من مكتبتي'}).click();
 await expect(page.locator('[data-library-card]')).toHaveCount(1);
 await page.locator('[data-act="library-filter"][data-id="hidden"]').click();
 await expect(page.locator('[data-library-card]')).toHaveCount(2);
 await page.locator('[data-library-card]').filter({hasText:a}).click();
 await expect(page.locator('[data-library-card]').filter({hasText:a})).toHaveCount(1);
 await expect(page.locator('[data-library-card]').filter({hasText:b})).toHaveCount(0);
 await page.getByRole('button',{name:/إظهار الشواهد المخفية/}).click();
 await expect(page.locator('[data-library-card]')).toHaveCount(3);
 await page.locator('[data-library-card]').filter({hasText:a}).click();
 await page.locator('[data-act="toggle-witness-in-file"]').click();
 await expect(page.locator('[data-act="toggle-witness-in-file"]')).toHaveAttribute('aria-pressed','true');
 await page.locator('[data-act="library-filter"][data-id="in-file"]').click();
 await expect(page.locator('[data-library-card]')).toHaveCount(1);
 await expect(page.locator('[data-library-card]')).toContainText(a);
 await page.locator('[data-act="toggle-witness-in-file"]').click();
 await expect(page.locator('[data-library-card]')).toHaveCount(0);
 await page.locator('[data-act="library-filter"][data-id="templates"]').click();
 await page.locator('[data-library-card]').filter({hasText:a}).click();
 await page.locator('[data-act="toggle-witness-in-file"]').click();
 await page.locator('[data-act="show-full-portfolio"]').first().click();
 await expect(page.locator('[data-folio-document]')).toContainText(a);
});
test('criterion editing is a pen icon only with accessible descriptive name',async({page,context,baseURL})=>{
 await sameOriginOnly(context,baseURL);
 await page.setViewportSize({width:390,height:844});
 await page.goto(entry);await ready(page);
 await page.locator('[data-act="toggle-criteria"]').click();
 const edit=page.locator('[data-act="edit-criterion-row"][data-id="04"]');
 await expect(edit).toBeVisible();
 await expect(edit).toHaveText('✎');
 await expect(edit).toHaveAttribute('aria-label',/تعديل اسم/);
 await edit.click();
 await expect(page.locator('.folio-criteria__row').filter({has:page.locator('.folio-criteria__item[data-id="04"]')})
   .locator('.folio-criteria__inline-editor')).toBeVisible();
});

test('F09 saves witness text, owned photos and criterion customizations across a full reload',async({page,context,baseURL})=>{
  await sameOriginOnly(context,baseURL);
  await page.goto(entry);await ready(page);
  const before=await page.evaluate(async()=>JSON.stringify((await import('/src/store.js')).state));
  await chooseCriterion(page,'04');
  await page.getByRole('button',{name:'+ شاهد جديد'}).click();
  await page.getByRole('textbox',{name:'عنوان الشاهد'}).fill('مشروعي المحفوظ');
  await page.getByRole('textbox',{name:'عنوان الشاهد'}).blur();
  await page.getByRole('textbox',{name:'وصف الشاهد'}).fill('تجربة تجريبية بقيت بعد التحديث.');
  await page.getByRole('textbox',{name:'وصف الشاهد'}).blur();
  const tiny=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4//8/AwAI/AL+SY4UiwAAAABJRU5ErkJggg==','base64');
  await page.locator('input[data-change="photo"]').setInputFiles(
    {name:'persisted-synthetic.png',mimeType:'image/png',buffer:tiny});
  await page.locator('input[data-change="criterion-inclusion"][data-id="02"]').uncheck();
  await page.locator('[data-act="edit-criterion-row"][data-id="04"]').click();
  await page.getByRole('textbox',{name:'اسم القسم في ملفي'}).fill('استراتيجياتي المخصصة');
  await page.getByRole('textbox',{name:'اسم القسم في ملفي'}).blur();
  await expect(page.locator('[data-portfolio-save-status]')).toContainText('محفوظ على هذا الجهاز فقط',{timeout:15000});
  const snapshot=await page.evaluate(async()=>{
    const m=await import('/src/lib/portfolio-local-draft.js');
    const s=await import('/src/store.js');
    const scope=m.portfolioLocalScope(s.getActiveWorkspace(),s.activeYear());
    const saved=await m.loadPortfolioLocal(scope);
    return {revision:saved.revision,photos:saved.payload?.photos?.length,
      imageCount:saved.images.size,scope:scope.type};
  });
  expect(snapshot.revision).toBeGreaterThan(0);
  expect(snapshot.imageCount).toBe(1);
  expect(snapshot.scope).toBe('demo');
  await page.reload();await ready(page);
  await expect(page.locator('[data-portfolio-save-status]')).toContainText('محفوظ على هذا الجهاز فقط');
  await expect(page.locator('input[data-change="criterion-inclusion"][data-id="02"]')).not.toBeChecked();
  await expect(page.locator('.folio-criteria__item[data-id="04"]')).toContainText('استراتيجياتي المخصصة');
  await expect(page.getByRole('textbox',{name:'عنوان الشاهد'})).toHaveValue('مشروعي المحفوظ');
  await expect(page.getByRole('textbox',{name:'وصف الشاهد'})).toHaveValue('تجربة تجريبية بقيت بعد التحديث.');
  await expect(page.locator('.folio-focus .folio-evidence__gallery-item')).toHaveCount(1);
  await expect(page.locator('.folio-focus .folio-evidence__photo')).toHaveJSProperty('naturalWidth',1);
  const after=await page.evaluate(async()=>JSON.stringify((await import('/src/store.js')).state));
  expect(after).toBe(before);
  await page.getByRole('button',{name:'حذف الصورة'}).click();
  await expect(page.locator('[data-portfolio-save-status]')).toContainText('محفوظ على هذا الجهاز فقط');
  await page.reload();await ready(page);
  await expect(page.getByRole('textbox',{name:'عنوان الشاهد'})).toHaveValue('مشروعي المحفوظ');
  await expect(page.locator('.folio-focus .folio-evidence__gallery-item')).toHaveCount(0);
  const remaining=await page.evaluate(async()=>{
    const s=await import('/src/store.js'),p=await import('/src/lib/portfolio-local-draft.js');
    return (await p.loadPortfolioLocal(p.portfolioLocalScope(s.getActiveWorkspace(),s.activeYear()))).images.size;
  });
  expect(remaining).toBe(0);
});

test('F09 refuses a stale tab save rather than overwriting the other tab',async({page,context,baseURL})=>{
  await sameOriginOnly(context,baseURL);
  await page.goto(entry);await ready(page);
  const other=await context.newPage();
  await other.goto(entry);await ready(other);
  await chooseCriterion(page,'04');
  await page.getByRole('button',{name:'+ شاهد جديد'}).click();
  await page.getByRole('textbox',{name:'عنوان الشاهد'}).fill('ملف التبويب الأول');
  await page.getByRole('textbox',{name:'عنوان الشاهد'}).blur();
  await page.getByRole('textbox',{name:'وصف الشاهد'}).fill('حفظ موثق على الجهاز.');
  await page.getByRole('textbox',{name:'وصف الشاهد'}).blur();
  await expect(page.locator('[data-portfolio-save-status]')).toContainText('محفوظ على هذا الجهاز فقط');
  await chooseCriterion(other,'07');
  await expect(other.locator('[data-portfolio-save-status]')).toContainText('تعارض تعديل من تبويب آخر');
  const snapshot=await other.evaluate(async()=>{
    const s=await import('/src/store.js'),p=await import('/src/lib/portfolio-local-draft.js');
    return (await p.loadPortfolioLocal(p.portfolioLocalScope(s.getActiveWorkspace(),s.activeYear()))).payload;
  });
  expect(snapshot.customWitnesses.some(w=>w.title==='شاهد جديد')).toBe(true);
  await other.reload();await ready(other);
  await chooseCriterion(other,'04');
  await expect(other.getByRole('textbox',{name:'عنوان الشاهد'})).toHaveValue('ملف التبويب الأول');
  await other.close();
});

test('F09 isolates synthetic owners and years without touching the product database',async({page,context,baseURL})=>{
  await sameOriginOnly(context,baseURL);
  await page.goto(entry);await ready(page);
  const result=await page.evaluate(async()=>{
    const p=await import('/src/lib/portfolio-local-draft.js');
    const user=a=>({type:'account',databaseName:'rakeezx-user-'+a.repeat(32),authUserId:a});
    const one=p.portfolioLocalScope(user('a'),{id:'year-1'});
    const otherOwner=p.portfolioLocalScope(user('b'),{id:'year-1'});
    const anotherYear=p.portfolioLocalScope(user('a'),{id:'year-2'});
    const payload={photos:[],criterionNames:[['01','Synthetic']],customWitnesses:[]};
    const receipt=await p.savePortfolioLocal(one,{payload,expectedRevision:0});
    const first=await p.loadPortfolioLocal(one);
    const isolated=await p.loadPortfolioLocal(otherOwner);
    const year=await p.loadPortfolioLocal(anotherYear);
    let conflict=null;
    try{await p.savePortfolioLocal(one,{payload:{...payload,criterionNames:[]},expectedRevision:0})}
    catch(e){conflict=e.code}
    await p.removePortfolioLocal(one,{expectedRevision:receipt.revision});
    const deleted=await p.loadPortfolioLocal(one);
    return {first:first.payload.criterionNames,other:isolated.payload,year:year.payload,
      conflict,deleted:deleted.payload};
  });
  expect(result.first).toEqual([['01','Synthetic']]);
  expect(result.other).toBeNull();
  expect(result.year).toBeNull();
  expect(result.conflict).toBe('PORTFOLIO_LOCAL_CONFLICT');
  expect(result.deleted).toBeNull();
});

test('F09 removes deleted personal photos from disk while allowing the in-page undo to restore them',async({page,context,baseURL})=>{
 await sameOriginOnly(context,baseURL);
 await page.goto(entry);await ready(page);
 await chooseCriterion(page,'04');
 await page.getByRole('button',{name:'+ شاهد جديد'}).click();
 await page.getByRole('textbox',{name:'عنوان الشاهد'}).fill('شاهد يُحذف ويُستعاد');
 await page.getByRole('textbox',{name:'عنوان الشاهد'}).blur();
 const tiny=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4//8/AwAI/AL+SY4UiwAAAABJRU5ErkJggg==','base64');
 await page.locator('input[data-change="photo"]').setInputFiles(
   {name:'disposable.png',mimeType:'image/png',buffer:tiny});
 await expect(page.locator('[data-portfolio-save-status]')).toContainText('محفوظ على هذا الجهاز فقط');
 const imageCount=async()=>page.evaluate(async()=>{
   const s=await import('/src/store.js'),p=await import('/src/lib/portfolio-local-draft.js');
   const x=await p.loadPortfolioLocal(p.portfolioLocalScope(s.getActiveWorkspace(),s.activeYear()));
   return {count:x.images.size,personal:x.payload.customWitnesses.length,refs:x.payload.photos.length};
 });
 expect((await imageCount()).count).toBe(1);
 await page.getByRole('button',{name:'حذف شاهدي'}).click();
 await expect(page.locator('[data-portfolio-save-status]')).toContainText('محفوظ على هذا الجهاز فقط');
 expect(await imageCount()).toEqual({count:0,personal:0,refs:0});
 await page.locator('.folio-undo').getByRole('button',{name:'تراجع'}).click();
 await expect(page.locator('.folio-focus .folio-evidence__gallery-item')).toHaveCount(1);
 await expect(page.locator('[data-portfolio-save-status]')).toContainText('محفوظ على هذا الجهاز فقط');
 expect((await imageCount()).count).toBe(1);
 await page.reload();await ready(page);
 await expect(page.getByRole('textbox',{name:'عنوان الشاهد'})).toHaveValue('شاهد يُحذف ويُستعاد');
 await expect(page.locator('.folio-focus .folio-evidence__gallery-item')).toHaveCount(1);
 await page.getByRole('button',{name:'حذف شاهدي'}).click();
 await expect(page.locator('[data-portfolio-save-status]')).toContainText('محفوظ على هذا الجهاز فقط');
 expect((await imageCount()).count).toBe(0);
 await page.reload();await ready(page);
 await chooseCriterion(page,'04');
 await page.getByRole('button',{name:'شواهدي'}).click();
 await expect(page.locator('[data-library-card]')).toHaveCount(0);
 expect((await imageCount()).count).toBe(0);
});
