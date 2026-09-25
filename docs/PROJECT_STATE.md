# RAKEEZ X — Current project state

Last updated: 2026-09-25 (Asia/Riyadh). This is a short snapshot, not a changelog. [Governance](GOVERNANCE.md) defines authority; [Decisions](DECISIONS.md) records durable choices.

## Live identity and stage

- Stage: **Silent Beta active**, without marketing. The two authorized fresh-account pilot journeys passed; this is not a claim of a full Production regression audit.
- Last externally verified Product app deployment before the docs-only 0303 promotion: Cloudflare Pages `rakeezx`, `main`, deployment `f990667c-1836-4052-842d-99238762bed5`, `success`, commit `8b965c2e4e14226f058d9aa61bc6ca3afceee004`. Docs-only commits can advance `main` without changing Product source; check current Git/deployment metadata for an exact release identity.
- Supabase Production project `xlrubcwjqktzzunrvuns` is `ACTIVE_HEALTHY`. Its **Allow new users to sign up** setting is ON; RAKEEZ `NEW_ACCOUNT_SIGNUP_ENABLED` is ON. Both were checked against the current dashboard/deployed source. Registration remains silent.
- Auth uses one visible email → six-digit OTP journey for existing and new users; there is no user-visible login/signup split or account-existence precheck. Server Auth identity remains the owner authority.

## Current Product contracts

- New accounts pass profile and owner-bound provisioning before READY/Home. Existing claimed workspaces route by verified owner; fresh devices restore online through CORE_V2 (CORE_V1 compatibility) before editable Home. Unknown or mismatched workspaces fail closed. Previously verified local work remains available offline.
- Demo uses the isolated `rakeezx-demo` database, not an authenticated Product workspace. The approved pilot found no A/B cross-account data exposure; its evidence does not include direct inspection of every local IndexedDB/outbox receipt.
- Work-Active is the sole **active** Visual/UX lab. Approved outcomes carried into Production include the 01A/01B shell/classes and 01C attendance/scores surfaces; only PO-approved Work outcomes are golden. Work's current uncommitted experiments are not Production facts. Google AI Studio is parked/backup, not current visual authority.
- Latest established milestones: 01C, 0295 automation foundation, 0297 provisioning, 0298 CORE_V2 restore/reload, 0299 security hardening, 0301 unified OTP gate, Silent Signup Pilot, and 0302 relay. Normal-ticket relay coordination is PO/PM-approved but remains fail-closed on missing markers; no unattended watcher is enabled.

## Focus and limits

- Active documentation/triage ticket: **PRODUCT-LEDGER-CLEAR-EXECUTION-01**. The Product Owner's 2026-09-25 raw Inbox notes are preserved verbatim in the [Product Ledger](PRODUCT_LEDGER.md); clear investigations and N17 documentation reconciliation are in progress, while unresolved Product decisions wait for evening review. No Product implementation is authorized by that organization. There is **no active Recovery restoration batch or backlog**. Future Product work derives from the Inbox, real Silent Beta observations, and explicit PO priorities—not a standing archive-review program.
- True known Silent Beta blockers: **none established by the latest pilot evidence**. A new security, ownership, data-loss, or production failure must be classified on its own evidence.
- The historical Student Profile continuity concern is closed by PO decision; any recurrence needs a new bug report based on current evidence. Lesson-to-session linking is deferred future Lessons development, not Recovery. Full Archive validation waits until a real prior year/term archive exists.

Evidence: current Git/Cloudflare/Supabase read-only checks (2026-09-25); `D:\Abdullah Projects\RakeezX-Evidence\SILENT-SIGNUP-PILOT-01\checkpoint.md`; source contracts in `src/lib/cloud.js`, `src/lib/workspace-routing.js`, `src/lib/initial-restore.js`, and `src/lib/demo-workspace.js`.
