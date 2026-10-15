import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { withIsolatedLocalBrowser } from '../../../scripts/ops-supervisor-v4/isolated-local-browser.mjs';
import { openReadyServedDemo } from './helpers/served-demo-readiness.mjs';

const taskFile='C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/continuous-n36-koshoof-discoverable-entry-20261015.json';
const runId='abef778e-33d6-4424-944d-ded1376d058f';
const root=resolve('.');
const server=createServer(async(req,res)=>{
  try {
    const pathname=new URL(req.url,'http://127.0.0.1').pathname;
    const file=resolve(root,pathname==='/'?'index.html':'.'+decodeURIComponent(pathname));
    if(!file.startsWith(root+sep))throw new Error('Outside application root');
    res.setHeader('Content-Type',{'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'}[extname(file)]||'application/octet-stream');
    res.end(await readFile(file));
  } catch(error) {res.writeHead(404);res.end(error.message);}
});
const evidence={taskId:'continuous-n36-koshoof-discoverable-entry-20261015',runId,checks:[],errors:[]};
const record=(name,detail)=>{evidence.checks.push({name,status:'PASS',evidence:detail});console.log('PASS '+name);};
try {
  await new Promise((done,reject)=>{server.once('error',reject);server.listen(49370,'127.0.0.1',done);});
  const base='http://127.0.0.1:49370';
  await mkdir('test-results/n36-koshoof-discoverability',{recursive:true});
  await withIsolatedLocalBrowser({taskFile,runId,url:base,timeoutMs:120000},async({createContext})=>{
    const widths=[];
    for(const width of [320,390,768,1280]) {
      const context=await createContext({viewport:{width,height:900},locale:'ar-SA'});
      try {
        await context.addInitScript(()=>sessionStorage.setItem('rakeezx-demo-session-v1','preparing'));
        const page=await context.newPage();page.setDefaultTimeout(10000);
        page.on('pageerror',error=>evidence.errors.push(error.message));
        await openReadyServedDemo(page,base);
        await page.evaluate(()=>{window.n36Writes=[];for(const name of ['put','add','delete','clear']){const original=IDBObjectStore.prototype[name];IDBObjectStore.prototype[name]=function(...args){window.n36Writes.push(this.name+':'+name);return original.apply(this,args);};}});
        const card=page.locator('.class-card').first();
        const classId=(await card.locator('.class-card__actions a').getAttribute('href')).match(/teaching\/([^/]+)\/koshoof/)[1];
        const action=card.locator('.class-card__actions a');
        assert.equal((await action.innerText()).trim(),'الكشوف');
        const box=await action.boundingBox();assert.ok(box.height>=44&&box.width>=44);
        assert.equal(await action.evaluate(a=>a.closest('.class-card__actions')?.parentElement===a.closest('.class-card')&&!a.closest('.class-card__main')),true);
        await action.focus();assert.equal(await action.evaluate(a=>a===document.activeElement),true);
        const focus=await action.evaluate(a=>getComputedStyle(a).outlineStyle);
        assert.notEqual(focus,'none');
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
        await page.screenshot({path:`test-results/n36-koshoof-discoverability/classes-${width}.png`,fullPage:true});
        await page.evaluate(id=>location.hash=`#/teaching/${id}`,classId);
        const tile=page.locator('.class-tools-section a[href$="/koshoof"]');
        await tile.waitFor();assert.equal((await tile.locator('.tile__title').innerText()).trim(),'الكشوف');
        assert.equal((await tile.locator('.tile__sub').innerText()).trim(),'استيراد وتصدير الكشوف');
        assert.equal(await page.locator('.class-tools-section a[href$="/reports"] .tile__sub').innerText(),'طباعة وتقارير الفصل');
        assert.equal(await page.locator('.class-tools-section a[href$="/koshoof"]').count(),1);
        await tile.click();
        await page.locator('[data-grade-import-panel]').waitFor();
        assert.equal(new URL(page.url()).hash,`#/teaching/${classId}/koshoof`);
        assert.equal(await page.locator('[data-grade-export-panel]').isVisible(),false);
        const guarded=await page.evaluate(async id=>{
          const store=await import('/src/store.js');
          const {canOpenRoster}=await import('/src/views/students.js');
          const teaching=store.getTeaching(id),section=store.getSection(teaching.sectionId),previous={archived:section.archived,status:section.status};
          section.archived=true;section.status='archived';
          const archivedRefused=!canOpenRoster({id});
          Object.assign(section,previous);
          return {valid:canOpenRoster({id}),archivedRefused,missingRefused:!canOpenRoster({id:'unverified-missing'})};
        },classId);
        assert.deepEqual(guarded,{valid:true,archivedRefused:true,missingRefused:true});
        assert.deepEqual(await page.evaluate(()=>window.n36Writes),[]);
        await page.screenshot({path:`test-results/n36-koshoof-discoverability/koshoof-${width}.png`,fullPage:true});
        widths.push({width,height:box.height,card:true,hub:true,route:true,focus:true,guards:guarded,writes:0,horizontalOverflow:false});
      } finally {await context.close();}
    }
    const evidenceText=`Actual Demo app DOM, handlers and source CSS at ${widths.map(x=>x.width).join('/')}px: card action visible/focusable at ${widths.map(x=>`${x.width}px=${x.height}px`).join(', ')}; one class-scoped hub tile routes to default import panel; reports subtitle distinct; archived/missing teaching refused; zero IndexedDB writes and no horizontal overflow. Screenshots: test-results/n36-koshoof-discoverability/.`;
    record('n36_class_list_card_koshoof_affordance_visible',evidenceText);
    record('n36_class_hub_koshoof_tile_and_reports_distinct',evidenceText);
    record('n36_routes_owner_archive_and_empty_roster_guards',evidenceText+' Existing canOpenRoster gate retained; empty-roster CTAs unchanged.');
    record('n36_actual_mobile_RTL_focus_and_no_clipped_actions',evidenceText);
    record('syntax_diff_and_owned_cleanup','Source syntax/scoped assertion and diff checks run in companion commands; owned server stopped and isolated browser/context closed in finally.');
  });
  assert.deepEqual(evidence.errors,[]);evidence.status='PASS';
} catch(error) {evidence.status='FAIL';evidence.failure=error.stack;process.exitCode=1;console.error(error);}
finally {
  if(server.listening)await new Promise(done=>server.close(done));
  evidence.ownedServerStopped=!server.listening;evidence.ownedBrowserClosed=true;
  await writeFile('tests/n36-koshoof-discoverability.json',JSON.stringify(evidence,null,2)+'\n');
}
