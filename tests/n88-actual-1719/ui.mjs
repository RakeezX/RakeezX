/** AI: affected real application DOM/handlers/CSS over task-owned HTTP; synthetic account only. */
import assert from 'node:assert/strict';import {readFile,writeFile} from 'node:fs/promises';import {createServer} from 'node:http';import {createRequire} from 'node:module';import {execFileSync} from 'node:child_process';import path from 'node:path';
import {fixture} from '../fixtures/n88-student-projection/canonical.mjs';import {A,providerFixture} from '../fixtures/n88-existing-host/provider.mjs';
const taskId='continuous-n88-real-teacher-timeout-light-login-20261019',runId='e6bccc29-c697-426a-a9eb-ca185c1f8595',canonicalRoot='C:/Users/Abody/Projects/RakeezX';
const lease=a=>execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-File',canonicalRoot+'/scripts/ops-supervisor-v4/resource-lease.ps1','-Name','browser','-Action',a,'-TaskFile',canonicalRoot+'/artifacts/ops-supervisor-v4/queue/'+taskId+'.json','-WaitSeconds','0','-OwnerToken',runId],{encoding:'utf8',windowsHide:true,timeout:15000}).trim();
const report={taskId,runId,status:'FAIL',checks:[],timings:[],hostedOwnerProof:false,privateBrowserRefusalPreserved:true};let server,browser,owned=false,mode='hold',calls=0,release;
const canonical=fixture().canonical;for(const rows of Object.values(canonical))for(const r of rows)r.ownerId=A;
const token=providerFixture().token(),boot="import {bootstrap} from '/tests/fixtures/n88-integrated-class/bootstrap.js';import * as store from '/src/store.js';import * as cloud from '/src/lib/cloud.js';import {mountClassService,classBinding} from '/src/lib/student-portal-runtime.js';await bootstrap();mountClassService(document.getElementById('portal'),{getBinding:w=>classBinding({cloud,store,teachingId:'teaching'},w),subscribe:fn=>{const a=cloud.subscribe(fn),b=store.subscribe(fn);return()=>{a();b();};}});";
try{
 const l=lease('acquire');assert.match(l,/^(ACQUIRED|ALREADY OWNED)/);owned=l.startsWith('ACQUIRED');
 server=createServer(async(req,res)=>{try{const u=new URL(req.url,'http://127.0.0.1');res.setHeader('Cache-Control','no-store');const send=(b,type='text/javascript')=>{res.setHeader('Content-Type',type);res.end(b);};
 if(u.pathname==='/teacher')return send('<!doctype html><html lang="ar" dir="rtl"><link rel="stylesheet" href="/src/styles/app.css"><link rel="stylesheet" href="/src/styles/student-portal-class.css"><main id="portal"></main><script type="module" src="/boot.js"></script></html>','text/html');
 if(u.pathname==='/boot.js')return send(boot);
 if(u.pathname==='/review/context')return send(JSON.stringify({ownerId:A,token,canonical}),'application/json');
 if(u.pathname==='/student')return send(await readFile('drafts/n88-student-portal/client/student.html'),'text/html');
 if(u.pathname.startsWith('/api/n88/teacher/class/')){let raw='';for await(const chunk of req)raw+=chunk;const b=JSON.parse(raw),t=performance.now(),phase=mode;calls++;
 if(phase==='hold')await new Promise(ok=>{release=ok;req.on('close',ok);});if(res.destroyed)return;
 if(phase==='fail'){res.statusCode=503;return send('{}','application/json');}
 const data=u.pathname.endsWith('/list')?{classId:'class',rosterRevision:'a'.repeat(64),policyRevision:0,visibility:Object.fromEntries(['name','class','grades','required','completed','scheduled'].map(k=>[k,false])),students:[{studentId:'student',enrollmentId:'enrollment',revision:1,label:'طالب مصطنع',hasActiveCode:false,credentialVersion:0,recoveryStatus:'inactive',credential:null}]}:{tasks:[]};
 report.timings.push({path:u.pathname,phase,elapsedMs:Math.round(performance.now()-t)});
 return send(JSON.stringify({ack:true,binding:b.binding,requestId:null,rollout:'public',data}),'application/json');}
 const file=u.pathname.slice(1);if(!/^(src|assets|font|tests\/fixtures\/n88-integrated-class|drafts\/n88-student-portal\/client)\/[A-Za-z0-9_./-]+$/.test(file)||file.includes('..')){res.statusCode=404;return res.end();}
 send(await readFile(file),{'.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'}[path.extname(file)]||'application/octet-stream');
 }catch{if(!res.headersSent)res.statusCode=500;res.end();}});
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));const origin='http://127.0.0.1:'+server.address().port;
 const {chromium}=createRequire(canonicalRoot+'/package.json')('playwright');browser=await chromium.launch({headless:true});
 if(!process.argv.includes('--login-only')){
 const c=await browser.newContext({viewport:{width:390,height:844},colorScheme:'dark',serviceWorkers:'block',locale:'ar-SA'});
 await c.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort('blockedbyclient'));
 let p=await c.newPage();const t=performance.now();await p.goto(origin+'/teacher');await p.getByRole('heading',{name:'مساحة طلاب الفصل',exact:true}).waitFor();const shellMs=Math.round(performance.now()-t);assert(shellMs<3000);
 const title=await p.getByRole('heading',{name:'مساحة طلاب الفصل',exact:true}).elementHandle();await p.locator('[data-n88-entry-state=timeout]').waitFor({timeout:13000});const timeoutMs=Math.round(performance.now()-t);assert(timeoutMs>=9900&&timeoutMs<12500);assert.equal(await p.locator('.n88-class-roster').count(),0);assert(await title.evaluate(el=>el.isConnected));
 mode='fail';release?.();await p.getByRole('button',{name:'إعادة المحاولة',exact:true}).click();await p.locator('[data-n88-entry-state=connection]').waitFor();assert.equal(await p.locator('.n88-class-roster').count(),0);
 mode='allow';await p.getByRole('button',{name:'إعادة المحاولة',exact:true}).click();await p.locator('.n88-class-roster>li').waitFor();assert.equal(await p.getByRole('heading',{name:'مساحة طلاب الفصل',exact:true}).count(),1);
 await p.evaluate(()=>window.n88Fixture.switchOwner());await p.locator('[data-n88-retry]').waitFor();assert.equal(await p.locator('.n88-class-roster').count(),0);
 report.checks.push({teacher:'real store/bootstrap/owner guard + actual HTTP: immediate shell, bounded no-response timeout,503 failure then successful re-admission, owner change clears private data',shellMs,timeoutMs});
 await c.close();
 }else{const prior=JSON.parse(await readFile('tests/n88-actual-1719/ui.teacher-pass.json','utf8'));assert.equal(prior.status,'PASS');report.checks.push(prior.checks[0]);report.reusedTeacher='ui.teacher-pass.json; teacher source unchanged by heading focus styling';}
 for(const width of [390,1440]){const ctx=await browser.newContext({viewport:{width,height:900},colorScheme:'dark',serviceWorkers:'block',locale:'ar-SA'});await ctx.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort('blockedbyclient'));let p=await ctx.newPage();await p.goto(origin+'/student');await p.getByRole('heading',{name:'مساحة الطالب',exact:true}).waitFor();assert.equal(await p.getByText('أدخل رمز الدخول الذي أعطاك معلمك',{exact:true}).count(),1);assert.equal(await p.getByLabel('رمز الدخول',{exact:true}).isEnabled(),true);
 const layout=await p.evaluate(()=>{const r=document.querySelector('.n88-unified'),i=document.querySelector('input'),b=document.querySelector('[type=submit]'),logo=document.querySelector('.brand-lockup__image--light');return {background:getComputedStyle(r).backgroundColor,scheme:getComputedStyle(r).colorScheme,font:getComputedStyle(r).fontFamily,gap:b.getBoundingClientRect().top-i.getBoundingClientRect().bottom,logo:logo.complete&&logo.naturalWidth>0,overflow:document.documentElement.scrollWidth>innerWidth,heading:document.querySelector('h1').textContent};});
 assert.equal(layout.background,'rgb(244, 247, 245)');assert.equal(layout.scheme,'light');assert(layout.logo);assert(layout.gap>=12);assert(!layout.overflow);await p.screenshot({path:'tests/n88-actual-1719/login-'+width+'.png',fullPage:true});report.checks.push({width,layout});await ctx.close();}
 report.status='PASS';
}catch(e){report.failure={name:e.name,message:String(e.message).slice(0,500)};process.exitCode=1;}
finally{release?.();await browser?.close();if(server?.listening){server.closeAllConnections();await new Promise(ok=>server.close(ok));}report.cleanup={ownedBrowserAndServerClosed:true,browserLease:owned?lease('release'):'not acquired'};await writeFile('tests/n88-actual-1719/ui.json',JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify(report));
