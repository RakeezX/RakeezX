import { test, expect } from '@playwright/test';
import { STORES } from '../src/lib/db.js';
import { AUTH_STORAGE_KEY, SUPABASE_URL } from '../src/lib/cloud.js';

const OWNER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const SESSION = {
  access_token: 'account-profile-test-token', refresh_token: 'account-profile-test-refresh', expires_at: 4_102_444_800,
  user: { id: OWNER, email: 'teacher@example.test' },
};

async function seedClaimedWorkspace(page) {
  await page.route('**/__account_profile_fixture__', (route) => route.fulfill({ body: '<!doctype html><title>fixture</title>' }));
  await page.goto('/__account_profile_fixture__');
  await page.evaluate(async ({ stores, owner, authKey, session }) => {
    const result = (request) => new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    const done = (tx) => new Promise((resolve, reject) => {
      tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
    });
    const productRequest = indexedDB.open('rakeezx', 7);
    productRequest.onupgradeneeded = () => stores.forEach((name) => {
      if (!productRequest.result.objectStoreNames.contains(name)) productRequest.result.createObjectStore(name, { keyPath: 'id' });
    });
    const product = await result(productRequest);
    const tx = product.transaction(['device', 'profile'], 'readwrite');
    tx.objectStore('device').put({
      id: 'device', deviceId: 'device:account-profile', schemaVersion: 7,
      workspaceClaim: { version: 1, claimId: 'claim:account-profile', state: 'claimed', ownerId: owner,
        origin: location.origin, databaseName: 'rakeezx', deviceId: 'device:account-profile',
        evidenceHash: 'account-profile-evidence', createdAt: 100, updatedAt: 100 },
    });
    tx.objectStore('profile').put({
      id: 'profile', teacherName: 'معلمة الاختبار', phone: '0500000000', schoolName: '',
      teacherForm: 'feminine', serverRevision: 1, updatedAt: 100,
    });
    await done(tx); product.close();
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`rakeezx-workspace-v1:${owner}`));
    const key = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('').slice(0, 32);
    const registryRequest = indexedDB.open('rakeezx-workspace-registry', 1);
    registryRequest.onupgradeneeded = () => {
      const store = registryRequest.result.createObjectStore('workspaces', { keyPath: 'id' });
      store.createIndex('authUserId', 'authUserId', { unique: false });
    };
    const registry = await result(registryRequest);
    const registryTx = registry.transaction('workspaces', 'readwrite');
    registryTx.objectStore('workspaces').put({
      id: `account:${key}`, type: 'account', authUserId: owner, databaseName: 'rakeezx', ownershipState: 'claimed',
      workspaceKind: 'legacy-in-place', claimId: 'claim:account-profile', evidenceHash: 'account-profile-evidence',
      createdAt: 100, updatedAt: 100,
    });
    await done(registryTx); registry.close();
    localStorage.setItem(authKey, JSON.stringify(session));
  }, { stores: STORES, owner: OWNER, authKey: AUTH_STORAGE_KEY, session: SESSION });
  await page.unroute('**/__account_profile_fixture__');
}

async function localOutboxCount(page) {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const open = indexedDB.open('rakeezx');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const database = open.result;
      const request = database.transaction('outbox', 'readonly').objectStore('outbox').count();
      request.onsuccess = () => { database.close(); resolve(request.result); };
      request.onerror = () => { database.close(); reject(request.error); };
    };
  }));
}

test('Settings exposes polished profile controls and read-only account information', async ({ page }, testInfo) => {
  const emailUpdates = [];
  await page.route(`${SUPABASE_URL}/rest/v1/**`, (route) => route.fulfill({ json: [] }));
  await page.route(`${SUPABASE_URL}/rest/v1/rpc/account_contract`, (route) => route.fulfill({ json: {
    ownerId: OWNER, profileStatus: 'READY',
    profile: { teacherName: 'معلمة الاختبار', phone: '0500000000', teacherForm: 'feminine', schoolName: '' },
    access: { grantType: 'beta_full', status: 'active', source: 'public_beta', expiresAt: null },
  } }));
  await page.route(`${SUPABASE_URL}/auth/v1/user`, async (route) => {
    if (route.request().method() !== 'PUT') return route.fulfill({ json: SESSION.user });
    emailUpdates.push({ body: route.request().postDataJSON(), authorization: route.request().headers().authorization });
    return route.fulfill({ json: { ...SESSION.user, new_email: route.request().postDataJSON().email } });
  });
  await seedClaimedWorkspace(page);
  await page.goto('/#/settings');
  await expect(page.locator('input[name="teacherName"]')).toHaveValue('معلمة الاختبار');
  await expect(page.getByText('اسم المعلمة', { exact: true })).toBeVisible();
  await expect(page.getByText(/اسم المديرة/, { exact: false })).toBeVisible();
  await expect(page.getByText('اسم المدرسة', { exact: false })).toBeVisible();
  await expect(page.getByText('صفة المستخدم', { exact: true })).toBeVisible();
  await expect(page.getByText('تظهر على التقارير والكشوف التي تطبعها.', { exact: false })).toHaveCount(0);
  const profileRows = page.locator('.settings-identity-form > .field-row');
  await expect(profileRows).toHaveCount(3);
  await expect(profileRows.nth(0)).toContainText('اسم المعلمة');
  await expect(profileRows.nth(0)).toContainText('صفة المستخدم');
  await expect(profileRows.nth(1)).toContainText('اسم المدرسة');
  await expect(profileRows.nth(1)).toContainText('اسم المديرة');
  await expect(profileRows.nth(2)).toContainText('رقم الجوال');
  await expect(profileRows.nth(2)).toContainText('البريد الإلكتروني');
  await expect(page.locator('input[name="phone"]')).toHaveValue('0500000000');
  await expect(page.getByRole('button', { name: 'معلمة', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'معلم', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('input[type="email"]')).toHaveCount(0);
  await expect(page.locator('[data-account-email]')).toHaveText(SESSION.user.email);
  await expect(page.locator('[data-account-email]').locator('xpath=ancestor::*[contains(@class,"settings-email-field")]')).toContainText('البريد الإلكتروني');
  await expect(page.getByText('الوصول التجريبي', { exact: true })).toBeVisible();
  await expect(page.locator('[data-account-access]')).toHaveClass(/badge/);
  await expect(page.locator('[data-account-access]')).not.toHaveClass(/input/);
  await expect(page.locator('[data-account-access]').locator('xpath=ancestor::*[contains(@class,"settings-access-summary")]')).toContainText('الوصول');
  await expect(page.locator('[data-account-access]').locator('xpath=ancestor::*[contains(@class,"settings-access-summary")]').locator('input, button')).toHaveCount(0);
  await expect(page.locator('.settings-account-summary')).toHaveCount(0);
  await expect(page.getByText(/تؤثر في صيغة المخاطبة|صيغة المخاطبة الحالية/)).toHaveCount(0);
  await expect(page.locator('input[name="phone"]')).toHaveAttribute('required', '');
  await expect(page.locator('input[name="phone"]')).toHaveAttribute('pattern', '05[0-9]{8}');
  await expect(page.getByText('خاص ببيانات الحساب ولا يظهر للطلاب.', { exact: true })).toBeVisible();
  await expect(page.locator('input[name="schoolName"]')).not.toHaveAttribute('required', '');

  const phone = page.locator('input[name="phone"]');
  await page.screenshot({ path: testInfo.outputPath('settings-phone-10-digits.png'), fullPage: true });
  await phone.evaluate((element) => element.setSelectionRange(0, 0));
  await phone.pressSequentially('9');
  await expect(phone).toHaveValue('0500000000');
  await phone.evaluate((element) => element.setSelectionRange(5, 5));
  await phone.pressSequentially('9');
  await expect(phone).toHaveValue('0500000000');
  await phone.evaluate((element) => element.setSelectionRange(2, 3));
  await phone.pressSequentially('1');
  await expect(phone).toHaveValue('0510000000');
  await phone.evaluate((element) => element.setSelectionRange(3, 5));
  await phone.pressSequentially('23');
  await expect(phone).toHaveValue('0512300000');
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(page.url()).origin });
  await page.evaluate(() => navigator.clipboard.writeText('0500000000123'));
  await phone.evaluate((element) => element.setSelectionRange(4, 4));
  await phone.press('Control+V');
  await expect(phone).toHaveValue('0512300000');
  await phone.fill('abc٠٥١٢٣٤٥٦٧٨99');
  await expect(phone).toHaveValue('0512345678');
  await phone.fill('0412345678');
  await phone.blur();
  await expect(phone).toHaveAttribute('aria-invalid', 'true');
  await page.reload();
  await expect(phone).toHaveValue('0500000000');

  const beforeEmailChange = await page.evaluate(async () => ({
    ownerId: window.store.getActiveWorkspace().authUserId,
    databaseName: window.store.getActiveWorkspace().databaseName,
    profile: { ...window.store.state.profile },
    databaseNames: (await indexedDB.databases()).map(({ name }) => name).sort(),
  }));
  const beforeOutboxCount = await localOutboxCount(page);
  await page.getByRole('button', { name: 'تعديل', exact: true }).click();
  const emailDialog = page.getByRole('dialog', { name: 'تغيير البريد الإلكتروني' });
  await expect(emailDialog).toBeVisible();
  const newEmail = emailDialog.locator('input[name="newEmail"]');
  await newEmail.fill('invalid');
  await emailDialog.getByRole('button', { name: 'تأكيد التغيير' }).click();
  await expect(emailDialog.getByRole('alert')).toHaveText('أدخل بريدًا إلكترونيًا صالحًا.');
  expect(emailUpdates).toHaveLength(0);
  await newEmail.fill('TEACHER@example.test');
  await emailDialog.getByRole('button', { name: 'تأكيد التغيير' }).click();
  await expect(emailDialog.getByRole('alert')).toHaveText('أدخل بريدًا مختلفًا عن البريد الحالي.');
  expect(emailUpdates).toHaveLength(0);
  await newEmail.fill(' NEW-TEACHER@EXAMPLE.TEST ');
  await emailDialog.getByRole('button', { name: 'تأكيد التغيير' }).click();
  await expect(emailDialog).toHaveCount(0);
  await expect(page.locator('[data-account-email]')).toHaveText(SESSION.user.email);
  await expect(page.locator('[data-email-change-pending]')).toHaveText('طلب تغيير البريد قيد التأكيد');
  expect(emailUpdates).toEqual([{ body: { email: 'new-teacher@example.test' }, authorization: `Bearer ${SESSION.access_token}` }]);
  const afterEmailChange = await page.evaluate(async (authKey) => ({
    ownerId: window.store.getActiveWorkspace().authUserId,
    databaseName: window.store.getActiveWorkspace().databaseName,
    profile: { ...window.store.state.profile },
    authOwnerId: JSON.parse(localStorage.getItem(authKey)).user.id,
    databaseNames: (await indexedDB.databases()).map(({ name }) => name).sort(),
  }), AUTH_STORAGE_KEY);
  const afterOutboxCount = await localOutboxCount(page);
  expect(afterEmailChange.ownerId).toBe(beforeEmailChange.ownerId);
  expect(afterEmailChange.authOwnerId).toBe(OWNER);
  expect(afterEmailChange.databaseName).toBe(beforeEmailChange.databaseName);
  expect(afterEmailChange.databaseNames).toEqual(beforeEmailChange.databaseNames);
  expect(afterOutboxCount).toBe(beforeOutboxCount);
  expect(afterEmailChange.profile.email).toBeUndefined();
  expect(afterEmailChange.profile).toEqual(beforeEmailChange.profile);

  await page.getByRole('button', { name: 'معلم', exact: true }).click();
  await expect(page.getByRole('button', { name: 'معلم', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('اسم المعلم', { exact: true })).toBeVisible();
  await expect(page.getByText(/اسم المدير/, { exact: false })).toBeVisible();
  await expect(page.getByText('اسم المدرسة', { exact: false })).toBeVisible();
  await expect(page.locator('[data-account-email]')).toHaveText(SESSION.user.email);
  await expect(page.locator('[data-account-access]')).toHaveText('الوصول التجريبي');
  await page.reload();
  await expect(page.getByRole('button', { name: 'معلم', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-account-email]')).toHaveText(SESSION.user.email);
  await expect(page.locator('[data-email-change-pending]')).toHaveText('طلب تغيير البريد قيد التأكيد');
});
