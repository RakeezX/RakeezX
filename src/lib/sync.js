import * as cloud from './cloud.js';
import * as store from '../store.js';
import * as db from './db.js';
import { uid, DEFAULT_TIME_PROFILES } from '../models.js';

export const state = {
  status: 'idle', // idle, pending, offline, syncing, synced, error
  lastSyncedAt: null, // will be initialized from store
  results: {
    profile: null,
    structural: null,
    students: null,
    notes: null
  }
};

const SYNCABLE_STORES = new Set([
  'profile', 'years', 'calendars', 'calendarDays', 'terms', 'subjects', 'sections', 'teachings',
  'students', 'enrollments', 'notes', 'items', 'scores', 'logs',
  'timeProfiles', 'slots', 'sessions', 'attendance'
]);
const STRUCTURAL_STORES = new Set(['years', 'calendars', 'calendarDays', 'terms', 'subjects', 'sections', 'teachings']);
const STUDENT_STORES = new Set(['students', 'enrollments']);
const SCORING_STORES = new Set(['items', 'scores', 'logs']);
const TIMETABLE_STORES = new Set(['timeProfiles', 'slots', 'sessions', 'attendance']);
const AUTO_SYNC_DEBOUNCE_MS = 900;

let autoTimer = null;
let autoRunning = false;
let rerunRequested = false;
let suppressAutoSchedule = false;
let initialized = false;

const isOnline = () => typeof navigator === 'undefined' || navigator.onLine !== false;
const intersects = (stores, expected) => [...expected].some((name) => stores.has(name));

async function pendingOutbox() {
  const entries = await db.getAll('outbox');
  return entries.filter((entry) => SYNCABLE_STORES.has(entry.store));
}

async function acknowledgeOutbox(snapshot) {
  for (const entry of snapshot) {
    const current = await db.get('outbox', entry.id);
    // A mutation made while this run was active keeps its newer entry for the
    // follow-up pass; only the exact successfully-synced snapshot is removed.
    if (current && current.updatedAt === entry.updatedAt) await db.remove('outbox', entry.id);
  }
}

function scheduleAutomaticSync({ full = false, immediate = false } = {}) {
  if (!cloud.session || !cloud.user) return;
  if (!isOnline()) {
    setState({ status: 'offline' });
    return;
  }
  if (autoRunning) {
    rerunRequested = true;
    return;
  }
  if (autoTimer) clearTimeout(autoTimer);
  autoTimer = setTimeout(() => {
    autoTimer = null;
    syncAll({ full });
  }, immediate ? 0 : AUTO_SYNC_DEBOUNCE_MS);
  setState({ status: 'pending' });
}

function failedResult(name) {
  return state.results[name]?.status === 'error' ? state.results[name].error : null;
}

async function runRequiredSync(stores, full) {
  if (full || stores.has('profile')) {
    await syncProfile();
    if (failedResult('profile')) throw new Error(failedResult('profile'));
  }
  if (full || intersects(stores, STRUCTURAL_STORES)) {
    await syncStructural();
    if (failedResult('structural')) throw new Error(failedResult('structural'));
  }
  if (full || intersects(stores, STUDENT_STORES)) {
    await syncStudents();
    if (failedResult('students')) throw new Error(failedResult('students'));
  }
  // Logs can reference a dated session, so timetable/session records must reach
  // the cloud before scoring (which owns the logs sync category) attempts log push.
  if (full || intersects(stores, TIMETABLE_STORES) || stores.has('logs')) {
    await syncTimetable();
    if (failedResult('timetable')) throw new Error(failedResult('timetable'));
  }
  if (full || intersects(stores, SCORING_STORES)) {
    await syncScoring();
    if (failedResult('scoring')) throw new Error(failedResult('scoring'));
  }
  if (full || stores.has('notes')) {
    await syncNotes();
    if (failedResult('notes')) throw new Error(failedResult('notes'));
  }
}

/** Safe orchestration only: existing category merge semantics remain authoritative. */
export async function syncAll({ full = true } = {}) {
  if (!cloud.session || !cloud.user) return false;
  if (!isOnline()) {
    setState({ status: 'offline' });
    return false;
  }
  if (autoRunning) {
    rerunRequested = true;
    return false;
  }

  autoRunning = true;
  suppressAutoSchedule = true;
  const snapshot = await pendingOutbox();
  const stores = new Set(snapshot.map((entry) => entry.store));
  try {
    await runRequiredSync(stores, full);
    await acknowledgeOutbox(snapshot);
    setState({ status: (await pendingOutbox()).length ? 'pending' : 'synced' });
    return true;
  } catch (err) {
    console.warn('[rakeezx sync] Automatic sync failed:', err);
    setState({ status: isOnline() ? 'error' : 'offline' });
    return false;
  } finally {
    suppressAutoSchedule = false;
    autoRunning = false;
    const remaining = await pendingOutbox();
    if (rerunRequested || remaining.length) {
      rerunRequested = false;
      scheduleAutomaticSync();
    }
  }
}

const listeners = new Set();
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function notify() {
  listeners.forEach((fn) => fn());
}

function setState(updates) {
  Object.assign(state, updates);
  notify();
}

export function init() {
  state.lastSyncedAt = store.state.device?.lastSyncAt || null;
  if (initialized) return;
  initialized = true;
  store.subscribe(() => {
    if (!suppressAutoSchedule) scheduleAutomaticSync();
  });
  cloud.subscribe(() => {
    if (cloud.session && cloud.user) scheduleAutomaticSync({ full: true, immediate: true });
    else if (!cloud.session) {
      if (autoTimer) clearTimeout(autoTimer);
      autoTimer = null;
      setState({ status: 'idle' });
    }
  });
  if (cloud.session && cloud.user) scheduleAutomaticSync({ full: true, immediate: true });
  if (typeof addEventListener === 'function') {
    addEventListener('online', () => scheduleAutomaticSync({ full: true, immediate: true }));
    addEventListener('offline', () => setState({ status: 'offline' }));
  }
}

function getDeviceId() {
  let id = store.state.device?.deviceId;
  if (!id) {
    id = uid();
    store.patchDevice({ deviceId: id });
  }
  return id;
}

/**
 * Timestamp normalization
 * Safely parses any date/number to integer milliseconds.
 * Returns 0 if invalid or absent.
 */
function calendarSourceForCloud(source) {
  return String(source ?? '').startsWith('preset:') ? 'moe' : source;
}

function calendarSourceFromCloud(record) {
  const prefix = `cal:${record.year_id}:preset:`;
  return record.source === 'moe' && String(record.id ?? '').startsWith(prefix)
    ? String(record.id).slice(`cal:${record.year_id}:`.length)
    : record.source;
}

function normalizeTimestamp(ts) {
  if (ts === null || ts === undefined || ts === '') return 0;
  if (typeof ts === 'number') return ts;
  if (typeof ts === 'string') {
    const parsedNumber = Number(ts);
    if (!isNaN(parsedNumber) && parsedNumber > 0) return parsedNumber;
    const parsedDate = Date.parse(ts);
    if (!isNaN(parsedDate)) return parsedDate;
  }
  return 0;
}

/**
 * Checks if the local profile contains actual user-entered data
 * rather than just boot-time default placeholders.
 */
function hasMeaningfulProfile(profile) {
  if (!profile) return false;
  return Boolean(
    (profile.teacherName && profile.teacherName.trim() !== '') ||
    (profile.schoolName && profile.schoolName.trim() !== '') ||
    (profile.phone && profile.phone.trim() !== '')
  );
}

/**
 * Phase 5A: Profile Sync only.
 * Sync direction: Pull → Merge → Push.
 */
export async function syncProfile() {
  if (!cloud.session || !cloud.user) {
    console.log('[rakeezx sync] Not signed in, skipping sync.');
    return;
  }
  if (state.status === 'syncing') return;

  setState({ status: 'syncing', results: { ...state.results, profile: null } });
  console.log('[rakeezx sync] Started Profile sync...');

  try {
    const remote = await cloud.fetchProfile();
    const local = store.state.profile;

    const localUpdatedAt = normalizeTimestamp(local?.updatedAt);
    const remoteClientUpdatedAt = normalizeTimestamp(remote?.client_updated_at);

    let shouldPush = false;
    let shouldUpdateLocal = false;
    let merged = null;

    if (!remote) {
      if (hasMeaningfulProfile(local)) {
        console.log('[rakeezx sync] No remote profile. Local has meaningful data. Local wins.');
        shouldPush = true;
        merged = local;
      } else {
        console.log('[rakeezx sync] Both remote and local are empty/default. No-op.');
      }
    } else {
      if (!hasMeaningfulProfile(local)) {
        console.log('[rakeezx sync] Local is empty/default. Remote wins.');
        shouldUpdateLocal = true;
        merged = {
          teacherName: remote.teacher_name,
          schoolName: remote.school_name,
          phone: remote.phone,
          updatedAt: remoteClientUpdatedAt, // Keep remote's timestamp
          deleted: !!remote.deleted_at
        };
      } else if (localUpdatedAt > remoteClientUpdatedAt) {
        console.log('[rakeezx sync] Local is strictly newer. Local wins.');
        shouldPush = true;
        merged = local;
      } else if (remoteClientUpdatedAt > localUpdatedAt) {
        console.log('[rakeezx sync] Remote is strictly newer. Remote wins.');
        shouldUpdateLocal = true;
        merged = {
          teacherName: remote.teacher_name,
          schoolName: remote.school_name,
          phone: remote.phone,
          updatedAt: remoteClientUpdatedAt, // Keep remote's timestamp
          deleted: !!remote.deleted_at
        };
      } else {
        console.log('[rakeezx sync] Timestamps are exactly equal. Perfect sync, no action.');
      }
    }

    if (shouldPush && merged) {
      console.log('[rakeezx sync] Pushing to cloud...');
      const payload = {
        teacher_name: merged.teacherName || '',
        school_name: merged.schoolName || '',
        phone: merged.phone || '',
        client_updated_at: merged.updatedAt,
        device_id: getDeviceId()
      };

      if (!remote) {
        await cloud.insertProfile(payload);
      } else {
        await cloud.updateProfile(payload);
      }
    }

    if (shouldUpdateLocal && merged) {
      console.log('[rakeezx sync] Updating local store...');
      await store.patchProfile({
        teacherName: merged.teacherName,
        schoolName: merged.schoolName,
        phone: merged.phone,
        updatedAt: merged.updatedAt,
        deleted: merged.deleted
      }, { preserveTimestamp: true, queue: false });
    }

    const nowStamp = Date.now();
    await store.patchDevice({ lastSyncAt: nowStamp });
    setState({
      status: 'synced',
      lastSyncedAt: nowStamp,
      results: {
        ...state.results,
        profile: { status: 'success', time: nowStamp }
      }
    });
    console.log('[rakeezx sync] Profile sync complete.');

  } catch (err) {
    console.warn('[rakeezx sync] Profile sync failed:', err);
    setState({
      status: 'error',
      results: {
        ...state.results,
        profile: { status: 'error', error: err.message, time: Date.now() }
      }
    });
  }
}

/**
 * Maps local models to/from Supabase payload structures
 */
const MAPPERS = {
  years: {
    toCloud: (rec) => ({
      id: rec.id,
      label: rec.label,
      hijri_start: rec.hijriStart,
      hijri_end: rec.hijriEnd,
      order: rec.order,
      status: rec.status,
      deleted_at: rec.deleted ? (rec.deletedAt || new Date(rec.updatedAt).toISOString()) : null,
      client_updated_at: rec.updatedAt,
      device_id: getDeviceId()
    }),
    fromCloud: (rec) => ({
      id: rec.id,
      label: rec.label,
      hijriStart: rec.hijri_start,
      hijriEnd: rec.hijri_end,
      order: rec.order,
      status: rec.status,
      updatedAt: normalizeTimestamp(rec.client_updated_at),
      deleted: !!rec.deleted_at,
      deletedAt: rec.deleted_at || undefined
    })
  },
  calendars: {
    toCloud: (rec) => ({
      id: rec.id,
      year_id: rec.yearId,
      source: calendarSourceForCloud(rec.source),
      label: rec.label,
      deleted_at: rec.deleted ? (rec.deletedAt || new Date(rec.updatedAt).toISOString()) : null,
      client_updated_at: rec.updatedAt,
      device_id: getDeviceId()
    }),
    fromCloud: (rec) => ({
      id: rec.id,
      yearId: rec.year_id,
      source: calendarSourceFromCloud(rec),
      label: rec.label,
      updatedAt: normalizeTimestamp(rec.client_updated_at),
      deleted: !!rec.deleted_at,
      deletedAt: rec.deleted_at || undefined
    })
  },
  calendarDays: {
    toCloud: (rec) => ({
      id: rec.id,
      calendar_id: rec.calendarId,
      date: rec.date,
      kind: rec.kind,
      label: rec.label,
      deleted_at: rec.deleted ? (rec.deletedAt || new Date(rec.updatedAt).toISOString()) : null,
      client_updated_at: rec.updatedAt,
      device_id: getDeviceId()
    }),
    fromCloud: (rec) => ({
      id: rec.id,
      calendarId: rec.calendar_id,
      date: rec.date,
      kind: rec.kind,
      label: rec.label,
      updatedAt: normalizeTimestamp(rec.client_updated_at),
      deleted: !!rec.deleted_at,
      deletedAt: rec.deleted_at || undefined
    })
  },
  terms: {
    toCloud: (rec) => ({
      id: rec.id,
      year_id: rec.yearId,
      name: rec.name,
      index: rec.index,
      start_date: rec.startDate,
      end_date: rec.endDate,
      status: rec.status,
      calendar_id: rec.calendarId,
      deleted_at: rec.deleted ? (rec.deletedAt || new Date(rec.updatedAt).toISOString()) : null,
      client_updated_at: rec.updatedAt,
      device_id: getDeviceId()
    }),
    fromCloud: (rec) => ({
      id: rec.id,
      yearId: rec.year_id,
      name: rec.name,
      index: rec.index,
      startDate: rec.start_date,
      endDate: rec.end_date,
      status: rec.status,
      calendarId: rec.calendar_id,
      updatedAt: normalizeTimestamp(rec.client_updated_at),
      deleted: !!rec.deleted_at,
      deletedAt: rec.deleted_at || undefined
    })
  },
  subjects: {
    toCloud: (rec) => ({
      id: rec.id,
      name: rec.name,
      slug: rec.slug,
      deleted_at: rec.deleted ? (rec.deletedAt || new Date(rec.updatedAt).toISOString()) : null,
      client_updated_at: rec.updatedAt,
      device_id: getDeviceId()
    }),
    fromCloud: (rec) => ({
      id: rec.id,
      name: rec.name,
      slug: rec.slug,
      updatedAt: normalizeTimestamp(rec.client_updated_at),
      deleted: !!rec.deleted_at,
      deletedAt: rec.deleted_at || undefined
    })
  },
  sections: {
    toCloud: (rec) => ({
      id: rec.id,
      year_id: rec.yearId,
      grade: rec.grade,
      label: rec.label,
      name: rec.name,
      color: rec.color,
      order: rec.order,
      deleted_at: rec.deleted ? (rec.deletedAt || new Date(rec.updatedAt).toISOString()) : null,
      client_updated_at: rec.updatedAt,
      device_id: getDeviceId()
    }),
    fromCloud: (rec) => ({
      id: rec.id,
      yearId: rec.year_id,
      grade: rec.grade,
      label: rec.label,
      name: rec.name,
      color: rec.color,
      order: rec.order,
      updatedAt: normalizeTimestamp(rec.client_updated_at),
      deleted: !!rec.deleted_at,
      deletedAt: rec.deleted_at || undefined
    })
  },
  teachings: {
    toCloud: (rec) => ({
      id: rec.id,
      section_id: rec.sectionId,
      subject_id: rec.subjectId,
      term_id: rec.termId,
      order: rec.order,
      deleted_at: rec.deleted ? (rec.deletedAt || new Date(rec.updatedAt).toISOString()) : null,
      client_updated_at: rec.updatedAt,
      device_id: getDeviceId()
    }),
    fromCloud: (rec) => ({
      id: rec.id,
      sectionId: rec.section_id,
      subjectId: rec.subject_id,
      termId: rec.term_id,
      order: rec.order,
      updatedAt: normalizeTimestamp(rec.client_updated_at),
      deleted: !!rec.deleted_at,
      deletedAt: rec.deleted_at || undefined
    })
  },
  students: {
    toCloud: (rec) => ({
      id: rec.id,
      name: rec.name,
      note: rec.note,
      status: rec.status,
      deleted_at: rec.deleted ? (rec.deletedAt || new Date(rec.updatedAt).toISOString()) : null,
      client_updated_at: rec.updatedAt,
      device_id: getDeviceId()
    }),
    fromCloud: (rec) => ({
      id: rec.id,
      name: rec.name,
      note: rec.note,
      status: rec.status,
      updatedAt: normalizeTimestamp(rec.client_updated_at),
      deleted: !!rec.deleted_at,
      deletedAt: rec.deleted_at || undefined
    })
  },
  enrollments: {
    toCloud: (rec) => ({
      id: rec.id,
      student_id: rec.studentId,
      section_id: rec.sectionId,
      roll_no: rec.rollNo,
      start_date: rec.startDate,
      end_date: rec.endDate,
      status: rec.status,
      transfer_note: rec.transferNote,
      deleted_at: rec.deleted ? (rec.deletedAt || new Date(rec.updatedAt).toISOString()) : null,
      client_updated_at: rec.updatedAt,
      device_id: getDeviceId()
    }),
    fromCloud: (rec) => ({
      id: rec.id,
      studentId: rec.student_id,
      sectionId: rec.section_id,
      rollNo: rec.roll_no,
      startDate: rec.start_date,
      endDate: rec.end_date,
      status: rec.status,
      transferNote: rec.transfer_note,
      updatedAt: normalizeTimestamp(rec.client_updated_at),
      deleted: !!rec.deleted_at,
      deletedAt: rec.deleted_at || undefined
    })
  },
  items: {
    toCloud: (rec) => ({
      id: rec.id,
      teaching_id: rec.teachingId,
      name: rec.name,
      max: rec.max,
      order: rec.order,
      auto: rec.auto,
      per_point: rec.perPoint,
      penalty: rec.penalty,
      unit_id: rec.unitId,
      lesson_id: rec.lessonId,
      deleted_at: rec.deleted ? (rec.deletedAt || new Date(rec.updatedAt).toISOString()) : null,
      client_updated_at: rec.updatedAt,
      device_id: getDeviceId()
    }),
    fromCloud: (rec) => ({
      id: rec.id,
      teachingId: rec.teaching_id,
      name: rec.name,
      max: rec.max,
      order: rec.order,
      auto: rec.auto,
      perPoint: rec.per_point,
      penalty: rec.penalty,
      unitId: rec.unit_id,
      lessonId: rec.lesson_id,
      updatedAt: normalizeTimestamp(rec.client_updated_at),
      deleted: !!rec.deleted_at,
      deletedAt: rec.deleted_at || undefined
    })
  },
  logs: {
    toCloud: (rec) => ({ id:rec.id, student_id:rec.studentId, teaching_id:rec.teachingId, session_id:rec.sessionId || null, date:rec.date, kind:rec.kind, delta:rec.delta, tag:rec.tag || '', note:rec.note || '', deleted_at:rec.deleted ? (rec.deletedAt || new Date(rec.updatedAt).toISOString()) : null, client_updated_at:rec.updatedAt, device_id:getDeviceId() }),
    fromCloud: (rec) => ({ id:rec.id, studentId:rec.student_id, teachingId:rec.teaching_id, sessionId:rec.session_id || null, date:rec.date, kind:rec.kind, delta:rec.delta, tag:rec.tag || '', note:rec.note || '', updatedAt:normalizeTimestamp(rec.client_updated_at), deleted:!!rec.deleted_at, deletedAt:rec.deleted_at || undefined })
  },
  scores: {
    toCloud: (rec) => ({
      id: rec.id,
      student_id: rec.studentId,
      item_id: rec.itemId,
      value: rec.value,
      deleted_at: rec.deleted ? (rec.deletedAt || new Date(rec.updatedAt).toISOString()) : null,
      client_updated_at: rec.updatedAt,
      device_id: getDeviceId()
    }),
    fromCloud: (rec) => ({
      id: rec.id,
      studentId: rec.student_id,
      itemId: rec.item_id,
      value: rec.value,
      updatedAt: normalizeTimestamp(rec.client_updated_at),
      deleted: !!rec.deleted_at,
      deletedAt: rec.deleted_at || undefined
    })
  },
  timeProfiles: {
    toCloud: (rec) => ({
      id: rec.id,
      name: rec.name,
      order: rec.order,
      periods: rec.periods,
      overrides: rec.overrides,
      active_from: rec.activeFrom,
      active_to: rec.activeTo,
      deleted_at: rec.deleted ? (rec.deletedAt || new Date(rec.updatedAt).toISOString()) : null,
      client_updated_at: rec.updatedAt,
      device_id: getDeviceId()
    }),
    fromCloud: (rec) => ({
      id: rec.id,
      name: rec.name,
      order: rec.order,
      periods: rec.periods,
      overrides: rec.overrides,
      activeFrom: rec.active_from,
      activeTo: rec.active_to,
      updatedAt: normalizeTimestamp(rec.client_updated_at),
      deleted: !!rec.deleted_at,
      deletedAt: rec.deleted_at || undefined
    })
  },
  slots: {
    toCloud: (rec) => ({
      id: rec.id,
      teaching_id: rec.teachingId,
      weekday: rec.weekday,
      period: rec.period,
      deleted_at: rec.deleted ? (rec.deletedAt || new Date(rec.updatedAt).toISOString()) : null,
      client_updated_at: rec.updatedAt,
      device_id: getDeviceId()
    }),
    fromCloud: (rec) => ({
      id: rec.id,
      teachingId: rec.teaching_id,
      weekday: rec.weekday,
      period: rec.period,
      updatedAt: normalizeTimestamp(rec.client_updated_at),
      deleted: !!rec.deleted_at,
      deletedAt: rec.deleted_at || undefined
    })
  },
  sessions: {
    toCloud: (rec) => ({
      id: rec.id,
      teaching_id: rec.teachingId,
      date: rec.date,
      period: rec.period,
      slot_id: rec.slotId,
      start_time: rec.startTime || null,
      end_time: rec.endTime || null,
      time_profile_id: rec.timeProfileId,
      status: rec.status,
      reason: rec.reason,
      makeup_for_id: rec.makeupForId,
      lesson_id: rec.lessonId,
      note: rec.note,
      homework: rec.homework,
      covered: rec.covered,
      deleted_at: rec.deleted ? (rec.deletedAt || new Date(rec.updatedAt).toISOString()) : null,
      client_updated_at: rec.updatedAt,
      device_id: getDeviceId()
    }),
    fromCloud: (rec) => ({
      id: rec.id,
      teachingId: rec.teaching_id,
      date: rec.date,
      period: rec.period,
      slotId: rec.slot_id,
      startTime: rec.start_time || '',
      endTime: rec.end_time || '',
      timeProfileId: rec.time_profile_id,
      status: rec.status,
      reason: rec.reason,
      makeupForId: rec.makeup_for_id,
      lessonId: rec.lesson_id,
      note: rec.note,
      homework: rec.homework,
      covered: rec.covered,
      updatedAt: normalizeTimestamp(rec.client_updated_at),
      deleted: !!rec.deleted_at,
      deletedAt: rec.deleted_at || undefined
    })
  },
  notes: {
    toCloud: (rec) => ({
      id: rec.id,
      student_id: rec.studentId,
      teaching_id: rec.teachingId || null,
      session_id: rec.sessionId || null,
      date: rec.date,
      kind: rec.kind || 'general',
      text: rec.text,
      created_at: new Date(rec.createdAt ?? rec.updatedAt).toISOString(),
      deleted_at: rec.deleted ? (rec.deletedAt || new Date(rec.updatedAt).toISOString()) : null,
      client_updated_at: rec.updatedAt,
      device_id: getDeviceId()
    }),
    fromCloud: (rec) => ({
      id: rec.id,
      studentId: rec.student_id,
      teachingId: rec.teaching_id || null,
      sessionId: rec.session_id || null,
      date: rec.date,
      kind: rec.kind || 'general',
      text: rec.text,
      createdAt: normalizeTimestamp(rec.created_at || rec.client_updated_at),
      updatedAt: normalizeTimestamp(rec.client_updated_at),
      deleted: !!rec.deleted_at,
      deletedAt: rec.deleted_at || undefined
    })
  },
  attendance: {
    toCloud: (rec) => ({
      id: rec.id,
      student_id: rec.studentId,
      session_id: rec.sessionId,
      teaching_id: rec.teachingId,
      date: rec.date,
      status: rec.status,
      note: rec.note,
      deleted_at: rec.deleted ? (rec.deletedAt || new Date(rec.updatedAt).toISOString()) : null,
      client_updated_at: rec.updatedAt,
      device_id: getDeviceId()
    }),
    fromCloud: (rec) => ({
      id: rec.id,
      studentId: rec.student_id,
      sessionId: rec.session_id,
      teachingId: rec.teaching_id,
      date: rec.date,
      status: rec.status,
      note: rec.note,
      updatedAt: normalizeTimestamp(rec.client_updated_at),
      deleted: !!rec.deleted_at,
      deletedAt: rec.deleted_at || undefined
    })
  }
};

/**
 * Checks if a structural record is an unmodified, auto-generated boot default.
 */
function isMeaningfulStructural(storeName, rec) {
  if (storeName === 'years') {
    return !(rec.hijriStart === 1448 && rec.label === '1448-1449' && rec.status === 'active');
  }
  if (storeName === 'terms') {
    const isDefaultName = rec.name === `الفصل الدراسي ${['', 'الأول', 'الثاني', 'الثالث'][rec.index] ?? rec.index}`;
    return !(isDefaultName && !rec.startDate && !rec.endDate && (rec.status === 'active' || rec.status === 'upcoming'));
  }
  if (storeName === 'subjects') {
    return !(rec.name === 'المهارات الرقمية' && rec.slug === 'digital-skills');
  }
  if (storeName === 'timeProfiles') {
    return !DEFAULT_TIME_PROFILES.some(p => p.name === rec.name);
  }
  return true; // sections do not have auto-generated defaults
}

/**
 * Scans local structural data to find parent records (like default years)
 * that must be pushed because user-created children depend on them.
 */
function buildLocalDependencies(state) {
  const req = { years: new Set(), calendars: new Set(), calendarDays: new Set(), terms: new Set(), subjects: new Set(), sections: new Set(), teachings: new Set(), timeProfiles: new Set(), slots: new Set() };

  for (const sec of state.sections || []) {
    if (sec.yearId && isMeaningfulStructural('sections', sec)) {
      req.years.add(sec.yearId);
    }
  }
  for (const calendar of state.calendars || []) {
    if (calendar.yearId && isMeaningfulStructural('calendars', calendar)) {
      req.years.add(calendar.yearId);
    }
  }
  for (const term of state.terms || []) {
    if (term.yearId && isMeaningfulStructural('terms', term)) {
      req.years.add(term.yearId);
    }
    if (term.calendarId && isMeaningfulStructural('terms', term)) {
      req.calendars.add(term.calendarId);
    }
  }
  for (const day of state.calendarDays || []) {
    if (day.calendarId && isMeaningfulStructural('calendarDays', day)) {
      req.calendars.add(day.calendarId);
    }
  }
  for (const tch of state.teachings || []) {
    if (!tch.deleted) {
      if (tch.sectionId) req.sections.add(tch.sectionId);
      if (tch.subjectId) req.subjects.add(tch.subjectId);
      if (tch.termId) req.terms.add(tch.termId);
    }
  }
  for (const sl of state.slots || []) {
    if (!sl.deleted) {
      if (sl.teachingId) req.teachings.add(sl.teachingId);
      if (sl.timeProfileId) req.timeProfiles.add(sl.timeProfileId);
    }
  }
  for (const ses of state.sessions || []) {
    if (!ses.deleted) {
      if (ses.teachingId) req.teachings.add(ses.teachingId);
      if (ses.slotId) req.slots.add(ses.slotId);
      if (ses.timeProfileId) req.timeProfiles.add(ses.timeProfileId);
    }
  }
  for (const att of state.attendance || []) {
    if (!att.deleted) {
      if (att.teachingId) req.teachings.add(att.teachingId);
    }
  }

  return req;
}

/**
 * Generic sync engine for a single collection.
 * Pull → Merge → Push
 */
async function syncCollection(storeName, tableName, context = { requiredIds: new Set(), knownRemoteIds: {} }) {
  const mapper = MAPPERS[storeName];
  if (!mapper) throw new Error(`No mapper for ${storeName}`);

  const remoteRecords = (await cloud.fetchRecords(tableName)).filter((record) => !store.isLocalOnlyRecord(record));
  const localRecords = (store.state[storeName] || []).filter((record) => !store.isLocalOnlyRecord(record));

  const remoteById = new Map(remoteRecords.map(r => [r.id, r]));
  const localById = new Map(localRecords.map(r => [r.id, r]));

  const allIds = new Set([...remoteById.keys(), ...localById.keys()]);

  const toPush = [];
  const toUpdateLocal = [];

  for (const id of allIds) {
    const remote = remoteById.get(id);
    const local = localById.get(id);

    if (!remote) {
      // Remote does not exist.
      // We push if the local record is meaningful OR if it is explicitly required by a child.
      if (isMeaningfulStructural(storeName, local) || context.requiredIds.has(local.id)) {
        toPush.push(mapper.toCloud(local));
      }
    } else if (!local) {
      // Local does not exist, so it was created on another device.
      // We pull it down.
      toUpdateLocal.push(mapper.fromCloud(remote));
    } else {
      // Both exist. Compare timestamps.
      const remoteClientUpdatedAt = normalizeTimestamp(remote.client_updated_at);
      const localUpdatedAt = normalizeTimestamp(local.updatedAt);
      const isStructural = storeName === 'years' || storeName === 'terms' || storeName === 'subjects';

      if (localUpdatedAt === remoteClientUpdatedAt) {
        // Converged, do nothing.
      } else if (isStructural && !isMeaningfulStructural(storeName, local) && localUpdatedAt > remoteClientUpdatedAt) {
        // Local is a generated default, and remote already has this exact ID.
        // Even though local is strictly newer (due to being freshly generated),
        // remote must be authoritative for this sync cycle. Hydrate local.
        toUpdateLocal.push(mapper.fromCloud(remote));
      } else if (localUpdatedAt > remoteClientUpdatedAt) {
        // Local is strictly newer.
        toPush.push(mapper.toCloud(local));
      } else if (remoteClientUpdatedAt > localUpdatedAt) {
        // Remote is strictly newer.
        toUpdateLocal.push(mapper.fromCloud(remote));
      }
    }
  }

  // -- RECONCILIATION OF FRESH-DEVICE DEFAULTS --
  // For years, terms, subjects: if a local record is an unmodified auto-generated default,
  // we check if a logically equivalent record exists remotely. If yes, we adopt the remote ID
  // locally to prevent duplicates and scoping bugs on fresh devices.
  const remappedLocals = new Map(); // oldId -> newId

  // Deterministically sort remote records to always pick the oldest (original) default if duplicates exist
  const sortedRemotes = [...remoteRecords].sort((a, b) => {
    const timeA = new Date(a.created_at || a.client_updated_at).getTime();
    const timeB = new Date(b.created_at || b.client_updated_at).getTime();
    return timeA - timeB;
  });

  if (storeName === 'years') {
    for (const local of localRecords) {
      if (!isMeaningfulStructural('years', local)) {
        const equiv = sortedRemotes.find(r => r.hijri_start === local.hijriStart);
        if (equiv && equiv.id !== local.id) remappedLocals.set(local.id, equiv.id);
      }
    }
  } else if (storeName === 'terms') {
    for (const local of localRecords) {
      if (!isMeaningfulStructural('terms', local)) {
        const equiv = sortedRemotes.find(r => r.year_id === local.yearId && r.index === local.index);
        if (equiv && equiv.id !== local.id) remappedLocals.set(local.id, equiv.id);
      }
    }
  } else if (storeName === 'subjects') {
    for (const local of localRecords) {
      if (!isMeaningfulStructural('subjects', local)) {
        const equiv = sortedRemotes.find(r => r.slug === local.slug);
        if (equiv && equiv.id !== local.id) remappedLocals.set(local.id, equiv.id);
      }
    }
  } else if (storeName === 'timeProfiles') {
    for (const local of localRecords) {
      if (!isMeaningfulStructural('timeProfiles', local)) {
        const equiv = sortedRemotes.find(r => r.name === local.name);
        if (equiv && equiv.id !== local.id) remappedLocals.set(local.id, equiv.id);
      }
    }
  }

  if (remappedLocals.size > 0) {
    console.log(`[rakeezx sync] Remapping ${storeName} identities:`, remappedLocals);

    // Centralized Reference-Remap Helper to guarantee full coverage without partial hardcoding
    const buildCascadePatch = (oldId, newId, entityType) => {
      const p = {};
      const updateStore = (sName, fkField) => {
        for (const rec of store.state[sName] || []) {
          if (rec[fkField] === oldId) {
            p[sName] ??= [];
            p[sName].push({ ...rec, [fkField]: newId });
          }
        }
      };

      if (entityType === 'years') {
        if (store.state.device?.activeYearId === oldId) p.device = { ...store.state.device, activeYearId: newId };
        updateStore('terms', 'yearId');
        updateStore('sections', 'yearId');
        updateStore('calendars', 'yearId');
      } else if (entityType === 'terms') {
        if (store.state.device?.activeTermId === oldId) p.device = { ...store.state.device, activeTermId: newId };
        updateStore('teachings', 'termId');
      } else if (entityType === 'subjects') {
        updateStore('teachings', 'subjectId');
        updateStore('units', 'subjectId');
      } else if (entityType === 'sections') {
        // Provided for completeness, though sections are not currently reconciled
        updateStore('teachings', 'sectionId');
        updateStore('enrollments', 'sectionId');
      } else if (entityType === 'timeProfiles') {
        if (store.state.device?.activeTimeProfileId === oldId) p.device = { ...store.state.device, activeTimeProfileId: newId };
        updateStore('sessions', 'timeProfileId');
      }
      return p;
    };

    const patch = { [storeName]: [] };
    const devicePatch = {};

    // 1. Rewrite local identities in memory arrays/maps and hydrate from remote
    for (const [oldId, newId] of remappedLocals.entries()) {
      const lRec = localById.get(oldId);
      const remoteEquiv = remoteRecords.find(r => r.id === newId);

      // Hydrate local record with remote canonical values
      const hydrated = {
        ...lRec,
        ...mapper.fromCloud(remoteEquiv),
        id: newId
      };

      localById.delete(oldId);
      localById.set(newId, hydrated);
      allIds.delete(oldId);
      allIds.add(newId);

      // 2. Cascade changes to dependent local state
      const cascade = buildCascadePatch(oldId, newId, storeName);
      if (cascade.device) Object.assign(devicePatch, cascade.device);
      for (const sName of Object.keys(cascade)) {
        if (sName === 'device') continue;
        patch[sName] ??= [];
        for (const mod of cascade[sName]) {
          const idx = patch[sName].findIndex(r => r.id === mod.id);
          if (idx !== -1) patch[sName][idx] = { ...patch[sName][idx], ...mod };
          else patch[sName].push(mod);
        }
      }

      // Mark the old local identity as deleted without discarding its model.
      // fields. IndexedDB put replaces a record, so an id-only tombstone
      // would persist a malformed time profile (including no name) and can
      // later be retried as an invalid cloud payload after a reload.
      patch[storeName].push({ ...lRec, id: oldId, deleted: true, deletedAt: new Date().toISOString(), updatedAt: Date.now() });
      patch[storeName].push(hydrated);

      // Prevent it from being pushed under the old ID if it somehow got queued
      const pushIdx = toPush.findIndex(p => p.id === oldId);
      if (pushIdx !== -1) toPush.splice(pushIdx, 1);

      // Since we just adopted the remote record's exact timestamp and identity,
      // we must NOT push it back as a local edit. It is fully converged.
      // Remove it from any toPush that might have queued it under newId.
      const newPushIdx = toPush.findIndex(p => p.id === newId);
      if (newPushIdx !== -1) toPush.splice(newPushIdx, 1);
    }

      if (Object.keys(devicePatch).length > 0) {
        const ok = await store.patchDevice({ ...store.state.device, ...devicePatch });
        if (!ok) throw new Error(`${storeName} defaults: device persistence failed`);
      }
      const ok2 = await store.save(patch, { queue: false });
      if (!ok2) throw new Error(`${storeName} defaults: local persistence failed`);
  }

  // Dependency validation before push
  if (storeName === 'calendars' || storeName === 'terms' || storeName === 'sections') {
    for (const p of toPush) {
      if (p.year_id && !context.knownRemoteIds?.years?.has(p.year_id)) {
        throw new Error(`${storeName}: missing remote year ${p.year_id}`);
      }
      if (storeName === 'terms' && p.calendar_id && !context.knownRemoteIds?.calendars?.has(p.calendar_id)) {
        throw new Error(`terms: missing remote calendar ${p.calendar_id}`);
      }
    }
  }
  if (storeName === 'calendarDays') {
    for (const p of toPush) {
      if (p.calendar_id && !context.knownRemoteIds?.calendars?.has(p.calendar_id)) {
        throw new Error(`calendarDays: missing remote calendar ${p.calendar_id}`);
      }
    }
  }
  if (storeName === 'teachings') {
    for (const p of toPush) {
      if (p.section_id && !context.knownRemoteIds?.sections?.has(p.section_id)) {
        throw new Error(`${storeName}: missing remote section ${p.section_id}`);
      }
      if (p.subject_id && !context.knownRemoteIds?.subjects?.has(p.subject_id)) {
        throw new Error(`${storeName}: missing remote subject ${p.subject_id}`);
      }
      if (p.term_id && !context.knownRemoteIds?.terms?.has(p.term_id)) {
        throw new Error(`${storeName}: missing remote term ${p.term_id}`);
      }
    }
  }

  if (storeName === 'enrollments') {
    for (const p of toPush) {
      if (p.student_id && !context.knownRemoteIds?.students?.has(p.student_id)) {
        throw new Error(`${storeName}: missing remote student ${p.student_id}`);
      }
      if (p.section_id && !context.knownRemoteIds?.sections?.has(p.section_id)) {
        throw new Error(`${storeName}: missing remote section ${p.section_id}`);
      }
    }
  }

  if (storeName === 'items') {
    for (const p of toPush) {
      if (p.teaching_id && !context.knownRemoteIds?.teachings?.has(p.teaching_id)) {
        throw new Error(`${storeName}: missing remote teaching ${p.teaching_id}`);
      }
    }
  }

  if (storeName === 'scores') {
    for (const p of toPush) {
      if (p.student_id && !context.knownRemoteIds?.students?.has(p.student_id)) {
        throw new Error(`${storeName}: missing remote student ${p.student_id}`);
      }
      if (p.item_id && !context.knownRemoteIds?.items?.has(p.item_id)) {
        throw new Error(`${storeName}: missing remote item ${p.item_id}`);
      }
    }
  }

  if (storeName === 'slots') {
    for (const p of toPush) {
      if (p.teaching_id && !context.knownRemoteIds?.teachings?.has(p.teaching_id)) {
        throw new Error(`${storeName}: missing remote teaching ${p.teaching_id}`);
      }
    }
  }

  if (storeName === 'sessions') {
    for (const p of toPush) {
      if (p.teaching_id && !context.knownRemoteIds?.teachings?.has(p.teaching_id)) {
        throw new Error(`${storeName}: missing remote teaching ${p.teaching_id}`);
      }
      if (p.slot_id && !context.knownRemoteIds?.slots?.has(p.slot_id)) {
        throw new Error(`${storeName}: missing remote slot ${p.slot_id}`);
      }
      if (p.time_profile_id && !context.knownRemoteIds?.timeProfiles?.has(p.time_profile_id)) {
        throw new Error(`${storeName}: missing remote timeProfile ${p.time_profile_id}`);
      }
    }

    const toPushMap = new Map(toPush.map(p => [p.id, p]));
    const sorted = [];
    const visited = new Set();
    const visiting = new Set();

    function visit(p) {
      if (visited.has(p.id)) return;
      if (visiting.has(p.id)) {
        throw new Error(`sessions: cycle detected in makeup_for_id dependency for ${p.id}`);
      }
      visiting.add(p.id);

      if (p.makeup_for_id && !remoteById.has(p.makeup_for_id)) {
        const parent = toPushMap.get(p.makeup_for_id);
        if (!parent) {
          throw new Error(`sessions: missing makeup parent ${p.makeup_for_id}`);
        }
        visit(parent);
      }

      visiting.delete(p.id);
      visited.add(p.id);
      sorted.push(p);
    }

    // Base sort for stable ordering before dependency resolution
    toPush.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.period - b.period));

    for (const p of toPush) {
      visit(p);
    }

    toPush.length = 0;
    toPush.push(...sorted);
  }

  if (storeName === 'notes') {
    for (const p of toPush) {
      if (p.student_id && !context.knownRemoteIds?.students?.has(p.student_id)) {
        throw new Error(`${storeName}: missing remote student ${p.student_id}`);
      }
      if (p.teaching_id && !context.knownRemoteIds?.teachings?.has(p.teaching_id)) {
        throw new Error(`${storeName}: missing remote teaching ${p.teaching_id}`);
      }
      if (p.session_id && !context.knownRemoteIds?.sessions?.has(p.session_id)) {
        throw new Error(`${storeName}: missing remote session ${p.session_id}`);
      }
    }
  }

  if (storeName === 'logs') {
    for (const p of toPush) {
      if (p.student_id && !context.knownRemoteIds?.students?.has(p.student_id)) throw new Error(String(storeName) + ': missing remote student ' + p.student_id);
      if (p.teaching_id && !context.knownRemoteIds?.teachings?.has(p.teaching_id)) throw new Error(String(storeName) + ': missing remote teaching ' + p.teaching_id);
      if (p.session_id && !context.knownRemoteIds?.sessions?.has(p.session_id)) throw new Error(String(storeName) + ': missing remote session ' + p.session_id);
    }
  }

  if (storeName === 'attendance') {
    for (const p of toPush) {
      if (p.student_id && !context.knownRemoteIds?.students?.has(p.student_id)) {
        throw new Error(`${storeName}: missing remote student ${p.student_id}`);
      }
      if (p.session_id && !context.knownRemoteIds?.sessions?.has(p.session_id)) {
        throw new Error(`${storeName}: missing remote session ${p.session_id}`);
      }
      if (p.teaching_id && !context.knownRemoteIds?.teachings?.has(p.teaching_id)) {
        throw new Error(`${storeName}: missing remote teaching ${p.teaching_id}`);
      }
    }
  }

  if (toPush.length > 0) {
    await cloud.upsertRecords(tableName, toPush);
  }

  if (toUpdateLocal.length > 0) {
    const ok = await store.save({ [storeName]: toUpdateLocal }, { queue: false });
    if (!ok) throw new Error(`${storeName}: local persistence failed`);
  }

  if (remappedLocals.size > 0) {
    const buildCascadePatch = (oldId, newId, entityType) => {
      const p = {};
      const updateStore = (sName, fkField) => {
        for (const rec of store.state[sName] || []) {
          if (rec[fkField] === oldId) {
            p[sName] ??= [];
            p[sName].push({ ...rec, [fkField]: newId });
          }
        }
      };

      if (entityType === 'years') {
        if (store.state.device?.activeYearId === oldId) p.device = [{ ...store.state.device, activeYearId: newId }];
        updateStore('terms', 'yearId');
        updateStore('sections', 'yearId');
        updateStore('calendars', 'yearId');
      } else if (entityType === 'terms') {
        if (store.state.device?.activeTermId === oldId) p.device = [{ ...store.state.device, activeTermId: newId }];
        updateStore('teachings', 'termId');
      } else if (entityType === 'subjects') {
        updateStore('teachings', 'subjectId');
        updateStore('units', 'subjectId');
      } else if (entityType === 'sections') {
        updateStore('teachings', 'sectionId');
        updateStore('enrollments', 'sectionId');
      } else if (entityType === 'timeProfiles') {
        if (store.state.device?.activeTimeProfileId === oldId) p.device = [{ ...store.state.device, activeTimeProfileId: newId }];
        updateStore('sessions', 'timeProfileId');
      }
      return p;
    };

    for (const [oldId, newId] of remappedLocals) {
      const patch = buildCascadePatch(oldId, newId, storeName);
      if (Object.keys(patch).length > 0) {
        const ok = await store.save(patch, { queue: false });
        if (!ok) throw new Error(`${storeName} cascade: local persistence failed`);
      }
    }
  }

  const known = new Set(remoteById.keys());
  for (const p of toPush) known.add(p.id);

  return { pushed: toPush.length, pulled: toUpdateLocal.length, known };
}

/**
 * Phase 5B: Sync structural academic data.
 */
export async function syncStructural() {
  if (!cloud.session || !cloud.user) {
    console.log('[rakeezx sync] Not signed in, skipping structural sync.');
    return;
  }
  if (state.status === 'syncing') return;

  setState({ status: 'syncing', results: { ...state.results, structural: null } });
  console.log('[rakeezx sync] Started structural sync...');

  try {
    const requiredByChildren = buildLocalDependencies(store.state);
    const knownRemoteIds = {};
    const stats = {};
    const order = [
      { store: 'years', table: 'years' },
      { store: 'calendars', table: 'calendars' },
      { store: 'calendarDays', table: 'calendar_days' },
      { store: 'terms', table: 'terms' },
      { store: 'subjects', table: 'subjects' },
      { store: 'sections', table: 'sections' },
      { store: 'teachings', table: 'teachings' }
    ];

    for (const { store: sName, table: tName } of order) {
      const context = {
        requiredIds: requiredByChildren[sName] || new Set(),
        knownRemoteIds
      };
      const res = await syncCollection(sName, tName, context);
      knownRemoteIds[sName] = res.known;
      stats[sName] = { pushed: res.pushed, pulled: res.pulled };
    }

    const nowStamp = Date.now();
    await store.patchDevice({ lastSyncAt: nowStamp });
    setState({
      status: 'synced',
      lastSyncedAt: nowStamp,
      results: {
        ...state.results,
        structural: { status: 'success', stats, time: nowStamp }
      }
    });
    console.log('[rakeezx sync] Structural sync complete.', stats);
    return stats;

  } catch (err) {
    console.warn('[rakeezx sync] Structural sync failed:', err);
    setState({
      status: 'error',
      results: {
        ...state.results,
        structural: { status: 'error', error: err.message, time: Date.now() }
      }
    });
  }
}

/**
 * Phase 5C: Sync Students and Enrollments.
 * Dependency-aware execution: structural sync runs first.
 */
export async function syncStudents() {
  if (!cloud.session || !cloud.user) {
    console.log('[rakeezx sync] Not signed in, skipping students sync.');
    return;
  }
  if (state.status === 'syncing') return;

  console.log('[rakeezx sync] Enforcing structural sync before students...');
  await syncStructural();

  if (state.results.structural?.status === 'error') {
    console.warn('[rakeezx sync] Structural sync failed, aborting students sync.');
    setState({
      status: 'error',
      results: {
        ...state.results,
        students: { status: 'error', error: 'فشلت المزامنة الهيكلية: ' + state.results.structural.error, time: Date.now() }
      }
    });
    return;
  }

  setState({ status: 'syncing', results: { ...state.results, students: null } });
  console.log('[rakeezx sync] Started students sync...');

  try {
    const knownRemoteIds = {};
    const stats = {};

    // First, fetch remote sections to validate enrollment foreign keys.
    const remoteSections = await cloud.fetchRecords('sections');
    knownRemoteIds.sections = new Set(remoteSections.map(r => r.id));

    // 1. Students
    const resStudents = await syncCollection('students', 'students', { requiredIds: new Set(), knownRemoteIds });
    knownRemoteIds.students = resStudents.known;
    stats.students = { pushed: resStudents.pushed, pulled: resStudents.pulled };

    // 2. Enrollments
    const resEnrollments = await syncCollection('enrollments', 'enrollments', { requiredIds: new Set(), knownRemoteIds });
    stats.enrollments = { pushed: resEnrollments.pushed, pulled: resEnrollments.pulled };

    const nowStamp = Date.now();
    await store.patchDevice({ lastSyncAt: nowStamp });
    setState({
      status: 'synced',
      lastSyncedAt: nowStamp,
      results: {
        ...state.results,
        students: { status: 'success', stats, time: nowStamp }
      }
    });
    console.log('[rakeezx sync] Students sync complete.', stats);

  } catch (err) {
    console.warn('[rakeezx sync] Students sync failed:', err);
    setState({
      status: 'error',
      results: {
        ...state.results,
        students: { status: 'error', error: err.message, time: Date.now() }
      }
    });
  }
}

/** يزامن سجل ملاحظات الطلاب بعد ضمان وصول الطالب وسياق الحصة إن وُجد. */
export async function syncNotes() {
  if (!cloud.session || !cloud.user) {
    console.log('[rakeezx sync] Not signed in, skipping notes sync.');
    return;
  }
  if (state.status === 'syncing') return;

  await syncStudents();
  if (state.results.students?.status === 'error') {
    setState({ status: 'error', results: { ...state.results, notes: { status: 'error', error: 'فشلت مزامنة الطلاب: ' + state.results.students.error, time: Date.now() } } });
    return;
  }
  await store.migrateLegacyStudentNotes();

  setState({ status: 'syncing', results: { ...state.results, notes: null } });
  try {
    const knownRemoteIds = {};
    const [remoteStudents, remoteTeachings, remoteSessions] = await Promise.all([
      cloud.fetchRecords('students'), cloud.fetchRecords('teachings'), cloud.fetchRecords('sessions'),
    ]);
    knownRemoteIds.students = new Set(remoteStudents.map((record) => record.id));
    knownRemoteIds.teachings = new Set(remoteTeachings.map((record) => record.id));
    knownRemoteIds.sessions = new Set(remoteSessions.map((record) => record.id));
    const res = await syncCollection('notes', 'notes', { requiredIds: new Set(), knownRemoteIds });
    const nowStamp = Date.now();
    await store.patchDevice({ lastSyncAt: nowStamp });
    setState({ status: 'synced', lastSyncedAt: nowStamp, results: { ...state.results, notes: { status: 'success', stats: { notes: { pushed: res.pushed, pulled: res.pulled } }, time: nowStamp } } });
    console.log('[rakeezx sync] Notes sync complete.', res);
  } catch (err) {
    console.warn('[rakeezx sync] Notes sync failed:', err);
    setState({ status: 'error', results: { ...state.results, notes: { status: 'error', error: err.message, time: Date.now() } } });
  }
}

export async function syncScoring() {
  if (!cloud.session || !cloud.user) {
    console.log('[rakeezx sync] Not signed in, skipping scoring sync.');
    return;
  }
  if (state.status === 'syncing') return;

  console.log('[rakeezx sync] Enforcing structural sync before scoring...');
  await syncStructural();

  if (state.results.structural?.status === 'error') {
    console.warn('[rakeezx sync] Structural sync failed, aborting scoring sync.');
    setState({
      status: 'error',
      results: {
        ...state.results,
        scoring: { status: 'error', error: 'فشلت المزامنة الهيكلية: ' + state.results.structural.error, time: Date.now() }
      }
    });
    return;
  }

  setState({ status: 'syncing', results: { ...state.results, scoring: null } });
  console.log('[rakeezx sync] Started scoring sync...');

  try {
    const knownRemoteIds = {};
    const stats = {};

    // First, fetch remote teachings and students to validate foreign keys.
    const remoteTeachings = await cloud.fetchRecords('teachings');
    knownRemoteIds.teachings = new Set(remoteTeachings.map(r => r.id));

    const remoteStudents = await cloud.fetchRecords('students');
    knownRemoteIds.students = new Set(remoteStudents.map(r => r.id));

    // 1. items
    const resItems = await syncCollection('items', 'items', { requiredIds: new Set(), knownRemoteIds });
    knownRemoteIds.items = resItems.known;
    stats.items = { pushed: resItems.pushed, pulled: resItems.pulled };

    // 2. scores
    const resScores = await syncCollection('scores', 'scores', { requiredIds: new Set(), knownRemoteIds });
    knownRemoteIds.scores = resScores.known;
    stats.scores = { pushed: resScores.pushed, pulled: resScores.pulled };

    // 3. Quick Log events depend on existing students, teachings, and optional sessions.
    const remoteSessions = await cloud.fetchRecords('sessions');
    knownRemoteIds.sessions = new Set(remoteSessions.map(r => r.id));
    const resLogs = await syncCollection('logs', 'logs', { requiredIds: new Set(), knownRemoteIds });
    stats.logs = { pushed: resLogs.pushed, pulled: resLogs.pulled };

    const nowStamp = Date.now();
    await store.patchDevice({ lastSyncAt: nowStamp });
    setState({
      status: 'synced',
      lastSyncedAt: nowStamp,
      results: {
        ...state.results,
        scoring: { status: 'success', stats, time: nowStamp }
      }
    });
    console.log('[rakeezx sync] Scoring sync complete.', stats);
    return stats;

  } catch (err) {
    console.warn('[rakeezx sync] Scoring sync failed:', err);
    setState({
      status: 'error',
      results: {
        ...state.results,
        scoring: { status: 'error', error: err.message, time: Date.now() }
      }
    });
  }
}

export async function syncTimetable() {
  if (!cloud.session || !cloud.user) {
    console.log('[rakeezx sync] Not signed in, skipping timetable sync.');
    return;
  }
  if (state.status === 'syncing') return;

  console.log('[rakeezx sync] Enforcing structural sync before timetable...');
  await syncStructural();

  if (state.results.structural?.status === 'error') {
    console.warn('[rakeezx sync] Structural sync failed, aborting timetable sync.');
    setState({
      status: 'error',
      results: {
        ...state.results,
        timetable: { status: 'error', error: 'فشلت المزامنة الهيكلية: ' + state.results.structural.error, time: Date.now() }
      }
    });
    return;
  }

  setState({ status: 'syncing', results: { ...state.results, timetable: null } });
  console.log('[rakeezx sync] Started timetable sync...');

  try {
    const knownRemoteIds = {};
    const stats = {};

    // First, fetch remote teachings to validate foreign keys.
    const remoteTeachings = await cloud.fetchRecords('teachings');
    knownRemoteIds.teachings = new Set(remoteTeachings.map(r => r.id));

    const localStoreState = store.state;
    const context = buildLocalDependencies(localStoreState);

    // 1. timeProfiles
    const resProfiles = await syncCollection('timeProfiles', 'time_profiles', { requiredIds: context.timeProfiles, knownRemoteIds });
    knownRemoteIds.timeProfiles = resProfiles.known;
    stats.timeProfiles = { pushed: resProfiles.pushed, pulled: resProfiles.pulled };

    // 2. slots
    const resSlots = await syncCollection('slots', 'slots', { requiredIds: context.slots, knownRemoteIds });
    knownRemoteIds.slots = resSlots.known;
    stats.slots = { pushed: resSlots.pushed, pulled: resSlots.pulled };

    // 3. sessions
    const resSessions = await syncCollection('sessions', 'sessions', { requiredIds: new Set(), knownRemoteIds });
    knownRemoteIds.sessions = resSessions.known;
    stats.sessions = { pushed: resSessions.pushed, pulled: resSessions.pulled };

    // Fetch remote students for attendance foreign key validation
    const remoteStudents = await cloud.fetchRecords('students');
    knownRemoteIds.students = new Set(remoteStudents.map(r => r.id));

    // 4. attendance
    const resAttendance = await syncCollection('attendance', 'attendance', { requiredIds: new Set(), knownRemoteIds });
    knownRemoteIds.attendance = resAttendance.known;
    stats.attendance = { pushed: resAttendance.pushed, pulled: resAttendance.pulled };

    const nowStamp = Date.now();
    await store.patchDevice({ lastSyncAt: nowStamp });
    setState({
      status: 'synced',
      lastSyncedAt: nowStamp,
      results: {
        ...state.results,
        timetable: { status: 'success', stats, time: nowStamp }
      }
    });
    console.log('[rakeezx sync] Timetable sync complete.', stats);
    return stats;

  } catch (err) {
    console.warn('[rakeezx sync] Timetable sync failed:', err);
    setState({
      status: 'error',
      results: {
        ...state.results,
        timetable: { status: 'error', error: err.message, time: Date.now() }
      }
    });
  }
}
