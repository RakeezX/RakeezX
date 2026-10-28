import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {mkdir} from 'node:fs/promises';

const phase=process.env.UX_LESSON_PHASE||'before';
const out='test-results/ux-skills-compare/lesson-'+phase;
test('Attendance and Quick Log mobile teacher flow on synthetic local class',async({page})=>{
  await mkdir(out,{recursive:true});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>{
    const u=new URL(route.request().url());
    if(u.origin==='http://127.0.0.1:5194'&&['GET','HEAD'].includes(route.request().method()))return route.continue();
    return route.abort('blockedbyclient');
  });
  await page.goto('/#/',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.store?.state?.ready===true,null,{timeout:25000});
  const fixture=await page.evaluate(async()=>{
    const {todayISO}=await import('/src/models.js');
    const sec=await window.store.createSection({grade:5,label:'7'});
    const teaching=await window.store.createTeaching({sectionId:sec.id});
    const names=[
      'عبدالرحمن بن محمد بن عبدالعزيز بن عبدالله العتيبي',
      'أحمد فيصل بن أحمد محمد زهراني',
      'ليث','آدم','محمد عبدالعزيز صالح',
      'سلمان راشد الغامدي','صالح بن ناصر بن صالح الهاشمي',
      'أنس مازن عبدالرحمن','خالد عوض المسعودي','إبراهيم محمد الفيفي',
      'عبدالملك خالد الشريف','بدر يزن الجهني',
    ];
    const result=await window.store.importStudents(sec.id,names);
    const session=await window.store.ensureSession(teaching.id,todayISO(),1);
    return {id:teaching.id,added:result.added,session:session?.id,sessionStatus:session?.status};
  });
  expect(fixture.added).toBe(12);
  expect(fixture.session).toBeTruthy();
  const measures=[];
  for(const theme of ['light','dark']){
    for(const width of [320,390,768,1280]){
      await page.setViewportSize({width,height:844});
      for(const view of [
        {name:'attendance',path:'/teaching/'+fixture.id+'/attendance',selector:'.attendance-01c'},
        {name:'quicklog',path:'/teaching/'+fixture.id+'/quicklog',selector:'.quicklog-page'}
      ]){
        await page.goto('/#'+view.path,{waitUntil:'domcontentloaded'});
        await page.locator(view.selector).waitFor({timeout:15000});
        await page.evaluate(t=>{document.documentElement.dataset.theme=t;},theme);
        if(view.name==='attendance')await page.locator('.attendance-01c__row').first().waitFor({timeout:10000});
        else await page.locator('.qlcard').first().waitFor({timeout:10000});
        const info=await page.evaluate(kind=>{
          const att=document.querySelector('.attendance-01c'),ql=document.querySelector('.quicklog-page');
          const container=kind==='attendance'?att:ql;
          const rows=[...container.querySelectorAll(kind==='attendance'?'.attendance-01c__row':'.qlcard')];
          const toolbar=kind==='attendance'?container.querySelector('.attendance-01c__toolbar'):container.querySelector('.quicklog-toolbar');
          const statusBtns=kind==='attendance'?[...rows[0].querySelectorAll('.attendance-01c__status')]:[];
          const qrBtns=kind==='quicklog'?[...rows[0].querySelectorAll('.qlcard__hit,.qlcard__minus')]:[];
          const toolbarHeight=toolbar?.getBoundingClientRect().height??0;
          const rowHeight=rows[0]?.getBoundingClientRect().height??0;
          const tr=toolbar?.getBoundingClientRect();
          const grid=kind==='quicklog'?container.querySelector('.ql-grid'):null;
          const name=kind==='attendance'?rows[0]?.querySelector('.att-row__name strong'):rows[0]?.querySelector('.qlcard__name');
          const nameBox=name?.getBoundingClientRect();
          return {
            width:innerWidth,documentWidth:document.documentElement.scrollWidth,
            rowCount:rows.length,toolbarHeight:Math.round(toolbarHeight),
            rowHeight:Math.round(rowHeight),firstRowTop:Math.round(rows[0]?.getBoundingClientRect().top??0),
            toolbarTop:Math.round(tr?.top??0),columns:grid?getComputedStyle(grid).gridTemplateColumns:null,
            statusButtons:statusBtns.map(n=>({width:Math.round(n.getBoundingClientRect().width),height:Math.round(n.getBoundingClientRect().height),text:n.innerText})),
            quickButtons:qrBtns.map(n=>({width:Math.round(n.getBoundingClientRect().width),height:Math.round(n.getBoundingClientRect().height)})),
            nameFont:name?getComputedStyle(name).fontSize:null,nameHeight:Math.round(nameBox?.height??0),
            quickFiltersHeight:ql?.querySelector('.quicklog-filter-bar')?.getBoundingClientRect().height??null,
            quickModesHeight:ql?.querySelector('.quicklog__modes')?.getBoundingClientRect().height??null,
            attContextHeight:att?.querySelector('.attendance-01c__context')?.getBoundingClientRect().height??null,
            attProgressHeight:att?.querySelector('.attendance-01c__progress')?.getBoundingClientRect().height??null,
          };
        },view.name);
        await page.screenshot({path:out+'/'+view.name+'-'+width+'-'+theme+'.png',animations:'disabled'});
        measures.push({theme,view:view.name,...info});
        expect(info.documentWidth).toBeLessThanOrEqual(width);
      }
    }
  }
  const axe=[];
  for(const v of [{name:'attendance',path:'/teaching/'+fixture.id+'/attendance',selector:'.attendance-01c'},
                  {name:'quicklog',path:'/teaching/'+fixture.id+'/quicklog',selector:'.quicklog-page'}]){
    await page.goto('/#'+v.path);await page.locator(v.selector).waitFor();
    const results=(await new AxeBuilder({page}).include(v.selector).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze()).violations;
    axe.push({name:v.name,violations:results.map(x=>({id:x.id,impact:x.impact,nodes:x.nodes.map(n=>({target:n.target,detail:n.failureSummary?.slice(0,160)}))}))});
  }
  console.log('UX_LESSON='+JSON.stringify({phase,fixture,measures,axe,errors}));
  expect(errors).toEqual([]);
});
