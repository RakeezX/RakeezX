/** Ordinary account view: no confirmation-link handling or email mutation. */
import { html, icon } from '../lib/dom.js';
import * as cloud from '../lib/cloud.js';
import * as store from '../store.js';
import { verifiedEmailFeedback } from '../lib/settings-profile-ui.js';
import { repaint } from '../repaint.js';

let state = null;
let cleanup = () => {};
const identity = () => {
  const workspace = store.getActiveWorkspace();
  return cloud.session && cloud.user && workspace?.type === 'account' && workspace.authUserId === cloud.user.id
    ? { ownerId: cloud.user.id, token: cloud.session.access_token } : null;
};
const matches = s => {
  const now = identity();
  return s && now && s.ownerId === now.ownerId && s.token === now.token;
};

export default {
  title: () => 'حالة البريد الإلكتروني',
  render() {
    const s = matches(state) ? state : null;
    return html`<link rel="stylesheet" href="./src/styles/settings.css"><div class="management-page settings-page email-status-page">
      <a class="btn btn--quiet" href="#/settings">${icon('back')} الإعدادات</a>
      <section class="card card--pad stack stack-3" aria-labelledby="email-status-title" data-email-status>
        <h1 id="email-status-title">حالة البريد الإلكتروني</h1>
        ${s?.email ? html`
          <div><h2>البريد الإلكتروني المعتمد حاليًا</h2><bdi dir="ltr" data-status-current>${s.email}</bdi></div>
          ${s.pending ? html`<div role="status" data-status-pending><h2>تغيير البريد قيد التأكيد</h2>
            <bdi dir="ltr">${s.pending}</bdi>
            <p>أكمل التأكيد من بريدك الحالي والجديد، وتحقق من مجلد الرسائل غير المرغوب فيها في البريدين.</p>
            <p>بعد التأكيد الأول قد يبقى الطلب قيد التأكيد حتى تؤكد الرسالة الثانية. ثم ارجع إلى هذه الصفحة لتحديث الحالة تلقائيًا، أو حدّث الصفحة. لا يُعتمد التغيير هنا حتى يؤكده الخادم.</p></div>`
            : s.feedback?.completed ? html`<p role="status" data-status-completed>تم اعتماد البريد الإلكتروني الجديد.</p>` : ''}
          ${!s.pending ? html`<p data-status-guidance>استخدم البريد المعتمد حاليًا عند تسجيل الدخول. يُفترض أن تبقى بياناتك في الحساب نفسه؛ لم تتحقق هذه الصفحة من نتيجة تسجيل الدخول أو من بياناتك.</p>` : ''}
        ` : ''}
        <p role="status" data-status-message>${!identity() ? 'لا توجد جلسة حساب متاحة لعرض حالة البريد. ارجع إلى الإعدادات لتسجيل الدخول.'
          : s?.error ? 'تعذر التحقق من حالة البريد الآن. ارجع لاحقًا أو حدّث الصفحة. لم يُثبت اكتمال التغيير.'
          : !s?.email || s.busy ? 'جارٍ قراءة حالة البريد من الخادم…' : 'الحالة المعروضة من آخر قراءة موثقة للحساب الحالي.'}</p>
        <p class="field__hint">هذه صفحة معلومات داخل الإعدادات. لا تغيّر وجهة رابط التأكيد في الرسالة؛ تابع تعليمات الرسالة ثم ارجع إلى التطبيق.</p>
      </section>
    </div>`;
  },
  onMount(root) {
    cleanup();
    const context = identity();
    if (!context) { state = null; repaint(); return; }
    const s = state = { ...context, email: '', pending: '', feedback: verifiedEmailFeedback(null, {
      ownerId: context.ownerId, email: cloud.user.email, pendingEmail: cloud.user.new_email,
    }), busy: false, error: false };
    let mounted = true;
    let inFlight = null;
    let lastReturn = -Infinity;
    const active = () => mounted && state === s && matches(s);
    const clear = () => {
      state = null;
      root.querySelector('[data-email-status]')?.replaceChildren();
      repaint();
    };
    const validate = () => { if (!matches(s)) clear(); };
    const verify = () => {
      if (!active() || inFlight) return;
      s.busy = true;
      inFlight = cloud.verifyCurrentAuthIdentity(s.ownerId).then(() => {
        if (!active()) return;
        s.email = cloud.user.email || '';
        s.pending = cloud.user.new_email || '';
        s.feedback = verifiedEmailFeedback(s.feedback, { ownerId: s.ownerId, email: s.email, pendingEmail: s.pending, verified: !s.pending });
        s.error = false;
      }).catch(() => {
        if (active()) { s.email = ''; s.pending = ''; s.error = true; }
      }).finally(() => {
        inFlight = null;
        if (active()) { s.busy = false; repaint(); }
      });
      repaint();
    };
    const onReturn = () => {
      if (document.visibilityState !== 'visible' || Date.now() - lastReturn < 30000 || inFlight) return;
      lastReturn = Date.now();
      verify();
    };
    const removeAuth = cloud.subscribe(validate);
    const removeWorkspace = store.onWorkspaceDeactivation(clear);
    const onStorage = event => { if (event.key === cloud.AUTH_STORAGE_KEY || event.key === null) clear(); };
    addEventListener('storage', onStorage);
    addEventListener('focus', onReturn);
    document.addEventListener('visibilitychange', onReturn);
    cleanup = () => {
      mounted = false;
      state = null;
      removeAuth(); removeWorkspace();
      removeEventListener('storage', onStorage);
      removeEventListener('focus', onReturn);
      document.removeEventListener('visibilitychange', onReturn);
    };
    verify();
  },
  onUnmount() { cleanup(); cleanup = () => {}; state = null; },
};
