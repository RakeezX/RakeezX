# N148 exact account cleanup — committed and read back

AI-authored implementation and evidence. Current result observed 2026-10-30 at approximately 17:25–17:27 Asia/Riyadh.

- Task: `continuous-n148-test-account-cleanup-20261030`
- Current run: `bf1599c0-e38d-4c04-9c7c-0d839681171d`
- Base: `571fc483d711780af666be4926c80ab00eeaba91`
- Preserved first candidate: `34b5860e71b8b40e0d25f16df8d0b329b59d7aa3`
- Project: `xlrubcwjqktzzunrvuns`
- Authority: `PO-20261030-EXACT-TEST-ACCOUNT-HARD-DELETE`, including the activated card's explicit corrective transaction-only suspension allowlist.
- Private manifest SHA256 remains `b671dc27a08c9553df385ef15c340801df4581a4a44b378f8698b5e5bec947e9`.
- Canonical card explicitly observed `model=gpt-6.1-sol`, `effort=medium`; no active session, runner settings or global configuration changed.

## Current outcome

**The exact 50 selected Auth accounts and their targeted live database dependency closure were permanently deleted in one committed transaction.** All six other accounts, including the explicit exception, remain. Their 927 student rows and all protected row counts/fingerprints remain unchanged.

The original `P0001 n88_numeric_unavailable` failure is preserved below. It was not retried as a probe. The materially corrected card permitted named administrative trigger suspension only inside the cleanup transaction. The implementing utility now provides preparation and committing execution modes with a pinned manifest, current run/lease checks and no reusable unrestricted administrator operation. A completed execution cannot pass the original 56-account precondition again.

## Transaction safeguards and actual result

1. Acquired the canonical `live-mutation` lease for the current task/run and read back its exact ownership.
2. Acquired normal table locks in a consistent sorted order before final live selection and baseline checks. The locks excluded concurrent row writes during suspension and protected comparisons. Live columns and inbound FK definitions were pinned to the inspected metadata.
3. Revalidated all 56 distinct IDs, the exact 50/6 partition, live selector equivalence, the exception and 2149/927 student counts. Frozen credential, numeric/Auth session, MFA, flow and email references kept child predicates valid after parent deletion.
4. Captured 92-table protected counts/fingerprints, all 795 affected trigger definitions/states/function identities and all 557 affected constraint definitions/states. No row payloads or credential values were exported.
5. Suspended exactly ten necessary named allowlisted triggers: N88 numeric tombstones, class receipts and code recovery; closed-term report immutability; N58 calendar-contract guards on years/calendars/days/terms; and calendar/term revalidation. The allowlisted restore-marker trigger had no target rows and stayed enabled. All other triggers and every FK/constraint remained enabled and enforced.
6. Deleted only the exact target closure in child-first order. Recovery rows used the frozen 45 credential IDs; report self-FKs were removed leaf-first. Submissions preceded assignments/students, slots preceded terms, and restore receipts preceded stages. Shared rate/nonce records and other non-target data were preserved.
7. Forced deferred constraints immediate, restored each suspended trigger's original mode, and asserted exact original definitions, function identities and states. Checked every enumerated target predicate was zero and every protected count/fingerprint unchanged before COMMIT.
8. After actual COMMIT, executed the generated independent read-only verification SQL. It passed all target-zero, protected-data and restored-guard assertions. A separate exact-target-ID scan across all 92 scoped tables found **zero remaining target-ID references**, including non-owner child/shared tables. The owned lease was released; its absence was observed.

Initial target rows removed, grouped by schema (excludes rows transiently created by retained normal Sync triggers during this transaction):

| Scope | Initial target rows removed |
| --- | ---: |
| `auth` including the 50 users | 213 |
| `rakeezx` | 14488 |
| `n88_private` | 1319 |
| `n44_push_draft` | 14 |
| Exact target owner topics in `realtime.messages` | 7 |
| Storage ownership | 0; no Storage mutation |

The retained normal Sync triggers produced target-only invalidation records during deletion. The transaction drained 9070 records from the exact targeted owner topics, including the seven pre-existing records; other topics remained fingerprint-equivalent. No teacher email/WhatsApp/push/support message operation was invoked. No identity was provisioned or reactivated.

Selected acceptance counts:

| Table/reference | Target before → after | Protected before → after |
| --- | --- | --- |
| Auth users | 50 → 0 | 6 → 6 |
| Auth identities | 50 → 0 | 6 → 6 |
| Auth sessions | 20 → 0 | 15 → 15 |
| Auth refresh tokens | 66 → 0 | 116 → 116 |
| Auth one-time tokens | 7 → 0 | 1 → 1 |
| Auth MFA AMR claims | 20 → 0 | preserved by fingerprint |
| Student rows | 2149 → 0 | 927 → 927 |
| Numeric credentials | 45 → 0 | 7 → 7 |
| Code-recovery children | 45 → 0 | 7 → 7 |
| Class credential receipts | 11 → 0 | 5 → 5 |
| Closed-term reports | 6 → 0 | 0 → 0 |
| Support requests / notification outbox | 4 / 4 → 0 / 0 | preserved by fingerprint |

## Affected checks

| Check | Current result | Evidence |
| --- | --- | --- |
| `n148_exact_selection_and_kept_accounts_guard` | PASS | Pinned manifest, exact selectors/IDs and exception verified inside the locked transaction before any suspension or DML. |
| `n148_live_hard_delete_and_dependent_data_zero` | PASS | Actual committed deletion, independent frozen-reference readback, and zero exact target-ID references across 92 tables. |
| `n148_kept_accounts_and_data_unchanged` | PASS | Protected row counts and aggregate fingerprints match before COMMIT and after COMMIT; all six accounts and the exception preserved. |
| Trigger/function/constraint restoration | PASS | All 795 trigger records/function definitions and 557 constraint records equal their original captured state. Ten named suspensions restored; no persistent schema/function/RLS/role changes. |
| Local SQL/utility correctness | PASS | Syntax check plus five targeted Node tests. Existing PGlite executes the actual generated SQL against synthetic child-FK/immutable-guard fixtures, verifies seven recovery rows survive, checks frozen post-commit readback, and proves a protected-child modification rolls back all deletions and trigger-state changes. No new framework or dependency. |

One corrected current-attempt service failure is retained: `42703: column r.request_email does not exist` during the initial baseline snapshot in `atomic-cleanup-juWsdj`. No suspension/DML had occurred. The observed schema uses `for_email`; source and synthetic fixture were corrected. Independent state readback confirmed 56 users, 52 numeric credentials, 52 recovery rows and no changed trigger modes before the corrected execution. The successful transaction is a separate immutable evidence record, not a relabeling of that failure.

## Private proof and independent verification

All raw SQL, selectors, IDs, frozen child references, aggregate fingerprints and CLI results remain in the ignored card-owned intake directory. No private values belong in Git or public logs.

- Successful execution: `atomic-cleanup-lBHJhQ/transaction.sql`, `transaction.json`, `committed-readback.sql`, `committed-readback.json`, `summary.json`.
- Independent reference scan: `final-exact-id-residual-scan.sql` / `.json` at the intake root.
- Corrected baseline failure and its state reconciliation: `atomic-cleanup-juWsdj/transaction.stderr` and `after-baseline-failure.json`.
- Original rollback-only rejection: `guard-check-ctEmcX/rollback-probe.stderr`; its prior evidence remains below.

The controller can independently run **only the read-only** `committed-readback.sql` or reference-scan SQL through the existing linked CLI to verify the saved result. Do not repeat `--execute`, provision replacement accounts, or replay old deletion probes. The public candidate contains only the generic utility, synthetic tests and this aggregate report. No main/Production push, frontend deployment, migration, function deployment/disarm or provider configuration operation was performed.

Deleting sessions/refresh tokens prevents those deleted identities from refreshing through the removed sessions. This evidence does not assert immediate invalidation of previously issued stateless access JWTs, removal of historical provider backups, Product PO acceptance, or publisher delivery.

## Exact snapshot scope

- **auth**: `audit_log_entries`, `flow_state`, `identities`, `mfa_amr_claims`, `mfa_challenges`, `mfa_factors`, `mfa_recovery_code_sets`, `mfa_recovery_codes`, `oauth_authorizations`, `oauth_client_states`, `oauth_consents`, `one_time_tokens`, `refresh_tokens`, `saml_relay_states`, `scim_users`, `sessions`, `users`, `webauthn_challenges`, `webauthn_credentials`.

- **n44_push_draft**: `budgets`, `contexts`, `deliveries`, `endpoint_claims`, `events`, `ingress_nonces`, `ingress_rates`, `owner_clock`, `registrations`.

- **n88_private**: `class_credential_receipts`, `class_visibility`, `code_recovery`, `contexts`, `credentials`, `guess_budgets`, `ingress_receipts`, `memberships`, `numeric_attempts`, `numeric_credentials`, `numeric_rates`, `numeric_sessions`, `publications`, `sessions`, `task_guidance`.

- **rakeezx**: `account_access_grants`, `assignments`, `attendance`, `calendar_days`, `calendars`, `class_charter_selections`, `class_goals`, `class_rules`, `closed_term_reports`, `curriculum_sync_bootstraps`, `education_departments`, `enrollments`, `group_arrangements`, `items`, `lessons`, `logs`, `n58_foundation_repair_receipts`, `n58_restore_transactions`, `notes`, `owner_sync_changes`, `profile`, `score_distribution_plans`, `score_domain_receipts`, `score_subitem_completions`, `score_subitems`, `scores`, `sections`, `session_roster_snapshots`, `sessions`, `slots`, `student_lifecycle_receipts`, `students`, `subjects`, `submissions`, `support_notification_outbox`, `support_requests`, `sync_mutation_receipts`, `sync_restore_receipts`, `sync_restore_stages`, `teachings`, `terms`, `time_profiles`, `units`, `years`.

- **realtime**: `messages`.

- **storage**: `buckets`, `objects`, `s3_multipart_uploads`, `s3_multipart_uploads_parts`.

## Preserved historical first attempt — superseded scope/status

The following original BLOCKED record and its retry condition describe the first attempt under the earlier, narrower card. They remain historical evidence; the corrected authority and committed result above supersede that status.

### N148 exact account cleanup — blocked by deployed immutable guards

AI-authored implementation/evidence; observed 2026-10-30, approximately 16:59 Asia/Riyadh.

- Task: `continuous-n148-test-account-cleanup-20261030`
- Run: `6adc0bfe-5fc8-45b3-98d2-b4c89f089442`
- Base: `571fc483d711780af666be4926c80ab00eeaba91`
- Project: `xlrubcwjqktzzunrvuns`
- Authority: `PO-20261030-EXACT-TEST-ACCOUNT-HARD-DELETE`
- Pinned private selection SHA256: `b671dc27a08c9553df385ef15c340801df4581a4a44b378f8698b5e5bec947e9`

#### Actual result

**BLOCKED. No permanent deletion committed.** All 50 target Auth users remain. All six protected users, including the exception, remain. Target/protected student counts remain 2149/927.

The existing official Supabase CLI successfully queried live ownership, columns, foreign keys and enabled trigger definitions using its existing authenticated Management API access. No credentials were read or exported. Current documentation confirms direct `auth.users` deletion is supported, but deployed application guards independently prohibit the requested dependent-row deletion.

Read-only inspection found these unconditional deletion blockers on actual targeted rows:

| Table | Target rows | Enabled guard |
| --- | ---: | --- |
| `n88_private.numeric_credentials` | 45 | `numeric_tombstones` raises `n88_numeric_unavailable` on DELETE |
| `n88_private.class_credential_receipts` | 11 | `class_receipts_immutable` raises `n88_class_unavailable` on non-INSERT |
| `rakeezx.closed_term_reports` | 6 | `closed_term_reports_immutable` raises `Closed-term report sets are immutable` |

Ten targeted years also have a selected calendar preset; the current N58 calendar guard prohibits hard deletion of a selected year. No guard has been modified or disabled.

After acquiring the canonical `live-mutation` lease and independently reading back its task/run ownership, the utility attempted **one rollback-only transaction**, revalidated the exact live selection, and issued an owner-restricted DELETE against `n88_private.numeric_credentials` as its first DML. The actual service response was:

```text
unexpected status 400
ERROR: P0001: n88_numeric_unavailable
CONTEXT: PL/pgSQL function n88_private.numeric_tombstone_guard() line 3 at RAISE
```

The transaction aborted; it contains no COMMIT even if a future guard allowed the statement. No preceding dependent-row deletes were performed. The owned lease was released in `finally`; absence of the lease file was observed after completion. This is a real service rejection, not a missing-path or CLI-access defect. No unchanged retry was made.

#### Checks and retained evidence

| Check | Result | Evidence |
| --- | --- | --- |
| `n148_exact_selection_and_kept_accounts_guard` | PASS | Manifest digest, project, authority, 56 distinct partitioned IDs, 50 targets, six keep IDs, exception, live domain/email selector equivalence to exact IDs, and 2149/927 student counts validated before and after the probe. |
| `n148_live_hard_delete_and_dependent_data_zero` | FAIL | Actual guard rejection above. All 50 targets remain; dependent data is not zero. No cleanup/disarm success is claimed. |
| `n148_kept_accounts_and_data_unchanged` | PASS | Before/after totals, target counts, protected counts and protected-row aggregate fingerprints match across 69 tables: all 68 tables in the three application schemas plus `auth.users`. Six keep users and the exception remain. |
| Targeted local utility checks | PASS | `node --check scripts/n148-test-account-cleanup.mjs`; `node --test tests/n148-account-cleanup.test.mjs` — three tests cover exact partition/exception/digest/project rejection, rollback-only SQL and protected comparison failures. These are utility checks, not deletion acceptance. |

Separate live Auth readback matched pre-probe counts:

| Auth table | Targets remaining | Protected remaining |
| --- | ---: | ---: |
| `users` | 50 | 6 |
| `identities` | 50 | 6 |
| `sessions` | 20 | 15 |
| `refresh_tokens` | 66 | 116 |
| `one_time_tokens` | 7 | 1 |
| `flow_state` | 0 | 0 |

Storage object ownership was zero for both groups on initial live inspection. No storage operation was attempted. Outstanding stateless access JWTs were not separately invalidated; no session/token deletion succeeded.

Private raw metadata, SQL, CLI results and fingerprints are retained under the card's intake directory. The rollback execution directory is `guard-check-ctEmcX`; `summary.json`, `before.json`, `after.json`, `rollback-probe.stderr`, `readback.sql` and `after.sql` allow the controller to inspect or independently repeat the **read-only** result queries. Additional Auth readback is `final-auth-readback.json`/`.sql` at the intake root. They contain private selectors/identities and must not be published. The intake directory was initially untracked rather than ignored; an exact repository-local `info/exclude` entry now protects it, and the utility checks private-directory exclusion before writing evidence. No global configuration, ACL or tool rule was changed.

#### Bounded implementation and continuation

The generic manifest-input utility implements pinned selection guards, aggregate protected snapshots, an inspection mode and the lease-owned rollback probe. It deliberately has **no committing cleanup mode** while these deployed guards prohibit the requested outcome. This is partial implementation, not a completed hard-delete executor. No frontend, migration, schema, RLS, role, function or provider configuration changed. No temporary function was deployed or disarmed; no such function operation is named in this card's authority. No accounts were provisioned, no messages sent, and no main/Production publication performed.

The metadata review also recorded submissions-before-assignments/students, report self-FK and RESTRICT term/year dependencies, restore receipts-before-stages, slots-before-terms, and owner-bearing tables without direct Auth FKs. Resolving their deletion order cannot bypass the unconditional guards above. Full child/reference closure and an atomic committing executor remain unimplemented and unverified; they must be completed before any future permanent deletion.

**Retry condition:** a separately authorized, guard-compatible service disposition must address the N88 immutable numeric reservations/receipts, closed-term report immutability and selected-calendar retirement restrictions. The present card explicitly forbids altering those functions/triggers/contracts, so it cannot perform that repair. Preserve this candidate and private selection; do not retry the same deletion or partially delete other targets. Any later authorized implementation must revalidate current state, finish FK/non-owner reference coverage, and prove all protected rows unchanged inside its committing transaction. The publisher cannot resolve this through a frontend deploy.

Documentation consulted: [Supabase user management](https://supabase.com/docs/guides/auth/managing-user-data) and [Supabase changelog](https://supabase.com/changelog). CLI command syntax was verified with installed `db query --help`; no CLI upgrade was performed.
