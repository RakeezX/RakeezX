/**
 * RAKEEZ X — عامل الخدمة.
 * يخزّن التطبيق كاملًا في أول زيارة، فيعمل بعدها دون إنترنت.
 * غيّر VERSION عند كل تحديث ليُحدَّث المخزون على أجهزة المعلّم.
 */

const VERSION = 'rakeezx-v20';
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
  './src/styles/components.css',

  './src/app.js',
  './src/router.js',
  './src/store.js',
  './src/models.js',
  './src/repaint.js',

  './src/lib/dom.js',
  './src/lib/brand.js',
  './src/lib/db.js',
  './src/lib/export.js',
  './src/lib/migrate.js',
  './src/lib/cloud.js',
  './src/lib/sync.js',
  './src/lib/sync-v2.js',
  './src/lib/sync-ownership.js',
  './src/lib/workspaces.js',
  './src/lib/sync-operational-ui.js',
  './src/lib/avatar.js',
  './src/lib/backup-v2.js',
  './src/lib/build-meta.js',
  './src/lib/cloud-recovery-ui.js',
  './src/lib/report-print.js',
  './src/lib/schedule-export.js',
  './src/lib/session-auto.js',
  './src/lib/session-editor-ui.js',
  './src/lib/session-delete-ui.js',
  './src/lib/student-lifecycle.js',
  './src/lib/student-lifecycle-ui.js',
  './src/lib/pristine-teaching.js',
  './src/lib/support.js',
  './src/lib/demo.js',
  './src/lib/calendar-presets.js',
  './src/lib/subject-catalog.js',
  './src/lib/effects.js',
  './src/lib/sound.js',

  './src/views/home.js',
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
  './src/views/execution-report.js',
  './src/views/archive.js',
  './src/views/archive-detail.js',
  './src/views/former-students.js',
  './src/views/student.js',
  './src/views/schedule.js',
  './src/views/times.js',
  './src/views/curriculum.js',
  './src/views/calendar.js',
  './src/views/settings.js',
  './src/views/backup.js',
  './src/views/support.js',

  './src/generated/build-meta.generated.js',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    (async () => {
      const cache = await caches.open(VERSION);
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
    const cached = await caches.match(key);
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
          return await cacheResponse('./index.html', await fetch(request));
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
          return await cacheResponse(request, await fetch(request));
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
