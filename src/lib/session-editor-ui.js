/** Shared editor for one materialized dated session, regardless of entry point. */

import { html, icon, toast, fmtDate, fmtTimeRange, openSheet } from './dom.js';
import * as store from '../store.js';
import * as sync from './sync.js';
import { SESSION_STATUS, SESSION_STATUS_ORDER, WEEKDAYS, weekday } from '../models.js';
import { sessionDeletePresentation, sessionDeleteQueuedCopy } from './session-delete-ui.js';

// `makeup` remains a readable legacy status, but it is not a generic status
// transition. A future dedicated Makeup workflow must own its creation rules.
const EDITABLE_SESSION_STATUS_ORDER = SESSION_STATUS_ORDER.filter((key) => key !== 'makeup');

export function sessionDeletionPresentation(session) {
  const teaching = store.getTeaching(session?.teachingId);
  return sessionDeletePresentation({
    evidence: session ? store.sessionDeleteEvidence(session.id) : [],
    archived: store.isTeachingArchived(teaching),
    deleteProtection: session?.deleteProtection,
    // The public Sync state is the available UI signal while an in-flight
    // reconciliation may hold the existing Product mutation lock.
    cloudReconciliation: sync.displayState().detailStatus === 'syncing',
  });
}

function sessionContext(session) {
  const teaching = store.getTeaching(session.teachingId);
  const time = session.startTime
    ? fmtTimeRange(session.startTime, session.endTime)
    : `الحصة ${session.period}`;
  return html`<dl class="session-delete-context" aria-label="بيانات الحصة">
    <div><dt>التاريخ</dt><dd>${WEEKDAYS[weekday(session.date)]} · ${fmtDate(session.date, false)}</dd></div>
    <div><dt>الفصل والمادة</dt><dd>${store.teachingLabel(teaching)}</dd></div>
    <div><dt>الوقت</dt><dd><bdi>${time}</bdi> · الحصة <span class="tabular">${session.period}</span></dd></div>
  </dl>`;
}

function deleteOption(deletion) {
  return html`<section class="session-delete-option ${deletion.deletable ? '' : 'is-protected'}" aria-label="حذف الحصة المؤرخة">
    <span class="session-delete-option__icon">${icon(deletion.deletable ? 'trash' : 'shield')}</span>
    <div>
      <strong>${deletion.restored ? 'احتُفظ بهذه الحصة' : deletion.deletable ? 'حذف هذه الحصة فقط' : 'هذه الحصة محفوظة'}</strong>
      <p>${deletion.restored
        ? html`لم يتم حذف الحصة لأنها تحتوي على بيانات محفوظة. ${deletion.primaryReason}`
        : deletion.deletable
          ? 'هذا الإجراء لا يحذف موعد الجدول الأسبوعي ولا أي حصة أخرى.'
          : html`${deletion.primaryReason}${deletion.additionalCount ? ` وهناك ${deletion.additionalCount} سبب إضافي للحماية.` : ''}`}</p>
    </div>
    ${deletion.deletable ? html`<button class="btn btn--danger" data-delete-session>${icon('trash')} حذف هذه الحصة فقط</button>` : ''}
  </section>`;
}

async function confirmSessionDelete(session) {
  return openSheet({
    title: 'حذف هذه الحصة؟',
    desc: 'راجع بيانات الحصة قبل تأكيد الطلب.',
    body: html`${sessionContext(session)}
      <div class="session-delete-scope-note">${icon('shield')}<span>سيتم حذف هذه الحصة فقط، ولن يتغير الجدول الأسبوعي أو الحصص الأخرى.</span></div>`,
    foot: html`<button class="btn btn--ghost" data-sheet-close autofocus>إلغاء</button><button class="btn btn--danger" data-confirm-session-delete>حذف هذه الحصة</button>`,
    onMount: (root, done) => root.querySelector('[data-confirm-session-delete]')
      ?.addEventListener('click', () => done(true)),
  }).then((value) => value === true);
}

export async function openSessionEditor(session, {
  title = `حالة الحصة ${session?.period ?? ''}`,
  desc = 'الحصة غير المنفّذة لا تُسجَّل غيابًا على الطلاب.',
  countedHint = 'تُحسب في سجل الحصص',
  notCountedHint = 'لا تُحسب',
  reasonPlaceholder = '',
} = {}) {
  if (!session) return null;
  const deletion = sessionDeletionPresentation(session);
  const picked = await openSheet({
    title,
    desc,
    body: html`${sessionContext(session)}
      <div class="stack stack-2">
        ${EDITABLE_SESSION_STATUS_ORDER.map((key) => html`
          <button class="radiocard radiocard--btn ${session.status === key ? 'is-on' : ''}" data-pick="${key}">
            <span class="radiocard__body">
              <span class="radiocard__title">${SESSION_STATUS[key].label}</span>
              <span class="radiocard__hint">${SESSION_STATUS[key].counts ? countedHint : notCountedHint}</span>
            </span>
          </button>
        `)}
      </div>
      <label class="field mt-4">
        <span class="field__label">السبب (اختياري)</span>
        <input class="input" id="ses-reason" value="${session.reason ?? ''}" maxlength="120" placeholder="${reasonPlaceholder}">
      </label>
      ${deleteOption(deletion)}`,
    onMount: (root, done) => {
      const reason = root.querySelector('#ses-reason');
      root.querySelectorAll('[data-pick]').forEach((button) =>
        button.addEventListener('click', () => done({
          type: 'status', status: button.dataset.pick, reason: reason.value.trim(),
        }))
      );
      root.querySelector('[data-delete-session]')?.addEventListener('click', () => done({ type: 'delete' }));
    },
  });

  if (!picked) return null;
  if (picked.type === 'status') {
    await store.setSessionStatus(session.id, picked.status, picked.reason);
    toast(`الحصة: ${SESSION_STATUS[picked.status].label}`);
    return { type: 'status', sessionId: session.id, status: picked.status };
  }
  if (!await confirmSessionDelete(session)) return null;
  try {
    await store.deleteSession(session.id);
    toast(sessionDeleteQueuedCopy({
      online: typeof navigator === 'undefined' || navigator.onLine !== false,
      syncStatus: sync.displayState().detailStatus,
    }));
    return { type: 'deleted', sessionId: session.id };
  } catch (error) {
    const current = store.getSession(session.id);
    const protection = current ? sessionDeletionPresentation(current) : null;
    toast(protection?.primaryReason || error.message || 'لم يتم حذف الحصة.', 'danger');
    return { type: 'error', sessionId: session.id };
  }
}
