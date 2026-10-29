# N141 — local bulk attendance choice evidence

- Task: `continuous-n141-bulk-attendance-present-absent-20261029`
- Run: `20556b38-3159-4b84-a46c-d7e872370e6f`
- Base: `69db3dc89e7b8e7717f526cca9d5f6d6c52c3ee5`
- Authority: activated PO 2026-10-29 card and current N141 Product row. Local synthetic preparation only; controller/publisher owns integration and served-source verification.

## Implemented

One quiet `رصد الباقين (N)` button with dropdown affordance opens the existing accessible `openSheet`. Its two explicit choices are present and absent. Copy clarifies that all unrecorded students in the session are included, even outside search results. Both choices retain status-specific before-start confirmation. The captured session ID is checked after choice and again immediately before calling the unchanged native `store.fillAttendance(sessionId, choice)`.

No store, ownership, Sync, history, scoring, schema or live service changes. N44/N88 untouched.

## Affected verification — PASS

`node --check src/views/attendance.js` exited 0.

`node --test tests/n141-attendance-bulk-choice.test.mjs` exited 0: two focused subtests passed (three TAP tests including the parent), zero failed/skipped. Actual application served through task-owned Vite at `http://127.0.0.1:53141`, canonical isolated browser helper, fresh disposable Chromium context, RTL 320×800, blocked external requests and Service Workers, synthetic Demo fixtures only. Existing `openReadyServedDemo` helper used; no replacement HTML/CSS or store mocks.

| Required gate | Observed evidence |
| --- | --- |
| `n141_only_unmarked_student_records_changed` | Both choices fill the two remaining students, including one outside search results. Four previously marked present/absent/late/excused records remain deeply equal in memory and IndexedDB. A native asynchronous individual marking raced against the bulk click retains its late status. |
| `n141_two_explicit_choices_and_prestart_confirmation` | Exactly one dialog with the two correctly counted choices and full-session copy. Both statuses show their own before-start text, cancel without writes, then confirm successfully. Toolbar button and both choices fit within 320px, remain at least 40px tall, with no horizontal document overflow. |
| `n141_correct_session_context_and_rollback_on_cancel` | Escape closes the choice and returns focus to the opener with unchanged records. Canceling pre-start confirmation leaves records unchanged. Invoking the actual session-switch handler while either choice or confirmation is pending prevents writing the captured session. |

No uncaught page errors. Expected console warnings report that Service Worker registration is blocked in the isolated context; this check does not certify offline/Service Worker behavior.

Browser/context cleanup is owned by the canonical helper's `finally`; the Vite server closes in the test's `finally`. No listener remained on port 53141 after completion. No global browser lease is required for this eligible isolated local phase.

Full suite, build, live account/service mutation, Preview and Production checks: **NOT_RUN**, outside this worker's affected check scope. Source is locally ready only; no deployment or PO acceptance claim.
