// AI: qualification host only; all settings markup, callbacks, ownership and CSS
// come from current Product modules. No alternate settings implementation.
import view from '/src/views/notification-settings.js';
import * as store from '/src/store.js';
import * as cloud from '/src/lib/cloud.js';
import { currentNotificationContext } from '/src/lib/notification-events.js';
import { createPushRuntime, setPushRuntime } from '/src/lib/notification-push-runtime.js';
import { runtimeOfflineLease } from '/src/lib/offline-lease.js';
import { renderRegions, delegate } from '/src/lib/dom.js';
import { setRepaint } from '/src/repaint.js';
import { prepareAccount, owner, otherOwner } from '/tests/n44-fixture.mjs';
const root = document.querySelector('#main');
const h = window.h = { view, store, cloud, root, owner, otherOwner, paints: 0, requests: 0, mounted: false };
h.arrange = async (id = owner) => {
  await prepareAccount(id);
  store.getOfflineLeaseStatus();
  await runtimeOfflineLease().renew(async id => ({ id, verifiedAt: Date.now(), source: 'supabase-auth-user' }));
  if (!currentNotificationContext(store, cloud)) throw Error('Real ownership/context guard failed');
};
h.paint = () => { h.paints++; renderRegions(root, [view.render()], 'settings-host'); };
setRepaint(h.paint);
delegate(root, () => view.actions);
h.mount = () => { h.paint(); view.onMount(root); h.mounted = true; };
h.unmount = () => { view.onUnmount(); h.mounted = false; root.textContent = 'Other route'; };
await h.arrange();
h.runtime = createPushRuntime({ store, cloud, window, navigate() {},
  fetch: async () => { h.requests++; return Response.json({ status: 'disabled' }); } });
setPushRuntime(h.runtime);
await h.runtime.refresh();
if (!h.runtime.snapshot().configOutcome) throw Error('Actual runtime config observation missing');
h.mount();
// Storage dispatch exercises the exact mounted validate callback, not a replica.
h.signal = () => dispatchEvent(new StorageEvent('storage', { key: 'synthetic-readiness-notification' }));
h.reset = () => {
  store.state.ready = false;
  h.runtime.invalidate();
  h.signal();
  const immediate = root.querySelector('.n44-settings').childElementCount;
  store.state.ready = true; // same workspace, session and ownership guard
  h.signal();
  return immediate;
};
// View-only manual outcome/Stop port. No native implementation is installed or
// exercised; readiness/reset qualification above always uses the real runtime.
h.manualPort = () => {
  const p = h.port = { reads: 0, stops: 0, available: true };
  setPushRuntime({ ...h.runtime,
    snapshot: () => ({ ...h.runtime.snapshot(), available: p.available, deviceOutcomeAvailable: p.available, status: p.available ? 'subscribed' : 'unsubscribed' }),
    deviceOutcome: () => { p.reads++; return new Promise(ok => p.resolve = ok); },
    disable: async () => { p.stops++; p.available = false; return { status: 'revoked' }; },
  });
  h.paint();
};
h.realRuntime = () => setPushRuntime(h.runtime);
h.ready = true;
