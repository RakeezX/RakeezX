import { html, icon, openSheet, toast } from './dom.js';
import * as store from '../store.js';
import { achievementCard, achievementPng } from './student-achievements.js';
import { drawAchievementCertificate, certificateDescription, certificateIssueDate, printCertificateBatch } from './achievement-certificate.js';
import { CERTIFICATE_DESIGNS, CERTIFICATE_MEDALS } from './certificate-designs.js';
import { openDocumentPreview } from './document-preview.js';
import { resolvedReportPrincipalName, isDemoOutput } from './report-print.js';
import { getAccountPresentation } from './account-profile.js';

function loadStyle() {
  if (document.querySelector('link[data-certificate-center-style]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = new URL('../styles/certificate-center.css', import.meta.url).href;
  link.dataset.certificateCenterStyle = '';
  document.head.append(link);
}

/** A local, transient certificate workspace. No profile, roster or evidence writes. */
export function openCertificateCenter({ teachingId } = {}) {
  loadStyle();
  const teachings = store.teachings();
  const initialTeaching = teachings.find(teaching => teaching.id === teachingId) ?? teachings[0];
  const profile = store.state.profile ?? {};
  const presentation = getAccountPresentation(profile.teacherForm);
  const metadata = {
    schoolName: profile.schoolName ?? '',
    educationDepartment: profile.educationDepartment ?? '',
    teacherName: profile.teacherName ?? '',
    principalName: resolvedReportPrincipalName(profile, store.state.device),
  };
  return openSheet({
    title: 'شهادات التقدير',
    desc: 'اختر الفصل والطلاب والتصميم، ثم راجع شهاداتهم قبل الطباعة.',
    body: html`
      <div class="certificate-center" dir="rtl">
        <aside class="certificate-center__controls">
          <div class="certificate-center__tabs" role="group" aria-label="إعداد الشهادات">
            <button type="button" data-center-tab="students" aria-pressed="true">الطلاب</button>
            <button type="button" data-center-tab="design" aria-pressed="false">التصميم والبيانات</button>
          </div>
          <section class="certificate-center__section" data-center-panel="students">
            <h3>الفصل والطلاب</h3>
            <label class="field"><span class="field__label">الفصل والمادة</span>
              <select class="input" data-center-teaching ${!teachings.length ? 'disabled' : ''}>
                ${!teachings.length ? html`<option value="">لا توجد فصول حالية</option>` : ''}
                ${teachings.map(teaching => html`<option value="${teaching.id}" ${teaching.id === initialTeaching?.id ? 'selected' : ''}>${store.teachingLabel(teaching)}</option>`)}
              </select>
            </label>
            <fieldset class="certificate-center__evidence">
              <legend>الإنجاز الذي يظهر في الشهادة</legend>
              <label><input type="checkbox" data-center-evidence="participation"> المشاركات الإيجابية <small>كل السجل المتاح</small></label>
              <label><input type="checkbox" data-center-evidence="scores"> بنود بدرجة كاملة <small>التقييمات اليدوية في الإسناد المختار</small></label>
            </fieldset>
            <label class="certificate-center__name"><input type="checkbox" data-center-names> إظهار أسماء الطلاب في الشهادات</label>
            <label class="field certificate-center__search"><span class="field__label">بحث عن طالب</span><input class="input" type="search" data-center-search placeholder="ابحث بالاسم" autocomplete="off"></label>
            <div class="certificate-center__selection"><span data-center-count role="status">لم يُحدّد طلاب</span><div><button class="btn btn--quiet btn--sm" type="button" data-center-all>تحديد ذوي الإنجاز</button><button class="btn btn--ghost btn--sm" type="button" data-center-clear>مسح</button></div></div>
            <div class="certificate-center__roster" data-center-roster></div>
          </section>
          <section class="certificate-center__section" data-center-panel="design" hidden>
            <h3>تصميم الشهادة</h3>
            <div class="certificate-center__designs" role="group" aria-label="تصميم الشهادة">${CERTIFICATE_DESIGNS.map((design, index) => html`<button type="button" class="certificate-center__design ${index === 0 ? 'is-selected' : ''}" data-center-design="${design.id}" aria-pressed="${index === 0}"><canvas class="certificate-center__thumbnail" data-center-thumbnail="${design.id}" width="300" height="212" aria-hidden="true"></canvas><strong>${design.label}</strong></button>`)}</div>
            <label class="field"><span class="field__label">رمز التقدير</span><select class="input" data-center-medal>${CERTIFICATE_MEDALS.map(medal => html`<option value="${medal.id}">${medal.label}</option>`)}</select></label>
            <details class="certificate-center__metadata"><summary>بيانات المدرسة والتوقيع</summary><p>يمكن تعديلها لهذه الشهادات فقط. لا تُحفظ في الحساب.</p>
              ${[['schoolName', 'المدرسة'], ['educationDepartment', 'إدارة التعليم'], ['teacherName', presentation.teacherNameLabel], ['principalName', presentation.principalNameLabel]].map(([key, label]) => html`<label class="field"><span class="field__label">${label} <small>اختياري</small></span><input class="input" data-center-meta="${key}" value="${metadata[key]}" maxlength="100" autocomplete="off"></label>`)}
            </details>
            <p class="certificate-center__local">${icon('check')} تُجهّز على جهازك دون رفع أو إرسال</p>
          </section>
        </aside>
        <section class="certificate-center__preview" aria-label="معاينة الشهادات">
          <div class="certificate-center__preview-head"><div><h3>معاينة الشهادة</h3><span>A4 · أفقي</span></div><button type="button" class="btn btn--ghost btn--sm" data-center-expand disabled>معاينة موسّعة</button></div>
          <div class="certificate-center__paper"><canvas data-center-canvas role="img" aria-label="معاينة شهادة التقدير"></canvas></div>
          <div class="certificate-center__navigation"><button type="button" class="btn btn--ghost btn--sm" data-center-prev disabled>السابق</button><span data-center-position>اختر طلابًا للمعاينة</span><button type="button" class="btn btn--ghost btn--sm" data-center-next disabled>التالي</button></div>
          <p class="certificate-center__status" data-center-status role="status"></p>
          <label class="certificate-center__consent"><input type="checkbox" data-center-confirm disabled><span>راجعت شهادات الطلاب المحددين وأوافق على تصدير محتواها المختار</span></label>
        </section>
      </div>`,
    foot: html`<button class="btn btn--ghost" data-sheet-close>إغلاق</button><button class="btn btn--outline" data-center-download disabled>${icon('download')} صورة الشهادة المعروضة</button><button class="btn btn--primary" data-center-print disabled>${icon('print')} طباعة الشهادات / PDF</button>`,
    onMount(root) {
      root.classList.add('certificate-center-backdrop');
      root.querySelector('.sheet').classList.add('certificate-center-sheet');
      const $ = selector => root.querySelector(selector);
      const canvas = $('[data-center-canvas]');
      const confirm = $('[data-center-confirm]');
      const selected = new Set();
      let currentTeachingId = initialTeaching?.id ?? '';
      let evidence = [];
      let includeName = false;
      let design = CERTIFICATE_DESIGNS[0]?.id;
      let medal = CERTIFICATE_MEDALS[0]?.id;
      let query = '';
      let index = 0;
      let revision = 0;
      let busy = false;
      let previewOpen = false;
      let ready = false;
      let entries = [];
      const dateLabel = certificateIssueDate();
      const roster = () => currentTeachingId ? store.students(currentTeachingId) : [];
      const cardFor = student => achievementCard({
        studentId: student.id,
        items: store.items(currentTeachingId),
        gradeCtx: store.studentContext(student.id, currentTeachingId),
        history: store.studentHistory(student.id),
      }, { selected: evidence, includeName, studentName: student.name, demo: isDemoOutput() });
      const options = () => {
        const teaching = store.getTeaching(currentTeachingId);
        return { ...metadata, design, medal, teacherLabel: presentation.teacherSubjectLabel,
          principalLabel: presentation.schoolPrincipalLabel,
          className: store.sectionLabel(store.getSection(teaching?.sectionId)) || '',
          subjectName: store.getSubject(teaching?.subjectId)?.name || '', dateLabel };
      };
      const selectionState = () => {
        const current = roster();
        const students = current.filter(student => selected.has(student.id));
        const missing = selected.size - students.length;
        const cards = students.map(student => ({ student, card: cardFor(student) }));
        const ineligible = cards.filter(entry => !entry.card.evidence.length);
        return { current, cards, missing, ineligible, valid: !!selected.size && !missing && !ineligible.length && !!evidence.length };
      };
      const syncButtons = () => {
        const valid = ready && selectionState().valid;
        confirm.disabled = !valid || busy;
        $('[data-center-print]').disabled = $('[data-center-download]').disabled = !valid || !confirm.checked || busy || previewOpen;
        $('[data-center-expand]').disabled = !ready || !entries.length || busy || previewOpen;
        $('[data-center-prev]').disabled = busy || index <= 0;
        $('[data-center-next]').disabled = busy || index >= entries.length - 1;
        $('[data-center-all]').disabled = busy || !evidence.length;
      };
      const renderRoster = () => {
        const focusedStudentId = root.contains(document.activeElement) ? document.activeElement?.dataset?.centerStudent : null;
        const current = roster();
        const visible = current.filter(student => String(student.name).toLocaleLowerCase('ar').includes(query));
        $('[data-center-count]').textContent = selected.size ? `${selected.size} طالبًا محددًا` : 'لم يُحدّد طلاب';
        $('[data-center-roster]').innerHTML = String(html`${visible.map(student => {
          const card = cardFor(student);
          const facts = card.evidence.map(fact => `${fact.title}: ${fact.count}`).join(' · ');
          return html`<label class="certificate-center__student ${selected.has(student.id) ? 'is-selected' : ''}"><input type="checkbox" data-center-student="${student.id}" ${selected.has(student.id) ? 'checked' : ''}><span><strong>${student.name}</strong><small>${!evidence.length ? 'اختر نوع الإنجاز لعرض السجل المتاح' : facts || 'لا يوجد إنجاز من النوع المختار'}</small></span>${evidence.length ? html`<span class="certificate-center__eligibility ${card.evidence.length ? 'is-eligible' : ''}">${card.evidence.length ? 'إنجاز متاح' : 'بلا إنجاز مختار'}</span>` : ''}</label>`;
        })}${!visible.length ? html`<p class="certificate-center__empty">${current.length ? 'لا يوجد طالب بهذا الاسم.' : 'لا يوجد طلاب في الفصل المختار.'}</p>` : ''}`);
        if (focusedStudentId) [...root.querySelectorAll('[data-center-student]')]
          .find(field => field.dataset.centerStudent === focusedStudentId)?.focus({ preventScroll: true });
      };
      const refresh = (contentChanged = true) => {
        if (contentChanged) { revision++; confirm.checked = false; }
        const state = selectionState();
        entries = state.cards;
        index = Math.min(index, Math.max(0, entries.length - 1));
        ready = false;
        try {
          const card = entries[index]?.card ?? { name: '', demo: isDemoOutput(), evidence: [] };
          drawAchievementCertificate(canvas, card, options());
          canvas.setAttribute('aria-label', certificateDescription(card, options()));
          ready = true;
        } catch { $('[data-center-status]').textContent = 'تعذرت معاينة الشهادة في هذا المتصفح.'; }
        $('[data-center-position]').textContent = entries.length ? `الشهادة ${index + 1} من ${entries.length}` : 'اختر طلابًا للمعاينة';
        if (ready) $('[data-center-status]').textContent = state.missing ? 'تغيّر كشف الفصل. أعد اختيار الطلاب قبل التصدير.'
          : !evidence.length ? 'اختر إنجازًا موثّقًا. الأسماء مخفية حتى تختار إظهارها.'
          : !selected.size ? 'حدّد الطلاب الذين تريد تجهيز شهاداتهم.'
          : state.ineligible.length ? `${state.ineligible.length} من الطلاب المحددين بلا إنجاز من النوع المختار. أزل تحديدهم أو غيّر الإنجاز لإتاحة التصدير.`
          : `راجِع الشهادات باستخدام السابق والتالي، ثم وافق على التصدير.${includeName ? '' : ' الأسماء مخفية باختيارك.'}`;
        syncButtons();
      };
      root.addEventListener('change', event => {
        const target = event.target;
        if (target.matches('[data-center-teaching]')) { currentTeachingId = target.value; selected.clear(); index = 0; query = ''; $('[data-center-search]').value = ''; }
        else if (target.matches('[data-center-student]')) { target.checked ? selected.add(target.dataset.centerStudent) : selected.delete(target.dataset.centerStudent); index = 0; }
        else if (target.matches('[data-center-evidence]')) evidence = [...root.querySelectorAll('[data-center-evidence]:checked')].map(field => field.dataset.centerEvidence);
        else if (target.matches('[data-center-names]')) includeName = target.checked;
        else if (target.matches('[data-center-medal]')) medal = target.value;
        else if (target === confirm) { syncButtons(); return; }
        else return;
        renderRoster(); refresh();
      });
      root.addEventListener('input', event => {
        const target = event.target;
        if (target.matches('[data-center-search]')) { query = target.value.trim().toLocaleLowerCase('ar'); renderRoster(); }
        else if (target.matches('[data-center-meta]')) { metadata[target.dataset.centerMeta] = target.value; refresh(); }
      });
      root.addEventListener('click', async event => {
        const button = event.target.closest('button');
        if (!button || busy) return;
        if (button.matches('[data-center-tab]')) {
          root.querySelectorAll('[data-center-panel]').forEach(panel => { panel.hidden = panel.dataset.centerPanel !== button.dataset.centerTab; });
          root.querySelectorAll('[data-center-tab]').forEach(tab => tab.setAttribute('aria-pressed', String(tab === button)));
        }
        else if (button.matches('[data-center-all]')) { selected.clear(); for (const student of roster()) if (cardFor(student).evidence.length) selected.add(student.id); index = 0; renderRoster(); refresh(); }
        else if (button.matches('[data-center-clear]')) { selected.clear(); index = 0; renderRoster(); refresh(); }
        else if (button.matches('[data-center-design]')) {
          design = button.dataset.centerDesign;
          root.querySelectorAll('[data-center-design]').forEach(item => { const active = item === button; item.classList.toggle('is-selected', active); item.setAttribute('aria-pressed', String(active)); });
          refresh();
        } else if (button.matches('[data-center-prev], [data-center-next]')) { index += button.matches('[data-center-prev]') ? -1 : 1; refresh(false); }
        else if (button.matches('[data-center-expand]')) {
          previewOpen = true; syncButtons();
          try { await openDocumentPreview({ title: 'معاينة شهادة التقدير', canvas, description: 'معاينة الشهادة المعروضة. عد لمراجعة بقية الشهادات.' }); }
          catch { toast('تعذّر فتح المعاينة الموسّعة', 'danger'); }
          finally { previewOpen = false; syncButtons(); if (root.isConnected) button.focus({ preventScroll: true }); }
        } else if (button.matches('[data-center-print], [data-center-download]')) {
          if (!confirm.checked || !ready || !selectionState().valid) { refresh(); return; }
          const outputRevision = revision;
          const selectedIds = [...selected];
          const outputEntries = selectionState().cards;
          const snapshotOptions = options();
          const fingerprint = JSON.stringify({ cards: outputEntries.map(entry => entry.card), options: snapshotOptions });
          const isCurrent = () => root.isConnected && revision === outputRevision && confirm.checked && selectionState().valid
            && selectedIds.length === selected.size && selectedIds.every(id => selected.has(id))
            && fingerprint === JSON.stringify({ cards: selectionState().cards.map(entry => entry.card), options: options() });
          let url;
          busy = true; syncButtons();
          try {
            await document.fonts?.ready;
            if (!isCurrent()) return;
            if (button.matches('[data-center-print]')) {
              // The print helper renders one scratch canvas at a time, avoiding
              // a full-resolution canvas allocation for every selected student.
              const pages = outputEntries.map(({ card }) => ({ card, options: snapshotOptions }));
              if (!isCurrent()) return;
              const opened = await printCertificateBatch(pages, true, isCurrent);
              if (opened) $('[data-center-status]').textContent = 'من نافذة الطباعة اختر الطابعة أو «حفظ بتنسيق PDF». لكل طالب صفحة مستقلة.';
            } else {
              const output = document.createElement('canvas');
              const card = outputEntries[index]?.card;
              if (!card) return;
              drawAchievementCertificate(output, card, snapshotOptions);
              const blob = await achievementPng(output, card, true);
              if (!isCurrent()) return;
              url = URL.createObjectURL(blob);
              const link = document.createElement('a'); link.href = url; link.download = 'rakeez-achievement-certificate.png'; link.click();
              toast('تم تجهيز صورة الشهادة للتنزيل', 'ok');
            }
          } catch { toast('تعذّر تجهيز الشهادات — حاول مرة أخرى', 'danger'); }
          finally { if (url) setTimeout(() => URL.revokeObjectURL(url), 1000); busy = false; confirm.checked = false; syncButtons(); }
        }
      });
      renderRoster(); refresh();
      const renderThumbnails = () => {
        for (const thumbnail of root.querySelectorAll('[data-center-thumbnail]')) {
          const sample = document.createElement('canvas');
          try {
            drawAchievementCertificate(sample, { name: '', demo: false, evidence: [] }, {
              design: thumbnail.dataset.centerThumbnail,
              medal: CERTIFICATE_MEDALS[0]?.id,
              schoolName: '', educationDepartment: '', teacherName: '', principalName: '',
              teacherLabel: '', principalLabel: '', className: '', subjectName: '', dateLabel: '',
            });
            thumbnail.getContext('2d')?.drawImage(sample, 0, 0, 300, 212);
          } finally { sample.width = 1; sample.height = 1; }
        }
      };
      Promise.resolve(document.fonts?.ready).then(() => {
        if (!root.isConnected) return;
        refresh(false);
        try { renderThumbnails(); } catch { /* The live certificate preview remains available. */ }
      });
    },
  });
}
