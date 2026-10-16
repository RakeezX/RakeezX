# N107 — final single Koshoof hub (AI-authored)

Task: continuous-n107-final-single-hub-direct-excel-20261016  
Run: bcdfed8f-0c1b-426e-8e0f-4fddf30ba80c  
Base: 713889200cfa5596cded4044c333eedc911f6f3c (also observed origin/main via ls-remote).

The activated card supersedes the saved overnight hold. Canonical operating contract, latest canonical N107 ledger row and the exact saved PO note were read. The note is absent in this base checkout; its canonical repository copy was used read-only.

## Bounded implementation

- Classes has a primary Add class, calm “استيراد وتصدير الكشوف”, and one upper-left Demo button beside trash. Delete/Demo handlers are unchanged.
- All central and legacy teaching Koshoof routes load the same view. Legacy teaching links replace navigation with the central route and guarded preselection. N90 mapping, explicit confirmations, owner/session/lease guards and receipt recovery moved out of grades.js into that single hub; grades retains only its entry link.
- One import/export tab is visible at a time. Import chooses either manual metadata/new single class or native existing teaching selection. New class parsing still reads only names and never writes on preview. Successful imports show human class/subject/year/term, counts and class link. Existing-grade review still refuses unacknowledged local teaching revisions.
- Export creates an array of independent protected N108 XLSX workbooks. No outer ZIP. At most three automatic download requests occur synchronously per gesture. Every prepared file has an individual button. The UI reports requests and asks the teacher to check browser downloads; it cannot observe browser completion or silent blocking. Individual buttons rebuild under current owner/year/term guards. No timers drive download bursts, no popup/network/directory workaround. Blob revocation uses bounded cleanup.
- Filenames retain sanitization and deterministic collision suffixes; class labels include subject/year/term. No student IDs, formulas, mixed rosters or merged workbooks. Dedicated explicitly confirmed Noor CSV remains, with its item/group selectors; ordinary export is XLSX only.

## Actual affected verification

`node --test` on n107-final-single-hub, n107-unified-koshoof, n107-central-entry, n107-classes-import-parser, n107-classes-import-mutation, n108-xlsx-export, n12-student-import, n104-class-operations, n90-transfer, n105-grade-export-filenames and n105-grade-header-suggestions: **39 PASS**, zero failures. Expected injected storage failures were asserted as rejections, not ignored.

`node tests/n107-final-single-hub-browser.mjs` and `--file-variants`: actual source application over task-owned http://127.0.0.1:49227, fresh disposable contexts and synthetic account/store/backend fixtures, external requests blocked. See committed tests/n107-final-single-hub-browser.json for checks, source SHA256 identities, preserved earlier harness failures and cleanup. The recorded Git HEAD is the checkout base; the file hashes identify tested working source included in this candidate.

Coverage: 320/390/768/1280, light/dark toolbar and hub, overflow and keyboard; manual CSV/XLSX import, ambiguous names/column selection, no automatic write, cancellation and explicit commit, friendly receipts, real synthetic storage failure and safe retry; central/legacy teaching preselection; existing-class names preview/unconfirmed refusal/confirmed addition; grade zero preview with explicit mapping and required confirmation; direct single/multiple binary XLSX separation; simulated silent suppression followed by individual download; owner/term/archive/session/expired lease refusals; fresh controlled Demo Service Worker offline reload of affected routes. Actual guard rejects newly created local teaching grade review until a synthetic acknowledged parent/child revision fixture is installed. No guard was disabled.

The toolbar Delete entry opens the existing first selection step, with no destructive confirmation yet and no writes, then cancels. The unchanged second-step implementation is retained and covered by scoped source inventory; no new live Delete proof is claimed. Existing-grade service commit/receipt semantics reuse unchanged N90 evidence; no real backend operation was run.

Syntax checks: changed JS modules. `git diff --check`: PASS. Screenshots inspected from test-results/n107-final (generated local evidence). No full build or production verification claimed. No new startup asset dependency or service change; actual offline reload confirms existing shell coverage.

## Harness corrections and resources

Earlier local harness failures remain in browser JSON: asynchronous tab paint required waiting for the actual control; term change correctly resets the hub to Import; the newly created class correctly failed N90 grade review without serverRevision; the fresh fixture does not provide server deletion planning, so the new toolbar check stops at selection/cancel and reuses unchanged second-step safeguards. These were local fixture/expectation corrections, not bypasses of a real tool/service rejection.

Canonical browser lease was acquired/released for each browser phase with this task/run token. Owned fresh contexts/browser and unique loopback server close in finally. No user browser/profile, real identity, portal, external service, queue/status, locks belonging to others, push or deploy. Publisher owns integration/provider/served verification. N107 remains subject to genuine PO acceptance.
