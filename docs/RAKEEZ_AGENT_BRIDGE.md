# RAKEEZ Agent Bridge

The Agent Bridge is a small internal CLI that packages exact, reviewable candidates outside Product repositories. It records hashes, approval, validation freshness, and resume evidence. It never promotes, pushes, deploys, applies migrations, or kills processes.

## Handoff root

Set `RAKEEZ_HANDOFF_ROOT` or pass `--root`. The Windows default is:

`D:\Abdullah Projects\RakeezX-Handoffs`

Each ticket contains `manifest.json`, `candidate.patch`, `validation.json`, `REVIEW.md`, and `HANDOFF_CODEX.md`.

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

Work: candidate workspace → pack → Product Owner local review → approve-local → Codex inspect/transport → Production Review → Product Owner verifies → CLOSED.

Google: exact patch → pack/intake → the same review, approval, transport, and Production Review path.
