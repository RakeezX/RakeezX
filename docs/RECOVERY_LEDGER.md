# RAKEEZ X — Recovery Ledger

This is the current product ledger, not a claim that every historical branch is deployable. `CLOSED` requires Product Owner Production verification. Preserve previously approved capabilities when their older container/page was superseded; recover them through a scoped ticket instead of restoring archived runtime files.

## Closed from supplied PO/project state

| Ticket / batch | Status | Evidence / boundary |
| --- | --- | --- |
| Recovery B Batch 1 | `CLOSED` | Supplied project state; production recovery batch. |
| Recovery B Batch 2 | `CLOSED` | Supplied project state; class colors/mini-hub recovery scope. |
| Recovery B Batch 2.1 | `CLOSED` | Supplied project state; section identity convergence work. |
| Calendar Batch 3 | `CLOSED` | Supplied project state; calendar controls/presets. |
| Batch 4 | `CLOSED` | Supplied project state; retain its approved behavior even if its older container changed. |
| CAL-FU-01 | `CLOSED` | Supplied project state. |
| STU-TR-01A | `CLOSED` | Membership/roll/sync safety; production lineage includes `cef2b60`. |
| STU-REC-01A | `CLOSED` | Automatic dual-roster renumber; production lineage includes `c80526b`. |
| SET-DATA-01 | `CLOSED` | Principal cloud sync/local-reset safety; production lineage includes `b601519`; migration `0010` is supplied as applied/aligned. |

## Open, deferred, or redesign work

| ID | Status | Ledger evidence / required boundary |
| --- | --- | --- |
| STU-REC-01B — Continuous Student History | `DEFERRED` | Implementation exists in Production (`8e39408`, PWA follow-up `e82f58a`), but supplied PO verification failed: after X → Y, previous-class attendance/history still appeared empty; returning to X restored prior contextual record. Do **not** mark fixed. Later work must reproduce the actual Production path before changing code. |
| STU-REC-01C — Grade Portability | `OPEN` | Grades remain teaching-scoped; no portability was approved in 01B. |
| STU-HIST-01 — Historical Roster / Reports Truth | `OPEN` | Historical class roster reconstruction, execution reports, and attendance completeness remain separate from the student-profile history projection. |
| Schedule / Timing Profiles | `REDESIGN` / `DEFERRED` | Current functionality exists; UX and timing-indicator direction requires PO-approved redesign. |
| Academic-year / term management | `DEFERRED` | Future product workflow needs an explicit ticket; do not infer lifecycle semantics from existing stores. |
| PWA install guidance deep-link | `DEFERRED` | Current install guidance exists; deep-link behavior is not yet a closed product decision. |
| Splash / boot redesign | `DEFERRED` | Product refinement, not a reason to disturb boot reliability. |
| PWA/app icon and identity redesign | `DEFERRED` | Visual ownership is Google/PO; preserve offline asset behavior. |
| Home, schedule, reports, classes presentation refinement | `DEFERRED` | Visual refinement, scoped by approved Google work. |
| Timing indicator UX | `DEFERRED` | Needs visual/product decision. |
| Intermittent click/focus/repaint glitch | `OPEN` | Runtime workflow issue; record a reproducible path before implementation. |
| Automatic/quiet sync UX review | `DEFERRED` | Current automatic sync works by queued/outbox model; review status communication without changing sync semantics casually. |
| Manual `إعادة الترقيم` button | `DEFERRED` | Automatic transfer renumber exists, but manual renumber remains in current UI until its remaining use case is assessed. |

## Reconciliation notes

- Current Git evidence can show a commit is on `main`; it cannot substitute for PO Production verification.
- The supplied status for STU-REC-01B conflicts with earlier implementation/promotion history: code and focused tests exist, yet PO reported the original visible symptom. The PO observation governs this ledger.
- Repository migration filenames skip `0005` and `0006`. No purpose/history is asserted for them without external migration records.
