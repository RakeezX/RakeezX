# N72 WebKit sheet/date slice — 2026-10-22

## Outcome

Blocked before the date-sheet journey. No Product source or styles were changed. This result does not establish that the sheet/date UI passes or fails, and it is not physical iPhone Safari, keyboard, or PWA evidence.

## Attempt

- Used the canonical `withIsolatedLocalBrowser` helper with `engine: 'webkit'`, fresh contexts, and the task-owned loopback server on port 43172. No browser installation, credentials, persistent profile, or external request was used.
- The target is the actual app entry and existing calendar term-date sheet, using the approved `planning` date adapter. The intended scenarios are 390px mobile, a 320px short-sheet condition with simulated `visualViewport` compression, and desktop.
- WebKit loaded the app modules and created `rakeezx-demo` (version 8) and `rakeezx-workspace-registry` (version 1), but the app stayed on `جارٍ تجهيز مساحة عملك…` without rendering `.layout`. A run waited 30 seconds; it timed out before reaching the date sheet. No page or console errors were observed.
- The controlled WebKit journey therefore did not reach focus, picker placement, dismissal, opener focus, or desktop comparison. Do not interpret those gates as passing.

## Reuse boundary

Existing accepted N20/N38/N69/N54 evidence remains unchanged. The existing N38 date-policy evidence remains the basis for date semantics; this attempt did not repeat those semantic assertions. No accepted behavior was reopened and no physical-device claim is made.

## Retry condition

Retry this slice only after the app startup/Demo fixture can complete in the canonical isolated WebKit context and render the current application. Then run the complete bounded journey before considering any presentation change.
