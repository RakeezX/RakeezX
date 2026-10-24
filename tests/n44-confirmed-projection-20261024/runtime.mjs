// AI: synthetic native ports only. No installed SW, permission or provider call.
export function installNative() {
  const n = window.n44Native = { subscription: null, binding: null, expiresAt: 0, projected: [], inflight: 0 };
  const send = window.fetch.bind(window);
  window.fetch = async (url, init) => {
    const projection = String(url).endsWith('/api/n44/events/update');
    if (projection) n.inflight++;
    try { const response = await send(url, init); if (projection) { await response.clone().text(); n.projected.push(JSON.parse(init.body).sourceId); } return response; }
    finally { if (projection) { n.inflight--; n.lastProjection = performance.now(); } }
  };
  const sub = { endpoint: 'https://synthetic.invalid/n44', toJSON: () => ({ endpoint: sub.endpoint, keys: { p256dh: 'synthetic', auth: 'synthetic' } }), async unsubscribe() { n.subscription = null; return true; } };
  const active = { scriptURL: location.origin + '/sw.js', postMessage(data, ports) {
    if (data.type === 'n44-consent-bind') { n.binding = data.binding; n.expiresAt = data.expiresAt; }
    if (data.type === 'n44-consent-clear') { n.binding = null; n.expiresAt = 0; }
    ports[0].postMessage({ ok: true, enabled: true, binding: n.binding, expiresAt: n.expiresAt });
  } };
  Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { addEventListener() {}, removeEventListener() {},
    async getRegistration() { return { active, getNotifications: async () => [], pushManager: {
      getSubscription: async () => n.subscription, subscribe: async () => n.subscription = sub,
    } }; } } });
  Object.defineProperty(window, 'Notification', { configurable: true, value: { permission: 'granted', requestPermission: async () => 'granted' } });
  Object.defineProperty(window, 'PushManager', { configurable: true, value: function () {} });
  sessionStorage.setItem('rakeezx-demo-session-v1', 'preparing');
}
