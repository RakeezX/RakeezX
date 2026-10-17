# N36 — background report fetch and explicit saved-receipt journey

AI-authored scoped implementation, 17 October 2026.
Task: continuous-n36-background-report-fetch-and-save-journey-20261017
Run: 435d507d-d423-48ff-bd40-c5ab56358a91
Base: e5aa4d4e5378e98a5d75a641ce341074cbfe0512 (HEAD and freshly fetched origin/main at start).

## Authority and result

Latest activated PO card supersedes D-124 activation timing only. D-123 explicit partial consent and per-class Rakeez confirmation remain. Source schema references were read from the canonical checkout: N36_TWO_REAL_MADRASATI_TABS_READONLY_20261017.md and N36_UPLOADED_SOURCES_REVIEW.md; no actual school browser, students or teacher account were accessed. No service operation, real write, automatic save, stable-runtime update, Chrome installation, push or deployment occurred. N36 remains OPEN.

The voluntary 0.5.5 observation remains staged=300, lower bound=300, complete=0, receiver-only evidence, and no verified Rakeez save. This synthetic result does not change that observation.

## Implementation

The source-tab isolated-world reader fetches only discovered exact ClassStudentInfo GET hrefs after visible teacher/school binding. Three readers maximum; eight-second request timeout, cancellation registry, source-URL/role recheck, origin/school/path/query and redirect/content/schema rejection. The extension keeps connect-src none and its existing permissions. Report pagination never calls tabs.update; existing non-report role/metadata/timetable navigation remains separate. No automatic visible fallback.

One maintained reader/parser accepts either live visible DOM or inert fetched HTML with explicit static hidden-node handling (no detached getClientRects assumption). The fetched nine-header report emits only names/classes and school binding, ignoring contact/account/guardian cells. Pagination retains actual hrefs, processes pages deterministically despite out-of-order responses, and requires all page identities plus terminal proof and no conflicting total. Unknown/failed coverage stays partial. The 300-row review window continues explicitly; no teacher-total cap was added.

Only the reviewed source class is handed off. Existing encrypted one-time, owner/year/term-bound receiver, explicit teacher confirmation, deduplication and local/pending-Sync receipts are unchanged. Unknown/failed receipts cannot advance the cursor. Diagnostic details are collapsed; redundant instructions are hidden during review; classes, counts, warning, consent and next action remain visible.

## Actual verification

Browser evidence: [n36-background-report-fetch-browser.json](../../../tests/n36-background-report-fetch-browser.json). Harness reuses the existing actual MV3 toolbar and real application/account fixture over HTTP/HTTPS; every portal and app remote request is intercepted into synthetic fixtures before network access. Fresh owned disposable Chrome profile, shared browser phase lease, task-owned loopback server; all owned resources closed and lease released in finally.

21 focused scenarios PASS. Full350 transferred=350, locally added=350, batches=20 across ten source classes and two windows. Browser network event measurement maxParallel=3; reportNavigations=[], externalRequests=[], page errors=[]. Actual extension RTL 445px and receiver 390px inspected. Screenshots are in ignored test-results/n36-background-report-fetch/extension-445.png and receiver-390.png.

Original failures remain in JSON priorFailures: the initial synthetic homepage omitted an existing required teacher-navigation marker; the fixture was corrected without weakening the role guard. A later harness concurrency assertion counted delayed route handlers after browser request cancellation. It was corrected to count actual browser request/finished/failed events, and timeout plus current parallel scenarios were rerun. No Product rejection was relabelled as a pass.

The final HTML/CSS-only diagnostic collapse reused successful transport/receipt cases only after matching every JavaScript module and all affected app hashes; reusedEvidence retains the original ZIP and per-file hashes. The updated actual HTML/CSS was exercised by the owner scenario and visually inspected. Repeated/conflicting pagination and timeout were separately verified. This avoids repeating the unchanged 350/student receipt journey.

Commands: `node tests/n36-background-report-fetch-browser.mjs` with bounded N36_ONLY scenario groups; `N36_BROWSER_PROOF=1 node tests/n36-background-report-fetch.test.mjs` (3/3 PASS); source/controller/class-import-center syntax checks; `git diff --check`.

- **n36_exact_report_fetch_bounded_parallel_no_source_tab_navigation — PASS:** Actual installed MV3 toolbar action; source-context GET requests overlap with maxParallel=3, no report navigation requests. Only validated observed exact-report hrefs, no fallback.
- **n36_observed_pagination_class_grouping_continuation_and_honest_partial — PASS:** 350 rows, 50/page, ten interleaved row classes; first window 300, final tail 50; 20 class-reviewed transfers, 350 locally added. Repeated page, conflicting total and failed-page partials remain incomplete.
- **n36_auth_origin_school_role_cancel_timeout_expiry_and_privacy_guards — PASS:** Auth HTML, auth redirect, non-HTML/schema, foreign origin/school, unsafe query, school/role changes, network, timeout, outstanding-request cancel/context switch and review expiry negatives. Only labelled name/class/school fields returned, no extra permissions; transient session transport only.
- **n36_synthetic_continue_class_handoff_confirm_saved_existing_unknown_receipts — PASS:** Actual Rakeez DOM, owner-guarded N12 confirmation/store; preview makes no writes. Successful local receipts, failed transaction retry, and lost receipt followed by deduplicated existing receipt. Unknown receipt blocks advancement.
- **n36_no_automatic_write_owner_term_dedup_and_affected_regressions — PASS:** Actual authenticated synthetic owner/lease failures keep database unchanged. Explicit confirmation, one-time claim rejection, failed transaction recovery, repeat dedup and unaffected teacher-setup-import/handoff/protocol guards retained byte-for-byte. No store/Auth/RLS/schema or term policy changes.
- **n36_056_package_local_SHA_source_binding_and_RTL_usable_summary — PASS:** 3 focused package/window/browser-binding tests PASS; every archive file matches source/hash, old 0.5.3–0.5.5 packages preserved. Actual extension 445px RTL and Rakeez receiver 390px inspected without horizontal overflow. Central download points to 0.5.6. Existing offline shell already caches class-import-center.js; no new dependency.

ZIP SHA256: `19fb0cafb0b4ec1867c9d4de7d8833be264df028fcdfcbe46f21c085b1cdc6b7`; bytes=96682. The package manifest binds all shipped source bytes and records the application base. Official-account extraction/continuation/save and publisher provider/immutable/Production parity are **NOT_RUN** by this worker.
