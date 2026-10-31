-- AI: complete OBSERVED inner writer; current public lifecycle wrapper remains intact.
CREATE OR REPLACE FUNCTION rakeezx.apply_sync_v2_mutation_before_student_0029(p_entity text, p_record_id text, p_mutation_id text, p_device_id text, p_base_revision bigint, p_patch jsonb DEFAULT '{}'::jsonb, p_operation text DEFAULT 'patch'::text, p_client_updated_at bigint DEFAULT NULL::bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  v_n88_capture jsonb; v_n88_before bigint; v_n88_grade_flag text;
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

  -- V2 attachment: global/session/owner fences before accepted canonical writes.
  perform pg_catalog.pg_advisory_xact_lock(1312307256,88);
  if not exists(select 1 from n88_private.lock_current_session(v_owner,(auth.jwt()->>'session_id')::uuid) s where s.user_id=v_owner and s.session_id=(auth.jwt()->>'session_id')::uuid) then raise exception using errcode='42501',message='N88 current session required';end if;
  perform n88_private.lock_owner_key(v_owner);

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

  if v_row is not null and v_deleted_at is null and p_operation in ('patch','delete') and p_entity in ('items','score_subitems') then
    v_n88_before:=v_revision;
    v_n88_capture:=n88_private.v2_writer_capture_1031(v_owner,p_entity,p_record_id,v_row);
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
      if v_deleted_at is null and p_base_revision<>v_revision then
        v_outcome:='conflict'; v_conflicted_groups:=array['__deleted__'];
      elsif v_deleted_at is null then
        v_n88_grade_flag:=pg_catalog.current_setting('rakeezx.score_domain_write',true);
        perform n88_private.v2_writer_delete_children_1031(v_owner,p_entity,p_record_id);
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
        perform n88_private.v2_writer_finalize_domain_1031(v_owner,p_entity,p_record_id);
        perform pg_catalog.set_config('rakeezx.score_domain_write',coalesce(v_n88_grade_flag,''),true);
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

  if v_n88_capture is not null and v_revision>v_n88_before and v_outcome in ('deleted','applied','applied_with_conflicts') then
    perform n88_private.v2_writer_complete_1031(v_owner,v_n88_capture,v_outcome='deleted');
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
$function$;
