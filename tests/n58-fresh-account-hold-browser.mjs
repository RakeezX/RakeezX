import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { withIsolatedLocalBrowser } from '../../../scripts/ops-supervisor-v4/isolated-local-browser.mjs';
import { openReadyServedDemo } from './helpers/served-demo-readiness.mjs';

const taskFile = 'C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/continuous-n58-fresh-account-calendar-foundation-20261014.json';
const runId = process.env.N58_RUN_ID || 'ba07cfbe-1861-4a6b-a4b1-2137ec432a26';
const server = await createServer({ server: { host: '127.0.0.1', port: 4197, strictPort: true }, logLevel: 'error' });
const url = 'http://127.0.0.1:4197';
const message = 'تغيير التقويم متوقف مؤقتًا لمعالجة المزامنة. يمكنك متابعة العمل بالتقويم الحالي.';
const snapshot = page => page.evaluate(async () => {
  const s = await import('/src/store.js'), db = await import('/src/lib/db.js');
  const names = ['years', 'terms', 'calendars', 'calendarDays', 'outbox', 'device', 'profile', 'sections'];
  return { persisted: Object.fromEntries(await Promise.all(names.map(async name => [name, await db.getAll(name)]))),
    memory: JSON.parse(JSON.stringify({ years:s.state.years, terms:s.state.terms, calendars:s.state.calendars,
      days:s.state.calendarDays, device:s.state.device, profile:s.state.profile })) };
});

async function checkUI(page, selected) {
  await page.goto(url + '/#/calendar');
  await page.getByRole('button', { name: 'إعدادات التقويم والمنطقة', exact: true }).click();
  const cards = page.locator('[data-act="set-region"]');
  assert.ok(await cards.count() >= 2);
  assert.equal(await page.locator('#calendar-switch-hold').innerText(), message);
  assert.equal(await cards.evaluateAll(nodes => nodes.every(n => n.disabled && n.getAttribute('aria-disabled') === 'true' &&
    getComputedStyle(n).cursor === 'not-allowed' && Number(getComputedStyle(n).opacity) < 1)), true);
  assert.equal(await page.locator('[data-act="set-region"][aria-pressed="true"]').getAttribute('data-id'), selected);
  const before = await snapshot(page);
  // Native mouse and keyboard cannot change disabled cards.
  const target = page.locator('[data-act="set-region"]:not([aria-pressed="true"])').first();
  const box = await target.boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await target.evaluate(n => n.focus());
  await page.keyboard.press('Enter'); await page.keyboard.press('Space');
  assert.deepEqual(await snapshot(page), before);
  // Simulate a stale enabled sheet retaining its actual current click handler.
  await target.evaluate(n => { n.disabled = false; n.click(); });
  assert.equal(await page.locator('#toast').innerText(), message);
  assert.equal(await page.locator('#toast').evaluate(n => n.classList.contains('is-info')), true);
  assert.deepEqual(await snapshot(page), before);
  assert.equal(await page.locator('[data-act="set-region"][aria-pressed="true"]').getAttribute('data-id'), selected);
  assert.equal(await page.getByRole('dialog').count(), 1);
  await page.getByRole('dialog').getByRole('button', { name:'السنوات', exact:true }).click();
  assert.equal(await page.getByRole('button', { name:'سنة جديدة', exact:true }).isEnabled(), true);
  await page.getByRole('dialog').getByRole('button', { name:'الفصول', exact:true }).click();
  assert.equal(await page.locator('[data-act="edit-term-in-settings"]').first().isEnabled(), true);
  await page.getByRole('dialog').getByRole('button', { name:'تم', exact:true }).click();
}

try {
  await server.listen();
  await withIsolatedLocalBrowser({ taskFile, runId, url, timeoutMs:120000 }, async ({ createContext }) => {
    for (const kind of ['demo', 'fresh', 'established']) {
      const context = await createContext({ locale:'ar-SA', viewport:{width:390,height:844} });
      const page = await context.newPage();
      await page.addInitScript(() => sessionStorage.setItem('rakeezx-demo-session-v1', 'preparing'));
      await openReadyServedDemo(page, url);
      let selected = 'sa-western-1448-1449';
      if (kind !== 'demo') {
        const ready = await page.evaluate(async kind => {
          const s = await import('/src/store.js'), db = await import('/src/lib/db.js'), c = await import('/src/lib/cloud.js');
          const { runtimeOfflineLease } = await import('/src/lib/offline-lease.js');
          const { accountWorkspaceDatabaseName } = await import('/src/lib/workspaces.js');
          const p = await import('/src/lib/calendar-presets.js');
          const owner = kind === 'fresh' ? 'a5800000-0000-4000-8000-000000000001' : 'a5800000-0000-4000-8000-000000000002';
          s.deactivateWorkspace('n58-synthetic-only');
          const session = { access_token:'synthetic-local-only', user:{id:owner}, expires_at:Math.floor(Date.now()/1000)+3600 };
          localStorage.setItem(c.AUTH_STORAGE_KEY, JSON.stringify(session)); c.setMockAuth(session.user, session);
          c.setMockBackend({ async fetchRecords(){ return []; }, async applySyncV2(){ throw Error('N58 must not dispatch'); } });
          const workspace = { id:'account:n58-'+kind, type:'account', authUserId:owner, ownershipState:'claimed', syncEligible:true,
            databaseName:await accountWorkspaceDatabaseName(owner), broadcastChannelName:'n58-'+kind,
            leaseGeneration:JSON.stringify([owner,null,null,null]) };
          s.activateWorkspace(workspace);
          await runtimeOfflineLease().renew(async () => ({id:owner,source:'supabase-auth-user',verifiedAt:Date.now()}));
          await s.init();
          const bootPreset = s.activeYear().calendarPresetId;
          if (kind === 'established') {
            // Restore a legitimate General selection via fixture storage, never switch command.
            const records = p.calendarPresetRecords(p.getCalendarPreset(p.GENERAL_1448_1449_PRESET_ID));
            await db.clearStore('calendars'); await db.clearStore('calendarDays');
            await db.putAcross({years:[records.year],terms:records.terms,calendars:[records.calendar],calendarDays:records.calendarDays,
              sections:[{id:'n58-existing-class',yearId:records.year.id,grade:4,label:'أ',status:'active',archivedAt:null,archiveDate:null}],
              device:[{...s.state.device,preferredEducationRegion:records.year.calendarPresetId}]});
          }
          await db.put('profile',{...s.state.profile,name:'N58 synthetic',phone:'0500000000'});
          // Exactly 1 rejected + 63 dependent blocked sentinels: no replay/disposition.
          await db.clearStore('outbox');
          await db.putMany('outbox',Array.from({length:64},(_,i)=>({id:'n58-held-'+i,ownerId:owner,state:i?'blocked':'rejected',
            reason:i?'dependency-blocked':'unclassified',dependsOn:i?['n58-held-0']:[],updatedAt:1})));
          await s.init();
          return {bootPreset, selected:s.activeYear().calendarPresetId, owner:s.getActiveWorkspace().authUserId,
            editable:s.getOfflineLeaseStatus().editable, classes:s.state.sections.length};
        }, kind);
        assert.equal(ready.bootPreset, 'sa-western-1448-1449'); assert.equal(ready.editable, true);
        assert.equal(ready.classes, kind === 'fresh' ? 0 : 1);
        selected = ready.selected;
      }
      await page.evaluate(() => {
        window.n58Writes = [];
        for (const name of ['put','add','delete','clear']) {
          const original = IDBObjectStore.prototype[name];
          IDBObjectStore.prototype[name] = function (...args) {
            window.n58Writes.push({store:this.name,method:name});
            return original.apply(this,args);
          };
        }
      });
      await checkUI(page, selected);
      const before = await snapshot(page);
      const result = await page.evaluate(async () => {
        const s = await import('/src/store.js'), p = await import('/src/lib/calendar-presets.js');
        const current = s.activeYear().calendarPresetId;
        const other = current === p.GENERAL_1448_1449_PRESET_ID ? p.WESTERN_1448_1449_PRESET_ID : p.GENERAL_1448_1449_PRESET_ID;
        const denied = await s.applyCalendarPreset(other, {activate:true});
        const same = await s.applyCalendarPreset(current, {activate:true});
        return {denied,same:{ok:same.ok,applied:same.applied},ranges:s.calendarRangesOf().length,valid:(await import('/src/views/calendar.js')).hasValidYearCalendarConfig(s.activeYear().id)};
      });
      assert.equal(result.denied.reason,'calendar-switch-temporary-hold');
      assert.deepEqual(result.same,{ok:true,applied:0}); assert.ok(result.ranges > 0); assert.equal(result.valid,true);
      assert.deepEqual(await snapshot(page), before);
      if (kind !== 'demo') {
        // Reinitialization reads the saved selection without applying a preset.
        await page.evaluate(async () => (await import('/src/store.js')).init());
        assert.deepEqual(await snapshot(page), before);
      }
      assert.equal(await page.locator('link[href*="calendar-work-0417.css"]').count(),1);
      assert.deepEqual(await page.evaluate(() => window.n58Writes), [], 'no IndexedDB mutation call, including same-value writes');
      console.log('PASS '+kind+': actual UI disabled; stale handler/direct change/same apply issue zero IDB writes; data/device unchanged'+(kind==='demo'?'':'; 1 rejected + 63 blocked unchanged')+'; boot/read/planning preserved');
      await context.close();
    }
  });
  console.log('PASS n58_calendar_switch_disabled_actual_ui; PASS n58_calendar_hold_no_mutation; PASS n58_default_boot_and_existing_calendar_read');
} finally { await server.close(); }
