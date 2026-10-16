import { html, openSheet, toast } from '../lib/dom.js';
import * as store from '../store.js';
import * as cloud from '../lib/cloud.js';
import { runtimeSyncOwnershipGuard } from '../lib/sync-ownership.js';
import { mountDateTimeControls } from '../lib/rakeez-datetime.js';
import { resolvedReportPrincipalName } from '../lib/report-print.js';
import { CATEGORIES, MAX_BYTES, parseBundle, validateBundle, reviewPlan, uniqueOptions, stateDigest, matchingKey, bundleNamesTargets } from '../lib/teacher-setup-import.js';

function ownerContext() {
  const workspace = store.getActiveWorkspace();
  if (!store.state.ready || workspace?.type !== 'account' || !cloud.session || cloud.session.user?.id !== cloud.user?.id ||
      cloud.authStatus().state !== 'authenticated') throw new Error('يلزم حساب جاهز لقراءة البيانات الحالية.');
  const access = runtimeSyncOwnershipGuard.cloudAccess({ operation: 'preview', authenticatedUserId: cloud.user?.id });
  if (!access.allowed || access.workspaceOwnerId !== workspace.authUserId) throw new Error('تعذّرت مطابقة مالك الحساب.');
  store.assertLeaseWritable();
  return JSON.stringify([workspace.authUserId, workspace.id, workspace.databaseName, workspace.leaseGeneration]);
}
const live = rows => rows.filter(row => !row.deleted);
function snapshot() {
  return structuredClone({ profile: store.state.profile, years: live(store.state.years), terms: live(store.state.terms),
    sections: live(store.state.sections), subjects: live(store.state.subjects), teachings: live(store.state.teachings),
    students: live(store.state.students), enrollments: live(store.state.enrollments), slots: live(store.state.slots),
    activeYearId: store.state.device?.activeYearId, activeTermId: store.state.device?.activeTermId,
    principalName: resolvedReportPrincipalName(store.state.profile, store.state.device) });
}
const options = (rows, selected = '') => rows.map(row => html`<option value="${row.id}" ${row.id === selected ? 'selected' : ''}>${row.name ?? `${row.hijriStart}-${Number(row.hijriStart) + 1}`}</option>`);

export function openTeacherSetupImport({ isContextCurrent = () => false } = {}) {
  let binding;
  try { binding = ownerContext(); if (!isContextCurrent()) throw new Error('تعذّر اعتماد سياق الاستيراد الحالي.'); } catch (error) { toast(error.message); return () => {}; }
  if (!document.querySelector('[data-teacher-setup-style]')) {
    const link = document.createElement('link'); link.rel = 'stylesheet';
    link.href = new URL('../styles/teacher-setup-import.css', import.meta.url).href;
    link.dataset.teacherSetupStyle = ''; document.head.append(link);
  }
  // Current private values are captured only after the real owner/readiness/lease guard.
  const current = snapshot(); let baseline = JSON.stringify(current);
  let bundle = null, plan = null, root, done = () => {}, closed = false, revision = 0;
  let namesReview = null, namesTarget = '', writing = false, receipt = null;
  const selected = new Set();
  let yearId = '', termId = '', mappings = { classes: {}, subjects: {} };
  const close = () => { if (closed) return; closed = true; revision++; bundle = plan = namesReview = receipt = null; namesTarget = ''; done(); };
  function guard({ checkState = true } = {}) {
    try {
      if (closed || ownerContext() !== binding || checkState && !writing && JSON.stringify(snapshot()) !== baseline || !isContextCurrent()) throw new Error('STALE');
      return true;
    } catch { close(); return false; }
  }
  function context() {
    return { yearId, termId, years: current.years, terms: current.terms, classes: current.sections.filter(s => s.yearId === yearId && s.status !== 'archived'),
      subjects: current.subjects, teachings: current.teachings, students: current.students, enrollments: current.enrollments };
  }
  const message = text => { root.querySelector('[data-import-status]').textContent = text; };
  function invalidate() {
    revision++; plan = namesReview = null; root.querySelector('[data-import-export]').disabled = true;
    message('المقترحات محلية ولم تُطبّق. أكمل المراجعة ثم أعد إعداد الخطة.');
  }
  function currentValue(category, row, field) {
    const profileField = { teacher: 'teacherName', school: 'schoolName', principal: 'reportPrincipalName' }[category];
    if (profileField) return (category === 'principal' ? current.principalName : current.profile?.[profileField]) || 'غير متوفر';
    const section = current.sections.find(s => s.id === mappings.classes[row.classroom]);
    const subject = current.subjects.find(s => s.id === mappings.subjects[row.subject]);
    if (field === 'classroom') return section?.name || 'لم تُحسم المطابقة';
    if (field === 'subject') return subject?.name || 'لم تُحسم المطابقة';
    if (category === 'students') {
      const matches = current.students.filter(s => matchingKey(s.name) === matchingKey(row.name) && current.enrollments.some(e => e.sectionId === section?.id && e.studentId === s.id));
      return matches.length ? `${matches.map(s => s.name).join('، ')} — اسم موجود؛ مراجعة يدوية` : section ? 'لا يوجد اسم مطابق في الفصل المختار' : 'لم تُحسم المطابقة';
    }
    if (category === 'timetable') {
      const teachings = current.teachings.filter(t => t.sectionId === section?.id && t.subjectId === subject?.id && t.termId === termId);
      const slots = current.slots.filter(s => teachings.some(t => t.id === s.teachingId));
      return slots.length ? slots.map(s => `اليوم ${s.weekday}، الحصة ${s.period}`).join('؛ ') : 'غير متوفر / لم تُحسم المطابقة';
    }
    return 'غير متوفر';
  }
  function namesTargets() {
    if (yearId !== current.activeYearId || termId !== current.activeTermId) return [];
    return bundleNamesTargets(bundle, selected, context(), mappings);
  }
  function freshNamesReview() {
    store.assertClassImportAccess();
    const target = namesTargets().find(t => t.id === namesTarget);
    if (!target) throw Error('IMPORT_CHANGED');
    store.assertClassOperationsAccess(target.id);
    const review = store.reviewNamesImport(target.id, { rows: target.rows, nameColumn: 0 });
    // Reject header-like names silently skipped by the general CSV adapter.
    if (review.entries.length !== target.rows.length) throw Error('IMPORT_INVALID');
    return review;
  }
  function canConfirm() {
    return namesReview && namesReview.counts.new > 0 && !namesReview.counts.invalid && !namesReview.counts.ambiguous && !writing && !receipt;
  }
  async function confirmNames() {
    if (!guard() || !canConfirm() || !root.querySelector('[data-names-approved]')?.checked) return;
    const reviewed = namesReview;
    try {
      const fresh = freshNamesReview();
      if (JSON.stringify(fresh) !== JSON.stringify(reviewed)) throw Error('IMPORT_CHANGED');
    } catch { invalidate(); render(); message('تغيّرت المراجعة. أعد معاينة الأسماء قبل التأكيد.'); return; }
    const generation = ++revision; plan = null;
    writing = true;
    // Prevent file/category edits and double submission while the existing store
    // owns its persisted-context check, cancellation and outbox transaction.
    root.querySelectorAll('input, select, textarea, button').forEach(el => { el.disabled = true; });
    let saved, failed = false;
    // The store rereads review.context in its persisted transaction preflight.
    // Keep that existing guard bound to this modal too: a route/selection/state
    // change while IndexedDB is opening must cancel before any student put.
    const commitReview = { ...reviewed, get context() {
      return guard({ checkState: false }) && generation === revision && JSON.stringify(snapshot()) === baseline ? reviewed.context : null;
    } };
    try { saved = await store.confirmNamesImport(commitReview, true); }
    catch { failed = true; }
    finally { writing = false; }
    if (closed || generation !== revision || !guard({ checkState: false })) return;
    baseline = JSON.stringify(snapshot());
    let after;
    try { store.assertClassOperationsAccess(reviewed.teachingId); after = store.reviewNamesImport(reviewed.teachingId, { rows: reviewed.rows, nameColumn: 0 }); }
    catch { close(); return; }
    const remaining = after.entries.filter(e => e.status === 'new').length;
    receipt = failed
      ? `لم تكتمل العملية أو تعذّر التحقق من نتيجتها. جديدة في المعاينة: ${reviewed.counts.new} · موجودة الآن: ${after.counts.existing} · جديدة لم تظهر كمحفوظة: ${remaining}. افتح الكشوف وأعد المراجعة؛ لا تكرر التأكيد مباشرةً.`
      : `حُفظ محليًا: ${saved.added} اسم جديد · موجودة سابقًا: ${reviewed.counts.existing} · جديدة لم تظهر كمحفوظة: ${remaining}. قد تبقى طلبات مزامنة؛ هذا ليس إثبات حفظ على الخادم.`;
    namesReview = plan = null; render();
    root.querySelector('[data-import-export]').disabled = true;
    root.querySelector('[data-import-plan]').disabled = true;
    root.querySelector('[data-sheet-close]').disabled = false;
    message('انتهت محاولة هذا الفصل. راجع الإيصال والكشوف.');
    root.querySelector('[data-names-receipt]')?.scrollIntoView({ block: 'nearest' });
  }
  function render() {
    if (!guard()) return;
    const target = root.querySelector('[data-import-review]');
    const scrollBody = root.querySelector('.sheet__body'), scrollTop = scrollBody.scrollTop;
    if (!bundle) { target.replaceChildren(); return; }
    const ctx = context();
    const classNames = [...new Set(bundle.categories.filter(c => selected.has(c.category)).flatMap(c => c.rows.map(r => r.classroom).filter(Boolean)))];
    const subjectNames = [...new Set(bundle.categories.filter(c => selected.has(c.category)).flatMap(c => c.rows.map(r => r.subject).filter(Boolean)))];
    const result = reviewPlan(bundle, selected, ctx, mappings);
    const targets = namesTargets();
    target.innerHTML = html`
      <fieldset class="n36-controls" ${writing || receipt ? 'disabled' : ''}><div class="field-row">
        <label class="field"><span class="field__label">السنة الحالية</span><select class="select" data-import-year><option value="">اختر السنة</option>${options(current.years.filter(y => y.status === 'active'), yearId)}</select></label>
        <label class="field"><span class="field__label">الفصل الدراسي الحالي</span><select class="select" data-import-term><option value="">اختر الفصل الدراسي</option>${options(current.terms.filter(t => t.yearId === yearId && t.status === 'active'), termId)}</select></label>
      </div>
      <div class="n36-mappings">
        ${classNames.map((name, i) => html`<label class="field"><span class="field__label">مطابقة الفصل: ${name}</span><select class="select" data-import-map="classes" data-map-index="${i}"><option value="">غير محسوم — اختر فصلًا فريدًا</option>${options(uniqueOptions(ctx.classes), mappings.classes[name])}</select></label>`)}
        ${subjectNames.map((name, i) => html`<label class="field"><span class="field__label">مطابقة المادة: ${name}</span><select class="select" data-import-map="subjects" data-map-index="${i}"><option value="">غير محسوم — اختر مادة فريدة</option>${options(uniqueOptions(ctx.subjects), mappings.subjects[name])}</select></label>`)}
      </div>
      ${Object.entries(CATEGORIES).map(([category, spec]) => {
        const c = bundle.categories.find(c => c.category === category);
        return html`<section class="n36-category"><h3>${c ? html`<label><input type="checkbox" data-import-category="${category}" ${selected.has(category) ? 'checked' : ''}> ${spec.label} (${c.rows.length})</label>` : spec.label}</h3>
          ${!c ? html`<p class="t-3">غير متوفر في الحزمة — لن يُفترض أو يُضاف.</p>` : !selected.has(category) ? html`<p class="t-3">مستبعد من الخطة.</p>` : c.rows.map((row, index) => html`<fieldset class="n36-row"><legend>السجل ${index + 1}</legend>${Object.entries(spec.fields).map(([field, label]) => html`<div class="n36-field"><span>${label}</span><small data-current>الحالي: ${currentValue(category, row, field)}</small><label class="field"><span class="field__label">المقترح${!row[field] ? ' — غير متوفر؛ يلزم مراجعته' : ''}</span>${field === 'time' ? html`<div class="field-row">${['start', 'end'].map((part, i) => html`<label class="field"><span class="field__label">${i ? 'النهاية (اختياري)' : 'البداية'}</span><input class="input" type="time" data-rakeez-datetime="time" data-rakeez-date-scope="session" data-edit-category="${category}" data-edit-row="${index}" data-edit-field="time" data-time-part="${part}" value="${row.time.split('-')[i] || ''}"></label>`)}</div>` : html`<input class="input" maxlength="80" autocomplete="off" data-edit-category="${category}" data-edit-row="${index}" data-edit-field="${field}" value="${row[field]}">`}</label></div>`)}</fieldset>`)}</section>`;
      })}
      </fieldset>
      ${targets.length ? html`<section class="n36-names" aria-label="إضافة الأسماء">
        <h3>إضافة الأسماء لفصل واحد</h3>
        <p>الأسماء فقط بتأكيدك؛ بقية الفئات للقراءة. لا توجد مزامنة تلقائية مع مدرستي أو نور.</p>
        <label class="field"><span class="field__label">الفصل والمادة المستهدفان</span><select class="select" data-names-target ${writing || receipt ? 'disabled' : ''}><option value="">اختر التدريس صراحةً</option>${options(targets, namesTarget)}</select></label>
        <button class="btn btn--quiet" type="button" data-names-review ${!namesTarget || writing || receipt ? 'disabled' : ''}>معاينة إضافة الأسماء</button>
        ${namesReview ? html`<div data-names-preview role="status"><p>جديدة: ${namesReview.counts.new} · موجودة: ${namesReview.counts.existing} · غير صالحة: ${namesReview.counts.invalid} · ملتبسة: ${namesReview.counts.ambiguous}</p><ul>${namesReview.entries.slice(0, 12).map(e => html`<li>${e.name} — ${{new:'جديد',existing:'موجود؛ لن يُدمج أو يُضاف',invalid:'غير صالح',ambiguous:'ملتبس'}[e.status]}</li>`)}</ul>${namesReview.entries.length > 12 ? html`<p>تُعرض أول 12 من ${namesReview.entries.length} اسمًا.</p>` : ''}
        <label><input type="checkbox" data-names-approved ${writing || receipt ? 'disabled' : ''}> راجعت الأسماء الجديدة لهذا الفصل</label>
        <button class="btn btn--primary" type="button" data-names-confirm disabled>تأكيد إضافة الأسماء</button></div>` : ''}
      </section>` : ''}
      ${receipt ? html`<section data-names-receipt role="status"><h3>إيصال إضافة الأسماء</h3><p>${receipt}</p><p>استيراد جزئي لأسماء محلية بتأكيدك لهذا الحساب. راجع الكشوف والمزامنة قبل أي محاولة أخرى؛ الطلبات المحفوظة باقية.</p><a class="btn btn--quiet" href="#/classes/koshoof">فتح الكشوف للمراجعة</a></section>` : ''}
      <p class="t-3">الأسماء المتطابقة تحتاج مراجعة المعلم؛ لا تُعدّ هوية مؤكدة. الفصول والمواد الجديدة أو الملتبسة لا تُنشأ هنا.</p>
      <div class="n36-issues" data-import-issues role="status">${result.issues.slice(0, 20).map(issue => html`<p>${issue}</p>`)}${result.issues.length > 20 ? html`<p>وبقية السجلات غير المحسومة (${result.issues.length - 20}).</p>` : ''}</div>
    `;
    mountDateTimeControls(target);
    const chooser = target.querySelector('[data-names-target]');
    if (chooser) chooser.onchange = () => { if (!guard() || writing || receipt) return; namesTarget = chooser.value; invalidate(); render(); };
    const reviewButton = target.querySelector('[data-names-review]');
    if (reviewButton) reviewButton.onclick = () => {
      if (!guard() || writing || receipt) return;
      invalidate();
      try { namesReview = freshNamesReview(); message('راجع الأسماء الجديدة ثم أكد هذا الفصل فقط. لم تُحفظ أسماء بعد.'); }
      catch { message('تعذّرت مراجعة الأسماء. تحقق من التدريس والمطابقات والسياق الحالي.'); }
      render();
    };
    const approved = target.querySelector('[data-names-approved]');
    if (approved) approved.onchange = () => {
      if (!guard()) return;
      target.querySelector('[data-names-confirm]').disabled = !approved.checked || !canConfirm();
    };
    const confirm = target.querySelector('[data-names-confirm]');
    if (confirm) confirm.onclick = confirmNames;

    scrollBody.scrollTop = scrollTop;
    root.querySelector('[data-import-plan]').disabled = result.issues.length > 0;
    target.querySelector('[data-import-year]').onchange = event => { if (!guard()) return; yearId = event.target.value; termId = ''; mappings = { classes: {}, subjects: {} }; invalidate(); render(); };
    target.querySelector('[data-import-term]').onchange = event => { if (!guard()) return; termId = event.target.value; invalidate(); render(); };
    target.querySelectorAll('[data-import-map]').forEach(el => { el.onchange = () => {
      if (!guard()) return;
      const names = el.dataset.importMap === 'classes' ? classNames : subjectNames;
      mappings[el.dataset.importMap][names[Number(el.dataset.mapIndex)]] = el.value; invalidate(); render();
    }; });
    target.querySelectorAll('[data-import-category]').forEach(el => { el.onchange = () => {
      if (!guard()) return;
      if (el.checked) selected.add(el.dataset.importCategory); else selected.delete(el.dataset.importCategory);
      invalidate(); render();
    }; });
    target.querySelectorAll('[data-edit-field]').forEach(el => { el.onchange = () => {
      if (!guard()) return;
      invalidate();
      try {
        const next = structuredClone(bundle), row = next.categories.find(c => c.category === el.dataset.editCategory).rows[Number(el.dataset.editRow)];
        if (el.dataset.editField === 'time') {
          const controls = [...el.closest('.n36-field').querySelectorAll('[data-time-part]')];
          const start = controls[0].value, end = controls[1].value;
          row.time = end ? `${start}-${end}` : start;
        } else row[el.dataset.editField] = el.value;
        bundle = validateBundle(next); message('تم تعديل المقترح محليًا فقط.');
      } catch { message('التعديل غير صالح أو مكرر؛ بقيت القيمة السابقة.'); }
      render();
    }; });
  }
  const promise = openSheet({ title: 'استيراد بيانات مدرستي',
    desc: 'راجع الحزمة محليًا. يمكن إضافة أسماء الطلاب لفصل واحد بعد معاينة وتأكيد صريح؛ بقية الفئات للقراءة فقط.',
    body: html`<div class="n36-receiver"><details data-import-source open><summary>اختيار ملف أو لصق الحزمة</summary><label class="field"><span class="field__label">ملف حزمة ركيز (JSON، الإصدار 1، حتى 100000 بايت)</span><input class="input" type="file" accept=".json,application/json" data-import-file></label><label class="field"><span class="field__label">أو الصق الحزمة</span><textarea class="input" rows="4" maxlength="100000" data-import-paste dir="ltr" autocomplete="off"></textarea></label><button class="btn btn--quiet" type="button" data-import-parse>معاينة البيانات</button></details><p role="status" data-import-status>اختر الحزمة التي صدّرتها وراجعها بنفسك. الاستيراد المعتاد لأسماء الطلاب يبقى من صفحة الفصل.</p><div data-import-review></div></div>`,
    foot: html`<button class="btn btn--ghost" data-sheet-close>إلغاء</button><button class="btn btn--primary" type="button" data-import-plan disabled>إعداد خطة مراجَعة</button><button class="btn btn--quiet" type="button" data-import-export disabled>تنزيل الخطة المحلية (لم تُطبّق)</button>`,
    onMount(el, finish) {
      root = el; done = finish; root.querySelector('.sheet').classList.add('n36-sheet');
      function parse(text) {
        if (!guard() || writing || receipt) return;
        invalidate(); bundle = null; selected.clear(); namesTarget = ''; mappings = { classes: {}, subjects: {} }; yearId = termId = '';
        root.querySelector('[data-import-plan]').disabled = true;
        try { bundle = parseBundle(text); bundle.categories.forEach(c => selected.add(c.category)); message('راجع المقترحات وحدد المطابقات. لم تُطبّق أي بيانات.'); }
        catch { message('الحزمة مرفوضة: إصدار أو حقول أو قيم غير صالحة، تكرار أو تجاوز الحدود. لا تضع بيانات حساسة.'); }
        root.querySelector('[data-import-source]').open = !bundle;
        render();
      }
      root.querySelector('[data-import-paste]').oninput = () => {
        if (!guard() || writing || receipt) return; invalidate(); bundle = null; render(); root.querySelector('[data-import-plan]').disabled = true;
      };
      root.querySelector('[data-import-parse]').onclick = () => parse(root.querySelector('[data-import-paste]').value);
      root.querySelector('[data-import-file]').onchange = async event => {
        if (!guard() || writing || receipt) return;
        invalidate(); bundle = null; render(); root.querySelector('[data-import-plan]').disabled = true;
        const file = event.target.files?.[0], generation = revision;
        if (!file) return;
        if (file.size > MAX_BYTES) { message('الملف أكبر من الحد المسموح.'); return; }
        try { const text = await file.text(); if (generation === revision && guard()) parse(text); }
        catch { if (guard()) message('تعذّرت قراءة الملف.'); }
      };
      root.querySelector('[data-import-plan]').onclick = async () => {
        if (!guard() || !bundle || writing || receipt) return;
        const result = reviewPlan(bundle, selected, context(), mappings);
        if (result.issues.length) { message('أكمل مراجعة القيم والمطابقات أولًا.'); return; }
        try {
          for (const c of result.categories) for (const row of c.rows) if (row.references.sectionId) store.validateTeachingContext(row.references.sectionId, termId);
          const generation = revision, digest = await stateDigest(current);
          if (generation !== revision || !guard()) return;
          plan = { schema: 'rakeez-reviewed-teacher-setup-plan', version: 1, sourceVersion: 1, applied: false,
            ownerId: cloud.user.id, workspaceBinding: JSON.parse(binding), currentStateSha256: digest,
            yearId, termId, categories: result.categories };
          root.querySelector('[data-import-export]').disabled = false;
          message('أُعدّت خطة محلية مراجَعة ولم تُطبّق. لم تتغير البيانات؛ تطبيقها هو خطوة التكامل التالية. الخطة مرتبطة بالمالك والحالة الحالية وليست تصريحًا للحفظ.');
        } catch { invalidate(); message('تعذّر اعتماد السياق الحالي. لم تتغير البيانات.'); }
      };
      root.querySelector('[data-import-export]').onclick = () => {
        if (!guard() || !plan) return;
        const url = URL.createObjectURL(new Blob([JSON.stringify(plan, null, 2)], { type: 'application/json' }));
        const a = document.createElement('a'); a.href = url; a.download = 'rakeez-reviewed-plan-not-applied.json'; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      };
    },
  });
  const removeDeactivation = store.onWorkspaceDeactivation(close);
  const removeStateSubscription = store.subscribe(() => guard());
  const removeAuthSubscription = cloud.subscribe(() => guard());
  // Poll only the cheap owner/lease boundary; actual state notifications/actions
  // check the full binding without repeatedly cloning a teacher's entire roster.
  const timer = setInterval(() => guard({ checkState: false }), 250);
  window.addEventListener('hashchange', close);
  promise.finally(() => { closed = true; revision++; bundle = plan = namesReview = receipt = null; namesTarget = ''; clearInterval(timer); removeDeactivation(); removeStateSubscription(); removeAuthSubscription(); window.removeEventListener('hashchange', close); });
  return close;
}
