# N123 — startup transient Sync error, 19 October 2026

AI-authored implementation and evidence. Task `continuous-n123-startup-transient-error-20261019`; run `376bb4d1-6dbc-4185-9f38-2c2ddac531df`; observed origin/main and candidate parent `258fbbd57740a14fa75cff31a7e243dcafa4acff`.

## Concrete reproduction and correction

Actual application boot called `renewLeaseInBackground()` and immediately initialized Sync. An expired cached session can refresh during the first full pull. The existing final context guard correctly rejects the captured old session (`Sync ownership blocked: sync-context-changed`), which becomes a hard presentation failure. Automatic retry then succeeds, explaining a reproducible red-to-green flash. This is a synthetic reproduction of the source race, not a trace from the PO's device.

Pass the existing startup renewal promise into Sync initialization. While this prerequisite is unsettled, automatic/manual Sync and remote receiver startup wait, and the shell remains usable with neutral «جارٍ الاتصال للمزامنة». Once renewal settles, including failure, ordinary Sync runs through the unchanged ownership/auth/lease/revision guards. No green result is manufactured and no genuine failure is reclassified. Persisted failed/rejected counts and recovery/owner blocks retain priority. Retry delays, debounce and latency algorithms are unchanged. No new startup dependency or offline-shell asset is introduced.

## Affected verification

- `N123_BASELINE=1 node tests/n123-priority-1621/startup.mjs`: PASS reproducing the old code's actual DOM red-to-green transition after a delayed synthetic expired-session refresh. See `tests/n123-priority-1621/baseline.json`.
- `node tests/n123-priority-1621/startup.mjs`: required `n123_startup_transient_wait_and_genuine_failure_truthful` PASS. Actual 390px app DOM, handlers and source CSS over a task-owned loopback HTTP origin. Preparation stays pending with zero cloud-table reads; healthy Sync follows a real coordinator completion and timestamp. Manual Sync with persistent synthetic student-read failure stays red with visible support action. Foreign authenticated owner through the same real manual UI makes zero additional reads and remains ownership-blocked. Synthetic grade 18 and empty outbox remain intact. See `tests/n123-priority-1621/result.json`.
- `node --check` for the three changed application JS files and both test modules, plus `git diff --check`: PASS.

Uses the canonical isolated-local-browser helper: fresh disposable context, loopback only, no live credentials, external requests/Service Workers blocked; owned browser/context and server closed in finally. No shared browser lease is required for this eligible isolated synthetic phase. No account/service mutation, schema/Auth/RLS change, push or deployment performed.

Existing delivered N123 latency/ACK/context proofs in `tests/n123-feedback-1532/` remain unchanged and were reused without rerunning their matrices. This candidate is locally ready only; independent publisher integration, official served-asset verification and actual PO review remain pending.
