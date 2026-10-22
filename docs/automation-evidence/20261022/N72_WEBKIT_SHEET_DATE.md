# N72 WebKit sheet/date slice — 2026-10-22

## Outcome

Blocked before the date-sheet journey. No Product source or styles were changed. This result does not establish that the sheet/date UI passes or fails, and it is not physical iPhone Safari, keyboard, or PWA evidence.

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
