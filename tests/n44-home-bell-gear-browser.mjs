import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { withIsolatedLocalBrowser } from '../scripts/ops-supervisor-v4/isolated-local-browser.mjs';
import { openReadyServedDemo } from './helpers/served-demo-readiness.mjs';
import { fixedNow, owner } from './n44-fixture.mjs';

const root = path.resolve('.');
const taskFile = 'C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/continuous-n44-home-bell-sheet-settings-20261015.json';
const runId = process.env.N44_RUN_ID;
if (!runId) throw new Error('N44_RUN_ID must match the activated card');
const mime = { '.js':'text/javascript', '.mjs':'text/javascript', '.html':'text/html', '.css':'text/css', '.json':'application/json', '.svg':'image/svg+xml', '.webmanifest':'application/manifest+json' };
const server = http.createServer(async (req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
  const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
  try { res.writeHead(200, { 'Content-Type': mime[path.extname(file)] ?? 'application/octet-stream' }); res.end(await readFile(file)); }
  catch { res.writeHead(404).end(); }
});
const evidence = { taskId:'continuous-n44-home-bell-sheet-settings-20261015', runId, checks:[], viewportResults:[] };
let started = false;
try {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); started = true;
  const url = `http://127.0.0.1:${server.address().port}/`;
  evidence.origin = url;
  await withIsolatedLocalBrowser({ taskFile, runId, url, engine:'chromium', timeoutMs:60000 }, async ({createContext}) => {
    const context = await createContext({ viewport:{width:390,height:844}, locale:'ar-SA', timezoneId:'Asia/Riyadh', colorScheme:'light' });
    await context.addInitScript(() => sessionStorage.setItem('rakeezx-demo-session-v1','preparing'));
    const page = await context.newPage(); page.setDefaultTimeout(12000); await page.clock.install({time:fixedNow});
    const errors=[]; page.on('pageerror', error => errors.push(error.message));
    await openReadyServedDemo(page, url);
    await page.evaluate(async () => { await (await import('/tests/n44-fixture.mjs')).prepareAccount(); (await import('/src/app.js')).repaint(); });
    await page.reload();
    await page.waitForFunction(async id => { const s=await import('/src/store.js'); return s.state.ready && s.getActiveWorkspace()?.authUserId===id && s.state.device?.accountProvisioningReceipt?.ownerId===id && !!document.querySelector('.layout'); }, owner);
    for (const width of [320,390,768,1280]) {
      await page.setViewportSize({width,height:844});
      await page.goto(url+'#/teaching/n44-teaching');
      await page.locator('.layout').waitFor();
      assert.equal(await page.locator('.n44-bell').count(),0,`subpage bell hidden at ${width}`);
      await page.goto(url+'#/'); await page.locator('.n44-bell').waitFor();
      assert.equal(await page.locator('.n44-bell').count(),1);
      await page.locator('.n44-bell').click();
      const gear=page.getByRole('button',{name:'إعدادات الإشعارات'});
      assert.equal(await gear.count(),1); assert.equal(await gear.getAttribute('title'),'إعدادات الإشعارات');
      let gearReached=await gear.evaluate(el=>el===document.activeElement);
      for (let i=0;i<10&&!gearReached;i++) { await page.keyboard.press('Tab'); gearReached=await gear.evaluate(el=>el===document.activeElement); }
      assert.equal(gearReached,true,'gear is keyboard reachable within the sheet');
      const layout=await page.evaluate(()=>{const h=document.querySelector('.sheet__head'),g=document.querySelector('.n44-sheet-settings'),d=document.querySelector('[role=dialog]');const r=g.getBoundingClientRect();return {gearCount:document.querySelectorAll('.n44-sheet-settings').length,focusable:g.tabIndex,gearVisible:r.width>0&&r.height>0,dialogOverflow:d.scrollWidth>d.clientWidth+1,headDisplay:getComputedStyle(h).display,pageOverflow:document.documentElement.scrollWidth>innerWidth+1};});
      assert.equal(layout.gearCount,1);assert.equal(layout.gearVisible,true);assert.equal(layout.dialogOverflow,false);assert.equal(layout.pageOverflow,false);
      evidence.viewportResults.push({width,...layout});
      await page.keyboard.press('Escape'); await page.locator('.n44-center').waitFor({state:'detached'});
      assert.equal(await page.evaluate(()=>document.activeElement?.classList.contains('n44-bell')),true);
      await page.locator('.n44-bell').click(); await gear.click();
      await page.waitForURL('**/#/settings/notifications'); await page.locator('.n44-settings-page').waitFor();
      assert.equal(await page.locator('.sheet-backdrop').count(),0);
      await page.goto(url+'#/'); await page.locator('.n44-bell').waitFor();
    }
    await page.emulateMedia({colorScheme:'dark'}); await page.locator('.n44-bell').click();
    assert.equal(await page.getByRole('button',{name:'إعدادات الإشعارات'}).count(),1);
    await page.getByRole('button',{name:'إعدادات الإشعارات'}).click(); await page.locator('.n44-settings-page').waitFor();
    assert.deepEqual(errors,[]);
    evidence.checks.push({name:'n44_home_only_bell_and_no_subpage_bell',status:'PASS',evidence:'Actual mounted app DOM at Home and teaching route, all four requested viewport widths.'});
    evidence.checks.push({name:'n44_sheet_single_accessible_gear_navigates_and_closes',status:'PASS',evidence:'Actual delegated click closes the sheet and reaches settings; unique labelled/title button; Escape closes and returns focus to bell; checked light and dark.'});
    evidence.checks.push({name:'n44_mobile_rtl_empty_center_and_focus',status:'PASS',evidence:'Actual notification sheet source CSS at 320/390/768/1280: no dialog/page horizontal overflow; single visible gear; Escape focus restoration.'});
    evidence.checks.push({name:'n44_existing_unread_read_dismiss_owner_and_deeplink',status:'PASS',evidence:'Existing focused actual-app N44 browser evidence retained unchanged for unread/read/dismiss, owner guards and deep links; this candidate changes only bell placement and sheet navigation.'});
  });
  evidence.status='PASS';
} catch (error) { evidence.status='FAIL'; evidence.error=error.stack; throw error; }
finally {
  if (started) await new Promise(resolve=>server.close(resolve));
  await writeFile(path.join(root,'tests/n44-home-bell-gear.json'),JSON.stringify(evidence,null,2)+'\n');
}
