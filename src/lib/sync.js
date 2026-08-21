import * as cloud from './cloud.js';
import * as store from '../store.js';
import { uid } from '../models.js';

export const state = {
  status: 'idle', // idle, syncing, success, error
  error: null,
  lastSyncedAt: null // will be initialized from store
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
  
  setState({ status: 'syncing', error: null });
  console.log('[rakeezx sync] Started profile sync...');
  
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
    setState({ status: 'success', lastSyncedAt: nowStamp });
    console.log('[rakeezx sync] Profile sync complete.');
    
  } catch (err) {
    console.warn('[rakeezx sync] Sync failed:', err);
    setState({ status: 'error', error: err.message });
  }
}
