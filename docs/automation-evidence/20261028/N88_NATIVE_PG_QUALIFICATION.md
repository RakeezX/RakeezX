# N88 — independent native PostgreSQL qualification (inactive source)

AI-authored, 2026-10-28. Task `n88-native-pg-1028`, run `dce9133d-b519-44d9-87eb-45418d849a40`, same saved session `01a1822d-de76-76d3-89eb-78fb47247a17`.
Base `d7648707104e5805f919e9f27e2dffda3c89dc83`. Candidate is the AI-labelled commit containing this document and the two executable harness files.

**Result: PASS for the newly requested independent-connection LOCAL native PostgreSQL gate.** No Product service/DDL/adapter change was needed. Published durable implementation `34e91039`/`40b76a03` is preserved byte-for-byte. Neither the unchanged 16-case PGlite campaign nor the unchanged 16-case V2 campaign was rerun. Their earlier evidence remains valid and distinct. N88 remains OPEN; this result is not hosted service activation, Production proof or PO acceptance.

## Reconciled state and runtime

Read canonical operating contract, activated card and latest N88 `PO-20261028-CONTINUE-TO-OUTCOME-1925` note. The new worktree was clean at the supplied base with no partial native-PG candidate. PATH discovery again had no native binaries, but inspection of the **existing native test helper** found the installed runtime and client:

`C:/Users/Abody/Projects/RakeezX/artifacts/n77-native-pg17/package/native/bin`

`C:/Users/Abody/Projects/RakeezX/artifacts/n77-native-pg17/client/node_modules/pg`

The prior “unavailable” finding was limited to PATH/Program Files/Docker; native tools were already installed in ignored artifacts. Reused tools only, never old databases, identities, credentials or retired hosted fixtures. No download, package installation, Docker start, admin/service/autostart registration, global PATH/configuration, firewall or ACL change occurred. The conditional permission to prepare an official portable distribution was unnecessary because an existing native runtime was present. This is **not falsely attributed to an official EDB download**: its recorded provenance is the existing third-party package `@embedded-postgres/windows-x64@17.6.0-beta.15`, independently reporting `postgres (PostgreSQL) 17.6`, and driver `pg@8.16.3`.

| Existing tool/archive | Observed SHA-256 |
| --- | --- |
| Package archive, matching existing N77 REPORT.md | `342a4d42245f9562fc7e7652b353e8f1cecb56febebc72db1a8e2ace0b100528` |
| postgres.exe | `54e7e05939e61f3462e3fd295bc12292623ad3cf010c02ae9cc3295a64b0770f` |
| initdb.exe | `96da800ec12faed19209c7f9e21231c3dca2dcb12d2215751e18b0b9df20cec1` |
| pg_ctl.exe | `4343536036689feb178461c559cc71c1003d11d9a7b9191ddd13e1fb835481f4` |

## Executable harness and observed ownership

Entry: `node tests/n88-native-pg-1028/run-local.mjs`, from this activated worktree. This explicit runner invokes `qualify` in `concurrency.test.mjs`; importing the latter alone does not start a database. The runner requires its exact active card/run lease and never auto-installs tools. It creates a new random `.tmp` directory under task-worktree `artifacts`, verifies Git ignores it, acquires the canonical **integration phase lease**, and uses `initdb` with a newly generated disposable password and SCRAM-SHA-256. Password temporary file is removed immediately after initialization. No production DSN, pgpass, connection URL, user profile or existing secret is read.

Only `127.0.0.1` listens, on an OS-selected ephemeral port. HBA allows only the disposable local admin from `127.0.0.1/32` with SCRAM, with IPv4/IPv6 catch-all rejection. Every connection explicitly supplies host/port/database/user/password/SSL=false for this owned cluster and reads back its data directory, server address, port and version. Child environment is bounded; no global variable is changed. The actual server reports PostgreSQL 17.6 native Windows/MSVC, not PGlite/WASM. The real pg client creates a new independent connection for each adapter acquisition, with **no JavaScript acquisition mutex**.

Successful run: **2026-10-28T16:36:50.611Z → 16:37:37.308Z**, port **61900**. Owner marker, absolute data directory, postmaster PID file, executable path, command line and OS process birth were checked before server use and before each stop. Controlled restart identities:

- Initial owned postmaster PID **34620**, birth **2026-10-28T16:37:03.421248Z**.
- Restarted owned postmaster PID **35260**, birth **2026-10-28T16:37:32.549116Z**.
- Both stopped with bounded `pg_ctl fast/wait 20s`; exact postmaster absent and exact port rebound/released after each stop. No unknown OS process was killed.
- Final owned data directory removed only after marker/parent/absolute-path checks. Reports, owner marker and server log retained. The only deliberate connection termination targeted an observed backend PID belonging to a new owned loopback fixture connection.
- Lease returned **ACQUIRED integration → RELEASED integration**. No browser, public HTTP server, live account, native provider transport or hosted service operation ran.

Retained machine-readable report (ignored local artifact, not a published endpoint):

`artifacts/n88-native-pg-1028-aa01c670-8021-4e63-8a1c-21a53c2e0e34.tmp/report.json`

Report SHA-256: `78fa1f362a4f7dbed489eafa00646098b26f66d8b593678b977091d0c02d7e72`. It records all 13 passing checks, exact lock observations, catalog definitions/hashes, raw source hashes, runtime identity, restart and final cleanup. The durable Product code did not change after this proof; only this evidence document was added.

## Actual new proof — 13/13 PASS

The exact inactive DDL was executed **only** in the new scratch cluster. Catalog readback found four private tables, six SECURITY INVOKER functions, eight immutable transition/truncate triggers, primary/FK/check constraints and no PUBLIC table privileges. All application operations run through the actual `createPublicationV2Service` → actual durable ports/repository → native SQL path. Fake Auth sessions and canonical-shaped source data are stored in SQL, not returned from an in-memory readiness predicate. Current session and canonical snapshot are read with `FOR SHARE` on the **same active transaction**, then revalidated by the real service COMMIT guard.

| New check | Observed evidence |
| --- | --- |
| Exact DDL and private catalog | Actual PG17 schema execution/readback; four tables/six functions/eight guards; technical function-definition hashes retained. |
| 0 pupils | Owned empty class admitted; sources start private; absent pupil denied. |
| 1 pupil | Saved dates, independent task/grade choice and fresh own-pupil projection. |
| 30 pupils | Every pupil checked through fresh native transactions, exact work/grade allowlist. |
| 50 pupils | Every pupil checked; hidden component and parent total/rank/raw rows absent. |
| CAS in both intent orders | Held backend **20864** blocked independent **36520** on advisory lock; reverse choice held **12500**, blocked **7312**. `pg_blocking_pids` and `wait_event_type=Lock`, `wait_event=advisory` observed before release. First intent applied, second rejected; later withholding did not rewrite original receipt; same request/different command stayed UNKNOWN. |
| Noncooperating source writer | Actual snapshot reader **27860** held a row-share fence; writer **29988** blocked on `transactionid`. After legitimate ordered commits, the next fresh read withheld changed-source publication. |
| Stale session/source/term | Separate writer commits before a queued admission; stale session/retired term deny, stale source command durably rejects. Actual advisory waits observed. |
| Retirement in both lock orders | Publication-first writer **26440** waited behind **32444**; deletion-first publication **552** waited behind writer **25572**. Parent/child retirement and source mutation in one scratch transaction; explicit rollback restored prior state. Restore with newer canonical revisions did not revive tombstoned children. Original immutable applied/rejected outcome retained with no contradictory fresh confirmation. |
| Backend disconnect before COMMIT | Owned backend **4184** terminated after actual receipt INSERT but before COMMIT. PostgreSQL rolled back the flush; no receipt/revision persisted, and status did not replay. |
| COMMIT before late ACK timeout | Observer independently saw the one committed original receipt while response remained unsettled. Adapter deadline returned UNKNOWN/503; delayed result could not become a provisional success. Fresh original status confirmed exactly that receipt, with receipt writes still **1**. Broken connection destroyed; no automatic resend. |
| Owner/private/immutable negatives | Separate authenticated synthetic owners isolated; forged scope and stale echo deny; native receipt update/delete/TRUNCATE, nonadvancing publication revision and high-water regression return **23514**. OFF does not acquire a connection; non-synthetic repository construction denies. |
| Native clean restart | **24 original receipts and 4 tombstones** survived bounded stop/start under a new verified postmaster birth, then final cleanup succeeded. |

**146 distinct backend PIDs** observed across the real service transactions and observer. Simultaneous blocking relations, rather than PID count alone, prove the independent-connection contention. No old PGlite result is relabelled as native proof.

### Source identity used by this proof

These are SHA-256 of the exact raw worktree bytes read by the successful runner (not a claim about hosted function identity or normalized provider assets):

| Source | SHA-256 |
| --- | --- |
| publication-v2-postgres.inactive.mjs | `0b38130ae2ecf097d72b92722d5157621f6dfa932b80b6079889c22b7edc32e0` |
| publication-v2-storage.inactive.sql | `399f6d5f513bf0fd3bb3bb9f8a206018e451ed9d6cc5d9a9b7fa89b3a81525c0` |
| publication-v2-service.inactive.mjs | `1950f6a195ac330c81d679fc90773bab84ee1d594e3a6c09a452bcfbc46c3cb6` |
| student-projection.mjs | `b407eb68c492c6d861ceb2da9c8dafe24ab3736aa679174ff2539a881bb5d754` |
| run-local.mjs | `2ddeb1e33761139ade401972167f5a723c2ff3956338ff586eca2f18f65140f5` |
| concurrency.test.mjs | `e19ed1bbcfa4be5f462f85b3862b33dfaa03d5b6b3d416dc0a04e977f076384c` |

## Preserved failures and narrow harness repairs

Three earlier attempts remain in their owned ignored directories, with original results intact:

1. `de33964d-868b-40d3-90c5-505fc59b4f33.tmp`: before lease/start, a Windows quoted `git check-ignore` output was compared with an unquoted path. Corrected to test the command's exit status; no safety check removed.
2. `523c3006-883d-4f03-b1b0-db24e66d2370.tmp`: before lease/start, PowerShell refused script loading: **“running scripts is disabled on this system”**, `SecurityError`, `UnauthorizedAccess`. No server was started and no global policy/ACL/tool rule changed. Read-only inspection proved the current runner PID37432 command line and canonical `controller.mjs:1165` both already use **`-ExecutionPolicy RemoteSigned`**. The new child helper had omitted that approved per-process configuration. It now uses exactly the existing RemoteSigned lease invocation; no Bypass/Unrestricted, `Set-ExecutionPolicy`, alternate script surface or approval-policy change was used.
3. `d0ef82ea-b266-40c4-a32f-f634f8124f39.tmp`: native DDL executed, but the **catalog reporting query** cast a function definition containing backslashes directly to bytea and got **22P02**. Changed only that reporting expression to `sha256(convert_to(pg_get_functiondef(...),'UTF8'))`; Product DDL/adapter untouched. Failed cluster was ownership-verified, stopped (PID37192 absent), port freed, data removed, lease released. The materially corrected next run is the 13/13 PASS above.

No unchanged blocker retry, hosted fixture replenishment, tool-policy weakening, live SQL replay or Product guard relaxation occurred. `node --check` on both new harness files and `git diff --check`: PASS. No Vite build, UI inspection or public Preview was needed or claimed for these test-only files.

## Remaining exact install/readback gate — NOT_RUN, no authority implied

This closes the dedicated local native-connection proof gap. It does **not** install the V2 storage or make the generic frontend publisher a backend deployer. Before any live enablement, the separately scoped original custodian must:

1. Review the exact DDL hash above against the actual provider schema/version and approve one exact migration identity. Install once under that authority and read back all four relations, keys/FKs/checks/indexes, eight transition guards, all six function definitions, owners, SECURITY INVOKER/search paths, direct/inherited/default privileges and non-exposed schema. No browser/anon/authenticated direct access; narrowly bound backend permissions only under explicit authorization.
2. Extend and qualify the existing hosted finite private-error-boundary operation catalogue with exact V2 typed operations/identities and constrained native parameter/results. The present hosted boundary still rejects these new statements; it was not modified or bypassed. The local synthetic acquisition port is not connected as a substitute hosted executor.
3. Replace the **SQL-backed fake snapshot/session readers** used here with the actual verified teacher Auth/current-session and own numeric pupil session readers, and the genuine complete canonical dependency reader/locks. Prove canonical writer lock order and phantom membership/source/grade behavior on actual table relationships. Local `FOR SHARE` of one synthetic snapshot row is not proof of the deployed fifteen-table lock closure or real session security.
4. Integrate `publication_v2_retire_source` into genuine canonical soft/physical source deletion transactions with valid parent/child dependencies and the same lock order. This harness explicitly invokes it in a fabricated lifecycle; it does not install canonical triggers or claim existing Sync/Delete writers call it. Qualify real rollback/deletion/restore/no-recycling behavior before allowing writes or pupil disclosure.
5. Read back the exact installed service/function identity against the qualified sources and carry forward immutable receipt/UNKNOWN and tombstone retention safeguards. Only then perform separately authorized real teacher/student UX and owner/privacy acceptance and deliberate server-owned activation. Public teacher/student UI, N44 SW, positive issuance and real cancellation remain untouched. Source publication or HTTP200 alone cannot satisfy this gate.

Primary references consulted: [PostgreSQL 17 explicit locks](https://www.postgresql.org/docs/17/explicit-locking.html), [local HBA authentication](https://www.postgresql.org/docs/17/auth-pg-hba-conf.html), [official Windows runtime options](https://www.postgresql.org/download/windows/). No new runtime download was needed.

No push/deploy or queue/ledger edit was performed. Final worker readiness covers this exact local native qualification and inactive test/evidence candidate only; original controller/sole publisher own source delivery, and N88 remains OPEN.
