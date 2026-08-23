/**
 * إعداد أوقات الحصص — ملفات توقيت.
 *
 * يضبطها المعلّم مرة واحدة، ثم يضيف الحصص برقمها فقط. وكل ملف يقبل استثناءً
 * ليوم بعينه، لأن بعض الأيام حضوري وبعضها عن بُعد بأوقات مختلفة.
 */

import { html, icon, openSheet, confirmSheet, toast } from '../lib/dom.js';
import * as store from '../store.js';
import { WEEKDAYS, SCHOOL_WEEKDAYS, generateAdvancedPeriods, fmtRange, makeTimeProfile } from '../models.js';
import { repaint } from '../repaint.js';

let openId = null;
let overrideDay = null;   // اليوم الذي يُحرَّر استثناؤه، أو null للافتراضي

import { TIMING_PRESETS } from '../models.js';


function generateSheet(current = {}) {
  const formatSummary = (p) => {
    if (p === 'custom') return '';
    const conf = TIMING_PRESETS[p];
    if (p === 'summer') return `الطابور: 6:45 ص | بداية الأولى: 7:00 ص | مدة الحصة: 45 د | الفسحة: 20 د + 5 تفويج | خامس/سادس: بعد الحصة الثالثة | رابع: بعد الحصة الثانية | عدد الحصص: 7`;
    if (p === 'winter') return `الطابور: 7:15 ص | بداية الأولى: 7:30 ص | مدة الحصة: 45 د | الفسحة: 20 د | خامس/سادس: بعد الحصة الثالثة | رابع: بعد الحصة الثانية | عدد الحصص: 7`;
    if (p === 'ramadan') return `لا يوجد طابور | بداية الأولى: 9:00 ص | مدة الحصة: 35 د | عدد الحصص: 6 | لا توجد فسحة`;
    if (p === 'remote') return `لا يوجد طابور | بداية الأولى: 7:00 ص | مدة الحصة: 30 د | عدد الحصص: 8 | لا توجد فسحة`;
    if (p === 'hybrid') return `حضوري: حسب التوقيت النشط | عن بعد: 8 حصص من 7:00 ص بدون فسحة`;
    return '';
  };

  return openSheet({
    title: 'توليد أوقات الحصص',
    desc: 'اختر نموذجاً مسبقاً أو أدخل أوقاتاً مخصصة.',
    body: html`
      <form id="gen-form">
        <label class="field mb-2">
          <span class="field__label">نموذج التوقيت</span>
          <select class="select" name="preset" id="preset-sel">
            <option value="summer" selected>التوقيت الصيفي (حسب الدليل)</option>
            <option value="winter">التوقيت الشتوي (حسب الدليل)</option>
            <option value="ramadan">توقيت شهر رمضان</option>
            <option value="hybrid">التوقيت المدمج (حضوري / عن بُعد)</option>
            <option value="remote">توقيت التعليم عن بُعد</option>
            <option value="custom">مخصص</option>
          </select>
        </label>
        
        <div id="preset-summary" class="t-3 fs-xs mb-4 p-2" style="background: var(--surface-2); border-radius: var(--radius-sm);">
          ${formatSummary('summer')}
        </div>
        
        <div id="custom-fields" style="display: none;">
          <div class="field-row">
            <label class="field"><span class="field__label">عدد الحصص</span><input class="input tabular" name="count" type="number" min="1" max="12" value="7"></label>
            <label class="field"><span class="field__label">بداية الأولى</span><input class="input tabular" name="start" type="time" value="07:00"></label>
          </div>
          <div class="field-row">
            <label class="field"><span class="field__label">مدة الحصة</span><input class="input tabular" name="minutes" type="number" min="5" max="120" value="40"></label>
            <label class="field"><span class="field__label">الفاصل بين الحصص</span><input class="input tabular" name="gap" type="number" min="0" max="60" value="0"></label>
          </div>
          
          <label class="field mt-3">
            <input type="checkbox" name="hasAssembly"> الطابور الصباحي
          </label>
          <div id="assembly-fields" class="field-row" style="display:none;">
            <label class="field"><span class="field__label">البداية</span><input class="input tabular" name="asmStart" type="time" value="06:45"></label>
            <label class="field"><span class="field__label">المدة</span><input class="input tabular" name="asmDur" type="number" value="15"></label>
          </div>

          <label class="field mt-3">
            <input type="checkbox" name="hasRecess"> الفسحة
          </label>
          <div id="recess-fields" style="display:none;">
            <div class="field-row">
              <label class="field"><span class="field__label">المدة</span><input class="input tabular" name="recDur" type="number" value="20"></label>
              <label class="field"><span class="field__label">التفويج</span><input class="input tabular" name="recTrans" type="number" value="0"></label>
            </div>
            <label class="field mt-2">
              <span class="field__label">تطبيق الفسحة على</span>
              <select class="select" name="recGrades">
                <option value="all">جميع الصفوف (نفس الوقت)</option>
                <option value="official">منفصلة (رابع: بعد الـ 2 / خامس وسادس: بعد الـ 3)</option>
              </select>
            </label>
            <label class="field mt-2" id="rec-after-field">
              <span class="field__label">بعد الحصة رقم</span>
              <input class="input tabular" name="recAfter" type="number" value="3">
            </label>
          </div>
        </div>
      </form>
    `,
    foot: html`
      <button class="btn btn--ghost" data-sheet-close>إلغاء</button>
      <button class="btn btn--primary" form="gen-form" type="submit">ولّد الأوقات</button>
    `,
    onMount: (root, done) => {
      const sel = root.querySelector('#preset-sel');
      const sum = root.querySelector('#preset-summary');
      const cust = root.querySelector('#custom-fields');
      const cbAsm = root.querySelector('input[name="hasAssembly"]');
      const cbRec = root.querySelector('input[name="hasRecess"]');
      const asmF = root.querySelector('#assembly-fields');
      const recF = root.querySelector('#recess-fields');
      const recGrades = root.querySelector('select[name="recGrades"]');
      const recAfterField = root.querySelector('#rec-after-field');
      
      sel.addEventListener('change', () => {
        const p = sel.value;
        if (p === 'custom') {
          sum.style.display = 'none';
          cust.style.display = 'block';
        } else {
          sum.style.display = 'block';
          sum.textContent = formatSummary(p);
          cust.style.display = 'none';
        }
      });

      cbAsm.addEventListener('change', () => asmF.style.display = cbAsm.checked ? 'flex' : 'none');
      cbRec.addEventListener('change', () => recF.style.display = cbRec.checked ? 'block' : 'none');
      recGrades.addEventListener('change', () => {
        recAfterField.style.display = recGrades.value === 'all' ? 'block' : 'none';
      });
      
      root.querySelector('#gen-form').addEventListener('submit', (ev) => {
        ev.preventDefault();
        const fd = new FormData(ev.target);
        const type = fd.get('preset');
        if (type !== 'custom') {
          done(TIMING_PRESETS[type]);
        } else {
          const config = {
            type: 'custom',
            gap: Number(fd.get('gap')),
            firstPeriodStart: String(fd.get('start')),
            periodDuration: Number(fd.get('minutes')),
            count: Number(fd.get('count')),
            assembly: { enabled: false },
            recess: { enabled: false }
          };
          if (fd.get('hasAssembly')) {
            config.assembly = { enabled: true, start: String(fd.get('asmStart')), duration: Number(fd.get('asmDur')) };
          }
          if (fd.get('hasRecess')) {
            config.recess = { enabled: true, duration: Number(fd.get('recDur')), transition: Number(fd.get('recTrans')) };
            if (fd.get('recGrades') === 'official') {
              config.recess.rules = [{ grades: [4], afterPeriod: 2 }, { grades: [5, 6], afterPeriod: 3 }];
            } else {
              config.recess.afterPeriod = Number(fd.get('recAfter'));
            }
          }
          done(config);
        }
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
let previewGrade = 5;

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
    const myGrades = new Set(store.teachings().map(t => store.getSection(t.sectionId)?.grade).filter(Boolean));
    if (myGrades.has(5) || myGrades.has(6)) previewGrade = 5;
    else if (myGrades.has(4)) previewGrade = 4;
    else previewGrade = 5;
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
        ${open.overrides?.config?.assembly?.enabled ? html`
          <p class="t-3 fs-xs mb-3">
            الطابور الصباحي: <span class="tabular">${open.overrides.config.assembly.start}</span>
            (${open.overrides.config.assembly.duration} د)
          </p>
        ` : ''}

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

        </div>

        ${list.length
          ? (() => {
              const filteredList = [];
              const maxP = Math.max(...list.map(p => p.period));
              for (let i = 1; i <= maxP; i++) {
                const p = list.find(x => x.period === i && x.grades?.includes(previewGrade)) 
                       ?? list.find(x => x.period === i && !x.grades);
                if (p) filteredList.push(p);
              }
              const hasGrades = list.some(p => p.grades);
              
              return html`
                ${hasGrades ? html`
                  <div class="field mb-3">
                    <span class="field__label">عرض أوقات</span>
                    <div class="chips">
                      <button class="chip ${previewGrade === 4 ? 'is-on' : ''}" data-act="set-preview-grade" data-g="4">الصف الرابع</button>
                      <button class="chip ${previewGrade === 5 ? 'is-on' : ''}" data-act="set-preview-grade" data-g="5">الخامس والسادس</button>
                    </div>
                  </div>
                ` : ''}
                <div class="stack stack-2">
                  ${filteredList.map((t, i) => {
                    const chunks = [];
                    if (i > 0) {
                      const prev = filteredList[i - 1];
                      const parseTime = (str) => { const [h, m] = str.split(':').map(Number); return h * 60 + m; };
                      const gapMins = parseTime(t.start) - parseTime(prev.end);
                      if (gapMins > 0) {
                        let text = `${gapMins} دقيقة`;
                        const cfg = open.overrides?.config;
                        if (cfg?.recess?.enabled) {
                          const tr = cfg.recess.transition || 0;
                          if (tr > 0 && gapMins > tr) text = `${gapMins - tr} دقيقة فسحة + ${tr} دقائق تفويج`;
                          else if (gapMins === tr) text = `${tr} دقائق تفويج`;
                        }
                        chunks.push(html`
                          <div class="timerow" style="background: var(--surface-2); padding: 0.5rem; border-radius: var(--radius-md); align-items: center; justify-content: center; gap: 1rem;">
                            <div class="fw-7 t-2">فسحة</div>
                            <div class="tabular t-3">${prev.end} – ${t.start}</div>
                            <div class="badge badge--info">${text}</div>
                          </div>
                        `);
                      }
                    }
                    chunks.push(html`
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
                    `);
                    return chunks;
                  })}
                </div>
                <button class="btn btn--sm btn--ghost btn--block mt-3" data-act="add-period">
                  ${icon('plus')} حصة إضافية
                </button>
              `;
            })()
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

    'set-preview-grade'(el) {
      previewGrade = Number(el.dataset.g);
      repaint();
    },

    async activate(el) {
      await store.setActiveTimeProfile(el.dataset.id);
      toast('صار الملف النشط — والحصص السابقة تبقى بوقتها');
    },

    async 'add-profile'() {
      const data = await nameSheet();
      if (!data) return;
      const p = await store.createTimeProfile({ ...data, periods: generateAdvancedPeriods(TIMING_PRESETS.custom) });
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
      
      const newPeriods = generateAdvancedPeriods(data);
      await writeList(p, newPeriods);
      
      // Save the config to overrides so we know if it's Hybrid
      const overrides = { ...(p.overrides ?? {}) };
      overrides.config = data;
      await store.patch('timeProfiles', p.id, { overrides });
      
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
