/**
 * كشف الشعبة — إضافة الطلاب، ونقلهم، وخروجهم من المدرسة.
 *
 * الطالب هوية مستقلة؛ ما يُنشأ هنا هو **انتساب** إلى الشعبة. ولذلك النقل
 * لا يُنشئ طالبًا جديدًا، والخروج من المدرسة لا يحذف أحدًا.
 */

import { html, icon, openSheet, toast, fmtPct, fmtDateFull } from '../lib/dom.js';
import * as store from '../store.js';
import { studentTotal, masteryBand, absenceCount, ENROLLMENT_STATUS, todayISO, sectionLabel, normalizeSearchText } from '../models.js';
import { studentAvatar } from '../lib/avatar.js';
import { repaint } from '../repaint.js';
import { user } from '../lib/cloud.js';
import { readStudentFile, previewStudentRows, importContext, confirmStudentImport } from '../lib/student-import.js';

let query = '';
let formerOpen = false;

/* ---------- تحليل الأسماء الملصوقة ---------- */

export function parseNames(text) {
  const seen = new Set();
  const out = [];

  for (const line of String(text).split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const cols = trimmed.split(/\t|;|(?:\s*,\s*)/).map((c) => c.trim()).filter(Boolean);
    const isNumeric = (c) => /^[\d٠-٩]+$/.test(c);
    let name = cols.find((c) => !isNumeric(c)) ?? '';

    name = name.replace(/^[\d٠-٩]+\s*[-.)،:]\s*/, '');
    name = name.replace(/^[\d٠-٩]+\s+(?=\D)/, '');
    name = name.replace(/\s+/g, ' ').trim();

    if (name.length < 2) continue;
    const key = name.replace(/\s/g, '');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

/* ---------- اللوحات ---------- */

function fileImportSheet(secId) {
  let rows = null, preview = null, reading = 0;
  const labels = { new: 'جديد', existing: 'موجود', invalid: 'غير صالح', ambiguous: 'يحتاج مراجعة' };
  return openSheet({
    title: 'استيراد ملف الأسماء',
    desc: 'CSV بترميز UTF-8 أو Excel (.xlsx)، حتى 300 طالب و1 ميجابايت. يُقرأ الملف على جهازك فقط. في Excel تُقرأ الورقة الأولى.',
    body: html`
      <label class="field"><span class="field__label">اختر ملفًا</span>
        <input class="input" id="student-file" type="file" accept=".csv,.xlsx"></label>
      <div id="file-options" hidden>
        <label class="field"><span class="field__label">عمود اسم الطالب</span><select class="input" id="file-column"></select></label>
        <label class="field"><span><input id="file-header" type="checkbox" checked> الصف الأول عناوين أعمدة</span></label>
      </div>
      <p class="field__hint">سيُستورد عمود الأسماء فقط. لن تُطبّق الدرجات أو الأعمدة الأخرى.</p>
      <p class="field__hint">الأسماء الموجودة والمتكررة لن تُضاف. راجع الحالات المتشابهة يدويًا؛ يمكنك إضافة طالب مستقل من «طالب جديد».</p>
      <p id="file-count" role="status" aria-live="polite">اختر ملفًا لمعاينته قبل الإضافة.</p>
      <div id="file-preview" class="list"></div>
    `,
    foot: html`<button class="btn btn--ghost" data-sheet-close>إلغاء</button>
      <button class="btn btn--primary" id="file-confirm" disabled>تأكيد إضافة الأسماء الجديدة</button>`,
    onMount(root, done) {
      const input = root.querySelector('#student-file'), column = root.querySelector('#file-column');
      const header = root.querySelector('#file-header'), go = root.querySelector('#file-confirm');
      const count = root.querySelector('#file-count'), list = root.querySelector('#file-preview');
      const refresh = () => {
        preview = null;
        go.disabled = true;
        list.replaceChildren();
        if (!rows) return;
        try {
          preview = previewStudentRows(rows, Number(column.value), header.checked, store.sectionRoster(secId));
          count.textContent = Object.entries(preview.counts).map(([key, value]) => `${labels[key]}: ${value}`).join(' · ');
          for (const entry of preview.entries) {
            const row = document.createElement('div');
            row.className = 'row';
            row.textContent = `الصف ${entry.row} · ${entry.name || 'بلا اسم'} · ${labels[entry.status]}`;
            list.append(row);
          }
          go.disabled = !preview.names.length;
          go.textContent = `تأكيد إضافة ${preview.names.length} طالبًا جديدًا`;
        } catch {
          count.textContent = 'الحد الأقصى 300 طالب. راجع الملف وعناوين الأعمدة.';
        }
      };
      input.addEventListener('change', async () => {
        const ticket = ++reading;
        rows = null; refresh();
        root.querySelector('#file-options').hidden = true;
        const file = input.files[0];
        if (!file) { count.textContent = 'اختر ملفًا لمعاينته.'; return; }
        count.textContent = 'جارٍ قراءة الملف على جهازك…';
        try {
          const parsed = await readStudentFile(file);
          if (ticket !== reading || !root.isConnected) return;
          rows = parsed;
          column.replaceChildren();
          const width = Math.max(...rows.map((row) => row.length));
          for (let index = 0; index < width; index++) {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = `العمود ${index + 1} · ${String(rows[0][index] ?? '').slice(0, 80)}`;
            column.append(option);
          }
          const nameColumn = rows[0].findIndex((cell) => /^(اسم الطالب|الاسم|اسم|student name|name)$/i.test(String(cell ?? '').trim()));
          header.checked = nameColumn >= 0;
          column.value = String(Math.max(0, nameColumn));
          root.querySelector('#file-options').hidden = false;
          refresh();
        } catch {
          if (ticket !== reading || !root.isConnected) return;
          count.textContent = 'تعذّر قراءة الملف. استخدم CSV بترميز UTF-8 أو XLSX صالحًا ضمن الحدود، أو الصق الأسماء.';
        }
      });
      column.addEventListener('change', refresh);
      header.addEventListener('change', refresh);
      go.addEventListener('click', () => {
        if (go.disabled || !preview) return;
        go.disabled = true;
        done({ rows, column: Number(column.value), hasHeader: header.checked, preview });
      });
    },
  });
}

function importSheet(secId) {
  const existing = new Set(store.sectionRoster(secId).map((s) => s.name.replace(/\s/g, '')));

  return openSheet({
    title: 'لصق كشف الأسماء',
    desc: 'سطر لكل طالب. انسخ العمود من نور أو إكسل والصقه كما هو — يُنظّف الترقيم تلقائيًا.',
    body: html`
      <label class="field">
        <textarea class="textarea" id="names-box" rows="10" autocomplete="off"
          placeholder="عبدالله محمد الأحمدي&#10;سارة خالد&#10;نورة عبدالعزيز"></textarea>
        <div class="field__hint" id="names-count">لم يُلصق شيء بعد.</div>
      </label>
    `,
    foot: html`
      <button class="btn btn--ghost" data-sheet-close>إلغاء</button>
      <button class="btn btn--primary" id="names-go" disabled>أضف</button>
    `,
    onMount: (root, done) => {
      const box = root.querySelector('#names-box');
      const count = root.querySelector('#names-count');
      const go = root.querySelector('#names-go');

      const refresh = () => {
        const all = parseNames(box.value);
        const fresh = all.filter((n) => !existing.has(n.replace(/\s/g, '')));
        const dupes = all.length - fresh.length;

        go.disabled = fresh.length === 0;
        go.textContent = fresh.length ? `أضف ${fresh.length} طالبًا` : 'أضف';
        count.textContent = !box.value.trim()
          ? 'لم يُلصق شيء بعد.'
          : `${fresh.length} اسمًا جاهزًا` + (dupes ? ` · ${dupes} مكرّرًا سيُتجاهل` : '');
        go.dataset.payload = JSON.stringify(fresh);
      };

      box.addEventListener('input', refresh);
      go.addEventListener('click', () => done(JSON.parse(go.dataset.payload ?? '[]')));
      box.focus();
    },
  });
}

export function transferSheet(student, fromSectionId) {
  const others = store.sections().filter((s) => s.id !== fromSectionId);

  return openSheet({
    title: `نقل ${student.name}`,
    desc: 'يبقى الطالب نفسه بهويته وتاريخه — يُنهى انتسابه هنا ويُفتح هناك.',
    body: others.length
      ? html`
          <div class="stack stack-2">
            ${others.map(
              (s) => html`
                <button class="radiocard radiocard--btn" data-pick="${s.id}">
                  <span class="radiocard__body">
                    <span class="radiocard__title">${sectionLabel(s) || ''}</span>
                    <span class="radiocard__hint">
                      <span class="tabular">${store.sectionRoster(s.id).length}</span> طالبًا
                    </span>
                  </span>
                </button>
              `
            )}
          </div>
          <label class="field mt-4">
            <span class="field__label">ملاحظة (اختياري)</span>
            <input class="input" id="tr-note" maxlength="120" placeholder="سبب النقل">
          </label>
        `
      : html`<p class="t-3 fs-md center">لا توجد شعبة أخرى في هذه السنة. أنشئ شعبة ثانية أولًا.</p>`,
    onMount: (root, done) => {
      const note = root.querySelector('#tr-note');
      root.querySelectorAll('[data-pick]').forEach((b) =>
        b.addEventListener('click', () => done({ sectionId: b.dataset.pick, note: note?.value.trim() ?? '' }))
      );
    },
  });
}

/* ---------- الشاشة ---------- */

export default {
  title: () => 'الطلاب',
  subtitle: (p) => {
    const tch = store.getTeaching(p.id);
    return sectionLabel(store.getSection(tch?.sectionId)) || '';
  },
  back: (p) => `#/teaching/${p.id}`,

  topActions: () => html`
    <button class="btn btn--ghost" data-act="file-import" aria-label="استيراد ملف الأسماء">${icon('upload')} استيراد ملف</button>
    <button class="iconbtn" data-act="import" aria-label="لصق كشف">${icon('upload')}</button>
    <button class="iconbtn" data-act="add" aria-label="طالب جديد">${icon('plus')}</button>
  `,

  onMount() {
    query = '';
    formerOpen = false;
  },

  onUnmount() {
    formerOpen = false;
  },

  afterPaint(root) {
    root.querySelector('.former-students-section')?.addEventListener('toggle', (event) => {
      formerOpen = event.currentTarget.open;
    });
  },

  render(p) {
    const tch = store.getTeaching(p.id);
    if (!tch) return html`<div class="empty"><div class="empty__title">فصل غير موجود</div></div>`;
    if (store.isTeachingArchived(tch)) return html`<div class="empty"><div class="empty__title">الفصل مؤرشف</div><div class="empty__text">كشف الطلاب محفوظ للعرض التاريخي ولا يقبل تعديلات تشغيلية.</div></div>`;
    const section = store.getSection(tch.sectionId);

    const { roster, items, ctx } = store.teachingContext(tch.id);

    if (!roster.length) {
      return html`
        <div class="management-page students-roster-page">
        <div class="empty management-empty">
          <div class="empty__icon">${icon('student')}</div>
          <div class="empty__title">لا طلاب في ${sectionLabel(section) || 'الشعبة'}</div>
          <div class="empty__text">أسرع طريق: انسخ عمود الأسماء من كشفك والصقه هنا دفعة واحدة.</div>
          <div class="btn-row" style="justify-content:center">
            <button class="btn btn--ghost" data-act="file-import">${icon('upload')} استيراد ملف</button>
            <button class="btn btn--primary" data-act="import">${icon('upload')} لصق كشف الأسماء</button>
            <button class="btn btn--ghost" data-act="add">${icon('plus')} طالب واحد</button>
          </div>
        </div>
        </div>
      `;
    }

    const q = normalizeSearchText(query);
    const shown = q ? roster.filter((s) => normalizeSearchText(s.name).includes(q) ||
      (s.rollNo != null && normalizeSearchText(s.rollNo).includes(q))) : roster;
    const former = store
      .enrollmentsIn(section.id)
      .filter((e) => e.status !== 'active')
      .map((e) => ({ e, s: store.getStudent(e.studentId) }))
      .filter((x) => x.s);

    return html`
      <div class="management-page students-roster-page">
      <div class="management-toolbar roster-toolbar">
      <div class="searchbar roster-search">
        ${icon('search')}
        <input class="searchbar__input" type="search" data-input="search" data-fk="student-search"
               value="${query}" placeholder="ابحث بالاسم أو رقم الكشف" autocomplete="off" aria-label="بحث الطلاب">
        ${q ? html`<button type="button" class="iconbtn" data-act="clear-search" aria-label="مسح البحث">${icon('x')}</button>` : ''}
      </div>

      <div class="roster-summary t-3 fs-sm" aria-live="polite">
        <span><span class="tabular fw-7">${shown.length}</span> من <span class="tabular fw-7">${roster.length}</span> طالبًا</span>
      </div>
      </div>

      ${shown.length === 0
        ? html`<div class="empty"><div class="empty__text">لا نتيجة لبحثك.</div></div>`
        : html`
            <div class="list roster-list">
              ${shown.map((s) => {
                const t = studentTotal(items, ctx[s.id]);
                const band = masteryBand(t.pct);
                const absents = absenceCount(ctx[s.id].attendance);
                return html`
                  <div class="row roster-row">
                    <span class="rollno" aria-label="رقم الكشف ${s.rollNo ?? 'غير محدد'}">${s.rollNo ?? '—'}</span>
                    ${studentAvatar(s, 'sm')}
                    <a class="row__main" href="#/student/${s.id}?teaching=${tch.id}">
                      <span class="row__title">${s.name}</span>
                      <span class="row__sub">
                        ${t.pct === null
                          ? 'لم تُرصد له درجات بعد'
                          : html`<span class="tabular">${fmtPct(t.pct)}</span> من المرصود`}
                        ${absents ? html` · <span class="tabular">${absents}</span> غياب` : ''}
                      </span>
                    </a>
                    <span class="row__end">
                      ${band.badge ? html`<span class="badge ${band.badge}">${band.label}</span>` : ''}
                      <button class="iconbtn" data-act="edit" data-id="${s.id}" aria-label="تعديل ${s.name}">
                        ${icon('edit')}
                      </button>
                    </span>
                  </div>
                `;
              })}
            </div>
          `}

      ${former.length
        ? html`
            <details class="section former-students-section" ${formerOpen ? 'open' : ''}>
              <summary class="former-students-section__summary">
                <span>طلاب غادروا هذا الفصل</span>
                <span class="former-students-section__count tabular">${former.length}</span>
                <span class="former-students-section__chev" aria-hidden="true">${icon('chev')}</span>
              </summary>
              <div class="list">
                ${former.map(
                  ({ e, s }) => html`
                    <a class="row" href="#/student/${s.id}">
                      <span class="rollno">${e.rollNo ?? '—'}</span>
                      ${studentAvatar(s, 'sm')}
                      <span class="row__main">
                        <span class="row__title">${s.name}</span>
                        <span class="row__sub">
                          ${ENROLLMENT_STATUS[e.status] ?? e.status}
                          ${e.endDate ? html` · ${fmtDateFull(e.endDate)}` : ''}
                          ${e.transferNote ? html` · ${e.transferNote}` : ''}
                        </span>
                      </span>
                      <span class="row__end">${icon('chev')}</span>
                    </a>
                  `
                )}
              </div>
              <p class="t-3 fs-sm mt-3">
                سجلّهم محفوظ كاملًا، ودرجاتهم في هذا الفصل تبقى في التقارير التاريخية.
              </p>
            </details>
          `
        : ''}

      <button class="fab" data-act="import">${icon('upload')} لصق كشف</button>
      </div>
    `;
  },

  actions: {
    async 'file-import'(el, ev, params) {
      const teaching = store.getTeaching(params.id);
      if (!teaching || store.isTeachingArchived(teaching)) return;
      const expectedContext = importContext(store.getActiveWorkspace(), teaching, user?.id);
      if (!expectedContext) { toast('تحقق من الحساب قبل الاستيراد.', 'danger'); return; }
      const data = await fileImportSheet(teaching.sectionId);
      if (!data) return;
      const current = store.getTeaching(params.id);
      const currentContext = current && !store.isTeachingArchived(current) ? importContext(store.getActiveWorkspace(), current, user?.id) : null;
      if (currentContext !== expectedContext) { toast('تغيّر الحساب أو الفصل. افتح المعاينة من جديد.', 'danger'); return; }
      try {
        const currentPreview = previewStudentRows(data.rows, data.column, data.hasHeader, store.sectionRoster(teaching.sectionId));
        const before = store.sectionRoster(teaching.sectionId).length;
        const result = await confirmStudentImport({ approved: true, preview: data.preview, currentPreview, expectedContext, currentContext,
          write: async (names) => {
            const controller = new AbortController();
            const stop = store.onWorkspaceDeactivation(() => controller.abort());
            try {
              return await store.importStudents(teaching.sectionId, names, { signal: controller.signal, verifyCurrent(snapshot) {
                const persistedTeaching = snapshot.teachings.find((row) => row.id === teaching.id);
                if (importContext(store.getActiveWorkspace(), persistedTeaching, user?.id) !== expectedContext) throw new Error('IMPORT_CHANGED');
                const activeIds = new Set(snapshot.enrollments.filter((row) => row.sectionId === teaching.sectionId && row.status === 'active' && !row.deleted).map((row) => row.studentId));
                const roster = snapshot.students.filter((row) => activeIds.has(row.id) && !row.deleted);
                const persistedPreview = previewStudentRows(data.rows, data.column, data.hasHeader, roster);
                if (JSON.stringify(data.preview.entries) !== JSON.stringify(persistedPreview.entries)) throw new Error('IMPORT_CHANGED');
              } });
            } finally { stop(); }
          } });
        if (store.sectionRoster(teaching.sectionId).length - before !== result.added) {
          toast('لم يُحفظ الاستيراد. راجع الكشف ثم أعد المحاولة.', 'danger'); return;
        }
        toast(`أُضيف ${result.added} طالبًا. لم تُطبّق درجات.`);
      } catch {
        toast('تعذّر الاستيراد بأمان أو تغيّر الكشف. راجع المعاينة من جديد.', 'danger');
      }
    },
    search(el) {
      query = el.value;
      repaint();
    },

    'clear-search'() {
      query = '';
      repaint();
    },

    async import(el, ev, params) {
      const tch = store.getTeaching(params.id);
      if (!tch) return;
      const names = await importSheet(tch.sectionId);
      if (!names?.length) return;
      const r = await store.importStudents(tch.sectionId, names);
      const extra = [
        r.skippedInvalid ? `${r.skippedInvalid} اسمًا غير صالح` : '',
        r.skippedOverLimit ? `${r.skippedOverLimit} تجاوزت حد ${store.LIMITS.importMaxRows}` : '',
      ].filter(Boolean).join(' · ');
      toast(`أُضيف ${r.added} طالبًا${extra ? ' — تُجوهل ' + extra : ''}`);
    },

    async add(el, ev, params) {
      const tch = store.getTeaching(params.id);
      if (!tch) return;

      const data = await openSheet({
        title: 'طالب جديد',
        body: html`
          <form id="new-student">
            <label class="field">
              <span class="field__label">الاسم</span>
              <input class="input" name="name" required maxlength="80" autocomplete="off"
                     placeholder="الاسم الثلاثي">
            </label>
          </form>
        `,
        foot: html`
          <button class="btn btn--ghost" data-sheet-close>إلغاء</button>
          <button class="btn btn--primary" form="new-student" type="submit">إضافة</button>
        `,
        onMount: (root, done) => {
          root.querySelector('#new-student').addEventListener('submit', (e) => {
            e.preventDefault();
            const name = String(new FormData(e.target).get('name') ?? '').trim();
            if (name) done({ name });
          });
        },
      });

      if (!data) return;
      const added = await store.addStudent(tch.sectionId, data.name);
      toast(added ? 'أُضيف الطالب' : 'الاسم غير صالح', added ? 'ok' : 'danger');
    },

    async edit(el, ev, params) {
      const tch = store.getTeaching(params.id);
      const s = store.getStudent(el.dataset.id);
      if (!s || !tch) return;
      const en = store.activeEnrollment(s.id);

      const data = await openSheet({
        title: 'تعديل الطالب',
        body: html`
          <form id="edit-student">
            <label class="field">
              <span class="field__label">الاسم</span>
              <input class="input" name="name" value="${s.name}" required maxlength="80" autocomplete="off">
            </label>
            <label class="field">
              <span class="field__label">رقم الكشف</span>
              <input class="input tabular" name="rollNo" type="number" inputmode="numeric"
                     min="1" max="999" value="${en?.rollNo ?? ''}">
              <span class="field__hint">رقم الكشف يخص انتساب الطالب لهذه الشعبة.</span>
            </label>

          </form>
        `,
        foot: html`
          <button class="btn btn--ghost" id="btn-transfer">${icon('picker')} نقل</button>
          <button class="btn btn--primary" form="edit-student" type="submit">حفظ</button>
        `,
        onMount: (root, done) => {
          root.querySelector('#edit-student').addEventListener('submit', (e) => {
            e.preventDefault();
            const fd = new FormData(e.target);
            const name = String(fd.get('name') ?? '').trim();
            if (!name) return;
            const roll = String(fd.get('rollNo') ?? '').trim();
            done({ name, rollNo: roll ? Number(roll) : null });
          });
          root.querySelector('#btn-transfer').addEventListener('click', () => done({ __transfer: true }));
        },
      });

      if (!data) return;

      if (data.__transfer) {
        const target = await transferSheet(s, tch.sectionId);
        if (!target?.sectionId) return;
        const moved = await store.transferStudent(s.id, target.sectionId, { note: target.note });
        if (!moved) {
          toast('تعذّر نقل الطالب بأمان. تحقق من كشف الشعبة ثم أعد المحاولة.', 'danger');
          return;
        }
        const to = store.getSection(target.sectionId);
        toast(`نُقل ${s.name} إلى ${to ? store.sectionLabel(to) : 'الشعبة الجديدة'}`);
        return;
      }

      const renamed = await store.renameStudent(s.id, data.name);
      if (!renamed) {
        toast('الاسم غير صالح', 'danger');
        return;
      }

      if (en && data.rollNo !== en.rollNo) {
        const res = await store.setRollNo(en.id, data.rollNo);
        if (!res.ok) {
          toast(
            res.reason === 'duplicate'
              ? `رقم الكشف ${data.rollNo} مأخوذ في هذه الشعبة`
              : 'رقم الكشف خارج النطاق',
            'danger'
          );
          return;
        }
      }
      toast('حُفظ');
    },

  },
};
