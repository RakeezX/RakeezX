import * as cloud from './cloud.js';
import * as store from '../store.js';
import { uid } from '../models.js';

export const state = {
  status: 'idle', // idle, syncing
  lastSyncedAt: null, // will be initialized from store
  results: {
    profile: null,
    structural: null
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
      } else {
        // Includes remoteClientUpdatedAt >= localUpdatedAt and ambiguous/equal cases.
        // Never arbitrarily overwrite the remote record.
        console.log('[rakeezx sync] Remote is newer, equal, or ambiguous. Remote wins.');
        shouldUpdateLocal = true;
        merged = {
          teacherName: remote.teacher_name,
          schoolName: remote.school_name,
          phone: remote.phone,
          updatedAt: remoteClientUpdatedAt,
          deleted: !!remote.deleted_at
        };
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
    return !(rec.name === 'المهارات الرقمية' && rec.slug === 'almharat-alrqmyh');
  }
  return true; // sections do not have auto-generated defaults
}

/**
 * Generic sync engine for a single collection.
 * Pull → Merge → Push
 */
async function syncCollection(storeName, tableName) {
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
      // We only push if the local record is meaningful (not an auto-generated boot default).
      if (isMeaningfulStructural(storeName, local)) {
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
      
      if (localUpdatedAt > remoteClientUpdatedAt) {
        // Local is strictly newer.
        toPush.push(mapper.toCloud(local));
      } else {
        // Remote is newer, equal, or ambiguous.
        toUpdateLocal.push(mapper.fromCloud(remote));
      }
    }
  }
  
  if (toPush.length > 0) {
    await cloud.upsertRecords(tableName, toPush);
  }

  if (toUpdateLocal.length > 0) {
    // Wait for the bulk patch equivalent, actually we can use multiple save() calls or a loop
    for (const rec of toUpdateLocal) {
      await store.save(storeName, rec);
    }
  }

  return { pushed: toPush.length, pulled: toUpdateLocal.length };
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
    const stats = {};
    const order = [
      { store: 'years', table: 'years' },
      { store: 'terms', table: 'terms' },
      { store: 'subjects', table: 'subjects' },
      { store: 'sections', table: 'sections' }
    ];

    for (const { store: sName, table: tName } of order) {
      const res = await syncCollection(sName, tName);
      stats[sName] = res;
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
