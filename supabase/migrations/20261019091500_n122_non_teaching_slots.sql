-- AI-authored N122. LOCAL SOURCE ONLY until exact hosted preimage/apply authorization.
-- No historical IDs/data rewrite, new roles, grants, Auth settings or RLS changes.
set lock_timeout = '10s';
begin;

alter table rakeezx.slots
  add column kind text not null default 'teaching',
  add column term_id text,
  alter column teaching_id drop not null;
alter table rakeezx.slots add constraint slots_n122_kind_parent_ck check (
  (kind = 'teaching' and teaching_id is not null and term_id is null) or
  (kind in ('activity','waiting') and teaching_id is null and term_id is not null)
);
alter table rakeezx.slots add constraint slots_n122_owner_term_fk
  foreign key (owner_id, term_id) references rakeezx.terms(owner_id, id);
create index slots_n122_term_idx on rakeezx.slots(owner_id, term_id) where term_id is not null;

alter function rakeezx.sync_v2_field_map(text) rename to sync_v2_field_map_before_n122;
create function rakeezx.sync_v2_field_map(p_entity text) returns jsonb
language sql immutable security definer set search_path = '' as $$
  select case when p_entity='slots' then
    '{"teaching_id":"identity","kind":"identity","term_id":"identity","weekday":"schedule","period":"schedule"}'::jsonb
  else rakeezx.sync_v2_field_map_before_n122(p_entity) end;
$$;
revoke all on function rakeezx.sync_v2_field_map_before_n122(text) from public,anon,authenticated;
revoke all on function rakeezx.sync_v2_field_map(text) from public,anon,authenticated;

-- Keep legacy academic natural identity. Different nonacademic kinds must not
-- silently canonicalize to one another; the occupancy trigger rejects them.
alter function rakeezx.sync_v2_natural_key(text,jsonb) rename to sync_v2_natural_key_before_n122;
create function rakeezx.sync_v2_natural_key(p_entity text,p_record jsonb) returns jsonb
language sql immutable security definer set search_path = '' as $$
  select case when p_entity='slots' and p_record->>'kind' in ('activity','waiting') then
    jsonb_build_array(p_record->>'kind',p_record->>'term_id',(p_record->>'weekday')::int,(p_record->>'period')::int)
  else rakeezx.sync_v2_natural_key_before_n122(p_entity,p_record) end;
$$;
revoke all on function rakeezx.sync_v2_natural_key_before_n122(text,jsonb) from public,anon,authenticated;
revoke all on function rakeezx.sync_v2_natural_key(text,jsonb) from public,anon,authenticated;

create function rakeezx.n122_guard_slot_term() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.deleted_at is null and new.kind in ('activity','waiting') and not exists (
    select 1 from rakeezx.terms tm where tm.owner_id=new.owner_id and tm.id=new.term_id
      and tm.deleted_at is null and tm.status<>'closed'
  ) then raise exception using errcode='23503',message='N122 same-owner open term required'; end if;
  return new;
end; $$;
revoke all on function rakeezx.n122_guard_slot_term() from public,anon,authenticated;
create trigger n122_guard_slot_term before insert or update on rakeezx.slots
  for each row execute function rakeezx.n122_guard_slot_term();

create or replace function rakeezx.guard_active_slot_collision()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_status text; v_term text;
begin
  if new.deleted_at is not null then return new; end if;
  if new.kind='teaching' then
    select s.status,t.term_id into v_status,v_term from rakeezx.teachings t join rakeezx.sections s
      on s.owner_id=t.owner_id and s.id=t.section_id
      where t.owner_id=new.owner_id and t.id=new.teaching_id and t.deleted_at is null and s.deleted_at is null;
    if v_status is distinct from 'active' then return new; end if;
  else v_term:=new.term_id;
  end if;
  -- Same lock as class restoration and old academic writes.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    new.owner_id::text||':active-slot:'||new.weekday::text||':'||new.period::text,0));
  if exists (
    select 1 from rakeezx.slots sl
    left join rakeezx.teachings t on t.owner_id=sl.owner_id and t.id=sl.teaching_id
    left join rakeezx.sections s on s.owner_id=t.owner_id and s.id=t.section_id
    where sl.owner_id=new.owner_id and sl.id<>new.id and sl.weekday=new.weekday and sl.period=new.period
      and sl.deleted_at is null and (
        (sl.kind in ('activity','waiting') and sl.term_id=v_term) or
        (sl.kind='teaching' and t.deleted_at is null and s.deleted_at is null and s.status='active'
          and (new.kind='teaching' or t.term_id=v_term))
      )
  ) then raise exception using errcode='23505',message='Active timetable slot already occupied'; end if;
  return new;
end; $$;
revoke all on function rakeezx.guard_active_slot_collision() from public,anon,authenticated;

-- The existing section lifecycle command follows below, with only its conflict
-- lookup widened to independent slots in the restored teaching's term.

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
        left join rakeezx.teachings other_t on other_t.owner_id=other_slot.owner_id and other_t.id=other_slot.teaching_id
        left join rakeezx.sections other_s on other_s.owner_id=other_t.owner_id and other_s.id=other_t.section_id
        where own_slot.owner_id=v_owner and own_t.section_id=p_section_id and own_slot.deleted_at is null and own_t.deleted_at is null
          and ((other_slot.kind in ('activity','waiting') and other_slot.term_id=own_t.term_id) or
            (other_slot.kind='teaching' and other_t.section_id<>p_section_id and other_t.deleted_at is null and other_s.deleted_at is null and other_s.status='active'))
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

commit;
