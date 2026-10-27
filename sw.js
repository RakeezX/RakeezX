/**
 * RAKEEZ X — عامل الخدمة.
 * يخزّن التطبيق كاملًا في أول زيارة، فيعمل بعدها دون إنترنت.
 * غيّر VERSION عند كل تحديث ليُحدَّث المخزون على أجهزة المعلّم.
 */

const VERSION = 'rakeezx-v91';
const CACHE_PREFIX = 'rakeezx-v';
const CACHE_GENERATION = Number(VERSION.slice(CACHE_PREFIX.length));

const rakeezCacheGeneration = (key) => {
  if (!key.startsWith(CACHE_PREFIX)) return null;
  const generation = Number(key.slice(CACHE_PREFIX.length));
  return Number.isInteger(generation) && generation >= 0 ? generation : null;
};

const clearOldRakeezCaches = async () => {
  const keys = await caches.keys();
  await Promise.all(
    keys
      // A prior worker can still control a page while this release installs.
      // It may remove only older generations, never a cache being built by a
      // newer worker.
      .filter((key) => {
        const generation = rakeezCacheGeneration(key);
        return generation !== null && generation < CACHE_GENERATION;
      })
      .map((key) => caches.delete(key))
  );
};

const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/favicon-32.png',
  './assets/favicon-32.png?v=19',
  './assets/icon-180.png',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/icon-maskable.png',
  './assets/header-light-standard.svg',
  './assets/header-light-compact.svg',
  './assets/header-dark-standard.svg',
  './assets/header-dark-compact.svg',
  './assets/micro-mark.svg',

  './src/styles/app.css',
  './src/styles/teacher-setup-import.css',
  './src/styles/notifications.css',
  './src/styles/components.css',
  './src/styles/grades.css',
  './src/styles/schedule-work-integration.css',
  './src/styles/calendar-work-0417.css',
  './src/styles/rakeez-datetime.css',
  './src/styles/work-n70.css',
  './src/styles/work-n82.css',

  './src/vendor/flatpickr/flatpickr.min.css',
  './src/vendor/flatpickr/flatpickr.min.js',
  './src/vendor/flatpickr/ar.js',

  './src/app.js',
  // AI N126: complete opt-in local Portfolio Preview shell.
  './src/views/portfolio-design-preview.js',
  './src/styles/portfolio-design-preview.css',
  './src/lib/portfolio-design-preview.js',
  './src/lib/portfolio-annual-plan.js',
  './src/lib/portfolio-smart-evidence.js',
  './src/lib/portfolio-evidence-templates.js',
  './src/lib/portfolio-local-draft.js',
  './src/lib/portfolio-local-state.js',
  './src/lib/portfolio-local-archive.js',

  './src/lib/app-update.js',
  './src/router.js',
  './src/lib/student-portal-client.js',
  './src/lib/student-portal-runtime.js',
  './src/lib/student-portal-class-client.js',
  './src/lib/student-portal-task-guidance-client.js',
  './src/views/student-portal-class.js',
  './src/styles/student-portal-class.css',
  './src/views/student-portal.js',
  './src/views/student-portal-teacher.js',
  './src/styles/student-portal.css',
  './src/views/n88-student-invite-lab.js',
  './src/views/n88-public-guest.js',
  './src/lib/n88-invite-lab.js',
  './src/store.js',
  './src/models.js',
  './src/lib/class-order.js',
  './src/repaint.js',

  './src/lib/dom.js',
  './src/lib/calendar-recovery.js',
  './src/lib/teacher-setup-import.js',
  './src/lib/n36-extension-handoff.js',
  './src/lib/n36-extension-protocol.js',
  './src/lib/notification-center.js',
  './src/lib/notification-push-core.js',
  './src/lib/notification-push-client.js',
  './src/lib/notification-push-browser.js',
  './src/lib/notification-push-gateway.js',
  './src/lib/notification-push-runtime.js',
  './src/lib/notification-events.js',
  './src/lib/notification-state.js',
  './src/lib/visible-numerals.js',
  './src/lib/sync-status-severity.js',
  './src/lib/sync-warning-policy.js',
  './src/lib/student-achievements.js',
  './src/lib/achievement-certificate.js',
  './src/lib/certificate-pdf.js',
  './src/lib/certificate-designs.js',
  './src/lib/certificate-center.js',
  './src/lib/certificate-selection.js',
  './src/lib/ministry-brand.js',
  './assets/brand/ministry-of-education.png',
  './assets/fonts/noto-naskh-arabic/NotoNaskhArabic-Bold.ttf',
  './assets/certificates/title-approved-first-gold.svg',
  './assets/certificates/title-approved-first-green.svg',
  './src/styles/certificate-center.css',
  './src/lib/document-preview.js',
  './src/styles/achievement-certificate.css',
  './src/styles/document-preview.css',
  './src/lib/day-targeting.js',
  './src/lib/hijri-year-input.js',
  './src/lib/education-department-directory.js',
  './src/data/education-departments-2026-09-30.json',
  './src/data/education-department-options-2026-09-30.json',
  './src/lib/student-import.js',
  './src/lib/class-import-file.js',
  './src/views/class-import-center.js',
  './src/lib/student-import-parsers.js',
  './src/lib/grade-transfer.js',
  './src/lib/class-import-background.js',
  './src/lib/grade-transfer-parsers.js',
  './src/lib/grade-transfer-export.js',
  './src/lib/grade-transfer-xlsx.js',
  './src/lib/zip.js',
  './src/lib/class-koshoof-bundle.js',
  './src/lib/rakeez-datetime.js',
  './src/lib/rakeez-datetime-values.js',
  './src/lib/brand.js',
  './src/lib/db.js',
  './src/lib/export.js',
  './src/lib/migrate.js',
  './src/lib/cloud.js',
  './src/lib/marketing-analytics.js',
  './src/lib/class-subject-default.js',
  './src/lib/complete-read.js',
  './src/lib/display-identity.js',
  './src/lib/group-count-ui.js',
  './src/lib/install-guide-ui.js',
  './src/lib/session-start-ui.js',
  './src/lib/settings-profile-ui.js',
  './src/lib/student-search-ui.js',
  './src/lib/visible-viewport.js',
  './src/lib/email-otp.js',
  './src/lib/sync.js',
  './src/lib/remote-sync.js',
  './src/lib/owner-invalidation-channel.js',
  './src/lib/sync-v2.js',
  './src/lib/session-recovery.js',
  './src/lib/score-foundation.js',
  './src/lib/score-distribution-copy.js',
  './src/lib/score-distribution-copy.js?n100=automatic-safe-v1',
  './src/lib/subitem-default-name.js',
  './src/lib/sync-ownership.js',
  './src/lib/offline-lease.js',
  './src/lib/workspaces.js',
  './src/lib/workspace-claim.js',
  './src/lib/workspace-routing.js',
  './src/lib/account-profile.js',
  './src/lib/account-provisioning.js',
  './src/lib/initial-restore.js',
  './src/lib/curriculum-bootstrap.js',
  './src/lib/sync-operational-ui.js',
  './src/lib/avatar.js',
  './src/lib/backup-v2.js',
  './src/lib/n77-delete.js',
  './src/lib/restore-deletion-scope.js',
  './src/lib/build-meta.js',
  './src/lib/cloud-recovery-ui.js',
  './src/lib/report-print.js',
  './src/lib/thmanyah-font.js',
  './src/lib/thmanyah-payload.js',
  './src/lib/schedule-export.js',
  './src/lib/session-auto.js',
  './src/lib/session-editor-ui.js',
  './src/lib/session-delete-ui.js',
  './src/lib/student-lifecycle.js',
  './src/lib/student-lifecycle-ui.js',
  './src/lib/pristine-teaching.js',
  './src/lib/support.js',
  './src/lib/support-whatsapp.js',
  './src/lib/support-public-config.js',
  './src/lib/support-origin.js',
  './src/lib/demo.js',
  './src/lib/demo-workspace.js',
  './src/lib/calendar-presets.js',
  './src/lib/calendar-runtime.js',
  './src/lib/subject-catalog.js',
  './src/lib/stage-subject-options.js',
  './src/lib/official-v6-subject-data.js',
  './src/lib/effects.js',
  './src/lib/sound.js',

  './src/views/home.js',
  './src/views/notifications.js',
  './src/views/teachings.js',
  './src/views/teaching-hub.js',
  './src/views/class-rules.js',
  './src/views/students.js',
  './src/views/attendance.js',
  './src/views/quicklog.js',
  './src/views/grades.js',
  './src/views/items.js',
  './src/views/picker.js',
  './src/views/groups.js',
  './src/views/board.js',
  './src/views/sessions.js',
  './src/views/reports.js',
  './src/views/reports-index.js',
  './src/views/certificates.js',
  './src/views/cross-class-reports.js',
  './src/views/execution-report.js',
  './src/views/archive.js',
  './src/views/archive-detail.js',
  './src/views/former-students.js',
  './src/views/student.js',
  './src/views/schedule.js',
  './src/views/times.js',
  './src/views/curriculum.js',
  './src/views/calendar.js',
  './src/views/calendar-0417-ui.js',
  './src/views/settings.js',
  './src/views/notification-settings.js',
  './src/views/teacher-setup-import.js',
  './src/views/backup.js',
  './src/views/support.js',

  './src/generated/build-meta.generated.js',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    (async () => {
      const cache = await caches.open(VERSION);
      // The version-bound copy engine is required for the store's import graph.
      // Never activate a shell that cannot provide its matching offline engine.
      await Promise.all([
        './src/lib/score-distribution-copy.js?n100=automatic-safe-v1',
        './src/lib/app-update.js',
        './src/lib/class-order.js',
        './src/lib/n36-extension-handoff.js',
        './src/lib/n36-extension-protocol.js',
        './src/views/n88-public-guest.js',
        './src/app.js',
        './src/lib/notification-push-runtime.js',
        './src/lib/notification-push-browser.js',
        './src/lib/notification-push-gateway.js',
        './src/lib/notification-push-client.js',
        './src/lib/notification-push-core.js',
        './src/store.js',
        './src/views/calendar.js',
      ].map(url => cache.add(new Request(url, { cache: 'reload' }))));
      // ملف واحد مفقود يجب ألا يفشل التثبيت كله
      await Promise.all(
        SHELL.map((url) =>
          cache.add(new Request(url, { cache: 'reload' })).catch((err) => {
            console.warn('[sw] تعذّر تخزين', url, err);
          })
        )
      );
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Cache Storage only: IndexedDB and all unrelated cache namespaces remain untouched.
      await clearOldRakeezCaches();
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Do not cache API/Supabase requests or anything cross-origin
  if (url.origin !== self.location.origin) return;
  // Private service responses and private entry navigation never enter any shell cache.
  if (/^\/(?:api\/(?:n88|n44)(?:\/|$)|s\/|student(?:\/|$)|n88-private(?:\/|$))/.test(url.pathname) || url.pathname === '/__n44_device_consent') return;
  // Ignore non-http(s) requests like chrome-extension://
  if (!url.protocol.startsWith('http')) return;

  // An older worker can finish an in-flight write after activation. Clean only our
  // prior release caches before this worker serves its first and later requests.
  const cleanOldCaches = clearOldRakeezCaches();

  const cacheResponse = async (key, response) => {
    if (!response || !response.ok) return response;
    const cache = await caches.open(VERSION);
    await cache.put(key, response.clone());
    return response;
  };

  const cachedFallback = async (key, status = 504) => {
    const cached = await (await caches.open(VERSION)).match(key);
    return cached || new Response('', { status });
  };

  const cachedNavigationFallback = async () => {
    // Cloudflare Pages redirects /index.html to /. Returning that cached
    // redirected response from respondWith() makes Chrome fail the navigation.
    // The canonical root shell is cached separately as a non-redirected 200.
    return (await caches.match('./')) || cachedFallback('./index.html', 503);
  };

  // Navigation requests: Network-First. Hash routes still resolve to this shell.
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        await cleanOldCaches;
        try {
          const response = await fetch(new Request(request, { cache: 'reload' }));
          // Keep both navigation fallback keys at the same refreshed release.
          if (!response.redirected) await cacheResponse('./', response);
          return await cacheResponse('./index.html', response);
        } catch (err) {
          try {
            return await cachedNavigationFallback();
          } catch (e) {
            console.warn('[sw] Cache match error for index.html', e);
          }
          return new Response('التطبيق غير متاح دون إنترنت بعد. افتحه مرة وأنت متصل.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          });
        }
      })()
    );
    return;
  }

  // Executable UI assets must reflect the current deployment while online.
  // Offline, the last verified response remains available from Cache Storage.
  if (/\.(?:m?js|css)$/i.test(url.pathname)) {
    event.respondWith(
      (async () => {
        await cleanOldCaches;
        try {
          // Cloudflare may keep executable responses fresh in the browser HTTP
          // cache for hours. Revalidate them explicitly so a runtime-only
          // deployment cannot keep executing the prior release until expiry.
          return await cacheResponse(request, await fetch(new Request(request, { cache: 'reload' })));
        } catch (err) {
          return cachedFallback(request);
        }
      })()
    );
    return;
  }

  // Non-executable shell assets (icons, images, and manifest) stay efficient
  // with stale-while-revalidate; they cannot keep an older UI renderer alive.
  event.respondWith(
    (async () => {
      await cleanOldCaches;
      try {
        const cached = await caches.match(request);
        if (cached) {
          event.waitUntil(
            fetch(request)
              .then(async (res) => {
                if (res && res.ok) {
                  const cache = await caches.open(VERSION);
                  await cache.put(request, res);
                }
              })
              .catch((err) => {
                // Ignore network errors in background revalidation
                console.warn('[sw] Background fetch failed', request.url, err);
              })
          );
          return cached;
        }

        const res = await fetch(request);
        if (res && res.ok) {
          const cache = await caches.open(VERSION);
          cache.put(request, res.clone());
        }
        return res;
      } catch (err) {
        console.warn('[sw] Fetch error', request.url, err);
        return new Response('', { status: 504 });
      }
    })()
  );
});


// AI: source-controlled activation; opaque binding is NOT an Auth credential.
// No permission or registration here. Reception still requires a matching
// explicit owner-bound consent receipt installed by the authenticated client.
const N44_PUSH_ENABLED = true;
const N44_CONSENT_CACHE = 'rakeezx-n44-consent-v1';
const N44_CONSENT_KEY = '/__n44_device_consent';
const n44OutcomeStages = ['received','display-requested','display-accepted','display-failed','unknown'];
let n44Epoch = 0, n44Writes = Promise.resolve();
const n44Uuid = s => typeof s === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(s);
const n44AppClient = client => {
  try { const u = new URL(client.url); return client.type === 'window' && u.origin === self.location.origin && u.pathname === '/'; } catch { return false; }
};
function n44Payload(raw) {
  const now = Date.now();
  if (!raw || Object.keys(raw).sort().join(',') !== 'actionPath,expiresAt,id,kind' ||
      typeof raw.id !== 'string' || !/^[a-zA-Z0-9_:%.-]{1,240}$/.test(raw.id) ||
      !['lesson', 'due'].includes(raw.kind) || !Number.isSafeInteger(raw.expiresAt) ||
      raw.expiresAt <= now || raw.expiresAt > now + 604800000 ||
      typeof raw.actionPath !== 'string' || raw.actionPath.length > 800) return null;
  const match = /^\/teaching\/([^/?#]+)\/(items|attendance\?session=([^/?#]+))$/.exec(raw.actionPath);
  if (!match || (raw.kind === 'lesson') !== !!match[3]) return null;
  for (const segment of [match[1], match[3]].filter(Boolean)) {
    try { const d = decodeURIComponent(segment);
      if (!d || d.length > 180 || /[\s/\\?#%\u0000-\u001f\u007f]/u.test(d) || ['.', '..'].includes(d) || encodeURIComponent(d) !== segment) return null;
    } catch { return null; }
  }
  return { id: raw.id, kind: raw.kind, expiresAt: raw.expiresAt, actionPath: raw.actionPath };
}
function n44Envelope(raw) {
  if (!raw || Object.keys(raw).sort().join(',') !== 'binding,event,expiresAt,v' || raw.v !== 1 || !n44Uuid(raw.binding) ||
    !Number.isSafeInteger(raw.expiresAt) || raw.expiresAt <= Date.now() || raw.expiresAt > Date.now()+2592000000) return null;
  const event = n44Payload(raw.event);
  return event ? { v: 1, binding: raw.binding, expiresAt: raw.expiresAt, event } : null;
}
async function n44Read(clearExpired=false) {
  try {
    const response = await (await caches.open(N44_CONSENT_CACHE)).match(N44_CONSENT_KEY);
    const raw = response && await response.text(); if (!raw || raw.length > 40000) return null;
    const value = JSON.parse(raw);
    if(clearExpired&&Number.isSafeInteger(value?.expiresAt)&&value.expiresAt<=Date.now()){await n44Write(null);await n44Close();return null;}
    if (!['binding,expiresAt,seen','binding,expiresAt,outcome,seen'].includes(Object.keys(value).sort().join(',')) ||
      value.outcome && (Object.keys(value.outcome).sort().join(',')!=='minute,stage' || !n44OutcomeStages.includes(value.outcome.stage) || !Number.isSafeInteger(value.outcome.minute) || value.outcome.minute<0) || !n44Uuid(value.binding) || !Number.isSafeInteger(value.expiresAt) ||
      value.expiresAt <= Date.now() || value.expiresAt > Date.now()+2592000000 || !Array.isArray(value.seen) || value.seen.length > 100 ||
      value.seen.some(e => Object.keys(e).sort().join(',') !== 'expiresAt,id' || typeof e.id !== 'string' || !/^[a-zA-Z0-9_:%.-]{1,240}$/.test(e.id) || !Number.isSafeInteger(e.expiresAt))) return null;
    return value;
  } catch { return null; }
}
async function n44Write(value) {
  await (await caches.open(N44_CONSENT_CACHE)).put(N44_CONSENT_KEY,new Response(JSON.stringify(value),{headers:{'content-type':'application/json','cache-control':'no-store'}}));
}
async function n44Close() {
  for (const n of await self.registration.getNotifications()) if (String(n.tag).startsWith('n44:')) n.close();
}
self.addEventListener('message', event => {
  if (!n44AppClient(event.source) || !event.ports?.[0]) return;
  const data = event.data, port = event.ports[0];
  if (!['n44-consent-status','n44-consent-bind','n44-consent-clear','n44-device-outcome'].includes(data?.type)) return;
  const epoch = ['n44-consent-status','n44-device-outcome'].includes(data.type) ? n44Epoch : ++n44Epoch;
  const work = async () => {
    let ok = false, answered = false;
    try {
      if (data.type === 'n44-device-outcome') {
        const current=await n44Read(true);
        if(Object.keys(data).sort().join(',')!=='binding,type'||!n44Uuid(data.binding)||current?.binding!==data.binding||!event.source.id||!(await n44Clients()).some(c=>c.id===event.source.id))return;
        let present=null;try{present=(await self.registration.getNotifications()).some(n=>String(n.tag).startsWith('n44:'+current.binding+':'));}catch{}
        if(epoch!==n44Epoch)return;
        answered=true;port.postMessage({ok:true,stage:current.outcome?.stage??'unknown',minute:current.outcome?.minute??null,present});return;
      }
      if (data.type === 'n44-consent-status') {
        const current = await n44Read(true);answered=true;port.postMessage({ok:true,enabled:N44_PUSH_ENABLED,binding:current?.binding??null,expiresAt:current?.expiresAt??0});return;
      }
      if (epoch !== n44Epoch) return;
      if (data.type === 'n44-consent-clear' && Object.keys(data).sort().join(',') === 'binding,type' && (data.binding === null || n44Uuid(data.binding))) {
        const current = await n44Read(true);
        if (!current || data.binding === null || current.binding === data.binding) { await n44Write(null); await n44Close(); }
        ok = true;
      } else if (N44_PUSH_ENABLED && data.type === 'n44-consent-bind' && Object.keys(data).sort().join(',') === 'binding,expiresAt,type' && n44Uuid(data.binding) &&
        Number.isSafeInteger(data.expiresAt) && data.expiresAt > Date.now() && data.expiresAt <= Date.now()+2592000000) {
        const previous = await n44Read(true);
        if (epoch !== n44Epoch) return;
        await n44Write({binding:data.binding,expiresAt:data.expiresAt,seen:previous?.binding===data.binding?previous.seen:[],...(previous?.binding===data.binding&&previous.outcome?{outcome:previous.outcome}:{})});
        ok = epoch === n44Epoch;
        if (!ok) await n44Write(null);
      }
    } finally { if(!answered)port.postMessage({ok,enabled:N44_PUSH_ENABLED});port.close(); }
  };
  n44Writes = n44Writes.catch(()=>{}).then(work);
  event.waitUntil(n44Writes);
});
async function n44Ask(client, envelope, type = 'n44-push-click') {
  return new Promise(resolve => {
    const channel = new MessageChannel();
    const finish = ok => { clearTimeout(timer); channel.port1.close(); channel.port2.close(); resolve(ok); };
    const timer = setTimeout(() => finish(false),1500);
    channel.port1.onmessage = message => finish(message.data?.ok === true);
    try { client.postMessage(type === 'n44-push-ready' ? {type} : {type,event:envelope},[channel.port2]); } catch { finish(false); }
  });
}
const n44Clients = async () => (await self.clients.matchAll({type:'window',includeUncontrolled:false})).filter(n44AppClient);
self.addEventListener('push', event => {
  if (!N44_PUSH_ENABLED) return;
  event.waitUntil((async () => {
    let raw;try { const text = event.data?.text();if (!text || text.length>2300) return;raw=JSON.parse(text); } catch { return; }
    const envelope = n44Envelope(raw);if (!envelope) return;
    const epoch = n44Epoch;
    // Serialize durable dedupe with consent mutations, including SW restarts.
    const work = async () => {
      const state = await n44Read(true);
      if (epoch!==n44Epoch || !state || state.binding!==envelope.binding || envelope.expiresAt>state.expiresAt) return;
      state.seen=state.seen.filter(e=>e.expiresAt>Date.now());
      if (state.seen.some(e=>e.id===envelope.event.id) || state.seen.length>=100) return;
      state.seen.push({id:envelope.event.id,expiresAt:Math.min(envelope.event.expiresAt,envelope.expiresAt)});
      const outcome=stage=>{state.outcome={stage,minute:Math.floor(Date.now()/60000)};};
      outcome('received');await n44Write(state);
      if (epoch!==n44Epoch || !n44Envelope(envelope)) return;
      let display;
      try { const requested=Promise.resolve(self.registration.showNotification('\u0631\u064e\u0643\u064a\u0632 \u0627\u0644\u0645\u0639\u0644\u0645',{
        body:'\u0644\u062f\u064a\u0643 \u062a\u0630\u0643\u064a\u0631 \u062c\u062f\u064a\u062f. \u0627\u0641\u062a\u062d \u0627\u0644\u062a\u0637\u0628\u064a\u0642 \u0644\u0639\u0631\u0636\u0647.',
        tag:'n44:'+envelope.binding+':'+envelope.event.id,data:envelope,icon:'/assets/icon-192.png',renotify:false,
      })).then(()=>({accepted:true}),error=>({accepted:false,error}));
        outcome('display-requested');
        try{await n44Write(state);}catch{/* Request was made; durable received reservation remains. */}
        display=await requested;
      }catch(error){display={accepted:false,error};}
      if(display.accepted)outcome('display-accepted');
      else { const error=display.error;
        // Only explicit API rejection proves no display. Generic/unknown failures
        // retain the durable seen reservation, including across SW restart.
        const known=error instanceof TypeError || typeof DOMException!=='undefined'&&error instanceof DOMException&&error.name==='NotAllowedError';
        if(known)state.seen=state.seen.filter(e=>e.id!==envelope.event.id);
        outcome(known?'display-failed':'unknown');
      }
      if(epoch!==n44Epoch){await n44Close();return;}
      try{await n44Write(state);}catch{/* Durable pre-display reservation stays UNKNOWN. */}
      if (epoch!==n44Epoch) await n44Close();
    };
    n44Writes=n44Writes.catch(()=>{}).then(work);await n44Writes;
  })());
});
const n44Clicks = new Map();
self.addEventListener('notificationclick', event => {
  if (!String(event.notification.tag).startsWith('n44:')) return;
  event.notification.close();
  if (!N44_PUSH_ENABLED) return;
  const envelope = n44Envelope(event.notification.data);
  if (!envelope) return;
  const key = envelope.binding + ':' + envelope.event.id;
  for (const [id, click] of n44Clicks) if (click.expiresAt <= Date.now()) n44Clicks.delete(id);
  if (n44Clicks.has(key)) { event.waitUntil(n44Clicks.get(key).work); return; }
  if (n44Clicks.size >= 100) return;
  const work = (async () => {
    // Show the app while the notification gesture is fresh, BEFORE storage or
    // authentication. Never put a private route or notification data in the URL.
    const clients = await n44Clients();
    const client = clients[0] ? await clients[0].focus() : await self.clients.openWindow(self.location.origin + '/');
    if (!client) return;
    const epoch = n44Epoch, state = await n44Read();
    if (state?.binding !== envelope.binding || state.expiresAt < envelope.expiresAt) return;
    // Readiness probes have no authorization/navigation side effects. A cold
    // boot may not yet have installed its listener or restored the owner store.
    // Send the action ONCE, never retry an unknown authorization/navigation.
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline && epoch === n44Epoch && n44Envelope(envelope)) {
      if (await n44Ask(client, null, 'n44-push-ready')) {
        if (epoch === n44Epoch && n44Envelope(envelope)) await n44Ask(client, envelope);
        return;
      }
      await new Promise(resolve => setTimeout(resolve,250));
    }
  })().catch(() => {});
  n44Clicks.set(key, { expiresAt: Math.min(envelope.expiresAt, envelope.event.expiresAt), work });
  event.waitUntil(work);
});
self.addEventListener('pushsubscriptionchange', event => {
  ++n44Epoch;
  n44Writes = n44Writes.catch(()=>{}).then(async () => {
    await n44Write(null);await n44Close();
    for (const client of await n44Clients()) client.postMessage({type:'n44-subscription-stale'});
  });
  event.waitUntil(n44Writes);
});
