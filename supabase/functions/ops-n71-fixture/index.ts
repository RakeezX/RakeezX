import { createClient } from 'npm:@supabase/supabase-js@2.117.3';
import { createHandler, PROJECT_ID } from './handler-core.mjs';
import manifest from './run-manifest.mjs';

// SDK/package and Auth source are pinned in tests/n71-live/source-pins.json.
// Do not copy incoming Authorization or capability headers into this admin client.
function clients() {
  const expectedUrl = `https://${PROJECT_ID}.supabase.co`;
  const url = Deno.env.get('SUPABASE_URL');
  if (url !== expectedUrl) return { configured: false };
  let key: string | undefined;
  try {
    const keys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}');
    if (typeof keys?.default === 'string' && keys.default) key = keys.default;
  } catch { /* Fall back to the documented server-only legacy key. */ }
  key ??= Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!key) return { configured: false };
  const client = createClient(url, key, { auth: { persistSession: false,
    autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input: RequestInfo | URL, init?: RequestInit) => fetch(input, {
      ...init, redirect: 'error', signal: init?.signal
        ? AbortSignal.any([init.signal, AbortSignal.timeout(10000)]) : AbortSignal.timeout(10000),
    }) },
  });
  return { configured: true, admin: client.auth.admin, auth: client.auth };
}

// verify_jwt=false is valid for this one function because createHandler authenticates every path.
Deno.serve(createHandler({ manifest, createClients: clients }));
