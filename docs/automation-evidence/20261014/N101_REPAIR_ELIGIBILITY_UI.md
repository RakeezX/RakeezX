# N101 — session-repair eligibility and controls

Task: continuous-n101-repair-entry-eligibility-ui-20261014
Run: 9afdbe60-025a-4e98-8f55-9a99e5f24e48
Base: 89a162adff6d82eccc95f4605c9c7a99c1ada472
Scope: src/app.js, tests/n101-repair-ui-browser.mjs and this record. Local candidate only; no push/deploy, service operation, real-account inspection, queue change or Product closure.

The Sync section now exposes session repair only when the current authenticated account's existing read-only store plan contains a reviewable session or a linked pending/failed replacement receipt. Workspace object identity and plan owner are checked after asynchronous reads. The existing coalesced Sync refresh updates only indicators/Sync section; no new polling or full-screen rendering is introduced. Generic rejected counts, year warnings and support remain unchanged.

Empty review has only support/close; no confirmation or visible retry. Review requires explicit unchecked-by-default selection. Busy/confirmed guards prevent repeat clicks, and the existing engine revalidates the original review plan. Receipt retry is limited to linked pending/failed replacements, displays its busy state and failure/unverified/verified outcomes, and never treats syncAll=false or success without verified plan evidence as completion. It does not requeue or mark original failures successful. Support uses the repair and teacher-center closure callbacks, then existing router navigation with destination focus. Escape/close preserves existing focus restoration. Engine, store, calendar, Auth, router and generic DOM implementation are unchanged.

## Affected checks

Command: `node tests/n101-repair-ui-browser.mjs` — PASS, natural exit 0, both 390 and 1280.

| Check | Actual evidence |
| --- | --- |
| n101_unrelated_year_rejection_no_session_action | Actual index.html, source CSS and app.js over task-owned loopback HTTP; fresh synthetic claimed account, one YEAR/academic rejection, 63 blocked children, zero sessions. Actual owner-guarded reviewRejectedSessionRepairs returns empty. Generic rejection/support/details remain visible; no session action. Stale invocation opens clean empty state with no confirm/visible receipt retry. |
| n101_eligible_session_and_empty_selection | Existing qualifying-session fixture through real store/IndexedDB/ownership and lease guards. No preselection; confirm disabled until checked, disabled again when unchecked, no write on empty click/Escape. Selected actual handler invokes real store confirmation, creating one linked audit/replacement while preserving original rejection exactly. Repeated store confirmation retains the same identities and three outbox rows. Main DOM stays the same during targeted refresh. Delayed actual IndexedDB reads raced with Auth owner change reject both eligibility refresh and review opening; no stale action/dialog. |
| n101_repair_support_and_retry_feedback | Stacked actual teacher-center/repair sheets close, /support renders and #main receives focus; no backdrop or inert app remains, including when already on Support. Escape restores entry focus. Closing/reopening pending linked receipt preserves recovery entry. Delayed retry shows busy/disabled, false result preserves uncompleted status, exception exposes error and reenables, successful sync without verified audit stays unverified, synthetic verified audit shows completion and hides retry. Linked rejected/blocked replacements offer no retry/confirm. No page errors/overflow on either viewport. |
| syntax and scope | node --check src/app.js; node --check tests/n101-repair-ui-browser.mjs; git diff --check — PASS. No full build/Preview repeated; publisher owns build/provider/served checks. |

The local HTTP server appends an export-only test bridge to app.js for internal entry access and injection of the synthetic Sync adapter. It does not replace repair plans, store APIs, handlers, templates or CSS. Signed-out real boot runs first; the fixture then mounts an actual synthetic account workspace using supported database naming, mock Auth and a bounded synthetic lease verification callback. No guard is disabled. Every real network destination is blocked by the canonical isolated browser helper. Retry service outcomes/audit disposition are synthetic fixture changes, not proof of backend recovery.

Inspected screenshots (local ignored artifacts): test-results/n101-repair-ui-year-390.png, n101-repair-ui-year-1280.png, n101-repair-ui-review-390.png, n101-repair-ui-review-1280.png. Actual RTL layout remains readable without page overflow.

## Reused safeguards and honest limits

Existing engine/data evidence in N101_REJECTED_SESSION_REPAIR.md remains applicable to unchanged engine paths: repair-plan owner/context/parent/idempotency negatives and native receipt reconciliation proof. No new SQL/native/service test is needed for this presentation/control patch. Current SHA256: session-recovery.js 85e68dba00518c0e1f267e0fc1b28478e157cc0471416584d8124cf508163fe3; sync-v2.js 925aabb535c90b0e0b415dc419b9f5bc15128a3ffe2bcc00de3ced2b6144bd38; sync-ownership.js e4793eae5c7512a193282cf9129561397cabe8a00f18421ac52810c7c43f3ff7. These paths and their existing tests have no candidate diff. Prior UI proof is superseded by the affected checks above.

Initial harness attempts correctly rejected an invalid synthetic database name and missing lease context/receipt; fixture now uses the existing canonical naming and lease APIs, preserving guards. First rendered check caught source CSS overriding hidden on the retry button; scoped app.js now sets display:none alongside hidden. A later test wait matched the substring inside an unverified message; fixed to require the exact verified-message prefix, without relaxing the assertion. Original failures remain in run output; only final runs pass.

Resource cleanup: canonical withIsolatedLocalBrowser verified the active matching local/non-live task, launched fresh disposable contexts, blocked Service Workers/external requests and closed its own browser in finally. Task-owned server used an OS-assigned unique loopback port and closed all owned connections/server in finally. No shared live-browser phase was used or reserved. No user browser/profile, credential, real record, service, lock or unrelated process was touched. Production/PO acceptance and unresolved N101 data recovery remain outside this local result.
