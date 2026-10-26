import {test,expect} from '@playwright/test';

// Browser synthetic local workspace only. Never opens auth, Noor, Madrasati or a real user profile.
async function begin(page,grade,label){
  await page.goto('/#/classes');
  await page.waitForFunction(()=>window.store?.state?.ready === true);
  const type=await page.evaluate(()=>window.store.getActiveWorkspace()?.type);
  if(!['demo','legacy'].includes(type))throw new Error('Test needs a local demo/legacy workspace, not an account: '+type);
  await page.getByRole('button',{name:/إضافة فصل|إنشاء أول فصل/,exact:true}).first().click();
  const d=page.getByRole('dialog');
  await expect(d.locator('[name="grade"]')).toBeVisible();
  await d.locator('[name="grade"]').selectOption(String(grade));
  await d.locator('[name="label"]').fill(label);
  return d;
}
async function selectGuide(d,name){
  await d.locator('[data-subject-trigger]').click();
  const search=d.getByRole('combobox',{name:'ابحث عن مادة'});
  await search.fill(name);
  await d.locator('[data-subject-name]').filter({hasText:name}).first().click();
}
async function persistedClasses(page){
  return page.evaluate(async()=>{
    const db=await import('/src/lib/db.js');
    return {sections:(await db.getAll('sections')).filter(x=>!x.deleted),
      teachings:(await db.getAll('teachings')).filter(x=>!x.deleted),
      subjects:(await db.getAll('subjects')).filter(x=>!x.deleted)};
  });
}
test('verified local-only creation and reload preserves grade, subject, section, teaching',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 let d=await begin(page,4,'Z1');
 await selectGuide(d,'العلوم');
 await d.getByRole('button',{name:'إنشاء',exact:true}).click();
 await expect(d).toHaveCount(0);
 await expect.poll(async()=>{const x=await persistedClasses(page);return x.teachings.length}).toBeGreaterThanOrEqual(1);
 let before=await persistedClasses(page);
 const sec=before.sections.find(s=>s.grade===4&&s.label==='Z1');
 assertNonNull(sec,'section did not save');
 const tch=before.teachings.find(t=>t.sectionId===sec.id);
 assertNonNull(tch,'teaching did not save');
 const sub=before.subjects.find(s=>s.id===tch.subjectId);
 assertNonNull(sub,'subject did not save');
 expect(sub.name).toBe('العلوم');
 const expected={sectionId:sec.id,teachingId:tch.id,subjectId:sub.id};
 await page.reload();
 await page.waitForFunction(()=>window.store?.state?.ready === true);
 const after=await persistedClasses(page);
 expect(after.sections.some(x=>x.id===expected.sectionId)).toBe(true);
 expect(after.teachings.some(x=>x.id===expected.teachingId&&x.subjectId===expected.subjectId)).toBe(true);
 await expect(page.getByRole('link',{name:/Z1.*العلوم/u})).toBeVisible();
 expect(errors).toEqual([]);
});
function assertNonNull(v,message){if(v==null)throw new Error(message);}
test('two teachings for one section do not create a duplicate section or student record',async({page})=>{
 let d=await begin(page,4,'Z2');
 await selectGuide(d,'العلوم');
 await d.getByRole('button',{name:'إنشاء',exact:true}).click();
 await expect(d).toHaveCount(0);
 d=await begin(page,4,'Z2');
 await selectGuide(d,'المهارات الرقمية');
 await d.getByRole('button',{name:'إنشاء',exact:true}).click();
 await expect(d).toHaveCount(0);
 const x=await persistedClasses(page);
 const sections=x.sections.filter(s=>s.grade===4&&s.label==='Z2');
 expect(sections).toHaveLength(1);
 expect(x.teachings.filter(t=>t.sectionId===sections[0].id)).toHaveLength(2);
 await page.reload();
 await page.waitForFunction(()=>window.store?.state?.ready===true);
 const y=await persistedClasses(page);
 expect(y.sections.filter(s=>s.grade===4&&s.label==='Z2')).toHaveLength(1);
 expect(y.teachings.filter(t=>t.sectionId===sections[0].id)).toHaveLength(2);
});
test('new officially named Tajweed course in Tahfiz is stored as one local custom subject',async({page})=>{
 const d=await begin(page,5,'Z3');
 await d.locator('[data-v6-program]').selectOption('tahfiz');
 await selectGuide(d,'التجويد');
 expect(await d.locator('[name="subjectToken"]').inputValue()).toBe('custom');
 expect(await d.locator('[name="customSubjectName"]').inputValue()).toBe('التجويد');
 await d.getByRole('button',{name:'إنشاء',exact:true}).click();
 await expect(d).toHaveCount(0);
 let x=await persistedClasses(page);
 expect(x.subjects.filter(s=>s.name==='التجويد')).toHaveLength(1);
 await page.reload();await page.waitForFunction(()=>window.store?.state?.ready===true);
 x=await persistedClasses(page);
 expect(x.subjects.filter(s=>s.name==='التجويد')).toHaveLength(1);
 expect(x.sections.filter(s=>s.grade===5&&s.label==='Z3')).toHaveLength(1);
});
