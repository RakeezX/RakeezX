/**
 * إعداد أوقات الحصص — ملفات توقيت.
 *
 * يضبطها المعلّم مرة واحدة، ثم يضيف الحصص برقمها فقط. وكل ملف يقبل استثناءً
 * ليوم بعينه، لأن بعض الأيام حضوري وبعضها عن بُعد بأوقات مختلفة.
 */

import { html, icon, openSheet, confirmSheet, toast } from '../lib/dom.js';
import * as store from '../store.js';
import { WEEKDAYS, SCHOOL_WEEKDAYS, buildPeriods, fmtRange, makeTimeProfile } from '../models.js';
import { repaint } from '../repaint.js';

let openId = null;
let overrideDay = null;   // اليوم الذي يُحرَّر استثناؤه، أو null للافتراضي

/** لوحة توليد سريع: عدد الحصص وبدايتها ومدتها والفاصل. */
function generateSheet(current = {}) {
  return openSheet({
    title: 'توليد أوقات الحصص',
    desc: 'يملأ الجدول دفعة واحدة، وتقدر تعدّل أي حصة بعدها.',
    body: html`
      <form id="gen-form">
        <div class="field-row">
          <label class="field">
            <span class="field__label">عدد الحصص</span>
            <input class="input tabular" name="count" type="number" min="1" max="12"
                   value="${current.count ?? 7}" required>
          </label>
          <label class="field">
            <span class="field__label">بداية الحصة الأولى</span>
            <input class="input tabular" name="start" type="time" value="${current.start ?? '07:00'}" required>
          </label>
        </div>
        <div class="field-row">
          <label class="field">
            <span class="field__label">مدة الحصة (دقيقة)</span>
            <input class="input tabular" name="minutes" type="number" min="5" max="120"
                   value="${current.minutes ?? 40}" required>
          </label>
          <label class="field">
            <span class="field__label">الفاصل بين الحصص</span>
            <input class="input tabular" name="gap" type="number" min="0" max="60"
                   value="${current.gap ?? 5}" required>
          </label>
        </div>
      </form>
    `,
    foot: html`
      <button class="btn btn--ghost" data-sheet-close>إلغاء</button>
      <button class="btn btn--primary" form="gen-form" type="submit">ولّد</button>
    `,
    onMount: (root, done) => {
      root.querySelector('#gen-form').addEventListener('submit', (ev) => {
        ev.preventDefault();
        const fd = new FormData(ev.target);
        done({
          count: Number(fd.get('count')),
          start: String(fd.get('start')),
          minutes: Number(fd.get('minutes')),
          gap: Number(fd.get('gap')),
        });
      });
    },
  });
}

function nameSheet(existing = null) {
  return openSheet({
    title: existing ? 'تعديل اسم الملف' : 'ملف توقيت جديد',
    body: html`
      <form id="name-form">
        <label class="field">
          <span class="field__label">الاسم</span>
          <input class="input" name="name" value="${existing?.name ?? ''}" required maxlength="60"
                 autocomplete="off" placeholder="مثال: توقيت الاختبارات">
        </label>
        <div class="field-row">
          <label class="field">
            <span class="field__label">يسري من (اختياري)</span>
            <input class="input tabular" name="activeFrom" type="date" value="${existing?.activeFrom ?? ''}">
          </label>
          <label class="field">
            <span class="field__label">إلى (اختياري)</span>
            <input class="input tabular" name="activeTo" type="date" value="${existing?.activeTo ?? ''}">
          </label>
        </div>
        <p class="t-3 fs-sm">
          تاريخا السريان للتوثيق الآن — التفعيل يبقى يدويًا باختيارك الملف النشط.
        </p>
      </form>
    `,
    foot: html`
      <button class="btn btn--ghost" data-sheet-close>إلغاء</button>
      <button class="btn btn--primary" form="name-form" type="submit">حفظ</button>
    `,
    onMount: (root, done) => {
      root.querySelector('#name-form').addEventListener('submit', (ev) => {
        ev.preventDefault();
        const fd = new FormData(ev.target);
        const name = String(fd.get('name') ?? '').trim();
        if (!name) return;
        done({
          name,
          activeFrom: String(fd.get('activeFrom') ?? '') || null,
          activeTo: String(fd.get('activeTo') ?? '') || null,
        });
      });
    },
  });
}

/** قائمة الحصص المعروضة: استثناء اليوم إن كان مفتوحًا، وإلا الافتراضي. */
const listOf = (p) => {
  if (overrideDay === null) return p.periods ?? [];
  const ov = p.overrides?.[String(overrideDay)];
  return Array.isArray(ov) ? ov : [];
};

async function writeList(p, list) {
  if (overrideDay === null) return store.patch('timeProfiles', p.id, { periods: list });
  const overrides = { ...(p.overrides ?? {}) };
  if (list.length) overrides[String(overrideDay)] = list;
  else delete overrides[String(overrideDay)];
  return store.patch('timeProfiles', p.id, { overrides });
}

export default {
  title: () => 'أوقات الحصص',
  subtitle: () => store.activeTimeProfile()?.name ?? '',
  back: () => '#/schedule',

  topActions: () => html`
    <button class="iconbtn" data-act="add-profile" aria-label="ملف جديد">${icon('plus')}</button>
  `,

  onMount() {
    openId = store.activeTimeProfile()?.id ?? null;
    overrideDay = null;
    repaint();
  },

  render() {
    const profiles = store.timeProfiles();
    const active = store.activeTimeProfile();

    if (!profiles.length) {
      return html`
        <div class="empty">
          <div class="empty__icon">${icon('clock')}</div>
          <div class="empty__title">لا ملفات توقيت</div>
          <div class="empty__text">أنشئ ملفًا وحدّد فيه أوقات الحصص مرة واحدة.</div>
          <button class="btn btn--primary" data-act="add-profile">${icon('plus')} ملف جديد</button>
        </div>
      `;
    }

    const open = profiles.find((p) => p.id === openId) ?? active ?? profiles[0];
    const list = listOf(open);
    const hasOverride = (d) => Array.isArray(open.overrides?.[String(d)]) && open.overrides[String(d)].length;

    return html`
      <p class="t-3 fs-md mb-3">
        اضبط الأوقات هنا مرة واحدة، ثم أضف الحصص في الجدول برقمها فقط.
      </p>

      <div class="list mb-3">
        ${profiles.map(
          (p) => html`
            <div class="row ${p.id === open.id ? 'is-open' : ''}">
              <span class="row__icon ${p.id === active?.id ? 'is-active' : ''}">${icon('clock')}</span>
              <button class="row__main" data-act="open" data-id="${p.id}">
                <span class="row__title">${p.name}</span>
                <span class="row__sub">
                  <span class="tabular">${(p.periods ?? []).length}</span> حصص
                  ${Object.keys(p.overrides ?? {}).length
                    ? html` · <span class="tabular">${Object.keys(p.overrides).length}</span> يوم باستثناء`
                    : ''}
                  ${p.activeFrom ? html` · من ${p.activeFrom}` : ''}
                </span>
              </button>
              <span class="row__end">
                ${p.id === active?.id
                  ? html`<span class="badge badge--brand">النشط</span>`
                  : html`<button class="btn btn--sm btn--ghost" data-act="activate" data-id="${p.id}">فعّل</button>`}
                <button class="iconbtn" data-act="rename" data-id="${p.id}" aria-label="تعديل">${icon('edit')}</button>
                <button class="iconbtn" data-act="del-profile" data-id="${p.id}" aria-label="حذف">${icon('trash')}</button>
              </span>
            </div>
          `
        )}
      </div>

      <div class="card card--pad">
        <div class="hstack gap-2 mb-3">
          <div class="fw-7">${open.name}</div>
          <button class="btn btn--sm btn--quiet push" data-act="generate">${icon('spark')} توليد سريع</button>
        </div>

        <div class="field">
          <span class="field__label">الأوقات المعروضة</span>
          <div class="chips scroll-x">
            <button class="chip ${overrideDay === null ? 'is-on' : ''}" data-act="pick-day" data-d="">
              كل الأيام
            </button>
            ${SCHOOL_WEEKDAYS.map(
              (d) => html`
                <button class="chip ${overrideDay === d ? 'is-on' : ''}" data-act="pick-day" data-d="${d}">
                  ${WEEKDAYS[d]}${hasOverride(d) ? ' ✳' : ''}
                </button>
              `
            )}
          </div>
          <span class="field__hint">
            ${overrideDay === null
              ? 'هذه أوقات كل الأيام. اختر يومًا لتحديد استثناء له.'
              : `استثناء ${WEEKDAYS[overrideDay]} — إن تُرك فارغًا استُعملت أوقات كل الأيام.`}
          </span>
        </div>

        ${list.length
          ? html`
              <div class="stack stack-2">
                ${list.map(
                  (t) => html`
                    <div class="timerow">
                      <span class="period">${t.period}</span>
                      <input class="input tabular timerow__in" type="time" value="${t.start}"
                             data-change="set-time" data-p="${t.period}" data-k="start"
                             data-fk="t-${open.id}-${overrideDay ?? 'all'}-${t.period}-s"
                             aria-label="بداية الحصة ${t.period}">
                      <span class="t-3">–</span>
                      <input class="input tabular timerow__in" type="time" value="${t.end}"
                             data-change="set-time" data-p="${t.period}" data-k="end"
                             data-fk="t-${open.id}-${overrideDay ?? 'all'}-${t.period}-e"
                             aria-label="نهاية الحصة ${t.period}">
                      <button class="iconbtn" data-act="del-period" data-p="${t.period}" aria-label="حذف">
                        ${icon('x')}
                      </button>
                    </div>
                  `
                )}
              </div>
              <button class="btn btn--sm btn--ghost btn--block mt-3" data-act="add-period">
                ${icon('plus')} حصة إضافية
              </button>
            `
          : html`
              <div class="card--pad center t-3 fs-md">
                ${overrideDay === null
                  ? 'لا أوقات بعد — استعمل «توليد سريع».'
                  : html`لا استثناء لهذا اليوم.
                      <button class="btn btn--sm btn--primary mt-3 btn--block" data-act="seed-override">
                        انسخ أوقات كل الأيام وعدّلها
                      </button>`}
              </div>
            `}
      </div>
    `;
  },

  actions: {
    open(el) {
      openId = el.dataset.id;
      overrideDay = null;
      repaint();
    },

    'pick-day'(el) {
      overrideDay = el.dataset.d === '' ? null : Number(el.dataset.d);
      repaint();
    },

    async activate(el) {
      await store.setActiveTimeProfile(el.dataset.id);
      toast('صار الملف النشط — والحصص السابقة تبقى بوقتها');
    },

    async 'add-profile'() {
      const data = await nameSheet();
      if (!data) return;
      const p = await store.createTimeProfile({ ...data, periods: buildPeriods(7, '07:00', 40, 5) });
      openId = p.id;
      toast('أُنشئ ملف التوقيت');
    },

    async rename(el) {
      const p = store.getTimeProfile(el.dataset.id);
      if (!p) return;
      const data = await nameSheet(p);
      if (!data) return;
      await store.patch('timeProfiles', p.id, data);
      toast('حُفظ');
    },

    async 'del-profile'(el) {
      if (store.timeProfiles().length <= 1) {
        toast('لا يمكن حذف آخر ملف توقيت', 'danger');
        return;
      }
      const p = store.getTimeProfile(el.dataset.id);
      const ok = await confirmSheet({
        title: `حذف «${p?.name}»؟`,
        desc: 'الحصص السابقة تحتفظ بأوقاتها المطبوعة فيها ولا تتأثر.',
        confirmLabel: 'احذف',
        danger: true,
      });
      if (!ok) return;
      await store.deleteTimeProfile(el.dataset.id);
      if (openId === el.dataset.id) openId = store.timeProfiles()[0]?.id ?? null;
      toast('حُذف الملف');
    },

    async generate() {
      const p = store.getTimeProfile(openId);
      if (!p) return;
      const cur = listOf(p);
      const data = await generateSheet({
        count: cur.length || 7,
        start: cur[0]?.start ?? '07:00',
      });
      if (!data) return;
      await writeList(p, buildPeriods(data.count, data.start, data.minutes, data.gap));
      toast('وُلّدت الأوقات');
    },

    async 'seed-override'() {
      const p = store.getTimeProfile(openId);
      if (!p || overrideDay === null) return;
      await writeList(p, (p.periods ?? []).map((x) => ({ ...x })));
      toast(`أُنشئ استثناء ${WEEKDAYS[overrideDay]}`);
    },

    async 'set-time'(el) {
      const p = store.getTimeProfile(openId);
      if (!p) return;
      const period = Number(el.dataset.p);
      const list = listOf(p).map((t) => (t.period === period ? { ...t, [el.dataset.k]: el.value } : t));
      await writeList(p, list);
    },

    async 'add-period'() {
      const p = store.getTimeProfile(openId);
      if (!p) return;
      const list = listOf(p);
      const last = list.at(-1);
      const next = last
        ? buildPeriods(1, last.end, 40, 0)[0]
        : { period: 0, start: '07:00', end: '07:40' };
      await writeList(p, [...list, { ...next, period: (last?.period ?? 0) + 1 }]);
    },

    async 'del-period'(el) {
      const p = store.getTimeProfile(openId);
      if (!p) return;
      const period = Number(el.dataset.p);
      await writeList(p, listOf(p).filter((t) => t.period !== period));
    },
  },
};
