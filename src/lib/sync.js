import * as cloud from './cloud.js';
import * as store from '../store.js';
import { uid } from '../models.js';

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
      });
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
  return true; // sections do not have auto-generated defaults
}

/**
 * Scans local structural data to find parent records (like default years)
 * that must be pushed because user-created children depend on them.
 */
function buildLocalDependencies(state) {
  const req = { years: new Set(), terms: new Set(), subjects: new Set(), sections: new Set() };

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

      if (isStructural && !isMeaningfulStructural(storeName, local)) {
        // Local is a generated default, and remote already has this exact ID.
        // Remote must be authoritative for this sync cycle. Hydrate local.
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
      await store.patchDevice({ ...store.state.device, ...devicePatch });
    }
    await store.save(patch);
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

  if (toPush.length > 0) {
    await cloud.upsertRecords(tableName, toPush);
  }

  if (toUpdateLocal.length > 0) {
    await store.save({ [storeName]: toUpdateLocal });
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
