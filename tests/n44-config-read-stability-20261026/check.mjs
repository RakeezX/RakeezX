// AI: bounded mounted actual-handler regression over owned loopback HTTP.
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { installNative } from '../n44-confirmed-projection-20261024/runtime.mjs';
import { readFile, writeFile } from 'node:fs/promises';
import { withIsolatedLocalBrowser } from 'file:///C:/Users/Abody/Projects/RakeezX/scripts/ops-supervisor-v4/isolated-local-browser.mjs';
const taskId = 'continuous-n44-config-read-stability-20261026';
const runId = '3f79b806-4902-4a96-b085-ead96b851234';
const dir = 'tests/n44-config-read-stability-20261026', root = process.cwd();
const red = process.argv.includes('--red');
const receipt = { taskId, runId, runtimeSource: red ? 'git:3ab03e8e29901bbda2f81a6d841f0904e364bf15:src/lib/notification-push-runtime.js' : 'worktree', phase: red ? 'red' : 'green', checks: [], realPush: 'NOT_RUN', osArrival: 'NOT_PROVEN' };
receipt.sourceHashes = Object.fromEntries(await Promise.all([
  'src/views/notification-settings.js', 'src/repaint.js', 'src/lib/dom.js',
  'src/store.js', 'src/lib/cloud.js', 'src/lib/notification-events.js',
  'src/lib/notification-push-runtime.js', 'src/styles/notifications.css',
].map(async file => [file, createHash('sha256').update((red && file === 'src/lib/notification-push-runtime.js' ? execFileSync('git', ['show', '3ab03e8e29901bbda2f81a6d841f0904e364bf15:'+file], {encoding:'utf8'}) : await readFile(file, 'utf8')).replace(/\r\n/g, '\n')).digest('hex')])));
const mime = { '.mjs': 'text/javascript', '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const uPath = u => new URL(u, 'http://localhost').pathname;
const server = http.createServer(async (req, res) => {
  const file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
  if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
  try { const data = red && uPath(req.url) === '/src/lib/notification-push-runtime.js' ? execFileSync('git', ['show', '3ab03e8e29901bbda2f81a6d841f0904e364bf15:src/lib/notification-push-runtime.js']) : await readFile(file); res.writeHead(200, { 'content-type': mime[path.extname(file)] ?? 'application/octet-stream' }); res.end(data); }
  catch { res.writeHead(404).end(); }
});
const pass = (name, evidence) => receipt.checks.push({ name, status: 'PASS', evidence });
try {
  await new Promise(ok => server.listen(0, '127.0.0.1', ok));
  const url = `http://127.0.0.1:${server.address().port}/${dir}/host.html`;
  await withIsolatedLocalBrowser({ taskFile: `C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/${taskId}.json`, runId, url, timeoutMs: 120000 }, async ({ createContext }) => {
    const ctx = await createContext({ viewport: { width: 390, height: 844 }, locale: 'ar-SA', timezoneId: 'Asia/Riyadh' });
    await ctx.addInitScript(installNative);
    const page = await ctx.newPage(); page.setDefaultTimeout(10000);
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(url); await page.waitForFunction(() => window.h?.ready);
    for (const mode of [429, 503, 'disabled', 'shape', 'transport']) {
      await page.evaluate(mode => h.start(mode), mode);
      const before = await page.evaluate(() => h.runtime.snapshot());
      if (!red && !await page.locator('[data-n44-support]').evaluate(el=>el.open)) await page.locator('[data-n44-support] > summary').click();
      await page.evaluate(() => h.burst());
      const n = await page.evaluate(() => h.requests);
      receipt.checks.push({ name: 'passive_' + mode, status: n === 1 ? 'PASS' : 'FAIL', evidence: `Actual runtime/gateway settled response + stable focus/store/cloud refresh: ${n} config requests; expected 1.` });
      if (red) { assert.ok(n > 1); continue; }
      assert.equal(n, 1); assert.equal(await page.locator('[data-n44-support]').evaluate(el=>el.open),true,'stable Support stays open'); assert.deepEqual(await page.evaluate(() => h.runtime.snapshot().configOutcome), before.configOutcome);
      assert.equal(await page.evaluate(() => h.effects), 0);
    }
    if (red) return;
    await page.evaluate(() => h.start(429));
    await page.clock.install();
    if (!await page.locator('[data-n44-support]').evaluate(el=>el.open)) await page.locator('[data-n44-support] > summary').click();
    const recheck = page.locator('[data-act="notification-config-recheck"]');
    await recheck.click(); assert.equal(await page.evaluate(() => h.requests), 1);
    assert.match(await page.locator('[data-n44-config-recheck-feedback]').innerText(), /دقيقة/);
    await page.clock.runFor(61000);
    assert.equal(await page.evaluate(() => h.requests), 1, 'no timer retry');
    await page.evaluate(() => { h.mode = 'late'; });
    await recheck.click(); await page.waitForFunction(() => !!h.release);
    assert.equal(await page.evaluate(() => h.requests), 2);
    assert.equal(await page.locator('[data-act="notification-config-recheck"]').isDisabled(), true);
    await page.evaluate(() => { h.runtime.recheckConfiguration(); h.runtime.recheckConfiguration(); h.release(); });
    await page.waitForFunction(() => !h.runtime.snapshot().configRecheckBusy);
    assert.equal(await page.evaluate(() => h.requests), 2);
    await page.clock.resume();
    pass('n44_manual_config_cooldown_context_and_inflight_fences', 'Actual delegated Support action refuses before 60 seconds, no timer retry; one explicit request afterwards, double gesture coalesced while pending.');
    for (const guard of ['token','session','workspace','device','lease','consent','owner','permission']) {
      await page.evaluate(() => h.start('disabled'));
      const n = await page.evaluate(async guard => {
        const before = h.requests, w = h.store.getActiveWorkspace(), d = h.store.state.device;
        if (guard === 'token') { const a = JSON.parse(localStorage.getItem(h.cloud.AUTH_STORAGE_KEY)); a.access_token += '-new'; localStorage.setItem(h.cloud.AUTH_STORAGE_KEY, JSON.stringify(a)); h.cloud.setMockAuth(h.cloud.user, {...h.cloud.session, access_token:a.access_token}); }
        if (guard === 'session') h.cloud.setMockAuth(h.cloud.user, {...h.cloud.session, access_token:'different-actual-session'});
        if (guard === 'workspace') h.store.activateWorkspace({...w, id:w.id+'-new'});
        if (guard === 'device') d.deviceId += '-new';
        if (guard === 'lease') await (await import('/src/lib/offline-lease.js')).runtimeOfflineLease().renew(async id => ({id,verifiedAt:Date.now(),source:'supabase-auth-user'}));
        if (guard === 'consent') localStorage.setItem('rakeezx-n44-consent:'+JSON.stringify([w.authUserId,w.databaseName,d.deviceId]), 'new-consent');
        if (guard === 'owner') { await h.arrange(h.otherOwner); }
        if (guard === 'permission') { Notification.permission = 'denied'; }
        await h.runtime.refresh();
        return h.requests-before;
      },guard);
      assert.equal(n, ['session','workspace'].includes(guard) ? 0 : 1, guard);
      // Invalid cloud/local credential mismatch must not send at all.
      await page.evaluate(async () => { await h.arrange(); Notification.permission='granted'; });
    }
    pass('material_contexts', 'Owner/device/token/lease/consent/permission changes select a new context; missing new workspace lease and cloud/local credential mismatch send zero requests.');
    // Late old context result cannot overwrite a queued material context.
    await page.evaluate(async () => { await h.start('disabled'); h.mode='late'; h.pending=h.runtime.recheckConfiguration(); });
    await page.waitForFunction(() => !!h.release);
    await page.evaluate(async () => { h.store.state.device.deviceId+='-late-new'; h.mode=503; await h.runtime.refresh(); h.release(); await h.pending; });
    await page.waitForFunction(() => h.runtime.snapshot().configOutcome?.httpStatus===503);
    assert.equal(await page.evaluate(() => h.requests), 3);
    assert.equal(await page.evaluate(() => h.effects), 0);
    pass('stale_queued_context', 'In-flight old device result discarded; queued changed device gets exactly one genuine request.');
    for (const guard of ['owner','token','lease','permission','workspace']) {
      await page.evaluate(async()=>{await h.arrange();Notification.permission='granted';await h.start('disabled');h.mode='late';h.pending=h.runtime.recheckConfiguration();});
      await page.waitForFunction(()=>!!h.release);
      await page.evaluate(async guard=>{
        const w=h.store.getActiveWorkspace();h.mode=503;
        if(guard==='owner') await h.arrange(h.otherOwner);
        if(guard==='token') {const a=JSON.parse(localStorage.getItem(h.cloud.AUTH_STORAGE_KEY));a.access_token+='-late';localStorage.setItem(h.cloud.AUTH_STORAGE_KEY,JSON.stringify(a));h.cloud.setMockAuth(h.cloud.user,a);}
        if(guard==='lease') await (await import('/src/lib/offline-lease.js')).runtimeOfflineLease().renew(async id=>({id,verifiedAt:Date.now(),source:'supabase-auth-user'}));
        if(guard==='permission') Notification.permission='denied';
        if(guard==='workspace') h.store.activateWorkspace({...w,id:w.id+'-missing-lease'});
        await h.runtime.refresh();h.release();await h.pending;
      },guard);
      if(guard==='workspace') {assert.equal(await page.evaluate(()=>h.runtime.snapshot().configOutcome),null);assert.equal(await page.evaluate(()=>h.requests),2);}
      else {await page.waitForFunction(()=>h.runtime.snapshot().configOutcome?.httpStatus===503);assert.equal(await page.evaluate(()=>h.requests),3,guard);}
    }
    await page.evaluate(async()=>{await h.arrange();Notification.permission='granted';await h.start(503);});
    pass('late_material_fences', 'Late owner/token/verified lease/permission results discarded and changed context queued once; workspace without valid lease drops receipt and sends zero new requests.');
    for (const [width, theme] of [[390,'light'],[320,'dark']]) {
      await page.setViewportSize({width,height:844});
      await page.evaluate(theme => { document.documentElement.dataset.theme=theme; h.paint(); },theme);
      if (await page.locator('[data-n44-support]').evaluate(el=>el.open)) await page.locator('[data-n44-support] > summary').click();
      assert.equal(await recheck.isVisible(), false);
      await page.locator('[data-n44-support] > summary').click();
      await recheck.focus(); assert.equal(await recheck.evaluate(el=>el===document.activeElement),true);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
      await page.screenshot({path:`${dir}/${width}-${theme}.png`,fullPage:true});
    }
    await page.evaluate(async () => { Notification.permission='default'; await h.bindingSetup(); Notification.requestPermission=async()=>{h.prompts=(h.prompts??0)+1;Notification.permission='granted';return 'granted';}; });
    await page.locator('[data-act="notification-push"]').click();
    await page.waitForFunction(()=>h.runtime.snapshot().status==='subscribed');
    assert.equal(await page.evaluate(()=>h.prompts),1,'explicit opt-in grant still registers');
    const subscribed=await page.evaluate(()=>({calls:h.calls.length,config:h.calls.filter(x=>x.endsWith('/push/config')).length}));
    await page.evaluate(async()=>{await h.runtime.recheckConfiguration();await h.burst();});
    assert.equal(await page.evaluate(()=>h.calls.length),subscribed.calls);
    // Same Auth-session token continuation verifies context once, no config read.
    await page.evaluate(async()=>{h.rotate('second');await h.runtime.refresh();});
    assert.equal(await page.evaluate(()=>h.runtime.snapshot().status),'subscribed');
    assert.equal(await page.evaluate(()=>h.calls.filter(x=>x.endsWith('/push/config')).length),subscribed.config);
    await page.evaluate(async()=>{
      h.oldRuntime=h.runtime;const send=h.send;h.failConfig=true;
      h.send=async(url,init)=>{if(h.failConfig&&url.endsWith('/push/config')){h.calls.push(url);return Response.json({}, {status:503});}return send(url,init);};
      await h.createBinding();h.failConfig=false;h.extraRuntime=h.runtime;
    });
    const savedCalls=await page.evaluate(()=>h.calls.filter(x=>/register|revoke|update/.test(x)).length);
    const savedBinding=await page.evaluate(()=>n44Native.binding);
    await page.evaluate(()=>h.runtime.recheckConfiguration());
    assert.equal(await page.evaluate(()=>h.calls.filter(x=>/register|revoke|update/.test(x)).length),savedCalls,'manual read cannot restore/register/retire saved binding');
    assert.equal(await page.evaluate(()=>n44Native.binding),savedBinding);
    await page.evaluate(()=>h.createBinding());
    assert.equal(await page.evaluate(()=>h.runtime.snapshot().status),'subscribed','registration restored');
    await page.evaluate(()=>{h.failStop=true;});
    await page.locator('[data-act="notification-push"]').click();
    await page.waitForFunction(()=>h.runtime.snapshot().cleanupAvailable&&!h.runtime.snapshot().cleanupBusy);
    const stopCalls=await page.evaluate(()=>h.calls.length);
    await page.evaluate(async()=>{await h.runtime.recheckConfiguration();await h.runtime.refresh();});
    assert.equal(await page.evaluate(()=>h.calls.length),stopCalls,'manual readiness cannot bypass pending Stop');
    await page.evaluate(()=>{h.failStop=false;});
    await page.locator('[data-act="notification-push"]').click();
    await page.waitForFunction(()=>!h.runtime.snapshot().cleanupAvailable);
    assert.equal(await page.evaluate(()=>h.remote.pushConsent),false);
    await page.evaluate(async()=>{await h.oldRuntime.dispose();await h.extraRuntime.dispose();});
    await page.evaluate(()=>h.bindingSetup());
    await page.clock.install();await page.clock.setSystemTime(Date.now()+2*3600000);
    await page.evaluate(()=>h.runtime.refresh());
    assert.equal(await page.evaluate(()=>h.runtime.snapshot().available),false,'expired service/session fails closed');
    await page.clock.resume();
    pass('binding_continuation_restore_stop', 'Actual runtime/client/gateway + synthetic browser ports: explicit opt-in permission grant still registers; expired context fails closed; valid binding ignores manual/passive recheck; same Auth-session token continuation uses context read without config; registration restores; failed Stop blocks recheck until explicit cleanup succeeds.');
    // View-only deferred readiness port isolates the new handler's unmount fence.
    await page.evaluate(async()=>{
      const m=await import('/src/lib/notification-push-runtime.js');
      m.setPushRuntime({...h.runtime,snapshot:()=>({...h.runtime.snapshot(),configRecheckAvailable:true,configRecheckBusy:false}),recheckConfiguration:()=>new Promise(ok=>h.resolveManual=ok)});h.paint();
    });
    if(!await page.locator('[data-n44-support]').evaluate(el=>el.open)) await page.locator('[data-n44-support] > summary').click();
    await recheck.click();
    const unmounted=await page.evaluate(()=>{h.unmount();const n=h.paints;h.resolveManual({status:'checked'});return n;});
    await page.waitForTimeout(30);assert.equal(await page.evaluate(()=>h.paints),unmounted);assert.equal(await page.locator('#main').innerText(),'Other route');
    pass('manual_unmount', 'Actual delegated readiness handler cannot repaint a new route after its deferred view-only port resolves.');
    assert.deepEqual(errors,[]);
    pass('n44_config_stability_preserves_binding_cleanup_receipt_and_ui', 'Actual settings DOM/handlers/CSS at 390/320: one closed Support by default, explicit keyboard-accessible readiness button, finite diagnostic preserved, no overflow/no automatic permission or registration. Existing binding/Stop/device receipt focused regressions run separately.');
    await page.evaluate(async () => { h.view.onUnmount(); await h.runtime.dispose(); h.store.deactivateWorkspace('owned-test-cleanup'); });
  });
} catch (e) { receipt.error = e.stack; process.exitCode = 1; }
finally { await new Promise(ok => server.close(ok)); await writeFile(`${dir}/${red ? 'red' : 'green'}.json`, JSON.stringify(receipt, null, 2) + '\n'); }
console.log(JSON.stringify(receipt, null, 2));
