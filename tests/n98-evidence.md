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


## Resumed attempt: 75f02b4b-6e0d-4130-a81a-75dc01f22497

The saved candidate 4e3b80c22016a676452f734f555e0dfacda4111c and all Product source changes were preserved. The prior validator rejected its recorded failed check. The original failure above remains historical FAIL; it is not relabelled as PASS.

Concrete diagnosis in a temporary N98-scoped fixture found the sole remaining outbox envelope was profile bootstrap, rejected with `Field is not allowed for this sync entity: education_department` (SQLSTATE 22023), before transfer was exercised. The legacy lifecycle helper omits the already-shipped `20261003000000_n03_education_department.sql` migration.

Correction: `tests/n98-transfer-sync.test.mjs` reuses the existing lifecycle helper and retains all assertions from `student-transfer-roll-safety.test.mjs`. In its disposable PGlite database only, it additionally loads that existing immutable migration, verifies the profile field map, and verifies N98 projection leaves student/enrollment/grade/attendance/outbox tables unchanged. It does not change the legacy test, migration files, Product code, Auth, RLS, or any live service. No assertion was weakened, rejected envelope discarded, or failed result overwritten.

- Corrected scoped transfer/Sync check: 4/4 PASS, including empty outbox after both full Sync calls, two atomic transfer receipts/operations, no generic enrollment upserts, sequential rosters and stable student-linked history.
- Combined current checks: `node --test tests/n98-default-order.test.mjs tests/n98-transfer-sync.test.mjs tests/session-roster-snapshot.test.mjs tests/closed-term-report.test.mjs`: 14/14 PASS.
- Rendered-UI evidence from the original attempt is reused: the five Product source files, UI test, application dependencies and synthetic inputs are unchanged. No repeat browser/server phase was needed and no new lease/process was acquired.
- New test syntax and `git diff --check`: PASS.

The legacy test itself still has its omitted-migration fixture; this attempt does not claim it passed. The corrected N98 fixture now exercises its same safeguards successfully under the shipped profile protocol. Both candidate commits are preserved. No push, deployment, or queue/status edit performed.
