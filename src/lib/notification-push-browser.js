/** AI: native adapter. Public binding is not an Auth credential. Never prompt on load. */
export function createPushBrowser({ window: win = globalThis.window, publicKey, navigate }) {
  const key = () => {
    if (typeof publicKey !== 'string' || !/^B[A-Za-z0-9_-]{86}$/.test(publicKey)) throw Error('unavailable');
    const bytes = Uint8Array.from(win.atob(publicKey.replace(/-/g, '+').replace(/_/g, '/') + '='), c => c.charCodeAt(0));
    if (bytes.length !== 65 || bytes[0] !== 4) throw Error('unavailable');
    return bytes;
  };
  const registration = () => win.navigator.serviceWorker.getRegistration('/');
  // The worker is already verified during readiness. Reuse that registration
  // synchronously when the user clicks, so Safari/Firefox can consume the
  // transient user activation BEFORE the first await.
  let preparedRegistration = null;
  const message = async data => {
    const worker = (await registration())?.active;
    if (!worker) throw Error('unavailable');
    return new Promise((resolve, reject) => {
      const channel = new win.MessageChannel();
      const finish = (callback, value) => { clearTimeout(timer); channel.port1.close(); channel.port2.close(); callback(value); };
      const timer = setTimeout(() => finish(reject, Error('unavailable')), 2500);
      channel.port1.onmessage = event => finish(resolve, event.data);
      try { worker.postMessage(data, [channel.port2]); } catch { finish(reject, Error('unavailable')); }
    });
  };
  const wrap = (subscription, manager) => subscription && Object.freeze({
    toJSON: () => subscription.toJSON(),
    async unsubscribe() {
      if (await subscription.unsubscribe()) return true;
      const current = await manager.getSubscription();
      return !current || current.endpoint !== subscription.endpoint;
    },
  });
  return Object.freeze({
    supported() { try { key(); return !!(win.isSecureContext && win.Notification && win.PushManager && win.navigator.serviceWorker && win.MessageChannel); } catch { return false; } },
    hasUserActivation: () => win.navigator.userActivation?.isActive === true,
    permission: () => win.Notification?.permission,
    requestPermission: () => win.Notification.requestPermission(),
    async ready() {
      preparedRegistration = null;
      try {
        const r = await registration();
        const url = new URL(r?.active?.scriptURL);
        if (url.origin !== win.location.origin || url.pathname !== '/sw.js') return false;
        const ready = (await message({ type: 'n44-consent-status' }))?.enabled === true;
        preparedRegistration = ready ? r : null;
        return ready;
      } catch { return false; }
    },
    async bind(receipt) {
      const result = await message({ type: 'n44-consent-bind', binding: receipt.registrationId, expiresAt: receipt.expiresAt });
      return result?.ok === true;
    },
    async deviceOutcome(binding) {
      if(typeof binding!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(binding))return null;
      try{
        const url=new URL((await registration())?.active?.scriptURL);
        if(url.origin!==win.location.origin||url.pathname!=='/sw.js')return null;
        const r=await message({type:'n44-device-outcome',binding});
        if(r?.ok!==true||!['received','display-requested','display-accepted','display-failed','unknown'].includes(r.stage)||!(r.minute===null||Number.isSafeInteger(r.minute)&&r.minute>=0)||![true,false,null].includes(r.present))return null;
        return {stage:r.stage,minute:r.minute,present:r.present};
      }catch{return null;}
    },
    consent: () => message({ type: 'n44-consent-status' }),
    async clearConsent(binding) {
      const result = await message({ type: 'n44-consent-clear', binding: binding ?? null });
      return result?.ok === true;
    },
    async clearNotifications() {
      for (const notification of await (await registration())?.getNotifications() ?? []) {
        if (String(notification.tag).startsWith('n44:')) notification.close();
      }
    },
    async existing() {
      const r = await registration();
      const u = r?.active?.scriptURL ? new URL(r.active.scriptURL) : null;
      preparedRegistration = u?.origin === win.location.origin && u.pathname === '/sw.js' ? r : null;
      return preparedRegistration ? wrap(await r.pushManager.getSubscription(), r.pushManager) : null;
    },
    subscribeOnGesture() {
      const r = preparedRegistration;
      if (!r?.active || win.navigator.userActivation?.isActive !== true) throw Error('unavailable');
      const u = new URL(r.active.scriptURL);
      if (u.origin !== win.location.origin || u.pathname !== '/sw.js') throw Error('unavailable');
      // Crucial: invoke native PushManager.subscribe synchronously here. Neither
      // a getRegistration nor getSubscription promise may precede this call.
      const request = r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key() });
      return Promise.resolve(request).then(value => wrap(value, r.pushManager));
    },
    async subscribe() {
      const r = await registration();
      if (!r?.active) throw Error('unavailable');
      const previous = await r.pushManager.getSubscription();
      if (previous && !await previous.unsubscribe()) throw Error('cleanup_pending');
      return wrap(await r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key() }), r.pushManager);
    },
    navigate,
  });
}
