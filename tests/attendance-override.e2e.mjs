import { test, expect } from '@playwright/test';
import { createAttendanceServer } from './helpers/attendance-server-fixture.mjs';

test.use({...(process.env.RAKEEZX_ATTENDANCE_TEST_URL ? {baseURL:process.env.RAKEEZX_ATTENDANCE_TEST_URL} : {})});

const STORES = ['profile','years','terms','subjects','sections','teachings','students','enrollments','sessions'];
const route = '/#/teaching/override-teaching/attendance?session=override-session';

async function installEngine(page) {
  await page.waitForFunction(() => window.store?.state.ready);
  await page.evaluate(async () => {
    const database = await import('/src/lib/db.js');
    const { createSyncV2Engine } = await import('/src/lib/sync-v2.js');
    window.attendanceTestEngine = createSyncV2Engine({ database, transport: {
      fetchRecords: (entity) => window.attendanceTestRpc({ method:'fetchRecords',args:entity }),
      applyFillAttendanceCommand: (args) => window.attendanceTestRpc({ method:'applyFillAttendanceCommand',args }),
      applyAttendanceCommand: (args) => window.attendanceTestRpc({ method:'applyAttendanceCommand',args }),
    } });
  });
}

async function setupPage(page, server, onFill = async (receipt) => receipt) {
  // All server calls go to isolated PostgreSQL in this test process.
  await page.route('**/*.supabase.co/**', (request) => request.abort('blockedbyclient'));
  await page.exposeFunction('attendanceTestRpc', async ({method,args}) => {
    if (method === 'applyFillAttendanceCommand') return onFill(await server[method](args));
    return server[method](args);
  });
  const records = Object.fromEntries(await Promise.all(STORES.map(async (name) => [name,await server.fetchRecords(name)])));
  await page.goto('/');
  await page.waitForFunction(() => window.store?.state.ready);
  await page.evaluate(async (records) => {
    const db = await import('/src/lib/db.js');
    const { decodeSyncV2Canonical } = await import('/src/lib/sync-v2.js');
    await window.store.save(Object.fromEntries(Object.entries(records).map(([name,rows]) =>
      [name,rows.map((row) => decodeSyncV2Canonical(name,row))])), {queue:false});
    await window.store.patchDevice({activeYearId:'override-year',activeTermId:'override-term'});
    await db.clearStore('outbox'); // only this fresh, synthetic browser context.
  }, records);
  await installEngine(page);
  await page.goto(route);
  await expect(page.locator('.att-row')).toHaveCount(3);
}

async function expectStates(page, states) {
  for (const [studentId,status] of Object.entries(states)) {
    await expect(page.locator(`[data-act="set"][data-id="${studentId}"][data-status="${status}"]`)).toHaveClass(/is-on/);
  }
}

for (const [label,width] of [['desktop',1280],['mobile',390]]) {
  test(`attendance explicit overrides survive delayed Sync, rerender, reload and second device — ${label}`, async ({page,browser}) => {
    test.setTimeout(60000);
    await page.setViewportSize({width,height:850});
    const errors=[];
    page.on('pageerror',(error)=>errors.push(error.message));
    page.on('console',(message)=>{if(message.type()==='error')errors.push(message.text());});
    const server=await createAttendanceServer();
    const other=await browser.newContext({viewport:{width:390,height:850}});
    try {
      let release;
      let committed;
      const released=new Promise((resolve)=>{release=resolve;});
      const filled=new Promise((resolve)=>{committed=resolve;});
      await setupPage(page,server,async(receipt)=>{committed();await released;return receipt;});
      await page.locator('[data-act="fill-present"]').click();
      await expectStates(page,{'override-a':'present','override-b':'present','override-c':'present'});
      await page.evaluate(()=>{window.attendanceTestDispatch=window.attendanceTestEngine.dispatchPending({maxMutations:1});});
      await filled;
      await page.locator('[data-act="set"][data-id="override-a"][data-status="absent"]').click();
      await page.locator('[data-act="set"][data-id="override-b"][data-status="excused"]').click();
      const expected={'override-a':'absent','override-b':'excused','override-c':'present'};
      await expectStates(page,expected);
      release();
      const bulk=await page.evaluate(async()=>{const result=await window.attendanceTestDispatch;await window.store.refreshSyncedState();window.store.repaint();return result;});
      expect(bulk.acknowledged).toBe(1);
      await expectStates(page,expected);
      await page.reload();
      await installEngine(page);
      await expectStates(page,expected);
      await page.evaluate(async()=>{await window.attendanceTestEngine.pullAll({stores:['attendance','sessionRosterSnapshots']});await window.store.refreshSyncedState();});
      await expectStates(page,expected);
      const pushed=await page.evaluate(async()=>{const result=await window.attendanceTestEngine.dispatchPending();await window.store.refreshSyncedState();
        const db=await import('/src/lib/db.js');return {result,pending:(await db.getAll('outbox')).map(({store,op,command,lastError})=>({store,op,command,lastError}))};});
      expect(pushed.result,JSON.stringify(pushed.pending)).toMatchObject({acknowledged:2,failed:0,blocked:0});
      await expectStates(page,expected);
      const pageB=await other.newPage();
      pageB.on('pageerror',(error)=>errors.push(error.message));
      pageB.on('console',(message)=>{if(message.type()==='error')errors.push(message.text());});
      await setupPage(pageB,server);
      await pageB.evaluate(async()=>{await window.attendanceTestEngine.pullAll({stores:['attendance','sessionRosterSnapshots']});await window.store.refreshSyncedState();});
      await expectStates(pageB,expected);
      await pageB.reload();
      await expectStates(pageB,expected);
      for (const device of [page,pageB]) {
        expect(await device.evaluate(async()=>{
          const db=await import('/src/lib/db.js');
          const rows=(await db.getAll('attendance')).filter((row)=>row.sessionId==='override-session'&&!row.deleted);
          return {count:rows.length,unique:new Set(rows.map((row)=>row.studentId)).size,statuses:rows.sort((a,b)=>a.studentId.localeCompare(b.studentId)).map((row)=>row.status)};
        })).toEqual({count:3,unique:3,statuses:['absent','excused','present']});
      }
      // A new explicit user edit may intentionally undo a prior override.
      await page.locator('[data-act="set"][data-id="override-a"][data-status="present"]').click();
      await expectStates(page,{'override-a':'present','override-b':'excused','override-c':'present'});
      await page.evaluate(async()=>{await window.attendanceTestEngine.dispatchPending();await window.store.refreshSyncedState();});
      await installEngine(pageB);
      await pageB.evaluate(async()=>{await window.attendanceTestEngine.pullAll({stores:['attendance']});await window.store.refreshSyncedState();});
      await expectStates(pageB,{'override-a':'present','override-b':'excused','override-c':'present'});
      expect((await server.fetchRecords('session_roster_snapshots')).length).toBe(1);
      expect((await server.fetchRecords('attendance')).length).toBe(3);
      expect(errors).toEqual([]);
    } finally {
      await other.close();
      await server.close();
    }
  });
}
