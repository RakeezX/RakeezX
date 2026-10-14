/**
 * RAKEEZ X — Supabase API Wrapper
 * Zero-build, vanilla JS fetch wrapper for Auth and REST.
 */

import { readCompleteTable } from './complete-read.js';
import { runtimeSyncOwnershipGuard, assertNewProductWrite } from './sync-ownership.js';
import { revokeOwnerLeases, runtimeOfflineLease, workspaceLeaseBinding } from './offline-lease.js';

export const SUPABASE_URL = 'https://xlrubcwjqktzzunrvuns.supabase.co';
const PUBLISHABLE_KEY = 'sb_publishable_FDprbV07fAZhT0E6npNldQ_PINQE6l_';
export const AUTH_STORAGE_KEY = 'rakeezx-auth-v2-xl-rubcwjqktzzunrvuns';
// Explicit Product-side gate. Supabase disable_signup remains authoritative.
export const NEW_ACCOUNT_SIGNUP_ENABLED = true;
const REFRESH_SKEW_SECONDS = 30;

export let session = null;
export let user = null;
let authRequired = false;
let refreshInFlight = null;
let authContextGeneration = 0;

let mockBackend = null;
export function setMockBackend(adapter) { mockBackend = adapter; }

export async function fetchOwnerSyncMarker({ signal } = {}) {
  const ownerId = user?.id;
  if (!ownerId || !session) return null;
  const { validOwnerMarker } = await import('./remote-sync.js');
  let marker;
  try {
    marker = mockBackend ? await mockBackend.fetchOwnerSyncMarker?.()
      : await request('/rpc/owner_sync_change_marker', {
        method: 'POST', signal, headers: { 'Content-Type': 'application/json',
          'Accept-Profile': 'rakeezx', 'Content-Profile': 'rakeezx' }, body: '{}' });
  } catch (error) {
    if (error.status === 404 || error.code === 'PGRST202') return null;
    throw error;
  }
  return user?.id === ownerId && session && validOwnerMarker(marker, ownerId) ? marker : null;
}

export function openOwnerSyncChannel(options) {
  if (!user?.id || !session?.access_token || options.ownerId !== user.id || options.accessToken !== session.access_token) {
    throw new Error('Owner signal identity changed');
  }
  if (mockBackend) return mockBackend.openOwnerSyncChannel?.(options) ?? (() => {});
  let stopped = false, close;
  void import('./owner-invalidation-channel.js').then(({ openOwnerInvalidationChannel }) => {
    if (stopped || options.ownerId !== user?.id || options.accessToken !== session?.access_token) return;
    close = openOwnerInvalidationChannel({ ...options, url: SUPABASE_URL, apiKey: PUBLISHABLE_KEY });
  }).catch(() => {});
  return () => { stopped = true; close?.(); };
}

export function setMockAuth(u, s) {
  if (user?.id !== u?.id || !!session !== !!s) authContextGeneration++;
  user = u;
  session = s;
  authRequired = false;
}

export function authStatus() {
  return { state: authRequired ? 'auth_required' : session && user ? 'authenticated' : 'signed_out' };
}

export function isAuthRequiredError(error) {
  return error?.code === 'AUTH_REQUIRED';
}

const listeners = new Set();
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function notify() {
  listeners.forEach((fn) => fn());
}

function authError(message = 'Authentication required') {
  const error = new Error(message);
  error.code = 'AUTH_REQUIRED';
  error.status = 401;
  return error;
}

function sessionExpiresAt(value = session) {
  const explicit = Number(value?.expires_at);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  try {
    const payload = JSON.parse(atob(String(value?.access_token ?? '').split('.')[1]));
    return Number(payload?.exp) || 0;
  } catch {
    return 0;
  }
}

function tokenNeedsRefresh(value = session) {
  const expiresAt = sessionExpiresAt(value);
  return !!expiresAt && expiresAt <= Math.floor(Date.now() / 1000) + REFRESH_SKEW_SECONDS;
}

function parseFailure(data, status) {
  const error = new Error(data?.message || data?.error_description || `Request failed: ${status}`);
  for (const field of ['code', 'details', 'hint', 'constraint']) {
    if (data?.[field] !== undefined) error[field] = data[field];
  }
  error.status = status;
  return error;
}

async function responseFailure(response) {
  let data = null;
  try { data = await response.clone().json(); } catch {}
  const error = parseFailure(data, response.status);
  const retryAfter = response.headers.get('retry-after');
  if (retryAfter) {
    const numericSeconds = Number(retryAfter);
    const dateSeconds = Math.ceil((Date.parse(retryAfter) - Date.now()) / 1000);
    const seconds = Number.isFinite(numericSeconds) ? Math.ceil(numericSeconds) : dateSeconds;
    if (Number.isFinite(seconds) && seconds > 0) error.retryAfterSeconds = seconds;
  }
  return error;
}

function persistedAuthOwner() {
  try { return JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) || 'null')?.user?.id ?? null; }
  catch { return null; }
}

function saveSession(data, { required = true } = {}) {
  const nextUserId = data?.access_token ? (data.user?.id ?? user?.id) : null;
  const priorPersistedOwner = persistedAuthOwner();
  if (priorPersistedOwner && priorPersistedOwner !== nextUserId) {
    revokeOwnerLeases(priorPersistedOwner);
    revokeScoreCapabilities(priorPersistedOwner);
  }
  if (user?.id && user.id !== nextUserId) {
    revokeOwnerLeases(user.id);
    revokeScoreCapabilities(user.id);
  }
  if ((user?.id ?? null) !== (nextUserId ?? null) || !!session !== !!data?.access_token) authContextGeneration++;
  if (!data?.access_token) {
    session = null;
    user = null;
    authRequired = required;
    localStorage.removeItem(AUTH_STORAGE_KEY);
  } else {
    const priorUser = user;
    const expiresAt = Number(data.expires_at) ||
      (Number(data.expires_in) ? Math.floor(Date.now() / 1000) + Number(data.expires_in) : undefined);
    session = { ...data, ...(expiresAt ? { expires_at: expiresAt } : {}) };
    user = data.user ?? priorUser ?? null;
    if (user && !session.user) session.user = user;
    authRequired = false;
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
  }
  notify();
}

export async function refreshSession() {
  if (refreshInFlight) return refreshInFlight;
  if (!session?.refresh_token) {
    saveSession(null);
    throw authError('No refresh token is available');
  }
  const refreshToken = session.refresh_token;
  const previous = session;
  const expectedOwnerId = user?.id;
  const contextGeneration = authContextGeneration;
  const assertRefreshContext = () => {
    if (authContextGeneration !== contextGeneration || persistedAuthOwner() !== expectedOwnerId) {
      throw Object.assign(new Error('Authentication changed during refresh'), { code: 'AUTH_CONTEXT_CHANGED' });
    }
  };
  refreshInFlight = (async () => {
    let response;
    try {
      response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
        method: 'POST',
        headers: { apikey: PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
    } catch (error) {
      error.code ??= 'AUTH_NETWORK';
      throw error;
    }
    assertRefreshContext();
    if (!response.ok) {
      const failure = await responseFailure(response);
      assertRefreshContext();
      if ([400, 401, 403].includes(response.status)) {
        saveSession(null);
        throw authError(failure.message);
      }
      throw failure;
    }
    const refreshed = await response.json();
    assertRefreshContext();
    saveSession({ ...previous, ...refreshed, user: refreshed.user ?? previous.user ?? user });
    return session;
  })().finally(() => { refreshInFlight = null; });
  return refreshInFlight;
}

async function ensureFreshSession() {
  if (!session || !tokenNeedsRefresh(session)) return session;
  return refreshSession();
}

async function sendRequest(path, options, isAuth) {
  const headers = {
    apikey: PUBLISHABLE_KEY,
    ...options.headers,
  };
  
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  } else if (!isAuth) {
    headers.Authorization = `Bearer ${PUBLISHABLE_KEY}`;
  }
  const base = isAuth ? `${SUPABASE_URL}/auth/v1` : `${SUPABASE_URL}/rest/v1`;
  return fetch(`${base}${path}`, {
    ...options,
    headers,
  });
}

export async function request(path, options = {}, isAuth = false, { responseMetadata = false, assertAccess = () => {} } = {}) {
  assertAccess();
  if (!isAuth) await ensureFreshSession();
  assertAccess();
  const attemptedToken = session?.access_token ?? null;
  let res = await sendRequest(path, options, isAuth);
  assertAccess();
  if (!isAuth && [401, 403].includes(res.status)) {
    if (session?.refresh_token) {
      if (session.access_token === attemptedToken) await refreshSession();
      assertAccess();
      res = await sendRequest(path, options, false);
      assertAccess();
    }
    if ([401, 403].includes(res.status)) {
      const failure = await responseFailure(res);
      assertAccess();
      saveSession(null);
      throw authError(failure.message);
    }
  }
  if (!res.ok) {
    throw await responseFailure(res);
  }
  
  const result = (data) => responseMetadata ? { data, contentRange: res.headers.get('content-range') } : data;
  if (res.status === 204) return result(null);
  
  const text = await res.text();
  assertAccess();
  if (!text) return result(null);
  
  try {
    return result(JSON.parse(text));
  } catch (err) {
    if (!responseMetadata) console.warn('[rakeezx cloud] Non-JSON response:', text);
    return result(text);
  }
}

export async function init({ waitForRefresh = true } = {}) {
  const stored = localStorage.getItem(AUTH_STORAGE_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (parsed?.access_token) {
        saveSession(parsed);
        if (tokenNeedsRefresh(parsed)) {
          const refresh = refreshSession().catch((error) => {
            if (!isAuthRequiredError(error)) console.warn('[rakeezx auth] Session refresh deferred until connectivity returns.');
          });
          if (waitForRefresh) await refresh;
        }
      }
    } catch (e) {
      console.warn('[rakeezx cloud] Failed to parse stored session', e);
      saveSession(null, { required: false });
    }
  }
}

export async function signIn(email, password) {
  const data = await request('/token?grant_type=password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  }, true);
  saveSession(data);
}

/** One email OTP flow; the global Product gate controls new-user creation. */
export async function requestEmailOtp(email) {
  return request('/otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, create_user: NEW_ACCOUNT_SIGNUP_ENABLED }),
  }, true);
}

/** Verifies an email OTP and persists the returned Supabase session. */
export async function verifyEmailOtp(email, token) {
  const data = await request('/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, token, type: 'email' }),
  }, true);
  if (!data?.access_token || !data?.user?.id) throw authError('OTP verification did not return an authenticated user');
  saveSession(data);
  return user;
}

/**
 * Revalidate the current Auth identity with Supabase before a local workspace
 * ownership transition. Cached session/user data alone is deliberately not
 * sufficient for this operation.
 */
export async function verifyCurrentAuthIdentity(expectedOwnerId) {
  const contextGeneration = authContextGeneration;
  const expected = String(expectedOwnerId ?? '').trim().toLowerCase();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(expected)) {
    throw Object.assign(new Error('A valid expected Auth user ID is required'), { code: 'INVALID_AUTH_USER_ID' });
  }
  await ensureFreshSession();
  if (!session?.access_token) throw authError('Authentication required');
  let verified;
  try {
    verified = await request('/user', { method: 'GET' }, true);
  } catch (error) {
    if ([401, 403].includes(error?.status) && contextGeneration === authContextGeneration && user?.id === expected && persistedAuthOwner() === expected) {
      saveSession(null);
    }
    throw error;
  }
  const persistedOwner = persistedAuthOwner();
  if (contextGeneration !== authContextGeneration || user?.id !== expected || !session?.access_token || persistedOwner !== expected) {
    throw Object.assign(new Error('Authentication changed during owner verification'), { code: 'AUTH_CONTEXT_CHANGED' });
  }
  const actual = String(verified?.id ?? '').trim().toLowerCase();
  if (actual !== expected) {
    revokeOwnerLeases(expected);
    revokeScoreCapabilities(expected);
    throw Object.assign(new Error('Verified Auth user does not match the expected workspace owner'), {
      code: 'AUTH_OWNER_MISMATCH', expectedOwnerId: expected, verifiedOwnerId: actual || null,
    });
  }
  saveSession({ ...session, user: verified });
  return Object.freeze({
    id: actual,
    verifiedAt: Date.now(),
    source: 'supabase-auth-user',
  });
}

/**
 * Request an Auth-authoritative email change. With Secure Email Change enabled,
 * Supabase keeps the current email authoritative until both confirmations finish.
 */
export async function updateCurrentUserEmail(email) {
  await ensureFreshSession();
  if (!session?.access_token || !user?.id) throw authError('Authentication required');
  const expectedOwnerId = String(user.id).trim().toLowerCase();
  const updated = await request('/user', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  }, true);
  const actualOwnerId = String(updated?.id ?? '').trim().toLowerCase();
  if (actualOwnerId !== expectedOwnerId) {
    throw Object.assign(new Error('Updated Auth user does not match the active workspace owner'), {
      code: 'AUTH_OWNER_MISMATCH', expectedOwnerId, verifiedOwnerId: actualOwnerId || null,
    });
  }
  saveSession({ ...session, user: { ...user, ...updated, id: expectedOwnerId } });
  return user;
}

export async function signOut() {
  const priorToken = session?.access_token;
  // Revoke immediately, including while an offline logout request is pending.
  saveSession(null, { required: false });
  if (priorToken) {
    try {
      await request('/logout', { method: 'POST', headers: { Authorization: `Bearer ${priorToken}` } }, true);
    } catch (e) {
      console.warn('[rakeezx cloud] Logout request failed, clearing local session anyway', e);
    }
  }
}

export async function fetchProfile() {
  if (mockBackend) return mockBackend.fetchProfile();
  if (!user) throw new Error('Not authenticated');
  const data = await request(`/profile?owner_id=eq.${user.id}&select=*`, {
    headers: {
      'Accept': 'application/json',
      'Accept-Profile': 'rakeezx'
    }
  });
  return data?.[0] || null;
}

export async function insertProfile(profileData) {
  if (mockBackend) return mockBackend.insertProfile(profileData);
  if (!user) throw new Error('Not authenticated');

  const payload = {
    ...profileData,
    owner_id: user.id
  };

  const data = await request('/profile', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
      'Accept-Profile': 'rakeezx',
      'Content-Profile': 'rakeezx'
    },
    body: JSON.stringify(payload)
  });
  return data?.[0] || null;
}

export async function updateProfile(profileData) {
  if (mockBackend) return mockBackend.updateProfile(profileData);
  if (!user) throw new Error('Not authenticated');
  
  const data = await request(`/profile?owner_id=eq.${user.id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
      'Accept-Profile': 'rakeezx',
      'Content-Profile': 'rakeezx'
    },
    body: JSON.stringify(profileData)
  });
  return data?.[0] || null;
}

/** Owner-derived account profile/access foundation RPCs. */
export async function getAccountContract() {
  if (mockBackend) {
    if (typeof mockBackend.getAccountContract !== 'function') {
      throw new Error('Mock backend does not implement account contract RPC');
    }
    return mockBackend.getAccountContract();
  }
  if (!user) throw authError('Authentication required');
  return request('/rpc/account_contract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json',
      'Accept-Profile': 'rakeezx', 'Content-Profile': 'rakeezx' },
    body: '{}',
  });
}

export async function provisionAccountProfile() {
  if (mockBackend) {
    if (typeof mockBackend.provisionAccountProfile !== 'function') {
      throw new Error('Mock backend does not implement account provisioning RPC');
    }
    return mockBackend.provisionAccountProfile();
  }
  if (!user) throw authError('Authentication required');
  return request('/rpc/provision_account_profile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json',
      'Accept-Profile': 'rakeezx', 'Content-Profile': 'rakeezx' },
    body: '{}',
  });
}

export async function completeAccountProfile(profile) {
  if (mockBackend) {
    if (typeof mockBackend.completeAccountProfile !== 'function') {
      throw new Error('Mock backend does not implement profile completion RPC');
    }
    return mockBackend.completeAccountProfile(profile);
  }
  if (!user) throw authError('Authentication required');
  return request('/rpc/complete_account_profile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json',
      'Accept-Profile': 'rakeezx', 'Content-Profile': 'rakeezx' },
    body: JSON.stringify({
      p_teacher_name: profile.teacherName,
      p_phone: profile.phone,
      p_teacher_form: profile.teacherForm,
      p_school_name: profile.schoolName || null,
    }),
  });
}

export async function beginAccountProvisioning() {
  if (mockBackend) return mockBackend.beginAccountProvisioning();
  if (!user) throw authError('Authentication required');
  return request('/rpc/begin_account_provisioning', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json',
      'Accept-Profile': 'rakeezx', 'Content-Profile': 'rakeezx' },
    body: '{}',
  });
}

export async function provisionAccountWorkspace(defaults) {
  if (mockBackend) return mockBackend.provisionAccountWorkspace(defaults);
  if (!user) throw authError('Authentication required');
  return request('/rpc/provision_account_workspace', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json',
      'Accept-Profile': 'rakeezx', 'Content-Profile': 'rakeezx' },
    body: JSON.stringify({ p_defaults: defaults }),
  });
}

/** End account profile/access foundation RPCs. */

export async function upsertRecords(tableName, records) {
  if (mockBackend) return mockBackend.upsertRecords(tableName, records);
  if (!user) throw new Error('Not authenticated');
  if (!records || !records.length) return { success: true };

  const payload = records.map(r => ({ ...r, owner_id: user.id }));

  await request(`/${tableName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates',
      'Accept-Profile': 'rakeezx',
      'Content-Profile': 'rakeezx'
    },
    body: JSON.stringify(payload)
  });
  
  return { success: true };
}

/**
 * Applies one Sync V2 mutation through the idempotent server protocol.
 *
 * Used by the Sync V2 runtime coordinator for generic mutations.
 * Callers must retain the exact envelope (especially mutationId) until this
 * request returns a canonical receipt.
 */
export async function applySyncV2Mutation(envelope) {
  if (mockBackend) {
    if (typeof mockBackend.applySyncV2Mutation !== 'function') {
      throw new Error('Mock backend does not implement Sync V2 mutation RPC');
    }
    return mockBackend.applySyncV2Mutation(envelope);
  }
  if (!user) throw new Error('Not authenticated');

  return request('/rpc/apply_sync_v2_mutation', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Accept-Profile': 'rakeezx',
      'Content-Profile': 'rakeezx',
    },
    body: JSON.stringify({
      p_entity: envelope.entity,
      p_record_id: envelope.recordId,
      p_mutation_id: envelope.mutationId,
      p_device_id: envelope.deviceId,
      p_base_revision: envelope.baseRevision,
      p_patch: envelope.patch ?? {},
      p_operation: envelope.operation,
      p_client_updated_at: envelope.clientUpdatedAt ?? null,
    }),
  });
}

/** Owner-derived curriculum bootstrap status. Domain rows are never returned here. */
export async function getCurriculumSyncBootstrapStatus() {
  if (mockBackend) {
    if (typeof mockBackend.getCurriculumSyncBootstrapStatus !== 'function') {
      throw new Error('Mock backend does not implement curriculum bootstrap status RPC');
    }
    return mockBackend.getCurriculumSyncBootstrapStatus();
  }
  if (!user) throw authError('Authentication required');
  return request('/rpc/get_curriculum_sync_bootstrap_status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json',
      'Accept-Profile': 'rakeezx', 'Content-Profile': 'rakeezx' },
    body: '{}',
  });
}

/** Atomic, same-owner historical curriculum contribution. */
export async function contributeCurriculumSyncBootstrap(envelope) {
  assertNewProductWrite();
  if (mockBackend) {
    if (typeof mockBackend.contributeCurriculumSyncBootstrap !== 'function') {
      throw new Error('Mock backend does not implement curriculum bootstrap contribution RPC');
    }
    return mockBackend.contributeCurriculumSyncBootstrap(envelope);
  }
  if (!user) throw authError('Authentication required');
  return request('/rpc/contribute_curriculum_sync_bootstrap', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json',
      'Accept-Profile': 'rakeezx', 'Content-Profile': 'rakeezx' },
    body: JSON.stringify({
      p_bootstrap_id: envelope.bootstrapId,
      p_device_id: envelope.deviceId,
      p_snapshot_hash: envelope.snapshotHash,
      p_units: envelope.units,
      p_lessons: envelope.lessons,
      p_authoritative: envelope.authoritative === true,
    }),
  });
}

/** Explicitly finalizes the accepted authoritative snapshot. */
export async function finalizeCurriculumSyncBootstrap(envelope) {
  if (mockBackend) {
    if (typeof mockBackend.finalizeCurriculumSyncBootstrap !== 'function') {
      throw new Error('Mock backend does not implement curriculum bootstrap finalize RPC');
    }
    return mockBackend.finalizeCurriculumSyncBootstrap(envelope);
  }
  if (!user) throw authError('Authentication required');
  return request('/rpc/finalize_curriculum_sync_bootstrap', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json',
      'Accept-Profile': 'rakeezx', 'Content-Profile': 'rakeezx' },
    body: JSON.stringify({
      p_bootstrap_id: envelope.bootstrapId,
      p_device_id: envelope.deviceId,
      p_snapshot_hash: envelope.snapshotHash,
    }),
  });
}

export async function getSyncV2RestoreManifestFull({ signal } = {}) {
  if (mockBackend) return mockBackend.getSyncV2RestoreManifestFull({ signal });
  if (!user) throw authError('Authentication required');
  return request('/rpc/sync_v2_restore_manifest_full', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json',
      'Accept-Profile': 'rakeezx', 'Content-Profile': 'rakeezx' },
    body: JSON.stringify({ p_owner: user.id }), signal,
  });
}

export async function getScoreRestoreManifestV2({ signal } = {}) {
  if (mockBackend) {
    if (typeof mockBackend.getScoreRestoreManifestV2 !== 'function') {
      throw new Error('Mock backend does not implement CORE_V2 manifest');
    }
    return mockBackend.getScoreRestoreManifestV2({ signal });
  }
  if (!user) throw authError('Authentication required');
  return request('/rpc/sync_v2_restore_manifest_score_v2', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json',
      'Accept-Profile': 'rakeezx', 'Content-Profile': 'rakeezx' },
    body: JSON.stringify({ p_owner: user.id }), signal,
  });
}

export async function getScoreRestoreCanonicalV2() {
  if (mockBackend) {
    if (typeof mockBackend.getScoreRestoreCanonicalV2 !== 'function') {
      throw new Error('Mock backend does not implement CORE_V2 canonical snapshot');
    }
    return mockBackend.getScoreRestoreCanonicalV2();
  }
  if (!user) throw authError('Authentication required');
  return request('/rpc/sync_v2_restore_canonical_score_v2', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json',
      'Accept-Profile': 'rakeezx', 'Content-Profile': 'rakeezx' },
    body: JSON.stringify({ p_owner: user.id }),
  });
}

/** One deterministic owner-scoped page used by Initial Restore V1. */
export async function fetchRestoreEntityPage(entity, { offset = 0, limit = 500, signal } = {}) {
  if (mockBackend) {
    if (typeof mockBackend.fetchRestoreEntityPage !== 'function') {
      throw new Error('Mock backend does not implement paginated Initial Restore');
    }
    return mockBackend.fetchRestoreEntityPage(entity, { offset, limit, signal });
  }
  if (!user?.id) throw authError('Authentication required');
  if (!/^[a-z_]+$/.test(String(entity)) || !Number.isSafeInteger(offset) || offset < 0 ||
      !Number.isSafeInteger(limit) || limit < 1 || limit > 500) {
    throw new Error('Invalid Initial Restore page request');
  }
  const order = entity === 'profile' ? 'owner_id.asc' : 'id.asc';
  return request(`/${entity}?owner_id=eq.${encodeURIComponent(user.id)}&select=*&order=${order}&limit=${limit}&offset=${offset}`, {
    headers: { 'Accept': 'application/json', 'Accept-Profile': 'rakeezx' }, signal,
  });
}

export async function getSyncV2RestoreCanonicalFull() {
  if (mockBackend) return mockBackend.getSyncV2RestoreCanonicalFull();
  if (!user) throw authError('Authentication required');
  return request('/rpc/sync_v2_restore_canonical_full', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json',
      'Accept-Profile': 'rakeezx', 'Content-Profile': 'rakeezx' },
    body: JSON.stringify({ p_owner: user.id }),
  });
}

/** Sync V2 enrollment command transport. */
export async function applySyncV2EnrollmentCommand(envelope) {
  if (mockBackend) {
    if (typeof mockBackend.applySyncV2EnrollmentCommand !== 'function') {
      throw new Error('Mock backend does not implement Sync V2 enrollment command RPC');
    }
    return mockBackend.applySyncV2EnrollmentCommand(envelope);
  }
  if (!user) throw new Error('Not authenticated');
  return request('/rpc/apply_sync_v2_enrollment_command', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json', 'Accept': 'application/json',
      'Accept-Profile': 'rakeezx', 'Content-Profile': 'rakeezx',
    },
    body: JSON.stringify({
      p_mutation_id: envelope.mutationId,
      p_device_id: envelope.deviceId,
      p_command: envelope.command,
      p_payload: envelope.payload,
      p_client_updated_at: envelope.clientUpdatedAt ?? null,
    }),
  });
}

/** Read-only owner-derived removal classification; no lifecycle envelope. */
export async function previewStudentRemoval(studentId, enrollmentId, revision) {
  if (mockBackend) return mockBackend.previewStudentRemoval(studentId, enrollmentId, revision);
  return request('/rpc/preview_student_removal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept-Profile': 'rakeezx', 'Content-Profile': 'rakeezx' },
    body: JSON.stringify({ p_student_id: studentId, p_source_enrollment_id: enrollmentId, p_source_revision: revision }),
  });
}

export async function applyStudentLifecycleCommand(envelope) {
  if (mockBackend) return mockBackend.applyStudentLifecycleCommand(envelope);
  return request('/rpc/apply_student_lifecycle_command', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept-Profile': 'rakeezx', 'Content-Profile': 'rakeezx' },
    body: JSON.stringify({ p_mutation_id: envelope.mutationId, p_device_id: envelope.deviceId,
      p_command: envelope.command, p_payload: envelope.payload, p_client_updated_at: envelope.clientUpdatedAt }),
  });
}

/** Sync V2 attendance/snapshot command transport. */
export async function applySyncV2AttendanceCommand(envelope) {
  if (mockBackend) {
    if (typeof mockBackend.applySyncV2AttendanceCommand !== 'function') {
      throw new Error('Mock backend does not implement Sync V2 attendance command RPC');
    }
    return mockBackend.applySyncV2AttendanceCommand(envelope);
  }
  if (!user) throw new Error('Not authenticated');
  return request('/rpc/apply_sync_v2_attendance_command', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json', 'Accept': 'application/json',
      'Accept-Profile': 'rakeezx', 'Content-Profile': 'rakeezx',
    },
    body: JSON.stringify({
      p_mutation_id: envelope.mutationId,
      p_device_id: envelope.deviceId,
      p_attendance_id: envelope.attendanceId,
      p_session_id: envelope.sessionId,
      p_student_id: envelope.studentId,
      p_base_revision: envelope.baseRevision,
      p_patch: envelope.patch,
      p_client_updated_at: envelope.clientUpdatedAt ?? null,
    }),
  });
}

/** Server-authoritative guarded deletion for one dated session. */
export async function applySyncV2SessionDeleteCommand(envelope) {
  if (mockBackend) {
    if (typeof mockBackend.applySyncV2SessionDeleteCommand !== 'function') {
      throw new Error('Mock backend does not implement Sync V2 session delete command RPC');
    }
    return mockBackend.applySyncV2SessionDeleteCommand(envelope);
  }
  if (!user) throw new Error('Not authenticated');
  return request('/rpc/apply_sync_v2_session_delete_command', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json', 'Accept': 'application/json',
      'Accept-Profile': 'rakeezx', 'Content-Profile': 'rakeezx',
    },
    body: JSON.stringify({
      p_mutation_id: envelope.mutationId,
      p_device_id: envelope.deviceId,
      p_session_id: envelope.sessionId,
      p_client_updated_at: envelope.clientUpdatedAt ?? null,
    }),
  });
}

/** Sync V2 lifecycle/cascade command transport. */
export async function applySyncV2LifecycleCommand(envelope) {
  if (mockBackend) {
    if (typeof mockBackend.applySyncV2LifecycleCommand !== 'function') throw new Error('Mock backend does not implement Sync V2 lifecycle command RPC');
    return mockBackend.applySyncV2LifecycleCommand(envelope);
  }
  if (!user) throw new Error('Not authenticated');
  return request('/rpc/apply_sync_v2_lifecycle_command', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'Accept-Profile': 'rakeezx', 'Content-Profile': 'rakeezx' },
    body: JSON.stringify({ p_mutation_id: envelope.mutationId, p_device_id: envelope.deviceId, p_command: envelope.command, p_target_id: envelope.targetId, p_client_updated_at: envelope.clientUpdatedAt ?? null }),
  });
}

/** N77 server-authoritative preview and atomic Delete. Both calls are owner-bound RPCs. */
export async function n77DeleteTeaching({ teachingId, sectionId, fingerprint = null, mutationId = null,
  deviceId = null, commit = false }) {
  const ownerId = user?.id;
  const workspace = runtimeSyncOwnershipGuard.getWorkspace();
  const access = runtimeSyncOwnershipGuard.cloudAccess({ operation: 'pull', authenticatedUserId: ownerId });
  if (!access.allowed || !ownerId || !session?.access_token || !globalThis.navigator?.onLine) {
    throw Object.assign(new Error('N77 Delete requires a verified online account workspace'), { code: 'N77_OFFLINE_OR_OWNER' });
  }
  const assertAccess = () => {
    if (user?.id !== ownerId || runtimeSyncOwnershipGuard.getWorkspace() !== workspace || !session?.access_token) {
      throw Object.assign(new Error('N77 Delete account/workspace changed'), { code: 'N77_OWNER_CHANGED' });
    }
  };
  await verifyCurrentAuthIdentity(ownerId);
  assertAccess();
  const input = { teachingId, sectionId, fingerprint, mutationId, deviceId, commit };
  const result = mockBackend ? await mockBackend.n77DeleteTeaching(input)
    : await request('/rpc/n77_delete_teaching', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json',
        'Accept-Profile': 'rakeezx', 'Content-Profile': 'rakeezx' },
      body: JSON.stringify({ p_teaching_id: teachingId, p_expected_section_id: sectionId,
        p_expected_fingerprint: fingerprint, p_mutation_id: mutationId, p_device_id: deviceId,
        p_commit: commit }),
    }, false, { assertAccess });
  assertAccess();
  return result;
}

/** Sync V2 section archive/reopen command transport. */
export async function applySyncV2SectionLifecycleCommand(envelope) {
  if (mockBackend) {
    if (typeof mockBackend.applySyncV2SectionLifecycleCommand !== 'function') throw new Error('Mock backend does not implement Sync V2 section lifecycle RPC');
    return mockBackend.applySyncV2SectionLifecycleCommand(envelope);
  }
  if (!user) throw new Error('Not authenticated');
  return request('/rpc/apply_sync_v2_section_lifecycle_command', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'Accept-Profile': 'rakeezx', 'Content-Profile': 'rakeezx' },
    body: JSON.stringify({ p_mutation_id: envelope.mutationId, p_device_id: envelope.deviceId,
      p_command: envelope.command, p_section_id: envelope.targetId, p_archive_date: envelope.archiveDate,
      p_client_updated_at: envelope.clientUpdatedAt ?? null }),
  });
}

export async function applySyncV2TeachingCreationCommand(envelope) {
  if (mockBackend) {
    if (typeof mockBackend.applySyncV2TeachingCreationCommand !== 'function') throw new Error('Mock backend does not implement Sync V2 teaching command RPC');
    return mockBackend.applySyncV2TeachingCreationCommand(envelope);
  }
  if (!user) throw new Error('Not authenticated');
  return request('/rpc/apply_sync_v2_teaching_creation_command', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'Accept-Profile': 'rakeezx', 'Content-Profile': 'rakeezx' },
    body: JSON.stringify({ p_mutation_id: envelope.mutationId, p_device_id: envelope.deviceId, p_teaching_id: envelope.teachingId,
      p_section_id: envelope.sectionId, p_subject_id: envelope.subjectId, p_term_id: envelope.termId, p_order: envelope.order,
      p_item_ids: envelope.itemIds, p_client_updated_at: envelope.clientUpdatedAt ?? null }),
  });
}

export async function applySyncV2FillAttendanceCommand(envelope) {
  if (mockBackend) return mockBackend.applySyncV2FillAttendanceCommand(envelope);
  if (!user) throw new Error('Not authenticated');
  return request('/rpc/apply_sync_v2_fill_attendance_command', { method: 'POST', headers: { 'Content-Type':'application/json','Accept':'application/json','Accept-Profile':'rakeezx','Content-Profile':'rakeezx' }, body: JSON.stringify({ p_mutation_id:envelope.mutationId,p_device_id:envelope.deviceId,p_session_id:envelope.sessionId,p_status:envelope.status,p_client_updated_at:envelope.clientUpdatedAt ?? null }) });
}

/** Atomic close/correction command for immutable closed-term report truth. */
export async function applySyncV2ClosedTermReportCommand(envelope) {
  if (mockBackend) {
    if (typeof mockBackend.applySyncV2ClosedTermReportCommand !== 'function') {
      throw new Error('Mock backend does not implement closed-term report RPC');
    }
    return mockBackend.applySyncV2ClosedTermReportCommand(envelope);
  }
  if (!user) throw new Error('Not authenticated');
  return request('/rpc/apply_sync_v2_closed_term_report_command', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json', 'Accept': 'application/json',
      'Accept-Profile': 'rakeezx', 'Content-Profile': 'rakeezx',
    },
    body: JSON.stringify({
      p_mutation_id: envelope.mutationId,
      p_device_id: envelope.deviceId,
      p_command: envelope.command,
      p_term_id: envelope.termId,
      p_report_id: envelope.reportId,
      p_supersedes_id: envelope.supersedesId ?? null,
      p_source_manifest: envelope.sourceManifest,
      p_payload: envelope.payload,
      p_client_updated_at: envelope.clientUpdatedAt ?? null,
    }),
  });
}

/** Atomic class-goal completion and participation reward. */
export async function applySyncV2ClassGoalRewardCommand(envelope) {
  if (mockBackend) {
    if (typeof mockBackend.applySyncV2ClassGoalRewardCommand !== 'function') {
      throw new Error('Mock backend does not implement class goal reward RPC');
    }
    return mockBackend.applySyncV2ClassGoalRewardCommand(envelope);
  }
  if (!user) throw new Error('Not authenticated');
  return request('/rpc/apply_sync_v2_class_goal_reward_command', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json', 'Accept': 'application/json',
      'Accept-Profile': 'rakeezx', 'Content-Profile': 'rakeezx',
    },
    body: JSON.stringify({
      p_mutation_id: envelope.mutationId,
      p_device_id: envelope.deviceId,
      p_goal_id: envelope.goalId,
      p_run_id: envelope.runId,
      p_client_updated_at: envelope.clientUpdatedAt ?? null,
    }),
  });
}

/** Score provenance and final numeric projection share one server transaction. */
export async function applyScoreSubitemCommand(envelope) {
  if (mockBackend) {
    if (typeof mockBackend.applyScoreSubitemCommand !== 'function') {
      throw new Error('Mock backend does not implement score subitem command RPC');
    }
    return mockBackend.applyScoreSubitemCommand(envelope);
  }
  if (!user) throw authError('Authentication required');
  if (Object.hasOwn(envelope, 'completionState')) {
    const capability = await getScoreFoundationCapability();
    if (capability?.n94SubitemVersion !== 1) throw new Error('N94 server capability is unavailable');
    return request('/rpc/apply_score_subitem_command_n94', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json',
        'Accept-Profile': 'rakeezx', 'Content-Profile': 'rakeezx' },
      body: JSON.stringify({ p_mutation_id: envelope.mutationId, p_device_id: envelope.deviceId,
        p_command: envelope.command, p_item_id: envelope.itemId, p_student_id: envelope.studentId,
        p_subitem_id: envelope.subitemId ?? null, p_completion_state: envelope.completionState,
        p_manual_value: envelope.manualValue ?? null }),
    });
  }
  return request('/rpc/apply_score_subitem_command', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json',
      'Accept-Profile': 'rakeezx', 'Content-Profile': 'rakeezx' },
    body: JSON.stringify({ p_mutation_id: envelope.mutationId, p_device_id: envelope.deviceId,
      p_command: envelope.command, p_item_id: envelope.itemId, p_student_id: envelope.studentId,
      p_subitem_id: envelope.subitemId ?? null, p_checked: envelope.checked ?? null,
      p_manual_value: envelope.manualValue ?? null }),
  });
}

export async function applyScoreConfigurationCommand(envelope) {
  if (mockBackend) {
    if (typeof mockBackend.applyScoreConfigurationCommand !== 'function') {
      throw new Error('Mock backend does not implement score configuration command RPC');
    }
    return mockBackend.applyScoreConfigurationCommand(envelope);
  }
  if (!user) throw authError('Authentication required');
  return request('/rpc/apply_score_configuration_command', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json',
      'Accept-Profile': 'rakeezx', 'Content-Profile': 'rakeezx' },
    body: JSON.stringify({ p_mutation_id: envelope.mutationId, p_device_id: envelope.deviceId,
      p_item_id: envelope.itemId, p_expected_version: envelope.expectedVersion,
      p_payload: envelope.payload }),
  });
}

export async function applyScoreDistributionCopyCommand(envelope) {
  if (mockBackend) {
    if (typeof mockBackend.applyScoreDistributionCopyCommand !== 'function') {
      throw new Error('Mock backend lacks score distribution copy RPC');
    }
    return mockBackend.applyScoreDistributionCopyCommand(envelope);
  }
  if (!user) throw new Error('Not authenticated');
  return request('/rpc/apply_score_distribution_copy_command', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json',
      'Accept-Profile': 'rakeezx', 'Content-Profile': 'rakeezx' },
    body: JSON.stringify({ p_mutation_id: envelope.mutationId, p_device_id: envelope.deviceId,
      p_source_item_id: envelope.sourceItemId, p_source_revision: envelope.sourceRevision,
      p_target_teaching_id: envelope.targetTeachingId, p_new_item_id: envelope.newItemId,
      p_subitem_ids: envelope.subitemIds, p_conflict_choice: envelope.conflictChoice }),
  });
}

const SCORE_CAPABILITY_PREFIX = 'rakeezx-score-capability-v1:';
const SCORE_CAPABILITY_MAX_AGE = 14 * 86400000;
function revokeScoreCapabilities(ownerId) {
  for (let index = localStorage.length - 1; index >= 0; index--) {
    const key = localStorage.key(index);
    if (!key?.startsWith(SCORE_CAPABILITY_PREFIX)) continue;
    try {
      if (JSON.parse(JSON.parse(localStorage.getItem(key)).binding)[0] === ownerId) localStorage.removeItem(key);
    } catch { localStorage.removeItem(key); }
  }
}
const scoreCapabilityCompatible = (value) => value?.scoreDomainVersion === 1 &&
  value?.restoreProtocol === 'CORE_V2' && value?.backupVersion === 5 && value?.copyDomainVersion === 1;
function capabilityChecksum(body) {
  let hash = 2166136261;
  for (const char of JSON.stringify(body)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return (hash >>> 0).toString(16);
}
const offlineCapabilityError = () => Object.assign(new Error(
  'يلزم الاتصال للتحقق من دعم البنود الفرعية لهذا الحساب، ثم يمكنك تعديلها دون اتصال.'
), { code: 'SCORE_CAPABILITY_UNVERIFIED' });

/** Cache actual RPC evidence only. It is local evidence, never a server grant.
 * Sync/renewal may refresh it online; only local commands opt into fallback.
 */
export async function getScoreFoundationCapability({ workspace, allowOffline = false } = {}) {
  const binding = workspaceLeaseBinding(workspace);
  const owner = user?.id, generation = authContextGeneration;
  const key = binding ? SCORE_CAPABILITY_PREFIX + workspace.id : null;
  const assertContext = () => {
    if (binding && (owner !== workspace.authUserId || user?.id !== owner || !session?.access_token ||
        persistedAuthOwner() !== owner || generation !== authContextGeneration)) {
      throw Object.assign(new Error('Score capability owner changed'), { code: 'AUTH_CONTEXT_CHANGED' });
    }
  };
  const cached = () => {
    assertContext();
    if (!binding) throw offlineCapabilityError();
    runtimeOfflineLease().assertWritable();
    try {
      const { checksum, ...receipt } = JSON.parse(localStorage.getItem(key) || 'null');
      const age = Date.now() - receipt.verifiedAt;
      if (receipt.version === 1 && receipt.binding === binding && checksum === capabilityChecksum(receipt) &&
          Number.isFinite(receipt.verifiedAt) && receipt.verifiedAt > 0 && age >= 0 &&
          age < SCORE_CAPABILITY_MAX_AGE && scoreCapabilityCompatible(receipt.capability)) return receipt.capability;
    } catch {}
    throw offlineCapabilityError();
  };
  assertContext();
  if (allowOffline && globalThis.navigator?.onLine === false) return cached();
  let capability;
  try {
    capability = mockBackend ? await mockBackend.getScoreFoundationCapability?.() ?? null
      : !user ? null : await request('/rpc/score_foundation_capability', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json',
          'Accept-Profile': 'rakeezx', 'Content-Profile': 'rakeezx' }, body: '{}',
      }, false, { assertAccess: assertContext });
  } catch (error) {
    assertContext();
    // Only fetch transport failure permits fallback. HTTP/Auth/RPC rejections
    // invalidate prior evidence and must never be hidden by an offline receipt.
    if (error instanceof TypeError && !error.status && !error.code) {
      if (allowOffline) return cached();
    } else if (owner) revokeScoreCapabilities(owner);
    throw error;
  }
  assertContext();
  if (key) {
    if (scoreCapabilityCompatible(capability)) {
      const body = { version: 1, binding, verifiedAt: Date.now(), capability };
      // A storage failure must not pretend evidence survived a reload. The
      // current online response remains valid for this command.
      try { localStorage.setItem(key, JSON.stringify({ ...body, checksum: capabilityChecksum(body) })); } catch {}
    } else localStorage.removeItem(key);
  } else if (owner && (!scoreCapabilityCompatible(capability) || capability?.n94SubitemVersion !== 1)) {
    // Online command checks without a workspace must also retire stale owner
    // evidence when the server no longer supports the cached protocol.
    revokeScoreCapabilities(owner);
  }
  return capability;
}

async function distributionRPC(name, body, mockMethod, envelope) {
  if (mockBackend) {
    if (typeof mockBackend[mockMethod] !== 'function') throw new Error(`Mock backend lacks ${mockMethod}`);
    return mockBackend[mockMethod](envelope);
  }
  if (!user) throw authError('Authentication required');
  return request(`/rpc/${name}`, { method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json',
      'Accept-Profile': 'rakeezx', 'Content-Profile': 'rakeezx' }, body: JSON.stringify(body) });
}

export const getScoreDistributionCapability = () => distributionRPC('score_distribution_capability', {}, 'getScoreDistributionCapability', {});
export const planScoreDistribution = (envelope) => distributionRPC('plan_score_distribution', {
  p_plan_id: envelope.planId, p_source: envelope.sourceTeachingId,
  p_targets: envelope.targetTeachingIds, p_remove: envelope.removeItemIds ?? [],
  ...(['preserve-target', 'automatic-safe'].includes(envelope.mode) ? { p_mode: envelope.mode } : {}),
}, 'planScoreDistribution', envelope);
export const applyScoreDistributionPlan = (envelope) => distributionRPC('apply_score_distribution_plan', {
  p_mutation_id: envelope.mutationId, p_device_id: envelope.deviceId,
  p_plan_id: envelope.planId, p_token: envelope.token, p_confirmed: envelope.confirmed === true,
}, 'applyScoreDistributionPlan', envelope);
export const renameScoreItem = (envelope) => distributionRPC('rename_score_item', {
  p_mutation_id: envelope.mutationId, p_device_id: envelope.deviceId, p_item_id: envelope.itemId,
  p_revision: envelope.revision, p_name: envelope.name,
}, 'renameScoreItem', envelope);

export const getGradeImportCapability = () => distributionRPC('reviewed_grade_import_capability', {}, 'getGradeImportCapability', {});
export async function applyReviewedGradeImport(envelope) {
  const ownerId = envelope.ownerId, databaseName = runtimeSyncOwnershipGuard.getWorkspace().databaseName;
  const assertAccess = () => {
    runtimeOfflineLease().assertWritable();
    const access = runtimeSyncOwnershipGuard.cloudAccess({ operation: 'dispatch', authenticatedUserId: user?.id, command: { ownerId } });
    if (!access.allowed || user?.id !== ownerId || !session || runtimeSyncOwnershipGuard.getWorkspace().databaseName !== databaseName) throw new Error('Grade import owner changed');
    if (globalThis.navigator?.onLine === false) throw new Error('Grade import confirmation requires online Sync');
  };
  assertAccess();
  if (mockBackend) {
    if (typeof mockBackend.applyReviewedGradeImport !== 'function') throw new Error('Mock backend lacks applyReviewedGradeImport');
    const receipt = await mockBackend.applyReviewedGradeImport(envelope); assertAccess(); return receipt;
  }
  return request('/rpc/apply_reviewed_grade_import', { method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'Accept-Profile': 'rakeezx', 'Content-Profile': 'rakeezx' },
    body: JSON.stringify({ p_mutation_id: envelope.mutationId, p_device_id: envelope.deviceId, p_batch: envelope.batch }),
  }, false, { assertAccess });
}

/** Owner-scoped, statement-consistent score components and materialized totals. */
export async function getScoreDomainSnapshot() {
  if (mockBackend) {
    if (typeof mockBackend.getScoreDomainSnapshot !== 'function') {
      throw new Error('Mock backend lacks atomic score-domain snapshot');
    }
    return mockBackend.getScoreDomainSnapshot();
  }
  if (!user) throw new Error('Not authenticated');
  return request('/rpc/sync_v2_score_domain_snapshot', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json',
      'Accept-Profile': 'rakeezx', 'Content-Profile': 'rakeezx' }, body: '{}',
  });
}

/** Stage a hash-bound restore plan. This RPC never changes domain rows. */
export async function stageSyncV2Restore(envelope) {
  assertNewProductWrite();
  if (mockBackend) {
    if (typeof mockBackend.stageSyncV2Restore !== 'function') throw new Error('Mock backend does not implement restore staging RPC');
    return mockBackend.stageSyncV2Restore(envelope);
  }
  if (!user) throw new Error('Not authenticated');
  return request('/rpc/stage_sync_v2_restore', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json',
      'Accept-Profile': 'rakeezx', 'Content-Profile': 'rakeezx' },
    body: JSON.stringify({
      p_restore_id: envelope.restoreId,
      p_backup_hash: envelope.backupHash,
      p_backup_version: envelope.backupVersion,
      p_source_manifest: envelope.sourceManifest,
      p_operations: envelope.operations,
    }),
  });
}

/** Atomically finalize one staged restore and return the complete canonical owner state. */
export async function finalizeSyncV2Restore(envelope) {
  if (mockBackend) {
    if (typeof mockBackend.finalizeSyncV2Restore !== 'function') throw new Error('Mock backend does not implement restore finalization RPC');
    return mockBackend.finalizeSyncV2Restore(envelope);
  }
  if (!user) throw new Error('Not authenticated');
  return request('/rpc/finalize_sync_v2_restore', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json',
      'Accept-Profile': 'rakeezx', 'Content-Profile': 'rakeezx' },
    body: JSON.stringify({
      p_restore_id: envelope.restoreId,
      p_backup_hash: envelope.backupHash,
      p_expected_stage_hash: envelope.expectedStageHash,
    }),
  });
}

/** V5-only restore RPCs: the deployed V3/V4 stage/finalize contract is unchanged. */
export async function stageScoreRestoreV2(envelope) {
  assertNewProductWrite();
  if (mockBackend) {
    if (typeof mockBackend.stageScoreRestoreV2 !== 'function') throw new Error('Mock backend lacks V5 staging');
    return mockBackend.stageScoreRestoreV2(envelope);
  }
  if (!user) throw new Error('Not authenticated');
  return request('/rpc/stage_sync_v2_restore_score_v2', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json',
      'Accept-Profile': 'rakeezx', 'Content-Profile': 'rakeezx' },
    body: JSON.stringify({ p_restore_id: envelope.restoreId, p_backup_hash: envelope.backupHash,
      p_backup_version: envelope.backupVersion, p_source_manifest: envelope.sourceManifest,
      p_operations: envelope.operations }),
  });
}

export async function getUnifiedRestoreCapability() {
  if (mockBackend) return mockBackend.getUnifiedRestoreCapability?.() ?? null;
  try { return await request('/rpc/n71_restore_capability', {
    method: 'POST', headers: { 'Content-Type': 'application/json',
      'Accept-Profile': 'rakeezx', 'Content-Profile': 'rakeezx' }, body: '{}',
  }); } catch (error) {
    if (error.status === 404 || error.code === 'PGRST202') return null;
    throw error;
  }
}

export async function getUnifiedRestoreManifest({ signal } = {}) {
  if (mockBackend) return mockBackend.getUnifiedRestoreManifest();
  return request('/rpc/n71_restore_manifest', {
    method: 'POST', signal, headers: { 'Content-Type': 'application/json',
      'Accept-Profile': 'rakeezx', 'Content-Profile': 'rakeezx' }, body: '{}',
  });
}

export async function stageUnifiedRestore(envelope) {
  assertNewProductWrite();
  if (mockBackend) {
    if (!mockBackend.stageUnifiedRestore) throw new Error('Unified staging unavailable');
    return mockBackend.stageUnifiedRestore(envelope);
  }
  return request('/rpc/stage_n71_restore', {
    method: 'POST', headers: { 'Content-Type': 'application/json',
      'Accept-Profile': 'rakeezx', 'Content-Profile': 'rakeezx' },
    body: JSON.stringify({ p_restore_id: envelope.restoreId, p_backup_hash: envelope.backupHash,
      p_backup_version: envelope.backupVersion, p_source_manifest: envelope.sourceManifest,
      p_operations: envelope.operations, p_source_owner_id: envelope.sourceOwnerId }),
  });
}

export async function finalizeUnifiedRestore(envelope) {
  if (mockBackend) {
    if (!mockBackend.finalizeUnifiedRestore) throw new Error('Unified finalization unavailable');
    return mockBackend.finalizeUnifiedRestore(envelope);
  }
  return request('/rpc/finalize_n71_restore', {
    method: 'POST', headers: { 'Content-Type': 'application/json',
      'Accept-Profile': 'rakeezx', 'Content-Profile': 'rakeezx' },
    body: JSON.stringify({ p_restore_id: envelope.restoreId, p_backup_hash: envelope.backupHash,
      p_expected_stage_hash: envelope.expectedStageHash }),
  });
}

export async function finalizeScoreRestoreV2(envelope) {
  if (mockBackend) {
    if (typeof mockBackend.finalizeScoreRestoreV2 !== 'function') throw new Error('Mock backend lacks V5 finalization');
    return mockBackend.finalizeScoreRestoreV2(envelope);
  }
  if (!user) throw new Error('Not authenticated');
  return request('/rpc/finalize_sync_v2_restore_score_v2', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json',
      'Accept-Profile': 'rakeezx', 'Content-Profile': 'rakeezx' },
    body: JSON.stringify({ p_restore_id: envelope.restoreId, p_backup_hash: envelope.backupHash,
      p_expected_stage_hash: envelope.expectedStageHash }),
  });
}

/**
 * Commits the two enrollment sides of a student transfer in one database
 * transaction.  Payload records already use cloud/snake_case field names.
 */
export async function commitEnrollmentTransfer({ source, destination } = {}) {
  if (mockBackend) {
    if (typeof mockBackend.commitEnrollmentTransfer !== 'function') {
      throw new Error('Mock backend does not implement enrollment transfer RPC');
    }
    return mockBackend.commitEnrollmentTransfer({ source, destination });
  }
  if (!user) throw new Error('Not authenticated');
  return request('/rpc/commit_enrollment_transfer', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Accept-Profile': 'rakeezx',
      'Content-Profile': 'rakeezx',
    },
    body: JSON.stringify({ p_source: source, p_destination: destination }),
  });
}

/**
 * Commits a transfer and the complete final source/destination rosters in one
 * server transaction. This is intentionally distinct from the legacy manual
 * renumber RPC: a transfer must never expose an intermediate active roll.
 */
export async function commitEnrollmentTransferAndRenumber({
  source, destination, sourceRoster, destinationRoster,
} = {}) {
  if (mockBackend) {
    if (typeof mockBackend.commitEnrollmentTransferAndRenumber !== 'function') {
      throw new Error('Mock backend does not implement transfer-and-renumber RPC');
    }
    return mockBackend.commitEnrollmentTransferAndRenumber({ source, destination, sourceRoster, destinationRoster });
  }
  if (!user) throw new Error('Not authenticated');
  return request('/rpc/commit_enrollment_transfer_and_renumber', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Accept-Profile': 'rakeezx',
      'Content-Profile': 'rakeezx',
    },
    body: JSON.stringify({
      p_source: source,
      p_destination: destination,
      p_source_roster: sourceRoster,
      p_destination_roster: destinationRoster,
    }),
  });
}

/**
 * Applies a complete active-roster numbering plan inside one server
 * transaction.  The server temporarily clears numbers before assigning the
 * final sequence, so the partial active-roll unique index is never violated.
 */
export async function renumberEnrollmentRoster({ sectionId, roster } = {}) {
  if (mockBackend) {
    if (typeof mockBackend.renumberEnrollmentRoster !== 'function') {
      throw new Error('Mock backend does not implement enrollment renumber RPC');
    }
    return mockBackend.renumberEnrollmentRoster({ sectionId, roster });
  }
  if (!user) throw new Error('Not authenticated');
  return request('/rpc/renumber_enrollment_roster', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Accept-Profile': 'rakeezx',
      'Content-Profile': 'rakeezx',
    },
    body: JSON.stringify({ p_section_id: sectionId, p_roster: roster }),
  });
}

/** Exact owner-scoped section identity lookup for safe sync reconciliation. */
export async function fetchSectionPresence(sectionId) {
  if (!user) return { authoritative: false, status: 'unknown', row: null, error: 'Not authenticated' };
  try {
    const rows = mockBackend
      ? (await mockBackend.fetchRecords('sections')).filter((row) => row.id === sectionId && (row.owner_id == null || row.owner_id === user.id))
      : await request(`/sections?owner_id=eq.${encodeURIComponent(user.id)}&id=eq.${encodeURIComponent(sectionId)}&select=id,owner_id,year_id,grade,label,deleted_at&limit=1`, {
        headers: { 'Accept': 'application/json', 'Accept-Profile': 'rakeezx' }
      });
    // Only a valid empty row array proves absence. A malformed successful
    // response must never authorize retirement of a local identity.
    if (!Array.isArray(rows) || rows.length > 1 || (rows.length === 1 && !rows[0])) {
      throw new Error('Invalid exact section presence response');
    }
    const row = rows[0] ?? null;
    return { authoritative: true, status: row ? 'present' : 'absent', row };
  } catch (error) {
    return { authoritative: false, status: 'unknown', row: null, error: error.message };
  }
}
export const SECTION_CANDIDATE_LIMIT = 1000;

/**
 * Exact teaching presence evidence only; does not authorize history adoption.
 * teachings_natural_uniq is (owner_id, section_id, subject_id, term_id), including
 * tombstones. A successful owner+PK empty query proves scoped absence without
 * a broad snapshot. Keep deleted_at so a tombstone cannot become active evidence.
 */
export async function fetchTeachingPresence(teachingId) {
  const ownerId = user?.id;
  const token = session?.access_token;
  try {
    if (!ownerId || !token) throw new Error('Not authenticated');
    if (typeof teachingId !== 'string' || !teachingId) throw new Error('Invalid teaching ID');
    const rows = mockBackend ? await mockBackend.fetchTeachingPresence(teachingId)
      : await request(`/teachings?owner_id=eq.${encodeURIComponent(ownerId)}&id=eq.${encodeURIComponent(teachingId)}&select=id,owner_id,section_id,subject_id,term_id,deleted_at&limit=1`, {
      headers: { 'Accept': 'application/json', 'Accept-Profile': 'rakeezx' },
    });
    if (user?.id !== ownerId || session?.access_token !== token || !Array.isArray(rows) || rows.length > 1) {
      throw new Error('Invalid exact teaching presence response');
    }
    const row = rows[0] ?? null;
    if (rows.length === 1 && (!row || row.id !== teachingId || row.owner_id !== ownerId ||
        !['section_id', 'subject_id', 'term_id'].every((key) => typeof row[key] === 'string' && row[key]) ||
        !(row.deleted_at === null || typeof row.deleted_at === 'string'))) {
      throw new Error('Invalid exact teaching presence scope/row');
    }
    return { authoritative: true, status: row ? 'present' : 'absent', row };
  } catch (error) {
    return { authoritative: false, status: 'unknown', row: null, error: error.message };
  }
}

/**
 * Bounded owner/year/grade discovery, including tombstones. Strictly fewer
 * than 1000 valid rows establishes completeness under the request ceiling;
 * reaching the ceiling is UNKNOWN/overflow, never proof of uniqueness.
 * Include mapper metadata so canonical adoption does not invent a timestamp.
 */
export async function fetchSectionCandidates({ yearId, grade }) {
  const ownerId = user?.id;
  try {
    if (!ownerId || !session) throw new Error('Not authenticated');
    if (typeof yearId !== 'string' || !yearId || !Number.isInteger(Number(grade)) || Number(grade) < 1) {
      throw new Error('Invalid section candidate scope');
    }
    const rows = mockBackend
      ? await mockBackend.fetchSectionCandidates({ yearId, grade, limit: SECTION_CANDIDATE_LIMIT })
      : await request(`/sections?owner_id=eq.${encodeURIComponent(ownerId)}&year_id=eq.${encodeURIComponent(yearId)}&grade=eq.${encodeURIComponent(grade)}&select=id,owner_id,year_id,grade,label,deleted_at,name,color,order,client_updated_at&order=id.asc&limit=${SECTION_CANDIDATE_LIMIT}`, {
        headers: { 'Accept': 'application/json', 'Accept-Profile': 'rakeezx' },
      });
    if (!session || user?.id !== ownerId || !Array.isArray(rows)) throw new Error('Invalid section candidate response');
    if (rows.length >= SECTION_CANDIDATE_LIMIT) return { authoritative: false, status: 'overflow', rows: [] };
    if (rows.some((row) => !row || typeof row.id !== 'string' || !row.id || row.owner_id !== ownerId ||
        row.year_id !== yearId || String(row.grade) !== String(grade) || typeof row.label !== 'string' ||
        !(row.deleted_at === null || typeof row.deleted_at === 'string')) || new Set(rows.map((row) => row.id)).size !== rows.length) {
      throw new Error('Invalid section candidate scope/rows');
    }
    return { authoritative: true, status: 'complete', rows };
  } catch (error) {
    return { authoritative: false, status: 'unknown', rows: [], error: error.message };
  }
}

export async function fetchRecords(tableName) {
  if (mockBackend) return mockBackend.fetchRecords(tableName);
  if (!user?.id || !session) throw authError('Authentication required');
  if (!/^[a-z_]+$/.test(String(tableName))) throw new Error('Invalid cloud table');
  const ownerId = user.id;
  const contextGeneration = authContextGeneration;
  const workspace = runtimeSyncOwnershipGuard.getWorkspace();
  const assertAccess = () => {
    if (!session || user?.id !== ownerId || authContextGeneration !== contextGeneration ||
        runtimeSyncOwnershipGuard.getWorkspace() !== workspace) {
      throw Object.assign(new Error('Cloud read account/workspace changed'), { code: 'CLOUD_READ_CONTEXT_CHANGED' });
    }
  };
  const key = tableName === 'profile' ? 'owner_id' : 'id';
  return readCompleteTable({ ownerId, key, assertAccess, fetchPage: async ({ offset, limit }) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    try {
      return await request(`/${tableName}?owner_id=eq.${encodeURIComponent(ownerId)}&select=*&order=${key}.asc&limit=${limit}&offset=${offset}`, {
        headers: { 'Accept': 'application/json', 'Accept-Profile': 'rakeezx', 'Prefer': 'count=exact' },
        signal: controller.signal,
      }, false, { responseMetadata: true, assertAccess });
    } finally { clearTimeout(timeout); }
  } });
}
