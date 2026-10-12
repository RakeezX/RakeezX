# RAKEEZ — live status entry

For current Product status, read [the active ledger](docs/PRODUCT_LEDGER.md) and [closed ledger](docs/PRODUCT_LEDGER_CLOSED.md). For current work, read `artifacts/ops-supervisor-v4/ACTIVE_TASKS.json` and only the relevant `queue/*.json`; inspect their timestamps and actual controller/worker identity when diagnosing liveness.

Operating authority and continuation are in [RAKEEZ_OPS_CONTRACT.md](docs/RAKEEZ_OPS_CONTRACT.md) and [PROJECT_INSTRUCTIONS.md](docs/PROJECT_INSTRUCTIONS.md). `start-ops.ps1` launches the current controller; verify its live state and checkpoint instead of launching a legacy supervisor or resuming a ticket from this document.

This file is a pointer, not a dated status report. It carries no phase, current main SHA, worker count, completion total or STOP state. Process existence and heartbeat are not delivery evidence; use the task receipt and observed provider/served result. `awaiting_po` preserves review while releasing execution capacity.
