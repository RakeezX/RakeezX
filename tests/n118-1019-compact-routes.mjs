import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { withIsolatedLocalBrowser } from 'file:///C:/Users/Abody/Projects/RakeezX/scripts/ops-supervisor-v4/isolated-local-browser.mjs';
import { openReadyServedDemo } from './helpers/served-demo-readiness.mjs';
import { syntheticService } from './n73-account-flow-fixture.mjs';
import { match, teachingRouteId } from '../src/router.js';

const taskId='continuous-n118-compact-compatible-class-routes-20261019';
const runId=process.env.N118_RUN_ID;
if(!runId) throw Error('N118_RUN_ID must identify the active attempt');
const id='tch:sec:12345678-1234-4234-8234-123456789abc|sub:digital-skills|tm:y:1448-1449:1';
const compact=teachingRouteId(id), legacy='/teaching/'+id, short='/teaching/'+compact;
const checks=[], root=resolve('.'), service=syntheticService();
const replacements={'n73-source':id,'n73-source-section':'sec:12345678-1234-4234-8234-123456789abc','n73-subject':'sub:digital-skills','n73-year':'y:1448-1449','n73-term':'tm:y:1448-1449:1'};
for(const rows of Object.values(service.current)) for(const row of rows) for(const [key,value] of Object.entries(row)) if(replacements[value]) row[key]=replacements[value];
// A real roster and immutable historical marker; no operation under test writes data.
service.current.enrollments=[1,2].map(n=>({id:'n118-enrollment-'+n,studentId:'n73-student'+n,sectionId:replacements['n73-source-section'],startDate:'2020-01-01',endDate:null,status:'active',deleted:false,ownerId:service.current.teachings[0].ownerId,serverRevision:1}));
service.current.closedTermReports=[{id:'n118-history',termId:'old-term',payload:{sentinel:'preserve'},deleted:false,serverRevision:1}];
for(const suffix of ['', '/quicklog','/students','/attendance?session=synthetic-session&date=2026-10-19']) {
  assert.deepEqual(match(short+suffix).params,match(legacy+suffix).params);
  assert.deepEqual(match(short+suffix).params,match('/teaching/'+encodeURIComponent(id)+suffix).params);
}
for(const other of [id.replace(':1',':2'),id.replace('1448-1449','1447-1448'),id.replace('digital-skills','math')]) {
  assert.notEqual(teachingRouteId(other),compact);
  assert.equal(match('/teaching/'+teachingRouteId(other)).params.id,other);
}
for(const other of ['n73-target','demo:teaching:1','old id/with slash','tch:sec:UPPER|sub:x|tm:y:1448-1449:1']) assert.equal(match('/teaching/'+teachingRouteId(other)).params.id,other);
assert.ok(short.length<legacy.length);
checks.push({name:'lossless_identity_alias_context',status:'PASS',evidence:`${legacy.length} to ${short.length} path characters; raw/encoded legacy aliases and compact routes preserve full identity, suffix, session/date query; other term/year/subject remain distinct; unknown IDs round-trip.`});
const server=createServer(async(req,res)=>{
  try {
    const pathname=new URL(req.url,'http://127.0.0.1').pathname;
    if(pathname.startsWith('/__n73/')) {
      let body=''; for await(const part of req)body+=part;
      res.setHeader('Content-Type','application/json');
      res.end(JSON.stringify(await service.request(pathname.slice(7),JSON.parse(body||'{}')))); return;
    }
    const file=resolve(root,pathname==='/'?'index.html':'.'+decodeURIComponent(pathname));
    if(!file.startsWith(root+sep)) throw Error('Outside task root');
    res.setHeader('Content-Type',{'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2'}[extname(file)]??'application/octet-stream');
    res.end(await readFile(file));
  }catch(error){res.writeHead(404);res.end(error.message);}
});
const snapshot=page=>page.evaluate(async()=>{const db=await import('/src/lib/db.js');return Object.fromEntries(await Promise.all(db.STORES.filter(n=>n!=='device').map(async name=>[name,await db.getAll(name)])));});
let failure;
try {
  await new Promise(done=>server.listen(0,'127.0.0.1',done));
  const url='http://127.0.0.1:'+server.address().port;
  await withIsolatedLocalBrowser({taskFile:'C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/'+taskId+'.json',runId,url,timeoutMs:90000},async({createContext})=>{
    const context=await createContext({viewport:{width:390,height:844},locale:'ar-SA'});
    await context.addInitScript(()=>sessionStorage.setItem('rakeezx-demo-session-v1','preparing'));
    const page=await context.newPage();
    await openReadyServedDemo(page,url);
    await page.evaluate(async()=>{await (await import('/tests/n36-receiver-fixture.mjs')).prepareNamesAccount(); (await import('/src/repaint.js')).repaint();});
    const before=await snapshot(page);
    await page.locator(`.class-card__main[href="#${short}"]`).click();
    await page.locator('.class-hub').waitFor();
    assert.equal(new URL(page.url()).hash,'#'+short);
    assert.equal(await page.evaluate(()=>getComputedStyle(document.querySelector('.class-hub-header')).display),'flex');
    const link=page.locator('.class-tool-card[href$="/quicklog"]');
    assert.equal(await link.getAttribute('href'),'#'+short+'/quicklog');
    await link.click();
    await page.locator('[data-act="plus"]').first().waitFor();
    assert.equal(new URL(page.url()).hash,'#'+short+'/quicklog');
    assert.equal(await page.evaluate(async()=> (await import('/src/router.js')).match().params.id),id);
    await page.goBack(); await page.locator('.class-hub').waitFor();
    await page.goForward(); await page.locator('[data-act="plus"]').first().waitFor();
    // Explicit app Back uses the same navigation metadata as native history.
    assert.equal(await page.evaluate(async()=> (await import('/src/router.js')).backWithinApp('/classes')),'history');
    await page.locator('.class-hub').waitFor();
    for(const route of [legacy, '/teaching/'+encodeURIComponent(id),short]) {
      await page.evaluate(route=>{location.hash=route;},route);
      await page.waitForFunction(expected=>location.hash==='#'+expected,route);
      await page.locator('.class-hub').waitFor();
      assert.equal(await page.evaluate(async()=> (await import('/src/store.js')).assertClassOperationsAccess((await import('/src/router.js')).match().params.id).id),id);
    }
    await page.locator('[data-act="switch-class"]').click();
    assert.equal(await page.locator('.class-switcher-option.is-current').getAttribute('href'),'#'+short);
    await page.locator('.class-switcher-option:not(.is-current)').first().click();
    await page.waitForFunction(()=>!document.querySelector('.sheet'));
    await page.evaluate(async path=>{(await import('/src/router.js')).go(path);},legacy+'/students');
    await page.locator('[data-act="add"]').first().waitFor();
    assert.equal(new URL(page.url()).hash,'#'+short+'/students');
    assert.deepEqual(await snapshot(page),before,'Navigation must preserve persisted product data, grades, history, tombstones and outbox');
    checks.push({name:'n118_compact_route_same_owner_context_legacy_links_preserved',status:'PASS',evidence:'Actual application DOM/handlers/source CSS over task-owned HTTP in fresh isolated mobile context; synthetic account fixture with real store/access guard. Class card → hub → Quicklog, native Back/Forward, app Back, raw/encoded legacy deep links, compact links, class switcher, and go() → Students resolve the original identity. Persisted product stores unchanged (device preferences excluded).'});
    // Keep the production ownership guard: foreign section in the mounted synthetic account.
    await page.evaluate(async()=>{const s=await import('/src/store.js');s.getSection(s.getTeaching((await import('/src/router.js')).match().params.id).sectionId).ownerId='foreign-owner';(await import('/src/repaint.js')).repaint();});
    await page.locator('[data-class-access-status="ownership"]').waitFor();
    assert.equal(await page.locator('[data-act="add"]').count(),0);
    assert.deepEqual(await snapshot(page),before);
    checks.push({name:'compact_route_foreign_owner_denied',status:'PASS',evidence:'Real Students UI access guard rejects foreign-owned synthetic section, removes add controls, leaves all persisted product stores unchanged; no live service calls or mutations.'});
    await context.close();
  });
}catch(error){failure=error; checks.push({name:'affected_browser_check',status:'FAIL',evidence:error.stack});}
finally{await new Promise(done=>server.close(done));}
await writeFile('tests/n118-1019-compact-routes.json',JSON.stringify({taskId,runId,checks},null,2)+'\n');
console.log(JSON.stringify(checks,null,2));
if(failure)throw failure;
