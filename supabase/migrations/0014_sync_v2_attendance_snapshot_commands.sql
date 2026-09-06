-- RAKEEZ X — SYNC-V2C2-B1: first-attendance snapshot command.
-- Additive development migration. It is intentionally not a V1 cutover.

begin;

alter table rakeezx.sync_mutation_receipts
  drop constraint if exists sync_mutation_receipts_operation_check;
alter table rakeezx.sync_mutation_receipts
  add constraint sync_mutation_receipts_operation_check
  check (operation in ('create', 'patch', 'delete', 'enroll', 'transfer', 'withdraw', 'attendance'));

-- Snapshot contents are historical truth. The specialized command below is
-- the only V2 creation path; ordinary generic V2 mutations may still tombstone
-- a snapshot as part of an approved session lifecycle, but cannot create one.
create or replace function rakeezx.guard_sync_v2_snapshot_insert()
returns trigger language plpgsql as $$
begin
  if current_setting('rakeezx.sync_v2_attendance_snapshot', true) is distinct from 'on' then
    raise exception using errcode = '22023', message = 'Session roster snapshots require the Sync V2 attendance command';
  end if;
  return new;
end;
$$;
drop trigger if exists session_roster_snapshots_sync_v2_insert on rakeezx.session_roster_snapshots;
create trigger session_roster_snapshots_sync_v2_insert
  before insert on rakeezx.session_roster_snapshots
  for each row execute function rakeezx.guard_sync_v2_snapshot_insert();

create or replace function rakeezx.apply_sync_v2_attendance_command(
  p_mutation_id text,
  p_device_id text,
  p_attendance_id text,
  p_session_id text,
  p_student_id text,
  p_base_revision bigint,
  p_patch jsonb,
  p_client_updated_at bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_receipt rakeezx.sync_mutation_receipts%rowtype;
  v_session rakeezx.sessions%rowtype;
  v_teaching rakeezx.teachings%rowtype;
  v_snapshot rakeezx.session_roster_snapshots%rowtype;
  v_attendance rakeezx.attendance%rowtype;
  v_envelope jsonb;
  v_members jsonb;
  v_requested_groups text[] := array[]::text[];
  v_applied_groups text[] := array[]::text[];
  v_conflicted_groups text[] := array[]::text[];
  v_field text;
  v_revision bigint;
  v_field_revisions jsonb;
  v_outcome text;
  v_result jsonb;
  v_snapshot_json jsonb;
  v_attendance_json jsonb;
begin
  if v_owner is null then raise exception using errcode = '42501', message = 'Authentication required'; end if;
  if coalesce(p_mutation_id, '') = '' or coalesce(p_device_id, '') = '' or
      coalesce(p_attendance_id, '') = '' or coalesce(p_session_id, '') = '' or
      coalesce(p_student_id, '') = '' or p_base_revision is null or p_base_revision < 0 or
      p_patch is null or pg_catalog.jsonb_typeof(p_patch) <> 'object' then
    raise exception using errcode = '22023', message = 'Invalid Sync V2 attendance command';
  end if;
  for v_field in select pg_catalog.jsonb_object_keys(p_patch)
  loop
    if v_field not in ('status', 'note') then
      raise exception using errcode = '22023', message = 'Attendance field is not allowed: ' || v_field;
    end if;
    v_requested_groups := array_append(v_requested_groups, v_field);
  end loop;
  if not ('status' = any(v_requested_groups)) and p_base_revision = 0 then
    raise exception using errcode = '22023', message = 'New attendance requires status';
  end if;
  v_envelope := pg_catalog.jsonb_build_object(
    'mutationId', p_mutation_id, 'deviceId', p_device_id, 'attendanceId', p_attendance_id,
    'sessionId', p_session_id, 'studentId', p_student_id, 'baseRevision', p_base_revision,
    'patch', p_patch, 'clientUpdatedAt', p_client_updated_at
  );
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_owner::text || ':sync-v2:' || p_mutation_id, 0));
  select * into v_receipt from rakeezx.sync_mutation_receipts where owner_id = v_owner and mutation_id = p_mutation_id;
  if found then
    if v_receipt.request_envelope is distinct from v_envelope then
      raise exception using errcode = '22023', message = 'Mutation ID was reused with a different request';
    end if;
    return v_receipt.result;
  end if;

  -- Serialize all first-attendance attempts for this historical session.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_owner::text || ':session-roster:' || p_session_id, 0));
  select * into v_session from rakeezx.sessions where owner_id = v_owner and id = p_session_id and deleted_at is null for update;
  if not found or v_session.status in ('cancelled', 'cancelled_holiday') then
    raise exception using errcode = '22023', message = 'Attendance session is unavailable';
  end if;
  select * into v_teaching from rakeezx.teachings where owner_id = v_owner and id = v_session.teaching_id and deleted_at is null for update;
  if not found then raise exception using errcode = '22023', message = 'Attendance teaching is unavailable'; end if;
  perform 1 from rakeezx.students where owner_id = v_owner and id = p_student_id and deleted_at is null for update;
  if not found then raise exception using errcode = '22023', message = 'Attendance student is unavailable'; end if;

  select * into v_snapshot from rakeezx.session_roster_snapshots
    where owner_id = v_owner and session_id = p_session_id and deleted_at is null for update;
  if not found then
    -- Existing legacy records are intentionally not used to synthesize a
    -- historical snapshot. Existing rows can still be edited below.
    if not exists (select 1 from rakeezx.attendance where owner_id = v_owner and session_id = p_session_id and deleted_at is null) then
      select coalesce(jsonb_agg(jsonb_build_object('studentId', e.student_id, 'rollNo', e.roll_no)
        order by e.roll_no nulls last, s.name, e.student_id), '[]'::jsonb)
        into v_members
      from rakeezx.enrollments e
      join rakeezx.students s on s.owner_id = e.owner_id and s.id = e.student_id and s.deleted_at is null
      where e.owner_id = v_owner and e.section_id = v_teaching.section_id and e.status = 'active' and e.deleted_at is null;
      perform set_config('rakeezx.sync_v2_attendance_snapshot', 'on', true);
      insert into rakeezx.session_roster_snapshots (owner_id, id, session_id, teaching_id, section_id, captured_at, members, state, client_updated_at, device_id)
      values (v_owner, 'srs:' || p_session_id, p_session_id, v_session.teaching_id, v_teaching.section_id,
        pg_catalog.clock_timestamp(), v_members, 'complete', p_client_updated_at, p_device_id)
      returning * into v_snapshot;
    end if;
  end if;

  select * into v_attendance from rakeezx.attendance
    where owner_id = v_owner and student_id = p_student_id and session_id = p_session_id for update;
  if v_attendance.id is null then
    if v_snapshot.id is null then
      raise exception using errcode = '22023', message = 'Legacy session membership is unresolved';
    end if;
    if not (v_snapshot.members @> jsonb_build_array(jsonb_build_object('studentId', p_student_id))) then
      raise exception using errcode = '22023', message = 'Student is outside the immutable session roster';
    end if;
    insert into rakeezx.attendance (owner_id, id, student_id, session_id, teaching_id, date, status, note, client_updated_at, device_id)
    values (v_owner, p_attendance_id, p_student_id, p_session_id, v_session.teaching_id, v_session.date,
      p_patch ->> 'status', coalesce(p_patch ->> 'note', ''), p_client_updated_at, p_device_id)
    returning * into v_attendance;
    v_applied_groups := v_requested_groups;
    v_outcome := 'applied';
  else
    v_revision := v_attendance.revision;
    if p_base_revision > v_revision then
      raise exception using errcode = '22023', message = 'Attendance base revision is ahead of the server';
    end if;
    if v_attendance.deleted_at is not null then
      v_outcome := 'tombstoned';
      v_conflicted_groups := array['__deleted__'];
    else
      v_field_revisions := v_attendance.field_revisions;
      foreach v_field in array v_requested_groups
      loop
        if coalesce((v_field_revisions ->> v_field)::bigint, 1) > p_base_revision then
          v_conflicted_groups := array_append(v_conflicted_groups, v_field);
        else
          v_applied_groups := array_append(v_applied_groups, v_field);
        end if;
      end loop;
      if 'status' = any(v_applied_groups) or 'note' = any(v_applied_groups) then
        update rakeezx.attendance set
          status = case when 'status' = any(v_applied_groups) then p_patch ->> 'status' else status end,
          note = case when 'note' = any(v_applied_groups) then p_patch ->> 'note' else note end,
          client_updated_at = p_client_updated_at, device_id = p_device_id
          where owner_id = v_owner and id = v_attendance.id
          returning * into v_attendance;
      end if;
      if cardinality(v_conflicted_groups) = 0 then v_outcome := 'applied';
      elsif cardinality(v_applied_groups) > 0 then v_outcome := 'applied_with_conflicts';
      else v_outcome := 'conflict';
      end if;
    end if;
  end if;

  if v_session.status = 'scheduled' and v_outcome in ('applied', 'applied_with_conflicts') then
    update rakeezx.sessions set status = 'held', client_updated_at = p_client_updated_at, device_id = p_device_id
      where owner_id = v_owner and id = p_session_id;
  end if;
  select pg_catalog.to_jsonb(t) into v_snapshot_json from rakeezx.session_roster_snapshots t
    where t.owner_id = v_owner and t.id = v_snapshot.id;
  select pg_catalog.to_jsonb(t) into v_attendance_json from rakeezx.attendance t
    where t.owner_id = v_owner and t.id = v_attendance.id;
  v_result := jsonb_build_object('mutationId', p_mutation_id, 'outcome', v_outcome,
    'appliedGroups', to_jsonb(v_applied_groups), 'conflictedGroups', to_jsonb(v_conflicted_groups),
    'snapshot', v_snapshot_json, 'attendance', v_attendance_json);
  insert into rakeezx.sync_mutation_receipts (owner_id, mutation_id, entity, record_id, device_id, base_revision, operation,
    client_updated_at, request_patch, request_envelope, outcome, applied_groups, conflicted_groups, result_revision, canonical, result)
  values (v_owner, p_mutation_id, 'attendance', p_attendance_id, p_device_id, p_base_revision, 'attendance',
    p_client_updated_at, p_patch, v_envelope, v_outcome, v_applied_groups, v_conflicted_groups,
    v_attendance.revision, v_attendance_json, v_result);
  return v_result;
end;
$$;

revoke all on function rakeezx.apply_sync_v2_attendance_command(text,text,text,text,text,bigint,jsonb,bigint) from public;
grant execute on function rakeezx.apply_sync_v2_attendance_command(text,text,text,text,text,bigint,jsonb,bigint) to authenticated;

commit;
