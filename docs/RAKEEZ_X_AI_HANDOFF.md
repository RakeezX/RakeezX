# RAKEEZ X — AI Bootstrap Handoff

Read this first, then [RAKEEZ_X_PROJECT_CONTINUITY.md](RAKEEZ_X_PROJECT_CONTINUITY.md), [RECOVERY_LEDGER.md](RECOVERY_LEDGER.md), [OPEN_ISSUES.md](OPEN_ISSUES.md), `AGENTS.md`, and the named ticket.

1. **What this is:** RAKEEZ X is an Arabic-first, offline-first teacher PWA. Student identity, historical sessions/attendance, sync safety, and small verified changes matter more than speed.
2. **Sources of truth:** Google AI Studio is the approved visible UX source. Production `main` is the runtime/data/sync source. Never wholesale-merge `visual/main` or copy prototype runtime code.
3. **Workflow:** obtain PO-approved scope, inspect current branch/status/diff, make only scoped changes, run the ticket Lean Gate, commit logically, promote only when explicitly authorized, then wait for PO Production verification before `CLOSED`.
4. **Current baseline:** Production `main` is documented at `e82f58a`; PWA cache release is `rakeezx-v6`. Migrations `0008`, `0009`, and `0010` are already applied in Production and must not be reapplied.
5. **Open work:** Treat `STU-REC-01B` as `DEFERRED`, not fixed: implementation exists but PO reported transferred student history still appears empty in destination context. Grade portability and historical class-report truth are separate open tickets.
6. **Do not:** change schema/migrations without explicit authority; rekey history; change sync architecture casually; run destructive cloud work; mark implementation as closed; or replace Production runtime from an archive.
7. **Read next:** the relevant view/store/sync files, focused tests, matching migration(s), the ticket template, and recent commits. For data/sync work also read `docs/SUPABASE-AND-SYNC.md`.
