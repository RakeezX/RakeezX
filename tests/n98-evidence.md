# N98 scoped candidate evidence

Task: continuous-n98-default-alphabetical-roster-20261013
Run: f9a9be3d-e9e3-4d3d-9c1e-511fbf9543d9
Base: c672774a2033425f168d9e41fbe04086884fcd3f

Default order uses the existing Arabic base-sensitivity collator and a deterministic student-ID tie. `displayRoster` projects contiguous `displayNo` from the complete active roster before filtering/sorting. Stored roll numbers remain available to explicit roll sorting and are not rewritten by presentation. Student/enrollment identities, grade links and saved names remain unchanged.

Store inspected read-only: this revision has `store.students(teachingId)`/`sectionRoster`, not `studentsOf`. `teachingContext` preserves closed report payloads. Attendance uses frozen session membership; current active members receive current display numbers, former members retain saved numbers. Closed-term reports bypass the new presentation projection. No store, schema, Sync, or live data changes.

## Actual verification

- `node --test tests/n98-default-order.test.mjs tests/session-roster-snapshot.test.mjs tests/closed-term-report.test.mjs`: 10/10 PASS. Covers the three/four-name example, legacy rolls, add/rename/remove projections, equal/diacritic stable IDs, complete-roster numbering and persisted student/enrollment/score/snapshot/outbox invariance. Existing session snapshot and closed-report safeguards pass.
- `node node_modules/@playwright/test/cli.js test --config tests/n98-playwright.config.mjs`: 1/1 PASS after correction of a reports-file encoding mistake found during screenshot inspection. Actual Vite application at http://127.0.0.1:5198, fresh isolated synthetic Demo, existing `makeIsolatedDemoContext`/`openReadyServedDemo` helpers. Exercises real DOM, source CSS, search handlers, stored-roll and score sort handlers, grade item/table modes, snapshot attendance, roster/grade/attendance reports, actual CSV downloads, and A4 preview. Database snapshot unchanged across the entire read-only journey. No page errors.
- A4 screenshot visually inspected: Ahmad 1, Bandar 2, Hatim 3, Khalid 4; Arabic headings intact. Artifact: C:/Users/Abody/AppData/Local/Temp/rakeez-n98-f9a9be3d-evidence/n98-views.e2e.mjs-n98-exis-ee3a1-s-explicit-sorts-CSV-and-A4/n98-roster-a4.png
- `tests/student-transfer-roll-safety.test.mjs`: 3 local membership/identity tests PASS. The legacy offline V2 RPC test FAILS at line 136 (`outbox.length`, 1 instead of 0). The identical failure was independently reproduced with the exact base models.js restored temporarily; the candidate model was restored in finally. This is a pre-existing test failure, not presented as PASS and not repaired outside N98.
- Syntax checks for all five affected source files and `git diff --check`: PASS.

Browser lease acquired for the HTTP application check and released after Playwright closed its browser context/server. No push, deployment, queue/status mutation, real account access, or external messages performed. Controller/publisher owns integration and served Production evidence.
