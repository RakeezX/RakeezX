import { html } from '../lib/dom.js';
/** AI: reusable existing-class section; no route, runtime import, publication or network at import time. */
import { classContextKey, PORTAL_FIELDS } from '../lib/student-portal-class-client.js';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const labels = { name:'اسم الطالب', class:'الفصل', grades:'الدرجات', required:'المهام المطلوبة', completed:'المهام المكتملة', scheduled:'المهام المجدولة' };
/** AI: per-source drafts stay fenced to the exact class/session/source snapshot. */
export function mountTaskGuidance(root,{client,getContext,subscribe}) {
 let disposed=false,busy=false,saving=false,sequence=0,bound=null,tasks=[],selected=null,message='',drafts=new Map(),opened=false,readError=false,uncertain=new Set(),suspended=false,queued=false,wakeTimer,operationSequence=0,loaded=false;
 const current=()=>{try{return classContextKey(getContext());}catch{return null;}};
 const reset=()=>{sequence++;bound=current();tasks=[];selected=null;drafts.clear();message='';readError=false;uncertain.clear();opened=false;loaded=false;};
 const state=()=>{const task=tasks.find(t=>t.subitemId===selected),draft=task&&(drafts.get(selected)||task);return {task,draft,stale:!!(draft&&task&&(draft.sourceStamp!==task.sourceStamp||draft.revision!==task.revision))};};
 const empty=d=>!d.executionInstructions.trim()&&!d.deliveryInstructions.trim();
 const unchanged=(t,d)=>t.executionInstructions===d.executionInstructions&&t.deliveryInstructions===d.deliveryInstructions;
 function updateControls(){
  const {task,draft,stale}=state(),form=root.querySelector('[data-guidance]');if(!task||!form)return;
  const clearing=empty(draft);form.querySelector('[data-clear]').hidden=!clearing;
  if(!clearing)form.elements.confirmClear.checked=false;
  form.querySelector('[data-guidance-count]').textContent=`${draft.executionInstructions.length} / 400 · ${draft.deliveryInstructions.length} / 400`;
  form.querySelector('[type=submit]').disabled=suspended||busy||readError||uncertain.has(selected)||stale||!current()||(!task.needsRepublication&&unchanged(task,draft))||(clearing&&!form.elements.confirmClear.checked);
 }
 function draw(){
  if(disposed)return;
  if(bound!==current())reset();
  opened=root.querySelector('details')?.open??opened;
  const focus=root.contains(root.ownerDocument.activeElement)?root.ownerDocument.activeElement:null;
  const selection=focus?.tagName==='TEXTAREA'?[focus.selectionStart,focus.selectionEnd]:null;
  const focusKey=focus&&(focus.name||[...focus.attributes].find(a=>a.name.startsWith('data-guidance-'))?.name);
  const {task,draft,stale}=state();
  root.innerHTML=`<details class="n88-task-guidance" aria-busy="${busy}" ${opened?'open':''}><summary>تعليمات المهام وطريقة التسليم <small>${tasks.length||''}</small></summary><div class="n88-guidance-body"><p role="status" aria-live="polite">${esc(!current()?'اختر فصلًا متاحًا لإدارة التعليمات.':busy?(saving?'جارٍ حفظ التعليمات…':'جارٍ قراءة المهام… يشمل الانتظار في الطابور، بحد أقصى 10 ثوانٍ.'):message)}</p>${readError?'<button class="btn" type="button" data-guidance-refresh>مراجعة الحالة</button>':''}${tasks.length?`<label>المهمة<select data-guidance-source ${busy?'disabled':''}>${tasks.map(t=>`<option value="${esc(t.subitemId)}" ${selected===t.subitemId?'selected':''}>${esc(t.title)}</option>`).join('')}</select></label>`:current()&&loaded&&!busy&&!readError?'<p class="n88-editor-help">لا توجد مهام متاحة ضمن الحقول المنشورة.</p>':''}${task?`<form data-guidance><fieldset ${saving||!current()?'disabled':''}>${!readError&&(stale||uncertain.has(selected))?'<p class="n88-editor-help">راجع حالة المهمة الحالية؛ مسودتك محفوظة.</p><button class="btn" type="button" data-guidance-revalidate>راجعت الحالة؛ احتفظ بالمسودة</button>':task.needsRepublication?'<p class="n88-editor-help">تغيّرت المهمة؛ راجع التعليمات ثم احفظ لنشرها مجددًا.</p>':''}<div class="n88-guidance-fields"><label>تعليمات التنفيذ<textarea name="executionInstructions" maxlength="400" rows="2">${esc(draft.executionInstructions)}</textarea></label><label>طريقة التسليم<textarea name="deliveryInstructions" maxlength="400" rows="2">${esc(draft.deliveryInstructions)}</textarea></label></div><div class="n88-editor-footer"><small data-guidance-count aria-label="عدد الأحرف لكل حقل"></small><label data-clear hidden><input type="checkbox" name="confirmClear"> أؤكد نشر المهمة دون تعليمات</label><button class="btn btn--primary" type="submit">حفظ التعليمات</button></div></fieldset></form>`:''}</div></details>`;
  updateControls();
  if(focusKey){const next=[...root.querySelectorAll('button,select,textarea,input')].find(e=>e.name===focusKey||e.hasAttribute(focusKey));next?.focus({preventScroll:true});if(next&&selection)next.setSelectionRange(...selection);}
 }
 function scheduleRead(){if(disposed||suspended||!opened)return;if(busy){if(operationSequence!==sequence)queued=true;return;}clearTimeout(wakeTimer);wakeTimer=setTimeout(()=>void refresh(),40);}
 async function refresh(){
  if(disposed||suspended)return;
  if(bound!==current())reset();
  if(busy){if(operationSequence!==sequence)queued=true;return;}
  clearTimeout(wakeTimer);const k=bound,g=++sequence;
  if(!k||!client?.listGuidance){tasks=[];draw();return;}
  busy=true;operationSequence=g;message='';draw();
  try{const result=await client.listGuidance(getContext().teachingId);if(disposed||g!==sequence||k!==current())return;tasks=result.tasks;loaded=true;if(readError)message='';readError=false;if(!tasks.some(t=>t.subitemId===selected))selected=tasks[0]?.subitemId||null;
   const ids=new Set(tasks.map(t=>t.subitemId));for(const id of drafts.keys())if(!ids.has(id))drafts.delete(id);
  }
  catch{if(g===sequence&&k===current()){readError=true;message='تعذّرت قراءة الحالة. مسودتك محفوظة.';}}
  finally{busy=false;if(!disposed){if(k!==current())reset();draw();if(queued){queued=false;scheduleRead();}}}
 }
 const input=e=>{if(bound!==current()){reset();draw();return;}if(!e.target.closest('[data-guidance]'))return;const {task}=state();if(!task)return;const form=root.querySelector('form');drafts.set(selected,{...(drafts.get(selected)||task),executionInstructions:form.elements.executionInstructions.value,deliveryInstructions:form.elements.deliveryInstructions.value});updateControls();};
 const change=e=>{if(bound!==current()){reset();draw();return;}if(e.target.matches('[data-guidance-source]')){selected=e.target.value;message='';draw();}else if(e.target.name==='confirmClear')updateControls();};
 const toggle=()=>{const details=root.querySelector('details');if(!details)return;opened=details.open;if(opened&&!loaded&&!busy&&!readError)scheduleRead();};
 const click=e=>{if(bound!==current()){reset();draw();return;}if(e.target.closest('[data-guidance-refresh]'))void refresh();if(e.target.closest('[data-guidance-revalidate]')&&!busy&&!readError){const {task,draft}=state();if(task&&draft){drafts.set(selected,{...draft,sourceStamp:task.sourceStamp,revision:task.revision});uncertain.delete(selected);message='';draw();}}};
 const submit=async e=>{
  if(!e.target.matches('[data-guidance]'))return;e.preventDefault();
  if(suspended||busy||bound!==current()){if(bound!==current())reset();draw();return;}
  const {task,draft:d,stale}=state();
  if(!task||stale||uncertain.has(selected)||readError||!current()||(!task.needsRepublication&&unchanged(task,d)))return;
  const guidance={subitemId:task.subitemId,sourceStamp:d.sourceStamp,revision:d.revision,executionInstructions:d.executionInstructions,deliveryInstructions:d.deliveryInstructions,confirmClear:empty(d)&&e.target.elements.confirmClear.checked};
  if(empty(d)&&!guidance.confirmClear)return;
  const k=bound,g=++sequence;operationSequence=g;saving=true;busy=true;message='جارٍ حفظ التعليمات…';draw();
  try{await client.saveGuidance(getContext().teachingId,guidance);if(disposed||k!==current()||g!==sequence)return;drafts.delete(task.subitemId);message='حُفظت التعليمات وأُقرّ نشرها.';}
  catch{if(k===current()&&g===sequence){uncertain.add(task.subitemId);message='تعذّر تأكيد النشر. راجع الحالة قبل المحاولة.';}}
  finally{saving=false;busy=false;if(!disposed){if(k!==current())reset();queued=false;draw();await refresh();}}
 };
 const changed=()=>{if(bound===current())return;reset();draw();scheduleRead();};
 const win=root.ownerDocument.defaultView,hide=()=>{suspended=true;clearTimeout(wakeTimer);sequence++;queued=false;loaded=false;message='مسودتك محفوظة؛ ستُراجع الحالة عند العودة.';readError=true;draw();},wake=()=>{if(root.ownerDocument.visibilityState==='visible'){const returning=suspended;suspended=false;changed();if(returning||(!loaded&&!readError))scheduleRead();}};
 root.addEventListener('toggle',toggle,true);root.addEventListener('input',input);root.addEventListener('change',change);root.addEventListener('click',click);root.addEventListener('submit',submit);
 win.addEventListener('pagehide',hide);win.addEventListener('pageshow',wake);win.addEventListener('focus',wake);root.ownerDocument.addEventListener('visibilitychange',wake);
 const unsub=subscribe(changed);reset();draw();
 return {refresh,contextChanged:changed,dispose(){disposed=true;sequence++;clearTimeout(wakeTimer);drafts.clear();unsub?.();win.removeEventListener('pagehide',hide);win.removeEventListener('pageshow',wake);win.removeEventListener('focus',wake);root.ownerDocument.removeEventListener('visibilitychange',wake);root.removeEventListener('toggle',toggle,true);root.removeEventListener('input',input);root.removeEventListener('change',change);root.removeEventListener('click',click);root.removeEventListener('submit',submit);root.replaceChildren();}};
}
export function mountClassPortal(root, { client, getContext = () => null, subscribe = () => () => {}, classLabel = () => 'الفصل الحالي', copy = text => navigator.clipboard.writeText(text), share = typeof navigator.share==='function' ? data=>navigator.share(data) : null, requestId = () => crypto.randomUUID() } = {}) {
  let generation = 0, disposed = false, busy = false, roster = null, selected = null, outcomes = [], message = '', boundKey = null, expiryTimer, wakeTimer, readWork = null, mutating = false, queued = false, suspended = false, retry = false, draft = null, draftRevision = null, settingsOpen = false;
  root.classList.add('n88-class'); root.dir = 'rtl';
  const panel=root.ownerDocument.createElement('div'),guidanceRoot=root.ownerDocument.createElement('div');root.append(panel,guidanceRoot);
  const guidance=mountTaskGuidance(guidanceRoot,{client,getContext,subscribe});
  const context = () => { try { return getContext(); } catch { return null; } };
  const key = () => classContextKey(context());
  const valid = (g, k) => !disposed && g === generation && k !== null && k === key();
  const clearSecrets = () => { if(roster)for(const s of roster.students)s.credential=null; root.querySelectorAll('[data-code],[data-manual]').forEach(el=>el.remove()); root.querySelector('[data-delivery]')?.remove(); };
  const shareText=s=>`مرحبًا ${s.label}،\nرمز دخولك: ${s.credential}\n${new URL('/student',root.ownerDocument.defaultView.location.origin).href}\nافتح صفحة الطالب وأدخل الرمز لعرض مساحتك الدراسية.`;
  function draw() {
    if (disposed) return;
    const ready = !!client && !!key(), writable = ready && !!roster && !busy && !retry;
    const focused = root.ownerDocument.activeElement;
    const focusAction = root.contains(focused) ? { action: focused.dataset.action, index: focused.dataset.index, name: focused.name } : null;
    settingsOpen = panel.querySelector('.n88-class-settings')?.open ?? settingsOpen;
    root.setAttribute('aria-busy', String(busy));
    panel.innerHTML = `<section aria-label="مساحة طلاب الفصل">
      <div class="n88-class-toolbar"><p class="n88-class-purpose">${roster ? 'رموز الدخول · '+esc(roster.students.length) : 'رموز دخول الطلاب'}</p>${ready ? `<button class="btn btn--primary" data-action="batch" ${!writable || !roster.credentialRevision || !roster.students.some(s=>!s.hasActiveCode&&s.credentialVersion===0) ? 'disabled' : ''}>إنشاء الرموز الناقصة</button>` : ''}</div>
      <div class="n88-class-status"><p role="status" aria-live="polite">${esc(message || (ready ? (busy && !roster ? 'جارٍ قراءة القائمة…' : '') : 'مساحة الطلاب غير مفعّلة حاليًا.'))}</p>${retry && ready ? `<button class="btn" data-action="refresh" ${busy ? 'disabled' : ''}>مراجعة القائمة</button>` : ''}</div>
      ${roster ? `<ul class="n88-class-roster" aria-label="طلاب ${esc(classLabel())}">${!roster.students.length?'<li class="n88-roster-empty">لا يوجد طلاب في هذا الفصل.</li>':''}${roster.students.map((s, index) => `<li><div class="n88-class-student"><strong>${esc(s.label)}</strong>${s.credential ? `<div data-code><input readonly autocomplete="off" dir="ltr" aria-label="رمز ${esc(s.label)}" value="${esc(s.credential)}"></div>` : `<span>${s.recoveryStatus==='legacy' ? 'رمز قديم غير مسترجع' : s.hasActiveCode ? 'الرمز مخفي؛ راجع القائمة لإظهاره' : 'بلا رمز فعّال'}</span>`}</div><div class="n88-class-actions">${s.credential ? `<button class="btn" data-action="copy-student" data-index="${index}" aria-label="نسخ رسالة ${esc(s.label)}" ${!writable ? 'disabled' : ''}>نسخ</button><button class="btn" data-action="share-student" data-index="${index}" aria-label="مشاركة رسالة ${esc(s.label)}" ${!writable ? 'disabled' : ''}>مشاركة</button>` : ''}<details class="n88-student-more"><summary aria-label="إجراءات ${esc(s.label)}" data-index="${index}">المزيد</summary><div class="n88-student-more-panel"><button class="btn" data-action="review-rotate" data-index="${index}" aria-label="تغيير رمز ${esc(s.label)}" ${!writable || s.credentialVersion < 1 ? 'disabled' : ''}>تغيير الرمز</button><button class="btn" data-action="review-revoke" data-index="${index}" aria-label="إلغاء وصول ${esc(s.label)}" ${!writable || !s.hasActiveCode ? 'disabled' : ''}>إلغاء الوصول</button></div></details></div></li>`).join('')}</ul>
      <details class="n88-class-settings" ${settingsOpen ? 'open' : ''}><summary>الحقول الظاهرة للطلاب <small>${PORTAL_FIELDS.filter(f=>roster.visibility[f]).length} من ${PORTAL_FIELDS.length}</small></summary><form data-visibility><fieldset ${!writable ? 'disabled' : ''}><legend>اختر الحقول ثم احفظها</legend><div class="n88-class-fields">${PORTAL_FIELDS.map(f => `<label><input type="checkbox" name="${f}" ${(draft ?? roster.visibility)[f] ? 'checked' : ''}> ${labels[f]}</label>`).join('')}</div><button class="btn" type="submit">حفظ الحقول</button></fieldset></form></details>` : ''}
      ${selected && writable ? `<section class="card" data-confirm aria-label="تأكيد العملية"><h3>${esc(selected.student.label)}</h3><p>${selected.action === 'rotate' ? 'تغيير الرمز يُبطل الرمز السابق وجميع جلساته. سلّم البديل لهذا الطالب وحده بعد التحقق من هويته.' : 'إلغاء الوصول يُبطل الرمز الحالي وجميع جلساته، ولن يستطيع الطالب الدخول به.'}</p><div class="n88-class-actions"><button class="btn" data-action="confirm">${selected.action === 'rotate' ? 'تأكيد تغيير الرمز' : 'تأكيد إلغاء الوصول'}</button><button class="btn" data-action="cancel">تراجع</button></div></section>` : ''}
      ${outcomes.length ? `<ul data-outcomes>${outcomes.map(line => `<li>${esc(line)}</li>`).join('')}</ul>` : ''}</section>`;
    if (focusAction) [...root.querySelectorAll('button,input')].find(el => focusAction.action ? el.dataset.action === focusAction.action && el.dataset.index === focusAction.index : focusAction.name && el.name === focusAction.name)?.focus({preventScroll:true});
  }

  // AI: invalidate synchronously, coalesce only reads; never queue a mutation.
  function invalidate(nextKey = key()) {
    guidance.contextChanged(); generation++; clearSecrets(); roster = null; selected = null; outcomes = []; retry = false;
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
    const k = key();
    if(k!==boundKey)invalidate(k);
    const g = ++generation;
    busy = true; retry = false; selected = null; outcomes = []; message = ''; draw();
    clearTimeout(expiryTimer);
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
          else message = result.reconciliation?.some(x=>x.state==='committed') ? 'تأكد إقرار العملية السابقة من السجل؛ عُرضت الحالة الحالية دون إعادة إنشائها.' : result.reconciliation?.some(x=>x.state==='unknown') ? 'تعذّر تحديد بعض النتائج السابقة. القائمة تعرض الحالة الحالية فقط.' : '';
        }
      } catch { if (valid(g, k)) { clearSecrets(); retry = true; message = 'تعذّرت قراءة القائمة. البيانات المعروضة من آخر قراءة مؤكدة؛ راجعها للمتابعة.'; } }
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
    if (busy || retry || !roster || !key()) return;
    const g = ++generation, k = key(), oldRoster = roster;
    mutating = true; busy = true; selected = null; outcomes = []; clearSecrets(); message = 'جارٍ إتمام العملية، يرجى الانتظار…'; draw();
    try {
      const result = await operation(oldRoster);
      if (!valid(g, k)) return;
      success(result, oldRoster); roster = null;
      const outcomeMessage=message,outcomeLines=outcomes;
      mutating=false;busy=false;queued=false;const refreshing=refresh(),refreshGeneration=generation;await refreshing;
      if(valid(refreshGeneration,k)&&roster){message=outcomeMessage;outcomes=outcomeLines;draw();}
    } catch {
      if (!valid(g, k)) return;
      clearSecrets(); queued = false; retry = true; message = 'نتيجة العملية غير مؤكدة؛ راجع القائمة قبل أي تغيير. الإعدادات المعروضة من آخر قراءة مؤكدة.';
    } finally { mutating = false; busy = !!readWork; if (!disposed) { if (key() !== boundKey) invalidate(); draw(); if (queued) { queued = false; scheduleRead(); } } }
  }
  const keydown = e => { if(e.key==='Escape'){const menu=e.target.closest('.n88-student-more[open]');if(menu){menu.open=false;menu.querySelector('summary').focus();e.preventDefault();}} };
  const click = e => {
    const button = e.target.closest('[data-action]'); if (!button || !root.contains(button) || disposed) return;
    if (key() !== boundKey) { invalidate(); void refresh(); return; }
    const action = button.dataset.action;
    if (busy) return;
    if (action === 'refresh') { void refresh(); return; }
    if(retry)return;
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
    e.preventDefault(); if (busy || retry || !roster) return;
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
    if (key() === boundKey) return;
    invalidate(); message = ''; draw();
    if (key()) scheduleRead();
  };
  // A focus/repaint notification is not a source revision. Revalidate the
  // binding immediately; only a retired/missing section needs an automatic read.
  const wake = () => { if (root.ownerDocument.visibilityState === 'visible') { const returning=suspended; suspended = false; changed(); if(!retry&&(returning||!roster))scheduleRead(); } };
  const pagehide = () => { suspended = true; clearTimeout(wakeTimer); invalidate(); busy = mutating || !!readWork; message = 'الرموز مخفية حتى مراجعة القائمة.'; draw(); };
  const win = root.ownerDocument.defaultView;
  root.addEventListener('keydown', keydown); root.addEventListener('click', click); root.addEventListener('submit', submit); root.addEventListener('change', change);
  win.addEventListener('pagehide', pagehide); win.addEventListener('pageshow', wake); win.addEventListener('focus', wake);
  root.ownerDocument.addEventListener('visibilitychange', wake);
  const unsubscribe = subscribe(changed); void refresh();
  return { contextChanged: changed, refresh, dispose() {
    guidance.dispose(); clearSecrets(); disposed = true; generation++; clearTimeout(expiryTimer); clearTimeout(wakeTimer);
    roster = null; selected = null; draft = null; unsubscribe?.();
    root.removeEventListener('keydown', keydown); root.removeEventListener('click', click); root.removeEventListener('submit', submit); root.removeEventListener('change', change);
    win.removeEventListener('pagehide', pagehide); win.removeEventListener('pageshow', wake); win.removeEventListener('focus', wake);
    root.ownerDocument.removeEventListener('visibilitychange', wake); root.replaceChildren();
  } };

}

// Integration must supply actual service binding and class context. This adapter stays unavailable by default.
let routeHandle,routeGeneration=0,routeRoot,routeTeaching;
export default { title: () => 'مساحة طلاب الفصل', back:p=>'#/teaching/'+encodeURIComponent(p.id),render: () => html`<div data-class-portal></div>`,
  topActions:()=>html`<a class="btn btn--ghost n88-student-gateway" href="/student" target="_blank" rel="noopener noreferrer" aria-label="بوابة دخول الطالب (تفتح في علامة تبويب جديدة)">بوابة دخول الطالب <span aria-hidden="true">↗</span></a>`,
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
