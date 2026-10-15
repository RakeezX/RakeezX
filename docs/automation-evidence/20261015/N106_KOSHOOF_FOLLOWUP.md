# N106 — scoped local candidate evidence (AI-authored)

Task: `continuous-n106-koshoof-followup-ux-identity-mapping-20261015`

Run: `ad277a1f-fc36-4411-99ce-7b7542f8b321`

Base: `2b875721e8cee777489d8e99fb2a253065cdbb4e`

Authority: current N106 card and current N106 Product row; PO-20261015-N106-ROSTER-REVIEWED-MAP-UX. Local synthetic data only. No service, schema, Auth, RLS, real records, queue, push or deployment changes. The controller/publisher owns integration and provider/Production byte parity; those steps are NOT RUN here.

## Result

- Modest green template uses existing theme tokens; both named CSV export actions use the same primary green appearance. Actual named downloads and Noor controls retain their functions.
- Students has one Koshoof link in the real top toolbar on empty/populated rosters, beside the explicitly named quick paste action and existing add-student control. Mobile actions remain 44px high.
- One mapping disclosure contains identity and manual item mapping. Every remaining nonmetadata/nonreadonly heading is available, including an unknown fourth grade column, initially ignored. Selected/ignored headings are summarized; new item maximum consent remains explicit.
- Ambiguous names require a row-specific current-class roster choice and explicit per-row confirmation, followed by separate final review approval. Display labels use names and roster numbers, never raw IDs. Unique names remain automatic; legacy ID columns remain supported but cannot override a different name/owner/class.
- Choices bind owner, database, teaching/section/term/revision and reviewed roster identity/revision/enrollment/roll information. Foreign, missing, renamed, revised, switched and duplicate choices fail closed. The actual UI rebuilds and compares the review before calling the existing N90 save. Identity controls are locked during saving. Service command shape and RPC are unchanged.

## Affected verification

`node --test tests/n106-ambiguous-student-selection.test.mjs tests/n106-grade-add-column.test.mjs`: 5 PASS. Includes zero/blank, inert ignored fourth column, explicit new maximum approval, one-to-one choices, stale owner/database/student/enrollment/section/revision, missing file row and valid/invalid legacy ID cases.

`node --test tests/n106-ambiguous-student-selection.test.mjs tests/n106-grade-add-column.test.mjs tests/n105-grade-header-suggestions.test.mjs tests/n105-grade-export-filenames.test.mjs`: 7 PASS (later added missing-row/enrollment/roll cases independently rerun above).

`node tests/n90-unified-native.mjs --browser-only --n106`: actual application DOM, source CSS, handlers and authenticated synthetic account/store against disposable native PostgreSQL over task-owned loopback HTTP, fresh browser context, Service Workers/external requests blocked. Shared browser lease matched this task/run. Detailed checks, synthetic request envelopes and 60 screenshot names are in `tests/n106-koshoof-browser.json`; local images are in `test-results/n106-ui/`.

| Required check | Evidence |
| --- | --- |
| n106_template_soft_green_and_two_green_export_actions | Actual computed styles, downloaded CSVs and template/export screenshots at 320/390/768/1280, light/dark. |
| n106_roster_toolbar_single_koshoof_and_quick_paste | Both empty/populated real routes at all eight viewport/theme combinations; one toolbar Koshoof link and two usable labeled toolbar targets inside viewport. Existing guarded paste/add paths retained. |
| n106_flatten_one_grade_mapping_disclosure | Actual DOM asserts no nested details within mapping; exact mappings collapsed and unresolved mappings open. |
| n106_readd_unmapped_fourth_grade_column_manual_selection | Actual CSV and XLSX uploads, fourth unknown heading explicitly mapped to a current manual item; zero reviewed under unchanged values, no transport from upload/selection/review. |
| n106_ambiguous_name_choice_confirm_current_class_owner_only | Ambiguity initially blocks; choice alone still blocks; per-row approval enables final review. Two identical-name rows choose different current students, stale student revision blocks before transport, re-review clears final consent, then one native atomic save commits exactly 1 and 2 to the chosen identities. |
| n106_N90_grade_zero_blank_max_retry_owner_regression | Actual account UI rejects foreign owner, invalid lease, ownerless dispatch and offline confirmation. Native stale maximum rejects the entire batch, retained rejection is explicitly retired, fresh approval saves capped 12→10 and zero while blank preserves existing zero. Names-only import sends no grade RPC. |
| n106_live_dom_mobile_desktop_no_clipped_select | 60 source-app screenshots, RTL light/dark at 320/390/768/1280; mapping/export overflow assertions, >=44px controls, bounded identity selector, keyboard mode controls. Desktop/mobile emulation, not physical-device certification. |
| syntax_diff_and_owned_cleanup | Node syntax checks, UTF-8 inspection and git diff --check. Browser/server finally cleanup and disposable native cluster removal; owned shared lease released after browser phase. |

The original `node tests/n90-unified-native.mjs --n106` invocation also printed all 12 existing unified/native checks PASS before reaching a fixture mismatch in the UI phase. These unchanged service proofs are reused: validation/whole-batch atomicity, late rollback, owner isolation, exact retry/lost ACK, blank/deleted identity, explicit item creation and SQL ACL. SQL/service code was never edited.

## Preserved failures and bounded harness corrections

- Initial combined native/UI execution added two manual fixture items before the five-item UI fixture (`7 !== 5`). Browser-only mode separates those existing phases.
- A fourth-column zero equaled an existing zero; the assertion incorrectly searched only visible changed rows. The test now opens the existing unchanged-values disclosure before inspecting that row.
- A matrix setup attempted cancellation with no file loaded; it now cancels only when the cancel control exists. Choice assertions also wait for the app's scheduled render rather than reading the prior DOM immediately after an event.
- After all 17 N106 UI checks passed, the runner incorrectly fell through to the older N90 browser scenario and hit `23505 sections_pkey` for `empty-section`. The N106 switch now excludes that unrelated second scenario.
- Additional legacy `tests/n90-transfer.test.mjs` run: 9 PASS, 1 FAIL in “suggestions require unique exact headers and current unique manual targets”. Its lowercase `exam` assertion expects ignore, while unchanged base `suggestGradeMappings` matches `Exam` after normalization. Readback of `git show HEAD:src/lib/grade-transfer.js` before candidate commit reproduced `[{"kind":"existing","itemId":"i"}]` for that input. The suggestion function is unchanged; this old assertion was not edited or represented as PASS. Current focused N105 suggestion tests pass.

No Production or PO acceptance claim is made by this local evidence.

## Saved-session continuation — 59ad956f-ace2-4013-98dd-37bce0227c30

Preserved implementation candidate: `0df248db38db80acae5996970a13ae9dc8c75553`. Fresh readback confirmed a clean worktree, the same N106 Product row, and the active continuation card. Existing 17 browser checks/60 screenshots and native proofs remain reusable: Product sources, fixtures and dependencies were not changed in this continuation. No browser/server or live phase was started.

The previous result was rejected with `Candidate validation: An affected check must pass and no recorded check may fail`. The recorded legacy assertion remains a real failed on-disk check; it cannot be silently omitted or relabeled PASS. Its scoped correction needs `tests/n90-transfer.test.mjs`, which is absent from this card's `allowedPaths`. The original test was therefore left untouched.

Read-only preparation verified the concrete correction in memory against the actual current modules: move `['exam']` out of the rejection cases and explicitly assert its existing normalized mapping `{kind:'existing',itemId:'i'}`; replace that negative case with `['Exam extra']` so a genuinely different name still must be ignored. All other duplicate/max/read-only/owner/grade assertions were retained. Running that in-memory version through Node's test runner produced **10 PASS, 0 FAIL**. This validates a proposed test repair, not the unchanged on-disk test. No Product behavior or security guard was weakened.

**Blocked retry condition:** the approved inactive-card maintenance path must add exactly `tests/n90-transfer.test.mjs` to the saved N106 card's allowed scope, preserving the saved session, base and candidate lineage. The controller can then resume this session to apply the above two-assertion correction and run the focused on-disk test. Existing unchanged UI/native evidence should be reused. The worker did not edit queue status, maintenance locks or controller files, and did not launch another executor.
