// First-party, two-event public measurement. No provider script or identity API.
export const MARKETING_COLLECTOR = 'https://cloud.umami.is/api/send';
const EVENTS = Object.freeze(['campaign_landing', 'demo_started']);
const PREFIX = 'rakeezx-marketing-';

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

  function track(name) {
    // Everything, including optional storage and fetch, fails silently and closed.
    try {
      if (!EVENTS.includes(name) || !allowed() || seen[name]) return;
      const storage = environment.sessionStorage;
      if (!storage || storage.getItem(PREFIX + name) === 'true' ||
          (name === 'campaign_landing' && storage.getItem(PREFIX + 'landing_view') === 'true')) return;
      storage.setItem(PREFIX + name, 'true');
      if (storage.getItem(PREFIX + name) !== 'true') return;
      seen[name] = true; // At most one attempt; no outbox or retry, even on failure.
      const controller = new environment.AbortController();
      pending.add(controller);
      const timer = environment.setTimeout(() => controller.abort(), timeoutMs);
      // Recheck immediately at dispatch; no route, query, title or user objects are read.
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
          } }),
        })).catch(() => {}).finally(finish);
      } catch { finish(); }
    } catch { /* Measurement must never affect the application. */ }
  }

  function stop() {
    stopped = true; // Account entry is terminal for this document, including sign-out.
    for (const controller of pending) controller.abort();
    pending.clear();
  }

  return Object.freeze({ track, stop });
}

export const MARKETING_PRIVACY_NOTICE = 'نقيس فقط ظهور الصفحة العامة وبدء التجربة بنجاح للزائر غير المسجّل عبر Umami، دون إرسال بيانات الحساب أو المعلم أو الطلاب أو محتوى الرابط، ودون ملفات تتبّع أو معرّف مستخدم من ركيز. يستقبل المزوّد عنوان IP ومعلومات المتصفح وقد يستنتج بيانات تقنية وموقعًا تقريبيًا ومعرّف جلسة مشتقًا. تذكر وثائقه خوادم في الولايات المتحدة وألمانيا؛ لم نتحقق من منطقة هذا الحساب. نحترم إشارات عدم التتبّع وGPC.';
