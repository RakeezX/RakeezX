-- 0316 candidate only. No Product rows or payloads enter the signal.
begin;

create table rakeezx.owner_sync_changes (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null check (revision > 0),
  updated_at timestamptz not null default clock_timestamp()
);
alter table rakeezx.owner_sync_changes enable row level security;
revoke all on rakeezx.owner_sync_changes from public, anon, authenticated;
grant select on rakeezx.owner_sync_changes to authenticated;
create policy owner_sync_changes_select on rakeezx.owner_sync_changes
  for select to authenticated using (owner_id = (select auth.uid()));

create function rakeezx.owner_sync_change_marker() returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
declare v_owner uuid := auth.uid(); v_row rakeezx.owner_sync_changes%rowtype;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode='42501'; end if;
  select * into v_row from rakeezx.owner_sync_changes where owner_id=v_owner;
  return jsonb_build_object('protocol','OWNER_SIGNAL_V1','ownerId',v_owner,
    'revision',coalesce(v_row.revision,0)::text,'updatedAt',v_row.updated_at);
end;
$$;
revoke all on function rakeezx.owner_sync_change_marker() from public, anon;
grant execute on function rakeezx.owner_sync_change_marker() to authenticated;

-- All canonical writes (generic, specialized RPCs, restore, and tombstones)
-- pass through these tables. Rejected/no-change writes do not advance a marker.
-- Marker and Broadcast insertion roll back with the Product transaction.
create function rakeezx.record_owner_sync_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_owner uuid; v_revision bigint;
begin
  if TG_OP='UPDATE' and NEW is not distinct from OLD then return NEW; end if;
  if TG_OP='DELETE' then v_owner:=OLD.owner_id; else v_owner:=NEW.owner_id; end if;
  if TG_OP='UPDATE' and NEW.owner_id is distinct from OLD.owner_id then
    raise exception 'Owner identity is immutable' using errcode='42501';
  end if;
  if auth.uid() is not null and auth.uid()<>v_owner then
    raise exception 'Owner mismatch' using errcode='42501';
  end if;
  -- Account deletion cascades must not recreate its marker.
  if not exists(select 1 from auth.users where id=v_owner) then
    if TG_OP='DELETE' then return OLD; else return NEW; end if;
  end if;
  insert into rakeezx.owner_sync_changes(owner_id,revision,updated_at)
    values(v_owner,1,clock_timestamp())
    on conflict(owner_id) do update set revision=owner_sync_changes.revision+1,
      updated_at=clock_timestamp() returning revision into v_revision;
  perform realtime.send(jsonb_build_object('revision',v_revision::text),
    'invalidate','rakeezx-owner:'||v_owner::text,true);
  if TG_OP='DELETE' then return OLD; else return NEW; end if;
end;
$$;
revoke all on function rakeezx.record_owner_sync_change() from public, anon, authenticated;

do $$
declare v_table text;
begin
  foreach v_table in array array[
    'profile','years','calendars','calendar_days','terms','subjects','units','lessons',
    'sections','teachings','students','enrollments','notes','class_rules','class_goals',
    'class_charter_selections','group_arrangements','items','score_subitems',
    'score_subitem_completions','scores','logs','time_profiles','slots','sessions',
    'session_roster_snapshots','attendance','closed_term_reports'
  ] loop
    execute format('create trigger owner_sync_change after insert or update or delete on rakeezx.%I for each row execute function rakeezx.record_owner_sync_change()',v_table);
  end loop;
end;
$$;

-- Receive-only, private, server-generated Broadcast. No client send policy.
create policy rakeezx_owner_invalidation_receive on realtime.messages
  for select to authenticated using (
    extension='broadcast' and topic=realtime.topic()
    and realtime.topic()='rakeezx-owner:'||(select auth.uid())::text
  );
commit;
