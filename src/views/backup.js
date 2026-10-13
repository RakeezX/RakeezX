/** بيانات الجهاز والنسخ الاحتياطي — تستخدم مسارات التشغيل الحالية فقط. */
import { html, icon, toast, confirmSheet, openSheet, fmtDateFull, parentLink } from '../lib/dom.js';
import * as store from '../store.js';
import * as db from '../lib/db.js';
import * as cloud from '../lib/cloud.js';
import * as sync from '../lib/sync.js';
import { downloadBackup, readJSONFile, validateBackup, validateBackupIntegrity } from '../lib/export.js';
import {
  getCloudRestoreResumeState, previewCloudRestore, restoreBackupToCloud, resumeCloudRestore,
} from '../lib/backup-v2.js';
import {
  CLOUD_RECOVERY_STATE_META, cloudRecoveryErrorPresentation,
  groupCloudRestoreEntries, summarizeCloudRestorePlan,
} from '../lib/cloud-recovery-ui.js';
import {
  CANONICAL_PRODUCTION_ORIGIN,
  LEGACY_WORKSPACE_CLAIM_CONFIRMATION,
  createLegacyWorkspaceClaimService,
} from '../lib/workspace-claim.js';
import { createWorkspaceRegistry, resolveWorkspace } from '../lib/workspaces.js';
import { runtimeSyncOwnershipGuard } from '../lib/sync-ownership.js';
import {
  finalizeCurriculumBootstrap, initializeCurriculumSyncGate, readCurriculumBootstrapStatus,
  submitCurriculumBootstrap,
} from '../lib/curriculum-bootstrap.js';
import { todayISO } from '../models.js';
import { repaint } from '../repaint.js';

let usageInfo = null;
let latestLocalAction = null;
let cloudResumeState = null;
let cloudResumeError = null;
let backupViewRevision = 0;
let latestVerifiedBackup = null;
let legacyClaimState = { phase: 'hidden', error: null, pendingRecovery: false };
let legacyClaimService = null;
let curriculumBootstrap = { phase: 'hidden', status: null, error: null };

const claimCanonicalOrigin = () => import.meta.env?.DEV
  ? globalThis.location?.origin ?? CANONICAL_PRODUCTION_ORIGIN
  : CANONICAL_PRODUCTION_ORIGIN;

const emptyCloudRecovery = () => ({
  phase: 'idle', fileName: '', payload: null, structural: null, validation: null,
  plan: null, error: null, result: null, busy: false,
});
let cloudRecovery = emptyCloudRecovery();

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
  day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', numberingSystem: 'latn',
}).format(value) : '';

const cloudPhaseStep = (phase) => ({
  idle: 0, reading: 0, validating: 1, validated: 1, previewing: 2, review: 2,
  restoring: 3, resuming: 3, success: 4, error: 1,
})[phase] ?? 0;

function setCloudRecovery(update, { focus = true } = {}) {
  cloudRecovery = { ...cloudRecovery, ...update };
  repaint();
  if (focus && typeof document !== 'undefined') {
    setTimeout(() => document.querySelector('[data-cloud-focus]')?.focus({ preventScroll: true }), 0);
  }
}

function cloudAvailability() {
  if (cloudResumeState || cloudResumeError) return { label: 'يلزم الإكمال', badge: 'badge--warn' };
  if (!cloud.session || !cloud.user) return { label: 'يلزم تسجيل الدخول', badge: 'badge--neutral' };
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return { label: 'يلزم الاتصال', badge: 'badge--neutral' };
  const status = sync.displayState();
  if (status.detailStatus === 'synced') return { label: 'متصلة بالحساب', badge: 'badge--ok' };
  return { label: 'تُفحص الجاهزية عند المتابعة', badge: 'badge--info' };
}

function renderCloudSteps() {
  const current = cloudPhaseStep(cloudRecovery.phase);
  const labels = ['اختيار النسخة', 'التحقق', 'المراجعة', 'الاستعادة'];
  return html`<ol class="cloud-recovery-steps" aria-label="مراحل الاستعادة السحابية">
    ${labels.map((label, index) => html`<li class="${current > index ? 'is-complete' : current === index ? 'is-current' : ''}" ${current === index ? html`aria-current="step"` : ''}>
      <span>${current > index ? icon('check') : index + 1}</span><small>${label}</small>
    </li>`)}
  </ol>`;
}

function renderValidationState() {
  if (!cloudRecovery.payload && cloudRecovery.phase !== 'error') return '';
  const structuralOk = cloudRecovery.structural?.ok === true;
  const validationOk = cloudRecovery.validation?.ok === true;
  const isV3 = cloudRecovery.payload?.version === 3;
  return html`<div class="cloud-validation" aria-label="حالة التحقق من النسخة">
    <div class="cloud-validation__item is-complete">${icon('check')}<span><strong>تم قراءة الملف</strong><small>${cloudRecovery.fileName}</small></span></div>
    <div class="cloud-validation__item ${structuralOk ? 'is-complete' : cloudRecovery.structural ? 'is-error' : 'is-pending'}">
      ${structuralOk ? icon('check') : icon('shield')}
      <span><strong>${structuralOk ? 'تم التحقق من بنية النسخة' : cloudRecovery.structural ? 'تعذّر التحقق من بنية النسخة' : 'جارٍ التحقق من بنية النسخة…'}</strong>
      ${cloudRecovery.structural && !structuralOk ? html`<small>${cloudRecovery.structural.errors?.[0] ?? 'بنية الملف غير صالحة.'}</small>` : ''}</span>
    </div>
    ${structuralOk ? html`<div class="cloud-validation__item ${isV3 || validationOk ? 'is-complete' : cloudRecovery.validation ? 'is-error' : 'is-pending'}">
      ${isV3 || validationOk ? icon('check') : icon('shield')}
      <span><strong>${isV3 ? 'تحقق بنيوي لإصدار V3' : validationOk ? 'تم التحقق من سلامة النسخة' : cloudRecovery.validation ? 'تعذّر التحقق من سلامة النسخة' : 'جارٍ التحقق من سلامة النسخة…'}</strong>
      <small>${isV3 ? 'لا يتضمن هذا الإصدار تحقق سلامة V4.' : cloudRecovery.validation && !validationOk ? cloudRecovery.validation.errors?.at(-1) : `نسخة V4 · ${cloudRecovery.validation?.total ?? cloudRecovery.structural?.total ?? 0} سجلًا`}</small></span>
    </div>` : ''}
  </div>`;
}

const stateActionCopy = (state) => ({
  add: 'ستُضاف إلى بيانات الحساب.',
  update: 'ستُحدّث بالقيمة الآمنة من النسخة.',
  delete: 'ستُحذف من بيانات الحساب بعد التأكيد.',
  keep: 'لن تتغير.',
  cloudOnly: 'ستبقى في السحابة كما هي.',
  blocked: 'تمنع تنفيذ الاستعادة كاملة.',
})[state];

function renderPlanSummary(plan) {
  const summary = summarizeCloudRestorePlan(plan);
  return html`
    <div class="cloud-plan-summary" aria-label="ملخص تأثير الاستعادة">
      ${Object.entries(CLOUD_RECOVERY_STATE_META).map(([key, meta]) => html`
        <div class="cloud-plan-metric is-${meta.tone}">
          <span>${meta.label}</span><strong class="tabular">${summary[key]}</strong>
        </div>`)}
    </div>
    <details class="cloud-plan-details" ${plan.ready ? '' : 'open'}>
      <summary><span>تفاصيل المراجعة</span><span class="badge ${plan.ready ? 'badge--neutral' : 'badge--warn'}">${plan.entries.length} سجلًا</span></summary>
      <div class="cloud-plan-details__list">
        ${groupCloudRestoreEntries(plan).map((group) => {
          const meta = CLOUD_RECOVERY_STATE_META[group.state];
          return html`<div class="cloud-plan-row is-${meta.tone}">
            <span class="cloud-plan-row__mark" aria-hidden="true">${group.state === 'blocked' ? icon('shield') : group.state === 'delete' ? icon('trash') : icon('check')}</span>
            <span><strong>${group.label}</strong><small>${group.reason || stateActionCopy(group.state)}</small></span>
            <span class="cloud-plan-row__end"><bdi class="tabular">${group.count}</bdi><span class="badge badge--${group.state === 'blocked' ? 'warn' : group.state === 'delete' ? 'danger' : group.state === 'add' ? 'ok' : group.state === 'update' ? 'info' : 'neutral'}">${meta.short}</span></span>
          </div>`;
        })}
      </div>
    </details>
    <div class="cloud-local-only-note">${icon('device')}<span>بعض البيانات المحلية الخاصة بهذا الجهاز لا تدخل ضمن المقارنة السحابية.</span></div>`;
}

function renderCloudError(error) {
  if (!error) return '';
  return html`<div class="cloud-recovery-message is-error" role="alert" tabindex="-1" data-cloud-focus>
    <span aria-hidden="true">${icon('shield')}</span><span><strong>${error.title}</strong><small>${error.message}</small></span>
  </div>`;
}

function renderResumeState() {
  if (cloudResumeError) return html`<section class="cloud-resume-panel is-error" aria-labelledby="cloud-resume-title" tabindex="-1" data-cloud-focus>
    <span class="cloud-resume-panel__icon">${icon('shield')}</span>
    <div><h3 id="cloud-resume-title">${cloudResumeError.title}</h3><p>${cloudResumeError.message}</p></div>
  </section>`;
  if (!cloudResumeState) return '';
  const finalized = cloudResumeState.state === 'finalized';
  return html`<section class="cloud-resume-panel" aria-labelledby="cloud-resume-title" tabindex="-1" data-cloud-focus>
    <span class="cloud-resume-panel__icon">${icon(finalized ? 'device' : 'cloud')}</span>
    <div><span class="badge badge--warn">إكمال مطلوب</span><h3 id="cloud-resume-title">${finalized ? 'اكتملت الاستعادة في السحابة' : 'بدأت الاستعادة السحابية الآمنة'}</h3>
      <p>${finalized ? 'يحتاج هذا الجهاز إلى إكمال التحديث بالنسخة النهائية.' : 'تحتاج العملية المحفوظة إلى إكمال التنفيذ على السحابة وهذا الجهاز.'}</p></div>
    <button class="btn btn--primary" data-act="resume-cloud" ${cloudRecovery.busy ? html`disabled` : ''}>${icon('refresh')} ${cloudRecovery.busy ? 'جارٍ الإكمال…' : 'إكمال تحديث هذا الجهاز'}</button>
  </section>`;
}

function renderRestoreProgress() {
  const resuming = cloudRecovery.phase === 'resuming';
  return html`<div class="cloud-restore-progress" role="status" aria-live="polite" tabindex="-1" data-cloud-focus>
    <div class="cloud-restore-progress__head">${icon('cloud')}<span><strong>${resuming ? 'جارٍ إكمال الاستعادة المحفوظة' : 'جارٍ استعادة النسخة بأمان'}</strong><small>لا تغلق رَكيز حتى يكتمل التحديث.</small></span></div>
    <ol>
      <li class="is-active"><span>${icon('refresh')}</span><strong>تنفيذ الاستعادة السحابية</strong></li>
      <li><span>${icon('device')}</span><strong>تحديث هذا الجهاز بالنسخة النهائية</strong></li>
    </ol>
  </div>`;
}

function renderCloudFlow() {
  if (['restoring', 'resuming'].includes(cloudRecovery.phase)) return html`<section class="cloud-recovery-flow">${renderCloudSteps()}${renderRestoreProgress()}</section>`;
  if (cloudResumeState || cloudResumeError) return renderResumeState();
  if (cloudRecovery.phase === 'idle') return '';
  if (cloudRecovery.phase === 'success') {
    const summary = summarizeCloudRestorePlan(cloudRecovery.result?.plan);
    return html`<section class="cloud-recovery-flow">${renderCloudSteps()}<div class="cloud-recovery-message is-success" role="status" tabindex="-1" data-cloud-focus>
      <span>${icon('check')}</span><span><strong>تمت استعادة بياناتك بنجاح</strong><small>${cloudRecovery.result?.plan ? `أُضيف ${summary.add}، وتحدّث ${summary.update}، وحُذف ${summary.delete}. ` : ''}هذا الجهاز محدث بالنسخة النهائية.</small></span>
      <button class="btn btn--ghost" data-act="reset-cloud">إنهاء</button>
    </div></section>`;
  }
  const canPreview = cloudRecovery.payload && cloudRecovery.validation?.ok && !cloudRecovery.busy;
  return html`<section class="cloud-recovery-flow" aria-labelledby="cloud-flow-title">
    <div class="cloud-recovery-flow__head"><div><span class="eyebrow">استعادة متقدمة</span><h3 id="cloud-flow-title">مراجعة النسخة قبل استعادتها</h3></div><button class="btn btn--quiet btn--sm" data-act="reset-cloud" ${cloudRecovery.busy ? html`disabled` : ''}>اختيار نسخة أخرى</button></div>
    ${renderCloudSteps()}
    ${renderValidationState()}
    ${renderCloudError(cloudRecovery.error)}
    ${cloudRecovery.phase === 'previewing' ? html`<div class="cloud-recovery-message" role="status" aria-live="polite" tabindex="-1" data-cloud-focus>${icon('cloud')}<span><strong>جارٍ إعداد المقارنة السحابية الآمنة…</strong><small>يتحقق رَكيز من الحساب وحالة المزامنة قبل عرض الخطة.</small></span></div>` : ''}
    ${cloudRecovery.plan ? renderPlanSummary(cloudRecovery.plan) : ''}
    <div class="cloud-recovery-flow__actions">
      ${cloudRecovery.plan ? html`
        <button class="btn btn--primary" data-act="confirm-cloud" ${!cloudRecovery.plan.ready || cloudRecovery.busy ? html`disabled aria-disabled="true"` : ''}>المتابعة إلى التأكيد</button>
        ${!cloudRecovery.plan.ready ? html`<span class="cloud-recovery-blocked-copy">وجود أي عنصر محظور يمنع الاستعادة كاملة.</span>` : ''}
      ` : canPreview ? html`<button class="btn btn--info" data-act="preview-cloud">${icon('cloud')} متابعة إلى المعاينة السحابية</button>` : ''}
    </div>
  </section>`;
}

async function cloudRestoreConfirmation(plan) {
  const summary = summarizeCloudRestorePlan(plan);
  return openSheet({
    title: 'تأكيد الاستعادة السحابية الآمنة',
    desc: 'هذه الخطوة تطبق الخطة كاملة على بيانات الحساب، ثم تُحدّث هذا الجهاز بالنسخة النهائية.',
    body: html`<div class="cloud-confirm-summary">
      <div><span>إضافات</span><strong class="tabular">${summary.add}</strong></div>
      <div><span>تحديثات</span><strong class="tabular">${summary.update}</strong></div>
      <div class="is-delete"><span>حذف</span><strong class="tabular">${summary.delete}</strong></div>
    </div><p class="cloud-confirm-note">تحقق من عدد السجلات التي ستُحذف. لا توفر هذه العملية تراجعًا، ولا تستبدل السحابة بالقوة.</p>`,
    foot: html`<button class="btn btn--ghost" data-sheet-close autofocus>إلغاء</button><button class="btn btn--primary" data-cloud-confirm>استعادة النسخة بأمان</button>`,
    onMount: (root, done) => root.querySelector('[data-cloud-confirm]')?.addEventListener('click', () => done(true)),
  }).then((value) => value === true);
}

async function refreshResumeState() {
  try {
    cloudResumeState = await getCloudRestoreResumeState();
    cloudResumeError = null;
  } catch (error) {
    cloudResumeState = null;
    cloudResumeError = cloudRecoveryErrorPresentation(error);
  }
}

function presentCloudError(error) {
  if (cloud.isAuthRequiredError?.(error) && error.code !== 'AUTH_REQUIRED') {
    return cloudRecoveryErrorPresentation({ ...error, code: 'AUTH_REQUIRED' });
  }
  return cloudRecoveryErrorPresentation(error);
}

const claimErrorPresentation = (error) => {
  const code = error?.code ?? 'WORKSPACE_CLAIM_FAILED';
  if (['WORKSPACE_CLAIM_IDENTITY_UNVERIFIED', 'AUTH_REQUIRED'].includes(code)) {
    return 'تعذّر التحقق من هوية الحساب. تأكد من الاتصال ثم أعد المحاولة.';
  }
  if (['WORKSPACE_CLAIM_EVIDENCE_CONFLICT', 'WORKSPACE_CLAIM_OUTBOX_CONFLICT',
    'WORKSPACE_CLAIM_CONFLICT', 'WORKSPACE_REGISTRY_MISMATCH'].includes(code)) {
    return 'توقّف الربط لأن دليل الملكية أو سجل المزامنة غير متطابق. لم تتغير بياناتك.';
  }
  if (['WORKSPACE_CLAIM_RECONCILIATION_PENDING', 'SYNC_BUSY'].includes(code)) {
    return 'توجد عملية أخرى تحتاج إلى الاكتمال قبل ربط السجل. لم تتغير بياناتك.';
  }
  return 'تعذّر ربط السجل بأمان. لم تتغير بياناتك، ولن يعيد رَكيز المحاولة تلقائيًا.';
};

async function refreshLegacyClaimState() {
  const userId = String(cloud.user?.id ?? '').trim().toLowerCase();
  const marker = store.state.device?.workspaceClaim ?? null;
  const workspace = runtimeSyncOwnershipGuard.getWorkspace();
  if (marker?.state === 'claimed' && (!cloud.session || !userId)) {
    runtimeSyncOwnershipGuard.setWorkspace({
      type: 'unresolved', ownershipState: 'unresolved', reason: 'claimed-workspace-signed-out',
    });
    legacyClaimState = { phase: 'hidden', error: null, pendingRecovery: false };
    return;
  }
  if (!cloud.session || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId) ||
      workspace?.type === 'demo') {
    legacyClaimState = { phase: 'hidden', error: null, pendingRecovery: false };
    return;
  }
  if (marker?.state === 'claimed') {
    if (String(marker.ownerId ?? '').toLowerCase() !== userId) {
      runtimeSyncOwnershipGuard.setWorkspace({
        type: 'unresolved', ownershipState: 'unresolved', reason: 'claimed-workspace-owner-mismatch',
      });
      legacyClaimState = { phase: 'blocked', error: 'هذا السجل مرتبط بحساب آخر على هذا الجهاز.', pendingRecovery: false };
      return;
    }
    const registry = createWorkspaceRegistry();
    try {
      const resolved = await resolveWorkspace({ type: 'account', authUserId: userId, legacyDetected: true }, { registry });
      if (resolved.status !== 'resolved' || resolved.workspace?.databaseName !== 'rakeezx' ||
          resolved.workspace?.claimId !== marker.claimId) {
        legacyClaimState = { phase: 'blocked', error: 'بيانات ربط السجل تحتاج إلى مراجعة قبل المتابعة.', pendingRecovery: false };
        return;
      }
      runtimeSyncOwnershipGuard.setWorkspace(resolved.workspace);
      legacyClaimState = { phase: 'claimed', error: null, pendingRecovery: false };
      return;
    } finally {
      await registry.close();
    }
  }
  if (marker && marker.state !== 'registry_pending') {
    legacyClaimState = { phase: 'blocked', error: 'حالة ربط السجل غير معروفة. لم يُنفّذ أي تغيير.', pendingRecovery: false };
    return;
  }
  if (marker?.state === 'registry_pending' && String(marker.ownerId ?? '').toLowerCase() !== userId) {
    legacyClaimState = { phase: 'blocked', error: 'محاولة الربط المحفوظة تخص حسابًا آخر.', pendingRecovery: true };
    return;
  }
  if (workspace?.type !== 'legacy' || workspace?.ownershipState !== 'unclaimed' ||
      workspace?.databaseName !== 'rakeezx' || !store.state.device?.deviceId ||
      globalThis.location?.origin !== claimCanonicalOrigin()) {
    legacyClaimState = { phase: 'hidden', error: null, pendingRecovery: false };
    return;
  }
  legacyClaimState = {
    phase: typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'eligible',
    error: null,
    pendingRecovery: marker?.state === 'registry_pending',
  };
}

function renderLegacyClaimSection() {
  const state = legacyClaimState;
  if (state.phase === 'hidden') return '';
  if (state.phase === 'claimed') return html`<section class="surface__section data-safety-section" aria-labelledby="legacy-claim-title">
    <div class="data-safety-section__head">
      <span class="data-safety-section__icon is-brand">${icon('shield')}</span>
      <div class="data-safety-section__copy"><h2 id="legacy-claim-title">السجل المحلي مرتبط بالحساب</h2><p>هذا السجل المحلي محفوظ لهذا الحساب على هذا الجهاز.</p></div>
      <span class="badge badge--ok">تم الربط</span>
    </div>
  </section>`;
  const busy = state.phase === 'busy';
  const blocked = state.phase === 'blocked';
  const offline = state.phase === 'offline';
  const backupReady = !!latestVerifiedBackup &&
    String(latestVerifiedBackup.sourceOwnerId ?? '').toLowerCase() === String(cloud.user?.id ?? '').toLowerCase();
  return html`<section class="surface__section data-safety-section" aria-labelledby="legacy-claim-title">
    <div class="data-safety-section__head">
      <span class="data-safety-section__icon is-info">${icon('shield')}</span>
      <div class="data-safety-section__copy"><h2 id="legacy-claim-title">ربط السجل المحلي بالحساب</h2><p>${state.pendingRecovery
        ? 'توجد محاولة ربط محفوظة يمكن إكمالها بأمان للحساب نفسه.'
        : 'يربط سجل ركيز الموجود في هذا المتصفح بالحساب بعد فحص الهوية والتعارضات.'}</p></div>
      ${blocked ? '' : html`<button class="btn btn--info data-safety-section__action" data-act="claim-legacy-workspace"
        ${busy || offline || !backupReady ? html`disabled aria-disabled="true"` : ''}>${busy ? 'جارٍ التحقق والربط…' : 'ربط السجل المحلي بالحساب'}</button>`}
    </div>
    ${offline ? html`<div class="cloud-recovery-message is-error" role="status">${icon('cloud')}<span><strong>يلزم الاتصال للربط الأول</strong><small>يمكنك متابعة استخدام ركيز محليًا، ثم العودة عند توفر الاتصال.</small></span></div>` : ''}
    ${!blocked && !backupReady ? html`<div class="backup-action-status"><span class="backup-action-status__mark">${icon('download')}</span><span><strong>نزّل نسخة احتياطية حديثة أولًا</strong><small>بعد اكتمال التنزيل في هذه الجلسة سيصبح إجراء الربط متاحًا.</small></span></div>` : ''}
    ${state.error ? html`<div class="cloud-recovery-message is-error" role="alert">${icon('shield')}<span><strong>لم يُنفّذ الربط</strong><small>${state.error}</small></span></div>` : ''}
  </section>`;
}

async function refreshCurriculumBootstrapState() {
  const workspace = runtimeSyncOwnershipGuard.getWorkspace();
  if (workspace?.type !== 'account' || workspace?.ownershipState !== 'claimed' || workspace?.syncEligible !== true ||
      !cloud.session || String(cloud.user?.id ?? '').toLowerCase() !== String(workspace.authUserId ?? '').toLowerCase()) {
    curriculumBootstrap = { phase: 'hidden', status: null, error: null };
    return;
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    curriculumBootstrap = { phase: 'offline', status: null, error: null };
    return;
  }
  try {
    const status = await readCurriculumBootstrapStatus({ workspace });
    const localReady = store.state.device?.curriculumSyncBootstrap?.state === 'COMPLETE' &&
      store.state.device?.curriculumSyncBootstrap?.bootstrapId === status.bootstrapId;
    curriculumBootstrap = {
      phase: status.state === 'COMPLETE' && localReady ? 'complete' :
        status.state === 'CONFLICT' ? 'conflict' : status.state === 'FAILED' ? 'failed' : 'ready',
      status, error: null,
    };
  } catch (error) {
    curriculumBootstrap = { phase: 'failed', status: null, error: 'تعذّر التحقق من جاهزية مزامنة المنهج.' };
  }
}

function renderCurriculumBootstrapSection() {
  if (curriculumBootstrap.phase === 'hidden') return '';
  const status = curriculumBootstrap.status;
  const backupReady = !!latestVerifiedBackup &&
    String(latestVerifiedBackup.sourceOwnerId ?? '').toLowerCase() === String(cloud.user?.id ?? '').toLowerCase();
  const busy = curriculumBootstrap.phase === 'busy';
  if (curriculumBootstrap.phase === 'complete') return html`<section class="surface__section data-safety-section" aria-labelledby="curriculum-sync-title">
    <div class="data-safety-section__head"><span class="data-safety-section__icon is-brand">${icon('check')}</span>
      <div class="data-safety-section__copy"><h2 id="curriculum-sync-title">المنهج محفوظ مع الحساب</h2><p>أصبحت الوحدات والدروس على هذا الجهاز متوافقة مع النسخة السحابية.</p></div>
      <span class="badge badge--ok">مكتمل</span></div>
  </section>`;
  const needsReconcile = status?.state === 'COMPLETE';
  return html`<section class="surface__section data-safety-section" aria-labelledby="curriculum-sync-title">
    <div class="data-safety-section__head"><span class="data-safety-section__icon is-info">${icon('cloud')}</span>
      <div class="data-safety-section__copy"><h2 id="curriculum-sync-title">حفظ المنهج مع الحساب</h2><p>${
        curriculumBootstrap.phase === 'conflict' ? 'توجد نسختان مختلفتان من وحدة أو درس. لم يستبدل ركيز أي بيانات.' :
        needsReconcile ? 'راجع وحدات ودروس هذا الجهاز بأمان قبل تفعيل مزامنتها.' :
        'أنشئ نسخة احتياطية أولًا، ثم احفظ الوحدات والدروس الحالية مع الحساب.'}</p></div>
      ${['conflict', 'offline'].includes(curriculumBootstrap.phase) ? '' : html`<button class="btn btn--info data-safety-section__action" data-act="bootstrap-curriculum"
        ${busy || !backupReady ? html`disabled aria-disabled="true"` : ''}>${busy ? 'جارٍ التحقق…' : needsReconcile ? 'مراجعة منهج هذا الجهاز' : 'تهيئة حفظ المنهج'}</button>`}
    </div>
    ${!backupReady && !['conflict', 'offline'].includes(curriculumBootstrap.phase) ? html`<div class="backup-action-status"><span class="backup-action-status__mark">${icon('download')}</span><span><strong>نزّل نسخة احتياطية حديثة أولًا</strong><small>لن يبدأ حفظ المنهج السحابي قبل التحقق من النسخة.</small></span></div>` : ''}
    ${curriculumBootstrap.phase === 'offline' ? html`<div class="cloud-recovery-message is-error" role="status"><span><strong>يلزم الاتصال للتهيئة الأولى</strong><small>يبقى المنهج المحلي متاحًا دون اتصال.</small></span></div>` : ''}
    ${curriculumBootstrap.phase === 'conflict' ? html`<div class="cloud-recovery-message is-error" role="alert"><span><strong>توقفت التهيئة لحماية البيانات</strong><small>لم تُستبدل الوحدات أو الدروس المختلفة. يلزم مسار مراجعة منفصل.</small></span></div>` : ''}
    ${curriculumBootstrap.error ? html`<div class="cloud-recovery-message is-error" role="alert"><span><strong>لم تكتمل التهيئة</strong><small>${curriculumBootstrap.error}</small></span></div>` : ''}
  </section>`;
}

function confirmLegacyClaim(email) {
  return openSheet({
    title: 'تأكيد ربط السجل المحلي بالحساب',
    desc: 'سيُفحص الحساب وسجل المزامنة مرة أخرى قبل أي كتابة.',
    body: html`<div class="stack stack-3">
      <p>الحساب: <bdi dir="ltr">${email}</bdi></p>
      <div class="recovery-review-note">${icon('device')}<span><strong>الهدف هو سجل ركيز الموجود في هذا المتصفح والجهاز</strong><small>لن تُنسخ قاعدة البيانات أو تتغير معرّفات الفصول والطلاب والسجلات.</small></span></div>
      <p class="t-3 fs-sm">بالمتابعة تؤكد أن النسخة الاحتياطية الحديثة محفوظة، وأن تبويبات ركيز الأخرى مغلقة، وأنك أوقفت التعديل مؤقتًا.</p>
    </div>`,
    foot: html`<button class="btn btn--ghost" data-sheet-close>إلغاء</button><button class="btn btn--primary" data-claim-confirm>نعم، اربط السجل</button>`,
    onMount: (root, done) => root.querySelector('[data-claim-confirm]')?.addEventListener('click', () => done(true)),
  }).then((value) => value === true);
}

export default {
  title: () => 'البيانات والنسخ الاحتياطي',
  wide: true,
  async onMount() {
    const revision = ++backupViewRevision;
    const nextUsage = await db.usage();
    if (store.getActiveWorkspace()?.type === 'demo') {
      if (revision !== backupViewRevision) return;
      usageInfo = nextUsage;
      cloudResumeState = null;
      cloudResumeError = null;
      legacyClaimState = { phase: 'hidden', error: null, pendingRecovery: false };
      curriculumBootstrap = { phase: 'hidden', status: null, error: null };
      repaint();
      return;
    }
    let nextResume = null;
    let nextResumeError = null;
    try { nextResume = await getCloudRestoreResumeState(); }
    catch (error) { nextResumeError = cloudRecoveryErrorPresentation(error); }
    if (revision !== backupViewRevision) return;
    usageInfo = nextUsage;
    cloudResumeState = nextResume;
    cloudResumeError = nextResumeError;
    await refreshLegacyClaimState();
    await refreshCurriculumBootstrapState();
    repaint();
  },
  onUnmount() {
    backupViewRevision += 1;
    cloudRecovery = emptyCloudRecovery();
    cloudResumeState = null;
    cloudResumeError = null;
    legacyClaimState = { phase: 'hidden', error: null, pendingRecovery: false };
    curriculumBootstrap = { phase: 'hidden', status: null, error: null };
  },
  render() {
    const s = store.state;
    const demo = store.getActiveWorkspace()?.type === 'demo';
    const n = (key) => (s[key] ?? []).filter((record) => !record.deleted).length;
    const counts = {
      'سنوات دراسية': n('years'), 'فصول دراسية': n('terms'), شعب: n('sections'),
      فصول: n('teachings'), طلاب: n('students'), انتسابات: n('enrollments'),
      حصص: n('sessions'), درجات: n('scores'), 'سجلات حضور': n('attendance'), 'رصدات سريعة': n('logs'),
    };
    const totalRecords = Object.values(counts).reduce((sum, count) => sum + count, 0);
    const availability = cloudAvailability();
    const cloudStartBlocked = !!cloudResumeState || !!cloudResumeError || cloudRecovery.busy;
    if (demo) return html`
      <main class="management-page backup-data-page" data-demo-data-guard>
        ${parentLink('العودة إلى الإعدادات', '/settings')}
        <section class="data-safety-intro" aria-labelledby="data-safety-title">
          <span class="data-safety-intro__icon">${icon('shield')}</span>
          <div><h2 id="data-safety-title">بيانات الوضع التجريبي</h2><p>النسخ الاحتياطي ونقل البيانات غير متاحين في الوضع التجريبي.</p></div>
        </section>
        <div class="surface surface--flat data-safety-surface">
          <section class="surface__section data-safety-section" data-demo-cloud-unavailable>
            <div class="data-safety-section__copy"><h2>بيانات تجريبية محلية فقط</h2><p>لا يمكن تنزيلها أو استيرادها أو ربطها أو نقلها إلى حساب.</p></div>
          </section>
          <details class="surface__section data-inventory">
            <summary><span class="data-inventory__summary"><span class="data-safety-section__icon">${icon('reports')}</span><span><strong>محتوى التجربة الحالية</strong><small>للاستكشاف داخل الوضع التجريبي فقط</small></span></span><span class="data-inventory__meta"><bdi class="tabular">${totalRecords}</bdi> سجلًا ${icon('chev')}</span></summary>
            <div class="data-inventory__body">
              <dl class="data-inventory__grid">${Object.entries(counts).map(([label, count]) => html`<div><dt>${label}</dt><dd class="tabular">${count}</dd></div>`)}</dl>
              ${usageInfo ? html`<div class="data-inventory__storage"><span>المساحة المستعملة في التجربة</span><bdi class="tabular">${fmtBytes(usageInfo.used)}</bdi></div>` : ''}
            </div>
          </details>
        </div>
        <section class="data-danger-zone" aria-labelledby="demo-reset-title"><div><h2 id="demo-reset-title">إعادة ضبط التجربة</h2><p>يعيد البيانات التجريبية فقط إلى حالتها الأصلية.</p></div><button class="btn btn--danger" data-act="demo-reset">${icon('refresh')} إعادة ضبط البيانات التجريبية</button></section>
      </main>`;
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
          ${demo ? html`<section class="surface__section data-safety-section" data-demo-cloud-unavailable><div class="data-safety-section__copy"><h2>البيانات التجريبية محلية فقط</h2><p>الربط بالحساب والاستعادة السحابية غير متاحين في الوضع التجريبي.</p></div></section>` : renderLegacyClaimSection()}
          ${demo ? '' : renderCurriculumBootstrapSection()}
          <section class="surface__section data-safety-section" aria-labelledby="restore-title">
            <div class="data-safety-section__heading"><h2 id="restore-title">الاستعادة والاسترداد</h2><p>اختر المسار المناسب لمكان النسخة التي تريد استعادتها.</p></div>
            <input type="file" id="cloud-restore-file" accept="application/json,.json" class="sr-only" data-change="cloud-file" aria-label="اختيار ملف للاستعادة السحابية الآمنة">
            <div class="recovery-paths">
              ${demo ? '' : html`<div class="recovery-path recovery-path--cloud" aria-describedby="cloud-recovery-note">
                <span class="recovery-path__icon is-info">${icon('cloud')}</span>
                <div class="recovery-path__copy"><div class="hstack gap-2 wrap"><h3>الاستعادة السحابية الآمنة</h3><span class="badge ${availability.badge}">${availability.label}</span></div><p id="cloud-recovery-note">تقارن النسخة ببيانات الحساب، وتمنع التنفيذ عند وجود تعارض، ثم تُحدّث هذا الجهاز بالنسخة النهائية.</p></div>
                <button class="btn btn--info recovery-path__action" data-act="pick-cloud-file" ${cloudStartBlocked ? html`disabled aria-disabled="true"` : ''}>${icon('upload')} اختيار نسخة للمراجعة</button>
              </div>`}
            </div>
            ${renderCloudFlow()}
          </section>
          <details class="surface__section data-inventory">
            <summary><span class="data-inventory__summary"><span class="data-safety-section__icon">${icon('reports')}</span><span><strong>محتوى سجل ركيز الحالي</strong><small>تفاصيل البيانات التي تدخل في النسخة</small></span></span><span class="data-inventory__meta"><bdi class="tabular">${totalRecords}</bdi> سجلًا ${icon('chev')}</span></summary>
            <div class="data-inventory__body">
              <dl class="data-inventory__grid">${Object.entries(counts).map(([label, count]) => html`<div><dt>${label}</dt><dd class="tabular">${count}</dd></div>`)}</dl>
              ${usageInfo ? html`<div class="data-inventory__storage"><span>المساحة المستعملة على هذا الجهاز</span><bdi class="tabular">${fmtBytes(usageInfo.used)}</bdi></div>` : ''}
            </div>
          </details>
        </div>
        ${demo ? html`<section class="data-danger-zone" aria-labelledby="demo-reset-title"><div><h2 id="demo-reset-title">إعادة ضبط التجربة</h2><p>يعيد البيانات التجريبية فقط إلى حالتها الأصلية.</p></div><button class="btn btn--danger" data-act="demo-reset">${icon('refresh')} إعادة ضبط البيانات التجريبية</button></section>` : html`<section class="data-danger-zone" aria-labelledby="local-reset-title">
          <div><h2 id="local-reset-title">إعادة ضبط هذا الجهاز</h2><p>يمسح سجل ركيز المحلي من هذا الجهاز. لا تستخدمه كبديل عن إنشاء نسخة احتياطية.</p></div>
          <button class="btn btn--danger" data-act="wipe">${icon('trash')} ${LOCAL_RESET_COPY.button}</button>
        </section>`}
      </main>`;
  },
  actions: {
    async export() {
      if (store.getActiveWorkspace()?.type === 'demo') return;
      try {
        const payload = await downloadBackup();
        const validation = await validateBackupIntegrity(payload);
        if (!validation.ok || validation.integrity !== 'verified') throw new Error('Backup integrity verification failed');
        latestVerifiedBackup = {
          backupHash: payload.backupHash,
          exportedAt: payload.exportedAt,
          sourceOwnerId: payload.sourceOwnerId,
        };
        latestLocalAction = new Date();
        toast('نُزّلت النسخة الاحتياطية');
        repaint();
      }
      catch (err) { console.error(err); toast('تعذّر التصدير', 'danger'); }
    },
    async 'claim-legacy-workspace'() {
      if (legacyClaimState.phase !== 'eligible' || !latestVerifiedBackup || !cloud.session || !cloud.user ||
          String(latestVerifiedBackup.sourceOwnerId ?? '').toLowerCase() !== String(cloud.user.id ?? '').toLowerCase()) return;
      const expectedOwnerId = String(cloud.user.id ?? '').trim().toLowerCase();
      const expectedEmail = String(cloud.user.email ?? '').trim();
      const confirmed = await confirmLegacyClaim(expectedEmail);
      if (!confirmed) return;
      if (!cloud.user || String(cloud.user.id ?? '').trim().toLowerCase() !== expectedOwnerId) {
        legacyClaimState = { ...legacyClaimState, phase: 'blocked', error: 'تغيّر الحساب قبل التنفيذ. لم يُنفّذ الربط.' };
        repaint();
        return;
      }
      legacyClaimState = { ...legacyClaimState, phase: 'busy', error: null };
      repaint();
      try {
        legacyClaimService ??= createLegacyWorkspaceClaimService({
          activationEnabled: true,
          canonicalOrigin: claimCanonicalOrigin(),
        });
        await legacyClaimService.claim({
          expectedOwnerId,
          confirmation: {
            action: LEGACY_WORKSPACE_CLAIM_CONFIRMATION,
            confirmed: true,
            otherTabsClosed: true,
            expectedOwnerId,
            origin: globalThis.location.origin,
            databaseName: 'rakeezx',
          },
        });
        store.state.device = await db.get('device', 'device');
        legacyClaimState = { phase: 'claimed', error: null, pendingRecovery: false };
        toast('تم ربط السجل المحلي بالحساب');
        repaint();
      } catch (error) {
        console.error('[rakeezx claim] Workspace claim failed:', error);
        const conflict = ['WORKSPACE_CLAIM_EVIDENCE_CONFLICT', 'WORKSPACE_CLAIM_OUTBOX_CONFLICT',
          'WORKSPACE_CLAIM_CONFLICT', 'WORKSPACE_REGISTRY_MISMATCH'].includes(error?.code);
        legacyClaimState = {
          phase: conflict ? 'blocked' : (typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'eligible'),
          error: claimErrorPresentation(error),
          pendingRecovery: (await db.get('device', 'device'))?.workspaceClaim?.state === 'registry_pending',
        };
        repaint();
      }
    },
    async 'bootstrap-curriculum'() {
      store.assertLeaseWritable();
      if (curriculumBootstrap.phase === 'busy' || !latestVerifiedBackup || !cloud.session || !cloud.user) return;
      const workspace = runtimeSyncOwnershipGuard.getWorkspace();
      const expectedOwnerId = String(cloud.user.id ?? '').trim().toLowerCase();
      if (workspace?.type !== 'account' || workspace?.ownershipState !== 'claimed' ||
          String(workspace.authUserId ?? '').toLowerCase() !== expectedOwnerId ||
          String(latestVerifiedBackup.sourceOwnerId ?? '').toLowerCase() !== expectedOwnerId) return;
      const status = curriculumBootstrap.status ?? await readCurriculumBootstrapStatus({ workspace });
      const authoritative = status.state === 'NOT_STARTED';
      const confirmed = await openSheet({
        title: authoritative ? 'تأكيد حفظ المنهج مع الحساب' : 'تأكيد مراجعة منهج هذا الجهاز',
        desc: 'سيُقارن ركيز الوحدات والدروس بالنسخة السحابية دون استبدال أي اختلاف تلقائيًا.',
        body: html`<div class="stack stack-3"><p>ستبقى معرّفات الوحدات والدروس كما هي.</p><p class="t-3 fs-sm">عند وجود اختلاف سيتوقف الإجراء دون اختيار نسخة فائزة.</p></div>`,
        foot: html`<button class="btn btn--ghost" data-sheet-close>إلغاء</button><button class="btn btn--primary" data-curriculum-confirm>متابعة آمنة</button>`,
        onMount: (root, done) => root.querySelector('[data-curriculum-confirm]')?.addEventListener('click', () => done(true)),
      });
      if (confirmed !== true) return;
      store.assertLeaseWritable();
      curriculumBootstrap = { ...curriculumBootstrap, phase: 'busy', error: null };
      repaint();
      try {
        const contribution = await submitCurriculumBootstrap({
          workspace, deviceId: store.state.device?.deviceId,
          units: store.state.units, lessons: store.state.lessons,
          bootstrapId: status.bootstrapId ?? undefined,
          authoritative, backupVerified: true,
        });
        if (contribution.state === 'CONFLICT') {
          curriculumBootstrap = { phase: 'conflict', status: contribution, error: null };
          repaint();
          return;
        }
        const completed = contribution.state === 'COMPLETE' ? contribution : await finalizeCurriculumBootstrap({
          workspace, deviceId: store.state.device.deviceId,
          bootstrapId: contribution.bootstrapId, snapshotHash: contribution.snapshotHash,
        });
        await store.reconcileCurriculumBootstrapCanonical(completed);
        await store.patchDevice({
          curriculumSyncBootstrap: {
            version: 1, state: 'COMPLETE', reconciled: true, ownerId: expectedOwnerId,
            bootstrapId: completed.bootstrapId, snapshotHash: contribution.snapshotHash, reconciledAt: Date.now(),
          },
        }, { queue: false });
        initializeCurriculumSyncGate({ workspace, device: store.state.device });
        curriculumBootstrap = { phase: 'complete', status: completed, error: null };
        toast('اكتمل حفظ المنهج مع الحساب');
        repaint();
      } catch (error) {
        console.error('[rakeezx curriculum bootstrap] failed:', error);
        curriculumBootstrap = {
          phase: error?.code === 'CURRICULUM_BOOTSTRAP_CONFLICT' ? 'conflict' : 'failed',
          status: error?.result ?? status,
          error: error?.code === 'CURRICULUM_BOOTSTRAP_BACKUP_REQUIRED'
            ? 'نزّل نسخة احتياطية حديثة أولًا.'
            : 'لم تتغير بيانات المنهج. أعد المحاولة عند توفر اتصال مستقر.',
        };
        repaint();
      }
    },
    'pick-cloud-file'() {
      if (cloudRecovery.busy || cloudResumeState || cloudResumeError) return;
      document.getElementById('cloud-restore-file')?.click();
    },
    async 'cloud-file'(el) {
      const file = el.files?.[0];
      el.value = '';
      if (!file || cloudRecovery.busy || cloudResumeState || cloudResumeError) return;
      cloudRecovery = { ...emptyCloudRecovery(), phase: 'reading', fileName: file.name, busy: true };
      repaint();
      let payload;
      try {
        payload = await readJSONFile(file);
      } catch (error) {
        setCloudRecovery({ phase: 'error', busy: false, error: presentCloudError({ ...error, code: 'INVALID_BACKUP' }) });
        return;
      }
      const structural = validateBackup(payload);
      setCloudRecovery({ phase: 'validating', payload, structural, busy: true, error: null }, { focus: false });
      if (!structural.ok) {
        const presentation = presentCloudError({ code: structural.code ?? 'INVALID_BACKUP' });
        setCloudRecovery({
          phase: 'error', busy: false,
          error: { ...presentation, message: structural.errors?.[0] ?? presentation.message },
        });
        return;
      }
      const validation = await validateBackupIntegrity(payload);
      if (!validation.ok) {
        const presentation = presentCloudError({ code: validation.code ?? 'INVALID_BACKUP' });
        setCloudRecovery({
          phase: 'error', validation, busy: false,
          error: { ...presentation, message: validation.errors?.at(-1) ?? presentation.message },
        });
        return;
      }
      setCloudRecovery({ phase: 'validated', validation, busy: false, error: null });
    },
    async 'preview-cloud'() {
      if (cloudRecovery.busy || !cloudRecovery.payload || !cloudRecovery.validation?.ok || cloudResumeState || cloudResumeError) return;
      setCloudRecovery({ phase: 'previewing', busy: true, plan: null, error: null });
      try {
        await sync.assertCloudRestoreReady();
        const preview = await previewCloudRestore(cloudRecovery.payload);
        if (!preview.plan) throw Object.assign(new Error('Cloud preview unavailable'), { code: preview.validation?.code ?? 'INVALID_BACKUP' });
        setCloudRecovery({ phase: 'review', busy: false, validation: preview.validation, plan: preview.plan, error: null });
      } catch (error) {
        setCloudRecovery({ phase: 'error', busy: false, error: presentCloudError(error) });
      }
    },
    async 'confirm-cloud'() {
      store.assertLeaseWritable();
      if (cloudRecovery.busy || !cloudRecovery.payload || !cloudRecovery.plan?.ready || cloudResumeState || cloudResumeError) return;
      const confirmed = await cloudRestoreConfirmation(cloudRecovery.plan);
      if (!confirmed) return;
      store.assertLeaseWritable();
      setCloudRecovery({ phase: 'restoring', busy: true, error: null });
      try {
        const result = await restoreBackupToCloud(cloudRecovery.payload);
        cloudResumeState = null;
        cloudResumeError = null;
        setCloudRecovery({ phase: 'success', busy: false, result, plan: result.plan });
      } catch (error) {
        if (error.code === 'RESTORE_REVIEW_REQUIRED' && error.plan) {
          setCloudRecovery({ phase: 'review', busy: false, plan: error.plan, error: presentCloudError(error) });
          return;
        }
        if (['LOCAL_RECONCILIATION_REQUIRED', 'CLOUD_RESTORE_RESUME_REQUIRED'].includes(error.code)) {
          await refreshResumeState();
          cloudRecovery = { ...cloudRecovery, phase: 'error', busy: false, error: presentCloudError(error) };
          repaint();
          setTimeout(() => document.querySelector('[data-cloud-focus]')?.focus({ preventScroll: true }), 0);
          return;
        }
        setCloudRecovery({ phase: 'error', busy: false, error: presentCloudError(error) });
      }
    },
    async 'resume-cloud'() {
      if (cloudRecovery.busy || !cloudResumeState) return;
      setCloudRecovery({ phase: 'resuming', busy: true, error: null });
      try {
        const result = await resumeCloudRestore();
        cloudResumeState = null;
        cloudResumeError = null;
        setCloudRecovery({ phase: 'success', busy: false, result, plan: null });
      } catch (error) {
        await refreshResumeState();
        cloudRecovery = { ...cloudRecovery, phase: 'error', busy: false, error: presentCloudError(error) };
        repaint();
        setTimeout(() => document.querySelector('[data-cloud-focus]')?.focus({ preventScroll: true }), 0);
      }
    },
    'reset-cloud'() {
      if (cloudRecovery.busy || cloudResumeState || cloudResumeError) return;
      cloudRecovery = emptyCloudRecovery();
      repaint();
      setTimeout(() => document.querySelector('[data-act="pick-cloud-file"]')?.focus({ preventScroll: true }), 0);
    },
    async wipe() {
      store.assertLeaseWritable();
      const pendingOutbox = await db.getAll('outbox');
      const pendingWarning = pendingOutbox.length ? ` ${LOCAL_RESET_COPY.pendingWarning}` : '';
      const ok = await confirmSheet({ title: LOCAL_RESET_COPY.title, desc: `${LOCAL_RESET_COPY.description}${pendingWarning}`, confirmLabel: LOCAL_RESET_COPY.confirmLabel, danger: true });
      if (!ok) return;
      const again = await confirmSheet({ title: LOCAL_RESET_COPY.finalTitle, desc: LOCAL_RESET_COPY.finalDescription, confirmLabel: LOCAL_RESET_COPY.finalConfirmLabel, danger: true });
      if (!again) return;
      store.assertLeaseWritable();
      await db.clearAll(); location.reload();
    },
  },
};
