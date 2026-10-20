# N125 — operation-owned revision validation

AI-authored, 2026-10-20. Task `continuous-n125-revision-validation-actual-evidence-20261020`; run `39b4f257-9d29-4a9a-a8b9-8acb4ae1a8d4`.

Base: `01940ee3a6fe0f4c79e0ad50c9209662a7ef7517`, also observed by read-only `git ls-remote origin refs/heads/main`. The worktree started clean with no saved candidate/partial edits. Read current operating contract, activated card and canonical N125 `[PO-20261020-ACTUAL-1336]` row. This work addresses the new actual phase evidence, not a replay of previous focus/readiness checks. No queue/ledger edit, push or deployment.

## Actual observation and proved cause

PO supplied three real `revision_validation / UNKNOWN / visible` samples: 2026-10-20T10:23:13.456Z (3271ms), 10:24:01.555Z (3423ms), and 10:31:30.915Z (3401ms), associated with window switching and sequential class deletion. Those samples remain failures. Their original marker response is unavailable, so they cannot independently distinguish intentional receiver cancellation from a genuine marker transport failure.

Source composition establishes a reproducible cancellation defect:

1. An ordinary full Sync captures a valid owner marker, completes its first pull, and has no mutations requiring a post-pull.
2. Its final validation calls the advisory receiver's `check()`. That method shares in-flight polls and returns null for binding absence, intentional abort, timeout, malformed/foreign marker, and transport failure.
3. A hidden event calls `remoteSync.stop()`, releases the receiver leadership/socket and aborts the shared check. Rapid visible events enter readiness and wait for the still-active Sync to drain.
4. The cancelled advisory read returns null to that same active Sync. It throws `Remote Sync revision validation unavailable`; its safe diagnostic becomes UNKNOWN/visible despite no failed server read.

`tests/n125-revision-20261020/baseline.json` reproduces this exact coordinator composition against immutable base source with the real HTTP application, store, handlers and source CSS. A marker gate ensures the visibility transition occurs during final validation. Its diagnostic is `revision_validation / UNKNOWN / visible`. Fabricated deletions use empty teaching/section pairs with no dependent pupils, items or scores; the synthetic backend returns canonical tombstones. This is not a real account deletion or a certification of the whole Delete workflow.

## Minimal correction and safeguards

`beforeFullSync` returns a capture only while its receiver generation is still current, and binds it privately to the original owner/workspace/token key. `validateFullSync` performs a fresh, separately bounded marker read **after the completed pull**. It belongs to that full Sync operation, not the advisory receiver's visibility lifecycle. It neither opens a socket nor takes receiver leadership. Hiding still releases the advisory receiver immediately. An older in-flight periodic check cannot substitute for the final read.

The existing 5000ms marker deadline is unchanged. Owner/workspace/token and ready/proven/online context are checked before and after the read; the coordinator's existing exact session/workspace-reference and ownership checks still apply. Invalid/foreign/absent markers and regressed revisions fail closed. HTTP/Auth/network errors propagate to existing error/severity handling. Timeout, invalid marker and revision regression have finite allowlisted diagnostics. No raw provider payload, identifier or token is added to safe details. The private capture key is never included in operational diagnostics.

A later marker is only observed as a target: the earlier capture alone may be acknowledged after its completed pull. A stale generation cannot acknowledge anything. In the app scenario, a second deletion is committed after the first pull while validation is held; its tombstones are obtained by a subsequent full pull. Outbox, tombstones, durable ACK, grades, store/import behavior and owner isolation are unchanged. Harmless visibility transitions and later recovery retain the last real failure rather than replacing it with cancellation noise.

No severity change, cached session, skipped pull, reset, global debounce/deadline change, startup dependency or service/schema/Auth change. No `store.js` edit or overlap with N36. No N107 timing or speed improvement is claimed: a genuine final marker read is still required and retains its existing deadline. Broader N107 shared-wait work is outside this correction.

## Affected evidence

- PASS `node tests/n125-revision-20261020/validation.mjs`: `n125_actual_revision_validation_race_and_genuine_failure`. Actual app HTTP DOM/handlers/CSS in a fresh 390px isolated synthetic context. A held final marker survives rapid hidden/visible events. A later committed deletion requires a trailing authoritative pull; both teaching and section tombstones remain deleted, score18 and empty outbox are preserved, and owner/database are read in the same document checkpoint. Genuine HTTP503 final validation remains unhealthy/red with its original code and phase; that exact safe failure is retained through recovery and the harmless lifecycle race. Evidence: `result.json`.
- PASS `node --test tests/n125-revision-20261020/validation.test.mjs`: 17 targeted tests. Independent fresh final read versus a pre-existing poll; receiver teardown and stale-generation ACK rejection; HTTP503, HTTP403, fetch failure, foreign/malformed/absent markers, regression, unchanged deadline/abort; owner/workspace/token/readiness/proof/connectivity changes before/after the read; finite diagnostic rendering without private extras. Output: `unit-checks.txt`.
- PASS six affected existing remote capture regressions using `node --test --test-name-pattern='writer|newer concurrent|hidden workspace|signal during|full pull covers' tests/remote-sync.test.mjs`. Existing writer echo, concurrent revision, failed-capture, owner change and hidden receiver safeguards remain valid. Output: `capture-regressions.txt`. No other Sync/browser matrix was run.
- PASS JavaScript syntax checks on all changed source modules and new browser harness modules; `git diff --check`.

The first candidate harness failed: `initial-harness-timeout.json` preserves the genuine REMOTE_MARKER_TIMEOUT reached before it drove the intended visibility transition. Arming a hold before an asynchronous Playwright click allowed action scheduling to consume the real deadline. The corrected harness waits for a stable completed same-document checkpoint, then arms and invokes the actual existing DOM button in one page task. Neither the Product deadline nor failure assertions were relaxed. The final affected app scenario passed on the corrected source/harness.

The canonical `withIsolatedLocalBrowser` helper validates the active synthetic card; external requests and Service Workers are blocked. Fresh owned contexts/browser and the unique loopback server close in finally. No shared live-browser lease is required for this approved isolated phase. No personal browser, credential, real account/pupil mutation, school access, hosted fixture, service operation or full build/suite was used.

## Disposition

Local candidate readiness only. The specific reproduced cancellation cause is corrected, with genuine failures preserved. **Actual PO symptom resolution remains unproven**, and the original three failed observations are not relabelled PASS. Production served-asset verification is NOT_RUN by this worker; the sole controller/publisher owns integration and provider/served evidence. This does not close N125 or reopen unrelated CLOSED/HOLD tickets, and requests no repeated user trial.
