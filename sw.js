/**
 * RAKEEZ X — عامل الخدمة.
 * يخزّن التطبيق كاملًا في أول زيارة، فيعمل بعدها دون إنترنت.
 * غيّر VERSION عند كل تحديث ليُحدَّث المخزون على أجهزة المعلّم.
 */

const VERSION = 'rakeezx-v2';

const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/icon.svg',
  './assets/icon-180.png',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/icon-maskable.png',

  './src/styles/app.css',
  './src/styles/components.css',

  './src/app.js',
  './src/router.js',
  './src/store.js',
  './src/models.js',
  './src/repaint.js',

  './src/lib/dom.js',
  './src/lib/db.js',
  './src/lib/export.js',
  './src/lib/migrate.js',
  './src/lib/cloud.js',
  './src/lib/sync.js',

  './src/views/home.js',
  './src/views/teachings.js',
  './src/views/teaching-hub.js',
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
  './src/views/student.js',
  './src/views/schedule.js',
  './src/views/times.js',
  './src/views/curriculum.js',
  './src/views/calendar.js',
  './src/views/settings.js',
  './src/views/backup.js',
];

self.addEventListener('install', (event) => {
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
      self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        const cached = await caches.match('./index.html');
        if (cached) {
          refresh(request);
          return cached;
        }
        try {
          return await fetch(request);
        } catch {
          return new Response('التطبيق غير متاح دون إنترنت بعد. افتحه مرة وأنت متصل.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          });
        }
      })()
    );
    return;
  }

  event.respondWith(
    (async () => {
      const cached = await caches.match(request);
      if (cached) {
        refresh(request);
        return cached;
      }
      try {
        const res = await fetch(request);
        if (res.ok) {
          const cache = await caches.open(VERSION);
          cache.put(request, res.clone());
        }
        return res;
      } catch {
        return new Response('', { status: 504 });
      }
    })()
  );
});

/** تحديث صامت للنسخة المخزّنة دون تعطيل الاستجابة الحالية. */
function refresh(request) {
  fetch(request)
    .then((res) => {
      if (!res.ok) return;
      caches.open(VERSION).then((cache) => cache.put(request, res));
    })
    .catch(() => {});
}
