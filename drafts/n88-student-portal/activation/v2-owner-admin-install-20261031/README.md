# N88 owner-admin storage prerequisite — AI-authored

New finite candidate for `continuous-n88-owner-admin-storage-install-20261031`, run `f63d1781-5921-4fe4-9d60-5eeb7c27e823`, base `df23c78126281b8625e2009df7cf3195abd7a482`. Authority and historical source identities are pinned in `manifest.json`. Historical packets, sessions, receipts and admissions are unchanged. No shared error-boundary route was modified.

The installer uses one explicit transaction, admits serializable isolation before operational reads/writes, checks the original physical target and catalog digest, captures original legacy metadata before writes, and retains the same transaction identity. Actual nonsuperuser `postgres` creates both negative-attribute NOLOGIN roles. It grants its own session helper, temporarily changes only its self-granted old guard SET edge, enters that owner for its two exact helper grants, returns to the original actor, and restores both old edges before V2 DDL. New guard setup grants EXECUTE before ownership transfers and removes its temporary SET edge. Only the two mandatory PG17 creator ADMIN edges remain, with SET/INHERIT false.

The final SQL assertions verify four FORCE-RLS relations, fourteen exact fixed functions, six support functions, the three helper ACL additions without grant option, unchanged old bodies/owners/configuration/other ACLs, exact legacy roles/memberships and runtime raw-access denial. This storage prerequisite deliberately omits the historical canonical column grants/policies. It provides no runtime login or hosted transport. `serviceEnabled:false`; genuine Sync/Delete writer attachment remains separate.

`admission.mjs` reconstructs bound SQL from the verified template and exact target/authority substitutions. It checks the finite operation plan and current task/run, freezes the record, consumes positions before dispatch, bounds outputs/deadline and denies SQL/hash tampering, foreign runs, second installation and lost-result replay. The explicit relay creates owned phase files and uses the existing integration/live-mutation leases. The original local-review phase is preserved; the corrected phase has a distinct `qualified-v1` identity and reuses the actual unchanged supported preflight observation. Reconciliation emits only the fixed post-catalog read, with a fresh lease; it never installs again.

Affected native checks:

```powershell
node tests/n88-v2-owner-admin-install-20261031.test.mjs
node tests/n88-v2-owner-admin-install-20261031.test.mjs --standalone
```

Both use a fresh owned SCRAM loopback PostgreSQL17 cluster and the actual nonsuperuser installer profile. Bootstrap creates baseline/legacy topology only, including the original old-guard schema USAGE; no V2 role or helper prerequisite is precreated. They qualify six failure injections across standalone/outer transactions, an already-used outer transaction refusal, exact COMMIT in both supported transaction modes, all fourteen callable operations as the restricted runtime, owner denial and rollback, raw privilege denials, original metadata and owned cleanup. Old helpers are verified by exact ACL/body/owner/config readback here; their unchanged business proofs are reused from the pinned original campaign.

Official adapter limit: [MCP source](https://github.com/supabase-community/supabase-mcp/blob/main/packages/mcp-server-supabase/src/platform/api-platform.ts) forwards `name` and supplied `query` to the [Management API migration endpoint](https://supabase.com/docs/reference/api/v1-apply-a-migration). Public documentation does not specify transaction/history internals. The explicit transaction is qualified natively; a busy adapter outer transaction fails before operational writes. Migration-history acknowledgement may be separate or unknown. Only exact installed catalog readback can establish storage success; no exactly-once provider guarantee is claimed.

The independent provider UI observation remains historical at `2026-10-28T22:26:13.288Z`. Current supported catalog evidence retains private-schema denial to anon/authenticated and bounded applicable API schema settings; null `pgrst.db_schemas` is not called fresh provider configuration proof. No browser, temporary deployment, new credential, student mutation, notification, frontend or Service Worker change occurs in this candidate.

Actual result and sanitized receipt: `docs/automation-evidence/20261031/N88_OWNER_ADMIN_STORAGE_INSTALL.md`.
