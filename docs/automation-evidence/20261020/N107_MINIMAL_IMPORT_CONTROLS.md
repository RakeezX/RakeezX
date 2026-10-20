# N107 — minimal import controls

Task: continuous-n107-minimal-import-controls-20261020
Run: 893e0f66-5275-4ec0-82af-d1a1f9f435ab
Base: 82e990b0d5f1eaab2e995536d048f541cf976d3d

Latest canonical N107 row: PO-LATEST-IMPORT-UX, source n107-minimal-import-controls-20261020.json. Product remains open; this is local readiness, with publication and served-view verification owned by the independent publisher.

## Changed view

Removed «الوجهة ومحتوى الكشف» and its disclosure wrapper. Destination, existing class/subject, new grade/class code/subject and names/grades controls stay directly available, with their original handlers and disabled states.

The optional identity disclosure is hidden for ordinary imports. It is available when an ID column is already selected/detected, or an existing-class grade file has an unmatched or duplicate roster name. Its existing selection and DOM reader remain intact even while hidden: rendering does not reset idColumn, reviewed mappings, student choices or durable plans. Automatic export-header detection of «معرف الطالب» is unchanged. Duplicate row choice/confirmation remains in the actual review. No store, matching engine, coordinator, extension, archive or saved-plan code changed.

## Why «إيقاف المتابعة بأمان» exists

It is the explicit way to stop an unfinished background import plan rather than continue its remaining stages. It is not a delete or undo of a completed import.

Exact existing implementation inspected: localImportPanel and local-import-cancel in src/views/class-import-center.js; cancelLocalImport/useSlot/releaseSlot in src/lib/class-import-background.js; cancelClassFileImportContinuation in src/store.js (2892 onward at this base).

- Only nonterminal plans appear in the background section. Confirmed and cancelled records remain durable history and do not show the stop action. Normal pending work is collapsed; uncertain/needs_review opens the section with retry and stop. This visibility logic is unchanged. Added one short explanation inside that optional section, away from normal success.
- The handler calls cancelLocalImport(planId). It waits for the same owner/database Web Lock as the background runner; it does not interrupt an in-flight runner or abort a transport request. Context, lease, owner and database guards remain active. The plan's continuation slot is bound before cancellation and released in finally.
- Any nonsuperseded score:grade_import outbox command for that teaching blocks cancellation, including a rejected grade command. The existing command identity is retained for receipt recovery or rejection handling; stop does not silently discard or replay it. The view's existing failure toast says the unconfirmed request is retained and its receipt must be recovered first.
- For a locked maximum request whose outcome remains unknown, the store attempts confirmImportMaximums using the saved review/progress to recover its receipt. If it remains locked and unresolved, cancellation throws and does not mark the plan cancelled. This can involve receipt recovery; stop is not a promise of zero service work.
- Already acknowledged maximums stay accepted. Only this continuation's still-unaccepted maximum overlay may be restored to its prior maximum, with its outbox row marked superseded, after exact item/revision/score/other-command checks. Drift blocks cancellation rather than overwriting another edit. A rejected maximum can be released under those same checks.
- Successful cancellation clears the continuation checkpoint and marks the retained plan cancelled. Saved class, students, enrollments, grades, acknowledged changes and receipts are not deleted. Scores are checked for drift and not written by cancellation. Creation commands are not generally cancelled by this operation. If the runner completes first, a confirmed plan is rejected as a cancellation target.

These are inspected existing semantics, not new transport/cancellation certification. No cancellation behavior changed or recovery guard was relaxed.

## Affected verification

`node tests/n107-minimal-controls-20261020/browser.mjs`: PASS, named gate n107_changed_view_destination_identity_stop_semantics. One bounded changed-view scenario uses the actual HTTP application, source CSS, real file/mapping/review handlers, synthetic account store and actual ownership/lease checks. Existing served-demo and account fixtures are reused. No grade save or service apply occurs.

Verified direct destination controls including new-class fields; no removed heading; ordinary identity hidden while its reader keeps -1; automatically detected ID stays selected after the mapping handler; duplicate names retain explicit student selection in review. View-only plan fixtures verify terminal stop absence, collapsed pending stop with explanation, and open uncertain recovery. Desktop 1100px and mobile 390px have no horizontal overflow. mobile.png was visually inspected; desktop.png and follow-up.png capture the same real view.

Initial harness failures are preserved in initial-harness-failure.json and second-harness-failure.json. The fixture originally attempted to replace an already-hidden file input and read stale DOM; it now closes the unsaved review through the actual cancel action before choosing another file and waits for the unique filename. Duplicate student controls are checked after the actual review action, and disclosure visibility waits for repaint. No Product guard was altered to fix the harness.

`node --check src/views/class-import-center.js`, `node --check tests/n107-minimal-controls-20261020/browser.mjs`, and `git diff --check`: PASS.

Reuse N107_CURRENT_QUEUE_COMPACT_UX.md and N107_DURABLE_LOCAL_BACKGROUND_IMPORT.md for unchanged coordinator/outbox/durable completion and owner/reload safety evidence; the reported 186ms remains a prior local-save observation. No grades matrix, coordinator/reload tests, old benchmark, live account, remote browser, cloud operation, full build or repeated Preview was performed. Timing stays optional; no raw timing JSON is rendered by default.

Canonical withIsolatedLocalBrowser validated the active synthetic task/run and loopback origin, blocked external requests/Service Workers and closed its owned fresh browser/context in finally. The unique port 49807 server closed its connections and listener in finally. No shared live-browser lease is used for this eligible isolated phase. No push/deployment, queue/status edit or Product closure.
