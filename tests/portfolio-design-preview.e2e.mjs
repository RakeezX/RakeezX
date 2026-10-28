import { test as base, expect } from '@playwright/test';
import { withIsolatedLocalBrowser } from 'C:/Users/Abody/Projects/RakeezX/scripts/ops-supervisor-v4/isolated-local-browser.mjs';
// AI N126: canonical isolated phase owns fresh contexts; Playwright owns and
// tears down the unique task HTTP server. No shared/live browser is attached.
const test = base.extend({
 isolatedBrowser: async ({baseURL}, use) => {
   await withIsolatedLocalBrowser({
     taskFile:'C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/continuous-n126-f09-documented-work-suggestions-20261027.json',
     runId:'197d3648-99e4-4083-9b32-003033a1397e',url:baseURL,timeoutMs:120000,
   }, async ({createContext}) => use({newContext: async ({serviceWorkers, ...visual}={}) => {
     if(serviceWorkers && serviceWorkers!=='block')throw Error('Service Workers must stay blocked');
     return createContext(visual);
   }}));
 },
 context: async ({isolatedBrowser},use) => {
   const context=await isolatedBrowser.newContext({locale:'ar-SA'});
   try {await use(context);} finally {await context.close();}
 },
 page: async ({context},use) => {
   const page=await context.newPage();
   try {await use(page);} finally {await page.close();}
 },
});
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
 await page.goto(new URL(entry,baseURL).href);
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
 await page.goto(new URL(entry,baseURL).href);await ready(page);
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
 await page.goto(new URL(entry,baseURL).href); await ready(page);
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
 await page.goto(new URL(entry,baseURL).href); await ready(page);
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
 await page.goto(new URL(entry,baseURL).href);await ready(page);
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
 await page.goto(new URL(entry,baseURL).href);await ready(page);
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
 await page.goto(new URL(entry,baseURL).href);await ready(page);
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
 await page.goto(new URL(entry,baseURL).href);await ready(page);
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
 await page.goto(new URL(entry,baseURL).href);await ready(page);
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
 await page.goto(new URL(entry,baseURL).href);await ready(page);
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
 await page.goto(new URL(entry,baseURL).href);await ready(page);
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
  await page.goto(new URL(entry,baseURL).href);await ready(page);
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
  await page.goto(new URL(entry,baseURL).href);await ready(page);
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
  await page.goto(new URL(entry,baseURL).href);await ready(page);
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
 await page.goto(new URL(entry,baseURL).href);await ready(page);
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
 await page.goto(new URL(entry,baseURL).href);await ready(page);
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
 await page.goto(new URL(entry,baseURL).href);await ready(page);
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
  await page.goto(new URL(entry,baseURL).href);await ready(page);
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
  await page.goto(new URL(entry,baseURL).href);await ready(page);
  const other=await context.newPage();
  await other.goto(new URL(entry,baseURL).href);await ready(other);
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
  await page.goto(new URL(entry,baseURL).href);await ready(page);
  const result=await page.evaluate(async()=>{
    const p=await import('/src/lib/portfolio-local-draft.js');
    const user=a=>({type:'account',databaseName:'rakeezx-user-'+a.repeat(32),authUserId:a});
    const one=p.portfolioLocalScope(user('a'),{id:'year-1'});
    const otherOwner=p.portfolioLocalScope(user('b'),{id:'year-1'});
    const anotherYear=p.portfolioLocalScope(user('a'),{id:'year-2'});
    const payload={photos:[],criterionNames:[['01','Synthetic']],customWitnesses:[],contexts:[['template:01:official-assignments',{action:'owned context'}]]};
    const receipt=await p.savePortfolioLocal(one,{payload,expectedRevision:0});
    const first=await p.loadPortfolioLocal(one);
    const isolated=await p.loadPortfolioLocal(otherOwner);
    const year=await p.loadPortfolioLocal(anotherYear);
    let conflict=null;
    try{await p.savePortfolioLocal(one,{payload:{...payload,criterionNames:[]},expectedRevision:0})}
    catch(e){conflict=e.code}
    await p.removePortfolioLocal(one,{expectedRevision:receipt.revision});
    const deleted=await p.loadPortfolioLocal(one);
    return {context:first.payload.contexts,first:first.payload.criterionNames,other:isolated.payload,year:year.payload,
      conflict,deleted:deleted.payload};
  });
  expect(result.first).toEqual([['01','Synthetic']]);
  expect(result.context).toEqual([['template:01:official-assignments',{action:'owned context'}]]);
  expect(result.other).toBeNull();
  expect(result.year).toBeNull();
  expect(result.conflict).toBe('PORTFOLIO_LOCAL_CONFLICT');
  expect(result.deleted).toBeNull();
});

test('F09 removes deleted personal photos from disk while allowing the in-page undo to restore them',async({page,context,baseURL})=>{
 await sameOriginOnly(context,baseURL);
 await page.goto(new URL(entry,baseURL).href);await ready(page);
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

test('F09 local safety archive downloads and restores original witness with its image after a deliberate confirmation',async({page,context,baseURL})=>{
 await sameOriginOnly(context,baseURL);
 await page.goto(new URL(entry,baseURL).href);await ready(page);
 await chooseCriterion(page,'04');
 await page.getByRole('button',{name:'+ شاهد جديد'}).click();
 await page.getByRole('textbox',{name:'عنوان الشاهد'}).fill('الشاهد قبل النسخ');
 await page.getByRole('textbox',{name:'عنوان الشاهد'}).blur();
 await page.getByRole('textbox',{name:'وصف الشاهد'}).fill('شاهد اختباري بالصورة قبل الاستعادة');
 await page.getByRole('textbox',{name:'وصف الشاهد'}).blur();
 const tiny=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4//8/AwAI/AL+SY4UiwAAAABJRU5ErkJggg==','base64');
 await page.locator('input[data-change="photo"]').setInputFiles({
   name:'teacher-demo.png',mimeType:'image/png',buffer:tiny,
 });
 await expect(page.locator('[data-portfolio-save-status]')).toContainText('محفوظ على هذا الجهاز فقط');
 const downloadEvent=page.waitForEvent('download');
 await page.locator('[data-act="export-portfolio-archive"]').click();
 const downloaded=await downloadEvent;
 expect(downloaded.suggestedFilename()).toMatch(/^rakeez-portfolio-.*\.json$/);
 const bytes=await (await import('node:fs/promises')).readFile(await downloaded.path());
 const savedFile=JSON.parse(bytes.toString('utf8'));
 expect(savedFile.kind).toBe('rakeezx-f09-local-archive');
 expect(savedFile.attachments).toHaveLength(1);
 expect(savedFile.payload.customWitnesses).toHaveLength(1);
 await page.getByRole('textbox',{name:'عنوان الشاهد'}).fill('عنوان أحدث سيستبدل عند الاستعادة');
 await page.getByRole('textbox',{name:'عنوان الشاهد'}).blur();
 await expect(page.locator('[data-portfolio-save-status]')).toContainText('محفوظ على هذا الجهاز فقط');
 await page.locator('input[data-change="read-portfolio-archive"]').setInputFiles({
   name:'rakeez-portfolio-test.json',mimeType:'application/json',buffer:bytes,
 });
 await expect(page.locator('.folio-local-archive__confirmation')).toBeVisible();
 await expect(page.locator('.folio-local-archive__confirmation')).toContainText('١ صور');
 await expect(page.getByRole('textbox',{name:'عنوان الشاهد'}))
   .toHaveValue('عنوان أحدث سيستبدل عند الاستعادة');
 await page.locator('[data-act="confirm-portfolio-archive"]').click();
 await expect(page.locator('.folio-local-archive__confirmation')).toHaveCount(0);
 await expect(page.locator('[data-portfolio-save-status]')).toContainText('محفوظ على هذا الجهاز فقط');
 await expect(page.getByRole('textbox',{name:'عنوان الشاهد'})).toHaveValue('الشاهد قبل النسخ');
 await expect(page.locator('.folio-focus .folio-evidence__gallery-item')).toHaveCount(1);
 await page.reload();await ready(page);
 await expect(page.getByRole('textbox',{name:'عنوان الشاهد'})).toHaveValue('الشاهد قبل النسخ');
 await expect(page.locator('.folio-focus .folio-evidence__gallery-item')).toHaveCount(1);
});

test('F09 rejects a foreign or tampered portable copy, and cancel never overwrites local edits',async({page,context,baseURL})=>{
 await sameOriginOnly(context,baseURL);
 await page.goto(new URL(entry,baseURL).href);await ready(page);
 await chooseCriterion(page,'04');
 await page.getByRole('button',{name:'+ شاهد جديد'}).click();
 await page.getByRole('textbox',{name:'عنوان الشاهد'}).fill('الأصل المحفوظ');
 await page.getByRole('textbox',{name:'عنوان الشاهد'}).blur();
 await page.getByRole('textbox',{name:'وصف الشاهد'}).fill('بيانات تجريبية للحماية.');
 await page.getByRole('textbox',{name:'وصف الشاهد'}).blur();
 await expect(page.locator('[data-portfolio-save-status]')).toContainText('محفوظ على هذا الجهاز فقط');
 const d=page.waitForEvent('download');
 await page.locator('[data-act="export-portfolio-archive"]').click();
 const download=await d;
 const original=JSON.parse((await (await import('node:fs/promises')).readFile(await download.path())).toString('utf8'));
 const foreign=structuredClone(original);
 foreign.scope.ownerId='foreign-teacher';
 await page.locator('input[data-change="read-portfolio-archive"]').setInputFiles({
   name:'foreign.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(foreign)),
 });
 await expect(page.locator('.folio-local-archive__error')).toContainText('حسابًا أو عامًا دراسيًا مختلفًا');
 await expect(page.locator('.folio-local-archive__confirmation')).toHaveCount(0);
 const tampered=structuredClone(original);tampered.payload.titles=[['custom:04:other','مُعدل']];
 await page.locator('input[data-change="read-portfolio-archive"]').setInputFiles({
   name:'tampered.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(tampered)),
 });
 await expect(page.locator('.folio-local-archive__error')).toContainText('تعذّر التحقق');
 await page.locator('input[data-change="read-portfolio-archive"]').setInputFiles({
   name:'valid.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(original)),
 });
 await expect(page.locator('.folio-local-archive__confirmation')).toBeVisible();
 await page.locator('[data-act="cancel-portfolio-archive"]').click();
 await expect(page.locator('.folio-local-archive__confirmation')).toHaveCount(0);
 await expect(page.getByRole('textbox',{name:'عنوان الشاهد'})).toHaveValue('الأصل المحفوظ');
 await page.reload();await ready(page);
 await expect(page.getByRole('textbox',{name:'عنوان الشاهد'})).toHaveValue('الأصل المحفوظ');
});

test('F09 refuses restoring a backup preview after newer edits have been saved',async({page,context,baseURL})=>{
 await sameOriginOnly(context,baseURL);
 await page.goto(new URL(entry,baseURL).href);await ready(page);
 await chooseCriterion(page,'04');
 await page.getByRole('button',{name:'+ شاهد جديد'}).click();
 await page.getByRole('textbox',{name:'عنوان الشاهد'}).fill('النسخة الأقدم');
 await page.getByRole('textbox',{name:'عنوان الشاهد'}).blur();
 await page.getByRole('textbox',{name:'وصف الشاهد'}).fill('وثيقة اصطناعية.');
 await page.getByRole('textbox',{name:'وصف الشاهد'}).blur();
 await expect(page.locator('[data-portfolio-save-status]')).toContainText('محفوظ على هذا الجهاز فقط');
 const d=page.waitForEvent('download');
 await page.locator('[data-act="export-portfolio-archive"]').click();
 const archived=await d;
 const bytes=await (await import('node:fs/promises')).readFile(await archived.path());
 await page.locator('input[data-change="read-portfolio-archive"]').setInputFiles({
   name:'backup.json',mimeType:'application/json',buffer:bytes,
 });
 await expect(page.locator('.folio-local-archive__confirmation')).toBeVisible();
 await page.getByRole('textbox',{name:'عنوان الشاهد'}).fill('التعديل الأحدث يجب حفظه');
 await page.getByRole('textbox',{name:'عنوان الشاهد'}).blur();
 await expect(page.locator('[data-portfolio-save-status]')).toContainText('محفوظ على هذا الجهاز فقط');
 await page.locator('[data-act="confirm-portfolio-archive"]').click();
 await expect(page.locator('.folio-local-archive__error')).toContainText('تغيّرت المسودة');
 await expect(page.getByRole('textbox',{name:'عنوان الشاهد'})).toHaveValue('التعديل الأحدث يجب حفظه');
 await page.reload();await ready(page);
 await expect(page.getByRole('textbox',{name:'عنوان الشاهد'})).toHaveValue('التعديل الأحدث يجب حفظه');
});

test('F09 portable copy can restore into a clean separate browser context for the same synthetic year',async({page,context,isolatedBrowser,baseURL})=>{
 await sameOriginOnly(context,baseURL);
 await page.goto(new URL(entry,baseURL).href);await ready(page);
 await chooseCriterion(page,'04');
 await page.getByRole('button',{name:'+ شاهد جديد'}).click();
 await page.getByRole('textbox',{name:'عنوان الشاهد'}).fill('ملف المعلم في متصفح آخر');
 await page.getByRole('textbox',{name:'عنوان الشاهد'}).blur();
 await page.getByRole('textbox',{name:'وصف الشاهد'}).fill('اختبار جهاز اصطناعي مستقل.');
 await page.getByRole('textbox',{name:'وصف الشاهد'}).blur();
 const tiny=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4//8/AwAI/AL+SY4UiwAAAABJRU5ErkJggg==','base64');
 await page.locator('input[data-change="photo"]').setInputFiles({name:'other-browser.png',mimeType:'image/png',buffer:tiny});
 await expect(page.locator('[data-portfolio-save-status]')).toContainText('محفوظ على هذا الجهاز فقط');
 await page.getByRole('textbox',{name:'العمل المنفذ فعليًا',exact:true}).fill('عمل تجريبي في السياق');
 await page.getByRole('textbox',{name:'العمل المنفذ فعليًا',exact:true}).blur();
 await expect(page.locator('[data-portfolio-save-status]')).toContainText('محفوظ على هذا الجهاز فقط');
 const wait=page.waitForEvent('download');
 await page.locator('[data-act="export-portfolio-archive"]').click();
 const dl=await wait,bytes=await (await import('node:fs/promises')).readFile(await dl.path());
 const clean=await isolatedBrowser.newContext({locale:'ar-SA',serviceWorkers:'block'});
 try{
   await sameOriginOnly(clean,baseURL);
   const fresh=await clean.newPage();
   await fresh.goto(new URL(entry,baseURL).href);await ready(fresh);
   await expect(fresh.getByRole('textbox',{name:'عنوان الشاهد'})).not.toHaveValue('ملف المعلم في متصفح آخر');
   await fresh.locator('input[data-change="read-portfolio-archive"]').setInputFiles({
     name:'portfolio.json',mimeType:'application/json',buffer:bytes,
   });
   await expect(fresh.locator('.folio-local-archive__confirmation')).toBeVisible();
   await fresh.locator('[data-act="confirm-portfolio-archive"]').click();
   await expect(fresh.locator('[data-portfolio-save-status]')).toContainText('محفوظ على هذا الجهاز فقط');
   await expect(fresh.getByRole('textbox',{name:'عنوان الشاهد'})).toHaveValue('ملف المعلم في متصفح آخر');
   await expect(fresh.getByRole('textbox',{name:'العمل المنفذ فعليًا',exact:true})).toHaveValue('عمل تجريبي في السياق');
   await expect(fresh.locator('.folio-focus .folio-evidence__gallery-item')).toHaveCount(1);
   await fresh.reload();await ready(fresh);
   await expect(fresh.getByRole('textbox',{name:'عنوان الشاهد'})).toHaveValue('ملف المعلم في متصفح آخر');
   await expect(fresh.getByRole('textbox',{name:'العمل المنفذ فعليًا',exact:true})).toHaveValue('عمل تجريبي في السياق');
   await expect(fresh.locator('.folio-focus .folio-evidence__photo')).toHaveJSProperty('naturalWidth',1);
   const restored=await fresh.evaluate(async()=>{
     const s=await import('/src/store.js'),p=await import('/src/lib/portfolio-local-draft.js');
     const saved=await p.loadPortfolioLocal(p.portfolioLocalScope(s.getActiveWorkspace(),s.activeYear()));
     return Array.from(new Uint8Array(await [...saved.images.values()][0].blob.arrayBuffer()));
   });
   expect(restored).toEqual([...tiny]);
 }finally{await clean.close();}
});

// AI N126: actual current-main entry gate and route cleanup, no personal account.
test('N126 direct Preview refuses unsupported local scope and leaves Reports and notification entry intact',async({page,context,baseURL})=>{
 await page.goto(new URL(entry,baseURL).href);
 // Vite DEV intentionally bootstraps the existing unclaimed legacy workspace;
 // it is not an account/demo scope and must never get a Portfolio editor.
 await expect(page.locator('h1')).toContainText('ملف الإنجاز');
 expect(await page.evaluate(async()=>{
   const s=await import('/src/store.js'),p=await import('/src/lib/portfolio-local-draft.js');
   return p.portfolioLocalScope(s.getActiveWorkspace(),s.activeYear());
 })).toBeNull();
 await expect(page.locator('[data-folio-focus]')).toHaveCount(0);
 await sameOriginOnly(context,baseURL);
 await page.reload();await ready(page);
 await expect(page.locator('[data-portfolio-save-status]')).toContainText('Preview');
 await expect(page.locator('.folio-toolbar__helper')).toContainText('هذا المتصفح ولهذا العام');
 await expect(page.locator('a[href="#/reports/portfolio-preview"]')).toHaveCount(0);
 await page.evaluate(()=>location.hash='#/reports');
 await page.locator('.report-grade-group__summary').first().click();
 await expect(page.locator('.report-class-row').first()).toBeVisible();
 await expect(page.locator('[data-folio-focus]')).toHaveCount(0);
 await expect(page.locator('link[data-rakeez-portfolio-style]')).toHaveCount(0);
 await page.evaluate(()=>location.hash='#/settings/notifications');
 await expect(page.locator('h1')).toContainText('الإشعارات');
 await expect(page.locator('link[data-rakeez-portfolio-style]')).toHaveCount(0);
 await page.evaluate(()=>location.hash='#/reports/portfolio-preview');await ready(page);
 await expect(page.locator('link[data-rakeez-portfolio-style]')).toHaveCount(1);
});

// AI N126: real application entry, source styles and handlers over loopback HTTP.
test('N126 cross-criterion search navigates every standard and preserves renamed hidden provenance and keyboard focus',async({page,context,baseURL})=>{
 test.setTimeout(90000);
 await sameOriginOnly(context,baseURL);
 await page.goto(new URL(entry,baseURL).href);await ready(page);
 const examples=await page.evaluate(async()=>{
  const {F09_EVIDENCE_TEMPLATES:t}=await import('/src/lib/portfolio-evidence-templates.js');
  return Array.from({length:11},(_,i)=>t.find(w=>w.criterion===String(i+1).padStart(2,'0')));
 });
 const search=page.getByRole('textbox',{name:'بحث في الشواهد'});
 await page.getByRole('button',{name:'نماذج جاهزة',exact:true}).click();
 for(const item of examples){
  await search.fill(item.title);
  const card=page.locator(`[data-library-card][data-id="${item.id}"]`);
  await expect(card).toContainText(item.criterion+' ·');
  await expect(card).toContainText('نموذج مقترح قابل للتعديل');
  await expect(search).toBeFocused();
  await card.click();
  await expect(page.locator(`.folio-criteria__item[data-id="${item.criterion}"]`)).toHaveClass(/is-selected/);
  await expect(page.getByRole('textbox',{name:'عنوان الشاهد',exact:true})).toHaveValue(item.title);
 }
 await page.getByRole('textbox',{name:'عنوان الشاهد',exact:true}).fill('اسم خاص مميز للبحث');
 await page.getByRole('textbox',{name:'عنوان الشاهد',exact:true}).blur();
 await page.getByRole('textbox',{name:'وصف الشاهد',exact:true}).fill('وصف خاص يمكن إيجاده');
 await page.getByRole('textbox',{name:'وصف الشاهد',exact:true}).blur();
 await search.fill('وصف خاص');
 await expect(page.locator('[data-library-card]')).toHaveCount(1);
 await expect(page.locator('[data-library-card]')).toContainText('اسم خاص مميز');
 await page.locator('[data-act="hide-witness"]').click();
 await page.getByRole('button',{name:/^المخفية/}).click();
 await expect(page.locator('[data-library-card]')).toHaveCount(1);
 await expect(page.locator('[data-library-card]')).toContainText('نموذج مقترح');
 await chooseCriterion(page,'01');
 await page.getByRole('button',{name:/^المخفية/}).click();
 await search.fill('اسم خاص مميز');
 await page.locator('[data-library-card]').click();
 await expect(page.locator('.folio-criteria__item[data-id="11"]')).toHaveClass(/is-selected/);
 await expect(page.getByRole('textbox',{name:'عنوان الشاهد',exact:true})).toHaveValue('اسم خاص مميز للبحث');
 await search.fill('اسم خاص');
 await page.getByRole('button',{name:/^ضمن ملفي/}).click();
 await expect(page.locator('[data-library-card]')).toHaveCount(0);
 await page.getByRole('button',{name:'الكل',exact:true}).click();
 await page.locator('[data-library-card]').click();
 await page.locator('[data-act="toggle-witness-in-file"]').click();
 await page.getByRole('button',{name:/^ضمن ملفي/}).click();
 await expect(page.locator('[data-library-card]')).toHaveCount(1);
 await search.fill('');
 await page.getByRole('button',{name:'نماذج جاهزة',exact:true}).click();
 const ids=await page.locator('[data-library-card]').evaluateAll(items=>items.map(n=>n.dataset.id));
 expect(ids.every(id=>id.startsWith('template:11:'))).toBe(true);
});

test('N126 optional context reloads and prints bounded A4 pages with chart and photos at 320 and 390px',async({page,context,baseURL},info)=>{
 test.setTimeout(90000);
 await sameOriginOnly(context,baseURL);
 await page.goto(new URL(entry,baseURL).href);await ready(page);
 await expect(page.locator('.folio-context-page')).toHaveCount(0);
 const before=await page.evaluate(async()=>JSON.stringify((await import('/src/store.js')).state));
 const fields=[['action','العمل المنفذ فعليًا',240],['activity','النشاط',120],['teaching','السياق التعليمي (الفصل / المادة)',180],['reflection','الأثر النوعي والتأمل المهني',300],['source','ملاحظة الدليل أو المصدر',200]];
 for(const [key,label,max] of fields){
  const input=page.getByRole('textbox',{name:label,exact:true});
  await input.fill(('سياق اصطناعي '+key+' ').repeat(30).slice(0,max));await input.blur();
  await expect(page.locator('[data-portfolio-save-status]')).toContainText('محفوظ على هذا الجهاز فقط');
 }
 const day=page.getByRole('textbox',{name:'تاريخ النشاط',exact:true});
 await expect(day).toHaveClass(/rakeez-datetime/);
 await day.fill('٢٠٢٦-١٠-٢٠');await day.press('Tab');
 await expect(day).toHaveValue('2026-10-20');
 await expect(page.locator('[data-portfolio-save-status]')).toContainText('محفوظ على هذا الجهاز فقط');
 const tiny=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4//8/AwAI/AL+SY4UiwAAAABJRU5ErkJggg==','base64');
 await page.locator('input[data-change="photo"]').setInputFiles(Array.from({length:6},(_,i)=>({name:`context-${i}.png`,mimeType:'image/png',buffer:tiny})));
 await expect(page.locator('[data-portfolio-save-status]')).toContainText('محفوظ على هذا الجهاز فقط');
 await page.reload();await ready(page);
 for(const [key,label] of fields)await expect(page.getByRole('textbox',{name:label,exact:true})).toHaveValue(new RegExp('سياق اصطناعي '+key));
 await expect(day).toHaveValue('2026-10-20');
 await expect(page.locator('.folio-context-page')).toHaveCount(1);
 await expect(page.locator('.folio-context-page dt')).toHaveCount(6);
 await expect(page.locator('.folio-export-witness .folio-evidence__chart')).toHaveCount(1);
 for(const width of [320,390]){
  await page.setViewportSize({width,height:844});
  await expect(page.getByRole('textbox',{name:'العمل المنفذ فعليًا',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.getByRole('textbox',{name:'بحث في الشواهد'}).pressSequentially('نشاط',{delay:35});
  await expect(page.getByRole('textbox',{name:'بحث في الشواهد'})).toBeFocused();
  await expect(page.getByRole('textbox',{name:'بحث في الشواهد'})).toHaveValue('نشاط');
  await page.getByRole('textbox',{name:'بحث في الشواهد'}).fill('');
  await page.screenshot({path:info.outputPath(`context-mobile-${width}.png`),fullPage:true});
  await page.locator('.folio-context-editor').screenshot({path:info.outputPath(`context-fields-${width}.png`)});
 }
 await page.setViewportSize({width:1280,height:900});
 await page.emulateMedia({media:'print'});
 await page.locator('.folio-context-page').screenshot({path:info.outputPath('context-a4-sheet.png')});
 const layout=await page.locator('.folio-context-page').evaluate(el=>({height:el.getBoundingClientRect().height,
  contentBottom:el.querySelector('dl').getBoundingClientRect().bottom,
  footerTop:el.querySelector('.folio-sheet__footer').getBoundingClientRect().top,
  overflow:el.scrollWidth>el.clientWidth||el.scrollHeight>el.clientHeight}));
 expect(layout.overflow).toBe(false);expect(layout.contentBottom).toBeLessThan(layout.footerTop);
 const sheets=page.locator('[data-folio-document] [data-portfolio-page]');
 const numbers=await sheets.evaluateAll(els=>els.map(e=>Number(e.dataset.portfolioPage)));
 expect(numbers).toEqual(numbers.map((_,i)=>i+1));
 const pdf=await page.pdf({path:info.outputPath('context-annual-a4.pdf'),preferCSSPageSize:true,printBackground:true});
 expect((pdf.toString('latin1').match(/\/Type\s*\/Page\b/g)||[]).length).toBe(numbers.length);
 expect(pdf.toString('latin1')).toMatch(/MediaBox\s*\[0 0 594\.95996 841\.91998\]/);
 await page.screenshot({path:info.outputPath('context-print.png'),fullPage:true});
 await page.emulateMedia({media:'screen'});
 await page.getByRole('textbox',{name:'ملاحظة الدليل أو المصدر',exact:true}).fill('');
 await page.getByRole('textbox',{name:'ملاحظة الدليل أو المصدر',exact:true}).blur();
 await expect(page.locator('.folio-context-page dt')).toHaveCount(5);
 expect(await page.evaluate(async()=>JSON.stringify((await import('/src/store.js')).state))).toBe(before);
});

test('N126 personal context deletion removes metadata from disk and undo returns it',async({page,context,baseURL})=>{
 await sameOriginOnly(context,baseURL);await page.goto(new URL(entry,baseURL).href);await ready(page);
 await page.getByRole('button',{name:'+ شاهد جديد'}).click();
 await page.getByRole('textbox',{name:'العمل المنفذ فعليًا',exact:true}).fill('عمل شخصي اصطناعي');
 await page.getByRole('textbox',{name:'العمل المنفذ فعليًا',exact:true}).blur();
 const savedContexts=async()=>page.evaluate(async()=>{
  const p=await import('/src/lib/portfolio-local-draft.js'),s=await import('/src/store.js');
  return (await p.loadPortfolioLocal(p.portfolioLocalScope(s.getActiveWorkspace(),s.activeYear()))).payload.contexts;
 });
 await expect(page.locator('[data-portfolio-save-status]')).toContainText('محفوظ على هذا الجهاز فقط');
 expect((await savedContexts()).length).toBe(1);
 await page.getByRole('button',{name:'حذف شاهدي'}).click();
 await expect(page.locator('[data-portfolio-save-status]')).toContainText('محفوظ على هذا الجهاز فقط');
 expect(await savedContexts()).toEqual([]);
 await page.locator('.folio-undo').getByRole('button',{name:'تراجع'}).click();
 await expect(page.getByRole('textbox',{name:'العمل المنفذ فعليًا',exact:true})).toHaveValue('عمل شخصي اصطناعي');
 await expect(page.locator('[data-portfolio-save-status]')).toContainText('محفوظ على هذا الجهاز فقط');
 expect((await savedContexts()).length).toBe(1);
 await page.getByRole('button',{name:'حذف شاهدي'}).click();
 await expect(page.locator('[data-portfolio-save-status]')).toContainText('محفوظ على هذا الجهاز فقط');
 await page.reload();await ready(page);
 expect(await savedContexts()).toEqual([]);
});

// AI N126: actual account UI -> existing store lease guard; never issue credentials.
test('N126 context account entry keeps the real lease guard and refuses an unauthenticated local save',async({page,context,baseURL})=>{
 await sameOriginOnly(context,baseURL);await page.goto(new URL(entry,baseURL).href);await ready(page);
 await page.evaluate(async()=>{
  const s=await import('/src/store.js');
  // Only a fresh synthetic browser's in-memory fixture changes identity.
  // No Product store is written and no cloud/session/lease guard is mocked.
  s.deactivateWorkspace('synthetic-test-transition');
  s.activateWorkspace({type:'account',databaseName:'rakeezx-user-'+'c'.repeat(32),
    authUserId:'synthetic-context-owner',broadcastChannelName:'synthetic-context-owner-channel'});
  s.state.years=[{id:'synthetic-context-year',label:'عام اصطناعي 1448'}];
  s.state.profile={teacherName:'معلم اصطناعي'};s.state.device={};
  s.state.ready=true;
  (await import('/src/repaint.js')).repaint();
 });
 await expect(page.getByRole('textbox',{name:'العمل المنفذ فعليًا',exact:true})).toBeVisible();
 await page.getByRole('textbox',{name:'العمل المنفذ فعليًا',exact:true}).fill('لا يجوز حفظه دون صلاحية الحساب');
 await page.getByRole('textbox',{name:'العمل المنفذ فعليًا',exact:true}).blur();
 await expect(page.locator('[data-portfolio-save-status]')).toContainText('تعذّر الحفظ المحلي');
 const result=await page.evaluate(async()=>{
  const s=await import('/src/store.js'),p=await import('/src/lib/portfolio-local-draft.js');
  const scope=p.portfolioLocalScope(s.getActiveWorkspace(),s.activeYear());
  return {type:s.getActiveWorkspace().type,scope:scope.ownerId,
    saved:(await p.loadPortfolioLocal(scope)).payload,lease:s.getOfflineLeaseStatus().state};
 });
 expect(result.type).toBe('account');expect(result.scope).toBe('synthetic-context-owner');
 expect(result.saved).toBeNull();expect(result.lease).toBe('LIMITED');
});


test('N126 recorded work uses actual caller and CSS, separates review/log provenance and prints only aggregate data without Product writes',async({page,context,baseURL},info)=>{
 await sameOriginOnly(context,baseURL);
 await page.goto(new URL(entry,baseURL).href);await ready(page);
 const yearId=await page.evaluate(async()=>{
   const s=await import('/src/store.js'),m=await import('/src/models.js');
   const yearId=s.activeYear().id;
   const date=new Date(Date.now()-86400000).toISOString().slice(0,10),stamp=Date.parse(date+'T08:00:00Z');
   const term=m.makeTerm({id:'recorded-term',yearId,index:4,startDate:date.slice(0,4)+'-01-01',endDate:date.slice(0,4)+'-12-31'});
   const section=m.makeSection({id:'recorded-section',yearId,grade:4,label:'هـ'});
   const subject=m.makeSubject({id:'recorded-subject',name:'مادة تجريبية'});
   const teaching=m.makeTeaching({id:'recorded-teaching',termId:term.id,sectionId:section.id,subjectId:subject.id});
   // Synthetic in-memory saved-record snapshot only. No store.save/db write.
   s.state.groupArrangements=[];s.state.classGoals=[];s.state.logs=[];
   s.state.terms.push(term);s.state.sections.push(section);s.state.subjects.push(subject);s.state.teachings.push(teaching);
   s.state.students.push(m.makeStudent({id:'DO-NOT-DISCLOSE-STUDENT',name:'عائلة سرية لا تظهر'}));
   s.state.enrollments.push(m.makeEnrollment({id:'recorded-enrollment',studentId:'DO-NOT-DISCLOSE-STUDENT',sectionId:section.id,startDate:term.startDate}));
   s.state.sessions.push(m.makeSession({id:'recorded-session',teachingId:teaching.id,date,status:'held'}));
   s.state.groupArrangements.push(m.makeGroupArrangement({teachingId:teaching.id,groups:[['DO-NOT-DISCLOSE-STUDENT']],updatedAt:stamp}));
   s.state.classGoals.push({id:'class-goal:'+teaching.id,teachingId:teaching.id,sessionId:'recorded-session',date,state:'completed',runId:'recorded-run',startedAt:stamp,completedAt:stamp+60000,text:'عائلة سرية لا تظهر'});
   s.state.logs.push({id:'DO-NOT-DISCLOSE-STUDENT-log',teachingId:teaching.id,sessionId:'recorded-session',studentId:'DO-NOT-DISCLOSE-STUDENT',date,kind:'participation',delta:1,note:'عائلة سرية لا تظهر'});
   const log=s.state.logs.at(-1);
   s.state.logs.push({...log,id:'foreign-log',ownerId:'foreign'}, {...log,id:'future-log',date:'2999-01-01'}, {...log,id:'deleted-log',deleted:true});
   (await import('/src/repaint.js')).repaint();
   return yearId;
 });
 const snapshot=()=>page.evaluate(async()=>{
   const s=await import('/src/store.js'),db=await import('/src/lib/db.js');
   const tables=['years','terms','sections','teachings','students','enrollments','groupArrangements','classGoals','sessions','logs','scores','outbox'];
   return {memory:JSON.stringify(s.state),disk:JSON.stringify(await Promise.all(tables.map(t=>db.getAll(t))))};
 });
 const before=await snapshot();
 const entries=[['09','group-arrangements','تنظيم المجموعات المحفوظ','سجل ركيز يحتاج استكمالًا'],
   ['08','completed-goals','سجل الأهداف الصفية المكتملة','سجل ركيز يحتاج استكمالًا'],
   ['09','participation-logs','متابعة سجلات المشاركة المؤرخة','سجل موثق من ركيز']];
 for(const [criterion,key,title,label] of entries){
   await chooseCriterion(page,criterion);
   const card=page.locator(`[data-library-card][data-id="rakeez:${key}:${yearId}"]`);
   await expect(card).toContainText(label);await card.click();
   await expect(page.getByRole('textbox',{name:'عنوان الشاهد',exact:true})).toHaveValue(title);
   if(key==='participation-logs')await expect(page.locator('.folio-focus .folio-evidence__metrics strong').first()).toHaveText('١');
   const toggle=page.locator('[data-act="toggle-witness-in-file"]');
   // Recorded sources retain existing automatic annual inclusion behavior.
   if(!(await toggle.innerText()).includes('ضمن الملف'))await toggle.click();
   await expect(toggle).toContainText('ضمن الملف');
 }
 await page.locator('[data-act="show-full-portfolio"]').first().click();
 for(const [, ,title] of entries)await expect(page.locator('[data-folio-document]')).toContainText(title);
 const rendered=await page.locator('[data-folio-document]').evaluate(n=>n.outerHTML);
 expect(rendered).not.toMatch(/DO-NOT-DISCLOSE|عائلة سرية|foreign-log|future-log|recorded-run/);
 await expect(page.locator('[data-folio-document]')).toContainText('لا تثبت استخدامها');
 await expect(page.locator('[data-folio-document]')).toContainText('لا يعني ذلك تحقق التعلم');
 await page.getByRole('button',{name:/PDF/}).click();
 await expect.poll(()=>page.evaluate(()=>window.__portfolioPrintCalls)).toBe(1);
 await page.emulateMedia({media:'print'});
 const pages=await page.locator('[data-portfolio-page]').count();
 const pdf=await page.pdf({path:info.outputPath('recorded-work-annual.pdf'),preferCSSPageSize:true,printBackground:true});
 expect((pdf.toString('latin1').match(/\/Type\s*\/Page\b/g)||[]).length).toBe(pages);
 await page.locator('[data-folio-document]').screenshot({path:info.outputPath('recorded-work-annual.png')});
 expect(await snapshot()).toEqual(before);
});
