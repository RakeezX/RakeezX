// Synthetic cloud transport and isolated workspace fixture; no external network.
import { DB_VERSION, STORES } from '../../src/lib/db.js';

const CLOUD_URL = 'https://xlrubcwjqktzzunrvuns.supabase.co/rest/v1/';
const AUTH_STORAGE_KEY = 'rakeezx-auth-v2-xl-rubcwjqktzzunrvuns';
const AUTH_OWNER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CLAIM_ID = 'claim:automatic-sync-a';
const TABLES = ['years', 'calendars', 'calendar_days', 'terms', 'subjects', 'sections', 'teachings', 'students', 'enrollments', 'items', 'scores', 'time_profiles', 'slots', 'sessions', 'attendance', 'notes'];
// Steady-state teacher fixture, not first-use calendar provisioning. Both
// devices begin from the same acknowledged canonical foundation.
const stamp = Date.now() - 5000;
const FOUNDATION = {
  profile: [{id:'profile',teacherName:'معلم سحابي',schoolName:'مدرسة سحابية',phone:'',serverRevision:1,updatedAt:stamp}],
  years: [{id:'remote-year',label:'Synthetic year',hijriStart:1450,hijriEnd:1451,status:'active',order:1450,serverRevision:1,updatedAt:stamp}],
  terms: [1,2].map(index=>({id:`remote-term-${index}`,yearId:'remote-year',name:`Synthetic ${index}`,index,
    status:index===1?'active':'upcoming',serverRevision:1,updatedAt:stamp})),
  subjects: [{id:'remote-subject',name:'Synthetic subject',slug:'synthetic',serverRevision:1,updatedAt:stamp}],
  timeProfiles: [{id:'remote-time',name:'Synthetic time',periods:[],overrides:{},order:0,serverRevision:1,updatedAt:stamp}],
};

export function createCloud() {
  let ownerRevision = 0;
  const pages = [];
  const signals = [];
  const activeByPage = new Map();
  let maxPerPage = 0;
  const tables = Object.fromEntries(TABLES.map((name) => [name, []]));
  const mapping={yearId:'year_id',hijriStart:'hijri_start',hijriEnd:'hijri_end',updatedAt:'client_updated_at',serverRevision:'revision'};
  for(const [store,rows] of Object.entries(FOUNDATION)) {
    if(store==='profile')continue;
    tables[store==='timeProfiles'?'time_profiles':store]=rows.map(row=>Object.fromEntries(
      Object.entries({...row,deleted_at:null,field_revisions:{}}).map(([key,value])=>[mapping[key]??key,value])));
  }
  const requests = [];
  let profile = { id:'profile',revision:1,teacher_name: 'معلم سحابي', school_name: 'مدرسة سحابية', phone: '', client_updated_at: stamp };
  let nextProfileWrite = null;
  let failNextProfileRead = false;
  let activeWrites = 0;
  let maxActiveWrites = 0;
  const nextTableRead = new Map();
  return {
    async route(page) {
      pages.push(page);
      await page.route('https://*.supabase.co/**', route => route.abort());
      await page.addInitScript(() => {
        const NativeWebSocket = window.WebSocket;
        window.__remoteSockets = [];
        window.__remoteSignalTimes = [];
        window.WebSocket = class {
          constructor(...args) {
            const [url] = args;
            if (!String(url).includes('/realtime/v1/websocket')) return new NativeWebSocket(...args);
            window.__remoteSockets.push(this); queueMicrotask(() => this.onopen?.());
          }
          send(raw) {
            const message = JSON.parse(raw);
            if (message.event === 'phx_join') {
              this.topic = message.topic;
              queueMicrotask(() => this.onmessage?.({ data: JSON.stringify({ topic: this.topic,
                event: 'phx_reply', ref: message.ref, payload: { status: 'ok' } }) }));
            } else if (message.event === 'heartbeat') queueMicrotask(() => this.onmessage?.({
              data: JSON.stringify({ topic: 'phoenix', event: 'phx_reply', ref: message.ref, payload: { status: 'ok' } }) }));
          }
          close() { this.closed = true; this.onclose?.(); }
        };
      });
      await page.route(`${CLOUD_URL}**`, async (route) => {
        const request = route.request();
        const table = new URL(request.url()).pathname.split('/').pop();
        requests.push({ client: pages.indexOf(page), table, method: request.method(), at: Date.now() });
        if (table === 'owner_sync_change_marker') return route.fulfill({ json: {
          protocol: 'OWNER_SIGNAL_V1', ownerId: AUTH_OWNER_ID, revision: String(ownerRevision), updatedAt: null } });
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
          activeByPage.set(page, (activeByPage.get(page) ?? 0) + 1);
          maxPerPage = Math.max(maxPerPage, activeByPage.get(page));
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
            ownerRevision++;
            signals.push({ revision: ownerRevision, at: Date.now() });
            for (const receiver of pages) {
              if (receiver.isClosed()) continue;
              await receiver.evaluate(({ revision, owner }) => {
                for (const socket of window.__remoteSockets ?? []) {
                  if (socket.closed || socket.topic !== `realtime:rakeezx-owner:${owner}`) continue;
                  window.__remoteSignalTimes.push({ revision, at: Date.now() });
                  socket.onmessage?.({ data: JSON.stringify({ topic: socket.topic, event: 'broadcast',
                    payload: { event: 'invalidate', payload: { revision: String(revision) } } }) });
                }
              }, { revision: ownerRevision, owner: AUTH_OWNER_ID });
            }
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
            activeByPage.set(page, activeByPage.get(page) - 1);
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
          const key = nextTableRead.has(`${pages.indexOf(page)}:${table}`) ? `${pages.indexOf(page)}:${table}` : table;
          const gate = nextTableRead.get(key);
          if (gate) {
            nextTableRead.delete(key);
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
    signals: () => [...signals],
    seed: (entity, row) => { (tables[entity] ??= []).push(row); },
    requests: () => [...requests],
    maxActiveWrites: () => maxActiveWrites,
    maxWritesPerClient: () => maxPerPage,
    failNextProfileRead: () => { failNextProfileRead = true; },
    table: (name) => tables[name] ?? [],
    holdNextProfileWrite() {
      let started; let release;
      const startedPromise = new Promise((resolve) => { started = resolve; });
      const wait = new Promise((resolve) => { release = resolve; });
      nextProfileWrite = { started, wait };
      return { started: startedPromise, release };
    },
    holdNextTableRead(table, page = null) {
      let started; let release;
      const startedPromise = new Promise((resolve) => { started = resolve; });
      const wait = new Promise((resolve) => { release = resolve; });
      nextTableRead.set(page ? `${pages.indexOf(page)}:${table}` : table, { started, wait });
      return { started: startedPromise, release };
    },
  };
}

export async function authenticated(page, cloud) {
  const deviceId = `synthetic-device:${crypto.randomUUID()}`;
  await page.route('**/__automatic-sync-workspace__', (route) => route.fulfill({
    contentType: 'text/html', body: '<!doctype html><title>automatic sync workspace fixture</title>',
  }));
  await page.goto('/__automatic-sync-workspace__');
  await page.evaluate(async ({ ownerId, claimId, stores, databaseVersion, foundation, deviceId }) => {
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
    const productTransaction = product.transaction(['device',...Object.keys(foundation)], 'readwrite');
    for(const [store,rows] of Object.entries(foundation))for(const row of rows)productTransaction.objectStore(store).put(row);
    productTransaction.objectStore('device').put({
      id: 'device', deviceId, schemaVersion: databaseVersion,
      workspaceClaim: {
        version: 1, claimId, state: 'claimed', ownerId,
        origin: location.origin, databaseName: 'rakeezx', deviceId,
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
  }, { ownerId: AUTH_OWNER_ID, claimId: CLAIM_ID, stores: STORES, databaseVersion: DB_VERSION, foundation:FOUNDATION,deviceId });
  await page.unroute('**/__automatic-sync-workspace__');
  await page.addInitScript(({ storageKey, ownerId }) => localStorage.setItem(storageKey, JSON.stringify({
    access_token: 'auto-sync-test-token', user: { id: ownerId },
  })), { storageKey: AUTH_STORAGE_KEY, ownerId: AUTH_OWNER_ID });
  await cloud.route(page);
}
