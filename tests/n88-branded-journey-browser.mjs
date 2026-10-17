import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {resolve,extname,sep} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import AxeBuilder from '@axe-core/playwright';
import {withIsolatedLocalBrowser} from 'file:///C:/Users/Abody/Projects/RakeezX/scripts/ops-supervisor-v4/isolated-local-browser.mjs';
const taskId='continuous-n88-branded-teacher-student-journey-20261017',runId='bbb04581-90eb-4340-a8d7-e7c9ccc9abbe';
const baseSha='aa6a1843c5102add77d61d1a3777c7916e376bb7',root=resolve('.');
const source=await readFile('src/views/n88-public-guest.js');
const before=execFileSync('git',['show',baseSha+':src/views/n88-public-guest.js']);
let baseline=false;
// Existing actual-source static HTTP pattern; baseline serves the immutable real previous module.
const server=createServer(async(req,res)=>{try{
 const pathname=new URL(req.url,'http://localhost').pathname;
 const file=resolve(root,pathname==='/'?'index.html':'.'+decodeURIComponent(pathname));
 if(!file.startsWith(root+sep))throw Error('outside root');
 res.setHeader('Content-Type',{'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.json':'application/json','.webmanifest':'application/manifest+json'}[extname(file)]??'application/octet-stream');
 res.setHeader('Cache-Control','no-store');res.end(baseline&&pathname==='/src/views/n88-public-guest.js'?before:await readFile(file));
}catch{res.writeHead(404).end();}});
const results=[],visuals=[];
try {
 await new Promise((done,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',done);});
 const origin='http://127.0.0.1:'+server.address().port;
 await withIsolatedLocalBrowser({taskFile:'C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/'+taskId+'.json',runId,url:origin,timeoutMs:120000},async({createContext})=>{
 for(const width of [390,1280])for(const theme of ['light','dark']){
  const ctx=await createContext({viewport:{width,height:1000},locale:'ar-SA'}),page=await ctx.newPage();
  const shots={};
  baseline=true;await page.goto(origin+'/#/n88-invite-lab');await page.locator('[data-n88-public]').waitFor();
  await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
  shots.before=resolve(tmpdir(),`n88-branded-${runId}-${width}-${theme}-before.png`);await page.screenshot({path:shots.before,fullPage:true});
  baseline=false;
  const requests=[],errors=[];
  page.on('request',r=>requests.push(r.url()));page.on('pageerror',e=>errors.push(e.message));
  await ctx.addInitScript(()=>{
   window.__privateCalls=[];
   for(const key of ['open','databases']){const f=indexedDB[key].bind(indexedDB);indexedDB[key]=(...a)=>{window.__privateCalls.push('idb:'+key);return f(...a);};}
   for(const key of ['getItem','setItem','removeItem','clear']){const f=Storage.prototype[key];Storage.prototype[key]=function(...a){window.__privateCalls.push('storage:'+key+':'+(a[0]??''));return f.apply(this,a);};}
   const open=XMLHttpRequest.prototype.open;XMLHttpRequest.prototype.open=function(method,url,...a){this.__testURL=url;return open.call(this,method,url,...a);};const send=XMLHttpRequest.prototype.send;XMLHttpRequest.prototype.send=function(...a){window.__privateCalls.push('xhr:send:'+this.__testURL);return send.apply(this,a);};
   for(const key of ['fetch','WebSocket']){const f=window[key];window[key]=function(...a){window.__privateCalls.push(key);return key==='fetch'?f(...a):new f(...a);};}
  });
  await page.reload();await page.locator('[data-teacher]').waitFor();
  await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
  assert.equal(await page.locator('[aria-current=step]').getAttribute('data-teacher-step'),'');
  const style=await page.locator('.n88-guest').evaluate(e=>({font:getComputedStyle(e).fontFamily,token:getComputedStyle(e).getPropertyValue('--font').trim(),bg:getComputedStyle(e).backgroundColor,dir:getComputedStyle(e).direction}));
  assert.equal(style.dir,'rtl');assert.match(style.font,/Thmanyah Sans/);
  const logo=page.locator('.brand-lockup img:visible');assert.equal(await logo.count(),1);assert.ok(await logo.evaluate(e=>e.complete&&e.naturalWidth>0));assert.match(await logo.getAttribute('src'),new RegExp('header-'+theme+'-standard'));
  assert.equal(await page.locator('.n88-notice').count(),1);
  assert.deepEqual(await page.evaluate(()=>window.__privateCalls),['storage:getItem:rakeezx-theme']);
  const axeTeacher=await new AxeBuilder({page}).include('[data-n88-public]').analyze();assert.deepEqual(axeTeacher.violations,[]);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  shots.teacher=resolve(tmpdir(),`n88-branded-${runId}-${width}-${theme}-teacher.png`);await page.screenshot({path:shots.teacher,fullPage:true});
  await page.locator('[data-open]').focus();await page.keyboard.press('Enter');await page.locator('[data-student]').waitFor();
  assert.equal(await page.locator('[data-teacher]').count(),0);
  assert.equal(await page.locator('[aria-current=step]').getAttribute('data-student-step'),'');
  assert.equal(await page.locator('[data-student] h2').first().evaluate(e=>e===document.activeElement),true);
  assert.equal(await page.locator('.n88-activities li').count(),3);
  assert.deepEqual(await page.locator('.n88-state').allTextContents(),['مكتمل','قيد العمل','لم يبدأ']);
  assert.equal(await page.locator('progress').getAttribute('value'),'1');assert.equal(await page.locator('progress').getAttribute('max'),'3');
  assert.ok(await page.getByText('✓ فُتح مثال الدعوة بنجاح',{exact:true}).isVisible());
  assert.deepEqual(await page.evaluate(()=>window.__privateCalls),['storage:getItem:rakeezx-theme','xhr:send:/src/vendor/flatpickr/flatpickr.min.css']);
  const axeStudent=await new AxeBuilder({page}).include('[data-n88-public]').analyze();assert.deepEqual(axeStudent.violations,[]);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  shots.student=resolve(tmpdir(),`n88-branded-${runId}-${width}-${theme}-student.png`);await page.screenshot({path:shots.student,fullPage:true});
  await page.locator('[data-reset]').focus();await page.keyboard.press('Enter');
  assert.equal(await page.locator('[data-open]').evaluate(e=>e===document.activeElement),true);
  await page.keyboard.press('Tab');assert.equal(await page.locator('summary').evaluate(e=>e===document.activeElement),true);await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');assert.equal(await page.locator('input').evaluate(e=>e===document.activeElement),true);
  await page.locator('input').fill('INVALID');await page.keyboard.press('Enter');assert.equal(await page.locator('input').getAttribute('aria-invalid'),'true');assert.ok(await page.locator('[data-error]').isVisible());
  await page.locator('input').fill(' demo-only ');await page.keyboard.press('Enter');await page.locator('[data-student]').waitFor();
  await page.locator('[data-reset]').click();assert.equal(await page.locator('input').inputValue(),'');assert.equal(await page.locator('details').getAttribute('open'),null);
  assert.deepEqual(await page.evaluate(()=>window.__privateCalls),['storage:getItem:rakeezx-theme','xhr:send:/src/vendor/flatpickr/flatpickr.min.css','xhr:send:/src/vendor/flatpickr/flatpickr.min.css']); // two axe scans read the same imported stylesheet; no application service call
  assert.equal(requests.some(u=>new URL(u).origin!==origin||/app-update|\/app.js|\/store.js|\/lib\/(cloud|db|workspaces)/.test(u)),false);assert.deepEqual(errors,[]);
  visuals.push({width,theme,style,screenshots:shots,axeViolations:0,overflow:false,keyboard:true,manual:true,reset:true,requests:[...new Set(requests.map(u=>new URL(u).pathname))]});await ctx.close();
 }
 });
 results.push({name:'n88_teacher_invitation_to_student_preview_is_clear_and_interactive',status:'PASS',evidence:'Four actual-app contexts: invitation opens student activities, statuses, 1/3 progress and success; reset restores teacher.'});
 results.push({name:'n88_actual_Rakeez_brand_RTL_mobile_desktop_visuals',status:'PASS',evidence:'390/1280 light/dark before/teacher/student screenshots; shipped theme logos, --font and tokens; zero axe violations and no overflow.'});
 results.push({name:'n88_compact_synthetic_notice_manual_reset_keyboard_and_isolation',status:'PASS',evidence:'Enter/Tab primary/manual/error/reset, correct focus, single notice; App only reads unchanged head theme; two axe scans read existing flatpickr CSS; no service/account/data calls.'});
 await writeFile('tests/n88-branded-journey-browser.json',JSON.stringify({taskId,runId,baseSha,sourceSha256:createHash('sha256').update(source).digest('hex'),scope:'Actual application source over owned loopback; isolated helper; server/browser finally cleanup; synthetic only',results,visuals},null,2)+'\n');
 console.log(JSON.stringify(results,null,2));
}finally{await new Promise(done=>server.close(done));}




