/**
 * RAKEEZ X — Supabase API Wrapper
 * Zero-build, vanilla JS fetch wrapper for Auth and REST.
 */

const URL = 'https://bmekljhmepgkhywjzkdx.supabase.co';
const ANON_KEY = 'sb_publishable_x_JjPvd0BLxl-FPlq56fGw_KFX46M2X';
const STORAGE_KEY = 'rakeezx-auth';

export let session = null;
export let user = null;

let mockBackend = null;
export function setMockBackend(adapter) { mockBackend = adapter; }

export function setMockAuth(u, s) {
  user = u;
  session = s;
}

const listeners = new Set();
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function notify() {
  listeners.forEach((fn) => fn());
}

export async function request(path, options = {}, isAuth = false) {
  const headers = {
    'apikey': ANON_KEY,
    ...options.headers,
  };
  
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  } else if (!isAuth) {
    // If not authenticated, REST endpoints still need the anon key as bearer token
    headers['Authorization'] = `Bearer ${ANON_KEY}`;
  }
  
  const base = isAuth ? `${URL}/auth/v1` : `${URL}/rest/v1`;
  const res = await fetch(`${base}${path}`, {
    ...options,
    headers,
  });
  
  if (!res.ok) {
    let err;
    try {
      const data = await res.json();
      err = new Error(data.message || data.error_description || `Request failed: ${res.status}`);
      // Preserve PostgREST diagnostics; callers must use SQLSTATE, not parse
      // localized/message-only unique-constraint text to decide recovery.
      for (const field of ['code', 'details', 'hint', 'constraint']) {
        if (data[field] !== undefined) err[field] = data[field];
      }
    } catch {
      err = new Error(`Request failed: ${res.status}`);
    }
    err.status = res.status;
    throw err;
  }
  
  if (res.status === 204) return null;
  
  const text = await res.text();
  if (!text) return null;
  
  try {
    return JSON.parse(text);
  } catch (err) {
    console.warn('[rakeezx cloud] Non-JSON response:', text);
    return text;
  }
}

function saveSession(data) {
  if (!data || !data.access_token) {
    session = null;
    user = null;
    localStorage.removeItem(STORAGE_KEY);
  } else {
    session = data;
    user = data.user;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }
  notify();
}

export async function init() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      // Basic check if token exists, we don't block boot to verify it with server
      if (parsed?.access_token) {
        saveSession(parsed);
      }
    } catch (e) {
      console.warn('[rakeezx cloud] Failed to parse stored session', e);
      saveSession(null);
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

export async function signOut() {
  if (session?.access_token) {
    try {
      await request('/logout', { method: 'POST' }, true);
    } catch (e) {
      console.warn('[rakeezx cloud] Logout request failed, clearing local session anyway', e);
    }
  }
  saveSession(null);
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
 * This is deliberately not wired into the Production V1 coordinator yet.
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

/** Development-only V2 enrollment command transport. V1 enrollment RPCs stay intact. */
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

/** Development-only V2 attendance/snapshot command transport. */
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

/** Development-only V2 lifecycle/cascade command transport. */
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
  if (!user) throw new Error('Not authenticated');
  const data = await request(`/${tableName}?owner_id=eq.${user.id}&select=*`, {
    headers: {
      'Accept': 'application/json',
      'Accept-Profile': 'rakeezx'
    }
  });
  if (!data) return [];
  if (!Array.isArray(data)) {
    throw new Error(`Structural sync failed for ${tableName}: expected array, received ${typeof data}`);
  }
  return data;
}
