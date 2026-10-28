import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir } from 'node:fs/promises';
const phase = process.env.UX_SKILLS_PHASE || 'baseline';
const dir = 'test-results/ux-skills-compare/' + phase;
const widths = [320, 390, 768, 1280];
const names = [
'عبدالعزيز بن محمد بن عبدالرحمن بن عبدالعزيز العتيبي',
'عبدالرحمن محمد عبدالرحمن عبدالعزيز بن عبدالله بن محمد بن إبراهيم آل الشيخ',
'آدم','ليث','عبد الله بن عبدالرحمن بن عبدالله بن محمد بن إبراهيم آل الشيخ',
'عبدالرحمن محمد أحمد القحطاني العسيري','خالد عبدالعزيز محمد السلمي',
'أصيل فيصل جميل الغامدي','يزن بدر الهاشمي','محمد أحمد يوسف الأحمري',
'أحمد بن فهد بن صالح بن إبراهيم','عبدالإله محمد صالح','علي عبدالرحمن صالح',
'يوسف عبدالعزيز محمد','راشد خالد الفيفي','مازن فهد زهراني',
'عبدالمحسن عبدالله عبدالرحمن','أحمد فيصل آل محمد',
'بدر عبدالعزيز بن سليمان بن عمر','عمر حسن آل عباس',
'عبدالرحمن أحمد عبدالوهاب','محمد خالد حمزة',
'نايف عبدالمجيد عبدالله','أنس بن إبراهيم الحميدي'];
async function setup(page) {
  await page.route('**/*',route=>{
    const u=new URL(route.request().url());
    if(u.origin==='http://127.0.0.1:5194' && ['GET','HEAD'].includes(route.request().method())) return route.continue();
    return route.abort('blockedbyclient');
  });
  await page.goto('/#/', {waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.store?.state?.ready===true,null,{timeout:25000});
}
async function seed(page,dataset,label) {
  return page.evaluate(async({dataset,label})=>{
    const section=await window.store.createSection({grade:5,label});
    const teaching=await window.store.createTeaching({sectionId:section.id});
    const result=await window.store.importStudents(section.id,dataset);
    return {id:teaching.id,added:result.added};
  },{dataset,label});
}
async function scan(page,route,width,theme) {
  await page.setViewportSize({width,height:844});
  await page.goto(route,{waitUntil:'domcontentloaded'});
  await page.evaluate(t=>{document.documentElement.dataset.theme=t;},theme);
  await page.locator(route.endsWith('/students')?'.students-roster-page':'.class-hub').waitFor();
  const m=await page.evaluate(()=>{
    const roster=document.querySelector('.students-roster-page');
    const hub=document.querySelector('.class-hub');
    const titles=[...document.querySelectorAll('.roster-row .row__title')];
    const clipped=titles.filter(n=>n.scrollWidth>n.clientWidth+2 || n.scrollHeight>n.clientHeight+2).length;
    const issues=[];
    for(const [i,n] of [...document.querySelectorAll('.roster-row')].entries()){
      const a=n.querySelector('.row__main')?.getBoundingClientRect(),b=n.querySelector('[data-act="edit"]')?.getBoundingClientRect();
      if(a&&b&&Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left))>2)issues.push('overlap:'+i);
      if(b&&(b.width<43.5||b.height<43.5))issues.push('small-edit:'+i);
    }
    const s=roster?.querySelector('.roster-summary'),cs=s&&getComputedStyle(s);
    const first=titles[0],fs=first&&getComputedStyle(first);
    const hubBtn=hub?.querySelector('.class-name-switcher-btn');
    return {width:innerWidth,documentWidth:document.documentElement.scrollWidth,
      rowCount:roster?.querySelectorAll('.roster-row').length,nameClipped:clipped,
      summaryText:s?.innerText,summaryColor:cs?.color,summaryBg:cs?.backgroundColor,
      firstNameFont:fs?.fontSize,firstNameHeight:first?.getBoundingClientRect().height,
      editIssues:issues,tools:hub?.querySelectorAll('.class-tool-card').length,
      hubName:hubBtn?.getAttribute('aria-label'),hubTitleWidth:hubBtn?.getBoundingClientRect().width,
      hubTitleScroll:hubBtn?.scrollWidth};
  });
  await page.screenshot({path:dir+'/'+(route.endsWith('/students')?'roster':'hub')+'-'+width+'-'+theme+'.png',animations:'disabled'});
  return m;
}
test('two-page pilot with 24 Arabic names and responsive themes',async({page})=>{
  await mkdir(dir,{recursive:true});
  await setup(page);
  const fixture=await seed(page,names,'1');
  expect(fixture.added).toBe(24);
  const evidence=[];
  for(const theme of ['light','dark'])for(const width of widths){
    evidence.push({theme,width,
      hub:await scan(page,'/#/teaching/'+fixture.id,width,theme),
      roster:await scan(page,'/#/teaching/'+fixture.id+'/students',width,theme)});
  }
  const axe=[];
  for(const pair of [{r:'/#/teaching/'+fixture.id,s:'.class-hub'},{r:'/#/teaching/'+fixture.id+'/students',s:'.students-roster-page'}]){
    await page.goto(pair.r);
    await page.evaluate(()=>{document.documentElement.dataset.theme='light'});
    const res=await new AxeBuilder({page}).include(pair.s).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
    axe.push({surface:pair.s,violations:res.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary?.slice(0,160)}))}))});
  }
  console.log('UX_EVIDENCE='+JSON.stringify({phase,evidence,axe}));
  expect(evidence.every(x=>x.hub.documentWidth<=x.width&&x.roster.documentWidth<=x.width)).toBe(true);
});
test('single and empty student roster with edit control',async({page})=>{
  await setup(page);
  const empty=await seed(page,[],'2');
  await page.goto('/#/teaching/'+empty.id+'/students');
  const emptyText=(await page.locator('.students-roster-page').innerText()).slice(0,140);
  const one=await seed(page,['آدم'],'3');
  await page.goto('/#/teaching/'+one.id+'/students');
  const oneText=await page.locator('.roster-summary').innerText();
  await page.locator('.roster-row [data-act="edit"]').click();
  const dialogCount=await page.getByRole('dialog').count();
  console.log('UX_EDGE='+JSON.stringify({phase,emptyText,oneText,dialogCount}));
  expect(dialogCount).toBeGreaterThan(0);
});
