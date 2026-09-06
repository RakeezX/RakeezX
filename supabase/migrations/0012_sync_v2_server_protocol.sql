-- RAKEEZ X — SYNC-V2A: additive server protocol foundation.
--
-- This migration builds the server authority for a controlled clean V2
-- cutover. It does not itself switch the Production client or revoke current
-- writes; that happens only in the final maintenance phase. No mixed-client
-- reconciliation contract is provided or required.

set lock_timeout = '10s';

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
      "report_principal_name":"report_principal_name"
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

create or replace function rakeezx.sync_v2_initial_field_revisions(p_entity text, p_revision bigint)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select coalesce(pg_catalog.jsonb_object_agg(groups.group_name, p_revision), '{}'::jsonb)
  from (
    select distinct entry.value #>> '{}' as group_name
    from pg_catalog.jsonb_each(rakeezx.sync_v2_field_map(p_entity)) as entry
  ) groups;
$$;

-- Returns the Product-approved logical identity for create canonicalization.
-- NULL deliberately means that duplicate-looking values are valid and only the
-- durable record id identifies the entity (students, notes, items, logs and
-- timing profiles). Values are JSON arrays so boundaries and types are
-- unambiguous; no delimiter-concatenated identity is exposed to callers.
create or replace function rakeezx.sync_v2_natural_key(p_entity text, p_record jsonb)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
begin
  case p_entity
    when 'years' then
      if p_record ->> 'hijri_start' is null then return null; end if;
      return pg_catalog.jsonb_build_array((p_record ->> 'hijri_start')::integer);
    when 'calendars' then
      if p_record ->> 'year_id' is null then return null; end if;
      return pg_catalog.jsonb_build_array(p_record ->> 'year_id', coalesce(p_record ->> 'source', 'custom'));
    when 'calendar_days' then
      if p_record ->> 'calendar_id' is null or p_record ->> 'date' is null then return null; end if;
      return pg_catalog.jsonb_build_array(p_record ->> 'calendar_id', p_record ->> 'date');
    when 'terms' then
      if p_record ->> 'year_id' is null or p_record ->> 'index' is null then return null; end if;
      return pg_catalog.jsonb_build_array(p_record ->> 'year_id', (p_record ->> 'index')::integer);
    when 'subjects' then
      if p_record ->> 'slug' is null then return null; end if;
      return pg_catalog.jsonb_build_array(p_record ->> 'slug');
    when 'sections' then
      if p_record ->> 'year_id' is null or p_record ->> 'grade' is null or p_record ->> 'label' is null then return null; end if;
      return pg_catalog.jsonb_build_array(
        p_record ->> 'year_id', (p_record ->> 'grade')::integer,
        rakeezx.normalize_section_label(p_record ->> 'label')
      );
    when 'teachings' then
      if p_record ->> 'section_id' is null or p_record ->> 'subject_id' is null or p_record ->> 'term_id' is null then return null; end if;
      return pg_catalog.jsonb_build_array(p_record ->> 'section_id', p_record ->> 'subject_id', p_record ->> 'term_id');
    when 'enrollments' then
      if p_record ->> 'student_id' is null or p_record ->> 'section_id' is null then return null; end if;
      return pg_catalog.jsonb_build_array(p_record ->> 'student_id', p_record ->> 'section_id');
    when 'scores' then
      if p_record ->> 'student_id' is null or p_record ->> 'item_id' is null then return null; end if;
      return pg_catalog.jsonb_build_array(p_record ->> 'student_id', p_record ->> 'item_id');
    when 'slots' then
      if p_record ->> 'weekday' is null or p_record ->> 'period' is null then return null; end if;
      return pg_catalog.jsonb_build_array((p_record ->> 'weekday')::integer, (p_record ->> 'period')::integer);
    when 'sessions' then
      if p_record ->> 'teaching_id' is null or p_record ->> 'date' is null or p_record ->> 'period' is null then return null; end if;
      return pg_catalog.jsonb_build_array(
        p_record ->> 'teaching_id', p_record ->> 'date', (p_record ->> 'period')::integer
      );
    when 'session_roster_snapshots' then
      if p_record ->> 'session_id' is null then return null; end if;
      return pg_catalog.jsonb_build_array(p_record ->> 'session_id');
    when 'attendance' then
      if p_record ->> 'student_id' is null or p_record ->> 'session_id' is null then return null; end if;
      return pg_catalog.jsonb_build_array(p_record ->> 'student_id', p_record ->> 'session_id');
    else
      return null;
  end case;
end;
$$;

-- Sections and recurring schedule positions can be recreated after deletion;
-- their current uniqueness contracts intentionally ignore tombstones. Other
-- natural identities remain occupied by the historical row.
create or replace function rakeezx.sync_v2_natural_key_reusable_after_delete(p_entity text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_entity in ('sections', 'slots');
$$;

commit;

-- Apply the same additive metadata to every family currently listed in the
-- Production client's SYNCABLE_STORES set. Units and lessons are deliberately
-- absent because the current client does not sync them.
begin;

do $$
declare
  v_entity text;
begin
  foreach v_entity in array array[
    'profile','years','terms','subjects','sections','teachings','students','enrollments',
    'items','scores','time_profiles','slots','sessions','attendance','logs','calendars',
    'calendar_days','notes','session_roster_snapshots'
  ] loop
    execute pg_catalog.format(
      'alter table rakeezx.%I add column if not exists revision bigint not null default 1 check (revision >= 1)',
      v_entity
    );
    execute pg_catalog.format(
      'alter table rakeezx.%I add column if not exists field_revisions jsonb not null default ''{}''::jsonb check (pg_catalog.jsonb_typeof(field_revisions) = ''object'')',
      v_entity
    );
    -- This is protocol metadata initialization, not a domain edit. Suppress the
    -- existing server timestamp trigger so migration does not make every row
    -- appear freshly changed to legacy diagnostics/pull cursors.
    execute pg_catalog.format('alter table rakeezx.%I disable trigger %I', v_entity, v_entity || '_touch');
    execute pg_catalog.format(
      'update rakeezx.%I set field_revisions = rakeezx.sync_v2_initial_field_revisions($1, revision) where field_revisions = ''{}''::jsonb',
      v_entity
    ) using v_entity;
    execute pg_catalog.format('alter table rakeezx.%I enable trigger %I', v_entity, v_entity || '_touch');
  end loop;
end;
$$;

-- One teacher cannot own two active recurring slots at the same weekday and
-- period, regardless of teaching. This is already the Production runtime rule;
-- the partial index makes competing V2 creates deterministic at the authority.
alter table rakeezx.slots drop constraint if exists slots_natural_uniq;
create unique index if not exists slots_active_schedule_uniq
  on rakeezx.slots (owner_id, weekday, period)
  where deleted_at is null;

commit;

-- One trigger owns authoritative revision assignment. Client-supplied revision
-- values are ignored. Business-field revisions advance only for groups whose
-- actual values changed; metadata-only writes stay revision-silent. Tombstones
-- are immutable through every generic row update.
begin;

create or replace function rakeezx.sync_v2_stamp_revision()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_field_map jsonb := rakeezx.sync_v2_field_map(tg_table_name);
  v_field text;
  v_group text;
  v_next_revision bigint;
  v_revisions jsonb;
  v_changed boolean := false;
begin
  if tg_op = 'INSERT' then
    new.revision := 1;
    new.field_revisions := rakeezx.sync_v2_initial_field_revisions(tg_table_name, 1);
    if new.deleted_at is not null then
      new.field_revisions := pg_catalog.jsonb_set(
        new.field_revisions, array['__deleted__'], '1'::jsonb, true
      );
    end if;
    return new;
  end if;

  -- A tombstone is immutable through every generic write path. Returning NULL
  -- skips the row update entirely, including metadata churn. A future restore
  -- requires a separate validated command rather than an UPDATE bypass.
  if old.deleted_at is not null then
    return null;
  end if;

  v_next_revision := old.revision + 1;
  v_revisions := coalesce(old.field_revisions, '{}'::jsonb);
  for v_field, v_group in
    select entry.key, entry.value #>> '{}'
    from pg_catalog.jsonb_each(v_field_map) as entry
  loop
    if (pg_catalog.to_jsonb(new) -> v_field) is distinct from (pg_catalog.to_jsonb(old) -> v_field) then
      v_changed := true;
      v_revisions := pg_catalog.jsonb_set(v_revisions, array[v_group], pg_catalog.to_jsonb(v_next_revision), true);
    end if;
  end loop;
  if new.deleted_at is distinct from old.deleted_at then
    v_changed := true;
    v_revisions := pg_catalog.jsonb_set(v_revisions, array['__deleted__'], pg_catalog.to_jsonb(v_next_revision), true);
  end if;

  -- The server revision describes domain mutations, not device/timestamp
  -- bookkeeping. Preserve the current revision for an identical/no-op patch.
  if not v_changed then
    new.revision := old.revision;
    new.field_revisions := old.field_revisions;
    return new;
  end if;

  new.revision := v_next_revision;
  new.field_revisions := v_revisions;
  return new;
end;
$$;

do $$
declare
  v_entity text;
begin
  foreach v_entity in array array[
    'profile','years','terms','subjects','sections','teachings','students','enrollments',
    'items','scores','time_profiles','slots','sessions','attendance','logs','calendars',
    'calendar_days','notes','session_roster_snapshots'
  ] loop
    execute pg_catalog.format('drop trigger if exists %I on rakeezx.%I', v_entity || '_sync_v2_revision', v_entity);
    execute pg_catalog.format(
      'create trigger %I before insert or update on rakeezx.%I for each row execute function rakeezx.sync_v2_stamp_revision()',
      v_entity || '_sync_v2_revision', v_entity
    );
  end loop;
end;
$$;

commit;

-- Receipts are immutable protocol evidence. request_patch preserves rejected
-- same-field intent without introducing a conflict-management UI in V2A.
begin;

create table if not exists rakeezx.sync_mutation_receipts (
  owner_id           uuid not null default auth.uid() references auth.users(id) on delete cascade,
  mutation_id        text not null check (char_length(mutation_id) between 1 and 200),
  entity              text not null,
  record_id           text not null,
  device_id           text not null check (char_length(device_id) between 1 and 200),
  base_revision       bigint not null check (base_revision >= 0),
  operation           text not null check (operation in ('create','patch','delete')),
  client_updated_at   bigint,
  request_patch       jsonb not null default '{}'::jsonb check (pg_catalog.jsonb_typeof(request_patch) = 'object'),
  request_envelope    jsonb not null check (pg_catalog.jsonb_typeof(request_envelope) = 'object'),
  outcome             text not null,
  applied_groups      text[] not null default '{}',
  conflicted_groups   text[] not null default '{}',
  result_revision     bigint,
  canonical           jsonb,
  result              jsonb not null,
  created_at          timestamptz not null default pg_catalog.now(),
  primary key (owner_id, mutation_id)
);

create index if not exists sync_mutation_receipts_record_idx
  on rakeezx.sync_mutation_receipts (owner_id, entity, record_id, created_at desc);

alter table rakeezx.sync_mutation_receipts enable row level security;
alter table rakeezx.sync_mutation_receipts force row level security;
drop policy if exists sync_mutation_receipts_select on rakeezx.sync_mutation_receipts;
create policy sync_mutation_receipts_select on rakeezx.sync_mutation_receipts
  for select to authenticated using (owner_id = (select auth.uid()));

revoke all on rakeezx.sync_mutation_receipts from public;
revoke insert, update, delete on rakeezx.sync_mutation_receipts from authenticated;
grant select on rakeezx.sync_mutation_receipts to authenticated;

commit;

begin;

create or replace function rakeezx.apply_sync_v2_mutation(
  p_entity text,
  p_record_id text,
  p_mutation_id text,
  p_device_id text,
  p_base_revision bigint,
  p_patch jsonb default '{}'::jsonb,
  p_operation text default 'patch',
  p_client_updated_at bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_field_map jsonb := rakeezx.sync_v2_field_map(p_entity);
  v_receipt rakeezx.sync_mutation_receipts%rowtype;
  v_request_envelope jsonb;
  v_row jsonb;
  v_revision bigint;
  v_field_revisions jsonb;
  v_deleted_at timestamptz;
  v_field text;
  v_group text;
  v_requested_groups text[] := '{}'::text[];
  v_conflicted_groups text[] := '{}'::text[];
  v_applied_groups text[] := '{}'::text[];
  v_effective_patch jsonb := '{}'::jsonb;
  v_set_list text := '';
  v_column_list text := '';
  v_value_list text := '';
  v_sql text;
  v_outcome text;
  v_result jsonb;
  v_natural_key jsonb;
  v_identity_lock text;
  v_natural_lookup_sql text;
  v_canonicalized boolean := false;
  v_create_raced boolean := false;
begin
  if v_owner is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;
  if v_field_map is null then
    raise exception using errcode = '22023', message = 'Unknown sync entity';
  end if;
  if coalesce(p_record_id, '') = '' or coalesce(p_mutation_id, '') = '' or
      char_length(p_mutation_id) > 200 or coalesce(p_device_id, '') = '' or
      char_length(p_device_id) > 200 or p_base_revision is null or p_base_revision < 0 or
      p_operation is null or p_operation not in ('create','patch','delete') or
      p_patch is null or pg_catalog.jsonb_typeof(p_patch) <> 'object' then
    raise exception using errcode = '22023', message = 'Invalid sync mutation envelope';
  end if;
  if p_entity = 'profile' and p_record_id <> 'profile' then
    raise exception using errcode = '22023', message = 'Profile record identity must be profile';
  end if;
  if p_operation = 'delete' and p_patch <> '{}'::jsonb then
    raise exception using errcode = '22023', message = 'Delete mutation cannot include a field patch';
  end if;
  if p_operation = 'create' and p_base_revision <> 0 then
    raise exception using errcode = '22023', message = 'Create mutation base revision must be zero';
  end if;

  for v_field in select pg_catalog.jsonb_object_keys(p_patch)
  loop
    v_group := v_field_map ->> v_field;
    if v_group is null then
      raise exception using errcode = '22023', message = 'Field is not allowed for this sync entity: ' || v_field;
    end if;
    if not v_group = any(v_requested_groups) then
      v_requested_groups := pg_catalog.array_append(v_requested_groups, v_group);
    end if;
  end loop;

  v_request_envelope := pg_catalog.jsonb_build_object(
    'entity', p_entity,
    'recordId', p_record_id,
    'mutationId', p_mutation_id,
    'deviceId', p_device_id,
    'baseRevision', p_base_revision,
    'operation', p_operation,
    'patch', p_patch,
    'clientUpdatedAt', p_client_updated_at
  );

  -- A mutation-id lock closes the retry race before the receipt exists.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_owner::text || ':sync-v2:' || p_mutation_id, 0)
  );
  select * into v_receipt
  from rakeezx.sync_mutation_receipts
  where owner_id = v_owner and mutation_id = p_mutation_id;
  if found then
    if v_receipt.request_envelope is distinct from v_request_envelope then
      raise exception using errcode = '22023', message = 'Mutation ID was reused with a different request';
    end if;
    return v_receipt.result;
  end if;

  -- Competing creates serialize on the Product natural identity where one is
  -- defined, otherwise on the durable requested id. This is independent from
  -- mutationId so three or more devices converge on the same canonical row.
  if p_operation = 'create' then
    if p_entity <> 'profile' then
      v_natural_key := rakeezx.sync_v2_natural_key(p_entity, p_patch);
    end if;
    v_identity_lock := case
      when p_entity = 'profile' then 'profile'
      when v_natural_key is not null then 'natural:' || v_natural_key::text
      else 'id:' || p_record_id
    end;
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(v_owner::text || ':sync-v2-create:' || p_entity || ':' || v_identity_lock, 0)
    );
  end if;

  if p_entity = 'profile' then
    execute 'select pg_catalog.to_jsonb(t), t.revision, t.field_revisions, t.deleted_at
             from rakeezx.profile t where t.owner_id = $1 for update'
      into v_row, v_revision, v_field_revisions, v_deleted_at using v_owner;
  else
    v_sql := pg_catalog.format(
      'select pg_catalog.to_jsonb(t), t.revision, t.field_revisions, t.deleted_at
       from rakeezx.%I t where t.owner_id = $1 and t.id = $2 for update', p_entity
    );
    execute v_sql into v_row, v_revision, v_field_revisions, v_deleted_at using v_owner, p_record_id;
  end if;

  if v_row is null and p_operation = 'create' and v_natural_key is not null then
    v_natural_lookup_sql := pg_catalog.format(
      'select pg_catalog.to_jsonb(t), t.revision, t.field_revisions, t.deleted_at
       from rakeezx.%I t
       where t.owner_id = $1
         and rakeezx.sync_v2_natural_key($2, pg_catalog.to_jsonb(t)) = $3
         and (not $4 or t.deleted_at is null)
       order by (t.deleted_at is null) desc, t.created_at, t.id
       limit 1 for update', p_entity
    );
    execute v_natural_lookup_sql
      into v_row, v_revision, v_field_revisions, v_deleted_at
      using v_owner, p_entity, v_natural_key, rakeezx.sync_v2_natural_key_reusable_after_delete(p_entity);
    v_canonicalized := v_row is not null;
  end if;

  if v_row is null then
    if p_operation <> 'create' then
      v_outcome := 'not_found';
      v_conflicted_groups := array['__record__'];
    else
      for v_field in select pg_catalog.jsonb_object_keys(p_patch) order by 1
      loop
        v_column_list := v_column_list || pg_catalog.format(', %I', v_field);
        v_value_list := v_value_list || pg_catalog.format(', p.%I', v_field);
      end loop;
      begin
        if p_entity = 'profile' then
          v_sql := pg_catalog.format(
            'with inserted as (
               insert into rakeezx.%I (owner_id, device_id, client_updated_at%s)
               select $1, $2, $3%s from pg_catalog.jsonb_populate_record(null::rakeezx.%I, $4) p
               returning *
             ) select pg_catalog.to_jsonb(inserted) from inserted',
            p_entity, v_column_list, v_value_list, p_entity
          );
          execute v_sql into v_row using v_owner, p_device_id, p_client_updated_at, p_patch;
        else
          v_sql := pg_catalog.format(
            'with inserted as (
               insert into rakeezx.%I (owner_id, id, device_id, client_updated_at%s)
               select $1, $2, $3, $4%s from pg_catalog.jsonb_populate_record(null::rakeezx.%I, $5) p
               returning *
             ) select pg_catalog.to_jsonb(inserted) from inserted',
            p_entity, v_column_list, v_value_list, p_entity
          );
          execute v_sql into v_row using v_owner, p_record_id, p_device_id, p_client_updated_at, p_patch;
        end if;
      exception when unique_violation then
        if v_natural_lookup_sql is null then raise; end if;
        execute v_natural_lookup_sql
          into v_row, v_revision, v_field_revisions, v_deleted_at
          using v_owner, p_entity, v_natural_key, rakeezx.sync_v2_natural_key_reusable_after_delete(p_entity);
        if v_row is null then raise; end if;
        v_create_raced := true;
      end;

      if v_create_raced then
        v_canonicalized := true;
        if v_deleted_at is not null then
          v_outcome := 'tombstoned';
          v_conflicted_groups := array['__deleted__'];
        else
          v_outcome := 'canonicalized';
          v_conflicted_groups := array['__canonical__'];
        end if;
      else
        v_revision := (v_row ->> 'revision')::bigint;
        v_applied_groups := v_requested_groups;
        v_outcome := 'applied';
      end if;
    end if;
  else
    if p_base_revision > v_revision then
      raise exception using errcode = '22023', message = 'Mutation base revision is ahead of the server';
    end if;

    if v_canonicalized and v_deleted_at is not null then
      v_outcome := 'tombstoned';
      v_conflicted_groups := array['__deleted__'];
    elsif v_canonicalized then
      v_outcome := 'canonicalized';
      v_conflicted_groups := array['__canonical__'];
    elsif v_deleted_at is not null and p_operation <> 'delete' then
      v_outcome := 'tombstoned';
      v_conflicted_groups := array['__deleted__'];
    elsif p_operation = 'create' then
      v_outcome := 'conflict';
      v_conflicted_groups := array['__record__'];
    elsif p_operation = 'delete' then
      if v_deleted_at is null then
        if p_entity = 'profile' then
          execute 'with updated as (
                     update rakeezx.profile t
                     set deleted_at = pg_catalog.clock_timestamp(), device_id = $1, client_updated_at = $2
                     where t.owner_id = $3 returning *
                   ) select pg_catalog.to_jsonb(updated) from updated'
            into v_row using p_device_id, p_client_updated_at, v_owner;
        else
          v_sql := pg_catalog.format(
            'with updated as (
               update rakeezx.%I t
               set deleted_at = pg_catalog.clock_timestamp(), device_id = $1, client_updated_at = $2
               where t.owner_id = $3 and t.id = $4 returning *
             ) select pg_catalog.to_jsonb(updated) from updated', p_entity
          );
          execute v_sql into v_row using p_device_id, p_client_updated_at, v_owner, p_record_id;
        end if;
        v_revision := (v_row ->> 'revision')::bigint;
        v_applied_groups := array['__deleted__'];
        v_outcome := 'deleted';
      else
        v_outcome := 'already_deleted';
      end if;
    elsif p_entity in ('logs','session_roster_snapshots') then
      v_outcome := 'conflict';
      v_conflicted_groups := array['__immutable__'];
    else
      foreach v_group in array v_requested_groups
      loop
        if coalesce((v_field_revisions ->> v_group)::bigint, 1) > p_base_revision then
          v_conflicted_groups := pg_catalog.array_append(v_conflicted_groups, v_group);
        else
          v_applied_groups := pg_catalog.array_append(v_applied_groups, v_group);
        end if;
      end loop;

      for v_field in select pg_catalog.jsonb_object_keys(p_patch) order by 1
      loop
        v_group := v_field_map ->> v_field;
        if not v_group = any(v_conflicted_groups) then
          v_effective_patch := v_effective_patch || pg_catalog.jsonb_build_object(v_field, p_patch -> v_field);
          if v_set_list <> '' then v_set_list := v_set_list || ', '; end if;
          v_set_list := v_set_list || pg_catalog.format(
            '%I = (select p.%I from pg_catalog.jsonb_populate_record(null::rakeezx.%I, $1) p)',
            v_field, v_field, p_entity
          );
        end if;
      end loop;

      if v_effective_patch <> '{}'::jsonb then
        v_set_list := v_set_list || ', device_id = $2, client_updated_at = $3';
        if p_entity = 'profile' then
          v_sql := 'with updated as (
                      update rakeezx.profile t set ' || v_set_list || '
                      where t.owner_id = $4 returning *
                    ) select pg_catalog.to_jsonb(updated) from updated';
          execute v_sql into v_row using v_effective_patch, p_device_id, p_client_updated_at, v_owner;
        else
          v_sql := pg_catalog.format(
            'with updated as (
               update rakeezx.%I t set %s
               where t.owner_id = $4 and t.id = $5 returning *
             ) select pg_catalog.to_jsonb(updated) from updated', p_entity, v_set_list
          );
          execute v_sql into v_row using v_effective_patch, p_device_id, p_client_updated_at, v_owner, p_record_id;
        end if;
        v_revision := (v_row ->> 'revision')::bigint;
      end if;

      if pg_catalog.cardinality(v_conflicted_groups) = 0 then
        v_outcome := 'applied';
      elsif pg_catalog.cardinality(v_applied_groups) > 0 then
        v_outcome := 'applied_with_conflicts';
      else
        v_outcome := 'conflict';
      end if;
    end if;
  end if;

  v_result := pg_catalog.jsonb_build_object(
    'mutationId', p_mutation_id,
    'entity', p_entity,
    'recordId', p_record_id,
    'canonicalId', case when p_entity = 'profile' then 'profile' else v_row ->> 'id' end,
    'outcome', v_outcome,
    'appliedGroups', pg_catalog.to_jsonb(v_applied_groups),
    'conflictedGroups', pg_catalog.to_jsonb(v_conflicted_groups),
    'resultRevision', v_revision,
    'canonical', v_row
  );

  insert into rakeezx.sync_mutation_receipts (
    owner_id, mutation_id, entity, record_id, device_id, base_revision, operation,
    client_updated_at, request_patch, request_envelope, outcome, applied_groups, conflicted_groups,
    result_revision, canonical, result
  ) values (
    v_owner, p_mutation_id, p_entity, p_record_id, p_device_id, p_base_revision, p_operation,
    p_client_updated_at, p_patch, v_request_envelope, v_outcome, v_applied_groups, v_conflicted_groups,
    v_revision, v_row, v_result
  );

  return v_result;
end;
$$;

revoke all on function rakeezx.apply_sync_v2_mutation(text,text,text,text,bigint,jsonb,text,bigint) from public;
grant execute on function rakeezx.apply_sync_v2_mutation(text,text,text,text,bigint,jsonb,text,bigint) to authenticated;

commit;
