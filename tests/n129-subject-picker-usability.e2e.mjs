import {test,expect} from '@playwright/test';
import {openReadyServedDemo} from './helpers/served-demo-readiness.mjs';

// Synthetic demo only. A touch viewport makes clipped nested scrolling visible.
test.use({viewport:{width:390,height:650},hasTouch:true,serviceWorkers:'block'});
test.beforeEach(async({context,baseURL})=>{
 await context.route('**/*',route=>
  new URL(route.request().url()).origin===new URL(baseURL).origin?
    route.continue():route.abort());
 await context.addInitScript(()=>{
  if(!sessionStorage.getItem('rakeezx-demo-session-v1'))
    sessionStorage.setItem('rakeezx-demo-session-v1','preparing');
 });
});
async function sheet(page){
 await openReadyServedDemo(page,process.env.RAKEEZX_E2E_BASE_URL);
 await page.getByRole('button',{name:/إضافة فصل|إنشاء أول فصل/,exact:true}).first().click();
 const dialog=page.getByRole('dialog');
 await expect(dialog.locator('[data-v6-program]')).toBeVisible();
 return dialog;
}
test('subject list keeps real options but removes version and guide marketing copy',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const d=await sheet(page);
 await expect(d.getByText('مواد هذا الصف — الإصدار السادس')).toHaveCount(0);
 await expect(d.getByText('يمكنك البحث في المواد أو إضافة مادة مخصصة.')).toHaveCount(0);
 await expect(d.getByRole('link',{name:/مصدر أسماء المواد/})).toHaveCount(0);
 await expect(d.locator('[data-v6-scope-hint]')).toBeHidden();
 await d.locator('[data-subject-trigger]').click();
 await expect(d.getByRole('option',{name:'المهارات الرقمية'})).toBeVisible();
 await expect(d.getByText('من الدليل',{exact:true})).toHaveCount(0);
 expect(errors).toEqual([]);
});
test('touch picker uses an accessible internal scroll area and exposes the last option',async({page})=>{
 const d=await sheet(page);
 await d.locator('[data-subject-trigger]').click();
 const menu=d.locator('[data-subject-menu]');
 const options=d.locator('[data-subject-options]');
 await expect(menu).toBeVisible();
 const start=await options.evaluate(el=>({scrollHeight:el.scrollHeight,clientHeight:el.clientHeight,scrollTop:el.scrollTop}));
 expect(start.scrollHeight).toBeGreaterThan(start.clientHeight+30);
 expect(start.clientHeight).toBeGreaterThan(125);
 const position=await d.evaluate(el=>{
  const m=el.querySelector('[data-subject-menu]').getBoundingClientRect();
  const body=el.querySelector('.sheet__body').getBoundingClientRect();
  return {top:m.top,bottom:m.bottom,bodyTop:body.top,bodyBottom:body.bottom};
 });
 expect(position.top).toBeGreaterThanOrEqual(position.bodyTop-4);
 expect(position.bottom).toBeLessThanOrEqual(position.bodyBottom+4);
 await options.evaluate(el=>el.scrollBy({top:el.scrollHeight,behavior:'instant'}));
 await expect.poll(()=>options.evaluate(el=>el.scrollTop)).toBeGreaterThan(40);
 await expect(d.locator('[data-subject-custom]')).toBeInViewport();
 await d.locator('[data-subject-custom]').click();
 await expect(d.locator('[data-subject-custom-fields]')).toBeVisible();
});
test('tap elsewhere inside same sheet closes only the subject list',async({page})=>{
 const d=await sheet(page);
 const trigger=d.locator('[data-subject-trigger]');
 await trigger.click();
 const menu=d.locator('[data-subject-menu]');
 await expect(menu).toBeVisible();
 await d.locator('[name="label"]').click();
 await expect(menu).toBeHidden();
 await expect(d).toBeVisible();
 await trigger.click();
 await expect(menu).toBeVisible();
 await d.getByRole('combobox',{name:'ابحث عن مادة'}).fill('اللغة العربية');
 await expect(menu).toBeVisible();
 await d.getByRole('option',{name:'اللغة العربية'}).click();
 await expect(menu).toBeHidden();
 await expect(d.locator('[name="subjectToken"]')).toHaveValue('builtin:arabic');
 await expect(d).toBeVisible();
});
test('Escape dismisses the list before it dismisses the entire sheet',async({page})=>{
 const d=await sheet(page);
 await d.locator('[data-subject-trigger]').click();
 await expect(d.locator('[data-subject-menu]')).toBeVisible();
 await page.keyboard.press('Escape');
 await expect(d.locator('[data-subject-menu]')).toBeHidden();
 await expect(d).toBeVisible();
 await page.keyboard.press('Escape');
 await expect(d).toHaveCount(0);
});
test('programme change is still usable after an outside tap and mobile has no lateral overflow',async({page})=>{
 const d=await sheet(page);
 await d.locator('[name="grade"]').selectOption('5');
 await d.locator('[data-subject-trigger]').click();
 // Physical tap (not selectOption alone) exercises the outside-pointer contract.
 await d.locator('[data-v6-program]').click();
 await expect(d.locator('[data-subject-menu]')).toBeHidden();
 await d.locator('[data-v6-program]').selectOption('tahfiz');
 await d.locator('[data-subject-trigger]').click();
 await d.getByRole('combobox',{name:'ابحث عن مادة'}).fill('التجويد');
 await expect(d.getByRole('option',{name:'التجويد'})).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth+2)).toBe(true);
});

test('desktop wheel reaches lower subjects and clicking sheet chrome dismisses picker',async({page})=>{
 await page.setViewportSize({width:1366,height:760});
 const d=await sheet(page);
 await d.locator('[data-subject-trigger]').click();
 const options=d.locator('[data-subject-options]');
 await expect(options).toBeVisible();
 const range=await options.evaluate(el=>el.scrollHeight-el.clientHeight);
 expect(range).toBeGreaterThan(25);
 await options.hover();
 await page.mouse.wheel(0,950);
 await expect.poll(()=>options.evaluate(el=>el.scrollTop)).toBeGreaterThan(20);
 await expect(d.locator('[data-subject-custom]')).toBeInViewport();
 await d.locator('.sheet__title').click();
 await expect(d.locator('[data-subject-menu]')).toBeHidden();
 await expect(d).toBeVisible();
 await d.locator('[data-subject-trigger]').click();
 await expect(d.locator('[data-subject-menu]')).toBeVisible();
});
