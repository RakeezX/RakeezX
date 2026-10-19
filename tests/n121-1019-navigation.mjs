import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import {readFile,writeFile} from 'node:fs/promises';
import {withIsolatedLocalBrowser} from 'file:///C:/Users/Abody/Projects/RakeezX/scripts/ops-supervisor-v4/isolated-local-browser.mjs';
import {openReadyServedDemo} from './helpers/served-demo-readiness.mjs';
const root=process.cwd(), runId=process.env.N121_RUN_ID;
assert.ok(runId,'N121_RUN_ID must match active card');
const taskId='continuous-n121-lesson-card-target-actions-20261019';
const mime={'.js':'text/javascript','.mjs':'text/javascript','.html':'text/html','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png'};
const server=http.createServer(async(req,res)=>{
 const pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
 const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
 if(!file.startsWith(root+path.sep))return res.writeHead(403).end();
 try{res.writeHead(200,{'Content-Type':mime[path.extname(file)]??'application/octet-stream'});res.end(await readFile(file));}catch{res.writeHead(404).end();}
});
const evidence={taskId,runId,checks:[],targets:[]};
try{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const url=`http://127.0.0.1:${server.address().port}/`; evidence.origin=url;
 await withIsolatedLocalBrowser({taskFile:`C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/${taskId}.json`,runId,url,timeoutMs:90000},async({createContext})=>{
  const context=await createContext({viewport:{width:390,height:844},locale:'ar-SA',timezoneId:'Asia/Riyadh'});
  await context.addInitScript(()=>sessionStorage.setItem('rakeezx-demo-session-v1','preparing'));
  const page=await context.newPage();page.setDefaultTimeout(10000);
  await page.clock.install({time:new Date('2026-10-19T20:20:00+03:00')});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await openReadyServedDemo(page,url);
  const fixture=await page.evaluate(async()=>{
   const s=await import('/src/store.js');
   const section=await s.createSection({grade:5,label:'N121',name:'فصل تجريبي N121'});
   const teaching=await s.createTeaching({sectionId:section.id,subjectId:s.subjects()[0].id});
   const student=await s.addStudent(section.id,'طالب مصطنع N121');
   await s.addSlot(teaching.id,1,10);await s.addSlot(teaching.id,1,11);
   const past=await s.ensureSession(teaching.id,'2026-10-19',10,{startTime:'19:00',endTime:'19:45'});
   const current=await s.ensureSession(teaching.id,'2026-10-19',11,{startTime:'20:00',endTime:'20:45'});
   await s.setAttendance(current.id,student.id,'present');
   return {teaching:teaching.id,student:student.id,past:past.id,current:current.id};
  });evidence.fixture=fixture;
  const home=async()=>{await page.goto(url+'#/');await page.locator(`.today-focus[data-session-id="${fixture.current}"]`).waitFor();};
  const snapshot=()=>page.evaluate(async()=>{const s=await import('/src/store.js');return JSON.stringify({attendance:s.state.attendance,scores:s.state.scores,students:s.state.students});});
  const before=await snapshot();
  const attendance=async(selector,id,keyboard=false)=>{
   const action=page.locator(selector);await action.waitFor();
   if(keyboard){await action.focus();await page.keyboard.press('Enter');}else await action.click();
   await page.waitForURL(`**/#/teaching/${fixture.teaching}/attendance?session=${id}`);
   await page.locator(`.attendance-01c__session-chip.is-active[data-id="${id}"]`).waitFor();
   assert.equal(await page.locator('.attendance-01c__session-chip.is-active').count(),1);
   evidence.targets.push({selector,session:id,keyboard});await home();
  };
  for(const width of [390,1280]){
   await page.setViewportSize({width,height:844});await home();
   assert.equal(await page.locator('.home-lesson-class-link a').count(),0);
   // Click rendered class text through the stretched native link, not href-only assertions.
   for(const selector of ['.today-focus',`.home-session-row[data-session-id="${fixture.past}"]`,`.home-attention__row[data-session-id="${fixture.past}"]`]){
    const body=page.locator(selector+' .home-lesson-class-link');
    const title=page.locator(selector+(selector==='.today-focus'?' .today-focus__class':' .row__title'));
    await title.scrollIntoViewIfNeeded();const rect=await title.boundingBox();evidence.targets.push(await title.evaluate(el=>{const r=el.getBoundingClientRect();return {title:el.textContent,hit:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.className};}));await page.mouse.click(rect.x+rect.width/2,rect.y+rect.height/2);
    await page.waitForURL(`**/#/teaching/${fixture.teaching}`);await page.locator('.class-hub-header').first().waitFor();await home();
    await body.focus();await page.keyboard.press('Enter');await page.waitForURL(`**/#/teaching/${fixture.teaching}`);await home();
   }
   await attendance('.today-focus__action',fixture.current,true);
   await attendance('.today-focus__state a',fixture.current);
   await attendance(`.home-session-row[data-session-id="${fixture.past}"] .home-session-state`,fixture.past,true);
   await attendance(`.home-attention__row[data-session-id="${fixture.past}"] .home-session-state`,fixture.past);
   assert.equal(await page.evaluate(()=>getComputedStyle(document.querySelector('.home-session-row')).display),width===390?'grid':'flex');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  }
  assert.equal(await snapshot(),before,'Navigation preserves attendance, students and scores');
  await page.evaluate(async({past,student})=>{const s=await import('/src/store.js');await s.setAttendance(past,student,'present');(await import('/src/app.js')).repaint();},fixture);
  await home();
  assert.equal(await page.locator(`.home-session-row[data-session-id="${fixture.past}"] .home-session-state`).textContent(),'تم رصد الحضور');
  await attendance(`.home-session-row[data-session-id="${fixture.past}"] .home-session-state`,fixture.past);
  assert.deepEqual(errors,[]);
  evidence.checks.push({name:'n121_lesson_card_class_target_attendance_same_session_target',status:'PASS',evidence:'Actual served app, source CSS and router at 390/1280: current/today card bodies open teaching by pointer and Enter; review/completed/pending attendance links select exact clicked session among two sessions of the same teaching. No horizontal overflow or page errors; navigation leaves attendance/students/scores unchanged.'});
 }); evidence.status='PASS';
}catch(error){evidence.status='FAIL';evidence.error=error.stack;throw error;}
finally{await new Promise(resolve=>server.close(resolve));await writeFile('tests/n121-1019-navigation.json',JSON.stringify(evidence,null,2)+'\n');}





