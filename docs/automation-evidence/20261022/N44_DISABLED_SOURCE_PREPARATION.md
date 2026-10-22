# N44 â€” inactive native44 disabled recovery

AI-authored for `continuous-n44-disabled-source-preparation-20261022`, run
`fadd3490-e38e-47f4-b35b-d0bc72a48622`. Base:
`edcf95091475096cc40f546d2b07e4840a81a242`. Source-only LOCAL_READY.

## Causal result

The retained native44 public readback identifies version44, source-exact SHA-256
`0e1a86d8e64fbfdeb294044a9809cd9f33a7ee44ffc2a48b14687716e1141fe7`.
It is the register503-composition source associated with published source-stage
`019487f174d6b2bb4aaeaf3dc41d8472216e468b`, not the stale bcf40dcf backend alone.
No provider was consulted. The original immutable source and receipts remain intact.

Executing this actual bundled composition with fabricated Auth/context/PG/crypto
reproduced `disabled` for a fresh ID behind a fully revoked same-device identity.
The one-site pinned-source transform admits that fresh ID and leaves the tombstone
unchanged. It conservatively denies all other-device/workspace histories within
this one-device recovery and retains the existing rejection of old-ID reuse.
A second focused source defect was demonstrated: a valid approval can expire while
the snapshot loads. Admission now rechecks the original approval against locked
transaction time without changing expiry policy or creating a second snapshot.
These are source defects, **not proof of the actual hosted disabled subcause**.

## Affected checks

`tests/n44-disabled-recovery-20261022/result.json`: **31 focused cases PASS**, Deno
2.2.12, cached-only with no net/env/run permissions. The retained startup suffix is
removed only in memory for test exports, fingerprinted, and never invoked. All
backend/AuthClient/repository composition code otherwise runs from the exact bundle.
The fixed historical clock permits testing the retained approval; it grants no
present-day authority.

- `n44_source44_identity_and_disabled_branch_reproduction`: original receipt/source
  identity, original obstruction, clean control, expired approval, delayed expiry,
  positive corrected fresh-ID and multiple-retired-ID cases.
- `n44_same_device_retired_identity_and_consumed_budget_denials`: old-ID reuse,
  active/expired-active/dead/invalid-uncertain/residual-material rows, foreign scope,
  owner/session/device/workspace mismatch, missing/stale consent, six-write cap,
  global endpoint collision, idempotent retry and unknown COMMIT. An invalid
  registration state `uncertain` fails repository validation; a separately valid
  **uncertain delivery** with a revoked parent remains untouched. New registration
  does not reset the total send marker; the exact unchanged oneDeviceGuard denies
  a consumed attempt even under another runId. Registration alone is not a send.
- `n44_inactive_candidate_preserves_source44_single_snapshot_and_no_live_operations`:
  byte-exact reversible one-site transform, wrong-source refusal, one snapshot and
  35 queries in the positive bundled case; old source graph/startup and all other
  bytes retained. Node syntax checks PASS for transform, test and full transformed
  source streamed in memory. No browser/server lease was needed or acquired.

Reused unchanged prior 50â†’35, crypto and SQL evidence; no huge matrix, build,
Preview or hosted rerun. The prior corrected composition receipt is linked and
fingerprinted in result.json; its success case remains 35 queries/one snapshot.
The fake PG records calls and models fixed rows, not a new real transaction or SQL
certification. Unknown COMMIT remains non-ACK; original failure evidence is retained.
The first new harness invocation failed before loading the source because Deno
does not provide global Buffer; an explicit node:buffer import corrected the harness.
The subsequent 28-case pass was extended by the materially affected expiry and
uncertain-delivery cases, producing the final 31-case pass.

Manifest file fingerprints use normalized LF, matching committed Git source.
The first post-commit fingerprint assertion caught the Windows CRLF representation
of the new harness; the manifest encoding was made explicit and corrected without
changing the qualified code or repeating unchanged tests.

## Scope and later work

The resulting in-memory source SHA-256 is
`18afb81db82b76929278ffe7f024b84c68b546d23ff814d2aeb5c46ea1834513`.
Only an inactive transform, its manifest/instructions, fabricated tests and this
evidence are candidates for source-only publication. No original file, private
custody, SQL/Auth/RLS, runtime flag, source pin, approval window, budget, journal,
send, cron or service identity was changed. No push/deploy/provider operation ran.

The [inactive package prerequisites](../../../drafts/n44-push/activation/disabled-recovery-20261022/README.md)
retain original-custodian custody, valid renewed authority through a separate scoped
decision, reconciled attempt/cleanup state and exact service identity verification.
The generic frontend publisher cannot substitute for those service steps.
The old actual-device task remains blocked; the old window remains expired. Last
recorded general push/cron OFF is historical, not freshly observed. Actual
registration, original503 cause, OS arrival, Production delivery and N44 closure
are not acceptance results of this work.
