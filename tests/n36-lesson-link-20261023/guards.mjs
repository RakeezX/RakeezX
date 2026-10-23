// AI-authored: real mounted app/popup + serialized .37 reader/worker + native IndexedDB.
import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {execFileSync} from 'node:child_process';import {createServer} from 'node:http';import {resolve,extname,sep} from 'node:path';
import {withIsolatedLocalBrowser} from '../../../../scripts/ops-supervisor-v4/isolated-local-browser.mjs';
import {backgroundFixture} from '../n36-0746-bounded-source-guard-cost-20261021/worker-fixture.mjs';
import {sourceHTML,dash,home,role,report,roster,timetable,classes,meta,department,displaySchool,school} from './source.mjs';
const taskId='continuous-n36-lesson-link-school-department-outcome-20261023',runId='2e3dee0a-bade-41d6-96e5-5173af64ed5c';
const base='http://127.0.0.1:49972',folder='tests/n36-lesson-link-20261023/',root=resolve('.'),baseline=false;let options={},requests=[],worker;
const baseSha='a068e8db4d3793c067a07b400bfd3f146ef8dc91',runtimeDir='extensions/rakeez-teacher-import-helper/';
const baselineFiles=baseline?Object.fromEntries(JSON.parse(await fs.readFile('assets/extensions/rakeez-teacher-import-helper-0.5.39.manifest.json','utf8')).files.map(f=>[f.file,execFileSync('git',['show',baseSha+':'+runtimeDir+f.file])])):null;
const server=createServer(async(req,res)=>{try{const u=new URL(req.url,base);
 if(u.pathname===role){res.writeHead(302,{location:dash});return res.end();}
 if([dash,home,report,new URL(roster,base).pathname,new URL(timetable,base).pathname,classes,meta].includes(u.pathname)){requests.push(u.pathname);res.setHeader('content-type','text/html;charset=utf-8');return res.end(sourceHTML(u,options));}
 const f=resolve(root,u.pathname==='/'?'index.html':'.'+decodeURIComponent(u.pathname));assert.ok(f.startsWith(root+sep));let bytes=await fs.readFile(f);
 if(baseline&&u.pathname.startsWith('/'+runtimeDir))bytes=baselineFiles[u.pathname.slice(runtimeDir.length+1)];
 if(baseline&&['/src/views/class-import-center.js','/src/lib/teacher-setup-import.js'].includes(u.pathname))bytes=execFileSync('git',['show',baseSha+':'+u.pathname.slice(1)]);
 if(u.pathname==='/')bytes=Buffer.from(bytes.toString().replace(/<script type="module">[\s\S]*?<\/script>/,'<script type="module" src="/tests/n36-complete-import-outcome-20261023/bootstrap.mjs"></script>'));
 if(u.pathname==='/src/lib/n36-extension-protocol.js')bytes=Buffer.from(bytes.toString().replace('https://rakeezx.com',base));
 res.setHeader('content-type',({'.html':'text/html;charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2'})[extname(f)]||'application/octet-stream');res.end(bytes);
 }catch(e){res.writeHead(404);res.end(e.message);}});
const result={taskId,runId,cases:[]};
try{await new Promise(r=>server.listen(49972,'127.0.0.1',r));await withIsolatedLocalBrowser({taskFile:'C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/'+taskId+'.json',runId,url:base,timeoutMs:120000},async({createContext})=>{
 const c=await createContext(),page=await c.newPage(),network=[];page.on('request',r=>network.push(r.url()));await page.goto(base+dash);
 await page.evaluate(async()=>{
  await import('/extensions/rakeez-teacher-import-helper/route-diagnostics.js');
  const {readAutomaticTeacherPage}=await import('/extensions/rakeez-teacher-import-helper/selection.js');
  const home=readAutomaticTeacherPage('home');if(!home.ok)throw Error(JSON.stringify(home));
  window.context={...home.runContext,sourceURL:location.href,setupKind:'timetable',requestId:'fixture|timetable',readJobId:'fixture',remainingMs:8000};
  const proof=readAutomaticTeacherPage('read-proof',null,window.context);if(!proof.ok)throw Error(JSON.stringify(proof));window.context.readProof=proof.proof;
 });
 const expectations={pair:'PASS',card:'PASS',foreign:'SCHOOL_CONTEXT_CHANGED',mixed:'SCHOOL_CONTEXT_CHANGED','duplicate-key':'UNSAFE_LESSON_LINK','case-duplicate':'UNSAFE_LESSON_LINK','bad-id':'UNSAFE_LESSON_LINK','foreign-origin':'UNSAFE_LESSON_LINK','bad-path':'UNSAFE_LESSON_LINK',fragment:'UNSAFE_LESSON_LINK',tuple:'AMBIGUOUS_LESSON_LINKS',hidden:'UNSAFE_LESSON_LINK','hidden-anchor':'UNSAFE_LESSON_LINK',event:'UNSAFE_LESSON_LINK',download:'UNSAFE_LESSON_LINK',form:'SCHOOL_CONTEXT_UNCONFIRMED','nav-only':'SCHOOL_CONTEXT_UNCONFIRMED','nav-decoy':'SCHOOL_CONTEXT_UNCONFIRMED','extra-anchor':'AMBIGUOUS_LESSON_LINKS','school-name':'SCHOOL_CONTEXT_CHANGED','multiple-school':'SCHOOL_CONTEXT_CHANGED',teacher:'TEACHER_CONTEXT_CHANGED',login:'LOGIN_OR_LOGOUT',role:'NON_TEACHER_ROLE',base:'UNSAFE_SETUP_LINK','css-hidden':'SCHOOL_CONTEXT_UNCONFIRMED','no-weekday':'PARTIAL','no-period':'SCHOOL_CONTEXT_UNCONFIRMED','duplicate-period':'PARTIAL'};
 Object.assign(expectations,{'inconsistent-class-id':'AMBIGUOUS_LESSON_LINKS','inconsistent-subject-id':'AMBIGUOUS_LESSON_LINKS'});
 for(const [variant,expected] of Object.entries(expectations)){
  options={count:2,variant};const value=await page.evaluate(async path=>{const {readSourceReportPage}=await import('/extensions/rakeez-teacher-import-helper/source-adapter.js');return readSourceReportPage('fetch',{...window.context,path});},timetable);
  if(expected==='PASS'){assert.equal(value.ok,true,variant+JSON.stringify(value));assert.equal(value.tables.length,1);assert.ok(value.tables[0].text.includes('الأحد\t1\tخامس 1\tالمهارات الرقمية'));}
  else if(expected==='PARTIAL'){assert.equal(value.ok,true,variant+JSON.stringify(value));assert.deepEqual(value.tables,[]);assert.ok(value.warnings.length);}
  else{assert.equal(value.ok,false,variant+JSON.stringify(value));assert.equal(value.code,expected,variant);assert.ok(!value.tables?.length);}
  result.cases.push({variant,status:'PASS',code:value.code??null,tables:value.tables??[],warnings:value.warnings??[]});console.log('PASS '+variant);
 }
 // A changed live teacher/source document cannot reuse the formerly bound proof.
 options={count:2};await page.evaluate(()=>document.querySelector('.school-name').textContent='مدرسة أخرى');
 const stale=await page.evaluate(async path=>(await import('/extensions/rakeez-teacher-import-helper/source-adapter.js')).readSourceReportPage('fetch',{...window.context,path}),timetable);assert.equal(stale.ok,false);assert.equal(stale.code,'SCHOOL_CONTEXT_CHANGED');result.cases.push({variant:'stale-context',status:'PASS',code:stale.code});
 assert.equal(network.some(p=>p.includes('ManageLecture')||p.includes('forbidden-resource')),false);result.network=network;assert.equal(await page.evaluate(()=>!!window.executedHandler||!!window.executedResponse),false);await c.close();
});}catch(e){result.error=e.stack;console.error(e.stack);process.exitCode=1;}finally{await new Promise(r=>server.close(r));result.resources={serverClosed:!server.listening,isolatedBrowserFinally:true};await fs.writeFile(folder+'guards.json',JSON.stringify(result,null,2)+'\n');}
