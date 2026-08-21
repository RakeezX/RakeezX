/**
 * RAKEEZ X — Supabase API Wrapper
 * Zero-build, vanilla JS fetch wrapper for Auth and REST.
 */

const URL = 'https://bmekljhmepgkhywjzkdx.supabase.co';
const ANON_KEY = 'sb_publishable_x_JjPvd0BLxl-FPlq56fGw_KFX46M2X';
const STORAGE_KEY = 'rakeezx-auth';

export let session = null;
export let user = null;

const listeners = new Set();
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function notify() {
  listeners.forEach((fn) => fn());
}

async function request(path, options = {}, isAuth = false) {
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
    } catch {
      err = new Error(`Request failed: ${res.status}`);
    }
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
  if (!user) throw new Error('Not authenticated');
  const data = await request(`/profile?owner_id=eq.${user.id}&select=*`, {
    headers: {
      'Accept': 'application/json',
      'Accept-Profile': 'rakeezx'
    }
  });
  return data?.[0] || null;
}

export async function updateProfile(profileData) {
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
