import {test,expect} from '@playwright/test';
import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {AUTH_STORAGE_KEY,SUPABASE_URL} from '../src/lib/cloud.js';

test.use({serviceWorkers:'block'});
const ROOT=path.resolve('.');
const OWNER='33333333-3333-4333-8333-333333333333';
const SESSION={access_token:'synthetic-0330',refresh_token:'synthetic-refresh-0330',expires_at:4102444800,user:{id:OWNER,email:'teacher@example.test'}};
let host,server;
test.beforeAll(async()=>{
  host=process.env.RAKEEZX_MICROBATCH_BASE_URL;
  if(host)return;
  const mime={'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png'};
  server=createServer(async(req,res)=>{
    const pathname=new URL(req.url,'http://localhost').pathname;
    const file=path.resolve(ROOT,pathname==='/'?'index.html':decodeURIComponent(pathname).slice(1));
    if(!file.startsWith(ROOT+path.sep))return res.writeHead(403).end();
    try {if(!(await stat(file)).isFile())throw Error();res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});res.end(await readFile(file));}
    catch{res.writeHead(404).end();}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  host=`http://127.0.0.1:${server.address().port}`;
});
test.afterAll(async()=>{if(server)await new Promise(resolve=>server.close(resolve));});
function watch(page){const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});return errors;}
async function integrity(page,errors){await expect(page.locator('html')).toHaveAttribute('dir','rtl');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);expect(errors).toEqual([]);}
async function profile(page){
  const pending={ownerId:OWNER,profileStatus:'PENDING_PROFILE',profile:{teacherName:'',phone:'',teacherForm:'masculine',schoolName:''},access:{grantType:'beta_full',status:'active',source:'public_beta'},provisioning:{state:'PROFILE_REQUIRED',version:1,foundationHash:null}};
  const calls=[];
  await page.context().route(`${SUPABASE_URL}/**`,route=>{
    const url=new URL(route.request().url());calls.push(url.pathname);
    return route.fulfill({json:url.pathname.startsWith('/auth/')?SESSION.user:url.pathname.endsWith('/account_contract')||url.pathname.endsWith('/provision_account_profile')?pending:[]});
  });
  await page.addInitScript(({key,session})=>localStorage.setItem(key,JSON.stringify(session)),{key:AUTH_STORAGE_KEY,session:SESSION});
  await page.goto(host+'/');
  await expect(page.locator('[data-account-profile-form]')).toBeVisible();
  return calls;
}
async function simulate(page,height){
  await page.evaluate(height=>{
    Object.defineProperties(visualViewport,{height:{configurable:true,value:height},offsetTop:{configurable:true,value:0}});
    visualViewport.dispatchEvent(new Event('resize'));
  },height);
  await expect.poll(()=>page.evaluate(()=>document.documentElement.style.getPropertyValue('--visible-viewport-height'))).toBe(`${height}px`);
}
async function visibleField(page,selector,height){
  await expect.poll(()=>page.locator(selector).evaluate((n,height)=>{const r=n.getBoundingClientRect();return r.top>=0&&r.bottom<=height;},height)).toBe(true);
}

test('N29 exact hierarchy, unified OTP request and isolated Demo entry',async({page},info)=>{
  const errors=watch(page),requests=[];
  // Bounded synthetic roster for this entry/UI test. Keep the real Demo seeding,
  // isolation and handlers; the full default roster is outside this batch's gate.
  await page.context().route('**/src/lib/demo-workspace.js',async route=>{
    const response=await route.fetch();
    const source=await response.text();
    const plan=source.match(/const CLASS_PLAN = Object.freeze\(\[([\s\S]*?)\]\);/);
    expect(plan).not.toBeNull();
    expect(plan[1].match(/students: \d+/g)).toHaveLength(8);
    await route.fulfill({response,body:source.replace(plan[0],'const CLASS_PLAN = Object.freeze([{grade:4,label:1,students:1,slots:[[0,1],[2,3]]}]);')});
  });
  await page.context().route(`${SUPABASE_URL}/**`,route=>{requests.push({path:new URL(route.request().url()).pathname,body:route.request().postDataJSON()});return route.fulfill({status:204});});
  await page.goto(host+'/');
  const primary=page.locator('[data-workspace-login]'),demo=page.locator('[data-workspace-demo]');
  for(const theme of ['light','dark'])for(const width of [1440,768,390,320]){
    await page.setViewportSize({width,height:844});
    await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
    await expect(primary.locator('.welcome-option__title')).toHaveText('ابدأ مع ركيز المعلم');
    await expect(primary.locator('.welcome-option__detail')).toHaveText('إنشاء حساب أو تسجيل الدخول');
    await expect(demo.locator('.welcome-option__title')).toHaveText('جرّب ركيز المعلم');
    await expect(demo.locator('.welcome-option__detail')).toHaveText('استكشف وجرّب بدون حساب');
    await expect(primary.locator('.welcome-option__title')).toHaveCSS('font-size','20px');
    await expect(primary.locator('.welcome-option__title')).toHaveCSS('font-weight','800');
    await expect(demo.locator('.welcome-option__title')).toHaveCSS('font-size','17px');
    await expect(primary.locator('.welcome-option__detail')).toHaveCSS('font-weight','400');
    await integrity(page,errors);
    await page.screenshot({path:info.outputPath(`welcome-${width}-${theme}.png`),fullPage:true});
  }
  await primary.click();
  await expect(page.locator('.first-run-auth')).toBeVisible();
  await expect(page.locator('input[name=password]')).toHaveCount(0);
  await page.locator('input[name=email]').fill('TEACHER@example.test');
  await page.getByRole('button',{name:'إرسال رمز التحقق',exact:true}).click();
  await expect(page.locator('[data-email-otp-code-step]')).toBeVisible();
  expect(requests).toEqual([{path:'/auth/v1/otp',body:{email:'teacher@example.test',create_user:true}}]);
  await page.locator('[data-sheet-close]').first().click();
  const before=requests.length;
  await demo.click();
  await expect(page.locator('[data-demo-indicator]:visible')).toBeVisible();
  await page.reload();
  await expect(page.locator('[data-demo-indicator]:visible')).toBeVisible();
  expect(requests.length).toBe(before);
  expect(await page.evaluate(async()=> (await (await import('/src/lib/db.js')).getAll('outbox')).length)).toBe(0);
  await integrity(page,errors);
});

test('N21 actual required profile gate, fields and validation/error presentation',async({page},info)=>{
  const errors=watch(page),calls=await profile(page);
  for(const theme of ['light','dark'])for(const width of [1440,768,390,320]){
    await page.setViewportSize({width,height:844});
    await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
    await expect(page.getByRole('heading',{name:'أكمل بيانات حسابك'})).toBeVisible();
    await expect(page.locator('.profile-completion')).toBeVisible();
    await expect(page.locator('input[name=teacherName]')).toHaveAttribute('required','');
    await expect(page.locator('input[name=phone]')).toHaveAttribute('pattern','05[0-9]{8}');
    await expect(page.locator('input[name=phone]')).toHaveAttribute('maxlength','10');
    await expect(page.locator('input[name=schoolName]')).not.toHaveAttribute('required','');
    expect(await page.locator('.field__label small').allTextContents()).toEqual(['مطلوب','مطلوب','اختياري']);
    await integrity(page,errors);
    await page.screenshot({path:info.outputPath(`profile-${width}-${theme}.png`),fullPage:true});
  }
  await page.getByRole('button',{name:'متابعة',exact:true}).click();
  await expect(page.locator('input:invalid')).toHaveCount(2);
  await expect(page.locator('[data-profile-error]')).toBeHidden();
  await page.locator('[name=teacherName]').fill(' ');
  await page.locator('[name=phone]').fill('٠٥٠٠٠٠٠٠٠١');
  await expect(page.locator('[name=phone]')).toHaveValue('0500000001');
  await page.locator('[data-profile-form=feminine]').click();
  await expect(page.locator('[data-profile-form=feminine]')).toHaveAttribute('aria-pressed','true');
  await page.getByRole('button',{name:'متابعة',exact:true}).click();
  await expect(page.locator('[data-profile-error]')).toHaveText('تعذر حفظ البيانات الآن. تحقق من الاتصال وأعد المحاولة.');
  expect(calls.some(p=>p.endsWith('/complete_account_profile'))).toBe(false);
  await expect(page.getByRole('button',{name:'متابعة',exact:true})).toBeEnabled();
  await page.screenshot({path:info.outputPath('profile-validation.png'),fullPage:true});
  await integrity(page,errors);
});

for(const width of [390,320])for(const scene of ['profile','sheet'])test(`N20 ${scene} ${width}: visible keyboard, scrolling and repeated restoration`,async({page},info)=>{
  const errors=watch(page);
  await page.setViewportSize({width,height:844});
  let selector;
  if(scene==='profile'){await profile(page);selector='[name=phone]';}
  else {
    await page.context().route(`${SUPABASE_URL}/**`,r=>r.fulfill({status:204}));
    await page.goto(host+'/');
    await page.evaluate(async()=>{
      const {openSheet,html}=await import('/src/lib/dom.js');
      window.openSyntheticSheet=()=>openSheet({title:'نموذج اصطناعي',body:html`<form id="synthetic-form"><label class="field">العنوان<input class="input" name="title"></label><label class="field">ملاحظة<textarea class="input" rows="6"></textarea></label><label class="field">تفاصيل<input class="input" name="details"></label></form>`,foot:html`<button type="submit" class="btn btn--primary" form="synthetic-form">حفظ</button>`,onMount:(root,done)=>root.querySelector('form').addEventListener('submit',e=>{e.preventDefault();done(true);})});
      window.openSyntheticSheet();
    });selector='[name=details]';
  }
  for(let cycle=0;cycle<3;cycle++){
    if(scene==='sheet'&&cycle>0)await page.evaluate(()=>{void window.openSyntheticSheet();});
    await page.locator(selector).focus();
    await simulate(page,390);
    await visibleField(page,selector,390);
    const action=page.locator(scene==='profile'?'[data-account-profile-form] [type=submit]':'.sheet__foot [type=submit]');
    await action.scrollIntoViewIfNeeded();
    await visibleField(page,scene==='profile'?'[data-account-profile-form] [type=submit]':'.sheet__foot [type=submit]',390);
    if(cycle===0)await page.screenshot({path:info.outputPath(`keyboard-${scene}-${width}.png`),clip:{x:0,y:0,width,height:390}});
    if(scene==='sheet')await action.click();
    else {await action.click();await page.locator(selector).focus();await visibleField(page,selector,390);}
    await simulate(page,844);
    expect(await page.evaluate(()=>document.body.classList.contains('has-modal'))).toBe(false);
  }
  await page.setViewportSize({width,height:360});
  if(scene==='sheet')await page.evaluate(()=>{void window.openSyntheticSheet();});
  // Remove simulation overrides: now exercise real browser-window resize events.
  await page.evaluate(()=>{delete visualViewport.height;delete visualViewport.offsetTop;window.dispatchEvent(new Event('resize'));});
  await page.locator(selector).focus();
  await visibleField(page,selector,360);
  if(scene==='sheet')await page.locator('[data-sheet-close]').first().click();
  await page.setViewportSize({width,height:844});
  await expect.poll(()=>page.evaluate(()=>Number.parseFloat(document.documentElement.style.getPropertyValue('--visible-viewport-height')))).toBe(844);
  expect(await page.evaluate(()=>document.body.classList.contains('has-modal'))).toBe(false);
  expect(await page.evaluate(()=>getComputedStyle(document.body).overflowY)).not.toBe('hidden');
  await integrity(page,errors);
});
