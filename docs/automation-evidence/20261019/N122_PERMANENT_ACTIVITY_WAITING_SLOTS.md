# N122 — permanent activity / waiting timetable slots

Task: `continuous-n122-permanent-activity-waiting-slots-20261019`
Current run: `e1ddb345-79ab-41f5-9d11-f9d786dd517b`
State: **LOCAL_READY — corrected source qualified and exact hosted prerequisite verified**

Frontend integration, build and served Production verification remain with the sole publisher. This worker did not push, deploy, edit queue/status/source cards/ledgers or claim PO acceptance.

## Completed bounded result

The existing timetable supports explicit `teaching`, `activity` and `waiting` slots. Independent slots have a null teaching and an owner-bound term, with no fake subject, class, pupils or enrollments. They recur until edited or soft-deleted, occupy weekday/period in that term and block an overlapping class restoration. Existing layout/dialog/timing profiles are reused. Labels survive export, backup, Sync canonical readback and restore.

Old academic rows/backup baselines default to teaching without an ID/history rewrite. Independent slots are excluded from academic `slotsOf` and N116 on-demand/Home projections, so they create no attendance, rosters or grades. The existing calendar-region hold remains unchanged. No new startup module/dependency or date/time input/picker was introduced.

## Source and history

- Declared/reconciled base: `c929cfbcae012c2074e75e63e51f1c70c076916e`; original base `63502a351413f4b3ba2a9196ecb3b7ddca7dab7d` is retained in history.
- Original model diagnosis: `70973d46feadb1d5de00bf308368a957f106d57a`.
- Local implementation candidate: `b1214a5770b63077acc6442ea00b4bb1cd508f64` (after local reconciliation including delivered N119/N116).
- Zero-write hosted guard discovery: `86fa24617980a1e583e898f59659cec3f3c0ee97`; original FAIL remains in `tests/n122-1019-hosted-preimage.json`.
- Current observed `origin/main`: `192da4716cd4afbe4dac2a870d9adfb054307b93`. No affected Product/model/Sync/migration source moved from the saved base; no further merge or feature retest was needed.
- All seven qualified Product JS files remain byte-equivalent under UTF8/LF hashing. `tests/n122-1019-qualification.json` records their exact hashes and corrected service source.

## Exactly one authorized correction and one hosted migration

File: `supabase/migrations/20261019091500_n122_non_teaching_slots.sql`

Old **unapplied** UTF8/LF SHA256: `ddc1a199003e8b8ba1162d84b6261ce624bd4704953c74d781b8ad3b6c6e9d9f`.
Corrected and installed UTF8/LF SHA256: `f023d560fbbc1124afd322c4dfa61ea61f6d6422f1fd3d136db117f38e119306`.

Only the authorized function-definition signature changed: the existing inner `apply_sync_v2_section_lifecycle_command_before_student_0029` receives the occupancy-query extension. The public wrapper is untouched and still authenticates and calls `lock_student_lifecycle(auth.uid())` BEFORE that delegate. All other migration bytes are preserved. There is no second migration or applied-source rewrite.

The native guard qualification used the existing owned PostgreSQL 17.6 lifecycle harness and unchanged public bootstrap sources (including the three historical N58 prerequisites from immutable `4fa6fb8b98415a42dd0a835bfdd7038ab65b8979`). Only the newly affected guard/academic/conflict controls ran; the prior six feature gates and UI journey were not replayed.

Native proof in `tests/n122-1019-entry-guard.json`:

- Actual public wrapper definition, owner, ACL, security mode and search path are identical before/after the corrected source; lock call precedes delegation.
- Actual public academic archive/reopen succeeds. A second connection cannot acquire the owner mutex after the RPC returns inside an open transaction, and can acquire it after commit.
- Actual public reopen rejects both activity and waiting occupancy, preserves the independent row and archived section, and retains the mutex through commit. Reopening succeeds after the explicit local fixture tombstones.
- Inner delegate retains its existing protected owner/ACL and contains the intended independent-term conflict query.

## Hosted operation and exact readback

Project: `xlrubcwjqktzzunrvuns`.
Sanctioned channel: Supabase management `execute_sql` / `apply_migration`.
Provider migration: **`20261019095922` / `n122_non_teaching_slots`**.
Evidence: `tests/n122-1019-hosted-final.json`.

Fresh data-free preimage matched the saved columns, policies/RLS, constraints, indexes, triggers, function owners/ACLs and wrapper/delegate bodies; no prior/partial N122 installation existed. After the new native guard PASS, `apply_migration` was called exactly once with the corrected source. It returned `success:true`. The actual provider history contains one statement exactly equal to the full authorized UTF8/LF source, and the independent catalog readback matched:

- New kind/term columns, validated kind-parent check, same-owner term FK, partial term index and live-term trigger.
- Exact source body hashes for field map, natural key, collision function, term guard and modified inner delegate.
- Unchanged full PUBLIC lifecycle wrapper definition/owner/ACL and all unrelated recorded guard/delegate bodies.
- Existing slot RLS/force-RLS, policies, academic FK, table ACL, existing triggers/indexes and NOLOGIN role flags unchanged.
- Renamed field-map/natural-key delegates preserve their original bodies, owners, ACLs and configuration. New internal functions remain owner-only; no public/anon/authenticated execute grant was added.

No teacher/student rows were read. No real canonical row UPDATE/backfill, hosted fixture, Auth user, role/grant/RLS-policy/Auth-setting/private N44-N88 change, credentials or messages were involved. This service readback is the prerequisite for frontend publication, not served Product/Production evidence.

## Final affected checks

| Check | Result | Evidence |
| --- | --- | --- |
| `n122_permanent_activity_waiting_slot_save_reload_edit_delete_no_fake_subject` | PASS, reused | `tests/n122-1019-browser.json`: actual app HTTP DOM/handlers/CSS; both kinds with no teachings; reload, edit/delete, export/backup, academic conflict, owner/Auth/lease negatives, unchanged history and truthful pending commands |
| `n122_local_native_postgres_owner_term_legacy_sync_and_tombstone_qualification` | PASS, reused six gates | `tests/n122-1019-native.json`; same feature bodies, corrected signature difference separately qualified below |
| `n122_preserved_lifecycle_entry_guard_before_exact_hosted_apply` | PASS | `tests/n122-1019-entry-guard.json`: actual public RPC and second-connection transaction mutex controls |
| `n122_exact_hosted_schema_service_readback_before_product_release` | PASS | `tests/n122-1019-hosted-final.json`: actual provider outcome, exact history source and schema/guard/ACL/RLS readback |
| Codec/client ACK/restore/reopen checks | PASS, reused | Five scoped tests previously recorded in `tests/n122-1019-qualification.json`; unchanged Product sources |

Prior real failures remain in `tests/n122-1019-local-failures.json` and `tests/n122-1019-hosted-preimage.json`. In particular, the old six native gates did NOT establish entry-mutex preservation; the old immutable source was stopped before application. This run resolves that actual defect with the single explicitly bound correction and new native guard proof. Old FAIL records were not rewritten to PASS.

## Owned phase cleanup and delivery

The new native fixture's PID/birth/directory identity was verified, its server stopped, exact port rebound/released and owned directory removed. Its integration lease was released. The hosted write held the canonical `live-mutation` lease, released after provider outcome/readback. No browser phase was run; unchanged prior actual UI evidence was reused. No unknown process, lock, STOP, controller state or user's browser was touched.

All four required gates now pass. The sole publisher can perform authorized frontend integration/build and served verification from the candidate. No worker deployment or Product CLOSED/PO-acceptance claim is made.
