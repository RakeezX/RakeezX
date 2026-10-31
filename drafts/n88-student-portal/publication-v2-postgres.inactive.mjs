import {publicationRuntimeAllowed} from './activation/v2-runtime-writer-1031/capability.mjs';
/** AI: executable, INACTIVE PostgreSQL storage port. No driver, DSN, acquisition,
 * route, migration or live default. Reuses the existing repository's transaction
 * signature/global lock and canonical reader, not its hosted finite SQL allowance.
 * Auth/readCurrent are trusted server ports, never browser proofs. No retries.
 */
import { createHash } from 'node:crypto';
import { readCanonical } from './integrated-service.mjs';
import { manualTaskDraft } from '../../src/lib/n88-manual-task-link-safety.js';

const fail = () => { throw Error('n88_v2_storage_unavailable'); };
const must = v => { if (!v) fail(); };
const exact = (v, keys) => v && Object.getPrototypeOf(v) === Object.prototype && Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const id = v => typeof v === 'string' && v.length > 0 && v.length <= 200 && !v.includes('\0');
const uuid = v => typeof v === 'string' && /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(v);
const hex = v => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
const revision = v => Number.isSafeInteger(v) && v >= 0;
const bigint = v => typeof v === 'string' && /^[1-9][0-9]{0,18}$/.test(v) && BigInt(v) <= 9223372036854775807n;
const flags = ['required', 'scheduled', 'completed', 'grade'];
const scopeKeys = ['ownerId', 'teachingId', 'sectionId', 'termId', 'subjectId'];
const stable = v => Array.isArray(v) ? v.map(stable) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, stable(v[k])])) : v;
const json = v => JSON.stringify(stable(v));
const key = scope => hash(scope);
const hash = v => createHash('sha256').update(json(v)).digest('hex');
const scoped = (scope, owner) => exact(scope, scopeKeys) && scopeKeys.every(k => id(scope[k])) && scope.ownerId === owner && uuid(owner);
const tables = {
  scopes: ['publication_v2_scopes', 'scope_key,store_revision::text as store_revision,payload', 'scope_key'],
  publications: ['publication_v2_items', 'scope_key,row_id,publication_revision::text as publication_revision,tombstone,payload', 'scope_key,row_id'],
  sourceVersions: ['publication_v2_high_water', 'scope_key,source_key,canonical_revision::text as canonical_revision,retired', 'scope_key,source_key'],
  receipts: ['publication_v2_receipts', 'request_id,scope_key,fingerprint,payload', 'request_id'],
};
// Fixed identifiers only. SQL caps transfer and detects overflow, not truncation.
const reads = Object.fromEntries(Object.entries(tables).map(([name, [table, cols, order]]) => [name,
  `select case when octet_length(body)<=$3 and sum(octet_length(body)) over (rows unbounded preceding)<=$4 then body else null end as body from (select row_to_json(r)::text as body from (select ${cols} from n88_private.${table} where owner_id=$1::uuid order by ${order} limit $2) r) bounded`]));

/** Explicit synthetic acquisition or capability-verified server assembly only.
 * Exclusive pg-compatible client, typed query result and release(error) contract.
 * Hosted assembly supplies the exact installed finite operation identities;
 * passing new statements to the old privateQuery must continue to fail.
 */
export function createPublicationV2PostgresRepository({ executionMode, runtimeCapability, acquire, transactionMs = 5000, cleanupMs = 500 }) {
  must(publicationRuntimeAllowed(executionMode,runtimeCapability) && typeof acquire === 'function' && Number.isInteger(transactionMs) && transactionMs >= 50 && transactionMs <= 10000 &&
    Number.isInteger(cleanupMs) && cleanupMs >= 1 && cleanupMs <= 1000);
  return Object.freeze({ async transaction(action) {
    let client, live = true, committed = false, begun = false, timer, released = false;
    const release = (c, broken) => { if (!released) { released = true; c.release(broken ? Error('n88_v2_storage_unavailable') : undefined); } };
    const deadline = Date.now() + transactionMs, guards = [];
    const fence = () => must(live && Date.now() < deadline);
    const query = async (sql, args = []) => { fence(); const r = await client.query(sql, args); fence(); return r; };
    const lease = Promise.resolve().then(acquire);
    lease.then(c => { if (!live) release(c, true); }, () => {});
    const work = (async () => {
      client = await lease; fence(); must(typeof client?.query === 'function' && typeof client.release === 'function');
      await query('begin isolation level read committed'); begun = true;
      await query("select set_config('statement_timeout',$1,true),set_config('lock_timeout',$1,true),set_config('idle_in_transaction_session_timeout',$1,true),set_config('search_path','pg_catalog',true),set_config('TimeZone','UTC',true),set_config('DateStyle','ISO, YMD',true),set_config('synchronous_commit','on',true)", [String(transactionMs)]);
      // Same lock order as existing N88 source/canonical transactions. Bounded
      // single-pilot serialization is intentional, not a public-scale claim.
      await query('select pg_advisory_xact_lock(1312307256, 88)');
      const result = structuredClone(await action({}, Object.freeze({ query,
        beforeCommit: fn => { fence(); must(typeof fn === 'function' && guards.length < 8); guards.push(fn); },
        canonicalReadMode: () => { fence(); return 'serial'; },
      })));
      fence(); for (const guard of guards) { await guard(); fence(); }
      must((await query('commit')).command === 'COMMIT'); committed = true;
      return result;
    })();
    try { return await Promise.race([work, new Promise((_, reject) => { timer = setTimeout(() => reject(Error('n88_v2_storage_unavailable')), transactionMs); })]); }
    catch {
      live = false;
      if (client && begun && !committed) {
        let cleanup;
        try { await Promise.race([client.query('rollback'), new Promise((_, reject) => { cleanup = setTimeout(reject, cleanupMs); })]); }
        catch { /* uncertain connection is destroyed, never reused or retried */ }
        finally { clearTimeout(cleanup); }
      }
      fail();
    } finally { live = false; clearTimeout(timer); if (client) release(client, !committed); }
  } });
}

function validate(state, owner) {
  must(exact(state, ['scopes', 'receipts']) && Array.isArray(state.scopes) && Array.isArray(state.receipts));
  must(state.scopes.length <= 2000 && state.receipts.length <= 10000 && Buffer.byteLength(json(state)) <= 4 * 1024 * 1024);
  const scopes = new Map(), receipts = new Map();
  for (const s of state.scopes) {
    must(exact(s, ['scope', 'manualTasks', 'publications', 'sourceVersions']) && scoped(s.scope, owner));
    const k = key(s.scope); must(!scopes.has(k)); scopes.set(k, s);
    must(Array.isArray(s.manualTasks) && s.manualTasks.length <= 2000 && Array.isArray(s.publications) && s.publications.length <= 2000 &&
      Array.isArray(s.sourceVersions) && s.sourceVersions.length <= 4000);
    const manual = new Set(), pubs = new Set(), versions = new Set();
    for (const m of s.manualTasks) {
      must(exact(m, ['id', 'title', 'description', 'startDate', 'dueDate', 'link']) && !manual.has(m.id));
      must(json(manualTaskDraft(m)) === json(m)); manual.add(m.id);
    }
    for (const p of s.publications) {
      must(exact(p, ['rowId', 'sourceRevision', 'publicationRevision', 'membershipRevision', 'decisions', 'tombstone']) &&
        typeof p.rowId === 'string' && p.rowId.length <= 1000 && Buffer.byteLength(p.rowId) <= 2000 && !pubs.has(p.rowId) && hex(p.sourceRevision) && hex(p.membershipRevision) &&
        revision(p.publicationRevision) && typeof p.tombstone === 'boolean' && exact(p.decisions, flags) && flags.every(k => typeof p.decisions[k] === 'boolean'));
      let tuple; try { tuple = JSON.parse(p.rowId); } catch { fail(); }
      must(Array.isArray(tuple) && tuple.length === 3 && ['manual', 'item', 'subitem'].includes(tuple[0]) && id(tuple[2]) &&
        (tuple[0] === 'manual' ? tuple[1] === null && !p.decisions.grade : id(tuple[1])));
      if (p.tombstone) must(flags.every(k => !p.decisions[k]));
      if (tuple[0] === 'manual' && !p.tombstone) must(manual.has(tuple[2]));
      if (tuple[0] === 'item') must(flags.filter(k => k !== 'grade').every(k => !p.decisions[k]));
      pubs.add(p.rowId);
    }
    for (const m of s.manualTasks) must(s.publications.some(p => p.rowId === JSON.stringify(['manual', null, m.id]) && !p.tombstone));
    for (const v of s.sourceVersions) {
      must(exact(v, ['key', 'revision', 'retired']) && typeof v.key === 'string' && /^(items|scoreSubitems):./.test(v.key) &&
        v.key.length <= 220 && bigint(v.revision) && typeof v.retired === 'boolean' && !versions.has(v.key)); versions.add(v.key);
    }
  }
  for (const r of state.receipts) {
    must(exact(r, ['ownerId', 'requestId', 'fingerprint', 'receipt']) && r.ownerId === owner &&
      /^[A-Za-z0-9_-]{16,100}$/.test(r.requestId) && hex(r.fingerprint) && !receipts.has(r.requestId));
    const a = r.receipt;
    must(exact(a, ['version', 'scope', 'binding', 'requestId', 'rowId', 'sourceRevision', 'state', 'publicationRevision']) &&
      a.version === 2 && scoped(a.scope, owner) && scopes.has(key(a.scope)) && exact(a.binding, ['sessionId', 'leaseId', 'contextRevision']) &&
      Object.values(a.binding).every(id) && a.requestId === r.requestId && typeof a.rowId === 'string' && a.rowId.length <= 1000 &&
      hex(a.sourceRevision) && ['applied', 'rejected'].includes(a.state) && revision(a.publicationRevision));
    receipts.set(r.requestId, r);
  }
  return { scopes, receipts };
}

function transitions(before, after) {
  for (const [k, old] of before.scopes) {
    const next = after.scopes.get(k); must(next);
    for (const p of old.publications) {
      const n = next.publications.find(n => n.rowId === p.rowId); must(n);
      must(json(n) === json(p) || n.publicationRevision > p.publicationRevision);
      must(!p.tombstone || n.tombstone);
    }
    for (const v of old.sourceVersions) {
      const n = next.sourceVersions.find(n => n.key === v.key);
      must(n && BigInt(n.revision) >= BigInt(v.revision) && (!v.retired || n.retired));
    }
  }
  for (const [id, receipt] of before.receipts) must(json(after.receipts.get(id)) === json(receipt));
}

/** Returns ports accepted by the existing OFF service, using the existing typed
 * transaction signature. Hosted privateQuery does NOT yet allow these statements.
 * New server assembly requires a verified capability; publication enables nothing.
 */
export function createPublicationV2PostgresPorts({ executionMode, runtimeCapability, repository, authenticate,
  readCurrent = async (tx, auth) => ({ canonical: await readCanonical(tx, auth.ownerId),
    now: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Riyadh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()) }) }) {
  must(publicationRuntimeAllowed(executionMode,runtimeCapability) && typeof repository?.transaction === 'function' && typeof authenticate === 'function' && typeof readCurrent === 'function');
  const owned = new WeakSet();
  return Object.freeze({
    authenticate: (request, tx, role) => { must(owned.has(tx)); return authenticate(request, tx, role); },
    readCurrent: (tx, auth, scope) => { must(owned.has(tx) && tx.ownerId === auth.ownerId && scoped(scope, auth.ownerId)); return readCurrent(tx, auth, scope); },
    async transaction(action) {
      let revoke = () => {};
      try { return await repository.transaction(async (_legacy, ports) => {
      must(typeof ports?.query === 'function' && typeof ports.beforeCommit === 'function' && typeof ports.canonicalReadMode === 'function');
      let live = true, owner = null, original = null, stores = new Map();
      const guards = [], fence = () => must(live);
      const state = { scopes: [], receipts: [] };
      const tx = { state,
        get ownerId() { fence(); return owner; },
        query: (...args) => { fence(); return ports.query(...args); },
        canonicalReadMode: () => { fence(); return ports.canonicalReadMode(); },
        beforeCommit: fn => { fence(); must(typeof fn === 'function' && guards.length < 8); guards.push(fn); },
        async bindOwner(nextOwner) {
          fence(); must(uuid(nextOwner) && (!owner || owner === nextOwner)); if (owner) return;
          owner = nextOwner; let bytes = 0, count = 0;
          for (const name of Object.keys(tables)) {
            const result = await tx.query(reads[name], [owner, 10001, 2 * 1024 * 1024, 4 * 1024 * 1024 - bytes]);
            must(result.rows.length <= 10000 && (count += result.rows.length) <= 20000);
            for (const raw of result.rows) {
              must(exact(raw, ['body']) && typeof raw.body === 'string'); bytes += Buffer.byteLength(raw.body); must(bytes <= 4 * 1024 * 1024);
              const r = JSON.parse(raw.body);
              if (name === 'scopes') {
                must(exact(r, ['scope_key', 'store_revision', 'payload']) && bigint(r.store_revision) && exact(r.payload, ['scope', 'manualTasks']) &&
                  scoped(r.payload.scope, owner) && r.scope_key === key(r.payload.scope) && !stores.has(r.scope_key));
                stores.set(r.scope_key, r.store_revision); state.scopes.push({ ...r.payload, publications: [], sourceVersions: [] });
              } else if (name === 'receipts') {
                must(exact(r, ['request_id', 'scope_key', 'fingerprint', 'payload']) && r.scope_key === key(r.payload.scope));
                state.receipts.push({ ownerId: owner, requestId: r.request_id, fingerprint: r.fingerprint, receipt: r.payload });
              } else {
                const s = state.scopes.find(s => key(s.scope) === r.scope_key); must(s);
                if (name === 'publications') {
                  must(exact(r, ['scope_key', 'row_id', 'publication_revision', 'tombstone', 'payload']) &&
                    r.row_id === r.payload.rowId && String(r.payload.publicationRevision) === r.publication_revision && r.tombstone === r.payload.tombstone);
                  s.publications.push(r.payload);
                } else {
                  must(exact(r, ['scope_key', 'source_key', 'canonical_revision', 'retired']));
                  s.sourceVersions.push({ key: r.source_key, revision: r.canonical_revision, retired: r.retired });
                }
              }
            }
          }
          validate(state, owner); original = structuredClone(state);
        },
      };
      owned.add(tx);
      Object.freeze(tx);
      revoke = () => { live = false; owned.delete(tx); };
      try {
        const value = await action(tx); fence(); must(owner && original);
        const final = structuredClone(state), result = structuredClone(value);
        const before = validate(original, owner), after = validate(final, owner); transitions(before, after);
        // Detached flush image: retained callback/result references cannot race SQL.
        for (const [k, s] of after.scopes) {
          const old = before.scopes.get(k), args = [owner, k];
          const root = { scope: s.scope, manualTasks: s.manualTasks };
          if (!old) must((await tx.query('insert into n88_private.publication_v2_scopes(owner_id,scope_key,store_revision,payload) values($1::uuid,$2,1,$3::jsonb)', [...args, json(root)])).rowCount === 1);
          else if (json(old) !== json(s)) must((await tx.query('update n88_private.publication_v2_scopes set store_revision=store_revision+1,payload=$3::jsonb where owner_id=$1::uuid and scope_key=$2 and store_revision=$4::bigint', [...args, json(root), stores.get(k)])).rowCount === 1);
          for (const p of s.publications) {
            const prior = old?.publications.find(v => v.rowId === p.rowId);
            const values = [...args, p.rowId, String(p.publicationRevision), p.tombstone, json(p)];
            if (!prior) must((await tx.query('insert into n88_private.publication_v2_items(owner_id,scope_key,row_id,publication_revision,tombstone,payload) values($1::uuid,$2,$3,$4::bigint,$5,$6::jsonb)', values)).rowCount === 1);
            else if (json(prior) !== json(p)) must((await tx.query('update n88_private.publication_v2_items set publication_revision=$4::bigint,tombstone=$5,payload=$6::jsonb where owner_id=$1::uuid and scope_key=$2 and row_id=$3 and publication_revision=$7::bigint and payload=$8::jsonb', [...values, String(prior.publicationRevision), json(prior)])).rowCount === 1);
          }
          for (const v of s.sourceVersions) {
            const prior = old?.sourceVersions.find(p => p.key === v.key), values = [...args, v.key, v.revision, v.retired];
            if (!prior) must((await tx.query('insert into n88_private.publication_v2_high_water(owner_id,scope_key,source_key,canonical_revision,retired) values($1::uuid,$2,$3,$4::bigint,$5)', values)).rowCount === 1);
            else if (json(prior) !== json(v)) must((await tx.query('update n88_private.publication_v2_high_water set canonical_revision=$4::bigint,retired=$5 where owner_id=$1::uuid and scope_key=$2 and source_key=$3 and canonical_revision=$6::bigint and retired=$7', [...values, prior.revision, prior.retired])).rowCount === 1);
          }
        }
        for (const [id, r] of after.receipts) if (!before.receipts.has(id)) must((await tx.query('insert into n88_private.publication_v2_receipts(owner_id,request_id,scope_key,fingerprint,payload) values($1::uuid,$2,$3,$4,$5::jsonb)', [owner, id, key(r.receipt.scope), r.fingerprint, json(r.receipt)])).rowCount === 1);
        ports.beforeCommit(async () => {
          fence(); must(hash(state) === hash(final));
          for (const guard of guards) { await guard(); fence(); }
          must(hash(state) === hash(final));
        });
        // Keep the tx capability alive through the underlying repository's guards,
        // but revoke it after that repository resolves/rejects, including lost ACK.
        return result;
      } catch { live = false; owned.delete(tx); fail(); }
      }); } finally { revoke(); }
    },
  });
}
