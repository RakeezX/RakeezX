/** AI: affected actual component/client/CSS check over isolated loopback HTTP. */
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { startExample } from './fixtures/n88-student-brand/server.mjs';
import { validStudentCode } from '../src/lib/student-portal-unified-client.js';
import { withIsolatedLocalBrowser } from 'file:///C:/Users/Abody/Projects/RakeezX/scripts/ops-supervisor-v4/isolated-local-browser.mjs';
const taskId='continuous-n88-branded-student-example-20261018',runId='4e41fc23-9424-493d-a20a-e4e13184b113';
const evidence='tests/fixtures/n88-student-brand/evidence';
await mkdir(evidence,{recursive:true});
const report={taskId,runId,checks:[],visual:[],graph:[],cleanup:{}};
let server,failure;
try {
  const visited=new Set();
  async function inspect(file) {
    if(visited.has(file))return;visited.add(file);
    const source=await readFile(file,'utf8');
    assert.doesNotMatch(source,/\b(?:localStorage|sessionStorage|indexedDB|serviceWorker)\b|supabase|analytics|from\s+['"][^'"]*(?:auth|account|store|sync)/i,file);
    report.graph.push({path:relative(process.cwd(),file).replaceAll('\\','/'),sha256:createHash('sha256').update(source).digest('hex')});
    for(const match of source.matchAll(/(?:from\s*|import\s*)['"]([^'"]+)['"]/g)) {
      assert.ok(match[1].startsWith('.'),'Only relative pure dependencies');
      await inspect(resolve(dirname(file),match[1]));
    }
  }
  await inspect(resolve('src/views/student-portal-login.js'));
  assert.ok(report.graph.some(x=>x.path==='src/lib/brand.js'));
  assert.equal(validStudentCode('1'+'2'.repeat(5)),true);
  for(const value of ['1'+'2'.repeat(4),'2'.repeat(6),'1'+'2'.repeat(6),'١٢٣٤٥٦'])assert.equal(validStudentCode(value),false);
  server=await startExample({port:18988,ttlMs:120000});report.url=server.url;
  await withIsolatedLocalBrowser({taskFile:'C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/'+taskId+'.json',runId,url:server.url,timeoutMs:90000},async({createContext})=>{
    for(const width of [390,698,1280])for(const theme of ['light','dark']) {
      const context=await createContext({viewport:{width,height:900},locale:'ar-SA',colorScheme:theme});
      const page=await context.newPage(),errors=[],badRequests=[];
      page.on('pageerror',e=>errors.push(e.message));
      page.on('response',res=>{if(res.status()>=400)badRequests.push(res.url());});
      await page.goto(server.url);
      await page.getByText('طالب اصطناعي',{exact:true}).waitFor();
      await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
      await page.evaluate(()=>document.fonts.ready);
      assert.match(await page.locator('aside').textContent(),/مصطنعة/);
      assert.equal(await page.locator('[role=img][aria-label="رَكيز المعلم"]').count(),1);
      const logo=page.locator('.brand-lockup__image--'+theme);
      assert.equal(await logo.isVisible(),true);assert.equal(await logo.evaluate(e=>e.complete&&e.naturalWidth>0),true);
      assert.equal(await page.locator('input').count(),0);
      assert.equal(await page.locator('tbody tr').nth(1).locator('td').first().textContent(),'0');
      assert.equal(await page.locator('tbody tr').nth(2).locator('td').first().textContent(),'لم تُرصد');
      assert.deepEqual(await page.locator('[data-section]').evaluateAll(es=>es.map(e=>e.dataset.section)),['required','completed','scheduled']);
      assert.equal(await page.locator('details[open]').count(),0);
      await page.locator('[data-section=required] summary').click();
      await page.getByText(/سلّم الدفتر/).waitFor({state:'visible'});
      await page.locator('[data-section=completed] summary').focus();await page.keyboard.press('Enter');
      assert.equal(await page.locator('[data-section=completed] details').getAttribute('open'),'');
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
      assert.equal(await page.locator('#portal').evaluate(e=>getComputedStyle(e).direction),'rtl');
      for(const rect of await page.locator('#portal button, #portal summary').evaluateAll(es=>es.map(e=>({h:e.getBoundingClientRect().height,w:e.getBoundingClientRect().width}))))assert.ok(rect.h>=44&&rect.w>=44);
      const screenshot=`${evidence}/${width}-${theme}.png`;
      await page.screenshot({path:screenshot,fullPage:true});
      const colors=await page.locator('#portal').evaluate(e=>({background:getComputedStyle(e).backgroundColor,text:getComputedStyle(e).color}));
      assert.deepEqual(errors,[]);assert.deepEqual(badRequests,[]);
      report.visual.push({width,theme,screenshot,overflow:false,detailsKeyboard:true,colors});
      await context.close();
    }
    const context=await createContext({viewport:{width:390,height:900}}),page=await context.newPage();
    await page.goto(server.url);await page.getByText('طالب اصطناعي',{exact:true}).waitFor();
    await page.evaluate(async()=>{
      window.portal.dispose();
      const {mountUnifiedStudentPortal}=await import('/src/views/student-portal-login.js');
      const {createUnifiedStudentPortalClient}=await import('/src/lib/student-portal-unified-client.js');
      const {projection}=await import('/tests/fixtures/n88-student-brand/projection.mjs');
      window.mode='full';window.transport=[];
      const client=createUnifiedStudentPortalClient({fetch:async(url,options)=>{
        // Record no credential or response body. This is a synthetic read/session port, not Auth proof.
        window.transport.push({url,cache:options.cache,referrerPolicy:options.referrerPolicy,credentials:options.credentials,redirect:options.redirect});
        if(window.mode==='delay')await new Promise(r=>window.releaseRead=r);
        if(url.endsWith('/end'))return {ok:true};
        if(['session','rate','failure'].includes(window.mode))return {ok:false,status:{session:410,rate:429,failure:503}[window.mode],headers:new Headers({'Retry-After':'1'})};
        return {ok:true,json:async()=>window.mode==='omitted'?{version:'n88-student-v3',work:{completed:[{id:'only',title:'عنوان منشور فقط',private:'NEVER_RENDER'}]},private:'NEVER_RENDER'}:structuredClone(projection)};
      }});
      window.portal=mountUnifiedStudentPortal(document.querySelector('#portal'),{client,readiness:{enabled:true}});
      await window.portal.ready;
    });
    await page.evaluate(async()=>{window.mode='omitted';await window.portal.refresh();});
    assert.equal(await page.locator('table,.n88-unified-name,.n88-unified-class,[data-section=required],[data-section=scheduled],details').count(),0);
    assert.equal(await page.getByText('عنوان منشور فقط',{exact:true}).count(),1);
    assert.doesNotMatch(await page.locator('#portal').textContent(),/NEVER_RENDER|طالب اصطناعي|لم يُرصد إنجاز/);
    await page.evaluate(async()=>{window.mode='session';await window.portal.refresh();});
    assert.equal(await page.locator('input').count(),1);assert.equal(await page.locator('input').getAttribute('pattern'),'1[0-9]{5}');
    assert.equal(await page.locator('input').inputValue(),'');assert.match(await page.locator('[role=status]').textContent(),/الجلسة/);
    await page.evaluate(async()=>{window.mode='failure';await window.portal.refresh();});
    assert.match(await page.locator('[role=status]').textContent(),/تعذّر/);
    await page.evaluate(async()=>{window.mode='rate';await window.portal.refresh();});
    assert.equal(await page.locator('input:disabled').count(),1);await page.locator('input:enabled').waitFor();
    await page.evaluate(async()=>{window.mode='full';await window.portal.refresh();});
    await page.locator('[data-end]').click();await page.locator('input').waitFor();
    assert.doesNotMatch(await page.locator('#portal').textContent(),/طالب اصطناعي/);
    await page.evaluate(async()=>{window.mode='full';await window.portal.refresh();});
    await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));
    assert.equal(await page.locator('table').count(),0);
    await page.evaluate(()=>{window.mode='delay';void window.portal.refresh();});
    await page.waitForFunction(()=>!!window.releaseRead);
    await page.evaluate(()=>{window.portal.clear();window.releaseRead();});
    await page.locator('input').waitFor();await page.waitForTimeout(100);assert.equal(await page.locator('table').count(),0);
    const transport=await page.evaluate(()=>window.transport);
    assert.ok(transport.some(t=>t.url.endsWith('/end')));
    for(const t of transport)assert.deepEqual([t.cache,t.referrerPolicy,t.credentials,t.redirect],['no-store','no-referrer','same-origin','error']);
    assert.equal(await page.evaluate(()=>localStorage.length+sessionStorage.length),0);
    await page.evaluate(()=>window.portal.dispose());assert.equal(await page.locator('#portal').textContent(),'');
    await context.close();
  });
  report.checks=[
    {name:'n88_branded_student_postlogin_example_responsive_visible_fields',status:'PASS',evidence:'Actual component + app.css + compact lockup: 390/698/1280 light/dark, zero/null, ordered work groups, click/keyboard details, >=44px controls, no horizontal overflow; six screenshots.'},
    {name:'n88_student_cosmetic_change_existing_session_clear_and_private_graph',status:'PASS',evidence:'Actual unchanged client with synthetic read/end ports: omitted fields/private values absent, 410/503/429, cooldown, end/pagehide/clear and stale response suppression; six-digit pattern, no-store/no-referrer/credentials/redirect preserved, empty storage. Recursive pure JS graph recorded.'}
  ];
}catch(error){failure=error;report.failure={message:error.message,stack:error.stack};}
finally{if(server){await server.close();report.cleanup.serverClosed=true;}report.cleanup.browserOwnedByCanonicalHelper=true;await writeFile('tests/n88-student-brand.result.json',JSON.stringify(report,null,2)+'\n');}
if(failure)throw failure;
console.log('N88 branded student example: affected checks PASS; owned server/browser closed.');
