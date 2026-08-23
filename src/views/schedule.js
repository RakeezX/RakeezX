/**
 * الجدول الدراسي — الأسبوع المتكرر.
 *
 * `slots` تمثّل الجدول المتكرر، و`sessions` تُولَّد منه × تواريخ الفصل الدراسي.
 * وعدد الحصص الأسبوعية **يُشتق من عدد الفترات** لا يُخزَّن رقمًا ثابتًا —
 * فحصتان أسبوعيًا للمهارات الرقمية سطران هنا، لا رقم في الشيفرة.
 */

import { html, icon, openSheet, toast, confirmSheet } from '../lib/dom.js';
import * as store from '../store.js';
import { WEEKDAYS, SCHOOL_WEEKDAYS, todayISO, weekday, fmtRange, sectionLabel } from '../models.js';
import { repaint } from '../repaint.js';

/**
 * لوحة إضافة حصة — ثلاثة حقول فقط: اليوم ورقم الحصة والفصل.
 * الوقت يأتي من ملف التوقيت النشط ويُعرض للتأكيد، ولا يُدخَل يدويًا.
 */
function slotSheet(defaults = {}) {
  const list = store.teachings();
  const profile = store.activeTimeProfile();

  const timeHint = (wd, period, tchId) => {
    const tch = store.getTeaching(tchId);
    const sec = store.getSection(tch?.sectionId);
    const t = store.timeFor(Number(wd), Number(period), profile, sec?.grade);
    return t ? fmtRange(t) : 'لا وقت لهذه الحصة في الملف النشط';
  };

  return openSheet({
    title: 'حصة في الجدول',
    desc: profile ? `الأوقات من «${profile.name}»` : 'لا ملف توقيت نشط',
    body: html`
      <form id="slot-form">
        <label class="field">
          <span class="field__label">الفصل</span>
          <select class="select" name="teachingId">
            ${list.map(
              (t) => html`<option value="${t.id}" ${defaults.teachingId === t.id ? 'selected' : ''}>
                ${store.teachingLabel(t)}
              </option>`
            )}
          </select>
        </label>
        <div class="field-row">
          <label class="field">
            <span class="field__label">اليوم</span>
            <select class="select" name="weekday" id="slot-day">
              ${SCHOOL_WEEKDAYS.map(
                (d) => html`<option value="${d}" ${Number(defaults.weekday) === d ? 'selected' : ''}>${WEEKDAYS[d]}</option>`
              )}
            </select>
          </label>
          <label class="field">
            <span class="field__label">رقم الحصة</span>
            <select class="select" name="period" id="slot-period">
              ${store.availablePeriods(null, profile).map(
                (p) => html`<option value="${p}" ${Number(defaults.period) === p ? 'selected' : ''}>الحصة ${p}</option>`
              )}
            </select>
          </label>
        </div>
        <div class="timepreview" id="slot-time">
          ${icon('clock')} <span class="tabular" id="slot-time-text"></span>
        </div>
      </form>
    `,
    foot: html`
      <button class="btn btn--ghost" data-sheet-close>إلغاء</button>
      <button class="btn btn--primary" form="slot-form" type="submit">أضف</button>
    `,
    onMount: (root, done) => {
      const form = root.querySelector('#slot-form');
      const day = root.querySelector('#slot-day');
      const period = root.querySelector('#slot-period');
      const text = root.querySelector('#slot-time-text');

      const sync = () => {
        const tchId = form.querySelector('[name="teachingId"]')?.value;
        // أرقام الحصص قد تختلف في يوم له استثناء
        const nums = store.availablePeriods(Number(day.value), profile);
        const wanted = Number(period.value);
        period.innerHTML = nums
          .map((p) => `<option value="${p}"${p === wanted ? ' selected' : ''}>الحصة ${p}</option>`)
          .join('');
        if (!nums.includes(wanted) && nums.length) period.value = String(nums[0]);
        text.textContent = timeHint(day.value, period.value, tchId);
      };
      day.addEventListener('change', sync);
      period.addEventListener('change', sync);
      form.querySelector('[name="teachingId"]')?.addEventListener('change', sync);
      sync();

      form.addEventListener('submit', (ev) => {
        ev.preventDefault();
        const fd = new FormData(ev.target);
        const teachingId = String(fd.get('teachingId') ?? '');
        if (!teachingId) return;
        done({
          teachingId,
          weekday: Number(fd.get('weekday')),
          period: Number(fd.get('period')),
        });
      });
    },
  });
}

export default {
  title: () => 'الجدول',
  subtitle: () => store.activeTerm()?.name ?? '',
  wide: true,

  topActions: () => html`
    <button class="iconbtn" data-act="add" aria-label="حصة في الجدول">${icon('plus')}</button>
  `,

  render() {
    const list = store.teachings();
    if (!list.length) {
      return html`
        <div class="empty">
          <div class="empty__icon">${icon('timetable')}</div>
          <div class="empty__title">أنشئ فصلًا أولًا</div>
          <div class="empty__text">الجدول يوزّع فصولك على أيام الأسبوع وحصصه.</div>
          <a class="btn btn--primary" href="#/classes">${icon('plus')} الفصول</a>
        </div>
      `;
    }

    const slots = store.allSlots();
    const byDay = Object.fromEntries(SCHOOL_WEEKDAYS.map((d) => [d, []]));
    for (const s of slots) (byDay[s.weekday] ??= []).push(s);

    const today = weekday(todayISO());

    const todayStr = todayISO();
    const baseProfile = store.activeTimeProfile();
    const profile = store.resolveProfile(baseProfile, todayStr);
    const isAuto = profile?.activeFrom && profile.activeFrom <= todayStr && (!profile.activeTo || profile.activeTo >= todayStr);
    
    let recessText = '';
    const cfg = profile?.overrides?.config;
    if (cfg?.recess?.enabled) {
      if (cfg.recess.rules) recessText = 'فسحة خامس/سادس: بعد الحصة ' + cfg.recess.rules.find(r => r.grades.includes(5))?.afterPeriod;
      else recessText = 'الفسحة: بعد الحصة ' + cfg.recess.afterPeriod;
    }

    return html`
      <div class="card card--pad mb-3" style="background: var(--surface-1);">
        <div class="hstack gap-2 mb-2">
          <div class="fw-7 t-1">التوقيت الحالي: ${profile?.name || 'غير محدد'}</div>
          ${profile ? html`<div class="badge badge--${isAuto ? 'success' : 'info'} push">${isAuto ? 'تلقائي حسب التاريخ' : 'اختيار يدوي'}</div>` : ''}
        </div>
        ${profile ? html`
          <div class="t-3 fs-sm mb-1">
            الأولى <span class="tabular fw-7">${profile.periods?.[0]?.start}</span> ·
            ${cfg?.periodDuration ? html`مدة الحصة <span class="tabular fw-7">${cfg.periodDuration}</span> دقيقة ·` : ''}
            <span class="tabular fw-7">${(profile.periods ?? []).length}</span> حصص
          </div>
          ${recessText ? html`<div class="t-3 fs-sm mb-3">${recessText}</div>` : html`<div class="mb-3"></div>`}
        ` : ''}
        <a class="btn btn--sm btn--ghost" href="#/schedule/times">${icon('edit-2')} تعديل التوقيت</a>
      </div>

      ${slots.length
        ? html`
            <div class="grid grid--2 mb-3">
              <div class="stat">
                <div class="stat__val tabular">${slots.length}</div>
                <div class="stat__label">حصة أسبوعيًا</div>
              </div>
              <div class="stat">
                <div class="stat__val tabular">${list.length}</div>
                <div class="stat__label">فصلًا في الجدول</div>
              </div>
            </div>
          `
        : html`
            <div class="card card--pad mb-3 center">
              <div class="fw-7">جدولك فارغ</div>
              <p class="t-3 fs-sm mt-3">
                أضف حصصك الأسبوعية — مثلًا حصتان لكل فصل في مادة المهارات الرقمية —
                فتظهر حصص اليوم في الصفحة الرئيسية تلقائيًا.
              </p>
              <button class="btn btn--primary mt-3" data-act="add">${icon('plus')} أضف أول حصة</button>
            </div>
          `}

      <div class="week">
        ${SCHOOL_WEEKDAYS.map(
          (d) => html`
            <div class="week__day ${d === today ? 'is-today' : ''}">
              <div class="week__head">
                ${WEEKDAYS[d]}
                ${byDay[d]?.length ? html`<span class="badge tabular">${byDay[d].length}</span>` : ''}
              </div>
              ${byDay[d]?.length
                ? html`
                    <div class="stack stack-2">
                      ${byDay[d].map((s) => {
                        const tch = store.getTeaching(s.teachingId);
                        const sec = store.getSection(tch?.sectionId);
                        const t = store.timeFor(d, s.period, baseProfile, sec?.grade, todayStr);
                        return html`
                          <div class="slot">
                            <span class="period">${s.period}</span>
                            <span class="slot__main">
                              <span class="slot__name">الحصة ${s.period}</span>
                              <span class="slot__time tabular t-3 fs-sm mb-1">${t ? fmtRange(t) : '—'}</span>
                              <span class="slot__sub fw-7">${store.getSubject(tch?.subjectId)?.name ?? ''}</span>
                              <span class="slot__sub">${sectionLabel(sec) || '—'}</span>
                            </span>
                            <button class="iconbtn" data-act="remove" data-id="${s.id}" aria-label="حذف">
                              ${icon('x')}
                            </button>
                          </div>
                        `;
                      })}
                    </div>
                  `
                : html`<div class="week__empty">—</div>`}
              <button class="btn btn--sm btn--quiet btn--block mt-3" data-act="add" data-day="${d}">
                ${icon('plus')}
              </button>
            </div>
          `
        )}
      </div>

      <div class="section">
        <div class="section__head"><div class="section__title">الحصص الأسبوعية لكل فصل</div></div>
        <div class="list">
          ${list.map((t) => {
            const n = store.weeklyPeriods(t.id);
            return html`
              <a class="row" href="#/teaching/${t.id}/sessions">
                <span class="row__main">
                  <span class="row__title">${store.teachingLabel(t)}</span>
                  <span class="row__sub">
                    ${n ? html`<span class="tabular">${n}</span> حصص أسبوعيًا` : 'لم تُجدول بعد'}
                  </span>
                </span>
                <span class="row__end">${icon('chev')}</span>
              </a>
            `;
          })}
        </div>
      </div>

      <p class="t-3 fs-sm mt-6 center">
        توليد حصص الفصل الدراسي كاملًا من هذا الجدول يأتي في الموجة القادمة —
        النموذج جاهز له، وحصص اليوم تُنشأ الآن عند فتح الحضور.
      </p>
    `;
  },

  actions: {
    async add(el) {
      const data = await slotSheet({ weekday: el?.dataset?.day });
      if (!data) return;
      const slot = await store.addSlot(data.teachingId, data.weekday, data.period);
      if (!slot) {
        toast('هذه الحصة موجودة في الجدول', 'danger');
        return;
      }
      const tch = store.getTeaching(data.teachingId);
      const sec = store.getSection(tch?.sectionId);
      const t = store.timeFor(data.weekday, data.period, store.activeTimeProfile(), sec?.grade);
      toast(t ? `أُضيفت — ${fmtRange(t)}` : 'أُضيفت للجدول');
    },

    async remove(el) {
      const ok = await confirmSheet({
        title: 'حذف هذه الحصة من الجدول؟',
        desc: 'الحصص المسجّلة سابقًا وحضورها لا تتأثر.',
        confirmLabel: 'احذف',
        danger: true,
      });
      if (!ok) return;
      await store.removeSlot(el.dataset.id);
      toast('حُذفت من الجدول');
    },
  },
};
