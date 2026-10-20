// AI: affected OTP-return entry only. Reuses the unchanged OTP transport
// fixture pattern in email-otp-signup-gate.e2e.mjs. Native provisioning proofs
// are retained in qualification.json; no native suite or hosted pair repeated.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import {chromium} from '@playwright/test';
import {AUTH_STORAGE_KEY,SUPABASE_URL} from '../../src/lib/cloud.js';
const root=process.cwd(),mime={'.js':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
const server=http.createServer(async(req,res)=>{const f=path.resolve(root,'.'+new URL(req.url,'http://127.0.0.1').pathname);const target=f===root?path.join(root,'index.html'):f;if(!target.startsWith(root+path.sep))return res.writeHead(403).end();try{const content=await fs.readFile(target);res.writeHead(200,{'Content-Type':mime[path.extname(target)]||'application/octet-stream'});res.end(content);}catch{if(!res.headersSent)res.writeHead(404);res.end();}});
const checks=[];let browser,failure;
try{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({headless:true});
  for(const existing of [false,true]){
    const owner=existing?'77777777-7777-4777-8777-777777777777':'88888888-8888-4888-8888-888888888888';
    const session={access_token:'n117-local-otp',refresh_token:'n117-local-refresh',expires_at:4102444800,user:{id:owner,email:existing?'existing@example.invalid':'new@example.invalid'}};
    const context=await browser.newContext({serviceWorkers:'block'}),page=await context.newPage();let profileCalls=0,otpCalls=0,verifyCalls=0;
    const account=()=>({ownerId:owner,profileStatus:existing?'READY':'PENDING_PROFILE',profile:existing?{teacherName:'Existing',phone:'0500000001',educationDepartment:null}:{},access:{grantType:'beta_full',status:'active'},provisioning:existing?null:profileCalls?{state:'PROFILE_REQUIRED',version:1}:null});
    await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
    await context.route(SUPABASE_URL+'/auth/v1/**',r=>{const name=new URL(r.request().url()).pathname.split('/').at(-1);if(name==='otp'){assert.equal(r.request().postDataJSON().create_user,true);otpCalls++;return r.fulfill({status:204});}if(name==='verify'){verifyCalls++;return r.fulfill({json:session});}return r.fulfill({json:session.user});});
    await context.route(SUPABASE_URL+'/rest/v1/**',r=>{const name=new URL(r.request().url()).pathname.split('/').at(-1);if(name==='provision_account_profile')profileCalls++;return r.fulfill({json:['account_contract','provision_account_profile'].includes(name)?account():[]});});
    await page.goto(origin);await page.locator('[data-workspace-login]').first().click();
    const email=page.locator('input[name=email]:visible');await email.fill(session.user.email);
    await page.locator('button[type=submit]:visible').click();await page.locator('input[name=token]:visible').fill('123456');await page.locator('button[type=submit]:visible').click();
    await page.waitForFunction(({key,owner})=>JSON.parse(localStorage.getItem(key))?.user?.id===owner,{key:AUTH_STORAGE_KEY,owner});
    if(!existing){await page.locator('[data-account-profile-required]').waitFor();assert.equal(await page.locator('[name=educationDepartment]').inputValue(),'');assert.equal(await page.locator('[name=educationDepartment] option').count(),48);assert.equal(profileCalls,1);}
    else {await page.locator('[data-workspace-login]').waitFor({state:'detached'});await page.waitForFunction(()=>!document.querySelector('[data-account-profile-form]'));assert.equal(profileCalls,0);}
    assert.equal(otpCalls,1);assert.equal(verifyCalls,1);
    checks.push({name:existing?'existing_otp_not_signup':'new_otp_required_department_entry',status:'PASS',evidence:existing?'Actual OTP return retains existing UUID; READY profile is not provisioned as signup and no initial department form.':'Actual OTP request/verify/session persistence/reload/owner-profile provisioning reaches required canonical 47-option department form.'});
    await context.close();
  }
}catch(error){failure={message:error.message,stack:error.stack};process.exitCode=1;console.error(error);}
finally{await browser?.close();await new Promise(r=>server.close(r));await fs.writeFile('tests/n117-20261020/otp-entry.json',JSON.stringify({checks,failure,scope:'Actual local app DOM and synthetic Auth transport only; no hosted users/messages',ownedResourcesClosed:true},null,2)+'\n');}
console.log(JSON.stringify(checks));
