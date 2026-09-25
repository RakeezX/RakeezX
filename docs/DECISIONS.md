# RAKEEZ X — Durable decisions

Recorded/reconciled 2026-09-25. The date below is the **record date** where the original decision date is not evidenced. `ACTIVE`, `DEFERRED`, `SUPERSEDED`, and `REJECTED` describe decisions, not ticket completion. Product facts belong in [Project State](PROJECT_STATE.md); unresolved proposals belong in [Product Ledger](PRODUCT_LEDGER.md).

| ID | Date recorded | Status | Decision | Reason / authority | Related or supersedes |
| --- | --- | --- | --- | --- | --- |
| D-001 | 2026-09-25 | ACTIVE | Product Owner has final Product and Production-acceptance authority; ChatGPT is PM/reviewer/coordinator, Codex implements Production/runtime/data, and Work-Active is the sole active Visual/UX lab after PO approval. | Current 0303 governance direction and [governance](GOVERNANCE.md). | Supersedes the Google-AI-Studio-as-active-lab statement in historical continuity docs. |
| D-002 | 2026-09-25 | ACTIVE | Current Production governs runtime/data semantics. Approved Work governs visual outcomes; neither substitutes for the other. | Exact-SHA deployment and PO visual-review workflow. | D-001. |
| D-003 | 2026-09-25 | SUPERSEDED | Recover archive capabilities **feature by feature** under a scoped ticket; never restore an old whole tree, runtime, data, Sync, or PWA implementation into current Production. | Earlier selective-recovery governance; the standing review program is now cancelled. The prohibition on wholesale restoration remains. | Superseded by D-027. |
| D-011 | 2026-09-25 | ACTIVE | Participation is a cumulative scored component beginning at zero for every student and contributes to the final grade from the start. | Approved Product rule in `AGENTS.md`; current scoring model. | — |
| D-012 | 2026-09-25 | DEFERRED | Assignments/projects and submissions may become a dedicated module; do not implement them as part of current core work. | Approved deferral in `AGENTS.md`; current restore protocol excludes them. | — |
| D-013 | 2026-09-25 | ACTIVE | Student notes are dated, multi-entry history rather than one overwriteable field. | Approved Product rule in `AGENTS.md`; Student Profile implementation. | — |
| D-017 | 2026-09-25 | ACTIVE | Retain the current Supabase project/region unless a separate scale, regulatory, or migration decision changes it. | Approved data-residency rule in `AGENTS.md`. | — |
| D-018 | 2026-09-25 | ACTIVE | Routine same-field Sync conflicts use field-level last-write-wins; independently edited fields survive without routine conflict-choice dialogs. | Approved Sync rule in `AGENTS.md`. | — |
| D-020 | 2026-09-25 | ACTIVE | Deletion uses tombstones so stale devices cannot resurrect removed records; automatic garbage collection remains deferred. | Approved deletion rule in `AGENTS.md`. | — |
| D-021 | 2026-09-25 | ACTIVE | One visible email → OTP flow serves existing and new accounts. A global Product signup gate and Supabase signup setting control new-user creation; no visible login/signup split or existence probe. | 0301 Product correction and current deployed `src/lib/cloud.js`/`src/app.js`. | Supersedes the proposed separate login/new-account choice. |
| D-022 | 2026-09-25 | ACTIVE | Verified claimed accounts may reopen their own local workspace offline; fresh/unverified or mismatched identities do not receive an editable real workspace. | Workspace routing, Owner Guard, Initial Restore contracts. | — |
| D-023 | 2026-09-25 | ACTIVE | Demo is isolated from authenticated Product storage and Product cloud mutations. | Current Demo runtime and Silent Signup Pilot evidence. | — |
| D-024 | 2026-09-25 | ACTIVE | Silent Beta signup is open without marketing; expansion or closure requires a separate Product decision. | Authorized two-account Silent Signup Pilot and current dual-gate state. | — |
| D-025 | 2026-09-25 | ACTIVE | A relay may transport explicit ChatGPT decisions but cannot make Product decisions or bypass PO Work, Preview, or Production review. | 0302 contract; normal-ticket coordination was subsequently PO/PM-approved, with fail-closed markers. | D-001. |
| D-026 | 2026-09-25 | REJECTED | A distinct Safe Display recovery/redesign is not wanted. Do not restore or redesign it without a brand-new explicit PO request. | Final 0304 PO decision. | Former Recovery proposal. |
| D-027 | 2026-09-25 | ACTIVE | The systematic page-by-page archive recovery program is closed/cancelled. There is no active Recovery backlog; consider only a specific proven capability raised later by the PO. Never restore an archived whole tree or obsolete runtime/data/Sync/PWA. | Final 0304 PO decision. | Supersedes D-003. |
| D-028 | 2026-09-25 | DEFERRED | Lesson-to-session linking is future Product development, not Recovery; revisit only when the Lessons section is intentionally developed. | Final 0304 PO decision. | Curriculum/Lessons. |

Class Goal / Charter is present and closed by the 0304 PO review. No separate recovery decision or ticket is open for it.
