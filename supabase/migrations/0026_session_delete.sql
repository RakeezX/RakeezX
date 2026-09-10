-- RAKEEZ X — SESSION-DELETE-01: guarded, idempotent session tombstones.
-- No existing row is rewritten by this migration.

begin;

alter table rakeezx.sync_mutation_receipts
  drop constraint if exists sync_mutation_receipts_operation_check;
alter table rakeezx.sync_mutation_receipts
  add constraint sync_mutation_receipts_operation_check check(operation in
    ('create','patch','delete','enroll','transfer','withdraw','attendance','lifecycle','create_teaching',
     'fill_attendance','section_lifecycle','close_term_report','goal_reward','session_delete'));

create or replace function rakeezx.session_delete_blocker(p_owner uuid, p_session_id text)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_session rakeezx.sessions%rowtype;
begin
  select * into v_session from rakeezx.sessions
    where owner_id=p_owner and id=p_session_id and deleted_at is null;
  if not found then return 'not_found'; end if;
  if v_session.status <> 'scheduled' then return 'status'; end if;
  if v_session.makeup_for_id is not null or exists(
    select 1 from rakeezx.sessions s where s.owner_id=p_owner and s.deleted_at is null
      and s.id<>p_session_id and s.makeup_for_id=p_session_id
  ) then return 'makeup'; end if;
  if exists(select 1 from rakeezx.attendance a where a.owner_id=p_owner and a.session_id=p_session_id and a.deleted_at is null)
    then return 'attendance'; end if;
  if exists(select 1 from rakeezx.session_roster_snapshots r where r.owner_id=p_owner and r.session_id=p_session_id and r.deleted_at is null)
    then return 'roster_snapshot'; end if;
  if exists(select 1 from rakeezx.logs l where l.owner_id=p_owner and l.session_id=p_session_id and l.deleted_at is null)
    then return 'logs'; end if;
  if exists(select 1 from rakeezx.notes n where n.owner_id=p_owner and n.session_id=p_session_id and n.deleted_at is null)
    then return 'notes'; end if;
  if exists(select 1 from rakeezx.class_goals g where g.owner_id=p_owner and g.session_id=p_session_id and g.deleted_at is null)
    then return 'class_goal'; end if;
  if v_session.lesson_id is not null or coalesce(v_session.note,'')<>'' or
     coalesce(v_session.homework,'')<>'' or coalesce(v_session.covered,'')<>''
    then return 'content'; end if;
  return null;
end;
$$;

revoke all on function rakeezx.session_delete_blocker(uuid,text) from public, anon, authenticated;

create or replace function rakeezx.guard_safe_session_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_blocker text;
begin
  if old.deleted_at is not null or new.deleted_at is null then return new; end if;
  -- Validated class lifecycle and V2 restore already enforce their own complete
  -- transaction contract and use this established transaction-local bypass.
  if pg_catalog.current_setting('rakeezx.section_lifecycle_delete',true)='on' then return new; end if;
  v_blocker := rakeezx.session_delete_blocker(old.owner_id,old.id);
  if v_blocker is not null then
    raise exception using errcode='23514',message='Session contains retained historical evidence',detail=v_blocker;
  end if;
  return new;
end;
$$;

drop trigger if exists sessions_guard_safe_delete on rakeezx.sessions;
create trigger sessions_guard_safe_delete
  before update of deleted_at on rakeezx.sessions
  for each row when (old.deleted_at is null and new.deleted_at is not null)
  execute function rakeezx.guard_safe_session_delete();

create or replace function rakeezx.apply_sync_v2_session_delete_command(
  p_mutation_id text,
  p_device_id text,
  p_session_id text,
  p_client_updated_at bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid:=auth.uid();
  v_receipt rakeezx.sync_mutation_receipts%rowtype;
  v_session rakeezx.sessions%rowtype;
  v_envelope jsonb;
  v_session_json jsonb;
  v_result jsonb;
  v_outcome text;
  v_reason text;
  v_applied text[]:='{}'::text[];
  v_conflicted text[]:='{}'::text[];
begin
  if v_owner is null then raise exception using errcode='42501',message='Authentication required'; end if;
  if coalesce(p_mutation_id,'')='' or char_length(p_mutation_id)>200 or
     coalesce(p_device_id,'')='' or char_length(p_device_id)>200 or
     coalesce(p_session_id,'')='' then
    raise exception using errcode='22023',message='Invalid session delete command';
  end if;

  v_envelope:=jsonb_build_object('mutationId',p_mutation_id,'deviceId',p_device_id,
    'sessionId',p_session_id,'clientUpdatedAt',p_client_updated_at);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_owner::text||':sync-v2:'||p_mutation_id,0));
  select * into v_receipt from rakeezx.sync_mutation_receipts
    where owner_id=v_owner and mutation_id=p_mutation_id;
  if found then
    if v_receipt.request_envelope is distinct from v_envelope then
      raise exception using errcode='22023',message='Mutation ID was reused with a different request';
    end if;
    return v_receipt.result;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_owner::text||':session-delete:'||p_session_id,0));
  select * into v_session from rakeezx.sessions
    where owner_id=v_owner and id=p_session_id for update;
  if not found then
    v_outcome:='not_found'; v_reason:='not_found'; v_conflicted:=array['__record__']::text[];
    v_session_json:=null;
  elsif v_session.deleted_at is not null then
    v_outcome:='already_deleted'; v_applied:=array['__deleted__']::text[];
    v_session_json:=to_jsonb(v_session);
  else
    v_reason:=rakeezx.session_delete_blocker(v_owner,p_session_id);
    if v_reason is not null then
      v_outcome:='protected'; v_conflicted:=array['__protected__']::text[];
      v_session_json:=to_jsonb(v_session);
    else
      update rakeezx.sessions set deleted_at=pg_catalog.clock_timestamp(),device_id=p_device_id,
        client_updated_at=p_client_updated_at
        where owner_id=v_owner and id=p_session_id returning * into v_session;
      v_outcome:='deleted'; v_applied:=array['__deleted__']::text[];
      v_session_json:=to_jsonb(v_session);
    end if;
  end if;

  v_result:=jsonb_build_object('mutationId',p_mutation_id,'command','delete_session',
    'sessionId',p_session_id,'outcome',v_outcome,'reason',v_reason,'session',v_session_json);
  insert into rakeezx.sync_mutation_receipts(
    owner_id,mutation_id,entity,record_id,device_id,base_revision,operation,client_updated_at,
    request_patch,request_envelope,outcome,applied_groups,conflicted_groups,result_revision,canonical,result
  ) values(
    v_owner,p_mutation_id,'sessions',p_session_id,p_device_id,0,'session_delete',p_client_updated_at,
    '{}'::jsonb,v_envelope,v_outcome,v_applied,v_conflicted,
    case when v_session_json is null then null else (v_session_json->>'revision')::bigint end,
    v_session_json,v_result
  );
  return v_result;
end;
$$;

revoke all on function rakeezx.apply_sync_v2_session_delete_command(text,text,text,bigint) from public, anon;
grant execute on function rakeezx.apply_sync_v2_session_delete_command(text,text,text,bigint) to authenticated;

commit;
