import {test,expect} from '@playwright/test';

async function openClasses(page,{width=1280}={}){
  await page.setViewportSize({width,height:850});
  await page.goto('/#/classes');
  await page.waitForFunction(()=>window.store?.state?.ready===true);
  const workspace=await page.evaluate(()=>window.store.getActiveWorkspace()?.type);
  if(!['demo','legacy'].includes(workspace))
    throw new Error('SYNTHETIC_DEMO_ONLY: '+workspace);
}

async function createClass(page,{label='6',subject='العربية'}={}){
  await page.locator('.classes-toolbar [data-act="add"]').click();
  const dialog=page.getByRole('dialog');
  await expect(dialog.locator('[name="grade"]')).toBeVisible();
  await dialog.locator('[name="grade"]').selectOption('4');
  await dialog.locator('[name="label"]').fill(label);
  await dialog.locator('[data-subject-trigger]').click();
  await dialog.getByRole('combobox',{name:'ابحث عن مادة'}).fill(subject);
  await dialog.getByRole('option',{name:subject,exact:true}).first().click();
  await dialog.getByRole('button',{name:'إنشاء',exact:true}).click();
  await expect(dialog).toHaveCount(0);
  await page.waitForFunction(()=>window.store.teachings().length>=1);
  return page.evaluate(()=>{
    const teaching=window.store.teachings()[0];
    return {sectionId:teaching.sectionId,id:teaching.id,subjectId:teaching.subjectId};
  });
}

async function openHub(page,subject='العربية'){
  await page.locator('.class-card__main').filter({hasText:subject}).first().click();
  await expect(page.locator('.class-hub-header')).toBeVisible();
}

const snapshot=async page=>page.evaluate(async()=>{
  const db=await import('/src/lib/db.js');
  const names=['sections','students','enrollments','teachings','items','scores','sessions','attendance','outbox'];
  const all=await Promise.all(names.map(x=>db.getAll(x)));
  return Object.fromEntries(names
    .map((name,index)=>[name,all[index]]));
});

test('visible addition in class header shares its roster but keeps marks in the original subject',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await openClasses(page,{width:390});
  const created=await createClass(page,{label:'6',subject:'العربية'});
  await page.evaluate(async sectionId=>{
    await window.store.addStudent(sectionId,'طالب اختبار اصطناعي');
    const db=await import('/src/lib/db.js');
    const source=window.store.teachings()[0];
    const item=(await db.getAll('items')).find(x=>x.teachingId===source.id);
    if(!item)throw Error('SYNTHETIC_DEFAULT_ITEM_MISSING');
    const studentId=window.store.students(source.id)[0].id;
    await db.put('scores',{id:'score:synthetic-existing-only',studentId,
      itemId:item.id,value:8,deleted:false,updatedAt:1793101200101});
    // Synthetic only: a historical session and its attendance must remain
    // attached to the original Teaching when adding another subject.
    await db.put('sessions',{id:'session:synthetic-existing-only',teachingId:source.id,
      date:'2026-10-26',period:1,status:'held',deleted:false,updatedAt:1793101200102});
    await db.put('attendance',{id:'attendance:synthetic-existing-only',
      sessionId:'session:synthetic-existing-only',studentId,teachingId:source.id,
      date:'2026-10-26',status:'present',deleted:false,updatedAt:1793101200103});
  },created.sectionId);
  const before=await snapshot(page);
  expect(before.students).toHaveLength(1);
  expect(before.enrollments).toHaveLength(1);
  expect(before.teachings).toHaveLength(1);
  expect(before.scores).toHaveLength(1);
  expect(before.sessions).toHaveLength(1);
  expect(before.attendance).toHaveLength(1);
  await openHub(page,'العربية');
  const add=page.getByRole('button',{name:'إضافة مادة أخرى لهذا الفصل'});
  await expect(add).toBeVisible();
  await expect(add).toBeEnabled();
  await expect(add).toContainText('إضافة مادة أخرى');
  await expect(page.getByRole('button',{name:'تغيير المادة'})).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth+2)).toBe(true);

  await add.click();
  const dialog=page.getByRole('dialog');
  await expect(dialog).toContainText('إضافة مادة للفصل');
  await expect(dialog).toContainText('الطلاب الموجودين في هذا الفصل');
  await expect(dialog).toContainText('درجات وحضور كل مادة مستقلين');
  await expect(dialog.locator('[name="grade"]')).toBeDisabled();
  await expect(dialog.locator('[name="label"]')).toHaveAttribute('readonly');
  await dialog.locator('[data-subject-trigger]').click();
  await dialog.getByRole('combobox',{name:'ابحث عن مادة'}).fill('الرياضيات');
  await dialog.getByRole('option',{name:'الرياضيات',exact:true}).first().click();
  await dialog.getByRole('button',{name:'إنشاء',exact:true}).click();
  await expect(dialog).toHaveCount(0);
  await expect.poll(()=>page.evaluate(()=>window.store.teachings().length)).toBe(2);
  const after=await snapshot(page);
  const fresh=after.teachings.find(x=>x.id!==created.id);
  expect(fresh).toBeDefined();
  expect(fresh.sectionId).toBe(created.sectionId);
  expect(after.teachings.find(x=>x.id===created.id).subjectId).toBe(created.subjectId);
  expect(after.sections).toEqual(before.sections);
  expect(after.students).toEqual(before.students);
  expect(after.enrollments).toEqual(before.enrollments);
  expect(after.scores).toEqual(before.scores);
  expect(after.sessions).toEqual(before.sessions);
  expect(after.attendance).toEqual(before.attendance);
  expect(after.items.filter(x=>x.teachingId===created.id))
    .toEqual(before.items.filter(x=>x.teachingId===created.id));
  expect(after.items.filter(x=>x.teachingId===fresh.id)).toHaveLength(5);
  expect(errors).toEqual([]);
});

test('header button works even when the class has no students and reuses built-in duplicate guard',async({page})=>{
  await openClasses(page,{width:1280});
  const created=await createClass(page,{label:'7',subject:'العربية'});
  await openHub(page,'العربية');
  await expect(page.getByText('لا يوجد طلاب في الفصل')).toBeVisible();
  const add=page.getByRole('button',{name:'إضافة مادة أخرى لهذا الفصل'});
  await expect(add).toBeVisible();
  await add.click();
  const d=page.getByRole('dialog');
  await expect(d).toContainText('درجات وحضور كل مادة مستقلين');
  await d.locator('[data-subject-trigger]').click();
  await d.getByRole('combobox',{name:'ابحث عن مادة'}).fill('العربية');
  await d.getByRole('option',{name:'العربية',exact:true}).first().click();
  await d.getByRole('button',{name:'إنشاء',exact:true}).click();
  await expect(d).toBeVisible();
  const counts=await page.evaluate(id=>({
    teachingCount:window.store.teachings().filter(t=>t.sectionId===id).length,
    studentCount:window.store.students(window.store.teachings()[0].id).length,
  }),created.sectionId);
  expect(counts).toEqual({teachingCount:1,studentCount:0});
  await d.getByRole('button',{name:'إلغاء',exact:true}).click();
  await expect(d).toHaveCount(0);
});
