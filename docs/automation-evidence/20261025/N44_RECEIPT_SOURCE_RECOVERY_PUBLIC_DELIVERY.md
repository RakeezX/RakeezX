# N44 receipt-bound source recovery — source qualification

Task: `continuous-n44-receipt-source-recovery-public-dependency-20261025`
Run: `367b9221-0385-40ef-927a-9bcddb6d7a0d`
Base: `0301f7887dcd508b5bce3cef2422188b6bfa479f`
Qualified immutable parent: `4d406987e1dc856e952f992ced3fd662db7afb62`

This candidate delivers only the guarded foreground recovery API prerequisite and this evidence record. Publication and served-source verification belong to the independent sole publisher. N44 remains open; live cleanup, Sync GREEN and notification/OS arrival are not proven.

## Exact source qualification — PASS

Read the manifest, patch, prepared modules and entry evidence using `git show` from the immutable parent, under `drafts/n44-push/activation/source-recovery-public-944a07a4/` and `tests/n44-current-closed-page-followup-20261024/`. No private branch merge or cherry-pick occurred. The initially clean worktree HEAD and observed local `origin/main` ref both matched the supplied base; no remote freshness or deployment is inferred.

Verified patch SHA256: `8d0667482eee48af953e50b807ca0a51ebeec967a223c2164fdc64c0f06ff4e6`. `git apply --check --whitespace=nowarn -` passed before applying those exact bytes. All three current preimages matched the manifest, and each resulting file matched the immutable prepared module byte for byte. Output required LF normalization after application where necessary to reach the specified target bytes.

| File | Preimage SHA256 | Target SHA256 |
| --- | --- | --- |
| `src/store.js` | `105be40603e4d97b922a9f76e188725d26853cf3c28af53e0e199b9d63c12256` | `a7cb0c5ba78b927be77dc55dc202ef1a08cfc60a4c875576870d4481e7df7e75` |
| `src/lib/cloud.js` | `7c4bcfdd655b0443db2494d7889a5e9cc6117570c23913ad0bdee0ca5ebc7215` | `2a37477bf52fab67d6b26cd345f5719d219932d1ab8e9b1d6758c8a55d93b63c` |
| `src/lib/sync-v2.js` | `b70facb1d4cac5fda678a781657d81ef939cb490760c80572f093eb16006bd42` | `79b7105e4ae06fd0329c22c272a8bd5f65e92afd3f3c0f92d179b7157361f719` |

## Authenticated store/cloud/Sync guards — PASS, reused evidence

Entry evidence `source-recovery-entry-944a07a4.json` SHA256 `996e34aa53f9de5b3e692a32fbbf334e20577f711109bb34eb36805dcd1f51ff` contains 13 PASS checks against the exact prepared store/cloud/Sync modules. Reused without rerun: missing writable lease; exact receipt reconciliation preserving IDs/bodies/errors; absent receipt; wrong command; wrong owner; unknown outcome; ambiguous transport; dispatched dependent; scoring history; owner change during read; transactional CAS conflict; foreign command owner; exact owner/command/target/device/stamp GET without dispatch. These are synthetic module/store-entry proofs, not rendered UI or live acceptance.

Reused `source-recovery-pg-0f1d36e5.json` from the same immutable parent: ten original PostgreSQL 17.6 PASS cases, including rejected generic definition/zero-max parent, normal direct ACK, atomic configuration with zero grade writes, idempotency/body collision, forbidden child/foreign owner, lost COMMIT ACK, cleanup/late configuration fencing, normal Sync ACK sequence and owned-resource cleanup. Its original base is `8fa4ef908f8b632b909fd50861d0693e85230335`; it is historical backend evidence, not a new execution against this candidate. No SQL or backend source is changed. Original FAIL records, including first, bigint and receipt-stamp harness failures and the old Node contract FAIL, remain unchanged in immutable custody; no failure is relabeled PASS.

Inspection of the exact three-file diff and existing guards confirms the authenticated store entry checks writable lease and captures owner/database/auth generation; the cloud helper performs only the exact receipt GET; the engine fences ownership before receipt adoption and inside transactional CAS. Only the exact deleted unused parent and never-dispatched child with the retained HTTP 403/42501 rejection qualify. Missing/mismatched/unknown receipt performs zero local writes. Saved command bodies, IDs and errors remain; receipt adoption marks them superseded. No replay or remote mutation is introduced by reconciliation.

## Current-main preservation and affected checks — PASS

`node --check` passed separately for all three edited modules. `git diff --check` passed for introduced whitespace. Source diff: three files, 45 insertions and one import-line deletion; no unrelated main/N36/N88/Sync/grade/delete/recovery changes. The 19 preexisting main trailing-whitespace lines (13 store, six cloud) are retained byte for byte by the qualified targets, not reformatted. No dependencies, startup paths, service worker, schema, Auth, SQL or configuration changes.

No build, browser, server, Preview, provider operation, fixture, live receipt read, account action, native/carrier upload, pin transition, send or student/grade mutation was performed. No phase resources were acquired or processes started for browser/server work. Queue/status files were not edited. Build/deploy and actual served-source checks are NOT_RUN here and remain publisher-owned.

After exact source publication, the parked original N44 custodian must resume with its preserved authority/custody and original cleanup mutation ID. Publication alone does not authorize a new live trial, replenish a consumed phase or close N44. N88 service work remains disjoint; no publisher/service action may overlap a future N44 closed-page notification trial.
