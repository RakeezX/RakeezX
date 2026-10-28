# N126 F09 — inert cloud contract preparation

Task: `n126-f09-cloud-v2-1028`
Run: `ea41636d-4f7a-4afb-ad8c-28fd4bcfcaf2`
Base: `df2186a7ca2edc277f8f9d430f061df7f8c4305f`
Authority: activated source-only card and latest N126 row in the canonical Product Ledger, PO 2026-10-28. Implementation and verification assisted by AI.

**Source prerequisite prepared; cloud feature NOT_READY.** No push, deployment, provider check, browser/server, service call, database, Auth/RLS, migration, bucket operation or real account/data was used. The independent publisher owns source integration and served proof. This result does not complete or close F09, certify a live service, or imply PO acceptance.

The blocked local PDF/browser candidate `f2889057` is **NOT on Production**; its blocked parent, failed/unrun checks and saved candidate remain unchanged. N71 unified backup remains unchanged and does not include this cloud contract. Actual F09 cloud service/RLS/storage is **NOT deployed** by this work; no runtime activation is provided.

## Provenance and bounded changes

Selectively recovered these four files using `git show` from the same repository's preserved commit `ef876c30b468e019d24447ddfaad7ab1879f4180`, without merging/cherry-picking that branch:

| File | Saved source SHA-256 |
| --- | --- |
| `src/lib/portfolio-cloud-sync-contract.js` | `7fccac6ebceac4c68a4b56f9ff20b6fbdb4bda629867d814797f0301243de599` |
| `src/lib/portfolio-cloud-transport.js` | `9849318a570221028d55e1fd78fd96610e8e16a599aae74a6e79ea3aba2a404f` |
| `tests/portfolio-cloud-sync-contract.test.mjs` | `e588c8e97f436d2c7d9af162f76ea7a11cf1f9e78a0b623181b1260289d6394b` |
| `tests/portfolio-cloud-transport.test.mjs` | `e5400378865ba212a9d5cbbac6f9cb2c79f83aba8fbd9d1e6b544141bcdcfb68` |

Both original test files remain byte-identical prefixes of the extended tests: none of the original 17 tests/assertions were removed or weakened. All 17 passed before extension and again with the final code. Prior architecture/N71 limitations in `ef876c30:docs/automation-evidence/20261025/F09_CLOUD_OWNER_SYNC_AND_N71_CONTRACT_AR.md` remain applicable; no old live/UI evidence is relabeled as a new check.

The saved `f2889057` local-state/draft source was read solely to match its optional `payload.documents` groups and `savedDocument.documents` Map. Those implementations were not imported or edited. Each PDF requires a matching Blob, exact metadata byte size, MIME `application/pdf`, supported `%PDF-1.0`–`%PDF-1.7` or `%PDF-2.0` header, maximum 2 MiB each, 12 MiB total, 12 per portfolio and 3 per witness. Duplicate witness groups, duplicate IDs and IDs shared across images/PDFs/links fail closed. Existing image-only limits, paths and legacy injected image port remain supported. HTTPS links are metadata only: validation parses strings and never fetches them.

Paths are owner UUID plus string SHA-256 digests of year, attachment ID and bytes. No original names, year text, evidence links or private student text enters paths. Ports request immutable creation with `upsert:false`. Generic `stagePrivateFile`/`verifyPrivateFile` support images and PDFs; PDF plans cannot fall back to an image-only port. There is no actual provider adapter, URL, credential or autonomous I/O.

Only planner-created in-memory plans are accepted by the seam. Planning detaches the verified owner/year server snapshot and freezes a detached payload. Before any staging, the transport validates both the original saved source and supplied maps, hashes all bytes again, checks ownership metadata when present, and checks for edits during asynchronous validation. It captures immutable Blob references as a batch; subsequent source edits cannot substitute bytes in that snapshot. Plans are not serializable execution credentials: a copied/deserialized plan must be rebuilt against a verified snapshot.

Tombstones and acknowledged remote baselines are retained. Every staged object needs private owner/year/path/hash/size/MIME proof before metadata CAS; canonical readback must match owner, year, active status, next revision, payload hash and the exact unique complete attachment set. Neither HTTP 2xx nor successful staging/metadata alone yields a verified receipt. `NO_CHANGE` requires matching private object proofs and transport revalidates its local source too. The compatibility error `F09_CLOUD_IMAGE_READBACK_UNVERIFIED` also denotes invalid generic PDF object proof.

## Actual affected checks

Node `v24.19.0`; only synthetic UUIDs/Blobs and in-memory ports.

| Required check | Result / evidence |
| --- | --- |
| `f09_cloud_owner_year_revision_tombstone_fail_closed` | PASS: owner/database/year guards, absent/active verified snapshot, baseline mismatch, tombstone refusal, server mutation during hashing, forged plan rejection. |
| `f09_cloud_private_image_pdf_metadata_and_hashes` | PASS: v1 compatibility, optional/PDF-only support, exact hash paths, missing/extra/wrong-key maps, foreign records, MIME/signature/size, count/total boundaries, duplicate/cross-type/malformed metadata and links. |
| `f09_cloud_staged_cas_and_canonical_readback_simulated` | PASS: generic and legacy port order, no staging after changed source, source edits during preflight, captured immutable bytes, failures at stage/verify/commit/read, stale simulated CAS, foreign/wrong-year/partial/duplicate/malformed/HTTP-only proofs, unchanged-plan revalidation. |
| `f09_cloud_contract_inert_runtime_and_n71_boundaries` | PASS: Node reference scan finds no app-source/offline-shell references outside the two new modules; new modules have no network calls. Git blob identity for `src/app.js`, `src/router.js`, `src/lib/backup-v2.js`, `sw.js` matches base. Only the five declared paths are added. |

Commands executed successfully on final code:

```text
node --test tests/portfolio-cloud-sync-contract.test.mjs tests/portfolio-cloud-transport.test.mjs
# 37 tests, 37 pass, 0 fail, 0 skipped
node --check src/lib/portfolio-cloud-sync-contract.js
node --check src/lib/portfolio-cloud-transport.js
```

During development, one added test exposed wrong-key PDF maps being rejected as INVALID rather than MISSING (32/33 passed). Explicit key-membership validation corrected that classification; the final 37/37 run includes it. No original failure was relabeled or acceptance guard disabled.

No Vite build or rendered-UI result is claimed: this card adds inert pure modules only. No browser/server phase lease or owned service process was needed. Product runtime/N71 evidence is unchanged; live integration and cloud acceptance require their own exact authority and actual service safeguards.
