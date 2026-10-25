# N88 confirmed-lock public source dependency

AI-authored source-only delivery record, 2026-10-25.

Task: continuous-n88-confirmed-lock-ux-public-dependency-20261025
Run: ee607626-e14f-433d-9b8d-59df652c5e3e
Base: 28c35890bfb6fb2d782388b6e4ed3d861fb5cbb0
Immutable qualified parent: ccf5bc426fcdce8d0a9e6eaf117ce268b5a23e5e

## Exact source qualification

Read public-manifest.json, public-source.patch and qualification.json with git show from the immutable parent under drafts/n88-student-portal/activation/confirmed-lock-20261025/. No mutable parent worktree was used, merged or cherry-picked. All three working-file preimages matched the manifest. git apply --check --unidiff-zero and git apply --unidiff-zero succeeded. Git core.autocrlf=true initially produced CRLF outputs; only the two edited files were normalized to LF, giving exact target bytes below. No Git configuration changed.

Patch SHA-256: 87aa311b6fec4bb764fca1ea8d52e860b67755ebd8408571f298b68832969293
Qualification SHA-256: 2b9c7b082889befe45eda9f835ee91b7eaa4a1e01b96e7cbe5ce2b5a60181319

| Path | Preimage SHA-256 | Target SHA-256 |
| --- | --- | --- |
| src/lib/student-portal-runtime.js | 4542a6a48c16a25860d71daa7ab1b7edf7b3111014847c258d699f66e2f43636 | 98f6c7a97d1a9eea241e6e2a4db4e69d4d1e6a00d967e2dcd5d505669b2c742c |
| src/lib/student-portal-class-client.js | 815d82573f1e2c5d8eaa263de781fe98f26b0d14f1a1847f37ddec63b54c2d8e | 815d82573f1e2c5d8eaa263de781fe98f26b0d14f1a1847f37ddec63b54c2d8e |
| src/views/student-portal-class.js | 83c6781d11f5af58f377bd486e69cc18337809b737cc38872730c10cc2b705c0 | 22a7551b6e7e920dea46b223d980185febf6db7cc6415cf0c93a3165481ebd66 |

Unchanged published client815d matches both working bytes and base blob. Remote refs/heads/main was read with git ls-remote and remained 28c35890bfb6fb2d782388b6e4ed3d861fb5cbb0. Only the two qualified source files and this record are in the candidate scope; owner, Sync, grades, UNKNOWN, sourcePhase/sourceReason and all other current-main changes are retained.

## Affected checks

- n88_confirmed_lock_exact_support_copy: PASS through exact qualified target hashes and reused final-runtime three completed cases: actual_runtime_single_copy_busy_read_fixed_fields; single_copy_manual_fallback_owner_retirement; deadline_late_body_no_classification_revival. One finite same-request support snapshot retains source-lock/canonical-lock-contention, region and elapsed timing, clipboard/manual fallback and context fences.
- n88_confirmed_lock_actual_runtime_and_authoring_route: PASS only for the completed qualified cases. Reuse actual_guidance_empty_current_items_CTA_no_data_write from the four-case partial record because view bytes are unchanged; reuse write_uncertainty_separate_from_previous_confirmed_read from final write UI. Empty guidance links the existing current teaching items route and explains required/completed/scheduled fields; navigation introduces no data/default/publication/schema write. Write outcomes stay separate from read ACK.
- n88_confirmed_lock_current_main_preservation: PASS for exact preimages, exact targets, unchanged client and bounded diff. node --check on both changed JS files and git diff --check pass. No repeated browser or global build.

Reused original run: 6dc759b1-67b4-4c73-a68f-00c8d0033014. Evidence is retained unchanged in ccf5bc426fcdce8d0a9e6eaf117ce268b5a23e5e:tests/n88-current-terminal-fence-20261024/:

| Evidence | SHA-256 | Reused scope / retained status |
| --- | --- | --- |
| confirmed-lock-ui-three-pass-partial.json | 01cd9ca0df21272a3caa0bf87427bb88512636386812192ca1567592fa605584 | Three final-runtime cases PASS; whole file FAIL remains (later ready-state fixture timeout). |
| confirmed-lock-ui-four-pass-partial.json | 6ea006845d8d0c7e713561091cec367d0d51f94c85521ae561ff92e51b74932e | Only unchanged-view CTA case reused; whole file FAIL remains (disabled batch fixture timeout). Earlier runtime bytes differ and are not reused. |
| confirmed-lock-write-ui.json | 40a15fa2877356f69b1490f91d4ae261903c03eb4b1cb4e78ce4fa31f771a961 | Final-runtime write/read separation case PASS. |

All three evidence hashes were checked against qualification.json. Original initial/missing-subscribe/owner/partial fixture failures and previousAttempts remain in the immutable parent without alteration. No whole-suite PASS is claimed. The qualified harness imports actual application modules and source CSS over HTTP http://127.0.0.1:18895 in fresh synthetic contexts; its owned browser/server and lease were released. This worker opened no browser/server and acquired no phase resources. No service/native/carrier/account/message/SQL/fixture or user retry was performed. Native/adapter results in qualification are outside this public source acceptance and are not claimed served.

## Delivery boundary

LOCAL_READY is source-only. The independent solepublisher owns integration, deterministic metadata/build, publication and served-source receipt. This worker did not push or deploy. No service reliability, canonical contention repair, Production verification, PO acceptance or N88 completion is claimed. Queue and ledger are unchanged.
