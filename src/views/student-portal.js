/** AI: actual read-only student DOM/handlers, deliberately unregistered/unimported by app. */
import { clearEntryUrl } from '../lib/student-portal-client.js';
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const status = { done: 'مكتمل', working: 'قيد العمل', todo: 'لم يبدأ' };

export function mountStudentPortal(root, { client, location = window.location, history = window.history } = {}) {
  let disposed = false, generation = 0, busy = false;
  clearEntryUrl(location, history);
  root.classList.add('n88-portal'); root.dir = 'rtl';
  function paint(content) {
    if (disposed) return;
    root.innerHTML = `<header><span class="n88-brand">رَكيز المعلم</span><span>مساحة الطالب</span></header><main>${content}</main>`;
    root.querySelector('h1')?.focus();
  }
  function entry(error = false, message = '') {
    paint(`<section class="n88-panel"><h1 tabindex="-1">مساحتي مع معلمي</h1><p>احفظ رابط معلمك للعودة، وأدخل رمزك الشخصي المكوّن من 6 أرقام. يبقى رمزك صالحًا حتى يغيّره المعلم أو يلغي الوصول.</p><form data-claim><label for="n88-secret">رمزي الشخصي</label><input id="n88-secret" name="code" type="password" inputmode="numeric" pattern="[0-9]{6}" minlength="6" maxlength="6" dir="ltr" autocomplete="off" autocapitalize="off" spellcheck="false" required aria-describedby="n88-error"><p id="n88-error" role="status">${error ? 'تعذّر فتح المساحة. تحقق من الرابط والرمز أو حاول لاحقًا مع معلمك.' : escape(message)}</p><button type="submit">فتح مساحتي</button></form></section>`);
  }
  function show(data) {
    const next = data.tasks.find(t => t.status !== 'done');
    const task = t => `<article class="n88-task"><h3>${escape(t.title)}</h3><p>${escape(t.instruction)}</p><p><span>${status[t.status] || status.todo}</span> · ${t.deadline ? `الموعد: <time dir="ltr">${escape(t.deadline)}</time>` : 'دون موعد محدد'}</p></article>`;
    paint(`<h1 tabindex="-1">ما المطلوب مني؟</h1><div class="n88-columns"><section class="n88-panel"><h2>خطوتي التالية</h2>${next ? task(next) : '<p>لا توجد مهام معلّقة منشورة الآن.</p>'}<h2>أنشطتي المنشورة</h2><div data-tasks>${data.tasks.length ? data.tasks.map(task).join('') : '<p>لا توجد أنشطة منشورة الآن.</p>'}</div></section><aside class="n88-panel"><h2>تقدّمي</h2><p>${data.progress.completed} من ${data.progress.total} أنشطة مكتملة</p><progress aria-label="الأنشطة المكتملة" value="${data.progress.completed}" max="${Math.max(1, data.progress.total)}"></progress><button type="button" data-refresh>تحديث المتابعة</button><button type="button" data-logout>إنهاء الجلسة</button><p role="status">للمتابعة والقراءة فقط</p></aside></div>`);
  }
  async function run(action, initial = false) {
    if (busy || disposed) return;
    busy = true; const checkpoint = ++generation;
    paint('<h1 tabindex="-1">جارٍ فتح المساحة…</h1>'); // remove stale private content before awaiting
    try { const data = await action(); if (!disposed && checkpoint === generation) {
      if (data === null) entry(false, 'انتهت الجلسة. استخدم رمزك نفسه للعودة.'); else show(data);
    } }
    catch { if (!disposed && checkpoint === generation) entry(!initial); }
    finally { if (checkpoint === generation) busy = false; }
  }
  const onSubmit = e => {
    if (!e.target.matches('[data-claim]')) return;
    e.preventDefault();
    let value = root.querySelector('input').value;
    root.querySelector('input').value = '';
    void run(async () => { const pending = client.claim(value); value = ''; await pending; return client.read(); });
  };
  const onClick = e => {
    if (e.target.closest('[data-refresh]')) void run(() => client.read());
    if (e.target.closest('[data-logout]')) void run(async () => { await client.logout(); return null; });
  };
  const clear = () => { generation++; busy = false; entry(); };
  const onHashChange = () => { clearEntryUrl(location, history); clear(); };
  const onPageShow = e => { if (e.persisted) void run(() => client.read()); };
  const onVisible = () => { if (root.ownerDocument.visibilityState === 'visible') void run(() => client.read()); };
  root.addEventListener('submit', onSubmit); root.addEventListener('click', onClick);
  root.ownerDocument.defaultView.addEventListener('pagehide', clear);
  root.ownerDocument.defaultView.addEventListener('hashchange', onHashChange);
  root.ownerDocument.defaultView.addEventListener('pageshow', onPageShow);
  root.ownerDocument.addEventListener('visibilitychange', onVisible);
  const ready = run(() => client.read(), true);
  return { ready, clear, dispose() {
    disposed = true; generation++; root.replaceChildren();
    root.removeEventListener('submit', onSubmit); root.removeEventListener('click', onClick);
    root.ownerDocument.defaultView.removeEventListener('pagehide', clear);
    root.ownerDocument.defaultView.removeEventListener('hashchange', onHashChange);
    root.ownerDocument.defaultView.removeEventListener('pageshow', onPageShow);
    root.ownerDocument.removeEventListener('visibilitychange', onVisible);
  } };
}
