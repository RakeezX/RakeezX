import {test,expect} from '@playwright/test';
import {openReadyServedDemo} from './helpers/served-demo-readiness.mjs';

test.use({viewport:{width:320,height:844},serviceWorkers:'block'});
test.beforeEach(async({context})=>{
 await context.route('**/*',route=>{
   const url=new URL(route.request().url());
   return url.origin==='http://127.0.0.1:5198'&&['GET','HEAD'].includes(route.request().method())
     ?route.continue():route.abort('blockedbyclient');
 });
 await context.addInitScript(()=>sessionStorage.setItem('rakeezx-demo-session-v1','preparing'));
});
async function makeFixture(page){
 await page.clock.setFixedTime(new Date('2026-09-09T08:20:00+03:00'));
 await openReadyServedDemo(page,'http://127.0.0.1:5198');
 const fixture=await page.evaluate(async()=>{
   const store=await import('/src/store.js');
   if(store.getActiveWorkspace()?.type!=='demo')throw Error('DEMO_ONLY');
   const results=[];
   for(const [index,label] of ['51','52','53'].entries()){
     const section=await store.createSection({grade:5,label});
     const tch=await store.createTeaching({sectionId:section.id});
     await store.addStudent(section.id,'طالب تجريبي افتراضي');
     if(index<2){
       const session=await store.ensureSession(tch.id,'2026-09-09',1);
       if(index===0)await store.setAttendance(session.id,store.students(tch.id)[0].id,'present');
     }
     results.push({id:tch.id,label,index});
   }
   return results;
 });
 await page.goto('/#/classes');
 return fixture;
}
test('mobile class card displays complete compact name next to any status',async({page})=>{
 const fixtures=await makeFixture(page);
 const evidence=[];
 for(const width of [320,360,390,430,520,768]){
   await page.setViewportSize({width,height:844});
   for(const f of fixtures){
     const card=page.locator('a.class-card__main[href="#/teaching/'+f.id+'"]');
     await expect(card).toBeVisible();
     const item=await card.evaluate(el=>{
       const head=el.querySelector('.class-card__head');
       const title=el.querySelector('.class-card__title');
       const name=title.querySelector('.n133-short-name');
       const badge=head.querySelector('.badge');
       const h=head.getBoundingClientRect();
       const n=name.getBoundingClientRect();
       const tag=badge?.getBoundingClientRect();
       return {full:title.getAttribute('title'),compact:name.textContent.trim(),
         hasBadge:!!badge,badgeText:badge?.textContent.trim()||'',headHeight:Math.round(h.height),
         titleClipped:name.scrollWidth>name.clientWidth+1||title.scrollWidth>title.clientWidth+1,
         titleWidth:Math.round(n.width),nameTextWidth:name.scrollWidth,
         badgeSeparate:!!tag&&tag.top>=n.bottom-1, badgeWidth:Math.round(tag?.width||0),
         documentWidth:document.documentElement.scrollWidth};
     });
     evidence.push({width,index:f.index,...item});
     expect(item.documentWidth).toBeLessThanOrEqual(width);
     if(width<=520){
       expect(item.titleClipped,'Full compact name visible '+width+' '+item.badgeText).toBe(false);
       if(item.hasBadge)expect(item.badgeSeparate,'Badge separate line '+width).toBe(true);
     }
   }
 }
 console.log('CLASS_BADGE_EVIDENCE='+JSON.stringify(evidence));
 await page.setViewportSize({width:320,height:844});
 await page.screenshot({path:'test-results/n135-class-badge-320.png'});
});
