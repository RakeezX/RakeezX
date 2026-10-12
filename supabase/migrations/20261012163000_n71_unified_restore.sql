-- AI-authored N71: additive, versioned all-portable-domain restore.
-- Existing restore endpoints, stage/receipt primary keys and applied migrations stay unchanged.
set lock_timeout='10s';
begin;
create table rakeezx.assignments (
  owner_id uuid not null default auth.uid() references auth.users(id),
  id text not null, teaching_id text not null, lesson_id text, item_id text,
  title text not null default '', assigned_date date not null, due_date date,
  max numeric(6,2) not null default 10 check(max>=0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  client_updated_at bigint, device_id text, deleted_at timestamptz,
  revision bigint not null default 1 check(revision>=1),
  field_revisions jsonb not null default '{}'::jsonb check(jsonb_typeof(field_revisions)='object'),
  primary key(owner_id,id),
  foreign key(owner_id,teaching_id) references rakeezx.teachings(owner_id,id),
  foreign key(owner_id,lesson_id) references rakeezx.lessons(owner_id,id),
  foreign key(owner_id,item_id) references rakeezx.items(owner_id,id)
);
create table rakeezx.submissions (
  owner_id uuid not null default auth.uid() references auth.users(id),
  id text not null, student_id text not null, assignment_id text not null,
  status text not null default 'pending' check(status in ('pending','submitted','late','missing')),
  score numeric(6,2) check(score>=0), note text not null default '',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  client_updated_at bigint, device_id text, deleted_at timestamptz,
  revision bigint not null default 1 check(revision>=1),
  field_revisions jsonb not null default '{}'::jsonb check(jsonb_typeof(field_revisions)='object'),
  primary key(owner_id,id), unique(owner_id,student_id,assignment_id),
  foreign key(owner_id,student_id) references rakeezx.students(owner_id,id),
  foreign key(owner_id,assignment_id) references rakeezx.assignments(owner_id,id)
);
alter function rakeezx.sync_v2_field_map(text) rename to sync_v2_field_map_before_n71;
create function rakeezx.sync_v2_field_map(p_entity text) returns jsonb
language sql immutable security definer set search_path='' as $$
select case p_entity
when 'assignments' then '{"teaching_id":"identity","lesson_id":"identity","item_id":"identity","title":"content","assigned_date":"dates","due_date":"dates","max":"grading"}'::jsonb
when 'submissions' then '{"student_id":"identity","assignment_id":"identity","status":"content","score":"content","note":"content"}'::jsonb
else rakeezx.sync_v2_field_map_before_n71(p_entity) end;
$$;
revoke all on function rakeezx.sync_v2_field_map_before_n71(text) from public,anon,authenticated;
revoke all on function rakeezx.sync_v2_field_map(text) from public,anon,authenticated;

create function rakeezx.n71_guard_portable_parent() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_teaching text; v_assignment rakeezx.assignments%rowtype;
begin
  if tg_op='INSERT' then new.owner_id:=auth.uid(); end if;
  if new.deleted_at is not null then return new; end if;
  if tg_table_name='submissions' then
    select * into v_assignment from rakeezx.assignments where owner_id=new.owner_id and id=new.assignment_id and deleted_at is null;
    if not found or not exists(select 1 from rakeezx.students where owner_id=new.owner_id and id=new.student_id and deleted_at is null) then
      raise exception using errcode='23503',message='N71 portable parent is unavailable'; end if;
    if new.score>v_assignment.max then raise exception using errcode='22023',message='N71 submission score exceeds maximum'; end if;
    v_teaching:=v_assignment.teaching_id;
  else
    v_teaching:=new.teaching_id;
    if exists(select 1 from rakeezx.submissions where owner_id=new.owner_id
      and assignment_id=new.id and deleted_at is null and score>new.max) then
      raise exception using errcode='22023',message='N71 assignment maximum would invalidate a submission'; end if;
    if new.lesson_id is not null and not exists(select 1 from rakeezx.lessons l join rakeezx.units u
      on u.owner_id=l.owner_id and u.id=l.unit_id join rakeezx.teachings t
      on t.owner_id=u.owner_id and t.subject_id=u.subject_id
      where l.owner_id=new.owner_id and l.id=new.lesson_id and t.id=v_teaching
        and l.deleted_at is null and u.deleted_at is null) then
      raise exception using errcode='23503',message='N71 lesson scope is unavailable'; end if;
    if new.item_id is not null and not exists(select 1 from rakeezx.items
      where owner_id=new.owner_id and id=new.item_id and teaching_id=v_teaching and deleted_at is null) then
      raise exception using errcode='23503',message='N71 item scope is unavailable'; end if;
  end if;
  if not exists(select 1 from rakeezx.teachings t join rakeezx.sections s
    on s.owner_id=t.owner_id and s.id=t.section_id join rakeezx.terms tm
    on tm.owner_id=t.owner_id and tm.id=t.term_id join rakeezx.years y
    on y.owner_id=tm.owner_id and y.id=tm.year_id
    where t.owner_id=new.owner_id and t.id=v_teaching and t.deleted_at is null
      and s.deleted_at is null and s.status='active' and tm.deleted_at is null
      and tm.status<>'closed' and y.deleted_at is null) then
    raise exception using errcode='23503',message='N71 teaching scope is unavailable or closed'; end if;
  return new;
end; $$;
revoke all on function rakeezx.n71_guard_portable_parent() from public,anon,authenticated;

alter table rakeezx.assignments enable row level security;
alter table rakeezx.assignments force row level security;
revoke all on rakeezx.assignments from public,anon,authenticated;
grant select on rakeezx.assignments to authenticated;
create policy assignments_select on rakeezx.assignments for select to authenticated using(owner_id=(select auth.uid()));
create trigger "00_student_lifecycle_statement_lock" before insert or update or delete on rakeezx.assignments
for each statement execute function rakeezx.lock_student_lifecycle_statement();
create trigger "01_n71_portable_parent" before insert or update on rakeezx.assignments
for each row execute function rakeezx.n71_guard_portable_parent();
create trigger assignments_owner before insert on rakeezx.assignments for each row execute function rakeezx.force_owner();
create trigger assignments_sync_v2_revision before insert or update on rakeezx.assignments for each row execute function rakeezx.sync_v2_stamp_revision();
create trigger assignments_touch before insert or update on rakeezx.assignments for each row execute function rakeezx.touch_updated_at();
create trigger owner_sync_change after insert or update or delete on rakeezx.assignments for each row execute function rakeezx.record_owner_sync_change();

alter table rakeezx.submissions enable row level security;
alter table rakeezx.submissions force row level security;
revoke all on rakeezx.submissions from public,anon,authenticated;
grant select on rakeezx.submissions to authenticated;
create policy submissions_select on rakeezx.submissions for select to authenticated using(owner_id=(select auth.uid()));
create trigger "00_student_lifecycle_statement_lock" before insert or update or delete on rakeezx.submissions
for each statement execute function rakeezx.lock_student_lifecycle_statement();
create trigger "01_n71_portable_parent" before insert or update on rakeezx.submissions
for each row execute function rakeezx.n71_guard_portable_parent();
create trigger submissions_owner before insert on rakeezx.submissions for each row execute function rakeezx.force_owner();
create trigger submissions_sync_v2_revision before insert or update on rakeezx.submissions for each row execute function rakeezx.sync_v2_stamp_revision();
create trigger submissions_touch before insert or update on rakeezx.submissions for each row execute function rakeezx.touch_updated_at();
create trigger owner_sync_change after insert or update or delete on rakeezx.submissions for each row execute function rakeezx.record_owner_sync_change();

create function rakeezx.n71_restore_entities() returns text[]
language sql immutable security definer set search_path='' as $$
select rakeezx.sync_v2_restore_entities_score_v2() || array['assignments','submissions']::text[];
$$;
create function rakeezx.n71_restore_manifest(p_owner uuid default auth.uid()) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_rows jsonb; v_entity text; v_part jsonb;
begin
  if p_owner is null or p_owner<>auth.uid() then raise exception using errcode='42501',message='N71 owner mismatch'; end if;
  v_rows:=rakeezx.sync_v2_restore_manifest_score_v2(p_owner);
  foreach v_entity in array array['assignments','submissions'] loop
    execute format('select coalesce(jsonb_agg(jsonb_build_object(''entity'',%L,''id'',id,''revision'',revision,''deleted'',deleted_at is not null) order by id),''[]''::jsonb) from rakeezx.%I where owner_id=$1',v_entity,v_entity)
      into v_part using p_owner;
    v_rows:=v_rows||v_part;
  end loop;
  return v_rows||'[{"entity":"__n71__","id":"N71_V1","revision":1,"deleted":false}]'::jsonb;
end; $$;
create function rakeezx.n71_restore_canonical(p_owner uuid default auth.uid()) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_rows jsonb; v_entity text; v_part jsonb;
begin
  if p_owner is null or p_owner<>auth.uid() then raise exception using errcode='42501',message='N71 owner mismatch'; end if;
  v_rows:=rakeezx.sync_v2_restore_canonical_score_v2(p_owner);
  foreach v_entity in array array['assignments','submissions'] loop
    execute format('select coalesce(jsonb_agg(to_jsonb(t) order by id),''[]''::jsonb) from rakeezx.%I t where owner_id=$1',v_entity)
      into v_part using p_owner;
    v_rows:=v_rows||jsonb_build_object(v_entity,v_part);
  end loop;
  return v_rows;
end; $$;
create function rakeezx.n71_restore_capability() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception using errcode='42501',message='Authentication required'; end if;
  return jsonb_build_object('protocol','N71_V1','entities',rakeezx.n71_restore_entities(),'backupVersions',jsonb_build_array(3,4,5));
end; $$;

-- Restore-only scope guard follows current owner-qualified Product FKs. It
-- does not modify ordinary lifecycle triggers or grant a deletion bypass.
create function rakeezx.n71_assert_restore_scope(p_owner uuid,p_entity text,p_row jsonb,
  p_manifest jsonb,p_seen text[] default '{}'::text[]) returns void
language plpgsql stable security definer set search_path='' as $$
declare v_fk record; v_parent jsonb; v_key text:=p_entity||':'||coalesce(p_row->>'id','profile');
begin
  if p_owner is null or p_owner<>auth.uid() then raise exception using errcode='42501',message='N71 owner mismatch'; end if;
  if v_key=any(p_seen) then return; end if;
  if p_row->>'deleted_at' is not null then raise exception using errcode='23503',message='N71 deleted restore scope'; end if;
  if p_entity='terms' and p_row->>'status'='closed' and exists(select 1 from jsonb_array_elements(p_manifest) m
    where m->>'entity'='terms' and m->>'id'=p_row->>'id') then
    raise exception using errcode='23503',message='N71 immutable closed-term restore scope'; end if;
  for v_fk in select parent.relname parent_entity,child_col.attname child_field from pg_constraint fk
    join pg_class child on child.oid=fk.conrelid join pg_namespace cn on cn.oid=child.relnamespace
    join pg_class parent on parent.oid=fk.confrelid join pg_namespace pn on pn.oid=parent.relnamespace
    cross join lateral generate_subscripts(fk.conkey,1) k
    join pg_attribute child_col on child_col.attrelid=child.oid and child_col.attnum=fk.conkey[k]
    join pg_attribute parent_col on parent_col.attrelid=parent.oid and parent_col.attnum=fk.confkey[k]
    where fk.contype='f' and cn.nspname='rakeezx' and child.relname=p_entity
      and pn.nspname='rakeezx' and parent_col.attname='id' loop
    if p_row->>v_fk.child_field is null then continue; end if;
    execute format('select to_jsonb(t) from rakeezx.%I t where owner_id=$1 and id=$2',v_fk.parent_entity)
      into v_parent using p_owner,p_row->>v_fk.child_field;
    if v_parent is null then raise exception using errcode='23503',message='N71 restore parent missing'; end if;
    perform rakeezx.n71_assert_restore_scope(p_owner,v_fk.parent_entity,v_parent,p_manifest,array_append(p_seen,v_key));
  end loop;
end; $$;
revoke all on function rakeezx.n71_assert_restore_scope(uuid,text,jsonb,jsonb,text[]) from public,anon,authenticated;

-- Reuses the deployed checked stage algorithm with the full versioned manifest.
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

-- Same atomic finalize, score and N58 calendar guards; existing receipts are not rewritten.
CREATE OR REPLACE FUNCTION rakeezx.finalize_n71_restore(p_restore_id text, p_backup_hash text, p_expected_stage_hash text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_owner uuid:=auth.uid(); v_stage rakeezx.sync_restore_stages%rowtype;
  v_receipt rakeezx.sync_restore_receipts%rowtype; v_operation jsonb;
  v_entity text; v_id text; v_action text; v_patch jsonb; v_columns text; v_values text;
  v_calendar record; v_year record; v_sets text; v_field text; v_sql text; v_row jsonb; v_canonical jsonb; v_result jsonb;
begin
  if v_owner is null then raise exception using errcode='42501',message='Authentication required'; end if;
  perform rakeezx.lock_student_lifecycle(v_owner);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_owner::text||':restore:'||p_restore_id,0));
  select * into v_receipt from rakeezx.sync_restore_receipts where owner_id=v_owner and restore_id=p_restore_id;
  if found then
    if (v_receipt.backup_hash,v_receipt.stage_hash) is distinct from
      (p_backup_hash,p_expected_stage_hash) then
      raise exception using errcode='22023',message='V5 restore receipt mismatch'; end if;
    if v_receipt.result->>'protocol' is distinct from 'N71_V1' then
      raise exception using errcode='22023',message='N71 receipt protocol mismatch'; end if;
    return v_receipt.result;
  end if;
  select * into v_stage from rakeezx.sync_restore_stages
    where owner_id=v_owner and restore_id=p_restore_id for update;
  if not found or v_stage.backup_version not in (3,4,5) or
    (v_stage.backup_hash,v_stage.stage_hash) is distinct from
      (p_backup_hash,p_expected_stage_hash) then
    raise exception using errcode='22023',message='V5 restore stage mismatch'; end if;
  if v_stage.source_manifest is distinct from rakeezx.n71_restore_manifest(v_owner) then
    raise exception using errcode='40001',message='Canonical source changed after V5 staging'; end if;
  insert into rakeezx.n58_restore_transactions values(v_owner,pg_catalog.txid_current(),p_restore_id);
  perform pg_catalog.set_config('rakeezx.sync_v2_attendance_snapshot','on',true);
  perform pg_catalog.set_config('rakeezx.section_lifecycle_write','on',true);
  perform pg_catalog.set_config('rakeezx.section_lifecycle_delete','on',true);
  perform pg_catalog.set_config('rakeezx.score_domain_write','on',true);
  for v_operation in select value from pg_catalog.jsonb_array_elements(v_stage.operations) loop
    v_entity:=v_operation->>'entity'; v_id:=v_operation->>'recordId';
    v_action:=v_operation->>'operation'; v_patch:=coalesce(v_operation->'patch','{}'::jsonb);
    v_columns:=''; v_values:=''; v_sets:='';
    if v_entity='profile' then
      select pg_catalog.to_jsonb(t) into v_row from rakeezx.profile t where owner_id=v_owner for update;
    else
      execute pg_catalog.format('select pg_catalog.to_jsonb(t) from rakeezx.%I t
        where owner_id=$1 and id=$2 for update',v_entity) into v_row using v_owner,v_id;
    end if;
    if (v_action in ('create','create_deleted') and v_row is not null) or
      (v_action not in ('create','create_deleted') and
        (v_row is null or (v_row->>'deleted_at') is not null or
        (v_row->>'revision')::bigint<>(v_operation->>'baseRevision')::bigint)) then
      raise exception using errcode='40001',message='Canonical source changed during V5 finalize'; end if;
    if v_action not in ('delete','create_deleted') then
      perform rakeezx.n71_assert_restore_scope(v_owner,v_entity,
        coalesce(v_row,'{}'::jsonb)||v_patch||jsonb_build_object('id',v_id),v_stage.source_manifest);
    end if;
    if v_action in ('create','create_deleted') then
      for v_field in select pg_catalog.jsonb_object_keys(v_patch) order by 1 loop
        v_columns:=v_columns||pg_catalog.format(',%I',v_field);
        v_values:=v_values||pg_catalog.format(',p.%I',v_field);
      end loop;
      if v_action='create_deleted' then
        v_columns:=v_columns||',deleted_at';
        v_values:=v_values||',pg_catalog.clock_timestamp()';
      end if;
      if v_entity='profile' then
        v_sql:=pg_catalog.format('insert into rakeezx.profile(owner_id,device_id,client_updated_at%s)
          select $1,$2,$3%s from pg_catalog.jsonb_populate_record(null::rakeezx.profile,$4) p',v_columns,v_values);
        execute v_sql using v_owner,'restore:'||p_restore_id,(v_operation->>'clientUpdatedAt')::bigint,v_patch;
      else
        v_sql:=pg_catalog.format('insert into rakeezx.%I(owner_id,id,device_id,client_updated_at%s)
          select $1,$2,$3,$4%s from pg_catalog.jsonb_populate_record(null::rakeezx.%I,$5) p',
          v_entity,v_columns,v_values,v_entity);
        execute v_sql using v_owner,v_id,'restore:'||p_restore_id,
          (v_operation->>'clientUpdatedAt')::bigint,v_patch;
      end if;
    elsif v_action='delete' then
      if v_entity='profile' then
        update rakeezx.profile set deleted_at=pg_catalog.clock_timestamp(),
          device_id='restore:'||p_restore_id where owner_id=v_owner;
      else
        execute pg_catalog.format('update rakeezx.%I set deleted_at=pg_catalog.clock_timestamp(),
          device_id=$1 where owner_id=$2 and id=$3',v_entity)
          using 'restore:'||p_restore_id,v_owner,v_id;
      end if;
    else
      for v_field in select pg_catalog.jsonb_object_keys(v_patch) order by 1 loop
        if v_sets<>'' then v_sets:=v_sets||','; end if;
        v_sets:=v_sets||pg_catalog.format('%I=(select p.%I from pg_catalog.jsonb_populate_record(null::rakeezx.%I,$1) p)',
          v_field,v_field,v_entity);
      end loop;
      if v_sets='' then continue; end if;
      v_sets:=v_sets||',device_id=$2,client_updated_at=$3';
      if v_entity='profile' then
        execute 'update rakeezx.profile set '||v_sets||' where owner_id=$4'
          using v_patch,'restore:'||p_restore_id,(v_operation->>'clientUpdatedAt')::bigint,v_owner;
      else
        execute pg_catalog.format('update rakeezx.%I set %s where owner_id=$4 and id=$5',v_entity,v_sets)
          using v_patch,'restore:'||p_restore_id,(v_operation->>'clientUpdatedAt')::bigint,v_owner,v_id;
      end if;
    end if;
  end loop;
  for v_year in select y.* from rakeezx.years y where y.owner_id=v_owner
    and y.calendar_preset_id is not null and rakeezx.n58_restore_creating_year(v_owner,y.id) loop
    if (select count(*) from rakeezx.terms t where t.owner_id=v_owner and t.year_id=v_year.id
      and t."index" in (1,2) and t.deleted_at is null)<>2 then
      raise exception using errcode='22023',message='N58_EXISTING_TERMS_REQUIRED'; end if;
  end loop;
  for v_calendar in select c.* from rakeezx.calendars c where c.owner_id=v_owner
    and rakeezx.n58_restore_creating_year(v_owner,c.year_id) loop
    perform rakeezx.n58_validate_overrides(v_owner,v_calendar.year_id,v_calendar.preset_id,v_calendar.term_date_overrides);
  end loop;
  delete from rakeezx.n58_restore_transactions where owner_id=v_owner and transaction_id=pg_catalog.txid_current();
  perform rakeezx.assert_score_provenance_consistent(v_owner);
  if exists(select 1 from rakeezx.scores s join rakeezx.items i
    on i.owner_id=s.owner_id and i.id=s.item_id where s.owner_id=v_owner
    and s.deleted_at is null and i.deleted_at is null and (s.value<0 or s.value>i.max)) then
    raise exception using errcode='22023',message='N71 score exceeds current target maximum'; end if;
  v_canonical:=rakeezx.n71_restore_canonical(v_owner);
  v_result:=pg_catalog.jsonb_build_object('protocol','N71_V1','restoreId',p_restore_id,'backupHash',p_backup_hash,
    'stageHash',p_expected_stage_hash,
    'receipt',pg_catalog.jsonb_build_object('restoreId',p_restore_id,'status','finalized'),
    'canonical',v_canonical);
  insert into rakeezx.sync_restore_receipts(owner_id,restore_id,backup_hash,stage_hash,result)
    values(v_owner,p_restore_id,p_backup_hash,p_expected_stage_hash,v_result);
  update rakeezx.sync_restore_stages set state='finalized',finalized_at=pg_catalog.clock_timestamp()
    where owner_id=v_owner and restore_id=p_restore_id;
  return v_result;
end; $function$;

revoke all on function rakeezx.n71_restore_entities() from public,anon,authenticated;
revoke all on function rakeezx.n71_restore_manifest(uuid) from public,anon,authenticated;
grant execute on function rakeezx.n71_restore_manifest(uuid) to authenticated;
revoke all on function rakeezx.n71_restore_canonical(uuid) from public,anon,authenticated;
grant execute on function rakeezx.n71_restore_canonical(uuid) to authenticated;
revoke all on function rakeezx.n71_restore_capability() from public,anon,authenticated;
grant execute on function rakeezx.n71_restore_capability() to authenticated;
revoke all on function rakeezx.stage_n71_restore(text,text,integer,jsonb,jsonb,uuid) from public,anon,authenticated;
grant execute on function rakeezx.stage_n71_restore(text,text,integer,jsonb,jsonb,uuid) to authenticated;
revoke all on function rakeezx.finalize_n71_restore(text,text,text) from public,anon,authenticated;
grant execute on function rakeezx.finalize_n71_restore(text,text,text) to authenticated;
notify pgrst,'reload schema';
commit;
