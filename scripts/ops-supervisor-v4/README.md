# RAKEEZ operations — current launcher

PO authority: 2026-10-12 11:44 Asia/Riyadh. Operating procedure: `../../docs/RAKEEZ_OPS_CONTRACT.md`.

`start-ops.ps1` starts one `controller.mjs` under the existing Abody account. The controller owns dispatch, checkpoints, delivery and recovery; `run-task.ps1` is its Codex session wrapper. Do not also start or schedule the former supervisor/refill/planner. Existing runtime storage remains `artifacts/ops-supervisor-v4`.

After installing the reviewed local scripts and runtime configuration, register the task from the canonical repository:

```powershell
powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File .\scripts\ops-supervisor-v4\install-scheduled-task.ps1
```

`RemoteSigned` is process-scoped for these local scripts. The scheduled launcher uses the same flag. Do not run global `Set-ExecutionPolicy` or use `Bypass`; managed MachinePolicy/UserPolicy, if present, still take precedence. Registration may make the periodic trigger eligible immediately; current STOP markers remain enforced.

Only eligible cards with the current activation ID run. Old completed cards stay historical. States are `pending`, `running`, `delivery`, `awaiting_po`, `blocked`, `retry_wait`; verified `awaiting_po` releases capacity without closing the Product ticket. A failed or unproved deployment cannot become an accepted result.

Both STOP markers pause new admissions while the controller remains alive and safe active work drains. Later PO stops must be honored. Recovery checks process identity and provider/candidate state before repeating work. Acquire only required phase leases; never reclaim an unverified owner's lock.

Windows Scheduler uses AtLogon for Abody, `InteractiveToken`, `ExecutionTimeLimit=PT0S`, `MultipleInstances=IgnoreNew` and failure recovery. This runs after login, not before it. Pro access may require a quota/auth wait; the controller preserves progress without resets or paid model polling.
