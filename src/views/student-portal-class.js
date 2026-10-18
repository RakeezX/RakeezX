import { html } from '../lib/dom.js';
/** AI: reusable existing-class section; no route, runtime import, publication or network at import time. */
import { classContextKey, PORTAL_FIELDS } from '../lib/student-portal-class-client.js';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const labels = { name:'اسم الطالب', class:'الفصل', grades:'الدرجات', required:'المهام المطلوبة', completed:'المهام المكتملة', scheduled:'المهام المجدولة' };
export function mountClassPortal(root, { client, getContext = () => null, subscribe = () => () => {}, classLabel = () => 'الفصل الحالي', copy = text => navigator.clipboard.writeText(text), share = typeof navigator.share==='function' ? data=>navigator.share(data) : null, requestId = () => crypto.randomUUID() } = {}) {
  let generation = 0, disposed = false, busy = false, roster = null, selected = null, outcomes = [], message = '', boundKey = null, expiryTimer;
  root.classList.add('n88-class'); root.dir = 'rtl';
  const context = () => { try { return getContext(); } catch { return null; } };
  const key = () => classContextKey(context());
  const valid = (g, k) => !disposed && g === generation && k !== null && k === key();
  const clearSecrets = () => { if(roster)for(const s of roster.students)s.credential=null; root.querySelectorAll('[data-code],[data-manual]').forEach(el=>el.remove()); root.querySelector('[data-delivery]')?.remove(); };
  const shareText=s=>`مرحبًا ${s.label}،\nرمز دخولك: ${s.credential}\n${new URL('/student',root.ownerDocument.defaultView.location.origin).href}\nافتح صفحة الطالب وأدخل الرمز لعرض مساحتك الدراسية.`;
  function draw() {
    if (disposed) return;
    const ready = !!client && !!key(), writable = ready && !!roster && !busy;
    root.innerHTML = `<section aria-label="مساحة طلاب الفصل"><h2>${esc(classLabel())} — مساحة الطلاب</h2><p>صفحة دخول موحّدة للطلاب برمز شخصي من 6 أرقام يبدأ بـ1. يبقى الرمز حتى تغييره أو إلغائه. يمكنك الرجوع إلى الرمز الحالي ونسخه ومشاركته. أنت تختار طريقة تسليمه؛ لا تُرسل رسائل تلقائيًا.</p>
      <p role="status" aria-live="polite">${esc(message || (ready ? 'جارٍ قراءة قائمة الفصل…' : 'مساحة الطلاب غير مفعّلة حاليًا. لا تتوفر عمليات كتابة.'))}</p>
      ${ready ? `<div class="n88-class-actions"><button class="btn btn--primary" data-action="batch" ${!writable ? 'disabled' : ''}>إنشاء رموز الطلاب</button><button class="btn" data-action="refresh" ${busy ? 'disabled' : ''}>تحديث ومراجعة القائمة</button></div><p>الإنشاء للطلاب الذين ليس لديهم رمز فعّال فقط؛ إعادة المحاولة لا تغيّر الرموز الموجودة.</p>` : ''}
      ${roster ? `<p>${roster.students.length} طالبًا في القائمة الحالية</p><ul class="n88-class-roster">${roster.students.map((s, index) => `<li><div><strong>${esc(s.label)}</strong><span>${s.credential ? 'رمزه الحالي' : s.recoveryStatus==='legacy' ? 'رمز قديم غير قابل للاسترجاع — اختر تغيير رمز هذا الطالب فقط لإنشاء بديل؛ يُبطل الرمز السابق وجلساته' : s.hasActiveCode ? 'يلزم تحديث القائمة لإظهار الرمز' : 'بلا رمز فعّال'}</span>${s.credential ? `<div data-code><input readonly autocomplete="off" dir="ltr" aria-label="رمز ${esc(s.label)}" value="${esc(s.credential)}"><button class="btn" data-action="copy-student" data-index="${index}" ${!writable ? 'disabled' : ''}>نسخ رسالة الطالب</button>${share ? `<button class="btn" data-action="share-student" data-index="${index}" ${!writable ? 'disabled' : ''}>مشاركة رسالة الطالب</button>` : ''}</div>` : ''}</div><div class="n88-class-actions"><button class="btn" data-action="review-rotate" data-index="${index}" ${!writable || s.credentialVersion < 1 ? 'disabled' : ''}>تغيير الرمز</button><button class="btn" data-action="review-revoke" data-index="${index}" ${!writable || !s.hasActiveCode ? 'disabled' : ''}>إلغاء الوصول</button></div></li>`).join('')}</ul>
      <form data-visibility><fieldset ${!writable ? 'disabled' : ''}><legend>الحقول التي تظهر لطلاب هذا الفصل</legend><p>لا يظهر أي حقل إلا باختيارك وحفظه. هذه الإعدادات لا تنشئ درجات أو حالات إنجاز.</p><div class="n88-class-fields">${PORTAL_FIELDS.map(f => `<label><input type="checkbox" name="${f}" ${roster.visibility[f] ? 'checked' : ''}> ${labels[f]}</label>`).join('')}</div><button class="btn btn--primary" type="submit">حفظ الحقول الظاهرة</button></fieldset></form>` : ''}
      ${selected && writable ? `<section class="card" data-confirm><h3>${esc(selected.student.label)}</h3><p>${selected.action === 'rotate' ? 'تغيير الرمز يُبطل الرمز السابق وجميع جلساته. سلّم البديل لهذا الطالب وحده بعد التحقق من هويته.' : 'إلغاء الوصول يُبطل الرمز الحالي وجميع جلساته، ولن يستطيع الطالب الدخول به.'}</p><button class="btn" data-action="confirm">${selected.action === 'rotate' ? 'تأكيد تغيير الرمز' : 'تأكيد إلغاء الوصول'}</button><button class="btn" data-action="cancel">تراجع</button></section>` : ''}
      ${outcomes.length ? `<ul data-outcomes>${outcomes.map(line => `<li>${esc(line)}</li>`).join('')}</ul>` : ''}<div data-sheet-host></div></section>`;
  }

  async function refresh() {
    if (disposed) return;
    const g = ++generation, k = key(); boundKey = k; busy = true; roster = null; selected = null; outcomes = []; clearSecrets(); message = ''; draw();
    clearTimeout(expiryTimer);
    if (k) expiryTimer = setTimeout(() => { void refresh(); }, Math.min(2147483647, Math.max(1, context().validUntil - Date.now())));
    if (!client || !k) { busy = false; draw(); return; }
    try { const result = await client.listClass(context().teachingId); if (valid(g, k)) { roster = result; message = 'راجع القائمة والحقول قبل إجراء أي تغيير.'; } }
    catch { if (valid(g, k)) message = 'تعذّر التحقق من قائمة الفصل. حدّث السياق وراجع القائمة قبل المحاولة.'; }
    finally { if (valid(g, k)) { busy = false; draw(); } }
  }
  async function perform(operation, success) {
    if (busy || !roster || !key()) return;
    const g = ++generation, k = key(), oldRoster = roster;
    busy = true; selected = null; outcomes = []; clearSecrets(); message = 'بانتظار إقرار الخادم…'; draw();
    try {
      const result = await operation(oldRoster);
      if (!valid(g, k)) return;
      success(result, oldRoster); roster = null;
      const outcomeMessage=message,outcomeLines=outcomes;
      busy=false;const refreshing=refresh(),refreshGeneration=generation;await refreshing;
      if(valid(refreshGeneration,k)&&roster){message=outcomeMessage;outcomes=outcomeLines;draw();}
    } catch {
      if (!valid(g, k)) return;
      roster = null; clearSecrets(); message = 'لم يتأكد اكتمال العملية. قد تكون نُفّذت؛ حدّث القائمة وراجع الحالة قبل إعادة المحاولة. لا يُفترض النجاح.';
    } finally { if (valid(g, k)) { busy = false; draw(); } }
  }
  const click = e => {
    const button = e.target.closest('[data-action]'); if (!button || !root.contains(button) || disposed) return;
    if (key() !== boundKey) { void refresh(); return; }
    const action = button.dataset.action;
    if (busy) return;
    if (action === 'refresh') { void refresh(); return; }
    if (!roster) return;
    if(action==='copy-student'||action==='share-student') {
      const s=roster.students[Number(button.dataset.index)];if(!s?.credential)return;
      const g=generation,k=key(),text=shareText(s);
      try {Promise.resolve(action==='copy-student'?copy(text):share?.({text})).then(()=>{
        if(valid(g,k)){message=action==='copy-student'?'نُسخت رسالة الطالب. اختر طريقة تسليمها.':'اكتملت نافذة المشاركة؛ لا نؤكد إرسال رسالة.';draw();}
      }).catch(()=>{if(valid(g,k)){message=action==='copy-student'?'تعذّر النسخ؛ حدّد الرسالة وانسخها يدويًا.':'أُلغيت المشاركة أو تعذّرت؛ لم يُؤكّد الإرسال.';draw();if(action==='copy-student'){const area=root.ownerDocument.createElement('textarea');area.dataset.manual='';area.readOnly=true;area.value=text;root.append(area);area.select();}}});}
      catch {message='تعذّر النسخ أو المشاركة. حدّد الرمز يدويًا.';draw();}return;
    }
    if (action === 'cancel') { selected = null; draw(); return; }
    if (action.startsWith('review-')) { const student = roster.students[Number(button.dataset.index)]; if (student && (student.hasActiveCode || action === 'review-rotate' && student.credentialVersion > 0)) { clearSecrets(); selected = { student, action: action.slice(7) }; draw(); root.querySelector('[data-confirm] button')?.focus(); } return; }
    if (action === 'batch') void perform(r => client.issueMissingClassCodes(context().teachingId, { requestId: requestId(), expectedRosterRevision: r.rosterRevision }), (result, r) => {

      const reasons = { existing:'رمزه موجود؛ لم يتغير', revoked:'أُلغي وصوله؛ يلزم تغيير انتقائي', conflict:'تغيّرت بياناته؛ يلزم تحديث القائمة', unavailable:'تعذّر الإنشاء', not_current:'لم يعد ضمن القائمة الحالية' };
      outcomes = [...result.skipped, ...result.failed].map(s => r.students.find(m => m.studentId === s.studentId).label + ': ' + reasons[s.reason]);
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
    if (key() !== boundKey) { void refresh(); return; }
    const fields = Object.fromEntries(PORTAL_FIELDS.map(f => [f, e.target.elements.namedItem(f).checked]));
    void perform(r => client.saveVisibility(context().teachingId, { policyRevision: r.policyRevision, fields }), () => { message = 'أقرّ الخادم حفظ الحقول المختارة.'; });
  };
  const changed = () => { void refresh(); };
  const pagehide = () => { generation++; clearTimeout(expiryTimer); busy = false; roster = null; selected = null; outcomes = []; clearSecrets(); message = 'أُغلق عرض الرموز. حدّث القائمة للمتابعة.'; draw(); };
  root.addEventListener('click', click); root.addEventListener('submit', submit); root.ownerDocument.defaultView.addEventListener('pagehide', pagehide);
  const unsubscribe = subscribe(changed); void refresh();
  return { contextChanged: changed, refresh, dispose() { disposed = true; generation++; clearTimeout(expiryTimer); roster = null; selected = null; clearSecrets(); unsubscribe?.(); root.removeEventListener('click', click); root.removeEventListener('submit', submit); root.ownerDocument.defaultView.removeEventListener('pagehide', pagehide); root.replaceChildren(); } };
}

// Integration must supply actual service binding and class context. This adapter stays unavailable by default.
let routeHandle,routeGeneration=0,routeRoot;
export default { title: () => 'مساحة طلاب الفصل', back:p=>'#/teaching/'+encodeURIComponent(p.id),render: () => html`<div data-class-portal></div>`,
  afterPaint(root,params) {
    const target=root.querySelector('[data-class-portal]');if(!target||target===routeRoot)return;
    routeHandle?.dispose();routeRoot=target;const generation=++routeGeneration;
    const link=root.ownerDocument.createElement('link');link.rel='stylesheet';link.href=new URL('../styles/student-portal-class.css',import.meta.url).href;
    if(!root.ownerDocument.querySelector('[data-n88-class-style]')){link.dataset.n88ClassStyle='';root.ownerDocument.head.append(link);}
    void Promise.all([import('../lib/student-portal-runtime.js'),import('../lib/cloud.js'),import('../store.js')]).then(([runtime,cloud,store])=>{
      if(generation!==routeGeneration||!target.isConnected)return;
      routeHandle=runtime.mountClassService(target,{classLabel:()=>store.sectionLabel(store.getSection(store.getTeaching(params.id)?.sectionId)),getBinding:write=>runtime.classBinding({cloud,store,teachingId:params.id},write),
        subscribe:fn=>{const a=cloud.subscribe(fn),b=store.subscribe(fn);return()=>{a();b();};}});
    }).catch(()=>{if(generation===routeGeneration)target.textContent='مساحة الطلاب غير متاحة حاليًا.';});
  },
  onUnmount() { routeGeneration++;routeHandle?.dispose();routeHandle=null;routeRoot=null; } };
