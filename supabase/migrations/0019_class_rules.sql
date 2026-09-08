-- RAKEEZ X — CLASS-RULES-01C: owner-scoped classroom-rule foundation.
-- Additive. Rules are generic Sync V2 records; this migration adds no UI,
-- custom command, ordering, scoring, or presentation semantics.
set lock_timeout = '10s';

begin;

create table if not exists rakeezx.class_rules (
  id                text not null check (char_length(id) between 1 and 200),
  owner_id          uuid not null default auth.uid() references auth.users(id) on delete cascade,
  teaching_id       text not null,
  icon_key          text not null check (icon_key ~ '^[a-z][a-z0-9_-]{0,39}$'),
  text              text not null check (char_length(btrim(text)) between 1 and 240),
  created_at        timestamptz not null default pg_catalog.now(),
  updated_at        timestamptz not null default pg_catalog.now(),
  client_updated_at bigint,
  device_id         text,
  deleted_at        timestamptz,
  revision          bigint not null default 1 check (revision >= 1),
  field_revisions   jsonb not null default '{}'::jsonb check (pg_catalog.jsonb_typeof(field_revisions) = 'object'),
  primary key (owner_id, id),
  foreign key (owner_id, teaching_id) references rakeezx.teachings(owner_id, id) on delete cascade
);

create index if not exists class_rules_teaching_idx
  on rakeezx.class_rules (owner_id, teaching_id, created_at, id);
create index if not exists class_rules_sync_idx
  on rakeezx.class_rules (owner_id, updated_at);

drop trigger if exists class_rules_owner on rakeezx.class_rules;
drop trigger if exists class_rules_touch on rakeezx.class_rules;
create trigger class_rules_owner before insert on rakeezx.class_rules
  for each row execute function rakeezx.force_owner();
create trigger class_rules_touch before insert or update on rakeezx.class_rules
  for each row execute function rakeezx.touch_updated_at();

alter table rakeezx.class_rules enable row level security;
alter table rakeezx.class_rules force row level security;
drop policy if exists class_rules_select on rakeezx.class_rules;
create policy class_rules_select on rakeezx.class_rules for select to authenticated
  using (owner_id = (select auth.uid()));
drop policy if exists class_rules_insert on rakeezx.class_rules;
create policy class_rules_insert on rakeezx.class_rules for insert to authenticated
  with check (owner_id = (select auth.uid()));
drop policy if exists class_rules_update on rakeezx.class_rules;
create policy class_rules_update on rakeezx.class_rules for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

revoke all on table rakeezx.class_rules from public;
revoke all on table rakeezx.class_rules from anon;
grant select on table rakeezx.class_rules to authenticated;

commit;

-- Keep the generic V2 field-group contract complete. This replaces the
-- previous function exactly, with one additive class_rules branch.
begin;

create or replace function rakeezx.sync_v2_field_map(p_entity text)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case p_entity
    when 'profile' then '{
      "teacher_name":"teacher_name","school_name":"school_name","phone":"phone",
      "report_principal_name":"report_principal_name",
      "active_time_profile_id":"timing_selection"
    }'::jsonb
    when 'years' then '{
      "label":"label","hijri_start":"identity","hijri_end":"identity",
      "order":"order","status":"status"
    }'::jsonb
    when 'terms' then '{
      "year_id":"identity","index":"identity","name":"name",
      "start_date":"dates","end_date":"dates","status":"status","calendar_id":"calendar"
    }'::jsonb
    when 'subjects' then '{"name":"name","slug":"identity"}'::jsonb
    when 'sections' then '{
      "year_id":"identity","grade":"identity","label":"identity",
      "name":"name","color":"color","order":"order"
    }'::jsonb
    when 'teachings' then '{
      "section_id":"identity","subject_id":"identity","term_id":"identity","order":"order"
    }'::jsonb
    when 'students' then '{"name":"name","note":"note","status":"status"}'::jsonb
    when 'enrollments' then '{
      "student_id":"identity","section_id":"identity","roll_no":"roll",
      "start_date":"membership","end_date":"membership","status":"membership",
      "transfer_note":"transfer_note"
    }'::jsonb
    when 'items' then '{
      "teaching_id":"identity","name":"name","max":"configuration","auto":"configuration",
      "per_point":"configuration","penalty":"configuration","order":"order",
      "unit_id":"curriculum","lesson_id":"curriculum"
    }'::jsonb
    when 'scores' then '{"student_id":"identity","item_id":"identity","value":"value"}'::jsonb
    when 'time_profiles' then '{
      "name":"name","order":"order","periods":"configuration","overrides":"configuration",
      "active_from":"activation","active_to":"activation"
    }'::jsonb
    when 'slots' then '{"teaching_id":"identity","weekday":"schedule","period":"schedule"}'::jsonb
    when 'sessions' then '{
      "teaching_id":"identity","date":"identity","period":"identity","slot_id":"linkage",
      "start_time":"timing","end_time":"timing","time_profile_id":"linkage",
      "status":"status","reason":"status","makeup_for_id":"makeup",
      "lesson_id":"content","note":"content","homework":"content","covered":"content"
    }'::jsonb
    when 'attendance' then '{
      "student_id":"identity","session_id":"identity","teaching_id":"identity","date":"identity",
      "status":"status","note":"note"
    }'::jsonb
    when 'logs' then '{
      "student_id":"identity","teaching_id":"identity","session_id":"identity","date":"identity",
      "kind":"event","delta":"event","tag":"event","note":"event"
    }'::jsonb
    when 'calendars' then '{"year_id":"identity","source":"identity","label":"label"}'::jsonb
    when 'calendar_days' then '{
      "calendar_id":"identity","date":"identity","kind":"day","label":"day"
    }'::jsonb
    when 'notes' then '{
      "student_id":"identity","teaching_id":"identity","session_id":"identity",
      "date":"identity","kind":"identity","text":"text"
    }'::jsonb
    when 'session_roster_snapshots' then '{
      "session_id":"identity","teaching_id":"identity","section_id":"identity",
      "captured_at":"snapshot","members":"snapshot","state":"snapshot"
    }'::jsonb
    when 'class_rules' then '{
      "teaching_id":"identity","icon_key":"icon","text":"text"
    }'::jsonb
    else null
  end;
$$;

drop trigger if exists class_rules_sync_v2_revision on rakeezx.class_rules;
create trigger class_rules_sync_v2_revision before insert or update on rakeezx.class_rules
  for each row execute function rakeezx.sync_v2_stamp_revision();

-- A teaching lifecycle tombstone carries its dependent rules with it even if
-- the parent delete reaches the authority from a second device first.
create or replace function rakeezx.tombstone_class_rules_for_teaching()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.deleted_at is not null and old.deleted_at is null then
    update rakeezx.class_rules
       set deleted_at = new.deleted_at,
           client_updated_at = new.client_updated_at,
           device_id = new.device_id
     where owner_id = new.owner_id
       and teaching_id = new.id
       and deleted_at is null;
  end if;
  return new;
end;
$$;

drop trigger if exists teachings_tombstone_class_rules on rakeezx.teachings;
create trigger teachings_tombstone_class_rules
  after update of deleted_at on rakeezx.teachings
  for each row execute function rakeezx.tombstone_class_rules_for_teaching();

commit;
