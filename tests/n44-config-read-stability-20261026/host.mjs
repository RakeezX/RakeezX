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
h.start = async (mode = 429) => {
  await h.runtime.dispose();
  for(const key of Object.keys(localStorage)) if(key.startsWith('rakeezx-n44-consent:')) localStorage.removeItem(key);
  h.requests = 0; h.effects = 0; h.mode = mode; h.release = null;
  h.runtime = createPushRuntime({ store, cloud, window, navigate() {}, changed: h.paint,
    fetch: async (url) => {
      if (!url.endsWith('/push/config')) { h.effects++; throw Error('Unexpected operation'); }
      h.requests++;
      const selected = h.mode;
      if(selected === 'transport') throw Error('synthetic');
      if(selected === 'shape') return Response.json({status:'unexpected'});
      if (selected === 'late') await new Promise(ok => h.release = ok);
      return Response.json({ status: 'disabled' }, { status: typeof selected === 'number' ? selected : 200 });
    } });
  setPushRuntime(h.runtime); h.pending = h.runtime.refresh(); await h.pending; h.paint();
};
store.subscribe(() => { void h.runtime.refresh(); });
cloud.subscribe(() => { void h.runtime.refresh(); });
h.burst = async () => {
  for (let i = 0; i < 5; i++) {
    // Same app refresh entry used by store/cloud/storage/pageshow bridges.
    cloud.setMockAuth({ ...cloud.user }, { ...cloud.session });
    await store.refreshSyncedState();
    store.activateWorkspace({ ...store.getActiveWorkspace() });
    h.signal(); dispatchEvent(new PageTransitionEvent('pageshow'));
    dispatchEvent(new Event('focus')); await h.runtime.refresh(); await new Promise(ok => setTimeout(ok, 10));
  }
};

// Reuse installed synthetic browser ports with actual runtime/client/gateway.
h.bindingSetup = async () => {
  await h.runtime.dispose(); await h.arrange();
  const db = await import('/src/lib/db.js');
  for (const name of ['items','scoreSubitems','sessions']) await db.clearStore(name);
  await store.refreshSyncedState();
  for(const key of Object.keys(localStorage)) if(key.startsWith('rakeezx-n44-')) localStorage.removeItem(key);
  h.sid='11111111-1111-4111-8111-111111111111';
  h.rotate = suffix => {
    const token='e30.'+btoa(JSON.stringify({sub:cloud.user.id,role:'authenticated',exp:Math.floor(Date.now()/1000)+86400,session_id:h.sid,suffix})).replaceAll('+','-').replaceAll('/','_').replaceAll('=','')+'.synthetic';
    const session={...cloud.session,access_token:token}; localStorage.setItem(cloud.AUTH_STORAGE_KEY,JSON.stringify(session)); cloud.setMockAuth(cloud.user,session);
  };
  h.rotate('first');
  h.calls=[];h.registration=null;h.revision=0;h.failStop=false;
  const c=currentNotificationContext(store,cloud);
  h.remote={workspaceId:c.workspaceId,deviceId:c.deviceId,active:true,sessionId:h.sid,sessionRevision:'session-revision',sessionExpiresAt:Date.now()+3600000,consentRevision:'consent-0',pushConsent:false};
  h.send=async (url,init) => {
    h.calls.push(url);const body=JSON.parse(init.body);
    if(url.endsWith('/push/config')) return Response.json({status:'ready',protocol:'n44-browser-v2',capability:'n44-single-device-20261019-v1',serviceRevision:'n44-browser-service-v2',serviceSourceSha:'a'.repeat(40),publicKey:'B'+'A'.repeat(86),expiresAt:Date.now()+3600000,deliveryEnabled:false,schedulerEnabled:false});
    if(url.endsWith('/context/read')) return Response.json({status:'current',protocol:'n44-browser-v2',context:h.remote,registration:h.registration});
    if(url.endsWith('/context/update')) {
      if(h.failStop && !body.pushConsent) return Response.json({}, {status:503});
      h.remote={...h.remote,pushConsent:body.pushConsent,consentRevision:'consent-'+(++h.revision),preferences:body.preferences};
      return Response.json({status:'updated',context:h.remote});
    }
    if(url.endsWith('/push/register')) { h.registration={status:'registered',registrationId:body.registrationId,expiresAt:h.registration?.expiresAt??Date.now()+1800000};return Response.json(h.registration); }
    if(url.endsWith('/push/revoke')) { h.registration=null;return Response.json({status:'revoked'}); }
    throw Error('Unexpected synthetic operation '+url);
  };
  h.createBinding=async () => {
    h.runtime=createPushRuntime({store,cloud,window,navigate(){},fetch:h.send,changed:h.paint});
    setPushRuntime(h.runtime);await h.runtime.refresh();h.paint();
  };
  await h.createBinding();
};
