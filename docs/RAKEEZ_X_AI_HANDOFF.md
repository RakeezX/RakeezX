# RAKEEZ X — agent bootstrap handoff

Updated 2026-09-25. Read this short route map first; it is not a frozen Production release report.

1. **Authority:** Read repository `AGENTS.md`, the named ticket, [Governance](GOVERNANCE.md), and [Decisions](DECISIONS.md). The PO decides Product behavior. Production/main is runtime/data authority; Work-Active is the sole active visual/UX golden source after PO approval. ChatGPT coordinates/reviews; Codex implements approved Production changes.
2. **Current state:** Read [Project State](PROJECT_STATE.md), then verify current Git and provider identity for any release claim. Do not reuse a hard-coded old SHA, service-worker generation, migration count, or historical ticket status from this handoff.
3. **Source architecture:** Read [Current Architecture](CURRENT_ARCHITECTURE.md) and the cited `src/` or migration files. For Product follow-ups, preserve the raw [Product Ledger](PRODUCT_LEDGER.md) Inbox. [Recovery Ledger](RECOVERY_LEDGER.md) has no active Recovery backlog; its inventory is not an automatic implementation queue.
4. **Verification:** Select risk-proportional checks from [Test Matrix](TEST_MATRIX.md), then follow [Release Checklist](RELEASE_CHECKLIST.md). A user-visible ticket stays pending PO Production review until the PO verifies it. A docs-only change does not authorize a Product deployment.
5. **Safety:** Do not copy whole Work or Archive trees; reset user work; alter an applied migration; touch Production/private data or Work-Active beyond explicit ticket authority; or let the Autopilot Relay make a Product decision. Exact source and evidence outrank an old chat summary.
6. **Historical references:** [Project Continuity](RAKEEZ_X_PROJECT_CONTINUITY.md), [Architecture](ARCHITECTURE.md), [Technical Architecture](RAKEEZ_X_TECHNICAL_ARCHITECTURE.md), [Supabase and Sync](SUPABASE-AND-SYNC.md), and [Open Issues](OPEN_ISSUES.md) preserve dated historical context. Do not use their old “current” assertions as live truth.
