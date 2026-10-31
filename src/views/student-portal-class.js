import { html } from '../lib/dom.js';
/** AI: reusable existing-class section; no route, runtime import, publication or network at import time. */
import { classContextKey, PORTAL_FIELDS, classifyClassMutationError } from '../lib/student-portal-class-client.js';
import { mountTeacherPublications } from './student-portal-publications.js';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
export function buildStudentAccessMessage(student, url) {
 return `مرحبًا ${student.label}،\nرمز دخولك: ${student.credential}\n${url}\nافتح صفحة الطالب وأدخل الرمز لعرض مساحتك الدراسية.`;
}
// Both APIs are invoked synchronously by the gesture; results remain independent.
export function beginAccessDelivery(text, {copy, share=null}) {
 const invoke=fn=>{try{return Promise.resolve(fn());}catch(error){return Promise.reject(error);}};
 const copying=invoke(()=>copy(text));
 const sharing=share?invoke(()=>share({text})):null;
 return Promise.allSettled(sharing?[copying,sharing]:[copying]);
}
const rowIcon=kind=>`<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${kind==='rotate'?'<path d="M20 7v5h-5M19 12a7 7 0 1 0-2 5M20 7l-3-3"/>':'<circle cx="12" cy="12" r="8"/><path d="m6.5 6.5 11 11"/>'}</svg>`;
const SELECTABLE_FIELDS = Object.freeze(['grades','required','scheduled','completed']);
// AI: form-only defaults after an authoritative revision-zero read; never publish on read.
const INITIAL_POLICY_DRAFT = Object.freeze({name:true,class:true,grades:false,required:true,scheduled:true,completed:true});
const labels = { name:'اسم الطالب', class:'الفصل', grades:'الدرجات', required:'المهام المطلوبة', completed:'المهام المكتملة', scheduled:'المهام المجدولة' };
// Display-only ordering: credentials remain attached to their stable identities.
const rosterCollator = new Intl.Collator('ar', { numeric:true, sensitivity:'base' });
const displayRoster = students => students.slice().sort((a,b) => rosterCollator.compare(a.label,b.label) || (a.studentId < b.studentId ? -1 : a.studentId > b.studentId ? 1 : 0));
/** AI: per-source drafts stay fenced to the exact class/session/source snapshot. */
export function mountTaskGuidance(root,{client,getContext,subscribe}) {
 let disposed=false,busy=false,saving=false,sequence=0,bound=null,tasks=[],selected=null,message='',drafts=new Map(),opened=true,readError=false,uncertain=new Set(),suspended=false,queued=false,wakeTimer,operationSequence=0,loaded=false;
 const current=()=>{try{return classContextKey(getContext());}catch{return null;}};
 const reset=()=>{sequence++;bound=current();tasks=[];selected=null;drafts.clear();message='';readError=false;uncertain.clear();opened=true;loaded=false;};
 const state=()=>{const task=tasks.find(t=>t.subitemId===selected),draft=task&&(drafts.get(selected)||task);return {task,draft,stale:!!(draft&&task&&(draft.sourceStamp!==task.sourceStamp||draft.revision!==task.revision))};};
 const empty=d=>!d.executionInstructions.trim()&&!d.deliveryInstructions.trim();
 const unchanged=(t,d)=>t.executionInstructions===d.executionInstructions&&t.deliveryInstructions===d.deliveryInstructions;
 function updateControls(){
  const {task,draft,stale}=state(),form=root.querySelector('[data-guidance]');if(!task||!form)return;
  form.querySelector('[data-guidance-count]').textContent=`${draft.executionInstructions.length} / 400 · ${draft.deliveryInstructions.length} / 400`;
  form.querySelector('[type=submit]').disabled=suspended||busy||readError||uncertain.has(selected)||stale||!current()||(!task.needsRepublication&&unchanged(task,draft));
 }
 function draw(){
  if(disposed)return;
  if(bound!==current())reset();
  opened=root.querySelector('details')?.open??opened;
  const focus=root.contains(root.ownerDocument.activeElement)?root.ownerDocument.activeElement:null;
  const selection=focus?.tagName==='TEXTAREA'?[focus.selectionStart,focus.selectionEnd]:null;
  const focusKey=focus&&(focus.tagName==='SUMMARY'?'summary':focus.name||[...focus.attributes].find(a=>a.name.startsWith('data-guidance-'))?.name);
  const {task,draft,stale}=state();const authorContext=current()?getContext():null;const authorHelp=authorContext?`<p class="n88-editor-help">أضف المهمة في توزيع المادة، ثم اختر الحقول وأضف تعليماتها هنا.</p><a class="btn" data-guidance-author href="#/teaching/${encodeURIComponent(authorContext.teachingId)}/items">إعداد المهام في توزيع المادة</a>`:'';
  root.innerHTML=`<details class="n88-task-guidance" aria-busy="${busy}" ${opened?'open':''}><summary>تعليمات المهام وطريقة التسليم <small>${tasks.length||''}</small></summary><div class="n88-guidance-body">${authorHelp}<p role="status" aria-live="polite">${esc(!current()?'اختر فصلًا متاحًا لإدارة التعليمات.':busy?(saving?'جارٍ حفظ التعليمات…':'جارٍ قراءة المهام… يشمل الانتظار في الطابور، بحد أقصى 10 ثوانٍ.'):message)}</p>${readError?'<button class="btn" type="button" data-guidance-refresh>مراجعة الحالة</button>':''}${tasks.length?`<label>المهمة<select data-guidance-source ${busy?'disabled':''}>${tasks.map(t=>`<option value="${esc(t.subitemId)}" ${selected===t.subitemId?'selected':''}>${esc(t.title)}${t.needsRepublication?' — تحتاج إعادة نشر':''}</option>`).join('')}</select></label>`:current()&&loaded&&!busy&&!readError?`<p class="n88-editor-help">لا توجد مهام متاحة ضمن الحقول المنشورة.</p>`:''}${task?`<form data-guidance><fieldset ${saving||!current()?'disabled':''}>${!readError&&(stale||uncertain.has(selected))?'<p class="n88-editor-help">راجع حالة المهمة الحالية؛ مسودتك محفوظة.</p><button class="btn" type="button" data-guidance-revalidate>راجعت الحالة؛ احتفظ بالمسودة</button>':task.needsRepublication?'<p class="n88-editor-help">تغيّرت المهمة؛ راجع التعليمات ثم احفظ لنشرها مجددًا.</p>':''}<div class="n88-guidance-fields"><label>تعليمات التنفيذ<textarea name="executionInstructions" maxlength="400" rows="3" placeholder="اختياري — يمكنك الحفظ دون تعليمات">${esc(draft.executionInstructions)}</textarea></label><label>طريقة التسليم<textarea name="deliveryInstructions" maxlength="400" rows="3" placeholder="اختياري — يمكنك الحفظ دون تعليمات">${esc(draft.deliveryInstructions)}</textarea></label></div><div class="n88-editor-footer"><small data-guidance-count aria-label="عدد الأحرف لكل حقل"></small><button class="btn btn--primary" type="submit">حفظ التعليمات</button></div></fieldset></form>`:''}</div></details>`;
  updateControls();
  if(focusKey){const next=focusKey==='summary'?root.querySelector('summary'):[...root.querySelectorAll('button,select,textarea,input')].find(e=>e.name===focusKey||e.hasAttribute(focusKey));next?.focus({preventScroll:true});if(next&&selection)next.setSelectionRange(...selection);}
 }
 function scheduleRead(){if(disposed||suspended||!opened)return;if(busy){if(operationSequence!==sequence)queued=true;return;}clearTimeout(wakeTimer);wakeTimer=setTimeout(()=>void refresh(),40);}
 async function refresh(keepMessage=false){
  if(disposed||suspended)return;
  if(bound!==current())reset();
  if(busy){if(operationSequence!==sequence)queued=true;return;}
  clearTimeout(wakeTimer);const k=bound,g=++sequence;
  if(!k||!client?.listGuidance){tasks=[];draw();return;}
  busy=true;operationSequence=g;if(!keepMessage)message='';draw();
  try{const result=await client.listGuidance(getContext().teachingId);if(disposed||g!==sequence||k!==current())return;tasks=result.tasks;loaded=true;if(readError)message='';readError=false;if(!tasks.some(t=>t.subitemId===selected))selected=tasks[0]?.subitemId||null;
   const ids=new Set(tasks.map(t=>t.subitemId));for(const id of drafts.keys())if(!ids.has(id))drafts.delete(id);
  }
  catch{if(g===sequence&&k===current()){readError=true;message='تعذّرت قراءة الحالة. مسودتك محفوظة.';}}
  finally{busy=false;if(!disposed){if(k!==current())reset();draw();if(queued){queued=false;scheduleRead();}}}
 }
 const input=e=>{if(bound!==current()){reset();draw();return;}if(!e.target.closest('[data-guidance]'))return;const {task}=state();if(!task)return;const form=root.querySelector('form');drafts.set(selected,{...(drafts.get(selected)||task),executionInstructions:form.elements.executionInstructions.value,deliveryInstructions:form.elements.deliveryInstructions.value});updateControls();};
 const change=e=>{if(bound!==current()){reset();draw();return;}if(e.target.matches('[data-guidance-source]')){selected=e.target.value;message='';draw();}};
 const toggle=()=>{const details=root.querySelector('details');if(!details)return;opened=details.open;if(opened&&!loaded&&!busy&&!readError)scheduleRead();};
 const click=e=>{if(bound!==current()){reset();draw();return;}if(e.target.closest('[data-guidance-refresh]'))void refresh();if(e.target.closest('[data-guidance-revalidate]')&&!busy&&!readError){const {task,draft}=state();if(task&&draft){drafts.set(selected,{...draft,sourceStamp:task.sourceStamp,revision:task.revision});uncertain.delete(selected);message='';draw();}}};
 const submit=async e=>{
  if(!e.target.matches('[data-guidance]'))return;e.preventDefault();
  if(suspended||busy||bound!==current()){if(bound!==current())reset();draw();return;}
  const {task,draft:d,stale}=state();
  if(!task||stale||uncertain.has(selected)||readError||!current()||(!task.needsRepublication&&unchanged(task,d)))return;
  const guidance={subitemId:task.subitemId,sourceStamp:d.sourceStamp,revision:d.revision,executionInstructions:d.executionInstructions,deliveryInstructions:d.deliveryInstructions,confirmClear:empty(d)};
  const k=bound,g=++sequence;operationSequence=g;saving=true;busy=true;message='جارٍ حفظ التعليمات…';draw();
  try{await client.saveGuidance(getContext().teachingId,guidance);if(disposed||k!==current()||g!==sequence)return;drafts.delete(task.subitemId);message='حُفظت التعليمات وأُقرّ نشرها.';}
  catch{if(k===current()&&g===sequence){uncertain.add(task.subitemId);message='تعذّر تأكيد النشر. راجع الحالة قبل المحاولة.';}}
  finally{saving=false;busy=false;if(!disposed){if(k!==current())reset();queued=false;draw();await refresh(true);}}
 };
 const changed=()=>{if(bound===current())return;reset();draw();scheduleRead();};
 const win=root.ownerDocument.defaultView,hide=()=>{suspended=true;clearTimeout(wakeTimer);sequence++;queued=false;loaded=false;message='مسودتك محفوظة؛ ستُراجع الحالة عند العودة.';readError=true;draw();},wake=()=>{if(root.ownerDocument.visibilityState==='visible'){const returning=suspended;suspended=false;changed();if(returning||(!loaded&&!readError))scheduleRead();}};
 root.addEventListener('toggle',toggle,true);root.addEventListener('input',input);root.addEventListener('change',change);root.addEventListener('click',click);root.addEventListener('submit',submit);
 win.addEventListener('pagehide',hide);win.addEventListener('pageshow',wake);win.addEventListener('focus',wake);root.ownerDocument.addEventListener('visibilitychange',wake);
 const unsub=subscribe(changed);reset();draw();scheduleRead();
 return {refresh,contextChanged:changed,dispose(){disposed=true;sequence++;clearTimeout(wakeTimer);drafts.clear();unsub?.();win.removeEventListener('pagehide',hide);win.removeEventListener('pageshow',wake);win.removeEventListener('focus',wake);root.ownerDocument.removeEventListener('visibilitychange',wake);root.removeEventListener('toggle',toggle,true);root.removeEventListener('input',input);root.removeEventListener('change',change);root.removeEventListener('click',click);root.removeEventListener('submit',submit);root.replaceChildren();}};
}
export function mountClassPortal(root, { client, publicationClient = null, getContext = () => null, subscribe = () => () => {}, classLabel = () => 'الفصل الحالي', copy = text => navigator.clipboard.writeText(text), share = typeof navigator.share==='function' ? data=>navigator.share(data) : null, requestId = () => crypto.randomUUID() } = {}) {
  let deliveryIntent = null;
  let generation = 0, disposed = false, busy = false, roster = null, selected = null, outcomes = [], message = '', boundKey = null, expiryTimer, wakeTimer, readWork = null, mutating = false, queued = false, suspended = false, retry = false, draft = null, draftRevision = null, settingsOpen = true, rosterOpen = false, uncertainMutation = false;
  root.classList.add('n88-class'); root.dir = 'rtl';
  const panel=root.ownerDocument.createElement('div'),guidanceRoot=root.ownerDocument.createElement('div'),publicationRoot=root.ownerDocument.createElement('div'),accessRoot=root.ownerDocument.createElement('div');
  root.append(panel,publicationClient?publicationRoot:guidanceRoot,accessRoot);
  // One authoritative editor mode. Do not start legacy guidance reads in V2.
  const guidance=publicationClient?null:mountTaskGuidance(guidanceRoot,{client,getContext,subscribe});
  const publications=publicationClient?mountTeacherPublications(publicationRoot,{client:publicationClient,getContext,subscribe}):null;
  const context = () => { try { return getContext(); } catch { return null; } };
  const key = () => classContextKey(context());
  const valid = (g, k) => !disposed && g === generation && k !== null && k === key();
  const clearSecrets = () => { if(deliveryIntent)deliveryIntent.text='';deliveryIntent=null; if(roster)for(const s of roster.students)s.credential=null; root.querySelectorAll('[data-code],[data-manual]').forEach(el=>el.remove()); root.querySelector('[data-delivery]')?.remove(); };

  function draw() {
    if (disposed) return;
    const resolution=client?.resolutionState?.(context()?.teachingId);
    const ready = !!client && !!key(), writable = ready && !!roster && !busy && !retry;
    const focused = root.ownerDocument.activeElement;
    const focusAction = root.contains(focused) ? { action: focused.dataset.action, index: focused.dataset.index, name: focused.name, summary: focused.tagName==='SUMMARY'?focused.parentElement.className:null } : null;
    settingsOpen = panel.querySelector('.n88-class-settings')?.open ?? settingsOpen;
    root.setAttribute('aria-busy', String(busy));
    const formFields = draft ?? roster?.visibility;
    const unsaved = !!roster && (roster.policyRevision === 0 || !!draft && PORTAL_FIELDS.some(f => draft[f] !== roster.visibility[f]));
    const issueBlocked = !writable || uncertainMutation || !roster?.credentialRevision || !roster.students.some(s=>!s.hasActiveCode&&s.credentialVersion===0);
    const issueExplanation = uncertainMutation ? 'نتيجة عملية سابقة غير مؤكدة. نجاح قراءة القائمة لا يؤكد إنشاء الرموز؛ لا يمكن إعادة الإنشاء قبل إقرار مصير الطلب.' : roster && !roster.credentialRevision ? 'القائمة مقروءة، لكن مراجعة إصدار الرموز غير متاحة؛ إنشاء الرموز متوقف لحماية الطلبات السابقة.' : '';
    panel.innerHTML = `<section aria-label="ما يراه الطلاب"><header class="n88-class-heading"><div><p class="n88-eyebrow">مساحة الطلاب</p><h2>${esc(classLabel())}</h2></div></header><nav class="n88-class-nav" aria-label="إعداد مساحة الطلاب">${publicationClient?'<button class="btn" data-action="open-publications">نشر الأعمال والدرجات</button><button class="btn" data-action="open-codes">إدارة رموز الطلاب</button>':'<button class="btn" data-action="open-guidance">المهام المطلوبة وتعليماتها</button><button class="btn" data-action="open-settings">ما يراه الطلاب: الحقول والدرجات</button>'}</nav>
      <div class="n88-class-status"><p role="status" aria-live="polite">${esc([message || (!ready?'مساحة الطلاب غير مفعّلة حاليًا.':busy&&!roster?'جارٍ قراءة القائمة…':''),issueExplanation].filter(Boolean).join(' '))}</p>${ready ? `<button class="btn" data-action="refresh" ${busy?'disabled':''}>إعادة التحقق من الحالة الحالية</button>`:''}</div>
      ${roster && !publicationClient ? `<details class="n88-class-settings" ${settingsOpen ? 'open' : ''}><summary>الحقول الظاهرة للطلاب <small>${SELECTABLE_FIELDS.filter(f=>formFields[f]).length} من ${SELECTABLE_FIELDS.length} مختار${unsaved?' · غير محفوظ':''}</small></summary><form data-visibility><fieldset ${!writable ? 'disabled' : ''}><legend>اختر ما يراه الطلاب ثم احفظ</legend><div class="n88-class-fields">${SELECTABLE_FIELDS.map(f => `<label><input type="checkbox" name="${f}" ${formFields[f] ? 'checked' : ''}> ${labels[f]}</label>`).join('')}</div><button class="btn" type="submit">حفظ الحقول</button></fieldset></form></details>` : ''}</section>`;
    accessRoot.innerHTML = `<details class="n88-code-management" ${rosterOpen?'open':''}><summary>إدارة رموز الطلاب <small>${roster?esc(roster.students.length):''}</small></summary><div class="n88-code-body">
      <div class="n88-class-toolbar"><p class="n88-class-purpose">${roster ? 'الطلاب: '+esc(roster.students.length)+' · الرموز الفعّالة: '+esc(roster.students.filter(s=>s.hasActiveCode===true).length)+(busy||retry?' · آخر حالة مؤكدة':'') : 'لم تُؤكّد القائمة بعد'}</p>${ready?`<button class="btn btn--primary" data-action="batch" ${issueBlocked?'disabled':''}>إنشاء الرموز الناقصة${roster?` (${roster.students.filter(s=>!s.hasActiveCode&&s.credentialVersion===0).length})`:''}</button>`:''}</div>
      ${resolution?.eligible?`<button class="btn" data-action="close-unknown" ${busy?'disabled':''}>إغلاق الطلب السابق دون إنشاء رموز</button><p>يسجّل إغلاقًا جديدًا يمنع تنفيذ الطلب المتأخر؛ لا يثبت أن المحاولة السابقة تراجعت.</p>`:''}${resolution?.canRecover?`<button class="btn" data-action="recover-closure" ${busy?'disabled':''}>مراجعة إقرار الإغلاق مرة واحدة</button>`:''}
      ${roster && rosterOpen ? `<ul class="n88-class-roster" aria-label="طلاب ${esc(classLabel())}">${!roster.students.length?'<li class="n88-roster-empty">لا يوجد طلاب في هذا الفصل.</li>':''}${roster.students.map((s, index) => `<li><div class="n88-class-student"><strong><span class="n88-roster-number" aria-hidden="true">${index+1}</span>${esc(s.label)}</strong>${s.credential ? `<div data-code><input readonly autocomplete="off" dir="ltr" aria-label="رمز ${esc(s.label)}" value="${esc(s.credential)}"></div>` : `<span>${s.recoveryStatus==='legacy' ? 'رمز قديم غير مسترجع' : s.hasActiveCode ? 'الرمز مخفي؛ راجع القائمة لإظهاره' : 'بلا رمز فعّال'}</span>`}</div><div class="n88-class-actions">${s.credential ? `<button class="btn" data-action="copy-student" data-index="${index}" aria-label="نسخ رمز ${esc(s.label)}" title="نسخ رمز الدخول فقط" ${!writable ? 'disabled' : ''}>نسخ</button><button class="btn" data-action="share-student" data-index="${index}" aria-label="مشاركة رسالة ${esc(s.label)}" ${!writable ? 'disabled' : ''}>مشاركة</button>` : ''}<button class="btn n88-icon-button" data-action="review-rotate" data-index="${index}" aria-label="تغيير رمز ${esc(s.label)}" title="تغيير رمز ${esc(s.label)}" ${!writable || s.credentialVersion < 1 ? 'disabled' : ''}>${rowIcon('rotate')}</button><button class="btn n88-icon-button" data-action="review-revoke" data-index="${index}" aria-label="إلغاء وصول ${esc(s.label)}" title="إلغاء وصول ${esc(s.label)}" ${!writable || !s.hasActiveCode ? 'disabled' : ''}>${rowIcon('revoke')}</button></div></li>`).join('')}</ul>` : ''}
      ${selected && writable ? `<section class="card" data-confirm aria-label="تأكيد العملية"><h3>${esc(selected.student.label)}</h3><p>${selected.action === 'rotate' ? 'تغيير الرمز يُبطل الرمز السابق وجميع جلساته. سلّم البديل لهذا الطالب وحده بعد التحقق من هويته.' : 'إلغاء الوصول يُبطل الرمز الحالي وجميع جلساته، ولن يستطيع الطالب الدخول به.'}</p><div class="n88-class-actions"><button class="btn" data-action="confirm">${selected.action === 'rotate' ? 'تأكيد تغيير الرمز' : 'تأكيد إلغاء الوصول'}</button><button class="btn" data-action="cancel">تراجع</button></div></section>` : ''}
      ${outcomes.length ? `<ul data-outcomes>${outcomes.map(line => `<li>${esc(line)}</li>`).join('')}</ul>` : ''}</div></details>`;
    if(focusAction?.summary)root.querySelector(`.${focusAction.summary}>summary`)?.focus({preventScroll:true});
    if (focusAction) [...root.querySelectorAll('button,input')].find(el => focusAction.action ? el.dataset.action === focusAction.action && el.dataset.index === focusAction.index : focusAction.name && el.name === focusAction.name)?.focus({preventScroll:true});
  }

  // AI: invalidate synchronously, coalesce only reads; never queue a mutation.
  function invalidate(nextKey = key()) {
    guidance?.contextChanged(); generation++; clearSecrets(); rosterOpen = false; roster = null; selected = null; outcomes = []; retry = false;
    if (nextKey !== boundKey) { draft = null; draftRevision = null; settingsOpen = true; uncertainMutation = false; }
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
    busy = true; retry = false; selected = null; outcomes = []; message = ''; clearSecrets(); draw();
    clearTimeout(expiryTimer);
    if (k) expiryTimer = setTimeout(() => { changed(); if (key()) scheduleRead(); }, Math.min(2147483647, Math.max(1, context().validUntil - Date.now())));
    if (!client || !k) { busy = false; draw(); return Promise.resolve(); }
    const work = { key:k, generation:g };
    readWork = work;
    work.promise = (async () => {
      try {
        const result = await client.listClass(context().teachingId);
        if (valid(g, k)) {
          roster = {...result,students:displayRoster(result.students)};
          if(result.reconciliation?.some(x=>x.state==='unknown'))uncertainMutation=true;
          else if(result.reconciliation?.length&&result.reconciliation.every(x=>x.state==='committed'))uncertainMutation=false;
          if (draft && draftRevision !== result.policyRevision) { draft = null; draftRevision = null; message = 'تغيّرت إعدادات الحقول؛ راجع اختيارك من جديد.'; }
          else message = result.reconciliation?.some(x=>x.state==='unknown') ? '' : result.reconciliation?.some(x=>x.state==='committed') ? 'تأكد إقرار العملية السابقة من السجل؛ عُرضت الحالة الحالية دون إعادة إنشائها.' : '';
          if (!draft && result.policyRevision === 0) { draft = {...INITIAL_POLICY_DRAFT}; draftRevision = 0; }
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
    } catch (error) {
      if (!valid(g, k)) return;
      clearSecrets(); queued = false; retry = true;
      if (classifyClassMutationError(error)?.state === 'not_started') {
        // This invocation did not start; any earlier unknown still needs its own ACK.
        message = 'لم تبدأ العملية. راجع الحالة الحالية قبل المحاولة.';
      } else {
        uncertainMutation = true;
        message = 'نتيجة العملية غير مؤكدة؛ راجع القائمة قبل أي تغيير. الإعدادات المعروضة من آخر قراءة مؤكدة.';
      }
    } finally { mutating = false; busy = !!readWork; if (!disposed) { if (key() !== boundKey) invalidate(); draw(); if (queued) { queued = false; scheduleRead(); } } }
  }
  const toggleRoster = e => { if(!e.target.matches('.n88-code-management')||e.target.open===rosterOpen)return; if(key()!==boundKey){invalidate();draw();return;} rosterOpen=e.target.open; if(rosterOpen)void refresh();else{clearSecrets();selected=null;draw();} };
  const keydown = e => { if(e.key==='Escape'){const menu=e.target.closest('.n88-student-more[open]');if(menu){menu.open=false;menu.querySelector('summary').focus();e.preventDefault();}} };
  const click = e => {
    const button = e.target.closest('[data-action]'); if (!button || !root.contains(button) || disposed) return;
    if (key() !== boundKey) { invalidate(); void refresh(); return; }
    const action = button.dataset.action;
    if (publicationClient && action === 'open-publications') {
      const target=publicationRoot.querySelector('[data-publication-source]');
      target?.focus();target?.scrollIntoView({block:'nearest'});return;
    }
    if (publicationClient && action === 'open-codes') {
      const details=accessRoot.querySelector('.n88-code-management');
      if(details){details.open=true;details.querySelector('summary')?.focus();}return;
    }
    if (action === 'open-guidance' || action === 'open-settings') {
      if(publicationClient)return;
      const details = root.querySelector(action === 'open-guidance' ? '.n88-task-guidance' : '.n88-class-settings');
      if (details) { details.open = true; details.querySelector('summary')?.focus(); }
      return;
    }
    if (busy) return;
    if(action==='close-unknown'||action==='recover-closure'){
      const g=++generation,k=key();busy=true;mutating=true;clearSecrets();message='جارٍ التحقق من إقرار الإغلاق…';draw();
      Promise.resolve().then(()=>action==='close-unknown'?client.closeUnknown(context().teachingId):client.recoverClosure(context().teachingId)).then(result=>{
        if(!valid(g,k))return;
        uncertainMutation=result.state==='unknown';retry=result.state==='unknown';
        message=result.state==='closed'?'أُقرّ إغلاق الطلب السابق دون إنشاء رموز. لن ينفّذ لاحقًا؛ لم تُعد المحاولة السابقة.':result.state==='committed'?'العملية السابقة ملتزمة بالفعل؛ لم تُنشأ رموز جديدة. راجع الرموز الحالية لاستعادتها.':'إقرار الإغلاق غير مؤكد؛ لا تُعد الإغلاق أو الإنشاء.';
      }).catch(()=>{if(valid(g,k)){uncertainMutation=true;retry=true;message='إقرار الإغلاق غير مؤكد؛ لا تُعد الإغلاق أو الإنشاء.';}}).finally(()=>{busy=false;mutating=false;if(!disposed){if(key()!==boundKey)invalidate();draw();}});return;
    }
    if (action === 'refresh') { void refresh(); return; }
    if(retry)return;
    if (!roster) return;
    if(action==='copy-student'||action==='share-student') {
      const student=roster.students[Number(button.dataset.index)];if(!/^1[0-9]{5}$/.test(student?.credential||''))return;
      if(deliveryIntent)deliveryIntent.text='';root.querySelectorAll('[data-manual]').forEach(el=>el.remove());
      const intent={text:action==='copy-student'?student.credential:buildStudentAccessMessage(student,new URL('/student',root.ownerDocument.defaultView.location.origin).href)};
      deliveryIntent=intent;const g=generation,k=key();
      // Invoke both capabilities in this click stack, before any await/microtask.
      const sharing=action==='share-student'&&share;
      beginAccessDelivery(intent.text,{copy,share:sharing||null}).then(results=>{
        if(!valid(g,k)||deliveryIntent!==intent)return;
        const copied=results[0].status==='fulfilled',shared=sharing&&results[1].status==='fulfilled';
        message=action==='copy-student'?(copied?'نُسخ رمز الدخول فقط.':'تعذّر النسخ التلقائي؛ انسخ الرمز يدويًا.')
          :shared?(copied?'نُسخت الرسالة واكتملت نافذة المشاركة؛ تحقّق من التسليم.':'اكتملت نافذة المشاركة، لكن لم تُنسخ الرسالة؛ تحقّق من التسليم.')
          :copied?'نُسخت الرسالة. يمكنك لصقها لإرسالها؛ لم يُؤكّد أي تسليم.':'لم يُؤكّد النسخ أو التسليم. يمكنك نسخ الرسالة يدويًا.';
        draw();
        if(!copied){const area=root.ownerDocument.createElement('textarea');area.dataset.manual='';area.readOnly=true;area.dir=action==='copy-student'?'ltr':'rtl';area.setAttribute('aria-label',action==='copy-student'?'رمز الدخول للنسخ اليدوي':'رسالة الطالب للنسخ اليدوي');area.value=intent.text;root.append(area);area.focus();area.select();}
        intent.text='';deliveryIntent=null;
      });return;
    }
    if (action === 'cancel') { const index = roster.students.indexOf(selected?.student), action = selected?.action; selected = null; void refresh().then(() => root.querySelector(`[data-action=review-${action}][data-index="${index}"]`)?.focus()); return; }
    if (action.startsWith('review-')) { const student = roster.students[Number(button.dataset.index)]; if (student && (student.hasActiveCode || action === 'review-rotate' && student.credentialVersion > 0)) { clearSecrets(); selected = { student, action: action.slice(7) }; draw(); root.querySelector('[data-confirm] button')?.focus(); } return; }
    if (action === 'batch' && !uncertainMutation && roster.credentialRevision && !button.disabled) void perform(r => client.issueMissingClassCodes(context().teachingId, { requestId: requestId(), expectedRosterRevision: r.rosterRevision }), (result, r) => {

      uncertainMutation = result.uncertain === true;
      if(!result.uncertain && result.created.length)rosterOpen=true;
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
    e.preventDefault(); if (publicationClient || busy || retry || !roster) return;
    if (key() !== boundKey) { invalidate(); void refresh(); return; }
    const fields = Object.fromEntries(PORTAL_FIELDS.map(f => [f, f==='name'||f==='class'?true:e.target.elements.namedItem(f).checked]));
    void perform(r => client.saveVisibility(context().teachingId, { policyRevision: r.policyRevision, fields }), () => { draft = null; draftRevision = null; message = 'حُفظت الحقول المختارة.'; });
  };
  const change = e => {
    if (publicationClient || !e.target.closest('[data-visibility]') || !roster) return;
    draft = Object.fromEntries(PORTAL_FIELDS.map(f => [f, f==='name'||f==='class'?true:root.querySelector(`[name="${f}"]`).checked]));
    draftRevision = roster.policyRevision;
    draw();
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
  const visibility = () => root.ownerDocument.visibilityState==='hidden'?pagehide():wake();
  const win = root.ownerDocument.defaultView;
  root.addEventListener('toggle', toggleRoster, true); root.addEventListener('keydown', keydown); root.addEventListener('click', click); root.addEventListener('submit', submit); root.addEventListener('change', change);
  win.addEventListener('pagehide', pagehide); win.addEventListener('pageshow', wake); win.addEventListener('focus', wake);
  root.ownerDocument.addEventListener('visibilitychange', visibility);
  const unsubscribe = subscribe(changed); void refresh();
  return { contextChanged: changed, refresh, dispose() {
    guidance?.dispose(); publications?.dispose(); clearSecrets(); disposed = true; generation++; clearTimeout(expiryTimer); clearTimeout(wakeTimer);
    roster = null; selected = null; draft = null; unsubscribe?.();
    root.removeEventListener('toggle', toggleRoster, true); root.removeEventListener('keydown', keydown); root.removeEventListener('click', click); root.removeEventListener('submit', submit); root.removeEventListener('change', change);
    win.removeEventListener('pagehide', pagehide); win.removeEventListener('pageshow', wake); win.removeEventListener('focus', wake);
    root.ownerDocument.removeEventListener('visibilitychange', visibility); root.replaceChildren();
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
