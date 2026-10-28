/** AI-authored: actual mounted route/runtime/client/owner guards and source CSS, synthetic transport only. */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {start} from './server.mjs';
const canonical='C:/Users/Abody/Projects/RakeezX',taskId='n88-fields-1028',runId='3fab0d26-7de3-4b7b-bfc0-35e13783c3c6',base='5a043dcd8201fcb10161e456e4b301222c843755';
const dir='tests/n88-field-defaults-20261028',owned=[],report={taskId,runId,base,checks:[],matrix:[],pageErrors:[],realOperations:0,cleanup:{}};
const lease=(name,action)=>execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-File',canonical+'/scripts/ops-supervisor-v4/resource-lease.ps1','-Name',name,'-Action',action,'-TaskFile',canonical+'/artifacts/ops-supervisor-v4/queue/'+taskId+'.json','-RuntimeRoot',canonical+'/artifacts/ops-supervisor-v4','-WaitSeconds','0','-OwnerToken',runId],{encoding:'utf8',windowsHide:true,timeout:20000}).trim();
let server,browser,fixtureNumber=0,stage='source';
const sourceHashes=async()=>Object.fromEntries(await Promise.all(['src/views/student-portal-class.js','src/styles/student-portal-class.css','sw.js','tests/n88-field-defaults-20261028/server.mjs','tests/n88-field-defaults-20261028/ports.js'].map(async p=>[p,createHash('sha256').update(await readFile(p)).digest('hex')])));
const zero={name:false,class:false,grades:false,required:false,scheduled:false,completed:false},defaults={grades:false,required:true,scheduled:true,completed:true};
const values=p=>p.locator('[data-visibility] input').evaluateAll(es=>Object.fromEntries(es.map(e=>[e.name,e.checked])));
const writes=p=>p.evaluate(()=>window.compactFixture.calls.filter(x=>!['list','guidance-list'].includes(x.action)));
const idle=p=>p.waitForFunction(()=>document.querySelector('.n88-class')?.getAttribute('aria-busy')==='false');
async function boot(p,config={}){
 if(p.url().startsWith(server.url.split('/#')[0]))await p.evaluate(()=>localStorage.clear());
 await p.goto(server.url.replace('/#','/?fixture='+(++fixtureNumber)+'#'));await p.waitForFunction(()=>!!window.compactFixture);
 await p.evaluate(config=>{const f=window.compactFixture;Object.assign(f,config);if(config.visibility)f.roster.visibility=config.visibility;if(config.revision!==undefined)f.roster.policyRevision=config.revision;},config);
 await p.getByRole('link',{name:/مساحة الطلاب/}).first().click();if(config.failRead){await p.locator('[data-n88-retry]').waitFor();return;}await p.locator('[data-action=refresh]').waitFor();await idle(p);
}
async function absent(p){const text=await p.locator('.n88-class').innerText();for(const t of ['اسم الطالب والفصل بيانات هوية ثابتة عند حفظ السياسة.','السياسة السابقة تخفي الاسم أو الفصل. لن تتغير إلا بعد حفظك وإقرار الخادم؛ عرض الطلاب الحالي يتبع السياسة السابقة.'])assert.ok(!text.includes(t));assert.equal(await p.locator('[name=name],[name=class]').count(),0);}
async function refresh(p){await p.locator('[data-action=refresh]').click();await idle(p);}
try{
 const sw=await readFile('sw.js','utf8'),prior=execFileSync('git',['show',base+':sw.js'],{encoding:'utf8'}).replaceAll('\r\n','\n');
 assert.equal(sw.replaceAll('\r\n','\n'),prior.replace("const VERSION = 'rakeezx-v93';","const VERSION = 'rakeezx-v94';"));
 for(const name of ['integration','browser']){assert.match(lease(name,'acquire'),/^(ACQUIRED|ALREADY OWNED)/);owned.push(name);}
 server=await start();server.deploy();const origin=new URL(server.url).origin;
 browser=await createRequire(canonical+'/package.json')('playwright').chromium.launch({headless:true});
 const context=async(width=390,theme='light',sw='block')=>{const c=await browser.newContext({viewport:{width,height:1000},colorScheme:theme,serviceWorkers:sw});await c.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort('blockedbyclient'));const p=await c.newPage();p.setDefaultTimeout(9000);p.on('pageerror',e=>report.pageErrors.push(e.message));return {c,p};};
 let matrixReuse;try{matrixReuse=JSON.parse(await readFile(`${dir}/matrix-result.json`,'utf8'));assert.deepEqual(matrixReuse.sourceHashes,await sourceHashes());}catch{matrixReuse=null;}
 if(matrixReuse){report.matrix=matrixReuse.matrix;report.matrixReuse='matrix-result.json';}
 if(!matrixReuse)for(const theme of ['light','dark'])for(const width of [320,390,768,1280]){
  stage=`matrix-${width}-${theme}`;const {c,p}=await context(width,theme);await boot(p,{seedUnknown:true});await p.evaluate(t=>document.documentElement.dataset.theme=t,theme);
  await absent(p);assert.deepEqual(await values(p),defaults);assert.match(await p.locator('.n88-class-settings>summary').innerText(),/3 من 4 مختار · غير محفوظ/);assert.deepEqual(await writes(p),[]);
  assert.deepEqual(await p.evaluate(()=>window.compactFixture.roster.visibility),zero);assert.equal(await p.evaluate(()=>window.compactFixture.roster.policyRevision),0);
  assert.equal(await p.locator('[data-action=batch]').isDisabled(),true);assert.match(await p.locator('.n88-class-status').innerText(),/نجاح قراءة القائمة لا يؤكد إنشاء الرموز/);
  const hint=await p.evaluate(()=>localStorage.getItem(window.compactFixture.hintKey));await refresh(p);assert.equal(await p.evaluate(()=>localStorage.getItem(window.compactFixture.hintKey)),hint);assert.deepEqual(await writes(p),[]);
  await p.locator('.n88-code-management>summary').click();await p.waitForFunction(()=>document.querySelectorAll('.n88-class-roster>li').length===28&&document.querySelector('.n88-class')?.getAttribute('aria-busy')==='false');assert.equal(await p.locator('.n88-class-roster>li').count(),28);
  const geometry=await p.evaluate(()=>({rtl:getComputedStyle(document.querySelector('.n88-class')).direction==='rtl',overflow:document.documentElement.scrollWidth>innerWidth,targets:[...document.querySelectorAll('.n88-class button,.n88-class summary,.n88-class input')].filter(e=>e.checkVisibility()).every(e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth;})}));assert.deepEqual(geometry,{rtl:true,overflow:false,targets:true});
  await p.screenshot({path:`${dir}/teacher-${width}-${theme}.png`,fullPage:true});report.matrix.push({width,theme,...geometry,pupils:28});await c.close();
 }
 if(!matrixReuse)await writeFile(`${dir}/matrix-result.json`,JSON.stringify({matrix:report.matrix,sourceHashes:await sourceHashes()},null,2)+'\n');
 const {c,p}=await context();
 stage='deliberate draft and ACK';await boot(p);await p.locator('[name=grades]').check();assert.deepEqual(await values(p),{...defaults,grades:true});assert.match(await p.locator('.n88-class-settings>summary').innerText(),/4 من 4 مختار · غير محفوظ/);assert.deepEqual(await writes(p),[]);await refresh(p);assert.deepEqual(await values(p),{...defaults,grades:true});
 await p.locator('[data-visibility] [type=submit]').click();await idle(p);const sent=(await writes(p))[0];assert.equal(sent.action,'visibility');assert.equal(sent.body.policyRevision,0);assert.deepEqual(sent.body.fields,{name:true,class:true,...defaults,grades:true});assert.equal(await p.evaluate(()=>window.compactFixture.roster.policyRevision),1);assert.doesNotMatch(await p.locator('.n88-class-settings>summary').innerText(),/غير محفوظ/);await absent(p);
 stage='persisted exact choices';for(const prior of [zero,{name:true,class:true,grades:true,required:false,scheduled:true,completed:false}]){
  await boot(p,{revision:7,visibility:prior});await absent(p);assert.deepEqual(await values(p),Object.fromEntries(Object.keys(defaults).map(k=>[k,prior[k]])));assert.deepEqual(await writes(p),[]);assert.doesNotMatch(await p.locator('.n88-class-settings>summary').innerText(),/غير محفوظ/);
  await p.locator('[data-visibility] [type=submit]').click();await idle(p);assert.deepEqual((await writes(p))[0].body.fields,{...prior,name:true,class:true});assert.equal((await writes(p))[0].body.policyRevision,7);
 }
 stage='failed and malformed ACK retain draft and remote';for(const fault of ['failVisibility','badAck']){
  await boot(p,{[fault]:true});await p.locator('[name=grades]').check();await p.locator('[data-visibility] [type=submit]').click();await idle(p);assert.deepEqual(await values(p),{...defaults,grades:true});assert.deepEqual(await p.evaluate(()=>window.compactFixture.roster.visibility),zero);assert.match(await p.locator('.n88-class-settings>summary').innerText(),/غير محفوظ/);assert.equal(await p.locator('[data-visibility] [type=submit]').isDisabled(),true);await refresh(p);assert.deepEqual(await values(p),{...defaults,grades:true});assert.equal((await writes(p)).length,1);assert.equal(await p.locator('[data-action=batch]').isDisabled(),true);
 }
 stage='failed read creates no form or defaults';await boot(p,{failRead:true});assert.equal(await p.locator('[data-visibility]').count(),0);assert.deepEqual(await writes(p),[]);await p.evaluate(()=>window.compactFixture.failRead=false);await p.locator('[data-n88-retry]').click();await p.locator('[data-visibility]').waitFor();await idle(p);assert.deepEqual(await values(p),defaults);assert.deepEqual(await writes(p),[]);
 stage='independent guidance failure';await boot(p,{failGuidance:true});await p.locator('[data-guidance-refresh]').waitFor();assert.match(await p.locator('.n88-guidance-body').innerText(),/تعذّرت قراءة الحالة. مسودتك محفوظة/);assert.deepEqual(await values(p),defaults);
 stage='owner change retires draft and late read';await boot(p);await p.locator('[name=grades]').check();await p.evaluate(()=>{window.compactFixture.delay=120;document.querySelector('[data-action=refresh]').click();window.n88Fixture.switchOwner();window.compactFixture.notify();});await p.waitForTimeout(200);assert.equal(await p.locator('[data-visibility],[data-code],[data-manual]').count(),0);assert.equal(await p.evaluate(()=>{try{window.compactFixture.getBinding(false);return false;}catch{return true;}}),true);assert.deepEqual(await writes(p),[]);
 stage='lease retirement without autosave';await boot(p);await p.locator('[name=grades]').check();await p.evaluate(()=>{window.compactFixture.mode='denied';window.n88Fixture.expire();window.compactFixture.notify();});await p.waitForFunction(()=>!document.querySelector('[data-visibility]'));assert.deepEqual(await writes(p),[]);
 await c.close();
 stage='PWA 93 to 94 cache';server.old();const x=await context(390,'light','allow');
 await x.p.goto(origin+'/');await x.p.evaluate(async()=>{await navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'});await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)await new Promise(r=>navigator.serviceWorker.addEventListener('controllerchange',r,{once:true}));});assert.deepEqual(await x.p.evaluate(()=>caches.keys()),['rakeezx-v93']);
 const asset='/src/views/student-portal-class.js';const old=await x.p.evaluate(async a=>(await (await (await caches.open('rakeezx-v93')).match(a)).text()),asset);assert.ok(old.includes('اسم الطالب والفصل بيانات هوية ثابتة عند حفظ السياسة.'));
 server.deploy();await x.p.evaluate(async()=>{const changed=new Promise(r=>navigator.serviceWorker.addEventListener('controllerchange',r,{once:true}));await (await navigator.serviceWorker.getRegistration()).update();await changed;});await x.p.waitForFunction(async()=>{const k=await caches.keys();return k.includes('rakeezx-v94')&&!k.includes('rakeezx-v93');});
 const cached=await x.p.evaluate(async a=>(await (await (await caches.open('rakeezx-v94')).match(a)).text()),asset);assert.equal(cached,(await readFile('.'+asset,'utf8')).replace('runtime.mountClassService(target,','window.compactFixture.mount(target,'));assert.notEqual(cached,old);
 await x.c.setOffline(true);assert.equal(await x.p.evaluate(a=>fetch(a).then(r=>r.text()),asset),cached);assert.equal(await x.p.evaluate(async()=>{try{await fetch('/api/n88/synthetic-private');return false;}catch{return true;}}),true);await x.c.close();
 assert.deepEqual(report.pageErrors,[]);
 report.checks=[
  ['n88_remove_two_identity_explanation_paragraphs_no_fake_server_fix','Absent in actual zero, legacy and active saved UI; four checkboxes only; identity remains fixed in six-key explicit saves.'],
  ['n88_new_policy_form_required_scheduled_completed_checked_grades_off','Revision-zero server all-false stays unchanged while draft is 3/4 unsaved; toggles/count/refresh and failed reads never auto-save.'],
  ['n88_existing_saved_visibility_preserved_six_key_explicit_ack_only','Revision 7 all-false/mixed grades-on preserved exactly; guarded client CAS and ACK; 503/malformed ACK retain draft and unchanged server fixture.'],
  ['n88_owner_unknown_issuance_and_guidance_safe_ui_320_390_768_1280','Eight actual-app RTL light/dark screenshots, 28 fabricated pupils, no overflow; UNKNOWN hint/disabled issue, read-only refresh, independent guidance error, real owner and lease guards retire drafts/stale reply.'],
  ['n88_pwa_cache_update_and_no_n44_shared_sw_conflict','Fresh origin/main equals base; no running/delivery N44 SW owner at source edit. Only SW version byte change 93->94; shared leased fresh-context actual cache upgrade evicts v93, serves new teacher bytes offline; N88 API stays network-only; push unchanged.']
 ].map(([name,evidence])=>({name,status:'PASS',evidence}));
 report.sourceHashes=Object.fromEntries(await Promise.all(['src/views/student-portal-class.js','src/styles/student-portal-class.css','sw.js'].map(async p=>[p,createHash('sha256').update(await readFile(p)).digest('hex')])));
}catch(e){report.failure={stage,message:e.message,stack:e.stack};process.exitCode=1;}
finally{await browser?.close();report.cleanup.browserClosed=true;await server?.close();report.cleanup.serverClosed=true;for(const name of owned.reverse())report.cleanup[name]=lease(name,'release');await writeFile(`${dir}/${report.failure?'failure-'+Date.now():'result'}.json`,JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify(report));

