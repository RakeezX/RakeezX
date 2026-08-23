import * as cloud from "/src/lib/cloud.js";
import * as store from "/src/store.js";
import { uid, DEFAULT_TIME_PROFILES } from "/src/models.js";

export const state = {
  status: 'idle', // idle, syncing
  lastSyncedAt: null, // will be initialized from store
  results: {
    profile: null,
    structural: null,
    students: null
  }
};

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
      }, { preserveTimestamp: true });
    }

    const nowStamp = Date.now();
    await store.patchDevice({ lastSyncAt: nowStamp });
    setState({
      status: 'idle',
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
      status: 'idle',
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
  const req = { years: new Set(), terms: new Set(), subjects: new Set(), sections: new Set(), teachings: new Set(), timeProfiles: new Set(), slots: new Set() };

  for (const sec of state.sections || []) {
    if (sec.yearId && isMeaningfulStructural('sections', sec)) {
      req.years.add(sec.yearId);
    }
  }
  for (const term of state.terms || []) {
    if (term.yearId && isMeaningfulStructural('terms', term)) {
      req.years.add(term.yearId);
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

  const remoteRecords = await cloud.fetchRecords(tableName);
  const localRecords = store.state[storeName] || [];

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

      // Mark old as deleted and save new (hydrated) immediately.
      patch[storeName].push({ id: oldId, deleted: true, deletedAt: new Date().toISOString() });
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
      const ok2 = await store.save(patch);
      if (!ok2) throw new Error(`${storeName} defaults: local persistence failed`);
  }

  // Dependency validation before push
  if (storeName === 'terms' || storeName === 'sections') {
    for (const p of toPush) {
      if (p.year_id && !context.knownRemoteIds?.years?.has(p.year_id)) {
        throw new Error(`${storeName}: missing remote year ${p.year_id}`);
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
    const ok = await store.save({ [storeName]: toUpdateLocal });
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
        const ok = await store.save(patch);
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
      status: 'idle',
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
      status: 'idle',
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
      status: 'idle',
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
      status: 'idle',
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
      status: 'idle',
      results: {
        ...state.results,
        students: { status: 'error', error: err.message, time: Date.now() }
      }
    });
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
      status: 'idle',
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

    const nowStamp = Date.now();
    await store.patchDevice({ lastSyncAt: nowStamp });
    setState({
      status: 'idle',
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
      status: 'idle',
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
      status: 'idle',
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
      status: 'idle',
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
      status: 'idle',
      results: {
        ...state.results,
        timetable: { status: 'error', error: err.message, time: Date.now() }
      }
    });
  }
}

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInN5bmMuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY2xvdWQgZnJvbSBcIi9zcmMvbGliL2Nsb3VkLmpzXCI7XHJcbmltcG9ydCAqIGFzIHN0b3JlIGZyb20gXCIvc3JjL3N0b3JlLmpzXCI7XHJcbmltcG9ydCB7IHVpZCwgREVGQVVMVF9USU1FX1BST0ZJTEVTIH0gZnJvbSBcIi9zcmMvbW9kZWxzLmpzXCI7XHJcblxyXG5leHBvcnQgY29uc3Qgc3RhdGUgPSB7XHJcbiAgc3RhdHVzOiAnaWRsZScsIC8vIGlkbGUsIHN5bmNpbmdcclxuICBsYXN0U3luY2VkQXQ6IG51bGwsIC8vIHdpbGwgYmUgaW5pdGlhbGl6ZWQgZnJvbSBzdG9yZVxyXG4gIHJlc3VsdHM6IHtcclxuICAgIHByb2ZpbGU6IG51bGwsXHJcbiAgICBzdHJ1Y3R1cmFsOiBudWxsLFxyXG4gICAgc3R1ZGVudHM6IG51bGxcclxuICB9XHJcbn07XHJcblxyXG5jb25zdCBsaXN0ZW5lcnMgPSBuZXcgU2V0KCk7XHJcbmV4cG9ydCBmdW5jdGlvbiBzdWJzY3JpYmUoZm4pIHtcclxuICBsaXN0ZW5lcnMuYWRkKGZuKTtcclxuICByZXR1cm4gKCkgPT4gbGlzdGVuZXJzLmRlbGV0ZShmbik7XHJcbn1cclxuZnVuY3Rpb24gbm90aWZ5KCkge1xyXG4gIGxpc3RlbmVycy5mb3JFYWNoKChmbikgPT4gZm4oKSk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHNldFN0YXRlKHVwZGF0ZXMpIHtcclxuICBPYmplY3QuYXNzaWduKHN0YXRlLCB1cGRhdGVzKTtcclxuICBub3RpZnkoKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGluaXQoKSB7XHJcbiAgc3RhdGUubGFzdFN5bmNlZEF0ID0gc3RvcmUuc3RhdGUuZGV2aWNlPy5sYXN0U3luY0F0IHx8IG51bGw7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGdldERldmljZUlkKCkge1xyXG4gIGxldCBpZCA9IHN0b3JlLnN0YXRlLmRldmljZT8uZGV2aWNlSWQ7XHJcbiAgaWYgKCFpZCkge1xyXG4gICAgaWQgPSB1aWQoKTtcclxuICAgIHN0b3JlLnBhdGNoRGV2aWNlKHsgZGV2aWNlSWQ6IGlkIH0pO1xyXG4gIH1cclxuICByZXR1cm4gaWQ7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBUaW1lc3RhbXAgbm9ybWFsaXphdGlvblxyXG4gKiBTYWZlbHkgcGFyc2VzIGFueSBkYXRlL251bWJlciB0byBpbnRlZ2VyIG1pbGxpc2Vjb25kcy5cclxuICogUmV0dXJucyAwIGlmIGludmFsaWQgb3IgYWJzZW50LlxyXG4gKi9cclxuZnVuY3Rpb24gbm9ybWFsaXplVGltZXN0YW1wKHRzKSB7XHJcbiAgaWYgKHRzID09PSBudWxsIHx8IHRzID09PSB1bmRlZmluZWQgfHwgdHMgPT09ICcnKSByZXR1cm4gMDtcclxuICBpZiAodHlwZW9mIHRzID09PSAnbnVtYmVyJykgcmV0dXJuIHRzO1xyXG4gIGlmICh0eXBlb2YgdHMgPT09ICdzdHJpbmcnKSB7XHJcbiAgICBjb25zdCBwYXJzZWROdW1iZXIgPSBOdW1iZXIodHMpO1xyXG4gICAgaWYgKCFpc05hTihwYXJzZWROdW1iZXIpICYmIHBhcnNlZE51bWJlciA+IDApIHJldHVybiBwYXJzZWROdW1iZXI7XHJcbiAgICBjb25zdCBwYXJzZWREYXRlID0gRGF0ZS5wYXJzZSh0cyk7XHJcbiAgICBpZiAoIWlzTmFOKHBhcnNlZERhdGUpKSByZXR1cm4gcGFyc2VkRGF0ZTtcclxuICB9XHJcbiAgcmV0dXJuIDA7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBDaGVja3MgaWYgdGhlIGxvY2FsIHByb2ZpbGUgY29udGFpbnMgYWN0dWFsIHVzZXItZW50ZXJlZCBkYXRhXHJcbiAqIHJhdGhlciB0aGFuIGp1c3QgYm9vdC10aW1lIGRlZmF1bHQgcGxhY2Vob2xkZXJzLlxyXG4gKi9cclxuZnVuY3Rpb24gaGFzTWVhbmluZ2Z1bFByb2ZpbGUocHJvZmlsZSkge1xyXG4gIGlmICghcHJvZmlsZSkgcmV0dXJuIGZhbHNlO1xyXG4gIHJldHVybiBCb29sZWFuKFxyXG4gICAgKHByb2ZpbGUudGVhY2hlck5hbWUgJiYgcHJvZmlsZS50ZWFjaGVyTmFtZS50cmltKCkgIT09ICcnKSB8fFxyXG4gICAgKHByb2ZpbGUuc2Nob29sTmFtZSAmJiBwcm9maWxlLnNjaG9vbE5hbWUudHJpbSgpICE9PSAnJykgfHxcclxuICAgIChwcm9maWxlLnBob25lICYmIHByb2ZpbGUucGhvbmUudHJpbSgpICE9PSAnJylcclxuICApO1xyXG59XHJcblxyXG4vKipcclxuICogUGhhc2UgNUE6IFByb2ZpbGUgU3luYyBvbmx5LlxyXG4gKiBTeW5jIGRpcmVjdGlvbjogUHVsbCDihpIgTWVyZ2Ug4oaSIFB1c2guXHJcbiAqL1xyXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gc3luY1Byb2ZpbGUoKSB7XHJcbiAgaWYgKCFjbG91ZC5zZXNzaW9uIHx8ICFjbG91ZC51c2VyKSB7XHJcbiAgICBjb25zb2xlLmxvZygnW3Jha2Vlenggc3luY10gTm90IHNpZ25lZCBpbiwgc2tpcHBpbmcgc3luYy4nKTtcclxuICAgIHJldHVybjtcclxuICB9XHJcbiAgaWYgKHN0YXRlLnN0YXR1cyA9PT0gJ3N5bmNpbmcnKSByZXR1cm47XHJcblxyXG4gIHNldFN0YXRlKHsgc3RhdHVzOiAnc3luY2luZycsIHJlc3VsdHM6IHsgLi4uc3RhdGUucmVzdWx0cywgcHJvZmlsZTogbnVsbCB9IH0pO1xyXG4gIGNvbnNvbGUubG9nKCdbcmFrZWV6eCBzeW5jXSBTdGFydGVkIFByb2ZpbGUgc3luYy4uLicpO1xyXG5cclxuICB0cnkge1xyXG4gICAgY29uc3QgcmVtb3RlID0gYXdhaXQgY2xvdWQuZmV0Y2hQcm9maWxlKCk7XHJcbiAgICBjb25zdCBsb2NhbCA9IHN0b3JlLnN0YXRlLnByb2ZpbGU7XHJcblxyXG4gICAgY29uc3QgbG9jYWxVcGRhdGVkQXQgPSBub3JtYWxpemVUaW1lc3RhbXAobG9jYWw/LnVwZGF0ZWRBdCk7XHJcbiAgICBjb25zdCByZW1vdGVDbGllbnRVcGRhdGVkQXQgPSBub3JtYWxpemVUaW1lc3RhbXAocmVtb3RlPy5jbGllbnRfdXBkYXRlZF9hdCk7XHJcblxyXG4gICAgbGV0IHNob3VsZFB1c2ggPSBmYWxzZTtcclxuICAgIGxldCBzaG91bGRVcGRhdGVMb2NhbCA9IGZhbHNlO1xyXG4gICAgbGV0IG1lcmdlZCA9IG51bGw7XHJcblxyXG4gICAgaWYgKCFyZW1vdGUpIHtcclxuICAgICAgaWYgKGhhc01lYW5pbmdmdWxQcm9maWxlKGxvY2FsKSkge1xyXG4gICAgICAgIGNvbnNvbGUubG9nKCdbcmFrZWV6eCBzeW5jXSBObyByZW1vdGUgcHJvZmlsZS4gTG9jYWwgaGFzIG1lYW5pbmdmdWwgZGF0YS4gTG9jYWwgd2lucy4nKTtcclxuICAgICAgICBzaG91bGRQdXNoID0gdHJ1ZTtcclxuICAgICAgICBtZXJnZWQgPSBsb2NhbDtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICBjb25zb2xlLmxvZygnW3Jha2Vlenggc3luY10gQm90aCByZW1vdGUgYW5kIGxvY2FsIGFyZSBlbXB0eS9kZWZhdWx0LiBOby1vcC4nKTtcclxuICAgICAgfVxyXG4gICAgfSBlbHNlIHtcclxuICAgICAgaWYgKCFoYXNNZWFuaW5nZnVsUHJvZmlsZShsb2NhbCkpIHtcclxuICAgICAgICBjb25zb2xlLmxvZygnW3Jha2Vlenggc3luY10gTG9jYWwgaXMgZW1wdHkvZGVmYXVsdC4gUmVtb3RlIHdpbnMuJyk7XHJcbiAgICAgICAgc2hvdWxkVXBkYXRlTG9jYWwgPSB0cnVlO1xyXG4gICAgICAgIG1lcmdlZCA9IHtcclxuICAgICAgICAgIHRlYWNoZXJOYW1lOiByZW1vdGUudGVhY2hlcl9uYW1lLFxyXG4gICAgICAgICAgc2Nob29sTmFtZTogcmVtb3RlLnNjaG9vbF9uYW1lLFxyXG4gICAgICAgICAgcGhvbmU6IHJlbW90ZS5waG9uZSxcclxuICAgICAgICAgIHVwZGF0ZWRBdDogcmVtb3RlQ2xpZW50VXBkYXRlZEF0LCAvLyBLZWVwIHJlbW90ZSdzIHRpbWVzdGFtcFxyXG4gICAgICAgICAgZGVsZXRlZDogISFyZW1vdGUuZGVsZXRlZF9hdFxyXG4gICAgICAgIH07XHJcbiAgICAgIH0gZWxzZSBpZiAobG9jYWxVcGRhdGVkQXQgPiByZW1vdGVDbGllbnRVcGRhdGVkQXQpIHtcclxuICAgICAgICBjb25zb2xlLmxvZygnW3Jha2Vlenggc3luY10gTG9jYWwgaXMgc3RyaWN0bHkgbmV3ZXIuIExvY2FsIHdpbnMuJyk7XHJcbiAgICAgICAgc2hvdWxkUHVzaCA9IHRydWU7XHJcbiAgICAgICAgbWVyZ2VkID0gbG9jYWw7XHJcbiAgICAgIH0gZWxzZSBpZiAocmVtb3RlQ2xpZW50VXBkYXRlZEF0ID4gbG9jYWxVcGRhdGVkQXQpIHtcclxuICAgICAgICBjb25zb2xlLmxvZygnW3Jha2Vlenggc3luY10gUmVtb3RlIGlzIHN0cmljdGx5IG5ld2VyLiBSZW1vdGUgd2lucy4nKTtcclxuICAgICAgICBzaG91bGRVcGRhdGVMb2NhbCA9IHRydWU7XHJcbiAgICAgICAgbWVyZ2VkID0ge1xyXG4gICAgICAgICAgdGVhY2hlck5hbWU6IHJlbW90ZS50ZWFjaGVyX25hbWUsXHJcbiAgICAgICAgICBzY2hvb2xOYW1lOiByZW1vdGUuc2Nob29sX25hbWUsXHJcbiAgICAgICAgICBwaG9uZTogcmVtb3RlLnBob25lLFxyXG4gICAgICAgICAgdXBkYXRlZEF0OiByZW1vdGVDbGllbnRVcGRhdGVkQXQsIC8vIEtlZXAgcmVtb3RlJ3MgdGltZXN0YW1wXHJcbiAgICAgICAgICBkZWxldGVkOiAhIXJlbW90ZS5kZWxldGVkX2F0XHJcbiAgICAgICAgfTtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICBjb25zb2xlLmxvZygnW3Jha2Vlenggc3luY10gVGltZXN0YW1wcyBhcmUgZXhhY3RseSBlcXVhbC4gUGVyZmVjdCBzeW5jLCBubyBhY3Rpb24uJyk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBpZiAoc2hvdWxkUHVzaCAmJiBtZXJnZWQpIHtcclxuICAgICAgY29uc29sZS5sb2coJ1tyYWtlZXp4IHN5bmNdIFB1c2hpbmcgdG8gY2xvdWQuLi4nKTtcclxuICAgICAgY29uc3QgcGF5bG9hZCA9IHtcclxuICAgICAgICB0ZWFjaGVyX25hbWU6IG1lcmdlZC50ZWFjaGVyTmFtZSB8fCAnJyxcclxuICAgICAgICBzY2hvb2xfbmFtZTogbWVyZ2VkLnNjaG9vbE5hbWUgfHwgJycsXHJcbiAgICAgICAgcGhvbmU6IG1lcmdlZC5waG9uZSB8fCAnJyxcclxuICAgICAgICBjbGllbnRfdXBkYXRlZF9hdDogbWVyZ2VkLnVwZGF0ZWRBdCxcclxuICAgICAgICBkZXZpY2VfaWQ6IGdldERldmljZUlkKClcclxuICAgICAgfTtcclxuXHJcbiAgICAgIGlmICghcmVtb3RlKSB7XHJcbiAgICAgICAgYXdhaXQgY2xvdWQuaW5zZXJ0UHJvZmlsZShwYXlsb2FkKTtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICBhd2FpdCBjbG91ZC51cGRhdGVQcm9maWxlKHBheWxvYWQpO1xyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKHNob3VsZFVwZGF0ZUxvY2FsICYmIG1lcmdlZCkge1xyXG4gICAgICBjb25zb2xlLmxvZygnW3Jha2Vlenggc3luY10gVXBkYXRpbmcgbG9jYWwgc3RvcmUuLi4nKTtcclxuICAgICAgYXdhaXQgc3RvcmUucGF0Y2hQcm9maWxlKHtcclxuICAgICAgICB0ZWFjaGVyTmFtZTogbWVyZ2VkLnRlYWNoZXJOYW1lLFxyXG4gICAgICAgIHNjaG9vbE5hbWU6IG1lcmdlZC5zY2hvb2xOYW1lLFxyXG4gICAgICAgIHBob25lOiBtZXJnZWQucGhvbmUsXHJcbiAgICAgICAgdXBkYXRlZEF0OiBtZXJnZWQudXBkYXRlZEF0LFxyXG4gICAgICAgIGRlbGV0ZWQ6IG1lcmdlZC5kZWxldGVkXHJcbiAgICAgIH0sIHsgcHJlc2VydmVUaW1lc3RhbXA6IHRydWUgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3Qgbm93U3RhbXAgPSBEYXRlLm5vdygpO1xyXG4gICAgYXdhaXQgc3RvcmUucGF0Y2hEZXZpY2UoeyBsYXN0U3luY0F0OiBub3dTdGFtcCB9KTtcclxuICAgIHNldFN0YXRlKHtcclxuICAgICAgc3RhdHVzOiAnaWRsZScsXHJcbiAgICAgIGxhc3RTeW5jZWRBdDogbm93U3RhbXAsXHJcbiAgICAgIHJlc3VsdHM6IHtcclxuICAgICAgICAuLi5zdGF0ZS5yZXN1bHRzLFxyXG4gICAgICAgIHByb2ZpbGU6IHsgc3RhdHVzOiAnc3VjY2VzcycsIHRpbWU6IG5vd1N0YW1wIH1cclxuICAgICAgfVxyXG4gICAgfSk7XHJcbiAgICBjb25zb2xlLmxvZygnW3Jha2Vlenggc3luY10gUHJvZmlsZSBzeW5jIGNvbXBsZXRlLicpO1xyXG5cclxuICB9IGNhdGNoIChlcnIpIHtcclxuICAgIGNvbnNvbGUud2FybignW3Jha2Vlenggc3luY10gUHJvZmlsZSBzeW5jIGZhaWxlZDonLCBlcnIpO1xyXG4gICAgc2V0U3RhdGUoe1xyXG4gICAgICBzdGF0dXM6ICdpZGxlJyxcclxuICAgICAgcmVzdWx0czoge1xyXG4gICAgICAgIC4uLnN0YXRlLnJlc3VsdHMsXHJcbiAgICAgICAgcHJvZmlsZTogeyBzdGF0dXM6ICdlcnJvcicsIGVycm9yOiBlcnIubWVzc2FnZSwgdGltZTogRGF0ZS5ub3coKSB9XHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG4gIH1cclxufVxyXG5cclxuLyoqXHJcbiAqIE1hcHMgbG9jYWwgbW9kZWxzIHRvL2Zyb20gU3VwYWJhc2UgcGF5bG9hZCBzdHJ1Y3R1cmVzXHJcbiAqL1xyXG5jb25zdCBNQVBQRVJTID0ge1xyXG4gIHllYXJzOiB7XHJcbiAgICB0b0Nsb3VkOiAocmVjKSA9PiAoe1xyXG4gICAgICBpZDogcmVjLmlkLFxyXG4gICAgICBsYWJlbDogcmVjLmxhYmVsLFxyXG4gICAgICBoaWpyaV9zdGFydDogcmVjLmhpanJpU3RhcnQsXHJcbiAgICAgIGhpanJpX2VuZDogcmVjLmhpanJpRW5kLFxyXG4gICAgICBvcmRlcjogcmVjLm9yZGVyLFxyXG4gICAgICBzdGF0dXM6IHJlYy5zdGF0dXMsXHJcbiAgICAgIGRlbGV0ZWRfYXQ6IHJlYy5kZWxldGVkID8gKHJlYy5kZWxldGVkQXQgfHwgbmV3IERhdGUocmVjLnVwZGF0ZWRBdCkudG9JU09TdHJpbmcoKSkgOiBudWxsLFxyXG4gICAgICBjbGllbnRfdXBkYXRlZF9hdDogcmVjLnVwZGF0ZWRBdCxcclxuICAgICAgZGV2aWNlX2lkOiBnZXREZXZpY2VJZCgpXHJcbiAgICB9KSxcclxuICAgIGZyb21DbG91ZDogKHJlYykgPT4gKHtcclxuICAgICAgaWQ6IHJlYy5pZCxcclxuICAgICAgbGFiZWw6IHJlYy5sYWJlbCxcclxuICAgICAgaGlqcmlTdGFydDogcmVjLmhpanJpX3N0YXJ0LFxyXG4gICAgICBoaWpyaUVuZDogcmVjLmhpanJpX2VuZCxcclxuICAgICAgb3JkZXI6IHJlYy5vcmRlcixcclxuICAgICAgc3RhdHVzOiByZWMuc3RhdHVzLFxyXG4gICAgICB1cGRhdGVkQXQ6IG5vcm1hbGl6ZVRpbWVzdGFtcChyZWMuY2xpZW50X3VwZGF0ZWRfYXQpLFxyXG4gICAgICBkZWxldGVkOiAhIXJlYy5kZWxldGVkX2F0LFxyXG4gICAgICBkZWxldGVkQXQ6IHJlYy5kZWxldGVkX2F0IHx8IHVuZGVmaW5lZFxyXG4gICAgfSlcclxuICB9LFxyXG4gIHRlcm1zOiB7XHJcbiAgICB0b0Nsb3VkOiAocmVjKSA9PiAoe1xyXG4gICAgICBpZDogcmVjLmlkLFxyXG4gICAgICB5ZWFyX2lkOiByZWMueWVhcklkLFxyXG4gICAgICBuYW1lOiByZWMubmFtZSxcclxuICAgICAgaW5kZXg6IHJlYy5pbmRleCxcclxuICAgICAgc3RhcnRfZGF0ZTogcmVjLnN0YXJ0RGF0ZSxcclxuICAgICAgZW5kX2RhdGU6IHJlYy5lbmREYXRlLFxyXG4gICAgICBzdGF0dXM6IHJlYy5zdGF0dXMsXHJcbiAgICAgIGNhbGVuZGFyX2lkOiByZWMuY2FsZW5kYXJJZCxcclxuICAgICAgZGVsZXRlZF9hdDogcmVjLmRlbGV0ZWQgPyAocmVjLmRlbGV0ZWRBdCB8fCBuZXcgRGF0ZShyZWMudXBkYXRlZEF0KS50b0lTT1N0cmluZygpKSA6IG51bGwsXHJcbiAgICAgIGNsaWVudF91cGRhdGVkX2F0OiByZWMudXBkYXRlZEF0LFxyXG4gICAgICBkZXZpY2VfaWQ6IGdldERldmljZUlkKClcclxuICAgIH0pLFxyXG4gICAgZnJvbUNsb3VkOiAocmVjKSA9PiAoe1xyXG4gICAgICBpZDogcmVjLmlkLFxyXG4gICAgICB5ZWFySWQ6IHJlYy55ZWFyX2lkLFxyXG4gICAgICBuYW1lOiByZWMubmFtZSxcclxuICAgICAgaW5kZXg6IHJlYy5pbmRleCxcclxuICAgICAgc3RhcnREYXRlOiByZWMuc3RhcnRfZGF0ZSxcclxuICAgICAgZW5kRGF0ZTogcmVjLmVuZF9kYXRlLFxyXG4gICAgICBzdGF0dXM6IHJlYy5zdGF0dXMsXHJcbiAgICAgIGNhbGVuZGFySWQ6IHJlYy5jYWxlbmRhcl9pZCxcclxuICAgICAgdXBkYXRlZEF0OiBub3JtYWxpemVUaW1lc3RhbXAocmVjLmNsaWVudF91cGRhdGVkX2F0KSxcclxuICAgICAgZGVsZXRlZDogISFyZWMuZGVsZXRlZF9hdCxcclxuICAgICAgZGVsZXRlZEF0OiByZWMuZGVsZXRlZF9hdCB8fCB1bmRlZmluZWRcclxuICAgIH0pXHJcbiAgfSxcclxuICBzdWJqZWN0czoge1xyXG4gICAgdG9DbG91ZDogKHJlYykgPT4gKHtcclxuICAgICAgaWQ6IHJlYy5pZCxcclxuICAgICAgbmFtZTogcmVjLm5hbWUsXHJcbiAgICAgIHNsdWc6IHJlYy5zbHVnLFxyXG4gICAgICBkZWxldGVkX2F0OiByZWMuZGVsZXRlZCA/IChyZWMuZGVsZXRlZEF0IHx8IG5ldyBEYXRlKHJlYy51cGRhdGVkQXQpLnRvSVNPU3RyaW5nKCkpIDogbnVsbCxcclxuICAgICAgY2xpZW50X3VwZGF0ZWRfYXQ6IHJlYy51cGRhdGVkQXQsXHJcbiAgICAgIGRldmljZV9pZDogZ2V0RGV2aWNlSWQoKVxyXG4gICAgfSksXHJcbiAgICBmcm9tQ2xvdWQ6IChyZWMpID0+ICh7XHJcbiAgICAgIGlkOiByZWMuaWQsXHJcbiAgICAgIG5hbWU6IHJlYy5uYW1lLFxyXG4gICAgICBzbHVnOiByZWMuc2x1ZyxcclxuICAgICAgdXBkYXRlZEF0OiBub3JtYWxpemVUaW1lc3RhbXAocmVjLmNsaWVudF91cGRhdGVkX2F0KSxcclxuICAgICAgZGVsZXRlZDogISFyZWMuZGVsZXRlZF9hdCxcclxuICAgICAgZGVsZXRlZEF0OiByZWMuZGVsZXRlZF9hdCB8fCB1bmRlZmluZWRcclxuICAgIH0pXHJcbiAgfSxcclxuICBzZWN0aW9uczoge1xyXG4gICAgdG9DbG91ZDogKHJlYykgPT4gKHtcclxuICAgICAgaWQ6IHJlYy5pZCxcclxuICAgICAgeWVhcl9pZDogcmVjLnllYXJJZCxcclxuICAgICAgZ3JhZGU6IHJlYy5ncmFkZSxcclxuICAgICAgbGFiZWw6IHJlYy5sYWJlbCxcclxuICAgICAgbmFtZTogcmVjLm5hbWUsXHJcbiAgICAgIGNvbG9yOiByZWMuY29sb3IsXHJcbiAgICAgIG9yZGVyOiByZWMub3JkZXIsXHJcbiAgICAgIGRlbGV0ZWRfYXQ6IHJlYy5kZWxldGVkID8gKHJlYy5kZWxldGVkQXQgfHwgbmV3IERhdGUocmVjLnVwZGF0ZWRBdCkudG9JU09TdHJpbmcoKSkgOiBudWxsLFxyXG4gICAgICBjbGllbnRfdXBkYXRlZF9hdDogcmVjLnVwZGF0ZWRBdCxcclxuICAgICAgZGV2aWNlX2lkOiBnZXREZXZpY2VJZCgpXHJcbiAgICB9KSxcclxuICAgIGZyb21DbG91ZDogKHJlYykgPT4gKHtcclxuICAgICAgaWQ6IHJlYy5pZCxcclxuICAgICAgeWVhcklkOiByZWMueWVhcl9pZCxcclxuICAgICAgZ3JhZGU6IHJlYy5ncmFkZSxcclxuICAgICAgbGFiZWw6IHJlYy5sYWJlbCxcclxuICAgICAgbmFtZTogcmVjLm5hbWUsXHJcbiAgICAgIGNvbG9yOiByZWMuY29sb3IsXHJcbiAgICAgIG9yZGVyOiByZWMub3JkZXIsXHJcbiAgICAgIHVwZGF0ZWRBdDogbm9ybWFsaXplVGltZXN0YW1wKHJlYy5jbGllbnRfdXBkYXRlZF9hdCksXHJcbiAgICAgIGRlbGV0ZWQ6ICEhcmVjLmRlbGV0ZWRfYXQsXHJcbiAgICAgIGRlbGV0ZWRBdDogcmVjLmRlbGV0ZWRfYXQgfHwgdW5kZWZpbmVkXHJcbiAgICB9KVxyXG4gIH0sXHJcbiAgdGVhY2hpbmdzOiB7XHJcbiAgICB0b0Nsb3VkOiAocmVjKSA9PiAoe1xyXG4gICAgICBpZDogcmVjLmlkLFxyXG4gICAgICBzZWN0aW9uX2lkOiByZWMuc2VjdGlvbklkLFxyXG4gICAgICBzdWJqZWN0X2lkOiByZWMuc3ViamVjdElkLFxyXG4gICAgICB0ZXJtX2lkOiByZWMudGVybUlkLFxyXG4gICAgICBvcmRlcjogcmVjLm9yZGVyLFxyXG4gICAgICBkZWxldGVkX2F0OiByZWMuZGVsZXRlZCA/IChyZWMuZGVsZXRlZEF0IHx8IG5ldyBEYXRlKHJlYy51cGRhdGVkQXQpLnRvSVNPU3RyaW5nKCkpIDogbnVsbCxcclxuICAgICAgY2xpZW50X3VwZGF0ZWRfYXQ6IHJlYy51cGRhdGVkQXQsXHJcbiAgICAgIGRldmljZV9pZDogZ2V0RGV2aWNlSWQoKVxyXG4gICAgfSksXHJcbiAgICBmcm9tQ2xvdWQ6IChyZWMpID0+ICh7XHJcbiAgICAgIGlkOiByZWMuaWQsXHJcbiAgICAgIHNlY3Rpb25JZDogcmVjLnNlY3Rpb25faWQsXHJcbiAgICAgIHN1YmplY3RJZDogcmVjLnN1YmplY3RfaWQsXHJcbiAgICAgIHRlcm1JZDogcmVjLnRlcm1faWQsXHJcbiAgICAgIG9yZGVyOiByZWMub3JkZXIsXHJcbiAgICAgIHVwZGF0ZWRBdDogbm9ybWFsaXplVGltZXN0YW1wKHJlYy5jbGllbnRfdXBkYXRlZF9hdCksXHJcbiAgICAgIGRlbGV0ZWQ6ICEhcmVjLmRlbGV0ZWRfYXQsXHJcbiAgICAgIGRlbGV0ZWRBdDogcmVjLmRlbGV0ZWRfYXQgfHwgdW5kZWZpbmVkXHJcbiAgICB9KVxyXG4gIH0sXHJcbiAgc3R1ZGVudHM6IHtcclxuICAgIHRvQ2xvdWQ6IChyZWMpID0+ICh7XHJcbiAgICAgIGlkOiByZWMuaWQsXHJcbiAgICAgIG5hbWU6IHJlYy5uYW1lLFxyXG4gICAgICBub3RlOiByZWMubm90ZSxcclxuICAgICAgc3RhdHVzOiByZWMuc3RhdHVzLFxyXG4gICAgICBkZWxldGVkX2F0OiByZWMuZGVsZXRlZCA/IChyZWMuZGVsZXRlZEF0IHx8IG5ldyBEYXRlKHJlYy51cGRhdGVkQXQpLnRvSVNPU3RyaW5nKCkpIDogbnVsbCxcclxuICAgICAgY2xpZW50X3VwZGF0ZWRfYXQ6IHJlYy51cGRhdGVkQXQsXHJcbiAgICAgIGRldmljZV9pZDogZ2V0RGV2aWNlSWQoKVxyXG4gICAgfSksXHJcbiAgICBmcm9tQ2xvdWQ6IChyZWMpID0+ICh7XHJcbiAgICAgIGlkOiByZWMuaWQsXHJcbiAgICAgIG5hbWU6IHJlYy5uYW1lLFxyXG4gICAgICBub3RlOiByZWMubm90ZSxcclxuICAgICAgc3RhdHVzOiByZWMuc3RhdHVzLFxyXG4gICAgICB1cGRhdGVkQXQ6IG5vcm1hbGl6ZVRpbWVzdGFtcChyZWMuY2xpZW50X3VwZGF0ZWRfYXQpLFxyXG4gICAgICBkZWxldGVkOiAhIXJlYy5kZWxldGVkX2F0LFxyXG4gICAgICBkZWxldGVkQXQ6IHJlYy5kZWxldGVkX2F0IHx8IHVuZGVmaW5lZFxyXG4gICAgfSlcclxuICB9LFxyXG4gIGVucm9sbG1lbnRzOiB7XHJcbiAgICB0b0Nsb3VkOiAocmVjKSA9PiAoe1xyXG4gICAgICBpZDogcmVjLmlkLFxyXG4gICAgICBzdHVkZW50X2lkOiByZWMuc3R1ZGVudElkLFxyXG4gICAgICBzZWN0aW9uX2lkOiByZWMuc2VjdGlvbklkLFxyXG4gICAgICByb2xsX25vOiByZWMucm9sbE5vLFxyXG4gICAgICBzdGFydF9kYXRlOiByZWMuc3RhcnREYXRlLFxyXG4gICAgICBlbmRfZGF0ZTogcmVjLmVuZERhdGUsXHJcbiAgICAgIHN0YXR1czogcmVjLnN0YXR1cyxcclxuICAgICAgdHJhbnNmZXJfbm90ZTogcmVjLnRyYW5zZmVyTm90ZSxcclxuICAgICAgZGVsZXRlZF9hdDogcmVjLmRlbGV0ZWQgPyAocmVjLmRlbGV0ZWRBdCB8fCBuZXcgRGF0ZShyZWMudXBkYXRlZEF0KS50b0lTT1N0cmluZygpKSA6IG51bGwsXHJcbiAgICAgIGNsaWVudF91cGRhdGVkX2F0OiByZWMudXBkYXRlZEF0LFxyXG4gICAgICBkZXZpY2VfaWQ6IGdldERldmljZUlkKClcclxuICAgIH0pLFxyXG4gICAgZnJvbUNsb3VkOiAocmVjKSA9PiAoe1xyXG4gICAgICBpZDogcmVjLmlkLFxyXG4gICAgICBzdHVkZW50SWQ6IHJlYy5zdHVkZW50X2lkLFxyXG4gICAgICBzZWN0aW9uSWQ6IHJlYy5zZWN0aW9uX2lkLFxyXG4gICAgICByb2xsTm86IHJlYy5yb2xsX25vLFxyXG4gICAgICBzdGFydERhdGU6IHJlYy5zdGFydF9kYXRlLFxyXG4gICAgICBlbmREYXRlOiByZWMuZW5kX2RhdGUsXHJcbiAgICAgIHN0YXR1czogcmVjLnN0YXR1cyxcclxuICAgICAgdHJhbnNmZXJOb3RlOiByZWMudHJhbnNmZXJfbm90ZSxcclxuICAgICAgdXBkYXRlZEF0OiBub3JtYWxpemVUaW1lc3RhbXAocmVjLmNsaWVudF91cGRhdGVkX2F0KSxcclxuICAgICAgZGVsZXRlZDogISFyZWMuZGVsZXRlZF9hdCxcclxuICAgICAgZGVsZXRlZEF0OiByZWMuZGVsZXRlZF9hdCB8fCB1bmRlZmluZWRcclxuICAgIH0pXHJcbiAgfSxcclxuICBpdGVtczoge1xyXG4gICAgdG9DbG91ZDogKHJlYykgPT4gKHtcclxuICAgICAgaWQ6IHJlYy5pZCxcclxuICAgICAgdGVhY2hpbmdfaWQ6IHJlYy50ZWFjaGluZ0lkLFxyXG4gICAgICBuYW1lOiByZWMubmFtZSxcclxuICAgICAgbWF4OiByZWMubWF4LFxyXG4gICAgICBvcmRlcjogcmVjLm9yZGVyLFxyXG4gICAgICBhdXRvOiByZWMuYXV0byxcclxuICAgICAgcGVyX3BvaW50OiByZWMucGVyUG9pbnQsXHJcbiAgICAgIHBlbmFsdHk6IHJlYy5wZW5hbHR5LFxyXG4gICAgICB1bml0X2lkOiByZWMudW5pdElkLFxyXG4gICAgICBsZXNzb25faWQ6IHJlYy5sZXNzb25JZCxcclxuICAgICAgZGVsZXRlZF9hdDogcmVjLmRlbGV0ZWQgPyAocmVjLmRlbGV0ZWRBdCB8fCBuZXcgRGF0ZShyZWMudXBkYXRlZEF0KS50b0lTT1N0cmluZygpKSA6IG51bGwsXHJcbiAgICAgIGNsaWVudF91cGRhdGVkX2F0OiByZWMudXBkYXRlZEF0LFxyXG4gICAgICBkZXZpY2VfaWQ6IGdldERldmljZUlkKClcclxuICAgIH0pLFxyXG4gICAgZnJvbUNsb3VkOiAocmVjKSA9PiAoe1xyXG4gICAgICBpZDogcmVjLmlkLFxyXG4gICAgICB0ZWFjaGluZ0lkOiByZWMudGVhY2hpbmdfaWQsXHJcbiAgICAgIG5hbWU6IHJlYy5uYW1lLFxyXG4gICAgICBtYXg6IHJlYy5tYXgsXHJcbiAgICAgIG9yZGVyOiByZWMub3JkZXIsXHJcbiAgICAgIGF1dG86IHJlYy5hdXRvLFxyXG4gICAgICBwZXJQb2ludDogcmVjLnBlcl9wb2ludCxcclxuICAgICAgcGVuYWx0eTogcmVjLnBlbmFsdHksXHJcbiAgICAgIHVuaXRJZDogcmVjLnVuaXRfaWQsXHJcbiAgICAgIGxlc3NvbklkOiByZWMubGVzc29uX2lkLFxyXG4gICAgICB1cGRhdGVkQXQ6IG5vcm1hbGl6ZVRpbWVzdGFtcChyZWMuY2xpZW50X3VwZGF0ZWRfYXQpLFxyXG4gICAgICBkZWxldGVkOiAhIXJlYy5kZWxldGVkX2F0LFxyXG4gICAgICBkZWxldGVkQXQ6IHJlYy5kZWxldGVkX2F0IHx8IHVuZGVmaW5lZFxyXG4gICAgfSlcclxuICB9LFxyXG4gIHNjb3Jlczoge1xyXG4gICAgdG9DbG91ZDogKHJlYykgPT4gKHtcclxuICAgICAgaWQ6IHJlYy5pZCxcclxuICAgICAgc3R1ZGVudF9pZDogcmVjLnN0dWRlbnRJZCxcclxuICAgICAgaXRlbV9pZDogcmVjLml0ZW1JZCxcclxuICAgICAgdmFsdWU6IHJlYy52YWx1ZSxcclxuICAgICAgZGVsZXRlZF9hdDogcmVjLmRlbGV0ZWQgPyAocmVjLmRlbGV0ZWRBdCB8fCBuZXcgRGF0ZShyZWMudXBkYXRlZEF0KS50b0lTT1N0cmluZygpKSA6IG51bGwsXHJcbiAgICAgIGNsaWVudF91cGRhdGVkX2F0OiByZWMudXBkYXRlZEF0LFxyXG4gICAgICBkZXZpY2VfaWQ6IGdldERldmljZUlkKClcclxuICAgIH0pLFxyXG4gICAgZnJvbUNsb3VkOiAocmVjKSA9PiAoe1xyXG4gICAgICBpZDogcmVjLmlkLFxyXG4gICAgICBzdHVkZW50SWQ6IHJlYy5zdHVkZW50X2lkLFxyXG4gICAgICBpdGVtSWQ6IHJlYy5pdGVtX2lkLFxyXG4gICAgICB2YWx1ZTogcmVjLnZhbHVlLFxyXG4gICAgICB1cGRhdGVkQXQ6IG5vcm1hbGl6ZVRpbWVzdGFtcChyZWMuY2xpZW50X3VwZGF0ZWRfYXQpLFxyXG4gICAgICBkZWxldGVkOiAhIXJlYy5kZWxldGVkX2F0LFxyXG4gICAgICBkZWxldGVkQXQ6IHJlYy5kZWxldGVkX2F0IHx8IHVuZGVmaW5lZFxyXG4gICAgfSlcclxuICB9LFxyXG4gIHRpbWVQcm9maWxlczoge1xyXG4gICAgdG9DbG91ZDogKHJlYykgPT4gKHtcclxuICAgICAgaWQ6IHJlYy5pZCxcclxuICAgICAgbmFtZTogcmVjLm5hbWUsXHJcbiAgICAgIG9yZGVyOiByZWMub3JkZXIsXHJcbiAgICAgIHBlcmlvZHM6IHJlYy5wZXJpb2RzLFxyXG4gICAgICBvdmVycmlkZXM6IHJlYy5vdmVycmlkZXMsXHJcbiAgICAgIGFjdGl2ZV9mcm9tOiByZWMuYWN0aXZlRnJvbSxcclxuICAgICAgYWN0aXZlX3RvOiByZWMuYWN0aXZlVG8sXHJcbiAgICAgIGRlbGV0ZWRfYXQ6IHJlYy5kZWxldGVkID8gKHJlYy5kZWxldGVkQXQgfHwgbmV3IERhdGUocmVjLnVwZGF0ZWRBdCkudG9JU09TdHJpbmcoKSkgOiBudWxsLFxyXG4gICAgICBjbGllbnRfdXBkYXRlZF9hdDogcmVjLnVwZGF0ZWRBdCxcclxuICAgICAgZGV2aWNlX2lkOiBnZXREZXZpY2VJZCgpXHJcbiAgICB9KSxcclxuICAgIGZyb21DbG91ZDogKHJlYykgPT4gKHtcclxuICAgICAgaWQ6IHJlYy5pZCxcclxuICAgICAgbmFtZTogcmVjLm5hbWUsXHJcbiAgICAgIG9yZGVyOiByZWMub3JkZXIsXHJcbiAgICAgIHBlcmlvZHM6IHJlYy5wZXJpb2RzLFxyXG4gICAgICBvdmVycmlkZXM6IHJlYy5vdmVycmlkZXMsXHJcbiAgICAgIGFjdGl2ZUZyb206IHJlYy5hY3RpdmVfZnJvbSxcclxuICAgICAgYWN0aXZlVG86IHJlYy5hY3RpdmVfdG8sXHJcbiAgICAgIHVwZGF0ZWRBdDogbm9ybWFsaXplVGltZXN0YW1wKHJlYy5jbGllbnRfdXBkYXRlZF9hdCksXHJcbiAgICAgIGRlbGV0ZWQ6ICEhcmVjLmRlbGV0ZWRfYXQsXHJcbiAgICAgIGRlbGV0ZWRBdDogcmVjLmRlbGV0ZWRfYXQgfHwgdW5kZWZpbmVkXHJcbiAgICB9KVxyXG4gIH0sXHJcbiAgc2xvdHM6IHtcclxuICAgIHRvQ2xvdWQ6IChyZWMpID0+ICh7XHJcbiAgICAgIGlkOiByZWMuaWQsXHJcbiAgICAgIHRlYWNoaW5nX2lkOiByZWMudGVhY2hpbmdJZCxcclxuICAgICAgd2Vla2RheTogcmVjLndlZWtkYXksXHJcbiAgICAgIHBlcmlvZDogcmVjLnBlcmlvZCxcclxuICAgICAgZGVsZXRlZF9hdDogcmVjLmRlbGV0ZWQgPyAocmVjLmRlbGV0ZWRBdCB8fCBuZXcgRGF0ZShyZWMudXBkYXRlZEF0KS50b0lTT1N0cmluZygpKSA6IG51bGwsXHJcbiAgICAgIGNsaWVudF91cGRhdGVkX2F0OiByZWMudXBkYXRlZEF0LFxyXG4gICAgICBkZXZpY2VfaWQ6IGdldERldmljZUlkKClcclxuICAgIH0pLFxyXG4gICAgZnJvbUNsb3VkOiAocmVjKSA9PiAoe1xyXG4gICAgICBpZDogcmVjLmlkLFxyXG4gICAgICB0ZWFjaGluZ0lkOiByZWMudGVhY2hpbmdfaWQsXHJcbiAgICAgIHdlZWtkYXk6IHJlYy53ZWVrZGF5LFxyXG4gICAgICBwZXJpb2Q6IHJlYy5wZXJpb2QsXHJcbiAgICAgIHVwZGF0ZWRBdDogbm9ybWFsaXplVGltZXN0YW1wKHJlYy5jbGllbnRfdXBkYXRlZF9hdCksXHJcbiAgICAgIGRlbGV0ZWQ6ICEhcmVjLmRlbGV0ZWRfYXQsXHJcbiAgICAgIGRlbGV0ZWRBdDogcmVjLmRlbGV0ZWRfYXQgfHwgdW5kZWZpbmVkXHJcbiAgICB9KVxyXG4gIH0sXHJcbiAgc2Vzc2lvbnM6IHtcclxuICAgIHRvQ2xvdWQ6IChyZWMpID0+ICh7XHJcbiAgICAgIGlkOiByZWMuaWQsXHJcbiAgICAgIHRlYWNoaW5nX2lkOiByZWMudGVhY2hpbmdJZCxcclxuICAgICAgZGF0ZTogcmVjLmRhdGUsXHJcbiAgICAgIHBlcmlvZDogcmVjLnBlcmlvZCxcclxuICAgICAgc2xvdF9pZDogcmVjLnNsb3RJZCxcclxuICAgICAgc3RhcnRfdGltZTogcmVjLnN0YXJ0VGltZSB8fCBudWxsLFxyXG4gICAgICBlbmRfdGltZTogcmVjLmVuZFRpbWUgfHwgbnVsbCxcclxuICAgICAgdGltZV9wcm9maWxlX2lkOiByZWMudGltZVByb2ZpbGVJZCxcclxuICAgICAgc3RhdHVzOiByZWMuc3RhdHVzLFxyXG4gICAgICByZWFzb246IHJlYy5yZWFzb24sXHJcbiAgICAgIG1ha2V1cF9mb3JfaWQ6IHJlYy5tYWtldXBGb3JJZCxcclxuICAgICAgbGVzc29uX2lkOiByZWMubGVzc29uSWQsXHJcbiAgICAgIG5vdGU6IHJlYy5ub3RlLFxyXG4gICAgICBob21ld29yazogcmVjLmhvbWV3b3JrLFxyXG4gICAgICBjb3ZlcmVkOiByZWMuY292ZXJlZCxcclxuICAgICAgZGVsZXRlZF9hdDogcmVjLmRlbGV0ZWQgPyAocmVjLmRlbGV0ZWRBdCB8fCBuZXcgRGF0ZShyZWMudXBkYXRlZEF0KS50b0lTT1N0cmluZygpKSA6IG51bGwsXHJcbiAgICAgIGNsaWVudF91cGRhdGVkX2F0OiByZWMudXBkYXRlZEF0LFxyXG4gICAgICBkZXZpY2VfaWQ6IGdldERldmljZUlkKClcclxuICAgIH0pLFxyXG4gICAgZnJvbUNsb3VkOiAocmVjKSA9PiAoe1xyXG4gICAgICBpZDogcmVjLmlkLFxyXG4gICAgICB0ZWFjaGluZ0lkOiByZWMudGVhY2hpbmdfaWQsXHJcbiAgICAgIGRhdGU6IHJlYy5kYXRlLFxyXG4gICAgICBwZXJpb2Q6IHJlYy5wZXJpb2QsXHJcbiAgICAgIHNsb3RJZDogcmVjLnNsb3RfaWQsXHJcbiAgICAgIHN0YXJ0VGltZTogcmVjLnN0YXJ0X3RpbWUgfHwgJycsXHJcbiAgICAgIGVuZFRpbWU6IHJlYy5lbmRfdGltZSB8fCAnJyxcclxuICAgICAgdGltZVByb2ZpbGVJZDogcmVjLnRpbWVfcHJvZmlsZV9pZCxcclxuICAgICAgc3RhdHVzOiByZWMuc3RhdHVzLFxyXG4gICAgICByZWFzb246IHJlYy5yZWFzb24sXHJcbiAgICAgIG1ha2V1cEZvcklkOiByZWMubWFrZXVwX2Zvcl9pZCxcclxuICAgICAgbGVzc29uSWQ6IHJlYy5sZXNzb25faWQsXHJcbiAgICAgIG5vdGU6IHJlYy5ub3RlLFxyXG4gICAgICBob21ld29yazogcmVjLmhvbWV3b3JrLFxyXG4gICAgICBjb3ZlcmVkOiByZWMuY292ZXJlZCxcclxuICAgICAgdXBkYXRlZEF0OiBub3JtYWxpemVUaW1lc3RhbXAocmVjLmNsaWVudF91cGRhdGVkX2F0KSxcclxuICAgICAgZGVsZXRlZDogISFyZWMuZGVsZXRlZF9hdCxcclxuICAgICAgZGVsZXRlZEF0OiByZWMuZGVsZXRlZF9hdCB8fCB1bmRlZmluZWRcclxuICAgIH0pXHJcbiAgfSxcclxuICBhdHRlbmRhbmNlOiB7XHJcbiAgICB0b0Nsb3VkOiAocmVjKSA9PiAoe1xyXG4gICAgICBpZDogcmVjLmlkLFxyXG4gICAgICBzdHVkZW50X2lkOiByZWMuc3R1ZGVudElkLFxyXG4gICAgICBzZXNzaW9uX2lkOiByZWMuc2Vzc2lvbklkLFxyXG4gICAgICB0ZWFjaGluZ19pZDogcmVjLnRlYWNoaW5nSWQsXHJcbiAgICAgIGRhdGU6IHJlYy5kYXRlLFxyXG4gICAgICBzdGF0dXM6IHJlYy5zdGF0dXMsXHJcbiAgICAgIG5vdGU6IHJlYy5ub3RlLFxyXG4gICAgICBkZWxldGVkX2F0OiByZWMuZGVsZXRlZCA/IChyZWMuZGVsZXRlZEF0IHx8IG5ldyBEYXRlKHJlYy51cGRhdGVkQXQpLnRvSVNPU3RyaW5nKCkpIDogbnVsbCxcclxuICAgICAgY2xpZW50X3VwZGF0ZWRfYXQ6IHJlYy51cGRhdGVkQXQsXHJcbiAgICAgIGRldmljZV9pZDogZ2V0RGV2aWNlSWQoKVxyXG4gICAgfSksXHJcbiAgICBmcm9tQ2xvdWQ6IChyZWMpID0+ICh7XHJcbiAgICAgIGlkOiByZWMuaWQsXHJcbiAgICAgIHN0dWRlbnRJZDogcmVjLnN0dWRlbnRfaWQsXHJcbiAgICAgIHNlc3Npb25JZDogcmVjLnNlc3Npb25faWQsXHJcbiAgICAgIHRlYWNoaW5nSWQ6IHJlYy50ZWFjaGluZ19pZCxcclxuICAgICAgZGF0ZTogcmVjLmRhdGUsXHJcbiAgICAgIHN0YXR1czogcmVjLnN0YXR1cyxcclxuICAgICAgbm90ZTogcmVjLm5vdGUsXHJcbiAgICAgIHVwZGF0ZWRBdDogbm9ybWFsaXplVGltZXN0YW1wKHJlYy5jbGllbnRfdXBkYXRlZF9hdCksXHJcbiAgICAgIGRlbGV0ZWQ6ICEhcmVjLmRlbGV0ZWRfYXQsXHJcbiAgICAgIGRlbGV0ZWRBdDogcmVjLmRlbGV0ZWRfYXQgfHwgdW5kZWZpbmVkXHJcbiAgICB9KVxyXG4gIH1cclxufTtcclxuXHJcbi8qKlxyXG4gKiBDaGVja3MgaWYgYSBzdHJ1Y3R1cmFsIHJlY29yZCBpcyBhbiB1bm1vZGlmaWVkLCBhdXRvLWdlbmVyYXRlZCBib290IGRlZmF1bHQuXHJcbiAqL1xyXG5mdW5jdGlvbiBpc01lYW5pbmdmdWxTdHJ1Y3R1cmFsKHN0b3JlTmFtZSwgcmVjKSB7XHJcbiAgaWYgKHN0b3JlTmFtZSA9PT0gJ3llYXJzJykge1xyXG4gICAgcmV0dXJuICEocmVjLmhpanJpU3RhcnQgPT09IDE0NDggJiYgcmVjLmxhYmVsID09PSAnMTQ0OC0xNDQ5JyAmJiByZWMuc3RhdHVzID09PSAnYWN0aXZlJyk7XHJcbiAgfVxyXG4gIGlmIChzdG9yZU5hbWUgPT09ICd0ZXJtcycpIHtcclxuICAgIGNvbnN0IGlzRGVmYXVsdE5hbWUgPSByZWMubmFtZSA9PT0gYNin2YTZgdi12YQg2KfZhNiv2LHYp9iz2YogJHtbJycsICfYp9mE2KPZiNmEJywgJ9in2YTYq9in2YbZiicsICfYp9mE2KvYp9mE2KsnXVtyZWMuaW5kZXhdID8/IHJlYy5pbmRleH1gO1xyXG4gICAgcmV0dXJuICEoaXNEZWZhdWx0TmFtZSAmJiAhcmVjLnN0YXJ0RGF0ZSAmJiAhcmVjLmVuZERhdGUgJiYgKHJlYy5zdGF0dXMgPT09ICdhY3RpdmUnIHx8IHJlYy5zdGF0dXMgPT09ICd1cGNvbWluZycpKTtcclxuICB9XHJcbiAgaWYgKHN0b3JlTmFtZSA9PT0gJ3N1YmplY3RzJykge1xyXG4gICAgcmV0dXJuICEocmVjLm5hbWUgPT09ICfYp9mE2YXZh9in2LHYp9iqINin2YTYsdmC2YXZitipJyAmJiByZWMuc2x1ZyA9PT0gJ2RpZ2l0YWwtc2tpbGxzJyk7XHJcbiAgfVxyXG4gIGlmIChzdG9yZU5hbWUgPT09ICd0aW1lUHJvZmlsZXMnKSB7XHJcbiAgICByZXR1cm4gIURFRkFVTFRfVElNRV9QUk9GSUxFUy5zb21lKHAgPT4gcC5uYW1lID09PSByZWMubmFtZSk7XHJcbiAgfVxyXG4gIHJldHVybiB0cnVlOyAvLyBzZWN0aW9ucyBkbyBub3QgaGF2ZSBhdXRvLWdlbmVyYXRlZCBkZWZhdWx0c1xyXG59XHJcblxyXG4vKipcclxuICogU2NhbnMgbG9jYWwgc3RydWN0dXJhbCBkYXRhIHRvIGZpbmQgcGFyZW50IHJlY29yZHMgKGxpa2UgZGVmYXVsdCB5ZWFycylcclxuICogdGhhdCBtdXN0IGJlIHB1c2hlZCBiZWNhdXNlIHVzZXItY3JlYXRlZCBjaGlsZHJlbiBkZXBlbmQgb24gdGhlbS5cclxuICovXHJcbmZ1bmN0aW9uIGJ1aWxkTG9jYWxEZXBlbmRlbmNpZXMoc3RhdGUpIHtcclxuICBjb25zdCByZXEgPSB7IHllYXJzOiBuZXcgU2V0KCksIHRlcm1zOiBuZXcgU2V0KCksIHN1YmplY3RzOiBuZXcgU2V0KCksIHNlY3Rpb25zOiBuZXcgU2V0KCksIHRlYWNoaW5nczogbmV3IFNldCgpLCB0aW1lUHJvZmlsZXM6IG5ldyBTZXQoKSwgc2xvdHM6IG5ldyBTZXQoKSB9O1xyXG5cclxuICBmb3IgKGNvbnN0IHNlYyBvZiBzdGF0ZS5zZWN0aW9ucyB8fCBbXSkge1xyXG4gICAgaWYgKHNlYy55ZWFySWQgJiYgaXNNZWFuaW5nZnVsU3RydWN0dXJhbCgnc2VjdGlvbnMnLCBzZWMpKSB7XHJcbiAgICAgIHJlcS55ZWFycy5hZGQoc2VjLnllYXJJZCk7XHJcbiAgICB9XHJcbiAgfVxyXG4gIGZvciAoY29uc3QgdGVybSBvZiBzdGF0ZS50ZXJtcyB8fCBbXSkge1xyXG4gICAgaWYgKHRlcm0ueWVhcklkICYmIGlzTWVhbmluZ2Z1bFN0cnVjdHVyYWwoJ3Rlcm1zJywgdGVybSkpIHtcclxuICAgICAgcmVxLnllYXJzLmFkZCh0ZXJtLnllYXJJZCk7XHJcbiAgICB9XHJcbiAgfVxyXG4gIGZvciAoY29uc3QgdGNoIG9mIHN0YXRlLnRlYWNoaW5ncyB8fCBbXSkge1xyXG4gICAgaWYgKCF0Y2guZGVsZXRlZCkge1xyXG4gICAgICBpZiAodGNoLnNlY3Rpb25JZCkgcmVxLnNlY3Rpb25zLmFkZCh0Y2guc2VjdGlvbklkKTtcclxuICAgICAgaWYgKHRjaC5zdWJqZWN0SWQpIHJlcS5zdWJqZWN0cy5hZGQodGNoLnN1YmplY3RJZCk7XHJcbiAgICAgIGlmICh0Y2gudGVybUlkKSByZXEudGVybXMuYWRkKHRjaC50ZXJtSWQpO1xyXG4gICAgfVxyXG4gIH1cclxuICBmb3IgKGNvbnN0IHNsIG9mIHN0YXRlLnNsb3RzIHx8IFtdKSB7XHJcbiAgICBpZiAoIXNsLmRlbGV0ZWQpIHtcclxuICAgICAgaWYgKHNsLnRlYWNoaW5nSWQpIHJlcS50ZWFjaGluZ3MuYWRkKHNsLnRlYWNoaW5nSWQpO1xyXG4gICAgICBpZiAoc2wudGltZVByb2ZpbGVJZCkgcmVxLnRpbWVQcm9maWxlcy5hZGQoc2wudGltZVByb2ZpbGVJZCk7XHJcbiAgICB9XHJcbiAgfVxyXG4gIGZvciAoY29uc3Qgc2VzIG9mIHN0YXRlLnNlc3Npb25zIHx8IFtdKSB7XHJcbiAgICBpZiAoIXNlcy5kZWxldGVkKSB7XHJcbiAgICAgIGlmIChzZXMudGVhY2hpbmdJZCkgcmVxLnRlYWNoaW5ncy5hZGQoc2VzLnRlYWNoaW5nSWQpO1xyXG4gICAgICBpZiAoc2VzLnNsb3RJZCkgcmVxLnNsb3RzLmFkZChzZXMuc2xvdElkKTtcclxuICAgICAgaWYgKHNlcy50aW1lUHJvZmlsZUlkKSByZXEudGltZVByb2ZpbGVzLmFkZChzZXMudGltZVByb2ZpbGVJZCk7XHJcbiAgICB9XHJcbiAgfVxyXG4gIGZvciAoY29uc3QgYXR0IG9mIHN0YXRlLmF0dGVuZGFuY2UgfHwgW10pIHtcclxuICAgIGlmICghYXR0LmRlbGV0ZWQpIHtcclxuICAgICAgaWYgKGF0dC50ZWFjaGluZ0lkKSByZXEudGVhY2hpbmdzLmFkZChhdHQudGVhY2hpbmdJZCk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICByZXR1cm4gcmVxO1xyXG59XHJcblxyXG4vKipcclxuICogR2VuZXJpYyBzeW5jIGVuZ2luZSBmb3IgYSBzaW5nbGUgY29sbGVjdGlvbi5cclxuICogUHVsbCDihpIgTWVyZ2Ug4oaSIFB1c2hcclxuICovXHJcbmFzeW5jIGZ1bmN0aW9uIHN5bmNDb2xsZWN0aW9uKHN0b3JlTmFtZSwgdGFibGVOYW1lLCBjb250ZXh0ID0geyByZXF1aXJlZElkczogbmV3IFNldCgpLCBrbm93blJlbW90ZUlkczoge30gfSkge1xyXG4gIGNvbnN0IG1hcHBlciA9IE1BUFBFUlNbc3RvcmVOYW1lXTtcclxuICBpZiAoIW1hcHBlcikgdGhyb3cgbmV3IEVycm9yKGBObyBtYXBwZXIgZm9yICR7c3RvcmVOYW1lfWApO1xyXG5cclxuICBjb25zdCByZW1vdGVSZWNvcmRzID0gYXdhaXQgY2xvdWQuZmV0Y2hSZWNvcmRzKHRhYmxlTmFtZSk7XHJcbiAgY29uc3QgbG9jYWxSZWNvcmRzID0gc3RvcmUuc3RhdGVbc3RvcmVOYW1lXSB8fCBbXTtcclxuXHJcbiAgY29uc3QgcmVtb3RlQnlJZCA9IG5ldyBNYXAocmVtb3RlUmVjb3Jkcy5tYXAociA9PiBbci5pZCwgcl0pKTtcclxuICBjb25zdCBsb2NhbEJ5SWQgPSBuZXcgTWFwKGxvY2FsUmVjb3Jkcy5tYXAociA9PiBbci5pZCwgcl0pKTtcclxuXHJcbiAgY29uc3QgYWxsSWRzID0gbmV3IFNldChbLi4ucmVtb3RlQnlJZC5rZXlzKCksIC4uLmxvY2FsQnlJZC5rZXlzKCldKTtcclxuXHJcbiAgY29uc3QgdG9QdXNoID0gW107XHJcbiAgY29uc3QgdG9VcGRhdGVMb2NhbCA9IFtdO1xyXG5cclxuICBmb3IgKGNvbnN0IGlkIG9mIGFsbElkcykge1xyXG4gICAgY29uc3QgcmVtb3RlID0gcmVtb3RlQnlJZC5nZXQoaWQpO1xyXG4gICAgY29uc3QgbG9jYWwgPSBsb2NhbEJ5SWQuZ2V0KGlkKTtcclxuXHJcbiAgICBpZiAoIXJlbW90ZSkge1xyXG4gICAgICAvLyBSZW1vdGUgZG9lcyBub3QgZXhpc3QuXHJcbiAgICAgIC8vIFdlIHB1c2ggaWYgdGhlIGxvY2FsIHJlY29yZCBpcyBtZWFuaW5nZnVsIE9SIGlmIGl0IGlzIGV4cGxpY2l0bHkgcmVxdWlyZWQgYnkgYSBjaGlsZC5cclxuICAgICAgaWYgKGlzTWVhbmluZ2Z1bFN0cnVjdHVyYWwoc3RvcmVOYW1lLCBsb2NhbCkgfHwgY29udGV4dC5yZXF1aXJlZElkcy5oYXMobG9jYWwuaWQpKSB7XHJcbiAgICAgICAgdG9QdXNoLnB1c2gobWFwcGVyLnRvQ2xvdWQobG9jYWwpKTtcclxuICAgICAgfVxyXG4gICAgfSBlbHNlIGlmICghbG9jYWwpIHtcclxuICAgICAgLy8gTG9jYWwgZG9lcyBub3QgZXhpc3QsIHNvIGl0IHdhcyBjcmVhdGVkIG9uIGFub3RoZXIgZGV2aWNlLlxyXG4gICAgICAvLyBXZSBwdWxsIGl0IGRvd24uXHJcbiAgICAgIHRvVXBkYXRlTG9jYWwucHVzaChtYXBwZXIuZnJvbUNsb3VkKHJlbW90ZSkpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgLy8gQm90aCBleGlzdC4gQ29tcGFyZSB0aW1lc3RhbXBzLlxyXG4gICAgICBjb25zdCByZW1vdGVDbGllbnRVcGRhdGVkQXQgPSBub3JtYWxpemVUaW1lc3RhbXAocmVtb3RlLmNsaWVudF91cGRhdGVkX2F0KTtcclxuICAgICAgY29uc3QgbG9jYWxVcGRhdGVkQXQgPSBub3JtYWxpemVUaW1lc3RhbXAobG9jYWwudXBkYXRlZEF0KTtcclxuICAgICAgY29uc3QgaXNTdHJ1Y3R1cmFsID0gc3RvcmVOYW1lID09PSAneWVhcnMnIHx8IHN0b3JlTmFtZSA9PT0gJ3Rlcm1zJyB8fCBzdG9yZU5hbWUgPT09ICdzdWJqZWN0cyc7XHJcblxyXG4gICAgICBpZiAobG9jYWxVcGRhdGVkQXQgPT09IHJlbW90ZUNsaWVudFVwZGF0ZWRBdCkge1xyXG4gICAgICAgIC8vIENvbnZlcmdlZCwgZG8gbm90aGluZy5cclxuICAgICAgfSBlbHNlIGlmIChpc1N0cnVjdHVyYWwgJiYgIWlzTWVhbmluZ2Z1bFN0cnVjdHVyYWwoc3RvcmVOYW1lLCBsb2NhbCkgJiYgbG9jYWxVcGRhdGVkQXQgPiByZW1vdGVDbGllbnRVcGRhdGVkQXQpIHtcclxuICAgICAgICAvLyBMb2NhbCBpcyBhIGdlbmVyYXRlZCBkZWZhdWx0LCBhbmQgcmVtb3RlIGFscmVhZHkgaGFzIHRoaXMgZXhhY3QgSUQuXHJcbiAgICAgICAgLy8gRXZlbiB0aG91Z2ggbG9jYWwgaXMgc3RyaWN0bHkgbmV3ZXIgKGR1ZSB0byBiZWluZyBmcmVzaGx5IGdlbmVyYXRlZCksXHJcbiAgICAgICAgLy8gcmVtb3RlIG11c3QgYmUgYXV0aG9yaXRhdGl2ZSBmb3IgdGhpcyBzeW5jIGN5Y2xlLiBIeWRyYXRlIGxvY2FsLlxyXG4gICAgICAgIHRvVXBkYXRlTG9jYWwucHVzaChtYXBwZXIuZnJvbUNsb3VkKHJlbW90ZSkpO1xyXG4gICAgICB9IGVsc2UgaWYgKGxvY2FsVXBkYXRlZEF0ID4gcmVtb3RlQ2xpZW50VXBkYXRlZEF0KSB7XHJcbiAgICAgICAgLy8gTG9jYWwgaXMgc3RyaWN0bHkgbmV3ZXIuXHJcbiAgICAgICAgdG9QdXNoLnB1c2gobWFwcGVyLnRvQ2xvdWQobG9jYWwpKTtcclxuICAgICAgfSBlbHNlIGlmIChyZW1vdGVDbGllbnRVcGRhdGVkQXQgPiBsb2NhbFVwZGF0ZWRBdCkge1xyXG4gICAgICAgIC8vIFJlbW90ZSBpcyBzdHJpY3RseSBuZXdlci5cclxuICAgICAgICB0b1VwZGF0ZUxvY2FsLnB1c2gobWFwcGVyLmZyb21DbG91ZChyZW1vdGUpKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLy8gLS0gUkVDT05DSUxJQVRJT04gT0YgRlJFU0gtREVWSUNFIERFRkFVTFRTIC0tXHJcbiAgLy8gRm9yIHllYXJzLCB0ZXJtcywgc3ViamVjdHM6IGlmIGEgbG9jYWwgcmVjb3JkIGlzIGFuIHVubW9kaWZpZWQgYXV0by1nZW5lcmF0ZWQgZGVmYXVsdCxcclxuICAvLyB3ZSBjaGVjayBpZiBhIGxvZ2ljYWxseSBlcXVpdmFsZW50IHJlY29yZCBleGlzdHMgcmVtb3RlbHkuIElmIHllcywgd2UgYWRvcHQgdGhlIHJlbW90ZSBJRFxyXG4gIC8vIGxvY2FsbHkgdG8gcHJldmVudCBkdXBsaWNhdGVzIGFuZCBzY29waW5nIGJ1Z3Mgb24gZnJlc2ggZGV2aWNlcy5cclxuICBjb25zdCByZW1hcHBlZExvY2FscyA9IG5ldyBNYXAoKTsgLy8gb2xkSWQgLT4gbmV3SWRcclxuXHJcbiAgLy8gRGV0ZXJtaW5pc3RpY2FsbHkgc29ydCByZW1vdGUgcmVjb3JkcyB0byBhbHdheXMgcGljayB0aGUgb2xkZXN0IChvcmlnaW5hbCkgZGVmYXVsdCBpZiBkdXBsaWNhdGVzIGV4aXN0XHJcbiAgY29uc3Qgc29ydGVkUmVtb3RlcyA9IFsuLi5yZW1vdGVSZWNvcmRzXS5zb3J0KChhLCBiKSA9PiB7XHJcbiAgICBjb25zdCB0aW1lQSA9IG5ldyBEYXRlKGEuY3JlYXRlZF9hdCB8fCBhLmNsaWVudF91cGRhdGVkX2F0KS5nZXRUaW1lKCk7XHJcbiAgICBjb25zdCB0aW1lQiA9IG5ldyBEYXRlKGIuY3JlYXRlZF9hdCB8fCBiLmNsaWVudF91cGRhdGVkX2F0KS5nZXRUaW1lKCk7XHJcbiAgICByZXR1cm4gdGltZUEgLSB0aW1lQjtcclxuICB9KTtcclxuXHJcbiAgaWYgKHN0b3JlTmFtZSA9PT0gJ3llYXJzJykge1xyXG4gICAgZm9yIChjb25zdCBsb2NhbCBvZiBsb2NhbFJlY29yZHMpIHtcclxuICAgICAgaWYgKCFpc01lYW5pbmdmdWxTdHJ1Y3R1cmFsKCd5ZWFycycsIGxvY2FsKSkge1xyXG4gICAgICAgIGNvbnN0IGVxdWl2ID0gc29ydGVkUmVtb3Rlcy5maW5kKHIgPT4gci5oaWpyaV9zdGFydCA9PT0gbG9jYWwuaGlqcmlTdGFydCk7XHJcbiAgICAgICAgaWYgKGVxdWl2ICYmIGVxdWl2LmlkICE9PSBsb2NhbC5pZCkgcmVtYXBwZWRMb2NhbHMuc2V0KGxvY2FsLmlkLCBlcXVpdi5pZCk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICB9IGVsc2UgaWYgKHN0b3JlTmFtZSA9PT0gJ3Rlcm1zJykge1xyXG4gICAgZm9yIChjb25zdCBsb2NhbCBvZiBsb2NhbFJlY29yZHMpIHtcclxuICAgICAgaWYgKCFpc01lYW5pbmdmdWxTdHJ1Y3R1cmFsKCd0ZXJtcycsIGxvY2FsKSkge1xyXG4gICAgICAgIGNvbnN0IGVxdWl2ID0gc29ydGVkUmVtb3Rlcy5maW5kKHIgPT4gci55ZWFyX2lkID09PSBsb2NhbC55ZWFySWQgJiYgci5pbmRleCA9PT0gbG9jYWwuaW5kZXgpO1xyXG4gICAgICAgIGlmIChlcXVpdiAmJiBlcXVpdi5pZCAhPT0gbG9jYWwuaWQpIHJlbWFwcGVkTG9jYWxzLnNldChsb2NhbC5pZCwgZXF1aXYuaWQpO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfSBlbHNlIGlmIChzdG9yZU5hbWUgPT09ICdzdWJqZWN0cycpIHtcclxuICAgIGZvciAoY29uc3QgbG9jYWwgb2YgbG9jYWxSZWNvcmRzKSB7XHJcbiAgICAgIGlmICghaXNNZWFuaW5nZnVsU3RydWN0dXJhbCgnc3ViamVjdHMnLCBsb2NhbCkpIHtcclxuICAgICAgICBjb25zdCBlcXVpdiA9IHNvcnRlZFJlbW90ZXMuZmluZChyID0+IHIuc2x1ZyA9PT0gbG9jYWwuc2x1Zyk7XHJcbiAgICAgICAgaWYgKGVxdWl2ICYmIGVxdWl2LmlkICE9PSBsb2NhbC5pZCkgcmVtYXBwZWRMb2NhbHMuc2V0KGxvY2FsLmlkLCBlcXVpdi5pZCk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICB9IGVsc2UgaWYgKHN0b3JlTmFtZSA9PT0gJ3RpbWVQcm9maWxlcycpIHtcclxuICAgIGZvciAoY29uc3QgbG9jYWwgb2YgbG9jYWxSZWNvcmRzKSB7XHJcbiAgICAgIGlmICghaXNNZWFuaW5nZnVsU3RydWN0dXJhbCgndGltZVByb2ZpbGVzJywgbG9jYWwpKSB7XHJcbiAgICAgICAgY29uc3QgZXF1aXYgPSBzb3J0ZWRSZW1vdGVzLmZpbmQociA9PiByLm5hbWUgPT09IGxvY2FsLm5hbWUpO1xyXG4gICAgICAgIGlmIChlcXVpdiAmJiBlcXVpdi5pZCAhPT0gbG9jYWwuaWQpIHJlbWFwcGVkTG9jYWxzLnNldChsb2NhbC5pZCwgZXF1aXYuaWQpO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBpZiAocmVtYXBwZWRMb2NhbHMuc2l6ZSA+IDApIHtcclxuICAgIGNvbnNvbGUubG9nKGBbcmFrZWV6eCBzeW5jXSBSZW1hcHBpbmcgJHtzdG9yZU5hbWV9IGlkZW50aXRpZXM6YCwgcmVtYXBwZWRMb2NhbHMpO1xyXG5cclxuICAgIC8vIENlbnRyYWxpemVkIFJlZmVyZW5jZS1SZW1hcCBIZWxwZXIgdG8gZ3VhcmFudGVlIGZ1bGwgY292ZXJhZ2Ugd2l0aG91dCBwYXJ0aWFsIGhhcmRjb2RpbmdcclxuICAgIGNvbnN0IGJ1aWxkQ2FzY2FkZVBhdGNoID0gKG9sZElkLCBuZXdJZCwgZW50aXR5VHlwZSkgPT4ge1xyXG4gICAgICBjb25zdCBwID0ge307XHJcbiAgICAgIGNvbnN0IHVwZGF0ZVN0b3JlID0gKHNOYW1lLCBma0ZpZWxkKSA9PiB7XHJcbiAgICAgICAgZm9yIChjb25zdCByZWMgb2Ygc3RvcmUuc3RhdGVbc05hbWVdIHx8IFtdKSB7XHJcbiAgICAgICAgICBpZiAocmVjW2ZrRmllbGRdID09PSBvbGRJZCkge1xyXG4gICAgICAgICAgICBwW3NOYW1lXSA/Pz0gW107XHJcbiAgICAgICAgICAgIHBbc05hbWVdLnB1c2goeyAuLi5yZWMsIFtma0ZpZWxkXTogbmV3SWQgfSk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICB9O1xyXG5cclxuICAgICAgaWYgKGVudGl0eVR5cGUgPT09ICd5ZWFycycpIHtcclxuICAgICAgICBpZiAoc3RvcmUuc3RhdGUuZGV2aWNlPy5hY3RpdmVZZWFySWQgPT09IG9sZElkKSBwLmRldmljZSA9IHsgLi4uc3RvcmUuc3RhdGUuZGV2aWNlLCBhY3RpdmVZZWFySWQ6IG5ld0lkIH07XHJcbiAgICAgICAgdXBkYXRlU3RvcmUoJ3Rlcm1zJywgJ3llYXJJZCcpO1xyXG4gICAgICAgIHVwZGF0ZVN0b3JlKCdzZWN0aW9ucycsICd5ZWFySWQnKTtcclxuICAgICAgICB1cGRhdGVTdG9yZSgnY2FsZW5kYXJzJywgJ3llYXJJZCcpO1xyXG4gICAgICB9IGVsc2UgaWYgKGVudGl0eVR5cGUgPT09ICd0ZXJtcycpIHtcclxuICAgICAgICBpZiAoc3RvcmUuc3RhdGUuZGV2aWNlPy5hY3RpdmVUZXJtSWQgPT09IG9sZElkKSBwLmRldmljZSA9IHsgLi4uc3RvcmUuc3RhdGUuZGV2aWNlLCBhY3RpdmVUZXJtSWQ6IG5ld0lkIH07XHJcbiAgICAgICAgdXBkYXRlU3RvcmUoJ3RlYWNoaW5ncycsICd0ZXJtSWQnKTtcclxuICAgICAgfSBlbHNlIGlmIChlbnRpdHlUeXBlID09PSAnc3ViamVjdHMnKSB7XHJcbiAgICAgICAgdXBkYXRlU3RvcmUoJ3RlYWNoaW5ncycsICdzdWJqZWN0SWQnKTtcclxuICAgICAgICB1cGRhdGVTdG9yZSgndW5pdHMnLCAnc3ViamVjdElkJyk7XHJcbiAgICAgIH0gZWxzZSBpZiAoZW50aXR5VHlwZSA9PT0gJ3NlY3Rpb25zJykge1xyXG4gICAgICAgIC8vIFByb3ZpZGVkIGZvciBjb21wbGV0ZW5lc3MsIHRob3VnaCBzZWN0aW9ucyBhcmUgbm90IGN1cnJlbnRseSByZWNvbmNpbGVkXHJcbiAgICAgICAgdXBkYXRlU3RvcmUoJ3RlYWNoaW5ncycsICdzZWN0aW9uSWQnKTtcclxuICAgICAgICB1cGRhdGVTdG9yZSgnZW5yb2xsbWVudHMnLCAnc2VjdGlvbklkJyk7XHJcbiAgICAgIH0gZWxzZSBpZiAoZW50aXR5VHlwZSA9PT0gJ3RpbWVQcm9maWxlcycpIHtcclxuICAgICAgICBpZiAoc3RvcmUuc3RhdGUuZGV2aWNlPy5hY3RpdmVUaW1lUHJvZmlsZUlkID09PSBvbGRJZCkgcC5kZXZpY2UgPSB7IC4uLnN0b3JlLnN0YXRlLmRldmljZSwgYWN0aXZlVGltZVByb2ZpbGVJZDogbmV3SWQgfTtcclxuICAgICAgICB1cGRhdGVTdG9yZSgnc2Vzc2lvbnMnLCAndGltZVByb2ZpbGVJZCcpO1xyXG4gICAgICB9XHJcbiAgICAgIHJldHVybiBwO1xyXG4gICAgfTtcclxuXHJcbiAgICBjb25zdCBwYXRjaCA9IHsgW3N0b3JlTmFtZV06IFtdIH07XHJcbiAgICBjb25zdCBkZXZpY2VQYXRjaCA9IHt9O1xyXG5cclxuICAgIC8vIDEuIFJld3JpdGUgbG9jYWwgaWRlbnRpdGllcyBpbiBtZW1vcnkgYXJyYXlzL21hcHMgYW5kIGh5ZHJhdGUgZnJvbSByZW1vdGVcclxuICAgIGZvciAoY29uc3QgW29sZElkLCBuZXdJZF0gb2YgcmVtYXBwZWRMb2NhbHMuZW50cmllcygpKSB7XHJcbiAgICAgIGNvbnN0IGxSZWMgPSBsb2NhbEJ5SWQuZ2V0KG9sZElkKTtcclxuICAgICAgY29uc3QgcmVtb3RlRXF1aXYgPSByZW1vdGVSZWNvcmRzLmZpbmQociA9PiByLmlkID09PSBuZXdJZCk7XHJcblxyXG4gICAgICAvLyBIeWRyYXRlIGxvY2FsIHJlY29yZCB3aXRoIHJlbW90ZSBjYW5vbmljYWwgdmFsdWVzXHJcbiAgICAgIGNvbnN0IGh5ZHJhdGVkID0ge1xyXG4gICAgICAgIC4uLmxSZWMsXHJcbiAgICAgICAgLi4ubWFwcGVyLmZyb21DbG91ZChyZW1vdGVFcXVpdiksXHJcbiAgICAgICAgaWQ6IG5ld0lkXHJcbiAgICAgIH07XHJcblxyXG4gICAgICBsb2NhbEJ5SWQuZGVsZXRlKG9sZElkKTtcclxuICAgICAgbG9jYWxCeUlkLnNldChuZXdJZCwgaHlkcmF0ZWQpO1xyXG4gICAgICBhbGxJZHMuZGVsZXRlKG9sZElkKTtcclxuICAgICAgYWxsSWRzLmFkZChuZXdJZCk7XHJcblxyXG4gICAgICAvLyAyLiBDYXNjYWRlIGNoYW5nZXMgdG8gZGVwZW5kZW50IGxvY2FsIHN0YXRlXHJcbiAgICAgIGNvbnN0IGNhc2NhZGUgPSBidWlsZENhc2NhZGVQYXRjaChvbGRJZCwgbmV3SWQsIHN0b3JlTmFtZSk7XHJcbiAgICAgIGlmIChjYXNjYWRlLmRldmljZSkgT2JqZWN0LmFzc2lnbihkZXZpY2VQYXRjaCwgY2FzY2FkZS5kZXZpY2UpO1xyXG4gICAgICBmb3IgKGNvbnN0IHNOYW1lIG9mIE9iamVjdC5rZXlzKGNhc2NhZGUpKSB7XHJcbiAgICAgICAgaWYgKHNOYW1lID09PSAnZGV2aWNlJykgY29udGludWU7XHJcbiAgICAgICAgcGF0Y2hbc05hbWVdID8/PSBbXTtcclxuICAgICAgICBmb3IgKGNvbnN0IG1vZCBvZiBjYXNjYWRlW3NOYW1lXSkge1xyXG4gICAgICAgICAgY29uc3QgaWR4ID0gcGF0Y2hbc05hbWVdLmZpbmRJbmRleChyID0+IHIuaWQgPT09IG1vZC5pZCk7XHJcbiAgICAgICAgICBpZiAoaWR4ICE9PSAtMSkgcGF0Y2hbc05hbWVdW2lkeF0gPSB7IC4uLnBhdGNoW3NOYW1lXVtpZHhdLCAuLi5tb2QgfTtcclxuICAgICAgICAgIGVsc2UgcGF0Y2hbc05hbWVdLnB1c2gobW9kKTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIC8vIE1hcmsgb2xkIGFzIGRlbGV0ZWQgYW5kIHNhdmUgbmV3IChoeWRyYXRlZCkgaW1tZWRpYXRlbHkuXHJcbiAgICAgIHBhdGNoW3N0b3JlTmFtZV0ucHVzaCh7IGlkOiBvbGRJZCwgZGVsZXRlZDogdHJ1ZSwgZGVsZXRlZEF0OiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCkgfSk7XHJcbiAgICAgIHBhdGNoW3N0b3JlTmFtZV0ucHVzaChoeWRyYXRlZCk7XHJcblxyXG4gICAgICAvLyBQcmV2ZW50IGl0IGZyb20gYmVpbmcgcHVzaGVkIHVuZGVyIHRoZSBvbGQgSUQgaWYgaXQgc29tZWhvdyBnb3QgcXVldWVkXHJcbiAgICAgIGNvbnN0IHB1c2hJZHggPSB0b1B1c2guZmluZEluZGV4KHAgPT4gcC5pZCA9PT0gb2xkSWQpO1xyXG4gICAgICBpZiAocHVzaElkeCAhPT0gLTEpIHRvUHVzaC5zcGxpY2UocHVzaElkeCwgMSk7XHJcblxyXG4gICAgICAvLyBTaW5jZSB3ZSBqdXN0IGFkb3B0ZWQgdGhlIHJlbW90ZSByZWNvcmQncyBleGFjdCB0aW1lc3RhbXAgYW5kIGlkZW50aXR5LFxyXG4gICAgICAvLyB3ZSBtdXN0IE5PVCBwdXNoIGl0IGJhY2sgYXMgYSBsb2NhbCBlZGl0LiBJdCBpcyBmdWxseSBjb252ZXJnZWQuXHJcbiAgICAgIC8vIFJlbW92ZSBpdCBmcm9tIGFueSB0b1B1c2ggdGhhdCBtaWdodCBoYXZlIHF1ZXVlZCBpdCB1bmRlciBuZXdJZC5cclxuICAgICAgY29uc3QgbmV3UHVzaElkeCA9IHRvUHVzaC5maW5kSW5kZXgocCA9PiBwLmlkID09PSBuZXdJZCk7XHJcbiAgICAgIGlmIChuZXdQdXNoSWR4ICE9PSAtMSkgdG9QdXNoLnNwbGljZShuZXdQdXNoSWR4LCAxKTtcclxuICAgIH1cclxuXHJcbiAgICAgIGlmIChPYmplY3Qua2V5cyhkZXZpY2VQYXRjaCkubGVuZ3RoID4gMCkge1xyXG4gICAgICAgIGNvbnN0IG9rID0gYXdhaXQgc3RvcmUucGF0Y2hEZXZpY2UoeyAuLi5zdG9yZS5zdGF0ZS5kZXZpY2UsIC4uLmRldmljZVBhdGNoIH0pO1xyXG4gICAgICAgIGlmICghb2spIHRocm93IG5ldyBFcnJvcihgJHtzdG9yZU5hbWV9IGRlZmF1bHRzOiBkZXZpY2UgcGVyc2lzdGVuY2UgZmFpbGVkYCk7XHJcbiAgICAgIH1cclxuICAgICAgY29uc3Qgb2syID0gYXdhaXQgc3RvcmUuc2F2ZShwYXRjaCk7XHJcbiAgICAgIGlmICghb2syKSB0aHJvdyBuZXcgRXJyb3IoYCR7c3RvcmVOYW1lfSBkZWZhdWx0czogbG9jYWwgcGVyc2lzdGVuY2UgZmFpbGVkYCk7XHJcbiAgfVxyXG5cclxuICAvLyBEZXBlbmRlbmN5IHZhbGlkYXRpb24gYmVmb3JlIHB1c2hcclxuICBpZiAoc3RvcmVOYW1lID09PSAndGVybXMnIHx8IHN0b3JlTmFtZSA9PT0gJ3NlY3Rpb25zJykge1xyXG4gICAgZm9yIChjb25zdCBwIG9mIHRvUHVzaCkge1xyXG4gICAgICBpZiAocC55ZWFyX2lkICYmICFjb250ZXh0Lmtub3duUmVtb3RlSWRzPy55ZWFycz8uaGFzKHAueWVhcl9pZCkpIHtcclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYCR7c3RvcmVOYW1lfTogbWlzc2luZyByZW1vdGUgeWVhciAke3AueWVhcl9pZH1gKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH1cclxuICBpZiAoc3RvcmVOYW1lID09PSAndGVhY2hpbmdzJykge1xyXG4gICAgZm9yIChjb25zdCBwIG9mIHRvUHVzaCkge1xyXG4gICAgICBpZiAocC5zZWN0aW9uX2lkICYmICFjb250ZXh0Lmtub3duUmVtb3RlSWRzPy5zZWN0aW9ucz8uaGFzKHAuc2VjdGlvbl9pZCkpIHtcclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYCR7c3RvcmVOYW1lfTogbWlzc2luZyByZW1vdGUgc2VjdGlvbiAke3Auc2VjdGlvbl9pZH1gKTtcclxuICAgICAgfVxyXG4gICAgICBpZiAocC5zdWJqZWN0X2lkICYmICFjb250ZXh0Lmtub3duUmVtb3RlSWRzPy5zdWJqZWN0cz8uaGFzKHAuc3ViamVjdF9pZCkpIHtcclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYCR7c3RvcmVOYW1lfTogbWlzc2luZyByZW1vdGUgc3ViamVjdCAke3Auc3ViamVjdF9pZH1gKTtcclxuICAgICAgfVxyXG4gICAgICBpZiAocC50ZXJtX2lkICYmICFjb250ZXh0Lmtub3duUmVtb3RlSWRzPy50ZXJtcz8uaGFzKHAudGVybV9pZCkpIHtcclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYCR7c3RvcmVOYW1lfTogbWlzc2luZyByZW1vdGUgdGVybSAke3AudGVybV9pZH1gKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgaWYgKHN0b3JlTmFtZSA9PT0gJ2Vucm9sbG1lbnRzJykge1xyXG4gICAgZm9yIChjb25zdCBwIG9mIHRvUHVzaCkge1xyXG4gICAgICBpZiAocC5zdHVkZW50X2lkICYmICFjb250ZXh0Lmtub3duUmVtb3RlSWRzPy5zdHVkZW50cz8uaGFzKHAuc3R1ZGVudF9pZCkpIHtcclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYCR7c3RvcmVOYW1lfTogbWlzc2luZyByZW1vdGUgc3R1ZGVudCAke3Auc3R1ZGVudF9pZH1gKTtcclxuICAgICAgfVxyXG4gICAgICBpZiAocC5zZWN0aW9uX2lkICYmICFjb250ZXh0Lmtub3duUmVtb3RlSWRzPy5zZWN0aW9ucz8uaGFzKHAuc2VjdGlvbl9pZCkpIHtcclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYCR7c3RvcmVOYW1lfTogbWlzc2luZyByZW1vdGUgc2VjdGlvbiAke3Auc2VjdGlvbl9pZH1gKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgaWYgKHN0b3JlTmFtZSA9PT0gJ2l0ZW1zJykge1xyXG4gICAgZm9yIChjb25zdCBwIG9mIHRvUHVzaCkge1xyXG4gICAgICBpZiAocC50ZWFjaGluZ19pZCAmJiAhY29udGV4dC5rbm93blJlbW90ZUlkcz8udGVhY2hpbmdzPy5oYXMocC50ZWFjaGluZ19pZCkpIHtcclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYCR7c3RvcmVOYW1lfTogbWlzc2luZyByZW1vdGUgdGVhY2hpbmcgJHtwLnRlYWNoaW5nX2lkfWApO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBpZiAoc3RvcmVOYW1lID09PSAnc2NvcmVzJykge1xyXG4gICAgZm9yIChjb25zdCBwIG9mIHRvUHVzaCkge1xyXG4gICAgICBpZiAocC5zdHVkZW50X2lkICYmICFjb250ZXh0Lmtub3duUmVtb3RlSWRzPy5zdHVkZW50cz8uaGFzKHAuc3R1ZGVudF9pZCkpIHtcclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYCR7c3RvcmVOYW1lfTogbWlzc2luZyByZW1vdGUgc3R1ZGVudCAke3Auc3R1ZGVudF9pZH1gKTtcclxuICAgICAgfVxyXG4gICAgICBpZiAocC5pdGVtX2lkICYmICFjb250ZXh0Lmtub3duUmVtb3RlSWRzPy5pdGVtcz8uaGFzKHAuaXRlbV9pZCkpIHtcclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYCR7c3RvcmVOYW1lfTogbWlzc2luZyByZW1vdGUgaXRlbSAke3AuaXRlbV9pZH1gKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgaWYgKHN0b3JlTmFtZSA9PT0gJ3Nsb3RzJykge1xyXG4gICAgZm9yIChjb25zdCBwIG9mIHRvUHVzaCkge1xyXG4gICAgICBpZiAocC50ZWFjaGluZ19pZCAmJiAhY29udGV4dC5rbm93blJlbW90ZUlkcz8udGVhY2hpbmdzPy5oYXMocC50ZWFjaGluZ19pZCkpIHtcclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYCR7c3RvcmVOYW1lfTogbWlzc2luZyByZW1vdGUgdGVhY2hpbmcgJHtwLnRlYWNoaW5nX2lkfWApO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBpZiAoc3RvcmVOYW1lID09PSAnc2Vzc2lvbnMnKSB7XHJcbiAgICBmb3IgKGNvbnN0IHAgb2YgdG9QdXNoKSB7XHJcbiAgICAgIGlmIChwLnRlYWNoaW5nX2lkICYmICFjb250ZXh0Lmtub3duUmVtb3RlSWRzPy50ZWFjaGluZ3M/LmhhcyhwLnRlYWNoaW5nX2lkKSkge1xyXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgJHtzdG9yZU5hbWV9OiBtaXNzaW5nIHJlbW90ZSB0ZWFjaGluZyAke3AudGVhY2hpbmdfaWR9YCk7XHJcbiAgICAgIH1cclxuICAgICAgaWYgKHAuc2xvdF9pZCAmJiAhY29udGV4dC5rbm93blJlbW90ZUlkcz8uc2xvdHM/LmhhcyhwLnNsb3RfaWQpKSB7XHJcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGAke3N0b3JlTmFtZX06IG1pc3NpbmcgcmVtb3RlIHNsb3QgJHtwLnNsb3RfaWR9YCk7XHJcbiAgICAgIH1cclxuICAgICAgaWYgKHAudGltZV9wcm9maWxlX2lkICYmICFjb250ZXh0Lmtub3duUmVtb3RlSWRzPy50aW1lUHJvZmlsZXM/LmhhcyhwLnRpbWVfcHJvZmlsZV9pZCkpIHtcclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYCR7c3RvcmVOYW1lfTogbWlzc2luZyByZW1vdGUgdGltZVByb2ZpbGUgJHtwLnRpbWVfcHJvZmlsZV9pZH1gKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IHRvUHVzaE1hcCA9IG5ldyBNYXAodG9QdXNoLm1hcChwID0+IFtwLmlkLCBwXSkpO1xyXG4gICAgY29uc3Qgc29ydGVkID0gW107XHJcbiAgICBjb25zdCB2aXNpdGVkID0gbmV3IFNldCgpO1xyXG4gICAgY29uc3QgdmlzaXRpbmcgPSBuZXcgU2V0KCk7XHJcblxyXG4gICAgZnVuY3Rpb24gdmlzaXQocCkge1xyXG4gICAgICBpZiAodmlzaXRlZC5oYXMocC5pZCkpIHJldHVybjtcclxuICAgICAgaWYgKHZpc2l0aW5nLmhhcyhwLmlkKSkge1xyXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgc2Vzc2lvbnM6IGN5Y2xlIGRldGVjdGVkIGluIG1ha2V1cF9mb3JfaWQgZGVwZW5kZW5jeSBmb3IgJHtwLmlkfWApO1xyXG4gICAgICB9XHJcbiAgICAgIHZpc2l0aW5nLmFkZChwLmlkKTtcclxuXHJcbiAgICAgIGlmIChwLm1ha2V1cF9mb3JfaWQgJiYgIXJlbW90ZUJ5SWQuaGFzKHAubWFrZXVwX2Zvcl9pZCkpIHtcclxuICAgICAgICBjb25zdCBwYXJlbnQgPSB0b1B1c2hNYXAuZ2V0KHAubWFrZXVwX2Zvcl9pZCk7XHJcbiAgICAgICAgaWYgKCFwYXJlbnQpIHtcclxuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgc2Vzc2lvbnM6IG1pc3NpbmcgbWFrZXVwIHBhcmVudCAke3AubWFrZXVwX2Zvcl9pZH1gKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgdmlzaXQocGFyZW50KTtcclxuICAgICAgfVxyXG5cclxuICAgICAgdmlzaXRpbmcuZGVsZXRlKHAuaWQpO1xyXG4gICAgICB2aXNpdGVkLmFkZChwLmlkKTtcclxuICAgICAgc29ydGVkLnB1c2gocCk7XHJcbiAgICB9XHJcblxyXG4gICAgLy8gQmFzZSBzb3J0IGZvciBzdGFibGUgb3JkZXJpbmcgYmVmb3JlIGRlcGVuZGVuY3kgcmVzb2x1dGlvblxyXG4gICAgdG9QdXNoLnNvcnQoKGEsIGIpID0+IChhLmRhdGUgPCBiLmRhdGUgPyAtMSA6IGEuZGF0ZSA+IGIuZGF0ZSA/IDEgOiBhLnBlcmlvZCAtIGIucGVyaW9kKSk7XHJcblxyXG4gICAgZm9yIChjb25zdCBwIG9mIHRvUHVzaCkge1xyXG4gICAgICB2aXNpdChwKTtcclxuICAgIH1cclxuXHJcbiAgICB0b1B1c2gubGVuZ3RoID0gMDtcclxuICAgIHRvUHVzaC5wdXNoKC4uLnNvcnRlZCk7XHJcbiAgfVxyXG5cclxuICBpZiAoc3RvcmVOYW1lID09PSAnYXR0ZW5kYW5jZScpIHtcclxuICAgIGZvciAoY29uc3QgcCBvZiB0b1B1c2gpIHtcclxuICAgICAgaWYgKHAuc3R1ZGVudF9pZCAmJiAhY29udGV4dC5rbm93blJlbW90ZUlkcz8uc3R1ZGVudHM/LmhhcyhwLnN0dWRlbnRfaWQpKSB7XHJcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGAke3N0b3JlTmFtZX06IG1pc3NpbmcgcmVtb3RlIHN0dWRlbnQgJHtwLnN0dWRlbnRfaWR9YCk7XHJcbiAgICAgIH1cclxuICAgICAgaWYgKHAuc2Vzc2lvbl9pZCAmJiAhY29udGV4dC5rbm93blJlbW90ZUlkcz8uc2Vzc2lvbnM/LmhhcyhwLnNlc3Npb25faWQpKSB7XHJcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGAke3N0b3JlTmFtZX06IG1pc3NpbmcgcmVtb3RlIHNlc3Npb24gJHtwLnNlc3Npb25faWR9YCk7XHJcbiAgICAgIH1cclxuICAgICAgaWYgKHAudGVhY2hpbmdfaWQgJiYgIWNvbnRleHQua25vd25SZW1vdGVJZHM/LnRlYWNoaW5ncz8uaGFzKHAudGVhY2hpbmdfaWQpKSB7XHJcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGAke3N0b3JlTmFtZX06IG1pc3NpbmcgcmVtb3RlIHRlYWNoaW5nICR7cC50ZWFjaGluZ19pZH1gKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgaWYgKHRvUHVzaC5sZW5ndGggPiAwKSB7XHJcbiAgICBhd2FpdCBjbG91ZC51cHNlcnRSZWNvcmRzKHRhYmxlTmFtZSwgdG9QdXNoKTtcclxuICB9XHJcblxyXG4gIGlmICh0b1VwZGF0ZUxvY2FsLmxlbmd0aCA+IDApIHtcclxuICAgIGNvbnN0IG9rID0gYXdhaXQgc3RvcmUuc2F2ZSh7IFtzdG9yZU5hbWVdOiB0b1VwZGF0ZUxvY2FsIH0pO1xyXG4gICAgaWYgKCFvaykgdGhyb3cgbmV3IEVycm9yKGAke3N0b3JlTmFtZX06IGxvY2FsIHBlcnNpc3RlbmNlIGZhaWxlZGApO1xyXG4gIH1cclxuXHJcbiAgaWYgKHJlbWFwcGVkTG9jYWxzLnNpemUgPiAwKSB7XHJcbiAgICBjb25zdCBidWlsZENhc2NhZGVQYXRjaCA9IChvbGRJZCwgbmV3SWQsIGVudGl0eVR5cGUpID0+IHtcclxuICAgICAgY29uc3QgcCA9IHt9O1xyXG4gICAgICBjb25zdCB1cGRhdGVTdG9yZSA9IChzTmFtZSwgZmtGaWVsZCkgPT4ge1xyXG4gICAgICAgIGZvciAoY29uc3QgcmVjIG9mIHN0b3JlLnN0YXRlW3NOYW1lXSB8fCBbXSkge1xyXG4gICAgICAgICAgaWYgKHJlY1tma0ZpZWxkXSA9PT0gb2xkSWQpIHtcclxuICAgICAgICAgICAgcFtzTmFtZV0gPz89IFtdO1xyXG4gICAgICAgICAgICBwW3NOYW1lXS5wdXNoKHsgLi4ucmVjLCBbZmtGaWVsZF06IG5ld0lkIH0pO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgfTtcclxuXHJcbiAgICAgIGlmIChlbnRpdHlUeXBlID09PSAneWVhcnMnKSB7XHJcbiAgICAgICAgaWYgKHN0b3JlLnN0YXRlLmRldmljZT8uYWN0aXZlWWVhcklkID09PSBvbGRJZCkgcC5kZXZpY2UgPSBbeyAuLi5zdG9yZS5zdGF0ZS5kZXZpY2UsIGFjdGl2ZVllYXJJZDogbmV3SWQgfV07XHJcbiAgICAgICAgdXBkYXRlU3RvcmUoJ3Rlcm1zJywgJ3llYXJJZCcpO1xyXG4gICAgICAgIHVwZGF0ZVN0b3JlKCdzZWN0aW9ucycsICd5ZWFySWQnKTtcclxuICAgICAgICB1cGRhdGVTdG9yZSgnY2FsZW5kYXJzJywgJ3llYXJJZCcpO1xyXG4gICAgICB9IGVsc2UgaWYgKGVudGl0eVR5cGUgPT09ICd0ZXJtcycpIHtcclxuICAgICAgICBpZiAoc3RvcmUuc3RhdGUuZGV2aWNlPy5hY3RpdmVUZXJtSWQgPT09IG9sZElkKSBwLmRldmljZSA9IFt7IC4uLnN0b3JlLnN0YXRlLmRldmljZSwgYWN0aXZlVGVybUlkOiBuZXdJZCB9XTtcclxuICAgICAgICB1cGRhdGVTdG9yZSgndGVhY2hpbmdzJywgJ3Rlcm1JZCcpO1xyXG4gICAgICB9IGVsc2UgaWYgKGVudGl0eVR5cGUgPT09ICdzdWJqZWN0cycpIHtcclxuICAgICAgICB1cGRhdGVTdG9yZSgndGVhY2hpbmdzJywgJ3N1YmplY3RJZCcpO1xyXG4gICAgICAgIHVwZGF0ZVN0b3JlKCd1bml0cycsICdzdWJqZWN0SWQnKTtcclxuICAgICAgfSBlbHNlIGlmIChlbnRpdHlUeXBlID09PSAnc2VjdGlvbnMnKSB7XHJcbiAgICAgICAgdXBkYXRlU3RvcmUoJ3RlYWNoaW5ncycsICdzZWN0aW9uSWQnKTtcclxuICAgICAgICB1cGRhdGVTdG9yZSgnZW5yb2xsbWVudHMnLCAnc2VjdGlvbklkJyk7XHJcbiAgICAgIH0gZWxzZSBpZiAoZW50aXR5VHlwZSA9PT0gJ3RpbWVQcm9maWxlcycpIHtcclxuICAgICAgICBpZiAoc3RvcmUuc3RhdGUuZGV2aWNlPy5hY3RpdmVUaW1lUHJvZmlsZUlkID09PSBvbGRJZCkgcC5kZXZpY2UgPSBbeyAuLi5zdG9yZS5zdGF0ZS5kZXZpY2UsIGFjdGl2ZVRpbWVQcm9maWxlSWQ6IG5ld0lkIH1dO1xyXG4gICAgICAgIHVwZGF0ZVN0b3JlKCdzZXNzaW9ucycsICd0aW1lUHJvZmlsZUlkJyk7XHJcbiAgICAgIH1cclxuICAgICAgcmV0dXJuIHA7XHJcbiAgICB9O1xyXG5cclxuICAgIGZvciAoY29uc3QgW29sZElkLCBuZXdJZF0gb2YgcmVtYXBwZWRMb2NhbHMpIHtcclxuICAgICAgY29uc3QgcGF0Y2ggPSBidWlsZENhc2NhZGVQYXRjaChvbGRJZCwgbmV3SWQsIHN0b3JlTmFtZSk7XHJcbiAgICAgIGlmIChPYmplY3Qua2V5cyhwYXRjaCkubGVuZ3RoID4gMCkge1xyXG4gICAgICAgIGNvbnN0IG9rID0gYXdhaXQgc3RvcmUuc2F2ZShwYXRjaCk7XHJcbiAgICAgICAgaWYgKCFvaykgdGhyb3cgbmV3IEVycm9yKGAke3N0b3JlTmFtZX0gY2FzY2FkZTogbG9jYWwgcGVyc2lzdGVuY2UgZmFpbGVkYCk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICB9XHJcblxyXG4gIGNvbnN0IGtub3duID0gbmV3IFNldChyZW1vdGVCeUlkLmtleXMoKSk7XHJcbiAgZm9yIChjb25zdCBwIG9mIHRvUHVzaCkga25vd24uYWRkKHAuaWQpO1xyXG5cclxuICByZXR1cm4geyBwdXNoZWQ6IHRvUHVzaC5sZW5ndGgsIHB1bGxlZDogdG9VcGRhdGVMb2NhbC5sZW5ndGgsIGtub3duIH07XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBQaGFzZSA1QjogU3luYyBzdHJ1Y3R1cmFsIGFjYWRlbWljIGRhdGEuXHJcbiAqL1xyXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gc3luY1N0cnVjdHVyYWwoKSB7XHJcbiAgaWYgKCFjbG91ZC5zZXNzaW9uIHx8ICFjbG91ZC51c2VyKSB7XHJcbiAgICBjb25zb2xlLmxvZygnW3Jha2Vlenggc3luY10gTm90IHNpZ25lZCBpbiwgc2tpcHBpbmcgc3RydWN0dXJhbCBzeW5jLicpO1xyXG4gICAgcmV0dXJuO1xyXG4gIH1cclxuICBpZiAoc3RhdGUuc3RhdHVzID09PSAnc3luY2luZycpIHJldHVybjtcclxuXHJcbiAgc2V0U3RhdGUoeyBzdGF0dXM6ICdzeW5jaW5nJywgcmVzdWx0czogeyAuLi5zdGF0ZS5yZXN1bHRzLCBzdHJ1Y3R1cmFsOiBudWxsIH0gfSk7XHJcbiAgY29uc29sZS5sb2coJ1tyYWtlZXp4IHN5bmNdIFN0YXJ0ZWQgc3RydWN0dXJhbCBzeW5jLi4uJyk7XHJcblxyXG4gIHRyeSB7XHJcbiAgICBjb25zdCByZXF1aXJlZEJ5Q2hpbGRyZW4gPSBidWlsZExvY2FsRGVwZW5kZW5jaWVzKHN0b3JlLnN0YXRlKTtcclxuICAgIGNvbnN0IGtub3duUmVtb3RlSWRzID0ge307XHJcbiAgICBjb25zdCBzdGF0cyA9IHt9O1xyXG4gICAgY29uc3Qgb3JkZXIgPSBbXHJcbiAgICAgIHsgc3RvcmU6ICd5ZWFycycsIHRhYmxlOiAneWVhcnMnIH0sXHJcbiAgICAgIHsgc3RvcmU6ICd0ZXJtcycsIHRhYmxlOiAndGVybXMnIH0sXHJcbiAgICAgIHsgc3RvcmU6ICdzdWJqZWN0cycsIHRhYmxlOiAnc3ViamVjdHMnIH0sXHJcbiAgICAgIHsgc3RvcmU6ICdzZWN0aW9ucycsIHRhYmxlOiAnc2VjdGlvbnMnIH0sXHJcbiAgICAgIHsgc3RvcmU6ICd0ZWFjaGluZ3MnLCB0YWJsZTogJ3RlYWNoaW5ncycgfVxyXG4gICAgXTtcclxuXHJcbiAgICBmb3IgKGNvbnN0IHsgc3RvcmU6IHNOYW1lLCB0YWJsZTogdE5hbWUgfSBvZiBvcmRlcikge1xyXG4gICAgICBjb25zdCBjb250ZXh0ID0ge1xyXG4gICAgICAgIHJlcXVpcmVkSWRzOiByZXF1aXJlZEJ5Q2hpbGRyZW5bc05hbWVdIHx8IG5ldyBTZXQoKSxcclxuICAgICAgICBrbm93blJlbW90ZUlkc1xyXG4gICAgICB9O1xyXG4gICAgICBjb25zdCByZXMgPSBhd2FpdCBzeW5jQ29sbGVjdGlvbihzTmFtZSwgdE5hbWUsIGNvbnRleHQpO1xyXG4gICAgICBrbm93blJlbW90ZUlkc1tzTmFtZV0gPSByZXMua25vd247XHJcbiAgICAgIHN0YXRzW3NOYW1lXSA9IHsgcHVzaGVkOiByZXMucHVzaGVkLCBwdWxsZWQ6IHJlcy5wdWxsZWQgfTtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBub3dTdGFtcCA9IERhdGUubm93KCk7XHJcbiAgICBhd2FpdCBzdG9yZS5wYXRjaERldmljZSh7IGxhc3RTeW5jQXQ6IG5vd1N0YW1wIH0pO1xyXG4gICAgc2V0U3RhdGUoe1xyXG4gICAgICBzdGF0dXM6ICdpZGxlJyxcclxuICAgICAgbGFzdFN5bmNlZEF0OiBub3dTdGFtcCxcclxuICAgICAgcmVzdWx0czoge1xyXG4gICAgICAgIC4uLnN0YXRlLnJlc3VsdHMsXHJcbiAgICAgICAgc3RydWN0dXJhbDogeyBzdGF0dXM6ICdzdWNjZXNzJywgc3RhdHMsIHRpbWU6IG5vd1N0YW1wIH1cclxuICAgICAgfVxyXG4gICAgfSk7XHJcbiAgICBjb25zb2xlLmxvZygnW3Jha2Vlenggc3luY10gU3RydWN0dXJhbCBzeW5jIGNvbXBsZXRlLicsIHN0YXRzKTtcclxuICAgIHJldHVybiBzdGF0cztcclxuXHJcbiAgfSBjYXRjaCAoZXJyKSB7XHJcbiAgICBjb25zb2xlLndhcm4oJ1tyYWtlZXp4IHN5bmNdIFN0cnVjdHVyYWwgc3luYyBmYWlsZWQ6JywgZXJyKTtcclxuICAgIHNldFN0YXRlKHtcclxuICAgICAgc3RhdHVzOiAnaWRsZScsXHJcbiAgICAgIHJlc3VsdHM6IHtcclxuICAgICAgICAuLi5zdGF0ZS5yZXN1bHRzLFxyXG4gICAgICAgIHN0cnVjdHVyYWw6IHsgc3RhdHVzOiAnZXJyb3InLCBlcnJvcjogZXJyLm1lc3NhZ2UsIHRpbWU6IERhdGUubm93KCkgfVxyXG4gICAgICB9XHJcbiAgICB9KTtcclxuICB9XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBQaGFzZSA1QzogU3luYyBTdHVkZW50cyBhbmQgRW5yb2xsbWVudHMuXHJcbiAqIERlcGVuZGVuY3ktYXdhcmUgZXhlY3V0aW9uOiBzdHJ1Y3R1cmFsIHN5bmMgcnVucyBmaXJzdC5cclxuICovXHJcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBzeW5jU3R1ZGVudHMoKSB7XHJcbiAgaWYgKCFjbG91ZC5zZXNzaW9uIHx8ICFjbG91ZC51c2VyKSB7XHJcbiAgICBjb25zb2xlLmxvZygnW3Jha2Vlenggc3luY10gTm90IHNpZ25lZCBpbiwgc2tpcHBpbmcgc3R1ZGVudHMgc3luYy4nKTtcclxuICAgIHJldHVybjtcclxuICB9XHJcbiAgaWYgKHN0YXRlLnN0YXR1cyA9PT0gJ3N5bmNpbmcnKSByZXR1cm47XHJcblxyXG4gIGNvbnNvbGUubG9nKCdbcmFrZWV6eCBzeW5jXSBFbmZvcmNpbmcgc3RydWN0dXJhbCBzeW5jIGJlZm9yZSBzdHVkZW50cy4uLicpO1xyXG4gIGF3YWl0IHN5bmNTdHJ1Y3R1cmFsKCk7XHJcblxyXG4gIGlmIChzdGF0ZS5yZXN1bHRzLnN0cnVjdHVyYWw/LnN0YXR1cyA9PT0gJ2Vycm9yJykge1xyXG4gICAgY29uc29sZS53YXJuKCdbcmFrZWV6eCBzeW5jXSBTdHJ1Y3R1cmFsIHN5bmMgZmFpbGVkLCBhYm9ydGluZyBzdHVkZW50cyBzeW5jLicpO1xyXG4gICAgc2V0U3RhdGUoe1xyXG4gICAgICBzdGF0dXM6ICdpZGxlJyxcclxuICAgICAgcmVzdWx0czoge1xyXG4gICAgICAgIC4uLnN0YXRlLnJlc3VsdHMsXHJcbiAgICAgICAgc3R1ZGVudHM6IHsgc3RhdHVzOiAnZXJyb3InLCBlcnJvcjogJ9mB2LTZhNiqINin2YTZhdiy2KfZhdmG2Kkg2KfZhNmH2YrZg9mE2YrYqTogJyArIHN0YXRlLnJlc3VsdHMuc3RydWN0dXJhbC5lcnJvciwgdGltZTogRGF0ZS5ub3coKSB9XHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG4gICAgcmV0dXJuO1xyXG4gIH1cclxuXHJcbiAgc2V0U3RhdGUoeyBzdGF0dXM6ICdzeW5jaW5nJywgcmVzdWx0czogeyAuLi5zdGF0ZS5yZXN1bHRzLCBzdHVkZW50czogbnVsbCB9IH0pO1xyXG4gIGNvbnNvbGUubG9nKCdbcmFrZWV6eCBzeW5jXSBTdGFydGVkIHN0dWRlbnRzIHN5bmMuLi4nKTtcclxuXHJcbiAgdHJ5IHtcclxuICAgIGNvbnN0IGtub3duUmVtb3RlSWRzID0ge307XHJcbiAgICBjb25zdCBzdGF0cyA9IHt9O1xyXG5cclxuICAgIC8vIEZpcnN0LCBmZXRjaCByZW1vdGUgc2VjdGlvbnMgdG8gdmFsaWRhdGUgZW5yb2xsbWVudCBmb3JlaWduIGtleXMuXHJcbiAgICBjb25zdCByZW1vdGVTZWN0aW9ucyA9IGF3YWl0IGNsb3VkLmZldGNoUmVjb3Jkcygnc2VjdGlvbnMnKTtcclxuICAgIGtub3duUmVtb3RlSWRzLnNlY3Rpb25zID0gbmV3IFNldChyZW1vdGVTZWN0aW9ucy5tYXAociA9PiByLmlkKSk7XHJcblxyXG4gICAgLy8gMS4gU3R1ZGVudHNcclxuICAgIGNvbnN0IHJlc1N0dWRlbnRzID0gYXdhaXQgc3luY0NvbGxlY3Rpb24oJ3N0dWRlbnRzJywgJ3N0dWRlbnRzJywgeyByZXF1aXJlZElkczogbmV3IFNldCgpLCBrbm93blJlbW90ZUlkcyB9KTtcclxuICAgIGtub3duUmVtb3RlSWRzLnN0dWRlbnRzID0gcmVzU3R1ZGVudHMua25vd247XHJcbiAgICBzdGF0cy5zdHVkZW50cyA9IHsgcHVzaGVkOiByZXNTdHVkZW50cy5wdXNoZWQsIHB1bGxlZDogcmVzU3R1ZGVudHMucHVsbGVkIH07XHJcblxyXG4gICAgLy8gMi4gRW5yb2xsbWVudHNcclxuICAgIGNvbnN0IHJlc0Vucm9sbG1lbnRzID0gYXdhaXQgc3luY0NvbGxlY3Rpb24oJ2Vucm9sbG1lbnRzJywgJ2Vucm9sbG1lbnRzJywgeyByZXF1aXJlZElkczogbmV3IFNldCgpLCBrbm93blJlbW90ZUlkcyB9KTtcclxuICAgIHN0YXRzLmVucm9sbG1lbnRzID0geyBwdXNoZWQ6IHJlc0Vucm9sbG1lbnRzLnB1c2hlZCwgcHVsbGVkOiByZXNFbnJvbGxtZW50cy5wdWxsZWQgfTtcclxuXHJcbiAgICBjb25zdCBub3dTdGFtcCA9IERhdGUubm93KCk7XHJcbiAgICBhd2FpdCBzdG9yZS5wYXRjaERldmljZSh7IGxhc3RTeW5jQXQ6IG5vd1N0YW1wIH0pO1xyXG4gICAgc2V0U3RhdGUoe1xyXG4gICAgICBzdGF0dXM6ICdpZGxlJyxcclxuICAgICAgbGFzdFN5bmNlZEF0OiBub3dTdGFtcCxcclxuICAgICAgcmVzdWx0czoge1xyXG4gICAgICAgIC4uLnN0YXRlLnJlc3VsdHMsXHJcbiAgICAgICAgc3R1ZGVudHM6IHsgc3RhdHVzOiAnc3VjY2VzcycsIHN0YXRzLCB0aW1lOiBub3dTdGFtcCB9XHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG4gICAgY29uc29sZS5sb2coJ1tyYWtlZXp4IHN5bmNdIFN0dWRlbnRzIHN5bmMgY29tcGxldGUuJywgc3RhdHMpO1xyXG5cclxuICB9IGNhdGNoIChlcnIpIHtcclxuICAgIGNvbnNvbGUud2FybignW3Jha2Vlenggc3luY10gU3R1ZGVudHMgc3luYyBmYWlsZWQ6JywgZXJyKTtcclxuICAgIHNldFN0YXRlKHtcclxuICAgICAgc3RhdHVzOiAnaWRsZScsXHJcbiAgICAgIHJlc3VsdHM6IHtcclxuICAgICAgICAuLi5zdGF0ZS5yZXN1bHRzLFxyXG4gICAgICAgIHN0dWRlbnRzOiB7IHN0YXR1czogJ2Vycm9yJywgZXJyb3I6IGVyci5tZXNzYWdlLCB0aW1lOiBEYXRlLm5vdygpIH1cclxuICAgICAgfVxyXG4gICAgfSk7XHJcbiAgfVxyXG59XHJcblxyXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gc3luY1Njb3JpbmcoKSB7XHJcbiAgaWYgKCFjbG91ZC5zZXNzaW9uIHx8ICFjbG91ZC51c2VyKSB7XHJcbiAgICBjb25zb2xlLmxvZygnW3Jha2Vlenggc3luY10gTm90IHNpZ25lZCBpbiwgc2tpcHBpbmcgc2NvcmluZyBzeW5jLicpO1xyXG4gICAgcmV0dXJuO1xyXG4gIH1cclxuICBpZiAoc3RhdGUuc3RhdHVzID09PSAnc3luY2luZycpIHJldHVybjtcclxuXHJcbiAgY29uc29sZS5sb2coJ1tyYWtlZXp4IHN5bmNdIEVuZm9yY2luZyBzdHJ1Y3R1cmFsIHN5bmMgYmVmb3JlIHNjb3JpbmcuLi4nKTtcclxuICBhd2FpdCBzeW5jU3RydWN0dXJhbCgpO1xyXG5cclxuICBpZiAoc3RhdGUucmVzdWx0cy5zdHJ1Y3R1cmFsPy5zdGF0dXMgPT09ICdlcnJvcicpIHtcclxuICAgIGNvbnNvbGUud2FybignW3Jha2Vlenggc3luY10gU3RydWN0dXJhbCBzeW5jIGZhaWxlZCwgYWJvcnRpbmcgc2NvcmluZyBzeW5jLicpO1xyXG4gICAgc2V0U3RhdGUoe1xyXG4gICAgICBzdGF0dXM6ICdpZGxlJyxcclxuICAgICAgcmVzdWx0czoge1xyXG4gICAgICAgIC4uLnN0YXRlLnJlc3VsdHMsXHJcbiAgICAgICAgc2NvcmluZzogeyBzdGF0dXM6ICdlcnJvcicsIGVycm9yOiAn2YHYtNmE2Kog2KfZhNmF2LLYp9mF2YbYqSDYp9mE2YfZitmD2YTZitipOiAnICsgc3RhdGUucmVzdWx0cy5zdHJ1Y3R1cmFsLmVycm9yLCB0aW1lOiBEYXRlLm5vdygpIH1cclxuICAgICAgfVxyXG4gICAgfSk7XHJcbiAgICByZXR1cm47XHJcbiAgfVxyXG5cclxuICBzZXRTdGF0ZSh7IHN0YXR1czogJ3N5bmNpbmcnLCByZXN1bHRzOiB7IC4uLnN0YXRlLnJlc3VsdHMsIHNjb3Jpbmc6IG51bGwgfSB9KTtcclxuICBjb25zb2xlLmxvZygnW3Jha2Vlenggc3luY10gU3RhcnRlZCBzY29yaW5nIHN5bmMuLi4nKTtcclxuXHJcbiAgdHJ5IHtcclxuICAgIGNvbnN0IGtub3duUmVtb3RlSWRzID0ge307XHJcbiAgICBjb25zdCBzdGF0cyA9IHt9O1xyXG5cclxuICAgIC8vIEZpcnN0LCBmZXRjaCByZW1vdGUgdGVhY2hpbmdzIGFuZCBzdHVkZW50cyB0byB2YWxpZGF0ZSBmb3JlaWduIGtleXMuXHJcbiAgICBjb25zdCByZW1vdGVUZWFjaGluZ3MgPSBhd2FpdCBjbG91ZC5mZXRjaFJlY29yZHMoJ3RlYWNoaW5ncycpO1xyXG4gICAga25vd25SZW1vdGVJZHMudGVhY2hpbmdzID0gbmV3IFNldChyZW1vdGVUZWFjaGluZ3MubWFwKHIgPT4gci5pZCkpO1xyXG5cclxuICAgIGNvbnN0IHJlbW90ZVN0dWRlbnRzID0gYXdhaXQgY2xvdWQuZmV0Y2hSZWNvcmRzKCdzdHVkZW50cycpO1xyXG4gICAga25vd25SZW1vdGVJZHMuc3R1ZGVudHMgPSBuZXcgU2V0KHJlbW90ZVN0dWRlbnRzLm1hcChyID0+IHIuaWQpKTtcclxuXHJcbiAgICAvLyAxLiBpdGVtc1xyXG4gICAgY29uc3QgcmVzSXRlbXMgPSBhd2FpdCBzeW5jQ29sbGVjdGlvbignaXRlbXMnLCAnaXRlbXMnLCB7IHJlcXVpcmVkSWRzOiBuZXcgU2V0KCksIGtub3duUmVtb3RlSWRzIH0pO1xyXG4gICAga25vd25SZW1vdGVJZHMuaXRlbXMgPSByZXNJdGVtcy5rbm93bjtcclxuICAgIHN0YXRzLml0ZW1zID0geyBwdXNoZWQ6IHJlc0l0ZW1zLnB1c2hlZCwgcHVsbGVkOiByZXNJdGVtcy5wdWxsZWQgfTtcclxuXHJcbiAgICAvLyAyLiBzY29yZXNcclxuICAgIGNvbnN0IHJlc1Njb3JlcyA9IGF3YWl0IHN5bmNDb2xsZWN0aW9uKCdzY29yZXMnLCAnc2NvcmVzJywgeyByZXF1aXJlZElkczogbmV3IFNldCgpLCBrbm93blJlbW90ZUlkcyB9KTtcclxuICAgIGtub3duUmVtb3RlSWRzLnNjb3JlcyA9IHJlc1Njb3Jlcy5rbm93bjtcclxuICAgIHN0YXRzLnNjb3JlcyA9IHsgcHVzaGVkOiByZXNTY29yZXMucHVzaGVkLCBwdWxsZWQ6IHJlc1Njb3Jlcy5wdWxsZWQgfTtcclxuXHJcbiAgICBjb25zdCBub3dTdGFtcCA9IERhdGUubm93KCk7XHJcbiAgICBhd2FpdCBzdG9yZS5wYXRjaERldmljZSh7IGxhc3RTeW5jQXQ6IG5vd1N0YW1wIH0pO1xyXG4gICAgc2V0U3RhdGUoe1xyXG4gICAgICBzdGF0dXM6ICdpZGxlJyxcclxuICAgICAgbGFzdFN5bmNlZEF0OiBub3dTdGFtcCxcclxuICAgICAgcmVzdWx0czoge1xyXG4gICAgICAgIC4uLnN0YXRlLnJlc3VsdHMsXHJcbiAgICAgICAgc2NvcmluZzogeyBzdGF0dXM6ICdzdWNjZXNzJywgc3RhdHMsIHRpbWU6IG5vd1N0YW1wIH1cclxuICAgICAgfVxyXG4gICAgfSk7XHJcbiAgICBjb25zb2xlLmxvZygnW3Jha2Vlenggc3luY10gU2NvcmluZyBzeW5jIGNvbXBsZXRlLicsIHN0YXRzKTtcclxuICAgIHJldHVybiBzdGF0cztcclxuXHJcbiAgfSBjYXRjaCAoZXJyKSB7XHJcbiAgICBjb25zb2xlLndhcm4oJ1tyYWtlZXp4IHN5bmNdIFNjb3Jpbmcgc3luYyBmYWlsZWQ6JywgZXJyKTtcclxuICAgIHNldFN0YXRlKHtcclxuICAgICAgc3RhdHVzOiAnaWRsZScsXHJcbiAgICAgIHJlc3VsdHM6IHtcclxuICAgICAgICAuLi5zdGF0ZS5yZXN1bHRzLFxyXG4gICAgICAgIHNjb3Jpbmc6IHsgc3RhdHVzOiAnZXJyb3InLCBlcnJvcjogZXJyLm1lc3NhZ2UsIHRpbWU6IERhdGUubm93KCkgfVxyXG4gICAgICB9XHJcbiAgICB9KTtcclxuICB9XHJcbn1cclxuXHJcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBzeW5jVGltZXRhYmxlKCkge1xyXG4gIGlmICghY2xvdWQuc2Vzc2lvbiB8fCAhY2xvdWQudXNlcikge1xyXG4gICAgY29uc29sZS5sb2coJ1tyYWtlZXp4IHN5bmNdIE5vdCBzaWduZWQgaW4sIHNraXBwaW5nIHRpbWV0YWJsZSBzeW5jLicpO1xyXG4gICAgcmV0dXJuO1xyXG4gIH1cclxuICBpZiAoc3RhdGUuc3RhdHVzID09PSAnc3luY2luZycpIHJldHVybjtcclxuXHJcbiAgY29uc29sZS5sb2coJ1tyYWtlZXp4IHN5bmNdIEVuZm9yY2luZyBzdHJ1Y3R1cmFsIHN5bmMgYmVmb3JlIHRpbWV0YWJsZS4uLicpO1xyXG4gIGF3YWl0IHN5bmNTdHJ1Y3R1cmFsKCk7XHJcblxyXG4gIGlmIChzdGF0ZS5yZXN1bHRzLnN0cnVjdHVyYWw/LnN0YXR1cyA9PT0gJ2Vycm9yJykge1xyXG4gICAgY29uc29sZS53YXJuKCdbcmFrZWV6eCBzeW5jXSBTdHJ1Y3R1cmFsIHN5bmMgZmFpbGVkLCBhYm9ydGluZyB0aW1ldGFibGUgc3luYy4nKTtcclxuICAgIHNldFN0YXRlKHtcclxuICAgICAgc3RhdHVzOiAnaWRsZScsXHJcbiAgICAgIHJlc3VsdHM6IHtcclxuICAgICAgICAuLi5zdGF0ZS5yZXN1bHRzLFxyXG4gICAgICAgIHRpbWV0YWJsZTogeyBzdGF0dXM6ICdlcnJvcicsIGVycm9yOiAn2YHYtNmE2Kog2KfZhNmF2LLYp9mF2YbYqSDYp9mE2YfZitmD2YTZitipOiAnICsgc3RhdGUucmVzdWx0cy5zdHJ1Y3R1cmFsLmVycm9yLCB0aW1lOiBEYXRlLm5vdygpIH1cclxuICAgICAgfVxyXG4gICAgfSk7XHJcbiAgICByZXR1cm47XHJcbiAgfVxyXG5cclxuICBzZXRTdGF0ZSh7IHN0YXR1czogJ3N5bmNpbmcnLCByZXN1bHRzOiB7IC4uLnN0YXRlLnJlc3VsdHMsIHRpbWV0YWJsZTogbnVsbCB9IH0pO1xyXG4gIGNvbnNvbGUubG9nKCdbcmFrZWV6eCBzeW5jXSBTdGFydGVkIHRpbWV0YWJsZSBzeW5jLi4uJyk7XHJcblxyXG4gIHRyeSB7XHJcbiAgICBjb25zdCBrbm93blJlbW90ZUlkcyA9IHt9O1xyXG4gICAgY29uc3Qgc3RhdHMgPSB7fTtcclxuXHJcbiAgICAvLyBGaXJzdCwgZmV0Y2ggcmVtb3RlIHRlYWNoaW5ncyB0byB2YWxpZGF0ZSBmb3JlaWduIGtleXMuXHJcbiAgICBjb25zdCByZW1vdGVUZWFjaGluZ3MgPSBhd2FpdCBjbG91ZC5mZXRjaFJlY29yZHMoJ3RlYWNoaW5ncycpO1xyXG4gICAga25vd25SZW1vdGVJZHMudGVhY2hpbmdzID0gbmV3IFNldChyZW1vdGVUZWFjaGluZ3MubWFwKHIgPT4gci5pZCkpO1xyXG5cclxuICAgIGNvbnN0IGxvY2FsU3RvcmVTdGF0ZSA9IHN0b3JlLnN0YXRlO1xyXG4gICAgY29uc3QgY29udGV4dCA9IGJ1aWxkTG9jYWxEZXBlbmRlbmNpZXMobG9jYWxTdG9yZVN0YXRlKTtcclxuXHJcbiAgICAvLyAxLiB0aW1lUHJvZmlsZXNcclxuICAgIGNvbnN0IHJlc1Byb2ZpbGVzID0gYXdhaXQgc3luY0NvbGxlY3Rpb24oJ3RpbWVQcm9maWxlcycsICd0aW1lX3Byb2ZpbGVzJywgeyByZXF1aXJlZElkczogY29udGV4dC50aW1lUHJvZmlsZXMsIGtub3duUmVtb3RlSWRzIH0pO1xyXG4gICAga25vd25SZW1vdGVJZHMudGltZVByb2ZpbGVzID0gcmVzUHJvZmlsZXMua25vd247XHJcbiAgICBzdGF0cy50aW1lUHJvZmlsZXMgPSB7IHB1c2hlZDogcmVzUHJvZmlsZXMucHVzaGVkLCBwdWxsZWQ6IHJlc1Byb2ZpbGVzLnB1bGxlZCB9O1xyXG5cclxuICAgIC8vIDIuIHNsb3RzXHJcbiAgICBjb25zdCByZXNTbG90cyA9IGF3YWl0IHN5bmNDb2xsZWN0aW9uKCdzbG90cycsICdzbG90cycsIHsgcmVxdWlyZWRJZHM6IGNvbnRleHQuc2xvdHMsIGtub3duUmVtb3RlSWRzIH0pO1xyXG4gICAga25vd25SZW1vdGVJZHMuc2xvdHMgPSByZXNTbG90cy5rbm93bjtcclxuICAgIHN0YXRzLnNsb3RzID0geyBwdXNoZWQ6IHJlc1Nsb3RzLnB1c2hlZCwgcHVsbGVkOiByZXNTbG90cy5wdWxsZWQgfTtcclxuXHJcbiAgICAvLyAzLiBzZXNzaW9uc1xyXG4gICAgY29uc3QgcmVzU2Vzc2lvbnMgPSBhd2FpdCBzeW5jQ29sbGVjdGlvbignc2Vzc2lvbnMnLCAnc2Vzc2lvbnMnLCB7IHJlcXVpcmVkSWRzOiBuZXcgU2V0KCksIGtub3duUmVtb3RlSWRzIH0pO1xyXG4gICAga25vd25SZW1vdGVJZHMuc2Vzc2lvbnMgPSByZXNTZXNzaW9ucy5rbm93bjtcclxuICAgIHN0YXRzLnNlc3Npb25zID0geyBwdXNoZWQ6IHJlc1Nlc3Npb25zLnB1c2hlZCwgcHVsbGVkOiByZXNTZXNzaW9ucy5wdWxsZWQgfTtcclxuXHJcbiAgICAvLyBGZXRjaCByZW1vdGUgc3R1ZGVudHMgZm9yIGF0dGVuZGFuY2UgZm9yZWlnbiBrZXkgdmFsaWRhdGlvblxyXG4gICAgY29uc3QgcmVtb3RlU3R1ZGVudHMgPSBhd2FpdCBjbG91ZC5mZXRjaFJlY29yZHMoJ3N0dWRlbnRzJyk7XHJcbiAgICBrbm93blJlbW90ZUlkcy5zdHVkZW50cyA9IG5ldyBTZXQocmVtb3RlU3R1ZGVudHMubWFwKHIgPT4gci5pZCkpO1xyXG5cclxuICAgIC8vIDQuIGF0dGVuZGFuY2VcclxuICAgIGNvbnN0IHJlc0F0dGVuZGFuY2UgPSBhd2FpdCBzeW5jQ29sbGVjdGlvbignYXR0ZW5kYW5jZScsICdhdHRlbmRhbmNlJywgeyByZXF1aXJlZElkczogbmV3IFNldCgpLCBrbm93blJlbW90ZUlkcyB9KTtcclxuICAgIGtub3duUmVtb3RlSWRzLmF0dGVuZGFuY2UgPSByZXNBdHRlbmRhbmNlLmtub3duO1xyXG4gICAgc3RhdHMuYXR0ZW5kYW5jZSA9IHsgcHVzaGVkOiByZXNBdHRlbmRhbmNlLnB1c2hlZCwgcHVsbGVkOiByZXNBdHRlbmRhbmNlLnB1bGxlZCB9O1xyXG5cclxuICAgIGNvbnN0IG5vd1N0YW1wID0gRGF0ZS5ub3coKTtcclxuICAgIGF3YWl0IHN0b3JlLnBhdGNoRGV2aWNlKHsgbGFzdFN5bmNBdDogbm93U3RhbXAgfSk7XHJcbiAgICBzZXRTdGF0ZSh7XHJcbiAgICAgIHN0YXR1czogJ2lkbGUnLFxyXG4gICAgICBsYXN0U3luY2VkQXQ6IG5vd1N0YW1wLFxyXG4gICAgICByZXN1bHRzOiB7XHJcbiAgICAgICAgLi4uc3RhdGUucmVzdWx0cyxcclxuICAgICAgICB0aW1ldGFibGU6IHsgc3RhdHVzOiAnc3VjY2VzcycsIHN0YXRzLCB0aW1lOiBub3dTdGFtcCB9XHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG4gICAgY29uc29sZS5sb2coJ1tyYWtlZXp4IHN5bmNdIFRpbWV0YWJsZSBzeW5jIGNvbXBsZXRlLicsIHN0YXRzKTtcclxuICAgIHJldHVybiBzdGF0cztcclxuXHJcbiAgfSBjYXRjaCAoZXJyKSB7XHJcbiAgICBjb25zb2xlLndhcm4oJ1tyYWtlZXp4IHN5bmNdIFRpbWV0YWJsZSBzeW5jIGZhaWxlZDonLCBlcnIpO1xyXG4gICAgc2V0U3RhdGUoe1xyXG4gICAgICBzdGF0dXM6ICdpZGxlJyxcclxuICAgICAgcmVzdWx0czoge1xyXG4gICAgICAgIC4uLnN0YXRlLnJlc3VsdHMsXHJcbiAgICAgICAgdGltZXRhYmxlOiB7IHN0YXR1czogJ2Vycm9yJywgZXJyb3I6IGVyci5tZXNzYWdlLCB0aW1lOiBEYXRlLm5vdygpIH1cclxuICAgICAgfVxyXG4gICAgfSk7XHJcbiAgfVxyXG59XHJcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsQ0FBQztBQUMzQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxDQUFDO0FBQ3ZDLE1BQU0sQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMscUJBQXFCLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsQ0FBQztBQUM1RDtBQUNBLE1BQU0sQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ3RCLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsT0FBTztBQUNsQyxDQUFDLENBQUMsWUFBWSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLEtBQUs7QUFDdkQsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7QUFDWixDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksQ0FBQztBQUNsQixDQUFDLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLElBQUksQ0FBQztBQUNyQixDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLElBQUk7QUFDbEIsQ0FBQyxDQUFDLENBQUM7QUFDSCxDQUFDLENBQUM7QUFDRjtBQUNBLEtBQUssQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO0FBQzVCLE1BQU0sQ0FBQyxRQUFRLENBQUMsU0FBUyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7QUFD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QUFDLENBQUMsT0FBTyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNqRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUMvRCxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNsRCxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ0osQ0FBQztBQUNEO0FBQ0EsQ0FBQyxDQUFDLENBQUM7QUFDSCxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUM7QUFDL0IsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUM7QUFDdkMsQ0FBQyxDQUFDLENBQUM7QUFDSCxNQUFNLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDckMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO0FBQ3RDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFD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QUFDO0FBQ3pDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQztBQUM5QixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLHFCQUFxQixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsU0FBUztBQUN0RSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsVUFBVTtBQUN0QyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ1YsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLHFCQUFxQixDQUFDLENBQUMsQ0FBQztBQUMxRCxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDM0UsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDO0FBQzFCLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQztBQUN2QixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDLHFCQUFxQixDQUFDLENBQUMsQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDO0FBQzFELENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUM3RSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQztBQUNqQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ2xCLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsV0FBVyxDQUFDLENBQUMsTUFBTSxDQUFDLFlBQVksQ0FBQztBQUMzQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxXQUFXLENBQUM7QUFDekMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDO0FBQzlCLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMscUJBQXFCLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxTQUFTO0FBQ3RFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxVQUFVO0FBQ3RDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDVixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDZCxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQzdGLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDUCxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDTDtBQUNBLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7QUFDL0IsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUN4RCxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ3ZCLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxNQUFNLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQy9DLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxXQUFXLENBQUMsQ0FBQyxNQUFNLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQzdDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ2xDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUM7QUFDNUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxDQUFDO0FBQ2hDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNSO0FBQ0EsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO0FBQ3BCLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLGFBQWEsQ0FBQyxPQUFPLENBQUMsQ0FBQztBQUMzQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDZCxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxhQUFhLENBQUMsT0FBTyxDQUFDLENBQUM7QUFDM0MsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNQLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNMO0FBQ0EsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO0FBQ3RDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDNUQsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxZQUFZLENBQUMsQ0FBQztBQUNoQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsV0FBVyxDQUFDLENBQUMsTUFBTSxDQUFDLFdBQVcsQ0FBQztBQUN4QyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsTUFBTSxDQUFDLFVBQVUsQ0FBQztBQUN0QyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQztBQUM1QixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQztBQUNwQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsTUFBTSxDQUFDLE9BQU87QUFDL0IsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLGlCQUFpQixDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ3RDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNMO0FBQ0EsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztBQUNoQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDdEQsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQztBQUNkLENBQUMs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QUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDO0FBQ3JCLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUM7QUFDdkIsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQztBQUNoQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDO0FBQzVCLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUM7QUFDekIsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsV0FBVyxDQUFDLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQztBQUNsQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUM7QUFDaEcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDO0FBQ3ZDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxDQUFDO0FBQzlCLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDUCxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQzFCLENBQUMs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QUFDckIsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQztBQUN2QixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDO0FBQ3ZCLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQztBQUNoRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUM7QUFDdkMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsV0FBVyxDQUFDLENBQUM7QUFDOUIsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNQLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDMUIsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQztBQUNqQixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDO0FBQzFCLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUM7QUFDdkIsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FB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QUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNOLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDSixDQUFDLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQztBQUNoQixDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ3hCLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUM7QUFDakIsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQztBQUNoQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDO0FBQ2hDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUM7QUFDMUIsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQztBQUNoQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDO0FBQzVCLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUM7QUFDekIsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsYUFBYSxDQUFDLENBQUMsR0FBRyxDQUFDLFlBQVksQ0FBQztBQUN0QyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxD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LENBQUMsT0FBTyxDQUFDLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQztBQUMzQixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDO0FBQy9CLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUM7QUFDbEMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQztBQUM5QixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUM7QUFDaEcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDO0FBQ3ZDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxDQUFDO0FBQzlCLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDUCxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQzFCLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUM7QUFDakIsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQztBQUNyQixDQUFDLENBQUMsQ0FBQyxDQUFDLENB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QUFDO0FBQ0gsQ0FBQyxDQUFDO0FBQ0Y7QUFDQSxDQUFDLENBQUMsQ0FBQztBQUNILENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxVQUFVLENBQUMsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUM7QUFDL0UsQ0FBQyxDQUFDLENBQUM7QUFDSCxRQUFRLENBQUMsc0JBQXNCLENBQUMsU0FBUyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztBQUNqRCxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDOUIsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7QUFDOUYsQ0FBQyxDQUFDLENBQUM7QUFDSCxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDOUIsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO0FBQ3BILENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUN4SCxDQUFDLENBQUMsQ0FBQztBQUNILENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNqQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7QUFDL0UsQ0FBQyxDQUFDLENBQUM7QUFDSCxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDckMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxxQkFBcUIsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDakUsQ0FBQyxDQUFDLENBQUM7QUFDSCxDQUFDLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLFFBQVE7QUFDOUQsQ0FBQztBQUNEO0FBQ0EsQ0FBQyxDQUFDLENBQUM7QUFDSCxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUM7QUFDMUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQztBQUNwRSxDQUFDLENBQUMsQ0FBQztBQUNILFFBQVEsQ0FBQyxzQkFBc0IsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO0FBQ3hDLENBQUMsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLFlBQVksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ2hLO0FBQ0EsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQzNDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ2hFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQztBQUNoQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDTCxDQUFDLENBQUMsQ0FBQztBQUNILENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUN6QyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsc0JBQXNCLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUMvRCxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7QUFDakMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ0wsQ0FBQyxDQUFDLENBQUM7QUFDSCxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDNUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO0FBQ3ZCLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLENBQUM7QUFDekQsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsQ0FBQztBQUN6RCxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDO0FBQ2hELENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNMLENBQUMsQ0FBQyxDQUFDO0FBQ0gsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ3ZDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztBQUN0QixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsVUFBVSxDQUFDLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLFVBQVUsQ0FBQyxDQUFDO0FBQzFELENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxhQUFhLENBQUMsQ0FBQyxHQUFHLENBQUMsWUFBWSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsYUFBYSxDQUFDLENBQUM7QUFDbkUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ0wsQ0FBQyxDQUFDLENBQUM7QUFDSCxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDM0MsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO0FBQ3ZCLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLENBQUM7QUFDNUQsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQztBQUNoRCxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsYUFBYSxDQUFDLENBQUMsR0FBRyxDQUFDLFlBQVksQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLGFBQWEsQ0FBQyxDQUFDO0FBQ3JFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNMLENBQUMsQ0FBQyxDQUFDO0FBQ0gsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEtBQUssQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQzdDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztBQUN2QixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxDQUFDO0FBQzVELENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNMLENBQUMsQ0FBQyxDQUFDO0FBQ0g7QUFDQSxDQUFDLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQztBQUNiLENBQUM7QUFDRDtBQUNBLENBQUMsQ0FBQyxDQUFDO0FBQ0gsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsVUFBVSxDQUFDO0FBQy9DLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxJQUFJO0FBQ3RCLENBQUMsQ0FBQyxDQUFDO0FBQ0gsS0FBSyxDQUFDLFFBQVEsQ0FBQyxjQUFjLENBQUMsU0FBUyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsV0FBVyxDQUFDLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQy9HLENBQUMsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLENBQUM7QUFDcEMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQzdEO0FBQ0EsQ0FBQyxDQUFDLEtBQUssQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsWUFBWSxDQUFDLFNBQVMsQ0FBQyxDQUFDO0FBQzVELENBQUMsQ0FBQyxLQUFLLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ3BEO0FBQ0EsQ0FBQyxDQUFDLEtBQUssQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsYUFBYSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ2hFLENBQUMsQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLFlBQVksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUM5RDtBQUNBLENBQUMsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDdEU7QUFDQSxDQUFDLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDcEIsQ0FBQyxDQUFDLEtBQUssQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQzNCO0FBQ0EsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7QUFDNUIsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxDQUFDO0FBQ3RDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQztBQUNwQztBQUNBLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO0FBQ2xCLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQztBQUMvQixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMs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QUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7QUFDM0MsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQztBQUMxRCxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDO0FBQ3BDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQztBQUNyRCxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ1AsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ0wsQ0FBQyxDQUFDLENBQUM7QUFDSDtBQUNBLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxjQUFjLENBQUMsRUFBRSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQztBQUNsRCxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQztBQUMzRixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLEVBQUU7QUFDOUYsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQztBQUNyRSxDQUFDLENBQUMsS0FBSyxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSztBQUNyRDtBQUNBLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxVQUFVLENBQUMsS0FBSztBQUMzRyxDQUFDLENBQUMsS0FBSyxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxhQUFhLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQzNELENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7QUFDMUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLGlCQUFpQixDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztBQUMxRSxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQztBQUN6QixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDTDtBQUNBLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUM5QixDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUM7QUFDdkMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ3BELENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLFVBQVUsQ0FBQyxDQUFDO0FBQ2xGLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsQ0FBQyxjQUFjLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLENBQUM7QUFDbkYsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNQLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNMLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ3JDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQztBQUN2QyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLHNCQUFzQixDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDcEQsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUM7QUFDckcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxDQUFDLGNBQWMsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsQ0FBQztBQUNuRixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ1AsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ0wsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDeEMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDO0FBQ3ZDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsc0JBQXNCLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUN2RCxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUNyRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLENBQUMsY0FBYyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxDQUFDO0FBQ25GLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDUCxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDTCxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUM1QyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUM7QUFDdkMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQzNELENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQ3JFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsQ0FBQyxjQUFjLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLENBQUM7QUFDbkYsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNQLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNMLENBQUMsQ0FBQyxDQUFDO0FBQ0g7QUFDQSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNoQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxjQUFjLENBQUMsQ0FBQztBQUNyRjtBQUNBLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsV0FBVyxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLFVBQVU7QUFDL0YsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUM3RCxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNuQixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDL0MsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ3JELENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztBQUN2QyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUM1QixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ3hELENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNYLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ1QsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ1I7QUFDQSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNuQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO0FBQ2xILENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxXQUFXLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQztBQUN2QyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsV0FBVyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7QUFDMUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO0FBQzNDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDMUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsWUFBWSxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztBQUNsSCxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsV0FBVyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7QUFDM0MsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUM3QyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsV0FBVyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUM7QUFDOUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDO0FBQzFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDN0MsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsWUFBWSxDQUFDLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxVQUFVO0FBQ2xGLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxXQUFXLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQztBQUM5QyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsV0FBVyxDQUFDLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUM7QUFDaEQsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNqRCxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLG1CQUFtQixDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztBQUNoSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsV0FBVyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUM7QUFDakQsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNQLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7QUFDZixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNOO0FBQ0EsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUN0QyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQzNCO0FBQ0EsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsTUFBTTtBQUNoRixDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxjQUFjLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDNUQsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQztBQUN4QyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUM7QUFDbEU7QUFDQSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxNQUFNO0FBQzFELENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDeEIsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQztBQUNoQixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxXQUFXLENBQUMsQ0FBQztBQUN6QyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsS0FBSztBQUNqQixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDUjtBQUNBLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUM7QUFDOUIsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQztBQUNyQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDO0FBQzNCLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUM7QUFDeEI7QUFDQSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLEtBQUs7QUFDcEQsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsaUJBQWlCLENBQUMsS0FBSyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUM7QUFDakUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsV0FBVyxDQUFDLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDO0FBQ3JFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ2pELENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDO0FBQ3pDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUM1QixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUMzQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUM7QUFDbkUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7QUFDL0UsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUN0QyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNULENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDUDtBQUNBLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLFdBQVcsQ0FBQztBQUNqRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQy9GLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUM7QUFDdEM7QUFDQSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsTUFBTTtBQUMvRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUM7QUFDNUQsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ3BEO0FBQ0EsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUM7QUFDaEYsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDO0FBQ3pFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDO0FBQ3pFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQztBQUMvRCxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDMUQsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ0w7QUFDQSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNoRCxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ3RGLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQztBQUNyRixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ1AsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUM7QUFDMUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxLQUFLLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7QUFDbkYsQ0FBQyxDQUFDLENBQUM7QUFDSDtBQUNBLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxJQUFJO0FBQ3RDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQzFELENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQztBQUM3QixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLGNBQWMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ3hFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQzFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDUCxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDTCxDQUFDLENBQUMsQ0FBQztBQUNILENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNsQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7QUFDN0IsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxjQUFjLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNqRixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNoRixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ1AsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxjQUFjLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNqRixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNoRixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ1AsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxjQUFjLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUN4RSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUMxRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ1AsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ0wsQ0FBQyxDQUFDLENBQUM7QUFDSDtBQUNBLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNwQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7QUFDN0IsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxjQUFjLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNqRixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNoRixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ1AsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxjQUFjLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNqRixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNoRixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ1AsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ0wsQ0FBQyxDQUFDLENBQUM7QUFDSDtBQUNBLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUM5QixDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7QUFDN0IsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxjQUFjLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNwRixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNsRixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ1AsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ0wsQ0FBQyxDQUFDLENBQUM7QUFDSDtBQUNBLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUMvQixDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7QUFDN0IsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxjQUFjLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNqRixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNoRixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ1AsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxjQUFjLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUN4RSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUMxRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ1AsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ0wsQ0FBQyxDQUFDLENBQUM7QUFDSDtBQUNBLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUM5QixDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7QUFDN0IsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxjQUFjLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNwRixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNsRixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ1AsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ0wsQ0FBQyxDQUFDLENBQUM7QUFDSDtBQUNBLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNqQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7QUFDN0IsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxjQUFjLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNwRixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNsRixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ1AsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxjQUFjLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUN4RSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUMxRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ1AsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLGVBQWUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxjQUFjLENBQUMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLGVBQWUsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUMvRixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLGVBQWUsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUN6RixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ1AsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ0w7QUFDQSxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQzFELENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDdEIsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztBQUM5QixDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO0FBQy9CO0FBQ0EsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDdkIsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUM7QUFDcEMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQy9CLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDLGFBQWEsQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQzVGLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDUCxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQztBQUN6QjtBQUNBLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDaEUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLGFBQWEsQ0FBQyxDQUFDO0FBQ3RELENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7QUFDdEIsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ2hGLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ1QsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQztBQUN0QixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ1A7QUFDQSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQztBQUM1QixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQztBQUN4QixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ3JCLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNMO0FBQ0EsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxVQUFVLENBQUMsVUFBVTtBQUNqRSxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO0FBQzlGO0FBQ0EsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO0FBQzdCLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNmLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNMO0FBQ0EsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDdEIsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDO0FBQzNCLENBQUMsQ0FBQyxDQUFDO0FBQ0g7QUFDQSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDbkMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO0FBQzdCLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsY0FBYyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDakYsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDaEYsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNQLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsY0FBYyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDakYsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDaEYsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNQLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsY0FBYyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDcEYsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDbEYsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNQLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNMLENBQUMsQ0FBQyxDQUFDO0FBQ0g7QUFDQSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUMxQixDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsYUFBYSxDQUFDLFNBQVMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDO0FBQ2pELENBQUMsQ0FBQyxDQUFDO0FBQ0g7QUFDQSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsYUFBYSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNqQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ2hFLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQztBQUN2RSxDQUFDLENBQUMsQ0FBQztBQUNIO0FBQ0EsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDaEMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUM3RCxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNuQixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDL0MsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ3JELENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztBQUN2QyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUM1QixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ3hELENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNYLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ1QsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ1I7QUFDQSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNuQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLFlBQVksQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNwSCxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsV0FBVyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7QUFDdkMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO0FBQzFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxXQUFXLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQztBQUMzQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQzFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsWUFBWSxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ3BILENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxXQUFXLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQztBQUMzQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQzdDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxXQUFXLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQztBQUM5QyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsV0FBVyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUM7QUFDMUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUM3QyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsV0FBVyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUM7QUFDOUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDO0FBQ2hELENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDakQsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsbUJBQW1CLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLG1C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LENBQUM7QUFDbkIsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUN6QyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ3pDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDL0MsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUMvQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQztBQUNoRCxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNOO0FBQ0EsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7QUFDekQsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUN2QixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsV0FBVyxDQUFDLENBQUMsa0JBQWtCLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7QUFDNUQsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLGNBQWM7QUFDdEIsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ1IsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLGNBQWMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQztBQUM5RCxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxjQUFjLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUM7QUFDeEMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO0FBQ2hFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNMO0FBQ0EsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztBQUNoQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDdEQsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQztBQUNkLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDckIsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsWUFBWSxDQUFDLENBQUMsUUFBUSxDQUFDO0FBQzdCLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7QUFDaEIsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUM7QUFDekIsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUM7QUFDaEUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNQLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDUCxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQztBQUNuRSxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUM7QUFDakI7QUFDQSxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7QUFDakIsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFD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LENBQUMsQ0FBQztBQUNkLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDckIsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztBQUNoQixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQztBQUN6QixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUMzSCxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ1AsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNQLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDO0FBQ1gsQ0FBQyxDQUFDLENBQUM7QUFDSDtBQUNBLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDakYsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDekQ7QUFDQSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUM7QUFDUCxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQzlCLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDckI7QUFDQSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUM7QUFDeEUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLFlBQVksQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUM7QUFDaEUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxjQUFjLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLGNBQWMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO0FBQ3JFO0FBQ0EsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRO0FBQ2xCLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLGNBQWMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENB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QUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBQzlELENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUM7QUFDZCxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQ3JCLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7QUFDaEIsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUM7QUFDekIsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDM0UsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNQLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDUCxDQUFDLENBQUMsQ0FBQztBQUNILENBQUM7QUFDRDtBQUNBLE1BQU0sQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNyQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7QUFDdEMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsQ0FBQyxRQUFRLENBQUMs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QyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUM5QixDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ3JCO0FBQ0EsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQztBQUMzRSxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxlQUFlLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsWUFBWSxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQztBQUNsRSxDQUFDLENBQUMsQ0FBQyxDQUFDLGNBQWMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsZUFBZSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7QUFDdkU7QUFDQSxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsWUFBWSxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQztBQUNoRSxDQUFDLENBQUMsQ0FBQyxDQUFDLGNBQWMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsY0FBYyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7QUFDckU7QUFDQSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUs7QUFDZixDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxjQUFjLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsV0FBVyxDQUFDLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDeEcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxjQUFjLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDO0FBQzFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQztBQUN2RTtBQUNBLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTTtBQUNoQixDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxjQUFjLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsV0FBVyxDQUFDLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDM0csQ0FBQyxDQUFDLENBQUMsQ0FBQyxjQUFjLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDO0FBQzVDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQztBQUMxRTtBQUNBLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7QUFDaEMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ3RELENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUM7QUFDZCxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQ3JCLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFlBQVksQ0FBQyxDQUFDLFFBQVEsQ0FBQztBQUM3QixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO0FBQ2hCLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDO0FBQ3pCLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDO0FBQzdELENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDUCxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ1AsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENB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Q3BGLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUM7QUFDZCxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQ3JCLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7QUFDaEIsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUM7QUFDekIsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDNUgsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNQLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDUCxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQztBQUNYLENBQUMsQ0FBQyxDQUFDO0FBQ0g7QUFDQSxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQyxTQUFTLENB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Q0FBQyxNQUFNLENBQUMsQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7QUFDdkU7QUFDQSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVE7QUFDbEIsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsY0FBYyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ2pILENBQUMsQ0FBQyxDQUFDLENBQUMsY0FBYyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQztBQUNoRCxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7QUFDaEY7QUFDQSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxVQUFVO0FBQ2xFLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxZQUFZLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO0FBQ2hFLENBQUMsQ0FBQyxDQUFDLENBQUMsY0FBYyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxjQUFjLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztBQUNyRTtBQUNBLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsVUFBVTtBQUNwQixDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxjQUFjLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsV0FBVyxDQUFDLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDdkgsQ0FBQyxDQUFDLENBQUMsQ0FBQyxjQUFjLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDO0FBQ3BELENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLGFBQWEsQ0FBQyxNQUFNLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxhQUFhLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQztBQUN0RjtBQUNBLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7QUFDaEMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ3RELENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUM7QUFDZCxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQ3JCLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFlBQVksQ0FBQyxDQUFDLFFBQVEsQ0FBQztBQUM3QixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO0FBQ2hCLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDO0FBQ3pCLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDO0FBQy9ELENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDUCxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ1AsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUM7QUFDbEUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDO0FBQ2pCO0FBQ0EsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO0FBQ2pCLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBQy9ELENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUM7QUFDZCxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQ3JCLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7QUFDaEIsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUM7QUFDekIsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDNUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNQLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDUCxDQUFDLENBQUMsQ0FBQztBQUNILENBQUM7In0=