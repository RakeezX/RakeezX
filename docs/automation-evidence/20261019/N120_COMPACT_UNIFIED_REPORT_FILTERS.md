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
