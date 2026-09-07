/**
 * RAKEEZ X — المخزن: الحالة في الذاكرة + الحفظ في IndexedDB + الإشعار بالتغيير.
 *
 * كل تعديل يمر من هنا، فيُحفظ فورًا ويُسجَّل في صندوق الصادر (outbox)
 * ليُرفع لاحقًا عند تفعيل المزامنة السحابية.
 */

import * as db from './lib/db.js';
import { inspectPristineTeaching, hasTeachingReferences, samePristineRecord, teachingReplacementHash } from './lib/pristine-teaching.js';
import { SYNC_V2_SCHEMAS, encodeSyncV2Patch } from './lib/sync-v2.js';

import {
  now, uid, todayISO, scoreId, attendanceId, sessionId, enrollmentId,
  makeYear, makeTerm, makeSubject, makeSection, makeTeaching, makeEnrollment,
  makeSession, makeSlot, makeCalendar, makeTimeProfile, makeProfile, makeDevice, makeNote,
  defaultItemsFor, DEFAULT_TIME_PROFILES, TERMS_PER_YEAR, termIndexes,
  periodTime, periodNumbers, weekday, shiftDate, isTeachingDay,
  sortStudents, sortByOrder, indexScores, groupBy, compareArabic, sectionLabel, normalizeSectionLabel,
  normalizeSearchText, gradeLabel
} from './models.js';
import { calendarPresetRecords, getCalendarPreset, WESTERN_1448_1449_PRESET_ID } from './lib/calendar-presets.js';

export { sectionLabel };

/** إصدار شكل البيانات — يرتفع حين تحتاج السجلات الموجودة ترقية. */
const SCHEMA_VERSION = 4;

/* ---------- الحالة ---------- */

const COLLECTIONS = [
  'years', 'terms', 'subjects', 'sections', 'teachings', 'students', 'enrollments',
  'items', 'scores', 'slots', 'sessions', 'sessionRosterSnapshots', 'attendance', 'logs',
  'calendars', 'calendarDays', 'units', 'lessons', 'timeProfiles',
  'notes', 'assignments', 'submissions',
];

export const state = {
  ready: false,
  /** بيانات المعلّم — تُصدَّر وتُدمج */
  profile: null,
  /** إعدادات هذا الجهاز — لا تغادره */
  device: null,

  ...Object.fromEntries(COLLECTIONS.map((c) => [c, []])),
};

const DEFAULT_PROFILE = makeProfile();
const DEFAULT_DEVICE = makeDevice({ schemaVersion: SCHEMA_VERSION });

/* ---------- الاشتراك ---------- */

const listeners = new Set();

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

let notifyQueued = false;
let pendingRender = false;
function notify({ render = true } = {}) {
  pendingRender ||= render;
  if (notifyQueued) return;
  notifyQueued = true;
  queueMicrotask(() => {
    notifyQueued = false;
    const update = { render: pendingRender };
    pendingRender = false;
    for (const fn of listeners) fn(state, update);
  });
}

/* ---------- الإبلاغ عن فشل الحفظ ---------- */

let errorHandler = null;
export const onWriteError = (fn) => { errorHandler = fn; };

function reportWriteError(err, context) {
  console.error('[rakeezx] تعذر الحفظ', context, err);
  console.error('[rakeezx sync db debug] IndexedDB Error Name:', err.name);
  console.error('[rakeezx sync db debug] IndexedDB Error Message:', err.message);
  console.error('[rakeezx sync db debug] IndexedDB Context:', JSON.stringify(context, null, 2));
  try {
    errorHandler?.(err, context);
  } catch (e) {
    console.error('[rakeezx] فشل معالج الأخطاء', e);
  }
}

/* ---------- التنسيق بين التبويبات ---------- */

const TAB_ID = uid();
const channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel('rakeezx-data') : null;

function broadcast(changes, { render = true } = {}) {
  if (!channel || !changes.length) return;
  try {
    channel.postMessage({ from: TAB_ID, changes, render });
  } catch (err) {
    console.warn('[rakeezx] تعذّر إبلاغ التبويبات الأخرى', err);
  }
}

channel?.addEventListener('message', (ev) => {
  if (!ev.data || ev.data.from === TAB_ID) return;
  absorb(ev.data.changes, { render: ev.data.render !== false })
    .catch((err) => console.warn('[rakeezx] تعذّر استقبال تغيير', err));
});

/**
 * يُغلق قناة BroadcastChannel.
 * يُستدعى من بيئة الاختبار فقط بعد انتهاء جميع الاختبارات لمنع تسرّب الموارد
 * وإبقاء Node.js حيًّا بعد انتهاء مجموعة الاختبارات.
 */
export function closeChannel() {
  if (channel) channel.close();
}

async function absorb(changes, { render = true } = {}) {
  const byStore = {};
  for (const c of changes ?? []) (byStore[c.store] ??= new Set()).add(c.id);

  for (const [storeName, ids] of Object.entries(byStore)) {
    if (storeName === 'profile' || storeName === 'device') {
      const fresh = await db.get(storeName, storeName);
      if (fresh) state[storeName] = fresh;
      continue;
    }
    const arr = state[storeName];
    if (!Array.isArray(arr)) continue;

    for (const id of ids) {
      const fresh = await db.get(storeName, id);
      const i = arr.findIndex((r) => r.id === id);
      if (fresh) {
        if (i >= 0) arr[i] = fresh;
        else arr.push(fresh);
      } else if (i >= 0) {
        arr.splice(i, 1);
      }
    }
  }
  for (const change of changes ?? []) {
    if (change.store === 'teachings' && change.replacementId && globalThis.location?.hash &&
        !getTeaching(change.id) && getTeaching(change.replacementId)) {
      const next = teachingReplacementHash(location.hash, change.id, change.replacementId);
      if (next !== location.hash) location.replace(next);
    }
  }
  notify({ render });
}

function visibleSyncValue(storeName, record) {
  if (!record) return null;
  const fields = Object.keys(SYNC_V2_SCHEMAS[storeName]?.fields ?? {});
  return Object.fromEntries(['id', 'deleted', ...fields].map((field) => [field, record[field]]));
}

/** Refresh only cloud-backed state after Sync V2 reconciliation. */
export async function refreshSyncedState() {
  const stores = Object.keys(SYNC_V2_SCHEMAS);
  const loaded = await Promise.all(stores.map((storeName) =>
    storeName === 'profile' ? db.get('profile', 'profile') : db.getAll(storeName)));
  const changes = [];
  let shouldRender = false;
  stores.forEach((storeName, index) => {
    const fresh = loaded[index];
    if (storeName === 'profile') {
      const next = { ...DEFAULT_PROFILE, ...(fresh ?? {}) };
      if (JSON.stringify(state.profile) !== JSON.stringify(next)) {
        shouldRender ||= JSON.stringify(visibleSyncValue('profile', state.profile)) !== JSON.stringify(visibleSyncValue('profile', next));
        state.profile = next;
        changes.push({ store: 'profile', id: 'profile' });
      }
      return;
    }
    const current = Array.isArray(state[storeName]) ? state[storeName] : [];
    if (JSON.stringify(current) === JSON.stringify(fresh)) return;
    const visible = (records) => records.map((record) => visibleSyncValue(storeName, record))
      .sort((left, right) => String(left.id).localeCompare(String(right.id)));
    shouldRender ||= JSON.stringify(visible(current)) !== JSON.stringify(visible(fresh));
    const ids = new Set([...current, ...fresh].map((record) => record.id));
    state[storeName] = fresh;
    changes.push(...[...ids].map((id) => ({ store: storeName, id })));
  });
  if (changes.length) {
    notify({ render: shouldRender });
    broadcast(changes, { render: shouldRender });
  }
  return changes;
}

const changeList = (storeName, records) => records.map((r) => ({ store: storeName, id: r.id }));

/* ---------- الإقلاع والترحيل ---------- */


/**
 * ترقية ٣ → ٤: يفصل سجل الإعدادات الواحد إلى ملف معلّم وإعدادات جهاز.
 * تُشغَّل مرة واحدة، ولا تفقد شيئًا: كل حقل يذهب إلى موضعه الصحيح.
 */
async function splitMetaIfNeeded() {
  const [profile, device, oldMeta] = await Promise.all([
    db.get('profile', 'profile'),
    db.get('device', 'device'),
    db.get('meta', 'meta'),
  ]);
  if (profile && device) return false;

  const src = oldMeta ?? {};
  const nextProfile = profile ?? makeProfile({
    teacherName: src.teacherName ?? '',
    schoolName: src.schoolName ?? '',
    phone: src.phone ?? '',
  });
  const nextDevice = device ?? makeDevice({
    theme: src.theme ?? 'light',
    activeYearId: src.activeYearId ?? null,
    activeTermId: src.activeTermId ?? null,
    lastSyncAt: src.lastSyncAt ?? null,
    schemaVersion: SCHEMA_VERSION,
  });

  await db.putAcross({ profile: [nextProfile], device: [nextDevice] });
  if (oldMeta) await db.clearStore('meta');   // السجل القديم أدّى دوره
  return true;
}

export async function init() {
  await db.openDB();

  const hadProfile = await db.get('profile', 'profile');
  const hadMeta = await db.get('meta', 'meta');

  await splitMetaIfNeeded();

  const [profile, device, ...loaded] = await Promise.all([
    db.get('profile', 'profile'),
    db.get('device', 'device'),
    ...COLLECTIONS.map((c) => db.getAll(c)),
  ]);

  state.profile = { ...DEFAULT_PROFILE, ...(profile ?? {}) };
  state.device = { ...DEFAULT_DEVICE, ...(device ?? {}) };
  COLLECTIONS.forEach((c, i) => {
    state[c] = loaded[i] ?? [];
  });


  await ensureFoundation();
  await migrateLegacyStudentNotes();

  applyTheme();
  state.ready = true;
  notify();
  db.persist();
  return state;
}

/**
 * يضمن الأساس: سنة، وفصولها الدراسية بعدد إعداد المنتج، ومادة، وملفات توقيت،
 * ومؤشّرات جهاز صالحة. إجراء متكرر آمن يُصلح أي مؤشّر معلّق بعد استرجاع نسخة.
 */
async function ensureFoundation() {
  const writes = {};
  if (!state.device?.deviceId) {
    state.device = { ...(state.device ?? DEFAULT_DEVICE), id: 'device', deviceId: uid(), updatedAt: now() };
    writes.device = [state.device];
  }
  if (!Number(state.profile?.serverRevision) && !state.profile?.syncCreatePending) {
    state.profile = syncV2Record('profile', state.profile ?? DEFAULT_PROFILE, { pendingCreate: true });
    writes.profile = [state.profile];
    const entry = outboxEntry('profile', state.profile, null, 'put', null);
    if (entry) (writes.outbox ??= []).push(entry);
  }
  const push = (k, rec) => {
    const next = syncV2Record(k, rec, { pendingCreate: !!SYNC_V2_SCHEMAS[k] });
    (writes[k] ??= []).push(next);
    if (Array.isArray(state[k])) state[k].push(next);
    const entry = outboxEntry(k, next, null, 'put', null);
    if (entry) (writes.outbox ??= []).push(entry);
  };

  // Old offline data could predate the required cloud `name` column. Preserve
  // its id, periods, and history, but give only nameless records a transparent,
  // deterministic compatibility label before they can be serialized to cloud.
  for (const profile of state.timeProfiles) {
    if (isLocalOnlyRecord(profile) || (typeof profile.name === 'string' && profile.name.trim())) continue;
    const suffix = String(profile.id ?? 'غير-معرّف').slice(-8);
    profile.name = `ملف توقيت قديم (${suffix})`;
    profile.updatedAt = now();
    (writes.timeProfiles ??= []).push(profile);
    // Replace only this record's stale payload so a previous invalid outbox
    // entry cannot keep automatic sync pending after the repair succeeds.
    (writes.outbox ??= []).push(outboxEntry('timeProfiles', profile, ['name'], 'patch', profile));
  }

  if (!live(state.years).length) {
    const preset = calendarPresetRecords(getCalendarPreset());
    push('years', preset.year);
    push('calendars', preset.calendar);
    preset.terms.forEach((term) => push('terms', term));
    preset.calendarDays.forEach((day) => push('calendarDays', day));
  }

  // السنة التي نضمن فصولها هي **النشطة**، لا أول سنة في ترتيب الإدخال —
  // وإلا أُنشئ الفصل الثاني لسنة أخرى غير التي يعمل عليها المعلّم.
  const year =
    live(state.years).find((y) => y.id === state.device?.activeYearId) ?? live(state.years)[0];

  // فصول السنة الدراسية بعدد الإعداد الحالي (فصلان)، بلا حذف ما زاد عنها
  const existing = live(state.terms).filter((t) => t.yearId === year.id);
  for (const index of termIndexes()) {
    if (existing.some((t) => t.index === index)) continue;
    push('terms', makeTerm({ yearId: year.id, index, status: index === 1 ? 'active' : 'upcoming' }));
  }

  if (!live(state.subjects).length) push('subjects', makeSubject({ name: 'المهارات الرقمية' }));

  // ملفات التوقيت المبدئية — سجلات قابلة للتعديل، لا ثوابت
  if (!live(state.timeProfiles).length) {
    DEFAULT_TIME_PROFILES.forEach((p, i) => push('timeProfiles', makeTimeProfile({ ...p, order: i })));
  } else {
    // Auto-upgrade legacy default profiles that lack exact official configs
    live(state.timeProfiles).forEach((p) => {
      const defaultProfile = DEFAULT_TIME_PROFILES.find(dp => dp.name === p.name);
      if (defaultProfile && (!p.overrides || !p.overrides.config)) {
        p.periods = defaultProfile.periods;
        p.overrides = defaultProfile.overrides;
        p.updatedAt = now();
        (writes.timeProfiles ??= []).push(p);
      }
    });
  }

  const terms = live(state.terms).filter((t) => t.yearId === year.id)
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  const profiles = live(state.timeProfiles);

  const patch = {};
  const d = state.device;
  if (!d.activeYearId || !state.years.some((y) => y.id === d.activeYearId && !y.deleted)) {
    patch.activeYearId = year.id;
  }
  if (!d.activeTermId || !state.terms.some((t) => t.id === d.activeTermId && !t.deleted)) {
    patch.activeTermId = terms[0]?.id ?? null;
  }
  if (!d.activeTimeProfileId || !profiles.some((p) => p.id === d.activeTimeProfileId)) {
    patch.activeTimeProfileId = profiles[0]?.id ?? null;
  }
  if (d.schemaVersion !== SCHEMA_VERSION) patch.schemaVersion = SCHEMA_VERSION;

  if (Object.keys(patch).length) {
    state.device = { ...state.device, ...patch, updatedAt: now() };
    writes.device = [state.device];
  }

  if (Object.keys(writes).length) await db.putAcross(writes);
}

/* ---------- الكتابة ---------- */

// Runtime actions on demo classes use ordinary session/score IDs. Their
// explicit demo references still make them local-only, even after deletion.
export const isLocalOnlyRecord = (rec) => [
  'id', 'teachingId', 'teaching_id', 'studentId', 'student_id',
  'sectionId', 'section_id', 'sessionId', 'session_id', 'itemId', 'item_id',
  'slotId', 'slot_id',
].some(key => String(rec?.[key] ?? '').startsWith('demo:'));
// Private creation-only receipt. It lives in the local outbox, never in cloud payloads.
const TEACHING_CREATION_PROOF = Symbol('pristineTeachingCreation');

let syncV2Sequence = 0;
const nextSyncV2Sequence = () => {
  syncV2Sequence = Math.max(Date.now() * 1000, syncV2Sequence + 1);
  return syncV2Sequence;
};

function syncV2DeviceId() {
  if (!state.device?.deviceId) {
    state.device = { ...(state.device ?? DEFAULT_DEVICE), id: 'device', deviceId: uid(), updatedAt: now() };
  }
  return state.device.deviceId;
}

function syncV2Record(storeName, record, { pendingCreate = false } = {}) {
  if (!SYNC_V2_SCHEMAS[storeName] || isLocalOnlyRecord(record)) return record;
  return {
    ...record,
    canonicalId: record.canonicalId ?? record.id,
    serverRevision: Number.isSafeInteger(Number(record.serverRevision)) ? Number(record.serverRevision) : 0,
    ...(pendingCreate ? { syncCreatePending: true } : {}),
  };
}

function syncV2Dependencies(storeName, record) {
  const references = SYNC_V2_SCHEMAS[storeName]?.references ?? {};
  return Object.entries(references)
    .filter(([field]) => record?.[field])
    .map(([field, store]) => ({ store, recordId: record[field], requiresServerRevision: true }));
}

function syncV2CommandEntry({ store, recordId, command, patch: commandPatch = {}, dependencies = [], baseRevision = 0, stamp = now() }) {
  if (isLocalOnlyRecord({ id: recordId, ...commandPatch }) ||
      dependencies.some((dependency) => String(dependency.recordId ?? '').startsWith('demo:'))) return null;
  const mutationId = uid();
  const canonicalId = recordId;
  return {
    id: `v2:${mutationId}`,
    protocol: 'v2', mutationId, deviceId: syncV2DeviceId(), store,
    entity: SYNC_V2_SCHEMAS[store]?.entity ?? store,
    recordId, serverRecordId: canonicalId, canonicalId,
    logicalRecordKey: `${store}:${canonicalId}`,
    op: 'command', command, baseRevision: Number(baseRevision) || 0,
    patch: structuredClone(commandPatch), localPatch: {},
    fields: Object.keys(commandPatch).sort(), groups: [],
    dependencies: structuredClone(dependencies),
    sequence: nextSyncV2Sequence(), clientUpdatedAt: stamp, queuedAt: stamp,
    state: 'pending', attemptCount: 0, envelopeLocked: false,
    lastError: null, blockedReason: null,
  };
}

const outboxEntry = (storeName, rec, fields = null, op = 'put', previous = null) => {
  const schema = SYNC_V2_SCHEMAS[storeName];
  if (!schema || isLocalOnlyRecord(rec)) return null;
  const operation = op === 'put' ? (previous ? 'patch' : 'create') : op;
  const localFields = operation === 'create' ? Object.keys(schema.fields) : (fields ?? Object.keys(schema.fields));
  const localPatch = operation === 'delete'
    ? {}
    : Object.fromEntries(localFields.filter((field) => field in rec).map((field) => [field, structuredClone(rec[field])]));
  const patch = operation === 'delete' ? {} : encodeSyncV2Patch(storeName, localPatch);
  const mutationId = uid();
  const canonicalId = rec.canonicalId ?? rec.id;
  const stamp = rec.updatedAt ?? now();
  return ({
    id: `v2:${mutationId}`,
    protocol: 'v2', mutationId, deviceId: syncV2DeviceId(),
    store: storeName, entity: schema.entity,
    recordId: rec.id, serverRecordId: canonicalId, canonicalId,
    logicalRecordKey: `${storeName}:${canonicalId}`,
    op: operation,
    baseRevision: operation === 'create' ? 0 : Number(rec.serverRevision ?? previous?.serverRevision ?? 0),
    patch, localPatch,
    fields: Object.keys(patch).sort(), groups: [],
    dependencies: syncV2Dependencies(storeName, rec),
    sequence: nextSyncV2Sequence(), clientUpdatedAt: stamp, queuedAt: stamp,
    state: 'pending', attemptCount: 0, envelopeLocked: false,
    lastError: null, blockedReason: null,
  });
};

function teachingCreationEntry(proof, stamp = now()) {
  return syncV2CommandEntry({
    store: 'teachings', recordId: proof.teaching.id, command: 'teaching:create', stamp,
    patch: {
      sectionId: proof.teaching.sectionId,
      subjectId: proof.teaching.subjectId,
      termId: proof.teaching.termId,
      order: proof.teaching.order ?? 0,
      itemIds: proof.items.map((item) => item.id),
    },
    dependencies: [
      { store: 'sections', recordId: proof.teaching.sectionId, requiresServerRevision: true },
      { store: 'subjects', recordId: proof.teaching.subjectId, requiresServerRevision: true },
      { store: 'terms', recordId: proof.teaching.termId, requiresServerRevision: true },
    ],
  });
}

function enrollmentCommandEntry(command, enrollment, { sourceEnrollmentId = null, date = null, note = '' } = {}) {
  return syncV2CommandEntry({
    store: 'enrollments', recordId: enrollment.studentId, command: `enrollment:${command}`,
    patch: {
      studentId: enrollment.studentId,
      sourceEnrollmentId,
      destinationEnrollmentId: command === 'withdraw' ? null : enrollment.id,
      destinationSectionId: command === 'withdraw' ? null : enrollment.sectionId,
      date: date ?? enrollment.startDate ?? todayISO(), note,
    },
    dependencies: [
      { store: 'students', recordId: enrollment.studentId, requiresServerRevision: true },
      ...(command === 'withdraw' ? [] : [{ store: 'sections', recordId: enrollment.sectionId, requiresServerRevision: true }]),
    ],
    stamp: enrollment.updatedAt ?? now(),
  });
}

function lifecycleCommandEntry(command, targetId, storeName, stamp = now()) {
  return syncV2CommandEntry({
    store: storeName, recordId: targetId, command: `lifecycle:${command}`,
    patch: { targetId }, stamp,
  });
}

/**
 * A durable receipt for a bounded enrollment operation.  The ordinary per-row
 * entries remain so generic sync can still converge the final records; this
 * receipt tells student sync to use the server transaction first, before a
 * generic bulk upsert could expose a transient duplicate roll number.
 */
const enrollmentOperationEntry = (operation, stamp) => ({
  id: `enrollment-operation:${operation.id}`,
  store: 'enrollments',
  recordId: null,
  op: 'enrollment-operation',
  updatedAt: stamp,
  queuedAt: stamp,
  enrollmentOperation: operation,
});

let enrollmentOperationOrder = 0;
const nextEnrollmentOperationOrder = (outbox = []) => {
  const persisted = outbox.reduce((max, entry) => Math.max(max, entry.enrollmentOperation?.order ?? 0), 0);
  enrollmentOperationOrder = Math.max(Date.now() * 1000, enrollmentOperationOrder + 1, persisted + 1);
  return enrollmentOperationOrder;
};

// Keep cascade deletes in the same durable transaction as their tombstones.
// Every store listed here has a cloud mapper and may safely drain through automatic sync.
const CASCADE_SYNCABLE_STORES = new Set([
  'years', 'calendars', 'calendarDays', 'terms', 'subjects', 'sections', 'teachings',
  'students', 'enrollments', 'notes', 'items', 'scores', 'logs',
  'timeProfiles', 'slots', 'sessions', 'sessionRosterSnapshots', 'attendance',
]);

function applyToMemory(storeName, records) {
  const arr = state[storeName];
  if (!Array.isArray(arr)) return [];
  const undo = [];
  for (const rec of records) {
    const i = arr.findIndex((x) => x.id === rec.id);
    undo.push({ index: i, previous: i >= 0 ? arr[i] : null });
    if (i >= 0) arr[i] = rec;
    else arr.push(rec);
  }
  return undo;
}

function revertMemory(storeName, records, undo) {
  const arr = state[storeName];
  if (!Array.isArray(arr)) return;
  for (let k = undo.length - 1; k >= 0; k--) {
    const { index, previous } = undo[k];
    if (previous) arr[index] = previous;
    else {
      const i = arr.findIndex((x) => x.id === records[k].id);
      if (i >= 0) arr.splice(i, 1);
    }
  }
}

/** يحفظ سجلات كاملة — للإنشاء والاستيراد الجماعي. للتعديل استعمل patch(). */
export async function save(batch, options = {}) {
  const writes = {};
  const outbox = [];
  const undos = [];
  const changes = [];
  const proof = options[TEACHING_CREATION_PROOF];

  for (const [storeName, records] of Object.entries(batch)) {
    if (!records?.length) continue;
    const previous = new Map((Array.isArray(state[storeName]) ? state[storeName] : [state[storeName]])
      .filter(Boolean).map((record) => [record.id, record]));
    const prepared = records.map((record) => syncV2Record(storeName, record, {
      pendingCreate: !!SYNC_V2_SCHEMAS[storeName] && !previous.has(record.id),
    }));
    writes[storeName] = prepared;
    undos.push([storeName, prepared, applyToMemory(storeName, prepared)]);
    changes.push(...changeList(storeName, prepared));
    if (options.queue === false || storeName === 'meta' ||
        (proof && (storeName === 'teachings' || storeName === 'items'))) continue;
    for (const record of prepared) {
      const prior = previous.get(record.id) ?? null;
      if (storeName === 'enrollments' && !prior && record.status === 'active') {
        const entry = enrollmentCommandEntry('enroll', record);
        if (entry) outbox.push(entry);
      } else {
        const fields = prior
          ? Object.keys(SYNC_V2_SCHEMAS[storeName]?.fields ?? {}).filter((field) =>
            JSON.stringify(prior[field]) !== JSON.stringify(record[field]))
          : null;
        const entry = outboxEntry(storeName, record, fields, 'put', prior);
        if (entry && (entry.op === 'create' || entry.fields.length)) outbox.push(entry);
      }
    }
  }
  if (!changes.length) return true;

  if (proof) {
    const entry = teachingCreationEntry(proof, proof.teaching.updatedAt ?? now());
    if (entry) outbox.push(entry);
  }
  if (outbox.length) writes.outbox = outbox;
  notify();

  try {
    await db.putAcross(writes);
    broadcast(changes);
    return true;
  } catch (err) {
    for (const [storeName, records, undo] of undos) revertMemory(storeName, records, undo);
    notify();
    reportWriteError(err, { op: 'save', stores: Object.keys(batch) });
    return false;
  }
}

/**
 * Local persistence only. The caller must prevalidate that A is safe to retire
 * and canonicalSection is the active B in local (camelCase) model format.
 * Optional expectedSource scalar fields guard evidence against local edits
 * between caller validation and this transaction; no cloud decisions occur here.
 * No IDs other than the abandoned section ID are changed.
 */
export async function rekeyLocalSectionIdentity({ fromSectionId, canonicalSection, expectedSource } = {}) {
  const toSectionId = canonicalSection?.id;
  if (typeof fromSectionId !== 'string' || !fromSectionId ||
      typeof toSectionId !== 'string' || !toSectionId || fromSectionId === toSectionId) {
    return { ok: false, status: 'invalid-input' };
  }

  let result;
  let committed;
  try {
    // Clone once so the caller cannot alter inputs while IndexedDB is opening.
    const supplied = structuredClone(canonicalSection);
    const expected = expectedSource && structuredClone(expectedSource);
    committed = await db.applyBatch({ sections: {}, teachings: {}, enrollments: {}, outbox: {} }, {
      prepare(current) {
        const source = current.sections.find((record) => record.id === fromSectionId);
        const existing = current.sections.find((record) => record.id === toSectionId);
        const teachings = current.teachings.filter((record) => record.sectionId === fromSectionId)
          .map((record) => ({ ...record, sectionId: toSectionId }));
        const enrollments = current.enrollments.filter((record) => record.sectionId === fromSectionId)
          .map((record) => ({ ...record, sectionId: toSectionId }));
        const obsolete = current.outbox.filter((entry) => entry.id === `sections:${fromSectionId}` ||
          (entry.store === 'sections' && entry.recordId === fromSectionId)).map((entry) => entry.id);

        if (!source) {
          result = existing && !teachings.length && !enrollments.length && !obsolete.length
            ? { ok: true, status: 'already-rekeyed', sectionId: toSectionId }
            : { ok: false, status: 'source-missing' };
          return {};
        }

        if (expected && Object.entries(expected).some(([field, value]) => source[field] !== value)) {
          result = { ok: false, status: 'source-changed' };
          return {};
        }

        // Supplied canonical fields win; fields not supplied remain local.
        // Undefined mapping fields must not erase local extension fields.
        const canonical = { ...existing,
          ...Object.fromEntries(Object.entries(supplied).filter(([, value]) => value !== undefined)),
          id: toSectionId };
        const pending = new Set(current.outbox.map((entry) => `${entry.store}:${entry.recordId}`));
        const queued = [];
        for (const [name, records] of [['teachings', teachings], ['enrollments', enrollments]]) {
          for (const record of records) {
            // Outbox fields are field NAMES, not payloads. Preserve existing
            // entries (including delete intent); serialization reads the record.
            if (pending.has(`${name}:${record.id}`)) continue;
            const entry = outboxEntry(name, record, ['sectionId'], record.deleted ? 'delete' : 'patch');
            if (entry) queued.push(entry);
          }
        }
        result = { ok: true, status: 'rekeyed', sectionId: toSectionId,
          teachings: teachings.length, enrollments: enrollments.length };
        return {
          sections: { remove: [fromSectionId], put: [canonical] },
          teachings: { put: teachings },
          enrollments: { put: enrollments },
          outbox: { remove: obsolete, put: queued },
        };
      },
    });
  } catch (error) {
    reportWriteError(error, { op: 'rekeyLocalSectionIdentity', fromSectionId, toSectionId });
    return { ok: false, status: 'write-failed', error: error.message };
  }

  if (result.ok) {
    const changes = [{ store: 'sections', id: fromSectionId }, { store: 'sections', id: toSectionId }];
    for (const name of ['teachings', 'enrollments']) {
      changes.push(...changeList(name, committed[name]?.put ?? []));
    }
    // Memory is updated only after commit. Reuse the normal cross-tab refresh
    // path, reading current disk values rather than overwriting optimistic edits.
    await absorb(changes);
    if (result.status === 'rekeyed') broadcast(changes);
  }
  return result;
}

/**
 * Pristine-only, local atomic adoption. Caller supplies exact authenticated
 * TA-absent/TB-active evidence; no cloud decisions or history rekeys occur here.
 * All stores participate in the transaction so concurrent meaningful work is
 * observed before cleanup. Only teachings/items/outbox receive writes.
 */
export async function adoptPristineTeachingIdentity({ fromTeachingId, canonicalTeaching, expectedSource, validateEvidence } = {}) {
  const toId = canonicalTeaching?.id;
  const blocked = (reason, code = 'TEACHING_IDENTITY_CONFLICT_REQUIRES_RESOLUTION') =>
    ({ ok: false, code, reason });
  if (typeof fromTeachingId !== 'string' || !fromTeachingId || typeof toId !== 'string' || !toId || fromTeachingId === toId) {
    return blocked('invalid-input');
  }
  let result;
  try {
    const supplied = structuredClone(canonicalTeaching);
    const expected = expectedSource && structuredClone(expectedSource);
    await db.applyBatch(Object.fromEntries(db.STORES.map((name) => [name, {}])), {
      prepare(current) {
        if (validateEvidence && !validateEvidence()) {
          result = blocked('evidence-changed', 'TEACHING_IDENTITY_PRESENCE_UNKNOWN'); return {};
        }
        const source = current.teachings.find((row) => row.id === fromTeachingId);
        const existing = current.teachings.find((row) => row.id === toId);
        const sameKey = (row) => row && ['sectionId', 'subjectId', 'termId'].every((key) =>
          typeof supplied[key] === 'string' && supplied[key] && row[key] === supplied[key]);
        if (supplied.deleted !== false || (existing && (existing.deleted || !sameKey(existing)))) {
          result = blocked('canonical-changed'); return {};
        }
        if (!source) {
          result = existing && sameKey(existing) && !hasTeachingReferences(current, fromTeachingId)
            ? { ok: true, status: 'already-adopted', teachingId: toId, abandonedItemIds: [] }
            : blocked('source-missing');
          return {};
        }
        if (!sameKey(source) || (expected && !samePristineRecord(source, expected))) {
          result = blocked('source-changed'); return {};
        }
        const checked = inspectPristineTeaching(current, fromTeachingId);
        if (!checked.pristine) { result = blocked(checked.reason); return {}; }
        result = { ok: true, status: 'adopted', teachingId: toId, abandonedItemIds: checked.itemIds };
        return {
          teachings: { remove: [fromTeachingId], put: [existing ?? supplied] },
          items: { remove: checked.itemIds },
          outbox: { remove: checked.outboxIds },
        };
      },
    });
  } catch (error) {
    reportWriteError(error, { op: 'adoptPristineTeachingIdentity', fromTeachingId, toId });
    return blocked(error.message, 'TEACHING_IDENTITY_ADOPTION_WRITE_FAILED');
  }
  if (result.ok) {
    // A peer may have committed first while this tab still holds the retired
    // teaching/defaults. A write-free repeat must refresh that memory as well.
    const staleItemIds = state.items.filter((row) => row.teachingId === fromTeachingId).map((row) => row.id);
    const itemIds = new Set([...result.abandonedItemIds, ...staleItemIds]);
    const changes = [{ store: 'teachings', id: fromTeachingId, replacementId: toId },
      { store: 'teachings', id: toId }, ...[...itemIds].map((id) => ({ store: 'items', id }))];
    await absorb(changes);
    if (result.status === 'adopted') broadcast(changes);
  }
  return result;
}

/**
 * تعديل حقول محددة في سجل قائم.
 * الأساس يُقرأ من القرص داخل المعاملة، فلا يُكتب إلا الحقول المطلوبة فوق
 * أحدث نسخة موجودة.
 */
export async function patch(storeName, id, changes, create = null, options = {}) {
  // profile و device سجلان مفردان لا مصفوفتان — ولا يدخل device في الصادر أبدًا
  const singleton = storeName === 'profile' || storeName === 'device';
  const arr = state[storeName];
  const idx = Array.isArray(arr) ? arr.findIndex((r) => r.id === id) : -1;

  const known = singleton ? state[storeName] : idx >= 0 ? arr[idx] : null;
  const base = known ?? create;
  if (!base) return null;

  const preserve = options.preserveTimestamp && changes.updatedAt !== undefined;
  const newStamp = preserve ? changes.updatedAt : now();
  const shouldNotify = options.notify !== false;
  const shouldRender = options.render !== false;
  const operation = options.v2Operation ?? (changes.deleted === true ? 'delete' : (!known && create ? 'create' : 'patch'));
  const optimistic = syncV2Record(storeName, { ...base, ...changes, id, updatedAt: newStamp }, {
    pendingCreate: operation === 'create',
  });
  const undo = singleton ? [] : applyToMemory(storeName, [optimistic]);
  const previous = singleton ? state[storeName] : null;
  if (singleton) state[storeName] = optimistic;
  if (shouldNotify) notify({ render: shouldRender });

  try {
    const [authoritative] = await db.patchMany(
      storeName,
      [{ id, changes, create: create ? { ...create, id } : null }],
      storeName === 'device' || options.queue === false ? null : (rec, fields) =>
        outboxEntry(storeName, syncV2Record(storeName, rec, { pendingCreate: operation === 'create' }),
          fields, operation, known),
      newStamp
    );

    if (!authoritative) {
      if (singleton) state[storeName] = previous;
      else revertMemory(storeName, [optimistic], undo);
      if (shouldNotify) notify();
      return null;
    }

    // patchMany preserves the optimistic record exactly in the normal path.
    // Do not replace the active screen a second time just to install that same
    // record after IndexedDB confirms it; a genuinely different authoritative
    // record still updates memory and notifies every subscriber.
    const authoritativeChanged = JSON.stringify(optimistic) !== JSON.stringify(authoritative);
    if (authoritativeChanged) {
      if (singleton) state[storeName] = authoritative;
      else applyToMemory(storeName, [authoritative]);
    }
    broadcast([{ store: storeName, id }]);
    if (authoritativeChanged && shouldNotify) notify({ render: shouldRender });
    return authoritative;
  } catch (err) {
    if (singleton) state[storeName] = previous;
    else revertMemory(storeName, [optimistic], undo);
    if (shouldNotify) notify();
    reportWriteError(err, { op: 'patch', store: storeName, id, fields: Object.keys(changes) });
    return null;
  }
}

export const touch = (rec, changes = {}) => ({ ...rec, ...changes, updatedAt: now() });

export async function upsert(storeName, rec) {
  const ok = await save({ [storeName]: [rec] });
  return ok ? rec : null;
}

export const softDelete = (storeName, id) => patch(storeName, id, { deleted: true }, null, { v2Operation: 'delete' });

/** بيانات المعلّم — تُصدَّر في النسخ الاحتياطية وتُدمج. */
export const patchProfile = (changes, options = {}) => patch('profile', 'profile', changes, { ...DEFAULT_PROFILE }, options);

/** إعدادات هذا الجهاز — لا تغادره ولا يستوردها ملف نسخة. */
export const patchDevice = (changes, options = {}) => patch('device', 'device', changes, { ...DEFAULT_DEVICE }, options);

async function patchManyRecords(storeName, edits, context) {
  if (!edits.length) return true;
  try {
    const updated = await db.patchMany(storeName, edits,
      (rec, fields) => outboxEntry(storeName, rec, fields, 'patch'));
    applyToMemory(storeName, updated);
    notify();
    broadcast(changeList(storeName, updated));
    return true;
  } catch (err) {
    reportWriteError(err, context);
    return false;
  }
}

async function cascadeDelete(predicates, context, lifecycle = null) {
  try {
    let commandQueued = false;
    const { touched } = await db.markDeleted(predicates, now(), (storeName, record) => {
      if (lifecycle) {
        if (commandQueued || storeName !== lifecycle.store || record.id !== lifecycle.targetId) return null;
        commandQueued = true;
        return lifecycleCommandEntry(lifecycle.command, lifecycle.targetId, lifecycle.store, record.updatedAt);
      }
      return CASCADE_SYNCABLE_STORES.has(storeName)
        ? outboxEntry(storeName, record, null, 'delete')
        : null;
    });
    const changes = [];
    for (const [storeName, ids] of Object.entries(touched)) {
      const arr = state[storeName];
      if (!Array.isArray(arr)) continue;
      for (const id of ids) {
        const i = arr.findIndex((r) => r.id === id);
        if (i >= 0) arr[i] = { ...arr[i], deleted: true, updatedAt: now() };
        changes.push({ store: storeName, id });
      }
    }
    notify();
    broadcast(changes);
    return true;
  } catch (err) {
    reportWriteError(err, context);
    return false;
  }
}

/* ---------- المظهر ---------- */

export function applyTheme() {
  const t = state.device?.theme ?? 'auto';
  const root = document.documentElement;
  if (t === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', t);

  const dark = t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0f1216' : '#0f766e');
}

/* ---------- المحدِّدات ---------- */

const live = (arr) => arr.filter((r) => !r.deleted);

export const years = () => [...live(state.years)].sort((a, b) => (b.order ?? 0) - (a.order ?? 0));
export const activeYear = () =>
  state.years.find((y) => y.id === state.device?.activeYearId && !y.deleted) ?? live(state.years)[0] ?? null;

export const termsOf = (yId) =>
  live(state.terms).filter((t) => !yId || t.yearId === yId).sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
export const activeTerm = () =>
  state.terms.find((t) => t.id === state.device?.activeTermId && !t.deleted) ??
  termsOf(activeYear()?.id)[0] ?? null;

/** أرقام الفصول الدراسية المستعملة فعلًا في السنة النشطة — وإلا فإعداد المنتج. */
export function activeTermIndexes() {
  const list = termsOf(activeYear()?.id).map((t) => t.index).filter(Boolean);
  return list.length ? [...new Set(list)].sort((a, b) => a - b) : termIndexes();
}

export const getTerm = (id) => state.terms.find((t) => t.id === id && !t.deleted) ?? null;
export const getYear = (id) => state.years.find((y) => y.id === id && !y.deleted) ?? null;

/** هل الفصل الدراسي مغلق؟ عندها تُمنع الكتابة عليه. */
export const isTermClosed = (tmId) => {
  const t = getTerm(tmId);
  if (!t) return false;
  const y = getYear(t.yearId);
  return t.status === 'closed' || y?.status === 'archived';
};

export const subjects = () => live(state.subjects).sort((a, b) => compareArabic(a.name, b.name));
export const getSubject = (id) => state.subjects.find((s) => s.id === id && !s.deleted) ?? null;

export const sections = (yId = activeYear()?.id) =>
  sortByOrder(live(state.sections).filter((s) => !yId || s.yearId === yId));
export const getSection = (id) => state.sections.find((s) => s.id === id && !s.deleted) ?? null;

/** الإسنادات التدريسية في فصل دراسي — وهي ما يراه المعلّم في «الفصول». */
export const teachings = (tmId = activeTerm()?.id) =>
  sortByOrder(live(state.teachings).filter((t) => !tmId || t.termId === tmId));
export const getTeaching = (id) => state.teachings.find((t) => t.id === id && !t.deleted) ?? null;

/** وصف مقروء للإسناد: «الرابع الابتدائي / أ · المهارات الرقمية». */
export function teachingLabel(tch) {
  if (!tch) return '';
  const sec = getSection(tch.sectionId);
  const sub = getSubject(tch.subjectId);
  return [sectionLabel(sec), sub?.name].filter(Boolean).join(' · ');
}

export const getStudent = (id) => state.students.find((s) => s.id === id && !s.deleted) ?? null;
export const allStudents = () => live(state.students);

export const enrollmentsOf = (studentId) =>
  live(state.enrollments).filter((e) => e.studentId === studentId);
export const enrollmentsIn = (secId) =>
  live(state.enrollments).filter((e) => e.sectionId === secId);
export const activeEnrollment = (studentId) =>
  enrollmentsOf(studentId).find((e) => e.status === 'active') ?? null;

/**
 * كشف الشعبة: الطلاب المنتسبون حاليًا، مدموجًا معهم rollNo من الانتساب.
 * الشاشات تقرأ الطالب كما كانت تمامًا — ولا تعرف بوجود جدول الانتساب.
 */
export function sectionRoster(secId) {
  const rows = [];
  for (const en of enrollmentsIn(secId)) {
    if (en.status !== 'active') continue;
    const st = getStudent(en.studentId);
    if (!st) continue;
    rows.push({ ...st, rollNo: en.rollNo, enrollmentId: en.id, sectionId: secId });
  }
  return sortStudents(rows);
}

/** كشف الإسناد = كشف شعبته. */
export const students = (tchId) => {
  const tch = getTeaching(tchId);
  return tch ? sectionRoster(tch.sectionId) : [];
};

export const items = (tchId) =>
  sortByOrder(live(state.items).filter((i) => i.teachingId === tchId));

export const scoresOf = (studentId) => live(state.scores).filter((s) => s.studentId === studentId);

/**
 * بنود الرصد اليدوي لا تشترك في المعرّف بين الشعب، رغم أنها قد تمثل
 * التقييم نفسه. هذا المفتاح قراءة/كتابة فقط: لا يغيّر معرف البند أو السجل.
 * الاسم والدرجة العظمى وطريقة الرصد هي أقل تعريف دلالي آمن متاح حاليًا.
 */
function portableGradeItemKey(item) {
  if (!item || item.deleted || item.auto) return null;
  const name = normalizeSearchText(item.name);
  const max = Number(item.max);
  if (!name || !Number.isFinite(max) || max <= 0) return null;
  return `${name}\u0000${max}`;
}

function scoreForItem(studentId, itemId) {
  return scoresOf(studentId).find((score) => score.itemId === itemId) ?? null;
}

/**
 * يعيد السجل الوحيد الذي يمكن عرضه لبند يدوي في شعبة أخرى من نفس المادة
 * والفصل الدراسي. وجود أي تكرار دلالي أو أكثر من سجل مصدر يجعل الربط غير
 * آمن؛ عندها تبقى الخانة غير مرصودة بدل تخمين درجة أو نسخها.
 */
function portableGradeScore(studentId, item) {
  const direct = scoreForItem(studentId, item?.id);
  if (direct) return direct;

  const key = portableGradeItemKey(item);
  const teaching = getTeaching(item?.teachingId);
  if (!key || !teaching) return null;

  // إذا كرر المعلم البند نفسه داخل الشعبة فلا يمكن معرفة أيهما المقصود.
  if (items(teaching.id).filter((candidate) => portableGradeItemKey(candidate) === key).length !== 1) {
    return null;
  }

  // لا نعرض درجة من شعبة لم ينتسب إليها الطالب قط، حتى لو صادف أنها تحمل
  // مادة وبندًا بالاسم نفسيهما.
  const enrolledSections = new Set(enrollmentsOf(studentId).map((enrollment) => enrollment.sectionId));
  const candidates = [];
  for (const sourceTeaching of live(state.teachings)) {
    if (sourceTeaching.id === teaching.id ||
        sourceTeaching.subjectId !== teaching.subjectId ||
        sourceTeaching.termId !== teaching.termId ||
        !enrolledSections.has(sourceTeaching.sectionId)) continue;
    const matches = items(sourceTeaching.id)
      .filter((candidate) => portableGradeItemKey(candidate) === key);
    if (matches.length !== 1) continue;
    const score = scoreForItem(studentId, matches[0].id);
    if (score) candidates.push(score);
  }

  return candidates.length === 1 ? candidates[0] : null;
}

/** سياق درجات يدوي قابل للنقل من دون نسخ سجلات الدرجات. */
function portableScoresByItem(studentId, tchId) {
  const directScores = indexScores(scoresOf(studentId));
  const out = Object.create(null);
  for (const item of items(tchId)) {
    const score = directScores[item.id] ?? portableGradeScore(studentId, item);
    if (score) out[item.id] = score;
  }
  return out;
}

export const attendanceOf = (studentId) =>
  live(state.attendance).filter((a) => a.studentId === studentId);

export const logsOf = (studentId) => live(state.logs).filter((l) => l.studentId === studentId);

function automaticItemIdentity(item) {
  if (!item?.auto) return null;
  const name = normalizeSearchText(item.name);
  if (!name) return null;
  return `${item.auto}\u0000${name}`;
}

function automaticItemKey(item) {
  const identity = automaticItemIdentity(item);
  const max = Number(item?.max);
  if (!identity || !Number.isFinite(max) || max <= 0) return null;
  const factor = item.auto === 'participation' ? Number(item.perPoint ?? 1) :
    item.auto === 'attendance' ? Number(item.penalty ?? 1) : null;
  if (!Number.isFinite(factor) || factor <= 0) return null;
  return `${identity}\u0000${max}\u0000${factor}`;
}

function dedupeRecords(records) {
  return [...new Map(records.map((record) => [record.id, record])).values()];
}

/**
 * سياقات الطالب التي يمكن أن تمثل بندًا آليًا واحدًا. أي بند بنفس الاسم
 * والنوع لكن بإعداد مختلف يجعل النتيجة غير مؤكدة، فلا نعرض درجة مُخمّنة.
 */
function compatibleAutomaticTeachingIds(studentId, item) {
  const teaching = getTeaching(item?.teachingId);
  const identity = automaticItemIdentity(item);
  const key = automaticItemKey(item);
  if (!teaching || !identity || !key) return null;

  const targetMatches = items(teaching.id).filter((candidate) =>
    automaticItemIdentity(candidate) === identity);
  if (targetMatches.length !== 1 || automaticItemKey(targetMatches[0]) !== key) return null;

  const enrolledSections = new Set(enrollmentsOf(studentId).map((enrollment) => enrollment.sectionId));
  const teachingIds = new Set([teaching.id]);
  for (const sourceTeaching of live(state.teachings)) {
    if (sourceTeaching.id === teaching.id ||
        sourceTeaching.subjectId !== teaching.subjectId ||
        sourceTeaching.termId !== teaching.termId ||
        !enrolledSections.has(sourceTeaching.sectionId)) continue;
    const sameItem = items(sourceTeaching.id).filter((candidate) =>
      automaticItemIdentity(candidate) === identity);
    if (!sameItem.length) continue;
    if (sameItem.length !== 1 || automaticItemKey(sameItem[0]) !== key) return null;
    teachingIds.add(sourceTeaching.id);
  }
  return teachingIds;
}

/**
 * إسقاط آلي فقط: يجمع سجل الطالب الموجود عبر الإسنادات المتوافقة، ولا ينشئ
 * درجات أو حضورًا أو رصدًا جديدًا. لكل بند نطاقه كي لا تختلط إعدادات مختلفة.
 */
function portableAutomaticByItem(studentId, tchId) {
  const out = Object.create(null);
  for (const item of items(tchId).filter((candidate) => candidate.auto)) {
    const teachingIds = compatibleAutomaticTeachingIds(studentId, item);
    if (!teachingIds) {
      out[item.id] = null;
      continue;
    }
    if (item.auto === 'participation') {
      out[item.id] = {
        logs: dedupeRecords(logsOf(studentId).filter((log) =>
          teachingIds.has(log.teachingId) && log.kind === 'participation')),
        classHasParticipation: live(state.logs).some((log) =>
          teachingIds.has(log.teachingId) && log.kind === 'participation'),
      };
    } else if (item.auto === 'attendance') {
      out[item.id] = {
        attendance: dedupeRecords(attendanceOf(studentId).filter((record) =>
          teachingIds.has(record.teachingId))),
      };
    }
  }
  return out;
}

/** سجل ملاحظات الطالب هو المصدر القانوني؛ الأحدث أولًا لسهولة المتابعة اليومية. */
export const notesOf = (studentId) => live(state.notes)
  .filter((n) => n.studentId === studentId)
  .sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? '')) ||
    Number(b.createdAt ?? b.updatedAt ?? 0) - Number(a.createdAt ?? a.updatedAt ?? 0) ||
    Number(b.updatedAt ?? 0) - Number(a.updatedAt ?? 0));

/* ---------- الحصص ---------- */

export const sessionsOf = (tchId) =>
  live(state.sessions)
    .filter((s) => s.teachingId === tchId)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.period - b.period));

export const sessionsOn = (date) =>
  live(state.sessions).filter((s) => s.date === date).sort((a, b) => a.period - b.period);

export const sessionsOnFor = (tchId, date) =>
  live(state.sessions).filter((s) => s.teachingId === tchId && s.date === date)
    .sort((a, b) => a.period - b.period);

export const getSession = (id) => state.sessions.find((s) => s.id === id && !s.deleted) ?? null;

export const attendanceIn = (sesId) => live(state.attendance).filter((a) => a.sessionId === sesId);

export const sessionRosterSnapshotId = (sesId) => `srs:${sesId}`;

export const sessionRosterSnapshot = (sesId) =>
  live(state.sessionRosterSnapshots).find((snapshot) =>
    snapshot.sessionId === sesId && snapshot.state === 'complete') ?? null;

/**
 * مصدر كشف الحصة: اللقطة المثبتة هي الحقيقة بعد أول رصد. قبلها فقط تظهر
 * القائمة النشطة كمعاينة لعملية الرصد القادمة، ولا تصبح حقيقة تاريخية إلا
 * داخل معاملة أول رصد حضور.
 */
export function sessionRoster(ses) {
  if (!ses) return { source: 'active', members: [], snapshot: null };
  const snapshot = sessionRosterSnapshot(ses.id);
  if (!snapshot) return { source: 'active', members: students(ses.teachingId), snapshot: null };
  return {
    source: 'snapshot',
    snapshot,
    members: snapshot.members.map((member) => {
      const student = getStudent(member.studentId);
      return {
        ...(student ?? { id: member.studentId, name: 'طالب محفوظ' }),
        id: member.studentId,
        rollNo: member.rollNo ?? null,
      };
    }),
  };
}

function snapshotRosterFromCurrent(current, ses) {
  const teaching = current.teachings.find((record) => record.id === ses.teachingId && !record.deleted);
  if (!teaching) return null;
  const studentsById = new Map(current.students.filter((record) => !record.deleted).map((record) => [record.id, record]));
  const members = current.enrollments
    .filter((record) => !record.deleted && record.sectionId === teaching.sectionId && record.status === 'active' && studentsById.has(record.studentId))
    .map((record) => ({ studentId: record.studentId, rollNo: record.rollNo ?? null, name: studentsById.get(record.studentId).name ?? '' }))
    .sort((left, right) =>
      (left.rollNo ?? Number.MAX_SAFE_INTEGER) - (right.rollNo ?? Number.MAX_SAFE_INTEGER) ||
      String(left.name).localeCompare(String(right.name), 'ar') ||
      left.studentId.localeCompare(right.studentId))
    .map(({ studentId, rollNo }) => ({ studentId, rollNo }));
  return { teaching, members };
}

function applyCommittedPuts(writes) {
  const changes = [];
  for (const [storeName, operations] of Object.entries(writes ?? {})) {
    if (storeName === 'outbox' || !Array.isArray(state[storeName])) continue;
    const records = operations.put ?? [];
    if (!records.length) continue;
    applyToMemory(storeName, records);
    changes.push(...changeList(storeName, records));
  }
  notify();
  broadcast(changes);
}

async function mutateSnapshotAttendance(sesId, makeRecords, commandKind = 'record') {
  const stamp = now();
  let result = { kind: 'missing', records: [] };
  let committed;
  try {
    committed = await db.applyBatch({
      sessions: {}, teachings: {}, students: {}, enrollments: {}, attendance: {}, sessionRosterSnapshots: {}, outbox: {},
    }, {
      prepare(current) {
        const ses = current.sessions.find((record) => record.id === sesId && !record.deleted);
        if (!ses || ['cancelled_holiday', 'cancelled'].includes(ses.status)) return {};

        const existingAttendance = current.attendance.filter((record) => record.sessionId === sesId && !record.deleted);
        let snapshot = current.sessionRosterSnapshots.find((record) => record.sessionId === sesId && !record.deleted && record.state === 'complete');
        let isNewSnapshot = false;
        if (!snapshot) {
          // Existing experimental attendance predates this feature. Keep its
          // current behavior; never manufacture a historical snapshot for it.
          if (existingAttendance.length) {
            result = { kind: 'legacy', records: [] };
            return {};
          }
          const roster = snapshotRosterFromCurrent(current, ses);
          if (!roster) return {};
          snapshot = {
            id: sessionRosterSnapshotId(ses.id),
            sessionId: ses.id,
            teachingId: ses.teachingId,
            sectionId: roster.teaching.sectionId,
            capturedAt: stamp,
            members: roster.members,
            state: 'complete',
            updatedAt: stamp,
            deleted: false,
          };
          isNewSnapshot = true;
        }

        const records = makeRecords(snapshot.members, existingAttendance, ses, stamp)
          .map((record) => syncV2Record('attendance', record, {
            pendingCreate: !existingAttendance.some((candidate) => candidate.id === record.id),
          }));
        if (!records.length) {
          result = { kind: 'empty', records: [] };
          return {};
        }

        const nextSession = ses.status === 'scheduled'
          ? syncV2Record('sessions', { ...ses, status: 'held', updatedAt: stamp }) : null;
        const outbox = (commandKind === 'fill'
          ? [syncV2CommandEntry({
            store: 'attendance', recordId: `fill:${sesId}`, command: 'attendance:fill', stamp,
            patch: { sessionId: sesId, status: records[0]?.status, studentIds: records.map((record) => record.studentId) },
            dependencies: [
              { store: 'sessions', recordId: sesId, requiresServerRevision: true },
              ...records.map((record) => ({ store: 'students', recordId: record.studentId, requiresServerRevision: true })),
            ],
          })]
          : records.map((record) => syncV2CommandEntry({
            store: 'attendance', recordId: record.id, command: 'attendance:record', stamp,
            baseRevision: existingAttendance.find((candidate) => candidate.id === record.id)?.serverRevision ?? 0,
            patch: { sessionId: sesId, studentId: record.studentId, status: record.status, note: record.note ?? '' },
            dependencies: [
              { store: 'sessions', recordId: sesId, requiresServerRevision: true },
              { store: 'students', recordId: record.studentId, requiresServerRevision: true },
            ],
          }))).filter(Boolean);
        result = { kind: 'snapshot', records, snapshot };
        return {
          ...(isNewSnapshot ? { sessionRosterSnapshots: { put: [snapshot] } } : {}),
          attendance: { put: records },
          ...(nextSession ? { sessions: { put: [nextSession] } } : {}),
          outbox: { put: outbox },
        };
      },
    });
    applyCommittedPuts(committed);
    return result;
  } catch (err) {
    reportWriteError(err, { op: 'mutateSnapshotAttendance', sesId });
    return { kind: 'error', records: [] };
  }
}

/**
 * حالة اكتمال الحضور مشتقة من الحصة المؤرخة وسجل الحضور فقط؛ لا تُخزَّن
 * كحقل مستقل حتى لا تنفصل عن وقت الحصة التاريخي أو عن بيانات الحضور المزامنة.
 * لا تصبح الحصة مستحقة إلا بعد نهاية وقتها الفعلي في ذلك التاريخ.
 */
export function attendanceCompleteness(ses, reference = new Date()) {
  if (!ses) return { state: 'excluded', completed: false, due: false, recorded: 0, expected: 0 };
  if (['cancelled_holiday', 'cancelled', 'missed', 'postponed'].includes(ses.status)) {
    return { state: 'excluded', completed: false, due: false, recorded: 0, expected: 0 };
  }

  const roster = sessionRoster(ses).members;
  const rosterIds = new Set(roster.map((student) => student.id));
  const records = attendanceIn(ses.id).filter((record) => rosterIds.has(record.studentId));
  const expected = roster.length;
  const completed = expected > 0 && records.length >= expected;
  const end = ses.endTime || ses.startTime || '23:59';
  const dueAt = new Date(`${ses.date}T${end}:00`);
  const due = Number.isFinite(dueAt.getTime()) && reference.getTime() >= dueAt.getTime();

  if (completed) return { state: 'completed', completed, due, recorded: records.length, expected };
  if (due) return { state: 'pending', completed, due, recorded: records.length, expected };
  return { state: 'future', completed, due, recorded: records.length, expected };
}

/**
 * إسقاط تقارير التنفيذ: يربط الحصص المؤرخة بالإسناد الحالي وحالة اكتمال الحضور
 * المشتقة. لا يقرأ وقتًا من خانة الجدول المتكررة، فتظل الحصص التاريخية ثابتة.
 */
export function executionReport({ yearId = activeYear()?.id, termId = activeTerm()?.id, reference = new Date() } = {}) {
  const scopedTerms = live(state.terms).filter((term) => term.yearId === yearId && (!termId || term.id === termId));
  const termIds = new Set(scopedTerms.map((term) => term.id));
  const scopedTeachings = live(state.teachings).filter((teaching) => termIds.has(teaching.termId));
  const teachingIds = new Set(scopedTeachings.map((teaching) => teaching.id));
  const rows = live(state.sessions)
    .filter((session) => teachingIds.has(session.teachingId))
    .map((session) => {
      const teaching = getTeaching(session.teachingId);
      const section = teaching ? getSection(teaching.sectionId) : null;
      const completeness = attendanceCompleteness(session, reference);
      return { session, teaching, section, completeness };
    })
    .sort((a, b) => a.session.date.localeCompare(b.session.date) || a.session.period - b.session.period);
  const counts = { generated: rows.length, completed: 0, pending: 0, future: 0, excluded: 0 };
  for (const row of rows) counts[row.completeness.state]++;
  const eligible = counts.completed + counts.pending;
  const sectionIds = new Set(scopedTeachings.map((teaching) => teaching.sectionId));
  const students = live(state.enrollments).filter((enrollment) => sectionIds.has(enrollment.sectionId) && enrollment.status === 'active').length;
  return {
    terms: scopedTerms,
    teachings: scopedTeachings,
    rows,
    counts,
    sections: sectionIds.size,
    students,
    percentage: eligible ? Math.round((counts.completed / eligible) * 100) : null,
  };
}
export function attendanceCompletenessFor(tchId, date = todayISO(), reference = new Date()) {
  const sessions = sessionsOnFor(tchId, date);
  const summary = { sessions: 0, completed: 0, pending: 0, future: 0 };
  for (const ses of sessions) {
    const status = attendanceCompleteness(ses, reference);
    if (status.state === 'excluded') continue;
    summary.sessions++;
    summary[status.state]++;
  }
  return summary;
}

/** كل التواريخ التي فيها حصص لهذا الإسناد، من الأحدث. */
export function sessionDates(tchId) {
  const set = new Set(sessionsOf(tchId).map((s) => s.date));
  return [...set].sort().reverse();
}

export const slotsOf = (tchId) =>
  live(state.slots).filter((s) => s.teachingId === tchId)
    .sort((a, b) => a.weekday - b.weekday || a.period - b.period);

export const getSlot = (id) => live(state.slots).find((s) => s.id === id);

export const allSlots = (tmId = activeTerm()?.id) => {
  const ids = new Set(teachings(tmId).map((t) => t.id));
  return live(state.slots).filter((s) => ids.has(s.teachingId))
    .sort((a, b) => a.weekday - b.weekday || a.period - b.period);
};

/** عدد الحصص الأسبوعية لإسناد — مشتق من الجدول لا رقم ثابت. */
export const weeklyPeriods = (tchId) => slotsOf(tchId).length;

/* ---------- ملفات توقيت الحصص ---------- */

export const timeProfiles = () => sortByOrder(live(state.timeProfiles));

export const getTimeProfile = (id) =>
  state.timeProfiles.find((p) => p.id === id && !p.deleted) ?? null;

export const activeTimeProfile = () =>
  getTimeProfile(state.device?.activeTimeProfileId) ?? timeProfiles()[0] ?? null;

/** وقت حصة برقمها في يوم — من الملف النشط ما لم يُطلب غيره. */
export const timeFor = (wd, period, profile = activeTimeProfile(), grade = null, date = null, day = undefined) => {
  const p = resolveProfile(profile, date, day);
  return periodTime(p, wd, period, grade);
};

/** أرقام الحصص المتاحة في يوم حسب الملف النشط. */
export const availablePeriods = (wd = null, profile = activeTimeProfile(), date = null, day = undefined) => {
  const p = resolveProfile(profile, date, day);
  return periodNumbers(p, wd);
};

/** يستنتج الملف الفعلي ليوم معين حسب الأولوية: استثناء تقويم، تقويم مدمج، موسمي، ثم الملف النشط. */
export function resolveProfile(profile, date, explicitDay = undefined) {
  if (!profile || !date) return profile;

  const day = explicitDay === undefined ? calendarDayFor(date) : explicitDay;

  // يوم «عن بُعد» يستعمل وقت التوقيت المدمج نفسه، حتى لو كان الملف اليدوي الحالي موسمياً.
  if (day?.kind === 'remote') {
    const hybrid = timeProfiles().find((p) => p.overrides?.config?.type === 'hybrid') ?? profile;
    return {
      ...hybrid,
      periods: hybrid.overrides?.remote ?? hybrid.periods,
      overrides: { config: { type: 'remote', assembly: { enabled: false }, recess: { enabled: false }, gap: 0 } },
    };
  }

  const validProfiles = timeProfiles().filter(
    (p) => p.overrides?.config?.type !== 'hybrid' && p.activeFrom && p.activeFrom <= date && (!p.activeTo || p.activeTo >= date)
  );
  validProfiles.sort((a, b) => b.activeFrom.localeCompare(a.activeFrom));
  return validProfiles[0] ?? profile;
}

export const setActiveTimeProfile = (id) => patchDevice({ activeTimeProfileId: id });

export async function createTimeProfile(data) {
  const p = makeTimeProfile({ order: timeProfiles().length, ...data });
  await save({ timeProfiles: [p] });
  return p;
}

export const deleteTimeProfile = (id) => softDelete('timeProfiles', id);

/* ---------- التقويم ---------- */

export const calendarsOf = (yId) => live(state.calendars).filter((c) => c.yearId === yId);
export const activeCalendar = () => calendarsOf(activeYear()?.id)[0] ?? null;

export const calendarDaysOf = (calId) =>
  live(state.calendarDays).filter((d) => d.calendarId === calId).sort((a, b) => (a.date < b.date ? -1 : 1));

/** تصنيف يوم معيّن في تقويم السنة النشطة — أو null إن لم يُدخل. */
export function calendarDayFor(date) {
  return calendarDayForYear(activeYear()?.id, date);
}

/** يوم تقويم لسنة محددة — مهم عند عرض إسناد تاريخي لا يطابق السنة النشطة. */
export function calendarDayForYear(yearId, date) {
  const matching = calendarsOf(yearId)
    .map((calendar) => ({ calendar, day: live(state.calendarDays).find((d) => d.calendarId === calendar.id && d.date === date) }))
    .filter(({ day }) => day);
  // A local custom exception is intentionally more specific than a preset day.
  return matching.find(({ calendar }) => calendar.source === 'custom')?.day ?? matching[0]?.day ?? null;
}

export { getCalendarPreset, WESTERN_1448_1449_PRESET_ID };

export function calendarPresetForYear(yearId = activeYear()?.id) {
  return getCalendarPreset(getYear(yearId)?.calendarPresetId);
}

/** Applies a built-in template without replacing existing user calendar data. */
export async function applyCalendarPreset(presetId = WESTERN_1448_1449_PRESET_ID, { activate = false } = {}) {
  const preset = getCalendarPreset(presetId);
  if (!preset) throw new Error('التقويم المعتمد غير متاح.');
  const records = calendarPresetRecords(preset);
  const existingYear = getYear(records.year.id);
  if (!existingYear && state.years.some((year) => year.id === records.year.id && year.deleted)) {
    return { ok: false, reason: 'year-deleted' };
  }
  const switching = existingYear?.calendarPresetId !== preset.id;
  const timestamp = now();
  const writes = {};
  const queue = (collection, candidate) => {
    const previous = state[collection].find((record) => record.id === candidate.id);
    if (previous && Object.keys(candidate).every((key) => key === 'updatedAt' || candidate[key] === previous[key])) return;
    (writes[collection] ??= []).push({ ...candidate, updatedAt: timestamp });
  };
  queue('years', {
    ...(existingYear ?? records.year),
    calendarPresetId: preset.id, calendarRegion: preset.regionLabel,
    gregorianLabel: preset.gregorianLabel,
    startDate: switching ? preset.academicYearStart : existingYear.startDate ?? preset.academicYearStart,
    endOfYearVacationStart: preset.endOfYearVacationStart,
    nextAcademicYearStart: preset.nextAcademicYearStart,
  });

  const currentTerms = termsOf(records.year.id);
  const selectedTerms = [];
  for (const presetTerm of records.terms) {
    const term = currentTerms.find((record) => record.index === presetTerm.index);
    if (!term && state.terms.some((record) => record.id === presetTerm.id && record.deleted)) {
      return { ok: false, reason: 'term-deleted' };
    }
    // Retain persisted term IDs/status/metadata and custom date edits on refresh.
    // The previously shipped official Western end date was June 30, not July 1.
    const oldWesternEnd = !switching && preset.id === WESTERN_1448_1449_PRESET_ID &&
      term?.index === 2 && term.calendarId === records.calendar.id && term.endDate === '2027-06-30';
    const next = term ? {
      ...term, calendarId: records.calendar.id,
      startDate: switching || !term.startDate ? presetTerm.startDate : term.startDate,
      endDate: switching || !term.endDate || oldWesternEnd ? presetTerm.endDate : term.endDate,
    } : presetTerm;
    selectedTerms.push(next);
    queue('terms', next);
  }

  // Retirement is scoped by calendar ownership of this year, never by a global
  // presetId filter. Custom calendars and other years are completely untouched.
  const oldCalendars = state.calendars.filter((calendar) => calendar.yearId === records.year.id &&
    calendar.source?.startsWith('preset:') && calendar.id !== records.calendar.id);
  const oldIds = new Set(oldCalendars.map((calendar) => calendar.id));
  const retire = (collection, record) => queue(collection, {
    ...record, deleted: true, deletedAt: new Date(timestamp).toISOString(),
  });
  // A locally added extra term must not retain a pointer to a retired calendar.
  for (const term of currentTerms) {
    if (!selectedTerms.some((selected) => selected.id === term.id) && oldIds.has(term.calendarId)) {
      queue('terms', { ...term, calendarId: records.calendar.id });
    }
  }
  for (const calendar of oldCalendars.filter((record) => !record.deleted)) retire('calendars', calendar);
  const selectedCalendar = state.calendars.find((record) => record.id === records.calendar.id);
  queue('calendars', { ...selectedCalendar, ...records.calendar, deletedAt: undefined });
  const expectedIds = new Set(records.calendarDays.map((day) => day.id));
  for (const day of state.calendarDays.filter((record) => !record.deleted)) {
    if (oldIds.has(day.calendarId) || (day.calendarId === records.calendar.id && !expectedIds.has(day.id))) {
      retire('calendarDays', day);
    }
  }
  for (const day of records.calendarDays) {
    const previous = state.calendarDays.find((record) => record.id === day.id);
    queue('calendarDays', { ...previous, ...day, deletedAt: undefined });
  }
  // Use Production's atomic data+outbox save and existing BroadcastChannel path.
  if (Object.keys(writes).length && !(await save(writes))) throw new Error('تعذر حفظ إعدادات التقويم. حاول مرة أخرى.');
  const preference = { preferredEducationRegion: preset.id };
  if (activate) {
    preference.activeYearId = records.year.id;
    preference.activeTermId = currentTerms.find((term) => term.id === state.device.activeTermId)?.id ?? selectedTerms[0].id;
  }
  if (Object.entries(preference).some(([key, value]) => state.device[key] !== value)) await patchDevice(preference);
  return { ok: true, applied: Object.values(writes).flat().length, year: getYear(records.year.id) };
}

/* ---------- المنهج ---------- */

export const unitsFor = (subId, grade, termIndex) =>
  sortByOrder(
    live(state.units).filter(
      (u) => u.subjectId === subId &&
        (grade === undefined || u.grade === Number(grade)) &&
        (termIndex === undefined || u.termIndex === Number(termIndex))
    )
  );

export const lessonsOf = (unitId) => sortByOrder(live(state.lessons).filter((l) => l.unitId === unitId));
export const getLesson = (id) => state.lessons.find((l) => l.id === id && !l.deleted) ?? null;
export const getUnit = (id) => state.units.find((u) => u.id === id && !u.deleted) ?? null;

/**
 * وحدة المنهج التي يقيسها بند التقييم — من ربطه المباشر أو عبر درسه.
 * أساس تقارير إتقان المفاهيم لاحقًا؛ لا واجهة له بعد.
 */
export function itemCurriculum(item) {
  if (!item) return null;
  const lesson = item.lessonId ? getLesson(item.lessonId) : null;
  const unit = getUnit(item.unitId ?? lesson?.unitId ?? null);
  if (!lesson && !unit) return null;
  return { unit, lesson };
}

/* ---------- سياق الحساب ---------- */

export function teachingContext(tchId) {
  const roster = students(tchId);
  const ids = new Set(roster.map((s) => s.id));
  const attByStudent = groupBy(
    state.attendance.filter((a) => ids.has(a.studentId) && a.teachingId === tchId), 'studentId');
  const logsByStudent = groupBy(
    state.logs.filter((l) => ids.has(l.studentId) && l.teachingId === tchId), 'studentId');

  const classHasParticipation = live(state.logs).some(
    (l) => l.teachingId === tchId && l.kind === 'participation'
  );

  const ctx = Object.create(null);
  for (const s of roster) {
    ctx[s.id] = {
      scoresByItem: portableScoresByItem(s.id, tchId),
      automaticByItem: portableAutomaticByItem(s.id, tchId),
      attendance: attByStudent[s.id] ?? [],
      logs: logsByStudent[s.id] ?? [],
      classHasParticipation,
    };
  }
  return { roster, items: items(tchId), ctx };
}

/** كشف الحضور التاريخي: لكل حصة مصدر كشف مستقل، لا كشف الفصل الحالي. */
export function attendanceReportContext(tchId) {
  const sessions = sessionsOf(tchId).slice().reverse();
  const studentsById = new Map();
  const rosterBySession = new Map();
  const attendanceBySession = new Map();
  for (const ses of sessions) {
    const roster = sessionRoster(ses);
    rosterBySession.set(ses.id, roster);
    for (const student of roster.members) {
      if (!studentsById.has(student.id)) studentsById.set(student.id, student);
    }
    const memberIds = new Set(roster.members.map((student) => student.id));
    attendanceBySession.set(ses.id, new Map(
      attendanceIn(ses.id).filter((record) => memberIds.has(record.studentId)).map((record) => [record.studentId, record])
    ));
  }
  return { sessions, students: [...studentsById.values()], rosterBySession, attendanceBySession };
}

/** سياق طالب داخل إسناد محدد — لا يخلط إسنادًا بآخر. */
export function studentContext(studentId, tchId) {
  const inTeaching = (r) => !tchId || r.teachingId === tchId;
  return {
    scoresByItem: tchId ? portableScoresByItem(studentId, tchId) : indexScores(scoresOf(studentId)),
    automaticByItem: tchId ? portableAutomaticByItem(studentId, tchId) : Object.create(null),
    attendance: attendanceOf(studentId).filter(inTeaching),
    logs: logsOf(studentId).filter(inTeaching),
    classHasParticipation: tchId
      ? live(state.logs).some((l) => l.teachingId === tchId && l.kind === 'participation')
      : false,
  };
}

/**
 * سجل الطالب المستمر عبر الإسنادات. هذا إسقاط قراءة فقط: تبقى السجلات
 * مرتبطة بحصتها وإسنادها وشعبتها الأصلية، ولا تدخل الدرجات في هذا التجميع.
 */
export function studentHistory(studentId) {
  const withContext = (record) => {
    const session = record.sessionId ? getSession(record.sessionId) : null;
    const teaching = getTeaching(session?.teachingId ?? record.teachingId);
    const section = teaching ? getSection(teaching.sectionId) : null;
    const subject = teaching ? getSubject(teaching.subjectId) : null;
    const term = teaching ? getTerm(teaching.termId) : null;
    return {
      record,
      session,
      teaching,
      section,
      subject,
      term,
      date: record.date ?? session?.date ?? '',
      contextLabel: teachingLabel(teaching) || sectionLabel(section) || '',
    };
  };
  const newestFirst = (left, right) =>
    String(right.date ?? '').localeCompare(String(left.date ?? '')) ||
    Number(right.record.createdAt ?? right.record.updatedAt ?? 0) -
      Number(left.record.createdAt ?? left.record.updatedAt ?? 0) ||
    String(left.record.id ?? '').localeCompare(String(right.record.id ?? ''));
  const project = (records) => records.map(withContext).sort(newestFirst);

  return {
    attendance: project(attendanceOf(studentId)),
    logs: project(logsOf(studentId)),
    notes: project(notesOf(studentId)),
  };
}

/* ---------- عمليات: البنية ---------- */

export async function createYear(data) {
  const y = makeYear(data);
  await save({ years: [y] });
  return y;
}

export async function createTerm(data) {
  const t = makeTerm(data);
  await save({ terms: [t] });
  return t;
}

export async function createSubject(data) {
  const s = makeSubject(data);
  await save({ subjects: [s] });
  return s;
}

export async function createSection(data) {
  const year = activeYear();
  const yearId = data.yearId ?? year?.id;
  const existing = sections(yearId).find(s =>
    !s.deleted && s.yearId === yearId &&
    s.grade === Number(data.grade) && 
    normalizeSectionLabel(s.label) === normalizeSectionLabel(data.label)
  );
  if (existing) throw new Error(`هذا الفصل موجود مسبقًا (${gradeLabel(existing.grade)} / ${existing.label})`);
  
  const s = makeSection({ yearId, order: sections(yearId).length, ...data });
  await save({ sections: [s] });
  return s;
}

export async function editSection(id, data) {
  const existing = getSection(id);
  if (!existing) throw new Error('الفصل غير موجود.');
  
  const duplicate = sections(existing.yearId).find(s =>
    !s.deleted && s.id !== id &&
    s.yearId === existing.yearId && 
    s.grade === Number(data.grade) && 
    normalizeSectionLabel(s.label) === normalizeSectionLabel(data.label)
  );
  if (duplicate) throw new Error(`هذا الفصل موجود مسبقًا (${gradeLabel(duplicate.grade)} / ${duplicate.label})`);
  
  const { makeSection } = await import('./models.js');
  const name = `${data.grade}/${data.label}`;
  const updated = makeSection({ ...existing, ...data, name, id });
  await patch('sections', id, { grade: updated.grade, label: updated.label, name: updated.name, color: updated.color });
  return updated;
}

/** ينشئ إسنادًا تدريسيًا ومعه بنود التقييم الافتراضية. */
export async function createTeaching({ sectionId: secId, subjectId: subId, termId: tmId }) {
  const term = tmId ?? activeTerm()?.id;
  const tch = makeTeaching({
    sectionId: secId, subjectId: subId, termId: term,
    order: teachings(term).length,
  });
  if (getTeaching(tch.id)) return getTeaching(tch.id);
  const defaults = defaultItemsFor(tch.id);
  await save({ teachings: [tch], items: defaults }, {
    [TEACHING_CREATION_PROOF]: { version: 1, teaching: tch, items: defaults },
  });
  return tch;
}

/** حذف إسناد: يحذف بنوده ودرجاته وحصصه — **ولا يمس الطلاب ولا الشعبة**. */
export async function deleteTeaching(tchId) {
  const itemIds = new Set(state.items.filter((i) => i.teachingId === tchId).map((i) => i.id));
  const sessionIds = new Set(state.sessions.filter((s) => s.teachingId === tchId).map((s) => s.id));
  return cascadeDelete(
    {
      teachings: (t) => t.id === tchId,
      items: (i) => i.teachingId === tchId,
      scores: (s) => itemIds.has(s.itemId),
      slots: (s) => s.teachingId === tchId,
      sessions: (s) => s.teachingId === tchId,
      sessionRosterSnapshots: (s) => sessionIds.has(s.sessionId),
      attendance: (a) => sessionIds.has(a.sessionId),
      logs: (l) => l.teachingId === tchId,
    },
    { op: 'deleteTeaching', tchId },
    { command: 'delete_teaching', store: 'teachings', targetId: tchId }
  );
}

/**
 * حذف فصل: عملية ذرية تُنهي الشعبة وكل بياناتها التعليمية، مع إبقاء الطالب
 * عندما تكون له علاقة مستقلة محفوظة خارج الفصل المحذوف.
 */
export async function deleteClass(secId) {
  const sectionTeachings = live(state.teachings).filter((t) => t.sectionId === secId);
  const teachingIds = new Set(sectionTeachings.map((t) => t.id));
  const itemIds = new Set(live(state.items).filter((i) => teachingIds.has(i.teachingId)).map((i) => i.id));
  const sessionIds = new Set(live(state.sessions).filter((s) => teachingIds.has(s.teachingId)).map((s) => s.id));
  const targetEnrollment = (e) => !e.deleted && e.sectionId === secId;
  const targetNote = (n) => teachingIds.has(n.teachingId) || sessionIds.has(n.sessionId);
  const targetScore = (s) => itemIds.has(s.itemId);
  const targetAttendance = (a) => sessionIds.has(a.sessionId) || teachingIds.has(a.teachingId);
  const targetLog = (l) => teachingIds.has(l.teachingId) || sessionIds.has(l.sessionId);
  const affectedStudentIds = new Set(live(state.enrollments).filter(targetEnrollment).map((e) => e.studentId));

  // A student remains if any relationship outside this class still gives their
  // record a valid historical or active home. Deleted enrollments are retained
  // history and deliberately count when they belong to another section.
  const orphanStudentIds = new Set([...affectedStudentIds].filter((studentId) => {
    const otherEnrollment = state.enrollments.some((e) => e.studentId === studentId && e.sectionId !== secId);
    const otherNote = state.notes.some((n) => !n.deleted && n.studentId === studentId && !targetNote(n));
    const otherScore = state.scores.some((s) => !s.deleted && s.studentId === studentId && !targetScore(s));
    const otherAttendance = state.attendance.some((a) => !a.deleted && a.studentId === studentId && !targetAttendance(a));
    const otherLog = state.logs.some((l) => !l.deleted && l.studentId === studentId && !targetLog(l));
    return !(otherEnrollment || otherNote || otherScore || otherAttendance || otherLog);
  }));

  return cascadeDelete(
    {
      sections: (s) => s.id === secId,
      teachings: (t) => teachingIds.has(t.id),
      enrollments: targetEnrollment,
      items: (i) => teachingIds.has(i.teachingId),
      scores: (s) => targetScore(s) || orphanStudentIds.has(s.studentId),
      slots: (s) => teachingIds.has(s.teachingId),
      sessions: (s) => teachingIds.has(s.teachingId),
      sessionRosterSnapshots: (s) => sessionIds.has(s.sessionId),
      attendance: (a) => targetAttendance(a) || orphanStudentIds.has(a.studentId),
      logs: (l) => targetLog(l) || orphanStudentIds.has(l.studentId),
      notes: (n) => targetNote(n) || orphanStudentIds.has(n.studentId),
      students: (s) => orphanStudentIds.has(s.id),
    },
    { op: 'deleteClass', secId },
    { command: 'delete_class', store: 'sections', targetId: secId }
  );
}

/**
 * واجهة إدارية داخلية قديمة: تنهي انتساب الشعبة وإسناداتها ولا تمس الطلاب.
 * الحذف المرئي للفصل يستخدم deleteClass أعلاه.
 */
export async function deleteSection(secId) {
  for (const tch of live(state.teachings).filter((t) => t.sectionId === secId)) {
    await deleteTeaching(tch.id);
  }
  return cascadeDelete(
    {
      sections: (s) => s.id === secId,
      enrollments: (e) => e.sectionId === secId,
    },
    { op: 'deleteSection', secId }
  );
}
/* ---------- عمليات: الطلاب والانتساب ---------- */

/* ---------- حدود وتحقق على مستوى البيانات ---------- */

/**
 * الحدود تُفرض هنا لا في الشاشة: كل ما يدخل من ملف نسخة أو من المزامنة لاحقًا
 * يمر من طبقة البيانات، والشاشة وحدها لا تكفي حارسًا.
 */
export const LIMITS = {
  nameMaxLength: 80,
  importMaxRows: 300,
  noteMaxLength: 500,
};

/** اسم صالح: ليس فارغًا ولا مسافات، ومقصوص عند الحد. */
export function normalizeName(value) {
  const name = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (name.length < 2) return null;
  return name.slice(0, LIMITS.nameMaxLength);
}

/** هل رقم الكشف مأخوذ في هذه الشعبة؟ */
export function rollNoTaken(secId, rollNo, exceptEnrollmentId = null) {
  if (rollNo === null || rollNo === undefined || rollNo === '') return false;
  return enrollmentsIn(secId).some(
    (e) => e.status === 'active' && e.rollNo === Number(rollNo) && e.id !== exceptEnrollmentId
  );
}

const nextRollNo = (secId) =>
  enrollmentsIn(secId).reduce((m, e) => Math.max(m, e.rollNo ?? 0), 0) + 1;

const validRollNo = (value) => Number.isInteger(Number(value)) && Number(value) >= 1 && Number(value) <= 999;

const nextRollNoFrom = (enrollments, secId) =>
  enrollments.filter((e) => e.sectionId === secId && !e.deleted)
    .reduce((max, e) => Math.max(max, Number(e.rollNo) || 0), 0) + 1;

/**
 * Builds the complete final active roster for one section without persisting
 * an intermediate numbering state. The caller owns the surrounding batch.
 */
const sequentialRosterPlan = (enrollments, studentsById, secId, stamp) => {
  const active = enrollments.filter((row) => row.sectionId === secId && row.status === 'active' && !row.deleted);
  if (active.length > 999 || active.some((row) => !studentsById.has(row.studentId))) return null;
  const byEnrollmentId = new Map(active.map((row) => [row.id, row]));
  const sorted = sortStudents(active.map((enrollment) => ({
    ...studentsById.get(enrollment.studentId),
    rollNo: enrollment.rollNo,
    enrollmentId: enrollment.id,
  })));
  return sorted.map((student, index) => {
    const enrollment = byEnrollmentId.get(student.enrollmentId);
    const rollNo = index + 1;
    return {
      ...enrollment,
      rollNo,
      updatedAt: enrollment.rollNo === rollNo ? enrollment.updatedAt : stamp,
    };
  });
};

/** يضبط رقم كشف مع منع التكرار داخل الشعبة. يعيد {ok, reason}. */
export async function setRollNo(enrollmentId, rollNo) {
  const en = state.enrollments.find((e) => e.id === enrollmentId && !e.deleted);
  if (!en) return { ok: false, reason: 'notFound' };

  const value = rollNo === null || rollNo === '' ? null : Number(rollNo);
  if (value !== null && (!Number.isInteger(value) || value < 1 || value > 999)) {
    return { ok: false, reason: 'range' };
  }
  if (rollNoTaken(en.sectionId, value, en.id)) return { ok: false, reason: 'duplicate' };

  await patch('enrollments', en.id, { rollNo: value });
  return { ok: true };
}

/** ترحيل متكرر آمن: ملاحظة الطالب القديمة تظهر مرة واحدة في السجل المؤرّخ.
 * نستخدم تاريخ آخر تعديل إن وُجد؛ وإلا تاريخ تشغيل الترحيل كأفضل تاريخ متاح. */
export async function migrateLegacyStudentNotes() {
  const migrated = [];
  for (const student of live(state.students)) {
    const text = String(student.note ?? '').trim();
    if (!text) continue;
    const localOnly = isLocalOnlyRecord(student);
    const id = `${localOnly ? 'demo:' : ''}legacy-note:${student.id}`;
    if (state.notes.some((note) => note.id === id)) continue;
    const stamp = Number.isFinite(Number(student.updatedAt)) ? Number(student.updatedAt) : now();
    migrated.push(makeNote({
      id, studentId: student.id, text, kind: 'legacy',
      date: new Date(stamp).toISOString().slice(0, 10), createdAt: stamp, updatedAt: stamp,
    }));
  }
  if (migrated.length) await save({ notes: migrated });
  return migrated;
}

/** يضيف ملاحظة مستقلة إلى سجل الطالب، مع سياق اختياري محفوظ تاريخيًا. */
export async function addStudentNote({ studentId, text, teachingId = null, sessionId = null, date = todayISO(), createdAt = now() } = {}) {
  const student = getStudent(studentId);
  const clean = String(text ?? '').trim();
  if (!student || !clean || clean.length > 1200) return null;
  const stamp = Number(createdAt) || now();
  const note = makeNote({
    ...(isLocalOnlyRecord(student) ? { id: `demo:note:${uid()}` } : {}),
    studentId, teachingId, sessionId, date, text: clean, createdAt: stamp, updatedAt: stamp,
  });
  return (await save({ notes: [note] })) ? note : null;
}

export async function editStudentNote(noteId, text) {
  const clean = String(text ?? '').trim();
  if (!clean || clean.length > 1200) return null;
  return patch('notes', noteId, { text: clean });
}

export async function deleteStudentNote(noteId) {
  const note = state.notes.find((item) => item.id === noteId && !item.deleted);
  if (!note) return null;
  return patch('notes', noteId, { deleted: true, deletedAt: new Date().toISOString() });
}

/** يضيف طالبًا جديدًا وينسبه لشعبة. يرفض الاسم الفارغ. */
export async function addStudent(secId, name, { rollNo = null, note = '' } = {}) {
  const clean = normalizeName(name);
  if (!clean) return null;

  const student = {
    id: uid(), updatedAt: now(), deleted: false,
    name: clean, note: String(note ?? '').slice(0, LIMITS.noteMaxLength), status: 'active',
  };
  const nextRoll = rollNo ?? nextRollNo(secId);
  const en = makeEnrollment({ studentId: student.id, sectionId: secId, rollNo: nextRoll });
  await save({ students: [student], enrollments: [en] });
  return student;
}

/** يعدّل اسم طالب — يرفض الفارغ ويقصّ الطويل. */
export async function renameStudent(studentId, name) {
  const clean = normalizeName(name);
  if (!clean) return null;
  return patch('students', studentId, { name: clean });
}

/**
 * استيراد أسماء دفعة واحدة.
 * يعيد { added, skippedInvalid, skippedOverLimit } — فيعرف المعلّم ما لم يدخل ولماذا.
 */
export async function importStudents(secId, names) {
  const clean = [];
  let skippedInvalid = 0;

  for (const raw of names ?? []) {
    const n = normalizeName(raw);
    if (!n) { skippedInvalid++; continue; }
    clean.push(n);
  }

  const skippedOverLimit = Math.max(0, clean.length - LIMITS.importMaxRows);
  const accepted = clean.slice(0, LIMITS.importMaxRows);

  let roll = nextRollNo(secId) - 1;
  const stamp = now();
  const students = [];
  const enrollments = [];

  for (const name of accepted) {
    const st = { id: uid(), updatedAt: stamp, deleted: false, name, note: '', status: 'active' };
    students.push(st);
    enrollments.push(
      makeEnrollment({ studentId: st.id, sectionId: secId, rollNo: ++roll, updatedAt: stamp })
    );
  }
  if (students.length) await save({ students, enrollments });
  return { added: students.length, skippedInvalid, skippedOverLimit };
}

/**
 * نقل طالب بين شعبتين: يُنهى الانتساب القديم ويُفتح جديد، ثم يُرقّم كشفا
 * المصدر والوجهة في نفس الدفعة المحلية ونفس العملية السحابية. لا يُحذف
 * الطالب ولا تُنشأ له هوية جديدة، ودرجاته وحضوره السابقان يبقيان مربوطين
 * بإسنادات شعبته السابقة.
 */
export async function transferStudent(studentId, toSectionId, { date = todayISO(), note = '' } = {}) {
  if (!studentId || !toSectionId || !date) return null;
  const stamp = now();
  let result = { ok: false, status: 'write-failed' };
  let committed;

  try {
    committed = await db.applyBatch({ students: {}, sections: {}, enrollments: {}, outbox: {} }, {
      prepare(current) {
        const student = current.students.find((row) => row.id === studentId && !row.deleted);
        const destinationSection = current.sections.find((row) => row.id === toSectionId && !row.deleted);
        if (!student) {
          result = { ok: false, status: 'student-missing' };
          return {};
        }
        if (!destinationSection) {
          result = { ok: false, status: 'destination-missing' };
          return {};
        }

        const active = current.enrollments.filter((row) =>
          row.studentId === studentId && row.status === 'active' && !row.deleted);
        const destinationId = enrollmentId(studentId, toSectionId);
        const destination = current.enrollments.find((row) => row.id === destinationId) ?? null;

        // A retried completed transfer is intentionally write-free.
        if (active.length === 1 && active[0].id === destinationId) {
          result = { ok: true, status: 'already-active', enrollment: active[0] };
          return {};
        }
        if (active.length !== 1) {
          result = { ok: false, status: active.length ? 'multiple-active-memberships' : 'source-missing' };
          return {};
        }
        if (destination?.deleted) {
          // A tombstone is a durable deletion signal; transfer must not revive it.
          result = { ok: false, status: 'destination-tombstoned' };
          return {};
        }

        const source = active[0];
        // This number is private to the in-memory plan. It is replaced by the
        // final sequential destination roster before the IndexedDB transaction
        // commits, so a returned student's old number cannot collide locally.
        const provisionalRollNo = Number(destination?.rollNo) || nextRollNoFrom(current.enrollments, toSectionId);

        const retired = {
          ...source,
          status: 'transferred',
          endDate: date,
          transferNote: String(note ?? ''),
          updatedAt: stamp,
        };
        const activated = destination
          ? {
            ...destination,
            status: 'active',
            startDate: date,
            endDate: null,
            rollNo: provisionalRollNo,
            updatedAt: stamp,
          }
          : makeEnrollment({
            studentId,
            sectionId: toSectionId,
            rollNo: provisionalRollNo,
            startDate: date,
            updatedAt: stamp,
          });

        const afterMembership = current.enrollments
          .filter((row) => row.id !== source.id && row.id !== activated.id)
          .concat([retired, activated]);
        const studentsById = new Map(current.students
          .filter((row) => !row.deleted)
          .map((row) => [row.id, row]));
        const sourceRoster = sequentialRosterPlan(afterMembership, studentsById, source.sectionId, stamp);
        const destinationRoster = sequentialRosterPlan(afterMembership, studentsById, toSectionId, stamp);
        if (!sourceRoster || !destinationRoster) {
          result = { ok: false, status: 'roster-plan-unavailable' };
          return {};
        }

        const finalById = new Map([retired, ...sourceRoster, ...destinationRoster].map((row) => [row.id, row]));
        const finalDestination = finalById.get(activated.id);
        if (!finalDestination || !validRollNo(finalDestination.rollNo)) {
          result = { ok: false, status: 'destination-roll-unavailable' };
          return {};
        }
        const changedEnrollments = [...finalById.values()].filter((row) => {
          const before = current.enrollments.find((candidate) => candidate.id === row.id);
          return !before || before.status !== row.status || before.rollNo !== row.rollNo ||
            before.startDate !== row.startDate || before.endDate !== row.endDate ||
            before.transferNote !== row.transferNote || before.updatedAt !== row.updatedAt;
        }).map((row) => syncV2Record('enrollments', row, {
          pendingCreate: !current.enrollments.some((candidate) => candidate.id === row.id),
        }));
        const destinationForCommand = changedEnrollments.find((row) => row.id === finalDestination.id) ?? finalDestination;
        result = { ok: true, status: 'transferred', enrollment: finalDestination };
        return {
          enrollments: { put: changedEnrollments },
          outbox: {
            put: [enrollmentCommandEntry('transfer', destinationForCommand, {
              sourceEnrollmentId: source.id, date, note,
            })].filter(Boolean),
          },
        };
      },
    });
  } catch (error) {
    reportWriteError(error, { op: 'transferStudent', studentId, toSectionId });
    return null;
  }

  if (!result.ok) return null;
  if (result.status === 'already-active') return result.enrollment;
  const changed = changeList('enrollments', committed.enrollments?.put ?? []);
  await absorb(changed);
  broadcast(changed);
  return result.enrollment;
}

/** خروج الطالب من المدرسة — بلا حذف، فيبقى سجله التاريخي كاملًا. */
export async function withdrawStudent(studentId, { date = todayISO(), note = '' } = {}) {
  const enrollment = activeEnrollment(studentId);
  const student = getStudent(studentId);
  if (!enrollment || !student) return null;
  const stamp = now();
  const nextEnrollment = syncV2Record('enrollments', {
    ...enrollment, status: 'withdrawn', endDate: date, transferNote: note, updatedAt: stamp,
  });
  const nextStudent = syncV2Record('students', { ...student, status: 'withdrawn', updatedAt: stamp });
  try {
    const committed = await db.applyBatch({ students: {}, enrollments: {}, outbox: {} }, {
      prepare: () => ({
        students: { put: [nextStudent] },
        enrollments: { put: [nextEnrollment] },
        outbox: { put: [enrollmentCommandEntry('withdraw', nextEnrollment, {
          sourceEnrollmentId: enrollment.id, date, note,
        })].filter(Boolean) },
      }),
    });
    applyCommittedPuts(committed);
    return nextStudent;
  } catch (error) {
    reportWriteError(error, { op: 'withdrawStudent', studentId });
    return null;
  }
}

/** عودة طالب غادر. */
export async function reinstateStudent(studentId, secId, { date = todayISO() } = {}) {
  await patch('students', studentId, { status: 'active' });
  return transferStudent(studentId, secId, { date });
}

/** حذف نهائي (ناعم) للطالب — للخطأ في الإدخال لا للانتقال. */
export async function deleteStudent(studentId) {
  return cascadeDelete(
    {
      students: (s) => s.id === studentId,
      enrollments: (e) => e.studentId === studentId,
      scores: (s) => s.studentId === studentId,
      attendance: (a) => a.studentId === studentId,
      logs: (l) => l.studentId === studentId,
      notes: (n) => n.studentId === studentId,
    },
    { op: 'deleteStudent', studentId },
    { command: 'delete_student', store: 'students', targetId: studentId }
  );
}

export async function renumberRoster(secId) {
  if (!secId) return false;
  const stamp = now();
  const operationId = `renumber:${uid()}`;
  let result = { ok: false, status: 'write-failed' };
  let committed;

  try {
    committed = await db.applyBatch({ students: {}, enrollments: {}, outbox: {} }, {
      prepare(current) {
        const studentsById = new Map(current.students.filter((row) => !row.deleted).map((row) => [row.id, row]));
        const active = current.enrollments
          .filter((row) => row.sectionId === secId && row.status === 'active' && !row.deleted)
          .map((row) => ({ enrollment: row, student: studentsById.get(row.studentId) }))
          .filter((row) => row.student);
        const sorted = sortStudents(active.map(({ enrollment, student }) => ({
          ...student, rollNo: enrollment.rollNo, enrollmentId: enrollment.id,
        })));
        const planned = sorted.map((student, index) => {
          const enrollment = active.find((row) => row.enrollment.id === student.enrollmentId).enrollment;
          return { ...enrollment, rollNo: index + 1, updatedAt: enrollment.rollNo === index + 1 ? enrollment.updatedAt : stamp };
        });
        const changed = planned.filter((row) => current.enrollments.find((currentRow) => currentRow.id === row.id)?.rollNo !== row.rollNo);
        if (!changed.length) {
          result = { ok: true, status: 'unchanged' };
          return {};
        }
        const operation = {
          id: operationId,
          type: 'renumber',
          sectionId: secId,
          roster: structuredClone(planned),
          updatedAt: stamp,
          order: nextEnrollmentOperationOrder(current.outbox),
        };
        result = { ok: true, status: 'renumbered' };
        return {
          enrollments: { put: changed },
          outbox: {
            put: [
              ...changed.map((row) => outboxEntry('enrollments', row, ['rollNo'], 'patch')).filter(Boolean),
              enrollmentOperationEntry(operation, stamp),
            ],
          },
        };
      },
    });
  } catch (error) {
    reportWriteError(error, { op: 'renumberRoster', secId });
    return false;
  }

  if (!result.ok || result.status === 'unchanged') return result.ok;
  const changed = changeList('enrollments', committed.enrollments?.put ?? []);
  await absorb(changed);
  broadcast(changed);
  return true;
}

/* ---------- عمليات: بنود ودرجات ---------- */

export function clampScore(value, itemId) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const item = state.items.find((i) => i.id === itemId);
  const max = Number.isFinite(item?.max) ? item.max : Infinity;
  return Math.min(max, Math.max(0, n));
}

export function setScore(studentId, itemId, value, options = {}) {
  const item = state.items.find((candidate) => candidate.id === itemId && !candidate.deleted);
  if (!item) return null;
  // عندما توجد درجة واحدة متوافقة في شعبة سابقة، نحدّث سجلها نفسه بدل صنع
  // سجل ثانٍ للبند الموازي. أما البند المختلف أو الغامض فيبدأ غير مرصود هنا.
  const existing = portableGradeScore(studentId, item);
  const id = existing?.id ?? scoreId(studentId, itemId);
  const targetItemId = existing?.itemId ?? itemId;
  return patch('scores', id, { value: clampScore(value, itemId), deleted: false }, {
    id, studentId, itemId: targetItemId, value: null, deleted: false, updatedAt: now(),
  }, options);
}

export function deleteItem(itemId) {
  return cascadeDelete(
    { items: (i) => i.id === itemId, scores: (s) => s.itemId === itemId },
    { op: 'deleteItem', itemId },
    { command: 'delete_item', store: 'items', targetId: itemId }
  );
}

export const reorderItems = (pairs) =>
  patchManyRecords('items', pairs.map((p) => ({ id: p.id, changes: { order: p.order } })),
    { op: 'reorderItems' });

/* ---------- عمليات: الحصص والحضور ---------- */

/**
 * يجلب حصة أو ينشئها.
 * إن وافق التاريخ إجازة في التقويم، تُنشأ الحصة بحالة `cancelled_holiday`
 * فلا تُحسب حصة فائتة ولا تولّد غيابًا.
 */
export async function ensureSession(tchId, date, period = 1, extra = {}) {
  const id = sessionId(tchId, date, period);
  const existing = getSession(id);
  if (existing) return existing;

  const day = calendarDayFor(date);
  const holiday = day && !['study', 'exam', 'event'].includes(day.kind);

  // يُطبع وقت الحصة فيها الآن من الملف النشط. تغيير الملف لاحقًا لا يمسّها.
  const profile = activeTimeProfile();
  const tch = getTeaching(tchId);
  const sec = tch ? getSection(tch.sectionId) : null;
  const t = timeFor(weekday(date), period, profile, sec?.grade, date);
  const slot = live(state.slots).find(
    (s) => s.teachingId === tchId && s.weekday === weekday(date) && s.period === period
  );

  const ses = makeSession({
    teachingId: tchId, date, period,
    slotId: slot?.id ?? null,
    startTime: t?.start ?? '',
    endTime: t?.end ?? '',
    timeProfileId: profile?.id ?? null,
    status: holiday ? 'cancelled_holiday' : 'scheduled',
    reason: holiday ? day.label || 'إجازة رسمية' : '',
    ...extra,
  });
  await save({ sessions: [ses] });
  return ses;
}

/**
 * ينشئ الحصص المؤرخة المفقودة من خانات إسناد واحد ضمن حدود فصله الدراسي.
 * لا يعيد إنشاء أو إحياء أي سجل موجود، فتظل الحصص والحضور التاريخيان كما هما.
 */
export async function generateSessionsForRange(tchId, startDate, endDate) {
  const teaching = getTeaching(tchId);
  if (!teaching) throw new Error('الفصل غير موجود.');
  const term = getTerm(teaching.termId);
  const year = term ? getYear(term.yearId) : null;
  if (!term || !year) throw new Error('تعذّر تحديد السنة والفصل الدراسي لهذا الإسناد.');
  if (!term.startDate || !term.endDate) throw new Error('أدخل تاريخ بداية ونهاية الفصل الدراسي أولًا.');
  if (!startDate || !endDate || startDate > endDate) throw new Error('تحقق من نطاق التاريخ.');
  if (endDate < term.startDate || startDate > term.endDate) {
    throw new Error('النطاق المختار خارج تواريخ الفصل الدراسي الحالي.');
  }

  const effectiveStart = startDate < term.startDate ? term.startDate : startDate;
  const effectiveEnd = endDate > term.endDate ? term.endDate : endDate;
  const slots = slotsOf(tchId);
  if (!slots.length) throw new Error('لا توجد حصص في الجدول لهذا الفصل ضمن الإعداد الحالي.');

  const maxDays = 184;
  let date = effectiveStart;
  let dayCount = 0;
  let created = 0;
  let existing = 0;
  let holidays = 0;
  let unavailable = 0;
  let matchedSlotDays = 0;
  const pending = [];
  const knownSessionIds = new Set(state.sessions.map((s) => s.id));
  const section = getSection(teaching.sectionId);
  const profile = activeTimeProfile();

  while (date <= effectiveEnd) {
    dayCount++;
    if (dayCount > maxDays) throw new Error('النطاق كبير جدًا؛ اختر مدة لا تتجاوز 184 يومًا.');

    const matchingSlots = slots.filter((slot) => slot.weekday === weekday(date));
    if (matchingSlots.length) {
      matchedSlotDays++;
      const calendarDay = calendarDayForYear(year.id, date);
      if (calendarDay && !isTeachingDay(calendarDay.kind)) {
        holidays++;
      } else {
        const resolved = resolveProfile(profile, date, calendarDay);
        for (const slot of matchingSlots) {
          const id = sessionId(tchId, date, slot.period);
          if (knownSessionIds.has(id)) {
            existing++;
            continue;
          }
          const timing = periodTime(resolved, weekday(date), slot.period, section?.grade);
          if (!timing) {
            unavailable++;
            continue;
          }
          pending.push(makeSession({
            id,
            teachingId: tchId,
            date,
            period: slot.period,
            slotId: slot.id,
            startTime: timing.start,
            endTime: timing.end,
            timeProfileId: resolved?.id ?? profile?.id ?? null,
            status: 'scheduled',
          }));
          knownSessionIds.add(id);
          created++;
        }
      }
    }
    date = shiftDate(date, 1);
  }

  if (!matchedSlotDays) throw new Error('لا توجد حصص في الجدول ضمن النطاق المختار.');
  if (pending.length) {
    const ok = await save({ sessions: pending });
    if (!ok) throw new Error('تعذّر حفظ الحصص المولّدة.');
  }
  return {
    created, existing, holidays, unavailable,
    startDate: effectiveStart, endDate: effectiveEnd,
    clipped: effectiveStart !== startDate || effectiveEnd !== endDate,
  };
}
export const setSessionStatus = (sesId, status, reason = '') =>
  patch('sessions', sesId, { status, reason });

/** يضبط حضور طالب في حصة. لا يُنشأ حضور إلا لحصة قائمة. */
export async function setAttendance(sesId, studentId, status) {
  const ses = getSession(sesId);
  if (!ses) return null;
  const mutation = await mutateSnapshotAttendance(sesId, (members, existing, session, stamp) => {
    if (!members.some((member) => member.studentId === studentId)) return [];
    const id = attendanceId(studentId, sesId);
    const previous = existing.find((record) => record.id === id);
    return [{
      ...(previous ?? { id, studentId, sessionId: sesId, teachingId: session.teachingId, date: session.date, note: '' }),
      status, deleted: false, updatedAt: stamp,
    }];
  }, 'record');
  if (mutation.kind === 'snapshot') return mutation.records[0] ?? null;
  if (mutation.kind !== 'legacy') return null;

  // Experimental pre-snapshot sessions retain the previous behavior. The
  // forward-only guarantee begins only when a snapshot is first captured.
  const id = attendanceId(studentId, sesId);
  const rec = await patch('attendance', id, { status, deleted: false }, {
    id, studentId, sessionId: sesId, teachingId: ses.teachingId, date: ses.date,
    status, note: '', deleted: false, updatedAt: now(),
  });
  // أول رصد حضور يعني أن الحصة نُفّذت
  if (rec && ses.status === 'scheduled') await setSessionStatus(sesId, 'held');
  return rec;
}

/** يرصد كل الطلاب غير المرصودين في حصة بحالة واحدة. */
export async function fillAttendance(sesId, status = 'present') {
  const ses = getSession(sesId);
  if (!ses) return 0;
  const mutation = await mutateSnapshotAttendance(sesId, (members, existing, session, stamp) => {
    const existingIds = new Set(existing.map((record) => record.studentId));
    return members
      .filter((member) => !existingIds.has(member.studentId))
      .map((member) => ({
        id: attendanceId(member.studentId, sesId), updatedAt: stamp, deleted: false,
        studentId: member.studentId, sessionId: sesId, teachingId: session.teachingId, date: session.date,
        status, note: '',
      }));
  }, 'fill');
  if (mutation.kind === 'snapshot') return mutation.records.length;
  if (mutation.kind !== 'legacy') return 0;

  const roster = students(ses.teachingId);
  const existing = new Set(attendanceIn(sesId).map((a) => a.studentId));
  const stamp = now();
  const recs = roster.filter((student) => !existing.has(student.id)).map((student) => ({
    id: attendanceId(student.id, sesId), updatedAt: stamp, deleted: false,
    studentId: student.id, sessionId: sesId, teachingId: ses.teachingId, date: ses.date,
    status, note: '',
  }));
  if (recs.length) await save({ attendance: recs });
  if (ses.status === 'scheduled') await setSessionStatus(sesId, 'held');
  return recs.length;
}

/* ---------- عمليات: الجدول والتقويم ---------- */

export async function addSlot(tchId, weekday, period, times = {}) {
  const existing = allSlots().find(s => s.weekday === weekday && s.period === period);
  if (existing) {
    throw new Error('لديك حصة مسجلة بالفعل في هذا الوقت.');
  }
  
  const slot = makeSlot({ teachingId: tchId, weekday, period, ...times });
  if (live(state.slots).some((s) => s.id === slot.id)) return null;
  await save({ slots: [slot] });
  return slot;
}

export async function editSlot(slotId, data) {
  const existingSlot = getSlot(slotId);
  if (!existingSlot) throw new Error('الحصة غير موجودة');

  // Check for conflicts
  const conflict = allSlots().find(s => s.id !== slotId && s.weekday === Number(data.weekday) && s.period === Number(data.period));
  if (conflict) {
    throw new Error('لديك حصة مسجلة بالفعل في هذا الوقت.');
  }

  const { makeSlot } = await import('./models.js');
  const updated = makeSlot({ ...existingSlot, ...data, id: slotId });
  await patch('slots', slotId, { 
    weekday: updated.weekday, 
    period: updated.period, 
    teachingId: updated.teachingId,
    start: updated.start,
    end: updated.end
  });
  return updated;
}

export const removeSlot = (slotId) => softDelete('slots', slotId);

export async function ensureCalendar(yId = activeYear()?.id, source = 'custom') {
  const existing = calendarsOf(yId).find((c) => c.source === source);
  if (existing) return existing;
  const cal = makeCalendar({ yearId: yId, source });
  await save({ calendars: [cal] });
  return cal;
}

export async function setCalendarDay(calId, date, kind, label = '') {
  const { calendarDayId, makeCalendarDay } = await import('./models.js');
  const id = calendarDayId(calId, date);
  return patch('calendarDays', id, { kind, label, deleted: false },
    makeCalendarDay({ calendarId: calId, date, kind, label }));
}

export const removeCalendarDay = (id) => softDelete('calendarDays', id);

export function calendarRangesOf(yearId = activeYear()?.id) {
  const groups = new Map();
  for (const calendar of calendarsOf(yearId)) for (const day of calendarDaysOf(calendar.id)) {
    const key = day.rangeId ?? `legacy:${calendar.id}:${day.id}`;
    const group = groups.get(key) ?? { id: key, calendarId: calendar.id, source: calendar.source, kind: day.kind, label: day.label, startDate: day.date, endDate: day.date, days: [] };
    group.startDate = group.startDate < day.date ? group.startDate : day.date;
    group.endDate = group.endDate > day.date ? group.endDate : day.date;
    group.days.push(day); groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => a.startDate.localeCompare(b.startDate) || a.label.localeCompare(b.label));
}

export async function saveCalendarRange({ id = uid(), calendarId, startDate, endDate = startDate, kind, label = '' }) {
  if (!startDate) throw new Error('تاريخ البداية مطلوب.');
  if (endDate < startDate) throw new Error('تاريخ النهاية يجب أن يكون في نفس تاريخ البداية أو بعده.');
  const calendar = state.calendars.find((item) => item.id === calendarId && !item.deleted);
  if (!calendar || calendar.source !== 'custom') throw new Error('لا يمكن تعديل الفترة الرسمية.');
  const existing = live(state.calendarDays).filter((day) => day.calendarId === calendarId && day.rangeId === id);
  const next = [];
  for (let date = startDate; date <= endDate; date = shiftDate(date, 1)) next.push({ id: `cd:${calendarId}:${id}:${date}`, calendarId, date, kind, label, rangeId: id, rangeStart: startDate, rangeEnd: endDate, deleted: false, updatedAt: now() });
  const removed = existing.filter((day) => !next.some((item) => item.id === day.id)).map((day) => ({ ...day, deleted: true, updatedAt: now() }));
  await save({ calendarDays: [...next, ...removed] });
  return id;
}

export async function removeCalendarRange(calendarId, rangeId) {
  const days = live(state.calendarDays).filter((day) => day.calendarId === calendarId && day.rangeId === rangeId);
  if (!days.length) return;
  await save({ calendarDays: days.map((day) => ({ ...day, deleted: true, updatedAt: now() })) });
}

export async function updateTermDates(termId, startDate, endDate) {
  if (!startDate || !endDate) throw new Error('تاريخ البداية والنهاية مطلوبان.');
  if (endDate < startDate) throw new Error('تاريخ النهاية يجب أن يكون في نفس تاريخ البداية أو بعده.');
  const term = getTerm(termId); if (!term) throw new Error('الفصل الدراسي غير موجود.');
  const overlaps = termsOf(term.yearId).some((other) => other.id !== term.id && other.startDate && other.endDate && startDate <= other.endDate && other.startDate <= endDate);
  if (overlaps) throw new Error('يتداخل تاريخ هذا الفصل الدراسي مع فصل دراسي آخر. عدّل تاريخ البداية أو النهاية.');
  return patch('terms', term.id, { startDate, endDate });
}

/**
 * يولّد تقويم هجين متناوب أسبوعيًا.
 * الأسبوع A: الأحد-الثلاثاء (حضوري)، الأربعاء-الخميس (عن بُعد)
 * الأسبوع B: الأحد-الإثنين (حضوري)، الثلاثاء-الخميس (عن بُعد)
 * الأيام الحضورية لا تُضاف (لتتبع الافتراضي)، والعن بُعد تُضاف كـ remote.
 * لا يمس أيام الإجازات الموجودة.
 */
export async function generateHybridCalendar(calId, startDate, endDate) {
  const { shiftDate, weekday, calendarDayId, makeCalendarDay } = await import('./models.js');
  
  let current = startDate;
  let weekIndex = 0;
  const newDays = [];
  const existingDays = calendarDaysOf(calId);

  while (current <= endDate) {
    const wd = weekday(current);
    
    // إجازة الأسبوع
    if (wd === 5 || wd === 6) {
      if (wd === 6) weekIndex++; // انتهى الأسبوع، نبدّل
      current = shiftDate(current, 1);
      continue;
    }

    // الأسبوع الأول هو B (الثلاثاء-الخميس عن بُعد)، والثاني A (الأربعاء-الخميس عن بُعد).
    const isWeekB = weekIndex % 2 === 0;
    // B: remote on Tue (2), Wed (3), Thu (4)
    // A: remote on Wed (3), Thu (4)
    const isRemote = isWeekB ? (wd >= 2) : (wd >= 3);

    if (isRemote) {
      // لا نستبدل الإجازات أو الأيام المحددة مسبقًا بـ 'remote'
      const existing = existingDays.find(d => d.date === current);
      if (!existing || existing.kind === 'study' || existing.kind === 'remote') {
        newDays.push(makeCalendarDay({ calendarId: calId, date: current, kind: 'remote', label: 'عن بُعد' }));
      }
    }
    
    current = shiftDate(current, 1);
  }

  if (newDays.length) {
    await save({ calendarDays: newDays });
  }
}


/* ---------- عمليات: الرصد السريع ---------- */

export async function addLog({ teachingId: tchId, studentId, kind, delta, tag = '', note = '', date, sessionId: sesId = null }) {
  const rec = {
    id: uid(), updatedAt: now(), deleted: false,
    teachingId: tchId, studentId, kind, delta, tag, note,
    sessionId: sesId,
    date: date ?? todayISO(),
  };
  await save({ logs: [rec] });
  return rec;
}

export async function undoLastLog(studentId, kind, date = todayISO()) {
  const today = logsOf(studentId)
    .filter((l) => l.date === date && l.kind === kind)
    .sort((a, b) => a.updatedAt - b.updatedAt);
  const last = today.at(-1);
  if (!last) return false;
  await patch('logs', last.id, { deleted: true });
  return true;
}
