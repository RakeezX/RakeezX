# N122 — permanent activity / waiting timetable slots

Task: `continuous-n122-permanent-activity-waiting-slots-20261019`
Current run: `615e6042-61d6-4701-936e-e5b505532bfb`
State: **BLOCKED / implementation — hosted preimage exposed missing lifecycle entry guard; no hosted write**

## Hosted continuation: stopped before application

The new card authorized exactly the qualified migration hash below on project `xlrubcwjqktzzunrvuns`. Two sanctioned Supabase `execute_sql` catalog-only queries read migration history, slot metadata/policies/triggers and function definitions/owners/ACLs. They read no teacher/student records and created no hosted fixture. `apply_migration` was **not called**. No write lease was acquired because the phase stopped during read-only preparation.

Evidence: `tests/n122-1019-hosted-preimage.json`, observed 2026-10-19 09:51:46 UTC. No N122 history entry or new columns were present; RLS, owner-bound academic FK and NOLOGIN role metadata were present. The concrete blocker is source/preimage incompatibility, **not** a tool refusal or unexpected hosted drift:

- Existing public `apply_sync_v2_section_lifecycle_command(text,text,text,text,date,bigint)` is the 0029 wrapper, normalized body MD5 `c97cc4db769bd3c590cf161172b136e6`. It checks Auth, calls `lock_student_lifecycle(auth.uid())`, then delegates to the protected `_before_student_0029` body (MD5 `98c190e60237f952122355c6bfab2eee`).
- The exact immutable N122 source replaces that public wrapper with the copied 0021 lifecycle body. Its body contains no `lock_student_lifecycle` call, and obtains section/row locks before any write. The existing statement lock trigger runs at the later write; it does not retain the public RPC's entry lock ordering. No concurrent failure was induced or claimed.
- This is a defect missed by the prior local preparation: its six native gates passed the tested semantics but did not check preservation of the existing entry mutex. Those recorded results remain unchanged; they do not certify this newly identified guard.
- The current card requires all existing student/history guards and forbids changing the authorized source bytes. Applying these bytes would remove an existing guard, so application stopped before any write. The SHA remains `ddc1a199003e8b8ba1162d84b6261ce624bd4704953c74d781b8ad3b6c6e9d9f`.

Retry condition: the parent must bind a corrected exact source that retains the 0029 public wrapper and its early owner mutex (for example, adjust only its protected delegate's conflict query), authorize the necessary source/hash correction and targeted native entry-guard qualification, then resume the same session. No unchanged local UI/bootstrap replay or substitute hosted operation is needed. This continuation committed evidence only; Product and SQL bytes remain exactly those of `b1214a5770b63077acc6442ea00b4bb1cd508f64`.

Observed current `origin/main` was `3993436dcd7f7f8b72e437a35858f473d2128c67`. No affected Product/model/Sync/migration file changed from the saved base, so no merge or retest was needed. The saved declared base `c929cfbcae012c2074e75e63e51f1c70c076916e` and candidate history are preserved.

## Scope and source reconciliation

The earlier material correction authorized local implementation and exactly one append-only migration source. Its local-only restriction is superseded by the current exact hosted-phase card. The historical local evidence below is reused. This continuation performed only the two data-free catalog reads described above; no real account/student mutation, push, deployment, queue/status/card/ledger edit or additional worker was performed.

- Original declared base: `63502a351413f4b3ba2a9196ecb3b7ddca7dab7d`.
- Prior diagnosis/proposal candidate: `70973d46feadb1d5de00bf308368a957f106d57a`. Its original evidence and proposal remain immutable in Git history; the codec test now verifies the corrected representation.
- Reconciled observed `origin/main`: `c929cfbcae012c2074e75e63e51f1c70c076916e`, merged locally as `77552061419fdd054dfa527b46d03d5138a37b3d`. This includes delivered N119 and N116. Upstream changes were retained rather than reimplemented. The merge imports the existing approved source-card correction; this worker authored no source-card change.
- Final task diff is relative to that reconciled origin, not the stale original base. `tests/n122-1019-qualification.json` binds the exact affected source and migration hashes. No new startup module/dependency, date/time input or competing picker was added.

## Implemented behavior

The existing slot domain now has `kind: teaching/activity/waiting`. Old rows and old backup baselines default to teaching. An independent row has null teaching and an explicit term reference; academic rows retain their existing teaching IDs and null explicit term. Both kinds can be added with no teachings, subject, section, students or enrollment. They remain recurring entries until edited or soft-deleted.

The real schedule dialog, layout, CSS and timing profiles are reused. Independent entries participate in timetable occupancy and class-reopen conflict checks. They display their actual kind, including in the existing schedule export preview/PNG/print model. The backup exporter already preserves complete record fields; its existing restore codec now includes the fields, and legacy comparisons normalize the additive defaults.

`slotsOf(teachingId)` excludes independent entries, so the delivered N116 Home/on-demand projections cannot create academic sessions, attendance, rosters or grades for them. Historical sessions and existing academic slot IDs remain unchanged. The calendar-region switch hold remains active.

Both Sync mappings retain kind and term on canonical readback. The new term reference participates in normal parent dependencies. Wrong/missing ACKs remain failed/pending; no local action claims a server ACK. The migration extends the existing field map/revision protocol rather than introducing an alternative engine. It preserves existing RLS, owner-bound teaching FK, mutation guards, receipts and tombstones. The same-owner term FK, kind/parent check and live-term trigger constrain independent rows. Collision handling includes independent occupancy, and the existing class lifecycle RPC returns `rejected_slot_conflict` without replacing the retained independent slot.

## Exact append-only migration

Path: `supabase/migrations/20261019091500_n122_non_teaching_slots.sql`
Qualified UTF8/LF SHA256: `ddc1a199003e8b8ba1162d84b6261ce624bd4704953c74d781b8ad3b6c6e9d9f`

One new source only; no prior migration was edited. No historical UPDATE/backfill/ID rewrite, new Product role/LOGIN, public grant, managed Auth setting or N44/N88 private schema/key/logging change is in this migration. Added columns use academic defaults without reconstructing old records. Existing slot RLS policies remain intact. New internal functions revoke direct public/anon/authenticated execution; existing authorized RPC permissions are retained.

## Affected checks

- **PASS** `n122_permanent_activity_waiting_slot_save_reload_edit_delete_no_fake_subject`: `tests/n122-1019-browser.json`. Fresh isolated Chromium, owned loopback HTTP, actual app DOM/handlers/source CSS. Both kinds saved with no teachings, actual page reload retained IDs/fields in a same-document owner/database checkpoint, both edited and deleted with tombstones. Academic coexistence and occupied-time rejection, actual export preview labels, backup fields, read-only projections, unchanged history/grades/attendance, unresolved-owner/foreign-Auth/limited-lease negatives and truthful pending outbox were checked. No page errors. Screenshot: `tests/fixtures/n122-1019/schedule.png`.
- **PASS** `n122_local_native_postgres_owner_term_legacy_sync_and_tombstone_qualification`: `tests/n122-1019-native.json`. Native PostgreSQL **17.6**, exact migration hash, six affected gates: legacy row identity/history and revision unchanged; existing RLS; invalid kind/parent/missing or foreign term rejected; actual mutation RPC roundtrip, idempotent receipt, stale revision and changed-envelope rejection; academic control; class-reopen conflict; tombstone/stale patch and actual N71 stage/finalize restore field preservation; foreign owner cannot read or alter the row. Standard disposable fixture bootstrap roles only, all NOLOGIN except the fresh runtime's bootstrap administrator; no shared or hosted role was created/changed. No N44/N88 staged/private source was loaded.
- **PASS** five targeted codec/client/restore/reopen tests: `node --test tests/n122-1019-model-blocker.mjs tests/n122-1019-sync.mjs`. Includes blocked dependency before term acknowledgement, rejection of an incorrect receipt mutationId without removing the command, successful retry of that same command, canonical kind/term/tombstone preservation, legacy baseline compatibility and term-specific class-reopen guard.
- **NOT_RUN** `n122_exact_hosted_schema_service_readback_before_product_release`: authorized in this continuation but stopped before application due to the existing lifecycle entry-guard incompatibility. Local qualification is not hosted capability, Production, or PO acceptance.

Native bootstrap reused the public migration chain and the three missing N58 prerequisite sources from immutable commit `4fa6fb8b98415a42dd0a835bfdd7038ab65b8979`, as established by `tests/n90-current-source-native.mjs`. It did not rewrite applied SQL. This is schema preparation, not a replay of the unrelated feature suites. The temporary fixture's PID/birth/data-directory identity was verified; its server stopped, exact port rebound/released, and owned data directory removed. The integration lease was released. The pre-start lease-refusal marker directory was separately verified empty except its ownership marker and removed. Browser/context/server resources were closed in finally. No shared browser lease was needed for the permitted isolated synthetic phase.

## Failures and corrections retained

`tests/n122-1019-local-failures.json` retains the original local failures. The real UI initially showed the teaching field because existing `.field` CSS overrode native `hidden`; the fix explicitly hides it and the subsequent actual UI flow passed. Harness corrections include the copied directory-prefix assertion, omitted approved process-level `RemoteSigned` setting (no system-policy change), missing historical N58 bootstrap dependencies, testing direct DML instead of the mandatory RPC, exact replay timestamp, lifecycle RPC parameter order, existing delete outcome `deleted`, and lease context rebinding after the foreign-Auth negative. The fixture's fourth timing string was corrected to valid `10:00` before the final screenshot/flow. Client harness corrections preserve actual ACK and tombstone contracts rather than weakening them. No legitimate Product failure was suppressed.

## Saved hosted plan — apply only after the guard blocker is corrected

The earlier local phase left application/readback as an external prerequisite. The current card supplied that exact authority, and the read-only preimage stage exposed the implementation blocker above. The generic publisher cannot fix or apply this prerequisite. The saved six-step plan below remains conditional on correcting and rebinding the guarded source; no current installation/readback PASS is claimed.

The saved provider plan is retained for the later corrected, source-bound continuation:

1. Resolve current immutable origin/provider-bound source and confirm this task diff and SQL hash. Read migration history for version `20261019091500`; if already present, verify identity rather than applying again. Stop on partial/unknown installation or mismatching source.
2. Record the existing slots columns/defaults/constraints/indexes/triggers, `relrowsecurity`/`relforcerowsecurity`, existing policies and function ACLs. Expected preimage: no `kind`/`term_id`; `teaching_id` NOT NULL; existing owner-bound teaching FK and existing owner RLS. Do not read teacher/student rows.
3. Record `pg_get_functiondef`, normalized body hashes, owners and ACLs of these exact public-schema signatures, including their existing delegate chain: `sync_v2_field_map(text)`, `sync_v2_natural_key(text,jsonb)`, `guard_active_slot_collision()`, `apply_sync_v2_section_lifecycle_command(text,text,text,text,date,bigint)`. Verify no existing `_before_n122` helpers or `n122_guard_slot_term()` conflict. Preserve the current N58 mutation wrapper, N77 guards and N71 restore identity. Stop on unexpected drift; do not replace unrelated functions or bypass a rejection.
4. Only under the later exact service authorization, apply the single named source transaction with the qualified hash. No second migration, role/grant/RLS/Auth change or real-record fixture is included. The source is not idempotent by design: migration history/preimage guards must prevent double apply.
5. Read back the exact installed migration identity and new columns/check/FK/index/trigger, the wrapped field map/natural key, collision/lifecycle definitions and internal-function ACLs. Verify RLS/policies and old academic FK/guards remain unchanged. Bind normalized definitions to this file. Any separately requested hosted behavioral fixture must have its own explicit synthetic authority; local qualification does not authorize provisioning one.
6. Mark the final hosted prerequisite only after actual matching readback. Then the same session/controller can resume final readiness; the sole publisher owns subsequent integration/build/served Production verification. This candidate is **not** LOCAL_READY for Product publication yet.
