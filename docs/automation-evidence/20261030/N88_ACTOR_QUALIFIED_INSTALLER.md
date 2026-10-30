# N88 actor-qualified inactive installer

AI-authored 2026-10-30. Task `continuous-n88-actor-qualified-installer-20261030`; run `7563b16d-ddf9-4d85-b310-f13767ade597`; base `2ef68e981839db16450ad7927a0e9e8dd7a540c4`. Candidate is the AI-labelled commit containing this report. Scope: six declared files only. No queue, ledger, original installer, migration, service or application-flow edits; no push/deploy.

## Concrete correction and remaining boundary

The original package and external installer assumed that a role creator could transfer new function ownership without explicit SET capability. They also granted runtime EXECUTE after the owner transfer. A bootstrap-superuser test masks both defects. The existing staged migration `20261018034356_n88_exact_activation_staged.sql` already documents explicit temporary SET handling; this candidate applies that principle only to the NEW V2 guard and moves all 14 NEW runtime grants before ownership transfer.

The pure evaluator separates target identity from actor ability and fails closed on incomplete evidence. The SQL also rejects missing old-helper prerequisites before creating V2 objects. It never changes existing helper ACLs, owners or `n88_guard`/`n88_backend` memberships. To honor that boundary, a successful future candidate requires a separately owner-provisioned minimal runtime with the exact existing helper EXECUTE prerequisites. Only that narrowly checked runtime is exempted from the original role-collision gate; all guard/function/table collisions still refuse.

This is not an old-helper recovery executor. A legitimate old-helper grantor is still missing in the actual project. No grantor session, superuser, SECURITY DEFINER workaround, standing SET edge, raw runtime writes or credential route is added. The only new-role temporary edge has INHERIT false/SET true and is removed before COMMIT.

Native PG17 revealed an important distinction: CREATE ROLE automatically records an ADMIN edge under the bootstrap superuser. Its creator cannot revoke it. The candidate snapshots and preserves that exact automatic edge (ADMIN true, INHERIT false, SET false), removes the separately self-granted temporary edge, and checks effective SET/USAGE false. **No claim of zero membership rows is made.** Absolute removal of the automatic ADMIN row is outside this actor's capability and this task's authority. This distinction is explicit in the SQL, evaluator plan and native assertions; it is not hidden by bootstrap cleanup.

Primary references: [PostgreSQL 17 CREATE ROLE implementation](https://github.com/postgres/postgres/blob/REL_17_STABLE/src/backend/commands/user.c), [ALTER FUNCTION owner requirements](https://www.postgresql.org/docs/17/sql-alterfunction.html), [REVOKE grantor rules](https://www.postgresql.org/docs/17/sql-revoke.html). The Supabase changelog markdown fetch returned unsupported content type; no Supabase API/CLI/service implementation or live verification was attempted.

## Actual project facts preserved, not reread

The activated card supplies fresh root read-only facts from 30 October around 20:32 UTC: actor `postgres`, PG170006, NOSUPERUSER, CREATEROLE/BYPASSRLS/INHERIT true and empty `createrole_self_grant`. Existing `n88_guard` is NOLOGIN/NOINHERIT/NOSUPERUSER/NOCREATEROLE/NOBYPASSRLS. Its two edges to postgres are supabase_admin-granted ADMIN true and postgres-granted ADMIN false, both INHERIT/SET false.

For `lock_canonical_sources(uuid,integer)` and `lock_projection_sources(uuid,integer)`, old owner is `n88_guard` and actor USAGE/SET/EXECUTE/EXECUTE WITH GRANT OPTION are all false. `lock_current_session(uuid,uuid)` is postgres-owned with those capabilities true. The V2 roles are absent. These facts already reject installation; identity does not supply grant authority. No new live connection or metadata query was acquired.

The PO's original `SQLSTATE42501`, rollback and UNKNOWN history remains unchanged (including the original ea8ee670/59f22996 lineage recorded on the current N88 note). This task does not convert it into successful installation, rerun the denied installer, replenish an exhausted live pair or close N88. Actual installation, provider readiness and Production acceptance are **NOT_RUN** here.

## Affected native qualification

Command: `node tests/n88-v2-actor-qualified-20261030.test.mjs`.

The harness reuses the native-composition fixture strategy and already installed `@embedded-postgres/windows-x64@17.6.0-beta.15` / `pg@8.16.3`. This is the existing third-party packaged native engine, not a claimed new official EDB distribution. Bootstrap performs only disposable topology/prerequisite preparation. The installer runs on a separate `postgres` connection as NOSUPERUSER CREATEROLE BYPASSRLS, never as bootstrap or a superuser SET ROLE wrapper. Old-role grantor/options match the supplied hosted facts. No app/student/teacher rows are provisioned.

| Check | Actual result |
| --- | --- |
| `n88_actual_actor_capability_rejects_before_ddl` | PASS: evaluator identifies both inaccessible old helpers; native SQLSTATE42501; rollback; zero V2 tables/functions/roles; identical legacy fingerprints. |
| `n88_native_managed_role_new_owner_setup` | PASS: explicit **SYNTHETIC** runtime/helper prerequisite supplied by fixture owner, unavailable in actual project; native non-superuser setup completes; all 14 original function definition hashes/owners/ACLs match exactly; temporary SET edge removed and automatic ADMIN edge preserved with SET/INHERIT false. |
| `n88_legacy_guards_and_runtime_isolation_preserved` | PASS: four forced-RLS tables; no PUBLIC grants in all 14 exact ACLs; 28 negative anon/authenticated EXECUTE checks; actual runtime denied seven private reads, two Auth reads and three canonical DELETEs; legacy fingerprints unchanged across candidate. |

The same affected test checks null authority refusal, rejection of an overprivileged prerequisite runtime with schema CREATE, incomplete evaluator evidence, source/qualified-delta hashes and original source immutability. The positive prerequisite grants occur **outside** the candidate, only on the disposable cluster, and are deliberately excluded from any hosted-readiness claim. Legacy helper ACL/body/owner fingerprints are compared before/after the failed hosted-capability case and again before/after the candidate following synthetic provisioning. Existing legacy memberships/role attributes are unchanged throughout.

The original `tests/n88-backend-package-1028/results.json` is unchanged, SHA256 `0c69a2ebaa353cc0b1e9b12181f910d573c95ac29f1bfa2afe4f1c518a1f5f22`; its broader operation/UNKNOWN/rollback/isolation proofs are reused, not relabelled as managed-role installation proof. Original immutable packet schema SHA256 `bf8fbd6c695338f478216f348de2a073cd2e942aed80517715f9945d2204008a`; original external installer SHA256 `49f6b904b6abc5511b2370490d70093d52d3a32463119cba285c91e707814271`. All original source pins are in the new manifest.

## Failure history and cleanup

Early disposable fixture attempts failed while setting grantor topology, reading restricted data_directory as a nonsuperuser, and omitting database CREATE/ownership required by the unchanged storage proposal. The fixture was corrected without granting the installer superuser or settings-reader privileges. A native attempt then caught the uncorrected post-transfer function GRANT (`42501`, `permission denied for function v2_f8a1689cd78951d7fc52ef91`); all 14 grants were moved before transfer. The next failed assertion (`n88_actor_temporary_membership_remains`) exposed the mandatory bootstrap ADMIN edge; the correction explicitly distinguishes that permanent automatic edge from the removable temporary SET edge. No failed result was rewritten to PASS.

Every attempt stopped its owned server, verified PID/birth absence and free port, removed only its realpath-checked owned database directory, unlinked the synthetic password file and released its integration lease. Earlier reports remain in task-owned ignored artifact directories. Final exact-source evidence is recorded below; no unchanged broad suite, browser or Preview campaign was run.

## Root architectural diagnosis and next genuine work

The legacy teacher/student credential and receipt path is distinct from V2 publication storage, runtime and host/lifecycle attachment. Delivering this SQL as source does not connect the latter to the actual teacher writer or student projection. Runtime/host ownership, private backend assembly and same-transaction canonical writer/Delete/Restore lifecycle attachment still need their dedicated bounded work and real service prerequisites.

`postgres-repository.mjs` takes the global advisory transaction lock `(1312307256,88)` before loading its bounded private snapshots and persists the state under that common lock. This creates a wider contention and failure domain across otherwise independent work. That is a structural scale concern, **not measured outage or benchmark evidence**. Optional indexes and redesign of that legacy transaction boundary are outside this patch.

Transaction ACK uncertainty remains: no receipt/success can be inferred from an uncertain COMMIT; UNKNOWN is not permission to replay a write. Owner/session/lease guards, grade disclosure lineage, Sync locking and canonical parent/child deletion dependencies remain unchanged. A later separate proof must certify its complete materially affected local parent/child scenario before any separately authorized fixture provisioning. No existing retired identity or spent phase is renewed.

The independent publisher may deliver this commit as **inactive candidate source only**. The actual old-helper owner capability is still missing, and no backend operational/Production/N88 acceptance is claimed.

## Final exact-source evidence

```json
{
  "reportPath": "artifacts/continuous-n88-actor-qualified-installer-20261030-9917d641-3d8d-4cf5-a3ed-82233c078651.tmp/report.json",
  "reportSha256": "b2d105e067c863658df7f324b7d169d02b66dcc4b5af02d676c1c2976dc88e3b",
  "startedAt": "2026-10-30T20:53:21.545Z",
  "finishedAt": "2026-10-30T20:53:33.899Z",
  "status": "PASS",
  "serverVersion": "PostgreSQL 17.6 on x86_64-windows, compiled by msvc-19.44.35213, 64-bit",
  "installerSha256": "0bca177df3827b414f8d1a6f48093644437dfdf88564ce140f39e11443841552",
  "evaluatorSha256": "97dd0046cc59fc569b31b8fd1b055cf9f3ef0ad44fa75d23acbeb2e3324af825",
  "qualificationTestSha256": "eb32b6d32193e68eae25f5063cebb7a4084c504b1efff3183c12e233f7e86bf5",
  "qualifiedDeltaSha256": "77346e1292e5eaad393218a52ba17c058da917893b24d7e5fb0d945e55fffd34",
  "actorProfile": {
    "current_user": "postgres",
    "session_user": "postgres",
    "rolsuper": false,
    "rolcreaterole": true,
    "rolbypassrls": true,
    "rolinherit": true,
    "self_grant": ""
  },
  "oldGuardEdges": [
    {
      "grantor": "postgres",
      "admin_option": false,
      "inherit_option": false,
      "set_option": false
    },
    {
      "grantor": "supabase_admin",
      "admin_option": true,
      "inherit_option": false,
      "set_option": false
    }
  ],
  "creatorEdges": [
    {
      "role": "n88_v2_guard",
      "member": "postgres",
      "grantor": "supabase_admin",
      "admin_option": true,
      "inherit_option": false,
      "set_option": false
    }
  ],
  "expectedNegativeDenial": {
    "code": "42501",
    "message": "n88_actor_existing_helper_grant_missing:n88_private.lock_current_session(uuid,uuid):owner prerequisite grant required outside candidate,n88_private.lock_canonical_sources(uuid,integer):no grant authority or pregranted runtime,n88_private.lock_projection_sources(uuid,integer):no grant authority or pregranted runtime"
  },
  "checks": [
    {
      "name": "n88_actual_actor_capability_rejects_before_ddl",
      "status": "PASS",
      "evidence": "Native PG17 separate NOSUPERUSER login; SQLSTATE42501 before V2 DDL; rollback, zero V2 objects/roles; identical legacy role/membership/helper ACL+body fingerprint; evaluator names both denied old helpers."
    },
    {
      "name": "n88_native_managed_role_new_owner_setup",
      "status": "PASS",
      "evidence": "Installer executed as separate NOSUPERUSER CREATEROLE BYPASSRLS postgres login, empty createrole_self_grant. Synthetic pregranted minimal runtime prerequisite only; 14 exact original function definition/owner/ACL readbacks match; temporary SET edge removed. Mandatory PG17 bootstrap ADMIN edge remains with SET/INHERIT false, exactly as captured before temporary grant."
    },
    {
      "name": "n88_legacy_guards_and_runtime_isolation_preserved",
      "status": "PASS",
      "evidence": "Legacy fingerprints identical across candidate; 4 forced-RLS storage tables; PUBLIC absent in all 14 exact ACLs, anon/authenticated 28 negative EXECUTE checks; actual runtime client denied 7 private reads, 2 Auth reads, 3 canonical DELETEs. Fixture login removed; zero V2 SET/INHERIT edges."
    }
  ],
  "cleanup": {
    "stopped": true,
    "pid": 22260,
    "birth": "2026-10-30T20:53:29.8137020Z",
    "pidAbsent": true,
    "portFree": true,
    "ownedDataRemoved": true
  },
  "leaseAcquire": "ACQUIRED integration",
  "leaseRelease": "RELEASED integration"
}
```

Preserved failed native report identities (all owned cleanup passed):

- `continuous-n88-actor-qualified-installer-20261030-0400683d-c266-4db3-b5ef-f85899b1cdd8.tmp/report.json`: `941fc683366e22f40fa701bfe520f1c7b881d5ae65608cb0fe5bc142ed079444` (P0001).
- `continuous-n88-actor-qualified-installer-20261030-3dd41a2c-e5e2-4e5c-bfe3-7c3cf3be2b7e.tmp/report.json`: `b8d7c07eef0ca2937e970488d032e70a5dfde1018385439e67577a6de2052c8d` (42501).
- `continuous-n88-actor-qualified-installer-20261030-68c6e866-668a-4311-acf1-c6d543bcfba7.tmp/report.json`: `fa38bc119490040dc059d05404bdfc351918e87ddc046801e77a44e9a9b95160` (42501).
- `continuous-n88-actor-qualified-installer-20261030-69b2a676-71fc-4199-b2a4-c8775fa8206b.tmp/report.json`: `b65d7e555e761e44502734137511a263b2a03f6cc967c26e5d37d822802e40bb` (42501).
- `continuous-n88-actor-qualified-installer-20261030-81b40de2-25c1-446f-82a7-3ca85aabb646.tmp/report.json`: `911564ae87631715bd4679598d2eb95c9f5086c285c86443b92348e05929707b` (42501).
- `continuous-n88-actor-qualified-installer-20261030-b3fdc4ed-05bb-4628-9594-950812755c0b.tmp/report.json`: `9370ade524772af6475747351d77726e814bd4fe453eaa00f877419a27e9ba4d` (42501).
