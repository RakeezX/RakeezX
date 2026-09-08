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
| STU-HIST-01 | `CLOSED` | Historical session roster truth was approved and Production-verified; migration `0011` is applied/aligned. |
| STU-REC-01C | `CLOSED` | Grade portability was approved and Production-verified. |
| SYNC-UX-01 / OFFLINE-ROUTES-01 | `CLOSED` | Quiet automatic sync, reconnect recovery, and core offline-route coverage were Production-verified; carried forward in the Sync V2 release. |
| SYNC-V2 | `CLOSED` | Production `aeffd5e54207109fa2ef53569583d694ff8a6d3d`: PO verified three-device bootstrap and automatic propagation, offline write/reconnect, and tombstone non-resurrection. Candidate migrations `0001–0017`, RLS/owner isolation, and publishable-key-only browser access were verified. |
| SCHEDULE-UX-01 | `CLOSED` | Daily schedule, timing-model, residual validation, and new-profile initialization work were Production-verified. |

## Awaiting Product Owner Production review

| Ticket | Status | Evidence / boundary |
| --- | --- | --- |
| SESSION-AUTO-01B | `PRODUCTION REVIEW` | Production main `725c28c`: today-only scheduled-session materialization, future projection without future persistence, durable V2 session writes, and focused race/tombstone/rollover coverage are deployed. Await PO Production verification; do not mark `CLOSED`. |

## Open, deferred, or redesign work

| ID | Status | Ledger evidence / required boundary |
| --- | --- | --- |
| STU-REC-01B — Continuous Student History | `DEFERRED` | Implementation exists in Production (`8e39408`, PWA follow-up `e82f58a`), but supplied PO verification failed: after X → Y, previous-class attendance/history still appeared empty; returning to X restored prior contextual record. Do **not** mark fixed. Later work must reproduce the actual Production path before changing code. |
| Academic-year / term management | `DEFERRED` | Future product workflow needs an explicit ticket; do not infer lifecycle semantics from existing stores. |
| PWA identity / splash / boot / install-guidance refinement | `DEFERRED` | Preserve the verified offline shell and current install guidance; future refinement is visual/product work. |
| Home / reports / classes presentation refinement | `DEFERRED` | Visual refinement, scoped by approved Google work; the next recovery page review is Home. |
| RUNTIME-FOCUS-01 | `CONDITIONAL / REPRO REQUIRED` | Do not treat as active implementation work without a reproducible Production path. |
| Manual `إعادة الترقيم` button | `DEFERRED` | Automatic transfer renumber exists, but manual renumber remains in current UI until its remaining use case is assessed. |

## Planned product work

| ID | Status | Ledger evidence / required boundary |
| --- | --- | --- |
| SYNC-UX-02 — Teacher Control Center Sync State | `OPEN BUG / AUDIT REQUIRED` | PO observed a yellow sync state remaining after a successful sync while another surface shows green synced. Audit later for stale UI state, duplicate surface/rendering, subscription, or another cause; do not reopen SYNC-V2 unless engine/data correctness evidence requires it. |
| CLASS-RULES-01 — Classroom Rules | `PLANNED` | Add a Class tools card immediately after Quick Log / `الرصد السريع`: `القوانين الصفية`, with view/manage, add/edit, and icon-plus-text rules. Google Visual Lab review is required before Production implementation. |
| SCHEDULE-EXPORT-01 — Schedule Export | `PLANNED` | Export the schedule as an image or PDF. Exact visual/export design requires later review. |
| SUPPORT-FEEDBACK-01 — Support / Feedback / Problem Report | `PLANNED` | Structured in-app technical problem, suggestion, and inquiry support. Future diagnostics must be privacy-safe and exclude instructional content, credentials, tokens, and secrets; storage/delivery design remains a Product/Production decision. |
| SCHEDULE-MOBILE-TODAY-01 — Mobile Current-Day Navigation | `PLANNED` | On school-week mobile schedule entry, navigate to the current day; do not force it on weekend/non-school days. Google Visual Lab must define interaction details. |
| HOME-ONBOARDING-01 — New User Getting Started | `PLANNED` | A restrained Home empty state for users without classes should make the path clear: create a class, add students, then configure lessons/schedule. Google Visual Lab defines final UX. |

## Reconciliation notes

- Current Git evidence can show a commit is on `main`; it cannot substitute for PO Production verification.
- The supplied status for STU-REC-01B conflicts with earlier implementation/promotion history: code and focused tests exist, yet PO reported the original visible symptom. The PO observation governs this ledger.
- Repository migration filenames skip `0005` and `0006`. No purpose/history is asserted for them without external migration records.
- Current Production baseline: `725c28c79de2fb8a4cf132fb9a64a840053370eb`.
- The former Production database remains frozen as fallback/archive; Sync V2 Production is the active runtime baseline.
