-- RAKEEZ X — SYNC-V2C2-B2: atomic lifecycle tombstones.
-- Additive development migration; no V1 cutover is performed here.

begin;

alter table rakeezx.sync_mutation_receipts
  drop constraint if exists sync_mutation_receipts_operation_check;
alter table rakeezx.sync_mutation_receipts
  add constraint sync_mutation_receipts_operation_check
  check (operation in ('create', 'patch', 'delete', 'enroll', 'transfer', 'withdraw', 'attendance', 'lifecycle'));

create or replace function rakeezx.apply_sync_v2_lifecycle_command(
  p_mutation_id text,
  p_device_id text,
  p_command text,
  p_target_id text,
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
  v_envelope jsonb;
  v_target jsonb;
  v_outcome text;
  v_result jsonb;
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  if v_owner is null then raise exception using errcode = '42501', message = 'Authentication required'; end if;
  if coalesce(p_mutation_id, '') = '' or coalesce(p_device_id, '') = '' or coalesce(p_target_id, '') = '' or
      p_command not in ('delete_item', 'delete_teaching', 'delete_student', 'delete_class') then
    raise exception using errcode = '22023', message = 'Invalid Sync V2 lifecycle command';
  end if;
  v_envelope := jsonb_build_object('mutationId', p_mutation_id, 'deviceId', p_device_id,
    'command', p_command, 'targetId', p_target_id, 'clientUpdatedAt', p_client_updated_at);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_owner::text || ':sync-v2:' || p_mutation_id, 0));
  select * into v_receipt from rakeezx.sync_mutation_receipts where owner_id=v_owner and mutation_id=p_mutation_id;
  if found then
    if v_receipt.request_envelope is distinct from v_envelope then
      raise exception using errcode='22023', message='Mutation ID was reused with a different request';
    end if;
    return v_receipt.result;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_owner::text || ':lifecycle:' || p_command || ':' || p_target_id, 0));

  if p_command = 'delete_item' then
    select to_jsonb(t) into v_target from rakeezx.items t where t.owner_id=v_owner and t.id=p_target_id for update;
    if v_target is null or v_target->>'deleted_at' is not null then v_outcome := 'already_deleted';
    else
      update rakeezx.scores set deleted_at=v_now, device_id=p_device_id, client_updated_at=p_client_updated_at where owner_id=v_owner and item_id=p_target_id and deleted_at is null;
      update rakeezx.items set deleted_at=v_now, device_id=p_device_id, client_updated_at=p_client_updated_at where owner_id=v_owner and id=p_target_id;
      v_outcome := 'deleted';
    end if;
  elsif p_command = 'delete_teaching' then
    select to_jsonb(t) into v_target from rakeezx.teachings t where t.owner_id=v_owner and t.id=p_target_id for update;
    if v_target is null or v_target->>'deleted_at' is not null then v_outcome := 'already_deleted';
    else
      update rakeezx.scores set deleted_at=v_now, device_id=p_device_id, client_updated_at=p_client_updated_at
        where owner_id=v_owner and item_id in (select id from rakeezx.items where owner_id=v_owner and teaching_id=p_target_id);
      update rakeezx.attendance set deleted_at=v_now, device_id=p_device_id, client_updated_at=p_client_updated_at
        where owner_id=v_owner and session_id in (select id from rakeezx.sessions where owner_id=v_owner and teaching_id=p_target_id);
      update rakeezx.session_roster_snapshots set deleted_at=v_now, device_id=p_device_id, client_updated_at=p_client_updated_at
        where owner_id=v_owner and session_id in (select id from rakeezx.sessions where owner_id=v_owner and teaching_id=p_target_id);
      update rakeezx.logs set deleted_at=v_now, device_id=p_device_id, client_updated_at=p_client_updated_at where owner_id=v_owner and teaching_id=p_target_id;
      update rakeezx.slots set deleted_at=v_now, device_id=p_device_id, client_updated_at=p_client_updated_at where owner_id=v_owner and teaching_id=p_target_id;
      update rakeezx.sessions set deleted_at=v_now, device_id=p_device_id, client_updated_at=p_client_updated_at where owner_id=v_owner and teaching_id=p_target_id;
      update rakeezx.items set deleted_at=v_now, device_id=p_device_id, client_updated_at=p_client_updated_at where owner_id=v_owner and teaching_id=p_target_id;
      update rakeezx.teachings set deleted_at=v_now, device_id=p_device_id, client_updated_at=p_client_updated_at where owner_id=v_owner and id=p_target_id;
      v_outcome := 'deleted';
    end if;
  elsif p_command = 'delete_student' then
    select to_jsonb(t) into v_target from rakeezx.students t where t.owner_id=v_owner and t.id=p_target_id for update;
    if v_target is null or v_target->>'deleted_at' is not null then v_outcome := 'already_deleted';
    else
      update rakeezx.enrollments set deleted_at=v_now, device_id=p_device_id, client_updated_at=p_client_updated_at where owner_id=v_owner and student_id=p_target_id;
      update rakeezx.scores set deleted_at=v_now, device_id=p_device_id, client_updated_at=p_client_updated_at where owner_id=v_owner and student_id=p_target_id;
      update rakeezx.attendance set deleted_at=v_now, device_id=p_device_id, client_updated_at=p_client_updated_at where owner_id=v_owner and student_id=p_target_id;
      update rakeezx.logs set deleted_at=v_now, device_id=p_device_id, client_updated_at=p_client_updated_at where owner_id=v_owner and student_id=p_target_id;
      update rakeezx.notes set deleted_at=v_now, device_id=p_device_id, client_updated_at=p_client_updated_at where owner_id=v_owner and student_id=p_target_id;
      update rakeezx.students set deleted_at=v_now, device_id=p_device_id, client_updated_at=p_client_updated_at where owner_id=v_owner and id=p_target_id;
      v_outcome := 'deleted';
    end if;
  else
    -- Preserve a student with any relationship outside the class. A true
    -- orphan follows the existing Product lifecycle and is tombstoned in this
    -- same transaction, so a stale device cannot revive only part of a class.
    select to_jsonb(t) into v_target from rakeezx.sections t where t.owner_id=v_owner and t.id=p_target_id for update;
    if v_target is null or v_target->>'deleted_at' is not null then v_outcome := 'already_deleted';
    else
      update rakeezx.scores set deleted_at=v_now, device_id=p_device_id, client_updated_at=p_client_updated_at where owner_id=v_owner and item_id in (
        select i.id from rakeezx.items i join rakeezx.teachings t on t.owner_id=i.owner_id and t.id=i.teaching_id where i.owner_id=v_owner and t.section_id=p_target_id);
      update rakeezx.attendance set deleted_at=v_now, device_id=p_device_id, client_updated_at=p_client_updated_at where owner_id=v_owner and session_id in (
        select s.id from rakeezx.sessions s join rakeezx.teachings t on t.owner_id=s.owner_id and t.id=s.teaching_id where s.owner_id=v_owner and t.section_id=p_target_id);
      update rakeezx.session_roster_snapshots set deleted_at=v_now, device_id=p_device_id, client_updated_at=p_client_updated_at where owner_id=v_owner and session_id in (
        select s.id from rakeezx.sessions s join rakeezx.teachings t on t.owner_id=s.owner_id and t.id=s.teaching_id where s.owner_id=v_owner and t.section_id=p_target_id);
      update rakeezx.notes set deleted_at=v_now, device_id=p_device_id, client_updated_at=p_client_updated_at where owner_id=v_owner and (teaching_id in (select id from rakeezx.teachings where owner_id=v_owner and section_id=p_target_id) or session_id in (select s.id from rakeezx.sessions s join rakeezx.teachings t on t.owner_id=s.owner_id and t.id=s.teaching_id where s.owner_id=v_owner and t.section_id=p_target_id));
      update rakeezx.logs set deleted_at=v_now, device_id=p_device_id, client_updated_at=p_client_updated_at where owner_id=v_owner and teaching_id in (select id from rakeezx.teachings where owner_id=v_owner and section_id=p_target_id);
      update rakeezx.slots set deleted_at=v_now, device_id=p_device_id, client_updated_at=p_client_updated_at where owner_id=v_owner and teaching_id in (select id from rakeezx.teachings where owner_id=v_owner and section_id=p_target_id);
      update rakeezx.sessions set deleted_at=v_now, device_id=p_device_id, client_updated_at=p_client_updated_at where owner_id=v_owner and teaching_id in (select id from rakeezx.teachings where owner_id=v_owner and section_id=p_target_id);
      update rakeezx.items set deleted_at=v_now, device_id=p_device_id, client_updated_at=p_client_updated_at where owner_id=v_owner and teaching_id in (select id from rakeezx.teachings where owner_id=v_owner and section_id=p_target_id);
      update rakeezx.teachings set deleted_at=v_now, device_id=p_device_id, client_updated_at=p_client_updated_at where owner_id=v_owner and section_id=p_target_id;
      update rakeezx.enrollments set deleted_at=v_now, device_id=p_device_id, client_updated_at=p_client_updated_at where owner_id=v_owner and section_id=p_target_id;
      update rakeezx.students u set deleted_at=v_now, device_id=p_device_id, client_updated_at=p_client_updated_at
        where u.owner_id=v_owner
          and exists (select 1 from rakeezx.enrollments e where e.owner_id=v_owner and e.student_id=u.id and e.section_id=p_target_id)
          and not exists (select 1 from rakeezx.enrollments e where e.owner_id=v_owner and e.student_id=u.id and e.section_id<>p_target_id)
          and not exists (select 1 from rakeezx.notes n where n.owner_id=v_owner and n.student_id=u.id and n.deleted_at is null)
          and not exists (select 1 from rakeezx.scores sc where sc.owner_id=v_owner and sc.student_id=u.id and sc.deleted_at is null)
          and not exists (select 1 from rakeezx.attendance a where a.owner_id=v_owner and a.student_id=u.id and a.deleted_at is null)
          and not exists (select 1 from rakeezx.logs l where l.owner_id=v_owner and l.student_id=u.id and l.deleted_at is null);
      update rakeezx.sections set deleted_at=v_now, device_id=p_device_id, client_updated_at=p_client_updated_at where owner_id=v_owner and id=p_target_id;
      v_outcome := 'deleted';
    end if;
  end if;
  v_result := jsonb_build_object('mutationId',p_mutation_id,'command',p_command,'targetId',p_target_id,'outcome',v_outcome);
  insert into rakeezx.sync_mutation_receipts (owner_id,mutation_id,entity,record_id,device_id,base_revision,operation,client_updated_at,request_patch,request_envelope,outcome,applied_groups,conflicted_groups,result)
  values (v_owner,p_mutation_id,'lifecycle',p_target_id,p_device_id,0,'lifecycle',p_client_updated_at,'{}'::jsonb,v_envelope,v_outcome,array['__deleted__']::text[],array[]::text[],v_result);
  return v_result;
end;
$$;

revoke all on function rakeezx.apply_sync_v2_lifecycle_command(text,text,text,text,bigint) from public;
grant execute on function rakeezx.apply_sync_v2_lifecycle_command(text,text,text,text,bigint) to authenticated;

commit;
