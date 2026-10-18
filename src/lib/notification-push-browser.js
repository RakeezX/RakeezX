/** AI: native adapter. Public binding is not an Auth credential. Never prompt on load. */
export function createPushBrowser({ window: win = globalThis.window, publicKey, navigate }) {
  const key = () => {
    if (typeof publicKey !== 'string' || !/^B[A-Za-z0-9_-]{86}$/.test(publicKey)) throw Error('unavailable');
    const bytes = Uint8Array.from(win.atob(publicKey.replace(/-/g, '+').replace(/_/g, '/') + '='), c => c.charCodeAt(0));
    if (bytes.length !== 65 || bytes[0] !== 4) throw Error('unavailable');
    return bytes;
  };
  const registration = () => win.navigator.serviceWorker.getRegistration('/');
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
      try {
        const url = new URL((await registration())?.active?.scriptURL);
        if (url.origin !== win.location.origin || url.pathname !== '/sw.js') return false;
        return (await message({ type: 'n44-consent-status' }))?.enabled === true;
      } catch { return false; }
    },
    async bind(receipt) {
      const result = await message({ type: 'n44-consent-bind', binding: receipt.registrationId, expiresAt: receipt.expiresAt });
      return result?.ok === true;
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
      return r?.active ? wrap(await r.pushManager.getSubscription(), r.pushManager) : null;
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
