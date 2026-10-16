import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {writeFile} from 'node:fs/promises';
import {withIsolatedLocalBrowser} from 'file:///C:/Users/Abody/Projects/RakeezX/scripts/ops-supervisor-v4/isolated-local-browser.mjs';

const html=await readFile(new URL('../public/n88-invite-preview.html',import.meta.url));
const requests=[];
const server=createServer((req,res)=>{requests.push(req.url);if(req.url==='/n88-invite-preview.html'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; connect-src 'none'; object-src 'none'"});res.end(html)}else{res.writeHead(404);res.end('not found')}});
const checks=[];
try{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const url=`http://127.0.0.1:${server.address().port}/n88-invite-preview.html`;
 await withIsolatedLocalBrowser({taskFile:'C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/continuous-n88-public-preview-reachability-20261016.json',runId:'7a841bca-7fba-48ac-9f38-0ca158871df7',url,timeoutMs:120000},async({createContext})=>{
  for(const width of [320,390,768,1280])for(const theme of ['light','dark']){
   const context=await createContext({viewport:{width,height:860},locale:'ar-SA',colorScheme:theme});
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   const responses=[];page.on('response',r=>responses.push({url:r.url(),status:r.status()}));
   await page.goto(url);assert.match(await page.locator('body').innerText(),/تجربة افتراضية - لا دخول فعلي ولا بيانات حقيقية/);
   assert.equal(await page.locator('h1').innerText(),'دعوة تعلّم،\nتبدأ بخطوة بسيطة');
   assert.ok((await page.locator('body').innerText()).includes('مدرسة النور الافتراضية'));
   await page.locator('#open').focus();await page.keyboard.press('Enter');await page.locator('#mock.show').waitFor();
   assert.equal(await page.locator('#mock').evaluate(e=>document.activeElement===e),true);
   await page.locator('#back').click();assert.equal(await page.locator('#mock').isVisible(),false);
   await page.locator('#code').fill('not-valid');await page.locator('#form button').press('Enter');assert.equal(await page.locator('#code').getAttribute('aria-invalid'),'true');
   await page.locator('#code').fill('DEMO-ONLY');await page.locator('#form button').press('Enter');await page.locator('#mock.show').waitFor();
   await page.locator('#resetTop').click();assert.equal(await page.locator('#code').inputValue(),'');
   await page.locator('#theme').click();assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
   await page.locator('#theme').click();assert.equal(await page.locator('html').getAttribute('data-theme'),'light');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
   assert.deepEqual(errors,[]);assert.deepEqual(responses.map(r=>r.status),[200]);
   assert.equal(await page.evaluate(()=>document.documentElement.lang==='ar'&&document.documentElement.dir==='rtl'),true);
   checks.push({name:`${width}px_${theme}_direct_static_preview`,status:'PASS',evidence:'Direct anonymous HTTP path returned the static document; actual handlers, keyboard, mock/manual/reset/theme controls, RTL and no horizontal overflow passed. Exactly one same-origin document response; no other requests.'});
   await context.close();
  }
 });
 assert.equal(requests.length,8);assert.ok(requests.every(path=>path==='/n88-invite-preview.html'));
}finally{await new Promise(resolve=>server.close(resolve));}
const result={checks,requestPaths:requests,resourceCleanup:'Owned local server closed in finally; isolated browser helper closes owned contexts and browser.'};
await writeFile(new URL('./n88-public-invite-preview-browser.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
