import { test, expect } from '@playwright/test';

const G='sa-general-1448-1449', W='sa-western-1448-1449';
async function choose(page,preset) {
  await page.getByRole('button',{name:'إعدادات التقويم والمنطقة'}).click();
  await page.getByRole('dialog').getByRole('button',{name:'التقويم',exact:true}).click();
  await page.locator(`[data-act="set-region"][data-id="${preset}"]`).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}
async function bounds(page,start,end) {
  await page.getByRole('button',{name:'إعدادات التقويم والمنطقة'}).click();
  await page.getByRole('dialog').getByRole('button',{name:'الفصول',exact:true}).click();
  await page.locator('.cal-settings-term').first().getByRole('button',{name:'تعديل التواريخ'}).click();
  await page.getByRole('dialog').getByLabel('من *').fill(start);
  await page.getByRole('dialog').getByLabel('إلى *').fill(end);
  await page.getByRole('dialog').locator('.sheet__title').click();
  await page.getByRole('dialog').getByRole('button',{name:'حفظ التواريخ',exact:true}).click();
  await page.getByRole('dialog').getByRole('button',{name:'تم',exact:true}).click();
}
async function exception(page,label,kind) {
  await page.getByRole('button',{name:'إضافة استثناء'}).click();
  const form=page.getByRole('dialog').locator('#range-form');
  await form.locator(`[name="kind"][value="${kind}"]`).check();
  await form.getByLabel('من *').fill('2026-10-05');
  await form.getByLabel('الوصف أو اسم الفترة *').fill(label);
  await page.getByRole('dialog').getByRole('button',{name:'إضافة الاستثناء'}).click();
  // Upcoming milestones intentionally omit teaching-day exceptions.
  await page.locator('[data-filter="exceptions"]').click();
  await expect(page.locator('.holiday-row').filter({hasText:label})).toHaveCount(1);
}
const snapshot=page=>page.evaluate(async()=>{
  const s=window.store, db=await import('/src/lib/db.js');
  return {year:s.activeYear().id,rawTerms:structuredClone(s.termsOf(s.activeYear().id)),
    deviceTerm:s.state.device.activeTermId,teachingIds:s.state.teachings.map(t=>t.id),
    protected:Object.fromEntries(['sessions','attendance','scores','logs'].map(n=>[n,structuredClone(s.state[n])])),
    effective:s.effectiveTermsOf(s.activeYear().id),outbox:await db.getAll('outbox')};
});
for(const demo of [false,true]) test(`N58 real controls: ${demo?'Demo':'synthetic local'} G/W/G scopes, bounds, extra terms and immutable history`,async({page},info)=>{
  const errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  page.on('request',r=>{if(/supabase\.co|\/rest\/v1\/|\/auth\/v1\//.test(r.url()))requests.push(r.url());});
  await page.clock.setFixedTime(new Date('2026-10-02T10:00:00+03:00'));
  await page.goto(demo?'/':'/#/calendar');
  if(demo) {
    const first=page.getByRole('button',{name:'جرّب ركيز المعلم'});
    if(await first.isVisible())await first.click();
    else {await page.getByRole('button',{name:/مركز المعلم/}).click();await page.getByRole('button',{name:'جرّب ركيز',exact:true}).click();}
    await page.getByRole('link',{name:'التقويم',exact:true}).click();
  }
  await page.waitForFunction(()=>window.store?.state.ready);
  await choose(page,G);
  const original=await snapshot(page);
  await bounds(page,'2026-08-24','2027-01-07');
  await exception(page,'General scoped exception','remote');
  await choose(page,W);
  await expect(page.locator('.holiday-row').filter({hasText:'General scoped exception'})).toHaveCount(0);
  await bounds(page,'2026-08-25','2027-01-14');
  await exception(page,'Western scoped exception','suspension');
  await choose(page,G);
  await expect(page.locator('.holiday-row').filter({hasText:'General scoped exception'})).toHaveCount(1);
  await expect(page.locator('.holiday-row').filter({hasText:'Western scoped exception'})).toHaveCount(0);
  expect((await snapshot(page)).effective[0].startDate).toBe('2026-08-24');
  await page.reload();await page.waitForFunction(()=>window.store?.state.ready);
  const returned=await snapshot(page);
  expect(returned.rawTerms).toEqual(original.rawTerms);
  expect(returned.year).toBe(original.year);expect(returned.deviceTerm).toBe(original.deviceTerm);
  expect(returned.teachingIds).toEqual(original.teachingIds);expect(returned.protected).toEqual(original.protected);
  // Existing add-term control must use the scoped path, not rejected raw dates.
  await page.getByRole('button',{name:'إعدادات التقويم والمنطقة'}).click();
  await page.getByRole('dialog').getByRole('button',{name:'الفصول',exact:true}).click();
  await page.locator('[data-act="add-term"]').click();
  await page.locator('#new-term-form [name="name"]').fill('Scoped extra');
  await page.locator('#new-term-form [name="startDate"]').fill('2027-07-05');
  await page.locator('#new-term-form [name="endDate"]').fill('2027-07-15');
  await page.getByRole('dialog').locator('.sheet__title').click();
  await page.getByRole('dialog').getByRole('button',{name:'إضافة',exact:true}).click();
  await expect(page.locator('.cal-settings-term').filter({hasText:'Scoped extra'})).toHaveCount(1);
  await page.getByRole('dialog').getByRole('button',{name:'تم',exact:true}).click();
  const extra=await snapshot(page);
  expect(extra.rawTerms.find(t=>t.name==='Scoped extra').startDate).toBeNull();
  expect(extra.effective.find(t=>t.name==='Scoped extra').startDate).toBe('2027-07-05');
  expect(extra.deviceTerm).toBe(original.deviceTerm);
  await choose(page,W);expect((await snapshot(page)).effective.find(t=>t.name==='Scoped extra').startDate).toBeNull();
  await choose(page,G);expect((await snapshot(page)).effective.find(t=>t.name==='Scoped extra').startDate).toBe('2027-07-05');
  for(const theme of ['light','dark']) for(const width of [1440,390,320]) {
    await page.setViewportSize({width,height:900});
    await page.evaluate(theme=>document.documentElement.setAttribute('data-theme',theme),theme);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
    expect(await page.evaluate(()=>getComputedStyle(document.documentElement).direction)).toBe('rtl');
    await page.screenshot({path:info.outputPath(`n58-${demo}-${width}-${theme}.png`),fullPage:true});
  }
  if(demo)expect((await snapshot(page)).outbox).toEqual([]);
  expect(requests).toEqual([]);expect(errors).toEqual([]);
});
