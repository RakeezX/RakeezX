# N88 final policy journey — public source preparation

AI-authored evidence for task `continuous-n88-final-policy-journey-public-20261025`, run `157e973e-94d0-43d7-96d2-698dc6194c04`.

Result: **source-only LOCAL_READY**. This child applies the exact qualified two-file packet; it does not establish new Production evidence or close N88. No queue or ledger edits, provider writes, browser/account actions, service readbacks, Preview or repeated parent tests were performed.

## Immutable source and affected checks

Authority: the activated final-policy source-only card, the current operating contract and the canonical N88 ledger note `[N88-FINAL-POLICY-JOURNEY-20261025]`. The worktree started clean at `b5d47cb7c730473ee57a6f70c5d2b3d884eccfa6`. Both observed `origin/main` and read-only `git ls-remote origin refs/heads/main` matched that full SHA during preparation. Publisher must check movement again at integration.

Packet commit: `19463dd25b55c82ef4a0be654c1c63d9b20c05b8`. All parent paths below are immutable Git blobs under `drafts/n88-student-portal/activation/policy-compatibility-20261025/` at that commit, not new operations or files copied into this public candidate.

`n88_final_policy_exact_source_packet`: **PASS**. Read `final-public-delivery-bc668ea7.json` and `public-source.patch` via Git blobs. Patch SHA-256 is `9582d4bea211df61bfdc07131c89583564bbc1dcc922bc6a9157bd79b8319887`. Verified both HEAD and working-file preimages, ran `git apply --check`, then applied only that patch. No private-branch merge/cherry-pick or inactive global-identity/app.js patch.

| File | Preimage SHA-256 | Final SHA-256 |
| --- | --- | --- |
| `src/lib/student-portal-unified-client.js` | `7615ac6cb2487863798c7066a1270334cb4356c1e35c9c3a85708704f91ccd78` | `337ca98f53664969e174e80b85cd93bf5658cafcf7498a65c27a9c16aadb51f8` |
| `src/views/student-portal-login.js` | `e212a374984af07f5100e58dd6dd6bee0124cf363dcd6f70b05f71d2611da9be` | `cab2b6853cd11eb1e755ddaf53c8e6e01809f29a771eeb31827807c7be4c0a53` |

Git initially wrote CRLF during apply, so a raw-byte target assertion detected an encoding-only mismatch. Saving these two files with LF restored the exact qualified target bytes; both final hashes passed and also match the immutable private-source blobs. No Git configuration was changed. `node --check` passed for both files; `git diff --check` passed. Git's existing LF-to-CRLF working-copy warning is informational; committed blobs are checked separately against the packet targets.

`n88_final_policy_privacy_and_typed_domain`: **PASS, bounded source guard inspection plus reused qualification**. The changed client admits the publication state only for a read with HTTP 409, JSON content type and the exact two-key `{version,state}` domain DTO. Generation, peer retirement, binding-failure handling and deadline checks remain before adoption; another generation/deadline check follows decoding. Nonmatching responses remain unavailable. The view clears settled private projection before showing publication review, retains explicit read/end handlers, and avoids automatic retries on ordinary hiding of that informational state. Diagnostic parsing has a bounded length, exact finite field vocabulary, enum/type checks and reconstructs only allowlisted values; copied diagnostics revalidate the DTO. No profile, grade, raw body, code or credential is introduced in the domain outcome/diagnostics. No startup dependency, storage, owner guard, scoring, Sync or date-policy change is added.

The service qualification is reused, not re-executed: `manifest.json` records **25 actual compiled PostgreSQL checks**, **5 actual rendered application domain cases**, and **53 boundary/sourceReason checks**. The typed 409 classification is restricted to trusted visibility-scope stale policy after valid membership and acknowledged rollback with no COMMIT. Unknown rollback/COMMIT, cancellation, deadline, malformed policy and membership failure retain their original deny/unavailable behavior. Normal producer/reader multiple-teaching scope agreement is preserved; this child makes no incomplete-canonical-scope bug claim. Historical failures in the manifest remain unchanged. These source assertions are not a newly rendered-UI PASS.

## Reused actual delivery and normal journey

`n88_final_policy_current_main_and_actual_journey_evidence`: **PASS for source/evidence binding only**. Exact parent sources are `manifest.json`, `final-certificate-2ab81b93-759f-45dd-a0a7-0bbcf3e08465.json`, `carrier-delivered.json`, `served-asset.json`, `normal-demo-bc668ea7-outcome.json` and `shared-config-observation-bc668ea7.json`.

Already installed/read back in the parent: native SHA-256 `2c6917bd8698150f2cdf63bc3656549971cbb906f899c215bbfe4c58a00238ae`, version 149, archive `01a45e02e121dfa425f70cf73e8f3f5827ce3b09bbe51c9047fee0e252c0f3fc`; own pin and all 47 mappings exact. Carrier SHA-256 `5b786cb54a8c7be41cc940fdfe504ae74b5e341cde748183e11be8c9ccb4517a`; actually served private student asset SHA-256 `5166c5c834958b8ba8f114ae7c5c704cf4f67404910d87acb92f6c5c53302f11`. Other eight assets, other 46 mappings and the N44 peer were preserved. Parent provider certificates are reused without upload, pin update or readback repetition.

The actual normal journey belongs to parent run `bc668ea7-1af0-4c4b-a978-cbe5fcd36439`:

- Current mounted identity and Sync/class binding accepted; class read 200 with six pupils and five active codes. Identity was independently matched, not inferred from roster counts.
- One minimal publication ACK and one existing-code claim produced the matched own-student read: 2xx, coarse elapsed 500 ms, five unrecorded grade rows, no other pupil names. No new grades/codes/accounts were created. Independent teacher gradebook comparison was NOT_RUN; unchanged canonical projection/scoring proof was reused.
- A real short tab return retained the same view, scroll position and successful diagnostic, with no new return read observed. Existing local request-counter proof was reused.
- One exact prior-flag restoration ACK and final 2xx read honored original flags, omitted disabled fields and retained the session. Original flags were not assumed all OFF. Owned tabs and leases were released in the parent.

No raw codes, student/teacher identifiers, names or grade values are reproduced here. Counts and finite technical outcomes describe one controlled demo only; they do not guarantee future Internet reliability, stress capacity, a performance percentage or whole student-workspace acceptance.

## Preserved failure and publisher boundary

**N44 initial configuration gate remains FAIL:** the same original configuration request returned HTTP 503 / `configuration_policy`, with no causal interpretation. This source child does not fix it or authorize another config request. No historical FAIL/UNKNOWN gate is converted to PASS.

Public canonical integration/build/Pages publication and served canonical asset verification are **NOT_RUN by this worker** and remain with the sole publisher. The private embedded bundle was already delivered in the parent; a later Pages deployment alone cannot establish a new private-bundle delivery. The publisher must verify this exact source candidate through its normal guarded path. N88 remains open; this child supplies no umbrella closure or PO acceptance claim.
