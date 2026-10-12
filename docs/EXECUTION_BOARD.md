<!-- BEGIN RAKEEZ OPERATING POINTER -->
# RAKEEZ — execution board pointer

Read `artifacts/ops-supervisor-v4/ACTIVE_TASKS.json`, then only the relevant `queue/*.json`. The controller owns pending/running/delivery/awaiting_po/blocked/retry_wait and records transitions in `controller-events.jsonl`; the task's `resultPath` and delivery receipt supply evidence. This document does not assign workers or require a PM handoff.

Use [the operating contract](RAKEEZ_OPS_CONTRACT.md) for current authority and the Product ledgers for acceptance. A verified delivery waiting for PO does not block the next eligible ticket. Read timestamps and actual process identity when diagnosing a stalled task; heartbeat alone is insufficient.
<!-- END RAKEEZ OPERATING POINTER -->

## Preserved historical context — not dispatch instructions

The original board below is retained for context, notes and evidence. Its dated worker assignments, ticket/phase status, capacity targets and required handoffs are historical; they do not launch or block current work.


# V5 execution — compact runtime, not historical narrative

Current owners/heartbeats: [ACTIVE_TASKS.json](../artifacts/ops-supervisor-v4/ACTIVE_TASKS.json). Planned cards: [delivery-plan.json](../artifacts/ops-supervisor-v4/delivery-plan.json). Resource locks: [leases/](../artifacts/ops-supervisor-v4/leases/). Product authority: [Product Ledger](PRODUCT_LEDGER.md) and [Closed Ledger](PRODUCT_LEDGER_CLOSED.md).

**PO-directed hold, 2026-10-12:** [STOP-REFILL](../artifacts/ops-supervisor-v4/STOP-REFILL) exists. No new tickets, new queue cards, workers or implementation work may be started until an explicit new PO instruction. The already running N44 worker finished LOCAL_READY on 2026-10-12 08:56; at the subsequent check zero workers remained. Supervisor may remain alive for monitoring. Historical or stale snapshot `stopRefill=false` is not evidence to override the real STOP-REFILL marker. The hourly RAKEEZ delivery automation has been disabled. Work-in-progress policy is one Product owner if later resumed, not the old two-family/three-worker direction.

**Verified Product release:** origin/main `d0bea326cb37d7c7d360521e8fc81c41d50b92d2`; 66 CLOSED / 22 OPEN on 2026-10-12. N33 has explicit PO Production acceptance and is **CLOSED**. N53, N15, N86, N87 also CLOSED; do not reopen based on stale historical runtime rows.

**Existing outcomes awaiting review (no new work):** N73 [Preview](https://96195b5e.rakeezx.pages.dev/) c961f28 real Demo QA PASS but **Production BLOCKED** (new D-119 flow is Demo-only; would disable currently supported live copy); N84 local 8/8/build but owner/Sync/Chrome open; N44 current-main isolated Demo local 6/6 but no real event/Push/Admin; N77 restricted local Delete UI without server/restore safety; N36 local MV3 names-only helper without verified official portal DOM. Exact decisions and evidence: [PM Release Gates](PM_REVIEW_QUEUE.md). No production promotions authorized from these current artifacts by virtue of an existing PO request alone.

No new Product lifecycle status is inferred from worker process logs, generated demos, local unit tests, or an isolated Preview. Use the current STOP marker and trusted evidence before any further action.
