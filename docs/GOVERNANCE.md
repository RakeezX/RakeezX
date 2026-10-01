# RAKEEZ X governance

| Authority | Decision |
| --- | --- |
| Product Owner | Product acceptance and final Production review |
| ChatGPT | Product Manager, reviewer, ticket/documentation coordinator; never substitutes for PO approval |
| Work | Visual/UX authority only for exact outcomes explicitly recorded as PO-approved in the [Work Approval Ledger](WORK_APPROVAL_LEDGER.md); Work-Active is the held lab |
| Production/main | Runtime, data, and deployed-contract authority |
| Codex | Selective Production implementation, tests, document mutations and Git |

Google AI Studio is parked/backup, **not** the current active visual authority. An unapproved Work experiment is not yet golden. For user-visible work, distinguish PO Work-local approval, PO Cloudflare Preview approval, and PO Production verification; none is implied by the other.

Never merge a Work branch wholesale. Keep ticket scope selective while preserving the complete approved visual outcome. The default after PO approval is exact transport of a frozen Real-Product Integration patch, not a fresh Codex visual implementation. The earlier selective-port method remains relevant only when a separately approved ticket has no frozen real-Product patch. Adapt runtime wiring only under the approved scope; an unexpected post-freeze application-source change requires PO review or an explicitly authorized narrow micro-fix. A genuine runtime/data conflict is `RUNTIME-CONFLICT`. Archive is history, not a runtime source. Keep applied Supabase migrations immutable; introduce a new additive migration only under a separate authorized ticket.

For Work-derived Product work, read the [Work Approval Ledger](WORK_APPROVAL_LEDGER.md) and exact approval contract before coding. Verify its SHA-256 manifest against disk; `DRIFTED` or `UNRESOLVED` source stops implementation until PO/reviewer resolution. Prepare a surface/contract matrix with `MATCHED`, `GAP`, and `RUNTIME-CONFLICT`. Close every `GAP` before Preview; never silently accept a partial outcome. Work approval alone does not authorize Codex implementation, Preview, Production or CLOSED.

Visual precedence: explicit PO contract in `docs/work-approvals/` → exact manifest-bound Work artifacts → approved screenshots/results → Work handoff prose → older chats/packages. Production/main remains higher authority for runtime/data semantics. A package absent from the registry must not be assumed approved; “FINAL CANDIDATE” alone is insufficient.

## Visual Workflow V2 — exact accepted patch

For user-visible UX, start from an isolated exact Product baseline. Work performs Real-Product Integration on actual DOM, forms and handlers where practical; PO reviews that integrated result. After approval, Work freezes an Exact Accepted Patch, source manifest and golden evidence. Codex transports and technically certifies **the same accepted patch**, with no visual reimplementation or reinterpretation. Unexpected application-source correction after freeze stops for review unless PO explicitly authorizes a narrowly specified micro-fix. Focused behavior, golden/visual, geometry and accessibility gates precede Cloudflare Preview, PO Preview approval, exact-candidate Production promotion, PO Production verification and CLOSED. The existing patch transport succeeded for WA-SCHEDULE-0429; later tooling may generalize its historically Google-specific name, but Google is not the active visual authority. Static/synthetic Work remains useful for early exploration and comparison; after selection, prefer integration on real Product before transfer.

For high-risk Auth, Supabase/schema/RLS, Owner Guard, Sync, deletion/restore, student lifecycle and scoring foundations, Codex establishes and verifies the runtime/data contract first; Work integrates approved UX on that exact foundation; Codex certifies the combined candidate. Production remains runtime/data authority, Work visual/UX authority and PO final acceptance authority.

Any Product change that affects the RAKEEZ user experience—features, design, presentation, interaction, usage flow, or functional behavior—must also be reflected in Demo whenever that capability logically applies there. Account-specific, authentication, cloud, Supabase, and private-user-data behavior that does not logically belong in Demo is exempt. This is the PO-approved N02 parity rule; it does not authorize a particular implementation. D-075 clarifies that shared non-user reference data should use one RAKEEZ authority where appropriate: official Calendar terms, dates, holidays and preset/region semantics are a later Product/Demo parity follow-up, not a claim of current completion. Demo remains isolated from real students, attendance, grades, private teacher/account data, Product Sync and Supabase mutations.

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
- [Work Approval Ledger](WORK_APPROVAL_LEDGER.md) and `work-approvals/`: index, explicit PO visual/UX contracts and frozen source manifests for still-relevant Work approvals; not runtime/data authority.
- [Current Architecture](CURRENT_ARCHITECTURE.md): checked-in source contracts, with its audited SHA; recheck source after a later runtime change.
- [Test Matrix](TEST_MATRIX.md): gates selected by change risk.
- [Release Checklist](RELEASE_CHECKLIST.md): exact-SHA promotion/review steps.
- [Changelog](CHANGELOG.md): concise material Production changes, not a test/prompt/evidence archive.
- This file: roles, process, and authority. Historical handoffs and the dated `ARCHITECTURE`, `RAKEEZ_X_TECHNICAL_ARCHITECTURE`, `RAKEEZ_X_PROJECT_CONTINUITY`, `SUPABASE-AND-SYNC`, `MIGRATIONS`, `REQUIREMENTS`, and `OPEN_ISSUES` documents retain their date-bound meaning; canonical files supersede stale current-state claims in them.

## Autopilot Relay (0302)

The local tooling at `D:\Abdullah Projects\RakeezX-Autopilot` can transport **Codex → ChatGPT → Codex** handoffs for normal-ticket coordination after PO/PM approval. It accepts only explicit `RAKEEZ_AUTOPILOT: CONTINUE`, `PO_REVIEW_REQUIRED`, `HARD_STOP`, or `DONE` markers; absent/ambiguous markers stop. The relay transports decisions; it does not make Product decisions, infer authorization, or bypass Work, Preview, or Production PO review. No unattended watcher is enabled.

## Conversation continuity (N31)

Plan a rollover for ChatGPT, Codex, and Work at a safe checkpoint when interaction slows or hangs, UI becomes stale/unreliable, context is repeatedly lost, a major phase completes, or a major new phase starts in an already long conversation. Do not use a fixed message-count threshold as the main trigger. Before rollover, reconcile [Project State](PROJECT_STATE.md), [Decisions](DECISIONS.md), [Product Ledger](PRODUCT_LEDGER.md), current ticket/open/closed/deferred work, and the authority roles above. Prepare a short handoff for each destination containing only current state, sources of truth, approved decisions, active/open/deferred tickets, next step, and critical safety rules. New conversations start by reading canonical files; old conversations remain historical references, not current authority. The manual RakeezX 4 rollover has occurred; the old conversations are historical. Future rollover remains a separately coordinated safe-checkpoint action, and Relay routing must be reverified rather than inferred from old bindings.
