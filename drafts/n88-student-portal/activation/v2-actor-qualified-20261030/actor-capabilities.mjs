/** AI: PURE recorded-metadata evaluation. No IO, SQL execution, env or credentials.
 * A qualified plan is NOT installation authority or target/service readiness.
 */
export const requiredHelpers = Object.freeze([
  'n88_private.lock_current_session(uuid,uuid)',
  'n88_private.lock_canonical_sources(uuid,integer)',
  'n88_private.lock_projection_sources(uuid,integer)',
]);
export function evaluateActorCapabilities(evidence = {}) {
  const blocked = [];
  const reject = (stage, requirement, functionIdentity) => blocked.push({ stage, requirement,
    ...(functionIdentity ? { functionIdentity } : {}) });
  const e = evidence && typeof evidence === 'object' ? evidence : {};
  if (e.version !== 1) reject('evidence', 'complete_version_1_metadata');
  // Independent target equality/inventory constraints: never infer ability from identity.
  for (const key of ['physicalIdentityMatched', 'baselineMatched', 'privateNotExposed',
    'originalSchemaMatched', 'noV2Collisions']) {
    if (e.target?.[key] !== true) reject('target', key);
  }
  const a = e.actor;
  if (!a || typeof a.name !== 'string' || !/^[a-z_][a-z0-9_]{0,62}$/.test(a.name) ||
    a.sessionMatches !== true || a.superuser !== false || a.createRole !== true ||
    a.bypassRls !== true || typeof a.inherit !== 'boolean' || a.createroleSelfGrant !== '') {
    reject('new_role_creation', 'recorded_nonsuperuser_createrole_bypassrls_empty_self_grant_profile');
  }
  for (const identity of requiredHelpers) {
    const matches = Array.isArray(e.helpers) ? e.helpers.filter(h => h?.identity === identity) : [];
    const h = matches.length === 1 ? matches[0] : null;
    if (!h || h.exists !== true || typeof h.owner !== 'string' || !/^[a-z_][a-z0-9_]{0,62}$/.test(h.owner) ||
      !['actorExecute', 'actorGrantOption', 'actorOwnerUsage', 'actorSetOwner',
        'runtimeExecute'].every(k => typeof h[k] === 'boolean')) {
      reject('existing_helper', 'complete_effective_capability_metadata', identity);
    } else if (!h.runtimeExecute) {
      reject('existing_helper', h.actorGrantOption ? 'owner_prerequisite_grant_required_outside_candidate' :
        'missing_grant_authority_and_pregranted_runtime_EXECUTE', identity);
    }
  }
  // These are minimized effective owner/grant facts for the original bounded set,
  // not role-name heuristics. Unknown/omitted facts fail closed.
  for (const key of ['databaseCreate', 'privateUsageGrant', 'privateCreateGrant', 'canonicalUsageGrant',
    'allAffectedRelationsOwned', 'allRequiredTableColumnGrants']) {
    if (e.schema?.[key] !== true) reject('schema', key);
  }
  if (e.newRoles?.guardAbsent !== true || e.newRoles?.runtimeMinimalPrerequisite !== true ||
    e.newRoles?.runtimeAbsent !== false) {
    reject('new_role_creation', 'new_guard_absent_and_separately_pregranted_minimal_runtime');
  }
  // The sole collision exception is a separately pregranted minimal runtime;
  // every new guard/function/table collision still refuses installation.
  if (Array.isArray(e.helpers) && e.helpers.some(h => h?.runtimeExecute === true) && e.newRoles?.runtimeAbsent === true) {
    reject('evidence', 'runtime_execute_inconsistent_with_absent_runtime');
  }
  return {
    state: blocked.length ? 'BLOCKED' : 'QUALIFIED_INACTIVE_PLAN',
    installationAuthorized: false, liveReady: false, blocked,
    newObjectOrder: [
      'verify_pregranted_minimal_runtime_then_create_new_guard', 'temporary_guard_membership_INHERIT_false_SET_true',
      'grant_new_guard_schema_CREATE', 'create_new_routine_as_installer',
      'revoke_PUBLIC_and_verify_exact_nonpublic_ACL', 'grant_runtime_EXECUTE_before_owner_transfer',
      'transfer_new_routine_owner', 'revoke_guard_schema_CREATE',
      'remove_temporary_self_granted_SET_membership', 'verify_no_SET_or_INHERIT_and_exact_creator_ADMIN_edge',
    ],
  };
}
