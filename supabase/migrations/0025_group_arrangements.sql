-- RAKEEZ X — GROUPS-SYNC-01
-- One owner-scoped, Sync V2 custom group arrangement per teaching.
set lock_timeout = '10s';

begin;

create table if not exists rakeezx.group_arrangements (
  id                text not null check (char_length(id) between 1 and 240),
  owner_id          uuid not null default auth.uid() references auth.users(id) on delete cascade,
  teaching_id       text not null,
  groups            jsonb not null default '[]'::jsonb check (jsonb_typeof(groups) = 'array'),
  created_at        timestamptz not null default pg_catalog.now(),
  updated_at        timestamptz not null default pg_catalog.now(),
  client_updated_at bigint,
  device_id         text,
  deleted_at        timestamptz,
  revision          bigint not null default 1 check (revision >= 1),
  field_revisions   jsonb not null default '{}'::jsonb check (jsonb_typeof(field_revisions) = 'object'),
  primary key (owner_id, id),
  unique (owner_id, teaching_id),
  foreign key (owner_id, teaching_id) references rakeezx.teachings(owner_id, id) on delete cascade
);

create index if not exists group_arrangements_sync_idx
  on rakeezx.group_arrangements (owner_id, updated_at);

alter table rakeezx.group_arrangements enable row level security;
alter table rakeezx.group_arrangements force row level security;
drop policy if exists group_arrangements_select on rakeezx.group_arrangements;
create policy group_arrangements_select on rakeezx.group_arrangements for select to authenticated
  using (owner_id = (select auth.uid()));
revoke all on table rakeezx.group_arrangements from public, anon, authenticated;
grant select on table rakeezx.group_arrangements to authenticated;

drop trigger if exists group_arrangements_owner on rakeezx.group_arrangements;
create trigger group_arrangements_owner before insert on rakeezx.group_arrangements
  for each row execute function rakeezx.force_owner();
drop trigger if exists group_arrangements_touch on rakeezx.group_arrangements;
create trigger group_arrangements_touch before insert or update on rakeezx.group_arrangements
  for each row execute function rakeezx.touch_updated_at();

alter function rakeezx.sync_v2_field_map(text) rename to sync_v2_field_map_before_group_arrangements_0025;
create function rakeezx.sync_v2_field_map(p_entity text) returns jsonb
language sql immutable security definer set search_path = '' as $$
  select case p_entity
    when 'group_arrangements' then '{"teaching_id":"identity","groups":"arrangement"}'::jsonb
    else rakeezx.sync_v2_field_map_before_group_arrangements_0025(p_entity) end;
$$;
revoke all on function rakeezx.sync_v2_field_map_before_group_arrangements_0025(text) from public;

alter function rakeezx.sync_v2_natural_key(text, jsonb) rename to sync_v2_natural_key_before_group_arrangements_0025;
create function rakeezx.sync_v2_natural_key(p_entity text, p_record jsonb) returns jsonb
language sql immutable security definer set search_path = '' as $$
  select case p_entity
    when 'group_arrangements' then
      case when p_record ->> 'teaching_id' is null then null
           else pg_catalog.jsonb_build_array(p_record ->> 'teaching_id') end
    else rakeezx.sync_v2_natural_key_before_group_arrangements_0025(p_entity, p_record) end;
$$;
revoke all on function rakeezx.sync_v2_natural_key_before_group_arrangements_0025(text, jsonb) from public;

drop trigger if exists group_arrangements_sync_v2_revision on rakeezx.group_arrangements;
create trigger group_arrangements_sync_v2_revision before insert or update on rakeezx.group_arrangements
  for each row execute function rakeezx.sync_v2_stamp_revision();

-- Keep only current roster IDs, in their submitted group/order, and keep the
-- first occurrence when malformed clients repeat a student.
create or replace function rakeezx.normalize_group_arrangement(
  p_owner uuid, p_teaching text, p_groups jsonb
) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_section text; v_group jsonb; v_member jsonb; v_clean jsonb;
  v_result jsonb := '[]'::jsonb; v_student text; v_seen text[] := '{}'::text[];
  v_group_count integer := 0; v_member_count integer := 0;
begin
  select section_id into v_section from rakeezx.teachings
    where owner_id=p_owner and id=p_teaching and deleted_at is null;
  if v_section is null then raise exception using errcode='23503',message='Group arrangement teaching missing'; end if;
  if p_groups is null or jsonb_typeof(p_groups)<>'array' or jsonb_array_length(p_groups)>100 then
    raise exception using errcode='22023',message='Invalid group arrangement';
  end if;
  for v_group in select value from jsonb_array_elements(p_groups) loop
    v_group_count := v_group_count + 1;
    if jsonb_typeof(v_group)<>'array' then raise exception using errcode='22023',message='Invalid group members'; end if;
    v_clean := '[]'::jsonb;
    for v_member in select value from jsonb_array_elements(v_group) loop
      v_member_count := v_member_count + 1;
      if v_member_count>1000 or jsonb_typeof(v_member)<>'string' then
        raise exception using errcode='22023',message='Invalid group member';
      end if;
      v_student := v_member #>> '{}';
      if char_length(v_student) between 1 and 240 and not (v_student=any(v_seen)) and exists(
        select 1 from rakeezx.enrollments e join rakeezx.students s
          on s.owner_id=e.owner_id and s.id=e.student_id and s.deleted_at is null
        where e.owner_id=p_owner and e.section_id=v_section and e.student_id=v_student
          and e.status='active' and e.deleted_at is null
      ) then
        v_seen := array_append(v_seen,v_student);
        v_clean := v_clean || pg_catalog.to_jsonb(v_student);
      end if;
    end loop;
    v_result := v_result || pg_catalog.jsonb_build_array(v_clean);
  end loop;
  return v_result;
end;
$$;
revoke all on function rakeezx.normalize_group_arrangement(uuid,text,jsonb) from public;

create or replace function rakeezx.sanitize_group_arrangement() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.groups := rakeezx.normalize_group_arrangement(new.owner_id,new.teaching_id,new.groups);
  return new;
end;
$$;
revoke all on function rakeezx.sanitize_group_arrangement() from public;
drop trigger if exists sanitize_group_arrangement on rakeezx.group_arrangements;
create trigger sanitize_group_arrangement before insert or update of teaching_id, groups
  on rakeezx.group_arrangements for each row execute function rakeezx.sanitize_group_arrangement();

-- A roster change prunes transferred/removed students at the authority. It
-- never adds missing members and never touches archived arrangements.
create or replace function rakeezx.prune_group_arrangements_for_enrollment() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid; v_section text; v_row record; v_groups jsonb;
begin
  v_owner := case when tg_op='DELETE' then old.owner_id else new.owner_id end;
  for v_section in
    select distinct section_id from (values
      (case when tg_op<>'INSERT' then old.section_id else null end),
      (case when tg_op<>'DELETE' then new.section_id else null end)
    ) sections(section_id) where section_id is not null
  loop
    for v_row in
      select ga.id,ga.teaching_id,ga.groups
      from rakeezx.group_arrangements ga
      join rakeezx.teachings t on t.owner_id=ga.owner_id and t.id=ga.teaching_id and t.deleted_at is null
      join rakeezx.sections s on s.owner_id=t.owner_id and s.id=t.section_id and s.deleted_at is null
      where ga.owner_id=v_owner and t.section_id=v_section and ga.deleted_at is null and s.status='active'
      for update of ga
    loop
      v_groups := rakeezx.normalize_group_arrangement(v_owner,v_row.teaching_id,v_row.groups);
      if v_groups is distinct from v_row.groups then
        update rakeezx.group_arrangements
          set groups=v_groups,
              client_updated_at=greatest(coalesce(client_updated_at,0),coalesce(
                case when tg_op='DELETE' then old.client_updated_at else new.client_updated_at end,0)),
              device_id=coalesce(case when tg_op='DELETE' then old.device_id else new.device_id end,'server:roster-prune')
          where owner_id=v_owner and id=v_row.id;
      end if;
    end loop;
  end loop;
  return case when tg_op='DELETE' then old else new end;
end;
$$;
revoke all on function rakeezx.prune_group_arrangements_for_enrollment() from public;
drop trigger if exists enrollments_prune_group_arrangements on rakeezx.enrollments;
create trigger enrollments_prune_group_arrangements
  after insert or update of student_id,section_id,status,deleted_at or delete on rakeezx.enrollments
  for each row execute function rakeezx.prune_group_arrangements_for_enrollment();

alter function rakeezx.section_for_operational_row(text,jsonb) rename to section_for_operational_row_before_group_arrangements_0025;
create function rakeezx.section_for_operational_row(p_table text,p_row jsonb) returns text
language sql stable security definer set search_path = '' as $$
  select case when p_table='group_arrangements' then
    (select t.section_id from rakeezx.teachings t
      where t.owner_id=(p_row->>'owner_id')::uuid and t.id=p_row->>'teaching_id')
  else rakeezx.section_for_operational_row_before_group_arrangements_0025(p_table,p_row) end;
$$;
revoke all on function rakeezx.section_for_operational_row_before_group_arrangements_0025(text,jsonb) from public;
drop trigger if exists guard_archived_section_write on rakeezx.group_arrangements;
create trigger guard_archived_section_write before insert or update on rakeezx.group_arrangements
  for each row execute function rakeezx.guard_archived_section_write();

create or replace function rakeezx.tombstone_group_arrangement_for_teaching() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.deleted_at is not null and old.deleted_at is null then
    update rakeezx.group_arrangements
      set deleted_at=new.deleted_at,client_updated_at=new.client_updated_at,device_id=new.device_id
      where owner_id=new.owner_id and teaching_id=new.id and deleted_at is null;
  end if;
  return new;
end;
$$;
revoke all on function rakeezx.tombstone_group_arrangement_for_teaching() from public;
drop trigger if exists teachings_tombstone_group_arrangement on rakeezx.teachings;
create trigger teachings_tombstone_group_arrangement after update of deleted_at on rakeezx.teachings
  for each row execute function rakeezx.tombstone_group_arrangement_for_teaching();

alter function rakeezx.teaching_delete_blocker(uuid,text) rename to teaching_delete_blocker_before_group_arrangements_0025;
create function rakeezx.teaching_delete_blocker(p_owner uuid,p_teaching text) returns text
language plpgsql stable security definer set search_path = '' as $$
declare v_reason text;
begin
  v_reason:=rakeezx.teaching_delete_blocker_before_group_arrangements_0025(p_owner,p_teaching);
  if v_reason is not null then return v_reason; end if;
  if exists(select 1 from rakeezx.group_arrangements where owner_id=p_owner and teaching_id=p_teaching) then
    return 'group-arrangement';
  end if;
  return null;
end;
$$;
revoke all on function rakeezx.teaching_delete_blocker_before_group_arrangements_0025(uuid,text) from public;

-- V4 backups/restores include the new generic Sync V2 family.
create or replace function rakeezx.sync_v2_restore_entities() returns text[]
language sql immutable security definer set search_path = '' as $$
  select array['profile','years','calendars','calendar_days','terms','subjects','sections','teachings',
    'students','enrollments','notes','class_rules','class_charter_selections','class_goals','group_arrangements',
    'items','scores','logs','time_profiles','slots','sessions','session_roster_snapshots','attendance','closed_term_reports']::text[];
$$;
revoke all on function rakeezx.sync_v2_restore_entities() from public;

commit;
