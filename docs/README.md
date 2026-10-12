# RAKEEZ — current document map

Start with [the operating contract](RAKEEZ_OPS_CONTRACT.md), [project instructions](PROJECT_INSTRUCTIONS.md) and the activated task card. Read only its Product row/decision/affected files. Historical operating instructions do not restore old holds, blanket checks or PM handoffs.

- [Active Product Ledger](PRODUCT_LEDGER.md) and [Closed Product Ledger](PRODUCT_LEDGER_CLOSED.md) own Product status.
- [Decisions](DECISIONS.md) and [Current Architecture](CURRENT_ARCHITECTURE.md) define Product behavior and data contracts.
- [Test Matrix](TEST_MATRIX.md), [Release Checklist](RELEASE_CHECKLIST.md) and [Governance](GOVERNANCE.md) implement the same current contract.
- [Continuation entry](RAKEEZ_X_AI_HANDOFF.md) points to live state; [Operations Log](OPERATIONS_LOG.md) retains material history.

Runtime is `artifacts/ops-supervisor-v4/queue/*.json`; `ACTIVE_TASKS.json` is a live summary. `workflow-v5.json` holds the current activation and capacity. `scripts/ops-supervisor-v4/start-ops.ps1` starts one controller; legacy directory names do not imply the old supervisor/refill procedure.

PO review entries may await acceptance without blocking the next eligible delivery. PM review/board/state summaries must not create extra gates or override Product ledgers and actual execution/provider evidence. No current SHA or ticket state is duplicated here.
