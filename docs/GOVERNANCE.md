# RAKEEZ X governance

| Authority | Decision |
| --- | --- |
| Product Owner | Product acceptance and final Production review |
| ChatGPT | Product Manager, reviewer, ticket/documentation coordinator; never substitutes for PO approval |
| Work | Active Visual/UX authority after PO approval; Work-Active is the held lab, isolated accepted Work outcomes are ported selectively |
| Production/main | Runtime, data, and deployed-contract authority |
| Codex | Selective Production implementation, tests, document mutations and Git |

Google AI Studio is parked/backup, **not** the current active visual authority. An unapproved Work experiment is not yet golden. For user-visible work, distinguish PO Work-local approval, PO Cloudflare Preview approval, and PO Production verification; none is implied by the other.

Never merge a Work branch wholesale. Compare its accepted visual outcome with current Production and port only missing approved changes. Archive is history, not a runtime source. Keep applied Supabase migrations immutable; introduce a new additive migration only under a separate authorized ticket.

Any Product change that affects the RAKEEZ user experience—features, design, presentation, interaction, usage flow, or functional behavior—must also be reflected in Demo whenever that capability logically applies there. Account-specific, authentication, cloud, Supabase, and private-user-data behavior that does not logically belong in Demo is exempt. This is the PO-approved N02 parity rule; it does not authorize a particular implementation.

An exact-SHA candidate needs proportional gates from [TEST_MATRIX](TEST_MATRIX.md) and an evidence handoff. Promotion needs explicit authorization, unchanged main ancestry, and deployment metadata confirming the same SHA. User-visible work remains `PRODUCTION REVIEW PENDING` until the Product Owner verifies it.

Continue through routine test/tooling setup autonomously. Stop for Product decisions, data-loss/security risk, unexpected main movement, schema ambiguity, or a Product-code change outside the ticket. Full filesystem access is not permission to mutate private data or Production.

## Canonical source and checkpoint policy

Local canonical files live at `D:\Abdullah Projects\RakeezX\docs`; Git/main is their shared committed record. ChatGPT may read the live files through Desktop Commander. Historical Project attachments are reference only, not current authority. Codex performs normal document/Git mutations unless the PO explicitly asks ChatGPT to edit. A pending isolated docs candidate is not integrated canonical root/main content until separately approved.

After PO Production approval materially changes state, the next safe docs checkpoint updates [Project State](PROJECT_STATE.md), [Product Ledger](PRODUCT_LEDGER.md) status and [Changelog](CHANGELOG.md); update [Decisions](DECISIONS.md) only for a new durable decision or explicit supersession. Do not rewrite every document after each small ticket.

Micro-Batches may group **2–3 related low/medium-risk items** for one selective candidate, focused shared gate and combined Preview/PO review. Keep contracts distinct; high-risk items stay isolated. CLOSED always requires PO Production verification.

## Document ownership

- [Agent handoff](RAKEEZ_X_AI_HANDOFF.md): short reading order; never a release identity source.
- [Project State](PROJECT_STATE.md): what is true **now**; update after material live state changes.
- [Decisions](DECISIONS.md): durable approved Product/architecture decisions and supersessions.
- [Recovery Ledger](RECOVERY_LEDGER.md): historical capability dispositions and explicit deferrals; no active Recovery backlog.
- [Product Ledger](PRODUCT_LEDGER.md): raw PO notes, triage, current/future Product follow-ups.
- [Current Architecture](CURRENT_ARCHITECTURE.md): checked-in source contracts, with its audited SHA; recheck source after a later runtime change.
- [Test Matrix](TEST_MATRIX.md): gates selected by change risk.
- [Release Checklist](RELEASE_CHECKLIST.md): exact-SHA promotion/review steps.
- [Changelog](CHANGELOG.md): concise material Production changes, not a test/prompt/evidence archive.
- This file: roles, process, and authority. Historical handoffs and the dated `ARCHITECTURE`, `RAKEEZ_X_TECHNICAL_ARCHITECTURE`, `RAKEEZ_X_PROJECT_CONTINUITY`, `SUPABASE-AND-SYNC`, `MIGRATIONS`, `REQUIREMENTS`, and `OPEN_ISSUES` documents retain their date-bound meaning; canonical files supersede stale current-state claims in them.

## Autopilot Relay (0302)

The local tooling at `D:\Abdullah Projects\RakeezX-Autopilot` can transport **Codex → ChatGPT → Codex** handoffs for normal-ticket coordination after PO/PM approval. It accepts only explicit `RAKEEZ_AUTOPILOT: CONTINUE`, `PO_REVIEW_REQUIRED`, `HARD_STOP`, or `DONE` markers; absent/ambiguous markers stop. The relay transports decisions; it does not make Product decisions, infer authorization, or bypass Work, Preview, or Production PO review. No unattended watcher is enabled.

## Conversation continuity (N31)

Plan a rollover for ChatGPT, Codex, and Work at a safe checkpoint when interaction slows or hangs, UI becomes stale/unreliable, context is repeatedly lost, a major phase completes, or a major new phase starts in an already long conversation. Do not use a fixed message-count threshold as the main trigger. Before rollover, reconcile [Project State](PROJECT_STATE.md), [Decisions](DECISIONS.md), [Product Ledger](PRODUCT_LEDGER.md), current ticket/open/closed/deferred work, and the authority roles above. Prepare a short handoff for each destination containing only current state, sources of truth, approved decisions, active/open/deferred tickets, next step, and critical safety rules. New conversations start by reading canonical files; old conversations remain historical references, not current authority. The manual RakeezX 4 rollover has occurred; the old conversations are historical. Future rollover remains a separately coordinated safe-checkpoint action, and Relay routing must be reverified rather than inferred from old bindings.
