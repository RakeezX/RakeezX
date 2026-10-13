import { test, expect } from '@playwright/test';
import { sessionInto, ownerRows } from './n58-live-d087.e2e.mjs';
test.use({ serviceWorkers: 'block' });

import { SUPABASE_URL } from '../src/lib/cloud.js';
import { buildAccountFoundationDefaults } from '../src/lib/account-provisioning.js';
import { encodeSyncV2Patch } from '../src/lib/sync-v2.js';

const OWNER = '55555555-5555-4555-8555-555555555555';
const SESSION = { access_token: 'synthetic-provision-token', refresh_token: 'synthetic-provision-refresh',
  expires_at: 4_102_444_800, user: { id: OWNER, email: 'new-teacher@example.test' } };
const mapping = { years: 'years', terms: 'terms', subjects: 'subjects', calendars: 'calendars',
  calendarDays: 'calendar_days', timeProfiles: 'time_profiles' };

function snapshot() {
  const defaults = buildAccountFoundationDefaults();
  const canonical = { profile: [{ owner_id: OWNER, revision: 1, field_revisions: {}, deleted_at: null,
    teacher_name: 'معلمة اصطناعية', phone: '0500000001', teacher_form: 'feminine' }] };
  for (const [store, entity] of Object.entries(mapping)) canonical[entity] = defaults[store].map((record) => ({
    id: record.id, owner_id: OWNER, revision: 1, field_revisions: {}, deleted_at: null,
    ...encodeSyncV2Patch(store, record),
  }));
  return canonical;
}

function contract(state, profileStatus = 'READY') {
  return { ownerId: OWNER, profileStatus,
    profile: { teacherName: profileStatus === 'READY' ? 'معلمة اصطناعية' : '',
      phone: profileStatus === 'READY' ? '0500000001' : '', teacherForm: 'feminine', schoolName: '' },
    access: { grantType: 'beta_full', status: 'active', source: 'public_beta' },
    provisioning: state ? { state, version: 1, foundationHash: state === 'READY' ? 'synthetic-server-hash' : null } : null };
}

test('fresh authenticated owner completes profile and provisions once before Home', async ({ page }) => {
  let state = null;
  let profileStatus = 'PENDING_PROFILE';
  let provisionCalls = 0;
  let canonicalSnapshot = null;
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.context().route(`${SUPABASE_URL}/rest/v1/**`, (route) => {
    const url = new URL(route.request().url());
    const table = url.pathname.split('/').at(-1);
    if (table === 'sync_mutation_receipts') {
      expect(url.searchParams.get('owner_id')).toBe('eq.' + OWNER);
      expect(url.searchParams.get('order')).toBe('mutation_id.asc');
    }
    const rows = canonicalSnapshot?.[table] ?? [];
    const offset = Number(url.searchParams.get('offset') ?? 0);
    const limit = Number(url.searchParams.get('limit') ?? rows.length);
    const pageRows = rows.slice(offset, offset + limit);
    const range = pageRows.length ? `${offset}-${offset + pageRows.length - 1}/${rows.length}` : `*/${rows.length}`;
    return route.fulfill({ json: pageRows, headers: { 'Content-Range': range,
      'Access-Control-Expose-Headers': 'Content-Range' } });
  });
  await page.context().route(`${SUPABASE_URL}/auth/v1/**`, (route) => route.fulfill({ json: SESSION.user }));
  await page.context().route(`${SUPABASE_URL}/rest/v1/rpc/account_contract`, (route) => route.fulfill({ json: contract(state, profileStatus) }));
  await page.context().route(`${SUPABASE_URL}/rest/v1/rpc/provision_account_profile`, (route) => {
    state = 'PROFILE_REQUIRED';
    return route.fulfill({ json: contract(state, profileStatus) });
  });
  await page.context().route(`${SUPABASE_URL}/rest/v1/rpc/complete_account_profile`, (route) => {
    expect(route.request().postDataJSON().p_phone).toBe('0500000001');
    expect(route.request().postDataJSON().p_teacher_form).toBe('feminine');
    profileStatus = 'READY'; state = 'PROVISIONING_REQUIRED';
    return route.fulfill({ json: contract(state, profileStatus) });
  });
  await page.context().route(`${SUPABASE_URL}/rest/v1/rpc/begin_account_provisioning`, (route) => {
    state = 'PROVISIONING';
    return route.fulfill({ json: contract(state, profileStatus) });
  });
  await page.context().route(`${SUPABASE_URL}/rest/v1/rpc/provision_account_workspace`, (route) => {
    provisionCalls += 1;
    state = 'READY';
    canonicalSnapshot = snapshot();
    return route.fulfill({ json: { contract: contract(state, profileStatus), snapshot: canonicalSnapshot } });
  });
  await page.goto('/');
  await sessionInto(page, { accounts: [{ slot: 'A', id: OWNER, email: SESSION.user.email }],
    tokens: { A1: { ownerVerified: true, accessToken: SESSION.access_token, refreshToken: SESSION.refresh_token,
      expiresAt: new Date(SESSION.expires_at * 1000).toISOString() } } }, 'A1');
  await page.reload();
  await expect(page.locator('[data-account-profile-required]')).toBeVisible();
  await expect(page.locator('[data-workspace-gate]')).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('[data-account-profile-form]')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(page.locator('[data-account-profile-form]')).toBeVisible();
  await page.locator('[name="teacherName"]').fill('معلمة اصطناعية');
  await page.locator('[name="phone"]').fill('٠٥٠٠٠٠٠٠٠١');
  await expect(page.locator('[name="phone"]')).toHaveValue('0500000001');
  await page.locator('[data-profile-form="feminine"]').click();
  await page.getByRole('button', { name: 'متابعة' }).click();
  await expect(page.locator('#main')).toBeVisible();
  // Finish mocked startup Sync before navigation tears down its in-flight requests.
  await expect.poll(() => page.evaluate(() => window.__syncModule?.displayState().status)).toBe('synced');
  expect(provisionCalls).toBe(1);
  expect(await ownerRows(page, 'sync_mutation_receipts')).toEqual([]);
  await page.reload();
  await expect(page.locator('#main')).toBeVisible();
  expect(provisionCalls).toBe(1);
  const local = await page.evaluate(async () => {
    const workspace = window.store?.getActiveWorkspace();
    const outbox = await new Promise((resolve, reject) => {
      const request = indexedDB.open(workspace.databaseName);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const database = request.result;
        const count = database.transaction('outbox', 'readonly').objectStore('outbox').count();
        count.onsuccess = () => { database.close(); resolve(count.result); };
        count.onerror = () => { database.close(); reject(count.error); };
      };
    });
    return { workspace, sections: window.store?.state?.sections?.length,
      students: window.store?.state?.students?.length, outbox };
  });
  expect(local.workspace?.authUserId).toBe(OWNER);
  expect(local.sections).toBe(0);
  expect(local.students).toBe(0);
  expect(local.outbox).toBe(0);
  expect(pageErrors).toEqual([]);
});
