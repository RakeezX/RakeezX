import { test, expect } from '@playwright/test';

async function seed(page) {
  await page.goto('/#/classes');
  await page.waitForFunction(() => window.store?.state.ready);
  await page.evaluate(async () => {
    const names = ['أحمد اختبار', 'إبراهيم اختبار', 'آدم اختبار', 'سالم اختبار'];
    const students = names.map((name,index) => ({ id:`b21-student-${index}`, name, status:'active' }));
    const current = new Date();
    const part = (value) => String(value).padStart(2, '0');
    const today = `${current.getFullYear()}-${part(current.getMonth() + 1)}-${part(current.getDate())}`;
    await window.store.save({
      years:[{id:'b21-year',label:'سنة اختبار'}], terms:[{id:'b21-term',yearId:'b21-year',name:'فصل اختبار'}],
      subjects:[{id:'b21-subject',name:'مادة اختبار'}],
      sections:[{id:'b21-section',yearId:'b21-year',grade:4,label:'8'}],
      teachings:[{id:'b21-teaching',sectionId:'b21-section',subjectId:'b21-subject',termId:'b21-term'}],
      students, enrollments:students.map((student,index)=>({id:`b21-en-${index}`,studentId:student.id,sectionId:'b21-section',status:'active',rollNo:index+1})),
      sessions:[{id:'b21-session',teachingId:'b21-teaching',date:today,period:1,status:'scheduled'}],
    });
    await window.store.patchDevice({activeYearId:'b21-year',activeTermId:'b21-term'});
    window.store.repaint();
  });
}
function errorsOf(page) {
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{ if(message.type()==='error') errors.push(message.text()); });
  return errors;
}

test('approved New Class default, normalized duplicate feedback, true-delete and fresh-ID recreation through real controls', async ({page}) => {
  const errors=errorsOf(page);
  await page.setViewportSize({width:390,height:844});
  await seed(page);
  const add=()=>page.getByRole('button',{name:'إضافة فصل',exact:true}).click();
  await add();
  const dialog=page.getByRole('dialog');
  await expect(dialog.locator('[name="label"]')).toHaveValue('1');
  await dialog.getByRole('button',{name:'إنشاء',exact:true}).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.class-card')).toHaveCount(2);
  const first=await page.evaluate(()=>window.store.sections().find(s=>s.grade===4&&s.label==='1'));
  expect(first).toBeTruthy();
  await add();
  await dialog.locator('[name="label"]').fill('١');
  await dialog.getByRole('button',{name:'إنشاء',exact:true}).click();
  await expect(dialog).toBeVisible();
  await expect(page.locator('.toast').last()).toContainText('موجود مسبق');
  await dialog.locator('[name="label"]').fill('2');
  await dialog.getByRole('button',{name:'إنشاء',exact:true}).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.class-card')).toHaveCount(3);
  const second=await page.evaluate(()=>{const section=window.store.sections().find(s=>s.label==='2');return {section,teaching:window.store.teachings().find(t=>t.sectionId===section.id)};});
  await page.goto(`/#/teaching/${second.teaching.id}`);
  await page.getByRole('button',{name:'تعديل بيانات الشعبة'}).click();
  await dialog.locator('[name="label"]').fill('١');
  await dialog.getByRole('button',{name:'حفظ التغييرات',exact:true}).click();
  await expect(dialog).toBeVisible();
  await dialog.locator('[name="label"]').fill('3');
  await dialog.getByRole('button',{name:'حفظ التغييرات',exact:true}).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.class-name-switcher-btn')).toContainText('/ 3');
  await page.reload();
  await expect(page.locator('.class-name-switcher-btn')).toContainText('/ 3');
  expect(await page.evaluate(id=>window.store.getSection(id).label,second.section.id)).toBe('3');
  await page.goto('/#/classes');
  const teachingId=await page.evaluate(id=>window.store.teachings().find(t=>t.sectionId===id).id,first.id);
  await page.getByRole('button',{name:'حذف فصل',exact:true}).click();
  await dialog.locator('.class-delete-row').filter({has:page.locator(`input[value="${teachingId}"]`)}).click();
  await dialog.getByRole('button',{name:'متابعة'}).click();
  await dialog.getByRole('button',{name:'تأكيد الحذف'}).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.class-card')).toHaveCount(2);
  expect(await page.evaluate(id=>window.store.state.sections.find(s=>s.id===id).deleted,first.id)).toBe(true);
  expect(await page.evaluate(id=>window.store.state.teachings.find(t=>t.id===id).deleted,teachingId)).toBe(true);
  await add();
  await dialog.getByRole('button',{name:'إنشاء',exact:true}).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.class-card')).toHaveCount(3);
  const newId=await page.evaluate(()=>window.store.sections().find(s=>s.label==='1').id);
  expect(newId).not.toBe(first.id);
  expect(errors).toEqual([]);
});

for(const width of [1440,390,320]) {
  test(`Students/Attendance/Quick Log normalized search and RTL controls remain usable at ${width}px`,async({page},testInfo)=>{
    const errors=errorsOf(page);
    await page.setViewportSize({width,height:900});
    await seed(page);
    const before=await page.evaluate(()=>window.store.state.students.filter(s=>s.id.startsWith('b21-')).map(s=>({id:s.id,name:s.name})));
    for(const [route,nameSelector] of [['students','.row__title'],['attendance','.att-row__name'],['quicklog','.qlcard__name']]) {
      await page.goto(`/#/teaching/b21-teaching/${route}`);
      const search=page.locator('[data-input="search"]');
      await expect(search).toBeVisible();
      for(const [query,name] of [['احمد','أحمد اختبار'],['ابراهيم','إبراهيم اختبار'],['ادم','آدم اختبار'],['1','أحمد اختبار'],['١','أحمد اختبار']]) {
        await search.fill(query);
        await expect(page.locator(nameSelector)).toHaveText([name]);
      }
      if(route==='attendance') {
        await search.fill(''); await search.focus();
        await search.pressSequentially('احمد',{delay:60});
        await expect(search).toHaveValue('احمد'); await expect(search).toBeFocused();
        await expect(page.locator(nameSelector)).toHaveText(['أحمد اختبار']);
      }
      await search.fill('');
      await expect(page.locator(nameSelector)).toHaveCount(4);
      if(route==='quicklog') {
        const card=page.locator('#ql-b21-student-0');
        await card.locator('[data-act="plus"]').click();
        await expect(card.locator('.qlcard__score')).toHaveText('+1');
        await page.locator('[data-status="logged"]').click();
        await expect(page.locator(nameSelector)).toHaveText(['أحمد اختبار']);
        await search.fill('احمد'); await expect(page.locator(nameSelector)).toHaveCount(1);
        await page.locator('[data-status="unlogged"]').click(); await expect(page.locator(nameSelector)).toHaveCount(0);
        await search.fill(''); await expect(page.locator(nameSelector)).toHaveCount(3);
        await page.locator('[data-status="all"]').click(); await expect(page.locator(nameSelector)).toHaveCount(4);
      }
      expect(await page.locator('html').getAttribute('dir')).toBe('rtl');
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1)).toBe(true);
      await page.screenshot({path:testInfo.outputPath(`${route}-${width}.png`),fullPage:true});
    }
    await page.reload();
    await page.waitForFunction(() => window.store?.state.ready);
    expect(await page.evaluate(()=>window.store.state.students.filter(s=>s.id.startsWith('b21-')).map(s=>({id:s.id,name:s.name})))).toEqual(before);
    expect(await page.evaluate(()=>window.store.state.enrollments.filter(e=>e.id.startsWith('b21-')).map(e=>e.rollNo))).toEqual([1,2,3,4]);
    expect(errors).toEqual([]);
  });
}
