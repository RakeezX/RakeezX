# Risk-based verification matrix

Select the highest applicable class after inspecting the diff. Run focused checks first; record actual pass/fail/skip counts. Use existing `scripts/test-sync-runner.mjs`, `scripts/e2e-runner.mjs`, `scripts/regression-gate.mjs`, and Build Meta tooling rather than duplicating them.

| Class | Required evidence before candidate handoff |
| --- | --- |
| `DOC/COPY` | Relevant content/contract check and `git diff --check`; build only if bundled copy changes. |
| `VISUAL` | Affected browser spec, real viewport/RTL/light-dark/accessibility check, build with normal Build Meta restoration, diff check; no runtime suite unless behavior changed. |
| `LOCALIZED_RUNTIME` | Affected unit/integration tests, directly affected browser flow, build/Build Meta, diff check; add neighboring domain regression where the call path overlaps. |
| `CRITICAL_DATA_AUTH_SYNC` | Synthetic owner/isolation and failure-path tests, affected Sync/Auth/data suites, disposable server integration when applicable, browser/offline/reload, one bounded canonical gate for significant changes, build/Build Meta, diff check. Never use real data to manufacture a pass. |
| `PRODUCTION` | Exact local/remote SHA and fast-forward ancestry, reused exact-tree test evidence, deployment metadata (environment, status, SHA), bounded non-destructive live smoke. No automatic test rerun or deployment without ticket authorization. |

`node scripts/rakeez.mjs preflight --base <sha> --candidate <sha> [--expect-main <sha>]` checks identity, migration immutability, dirty tree, and diff. It is read-only; PASS here does not replace the selected tests. `regression-gate.mjs` already runs Sync, browser, build, restores checked-in Build Meta, and checks the diff. Run it once when required, not as a debugging loop.

For any user-visible ticket, browser verification means the real control/action/result, relevant reload/persistence, and console/runtime checks. A Product Owner review is still required before CLOSED.
