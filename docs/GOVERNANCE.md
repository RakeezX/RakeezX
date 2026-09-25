# RAKEEZ X governance

| Authority | Decision |
| --- | --- |
| Product Owner | Product acceptance and final Production review |
| ChatGPT | Product Manager, reviewer, ticket/documentation coordinator; never substitutes for PO approval |
| Work-Active | Active Visual/UX golden source |
| Production/main | Runtime, data, and deployed-contract authority |
| Codex | Selective Production implementation and evidence |

Google AI Studio is parked/backup, **not** the current active visual authority. An unapproved Work experiment is not yet golden. For user-visible work, distinguish PO Work-local approval, PO Cloudflare Preview approval, and PO Production verification; none is implied by the other.

Never merge a Work branch wholesale. Compare its accepted visual outcome with current Production and port only missing approved changes. Archive is history, not a runtime source. Keep applied Supabase migrations immutable; introduce a new additive migration only under a separate authorized ticket.

An exact-SHA candidate needs proportional gates from [TEST_MATRIX](TEST_MATRIX.md) and an evidence handoff. Promotion needs explicit authorization, unchanged main ancestry, and deployment metadata confirming the same SHA. User-visible work remains `PRODUCTION REVIEW PENDING` until the Product Owner verifies it.

Continue through routine test/tooling setup autonomously. Stop for Product decisions, data-loss/security risk, unexpected main movement, schema ambiguity, or a Product-code change outside the ticket. Full filesystem access is not permission to mutate private data or Production.

## Document ownership

- [Project State](PROJECT_STATE.md): what is true **now**; update after material live state changes.
- [Decisions](DECISIONS.md): durable approved Product/architecture decisions and supersessions.
- [Recovery Ledger](RECOVERY_LEDGER.md): archive capability classification and page-by-page review map, not Product backlog authorization.
- [Product Ledger](PRODUCT_LEDGER.md): raw PO notes, triage, current/future Product follow-ups.
- [Test Matrix](TEST_MATRIX.md): gates selected by change risk.
- [Release Checklist](RELEASE_CHECKLIST.md): exact-SHA promotion/review steps.
- This file: roles, process, and authority. Historical handoffs retain their date-bound meaning; canonical files supersede stale current-state claims in them.

## Autopilot Relay (0302)

The local dry-run tooling at `D:\Abdullah Projects\RakeezX-Autopilot` can transport **Codex → ChatGPT → Codex** handoffs. It accepts only explicit `RAKEEZ_AUTOPILOT: CONTINUE`, `PO_REVIEW_REQUIRED`, `HARD_STOP`, or `DONE` markers; absent/ambiguous markers stop. The relay transports decisions; it does not make Product decisions, infer authorization, or bypass Work, Preview, or Production PO review. Normal-ticket relay use remains pending PM review; no unattended watcher is enabled by 0302.
