import {test, expect} from '@playwright/test';

test('Roster handles 300 synthetic students and Arabic search without overflow',async({page})=>{
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',route=>{
    const u=new URL(route.request().url());
    if(u.origin==='http://127.0.0.1:5194'&&['GET','HEAD'].includes(route.request().method())) return route.continue();
    return route.abort('blockedbyclient');
  });
  await page.setViewportSize({width:320,height:844});
  await page.goto('/#/',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.store?.state?.ready===true,null,{timeout:25000});
  const seeded=await page.evaluate(async()=>{
    const sec=await window.store.createSection({grade:5,label:'8'});
    const teaching=await window.store.createTeaching({sectionId:sec.id});
    const names=Array.from({length:300},(_,i)=>'طالب تجريبي رقم '+(i+1)+' بن محمد بن عبدالله');
    const result=await window.store.importStudents(sec.id,names);
    return {id:teaching.id,added:result.added,overLimit:result.skippedOverLimit};
  });
  expect(seeded.added).toBe(300);
  expect(seeded.overLimit).toBe(0);
  const start=Date.now();
  await page.goto('/#/teaching/'+seeded.id+'/students',{waitUntil:'domcontentloaded'});
  await expect(page.locator('.roster-row')).toHaveCount(300,{timeout:25000});
  const renderMs=Date.now()-start;
  const initial=await page.evaluate(()=>({
    documentWidth:document.documentElement.scrollWidth,
    actionsHeight:Math.round(document.querySelector('.roster-populated-actions').getBoundingClientRect().height),
    summary:document.querySelector('.roster-summary')?.textContent.trim()
  }));
  expect(initial.documentWidth).toBeLessThanOrEqual(320);
  expect(initial.actionsHeight).toBeLessThanOrEqual(120);
  const search=page.locator('.roster-search [data-input="search"]');
  await search.fill('رقم 299');
  await expect(page.locator('.roster-row')).toHaveCount(1,{timeout:10000});
  await expect(page.locator('.roster-row .row__title')).toContainText('رقم 299');
  await page.locator('.roster-search [data-act="clear-search"]').click();
  await expect(page.locator('.roster-row')).toHaveCount(300,{timeout:10000});
  console.log('UX_ROSTER_300='+JSON.stringify({added:seeded.added,renderMs,initial,searchWorks:true,errors}));
  expect(errors).toEqual([]);
});
