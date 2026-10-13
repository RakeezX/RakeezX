import { test, expect } from '@playwright/test';
import { createCloud, authenticated } from './helpers/remote-sync-browser.mjs';

const owner = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
test.setTimeout(90_000);

function fixture() {
  const cloud = createCloud();
  cloud.seed('subjects', { id: 'remote-subject-two', name: 'Second subject', slug: 'second', deleted_at: null,
    revision: 1, field_revisions: {}, client_updated_at: 1 });
  for (const id of ['A', 'B']) cloud.seed('sections', { id, year_id: 'remote-year', grade: 4, label: id,
    deleted_at: null, revision: 1, field_revisions: {}, client_updated_at: 1 });
  for (const [id, section] of [['A1', 'A'], ['A2', 'A'], ['B1', 'B']]) cloud.seed('teachings', {
    id, section_id: section, subject_id: id === 'A2' ? 'remote-subject-two' : 'remote-subject', term_id: 'remote-term-1',
    deleted_at: null, revision: 1, field_revisions: {}, client_updated_at: 1 });
  return cloud;
}

async function boot(page, cloud) {
  await authenticated(page, cloud);
  await page.route('https://*.supabase.co/auth/v1/user', r => r.fulfill({ json: { id: owner } }));
  await page.goto('/#/classes');
  await page.waitForFunction(() => window.store?.state.ready && document.querySelector('.topbar') &&
    window.__syncModule?.displayState().status === 'synced' && !window.__syncModule.getRemoteSyncDiagnostics().pending);
  await page.evaluate(async () => {
    const sync = await import('/src/lib/sync.js');
    await sync.suspendForWorkspaceDeactivation();
    await window.store.renewOfflineLease();
    if (!await sync.syncAll({ full: true })) throw new Error(`Synthetic initial pull failed: ${JSON.stringify(sync.state)}`);
    sync.resumeAfterWorkspaceDeactivationFailure();
    window.__n97 = { states: [], red: [] };
    sync.subscribe(() => window.__n97.states.push(sync.getSyncOperationalSummarySnapshot()));
    const observe = () => {
      const strip = document.querySelector('[data-app-status]');
      if (strip?.classList.contains('is-visible') && strip.classList.contains('is-error')) window.__n97.red.push(strip.className);
    };
    window.__n97Observer = new MutationObserver(observe);
    window.__n97Observer.observe(document.body, { subtree: true, childList: true, attributes: true });
  });
  await page.waitForFunction(async () => {
    const s = (await import('/src/lib/sync.js')).getSyncOperationalSummarySnapshot();
    return s.state === 'synced' && !s.automaticSyncActive;
  });
}

async function center(page) {
  await page.locator('[data-act="open-teacher-mini-hub"]').filter({ visible: true }).first().click();
  await expect(page.locator('.mini-hub-sync')).toBeVisible();
  return page.locator('.mini-hub-sync');
}

function deletionServer(page, cloud, held = false) {
  let enter, release;
  const entered = new Promise(resolve => { enter = resolve; });
  const gate = new Promise(resolve => { release = resolve; });
  const calls = [];
  const ready = page.route('https://*.supabase.co/rest/v1/rpc/n77_delete_teaching', async route => {
    const p = route.request().postDataJSON();
    const siblings = cloud.table('teachings').filter(r => r.section_id === p.p_expected_section_id && !r.deleted_at);
    const plan = { ownerId: owner, selectedTeachingId: p.p_teaching_id, sectionId: p.p_expected_section_id,
      scope: siblings.length === 1 ? 'section' : 'teaching', fingerprint: `scope:${p.p_teaching_id}`,
      teachingIds: [p.p_teaching_id] };
    if (!p.p_commit) return route.fulfill({ json: plan });
    calls.push(p); enter(); if (held) await gate;
    for (const r of cloud.table('teachings')) if (r.id === p.p_teaching_id) {
      r.deleted_at = new Date().toISOString(); r.revision++;
    }
    if (plan.scope === 'section') for (const r of cloud.table('sections')) if (r.id === plan.sectionId) {
      r.deleted_at = new Date().toISOString(); r.revision++;
    }
    await route.fulfill({ json: { ...plan, outcome: 'deleted', mutationId: p.p_mutation_id,
      cascadeTeachingIds: [p.p_teaching_id], orphanStudentIds: [] } });
  });
  return { ready, entered, release, calls };
}

test('N97 two device deletes drain existing pulls, keep exact receipts and converge without red or resurrection', async ({ browser }, info) => {
  const cloud = fixture();
  const contexts = await Promise.all([browser.newContext(), browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true })]);
  const pages = await Promise.all(contexts.map(c => c.newPage()));
  const servers = [];
  const pulls = [];
  try {
    for (const page of pages) { await boot(page, cloud); servers.push(deletionServer(page, cloud, true)); }
    await Promise.all(servers.map(s => s.ready));
    for (const page of pages) {
      const pull = cloud.holdNextTableRead('sections', page); pulls.push(pull);
      await page.evaluate(() => { window.__pull = import('/src/lib/sync.js').then(s => s.syncAll({ full: true })); });
      await pull.started;
    }
    for (const [i, page] of pages.entries()) await page.evaluate(async id => {
      const store = await import('/src/store.js');
      const plan = await store.previewDeleteTeaching(id);
      window.__deletion = store.deleteTeaching(id, plan);
    }, i === 0 ? 'A1' : 'B1');
    expect(servers.map(s => s.calls.length)).toEqual([0, 0]);
    for (const pull of pulls) pull.release();
    await Promise.all(servers.map(s => s.entered));
    for (const [i, page] of pages.entries()) {
      const section = await center(page);
      await expect(section.locator('.badge')).toHaveText('جارٍ مزامنة التغييرات');
      expect(await page.evaluate(async () => {
        const db = await import('/src/lib/db.js');
        try { await db.put('notes', { id: 'forbidden-during-delete' }); return 'wrote'; }
        catch (e) { return e.code; }
      })).toBe('N77_DELETE_RESUME_REQUIRED');
      await page.screenshot({ path: info.outputPath(`held-device-${i}.png`) });
    }
    for (const server of servers) server.release();
    await Promise.all(pages.map(p => p.evaluate(() => window.__deletion)));
    for (const [i, page] of pages.entries()) {
      await page.evaluate(async () => { const s = await import('/src/lib/sync.js'); await s.suspendForWorkspaceDeactivation(); });
      // Settle and read the actual coordinator, including canonical tombstones from the other device.
      expect(await page.evaluate(async () => (await import('/src/lib/sync.js')).syncAll({ full: true }))).toBe(true);
      const result = await page.evaluate(async () => {
        const db = await import('/src/lib/db.js');
        return { summary: await (await import('/src/lib/sync.js')).getSyncOperationalSummary(),
          receipt: (await db.get('device', 'device')).n77DeleteReceipt,
          queue: await db.getAll('outbox'), a: await db.get('teachings', 'A1'), b: await db.get('sections', 'B'),
          sibling: await db.get('teachings', 'A2'), observations: window.__n97 };
      });
      expect(result.receipt.mutationId).toBe(servers[i].calls[0].p_mutation_id);
      expect(result.receipt.scope).toBe(i === 0 ? 'teaching' : 'section');
      expect(result.queue).toEqual([]);
      expect(result.a.deleted).toBe(true); expect(result.b.deleted).toBe(true); expect(result.sibling.deleted).toBe(false);
      expect(result.summary.state).toBe('synced');
      expect(result.observations.red).toEqual([]);
      expect(result.observations.states.filter(s => s.state === 'error')).toEqual([]);
      await info.attach(`device-${i}`, { body: JSON.stringify(result), contentType: 'application/json' });
    }
  } finally {
    for (const pull of pulls) pull.release(); for (const server of servers) server.release();
    await Promise.all(contexts.map(c => c.close()));
  }
});

test('N97 resume is pending before fresh pull; real HTTP rejection stays red until successful verification', async ({ page }, info) => {
  const cloud = fixture(); await boot(page, cloud);
  const section = await center(page);
  await expect(section.locator('.badge')).toHaveText('متزامن');
  const held = cloud.holdNextTableRead('sections', page);
  try {
    const resumed = await page.evaluate(() => {
      dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
      return window.__syncModule.getSyncOperationalSummarySnapshot();
    });
    expect(resumed.state).toBe('pending'); expect(resumed.cloudSyncHealthy).toBe(false);
    await info.attach('resume-before-pull', { body: JSON.stringify(resumed), contentType: 'application/json' });
    await held.started;
    await expect(section.locator('.badge')).not.toHaveText('متزامن');
    const heldSummary = await page.evaluate(async () => (await import('/src/lib/sync.js')).getSyncOperationalSummarySnapshot());
    expect(heldSummary.cloudSyncHealthy, JSON.stringify(heldSummary)).toBe(false);
    held.release();
    await expect(section.locator('.badge')).toHaveText('متزامن');
    await page.route('https://*.supabase.co/rest/v1/sections*', r => r.fulfill({ status: 503, json: { message: 'Synthetic server rejection' } }));
    await section.getByRole('button', { name: 'مزامنة الآن' }).click();
    await expect(section.locator('.badge')).toHaveText('تعذر إكمال المزامنة');
    await page.evaluate(() => { dispatchEvent(new Event('pageshow')); document.dispatchEvent(new Event('visibilitychange')); });
    await expect(section.locator('.badge')).toHaveText('تعذر إكمال المزامنة');
    await page.screenshot({ path: info.outputPath('actual-http-rejection.png') });
    await page.unroute('https://*.supabase.co/rest/v1/sections*');
    await page.evaluate(async () => { const s = await import('/src/lib/sync.js'); await s.suspendForWorkspaceDeactivation(); await s.syncAll({ full: true }); });
    await expect(section.locator('.badge')).toHaveText('متزامن');
    await page.getByRole('button', { name: 'إغلاق', exact: true }).click();
    for (const state of ['failed', 'rejected']) {
      await page.evaluate(async state => {
        const db = await import('/src/lib/db.js');
        await db.clearStore('outbox');
        const handle = await db.openDB();
        await new Promise((resolve, reject) => {
          const tx = handle.transaction('outbox', 'readwrite');
          tx.objectStore('outbox').put({ id: 'n97-unresolved', protocol: 'v2', state,
            store: 'sessions', recordId: 'unresolved', sequence: 1 });
          tx.oncomplete = resolve; tx.onabort = () => reject(tx.error);
        });
        await (await import('/src/lib/sync.js')).getSyncOperationalSummary();
      }, state);
      const current = await center(page);
      await expect(current.locator('.badge')).toHaveText(state === 'failed' ? 'تعذر إكمال المزامنة' : 'تعذر اعتماد بعض التغييرات');
      await expect(current.getByRole('link', { name: 'تحتاج مساعدة؟' })).toBeVisible();
      await page.getByRole('button', { name: 'إغلاق', exact: true }).click();
    }
  } finally { held.release(); }
});

test('N97 source cause reproduces legacy checkpoint/pull collision and retained hard failure in actual coordinator', async ({ page }, info) => {
  const cloud = fixture(); await boot(page, cloud);
  await page.evaluate(async () => (await import('/src/lib/sync.js')).suspendForWorkspaceDeactivation());
  const held = cloud.holdNextTableRead('sections', page);
  try {
    await page.evaluate(() => { window.__legacyPull = import('/src/lib/sync.js').then(s => s.syncAll({ full: true })); });
    await held.started;
    // Model the pre-fix ordering: a running ordinary pull, then N77's write exclusion.
    await page.evaluate(async () => {
      const db = await import('/src/lib/db.js');
      const device = await db.get('device', 'device');
      await db.put('device', { ...device, n77DeleteIntent: { ownerId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', selectedTeachingId: 'A1', mutationId: 'legacy-race' } });
    });
    held.release();
    expect(await page.evaluate(() => window.__legacyPull)).toBe(false);
    const before = await page.evaluate(async () => {
      const sync = await import('/src/lib/sync.js');
      const db = await import('/src/lib/db.js');
      const device = await db.get('device', 'device');
      await db.put('device', { ...device, n77DeleteIntent: null });
      return { error: sync.state.lastError, summary: await sync.getSyncOperationalSummary() };
    });
    expect(before.error).toContain('Resume pending N77 Delete');
    expect(before.summary.failedCount).toBe(0);
    expect(before.summary.presentationSeverity.hardFailure).toBe(true);
    expect(before.summary.state).toBe('error');
    const section = await center(page);
    await expect(section.locator('.badge')).toHaveText('تعذر إكمال المزامنة');
    await info.attach('source-cause-reproduction', { body: JSON.stringify(before), contentType: 'application/json' });
    expect(await page.evaluate(async () => (await import('/src/lib/sync.js')).syncAll({ full: true }))).toBe(true);
    await expect(section.locator('.badge')).toHaveText('متزامن');
  } finally { held.release(); }
});

test('N97 actual subject and final-class dialog handlers finish without falsely certifying historical conflicts', async ({ page }, info) => {
  const cloud = fixture(); await boot(page, cloud);
  const server = deletionServer(page, cloud); await server.ready;
  for (const [id, scope, history] of [['A1', 'teaching', 7], ['A2', 'section', 27]]) {
    await page.evaluate(async count => {
      const db = await import('/src/lib/db.js');
      await db.put('sessions', { id: 'n97-history', updatedAt: 1,
        syncConflicts: Array.from({ length: count }, (_, i) => ({ lifecycle: 'historical_reconciled', mutationId: `old-${i}`, recordedAt: 1 })) });
    }, history);
    await page.locator('[data-act="delete-class-flow"]').click();
    const dialog = page.getByRole('dialog');
    await dialog.locator(`[data-teaching-id="${id}"]`).click();
    await dialog.locator('#class-delete-next-btn').click();
    await expect(dialog.locator('.class-delete-confirm-box__consequence')).toContainText(scope === 'teaching' ? 'هذه المادة' : 'الفصل');
    await dialog.locator('#class-delete-confirm-btn').click();
    await expect(dialog).toHaveCount(0);
    await page.waitForFunction(() => window.__syncModule.getSyncOperationalSummarySnapshot().state === 'synced');
    const section = await center(page);
    await expect(section.locator('.badge')).toHaveText('متزامن');
    await section.locator('summary').click();
    await expect(section).toContainText(`اختلافات مزامنة سابقة تمت معالجتها: ${history}`);
    await expect(section.getByRole('link', { name: 'تحتاج مساعدة؟' })).toHaveCount(0);
    const result = await page.evaluate(async () => {
      const db = await import('/src/lib/db.js');
      return { receipt: (await db.get('device', 'device')).n77DeleteReceipt, queue: await db.getAll('outbox') };
    });
    expect(result.receipt.scope).toBe(scope); expect(result.queue).toEqual([]);
    await info.attach(`dialog-${scope}`, { body: JSON.stringify(result), contentType: 'application/json' });
    await page.getByRole('button', { name: 'إغلاق', exact: true }).click();
  }
  expect(server.calls).toHaveLength(2);
  expect(await page.evaluate(() => window.__n97.red)).toEqual([]);
});
