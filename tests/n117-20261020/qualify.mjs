// AI: affected native PostgreSQL + actual application DOM qualification only.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import http from 'node:http';
import {execFile,spawn} from 'node:child_process';
import {promisify} from 'node:util';
import {pathToFileURL} from 'node:url';
import {randomUUID,createHash} from 'node:crypto';
import {chromium} from '@playwright/test';
import {EDUCATION_DEPARTMENT_OPTIONS as OPTIONS, initialDepartmentCalendarPreset as mapped} from '../../src/lib/education-department-directory.js';
import {buildAccountFoundationDefaults} from '../../src/lib/account-provisioning.js';
import {AUTH_STORAGE_KEY,SUPABASE_URL} from '../../src/lib/cloud.js';
import {completeProfile,validateProfileCompletion} from '../../src/lib/account-profile.js';
const exec=promisify(execFile), shared='C:/Users/Abody/Projects/RakeezX/artifacts/n77-native-pg17';
const {default:pg}=await import(pathToFileURL(shared+'/client/node_modules/pg/lib/index.js'));
const runId='0ebb5450-f191-4951-b332-e54cee3e2455', folder=path.resolve('tests/n117-20261020'), root=process.cwd();
const cluster=path.join(folder,'runtime-'+randomUUID()), migration='20261020085614_n117_initial_department_calendar.sql';
const checks=[], hashes={}, preimages=[];
const record=(name,evidence)=>{checks.push({name,status:'PASS',evidence});console.log('PASS '+name);};
const hash=s=>createHash('sha256').update(s).digest('hex');
const bin=n=>path.join(shared,'package/native/bin',n+'.exe');
const ctl=args=>new Promise((resolve,reject)=>{const child=spawn(bin('pg_ctl'),args,{windowsHide:true,stdio:'ignore'});child.on('error',reject);child.on('exit',c=>c===0?resolve():reject(Error('pg_ctl '+c)));});
const port=()=>new Promise(resolve=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});
let client,started=false,browser,server,failure;
let serial=Promise.resolve();
const ownerWork=(owner,work)=>{const job=serial.then(async()=>{await client.query('set role authenticated');await client.query("select set_config('request.jwt.claim.sub',$1,false)",[owner]);try{return await work();}finally{await client.query('reset role');}});serial=job.catch(()=>{});return job;};
const rpc=(owner,name,args=[],params='')=>ownerWork(owner,async()=> (await client.query(`select rakeezx.${name}(${params}) result`,args)).rows[0].result);
const newOwner=async()=>{const owner=randomUUID();await client.query('insert into auth.users(id,email) values($1,$2)',[owner,'synthetic@example.invalid']);return owner;};
const complete=(owner,department)=>rpc(owner,'complete_account_profile',['Synthetic teacher','0500000001','masculine',null,department],'$1,$2,$3,$4,$5');
const provision=(owner,defaults)=>rpc(owner,'provision_account_workspace',[JSON.stringify(defaults)],'$1::jsonb');
const contract=owner=>rpc(owner,'account_contract');
const mime={'.js':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
try {
  await fs.mkdir(cluster,{recursive:true});const p=await port();
  await exec(bin('initdb'),['-D',cluster,'-U','postgres','-A','trust','--encoding=UTF8','--no-locale'],{windowsHide:true,timeout:30000});
  await ctl(['-D',cluster,'-l',path.join(cluster,'server.log'),'-o',`-h 127.0.0.1 -p ${p}`,'-w','start']);started=true;
  client=new pg.Client({host:'127.0.0.1',port:p,user:'postgres',database:'postgres'});await client.connect();
  await client.query(`create schema auth;create schema realtime;create role authenticated;create role anon;create role service_role;
    create table auth.users(id uuid primary key,email text);
    create function auth.uid() returns uuid language sql stable security definer set search_path='' as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to authenticated,anon;
    create table realtime.messages(extension text,topic text);alter table realtime.messages enable row level security;
    create function realtime.topic() returns text language sql stable as $$select current_setting('realtime.topic',true)$$;
    create function realtime.send(jsonb,text,text,boolean) returns void language sql as $$select$$;`);
  const saved=['20261004070000_n58_calendar_persistence.sql','20261004070001_n58_extra_term_compatibility.sql','20261004070002_n58_effective_scope_revalidation.sql'];
  // Unrelated N88/N44 staged services need their own Auth/service fixtures and
  // are outside this initial-profile scenario. Keep calendar/academic guards.
  for(const file of [...new Set([...await fs.readdir('supabase/migrations'),...saved])].sort().filter(x=>/^\d+.*\.sql$/.test(x)&&x!==migration&&!/_n(?:88|44)_/.test(x))){
    const sql=(saved.includes(file)?(await exec('git',['show','4fa6fb8b98415a42dd0a835bfdd7038ab65b8979:supabase/migrations/'+file],{windowsHide:true,maxBuffer:20000000})).stdout:await fs.readFile('supabase/migrations/'+file,'utf8')).replace(/^\uFEFF/,'').replaceAll('\r\n','\n');
    if(file==='20261014090000_n100_automatic_safe_copy.sql')for(const row of JSON.parse(await fs.readFile('tests/n100-automatic-provider-source.json','utf8')))await client.query(row.definition);
    hashes[file]=hash(sql);await client.query(sql);
  }
  for(const signature of ['rakeezx.complete_account_profile(text,text,text,text)','rakeezx.provision_account_workspace(jsonb)','rakeezx.n58_guard_calendar_contract()','rakeezx.guard_account_provisioning_state()','rakeezx.account_provisioning_foundation_complete(uuid)']){
    preimages.push((await client.query('select oid::regprocedure::text signature,md5(replace(prosrc,E\'\\r\\n\',E\'\\n\')) body_md5,pg_get_functiondef(oid) definition,proacl::text acl from pg_proc where oid=$1::regprocedure',[signature])).rows[0]);
  }
  // Existing account remains a distinct non-provisioning path.
  const existing=await newOwner();await client.query("select set_config('request.jwt.claim.sub',$1,false)",[existing]);await client.query("select set_config('rakeezx.profile_completion','ready',false)");
  await client.query("insert into rakeezx.profile(owner_id,teacher_name,phone,profile_status) values($1,'Existing','0500000001','READY')",[existing]);
  await client.query("select set_config('rakeezx.profile_completion','',false)");
  const legacyBefore=await contract(existing);
  const sql=await fs.readFile('supabase/migrations/'+migration,'utf8');hashes[migration]=hash(sql);await client.query(sql);
  assert.deepEqual(await contract(existing),legacyBefore);
  await assert.rejects(rpc(existing,'begin_account_provisioning'),/not a fresh provisioning candidate/);
  await rpc(existing,'complete_account_profile',['Existing','0500000001','masculine',null],'$1,$2,$3,$4');
  assert.equal((await contract(existing)).provisioning,null);
  record('existing_account_and_four_argument_client_preserved','Existing contract unchanged; no fresh provisioning; old four-argument completion still works for existing account.');
  assert.equal(OPTIONS.length,47);
  assert.equal(OPTIONS.filter(x=>mapped(x.canonicalName)==='sa-western-1448-1449').length,4);
  assert.equal(mapped('إدارة التعليم بجدة أخرى'),null);assert.equal(mapped(''),null);
  const required={teacherName:'Synthetic',phone:'0500000001'};
  assert.equal(validateProfileCompletion(required,{requireDepartment:true}).valid,false);
  assert.equal(validateProfileCompletion({...required,educationDepartment:'جدة'},{requireDepartment:true}).valid,false);
  let completionWrites=0;
  const changedOwnerAPI={user:{id:existing},async getAccountContract(){const c=await contract(existing);this.user={id:randomUUID()};return c;},async completeAccountProfile(){completionWrites++;}};
  await assert.rejects(completeProfile(required,{api:changedOwnerAPI}),/owner mismatch|account changed/);
  assert.equal(completionWrites,0);
  record('client_required_invalid_and_owner_change','Required canonical department validation rejects empty/free text; owner change during profile preflight prevents the completion RPC.');
  for(const option of OPTIONS.filter(x=>['مكة المكرمة','جدة','المدينة المنورة','الطائف','الرياض'].includes(x.shortLabel))){
    const owner=await newOwner();await rpc(owner,'provision_account_profile');
    await assert.rejects(complete(owner,null),/N117_DEPARTMENT_REQUIRED/);
    await assert.rejects(complete(owner,'جدة'),/N117_DEPARTMENT_REQUIRED/);
    const c=await complete(owner,option.canonicalName);assert.equal(c.profile.educationDepartment,option.canonicalName);
    // Restart checkpoint before begin: department is read from native profile.
    assert.equal((await contract(owner)).profile.educationDepartment,option.canonicalName);
    await rpc(owner,'begin_account_provisioning');
    const defaults=buildAccountFoundationDefaults(mapped(option.canonicalName));
    const wrong=buildAccountFoundationDefaults(mapped(option.canonicalName)==='sa-western-1448-1449'?'sa-general-1448-1449':'sa-western-1448-1449');
    await assert.rejects(provision(owner,wrong),/N117_INITIAL_PRESET_MISMATCH/);
    const bad=structuredClone(defaults);bad.terms[0].startDate='2026-08-01';
    await assert.rejects(provision(owner,bad),/N117_INITIAL_PRESET_MISMATCH/);
    assert.equal((await client.query('select count(*)::int n from rakeezx.years where owner_id=$1',[owner])).rows[0].n,0);
    const ready=await provision(owner,defaults);
    assert.equal(ready.snapshot.years[0].calendar_preset_id,mapped(option.canonicalName));
    assert.equal(ready.snapshot.calendars[0].source,'moe');
    assert.equal(ready.snapshot.calendars[0].id,defaults.calendars[0].id);
    assert.equal(ready.snapshot.profile[0].education_department,option.canonicalName);
    const retry=await provision(owner,buildAccountFoundationDefaults(mapped(option.canonicalName)));assert.deepEqual(retry.snapshot,ready.snapshot);
    // Settings metadata may change, but READY can never remap the year.
    await client.query('update rakeezx.profile set education_department=$1 where owner_id=$2',[OPTIONS.find(x=>x.shortLabel==='الرياض').canonicalName,owner]);
    assert.deepEqual((await provision(owner,wrong)).snapshot.years,ready.snapshot.years);
    record('native_initial_'+option.shortLabel,'Required/canonical field; durable interruption checkpoint; wrong mapping/date rejected atomically; correct preset before READY; idempotent retry; existing year unchanged by department metadata.');
  }
  const foreign=await newOwner();await assert.rejects(provision(foreign,buildAccountFoundationDefaults()),/has not begun/);
  await client.query('set role anon');await assert.rejects(client.query('select rakeezx.provision_account_workspace($1)',[JSON.stringify(buildAccountFoundationDefaults())]),/permission denied/);await client.query('reset role');
  const signatures=(await client.query("select proname,count(*)::int n from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='rakeezx' and proname in ('complete_account_profile','provision_account_workspace') group by proname")).rows;
  assert.ok(signatures.every(x=>x.n===1));
  record('native_owner_acl_no_overload','Foreign owner without checkpoint denied; anon denied; exactly one public signature per RPC.');

  // Serve the actual application source/CSS. Synthetic transport routes invoke
  // the actual owner-derived native functions above; no lookalike UI or live API.
  server=http.createServer(async(req,res)=>{const f=path.resolve(root,'.'+new URL(req.url,'http://127.0.0.1').pathname);const target=f===root?path.join(root,'index.html'):f;if(!target.startsWith(root+path.sep))return res.writeHead(403).end();try{const content=await fs.readFile(target);res.writeHead(200,{'Content-Type':mime[path.extname(target)]||'application/octet-stream'});res.end(content);}catch{if(!res.headersSent)res.writeHead(404);res.end();}});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({headless:true});const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'allow'});
  const owner=await newOwner(), session={access_token:'n117-synthetic-local',refresh_token:'n117-local-only',expires_at:4102444800,user:{id:owner,email:'n117@example.invalid'}};
  let loseResponse=true, calls=0;const page=await context.newPage();
  await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
  await context.route(SUPABASE_URL+'/auth/v1/**',route=>route.fulfill({json:session.user}));
  await context.route(SUPABASE_URL+'/rest/v1/**',async route=>{
    const name=new URL(route.request().url()).pathname.split('/').at(-1), body=route.request().postDataJSON()??{};
    try{let result;
      if(name==='account_contract')result=await contract(owner);
      else if(name==='provision_account_profile'||name==='begin_account_provisioning')result=await rpc(owner,name);
      else if(name==='complete_account_profile')result=await complete(owner,body.p_education_department);
      else if(name==='provision_account_workspace'){calls++;result=await provision(owner,body.p_defaults);if(loseResponse){loseResponse=false;return route.fulfill({status:503,json:{message:'Synthetic lost response after native commit'}});}}
      else result=[];
      await route.fulfill({json:result});
    }catch(error){await route.fulfill({status:400,json:{message:error.message,code:error.code}});}
  });
  await page.addInitScript(({key,session})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(session));},{key:AUTH_STORAGE_KEY,session});
  await page.goto(origin);await page.locator('[data-account-profile-form]').waitFor();
  const department=OPTIONS.find(x=>x.shortLabel==='الرياض').canonicalName;
  assert.equal(await page.locator('[name=educationDepartment]').evaluate(x=>x.required&&!x.checkValidity()),true);
  assert.equal(await page.locator('[name=educationDepartment] option').count(),48);
  assert.equal(await page.locator('#initial-department-hint').innerText(),'تحدد إدارة التعليم التقويم المعتمد لحسابك');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.setViewportSize({width:1280,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.locator('[name=teacherName]').fill('Synthetic teacher');await page.locator('[name=phone]').fill('0500000001');
  await page.locator('[name=educationDepartment]').selectOption(department);
  await page.locator('[type=submit]').click();await page.locator('[data-restore-retry]').waitFor();
  assert.equal((await contract(owner)).profile.educationDepartment,department);
  await page.reload();await page.locator('#main').waitFor();
  const checkpoint=await page.evaluate(async owner=>{const s=await import('/src/store.js'),d=await import('/src/lib/db.js'),c=await import('/src/lib/cloud.js');const w=s.getActiveWorkspace();assertOwner();function assertOwner(){if(w?.authUserId!==owner||c.user?.id!==owner||w.databaseName!==d.getActiveDatabaseName())throw Error('N117 checkpoint owner changed');}const data=Object.fromEntries(await Promise.all(['years','terms','profile','outbox','sessions','slots'].map(async k=>[k,await d.getAll(k)])));assertOwner();return {w,data};},owner);
  assert.equal(checkpoint.data.years.length,1);assert.equal(checkpoint.data.years[0].calendarPresetId,'sa-general-1448-1449');assert.equal(checkpoint.data.terms.length,2);assert.equal(checkpoint.data.outbox.length,0);assert.equal(checkpoint.data.sessions.length,0);assert.equal(checkpoint.data.slots.length,0);assert.equal(checkpoint.data.profile[0].educationDepartment,department);
  await page.reload();await page.locator('#main').waitFor();assert.equal(calls,2);
  record('actual_profile_native_unknown_outcome_retry','Actual app DOM/CSS/submit -> owner-checked completion -> native SQL; lost response after commit; reload imports correct general preset/department once, one year/two terms, no slots/sessions/outbox; subsequent reload does not reprovision. Responsive 390/1280.');
  // One affected offline field gate using the actual installed shell in another
  // fresh synthetic owner context (same owned browser and shared phase lease).
  const offline=await browser.newContext({viewport:{width:390,height:844}}), op=await offline.newPage(), offlineOwner=await newOwner();
  const osession={...session,user:{id:offlineOwner,email:'n117-offline@example.invalid'}};
  await offline.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
  await offline.route(SUPABASE_URL+'/auth/v1/**',r=>r.fulfill({json:osession.user}));
  await offline.route(SUPABASE_URL+'/rest/v1/**',async r=>{const n=new URL(r.request().url()).pathname.split('/').at(-1);await r.fulfill({json:n==='account_contract'?await contract(offlineOwner):n==='provision_account_profile'?await rpc(offlineOwner,n):[]});});
  await op.addInitScript(({key,session})=>localStorage.setItem(key,JSON.stringify(session)),{key:AUTH_STORAGE_KEY,session:osession});
  await op.goto(origin);await op.locator('[data-account-profile-form]').waitFor();await op.evaluate(()=>navigator.serviceWorker.ready);await op.waitForFunction(()=>!!navigator.serviceWorker.controller);
  assert.equal(await op.evaluate(async()=>!!await caches.match(new URL('/src/lib/education-department-directory.js',location.origin))),true);
  await op.evaluate(()=>Object.defineProperty(navigator,'onLine',{get:()=>false,configurable:true}));
  await op.locator('[name=teacherName]').fill('Offline synthetic');await op.locator('[name=phone]').fill('0500000001');await op.locator('[type=submit]').click();
  assert.equal(await op.locator('[name=educationDepartment]').evaluate(x=>!x.checkValidity()),true);
  assert.equal((await contract(offlineOwner)).provisioning.state,'PROFILE_REQUIRED');
  record('offline_profile_field_gate','Actual installed shell caches approved department module; required empty selection blocks actual form submit offline before completion or year creation. No full PWA certification.');
  await op.locator('[name=educationDepartment]').selectOption(department);
  await op.evaluate(async()=>{await (await import('/src/lib/cloud.js')).signOut();});
  await op.locator('[type=submit]').click();await op.locator('[data-profile-error]:not([hidden])').waitFor();
  assert.equal((await contract(offlineOwner)).provisioning.state,'PROFILE_REQUIRED');
  record('actual_profile_owner_guard','Actual stale profile form submit after synthetic logout is rejected by the app owner guard; native profile remains PROFILE_REQUIRED with no foundation.');
  await fs.writeFile(path.join(folder,'local-service-definitions.json'),JSON.stringify({preimages,after:(await client.query("select oid::regprocedure::text signature,md5(replace(prosrc,E'\\r\\n',E'\\n')) body_md5,pg_get_functiondef(oid) definition,proacl::text acl from pg_proc where oid in ('rakeezx.complete_account_profile(text,text,text,text,text)'::regprocedure,'rakeezx.provision_account_workspace(jsonb)'::regprocedure)")).rows},null,2)+'\n');
}catch(error){failure={message:error.message,stack:error.stack};console.error(error);process.exitCode=1;}
finally{
  await browser?.close();if(server)await new Promise(r=>server.close(r));await client?.end();if(started)await ctl(['-D',cluster,'-m','fast','-w','stop']);
  // Retain stopped synthetic data directories. A prior combined recursive
  // cleanup command was policy-denied; do not reproduce deletion elsewhere.
  assert.ok(cluster.startsWith(folder+path.sep)&&path.basename(cluster).startsWith('runtime-'));
  await fs.writeFile(path.join(folder,'qualification.json'),JSON.stringify({runId,checks,failure,hashes,ownedResourcesClosed:true,hostedWrites:0},null,2)+'\n');
}
