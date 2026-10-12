# Product records and current execution

The two Product ledgers own lifecycle. `scripts/ops-supervisor-v4/controller.mjs` owns activated queue transitions; its `product-records.mjs` records material transitions and the verified Production receipt in the owned block of `PO_REVIEW_QUEUE.md`.

Read `artifacts/ops-supervisor-v4/ACTIVE_TASKS.json` for the current summary and `queue/*.json`, `controller-events.jsonl`, `results/` and `delivery/` there for the underlying evidence. A process exit or worker receipt does not establish deployment or Product acceptance.

`scripts/ops-docs.mjs` is a historical derived-document tool, not part of the continuous delivery path. Do not invoke its write/verify cycle after each ticket or use its generated counts, old PM queue or frozen release header to dispatch work. The controller does not require a second documentation handoff. Follow [the operating contract](RAKEEZ_OPS_CONTRACT.md).
