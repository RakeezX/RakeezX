# N120 — compact report filters

- Task: `continuous-n120-compact-unified-report-filters-20261019`
- Run: `8339cba8-3221-44e0-a95f-d74fe35b9c6a`
- Base: `aed4fdee7da85cf7383174879411989ed5538ad6` (HEAD and observed origin/main at start).
- Authority: activated N120 card and current N120 Product ledger row; local synthetic work only. No queue/ledger edits, live service operations, push or deployment.

## Result

The existing gradebook, class report and cross-class report controls share one scoped flex bar in `src/styles/filters.css`, loaded by the affected views. It uses existing controls/tokens, 44px minimum control heights, a compact 10px inset and natural wrapping. Wide controls share a row; narrow controls wrap without page overflow. Labels, selection state, handlers, calculations, date adapter/scope and export/print behavior remain intact. No store/scoring/owner/Sync implementation changed. The reports index has no filter bar and required no change.

## Affected verification

`node tests/n120-1019-filters.mjs` — PASS using the actual application over `http://127.0.0.1:5120`, existing served-demo readiness helper and canonical isolated-local-browser helper. Fresh disposable Demo context; Service Workers/external requests blocked as required. Two fabricated classes, three students and two scores supply bounded filter cases. The existing Demo data remains synthetic.

- Gradebook: missing-only membership, score ordering, search and no-results.
- Cross-class reports: grade/class selection, missing-only membership, search/no-results, reset, result count and dependent class reset.
- Class report: alphabetical sort; optional historical ISO start date retained through attendance detail switching using existing handlers/adapter.
- All three bars: actual DOM/CSS at 1440px and 390px; one overlapping vertical row at wide width; controls visible, at least 44px high and no page horizontal overflow at either width.
- Full score state unchanged after interactions.

Machine-readable geometry: `tests/n120-1019-evidence.json`. Six screenshots: `tests/fixtures/n120-1019/{gradebook,aggregate,attendance}-{1440,390}.png`. Screenshots retain the top 1000px of the original full-page captures; visually inspected all six wide/narrow captures. The checked-in harness captures the same viewport directly on future runs to avoid oversized full-page artifacts.

Initial check found the nested gradebook search input below the 44px minimum: corrected in the shared CSS. Harness corrections then awaited deferred app repaint and font/layout settling, avoided screenshots tied to replaced DOM nodes, and measured a shared row by vertical overlap (segmented buttons have an existing 4px inset). Original failures were not service/tool rejections; no guards were disabled. Expected Service Worker-blocked warnings are isolation behavior, not offline certification.

`node --test tests/n70-cross-class.test.mjs` — FAIL in its unchanged fixture setup at line 27: `TypeError: Cannot read properties of null (reading 'id')`. Its fresh account has no active term; it fails before rendering any changed view. This older test did not supply report/owner-isolation evidence. The actual-app N120 synthetic test above supplies the required affected filter/layout check. No production guard was changed to accommodate the old fixture.

`node --check` on the three changed views and scoped browser harness — PASS. `git diff --check` — PASS. No full build or unrelated suite; independent publisher owns build/integration/Production verification. Browser contexts and owned Vite server closed in `finally`; isolated phase requires no global live-browser lease.

Local source readiness is separate from Production and PO acceptance.

## Resumed validation repair — run cb3fe9f9-3278-4458-a30d-e1377661c58f

The previous candidate `3e4391fb8fcb825ae1b329d11fe6e58a391cec4e` was rejected by candidate validation because its recorded legacy N70 fixture check failed. That original failure remains recorded above; its result is not relabeled.

Added `tests/n120-1019-report-owner.test.mjs`, a scoped copy of the original N70 test preserving all original assertions. Its fixture now explicitly supplies a synthetic year and term and seeds only fake IndexedDB via the existing `db.putAcross` API before reloading the actual store. An initial attempt to seed with `store.save` correctly encountered `OFFLINE_LEASE_LIMITED`: fresh unverified account writes are prohibited. The corrected read-only fixture does not pretend to perform an authorized Product write or renew Auth evidence. An added negative assertion verifies that actual `store.save` still rejects with `OFFLINE_LEASE_LIMITED`, leaving subjects/outbox empty, before fixture seeding.

`node --test tests/n120-1019-report-owner.test.mjs` — PASS (1 test, 0 failures): original report routes/hierarchy/filter/export assertions and account owner-switch isolation all execute, plus the negative unverified-account write check. Neither the original N70 test nor any Product source/guard changed in this repair.

Reuse the prior N120 actual-app DOM/handlers/CSS check and six screenshots: the three views, shared CSS, fixtures and their dependencies are unchanged. No browser/server phase was opened in this resumed run. Syntax and staged whitespace checks pass for the new fixture test/document changes. The new commit preserves the previous candidate as its parent; publisher delivery and Production evidence remain separate.

## Stable filter geometry — task continuous-n120-stable-filter-geometry-20261019

- Run: `26d59d19-139f-4f90-864f-0d3ed85407fc`.
- Base: `df8e49362e79b488bcf56fbdca5c94e361bead7a` (assigned HEAD and observed origin/main).
- Scope: PO19October N120 filter shaking plus N114's visual +/- follow-up. Local synthetic application only; independent controller/publisher owns delivery. No queue/ledger edits or live mutations.

### Diagnosis and change

Whole-view `innerHTML` replacement removed the filter stylesheet link on every filter/score repaint. Actual frame sampling reproduced missing CSS and temporary bar geometry changes, including 52px on narrow gradebook and up to 114.80px on aggregate reports. Preview text also changed sibling control widths by 18.95px. These are transient rendered failures that settled-state screenshots alone missed.

The three views now install one persistent filter stylesheet in `head` through the existing `beforeRender` hook. No new JS dependency or offline shell dependency was added. Scoped CSS reserves the scrollbar gutter while a filter view is present, gives action groups a consistent 148px flex basis, and reserves automatic score badge space so digits cannot push +/- controls. Existing responsive wrapping, 44px targets, native controls, focus outlines and approved date adapter remain. No handlers, calculations, owner checks, persistence, Sync, identity, history or date policy changed.

### Affected verification

`node tests/n120-1019-stability.mjs --baseline` diagnoses the actual immutable base application sources served over loopback, not a reconstructed template. Final baseline: 40 cases, 114.796875px maximum bar-frame change, 18.953125px maximum control change, 15 sampled frames without the filter stylesheet. `tests/n120-1019-stability-baseline.json` preserves those failures as diagnostic measurements, not a Product PASS. The first narrower 36-case reproduction had 21 missing-CSS frames; exact frame counts depend on request/frame timing, while the same defect reproduced in the immutable replay.

`node tests/n120-1019-stability.mjs` exercises real application DOM, handlers and source CSS at 1440px and 390px using the canonical isolated-local-browser helper and existing served Demo readiness helper. It covers sort, missing-only, search/no-results, reset, count changes, focus, attendance detail, A4 preview text and repaint. Synthetic +/- interactions cross 9→10→9 and exercise a separate 24-student class while genuinely scrolled beyond 1100px. Score records remain unchanged; synthetic participation logs use the existing command. The affected controls remain visible and at least 44px high, all three wide bars occupy one row, and neither width has horizontal page overflow.

Machine measurements: `tests/n120-1019-stability.json`. Six viewport captures: `tests/fixtures/n120-1019/stable-{grade,aggregate,attendance}-{1440,390}.png`; inspected the affected wide and narrow layouts. Existing unrelated report/owner/scoring acceptance evidence above and in the prior N114 receipt is reused; no new backend/grade/security suite is warranted for stylesheet lifetime and layout changes. Demo fixtures and browser emulation do not certify live accounts, physical devices, offline cache or Production.

The owned loopback server on port 5127 and all fresh disposable browser contexts/browser close in `finally`. Service Workers and external requests remain blocked; expected SW-block warnings are not a failure or an offline certification. No shared live-browser lease is needed for this eligible isolated phase. Syntax checks of the three affected views and harness, plus `git diff --check`, are the other affected checks. No full Vite build, push or deployment by this worker.

Final candidate result: **PASS**, 40 affected interaction cases; maximum bar-frame change **0px**, maximum control change **0px**, missing-CSS frames **0**, and scrolled +/- maximum scroll change **0px** at both widths. Syntax and whitespace checks PASS. Source readiness only; publisher delivery remains outstanding.
