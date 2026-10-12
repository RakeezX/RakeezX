-- N77: online-only, owner-derived, scope-checked destructive Delete.
-- Build candidate only. Apply after disposable-server certification and explicit live authority.
set lock_timeout = '10s';
begin;

-- Old queued Delete commands must not bypass the new confirmation/scope protocol.
alter function rakeezx.apply_sync_v2_lifecycle_command(text,text,text,text,bigint)
  rename to apply_sync_v2_lifecycle_command_before_n77;
revoke all on function rakeezx.apply_sync_v2_lifecycle_command_before_n77(text,text,text,text,bigint) from public, anon, authenticated;
create function rakeezx.apply_sync_v2_lifecycle_command(
  p_mutation_id text,p_device_id text,p_command text,p_target_id text,p_client_updated_at bigint default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if p_command in ('delete_class','delete_teaching') then
    raise exception using errcode='22023',message='N77 Delete requires a fresh server scope confirmation';
  end if;
  return rakeezx.apply_sync_v2_lifecycle_command_before_n77(
    p_mutation_id,p_device_id,p_command,p_target_id,p_client_updated_at);
end; $$;
revoke all on function rakeezx.apply_sync_v2_lifecycle_command(text,text,text,text,bigint) from public, anon;
grant execute on function rakeezx.apply_sync_v2_lifecycle_command(text,text,text,text,bigint) to authenticated;

create function rakeezx.n77_delete_teaching(
  p_teaching_id text,p_expected_section_id text,p_expected_fingerprint text default null,
  p_mutation_id text default null,p_device_id text default null,p_commit boolean default false
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := auth.uid();
  v_section rakeezx.sections%rowtype;
  v_teaching rakeezx.teachings%rowtype;
  v_ids text[];
  v_fingerprint text;
  v_scope text;
  v_orphans text[] := '{}'::text[];
  v_receipt rakeezx.sync_mutation_receipts%rowtype;
  v_envelope jsonb;
  v_result jsonb;
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  if v_owner is null then raise exception using errcode='42501',message='Authentication required'; end if;
  if coalesce(p_teaching_id,'')='' or coalesce(p_expected_section_id,'')='' or
      char_length(p_teaching_id)>240 or char_length(p_expected_section_id)>240 then
    raise exception using errcode='22023',message='Invalid N77 target';
  end if;
  if p_commit and (coalesce(p_mutation_id,'')='' or coalesce(p_device_id,'')='' or
      coalesce(p_expected_fingerprint,'')='' or char_length(p_mutation_id)>200 or char_length(p_device_id)>200) then
    raise exception using errcode='22023',message='Invalid N77 commit envelope';
  end if;
  if p_commit then
    v_envelope := pg_catalog.jsonb_build_object('teachingId',p_teaching_id,'sectionId',p_expected_section_id,
      'fingerprint',p_expected_fingerprint,'mutationId',p_mutation_id,'deviceId',p_device_id);
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_owner::text||':sync-v2:'||p_mutation_id,0));
    select * into v_receipt from rakeezx.sync_mutation_receipts
      where owner_id=v_owner and mutation_id=p_mutation_id;
    if found then
      if v_receipt.request_envelope is distinct from v_envelope then
        raise exception using errcode='22023',message='Mutation ID was reused with a different request';
      end if;
      return v_receipt.result;
    end if;
  end if;
  -- All N77 scope transitions serialize on the owner/Section row.
  select * into v_section from rakeezx.sections
    where owner_id=v_owner and id=p_expected_section_id for update;
  if not found or v_section.deleted_at is not null then
    raise exception using errcode='22023',message='N77 scope is stale';
  end if;
  select * into v_teaching from rakeezx.teachings
    where owner_id=v_owner and id=p_teaching_id and section_id=v_section.id for update;
  if not found or v_teaching.deleted_at is not null then
    raise exception using errcode='22023',message='N77 scope is stale';
  end if;
  select pg_catalog.array_agg(id order by id) into v_ids from rakeezx.teachings
    where owner_id=v_owner and section_id=v_section.id and deleted_at is null;
  if v_ids is null or not (p_teaching_id=any(v_ids)) then
    raise exception using errcode='22023',message='N77 scope is stale';
  end if;
  v_scope := case when pg_catalog.array_length(v_ids,1)>1 then 'teaching' else 'section' end;
  -- A changed sibling set, selected row or Section invalidates the shown confirmation.
  select pg_catalog.md5(v_owner::text||':'||v_section.id||':'||v_section.revision::text||':'||
    pg_catalog.string_agg(t.id||':'||t.revision::text,',' order by t.id)) into v_fingerprint
    from rakeezx.teachings t where t.owner_id=v_owner and t.section_id=v_section.id and t.deleted_at is null;
  if p_commit and p_expected_fingerprint<>v_fingerprint then
    raise exception using errcode='22023',message='N77 scope is stale';
  end if;
  if v_scope='teaching' then v_ids := array[p_teaching_id]; end if;
  v_result := pg_catalog.jsonb_build_object('ownerId',v_owner,'sectionId',v_section.id,
    'selectedTeachingId',p_teaching_id,'scope',v_scope,'teachingIds',pg_catalog.to_jsonb(v_ids),
    'fingerprint',v_fingerprint);
  if not p_commit then return v_result; end if;

  -- A final Section Delete also closes live descendants of historical Teaching
  -- tombstones created by older lifecycle code. The confirmation still names
  -- only the final active Teaching.
  if v_scope='section' then
    select pg_catalog.array_agg(id order by id) into v_ids from rakeezx.teachings
      where owner_id=v_owner and section_id=v_section.id;
  end if;
  v_result := v_result || pg_catalog.jsonb_build_object('cascadeTeachingIds',pg_catalog.to_jsonb(v_ids));

  -- Student identity is shared and local-only assignments/submissions are not
  -- visible to this server. Preserve every student identity; removing the
  -- Section enrollment makes an otherwise unreferenced student invisible in UX.

  perform pg_catalog.set_config('rakeezx.section_lifecycle_delete','on',true);
  perform pg_catalog.set_config('rakeezx.score_domain_write','on',true);
  -- Descendants first. Every update and receipt shares this RPC transaction.
  update rakeezx.score_subitem_completions c set deleted_at=v_now,device_id=p_device_id
    where c.owner_id=v_owner and c.deleted_at is null and (
      c.subitem_id in (select si.id from rakeezx.score_subitems si join rakeezx.items i
        on i.owner_id=si.owner_id and i.id=si.item_id where si.owner_id=v_owner and i.teaching_id=any(v_ids))
      or c.student_id=any(v_orphans));
  update rakeezx.score_subitems si set deleted_at=v_now,device_id=p_device_id
    where si.owner_id=v_owner and si.deleted_at is null and si.item_id in
      (select id from rakeezx.items where owner_id=v_owner and teaching_id=any(v_ids));
  update rakeezx.scores s set deleted_at=v_now,device_id=p_device_id
    where s.owner_id=v_owner and s.deleted_at is null and (s.student_id=any(v_orphans) or s.item_id in
      (select id from rakeezx.items where owner_id=v_owner and teaching_id=any(v_ids)));
  update rakeezx.attendance a set deleted_at=v_now,device_id=p_device_id
    where a.owner_id=v_owner and a.deleted_at is null and (a.student_id=any(v_orphans) or
      a.teaching_id=any(v_ids) or a.session_id in
      (select id from rakeezx.sessions where owner_id=v_owner and teaching_id=any(v_ids)));
  update rakeezx.session_roster_snapshots s set deleted_at=v_now,device_id=p_device_id
    where s.owner_id=v_owner and s.deleted_at is null and (s.teaching_id=any(v_ids) or
      s.session_id in (select id from rakeezx.sessions where owner_id=v_owner and teaching_id=any(v_ids)) or
      (v_scope='section' and s.section_id=v_section.id));
  update rakeezx.logs l set deleted_at=v_now,device_id=p_device_id
    where l.owner_id=v_owner and l.deleted_at is null and (l.student_id=any(v_orphans) or
      l.teaching_id=any(v_ids) or l.session_id in
      (select id from rakeezx.sessions where owner_id=v_owner and teaching_id=any(v_ids)));
  update rakeezx.notes n set deleted_at=v_now,device_id=p_device_id
    where n.owner_id=v_owner and n.deleted_at is null and (n.student_id=any(v_orphans) or
      n.teaching_id=any(v_ids) or n.session_id in
      (select id from rakeezx.sessions where owner_id=v_owner and teaching_id=any(v_ids)));
  update rakeezx.class_goals set deleted_at=v_now,device_id=p_device_id
    where owner_id=v_owner and deleted_at is null and teaching_id=any(v_ids);
  update rakeezx.class_charter_selections set deleted_at=v_now,device_id=p_device_id
    where owner_id=v_owner and deleted_at is null and teaching_id=any(v_ids);
  update rakeezx.group_arrangements set deleted_at=v_now,device_id=p_device_id
    where owner_id=v_owner and deleted_at is null and teaching_id=any(v_ids);
  update rakeezx.class_rules set deleted_at=v_now,device_id=p_device_id
    where owner_id=v_owner and deleted_at is null and teaching_id=any(v_ids);
  update rakeezx.slots set deleted_at=v_now,device_id=p_device_id
    where owner_id=v_owner and deleted_at is null and teaching_id=any(v_ids);
  update rakeezx.sessions set deleted_at=v_now,device_id=p_device_id
    where owner_id=v_owner and deleted_at is null and teaching_id=any(v_ids);
  update rakeezx.items set deleted_at=v_now,device_id=p_device_id
    where owner_id=v_owner and deleted_at is null and teaching_id=any(v_ids);
  update rakeezx.teachings set deleted_at=v_now,device_id=p_device_id
    where owner_id=v_owner and deleted_at is null and id=any(v_ids);
  if v_scope='section' then
    update rakeezx.enrollments set deleted_at=v_now,device_id=p_device_id
      where owner_id=v_owner and deleted_at is null and section_id=v_section.id;
    update rakeezx.students set deleted_at=v_now,device_id=p_device_id
      where owner_id=v_owner and deleted_at is null and id=any(v_orphans);
    update rakeezx.sections set deleted_at=v_now,device_id=p_device_id
      where owner_id=v_owner and deleted_at is null and id=v_section.id;
  end if;
  v_result := v_result || pg_catalog.jsonb_build_object('mutationId',p_mutation_id,
    'outcome','deleted','orphanStudentIds',pg_catalog.to_jsonb(v_orphans));
  insert into rakeezx.sync_mutation_receipts(owner_id,mutation_id,entity,record_id,device_id,
    base_revision,operation,request_patch,request_envelope,outcome,applied_groups,
    conflicted_groups,result)
  values(v_owner,p_mutation_id,'lifecycle',p_teaching_id,p_device_id,0,'lifecycle','{}'::jsonb,
    v_envelope,'deleted',array['__deleted__']::text[],array[]::text[],v_result);
  return v_result;
end; $$;
revoke all on function rakeezx.n77_delete_teaching(text,text,text,text,text,boolean) from public, anon;
grant execute on function rakeezx.n77_delete_teaching(text,text,text,text,text,boolean) to authenticated;

-- Every live descendant write takes a shared lock on its Section. It either
-- commits before N77's exclusive Section lock (and is included in the cascade)
-- or waits and observes the tombstone. This also rejects stale-device creates.
create function rakeezx.n77_guard_live_parent() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_row jsonb := pg_catalog.to_jsonb(new);
  v_owner uuid := new.owner_id;
  v_section text := v_row->>'section_id';
  v_teaching text := v_row->>'teaching_id';
  v_item text := v_row->>'item_id';
  v_subitem text := v_row->>'subitem_id';
  v_session text := v_row->>'session_id';
  v_student text := v_row->>'student_id';
  v_parent rakeezx.sections%rowtype;
begin
  if v_row->>'deleted_at' is not null then return new; end if;
  if v_student is not null and not exists (
    select 1 from rakeezx.students where owner_id=v_owner and id=v_student and deleted_at is null
  ) then raise exception using errcode='22023',message='N77 student is unavailable'; end if;
  if v_subitem is not null then
    select si.item_id into v_item from rakeezx.score_subitems si
      where si.owner_id=v_owner and si.id=v_subitem and si.deleted_at is null;
    if v_item is null then raise exception using errcode='22023',message='N77 subitem is unavailable'; end if;
  end if;
  if v_item is not null then
    select i.teaching_id into v_teaching from rakeezx.items i
      where i.owner_id=v_owner and i.id=v_item and i.deleted_at is null;
    if v_teaching is null then raise exception using errcode='22023',message='N77 item is unavailable'; end if;
  end if;
  if v_session is not null then
    if v_teaching is null then
      select s.teaching_id into v_teaching from rakeezx.sessions s
        where s.owner_id=v_owner and s.id=v_session and s.deleted_at is null;
      if v_teaching is null then raise exception using errcode='22023',message='N77 session is unavailable'; end if;
    elsif not exists (select 1 from rakeezx.sessions s where s.owner_id=v_owner and s.id=v_session
      and s.teaching_id=v_teaching and s.deleted_at is null) then
      raise exception using errcode='22023',message='N77 session scope mismatch';
    end if;
  end if;
  if v_teaching is not null then
    select t.section_id into v_section from rakeezx.teachings t
      where t.owner_id=v_owner and t.id=v_teaching and t.deleted_at is null;
    if v_section is null then raise exception using errcode='22023',message='N77 teaching is unavailable'; end if;
  end if;
  if v_section is not null then
    select * into v_parent from rakeezx.sections
      where owner_id=v_owner and id=v_section for share;
    if not found or v_parent.deleted_at is not null then
      raise exception using errcode='22023',message='N77 section is unavailable';
    end if;
  end if;
  return new;
end; $$;
revoke all on function rakeezx.n77_guard_live_parent() from public, anon, authenticated;

do $$ declare v_name text; begin
  foreach v_name in array array[
    'teachings','enrollments','items','score_subitems','score_subitem_completions','scores',
    'slots','sessions','session_roster_snapshots','attendance','logs','notes','class_rules',
    'class_goals','class_charter_selections','group_arrangements'
  ] loop
    execute pg_catalog.format('create trigger n77_guard_live_parent before insert or update on rakeezx.%I for each row execute function rakeezx.n77_guard_live_parent()',v_name);
  end loop;
end $$;

commit;
