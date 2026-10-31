-- AI: INACTIVE exact new runtime/writer delta. Not a storage reinstall.
BEGIN ISOLATION LEVEL SERIALIZABLE;
SET LOCAL statement_timeout='15s';SET LOCAL lock_timeout='3s';SET LOCAL idle_in_transaction_session_timeout='15s';SET LOCAL search_path=pg_catalog;
DO $gate$ DECLARE expected_authority jsonb := 'null'::jsonb;BEGIN
 IF jsonb_typeof(expected_authority) IS DISTINCT FROM 'object' OR expected_authority->>'bundleSha256' IS DISTINCT FROM 'da0629bee4a8e8ffc19d1d35ef01fbef7157987f4e4588ecb0485c58ed31f3f0' OR expected_authority->>'action' IS DISTINCT FROM 'install-n88-runtime-writer-1031' OR expected_authority->>'projectRef' IS DISTINCT FROM 'xlrubcwjqktzzunrvuns' OR coalesce(expected_authority->>'authorityRef','')='' OR coalesce((expected_authority->>'expiresAt')::timestamptz,'-infinity')<=clock_timestamp() THEN RAISE EXCEPTION 'n88_exact_runtime_writer_authority_required';END IF;
 IF expected_authority->>'productId' IS DISTINCT FROM 'N88' OR expected_authority->>'approved' IS DISTINCT FROM 'true' OR coalesce(expected_authority->>'runId','')='' OR (expected_authority->>'expiresAt')::timestamptz>clock_timestamp()+interval '45 minutes' THEN RAISE EXCEPTION 'n88_exact_runtime_writer_authority_required';END IF;
 IF current_user<>'postgres' OR session_user<>'postgres' OR current_database()<>'postgres' OR (pg_control_system()).system_identifier::text<>'7678071634733212629' THEN RAISE EXCEPTION 'n88_runtime_writer_target_actor';END IF;
 PERFORM pg_advisory_xact_lock(1312307256,88);
 IF encode(sha256(convert_to(pg_get_functiondef('rakeezx.apply_sync_v2_mutation(text,text,text,text,bigint,jsonb,text,bigint)'::regprocedure),'UTF8')),'hex')<>'76084d0bb32cad6751c2f02a7ed03269cba7be374c2f7248aef305f2b66bda11' OR encode(sha256(convert_to(pg_get_functiondef('rakeezx.apply_sync_v2_mutation_before_student_0029(text,text,text,text,bigint,jsonb,text,bigint)'::regprocedure),'UTF8')),'hex')<>'a04e5c89f75523a46f0f16de44ecacd4f25687db8a8fa5f481f91c4aacab3a64' THEN RAISE EXCEPTION 'n88_current_full_writer_changed';END IF;
 IF EXISTS(select 1 from pg_proc where pronamespace='n88_private'::regnamespace and (proname like 'v2_writer_%' or proname='v2_runtime_identity_1031')) THEN RAISE EXCEPTION 'n88_runtime_writer_collision_readback_only';END IF;
 IF has_schema_privilege('anon','n88_private','USAGE') OR has_schema_privilege('authenticated','n88_private','USAGE') OR NOT EXISTS(select 1 from pg_roles where rolname='n88_backend' and rolcanlogin and not rolsuper and not rolbypassrls and not rolcreaterole and not rolcreatedb) THEN RAISE EXCEPTION 'n88_runtime_private_role_changed';END IF;
 IF (select count(*) from pg_proc p join jsonb_to_recordset('[{"name":"v2_0dad27a56bfdc5bfab552235","definition":"0aadee3865cb4c0575a3abe06ccd6fc1bce7e317da292c133145f6cc2117b91a","definer":true,"owner":"n88_v2_guard","config":["search_path=pg_catalog"],"acl":["n88_v2_guard:EXECUTE","n88_v2_runtime:EXECUTE"]},{"name":"v2_23ccfc1e16cd0b122d0cb3c3","definition":"277c6405d47dfe5f193982cb4d591889081f63aa403f1b53698da3cc963e6573","definer":true,"owner":"n88_v2_guard","config":["search_path=pg_catalog"],"acl":["n88_v2_guard:EXECUTE","n88_v2_runtime:EXECUTE"]},{"name":"v2_3b143936c792a16ff5425c3d","definition":"70ebe1fab16d248125ba9ba231e05e7d5385bddd91973031e5407f8b822564bb","definer":true,"owner":"n88_v2_guard","config":["search_path=pg_catalog"],"acl":["n88_v2_guard:EXECUTE","n88_v2_runtime:EXECUTE"]},{"name":"v2_5d62e77b02ab6a1fb4e97688","definition":"a70a8255124089753437b62447cb542fa21af059ee025fe7641f3e0a02454cf1","definer":true,"owner":"n88_v2_guard","config":["search_path=pg_catalog"],"acl":["n88_v2_guard:EXECUTE","n88_v2_runtime:EXECUTE"]},{"name":"v2_6d27c8049efec0665b9d1f91","definition":"ba27f79ab0a2aeab728a5695543ea64f660c9ee049847bcfa74f86c2badc8822","definer":true,"owner":"n88_v2_guard","config":["search_path=pg_catalog"],"acl":["n88_v2_guard:EXECUTE","n88_v2_runtime:EXECUTE"]},{"name":"v2_71a3e914da47cf1053850671","definition":"1d32ca5bbb74a3d9af199a378c9b71f5dca364db588fd47eadf9298203e9db28","definer":true,"owner":"n88_v2_guard","config":["search_path=pg_catalog"],"acl":["n88_v2_guard:EXECUTE","n88_v2_runtime:EXECUTE"]},{"name":"v2_74c4aa4d430911e99002af80","definition":"ccb5c0585d18d7e94f6765ca522a2426f0c0e4cc2ce363b23ffbd1d25dadbbda","definer":true,"owner":"n88_v2_guard","config":["search_path=pg_catalog"],"acl":["n88_v2_guard:EXECUTE","n88_v2_runtime:EXECUTE"]},{"name":"v2_7874a827dae2373223bc8adc","definition":"0f38db25d66389643b074dd8c46eab079aea0e3e25e8dd082bd58a327e26e533","definer":true,"owner":"n88_v2_guard","config":["search_path=pg_catalog"],"acl":["n88_v2_guard:EXECUTE","n88_v2_runtime:EXECUTE"]},{"name":"v2_94bb23dac56c2e002713130a","definition":"38a36af0320818a809b4dcca844098eadc71af5cf95912ed6aca49d9f89d34d3","definer":true,"owner":"n88_v2_guard","config":["search_path=pg_catalog"],"acl":["n88_v2_guard:EXECUTE","n88_v2_runtime:EXECUTE"]},{"name":"v2_a3e6d95cdff2d66f56ae84f6","definition":"f32fbd2a6ce1d8a3abb4503d67cee64f006d9af38c764ee8d2e0a9011fa6beb6","definer":true,"owner":"n88_v2_guard","config":["search_path=pg_catalog"],"acl":["n88_v2_guard:EXECUTE","n88_v2_runtime:EXECUTE"]},{"name":"v2_dbe074dae923ca8a3746d390","definition":"2b7cba6ba01cd276e76267da996f3a8a336e1e5d9ac1bad149698ff05908b5b5","definer":true,"owner":"n88_v2_guard","config":["search_path=pg_catalog"],"acl":["n88_v2_guard:EXECUTE","n88_v2_runtime:EXECUTE"]},{"name":"v2_e1b1c0927f6164faeccb760b","definition":"a8a31033f93b613376ac1c4695cc6839def54236794c8f698b000ba6605cb471","definer":true,"owner":"n88_v2_guard","config":["search_path=pg_catalog"],"acl":["n88_v2_guard:EXECUTE","n88_v2_runtime:EXECUTE"]},{"name":"v2_f46afed1e023d013cdabf257","definition":"17bd70bd63d76000de1a54906634e3cbecd9941350315af89d0210748ed45960","definer":true,"owner":"n88_v2_guard","config":["search_path=pg_catalog"],"acl":["n88_v2_guard:EXECUTE","n88_v2_runtime:EXECUTE"]},{"name":"v2_f8a1689cd78951d7fc52ef91","definition":"ed645e03679e62e1bf90646037781c367e0b2f421583749b59bfc591df866e33","definer":true,"owner":"n88_v2_guard","config":["search_path=pg_catalog"],"acl":["n88_v2_guard:EXECUTE","n88_v2_runtime:EXECUTE"]}]'::jsonb) e(name text,definition text) on e.name=p.proname where p.pronamespace='n88_private'::regnamespace and encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex')=e.definition and p.prosecdef and p.proowner='n88_v2_guard'::regrole)<>14 THEN RAISE EXCEPTION 'n88_installed_storage_changed';END IF;
END $gate$;
-- BEGIN EXACT QUALIFIED DELTA
-- AI: inactive runtime privilege delta. Original LOGIN/credentials reused; no new runtime membership at rest.
create function n88_private.v2_runtime_identity_1031() returns table(database_name text,system_identifier text) language sql security definer set search_path=pg_catalog as $$select current_database()::text,(pg_control_system()).system_identifier::text$$;
revoke all on function n88_private.v2_runtime_identity_1031() from public,anon,authenticated;
grant execute on function n88_private.v2_runtime_identity_1031() to n88_backend;
-- Exact existing-owner ADMIN path, transaction-local and restored at rest.
DO $owner_gate$ BEGIN IF current_user<>'postgres' OR session_user<>'postgres' OR NOT pg_has_role(current_user,'n88_v2_guard','MEMBER WITH ADMIN OPTION') OR EXISTS(select 1 from pg_auth_members where roleid='n88_v2_guard'::regrole and member='postgres'::regrole and grantor='postgres'::regrole) THEN RAISE EXCEPTION 'n88_runtime_exact_owner_admin_required';END IF;END $owner_gate$;
GRANT n88_v2_guard TO postgres WITH ADMIN FALSE, INHERIT FALSE, SET TRUE GRANTED BY postgres;
SET LOCAL ROLE n88_v2_guard;
grant execute on function n88_private.v2_f8a1689cd78951d7fc52ef91(uuid) to n88_backend;
grant execute on function n88_private.v2_7874a827dae2373223bc8adc(text) to n88_backend;
grant execute on function n88_private.v2_6d27c8049efec0665b9d1f91(uuid,uuid,text,text) to n88_backend;
grant execute on function n88_private.v2_e1b1c0927f6164faeccb760b(uuid,integer,integer,integer) to n88_backend;
grant execute on function n88_private.v2_f46afed1e023d013cdabf257(uuid,integer,integer,integer) to n88_backend;
grant execute on function n88_private.v2_0dad27a56bfdc5bfab552235(uuid,integer,integer,integer) to n88_backend;
grant execute on function n88_private.v2_71a3e914da47cf1053850671(uuid,integer,integer,integer) to n88_backend;
grant execute on function n88_private.v2_74c4aa4d430911e99002af80(uuid,text,text) to n88_backend;
grant execute on function n88_private.v2_dbe074dae923ca8a3746d390(uuid,text,text,text) to n88_backend;
grant execute on function n88_private.v2_a3e6d95cdff2d66f56ae84f6(uuid,text,text,text,boolean,text) to n88_backend;
grant execute on function n88_private.v2_5d62e77b02ab6a1fb4e97688(uuid,text,text,text,boolean,text,text,text) to n88_backend;
grant execute on function n88_private.v2_23ccfc1e16cd0b122d0cb3c3(uuid,text,text,text,boolean) to n88_backend;
grant execute on function n88_private.v2_94bb23dac56c2e002713130a(uuid,text,text,text,boolean,text,boolean) to n88_backend;
grant execute on function n88_private.v2_3b143936c792a16ff5425c3d(uuid,text,text,text,text) to n88_backend;
SET LOCAL ROLE postgres;
REVOKE n88_v2_guard FROM postgres GRANTED BY postgres;
DO $restored$ BEGIN IF current_user<>'postgres' OR session_user<>'postgres' OR pg_has_role('postgres','n88_v2_guard','SET') OR pg_has_role('postgres','n88_v2_guard','USAGE') OR pg_has_role('n88_backend','n88_v2_guard','SET') THEN RAISE EXCEPTION 'n88_runtime_owner_role_not_restored';END IF;END $restored$;

-- AI: inactive exact writer-owned helpers. No browser/backend execution grant.
create function n88_private.v2_writer_capture_1031(p_owner uuid,p_entity text,p_id text,p_old jsonb) returns jsonb
language plpgsql security invoker set search_path=pg_catalog as $$
declare result jsonb; teaching text;
begin
 if p_owner is distinct from auth.uid() or p_entity not in ('items','score_subitems') or p_old->>'id' is distinct from p_id then raise exception 'n88_writer_capture';end if;
 if p_entity='items' then teaching:=p_old->>'teaching_id';
 else select teaching_id into strict teaching from rakeezx.items where owner_id=p_owner and id=p_old->>'item_id' for update;end if;
 select coalesce(jsonb_agg(jsonb_build_object('scope',s.scope_key,'family',q.family,'id',q.id,'parent',q.parent,'revision',q.revision) order by s.scope_key,q.family,q.id),'[]'::jsonb) into result
 from n88_private.publication_v2_scopes s cross join lateral (
 select 'items'::text as family,p_id as id,p_id as parent,(p_old->>'revision')::bigint as revision where p_entity='items'
 union all select 'scoreSubitems',d.id,d.item_id,d.revision from rakeezx.score_subitems d where d.owner_id=p_owner and
 (p_entity='items' and d.item_id=p_id or p_entity='score_subitems' and d.id=p_id)
 ) q where s.owner_id=p_owner and s.payload->'scope'->>'teachingId'=teaching;
 if jsonb_array_length(result)>8000 or octet_length(result::text)>2097152 then raise exception 'n88_writer_capture_budget';end if;
 return result;
end $$;

create function n88_private.v2_writer_delete_children_1031(p_owner uuid,p_entity text,p_id text) returns void
language plpgsql security invoker set search_path=pg_catalog as $$
declare dependency record; has_live boolean; inspected integer:=0;
begin
 if p_owner is distinct from auth.uid() then raise exception 'n88_writer_owner';end if;
 -- Higher-level lifecycle commands must delete their genuine dependencies first.
 -- Reject generic parent-only deletions rather than inventing a domain cascade.
 if p_entity in ('items','score_subitems') then
  -- The accepted source deletion is one atomic score-domain removal. No score
  -- value, rounding, manual/derived algorithm or existing trigger is rewritten.
  perform set_config('rakeezx.score_domain_write','on',true);
  update rakeezx.score_subitem_completions c set deleted_at=clock_timestamp() where c.owner_id=p_owner and c.deleted_at is null and exists(
   select 1 from rakeezx.score_subitems d where d.owner_id=p_owner and c.subitem_id=d.id and (p_entity='items' and d.item_id=p_id or p_entity='score_subitems' and d.id=p_id));
  if p_entity='items' then
   update rakeezx.score_subitems set deleted_at=clock_timestamp() where owner_id=p_owner and item_id=p_id and deleted_at is null;
   update rakeezx.scores set deleted_at=clock_timestamp() where owner_id=p_owner and item_id=p_id and deleted_at is null;
  end if;
 end if;
  for dependency in
   select n.nspname,c.relname,a.attname,
    exists(select 1 from pg_attribute d where d.attrelid=c.oid and d.attname='deleted_at' and not d.attisdropped) as soft_delete
   from pg_constraint f join pg_class c on c.oid=f.conrelid join pg_namespace n on n.oid=c.relnamespace
   cross join lateral unnest(f.confkey,f.conkey) keys(parent_key,child_key)
   join pg_attribute parent_col on parent_col.attrelid=f.confrelid and parent_col.attnum=keys.parent_key
   join pg_attribute a on a.attrelid=c.oid and a.attnum=keys.child_key
   where f.contype='f' and f.confrelid=to_regclass(format('rakeezx.%I',p_entity)) and n.nspname='rakeezx' and parent_col.attname='id'
    and exists(select 1 from pg_attribute o where o.attrelid=c.oid and o.attname='owner_id' and not o.attisdropped)
  loop
   inspected:=inspected+1;if inspected>128 then raise exception 'n88_dependency_budget';end if;
   execute format('select exists(select 1 from %I.%I where owner_id=$1 and %I=$2%s)',dependency.nspname,dependency.relname,dependency.attname,case when dependency.soft_delete then ' and deleted_at is null' else '' end) into has_live using p_owner,p_id;
   if has_live then raise exception 'n88_parent_has_live_children';end if;
  end loop;

end $$;

create function n88_private.v2_writer_finalize_domain_1031(p_owner uuid,p_entity text,p_id text) returns void
language plpgsql security invoker set search_path=pg_catalog as $$
declare parent text; pupil text; n integer:=0; previous_flag text:=current_setting('rakeezx.score_domain_write',true);
begin
 if p_owner is distinct from auth.uid() then raise exception 'n88_writer_owner';end if;
 if p_entity='score_subitems' then
  select item_id into strict parent from rakeezx.score_subitems where owner_id=p_owner and id=p_id;
  for pupil in select distinct student_id from rakeezx.scores where owner_id=p_owner and item_id=parent and deleted_at is null loop
   n:=n+1;if n>2000 then raise exception 'n88_writer_score_budget';end if;
   perform rakeezx.recompute_subitem_score(p_owner,parent,pupil,'n88-source-delete');
  end loop;
 end if;
 perform set_config('rakeezx.score_domain_write',coalesce(previous_flag,''),true);
end $$;

create function n88_private.v2_writer_complete_1031(p_owner uuid,p_capture jsonb,p_deleted boolean) returns void
language plpgsql security invoker set search_path=pg_catalog as $$
declare r jsonb; current_revision bigint; gone boolean;
begin
 if p_owner is distinct from auth.uid() or jsonb_typeof(p_capture)<>'array' then raise exception 'n88_writer_owner';end if;
 for r in select value from jsonb_array_elements(p_capture) loop
  if r->>'family'='items' then select revision,deleted_at is not null into strict current_revision,gone from rakeezx.items where owner_id=p_owner and id=r->>'id';
  else select revision,deleted_at is not null into strict current_revision,gone from rakeezx.score_subitems where owner_id=p_owner and id=r->>'id';end if;
  if p_deleted then
   if not gone then raise exception 'n88_writer_incomplete_child_delete';end if;
   perform n88_private.publication_v2_retire_source(p_owner,r->>'scope',r->>'family',r->>'id',current_revision);
  else
   -- Accepted definition edit invalidates publication decisions, not receipts.
   update n88_private.publication_v2_items set publication_revision=publication_revision+1,
    payload=payload||jsonb_build_object('publicationRevision',publication_revision+1,'decisions',jsonb_build_object('required',false,'scheduled',false,'completed',false,'grade',false))
    where owner_id=p_owner and scope_key=r->>'scope' and not tombstone and
    (r->>'family'='items' and row_id::jsonb->>1=r->>'id' or r->>'family'='scoreSubitems' and row_id::jsonb->>0='subitem' and row_id::jsonb->>2=r->>'id');
   update n88_private.publication_v2_scopes set store_revision=store_revision+1 where owner_id=p_owner and scope_key=r->>'scope';
  end if;
 end loop;
end $$;
revoke all on function n88_private.v2_writer_capture_1031(uuid,text,text,jsonb),n88_private.v2_writer_delete_children_1031(uuid,text,text),n88_private.v2_writer_finalize_domain_1031(uuid,text,text),n88_private.v2_writer_complete_1031(uuid,jsonb,boolean) from public,anon,authenticated,n88_backend;

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
-- END EXACT QUALIFIED DELTA

DO $post$ BEGIN
 IF (select count(*) from pg_proc p join jsonb_to_recordset('[{"proname":"apply_sync_v2_mutation","definition":"76084d0bb32cad6751c2f02a7ed03269cba7be374c2f7248aef305f2b66bda11","owner":"postgres","prosecdef":true,"acl":"{postgres=X/postgres,authenticated=X/postgres}"},{"proname":"apply_sync_v2_mutation_before_student_0029","definition":"8a9b27b3d46fef576847108631a175b57787fc794e7fb868e9d300761a6d26d4","owner":"postgres","prosecdef":true,"acl":"{postgres=X/postgres}"},{"proname":"v2_runtime_identity_1031","definition":"46de8509b3b0bed8f33b36e28da8a4b74f05a5c6e017f744a273d49c8b519693","owner":"postgres","prosecdef":true,"acl":"{postgres=X/postgres,n88_backend=X/postgres}"},{"proname":"v2_writer_capture_1031","definition":"c569b47066ede69b9997d60277a593105b31c815e166a21b6aed6f986d6b866e","owner":"postgres","prosecdef":false,"acl":"{postgres=X/postgres}"},{"proname":"v2_writer_complete_1031","definition":"4aaf92591fc4ba4815c7ca1543c65b92b6aaba5fb858483278d28e1f6212d1cf","owner":"postgres","prosecdef":false,"acl":"{postgres=X/postgres}"},{"proname":"v2_writer_delete_children_1031","definition":"77254694dcd9b1a286cb0a18ab2051e07605d7dc1cb6f452b0748874014bcdde","owner":"postgres","prosecdef":false,"acl":"{postgres=X/postgres}"},{"proname":"v2_writer_finalize_domain_1031","definition":"a8800df791c9ce9c5833f9588092745e6ea5f55500e977f68966fb574e2763da","owner":"postgres","prosecdef":false,"acl":"{postgres=X/postgres}"}]'::jsonb) e(proname text,definition text,owner text,prosecdef boolean,acl text) on p.proname=e.proname where p.pronamespace in ('rakeezx'::regnamespace,'n88_private'::regnamespace) and encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex')=e.definition and pg_get_userbyid(p.proowner)=e.owner and p.prosecdef=e.prosecdef and p.proacl::text=e.acl)<>7 THEN RAISE EXCEPTION 'n88_exact_new_writer_identity_mismatch';END IF;
 IF encode(sha256(convert_to(pg_get_functiondef('rakeezx.apply_sync_v2_mutation(text,text,text,text,bigint,jsonb,text,bigint)'::regprocedure),'UTF8')),'hex')<>'76084d0bb32cad6751c2f02a7ed03269cba7be374c2f7248aef305f2b66bda11' THEN RAISE EXCEPTION 'n88_public_wrapper_changed';END IF;
 IF EXISTS(select 1 from pg_proc p cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where p.pronamespace='n88_private'::regnamespace and p.proname like 'v2_writer_%' and (a.grantee<>p.proowner or a.is_grantable)) THEN RAISE EXCEPTION 'n88_writer_helper_exposed';END IF;
 IF pg_has_role('n88_backend','n88_v2_guard','SET') OR pg_has_role('n88_backend','n88_guard','SET') OR pg_has_role('postgres','n88_v2_guard','SET') OR pg_has_role('postgres','n88_v2_guard','USAGE') THEN RAISE EXCEPTION 'n88_runtime_role_not_restricted';END IF;
 IF (select count(*) from pg_proc p where p.pronamespace='n88_private'::regnamespace and p.proname ~ '^v2_[a-f0-9]{24}$' and p.proowner='n88_v2_guard'::regrole and has_function_privilege('n88_backend',p.oid,'EXECUTE') and not has_function_privilege('anon',p.oid,'EXECUTE') and not has_function_privilege('authenticated',p.oid,'EXECUTE'))<>14 THEN RAISE EXCEPTION 'n88_exact_runtime_execute_mismatch';END IF;
 IF has_any_column_privilege('n88_backend','auth.users','SELECT') OR EXISTS(select 1 from pg_class c where c.relnamespace='n88_private'::regnamespace and c.relname in ('publication_v2_scopes','publication_v2_items','publication_v2_high_water','publication_v2_receipts') and (has_any_column_privilege('n88_backend',c.oid,'SELECT,INSERT,UPDATE,REFERENCES') or has_table_privilege('n88_backend',c.oid,'DELETE,TRUNCATE,TRIGGER'))) THEN RAISE EXCEPTION 'n88_raw_auth_or_v2_privilege';END IF;
 IF (select count(*) from pg_class where relnamespace='n88_private'::regnamespace and relname in ('publication_v2_scopes','publication_v2_items','publication_v2_high_water','publication_v2_receipts') and relkind='r' and relrowsecurity and relforcerowsecurity)<>4 OR has_schema_privilege('anon','n88_private','USAGE') OR has_schema_privilege('authenticated','n88_private','USAGE') THEN RAISE EXCEPTION 'n88_storage_nonexposure_changed';END IF;
END $post$;
COMMIT;
