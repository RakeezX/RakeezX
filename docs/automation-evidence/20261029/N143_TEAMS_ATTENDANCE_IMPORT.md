# N143 Teams attendance import — AI implementation checkpoint

Task: `continuous-n143-teams-attendance-csv-20261029`  
Run: `22eb3123-0d81-419f-a67b-f4bedcbdd68b`  
Base: `b0e745d071690816613c516d0c791484315a5880`  
Result: **BLOCKED; do not publish this candidate.**

## Original prepared scope (first attempt)

The current attendance toolbar has a separate Teams import button; the N141 native anchored choice remains intact. The import sheet reads an in-memory file with UTF-16LE BOM or UTF-8, tab-separated quoted cells, 1MB/300-row bounds, section 2 participants only, organizer exclusion and temporary UPN/email deduplication. Parser output discards those identities. Nothing uploads or persists the report.

The sheet uses the selected teaching/session/date, requires a matching valid summary date, matches exact unique `normalizeSearchText` names against the intersection of current active enrollment and session membership, and displays unmatched, ambiguous, duplicate and short participation. Short participation defaults to a configurable five-minute warning and remains selected for teacher review. An explicit confirmation writes selected IDs sequentially through the existing awaited `store.setAttendance(..., 'present')`. It rechecks context, ownership/access, membership, matching and already observed records. No student is made absent. Errors stop the sequence and display confirmed counts without automatic retry.

## Affected evidence — 2026-10-29

Only generated names and `example.invalid` identities were used. No PO files or private bytes were read or saved.

1. `n143_utf16le_tab_sections_dedup_organizer_and_duration`: **PASS**. UTF-16LE/UTF-8 equality, Arabic participant headers, organizer exclusion, repeated identity/activity exclusion, escaped quotes/tabs, 10-second and Arabic/English duration parsing, invalid date, malformed quote and size/row limits.
2. `n143_unique_owner_roster_matching_preview_unmatched_and_short_duration`: **PASS**. Unique normalized names, ambiguity, unmatched names, repeated roster aliases and matched-student aliases, configurable short threshold. Owner rejection is additionally exercised through the real UI/store in check 3.
3. `n143_user_confirmed_existing_session_only_unmarked_present_no_absence`: **FAIL** after extending the original passing scenario with an in-flight competing native write. Actual Vite application HTTP origin `http://127.0.0.1:53143`, real DOM/handlers/source CSS and native IndexedDB/store, fresh disposable Chromium context via canonical `withIsolatedLocalBrowser`. The following assertions passed before the race failure: selected/unchecked short participation; no write on preview/cancel/wrong date; existing late record unchanged in memory and disk; only the selected matching short participant present; unreported/ambiguous/unmatched students unchanged; existing N141 popover; session change rejects writes; a completed concurrent excused mark is skipped; a genuine restore-access failure after one write stops with one confirmed write and disabled retry; synthetic owner change rejects through the UI and existing `assertClassOperationsAccess`; no report identities in application IndexedDB/Web Storage and no non-GET requests. At 360px, real dialog geometry was within viewport with no document horizontal overflow. Service Workers were intentionally blocked by the isolated helper; this is not offline certification.

Commands: initial `node --test tests/n143-teams-attendance-csv.test.mjs` passed all three tests before adding the new race. The materially expanded UI check was then run with `node --test --test-name-pattern=n143_user_confirmed tests/n143-teams-attendance-csv.test.mjs` and **failed**. The original PASS does not supersede the expanded FAIL.

### Concrete transactional failure

The test starts `store.setAttendance('n143-s5', 'a', 'excused')` without awaiting it, then clicks the real import confirmation in the same document/event turn. The import's memory check sees no record yet. Existing `setAttendance` reads the competing committed row inside `mutateSnapshotAttendance`, but deliberately replaces its status. Observed result: **`present`; expected `excused`**. Assertion: `in-flight existing attendance must never be overwritten` (test line identified by Node output). This is a genuine failure of the required no-overwrite gate, not a fixture defect. No guard was removed or failure relabeled.

## Original required card correction — path grant now repaired

Both necessary paths are absent from the current four-path `allowedPaths` and `preflight.editPaths`:

- `src/store.js`: permit a narrowly scoped atomic only-if-unrecorded mode on the existing attendance mutation API, covering snapshot and legacy paths, while preserving ordinary manual attendance edits and the owner/lease/Sync transaction guards. The import must request that mode and truthfully distinguish skipped records. UI preflight alone cannot protect an in-flight or cross-tab record. Extend the affected race fixture to the corrected behavior; do not weaken the existing assertion.
- `sw.js`: the new **static startup dependency** `src/lib/teams-attendance-csv.js` is absent from `SHELL`; `attendance.js` is already in that shell. The install list does not recursively discover imports. A fresh installed shell that has not fetched the new helper cannot resolve the attendance import graph offline. Add that exact relative helper URL using the existing shell/version policy and check its affected integrity. This file was read only and was not edited outside authority.

Preserve this candidate, base and current saved session. The authorized maintenance helper may correct the inactive card under its existing guards; the original controller then resumes the same worker. No unchanged retry is useful. These are scope omissions, not new live-data authority requests. No queue files, live accounts, real records or provider operations were changed.

The task-owned Vite server and isolated browser were closed in their respective `finally` paths. No shared browser lease was acquired for the approved isolated local phase. Production served JS/relative imports/offline checks and teacher acceptance are **NOT_RUN**, owned by the later authorized delivery path after the local failures are repaired. No build, push or deployment was performed.

## Material scope repair and current result

Run `7328bc2d-1454-486c-a479-e0b6d57bb139` resumed saved session `01a1865a-5a54-7d83-94bf-35b5e948ba4e` from candidate `0b56f401124fab73530c4d57718bab0f095fa4ae`. The current card explicitly grants `src/store.js` and `sw.js`. The prior failures above remain historical evidence; no queue/status file was edited.

### Implemented bounded repair

- Added `fillSelectedAttendance` through the existing `mutateSnapshotAttendance` transaction. The selected ID set is deduplicated, checked against current active enrollment AND session membership, and filtered against actual attendance inside the same IndexedDB transaction. It reports saved/skipped counts and supports a synchronous UI context check during transaction preparation. Existing manual `setAttendance` and full-roster `fillAttendance` retain their default semantics.
- The import invokes the new API for each explicit selected ID, retaining sequential stop-on-error and truthful partial counts. A competing committed mark is skipped, not overwritten. Unresolved legacy attendance without a historical roster is rejected rather than falling back to non-atomic legacy writes or inventing a snapshot.
- **The new API deliberately refuses non-Demo workspaces** with `TEAMS_SELECTED_SYNC_UNAVAILABLE`, before any writes/outbox creation. This is necessary because the supposed existing selected-student receipt path does not exist end to end (see actual failure below). No broad fill or guessed alternate protocol is queued for a real account. This is a safe preparation checkpoint, not a releasable account feature.
- Added only `./src/lib/teams-attendance-csv.js` to the existing SW shell list and advanced its cache version from v97 to v98. No other asset was added.

### Current affected checks

- Parser and name-match unit results are **reused PASS**: their source and fixtures are unchanged. They were not rerun.
- `n143_user_confirmed_existing_session_only_unmarked_present_no_absence`: **PASS for local synthetic preparation**, after the materially changed source. The original in-flight competing native `excused` write remains `excused` in memory and IndexedDB. Repeating selected IDs returns `{saved:0,skipped:2}`, unchanged disk records, and no Demo outbox. Preview/date/session/owner/restore guards and partial-count assertions also pass. Added unresolved-legacy and unsupported-workspace negative cases reject without creating records. This does **not** establish authenticated account import/Sync readiness.
- `n143_offline_parser_dependency_in_shell`: **PASS, scoped SW handler/cache harness**. Executes actual `sw.js` install and fetch handlers in a VM, verifies the parser is cached exactly once in v98, its existing `models.js` dependency is in the shell, and an offline fetch returns the exact parser bytes. This is not installed-browser SW lifecycle or Production certification. No browser was used for this cache harness.
- `n143_atomic_selected_fill_and_repeated_sync_no_overwrite`: **FAIL**, a new genuine service prerequisite finding. Uses actual `createSyncV2Engine`, fake IndexedDB, PGlite, the unchanged attendance RPC SQL and the existing Realtime fixture helper. Requested `studentIds:["override-b"]` is present in the local command but absent from the dispatched envelope (`transported:null`). The real fill function creates attendance for both `override-b` AND unselected `override-c`; existing `override-a` remains `excused`. A deliberately lost acknowledgement and retry use the exact same command identity/envelope and reconcile successfully, but the unwanted extra student's row remains. Final assertion: `selected receipt must not mark an unselected student; current transport/RPC fills the whole roster` → actual `true`, expected `false`.

Commands: `node --test --test-name-pattern='n143_user_confirmed|n143_atomic_selected|n143_offline' tests/n143-teams-attendance-csv.test.mjs`, followed only by the materially corrected affected UI/Sync checks with `--test-name-pattern='n143_user_confirmed|n143_atomic_selected'`. The offline result was reused unchanged.

The first expanded run exposed a legacy preparation race; the final implementation now rejects unresolved legacy membership transactionally rather than permitting that unsafe fallback. The generic existing `createAttendanceServer` also failed before the selected gate because its all-migrations loop lacks the unrelated `rakeezx.n58_guard_calendar_contract()` prerequisite (PostgreSQL `42883`). The focused test therefore uses the unchanged attendance migration 0017 and its numbered prerequisites through 0017, plus the existing `installRealtimeFixture`, without modifying or stripping any SQL guard. That corrected harness reaches and preserves the actual selected-scope failure. No live service operation was attempted.

### Current concrete blocker and retry condition

The expanded card assumes an existing selected-student receipt capability. Actual source and executable evidence contradict that assumption:

1. `src/lib/sync-v2.js` dispatches `attendance:fill` without `mutation.patch.studentIds`.
2. `src/lib/cloud.js` builds `apply_sync_v2_fill_attendance_command` parameters without any selected IDs.
3. `supabase/migrations/0017_sync_v2_bulk_attendance_commands.sql` defines the RPC with only mutation/device/session/status/time parameters. It iterates **all** `v_snapshot.members`; its idempotent receipt envelope likewise has no selection.

Those transport paths are outside the current card, and there is **no grant for a new RPC/migration/service deployment**. Merely adding local `studentIds` cannot constrain server writes. Do not substitute a new protocol, send the broad fill, weaken the assertion, or claim the publisher will apply a backend change. A retry requires a specifically approved selected-only service/transport contract with matching paths, owner/session/membership/idempotency safeguards and exact service preparation/readback authority. If an already-applied capability is claimed, provide its immutable source/identity and verify that exact capability before enabling this API for accounts.

Current result remains **BLOCKED; do not publish**. Preserve this candidate/base/session. Original parser/matching evidence and the corrected local UI/cache results remain reusable. No new real-data authority was inferred. The owned Vite server and isolated browser closed in `finally`; no shared lease, live account, provider operation, push or deployment occurred.
