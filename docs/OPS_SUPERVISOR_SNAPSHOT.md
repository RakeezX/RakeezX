# Current execution snapshot

This file is a pointer, not a stored count, release SHA or running-process assertion.

- Current assignments and capacity: `artifacts/ops-supervisor-v4/ACTIVE_TASKS.json`.
- Authoritative task states and attempts: `artifacts/ops-supervisor-v4/queue/*.json`, `controller-events.jsonl` and `results/`.
- Actual publication evidence: `artifacts/ops-supervisor-v4/delivery/` and the corresponding task receipt.
- Product status and acceptance: [Active Ledger](PRODUCT_LEDGER.md), [Closed Ledger](PRODUCT_LEDGER_CLOSED.md) and [PO review queue](PO_REVIEW_QUEUE.md).

Use the current timestamps and process/heartbeat evidence when assessing liveness. `awaiting_po` after verified publication releases capacity; it does not close the Product item. The only launcher is `scripts/ops-supervisor-v4/start-ops.ps1`; the operating rules are in [RAKEEZ_OPS_CONTRACT.md](RAKEEZ_OPS_CONTRACT.md).
