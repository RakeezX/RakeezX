-- AI: additive N71/N94 restore-only creation-history compatibility.
BEGIN;
CREATE OR REPLACE FUNCTION rakeezx.stage_n71_restore(p_restore_id text, p_backup_hash text, p_backup_version integer, p_source_manifest jsonb, p_operations jsonb, p_source_owner_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_owner uuid:=auth.uid(); v_existing rakeezx.sync_restore_stages%rowtype;
  v_operation jsonb; v_entity text; v_id text; v_action text; v_patch jsonb;
  v_allowed jsonb; v_row jsonb; v_stage_hash text;
begin
  if v_owner is null then raise exception using errcode='42501',message='Authentication required'; end if;
  perform rakeezx.lock_student_lifecycle(v_owner);
  if (p_backup_version=5 and p_source_owner_id is distinct from v_owner) or
    (p_source_owner_id is not null and p_source_owner_id<>v_owner) or
    (p_source_owner_id is null and jsonb_array_length(rakeezx.n71_restore_manifest(v_owner))>1) then
    raise exception using errcode='42501',message='N71 backup owner mismatch'; end if;
  if coalesce(p_restore_id,'')='' or pg_catalog.char_length(p_restore_id)>200 or
     (p_backup_version<>3 and p_backup_hash !~ '^[a-f0-9]{64}$') or p_backup_version not in (3,4,5) or
     pg_catalog.jsonb_typeof(p_source_manifest)<>'array' or
     pg_catalog.jsonb_typeof(p_operations)<>'array' then
    raise exception using errcode='22023',message='Invalid V5 restore envelope';
  end if;
  if p_source_manifest is distinct from rakeezx.n71_restore_manifest(v_owner) then
    raise exception using errcode='40001',message='Canonical source changed before V5 staging';
  end if;
  if pg_catalog.jsonb_array_length(p_operations)>10000 or exists(select 1 from (
    select value->>'entity' entity,value->>'recordId' record_id,count(*) n
    from pg_catalog.jsonb_array_elements(p_operations) group by 1,2 having count(*)>1
  ) duplicates) then
    raise exception using errcode='22023',message='Invalid V5 operation set';
  end if;
  for v_operation in select value from pg_catalog.jsonb_array_elements(p_operations) loop
    v_entity:=v_operation->>'entity'; v_id:=v_operation->>'recordId';
    v_action:=v_operation->>'operation'; v_patch:=coalesce(v_operation->'patch','{}'::jsonb);
    if v_entity is null or not(v_entity=any(rakeezx.n71_restore_entities())) or
      coalesce(v_id,'')='' or pg_catalog.char_length(v_id)>240 or
      v_action is null or v_action not in ('create','create_deleted','patch','delete') or
      pg_catalog.jsonb_typeof(v_patch)<>'object' or
      (v_action='delete' and v_patch<>'{}'::jsonb) then
      raise exception using errcode='22023',message='Invalid V5 restore operation';
    end if;
    if v_entity='profile' and v_id<>'profile' then
      raise exception using errcode='22023',message='Invalid V5 profile identity'; end if;
    v_allowed:=case when v_entity='closed_term_reports' then
      '{"term_id":1,"year_id":1,"version":1,"supersedes_id":1,"source_manifest":1,"payload":1,"state":1,"created_at":1}'::jsonb
      else rakeezx.sync_v2_field_map(v_entity) end;
    -- N94 history is restore-only and insert-only. Ordinary Sync remains unchanged.
    if v_entity='score_subitems' and v_patch ? 'created_at' then
      if v_action not in ('create','create_deleted') or
        pg_catalog.jsonb_typeof(v_patch->'created_at') is distinct from 'string' or
        (v_patch->>'created_at') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,6})?(Z|[+-][0-9]{2}:[0-9]{2})$' then
        raise exception using errcode='22023',message='Invalid N71 subitem creation history';
      end if;
      begin
        if not pg_catalog.isfinite((v_patch->>'created_at')::timestamptz) or
          (v_patch->>'created_at')::timestamptz<='1970-01-01T00:00:00Z'::timestamptz then
          raise exception using errcode='22023',message='Invalid N71 subitem creation history';
        end if;
      exception when invalid_datetime_format or datetime_field_overflow then
        raise exception using errcode='22023',message='Invalid N71 subitem creation history';
      end;
      v_allowed:=v_allowed||'{"created_at":1}'::jsonb;
    end if;
    if v_allowed is null or exists(select 1 from pg_catalog.jsonb_object_keys(v_patch) f
      where not(v_allowed ? f)) then
      raise exception using errcode='22023',message='Unsupported V5 restore field'; end if;
    if v_entity='profile' then
      select pg_catalog.to_jsonb(t) into v_row from rakeezx.profile t where owner_id=v_owner;
    else
      execute pg_catalog.format('select pg_catalog.to_jsonb(t) from rakeezx.%I t where owner_id=$1 and id=$2',v_entity)
        into v_row using v_owner,v_id;
    end if;
    if (v_action in ('create','create_deleted') and
      (v_row is not null or coalesce((v_operation->>'baseRevision')::bigint,0)<>0)) or
       (v_action not in ('create','create_deleted') and
         (v_row is null or (v_row->>'deleted_at') is not null or
       (v_row->>'revision')::bigint<>coalesce((v_operation->>'baseRevision')::bigint,-1))) then
      raise exception using errcode='40001',message='V5 restore operation is stale'; end if;
    if (v_entity in ('logs','session_roster_snapshots','closed_term_reports') and v_action not in ('create','create_deleted')) or
       (v_entity='terms' and v_row->>'status'='closed') then
      raise exception using errcode='22023',message='N71 immutable history requires review'; end if;
    if v_action not in ('create','create_deleted') and
      (v_entity in ('score_subitems','score_subitem_completions') or
       (v_entity='items' and v_row->>'score_mode'='subitems') or
       (v_entity='scores' and exists(select 1 from rakeezx.items i where i.owner_id=v_owner
         and i.id=v_row->>'item_id' and i.score_mode='subitems'))) then
      raise exception using errcode='22023',message='Subitem domain restore change requires explicit review';
    end if;
  end loop;
  v_stage_hash:=pg_catalog.md5('N71_V1:'||p_backup_hash||':'||p_source_manifest::text||':'||p_operations::text);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_owner::text||':restore:'||p_restore_id,0));
  select * into v_existing from rakeezx.sync_restore_stages where owner_id=v_owner and restore_id=p_restore_id;
  if found then
    if (v_existing.backup_hash,v_existing.backup_version,v_existing.stage_hash) is distinct from
       (p_backup_hash,p_backup_version,v_stage_hash) then
      raise exception using errcode='22023',message='V5 restore ID reused'; end if;
    return pg_catalog.jsonb_build_object('restoreId',p_restore_id,'backupHash',p_backup_hash,
      'stageHash',v_stage_hash,'state',v_existing.state);
  end if;
  insert into rakeezx.sync_restore_stages(owner_id,restore_id,backup_hash,backup_version,
    stage_hash,source_manifest,operations)
    values(v_owner,p_restore_id,p_backup_hash,p_backup_version,v_stage_hash,p_source_manifest,p_operations);
  return pg_catalog.jsonb_build_object('restoreId',p_restore_id,'backupHash',p_backup_hash,
    'stageHash',v_stage_hash,'state','staged');
end; $function$;

COMMIT;

