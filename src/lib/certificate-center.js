import { html, icon, toast } from './dom.js';
import * as store from '../store.js';
import { certificateCard, isCertificateReady, drawAchievementCertificate, certificateDescription, certificateIssueDate, downloadCertificates, prepareCertificateAssets } from './achievement-certificate.js';
import { CERTIFICATE_DESIGNS, CERTIFICATE_TEXT_LIMIT, certificateText, defaultCertificateText } from './certificate-designs.js';
import { openDocumentPreview } from './document-preview.js';
import { resolvedReportPrincipalName, isDemoOutput } from './report-print.js';
import { getAccountPresentation } from './account-profile.js';
import { hasFullMarks, sortCertificateTeachings } from './certificate-selection.js';

const HONORS_HINT = 'يحدّد أصحاب الدرجة الكاملة في جميع البنود بعد اكتمال رصدها. ويمكنك تعديل الاختيار يدويًا.';

function loadStyle() {
  if (document.querySelector('link[data-certificate-center-style]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = new URL('../styles/certificate-center.css', import.meta.url).href;
  link.dataset.certificateCenterStyle = '';
  document.head.append(link);
}

/** A local, transient certificate workspace. No profile, roster or evidence writes. */
export function createCertificateCenter({ teachingId } = {}) {
  loadStyle();
  const teachings = sortCertificateTeachings(store.teachings(), store);
  const initialTeaching = teachings.find(teaching => teaching.id === teachingId) ?? teachings[0];
  const initialText = defaultCertificateText();
  const identityDefaults = () => {
    const profile = store.state.profile ?? {};
    return {
      schoolName: profile.schoolName ?? '',
      educationDepartment: profile.educationDepartment ?? '',
      teacherName: profile.teacherName ?? '',
      principalName: resolvedReportPrincipalName(profile, store.state.device),
    };
  };
  let presentation = getAccountPresentation(store.state.profile?.teacherForm);
  const metadata = identityDefaults();
  const editedMetadata = new Set();
  const currentIdentity = () => Object.fromEntries(Object.entries(identityDefaults())
    .map(([key, value]) => [key, editedMetadata.has(key) ? metadata[key] : value]));
  let refreshMountedIdentity = null;
  const mounted = new WeakSet();
  return {
    body: html`
      <div class="certificate-page" dir="rtl">
        <div class="certificate-page__toolbar">
          <div class="certificate-page__workspace-actions">
            <a class="btn btn--ghost" href="#/reports" data-center-back>العودة إلى التقارير</a>
            <button type="button" class="btn btn--quiet" data-center-toggle-controls aria-expanded="true">${icon('settings')} <span>إخفاء الإعدادات</span></button>
          </div>
          <div class="certificate-page__exports">
            <button type="button" class="btn btn--outline" data-center-download disabled><span class="certificate-export-icon" aria-hidden="true">${icon('download')}</span> تنزيل الصور</button>
            <button type="button" class="btn btn--primary" data-center-print disabled><span class="certificate-export-icon" aria-hidden="true">${icon('download')}</span> تنزيل PDF</button>
          </div>
        </div>
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
            <label class="field certificate-center__search"><span class="field__label">بحث عن طالب</span><input class="input" type="search" data-center-search placeholder="ابحث بالاسم" autocomplete="off"></label>
            <div class="certificate-center__selection"><span data-center-count role="status">لم يُحدّد طلاب</span><div><button class="btn btn--quiet btn--sm" type="button" data-center-honors aria-describedby="certificate-center-honors-hint">أبطال التميّز</button><button class="btn btn--ghost btn--sm" type="button" data-center-clear>مسح</button></div></div>
            <p class="certificate-center__honors-hint" id="certificate-center-honors-hint" role="status">${HONORS_HINT}</p>
            <div class="certificate-center__roster" data-center-roster></div>
          </section>
          <section class="certificate-center__section" data-center-panel="design" hidden>
            <h3>تصميم الشهادة</h3>
            <div class="certificate-center__designs" role="group" aria-label="تصميم الشهادة">${CERTIFICATE_DESIGNS.map((design, index) => html`<button type="button" class="certificate-center__design ${index === 0 ? 'is-selected' : ''}" data-center-design="${design.id}" aria-pressed="${index === 0}"><canvas class="certificate-center__thumbnail" data-center-thumbnail="${design.id}" width="300" height="212" aria-hidden="true"></canvas><strong>${design.label}</strong></button>`)}</div>
            <label class="field certificate-center__message"><span class="field__label">نص الشهادة</span>
              <textarea class="input certificate-center__text" data-center-text rows="6" maxlength="${CERTIFICATE_TEXT_LIMIT}" aria-describedby="certificate-center-text-hint">${initialText}</textarea>
              <small id="certificate-center-text-hint">عبارة تقدير جاهزة يمكنك تعديلها، وتُطبّق على جميع الطلاب المحددين.</small>
            </label>
            <details class="certificate-center__metadata"><summary>بيانات المدرسة والتوقيع</summary><p>تُملأ تلقائيًا من بياناتك في ركيز. يمكنك تعديلها لهذه الشهادات فقط.</p>
              ${[['schoolName', 'المدرسة'], ['educationDepartment', 'إدارة التعليم'], ['teacherName', presentation.teacherNameLabel], ['principalName', presentation.principalNameLabel]].map(([key, label]) => html`<label class="field"><span class="field__label"><span data-center-meta-label="${key}">${label}</span> <small>اختياري</small></span><input class="input" data-center-meta="${key}" value="${metadata[key]}" maxlength="100" autocomplete="off"></label>`)}
            </details>
            <p class="certificate-center__local">${icon('check')} تُجهّز على جهازك دون رفع أو إرسال</p>
          </section>
        </aside>
        <section class="certificate-center__preview" aria-label="معاينة الشهادات">
          <div class="certificate-center__preview-head"><div><h3>معاينة الشهادة</h3><span>A4 · أفقي</span></div><button type="button" class="btn btn--ghost btn--sm" data-center-expand disabled>معاينة موسّعة</button></div>
          <div class="certificate-center__paper"><canvas data-center-canvas width="2970" height="2100" role="img" aria-label="معاينة شهادة التقدير"></canvas></div>
          <div class="certificate-center__navigation"><button type="button" class="btn btn--ghost btn--sm" data-center-prev disabled>السابق</button><span data-center-position>اختر طلابًا للمعاينة</span><button type="button" class="btn btn--ghost btn--sm" data-center-next disabled>التالي</button></div>
          <p class="certificate-center__status" data-center-status role="status" hidden></p>
          <p class="certificate-center__local" data-center-export-hint hidden>لكل طالب ملف مستقل باسمه. اسمح بتنزيل عدة ملفات إذا طلب المتصفح ذلك.</p>
          <div class="certificate-center__export-progress">
            <p class="certificate-center__status" data-center-export-status role="status" hidden></p>
            <button type="button" class="btn btn--ghost btn--sm" data-center-cancel hidden>إيقاف المتبقي</button>
          </div>
        </section>
      </div>
      </div>`,
    refreshIdentity() { refreshMountedIdentity?.(); },
    mount(root) {
      if (!root || mounted.has(root)) return;
      mounted.add(root);
      const $ = selector => root.querySelector(selector);
      const canvas = $('[data-center-canvas]');
      const exportStatus = $('[data-center-export-status]');
      const selected = new Set();
      let currentTeachingId = initialTeaching?.id ?? '';
      let text = initialText;
      let design = CERTIFICATE_DESIGNS[0]?.id;
      let query = '';
      let index = 0;
      let revision = 0;
      let busy = false;
      let exportFormat = null;
      let exportCancelled = false;
      let previewOpen = false;
      let ready = false;
      let assetsReady = false;
      let assetsFailed = false;
      let entries = [];
      let honorsApplied = false;
      const dateLabel = certificateIssueDate();
      const roster = () => currentTeachingId ? store.students(currentTeachingId) : [];
      const cardFor = student => certificateCard({
        studentName: student.name, text, demo: isDemoOutput(),
      });
      const options = () => {
        const teaching = store.getTeaching(currentTeachingId);
        const currentPresentation = getAccountPresentation(store.state.profile?.teacherForm);
        return { ...currentIdentity(), design, teacherLabel: currentPresentation.teacherSubjectLabel,
          principalLabel: currentPresentation.schoolPrincipalLabel,
          className: store.sectionLabel(store.getSection(teaching?.sectionId)) || '',
          subjectName: store.getSubject(teaching?.subjectId)?.name || '', dateLabel };
      };
      const selectionState = () => {
        const current = roster();
        const students = current.filter(student => selected.has(student.id));
        const missing = selected.size - students.length;
        const cards = students.map(student => ({ student, card: cardFor(student) }));
        return { current, cards, missing, valid: !!selected.size && !missing && cards.every(entry => isCertificateReady(entry.card)) };
      };
      const syncButtons = () => {
        const valid = ready && selectionState().valid;
        $('[data-center-print]').disabled = $('[data-center-download]').disabled = !valid || busy || previewOpen;
        $('[data-center-print]').setAttribute('aria-busy', String(busy && exportFormat === 'pdf'));
        $('[data-center-download]').setAttribute('aria-busy', String(busy && exportFormat === 'png'));
        $('[data-center-expand]').disabled = !ready || !entries.length || busy || previewOpen;
        $('[data-center-prev]').disabled = busy || index <= 0;
        $('[data-center-next]').disabled = busy || index >= entries.length - 1;
        $('[data-center-honors]').disabled = busy || !roster().length;
        $('[data-center-cancel]').hidden = !busy;
        $('[data-center-cancel]').disabled = !busy || exportCancelled;
        $('[data-center-export-hint]').hidden = selected.size <= 1;
      };
      const renderRoster = () => {
        const focusedStudentId = root.contains(document.activeElement) ? document.activeElement?.dataset?.centerStudent : null;
        const current = roster();
        const visible = current.filter(student => String(student.name).toLocaleLowerCase('ar').includes(query));
        $('[data-center-count]').textContent = selected.size ? `${selected.size} طالبًا محددًا` : 'لم يُحدّد طلاب';
        $('#certificate-center-honors-hint').textContent = honorsApplied && !selected.size
          ? 'لا يوجد طلاب مكتملة درجاتهم بالدرجة الكاملة في الفصل والمادة المختارين. يمكنك اختيار الطلاب يدويًا.'
          : HONORS_HINT;
        $('[data-center-roster]').innerHTML = String(html`${visible.map(student => html`<label class="certificate-center__student ${selected.has(student.id) ? 'is-selected' : ''}"><input type="checkbox" data-center-student="${student.id}" ${selected.has(student.id) ? 'checked' : ''}><span><strong>${student.name}</strong></span></label>`)}${!visible.length ? html`<p class="certificate-center__empty">${current.length ? 'لا يوجد طالب بهذا الاسم.' : 'لا يوجد طلاب في الفصل المختار.'}</p>` : ''}`);
        if (focusedStudentId) [...root.querySelectorAll('[data-center-student]')]
          .find(field => field.dataset.centerStudent === focusedStudentId)?.focus({ preventScroll: true });
      };
      const refresh = (contentChanged = true) => {
        if (contentChanged) revision++;
        if (contentChanged && !busy) exportStatus.hidden = true;
        const state = selectionState();
        entries = state.cards;
        index = Math.min(index, Math.max(0, entries.length - 1));
        ready = false;
        $('[data-center-position]').textContent = entries.length ? `الشهادة ${index + 1} من ${entries.length}` : 'اختر طلابًا للمعاينة';
        if (!assetsReady) {
          $('[data-center-status]').textContent = assetsFailed
            ? 'تعذّر تحميل الشعار أو خط الشهادة. أعد تحميل الصفحة للمحاولة مجددًا.'
            : 'جارٍ تجهيز الشعار ومعاينة الشهادة…';
          $('[data-center-status]').hidden = false;
          syncButtons();
          return;
        }
        try {
          const card = entries[index]?.card ?? certificateCard({ text, demo: isDemoOutput() });
          drawAchievementCertificate(canvas, card, options());
          canvas.setAttribute('aria-label', certificateDescription(card, options()));
          ready = true;
        } catch { $('[data-center-status]').textContent = 'تعذرت معاينة الشهادة في هذا المتصفح.'; }
        if (ready) $('[data-center-status]').textContent = state.missing ? 'تغيّر كشف الفصل. أعد اختيار الطلاب قبل التصدير.'
          : !selected.size ? 'حدّد الطلاب الذين تريد تجهيز شهاداتهم.'
          : !certificateText(text) ? 'اكتب نص الشهادة لإتاحة التصدير.'
          : !state.valid ? 'تحقّق من أسماء الطلاب المحددين قبل التصدير.'
          : '';
        $('[data-center-status]').hidden = !$('[data-center-status]').textContent;
        syncButtons();
      };
      refreshMountedIdentity = () => {
        if (!root.isConnected) return;
        const next = currentIdentity();
        const nextPresentation = getAccountPresentation(store.state.profile?.teacherForm);
        let changed = nextPresentation.teacherSubjectLabel !== presentation.teacherSubjectLabel;
        for (const [key, value] of Object.entries(next)) {
          if (metadata[key] !== value) changed = true;
          metadata[key] = value;
          const field = $(`[data-center-meta="${key}"]`);
          if (field.value !== String(value)) field.value = value;
        }
        presentation = nextPresentation;
        $('[data-center-meta-label="teacherName"]').textContent = presentation.teacherNameLabel;
        $('[data-center-meta-label="principalName"]').textContent = presentation.principalNameLabel;
        if (changed) refresh();
      };
      root.addEventListener('change', event => {
        const target = event.target;
        if (target.matches('[data-center-teaching]')) {
          currentTeachingId = target.value; selected.clear(); honorsApplied = false; index = 0; query = ''; $('[data-center-search]').value = '';
        }
        else if (target.matches('[data-center-student]')) { target.checked ? selected.add(target.dataset.centerStudent) : selected.delete(target.dataset.centerStudent); honorsApplied = false; index = 0; }
        else return;
        renderRoster(); refresh();
      });
      root.addEventListener('input', event => {
        const target = event.target;
        if (target.matches('[data-center-search]')) { query = target.value.trim().toLocaleLowerCase('ar'); renderRoster(); }
        else if (target.matches('[data-center-text]')) { text = target.value; refresh(); }
        else if (target.matches('[data-center-meta]')) {
          editedMetadata.add(target.dataset.centerMeta);
          metadata[target.dataset.centerMeta] = target.value;
          refresh();
        }
      });
      root.addEventListener('click', async event => {
        const button = event.target.closest('button');
        if (!button) return;
        if (button.matches('[data-center-cancel]')) {
          if (!busy) return;
          exportCancelled = true;
          exportStatus.textContent = 'جارٍ إيقاف تجهيز بقية الملفات…';
          syncButtons();
          return;
        }
        if (busy) return;
        if (button.matches('[data-center-toggle-controls]')) {
          const hidden = root.classList.toggle('is-preview-only');
          $('.certificate-center__controls').hidden = hidden;
          button.setAttribute('aria-expanded', String(!hidden));
          button.querySelector('span').textContent = hidden ? 'إظهار الإعدادات' : 'إخفاء الإعدادات';
        }
        else if (button.matches('[data-center-tab]')) {
          root.querySelectorAll('[data-center-panel]').forEach(panel => { panel.hidden = panel.dataset.centerPanel !== button.dataset.centerTab; });
          root.querySelectorAll('[data-center-tab]').forEach(tab => tab.setAttribute('aria-pressed', String(tab === button)));
        }
        else if (button.matches('[data-center-honors]')) {
          const context = store.teachingContext(currentTeachingId);
          selected.clear();
          for (const student of roster()) {
            if (hasFullMarks(context.items, context.ctx[student.id], student.id)) selected.add(student.id);
          }
          honorsApplied = true; index = 0; query = ''; $('[data-center-search]').value = '';
          renderRoster(); refresh();
        }
        else if (button.matches('[data-center-clear]')) { selected.clear(); honorsApplied = false; index = 0; renderRoster(); refresh(); }
        else if (button.matches('[data-center-design]')) {
          design = button.dataset.centerDesign;
          root.querySelectorAll('[data-center-design]').forEach(item => { const active = item === button; item.classList.toggle('is-selected', active); item.setAttribute('aria-pressed', String(active)); });
          refresh();
        } else if (button.matches('[data-center-prev], [data-center-next]')) { index += button.matches('[data-center-prev]') ? -1 : 1; refresh(false); }
        else if (button.matches('[data-center-expand]')) {
          previewOpen = true; syncButtons();
          try { await openDocumentPreview({ title: 'معاينة شهادة التقدير', canvas, description: 'يمكنك التكبير أو ملاءمة الشهادة للشاشة.' }); }
          catch { toast('تعذّر فتح المعاينة الموسّعة', 'danger'); }
          finally { previewOpen = false; syncButtons(); if (root.isConnected) button.focus({ preventScroll: true }); }
        } else if (button.matches('[data-center-print], [data-center-download]')) {
          if (!ready || !selectionState().valid) { refresh(); return; }
          const outputRevision = revision;
          const selectedIds = [...selected];
          const outputEntries = selectionState().cards;
          const snapshotOptions = options();
          const fingerprint = JSON.stringify({ cards: outputEntries.map(entry => entry.card), options: snapshotOptions });
          const isCurrent = () => !exportCancelled && root.isConnected && revision === outputRevision && selectionState().valid
            && selectedIds.length === selected.size && selectedIds.every(id => selected.has(id))
            && fingerprint === JSON.stringify({ cards: selectionState().cards.map(entry => entry.card), options: options() });
          let prepared = 0;
          exportCancelled = false;
          exportFormat = button.matches('[data-center-print]') ? 'pdf' : 'png';
          busy = true; syncButtons();
          try {
            const files = outputEntries.map(({ card }) => ({ card, options: snapshotOptions }));
            const result = await downloadCertificates(files, {
              format: exportFormat, isCurrent,
              onProgress(progress) {
                prepared = progress.prepared;
                if (!root.isConnected) return;
                exportStatus.hidden = false;
                exportStatus.textContent = `جارٍ تجهيز الملفات: ${progress.prepared} من ${progress.total}`;
              },
            });
            if (root.isConnected) {
              exportStatus.textContent = result.cancelled
                ? `توقف التجهيز بعد ${result.prepared} من ${result.total} ملفات. يمكنك إعادة التصدير عند الاستعداد.`
                : result.total === 1 ? 'تم تجهيز ملف الشهادة للتنزيل.' : `تم تجهيز ${result.prepared} ملفات مستقلة للتنزيل، ملف لكل طالب.`;
              exportStatus.hidden = false;
              if (!result.cancelled) toast('تم تجهيز الشهادات للتنزيل', 'ok');
            }
          } catch {
            if (root.isConnected) {
              exportStatus.textContent = `تعذّر استكمال التجهيز. جُهّز ${prepared} من ${outputEntries.length} ملفات؛ حاول مجددًا.`;
              exportStatus.hidden = false;
              toast('تعذّر تجهيز بقية الشهادات — حاول مرة أخرى', 'danger');
            }
          }
          finally { busy = false; exportFormat = null; syncButtons(); }
        }
      });
      refreshMountedIdentity();
      renderRoster(); refresh();
      const renderThumbnails = () => {
        for (const thumbnail of root.querySelectorAll('[data-center-thumbnail]')) {
          const sample = document.createElement('canvas');
          try {
            drawAchievementCertificate(sample, certificateCard({ studentName: 'اسم الطالب', text: defaultCertificateText() }), {
              design: thumbnail.dataset.centerThumbnail,
              schoolName: '', educationDepartment: '', teacherName: '', principalName: '',
              teacherLabel: '', principalLabel: '', className: '', subjectName: '', dateLabel: '',
            });
            thumbnail.getContext('2d')?.drawImage(sample, 0, 0, 300, 212);
          } finally { sample.width = 1; sample.height = 1; }
        }
      };
      prepareCertificateAssets().then(() => {
        if (!root.isConnected) return;
        assetsReady = true;
        refresh(false);
        try { renderThumbnails(); } catch { /* The live certificate preview remains available. */ }
      }).catch(() => {
        if (!root.isConnected) return;
        assetsFailed = true;
        refresh(false);
      });
    },
  };
}
