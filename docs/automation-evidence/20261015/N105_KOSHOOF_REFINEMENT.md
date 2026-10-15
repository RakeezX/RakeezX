# N105 — Koshoof refinement (AI-authored)

Task: continuous-n105-koshoof-flow-clarity-and-grade-auto-review-20261015
Run: 71e1872c-acf8-4226-ad4a-f41170f07ab2
Base: c9c02a234bc3556a4ccea424ff4467e92f5437b5

## Delivered local scope

- One combined Students/Gradebook entrance to the existing shared class Koshoof workspace; Hub duplicates removed, populated Hub tile and class-list link retained. Paste/manual entry, distribution and account/archive guards retained.
- Import defaults to names only and offers a genuinely empty one-column names CSV before upload. Export offers names or populated selected grades; optional ID roundtrip and folded manual Noor 40/60 remain distinct. Class-aware download names strip forbidden paths, controls/bidi marks, collapse whitespace and bound the label.
- Existing persisted direct items match unique normalized name plus numerically equal original maximum, including Arabic digits/decimal equivalents. Explicit foreign owner/teaching metadata cannot link. Canonical Sync rows without redundant owner metadata retain their already guarded owner/database binding. Unknown, duplicate, conflicting or invalid numeric headers stay ignored. Known automatic/derived items are ignored, never proposed as direct writes.
- Unique strict-format new manual columns only prefill the existing new-item proposal, with confirmed:false and a fresh proposal ID. Existing per-item confirmation and final review/write/overwrite/enrollment guards remain. No backend/RPC/schema/scoring changes.
- Vertical mapping cards at all widths; identity columns are a nested disclosure, no orphan add-column selector. Concise counts and a useful Arabic unconfirmed-item message; 44px controls and checkbox labels.
- Recovery is reloaded for the exact transfer binding: render-time rebinding can follow onMount and previously discarded its pending recovery read. The current-object check prevents stale reads from another binding.

## Actual checks

| Check | Result / evidence |
| --- | --- |
| n105_single_entrance_roster_grade_and_no_duplicate_hub_buttons | PASS — actual authenticated synthetic UI routes, one combined entry, one populated Hub tile; empty Hub paste/add open and cancel. |
| n105_names_only_template_in_import_and_export_real_contents | PASS — actual downloaded empty template then upload/review; no template in Export; populated names/grades and optional ID contents. |
| n105_clear_safe_actual_section_csv_filenames_and_roundtrip | PASS — browser filenames use actual section label; focused file tests cover forbidden/control/bidi chars, label bound, BOM, formula escaping and opt-in IDs. |
| n105_rakeez_canonical_and_existing_grade_mapping_proposals | PASS — actual downloaded populated Rakeez CSV uploaded; five manual columns linked and advanced mapping closed. Unit cases cover normalized Arabic/Latin number equivalence. |
| n105_auto_and_ambiguous_score_columns_fail_closed_and_explicit_new_confirm | PASS — unknown/readonly/duplicate/max-conflict/nonfinite/unpersisted/foreign cases; actual new proposal refuses unchecked item and final unchecked confirmation sends zero RPC. |
| n105_browser_mapping_calm_320_390_768_1280_RTL | PASS — actual app HTTP DOM/handlers/CSS in fresh Chromium context, light/dark matrix, one mapping grid column, no horizontal page/panel overflow, visible controls >=44px, keyboard Space/Tab and RTL. 28 screenshots under test-results/n105-ui; visually inspected 320 and 1280 mapping. |
| n105_N90_owner_scoring_blank_zero_overwrite_and_N36_nav_preserved | PASS — actual account UI/store wrong owner, invalid lease, ownerless dispatch, offline, stale max, rejected-command history/explicit retirement and final consent; 12 capped to 10, zero recorded, blank preserves existing zero. Names-only leaves grades unchanged. Native local Postgres checks listed below. Reviewed JSON bridge remains folded, no direct portal extraction. |
| n105_central_design_study_only_no_report_or_batch_implementation | PASS — separate Arabic study; no class-list/report/print/PDF/backend diff and no central/batch route. |
| syntax_diff_and_owned_cleanup | PASS — node --check on changed JS/MJS and git diff --check. Shared browser lease acquired for this run and RELEASED after owned browser/server/native cluster cleanup. |

Commands: `node tests/n105-grade-header-suggestions.test.mjs`; `node tests/n105-grade-export-filenames.test.mjs`; `node tests/n105-koshoof-ux.test.mjs`; `node tests/n90-unified-native.mjs --unified-only`; `node tests/n90-unified-native.mjs --n105 --browser-only`.

Committed browser evidence: tests/n105-koshoof-ux-browser.json. Local native evidence: test-results/n90-unified-native/result.json. All service endpoints in this check were loopback fixtures; no real teacher/student, Auth or Supabase changes.

Native local checks (all PASS):
- unified_validation_atomicity: Unreviewed upper mark, negative/text, stale max/revision, enrollment consent, duplicate/existing name or identity and wrong section reject before any durable student/enrollment/grade/receipt.
- unified_late_score_rollback: Injected real PostgreSQL score trigger failure after student and enrollment inserts rolls back every row and receipt.
- unified_owner_exact_retry: Authenticated foreign owner cannot read or apply; same envelope/ID returns exact saved canonical student/enrollment/score receipt and never overwrites later score; changed-envelope reuse rejected.
- unified_blank_and_deleted_identity: All blank cells can enroll explicitly without inventing zeros; exact retry preserved. Deleted student ID is refused and never resurrected.
- unified_student_item_grade_all_or_nothing: Combined student/enrollment + explicitly named manual item + two score cells. Injected second-cell failure rolls back even the first score and new item/identity/receipt; success and exact retry retain stable IDs.
- unified_native_source_ACL: Exact additive SQL SHA256 e6ccfeb22b010324152c0c2037648e8c1be6e547487c991d73ccfeb8067906e3; new authenticated-only SECURITY DEFINER/empty search_path functions, existing locks/receipts/grade guards preserved. This is local readback, not remote service application.

## Failure history and corrections

Initial native run failed ENOENT writing test-results/n90-unified-native/unified-functions.json after its first five native checks. The allowed native runner now creates that existing output directory; a complete fresh native run passed all six checks.

The reused N90 account fixture lacked the current class-entry provisioning binding, producing a missing-entry wait timeout. The N105 harness supplies an owner-bound synthetic provisioning receipt/device context; Product guards were never disabled. The initial export unit fixture also omitted the per-student score context; its synthetic input was corrected.

An unchecked new-item attempt correctly raised GRADE_NEW_ITEM_CONFIRM_REQUIRED, while the initial harness waited for a successful review. The assertion now expects rejection, and the UI presents its Arabic instruction. A later actual recovery wait failure exposed the render/onMount binding race described above; the exact rejection remains in durable local history until the explicit retire action. The actual exported-file check then caught an overly strict new owner-metadata filter: Sync canonical rows omit ownerId by design. The final filter accepts that owner-bound representation and rejects explicit foreign metadata, covered by unit and actual guarded UI tests. Final complete browser run exited 0 with 12 checks, two synthetic native requests (one rejected, one consented), and zero page errors. Earlier failures are preserved here as failures, not relabeled as passes.

## Delivery boundary

LOCAL_READY is a local candidate result only. No push, deployment, Cloudflare provider/immutable/served-source checks or PO acceptance were performed by this worker. The controller/publisher owns those steps. No queue/status/resultPath edits. The central multi-class entrance and per-class-card replacement are study only in N105_CENTRAL_KOSHOOF_STUDY.md; no new Product ticket. N36 direct Madrasati extraction remains OPEN; N90 is not reopened. Reports vs export is discussion only; N23/N24/N102 untouched.

## Final product source SHA256

- `src/views/grades.js`: `9c9a3c217d915398ca357b2ffadc972c3dfb82cc5f8f0586b1f15d09f74403f5`
- `src/views/students.js`: `47821f365bd16e4a68bcb316a4691082a8b06c19f28ebb4842ba9cbf141b235c`
- `src/views/teaching-hub.js`: `ec044794aa64737f26ddf873b112c98f361f20e84b3ec75d9b446a42493fab86`
- `src/lib/grade-transfer.js`: `386ef9baa66ec39e9b313164f8b83c6dd0f39fbb291c042fffc50c360a398f42`
- `src/lib/grade-transfer-export.js`: `634e5dbd6f1abd31626eaa421ceedd13e30561814e0111d10df8ade7459feffa`
- `src/styles/grades.css`: `cdfc9dd21314fe7e8124897f6f5fb01db1b7af2356a45ee2ada20f458732fee4`
