import {test,expect} from '@playwright/test';
import {openReadyServedDemo} from './helpers/served-demo-readiness.mjs';

test.use({serviceWorkers:'block',viewport:{width:390,height:844}});
test.beforeEach(async({context,baseURL})=>{
 await context.route('**/*',route=>{
  const url=new URL(route.request().url());
  return url.origin===new URL(baseURL).origin?route.continue():route.abort();
 });
 await context.addInitScript(()=>{
  sessionStorage.setItem('rakeezx-demo-session-v1','preparing');
 });
});

async function setup(page){
 await page.clock.setFixedTime(new Date('2026-09-09T06:12:00+03:00'));
 await openReadyServedDemo(page,process.env.RAKEEZX_E2E_BASE_URL);
 const fixture=await page.evaluate(async()=>{
  const store=await import('/src/store.js');
  if(store.getActiveWorkspace()?.type!=='demo')throw Error('SYNTHETIC_DEMO_REQUIRED');
  const sectionA=await store.createSection({grade:5,label:'مختصر-أ'});
  const sectionB=await store.createSection({grade:6,label:'مختصر-ب'});
  const subjectA=await store.resolveSubjectSelection({token:'builtin:digital-skills'});
  const subjectB=await store.resolveSubjectSelection({token:'builtin:life-family-skills'});
  const teachingA=await store.createTeaching({sectionId:sectionA.id,subjectId:subjectA.id});
  const teachingB=await store.createTeaching({sectionId:sectionB.id,subjectId:subjectB.id});
  await store.addStudent(sectionA.id,'طالب تجريبي أول');
  await store.addStudent(sectionB.id,'طالب تجريبي ثان');
  const current=await store.ensureSession(teachingA.id,'2026-09-09',8,{
   startTime:'06:00',endTime:'06:50',status:'scheduled'
  });
  const upcoming=await store.ensureSession(teachingB.id,'2026-09-09',9,{
   startTime:'10:20',endTime:'11:05',status:'scheduled'
  });
  if(!current||!upcoming)throw Error('SYNTHETIC_HOME_SESSIONS_NOT_CREATED');
  return {
   currentId:current.id,upcomingId:upcoming.id,teachingA:teachingA.id,teachingB:teachingB.id,
   sectionA:sectionA.id,sectionB:sectionB.id,subjectA:subjectA.id,subjectB:subjectB.id,
   subjectNameA:subjectA.name,subjectNameB:subjectB.name,
   fullA:store.teachingLabel(teachingA),fullB:store.teachingLabel(teachingB)
  };
 });
 await page.goto('/#/');
 const focus=page.locator('.today-focus[data-session-id="'+fixture.currentId+'"]');
 const rest=page.locator('.home-session-row[data-session-id="'+fixture.upcomingId+'"]');
 await expect(focus).toBeVisible();
 await expect(rest).toBeVisible();
 return {fixture,focus,rest};
}

test('home Focus and remaining lesson rows show compact class/subjects on narrow screens only',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 const {fixture,focus,rest}=await setup(page);
 const focusLabel=focus.locator('.home-teaching-display');
 const restLabel=rest.locator('.home-teaching-display');
 for(const [node,original] of [[focusLabel,fixture.fullA],[restLabel,fixture.fullB]]){
  await expect(node).toHaveAttribute('title',original);
  await expect(node).toHaveAttribute('aria-label',original);
 }
 for(const width of [320,390,640]){
  await page.setViewportSize({width,height:844});
  await expect(focusLabel.locator('.home-teaching-display__short')).toBeVisible();
  await expect(focusLabel.locator('.home-teaching-display__full')).toBeHidden();
  await expect(restLabel.locator('.home-teaching-display__short')).toBeVisible();
  await expect(restLabel.locator('.home-teaching-display__full')).toBeHidden();
  await expect(focusLabel.locator('.home-teaching-display__short')).toHaveText('خامس/مختصر-أ · رقمية');
  await expect(restLabel.locator('.home-teaching-display__short')).toHaveText('سادس/مختصر-ب · حياتية وأسرية');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBe(true);
 }
 for(const width of [768,1280]){
  await page.setViewportSize({width,height:900});
  await expect(focusLabel.locator('.home-teaching-display__full')).toBeVisible();
  await expect(restLabel.locator('.home-teaching-display__full')).toBeVisible();
  await expect(focusLabel.locator('.home-teaching-display__short')).toBeHidden();
  await expect(restLabel.locator('.home-teaching-display__short')).toBeHidden();
  await expect(focusLabel.locator('.home-teaching-display__full')).toHaveText(fixture.fullA);
  await expect(restLabel.locator('.home-teaching-display__full')).toHaveText(fixture.fullB);
 }
 await expect(focus.locator('.home-lesson-class-link')).toHaveAttribute('href','#/teaching/'+fixture.teachingA);
 await expect(rest.locator('.home-session-state')).toHaveAttribute('href',new RegExp('/attendance\\?session='));
 expect(errors).toEqual([]);
});

test('compact view never modifies stored subjects, section identity, grades or session routing',async({page})=>{
 const {fixture,focus,rest}=await setup(page);
 const before=await page.evaluate(({sectionA,sectionB,subjectA,subjectB,teachingA,teachingB})=>{
  const s=window.store;
  return {
   sectionA:{id:s.getSection(sectionA)?.id,label:s.getSection(sectionA)?.label},
   sectionB:{id:s.getSection(sectionB)?.id,label:s.getSection(sectionB)?.label},
   subjectA:{id:s.getSubject(subjectA)?.id,name:s.getSubject(subjectA)?.name},
   subjectB:{id:s.getSubject(subjectB)?.id,name:s.getSubject(subjectB)?.name},
   teachingA:s.getTeaching(teachingA)?.subjectId,
   teachingB:s.getTeaching(teachingB)?.subjectId
  };
 },fixture);
 await page.setViewportSize({width:320,height:720});
 await expect(focus.locator('.home-teaching-display__short')).toBeVisible();
 await expect(rest.locator('.home-teaching-display__short')).toBeVisible();
 await page.setViewportSize({width:1280,height:840});
 await expect(focus.locator('.home-teaching-display__full')).toBeVisible();
 const after=await page.evaluate(({sectionA,sectionB,subjectA,subjectB,teachingA,teachingB})=>{
  const s=window.store;
  return {
   sectionA:{id:s.getSection(sectionA)?.id,label:s.getSection(sectionA)?.label},
   sectionB:{id:s.getSection(sectionB)?.id,label:s.getSection(sectionB)?.label},
   subjectA:{id:s.getSubject(subjectA)?.id,name:s.getSubject(subjectA)?.name},
   subjectB:{id:s.getSubject(subjectB)?.id,name:s.getSubject(subjectB)?.name},
   teachingA:s.getTeaching(teachingA)?.subjectId,
   teachingB:s.getTeaching(teachingB)?.subjectId
  };
 },fixture);
 expect(after).toEqual(before);
 expect(before.subjectA.name).toBe('المهارات الرقمية');
 expect(before.subjectB.name).toBe('الحياتية والأسرية');
});
