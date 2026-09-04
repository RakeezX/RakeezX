-- RAKEEZ X — migration 9: one atomic transfer plus both roster sequences.
--
-- Migration 8 remains the compatibility path for an explicit manual roster
-- renumber.  This additive RPC is the transfer path: it never exposes a
-- transient active-roll collision because membership and both final rosters
-- live in one server transaction.

begin;

create or replace function rakeezx.commit_enrollment_transfer_and_renumber(
  p_source jsonb,
  p_destination jsonb,
  p_source_roster jsonb,
  p_destination_roster jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_source_id text := p_source ->> 'id';
  v_destination_id text := p_destination ->> 'id';
  v_student_id text := p_source ->> 'student_id';
  v_source_section_id text := p_source ->> 'section_id';
  v_destination_section_id text := p_destination ->> 'section_id';
  v_source_stamp bigint := nullif(p_source ->> 'client_updated_at', '')::bigint;
  v_destination_stamp bigint := nullif(p_destination ->> 'client_updated_at', '')::bigint;
  v_destination_roll integer := nullif(p_destination ->> 'roll_no', '')::integer;
  v_source rakeezx.enrollments%rowtype;
  v_destination rakeezx.enrollments%rowtype;
  v_source_found boolean := false;
  v_destination_found boolean := false;
  v_source_plan_count integer;
  v_destination_plan_count integer;
  v_source_active_count integer;
  v_destination_active_count integer;
begin
  if v_owner is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;
  if pg_catalog.jsonb_typeof(p_source) <> 'object' or pg_catalog.jsonb_typeof(p_destination) <> 'object' or
      pg_catalog.jsonb_typeof(p_source_roster) <> 'array' or pg_catalog.jsonb_typeof(p_destination_roster) <> 'array' or
      coalesce(v_source_id, '') = '' or coalesce(v_destination_id, '') = '' or v_source_id = v_destination_id or
      coalesce(v_student_id, '') = '' or p_destination ->> 'student_id' is distinct from v_student_id or
      p_source ->> 'status' is distinct from 'transferred' or p_destination ->> 'status' is distinct from 'active' or
      coalesce(v_source_section_id, '') = '' or coalesce(v_destination_section_id, '') = '' or
      v_source_section_id = v_destination_section_id or v_source_stamp is null or v_destination_stamp is null or
      v_destination_roll is null or v_destination_roll not between 1 and 999 then
    raise exception using errcode = '22023', message = 'Invalid transfer-and-renumber payload';
  end if;

  -- Reject malformed plans before any membership row is changed.  NULL is not
  -- allowed as a final number; it is only an internal, transaction-local step.
  if exists (
    select 1 from pg_catalog.jsonb_array_elements(p_source_roster) as entry(value)
      where pg_catalog.jsonb_typeof(entry.value) is distinct from 'object'
        or coalesce(entry.value ->> 'id', '') = ''
        or pg_catalog.jsonb_typeof(entry.value -> 'roll_no') is distinct from 'number'
        or not ((entry.value ->> 'roll_no') ~ '^[1-9][0-9]{0,2}$')
        or pg_catalog.jsonb_typeof(entry.value -> 'client_updated_at') is distinct from 'number'
  ) or exists (
    select 1 from pg_catalog.jsonb_array_elements(p_destination_roster) as entry(value)
      where pg_catalog.jsonb_typeof(entry.value) is distinct from 'object'
        or coalesce(entry.value ->> 'id', '') = ''
        or pg_catalog.jsonb_typeof(entry.value -> 'roll_no') is distinct from 'number'
        or not ((entry.value ->> 'roll_no') ~ '^[1-9][0-9]{0,2}$')
        or pg_catalog.jsonb_typeof(entry.value -> 'client_updated_at') is distinct from 'number'
  ) then
    raise exception using errcode = '22023', message = 'Invalid final enrollment roster';
  end if;

  -- Serialize one student first, then the two sections in a deterministic
  -- order.  This prevents concurrent transfers/renumbers from interleaving.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_owner::text || ':' || v_student_id, 0));
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_owner::text || ':section:' || least(v_source_section_id, v_destination_section_id), 0));
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_owner::text || ':section:' || greatest(v_source_section_id, v_destination_section_id), 0));

  perform 1 from rakeezx.sections
    where owner_id = v_owner and id in (v_source_section_id, v_destination_section_id)
    order by id for update;
  if (select count(*) from rakeezx.sections
      where owner_id = v_owner and id in (v_source_section_id, v_destination_section_id)) <> 2 then
    raise exception using errcode = 'P0001', message = 'Transfer section is not owned by current user';
  end if;
  if exists (
    select 1 from rakeezx.sections
      where owner_id = v_owner and id = v_destination_section_id and deleted_at is not null
  ) then
    raise exception using errcode = 'P0001', message = 'Destination section is not active for current user';
  end if;

  -- Lock every membership whose state or final number this operation uses.
  perform 1 from rakeezx.enrollments
    where owner_id = v_owner and (student_id = v_student_id or section_id in (v_source_section_id, v_destination_section_id))
    order by section_id, id for update;

  select * into v_source from rakeezx.enrollments
    where owner_id = v_owner and id = v_source_id;
  v_source_found := found;
  select * into v_destination from rakeezx.enrollments
    where owner_id = v_owner and id = v_destination_id;
  v_destination_found := found;

  if (v_source_found and (
        v_source.student_id is distinct from v_student_id or v_source.section_id is distinct from v_source_section_id
      )) or (v_destination_found and (
        v_destination.student_id is distinct from v_student_id or v_destination.section_id is distinct from v_destination_section_id
      )) then
    raise exception using errcode = 'P0001', message = 'Enrollment identity does not match transfer payload';
  end if;
  if (v_source_found and v_source.deleted_at is not null) or (v_destination_found and v_destination.deleted_at is not null) then
    raise exception using errcode = 'P0001', message = 'Enrollment tombstone cannot be reactivated';
  end if;
  if (v_source_found and coalesce(v_source.client_updated_at, 0) > v_source_stamp) or
      (v_destination_found and coalesce(v_destination.client_updated_at, 0) > v_destination_stamp) then
    raise exception using errcode = 'P0001', message = 'Enrollment transfer is stale';
  end if;
  if exists (
    select 1 from rakeezx.enrollments
      where owner_id = v_owner and student_id = v_student_id and deleted_at is null and status = 'active'
        and id not in (v_source_id, v_destination_id)
  ) then
    raise exception using errcode = 'P0001', message = 'Another active enrollment already exists';
  end if;
  if exists (
    select 1 from rakeezx.enrollments
      where owner_id = v_owner and student_id = v_student_id and section_id = v_destination_section_id
        and id <> v_destination_id
  ) then
    raise exception using errcode = 'P0001', message = 'Destination enrollment identity conflict';
  end if;

  -- First commit membership with no active destination roll.  The final plans
  -- below own every active number, so no intermediate partial-index conflict
  -- can exist even when the student returns to a formerly occupied number.
  if v_source_found then
    update rakeezx.enrollments
      set status = 'transferred', end_date = nullif(p_source ->> 'end_date', '')::date,
          transfer_note = coalesce(p_source ->> 'transfer_note', ''),
          client_updated_at = v_source_stamp, device_id = p_source ->> 'device_id'
      where owner_id = v_owner and id = v_source_id
      returning * into v_source;
  else
    insert into rakeezx.enrollments (
      id, student_id, section_id, roll_no, start_date, end_date, status,
      transfer_note, client_updated_at, device_id
    ) values (
      v_source_id, v_student_id, v_source_section_id, nullif(p_source ->> 'roll_no', '')::integer,
      nullif(p_source ->> 'start_date', '')::date, nullif(p_source ->> 'end_date', '')::date,
      'transferred', coalesce(p_source ->> 'transfer_note', ''), v_source_stamp, p_source ->> 'device_id'
    ) returning * into v_source;
  end if;

  if v_destination_found then
    update rakeezx.enrollments
      set roll_no = null, start_date = nullif(p_destination ->> 'start_date', '')::date,
          end_date = null, status = 'active', client_updated_at = v_destination_stamp,
          device_id = p_destination ->> 'device_id'
      where owner_id = v_owner and id = v_destination_id
      returning * into v_destination;
  else
    insert into rakeezx.enrollments (
      id, student_id, section_id, roll_no, start_date, end_date, status,
      transfer_note, client_updated_at, device_id
    ) values (
      v_destination_id, v_student_id, v_destination_section_id, null,
      nullif(p_destination ->> 'start_date', '')::date, null, 'active',
      coalesce(p_destination ->> 'transfer_note', ''), v_destination_stamp, p_destination ->> 'device_id'
    ) returning * into v_destination;
  end if;

  select count(*) into v_source_plan_count from pg_catalog.jsonb_to_recordset(p_source_roster)
    as plan(id text, roll_no integer, client_updated_at bigint, device_id text);
  select count(*) into v_destination_plan_count from pg_catalog.jsonb_to_recordset(p_destination_roster)
    as plan(id text, roll_no integer, client_updated_at bigint, device_id text);
  select count(*) into v_source_active_count from rakeezx.enrollments
    where owner_id = v_owner and section_id = v_source_section_id and status = 'active' and deleted_at is null;
  select count(*) into v_destination_active_count from rakeezx.enrollments
    where owner_id = v_owner and section_id = v_destination_section_id and status = 'active' and deleted_at is null;

  if v_source_plan_count <> v_source_active_count or v_destination_plan_count <> v_destination_active_count then
    raise exception using errcode = 'P0001', message = 'Enrollment roster changed before transfer renumber';
  end if;
  if exists (
    select 1 from pg_catalog.jsonb_to_recordset(p_source_roster)
      as plan(id text, roll_no integer, client_updated_at bigint, device_id text)
      left join rakeezx.enrollments enrollment on enrollment.owner_id = v_owner and enrollment.id = plan.id
      where enrollment.id is null or enrollment.section_id <> v_source_section_id or enrollment.status <> 'active' or
        enrollment.deleted_at is not null or coalesce(enrollment.client_updated_at, 0) > plan.client_updated_at
  ) or exists (
    select 1 from pg_catalog.jsonb_to_recordset(p_destination_roster)
      as plan(id text, roll_no integer, client_updated_at bigint, device_id text)
      left join rakeezx.enrollments enrollment on enrollment.owner_id = v_owner and enrollment.id = plan.id
      where enrollment.id is null or enrollment.section_id <> v_destination_section_id or enrollment.status <> 'active' or
        enrollment.deleted_at is not null or coalesce(enrollment.client_updated_at, 0) > plan.client_updated_at
  ) or exists (
    select 1 from (select id from pg_catalog.jsonb_to_recordset(p_source_roster)
      as plan(id text, roll_no integer, client_updated_at bigint, device_id text)) ids group by id having count(*) > 1
  ) or exists (
    select 1 from (select id from pg_catalog.jsonb_to_recordset(p_destination_roster)
      as plan(id text, roll_no integer, client_updated_at bigint, device_id text)) ids group by id having count(*) > 1
  ) or exists (
    select 1 from (select roll_no from pg_catalog.jsonb_to_recordset(p_source_roster)
      as plan(id text, roll_no integer, client_updated_at bigint, device_id text)) rolls group by roll_no having count(*) > 1
  ) or exists (
    select 1 from (select roll_no from pg_catalog.jsonb_to_recordset(p_destination_roster)
      as plan(id text, roll_no integer, client_updated_at bigint, device_id text)) rolls group by roll_no having count(*) > 1
  ) or not exists (
    select 1 from pg_catalog.jsonb_to_recordset(p_destination_roster)
      as plan(id text, roll_no integer, client_updated_at bigint, device_id text)
      where plan.id = v_destination_id and plan.roll_no = v_destination_roll
  ) then
    raise exception using errcode = 'P0001', message = 'Invalid or stale final enrollment roster';
  end if;

  -- The partial unique index ignores NULL.  Both rosters are clear only
  -- inside this transaction, then receive their complete final sequences.
  update rakeezx.enrollments set roll_no = null
    where owner_id = v_owner and section_id in (v_source_section_id, v_destination_section_id)
      and status = 'active' and deleted_at is null;

  update rakeezx.enrollments enrollment
    set roll_no = plan.roll_no, client_updated_at = plan.client_updated_at, device_id = plan.device_id
    from pg_catalog.jsonb_to_recordset(p_source_roster)
      as plan(id text, roll_no integer, client_updated_at bigint, device_id text)
    where enrollment.owner_id = v_owner and enrollment.id = plan.id;
  update rakeezx.enrollments enrollment
    set roll_no = plan.roll_no, client_updated_at = plan.client_updated_at, device_id = plan.device_id
    from pg_catalog.jsonb_to_recordset(p_destination_roster)
      as plan(id text, roll_no integer, client_updated_at bigint, device_id text)
    where enrollment.owner_id = v_owner and enrollment.id = plan.id;

  select * into v_source from rakeezx.enrollments where owner_id = v_owner and id = v_source_id;
  select * into v_destination from rakeezx.enrollments where owner_id = v_owner and id = v_destination_id;
  return pg_catalog.jsonb_build_object(
    'source', pg_catalog.to_jsonb(v_source),
    'destination', pg_catalog.to_jsonb(v_destination),
    'source_roster', coalesce((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(enrollment) order by enrollment.roll_no)
      from rakeezx.enrollments enrollment where owner_id = v_owner and section_id = v_source_section_id
        and status = 'active' and deleted_at is null), '[]'::jsonb),
    'destination_roster', coalesce((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(enrollment) order by enrollment.roll_no)
      from rakeezx.enrollments enrollment where owner_id = v_owner and section_id = v_destination_section_id
        and status = 'active' and deleted_at is null), '[]'::jsonb)
  );
end;
$$;

revoke all on function rakeezx.commit_enrollment_transfer_and_renumber(jsonb, jsonb, jsonb, jsonb) from public;
grant execute on function rakeezx.commit_enrollment_transfer_and_renumber(jsonb, jsonb, jsonb, jsonb) to authenticated;

commit;
