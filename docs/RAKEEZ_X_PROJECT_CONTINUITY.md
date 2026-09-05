# RAKEEZ X — Project Continuity

## Purpose and roles

RAKEEZ X (رَكيز X) is an Arabic-first, offline-first teacher SaaS/PWA for class work, attendance, scoring, reports, and teacher records.

| Role | Responsibility |
| --- | --- |
| Product Owner (PO) | Owns product decisions, approves visible work, and performs the final Production verification. A ticket is not `CLOSED` without that verification. |
| ChatGPT | Planning, evidence review, ticket hygiene, documentation, and coordination. It does not substitute for PO approval. |
| Google AI Studio | Visual/UX Lab. Its approved visible design is the visual source of truth. |
| Codex | Production/runtime/data implementation. It owns the production repository, tests, offline behavior, sync, and migration safety. |

Production is the source of truth for runtime, data, synchronization, and persistence semantics. Google is the source of truth for approved visual UI/UX. Neither source replaces the other.

## Mandatory promotion workflow

1. Work is explored locally in Google AI Studio or Codex, within a named ticket.
2. Google-visible work receives PO approval before selective promotion.
3. Codex selectively implements/binds the approved scope in Production; it does not copy prototype runtime code.
4. Run the ticket's Lean Gate: the smallest focused tests, browser evidence, build, and `git diff --check` necessary to prove the change.
5. Promote only the approved commit(s), then verify the deployed Production behavior with the PO.
6. Mark `CLOSED` only after PO Production verification. Keep implementation-only work in review status.

Never merge `visual/main` wholesale into Production. Never restore old runtime files from an archive merely because an older visual state is desired; recover individual approved behavior through a scoped ticket and current Production architecture.

## Lean Gate methodology

Lean Gate means evidence proportionate to the changed risk, not a weaker standard. A ticket declares the focused unit/browser/sync/PWA checks it needs; a UI claim requires using the real control and observing the result. Broader suites are reserved for material persistence, data, or sync changes. A clean diff and production build are routine final checks when code changes.

## Status vocabulary

| Status | Meaning |
| --- | --- |
| `GOOGLE LOCAL REVIEW` | Visible work exists in the Visual Lab and awaits PO review. |
| `PRODUCTION REVIEW` | Scoped Production implementation is deployed or ready for PO verification. |
| `CLOSED` | PO has verified the required Production outcome. |
| `OPEN` | Known work or defect awaiting implementation. |
| `REDESIGN` | Direction is not sufficiently decided to implement safely. |
| `RESTORE` | Previously approved behavior must be recovered deliberately. |
| `DEFERRED` | Intentionally postponed; do not treat as fixed. |
| `REJECTED` | Deliberately not proceeding. |
| `REPLACED` | Superseded by a named decision or ticket. |

## Current Production baseline

- Repository Production branch: `main`.
- Documented current Production SHA: `b85115d6e2f9b1ebe514fe6e291dabea6fca3d2c` (`fix(schedule): initialize new timing profiles cleanly`).
- Relevant completed Production work includes session roster truth (`b7a22eb`), grade portability (`4568fce`, `76cda0a`), sync/offline recovery (`47ada73`, `d5365a9`), and Schedule/Timing UX through `b85115d`.
- Production PWA cache release: `rakeezx-v7` in `sw.js`; quiet automatic sync, reconnect recovery, and covered core offline routes are closed Production behavior.
- Current migration directory: `0001`, `0002`, `0003`, `0004`, `0007`, `0008`, `0009`, `0010`, `0011`. `0005` and `0006` are not present in this repository and must not be inferred.
- Supplied Production ledger state: migrations `0008` through `0011` are applied and migration-history aligned. Do not reapply or edit them.

The ticket-level source of truth for current and historical work is [RECOVERY_LEDGER.md](RECOVERY_LEDGER.md); active risks are in [OPEN_ISSUES.md](OPEN_ISSUES.md).
