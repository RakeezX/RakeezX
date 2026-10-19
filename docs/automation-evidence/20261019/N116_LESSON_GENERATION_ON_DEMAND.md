# N116 — diagnosed; exact card-scope repair required

AI-authored, 2026-10-19. Task `continuous-n116-lesson-generation-on-demand-20261019`, run `9d9ad329-0029-4e7c-8e41-1f817958af6d`.
Base / observed origin/main: `644e6896c24e02e00d46c558a0f87c563f644870`.
Worktree: `C:\Users\Abody\Projects\RakeezX\.worktrees\continuous-n116-lesson-generation-on-demand-20261019`.

## Actual finding and product rationale

The canonical current N116 ledger row requests creation when opening a lesson, with calendar stability and preserved history. Existing application paths create all eligible lessons for today:

- `src/app.js`: route resolution, boot, and the session trigger callback call `ensureSessionsForDate` without a teaching/period selection.
- `src/lib/session-auto.js`: time boundaries, pageshow and foreground visibility invoke that callback.
- `src/store.js`: slot addition/edit also invoke the daily generator. The generator loops every active teaching and today's matching slots, freezes timing, and persists those rows. The read-only projection currently excludes today.
- **`src/views/attendance.js:25`**: `ensureActive(tchId)` calls `ensureSessionsForDate(date)` without passing `tchId`. Mount and previous/next/today navigation use this entry. Opening one lesson therefore still creates other lessons, even if app-level automatic calls are removed.
- **`src/views/home.js`**: today's focus and attendance links read `store.sessionsOn(today)`, which currently contains persisted rows only. Removing eager writes without providing a separate operational projection hides unopened scheduled lessons. Changing the shared stored-session getter to return fabricated persisted records would confuse history/statistics and mutation consumers.

Recommended smallest coherent implementation: retain a separate read-only projection for unopened lessons today; materialize only the selected teaching/period through the attendance entry using current calendar/timing and existing natural identity/tombstone checks; remove automatic daily writes while retaining presentation refresh. Keep recorded/manual/archived lessons and all attendance/grades unchanged. No pre-lesson creation is justified by an active sending requirement; N44 sending remains OFF. This mitigation does not establish a repair of the underlying hosted year/calendar Sync case and must not release the calendar-region switching hold.

## Concrete blocker and exact repair

The activated card's `allowedPaths` omits **`src/views/attendance.js`** and **`src/views/home.js`**. These are affected Product entry points, not a service permission boundary. Add those exact two paths to this same inactive card through the approved maintenance procedure, preserve this base/candidate/session, and let the controller resume it. No new worker/card or real-data authority is needed.

An app-only route hook is insufficient: it cannot cover the attendance view's internal date/session handlers, and the unscoped view call would continue generating the whole day. Do not infer selected teaching from global location inside the store or replace stored-history getters with projections to avoid the missing paths. A partial runtime change was deliberately not made. The current queue/card/ledger and all Product source remain unchanged.

## Bounded evidence

`node --test tests/n116-1019-reproduction.mjs` — PASS, 1 diagnostic test, exit 0. Fake IndexedDB, frozen synthetic date, two teachings and three slots. The actual store generator persisted three unopened sessions; repeat created none; a later holiday made the date ineligible but retained the original rows and created no attendance. This establishes the eager-freeze interaction, not a hosted Sync failure or an implemented on-demand fix. See `tests/n116-1019-reproduction.json`.

The first diagnostic process passed its assertion but retained the store BroadcastChannel. It was interrupted through its owned execution session; test finally cleanup was corrected to close the channel and database. The corrected single diagnostic exits normally. No browser/server/live resources were acquired, no external service called, and no deployment attempted.

Required acceptance `n116_on_demand_session_generation_calendar_change_idempotent_history_safe` — **NOT_RUN**: implementation awaits the exact scope correction. No rendered-UI PASS is claimed. On resumption, use the existing isolated HTTP app/browser helper for the actual attendance mount/date/session handlers and today's projected link, with a small fixture covering calendar-before-open, selected-period-only creation, repeat/concurrent idempotency, tombstones and unchanged recorded history/grades. Preserve owner/lease and pending/error/ACK safeguards; do not expand to a blanket suite or claim Product acceptance.
