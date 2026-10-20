/** AI: reusable actual student page, deliberately unregistered in the teacher app. */
import { brandLockup } from '../lib/brand.js';
import { normalizeStudentCode, validStudentCode, projectUnifiedStudentData } from '../lib/student-portal-unified-client.js';
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const displayNumber = value => value === null ? 'لم تُرصد' : escape(value);

export function mountUnifiedStudentPortal(root, { client, readiness = { enabled: false } } = {}) {
  const doc = root.ownerDocument, win = doc.defaultView;
  let disposed = false, generation = 0, busy = false, timer, cooldownUntil = 0;
  const previousDir = root.getAttribute('dir');
  root.classList.add('n88-unified'); root.dir = 'rtl';
  const style = doc.createElement('link'); style.rel = 'stylesheet';
  style.href = new URL('../styles/student-portal-login.css', import.meta.url).href; doc.head.append(style);
  const enabled = readiness?.enabled === true && !!client;
  const paint = content => {
    if (disposed) return;
    root.innerHTML = `<header>${brandLockup({ compact: true })}</header><main>${content}</main>`;
    root.querySelector('h1')?.focus();
  };
  function entry(message = '') {
    const cooling = Date.now() < cooldownUntil;
    paint(`<section class="n88-unified-entry first-run-auth"><h1 tabindex="-1">مساحة الطالب</h1><p class="n88-unified-welcome">أدخل رمز الدخول الذي زوّدك به معلّمك.</p><form data-claim novalidate><label class="field__label" for="n88-unified-code">رمز الدخول</label><p id="n88-code-help">6 أرقام تبدأ بـ1</p><input id="n88-unified-code" class="input first-run-auth__otp" type="text" inputmode="numeric" minlength="6" maxlength="6" pattern="1[0-9]{5}" dir="ltr" autocomplete="off" autocapitalize="off" spellcheck="false" aria-describedby="n88-code-help n88-message" required ${!enabled || cooling ? 'disabled' : ''}><p id="n88-message" role="status">${escape(!enabled ? 'مساحة الطالب غير متاحة حاليًا. لم تُفعّل الخدمة بعد.' : cooling ? 'يرجى الانتظار قليلًا قبل المحاولة مجددًا.' : message)}</p><button class="btn btn--primary" type="submit" ${!enabled || cooling ? 'disabled' : ''}>دخول الطالب</button></form>${enabled ? '<button type="button" class="btn btn--ghost n88-unified-resume" data-resume>متابعة جلسة سابقة</button>' : ''}</section>`);
    clearTimeout(timer);
    if (cooling) timer = setTimeout(() => entry('يمكنك المحاولة مجددًا.'), Math.max(1, cooldownUntil - Date.now()));
  }
  function show(raw) {
    const data = projectUnifiedStudentData(raw);
    const profile = data.profile;
    let content = `<div class="n88-unified-profile"><div><h1 tabindex="-1">مساحتي الدراسية</h1>${profile?.name !== undefined ? `<p class="n88-unified-name">${escape(profile.name)}</p>` : ''}${profile?.classLabel !== undefined ? `<p class="n88-unified-class">${escape(profile.classLabel)}</p>` : ''}</div><div class="n88-unified-actions"><button data-read>تحديث</button><button data-end>إنهاء الجلسة</button></div></div><div class="n88-unified-sections">`;
    if (data.grades) {
      content += `<section class="n88-unified-grades"><h2>درجاتي</h2><div class="n88-unified-table"><table><thead><tr><th scope="col">البند</th><th scope="col">الدرجة</th><th scope="col">من</th></tr></thead><tbody>${data.grades.items.map(item => `<tr><th scope="row">${escape(item.label)}${item.status !== undefined ? `<small>${escape({recorded:'مرصودة',unrecorded:'لم تُرصد'}[item.status]||'')}</small>` : ''}</th><td>${displayNumber(item.value)}</td><td>${displayNumber(item.max)}</td></tr>`).join('')}</tbody></table></div>${data.grades.total ? `<p class="n88-unified-total">المجموع: <b dir="ltr">${displayNumber(data.grades.total.earned)} / ${displayNumber(data.grades.total.possible)}</b></p>` : ''}</section>`;
    }
    for (const [key, label] of Object.entries({ required: 'المطلوب مني', completed: 'الأعمال المكتملة', scheduled: 'الأعمال القادمة' })) {
      if (!Object.hasOwn(data.work || {}, key)) continue;
      content += `<section data-section="${key}"><h2>${label}<span class="n88-unified-count" aria-label="عدد الأعمال">${data.work[key].length}</span></h2>${data.work[key].length ? data.work[key].map(item => {
        const detail = `${item.executionInstructions !== undefined ? `<h3>تعليمات التنفيذ</h3><p class="n88-guidance-text">${escape(item.executionInstructions)}</p>` : ''}${item.deliveryInstructions !== undefined ? `<h3>طريقة التسليم</h3><p class="n88-guidance-text">${escape(item.deliveryInstructions)}</p>` : ''}${item.instruction !== undefined ? `<p class="n88-unified-instruction">${escape(item.instruction)}</p>` : ''}${item.startDate ? `<p>يبدأ: <span dir="ltr">${escape(item.startDate)}</span></p>` : ''}${item.dueDate ? `<p>التسليم: <span dir="ltr">${escape(item.dueDate)}</span></p>` : ''}${item.completionState !== undefined ? `<p>${escape({unrecorded:'لم يُرصد إنجاز',regular:'مكتمل',late:'مكتمل متأخر'}[item.completionState])}</p>` : ''}${item.deadline !== undefined ? `<p>الموعد: <span dir="ltr">${escape(item.deadline)}</span></p>` : ''}${item.status !== undefined ? `<p>${escape(item.status)}</p>` : ''}`;
        return detail ? `<details class="n88-unified-work"><summary><span>${escape(item.title)}</span><span class="n88-unified-detail-hint">التفاصيل</span></summary><div class="n88-unified-detail">${detail}</div></details>` : `<article class="n88-unified-work"><h3>${escape(item.title)}</h3></article>`;
      }).join('') : '<p class="n88-unified-empty">لا توجد أعمال منشورة في هذا القسم.</p>'}</section>`;
    }
    paint(content + '</div>');
  }
  function inlineEntry(message='',invalid=false) {
    const form=root.querySelector('[data-claim]');if(!form)return;
    const cooling=Date.now()<cooldownUntil,field=form.querySelector('input');
    form.setAttribute('aria-busy',String(busy));field.disabled=!enabled||busy||cooling;
    field.setAttribute('aria-invalid',String(invalid));
    form.querySelector('[type=submit]').disabled=!enabled||busy||cooling;
    form.querySelector('[type=submit]').textContent=busy?'جارٍ التحقق…':'دخول الطالب';
    root.querySelector('[data-resume]').disabled=busy||cooling;
    form.querySelector('[role=status]').textContent=cooling?'يرجى الانتظار قليلًا قبل المحاولة مجددًا.':message;
    clearTimeout(timer);if(cooling)timer=setTimeout(()=>inlineEntry('يمكنك المحاولة مجددًا.'),Math.max(1,cooldownUntil-Date.now()));
  }
  async function run(action, ending = false, sameForm = false, resuming = false) {
    if (disposed || busy || !enabled || Date.now() < cooldownUntil) return;
    busy = true; const checkpoint = ++generation;
    if(sameForm)inlineEntry(resuming?'جارٍ التحقق من الجلسة…':'جارٍ التحقق من الرمز…');
    else paint('<h1 tabindex="-1">جارٍ الاتصال…</h1><p role="status">يرجى الانتظار</p>');
    try {
      const data = await action();
      if (disposed || checkpoint !== generation) return;
      if (ending) entry('انتهت الجلسة.'); else show(data);
    } catch (error) {
      if (disposed || checkpoint !== generation) return;
      if (error?.kind === 'rate') cooldownUntil = Date.now() + Math.min(300, Math.max(1, error.retryAfter || 30)) * 1000;
      if(sameForm)inlineEntry(resuming?'الجلسة غير متاحة أو انتهت. أدخل رمزك أو راجع معلمك.':'تعذّر الدخول بهذا الرمز. تحقق منه أو راجع معلّمك.',!resuming);
      else entry(error?.kind === 'session' ? 'الجلسة غير متاحة أو انتهت. أدخل رمزك أو راجع معلمك.' : 'تعذّر فتح المساحة. تحقق من الرمز أو حاول لاحقًا.');
    } finally { if (checkpoint === generation) {busy = false;if(sameForm&&root.querySelector('[data-claim]')){const m=root.querySelector('#n88-message').textContent;inlineEntry(m,root.querySelector('input').getAttribute('aria-invalid')==='true');}} }
  }
  const submit = event => {
    if (!event.target.matches('[data-claim]')) return;
    event.preventDefault(); if (busy || !enabled) return;
    const input = root.querySelector('input'); let code = normalizeStudentCode(input.value); input.value = '';
    if (!validStudentCode(code)) { code = ''; inlineEntry('أدخل 6 أرقام تبدأ بالرقم 1.',true); input.focus(); return; }
    void run(() => { const pending = client.claim(code); code = ''; return pending; },false,true);
  };
  const input = event => { if (event.target.matches('[data-claim] input')) {
    event.target.setCustomValidity(''); event.target.removeAttribute('aria-invalid');
    event.target.value = normalizeStudentCode(event.target.value);
  } };
  // Reject overlong paste/insertion before native maxlength can silently truncate it.
  const rejectOverflow = (event, pasted = false) => {
    const field = event.target;
    if (!field.matches('[data-claim] input')) return;
    const added = pasted ? event.clipboardData?.getData('text') : event.data;
    if (typeof added !== 'string') return;
    const proposed = field.value.slice(0, field.selectionStart ?? field.value.length) + added + field.value.slice(field.selectionEnd ?? field.value.length);
    if (normalizeStudentCode(proposed).length > 6) {
      event.preventDefault(); field.value = '';
      inlineEntry('أدخل 6 أرقام تبدأ بالرقم 1.',true);
    } else if (pasted) {
      event.preventDefault(); field.value = normalizeStudentCode(proposed); input({target:field});
    }
  };
  const beforeInput = event => rejectOverflow(event);
  const paste = event => rejectOverflow(event, true);
  const click = event => {
    if (event.target.closest('[data-resume]')) void run(() => client.read(),false,true,true);
    if (event.target.closest('[data-read]')) void run(() => client.read());
    if (event.target.closest('[data-end]')) void run(() => client.end(), true);
  };
  function clear() { generation++; busy = false; clearTimeout(timer); client?.invalidate?.(); entry(); }
  const hide = () => clear();
  const visible = () => { if (doc.visibilityState === 'hidden') clear(); };
  const pageshow = event => { if (event.persisted) clear(); };
  root.addEventListener('beforeinput', beforeInput); root.addEventListener('paste', paste); root.addEventListener('submit', submit); root.addEventListener('input', input); root.addEventListener('click', click);
  win.addEventListener('pagehide', hide); win.addEventListener('pageshow', pageshow); doc.addEventListener('visibilitychange', visible);
  entry();
  // HttpOnly session cookies cannot be safely inspected here. Initial entry is
  // immediate; explicit resume still requires an authoritative server read.
  const ready = Promise.resolve();
  return { ready, clear, refresh: () => run(() => client.read()), dispose() {
    if (disposed) return;
    clear(); disposed = true; clearTimeout(timer); client?.dispose?.(); root.replaceChildren(); style.remove();
    root.classList.remove('n88-unified'); if (previousDir === null) root.removeAttribute('dir'); else root.setAttribute('dir', previousDir);
    root.removeEventListener('beforeinput', beforeInput); root.removeEventListener('paste', paste); root.removeEventListener('submit', submit); root.removeEventListener('input', input); root.removeEventListener('click', click);
    win.removeEventListener('pagehide', hide); win.removeEventListener('pageshow', pageshow); doc.removeEventListener('visibilitychange', visible);
  } };
}
