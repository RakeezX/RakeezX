# RAKEEZ X — 0072 — Student Lifecycle 0029 manual handoff

Historical 0072 local review (the following paragraphs describe that ticket).
For subsequent 0074 verification evidence, see the section below.

LOCAL PASS ONLY. No remote migration, source promotion, commit/push, deploy,
Computer Use/dashboard access or Work-Active changes.
Production HEAD/origin/main remain 4bb69df9d74c91a4e50c82be5dc4b5936b293fc0.
Production Supabase project reference: xlrubcwjqktzzunrvuns; schema: rakeezx.
Live DB metadata/timezone was NOT inspected in this local-only ticket.

## Frozen migration

### 0074 pre-promotion verification

- CLI 2.117.0 authenticated and linked to xlrubcwjqktzzunrvuns.
- Read-only live catalog comparison against an isolated frozen installation:
  32 function definitions/attributes/privileges, 27 statement gates, 11 row
  guards, receipt columns/constraints/RLS/ACLs matched exactly. No Product rows read.
- Frozen bytes still match SHA256 below. Live database timezone UTC; all four
  fixed-time Asia/Riyadh conversions return 2026-09-13.
- Only after that PASS: official migration repair recorded 0029 as applied.
  All 27 local/remote migration versions align; linked dry run reports upToDate,
  zero migrations/seeds/roles pending. No migration reapplication performed.
- Focused synthetic client/server/backup/attendance/history gates: 121/121 PASS.
  Separate isolated PostgreSQL concurrency gate: 7/7 PASS, no deadlocks;
  40-student bulk plus 24 concurrent Sync commands completed in 191 ms.
- V4 validation unchanged; Notes fixture uses canonical server revision.
  Device checkpoints/reload, same-identity retry, convergence and resurrection
  rejection pass. Local-only submissions remain bounded to the initiating device.
- Build completed once; local generated metadata excluded from promotion.
- No new Student Delete UI. Reinstatement remains DEFERRED / NEEDS REDESIGN.
- Work-Active and Product Owner private records remain untouched.

Filename: supabase/migrations/0029_student_lifecycle_safety.sql
SHA256: 97abeb52cbeb4da99ef97a688c190010e419465e5152ee0e16b21bea9ef458ec

Old SHA a6c5832d7ad55a0f2e1c94b391a0a607e99c7055547a3ce3e5cd143eed2cbd0b
is SUPERSEDED / INVALID. Do NOT apply the old candidate.
Verify actual file bytes before application. Copying/newline conversion can alter
the hash. Any SQL change requires re-review/refreeze. Not blindly re-runnable.

## Narrow V1

Only delete_pristine and end_enrollment are accepted by the new domain RPC.
Reinstate and every other command are rejected before mutation.

end_enrollment requires exact active source ID, student owner/identity and current
source server revision. Stale Class A requests cannot end a newer Class B enrollment.
It retains the source row, original start_date, historical roll_no and linked
attendance/scores/logs/notes/snapshots/reports. It sets status withdrawn and end_date;
student status changes to withdrawn only if no active live membership remains.
Only remaining active peers are renumbered; membership dates/identities are retained.
Same request identity replays its immutable saved receipt.

Central server effective date: student_lifecycle_date(clock_timestamp()), equivalent
to (clock_timestamp() AT TIME ZONE 'Asia/Riyadh')::date, evaluated after the owner
lock. Browser dates are not supplied; client_updated_at is metadata only.
Receipt replay never recomputes the original committed date. Database session
timezone cannot affect it. 00:01, 02:59, 03:01 and daytime tests pass under UTC,
Riyadh, Los Angeles and Kiritimati.

delete_pristine checks all server-visible protective evidence: attendance, scores
(including zero), logs, notes (including retained tombstoned records), inline notes,
snapshots, closed-term payload/manifests, group membership, historical/multiple/
archived membership, and retained mutation/reward/lifecycle receipts.
NOT_PRISTINE includes a specific reason. Allowed deletion logically tombstones only
the mistaken student and initial unused membership; it never cascades meaningful
history. Generic/legacy student deletion cannot bypass the command. Direct student
tombstone resurrection and later active child writes are rejected.

Exact bounded meaning:
"The server found no RAKEEZ cloud/history evidence that protects this student,
and this device has no known local-only protected evidence."

The client additionally blocks current-device submission evidence, including deleted
retained evidence. Another device's local-only submissions/unsent outbox are not
queryable and are NOT erased. Do not claim globally proven NEVER used, physical
total erasure, all-device evidence removal or undo. Product store submission creation
rejects a known tombstoned/missing parent; server child writes remain guarded.
No submissions backend, distributed rollback or automatic cleanup is added.

## Reinstatement — DEFERRED / NEEDS REDESIGN

Existing Production exposes "أعده للدراسة" in src/views/student.js.
store.reinstateStudent first patches student.status active, then transferStudent
requires an active source enrollment. A withdrawn student without one can become
active without a valid enrollment. Current Production can show a success toast even
when transfer returns null. Pending source checks that result, but does NOT undo
partial activation or preserve erased intervals. Legacy transfer back to an existing
destination may overwrite its previous enrollment dates. Private receipts are not
a user-visible append-only membership interval model.

0029 does NOT solve reinstatement or claim STU-REC-01B interval preservation.
Recommend a SEPARATE small safety ticket to hide/disable the action and prevent its
legacy invocation until atomic reinstatement and an interval model are reviewed.
No new reinstatement workflow is included here.

## Exact schema / policy / function changes

- One private student_lifecycle_receipts table, six NOT NULL columns: owner_id uuid,
  mutation_id/student_id text, request_envelope/result jsonb, created_at timestamptz
  default clock_timestamp(). PK(owner_id,mutation_id); mutation length check 1..200;
  owner FK to auth.users ON DELETE CASCADE. RLS enabled/forced, ZERO policies,
  no PUBLIC/anon/authenticated table ACLs.
- Seven new empty-search-path functions: lock_student_lifecycle,
  student_lifecycle_date, lock_student_lifecycle_statement, json_references_student,
  guard_live_student_parent, pristine_student_blocker, apply_student_lifecycle_command.
  Only the last is executable by authenticated; none by anon. Date conversion and
  JSON predicate are non-definer; the other five are SECURITY DEFINER.
- 27 BEFORE STATEMENT INSERT/UPDATE/DELETE owner-lock triggers on the Product tables
  enumerated in frozen SQL, including parent tables with cascading Product triggers.
  Auth, Support/notification and restore staging are excluded.
- 11 BEFORE ROW INSERT/UPDATE safety triggers on students/enrollments/scores/
  attendance/logs/notes/session_roster_snapshots/closed_term_reports/
  group_arrangements/class_goals/sync_mutation_receipts.
- 11 V2/finalization RPC wrappers preserve signatures/defaults, return/receipt
  contracts and authenticated authority; preserved implementations renamed
  _before_student_0029 are revoked from frontend roles.
- Three legacy enrollment RPC bodies are changed IN PLACE only to prepend the
  owner lock. SECURITY INVOKER, RLS, signatures/defaults and ACLs are retained.
  No accessible bypass implementation or arbitrary-owner helper grant.
- V2 withdrawal rejects stale exact source except receipt replay.
  Active student children require a live parent. New attendance/log INSERTs
  on/after an ended end_date are blocked when no active membership remains there.
  Existing historical reads/rows are not rewritten.
- No existing Product columns/constraints/policies, Auth settings, or
  Support/notification schema changes.

## One supported lock order

OWNER advisory lock -> existing mutation/student/session/section advisory locks
-> row locks -> nested Product writes/triggers.
BEFORE STATEMENT precedes direct UPDATE tuple locks. The row guard no longer
takes a late owner lock. Legacy invoker RPCs take owner before section/student.
Parent statement gates cover cascading triggers; reentrant locks are safe.

Normal authenticated Product operations for one owner serialize briefly; account
keys differ. This does not promise deadlock freedom for arbitrary admin SQL,
externally held SELECT FOR UPDATE, DDL or multi-owner maintenance. Those are outside
Product API traffic and require separately reviewed ordering.

Real isolated PostgreSQL 18.4, separate connections: 7/7 PASS. Forced wait tests
verify direct UPDATE holds no conflicting tuple lock, legacy roster RPC does not
hold its section lock first, both attendance/delete orderings preserve history or
reject stale writes atomically, child Sync and lifecycle serialize, bulk/end retain
history, and session deletion waits before its session row lock. Final local
40-student bulk + 24 concurrent Sync mutations: 246 ms, no duplicates/deadlocks.
This is local practicality evidence, not a Production latency/capacity guarantee.

Reproduce with a test-only dependency (no Product package/lockfile change):
```powershell
Set-Location -LiteralPath 'D:\Abdullah Projects\RakeezX'
npm install --prefix '.\test-results\postgres-concurrency' --no-save --package-lock=false --ignore-scripts embedded-postgres@18.4.0-beta.17
node --test tests/student-lifecycle-concurrency.integration.mjs
```
Only 127.0.0.1 and synthetic credentials/records; unique ignored test directory.
The test stops only its own cluster, persistent=true; no recursive deletion.

## Installation / reversibility

DDL-only BEGIN/COMMIT; transaction-local lock_timeout 10 seconds.
No existing Product row UPDATE/DELETE/backfill, student/user deletion, Auth or
Support changes during install. Catalog preconditions check the expected 11 JSONB
RPCs and three invoker RPCs. Unexpected/missing/overloaded authority aborts.
A tested LATE precondition failure rolls back every provisional new object.
Successful install keeps existing synthetic Product rows byte-for-byte.
DDL needs relation locks; timeout means failed install, never partial PASS.

Later authorized commands can logically tombstone pristine records or end
membership; installation itself does neither. Receipt owner FK cascades only if
an Auth user is separately explicitly deleted.

Schema DDL is reversible only through a separately reviewed rollback restoring
saved V2 definitions/ACLs and the three original legacy bodies, then removing
guards/helpers appropriately. No rollback SQL prepared/executed. After use, retain
minimum receipts/tombstones; removing DDL does not undo lifecycle effects and
removes safety protections. No automatic data rollback or physical-erasure promise.

## Focused evidence / baseline issues

121/121 focused tests PASS, including 19 lifecycle server and six lifecycle client
tests, Notes/V4, backup/restore, transfer/history, current V2 client/server attendance
override/retry/convergence, session deletion and completeness/Quick Log.
Real multi-connection gate: 7/7 PASS. Build passed exactly once; diff check passed.

Notes failure reproduced on unchanged Production: fixture claimed serverRevision=1
without serverCanonical. ONLY fixture corrected using decoded canonical server
rows/baselines. Backup validator/hash/version validation unchanged.

Exploratory tests/sync-attendance.test.mjs failed identically on unchanged Production:
its obsolete mock offers upsertRecords but lacks current V2 APIs. File NOT changed
or skipped and NOT claimed PASS. Current V2 attendance client/server tests passed.
Retained failed-runner timers were cleaned by exact process identity only.
Existing backup.test.mjs emits a closed BroadcastChannel teardown warning while its
assertions pass. Neither pre-existing issue is represented as fixed here.

Generated Build Meta was built normally once, then tracked generated source restored
to pre-build identity. Do not promote local build metadata; regenerate via the normal
Production pipeline later.

## Files changed (pending 0070 + this refreeze)

- src/lib/cloud.js
- src/lib/db.js
- src/lib/sync.js
- src/lib/student-lifecycle.js
- src/store.js
- src/views/student.js
- tests/notes.test.mjs
- tests/student-transfer-roll-safety.test.mjs
- tests/student-lifecycle-client.test.mjs
- tests/student-lifecycle-server.test.mjs
- tests/student-lifecycle-concurrency.integration.mjs
- tests/helpers/student-lifecycle-server.mjs
- supabase/migrations/0029_student_lifecycle_safety.sql
- supabase/verify-0029-student-lifecycle.sql
- docs/STUDENT_LIFECYCLE_0029_MANUAL_HANDOFF.md

## Manual order / supported migration history alignment — NOT executed

1. Obtain approval for THIS SQL/hash. Confirm project reference and byte SHA256.
   Do NOT apply old hash. Apply the frozen SQL ONCE manually in correct Production.
2. On error, stop and ensure rollback (ROLLBACK if the SQL session remains aborted).
3. Run the metadata/pure-date verification below as an authorized operator; compare
   table/RLS/ACL/function/trigger definitions. No private records/destructive RPCs.
4. ONLY after successful SQL and schema verification: authorized Supabase CLI
   operator aligns 0029 history. Use this directory with the reviewed migrations.
   CLI/project/DB connection authority is required. No config.toml currently exists;
   initialize local CLI config only if absent. Do not overwrite existing config.
   Init/link are local setup, not migration application.

```powershell
Set-Location -LiteralPath 'D:\Abdullah Projects\RakeezX'
Get-FileHash -LiteralPath '.\supabase\migrations\0029_student_lifecycle_safety.sql' -Algorithm SHA256
if (!(Test-Path -LiteralPath '.\supabase\config.toml')) { supabase init }
supabase login
supabase link --project-ref xlrubcwjqktzzunrvuns
supabase migration list --linked
supabase migration repair 0029 --status applied --linked
supabase migration list --linked
supabase db push --dry-run --linked
```

Interactive prompts only; never put passwords/tokens in commands/Git/handoff.
Confirm linked project before repair. Before repair, Local 0029 may show an empty
Remote despite successful manual SQL. If Remote already contains 0029, verify it
instead of blindly repairing/reapplying. Expected repair:
Repaired migration history: [0029] => applied.
Afterward Local AND Remote contain 0029. Dry run must NOT propose 0029.
No real db push here. Any older history drift: STOP and review separately; never
repair all history or mark unverified migrations applied. No manual writes to
Supabase internal migration-history tables.

Official [Supabase migration procedure](https://supabase.com/docs/guides/deployment/database-migrations)
and [CLI reference](https://supabase.com/docs/reference/cli/installing-and-updating):
repair changes tracking only, not SQL/schema.
The [official repair implementation](https://github.com/supabase/cli/blob/develop/apps/cli-go/internal/migration/repair/repair.go)
accepts numeric 0029, preserving leading zeros and resolving 0029_*.sql.

5. Product Owner confirms application and metadata/history results. Codex then
   verifies live authority against the freeze via an authorized metadata-only path,
   reruns focused server/runtime and synthetic convergence checks, and continues
   source promotion ONLY under separately approved deployment authority.
   No source promotion before confirmation.

## Full frozen SQL

```sql
-- STUDENT-LIFECYCLE-RUNTIME-HARDENING-01. Additive authority; no data rewrite.
begin;
set local lock_timeout = '10s';

-- Abort atomically on missing/overloaded RPC authority instead of silently
-- installing only part of the serialization boundary on a drifted project.
do $$ declare v_count integer; begin
  select count(*) into v_count from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='rakeezx' and p.prorettype='jsonb'::regtype and p.proname in (
    'apply_sync_v2_mutation','apply_sync_v2_enrollment_command','apply_sync_v2_attendance_command',
    'apply_sync_v2_fill_attendance_command','apply_sync_v2_class_goal_reward_command',
    'apply_sync_v2_closed_term_report_command','apply_sync_v2_lifecycle_command',
    'apply_sync_v2_section_lifecycle_command','apply_sync_v2_session_delete_command',
    'apply_sync_v2_teaching_creation_command','finalize_sync_v2_restore');
  if v_count<>11 then raise exception using errcode='22023',message='MIGRATION_0029_RPC_PRECONDITION_FAILED'; end if;
end $$;

create table rakeezx.student_lifecycle_receipts (
  owner_id uuid not null references auth.users(id) on delete cascade,
  mutation_id text not null check (char_length(mutation_id) between 1 and 200),
  student_id text not null,
  request_envelope jsonb not null,
  result jsonb not null,
  created_at timestamptz not null default clock_timestamp(),
  primary key(owner_id, mutation_id)
);
alter table rakeezx.student_lifecycle_receipts enable row level security;
alter table rakeezx.student_lifecycle_receipts force row level security;
revoke all on rakeezx.student_lifecycle_receipts from public, anon, authenticated;

-- One owner-scoped serialization boundary covers RPCs AND direct row writes.
-- No scan of private records is needed to install this migration.
create function rakeezx.lock_student_lifecycle(p_owner uuid) returns void
language sql volatile security definer set search_path='' as $$
  select pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_owner::text||':student-lifecycle-safety',0));
$$;
revoke all on function rakeezx.lock_student_lifecycle(uuid) from public,anon,authenticated;

-- Pure calendar conversion is testable independently of the session timezone.
-- Only the server supplies clock_timestamp() to lifecycle commands.
create function rakeezx.student_lifecycle_date(p_at timestamptz) returns date
language sql immutable strict set search_path='' as $$
  select (p_at at time zone 'Asia/Riyadh')::date;
$$;
revoke all on function rakeezx.student_lifecycle_date(timestamptz) from public,anon,authenticated;

-- BEFORE STATEMENT runs before UPDATE acquires any tuple lock. A row trigger
-- alone would invert RPC owner->row ordering on direct PostgREST updates.
create function rakeezx.lock_student_lifecycle_statement() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is not null then perform rakeezx.lock_student_lifecycle(auth.uid()); end if;
  return null;
end; $$;
revoke all on function rakeezx.lock_student_lifecycle_statement() from public,anon,authenticated;

-- Include parent tables whose existing triggers write protected children.
-- Excludes Auth, Support and restore staging (which writes no Product rows).
do $$ declare v_table text; begin
  foreach v_table in array array['profile','years','terms','subjects','sections','teachings',
    'students','enrollments','units','lessons','items','scores','time_profiles','slots',
    'sessions','attendance','logs','calendars','calendar_days','notes','class_rules',
    'class_goals','class_charter_selections','group_arrangements','closed_term_reports',
    'session_roster_snapshots','sync_mutation_receipts'] loop
    execute format('create trigger "00_student_lifecycle_statement_lock" before insert or update or delete on rakeezx.%I for each statement execute function rakeezx.lock_student_lifecycle_statement()',v_table);
  end loop;
end $$;

-- Three pre-V2 invoker RPCs also acquire student/section locks. Prepend the
-- owner lock in place, preserving SECURITY INVOKER, RLS, ACLs and signatures.
-- Do not grant callers access to a bypass implementation or arbitrary-owner
-- locking helper. Installation aborts on any unexpected definition.
do $$ declare v_function record; v_body text; v_count integer:=0; begin
  for v_function in select p.oid,p.prosrc,p.prosecdef,pg_get_functiondef(p.oid) definition
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='rakeezx' and p.prorettype='jsonb'::regtype and p.proname in
      ('commit_enrollment_transfer','commit_enrollment_transfer_and_renumber','renumber_enrollment_roster') loop
    if v_function.prosecdef or v_function.prosrc !~ E'\\mbegin\\M' then
      raise exception using errcode='22023',message='MIGRATION_0029_LEGACY_RPC_PRECONDITION_FAILED'; end if;
    v_body:=regexp_replace(v_function.prosrc,E'\\mbegin\\M',
      'begin perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text||'':student-lifecycle-safety'',0));');
    execute replace(v_function.definition,v_function.prosrc,v_body);
    v_count:=v_count+1;
  end loop;
  if v_count<>3 then raise exception using errcode='22023',message='MIGRATION_0029_LEGACY_RPC_PRECONDITION_FAILED'; end if;
end $$;

create function rakeezx.json_references_student(p_json jsonb,p_student text) returns boolean
language sql immutable set search_path='' as $$
  select coalesce(pg_catalog.jsonb_path_exists(p_json,'$.** ? (@ == $student)',
    pg_catalog.jsonb_build_object('student',p_student)),false);
$$;
revoke all on function rakeezx.json_references_student(jsonb,text) from public,anon,authenticated;

create function rakeezx.guard_live_student_parent() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_student text; v_students text[] := '{}'; v_section text;
begin
  -- Match force_owner BEFORE taking a lock or checking parent identity. A
  -- caller-supplied owner must not select another account's safety boundary.
  if tg_op='INSERT' and auth.uid() is not null then new.owner_id:=auth.uid(); end if;
  -- Statement gate / RPC entry already holds the owner lock before row locks.
  if tg_table_name='students' and tg_op='UPDATE' then
    if old.deleted_at is not null and new.deleted_at is null then
      raise exception using errcode='23503',message='STUDENT_TOMBSTONED';
    end if;
    if old.deleted_at is null and new.deleted_at is not null and
      coalesce(current_setting('rakeezx.pristine_student_delete',true),'')<>'on' then
      raise exception using errcode='22023',message='USE_PRISTINE_STUDENT_COMMAND';
    end if;
  end if;
  if tg_table_name in ('enrollments','scores','attendance','logs','notes') then
    if new.deleted_at is not null then return new; end if;
    v_students := array[new.student_id];
  elsif tg_table_name='session_roster_snapshots' then
    -- Snapshot reads and immutable historical members are untouched.
    if tg_op<>'INSERT' or new.deleted_at is not null then return new; end if;
    select coalesce(array_agg(m->>'studentId'),'{}') into v_students
      from pg_catalog.jsonb_array_elements(new.members) m;
  end if;
  foreach v_student in array v_students loop
    if not exists(select 1 from rakeezx.students where owner_id=new.owner_id and id=v_student and deleted_at is null) then
      raise exception using errcode='23503',message='STUDENT_TOMBSTONED',detail='Active child evidence requires a live student';
    end if;
  end loop;
  if tg_table_name in ('logs','attendance') then
  if tg_op='INSERT' and new.deleted_at is null then
    select section_id into v_section from rakeezx.teachings where owner_id=new.owner_id and id=new.teaching_id;
    if exists(select 1 from rakeezx.enrollments where owner_id=new.owner_id and student_id=new.student_id
      and section_id=v_section and status<>'active' and end_date is not null and new.date>=end_date and deleted_at is null)
      and not exists(select 1 from rakeezx.enrollments where owner_id=new.owner_id and student_id=new.student_id
        and section_id=v_section and status='active' and deleted_at is null) then
      raise exception using errcode='23503',message='ENROLLMENT_ENDED';
    end if;
  end if;
  end if;
  return new;
end; $$;
revoke all on function rakeezx.guard_live_student_parent() from public,anon,authenticated;
do $$ declare v_table text; begin
  foreach v_table in array array['students','enrollments','scores','attendance','logs','notes',
    'session_roster_snapshots','closed_term_reports','group_arrangements','class_goals','sync_mutation_receipts'] loop
    execute format('create trigger "00_student_lifecycle_safety" before insert or update on rakeezx.%I for each row execute function rakeezx.guard_live_student_parent()',v_table);
  end loop;
end $$;

-- Acquire the same boundary before existing RPC row/section locks, retaining
-- their arguments/defaults, return values, ownership and idempotency contracts.
do $$ declare v_function record; v_old text; v_call text; begin
  for v_function in select p.oid,p.proname,pg_get_function_arguments(p.oid) args,
      pg_get_function_identity_arguments(p.oid) identity_args,p.proargnames
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='rakeezx' and p.proname in (
      'apply_sync_v2_mutation','apply_sync_v2_enrollment_command','apply_sync_v2_attendance_command',
      'apply_sync_v2_fill_attendance_command','apply_sync_v2_class_goal_reward_command',
      'apply_sync_v2_closed_term_report_command','apply_sync_v2_lifecycle_command',
      'apply_sync_v2_section_lifecycle_command','apply_sync_v2_session_delete_command',
      'apply_sync_v2_teaching_creation_command','finalize_sync_v2_restore') loop
    v_old := v_function.proname||'_before_student_0029';
    select string_agg(quote_ident(a),',') into v_call from unnest(v_function.proargnames) a;
    execute format('alter function rakeezx.%I(%s) rename to %I',v_function.proname,v_function.identity_args,v_old);
    execute format('revoke all on function rakeezx.%I(%s) from public,anon,authenticated',v_old,v_function.identity_args);
    execute format('create function rakeezx.%I(%s) returns jsonb language plpgsql security definer set search_path='''' as $wrapper$ begin
      if auth.uid() is null then raise exception using errcode=''42501'',message=''Authentication required''; end if;
      perform rakeezx.lock_student_lifecycle(auth.uid());
      return rakeezx.%I(%s); end; $wrapper$',v_function.proname,v_function.args,v_old,v_call);
    execute format('revoke all on function rakeezx.%I(%s) from public,anon',v_function.proname,v_function.identity_args);
    execute format('grant execute on function rakeezx.%I(%s) to authenticated',v_function.proname,v_function.identity_args);
  end loop;
end $$;

create function rakeezx.pristine_student_blocker(p_owner uuid,p_student text) returns text
language plpgsql security definer set search_path='' as $$
declare v_student rakeezx.students%rowtype;
begin
  select * into v_student from rakeezx.students where owner_id=p_owner and id=p_student;
  if v_student.status<>'active' then return 'membership-history'; end if;
  if btrim(coalesce(v_student.note,''))<>'' then return 'inline-note'; end if;
  if exists(select 1 from rakeezx.attendance where owner_id=p_owner and student_id=p_student) then return 'attendance'; end if;
  if exists(select 1 from rakeezx.scores where owner_id=p_owner and student_id=p_student) then return 'scores'; end if;
  if exists(select 1 from rakeezx.logs where owner_id=p_owner and student_id=p_student) then return 'logs'; end if;
  if exists(select 1 from rakeezx.notes where owner_id=p_owner and student_id=p_student) then return 'notes'; end if;
  if exists(select 1 from rakeezx.session_roster_snapshots where owner_id=p_owner and
    rakeezx.json_references_student(members,p_student)) then return 'roster-snapshot'; end if;
  if exists(select 1 from rakeezx.closed_term_reports where owner_id=p_owner and
    (rakeezx.json_references_student(source_manifest,p_student) or rakeezx.json_references_student(payload,p_student))) then return 'closed-term-report'; end if;
  if exists(select 1 from rakeezx.group_arrangements where owner_id=p_owner and
    rakeezx.json_references_student(groups,p_student)) then return 'group-arrangement'; end if;
  if (select count(*) from rakeezx.enrollments where owner_id=p_owner and student_id=p_student)>1 or
    exists(select 1 from rakeezx.enrollments e join rakeezx.sections s on s.owner_id=e.owner_id and s.id=e.section_id
      join rakeezx.years y on y.owner_id=s.owner_id and y.id=s.year_id
      where e.owner_id=p_owner and e.student_id=p_student and
        (e.deleted_at is not null or e.status<>'active' or e.end_date is not null or btrim(e.transfer_note)<>'' or
         s.deleted_at is not null or s.status='archived' or y.deleted_at is not null or y.status='archived')) then return 'membership-history'; end if;
  if exists(select 1 from rakeezx.sync_mutation_receipts where owner_id=p_owner and
    ((operation in ('transfer','withdraw') and request_patch->>'studentId'=p_student) or
     (entity='students' and record_id=p_student and
       (btrim(coalesce(request_patch->>'note',''))<>'' or request_patch->>'status'='withdrawn')) or
     (entity='enrollments' and record_id in (select id from rakeezx.enrollments where owner_id=p_owner and student_id=p_student)
       and (request_patch->>'status' in ('transferred','withdrawn','completed') or request_patch->>'end_date' is not null)) or
     (operation='goal_reward' and rakeezx.json_references_student(result,p_student)))) or
    exists(select 1 from rakeezx.student_lifecycle_receipts where owner_id=p_owner and student_id=p_student
      and request_envelope->>'command'='end_enrollment' and result->>'outcome'='applied') then return 'lifecycle-history'; end if;
  -- Submissions are currently local-only, not a server table. The client guard
  -- checks those unsynced records. Do not invent a submissions backend here.
  return null;
end; $$;
revoke all on function rakeezx.pristine_student_blocker(uuid,text) from public,anon,authenticated;

create function rakeezx.apply_student_lifecycle_command(
  p_mutation_id text,p_device_id text,p_command text,p_payload jsonb,p_client_updated_at bigint
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_owner uuid:=auth.uid(); v_student text:=p_payload->>'studentId';
  v_source text:=p_payload->>'sourceEnrollmentId';
  v_expected bigint:=nullif(p_payload->>'sourceRevision','')::bigint;
  v_s rakeezx.students%rowtype; v_e rakeezx.enrollments%rowtype; v_previous rakeezx.student_lifecycle_receipts%rowtype;
  v_envelope jsonb; v_result jsonb; v_rows jsonb; v_sections text[]:='{}';
  v_outcome text:='applied'; v_code text; v_reason text; v_plan jsonb;
  v_date date;
begin
  if v_owner is null then raise exception using errcode='42501',message='Authentication required'; end if;
  if coalesce(p_mutation_id,'')='' or char_length(p_mutation_id)>200 or coalesce(p_device_id,'')='' or char_length(p_device_id)>200 or
    coalesce(v_student,'')='' or p_command is null or p_command not in ('delete_pristine','end_enrollment') or
    jsonb_typeof(p_payload) is distinct from 'object' then
    raise exception using errcode='22023',message='Invalid student lifecycle command'; end if;
  if p_payload ? 'date' then raise exception using errcode='22023',message='IMMEDIATE_ONLY'; end if;
  v_envelope:=jsonb_build_object('mutationId',p_mutation_id,'deviceId',p_device_id,'command',p_command,
    'payload',p_payload,'clientUpdatedAt',p_client_updated_at);
  perform rakeezx.lock_student_lifecycle(v_owner);
  v_date:=rakeezx.student_lifecycle_date(clock_timestamp());
  select * into v_previous from rakeezx.student_lifecycle_receipts where owner_id=v_owner and mutation_id=p_mutation_id;
  if found then
    if v_previous.request_envelope is distinct from v_envelope then
      raise exception using errcode='22023',message='Mutation ID reused with different student lifecycle request'; end if;
    return v_previous.result;
  end if;
  -- Existing enrollment RPCs use this additional student lock as well.
  perform pg_advisory_xact_lock(hashtextextended(v_owner::text||':student:'||v_student,0));
  select * into v_s from rakeezx.students where owner_id=v_owner and id=v_student for update;
  if not found then v_outcome:='rejected'; v_code:='STUDENT_NOT_FOUND';
  elsif v_s.deleted_at is not null then
    v_outcome:=case when p_command='delete_pristine' then 'already_deleted' else 'rejected' end;
    v_code:='STUDENT_TOMBSTONED';
  elsif p_command='delete_pristine' then
    v_reason:=rakeezx.pristine_student_blocker(v_owner,v_student);
    if v_reason is not null then v_outcome:='protected'; v_code:='NOT_PRISTINE';
    else
      select coalesce(array_agg(section_id),'{}') into v_sections from rakeezx.enrollments where owner_id=v_owner and student_id=v_student;
      perform set_config('rakeezx.pristine_student_delete','on',true);
      update rakeezx.enrollments set deleted_at=clock_timestamp(),client_updated_at=p_client_updated_at,device_id=p_device_id
        where owner_id=v_owner and student_id=v_student and deleted_at is null;
      update rakeezx.students set deleted_at=clock_timestamp(),client_updated_at=p_client_updated_at,device_id=p_device_id
        where owner_id=v_owner and id=v_student returning * into v_s;
      perform set_config('rakeezx.pristine_student_delete','off',true);
    end if;
  elsif p_command='end_enrollment' then
    if coalesce(v_source,'')='' or v_expected is null then
      raise exception using errcode='22023',message='Exact source enrollment and revision required'; end if;
    select * into v_e from rakeezx.enrollments where owner_id=v_owner and id=v_source and student_id=v_student for update;
    if not found or v_e.deleted_at is not null or v_e.status<>'active' or v_e.revision<>v_expected then
      v_outcome:='rejected'; v_code:='STALE_SOURCE_ENROLLMENT';
    elsif exists(select 1 from rakeezx.sections where owner_id=v_owner and id=v_e.section_id and (deleted_at is not null or status='archived')) then
      v_outcome:='protected'; v_code:='ARCHIVED_ENROLLMENT';
    else
      v_sections:=array[v_e.section_id];
      update rakeezx.enrollments set status='withdrawn',end_date=v_date,transfer_note=coalesce(p_payload->>'note',''),
        client_updated_at=p_client_updated_at,device_id=p_device_id where owner_id=v_owner and id=v_source;
      if not exists(select 1 from rakeezx.enrollments where owner_id=v_owner and student_id=v_student and status='active' and deleted_at is null) then
        update rakeezx.students set status='withdrawn',client_updated_at=p_client_updated_at,device_id=p_device_id
          where owner_id=v_owner and id=v_student returning * into v_s;
      end if;
    end if;
  end if;
  if cardinality(v_sections)>0 then
    select coalesce(jsonb_agg(jsonb_build_object('id',id,'roll',roll)),'[]') into v_plan from
      (select id,row_number() over(partition by section_id order by roll_no nulls last,id) roll from rakeezx.enrollments
        where owner_id=v_owner and section_id=any(v_sections) and status='active' and deleted_at is null) p;
    update rakeezx.enrollments set roll_no=null where owner_id=v_owner and section_id=any(v_sections) and status='active' and deleted_at is null;
    update rakeezx.enrollments e set roll_no=p.roll,client_updated_at=p_client_updated_at,device_id=p_device_id
      from jsonb_to_recordset(v_plan) as p(id text,roll integer) where e.owner_id=v_owner and e.id=p.id;
  end if;
  select coalesce(jsonb_agg(to_jsonb(e) order by e.id),'[]') into v_rows from rakeezx.enrollments e
    where owner_id=v_owner and (student_id=v_student or section_id=any(v_sections));
  v_result:=jsonb_build_object('mutationId',p_mutation_id,'command',p_command,'outcome',v_outcome,
    'code',v_code,'reason',v_reason,'student',case when v_s.id is null then null else to_jsonb(v_s) end,'enrollments',v_rows);
  insert into rakeezx.student_lifecycle_receipts(owner_id,mutation_id,student_id,request_envelope,result)
    values(v_owner,p_mutation_id,v_student,v_envelope,v_result);
  return v_result;
end; $$;
revoke all on function rakeezx.apply_student_lifecycle_command(text,text,text,jsonb,bigint) from public,anon;
grant execute on function rakeezx.apply_student_lifecycle_command(text,text,text,jsonb,bigint) to authenticated;

-- Prevent legacy offline withdrawal from ending a different current source.
-- Keep the existing V2 protocol and receipt behavior otherwise unchanged.
create or replace function rakeezx.apply_sync_v2_enrollment_command(
  p_mutation_id text,p_device_id text,p_command text,p_payload jsonb,p_client_updated_at bigint default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_e rakeezx.enrollments%rowtype; v_receipt jsonb;
begin
  if auth.uid() is null then raise exception using errcode='42501',message='Authentication required'; end if;
  perform rakeezx.lock_student_lifecycle(auth.uid());
  if p_command='withdraw' and not exists(select 1 from rakeezx.sync_mutation_receipts where owner_id=auth.uid() and mutation_id=p_mutation_id) then
    select * into v_e from rakeezx.enrollments where owner_id=auth.uid() and id=p_payload->>'sourceEnrollmentId'
      and student_id=p_payload->>'studentId' and status='active' and deleted_at is null;
    if not found then raise exception using errcode='22023',message='STALE_SOURCE_ENROLLMENT'; end if;
  end if;
  return rakeezx.apply_sync_v2_enrollment_command_before_student_0029(p_mutation_id,p_device_id,p_command,p_payload,p_client_updated_at);
end; $$;
commit;
```

## Full metadata/pure-date verification SQL

```sql
-- READ-ONLY metadata checks. No users, students or Product records are queried.
-- Confirm project reference xlrubcwjqktzzunrvuns in the dashboard first.

-- Expected: one table, both RLS flags true, zero policies.
select c.relname,c.relrowsecurity,c.relforcerowsecurity,
  (select count(*) from pg_policy p where p.polrelid=c.oid) policy_count
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='rakeezx' and c.relname='student_lifecycle_receipts';

-- Expected: owner_id uuid; mutation_id/student_id text; envelope/result jsonb;
-- created_at timestamptz. All NOT NULL; created_at defaults to clock_timestamp().
select column_name,data_type,is_nullable,column_default
from information_schema.columns
where table_schema='rakeezx' and table_name='student_lifecycle_receipts'
order by ordinal_position;

-- Expected: PK(owner_id,mutation_id), owner FK to auth.users ON DELETE CASCADE,
-- mutation_id length check 1..200. No existing Product constraint is changed.
select conname,pg_get_constraintdef(oid) definition
from pg_constraint where conrelid='rakeezx.student_lifecycle_receipts'::regclass and contype in ('p','f','c') order by conname;

-- Expected: all eight values false. Frontend cannot inspect/modify receipts.
select role_name,
  has_table_privilege(role_name,'rakeezx.student_lifecycle_receipts','SELECT') can_select,
  has_table_privilege(role_name,'rakeezx.student_lifecycle_receipts','INSERT') can_insert,
  has_table_privilege(role_name,'rakeezx.student_lifecycle_receipts','UPDATE') can_update,
  has_table_privilege(role_name,'rakeezx.student_lifecycle_receipts','DELETE') can_delete
from (values ('anon'),('authenticated')) roles(role_name);

-- Expected: authenticated true / anon false for the ONE public domain RPC.
select has_function_privilege('authenticated','rakeezx.apply_student_lifecycle_command(text,text,text,jsonb,bigint)','EXECUTE') authenticated,
  has_function_privilege('anon','rakeezx.apply_student_lifecycle_command(text,text,text,jsonb,bigint)','EXECUTE') anonymous;

-- Expected: seven new functions; empty search_path. Only the command RPC is
-- executable by authenticated. json_references_student is not SECURITY DEFINER.
select p.proname,pg_get_function_identity_arguments(p.oid) arguments,p.prosecdef,p.proconfig,
  has_function_privilege('authenticated',p.oid,'EXECUTE') authenticated_execute,
  has_function_privilege('anon',p.oid,'EXECUTE') anonymous_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='rakeezx' and p.proname in ('lock_student_lifecycle','json_references_student',
  'student_lifecycle_date','lock_student_lifecycle_statement',
  'guard_live_student_parent','pristine_student_blocker','apply_student_lifecycle_command')
order by p.proname;

-- Expected: 27 BEFORE STATEMENT gates, before any tuple/row-trigger locks.
-- Auth/Support/restore staging tables are intentionally excluded.
select c.relname,t.tgenabled,pg_get_triggerdef(t.oid) definition
from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
where n.nspname='rakeezx' and t.tgname='00_student_lifecycle_statement_lock' and not t.tgisinternal
order by c.relname;

-- Expected: three original SECURITY INVOKER compatibility RPCs, original
-- ACLs/signatures retained; first executable statement takes owner lock.
select p.proname,p.prosecdef,pg_get_functiondef(p.oid) definition
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='rakeezx' and p.proname in
  ('commit_enrollment_transfer','commit_enrollment_transfer_and_renumber','renumber_enrollment_roster')
order by p.proname;

-- Pure fixed-time conversion only: all four Saudi dates must be 2026-09-13.
-- DB timezone is informational; it cannot affect lifecycle dates.
select current_setting('TimeZone') database_timezone,
  rakeezx.student_lifecycle_date('2026-09-12T21:01:00Z'::timestamptz) at_0001,
  rakeezx.student_lifecycle_date('2026-09-12T23:59:00Z'::timestamptz) at_0259,
  rakeezx.student_lifecycle_date('2026-09-13T00:01:00Z'::timestamptz) at_0301,
  rakeezx.student_lifecycle_date('2026-09-13T10:00:00Z'::timestamptz) daytime;

-- Expected: 11 enabled BEFORE INSERT/UPDATE row triggers using the live-parent
-- guard. Their parent/snapshot/history checks depend on the table type.
select c.relname,t.tgenabled,pg_get_triggerdef(t.oid) definition
from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
where n.nspname='rakeezx' and t.tgname='00_student_lifecycle_safety' and not t.tgisinternal
order by c.relname;

-- Expected: 11 existing public RPC wrappers take the owner safety lock.
-- Their corresponding _before_student_0029 implementations remain present,
-- but are NOT executable by anon/authenticated. Review definitions for exact
-- comparison with the frozen migration; these contain code, not user records.
select p.proname,pg_get_function_identity_arguments(p.oid) arguments,p.prosecdef,p.proconfig,
  has_function_privilege('authenticated',p.oid,'EXECUTE') authenticated_execute,
  has_function_privilege('anon',p.oid,'EXECUTE') anonymous_execute,
  pg_get_functiondef(p.oid) definition
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='rakeezx' and (p.proname in (
  'apply_sync_v2_mutation','apply_sync_v2_enrollment_command','apply_sync_v2_attendance_command',
  'apply_sync_v2_fill_attendance_command','apply_sync_v2_class_goal_reward_command',
  'apply_sync_v2_closed_term_report_command','apply_sync_v2_lifecycle_command',
  'apply_sync_v2_section_lifecycle_command','apply_sync_v2_session_delete_command',
  'apply_sync_v2_teaching_creation_command','finalize_sync_v2_restore')
  or p.proname like '%\_before\_student\_0029' escape '\')
order by p.proname;

-- Full definitions of the two guards and domain command for exact review.
select pg_get_functiondef(p.oid) definition
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='rakeezx' and p.proname in (
  'guard_live_student_parent','pristine_student_blocker','apply_student_lifecycle_command')
order by p.proname;

-- Do NOT test behavior against real Product Owner records or invoke a delete.
-- Synthetic behavioral checks are deferred to the post-confirmation gate.
```
