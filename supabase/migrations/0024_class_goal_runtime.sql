-- RAKEEZ X — CLASS-GOAL-RUNTIME-01
-- Additive owner-scoped Goal + charter selection state and one atomic reward command.
set lock_timeout = '10s';

begin;

create table if not exists rakeezx.class_goals (
  id text not null check (char_length(id) between 1 and 240),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  teaching_id text not null,
  run_id text not null check (char_length(run_id) between 1 and 200),
  date date not null,
  session_id text,
  text text not null check (char_length(btrim(text)) between 1 and 120),
  preset_key text,
  duration_minutes integer not null check (duration_minutes between 1 and 180),
  reward_points integer not null check (reward_points between 1 and 10),
  state text not null check (state in ('active','cancelled','completed')),
  started_at timestamptz not null,
  completed_at timestamptz,
  reward_operation_id text,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  client_updated_at bigint,
  device_id text,
  deleted_at timestamptz,
  revision bigint not null default 1 check (revision >= 1),
  field_revisions jsonb not null default '{}'::jsonb check (jsonb_typeof(field_revisions)='object'),
  primary key (owner_id,id),
  unique (owner_id,teaching_id),
  foreign key (owner_id,teaching_id) references rakeezx.teachings(owner_id,id) on delete cascade,
  foreign key (owner_id,session_id) references rakeezx.sessions(owner_id,id) on delete set null (session_id),
  check ((state='completed' and completed_at is not null and reward_operation_id is not null) or
         (state<>'completed' and reward_operation_id is null))
);

create table if not exists rakeezx.class_charter_selections (
  id text not null check (char_length(id) between 1 and 240),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  teaching_id text not null,
  selected_rule_ids text[] not null default '{}',
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  client_updated_at bigint,
  device_id text,
  deleted_at timestamptz,
  revision bigint not null default 1 check (revision >= 1),
  field_revisions jsonb not null default '{}'::jsonb check (jsonb_typeof(field_revisions)='object'),
  primary key (owner_id,id),
  unique (owner_id,teaching_id),
  foreign key (owner_id,teaching_id) references rakeezx.teachings(owner_id,id) on delete cascade
);

create index if not exists class_goals_sync_idx on rakeezx.class_goals(owner_id,updated_at);
create index if not exists class_charter_selections_sync_idx on rakeezx.class_charter_selections(owner_id,updated_at);

alter table rakeezx.class_goals enable row level security;
alter table rakeezx.class_goals force row level security;
alter table rakeezx.class_charter_selections enable row level security;
alter table rakeezx.class_charter_selections force row level security;
create policy class_goals_select on rakeezx.class_goals for select to authenticated using(owner_id=(select auth.uid()));
create policy class_charter_selections_select on rakeezx.class_charter_selections for select to authenticated using(owner_id=(select auth.uid()));
revoke all on table rakeezx.class_goals,rakeezx.class_charter_selections from public,anon,authenticated;
grant select on table rakeezx.class_goals,rakeezx.class_charter_selections to authenticated;

create trigger class_goals_owner before insert on rakeezx.class_goals for each row execute function rakeezx.force_owner();
create trigger class_goals_touch before insert or update on rakeezx.class_goals for each row execute function rakeezx.touch_updated_at();
create trigger class_charter_selections_owner before insert on rakeezx.class_charter_selections for each row execute function rakeezx.force_owner();
create trigger class_charter_selections_touch before insert or update on rakeezx.class_charter_selections for each row execute function rakeezx.touch_updated_at();

alter function rakeezx.sync_v2_field_map(text) rename to sync_v2_field_map_before_class_goal_0024;
create function rakeezx.sync_v2_field_map(p_entity text) returns jsonb
language sql immutable security definer set search_path='' as $$
  select case p_entity
    when 'class_goals' then '{
      "teaching_id":"identity","run_id":"goal","date":"goal","session_id":"goal",
      "text":"goal","preset_key":"goal","duration_minutes":"goal","reward_points":"goal",
      "state":"goal","started_at":"goal","completed_at":"goal","reward_operation_id":"goal"
    }'::jsonb
    when 'class_charter_selections' then '{"teaching_id":"identity","selected_rule_ids":"selection"}'::jsonb
    else rakeezx.sync_v2_field_map_before_class_goal_0024(p_entity) end;
$$;
revoke all on function rakeezx.sync_v2_field_map_before_class_goal_0024(text) from public;

create trigger class_goals_sync_v2_revision before insert or update on rakeezx.class_goals
  for each row execute function rakeezx.sync_v2_stamp_revision();
create trigger class_charter_selections_sync_v2_revision before insert or update on rakeezx.class_charter_selections
  for each row execute function rakeezx.sync_v2_stamp_revision();

create or replace function rakeezx.guard_class_goal_write() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_teaching rakeezx.teachings%rowtype; v_section rakeezx.sections%rowtype; v_term rakeezx.terms%rowtype; v_session rakeezx.sessions%rowtype;
begin
  select * into v_teaching from rakeezx.teachings where owner_id=new.owner_id and id=new.teaching_id and deleted_at is null;
  if not found then raise exception using errcode='23503',message='Goal teaching missing'; end if;
  select * into v_section from rakeezx.sections where owner_id=new.owner_id and id=v_teaching.section_id and deleted_at is null;
  select * into v_term from rakeezx.terms where owner_id=new.owner_id and id=v_teaching.term_id and deleted_at is null;
  if v_section.status<>'active' and coalesce(current_setting('rakeezx.section_lifecycle_write',true),'')<>'on' then
    raise exception using errcode='22023',message='Archived section is read-only';
  end if;
  if v_term.status='closed' and
      coalesce(current_setting('rakeezx.section_lifecycle_write',true),'')<>'on' and
      coalesce(current_setting('rakeezx.section_lifecycle_delete',true),'')<>'on' then
    raise exception using errcode='22023',message='Closed term is read-only';
  end if;
  if new.session_id is not null then
    select * into v_session from rakeezx.sessions where owner_id=new.owner_id and id=new.session_id and deleted_at is null;
    if not found or v_session.teaching_id<>new.teaching_id or v_session.date<>new.date then
      raise exception using errcode='22023',message='Goal session does not match teaching/date';
    end if;
  end if;
  if tg_op='INSERT' and new.state='completed' and coalesce(current_setting('rakeezx.section_lifecycle_delete',true),'')<>'on' then
    raise exception using errcode='22023',message='Goal completion requires reward command';
  end if;
  if tg_op='UPDATE' and (new.reward_operation_id is distinct from old.reward_operation_id or
      (new.state='completed' and old.state<>'completed')) and
      coalesce(current_setting('rakeezx.class_goal_reward',true),'')<>'on' and
      coalesce(current_setting('rakeezx.section_lifecycle_delete',true),'')<>'on' then
    raise exception using errcode='22023',message='Goal completion requires reward command';
  end if;
  return new;
end $$;
revoke all on function rakeezx.guard_class_goal_write() from public;
create trigger guard_class_goal_write before insert or update on rakeezx.class_goals
  for each row execute function rakeezx.guard_class_goal_write();

create or replace function rakeezx.sanitize_class_charter_selection() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  select coalesce(array_agg(distinct rule_id order by rule_id),'{}'::text[]) into new.selected_rule_ids
  from unnest(coalesce(new.selected_rule_ids,'{}'::text[])) rule_id
  where exists(select 1 from rakeezx.class_rules r where r.owner_id=new.owner_id and r.teaching_id=new.teaching_id and r.id=rule_id and r.deleted_at is null);
  return new;
end $$;
revoke all on function rakeezx.sanitize_class_charter_selection() from public;
create trigger sanitize_class_charter_selection before insert or update of selected_rule_ids,teaching_id on rakeezx.class_charter_selections
  for each row execute function rakeezx.sanitize_class_charter_selection();

create or replace function rakeezx.prune_deleted_charter_rule() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.deleted_at is not null and old.deleted_at is null then
    update rakeezx.class_charter_selections set selected_rule_ids=array_remove(selected_rule_ids,new.id)
    where owner_id=new.owner_id and teaching_id=new.teaching_id and new.id=any(selected_rule_ids) and deleted_at is null;
  end if;
  return new;
end $$;
revoke all on function rakeezx.prune_deleted_charter_rule() from public;
create trigger class_rules_prune_charter after update of deleted_at on rakeezx.class_rules
  for each row execute function rakeezx.prune_deleted_charter_rule();

-- Extend archive ownership resolution for the new teaching-owned records.
alter function rakeezx.section_for_operational_row(text,jsonb) rename to section_for_operational_row_before_class_goal_0024;
create function rakeezx.section_for_operational_row(p_table text,p_row jsonb) returns text
language sql stable security definer set search_path='' as $$
  select case when p_table in ('class_goals','class_charter_selections') then
    (select t.section_id from rakeezx.teachings t where t.owner_id=(p_row->>'owner_id')::uuid and t.id=p_row->>'teaching_id')
  else rakeezx.section_for_operational_row_before_class_goal_0024(p_table,p_row) end;
$$;
revoke all on function rakeezx.section_for_operational_row_before_class_goal_0024(text,jsonb) from public;
create trigger guard_archived_section_write before insert or update on rakeezx.class_charter_selections
  for each row execute function rakeezx.guard_archived_section_write();

create or replace function rakeezx.cancel_goals_when_section_archived() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.status='archived' and old.status<>'archived' then
    update rakeezx.class_goals g set state='cancelled',completed_at=clock_timestamp(),reward_operation_id=null,
      client_updated_at=new.client_updated_at,device_id=new.device_id
    where g.owner_id=new.owner_id and g.teaching_id in
      (select id from rakeezx.teachings where owner_id=new.owner_id and section_id=new.id) and g.state='active' and g.deleted_at is null;
  end if;
  return new;
end $$;
revoke all on function rakeezx.cancel_goals_when_section_archived() from public;
create trigger sections_cancel_class_goals after update of status on rakeezx.sections
  for each row execute function rakeezx.cancel_goals_when_section_archived();

create or replace function rakeezx.tombstone_class_goal_data_for_teaching() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.deleted_at is not null and old.deleted_at is null then
    update rakeezx.class_goals set deleted_at=new.deleted_at,client_updated_at=new.client_updated_at,device_id=new.device_id
      where owner_id=new.owner_id and teaching_id=new.id and deleted_at is null;
    update rakeezx.class_charter_selections set deleted_at=new.deleted_at,client_updated_at=new.client_updated_at,device_id=new.device_id
      where owner_id=new.owner_id and teaching_id=new.id and deleted_at is null;
  end if;
  return new;
end $$;
revoke all on function rakeezx.tombstone_class_goal_data_for_teaching() from public;
create trigger teachings_tombstone_class_goal_data after update of deleted_at on rakeezx.teachings
  for each row execute function rakeezx.tombstone_class_goal_data_for_teaching();

alter function rakeezx.teaching_delete_blocker(uuid,text) rename to teaching_delete_blocker_before_class_goal_0024;
create function rakeezx.teaching_delete_blocker(p_owner uuid,p_teaching text) returns text
language plpgsql stable security definer set search_path='' as $$
declare v_reason text;
begin
  v_reason:=rakeezx.teaching_delete_blocker_before_class_goal_0024(p_owner,p_teaching);
  if v_reason is not null then return v_reason; end if;
  if exists(select 1 from rakeezx.class_goals where owner_id=p_owner and teaching_id=p_teaching) then return 'class-goal'; end if;
  if exists(select 1 from rakeezx.class_charter_selections where owner_id=p_owner and teaching_id=p_teaching) then return 'class-charter-selection'; end if;
  return null;
end $$;
revoke all on function rakeezx.teaching_delete_blocker_before_class_goal_0024(uuid,text) from public;

alter table rakeezx.sync_mutation_receipts drop constraint if exists sync_mutation_receipts_operation_check;
alter table rakeezx.sync_mutation_receipts add constraint sync_mutation_receipts_operation_check check(operation in
  ('create','patch','delete','enroll','transfer','withdraw','attendance','lifecycle','create_teaching','fill_attendance','section_lifecycle','close_term_report','goal_reward'));

create or replace function rakeezx.apply_sync_v2_class_goal_reward_command(
  p_mutation_id text,p_device_id text,p_goal_id text,p_run_id text,p_client_updated_at bigint default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_owner uuid:=auth.uid(); v_receipt rakeezx.sync_mutation_receipts%rowtype; v_goal rakeezx.class_goals%rowtype;
  v_teaching rakeezx.teachings%rowtype; v_section rakeezx.sections%rowtype; v_term rakeezx.terms%rowtype;
  v_envelope jsonb; v_result jsonb; v_logs jsonb; v_now timestamptz:=clock_timestamp(); v_student text;
begin
  if v_owner is null then raise exception using errcode='42501',message='Authentication required'; end if;
  if coalesce(p_mutation_id,'')='' or coalesce(p_device_id,'')='' or coalesce(p_goal_id,'')='' or coalesce(p_run_id,'')='' then
    raise exception using errcode='22023',message='Invalid goal reward envelope';
  end if;
  v_envelope:=jsonb_build_object('mutationId',p_mutation_id,'deviceId',p_device_id,'goalId',p_goal_id,'runId',p_run_id,'clientUpdatedAt',p_client_updated_at);
  perform pg_advisory_xact_lock(hashtextextended(v_owner::text||':goal-reward:'||p_goal_id||':'||p_run_id,0));
  select * into v_receipt from rakeezx.sync_mutation_receipts where owner_id=v_owner and mutation_id=p_mutation_id;
  if found then
    if v_receipt.request_envelope is distinct from v_envelope then raise exception using errcode='22023',message='Mutation ID reused with different goal reward'; end if;
    return v_receipt.result;
  end if;
  select * into v_goal from rakeezx.class_goals where owner_id=v_owner and id=p_goal_id and deleted_at is null for update;
  if not found or v_goal.run_id<>p_run_id then raise exception using errcode='22023',message='Goal run is no longer current'; end if;
  select * into v_teaching from rakeezx.teachings where owner_id=v_owner and id=v_goal.teaching_id and deleted_at is null;
  select * into v_section from rakeezx.sections where owner_id=v_owner and id=v_teaching.section_id and deleted_at is null;
  select * into v_term from rakeezx.terms where owner_id=v_owner and id=v_teaching.term_id and deleted_at is null;
  if v_section.status<>'active' or v_term.status='closed' then raise exception using errcode='22023',message='Goal teaching is read-only'; end if;

  -- A different-device retry after completion returns the same deterministic rows.
  if v_goal.state='active' then
    if v_goal.session_id is not null and exists(select 1 from rakeezx.attendance a where a.owner_id=v_owner and a.session_id=v_goal.session_id and a.deleted_at is null)
       and not exists(select 1 from rakeezx.session_roster_snapshots s where s.owner_id=v_owner and s.session_id=v_goal.session_id and s.state='complete' and s.deleted_at is null) then
      raise exception using errcode='22023',message='Legacy session membership is unresolved';
    end if;
    perform set_config('rakeezx.class_goal_reward','on',true);
    for v_student in
      with members as (
        select e.student_id from rakeezx.enrollments e where v_goal.session_id is null and e.owner_id=v_owner and e.section_id=v_teaching.section_id and e.status='active' and e.deleted_at is null
        union
        select coalesce(member->>'studentId',member->>'id') from rakeezx.session_roster_snapshots s cross join lateral jsonb_array_elements(s.members) member
          where v_goal.session_id is not null and s.owner_id=v_owner and s.session_id=v_goal.session_id and s.state='complete' and s.deleted_at is null
        union
        select e.student_id from rakeezx.enrollments e where v_goal.session_id is not null and e.owner_id=v_owner and e.section_id=v_teaching.section_id and e.status='active' and e.deleted_at is null
          and not exists(select 1 from rakeezx.session_roster_snapshots s where s.owner_id=v_owner and s.session_id=v_goal.session_id and s.state='complete' and s.deleted_at is null)
      )
      select distinct m.student_id from members m join rakeezx.students st on st.owner_id=v_owner and st.id=m.student_id and st.deleted_at is null
      where not exists(select 1 from rakeezx.attendance a where v_goal.session_id is not null and a.owner_id=v_owner and a.session_id=v_goal.session_id and a.student_id=m.student_id and a.status in ('absent','excused') and a.deleted_at is null)
      order by m.student_id
    loop
      insert into rakeezx.logs(id,owner_id,student_id,teaching_id,session_id,date,kind,delta,tag,note,client_updated_at,device_id)
      values('goal-reward:'||p_run_id||':'||v_student,v_owner,v_student,v_goal.teaching_id,v_goal.session_id,v_goal.date,'participation',v_goal.reward_points,
        'مكافأة هدف الصف','class-goal:'||v_goal.id||':'||v_goal.run_id,p_client_updated_at,p_device_id)
      on conflict(owner_id,id) do nothing;
    end loop;
    update rakeezx.class_goals set state='completed',completed_at=v_now,reward_operation_id=p_run_id,
      client_updated_at=p_client_updated_at,device_id=p_device_id where owner_id=v_owner and id=v_goal.id returning * into v_goal;
  elsif v_goal.state<>'completed' then
    raise exception using errcode='22023',message='Goal is not active';
  end if;
  select coalesce(jsonb_agg(to_jsonb(l) order by l.id),'[]'::jsonb) into v_logs from rakeezx.logs l
    where l.owner_id=v_owner and l.note='class-goal:'||v_goal.id||':'||v_goal.run_id and l.deleted_at is null;
  v_result:=jsonb_build_object('mutationId',p_mutation_id,'outcome','completed','goal',to_jsonb(v_goal),'logs',v_logs);
  insert into rakeezx.sync_mutation_receipts(owner_id,mutation_id,entity,record_id,device_id,base_revision,operation,
    client_updated_at,request_patch,request_envelope,outcome,applied_groups,conflicted_groups,result_revision,canonical,result)
  values(v_owner,p_mutation_id,'class_goals',p_goal_id,p_device_id,v_goal.revision,'goal_reward',p_client_updated_at,
    '{}'::jsonb,v_envelope,'completed',array['goal'],array[]::text[],v_goal.revision,to_jsonb(v_goal),v_result);
  return v_result;
end $$;
revoke all on function rakeezx.apply_sync_v2_class_goal_reward_command(text,text,text,text,bigint) from public;
grant execute on function rakeezx.apply_sync_v2_class_goal_reward_command(text,text,text,text,bigint) to authenticated;

-- Backup V4 must include both new generic V2 entities.
create or replace function rakeezx.sync_v2_restore_entities() returns text[]
language sql immutable security definer set search_path='' as $$
  select array['profile','years','calendars','calendar_days','terms','subjects','sections','teachings',
    'students','enrollments','notes','class_rules','class_charter_selections','class_goals','items','scores','logs',
    'time_profiles','slots','sessions','session_roster_snapshots','attendance','closed_term_reports']::text[];
$$;
revoke all on function rakeezx.sync_v2_restore_entities() from public;

commit;
