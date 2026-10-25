/** AI: reusable actual student page, deliberately unregistered in the teacher app. */
import { brandLockup } from '../lib/brand.js';
import { normalizeStudentCode, validStudentCode, projectUnifiedStudentData, parseStudentReadPhases, parseStudentFailure } from '../lib/student-portal-unified-client.js';
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const displayNumber = value => value === null ? 'لم تُرصد' : escape(value);
// A display freshness bound, never a session lifetime or an authorization token.
export const STUDENT_VIEW_FRESHNESS_MS = 5 * 60 * 1000;

export function mountUnifiedStudentPortal(root, { client, readiness = { enabled: false } } = {}) {
  const doc = root.ownerDocument, win = doc.defaultView;
  let disposed = false, generation = 0, busy = false, timer, cooldownUntil = 0, codeDraft = '',pendingCompletion=null,pendingForm=false,pendingMessage='';
  let returnRead = null, endingSession = false, retiredPage = false, screen = 'pending';
  let freshnessTimer, settledAt = 0, settledTick = 0, settledContext, settledProjection = null, clearing = false,viewDiagnostic=null;
  const previousDir = root.getAttribute('dir');
  root.classList.add('n88-unified'); root.dir = 'rtl';
  const style = doc.createElement('link'); style.rel = 'stylesheet';
  style.href = new URL('../styles/student-portal-login.css', import.meta.url).href; doc.head.append(style);
  const enabled = readiness?.enabled === true && !!client;
  const paint = (content, focus = true) => {
    if (disposed) return;
    root.innerHTML = `<header>${brandLockup({ compact: true })}</header><main>${content}<details class="n88-student-support"><summary>تفاصيل الدعم الاختيارية</summary><p>يمكنك نسخ نتيجة طلب واحد دون بيانات الطالب. لا تُرسل تلقائيًا.</p><button type="button" data-copy-diagnostic>نسخ تفاصيل التحقق</button><p role="status" data-copy-status></p><textarea readonly hidden dir="ltr" aria-label="تفاصيل التحقق للنسخ اليدوي" data-copy-text></textarea></details></main>`;
    const support=root.querySelector('.n88-student-support');
    const result=doc.createElement('pre');result.dir='ltr';result.className='n88-guidance-text';result.setAttribute('data-support-diagnostic','');
    result.textContent=diagnosticText()||'لا تتوفر نتيجة مكتملة بعد.';support.insertBefore(result,support.querySelector('[data-copy-diagnostic]'));
    if(focus)root.querySelector('h1')?.focus();
  };
  function entry(message = '') {
    screen = 'entry';
    const cooling = Date.now() < cooldownUntil;
    paint(`<section class="n88-unified-entry first-run-auth"><h1 tabindex="-1">مساحة الطالب</h1><p class="n88-unified-welcome">أدخل رمز الدخول الذي زوّدك به معلّمك.</p><form data-claim novalidate><label class="field__label" for="n88-unified-code">رمز الدخول</label><p id="n88-code-help">6 أرقام تبدأ بـ1</p><input id="n88-unified-code" class="input first-run-auth__otp" type="text" inputmode="numeric" minlength="6" pattern="1[0-9]{5}" dir="ltr" autocomplete="off" autocapitalize="off" spellcheck="false" aria-describedby="n88-code-help n88-message" required ${!enabled || cooling ? 'disabled' : ''}><p id="n88-message" role="status">${escape(!enabled ? 'مساحة الطالب غير متاحة حاليًا. لم تُفعّل الخدمة بعد.' : cooling ? 'يرجى الانتظار قليلًا قبل المحاولة مجددًا.' : message)}</p><button class="btn btn--primary" type="submit" ${!enabled || cooling ? 'disabled' : ''}>دخول الطالب</button></form>${enabled ? '<button type="button" class="btn btn--ghost n88-unified-resume" data-resume>متابعة جلسة سابقة</button>' : ''}</section>`);
    const field=root.querySelector('[data-claim] input');if(field)field.value=codeDraft;
    clearTimeout(timer);
    if (cooling) timer = setTimeout(() => entry('يمكنك المحاولة مجددًا.'), Math.max(1, cooldownUntil - Date.now()));
  }
  function recovery(message, end = false) {
    screen = end ? 'end-uncertain' : 'recovery';
    clearTimeout(timer);const cooling=Date.now()<cooldownUntil;
    paint(`<section class="n88-unified-entry"><h1 tabindex="-1">${end ? 'التحقق من الجلسة' : 'مساحة الطالب'}</h1><p role="status" aria-live="polite">${escape(message)}${cooling?' يرجى الانتظار قليلًا قبل المحاولة مجددًا.':''}</p><button class="btn btn--primary" data-session-retry ${cooling?'disabled':''}>${end ? 'التحقق مجددًا' : 'حاول مجددًا'}</button></section>`);
    if(cooling)timer=setTimeout(()=>recovery(message,end),Math.max(1,cooldownUntil-Date.now()));
  }
  function publicationReview() {
    screen='publication';clearTimeout(freshnessTimer);settledProjection=null;settledAt=0;settledContext=undefined;
    paint('<section class="n88-unified-entry" data-publication-review><h1 tabindex="-1">مساحة الطالب</h1><p role="status">يلزم أن يراجع معلّمك النشر الحالي قبل عرض بياناتك. جلستك ما زالت متاحة.</p><button type="button" data-read>التحقق من النشر</button><button type="button" data-end>إنهاء الجلسة</button></section>');
  }
  function show(raw, preserve = false) {
    const data = projectUnifiedStudentData(raw);
    const open=preserve ? [...root.querySelectorAll('details[data-work-id][open]')].map(el=>el.getAttribute('data-work-id')) : [];
    const scroll=preserve ? {x:win.scrollX,y:win.scrollY} : null;
    const focus=preserve && root.contains(doc.activeElement) ? ['data-read','data-end'].find(key=>doc.activeElement.hasAttribute(key)) : null;
    settledProjection = JSON.stringify(data); settledAt = Date.now(); settledTick = win.performance.now(); settledContext = client.captureContext?.();
    screen = 'private';
    const profile = data.profile;
    let content = `<div class="n88-unified-profile"><div><h1 tabindex="-1">مساحتي الدراسية</h1>${profile?.name !== undefined ? `<p class="n88-unified-name">${escape(profile.name)}</p>` : ''}${profile?.classLabel !== undefined ? `<p class="n88-unified-class">${escape(profile.classLabel)}</p>` : ''}</div><div class="n88-unified-actions"><button data-read>تحديث</button><button data-end>إنهاء الجلسة</button></div></div><div class="n88-unified-sections">`;
    if (data.grades) {
      content += `<section class="n88-unified-grades"><h2>درجاتي</h2><div class="n88-unified-table"><table><thead><tr><th scope="col">البند</th><th scope="col">الدرجة</th><th scope="col">من</th></tr></thead><tbody>${data.grades.items.map(item => `<tr><th scope="row">${escape(item.label)}${item.status !== undefined ? `<small>${escape({recorded:'مرصودة',unrecorded:'لم تُرصد'}[item.status]||'')}</small>` : ''}</th><td>${displayNumber(item.value)}</td><td>${displayNumber(item.max)}</td></tr>`).join('')}</tbody></table></div>${data.grades.total ? `<p class="n88-unified-total">المجموع: <b dir="ltr">${displayNumber(data.grades.total.earned)} / ${displayNumber(data.grades.total.possible)}</b></p>` : ''}</section>`;
    }
    for (const [key, label] of Object.entries({ required: 'المطلوب مني', completed: 'الأعمال المكتملة', scheduled: 'الأعمال القادمة' })) {
      if (!Object.hasOwn(data.work || {}, key)) continue;
      content += `<section data-section="${key}"><h2>${label}<span class="n88-unified-count" aria-label="عدد الأعمال">${data.work[key].length}</span></h2>${data.work[key].length ? data.work[key].map(item => {
        const detail = `${item.executionInstructions !== undefined ? `<h3>تعليمات التنفيذ</h3><p class="n88-guidance-text">${escape(item.executionInstructions)}</p>` : ''}${item.deliveryInstructions !== undefined ? `<h3>طريقة التسليم</h3><p class="n88-guidance-text">${escape(item.deliveryInstructions)}</p>` : ''}${item.instruction !== undefined ? `<p class="n88-unified-instruction">${escape(item.instruction)}</p>` : ''}${item.startDate ? `<p>يبدأ: <span dir="ltr">${escape(item.startDate)}</span></p>` : ''}${item.dueDate ? `<p>التسليم: <span dir="ltr">${escape(item.dueDate)}</span></p>` : ''}${item.completionState !== undefined ? `<p>${escape({unrecorded:'لم يُرصد إنجاز',regular:'مكتمل',late:'مكتمل متأخر'}[item.completionState])}</p>` : ''}${item.deadline !== undefined ? `<p>الموعد: <span dir="ltr">${escape(item.deadline)}</span></p>` : ''}${item.status !== undefined ? `<p>${escape(item.status)}</p>` : ''}`;
        return detail ? `<details class="n88-unified-work" data-work-id="${escape(key+':'+item.id)}"><summary><span>${escape(item.title)}</span><span class="n88-unified-detail-hint">التفاصيل</span></summary><div class="n88-unified-detail">${detail}</div></details>` : `<article class="n88-unified-work"><h3>${escape(item.title)}</h3></article>`;
      }).join('') : '<p class="n88-unified-empty">لا توجد أعمال منشورة في هذا القسم.</p>'}</section>`;
    }
    paint(content + '</div><p role="status" data-refresh-status>يُحدّث العرض تلقائيًا كل خمس دقائق أثناء فتحه. يمكنك تحديثه الآن.</p>',!preserve);
    if(preserve){for(const el of root.querySelectorAll('details[data-work-id]'))el.open=open.includes(el.getAttribute('data-work-id'));if(focus)root.querySelector('['+focus+']')?.focus({preventScroll:true});win.scrollTo(scroll.x,scroll.y);}
    scheduleFreshness();
  }
  const displayAge = () => Math.max(Date.now()-settledAt,win.performance.now()-settledTick);
  function scheduleFreshness() {
    clearTimeout(freshnessTimer);
    if(disposed || screen !== 'private')return;
    freshnessTimer=setTimeout(() => {
      if(doc.visibilityState==='hidden'){clear(false,'hidden');retiredPage=true;return;}
      void refresh('return');
    },Math.max(1,STUDENT_VIEW_FRESHNESS_MS-(displayAge())));
  }
  function currentView() {
    if(client.isContextCurrent && !client.isContextCurrent(settledContext)){clear();return false;}
    return screen==='private';
  }
  async function refresh(phase='manual') {
    if(disposed || busy || doc.visibilityState==='hidden')return;
    if(screen!=='private')return run(()=>client.read({phase}),false,false,true);
    if(!currentView())return;
    return run(()=>client.read({phase}),false,false,true,true);
  }
  function pending(ending = false) {
    screen = ending ? 'end-pending' : 'pending';
    paint(ending
      ? '<section class="n88-unified-entry" aria-busy="true"><h1 tabindex="-1">جارٍ إنهاء الجلسة…</h1><p role="status" aria-live="polite">أُخفيت بياناتك من هذه الصفحة. ننتظر تأكيد الخادم لمدة لا تتجاوز 15 ثانية.</p></section>'
      : '<section class="n88-unified-entry n88-unified-pending"><h1 tabindex="-1">مساحة الطالب</h1><p role="status" aria-live="polite">لحظات ونجهّز مساحتك…</p><div class="n88-unified-progress" role="progressbar" aria-label="جارٍ تجهيز مساحة الطالب" aria-busy="true"></div></section>');
  }
  function endUncertain() {
    recovery('تعذّر تأكيد إنهاء الجلسة لدى الخادم. بياناتك مخفية هنا. تحقّق من الجلسة مجددًا قبل أي محاولة إنهاء أخرى.',true);
  }
  // Reconstruct only finite fields, even if a supplied client returns extra data.
  function diagnosticText() {
    let d;try{d=client?.getDiagnostic?.();}catch{}d=d||viewDiagnostic;
    if (!d || !['read','end'].includes(d.action) || !['initial','return','manual','end'].includes(d.phase)
      || !['success','denied','rate','unavailable','timeout','stale','publication'].includes(d.outcome)
      || !['none','2xx','4xx','5xx','other'].includes(d.httpStatusClass)
      || !['visible','hidden'].includes(d.visibility)
      || !['visible','hidden','pagehide','disposed','context','superseded','deadline'].includes(d.retirementReason)
      || !Number.isFinite(d.elapsedMs)) return null;
    const readPhases=d.action==='read'&&d.outcome==='success'&&d.httpStatusClass==='2xx'?parseStudentReadPhases(JSON.stringify(d.readPhases)):null;
    return JSON.stringify({action:d.action,phase:d.phase,outcome:d.outcome,httpStatusClass:d.httpStatusClass,
      elapsedMs:Math.min(15000,Math.max(0,Math.floor(d.elapsedMs/250)*250)),visibility:d.visibility,retirementReason:d.retirementReason,
      clientStage:['call','request','response','transport','decode','projection','adopt','unknown'].includes(d.clientStage)?d.clientStage:'unknown',
      responseKind:['json','html','other','none'].includes(d.responseKind)?d.responseKind:'none',
      ...(d.httpStatusClass==='5xx'&&Number.isInteger(d.http5xx)&&d.http5xx>=500&&d.http5xx<=599?{http5xx:d.http5xx}:{}),
      ...(d.action==='read'&&d.httpStatusClass==='5xx'&&['configuration','upstream','upstream-body','upstream-http-5xx','reply','reply-shape'].includes(d.transportStage)?{transportStage:d.transportStage}:{}),
      ...(d.action==='read'&&d.httpStatusClass==='5xx'&&['acquire','begin','snapshot','repository','teacher','source','synchronize','synchronize-lock','synchronize-memberships','synchronize-sessions','synchronize-sources','synchronize-publications','synchronize-validate','projection','projection-finalize','projection-membership-flush','projection-commitguards','projection-commit'].includes(d.serviceStage)?{serviceStage:d.serviceStage}:{}),
      ...(d.action==='read'&&d.httpStatusClass==='5xx'&&parseStudentFailure(JSON.stringify(d.readFailure))?{readFailure:parseStudentFailure(JSON.stringify(d.readFailure))}:{}),
      ...(readPhases?{readPhases}:{})});
  }
  async function copyDiagnostic(button) {
    const text = diagnosticText(), checkpoint = generation;
    const status = root.querySelector('[data-copy-status]'), fallback = root.querySelector('[data-copy-text]');
    const current = () => !disposed && doc.visibilityState !== 'hidden' && checkpoint === generation && root.contains(button) && diagnosticText() === text;
    if (!current()) return;
    fallback.hidden=true;fallback.value='';status.textContent='';
    if (!text) {status.textContent='لا تتوفر نتيجة مكتملة للنسخ بعد.';return;}
    button.disabled=true;
    try {await win.navigator.clipboard.writeText(text);if(current())status.textContent='تم نسخ تفاصيل التحقق.';}
    catch {if(current()){fallback.hidden=false;fallback.value=text;status.textContent='تعذّر النسخ التلقائي. يمكنك نسخ النص يدويًا.';}}
    finally {if(!disposed && root.contains(button))button.disabled=false;}
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
  async function run(action, ending = false, sameForm = false, resuming = false, quiet = false) {
    if (disposed || busy || !enabled || doc.visibilityState === 'hidden' || Date.now() < cooldownUntil) return;
    const beforeContext=generation,context=client.captureContext?.();
    if(beforeContext!==generation)return; // A newly discovered peer change rejects this stale UI command.
    returnRead = null;
    endingSession = ending;
    busy = true; const checkpoint = ++generation;viewDiagnostic=null;const attemptStarted=win.performance.now();let attemptStage='call';
    pendingForm=sameForm;pendingMessage=resuming?'جارٍ التحقق من الجلسة…':'جارٍ التحقق من الرمز…';
    clearTimeout(freshnessTimer);
    if(!quiet){settledProjection=null;settledAt=0;settledContext=undefined;}
    if(quiet){root.querySelector('[data-refresh-status]').textContent='جارٍ تحديث العرض…';root.querySelector('[data-read]').disabled=true;root.querySelector('[data-end]').disabled=true;}
    else if(sameForm)inlineEntry(pendingMessage);
    else pending(ending);
    try {
      // A transport that ignores AbortSignal still cannot leave this view pending.
      let deadline;const deadlineMs=sameForm&&!resuming?31000:15000; // claim + authoritative read each retain their existing 15s budget.
      const data = await Promise.race([Promise.resolve(action()), new Promise((_, reject) => { deadline = setTimeout(() => reject({kind:'timeout',viewDeadline:true}), deadlineMs); })]).finally(() => clearTimeout(deadline));
      if (disposed || checkpoint !== generation) return;
      if(client.isContextCurrent&&!client.isContextCurrent(context)){clear();return;}
      codeDraft='';
      if(doc.visibilityState==='hidden'){const field=root.querySelector('[data-claim] input');if(field)field.value='';}
      pendingCompletion={checkpoint,context,data,ending,sameForm,resuming,quiet,completedAt:Date.now()};
      attemptStage='adopt';adoptCompletion();
    } catch (error) {
      if (disposed || checkpoint !== generation) return;
      if (error?.kind === 'rate') cooldownUntil = Date.now() + Math.min(300, Math.max(1, error.retryAfter || 30)) * 1000;
      if(client.isContextCurrent&&!client.isContextCurrent(context)){clear();return;}
      viewDiagnostic=Object.freeze({action:ending?'end':'read',phase:ending?'end':resuming?'initial':'manual',outcome:'unavailable',httpStatusClass:'none',elapsedMs:Math.min(15000,Math.max(0,Math.floor((win.performance.now()-attemptStarted)/250)*250)),visibility:doc.visibilityState==='hidden'?'hidden':'visible',retirementReason:'visible',clientStage:attemptStage,responseKind:'none'});
      if(error?.viewDeadline){clear(false,'deadline');if(ending)endUncertain();return;}
      pendingCompletion={checkpoint,context,errorKind:error?.kind||'unavailable',claimState:error?.claimState,ending,sameForm,resuming,quiet};
      adoptCompletion();
    } finally { if (checkpoint === generation&&!pendingCompletion) {busy = false;pendingForm=false;if(sameForm&&root.querySelector('[data-claim]')){const m=root.querySelector('#n88-message').textContent;inlineEntry(m,root.querySelector('input').getAttribute('aria-invalid')==='true');}} }
  }
  function adoptCompletion(){
    const result=pendingCompletion;if(!result||disposed||doc.visibilityState==='hidden')return;
    pendingCompletion=null;
    if(result.checkpoint!==generation)return;
    if(client.isContextCurrent&&!client.isContextCurrent(result.context)){clear();return;}
    if(result.completedAt && Date.now()-result.completedAt>=STUDENT_VIEW_FRESHNESS_MS){clear();return;}
    busy=false;pendingForm=false;endingSession=false;
    if(result.errorKind){
      settledProjection=null;settledAt=0;settledContext=undefined;
      if(result.errorKind==='publication'&&!result.ending){publicationReview();return;}
      // A denied or failed revalidation never leaves a private projection visible.
      if(result.quiet){clear(false,result.errorKind==='timeout'?'deadline':'context');return;}
      const rejected = !result.resuming && result.claimState === 'rejected' && result.errorKind === 'session';
      const message = rejected ? 'تعذّر الدخول بهذا الرمز. تحقق منه أو راجع معلّمك.'
        : result.errorKind === 'session' ? 'الجلسة غير متاحة أو انتهت. أدخل رمزك أو راجع معلمك.'
        : result.claimState === 'accepted' ? 'قُبل الرمز، لكن تعذّر عرض المساحة. اضغط التحقق مجددًا لإعادة قراءة الجلسة.'
        : result.claimState === 'uncertain' ? 'تعذّر تأكيد الدخول. اضغط التحقق مجددًا قبل إدخال الرمز مجددًا.'
        : 'تعذّر الاتصال بالمساحة. يمكنك متابعة جلسة سابقة للمحاولة مجددًا.';
      if(result.ending) endUncertain();
      else if((result.resuming || !result.sameForm) && result.errorKind !== 'session') recovery('تعذّر فتح مساحتك الآن. حاول مجددًا.');
      else if(['accepted','uncertain'].includes(result.claimState) && result.errorKind !== 'session') recovery(message);
      else if(result.sameForm && root.querySelector('[data-claim]'))inlineEntry(message,rejected);
      else if(result.sameForm && result.claimState !== 'rejected' && result.errorKind !== 'session') recovery(message);
      else entry(message);
    }else{codeDraft='';if(result.ending){entry('انتهت الجلسة.');screen='end-ack';}
      else if(result.quiet && screen==='private' && JSON.stringify(projectUnifiedStudentData(result.data))===settledProjection){
        settledAt=Date.now();settledTick=win.performance.now();settledContext=result.context;root.querySelector('[data-read]').disabled=false;root.querySelector('[data-end]').disabled=false;
        root.querySelector('[data-refresh-status]').textContent='تم تحديث العرض. يُعاد التحقق خلال خمس دقائق.';scheduleFreshness();
      }else show(result.data,result.quiet);}
  }
  const submit = event => {
    if (!event.target.matches('[data-claim]')) return;
    event.preventDefault(); if (busy || !enabled) return;
    const input = root.querySelector('input'); let code = codeDraft = normalizeStudentCode(input.value);
    if (!validStudentCode(code)) { code = ''; inlineEntry('أدخل 6 أرقام تبدأ بالرقم 1.',true); return; }
    void run(() => { const pending = client.claim(code); code = ''; codeDraft = ''; input.value = ''; return pending; },false,true);
  };
  const input = event => { if (event.target.matches('[data-claim] input')) {
    event.target.setCustomValidity(''); event.target.removeAttribute('aria-invalid');
    event.target.value = codeDraft = normalizeStudentCode(event.target.value);
  } };
  // Reject overlong paste/insertion before native maxlength can silently truncate it.
  const rejectOverflow = (event, pasted = false) => {
    const field = event.target;
    if (!field.matches('[data-claim] input')) return;
    const added = pasted ? event.clipboardData?.getData('text') : event.data;
    if (typeof added !== 'string') return;
    const proposed = field.value.slice(0, field.selectionStart ?? field.value.length) + added + field.value.slice(field.selectionEnd ?? field.value.length);
    if (normalizeStudentCode(proposed).length > 6) {
      event.preventDefault();
      inlineEntry('أدخل 6 أرقام تبدأ بالرقم 1.',true);
    } else if (pasted) {
      event.preventDefault(); field.value = normalizeStudentCode(proposed); input({target:field});
    }
  };
  const beforeInput = event => rejectOverflow(event);
  const paste = event => rejectOverflow(event, true);
  const click = event => {
    const copy = event.target.closest('[data-copy-diagnostic]');if(copy){void copyDiagnostic(copy);return;}
    if (event.target.closest('[data-session-retry]')) void run(() => client.read({phase:'manual'}),false,false,true);
    if (event.target.closest('[data-resume]')) void run(() => client.read({phase:'manual'}),false,false,true);
    if (event.target.closest('[data-read]')) void refresh();
    if (event.target.closest('[data-end]')) void run(() => client.end(), true);
  };
  function clear(preserveDraft=false, reason='context', invalidateClient=true) {
    if(clearing)return;clearing=true;
    clearTimeout(freshnessTimer);settledProjection=null;settledAt=0;settledContext=undefined;
    returnRead = null;
    if(preserveDraft){const field=root.querySelector('[data-claim] input');if(field)codeDraft=normalizeStudentCode(field.value);}else codeDraft='';
    generation++;viewDiagnostic=null; busy = false;endingSession=false;pendingForm=false;pendingCompletion=null;pendingMessage=''; clearTimeout(timer); if(invalidateClient)client?.invalidate?.(reason);
    // Retire private data/pending replies, retaining only this page's editable
    // unsubmitted draft. An existing entry keeps its DOM, selection and focus.
    if(preserveDraft&&root.querySelector('[data-claim]'))inlineEntry();else recovery('لم تُحسم حالة الجلسة. تحقّق مجددًا للمتابعة.');
    clearing=false;
  }
  const hide = () => {
    const end = endingSession || screen === 'end-pending' || screen === 'end-uncertain', ack = screen === 'end-ack';
    retiredPage = !end && !ack; clear(false,'pagehide');
    if(end)endUncertain();else if(ack){entry('انتهت الجلسة.');screen='end-ack';}else pending();
  }; // Actual navigation/retirement aborts; ordinary tab hiding does not abort End.
  const visible = () => {
    if(client.synchronizeContext?.())return;
    if(doc.visibilityState==='hidden'){
      const fallback=root.querySelector('[data-copy-text]');if(fallback){fallback.hidden=true;fallback.value='';}
      if(screen==='end-pending'||screen==='end-ack'||screen==='end-uncertain')return;
      if(busy&&pendingForm){codeDraft='';pending();return;}
      if(screen==='entry'||screen==='publication')return; // No automatic retry for an informational publication state.
      if(screen==='private'&&!busy){
        if(!currentView())return;
        const retain=client.canRetainView?.()!==false;if(screen!=='private')return;
        if(retain&&displayAge()<STUDENT_VIEW_FRESHNESS_MS)return;
        clear(false,'hidden');retiredPage=true;return;
      }
      if(returnRead)return; // Duplicate notifications cannot renew a retired context.
      const shouldRead = !endingSession && (root.querySelector('[data-end]') || busy);
      if (shouldRead) {clear(false,'hidden');pending();returnRead = { context: client?.captureContext?.() };}
    }else{
      const returning = returnRead; returnRead = null;
      if (retiredPage) { retiredPage=false;void run(() => client.read({phase:'return'}),false,false,true);return; }
      if (returning) {
        if(client.isContextCurrent && !client.isContextCurrent(returning.context)){clear();return;}
        void run(() => client.read({phase:'return'}), false, false, true);
      } else {
        adoptCompletion();
        if(screen==='private' && currentView() && displayAge()>=STUDENT_VIEW_FRESHNESS_MS)void refresh('return');
      }
    }
  };
  const pageshow = () => visible();
  const blur = () => {if(screen!=='private')return;const retain=client.canRetainView?.()!==false;if(screen!=='private')return;if(!retain){clear(false,'hidden');retiredPage=true;}};
  const unsubscribeContext=client?.subscribeContext?.(()=>{if(!clearing&&!disposed){const wasEntry=screen==='entry';retiredPage=false;clear(false,'context',false);if(wasEntry)entry('تغيّرت الجلسة في صفحة أخرى. أدخل الرمز للمتابعة.');}});
  root.addEventListener('beforeinput', beforeInput); root.addEventListener('paste', paste); root.addEventListener('submit', submit); root.addEventListener('input', input); root.addEventListener('click', click);
  win.addEventListener('focus', visible);win.addEventListener('blur', blur);win.addEventListener('pagehide', hide); win.addEventListener('pageshow', pageshow); doc.addEventListener('visibilitychange', visible);
  // Never inspect the HttpOnly cookie or persist private state. One current read
  // decides initial entry; pageshow/focus do not duplicate this bootstrap.
  let ready;
  if(!enabled){entry();ready=Promise.resolve();}
  else if(doc.visibilityState === 'hidden'){retiredPage=true;recovery('أعد فتح الصفحة للتحقق من الجلسة.');ready=Promise.resolve();}
  else ready=run(() => client.read({phase:'initial'}),false,false,true);
  return { ready, clear, refresh, dispose() {
    if (disposed) return;
    unsubscribeContext?.();clear(false,'disposed'); disposed = true; clearTimeout(timer);clearTimeout(freshnessTimer); client?.dispose?.(); root.replaceChildren(); style.remove();
    root.classList.remove('n88-unified'); if (previousDir === null) root.removeAttribute('dir'); else root.setAttribute('dir', previousDir);
    root.removeEventListener('beforeinput', beforeInput); root.removeEventListener('paste', paste); root.removeEventListener('submit', submit); root.removeEventListener('input', input); root.removeEventListener('click', click);
    win.removeEventListener('focus', visible);win.removeEventListener('blur', blur);win.removeEventListener('pagehide', hide); win.removeEventListener('pageshow', pageshow); doc.removeEventListener('visibilitychange', visible);
  } };
}
