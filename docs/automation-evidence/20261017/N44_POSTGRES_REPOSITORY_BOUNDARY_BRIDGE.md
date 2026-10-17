# N44 PostgreSQL repository boundary bridge — inactive source qualification

Task: `continuous-n44-postgres-repository-boundary-bridge-20261017`

Run: `d3379dc5-49cb-4ae5-89a9-ab130cdaed60`

Base: `68e8262f4cc34c5fc1b19d9085e9e98c18b9af85` (HEAD and observed origin/main).
Candidate: the AI-identified commit containing this report; its full SHA is
returned in the worker result, avoiding a self-referential commit hash.

**LOCAL_READY for inactive source only. N44 remains OPEN; Push is not enabled.**
No push/deployment, queue/status update, hosted service operation or Product
acceptance occurred. The original controller/publisher owns source-only
integration/publication and provider evidence. No served runtime asset was added.

## Concrete implementation

`drafts/n44-push/postgres-repository.mjs` supplies the missing
`repository.atomic(ownerId, synchronousWork)` port. The actual imported
`createRegistrationBoundary` and `createDeliveryBoundary` execute unchanged.
The adapter uses an injected exclusive connection lease, with no driver import,
package install, environment/config lookup, default connection or memory fallback.
In-memory maps are bounded transaction snapshots/write buffers backed by SQL,
never independent durable repositories. The README documents the external port.

Transactions use an owner-clock INSERT/FOR UPDATE before current owner-only
context/preferences, registration, receipt, budget and endpoint-claim reads.
READ COMMITTED statements after acquiring that lock see the preceding cooperating
writer's committed state. Bounded row counts/bytes, exact field/state/JSON-key
validation, safe bigint conversions and fixed parameterized SQL reject malformed
state instead of truncating/normalizing it. DB time and persisted high-water are
monotonic. Async/reentrant callbacks and later use of a transaction handle fail
closed; returned rows/context values are detached clones.

Writeback respects child/parent deletion, tombstone-before-replacement order,
immutable triggers, foreign keys and global fingerprint uniqueness. Claims are
read only for the current owner, released only for the exact original UUID,
and inserted without global conflict overwrite. A foreign collision at flush
rolls back registration and budget changes and produces generic `unavailable`
through the existing boundary; no foreign claim detail or buffered success leaks.

An acknowledged COMMIT with transaction-local synchronous commit precedes the
returned permit and local sender callback. Only actual PostgreSQL ERROR
`40001`/`40P01` with successful rollback can retry once (two fresh attempts total),
rerunning pure synchronous work. Transport loss, rollback failure and ambiguous
COMMIT acknowledgements never replay. `writeContexts` provides a separate trusted
owner-locked writer hook for future invalidation/preference integration. It is
not a client API or Auth proof; production canonical writers/events remain absent.

## Actual affected checks

Command: `node tests/n44-postgres-repository.mjs` from this worktree. Final run
**2026-10-17 13:59:06.155–13:59:35.184 UTC**: **7/7 targeted cases PASS**, plus
restart/revoke/retention checks; **all three required checks PASS**. Machine
evidence, exact source SHA-256s, unchanged-source hashes, effective roles, backend
wait chains, restart and cleanup receipts are in
[`tests/n44-postgres-repository.result.json`](../../../tests/n44-postgres-repository.result.json).

| Required check | Executed evidence |
| --- | --- |
| `n44_real_postgres_repository_executes_existing_registration_delivery_boundaries` | Actual register and original-UUID replay; wrong transport/revision/binding; foreign read/revoke and RLS identity mismatch; global fingerprint loser with no registration/budget residue. Actual delivery/current-context/consent/session-expiry/quiet/preference/deleted-event/expired-input paths. No standalone raw-SQL adapter substituted for boundary logic. |
| `n44_two_repository_commit_fencing_current_context_budget_and_restart_guards` | Twenty actual deliveries through two independent pools produced **one committed permit, one recorded LOCAL sender callback and nineteen duplicates**. Sender observed committed `sending/attempts=1` using another SQL connection. Exact first device-hour/day/owner-day debits were 1; later actual budget stopped at 6/hour. Definitive retry/backoff→attempt 2 sent; thrown sender result→uncertain with no replay. Context invalidation and preference disable each committed under the owner lock before a later reservation, suppressing its callback. |
| `n44_owned_sql_cleanup_inactive_source_and_honest_auth_sender_device_limits` | Exclusive new cluster marker/PID/birth/executable/`-D`/port and SQL data_directory checks; controlled owned stop/restart with new pool/adapter; final exact PID absent and exact loopback port rebound/released. Inactive import-binding inspection; unchanged policy/SQL evidence reused; hosted Auth/sender/device explicitly NOT_RUN. |

Four SQL wait observations include the real hard/soft blocking chain:
PID **29088**, pool 2, `Lock/transactionid`, blocked by **23708**; PID **31304**,
pool 1, `Lock/tuple`, blocked by **29088**. The two other observations show the
context-writer lock blocking the other pool. There is no JS owner mutex/promise
queue replacing SQL locks. Node pg's bounded connection pooling is separate.

Fault injection occurs at the injected connection transport while all normal
reads/writes and boundary callbacks use actual PostgreSQL. BEGIN, snapshot read,
flush, pre-COMMIT and rollback transport failures produced no unintended sender
callback or durable reservation. Actual SQL-raised `40001` and `40P01` aborts
retried once; repeated aborts stopped after two attempts. COMMIT followed by an
injected lost acknowledgement returned unavailable without a callback, retained
`sending`, and a fresh repository suppressed the same event. No real network
send, power-loss/crash durability or exactly-once device receipt is claimed.

After controlled fast shutdown/restart, a new pool/adapter retained the active
registration, exact persisted budget rows and sending fence. Same event never
resent. Cleanup advanced `sending` to `uncertain`; original revoke erased sealed
and both fingerprint columns, released its endpoint and retained its tombstone.
Reusing that endpoint for a new UUID succeeded; old tombstone replay preserved
the replacement. Later bounded cleanup deleted expired receipts/registrations
and budget entries. Actual LIMIT+1 context rows, malformed preferences, unsafe
stored bigint, invalid state/key, async/reentry and clone/handle probes failed
closed. Callback throw rolled back its buffered deletion.

## Engine, ownership and retained checkpoints

Actual server: **PostgreSQL 17.6 on x86_64-windows, msvc-19.44.35213, 64-bit**.
Reused only the existing read-only native binaries and Node pg at
`artifacts/n77-native-pg17/{package/native/bin,client/node_modules/pg}`. No
install/download/npm/Docker/service/old N77 data directory/default 5432 or
existing database connection. Child processes use a minimal explicit environment;
loopback connection options and ephemeral unlogged local authentication are
explicit. Credentials were never printed; the temporary password file was removed.
No real PushSubscription endpoint, encryption keys or secret configuration read.

Final owned directory under this worktree:
`artifacts/n44-repository-pg-d3379dc5-49cb-4ae5-89a9-ab130cdaed60-750ffce6-161c-44f5-9ebf-c095caf378c9/data`.
OS-assigned port **58941**. Initial postmaster **19544**, birth
**2026-10-17T13:59:15.1763690Z**; restarted postmaster **21860**, birth
**2026-10-17T13:59:32.1926840Z**. Both exact identities stopped; final PID absence
and port rebind were verified. Fresh physical pool connections recheck process
identity asynchronously and read back exact data_directory/address/port before
test SQL. All clients/pools close before owned `pg_ctl -D ... -m fast -w -t 20
stop`; no unknown process kill or directory deletion.

Configuration remains bounded: loopback only, 12 connections, 16 MiB shared
buffers, 1 MiB work memory, 16 MiB maintenance memory, 6-second statement / 3-second
lock timeouts, transaction idle limits, fsync/synchronous commit/full-page writes
on. SQL/bind/error-statement logging is disabled. A separate local-only fixture
role runs repository operations with **NOSUPERUSER/NOBYPASSRLS**, no table
ownership and only the schema/Auth-stub usage plus CRUD required by this fixture.
The fixture injects owner identity outside the repository with a transaction-local
stub; this cannot be used as hosted Auth evidence or a production privilege plan.

Seven newly owned synthetic directories remain as stopped local checkpoints;
read-only final inspection found no `postmaster.pid` in any of them. Six earlier
attempts also returned exact owned PID/port cleanup success. The previous task's
actual recursive-delete tool rejection remains binding: no directory deletion,
retry under another tool or ACL/policy change was attempted. Checkpoints are
untracked runtime artifacts, not candidate source. N88 files/ports/PIDs were
untouched. No shared browser, integration or live-mutation phase was entered;
the task-specific cluster uses its exclusive marker and port ownership. The
canonical shared lease script exposes only those three unrelated phase names.
No shared lease/STOP/controller/maintenance/queue file was changed.

## Preserved harness failures and evidence reuse

The first implementation passed all three checks with one observed initial SQL
wait. Subsequent strengthening exposed harness defects; original reports remain:

- [`failure-lock-observer`](../../../tests/n44-postgres-repository.failure-lock-observer.json): synchronous process checks obstructed the short observation window.
- [`failure-lock-cold-pool`](../../../tests/n44-postgres-repository.failure-lock-cold-pool.json): cold replacement connections after deliberate errors still preceded the lock phase.
- [`failure-lock-direct-blocker`](../../../tests/n44-postgres-repository.failure-lock-direct-blocker.json): requiring both backends to name the original holder ignored PostgreSQL's soft-blocking wait queue. The final probe traces the actual bounded blocking graph and still requires two independent pool names.
- [`failure-clock-equality`](../../../tests/n44-postgres-repository.failure-clock-equality.json): a later authoritative clock value was 7 ms greater, correctly monotonic. Equality was an invalid assertion; it now requires nondecrease.
- [`failure-retry-clock`](../../../tests/n44-postgres-repository.failure-retry-clock.json): advancing a prior JS clock exactly 60 seconds preceded the DB-computed receipt deadline. The test now anchors its advance to actual committed `next_at_ms`.

Asynchronous identity checks and pre-observation connection readiness did not
remove any ownership or SQL lock check. The observed hard/soft chain confirms
the direct-holder assertion was wrong. No boundary, SQL guard or sender policy
was weakened to obtain a PASS; all original failed reports retain FAIL. Final
source is bound by hashes in the final result. Only materially affected checks
were rerun after each correction; unchanged native raw-SQL 10/10 and memory
policy 16/16 suites were not rerun. Registration, delivery, shared, schema,
transitive core/state/center and prior fixture/test evidence were compared
byte-for-byte to the full base commit before reuse. Existing actual RLS/grant
10/10 evidence remains in [native SQL qualification](N44_NATIVE_POSTGRES_QUALIFICATION.md).

`sourceHashes` records tested worktree bytes. Module, fixture and README match
staged Git bytes exactly. The runner's staged blob differs only by Git's CRLF→LF
normalization (explicit normalized-content comparison passed); its staged
SHA-256 is `db0b3197ee17ddfd2cd53c10a6f70396a390f66c389f69458a0d75d75e8724c3`.

Syntax checks cover the new module/runner/fixture; the existing README gate
selected with `--test-name-pattern='gate: documented SQL/live'` passed 1/1.
Inactive app/public/script/Supabase/SW import-binding checks and scoped diff
checks passed. No full Vite build, browser/UI/Preview or unrelated suite ran.

## Remaining gates — NOT_RUN / NO_IMPLEMENTATION

Hosted Auth/GoTrue/PostgREST, production identity/service role and privilege
mapping, real canonical event/context/preference/consent writers and all-writer
adoption, HTTP ingress/CSRF/streaming/duplicate-key limits, hosted SQL/migration,
service/function deployment, audited encryption/curve checks/HMAC, VAPID/key
custody, provider origins/egress/DNS/redirect/TLS, scheduler, real send, app/router/
store/SW/offline wiring, authenticated app owner entry, real teacher/student data,
browser/OS/device receipt, Production verification and PO acceptance remain
**NOT_RUN**. The fake curve/protector/recompute/sender are labeled synthetic
ports. A future service release must perform its own exactly authorized backend
operations; the generic frontend publisher cannot provide them. No paid service,
subscription or upgrade was introduced, and N44 is not CLOSED.

The requested Supabase skill was read from its installed `SKILL.md`. Reviewed
[current changelog](https://supabase.com/changelog.md) (public HTTPS 200; web markdown reader unsupported),
[connection documentation](https://supabase.com/docs/guides/database/connecting-to-postgres),
[17.11 breaking-change notice](https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes)
(no affected extensions/operators in this isolated fixture; installed 17.6 was not changed),
[HTTP TLS notice](https://supabase.com/changelog/cbc-tls-ciphers-deprecated),
[PG17 transaction isolation](https://www.postgresql.org/docs/17/transaction-iso.html)
and [PG17 blocking-PID semantics](https://www.postgresql.org/docs/17/functions-info.html).
No hosted connection/upgrade is inferred from these documentation reads.
