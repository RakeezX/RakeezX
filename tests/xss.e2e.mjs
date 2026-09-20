import { test, expect } from '@playwright/test';
import { AUTH_STORAGE_KEY, SUPABASE_URL } from '../src/lib/cloud.js';
import { STORES } from '../src/lib/db.js';

const XSS_OWNER = '9e3a9858-50bb-470e-91f6-8ea901ffb030';
const XSS_CLAIM_ID = 'claim:xss-security';

// Malicious payloads covering different contexts
const PAYLOADS = {
  script: '<script>window._xss_triggered = true</script>',
  img: '<img src=x onerror="window._xss_triggered=true">',
  svg: '"><svg onload="window._xss_triggered=true">',
  style: '<style>body{display:none !important}</style>',
  iframe: '"><iframe srcdoc="<script>window._xss_triggered=true</script>">'
};

const NOW = Date.now() + 86400000;
const today = new Date().toLocaleDateString('en-CA');
const MOCK_DB = {
  years: [{ id: 'y1', label: `1445 ${PAYLOADS.script}`, order: 1, client_updated_at: NOW }],
  terms: [{ id: 't1', year_id: 'y1', name: `T1 ${PAYLOADS.img}`, client_updated_at: NOW }],
  subjects: [{ id: 'sub1', name: `Math ${PAYLOADS.svg}`, client_updated_at: NOW }],
  sections: [{ id: 'sec1', year_id: 'y1', grade: 1, label: `A ${PAYLOADS.style}`, name: '1/A', client_updated_at: NOW }],
  teachings: [{ id: 'tch1', section_id: 'sec1', subject_id: 'sub1', term_id: 't1', client_updated_at: NOW }],
  students: [
    { id: 'std1', name: `Student 1 ${PAYLOADS.iframe}`, status: 'active', client_updated_at: NOW }
  ],
  enrollments: [
    { id: 'enr1', student_id: 'std1', section_id: 'sec1', status: 'active', client_updated_at: NOW }
  ],
  time_profiles: [{ id: 'tp1', name: `Default ${PAYLOADS.script}`, periods: [], client_updated_at: NOW }],
  slots: [],
  sessions: [{ id: 'sess1', teaching_id: 'tch1', date: today, period: 1, client_updated_at: NOW }],
  attendance: [{ id: 'att1', student_id: 'std1', session_id: 'sess1', status: 'present', client_updated_at: NOW }],
  profile: [{ id: '9e3a9858-50bb-470e-91f6-8ea901ffb030', owner_id: '9e3a9858-50bb-470e-91f6-8ea901ffb030', teacher_name: `Teacher ${PAYLOADS.img}`, school_name: `School ${PAYLOADS.svg}`, client_updated_at: NOW }]
};

async function setupMockCloud(page) {
  await page.route('**/__xss-workspace__', (route) => route.fulfill({
    contentType: 'text/html', body: '<!doctype html><title>xss workspace fixture</title>',
  }));
  await page.goto('/__xss-workspace__');
  await page.evaluate(async ({ stores, authKey, ownerId, claimId }) => {
    const request = (operation) => new Promise((resolve, reject) => {
      operation.onsuccess = () => resolve(operation.result);
      operation.onerror = () => reject(operation.error);
    });
    const transaction = (tx) => new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    const productRequest = indexedDB.open('rakeezx', 7);
    productRequest.onupgradeneeded = () => {
      for (const store of stores) {
        if (!productRequest.result.objectStoreNames.contains(store)) {
          productRequest.result.createObjectStore(store, { keyPath: 'id' });
        }
      }
    };
    const product = await request(productRequest);
    const productTx = product.transaction(['device', 'profile'], 'readwrite');
    productTx.objectStore('device').put({
      id: 'device', deviceId: 'device:xss-security', schemaVersion: 7,
      workspaceClaim: {
        version: 1, claimId, state: 'claimed', ownerId,
        origin: location.origin, databaseName: 'rakeezx', deviceId: 'device:xss-security',
        evidenceHash: 'xss-security-evidence', createdAt: 100, updatedAt: 100,
      },
    });
    productTx.objectStore('profile').put({ id: 'profile', serverRevision: 1, updatedAt: 100 });
    await transaction(productTx);
    product.close();

    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`rakeezx-workspace-v1:${ownerId}`));
    const key = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('').slice(0, 32);
    const registryRequest = indexedDB.open('rakeezx-workspace-registry', 1);
    registryRequest.onupgradeneeded = () => {
      const workspaceStore = registryRequest.result.createObjectStore('workspaces', { keyPath: 'id' });
      workspaceStore.createIndex('authUserId', 'authUserId', { unique: false });
    };
    const registry = await request(registryRequest);
    const registryTx = registry.transaction('workspaces', 'readwrite');
    registryTx.objectStore('workspaces').put({
      id: `account:${key}`, type: 'account', authUserId: ownerId,
      databaseName: 'rakeezx', ownershipState: 'claimed', workspaceKind: 'legacy-in-place',
      claimId, evidenceHash: 'xss-security-evidence', createdAt: 100, updatedAt: 100,
    });
    await transaction(registryTx);
    registry.close();
    localStorage.setItem(authKey, JSON.stringify({ access_token: 'fake', user: { id: ownerId } }));
  }, { stores: STORES, authKey: AUTH_STORAGE_KEY, ownerId: XSS_OWNER, claimId: XSS_CLAIM_ID });
  await page.unroute('**/__xss-workspace__');

  await page.route(`${SUPABASE_URL}/rest/v1/*`, async route => {
    const request = route.request();
    const url = new URL(request.url());
    const table = url.pathname.split('/').pop();

    if (request.method() === 'GET') {
      await route.fulfill({ json: MOCK_DB[table] || [] });
    } else {
      await route.continue();
    }
  });
}

test.describe('XSS Security Regression', () => {
  let errors = [];

  test.beforeEach(async ({ page }) => {
    errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (!text.includes('favicon.ico') && !text.includes('vite') && !text.includes('504')) {
          errors.push(text);
        }
      }
    });
    // Set up a flag on window to catch executions
    await page.addInitScript(() => {
      window._xss_triggered = false;
    });

    await page.goto('/');
    await setupMockCloud(page);
    await page.goto('/');
    await expect(page.locator('.sidebar__brand').or(page.locator('.topbar__title')).first()).toBeVisible({ timeout: 15000 });
  });

  const routesToTest = [
    '#/',
    '#/classes',
    '#/students',
    '#/schedule',
    '#/attendance',
    '#/settings',
    '#/teaching/tch1',
    '#/teaching/tch1/students'
  ];

  for (const route of routesToTest) {
    test(`No XSS execution on ${route}`, async ({ page }) => {
      await page.goto(`/${route}`);
      // Give it some time to render and potentially execute malicious scripts
      await page.waitForTimeout(500);
      
      const xssTriggered = await page.evaluate(() => window._xss_triggered);
      expect(xssTriggered).toBe(false);

      // check if style was injected
      const bodyDisplay = await page.evaluate(() => window.getComputedStyle(document.body).display);
      expect(bodyDisplay).not.toBe('none');

      // Check for unescaped HTML elements
      const injectedTags = await page.evaluate(() => {
        return !!document.querySelector('img[src="x"], svg[onload], iframe[srcdoc]');
      });
      expect(injectedTags).toBe(false);
    });
  }
});
