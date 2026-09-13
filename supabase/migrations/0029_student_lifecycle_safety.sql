-- STUDENT-LIFECYCLE-RUNTIME-HARDENING-01. Additive authority; no data rewrite.
begin;
set local lock_timeout = '10s';

-- Abort atomically on missing/overloaded RPC authority instead of silently
-- installing only part of the serialization boundary on a drifted project.
do $$ declare v_count integer; begin
  select count(*) into v_count from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='rakeezx' and p.prorettype='jsonb'::regtype and p.proname in (
    'apply_sync_v2_mutation','apply_sync_v2_enrollment_command','apply_sync_v2_attendance_command',
    'apply_sync_v2_fill_attendance_command','apply_sync_v2_class_goal_reward_command',
    'apply_sync_v2_closed_term_report_command','apply_sync_v2_lifecycle_command',
    'apply_sync_v2_section_lifecycle_command','apply_sync_v2_session_delete_command',
    'apply_sync_v2_teaching_creation_command','finalize_sync_v2_restore');
  if v_count<>11 then raise exception using errcode='22023',message='MIGRATION_0029_RPC_PRECONDITION_FAILED'; end if;
end $$;

create table rakeezx.student_lifecycle_receipts (
  owner_id uuid not null references auth.users(id) on delete cascade,
  mutation_id text not null check (char_length(mutation_id) between 1 and 200),
  student_id text not null,
  request_envelope jsonb not null,
  result jsonb not null,
  created_at timestamptz not null default clock_timestamp(),
  primary key(owner_id, mutation_id)
);
alter table rakeezx.student_lifecycle_receipts enable row level security;
alter table rakeezx.student_lifecycle_receipts force row level security;
revoke all on rakeezx.student_lifecycle_receipts from public, anon, authenticated;

-- One owner-scoped serialization boundary covers RPCs AND direct row writes.
-- No scan of private records is needed to install this migration.
create function rakeezx.lock_student_lifecycle(p_owner uuid) returns void
language sql volatile security definer set search_path='' as $$
  select pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_owner::text||':student-lifecycle-safety',0));
$$;
revoke all on function rakeezx.lock_student_lifecycle(uuid) from public,anon,authenticated;

-- Pure calendar conversion is testable independently of the session timezone.
-- Only the server supplies clock_timestamp() to lifecycle commands.
create function rakeezx.student_lifecycle_date(p_at timestamptz) returns date
language sql immutable strict set search_path='' as $$
  select (p_at at time zone 'Asia/Riyadh')::date;
$$;
revoke all on function rakeezx.student_lifecycle_date(timestamptz) from public,anon,authenticated;

-- BEFORE STATEMENT runs before UPDATE acquires any tuple lock. A row trigger
-- alone would invert RPC owner->row ordering on direct PostgREST updates.
create function rakeezx.lock_student_lifecycle_statement() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is not null then perform rakeezx.lock_student_lifecycle(auth.uid()); end if;
  return null;
end; $$;
revoke all on function rakeezx.lock_student_lifecycle_statement() from public,anon,authenticated;

-- Include parent tables whose existing triggers write protected children.
-- Excludes Auth, Support and restore staging (which writes no Product rows).
do $$ declare v_table text; begin
  foreach v_table in array array['profile','years','terms','subjects','sections','teachings',
    'students','enrollments','units','lessons','items','scores','time_profiles','slots',
    'sessions','attendance','logs','calendars','calendar_days','notes','class_rules',
    'class_goals','class_charter_selections','group_arrangements','closed_term_reports',
    'session_roster_snapshots','sync_mutation_receipts'] loop
    execute format('create trigger "00_student_lifecycle_statement_lock" before insert or update or delete on rakeezx.%I for each statement execute function rakeezx.lock_student_lifecycle_statement()',v_table);
  end loop;
end $$;

-- Three pre-V2 invoker RPCs also acquire student/section locks. Prepend the
-- owner lock in place, preserving SECURITY INVOKER, RLS, ACLs and signatures.
-- Do not grant callers access to a bypass implementation or arbitrary-owner
-- locking helper. Installation aborts on any unexpected definition.
do $$ declare v_function record; v_body text; v_count integer:=0; begin
  for v_function in select p.oid,p.prosrc,p.prosecdef,pg_get_functiondef(p.oid) definition
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='rakeezx' and p.prorettype='jsonb'::regtype and p.proname in
      ('commit_enrollment_transfer','commit_enrollment_transfer_and_renumber','renumber_enrollment_roster') loop
    if v_function.prosecdef or v_function.prosrc !~ E'\\mbegin\\M' then
      raise exception using errcode='22023',message='MIGRATION_0029_LEGACY_RPC_PRECONDITION_FAILED'; end if;
    v_body:=regexp_replace(v_function.prosrc,E'\\mbegin\\M',
      'begin perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text||'':student-lifecycle-safety'',0));');
    execute replace(v_function.definition,v_function.prosrc,v_body);
    v_count:=v_count+1;
  end loop;
  if v_count<>3 then raise exception using errcode='22023',message='MIGRATION_0029_LEGACY_RPC_PRECONDITION_FAILED'; end if;
end $$;

create function rakeezx.json_references_student(p_json jsonb,p_student text) returns boolean
language sql immutable set search_path='' as $$
  select coalesce(pg_catalog.jsonb_path_exists(p_json,'$.** ? (@ == $student)',
    pg_catalog.jsonb_build_object('student',p_student)),false);
$$;
revoke all on function rakeezx.json_references_student(jsonb,text) from public,anon,authenticated;

create function rakeezx.guard_live_student_parent() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_student text; v_students text[] := '{}'; v_section text;
begin
  -- Match force_owner BEFORE taking a lock or checking parent identity. A
  -- caller-supplied owner must not select another account's safety boundary.
  if tg_op='INSERT' and auth.uid() is not null then new.owner_id:=auth.uid(); end if;
  -- Statement gate / RPC entry already holds the owner lock before row locks.
  if tg_table_name='students' and tg_op='UPDATE' then
    if old.deleted_at is not null and new.deleted_at is null then
      raise exception using errcode='23503',message='STUDENT_TOMBSTONED';
    end if;
    if old.deleted_at is null and new.deleted_at is not null and
      coalesce(current_setting('rakeezx.pristine_student_delete',true),'')<>'on' then
      raise exception using errcode='22023',message='USE_PRISTINE_STUDENT_COMMAND';
    end if;
  end if;
  if tg_table_name in ('enrollments','scores','attendance','logs','notes') then
    if new.deleted_at is not null then return new; end if;
    v_students := array[new.student_id];
  elsif tg_table_name='session_roster_snapshots' then
    -- Snapshot reads and immutable historical members are untouched.
    if tg_op<>'INSERT' or new.deleted_at is not null then return new; end if;
    select coalesce(array_agg(m->>'studentId'),'{}') into v_students
      from pg_catalog.jsonb_array_elements(new.members) m;
  end if;
  foreach v_student in array v_students loop
    if not exists(select 1 from rakeezx.students where owner_id=new.owner_id and id=v_student and deleted_at is null) then
      raise exception using errcode='23503',message='STUDENT_TOMBSTONED',detail='Active child evidence requires a live student';
    end if;
  end loop;
  if tg_table_name in ('logs','attendance') then
  if tg_op='INSERT' and new.deleted_at is null then
    select section_id into v_section from rakeezx.teachings where owner_id=new.owner_id and id=new.teaching_id;
    if exists(select 1 from rakeezx.enrollments where owner_id=new.owner_id and student_id=new.student_id
      and section_id=v_section and status<>'active' and end_date is not null and new.date>=end_date and deleted_at is null)
      and not exists(select 1 from rakeezx.enrollments where owner_id=new.owner_id and student_id=new.student_id
        and section_id=v_section and status='active' and deleted_at is null) then
      raise exception using errcode='23503',message='ENROLLMENT_ENDED';
    end if;
  end if;
  end if;
  return new;
end; $$;
revoke all on function rakeezx.guard_live_student_parent() from public,anon,authenticated;
do $$ declare v_table text; begin
  foreach v_table in array array['students','enrollments','scores','attendance','logs','notes',
    'session_roster_snapshots','closed_term_reports','group_arrangements','class_goals','sync_mutation_receipts'] loop
    execute format('create trigger "00_student_lifecycle_safety" before insert or update on rakeezx.%I for each row execute function rakeezx.guard_live_student_parent()',v_table);
  end loop;
end $$;

-- Acquire the same boundary before existing RPC row/section locks, retaining
-- their arguments/defaults, return values, ownership and idempotency contracts.
do $$ declare v_function record; v_old text; v_call text; begin
  for v_function in select p.oid,p.proname,pg_get_function_arguments(p.oid) args,
      pg_get_function_identity_arguments(p.oid) identity_args,p.proargnames
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='rakeezx' and p.proname in (
      'apply_sync_v2_mutation','apply_sync_v2_enrollment_command','apply_sync_v2_attendance_command',
      'apply_sync_v2_fill_attendance_command','apply_sync_v2_class_goal_reward_command',
      'apply_sync_v2_closed_term_report_command','apply_sync_v2_lifecycle_command',
      'apply_sync_v2_section_lifecycle_command','apply_sync_v2_session_delete_command',
      'apply_sync_v2_teaching_creation_command','finalize_sync_v2_restore') loop
    v_old := v_function.proname||'_before_student_0029';
    select string_agg(quote_ident(a),',') into v_call from unnest(v_function.proargnames) a;
    execute format('alter function rakeezx.%I(%s) rename to %I',v_function.proname,v_function.identity_args,v_old);
    execute format('revoke all on function rakeezx.%I(%s) from public,anon,authenticated',v_old,v_function.identity_args);
    execute format('create function rakeezx.%I(%s) returns jsonb language plpgsql security definer set search_path='''' as $wrapper$ begin
      if auth.uid() is null then raise exception using errcode=''42501'',message=''Authentication required''; end if;
      perform rakeezx.lock_student_lifecycle(auth.uid());
      return rakeezx.%I(%s); end; $wrapper$',v_function.proname,v_function.args,v_old,v_call);
    execute format('revoke all on function rakeezx.%I(%s) from public,anon',v_function.proname,v_function.identity_args);
    execute format('grant execute on function rakeezx.%I(%s) to authenticated',v_function.proname,v_function.identity_args);
  end loop;
end $$;

create function rakeezx.pristine_student_blocker(p_owner uuid,p_student text) returns text
language plpgsql security definer set search_path='' as $$
declare v_student rakeezx.students%rowtype;
begin
  select * into v_student from rakeezx.students where owner_id=p_owner and id=p_student;
  if v_student.status<>'active' then return 'membership-history'; end if;
  if btrim(coalesce(v_student.note,''))<>'' then return 'inline-note'; end if;
  if exists(select 1 from rakeezx.attendance where owner_id=p_owner and student_id=p_student) then return 'attendance'; end if;
  if exists(select 1 from rakeezx.scores where owner_id=p_owner and student_id=p_student) then return 'scores'; end if;
  if exists(select 1 from rakeezx.logs where owner_id=p_owner and student_id=p_student) then return 'logs'; end if;
  if exists(select 1 from rakeezx.notes where owner_id=p_owner and student_id=p_student) then return 'notes'; end if;
  if exists(select 1 from rakeezx.session_roster_snapshots where owner_id=p_owner and
    rakeezx.json_references_student(members,p_student)) then return 'roster-snapshot'; end if;
  if exists(select 1 from rakeezx.closed_term_reports where owner_id=p_owner and
    (rakeezx.json_references_student(source_manifest,p_student) or rakeezx.json_references_student(payload,p_student))) then return 'closed-term-report'; end if;
  if exists(select 1 from rakeezx.group_arrangements where owner_id=p_owner and
    rakeezx.json_references_student(groups,p_student)) then return 'group-arrangement'; end if;
  if (select count(*) from rakeezx.enrollments where owner_id=p_owner and student_id=p_student)>1 or
    exists(select 1 from rakeezx.enrollments e join rakeezx.sections s on s.owner_id=e.owner_id and s.id=e.section_id
      join rakeezx.years y on y.owner_id=s.owner_id and y.id=s.year_id
      where e.owner_id=p_owner and e.student_id=p_student and
        (e.deleted_at is not null or e.status<>'active' or e.end_date is not null or btrim(e.transfer_note)<>'' or
         s.deleted_at is not null or s.status='archived' or y.deleted_at is not null or y.status='archived')) then return 'membership-history'; end if;
  if exists(select 1 from rakeezx.sync_mutation_receipts where owner_id=p_owner and
    ((operation in ('transfer','withdraw') and request_patch->>'studentId'=p_student) or
     (entity='students' and record_id=p_student and
       (btrim(coalesce(request_patch->>'note',''))<>'' or request_patch->>'status'='withdrawn')) or
     (entity='enrollments' and record_id in (select id from rakeezx.enrollments where owner_id=p_owner and student_id=p_student)
       and (request_patch->>'status' in ('transferred','withdrawn','completed') or request_patch->>'end_date' is not null)) or
     (operation='goal_reward' and rakeezx.json_references_student(result,p_student)))) or
    exists(select 1 from rakeezx.student_lifecycle_receipts where owner_id=p_owner and student_id=p_student
      and request_envelope->>'command'='end_enrollment' and result->>'outcome'='applied') then return 'lifecycle-history'; end if;
  -- Submissions are currently local-only, not a server table. The client guard
  -- checks those unsynced records. Do not invent a submissions backend here.
  return null;
end; $$;
revoke all on function rakeezx.pristine_student_blocker(uuid,text) from public,anon,authenticated;

create function rakeezx.apply_student_lifecycle_command(
  p_mutation_id text,p_device_id text,p_command text,p_payload jsonb,p_client_updated_at bigint
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_owner uuid:=auth.uid(); v_student text:=p_payload->>'studentId';
  v_source text:=p_payload->>'sourceEnrollmentId';
  v_expected bigint:=nullif(p_payload->>'sourceRevision','')::bigint;
  v_s rakeezx.students%rowtype; v_e rakeezx.enrollments%rowtype; v_previous rakeezx.student_lifecycle_receipts%rowtype;
  v_envelope jsonb; v_result jsonb; v_rows jsonb; v_sections text[]:='{}';
  v_outcome text:='applied'; v_code text; v_reason text; v_plan jsonb;
  v_date date;
begin
  if v_owner is null then raise exception using errcode='42501',message='Authentication required'; end if;
  if coalesce(p_mutation_id,'')='' or char_length(p_mutation_id)>200 or coalesce(p_device_id,'')='' or char_length(p_device_id)>200 or
    coalesce(v_student,'')='' or p_command is null or p_command not in ('delete_pristine','end_enrollment') or
    jsonb_typeof(p_payload) is distinct from 'object' then
    raise exception using errcode='22023',message='Invalid student lifecycle command'; end if;
  if p_payload ? 'date' then raise exception using errcode='22023',message='IMMEDIATE_ONLY'; end if;
  v_envelope:=jsonb_build_object('mutationId',p_mutation_id,'deviceId',p_device_id,'command',p_command,
    'payload',p_payload,'clientUpdatedAt',p_client_updated_at);
  perform rakeezx.lock_student_lifecycle(v_owner);
  v_date:=rakeezx.student_lifecycle_date(clock_timestamp());
  select * into v_previous from rakeezx.student_lifecycle_receipts where owner_id=v_owner and mutation_id=p_mutation_id;
  if found then
    if v_previous.request_envelope is distinct from v_envelope then
      raise exception using errcode='22023',message='Mutation ID reused with different student lifecycle request'; end if;
    return v_previous.result;
  end if;
  -- Existing enrollment RPCs use this additional student lock as well.
  perform pg_advisory_xact_lock(hashtextextended(v_owner::text||':student:'||v_student,0));
  select * into v_s from rakeezx.students where owner_id=v_owner and id=v_student for update;
  if not found then v_outcome:='rejected'; v_code:='STUDENT_NOT_FOUND';
  elsif v_s.deleted_at is not null then
    v_outcome:=case when p_command='delete_pristine' then 'already_deleted' else 'rejected' end;
    v_code:='STUDENT_TOMBSTONED';
  elsif p_command='delete_pristine' then
    v_reason:=rakeezx.pristine_student_blocker(v_owner,v_student);
    if v_reason is not null then v_outcome:='protected'; v_code:='NOT_PRISTINE';
    else
      select coalesce(array_agg(section_id),'{}') into v_sections from rakeezx.enrollments where owner_id=v_owner and student_id=v_student;
      perform set_config('rakeezx.pristine_student_delete','on',true);
      update rakeezx.enrollments set deleted_at=clock_timestamp(),client_updated_at=p_client_updated_at,device_id=p_device_id
        where owner_id=v_owner and student_id=v_student and deleted_at is null;
      update rakeezx.students set deleted_at=clock_timestamp(),client_updated_at=p_client_updated_at,device_id=p_device_id
        where owner_id=v_owner and id=v_student returning * into v_s;
      perform set_config('rakeezx.pristine_student_delete','off',true);
    end if;
  elsif p_command='end_enrollment' then
    if coalesce(v_source,'')='' or v_expected is null then
      raise exception using errcode='22023',message='Exact source enrollment and revision required'; end if;
    select * into v_e from rakeezx.enrollments where owner_id=v_owner and id=v_source and student_id=v_student for update;
    if not found or v_e.deleted_at is not null or v_e.status<>'active' or v_e.revision<>v_expected then
      v_outcome:='rejected'; v_code:='STALE_SOURCE_ENROLLMENT';
    elsif exists(select 1 from rakeezx.sections where owner_id=v_owner and id=v_e.section_id and (deleted_at is not null or status='archived')) then
      v_outcome:='protected'; v_code:='ARCHIVED_ENROLLMENT';
    else
      v_sections:=array[v_e.section_id];
      update rakeezx.enrollments set status='withdrawn',end_date=v_date,transfer_note=coalesce(p_payload->>'note',''),
        client_updated_at=p_client_updated_at,device_id=p_device_id where owner_id=v_owner and id=v_source;
      if not exists(select 1 from rakeezx.enrollments where owner_id=v_owner and student_id=v_student and status='active' and deleted_at is null) then
        update rakeezx.students set status='withdrawn',client_updated_at=p_client_updated_at,device_id=p_device_id
          where owner_id=v_owner and id=v_student returning * into v_s;
      end if;
    end if;
  end if;
  if cardinality(v_sections)>0 then
    select coalesce(jsonb_agg(jsonb_build_object('id',id,'roll',roll)),'[]') into v_plan from
      (select id,row_number() over(partition by section_id order by roll_no nulls last,id) roll from rakeezx.enrollments
        where owner_id=v_owner and section_id=any(v_sections) and status='active' and deleted_at is null) p;
    update rakeezx.enrollments set roll_no=null where owner_id=v_owner and section_id=any(v_sections) and status='active' and deleted_at is null;
    update rakeezx.enrollments e set roll_no=p.roll,client_updated_at=p_client_updated_at,device_id=p_device_id
      from jsonb_to_recordset(v_plan) as p(id text,roll integer) where e.owner_id=v_owner and e.id=p.id;
  end if;
  select coalesce(jsonb_agg(to_jsonb(e) order by e.id),'[]') into v_rows from rakeezx.enrollments e
    where owner_id=v_owner and (student_id=v_student or section_id=any(v_sections));
  v_result:=jsonb_build_object('mutationId',p_mutation_id,'command',p_command,'outcome',v_outcome,
    'code',v_code,'reason',v_reason,'student',case when v_s.id is null then null else to_jsonb(v_s) end,'enrollments',v_rows);
  insert into rakeezx.student_lifecycle_receipts(owner_id,mutation_id,student_id,request_envelope,result)
    values(v_owner,p_mutation_id,v_student,v_envelope,v_result);
  return v_result;
end; $$;
revoke all on function rakeezx.apply_student_lifecycle_command(text,text,text,jsonb,bigint) from public,anon;
grant execute on function rakeezx.apply_student_lifecycle_command(text,text,text,jsonb,bigint) to authenticated;

-- Prevent legacy offline withdrawal from ending a different current source.
-- Keep the existing V2 protocol and receipt behavior otherwise unchanged.
create or replace function rakeezx.apply_sync_v2_enrollment_command(
  p_mutation_id text,p_device_id text,p_command text,p_payload jsonb,p_client_updated_at bigint default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_e rakeezx.enrollments%rowtype; v_receipt jsonb;
begin
  if auth.uid() is null then raise exception using errcode='42501',message='Authentication required'; end if;
  perform rakeezx.lock_student_lifecycle(auth.uid());
  if p_command='withdraw' and not exists(select 1 from rakeezx.sync_mutation_receipts where owner_id=auth.uid() and mutation_id=p_mutation_id) then
    select * into v_e from rakeezx.enrollments where owner_id=auth.uid() and id=p_payload->>'sourceEnrollmentId'
      and student_id=p_payload->>'studentId' and status='active' and deleted_at is null;
    if not found then raise exception using errcode='22023',message='STALE_SOURCE_ENROLLMENT'; end if;
  end if;
  return rakeezx.apply_sync_v2_enrollment_command_before_student_0029(p_mutation_id,p_device_id,p_command,p_payload,p_client_updated_at);
end; $$;
commit;
