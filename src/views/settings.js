/** الإعدادات: بيانات المعلّم، والسنوات والفصول الدراسية، والمظهر، والبيانات. */

import { html, icon, openSheet, confirmSheet, toast, fmtDateRange } from '../lib/dom.js';
import * as store from '../store.js';
import * as cloud from '../lib/cloud.js';
import * as sync from '../lib/sync.js';
import { repaint } from '../repaint.js';
import { makeYear, makeTerm, YEAR_STATUS, TERM_STATUS, TERM_NAMES, termIndexes } from '../models.js';
import { isSoundEnabled, setSoundEnabled } from '../lib/sound.js';
import { isVisualEffectsEnabled, setVisualEffectsEnabled } from '../lib/effects.js';
import { hasValidYearCalendarConfig } from './calendar.js';
import { resolvedReportPrincipalName } from '../lib/report-print.js';

const THEMES = [
  { v: 'auto',  label: 'حسب النظام', icon: 'settings' },
  { v: 'light', label: 'فاتح',       icon: 'sun' },
  { v: 'dark',  label: 'داكن',       icon: 'moon' },
];

function detectUserPlatform() {
  if (typeof navigator === 'undefined') return 'ios';
  const ua = navigator.userAgent || '';
  if (/iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
    return 'ios';
  }
  if (/Android/i.test(ua)) {
    return 'android';
  }
  if (/Win/i.test(ua)) {
    return 'windows';
  }
  if (/Mac/i.test(ua)) {
    return 'mac';
  }
  return 'ios';
}

function isStandaloneMode() {
  if (typeof window === 'undefined') return false;
  return !!(window.matchMedia?.('(display-mode: standalone)').matches ||
    navigator.standalone === true ||
    document.referrer?.includes('android-app://'));
}

let activePwaGuide = null;

const PWA_PLATFORMS = [
  { id: 'ios',     label: 'iPhone / iPad' },
  { id: 'android', label: 'Android' },
  { id: 'windows', label: 'Windows' },
  { id: 'mac',     label: 'Mac' },
];

function pwaGuideContent(platform) {
  switch (platform) {
    case 'android':
      return html`
        <div class="pwa-guide-step">
          <span class="pwa-guide-num">١</span>
          <span class="pwa-guide-text">في متصفح <strong>Chrome</strong>، اضغط زر القائمة <strong>(⋮)</strong> في الزاوية العلوية أو السفلية.</span>
        </div>
        <div class="pwa-guide-step">
          <span class="pwa-guide-num">٢</span>
          <span class="pwa-guide-text">اختر <strong>«تثبيت التطبيق» (Install app)</strong> أو <strong>«إضافة إلى الشاشة الرئيسية»</strong>.</span>
        </div>
        <div class="pwa-guide-step">
          <span class="pwa-guide-num">٣</span>
          <span class="pwa-guide-text">أكّد التثبيت ليظهر رَكيز X كبرنامج مستقل وسريع في قائمة وتطبيقات جهازك.</span>
        </div>
      `;
    case 'windows':
      return html`
        <div class="pwa-guide-step">
          <span class="pwa-guide-num">١</span>
          <span class="pwa-guide-text">في متصفح <strong>Chrome</strong> أو <strong>Edge</strong>، اضغط على أيقونة التثبيت <strong>${icon('download')}</strong> في شريط العنوان بالأعلى.</span>
        </div>
        <div class="pwa-guide-step">
          <span class="pwa-guide-num">٢</span>
          <span class="pwa-guide-text">أو افتح قائمة المتصفح (⋮) واختر <strong>تطبيقات ← تثبيت RAKEEZ X</strong>.</span>
        </div>
        <div class="pwa-guide-step">
          <span class="pwa-guide-num">٣</span>
          <span class="pwa-guide-text">سيتم تثبيت رَكيز كنافذة مستقلة وإضافته لقائمة «ابدأ» وشريط المهام.</span>
        </div>
      `;
    case 'mac':
      return html`
        <div class="pwa-guide-step">
          <span class="pwa-guide-num">١</span>
          <span class="pwa-guide-text">في متصفح <strong>Safari</strong> (macOS Sonoma فما بعد): من القائمة العلوية اختر <strong>ملف (File) ← إضافة إلى Dock</strong>.</span>
        </div>
        <div class="pwa-guide-step">
          <span class="pwa-guide-num">٢</span>
          <span class="pwa-guide-text">أو في متصفح <strong>Chrome</strong>: اضغط أيقونة التثبيت في شريط العنوان بالأعلى.</span>
        </div>
        <div class="pwa-guide-step">
          <span class="pwa-guide-num">٣</span>
          <span class="pwa-guide-text">سيظهر رَكيز في شريط الـ Dock ومجلد البرامج لفتحه مباشرة كتطبيق سطح مكتب.</span>
        </div>
      `;
    case 'ios':
    default:
      return html`
        <div class="pwa-guide-step">
          <span class="pwa-guide-num">١</span>
          <span class="pwa-guide-text">افتح الرابط في متصفح <strong>سفاري (Safari)</strong> واضغط زر المشاركة <strong>${icon('share')}</strong> أسفل الشاشة.</span>
        </div>
        <div class="pwa-guide-step">
          <span class="pwa-guide-num">٢</span>
          <span class="pwa-guide-text">مرر للأسفل واختر <strong>«إضافة إلى الصفحة الرئيسية»</strong> (Add to Home Screen).</span>
        </div>
        <div class="pwa-guide-step">
          <span class="pwa-guide-num">٣</span>
          <span class="pwa-guide-text">اضغط <strong>«إضافة»</strong> (Add) في الزاوية العلوية ليظهر رَكيز X كأيقونة تطبيق مباشر.</span>
        </div>
      `;
  }
}

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
        ${t.startDate && t.endDate ? html`<div class="field"><span class="field__label">مدة الفصل</span><div class="field__hint">${fmtDateRange(t.startDate, t.endDate)} — تُعدّل التواريخ من التقويم الدراسي.</div></div>` : ''}
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
    const profile = store.state.profile ?? {};
    const device = store.state.device ?? {};
    const m = {
      ...profile,
      ...device,
      // A blank device fallback must never hide the synced account value.
      reportPrincipalName: resolvedReportPrincipalName(profile, device),
    };
    const yrs = store.years();
    const activeY = store.activeYear();
    const activeT = store.activeTerm();

    return html`
      <div class="section">
        <div class="section__head"><div class="section__title">بياناتك</div></div>
        <div class="card card--pad">
          <p class="t-3 fs-sm mb-3">
            تظهر على التقارير والكشوف التي تطبعها. تُحفظ محليًا وتُزامن مع حسابك عند الاتصال.
          </p>
          <form id="me-form">
            <div class="field-row">
              <label class="field">
                <span class="field__label">اسم المعلم</span>
                <input class="input" name="teacherName" value="${m.teacherName ?? ''}"
                       maxlength="60" autocomplete="name" data-fk="teacherName"
                       data-change="save" placeholder="الاسم كما يظهر في التقارير">
              </label>
              <label class="field">
                <span class="field__label">اسم المدير <span class="t-3 fs-xs">(اختياري)</span></span>
                <input class="input" name="reportPrincipalName" value="${m.reportPrincipalName ?? m.principalName ?? ''}"
                       maxlength="80" autocomplete="name" data-fk="reportPrincipalName"
                       data-change="save" placeholder="مدير المدرسة للتقارير">
              </label>
            </div>
            <label class="field" style="margin-bottom:0">
              <span class="field__label">اسم المدرسة</span>
              <input class="input" name="schoolName" value="${m.schoolName ?? ''}"
                     maxlength="80" autocomplete="off" data-fk="schoolName"
                     data-change="save" placeholder="اسم المدرسة">
            </label>
          </form>
        </div>
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
        <div class="section__head"><div class="section__title">المؤثرات والتفاعل</div></div>
        <div class="stack stack-2">
          <div class="card card--pad">
            <div class="hstack gap-3 wrap">
              <div style="flex: 1; min-width: 180px;">
                <div class="fw-7">المؤثرات الصوتية</div>
                <div class="t-3 fs-sm">أصوات تفاعلية أثناء رصد المشاركة والقرعة</div>
              </div>
              <div class="segmented" style="flex: none;">
                <button class="segmented__btn ${isSoundEnabled() ? 'is-on' : ''}" data-act="sound" data-val="on">
                  ${icon('spark')} تشغيل
                </button>
                <button class="segmented__btn ${!isSoundEnabled() ? 'is-on' : ''}" data-act="sound" data-val="off">
                  إيقاف
                </button>
              </div>
            </div>
          </div>

          <div class="card card--pad">
            <div class="hstack gap-3 wrap">
              <div style="flex: 1; min-width: 180px;">
                <div class="fw-7">المؤثرات البصرية</div>
                <div class="t-3 fs-sm">أشكال متحركة وفقاعات الرصد السريع واحتفالات القرعة</div>
              </div>
              <div class="segmented" style="flex: none;">
                <button class="segmented__btn ${isVisualEffectsEnabled() ? 'is-on' : ''}" data-act="visual-fx" data-val="on">
                  ${icon('spark')} تشغيل
                </button>
                <button class="segmented__btn ${!isVisualEffectsEnabled() ? 'is-on' : ''}" data-act="visual-fx" data-val="off">
                  إيقاف
                </button>
              </div>
            </div>
          </div>
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
        <div class="section__head"><div class="section__title">الأرشيف</div></div>
        <a class="row" href="#/archive">
          <span class="row__icon">${icon('archive')}</span>
          <span class="row__main"><span class="row__title">الأرشيف</span><span class="row__sub">استعراض السنوات والفصول الدراسية المؤرشفة وبياناتها السابقة.</span></span>
          <span class="row__end">${icon('chev')}</span>
        </a>
      </div>
      <div class="section">
        <div class="section__head"><div class="section__title">تثبيت تطبيق ركيز على الجهاز</div></div>
        <div class="card card--pad stack stack-3">
          ${isStandaloneMode()
            ? html`
                <div class="pwa-installed-card">
                  <div class="pwa-installed-card__icon">${icon('check')}</div>
                  <div>
                    <div class="fw-7">التطبيق مُثبّت ويعمل كتطبيق جهاز مستقل</div>
                    <div class="fs-xs" style="opacity:0.9">يعمل رَكيز بكامل مميزاته محليًا دون الحاجة للاتصال بالإنترنت.</div>
                  </div>
                </div>
              `
            : ''}

          ${!isStandaloneMode() && typeof window !== 'undefined' && window.deferredInstallPrompt
            ? html`
                <button class="btn btn--primary btn--block" data-act="pwa-prompt-install">
                  ${icon('download')} تثبيت تطبيق ركيز الآن
                </button>
              `
            : ''}

          <div>
            <div class="hstack gap-2 wrap mb-2">
              <span class="fw-7 fs-sm">إرشادات التثبيت حسب الجهاز:</span>
            </div>
            <div class="segmented mb-3">
              ${PWA_PLATFORMS.map(
                (p) => html`
                  <button class="segmented__btn ${(activePwaGuide || detectUserPlatform()) === p.id ? 'is-on' : ''}"
                          data-act="pwa-select-guide" data-platform="${p.id}">
                    ${p.label}
                  </button>
                `
              )}
            </div>
          </div>

          <div class="stack stack-2">
            ${pwaGuideContent(activePwaGuide || detectUserPlatform())}
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section__head"><div class="section__title">عن RAKEEZ X</div></div>
        <div class="card card--pad stack stack-2">
          <div class="fw-7">سجل معلّم يعمل دون إنترنت أولًا (Offline-First).</div>
          <div class="t-3 fs-sm">بياناتك وسجلاتك محفوظة محليًا على جهازك لسرعة العمل والخصوصية، مع دعم المزامنة السحابية الآمنة واستمرارية السجلات عبر أجهزتك.</div>
          <div class="t-3 fs-xs">RAKEEZ X · الإصدار 1.0</div>
        </div>
      </div>
    `;
  },

  actions: {
    'pwa-select-guide'(el) {
      activePwaGuide = el.dataset.platform;
      repaint();
    },

    async 'pwa-prompt-install'() {
      if (window.deferredInstallPrompt) {
        window.deferredInstallPrompt.prompt();
        try {
          const { outcome } = await window.deferredInstallPrompt.userChoice;
          if (outcome === 'accepted') {
            toast('جارٍ تثبيت تطبيق ركيز...');
            window.deferredInstallPrompt = null;
            repaint();
          }
        } catch {
          // ignore prompt cancellation
        }
      } else {
        toast('اتبع الخطوات الموضحة لجهازك لتثبيت التطبيق');
      }
    },
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
      const ok = await sync.syncAll({ full: true });
      if (!ok) toast('تعذرت المزامنة', 'danger');
    },
    async 'sync-structural'(el) {
      if (sync.state.status === 'syncing') return;
      await sync.syncStructural();
      if (sync.state.results.structural?.status === 'error') {
        toast('تعذرت المزامنة الهيكلية', 'danger');
      }
    },

    async 'sync-students'(el) {
      if (sync.state.status === 'syncing') return;
      await sync.syncStudents();
      if (sync.state.results.students?.status === 'error') {
        toast('تعذرت مزامنة الطلاب والانتساب', 'danger');
      }
    },

    async 'sync-notes'(el) {
      if (sync.state.status === 'syncing') return;
      await sync.syncNotes();
      if (sync.state.results.notes?.status === 'error') {
        toast('تعذرت مزامنة ملاحظات الطلاب', 'danger');
      }
    },

    async 'sync-scoring'(el) {
      if (sync.state.status === 'syncing') return;
      await sync.syncScoring();
      if (sync.state.results.scoring?.status === 'error') {
        toast('تعذرت مزامنة التقييم والدرجات', 'danger');
      }
    },

    async 'sync-timetable'(el) {
      if (sync.state.status === 'syncing') return;
      await sync.syncTimetable();
      if (sync.state.results.timetable?.status === 'error') {
        toast('تعذرت مزامنة الجدول والجلسات', 'danger');
      }
    },

    async save(el) {
      const val = el.value.trim();
      if (el.name === 'reportPrincipalName' || el.name === 'principalName') {
        await store.patchProfile({ reportPrincipalName: val, principalName: val });
        await store.patchDevice({ reportPrincipalName: val });
        toast('حُفظ');
      } else {
        if (await store.patchProfile({ [el.name]: val })) toast('حُفظ');
      }
    },

    async theme(el) {
      await store.patchDevice({ theme: el.dataset.theme });
      store.applyTheme();
    },

    sound(el) {
      const enabled = el.dataset.val === 'on';
      setSoundEnabled(enabled);
      toast(enabled ? 'تم تفعيل المؤثرات الصوتية' : 'تم إيقاف المؤثرات الصوتية');
      repaint();
    },

    'visual-fx'(el) {
      const enabled = el.dataset.val === 'on';
      setVisualEffectsEnabled(enabled);
      toast(enabled ? 'تم تفعيل المؤثرات البصرية' : 'تم إيقاف المؤثرات البصرية');
      repaint();
    },

    async 'use-year'(el) {
      const targetYearId = el.dataset.id;
      if (!hasValidYearCalendarConfig(targetYearId)) {
        toast('أكمل إعداد الفصول الدراسية لهذه السنة أولًا', 'warn');
        return;
      }
      const terms = store.termsOf(targetYearId);
      await store.patchDevice({ activeYearId: targetYearId, activeTermId: terms[0]?.id ?? null });
      toast('تغيّرت السنة الحالية');
    },

    async 'use-term'(el) {
      const t = store.getTerm(el.dataset.id);
      if (!t || !t.startDate || !t.endDate) {
        toast('أكمل إعداد الفصول الدراسية لهذه السنة أولًا', 'warn');
        return;
      }
      const targetYearId = t.yearId ?? store.activeYear()?.id;
      if (!hasValidYearCalendarConfig(targetYearId)) {
        toast('أكمل إعداد الفصول الدراسية لهذه السنة أولًا', 'warn');
        return;
      }
      await store.patchDevice({ activeTermId: el.dataset.id, activeYearId: targetYearId });
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
      const ok1 = await store.save({ years: [y] });
      const ok2 = await store.save({ terms: [makeTerm({ yearId: y.id, index: 1, status: 'active' })] });
      if (ok1 && ok2) toast('تم إضافة سنة دراسية بنجاح');
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
      const ok = await store.save({ terms: [t] });
      if (ok) toast('تم إضافة فصل دراسي بنجاح');
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
