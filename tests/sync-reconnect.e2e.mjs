import { test, expect } from '@playwright/test';

for (const failUpload of [false, true]) test(`offline class form reconnects with demo history (temporary rejection: ${failUpload})`, async ({ page, context }) => {
  const tables = {};
  let rejectSections = false;
  let rejected = 0;
  const runtimeErrors = [];
  page.on('pageerror', error => runtimeErrors.push(error.message));
  await page.addInitScript(() => localStorage.setItem('rakeezx-auth', JSON.stringify({
    access_token: 'TEST-token', user: { id: 'TEST-owner', email: 'teacher@example.test' },
  })));
  await page.route('https://bmekljhmepgkhywjzkdx.supabase.co/rest/v1/**', async route => {
    const req = route.request(), table = new URL(req.url()).pathname.split('/').pop();
    if (req.method() === 'GET') return route.fulfill({ json: tables[table] ?? [] });
    if (table === 'sections' && rejectSections) {
      rejected++;
      return route.fulfill({ status: 503, json: { message: 'TEST sections upload unavailable', code: 'TEST503' } });
    }
    const body = req.postDataJSON();
    for (const row of Array.isArray(body) ? body : [body]) {
      const rows = tables[table] ??= [];
      const index = rows.findIndex(old => old.id === row.id);
      if (index < 0) rows.push(row); else rows[index] = row;
    }
    return route.fulfill({ json: [] });
  });
  await page.goto('/#/classes');
  await page.waitForFunction(() => window.__syncModule?.state.status === 'synced');
  await page.evaluate(async () => { window.demoModule = await import('/src/lib/demo.js'); });
  await context.setOffline(true);
  // Real demo actions generate ordinary ses: IDs whose teaching is local-only.
  await page.evaluate(async () => {
    const { createDemoPackage } = window.demoModule;
    await createDemoPackage();
    const teaching = window.store.state.teachings.find(t => t.id.startsWith('demo:'));
    const session = await window.store.ensureSession(teaching.id, '2026-09-20', 7);
    window.demoSessionId = session.id;
    // A pre-fix receipt survives: excluded from cloud work, never deleted here.
    await (await import('/src/lib/db.js')).put('outbox', {
      id: `sessions:${session.id}`, store: 'sessions', recordId: session.id,
      op: 'put', updatedAt: session.updatedAt, queuedAt: Date.now(),
    });
  });
  await page.getByRole('button', { name: 'فصل جديد', exact: true }).click();
  await page.locator('#tch-form [name="label"]').fill('TEST');
  await page.getByRole('button', { name: 'إنشاء', exact: true }).click();
  await expect(page.locator('.class-card').filter({ hasText: 'TEST' })).toBeVisible();
  const pending = await page.evaluate(async () => {
    const db = await import('/src/lib/db.js');
    return { sections: await db.getAll('sections'), outbox: await db.getAll('outbox') };
  });
  expect(pending.sections.some(s => s.label === 'TEST')).toBe(true);
  expect(pending.outbox.some(e => e.store === 'sections')).toBe(true);
  rejectSections = failUpload;
  await context.setOffline(false);
  if (failUpload) {
    await expect.poll(() => rejected).toBeGreaterThan(0);
    await page.waitForFunction(() => window.__syncModule.displayState().status === 'error');
  } else {
    await page.waitForFunction(() => window.__syncModule.displayState().status === 'synced');
    expect(tables.sections.some(s => s.label === 'TEST')).toBe(true);
  }
  await page.goto('/#/settings');
  await page.waitForFunction(status => window.__syncModule.displayState().status === status, failUpload ? 'error' : 'synced');
  await page.locator('.teacher-mini-hub-trigger').click();
  await expect(page.locator('[data-sync-label]').first()).toHaveText(failUpload ? 'تعذر إكمال المزامنة' : 'متزامن');
  await expect(page.locator('[data-sync-label]').last()).toHaveText(failUpload ? 'تعذر إكمال المزامنة' : 'متزامن');
  rejectSections = false;
  await page.locator('[data-act="mini-hub-sync-now"]').click();
  await expect.poll(() => tables.sections?.some(s => s.label === 'TEST')).toBe(true);
  await expect.poll(() => page.evaluate(() => ({
    status: window.__syncModule.displayState().status,
    error: window.__syncModule.state.lastError,
  }))).toEqual({ status: 'synced', error: null });
  await expect(page.locator('[data-sync-label]').first()).toHaveText('متزامن');
  await expect(page.locator('[data-sync-label]').last()).toHaveText('متزامن');
  expect(await page.evaluate(async () => {
    const db = await import('/src/lib/db.js');
    const outbox = await db.getAll('outbox');
    return outbox.filter(e => e.store === 'sections' && e.recordId === window.store.state.sections.find(s => s.label === 'TEST').id).length;
  })).toBe(0);
  expect(tables.sessions?.some(s => s.teaching_id?.startsWith('demo:')) ?? false).toBe(false);
  expect(await page.evaluate(async () => !!await (await import('/src/lib/db.js')).get('sessions', window.demoSessionId))).toBe(true);
  expect(await page.evaluate(async () => !!await (await import('/src/lib/db.js')).get('outbox', `sessions:${window.demoSessionId}`))).toBe(true);
  await page.reload();
  await page.waitForFunction(() => window.__syncModule?.displayState().status === 'synced');
  expect(runtimeErrors).toEqual([]);
});
