import { test, expect } from '@playwright/test';
import { makeIsolatedDemoContext, openReadyServedDemo } from './helpers/served-demo-readiness.mjs';
const expected = ['أحمد','بندر','حاتم','خالد'];
async function snapshot(page) {
  return page.evaluate(async()=>{
    const db=await import('/src/lib/db.js');
    return JSON.stringify(await Promise.all(['students','enrollments','scores','sessionRosterSnapshots','outbox'].map(t=>db.getAll(t))));
  });
}
async function checkRows(rows, numberSelector, nameSelector, names=expected, numbers=['1','2','3','4']) {
  await expect(rows).toHaveCount(names.length);
  expect(await rows.locator(nameSelector).allTextContents()).toEqual(names);
  expect(await rows.locator(numberSelector).allTextContents()).toEqual(numbers);
}
async function reportRows(page,names=expected,numbers=['1','2','3','4']) {
  await checkRows(page.locator('.report-document .gtable--report tbody tr'), 'td:first-child', 'th', names,numbers);
}

test('n98_existing_views_numbering: real roster/grades/attendance/reports, filters, explicit sorts, CSV and A4', async ({browser},testInfo)=>{
  const context=await makeIsolatedDemoContext(browser,{width:1280,height:900});
  try {
    const page=await context.newPage(); const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await openReadyServedDemo(page,'http://127.0.0.1:5198');
    await page.evaluate(async()=>{
      const store=await import('/src/store.js');
      const m=await import('/src/models.js');
      const names=['أحمد','بندر','خالد','حاتم']; const rolls=[91,2,1,99];
      const year=m.makeYear({id:'n98-year',hijriStart:1450});
      const term=m.makeTerm({id:'n98-term',yearId:year.id,index:1,startDate:'2026-08-01',endDate:'2026-12-31'});
      const section=m.makeSection({id:'n98-section',yearId:year.id,grade:4,label:'أ'});
      const subject=m.makeSubject({id:'n98-subject',name:'مادة اصطناعية',slug:'n98'});
      const teaching=m.makeTeaching({id:'n98-teaching',sectionId:section.id,subjectId:subject.id,termId:term.id});
      const students=names.map((name,i)=>m.makeStudent({id:`n98-${i}`,name}));
      const enrollments=students.map((s,i)=>m.makeEnrollment({studentId:s.id,sectionId:section.id,rollNo:rolls[i],startDate:'2026-08-01'}));
      const item=m.makeItem({id:'n98-item',teachingId:teaching.id,name:'اختبار',max:10});
      const session=m.makeSession({id:'n98-session',teachingId:teaching.id,date:'2026-10-13',period:1,status:'held'});
      await store.save({years:[year],terms:[term],subjects:[subject],sections:[section],teachings:[teaching],students,enrollments,items:[item],sessions:[session],
        scores:[{id:'sc:n98-2:n98-item',studentId:'n98-2',itemId:item.id,value:8}],
        attendance:students.map((s,i)=>({id:`at:${s.id}:${session.id}`,studentId:s.id,sessionId:session.id,teachingId:teaching.id,date:session.date,status:'present'})),
        sessionRosterSnapshots:[{id:'n98-snapshot',sessionId:session.id,teachingId:teaching.id,state:'complete',members:students.map((s,i)=>({studentId:s.id,rollNo:rolls[i]}))}],
      });
      await store.patchDevice({activeYearId:year.id,activeTermId:term.id}); (await import('/src/repaint.js')).repaint();
    });
    const before=await snapshot(page);
    await page.goto('/#/teaching/n98-teaching/students');
    await checkRows(page.locator('.roster-row'),'.rollno','.row__title');
    await page.locator('[data-input="search"]').fill('خالد');
    await checkRows(page.locator('.roster-row'),'.rollno','.row__title',['خالد'],['4']);
    await page.locator('[data-input="search"]').fill('3');
    await checkRows(page.locator('.roster-row'),'.rollno','.row__title',['حاتم'],['3']);
    await page.goto('/#/teaching/n98-teaching/grades');
    await checkRows(page.locator('.graderow'),'.rollno','.graderow__name strong');
    await page.locator('[data-input="search"]').fill('خالد');
    await checkRows(page.locator('.graderow'),'.rollno','.graderow__name strong',['خالد'],['4']);
    await page.locator('[data-input="search"]').fill('');
    await page.locator('[data-change="sort"]').selectOption('roll');
    await checkRows(page.locator('.graderow'),'.rollno','.graderow__name strong',['خالد','بندر','أحمد','حاتم'],['4','2','1','3']);
    await page.locator('[data-change="sort"]').selectOption('score_desc');
    await expect(page.locator('.graderow__name strong').first()).toHaveText('خالد');
    await page.locator('[data-change="sort"]').selectOption('default');
    await page.locator('[data-act="mode"][data-mode="table"]').click();
    await checkRows(page.locator('.gtable tbody tr'),'.gtable__roll','.gtable__sticky a');
    await page.goto('/#/teaching/n98-teaching/attendance?session=n98-session');
    await checkRows(page.locator('.att-row'),'.rollno','.att-row__name strong');
    await page.locator('input[type="search"]').fill('خالد');
    await checkRows(page.locator('.att-row'),'.rollno','.att-row__name strong',['خالد'],['4']);
    await page.goto('/#/teaching/n98-teaching/reports');
    for(const tab of ['roster','grades','attendance']) {
      await page.locator(`[data-act="tab"][data-tab="${tab}"]`).click();
      await reportRows(page);
      const promise=page.waitForEvent('download');
      await page.locator('[data-act="csv"]').click();
      const download=await promise; const stream=await download.createReadStream(); let csv='';
      for await(const chunk of stream) csv+=chunk;
      for(let i=0;i<4;i++) expect(csv).toContain(`${i+1},${expected[i]}`);
    }
    await page.locator('[data-act="tab"][data-tab="roster"]').click();
    await page.locator('[data-change="sort"]').selectOption('roll');
    await reportRows(page,['خالد','بندر','أحمد','حاتم'],['4','2','1','3']);
    await page.locator('[data-change="sort"]').selectOption('default');
    await page.locator('[data-act="toggle-a4"]').click();
    await expect(page.locator('.a4-sheet')).toBeVisible();
    await checkRows(page.locator('.a4-sheet tbody tr'),'td:first-child','th');
    expect(await page.locator('.a4-sheet').evaluate(el=>getComputedStyle(el).backgroundColor)).toBe('rgb(255, 255, 255)');
    await page.locator('.a4-sheet').screenshot({path:testInfo.outputPath('n98-roster-a4.png')});
    expect(await snapshot(page)).toBe(before);
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});
