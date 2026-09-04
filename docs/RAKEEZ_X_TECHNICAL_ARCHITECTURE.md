# RAKEEZ X — Technical Architecture

This document describes the current repository implementation. It distinguishes source evidence from facts that cannot be established from a checkout alone.

## Local-first data model

`src/lib/db.js` opens IndexedDB database `rakeezx`, version `2`. All stores use `id` as key path. Runtime records normally carry `updatedAt` and `deleted`; a tombstone is retained so a stale device cannot recreate deleted data.

| Store group | IndexedDB stores | Current responsibility |
| --- | --- | --- |
| Identity/settings | `profile`, `device`, `meta`, `timeProfiles` | `profile` is account data; `device` is device-local and excluded from backup/sync. `meta` is legacy migration input. |
| Academic structure | `years`, `terms`, `subjects`, `sections`, `teachings` | A teaching is section × subject × term. |
| Student membership | `students`, `enrollments` | `students.id` is durable; enrollment owns section, status, dates, and roll number. |
| Teaching records | `items`, `scores`, `slots`, `sessions`, `attendance`, `logs`, `notes` | Sessions are dated historical events; attendance is session-specific. Notes/logs carry student and optional teaching/session context. |
| Calendar/curriculum | `calendars`, `calendarDays`, `units`, `lessons` | Calendar presets and dated calendar exceptions drive schedule behavior. |
| Reserved models | `assignments`, `submissions` | Local stores exist, but the product decision for assignments/projects remains deferred. |
| Synchronization | `outbox` | Durable queued record mutations and enrollment-operation receipts. |

`db.applyBatch()` supports atomic multi-store reads/writes. Transfer, renumber, and deletion paths use it to keep local state and outbox intent consistent.

## Core identity and history rules

- `section.id` is immutable logical identity. Editing grade/label must not delete/recreate a section or its dependent history.
- A student has one durable `student.id`; transfer changes enrollment, not student identity.
- An enrollment is the current/historical section membership. One active enrollment is expected for a student.
- `teachings` identify the subject delivery context. Grade items/scores remain teaching-scoped.
- Sessions retain their original `teachingId`, date, period, and status. Attendance links a `studentId` to a `sessionId` and retains teaching/date context.
- `studentHistory(studentId)` projects attendance, logs, and notes over the durable student identity while preserving their original teaching, section, subject, term, and session context. It does not make grades portable.
- Notes are dated, multi-entry records. Legacy `student.note` data can be migrated to note records by `migrateLegacyStudentNotes()`.

## Transfers and roster numbering

`store.transferStudent()` retires the source enrollment, activates/creates the destination enrollment, and computes both final rosters in one IndexedDB transaction. It queues a composite `transfer-renumber` outbox operation.

On Supabase, migration `0009_transfer_and_renumber_rosters.sql` provides `rakeezx.commit_enrollment_transfer_and_renumber(...)`. It validates payloads, locks the student and both sections, rejects stale/tombstoned identities, temporarily clears active roll numbers within the transaction, and writes both final sequences atomically. Migration `0008` retains the explicit `renumber_enrollment_roster` compatibility path.

The visible manual `إعادة الترقيم` control still exists in `src/views/students.js`; its continued need is an open product decision.

## Sync and cloud boundary

`src/lib/sync.js` coordinates automatic, debounced sync when an authenticated cloud session is online. Syncable stores are profile, structural records, students/enrollments, notes, scoring/logs, timetable/session/attendance, and time profiles. Dependency order sends timetable/session records before logs that may reference a session.

`src/lib/cloud.js` maps local camelCase records to the `rakeezx` Supabase schema and invokes special RPCs for enrollment operations. Generic records use owner-scoped upsert/read mappings; tombstones map to `deleted_at`. The outbox snapshot is acknowledged only when the matching queued entry was successfully synchronized, preventing a concurrent local mutation from being discarded.

Profile sync includes `teacherName`, `schoolName`, and canonical `reportPrincipalName`; legacy/device fallback is not allowed to override a non-empty synced principal value. Current source implements field-level merge behavior, but the complete cloud conflict policy should be treated as the operating contract in `AGENTS.md` unless a ticket proves a more specific behavior.

Unknown from repository source: the live Supabase project configuration, migration history table contents, production row counts, and deployment credentials. Verify those through approved production access; do not infer them from source files.

## Calendar and timing

Calendar presets and calendar days are local/syncable data. `resolveProfile()` selects timing profiles by active ranges and hybrid calendar days. Built-in timing profiles include summer, winter, Ramadan, and hybrid modes; remote timing is hybrid behavior rather than a standalone built-in profile. Timing-profile UX is intentionally under redesign/deferred review.

## PWA and offline behavior

`sw.js` is a static service worker. Release `rakeezx-v6` precaches shell assets, calls `skipWaiting()`, claims clients on activation, deletes only prior `rakeezx-*` caches, uses network-first navigation, and fetches executable JS/CSS online before using cache fallback. IndexedDB is not cleared by service-worker activation.

The app is offline-first: IndexedDB remains the runtime persistence layer and mutations queue in `outbox` for later synchronization. Core behavior must not depend on remote fonts or a required remote runtime.

## Supabase migrations present in the repository

| Migration | Evidence-based purpose |
| --- | --- |
| `0001_core_schema.sql` | Creates `rakeezx` core tables with owner identity, server timestamps, soft deletion, and device/client metadata. |
| `0002_indexes_triggers_rls.sql` | Adds indexes, touch/owner triggers, and RLS/policies. |
| `0003_hybrid_calendar.sql` | Adds `remote` as an allowed `calendar_days.kind`. |
| `0004_student_notes.sql` | Adds dated, soft-deletable student notes with RLS-related support. |
| `0005` | Not present in the current migration directory; purpose unknown. |
| `0006` | Not present in the current migration directory; purpose unknown. |
| `0007_sections_active_normalized_identity.sql` | Adds normalized active-section identity protection. |
| `0008_enrollment_membership_operations.sql` | Adds safe transfer and manual enrollment-roster renumber RPC operations. |
| `0009_transfer_and_renumber_rosters.sql` | Adds the atomic transfer plus dual-roster-renumber RPC. |
| `0010_profile_report_principal_name.sql` | Adds non-null `profile.report_principal_name` with default empty string. |

Supplied Production state says `0008`, `0009`, and `0010` are applied and migration-history aligned. Never reapply or alter these applied migrations.
