/** AI: INACTIVE read-only preflight preparation. No DSN, driver, credentials,
 * environment, installer execution or alternate transport. No application rows.
 * The original finite boundary is the ONLY SQL path; first denial stops the run.
 */
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import manifest from './manifest.json' with { type: 'json' };
import { assertVerifiedBoundary, privateQuery, verifiedBoundaryMode } from '../private-error-boundary.mjs';

const sha = s => createHash('sha256').update(s).digest('hex');
const normalized = b => b.toString('utf8').replaceAll('\r\n', '\n');
const freeze = v => { if (v && typeof v === 'object') { Object.values(v).forEach(freeze); Object.freeze(v); } return v; };
const roles = "('postgres','supabase_auth_admin','n88_backend','n88_guard','n88_v2_runtime','n88_v2_guard','anon','authenticated')";
const relations = "('publication_v2_scopes','publication_v2_items','publication_v2_high_water','publication_v2_receipts','contexts','numeric_credentials','numeric_sessions')";
const canonical = "('years','terms','sections','students','enrollments','teachings','items','scores','score_subitems','score_subitem_completions','sessions','attendance','logs','sync_mutation_receipts')";
export const identitySql = `select current_database() as database_name,(select oid::text from pg_database where datname=current_database()) as database_oid,current_user::text as current_role,session_user::text as session_role,host(inet_server_addr()) as server_address,inet_server_port() as server_port,current_setting('server_version_num') as server_version_num,(pg_control_system()).system_identifier::text as system_identifier`;
const definitions = [
  ['target-identity', identitySql, 1, 8192],
  ['roles-and-memberships', `select r.rolname,r.rolsuper,r.rolbypassrls,r.rolinherit,r.rolcanlogin,r.rolcreatedb,r.rolcreaterole,(select jsonb_agg(jsonb_build_object('role',p.rolname,'admin',m.admin_option,'inherit',m.inherit_option,'set',m.set_option) order by p.rolname) from pg_auth_members m join pg_roles p on p.oid=m.roleid where m.member=r.oid) as memberships from pg_roles r where r.rolname in ${roles} order by r.rolname limit 9`, 8, 32768],
  ['relation-identity', `select n.nspname,c.relname,c.relkind,pg_get_userbyid(c.relowner) as owner,c.relrowsecurity,c.relforcerowsecurity,c.relacl::text as acl from pg_class c join pg_namespace n on n.oid=c.relnamespace where (n.nspname='n88_private' and c.relname in ${relations}) or (n.nspname='rakeezx' and c.relname in ${canonical}) or (n.nspname='auth' and c.relname in ('users','sessions')) order by n.nspname,c.relname limit 65`, 64, 65536],
  ['constraints-columns-policies', `select n.nspname,c.relname,(select jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'required',a.attnotnull) order by a.attnum) from pg_attribute a where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped) as columns,(select jsonb_agg(jsonb_build_object('name',k.conname,'definition',pg_get_constraintdef(k.oid),'validated',k.convalidated,'deferrable',k.condeferrable) order by k.conname) from pg_constraint k where k.conrelid=c.oid) as constraints,(select jsonb_agg(jsonb_build_object('name',p.polname,'roles',p.polroles::text,'command',p.polcmd,'using',pg_get_expr(p.polqual,p.polrelid),'check',pg_get_expr(p.polwithcheck,p.polrelid)) order by p.polname) from pg_policy p where p.polrelid=c.oid) as policies from pg_class c join pg_namespace n on n.oid=c.relnamespace where (n.nspname='n88_private' and c.relname in ${relations}) or (n.nspname='rakeezx' and c.relname in ${canonical}) or (n.nspname='auth' and c.relname in ('users','sessions')) order by n.nspname,c.relname limit 65`, 64, 524288],
  ['function-and-trigger-identity', `select n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) as arguments,encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex') as definition,p.prosecdef as definer,pg_get_userbyid(p.proowner) as owner,p.proconfig,p.proacl::text as acl from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='n88_private' and (p.proname in ('lock_current_session','lock_owner_key','lock_canonical_sources','lock_projection_sources','publication_v2_exact','publication_v2_scope','publication_v2_flags','publication_v2_manual','publication_v2_transition','publication_v2_retire_source') or p.proname in (${manifest.fixedFunctionNames.map(n => `'${n}'`).join(',')})) or n.nspname='rakeezx' and p.proname in ('apply_sync_v2_mutation','sync_v2_stamp_revision') order by n.nspname,p.proname,arguments limit 65`, 64, 65536],
  ['trigger-and-index-identity', `select n.nspname,c.relname,t.tgname as name,'trigger'::text as kind,pg_get_triggerdef(t.oid) as definition,t.tgenabled::text as enabled from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where not t.tgisinternal and ((n.nspname='n88_private' and c.relname in ${relations}) or (n.nspname='rakeezx' and c.relname in ${canonical})) union all select n.nspname,c.relname,i.relname as name,'index'::text as kind,pg_get_indexdef(i.oid) as definition,null::text as enabled from pg_index x join pg_class c on c.oid=x.indrelid join pg_class i on i.oid=x.indexrelid join pg_namespace n on n.oid=c.relnamespace where (n.nspname='n88_private' and c.relname in ${relations}) or (n.nspname='rakeezx' and c.relname in ${canonical}) order by nspname,relname,name limit 257`, 256, 262144],
  ['effective-table-privileges', `select n.nspname,c.relname,r.rolname,has_table_privilege(r.oid,c.oid,'SELECT') as table_select,has_any_column_privilege(r.oid,c.oid,'SELECT') as column_select,has_table_privilege(r.oid,c.oid,'INSERT') as insert,has_table_privilege(r.oid,c.oid,'UPDATE') as update,has_any_column_privilege(r.oid,c.oid,'UPDATE') as column_update,has_table_privilege(r.oid,c.oid,'DELETE') as delete,has_table_privilege(r.oid,c.oid,'TRUNCATE') as truncate from pg_class c join pg_namespace n on n.oid=c.relnamespace cross join pg_roles r where r.rolname in ('n88_v2_guard','n88_v2_runtime','anon','authenticated') and ((n.nspname='n88_private' and c.relname in ${relations}) or (n.nspname='rakeezx' and c.relname in ${canonical}) or (n.nspname='auth' and c.relname in ('users','sessions'))) order by n.nspname,c.relname,r.rolname limit 129`, 128, 131072],
  ['exposure-and-effective-privileges', `select n.nspname,pg_get_userbyid(n.nspowner) as owner,n.nspacl::text as acl,has_schema_privilege('anon',n.oid,'USAGE') as anon_usage,has_schema_privilege('authenticated',n.oid,'USAGE') as authenticated_usage,current_setting('pgrst.db_schemas',true) as configured_api_schemas from pg_namespace n where n.nspname in ('n88_private','rakeezx','auth') order by n.nspname limit 4`, 3, 16384],
];
// Same deterministic catalog digest is checked INSIDE the install transaction.
// Excludes connection-role-dependent identity/exposure settings; those have
// separate target and provider-attestation gates. Never hashes application rows.
export const baselineInventorySql = `select encode(sha256(convert_to(jsonb_build_object(${definitions.slice(1, -1).map(([id, sql]) => `'${id}',(select coalesce(jsonb_agg(to_jsonb(q) order by to_jsonb(q)::text),'[]'::jsonb) from (${sql}) q)`).join(',')})::text,'UTF8')),'hex') as sha256`;
definitions.push(['baseline-inventory-digest', baselineInventorySql, 1, 1024]);
export const readOnlyQueryPlan = freeze(definitions.map(([id, sql, maxRows, maxBytes]) => ({ id, sql, sha256: sha(sql), maxRows, maxBytes })));
export const readOnlyQueryPlanSha256 = sha(JSON.stringify(readOnlyQueryPlan));
const used = new WeakSet();
const identityKeys = ['database_name','database_oid','current_role','session_role','server_address','server_port','server_version_num','system_identifier'];
export function sameTargetIdentity(observed, expected) {
  const shape = v => v && Object.getPrototypeOf(v) === Object.prototype && Object.keys(v).length === identityKeys.length &&
    identityKeys.every(k => Object.hasOwn(v,k)) && ['database_name','current_role','session_role','server_address'].every(k => typeof v[k] === 'string' && v[k].length > 0 && v[k].length <= 128) &&
    typeof v.database_oid === 'string' && /^[1-9][0-9]{0,9}$/.test(v.database_oid) && typeof v.system_identifier === 'string' && /^[1-9][0-9]{0,19}$/.test(v.system_identifier) &&
    typeof v.server_version_num === 'string' && /^[1-9][0-9]{4,5}$/.test(v.server_version_num) && Number.isSafeInteger(v.server_port) && v.server_port >= 1 && v.server_port <= 65535;
  return !!(shape(observed) && shape(expected) && identityKeys.every(k => observed[k] === expected[k]));
}

export async function verifyPinnedSources() {
  const root = fileURLToPath(new URL('../../../../', import.meta.url));
  for (const [file, expected] of Object.entries(manifest.prerequisites)) {
    const absolute = path.resolve(root, file);
    if (!absolute.startsWith(root) || sha(normalized(await readFile(absolute))) !== expected) throw Error('n88_external_source_mismatch');
  }
  if (sha(normalized(await readFile(new URL('./install.sql', import.meta.url)))) !== manifest.installerSha256) throw Error('n88_external_installer_mismatch');
  if (readOnlyQueryPlanSha256 !== manifest.readOnlyQueryPlanSha256) throw Error('n88_external_plan_mismatch');
  return true;
}

/** Future custodian port ONLY: acquireApprovedReadOnly supplies an exclusive
 * already-authorized original-boundary client and ownership-matched dispose().
 * verifyReadAuthority verifies the external PO/controller authority, not labels
 * from HTTP. Default manifest has NO target or authority. No client is acquired.
 * A separately reviewed bound artifact is necessary before any future use.
 */
export async function runReadOnlyPreflight({ binding = manifest, approval = null, verifyReadAuthority,
  acquireApprovedReadOnly, now = Date.now } = {}) {
  await verifyPinnedSources();
  const missing = [];
  if (!binding.target) missing.push('fresh_original_target_physical_identity_and_backend_login');
  if (!binding.preflightAuthority || !approval || typeof verifyReadAuthority !== 'function') missing.push('exact_current_read_only_authority');
  if (typeof acquireApprovedReadOnly !== 'function') missing.push('original_custodian_owned_finite_read_connection');
  if (missing.length) return { state: 'NOT_RUN', queried: false, missing, inventory: [], installationAuthorized: false };
  const result = { state: 'DENIED', queried: false, inventory: [], installationAuthorized: false, disposed: false };
  let owned, live = true, disposed = false, timer;
  const controller = new AbortController(), deadline = now() + 5000;
  const dispose = async value => { if (!disposed && value) { disposed = true; await value.dispose(); result.disposed = true; } };
  const work = async () => {
    if (!approval || typeof approval !== 'object' || used.has(approval) || binding.productId !== 'N88' ||
        binding.installerSha256 !== manifest.installerSha256 || binding.readOnlyQueryPlanSha256 !== readOnlyQueryPlanSha256 ||
        binding.target.projectRef !== manifest.historicalTargetHint.projectRef ||
        approval.ref !== binding.preflightAuthority.ref || approval.action !== 'read-only-v2-preflight' ||
        approval.projectRef !== binding.target.projectRef || !Number.isSafeInteger(approval.expiresAt) || approval.expiresAt <= now() ||
        await verifyReadAuthority({ approval, target: binding.target, queryPlanSha256: readOnlyQueryPlanSha256, signal: controller.signal }) !== true) throw Error('n88_external_read_authority_unavailable');
    used.add(approval); if (!live || now() >= deadline) throw Error('n88_external_preflight_deadline');
    const lease = Promise.resolve().then(() => acquireApprovedReadOnly(controller.signal));
    lease.then(c => { if (!live) dispose(c).catch(() => {}); }, () => {});
    owned = await lease;
    if (!live || typeof owned?.client?.query !== 'function' || typeof owned.dispose !== 'function') throw Error('n88_external_owned_read_port_unavailable');
    // The sole raw technical read is the UNCHANGED original boundary verifier.
    result.queried = true; await assertVerifiedBoundary(owned.client);
    result.boundaryMode = verifiedBoundaryMode(owned.client);
    for (const query of readOnlyQueryPlan) {
      if (!live || now() >= deadline) throw Error('n88_external_preflight_deadline');
      let r;
      try { r = await privateQuery(owned.client, query.sql, []); }
      catch (e) {
        result.denial = { queryId: query.id, sqlSha256: query.sha256,
          error: e.message === 'n88_database_unavailable' ? e.message : 'n88_external_inventory_unavailable' };
        return result; // no raw-query fallback, retry, alternate role or credentials
      }
      if (!Array.isArray(r.rows) || r.rows.length > query.maxRows || Buffer.byteLength(JSON.stringify(r.rows)) > query.maxBytes) throw Error('n88_external_inventory_bounds');
      if (query.id === 'target-identity') {
        const expected = binding.target.databaseIdentity;
        if (r.rows.length !== 1 || !sameTargetIdentity(r.rows[0],expected)) throw Error('n88_external_target_mismatch');
      }
      result.inventory.push({ queryId: query.id, rows: r.rows, sha256: sha(JSON.stringify(r.rows)) });
    }
    result.state = 'REVIEW_REQUIRED'; return result; // no automatic install/activation
  };
  try {
    return await Promise.race([work(), new Promise((_, reject) => { timer = setTimeout(() => reject(Error('n88_external_preflight_deadline')), 5000); })]);
  } catch (e) { result.error = /^n88_external_[a-z_]+$/.test(e.message) ? e.message : 'n88_external_preflight_unavailable'; return result; }
  finally {
    live = false; controller.abort(); clearTimeout(timer);
    if (owned) {
      let cleanup;
      try { await Promise.race([dispose(owned), new Promise((_, reject) => { cleanup = setTimeout(reject, 1000); })]); }
      catch { result.disposed = false; result.cleanup = 'owned_custodian_cleanup_required'; }
      finally { clearTimeout(cleanup); }
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href)
  console.log(JSON.stringify(await runReadOnlyPreflight()));
