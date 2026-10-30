# N143 — direct Teams attendance rules

Task: `continuous-n143-direct-attendance-rules-20261030`
Run: `b5f58499-738c-49e8-8706-e5a7a0cdd818`
Base: `777fd9c7ad45b61c17d0ef91a9f3f9731d7d7fed` (HEAD and observed origin/main at entry).

## Implemented scope

File selection now classifies and records eligible students directly, with one progress/result summary and no review list, checkboxes, Apply button or confirmation. Imports are sequential, guarded against overlapping selection and changes of visit, account, session, date or saved timing. A genuine error stops the remaining records; saved status counts, skipped count and unsaved count remain visible. Cancelled file selection is a no-op. Disposal invalidates pending work and releases its import ownership.

The class window is the selected session's **saved** `date`, `startTime` and `endTime`: intended schedule values, not sensor-observed lesson times. Existing date/time validation is reused. Report M/D/Y and ISO date values and wall-clock times are compared without machine-timezone conversion. Meeting opening, organizer arrival, current time and a fixed lesson length do not define the window. Missing/zero/invalid session timing or an incompatible report date produces an Arabic no-write message pointing to saved session timing. Malformed/missing participant timing is skipped, never treated as zero-duration absence.

Participant UPN/email grouping is ephemeral. Repeated identity intervals, including section 3 rejoin activity, are clipped to the class window and unioned before classification. Distinct UPNs with the same display name (including a shared mailbox) stay ambiguous. Name-only activity must resolve uniquely; unknown/conflicting identity evidence cannot justify a fallback. Organizer identities are excluded before student matching. A summary fallback requires a valid first/last interval whose duration equals the reported total, so unknown gaps are not filled.

Coverage strictly below half is absent; exactly half qualifies. At least half is late only when the first valid report entry is strictly more than five minutes after class start; exactly five minutes is present. Pre-class entry is compared to saved class start; duration outside the window contributes no coverage. Matching uses existing Arabic normalization and the intersection of active enrollment and immutable session membership. Unreported/unmatched/ambiguous students stay untouched. Raw report identities and intervals never enter the store: only selected IDs and one validated status per command do.

`fillSelectedAttendance` accepts `status` in its existing options, defaults to present, and validates only present/late/absent/excused. It retains the same owner-bound snapshot/outbox transaction and no-overwrite filter, including tombstones. A concurrent saved-session timing change is also rejected in transaction preparation. Existing N141 popover, N144 attendance intent, dedicated RPC, schema and transport remain in place. SW cache advances v98 → v99; parser, models and date/time helper already belong to the shell, with no new asset.

## Actual affected verification

All data and identities below are generated synthetic fixtures; no real report, credentials, account, attendance record or remote service operation was used.

| Check | Result and evidence |
|---|---|
| `n143_interval_union_and_class_window_boundaries` | PASS. UTF-16LE BOM/UTF-8, quoted tabs, Arabic/English headers, organizer exclusion, repeated/rejoin overlapping intervals, clipping and short coverage, exact half and five-minute boundaries, early meeting opening, distinct identities/shared email, ambiguous/unknown activity, wrong date, missing/invalid/offset timing, defensible summary fallback, malformed duration, 1MB and 300 data-row limits. |
| `n143_direct_import_statuses_and_untouched_students` | PASS. Actual app DOM/handlers/CSS at task-owned `http://127.0.0.1:53143`, fresh disposable Chromium via canonical `withIsolatedLocalBrowser`. Direct statuses present/late/absent, existing late and concurrent native excused preserved on disk, unreported/ambiguous/invalid untouched; cancel, no preview/Apply, disabled repeat import, context change and partial access failure stop with truthful counts. Wrong date and missing saved timing write nothing. Real owner guard exercised with synthetic changed workspace. Tombstone, inactive membership and unresolved legacy-history rejection retain no-write guards. No report email leaks to application tables/Web Storage. Native remaining-attendance popover remains visible/usable. Mobile 360×800: dialog fits, no horizontal overflow. |
| `n143_selected_status_store_sync_atomicity_and_partial_failure` | PASS. Existing provisioned synthetic account/lease fixture → actual store → owner-bound outbox → Sync engine → cloud request constructor → local PGlite RPC. Each of present/late/absent/excused reaches only `override-b` with exact status/IDs; default present preserved. Invalid status, foreign child owner, changed Auth owner and concurrent on-disk schedule change reject without attendance/outbox changes. Repeating an existing mark returns saved 0/skipped 1. UI check above supplies actual partial-failure evidence. |
| `n143_offline_parser_dependency_in_shell` | PASS. Actual SW install/fetch handlers in cache VM: v99 caches parser once, includes models/date-time helper, and serves exact current parser bytes offline. This is a scoped cache harness, not installed-browser offline certification. |
| Changed JavaScript syntax and `git diff --check` | PASS. Parser, attendance view, store, SW and both affected test modules parse. No duplicated N144 bindings were introduced. |

Commands selected only affected test names in `tests/n143-teams-attendance-csv.test.mjs` and `tests/n143-selected-attendance-command.test.mjs`: `n143_interval_union`, `n143_direct_import`, `n143_selected_status`, `n143_offline`. Final UI run: 1/1 PASS; final account/store/Sync run: 1/1 PASS; parser/cache run: 2/2 PASS. Successful unchanged checks were reused after later fixture-only corrections.

Two newly added regression assertions initially failed due to fixture expectations: unresolved history used only a tombstoned row, while the existing legacy guard concerns nondeleted history; and the schedule rejection expected an inner error although the existing public API reports `TEAMS_WRITE_FAILED`. The fixture now creates ordinary nondeleted history before removing its snapshot, and asserts the existing public error plus unchanged disk/outbox. Both corrected checks pass without changing those guards. Expected negative-guard diagnostics and blocked-Service-Worker warnings appeared in the synthetic harness; page errors were empty.

Unchanged selected-command retry identity/receipt reconciliation, legacy full-roster SQL behavior and installed function/ACL evidence are reused from [the prior N143 evidence](../20261029/N143_TEAMS_ATTENDANCE_IMPORT.md) at the base release. The SQL/Sync/cloud implementations were not changed or reinstalled. No blanket suite or repeated service readback was run.

## Delivery limits and cleanup

Browser contexts/browser and the unique Vite server closed in owned `finally` blocks. This approved isolated local phase needs no shared live-browser lease; no live phase was opened. No queue/status/lock/global configuration was changed. No push or deployment was performed.

Publisher integration/build, provider checks, served Production proof and real-teacher acceptance are **NOT_RUN by this worker**. The independent controller/publisher owns those steps. Local readiness does not assert Production delivery or Product closure.
