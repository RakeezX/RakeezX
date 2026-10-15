# N44 — standalone notification settings

Task: `continuous-n44-dedicated-notification-settings-20261015`  
Run: `9e4c741f-2f88-4d5f-8320-e82720837c12`  
Base: `ffa9bfb611b2e432e33c8cc500ac22faa20bb031`

Local readiness only. No push, deploy, provider operation, real account mutation or Product acceptance. Remote `refs/heads/main` was read with `git ls-remote` and matched the base before commit. The independent controller/publisher owns integration and exact served Production verification.

## Result

Settings now contains one full-width bell row linking to `#/settings/notifications`. The real hash route has its own title, active Settings navigation and explicit Settings back link. Two calm sections contain category switches and their dependent timing grids. Seven existing minute choices retain default 15; four independent due-day switches retain their existing defaults. Disabling a category hides its controls without resetting timing. Headings sit outside bordered option grids; no fieldset/legend, redundant safety copy, technical metadata or Push teaser was added.

Existing notification state functions and currentNotificationContext/notificationScope guard remain authoritative. Every action rechecks the current scope. Workspace deactivation removes private controls synchronously; auth/store/storage listeners validate the rendered scope and are removed on route unmount. Document title is restored on unmount. No preference engine, event/delivery rule, data permission or cloud storage changed.

The new module is in the SW shell and cache generation advances from v63 to v64. Existing N64 profile and N36 import sections/handlers are intact. The existing quiet-UI harness now targets the dedicated route and grid display; its full historical center suite was not rerun.

## Actual checks

- `node --test tests/n44-inapp.test.mjs tests/n44-preferences.test.mjs tests/n44-user-timing.test.mjs`: **13/13 PASS**, including owner/auth/guard failure, private category/timing namespace, read/dismiss/expiry, clock bounds and no sensitive writes.
- `N44_RUN_ID=<run> node tests/n44-settings-standalone.mjs`: **PASS** on real app DOM, handlers and source CSS using the canonical isolated helper, owned loopback HTTP server and synthetic account fixture. Six widths (320/360/390/480/768/1280) in light/dark, landscape and CSS 200% zoom: no horizontal overflow, clipped controls, section overlap or legends; physical hit rectangles >=44px. CSS zoom is browser emulation, not a claim of testing every OS zoom implementation.
- Route deep-link, correct document/topbar title, active Settings navigation, back/re-entry/reload/repaint, keyboard Space and retained focus, seven minutes, four independent date switches, category hide/show retaining saved values: **PASS**.
- Synthetic A/B account defaults and returning A preferences, same-document owner/database/provisioning receipt checkpoint, synchronous workspace clearing, stale action blocked, missing auth controls absent: **PASS**. No live identity, credentials or external service used.
- `... node tests/n44-settings-standalone.mjs --offline-only`: **PASS** under acquired/released shared browser phase lease. Actual SW cached router/new module/CSS/state; network disabled, deep reload and back/re-entry, preference edit and reload persistence worked. Existing LIMITED banner remained. This separate phase reused unaffected UI proofs.
- `... node tests/n44-settings-standalone.mjs --row-only`: **PASS** after the targeted desktop row correction, at 320/390/768/1280. Final bell row visually inspected at 320; actual dedicated page inspected in light at 320 and dark at 390. Source hashes and geometry are in `tests/n44-settings-standalone.json`.
- `node --check` on router, settings views, SW and both affected UI harnesses; `git diff --check`: **PASS**.

## Corrections retained

Initial harness import used a Windows drive path without an ESM URL; corrected to a Node module file URL (browser navigation always used HTTP). An initial title assertion exposed that the shell did not change document.title; the dedicated route now sets/restores it. A reload checkpoint first read state after the readiness predicate; corrected to capture owner/database/receipt within the successful same-document predicate. The added Settings-row check exposed desktop's existing three-column surface placing the new destination alongside appearance; scoped CSS makes the destination span all columns, preserving the three existing preference columns. Original desktop failure remains in JSON resolvedFailures. The first icon lookup fell back to a document; the row now reuses the actual existing bell SVG.

Owned disposable browser contexts and task server were closed in finally. Shared browser lease reports `RELEASED browser`. Temporary visual-inspection screenshots were removed after inspection. No queue/status, global configuration, Auth/RLS/schema or service files changed.
