/** بيانات الجهاز والنسخ الاحتياطي — تستخدم مسارات التشغيل الحالية فقط. */
import { html, icon, toast, confirmSheet, openSheet, fmtDateFull, parentLink } from '../lib/dom.js';
import * as store from '../store.js';
import * as db from '../lib/db.js';
import { downloadBackup, restoreBackup, readJSONFile } from '../lib/export.js';
import { todayISO } from '../models.js';
import { repaint } from '../repaint.js';

let usageInfo = null;
let latestLocalAction = null;

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
const actionTime = (value) => value ? new Intl.DateTimeFormat('ar-SA-u-ca-gregory', {
  day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
}).format(value) : '';

export default {
  title: () => 'البيانات والنسخ الاحتياطي',
  wide: true,
  async onMount() { usageInfo = await db.usage(); repaint(); },
  render() {
    const s = store.state;
    const n = (key) => (s[key] ?? []).filter((record) => !record.deleted).length;
    const counts = {
      'سنوات دراسية': n('years'), 'فصول دراسية': n('terms'), شعب: n('sections'),
      فصول: n('teachings'), طلاب: n('students'), انتسابات: n('enrollments'),
      حصص: n('sessions'), درجات: n('scores'), 'سجلات حضور': n('attendance'), 'رصدات سريعة': n('logs'),
    };
    const totalRecords = Object.values(counts).reduce((sum, count) => sum + count, 0);
    return html`
      <main class="management-page backup-data-page">
        ${parentLink('العودة إلى الإعدادات', '/settings')}
        <section class="data-safety-intro" aria-labelledby="data-safety-title">
          <span class="data-safety-intro__icon">${icon('shield')}</span>
          <div><h2 id="data-safety-title">نسخة أمان لبيانات ركيز</h2><p>النسخة الاحتياطية للاسترداد عند الحاجة، أما الأرشيف فهو لسجلات الأعوام السابقة وعرضها فقط.</p></div>
          <a class="btn btn--info" href="#/archive">${icon('archive')} فتح الأرشيف</a>
        </section>
        <div class="surface surface--flat data-safety-surface">
          <section class="surface__section data-safety-section" aria-labelledby="backup-create-title">
            <div class="data-safety-section__head">
              <span class="data-safety-section__icon is-brand">${icon('download')}</span>
              <div class="data-safety-section__copy"><h2 id="backup-create-title">إنشاء نسخة احتياطية</h2><p>تحمي الفصول والطلاب والحضور والدرجات وسجلات العمل في ملف واحد.</p></div>
              <button class="btn btn--primary data-safety-section__action" data-act="export">${icon('download')} تنزيل نسخة</button>
            </div>
            <div class="backup-action-status" role="status" aria-live="polite">
              <span class="backup-action-status__mark ${latestLocalAction ? 'is-complete' : ''}">${icon(latestLocalAction ? 'check' : 'clock')}</span>
              <span><strong>${latestLocalAction ? 'اكتمل آخر تنزيل في هذه الجلسة' : 'لم تُنزّل نسخة في هذه الجلسة'}</strong><small>${latestLocalAction ? actionTime(latestLocalAction) : 'احتفظ بالملف في مكان آمن يمكنك الوصول إليه لاحقًا.'}</small></span>
            </div>
          </section>
          <section class="surface__section data-safety-section" aria-labelledby="restore-title">
            <div class="data-safety-section__heading"><h2 id="restore-title">الاستعادة والاسترداد</h2><p>اختر المسار المناسب لمكان النسخة التي تريد استعادتها.</p></div>
            <input type="file" id="restore-file" accept="application/json,.json" class="sr-only" data-change="file" aria-label="اختيار ملف نسخة احتياطية للاستعادة">
            <div class="recovery-paths">
              <div class="recovery-path">
                <span class="recovery-path__icon">${icon('device')}</span>
                <div class="recovery-path__copy"><div class="hstack gap-2 wrap"><h3>استعادة من ملف على هذا الجهاز</h3><span class="badge badge--ok">متاحة</span></div><p>يفحص ركيز الملف أولًا، ثم يتيح الدمج الآمن أو الاستبدال الكامل على هذا الجهاز.</p></div>
                <button class="btn btn--ghost recovery-path__action" data-act="pick-file">${icon('upload')} اختيار ملف</button>
              </div>
              <div class="recovery-path recovery-path--future" aria-describedby="cloud-recovery-note">
                <span class="recovery-path__icon is-info">${icon('cloud')}</span>
                <div class="recovery-path__copy"><div class="hstack gap-2 wrap"><h3>استعادة متصلة بالحساب</h3><span class="badge badge--info">غير مفعّلة من هذه الشاشة</span></div><p id="cloud-recovery-note">ستراجع النسخة وتأثيرها قبل تأكيد استعادتها إلى بيانات الحساب المتصلة. لا يبدأ هذا المسار حاليًا من هنا.</p></div>
                <button class="btn btn--info recovery-path__action" disabled aria-disabled="true">مراجعة النسخة</button>
              </div>
            </div>
          </section>
          <details class="surface__section data-inventory">
            <summary><span class="data-inventory__summary"><span class="data-safety-section__icon">${icon('reports')}</span><span><strong>محتوى سجل ركيز الحالي</strong><small>تفاصيل البيانات التي تدخل في النسخة</small></span></span><span class="data-inventory__meta"><bdi class="tabular">${totalRecords}</bdi> سجلًا ${icon('chev')}</span></summary>
            <div class="data-inventory__body">
              <dl class="data-inventory__grid">${Object.entries(counts).map(([label, count]) => html`<div><dt>${label}</dt><dd class="tabular">${count}</dd></div>`)}</dl>
              ${usageInfo ? html`<div class="data-inventory__storage"><span>المساحة المستعملة على هذا الجهاز</span><bdi class="tabular">${fmtBytes(usageInfo.used)}</bdi></div>` : ''}
            </div>
          </details>
        </div>
        <section class="data-danger-zone" aria-labelledby="local-reset-title">
          <div><h2 id="local-reset-title">إعادة ضبط هذا الجهاز</h2><p>يمسح سجل ركيز المحلي من هذا الجهاز. لا تستخدمه كبديل عن إنشاء نسخة احتياطية.</p></div>
          <button class="btn btn--danger" data-act="wipe">${icon('trash')} ${LOCAL_RESET_COPY.button}</button>
        </section>
      </main>`;
  },
  actions: {
    async export() {
      try { await downloadBackup(); latestLocalAction = new Date(); toast('نُزّلت النسخة الاحتياطية'); repaint(); }
      catch (err) { console.error(err); toast('تعذّر التصدير', 'danger'); }
    },
    'pick-file'() { document.getElementById('restore-file')?.click(); },
    async file(el) {
      const file = el.files?.[0]; el.value = ''; if (!file) return;
      let payload;
      try { payload = await readJSONFile(file); } catch (err) { toast(err.message, 'danger'); return; }
      const counts = payload?.data ? Object.entries(payload.data).filter(([, value]) => Array.isArray(value)).reduce((sum, [, records]) => sum + records.length, 0) : 0;
      const mode = await openSheet({
        title: 'استعادة نسخة على هذا الجهاز',
        desc: `تم فحص الملف: ${counts} سجلًا، صُدّر في ${backupExportDate(payload?.exportedAt) || 'تاريخ غير معروف'}.`,
        body: html`<div class="recovery-review-note">${icon('device')}<span><strong>هذه استعادة محلية</strong><small>سيُطبّق اختيارك على سجل ركيز في هذا الجهاز.</small></span></div><div class="stack stack-2 mt-3"><button class="radiocard radiocard--btn" data-pick="merge" autofocus><span class="radiocard__body"><span class="radiocard__title">دمج السجلات <span class="badge badge--brand">موصى به</span></span><span class="radiocard__hint">يبقي ما على الجهاز ويأخذ الأحدث لكل سجل.</span></span></button><button class="radiocard radiocard--btn recovery-replace-option" data-pick="replace"><span class="radiocard__body"><span class="radiocard__title">استبدال كامل</span><span class="radiocard__hint">يمسح ما على هذا الجهاز ويضع محتوى النسخة مكانه. سيُطلب تأكيد إضافي.</span></span></button></div>`,
        onMount: (root, done) => root.querySelectorAll('[data-pick]').forEach((button) => button.addEventListener('click', () => done(button.dataset.pick))),
      });
      if (!mode) return;
      if (mode === 'replace') {
        const ok = await confirmSheet({ title: 'استبدال كل البيانات؟', desc: 'كل ما على هذا الجهاز يُمسح ويحل محله ما في الملف. لا رجعة.', confirmLabel: 'استبدل', danger: true });
        if (!ok) return;
      }
      try {
        const { written, migration } = await restoreBackup(payload, mode);
        toast(migration ? `استُرجع ${written} سجلًا ورُحّل إلى شكل RAKEEZ X — يُعاد التحميل` : `استُرجع ${written} سجلًا — يُعاد التحميل`);
        if (migration?.warnings?.length) console.warn('[rakeezx] ملاحظات ترحيل النسخة:', migration.warnings);
        setTimeout(() => location.reload(), 1100);
      } catch (err) { console.error(err); toast(err.message ?? 'تعذّر الاسترجاع', 'danger'); }
    },
    async wipe() {
      const pendingOutbox = await db.getAll('outbox');
      const pendingWarning = pendingOutbox.length ? ` ${LOCAL_RESET_COPY.pendingWarning}` : '';
      const ok = await confirmSheet({ title: LOCAL_RESET_COPY.title, desc: `${LOCAL_RESET_COPY.description}${pendingWarning}`, confirmLabel: LOCAL_RESET_COPY.confirmLabel, danger: true });
      if (!ok) return;
      const again = await confirmSheet({ title: LOCAL_RESET_COPY.finalTitle, desc: LOCAL_RESET_COPY.finalDescription, confirmLabel: LOCAL_RESET_COPY.finalConfirmLabel, danger: true });
      if (!again) return;
      await db.clearAll(); location.reload();
    },
  },
};
