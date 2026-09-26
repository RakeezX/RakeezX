import { test, expect } from '@playwright/test';
import { DB_VERSION, STORES } from '../src/lib/db.js';

const CLOUD_URL = 'https://xlrubcwjqktzzunrvuns.supabase.co/rest/v1/';
const AUTH_STORAGE_KEY = 'rakeezx-auth-v2-xl-rubcwjqktzzunrvuns';
const AUTH_OWNER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CLAIM_ID = 'claim:automatic-sync-a';
const TABLES = ['years', 'calendars', 'calendar_days', 'terms', 'subjects', 'sections', 'teachings', 'students', 'enrollments', 'items', 'scores', 'time_profiles', 'slots', 'sessions', 'attendance', 'notes'];

function createCloud() {
  const tables = Object.fromEntries(TABLES.map((name) => [name, []]));
  const requests = [];
  let profile = { teacher_name: 'معلم سحابي', school_name: 'مدرسة سحابية', phone: '', client_updated_at: Date.now() - 5_000 };
  let nextProfileWrite = null;
  let failNextProfileRead = false;
  let activeWrites = 0;
  let maxActiveWrites = 0;
  const nextTableRead = new Map();
  return {
    async route(page) {
      await page.route(`${CLOUD_URL}**`, async (route) => {
        const request = route.request();
        const table = new URL(request.url()).pathname.split('/').pop();
        requests.push({ table, method: request.method(), at: Date.now() });
        if (table === 'profile') {
          if (request.method() === 'GET') {
            if (failNextProfileRead) {
              failNextProfileRead = false;
              return route.fulfill({ status: 503, json: { message: 'Synthetic transient failure' } });
            }
            return route.fulfill({ json: profile ? [profile] : [] });
          }
          if (nextProfileWrite) {
            const gate = nextProfileWrite; nextProfileWrite = null; gate.started(); await gate.wait;
          }
          const patch = JSON.parse(request.postData() ?? '{}');
          profile = { ...profile, ...patch };
          return route.fulfill({ json: [profile] });
        }
        if (table === 'apply_sync_v2_mutation' && request.method() === 'POST') {
          activeWrites++;
          maxActiveWrites = Math.max(maxActiveWrites, activeWrites);
          try {
            const envelope = JSON.parse(request.postData() ?? '{}');
            const entity = envelope.p_entity;
            if (entity === 'profile' && nextProfileWrite) {
              const gate = nextProfileWrite; nextProfileWrite = null; gate.started(); await gate.wait;
            }
            const list = entity === 'profile' ? [profile] : (tables[entity] ??= []);
            const index = list.findIndex((record) => record?.id === envelope.p_record_id);
            const prior = index >= 0 ? list[index] : null;
            const revision = Number(prior?.revision ?? 0) + 1;
            const canonical = {
              ...(prior ?? {}),
              id: envelope.p_record_id,
              ...(envelope.p_patch ?? {}),
              revision,
              field_revisions: Object.fromEntries(
                Object.keys(envelope.p_patch ?? {}).map((field) => [field, revision]),
              ),
              deleted_at: envelope.p_operation === 'delete'
                ? new Date(envelope.p_client_updated_at ?? Date.now()).toISOString()
                : null,
              client_updated_at: envelope.p_client_updated_at ?? Date.now(),
            };
            if (entity === 'profile') profile = canonical;
            else if (index >= 0) list[index] = canonical;
            else list.push(canonical);
            return await route.fulfill({ json: {
              mutationId: envelope.p_mutation_id,
              entity,
              recordId: envelope.p_record_id,
              canonicalId: canonical.id,
              outcome: 'applied',
              appliedGroups: Object.keys(envelope.p_patch ?? {}),
              conflictedGroups: [],
              resultRevision: revision,
              canonical,
            } });
          } finally {
            activeWrites--;
          }
        }
        if (table === 'account_contract' && request.method() === 'POST') {
          return route.fulfill({ json: {
            ownerId: AUTH_OWNER_ID,
            profileStatus: 'READY',
            profile: {
              teacherName: profile?.teacher_name ?? '',
              phone: profile?.phone ?? '',
              teacherForm: profile?.teacher_form === 'feminine' ? 'feminine' : 'masculine',
              schoolName: profile?.school_name ?? '',
            },
            access: { grantType: 'beta_full', status: 'active', source: 'public_beta', expiresAt: null },
          } });
        }
        if (table === 'score_foundation_capability' && request.method() === 'POST') {
          return route.fulfill({ status: 204 });
        }
        if (request.method() === 'GET') {
          const gate = nextTableRead.get(table);
          if (gate) {
            nextTableRead.delete(table);
            gate.started();
            await gate.wait;
          }
          return route.fulfill({ json: tables[table] ?? [] });
        }
        if (request.method() === 'POST') {
          const records = JSON.parse(request.postData() ?? '[]');
          if (table === 'calendars' && records.some((record) => !['moe', 'custom'].includes(record.source))) {
            return route.fulfill({ status: 422, json: { message: 'calendars_source_check' } });
          }
          if (table === 'terms' && records.some((record) => record.calendar_id && !tables.calendars.some((calendar) => calendar.id === record.calendar_id))) {
            return route.fulfill({ status: 409, json: { message: 'terms_calendar_fk' } });
          }
          for (const record of records) {
            const list = tables[table] ??= [];
            const index = list.findIndex((item) => item.id === record.id);
            if (index < 0) list.push({ ...record }); else list[index] = { ...record };
          }
          return route.fulfill({ json: [] });
        }
        return route.fulfill({ json: [] });
      });
    },
    profile: () => profile,
    requests: () => [...requests],
    maxActiveWrites: () => maxActiveWrites,
    failNextProfileRead: () => { failNextProfileRead = true; },
    table: (name) => tables[name] ?? [],
    holdNextProfileWrite() {
      let started; let release;
      const startedPromise = new Promise((resolve) => { started = resolve; });
      const wait = new Promise((resolve) => { release = resolve; });
      nextProfileWrite = { started, wait };
      return { started: startedPromise, release };
    },
    holdNextTableRead(table) {
      let started; let release;
      const startedPromise = new Promise((resolve) => { started = resolve; });
      const wait = new Promise((resolve) => { release = resolve; });
      nextTableRead.set(table, { started, wait });
      return { started: startedPromise, release };
    },
  };
}

async function authenticated(page, cloud) {
  await page.route('**/__automatic-sync-workspace__', (route) => route.fulfill({
    contentType: 'text/html', body: '<!doctype html><title>automatic sync workspace fixture</title>',
  }));
  await page.goto('/__automatic-sync-workspace__');
  await page.evaluate(async ({ ownerId, claimId, stores, databaseVersion }) => {
    const requestResult = (request) => new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transactionDone = (transaction) => new Promise((resolve, reject) => {
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
    const productRequest = indexedDB.open('rakeezx', databaseVersion);
    productRequest.onupgradeneeded = () => {
      for (const store of stores) {
        if (!productRequest.result.objectStoreNames.contains(store)) {
          productRequest.result.createObjectStore(store, { keyPath: 'id' });
        }
      }
    };
    const product = await requestResult(productRequest);
    const productTransaction = product.transaction('device', 'readwrite');
    productTransaction.objectStore('device').put({
      id: 'device', deviceId: 'device:automatic-sync', schemaVersion: databaseVersion,
      workspaceClaim: {
        version: 1, claimId, state: 'claimed', ownerId,
        origin: location.origin, databaseName: 'rakeezx', deviceId: 'device:automatic-sync',
        evidenceHash: 'automatic-sync-evidence', createdAt: 100, updatedAt: 100,
      },
    });
    await transactionDone(productTransaction);
    product.close();

    const { createWorkspaceRegistry } = await import('/src/lib/workspaces.js');
    const registry = createWorkspaceRegistry();
    await registry.registerLegacyClaim(ownerId, {
      claimId, evidenceHash: 'automatic-sync-evidence',
    });
    await registry.close();
  }, { ownerId: AUTH_OWNER_ID, claimId: CLAIM_ID, stores: STORES, databaseVersion: DB_VERSION });
  await page.unroute('**/__automatic-sync-workspace__');
  await page.addInitScript(({ storageKey, ownerId }) => localStorage.setItem(storageKey, JSON.stringify({
    access_token: 'auto-sync-test-token', user: { id: ownerId },
  })), { storageKey: AUTH_STORAGE_KEY, ownerId: AUTH_OWNER_ID });
  await cloud.route(page);
}

test('automatic sync pulls on authenticated boot and pushes profile changes without controls', async ({ browser }) => {
  test.setTimeout(45_000);
  const cloud = createCloud();
  const contextA = await browser.newContext();
  const pageA = await contextA.newPage();
  await authenticated(pageA, cloud);
  await pageA.goto('/#/settings');
  await pageA.waitForFunction(() => window.store && window.__syncModule?.state.status === 'synced');
  await expect(pageA.locator('input[name="teacherName"]')).toHaveValue('معلم سحابي');

  await pageA.evaluate(() => window.store.patchProfile({ teacherName: 'معلم تلقائي A' }));
  await pageA.waitForFunction(() => window.__syncModule.state.status === 'synced' && window.store.state.profile.teacherName === 'معلم تلقائي A');
  await expect.poll(() => cloud.profile().teacher_name).toBe('معلم تلقائي A');

  const contextB = await browser.newContext();
  const pageB = await contextB.newPage();
  await authenticated(pageB, cloud);
  await pageB.goto('/#/settings');
  await pageB.waitForFunction(() => window.__syncModule?.state.status === 'synced');
  await expect(pageB.locator('input[name="teacherName"]')).toHaveValue('معلم تلقائي A');
  await pageB.getByRole('button', { name: 'مركز تحكم المعلم' }).click();
  await expect(pageB.locator('.sheet').getByRole('button', { name: 'مزامنة الآن' })).toBeVisible();
  await pageB.keyboard.press('Escape');
  await expect(pageB.getByText('اختبار المزامنة')).toHaveCount(0);
  expect(cloud.table('calendars').length).toBeGreaterThan(0);
  expect(cloud.table('calendars').every((calendar) => ['moe', 'custom'].includes(calendar.source))).toBe(true);
  expect(cloud.table('terms').every((term) => !term.calendar_id || cloud.table('calendars').some((calendar) => calendar.id === term.calendar_id))).toBe(true);
  await expect.poll(() => pageB.evaluate(() => window.store.state.calendars.some((calendar) => calendar.source.startsWith('preset:')))).toBe(true);

  await contextA.close();
  await contextB.close();
});

test('durable edits use the measured trailing cadence while manual and stale resume stay immediate', async ({ browser }) => {
  test.setTimeout(45_000);
  const cloud = createCloud();
  const context = await browser.newContext();
  const page = await context.newPage();
  await authenticated(page, cloud);
  await page.goto('/#/settings');
  await page.waitForFunction(() => window.__syncModule?.state.status === 'synced');

  let mark = cloud.requests().length;
  const oneCommittedAt = await page.evaluate(async () => {
    await window.store.patchProfile({ teacherName: 'Cadence single edit' });
    return Date.now();
  });
  await expect.poll(() => cloud.profile().teacher_name).toBe('Cadence single edit');
  await page.waitForFunction(() => window.__syncModule.state.status === 'synced');
  let events = cloud.requests().slice(mark);
  let pulls = events.filter((event) => event.table === 'profile' && event.method === 'GET');
  expect(pulls).toHaveLength(2);
  expect(events.filter((event) => event.table === 'apply_sync_v2_mutation')).toHaveLength(1);
  expect(pulls[0].at - oneCommittedAt).toBeGreaterThanOrEqual(240);
  expect(pulls[0].at - oneCommittedAt).toBeLessThan(1200);

  mark = cloud.requests().length;
  const lastCommittedAt = await page.evaluate(async () => {
    for (let i = 0; i < 3; i++) {
      await window.store.patchProfile({ teacherName: `Cadence rapid edit ${i}` });
      if (i < 2) await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return Date.now();
  });
  await expect.poll(() => cloud.profile().teacher_name).toBe('Cadence rapid edit 2');
  await page.waitForFunction(() => window.__syncModule.state.status === 'synced');
  events = cloud.requests().slice(mark);
  pulls = events.filter((event) => event.table === 'profile' && event.method === 'GET');
  expect(pulls).toHaveLength(2);
  expect(events.filter((event) => event.table === 'apply_sync_v2_mutation')).toHaveLength(3);
  expect(pulls[0].at - lastCommittedAt).toBeGreaterThanOrEqual(240);

  mark = cloud.requests().length;
  const manualStartedAt = await page.evaluate(async () => {
    const started = Date.now();
    const ok = await window.__syncModule.syncAll({ full: true });
    if (!ok) throw new Error('manual Sync failed');
    return started;
  });
  events = cloud.requests().slice(mark);
  expect(events.some((event) => event.table === 'profile' && event.method === 'GET')).toBe(true);
  expect(events[0].at - manualStartedAt).toBeLessThan(250);

  mark = cloud.requests().length;
  const resumedAt = await page.evaluate(() => {
    window.__syncModule.state.lastSyncedAt = Date.now() - 6 * 60 * 1000;
    const started = Date.now();
    window.dispatchEvent(new Event('pageshow'));
    return started;
  });
  await expect.poll(() => cloud.requests().slice(mark).some((event) => event.table === 'profile' && event.method === 'GET')).toBe(true);
  events = cloud.requests().slice(mark);
  expect(events[0].at - resumedAt).toBeLessThan(250);
  await page.waitForFunction(() => window.__syncModule.state.status === 'synced');
  await context.close();
});

test('temporary automatic failure retains the edit and uses the existing retry backoff', async ({ browser }) => {
  test.setTimeout(45_000);
  const cloud = createCloud();
  const context = await browser.newContext();
  const page = await context.newPage();
  await authenticated(page, cloud);
  await page.goto('/#/settings');
  await page.waitForFunction(() => window.__syncModule?.state.status === 'synced');

  const mark = cloud.requests().length;
  cloud.failNextProfileRead();
  await page.evaluate(() => window.store.patchProfile({ schoolName: 'Cadence retry school' }));
  await page.waitForFunction(() => window.__syncModule.state.status === 'error');
  expect((await page.evaluate(async () => (await (await import('/src/lib/db.js')).getAll('outbox'))
    .some((entry) => entry.store === 'profile')))).toBe(true);
  await expect.poll(() => cloud.profile().school_name, { timeout: 10_000 }).toBe('Cadence retry school');
  await page.waitForFunction(() => window.__syncModule.state.status === 'synced');
  const reads = cloud.requests().slice(mark).filter((event) => event.table === 'profile' && event.method === 'GET');
  expect(reads.length).toBeGreaterThanOrEqual(3);
  expect(reads[1].at - reads[0].at).toBeGreaterThanOrEqual(1800);
  await context.close();
});

test('offline profile edits remain local and automatically drain on reconnect', async ({ browser }) => {
  test.setTimeout(45_000);
  const cloud = createCloud();
  const context = await browser.newContext();
  const page = await context.newPage();
  await authenticated(page, cloud);
  await page.goto('/#/settings');
  await page.waitForFunction(() => window.__syncModule?.state.status === 'synced');

  await context.setOffline(true);
  await page.evaluate(() => window.store.patchProfile({ schoolName: 'مدرسة اختبار دون اتصال' }));
  await page.waitForFunction(() => window.__syncModule.state.status === 'offline');
  expect(await page.evaluate(async () => (await (await import('/src/lib/db.js')).getAll('outbox')).some((entry) => entry.store === 'profile'))).toBe(true);

  await context.setOffline(false);
  await page.waitForFunction(() => window.__syncModule.state.status === 'synced');
  await expect.poll(() => cloud.profile().school_name).toBe('مدرسة اختبار دون اتصال');
  expect(await page.evaluate(async () => (await (await import('/src/lib/db.js')).getAll('outbox')).some((entry) => entry.store === 'profile'))).toBe(false);
  await context.close();
});
test('a mutation during an active upload remains queued for a single follow-up pass', async ({ browser }) => {
  test.setTimeout(45_000);
  const cloud = createCloud();
  const context = await browser.newContext();
  const page = await context.newPage();
  await authenticated(page, cloud);
  await page.goto('/#/settings');
  await page.waitForFunction(() => window.__syncModule?.state.status === 'synced');

  const mark = cloud.requests().length;
  const gate = cloud.holdNextProfileWrite();
  await page.evaluate(() => window.store.patchProfile({ teacherName: 'معلم أثناء المزامنة ١' }));
  await gate.started;
  await page.evaluate(() => window.store.patchProfile({ teacherName: 'معلم أثناء المزامنة ٢' }));
  gate.release();

  await expect.poll(() => cloud.profile().teacher_name, { timeout: 10_000 }).toBe('معلم أثناء المزامنة ٢');
  await page.waitForFunction(async () => (await (await import('/src/lib/db.js')).getAll('outbox')).every((entry) => entry.store !== 'profile'));
  expect(await page.evaluate(() => window.__syncModule.state.status)).toBe('synced');
  const events = cloud.requests().slice(mark);
  expect(events.filter((event) => event.table === 'score_foundation_capability')).toHaveLength(2);
  expect(events.filter((event) => event.table === 'apply_sync_v2_mutation')).toHaveLength(2);
  expect(cloud.maxActiveWrites()).toBe(1);
  await context.close();
});
test('authenticated fresh pull renders existing student notes without a local mutation', async ({ browser }) => {
  test.setTimeout(45_000);
  const cloud = createCloud();
  const stamp = Date.now() - 10_000;
  cloud.table('students').push({
    id: 'remote-notes-student', name: 'طالب سحابي', note: '', status: 'active',
    client_updated_at: stamp, deleted_at: null,
  });
  cloud.table('notes').push({
    id: 'remote-existing-note', student_id: 'remote-notes-student', teaching_id: null, session_id: null,
    date: '2026-08-30', kind: 'general', text: 'ملاحظة وصلت من السحابة',
    created_at: new Date(stamp).toISOString(), client_updated_at: stamp, deleted_at: null,
  });

  const notesRead = cloud.holdNextTableRead('notes');
  const context = await browser.newContext();
  const page = await context.newPage();
  await authenticated(page, cloud);
  await page.goto('/#/student/remote-notes-student');

  await notesRead.started;
  notesRead.release();
  await page.waitForFunction(() => window.__syncModule?.state.status === 'synced');
  await expect(page.getByRole('heading', { name: /طالب سحابي/ })).toBeVisible();
  await page.locator('.student-notes-history > summary').click();
  await expect(page.getByText('ملاحظة وصلت من السحابة')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.store.notesOf('remote-notes-student').map((note) => note.id))).toEqual(['remote-existing-note']);

  await page.reload();
  await page.locator('.student-notes-history > summary').click();
  await expect(page.getByText('ملاحظة وصلت من السحابة')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.store.notesOf('remote-notes-student').map((note) => note.id))).toEqual(['remote-existing-note']);
  await context.close();
});
