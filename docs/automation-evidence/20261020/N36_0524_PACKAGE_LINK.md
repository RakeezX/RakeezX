# N36 verified 0.5.24 download link

AI-authored scoped change, 20 October 2026.
Task: `continuous-n36-0524-verified-package-link-20261020`.
Run: `6bba93d2-7477-4560-9c33-e06d2f20b5a0`.
Base: `77915580a01ee4ea2fc9e50d6a5358f77452d110`.

Only the current extension download href and label in `src/views/class-import-center.js` change from 0.5.23 to 0.5.24. The download attribute and every other byte of the view, including N107 controls, imports and handlers, remain unchanged.

## Prerequisites and reused evidence

The existing N36 route/compact-popup publisher receipt binds candidate `9c7a9b7f845499d1e2b0122b1b9609a941b84c59` to published parent `77915580a01ee4ea2fc9e50d6a5358f77452d110`, provider SUCCESS, verified `2026-10-20T18:37:33.000Z`. Its immutable and Production archive/manifest checks match the local committed bytes. Archive SHA256: `901858c399b04d2c229ae9cea055e83df5d89030fa29c884414380f5608dbd82`, 134818 bytes. Both package descriptor and packed extension manifest specify 0.5.24.

The existing N107 minimal-controls publisher receipt binds candidate `8e240a028dc9e0e890c7e73b1520d662dbc614b4` to published `489372c98e6fc1932ea8975763fdcf0c8773391a`, provider SUCCESS, verified `2026-10-20T18:35:31.373Z`. That published commit is an ancestor of this base. Its verified immutable/Production view SHA256 `95769f53d0e22ddebe207480193eb635bd370cb4ae292bb0f48fbef9d8a7a6f9` equals the entire pre-change view.

These are reused independent publisher observations, not fresh provider operations by this worker. Detailed source-bound URLs and hashes are captured in `tests/n36-0524-package-link-20261020/result.json`. Reuse the unchanged actual-app rendered evidence in `N107_MINIMAL_IMPORT_CONTROLS.md` and prior native download evidence in `N36_ACTUAL_POPUP_PACKAGE_DOWNLOAD_LINK.md`; no new rendered-UI PASS is claimed.

## Affected verification

`node tests/n36-0524-package-link-20261020/check.mjs`: PASS, required gate `n36_exact_0524_verified_archive_download_link`. Extracts the unique current link and exact Arabic label, proves only the two version substitutions changed, checks view syntax, validates the immutable archive hash/size and internal manifest, and verifies both delivered prerequisites against their existing immutable/Production receipts and Git ancestry.

`git diff --check`: PASS. No full build, extraction/Start/grades matrix, repeated Preview, browser school/account access, real data operation or new package. No browser/server resources were acquired. No push, deployment, stable-updater change or queue/status edit. The independent controller/publisher must verify the changed served view and actual archive href; this local result does not claim Product acceptance or closure.
