---
name: rakeez-evidence-manifest
description: Produce a compact, non-sensitive RAKEEZ X ticket evidence manifest from exact Git identity and supplied verification results. Use for candidate or release handoff.
---

# Evidence manifest

Run `node scripts/rakeez.mjs evidence --ticket <ticket-id> --base <40-hex-sha> --candidate <40-hex-sha> [--input <safe-results.json>]`. The helper writes ignored `test-results/evidence/<ticket-id>/manifest.json` and `manifest.md` with sorted changed files and migration scope.

Supply only allowlisted test counts/status, build status, Preview/deployment identity, blocker codes, approvals, and Production verification state. The helper rejects extra fields; do not put secrets, tokens, student names, private Product rows, or raw logs in the input or manifest. A manifest records evidence; it does not turn an unrun check into PASS or authorize promotion.
