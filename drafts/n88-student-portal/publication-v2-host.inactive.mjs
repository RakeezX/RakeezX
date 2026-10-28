/** AI: INACTIVE owned-local host assembly. No hosted mode, DSN, environment,
 * listener, installation or fallback. Reuses the published bridge unchanged.
 */
import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createInactivePublicationV2FiniteBridge } from './publication-v2-finite-bridge.inactive.mjs';
import { publicationV2FiniteCatalog as catalog, publicationV2FiniteCatalogSha256 } from './publication-v2-finite-catalog.inactive.mjs';
import { createPublicationV2PostgresRepository } from './publication-v2-postgres.inactive.mjs';
import { createPublicationV2Service } from './publication-v2-service.inactive.mjs';

const fail = () => { throw Error('n88_v2_host_unavailable'); };
const must = v => { if (!v) fail(); };
const sha = b => createHash('sha256').update(b).digest('hex');
// Git text checkouts may use CRLF. Package identities use UTF8/LF, preserving
// BOM/content; SQL statement/function identities retain their separate codecs.
const sourceSha = b => sha(b.toString('utf8').replaceAll('\r\n', '\n'));
const capabilities = new WeakMap();
const normalized = p => path.resolve(p).toLowerCase();
const clean = r => ({ command: r.command, rowCount: r.rowCount, rows: r.rows });
const currentSession = 'select user_id,session_id from n88_private.lock_current_session($1::uuid,$2::uuid)';
export const publicationV2FunctionReadback = `select p.proname as name,encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex') as definition,
 p.prosecdef as definer,pg_get_userbyid(p.proowner) as owner,p.proconfig as config,
 (select array_agg(coalesce(r.rolname,'PUBLIC')||':'||a.privilege_type order by coalesce(r.rolname,'PUBLIC'),a.privilege_type)
 from aclexplode(p.proacl) a left join pg_roles r on r.oid=a.grantee) as acl
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='n88_private' and p.proname=any($1::text[]) order by p.proname`;

/** Mint an unforgeable capability ONLY after proving a task-owned NEW local
 * cluster marker, directory, live postmaster identity and same-server readback.
 * connect is trusted local harness acquisition, not a URL/driver supplied by HTTP.
 * Every acquired connection is proved again before role/transaction execution.
 */
export async function ownLocalPublicationV2({ workspace, phase, taskId, runId, ownerToken, connect }) {
  must(typeof connect === 'function' && typeof ownerToken === 'string' && ownerToken.length >= 20);
  const root = await realpath(workspace), dir = await realpath(phase);
  must(path.dirname(dir) === path.join(root, 'artifacts') && path.basename(dir).startsWith(taskId + '-') && dir.endsWith('.tmp'));
  const marker = JSON.parse(await readFile(path.join(dir, 'owner.json'), 'utf8'));
  must(marker.taskId === taskId && marker.runId === runId && marker.token === ownerToken && normalized(marker.phase) === normalized(dir));
  const data = await realpath(marker.data); must(path.dirname(data) === dir && path.basename(data) === 'data');
  const prove = async c => {
    const m = JSON.parse(await readFile(path.join(dir, 'owner.json'), 'utf8'));
    must(JSON.stringify(m) === JSON.stringify(marker));
    const pid = (await readFile(path.join(data, 'postmaster.pid'), 'utf8')).trim().split(/\r?\n/);
    must(normalized(pid[1]) === normalized(data) && /^\d+$/.test(pid[0]) && Number(pid[3]) > 1024);
    const row = (await c.query("select current_setting('data_directory') as dir,host(inet_server_addr()) as host,inet_server_port() as port,extract(epoch from pg_postmaster_start_time())::float8 as birth,current_setting('listen_addresses') as listen")).rows[0];
    must(normalized(row.dir) === normalized(data) && row.host === '127.0.0.1' && row.listen === '127.0.0.1' && row.port === Number(pid[3]) && Math.abs(row.birth - Number(pid[2])) < 3);
  };
  const c = await connect('host-capability'); try { await prove(c); } finally { await c.end(); }
  const token = Object.freeze({}); capabilities.set(token, { root, dir, marker, connect, prove }); return token;
}

/** Explicit enabled:true + an owned local capability are BOTH required.
 * No executionMode supplied by a caller can make a hosted client synthetic.
 */
export async function createInactivePublicationV2Host({ enabled = false, capability, canonical, origin,
  now = Date.now, transactionMs = 5000 } = {}) {
  if (enabled !== true) return Object.freeze({ handle: createPublicationV2Service({ origin }) });
  must(capabilities.has(capability) && canonical && typeof now === 'function');
  const owned = capabilities.get(capability);
  const packetDir = new URL('./activation/v2-package-1028/', import.meta.url);
  const manifest = JSON.parse(await readFile(new URL('manifest.json', packetDir), 'utf8'));
  must(manifest.inactive === true && manifest.sourceEncoding === 'utf8-lf-preserve-bom' && manifest.catalogSha256 === publicationV2FiniteCatalogSha256);
  for (const [file, expected] of Object.entries(manifest.files)) {
    const absolute = path.resolve(owned.root, file);
    must(absolute.startsWith(owned.root + path.sep) && sourceSha(await readFile(absolute)) === expected);
  }
  const operationBytes = await readFile(new URL('boundary-operations.json', packetDir));
  must(sourceSha(operationBytes) === manifest.files['drafts/n88-student-portal/activation/v2-package-1028/boundary-operations.json']);
  const packet = JSON.parse(operationBytes), operations = new Map(packet.operations.map(o => [o.sql, o]));
  must(operations.size === 14 && catalog.every(o => operations.get(o.sql)?.sha256 === o.sha256));
  const old = JSON.parse(await readFile(new URL('./activation/error-boundary-contract.json', import.meta.url), 'utf8'));
  const typed = JSON.parse(await readFile(new URL('./activation/read-service-20261023/typed-read-operations.json', import.meta.url), 'utf8'));
  // Existing exact serial canonical/Auth read identities only, no writer/issuer.
  const oldReads = new Map([...old.operations, ...typed].filter(o => o.sql === currentSession ||
    /^select n88_private\.lock_(?:canonical|projection)_sources\(/.test(o.sql) || o.sql.includes('from rakeezx.')).map(o => [o.sql, o]));
  must(oldReads.has(currentSession));
  const repository = createPublicationV2PostgresRepository({ executionMode: 'synthetic', transactionMs,
    acquire: async () => {
      const c = await owned.connect('v2-runtime');
      try { await owned.prove(c);
        const definitions = (await c.query(publicationV2FunctionReadback, [[...operations.values()].map(o => o.name)])).rows;
        must(definitions.length === 14 && JSON.stringify(definitions) === JSON.stringify(manifest.functions));
        await c.query('set role n88_v2_runtime');
        const r = (await c.query("select current_user as name,rolsuper,rolbypassrls,rolcreaterole,rolcreatedb from pg_roles where rolname=current_user")).rows[0];
        must(r.name === 'n88_v2_runtime' && !r.rolsuper && !r.rolbypassrls && !r.rolcreaterole && !r.rolcreatedb);
      } catch { await c.end(); fail(); }
      return { query: (sql, args) => c.query(sql, args), release: () => { c.end().catch(() => {}); } };
    },
  });
  const scopeOwner = 'select set_config(\'n88.v2_owner\',$1,true)';
  // All mutable admission state belongs to one request/transaction closure.
  const assemble = request => {
    let identity = null, located = null, raw, deadline = now() + transactionMs;
    const admission = async () => {
      must(raw && now() < deadline);
      if (identity) {
        if (identity.role === 'teacher') {
          const r = await raw.query(currentSession, [identity.ownerId, identity.sessionId]);
          must(r.rows.length === 1 && r.rows[0].user_id === identity.ownerId && r.rows[0].session_id === identity.sessionId);
        }
        must(identity.expiresAt > now()); return structuredClone(identity);
      }
      const token = /(?:^|;\s*)__Secure-n88-student=([A-Za-z0-9_-]{43})(?:;|$)/.exec(request.headers?.cookie ?? '')?.[1];
      must(token && request.method === 'GET');
      return { ownerId: null, sessionId: null, role: 'locator', expiresAt: deadline, numeric: {
        tokenHash: sha(token), credentialId: null, studentId: null, version: null }, storageWrite: false };
    };
    const verifyIdentity = async (v, r) => {
      must(r === request && raw && v.auth.current === true);
      const c = { ownerId: v.auth.ownerId, sessionId: v.auth.sessionId, role: v.role,
        expiresAt: v.role === 'student' ? v.expiresAt : deadline, numeric: v.numeric ?? null, storageWrite: true };
      if (identity) must(JSON.stringify(identity) === JSON.stringify(c)); else identity = c;
      await raw.query(scopeOwner, [c.ownerId]);
    };
    const wrapped = { transaction: action => repository.transaction(async (legacy, ports) => {
      must(!raw); raw = ports;
      const executePublicationV2 = async (sql, args, signal) => {
        const o = operations.get(sql); must(o && !signal?.aborted && now() < deadline);
        const r = await ports.query(o.callSql, args);
        if (o.id === 'numeric-session' && r.rows.length === 1) located = r.rows[0].payload;
        return o.effect ? { command: o.command, rowCount: Number(r.rows[0]?.affected), rows: [] } : clean(r);
      };
      const query = async (sql, args = []) => {
        must(oldReads.has(sql) && args.length === oldReads.get(sql).parameters.length);
        if (sql === currentSession) must(args.every(v => typeof v === 'string' && /^[a-f0-9-]{36}$/.test(v)));
        else must((typeof args[0] === 'string' && /^[a-f0-9-]{36}$/.test(args[0]) || Array.isArray(args[0]) && args[0].length === 1 && /^[a-f0-9-]{36}$/.test(args[0][0])) &&
          (Array.isArray(args[0]) ? args[0][0] : args[0]) === (identity?.ownerId ?? located?.ownerId) && Number.isSafeInteger(args[1]) && args[1] >= 1 && args[1] <= 2001 &&
          (args.length === 2 || args.length === 3 && Number.isSafeInteger(args[2]) && args[2] >= 1 && args[2] <= 2097152));
        return ports.query(sql, args);
      };
      return action(legacy, Object.freeze({ query, beforeCommit: ports.beforeCommit, canonicalReadMode: () => 'serial', executePublicationV2 }));
    }) };
    const options = { ...canonical, onVerifiedIdentity: verifyIdentity };
    return { repository: wrapped, canonical: options, admission };
  };
  return Object.freeze({
    async handle(request) {
      const a = assemble(request);
      return await createInactivePublicationV2FiniteBridge({ executionMode: 'synthetic', enabled: true, origin,
        catalogSha256: publicationV2FiniteCatalogSha256, repository: a.repository, verifyAdmission: a.admission,
        canonical: a.canonical, now, budgetMs: transactionMs })(request);
    },
  });
}
