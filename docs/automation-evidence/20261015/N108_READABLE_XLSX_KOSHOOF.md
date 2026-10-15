# N108 — readable XLSX Koshoof export

AI-authored implementation and evidence, 2026-10-15.

- Task: `continuous-n108-readable-excel-xlsx-koshoof-20261015`
- Run: `86ca48c0-56cd-4e8f-8277-62f4c392b4a2`
- Base: `e025b39a8aa843d1277918a6f592e4994afe7e5c`
- Scope: client-only names / names-and-grades export. No Auth, service, schema, owner policy, import writes or score calculation changes.

## Result

Normal Koshoof Export defaults to Excel (.xlsx), with a compact labeled CSV alternative. Both existing export actions honor the selected format and preserve the class-based sanitized filename. Import's blank template remains CSV. Noor remains explicitly manual-only CSV with its existing confirmed exact 40/60 grouping.

The audited parser bundle exposes decompression and reading, not a supported ZIP writer. The new local module therefore writes six fixed OOXML parts in a minimal stored ZIP, with independently checked CRC32 and directory structure. It adds no dependency, macro, formula, hyperlink, external relationship, document metadata, student ID or token. Names and headings are escaped inline string cells, including leading `= + @ -`, tabs and newlines; scores use numeric cells and absent scores use blank cells. The single Arabic sheet uses RTL, an anchored frozen header, styled/wrapped cells, 55-character name width, 40-character grade widths and explicit calculated row heights. The existing CSV exporter and XLSX writer share the same sorted data rows and unchanged `itemScore` projection.

`sw.js` advances v65 to v66 and precaches the added module. The N106 browser harness now explicitly selects CSV before its existing CSV-specific assertions; its historical result is retained unchanged.

## Affected verification

`node --test tests/n108-xlsx-export.test.mjs tests/n90-transfer.test.mjs`: **12/12 PASS**. Includes valid archive structure/CRC, fixed parts, XML escaping, typed zero/blank, 300 rows, long Arabic names/headings, no active content/identity metadata, unchanged CSV injection guard and Noor 40/60 behavior, and existing N90 review/mapping/capping/identity checks.

`node tests/n108-xlsx-export-browser.mjs`: **6/6 recorded checks PASS** on the final Product file hashes in `tests/n108-xlsx-export-browser.json`:

1. Actual application DOM, handlers and source CSS on task-owned loopback HTTP: authenticated synthetic account exports names and grades in both formats at 320/390/768/1280, light/dark; no horizontal overflow, usable focus, eight screenshots under `test-results/n108/`.
2. Both existing audited `readStudentFile` and `readGradeFile` parse the actual downloaded files: 300 students, long Arabic name and user-defined title, equivalent CSV labels/values, numeric zero distinct from missing, safe class filename. CSV retains its protective apostrophe where XLSX stores literal string data.
3. Empty-class names export, authenticated close/back and unchanged persisted students/scores/items/outbox checkpoint. No service mutation. Account boot/Sync certification is reused, not reasserted from a synthetic reloaded account.
4. Audited grade reader accepts all formula-prefix cases as text. Raw sheet XML retains leading tab/newline and escaped entity content, with no formula nodes or XML errors.
5. Separate actual Service Worker phase: affected files cached; first offline Demo Koshoof visit downloads XLSX; offline reload checks current-document ready workspace and exports with the new module. This is affected offline-shell evidence, not cloud/offline-lease certification.
6. Fresh mobile/touch emulation at 390px: actual XLSX and CSV names downloads using tap.

Visually inspected `test-results/n108/320-light.png`: format selector, long grade titles and both actions fit the narrow RTL panel. Native Microsoft Excel visual opening was not run; workbook formatting is verified through OOXML fields and the application's audited readers.

The earlier harness failures are preserved verbatim in browser JSON `previousFailures`: missing enrollment model defaults, fixed-column rather than heading-based assertion, duplicate hidden/visible close-button locator, and attempting account reload without provisioning that fixture for account boot. They were corrected without weakening Product guards. Final full browser run succeeds. Supplemental runs reused unchanged successful matrix evidence until the final CSV-default preservation edit justified the final full run.

## Existing unrelated test limitation

`node --test tests/offline-route-graph.test.mjs`: **FAIL** at its stale hardcoded route count (`33 !== 30`). Its preceding complete-cache-graph assertion passes, including the added module. `src/router.js` and this test are byte-identical to the base via `git show`; N108 does not edit either. Retained as an actual failure, not converted to PASS or expanded into an unrelated repair.

Existing `tests/n106-koshoof-browser.json` `n90_current_owner_grade_atomicity_and_cancel_preserved` evidence is reused for unchanged owner, invalid lease, ownerless dispatch, offline import denial and atomic grade handling. Their implementation and guards are untouched.

Syntax checks for the changed application modules, `sw.js` and new browser harness, plus `git diff --check`: **PASS**. No build/provider/deployment step was run by this worker.

## Resource and delivery disposition

The actual SW checks used the canonical shared browser lease owned by this task/run. All browser contexts and the owned loopback server close in `finally`. Lease release initially encountered a transient checkpoint file-sharing lock; the subsequent canonical release succeeded (`RELEASED browser`). No unknown process or lease was touched. Browser JSON records owned cleanup.

Local candidate only. No push, integration, Cloudflare Preview/immutable/Production verification or Product acceptance is claimed. The independent controller/publisher owns those subsequent steps.

## Saved-session continuation — validation scope blocker

AI-authored reconciliation for run `f10541c8-3b5c-49e4-8aa0-177a4229d203`, saved session `01a140d4-a22a-7833-9c72-286fabd166a6`.

The implementation commit `008481339b637d1eef92d50b29c6d2591e9319e9` remains intact. The runner rejected the prior result with `Candidate validation: An affected check must pass and no recorded check may fail`, because the reported generic offline-route test failed. That historical failure remains FAIL; no result or queue file was rewritten.

Fresh read-only reconciliation confirms all five Product source hashes still equal the browser evidence, all six recorded browser checks passed, and the recorded owned browser/server cleanup completed. The generic test and router are still byte-identical to the base. No unchanged browser, Preview or failing test was repeated.

The exact missing repair path is **`tests/offline-route-graph.test.mjs`**, line 45: its hardcoded route-import expectation is 30 while the existing base router has 33. A bounded repair would correct that stale expectation against the current router and retain the complete executable-graph cache assertion and every routed-view cache assertion. Adding a separate passing N108 check would not repair this recorded failing assertion. Changing Product routes or omitting the failure to satisfy validation would be inappropriate.

This path is outside the activated card's `allowedPaths`; the worker therefore returns BLOCKED rather than changing it. Retry condition: the authorized maintenance procedure corrects the inactive card scope to permit this exact test repair (or records the actual guarded repair), preserving this worktree, candidate chain, base, evidence and saved session; then the controller resumes this session for the targeted correction/check. No maintenance role, queue edit, new worker or deployment was started here.

## Reviewed scope repair completed

Run `f1f43490-e158-4149-8f96-0e8b0cb44108` resumes the same saved session and candidate chain after the activated card explicitly added `tests/offline-route-graph.test.mjs` and authorized the exact count correction. The historical FAIL and blocked result above remain historical evidence; this section records the subsequent correction and observed result.

Only the stale expected route-import count changed from 30 to the source-backed 33. The full SHELL missing-module assertion, minimum visited-module coverage (`>= 59`) and every routed-view cache assertion are unchanged. `node --test tests/offline-route-graph.test.mjs` now reports **1/1 PASS**, zero failures. `git diff --check` also passes.

Fresh reconciliation verifies all five Product source hashes still match the six successful browser checks and their owned cleanup evidence. The earlier 12/12 Node checks and real application DOM/download/reader/offline evidence are reused; no Product source changed, and no browser, server, build, Preview or deployment was repeated. The scope blocker is resolved. Candidate is locally ready for the independent controller/publisher; provider/immutable/Production checks remain unrun by this worker.
