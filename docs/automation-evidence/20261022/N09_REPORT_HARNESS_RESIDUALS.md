# N09 residual report harness correction — 23 October 2026

Task `continuous-n09-report-harness-residuals-20261023`, resumed run `7663fdb0-3ed5-4029-9124-6d04651f6509`; base `5e646ffbec90eb79861fa123373e88e336620808`. Source-only inert test correction, locally ready. No Product implementation, browser, account, service, queue, push or deployment operation. N70 remains CLOSED; this does not close N09 or certify the whole mobile application.

## Before and after

- The unmodified two-test command exited 1: cross-class setup dereferenced a null current context at line 27, and execution-report could not import `filters.css` under bare Node (`ERR_UNKNOWN_FILE_EXTENSION`). The exact new reproduction is retained in [before.txt](../../../tests/n09-report-harness-20261023/before.txt). It was captured during preceding run `433130a2-80e5-45f0-8970-2c82db20b429`; interruption did not erase it. The original retained N09 candidate's failure statements are unchanged.
- The task-local fixture now resolves an account through the existing synthetic-workspace helper and seeds fabricated owner-bound year/term records with the existing models and matching device selection. It checks the active year/term relationship and owner. Report rows are hydrated into fake IndexedDB and loaded by real `store.init()`. This read-model setup does not call guarded Product write commands, change the guard, fabricate an online lease, or provision a service account. The owner-switch check still deactivates the old workspace and resolves a distinct owner before checking both report views.
- Initial repair work exposed two further harness assumptions, preserved in [intermediate.txt](../../../tests/n09-report-harness-20261023/intermediate.txt): importing both suites in one process left a mounted workspace, and the obsolete print baseline still expected `window.print()`. The runner now preloads CSS handling into Node's normal isolated test-file processes. A prior in-progress fixture also hit `OFFLINE_LEASE_LIMITED` when attempting `store.save`; it was corrected to explicit fake-DB hydration without disabling any guard.
- The narrowly test-only loader verifies imported CSS files exist and supplies empty CSS side-effect modules. It passes every JS module through unchanged, including execution-report, view, store, confirmation and export code. These are Node logic/render-string checks, not new DOM/CSS/browser evidence.
- Final affected command exited 0: **3 PASS / 0 FAIL / 0 SKIP**. [after.json](../../../tests/n09-report-harness-20261023/after.json) records the actual result. All route, report reason, search/empty, CSV/BOM/numeric/private-field and owner-switch assertions remain. Normal top print + CSV and archive bottom print + CSV each have exactly one action per type.

Reproduce with the installed Node v24.19.0, from the repository root:

```powershell
node --import ./tests/n09-report-harness-20261023/run.mjs --test tests/n70-cross-class.test.mjs tests/n70-v21-print-labels.test.mjs
```

The fixture and preload are task-local. No package, shared helper or global test configuration changed.

## Contract-backed baseline correction

`docs/DECISIONS.md` D-100 V2.1/V2.2 and the CLOSED N70 row in `docs/PRODUCT_LEDGER_CLOSED.md` record the accepted normal header actions and distinct archive bottom actions. The test now asserts those placements and counts instead of a broad substring that could match the normal header itself.

The original `56998eff75a14120065d9802e575847dcc270b8f` baseline remains for filters and empty notices. Its entire print handler is still compared after exactly one explicit normalization: today's named `printReport(archiveRoute ? 'تقرير تنفيذ الحصص' : 'تقرير الحصص والحضور')` call maps to the old `window.print()` call. That change is recorded in commit `35b4ccc54d926360e024495087f5778eaba0519b` and `docs/automation-evidence/20261014/N24_CLEAN_PRINT_FILENAME.md` (unchanged filename/cancellation/exception behavior and actual report action evidence). Every other line of filtering, empty guard, identity confirmation, cancellation, profile/device persistence and delayed print behavior must match. Missing slice delimiters now fail explicitly. No blanket replacement of the baseline with current source was made.

## Retained actual application evidence

Reuse the immutable candidate **`3a10f0ae4a47d3231480bdfed70582d94ffb6835`**, file `docs/automation-evidence/20261022/N09_REPORTS_MOBILE_SLICE.md`, and its `tests/n09-reports-mobile-20261022/layout.mjs` actual application harness. The former records loopback HTTP Chromium checks at 360/390/1280, application DOM/handlers/CSS, keyboard focus, filter/reset, print handler and 44px actions. It also records existing N70 CSV **3/3 PASS**, including zero versus blank, formula protection and private-ID exclusion. Historical FAIL statements in that candidate are retained, not relabelled.

[source-binding.json](../../../tests/n09-report-harness-20261023/source-binding.json) records **17 identical Git blob pairs** between that candidate and this base: report views, store/models/router, report/CSV/print dependencies, report styles, existing CSV suite, HTML and dependencies. Comparing all `src`, HTML, package manifests and Vite config found only two pre-existing differences:

1. `src/styles/app.css`: exactly `--text-3: #64748b` to `#607087`; full CSS equality after that one color-token normalization. This permits reuse of geometry and interaction evidence, not an assertion of identical screenshot colors.
2. `src/generated/build-meta.generated.js`: only content build SHA and timestamp; all remaining metadata equal.

The current correction changes no Product file, so this binding carries through to its candidate. No screenshot matrix, Preview, browser, server or broad suite was repeated. Existing CSV 3/3 evidence is reused rather than rerun. Physical iPhone/Safari, Sync, offline-cache and Production acceptance are outside this result.

## Affected checks

| Check | Result | Evidence |
| --- | --- | --- |
| `n09_retained_render_evidence_source_binding` | PASS | 17 equal blob pairs; only exact color/build-metadata exceptions above. |
| `n09_cross_class_fixture_and_owner_csv_assertions` | PASS | First affected test executes real views/store; CSV/BOM/value/empty/owner assertions pass. |
| `n09_print_labels_module_loading_and_contract` | PASS | Two print tests load real JS with CSS-only preload; accepted placements and preserved confirmation/filter baseline pass. |
| `n09_test_only_changes_and_historical_failures_preserved` | PASS | Candidate scope is these two tests, task-local harness/receipts and this document; original evidence and FAIL receipts remain. `git diff --check` passes. |

The controller/publisher owns source-only publication and delivery evidence. No Product acceptance or deployment is claimed here.
