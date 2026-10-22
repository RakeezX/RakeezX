# N72 WebKit sheet/date slice — 2026-10-22

## Outcome

Scoped local repair verified in installed WebKit at 390px, 320px with simulated visible-viewport compression/offset, and desktop. A reproduced clipped sheet picker is now constrained to the visible region with scrollable contents. Historical failed/unrun attempts below remain preserved. This is not physical iPhone Safari, OS keyboard, PWA, Production, or whole-N72 acceptance.

## Original attempt (preserved)

- Used the canonical `withIsolatedLocalBrowser` helper with `engine: 'webkit'`, fresh contexts, and the task-owned loopback server on port 43172. No browser installation, credentials, persistent profile, or external request was used.
- The target is the actual app entry and existing calendar term-date sheet, using the approved `planning` date adapter. The intended scenarios are 390px mobile, a 320px short-sheet condition with simulated `visualViewport` compression, and desktop.
- WebKit loaded the app modules and created `rakeezx-demo` (version 8) and `rakeezx-workspace-registry` (version 1), but the app stayed on `جارٍ تجهيز مساحة عملك…` without rendering `.layout`. A run waited 30 seconds; it timed out before reaching the date sheet. No page or console errors were observed.
- The controlled WebKit journey therefore did not reach focus, picker placement, dismissal, opener focus, or desktop comparison. Do not interpret those gates as passing.

## Harness recovery — run `9bec8634-2b0f-41aa-8fa0-7b0c925870f9`

- Replaced the raw static file server with the repository's installed Vite host on owned loopback port 43172, read the current run ID from the canonical task file, and requested `preparing` exactly once in each fresh context, following the working N26 app fixture pattern.
- Actual app boot reached a ready synthetic Demo workspace in WebKit. The journey then remained on `جارٍ تجهيز مساحة عملك…` after changing to `#/calendar`; the calendar action never rendered. This is distinct from the original raw-server/active-empty-Demo failure.
- The one Chromium diagnostic run with the same Vite/preparing setup reached the real calendar term-date sheet. It showed that Escape closes the surrounding Product sheet and removes the date field, so Escape was removed from the harness's picker-cancel step. The test now dismisses the picker by clicking outside it, checks the field, then exercises the Product sheet cancel action. Chromium output is diagnostic only and does not substitute for WebKit acceptance.
- The Vite child process and each isolated browser/context are closed by their owning `finally` blocks. No Product source or style changed.

## Reuse boundary

Existing accepted N20/N38/N69/N54 evidence remains unchanged. The existing N38 date-policy evidence remains the basis for date semantics; this attempt did not repeat those semantic assertions. No accepted behavior was reopened and no physical-device claim is made.

## Retry condition

Retry this slice after the current app can stay rendered on `#/calendar` in the canonical isolated WebKit Demo context. Then run the complete bounded journey before considering any presentation change.

## Route-stage diagnosis — run `5168a102-f267-4a81-b237-00402cc30ad7`

- A bounded 12-second stage capture on Vite port 43173 found a same-document hash transition: `performance.timeOrigin` and the single navigation entry were unchanged, with only the initial navigation and hash navigation in the main-frame event list.
- Before and after `#/calendar`, `window.__workspaceRouting` was `ready` for the signed-out Demo workspace and the preparing request remained present, but `store.state.ready` stayed false, teaching count stayed zero, `.layout` count stayed zero, and the boot placeholder remained. This capture did not reproduce the prior report's ready-to-placeholder transition; the fresh Demo never became ready in this run.
- `app.js`, `router.js`, and `calendar.js` returned HTTP 200; no console/page errors or failed requests were observed. A single bounded Chromium comparison with the same Vite/preparing fixture produced the same unready boot stage, so the current failure is not isolated to WebKit and does not establish a Product route regression.
- An extra read-only IndexedDB probe was invalid: it opened the database without a version and requested stores before confirming the schema, then raised `NotFoundError`. Its context closed in `finally`; it is excluded from application evidence. The route-stage harness no longer performs that probe.
- No Product source or CSS change is justified by this evidence. The date-sheet WebKit checks and route owner-retirement boundaries remain NOT RUN. Retry when the canonical fresh preparing Demo fixture reaches `store.ready`, seeded teachings, and `.layout`; then capture the route transition and proceed to the date journey.

## Completed scoped repair — run `4b84a7a9-2061-4f62-a0ac-f7750224ee76`

### Harness cause and correction

- Reproduced the committed harness failure by running `node tests/n72-webkit-sheet-date-20261022/route-stage.mjs`: `page.evaluate: ReferenceError: Can't find variable: databaseCounts`. Removed the undefined reference and replaced timed readiness polling with direct initialization-boundary observations.
- Task-owned Vite transforms only observed existing operations; no DB/store source, return value, guard, or seed was replaced. `registry.close` completed. The first incomplete boundary was `seedDemoWorkspace → db.writeAll`; DB upgrade to version 8 with 33 stores completed and the lifecycle guard read succeeded. At the finite progress checkpoint, all 33 clears and 401/1914 puts had succeeded with zero errors. The transaction was progressing, not proved deadlocked.
- Event-driven completion within the existing isolated browser phase then recorded all 1914 puts, `db.writeAll`, `seedDemoWorkspace`, and `store.init` completing. The same document had `ready=true`, 8 teachings, one `.layout`, and the request changed from `preparing` to `active`. See `route-stage-before-result.json`, `route-stage-db-boundary-result.json`, `route-stage-progress-result.json`, and `route-stage-result.json` in the task test directory.
- The final Product journeys use **uninstrumented app source** and a MutationObserver for actual layout readiness, followed by a store/database checkpoint in that same document. They do not use an async truthiness predicate, force readiness, omit seeding, or bypass guards. Each scenario retains the existing 90-second isolated phase bound and releases its fresh context/browser afterward.
- Factual correction to the prior run: `route-stage.mjs` hardcoded WebKit, so setting `N72_ENGINE=chromium` did not make that stage capture a Chromium comparison. Its previous cross-engine attribution is unsupported. The separate earlier journey's Chromium diagnostic remains historical. No ready-to-placeholder route defect is assumed or repaired; all three final WebKit journeys reached Calendar in the same document with unchanged timeOrigin/navigation count.
- The initial mobile journey reached the actual picker but its harness refocused the input, reopening flatpickr, then tried clicking Cancel through the popup. That FAIL remains in `mobile-390-baseline.json`. The corrected journey explicitly dismisses the reopened popup before clicking the existing sheet Cancel control.

### Observed presentation defect and repair

Before repair, the actual term-date picker at 320×420 with **simulated** visualViewport height 230 and offsetTop 35 measured y=168.09…466.09, beyond the visible bottom y=265. The field remained focused. The failed assertion and actual-app screenshot are retained as `short-sheet-baseline.json/.png`.

Only `src/lib/rakeez-datetime.js` and `src/styles/rakeez-datetime.css` change Product behavior. When the natural sheet popup clips, the existing adapter clamps its position and height to the current visible region, leaves the sheet header/close control accessible, and lets the existing picker contents scroll. Resize/offset changes recompute placement; close/destroy cancel scheduled work and destroy removes owned listeners. Natural placement remains flatpickr-owned when it fits. No runtime import was added.

| Final actual WebKit check | Result and evidence |
| --- | --- |
| 390×740 | PASS: original picker size, unconstrained; focus, visible bounds, dismiss, return to field, Cancel, opener restoration; `mobile-390-candidate-final.json/.png` |
| 320×420, simulated 230px height / 35px offset | PASS: popup y=131.60…254.82 inside y=35…265; last enabled day and year control hit-test reachable through popup scrolling; focus retained; `short-sheet-candidate-final.json/.png` |
| Height/offset recovery | PASS in the short scenario: simulated 260/0 and 420/0 remain contained with focus; restoring native 320×740 removes constrained mode and restores natural popup placement |
| 1280×900 desktop | PASS: unconstrained natural picker, focus, dismissal, Cancel and opener restoration; `desktop-candidate-final.json/.png` |
| Date/data isolation | PASS in every final journey: RTL, literal 0–9, current planning bounds 2026-08-01…2027-12-31, input value retained, both stored term records exactly unchanged after Cancel, Demo database and sync-ineligible workspace retained, Outbox stays empty |

### Reuse and limits

The N38 date-value/policy module is unchanged from the approved base (Git blob `80a1df2413705abe822494e173d58f7ec0b92752`). Its accepted optional values, normalization, time/ISO storage and date-bound semantics are reused; those suites were not repeated. Earlier baseline JSON serialized configured Date objects through UTC, producing a previous-day diagnostic string; final JSON uses flatpickr's local `Y-m-d` formatter. This is a harness representation correction, not a date-bound change.

N20/N54 viewport and sheet evidence and N69 accepted report behavior are reused; their source was not modified and their tickets were not reopened. App/router, DB/store, Demo seed, Auth, Sync, grades, calendar policy, and SW source remain unchanged. Conditional app/router owner-retirement checks were not activated because those sources did not change. This local Demo evidence does not certify live account/owner/Sync/offline behavior.

All browser contexts were fresh and loopback-only under the unchanged canonical isolated helper. Vite hosts and browsers closed in their ownership-matched `finally` blocks. No public collector, service/provider/account operation, push, or deployment ran. Final scoped syntax/result assertions and diff checks passed; the controller retains integration and served verification.
