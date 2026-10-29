# N143 Teams attendance import — AI implementation checkpoint

Task: `continuous-n143-teams-attendance-csv-20261029`  
Run: `22eb3123-0d81-419f-a67b-f4bedcbdd68b`  
Base: `b0e745d071690816613c516d0c791484315a5880`  
Result: **BLOCKED; do not publish this candidate.**

## Prepared scope

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

## Required bounded card correction before resuming this saved session

Both necessary paths are absent from the current four-path `allowedPaths` and `preflight.editPaths`:

- `src/store.js`: permit a narrowly scoped atomic only-if-unrecorded mode on the existing attendance mutation API, covering snapshot and legacy paths, while preserving ordinary manual attendance edits and the owner/lease/Sync transaction guards. The import must request that mode and truthfully distinguish skipped records. UI preflight alone cannot protect an in-flight or cross-tab record. Extend the affected race fixture to the corrected behavior; do not weaken the existing assertion.
- `sw.js`: the new **static startup dependency** `src/lib/teams-attendance-csv.js` is absent from `SHELL`; `attendance.js` is already in that shell. The install list does not recursively discover imports. A fresh installed shell that has not fetched the new helper cannot resolve the attendance import graph offline. Add that exact relative helper URL using the existing shell/version policy and check its affected integrity. This file was read only and was not edited outside authority.

Preserve this candidate, base and current saved session. The authorized maintenance helper may correct the inactive card under its existing guards; the original controller then resumes the same worker. No unchanged retry is useful. These are scope omissions, not new live-data authority requests. No queue files, live accounts, real records or provider operations were changed.

The task-owned Vite server and isolated browser were closed in their respective `finally` paths. No shared browser lease was acquired for the approved isolated local phase. Production served JS/relative imports/offline checks and teacher acceptance are **NOT_RUN**, owned by the later authorized delivery path after the local failures are repaired. No build, push or deployment was performed.
