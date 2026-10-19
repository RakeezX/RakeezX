// AI: scoped real application OTP regression, isolated loopback transport only.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {execFileSync} from 'node:child_process';
import {withIsolatedLocalBrowser} from 'file:///C:/Users/Abody/Projects/RakeezX/scripts/ops-supervisor-v4/isolated-local-browser.mjs';
const taskId='continuous-n115-email-code-autofill-20261019',runId='0c73cf2b-ab73-454a-a837-e8b9636d203d';
const baseline=process.argv.includes('--baseline'),root=resolve('.'),calls=[];
const evidence={taskId,runId,baseline,checks:[],errors:[]};
const server=createServer(async(req,res)=>{try{
 const pathname=new URL(req.url,'http://localhost').pathname;
 if(pathname.startsWith('/__auth/')){
  res.setHeader('Content-Type','application/json');
  let body='';for await(const chunk of req)body+=chunk;
  calls.push({path:pathname,body:body?JSON.parse(body):null});
  if(pathname.endsWith('/otp'))return res.writeHead(204).end();
  if(pathname.endsWith('/verify'))return res.writeHead(400).end(JSON.stringify({code:'otp_invalid',message:'Invalid synthetic OTP'}));
  return res.writeHead(404).end('{}');
 }
 const file=resolve(root,pathname==='/'?'index.html':'.'+decodeURIComponent(pathname));
 if(!file.startsWith(root+sep))throw Error('Outside app root');
 let body=await readFile(file);
 if(baseline&&pathname==='/src/app.js')body=execFileSync('git',['show','330a1920bae03bb189834a31615d6874d76c1860:src/app.js']);
 // Reuse N112's loopback transport fixture; keep real Auth/controller/store guards.
 if(pathname==='/src/lib/cloud.js')body=body.toString().replace("export const SUPABASE_URL = 'https://xlrubcwjqktzzunrvuns.supabase.co';","export const SUPABASE_URL = location.origin + '/__auth';");
 res.setHeader('Content-Type',{'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2','.png':'image/png','.webmanifest':'application/manifest+json'}[extname(file)]??'application/octet-stream');
 res.setHeader('Cache-Control','no-store');res.end(body);
}catch{res.writeHead(404).end();}});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const url='http://127.0.0.1:'+server.address().port;
const record=(name,detail)=>evidence.checks.push({name,status:'PASS',evidence:detail});
try{
 await withIsolatedLocalBrowser({taskFile:'C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/'+taskId+'.json',runId,url},async({createContext})=>{
  const context=await createContext({viewport:{width:390,height:844},locale:'ar-SA'}),page=await context.newPage();
  page.setDefaultTimeout(10000);page.on('pageerror',e=>evidence.errors.push(e.message));
  await page.goto(url);await page.locator('[data-workspace-login]').click();
  const form=page.locator('#first-run-inline-form'),token=form.locator('input[name=token]');
  await form.locator('input[name=email]').fill('n115@example.test');
  await form.locator('button[type=submit]').click();await token.waitFor({state:'visible'});
  assert.equal(await token.getAttribute('autocomplete'),'one-time-code');
  assert.equal(await token.getAttribute('inputmode'),'numeric');
  assert.equal(await token.evaluate(e=>e.type),'text');
  assert.equal(await token.getAttribute('pattern'),'[0-9]{6}');
  assert.equal(await token.getAttribute('maxlength'),'6');
  assert.notEqual(await token.evaluate(e=>getComputedStyle(e).borderStyle),'none');
  const paste=async(text)=>token.evaluate((e,text)=>{
   const clipboardData=new DataTransfer();clipboardData.setData('text',text);
   // Synthetic paste has no native default: model the browser's maxlength insertion
   // only when the actual application handler did not cancel the event.
   if(e.dispatchEvent(new ClipboardEvent('paste',{clipboardData,bubbles:true,cancelable:true}))){
    const start=e.selectionStart,end=e.selectionEnd;
    const available=e.maxLength-(e.value.length-(end-start));
    e.setRangeText(text.slice(0,Math.max(0,available)),start,end,'end');
    e.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertFromPaste',data:text}));
   }
  },text);
  await token.fill('');await paste('٠١٢ ٣٤٥');
  if(baseline){
   assert.equal(await token.inputValue(),'01234');
   record('baseline_formatted_paste_truncation','Actual app lost sixth digit when maxlength truncated formatted clipboard text before input normalization.');return;
  }
  assert.equal(await token.inputValue(),'012345');
  await token.fill('');await token.pressSequentially('001234');assert.equal(await token.inputValue(),'001234');
  await token.evaluate(e=>e.setSelectionRange(2,4));await paste('٩٨');assert.equal(await token.inputValue(),'009834');
  await token.selectText();await paste('۰۱۲\n۳۴۵');assert.equal(await token.inputValue(),'012345');
  // Exercise browser-delivered input/change events; this does not emulate an OS mailbox.
  await token.evaluate(e=>{e.value='٠١٢٣٤٥';e.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertReplacementText'}));});
  assert.equal(await token.inputValue(),'012345');
  await token.evaluate(e=>{e.value='۰۰۱۲۳۴';e.dispatchEvent(new Event('change',{bubbles:true}));});
  assert.equal(await token.inputValue(),'001234');
  assert.equal(calls.length,1,'Typing/paste/autofill must not auto-submit');
  await token.fill('12345');await token.press('Enter');
  await page.waitForFunction(()=>document.querySelector('[data-email-otp-feedback]').textContent.includes('6 أرقام'));
  assert.equal(calls.length,1,'Incomplete code must not reach Auth');
  await token.selectText();await paste('٠١٢ ٣٤٥');await token.press('Enter');
  await page.waitForFunction(()=>document.querySelector('[data-email-otp-feedback]').textContent.includes('غير صحيح'));
  assert.equal(calls.length,2);assert.equal(calls[1].body.token,'012345');assert.equal(calls[1].body.email,'n115@example.test');
  assert.equal(await token.getAttribute('aria-invalid'),'true');assert.equal(await form.locator('button[type=submit]').isDisabled(),false);
  assert.equal(await page.evaluate(async()=>{const c=await import('/src/lib/cloud.js');return c.user;}),null);
  await mkdir('tests/fixtures/n115-1019',{recursive:true});
  await page.screenshot({path:'tests/fixtures/n115-1019/email-code.png'});
  assert.deepEqual(evidence.errors,[]);
  record('n115_email_otp_autocomplete_paste_and_supported_browser_contract','Actual app + source CSS on fresh isolated Chromium: one-time-code/numeric/text/pattern/maxlength preserved; formatted Arabic/Persian paste and selection replacement, leading zeros, typing, input/change autofill events; no auto-submit; incomplete code blocked; rejected synthetic verification preserves error and signed-out state. OS/email suggestion availability is not certified.');
 });
}catch(error){evidence.failure=error.stack;throw error;}
finally{
 server.closeAllConnections();await new Promise(done=>server.close(done));
 await writeFile('tests/n115-1019-'+(baseline?'baseline':'browser')+'.json',JSON.stringify(evidence,null,2)+'\n');
}
console.log(JSON.stringify(evidence,null,2));
