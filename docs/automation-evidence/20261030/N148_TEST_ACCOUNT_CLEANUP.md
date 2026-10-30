# N148 exact account cleanup — blocked by deployed immutable guards

AI-authored implementation/evidence; observed 2026-10-30, approximately 16:59 Asia/Riyadh.

- Task: `continuous-n148-test-account-cleanup-20261030`
- Run: `6adc0bfe-5fc8-45b3-98d2-b4c89f089442`
- Base: `571fc483d711780af666be4926c80ab00eeaba91`
- Project: `xlrubcwjqktzzunrvuns`
- Authority: `PO-20261030-EXACT-TEST-ACCOUNT-HARD-DELETE`
- Pinned private selection SHA256: `b671dc27a08c9553df385ef15c340801df4581a4a44b378f8698b5e5bec947e9`

## Actual result

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

## Checks and retained evidence

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

## Bounded implementation and continuation

The generic manifest-input utility implements pinned selection guards, aggregate protected snapshots, an inspection mode and the lease-owned rollback probe. It deliberately has **no committing cleanup mode** while these deployed guards prohibit the requested outcome. This is partial implementation, not a completed hard-delete executor. No frontend, migration, schema, RLS, role, function or provider configuration changed. No temporary function was deployed or disarmed; no such function operation is named in this card's authority. No accounts were provisioned, no messages sent, and no main/Production publication performed.

The metadata review also recorded submissions-before-assignments/students, report self-FK and RESTRICT term/year dependencies, restore receipts-before-stages, slots-before-terms, and owner-bearing tables without direct Auth FKs. Resolving their deletion order cannot bypass the unconditional guards above. Full child/reference closure and an atomic committing executor remain unimplemented and unverified; they must be completed before any future permanent deletion.

**Retry condition:** a separately authorized, guard-compatible service disposition must address the N88 immutable numeric reservations/receipts, closed-term report immutability and selected-calendar retirement restrictions. The present card explicitly forbids altering those functions/triggers/contracts, so it cannot perform that repair. Preserve this candidate and private selection; do not retry the same deletion or partially delete other targets. Any later authorized implementation must revalidate current state, finish FK/non-owner reference coverage, and prove all protected rows unchanged inside its committing transaction. The publisher cannot resolve this through a frontend deploy.

Documentation consulted: [Supabase user management](https://supabase.com/docs/guides/auth/managing-user-data) and [Supabase changelog](https://supabase.com/changelog). CLI command syntax was verified with installed `db query --help`; no CLI upgrade was performed.
