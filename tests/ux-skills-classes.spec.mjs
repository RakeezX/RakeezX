import {test, expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {mkdir} from 'node:fs/promises';

const phase=process.env.UX_CLASSES_PHASE||'before';
const out='test-results/ux-skills-compare/classes-'+phase;

test('Classes overview: 24 synthetic classes across three grades',async({page})=>{
 await mkdir(out,{recursive:true});
 await page.route('**/*',route=>{
  const u=new URL(route.request().url());
  if(u.origin==='http://127.0.0.1:5194' && ['GET','HEAD'].includes(route.request().method())) return route.continue();
  return route.abort('blockedbyclient');
 });
 await page.goto('/#/',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.store?.state?.ready===true,null,{timeout:25000});
 const count=await page.evaluate(async()=>{
  const plan=[[4,9],[5,8],[6,7]];
  let total=0;
  for(const [grade,size] of plan){
   for(let i=1;i<=size;i++){
    const sec=await window.store.createSection({grade,label:String(i)});
    await window.store.createTeaching({sectionId:sec.id});
    total++;
   }
  }
  return total;
 });
 expect(count).toBe(24);
 const readings=[];
 for(const width of [320,390,768,1280]){
  await page.setViewportSize({width,height:844});
  await page.goto('/#/classes');
  const cards=page.locator('.classes-page .class-card');
  await expect(cards).toHaveCount(24);
  const m=await page.evaluate(()=>{
   const grid=document.querySelector('.classes-page .class-cards-grid');
   const cards=[...grid.querySelectorAll('.class-card')];
   const a=cards.map(n=>n.getBoundingClientRect());
   const textClip=cards.filter(n=>{
    const el=n.querySelector('.class-card__title');
    return el.scrollWidth>el.clientWidth+2||el.scrollHeight>el.clientHeight+2;
   }).length;
   return {
    width:innerWidth,documentWidth:document.documentElement.scrollWidth,
    columns:getComputedStyle(grid).gridTemplateColumns,
    cardCount:cards.length,cardRows:new Set(a.map(x=>Math.round(x.top))).size,
    gridHeight:Math.round(grid.getBoundingClientRect().height),
    minCardHeight:Math.round(Math.min(...a.map(x=>x.height))),
    clippedTitles:textClip,
    accessibleNames:cards.map(n=>n.querySelector('.class-card__title')?.getAttribute('aria-label')).slice(0,3)
   };
  });
  readings.push(m);
  await page.screenshot({path:out+'/classes-'+width+'.png',animations:'disabled'});
  expect(m.documentWidth).toBeLessThanOrEqual(width);
 }
 const violations=(await new AxeBuilder({page}).include('.classes-page').withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze()).violations;
 console.log('UX_CLASSES='+JSON.stringify({phase,readings,axe:violations.map(x=>({id:x.id,nodes:x.nodes.length,summary:x.nodes[0]?.failureSummary?.slice(0,160)}))}));
 expect(violations).toHaveLength(0);
 expect(readings.every(x=>x.cardCount===24&&x.clippedTitles===0)).toBe(true);
 expect(readings.find(x=>x.width===320)?.cardRows).toBe(12);
 expect(readings.find(x=>x.width===390)?.cardRows).toBe(12);
 expect(readings.find(x=>x.width===320)?.gridHeight).toBeLessThan(1600);
});
