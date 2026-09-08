-- RAKEEZ X — TIMING-SYNC-01: owner-global active Timing Profile selection.
-- Additive only. A null value intentionally means no teacher selection has
-- been made yet; clients use their deterministic stable fallback without
-- copying any legacy device-local choice into this field.
begin;

alter table rakeezx.profile
  add column if not exists active_time_profile_id text;

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
    else null
  end;
$$;

commit;
