-- RAKEEZ X — additive curriculum Sync V2 + guarded historical bootstrap.
-- No Product ids or Product fields are rewritten by this migration.

set lock_timeout = '10s';

begin;

alter table rakeezx.units
  add column if not exists revision bigint not null default 1 check (revision >= 1),
  add column if not exists field_revisions jsonb not null default '{}'::jsonb
    check (pg_catalog.jsonb_typeof(field_revisions) = 'object');
alter table rakeezx.lessons
  add column if not exists revision bigint not null default 1 check (revision >= 1),
  add column if not exists field_revisions jsonb not null default '{}'::jsonb
    check (pg_catalog.jsonb_typeof(field_revisions) = 'object');

alter function rakeezx.sync_v2_field_map(text)
  rename to sync_v2_field_map_before_curriculum_0031;
create function rakeezx.sync_v2_field_map(p_entity text) returns jsonb
language sql immutable set search_path = '' as $$
  select case p_entity
    when 'units' then '{
      "subject_id":"identity","grade":"identity","term_index":"identity",
      "name":"content","order":"order","planned_sessions":"planning"
    }'::jsonb
    when 'lessons' then '{
      "unit_id":"identity","name":"content","order":"order","planned_sessions":"planning"
    }'::jsonb
    else rakeezx.sync_v2_field_map_before_curriculum_0031(p_entity)
  end;
$$;
revoke all on function rakeezx.sync_v2_field_map_before_curriculum_0031(text) from public;

-- Backfill protocol metadata without firing the historical updated_at triggers.
alter table rakeezx.units disable trigger units_touch;
alter table rakeezx.lessons disable trigger lessons_touch;
update rakeezx.units set field_revisions = rakeezx.sync_v2_initial_field_revisions('units', revision)
  where field_revisions = '{}'::jsonb;
update rakeezx.lessons set field_revisions = rakeezx.sync_v2_initial_field_revisions('lessons', revision)
  where field_revisions = '{}'::jsonb;
alter table rakeezx.units enable trigger units_touch;
alter table rakeezx.lessons enable trigger lessons_touch;

drop trigger if exists units_sync_v2_revision on rakeezx.units;
create trigger units_sync_v2_revision before insert or update on rakeezx.units
  for each row execute function rakeezx.sync_v2_stamp_revision();
drop trigger if exists lessons_sync_v2_revision on rakeezx.lessons;
create trigger lessons_sync_v2_revision before insert or update on rakeezx.lessons
  for each row execute function rakeezx.sync_v2_stamp_revision();

-- The deployed backup restore RPCs retain sync_v2_restore_entities().
-- Compatible Initial Restore clients explicitly opt into this full contract.
create or replace function rakeezx.sync_v2_restore_entities_full() returns text[]
language sql immutable security definer set search_path = '' as $$
  select array['profile','years','calendars','calendar_days','terms','subjects','units','lessons',
    'sections','teachings','students','enrollments','notes','class_rules','class_charter_selections',
    'class_goals','group_arrangements','items','scores','logs','time_profiles','slots','sessions',
    'session_roster_snapshots','attendance','closed_term_reports']::text[];
$$;
revoke all on function rakeezx.sync_v2_restore_entities_full() from public;

create or replace function rakeezx.sync_v2_restore_manifest_full(p_owner uuid default auth.uid())
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_entity text; v_rows jsonb := '[]'::jsonb; v_part jsonb; v_sql text;
begin
  if p_owner is null or p_owner <> auth.uid() then
    raise exception using errcode='42501', message='Restore manifest owner mismatch';
  end if;
  foreach v_entity in array rakeezx.sync_v2_restore_entities_full() loop
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
revoke all on function rakeezx.sync_v2_restore_manifest_full(uuid) from public, anon;
grant execute on function rakeezx.sync_v2_restore_manifest_full(uuid) to authenticated;

create or replace function rakeezx.sync_v2_restore_canonical_full(p_owner uuid default auth.uid())
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_entity text; v_result jsonb := '{}'::jsonb; v_rows jsonb; v_sql text;
begin
  if p_owner is null or p_owner <> auth.uid() then
    raise exception using errcode='42501', message='Restore owner mismatch';
  end if;
  foreach v_entity in array rakeezx.sync_v2_restore_entities_full() loop
    if v_entity='profile' then
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) into v_rows
        from rakeezx.profile t where owner_id=p_owner;
    else
      v_sql:=format('select coalesce(jsonb_agg(to_jsonb(t) order by id), ''[]''::jsonb) from rakeezx.%I t where owner_id=$1',v_entity);
      execute v_sql into v_rows using p_owner;
    end if;
    v_result:=v_result||jsonb_build_object(v_entity,v_rows);
  end loop;
  return v_result;
end; $$;
revoke all on function rakeezx.sync_v2_restore_canonical_full(uuid) from public, anon;
grant execute on function rakeezx.sync_v2_restore_canonical_full(uuid) to authenticated;

create table if not exists rakeezx.curriculum_sync_bootstraps (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  protocol_version integer not null default 1 check (protocol_version = 1),
  bootstrap_id text not null check (char_length(bootstrap_id) between 1 and 240),
  state text not null check (state in ('NOT_STARTED','IN_PROGRESS','COMPLETE','CONFLICT','FAILED')),
  authoritative_source_device_id text not null check (char_length(authoritative_source_device_id) between 1 and 200),
  accepted_contributions jsonb not null default '[]'::jsonb check (jsonb_typeof(accepted_contributions)='array'),
  unit_count integer not null default 0 check (unit_count >= 0),
  lesson_count integer not null default 0 check (lesson_count >= 0),
  conflict_evidence jsonb not null default '[]'::jsonb check (jsonb_typeof(conflict_evidence)='array'),
  started_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  completed_at timestamptz
);
alter table rakeezx.curriculum_sync_bootstraps enable row level security;
alter table rakeezx.curriculum_sync_bootstraps force row level security;
revoke all on table rakeezx.curriculum_sync_bootstraps from public, anon, authenticated;

create or replace function rakeezx.curriculum_sync_normalize(p_entity text, p_row jsonb)
returns jsonb language plpgsql immutable security definer set search_path = '' as $$
begin
  if p_entity='units' then
    return jsonb_build_object('id',p_row->>'id','subject_id',p_row->>'subject_id',
      'grade',(p_row->>'grade')::integer,'term_index',(p_row->>'term_index')::integer,
      'name',coalesce(p_row->>'name',''),'order',coalesce((p_row->>'order')::integer,0),
      'planned_sessions',coalesce((p_row->>'planned_sessions')::integer,0),
      'deleted',coalesce((p_row->>'deleted')::boolean,p_row->>'deleted_at' is not null,false));
  elsif p_entity='lessons' then
    return jsonb_build_object('id',p_row->>'id','unit_id',p_row->>'unit_id',
      'name',coalesce(p_row->>'name',''),'order',coalesce((p_row->>'order')::integer,0),
      'planned_sessions',coalesce((p_row->>'planned_sessions')::integer,1),
      'deleted',coalesce((p_row->>'deleted')::boolean,p_row->>'deleted_at' is not null,false));
  end if;
  raise exception using errcode='22023',message='Unknown curriculum entity';
end; $$;
revoke all on function rakeezx.curriculum_sync_normalize(text,jsonb) from public, anon, authenticated;

create or replace function rakeezx.curriculum_sync_bootstrap_result(p_owner uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'protocolVersion',b.protocol_version,'bootstrapId',b.bootstrap_id,'state',b.state,
    'authoritativeSourceDeviceId',b.authoritative_source_device_id,
    'unitCount',b.unit_count,'lessonCount',b.lesson_count,'conflicts',b.conflict_evidence,
    'startedAt',b.started_at,'updatedAt',b.updated_at,'completedAt',b.completed_at,
    'units',(select coalesce(jsonb_agg(to_jsonb(u) order by u.id),'[]'::jsonb) from rakeezx.units u where u.owner_id=p_owner),
    'lessons',(select coalesce(jsonb_agg(to_jsonb(l) order by l.id),'[]'::jsonb) from rakeezx.lessons l where l.owner_id=p_owner)
  ) from rakeezx.curriculum_sync_bootstraps b where b.owner_id=p_owner;
$$;
revoke all on function rakeezx.curriculum_sync_bootstrap_result(uuid) from public, anon, authenticated;

create or replace function rakeezx.get_curriculum_sync_bootstrap_status()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_owner uuid:=auth.uid(); v_result jsonb;
begin
  if v_owner is null then raise exception using errcode='42501',message='Authentication required'; end if;
  select jsonb_build_object(
    'protocolVersion',b.protocol_version,'bootstrapId',b.bootstrap_id,'state',b.state,
    'authoritativeSourceDeviceId',b.authoritative_source_device_id,
    'unitCount',b.unit_count,'lessonCount',b.lesson_count,'conflicts',b.conflict_evidence,
    'startedAt',b.started_at,'updatedAt',b.updated_at,'completedAt',b.completed_at
  ) into v_result from rakeezx.curriculum_sync_bootstraps b where b.owner_id=v_owner;
  return coalesce(v_result,jsonb_build_object('protocolVersion',1,'state','NOT_STARTED',
    'unitCount',0,'lessonCount',0,'conflicts','[]'::jsonb));
end; $$;
revoke all on function rakeezx.get_curriculum_sync_bootstrap_status() from public, anon;
grant execute on function rakeezx.get_curriculum_sync_bootstrap_status() to authenticated;

create or replace function rakeezx.contribute_curriculum_sync_bootstrap(
  p_bootstrap_id text, p_device_id text, p_snapshot_hash text,
  p_units jsonb, p_lessons jsonb, p_authoritative boolean default false
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid:=auth.uid(); v_state rakeezx.curriculum_sync_bootstraps%rowtype;
  v_conflicts jsonb:='[]'::jsonb; v_payload_hash text; v_existing boolean:=false;
begin
  if v_owner is null then raise exception using errcode='42501',message='Authentication required'; end if;
  if coalesce(p_bootstrap_id,'')='' or char_length(p_bootstrap_id)>240 or
     coalesce(p_device_id,'')='' or char_length(p_device_id)>200 or
     p_snapshot_hash !~ '^[0-9a-f]{64}$' or jsonb_typeof(p_units)<>'array' or jsonb_typeof(p_lessons)<>'array' or
     jsonb_array_length(p_units)>5000 or jsonb_array_length(p_lessons)>20000 then
    raise exception using errcode='22023',message='Invalid curriculum bootstrap envelope';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_owner::text||':curriculum-bootstrap',0));
  select * into v_state from rakeezx.curriculum_sync_bootstraps where owner_id=v_owner for update;
  v_existing:=found;
  if v_existing and v_state.bootstrap_id<>p_bootstrap_id then
    raise exception using errcode='22023',message='Curriculum bootstrap identity mismatch';
  end if;
  if not v_existing and not p_authoritative then
    raise exception using errcode='22023',message='Authoritative curriculum bootstrap is required first';
  end if;
  if v_existing and v_state.state in ('CONFLICT','FAILED') then return rakeezx.curriculum_sync_bootstrap_result(v_owner); end if;
  v_payload_hash:=encode(sha256(convert_to(jsonb_build_object(
    'version',1,'units',p_units,'lessons',p_lessons)::text,'UTF8')),'hex');
  if v_existing and exists(select 1 from jsonb_array_elements(v_state.accepted_contributions) c
      where c->>'snapshotHash'=p_snapshot_hash) then
    if exists(select 1 from jsonb_array_elements(v_state.accepted_contributions) c
        where c->>'snapshotHash'=p_snapshot_hash and c->>'payloadHash'=v_payload_hash) then
      return rakeezx.curriculum_sync_bootstrap_result(v_owner);
    end if;
    raise exception using errcode='22023',message='Curriculum snapshot hash reused with different content';
  end if;

  if exists(select 1 from jsonb_array_elements(p_units) r where
      coalesce(r->>'id','')='' or coalesce(r->>'subject_id','')='' or
      (r->>'grade')::integer not between 1 and 12 or (r->>'term_index')::integer not between 1 and 6 or
      coalesce(r->>'name','')='' or (r->>'order')::integer<0 or (r->>'planned_sessions')::integer<0) or
     exists(select 1 from jsonb_array_elements(p_lessons) r where
      coalesce(r->>'id','')='' or coalesce(r->>'unit_id','')='' or coalesce(r->>'name','')='' or
      (r->>'order')::integer<0 or (r->>'planned_sessions')::integer<0) then
    raise exception using errcode='22023',message='Invalid curriculum bootstrap row';
  end if;
  if (select count(*) from jsonb_array_elements(p_units)) <>
       (select count(distinct r->>'id') from jsonb_array_elements(p_units) r) or
     (select count(*) from jsonb_array_elements(p_lessons)) <>
       (select count(distinct r->>'id') from jsonb_array_elements(p_lessons) r) then
    raise exception using errcode='22023',message='Duplicate curriculum bootstrap id';
  end if;

  if exists(select 1 from jsonb_array_elements(p_units) r where coalesce((r->>'deleted')::boolean,false)=false
      and not exists(select 1 from rakeezx.subjects s where s.owner_id=v_owner and s.id=r->>'subject_id' and s.deleted_at is null)) or
     exists(select 1 from jsonb_array_elements(p_lessons) r where coalesce((r->>'deleted')::boolean,false)=false
      and not exists(select 1 from jsonb_array_elements(p_units) u where u->>'id'=r->>'unit_id'
        and coalesce((u->>'deleted')::boolean,false)=false)
      and not exists(select 1 from rakeezx.units u where u.owner_id=v_owner and u.id=r->>'unit_id' and u.deleted_at is null)) then
    raise exception using errcode='23503',message='Invalid curriculum bootstrap reference';
  end if;

  select coalesce(jsonb_agg(x),'[]'::jsonb) into v_conflicts from (
    select jsonb_build_object('entity','units','id',u.id,'reason','same-id-different-content') x
      from rakeezx.units u join jsonb_array_elements(p_units) r on r->>'id'=u.id
      where u.owner_id=v_owner and rakeezx.curriculum_sync_normalize('units',to_jsonb(u))
        is distinct from rakeezx.curriculum_sync_normalize('units',r)
    union all
    select jsonb_build_object('entity','lessons','id',l.id,'reason','same-id-different-content')
      from rakeezx.lessons l join jsonb_array_elements(p_lessons) r on r->>'id'=l.id
      where l.owner_id=v_owner and rakeezx.curriculum_sync_normalize('lessons',to_jsonb(l))
        is distinct from rakeezx.curriculum_sync_normalize('lessons',r)
  ) conflicts;
  if jsonb_array_length(v_conflicts)>0 then
    if not v_existing then
      insert into rakeezx.curriculum_sync_bootstraps(owner_id,bootstrap_id,state,authoritative_source_device_id,conflict_evidence)
        values(v_owner,p_bootstrap_id,'CONFLICT',p_device_id,v_conflicts);
    else
      update rakeezx.curriculum_sync_bootstraps set state='CONFLICT',conflict_evidence=v_conflicts,
        updated_at=clock_timestamp() where owner_id=v_owner;
    end if;
    return rakeezx.curriculum_sync_bootstrap_result(v_owner);
  end if;

  insert into rakeezx.units(owner_id,id,subject_id,grade,term_index,name,"order",planned_sessions,
      client_updated_at,device_id,deleted_at)
    select v_owner,r->>'id',r->>'subject_id',(r->>'grade')::integer,(r->>'term_index')::integer,
      r->>'name',(r->>'order')::integer,(r->>'planned_sessions')::integer,
      nullif(r->>'client_updated_at','')::bigint,p_device_id,
      case when coalesce((r->>'deleted')::boolean,false) then clock_timestamp() end
    from jsonb_array_elements(p_units) r
    where not exists(select 1 from rakeezx.units u where u.owner_id=v_owner and u.id=r->>'id');
  insert into rakeezx.lessons(owner_id,id,unit_id,name,"order",planned_sessions,
      client_updated_at,device_id,deleted_at)
    select v_owner,r->>'id',r->>'unit_id',r->>'name',(r->>'order')::integer,
      (r->>'planned_sessions')::integer,nullif(r->>'client_updated_at','')::bigint,p_device_id,
      case when coalesce((r->>'deleted')::boolean,false) then clock_timestamp() end
    from jsonb_array_elements(p_lessons) r
    where not exists(select 1 from rakeezx.lessons l where l.owner_id=v_owner and l.id=r->>'id');

  if not v_existing then
    insert into rakeezx.curriculum_sync_bootstraps(owner_id,bootstrap_id,state,authoritative_source_device_id,
      accepted_contributions,unit_count,lesson_count)
    values(v_owner,p_bootstrap_id,'IN_PROGRESS',p_device_id,
      jsonb_build_array(jsonb_build_object('deviceId',p_device_id,'snapshotHash',p_snapshot_hash,'payloadHash',v_payload_hash)),
      (select count(*) from rakeezx.units where owner_id=v_owner),(select count(*) from rakeezx.lessons where owner_id=v_owner));
  else
    update rakeezx.curriculum_sync_bootstraps set
      accepted_contributions=accepted_contributions||jsonb_build_array(jsonb_build_object(
        'deviceId',p_device_id,'snapshotHash',p_snapshot_hash,'payloadHash',v_payload_hash)),
      unit_count=(select count(*) from rakeezx.units where owner_id=v_owner),
      lesson_count=(select count(*) from rakeezx.lessons where owner_id=v_owner),updated_at=clock_timestamp()
      where owner_id=v_owner;
  end if;
  return rakeezx.curriculum_sync_bootstrap_result(v_owner);
end; $$;
revoke all on function rakeezx.contribute_curriculum_sync_bootstrap(text,text,text,jsonb,jsonb,boolean) from public, anon;
grant execute on function rakeezx.contribute_curriculum_sync_bootstrap(text,text,text,jsonb,jsonb,boolean) to authenticated;

create or replace function rakeezx.finalize_curriculum_sync_bootstrap(
  p_bootstrap_id text,p_device_id text,p_snapshot_hash text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_owner uuid:=auth.uid(); v_state rakeezx.curriculum_sync_bootstraps%rowtype;
begin
  if v_owner is null then raise exception using errcode='42501',message='Authentication required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_owner::text||':curriculum-bootstrap',0));
  select * into v_state from rakeezx.curriculum_sync_bootstraps where owner_id=v_owner for update;
  if not found or v_state.bootstrap_id<>p_bootstrap_id then
    raise exception using errcode='22023',message='Curriculum bootstrap identity mismatch';
  end if;
  if v_state.state='COMPLETE' then return rakeezx.curriculum_sync_bootstrap_result(v_owner); end if;
  if v_state.state<>'IN_PROGRESS' or v_state.authoritative_source_device_id<>p_device_id or
     not exists(select 1 from jsonb_array_elements(v_state.accepted_contributions) c
       where c->>'deviceId'=p_device_id and c->>'snapshotHash'=p_snapshot_hash) then
    raise exception using errcode='22023',message='Curriculum bootstrap cannot be finalized';
  end if;
  update rakeezx.curriculum_sync_bootstraps set state='COMPLETE',updated_at=clock_timestamp(),
    completed_at=clock_timestamp(),conflict_evidence='[]'::jsonb where owner_id=v_owner;
  return rakeezx.curriculum_sync_bootstrap_result(v_owner);
end; $$;
revoke all on function rakeezx.finalize_curriculum_sync_bootstrap(text,text,text) from public, anon;
grant execute on function rakeezx.finalize_curriculum_sync_bootstrap(text,text,text) to authenticated;

commit;
