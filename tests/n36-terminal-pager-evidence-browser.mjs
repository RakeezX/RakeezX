// AI: actual HTTP extension/controller/parser and owned synthetic application entry.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {resolve,extname,sep} from 'node:path';
import {withIsolatedLocalBrowser} from '../../../scripts/ops-supervisor-v4/isolated-local-browser.mjs';
const taskId='continuous-n36-terminal-pager-evidence-and-repair-20261017',runId='0c942757-630e-4aa9-b7e8-46b112d8f7fe';
const taskFile='C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/'+taskId+'.json';
const base='http://127.0.0.1:49439',root=resolve('.'),A='a'.repeat(32),report='/SchoolManagmentReports/StudentInfo/ClassStudentInfo/'+A;
const evidence={taskId,runId,checks:[],errors:[],preservedFailures:[]};
const hash=b=>createHash('sha256').update(b).digest('hex');
const word=n=>[Math.floor(n/784),Math.floor(n/28)%28,n%28].map(i=>'ابتثجحخدذرزسشصضطظعغفقكلمنهوي'[i]).join('');
let scenario='',size=350,classes=10,requests=0,parallel=0,maxParallel=0;
function sourceHTML(u){
 if(u.pathname==='/SchoolManagment/Actions/MyStudents')return '<main><h2>مرحبا بك معلم اصطناعي</h2><p>لا يوجد رابط كشف في هذا النموذج</p></main>';
 if(!u.pathname.startsWith('/SchoolManagmentReports/'))return `<nav><a href="${report}">قائمة الطلاب</a><a href="/SchoolManagment/Actions/MyStudents?SchoolId=${A}">بيانات الطلاب</a><button>سجلات المتابعة اليومية</button></nav><main><h2>مرحبا بك معلم اصطناعي</h2><p class=school-name>مدرسة اصطناعية</p><a href="/SchoolSchedule/Schedule/TeacherSchedule?SchoolId=${A}">الجدول الدراسي</a><button>تقارير المعلم</button><button>سجلات متابعة الفصول</button></main>`;
 const n=Number(u.searchParams.get('page')??1),total=Math.ceil(size/50);
 const headers=['اسم الطالب','حالة الطالب','المدرسة','الفصل','البريد الإلكتروني','حساب الطالب','الجوال','ولي الأمر','جوال ولي الأمر'];
 const rows=Array.from({length:Math.min(50,size-(n-1)*50)},(_,j)=>{const i=(n-1)*50+j;return `<tr><td>طالب اصطناعي ${word(i)}</td><td>مستمر</td><td>مدرسة اصطناعية</td><td>${i%classes<10?'خامس':i%classes<20?'سادس':'اولى متوسط'}${i%classes%10+1}</td><td>ignored@example.invalid</td><td>private-account</td><td>phone</td><td>guardian</td><td>contact</td></tr>`;}).join('');
 const unknown=scenario==='partial',gap=false;
 const nums=n===1?Array.from({length:total},(_,i)=>i+1).filter(i=>i!==n&&!(gap&&i===2)).map(i=>`<a href="${report}?page=${i}">${i}</a>`).join(''):'';
 const next=n<total?`<a rel=next href="${report}?page=${gap&&n===1?3:n+1}">التالي</a>`:unknown?'':'<span class=page-link aria-disabled=true aria-label=التالي><svg></svg></span>';
 return `<nav class=pagination><span aria-current=page>${n}</span>${nums}${next}</nav><table><tr>${headers.map(h=>'<th>'+h+'</th>').join('')}</tr>${rows}</table>`;
}
const server=createServer(async(req,res)=>{try{
 const u=new URL(req.url,base);
 if(u.pathname==='/__before.js'){res.setHeader('content-type','text/javascript');return res.end(execFileSync('git',['show','7ff299e243883c2ab9768f41f3a838c5775ce64b:extensions/rakeez-teacher-import-helper/source-adapter.js']));}
 if(u.pathname==='/Dashboards/Schools'||u.pathname==='/SchoolManagment/Actions/MyStudents'||u.pathname.startsWith('/SchoolManagmentReports/')){
  res.setHeader('content-type','text/html;charset=utf-8');
  if(u.pathname.startsWith('/SchoolManagmentReports/')){requests++;parallel++;maxParallel=Math.max(maxParallel,parallel);await new Promise(r=>setTimeout(r,scenario==='inflightcancel'&&Number(u.searchParams.get('page'))>=3?600:15));parallel--;const n=Number(u.searchParams.get('page')??1);if(scenario==='network'&&n===3){res.writeHead(503);return res.end('unavailable');}if(scenario==='oversized'&&n===3)return res.end(' '.repeat(2000001));if(scenario==='unsafe'&&n===3)return res.end('<input type=password>');}
  return res.end('<!doctype html><html lang=ar dir=rtl><meta charset=utf-8>'+sourceHTML(u)+'</html>');
 }
 const file=resolve(root,u.pathname==='/'?'index.html':'.'+decodeURIComponent(u.pathname));if(!file.startsWith(root+sep))throw Error('outside');
 res.setHeader('content-type',({'.html':'text/html;charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2','.webmanifest':'application/manifest+json'})[extname(file)]||'application/octet-stream');const data=await fs.readFile(file);res.end(u.pathname.endsWith('/navigation.js')&&['request-resume','memory'].includes(scenario)?data.toString().replace(scenario==='memory'?'sourceBytes:8*1024*1024':'pages:24',scenario==='memory'?'sourceBytes:30000':'pages:3'):data);
}catch(e){res.writeHead(404);res.end(e.message);}});

const record=(name,data)=>{evidence.checks.push({name,status:'PASS',evidence:data});console.log('PASS '+name);};
try{
 await new Promise((r,j)=>{server.once('error',j);server.listen(49439,'127.0.0.1',r);});
 await withIsolatedLocalBrowser({taskFile,runId,url:base,timeoutMs:120000},async({createContext})=>{
 const context=await createContext({viewport:{width:390,height:950},locale:'ar-SA'});
 const page=await context.newPage();await page.goto(base+'/Dashboards/Schools');
 const results=await page.evaluate(async({report,base})=>{
  const before=await import('/__before.js'),after=await import('/extensions/rakeez-teacher-import-helper/source-adapter.js');
  const table='<table><tr>'+['اسم الطالب','حالة الطالب','المدرسة','الفصل','البريد الإلكتروني','حساب الطالب','الجوال','ولي الأمر','جوال ولي الأمر'].map(h=>'<th>'+h+'</th>').join('')+'</tr><tr>'+['طالب اصطناعي','مستمر','مدرسة اصطناعية','خامس1','','','','',''].map(v=>'<td>'+v+'</td>').join('')+'</tr></table>';
  const svg='<svg><path></path></svg>';
  const li=(content,c='')=>`<li class="page-item ${c}">${content}</li>`;
  const a=(content,attrs='')=>`<a class=page-link ${attrs}>${content}</a>`;
  const active=tag=>li(`<${tag} class=page-link>7</${tag}><span class=sr-only>(current)</span>`,'active');
  const previous=li(a(svg,`href="${report}?page=6"`));
  const endpoint=li('<span class=page-link aria-label=التالي>'+svg+'</span>','disabled');
  const pager=(current,last,first=previous)=>'<ul class=pagination>'+first+current+last+'</ul>';
  const read=(m,html,url=base+report+'?page=7')=>m.readSourceReportPage('students',null,{document:new DOMParser().parseFromString(table+html,'text/html'),url});
  const span=pager(active('span'),endpoint);
  const baseline='<ul class=pagination>'+li(a(svg),'disabled')+li(a('1')+'<span class=sr-only>(current)</span>','active')+[2,3,4,5,6,7].map(n=>li(a(n===6?'...':n,`href="${report}?page=${n}"`))).join('')+li(a(svg,`href="${report}?page=2"`))+'</ul>';
  const variants={activeSpan:read(after,span,base+report),beforeActiveSpan:read(before,span,base+report),span:read(after,span),before:read(before,span),baseline:read(after,baseline,base+report),beforeBaseline:read(before,baseline,base+report),anchor:read(after,pager(active('a'),li(a(svg),'disabled'))),missing:read(after,pager(active('span'),li(a(svg)))),ambiguous:read(after,pager(active('span'),li('<span class=page-link>'+svg+'</span>','disabled'))),previous:read(after,pager(active('span'),li(a(svg)),li(a(svg),'disabled'))),conflict:read(after,span.replace('class=pagination','class=pagination data-total-pages=8')),cross:read(after,span.replace('?page=6','?page=6&classid=foreign')),gap:read(after,pager(active('span'),li(a('التالي',`rel=next href="${report}?page=9"`)))),absent:read(after,'')};
  return variants;
 },{report,base});
 assert.equal(results.before.pagination.terminal,false);assert.equal(results.before.warnings[0].code,'PAGINATION_MISSING_NEXT');
 // URL page7 allows the old reader to know current, but it loses explicit span terminal.
 assert.equal(results.activeSpan.pagination.current,7);assert.equal(results.beforeActiveSpan.warnings[0].code,'PAGINATION_MISMATCH');
 assert.equal(results.span.pagination.current,7);assert.equal(results.span.pagination.terminal,true);assert.equal(results.span.pagination.total,7);
 assert.deepEqual(results.baseline.pagination,results.beforeBaseline.pagination);assert.deepEqual(results.baseline.links,results.beforeBaseline.links);assert.equal(results.baseline.links.length,6);
 assert.equal(results.anchor.pagination.terminal,true);
 for(const name of ['missing','ambiguous','previous','conflict','cross','gap','absent'])assert.ok(results[name].warnings.length&&!results[name].pagination?.terminal,name);
 for(const result of Object.values(results).filter(r=>r.diagnostic)){
  const d=result.diagnostic;assert.deepEqual(Object.keys(d).sort(),['category','pager','reason','stage']);assert.deepEqual(Object.keys(d.pager).sort(),['currentPage','disabledNext','endpointKind','pagerCount','terminalEvidence']);
  for(const [k,v] of Object.entries(d.pager)){if(typeof v==='number')assert.ok(Number.isSafeInteger(v)&&v>=0&&v<=1000000);else if(typeof v==='string')assert.ok(['none','ambiguous','anchor','span','unproven','explicit-next','observed-anchor'].includes(v));else assert.ok(v===null||typeof v==='boolean');}
 }
 record('actual-reader-before-after-observed-baseline-and-negative-privacy',{before:results.before.warnings,span:results.span.diagnostic,baselineLinks:results.baseline.links.length,negativeCases:7});
 await page.close();await context.close();
 for(scenario of ['partial','terminal']){
  size=303;classes=10;requests=0;const context=await createContext({viewport:{width:390,height:950},locale:'ar-SA'});
  const source=await context.newPage();await source.goto(base+'/Dashboards/Schools');
  const runner=await context.newPage();runner.setDefaultTimeout(15000);runner.on('pageerror',e=>evidence.errors.push(e.message));
  await runner.exposeFunction('scriptCall',async input=>{
   if(input.funcText&&!input.args){await source.evaluate('('+input.funcText+')()');return [];}
   if(input.files){await source.evaluate(()=>import('/extensions/rakeez-teacher-import-helper/route-diagnostics.js'));return [];}
   let value=await source.evaluate(async input=>{const dir='/extensions/rakeez-teacher-import-helper/';const f=input.args?.[0];const fn=['fetch','students','timetable'].includes(f)||input.reader?'readSourceReportPage':'readAutomaticTeacherPage';const m=await import(dir+(fn==='readSourceReportPage'?'source-adapter.js':'selection.js'));return m[fn](...input.args);},input);
   if(input.args?.[0]==='home'&&value.ok)value.links=value.links.filter(l=>l.kind==='students');
   return [{frameId:0,result:value}];
  });
  await runner.exposeFunction('tabUpdate',async({url})=>{assert.equal(new URL(url).pathname,'/SchoolManagment/Actions/MyStudents');await source.goto(url);return {id:7,url,status:'complete'};});
  await runner.exposeFunction('tabGet',()=>({id:7,url:source.url(),status:'complete'}));
  await runner.exposeFunction('message',()=>({ok:true}));
  await runner.addInitScript(({base})=>{
   window.chrome={runtime:{getManifest:()=>({version:'0.5.9'}),getURL:p=>base+'/extensions/rakeez-teacher-import-helper/'+p,sendMessage:m=>window.message(m)},tabs:{get:()=>window.tabGet(),update:async(id,options)=>window.tabUpdate(options),onRemoved:{addListener(){}},onUpdated:{addListener(){}}},scripting:{executeScript:input=>window.scriptCall({args:input.args,files:input.files,reader:input.func?.name==='readSourceReportPage',funcText:input.func?.toString()})}};
   window.addEventListener('n36:source-roster',({detail})=>{window.gathered=detail.rows;window.coverage=detail;});
  },{base});
  await runner.goto(base+'/extensions/rakeez-teacher-import-helper/popup.html?run='+scenario);
  await runner.waitForFunction(()=>typeof window.n36BeforeExport==='function');
  await runner.evaluate(s=>{const c=new BroadcastChannel('rakeez-private-one-start');c.postMessage({type:'launch',token:s,tabId:7});c.close();},scenario);
  await runner.locator('#source-class-select').waitFor();
  const actual=await runner.evaluate(()=>({rows:window.gathered.length,coverage:window.coverage.coverage,complete:window.coverage.complete,pages:window.coverage.processedReportPages}));
  assert.equal(actual.rows,303);assert.equal(actual.pages,7);assert.equal(actual.complete,scenario==='terminal');assert.equal(actual.coverage,scenario==='terminal'?'complete':'partial');assert.equal(requests,7);
  const diagnostics=await runner.locator('#route-diagnostic').inputValue();assert.match(diagnostics,/staged=303/);assert.match(diagnostics,/stage=report-pagination/);assert.match(diagnostics,/complete=/);if(scenario==='partial'){assert.match(diagnostics,/ROSTER_LINKS_UNAVAILABLE/);assert.match(diagnostics,/PAGINATION_MISSING_NEXT/);}else assert.ok(!diagnostics.includes('ROSTER_LINKS_UNAVAILABLE'));assert.ok(!diagnostics.includes(report));assert.ok(!diagnostics.includes('طالب اصطناعي'));assert.ok(!diagnostics.includes('ignored@example'));
  assert.equal(await runner.evaluate(()=>getComputedStyle(document.body).direction),'rtl');assert.equal(await runner.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  await runner.locator('#run-cancel').click();assert.equal(await runner.evaluate(()=>window.n36HandoffSource()),null);
  record('controller-303-'+scenario,{...actual,requests,diagnostics});await context.close();
 }
 });
 assert.deepEqual(evidence.errors,[]);evidence.status='PASS';
}catch(e){evidence.status='FAIL';evidence.failure=e.stack;console.error(e);process.exitCode=1;}
finally{await new Promise(r=>server.close(r));evidence.cleanup='Owned loopback server and isolated contexts/browser closed in finally; no shared browser lease required.';evidence.sourceHashes={};for(const f of ['source-adapter.js','run-controller.js','source-roster.js','popup.html','popup.css'])evidence.sourceHashes[f]=hash(await fs.readFile('extensions/rakeez-teacher-import-helper/'+f));await fs.writeFile('tests/n36-terminal-pager-evidence-browser.json',JSON.stringify(evidence,null,2)+'\n');}
