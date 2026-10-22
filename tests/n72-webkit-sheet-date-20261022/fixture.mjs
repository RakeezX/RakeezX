export async function bootSynthetic(page, origin) {
  await page.context().addInitScript(() => sessionStorage.setItem('rakeezx-demo-session-v1', 'preparing'));
  await page.goto(origin, { waitUntil: 'domcontentloaded' });
  // Observe real boot rendering, rather than assuming that an async predicate
  // or a fixed delay proves completion of the 1,914-record Demo transaction.
  return page.evaluate(async () => {
    const [store, db] = await Promise.all([import('/src/store.js'), import('/src/lib/db.js')]);
    await new Promise(resolve => {
      const observer = new MutationObserver(check);
      function check() {
        if (store.state.ready && store.teachings().length && document.querySelector('.layout')) {
          observer.disconnect(); resolve();
        }
      }
      observer.observe(document.body, { childList: true, subtree: true });
      check();
    });
    return { ready: store.state.ready, workspace: store.getActiveWorkspace(), database: db.getActiveDatabaseName(),
      teachingCount: store.teachings().length, outboxCount: (await db.getAll('outbox')).length,
      timeOrigin: performance.timeOrigin, navigationEntries: performance.getEntriesByType('navigation').length };
  });
}
