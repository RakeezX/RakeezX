import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile, mkdir, writeFile } from 'node:fs/promises';

test.setTimeout(480000);
const reportDir='artifacts/ux-system-audit-v1';
const run=process.env.UX_AUDIT_RUN||'candidate';
const router=await readFile('src/router.js','utf8');
const declarations=[...router.matchAll(/\{\s*path:\s*['"]([^'"]+)['"]/g)].map(m=>m[1]);
const exclusions=[
  {test:p=>p.includes('student-portal')||p.includes('/portal')||p.includes('n88-invite'),why:'N88 student access is actively owned by a separate worker'},
  {test:p=>p.includes('/koshoof')||p==='/classes/import',why:'N36/N107 import & shared persistence are outside this UX pilot'},
  {test:p=>p.includes('/settings/notifications'),why:'N44 notifications are actively owned by a separate worker'},
  {test:p=>p.startsWith('/archive/year/'),why:'historical year/term requires archived state not present in demo'}
];
const safe=declarations.filter(p=>!exclusions.some(x=>x.test(p)));
const skipped=declarations.filter(p=>!safe.includes(p)).map(path=>({path,reason:exclusions.find(x=>x.test(path)).why}));

async function demo(page,browserName){
  // Keep the seeded academic term stable in every engine, independent of the host clock.
  await page.clock.setFixedTime(new Date('2026-09-09T08:20:00+03:00'));
  await page.route('**/*',route=>{
    const u=new URL(route.request().url());
    if(u.origin==='http://127.0.0.1:5194'&&['GET','HEAD'].includes(route.request().method()))return route.continue();
    return route.abort('blockedbyclient');
  });
  if(browserName==='chromium'){
    await page.context().addInitScript(()=>sessionStorage.setItem('rakeezx-demo-session-v1','preparing'));
    await page.goto('/#/classes',{waitUntil:'domcontentloaded'});
  }else{
    // WebKit/Firefox: initialize an isolated dev shell once, then request the non-forced Demo.
    // Re-forcing the preparing session on every navigation can stall WebKit bootstrap.
    await page.goto('/#/',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.store?.state?.ready===true&&!!document.querySelector('.layout'),null,{timeout:40000});
    await page.waitForTimeout(4500); // Let the initial dev bootstrap and its DB activity settle before switching workspace.
    await page.evaluate(()=>sessionStorage.setItem('rakeezx-demo-session-v1','active'));
    await page.goto('/#/classes',{waitUntil:'domcontentloaded'});
  }
  await page.locator('.boot').waitFor({state:'detached',timeout:55000});
  await page.waitForFunction(async()=>{
    const store=await import('/src/store.js');
    return store.state.ready && store.getActiveWorkspace()?.type==='demo' && store.teachings().length>0;
  },null,{timeout:45000});
  if(browserName!=='chromium')await page.waitForTimeout(1200); // Stabilize Demo state after the workspace switch.
  return page.evaluate(async()=>{
    const store=await import('/src/store.js');
    return {teaching:store.teachings()[0].id,student:store.state.students[0]?.id,
      year:store.activeYear()?.id,term:store.activeTerm()?.id,
      demoClasses:store.teachings().length,demoStudents:store.state.students.length};
  });
}
function resolveRoute(pattern,ids){
  return pattern.replaceAll(':yearId',encodeURIComponent(ids.year??'none'))
    .replaceAll(':termId',encodeURIComponent(ids.term??'none'))
    .replaceAll(':id',encodeURIComponent(pattern.startsWith('/student/')?ids.student:ids.teaching));
}
test('system-wide safe read-only UX inventory and defect fingerprint in Demo',async({page,browserName})=>{
 await mkdir(reportDir,{recursive:true});
 const ids=await demo(page,browserName);
 const browserErrors=[];
 page.on('pageerror',e=>browserErrors.push({route:page.url().split('#')[1],message:e.message}));
 const results=[];
 for(let i=0;i<safe.length;i++){
  const template=safe[i];
  const route=resolveRoute(template,ids);
  const item={template,route,states:[],status:'scanned'};
  for(const [width,theme] of [[320,'light'],[390,'dark'],[1280,'light']]){
   await page.setViewportSize({width,height:844});
   try{
    await page.goto('/#'+route,{waitUntil:'domcontentloaded',timeout:18000});
    await page.locator('.layout').waitFor({timeout:16000});
    await page.evaluate(t=>{document.documentElement.dataset.theme=t;},theme);
    await page.waitForTimeout(110);
    const metrics=await page.evaluate(()=>{
      const root=document.querySelector('.page')??document.querySelector('.layout');
      const doc=document.documentElement;
      const rect=root?.getBoundingClientRect();
      const visible=el=>{const cs=getComputedStyle(el),r=el.getBoundingClientRect();return cs.visibility!=='hidden'&&cs.display!=='none'&&r.width>0&&r.height>0;};
      const buttons=[...document.querySelectorAll('button,a,[role="button"]')].filter(el=>visible(el)&&!el.matches('.skip-link'));
      const small=buttons.filter(el=>{
        const r=el.getBoundingClientRect();
        return r.height<39.5&&r.width<39.5&&r.top>=0&&r.top<innerHeight;
      }).slice(0,14).map(el=>({tag:el.tagName,text:(el.getAttribute('aria-label')||el.innerText||'').trim().slice(0,45),w:Math.round(el.getBoundingClientRect().width),h:Math.round(el.getBoundingClientRect().height),cls:el.className?.baseVal??String(el.className).slice(0,85)}));
      const clippedControls=buttons.filter(el=>{
        const r=el.getBoundingClientRect();
        return (r.left < -2||r.right > innerWidth+2)&&r.top>=0&&r.top<innerHeight;
      }).slice(0,12).map(el=>({label:(el.getAttribute('aria-label')||el.innerText||'').trim().slice(0,40),left:Math.round(el.getBoundingClientRect().left),right:Math.round(el.getBoundingClientRect().right)}));
      const failedScreen=document.querySelector('.route-error,.not-found,[role="alert"]');
      return {width:innerWidth,documentWidth:doc.scrollWidth,bodyWidth:document.body.scrollWidth,
        rootWidth:Math.round(rect?.width||0),pageText:(root?.innerText||'').slice(0,160),
        buttons:buttons.length,smallControls:small,clippedControls,
        failedScreenText:(failedScreen?.innerText||'').slice(0,110),
        header:(document.querySelector('.topbar__title')?.innerText||'').slice(0,60),
        dialogCount:document.querySelectorAll('[role="dialog"]:not([hidden])').length,
      };
    });
    const data={width,theme,metrics,violations:[]};
    if(width===320||width===390){
      const scan=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
      data.violations=scan.violations.map(v=>({rule:v.id,impact:v.impact,
        nodes:v.nodes.map(n=>({target:n.target?.slice(0,3),html:n.html?.slice(0,180),failure:n.failureSummary?.slice(0,170)})).slice(0,7),
        totalNodes:v.nodes.length}));
    }
    item.states.push(data);
   }catch(e){
    item.states.push({width,theme,error:e.message.slice(0,300)});
    item.status='partial';
   }
  }
  results.push(item);
  if((i+1)%5===0||i===safe.length-1)console.log('AUDIT_PROGRESS='+JSON.stringify({done:i+1,total:safe.length,
    route:template,issues:results.filter(x=>x.states.some(s=>s.violations?.length||s.metrics?.documentWidth>s.width||s.error)).length}));
 }
 const failures=results.filter(x=>x.states.some(s=>s.error||s.metrics?.documentWidth>s.width));
 const axe=results.filter(x=>x.states.some(s=>s.violations?.length));
 const serious=axe.filter(x=>x.states.some(s=>s.violations?.some(v=>['serious','critical'].includes(v.impact))));
 const overflow=results.filter(x=>x.states.some(s=>s.metrics?.documentWidth>s.width));
 const summary={declaredRoutes:declarations.length,attempted:safe.length,excluded:skipped.length,
   fullyScanned:results.filter(r=>r.states.length===3&&r.states.every(s=>!s.error)).length,
   withAxeFindings:axe.length,withSeriousOrCritical:serious.length,withHorizontalOverflow:overflow.length,
   loadFailures:failures.filter(x=>x.states.some(s=>s.error)).length,
   rules:[...new Set(results.flatMap(x=>x.states.flatMap(s=>(s.violations??[]).map(v=>v.rule))))],
   topRoutes:results.filter(x=>x.states.some(s=>s.violations?.length||s.metrics?.documentWidth>s.width||s.error))
    .map(x=>({path:x.template,rules:[...new Set(x.states.flatMap(s=>(s.violations??[]).map(v=>v.rule)))],
       overflow:x.states.some(s=>s.metrics?.documentWidth>s.width),
       smallTouch:x.states[0]?.metrics?.smallControls?.length??0,error:x.states.find(s=>s.error)?.error?.slice(0,100)??null})),
   browserErrors:browserErrors.slice(0,20)};
 const artifact={source:'isolated DEMO only, no accounts or backend; 320 light, 390 dark, 1280 light; axe at 320 and 390',
    ids:{demoClasses:ids.demoClasses,demoStudents:ids.demoStudents},summary,skipped,routes:results};
 await writeFile(reportDir+'/system-ux-audit-'+run+'-'+browserName+'.json',JSON.stringify(artifact,null,2),'utf8');
 await writeFile(reportDir+'/system-ux-audit-summary-'+run+'-'+browserName+'.md',[
  '# Rakeez UX audit V1',
  '',
  '**Scope:** isolated synthetic demo; 39 router declarations; 320 light/390 dark/1280 light; axe WCAG at 320 and 390.',
  '**Important:** not a Production audit, and does not test all user interactions or service responses.',
  '',
  '| Metric | Value |','|---|---:|',
  '| Declared route templates | '+summary.declaredRoutes+' |',
  '| Safe route templates attempted | '+summary.attempted+' |',
  '| Intentionally excluded | '+summary.excluded+' |',
  '| All 3 viewports scanned | '+summary.fullyScanned+' |',
  '| Routes with axe findings | '+summary.withAxeFindings+' |',
  '| Serious / critical axe finding routes | '+summary.withSeriousOrCritical+' |',
  '| Horizontal overflow routes | '+summary.withHorizontalOverflow+' |',
  '| Route load failures | '+summary.loadFailures+' |',
  '',
  '## Findings by route',
  ...summary.topRoutes.map(x=>'- '+x.path+': '+[x.rules.join(', ')||'no axe',x.overflow?'horizontal overflow':'',x.error||''].filter(Boolean).join('; ')),
  '',
  '## Excluded',
  ...skipped.map(x=>'- '+x.path+' — '+x.reason),
  '',
  'Raw per-view elements, errors and selector evidence are in system-ux-audit-'+run+'-'+browserName+'.json.'
 ].join('\n'),'utf8');
 console.log('SYSTEM_UX_AUDIT='+JSON.stringify({run,browserName,...summary}));
 if(process.env.UX_SYSTEM_QUALITY_GATE==='1'){
   expect(summary.fullyScanned,'All allowed routes/widths must render').toBe(summary.attempted);
   expect(summary.withSeriousOrCritical,'No serious or critical WCAG finding').toBe(0);
   expect(summary.withHorizontalOverflow,'No page-level overflow').toBe(0);
   expect(summary.loadFailures,'No route rendering failure').toBe(0);
 }
});
