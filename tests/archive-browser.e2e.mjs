import { test, expect } from '@playwright/test';
import { lifecycleServer } from './helpers/student-lifecycle-server.mjs';

async function seed(page) {
  // Exercise the supported close command against an isolated synthetic server,
  // rather than writing a closed term through the generic operational save API.
  const pg = await lifecycleServer();
  try {
    await pg.exec(`insert into rakeezx.profile(teacher_name) values('معلم اختبار');
      insert into rakeezx.years(id,label,hijri_start,hijri_end,status) values
      ('cur','الحالية',1471,1472,'active'),('old','القديمة',1470,1471,'archived');
      insert into rakeezx.terms(id,year_id,name,"index",status) values
      ('tc','cur','الحالي',1,'active'),('to','old','الأول',1,'active');`);
    const records = {};
    for (const table of ['profile', 'years', 'terms']) {
      records[table] = (await pg.query(`select to_jsonb(t) record from rakeezx.${table} t`)).rows.map(row => row.record);
    }
    await page.exposeFunction('archiveCloseTerm', async envelope =>
      (await pg.query(`select rakeezx.apply_sync_v2_closed_term_report_command(
        $1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9) result`, [
        envelope.mutationId, envelope.deviceId, envelope.command, envelope.termId,
        envelope.reportId, envelope.supersedesId ?? null, JSON.stringify(envelope.sourceManifest),
        JSON.stringify(envelope.payload), envelope.clientUpdatedAt,
      ])).rows[0].result);
    await page.goto('/#/archive');
    await page.waitForFunction(() => window.store?.state.ready);
    const result = await page.evaluate(async records => {
      const db = await import('/src/lib/db.js');
      const { createSyncV2Engine, decodeSyncV2Canonical } = await import('/src/lib/sync-v2.js');
      await window.store.save(Object.fromEntries(Object.entries(records).map(([name, rows]) =>
        [name, rows.map(row => decodeSyncV2Canonical(name, row))])), { queue: false });
      await window.store.refreshSyncedState();
      const queued = await window.store.queueClosedTermReport({ termId: 'to' });
      const engine = createSyncV2Engine({
        database: { ...db, async getAll(name) {
          const rows = await db.getAll(name);
          // Dispatch only this fixture's close command, not local demo bootstrap.
          return name === 'outbox' ? rows.filter(row => row.mutationId === queued.mutationId) : rows;
        } },
        transport: { applyClosedTermReportCommand: envelope => window.archiveCloseTerm(envelope) },
      });
      const dispatched = await engine.dispatchPending();
      await window.store.init();
      await window.store.patchDevice({ activeYearId: 'cur', activeTermId: 'tc' });
      window.store.repaint();
      return { acknowledged: dispatched.acknowledged, failed: dispatched.failed,
        blocked: dispatched.blocked, status: window.store.getTerm('to').status,
        report: window.store.closedTermReportState('to').state };
    }, records);
    expect(result).toEqual({ acknowledged: 1, failed: 0, blocked: 0, status: 'closed', report: 'complete' });
  } finally {
    await pg.close();
  }
}

test('archive routes stay route-scoped and validate safely', async ({ page }) => {
  await seed(page); await page.locator('a[href="#/archive/year/old/term/to"]').click(); await expect(page.getByRole('heading', { name: 'السجل التاريخي', exact: true, level: 1 })).toBeVisible();
  expect(await page.evaluate(() => ({ y: window.store.state.device.activeYearId, t: window.store.state.device.activeTermId }))).toEqual({ y: 'cur', t: 'tc' });
  await page.goto('/#/archive/year/cur/term/to'); await expect(page.getByText('سياق الأرشيف غير متاح')).toBeVisible();
  await page.goto('/#/'); expect(await page.evaluate(() => window.store.state.device.activeTermId)).toBe('tc');
});

test('archive route does not alter another tab or mobile layout', async ({ context, page }) => {
  await seed(page); const tabB = await context.newPage(); await tabB.goto('/#/archive/year/old/term/to'); await expect(tabB.getByRole('heading', { name: 'السجل التاريخي', exact: true, level: 1 })).toBeVisible();
  expect(await page.evaluate(() => ({ y: window.store.state.device.activeYearId, t: window.store.state.device.activeTermId }))).toEqual({ y: 'cur', t: 'tc' });
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/#/archive'); expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true); await page.locator('a[href="#/archive/year/old/term/to"]').click(); await expect(page.getByRole('link', { name: 'العودة إلى الأرشيف' })).toBeVisible(); expect(await page.evaluate(() => document.documentElement.dir || getComputedStyle(document.documentElement).direction)).toBe('rtl'); await tabB.close();
});
test('archive parent navigation is deterministic from settings, direct loads, detail, and RTL mobile', async ({ page }) => {
  await seed(page);
  const activeContext = { y: 'cur', t: 'tc' };
  await page.goto('/#/settings');
  await page.getByRole('link', { name: 'الأرشيف' }).click();
  await expect(page).toHaveURL(/#\/archive$/);
  await page.getByRole('link', { name: 'العودة إلى الإعدادات' }).click();
  await expect(page).toHaveURL(/#\/settings$/);
  await page.goto('/#/archive');
  await page.getByRole('link', { name: 'العودة إلى الإعدادات' }).click();
  await expect(page).toHaveURL(/#\/settings$/);
  await page.goto('/#/archive');
  await page.locator('a[href="#/archive/year/old/term/to"]').click();
  await expect(page).toHaveURL(/#\/archive\/year\/old\/term\/to$/);
  await page.getByRole('link', { name: 'العودة إلى الأرشيف' }).click();
  await expect(page).toHaveURL(/#\/archive$/);
  expect(await page.evaluate(() => ({ y: window.store.state.device.activeYearId, t: window.store.state.device.activeTermId }))).toEqual(activeContext);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/archive');
  const parent = page.getByRole('link', { name: 'العودة إلى الإعدادات' });
  await expect(parent).toBeVisible();
  expect(await parent.evaluate((el) => el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(40);
  expect(await page.evaluate(() => document.documentElement.dir || getComputedStyle(document.documentElement).direction)).toBe('rtl');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});
