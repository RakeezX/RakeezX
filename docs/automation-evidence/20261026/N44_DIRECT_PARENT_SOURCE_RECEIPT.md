# N44 direct parent source-save read — AI implementation

Task: `continuous-n44-direct-parent-source-receipt-20261026`
Run: `79fe5e31-4e73-4c6e-9053-f904a015cac6`
Base / observed origin/main: `7d4b7db15278f04c1fd59414e4b42357fbb053ab`.

The activated card authorizes this synthetic client read-path repair only. Read the current operating contract, N44 ledger contract, affected store/cloud/runtime/view and existing synthetic account/lease helpers. Original read-only result inspected at `artifacts/ops-supervisor-v4/attempts/continuous-n44-one-approved-closed-page-push-20261019/b7adb434-2b2b-43ad-a971-06f12af62cde/result.json`: matching direct parent found, canonical creation UNKNOWN, cleanup NOT_RUN, historical Save FAIL, OS arrival NOT_PROVEN. No protected journals, original worktree files or browser were inspected.

## Change

The existing explicit Support source read can select direct parents with zero children and subitems parents with zero children. Unsupported modes and direct parents with children are excluded. Existing configured-subitem selection remains supported, including its finite child and owner/ancestry restrictions. No due-event projection, authorization, grade, deletion UI or Support rendering changes.

Confirmation requires a positive local parent revision, no pending-create/local-only marker, confirmed ancestry and exact canonical parent ID/teaching/revision/deleted state plus exact child set/revisions. The unchanged cloud reader enforces canonical owner and child-parent ownership. An absent canonical parent cannot be replaced by an empty child.every, local row presence, SyncGREEN or empty outbox. Existing related pending/unknown commands remain pending; teaching-linked commands are also checked. Outbox equality and source/context checks remain after awaits, with an additional explicit same-session/workspace fence. Empty children cannot produce cleanup_confirmed or trigger cleanup-receipt lookup. Configured tombstone cleanup still requires the original exact canonical deletion receipt.

No mutation, SyncNow, adoption/replay, automatic request/polling, new service capability or permission was added. The existing collapsed Support disclosure already distinguishes source-save confirmation from reminder authorization; the view was left unchanged.

## Exact affected checks

`node tests/n44-direct-parent-source-receipt-20261026/check.mjs --red` ran before the Product edit against the actual base store/cloud modules: PASS reproduction. The direct/no-child parent was absent from notificationSourceGroups; readNotificationSourceStatus returned rejected with zero canonical transport calls. This is a real store entry omission, not an extracted function or source-string assertion.

`node tests/n44-direct-parent-source-receipt-20261026/check.mjs`: PASS seven groups; compact results in `tests/n44-direct-parent-source-receipt-20261026/result.json`.

- `n44_actual_direct_parent_status_omission_red_green`: both supported empty modes confirm the exact canonical parent through the actual store. The actual normal Support runtime issues a bounded token, performs no implicit read, reads it once on explicit request, rejects an invented choice and exposes the confirmed result. No due event or outbox mutation.
- `n44_canonical_parent_pending_and_context_fences`: pending/unknown commands, pending-create and missing local/ancestry revision cannot confirm. Canonical absent, wrong owner/parent/teaching/revision/deleted state, malformed collections/null entries, orphan/mixed-owner/duplicate/missing children and >200 children fail closed. Owner/session/workspace/lease/device/ancestry/revision drift during the canonical await rejects; outbox drift returns unknown. Unsupported mode, direct-with-children, local foreign children and local >200 children reject.
- `n44_existing_child_source_and_cleanup_receipt_preserved`: configured child confirms; exact parent/child tombstones without the receipt remain unknown, with the existing owner/device/target/stamp/mutation receipt become cleanup_confirmed. Empty deleted parent remains unknown with zero cleanup reads.
- `node --check src/store.js`, `node --check tests/n44-direct-parent-source-receipt-20261026/check.mjs`, `git diff --check`: PASS. Diff restricted to the card's store, scoped tests/results and this evidence file.

Retained failed development check: the first context-fence group failed. Indexed rerun identified same-owner session replacement; existing cloud capture tracked owner/auth generation but not that session object's replacement. Added the explicit store session/workspace fence and reran the materially affected scenario successfully. No guard disabled, failure relabeled or live attempt spent.

## Reuse and limits

Existing evidence: `docs/automation-evidence/20261025/N44_NORMAL_UI_CUSTODY_DEPENDENCY.md` records actual HTTP DOM/handlers/CSS, source/cleanup and grade4 checks. Its unchanged cloud, Sync, ownership, offline lease, score foundation, notification events, runtime and view dependencies were compared with this base using scoped Git diff (no differences). Their unaffected checks are reused, not rerun as a suite. This change rechecks the actual store/runtime source-read seam. No rendered-UI PASS is claimed for this run; view unchanged, browser/server NOT_RUN. No browser/server phase or lease was acquired and no owned browser/server process was created.

All provider/account/Auth/SQL/native/pin/registration/send/live-source operations: zero. No push or deployment. Original historical Save FAIL, Source4 canonical UNKNOWN, cleanup NOT_RUN and OS arrival NOT_PROVEN remain unchanged. This candidate does not close N44 or authorize a delete. The sole publisher must integrate and verify served `src/store.js`; only after that actual served proof may the original custodian resume its separately bounded reconciliation. No view asset changed.
