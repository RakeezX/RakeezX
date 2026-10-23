# Owned checkpoint transient sharing repair — 23 October 2026

N44 exact run39c4090a-e653-4914-9fa0-855c3eed1b13 ended wrapper_error07:07:52Z when Save-Checkpoint atomic File.Replace failed. Its private send/recovery markers and incomplete Product result remain unchanged. No replacement result is manufactured. Existing controller owns saved-session continuation.

A local synthetic held FileStream reproduced failure in the original function (Win32 sharing code32). Prepared function retries only codes32/33/1175, at most10 sleeps of50ms, retaining File.Replace, the same owned temporary path and wrapper ownership lock. Persistent contention remains an error; no non-atomic overwrite, worker killing or queue write. Tests PASS: original failure, new atomic creation, transient recovery243ms, persistent failure662ms, prior JSON preserved, owned temporary cleanup. Test artifacts: intake-evidence/po-20261023-user-0538/checkpoint-sharing-test.ps1. No Product/browser/provider operation in these tests.

Install only through reviewed maintenance with requireNoActiveWorkers and idle publisher; current active launchers unchanged until then.
