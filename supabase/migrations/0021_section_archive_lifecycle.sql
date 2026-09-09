-- RAKEEZ X — SECTION-ARCHIVE-01A: owner-global section lifecycle authority.
-- Additive only: existing sections become active; no historical row is rebuilt.
set lock_timeout = '10s';

begin;

alter table rakeezx.sections
  add column if not exists status text not null default 'active',
  add column if not exists archived_at timestamptz,
  add column if not exists archive_date date;

alter table rakeezx.sections drop constraint if exists sections_status_ck;
alter table rakeezx.sections add constraint sections_status_ck
  check (status in ('active','archived'));
alter table rakeezx.sections drop constraint if exists sections_archive_state_ck;
alter table rakeezx.sections add constraint sections_archive_state_ck check (
  (status = 'active' and archived_at is null and archive_date is null) or
  (status = 'archived' and archived_at is not null and archive_date is not null)
);

-- Preserve the complete existing map without duplicating it in this migration.
alter function rakeezx.sync_v2_field_map(text)
  rename to sync_v2_field_map_before_section_archive_0021;
create function rakeezx.sync_v2_field_map(p_entity text)
returns jsonb language sql immutable security definer set search_path = '' as $$
  select case when p_entity = 'sections' then '{
    "year_id":"identity","grade":"identity","label":"identity",
    "name":"name","color":"color","order":"order",
    "status":"lifecycle","archived_at":"lifecycle","archive_date":"lifecycle"
  }'::jsonb else rakeezx.sync_v2_field_map_before_section_archive_0021(p_entity) end;
$$;
revoke all on function rakeezx.sync_v2_field_map_before_section_archive_0021(text) from public;

alter table rakeezx.sync_mutation_receipts drop constraint if exists sync_mutation_receipts_operation_check;
alter table rakeezx.sync_mutation_receipts add constraint sync_mutation_receipts_operation_check
  check (operation in ('create','patch','delete','enroll','transfer','withdraw','attendance','lifecycle',
    'create_teaching','fill_attendance','section_lifecycle'));

create or replace function rakeezx.section_for_operational_row(p_table text, p_row jsonb)
returns text language plpgsql stable security definer set search_path = '' as $$
declare v_owner uuid := (p_row->>'owner_id')::uuid; v_teaching text; v_section text;
begin
  if p_table in ('teachings','enrollments') then return p_row->>'section_id'; end if;
  if p_table = 'session_roster_snapshots' then return p_row->>'section_id'; end if;
  if p_table in ('items','slots','sessions','logs','class_rules') then v_teaching := p_row->>'teaching_id';
  elsif p_table = 'attendance' then v_teaching := p_row->>'teaching_id';
  elsif p_table = 'notes' then
    v_teaching := p_row->>'teaching_id';
    if v_teaching is null and p_row->>'session_id' is not null then
      select teaching_id into v_teaching from rakeezx.sessions where owner_id=v_owner and id=p_row->>'session_id';
    end if;
  elsif p_table = 'scores' then
    select t.section_id into v_section from rakeezx.items i join rakeezx.teachings t
      on t.owner_id=i.owner_id and t.id=i.teaching_id
      where i.owner_id=v_owner and i.id=p_row->>'item_id';
    return v_section;
  else return null;
  end if;
  select section_id into v_section from rakeezx.teachings where owner_id=v_owner and id=v_teaching;
  return v_section;
end; $$;
revoke all on function rakeezx.section_for_operational_row(text,jsonb) from public;

create or replace function rakeezx.guard_archived_section_write()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_section text; v_old_section text; v_status text;
begin
  if pg_catalog.current_setting('rakeezx.section_lifecycle_delete', true) = 'on' then return new; end if;
  v_section := rakeezx.section_for_operational_row(tg_table_name, to_jsonb(new));
  if tg_op = 'UPDATE' then v_old_section := rakeezx.section_for_operational_row(tg_table_name, to_jsonb(old)); end if;
  for v_section in select distinct candidate from unnest(array[v_section,v_old_section]) candidate where candidate is not null order by candidate loop
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.owner_id::text||':section-lifecycle:'||v_section,0));
    select status into v_status from rakeezx.sections where owner_id=new.owner_id and id=v_section and deleted_at is null;
    if v_status = 'archived' then
      raise exception using errcode='22023', message='Archived section is read-only';
    end if;
  end loop;
  return new;
end; $$;
revoke all on function rakeezx.guard_archived_section_write() from public;

do $$ declare v_table text; begin
  foreach v_table in array array['teachings','enrollments','items','scores','slots','sessions',
    'session_roster_snapshots','attendance','logs','notes','class_rules'] loop
    execute format('drop trigger if exists %I on rakeezx.%I', 'guard_archived_section_write', v_table);
    execute format('create trigger %I before insert or update on rakeezx.%I for each row execute function rakeezx.guard_archived_section_write()',
      'guard_archived_section_write', v_table);
  end loop;
end $$;

-- An archived slot remains historical evidence but no longer reserves the
-- teacher's active timetable. A serialized trigger replaces the old partial
-- index because an index predicate cannot follow slot -> teaching -> section.
drop index if exists rakeezx.slots_active_schedule_uniq;
create or replace function rakeezx.guard_active_slot_collision()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_status text;
begin
  if new.deleted_at is not null then return new; end if;
  select s.status into v_status from rakeezx.teachings t join rakeezx.sections s
    on s.owner_id=t.owner_id and s.id=t.section_id
    where t.owner_id=new.owner_id and t.id=new.teaching_id and t.deleted_at is null and s.deleted_at is null;
  if v_status is distinct from 'active' then return new; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    new.owner_id::text||':active-slot:'||new.weekday::text||':'||new.period::text,0));
  if exists(
    select 1 from rakeezx.slots sl
    join rakeezx.teachings t on t.owner_id=sl.owner_id and t.id=sl.teaching_id
    join rakeezx.sections s on s.owner_id=t.owner_id and s.id=t.section_id
    where sl.owner_id=new.owner_id and sl.id<>new.id and sl.weekday=new.weekday and sl.period=new.period
      and sl.deleted_at is null and t.deleted_at is null and s.deleted_at is null and s.status='active'
  ) then raise exception using errcode='23505',message='Active timetable slot already occupied'; end if;
  return new;
end; $$;
revoke all on function rakeezx.guard_active_slot_collision() from public;
drop trigger if exists guard_active_slot_collision on rakeezx.slots;
create trigger guard_active_slot_collision before insert or update on rakeezx.slots
  for each row execute function rakeezx.guard_active_slot_collision();

create or replace function rakeezx.guard_section_lifecycle_fields()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'active' or new.archived_at is not null or new.archive_date is not null then
      raise exception using errcode='22023', message='Section lifecycle requires its command';
    end if;
  elsif (old.status,old.archived_at,old.archive_date) is distinct from (new.status,new.archived_at,new.archive_date)
    and coalesce(pg_catalog.current_setting('rakeezx.section_lifecycle_write', true),'') <> 'on' then
    raise exception using errcode='22023', message='Section lifecycle requires its command';
  elsif old.status = 'archived'
    and coalesce(pg_catalog.current_setting('rakeezx.section_lifecycle_write', true),'') <> 'on'
    and coalesce(pg_catalog.current_setting('rakeezx.section_lifecycle_delete', true),'') <> 'on' then
    raise exception using errcode='22023', message='Archived section is read-only';
  end if;
  return new;
end; $$;
revoke all on function rakeezx.guard_section_lifecycle_fields() from public;
drop trigger if exists guard_section_lifecycle_fields on rakeezx.sections;
create trigger guard_section_lifecycle_fields before insert or update on rakeezx.sections
  for each row execute function rakeezx.guard_section_lifecycle_fields();

create or replace function rakeezx.teaching_delete_blocker(p_owner uuid, p_teaching text)
returns text language plpgsql stable security definer set search_path = '' as $$
declare v_bad boolean;
begin
  if exists(select 1 from rakeezx.teachings where owner_id=p_owner and id=p_teaching and (deleted_at is not null or revision>1)) then return 'teaching-modified'; end if;
  if exists(select 1 from rakeezx.enrollments e join rakeezx.teachings t
    on t.owner_id=e.owner_id and t.section_id=e.section_id
    where t.owner_id=p_owner and t.id=p_teaching) then return 'enrollments'; end if;
  select count(*)<>5 or bool_or(deleted_at is not null or revision>1) into v_bad from rakeezx.items where owner_id=p_owner and teaching_id=p_teaching;
  if coalesce(v_bad,true) then return 'default-items'; end if;
  if exists(
    select 1 from (values
      (0,'المشاركة والتفاعل',10::numeric,'participation'::text,1::numeric,1::numeric),
      (1,'الواجبات',10::numeric,null::text,1::numeric,1::numeric),
      (2,'الأنشطة والمشاريع',20::numeric,null::text,1::numeric,1::numeric),
      (3,'الاختبارات القصيرة',20::numeric,null::text,1::numeric,1::numeric),
      (4,'الاختبار النهائي',40::numeric,null::text,1::numeric,1::numeric)
    ) d(ord,name,max,auto,per_point,penalty)
    where not exists(select 1 from rakeezx.items i where i.owner_id=p_owner and i.teaching_id=p_teaching
      and i."order"=d.ord and i.name=d.name and i.max=d.max and i.auto is not distinct from d.auto
      and i.per_point=d.per_point and i.penalty=d.penalty and i.unit_id is null and i.lesson_id is null and i.deleted_at is null)
  ) then return 'default-items'; end if;
  if exists(select 1 from rakeezx.scores where owner_id=p_owner and item_id in (select id from rakeezx.items where owner_id=p_owner and teaching_id=p_teaching)) then return 'scores'; end if;
  if exists(select 1 from rakeezx.slots where owner_id=p_owner and teaching_id=p_teaching) then return 'slots'; end if;
  if exists(select 1 from rakeezx.sessions where owner_id=p_owner and teaching_id=p_teaching) then return 'sessions'; end if;
  if exists(select 1 from rakeezx.session_roster_snapshots where owner_id=p_owner and teaching_id=p_teaching) then return 'snapshots'; end if;
  if exists(select 1 from rakeezx.attendance where owner_id=p_owner and teaching_id=p_teaching) then return 'attendance'; end if;
  if exists(select 1 from rakeezx.logs where owner_id=p_owner and teaching_id=p_teaching) then return 'logs'; end if;
  if exists(select 1 from rakeezx.notes where owner_id=p_owner and (teaching_id=p_teaching or session_id in (select id from rakeezx.sessions where owner_id=p_owner and teaching_id=p_teaching))) then return 'notes'; end if;
  if exists(select 1 from rakeezx.class_rules where owner_id=p_owner and teaching_id=p_teaching) then return 'class-rules'; end if;
  return null;
end; $$;
revoke all on function rakeezx.teaching_delete_blocker(uuid,text) from public;

create or replace function rakeezx.section_delete_blocker(p_owner uuid, p_section text)
returns text language plpgsql stable security definer set search_path = '' as $$
declare v_teaching record; v_reason text;
begin
  if exists(select 1 from rakeezx.enrollments where owner_id=p_owner and section_id=p_section) then return 'enrollments'; end if;
  for v_teaching in select id,deleted_at from rakeezx.teachings where owner_id=p_owner and section_id=p_section loop
    if v_teaching.deleted_at is not null then return 'teaching-tombstone'; end if;
    v_reason := rakeezx.teaching_delete_blocker(p_owner,v_teaching.id);
    if v_reason is not null then return v_reason; end if;
  end loop;
  return null;
end; $$;
revoke all on function rakeezx.section_delete_blocker(uuid,text) from public;

-- Keep the old implementation private and wrap it with authoritative evidence checks.
alter function rakeezx.apply_sync_v2_lifecycle_command(text,text,text,text,bigint)
  rename to apply_sync_v2_lifecycle_command_before_section_archive_0021;
revoke all on function rakeezx.apply_sync_v2_lifecycle_command_before_section_archive_0021(text,text,text,text,bigint) from public, authenticated;
create function rakeezx.apply_sync_v2_lifecycle_command(
  p_mutation_id text,p_device_id text,p_command text,p_target_id text,p_client_updated_at bigint default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_owner uuid:=auth.uid(); v_reason text;
begin
  if v_owner is null then raise exception using errcode='42501',message='Authentication required'; end if;
  -- Let the existing implementation replay/validate an idempotency receipt
  -- before inspecting rows that the first successful delete already tombstoned.
  if exists(select 1 from rakeezx.sync_mutation_receipts where owner_id=v_owner and mutation_id=p_mutation_id) then
    return rakeezx.apply_sync_v2_lifecycle_command_before_section_archive_0021(
      p_mutation_id,p_device_id,p_command,p_target_id,p_client_updated_at);
  end if;
  if p_command='delete_class' then
    if not exists(select 1 from rakeezx.sections where owner_id=v_owner and id=p_target_id and deleted_at is null) then
      return rakeezx.apply_sync_v2_lifecycle_command_before_section_archive_0021(
        p_mutation_id,p_device_id,p_command,p_target_id,p_client_updated_at);
    end if;
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_owner::text||':section-lifecycle:'||p_target_id,0));
    v_reason:=rakeezx.section_delete_blocker(v_owner,p_target_id);
  elsif p_command='delete_teaching' then
    if not exists(select 1 from rakeezx.teachings where owner_id=v_owner and id=p_target_id and deleted_at is null) then
      return rakeezx.apply_sync_v2_lifecycle_command_before_section_archive_0021(
        p_mutation_id,p_device_id,p_command,p_target_id,p_client_updated_at);
    end if;
    v_reason:=rakeezx.teaching_delete_blocker(v_owner,p_target_id);
  end if;
  if v_reason is not null then raise exception using errcode='22023',message='Retained records require archive',detail=v_reason; end if;
  if p_command in ('delete_class','delete_teaching') then
    perform pg_catalog.set_config('rakeezx.section_lifecycle_delete','on',true);
  end if;
  return rakeezx.apply_sync_v2_lifecycle_command_before_section_archive_0021(
    p_mutation_id,p_device_id,p_command,p_target_id,p_client_updated_at);
end; $$;
revoke all on function rakeezx.apply_sync_v2_lifecycle_command(text,text,text,text,bigint) from public;
grant execute on function rakeezx.apply_sync_v2_lifecycle_command(text,text,text,text,bigint) to authenticated;

create or replace function rakeezx.apply_sync_v2_section_lifecycle_command(
  p_mutation_id text,p_device_id text,p_command text,p_section_id text,p_archive_date date default null,
  p_client_updated_at bigint default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid:=auth.uid(); v_receipt rakeezx.sync_mutation_receipts%rowtype; v_section rakeezx.sections%rowtype;
  v_envelope jsonb; v_result jsonb; v_outcome text; v_conflict boolean:=false; v_now timestamptz:=pg_catalog.clock_timestamp();
begin
  if v_owner is null then raise exception using errcode='42501',message='Authentication required'; end if;
  if coalesce(p_mutation_id,'')='' or coalesce(p_device_id,'')='' or coalesce(p_section_id,'')='' or
     p_command not in ('archive_class','reopen_class') or (p_command='archive_class' and p_archive_date is null) then
    raise exception using errcode='22023',message='Invalid section lifecycle command';
  end if;
  v_envelope:=jsonb_build_object('mutationId',p_mutation_id,'deviceId',p_device_id,'command',p_command,
    'sectionId',p_section_id,'archiveDate',p_archive_date,'clientUpdatedAt',p_client_updated_at);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_owner::text||':sync-v2:'||p_mutation_id,0));
  select * into v_receipt from rakeezx.sync_mutation_receipts where owner_id=v_owner and mutation_id=p_mutation_id;
  if found then
    if v_receipt.request_envelope is distinct from v_envelope then raise exception using errcode='22023',message='Mutation ID was reused with a different request'; end if;
    return v_receipt.result;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_owner::text||':section-lifecycle:'||p_section_id,0));
  select * into v_section from rakeezx.sections where owner_id=v_owner and id=p_section_id for update;
  if not found or v_section.deleted_at is not null then raise exception using errcode='22023',message='Section is unavailable'; end if;
  perform pg_catalog.set_config('rakeezx.section_lifecycle_write','on',true);
  if p_command='archive_class' then
    if v_section.status='archived' then v_outcome:='already_archived';
    else
      update rakeezx.sections set status='archived',archived_at=v_now,archive_date=p_archive_date,
        client_updated_at=p_client_updated_at,device_id=p_device_id where owner_id=v_owner and id=p_section_id returning * into v_section;
      v_outcome:='archived';
    end if;
  else
    if v_section.status='active' then v_outcome:='already_active';
    elsif v_section.archived_at is null or v_section.archive_date is null then v_outcome:='rejected_lifecycle';
    elsif not exists(select 1 from rakeezx.years y where y.owner_id=v_owner and y.id=v_section.year_id and y.deleted_at is null and y.status<>'archived') then v_outcome:='rejected_year';
    elsif not exists(select 1 from rakeezx.terms tm where tm.owner_id=v_owner and tm.year_id=v_section.year_id and tm.deleted_at is null and tm.status<>'closed') then v_outcome:='rejected_term';
    else
      perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
        v_owner::text||':active-slot:'||locked.weekday::text||':'||locked.period::text,0))
      from (select distinct sl.weekday,sl.period from rakeezx.slots sl join rakeezx.teachings t
        on t.owner_id=sl.owner_id and t.id=sl.teaching_id
        where sl.owner_id=v_owner and t.section_id=p_section_id and sl.deleted_at is null and t.deleted_at is null
        order by sl.weekday,sl.period) locked;
      select exists(
        select 1 from rakeezx.slots own_slot
        join rakeezx.teachings own_t on own_t.owner_id=own_slot.owner_id and own_t.id=own_slot.teaching_id
        join rakeezx.slots other_slot on other_slot.owner_id=own_slot.owner_id and other_slot.weekday=own_slot.weekday and other_slot.period=own_slot.period and other_slot.deleted_at is null
        join rakeezx.teachings other_t on other_t.owner_id=other_slot.owner_id and other_t.id=other_slot.teaching_id
        join rakeezx.sections other_s on other_s.owner_id=other_t.owner_id and other_s.id=other_t.section_id
        where own_slot.owner_id=v_owner and own_t.section_id=p_section_id and own_slot.deleted_at is null and own_t.deleted_at is null
          and other_t.section_id<>p_section_id and other_t.deleted_at is null and other_s.deleted_at is null and other_s.status='active'
      ) into v_conflict;
      if v_conflict then v_outcome:='rejected_slot_conflict';
      else
        update rakeezx.sections set status='active',archived_at=null,archive_date=null,
          client_updated_at=p_client_updated_at,device_id=p_device_id where owner_id=v_owner and id=p_section_id returning * into v_section;
        v_outcome:='reopened';
      end if;
    end if;
  end if;
  select * into v_section from rakeezx.sections where owner_id=v_owner and id=p_section_id;
  v_result:=jsonb_build_object('mutationId',p_mutation_id,'command',p_command,'outcome',v_outcome,'section',to_jsonb(v_section));
  insert into rakeezx.sync_mutation_receipts(owner_id,mutation_id,entity,record_id,device_id,base_revision,operation,
    client_updated_at,request_patch,request_envelope,outcome,applied_groups,conflicted_groups,result)
  values(v_owner,p_mutation_id,'sections',p_section_id,p_device_id,v_section.revision,'section_lifecycle',p_client_updated_at,
    '{}'::jsonb,v_envelope,v_outcome,case when v_outcome in ('archived','reopened') then array['lifecycle']::text[] else array[]::text[] end,
    case when v_outcome like 'rejected_%' then array['lifecycle']::text[] else array[]::text[] end,v_result);
  return v_result;
end; $$;
revoke all on function rakeezx.apply_sync_v2_section_lifecycle_command(text,text,text,text,date,bigint) from public;
grant execute on function rakeezx.apply_sync_v2_section_lifecycle_command(text,text,text,text,date,bigint) to authenticated;

commit;
