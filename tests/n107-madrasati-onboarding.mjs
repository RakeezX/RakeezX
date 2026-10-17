// AI-authored: focused actual-app fresh-account check using existing fixture and guards.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {createHash} from 'node:crypto';
import {withIsolatedLocalBrowser} from '../../../scripts/ops-supervisor-v4/isolated-local-browser.mjs';
import {openReadyServedDemo} from './helpers/served-demo-readiness.mjs';
import {syntheticService} from './n73-account-flow-fixture.mjs';
const taskId='continuous-n107-madrasati-primary-onboarding-20261018',runId='6e080d21-4b28-465c-9860-8d96990dbdb0';
const taskFile='C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/'+taskId+'.json';
const root=resolve('.'),base='http://127.0.0.1:49807',service=syntheticService();
for(const name of ['sections','teachings','students','enrollments','items','scores'])service.current[name]=[];
const baseline=process.argv.includes('--baseline'),dir='tests/fixtures/n107-madrasati-onboarding';
const evidence={taskId,runId,origin:base,baseline,checks:[],errors:[],files:{}};
const server=createServer(async(req,res)=>{
  try {
    const pathname=new URL(req.url,base).pathname;
    if(pathname.startsWith('/__n73/')) {
      let body='';for await(const chunk of req)body+=chunk;
      const data=await service.request(pathname.slice(7),JSON.parse(body||'{}'));
      res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data));return;
    }
    const file=resolve(root,pathname==='/'?'index.html':'.'+decodeURIComponent(pathname));
    if(!file.startsWith(root+sep))throw Error('Outside task root');
    res.setHeader('Content-Type',{'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2','.webmanifest':'application/manifest+json'}[extname(file)]||'application/octet-stream');
    res.end(await readFile(file));
  }catch(error){res.writeHead(404);res.end(error.message);}
});

async function prepare(page) {
  await openReadyServedDemo(page,base);
  await page.evaluate(async()=>{
    const f=await import('/tests/n73-account-flow-fixture.mjs');await f.prepareAccount();
    const s=await import('/src/store.js'),d=await import('/src/lib/db.js');
    const receipt={ownerId:f.owner,contractVersion:1,foundationHash:'n107-browser'};
    s.state.device.accountProvisioningReceipt=receipt;await d.put('device',s.state.device);
    const registry=(await import('/src/lib/workspaces.js')).createWorkspaceRegistry();
    try {await registry.registerProvisionedAccount(f.owner,receipt);}finally{await registry.close();}
    const routing=await(await import('/src/lib/workspace-routing.js')).resolveWorkspaceForBoot({authUser:{id:f.owner}});
    if(routing.status!=='ready')throw Error(JSON.stringify(routing));s.activateWorkspace(routing.workspace);
    await(await import('/src/lib/offline-lease.js')).runtimeOfflineLease().renew(async()=>({id:f.owner,source:'supabase-auth-user',verifiedAt:Date.now()}));
    s.assertClassImportAccess();(await import('/src/repaint.js')).repaint();
  });
}

const checkpoint=page=>page.evaluate(async()=>{const d=await import('/src/lib/db.js');return JSON.stringify(await Promise.all(['sections','subjects','teachings','students','enrollments','items','scores','outbox'].map(n=>d.getAll(n))));});
async function visit(page,hash,selector){await page.evaluate(h=>location.hash=h,hash);await page.locator(selector).waitFor();}
async function capture(page,name){
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'No horizontal overflow: '+name);
 await page.screenshot({path:dir+'/'+(baseline?'baseline-':'')+name+'.png',fullPage:true,animations:'disabled'});
}
try {
 await mkdir(dir,{recursive:true});
 await new Promise((done,reject)=>{server.once('error',reject);server.listen(49807,'127.0.0.1',done);});
 await withIsolatedLocalBrowser({taskFile,runId,url:base,timeoutMs:90000},async({createContext})=>{
  for(const width of baseline?[390]:[390,1280]){
   const context=await createContext({viewport:{width,height:900},locale:'ar-SA',timezoneId:'Asia/Riyadh'});
   try{
    await context.addInitScript(()=>sessionStorage.setItem('rakeezx-demo-session-v1','preparing'));
    const page=await context.newPage();page.setDefaultTimeout(8000);page.on('pageerror',e=>evidence.errors.push(e.message));
    await prepare(page);const before=await checkpoint(page);
    await visit(page,'#/','.home-onboarding');
    evidence.checks.push({width,home:await page.locator('.home-onboarding').innerText()});
    await capture(page,'home-'+width);
    if(baseline)continue;
    const actions=page.locator('.home-onboarding__actions');
    assert.equal(await actions.locator('.btn--primary').count(),1);
    const primary=actions.locator('a').first(),secondary=actions.locator('a').nth(1);
    assert.equal((await primary.innerText()).trim(),'استيراد الفصول من مدرستي');
    assert.equal(await primary.getAttribute('href'),'#/classes/koshoof?new=1');
    assert.ok((await primary.getAttribute('class')).includes('btn--primary'));
    assert.equal((await secondary.innerText()).trim(),'إنشاء أول فصل');
    assert.equal(await secondary.getAttribute('href'),'#/classes');
    assert.equal(await page.locator('.home-onboarding h2').innerText(),'ابدأ بفصولك وطلابك');
    assert.equal(await page.locator('.home-onboarding__kicker').innerText(),'خطوتك الأولى');
    assert.equal(await page.locator('.home-onboarding__copy p').innerText(),'استورد فصولك وطلابك من مدرستي، أو أنشئ فصلًا يدويًا ثم أضف طلابه ومواعيد حصصه.');
    const primaryBackground=await primary.evaluate(el=>getComputedStyle(el).backgroundColor);
    await primary.click();await page.locator('[data-roster-file-flow]').waitFor();
    assert.equal(await page.evaluate(()=>location.hash),'#/classes/koshoof?new=1');
    assert.equal(await page.locator('[data-change="grade-file"]').count(),1);
    assert.ok(await page.locator('a[href*="extension"]').count()>0,'Existing extension entry available');
    await capture(page,'import-'+width);
    await visit(page,'#/','.home-onboarding');await page.locator('.home-onboarding__actions a').nth(1).click();
    await page.locator('.classes-empty').waitFor();
    const term=await page.evaluate(async()=>(await import('/src/store.js')).activeTerm().name);
    assert.equal(await page.locator('.classes-empty .empty__title').innerText(),'لا فصول في '+term);
    assert.equal(await page.locator('.classes-empty .empty__text').innerText(),'استورد فصولك وطلابك من مدرستي، أو أنشئ فصلًا يدويًا واختر مادته.');
    const toolbar=page.locator('.classes-toolbar');
    assert.equal(await toolbar.locator('.btn--primary').count(),1);
    assert.equal((await toolbar.locator('.btn').first().innerText()).trim(),'استيراد الفصول من مدرستي');
    assert.equal(await toolbar.locator('.btn').first().getAttribute('href'),'#/classes/koshoof?new=1');
    assert.equal((await toolbar.locator('[data-act="add"]').innerText()).trim(),'إنشاء أول فصل');
    assert.ok(!(await toolbar.locator('[data-act="add"]').getAttribute('class')).includes('btn--primary'));
    assert.equal(await toolbar.locator('.classes-tools-left [data-act="add-demo"]').count(),1);
    assert.equal(await toolbar.locator('.btn--primary').evaluate(el=>getComputedStyle(el).backgroundColor),primaryBackground,'Classes primary uses the same rendered primary background as Home');
    await capture(page,'classes-'+width);
    await toolbar.locator('a').first().click();await page.locator('[data-roster-file-flow]').waitFor();
    await visit(page,'#/classes','.classes-empty');
    await page.locator('[data-act="add"]').click();await page.locator('#tch-form').waitFor();
    await capture(page,'manual-'+width);
    await page.locator('[data-sheet-close]:visible').first().click();
    assert.equal(await checkpoint(page),before,'Navigation/open/cancel must not save data');
    evidence.checks.push({width,status:'PASS',detail:'Primary/secondary order, exact copy/hrefs, existing import file/extension, current term, create form open/cancel, no data changes, no overflow.'});
   }finally{await context.close();}
  }
 });
 assert.deepEqual(evidence.errors,[]);
 evidence.status='PASS';
 for(const f of ['src/views/home.js','src/views/teachings.js','src/styles/components.css'])evidence.files[f]=createHash('sha256').update(await readFile(f)).digest('hex');
}catch(e){evidence.status='FAIL';evidence.failure=e.stack;process.exitCode=1;console.error(e);}
finally{await new Promise(r=>server.close(r));evidence.ownedServerClosed=true;await writeFile('tests/n107-madrasati-onboarding'+(baseline?'-baseline':'')+'.json',JSON.stringify(evidence,null,2)+'\n');}
console.log(evidence.status);
