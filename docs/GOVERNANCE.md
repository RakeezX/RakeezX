# RAKEEZ X governance

| Authority | Decision |
| --- | --- |
| Product Owner | Product acceptance and final Production review |
| Work-Active | Active Visual/UX golden source |
| Production/main | Runtime, data, and deployed-contract authority |
| Codex | Selective Production implementation and evidence |

Never merge a Work branch wholesale. Compare its accepted visual outcome with current Production and port only missing approved changes. Archive is history, not a runtime source. Keep applied Supabase migrations immutable; introduce a new additive migration only under a separate authorized ticket.

An exact-SHA candidate needs proportional gates from [TEST_MATRIX](TEST_MATRIX.md) and an evidence handoff. Promotion needs explicit authorization, unchanged main ancestry, and deployment metadata confirming the same SHA. User-visible work remains `PRODUCTION REVIEW PENDING` until the Product Owner verifies it.

Continue through routine test/tooling setup autonomously. Stop for Product decisions, data-loss/security risk, unexpected main movement, schema ambiguity, or a Product-code change outside the ticket. Full filesystem access is not permission to mutate private data or Production.
