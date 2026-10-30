# N88 actor-qualified candidate — INACTIVE

AI-authored for `continuous-n88-actor-qualified-installer-20261030`, run `7563b16d-ddf9-4d85-b310-f13767ade597`, base `2ef68e981839db16450ad7927a0e9e8dd7a540c4`.

This separate source candidate fixes NEW V2 guard ownership setup. It does not install or activate a backend. Its manifest has `execute:false`, null target/installation authority, and separate original/qualified delta hashes. Both SQL binding literals remain null. No live launcher is supplied. The original packet, external installer, nine-query preflight and historical results are immutable inputs pinned by UTF-8/LF source hashes.

`actor-capabilities.mjs` exports a pure evaluator: no imports, connections, SQL execution, environment, credential loading or file IO. Input is minimized recorded metadata, not an executor. It separately requires target identity/baseline/schema/nonexposure facts, effective actor/schema capabilities, all three helper capability records, and the new-role constraints. Omitted, unknown or contradictory prerequisite facts refuse qualification. The result names fixed blocked stages/functions and never echoes arbitrary input. A positive result is `QUALIFIED_INACTIVE_PLAN`, always with `installationAuthorized:false` and `liveReady:false`.

The three helper records distinguish `actorExecute`, `actorGrantOption`, `actorOwnerUsage`, `actorSetOwner` and `runtimeExecute`. Owning the target project or holding role ADMIN is not helper grant authority. Even known actor grant authority returns a separate prerequisite action when runtime access is missing: this candidate deliberately contains no existing-helper GRANT, ownership or membership repair.

Because runtime does not exist on the real project, a positive synthetic case needs the fixture owner to preprovision a minimal NOLOGIN runtime and its three exact helper grants. This is the sole explicit collision exception to the original external gate. Guard/function/table collisions remain rejected. Runtime must have the original negative role attributes, no memberships, no private/canonical/Auth table or column privileges, and no schema CREATE. This prerequisite is unavailable in the real project and is not permission to provision it there.

The candidate checks missing helper prerequisites before V2 DDL. After all target/authority gates, it creates only the new guard, temporarily grants the installer a non-inheriting SET-capable edge, grants each NEW routine's runtime EXECUTE **before** transferring ownership, revokes guard schema CREATE, and removes the temporary edge before COMMIT. The 14 operation definitions and exact final owner/ACL readbacks are unchanged. Table constraints, locking, forced RLS, owner/grade checks and deletion lineage are not relaxed.

PostgreSQL 17 automatically grants the non-superuser creator an ADMIN edge recorded under the bootstrap superuser. The creator cannot revoke that edge. This candidate preserves and verifies that exact automatic edge with INHERIT/SET false; it proves absence of the temporary self-granted edge and absence of effective SET/USAGE. It does **not** claim that every membership row is absent. Requiring absolute removal of even the automatic ADMIN edge would need a separately authorized bootstrap-grantor action; no such workaround is attempted. See [PostgreSQL source](https://github.com/postgres/postgres/blob/REL_17_STABLE/src/backend/commands/user.c) and [ALTER FUNCTION](https://www.postgresql.org/docs/17/sql-alterfunction.html).

Local qualification, using the existing installed native PG17 fixture strategy:

```powershell
node tests/n88-v2-actor-qualified-20261030.test.mjs
```

The harness reserves its integration phase lease, creates a fresh SCRAM loopback-only cluster, bootstraps disposable topology, and installs from a separate NOSUPERUSER CREATEROLE BYPASSRLS login with empty `createrole_self_grant`. Only an in-memory test copy receives disposable target bindings. It validates native refusals, all 14 identities/ACLs, runtime denials, unchanged legacy fingerprints and owned cleanup. It never reads a DSN or live credentials. It does not overwrite old result files.

The publisher must classify this as **inactive candidate delivery**, not an operational backend. Detailed results, preserved failures and remaining architectural work: [N88_ACTOR_QUALIFIED_INSTALLER.md](../../../../docs/automation-evidence/20261030/N88_ACTOR_QUALIFIED_INSTALLER.md).
