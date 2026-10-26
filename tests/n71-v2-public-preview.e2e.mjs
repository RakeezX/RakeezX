import {test,expect} from '@playwright/test';

async function open(page){
  const outgoing=[];
  page.on('request',request=>{
    if(request.url().startsWith('https://')||request.url().startsWith('wss://'))outgoing.push(request.url());
  });
  await page.goto('/#/v2-preview-lab');
  await expect(page.locator('[data-n71-v2-public-lab]')).toBeVisible();
  await expect(page.getByRole('heading',{name:'تغيير المادة دون ضياع سجل المعلم'})).toBeVisible();
  return outgoing;
}
test('independent public lab never loads Product account or sends network data',async({page})=>{
  const outgoing=await open(page);
  const withoutProduct=await page.evaluate(()=>!Object.hasOwn(window,'store') && !Object.hasOwn(window,'cloud'));
  expect(withoutProduct).toBe(true);
  expect(outgoing).toEqual([]);
  await expect(page.getByText('بيانات اصطناعية فقط.',{exact:false})).toBeVisible();
});
test('clean correction changes only in-memory label and resets after reload',async({page})=>{
  await open(page);
  await page.getByRole('button',{name:'اختيار خاطئ'}).click();
  await page.getByRole('button',{name:'معاينة الأثر'}).click();
  const apply=page.getByRole('button',{name:'تجربة تصحيح الاختيار'});
  await expect(apply).toBeEnabled();
  await apply.click();
  await expect(page.locator('[data-current-subject]')).toHaveText('المهارات الرقمية');
  await expect(page.getByRole('heading',{name:'نجح التصحيح داخل النموذج التجريبي'})).toBeVisible();
  await page.reload();
  await expect(page.locator('[data-current-subject]')).toHaveText('العلوم');
});
test('recorded grades preserve original Subject and independent addition reuses roster',async({page})=>{
  await open(page);
  await page.getByRole('button',{name:'عليها درجات'}).click();
  await page.getByRole('button',{name:'معاينة الأثر'}).click();
  await expect(page.getByRole('button',{name:'تجربة تصحيح الاختيار'})).toBeDisabled();
  await expect(page.getByText(/12 درجة و9 سجلات حضور و5 حصص تاريخية/)).toBeVisible();
  await page.getByRole('button',{name:'إضافة مادة مستقلة'}).click();
  await expect(page.getByRole('heading',{name:'أُضيفت مادة مستقلة إلى المثال'})).toBeVisible();
  await expect(page.locator('[data-current-subject]')).toHaveText('العلوم');
  await expect(page.getByText(/يشتركان في كشف 12 طالبًا/)).toBeVisible();
});
test('unfinished sync cannot change material, and duplicate option is refused',async({page})=>{
  await open(page);
  await page.getByRole('button',{name:'مزامنة معلّقة'}).click();
  await page.getByRole('button',{name:'معاينة الأثر'}).click();
  await expect(page.getByRole('button',{name:'تجربة تصحيح الاختيار'})).toBeDisabled();
  await expect(page.getByText(/تغيير المادة موقوف حتى وضوح المزامنة/)).toBeVisible();
  await page.locator('#v2-target').selectOption('same');
  await page.getByRole('button',{name:'إضافة مادة مستقلة'}).click();
  await expect(page.getByText(/المادة هذه موجودة بالفعل/)).toBeVisible();
});
test('illustrative N71 restore repeats one receipt and does not create new students',async({page})=>{
  const outbound=await open(page);
  await page.getByRole('button',{name:'تشغيل المحاكاة'}).click();
  await expect(page.locator('[data-restore-steps] li[data-complete]')).toHaveCount(5);
  await expect(page.getByRole('heading',{name:'اكتملت محاكاة الاستعادة على جهاز B'})).toBeVisible();
  await expect(page.getByText(/N71-DEMO-01/)).toBeVisible();
  await page.getByRole('button',{name:'إعادة الطلب نفسه'}).click();
  await expect(page.getByText(/دون إنشاء نسخة ثانية/)).toBeVisible();
  expect(outbound).toEqual([]);
  await page.getByRole('button',{name:'إعادة ضبط التجربة'}).click();
  await expect(page.locator('[data-restore-steps] li[data-complete]')).toHaveCount(0);
});
test('mobile lab fits narrow viewport without horizontal scroll',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await open(page);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+2);
  expect(overflow).toBe(false);
  await expect(page.getByRole('button',{name:'تشغيل المحاكاة'})).toBeVisible();
});
