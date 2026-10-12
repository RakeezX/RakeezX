# Candidate and delivery receipts

An activated worker returns the runner's JSON result: `taskId`, `runId`, `state`, `candidateSha`, `baseSha`, `worktreePath`, `changedPaths`, `checks`, `summary`, `blockerType`, `blocker` and `nextAction`. Its state is `LOCAL_READY`, `BLOCKED` or `NO_CHANGE`. The controller validates the actual Git candidate and required affected checks, then the delivery adapter proves authorized publication independently.

An approved existing Git candidate may be reused on current main after inspecting the relevant patch. Work-derived changes retain their exact approval ID and accepted behavior; [the Work Approval Ledger](WORK_APPROVAL_LEDGER.md) and the relevant contract preserve that authority. Preserve Product runtime/data semantics and unrelated user work.

The older `scripts/rakeez-agent-bridge.mjs` is optional historical transport tooling. It is not a required stage, does not own the new queue, and its handoff or CLOSED conditions do not gate the next activated ticket. Do not manufacture a Bridge artifact chain, copy a whole Work tree, or equate a transport receipt with release authority. Follow [the operating contract](RAKEEZ_OPS_CONTRACT.md).
