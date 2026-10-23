# N09 mobile grade entry — local outcome, 23 October 2026

AI-authored implementation and evidence. Task `continuous-n09-mobile-grade-entry-outcome-20261023`, run `bdffa863-f649-4ced-8d56-7ae3f32e6867`; base `4ee4608c3a043f8ff27fd1c90d0ba652bc7e558b`.

## Reproduced issue and bounded repair

At 360 CSS px, focusing a manual table field left its center behind the sticky RTL student column. The field retained focus but failed an actual `elementFromPoint` hit check: x=139.84–205.84, sticky width=186.16, table container=323, table content=586. Original failure: [before.json](../../../tests/n09-mobile-grade-entry-outcome-20261023/before.json).

The existing `select-score` focus handler now measures the sticky column and scrolls the field into view using logical scroll padding on the grade table wrapper. The padding is scoped to `.grades-01c .tablewrap` in grades.css. Wide tables retain their intentional internal horizontal scroll. No store, model, Sync, scoring, API, shared CSS, viewport helper, import flow, labels or actions changed.

## Affected actual-app checks

Evidence directory: `tests/n09-mobile-grade-entry-outcome-20261023/`.

| Required check | Result | Actual evidence |
| --- | --- | --- |
| n09_grade_mobile_actual_journey | PASS | `accepted-local.json`: 360/390 px; assessment selection, sort/missing filters, item and table entry, every first-row editable table column focused and hit-test reachable; no document horizontal overflow. |
| n09_grade_focus_values_and_reopen | PASS | Same run: Enter advances student/field without repaint focus loss; 7, blank/null and 0 saved through existing DOM handlers/store; distinct zero and blank students survive route reopen and document reload plus reopening the same owned account DB without reseeding. Same-document owner/database/value readback and 11/16/21 owner-bound durable commands. |
| n09_grade_desktop_rtl_semantics | PASS | Same run at 1280 px; RTL computed direction, existing assessment columns/actions, 16px table entry font, focus reachability and persisted zero/null. |
| Enlarged text inspection | PASS | `text-enlargement.json` and `text125-{360,390,1280}.png`: computed sizes enlarged individually by 25% on actual grade DOM (table fields 16→20px); all editable first-row fields remain hit-test reachable; page width stays bounded. |
| Syntax / whitespace | PASS | `node --check` on grades.js and the three scoped harness modules; `git diff --check`. |

Commands: `N09_PHASE=accepted-local node tests/n09-mobile-grade-entry-outcome-20261023/journey.mjs` (PowerShell uses `$env:N09_PHASE='accepted-local'`), then `node tests/n09-mobile-grade-entry-outcome-20261023/text-enlargement.mjs`. No full build or unrelated report checks repeated.

The harness uses the existing served-demo readiness helper and n90-style fabricated owned-account/lease fixture pattern. Existing synthetic rows receive ordinary account IDs so account outbox guards are exercised rather than the demo-ID local-only exception. No guard is replaced. All application DOM, handlers and source CSS are served by owned Vite at `http://127.0.0.1:5299`, through the canonical isolated-local-browser helper. One disposable context at a time, external requests blocked and Service Workers disabled. Both browser phases close their owned browser/context and Vite server in finally; the isolated local phase needs no shared browser lease.

## Preserved failures and limits

Intermediate `after.json`, `verified.json`, `account-verified.json`, `final.json` and `complete.json` remain unchanged. They record harness corrections: fabricated stored Auth triggered unavailable service restoration; demo-prefixed fixture IDs bypassed account commands; immediate reads raced scheduled repaint; clicking an already selected item caused no DOM replacement. Corrections remove only fabricated Auth before reload, reopen the same account DB, use ordinary fixture IDs, wait for changed renders and avoid waiting for a nonexistent replacement on unchanged selection. The actual zero/null values were read from that DB in the same document after reopening. The original hit-test failure is retained separately.

Reviewed table screenshots at 360 and 1280, item screenshot at 390, and enlarged table screenshot at 360. Screenshots accompany the interaction/store assertions; they are not standalone acceptance proof. Root font-size 125% screenshots are supplemental; the separate computed-font enlargement check covers pixel-sized text too.

This is Chromium synthetic local usability evidence. It does not certify physical iPhone/Safari, keyboard/VisualViewport behavior, live Auth restoration, cloud Sync, offline shell, Production delivery, PO acceptance or closure of parent N09. Controller/publisher owns integration and served Production evidence; this worker does not push, deploy or edit queue status.
