import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {mkdir} from 'node:fs/promises';

const phase=process.env.UX_SCHEDULE_PHASE||'baseline';
const dir='test-results/ux-skills-compare/schedule-'+phase;
const widths=[320,390,768,1280];

async function setup(page){
 await page.clock.setFixedTime(new Date('2026-09-09T08:20:00+03:00'));
 await page.route('**/*',route=>{
  const u=new URL(route.request().url());
  if(u.origin==='http://127.0.0.1:5194'&&['GET','HEAD'].includes(route.request().method()))return route.continue();
  return route.abort('blockedbyclient');
 });
 await page.goto('/#/',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.store?.state?.ready===true,null,{timeout:25000});
 return page.evaluate(async()=>{
  const store=window.store;
  const profile={id:'ux-schedule-profile-'+Date.now(),name:'توقيت تجربة الواجهة',
   periods:[{period:1,start:'07:00',end:'07:45'},{period:2,start:'07:50',end:'08:35'},{period:3,start:'08:40',end:'09:25'},
    {period:4,start:'09:45',end:'10:30'},{period:5,start:'10:35',end:'11:20'},{period:6,start:'11:25',end:'12:10'}],
   overrides:{config:{recess:{enabled:false}}}};
  await store.save({timeProfiles:[profile]});
  await store.setActiveTimeProfile(profile.id);
  const a=await store.createSection({grade:4,label:'1'});
  const b=await store.createSection({grade:5,label:'2'});
  const c=await store.createSection({grade:6,label:'7'});
  const subjects=store.subjects();
  const digital=subjects.find(s=>String(s.name).includes('رقمية'));
  const teachings=[];
  for(const sec of [a,b,c]){
   const tch=await store.createTeaching({sectionId:sec.id,subjectId:digital?.id});
   teachings.push(tch);
   await store.importStudents(sec.id,['آدم محمد الفيفي','أحمد فيصل بن أحمد زهراني','عبدالرحمن بن محمد بن عبدالعزيز الغامدي']);
  }
  for(let day=0;day<=4;day++){
   for(let period=1;period<=6;period++){
    const tch=teachings[(day+period)%3];
    await store.addSlot(tch.id,day,period);
   }
  }
  const day='2026-09-09',times=['07:00','07:50','08:40','09:45','10:35','11:25'],ends=['07:45','08:35','09:25','10:30','11:20','12:10'];
  const sessionIds=[];
  for(let i=0;i<6;i++){
   const tch=teachings[(3+i+1)%3];
   const s=await store.ensureSession(tch.id,day,i+1,{startTime:times[i],endTime:ends[i],status:'scheduled'});
   if(s)sessionIds.push(s.id);
  }
  return {teachings:teachings.map(t=>t.id),sessionIds,profile:profile.id,slotCount:store.allSlots().length};
 });
}
async function readMeasure(page,view){
 return page.evaluate(view=>{
 const q=s=>document.querySelector(s);
 const box=s=>q(s)?.getBoundingClientRect();
 const geo=b=>b?{top:Math.round(b.top),height:Math.round(b.height),width:Math.round(b.width)}:null;
 const controls=[...document.querySelectorAll('.page--schedule .slot__actions .iconbtn')].filter(el=>el.getBoundingClientRect().width>0);
 const tabs=[...document.querySelectorAll('.schedule-day-tab')];
 const slots=[...document.querySelectorAll('.week__day .slot')].filter(el=>el.getBoundingClientRect().width>0);
 const focus=q('.today-focus');
 const homeRows=[...document.querySelectorAll('.home-session-row')];
 const clip=el=>el&&el.scrollWidth>el.clientWidth+2;
 return {
  viewport:innerWidth,documentWidth:document.documentElement.scrollWidth,
  topbar:geo(box('.topbar')),scheduleHead:geo(box('.page--schedule .schedule-head')),
  scheduleSummary:geo(box('.page--schedule .n59-load-summary')),
  tabs:geo(box('.schedule-day-tabs')),tabColumns:q('.schedule-day-tabs')?getComputedStyle(q('.schedule-day-tabs')).gridTemplateColumns:null,
  tabCount:tabs.length,tabSizes:tabs.map(t=>({w:Math.round(t.getBoundingClientRect().width),h:Math.round(t.getBoundingClientRect().height)})),
  visibleDays:[...document.querySelectorAll('.week__day')].filter(el=>getComputedStyle(el).display!=='none').length,
  slots:slots.length,firstSlot:geo(slots[0]?.getBoundingClientRect()),slotControls:controls.slice(0,2).map(el=>({w:Math.round(el.getBoundingClientRect().width),h:Math.round(el.getBoundingClientRect().height)})),
  clippedSlotTitles:slots.filter(el=>clip(el.querySelector('.slot__grade-sec strong'))).length,
  weekHeight:geo(box('.week')),
  todayFocus:geo(focus?.getBoundingClientRect()),homeRows:homeRows.length,
  firstHomeRow:geo(homeRows[0]?.getBoundingClientRect()),
  focusAction:geo(box('.today-focus__action')),
  homeSessionWidth:homeRows.some(el=>el.getBoundingClientRect().right>innerWidth+1)
 };
 },view);
}
test('Schedule & daily home: dense synthetic week with touch/accessibility baselines',async({page})=>{
 await mkdir(dir,{recursive:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const seeded=await setup(page);
 expect(seeded.slotCount).toBeGreaterThanOrEqual(30);
 const measures=[];
 for(const theme of ['light','dark']){
  for(const width of widths){
   await page.setViewportSize({width,height:844});
   await page.goto('/#/schedule');
   await page.evaluate(t=>{document.documentElement.dataset.theme=t},theme);
   await page.locator('.page--schedule .week').waitFor({timeout:15000});
   const schedule=await readMeasure(page,'schedule');
   await page.screenshot({path:dir+'/schedule-'+width+'-'+theme+'.png',animations:'disabled'});
   await page.goto('/#/');
   await page.evaluate(t=>{document.documentElement.dataset.theme=t},theme);
   await page.locator('.page--home').waitFor({timeout:10000});
   const home=await readMeasure(page,'home');
   await page.screenshot({path:dir+'/home-'+width+'-'+theme+'.png',animations:'disabled'});
   measures.push({theme,width,schedule,home});
   expect(schedule.documentWidth).toBeLessThanOrEqual(width);
   expect(home.documentWidth).toBeLessThanOrEqual(width);
  }
 }
 const axe=[];
 for(const v of [{path:'/schedule',root:'.page--schedule'},{path:'/',root:'.page--home'}]){
  await page.goto('/#'+v.path);
  const node=page.locator(v.root);
  if(await node.count()){
   const res=(await new AxeBuilder({page}).include(v.root).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze()).violations;
   axe.push({page:v.path,violations:res.map(x=>({id:x.id,impact:x.impact,nodes:x.nodes.length,summary:x.nodes[0]?.failureSummary?.slice(0,120)}))});
  }
 }
 console.log('UX_SCHEDULE='+JSON.stringify({phase,seeded,measures,axe,errors}));
 expect(errors).toEqual([]);
});
test('Schedule mobile day keyboard selection preserves intended day and controls',async({page})=>{
 await setup(page);
 await page.setViewportSize({width:320,height:844});
 await page.goto('/#/schedule');
 const tabs=page.locator('.schedule-day-tab');
 await expect(tabs).toHaveCount(6);
 await page.locator('.schedule-day-tab[data-day="all"]').click();
 await expect(page.locator('.week__day:visible')).toHaveCount(5);
 await page.locator('.schedule-day-tab[data-day="3"]').click();
 await expect(page.locator('.week__day:visible')).toHaveCount(1);
 const selected=page.locator('.schedule-day-tab[aria-selected="true"]');
 await expect(selected).toHaveCount(1);
 await selected.focus();
 await page.keyboard.press('ArrowLeft');
 await expect(page.locator('.schedule-day-tab[aria-selected="true"]')).toHaveCount(1);
 const active=await page.locator('.schedule-day-tab[aria-selected="true"]').getAttribute('data-day');
 console.log('UX_SCHEDULE_KEY='+JSON.stringify({phase,active,selectedCount:1,visibleDays:await page.locator('.week__day:visible').count()}));
});


test('Schedule timing link is independently keyboard accessible, while disclosure and day tabs remain usable',async({page})=>{
 await setup(page);
 await page.goto('/#/schedule');
 await page.locator('.page--schedule .schedule-summary-shell').waitFor();
 const details=page.locator('.page--schedule .n59-load-summary');
 const summary=details.locator('summary');
 const timing=page.locator('.page--schedule .schedule-summary-profile-link');
 await expect(details).not.toHaveAttribute('open', '');
 await expect(timing).toHaveCount(1);
 await expect(timing).toHaveAttribute('href','#/schedule/times');
 const nested=await page.evaluate(()=>!!document.querySelector('.page--schedule summary a'));
 expect(nested).toBe(false);
 for(const width of [320,390,768]){
  await page.setViewportSize({width,height:844});
  await expect(timing).toBeVisible();
  const measurement=await page.evaluate(()=>{
    const tabs=[...document.querySelectorAll('.page--schedule .schedule-day-tab')];
    const link=document.querySelector('.page--schedule .schedule-summary-profile-link');
    const linkBounds=link.getBoundingClientRect();
    return {
      viewport:innerWidth,documentWidth:document.documentElement.scrollWidth,
      widths:tabs.map(el=>Math.round(el.getBoundingClientRect().width)),
      heights:tabs.map(el=>Math.round(el.getBoundingClientRect().height)),
      clipped:tabs.filter(el=>el.scrollWidth>el.clientWidth+1).map(el=>el.innerText),
      rows:new Set(tabs.map(el=>Math.round(el.getBoundingClientRect().top))).size,
      timingWidth:Math.round(linkBounds.width),timingHeight:Math.round(linkBounds.height)
    };
  });
  console.log('UX_SCHEDULE_TABS='+JSON.stringify({width,...measurement}));
  expect(measurement.documentWidth).toBeLessThanOrEqual(width);
  expect(measurement.widths.every(w=>w>=44)).toBe(true);
  expect(measurement.heights.every(h=>h>=44)).toBe(true);
  expect(measurement.clipped).toEqual([]);
  expect(measurement.rows).toBe(1);
  expect(measurement.timingHeight).toBeGreaterThanOrEqual(44);
 }
 await summary.click();
 await expect(details).toHaveAttribute('open','');
 await expect(details.locator('.n59-load-row')).toHaveCount(3);
 await summary.click();
 await expect(details).not.toHaveAttribute('open','');
 await timing.focus();
 const focus=await timing.evaluate(el=>({active:document.activeElement===el,outline:getComputedStyle(el).outlineStyle}));
 expect(focus.active).toBe(true);
 await timing.click();
 await expect(page).toHaveURL(/#\/schedule\/times/);
 console.log('UX_TIMING_LINK='+JSON.stringify({independent:true,rows:3,disclosure:true,navigation:true,focus}));
});
