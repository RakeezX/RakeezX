import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import {readFile,writeFile} from 'node:fs/promises';
import {withIsolatedLocalBrowser} from 'file:///C:/Users/Abody/Projects/RakeezX/scripts/ops-supervisor-v4/isolated-local-browser.mjs';
import {openReadyServedDemo} from '../helpers/served-demo-readiness.mjs';
const root=process.cwd(),taskId='continuous-n124-compact-attendance-action-20261019';
const runId=process.env.N124_RUN_ID;
assert.ok(runId,'N124_RUN_ID must match active card');
const out='tests/n124-priority-1621';
const mime={'.js':'text/javascript','.mjs':'text/javascript','.html':'text/html','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png'};
const server=http.createServer(async(req,res)=>{
 const pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
 const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
 if(!file.startsWith(root+path.sep))return res.writeHead(403).end();
 try{res.writeHead(200,{'Content-Type':mime[path.extname(file)]??'application/octet-stream'});res.end(await readFile(file));}catch{res.writeHead(404).end();}
});
const evidence={taskId,runId,geometry:[],routes:[],checks:[]};
try{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const url=`http://127.0.0.1:${server.address().port}/`;evidence.origin=url;
 await withIsolatedLocalBrowser({taskFile:`C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/${taskId}.json`,runId,url,timeoutMs:90000},async({createContext})=>{
  const context=await createContext({viewport:{width:390,height:1000},locale:'ar-SA',timezoneId:'Asia/Riyadh'});
  await context.addInitScript(()=>sessionStorage.setItem('rakeezx-demo-session-v1','preparing'));
  const page=await context.newPage();page.setDefaultTimeout(10000);
  await page.clock.install({time:new Date('2026-10-19T20:20:00+03:00')});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await openReadyServedDemo(page,url);
  const fixture=await page.evaluate(async()=>{
   const s=await import('/src/store.js');
   const section=await s.createSection({grade:5,label:'N124',name:'فصل تجريبي N124'});
   const teaching=await s.createTeaching({sectionId:section.id,subjectId:s.subjects()[0].id});
   await s.addStudent(section.id,'طالب مصطنع N124');
   await s.addSlot(teaching.id,1,10);await s.addSlot(teaching.id,1,11);
   const past=await s.ensureSession(teaching.id,'2026-10-19',10,{startTime:'19:00',endTime:'19:45'});
   const current=await s.ensureSession(teaching.id,'2026-10-19',11,{startTime:'20:00',endTime:'20:45'});
   return {teaching:teaching.id,past:past.id,current:current.id};
  });evidence.fixture=fixture;
  const home=async()=>{await page.goto(url+'#/');await page.locator(`.today-focus[data-session-id="${fixture.current}"]`).waitFor();};
  const snapshot=()=>page.evaluate(async()=>{const s=await import('/src/store.js');return JSON.stringify({attendance:s.state.attendance,scores:s.state.scores,students:s.state.students});});
  const before=await snapshot();
  assert.deepEqual(await page.evaluate(async()=>{
   const {attendanceActionLabel:label}=await import('/src/views/home.js');
   return [label({state:'pending',recorded:0}),label({state:'pending',recorded:1}),label({state:'completed',recorded:2})];
  }),['رصد الحضور','استكمال الحضور','مراجعة الحضور']);
  const selectors=[`.home-session-row[data-session-id="${fixture.past}"]`,`.home-attention__row[data-session-id="${fixture.past}"]`];
  for(const width of [390,1440]){
   await page.setViewportSize({width,height:1000});await home();
   for(const selector of selectors){
    const row=page.locator(selector);await row.scrollIntoViewIfNeeded();
    const geometry=await row.evaluate(el=>{
     const a=el.querySelector('.home-session-state'),main=el.querySelector('.row__main');
     const r=a.getBoundingClientRect(),m=main.getBoundingClientRect(),p=el.getBoundingClientRect();
     const range=document.createRange();range.selectNodeContents(a);
     return {label:a.textContent,decoration:getComputedStyle(a).textDecorationLine,whiteSpace:getComputedStyle(a).whiteSpace,lines:range.getClientRects().length,action:{x:r.x,y:r.y,width:r.width,height:r.height},main:{y:m.y,height:m.height},row:{x:p.x,y:p.y,width:p.width,height:p.height}};
    });
    assert.equal(geometry.label,'رصد الحضور');assert.equal(geometry.decoration,'none');assert.equal(geometry.lines,1);
    assert.ok(geometry.action.y<geometry.main.y+geometry.main.height,'action shares main row');
    assert.ok(geometry.action.x>=geometry.row.x&&geometry.action.x+geometry.action.width<=geometry.row.x+geometry.row.width+1);
    evidence.geometry.push({width,selector,...geometry});
   }
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
   await page.locator('.today-focus').scrollIntoViewIfNeeded();
   await page.screenshot({path:`${out}/home-${width}.png`,fullPage:true});
  }
  // A tiny two-session navigation check; N121 retains the broader prior routing proof.
  for(const [selector,id,keyboard] of [['.today-focus__action',fixture.current,false],[selectors[0]+' .home-session-state',fixture.past,true],[selectors[1]+' .home-session-state',fixture.past,false]]){
   const link=page.locator(selector);
   if(keyboard){await page.keyboard.press('Tab');await link.focus();assert.ok(await link.evaluate(el=>el.matches(':focus-visible')&&getComputedStyle(el).outlineStyle!=='none'));await page.keyboard.press('Enter');}else await link.click();
   await page.waitForURL(`**/#/teaching/${fixture.teaching}/attendance?session=${id}`);
   await page.locator(`.attendance-01c__session-chip.is-active[data-id="${id}"]`).waitFor();
   assert.equal(await page.locator('.attendance-01c__session-chip.is-active').count(),1);
   evidence.routes.push({selector,session:id,keyboard});await home();
  }
  const title=page.locator(selectors[0]+' .row__title');await title.scrollIntoViewIfNeeded();const rect=await title.boundingBox();
  await page.mouse.click(rect.x+rect.width/2,rect.y+rect.height/2);
  await page.waitForURL(`**/#/teaching/${fixture.teaching}`);await page.locator('.class-hub-header').first().waitFor();
  assert.equal(await snapshot(),before,'Navigation must not mutate attendance, scores or pupils');
  assert.deepEqual(errors,[]);
  evidence.checks.push({name:'n124_compact_no_underline_mobile_and_exact_session_route',status:'PASS',evidence:'Actual app/source CSS over task-owned loopback HTTP; 390/1440 geometry: single-line contextual actions in main row, no underline/overflow; keyboard focus visible; current and past links select exact session, card title opens class; no attendance writes, navigation preserves pupils/attendance/scores. Contextual partial/completed labels checked without data writes. Prior broader N121 proof reused.'});
 });evidence.status='PASS';
}catch(error){evidence.status='FAIL';evidence.error=error.stack;process.exitCode=1;}
finally{await new Promise(resolve=>server.close(resolve));await writeFile(`${out}/result.json`,JSON.stringify(evidence,null,2)+'\n');}
console.log(JSON.stringify(evidence));
