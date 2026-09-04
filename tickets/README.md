# RAKEEZ X Ticket System

Create one ticket file from [TEMPLATE.md](TEMPLATE.md) for each bounded product change. The ticket is the contract between Visual Lab, Codex, and Product Owner.

## Lifecycle

1. `OPEN`: state the user-visible problem, approved scope, and explicit exclusions.
2. `GOOGLE LOCAL REVIEW`: Google AI Studio work awaits PO visible approval.
3. Codex implements only the approved Production/runtime/data scope and records evidence from the Lean Gate.
4. `PRODUCTION REVIEW`: implementation is promoted/deployed or explicitly ready for PO production verification.
5. `CLOSED`: only after PO validates the required Production behavior.

Use `REDESIGN`, `RESTORE`, `DEFERRED`, `REJECTED`, or `REPLACED` when those terms better describe the work. Never call a ticket closed because code, a commit, or a local test exists.

Do not merge `visual/main` wholesale. Do not reapply an already-applied migration, rekey historical data, or expand a ticket without PO authorization.
