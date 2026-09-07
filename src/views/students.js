/**
 * كشف الشعبة — إضافة الطلاب، ونقلهم، وخروجهم من المدرسة.
 *
 * الطالب هوية مستقلة؛ ما يُنشأ هنا هو **انتساب** إلى الشعبة. ولذلك النقل
 * لا يُنشئ طالبًا جديدًا، والخروج من المدرسة لا يحذف أحدًا.
 */

import { html, icon, openSheet, toast, fmtPct } from '../lib/dom.js';
import * as store from '../store.js';
import { studentTotal, masteryBand, absenceCount, ENROLLMENT_STATUS, todayISO, sectionLabel, normalizeSearchText } from '../models.js';
import { studentAvatar } from '../lib/avatar.js';
import { repaint } from '../repaint.js';

let query = '';

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

function transferSheet(student, fromSectionId) {
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
    <button class="iconbtn" data-act="import" aria-label="لصق كشف">${icon('upload')}</button>
    <button class="iconbtn" data-act="add" aria-label="طالب جديد">${icon('plus')}</button>
  `,

  onMount() {
    query = '';
  },

  render(p) {
    const tch = store.getTeaching(p.id);
    if (!tch) return html`<div class="empty"><div class="empty__title">فصل غير موجود</div></div>`;
    const section = store.getSection(tch.sectionId);

    const { roster, items, ctx } = store.teachingContext(tch.id);

    if (!roster.length) {
      return html`
        <div class="empty">
          <div class="empty__icon">${icon('student')}</div>
          <div class="empty__title">لا طلاب في ${sectionLabel(section) || 'الشعبة'}</div>
          <div class="empty__text">أسرع طريق: انسخ عمود الأسماء من كشفك والصقه هنا دفعة واحدة.</div>
          <div class="btn-row" style="justify-content:center">
            <button class="btn btn--primary" data-act="import">${icon('upload')} لصق كشف الأسماء</button>
            <button class="btn btn--ghost" data-act="add">${icon('plus')} طالب واحد</button>
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
      <div class="searchbar">
        ${icon('search')}
        <input class="searchbar__input" type="search" data-input="search" data-fk="student-search"
               value="${query}" placeholder="ابحث باسم طالب" autocomplete="off">
        ${q ? html`<button class="iconbtn" data-act="clear-search" aria-label="مسح">${icon('x')}</button>` : ''}
      </div>

      <div class="hstack gap-2 wrap mb-3 t-3 fs-sm">
        <span><span class="tabular fw-7">${roster.length}</span> طالبًا</span>
      </div>

      ${shown.length === 0
        ? html`<div class="empty"><div class="empty__text">لا نتيجة لبحثك.</div></div>`
        : html`
            <div class="list">
              ${shown.map((s) => {
                const t = studentTotal(items, ctx[s.id]);
                const band = masteryBand(t.pct);
                const absents = absenceCount(ctx[s.id].attendance);
                return html`
                  <div class="row">
                    <span class="rollno">${s.rollNo ?? '—'}</span>
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
            <div class="section">
              <div class="section__head"><div class="section__title">غادروا هذه الشعبة</div></div>
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
                          ${e.endDate ? html` · ${e.endDate}` : ''}
                          ${e.transferNote ? html` · ${e.transferNote}` : ''}
                        </span>
                      </span>
                      <span class="row__end">${icon('chev')}</span>
                    </a>
                  `
                )}
              </div>
              <p class="t-3 fs-sm mt-3">
                سجلّهم محفوظ كاملًا، ودرجاتهم في هذا الإسناد تبقى في التقارير التاريخية.
              </p>
            </div>
          `
        : ''}

      <button class="fab" data-act="import">${icon('upload')} لصق كشف</button>
    `;
  },

  actions: {
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
