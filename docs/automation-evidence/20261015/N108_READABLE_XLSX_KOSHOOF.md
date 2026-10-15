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
