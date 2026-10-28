import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('lesson-time controls keep touch targets, keyboard focus and search in both themes',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>{
  const u=new URL(route.request().url());
  if(u.origin==='http://127.0.0.1:5194'&&['GET','HEAD'].includes(route.request().method()))return route.continue();
  return route.abort('blockedbyclient');
 });
 await page.goto('/#/',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.store?.state?.ready===true,null,{timeout:25000});
 const id=await page.evaluate(async()=>{
  const {todayISO}=await import('/src/models.js');
  const section=await window.store.createSection({grade:5,label:'3'});
  const tch=await window.store.createTeaching({sectionId:section.id});
  await window.store.importStudents(section.id,['عبدالرحمن محمد العتيبي','ليث','آدم','سالم محمد الغامدي']);
  await window.store.ensureSession(tch.id,todayISO(),1);
  return tch.id;
 });
 const data=[];
 await page.setViewportSize({width:320,height:844});
 await page.emulateMedia({reducedMotion:'reduce'});
 for(const theme of ['light','dark']){
  await page.goto('/#/teaching/'+id+'/attendance');
  await page.locator('.attendance-01c__row').first().waitFor();
  await page.evaluate(t=>{document.documentElement.dataset.theme=t;},theme);
  const statuses=page.locator('.attendance-01c__row').first().locator('.attendance-01c__status');
  await expect(statuses).toHaveCount(4);
  const dimensions=await statuses.evaluateAll(nodes=>nodes.map(n=>({
    h:Math.round(n.getBoundingClientRect().height),
    w:Math.round(n.getBoundingClientRect().width),
    label:n.getAttribute('aria-label'),
    pressed:n.getAttribute('aria-pressed'),
  })));
  expect(dimensions.every(x=>x.h>=44 && x.w>=44 && x.label && x.pressed!==null)).toBe(true);
  await statuses.first().focus();
  await page.keyboard.press('Tab'); // Real keyboard navigation enables :focus-visible, unlike pointer-style programmatic focus.
  const focus=await statuses.nth(1).evaluate(n=>({active:document.activeElement===n,outline:getComputedStyle(n).outlineStyle}));
  expect(focus.active).toBe(true);expect(focus.outline).not.toBe('none');
  const search=page.locator('.attendance-01c__toolbar [data-input="search"]');
  await search.fill('ليث');
  await expect(page.locator('.attendance-01c__row')).toHaveCount(1);
  await page.locator('.attendance-01c__toolbar [data-act="clear-search"]').click();
  await expect(page.locator('.attendance-01c__row')).toHaveCount(4);
  await page.goto('/#/teaching/'+id+'/quicklog');
  await page.locator('.qlcard').first().waitFor();
  await page.evaluate(t=>{document.documentElement.dataset.theme=t;},theme);
  const quick=await page.evaluate(()=>{
    const first=document.querySelector('.qlcard');
    const minus=first.querySelector('.qlcard__minus'),hit=first.querySelector('.qlcard__hit');
    const reason=document.querySelector('.quicklog__filters .switch');
    const mode=document.querySelector('.quicklog__modes');
    const modes=[...mode.querySelectorAll('.segmented__btn')];
    const filter=[...document.querySelectorAll('.quicklog-filter-bar .segmented__btn')];
    const rect=n=>({w:Math.round(n.getBoundingClientRect().width),h:Math.round(n.getBoundingClientRect().height)});
    return {
      minus:rect(minus),hit:rect(hit),reason:rect(reason),modes:modes.map(rect),filters:filter.map(rect),
      totalToolbar:Math.round(document.querySelector('.quicklog-toolbar').getBoundingClientRect().height),
      firstRow:Math.round(first.getBoundingClientRect().top),
      font:getComputedStyle(first.querySelector('.qlcard__name')).fontSize,
      inputFont:getComputedStyle(document.querySelector('.quicklog-search .input')).fontSize,
      overflow:document.documentElement.scrollWidth>innerWidth,
      animation:getComputedStyle(first).animationDuration
    };
  });
  expect(quick.minus.h).toBeGreaterThanOrEqual(44);
  expect(quick.hit.h).toBeGreaterThanOrEqual(44);
  expect(quick.reason.h).toBeGreaterThanOrEqual(44);
  expect(quick.modes.every(x=>x.h>=44)).toBe(true);
  expect(quick.filters.every(x=>x.h>=44)).toBe(true);
  expect(quick.inputFont).toBe('16px');
  expect(quick.overflow).toBe(false);
  await page.locator('.quicklog-search [data-input="search"]').fill('ليث');
  await expect(page.locator('.qlcard')).toHaveCount(1);
  await page.locator('.quicklog-search [data-act="clear-search"]').click();
  await expect(page.locator('.qlcard')).toHaveCount(4);
  await page.getByRole('button',{name:'لم يُرصدوا'}).click();
  await expect(page.locator('.qlcard')).toHaveCount(4);
  await page.getByRole('button',{name:'الكل',exact:true}).click();
  const violations=(await new AxeBuilder({page}).include('.quicklog-page')
    .withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze()).violations;
  data.push({theme,focus,dimensions,quick,axe:violations.map(x=>({id:x.id,impact:x.impact}))});
  expect(violations).toHaveLength(0);
 }
 console.log('LESSON_CONTROLS='+JSON.stringify({data,errors}));
 expect(errors).toEqual([]);
});
