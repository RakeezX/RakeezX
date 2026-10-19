# N119 — current alphabetical display roll number

AI-authored implementation/evidence, 2026-10-19.

- Task: `continuous-n119-alphabetic-display-roll-number-20261019`
- Run: `1542972d-8046-4d62-a1ae-91bdf3b1b193`
- Base / observed origin/main: `644e6896c24e02e00d46c558a0f87c563f644870`
- Authority: activated N119 card and current canonical Product ledger row; accepted N98 continuous derived numbering contract remains in force.

## Change

The existing `displayRoster` already derives active display numbers from Arabic alphabetical order with stable identity ties, before filters. Gradebook and reports incorrectly sorted by saved enrollment `rollNo` when the user selected roll number, despite rendering `displayNo`. Both now sort by the displayed rank. Explicit name sorting reuses the same existing `sortStudents` collation/tie policy as the roster. Reports retain saved-number fallback for historical rows without a derived display number.

No store/import/identity/source-number writes, new startup module, schema, service operation or guard change. Existing N98 projection evidence is reused for unchanged derivation; no export/import suite or build rerun.

## Affected evidence

`tests/n119-1019-display-roll.mjs` uses the canonical isolated browser helper, existing served-app readiness and synthetic account/provisioning helpers. It serves actual repository HTML/modules/CSS on an ephemeral owned loopback HTTP port, uses fresh contexts, and closes its server/browser in finally. No shared live-browser phase or live service is used.

Commands (PowerShell):

```powershell
$env:N119_RUN_ID='1542972d-8046-4d62-a1ae-91bdf3b1b193'
node tests/n119-1019-display-roll.mjs --baseline
node tests/n119-1019-display-roll.mjs
node --check src/views/grades.js
node --check src/views/reports.js
node --check tests/n119-1019-display-roll.mjs
git diff --check
```

PASS: baseline JSON records original actual grade/report handlers sorting Khalid first by saved number 1 while displaying rank 5. Candidate browser JSON records the required `n119_alphabetic_display_roll_matches_old_new_students_stable_identity` PASS: five mixed old/new synthetic active students, including Arabic diacritic/equal-name ties; roster, grade item/table and report roster/grades agree on 1..5; explicit name/roll sorts and name/number filters preserve full-roster rank. Source CSS is loaded and the grade row's computed grid layout is checked. All non-device IndexedDB stores compare unchanged before/after, including owner bindings, source/student/enrollment IDs, saved enrollment numbers, scores, historical session/roster snapshot and outbox. Zero synthetic service commits/page errors. Syntax and whitespace checks pass.

Initial harness failures are preserved in `n119-1019-initial-fixture-failure.json` (old account descriptor lacked current provisioning provenance) and `n119-1019-initial-selector-failure.json` (report signature closing row included by broad selector). The harness now reuses `prepareNamesAccount` and excludes `.report-ending-row`; no Product guard was weakened. An intermediate harness edit decoded Arabic with Windows cp1256 and failed the fixture's upfront order assertion before browser launch; explicit UTF-8 restored the fixture before the successful runs.

Source SHA256 at browser verification:

- grades.js: `45899f905537f9818d16a61e575de5299d64a33c1dca95bef40b9e5918d496ff`
- reports.js: `42c934dd1c2c9ded052129e812386bb296c17fde17bda532a05391e842e7e873`

Local source readiness only. No push, deployment, Production or PO acceptance claim; sole controller/publisher owns delivery.
