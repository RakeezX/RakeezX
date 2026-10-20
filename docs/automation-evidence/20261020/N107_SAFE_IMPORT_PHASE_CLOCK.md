# N107 safe same-document import phase clock

Task `continuous-n107-safe-import-phase-clock-20261020`  
Run `6e3bdfb7-e5c4-42c9-90c3-246e8345caa2`  
Base `fc127d275c3e2e762e3b42ce0c3ac9fc5ade9fcf`.

**LOCAL_READY: observation/UX only, not a speedup.** The existing import panel now contains one collapsed Arabic duration detail, with optional user-click copy of a strictly allowlisted summary. The next ordinary import can expose time spent preparing locally, waiting for required creation revisions, requesting/confirming maxima, requesting/confirming the durable grade receipt, and reviewing/finalizing the result. Actual reported18s remains unchanged and unexplained; no current measurement is retroactively reconstructed and no real import is requested as a test.

Read canonical operating contract, active card/current N107 row and affected view/store entry paths; used rakeez-ticket-router/evidence-manifest. The prior NO_CHANGE candidate `c013ff7c04acb0e619f07047461c54fac154bf47` and its limited trace are preserved, not relabelled or published as a fix. This work uses its newly admitted serialized view scope after N36; existing N36.18 setup/import behavior remains intact. No N125 focus case or accepted CLOSED scope was reopened.

## Implementation and truthful boundaries

Only `src/views/class-import-center.js` changes Product code. No new module/import, stylesheet, startup dependency or Service Worker change is needed. No store, Sync, transport, command envelope, receipt, retry, timeout, cancellation, staleness, scoring or owner/lease validation code changed.

A module-private clock is tied to the exact transfer object, workspace object, current session and route. It uses `performance.now()` and records at most8 finite phase segments, with bounded rounded durations/aggregate counts. It is never attached to transfer/device/continuation data passed to persistence. Local preparation starts inside the existing accepted confirmation action; required creation waiting starts at `waitForCreation`; maximum/grade durations wrap the existing guarded store calls. Local result-review/finalization spans are separate. The maximum ends only on return of `confirmImportMaximums`; the grade phase ends only after the existing `confirmGradeImport`/receipt-recovery return. Completed is set alongside the existing actual success state after continuation cleanup, not inferred from time, an empty Outbox or global Sync green. This measures the logical result event, not compositor/paint latency. Repeated brief finalization segments are bounded observations around review and completion, not repeated Product actions.

Same-destination grade imports and explicit receipt retry use the same clock entry; success aggregate counts come from the existing confirmed success counts. Names-only paths show local preparation/action completion and do not invent creation/max/grade ACK phases that were not awaited. A rejected/unconfirmed action ends as the finite uncertain status without copying its exception text. The clock never dispatches work or renews an approval.

The details are collapsed by default. Opening/closing and optional copying render a fresh monotonic snapshot; there is **no polling/ticking timer**. Plain UI text says values refresh when details are opened/copied and are not a global Sync-success indicator. User flow requires no new action to save or complete an import. Clipboard refusal produces a fixed local toast; it does not change the operation or bypass browser permissions.

The support JSON is constructed explicitly from these fields only:

- version1; segment `attempt` or `continuation`; status `running`, `completed` or `uncertain`; elapsedMs.
- Aggregate numeric counts names/grades only.
- Bounded phases with allowlisted phase/status/durationMs only.

No owner/session/workspace identity or reference, filename/content, student/name/code/grade value, email/PIN/token/JWT, URL, request ID or raw exception is serialized. There is no telemetry/export/send request and no localStorage/sessionStorage/device/Outbox persistence. Existing private owner/session references are used only in memory to retire the clock.

Selecting a new file/destination, cancellation, binding change, owner/session/workspace retirement and view disposal clear it. Cloud retirement also repaints away the old panel. Reload deliberately restores no clock; an explicit existing-batch resume creates a new segment labelled as this page's continuation only, never a claimed duration for the earlier attempt. Starting another segment replaces the previous observation rather than merging attempts. Already user-copied clipboard text is not silently erased.

## Minimum changed-boundary proof

`node tests/n107-phase-clock-20261020/browser.mjs` **3/3 PASS, zero current failures**. It reuses the actual small existing N107 import fixture, with two fabricated names/four grade cells. Canonical `withIsolatedLocalBrowser` runs fresh contexts at owned `http://127.0.0.1:49765`, actual app DOM/handlers/source CSS and actual owned store/command guards; external requests and Service Workers are blocked. No saved profile, real account/student/file, hosted mutation, service operation, credentials or clipboard content was read. Clipboard writes are intercepted inside the synthetic context for exact data-shape assertions.

- Creation ACK held, then maximum ACK held, then grade durable ACK held: corresponding copied durations exceed the controlled hold, grade is not sent before maximum ACK, and actual success marker remains absent while grade transport is held. Details begin collapsed and are usable with the actual toggle/copy actions. Success reports completed with2/4 aggregate counts, one grade command/receipt, no retained grade command and cleared continuation.
- Every copied summary has exact allowlisted keys, finite statuses/phases and nonnegative integer durations. It contains no fixture identity/name/file/credential/URL/request/error strings. Every durable store and Web Storage are checked for diagnostic fields: none present. The test is observation-specific, not a new broad storage audit.
- Maximum rejection gives uncertain, no grade dispatch and no copied raw error. Reload has no prior panel/clock. Explicit resume creates a newly labelled continuation segment. Actual workspace/session retirement removes the panel and copy action. View disposal removes the success clock.
- `success.png`: actual390px screenshot inspected, expanded diagnostic readable; default collapsed state asserted separately. The normal completion action and success receipt are unchanged.
- View/harness syntax and `git diff --check` PASS. The final terminal-count refresh and explicit retirement repaint preserve the tested2/4 output/removal path; no unchanged browser suite was replayed for those small refinements.

`result.json` records exact task/run/base, finite diagnostic snapshots and source SHA256s. The canonical browser helper closes owned contexts/browser in finally; fixture responses and owned server/connections are closed in finally. This eligible synthetic loopback phase uses no shared live-browser lease. No unknown process or lease was touched.

The existing owner/max/grade/unknown-envelope, width2 and canonical ACK proofs are reused unchanged. No previous A/B,18s-phase experiment, full Sync/Auth/scoring/parser/crypto/SQL/PWA/build suite, provider polling or school automation was repeated. This is one candidate observation qualification, not a performance benchmark.

## Delivery boundary

Candidate observation improvement is ready for the independent publisher's served-source verification. No push, deployment, queue/status/ledger, global policy/config, service/Auth/RLS/schema or real-data mutation occurred. No speedup, actual phase attribution, N107 acceptance/closure or N125 conclusion is claimed. The current actual18s report stays the last real measurement until ordinary future feedback supplies a genuine new one.
