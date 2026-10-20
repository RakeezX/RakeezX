import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {createServer} from 'node:http';import {createRequire} from 'node:module';import {execFileSync} from 'node:child_process';import path from 'node:path';
import {makeSection,makeTeaching} from '../../src/models.js';import {fixture} from '../fixtures/n88-student-projection/canonical.mjs';import {A,providerFixture} from '../fixtures/n88-existing-host/provider.mjs';
const taskId='continuous-n88-stable-class-and-inline-resume-20261020',runId='3b230d01-109a-4d91-8ede-6e2efa911e8a',base='5a91a2b478f63aa0cde33e744f113a404298d0ef',root='C:/Users/Abody/Projects/RakeezX';
const lease=a=>execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-File',root+'/scripts/ops-supervisor-v4/resource-lease.ps1','-Name','browser','-Action',a,'-TaskFile',root+'/artifacts/ops-supervisor-v4/queue/'+taskId+'.json','-WaitSeconds','0','-OwnerToken',runId],{encoding:'utf8',windowsHide:true,timeout:15000}).trim();
const report={taskId,runId,status:'FAIL',checks:[],hostedTeacherSuccess:'NOT_PROVEN'};let server,browser,owned=false,hold=true,studentMode=401;const counts={list:0,'guidance-list':0,read:0},waiting=[];
const canonical=fixture().canonical;for(const rows of Object.values(canonical))for(const r of rows)r.ownerId=A;
const section=makeSection({yearId:'year',ownerId:A}),teaching=makeTeaching({sectionId:section.id,subjectId:'subject',termId:'term',ownerId:A});canonical.sections=[section];canonical.teachings=[teaching];for(const r of canonical.enrollments)r.sectionId=section.id;for(const r of canonical.items)r.teachingId=teaching.id;
const token=providerFixture().token();
const boot="import {bootstrap} from '/tests/fixtures/n88-integrated-class/bootstrap.js';import * as store from '/src/store.js';import * as cloud from '/src/lib/cloud.js';import route from '/src/views/student-portal-class.js';import {classBinding} from '/src/lib/student-portal-runtime.js';import {classBinding as oldBinding} from '/baseline.js';await bootstrap();const root=document.querySelector('#mount'),id="+JSON.stringify(teaching.id)+";function repaint(){root.innerHTML=route.render();route.afterPaint(root,{id});}window.review={repaint,key:()=>classBinding({cloud,store,teachingId:id}).key,oldKey:()=>oldBinding({cloud,store,teachingId:id}).key,renew:()=>{const s=cloud.session,p=JSON.parse(atob(s.access_token.split('.')[1]));p.exp+=60;const parts=s.access_token.split('.');parts[1]=btoa(JSON.stringify(p));store.state.students=store.state.students.slice().reverse();cloud.setMockAuth(cloud.user,{...s,access_token:parts.join('.')});repaint();window.dispatchEvent(new Event('focus'));},source:()=>{store.state.teachings[0].revision=(store.state.teachings[0].revision??1)+1;window.dispatchEvent(new Event('focus'));},owner:()=>window.n88Fixture.switchOwner()};repaint();";
try{
 const l=lease('acquire');assert.match(l,/^(ACQUIRED|ALREADY OWNED)/);owned=l.startsWith('ACQUIRED');
 server=createServer(async(req,res)=>{try{const u=new URL(req.url,'http://127.0.0.1');res.setHeader('Cache-Control','no-store');const send=(b,type='text/javascript')=>{res.setHeader('Content-Type',type);res.end(b);};
 if(u.pathname==='/teacher')return send('<!doctype html><html lang="ar" dir="rtl"><link rel="stylesheet" href="/src/styles/app.css"><link rel="stylesheet" href="/src/styles/student-portal-class.css"><main id="mount"></main><script type="module" src="/boot.js"></script></html>','text/html');
 if(u.pathname==='/boot.js')return send(boot);
 if(u.pathname==='/baseline.js')return send(execFileSync('git',['show',base+':src/lib/student-portal-runtime.js'],{encoding:'utf8'}).replaceAll("'./","'/src/lib/").replaceAll("'../views/","'/src/views/"));
 if(u.pathname==='/review/context')return send(JSON.stringify({ownerId:A,token,canonical}),'application/json');
 if(u.pathname==='/student')return send(await fs.readFile('drafts/n88-student-portal/client/student.html'),'text/html');
 if(u.pathname==='/api/n88/student/read'){counts.read++;await new Promise(ok=>setTimeout(ok,180));res.statusCode=studentMode;return send(studentMode===200?JSON.stringify({version:'n88-student-v3',profile:{name:'طالب مصطنع'}}):'{}','application/json');}
 if(u.pathname.startsWith('/api/n88/teacher/class/')){
  const action=u.pathname.split('/').pop();assert(['list','guidance-list'].includes(action),'no mutation allowed');counts[action]++;
  let raw='';for await(const chunk of req)raw+=chunk;const b=JSON.parse(raw);
  if(hold)await new Promise(ok=>waiting.push({action,ok}));
  const data=action==='list'?{classId:section.id,rosterRevision:'a'.repeat(64),policyRevision:1,visibility:Object.fromEntries(['name','class','grades','required','completed','scheduled'].map(k=>[k,true])),students:[{studentId:'synthetic-student',enrollmentId:'synthetic-enrollment',revision:1,label:'طالب مصطنع',hasActiveCode:false,credentialVersion:0,recoveryStatus:'inactive',credential:null}]}:{tasks:[{subitemId:'synthetic-task',title:'مهمة مصطنعة',sourceStamp:'b'.repeat(64),revision:0,executionInstructions:'تعليمات مصطنعة',deliveryInstructions:'',needsRepublication:false}]};
  return send(JSON.stringify({ack:true,binding:b.binding,requestId:null,rollout:'public',data}),'application/json');
 }
 const file=u.pathname.slice(1);if(!/^(src|assets|font|tests\/fixtures\/n88-integrated-class|drafts\/n88-student-portal\/client)\/[A-Za-z0-9_./-]+$/.test(file)||file.includes('..')){res.statusCode=404;return res.end();}
 send(await fs.readFile(file),{'.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'}[path.extname(file)]||'application/octet-stream');
 }catch(e){report.serverFailure=e.message;if(!res.headersSent)res.statusCode=500;res.end();}});
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));const origin='http://127.0.0.1:'+server.address().port;
 const {chromium}=createRequire(root+'/package.json')('playwright');browser=await chromium.launch({headless:true});
 const c=await browser.newContext({viewport:{width:1100,height:900},serviceWorkers:'block'});await c.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort('blockedbyclient'));const p=await c.newPage();p.setDefaultTimeout(7000);
 await p.goto(origin+'/teacher');await p.waitForFunction(()=>!!window.review);
 const until=async fn=>{const end=Date.now()+7000;while(!fn()){assert(Date.now()<end,'server phase timed out');await new Promise(ok=>setTimeout(ok,20));}};
 await until(()=>counts.list===1);
 const before=await p.evaluate(()=>({key:review.key(),old:review.oldKey()}));
 for(let i=0;i<2;i++)await p.evaluate(()=>review.renew());
 const after=await p.evaluate(()=>({key:review.key(),old:review.oldKey()}));
 assert.equal(before.key,after.key);assert.notEqual(before.old,after.old);assert.equal(counts.list,1);
 waiting.find(x=>x.action==='list').ok();await p.locator('.n88-class-roster').waitFor();await until(()=>counts['guidance-list']===1);
 const roster=await p.locator('.n88-class-roster').elementHandle();await p.locator('.n88-class-settings>summary').click();assert.equal(await p.locator('[data-visibility] input').count(),6);
 for(let i=0;i<2;i++)await p.evaluate(()=>review.renew());
 assert(await roster.evaluate(el=>el.isConnected));assert.equal(await p.locator('[data-visibility] input').count(),6);assert.equal(counts.list,1);assert.equal(counts['guidance-list'],1);
 waiting.find(x=>x.action==='guidance-list').ok();await p.getByText('مهمة مصطنعة',{exact:true}).waitFor({state:'attached'});
 for(let i=0;i<2;i++)await p.evaluate(()=>review.renew());
 assert(await roster.evaluate(el=>el.isConnected));assert.equal(counts.list,1);assert.equal(counts['guidance-list'],1);
 report.checks.push('Actual route repaint + two same-session bearer renew/focus notifications during each delayed section: baseline key churn reproduced, new key stable, one list/one guidance read, six fields retained');
 await p.screenshot({path:'tests/n88-20261020/teacher.png',fullPage:true});
 // Retire the context with a queued old-owner guidance reply; it must never resurrect.
 await p.evaluate(()=>review.source());
 await until(()=>counts.list===2);waiting.filter(x=>x.action==='list').at(-1).ok();await until(()=>counts['guidance-list']===2);
 await p.evaluate(()=>review.owner());assert.equal(await p.locator('.n88-class-roster').count(),0);assert.equal(await p.locator('[data-visibility]').count(),0);
 hold=false;waiting.forEach(x=>x.ok());await p.waitForTimeout(100);assert.equal(await p.locator('.n88-class-roster').count(),0);assert.equal(await p.locator('[data-guidance]').count(),0);
 report.checks.push('Actual owner/store guard immediately clears both sections; delayed old-owner reply rejected');
 await c.close();
 const sc=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});await sc.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort('blockedbyclient'));const sp=await sc.newPage();sp.setDefaultTimeout(5000);await sp.goto(origin+'/student');const form=await sp.locator('[data-claim]').elementHandle();
 for(const status of [401,410]){studentMode=status;await sp.locator('[data-resume]').click();assert(await form.evaluate(el=>el.isConnected));await sp.getByText('جارٍ التحقق من الجلسة…',{exact:true}).waitFor();assert.equal(await sp.getByRole('heading',{name:'جارٍ الاتصال…'}).count(),0);await sp.getByText('الجلسة غير متاحة أو انتهت. أدخل رمزك أو راجع معلمك.',{exact:true}).waitFor();assert(await form.evaluate(el=>el.isConnected));await sp.locator('[data-resume]').waitFor({state:'visible'});}
 await sp.screenshot({path:'tests/n88-20261020/resume.png',fullPage:true});
 studentMode=200;await sp.locator('[data-resume]').click();assert(await form.evaluate(el=>el.isConnected));await sp.getByRole('heading',{name:'مساحتي الدراسية'}).waitFor();assert.equal(await sp.locator('[data-claim]').count(),0);assert.equal(counts.read,3);
 report.checks.push('Previous-session missing/expired checks remain on same real form; only accepted projected resume renders profile');
 await sc.close();report.status='PASS';report.readCounts={list:counts.list,guidance:counts['guidance-list'],studentRead:counts.read};
}catch(e){report.failure={name:e.name,message:e.message,counts:{...counts}};process.exitCode=1;}
finally{waiting.forEach(x=>x.ok());await browser?.close();if(server?.listening){server.closeAllConnections();await new Promise(ok=>server.close(ok));}report.cleanup={ownedBrowserAndServerClosed:true,browserLease:owned?lease('release'):'not acquired'};await fs.writeFile('tests/n88-20261020/ui.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));}
