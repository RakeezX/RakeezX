// AI-authored: bounded real-app Reports discoverability regression.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {withIsolatedLocalBrowser} from '../../../scripts/ops-supervisor-v4/isolated-local-browser.mjs';
import {openReadyServedDemo} from './helpers/served-demo-readiness.mjs';

const taskId='continuous-n126-portfolio-reports-entry-20261027';
const runId=process.env.RAKEEZX_LOCAL_RUN_ID || 'b8e0ca7e-a67d-4085-ab66-93fe380a1702';
const taskFile=`C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/${taskId}.json`;
const checkpoint=page=>page.evaluate(async()=>{
  const db=await import('/src/lib/db.js');
  return JSON.stringify(await Promise.all(db.STORES.map(name=>db.getAll(name))));
});

test('N126 Reports entry: populated/empty, responsive, existing Preview route, no record writes',async()=>{
  const screenshots=await mkdtemp(join(tmpdir(),'rakeez-n126-reports-'));
  const server=await createServer({root:process.cwd(),server:{host:'127.0.0.1',port:0,strictPort:true}});
  try {
    await server.listen();
    const url=`http://127.0.0.1:${server.httpServer.address().port}`;
    await withIsolatedLocalBrowser({taskFile,runId,url,timeoutMs:120000},async({createContext})=>{
      for(const width of [320,390,1280]) {
        const context=await createContext({viewport:{width,height:900},locale:'ar-SA'});
        try {
          await context.addInitScript(()=>sessionStorage.setItem('rakeezx-demo-session-v1','preparing'));
          const page=await context.newPage();
          page.setDefaultTimeout(10000);
          const errors=[],mutations=[];
          page.on('pageerror',e=>errors.push(e.message));
          page.on('request',r=>{if(!['GET','HEAD'].includes(r.method()))mutations.push(r.method()+' '+r.url());});
          await openReadyServedDemo(page,url);
          for(const empty of [false,true]) {
            if(empty) await page.evaluate(async()=>{
              const s=await import('/src/store.js'),db=await import('/src/lib/db.js');
              const w=s.getActiveWorkspace();
              if(w?.type!=='demo'||w.authUserId||w.syncEligible||db.getActiveDatabaseName()!==w.databaseName)throw Error('SYNTHETIC_DEMO_ONLY');
              // Disposable Demo fixture only; no Product handler/data behavior changed.
              await db.clearStore('teachings');
              await s.refreshSyncedState();
            });
            const before=await checkpoint(page);
            await page.evaluate(()=>{location.hash='#/reports';});
            const link=page.getByRole('link',{name:/ملف الإنجاز \(معاينة\)/});
            await link.waitFor({state:'visible'});
            assert.equal(await link.getAttribute('href'),'#/reports/portfolio-preview');
            const copy=await link.innerText();
            for(const phrase of ['11 معيارًا','الصور','PDF','هذا المتصفح فقط','أرشيف محلي يدوي قابل للنقل','N71','غير مكتملين','جهاز آخر'])assert.ok(copy.includes(phrase),phrase);
            if(empty) {
              assert.match(await page.locator('.empty__text').innerText(),/أنشئ فصلًا وأضف طلابه/);
              assert.equal(await page.locator('.empty a').getAttribute('href'),'#/classes');
            } else {
              for(const path of ['certificates','execution','grades','followup'])assert.equal(await page.locator(`a[href="#/reports/${path}"]`).count(),1);
              await page.locator('.report-grade-group').first().locator('summary').click();
              assert.ok(await page.locator('.report-class-row').count()>0);
              assert.match(await page.locator('.report-class-row').first().getAttribute('href'),/^#\/teaching\/.+\/reports$/);
            }
            await link.focus();
            assert.equal(await link.evaluate(el=>el===document.activeElement),true);
            await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
            assert.equal(await link.evaluate(el=>getComputedStyle(el).display),'flex');
            assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
            const box=await link.boundingBox();
            assert.ok(box.x>=0&&box.x+box.width<=width+1&&box.height>=44);
            const image=join(screenshots,`${width}-${empty?'empty':'populated'}.png`);
            await page.screenshot({path:image,fullPage:true});
            console.log('Rendered Reports:',image);
            // Native keyboard activation follows the app's existing hash resolver.
            await link.press('Enter');
            await page.locator('[data-folio-focus]').waitFor({state:'visible'});
            assert.equal(new URL(page.url()).hash,'#/reports/portfolio-preview');
            assert.equal(await page.locator('.folio-contents__row').count(),11);
            assert.equal(await checkpoint(page),before,'Reports navigation must not mutate persisted Demo records');
            console.log(`PASS ${width}px ${empty?'empty':'populated'}: entry, copy, links, keyboard route, unchanged records`);
          }
          assert.deepEqual(errors,[]);
          assert.deepEqual(mutations,[]);
        } finally {await context.close();}
      }
    });
  } finally {await server.close();}
});
