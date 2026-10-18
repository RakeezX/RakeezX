// AI: actual production module/client/handlers/CSS mounted with fabricated context and loopback service.
import assert from 'node:assert/strict';
import { writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { withIsolatedLocalBrowser } from 'file:///C:/Users/Abody/Projects/RakeezX/scripts/ops-supervisor-v4/isolated-local-browser.mjs';
import { startClassServer } from './fixtures/n88-class-management/server.mjs';
const taskId='continuous-n88-integrated-class-management-20261018',runId='48654997-1a32-4af7-aa5e-c3882d2731f6';
const server=await startClassServer(),checks=[];
const record={taskId,runId,check:'n88_class_roster_batch_selective_actions_visibility_actual_ui',status:'FAIL',checks,limits:'Actual unregistered module only, synthetic HTTP fixture; no live Auth/owner/store composition, real student access, service activation, Production or PO acceptance.'};
const files=['src/views/student-portal-class.js','src/lib/student-portal-class-client.js','src/styles/student-portal-class.css','src/styles/app.css','tests/n88-class-management-client.mjs','tests/n88-class-management-browser.mjs','tests/fixtures/n88-class-management/entry.js','tests/fixtures/n88-class-management/server.mjs','tests/fixtures/n88-class-management/index.html'];
record.sourceSha256=Object.fromEntries(await Promise.all(files.map(async f=>[f,createHash('sha256').update((await readFile(f,'utf8')).replace(/\r\n/g,'\n')).digest('hex')])));
try {
  await withIsolatedLocalBrowser({taskFile:`C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/${taskId}.json`,runId,url:server.url,timeoutMs:120000},async({createContext})=>{
    for(const width of [390,1280]) {
      server.reset();const context=await createContext({viewport:{width,height:900},locale:'ar-SA'}),page=await context.newPage(),errors=[],logs=[];
      page.on('pageerror',()=>errors.push('pageerror'));page.on('console',m=>{if(m.type()!=='error')logs.push(m.text());});
      context.on('request',req=>{assert.equal(new URL(req.url()).search,'');assert.equal(new URL(req.url()).hash,'');});
      await page.goto(server.url);await page.locator('.n88-class-roster>li').last().waitFor();
      assert.equal(await page.locator('.n88-class-roster>li').count(),30);
      assert.equal(await page.locator('[data-visibility] input:checked').count(),0);
      assert.equal(await page.locator('.n88-class').evaluate(el=>getComputedStyle(el).direction),'rtl');
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
      assert.equal(await page.locator('[data-action=batch]').evaluate(el=>getComputedStyle(el).minHeight),'44px');
      await page.screenshot({path:`tests/fixtures/n88-class-management/roster-${width}.png`,fullPage:true}); // No generated code exists.
      const refresh=async()=>{await page.locator('[data-action=refresh]').click();await page.locator('.n88-class-roster>li').last().waitFor();};
      for(const f of ['name','class','grades','required','completed','scheduled'])await page.locator(`[name=${f}]`).check();
      await page.locator('[data-visibility] button').click();await page.getByRole('status').filter({hasText:'أقرّ الخادم حفظ'}).waitFor();
      assert.equal(await page.locator('[data-action=batch]').isDisabled(),true);await refresh();
      assert.equal(await page.locator('[data-visibility] input:checked').count(),6);
      const before=await page.evaluate(()=>window.fixture.calls.filter(a=>a==='issue-missing').length);
      await page.locator('[data-action=batch]').evaluate(b=>{b.click();b.click();});
      await page.locator('[data-delivery]').waitFor();
      assert.equal(await page.evaluate(()=>window.fixture.calls.filter(a=>a==='issue-missing').length),before+1);
      assert.equal(await page.locator('[data-delivery] input').count(),19);
      assert.match(await page.getByRole('status').innerText(),/أُنشئ: 19، موجود مسبقًا: 10، تعذّر: 1/);
      assert.equal(await page.locator('[data-outcomes] li').count(),11);
      assert.ok(await page.locator('[data-delivery] input').evaluateAll(els=>els.every(el=>/^1[0-9]{11}$/.test(el.value)&&el.readOnly)));
      await page.locator('[data-action=copy]').click();await page.locator('[data-action=print]').click();
      assert.ok(await page.evaluate(()=>window.fixture.copied&&window.fixture.printed));
      await page.emulateMedia({media:'print'});
      assert.ok(await page.locator('[data-delivery] input').evaluateAll(els=>els.every(el=>getComputedStyle(el).visibility==='visible')));
      assert.equal(await page.locator('.n88-class h2').evaluate(el=>getComputedStyle(el).visibility),'hidden');
      assert.equal(await page.locator('[data-action=print]').evaluate(el=>getComputedStyle(el).display),'none');
      await page.emulateMedia({media:null});
      await page.locator('[data-action=close-sheet]').click();assert.equal(await page.locator('[data-delivery]').count(),0);
      await refresh();await page.locator('[data-action=batch]').click();await page.locator('[data-delivery]').waitFor();
      assert.equal(await page.locator('[data-delivery] input').count(),1);assert.match(await page.getByRole('status').innerText(),/أُنشئ: 1، موجود مسبقًا: 29/);
      await page.locator('[data-action=close-sheet]').click();await refresh();
      let calls=await page.evaluate(()=>window.fixture.calls.length);
      await page.locator('[data-action=review-rotate]').first().click();await page.locator('[data-confirm]').waitFor();
      assert.match(await page.locator('[data-confirm]').innerText(),/يُبطل الرمز السابق وجميع جلساته/);
      await page.locator('[data-action=cancel]').click();assert.equal(await page.evaluate(()=>window.fixture.calls.length),calls);
      await page.locator('[data-action=review-rotate]').first().click();await page.locator('[data-action=confirm]').click();await page.locator('[data-delivery]').waitFor();
      assert.equal(await page.locator('[data-delivery] input').count(),1);
      await page.locator('[data-action=close-sheet]').click();await refresh();
      await page.locator('[data-action=review-revoke]').first().click();assert.match(await page.locator('[data-confirm]').innerText(),/لن يستطيع الطالب الدخول/);
      await page.locator('[data-action=confirm]').click();await page.getByRole('status').filter({hasText:'أُقرّ إلغاء'}).waitFor();assert.equal(await page.locator('[data-delivery]').count(),0);
      await refresh();assert.equal(await page.locator('[data-action=review-rotate]').first().isDisabled(),true);
      await page.evaluate(()=>window.fixture.setMode('lost'));await page.locator('[data-action=batch]').click();
      await page.getByRole('status').filter({hasText:'لم يتأكد اكتمال'}).waitFor();assert.equal(await page.locator('[data-delivery]').count(),0);
      await refresh();assert.equal(await page.locator('[data-action=review-rotate]').first().isDisabled(),false); // Server applied; UI never invented ACK.
      await page.evaluate(()=>window.fixture.drift());await page.locator('.n88-class-roster>li').last().waitFor();assert.equal(await page.locator('[data-confirm]').count(),0);
      await page.evaluate(()=>window.fixture.setMode('delay'));await page.locator('[data-action=review-rotate]').first().click();await page.locator('[data-action=confirm]').click();
      await page.waitForFunction(()=>window.fixture.pending===true);await page.evaluate(()=>{window.fixture.switchOwner();window.fixture.release();});
      await page.getByRole('status').filter({hasText:'غير مفعّلة'}).waitFor();
      assert.equal(await page.locator('[data-delivery]').count(),0);assert.equal(await page.locator('[data-action=batch]').count(),0);
      assert.equal(await page.evaluate(()=>/1[0-9]{11}/.test(document.body.innerText)),false);
      assert.deepEqual(await page.evaluate(async()=>({local:{...localStorage},session:{...sessionStorage},dbs:await indexedDB.databases(),caches:await caches.keys(),cookie:document.cookie})),{local:{},session:{},dbs:[],caches:[],cookie:''});
      assert.equal(logs.some(s=>/1[0-9]{11}/.test(s)),false);assert.deepEqual(errors,[]);
      await page.evaluate(()=>window.fixture.handle.dispose());assert.equal(await page.locator('#class-portal').innerText(),'');
      server.reset();await page.reload();await page.locator('.n88-class-roster>li').last().waitFor();
      await page.evaluate(()=>window.fixture.setMode('uncertain'));await page.locator('[data-action=batch]').click();await page.locator('[data-delivery]').waitFor();
      assert.match(await page.getByRole('status').innerText(),/نتائج غير مؤكدة/);assert.match(await page.locator('[data-outcomes]').innerText(),/نتيجة غير مؤكدة/);
      await page.evaluate(()=>window.fixture.switchOwner());await page.getByRole('status').filter({hasText:'غير مفعّلة'}).waitFor();assert.equal(await page.locator('[data-delivery]').count(),0);
      server.reset();await page.reload();await page.locator('.n88-class-roster>li').last().waitFor();
      await page.evaluate(()=>window.fixture.expireSoon());await page.locator('.n88-class-roster>li').last().waitFor();
      await page.locator('[data-action=batch]').click();await page.locator('[data-delivery]').waitFor();
      await page.getByRole('status').filter({hasText:'غير مفعّلة'}).waitFor();assert.equal(await page.locator('[data-delivery]').count(),0);
      checks.push({width,status:'PASS',coverage:'30-student roster/RTL/no overflow, six explicit fields+ACK, 19 created/10 skipped/1 failed, retry only missing, doubleclick, bounded copy/print/clear, selective confirmation+rotate/revoke, lost ACK readback, explicit uncertain partial ACK, context drift, delayed owner switch, sheet cleared on owner switch/expiry, no storage/log/URL secrets, dispose'});
      await context.close();
    }
  });
  record.status='PASS';
}catch(error){record.error=String(error.message).replace(/1[0-9]{11}/g,'[REDACTED]');throw error;}
finally{await server.close();record.resources='Owned loopback server closed; isolated helper closed owned browser/contexts in finally; no global live-browser lease used.';await writeFile('tests/n88-class-management-browser.json',JSON.stringify(record,null,2)+'\n');}
