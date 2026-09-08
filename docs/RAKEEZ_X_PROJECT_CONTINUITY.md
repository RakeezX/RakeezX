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
- Documented current Production SHA: `5644a019b7006560f082a0af090f96ff8a8f4ace`.
- `SESSION-AUTO-01B` is merged and deployed: eligible ordinary scheduled-session shells materialize only through today, while future sessions remain derived from the timetable until their date. It remains `PRODUCTION REVIEW` pending Product Owner verification, not `CLOSED`.
- `SYNC-V2` is CLOSED after Product Owner Production verification: three devices converged automatically from fresh bootstrap, offline writes propagated after reconnect, and deleted data did not resurrect after refresh or reopen.
- `SYNC-UX-02` is CLOSED after Product Owner Production verification: a stale Teacher Control Center yellow badge was a UI-only class-reconciliation defect, not a Sync V2 engine/data defect. Future changes to sync indicators retain focused Mini Hub state-transition and reconnect regression coverage.
- Production PWA cache release: `rakeezx-v8` in `sw.js`; it contains the V2 runtime assets and retains the verified offline core-route coverage and service-worker update behavior.
- The active Sync V2 database is validated through migrations `0001`–`0017`. The former Production database remains frozen as fallback/archive for now; do not write to or migrate it as part of normal work.
- Browser/runtime access uses `sb_publishable_*` only. Legacy `anon` and `service_role` API keys are disabled; RLS/owner isolation and zero anonymous `rakeezx` table grants were verified.
- Current migration directory: `0001`, `0002`, `0003`, `0004`, `0007` through `0017`. `0005` and `0006` are not present in this repository and must not be inferred.
- Sync V2 migration history was verified aligned through `0017`; do not reapply or edit applied migration SQL.

The ticket-level source of truth for current and historical work is [RECOVERY_LEDGER.md](RECOVERY_LEDGER.md); active risks are in [OPEN_ISSUES.md](OPEN_ISSUES.md).

## Sync V2 closure guard

The closure preserves the V2 architecture and its regression warnings. Any future sync-affecting change must run focused release/Auth and Sync V2 runtime regressions for the affected path before promotion. Realtime is not required for correctness: current verified automatic cross-device propagation can take approximately one minute. A perceived-speed improvement may be scoped separately without changing the proven synchronization semantics.
