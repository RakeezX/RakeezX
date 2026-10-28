import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('Class list, hub and roster remain accessible on small screens in both themes and reduced motion',async({page})=>{
  await page.route('**/*',route=>{
    const u=new URL(route.request().url());
    if(u.origin==='http://127.0.0.1:5194' && ['GET','HEAD'].includes(route.request().method()))return route.continue();
    return route.abort('blockedbyclient');
  });
  await page.goto('/#/',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.store?.state?.ready===true,null,{timeout:25000});
  const id=await page.evaluate(async()=>{
    const section=await window.store.createSection({grade:5,label:'6'});
    const teaching=await window.store.createTeaching({sectionId:section.id});
    await window.store.importStudents(section.id,['عبدالعزيز بن محمد بن عبدالرحمن العتيبي','آدم','أصيل فيصل جميل الغامدي']);
    return teaching.id;
  });
  const evidence=[];
  await page.emulateMedia({reducedMotion:'reduce'});
  for(const width of [320,1280]){
    await page.setViewportSize({width,height:844});
    for(const theme of ['light','dark']){
      for(const view of [
        {name:'classes',path:'/classes',selector:'.classes-page'},
        {name:'class-hub',path:'/teaching/'+id,selector:'.class-hub'},
        {name:'roster',path:'/teaching/'+id+'/students',selector:'.students-roster-page'}
      ]){
        await page.goto('/#'+view.path);
        await page.locator(view.selector).waitFor();
        await page.evaluate(t=>{document.documentElement.dataset.theme=t;},theme);
        const scan=(await new AxeBuilder({page}).include(view.selector).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze()).violations;
        const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
        const duration=view.name==='class-hub'?await page.locator('.class-tool-card').first().evaluate(n=>getComputedStyle(n).transitionDuration):null;
        evidence.push({width,theme,view:view.name,violations:scan.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.length})),overflow,transitionDuration:duration});
        expect(scan,view.name+'@'+width+'/'+theme).toHaveLength(0);
        expect(overflow).toBe(false);
      }
    }
  }
  console.log('UX_ACCESSIBILITY='+JSON.stringify(evidence));
  expect(evidence.filter(v=>v.view==='class-hub').every(v=>v.transitionDuration==='0s')).toBe(true);
});
