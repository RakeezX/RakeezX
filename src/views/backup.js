/**
 * النسخ الاحتياطي.
 * البيانات على جهازك وحده — وهذا يعني أن ضياع الجهاز أو مسح بيانات المتصفح
 * يضيّعها. الملف الذي تصدّره من هنا هو أمانك الوحيد حتى تُفعَّل المزامنة.
 */

import { html, icon, toast, confirmSheet, openSheet, fmtDateFull } from '../lib/dom.js';
import * as store from '../store.js';
import * as db from '../lib/db.js';
import { downloadBackup, restoreBackup, readJSONFile } from '../lib/export.js';
import { todayISO } from '../models.js';
import { repaint } from '../repaint.js';

let usageInfo = null;

export const LOCAL_RESET_COPY = {
  button: 'إعادة ضبط سجل ركيز المحلي على هذا الجهاز',
  title: 'إعادة ضبط السجل المحلي؟',
  description: 'سيُمسح سجل ركيز المحلي والتغييرات غير المرفوعة من هذا الجهاز فقط. لن تُحذف بياناتك السحابية، وستُعاد مزامنتها بعد إعادة التحميل عند تسجيل الدخول.',
  pendingWarning: 'يوجد تغييرات لم تُرفع بعد وستُفقد عند المتابعة.',
  confirmLabel: 'إعادة ضبط السجل المحلي',
  finalTitle: 'متأكد من إعادة الضبط؟',
  finalDescription: 'لا يمكن استعادة التغييرات المحلية غير المرفوعة بعد المتابعة.',
  finalConfirmLabel: 'نعم، أعد الضبط',
};

const fmtBytes = (n) => {
  if (!n && n !== 0) return '—';
  if (n < 1024) return `${n} بايت`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} ك.ب`;
  return `${(n / 1024 / 1024).toFixed(1)} م.ب`;
};

const backupExportDate = (value) => {
  const stamp = new Date(value);
  return Number.isFinite(stamp.getTime()) ? fmtDateFull(todayISO(stamp)) : '';
};

export default {
  title: () => 'النسخ الاحتياطي',

  async onMount() {
    usageInfo = await db.usage();
    repaint();
  },

  render() {
    const s = store.state;
    const n = (k) => (s[k] ?? []).filter((x) => !x.deleted).length;
    const counts = {
      'سنوات دراسية': n('years'),
      'فصول دراسية': n('terms'),
      شعب: n('sections'),
      إسنادات: n('teachings'),
      طلاب: n('students'),
      انتسابات: n('enrollments'),
      حصص: n('sessions'),
      درجات: n('scores'),
      'سجلات حضور': n('attendance'),
      'رصدات سريعة': n('logs'),
    };

    return html`
      <div class="card card--pad mb-3">
        <div class="fw-7">النسخ الاحتياطي وحفظ البيانات</div>
        <p class="fs-sm mt-2 t-3">
          يعمل التطبيق دون إنترنت أولًا لحفظ بياناتك محليًا بسرعة وخصوصية.
          يتيح لك النسخ الاحتياطي تنزيل ملف متكامل لسجلاتك واستعادته عند الحاجة،
          كما تدعم المزامنة السحابية حفظ سجلاتك ومزامنتها تلقائيًا عند تسجيل الدخول.
        </p>
      </div>

      <div class="section">
        <div class="section__head"><div class="section__title">ما في سجلّك الآن</div></div>
        <div class="card card--pad">
          <div class="stack stack-2">
            ${Object.entries(counts).map(
              ([label, n]) => html`
                <div class="hstack">
                  <span class="t-2">${label}</span>
                  <span class="push tabular fw-7">${n}</span>
                </div>
              `
            )}
            ${usageInfo
              ? html`
                  <hr class="divider" style="margin-block:var(--sp-2)">
                  <div class="hstack">
                    <span class="t-3 fs-sm">المساحة المستعملة</span>
                    <span class="push t-3 fs-sm tabular">${fmtBytes(usageInfo.used)}</span>
                  </div>
                `
              : ''}
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section__head"><div class="section__title">تصدير</div></div>
        <button class="btn btn--primary btn--block" data-act="export">
          ${icon('download')} نزّل نسخة احتياطية
        </button>
        <p class="t-3 fs-sm mt-3">
          ملف واحد يحوي كل فصولك وطلابك ودرجاتهم وحضورهم. يفتحه RAKEEZ X وحده.
        </p>
      </div>

      <div class="section">
        <div class="section__head"><div class="section__title">استيراد</div></div>
        <input type="file" id="restore-file" accept="application/json,.json" class="sr-only"
               data-change="file">
        <button class="btn btn--ghost btn--block" data-act="pick-file">
          ${icon('upload')} استرجع من ملف
        </button>
        <p class="t-3 fs-sm mt-3">
          الاسترجاع يدمج النسخة مع ما عندك ويأخذ الأحدث لكل سجل، فلا تفقد ما رصدته
          بعد أخذ النسخة. ويمكنك اختيار الاستبدال الكامل بدلًا من الدمج.
        </p>
      </div>

      <div class="section">
        <div class="section__head"><div class="section__title">المزامنة السحابية</div></div>
        <div class="card card--pad t-3 fs-sm">
          يعمل رَكيز دون إنترنت أولًا لحفظ سجلاتك محليًا بسرعة وخصوصية. وعند تسجيل الدخول بحسابك، تُزامن بياناتك سحابيًا تلقائيًا لاستمراريتها والوصول إليها من أي جهاز.
        </div>
      </div>

      <div class="section">
        <div class="section__head"><div class="section__title">منطقة الخطر</div></div>
        <button class="btn btn--danger btn--block" data-act="wipe">
          ${icon('trash')} ${LOCAL_RESET_COPY.button}
        </button>
      </div>
    `;
  },

  actions: {
    async export() {
      try {
        await downloadBackup();
        toast('نُزّلت النسخة الاحتياطية');
      } catch (err) {
        console.error(err);
        toast('تعذّر التصدير', 'danger');
      }
    },

    'pick-file'() {
      document.getElementById('restore-file')?.click();
    },

    async file(el) {
      const file = el.files?.[0];
      el.value = '';
      if (!file) return;

      let payload;
      try {
        payload = await readJSONFile(file);
      } catch (err) {
        toast(err.message, 'danger');
        return;
      }

      const counts = payload?.data
        ? Object.entries(payload.data)
            .filter(([, v]) => Array.isArray(v))
            .reduce((n, [, v]) => n + v.length, 0)
        : 0;

      const mode = await openSheet({
        title: 'استرجاع نسخة',
        desc: `الملف يحوي ${counts} سجلًا، صُدّر في ${
          backupExportDate(payload?.exportedAt) || 'تاريخ غير معروف'
        }.`,
        body: html`
          <div class="stack stack-2">
            <button class="radiocard radiocard--btn" data-pick="merge">
              <span class="radiocard__body">
                <span class="radiocard__title">دمج (الموصى به)</span>
                <span class="radiocard__hint">يبقي ما عندك ويأخذ الأحدث لكل سجل.</span>
              </span>
            </button>
            <button class="radiocard radiocard--btn" data-pick="replace">
              <span class="radiocard__body">
                <span class="radiocard__title">استبدال كامل</span>
                <span class="radiocard__hint">يمسح ما على هذا الجهاز ويضع النسخة مكانه.</span>
              </span>
            </button>
          </div>
        `,
        onMount: (root, done) => {
          root.querySelectorAll('[data-pick]').forEach((b) =>
            b.addEventListener('click', () => done(b.dataset.pick))
          );
        },
      });

      if (!mode) return;

      if (mode === 'replace') {
        const ok = await confirmSheet({
          title: 'استبدال كل البيانات؟',
          desc: 'كل ما على هذا الجهاز يُمسح ويحل محله ما في الملف. لا رجعة.',
          confirmLabel: 'استبدل',
          danger: true,
        });
        if (!ok) return;
      }

      try {
        const { written, migration } = await restoreBackup(payload, mode);
        toast(
          migration
            ? `استُرجع ${written} سجلًا ورُحّل إلى شكل RAKEEZ X — يُعاد التحميل`
            : `استُرجع ${written} سجلًا — يُعاد التحميل`
        );
        if (migration?.warnings?.length) console.warn('[rakeezx] ملاحظات ترحيل النسخة:', migration.warnings);
        setTimeout(() => location.reload(), 1100);
      } catch (err) {
        console.error(err);
        toast(err.message ?? 'تعذّر الاسترجاع', 'danger');
      }
    },

    async wipe() {
      const pendingOutbox = await db.getAll('outbox');
      const pendingWarning = pendingOutbox.length ? ` ${LOCAL_RESET_COPY.pendingWarning}` : '';
      const ok = await confirmSheet({
        title: LOCAL_RESET_COPY.title,
        desc: `${LOCAL_RESET_COPY.description}${pendingWarning}`,
        confirmLabel: LOCAL_RESET_COPY.confirmLabel,
        danger: true,
      });
      if (!ok) return;

      const again = await confirmSheet({
        title: LOCAL_RESET_COPY.finalTitle,
        desc: LOCAL_RESET_COPY.finalDescription,
        confirmLabel: LOCAL_RESET_COPY.finalConfirmLabel,
        danger: true,
      });
      if (!again) return;

      await db.clearAll();
      location.reload();
    },
  },
};
