# N88 external installation delta — INACTIVE, PREPARATION ONLY

AI-authored 2026-10-28. Task `n88-external-plan-1028`, run `0ea5387f-105a-4e92-b19c-57d72ba1d3a1`, same saved session `01a1822d-de76-76d3-89eb-78fb47247a17`. Base `ac86b0315da113166bfd021d3f037151c4828ce6`; starting worktree clean. Candidate is the AI-labelled commit containing this plan. Original controller and sole publisher retain delivery ownership. No queue/status/ledger changes, worker spawning, push or deployment.

**Delivered:** complete separate external `install.sql`, fixed read-only preflight runner/query plan, manifest and affected tests. **Not executed:** installer (including locally), hosted SQL, provider reads/writes, accounts, Auth/RLS/schema mutations or activation. Current defaults are `target:null`, `preflightAuthority:null`, `installationAuthority:null`, `execute:false`. Local source readiness is not installation or N88 acceptance.

## Exact source and evidence reused

The immutable backend source is `51bca7c959bd6faf96764849a48fb8c79170dd43`, with verified delivery `249f248ed075d0d395456614e1147bb693c5e99c`. The unchanged packet lives at `activation/v2-package-1028`. Its original local-only gate remains untouched; its schema hash is `bf8fbd6c695338f478216f348de2a073cd2e942aed80517715f9945d2204008a`, manifest hash `8138a716764d4767ec34d40a295fcf31cf1d39ae7ca69db00328732d85f42dd0`. The current local host remains exclusively local-capability-bound and default OFF; this task does not make it hosted-capable.

External artifact identities, UTF8/LF with BOM preserved:

| Item | SHA256 |
| --- | --- |
| Complete external `install.sql` | `49f6b904b6abc5511b2370490d70093d52d3a32463119cba285c91e707814271` |
| Exact copied package delta, excluding original transaction/local gate only | `9b0096b2ab45623e4168eee888fda9c2cfdb48fef2e87e2b7822506f782722bf` |
| `preflight.mjs` | `d3db12838b9c237c7d72b6939fcf0d33cf6c852569cd4ef9ae292844fd7edf17` |
| Ordered nine-query read-only descriptor plan | `fda7e7fdb72b79a80b4e33c4c0aef29da41c3a2aa60ccb27e849af744b74181b` |

Manifest pins28 unchanged prerequisite files: the packet/module identities, original teacher verifier/current-session helper, canonical adapter/locks/grade context, integrated numeric/six-v1 DDL and numeric handler, old finite boundary/contracts/identities, original student projection and Sync receipt/lifecycle source. It includes the14 exact proposed function names and native definition/owner/config/ACL identities. Nothing in those files was modified.

Reuse unchanged backend evidence: native10/10 phases, final identity-only2/2 and packet6/6; prior bridge11/11, finite17/17, canonical/native and targeted ACK reports remain intact. The old actual native result at `tests/n88-backend-package-1028/results.json` has raw SHA256 `0c69a2ebaa353cc0b1e9b12181f910d573c95ac29f1bfa2afe4f1c518a1f5f22`. No old native/Preview/UI campaign was repeated. New SQL gates are reviewed by source assertions only; this task does not claim they were parsed/executed on PostgreSQL or validated on a hosted target.

## Original target: known hint, missing current proof

Original `activation/manifest.json` names project **`xlrubcwjqktzzunrvuns`**. This non-secret historical reference is pinned and is the only project this installer proposal can target. It is **not** a fresh target attestation, connection, current DB role or new permission. No DSN, credentials, token or account was located/read/probed.

These exact items remain missing and deliberately null:

1. Fresh provider/custodian cross-attestation of that project to its actual database name/OID, PostgreSQL system identifier, backend server address/port/version, actual installer session/current role and current service backend login/memberships. No guessed `postgres` database/role/port is filled in. An IP or historical project string alone is insufficient.
2. Exact current read-only authority and an original-custodian-owned existing finite read connection/phase. The proposed metadata queries are currently **NOT_ADMITTED** by the unchanged finite boundary. No alternative credential/management route or broader query port is requested by this runner.
3. Fresh original schema/helper/column/key/RLS/ACL/function identities and deterministic baseline inventory digest, plus independent provider nonexposure readback/digest. Actual role privilege or provider settings are not inferred from local PG.
4. A separate matching installation authority with exact target digest, delta digest, authority reference/expiry and original custodian. Current source publication permission is not that installation grant. No old fixture identity, spent proof phase, quota or data allowance is renewed by this task/run ID.

## Narrow read-only preflight

```
node drafts/n88-student-portal/activation/v2-external-plan-1028/preflight.mjs
node --test tests/n88-external-plan-1028.test.mjs
```

Default CLI result: **NOT_RUN**, `queried:false`, missing fresh target/read authority/owned finite connection. It performs only pinned local source reads. There is no driver, DSN, environment lookup, network acquisition or installer invocation.

The future callable protocol requires a separately reviewed bound target and exact read-only approval, verified by the original custodian/controller's trusted authority port. It uses an exclusive approved connection with owned `dispose()`, a5s total budget/1s cleanup, one-use approval object and no retry. The only raw technical statement is the unchanged original `assertVerifiedBoundary` identity read. All inventory statements go exclusively through original `privateQuery`; the first denial stops and records exact `n88_database_unavailable`, query ID/hash and no fallback. Boundary verification does not verify the physical project or authorize DDL. No successful preflight grants installation; complete inventory would still return `REVIEW_REQUIRED`.

Fixed inventory, no caller-selected SQL/table/role/function:

| Query | Scope and maximum rows / result bytes |
| --- | --- |
| target-identity | Database name/OID, system identifier, backend address/port/version and exact session/current role;1 /8192 |
| roles-and-memberships | Eight named existing/proposed roles, negative attributes and membership ADMIN/INHERIT/SET options;8 /32768 |
| relation-identity | Four proposed relations, three original private prerequisites,13 consumed canonical families plus original Sync receipt, two Auth relation **catalog entries**;64 /65536 |
| constraints-columns-policies | Same bounded catalog scope, exact types/keys/validation/deferrability/owner and RLS policies;64 /524288 |
| function-and-trigger-identity |14 proposed fixed functions, six support functions, four original private Auth/canonical helpers and original Sync functions;64 /65536 |
| trigger-and-index-identity | Noninternal canonical/private trigger definitions and exact indexes;256 /262144 |
| effective-table-privileges | Actual named role SELECT/column SELECT/INSERT/UPDATE/column UPDATE/DELETE/TRUNCATE checks;128 /131072 |
| exposure-and-effective-privileges | Private/source/Auth schema owner/ACL/anon/authenticated USAGE plus reported API-schema setting;3 /16384 |
| baseline-inventory-digest | SHA256 of sorted JSONB technical role/relation/constraint/function/trigger/privilege inventory;1 /1024 |

Full literal SQL/hash descriptors are exported in `preflight.mjs`; manifest records every hash/bound. The same deterministic baseline expression is embedded in the installation gate. Overflow sentinels fail, never truncate into PASS. The plan reads no `auth.users`/`auth.sessions` rows, pupil/teacher/scoring rows, credential payloads, tokens or secrets. `pg_control_system()` may itself require additional server privilege; **its server permission has not been tested**. No grant is added to overcome it.

Local in-process tests use the actual unchanged boundary with fabricated existing identities. All nine inventory queries reject before forwarding SQL; the runner stops at the first target-identity rejection and disposes the fabricated port. This is a **local allowlist denial**, not a new hosted/service rejection. Actual hosted inventory remains NOT_RUN. A future original custodian must record any real denial verbatim/safely and stop; it cannot use raw query, alternate role, credential route or an expired approval to continue. Any exact metadata-operation admission/identity extension must be separately authorized in the original finite mechanism, preserving old refusals and pins.

## Complete installer, exact change set and gates

`install.sql` already contains the **entire** immutable packet delta; it does not depend on `psql \i`, a file loader, dynamic SQL from requests or a future installer generator. Only the new external gate/postconditions/transaction wrapper differ. The original local gated file is unchanged.

The single SERIALIZABLE transaction has local15s statement/idle and3s lock budgets, fixed pg_catalog search_path and the original N88 advisory lock. Before DDL it rejects unbound JSON literal target/authority, wrong project, action/product/expiry/target/delta/authority attestation mismatch, physical database or role mismatch, changed baseline, missing original prerequisites, private-schema frontend exposure and **any** full/partial object collision. The compiled literals are null: setting any GUC alone cannot enable this artifact. SQL checks bind the separately reviewed authority declaration and session attestation; they do not cryptographically prove a PO signature. The original custodian must verify external authority independently before executing a future bound artifact.

Binding format for that future reviewed artifact: target fields are `projectRef,databaseName,databaseOid,systemIdentifier,serverAddress,serverPort,serverVersionNum,installerSessionRole,installerCurrentRole,baselineInventorySha256,nonExposureReadbackSha256`. The read-only protocol additionally requires `target.databaseIdentity` with exactly the eight SELECT output keys/types (port is a number; OID/system identifier/version are decimal strings). Backend read-role identity and installation-role identity are distinct, explicitly recorded; no JSON key order is treated as authority. Target/authority attestation digests use PostgreSQL `sha256(convert_to(jsonb::text,'UTF8'))`, not JavaScript JSON/JCS. The query-plan digest uses the exported ordered descriptor array's `JSON.stringify`; source-file hashes use the declared LF codec. A bound artifact changes the installer hash and must be independently reviewed/pinned with its actual authority; filling a GUC or passing a runtime label is insufficient.

Exact proposed changes, no application-row mutation:

- **four relations:** `n88_private.publication_v2_scopes`, `publication_v2_items`, `publication_v2_high_water`, `publication_v2_receipts`, with original PK/FK/checks/scope identity index, eight immutable/tombstone row/truncate guards, forced RLS and four guard-owner policies.
- **two roles:** `n88_v2_guard` and `n88_v2_runtime`, NOLOGIN/NOINHERIT/NOSUPERUSER/NOBYPASSRLS/NOCREATEDB/NOCREATEROLE. No direct Auth scan or canonical write privilege. Runtime gets only fixed private function/original helper EXECUTE and consumed canonical SELECT columns. Guard receives only new storage permissions, validation-function EXECUTE and bounded original private lookup/lock-column privileges. No new user/account or credential issuance.
- **14 fixed functions:** exact names/typed calls/definition hashes/owner/config/ACL from manifest and pinned packet, private guard owner, pg_catalog path, no PUBLIC/anon/authenticated execute and no arbitrary SQL operation. Six original proposal support functions and their exact signatures are enumerated in manifest. The fixed private retirement helper remains unattached.
- **23 policies:**13 canonical SELECT policies for the new runtime; six private lookup SELECT/UPDATE-lock policies (UPDATE `WITH CHECK(false)`), four new storage policies. Original helper definitions and Auth schema/rows/RLS are unchanged; their three exact EXECUTE grants add only the new runtime. Existing numeric/context grants are bounded to the new guard. This is explicitly sensitive access/schema scope requiring future authority, not a text-only or source-publication permission.
- **zero writers/service/UI changes:** this installer does not alter `rakeezx.apply_sync_v2_mutation`, live Delete/Restore/Sync, grade algorithms, existing hosted `private-error-boundary.mjs`, service route/default, N44/N134 or SW. No general SQL port, login transport or service deployment is included.

Before COMMIT it checks all14 actual function definitions/owner/security/search_path/ACLs against the immutable native identities, four forced-RLS relations and two negative role definitions. The original proposal's own PK/FK/checks/trigger definitions are copied exactly. Full external role/column/constraint/policy/effective-grant/nonexposure readback still requires the authorized inventory phase; a CREATE/COMMIT/HTTP200 is not that acceptance. Actual provider API exposure cannot be certified by a nullable `pgrst.db_schemas` setting alone.

Collision/partial state handling: read-only classify **absent**, **already exact** or **mismatch/partial**. Absent may proceed only under new matching authority. Already exact means NO_CHANGE/no installer replay, with fresh identity readback and no service activation inference. Mismatch/partial means stop and preserve evidence; no CREATE IF NOT EXISTS adoption, repair grant, drop/recreate or rerun. The install guard rejects all collisions, including exact already-installed state; the original custodian, not this worker, decides that read-only disposition.

## Concrete future authorization request — draft, NOT GRANTED

Requested custodian/target: the original authorized N88 custodian, original project `xlrubcwjqktzzunrvuns`, **after** fresh physical/role/provider identity fields above are supplied. Two distinct scoped phases must be named:

1. **Read only:** authorize only the nine hashed metadata queries and unchanged boundary-verifier read through the existing finite mechanism on that exact project/connection. No application/Auth row reads, writes, role grant, DDL, account or token operation. Name exact operation admission if currently denied; no alternate credential route. Record authority ref/expiry, lease owner and bounded output disposition.
2. **Install storage only:** authorize one atomic transaction of the exact delta hash in this plan, four relations, two roles,14 fixed/six support functions, eight immutable guards,23 policies and scoped grants above. Bind the final installer hash, fresh baseline/nonexposure receipts, actual installer role and independent authority proof into a newly reviewed bound artifact. Read back the complete object/privilege identities. Explicitly exclude Auth changes, real data/account reads/writes, issuance, cancellation, live writer attachment, service/route enablement and UI. Preserve all previous denials and fixture allocations.

Expected acceptance: matching physical/provider target and source prerequisites, all new object/function/role/ACL/RLS/readback identities, absence of public exposure, runtime denial of raw Auth/private/credential/canonical writes, no privilege escalation via login memberships/RESET ROLE, unchanged OFF behavior and preserved immutable receipt/high-water/tombstone semantics. Target-specific fabricated live fixture and actual teacher/student UI acceptance need their own exact allowance after backend qualification; no retired identities may be reused. The frontend publisher performs none of these backend steps.

**Sync/Delete attachment is not part of that storage-only grant.** A separate exact source/installation approval must name the genuine original command transaction (`rakeezx.apply_sync_v2_mutation` and actual parent/child delete orchestration). Preserve original owner/current-session/envelope/CAS/mutation-ID lock/receipt guards; capture before accepted canonical writes, complete only after valid parent/child dependency writes, original receipt before the SAME COMMIT. Reject parent-only soft deletion with live children. Rollback includes canonical rows, publication history and original receipt; restore never clears tombstones; UNKNOWN resolves only original status. Existing JS attachment/native callback proof is not proof that the full hosted SQL RPC is attached. No source writer is modified by this task or installer.

## Disable / rollback limits

Before COMMIT, any failed gate/DDL/readback aborts the single transaction; the authorized custodian must ROLLBACK and read actual state before any disposition. A lost COMMIT ACK is UNKNOWN, never permission to repeat the installer. Reconcile by read-only exact object/receipt identity. After COMMIT, disable any separately authorized server-owned route/switch first (it remains OFF here), drain owned requests, and revoke only newly approved runtime call privileges if the matching disable authority permits it. No automatic destructive down migration, table/receipt/tombstone/high-water deletion, old credential resurrection, quota reset, canonical rollback or applied-history rewrite. Leave stored outcomes intact. A SQL privilege/identity failure is not permission to loosen roles, ACL, tools or source pins.

## Affected verification and delivery boundary

Focused new JS tests: **10/10 PASS**, validating exact copied delta, hashes, default-deny NULL gates, SQL source transaction/postconditions, original boundary denials, source prerequisites, typed physical/role identity, finite read-only disposal/authority/no-retry behavior and this bounded plan. `node --check` and scoped diff checks PASS. No SQL was executed or native campaign rerun; no browser/server/cluster/phase lease was acquired, so no owned resource needs cleanup. Ticket-router and Postgres least-privilege guidance applied; official PostgreSQL17 identity documentation and Supabase changelog reviewed without library/configuration change.

LOCAL_READY is for this completed inactive artifact and source-only preparation. External preflight/install/real acceptance remain NOT_RUN with the exact missing target/authority/admission items above; N88 remains OPEN.
