# N88 native PostgreSQL qualification — inactive source only

Task: `continuous-n88-native-postgres-qualification-20261017`

Run: `f114bf86-e397-4064-9ca8-44e6b8384cc4`

Base: `cced9c6f4b6db4ed0de4a63ba3dcc30359407767`

**LOCAL_READY for local SQL qualification of the unapplied private draft.** N88
remains OPEN; no real student access is activated. Candidate is the AI-identified
commit containing this document; its full SHA is returned by the worker. No push,
deployment, hosted SQL, queue/status mutation or Product acceptance occurred.
The independent controller/publisher owns inert source publication and readback.

Read the activated card, canonical operating contract and latest canonical N88
row, including FINAL14:16 PIN/term identity and the native qualification action.
`git ls-remote origin refs/heads/main` initially returned the full base above,
matching this worktree HEAD and origin/main. The older local ledger was not used
to override those current decisions. No deferred work or other worker was touched.

## Actual engine and source

Command: `node tests/n88-native-postgres-qualification.mjs` from this worktree.
Final execution: **2026-10-17 13:42:06.663–13:42:22.752 UTC**.
**10/10 detailed checks and all three card-required checks PASS.**
[Machine result](../../../tests/n88-native-postgres-qualification.result.json)
contains catalog definitions, 50 negative SQLSTATE observations, three actual
blocking snapshots, ownership epochs, source hashes and final cleanup.

Readback: `PostgreSQL 17.6 on x86_64-windows, compiled by msvc-19.44.35213, 64-bit`.
Reused only the installed native binaries under
`C:/Users/Abody/Projects/RakeezX/artifacts/n77-native-pg17/package/native/bin`
and existing Node `pg` at `artifacts/n77-native-pg17/client/node_modules/pg`.
No psql, installation/download/npm, Docker, Windows service or old cluster was
used. Actual executed schema byte SHA-256:
`6fbad579413038ba19065210dbb48dceecf92d0b801e9be66dff59cd1a9a66ea`.
The result also binds normalized-LF SHA-256 for the runner, fixture modules and
both executed SQL query files. Only the schema's introductory comment changed;
its DDL/constraints/grants are unchanged from base.

## SQL observations and their limits

| Affected result | Actual evidence |
| --- | --- |
| Actual draft / rollback / catalog | Executed complete draft inside BEGIN/ROLLBACK; namespace absent afterward. Executed again inside BEGIN/COMMIT. Read back 6 tables/PKs, 4 FKs, 26 total constraints and 16 indexes. All 6 tables ENABLE RLS, none FORCE; zero policies/functions. Verified active `(owner_id,student_id)` partial unique index, session credential/retention and published-member indexes. No performance claim. |
| Crossbinding / collision / storage | Actual `23503` for credential namespace-owner and session owner/namespace/credential/student/version/entry/class/enrollment mismatches and publication foreign membership. Actual `23505` for active owner/student, namespace+PIN verifier including tombstone, global entry including tombstone and global session token hash. Actual `23514` for namespace/revision/version/HMAC/hash/publication/budget checks. Three repeated collision inserts preserve the first credential. Same PIN across owners uses namespace-separated HMACs; artificial identical verifier bytes are legal only in distinct namespaces. No raw PIN/bookmark/token columns or persisted raw secrets were added. |
| Effective private denial | PUBLIC-only probe, anon and authenticated are NOSUPERUSER/NOBYPASSRLS and own zero private tables. No schema USAGE/CREATE; 126 forbidden table privilege checks, 18 actual SELECT denials with `42501`, zero private RPC/functions. Never granted temporary private access. This proves ACL denial, **not** positive owner RLS or real service Auth. |
| Two-backend reservation | Backend PIDs **29424 / 24428**. First uncommitted namespace+verifier reservation visibly blocks second; first commits, second gets **23505** and rolls back its preceding membership insert. Winner remains, loser credential/membership absent. No JS mutex. |
| Durable budget protocol | Actual `guess_budgets`, five fixed pre-provisioned keys, sorted SQL row locks and DB `clock_timestamp()` after locking. Twelve mixed attempts across two connection streams: six reservations, six refused before lookup; three wrong-PIN failures committed counters. Individually seeded thresholds **6/30/100/60/500** each deny before lookup without a debit. Expired rows reset to DB-time 15-minute/24-hour windows; final attempt counts 2, failure counts 1 survive restart. This fixture's HMAC lookup is a **budget-only probe**, not a full authenticated login implementation. |
| Stable identity / second term | Credential ID, owner/student, version, PIN HMAC and entry HMAC remain byte-for-byte unchanged. End old membership, add independently fabricated new class/enrollment/revision and publication. Old still-unexpired session refuses; new scoped login sees only current explicitly published task **230**. Exact title/instruction/deadline/status projection and same-snapshot progress; hidden/foreign/old publications excluded. Unpublish is rechecked. Ended/no replacement, different student ID representing a name clone, foreign owner/entry, ambiguous memberships, revision change and inactive context fail closed under the test query protocol. SQL has no name column or canonical-store integration. |
| Atomic rotation / revoke | Three sessions spanning old/new terms retire with the original credential. Rolled-back rotation restores original credential/sessions and removes replacement; committed rotation uses a new PIN/entry/version, old claims/reads refuse and new session reads the same current scope. Explicit revoke retires replacement and its session. A third observed SQL lock wait serializes committed revoke before competing login, which creates zero sessions. All cooperating scope operations lock context → memberships → credentials → sessions. |
| Controlled restart | Closed owned clients, ownership-matched fast/wait stop, verified old PID absent and port free, restarted the **same owned** cluster and read back its identity before SQL. Whole-state digest agrees across restart, including credentials, budget counts and revocations; old session remains denied. **Clean restart only, not crash/power-loss durability.** |

All three `pg_blocking_pids(24428)` observations returned `[29424]` with
`wait_event_type=Lock`, `wait_event=transactionid`, before the first transaction
was released. Observation/SQL/client waits have explicit deadlines.

The protocols live only under `tests/fixtures/n88-native-postgres-qualification/`.
SQL constraints do **not** enforce exactly one current membership, current
canonical student/class status, precise session freshness, projection, lock order
or atomic all-session revocation on an arbitrary future writer. The tested
queries/transactions impose those checks on fabricated memberships. They do not
implement the synchronous memory repository's production replacement.

PIN validation/normalization, nonempty 1000/9999 bounds, private individual entry,
128 collision draws and full 9,000-code exhaustion remain **service policy**.
Hashed SQL verifiers cannot enforce PIN length. The unchanged prior service and
memory tests supply those proofs; they were not rerun or relabeled SQL evidence.
The budget fixture does not implement dynamic global 10,000-key admission/purge,
distributed ingress identification, crypto timing defenses, or real account Auth.
Concurrent login-before-revoke, publication/lifecycle races and arbitrary
noncooperating writers were not certified by this bounded run.

## Preserved failure and evidence reuse

[Initial fixture failure](../../../tests/n88-native-postgres-qualification.initial-fixture-failure.json)
records expected FK **23503**, actual **23505**: the negative namespace-owner
fixture also reused an existing verifier, so uniqueness failed first. Corrected
only that fabricated verifier to isolate the FK probe. No draft invariant failed
and no DDL/grant/policy repair was made. That cluster stopped with exact PID
absence and port rebound verified. A subsequent full SQL pass preceded the final
runner hardening (explicit same-PID recheck, bind-log suppression and required
check reporting); final owned lifecycle was then exercised as recorded above.
No unchanged blocker retry, tool denial or cleanup workaround occurred.

Machine result verifies **15 unchanged source/evidence bindings** against base,
including final browser recorded normalized-LF hashes, service, memory repository,
teacher/student modules, date normalization, CSS, existing test fixtures and the
17-test service source. Reuses [final PIN/term evidence](N88_FINAL_APPROVED_PIN_AND_TERM_IDENTITY.md):
17/17 memory/service checks and 2/2 actual-app HTTP/browser cases. No UI/browser,
Preview, N44 suite, all-9,000-case rerun or full Vite build was needed. Actual
module import/require binding scan finds no draft/new-test entry from normal
app/service/SW paths; `git diff base -- src public sw.js index.html scripts
supabase` is empty. Documentary mentions are not treated as imports.

Scoped `node --check` for runner and both fixture modules, exact source/hash
readback, allowed staged path inspection and `git diff --cached --check` passed.

## Owned resources and remaining gates

New exclusive directory with task/run ownership marker/token, fresh dataDir,
OS-assigned `127.0.0.1:55400`; no default PG host/port/config, `.env`, `.mcp`,
pgpass, hosted URL, real data or credential discovery. Ephemeral cluster password
and HMAC key were never printed. Temporary init password file was unlinked; HMAC
key remained in memory only. Subprocess environment is an explicit minimal
allowlist. SQL/parameter/error-statement logging is suppressed. SCRAM auth,
12 connections, 16 MB shared buffers, 1 MB work memory, 6 s statement/3 s lock/
20 s idle-transaction deadlines; fsync/synchronous_commit/full_page_writes on.

Before each connection and stop, matched marker, exact executable, `-D` directory,
PID file directory/port and PID/birth. Before fixtures, each connection read back
data_directory, address, port and version. Initial master **17916**, birth
`2026-10-17T13:42:16.57539Z`; restarted master **24520**, birth
`2026-10-17T13:42:20.495313Z`. Both stopped with `pg_ctl -m fast -w -t 20`.
Final exact PID absent; exact port rebound and released; all owned clients closed.

Final retained STOPPED checkpoint:
`artifacts/n88-native-pg-f114bf86-e397-4064-9ca8-44e6b8384cc4-486f70fb-b867-4d3f-ab45-bb0bf1666313/`.
The initial `744dd842-aecf-4f05-ac25-502fc64f21ae` and intermediate
`906eb104-454b-4ee1-9fc0-f9548333ec1f` task checkpoints are also retained stopped.
No recursive deletion attempted. These local database artifacts are **not staged
or published**. No shared browser/integration/live-mutation phase occurred; this
local native DB used its exclusive task marker, without touching shared leases,
STOP/controller locks, another process or user browser.

**NOT_IMPLEMENTED / NOT_RUN:** production asynchronous SQL adapter; current real
teacher Auth and canonical membership/publication adapter; hosted schema/roles/
RLS/function/service deployment; shared service ingress/key admission/purge;
HTTPS/privacy/CDN/path-log redaction; real devices; crash/power-loss recovery;
authorized private handoff/real-student activation. SQL/ACL qualification here
narrows the local gap only. Those gates and N88 Product acceptance remain open.
