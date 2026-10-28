# N88 V2 inactive backend packet

AI-authored. **Not installed or enabled on a hosted service.** This packet is for independent review and a later exact authorization. Current card permits only fabricated local PostgreSQL and inactive source publication. The generic frontend publisher cannot install this backend.

## Immutable package

`manifest.json` contains source/module hashes, the catalogue hash and all14 native `pg_get_functiondef` hashes with exact owner/search_path/ACL readback. Source-file hashes use `sourceEncoding:utf8-lf-preserve-bom` (CRLF→LF only) so a Git text checkout does not invalidate the package; SQL statement hashes and native function hashes retain their separately defined exact codecs. `boundary-operations.json` contains the14 exact original statements, argument/output contracts, SQL hashes, fixed proposed function names and typed call strings. `schema.sql` contains the original four-table storage proposal unchanged inside one transaction, plus two bounded roles, private RLS/ACL and14 exact functions. It introduces no general SQL operation.

The installed-function role is proposed `n88_v2_guard`, NOLOGIN/NOSUPERUSER/NOBYPASSRLS/NOINHERIT. It owns only the new fixed functions, never the canonical/Auth tables. The proposed `n88_v2_runtime` has the same negative role attributes and is not a member of the guard/backend roles. It gets only new finite function EXECUTE, original exact Auth/canonical helper EXECUTE and consumed canonical SELECT columns. It gets no Auth schema/table privileges, raw numeric/private table reads, canonical writes, receipt DELETE or schema CREATE.

The new fixed functions are SECURITY DEFINER with `search_path=pg_catalog`, private guard owner, no PUBLIC/anon/authenticated EXECUTE and no dynamic SQL. This is a **new proposed bounded role design**, not a change to the current hosted finite boundary. It prevents runtime-role raw numeric access and avoids giving that role the UPDATE privilege required by PostgreSQL `FOR SHARE`. Guard has only the required lookup SELECT/lock-column privileges; lookup UPDATE policies use `WITH CHECK(false)` to reject actual writes. Four new storage tables force RLS for the guard, with verified owner GUC, receipt INSERT/SELECT only and original immutable triggers. The GUC is set only by the trusted original-Auth observer inside the local host transaction, not from HTTP data. These permissions rely on the private backend/finite transport, never on allowing arbitrary role SQL from a browser.

## Local execution and ownership

```
node tests/n88-backend-package-1028/native-composition.test.mjs
node --test tests/n88-backend-package-1028/package.test.mjs
```

The native command creates a fresh ignored task-owned cluster using the existing portable PG17.6 toolchain, acquires/releases the integration phase lease, uses loopback-only/SCRAM and verifies PID/birth/directory before stop. No default DSN, service, installer, PATH/ACL/firewall change or external account. The host itself requires an opaque WeakMap capability minted after owned marker/path/postmaster/server readback and repeats connection/role/function identity checks. Default OFF needs no capability and denies without acquisition. `executionMode` from a caller cannot enable it or label a hosted client synthetic.

The fabricated cluster is created/observed by its local admin; application connections prove ownership before `SET ROLE n88_v2_runtime`. SQL privilege denials are real under that current role. This is not proof of a hosted login's authentication/membership restrictions; the future installer must verify a real non-admin backend login cannot RESET/SET an unrelated privileged role. The local host exposes no role/control SQL to request callers.

The schema begins with a local-only directory/loopback/task-specific gate and an install collision check. **Do not remove/change the gate or fake its directory/mode/GUC to execute it on a hosted target.** A future matching authority must approve an exact external installer artifact, target identity and readbacks. This source packet is not that authority or an automatic migration. Re-running native qualification deliberately creates a new synthetic cluster; do not point it at an existing database. The runner records fresh definition readbacks in manifest and results; review any resulting tracked changes.

## Install-once and readback plan — NOT_RUN externally

1. Original custodian obtains a matching card for the exact target/backend schema/functions/role changes and any strictly bounded fabricated accounts. Record immutable source/manifest/function hashes, current original backend identity, existing schema inventory and rollback/disable owner. No inherited fixture quota or real account/data permission is implied. Preserve existing denied statements and source pins.
2. Read-only preflight: confirm original four V2 relations/14 function names/two proposed roles are absent or match a recorded already-installed identity. Stop on partial state, collision or mismatch; never blindly reapply. Confirm existing original Auth/session helper identities, 13 canonical families/owner FKs, relevant migrations/columns, numeric `six-v1` schema and all original role/RLS assumptions. The packet does not rewrite applied migrations or install original prerequisites.
3. Review and approve the *separate* external installer under that card, applying only this exact bounded delta atomically once. Preserve original Auth/Sync scoring functions and applied history. The local schema guard is deliberately not a hosted execution path.
4. Read back four table definitions/PK/FK/checks/immutable UPDATE/DELETE/TRUNCATE guards/high-water constraints and indexes, ownership, force-RLS flags/policies and effective grants. Verify the backend login's memberships, including inherited/SET role rights, and that neither private schema nor the new functions are exposed through REST/GraphQL/PostgREST/search_path. Provider configuration/nonexposure requires actual provider readback; local SQL cannot prove it. Check anon/authenticated have no private USAGE/function/table rights. No role may acquire superuser/BYPASSRLS/CREATEROLE/CREATE or unrelated writer/issuer grants.
5. Use the exact fixed `publicationV2FunctionReadback` exported by `publication-v2-host.inactive.mjs`, bound to the14 names in operations JSON. Match the complete manifest rows (definition, owner, definer, config, ACL). Also inspect existing original Auth/canonical helper identity/owner/ACL without widening it. A successful CREATE/HTTP200 is not this readback.
6. Qualify the actual target-specific finite transport with the exact catalogue and original guards. The current `activation/private-error-boundary.mjs` stays byte-identical/closed in this candidate. No new statement was submitted there. Any later addition requires its own reviewed finite-operation/pin update; never replace it with general query execution. Confirm typed parameters/results, owner/session lineage, byte/row/timeout caps, direct-role denial, independent connection contention, CAS, UNKNOWN original-status-only and all default-OFF/owner/privacy guards through the actual installed backend role.
7. Attach retirement to the **original writer's transaction**, as below. Then verify service/module identity, actual authorized teacher/current own numeric-pupil entry, refresh/storage and per-item hidden grade/parent aggregate privacy before explicit server-owned enablement. This host is local-only; adding an actual external host assembly/route is a separately authorized implementation, not a mode/marker trick. No live route or public UI is supplied here.

Useful exact readbacks for the authorized custodian, scoped to this packet:

```sql
select rolname,rolsuper,rolbypassrls,rolcanlogin,rolinherit,rolcreatedb,rolcreaterole
from pg_roles where rolname in ('n88_v2_guard','n88_v2_runtime');
select c.relname,c.relrowsecurity,c.relforcerowsecurity,pg_get_userbyid(c.relowner)
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='n88_private' and c.relname in
('publication_v2_scopes','publication_v2_items','publication_v2_high_water','publication_v2_receipts');
select c.relname,k.conname,pg_get_constraintdef(k.oid)
from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace
where n.nspname='n88_private' and c.relname in
('publication_v2_scopes','publication_v2_items','publication_v2_high_water','publication_v2_receipts')
order by c.relname,k.conname;
```

These are **readback proposals**, not a grant to run them on a hosted target during this task.

## Genuine lifecycle attachment proposal

`lifecycle-attach.inactive.mjs` is a callable same-transaction hook, not a new Delete API or writer. It accepts the original trusted writer's transaction-bound command/receipt capabilities. It authenticates with the existing canonical ports, binds the verified owner, validates the original command/session, looks up the original immutable receipt, captures owned parent/children/revisions, invokes the original mutation, completes retirement, then writes the original receipt before the parent COMMIT. Any incomplete child deletion, guard failure or later error aborts canonical rows, V2 tombstones and original receipt together. Original receipts return without capture/mutation/reissue. Publication receipts remain their original outcomes.

The precise integration site is the genuine existing Sync/Delete owner/command transaction, **not the read-only V2 runtime role**. In the repository `0012_sync_v2_server_protocol.sql`, `apply_sync_v2_mutation` validates the envelope, locks `owner:sync-v2:mutationId`, then reads `sync_mutation_receipts`. The original `request_envelope IS DISTINCT FROM` check must stay before any return; preserve its full entity/recordId/mutationId/deviceId/baseRevision/operation/patch/clientUpdatedAt shape. `validateOriginalCommand`/`findOriginalReceipt` must retain those exact rules and current owner/session, original CAS/revision and accepted-outcome checks. For a valid selected parent/child deletion only: capture immediately before its actual canonical mutation after original admission/CAS locks; complete after all valid dependency writes, then the original receipt insertion. Do not tombstone a rejected/conflicting mutation, revive old IDs on restore, convert UNKNOWN into cancellation, or put completion in a later job/transaction.

Local qualification used the **actual original receipt table definition**, fabricated original-writer DML on the same native transaction and the exported hook. It did not execute/modify the full hosted Sync RPC, all its installed triggers, or a real Delete command. The live writer attachment and target-specific privilege/lock-order integration therefore remain an explicit engineering/authorization gate. This packet does not falsely give the V2 runtime permission to become the canonical writer.

## Disable and failure plan

Keep all service/route switches OFF until exact installation, readback and acceptance complete. If an authorized rollout later fails, disable its server-owned route/switch first, drain owned requests and preserve original receipts, tombstones, high-water and unresolved UNKNOWN. Reconcile by read-only original status, never replay a lost ACK. The authorized custodian may revoke only newly approved runtime call privileges under its disable plan; no table drops, deletion/purge, counter reset, identity reuse, canonical rollback or applied-history rewrite. A failed atomic install rolls back as a unit; a collision/mismatch requires readback, not another CREATE.
