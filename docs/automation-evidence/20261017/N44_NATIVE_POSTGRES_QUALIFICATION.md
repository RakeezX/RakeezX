# N44 native PostgreSQL qualification — inactive source only

Task: `continuous-n44-native-postgres-qualification-20261017`

Run: `d8da6fc9-441f-4a47-b777-d46b7ed18acf`

Base: `e1950472da7abd53bd520dad2beac791146b298f`

Candidate: the AI-identified commit containing this document; full SHA is returned
in the worker result to avoid a self-referential commit hash.

**LOCAL_READY for inactive source qualification only. N44 remains OPEN; Push is
not enabled.** No push, deployment, queue/status change or Product acceptance is
claimed. The original controller/publisher owns source-only publication and its
served-source verification. The activated card already names this document and
`drafts/n44-push/README.md` as verification paths; no served asset was added.

## Actual engine, source and ownership

Command: `node tests/n44-native-postgres-qualification.mjs` from this worktree.
Final run: **2026-10-17 12:00:22.929–12:00:38.008 UTC**, **10/10 checks PASS**.
Machine-readable queries, catalog, failures, SQLSTATEs and source hashes:
[final result](../../../tests/n44-native-postgres-qualification.result.json).

Actual readback: `PostgreSQL 17.6 on x86_64-windows, compiled by
msvc-19.44.35213, 64-bit`. Read-only reused binaries at
`C:/Users/Abody/Projects/RakeezX/artifacts/n77-native-pg17/package/native/bin`
and existing Node `pg` at `artifacts/n77-native-pg17/client/node_modules/pg`.
No psql guess, install, download, npm operation, Docker/service start or access
to the old N77 cluster. The actual schema byte SHA-256 was
`d1d46f9e0e79cfb6c36c4efa74128fd84fd20bd863079c1c8b6939105d51ad5d`.

Created a new exclusive task-local directory with an ownership token, reserved an
OS-assigned loopback port, initialized only its new `data` directory, and used
explicit connection options with an ephemeral unlogged local password. No PG
environment/default database/5432/pgpass, `.env`, `.mcp`, project configuration,
Auth key or hosted Supabase endpoint was read. The executable subprocess
environment is an explicit minimal allowlist.

Final cluster directory suffix:
`artifacts/n44-native-pg-d8da6fc9-441f-4a47-b777-d46b7ed18acf-631b83f1-3a41-4c67-8a45-03f2dd776cc1/data`.
Postmaster PID **31180**, birth **2026-10-17T12:00:33.198792Z**, port **57535**.
Before either DB connection, matched ownership marker, PID file data directory,
port, PID/birth, executable and normalized `-D` command line. Each connection
then read back exact `data_directory`, loopback address, port and version.
Independent SQL backend PIDs: **33052 / 25332**.

Configuration: listen only `127.0.0.1`, SCRAM local authentication, 12 connections,
16 MB shared buffers, 1 MB work memory, 16 MB maintenance memory, 6 s statement /
3 s lock / 20 s idle transaction timeouts, 32–64 MB WAL range. `fsync`,
`synchronous_commit` and `full_page_writes` stayed on. SQL/bind/error-statement
logging was disabled; SQL error details were not printed. No sender/network
request exists in the fixture; sealed values/fingerprints are fabricated labels,
not a cryptography certification.

## Queries and observations

| Affected check | Actual result |
| --- | --- |
| Apply actual draft / DDL atomicity | Missing prerequisite role caused **42704** inside the draft's BEGIN; ROLLBACK left no draft schema. Restored the local stub role and applied actual SQL successfully. Catalog readback: **6 tables**, all ENABLE + FORCE RLS; **24 owner policies**, **12 indexes**, **39 constraints**, two invoker functions with empty search_path. |
| Real trigger bodies / constraints | Executed immutable original registration/session/consent/expiry/key binding and delivery owner/context/event/registration/kind/action/expiry updates; **P0001**. Negative/4/zero-sending attempts and revoked-with-secrets failed **23514**. Suppressed zero attempts accepted; retry attempts **1→2→3** accepted. Sent/uncertain/suppressed/dead mutation rejected. |
| Private grants | PUBLIC-only probe, anon and authenticated had no schema usage, CRUD/TRUNCATE/REFERENCES/TRIGGER or function execute; **126** table privilege checks. Owner-looking local claims still produced actual **42501** for all six tables and both helpers. Function ACL expansion found no PUBLIC execute. This is grant denial, not RLS proof. |
| Separate RLS | Inside one rolled-back fixture transaction, granted only schema usage, auth.uid execute and table CRUD to `n44_rls_probe`, inheriting the authenticated policy role. Queried **NOSUPERUSER, NOBYPASSRLS, no table ownership**. A/B positive SELECT/UPDATE and foreign SELECT/UPDATE/DELETE invisibility on all six tables; positive INSERT/DELETE and foreign INSERT **42501** on all six. Owner reassignment failed **42501** for policy-protected tables and **P0001** for immutable registration/delivery bindings. Missing UID saw zero rows. Verified fixture schema grant absent after ROLLBACK. |
| Two-connection uniqueness | An uncommitted active-context registration blocked a second backend; after first COMMIT the competitor failed **23505**. Across fabricated owners, same global fingerprint also blocked then failed **23505**; losing transaction's registration rolled back. Foreign/wrong-registration release deleted zero rows; rollback removed only newly owned registration/claim and preserved the original claim. |
| Atomic first reservation | **20** requests in two independent connection streams used owner-clock FOR UPDATE plus four-column delivery PK: **one committed permit / one initial local callback**. No JS shared mutex or memory repository. Rollback produced no callback/row. Additional crash-after-send fixture gave one extra local callback; uncertain receipt/replay gave zero further callbacks. Crash-before-send retained the fence and gave no callback. |
| Crash / bounded budgets / clock | Persisted sending→uncertain could not return to sending (**P0001**). Duplicate event PK failed **23505**. Twelve competing debits accepted exactly **6**, stored count 6; 0 and 41 failed **23514**. Bucket rollover reset to 1. Owner row lock plus DB clock/persisted maximum prevented an old observed clock from reducing time. |
| Revocation / context ordering | Original owner/session revoke erased all three secret columns; foreign owner/new session were no-ops, tombstone replay preserved a newer registration, dead binding stayed immutable. Separately, two actual lock waits serialized committed revocation and committed context-revision switch before subsequent reservation; both yielded zero permits/callbacks. |
| Index predicates | Queried actual definitions: unique active-context partial index; owner/next-time partial retry index; owner/expiry retention indexes; endpoint owner index; owner-leading clock/context/delivery/budget PKs. No performance benchmark or planner-performance claim. |

Five observed blocking snapshots used `pg_blocking_pids(25332)` = `[33052]`,
`wait_event_type = Lock`, `wait_event = transactionid`, before releasing the
first transaction. Work and waits were bounded by server/client deadlines.

These are real database transactions implemented as a **bounded test adapter**
under `tests/fixtures/n44-native-postgres-qualification/`, not an implementation
of the synchronous JS `repository.atomic` interface. Test inserts read current
synthetic registration/context eligibility under the owner lock. They do not
rederive real teacher events, preferences, parent/child dependencies or consent.
All cooperating production writers must still implement the documented lock /
revision protocol. SQL does not automatically impose that protocol on a future
adapter. Committed row visibility and crash-fence reconciliation were tested;
restart/crash-recovery durability and actual process death were **NOT_RUN**.

## Preserved failures and narrow repairs

The first actual trigger probe accepted retry→sending **without incrementing the
attempt**. [Original failed result](../../../tests/n44-native-postgres-qualification.original-trigger-failure.json)
records `actual: NO_ERROR`, expected `P0001`, and successful owned cleanup.
Added one trigger rejection for that transition.

The next executed probe accepted sending attempt **3→retry**. [Second failed
result](../../../tests/n44-native-postgres-qualification.third-attempt-failure.json)
retains the original failure. Added one rejection of updates into retry at three
attempts. The final actual SQL run passes both negatives and the valid flow.
These are the only draft SQL changes; no grants were added to make tests pass.

Initial harness-only startup observation is preserved in
[startup failure](../../../tests/n44-native-postgres-qualification.startup-failure.json):
the server started, but Windows pg_ctl's launch shell inherited captured stdout,
and the cleanup path compared slash styles without normalization. Before any SQL
connection, ownership-matched pg_ctl fast shutdown proved exact PID absence and
rebound port 60312. Fixed capture (no inherited pipe) and normalized the path.
A subsequent inet address readback needed `host(inet_server_addr())` to compare
an address rather than its network-mask text; that cluster also stopped cleanly.
No underlying startup/infrastructure denial was bypassed. An initial broad path
scan also matched inert ops-card/publisher-test text; the final scan checks actual
module import/require bindings, permitting those existing documentary references.

## Evidence reuse, cleanup and remaining gates

The existing [16/16 simulated policy result](N44_SERVER_PREACTIVATION_PACKAGE.md)
is historical and unchanged, not rerun or promoted to SQL evidence. Final JSON
contains exact SHA-256 bindings to unchanged registration/delivery/shared modules,
prior test/fixture and the transitive push-core/state/center dependencies, verified
byte-for-byte against the full base commit. Current import-binding check found
zero app/SW/service/script imports. README's revised gate was inspected separately.
Syntax checks on the new runner/fixture and staged diff check passed. The existing
documentation-gate test alone was selected with `--test-name-pattern='gate:
documented SQL/live'`: **1/1 PASS**; no simulated policy tests were rerun. No full
Vite build, browser/UI/Preview, OS/device test or unrelated suite was run.

Every test cluster used only new fabricated `auth.users`, `auth.uid()` and role
fixtures. `set_config('n44.fixture_uid',...)` is a **local stub only**, never a
claim that a hosted client may choose its identity. Permanent draft privileges
remain denied. This is not GoTrue, PostgREST or hosted grant certification.

Clients closed in finally, followed by exact owned `pg_ctl -D ... -m fast -w -t
20 stop`; no immediate/unknown process kill. Final PID absent and exact port
rebound/released. The tool rejected the optional ownership-guarded recursive
directory cleanup command before execution: `exec_command failed: CreateProcess
... rejected: blocked by policy` (the rejected command contained PowerShell
`Remove-Item -LiteralPath $ownedResolved -Recurse -Force`). No deletion was run or
retried through another tool/surface. The six task-owned directories remain as
stopped synthetic checkpoints, as explicitly allowed by the activated card.
The earlier stop/PID/port proof remains in the actual results; rejection is not
reported as deletion success. Final read-only readback found six stopped
checkpoints, six absent postmaster PID files, six shutdown logs and **zero**
PostgreSQL processes matching this run's directory prefix. No shared
browser/integration/live-mutation phase was entered; local DB
ownership used exclusive directory markers and owned port bindings. No shared
lease, STOP, controller lock, service, ACL or tool-policy setting was changed.

**NOT_RUN / NOT_ACTIVATED:** hosted schema/migration/Auth/RLS/service/provider,
canonical Auth verifier, least-privilege production repository adapter,
authoritative event/preference/consent data mapping, production writer protocol,
cleanup/retention scheduler, TLS/egress/DNS/redirect/crypto/VAPID, real send,
app/SW/offline wiring, authenticated app/store entry, real accounts/student or
teacher data, device/OS receipt, Production and PO acceptance. No new service,
subscription or cost claim. Source qualification does not close N44.

Documentation reviewed before schema decisions: [current Supabase changelog](https://supabase.com/changelog.md)
(web markdown content-type error; ordinary public HTTPS fetch succeeded),
[relevant TLS notice](https://supabase.com/changelog/cbc-tls-ciphers-deprecated)
(future hosted HTTP gate, no change to this local SQL scope),
[Supabase RLS/grants](https://supabase.com/docs/guides/database/postgres/row-level-security),
[PostgreSQL 17 privileges](https://www.postgresql.org/docs/17/ddl-priv.html),
[row security](https://www.postgresql.org/docs/17/ddl-rowsecurity.html) and
[locking](https://www.postgresql.org/docs/17/explicit-locking.html).
