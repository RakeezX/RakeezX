# N88 — inactive PostgreSQL service repository draft (BLOCKED)

AI-authored. Task `continuous-n88-postgres-service-repository-20261017`; run
`ae391bc2-7990-43ad-aab2-b7726a562e8a`.
Base `98d8e7ab2905a2786461745af970f0b8f4fb9288`. Candidate is the commit containing
this document, identified by full SHA in the worker result. No push/deploy.

**Not SQL-qualified.** The canonical integration-lease helper was refused before
bind/initdb/start/connect by Windows PowerShell:

> running scripts is disabled on this system

`SecurityError`, `FullyQualifiedErrorId: UnauthorizedAccess`, loading
`C:/Users/Abody/Projects/RakeezX/scripts/ops-supervisor-v4/resource-lease.ps1`.
No alternate host, execution-policy change, inline replacement, lease-file write,
or unchanged retry was attempted. The current worker shell's read-only policy
inspection reports RemoteSigned; that does not establish permission to reroute
the refused child-host action. No controller/queue/STOP/config/ACL change.

[Original attempt](../../../tests/n88-postgres-service-repository.lease-policy-denial.json)
is preserved verbatim, including its original FAIL and unrun gates.
[Current factual assessment](../../../tests/n88-postgres-service-repository.result.json)
records the denial, subsequent source hashes/syntax checks and actual resource
disposition. Its cleanup assessment does not relabel the original run PASS.

## Prepared source and intended contract

`drafts/n88-student-portal/postgres-repository.mjs` implements the existing async
`repository.transaction(callback)` interface without editing `service.mjs`.
It requires an explicitly injected exclusive pg-compatible acquire/release port,
per-table/aggregate row and byte limits, and lifecycle/acquisition/cleanup/query/
lock deadlines. It has no driver import, connection default, SQL execution API,
credential discovery, memory fallback, automatic retry or app import.

A fixed two-integer transaction-owned global advisory lock precedes snapshot
reads. All cooperating writers, including fabricated membership/publication
writers, must take that same lock. This deliberately serializes **all owners and
global guessing budgets**, including the existing asynchronous teacher-auth wait.
It is a bounded private pilot design, unsuitable for public production scale;
the global throughput bottleneck, snapshot cost and lock-held auth latency require
a different service contract before scaling. Noncooperating writers are outside
its guarantees. No owner/source is inferred from request metadata.

Each read uses `LIMIT bound+1`, explicit columns and aggregate remaining row
capacity. Server-side JSON/text-size sentinels bound row/remaining-byte transfer;
oversize is rejected rather than truncated into a successful snapshot. Strict
mapping covers canonical UUIDs, booleans, safe positive bigint versions/revisions,
nonnegative exact millisecond timestamps (1970 through year 9999), nulls, ISO
dates, bounded strings and exact source JSON fields. Limits apply to the complete
snapshot, including historical credential tombstones; filling it denies admission,
never recycles old PINs. SQL is parameterized with fixed internal identifiers.

The callback receives a separate operation-local draft. A wall-clock deadline
covers acquisition, callback, diff/flush and commit acknowledgement. Fences and
detachment are intended to prevent late callbacks from flushing into a later
operation; failure runs bounded rollback and destroys the affected pool client.
Late-acquired leases are destroyed. Callbacks must cooperate with the Node event
loop: an in-process deadline cannot interrupt CPU-blocking trusted code. The pool
must independently bound physical connections/queue and implement synchronous
`release(error)` destruction. These contracts still need the actual SQL tests.

Diff ordering removes dependent sessions/publications before parents; inserts
parents before children and revokes old credentials before replacements. Existing
credential keys/verifiers/versions cannot be changed or deleted/unrevoked.
Session scope/version cannot be changed in place. Callback exceptions roll back;
ordinary 401 return values commit guessing debits. Success requires an acknowledged
`COMMIT` command, including rejecting a PostgreSQL `ROLLBACK` command tag.
Lost acknowledgement is generic failure with **no replay or credential reissue**;
the database may already have committed. Such a result needs independent bounded
disposition before a human issues another credential.

`postgres-repository-schema.sql` is a separate **unapplied local supplement** to
the unchanged previously qualified `schema-proposal.sql`. It stores every guard
already used by the service: membership status, end date, student/class active
flags and label, with consistency against the original active projection.
It is not a hosted migration, canonical membership resolver, grant or RLS policy.

## Prepared qualification, not executed acceptance

`tests/n88-postgres-service-repository.mjs` reuses the native N88/N44 ownership
protocol and existing PG17.6/Node pg binaries read-only. It prepares a new exclusive
owned directory, strict minimal child environment, OS-assigned loopback port,
PID/birth/executable/exact `-D` checks, server data-directory readback and bounded
connections. Its finally closes owned pools/clients, uses owned `pg_ctl fast -w`,
checks PID absence/port rebound and releases the acquired integration lease.
Those cluster/cleanup steps were **NOT_RUN**, because acquisition failed first.
No HTTP/browser resources are needed for this repository-only change.

`tests/fixtures/n88-postgres-service-repository/cases.mjs` instantiates the actual
unchanged `createPortalService` with the new adapter and explicit fabricated
teacher/ingress/crypto/time ports. Prepared cases cover issue/claim/read/publish/
rotate/revoke and commit fences; observed advisory contention between independent
pools; collision/tombstone reservation; source/context/global attempt/failure
budgets and debit-before-sensitive-lookup; exact owner/entry/session/version/
membership/projection denial; second-term identity and lifecycle races; callback,
flush, aborted-commit, uncertain-commit and delayed-callback/acquisition/commit
faults; capacity/type/retention checks; controlled stop/restart with new pool and
actual persisted reads. **None of these is reported PASS.**

| Required check | Actual status |
| --- | --- |
| `n88_real_postgres_repository_runs_actual_portal_issue_claim_read_publish_revoke` | NOT_RUN — lease prerequisite refused |
| `n88_two_service_sql_budget_serialization_term_identity_rollback_and_restart` | NOT_RUN — no SQL connections |
| `n88_owned_cleanup_bounded_inactive_port_honest_hosted_auth_and_privacy_limits` | NOT_RUN — no cluster qualification |

`node --check` passed for repository, runner and fixture. Scoped source/evidence
binding checks and staged whitespace/path checks are recorded separately. They
are not SQL, rendered-UI, Auth or hosting acceptance. No broad build, old DDL
suite, all-9,000 memory issuances, repeated UI or Preview was run.

[Scoped source checks](../../../tests/n88-postgres-service-repository.source-checks.json)
record seven unchanged normalized-LF SHA256 bindings against both the activated
base and freshly fetched origin main `197a1750ab1e7da57906a68886449a9de32669f8`.
The prior native result and final-policy browser checks remain PASS for their
original scope. These checks also confirm the new module has no normal runtime
import and the owned phase directory contains only `owner.json`.

The service, original schema and memory adapter remain unchanged. Existing final
1000..9999/stable-second-term policy and the prior native SQL/browser evidence
are retained; their different implementations do not certify this new port.
No normal app/router/SW/schema deployment import was added.

## Resource disposition and retry condition

Retained ownership-only directory:
`artifacts/n88-repository-pg-ae391bc2-7990-43ad-aab2-b7726a562e8a-63ca5879-67ce-488c-ac6a-bba1a260b165/`.
Read-only inspection confirms its data directory is absent. No server/port/client/
pool or lease was acquired, so no PostgreSQL stop or PID-absence test applies.
No recursive deletion was attempted. Prior recursive-cleanup refusals remain
binding; no old cluster/data/port or another worker's resources were touched.

Retry only after an **approved canonical integration-lease execution route under
existing policy** is established. Resume this exact candidate/session and qualify
the port on a new owned synthetic cluster; preserve the original refusal. Do not
change execution policy or bypass a tool denial to obtain a PASS.

**NOT_IMPLEMENTED / NOT_RUN:** hosted teacher Auth, current canonical membership/
publication resolver, trusted ingress, hosting/service deployment, key custody,
frontend wiring, HTTPS/private-path log redaction, real student access, public
scale and crash/power-loss recovery. No hosted SQL/Auth/RLS, real identity/data,
messages, subscriptions or access activation. The independent controller alone
owns source publication; N88 remains OPEN and is not ready for real students.
