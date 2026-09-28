import { STORES, DB_VERSION } from '../../src/lib/db.js';
import { AUTH_STORAGE_KEY, SUPABASE_URL } from '../../src/lib/cloud.js';
const OWNER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const SESSION = {
  access_token: 'account-profile-test-token', refresh_token: 'account-profile-test-refresh', expires_at: 4_102_444_800,
  user: { id: OWNER, email: 'teacher@example.test' },
};

export async function seedClaimedWorkspace(page) {
  await page.route('**/__account_profile_fixture__', (route) => route.fulfill({ body: '<!doctype html><title>fixture</title>' }));
  await page.goto('/__account_profile_fixture__');
  await page.evaluate(async ({ stores, owner, authKey, session, version }) => {
    const result = (request) => new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    const done = (tx) => new Promise((resolve, reject) => {
      tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
    });
    const productRequest = indexedDB.open('rakeezx', version);
    productRequest.onupgradeneeded = () => stores.forEach((name) => {
      if (!productRequest.result.objectStoreNames.contains(name)) productRequest.result.createObjectStore(name, { keyPath: 'id' });
    });
    const product = await result(productRequest);
    const tx = product.transaction(['device', 'profile'], 'readwrite');
    tx.objectStore('device').put({
      id: 'device', deviceId: 'device:account-profile', schemaVersion: version,
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
  }, { stores: STORES, owner: OWNER, authKey: AUTH_STORAGE_KEY, session: SESSION, version: DB_VERSION });
  await page.unroute('**/__account_profile_fixture__');
}


export async function bootSettings(page, { pending = false, unavailable = false } = {}) {
  const errors = [], requests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.routeWebSocket('wss://*.supabase.co/**', socket => socket.close());
  await page.route(`${SUPABASE_URL}/**`, route => {
    requests.push(route.request().url());
    if (route.request().url().endsWith('/rpc/account_contract')) return route.fulfill({ json: unavailable ? {} : {
      ownerId: OWNER, profileStatus: 'READY',
      profile: { teacherName: 'معلمة الاختبار', phone: '0500000000', teacherForm: 'feminine', schoolName: '' },
      access: { grantType: 'beta_full', status: 'active', source: 'public_beta', expiresAt: null },
    } });
    if (route.request().url().endsWith('/auth/v1/user')) return route.fulfill({ json: { ...SESSION.user, ...(pending ? { new_email: 'pending@example.test' } : {}) } });
    if (route.request().url().endsWith('/rpc/apply_sync_v2_mutation')) {
      const p = route.request().postDataJSON();
      return route.fulfill({ json: { mutationId: p.p_mutation_id, entity: p.p_entity, recordId: p.p_record_id,
        canonicalId: p.p_record_id, outcome: 'applied', appliedGroups: Object.keys(p.p_patch || {}),
        conflictedGroups: [], resultRevision: 1,
        canonical: { id: p.p_record_id, ...p.p_patch, revision: 1, field_revisions: {}, deleted_at: null } } });
    }
    return route.fulfill({ json: [] });
  });
  await seedClaimedWorkspace(page);
  if (pending) await page.evaluate(key => { const session = JSON.parse(localStorage.getItem(key)); session.user.new_email = 'pending@example.test'; localStorage.setItem(key, JSON.stringify(session)); }, AUTH_STORAGE_KEY);
  await page.goto('/#/settings');
  await page.locator('[data-settings-profile]').waitFor();
  return { errors, requests };
}

export async function bootDemoSettings(page) {
  const errors = [], requests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.routeWebSocket('wss://*.supabase.co/**', socket => socket.close());
  await page.route(`${SUPABASE_URL}/**`, route => { requests.push(route.request().url()); return route.abort(); });
  await page.route('**/__demo_settings_fixture__', route => route.fulfill({ body: '<!doctype html><title>fixture</title>' }));
  await page.goto('/__demo_settings_fixture__');
  await page.evaluate(async ({ stores, version }) => {
    await new Promise((resolve, reject) => {
      const request = indexedDB.open('rakeezx-demo', version);
      request.onupgradeneeded = () => stores.forEach(name => { if (!request.result.objectStoreNames.contains(name)) request.result.createObjectStore(name, { keyPath: 'id' }); });
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result, tx = db.transaction(['meta', 'profile'], 'readwrite');
        tx.objectStore('meta').put({ id: 'demo:workspace-seed-v3', version: 3, seededAt: 100 });
        tx.objectStore('profile').put({ id: 'profile', teacherName: 'معلم التجربة', phone: '0500000000', teacherForm: 'masculine', updatedAt: 100 });
        tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => reject(tx.error);
      };
    });
    sessionStorage.setItem('rakeezx-demo-session-v1', 'active');
  }, { stores: STORES, version: DB_VERSION });
  await page.unroute('**/__demo_settings_fixture__');
  await page.goto('/#/settings');
  await page.locator('[data-demo-settings]').waitFor();
  return { errors, requests };
}
