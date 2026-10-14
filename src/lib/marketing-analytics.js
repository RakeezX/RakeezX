// First-party, two-event public measurement. No provider script or identity API.
export const MARKETING_COLLECTOR = 'https://cloud.umami.is/api/send';
const EVENTS = Object.freeze(['campaign_landing', 'demo_started']);
const PREFIX = 'rakeezx-marketing-';
const CAMPAIGN_KEY = PREFIX + 'campaign-v1';
const CAMPAIGN_KEYS = Object.freeze(['utm_source', 'utm_medium', 'utm_campaign', 'utm_content']);
// Public marketing vocabulary, never an arbitrary source/medium supplied by a link.
const SOURCES = new Set(['test', 'rakeez', 'whatsapp', 'telegram', 'x', 'twitter', 'instagram',
  'snapchat', 'tiktok', 'youtube', 'facebook', 'linkedin', 'threads', 'google', 'bing',
  'newsletter', 'email', 'direct', 'qr']);
const MEDIUMS = new Set(['test', 'social', 'paid_social', 'organic', 'cpc', 'ppc', 'email',
  'referral', 'direct', 'qr', 'display', 'sms', 'messaging']);

function safeSlug(value) {
  if (typeof value !== 'string' || value.length > 48 ||
      !/^[a-z][a-z0-9]*(?:[-_][a-z0-9]+)*$/.test(value) || /\d{5}|[a-f0-9]{8}/.test(value)) return false;
  // Short readable words/year suffixes only: reject opaque IDs, UUIDs and tokens.
  return value.split(/[-_]/).every(word => {
    if (/^\d{1,4}$/.test(word)) return true;
    if (!/^[a-z]{2,16}\d{0,4}$/.test(word)) return false;
    const letters = word.replace(/\d+$/, '');
    return !(letters.length >= 5 && (!/[aeiouy]/.test(letters) || /[bcdfghjklmnpqrstvwxz]{5}/.test(letters))) &&
      !(letters.length >= 10 && new Set(letters).size / letters.length > 0.8);
  });
}

function sanitizeCampaign(input) {
  const data = {};
  for (const key of CAMPAIGN_KEYS) {
    const value = input?.[key];
    if (key === 'utm_source' ? SOURCES.has(value) : key === 'utm_medium' ? MEDIUMS.has(value) : safeSlug(value)) {
      data[key] = value;
    }
  }
  return data;
}

export function createMarketingAnalytics({
  eligible = () => false,
  environment = globalThis,
  timeoutMs = 2000,
} = {}) {
  let stopped = false;
  const pending = new Set();
  const seen = { campaign_landing: false, demo_started: false };

  function allowed() {
    const { location, navigator } = environment;
    return !stopped && location?.protocol === 'https:' && location.hostname === 'rakeezx.com' &&
      navigator?.onLine === true && navigator.globalPrivacyControl !== true &&
      ![navigator.doNotTrack, environment.doNotTrack].some(value => value === '1' || value === 'yes') &&
      eligible() === true;
  }

  function capturePublicEntry() {
    try {
      const { location, sessionStorage: storage } = environment;
      if (!allowed() || location.pathname !== '/' || !['', '#/'].includes(location.hash) || !storage) return;
      // Even an empty first entry fixes attribution; subsequent links cannot replace it.
      if (storage.getItem(CAMPAIGN_KEY) !== null) return;
      const input = {};
      const query = location.search || '';
      if (query.length <= 4096) {
        const params = new URLSearchParams(query);
        for (const key of CAMPAIGN_KEYS) {
          const values = params.getAll(key);
          // Reject encoded input rather than decoding an encoded delimiter into a slug.
          const raw = query.replace(/^\?/, '').split('&').find(part => part.startsWith(key + '='));
          if (values.length === 1 && raw && !/[%+]/.test(raw)) input[key] = values[0];
        }
      }
      // Only this bounded four-key object is retained, never the query itself.
      storage.setItem(CAMPAIGN_KEY, JSON.stringify(sanitizeCampaign(input)));
    } catch { /* Optional storage/capture must not affect navigation or Demo. */ }
  }

  function campaignData(storage) {
    const saved = storage.getItem(CAMPAIGN_KEY);
    if (saved === 'disabled') return null;
    return saved === null ? {} : sanitizeCampaign(JSON.parse(saved));
  }

  function track(name) {
    // Everything, including optional storage and fetch, fails silently and closed.
    try {
      if (!EVENTS.includes(name) || !allowed() || seen[name]) return;
      const storage = environment.sessionStorage;
      const data = storage && campaignData(storage);
      if (!data) return;
      if (!storage || storage.getItem(PREFIX + name) === 'true' ||
          (name === 'campaign_landing' && storage.getItem(PREFIX + 'landing_view') === 'true')) return;
      storage.setItem(PREFIX + name, 'true');
      if (storage.getItem(PREFIX + name) !== 'true') return;
      seen[name] = true; // At most one attempt; no outbox or retry, even on failure.
      const controller = new environment.AbortController();
      pending.add(controller);
      const timer = environment.setTimeout(() => controller.abort(), timeoutMs);
      // Recheck immediately at dispatch; only the saved sanitized tags are used.
      if (!allowed()) {
        controller.abort();
        environment.clearTimeout(timer);
        pending.delete(controller);
        return;
      }
      const finish = () => {
        environment.clearTimeout(timer);
        pending.delete(controller);
      };
      try {
        Promise.resolve(environment.fetch(MARKETING_COLLECTOR, {
          method: 'POST', credentials: 'omit', referrerPolicy: 'no-referrer',
          redirect: 'error', signal: controller.signal,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'event', payload: {
            website: 'a0f3bd66-07fc-4082-956d-70c17ff621c5',
            hostname: 'rakeezx.com', url: '/', title: 'رَكيز المعلم', name,
            data,
          } }),
        })).catch(() => {}).finally(finish);
      } catch { finish(); }
    } catch { /* Measurement must never affect the application. */ }
  }

  function stop({ preserveCampaign = false } = {}) {
    stopped = true; // Account entry is terminal for this document, including sign-out.
    if (!preserveCampaign) {
      // Terminal for this tab too, so a reload/sign-out cannot restore attribution.
      try { environment.sessionStorage?.setItem(CAMPAIGN_KEY, 'disabled'); } catch { /* Optional. */ }
    }
    for (const controller of pending) controller.abort();
    pending.clear();
  }

  return Object.freeze({ capturePublicEntry, track, stop });
}
