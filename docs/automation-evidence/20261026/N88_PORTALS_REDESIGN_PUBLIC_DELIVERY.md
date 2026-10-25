# N88 teacher/student portal redesign: public source candidate

AI-authored, 2026-10-26. Task `continuous-n88-portals-redesign-public-20261026`, run `996bbf87-20f7-491e-9e5b-a1d58dffac6a`. Source-only readiness; N88 remains open and Product acceptance is not claimed.

## Exact source transfer

Base and observed remote main: `4ddd0ed76763545d70e0822c817ca4bde9b9f711` (read-only `git ls-remote origin refs/heads/main`). Its only change after packet source base `14f446a6320d30fe78cce1dcf81b41c807d85714` is the N44 operating-card qualification; no intersecting Product source change.

Read exactly these Git objects from immutable parent `4fd62e79ba86ffc368e0b1f7ca1bc3817a6d22c9`, under `drafts/n88-student-portal/activation/portal-assets-20261026/`:

| Object | SHA256 |
| --- | --- |
| public-delivery-packet.json | cafffe490c2fa380dba05f82b8402fb60e33e1bbf2a2cba564457d2e57683f5a |
| delivery-receipt.json | 01891e2ff72d5f991e8ead538e6276c3286a4d9e2aa505eebee7c1bd7c099da6 |
| served-static.json | 8ecb62e3ebab79e59f91214c282d8de72b58c45f70d011289ea7c53445580f29 |

Decoded packet patch SHA256: `89f16561fc516d7018ec0b11714fa8ae9f874d707e93a2065203d6d4a609003c`. Applied only its four public paths, after matching every pinned preimage and all twelve `unchangedCurrentMainInputs` in both Git and the worktree. No private branch merge/cherry-pick, obsolete patch, private working-tree copy, compiled carrier, screenshot or private artifact enters this commit.

| Public file | Exact target SHA256 |
| --- | --- |
| src/styles/student-portal-class.css | e9a3abf268d23c16796a41798c15cc189dd2e9ed50666d7e88372f6836d49aaa |
| src/styles/student-portal-login.css | 70c748e7ddc3f86890015501958000a27b343d632c9cdd36fddd2fffc6ec7de9 |
| src/views/student-portal-class.js | ad3c604261985a50f81184adac37a78a6ad5c71adc11823f10dd825d0165ca22 |
| src/views/student-portal-login.js | a01044aa8ffcf9ff76df5d84aa0a2f1f5409e8cd6df456859df9e5b3b76515fd |

Git initially materialized CRLF during patch application; the immediate raw-byte assertion caught that difference. Restoring LF in those four files produced the exact pinned target bytes without changing Git configuration. Reverse patch applicability also passes. No Product change beyond the packet was made.

## Completed private prerequisite (reused)

Original custodian run `92c4054a-98a9-4cd0-8154-b2fc80b85563` delivered one carrier upload, SHA256 `ba8d7e1129118ca249a14ac09e8b8f58d84685850a9fc9c9b2a811c8ea26654e`, active version `00742874-0fad-4358-a2dc-8bd5096c809f` at 100%, deployment `a9021f11-f09e-4f47-8196-3ee63bed5187`. The immutable receipt and served-static result record exact served bytes:

| Private static asset | Served SHA256 |
| --- | --- |
| student.mjs | dbfee9204a81332609b71842d11692b59d85079367cf749b63f2d44517b231bd |
| app.css | 2be93eb79d5695c33c4745e4ad14cc8bcabd7c52342b523590ef902e4d5221a7 |
| student-portal-login.css | 70c748e7ddc3f86890015501958000a27b343d632c9cdd36fddd2fffc6ec7de9 |

Six other assets and nonasset HTML-source/API/CSP/India/HMAC bytes were unchanged. Native archives `01a45e02e121dfa425f70cf73e8f3f5827ce3b09bbe51c9047fee0e252c0f3fc` and `d9d3e1c2250acab54edf54b95d7dbc3ef02e179ce3e231a7293e5e9fc0207d88`, all47 digest `3d298cacb3ac5ba9ce95444a601dc3b7edb1713d5d703c10d3243f035b768228`, and source pin were preserved. Actual version metadata is 153/141, reflecting legitimate earlier secret updates, not the older 149/133.

Full served HTML exact-byte gate remains **FAIL**: expected `16a23577cc44f3d72584ef1ac0c1b44d6c3598ebdb2304c659c4e7d498c8e20c`, observed `35f2babb817c126e2f2898ee5401619abebf34b1dcf403577c9f146c0d0d704d`, with known Cloudflare document insertion. Static references/dependency closure and CSP pass. This is not byte-exact served HTML or a reason for another upload. Pages publication alone does not deploy the private capability.

## Qualified behavior and affected checks

Reuse qualified original candidate `92dbb1a9474b1052b1536f318479917cdb77ab19`, packet target tree `8317fcd209a1c71b767eea9eb46514e9392dc57d`, and the unchanged c938 support-input overlay pinned by the packet. Original actual synthetic application DOM/handlers/source CSS evidence comprises eight responsive cases (320/390/768/1280, light/dark), nineteen behavioral cases, five unchanged helper/projection units and 44 hash-verified before/after screenshots. References remain private: `tests/n88-portal-redesign-20261026/screenshots.zip`, `screenshot-manifest.json` and `local-checks.json`. These are reused evidence, not new real-user acceptance or fresh tests in this run.

The exact source preserves code-only Copy; same-gesture full-message Copy/native Share with truthful cancellation/failure/manual fallback; visible accessible Rotate/Revoke buttons with existing confirmation; explicit empty-guidance Save mapping to confirmClear under unchanged sourceStamp/revision; ACK retained following read; primary roster/required/upcoming work, unrecorded grades distinct from zero, secondary completed work; removal of Resume control while retaining one initial existing-valid-cookie read; denied/expired/logout-UNKNOWN, owner/cross-document privacy, short-return zero-request behavior and view retention.

Historical helper DENIAL and patch-artifact/copied-current-CSS whitespace FAIL remain unchanged in the private evidence. They are neither relabeled nor cleaned up.

Current affected checks: exact decoded patch hash/path set, four preimages/targets, twelve unchanged inputs, reverse applicability, both JavaScript `node --check`, scoped diff/whitespace and staged-path inspection. No repeated rendered UI, PG, unit suite, harness, full build or broad audit. No browser/server phase was opened, so there are no owned phase processes or leases to release. This worker performs zero provider/API/account/student/browser/native/SQL/Auth/pin/cookie/code/grade operations and does not touch N44 notification/SW/push files or custody.

## Independent publisher evidence

Public Git integration, standard build, Pages deployment and canonical served-source/asset verification: **NOT_RUN in this source worker**. The sole controller/publisher owns these steps and their new immutable receipt. No new public publisher proof exists at candidate preparation; the controller must record the actual integrated revision, provider identity and canonical served assets before claiming delivery. No push/deploy, queue/ledger edit, live proof repeat, manual PO trial or whole-N88 closure is performed here.

## Saved-session result-scope correction

Continuation run `a3de341b-39d5-4889-a067-2be881d205e5` preserves source candidate `cf1bedbc7279f81ff3a5192375cd18669da22251` and its completed checks. The preceding result was rejected with `Candidate validation: An affected check must pass and no recorded check may fail`: it incorrectly included the original custodian's historical private served-HTML byte FAIL as a check of this source-only attempt. That historical result remains FAIL above and in the immutable original receipt; no gate was rerun, repaired or changed to PASS. The activated card explicitly retains that limitation and requests source-only readiness after exact public transfer.

This continuation changes only this evidence document. Its result check list covers the three required source/prerequisite/evidence-preservation checks and scoped syntax/whitespace/path validation, reusing their completed evidence for unchanged source. Private HTML and public publisher operations are not executed by this continuation. The historical private HTML failure remains an explicit limitation in the result summary; public publication remains NOT_RUN. No controller rule, queue state, permission, service artifact or acceptance requirement is changed.
