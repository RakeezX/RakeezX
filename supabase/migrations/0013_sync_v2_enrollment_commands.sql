-- RAKEEZ X — SYNC-V2C2-A: atomic enrollment domain commands.
-- Additive development migration.  It is intentionally not a V1 cutover.

begin;

-- V2A receipts deliberately constrained generic mutations.  Enrollment
-- commands are a new additive protocol operation family, so retain their
-- truthful command label in the immutable receipt rather than disguising it
-- as a generic patch.
alter table rakeezx.sync_mutation_receipts
  drop constraint if exists sync_mutation_receipts_operation_check;
alter table rakeezx.sync_mutation_receipts
  add constraint sync_mutation_receipts_operation_check
  check (operation in ('create', 'patch', 'delete', 'enroll', 'transfer', 'withdraw'));

create or replace function rakeezx.apply_sync_v2_enrollment_command(
  p_mutation_id text,
  p_device_id text,
  p_command text,
  p_payload jsonb,
  p_client_updated_at bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_student_id text := p_payload ->> 'studentId';
  v_source_id text := p_payload ->> 'sourceEnrollmentId';
  v_destination_id text := p_payload ->> 'destinationEnrollmentId';
  v_destination_section_id text := p_payload ->> 'destinationSectionId';
  v_date date := nullif(p_payload ->> 'date', '')::date;
  v_note text := coalesce(p_payload ->> 'note', '');
  v_receipt rakeezx.sync_mutation_receipts%rowtype;
  v_enrollment rakeezx.enrollments%rowtype;
  v_destination rakeezx.enrollments%rowtype;
  v_source_section text;
  v_sections text[];
  v_row jsonb;
  v_result jsonb;
  v_enrollments jsonb;
  v_roster_plan jsonb;
  v_outcome text;
  v_envelope jsonb;
begin
  if v_owner is null then raise exception using errcode = '42501', message = 'Authentication required'; end if;
  if coalesce(p_mutation_id, '') = '' or coalesce(p_device_id, '') = '' or
      p_command not in ('enroll', 'transfer', 'withdraw') or
      pg_catalog.jsonb_typeof(p_payload) <> 'object' or coalesce(v_student_id, '') = '' then
    raise exception using errcode = '22023', message = 'Invalid Sync V2 enrollment command';
  end if;
  v_envelope := pg_catalog.jsonb_build_object(
    'mutationId', p_mutation_id, 'deviceId', p_device_id, 'command', p_command,
    'payload', p_payload, 'clientUpdatedAt', p_client_updated_at
  );
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_owner::text || ':sync-v2:' || p_mutation_id, 0));
  select * into v_receipt from rakeezx.sync_mutation_receipts
    where owner_id = v_owner and mutation_id = p_mutation_id;
  if found then
    if v_receipt.request_envelope is distinct from v_envelope then
      raise exception using errcode = '22023', message = 'Mutation ID was reused with a different request';
    end if;
    return v_receipt.result;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_owner::text || ':student:' || v_student_id, 0));
  perform 1 from rakeezx.students where owner_id = v_owner and id = v_student_id and deleted_at is null for update;
  if not found then raise exception using errcode = 'P0001', message = 'Student is not active for current user'; end if;

  if p_command = 'transfer' then
    if coalesce(v_source_id, '') = '' or coalesce(v_destination_id, '') = '' or
        coalesce(v_destination_section_id, '') = '' or v_source_id = v_destination_id or v_date is null then
      raise exception using errcode = '22023', message = 'Invalid transfer command payload';
    end if;
    select * into v_enrollment from rakeezx.enrollments where owner_id = v_owner and id = v_source_id for update;
    select * into v_destination from rakeezx.enrollments where owner_id = v_owner and student_id = v_student_id
      and section_id = v_destination_section_id for update;
    if found and v_destination.id <> v_destination_id then v_destination_id := v_destination.id; end if;
    if v_enrollment.id is null or v_enrollment.student_id <> v_student_id or v_enrollment.status <> 'active' or v_enrollment.deleted_at is not null then
      select * into v_destination from rakeezx.enrollments where owner_id = v_owner and student_id = v_student_id
        and status = 'active' and deleted_at is null for update;
      if found and v_destination.section_id = v_destination_section_id then
        v_outcome := 'already_applied';
      else
        v_outcome := 'conflict';
      end if;
    else
      v_source_section := v_enrollment.section_id;
      if v_source_section = v_destination_section_id then v_outcome := 'already_applied';
      else
        perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_owner::text || ':section:' || least(v_source_section, v_destination_section_id), 0));
        perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_owner::text || ':section:' || greatest(v_source_section, v_destination_section_id), 0));
        perform 1 from rakeezx.sections where owner_id = v_owner and id = v_destination_section_id and deleted_at is null for update;
        if not found then raise exception using errcode = 'P0001', message = 'Destination section is not active'; end if;
        if exists (select 1 from rakeezx.enrollments where owner_id = v_owner and student_id = v_student_id
          and status = 'active' and deleted_at is null and id <> v_source_id) then
          raise exception using errcode = 'P0001', message = 'Another active enrollment already exists';
        end if;
        update rakeezx.enrollments set status = 'transferred', end_date = v_date, transfer_note = v_note,
          client_updated_at = p_client_updated_at, device_id = p_device_id where owner_id = v_owner and id = v_source_id;
        if v_destination.id is null then
          insert into rakeezx.enrollments (owner_id, id, student_id, section_id, roll_no, start_date, status, transfer_note, client_updated_at, device_id)
          values (v_owner, v_destination_id, v_student_id, v_destination_section_id, null, v_date, 'active', '', p_client_updated_at, p_device_id);
        elsif v_destination.deleted_at is not null then
          raise exception using errcode = 'P0001', message = 'Enrollment tombstone cannot be reactivated';
        else
          update rakeezx.enrollments set status = 'active', start_date = v_date, end_date = null, roll_no = null,
            client_updated_at = p_client_updated_at, device_id = p_device_id where owner_id = v_owner and id = v_destination.id;
        end if;
        v_outcome := 'applied';
      end if;
    end if;
    v_sections := array_remove(array[v_source_section, v_destination_section_id], null);
  elsif p_command = 'enroll' then
    if coalesce(v_destination_id, '') = '' or coalesce(v_destination_section_id, '') = '' or v_date is null then
      raise exception using errcode = '22023', message = 'Invalid enroll command payload';
    end if;
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_owner::text || ':section:' || v_destination_section_id, 0));
    perform 1 from rakeezx.sections where owner_id = v_owner and id = v_destination_section_id and deleted_at is null for update;
    if not found then raise exception using errcode = 'P0001', message = 'Destination section is not active'; end if;
    select * into v_enrollment from rakeezx.enrollments where owner_id = v_owner and student_id = v_student_id and status = 'active' and deleted_at is null for update;
    if found and v_enrollment.section_id <> v_destination_section_id then v_outcome := 'conflict';
    elsif found then v_outcome := 'already_applied'; v_destination_id := v_enrollment.id;
    else
      insert into rakeezx.enrollments (owner_id, id, student_id, section_id, roll_no, start_date, status, transfer_note, client_updated_at, device_id)
      values (v_owner, v_destination_id, v_student_id, v_destination_section_id, null, v_date, 'active', '', p_client_updated_at, p_device_id);
      v_outcome := 'applied';
    end if;
    v_sections := array[v_destination_section_id];
  else
    select * into v_enrollment from rakeezx.enrollments where owner_id = v_owner and student_id = v_student_id
      and status = 'active' and deleted_at is null for update;
    if not found then v_outcome := 'already_applied'; v_sections := array[]::text[];
    else
      v_source_section := v_enrollment.section_id;
      perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_owner::text || ':section:' || v_source_section, 0));
      update rakeezx.enrollments set status = 'withdrawn', end_date = coalesce(v_date, current_date), transfer_note = v_note,
        client_updated_at = p_client_updated_at, device_id = p_device_id where owner_id = v_owner and id = v_enrollment.id;
      update rakeezx.students set status = 'withdrawn', client_updated_at = p_client_updated_at, device_id = p_device_id
        where owner_id = v_owner and id = v_student_id;
      v_outcome := 'applied'; v_sections := array[v_source_section];
    end if;
  end if;

  -- Server-owned complete sequential rosters: clear first, then assign stable current-roll order.
  if cardinality(v_sections) > 0 and v_outcome = 'applied' then
    select coalesce(jsonb_agg(jsonb_build_object('id', id, 'roll_no', next_roll)), '[]'::jsonb) into v_roster_plan
      from (
        select id, row_number() over (partition by section_id order by roll_no nulls last, id) as next_roll
        from rakeezx.enrollments where owner_id = v_owner and section_id = any(v_sections)
          and status = 'active' and deleted_at is null
      ) planned;
    update rakeezx.enrollments set roll_no = null where owner_id = v_owner and section_id = any(v_sections)
      and status = 'active' and deleted_at is null;
    update rakeezx.enrollments e set roll_no = planned.roll_no, client_updated_at = p_client_updated_at, device_id = p_device_id
      from jsonb_to_recordset(v_roster_plan) as planned(id text, roll_no integer)
      where e.owner_id = v_owner and e.id = planned.id;
  end if;

  select coalesce(jsonb_agg(to_jsonb(e) order by e.section_id, e.roll_no nulls last, e.id), '[]'::jsonb) into v_enrollments
    from rakeezx.enrollments e where e.owner_id = v_owner and (e.student_id = v_student_id or e.section_id = any(v_sections));
  v_result := jsonb_build_object('mutationId', p_mutation_id, 'command', p_command, 'outcome', v_outcome,
    'canonicalEnrollmentId', v_destination_id, 'enrollments', v_enrollments);
  insert into rakeezx.sync_mutation_receipts (owner_id, mutation_id, entity, record_id, device_id, base_revision, operation,
    client_updated_at, request_patch, request_envelope, outcome, applied_groups, conflicted_groups, result_revision, canonical, result)
  values (v_owner, p_mutation_id, 'enrollments', v_student_id, p_device_id, 0, p_command, p_client_updated_at,
    p_payload, v_envelope, v_outcome, array[]::text[], case when v_outcome = 'conflict' then array['__membership__']::text[] else array[]::text[] end,
    null, null, v_result);
  return v_result;
end;
$$;

revoke all on function rakeezx.apply_sync_v2_enrollment_command(text,text,text,jsonb,bigint) from public;
grant execute on function rakeezx.apply_sync_v2_enrollment_command(text,text,text,jsonb,bigint) to authenticated;

commit;
