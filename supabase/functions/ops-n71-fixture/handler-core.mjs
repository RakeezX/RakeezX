// N71 operations only. No Product table writes, SQL, key-returning route or logging.
export const PROJECT_ID = 'xlrubcwjqktzzunrvuns';
export const PURPOSE = 'N71-D099';
export const BAN_DURATION = '876000h'; // Fixed official API duration; no caller-controlled unban.
export const WINDOW_MS = 90 * 60 * 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const HASH = /^[0-9a-f]{64}$/;
const PROOF = /^[A-Za-z0-9_-]{43}$/;
const MAX_BODY_BYTES = 12 * 1024;
const headers = Object.freeze({ 'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });

export function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort()
    .map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
  return JSON.stringify(value);
}
export async function sha256(value, cryptoProvider = globalThis.crypto) {
  const bytes = new TextEncoder().encode(value);
  return Array.from(new Uint8Array(await cryptoProvider.subtle.digest('SHA-256', bytes)))
    .map(n => n.toString(16).padStart(2, '0')).join('');
}
function equalHash(a, b) {
  if (!HASH.test(a ?? '') || !HASH.test(b ?? '')) return false;
  let difference = 0;
  for (let i = 0; i < 64; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}
function exactKeys(value, allowed) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).sort().join('|') === [...allowed].sort().join('|');
}
export function fixtureEmail(runId, slot) {
  return `n71-${runId.replaceAll('-', '')}-${slot.toLowerCase()}@example.invalid`;
}
export function fixtureMarker(manifest, slot) {
  return { version: 1, purpose: PURPOSE, runId: manifest.runId, slot };
}
export function validateManifest(input) {
  const manifest = JSON.parse(JSON.stringify(input));
  const fields = ['version', 'purpose', 'projectId', 'runId', 'mode', 'issuedAt', 'expiresAt',
    'capabilitySha256', 'fixtureContractSha256', 'implementationSha256', 'accounts'];
  if (!exactKeys(manifest, fields) || manifest.version !== 1 || manifest.purpose !== PURPOSE ||
      manifest.projectId !== PROJECT_ID || !UUID.test(manifest.runId ?? '') ||
      !['provision', 'cleanup-only'].includes(manifest.mode) ||
      !HASH.test(manifest.capabilitySha256 ?? '') || !HASH.test(manifest.fixtureContractSha256 ?? '') ||
      !HASH.test(manifest.implementationSha256 ?? '')) throw new Error('INVALID_MANIFEST');
  const from = Date.parse(manifest.issuedAt), until = Date.parse(manifest.expiresAt);
  if (!Number.isFinite(from) || !Number.isFinite(until) || until <= from || until - from > WINDOW_MS)
    throw new Error('INVALID_MANIFEST');
  if (!Array.isArray(manifest.accounts) || manifest.accounts.length !== 2) throw new Error('INVALID_MANIFEST');
  for (const [i, account] of manifest.accounts.entries()) {
    const slot = ['A', 'B'][i];
    if (!exactKeys(account, ['slot', 'id', 'email', 'passwordSha256']) || account.slot !== slot ||
        !UUID.test(account.id ?? '') || account.email !== fixtureEmail(manifest.runId, slot) ||
        !HASH.test(account.passwordSha256 ?? '')) throw new Error('INVALID_MANIFEST');
  }
  if (manifest.accounts[0].id === manifest.accounts[1].id ||
      manifest.accounts.some(a => a.id === manifest.runId)) throw new Error('INVALID_MANIFEST');
  return manifest;
}
function response(status, result) { return new Response(JSON.stringify(result), { status, headers }); }
function deny(code, status = 403, retryable = false) {
  return response(status, { ok: false, errorCode: code, retryable });
}
function fault(code, retryable = false) { return Object.assign(new Error(code), { safeCode: code, retryable }); }
function absent(error) { return error?.status === 404 && error?.code === 'user_not_found'; }
function retryable(error) { return !Number.isFinite(error?.status) || error.status === 0 || error.status === 429 || error.status >= 500; }
function matches(user, manifest, account) {
  return user?.id === account.id && user?.email === account.email && user?.role === 'authenticated' &&
    !user?.deleted_at && Boolean(user?.email_confirmed_at) &&
    canonical(user?.app_metadata?.n71) === canonical(fixtureMarker(manifest, account.slot));
}
async function readBody(request, deadlineMs = 2000) {
  const declared = request.headers.get('content-length');
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > MAX_BODY_BYTES)) throw fault('BODY_LIMIT');
  if (!request.body) throw fault('INVALID_BODY');
  const reader = request.body.getReader(); let size = 0; const pieces = [];
  const deadline = Date.now() + deadlineMs;
  try {
    for (;;) {
      let timer;
      const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(fault('BODY_TIMEOUT')), Math.max(0, deadline - Date.now())); });
      let read;
      try { read = await Promise.race([reader.read(), timeout]); }
      catch (error) { await reader.cancel().catch(() => {}); throw error; }
      finally { clearTimeout(timer); }
      const { value, done } = read; if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) { await reader.cancel(); throw fault('BODY_LIMIT'); }
      pieces.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const piece of pieces) { bytes.set(piece, offset); offset += piece.byteLength; }
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
  catch { throw fault('INVALID_BODY'); }
}

/** createClients is invoked only after authentication, expiry and exact body/scope validation. */
export function createHandler({ manifest: input, createClients, clock = () => Date.now(),
  cryptoProvider = globalThis.crypto }) {
  const manifest = validateManifest(input);
  const binding = sha256(canonical(manifest), cryptoProvider);
  const minimumBanUntil = Date.parse(manifest.issuedAt) + (876000 - 1) * 60 * 60 * 1000;
  function assertWindow() {
    const now = clock();
    if (now < Date.parse(manifest.issuedAt) || now >= Date.parse(manifest.expiresAt))
      throw fault('CAPABILITY_EXPIRED');
  }
  async function getExact(admin, account) {
    let result;
    try { result = await admin.getUserById(account.id); }
    catch { throw fault('AUTH_LOOKUP_UNAVAILABLE', true); }
    if (absent(result?.error)) return null;
    if (result?.error) throw fault('AUTH_LOOKUP_UNAVAILABLE', retryable(result.error));
    if (!matches(result?.data?.user, manifest, account)) throw fault('FIXTURE_IDENTITY_CONFLICT');
    return result.data.user;
  }
  async function publicState(admin, account) {
    const user = await getExact(admin, account);
    if (!user) return { state: 'absent', verifiedBy: 'exact_auth_admin_get' };
    const banned = Date.parse(user.banned_until ?? '');
    return { state: banned >= minimumBanUntil ? 'retained_banned' : 'provisioned',
      ...(Number.isFinite(banned) ? { bannedUntil: new Date(banned).toISOString() } : {}),
      verifiedBy: 'exact_auth_admin_get' };
  }
  return async function handler(request) {
    try {
      if (request.method !== 'POST') return deny('METHOD_NOT_ALLOWED', 405);
      if (request.headers.has('origin') || new URL(request.url).search) return deny('UNSUPPORTED_CALLER');
      const now = clock();
      if (now < Date.parse(manifest.issuedAt) || now >= Date.parse(manifest.expiresAt)) return deny('CAPABILITY_EXPIRED', 410);
      const proof = request.headers.get('x-n71-capability');
      if (!PROOF.test(proof ?? '') || !equalHash(await sha256(proof, cryptoProvider), manifest.capabilitySha256))
        return deny('UNAUTHORIZED', 401);
      if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(request.headers.get('content-type') ?? ''))
        return deny('CONTENT_TYPE_REQUIRED', 415);
      const body = await readBody(request, Math.min(2000, Date.parse(manifest.expiresAt) - clock()));
      assertWindow();
      const base = ['version', 'runId', 'operation'];
      const schemas = { probe: base, inspect: [...base, 'slot'], ensure: [...base, 'slot', 'password'],
        revoke: [...base, 'slot', 'accessToken'], retire: [...base, 'slot'] };
      if (!schemas[body?.operation] || !exactKeys(body, schemas[body.operation]) ||
          body.version !== 1 || body.runId !== manifest.runId) return deny('INVALID_SCOPE', 400);
      const allowed = manifest.mode === 'provision' ? ['probe', 'inspect', 'ensure'] : ['probe', 'inspect', 'revoke', 'retire'];
      if (!allowed.includes(body.operation)) return deny('PHASE_REJECTED', 409);
      const account = manifest.accounts.find(a => a.slot === body.slot);
      if (body.operation !== 'probe' && !account) return deny('INVALID_SCOPE', 400);
      if (body.operation === 'ensure' && (typeof body.password !== 'string' ||
          !/^N71!aA1[A-Za-z0-9_-]{43}$/.test(body.password) ||
          !equalHash(await sha256(body.password, cryptoProvider), account.passwordSha256))) return deny('INVALID_SCOPE', 400);
      if (body.operation === 'revoke' && (typeof body.accessToken !== 'string' || body.accessToken.length > 8192 ||
          !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(body.accessToken))) return deny('INVALID_SCOPE', 400);
      const clients = await createClients();
      const common = { ok: true, version: 1, projectId: PROJECT_ID, runId: manifest.runId,
        mode: manifest.mode, manifestSha256: await binding, implementationSha256: manifest.implementationSha256,
        fixtureContractSha256: manifest.fixtureContractSha256, operation: body.operation,
        ...(account ? { slot: account.slot, fixtureAuthId: account.id } : {}) };
      if (body.operation === 'probe') return response(200, { ...common, configured: clients?.configured === true });
      if (!clients?.configured || !clients?.admin || !clients?.auth) return deny('ADMIN_CONFIGURATION_UNAVAILABLE', 503, true);
      const { admin, auth } = clients;
      if (body.operation === 'inspect') return response(200, { ...common, ...await publicState(admin, account) });
      if (body.operation === 'ensure') {
        const existing = await getExact(admin, account);
        if (existing) {
          if (Date.parse(existing.banned_until ?? '') > now) return deny('FIXTURE_ALREADY_RETIRED', 409);
          return response(200, { ...common, state: 'provisioned', recovered: true, verifiedBy: 'exact_auth_admin_get' });
        }
        let createError;
        assertWindow();
        try {
          const result = await admin.createUser({ id: account.id, email: account.email, password: body.password,
            email_confirm: true, app_metadata: { n71: fixtureMarker(manifest, account.slot) } });
          createError = result?.error;
        } catch { createError = { status: 0 }; }
        // A create acknowledgment alone is not the receipt. The same fixed UUID is always reread.
        const saved = await getExact(admin, account);
        if (!saved) throw fault('AUTH_CREATE_NOT_CONFIRMED', !createError || retryable(createError));
        if (Date.parse(saved.banned_until ?? '') > now) return deny('FIXTURE_ALREADY_RETIRED', 409);
        return response(200, { ...common, state: 'provisioned', recovered: Boolean(createError), verifiedBy: 'exact_auth_admin_get' });
      }
      if (body.operation === 'revoke') {
        await getExact(admin, account);
        // Unverified decoded JWT claims never authorize an admin action.
        let checked;
        try { checked = await auth.getUser(body.accessToken); }
        catch { throw fault('TOKEN_VERIFICATION_UNAVAILABLE', true); }
        if (checked?.error && retryable(checked.error)) throw fault('TOKEN_VERIFICATION_UNAVAILABLE', true);
        if (checked?.error || !matches(checked?.data?.user, manifest, account)) return deny('TOKEN_OWNER_NOT_VERIFIED', 409);
        assertWindow();
        let result;
        try { result = await admin.signOut(body.accessToken, 'global'); }
        catch { throw fault('SIGN_OUT_UNAVAILABLE', true); }
        if (result?.error) throw fault('SIGN_OUT_UNAVAILABLE', retryable(result.error));
        return response(200, { ...common, state: 'sign_out_acknowledged',
          refreshRevocation: 'must_verify_with_private_refresh_denial',
          existingAccessJwt: 'valid_until_its_exp_unless_a_service_checks_session' });
      }
      // Retention is the declared disposition. No hard/soft delete, SQL, duration or unban parameter.
      const existing = await getExact(admin, account);
      if (!existing) return response(200, { ...common, state: 'absent', verifiedBy: 'exact_auth_admin_get' });
      if (!(Date.parse(existing.banned_until ?? '') >= minimumBanUntil)) {
        let updateError;
        assertWindow();
        try { updateError = (await admin.updateUserById(account.id, { ban_duration: BAN_DURATION }))?.error; }
        catch { updateError = { status: 0 }; }
        const after = await getExact(admin, account);
        if (!after || !(Date.parse(after.banned_until ?? '') >= minimumBanUntil))
          throw fault('RETENTION_BAN_NOT_CONFIRMED', !updateError || retryable(updateError));
      }
      return response(200, { ...common, ...await publicState(admin, account),
        disposition: 'synthetic_auth_and_product_fixtures_retained',
        sessionsRevokedByBan: false, hardDelete: 'not_attempted_existing_product_retention_guard' });
    } catch (error) {
      // This allowlist is generated inside this module; no SDK/request/error text is returned.
      return deny(error?.safeCode ?? 'ADMIN_OPERATION_UNAVAILABLE', error?.safeCode === 'CAPABILITY_EXPIRED' ? 410 : error?.retryable ? 503 : 409,
        error?.retryable === true);
    }
  };
}
