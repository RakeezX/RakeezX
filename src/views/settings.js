/** الإعدادات: بيانات المعلّم، والسنوات والفصول الدراسية، والمظهر، والبيانات. */

import { html, icon, openSheet, confirmSheet, toast } from '../lib/dom.js';
import * as store from '../store.js';
import * as cloud from '../lib/cloud.js';
import * as sync from '../lib/sync.js';
import { repaint } from '../repaint.js';
import { makeYear, makeTerm, YEAR_STATUS, TERM_STATUS, TERM_NAMES, termIndexes } from '../models.js';

const THEMES = [
  { v: 'auto',  label: 'حسب النظام', icon: 'settings' },
  { v: 'light', label: 'فاتح',       icon: 'sun' },
  { v: 'dark',  label: 'داكن',       icon: 'moon' },
];

function yearSheet(existing = null) {
  const y = existing ?? { hijriStart: 1448 };
  return openSheet({
    title: existing ? 'تعديل السنة' : 'سنة دراسية جديدة',
    body: html`
      <form id="year-form">
        <label class="field">
          <span class="field__label">بداية السنة الهجرية</span>
          <input class="input tabular" name="hijriStart" type="number" min="1300" max="1600"
                 value="${y.hijriStart || 1448}" required ${existing ? 'readonly' : ''}>
          <span class="field__hint">تُسمّى السنة تلقائيًا، مثل ١٤٤٨-١٤٤٩.</span>
        </label>
        ${existing
          ? html`
              <div class="field">
                <span class="field__label">الحالة</span>
                <div class="segmented">
                  ${Object.entries(YEAR_STATUS).map(
                    ([k, label]) => html`
                      <label class="segmented__btn ${y.status === k ? 'is-on' : ''}">
                        <input type="radio" name="status" value="${k}" ${y.status === k ? 'checked' : ''} hidden>
                        ${label}
                      </label>
                    `
                  )}
                </div>
                <span class="field__hint">السنة المؤرشفة تبقى كاملة للعرض ولا تُعدَّل بالخطأ.</span>
              </div>
            `
          : ''}
      </form>
    `,
    foot: html`
      <button class="btn btn--ghost" data-sheet-close>إلغاء</button>
      <button class="btn btn--primary" form="year-form" type="submit">حفظ</button>
    `,
    onMount: (root, done) => {
      root.querySelectorAll('.segmented__btn').forEach((b) =>
        b.addEventListener('click', () => {
          root.querySelectorAll('.segmented__btn').forEach((x) => x.classList.remove('is-on'));
          b.classList.add('is-on');
          b.querySelector('input').checked = true;
        })
      );
      root.querySelector('#year-form').addEventListener('submit', (ev) => {
        ev.preventDefault();
        const fd = new FormData(ev.target);
        done({
          hijriStart: Number(fd.get('hijriStart')),
          status: String(fd.get('status') ?? 'active'),
        });
      });
    },
  });
}

function termSheet(existing = null, yearId = null) {
  const t = existing ?? { name: 'الفصل الدراسي الثاني', index: 2, startDate: '', endDate: '', status: 'active' };
  return openSheet({
    title: existing ? 'تعديل الفصل الدراسي' : 'فصل دراسي جديد',
    body: html`
      <form id="term-form">
        <div class="field-row">
          <label class="field">
            <span class="field__label">الاسم</span>
            <input class="input" name="name" value="${t.name}" required maxlength="60" autocomplete="off">
          </label>
          <label class="field">
            <span class="field__label">الترتيب</span>
            <select class="select" name="index">
              ${termIndexes().map(
                (i) => html`<option value="${i}" ${Number(t.index) === i ? 'selected' : ''}>${i}</option>`
              )}
            </select>
          </label>
        </div>
        <div class="field-row">
          <label class="field">
            <span class="field__label">تاريخ البداية</span>
            <input class="input tabular" name="startDate" type="date" value="${t.startDate ?? ''}">
          </label>
          <label class="field">
            <span class="field__label">تاريخ النهاية</span>
            <input class="input tabular" name="endDate" type="date" value="${t.endDate ?? ''}">
          </label>
        </div>
        <div class="field" style="margin-bottom:0">
          <span class="field__label">الحالة</span>
          <select class="select" name="status">
            ${Object.entries(TERM_STATUS).map(
              ([k, label]) => html`<option value="${k}" ${t.status === k ? 'selected' : ''}>${label}</option>`
            )}
          </select>
          <span class="field__hint">الفصل المنتهي يبقى للعرض ولا تُعدَّل بياناته بالخطأ.</span>
        </div>
      </form>
    `,
    foot: html`
      <button class="btn btn--ghost" data-sheet-close>إلغاء</button>
      <button class="btn btn--primary" form="term-form" type="submit">حفظ</button>
    `,
    onMount: (root, done) => {
      root.querySelector('#term-form').addEventListener('submit', (ev) => {
        ev.preventDefault();
        const fd = new FormData(ev.target);
        const name = String(fd.get('name') ?? '').trim();
        if (!name) return;
        done({
          name,
          index: Number(fd.get('index')),
          startDate: String(fd.get('startDate') ?? '') || null,
          endDate: String(fd.get('endDate') ?? '') || null,
          status: String(fd.get('status') ?? 'active'),
        });
      });
    },
  });
}

function renderResultPanel(title, result) {
  if (!result) return '';
  const rawData = encodeURIComponent(JSON.stringify({ title, ...result }));

  return html`
    <div class="t-3 fs-sm" style="padding: var(--sp-2); border-radius: var(--r-sm); background: var(--bg-sunk); margin-top: -var(--sp-2); position: relative;">
      <button class="btn btn--sm btn--ghost" data-act="copy-result" data-payload="${rawData}" style="position: absolute; top: 4px; left: 4px; padding: 2px 6px; font-size: 11px;">
        نسخ النتيجة
      </button>
      ${result.status === 'success' ? html`
        <div style="color: var(--brand); font-weight: bold; margin-top: 16px;">نجاح</div>
        <div>آخر مزامنة: ${new Date(result.time).toLocaleTimeString('ar-SA')}</div>
        ${result.stats ? html`
          <div style="margin-top: var(--sp-1); display: grid; grid-template-columns: 1fr auto; gap: 4px; font-size: 13px;">
            ${Object.entries(result.stats).map(([k, v]) => html`
              <span>${k}:</span>
              <span>${v.pushed} ↑ / ${v.pulled} ↓</span>
            `)}
          </div>
        ` : ''}
      ` : result.status === 'error' ? html`
        <div style="color: var(--danger); font-weight: bold; margin-top: 16px;">خطأ</div>
        <div>الرسالة: ${result.error}</div>
      ` : html`
        <div style="max-height: 400px; overflow-y: auto; white-space: pre-wrap; direction: ltr; text-align: left; font-family: monospace; margin-top: 24px;">
          ${result.text}
        </div>
      `}
    </div>
  `;
}

export default {
  title: () => 'الإعدادات',

  render() {
    const m = { ...(store.state.profile ?? {}), ...(store.state.device ?? {}) };
    const yrs = store.years();
    const activeY = store.activeYear();
    const activeT = store.activeTerm();

    return html`
      <div class="section">
        <div class="section__head"><div class="section__title">بياناتك</div></div>
        <div class="card card--pad">
          <p class="t-3 fs-sm mb-3">
            تظهر على التقارير والكشوف التي تطبعها. تُحفظ على جهازك ولا تُرسل لأحد.
          </p>
          <form id="me-form">
            <label class="field">
              <span class="field__label">اسمك</span>
              <input class="input" name="teacherName" value="${m.teacherName ?? ''}"
                     maxlength="60" autocomplete="name" data-fk="teacherName"
                     data-change="save" placeholder="الاسم كما يظهر في التقارير">
            </label>
            <label class="field" style="margin-bottom:0">
              <span class="field__label">المدرسة</span>
              <input class="input" name="schoolName" value="${m.schoolName ?? ''}"
                     maxlength="80" autocomplete="off" data-fk="schoolName"
                     data-change="save" placeholder="اسم المدرسة">
            </label>
          </form>
        </div>
      </div>

      <div class="section">
        <div class="section__head">
          <div class="section__title">السنوات الدراسية</div>
          <button class="btn btn--sm btn--quiet" data-act="add-year">${icon('plus')} سنة جديدة</button>
        </div>
        <div class="stack stack-3">
          ${yrs.map((y) => {
            const terms = store.termsOf(y.id);
            return html`
              <div class="card card--pad ${y.status === 'archived' ? 'is-archived' : ''}">
                <div class="hstack gap-2">
                  <div>
                    <div class="fw-7">${y.label}</div>
                    <div class="t-3 fs-sm">
                      ${YEAR_STATUS[y.status] ?? y.status} ·
                      <span class="tabular">${terms.length}</span> فصلًا دراسيًا
                    </div>
                  </div>
                  <div class="push hstack gap-1">
                    ${y.id === activeY?.id
                      ? html`<span class="badge badge--brand">الحالية</span>`
                      : html`<button class="btn btn--sm btn--ghost" data-act="use-year" data-id="${y.id}">اجعلها الحالية</button>`}
                    <button class="iconbtn" data-act="edit-year" data-id="${y.id}" aria-label="تعديل">${icon('edit')}</button>
                  </div>
                </div>

                <div class="list mt-3">
                  ${terms.map(
                    (t) => html`
                      <div class="row">
                        <span class="period">${t.index}</span>
                        <span class="row__main">
                          <span class="row__title">${t.name}</span>
                          <span class="row__sub">
                            ${TERM_STATUS[t.status] ?? t.status}
                            ${t.startDate && t.endDate
                              ? html` · <span class="tabular">${t.startDate}</span> ← <span class="tabular">${t.endDate}</span>`
                              : ' · التواريخ غير مُدخلة'}
                            · <span class="tabular">${store.teachings(t.id).length}</span> فصلًا
                          </span>
                        </span>
                        <span class="row__end">
                          ${t.id === activeT?.id
                            ? html`<span class="badge badge--brand">الحالي</span>`
                            : html`<button class="btn btn--sm btn--ghost" data-act="use-term" data-id="${t.id}">اجعله الحالي</button>`}
                          <button class="iconbtn" data-act="edit-term" data-id="${t.id}" aria-label="تعديل">${icon('edit')}</button>
                        </span>
                      </div>
                    `
                  )}
                </div>
                <button class="btn btn--sm btn--quiet btn--block mt-3" data-act="add-term" data-year="${y.id}">
                  ${icon('plus')} فصل دراسي في ${y.label}
                </button>
              </div>
            `;
          })}
        </div>
        <p class="t-3 fs-sm mt-3">
          عدد الفصول مرن — سنة بفصلين أو ثلاثة، والتطبيق لا يفترض رقمًا ثابتًا.
          والسنة المؤرشفة تبقى كاملة ويمكن الرجوع إليها.
        </p>
      </div>

      <div class="section">
        <div class="section__head"><div class="section__title">المظهر</div></div>
        <div class="segmented">
          ${THEMES.map(
            (t) => html`
              <button class="segmented__btn ${(m.theme ?? 'auto') === t.v ? 'is-on' : ''}"
                      data-act="theme" data-theme="${t.v}">
                ${icon(t.icon)} ${t.label}
              </button>
            `
          )}
        </div>
      </div>

      <div class="section">
        <div class="section__head"><div class="section__title">البيانات</div></div>
        <a class="row" href="#/settings/backup">
          <span class="row__icon">${icon('download')}</span>
          <span class="row__main">
            <span class="row__title">البيانات والنسخ الاحتياطي</span>
            <span class="row__sub">صدّر سجلّك كله في ملف، أو استرجع نسخة سابقة</span>
          </span>
          <span class="row__end">${icon('chev')}</span>
        </a>
      </div>

      <div class="section">
        <div class="section__head"><div class="section__title">المزامنة السحابية (تجريبي)</div></div>
        <div class="card card--pad stack stack-3">
          ${cloud.session ? html`
            <div class="hstack gap-2">
              <div class="fw-7">متصل بحساب</div>
              <div class="t-3 fs-sm" style="direction: ltr; text-align: right;">${cloud.user?.email}</div>
              <div class="push">
                <button class="btn btn--sm btn--ghost" data-act="cloud-out">تسجيل الخروج</button>
              </div>
            </div>

            <div class="t-3 fs-sm hstack gap-2">
              <div>الحالة: ${sync.state.status === 'syncing' ? 'جاري المزامنة...' : 'جاهز'}</div>
            </div>

            <button class="btn btn--quiet btn--block" data-act="sync-now" ${sync.state.status === 'syncing' ? 'disabled' : ''}>
              ${icon('spark')} اختبار المزامنة (Profile)
            </button>
            ${renderResultPanel('اختبار المزامنة (Profile)', sync.state.results.profile)}

            <button class="btn btn--quiet btn--block" data-act="sync-structural" ${sync.state.status === 'syncing' ? 'disabled' : ''}>
              ${icon('spark')} اختبار المزامنة الهيكلية
            </button>
            ${renderResultPanel('اختبار المزامنة الهيكلية', sync.state.results.structural)}

            <button class="btn btn--quiet btn--block" data-act="sync-students" ${sync.state.status === 'syncing' ? 'disabled' : ''}>
              ${icon('spark')} اختبار مزامنة الطلاب والانتساب
            </button>
            ${renderResultPanel('اختبار مزامنة الطلاب والانتساب', sync.state.results.students)}

            <button class="btn btn--quiet btn--block" data-act="cloud-diagnostic" ${sync.state.status === 'syncing' ? 'disabled' : ''}>
              ${icon('spark')} عرض تشخيص بيانات الاختبار
            </button>
            ${renderResultPanel('عرض تشخيص بيانات الاختبار', sync.state.results.diagnostic)}
          ` : html`
            <form id="cloud-login-form" data-act="cloud-in">
              <label class="field">
                <span class="field__label">البريد الإلكتروني</span>
                <input class="input" name="email" type="email" required autocomplete="email" dir="ltr">
              </label>
              <label class="field">
                <span class="field__label">كلمة المرور</span>
                <input class="input" name="password" type="password" required autocomplete="current-password" dir="ltr">
              </label>
              <button class="btn btn--primary btn--block mt-3" type="submit">تسجيل الدخول</button>
            </form>
          `}
        </div>
      </div>

      <div class="section">
        <div class="section__head"><div class="section__title">عن RAKEEZ X</div></div>
        <div class="card card--pad t-3 fs-sm stack stack-2">
          <div>سجل معلّم يعمل كاملًا دون إنترنت. كل ما ترصده محفوظ على جهازك وحده.</div>
          <div>لا حسابات، ولا إعلانات، ولا تتبّع، ولا إرسال لأي خادم.</div>
          <div class="t-3">RAKEEZ X · النسخة ١٫٠ · الموجة الأولى</div>
        </div>
      </div>
    `;
  },

  actions: {
    async 'copy-result'(el) {
      const payload = JSON.parse(decodeURIComponent(el.dataset.payload));
      let text = `--- ${payload.title} ---\n`;
      if (payload.status === 'success') {
        text += `الحالة: نجاح\n`;
        text += `آخر مزامنة: ${new Date(payload.time).toLocaleTimeString('ar-SA')}\n`;
        if (payload.stats) {
          for (const [k, v] of Object.entries(payload.stats)) {
            text += `${k}: ${v.pushed} ↑ / ${v.pulled} ↓\n`;
          }
        }
      } else if (payload.status === 'error') {
        text += `الحالة: خطأ\n`;
        text += `الرسالة: ${payload.error}\n`;
      } else if (payload.text) {
        text += payload.text;
      }

      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(text);
        } else {
          const textArea = document.createElement('textarea');
          textArea.value = text;
          textArea.style.position = 'fixed';
          textArea.style.opacity = '0';
          document.body.appendChild(textArea);
          textArea.focus();
          textArea.select();
          document.execCommand('copy');
          document.body.removeChild(textArea);
        }
        toast('تم نسخ النتيجة');
      } catch (err) {
        toast('تعذر النسخ', 'danger');
      }
    },

    async 'cloud-in'(el, ev) {
      ev.preventDefault();
      const fd = new FormData(el);
      const email = fd.get('email');
      const pwd = fd.get('password');
      if (!email || !pwd) return;
      const btn = el.querySelector('button[type="submit"]');
      const prev = btn.textContent;
      try {
        btn.textContent = 'جارٍ الاتصال...';
        btn.disabled = true;
        await cloud.signIn(email, pwd);
        toast('تم تسجيل الدخول بنجاح');
      } catch (err) {
        btn.textContent = prev;
        btn.disabled = false;
        toast(err.message, 'danger');
      }
    },

    async 'cloud-out'() {
      await cloud.signOut();
      toast('تم تسجيل الخروج');
    },

    async 'sync-now'(el) {
      if (sync.state.status === 'syncing') return;
      await sync.syncProfile();
      if (sync.state.results.profile?.status === 'error') {
        toast('تعذرت المزامنة', 'danger');
      } else {
        toast('تمت المزامنة بنجاح');
      }
    },

    async 'sync-structural'(el) {
      if (sync.state.status === 'syncing') return;
      await sync.syncStructural();
      if (sync.state.results.structural?.status === 'error') {
        toast('تعذرت المزامنة الهيكلية', 'danger');
      } else {
        toast('تمت المزامنة الهيكلية بنجاح');
      }
    },

    async 'sync-students'(el) {
      if (sync.state.status === 'syncing') return;
      await sync.syncStudents();
      if (sync.state.results.students?.status === 'error') {
        toast('تعذرت مزامنة الطلاب والانتساب', 'danger');
      } else {
        toast('تمت مزامنة الطلاب والانتساب بنجاح');
      }
    },

    async 'cloud-diagnostic'(el) {
      if (sync.state.status === 'syncing') return;
      sync.state.status = 'syncing';
      sync.state.results.diagnostic = { text: 'جارٍ تحميل التشخيص...' };
      repaint();

      try {
        let out = '--- REMOTE CLOUD DATA ---\n\n';
        const tables = ['years', 'terms', 'subjects', 'sections', 'teachings', 'students', 'enrollments'];
        for (const t of tables) {
          const data = await cloud.fetchRecords(t);
          out += `[${t.toUpperCase()}] (${data.length})\n`;
          for (const r of data) {
            let str = `  id: ${r.id}\n`;
            if (t === 'sections') str += `  year_id: ${r.year_id} | grade: ${r.grade} | label: ${r.label}\n`;
            if (t === 'teachings') str += `  sec_id: ${r.section_id} | sub_id: ${r.subject_id} | term_id: ${r.term_id}\n`;
            if (t === 'enrollments') str += `  st_id: ${r.student_id} | sec_id: ${r.section_id}\n`;
            if (t === 'students') str += `  name: ${r.name}\n`;
            if (t === 'years') str += `  hijriStart: ${r.hijri_start} | label: ${r.label}\n`;
            if (t === 'terms') str += `  year_id: ${r.year_id} | index: ${r.index}\n`;
            if (t === 'subjects') str += `  name: ${r.name} | slug: ${r.slug}\n`;
            str += `  updated_at: ${r.client_updated_at} | deleted_at: ${r.deleted_at || 'null'}\n\n`;
            out += str;
          }
        }

        out += '--- LOCAL DEVICE DATA ---\n\n';
        const locals = ['students', 'enrollments', 'sections'];
        for (const t of locals) {
          const data = store.state[t] || [];
          out += `[LOCAL ${t.toUpperCase()}] (${data.length})\n`;
          for (const r of data) {
            let str = `  id: ${r.id}\n`;
            if (t === 'sections') str += `  yearId: ${r.yearId} | grade: ${r.grade} | label: ${r.label}\n`;
            if (t === 'enrollments') str += `  studentId: ${r.studentId} | sectionId: ${r.sectionId}\n`;
            if (t === 'students') str += `  name: ${r.name}\n`;
            str += `  updatedAt: ${new Date(r.updatedAt).toISOString()} | deleted: ${r.deleted}\n\n`;
            out += str;
          }
        }

        sync.state.status = 'idle';
        sync.state.results.diagnostic = { text: out };
        repaint();
      } catch (err) {
        sync.state.status = 'idle';
        sync.state.results.diagnostic = { text: 'حدث خطأ أثناء السحب:\n' + err.message };
        repaint();
      }
    },

    async save(el) {
      if (await store.patchProfile({ [el.name]: el.value.trim() })) toast('حُفظ');
    },

    async theme(el) {
      await store.patchDevice({ theme: el.dataset.theme });
      store.applyTheme();
    },

    async 'use-year'(el) {
      const terms = store.termsOf(el.dataset.id);
      await store.patchDevice({ activeYearId: el.dataset.id, activeTermId: terms[0]?.id ?? null });
      toast('تغيّرت السنة الحالية');
    },

    async 'use-term'(el) {
      const t = store.getTerm(el.dataset.id);
      await store.patchDevice({ activeTermId: el.dataset.id, activeYearId: t?.yearId ?? store.activeYear()?.id });
      toast('تغيّر الفصل الدراسي الحالي');
    },

    async 'add-year'() {
      const data = await yearSheet();
      if (!data?.hijriStart) return;
      const y = makeYear({ hijriStart: data.hijriStart });
      if (store.getYear(y.id)) {
        toast('هذه السنة موجودة', 'danger');
        return;
      }
      await store.save({ years: [y] });
      await store.save({ terms: [makeTerm({ yearId: y.id, index: 1, status: 'active' })] });
      toast('أُنشئت السنة الدراسية');
    },

    async 'edit-year'(el) {
      const y = store.getYear(el.dataset.id);
      if (!y) return;
      const data = await yearSheet(y);
      if (!data) return;
      await store.patch('years', y.id, { status: data.status });
      toast('حُفظت');
    },

    async 'add-term'(el) {
      const yId = el.dataset.year;
      const existing = store.termsOf(yId);
      const nextIndex = Math.max(0, ...existing.map((t) => t.index ?? 0)) + 1;
      const data = await termSheet(
        { name: `الفصل الدراسي ${TERM_NAMES[nextIndex] ?? nextIndex}`,
          index: nextIndex, startDate: '', endDate: '', status: 'active' },
        yId
      );
      if (!data) return;
      const t = makeTerm({ yearId: yId, ...data });
      if (store.getTerm(t.id)) {
        toast('يوجد فصل دراسي بهذا الترتيب', 'danger');
        return;
      }
      await store.save({ terms: [t] });
      toast('أُنشئ الفصل الدراسي');
    },

    async 'edit-term'(el) {
      const t = store.getTerm(el.dataset.id);
      if (!t) return;
      const data = await termSheet(t, t.yearId);
      if (!data) return;
      // الترتيب جزء من المعرّف، فلا يُعدَّل بعد الإنشاء
      const { index, ...rest } = data;
      await store.patch('terms', t.id, rest);
      toast('حُفظ');
    },
  },
};
