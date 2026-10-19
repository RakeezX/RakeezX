# N116 — on-demand candidate locally verified

AI-authored implementation continuation, 2026-10-19. Current run `df7d23e0-8d02-4090-af18-92974aac704f`; same task/worktree/base as the historical diagnosis below. The activated card now includes attendance and Home. Prior diagnostic commit `b52e754ec3707f59d318b34ee34a46347ec5ac0a` is retained; its baseline reproduction/evidence was not rerun against the changed contract.

## Result and rationale

- Boot, route changes, wake/timer events and slot add/edit no longer create the day's sessions. The existing timer still updates presentation. No new JS dependency or advance-generation timer was added; N44 sending remains OFF.
- Home uses a separate read-only operational projection for today's unopened lessons. Persisted history getters remain stored-record-only. Projections use the selected calendar, effective timing and existing natural session identity; recorded identities and tombstones suppress competing projections.
- Attendance mount, period selection and return-to-today create only the selected occurrence. Exact N121 attendance links keep their session identity; the card's separate class link creates nothing. Invalid/foreign requested session links do not silently open another lesson. Historical/manual sessions remain canonical.
- Creation uses the existing account/class ownership and lease guards and one atomic local sessions/outbox transaction. The transaction checks durable natural identity (including unseen tombstones), current context and date/timing, writes one owner-bound pending command, and adopts records only after persistence. Repeated/concurrent requests do not mint another durable command. Abort/stale view cleanup and visible errors remain; local persistence is not an ACK.
- The base had `CALENDAR_PRESET_SWITCH_TEMPORARY_HOLD = false`, contrary to this card's explicit instruction to retain the calendar-region switching hold. This candidate reasserts that existing hold (`true`) without changing its existing first-selection/same-selection behavior. This mitigation does **not** prove the underlying hosted year/calendar Sync case fixed and does not authorize regional rollout, new service operations or retrying rejected outbox records.

## Affected verification

`node tests/n116-1019-browser.mjs` — exit 0. Actual application modules, DOM, handlers and source CSS served on a task-owned ephemeral loopback HTTP origin in fresh isolated Chromium through the canonical `withIsolatedLocalBrowser` helper. Existing served-demo readiness and synthetic account fixture reused; the measured flow uses the actual claimed account workspace/provision receipt and ownership guards, not a Demo-only engine substitute.

Recorded PASS in `tests/n116-1019-browser.json`:

- Unopened Home cards visible without sessions/outbox writes; pageshow/visibility wake create nothing. Class link opens class; exact period-2 attendance link creates only period 2 and one owner-bound pending command, leaving period 1 and another teaching unopened.
- Actual period switch and previous/next date handlers preserve exact identity/history without historical backfill. A stale exact link after a holiday edit creates nothing.
- Injected IndexedDB transaction failure is visible in the actual attendance error toast and leaves no optimistic/durable session or command.
- Calendar-before-open blocks creation; re-enabling a study day uses the changed current timing. Repeated/concurrent selected-occurrence requests retain one durable session command and previously recorded timing stays frozen.
- Foreign parent owner, unresolved owner, foreign Auth and LIMITED lease reject creation. Pre-aborted opening writes nothing. A durable tombstone not yet in the document's memory is retained without creating a command. Attendance, grades and recorded historical session are byte-for-byte unchanged.
- `n116_on_demand_session_generation_calendar_change_idempotent_history_safe` PASS for this synthetic affected scope. Hosted Sync, Production and PO acceptance are not claimed.

Screenshot `tests/fixtures/n116-1019/home.png` inspected: actual Home layout/cards remain visible with separate class and attendance links. No new date/time inputs. Source syntax and whitespace checks are recorded in the final result. No full build/blanket suite or old eager-generation suite was run; the publisher owns its build and delivery checks.

Harness corrections preserved honestly: the initial new fixture referenced nonexistent `makeAttendance` and was corrected to the existing attendance record/identity shape before browser use. Initial account proof correctly failed after changing the fixture's lease-generation binding; the fixture now renews the lease against its new matching synthetic binding. A later Arabic test selector had an encoding error and was corrected to UTF-8/Unicode escapes. Original browser failures remain in JSON `previousFailures`; guards were not relaxed. The final corrected affected check passed without page errors. Every browser context and the task-owned HTTP server closed in helper/server `finally`; no shared/live phase, external service or user browser used.

## Historical diagnosis — superseded scope blocker

The following section records the earlier blocked runs only; its statements about unchanged Product source and missing card paths are historical, superseded by the corrected card and implementation above.

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
