/** Presentation only: all operational truth comes from the Production summary. */
import { html, icon } from './dom.js';
import { projectSyncStatusSeverity } from './sync-status-severity.js';

const STATES = Object.freeze({
  synced: ['متزامن', 'بياناتك الحالية متزامنة مع السحابة.', 'badge--brand'],
  pending: ['تغييرات بانتظار المزامنة', 'توجد تغييرات محفوظة بانتظار المزامنة.', 'badge--neutral'],
  syncing: ['جارٍ مزامنة التغييرات', 'المزامنة تعمل الآن.', 'badge--neutral'],
  error: ['تعذر إكمال المزامنة', 'لم تتأكد مزامنة كل التغييرات مع السحابة بعد.', 'badge--danger'],
  blocked: ['تغييرات تنتظر بيانات مرتبطة', 'بعض التغييرات تنتظر اكتمال بيانات مرتبطة.', 'badge--warn'],
  rejected: ['تعذر اعتماد بعض التغييرات', 'تعذر اعتماد بعض التغييرات في السحابة. إعادة المزامنة وحدها قد لا تعالجها.', 'badge--danger'],
  offline: ['غير متصل', 'ستستأنف المزامنة عند عودة الاتصال.', 'badge--neutral'],
  auth_required: ['يلزم تسجيل الدخول', 'سجّل الدخول لاستئناف المزامنة السحابية.', 'badge--warn'],
  idle: ['محلي', 'لم تبدأ مزامنة سحابية لهذا الحساب.', 'badge--neutral'],
});
const CATEGORIES = Object.freeze({ account: 'الحساب', academic: 'السنة الدراسية', classes: 'الفصول', students: 'الطلاب', assessment: 'الرصد والدرجات', schedule: 'الجدول والحصص', attendance: 'الحضور', reports: 'التقارير' });
const COUNTS = [['pendingCount', 'بانتظار المزامنة'], ['failedCount', 'تعذّر إرسالها'], ['blockedCount', 'تنتظر بيانات مرتبطة'], ['rejectedCount', 'لم تُعتمد في السحابة']];

function savedChanges(count) {
  if (count === 1) return 'تغيير واحد محفوظ';
  if (count === 2) return 'تغييران محفوظان';
  return `${count} ${count >= 3 && count <= 10 ? 'تغييرات محفوظة' : 'تغييرًا محفوظًا'}`;
}

export function syncOperationalPresentation(summary = { state: 'idle' }, now = Date.now()) {
  summary = projectSyncStatusSeverity(summary, now);
  const status = Object.hasOwn(STATES, summary.state) ? summary.state : 'idle';
  let [text, label, badge] = STATES[status];
  if (status === 'pending' && summary.reasonCategory === 'startup_preparing') {
    text = 'جارٍ الاتصال للمزامنة';
    label = 'نتحقق من جاهزية الحساب قبل بدء المزامنة. لم تتأكد المزامنة بعد.';
  } else if (status === 'pending' && summary.presentationSeverity?.transient) {
    text = 'بانتظار المزامنة';
    label = 'لم تتأكد المزامنة مع السحابة بعد. سنحاول مرة أخرى.';
  } else if (status === 'pending' && summary.presentationSeverity?.awaitingVerification && !summary.queuedCount) {
    text = 'بانتظار التحقق من المزامنة';
    label = 'نتحقق من أحدث بيانات السحابة. لم تتأكد المزامنة بعد.';
  }
  const help = summary.actionableSyncIssue === true && ['error', 'blocked', 'rejected'].includes(status);
  // No retryability flag exists for rejected work: do not advertise retry as its remedy.
  const canSync = ['synced', 'pending', 'error', 'blocked'].includes(status) && !summary.automaticSyncActive && summary.reasonCategory !== 'startup_preparing';
  return { status, text, label, badge, help, canSync, summary };
}

export function renderSyncOperationalSection(summary, { compact = false } = {}) {
  const ui = syncOperationalPresentation(summary);
  summary = ui.summary;
  const last = summary.lastSuccessfulSyncAt;
  const lastText = last && Number.isFinite(new Date(last).getTime())
    ? new Date(last).toLocaleString('ar-SA-u-nu-latn', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', numberingSystem: 'latn' }) : 'لم تتم بعد';
  const firstSync = ['pending', 'idle'].includes(ui.status) && !last && summary.queuedCount > 0;
  const needsExplanation = ['error', 'blocked', 'rejected'].includes(ui.status);
  const countText = savedChanges(summary.queuedCount ?? 0);
  const secondary = ui.status === 'synced' ? `آخر مزامنة: ${lastText}`
    : firstSync ? countText
    : ui.status === 'pending' && summary.reasonCategory === 'startup_preparing' ? ui.label
    : ui.status === 'pending' && summary.presentationSeverity?.transient ? ui.label
    : ui.status === 'pending' && summary.presentationSeverity?.awaitingVerification && !summary.queuedCount ? ui.label
    : ['pending', 'syncing'].includes(ui.status) ? countText
    : ui.status === 'idle' && summary.queuedCount > 0 ? `${countText} بانتظار أول مزامنة`
    : ui.status === 'error' ? `${summary.localWorkSaved ? 'بياناتك محفوظة على هذا الجهاز. ' : ''}${summary.automaticRetryActive ? 'سنحاول المزامنة مرة أخرى.' : 'أعد المزامنة أو تواصل مع الدعم.'}`
    : ui.status === 'rejected' ? 'قد تحتاج هذه التغييرات إلى مساعدة الدعم؛ إعادة المزامنة وحدها قد لا تعالجها.'
    : ui.label;
  const categories = ui.status === 'synced' ? [] : (summary.affectedCategories ?? []).map((key) => CATEGORIES[key]).filter(Boolean);
  return html`
    <div class="mini-hub-sync__state ${compact ? 'center-sync-heading' : ''}">
      <span class="sync-dot sync-dot--${ui.status}" aria-hidden="true"></span>
      <span class="fw-7 fs-sm">${compact ? 'حالة المزامنة:' : firstSync ? 'بانتظار أول مزامنة' : 'حالة المزامنة'}</span>
      <span class="badge ${ui.badge}">${firstSync ? 'محلي' : ui.text}</span>
    </div>
    <div class="mini-hub-sync__meta t-2 fs-xs">
      <p><bdi>${secondary}</bdi></p>
    </div>
    <div class="mini-hub-sync__controls">
    <div class="mini-hub-sync__actions">
      ${ui.canSync || ui.status === 'syncing' ? html`<button class="btn btn--sm btn--quiet" data-act="mini-hub-sync-now" ${ui.canSync ? '' : 'disabled'}>${icon('refresh')} ${ui.status === 'syncing' ? 'جارٍ المزامنة…' : 'مزامنة الآن'}</button>` : ''}
      ${ui.help ? html`<a class="btn btn--sm btn--quiet" href="#/support" data-sheet-close>تحتاج مساعدة؟</a>` : ''}
    </div>
    <details class="mini-hub-sync__details">
      <summary>تفاصيل المزامنة</summary>
      <div class="mini-hub-sync__detail-content">
        ${needsExplanation ? html`<p>${ui.label}</p>` : ''}
        ${needsExplanation && summary.localWorkSaved ? html`<p>بياناتك محفوظة على هذا الجهاز.</p>` : ''}
        ${COUNTS.filter(([key]) => summary[key] > 0).map(([key, label]) => html`<p>${label}: <bdi>${summary[key]}</bdi></p>`)}
        <p>آخر مزامنة ناجحة: <bdi>${lastText}</bdi></p>
        ${needsExplanation && summary.automaticRetryActive ? html`<p>سنحاول المزامنة مرة أخرى تلقائيًا.</p>` : ''}
        ${needsExplanation && summary.safeToContinueUnrelatedWork ? html`<p>يمكنك متابعة العمل غير المرتبط بهذه التغييرات.</p>` : ''}
        ${categories.length ? html`<div><p>الأقسام المعنية:</p><div class="mini-hub-sync__categories" aria-label="الأقسام المعنية">${categories.map((label) => html`<span>${label}</span>`)}</div></div>` : ''}
        ${summary.historicalConflictCount > 0 ? html`<p class="mini-hub-sync__historical">اختلافات مزامنة سابقة تمت معالجتها: <bdi>${summary.historicalConflictCount}</bdi></p>` : ''}
      </div>
    </details>
    </div>`;
}
