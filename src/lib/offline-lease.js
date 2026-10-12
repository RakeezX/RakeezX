/** N49: local evidence of an Auth /user check, never a server signature/clock.
 * localStorage is deliberate: synchronous fresh reads protect write boundaries
 * in every tab. The checksum detects accidental damage, not malicious scripts.
 */
export const LEASE_STORAGE_PREFIX = 'rakeezx-offline-lease-v1:';
export const OFFLINE_LEASE_LIMITED = 'OFFLINE_LEASE_LIMITED';
const DAY = 86400000;
const ROLLBACK_TOLERANCE = 120000;
const production = Object.freeze({ reminder: 7 * DAY, limited: 14 * DAY });

// N49 Preview artifact: preview/n49-3m6m-20261013. This source variant is
// deployed only to that branch. Main keeps the original 7/14-day source.
const preview = Object.freeze({ reminder: 180000, limited: 360000 });
export function isOfflineLeasePreview() {
  const { protocol, hostname } = globalThis.location ?? {};
  return protocol === 'https:' && (
    hostname === 'preview-n49-3m6m-20261013.rakeezx.pages.dev' ||
    /^[a-f0-9]{8}\.rakeezx\.pages\.dev$/.test(hostname ?? '')
  );
}

export function leaseThresholds() {
  // The branch-specific raw ESM asset is itself the Preview build marker.
  // Production hosts, query strings and preferences cannot enable this mode.
  if (isOfflineLeasePreview()) return preview;
  // The existing isolated browser fixture exercises the same short thresholds.
  return import.meta.env?.MODE === 'n49-test' &&
    globalThis.location?.hostname === '127.0.0.1'
    ? preview : production;
}

export function workspaceLeaseBinding(workspace) {
  if (workspace?.type !== 'account' || workspace.ownershipState !== 'claimed' ||
      !workspace.authUserId || !workspace.id || !workspace.databaseName || !workspace.leaseGeneration) return null;
  return JSON.stringify([workspace.authUserId, workspace.id, workspace.databaseName, workspace.leaseGeneration]);
}

function checksum(value) {
  let hash = 2166136261;
  for (const char of JSON.stringify(value)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return (hash >>> 0).toString(16);
}
const seal = (body) => JSON.stringify({ ...body, checksum: checksum(body) });
const limited = (reason) => ({ state: 'LIMITED', editable: false, reason, age: null });
export const leaseWriteError = () => Object.assign(new Error(
  'يلزم التحقق من الحساب للمتابعة في التعديل. يمكنك عرض بياناتك وتنزيل نسخة احتياطية وتصديرها.'
), { code: OFFLINE_LEASE_LIMITED });

export function revokeOwnerLeases(ownerId, storage = globalThis.localStorage) {
  // Revocation affects runtime evidence only, never Product DB rows/outbox.
  for (let index = storage.length - 1; index >= 0; index--) {
    const key = storage.key(index);
    if (!key?.startsWith(LEASE_STORAGE_PREFIX)) continue;
    try {
      const receipt = JSON.parse(storage.getItem(key));
      if (JSON.parse(receipt.binding)[0] === ownerId) storage.removeItem(key);
    } catch { storage.removeItem(key); }
  }
}

export function createOfflineLease({
  storage = globalThis.localStorage,
  now = () => Date.now(), monotonic = () => performance.now(),
  thresholds = production,
} = {}) {
  let workspace = null, binding = null, identity = null, epoch = 0;
  let anchor = null, invalid = null, renewing = null;
  let invalidReason = null;
  const observerId = globalThis.crypto.randomUUID();
  const key = () => LEASE_STORAGE_PREFIX + workspace.id;
  function setContext(nextWorkspace, ownerId) {
    const nextBinding = workspaceLeaseBinding(nextWorkspace);
    if (nextBinding !== binding || ownerId !== identity || nextWorkspace !== workspace) {
      epoch++; anchor = null; invalid = null; invalidReason = null;
    }
    workspace = nextWorkspace; binding = nextBinding; identity = ownerId;
  }
  function observe() {
    if (workspace?.type !== 'account') return { state: 'NOT_APPLICABLE', editable: workspace?.type === 'demo' || workspace?.type === 'legacy' };
    if (!binding || identity !== workspace.authUserId) return limited('owner-workspace-mismatch');
    try {
      const raw = storage.getItem(key());
      if (!raw) return limited('receipt-missing');
      const { checksum: recorded, ...receipt } = JSON.parse(raw);
      if (receipt.version !== 1 || recorded !== checksum(receipt) || receipt.binding !== binding ||
          typeof receipt.renewalId !== 'string' || !receipt.renewalId ||
          ![receipt.verifiedAt, receipt.highWater].every((time) => Number.isFinite(time) && time > 0) ||
          receipt.highWater < receipt.verifiedAt || typeof receipt.invalid !== 'boolean') return limited('receipt-invalid');
      const wall = now(), mono = monotonic();
      if (!Number.isFinite(wall) || !Number.isFinite(mono)) return limited('clock-invalid');
      // Per-runtime witnesses prevent a stale tab from overwriting another
      // tab's high-water/rollback observation or a newly renewed receipt.
      const clockPrefix = key() + ':clock:' + receipt.renewalId + ':';
      let highWater = receipt.highWater, witnessedInvalid = receipt.invalid;
      let witnessedReason = null;
      for (let index = 0; index < storage.length; index++) {
        const clockKey = storage.key(index);
        if (!clockKey?.startsWith(clockPrefix)) continue;
        const { checksum: witnessChecksum, ...witness } = JSON.parse(storage.getItem(clockKey));
        if (witnessChecksum !== checksum(witness) || witness.binding !== binding ||
            witness.renewalId !== receipt.renewalId || !Number.isFinite(witness.highWater) ||
            witness.highWater < receipt.verifiedAt || typeof witness.invalid !== 'boolean') return limited('clock-evidence-invalid');
        highWater = Math.max(highWater, witness.highWater);
        witnessedInvalid ||= witness.invalid;
        if (witness.invalid) witnessedReason ||= witness.reason || 'lease-evidence-invalid';
      }
      if (!anchor || anchor.renewalId !== receipt.renewalId) {
        anchor = { renewalId: receipt.renewalId, highWater, mono };
        invalid = null;
        invalidReason = null;
      }
      const effective = Math.max(wall, highWater, anchor.highWater + Math.max(0, mono - anchor.mono));
      const rollback = wall + ROLLBACK_TOLERANCE < highWater || wall + ROLLBACK_TOLERANCE < effective;
      invalid ||= witnessedInvalid || rollback;
      if (invalid) invalidReason ||= witnessedReason || (rollback ? 'clock-rollback' : 'lease-evidence-invalid');
      const next = { binding, renewalId: receipt.renewalId, highWater: effective, invalid: Boolean(invalid), reason: invalidReason };
      const clockKey = clockPrefix + observerId;
      storage.setItem(clockKey, seal(next));
      // Verify persistence before granting edit authority (quota/disabled storage fail closed).
      if (storage.getItem(clockKey) !== seal(next) || storage.getItem(key()) !== raw) return limited('receipt-storage-unavailable');
      if (invalid) return limited(invalidReason);
      const age = effective - receipt.verifiedAt;
      return { state: age >= thresholds.limited ? 'LIMITED' : age > thresholds.reminder ? 'REMINDER' : 'NORMAL',
        editable: age < thresholds.limited, reason: age >= thresholds.limited ? 'expired' : null, age };
    } catch { return limited('receipt-storage-invalid'); }
  }
  function assertWritable() {
    if (!observe().editable) throw leaseWriteError();
  }
  function invalidate(reason = 'lease-evidence-invalid') {
    observe();
    invalid = true; invalidReason = reason;
    return observe();
  }
  async function renew(verify, { isCurrent = () => true, timeoutMs = 15000 } = {}) {
    if (renewing) return renewing;
    const expected = binding, owner = identity, contextEpoch = epoch;
    if (!expected || owner !== workspace?.authUserId) throw leaseWriteError();
    const current = () => epoch === contextEpoch && binding === expected && identity === owner && isCurrent();
    renewing = (async () => {
      let timer;
      try {
        const verified = await Promise.race([verify(owner), new Promise((_, reject) => {
          timer = setTimeout(() => reject(Object.assign(new Error('Account verification timed out'), { code: 'LEASE_VERIFY_TIMEOUT' })), timeoutMs);
        })]);
        if (!current() || verified?.id !== owner || verified?.source !== 'supabase-auth-user' ||
            !Number.isFinite(verified.verifiedAt) || verified.verifiedAt <= 0 ||
            Math.abs(now() - verified.verifiedAt) > ROLLBACK_TOLERANCE) throw leaseWriteError();
        const body = { version: 1, binding: expected, renewalId: globalThis.crypto.randomUUID(),
          verifiedAt: verified.verifiedAt, highWater: verified.verifiedAt, invalid: false };
        storage.setItem(key(), seal(body));
        if (!current() || storage.getItem(key()) !== seal(body)) throw leaseWriteError();
        // Retire only obsolete witnesses for this workspace after trusted renewal.
        const clockPrefix = key() + ':clock:';
        for (let index = storage.length - 1; index >= 0; index--) {
          const clockKey = storage.key(index);
          if (clockKey?.startsWith(clockPrefix) && !clockKey.startsWith(clockPrefix + body.renewalId + ':')) storage.removeItem(clockKey);
        }
        anchor = null; invalid = null; invalidReason = null;
        const result = observe();
        if (!result.editable) throw leaseWriteError();
        return result;
      } finally { clearTimeout(timer); }
    })().finally(() => { renewing = null; });
    return renewing;
  }
  return Object.freeze({ setContext, observe, assertWritable, renew, invalidate });
}

// Construct lazily: importing the app must not require writable localStorage.
let runtime;
export const runtimeOfflineLease = () => (runtime ??= createOfflineLease({ thresholds: leaseThresholds() }));
