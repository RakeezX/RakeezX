// AI: user-reviewed correction only. Never infer original provenance from today's selection.
import { getCalendarPreset } from './calendar-presets.js';
import { isWeekend, CALENDAR_KIND } from '../models.js';

export const REPAIR_PROTOCOL = 'N101_REVIEWED_SESSION_V1';
export const repairAuditId = id => `session-repair:${id}`;
export const repairSnapshot = value => JSON.stringify(value, (_, v) => v && typeof v === 'object' && !Array.isArray(v)
  ? Object.fromEntries(Object.keys(v).sort().map(k => [k, v[k]])) : v);
export function exactContextRejection(row, ownerId) {
  return row?.protocol === 'v2' && row.entity === 'sessions' && row.store === 'sessions' &&
    row.op === 'create' && row.state === 'rejected' && row.baseRevision === 0 && row.ownerId === ownerId &&
    row.lastError?.code === '22023' && row.lastError?.message === 'N58_SESSION_CONTEXT_REQUIRED' &&
    row.patch?.calendar_context == null && row.localPatch?.calendarContext == null;
}
export const REPAIR_STORES = ['outbox', 'sessions', 'teachings', 'terms', 'years', 'sections', 'subjects',
  'slots', 'timeProfiles', 'lessons', 'units', 'calendars', 'calendarDays'];

export function sessionRepairEntry(current, original, ownerId) {
  const audit = current.outbox.find(x => x.id === repairAuditId(original.id));
  const session = current.sessions.find(x => x.id === original.recordId);
  const entry = { originalId: original.id, mutationId: original.mutationId, sessionId: original.recordId,
    date: session?.date ?? original.patch?.date ?? '', period: session?.period ?? original.patch?.period,
    queuedAt: original.queuedAt, correction: true, originalContextVerified: false };
  if (audit) {
    if (audit.protocol !== REPAIR_PROTOCOL || audit.ownerId !== ownerId) return { ...entry, status: 'blocked', reason: 'لا تتطابق ملكية سجل الإصلاح؛ لم يُعدّل.' };
    const replacement = current.outbox.find(x => x.mutationId === audit.replacementMutationId && x.sessionRepairOf === original.id);
    return { ...entry, status: audit.state === 'verified' ? 'verified' : replacement?.state ?? 'blocked', replacementMutationId: audit.replacementMutationId,
      classLabel: audit.review?.parents?.find(([store]) => store === 'sections')?.[1]?.name,
      reason: audit.state === 'verified' ? 'اكتمل الإصلاح بإيصال الخادم.' : replacement?.state === 'rejected'
        ? 'رُفض طلب التصحيح أيضًا؛ بقي الرفض الأصلي محفوظًا. راجع الدعم قبل أي طلب جديد.'
        : replacement?.state === 'blocked' ? 'التصحيح متوقف للتحقق من المصدر أو السجلات المرتبطة؛ لن نستبدل سجلًا موجودًا أو محذوفًا.'
        : replacement?.state === 'failed' ? 'لم يتأكد إيصال التصحيح؛ أعد المزامنة لاستعادة الطلب نفسه دون تكرار الحصة.'
        : 'طلب الإصلاح محفوظ؛ ينتظر إيصال الخادم والمصالحة المحلية.' };
  }
  const stop = reason => ({ ...entry, status: 'blocked', reason });
  if (!exactContextRejection(original, ownerId) || !session || session.deleted || session.calendarContext != null ||
      Number(session.serverRevision ?? 0) !== 0 || (session.ownerId != null && session.ownerId !== ownerId) ||
      (session.canonicalId != null && session.canonicalId !== session.id) || original.serverRecordId !== session.id)
    return stop('السجل غير مؤهل أو تغيّر؛ لن يُعدّل.');
  if (original.patch?.teaching_id !== session.teachingId || original.patch?.date !== session.date || original.patch?.period !== session.period)
    return stop('لا تتطابق هوية الحصة وتاريخها مع الطلب الأصلي.');
  // Do not turn a changed optimistic record into an unrelated replacement.
  for (const [key, value] of Object.entries(original.localPatch ?? {})) {
    if (key !== 'calendarContext' && repairSnapshot(session[key]) !== repairSnapshot(value)) return stop('تغيّرت الحصة بعد الطلب الأصلي.');
  }
  const teaching = current.teachings.find(x => x.id === session.teachingId);
  const term = current.terms.find(x => x.id === teaching?.termId);
  const year = current.years.find(x => x.id === term?.yearId);
  const section = current.sections.find(x => x.id === teaching?.sectionId);
  const parents = [['teachings', teaching], ['terms', term], ['years', year], ['sections', section],
    ['subjects', current.subjects.find(x => x.id === teaching?.subjectId)]];
  for (const [field, store] of [['slotId', 'slots'], ['timeProfileId', 'timeProfiles'], ['lessonId', 'lessons']]) {
    if (session[field]) parents.push([store, current[store].find(x => x.id === session[field])]);
  }
  if (session.makeupForId) return stop('الحصة مرتبطة بتعويض؛ تحتاج مراجعة مستقلة.');
  if (parents.some(([, x]) => !x || x.deleted || !(x.serverRevision > 0) || x.ownerId != null && x.ownerId !== ownerId) ||
      section?.yearId !== year?.id || !term.startDate || !term.endDate || session.date < term.startDate || session.date > term.endDate)
    return stop('تعذّر توثيق السنة والفصل والتاريخ أو أحد السجلات المرتبطة.');
  const related = current.outbox.some(x => x.id !== original.id && x.protocol === 'v2' && x.state !== 'superseded' &&
    (x.store === 'sessions' && [x.recordId, x.serverRecordId].includes(session.id) ||
     x.dependencies?.some(d => d.store === 'sessions' && d.recordId === session.id) ||
     [x.patch?.session_id, x.patch?.sessionId, x.localPatch?.sessionId].includes(session.id) ||
     parents.some(([store, p]) => x.store === store && [x.recordId, x.serverRecordId].includes(p?.id))));
  if (related) return stop('توجد عملية مرتبطة أو متعارضة لم تُحسم.');
  const canonical = year.serverCanonical ?? year, preset = getCalendarPreset(year.calendarPresetId);
  const selectionRevision = canonical.fieldRevisions?.calendar_selection;
  if (!preset || preset.hijriStart !== year.hijriStart || preset.hijriEnd !== year.hijriEnd ||
      canonical.calendarPresetId !== preset.id || !(selectionRevision > 0)) return stop('اختيار التقويم لم يتأكد بإيصال السنة.');
  const calendars = current.calendars.filter(x => !x.deleted && x.yearId === year.id && x.presetId === preset.id && x.source === 'custom');
  const days = current.calendarDays.filter(x => !x.deleted && x.date === session.date && calendars.some(c => c.id === x.calendarId));
  if (days.length > 1) return stop('يوجد أكثر من سياق لليوم؛ لا يمكن التخمين.');
  const official = preset.holidays.find(x => x.startDate <= session.date && session.date <= x.endDate);
  const context = { yearId: year.id, termId: term.id, presetId: preset.id, selectionRevision,
    kind: days[0]?.kind ?? official?.kind ?? (isWeekend(session.date) ? 'holiday' : 'study'),
    label: days[0]?.label ?? official?.label ?? '', source: days.length ? 'custom' : official ? 'official' : 'default' };
  if (!Object.hasOwn(CALENDAR_KIND, context.kind) || typeof context.label !== 'string' || context.label.length > 500)
    return stop('سياق اليوم غير صالح.');
  const evidence = { original, session, parents, calendars, days, context };
  return { ...entry, status: 'review', classLabel: section.name || section.label, yearLabel: year.label || year.id,
    termLabel: term.name || term.id, presetLabel: preset.name || preset.label || preset.id, context,
    evidence, fingerprint: repairSnapshot(evidence) };
}
export function buildSessionRepairPlan(current, ownerId) {
  return { protocol: REPAIR_PROTOCOL, ownerId, entries: current.outbox.filter(x => exactContextRejection(x, ownerId) ||
    x.ownerId === ownerId && x.store === 'sessions' && current.outbox.some(a => a.id === repairAuditId(x.id)))
    .map(x => sessionRepairEntry(current, x, ownerId)) };
}
