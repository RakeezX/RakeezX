# RAKEEZ X — Product ledger

## INBOX — PRODUCT OWNER NOTES

<!-- Product Owner: paste raw notes here, one bullet per thought. No classification is required. -->

## Structured ledger

Triage is by the Product Owner and ChatGPT PM. An INBOX note is **not** implementation authorization. Keep resolved, rejected, and superseded rows visible; change their status and Last Updated date rather than deleting them. One item may reference multiple tickets. Archive capability atoms belong in [Recovery Ledger](RECOVERY_LEDGER.md), not here.

Allowed Status: `INBOX`, `REVIEW`, `PLANNED`, `IN_PROGRESS`, `WAITING_PO`, `BLOCKED`, `DEFERRED`, `CLOSED`, `REJECTED`, `SUPERSEDED`. Type: `BUG`, `FEATURE`, `UX`, `RECOVERY`, `TECH_DEBT`, `DOC`, `IDEA`. Priority: `CRITICAL`, `HIGH`, `MEDIUM`, `LOW`, `UNSET`.

| ID | Date Added | Last Updated | Area | Type | Summary | Status | Priority | Source | Related Ticket | Next Action |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| RX-0001 | 2026-09-25 | 2026-09-25 | Recovery | RECOVERY | Review archived useful capabilities page by page against current Product and approved Work. | WAITING_PO | UNSET | 0303 direction; [Recovery Ledger](RECOVERY_LEDGER.md) | 0303 | PO/PM approve the first Quick Log review scope; no code restoration. |
| RX-0002 | 2026-09-25 | 2026-09-25 | Student Profile | BUG | Historical X→Y continuity symptom was reported earlier, but current Production path is not reproduced. | REVIEW | UNSET | [Open Issues](OPEN_ISSUES.md), historical PO report | STU-REC-01B | Capture current route/device/cache evidence before selecting a fix. |
| RX-0003 | 2026-09-25 | 2026-09-25 | Classroom projection | UX | Decide whether a distinct Safe Display contract is still needed beyond current classroom presentation/Board. | WAITING_PO | UNSET | [Recovery Ledger](RECOVERY_LEDGER.md) audit proposal | Safe Display review | PO/Work compare real current surfaces with archived intent. |
| RX-0004 | 2026-09-25 | 2026-09-25 | Home / Teacher Day | RECOVERY | Determine whether any Teacher Day capability is missing from current Home/Today Focus. | REVIEW | UNSET | Current `src/views/home.js` and archive page map | Teacher Day review | Inventory old capability before choosing preserve/recover/redesign. |
| RX-0005 | 2026-09-25 | 2026-09-25 | Tooling | TECH_DEBT | 0302 relay live dry run passed; normal-ticket agent-driven use and unattended trigger remain unapproved. | WAITING_PO | LOW | 0302 handoff and local state | 0302 | PM reviews enabling constraints; no automatic Product ticket handoff yet. |

This ledger does not claim a true current Silent Beta blocker. New security, owner-isolation, data-loss, or live Production failures are escalated immediately on evidence, not silently folded into a deferred item.
