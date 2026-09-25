# RAKEEZ X — Current project state

Last updated: 2026-09-25 (Asia/Riyadh). This is a short snapshot, not a changelog. [Governance](GOVERNANCE.md) defines authority; [Decisions](DECISIONS.md) records durable choices.

## Live identity and stage

- Stage: **Silent Beta active**, without marketing. The two authorized fresh-account pilot journeys passed; this is not a claim of a full Production regression audit.
- Git `origin/main` and current Cloudflare Pages Production (`rakeezx`, `main`, deployment `f990667c-1836-4052-842d-99238762bed5`, status `success`, alias `rakeezx.com`) identify commit **`8b965c2e4e14226f058d9aa61bc6ca3afceee004`**. Verified against current remote and deployment details on this date.
- Supabase Production project `xlrubcwjqktzzunrvuns` is `ACTIVE_HEALTHY`. Its **Allow new users to sign up** setting is ON; RAKEEZ `NEW_ACCOUNT_SIGNUP_ENABLED` is ON. Both were checked against the current dashboard/deployed source. Registration remains silent.
- Auth uses one visible email → six-digit OTP journey for existing and new users; there is no user-visible login/signup split or account-existence precheck. Server Auth identity remains the owner authority.

## Current Product contracts

- New accounts pass profile and owner-bound provisioning before READY/Home. Existing claimed workspaces route by verified owner; fresh devices restore online through CORE_V2 (CORE_V1 compatibility) before editable Home. Unknown or mismatched workspaces fail closed. Previously verified local work remains available offline.
- Demo uses the isolated `rakeezx-demo` database, not an authenticated Product workspace. The approved pilot found no A/B cross-account data exposure; its evidence does not include direct inspection of every local IndexedDB/outbox receipt.
- Work-Active is the sole **active** Visual/UX lab. Approved outcomes carried into Production include the 01A/01B shell/classes and 01C attendance/scores surfaces; only PO-approved Work outcomes are golden. Work's current uncommitted experiments are not Production facts. Google AI Studio is parked/backup, not current visual authority.
- Latest established milestones: 01C, 0295 automation foundation, 0297 provisioning, 0298 CORE_V2 restore/reload, 0299 security hardening, 0301 unified OTP gate, Silent Signup Pilot, and 0302 local relay dry run. 0302's normal-ticket relay is **not enabled** pending PM review; its dry-run result alone is not live handoff approval.

## Focus and limits

- Active ticket: **0303 — Project Documentation Foundation**. Next Product focus after review: [Recovery Ledger](RECOVERY_LEDGER.md), page by page; no archive code restoration is authorized by this snapshot.
- True known Silent Beta blockers: **none established by the latest pilot evidence**. A new security, ownership, data-loss, or production failure must be classified on its own evidence.
- Non-blocking follow-ups: direct local IndexedDB/outbox-receipt observation for the pilot if a real issue warrants it; unresolved historical Student Profile continuity report; page-by-page archive capability review; 0302 relay PM enablement decision. See [Product Ledger](PRODUCT_LEDGER.md).

Evidence: current Git/Cloudflare/Supabase read-only checks (2026-09-25); `D:\Abdullah Projects\RakeezX-Evidence\SILENT-SIGNUP-PILOT-01\checkpoint.md`; source contracts in `src/lib/cloud.js`, `src/lib/workspace-routing.js`, `src/lib/initial-restore.js`, and `src/lib/demo-workspace.js`.
