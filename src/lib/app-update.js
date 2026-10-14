// AI: bridge already-fresh HTTP responses to the contained release before any
// app/store module executes. New headers alone cannot expire an old response.
// These are static same-origin assets; no account, database or outbox is read.
const releaseAssets = ['../app.js', '../store.js', '../views/calendar.js'];

export const startup = (async () => {
  for (;;) {
    try {
      await Promise.all(releaseAssets.map(async path => {
        const response = await fetch(new URL(path, import.meta.url), {
          cache: 'reload', signal: AbortSignal.timeout(8000),
        });
        if (!response.ok) throw Error(`Release asset unavailable: ${response.status}`);
        // Finish the body before import: the HTTP cache update must be complete.
        await response.arrayBuffer();
      }));
      break;
    } catch {
      // An updated worker supplies the verified offline shell. Without it, do
      // not execute a potentially mixed old/new graph after a failed refresh.
      const message = document.querySelector('.boot__msg');
      if (message) message.textContent = 'تعذّر تجهيز التحديث. اتصل بالإنترنت وأعد المحاولة. بياناتك محفوظة.';
      await new Promise(resolve => {
        const button = document.createElement('button');
        button.type = 'button'; button.className = 'btn btn--primary';
        button.textContent = 'إعادة المحاولة';
        button.addEventListener('click', () => { button.remove(); resolve(); }, { once: true });
        (document.querySelector('.boot__composition') || document.getElementById('app')).append(button);
      });
    }
  }
  return import('../app.js');
})();
