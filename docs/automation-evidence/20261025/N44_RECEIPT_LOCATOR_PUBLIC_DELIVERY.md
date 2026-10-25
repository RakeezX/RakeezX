# N44 — qualified receipt locator source candidate

- Task: `continuous-n44-receipt-locator-public-dependency-20261025`
- Run: `b0a5c9f1-e926-4e1c-984e-80ef28a18335`
- Base / observed origin/main: `a0d6d00b5a458086a137075fa22b3d2fb75b6d7d`.
- Immutable qualification parent: `e0200214b9165ca67aa86fb3f62b77eb207de082`.
- Authority: activated N44 source-only card and latest canonical N44 ledger note `[N44-RECEIPT-ID-LOCATOR-20261025]`; operating contract and D-107 retained.

Only `src/store.js`, `src/lib/cloud.js` and `src/lib/sync-v2.js` receive the qualified delta from `drafts/n44-push/activation/source-recovery-receipt-locator-0f937299/source-only.patch` in that immutable parent. No private branch merge or cherry-pick. Explicit `recoverCleanupMutationId: true` with a null/absent ID permits recovery from exactly one canonical owner/device/target/original tombstone-stamp lifecycle DELETE receipt. Envelope and result must agree on the original mutation ID. Known-ID behavior remains fail-closed; missing, ambiguous or mismatched receipts produce zero writes. Owner/writable-lease fences, definitive 42501 rejection, never-dispatched child, transactional CAS and saved history remain intact.

## Qualification checks

`n44_unique_canonical_receipt_locator_exact_source`: PASS. Read manifest, patch, prepared targets and evidence with `git show` at the immutable parent. Patch SHA256 `89668d342a8d2b1f77b7c9534563a592359203b2a5ce7773a6563373cf810263`; evidence SHA256 `817f185633fbaf41ca0374321879492da52c30d8a86a34591cb2a844915d807e`. Forward `git apply --check` and final reverse patch check passed. Node syntax checks passed for all three files.

| File | Revalidated preimage SHA256 | Final target SHA256 |
| --- | --- | --- |
| `src/store.js` | `a7cb0c5ba78b927be77dc55dc202ef1a08cfc60a4c875576870d4481e7df7e75` | `cb315792d6bdd7146b21f04b4b1551fb68560e1de2b6151ddb71835e9cbec3ec` |
| `src/lib/cloud.js` | `2a37477bf52fab67d6b26cd345f5719d219932d1ab8e9b1d6758c8a55d93b63c` | `7247bacfc0aea9d3a3f6a14b78b456d30899be04c38e6c5965b6b1ef825d80f7` |
| `src/lib/sync-v2.js` | `79b7105e4ae06fd0329c22c272a8bd5f65e92afd3f3c0f92d179b7157361f719` | `f2382cafc23375bfc2cd93d2c0e7098b0c7fc1071d4f78ba44e143a8534dacb2` |

The first post-apply byte-hash assertion detected Git's CRLF working-copy conversion; all three normalized contents matched the immutable prepared targets. Saved their exact qualified LF bytes without changing Git configuration, then all target byte hashes and syntax checks passed. This was a local representation mismatch, not a failed Product guard.

`n44_locator_owner_receipt_and_cas_guards`: PASS by reuse of the unchanged 14 actual-prepared-module checks in `tests/n44-current-closed-page-followup-20261024/source-recovery-receipt-locator-0f937299.json` at the immutable parent. Exact target bytes bind this candidate to that evidence. Coverage includes store writable lease, explicit-mode requirement, one exact GET/canonical original ID, missing/ambiguous receipt, wrong device/stamp/request ID/result ID/command, known-ID mismatch without fallback, owner switch during read, never-dispatched dependent and concurrent command CAS. These checks were not rerun; no rendered-UI PASS is claimed.

`n44_locator_current_main_preservation`: PASS. Clean initial worktree and HEAD matched the card base and observed origin/main. All three preimages matched before application; final source hashes matched the manifest. Source diff is exactly 16 added / 12 removed lines across the three files. The identical 19 existing trailing-whitespace lines were retained. Newer N36/N88/Sync/grade/delete/UI source outside this exact delta is preserved. This evidence document is the only additional path.

## Disposition

Source-only LOCAL_READY. Prior served `7854ca29af1aa4f7bb50f30e13dac38b101d6a0d` known-ID guard behavior remains valid; original fixture custody omitted the delete mutation ID. Prior guard failure, saved commands, unknown cleanup and remaining receipt-read allocation are preserved. No guessed ID, replay, another delete, outbox reset or data SQL.

No browser/server, account, receipt, provider, live outbox, source fixture, window, registration or message operation occurred. No PG, whole-fixture or browser rerun; no new startup dependency or backend change. Build, integration, publication and served-source verification remain NOT_RUN here and belong to the sole publisher. Original N44 custodian remains parked for this concrete dependency; this candidate proves neither live cleanup, Sync GREEN, OS arrival nor Product acceptance/closure.
