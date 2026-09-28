import { test, chromium, webkit, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile,stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { AUTH_STORAGE_KEY } from '../src/lib/cloud.js';
import { buildAccountFoundationDefaults } from '../src/lib/account-provisioning.js';
import { encodeSyncV2Patch } from '../src/lib/sync-v2.js';
// A separate read-only static root allows this regression to run against an unchanged baseline.
const ROOT=process.env.N40_SOURCE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OWNER='80808080-8080-4080-8080-808080808080';
const SESSION={access_token:'synthetic-n40-0382',refresh_token:'synthetic-n40-refresh',expires_at:4102444800,user:{id:OWNER,email:'n40-audit@example.test'}};
const mime={'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.png':'image/png','.json':'application/json','.webmanifest':'application/manifest+json','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/__audit_fixture__')return res.writeHead(200,{'Content-Type':'text/html'}).end('<!doctype html><title>synthetic fixture</title>');
  const f=path.resolve(ROOT,url.pathname==='/'?'index.html':decodeURIComponent(url.pathname).slice(1));
  if(!f.startsWith(path.resolve(ROOT)+path.sep)||url.pathname.split('/').some(x=>x.startsWith('.')))return res.writeHead(403).end();
  try{if(!(await stat(f)).isFile())throw Error();res.writeHead(200,{'Content-Type':mime[path.extname(f)]||'application/octet-stream'}).end(await readFile(f));}
  catch{res.writeHead(404).end();}
});
let host;
test.beforeAll(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));host='http://127.0.0.1:'+server.address().port;});
test.afterAll(async()=>{await new Promise(r=>server.close(r));});
const scenarios=[
  {width:1440,initial:'masculine',final:'masculine',input:'untouched',theme:'light'},
  {width:1440,initial:'feminine',final:'feminine',input:'untouched',theme:'dark'},
  {width:1440,initial:'masculine',final:'feminine',input:'click',theme:'light'},
  {width:1440,initial:'feminine',final:'masculine',input:'keyboard',theme:'dark'},
  {width:390,initial:'feminine',final:'feminine',input:'touch',theme:'light'},
];
function contract(profile,state,status){return {ownerId:OWNER,profileStatus:status,profile,access:{grantType:'beta_full',status:'active',source:'public_beta'},provisioning:{state,version:1,foundationHash:state==='READY'?'synthetic-n40-foundation':null}};}
function canonical(profile){
  const out={profile:[{owner_id:OWNER,revision:1,field_revisions:{},deleted_at:null,teacher_name:profile.teacherName,phone:profile.phone,teacher_form:profile.teacherForm,school_name:profile.schoolName,profile_status:'READY'}]};
  const map={years:'years',terms:'terms',subjects:'subjects',calendars:'calendars',calendarDays:'calendar_days',timeProfiles:'time_profiles'};
  for(const [store,entity] of Object.entries(map))out[entity]=buildAccountFoundationDefaults()[store].map(rec=>({id:rec.id,owner_id:OWNER,revision:1,field_revisions:{},deleted_at:null,...encodeSyncV2Patch(store,rec)}));
  return out;
}
async function stateOf(page){return page.locator('[data-profile-form]').evaluateAll(nodes=>nodes.map(n=>{const s=getComputedStyle(n);return {value:n.dataset.profileForm,pressed:n.getAttribute('aria-pressed'),class:n.className,bg:s.backgroundColor,color:s.color,shadow:s.boxShadow};}));}
async function localProfile(page){return page.evaluate(async()=>{
  const store=await import('/src/store.js');
  const workspace=store.getActiveWorkspace();
  const persisted=await new Promise((resolve,reject)=>{const q=indexedDB.open(workspace.databaseName);q.onerror=()=>reject(q.error);q.onsuccess=()=>{const db=q.result;const get=db.transaction('profile','readonly').objectStore('profile').get('profile');get.onsuccess=()=>{db.close();resolve(get.result);};get.onerror=()=>{db.close();reject(get.error);};};});
  return {memory:store.state.profile.teacherForm,persisted:persisted.teacherForm,databaseName:workspace.databaseName};
});}
for(const engine of ['chromium','webkit'])for(const scenario of scenarios){
const config={...scenario,engine};
test(engine+' '+config.width+' '+config.initial+' '+config.input,async({},testInfo)=>{
  const browser=await (engine==='chromium'?chromium:webkit).launch();
  try {
  const ctx=await browser.newContext({viewport:{width:config.width,height:900},hasTouch:config.width===390,colorScheme:config.theme,serviceWorkers:'block'});
  const page=await ctx.newPage();
  const errors=[],consoleErrors=[],calls=[],unexpected=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
  await ctx.routeWebSocket('**/*',ws=>ws.close());
  let profile={teacherName:'',phone:'',schoolName:'',teacherForm:config.initial};
  let state='PROFILE_REQUIRED',status='PENDING_PROFILE',saved=null,provisionCalls=0;
  await ctx.route('**/*',async route=>{
    const req=route.request(),url=new URL(req.url());
    if(url.origin===host)return route.continue();
    calls.push({method:req.method(),path:url.pathname});
    if(url.pathname.startsWith('/auth/v1/'))return route.fulfill({json:SESSION.user});
    if(!url.pathname.startsWith('/rest/v1/')){unexpected.push(url.origin+url.pathname);return route.abort();}
    const rpc=url.pathname.split('/').at(-1);
    if(rpc==='account_contract'||rpc==='provision_account_profile')return route.fulfill({json:contract(profile,state,status)});
    if(rpc==='complete_account_profile'){
      saved=req.postDataJSON();
      profile={teacherName:saved.p_teacher_name,phone:saved.p_phone,schoolName:saved.p_school_name||'',teacherForm:saved.p_teacher_form};
      status='READY';state='PROVISIONING_REQUIRED';
      return route.fulfill({json:contract(profile,state,status)});
    }
    if(rpc==='begin_account_provisioning'){state='PROVISIONING';return route.fulfill({json:contract(profile,state,status)});}
    if(rpc==='provision_account_workspace'){state='READY';provisionCalls++;return route.fulfill({json:{contract:contract(profile,state,status),snapshot:canonical(profile)}});}
    if(req.method()==='GET')return route.fulfill({json:canonical(profile)[rpc]||[]});
    return route.fulfill({json:[]});
  });
  await page.goto(host+'/__audit_fixture__');
  await page.evaluate(({key,session})=>localStorage.setItem(key,JSON.stringify(session)),{key:AUTH_STORAGE_KEY,session:SESSION});
  await page.goto(host+'/');
  await expect(page.locator('[data-account-profile-form]')).toBeVisible();
  // Onboarding has no hydrated device settings yet. Select the existing CSS
  // theme on this disposable DOM fixture without changing account/device data.
  await page.evaluate(theme=>document.documentElement.setAttribute('data-theme',theme),config.theme);
  await expect(page.locator('html')).toHaveAttribute('data-theme',config.theme);
  assert.equal(await page.locator('html').getAttribute('dir'),'rtl');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  const before=await stateOf(page),switches=[];
  await assertSelected(page,config.initial);
  if(config.input!=='untouched'){
    for(const value of ['masculine','feminine','masculine','feminine',config.final]){
      const control=page.locator(`[data-profile-form="${value}"]`);
      if(config.input==='keyboard'){await control.focus();await control.press('Enter');}
      else if(config.input==='touch')await control.tap();else await control.click();
      await expect(control).toHaveAttribute('aria-pressed','true');
      const snapshot=await stateOf(page);await assertSelected(page,value);switches.push(snapshot);
    }
  }
  await page.locator('[name=teacherName]').fill('معلمة اختبار اصطناعي');
  await page.locator('[name=phone]').fill('0500000001');
  const afterSelection=await stateOf(page);
  await page.screenshot({path:testInfo.outputPath('onboarding.png'),fullPage:true});
  await page.getByRole('button',{name:'متابعة',exact:true}).click();
  await expect(page.locator('#main')).toBeVisible();
  await expect.poll(()=>page.evaluate(async()=>{const sync=await import('/src/lib/sync.js');return sync.displayState().status;}),{timeout:15000}).toBe('synced');
  assert.equal(saved.p_teacher_form,config.final);assert.equal(provisionCalls,1);
  const immediate=await localProfile(page);assert.equal(immediate.memory,config.final);assert.equal(immediate.persisted,config.final);
  await page.reload();await expect(page.locator('#main')).toBeVisible();
  const reloaded=await localProfile(page);assert.equal(reloaded.persisted,config.final);
  await page.goto(host+'/#/settings');await expect(page.locator('[data-act="teacher-form"]').first()).toBeVisible();
  const edit=await page.locator('[data-act="teacher-form"]').evaluateAll(nodes=>nodes.map(n=>({value:n.dataset.val,pressed:n.getAttribute('aria-pressed'),class:n.className})));
  assert(edit.find(n=>n.value===config.final).class.split(' ').includes('is-on'));
  await page.screenshot({path:testInfo.outputPath('settings.png'),fullPage:true});
  await page.evaluate(async()=>{const cloud=await import('/src/lib/cloud.js');await cloud.signOut();});
  await page.goto(host+'/');await expect(page.locator('[data-workspace-login]')).toBeVisible();
  await page.evaluate(({key,session})=>localStorage.setItem(key,JSON.stringify(session)),{key:AUTH_STORAGE_KEY,session:SESSION});
  await page.reload();await expect(page.locator('#main')).toBeVisible();
  const restored=await localProfile(page);assert.equal(restored.memory,config.final);assert.equal(restored.persisted,config.final);
  assert.deepEqual(errors,[]);assert.deepEqual(consoleErrors,[]);assert.deepEqual(unexpected,[]);
  await testInfo.attach('synthetic-evidence',{body:JSON.stringify({config,before,switches,afterSelection,savedTeacherForm:saved.p_teacher_form,immediate,reloaded,restored,edit,provisionCalls,interceptedRequests:calls.length,actualExternalRequests:0},null,2),contentType:'application/json'});
  await ctx.close();
  } finally {await browser.close();}
});
}

async function assertSelected(page,value){
  const nodes=await stateOf(page);
  assert.equal(nodes.length,2);
  assert.equal(nodes.filter(n=>n.class.split(' ').includes('is-on')).length,1);
  assert.equal(nodes.filter(n=>n.pressed==='true').length,1);
  const selected=nodes.find(n=>n.value===value),other=nodes.find(n=>n.value!==value);
  assert(selected.class.split(' ').includes('is-on'));
  assert.equal(selected.pressed,'true');assert.equal(other.pressed,'false');
  assert.notEqual(selected.bg,other.bg,'selected state must be visibly distinct');
  assert.notEqual(selected.color,other.color,'existing selected text treatment is applied');
}
