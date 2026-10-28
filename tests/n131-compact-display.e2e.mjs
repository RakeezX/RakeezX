import {test,expect} from '@playwright/test';
import {openReadyServedDemo} from './helpers/served-demo-readiness.mjs';

test.use({serviceWorkers:'block',viewport:{width:390,height:844}});
test.beforeEach(async({context,baseURL})=>{
 await context.route('**/*',route=>{
  const url=new URL(route.request().url());
  return url.origin===new URL(baseURL).origin?route.continue():route.abort();
 });
 await context.addInitScript(()=>{
  if(!sessionStorage.getItem('rakeezx-demo-session-v1'))
   sessionStorage.setItem('rakeezx-demo-session-v1','preparing');
 });
});

async function setup(page){
 await openReadyServedDemo(page,process.env.RAKEEZX_E2E_BASE_URL);
 return page.evaluate(async()=>{
  const s=window.store;
  if(s.getActiveWorkspace()?.type!=='demo')throw Error('DEMO_ONLY_REQUIRED');
  const grade=5,label='n131-compact';
  let sec=s.sections().find(x=>x.grade===grade&&x.label===label);
  if(!sec)sec=await s.createSection({grade,label});
  const sub=await s.resolveSubjectSelection({token:'builtin:digital-skills'});
  let teaching=s.teachings().find(x=>x.sectionId===sec.id&&x.subjectId===sub.id);
  if(!teaching)teaching=await s.createTeaching({sectionId:sec.id,subjectId:sub.id});
  const placed=s.allSlots().find(x=>x.teachingId===teaching.id);
  if(!placed){
   const all=s.allSlots();
   let free=null;
   for(const day of [0,1,2,3,4])for(const period of [6,5,4,3,2,1,7,8,9,10]){
    if(!all.some(x=>Number(x.weekday)===day&&Number(x.period)===period)&&!free)free={day,period};
   }
   if(!free)throw Error('NO_FREE_SYNTHETIC_SCHEDULE_PERIOD');
   await s.addSlot(teaching.id,free.day,free.period);
  }
  return {teachingId:teaching.id,sectionId:sec.id,subjectId:sub.id,
    name:sub.name,label:sec.label,storedName:s.getSubject(sub.id).name};
 });
}

test('mobile class header shows compact labels with full title; desktop stays full',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const data=await setup(page);
 await page.goto('/#/teaching/'+data.teachingId);
 await expect(page.locator('.class-hub-header')).toBeVisible();
 const className=page.locator('.class-name-switcher-btn__title');
 const subject=page.locator('.class-hub-header__sub');
 await expect(className.locator('.class-identity-short')).toBeVisible();
 await expect(className.locator('.class-identity-short')).toHaveText('خامس/n131-compact');
 await expect(className.locator('.class-identity-full')).toBeHidden();
 await expect(subject.locator('.class-identity-short')).toBeVisible();
 await expect(subject.locator('.class-identity-short')).toHaveText('رقمية');
 await expect(subject).toHaveAttribute('title','المهارات الرقمية');
 await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBe(true);
 await page.setViewportSize({width:320,height:720});
 await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBe(true);
 await page.setViewportSize({width:1280,height:900});
 await expect(className.locator('.class-identity-full')).toBeVisible();
 await expect(className.locator('.class-identity-short')).toBeHidden();
 await expect(subject.locator('.class-identity-full')).toHaveText('المهارات الرقمية');
 await expect(subject.locator('.class-identity-short')).toBeHidden();
 expect(errors).toEqual([]);
});

test('schedule cells and load summary shorten display only, stored label is unchanged',async({page})=>{
 const data=await setup(page);
 await page.goto('/#/schedule');
 await expect(page.locator('.schedule-day-tabs')).toBeVisible();
 const all=page.locator('.schedule-day-tab[data-day="all"]');
 await all.click();
 const fullClass='الخامس الابتدائي / '+data.label;
 const row=page.locator('.slot').filter({has:page.locator('.slot__grade-sec[title="'+fullClass+'"]')}).first();
 await expect(row).toBeVisible();
 await expect(row.locator('.slot__grade-sec strong')).toHaveText('خامس/n131-compact');
 await expect(row.locator('.slot__subject')).toHaveText('رقمية');
 await expect(row.locator('.slot__subject')).toHaveAttribute('title','المهارات الرقمية');
 const summary=page.locator('details.n59-load-summary');
 await summary.locator('summary').click();
 const summaryRow=summary.locator('.n59-load-row__class[title="'+fullClass+'"]').locator('..');
 await expect(summaryRow.locator('.n59-load-row__class')).toHaveText('خامس/n131-compact');
 await expect(summaryRow.locator('.n59-load-row__subject')).toHaveText('رقمية');
 await expect(summaryRow.locator('.n59-load-row__subject')).toHaveAttribute('title','المهارات الرقمية');
 const saved=await page.evaluate(({teachingId,sectionId,subjectId})=>{
   const t=window.store.getTeaching(teachingId);
   const sec=window.store.getSection(sectionId);
   const sub=window.store.getSubject(subjectId);
   return {sectionLabel:sec.label,subjectName:sub.name,teachingId:t.id,
      fullLabel:window.store.teachingLabel(t)};
 },data);
 expect(saved.sectionLabel).toBe(data.label);
 expect(saved.subjectName).toBe(data.name);
 expect(saved.fullLabel).toContain('المهارات الرقمية');
 await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBe(true);
});
