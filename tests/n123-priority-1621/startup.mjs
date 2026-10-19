// AI-authored bounded before/after actual-app reload and changed-path guards.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { execFileSync } from 'node:child_process';
import { withIsolatedLocalBrowser } from 'file:///C:/Users/Abody/Projects/RakeezX/scripts/ops-supervisor-v4/isolated-local-browser.mjs';
import { fixture, syntheticService, owner } from '../n73-account-flow-fixture.mjs';
import { GenericV2Backend } from '../helpers/generic-v2-backend.mjs';
import { SYNC_V2_SCHEMAS, encodeSyncV2Patch } from '../../src/lib/sync-v2.js';

const taskId = 'continuous-n123-startup-transient-error-20261019';
const runId = '376bb4d1-6dbc-4185-9f38-2c2ddac531df';
const baseSha = '258fbbd57740a14fa75cff31a7e243dcafa4acff';
const baseSource = execFileSync('git', ['show', baseSha + ':src/lib/sync.js'], { encoding: 'utf8' });
const root = resolve('.');
let baseline = process.env.N123_BASELINE === '1', delay = 220;
const service = syntheticService(), backend = new GenericV2Backend();
for (const [name, rows] of Object.entries(fixture())) if (SYNC_V2_SCHEMAS[name]) {
  backend.records[SYNC_V2_SCHEMAS[name].entity] = rows.map(row => ({
    ...encodeSyncV2Patch(name, row), id: row.id, owner_id: owner, revision: 1, deleted_at: null,
  }));
}
const server = createServer(async (req, res) => {
  try {
    const u = new URL(req.url, 'http://127.0.0.1'), pathname = u.pathname;
    res.setHeader('Cache-Control', 'no-store');
    if (pathname === '/__n123/refresh') { await new Promise(done=>setTimeout(done,700)); res.end('{}'); return; }
    if (pathname === '/__n123/auth') { await new Promise(done=>setTimeout(done,100)); res.end('{}'); return; }
    if (pathname.startsWith('/__n73/') || pathname.startsWith('/__n123/')) {
      let body = ''; for await (const part of req) body += part;
      const input = JSON.parse(body || '{}'); let result;
      if (pathname.startsWith('/__n73/')) result = await service.request(pathname.slice(7), input);
      else if (pathname.endsWith('/read')) {
        await new Promise(done => setTimeout(done, delay)); result = await backend.fetchRecords(input.entity);
      } else result = await backend.applySyncV2Mutation(input);
      res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(result)); return;
    }
    const file = resolve(root, pathname === '/' ? 'index.html' : '.' + decodeURIComponent(pathname));
    if (!file.startsWith(root + sep)) throw Error('Outside task root');
    res.setHeader('Content-Type', { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' }[extname(file)] || 'application/octet-stream');
    let content = baseline && pathname === '/src/lib/sync.js' ? baseSource : await readFile(file);
    if (baseline && pathname === '/src/app.js') content = execFileSync('git', ['show', baseSha + ':src/app.js'], {encoding:'utf8'});
    if (pathname === '/') content = String(content).replace("import('./src/lib/app-update.js');",
      "await import('./tests/n123-priority-1621/bootstrap.mjs'); if (!new URL(location.href).searchParams.has('seed')) import('./src/lib/app-update.js');");
    res.end(content);
  } catch (error) { res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ message: error.message })); }
});


const evidence = { taskId, runId, baseSha, checks: [] };
const pause = ms => new Promise(done => setTimeout(done, ms));
try {
 await new Promise(done => server.listen(0, '127.0.0.1', done));
 const url = 'http://127.0.0.1:' + server.address().port;
 await withIsolatedLocalBrowser({taskFile:'C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/'+taskId+'.json',runId,url,timeoutMs:90000},async ({createContext})=>{
  const context=await createContext({viewport:{width:390,height:844}}),page=await context.newPage();
  const failures=[]; page.on('console',msg=>{if(msg.text().includes('Automatic sync failed')) failures.push(msg.text());});
  await page.goto(url+'/?seed=1'); await page.waitForFunction(()=>window.seedReady);
  await page.goto(url+'/#/classes');
  await page.waitForSelector('.layout');
  const states=[];
  const checkpoint = () => page.evaluate(async()=>{
    const sync=await import('/src/lib/sync.js');
    const value=await window.checkpoint();
    return {...value,error:sync.state.lastError,reads:window.probe.reads,
      dots:[...document.querySelectorAll('[data-sync-status]')].map(x=>x.className),
      preparing:sync.getSyncOperationalSummarySnapshot().reasonCategory === 'startup_preparing'};
  });
  let healthy;
  const deadline=Date.now()+15000;
  while(Date.now()<deadline){
    const value=await checkpoint(); states.push({state:value.summary.state,preparing:value.preparing,reads:value.reads,dots:value.dots,error:value.error});
    if(value.summary.cloudSyncHealthy){healthy=value;break;}
    await pause(25);
  }
  assert.ok(healthy,'startup must reach real healthy checkpoint');
  assert.equal(healthy.owner,owner); assert.equal(healthy.workspace.authUserId,owner);
  assert.equal(healthy.score.value,18); assert.equal(healthy.outbox.length,0);
  assert.ok(healthy.summary.lastSuccessfulSyncAt);
  if(baseline){
    assert.ok(states.some(x=>x.dots.some(d=>d.includes('sync-dot--error'))));
    assert.ok(failures.some(x=>x.includes('sync-context-changed')));
    evidence.checks.push({name:'baseline_startup_race_reproduced',status:'PASS',evidence:'Expired synthetic session refresh changed captured session during first pull; real DOM went red, then green after retry.'});
  }else{
    assert.ok(states.some(x=>x.preparing && x.reads===0 && x.dots.some(d=>d.includes('sync-dot--pending'))));
    assert.ok(!states.some(x=>x.dots.some(d=>d.includes('sync-dot--error'))));
    assert.equal(failures.length,0);
    assert.ok(await page.evaluate(()=>document.styleSheets.length > 0),'real application CSS loaded');
    await page.locator('.topbar__teacher-btn[data-act="open-teacher-mini-hub"]').click();
    await page.waitForSelector('.mini-hub-sync .sync-dot--synced');
    // A completed real coordinator failure remains red and actionable, even with retry scheduled.
    await page.evaluate(()=>{window.probe.mode='read-fail';});
    await page.locator('[data-act="mini-hub-sync-now"]').click();
    await page.waitForSelector('.mini-hub-sync .sync-dot--error');
    const failed=await checkpoint();
    assert.equal(failed.summary.cloudSyncHealthy,false); assert.equal(failed.summary.state,'error');
    assert.ok(failed.error.includes('Synthetic read failure'));
    assert.ok(await page.locator('.mini-hub-sync a[href="#/support"]').isVisible());
    // Exercise the real account UI entry with a foreign authenticated identity.
    await page.evaluate(async()=>{const cloud=await import('/src/lib/cloud.js');cloud.setMockAuth({id:'b7300000-0000-4000-8000-000000000002'},{access_token:'synthetic-foreign'});});
    await page.waitForSelector('.mini-hub-sync .sync-dot--blocked');
    const before=await checkpoint();
    await page.locator('[data-act="mini-hub-sync-now"]').click();
    await pause(100);
    const blocked=await checkpoint();
    assert.equal(blocked.reads,before.reads); assert.equal(blocked.summary.cloudSyncHealthy,false);
    assert.equal(blocked.summary.reasonCategory,'workspace_ownership_blocked');
    assert.equal(blocked.score.value,18); assert.equal(blocked.outbox.length,0);
    evidence.checks.push({name:'n123_startup_transient_wait_and_genuine_failure_truthful',status:'PASS',evidence:'Actual 390px app: delayed refresh/lease startup stayed neutral with zero reads during preparation; then true healthy checkpoint. Real manual Sync read failure remained red with support action; foreign-owner manual entry made zero reads and stayed blocked; grade 18 and empty outbox preserved.'});
  }
  evidence.states=states.filter((state,index)=>index===0 || JSON.stringify(state)!==JSON.stringify(states[index-1]));
 });
} catch(error) {evidence.checks.push({name:'scenario',status:'FAIL',evidence:error.stack});process.exitCode=1;}
finally {
 await new Promise(done=>server.close(done));
 evidence.cleanup='Owned fresh contexts/browser and loopback server closed in finally; external requests and Service Workers blocked.';
 await writeFile('tests/n123-priority-1621/'+(baseline?'baseline':'result')+'.json',JSON.stringify(evidence,null,2)+'\n');
 console.log(JSON.stringify(evidence.checks));
}
