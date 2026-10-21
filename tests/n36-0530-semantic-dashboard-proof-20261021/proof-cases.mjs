// AI: real closure-free source reader and diagnostic bootstrap over owned HTTP; fabricated portal only.
import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {createServer} from 'node:http';import {resolve,extname,sep} from 'node:path';
import {withIsolatedLocalBrowser} from '../../../../scripts/ops-supervisor-v4/isolated-local-browser.mjs';
const taskId='continuous-n36-0530-semantic-dashboard-read-proof-20261021',runId='a6728982-7092-4a9e-995e-1da13954a419',base='http://127.0.0.1:49844',folder='tests/n36-0530-semantic-dashboard-proof-20261021/',root=resolve('.'),dir='extensions/rakeez-teacher-import-helper/',A='a'.repeat(32),B='b'.repeat(32);
const path='/SchoolManagment/Actions/Teacher/'+B;
const dashboard='<meta charset=utf-8><p class=school-name>مدرسة اصطناعية</p><p>اسم المعلم: معلم اصطناعي</p><nav><a href="/SchoolManagment/Actions/MyStudents?SchoolId='+A+'">قائمة الطلاب</a><button>سجلات المتابعة اليومية</button></nav><section><a href="/SchoolSchedule/Schedule/TeacherSchedule?SchoolId='+A+'">الجدول الدراسي</a><button>تقارير المعلم</button></section>';
const server=createServer(async(req,res)=>{try{const u=new URL(req.url,base);res.setHeader('content-type','text/html;charset=utf-8');if(u.pathname===path)return res.end(dashboard);const f=resolve(root,'.'+u.pathname);if(!f.startsWith(root+sep))throw Error('outside');res.setHeader('content-type',extname(f)==='.js'?'text/javascript':extname(f)==='.css'?'text/css':'text/html');res.end(await fs.readFile(f));}catch{res.writeHead(404);res.end();}});
const result={taskId,runId,cases:[],boundary:'Actual selection.js, popup HTML/handlers/CSS and diagnostics on fresh isolated synthetic HTTP contexts; no school read'};
try{await new Promise(r=>server.listen(49844,'127.0.0.1',r));await withIsolatedLocalBrowser({taskFile:'C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/'+taskId+'.json',runId,url:base,timeoutMs:120000},async({createContext})=>{
 const mutations={
 'weak-menu':()=>document.querySelector('button').remove(),
 'incoherent-menu':()=>{const n=document.querySelector('nav');document.body.append(n.querySelector('button'));},
 'hidden-menu':()=>document.querySelector('nav').hidden=true,
 'name-only':()=>{document.querySelector('nav').remove();document.querySelector('section').remove();},
 'no-school':()=>document.querySelector('.school-name').remove(),
 'mismatched-school':()=>document.querySelector('.school-name').textContent='مدرسة أخرى',
 'ambiguous-school':()=>document.body.insertAdjacentHTML('beforeend','<p class=school-name>مدرسة أخرى</p>'),
 'mismatched-schoolid':()=>document.querySelector('a').href=document.querySelector('a').href.replaceAll('a'.repeat(32),'c'.repeat(32)),
 'missing-schoolid':()=>document.querySelector('a').href='/SchoolManagment/Actions/MyStudents',
 'foreign-link':()=>document.querySelector('a').href='https://foreign.invalid/SchoolManagment/Actions/MyStudents?SchoolId='+ 'a'.repeat(32),
 'unsafe-link':()=>document.querySelector('a').setAttribute('data-method','post'),
 'inline-handler':()=>document.querySelector('a').setAttribute('onclick','void(0)'),
 'query-drift':()=>history.replaceState(null,'','?SchoolId='+ 'a'.repeat(32)),
 'loading':()=>document.body.setAttribute('aria-busy','true'),
 'multiple-greetings':()=>document.body.insertAdjacentHTML('beforeend','<p>أحمد اصطناعي معلم</p><p>علي اصطناعي معلم</p>'),
 ...Object.fromEntries(['مدير المدرسة','مديرة المدرسة','ولي الأمر','الطالب','الطالبة'].map((v,i)=>['conflict-'+i,new Function('document.body.insertAdjacentHTML("beforeend",'+JSON.stringify('<p data-role>'+v+'</p>')+')')])),
 'login':()=>document.body.insertAdjacentHTML('beforeend','<input type=password>'),
 'structural-drift':()=>document.querySelector('section').insertAdjacentHTML('beforeend','<button>سجلات متابعة الفصول</button>'),
 'teacher-name-drift':()=>document.querySelector('p:not(.school-name)').textContent='اسم المعلم: معلم آخر',
 };
 const c=await createContext();try{const page=await c.newPage();
 for(const [name,mutation] of [['positive',null],['active-role',null],['greeting',null],['fetched-dashboard',null],...Object.entries(mutations)]){
 await page.goto(base+path);await page.addScriptTag({url:base+'/'+dir+'route-diagnostics.js'});
 const before=await page.evaluate(async({dir,name})=>{const {readAutomaticTeacherPage:read}=await import('/'+dir+'selection.js');globalThis.read=read;if(name==='active-role')document.body.insertAdjacentHTML('beforeend','<p data-role>معلم</p>');if(name==='greeting')document.body.insertAdjacentHTML('beforeend','<p>أحمد اصطناعي معلم</p>');const home=read('home');globalThis.ctx=home.runContext;return {home,proof:read('read-proof',null,ctx),roster:read('roster-guard',null,ctx)};},{dir,name});
 assert.equal(before.home.ok,true);assert.equal(before.proof.ok,true);assert.equal(before.roster.ok,true);assert.equal(before.proof.proofDiagnostic.roleProofKind,['active-role','greeting'].includes(name)?name:'semantic-dashboard');
 if(mutation)await page.evaluate('('+mutation.toString()+')()');
 const after=await page.evaluate(({name})=>name==='fetched-dashboard'?read('read-proof',null,ctx,{document,url:location.href}):read('read-proof',null,ctx),{name});
 if(mutation||name==='fetched-dashboard')assert.equal(after.ok,false,name);else assert.equal(after.ok,true,name);
 const roster=await page.evaluate(()=>read('roster-guard',null,ctx));if(mutation&&!['query-drift'].includes(name))assert.equal(roster.ok,false,name);
 result.cases.push({name,status:'PASS',proof:after.ok?'accepted':after.code,roster:roster.ok?'accepted':roster.code});
 }
 await c.addInitScript(()=>{window.chrome={runtime:{getManifest:()=>({version:'0.5.31'}),sendMessage:async()=>({ok:true,health:'ready'})}};Object.defineProperty(navigator,'clipboard',{value:{writeText:async t=>window.copiedReport=t}});});
 const popup=await c.newPage();await popup.goto(base+'/'+dir+'popup.html');await popup.evaluate(()=>n36Diagnostics.publish({entryKind:'teacher-dashboard',roleProofKind:'semantic-dashboard',proofNavMarkers:2,proofActionMarkers:2,proofReadLinks:2}));await popup.locator('#copy-safe-report').click();let safe=await popup.evaluate(()=>JSON.parse(copiedReport).collection);assert.equal(safe.roleProofKind,'semantic-dashboard');assert.equal(safe.entryKind,'teacher-dashboard');assert.equal(safe.proofReadLinks,2);
 await popup.evaluate(()=>n36Diagnostics.publish({entryKind:'secret-school',roleProofKind:'secret-person',proofReadLinks:200,proofActionMarkers:'private'}));await popup.locator('#copy-safe-report').click();safe=await popup.evaluate(()=>JSON.parse(copiedReport).collection);assert.equal(safe.entryKind,'none');assert.equal(safe.roleProofKind,'none');assert.equal(safe.proofReadLinks,null);assert.equal(safe.proofActionMarkers,null);result.diagnosticAllowlist='PASS';
 }finally{await c.close();}
});result.status='PASS';}catch(e){result.status='FAIL';result.failure=e.stack;process.exitCode=1;}finally{await new Promise(r=>server.close(r));await fs.writeFile(folder+'proof-cases.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));}
