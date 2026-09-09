-- RAKEEZ X — CLOSED-TERM-REPORT-01A
-- Immutable, owner-scoped closed-term report truth. The client computes report
-- facts with the Product scoring/report engine; this migration verifies the
-- exact canonical source revision set and commits one complete report set.

set lock_timeout = '10s';

begin;

create table if not exists rakeezx.closed_term_reports (
  id                  text not null check (char_length(id) between 1 and 240),
  owner_id            uuid not null default auth.uid() references auth.users(id) on delete cascade,
  term_id             text not null,
  year_id             text not null,
  version             integer not null check (version >= 1),
  supersedes_id       text,
  source_manifest     jsonb not null check (pg_catalog.jsonb_typeof(source_manifest) = 'array'),
  payload             jsonb not null check (pg_catalog.jsonb_typeof(payload) = 'object'),
  state               text not null default 'complete' check (state = 'complete'),
  created_at          timestamptz not null default pg_catalog.clock_timestamp(),
  client_updated_at   bigint,
  device_id           text not null check (char_length(device_id) between 1 and 200),
  revision            bigint not null default 1 check (revision = 1),
  field_revisions     jsonb not null default '{"snapshot":1}'::jsonb
                        check (field_revisions = '{"snapshot":1}'::jsonb),
  deleted_at          timestamptz check (deleted_at is null),
  primary key (owner_id, id),
  unique (owner_id, term_id, version),
  unique (owner_id, supersedes_id),
  foreign key (owner_id, term_id) references rakeezx.terms(owner_id, id) on delete restrict,
  foreign key (owner_id, year_id) references rakeezx.years(owner_id, id) on delete restrict,
  foreign key (owner_id, supersedes_id) references rakeezx.closed_term_reports(owner_id, id) on delete restrict
);

create index if not exists closed_term_reports_term_idx
  on rakeezx.closed_term_reports (owner_id, term_id, version desc);

create or replace function rakeezx.guard_closed_term_report_immutable()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception using errcode = '22023', message = 'Closed-term report sets are immutable';
end;
$$;
revoke all on function rakeezx.guard_closed_term_report_immutable() from public;

drop trigger if exists closed_term_reports_immutable on rakeezx.closed_term_reports;
create trigger closed_term_reports_immutable
  before update or delete on rakeezx.closed_term_reports
  for each row execute function rakeezx.guard_closed_term_report_immutable();

alter table rakeezx.closed_term_reports enable row level security;
alter table rakeezx.closed_term_reports force row level security;
drop policy if exists closed_term_reports_select on rakeezx.closed_term_reports;
create policy closed_term_reports_select on rakeezx.closed_term_reports
  for select to authenticated using (owner_id = (select auth.uid()));

revoke all on table rakeezx.closed_term_reports from public, anon, authenticated;
grant select on table rakeezx.closed_term_reports to authenticated;

alter table rakeezx.sync_mutation_receipts drop constraint if exists sync_mutation_receipts_operation_check;
alter table rakeezx.sync_mutation_receipts add constraint sync_mutation_receipts_operation_check
  check (operation in ('create','patch','delete','enroll','transfer','withdraw','attendance','lifecycle',
    'create_teaching','fill_attendance','section_lifecycle','close_term_report'));

commit;

begin;

-- The manifest contains every live canonical row that can affect current term
-- reports. Ordering is part of the contract so byte-equivalent JSONB equality
-- is enough; no scoring or report calculation is duplicated in SQL.
create or replace function rakeezx.closed_term_source_manifest(p_owner uuid, p_term_id text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with
  target_term as (
    select * from rakeezx.terms where owner_id = p_owner and id = p_term_id and deleted_at is null
  ),
  target_teachings as (
    select * from rakeezx.teachings where owner_id = p_owner and term_id = p_term_id and deleted_at is null
  ),
  target_sections as (
    select s.* from rakeezx.sections s where s.owner_id = p_owner and s.deleted_at is null
      and exists (select 1 from target_teachings t where t.section_id = s.id)
  ),
  target_subjects as (
    select s.* from rakeezx.subjects s where s.owner_id = p_owner and s.deleted_at is null
      and exists (select 1 from target_teachings t where t.subject_id = s.id)
  ),
  target_items as (
    select i.* from rakeezx.items i where i.owner_id = p_owner and i.deleted_at is null
      and exists (select 1 from target_teachings t where t.id = i.teaching_id)
  ),
  target_sessions as (
    select s.* from rakeezx.sessions s where s.owner_id = p_owner and s.deleted_at is null
      and exists (select 1 from target_teachings t where t.id = s.teaching_id)
  ),
  target_enrollments as (
    select e.* from rakeezx.enrollments e where e.owner_id = p_owner and e.deleted_at is null
      and exists (select 1 from target_sections s where s.id = e.section_id)
  ),
  target_scores as (
    select s.* from rakeezx.scores s where s.owner_id = p_owner and s.deleted_at is null
      and exists (select 1 from target_items i where i.id = s.item_id)
  ),
  target_snapshots as (
    select s.* from rakeezx.session_roster_snapshots s where s.owner_id = p_owner and s.deleted_at is null
      and exists (select 1 from target_sessions se where se.id = s.session_id)
  ),
  target_attendance as (
    select a.* from rakeezx.attendance a where a.owner_id = p_owner and a.deleted_at is null
      and exists (select 1 from target_sessions s where s.id = a.session_id)
  ),
  target_logs as (
    select l.* from rakeezx.logs l where l.owner_id = p_owner and l.deleted_at is null
      and exists (select 1 from target_teachings t where t.id = l.teaching_id)
  ),
  target_notes as (
    select n.* from rakeezx.notes n where n.owner_id = p_owner and n.deleted_at is null and (
      exists (select 1 from target_teachings t where t.id = n.teaching_id) or
      exists (select 1 from target_sessions s where s.id = n.session_id)
    )
  ),
  target_students as (
    select s.* from rakeezx.students s where s.owner_id = p_owner and s.deleted_at is null and (
      exists (select 1 from target_enrollments e where e.student_id = s.id) or
      exists (select 1 from target_scores sc where sc.student_id = s.id) or
      exists (select 1 from target_attendance a where a.student_id = s.id) or
      exists (select 1 from target_logs l where l.student_id = s.id) or
      exists (select 1 from target_notes n where n.student_id = s.id) or
      exists (select 1 from target_snapshots rs, lateral pg_catalog.jsonb_array_elements(rs.members) member
        where member ->> 'studentId' = s.id)
    )
  ),
  source_rows(entity, id, revision) as (
    select 'profile', 'profile', p.revision from rakeezx.profile p where p.owner_id = p_owner and p.deleted_at is null
    union all select 'years', y.id, y.revision from rakeezx.years y join target_term t on t.year_id = y.id where y.owner_id = p_owner and y.deleted_at is null
    union all select 'terms', id, revision from target_term
    union all select 'teachings', id, revision from target_teachings
    union all select 'sections', id, revision from target_sections
    union all select 'subjects', id, revision from target_subjects
    union all select 'students', id, revision from target_students
    union all select 'enrollments', id, revision from target_enrollments
    union all select 'items', id, revision from target_items
    union all select 'scores', id, revision from target_scores
    union all select 'sessions', id, revision from target_sessions
    union all select 'session_roster_snapshots', id, revision from target_snapshots
    union all select 'attendance', id, revision from target_attendance
    union all select 'logs', id, revision from target_logs
    union all select 'notes', id, revision from target_notes
  )
  select coalesce(pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object('entity', entity, 'id', id, 'revision', revision)
    order by entity, id
  ), '[]'::jsonb) from source_rows;
$$;
revoke all on function rakeezx.closed_term_source_manifest(uuid,text) from public, anon, authenticated;

create or replace function rakeezx.guard_closed_term_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'closed' and pg_catalog.to_jsonb(new) is distinct from pg_catalog.to_jsonb(old) then
    raise exception using errcode = '22023', message = 'Closed term is immutable';
  end if;
  if old.status <> 'closed' and new.status = 'closed' and
     coalesce(pg_catalog.current_setting('rakeezx.closed_term_report_write',true),'') <> 'on' then
    raise exception using errcode = '22023', message = 'Term closure requires its report command';
  end if;
  return new;
end;
$$;
revoke all on function rakeezx.guard_closed_term_lifecycle() from public;
drop trigger if exists guard_closed_term_lifecycle on rakeezx.terms;
create trigger guard_closed_term_lifecycle before update on rakeezx.terms
  for each row execute function rakeezx.guard_closed_term_lifecycle();

create or replace function rakeezx.apply_sync_v2_closed_term_report_command(
  p_mutation_id text,
  p_device_id text,
  p_command text,
  p_term_id text,
  p_report_id text,
  p_supersedes_id text default null,
  p_source_manifest jsonb default '[]'::jsonb,
  p_payload jsonb default '{}'::jsonb,
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
  v_term rakeezx.terms%rowtype;
  v_report rakeezx.closed_term_reports%rowtype;
  v_previous rakeezx.closed_term_reports%rowtype;
  v_version integer;
  v_teaching_ids jsonb;
  v_payload_teaching_ids jsonb;
  v_normalized_manifest jsonb;
  v_envelope jsonb;
  v_result jsonb;
begin
  if v_owner is null then raise exception using errcode = '42501', message = 'Authentication required'; end if;
  if coalesce(p_mutation_id,'') = '' or char_length(p_mutation_id) > 200 or
     coalesce(p_device_id,'') = '' or char_length(p_device_id) > 200 or
     coalesce(p_term_id,'') = '' or coalesce(p_report_id,'') = '' or
     p_command not in ('close','correct') or
     p_source_manifest is null or pg_catalog.jsonb_typeof(p_source_manifest) <> 'array' or
     p_payload is null or pg_catalog.jsonb_typeof(p_payload) <> 'object' then
    raise exception using errcode = '22023', message = 'Invalid closed-term report command';
  end if;

  v_envelope := pg_catalog.jsonb_build_object(
    'mutationId',p_mutation_id,'deviceId',p_device_id,'command',p_command,'termId',p_term_id,
    'reportId',p_report_id,'supersedesId',p_supersedes_id,'sourceManifest',p_source_manifest,
    'payload',p_payload,'clientUpdatedAt',p_client_updated_at
  );
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_owner::text||':sync-v2:'||p_mutation_id,0));
  select * into v_receipt from rakeezx.sync_mutation_receipts
    where owner_id = v_owner and mutation_id = p_mutation_id;
  if found then
    if v_receipt.request_envelope is distinct from v_envelope then
      raise exception using errcode = '22023', message = 'Mutation ID was reused with a different request';
    end if;
    return v_receipt.result;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_owner::text||':closed-term:'||p_term_id,0));
  select * into v_term from rakeezx.terms where owner_id = v_owner and id = p_term_id for update;
  if not found or v_term.deleted_at is not null then raise exception using errcode = '22023', message = 'Term is unavailable'; end if;

  if p_command = 'close' then
    if v_term.status = 'closed' then raise exception using errcode = '22023', message = 'Legacy closed term cannot be backfilled automatically'; end if;
    if p_supersedes_id is not null or exists(select 1 from rakeezx.closed_term_reports where owner_id=v_owner and term_id=p_term_id) then
      raise exception using errcode = '22023', message = 'Closed-term report set already exists';
    end if;
    v_version := 1;
  else
    if v_term.status <> 'closed' or p_supersedes_id is null then
      raise exception using errcode = '22023', message = 'Correction requires a closed term and prior version';
    end if;
    select * into v_previous from rakeezx.closed_term_reports
      where owner_id=v_owner and id=p_supersedes_id and term_id=p_term_id and state='complete';
    if not found or exists(select 1 from rakeezx.closed_term_reports where owner_id=v_owner and supersedes_id=p_supersedes_id) then
      raise exception using errcode = '22023', message = 'Correction must supersede the current retained version';
    end if;
    if exists(select 1 from rakeezx.closed_term_reports newer where newer.owner_id=v_owner and newer.term_id=p_term_id and newer.version>v_previous.version) then
      raise exception using errcode = '22023', message = 'Correction must supersede the latest version';
    end if;
    v_version := v_previous.version + 1;
  end if;

  select coalesce(pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object('entity',entry->>'entity','id',entry->>'id','revision',(entry->>'revision')::bigint)
    order by entry->>'entity',entry->>'id'
  ),'[]'::jsonb) into v_normalized_manifest
  from pg_catalog.jsonb_array_elements(p_source_manifest) entry
  where pg_catalog.jsonb_typeof(entry)='object' and entry ?& array['entity','id','revision'];
  if pg_catalog.jsonb_array_length(v_normalized_manifest) <> pg_catalog.jsonb_array_length(p_source_manifest) or
     rakeezx.closed_term_source_manifest(v_owner,p_term_id) is distinct from v_normalized_manifest then
    v_result := pg_catalog.jsonb_build_object('mutationId',p_mutation_id,'command',p_command,
      'outcome','rejected_source_changed','term',pg_catalog.to_jsonb(v_term));
    insert into rakeezx.sync_mutation_receipts(owner_id,mutation_id,entity,record_id,device_id,base_revision,operation,
      client_updated_at,request_patch,request_envelope,outcome,applied_groups,conflicted_groups,result)
    values(v_owner,p_mutation_id,'closed_term_reports',p_report_id,p_device_id,v_term.revision,'close_term_report',
      p_client_updated_at,'{}'::jsonb,v_envelope,'rejected_source_changed',array[]::text[],array['snapshot']::text[],v_result);
    return v_result;
  end if;
  if coalesce((p_payload->>'schemaVersion')::integer,0) <> 1 or p_payload#>>'{identity,term,id}' is distinct from p_term_id or
     pg_catalog.jsonb_typeof(p_payload->'teachingDocuments') <> 'array' or
     pg_catalog.jsonb_typeof(p_payload->'executionDocument') <> 'object' then
    raise exception using errcode = '22023', message = 'Closed-term report payload is incomplete';
  end if;
  select coalesce(pg_catalog.jsonb_agg(id order by id),'[]'::jsonb) into v_teaching_ids
    from rakeezx.teachings where owner_id=v_owner and term_id=p_term_id and deleted_at is null;
  select coalesce(pg_catalog.jsonb_agg(id order by id),'[]'::jsonb) into v_payload_teaching_ids
    from (select document#>>'{teaching,id}' id from pg_catalog.jsonb_array_elements(p_payload->'teachingDocuments') document) payload_ids;
  if v_payload_teaching_ids is distinct from v_teaching_ids then
    raise exception using errcode = '22023', message = 'Closed-term report teaching set is incomplete';
  end if;

  if p_command = 'close' then
    perform pg_catalog.set_config('rakeezx.closed_term_report_write','on',true);
    update rakeezx.terms set status='closed',client_updated_at=p_client_updated_at,device_id=p_device_id
      where owner_id=v_owner and id=p_term_id returning * into v_term;
  end if;
  insert into rakeezx.closed_term_reports(owner_id,id,term_id,year_id,version,supersedes_id,source_manifest,payload,
    state,client_updated_at,device_id)
  values(v_owner,p_report_id,p_term_id,v_term.year_id,v_version,p_supersedes_id,p_source_manifest,p_payload,
    'complete',p_client_updated_at,p_device_id)
  returning * into v_report;

  v_result := pg_catalog.jsonb_build_object('mutationId',p_mutation_id,'command',p_command,'outcome','complete',
    'report',pg_catalog.to_jsonb(v_report),'term',pg_catalog.to_jsonb(v_term));
  insert into rakeezx.sync_mutation_receipts(owner_id,mutation_id,entity,record_id,device_id,base_revision,operation,
    client_updated_at,request_patch,request_envelope,outcome,applied_groups,conflicted_groups,result_revision,canonical,result)
  values(v_owner,p_mutation_id,'closed_term_reports',p_report_id,p_device_id,v_term.revision,'close_term_report',
    p_client_updated_at,'{}'::jsonb,v_envelope,'complete',array['snapshot']::text[],array[]::text[],1,
    pg_catalog.to_jsonb(v_report),v_result);
  return v_result;
end;
$$;

revoke all on function rakeezx.apply_sync_v2_closed_term_report_command(text,text,text,text,text,text,jsonb,jsonb,bigint)
  from public, anon;
grant execute on function rakeezx.apply_sync_v2_closed_term_report_command(text,text,text,text,text,text,jsonb,jsonb,bigint)
  to authenticated;

commit;
