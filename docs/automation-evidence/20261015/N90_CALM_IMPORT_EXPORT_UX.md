# N90 — calm, separate import and export (AI-authored)

Task: `continuous-n90-grade-import-export-calm-ux-20261015`
Run: `102a28c8-0c17-4512-b316-14b5b32b119d`
Base: `c4931b453aca0c9922f1f64639fb447eb2db82fa`
Candidate: the AI-labelled commit containing this report; exact SHA in worker result.
Worktree: `C:/Users/Abody/Projects/RakeezX/.worktrees/continuous-n90-grade-import-export-calm-ux-20261015`

Read canonical operating contract, activated card, current canonical N90 row and inherited N90 service evidence. Implemented only the approved front-end/CSV scope. No queue/status update, push, deployment, hosted operation or real data mutation.

## Result

The existing grade toolbar now has separate «استيراد الكشوف» and «تصدير الكشوف» actions beside distribution. Panels are mutually exclusive and closed initially; explicit `?import=1` / `?export=1` opens only its panel. Empty-class student action remains visible. Parsed file and review survive same-workspace/class route returns and panel switches; confirmations are never persisted. Workspace/class changes discard the previous import binding. Mode changes preserve parsed rows/mappings but require a fresh review.

Import has exactly two keyboard-accessible mode buttons, literal true/false `aria-pressed`, names-only default, and retained focus after repaint. Names-only still confirms through N12; grades still uses existing reviewed owner-bound atomic RPC with enrollment/overwrite consent. Both modes use the audited bounded reader plus strict formula/duplicate-cell checks before any later mode switch could expose scores. File selection, mode switching, review and cancellation do not save data. Sound mappings are folded, unknown columns alone open with ignore guidance, and ordinary labelled DIV cards replace fieldsets. All exact safe suggestions are retained behind the folded editor.

Export item checkboxes wrap as compact cards. Blank manual-item template and filled selected-item CSV have separate descriptions and filenames. Ordinary CSV contains name + selected score columns, with no internal metadata or ID. Optional explicit Rakeez advanced ID export supports duplicate-name roundtrips. Ordinary unique-name matching remains safe; duplicate identities are rejected without guessing. Formula-injection quoting is unchanged.

Noor remains inside export, initially folded, with two group descriptions only once, short 40/60 menus, visible current maxima and explicit consent. Reassignment/selection resets consent. Existing exact 40+60 validation and three-column manual-only CSV are unchanged; zero remains zero and any missing mark keeps its group blank. No claim of direct official Noor upload.

## Affected verification

- `node --test tests/n90-transfer.test.mjs`: **10/10 PASS**. Existing zero/blank/cap, ambiguous identity, explicit new enrollment/item, CSV/XLSX limits, formula protection, Noor maxima/duplicates preserved; new ordinary/advanced CSV identity roundtrip check.
- `node tests/n90-unified-native.mjs --unified-only`: **6/6 PASS**, existing scoped PostgreSQL guards reused. Invalid/stale/consent cases, late-score rollback, foreign owner, exact retry without overwriting later edits, deleted IDs, blank enrollment, combined student+item+scores, ACL. No service change.
- `node tests/n90-unified-native.mjs --browser-only --calm`: **8/8 PASS**. Focused actual HTTP app UI check; final outcome and source hashes are recorded in `tests/n90-grade-ux-standalone.json`. The canonical isolated-local helper supplies a fresh owned Chromium context restricted to its owned loopback origin with SW/external requests blocked. Existing served-demo readiness, synthetic account/store fixture, XLSX fixture and native PostgreSQL runner are reused. The shared live browser lease is not acquired for this eligible isolated phase.
- Twenty-four source-CSS matrix screenshots (names-only chooser, mapping and Noor export; light/dark; 320/390/768/1280) under `test-results/n90-calm-ui/`; four additional default/empty/names-review/grades-review screenshots at 390px; representative light 320px mapping/export, dark 320px names-only and 1280px export visually inspected. Assertions cover page/panel overflow, labelled controls >=44px, mutually exclusive panels, keyboard Space/Tab and correct ARIA. Generated screenshot hashes are in the compact JSON.
- Syntax checks for changed JS/MJS and `git diff --check`: PASS at final verification.

## Corrections and retained evidence

Initial focused checks exposed mobile toolbar overflow and empty false ARIA values from the shared template serializer. Fixed wrapping in scoped grades CSS and emitted explicit string ARIA values. Added stable focus keys. Test-only corrections: locate export marks by header rather than assuming item ordering; wait for actual repaint; initialize the real lease's workspace binding before deliberate invalidation (the earlier unbound invalidation was renewed on binding and allowed one synthetic mark). Every affected synthetic fixture was disposed; no real data was involved. A new unnecessary reload branch timed out waiting for the import panel after synthetic account reactivation; removed that branch and reused unchanged prior boot/offline evidence, refreshing revisions in one live synthetic document instead. The actual failed stale-max request and rejected outbox history are retained and explicitly retired through the existing UI before a new batch; no failure is relabelled as success.

Inherited service application/readback and current-source Sync/history/offline-shell evidence in `N90_UNIFIED_SERVICE_RELEASE.md` remains unchanged. No SQL, backend RPC, store/cloud/ownership/Sync code, shell dependency, teaching-hub or students view changed. This ticket adds no startup module, so no new offline-shell dependency. Production, Cloudflare immutable and served changed-asset verification remain with the independent controller/publisher, and were not performed here. Local readiness is not Product acceptance.
