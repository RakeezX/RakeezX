# RAKEEZ — verify the behavior changed

| Changed risk | Affected verification |
| --- | --- |
| Copy/icon/spacing | Inspect the actual changed result and its branch; syntax/diff check if relevant. No new suite, full-platform sweep or separate auditor. A surrounding Delete/Sync feature does not by itself make a copy-only edit a data mutation. |
| Ordinary behavior | Existing focused happy/error/privacy checks plus the affected visible flow when useful. Build once on the final candidate when delivery needs it. |
| Data/scoring | Changed invariants, negative path, owner isolation, persistence and relevant Sync/recovery; reuse unaffected evidence. |
| Auth/RLS/Delete/Restore/other critical data behavior | Preserve the applicable authorization, A/B owner, atomicity, stale-client, data-loss and recovery checks. Synthetic and live permissions remain distinct. |
| Delivery | Correct candidate/integration/provider/environment binding plus a bounded non-destructive served check. HTTP 200 or content metadata alone is insufficient. |

For responsive changes, inspect the affected widths/RTL/theme in one combined run. Use actual Safari/device verification when the defect depends on that browser/device; do not claim Chromium emulation proves an iPhone. For a label edit, do not invent a device gate.

For hosted RAKEEZ Demo, reuse `tests/helpers/served-demo-readiness.mjs`: isolated browser context, private-account network blocked, `.boot` detached and store/roster ready; never rely on development-only `window.store` or attach to a personal browser profile. The approved worker configuration has a separate capability proof; do not automatically route every CIM/Git/browser step to PM based on an old sandbox failure. If an actual denial recurs, record its current evidence and required capability without weakening ownership guards.

Fix a test/harness mismatch against the Product contract inside the same task and rerun the affected part once. At the second same blocker without new evidence, record it and move independent work forward. Preserve real failures and label skipped/emulated checks honestly. Do not repeat an unchanged PASS or a global refs/worktrees/history audit. See [the operating contract](RAKEEZ_OPS_CONTRACT.md).
