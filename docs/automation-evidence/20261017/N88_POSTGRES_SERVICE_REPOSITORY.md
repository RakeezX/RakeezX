# N88 — inactive PostgreSQL repository: local service qualification

AI-authored. Task `continuous-n88-postgres-service-repository-20261017`; current run
`d80c7450-1db7-4c65-8945-1007808c042b`. Base
`98d8e7ab2905a2786461745af970f0b8f4fb9288`; preserved draft candidate
`65364b2926d81fa9b50c687fa7c62b3a9ea36994`. Final candidate is the commit containing
this report, returned by full SHA. **LOCAL qualification only; no push/deploy,
app import, hosted service, real student access or N88 closure.**

## Actual result

`node tests/n88-postgres-service-repository.mjs` completed once with PostgreSQL
17.6: **10 named checks PASS, all three required checks PASS**, recorded in the
[machine result](../../../tests/n88-postgres-service-repository.result.json).
Existing `createPortalService`, memory repository and original schema remain
byte-unchanged; actual service handlers ran against the new durable adapter.
Teacher Auth, ingress, canonical memberships and source publications were explicit
fabricated ports/fixtures; no request metadata became trusted identity.

| Required check | Actual evidence |
| --- | --- |
| `n88_real_postgres_repository_runs_actual_portal_issue_claim_read_publish_revoke` | PASS: issue/claim/read/publish/unpublish/rotate/revoke; exact published projection; HMAC verifiers only; held COMMIT proves no response before acknowledgement; retained tombstones. |
| `n88_two_service_sql_budget_serialization_term_identity_rollback_and_restart` | PASS: independent pools/backends with observed PostgreSQL advisory wait; credential collision retry; source/context/global and failure budgets; scope denial; stable second-term credential; lifecycle races; callback/flush/commit/deadline faults; fresh pool/service reads after controlled restart. |
| `n88_owned_cleanup_bounded_inactive_port_honest_hosted_auth_and_privacy_limits` | PASS: per-table/global/byte admission fails closed, 11 invalid-value mutations and unsafe SQL bigint rejected; expired rate/session cleanup; credential tombstones retained; unchanged source bindings; owned server stopped/PID absent/port free and integration lease released. |

The mixed race submitted 12 actual valid/invalid service claims through two pools:
exactly six attempts were admitted for the shared source, with persisted failure
counts matching denied admitted attempts. Distinct-source context attempts capped
at 30; a near-limit global race stopped at 100, and global daily failures at 500
blocked further admission. Wrong-PIN/unknown-entry 401 results **committed** debits.
A snapshot access probe verified attempt debits before the unchanged service
accessed sensitive credential/context/membership collections. No sensitive lookup
SQL preceded the fixed lock. The adapter conservatively loads its bounded private
snapshot under that lock; the prelookup claim is about service access/order, not
an assertion that rows are never materialized internally.

Owner/auth/current-context/student/class/entry/cookie and ambiguous-membership
negatives returned generic denial. Published projections excluded other students,
owners and unpublished tasks. Illegal session-version mutation was rejected by
the adapter before flush (the result's historical `versionFkRollback` label names
this rejection; it does not establish that PostgreSQL FK enforcement was reached).
Existing FK qualification remains in the unchanged prior native proof.

A locked fabricated canonical transition ended the first membership and added a
verified second-term membership/publication. Concurrent login waited, retained the
identical stored credential/PIN/private entry and read only second-term tasks;
the old session denied. Revoke-before-login and login-before-rotation serialized
and retired prior sessions. No automatic code reset, enrollment or publication.
The final 1000..9999/9,000-value boundary and UI proofs were hash-bound and reused,
not rerun as 9,000 issuances or a new browser claim.

Fault cases covered callback exceptions, actual PostgreSQL flush constraint failure,
an aborted transaction returning a ROLLBACK command tag at COMMIT, simulated loss
of acknowledgement **after real COMMIT**, delayed asynchronous teacher Auth,
late pool acquisition and a withheld COMMIT acknowledgement. Failure returned
503 without a code/cookie; uncertain COMMIT was attempted once, with no replay.
A timed-out callback resumed after a later operation committed and could not
flush/change its state. Database effects may already exist after lost COMMIT ACK;
this is a generic unavailable result, not proof of rollback or permission to
reissue credentials automatically.

## Port and bounded design

`drafts/n88-student-portal/postgres-repository.mjs` requires an injected exclusive
pg-compatible connection port and explicit row/byte/time bounds. No driver,
connection/Auth/config defaults, broad SQL execution export, retry or memory
fallback. A fixed trusted transaction-owned advisory lock serializes all owners,
global guessing budgets and every cooperating canonical fixture writer. Query
identifiers are fixed; values are parameterized. Noncooperating writers are outside
the protocol. The asynchronous callback executes inside the real transaction.

Reads use LIMIT bound+1, aggregate remaining row capacity, explicit columns and
server-side JSON/byte sentinels; oversize is rejected rather than truncated into a
successful snapshot. Strict mappings reject unsafe bigint/version/revision/time,
UUID/boolean/null/date/source-JSON/string values. Timestamps use exact nonnegative
milliseconds through year 9999. Callback snapshots and returned values are detached;
whole-operation deadlines fence acquisition/callback/flush/commit, with bounded
rollback and destruction of broken/late clients. Pool queue/connection limits are
also required. Trusted callbacks must cooperate with the Node event loop; timers
cannot interrupt blocking CPU loops.

Child-first deletions, parent-first writes and old-credential revocations before
replacement insert preserve FK and active uniqueness. Credential verifiers/keys
cannot be rekeyed, deleted or unrevoked; session scope cannot be rewritten. The
adapter never purges PIN/entry tombstones. Capacity exhaustion fails closed,
including history; service cleanup of expired/revoked sessions and expired budgets
is retained. No new service/security/PIN/term policy was introduced.

The separate `postgres-repository-schema.sql` supplement represents all existing
membership guards (status/end date/student and class activity/label) and checks
the original active projection. It was applied only to the new owned fabricated
cluster, not to any hosted database or migration history. No new grants/RPC/policy.

**Scale limit:** global serialization and bounded full snapshots intentionally suit
only a small inactive pilot. Lock-held async Auth, snapshot transfer, operation
latency and historical capacity prevent a public-production scalability claim.
Independent current canonical resolution, real Auth and ingress still need
separate implementation/authorization before any activation.

## Original refusal, correction and owned resources

The [original refusal](../../../tests/n88-postgres-service-repository.lease-policy-denial.json)
and [initial BLOCKED assessment](../../../tests/n88-postgres-service-repository.initial-blocked.json)
retain their original FAIL/NOT_RUN: Windows PowerShell refused to load
`resource-lease.ps1` because “running scripts is disabled on this system”
(`SecurityError / UnauthorizedAccess`), before any DB/port/lease existed.
The prior empty ownership directory was left intact.

The activated 17:36 correction explicitly restored the canonical controller's
existing per-process invocation for BOTH acquire/release:
`-NoProfile -NonInteractive -ExecutionPolicy RemoteSigned -File <same helper>`.
Current run ID and source/base bookkeeping were updated. No Set-ExecutionPolicy,
registry/User/Machine/GroupPolicy/ACL/ZoneIdentifier change, Bypass/Unrestricted,
alternative host, manual/skipped lease or refused N64/N36 operation occurred.
The original refusal was not rewritten to PASS. No product module fix was needed
after the first real SQL run; only documentation/source receipt work followed.

New exclusive owned phase:
`artifacts/n88-repository-pg-d80c7450-1db7-4c65-8945-1007808c042b-91ef1233-a3dc-4f2f-b895-eab41311b9ef/`.
Loopback port 52670; master PID 26536/birth `2026-10-17T14:39:26.2516250Z`, then
28892/birth `2026-10-17T14:39:48.5081480Z` after controlled fast shutdown/restart.
Marker, PID/birth, executable, exact -D, PID-file directory/port and SQL
`data_directory`/host/port were verified. Only installed native binaries/pg client
were reused read-only; no old dataDir, default PG configuration or service.

All owned clients/pools closed. Owned `pg_ctl fast -w -t 20` stopped each server;
final exact PID absent and exact port rebound/released, integration lease released.
STOPPED checkpoint retained; no recursive deletion or substitute cleanup. Minimal
allowlisted child environment, SCRAM, query/lock/idle deadlines, fsync/synchronous
commit/full-page writes; SQL/error-statement/bind logging suppressed. Raw PINs,
private entries, session tokens and ephemeral keys/passwords were not printed.
No browser, HTTP server, personal profile, controller/queue/STOP or other worker
resource was touched. Restart proof is **controlled clean restart**, not crash or
power-loss durability.

[Scoped source receipt](../../../tests/n88-postgres-service-repository.source-checks.json)
binds the executed source hashes and unchanged current-main policy evidence,
syntax, inactive app scope and staged path/whitespace checks. Unchanged SQL/UI
proofs are reused, with no full Vite build, broad audit, UI/Preview rerun or old DDL
suite. Independent publisher alone owns source-only integration/publication.

**NOT_IMPLEMENTED / NOT_RUN:** hosted teacher Auth, current canonical membership/
publication resolver, trusted ingress, hosting/service deployment, server key
custody, frontend wiring, HTTPS/private-path/CDN log redaction, real devices,
real student access, public scale and crash/power-loss recovery. No hosted
SQL/Auth/RLS, real data/messages, subscriptions or access activation. N88 remains
OPEN; this local adapter qualification is not Product acceptance or live readiness.
