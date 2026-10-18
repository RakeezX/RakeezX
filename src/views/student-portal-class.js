import { html } from '../lib/dom.js';
/** AI: reusable existing-class section; no route, runtime import, publication or network at import time. */
import { classContextKey, PORTAL_FIELDS } from '../lib/student-portal-class-client.js';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const labels = { name:'اسم الطالب', class:'الفصل', grades:'الدرجات', required:'المهام المطلوبة', completed:'المهام المكتملة', scheduled:'المهام المجدولة' };
export function mountClassPortal(root, { client, getContext = () => null, subscribe = () => () => {}, classLabel = () => 'الفصل الحالي', copy = text => navigator.clipboard.writeText(text), share = typeof navigator.share==='function' ? data=>navigator.share(data) : null, requestId = () => crypto.randomUUID() } = {}) {
  let generation = 0, disposed = false, busy = false, roster = null, selected = null, outcomes = [], message = '', boundKey = null, expiryTimer, wakeTimer, readWork = null, mutating = false, queued = false, suspended = false, retry = false, draft = null, draftRevision = null, settingsOpen = false;
  root.classList.add('n88-class'); root.dir = 'rtl';
  const context = () => { try { return getContext(); } catch { return null; } };
  const key = () => classContextKey(context());
  const valid = (g, k) => !disposed && g === generation && k !== null && k === key();
  const clearSecrets = () => { if(roster)for(const s of roster.students)s.credential=null; root.querySelectorAll('[data-code],[data-manual]').forEach(el=>el.remove()); root.querySelector('[data-delivery]')?.remove(); };
  const shareText=s=>`مرحبًا ${s.label}،\nرمز دخولك: ${s.credential}\n${new URL('/student',root.ownerDocument.defaultView.location.origin).href}\nافتح صفحة الطالب وأدخل الرمز لعرض مساحتك الدراسية.`;
  function draw() {
    if (disposed) return;
    const ready = !!client && !!key(), writable = ready && !!roster && !busy;
    const focused = root.ownerDocument.activeElement;
    const focusAction = root.contains(focused) ? { action: focused.dataset.action, index: focused.dataset.index, name: focused.name } : null;
    settingsOpen = root.querySelector('details')?.open ?? settingsOpen;
    root.setAttribute('aria-busy', String(busy));
    root.innerHTML = `<section aria-label="مساحة طلاب الفصل">
      <div class="n88-class-toolbar"><p class="n88-class-purpose">رموز دخول الطلاب إلى مساحتهم الدراسية.</p>${ready ? `<button class="btn btn--primary" data-action="batch" ${!writable ? 'disabled' : ''}>إنشاء الرموز</button>` : ''}</div>
      <div class="n88-class-status"><p role="status" aria-live="polite">${esc(message || (ready ? (busy ? 'جارٍ قراءة القائمة…' : '') : 'مساحة الطلاب غير مفعّلة حاليًا.'))}</p>${retry && ready ? `<button class="btn" data-action="refresh" ${busy ? 'disabled' : ''}>مراجعة القائمة</button>` : ''}</div>
      ${roster ? `<ul class="n88-class-roster" aria-label="طلاب ${esc(classLabel())}">${roster.students.map((s, index) => `<li><div class="n88-class-student"><strong>${esc(s.label)}</strong>${s.credential ? `<div data-code><input readonly autocomplete="off" dir="ltr" aria-label="رمز ${esc(s.label)}" value="${esc(s.credential)}"></div>` : `<span>${s.recoveryStatus==='legacy' ? 'رمز قديم لا يُسترجع؛ اختر تغيير لاستبداله' : s.hasActiveCode ? 'الرمز مخفي؛ راجع القائمة لإظهاره' : 'بلا رمز فعّال'}</span>`}</div><div class="n88-class-actions">${s.credential ? `<button class="btn" data-action="copy-student" data-index="${index}" aria-label="نسخ رسالة ${esc(s.label)}" ${!writable ? 'disabled' : ''}>نسخ</button><button class="btn" data-action="share-student" data-index="${index}" aria-label="مشاركة رسالة ${esc(s.label)}" ${!writable ? 'disabled' : ''}>مشاركة</button>` : ''}<button class="btn" data-action="review-rotate" data-index="${index}" aria-label="تغيير رمز ${esc(s.label)}" ${!writable || s.credentialVersion < 1 ? 'disabled' : ''}>تغيير</button><button class="btn" data-action="review-revoke" data-index="${index}" aria-label="إلغاء وصول ${esc(s.label)}" ${!writable || !s.hasActiveCode ? 'disabled' : ''}>إلغاء</button></div></li>`).join('')}</ul>
      <details class="n88-class-settings" ${settingsOpen ? 'open' : ''}><summary>الحقول الظاهرة للطلاب</summary><form data-visibility><fieldset ${!writable ? 'disabled' : ''}><legend>اختر الحقول ثم احفظها</legend><div class="n88-class-fields">${PORTAL_FIELDS.map(f => `<label><input type="checkbox" name="${f}" ${(draft ?? roster.visibility)[f] ? 'checked' : ''}> ${labels[f]}</label>`).join('')}</div><button class="btn" type="submit">حفظ الحقول</button></fieldset></form></details>` : ''}
      ${selected && writable ? `<section class="card" data-confirm aria-label="تأكيد العملية"><h3>${esc(selected.student.label)}</h3><p>${selected.action === 'rotate' ? 'تغيير الرمز يُبطل الرمز السابق وجميع جلساته. سلّم البديل لهذا الطالب وحده بعد التحقق من هويته.' : 'إلغاء الوصول يُبطل الرمز الحالي وجميع جلساته، ولن يستطيع الطالب الدخول به.'}</p><div class="n88-class-actions"><button class="btn" data-action="confirm">${selected.action === 'rotate' ? 'تأكيد تغيير الرمز' : 'تأكيد إلغاء الوصول'}</button><button class="btn" data-action="cancel">تراجع</button></div></section>` : ''}
      ${outcomes.length ? `<ul data-outcomes>${outcomes.map(line => `<li>${esc(line)}</li>`).join('')}</ul>` : ''}</section>`;
    if (focusAction) [...root.querySelectorAll('button,input')].find(el => focusAction.action ? el.dataset.action === focusAction.action && el.dataset.index === focusAction.index : focusAction.name && el.name === focusAction.name)?.focus({preventScroll:true});
  }

  // AI: invalidate synchronously, coalesce only reads; never queue a mutation.
  function invalidate(nextKey = key()) {
    generation++; clearSecrets(); roster = null; selected = null; outcomes = []; retry = false;
    if (nextKey !== boundKey) { draft = null; draftRevision = null; settingsOpen = false; }
    boundKey = nextKey; clearTimeout(expiryTimer);
  }
  function scheduleRead() {
    if (disposed || suspended) return;
    if (key() !== boundKey) { invalidate(); message = ''; draw(); }
    if (mutating) { queued = true; return; }
    if (readWork) { if (key() !== readWork.key || generation !== readWork.generation) queued = true; return; }
    clearTimeout(wakeTimer);
    wakeTimer = setTimeout(() => { void refresh(); }, 40);
  }
  function refresh() {
    if (disposed || suspended) return Promise.resolve();
    if (mutating) { queued = true; return Promise.resolve(); }
    if (readWork) { if (key() !== readWork.key || generation !== readWork.generation) queued = true; return readWork.promise; }
    clearTimeout(wakeTimer);
    const k = key(); invalidate(k); const g = generation;
    busy = true; message = ''; draw();
    if (k) expiryTimer = setTimeout(() => { changed(); if (key()) scheduleRead(); }, Math.min(2147483647, Math.max(1, context().validUntil - Date.now())));
    if (!client || !k) { busy = false; draw(); return Promise.resolve(); }
    const work = { key:k, generation:g };
    readWork = work;
    work.promise = (async () => {
      try {
        const result = await client.listClass(context().teachingId);
        if (valid(g, k)) {
          roster = result;
          if (draft && draftRevision !== result.policyRevision) { draft = null; draftRevision = null; message = 'تغيّرت إعدادات الحقول؛ راجع اختيارك من جديد.'; }
          else message = '';
        }
      } catch { if (valid(g, k)) { retry = true; message = 'تعذّرت قراءة القائمة. راجعها للمتابعة.'; } }
      finally {
        if (readWork === work) readWork = null;
        busy = mutating;
        if (!disposed) {
          if (key() !== boundKey) invalidate();
          draw();
          if (queued) { queued = false; scheduleRead(); }
        }
      }
    })();
    return work.promise;
  }

  async function perform(operation, success) {
    if (busy || !roster || !key()) return;
    const g = ++generation, k = key(), oldRoster = roster;
    mutating = true; busy = true; selected = null; outcomes = []; clearSecrets(); message = 'بانتظار إقرار الخادم…'; draw();
    try {
      const result = await operation(oldRoster);
      if (!valid(g, k)) return;
      success(result, oldRoster); roster = null;
      const outcomeMessage=message,outcomeLines=outcomes;
      mutating=false;busy=false;queued=false;const refreshing=refresh(),refreshGeneration=generation;await refreshing;
      if(valid(refreshGeneration,k)&&roster){message=outcomeMessage;outcomes=outcomeLines;draw();}
    } catch {
      if (!valid(g, k)) return;
      clearSecrets(); roster = null; queued = false; retry = true; message = 'نتيجة العملية غير مؤكدة؛ راجع القائمة قبل أي تغيير.';
    } finally { mutating = false; busy = !!readWork; if (!disposed) { if (key() !== boundKey) invalidate(); draw(); if (queued) { queued = false; scheduleRead(); } } }
  }
  const click = e => {
    const button = e.target.closest('[data-action]'); if (!button || !root.contains(button) || disposed) return;
    if (key() !== boundKey) { invalidate(); void refresh(); return; }
    const action = button.dataset.action;
    if (busy) return;
    if (action === 'refresh') { void refresh(); return; }
    if (!roster) return;
    if(action==='copy-student'||action==='share-student') {
      const s=roster.students[Number(button.dataset.index)];if(!s?.credential)return;
      const g=generation,k=key(),text=shareText(s);
      const fallback = () => {
        if (!valid(g,k)) return;
        message = 'انسخ الرسالة يدويًا لتسليمها.'; draw();
        const area = root.ownerDocument.createElement('textarea'); area.dataset.manual=''; area.readOnly=true;
        area.setAttribute('aria-label','رسالة الطالب للنسخ اليدوي'); area.value=text; root.append(area); area.focus(); area.select();
      };
      try {
        if (action==='share-student' && !share) { fallback(); return; }
        Promise.resolve(action==='copy-student' ? copy(text) : share({text})).then(() => {
          if(valid(g,k)){message=action==='copy-student'?'نُسخت رسالة الطالب.':'أُغلقت المشاركة؛ تحقّق من التسليم.';draw();}
        }).catch(fallback);
      } catch { fallback(); } return;
    }
    if (action === 'cancel') { selected = null; void refresh(); return; }
    if (action.startsWith('review-')) { const student = roster.students[Number(button.dataset.index)]; if (student && (student.hasActiveCode || action === 'review-rotate' && student.credentialVersion > 0)) { clearSecrets(); selected = { student, action: action.slice(7) }; draw(); root.querySelector('[data-confirm] button')?.focus(); } return; }
    if (action === 'batch') void perform(r => client.issueMissingClassCodes(context().teachingId, { requestId: requestId(), expectedRosterRevision: r.rosterRevision }), (result, r) => {

      const reasons = { existing:'رمزه موجود؛ لم يتغير', revoked:'أُلغي وصوله؛ يلزم تغيير انتقائي', conflict:'تغيّرت بياناته؛ يلزم تحديث القائمة', unavailable:'تعذّر الإنشاء', not_current:'لم يعد ضمن القائمة الحالية' };
      outcomes = [...result.skipped.filter(s => s.reason !== 'existing'), ...result.failed].map(s => r.students.find(m => m.studentId === s.studentId).label + ': ' + reasons[s.reason]);
      const reported = new Set([...result.created, ...result.skipped, ...result.failed].map(s => s.studentId));
      outcomes.push(...r.students.filter(s => !reported.has(s.studentId)).map(s => s.label + ': نتيجة غير مؤكدة؛ راجع القائمة'));
      message = `أُنشئ: ${result.created.length}، موجود مسبقًا: ${result.skipped.length}، تعذّر: ${result.failed.length}.${result.uncertain ? ' توجد نتائج غير مؤكدة؛ لا تفترض اكتمال الإنشاء.' : ''}`;
    });
    if (action === 'confirm' && selected) {
      const { student: s, action: command } = selected;
      void perform(() => client[command]({ studentId: s.studentId, enrollmentId: s.enrollmentId, revision: s.revision, credentialVersion: s.credentialVersion, requestId: requestId() }), result => {
        message = command === 'rotate' ? 'أُقرّ تغيير الرمز وإبطال السابق وجلساته.' : 'أُقرّ إلغاء الرمز والوصول وجلساته.';

      });
    }
  };
  const submit = e => {
    if (!e.target.matches('[data-visibility]')) return;
    e.preventDefault(); if (busy || !roster) return;
    if (key() !== boundKey) { invalidate(); void refresh(); return; }
    const fields = Object.fromEntries(PORTAL_FIELDS.map(f => [f, e.target.elements.namedItem(f).checked]));
    void perform(r => client.saveVisibility(context().teachingId, { policyRevision: r.policyRevision, fields }), () => { draft = null; draftRevision = null; message = 'حُفظت الحقول المختارة.'; });
  };
  const change = e => {
    if (!e.target.closest('[data-visibility]') || !roster) return;
    draft = Object.fromEntries(PORTAL_FIELDS.map(f => [f, root.querySelector(`[name="${f}"]`).checked]));
    draftRevision = roster.policyRevision;
  };
  const changed = () => {
    if (key() !== boundKey) { invalidate(); message = ''; draw(); }
    // Roster/policy updates can retain the same class key. Read once per burst,
    // ignoring same-context notifications from an already active read.
    if (key()) scheduleRead();
  };
  const wake = () => { if (root.ownerDocument.visibilityState === 'visible') { suspended = false; scheduleRead(); } };
  const pagehide = () => { suspended = true; clearTimeout(wakeTimer); invalidate(); busy = mutating || !!readWork; message = 'الرموز مخفية حتى مراجعة القائمة.'; draw(); };
  const win = root.ownerDocument.defaultView;
  root.addEventListener('click', click); root.addEventListener('submit', submit); root.addEventListener('change', change);
  win.addEventListener('pagehide', pagehide); win.addEventListener('pageshow', wake); win.addEventListener('focus', wake);
  root.ownerDocument.addEventListener('visibilitychange', wake);
  const unsubscribe = subscribe(changed); void refresh();
  return { contextChanged: changed, refresh, dispose() {
    clearSecrets(); disposed = true; generation++; clearTimeout(expiryTimer); clearTimeout(wakeTimer);
    roster = null; selected = null; draft = null; unsubscribe?.();
    root.removeEventListener('click', click); root.removeEventListener('submit', submit); root.removeEventListener('change', change);
    win.removeEventListener('pagehide', pagehide); win.removeEventListener('pageshow', wake); win.removeEventListener('focus', wake);
    root.ownerDocument.removeEventListener('visibilitychange', wake); root.replaceChildren();
  } };

}

// Integration must supply actual service binding and class context. This adapter stays unavailable by default.
let routeHandle,routeGeneration=0,routeRoot,routeTeaching;
export default { title: () => 'مساحة طلاب الفصل', back:p=>'#/teaching/'+encodeURIComponent(p.id),render: () => html`<div data-class-portal></div>`,
  afterPaint(root,params) {
    const target=root.querySelector('[data-class-portal]');if(!target||target===routeRoot)return;
    // The shell redraws on pageshow/visibility: retain this route instance and its
    // unsaved fields/in-flight command, never remount or replay it on a repaint.
    if(routeRoot && routeTeaching===params.id){target.replaceWith(routeRoot);return;}
    routeHandle?.dispose();routeRoot=target;routeTeaching=params.id;const generation=++routeGeneration;
    const link=root.ownerDocument.createElement('link');link.rel='stylesheet';link.href=new URL('../styles/student-portal-class.css',import.meta.url).href;
    if(!root.ownerDocument.querySelector('[data-n88-class-style]')){link.dataset.n88ClassStyle='';root.ownerDocument.head.append(link);}
    void Promise.all([import('../lib/student-portal-runtime.js'),import('../lib/cloud.js'),import('../store.js')]).then(([runtime,cloud,store])=>{
      if(generation!==routeGeneration||!target.isConnected)return;
      routeHandle=runtime.mountClassService(target,{classLabel:()=>store.sectionLabel(store.getSection(store.getTeaching(params.id)?.sectionId)),getBinding:write=>runtime.classBinding({cloud,store,teachingId:params.id},write),
        subscribe:fn=>{const a=cloud.subscribe(fn),b=store.subscribe(fn);return()=>{a();b();};}});
    }).catch(()=>{if(generation===routeGeneration)target.textContent='مساحة الطلاب غير متاحة حاليًا.';});
  },
  onUnmount() { routeGeneration++;routeHandle?.dispose();routeHandle=null;routeRoot=null;routeTeaching=null; } };
