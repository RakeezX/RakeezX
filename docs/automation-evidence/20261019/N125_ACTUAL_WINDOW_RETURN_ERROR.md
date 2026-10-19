# N125 — actual window return: bounded diagnosis and safe failure details

AI-authored, 2026-10-19. Task `continuous-n125-actual-window-return-error-20261019`; run `0ecd9e4b-29fe-4656-bba1-f4b223a9c942`.

Base/current source: `a0490e3e54b11498406bad71c70ab5485920f26e`. Read-only `git ls-remote origin refs/heads/main` returned this exact SHA. Read canonical operating contract, activated card, latest N125 `[PO-CURRENT-1837]` row and previous `N125_RETURN_FOCUS_TRANSIENT_SYNC.md`. The previous visibility proof was read, not replayed. N123 and other closed work remain closed. No queue/ledger edits.

## Finding and remaining unknown

The new actual PO failure after publication `42ed8de877bdea389f534613c11ea53a695d8fac` remains authoritative. Its underlying error is **UNKNOWN**: no server response, safe error code or exact phase accompanied that observation. This candidate does not claim to fix or reproduce that user's red status.

A new actual-app HTTP fixture exercises **window blur/focus only, with document.visibilityState continuously visible**, rapid repeated blur/focus during 600ms identity verification, a second return, and a return during an already-held real Sync read. On the immutable current-source baseline, the pure-focus returns did **not** reproduce red (`tests/n125-1837/baseline.json`). No speculative debounce, severity relaxation, cached session, token exception, retry expansion or scheduling rewrite was justified. The prior readiness/drain behavior remains intact.

One concrete diagnostic defect was established: `firstPullError` wraps a transport error with the store label and discards its status/code. Consequently a server HTTP503 was indistinguishable from unknown in a naive coordinator diagnostic. The new diagnostic records the original failing transport error without changing the thrown wrapper, authenticated error semantics or severity.

## Bounded result

The coordinator keeps one context-local last-failure record: finite phase, finite code, last accepted wake event, ISO timestamp and monotonic elapsed milliseconds capped at 120000. Timing includes any active-pass drain for readiness. The event identifies the preceding accepted wake, not proof the wake caused the failure; `automatic` means none has been accepted yet. Known Auth/lease/ownership codes, selected HTTP status codes, exact browser fetch failures and UNKNOWN are allowlisted. Unknown raw messages, provider details, IDs, tokens, URLs, store names and pupil payloads never enter this record.

A failed background lease/readiness operation returns an internal error result to its existing caller so the resume coordinator can record `resume_readiness`; existing guards and the subsequent genuine Sync attempt still determine health. Readiness failure does not certify success. Genuine read failure remains red and actionable. The latest safe failure survives subsequent recovery in this document, explicitly labelled historical; it clears on account/presentation-context replacement and is not persisted.

The **existing Sync details** render only allowlisted diagnostic fields as selectable/copyable text. No new verification action, button, support transport/schema or startup dependency was added. Support's separate service allowlist was not expanded. Owner/session/lease checks, revisions, ACKs, outbox, grades and tombstones remain unchanged.

## Affected verification

- PASS `node tests/n125-1837/window.mjs`: `n125_actual_window_focus_readiness_and_safe_error_phase`. Fresh isolated 390px context, actual index/application DOM/handlers/store/ownership guard/source CSS over a task-owned loopback HTTP origin. Two pure-focus returns plus rapid duplicate events produce one verification/pass per return and no premature record reads/red. An already-running held read drains before renewal. Genuine session replacement still fails with CONTEXT_CHANGED; HTTP503 read failure remains red across return and renders `pull / HTTP_503` without injected payload. Failed HTTP503 readiness records its separate phase/timing, surviving a later guarded successful pull. Foreign-owner manual UI Sync makes no record reads. Grade18 and empty outbox remain. Result: `tests/n125-1837/result.json`.
- PASS `node --test tests/n125-1837/diagnostics.test.mjs`: allowlisted output omits arbitrary extra sensitive fields and refuses poisoned phase/code/event/time/duration values.
- PASS `node --check` on `src/app.js`, `src/lib/sync.js`, `src/lib/sync-operational-ui.js` and the new browser bootstrap; `git diff --check`.

Development failures retained truthfully: `original-error-metadata-failure.json` records the first new HTTP503 diagnostic assertion receiving UNKNOWN from the wrapped error. Recording the original error fixed this and the complete affected scenario passed afterward. The first allowlist unit-test invocation assumed the DOM helper returned a string; its actual safe HTML object requires String conversion. Only the harness was corrected; the current test passes.

The canonical `withIsolatedLocalBrowser` helper validated the activated synthetic card, blocked external requests and Service Workers, and closed its fresh owned contexts/browser in finally. The unique loopback server closed in finally. No shared live-browser lease was required for this approved isolated phase. No private profile, credential, live account/service mutation, real student data, Preview, full suite or whole-app build was used.

## Disposition

LOCAL_READY for this explicitly authorized bounded diagnostic fallback. **Actual PO recurrence cause remains UNKNOWN; actual-user resolution and Production served-asset verification are NOT_RUN here.** The independent controller/publisher owns integration, deployment and provider/served evidence. A future voluntary recurrence can expose the existing Sync details' phase/code/time to distinguish server failure, readiness failure and genuine context invalidation. This is not Product acceptance or N125 closure, and no unchanged trial is requested.
