# N123 — measured bounded Sync read overlap

AI-authored candidate for task `continuous-n123-sync-latency-measured-20261019`, run `02cae405-94c0-43f3-ae42-abbd0c4c7c74`.
Base and observed origin/main: `210cce3813b4cf1b45269f671d87fb5221076ab2`.
Latest canonical Product row: N123 IN_PROGRESS, PO19October actual timing complaint; N111 first-tap success must remain.

## Change and cause

The full coordinator performed independent table reads serially on ordinary open/manual/return paths. The existing V2 engine already supports groups of up to four network reads, followed by reconciliation in original dependency order. Enable that existing bounded reader on both coordinator pulls. Dispatch remains between the two completed pulls; atomic score snapshots, ownership checks, mutation ordering, revisions, receipts, retries and deletion exclusion are unchanged. No new startup dependency or service change.

## Same-condition comparison

`tests/n123-review-1400-browser.mjs` serves the actual index, application modules and CSS over an owned loopback HTTP server. It serves immutable base `sync.js` for baseline and the working candidate for comparison. Each uses a fresh disposable 390×844 touch context, the existing account/lease fixture and actual store/coordinator/ownership guard. HTTP fixture table reads each wait 80ms; identical records and 48 reads per full pass, comprising both pulls. No external service or real data is used. Engine limit is four; observed server overlap was one before and three after because browser socket scheduling can use fewer than the limit.

| Scenario | Base ms | Candidate ms |
| --- | ---: | ---: |
| Full coordinator used by open/manual refresh | 4629.7 | 1244.6 |
| Actual pageshow return listener, 48 new reads | 4570.5 | 1235.7 |
| Single-store edit including deliberate ACK hold | 257.6 | 245.8 |
| Active full Sync start to class-delete commit request | 4591.1 | 1384.3 |

This small sample shows removal of serial request waiting, not a network/server performance promise. The single-store edit has no demonstrated material speedup. Full cold startup and a persisted account reload were not separately timed; their shared full coordinator was measured. There is no Production performance claim.

## Affected proofs

- PASS required `n123_measured_sync_latency_and_true_ack_recovery_preserved`: actual account store edit remains in durable outbox and cloud health remains false while receipt is held. Actual first-tap class-delete DOM handler drains an active full pass; selected teaching stays live and confirm disabled until deletion receipt, then selected teaching/grade tombstone while unrelated grade remains 18.
- PASS wrong ACK/recovery: mismatched mutationId returns false and retains the command; retry uses the same mutationId and clears only after canonical receipt. Foreign account identity sends zero reads/writes and returns false.
- PASS four existing engine tests: bounded reads with original reconciliation order; malformed/rejected read evidence; owner change during in-flight reads applies nothing; concurrency clamp/default compatibility. Command: `node --test --test-name-pattern='bounded|owner identity change while' tests/sync-v2-client.test.mjs` (4/4).
- PASS `node --check src/lib/sync.js` and `git diff --check`.
- FAIL, preserved existing Node harness limitation: selected `sync-v2-runtime.test.mjs` run had 3 passes and 2 failures. Both coordinator cases throw `ReferenceError: localStorage is not defined` in `cloud.js:1106`, before the affected reads. A read-only loader serving immutable base `sync.js` reproduces the same 2/2 failures: `node --import ./tests/fixtures/n123-review-1400/baseline-loader.mjs --test --test-name-pattern='V2 coordinator performs|runtime automatic/manual' tests/sync-v2-runtime.test.mjs`. These are not represented as PASS; actual-browser account proofs above cover the affected coordinator behavior with real browser storage.

Raw final measurements and checks: `tests/n123-review-1400-browser.json`. Initial harness failures remain in `n123-review-1400-initial-harness-failure.json` (Demo-to-account fixture omitted account Sync listener initialization) and `n123-review-1400-concurrency-harness-failure.json` (incorrectly demanded exactly four concurrent HTTP requests rather than the bounded limit). Corrected fixture explicitly initializes the real listener, measures new return reads with a bounded in-document checkpoint, and accepts actual overlap within the cap. Product code was not changed to accommodate these harness corrections.

## Resources and delivery

Canonical `withIsolatedLocalBrowser` verified the active task/run identity, blocked external requests/Service Workers and closed its owned contexts/browser in finally. The ephemeral task-owned server closed in finally. No shared/live browser lease is needed under the approved local synthetic exception. No push, deployment, queue/ledger edit, live mutation or service operation was performed. The independent publisher owns integration and Production evidence; this result is local readiness only.
