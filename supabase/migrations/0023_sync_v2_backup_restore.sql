-- RAKEEZ X — V2-BACKUP-RESTORE-01A
-- Additive, owner-scoped staging and atomic finalization for conservative V2 restores.
set lock_timeout = '10s';

begin;

create table if not exists rakeezx.sync_restore_stages (
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  restore_id text not null check (char_length(restore_id) between 1 and 200),
  backup_hash text not null check (char_length(backup_hash) between 1 and 128),
  backup_version integer not null check (backup_version in (3,4)),
  stage_hash text not null check (char_length(stage_hash) = 32),
  source_manifest jsonb not null check (jsonb_typeof(source_manifest) = 'array'),
  operations jsonb not null check (jsonb_typeof(operations) = 'array'),
  state text not null default 'staged' check (state in ('staged','finalized')),
  created_at timestamptz not null default clock_timestamp(),
  finalized_at timestamptz,
  primary key (owner_id, restore_id)
);

create table if not exists rakeezx.sync_restore_receipts (
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  restore_id text not null,
  backup_hash text not null,
  stage_hash text not null,
  result jsonb not null check (jsonb_typeof(result) = 'object'),
  created_at timestamptz not null default clock_timestamp(),
  primary key (owner_id, restore_id),
  foreign key (owner_id, restore_id) references rakeezx.sync_restore_stages(owner_id, restore_id) on delete restrict
);

alter table rakeezx.sync_restore_stages enable row level security;
alter table rakeezx.sync_restore_stages force row level security;
alter table rakeezx.sync_restore_receipts enable row level security;
alter table rakeezx.sync_restore_receipts force row level security;
drop policy if exists sync_restore_stages_select on rakeezx.sync_restore_stages;
create policy sync_restore_stages_select on rakeezx.sync_restore_stages for select to authenticated
  using (owner_id = (select auth.uid()));
drop policy if exists sync_restore_receipts_select on rakeezx.sync_restore_receipts;
create policy sync_restore_receipts_select on rakeezx.sync_restore_receipts for select to authenticated
  using (owner_id = (select auth.uid()));
revoke all on table rakeezx.sync_restore_stages, rakeezx.sync_restore_receipts from public, anon, authenticated;
grant select on table rakeezx.sync_restore_stages, rakeezx.sync_restore_receipts to authenticated;

create or replace function rakeezx.sync_v2_restore_entities()
returns text[] language sql immutable security definer set search_path = '' as $$
  select array['profile','years','calendars','calendar_days','terms','subjects','sections','teachings',
    'students','enrollments','notes','class_rules','items','scores','logs','time_profiles','slots','sessions',
    'session_roster_snapshots','attendance','closed_term_reports']::text[];
$$;
revoke all on function rakeezx.sync_v2_restore_entities() from public;

create or replace function rakeezx.sync_v2_restore_manifest(p_owner uuid default auth.uid())
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_entity text; v_rows jsonb := '[]'::jsonb; v_part jsonb; v_sql text;
begin
  if p_owner is null or p_owner <> auth.uid() then
    raise exception using errcode='42501', message='Restore manifest owner mismatch';
  end if;
  foreach v_entity in array rakeezx.sync_v2_restore_entities() loop
    if v_entity = 'profile' then
      select coalesce(jsonb_agg(jsonb_build_object('entity','profile','id','profile','revision',revision,
        'deleted',deleted_at is not null) order by owner_id), '[]'::jsonb)
        into v_part from rakeezx.profile where owner_id=p_owner;
    else
      v_sql := format('select coalesce(jsonb_agg(jsonb_build_object(''entity'',%L,''id'',id,''revision'',revision,
        ''deleted'',deleted_at is not null) order by id), ''[]''::jsonb) from rakeezx.%I where owner_id=$1', v_entity, v_entity);
      execute v_sql into v_part using p_owner;
    end if;
    v_rows := v_rows || v_part;
  end loop;
  return v_rows;
end; $$;
revoke all on function rakeezx.sync_v2_restore_manifest(uuid) from public;
grant execute on function rakeezx.sync_v2_restore_manifest(uuid) to authenticated;

create or replace function rakeezx.sync_v2_restore_canonical(p_owner uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_entity text; v_result jsonb := '{}'::jsonb; v_rows jsonb; v_sql text;
begin
  if p_owner is null or p_owner <> auth.uid() then raise exception using errcode='42501',message='Restore owner mismatch'; end if;
  foreach v_entity in array rakeezx.sync_v2_restore_entities() loop
    if v_entity='profile' then select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) into v_rows from rakeezx.profile t where owner_id=p_owner;
    else
      v_sql:=format('select coalesce(jsonb_agg(to_jsonb(t) order by id), ''[]''::jsonb) from rakeezx.%I t where owner_id=$1',v_entity);
      execute v_sql into v_rows using p_owner;
    end if;
    v_result:=v_result||jsonb_build_object(v_entity,v_rows);
  end loop;
  return v_result;
end; $$;
revoke all on function rakeezx.sync_v2_restore_canonical(uuid) from public;

create or replace function rakeezx.stage_sync_v2_restore(
  p_restore_id text, p_backup_hash text, p_backup_version integer,
  p_source_manifest jsonb, p_operations jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid:=auth.uid(); v_existing rakeezx.sync_restore_stages%rowtype; v_operation jsonb;
  v_entity text; v_id text; v_action text; v_patch jsonb; v_allowed jsonb; v_row jsonb; v_stage_hash text;
begin
  if v_owner is null then raise exception using errcode='42501',message='Authentication required'; end if;
  if coalesce(p_restore_id,'')='' or char_length(p_restore_id)>200 or coalesce(p_backup_hash,'')='' or
     char_length(p_backup_hash)>128 or p_backup_version not in (3,4) or jsonb_typeof(p_source_manifest)<>'array' or
     jsonb_typeof(p_operations)<>'array' then raise exception using errcode='22023',message='Invalid restore envelope'; end if;
  if p_backup_version=4 and p_backup_hash !~ '^[a-f0-9]{64}$' then
    raise exception using errcode='22023',message='Invalid V4 backup hash';
  end if;
  if p_source_manifest is distinct from rakeezx.sync_v2_restore_manifest(v_owner) then
    raise exception using errcode='40001',message='Canonical source changed before restore staging';
  end if;
  if p_backup_version=3 and jsonb_array_length(p_source_manifest)>0 then
    raise exception using errcode='22023',message='Legacy restore requires a provably empty owner';
  end if;
  if jsonb_array_length(p_operations)>10000 then raise exception using errcode='54000',message='Restore operation limit exceeded'; end if;
  if exists(select 1 from (
    select value->>'entity' entity,value->>'recordId' record_id,count(*) count
      from jsonb_array_elements(p_operations) group by 1,2 having count(*)>1
  ) duplicates) then raise exception using errcode='22023',message='Duplicate restore operation identity'; end if;

  for v_operation in select value from jsonb_array_elements(p_operations) loop
    v_entity:=v_operation->>'entity'; v_id:=v_operation->>'recordId'; v_action:=v_operation->>'operation';
    v_patch:=coalesce(v_operation->'patch','{}'::jsonb);
    if not (v_entity=any(rakeezx.sync_v2_restore_entities())) or coalesce(v_id,'')='' or char_length(v_id)>240 or
       v_action not in ('create','patch','delete') or jsonb_typeof(v_patch)<>'object' or
       (v_action='delete' and v_patch<>'{}'::jsonb) then raise exception using errcode='22023',message='Invalid restore operation'; end if;
    if v_entity='profile' and v_id<>'profile' then raise exception using errcode='22023',message='Invalid profile restore identity'; end if;
    v_allowed:=case when v_entity='closed_term_reports' then '{"term_id":1,"year_id":1,"version":1,"supersedes_id":1,"source_manifest":1,"payload":1,"state":1,"created_at":1}'::jsonb
      else rakeezx.sync_v2_field_map(v_entity) end;
    if v_allowed is null or exists(select 1 from jsonb_object_keys(v_patch) f where not v_allowed ? f) then
      raise exception using errcode='22023',message='Restore operation contains an unsupported field';
    end if;
    if v_entity='profile' then select to_jsonb(t) into v_row from rakeezx.profile t where owner_id=v_owner;
    else execute format('select to_jsonb(t) from rakeezx.%I t where owner_id=$1 and id=$2',v_entity) into v_row using v_owner,v_id; end if;
    if (v_action='create' and (v_row is not null or coalesce((v_operation->>'baseRevision')::bigint,0)<>0)) or
       (v_action<>'create' and (v_row is null or (v_row->>'deleted_at') is not null or
        (v_row->>'revision')::bigint<>coalesce((v_operation->>'baseRevision')::bigint,-1))) then
      raise exception using errcode='40001',message='Restore operation no longer matches canonical source';
    end if;
  end loop;

  v_stage_hash:=md5(p_backup_hash||':'||p_source_manifest::text||':'||p_operations::text);
  perform pg_advisory_xact_lock(hashtextextended(v_owner::text||':restore:'||p_restore_id,0));
  select * into v_existing from rakeezx.sync_restore_stages where owner_id=v_owner and restore_id=p_restore_id;
  if found then
    if (v_existing.backup_hash,v_existing.backup_version,v_existing.stage_hash) is distinct from
       (p_backup_hash,p_backup_version,v_stage_hash) then raise exception using errcode='22023',message='Restore ID reused with different content'; end if;
    return jsonb_build_object('restoreId',p_restore_id,'backupHash',p_backup_hash,'stageHash',v_stage_hash,'state',v_existing.state);
  end if;
  insert into rakeezx.sync_restore_stages(owner_id,restore_id,backup_hash,backup_version,stage_hash,source_manifest,operations)
    values(v_owner,p_restore_id,p_backup_hash,p_backup_version,v_stage_hash,p_source_manifest,p_operations);
  return jsonb_build_object('restoreId',p_restore_id,'backupHash',p_backup_hash,'stageHash',v_stage_hash,'state','staged');
end; $$;
revoke all on function rakeezx.stage_sync_v2_restore(text,text,integer,jsonb,jsonb) from public;
grant execute on function rakeezx.stage_sync_v2_restore(text,text,integer,jsonb,jsonb) to authenticated;

create or replace function rakeezx.finalize_sync_v2_restore(
  p_restore_id text, p_backup_hash text, p_expected_stage_hash text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid:=auth.uid(); v_stage rakeezx.sync_restore_stages%rowtype; v_receipt rakeezx.sync_restore_receipts%rowtype;
  v_operation jsonb; v_entity text; v_id text; v_action text; v_patch jsonb; v_columns text:=''; v_values text:='';
  v_sets text:=''; v_field text; v_sql text; v_row jsonb; v_result jsonb; v_canonical jsonb;
begin
  if v_owner is null then raise exception using errcode='42501',message='Authentication required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_owner::text||':restore:'||p_restore_id,0));
  select * into v_receipt from rakeezx.sync_restore_receipts where owner_id=v_owner and restore_id=p_restore_id;
  if found then
    if (v_receipt.backup_hash,v_receipt.stage_hash) is distinct from (p_backup_hash,p_expected_stage_hash) then
      raise exception using errcode='22023',message='Restore receipt request mismatch'; end if;
    return v_receipt.result;
  end if;
  select * into v_stage from rakeezx.sync_restore_stages where owner_id=v_owner and restore_id=p_restore_id for update;
  if not found or (v_stage.backup_hash,v_stage.stage_hash) is distinct from (p_backup_hash,p_expected_stage_hash) then
    raise exception using errcode='22023',message='Restore stage not found or hash mismatch'; end if;
  if v_stage.source_manifest is distinct from rakeezx.sync_v2_restore_manifest(v_owner) then
    raise exception using errcode='40001',message='Canonical source changed after restore staging'; end if;

  perform set_config('rakeezx.sync_v2_attendance_snapshot','on',true);
  perform set_config('rakeezx.section_lifecycle_write','on',true);
  perform set_config('rakeezx.section_lifecycle_delete','on',true);

  for v_operation in select value from jsonb_array_elements(v_stage.operations) loop
    v_entity:=v_operation->>'entity'; v_id:=v_operation->>'recordId'; v_action:=v_operation->>'operation';
    v_patch:=coalesce(v_operation->'patch','{}'::jsonb); v_columns:=''; v_values:=''; v_sets:='';
    if v_entity='profile' then select to_jsonb(t) into v_row from rakeezx.profile t where owner_id=v_owner for update;
    else execute format('select to_jsonb(t) from rakeezx.%I t where owner_id=$1 and id=$2 for update',v_entity) into v_row using v_owner,v_id; end if;
    if (v_action='create' and v_row is not null) or
       (v_action<>'create' and (v_row is null or (v_row->>'deleted_at') is not null or
        (v_row->>'revision')::bigint<>(v_operation->>'baseRevision')::bigint)) then
      raise exception using errcode='40001',message='Canonical source changed during restore finalization';
    end if;
    if v_action='create' then
      for v_field in select jsonb_object_keys(v_patch) order by 1 loop
        v_columns:=v_columns||format(',%I',v_field); v_values:=v_values||format(',p.%I',v_field);
      end loop;
      if v_entity='profile' then
        v_sql:=format('insert into rakeezx.profile(owner_id,device_id,client_updated_at%s) select $1,$2,$3%s from jsonb_populate_record(null::rakeezx.profile,$4) p',v_columns,v_values);
        execute v_sql using v_owner,'restore:'||p_restore_id,(v_operation->>'clientUpdatedAt')::bigint,v_patch;
      else
        v_sql:=format('insert into rakeezx.%I(owner_id,id,device_id,client_updated_at%s) select $1,$2,$3,$4%s from jsonb_populate_record(null::rakeezx.%I,$5) p',v_entity,v_columns,v_values,v_entity);
        execute v_sql using v_owner,v_id,'restore:'||p_restore_id,(v_operation->>'clientUpdatedAt')::bigint,v_patch;
      end if;
    elsif v_action='delete' then
      if v_entity='profile' then update rakeezx.profile set deleted_at=clock_timestamp(),device_id='restore:'||p_restore_id where owner_id=v_owner;
      else execute format('update rakeezx.%I set deleted_at=clock_timestamp(),device_id=$1 where owner_id=$2 and id=$3',v_entity) using 'restore:'||p_restore_id,v_owner,v_id; end if;
    else
      for v_field in select jsonb_object_keys(v_patch) order by 1 loop
        if v_sets<>'' then v_sets:=v_sets||','; end if;
        v_sets:=v_sets||format('%I=(select p.%I from jsonb_populate_record(null::rakeezx.%I,$1) p)',v_field,v_field,v_entity);
      end loop;
      if v_sets='' then continue; end if;
      v_sets:=v_sets||',device_id=$2,client_updated_at=$3';
      if v_entity='profile' then execute 'update rakeezx.profile set '||v_sets||' where owner_id=$4' using v_patch,'restore:'||p_restore_id,(v_operation->>'clientUpdatedAt')::bigint,v_owner;
      else execute format('update rakeezx.%I set %s where owner_id=$4 and id=$5',v_entity,v_sets) using v_patch,'restore:'||p_restore_id,(v_operation->>'clientUpdatedAt')::bigint,v_owner,v_id; end if;
    end if;
  end loop;

  v_canonical:=rakeezx.sync_v2_restore_canonical(v_owner);
  v_result:=jsonb_build_object('restoreId',p_restore_id,'backupHash',p_backup_hash,'stageHash',p_expected_stage_hash,
    'receipt',jsonb_build_object('restoreId',p_restore_id,'status','finalized'),'canonical',v_canonical);
  insert into rakeezx.sync_restore_receipts(owner_id,restore_id,backup_hash,stage_hash,result)
    values(v_owner,p_restore_id,p_backup_hash,p_expected_stage_hash,v_result);
  update rakeezx.sync_restore_stages set state='finalized',finalized_at=clock_timestamp()
    where owner_id=v_owner and restore_id=p_restore_id;
  return v_result;
end; $$;
revoke all on function rakeezx.finalize_sync_v2_restore(text,text,text) from public;
grant execute on function rakeezx.finalize_sync_v2_restore(text,text,text) to authenticated;

commit;
