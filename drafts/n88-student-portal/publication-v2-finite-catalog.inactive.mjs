import {publicationRuntimeAllowed} from './activation/v2-runtime-writer-1031/capability.mjs';
/** AI-authored INACTIVE finite V2 catalogue. Synthetic or verified server capability.
 * No driver/DSN/environment/route/hosted-boundary import or installation.
 * Trusted same-transaction admission and local execution ports are mandatory.
 * Statement success is NOT a receipt/COMMIT ACK. Never retries or reissues.
 */
import { createHash } from 'node:crypto';
import { manualTaskDraft } from '../../src/lib/n88-manual-task-link-safety.js';

const fail = () => { throw Error('n88_v2_catalog_unavailable'); };
const must = v => { if (!v) fail(); };
const exact = (v, keys) => v && Object.getPrototypeOf(v) === Object.prototype &&
  Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const text = (v, n = 200) => typeof v === 'string' && v.length > 0 && v.length <= n && !v.includes('\0');
const uuid = v => typeof v === 'string' && /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(v);
const hex = v => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
const revision = v => Number.isSafeInteger(v) && v >= 0;
const bigint = (v, min = 1n) => typeof v === 'string' && /^(0|[1-9][0-9]{0,18})$/.test(v) && BigInt(v) >= min && BigInt(v) <= 9223372036854775807n;
const stable = v => Array.isArray(v) ? v.map(stable) : v && typeof v === 'object' ?
  Object.fromEntries(Object.keys(v).sort().map(k => [k, stable(v[k])])) : v;
const json = v => JSON.stringify(stable(v));
const sha = v => createHash('sha256').update(v).digest('hex');
const bytes = v => Buffer.byteLength(v);
const freeze = v => { if (v && typeof v === 'object') { Object.values(v).forEach(freeze); Object.freeze(v); } return v; };
const scopeKeys = ['ownerId', 'teachingId', 'sectionId', 'termId', 'subjectId'];
const flags = ['required', 'scheduled', 'completed', 'grade'];
const scope = (v, owner) => exact(v, scopeKeys) && scopeKeys.every(k => text(v[k])) && v.ownerId === owner;
const rowId = v => {
  if (!text(v, 1000) || bytes(v) > 2000) return false;
  let a; try { a = JSON.parse(v); } catch { return false; }
  return Array.isArray(a) && a.length === 3 && ['item', 'subitem', 'manual'].includes(a[0]) && text(a[2]) &&
    (a[0] === 'manual' ? a[1] === null : text(a[1])) && JSON.stringify(a) === v;
};
const sourceKey = v => text(v, 220) && /^(items|scoreSubitems):./.test(v);
const publication = v => {
  if (!(exact(v, ['rowId', 'sourceRevision', 'publicationRevision', 'membershipRevision', 'decisions', 'tombstone']) &&
    rowId(v.rowId) && hex(v.sourceRevision) && hex(v.membershipRevision) && revision(v.publicationRevision) &&
    typeof v.tombstone === 'boolean' && exact(v.decisions, flags) && flags.every(k => typeof v.decisions[k] === 'boolean'))) return false;
  const kind = JSON.parse(v.rowId)[0];
  return (!v.tombstone || flags.every(k => !v.decisions[k])) && (kind !== 'manual' || !v.decisions.grade) &&
    (kind !== 'item' || flags.filter(k => k !== 'grade').every(k => !v.decisions[k]));
};
const root = (v, owner, currentDate) => {
  if (!exact(v, ['scope', 'manualTasks']) || !scope(v.scope, owner) || !Array.isArray(v.manualTasks) || v.manualTasks.length > 2000) return false;
  const ids = new Set();
  for (const m of v.manualTasks) {
    if (!exact(m, ['id', 'title', 'description', 'startDate', 'dueDate', 'link']) || ids.has(m.id)) return false;
    try { if (json(manualTaskDraft(m, new Date(currentDate))) !== json(m)) return false; } catch { return false; }
    ids.add(m.id);
  }
  return true;
};
const receipt = (v, owner) => exact(v, ['version', 'scope', 'binding', 'requestId', 'rowId', 'sourceRevision', 'state', 'publicationRevision']) &&
  v.version === 2 && scope(v.scope, owner) && exact(v.binding, ['sessionId', 'leaseId', 'contextRevision']) &&
  Object.values(v.binding).every(x => text(x)) && typeof v.requestId === 'string' && /^[A-Za-z0-9_-]{16,100}$/.test(v.requestId) &&
  rowId(v.rowId) && hex(v.sourceRevision) && ['applied', 'rejected'].includes(v.state) && revision(v.publicationRevision);
const time = v => Number.isSafeInteger(v) && v >= 0;
const revoked = v => v === null || time(v);
const numericSession = v => exact(v, ['id', 'credentialId', 'ownerId', 'studentId', 'classId', 'enrollmentId', 'membershipRevision',
  'canonicalStamp', 'version', 'tokenHash', 'expiresAt', 'revokedAt']) && uuid(v.id) && uuid(v.credentialId) && uuid(v.ownerId) &&
  ['studentId', 'classId', 'enrollmentId', 'membershipRevision'].every(k => text(v[k], 240)) && hex(v.canonicalStamp) &&
  Number.isSafeInteger(v.version) && v.version >= 1 && hex(v.tokenHash) && time(v.expiresAt) && revoked(v.revokedAt);
const credential = v => exact(v, ['id', 'ownerId', 'studentId', 'version', 'reservation', 'verifier', 'keyVersion', 'revokedAt']) &&
  uuid(v.id) && uuid(v.ownerId) && text(v.studentId, 240) && Number.isSafeInteger(v.version) && v.version >= 1 &&
  hex(v.reservation) && hex(v.verifier) && typeof v.keyVersion === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(v.keyVersion) && revoked(v.revokedAt);

const definitions = [];
const add = (id, sql, parameters, output, maxRows, maxBytes, effect = false) =>
  definitions.push({ id, sql, sha256: sha(sql), parameters, output, maxRows, maxBytes, effect });
add('owner-context', 'select namespace,owner_id,active from n88_private.contexts where owner_id=$1::uuid for share',
  ['owner:uuid'], ['namespace:text', 'owner_id:uuid', 'active:boolean'], 1, 4096);
add('numeric-session', 'select payload from n88_private.numeric_sessions where token_hash=$1 for share',
  ['tokenHash:hex64'], ['payload:numericSession'], 1, 4096);
add('numeric-credential', 'select payload from n88_private.numeric_credentials where id=$1::uuid and owner_id=$2::uuid and student_id=$3 and version=$4::bigint for share',
  ['credentialId:uuid', 'owner:uuid', 'studentId:text240', 'version:positiveBigint'], ['payload:numericCredential'], 1, 2048);
const stores = [
  ['scopes', 'scope_key,store_revision::text as store_revision,payload', 'scope_key'],
  ['items', 'scope_key,row_id,publication_revision::text as publication_revision,tombstone,payload', 'scope_key,row_id'],
  ['high_water', 'scope_key,source_key,canonical_revision::text as canonical_revision,retired', 'scope_key,source_key'],
  ['receipts', 'request_id,scope_key,fingerprint,payload', 'request_id'],
];
for (const [table, columns, order] of stores) add(`read-${table}`,
  `select case when octet_length(body)<=$3 and sum(octet_length(body)) over (rows unbounded preceding)<=$4 then body else null end as body from (select row_to_json(r)::text as body from (select ${columns} from n88_private.publication_v2_${table} where owner_id=$1::uuid order by ${order} limit $2) r) bounded`,
  ['owner:uuid', 'overflowLimit:10001', 'rowBytes:2097152', 'remainingBytes:1..4194304'], ['body:typedStorageJSON'], 10000, 4194304);
add('insert-scope', 'insert into n88_private.publication_v2_scopes(owner_id,scope_key,store_revision,payload) values($1::uuid,$2,1,$3::jsonb)',
  ['owner:uuid', 'scopeKey:hex64', 'root:canonicalJSON'], [], 0, 0, true);
add('cas-scope', 'update n88_private.publication_v2_scopes set store_revision=store_revision+1,payload=$3::jsonb where owner_id=$1::uuid and scope_key=$2 and store_revision=$4::bigint',
  ['owner:uuid', 'scopeKey:hex64', 'root:canonicalJSON', 'priorStoreRevision:positiveBigint'], [], 0, 0, true);
add('insert-item', 'insert into n88_private.publication_v2_items(owner_id,scope_key,row_id,publication_revision,tombstone,payload) values($1::uuid,$2,$3,$4::bigint,$5,$6::jsonb)',
  ['owner:uuid', 'scopeKey:hex64', 'rowId:text', 'revision:safeBigint', 'tombstone:boolean', 'publication:canonicalJSON'], [], 0, 0, true);
add('cas-item', 'update n88_private.publication_v2_items set publication_revision=$4::bigint,tombstone=$5,payload=$6::jsonb where owner_id=$1::uuid and scope_key=$2 and row_id=$3 and publication_revision=$7::bigint and payload=$8::jsonb',
  ['owner:uuid', 'scopeKey:hex64', 'rowId:text', 'revision:safeBigint', 'tombstone:boolean', 'publication:canonicalJSON', 'priorRevision:safeBigint', 'priorPublication:canonicalJSON'], [], 0, 0, true);
add('insert-high-water', 'insert into n88_private.publication_v2_high_water(owner_id,scope_key,source_key,canonical_revision,retired) values($1::uuid,$2,$3,$4::bigint,$5)',
  ['owner:uuid', 'scopeKey:hex64', 'sourceKey:text220', 'canonicalRevision:positiveBigint', 'retired:boolean'], [], 0, 0, true);
add('cas-high-water', 'update n88_private.publication_v2_high_water set canonical_revision=$4::bigint,retired=$5 where owner_id=$1::uuid and scope_key=$2 and source_key=$3 and canonical_revision=$6::bigint and retired=$7',
  ['owner:uuid', 'scopeKey:hex64', 'sourceKey:text220', 'canonicalRevision:positiveBigint', 'retired:boolean', 'priorRevision:positiveBigint', 'priorRetired:boolean'], [], 0, 0, true);
add('insert-receipt', 'insert into n88_private.publication_v2_receipts(owner_id,request_id,scope_key,fingerprint,payload) values($1::uuid,$2,$3,$4,$5::jsonb)',
  ['owner:uuid', 'requestId:text16..100', 'scopeKey:hex64', 'fingerprint:hex64', 'receipt:canonicalJSON'], [], 0, 0, true);

export const publicationV2FiniteCatalog = freeze(definitions);
export const publicationV2FiniteCatalogSha256 = sha(json(publicationV2FiniteCatalog));
const byId = new Map(definitions.map(v => [v.id, v]));
const parse = (s, max) => { must(typeof s === 'string' && bytes(s) <= max); return JSON.parse(s); };
const canonical = (s, max) => { const v = parse(s, max); must(json(v) === s); return v; };

function validateArgs(op, a, c, currentDate) {
  must(Array.isArray(a) && a.length === op.parameters.length);
  if (c.role === 'locator') must(['numeric-session', 'numeric-credential', 'owner-context'].includes(op.id));
  if (op.id === 'numeric-session') {
    must(c.numeric && a[0] === c.numeric.tokenHash); return;
  }
  if (op.id === 'numeric-credential') {
    must(c.numeric && a[0] === c.numeric.credentialId && a[1] === c.ownerId && a[2] === c.numeric.studentId && a[3] === c.numeric.version); return;
  }
  must(a[0] === c.ownerId);
  if (op.id === 'owner-context') return;
  if (op.id.startsWith('read-')) {
    must(a[1] === 10001 && a[2] === 2097152 && Number.isSafeInteger(a[3]) && a[3] >= 1 && a[3] <= 4194304); return;
  }
  // This is an INTERNAL storage permission, supplied only after the original
  // service guard. It must never be inferred from a browser/student role alone.
  must(c.storageWrite && hex(a[op.id === 'insert-receipt' ? 2 : 1]));
  if (op.id.endsWith('scope')) {
    const v = canonical(a[2], 2097152);
    must(root(v, c.ownerId, currentDate) && sha(json(v.scope)) === a[1]);
    if (op.id === 'cas-scope') must(bigint(a[3]));
  } else if (op.id.endsWith('item')) {
    const v = canonical(a[5], 16384);
    must(publication(v) && a[2] === v.rowId && a[3] === String(v.publicationRevision) && a[4] === v.tombstone);
    if (op.id === 'cas-item') {
      const old = canonical(a[7], 16384);
      must(publication(old) && a[2] === old.rowId && a[6] === String(old.publicationRevision) &&
        v.publicationRevision > old.publicationRevision && (!old.tombstone || v.tombstone));
    }
  } else if (op.id.endsWith('high-water')) {
    must(sourceKey(a[2]) && bigint(a[3]) && typeof a[4] === 'boolean');
    if (op.id === 'cas-high-water') must(bigint(a[5]) && BigInt(a[3]) >= BigInt(a[5]) && typeof a[6] === 'boolean' && (!a[6] || a[4]));
  } else {
    must(op.id === 'insert-receipt');
    const v = canonical(a[4], 16384);
    must(receipt(v, c.ownerId) && v.binding.sessionId === c.sessionId && a[1] === v.requestId &&
      a[2] === sha(json(v.scope)) && hex(a[3]));
  }
}

function validateBody(id, r, c, currentDate, scopes) {
  must(hex(r.scope_key));
  if (id !== 'read-scopes') must(scopes.has(r.scope_key));
  if (id === 'read-scopes') {
    must(exact(r, ['scope_key', 'store_revision', 'payload']) && bigint(r.store_revision) && root(r.payload, c.ownerId, currentDate) && sha(json(r.payload.scope)) === r.scope_key);
    must(!scopes.has(r.scope_key)); scopes.add(r.scope_key);
  } else if (id === 'read-items') {
    must(exact(r, ['scope_key', 'row_id', 'publication_revision', 'tombstone', 'payload']) && publication(r.payload) &&
      r.row_id === r.payload.rowId && r.publication_revision === String(r.payload.publicationRevision) && r.tombstone === r.payload.tombstone);
  } else if (id === 'read-high_water') {
    must(exact(r, ['scope_key', 'source_key', 'canonical_revision', 'retired']) && sourceKey(r.source_key) && bigint(r.canonical_revision) && typeof r.retired === 'boolean');
  } else must(exact(r, ['request_id', 'scope_key', 'fingerprint', 'payload']) && receipt(r.payload, c.ownerId) &&
    r.request_id === r.payload.requestId && hex(r.fingerprint) && r.scope_key === sha(json(r.payload.scope)));
}

function validateResult(op, r, a, c, currentDate, scopes) {
  must(exact(r, ['command', 'rowCount', 'rows']) && Array.isArray(r.rows) && Number.isSafeInteger(r.rowCount) && r.rowCount >= 0);
  if (op.effect) {
    must(r.command === (op.id.startsWith('insert-') ? 'INSERT' : 'UPDATE') && r.rows.length === 0 && r.rowCount === 1); return 0;
  }
  must(r.command === 'SELECT' && r.rowCount === r.rows.length && r.rows.length <= op.maxRows);
  let total = 0;
  for (const row of r.rows) {
    if (op.id.startsWith('read-')) {
      must(exact(row, ['body']) && typeof row.body === 'string');
      const size = bytes(row.body); must(size <= a[2]); total += size; must(total <= a[3]);
      validateBody(op.id, parse(row.body, a[2]), c, currentDate, scopes);
    } else {
      total += bytes(json(row));
      if (op.id === 'owner-context') must(exact(row, ['namespace', 'owner_id', 'active']) && typeof row.namespace === 'string' &&
        /^[A-Za-z0-9_-]{24,64}$/.test(row.namespace) && row.owner_id === c.ownerId && typeof row.active === 'boolean');
      else {
        must(exact(row, ['payload'])); const v = row.payload;
        must(bytes(json(v)) <= op.maxBytes);
        if (op.id === 'numeric-session') must(numericSession(v) && v.tokenHash === c.numeric.tokenHash &&
          (c.role === 'locator' && c.ownerId === null || v.ownerId === c.ownerId && v.id === c.sessionId &&
          v.credentialId === c.numeric.credentialId && v.studentId === c.numeric.studentId && String(v.version) === c.numeric.version));
        else must(credential(v) && v.ownerId === c.ownerId && v.id === a[0] && v.studentId === a[2] && String(v.version) === a[3]);
      }
    }
  }
  must(total <= (op.id.startsWith('numeric-') ? op.maxBytes + 32 : op.maxBytes));
  return total;
}

const admission = (c, now) => exact(c, ['ownerId', 'sessionId', 'role', 'expiresAt', 'numeric', 'storageWrite']) &&
  time(c.expiresAt) && c.expiresAt > now && typeof c.storageWrite === 'boolean' &&
  (c.role === 'locator' ? c.ownerId === null && c.sessionId === null && !c.storageWrite &&
    exact(c.numeric, ['tokenHash', 'credentialId', 'studentId', 'version']) && hex(c.numeric.tokenHash) &&
    ['credentialId', 'studentId', 'version'].every(k => c.numeric[k] === null) :
    uuid(c.ownerId) && text(c.sessionId) && ['teacher', 'student'].includes(c.role) && (c.role === 'teacher' ? c.numeric === null :
      exact(c.numeric, ['tokenHash', 'credentialId', 'studentId', 'version']) && hex(c.numeric.tokenHash) && uuid(c.numeric.credentialId) &&
      text(c.numeric.studentId, 240) && bigint(c.numeric.version)));
const matchesLocated = (c, v) => c.ownerId === v.ownerId && c.sessionId === v.id && c.numeric?.tokenHash === v.tokenHash &&
  c.numeric.credentialId === v.credentialId && c.numeric.studentId === v.studentId && c.numeric.version === String(v.version);

/** Server-only capability wrapper for a LOCAL synthetic transaction executor.
 * verifyAdmission MUST delegate to original Auth/current-session/numeric guards
 * on the same locked transaction; this module neither authenticates nor COMMITs.
 * Before numeric Auth can run, trusted ingress may return role:'locator' with
 * only the cookie hash (null owner/session/tuple, storageWrite:false). That opens
 * ONLY the three fixed lookup reads, bound to the locked session row's tuple.
 * Storage remains denied until the ORIGINAL numeric guard upgrades admission
 * to student with that exact tuple. A locator is never authentication.
 * executeFixed receives only catalogue SQL and detached validated parameters;
 * it returns {command,rowCount,rows} (strip pg driver metadata at trusted port).
 * Timeout poisons the request, aborts its signal and never retries. The parent
 * transaction must roll back/destroy its owned client on ANY rejection/unknown.
 */
export function createInactivePublicationV2FiniteCatalog({ executionMode, runtimeCapability, verifyAdmission, executeFixed, now = Date.now,
  budgetMs = 5000, maxOperations = 20000 }) {
  must(publicationRuntimeAllowed(executionMode,runtimeCapability) && typeof verifyAdmission === 'function' && typeof executeFixed === 'function' && typeof now === 'function' &&
    Number.isSafeInteger(budgetMs) && budgetMs >= 10 && budgetMs <= 10000 && Number.isSafeInteger(maxOperations) && maxOperations >= 1 && maxOperations <= 20000);
  const requests = new WeakMap(), tickets = new WeakMap();
  const state = request => {
    must(request && typeof request === 'object');
    if (!requests.has(request)) requests.set(request, { deadline: now() + budgetMs, calls: 0, bytes: 0, rows: 0, poisoned: false, busy: false,
      controller: new AbortController(), context: null, located: null, scopes: new Set(), effects: new Set() });
    return requests.get(request);
  };
  const poison = s => { s.poisoned = true; s.controller.abort(); };
  const fence = s => must(!s.poisoned && now() < s.deadline);
  const within = async (s, action) => {
    fence(s); let timer;
    try {
      return await Promise.race([Promise.resolve().then(action), new Promise((_, reject) => {
        timer = setTimeout(() => { poison(s); reject(Error('n88_v2_catalog_unavailable')); }, Math.max(1, s.deadline - now()));
      })]);
    } finally { clearTimeout(timer); }
  };
  const verify = async (s, request) => {
    fence(s); const c = structuredClone(await within(s, () => verifyAdmission(request, s.controller.signal))); fence(s);
    must(admission(c, now()));
    if (s.context && json(s.context) !== json(c)) {
      must(s.context.role === 'locator' && c.role === 'student' && s.located && matchesLocated(c, s.located) &&
        c.numeric.tokenHash === s.context.numeric.tokenHash);
      s.context = c; // Original numeric Auth only; never inferred from lookup.
    } else if (!s.context) s.context = c;
    return c.role === 'locator' && s.located ? { ...c, ownerId: s.located.ownerId, sessionId: s.located.id,
      numeric: { tokenHash: s.located.tokenHash, credentialId: s.located.credentialId, studentId: s.located.studentId, version: String(s.located.version) } } : c;
  };
  return Object.freeze({
    async prepare(request, command) {
      const s = state(request);
      try {
        fence(s); must(!s.busy && exact(command, ['operation', 'args'])); s.busy = true;
        must(typeof command.operation === 'string' && byId.has(command.operation) && ++s.calls <= maxOperations);
        const op = byId.get(command.operation);
        must(Array.isArray(command.args) && command.args.length === op.parameters.length && Object.keys(command.args).length === command.args.length && command.args.every(v =>
          typeof v === 'boolean' || typeof v === 'number' && Number.isFinite(v) || typeof v === 'string' && bytes(v) <= 2097152));
        const args = structuredClone(command.args);
        const c = await verify(s, request); validateArgs(op, args, c, now());
        if (op.effect) { const key = sha(json([op.id, args])); must(!s.effects.has(key)); s.effects.add(key); }
        const ticket = Object.freeze({}); tickets.set(ticket, { request, op, args, context: json(c), spent: false }); return ticket;
      } catch { poison(s); fail(); } finally { s.busy = false; }
    },
    async execute(request, ticket) {
      const t = tickets.get(ticket), s = state(request);
      // Consume BEFORE any validation/await, including wrong-request attempts.
      const spent = t?.spent; if (t) t.spent = true;
      try {
        fence(s); must(t && !spent && t.request === request && !s.busy); s.busy = true;
        const c = await verify(s, request); must(json(c) === t.context);
        validateArgs(t.op, t.args, c, now());
        if (t.op.effect && !t.op.id.endsWith('scope')) must(s.scopes.has(t.args[t.op.id === 'insert-receipt' ? 2 : 1]));
        const raw = await within(s, () => executeFixed(t.op.sql, structuredClone(t.args), s.controller.signal));
        // A fresh scope-read replaces its set; child rows must belong to an
        // owner-validated root, never just an attacker-selected opaque hash.
        if (t.op.id === 'read-scopes') s.scopes.clear();
        fence(s); s.bytes += validateResult(t.op, raw, t.args, c, now(), s.scopes); s.rows += raw.rows.length;
        const result = structuredClone(raw); // clone only after transfer/shape caps
        if (t.op.id === 'numeric-session' && c.role === 'locator' && result.rows.length === 1) {
          const v = result.rows[0].payload;
          if (s.located) must(json(s.located) === json(v)); else s.located = structuredClone(v);
        }
        if (t.op.effect && t.op.id.endsWith('scope')) s.scopes.add(t.args[1]);
        must(s.bytes <= 4194304 && s.rows <= 20000);
        await verify(s, request); fence(s);
        return result; // Internal storage data ONLY; never a student response.
      } catch { poison(s); if (t) poison(state(t.request)); fail(); } finally { s.busy = false; }
    },
    close(request) { poison(state(request)); },
  });
}
