---
name: rakeez-evidence-manifest
description: Record one compact exact-scope result without repeated global seals.
---

Return final JSON using the runner's supplied schema and exact `taskId`/`runId`. Include `state` (`LOCAL_READY`, `BLOCKED` or `NO_CHANGE`), `candidateSha`, `baseSha`, `worktreePath`, `changedPaths`, `checks` as `{name,status,evidence}` records, `summary`, `blockerType`, `blocker` and `nextAction`. Use actual full Git SHAs where available and schema-permitted nulls otherwise; never invent a field's evidence. The runner writes `resultPath`.

Do not edit queue status or write DEPLOYED from the worker. The controller binds the candidate and the adapter records actual provider/served Production evidence; only that permits runtime `awaiting_po`, which releases capacity without Product closure. Do not convert SKIP into PASS, emulation into physical-device proof or Preview into Production.

Link existing affected evidence; do not make a new report per probe or repeat immutable logs. Exclude secrets, real private rows and raw UA. Use no separate audit worker, global ref seals or unrelated worktree hashes. Follow `docs/RAKEEZ_OPS_CONTRACT.md` for acceptance and authority.
