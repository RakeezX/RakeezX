# RAKEEZ Agent Bridge

The Agent Bridge is a small internal CLI that packages exact, reviewable candidates outside Product repositories. It records hashes, approval, validation freshness, and resume evidence. It never promotes, pushes, deploys, applies migrations, or kills processes.

## Handoff root

Set `RAKEEZ_HANDOFF_ROOT` or pass `--root`. The Windows default is:

`D:\Abdullah Projects\RakeezX-Handoffs`

Each ticket contains `manifest.json`, `candidate.patch`, `validation.json`, `REVIEW.md`, and `HANDOFF_CODEX.md`.

`WORK_TICKET.md` and `WORK_DESIGN_BRIEF.md` are reported as local artifacts and excluded from candidate bytes automatically. Add a conservative future workflow pattern with repeated `--local-artifact`, for example `--local-artifact "LOCAL_REVIEW_*.md"`. Patterns cannot target tracked Product areas or use broad forms such as `*.md`.

## Work or Codex candidate

```powershell
node scripts/rakeez-agent-bridge.mjs pack TICKET-01 `
  --source-agent work `
  --source-repo "D:\path\to\workspace" `
  --base <production-sha> `
  --allow src/views/example.js `
  --test-profile default-ui

node scripts/rakeez-agent-bridge.mjs status TICKET-01
node scripts/rakeez-agent-bridge.mjs approve-local TICKET-01 --candidate <exact-candidate-sha>
node scripts/rakeez-agent-bridge.mjs inspect TICKET-01
node scripts/rakeez-agent-bridge.mjs resume-info TICKET-01
```

## Google patch intake

```powershell
node scripts/rakeez-agent-bridge.mjs pack TICKET-02 `
  --source-agent google `
  --source-repo "D:\path\to\production-checkout" `
  --base <expected-production-sha> `
  --patch "D:\incoming\candidate.patch" `
  --allow src/views/example.js `
  --test-profile default-ui
```

Google and Git candidates pass through the existing visual patch transport guard. Patch bytes are normalized to UTF-8/LF without changing Product source files.

## Approval and validation

`approve-local` requires the exact candidate SHA. Approval and validation remain valid only while the patch SHA256 and current Git candidate match the manifest. Candidate changes automatically mark prior approval and validation `STALE`. `CLOSED` is protected and requires explicit Product Owner Production verification plus an exact Production SHA.

Test profiles are editable in `config/rakeez-test-profiles.json`. Combined profiles deduplicate focused tests and schedule only one build and one diff check per candidate.

## Resume and processes

`resume-info` compares recorded state with the current source repository, commit, remotes, and Production baseline. Git reality wins; candidate drift or an unexpectedly advanced remote main produces a STOP recommendation. It never resets, rebases, or force-pushes.

`processes` reports only processes registered as bridge-started, including known children, ports, active state, and manual PowerShell/taskkill guidance. It never kills a process.

## Security

The bridge rejects forbidden paths and credential-like content. Never package environment files, secrets, service-role keys, browser storage, real student data, attendance, grades, notes, preservation archives, or AI Studio environment files.

## Workflow

Work: isolated candidate → pack → PO Work review → approve-local → Codex selective implementation and focused validation → Cloudflare Preview → PO Preview approval → separately authorized exact-SHA Production promotion → PO Production verification → CLOSED.

Google AI Studio is parked/backup. The optional exact-patch intake above remains a technical CLI capability, not active visual authority or automatic promotion authorization. Any explicitly authorized intake follows the same PO/Preview/Production review boundaries.

## Candidate-bound validation

Record focused evidence without executing it again:

```powershell
node scripts/rakeez-agent-bridge.mjs record-validation TICKET-01 `
  --candidate <exact-candidate-sha-or-working-tree-fingerprint> `
  --profile home `
  --command "node --test tests/focused.test.mjs" `
  --exit-code 0 `
  --build-pass `
  --diff-check-pass `
  --note "Focused local gate"
```

Repeated profiles and commands are deduplicated. Build evidence can be recorded only once per candidate. `status`, `inspect`, and `resume-info` report validation as `FRESH`, `STALE`, or `MISSING`, with a reason. Changing candidate bytes automatically makes earlier validation stale.

Use `inspect <ticket> --read-only` when auditing an existing handoff that must not be reconciled or rewritten. It computes current candidate, local-artifact, and validation state without modifying package files.
