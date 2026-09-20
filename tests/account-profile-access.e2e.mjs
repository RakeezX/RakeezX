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

test('Settings exposes the minimal profile and free beta access contract without editable email', async ({ page }) => {
  await page.route(`${SUPABASE_URL}/rest/v1/**`, (route) => route.fulfill({ json: [] }));
  await page.route(`${SUPABASE_URL}/rest/v1/rpc/account_contract`, (route) => route.fulfill({ json: {
    ownerId: OWNER, profileStatus: 'READY',
    profile: { teacherName: 'معلمة الاختبار', phone: '0500000000', teacherForm: 'feminine', schoolName: '' },
    access: { grantType: 'beta_full', status: 'active', source: 'public_beta', expiresAt: null },
  } }));
  await page.route(`${SUPABASE_URL}/auth/v1/user`, (route) => route.fulfill({ json: SESSION.user }));
  await seedClaimedWorkspace(page);
  await page.goto('/#/settings');
  await expect(page.locator('input[name="teacherName"]')).toHaveValue('معلمة الاختبار');
  await expect(page.locator('input[name="phone"]')).toHaveValue('0500000000');
  await expect(page.locator('select[name="teacherForm"]')).toHaveValue('feminine');
  await expect(page.locator('input[type="email"]')).toHaveValue(SESSION.user.email);
  await expect(page.locator('input[type="email"]')).toHaveAttribute('readonly', '');
  await expect(page.getByText('الوصول التجريبي المجاني', { exact: true })).toBeVisible();
  await expect(page.getByText('صيغة المخاطبة الحالية: أستاذة', { exact: true })).toBeVisible();
  await expect(page.locator('input[name="phone"]')).toHaveAttribute('required', '');
  await expect(page.locator('input[name="schoolName"]')).not.toHaveAttribute('required', '');
});
