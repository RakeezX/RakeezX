import {test,expect} from '@playwright/test';

async function begin(page){
  await page.goto('/#/classes');
  await page.waitForFunction(()=>window.store?.state?.ready===true);
  const type=await page.evaluate(()=>window.store.getActiveWorkspace()?.type);
  if(!['demo','legacy'].includes(type))
    throw new Error('This browser test requires an isolated synthetic workspace: '+type);
}
async function create(page,grade,label,subject){
  await page.getByRole('button',{name:/إضافة فصل|إنشاء أول فصل/,exact:true}).first().click();
  const dialog=page.getByRole('dialog');
  await expect(dialog.locator('[name="grade"]')).toBeVisible();
  await dialog.locator('[name="grade"]').selectOption(String(grade));
  await dialog.locator('[name="label"]').fill(label);
  await dialog.locator('[data-subject-trigger]').click();
  await dialog.getByRole('combobox',{name:'ابحث عن مادة'}).fill(subject);
  await dialog.locator('[data-subject-name="'+subject+'"]').first().click();
  await dialog.getByRole('button',{name:'إنشاء',exact:true}).click();
  await expect(dialog).toHaveCount(0);
}
async function openEdit(page,label,subject){
  await page.getByRole('link',{name:new RegExp(label+'.*'+subject,'u')}).first().click();
  await page.getByRole('button',{name:'تعديل الفصل'}).click();
  const d=page.getByRole('dialog');
  await expect(d.getByRole('button',{name:'تغيير المادة'})).toBeVisible();
  await d.getByRole('button',{name:'تغيير المادة'}).click();
  await expect(d).toHaveCount(1);
  await expect(d.getByText('المادة الحالية',{exact:true})).toBeVisible();
  return d;
}
async function countAndSubject(page,label){
  return page.evaluate(async(name)=>{
    const d=await import('/src/lib/db.js');
    const sections=(await d.getAll('sections')).filter(x=>!x.deleted);
    const teachings=(await d.getAll('teachings')).filter(x=>!x.deleted);
    const sec=sections.find(s=>s.label===name);
    return {sectionId:sec?.id,
      teachings:teachings.filter(t=>t.sectionId===sec?.id)
        .map(t=>({id:t.id,subjectId:t.subjectId})),
      scores:await d.getAll('scores'),
      outbox:await d.getAll('outbox')};
  },label);
}
test('read-only subject change entry flags already attached class material, without duplicate or silent rewrite',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await begin(page);
  await create(page,4,'PVZ1','العلوم');
  await create(page,4,'PVZ1','المهارات الرقمية');
  const before=await countAndSubject(page,'PVZ1');
  expect(before.teachings).toHaveLength(2);
  const dialog=await openEdit(page,'PVZ1','العلوم');
  await expect(dialog.getByRole('button',{name:'معاينة أثر التغيير'})).toBeDisabled();
  await dialog.getByRole('combobox',{name:'المادة الجديدة'}).selectOption({label:'المهارات الرقمية'});
  await dialog.getByRole('button',{name:'معاينة أثر التغيير'}).click();
  await expect(dialog.getByText(/المادة المحددة مرتبطة بهذا الفصل بالفعل/)).toBeVisible();
  await expect(dialog.getByRole('button',{name:'إضافة مادة أخرى مع الحفاظ على السجلات'})).toBeVisible();
  const after=await countAndSubject(page,'PVZ1');
  expect(after.teachings).toEqual(before.teachings);
  expect(after.scores).toEqual(before.scores);
  expect(after.outbox).toEqual(before.outbox);
  expect(errors).toEqual([]);
});
test('historic synthetic score prevents automatic cross-subject reassignment, while preserving grades',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await begin(page);
  await create(page,4,'PVZ2','العلوم');
  await create(page,4,'PVZ3','المهارات الرقمية');
  const source=await countAndSubject(page,'PVZ2');
  expect(source.teachings).toHaveLength(1);
  await page.evaluate(async(tch)=>{
    const db=await import('/src/lib/db.js');
    const items=(await db.getAll('items')).filter(i=>i.teachingId===tch);
    if(items.length<1)throw new Error('synthetic default item was not saved');
    await db.put('scores',{id:'synthetic-score-for-preview',itemId:items[0].id,
      studentId:'synthetic-user-only',value:17,updatedAt:1793000101000});
  },source.teachings[0].id);
  const before=await countAndSubject(page,'PVZ2');
  const dialog=await openEdit(page,'PVZ2','العلوم');
  await dialog.getByRole('combobox',{name:'المادة الجديدة'}).selectOption({label:'المهارات الرقمية'});
  await dialog.getByRole('button',{name:'معاينة أثر التغيير'}).click();
  await expect(dialog.getByText(/توجد سجلات مرتبطة بهذه المادة/)).toBeVisible();
  await expect(dialog.getByText(/الدرجات: 1/)).toBeVisible();
  const after=await countAndSubject(page,'PVZ2');
  expect(after.teachings).toEqual(before.teachings);
  expect(after.scores).toEqual(before.scores);
  expect(after.outbox).toEqual(before.outbox);
  expect(errors).toEqual([]);
});
test('clean subject gets transparent preview and no unauthorised Save button',async({page})=>{
  await begin(page);
  await create(page,4,'PVZ4','العلوم');
  await create(page,4,'PVZ5','المهارات الرقمية');
  const before=await countAndSubject(page,'PVZ4');
  // Synthetic-only fixture: simulate a confirmed local create by clearing
  // the source Teaching's already known Outbox entries. Other tests explicitly
  // retain unconfirmed mutations and verify the product fails closed.
  await page.evaluate(async(tch)=>{
    if(!['demo','legacy'].includes(window.store.getActiveWorkspace()?.type))
      throw new Error('SYNTHETIC_FIXTURE_ONLY');
    const db=await import('/src/lib/db.js');
    const items=(await db.getAll('items')).filter(r=>r.teachingId===tch);
    const related=new Set([tch,...items.map(r=>r.id)]);
    for(const entry of await db.getAll('outbox')){
      if(related.has(entry.recordId) ||
         entry.pristineTeachingCreation?.teaching?.id===tch)
        await db.remove('outbox',entry.id);
    }
  },before.teachings[0].id);
  const d=await openEdit(page,'PVZ4','العلوم');
  await d.getByRole('combobox',{name:'المادة الجديدة'}).selectOption({label:'المهارات الرقمية'});
  await d.getByRole('button',{name:'معاينة أثر التغيير'}).click();
  await expect(d.getByText(/لا توجد درجات أو حصص أو أعمال مرتبطة/)).toBeVisible();
  await expect(d.getByText(/خيار الحفظ المباشر لم يُفعّل/)).toBeVisible();
  await expect(d.getByRole('button',{name:/حفظ/})).toHaveCount(0);
  const after=await countAndSubject(page,'PVZ4');
  expect(after.teachings).toEqual(before.teachings);
});
