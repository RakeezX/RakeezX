# N121 — lesson card navigation

- Task: `continuous-n121-lesson-card-target-actions-20261019`
- Run: `32d00c6d-c3c6-4b76-ab26-0396607ab078`
- Base: `80d7a264596cb38c1856796c0c30c23dbbb6b49f`
- Authority: activated N121 card and canonical Product ledger N121 PO19October row.

Current lesson, remaining lessons and needs-attention card bodies now open their teaching hub. Attendance actions and completed-attendance text are separate native sibling links retaining the clicked session ID. The existing attendance route resolves the saved session's date; no current-session fallback, router rewrite, write handler or startup dependency was added. Native links support keyboard and browser link operations without nested click propagation.

## Affected verification

`N121_RUN_ID=32d00c6d-c3c6-4b76-ab26-0396607ab078 node tests/n121-1019-navigation.mjs` — PASS.

[Machine evidence](../../../tests/n121-1019-navigation.json) records actual application HTML, source CSS, store, router and attendance UI served over a task-owned loopback HTTP origin using the canonical isolated-local-browser helper and existing served-demo readiness helper. A disposable Demo context contains two fabricated sessions of the same teaching. At 390 and 1280 pixels, pointer clicks on rendered class text and Enter on class links reach the teaching hub. Review, completed and pending attendance actions select the exact session in the mounted attendance switcher, including the past session while another session is current. Navigation preserves attendance, students and scores. No page errors or horizontal overflow were observed.

The first rendered body-click check exposed an existing focus-content stacking layer above the new link. [Preserved failure](../../../tests/n121-1019-layering-failure.json) records the hit element and original timeout. The final implementation resets that content stacking level while retaining attendance links above the class link. Initial fixture setup also encountered an occupied Demo timetable period; the fixture uses distinct periods 10/11 and evening times. An incorrect harness selector for the teaching hub was corrected to its actual `.class-hub-header`. Final affected verification passes after these concrete corrections.

`node --check src/views/home.js` and `git diff --check` — PASS. No full build or unrelated suite was needed for this bounded navigation change. No owner, Sync, grades, identity, history or write guard code changed; this is not a live account/Sync certification.

The helper closed its fresh contexts/browser in finally; the test closed its own ephemeral-port server in finally. This approved isolated synthetic phase does not acquire the shared live-browser lease. No credentials, external service, real records, queue/status edits, push or deployment were used. The sole controller/publisher owns integration and Production evidence; this result is local readiness, not PO acceptance.
