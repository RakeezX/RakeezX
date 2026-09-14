/** Presentation only; Student Lifecycle V1 owns all eligibility and writes. */
import { html, icon, openSheet, render, toast } from './dom.js';
import * as store from '../store.js';
import { sectionLabel } from '../models.js';
import { getStudentLifecycleResumeState, resumeStudentLifecycle } from './student-lifecycle.js';
import * as cloud from './cloud.js';
import * as sync from './sync.js';

export function friendlyStudentLifecycleError(code) {
  if (code === 'OFFLINE') return 'يلزم الاتصال بالإنترنت لإتمام هذا الإجراء.';
  if (['AUTH_REQUIRED', 'LIFECYCLE_OWNER_MISMATCH'].includes(code)) return 'يلزم تسجيل الدخول إلى الحساب المعني لإتمام هذا الإجراء.';
  if (code === 'STALE_SOURCE_ENROLLMENT') return 'تغيرت حالة الطالب على جهاز آخر. حدّث البيانات ثم حاول مرة أخرى.';
  if (code === 'ARCHIVED_ENROLLMENT') return 'هذا الانتساب مؤرشف، وسجله محفوظ للقراءة فقط.';
  if (['STUDENT_NOT_FOUND', 'STUDENT_TOMBSTONED'].includes(code)) return 'لم يعد الطالب متاحًا لهذا الإجراء. حدّث البيانات.';
  if (['RESTORE_OUTBOX_NOT_EMPTY', 'LIFECYCLE_OUTBOX_NOT_EMPTY', 'RESTORE_SYNC_NOT_HEALTHY'].includes(code)) return 'أكمل المزامنة أولًا، ثم حاول مرة أخرى.';
  if (['SYNC_BUSY', 'RECONCILIATION_REQUIRED', 'RESTORE_RESUME_REQUIRED'].includes(code)) return 'يجري تحديث البيانات أو يلزم إكمال استعادة سابقة. أكمل التحديث أولًا.';
  if (['LIFECYCLE_RESUME_REQUIRED', 'LIFECYCLE_CHECKPOINT_CHANGED'].includes(code)) return 'يلزم إكمال الإجراء السابق قبل بدء إجراء جديد.';
  return 'تعذر إتمام الإجراء الآن. لم تتأكد نتيجته بعد؛ تحقق من الاتصال وحدّث البيانات.';
}

const previewMessage = (reason) => ({
  offline: 'يلزم الاتصال بالإنترنت لإتمام هذا الإجراء.',
  auth_required: 'يلزم تسجيل الدخول إلى الحساب المعني لإتمام هذا الإجراء.',
  student_not_synced: 'تحتاج بيانات الطالب إلى المزامنة أولًا قبل إزالته.',
  demo_local_only: 'هذا طالب في فصل تجريبي محلي. يمكن حذف الفصل التجريبي من إدارة الفصول.',
  sync_not_ready: 'أكمل المزامنة أو تحديث الجهاز أولًا، ثم حاول مرة أخرى.',
  stale_source: 'تغيرت حالة الطالب، حدّث البيانات ثم حاول مرة أخرى.',
  invalid_source: 'بيانات الانتساب الحالي غير متاحة. حدّث البيانات ثم حاول مرة أخرى.',
  archived_enrollment: 'لا يمكن تنفيذ الإجراء على فصل مؤرشف.',
  student_unavailable: 'بيانات الطالب غير متاحة حاليًا.',
  student_deleted: 'بيانات الطالب غير متاحة حاليًا.',
}[reason] ?? 'تعذر التحقق من نتيجة الإزالة الآن. تحقق من الاتصال وحدّث البيانات ثم حاول مرة أخرى.');

export async function openStudentManagement(studentId) {
  const student = store.getStudent(studentId);
  if (!student) return;
  let stage = 'choose', action = null, source = null, busy = false, previewing = false, message = '', checkpoint = null;
  let result = null, previewReason = null;
  try { checkpoint = await getStudentLifecycleResumeState(); }
  catch (error) { stage = 'error'; message = friendlyStudentLifecycleError(error.code); }

  const context = () => {
    const en = store.activeEnrollment(studentId);
    const sec = en ? store.getSection(en.sectionId) : null;
    return { en, sec, active: store.getStudent(studentId)?.status === 'active' };
  };
  const outcome = await openSheet({
    title: 'إدارة الطالب',
    body: html`<div class="student-management" data-student-management></div>`,
    onMount(root, done) {
      root.querySelector('.sheet').classList.add('student-management-sheet');
      const host = root.querySelector('[data-student-management]');
      const title = root.querySelector('.sheet__title');
      const close = root.querySelector('[data-sheet-close]');
      // Only an in-flight authoritative command locks dismissal, never normal scrolling.
      root.addEventListener('keydown', (event) => {
        if (busy && !previewing && event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); }
      });
      root.addEventListener('click', (event) => {
        if (busy && !previewing && event.target === root) { event.preventDefault(); event.stopImmediatePropagation(); }
      }, true);

      function show() {
        const { en, sec, active } = context();
        title.textContent = stage === 'confirm' ? (action === 'delete' ? 'حذف هذا الطالب؟' : 'إزالة الطالب من الفصل؟') : 'إدارة الطالب';
        close.disabled = busy && !previewing;
        host.dataset.managementState = stage;
        host.dataset.managementConsequence = stage === 'confirm' ? action : '';
        const displayedSection = stage === 'confirm' && source ? store.getSection(source.sectionId) : sec;
        const identity = html`<div class="student-management__identity" dir="rtl">
          <span class="student-management__avatar" aria-hidden="true">${icon('student')}</span>
          <div class="student-management__person"><strong dir="rtl">${student.name}</strong>
            <span>${displayedSection ? sectionLabel(displayedSection) : 'لا يوجد انتساب حالي'}</span>
          </div>
        </div>`;
        const resumeAvailable = checkpoint?.studentId === studentId;
        render(host, html`
          ${identity}
          ${stage === 'choose' ? html`
            ${checkpoint ? html`<p>${resumeAvailable ? (checkpoint.state === 'reconciliation_required' ? 'تم تأكيد الإجراء، ويحتاج هذا الجهاز إلى إكمال التحديث.' : 'يحتاج الإجراء السابق إلى إكمال التحقق من نتيجته.') : 'يلزم إكمال إجراء سابق قبل إدارة هذا الطالب.'}</p>
              ${resumeAvailable ? html`<button class="btn btn--primary" data-management="resume">${checkpoint.state === 'reconciliation_required' ? 'إكمال تحديث هذا الجهاز' : 'إكمال الإجراء السابق'}</button>` : ''}`
              : active ? html`
                ${en ? html`<button class="btn btn--ghost btn--block student-management__row" data-management="transfer" aria-label="نقل الطالب إلى فصل آخر">
                    <span class="student-management__row-icon" aria-hidden="true">${icon('picker')}</span>
                    <span class="student-management__row-text"><strong>نقل الطالب إلى فصل آخر</strong>
                      <small>مع الاحتفاظ بهويته وسجله</small></span>
                    <span class="student-management__row-chevron" aria-hidden="true">${icon('chev')}</span>
                  </button>
                  <button class="btn btn--ghost btn--block student-management__row" data-management="remove" aria-label="إزالة الطالب من الفصل">
                    <span class="student-management__row-icon student-management__row-icon--sensitive" aria-hidden="true">${icon('back')}</span>
                    <span class="student-management__row-text"><strong>إزالة الطالب من الفصل</strong>
                      <small>تُعرض النتيجة الآمنة قبل تأكيدك</small></span>
                    <span class="student-management__row-chevron" aria-hidden="true">${icon('chev')}</span>
                  </button>` : html`<p class="t-3">لا يوجد انتساب حالي متاح للإدارة.</p>`}`
              : html`<p class="t-3">انتهى الانتساب الحالي. السجل السابق متاح للعرض.</p><a class="btn btn--info" href="#/archive/former-students" data-management="former">الطلاب السابقون</a>`}
          ` : stage === 'confirm' ? html`
            ${message ? html`<p role="status" class="t-3 fs-sm">${message}</p>` : ''}
            ${action === 'delete' ? html`<p>لا يوجد لهذا الطالب سجل تعليمي محفوظ، لذلك سيتم حذف الطالب من ركيز.</p><p class="t-3 fs-sm">سيختفي من الطلاب الحاليين، ولن يظهر ضمن «الطلاب السابقون».</p>`
              : html`<p>لدى الطالب سجل محفوظ. سيتم إزالته من الفصل الحالي مع الاحتفاظ بحضوره ودرجاته وسجله السابق.</p><p class="t-3 fs-sm">سيظهر الطالب لاحقًا ضمن «الطلاب السابقون».</p>`}
            <div class="student-management__actions"><button class="btn btn--ghost" data-management="back">إلغاء</button><button class="btn ${action === 'delete' ? 'btn--danger' : 'btn--primary'}" data-management="confirm">${action === 'delete' ? 'حذف الطالب' : 'إزالة من الفصل'}</button></div>
          ` : stage === 'busy' ? html`<p role="status">${previewing ? 'جارٍ التحقق من نتيجة الإزالة…' : checkpoint?.state === 'reconciliation_required' ? 'جارٍ إكمال تحديث هذا الجهاز…' : 'جارٍ التحقق وإتمام الإجراء…'}</p>`
          : stage === 'success' ? html`<p role="status">${message}</p><button class="btn btn--primary" data-management="close">${result.action === 'delete' ? 'العودة للكشف' : 'العودة إلى ملف الطالب'}</button>`
          : html`<p role="status">${message}</p>
              ${previewReason === 'student_not_synced' ? html`<button class="btn btn--primary" data-management="sync-preview">مزامنة الآن</button>` : ''}
              ${resumeAvailable ? html`<p class="t-3 fs-sm">${checkpoint.state === 'reconciliation_required' ? 'تم تأكيد الإجراء، ويحتاج هذا الجهاز إلى إكمال التحديث.' : 'أكمل التحقق من الإجراء السابق بدل بدء إجراء جديد.'}</p><button class="btn btn--primary" data-management="resume">${checkpoint.state === 'reconciliation_required' ? 'إكمال تحديث هذا الجهاز' : 'إكمال الإجراء السابق'}</button>` : html`<button class="btn btn--ghost" data-management="back">العودة للإدارة</button>`}`}
        `);
        if (!busy) (host.querySelector('[data-management="back"]') ?? host.querySelector('button') ?? close).focus({ preventScroll: true });
        else host.querySelector('[role="status"]')?.setAttribute('tabindex', '-1');
        if (busy) host.querySelector('[role="status"]')?.focus({ preventScroll: true });
      }

      async function run(resume = false) {
        busy = true; stage = 'busy'; show();
        try {
          const command = resume ? checkpoint.command : (action === 'delete' ? 'delete_pristine' : 'end_enrollment');
          action = command === 'delete_pristine' ? 'delete' : 'end';
          const response = resume ? await resumeStudentLifecycle()
            : action === 'delete' ? await store.deletePristineStudent(studentId)
            : await store.endStudentEnrollment(studentId, source.id, { sourceRevision: source.serverRevision });
          checkpoint = null;
          if (response.ok) {
            result = { action }; stage = 'success';
            message = action === 'delete' ? 'تم حذف الطالب المضاف بالخطأ.' : 'تمت إزالة الطالب من الفصل مع الاحتفاظ بسجله السابق.';
          } else if (action === 'delete' && response.code === 'NOT_PRISTINE') { preservedConfirmation(); }
          else { stage = 'error'; message = friendlyStudentLifecycleError(response.code); }
        } catch (error) {
          if (action === 'delete' && error.code === 'NOT_PRISTINE' && error.reason !== 'STUDENT_TOMBSTONED') { preservedConfirmation(); }
          else { stage = 'error'; message = friendlyStudentLifecycleError(error.reason === 'STUDENT_TOMBSTONED' ? 'STUDENT_TOMBSTONED' : error.code); }
          try { checkpoint = await getStudentLifecycleResumeState(); } catch { checkpoint = null; }
        } finally { busy = false; show(); }
      }

      function preservedConfirmation() {
        // Execution found newer history. Never automatically run the second command.
        action = 'end'; source ??= store.activeEnrollment(studentId);
        if (!source) { stage = 'error'; message = friendlyStudentLifecycleError('STALE_SOURCE_ENROLLMENT'); return; }
        stage = 'confirm'; message = 'تغيرت نتيجة المعاينة: لدى الطالب سجل محفوظ، ولم يُحذف.';
      }

      async function preview() {
        source = store.activeEnrollment(studentId); message = ''; previewReason = null; busy = true; previewing = true; stage = 'busy'; show();
        try {
          const result = await store.previewStudentRemoval(studentId, source?.id, source?.serverRevision);
          if (result.outcome === 'blocked') { stage = 'error'; previewReason = result.reason; message = previewMessage(result.reason); }
          else { action = result.outcome === 'delete_pristine' ? 'delete' : 'end'; stage = 'confirm'; }
        } catch { stage = 'error'; previewReason = !cloud.session || !cloud.user ? 'auth_required' : navigator.onLine === false ? 'offline' : 'preview_unavailable'; message = previewMessage(previewReason); }
        finally { busy = false; previewing = false; show(); }
      }

      host.addEventListener('click', async (event) => {
        const choice = event.target.closest('[data-management]')?.dataset.management;
        if (!choice || busy) return;
        if (choice === 'close') { done(result); return; }
        if (choice === 'former') { done(null); return; }
        if (choice === 'back') { stage = 'choose'; message = ''; previewReason = null; show(); return; }
        if (choice === 'sync-preview') {
          previewReason = null; busy = true; previewing = true; stage = 'busy'; show();
          try {
            if (await sync.syncAll({ full: true })) { await preview(); }
            else { stage = 'error'; message = previewMessage(!cloud.session || !cloud.user ? 'auth_required' : navigator.onLine === false ? 'offline' : 'sync_not_ready'); }
          } catch { stage = 'error'; message = previewMessage(!cloud.session || !cloud.user ? 'auth_required' : navigator.onLine === false ? 'offline' : 'preview_unavailable'); }
          finally { busy = false; previewing = false; show(); }
          return;
        }
        if (choice === 'confirm') { await run(); return; }
        if (choice === 'resume') { await run(true); return; }
        if (checkpoint) return;
        if (choice === 'transfer') {
          done({ action: 'transfer' });
          return;
        }
        if (choice === 'remove') await preview();
      });
      show();
    },
  });
  if (outcome?.action === 'transfer') {
    const { transferSheet } = await import('../views/students.js');
    const en = store.activeEnrollment(studentId);
    if (!en) return;
    const target = await transferSheet(student, en.sectionId);
    if (!target?.sectionId) return;
    try {
      const moved = await store.transferStudent(studentId, target.sectionId, { note: target.note });
      toast(moved ? `نُقل ${student.name} إلى ${sectionLabel(store.getSection(target.sectionId))}` : 'تعذّر نقل الطالب بأمان. تحقق من كشف الشعبة ثم أعد المحاولة.', moved ? 'ok' : 'danger');
    } catch { toast('تعذّر نقل الطالب بأمان. حدّث البيانات ثم أعد المحاولة.', 'danger'); }
  }
  return outcome ?? result;
}
