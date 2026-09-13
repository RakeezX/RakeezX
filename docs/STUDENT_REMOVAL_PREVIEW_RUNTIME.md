# Student removal preview runtime V1

Ticket: STUDENT-REMOVAL-PREVIEW-RUNTIME-01 (0084).
No user-facing UI is introduced by this ticket. Work-Active is not modified.

## Consumer API

`await store.previewStudentRemoval(studentId, sourceEnrollmentId, sourceRevision)`

Equivalent direct runtime export: `src/lib/student-lifecycle.js`.
Use the exact current active source enrollment ID and its `serverRevision`.
Do not supply an outcome, owner, mutation ID, or evidence payload.

The result contains **only** `{ outcome, reason, retryable }`:

- `delete_pristine` / `pristine`: no protective evidence visible to the server or initiating device, within the bounded V1 contract.
- `end_enrollment` / `history_exists`: server-visible protective evidence exists; exact active source is valid.
- `end_enrollment` / `local_protected_evidence`: server classified pristine but the initiating device has existing local protection evidence, including local-only submissions. Exact source validity was established by the server.
- `blocked`: no removal outcome is available for confirmation. Never guess an offline outcome.

Safe blocked reasons: `invalid_source`, `student_unavailable`, `student_deleted`, `stale_source`, `archived_enrollment`, `auth_required`, `offline`, `sync_not_ready`, `preview_unavailable`.
`retryable` means a fresh preview may be useful after the contextual condition changes; it is not a promise that retrying a mutation will fix it.
Malformed/unrecognized results and transport errors become `preview_unavailable`, without raw errors or private data.
Missing/wrong-owner student identity is not distinguishable through evidence contents.

## Read-only and authority boundary

The authenticated RPC `rakeezx.preview_student_removal(text,text,bigint)` derives owner from `auth.uid()`.
Anon/PUBLIC EXECUTE is denied. No table grants or new frontend evidence access are introduced.
The RPC uses the existing owner advisory boundary, then fresh VOLATILE reads. No Product writes, receipts, revisions, timestamps, roster changes, tombstones or history entries occur during preview.
The runtime reads existing Sync health without invoking `assertCloudRestoreReady`, `syncAll`, or another mutation/Sync action. Pending work or reconciliation checkpoints block preview.
Local evidence is read from IndexedDB using readonly transactions before/after the RPC, not stale in-memory arrays. A same-device local-only submission arriving during preview prevents pristine classification.

Server pristine classification reuses `pristine_student_blocker` from migration 0029, including retained/deleted evidence, snapshots, reports, arrangements and lifecycle receipts.
Migration 0030 extracts the existing end-enrollment source checks into private `student_removal_source_blocker` and makes execution reuse them without changing check order, locks, writes, return codes, receipts or transfer behavior.

## Preview is not an execution lease

Existing `deletePristineStudent` and `endStudentEnrollment` execution still recheck local and server authority independently. Preview creates no checkpoint or permission to bypass those checks.
Another device can record evidence, transfer/end enrollment or delete the student after preview; execution can then reject/protect the operation. A changed consequence needs a new preview/confirmation, not an automatic client-selected replacement outcome.

Other-device local-only submissions cannot be queried by the server. This V1 contract does not prove global “never used,” invent cross-device local evidence access, or change the existing bounded deletion semantics.

## Delivery and verification

Apply additive `supabase/migrations/0030_student_removal_preview.sql` before deploying the runtime helper. It installs two functions and narrowly refactors the existing source-check call; no Product rows are rewritten or read during installation. Installation aborts atomically if the reviewed 0029 source-check block has drifted.
Metadata-only verification: `supabase/verify-0030-student-removal-preview.sql`.
Verify normal linked migration history lists 0030 on both local and remote.
No new UI, database table, data migration, reinstatement, Sync semantics or transfer semantics.

Focused tests cover pristine/history classification, stale/archived/tombstoned source, local-only evidence, privacy, ZERO Product writes, authenticated-only execution, account changes, TOCTOU rechecks, two-device convergence and real two-connection advisory-lock races. Existing lifecycle suites run against both 0029 and 0030.
