-- N58-CALENDAR-PERSISTENCE-SERVER-0457.2. Local candidate; no backfill.
begin;
set local lock_timeout = '10s';

alter table rakeezx.years add column calendar_preset_id text;
alter table rakeezx.calendars add column preset_id text;
alter table rakeezx.calendars add column term_date_overrides jsonb not null default '{}'::jsonb;
alter table rakeezx.sessions add column calendar_context jsonb;

-- NULL keeps exactly the old permanent identity. Scoped identities also include
-- tombstones; only calendar_days retain active-only / renewed-ID semantics.
alter table rakeezx.calendars drop constraint calendars_source_uniq;
create unique index calendars_legacy_source_uniq on rakeezx.calendars(owner_id,year_id,source)
  where preset_id is null;
create unique index calendars_preset_source_uniq on rakeezx.calendars(owner_id,year_id,source,preset_id)
  where preset_id is not null;

-- Delegate to the resulting score-aware map, not an intermediate definition.
alter function rakeezx.sync_v2_field_map(text) rename to sync_v2_field_map_before_n58;
revoke all on function rakeezx.sync_v2_field_map_before_n58(text) from public,anon,authenticated;
create function rakeezx.sync_v2_field_map(p_entity text) returns jsonb
language sql immutable security definer set search_path='' as $$
  select rakeezx.sync_v2_field_map_before_n58(p_entity) || case p_entity
    when 'years' then '{"calendar_preset_id":"calendar_selection"}'::jsonb
    when 'calendars' then '{"preset_id":"identity","term_date_overrides":"term_dates"}'::jsonb
    when 'sessions' then '{"calendar_context":"identity"}'::jsonb
    else '{}'::jsonb end;
$$;
revoke all on function rakeezx.sync_v2_field_map(text) from public,anon;
grant execute on function rakeezx.sync_v2_field_map(text) to authenticated;

alter function rakeezx.sync_v2_natural_key(text,jsonb) rename to sync_v2_natural_key_before_n58;
revoke all on function rakeezx.sync_v2_natural_key_before_n58(text,jsonb) from public,anon,authenticated;
create function rakeezx.sync_v2_natural_key(p_entity text,p_record jsonb) returns jsonb
language sql immutable security definer set search_path='' as $$
  select case when p_entity='calendars' and p_record->>'preset_id' is not null
    and p_record->>'year_id' is not null then pg_catalog.jsonb_build_array(
      p_record->>'year_id',coalesce(p_record->>'source','custom'),p_record->>'preset_id')
    else rakeezx.sync_v2_natural_key_before_n58(p_entity,p_record) end;
$$;
revoke all on function rakeezx.sync_v2_natural_key(text,jsonb) from public,anon,authenticated;

create function rakeezx.n58_valid_preset(p_id text,p_start integer,p_end integer) returns boolean
language sql immutable set search_path='' as $$
  select coalesce(p_start=1448 and p_end=1449 and
    p_id in ('sa-general-1448-1449','sa-western-1448-1449'),false);
$$;
revoke all on function rakeezx.n58_valid_preset(text,integer,integer) from public,anon,authenticated;

-- Only two term bounds are needed to validate overrides against the accepted
-- catalog. This is not an official-day catalog or a Calendar resolver service.
create function rakeezx.n58_validate_overrides(p_owner uuid,p_year text,p_preset text,p_value jsonb)
returns void language plpgsql stable security definer set search_path='' as $$
declare v_entry record; v_index integer; v_start date; v_end date;
  v_first_start date; v_first_end date:='2027-01-07';
  v_second_start date:='2027-01-17'; v_second_end date;
begin
  if p_value is null or pg_catalog.jsonb_typeof(p_value)<>'object' or
    pg_catalog.octet_length(p_value::text)>2048 then
    raise exception using errcode='22023',message='N58_INVALID_TERM_OVERRIDES'; end if;
  if p_preset is null then
    if p_value<>'{}'::jsonb then
      raise exception using errcode='22023',message='N58_UNSCOPED_TERM_OVERRIDES'; end if;
    return;
  end if;
  v_first_start:=case p_preset when 'sa-general-1448-1449' then '2026-08-23'::date else '2026-08-30'::date end;
  v_second_end:=case p_preset when 'sa-general-1448-1449' then '2027-06-24'::date else '2027-07-01'::date end;
  for v_entry in select * from pg_catalog.jsonb_each(p_value) loop
    select t."index" into v_index from rakeezx.terms t where t.owner_id=p_owner
      and t.year_id=p_year and t.id=v_entry.key and t.deleted_at is null;
    if v_index is null or v_index not in (1,2) or pg_catalog.jsonb_typeof(v_entry.value)<>'object' or
      not (v_entry.value ?& array['start_date','end_date']) or
      (v_entry.value-array['start_date','end_date'])<>'{}'::jsonb or
      pg_catalog.jsonb_typeof(v_entry.value->'start_date')<>'string' or
      pg_catalog.jsonb_typeof(v_entry.value->'end_date')<>'string' or
      (v_entry.value->>'start_date') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or
      (v_entry.value->>'end_date') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
      raise exception using errcode='22023',message='N58_INVALID_TERM_OVERRIDE_PAIR'; end if;
    begin
      v_start:=(v_entry.value->>'start_date')::date;
      v_end:=(v_entry.value->>'end_date')::date;
    exception when datetime_field_overflow or invalid_datetime_format then
      raise exception using errcode='22023',message='N58_INVALID_TERM_OVERRIDE_DATE';
    end;
    if v_start>v_end then
      raise exception using errcode='22023',message='N58_INVALID_TERM_OVERRIDE_PAIR'; end if;
    if v_index=1 then v_first_start:=v_start; v_first_end:=v_end;
    else v_second_start:=v_start; v_second_end:=v_end; end if;
  end loop;
  if v_first_start>v_first_end or v_second_start>v_second_end or v_first_end>=v_second_start then
    raise exception using errcode='22023',message='N58_OVERLAPPING_TERM_OVERRIDES'; end if;
end; $$;
revoke all on function rakeezx.n58_validate_overrides(uuid,text,text,jsonb) from public,anon,authenticated;

-- A fresh full backup must be able to retain historical context from an older
-- selection. A client-set GUC would be forgeable. This inaccessible, temporary
-- transaction marker is installed only by the EXISTING checked finalizers.
-- It grants no exception for writes into an already existing year.
create table rakeezx.n58_restore_transactions (
  owner_id uuid not null references auth.users(id) on delete cascade,
  transaction_id bigint not null,
  restore_id text not null,
  primary key(owner_id,transaction_id)
);
alter table rakeezx.n58_restore_transactions enable row level security;
alter table rakeezx.n58_restore_transactions force row level security;
revoke all on rakeezx.n58_restore_transactions from public,anon,authenticated;

create function rakeezx.n58_restore_creating_year(p_owner uuid,p_year text) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from rakeezx.n58_restore_transactions m
    join rakeezx.sync_restore_stages s on s.owner_id=m.owner_id and s.restore_id=m.restore_id
    cross join lateral pg_catalog.jsonb_array_elements(s.operations) o
    where m.owner_id=p_owner and m.transaction_id=pg_catalog.txid_current()
      and o->>'entity'='years' and o->>'recordId'=p_year and o->>'operation'='create');
$$;
revoke all on function rakeezx.n58_restore_creating_year(uuid,text) from public,anon,authenticated;

-- Use the pre-existing owner->row lock boundary on BOTH restore finalizers.
-- Every relevant table already has 0029's BEFORE STATEMENT owner lock, so
-- direct REST writes serialize with Sync without introducing inverted locks.
do $$ declare v_name text; begin
  foreach v_name in array array['finalize_sync_v2_restore','finalize_sync_v2_restore_score_v2'] loop
    execute pg_catalog.format('alter function rakeezx.%I(text,text,text) rename to %I',v_name,v_name||'_before_n58');
    execute pg_catalog.format('revoke all on function rakeezx.%I(text,text,text) from public,anon,authenticated',v_name||'_before_n58');
    execute pg_catalog.format($wrapper$
      create function rakeezx.%I(p_restore_id text,p_backup_hash text,p_expected_stage_hash text)
      returns jsonb language plpgsql security definer set search_path='' as $body$
      declare v_owner uuid:=auth.uid(); v_result jsonb; v_calendar record; v_year record;
      begin
        if v_owner is null then raise exception using errcode='42501',message='Authentication required'; end if;
        perform rakeezx.lock_student_lifecycle(v_owner);
        insert into rakeezx.n58_restore_transactions values(v_owner,pg_catalog.txid_current(),p_restore_id);
        v_result:=rakeezx.%I(p_restore_id,p_backup_hash,p_expected_stage_hash);
        for v_year in select y.* from rakeezx.years y where y.owner_id=v_owner
          and y.calendar_preset_id is not null and rakeezx.n58_restore_creating_year(v_owner,y.id) loop
          if (select count(*) from rakeezx.terms t where t.owner_id=v_owner and t.year_id=v_year.id
            and t."index" in (1,2) and t.deleted_at is null)<>2 then
            raise exception using errcode='22023',message='N58_EXISTING_TERMS_REQUIRED'; end if;
        end loop;
        -- Calendar->term FK ordering requires calendars before terms. Validate
        -- fresh-year override references AFTER all checked restore operations;
        -- any error rolls back the domain rows AND the existing receipt.
        for v_calendar in select c.* from rakeezx.calendars c where c.owner_id=v_owner
          and rakeezx.n58_restore_creating_year(v_owner,c.year_id) loop
          perform rakeezx.n58_validate_overrides(v_owner,v_calendar.year_id,v_calendar.preset_id,v_calendar.term_date_overrides);
        end loop;
        delete from rakeezx.n58_restore_transactions where owner_id=v_owner and transaction_id=pg_catalog.txid_current();
        return v_result;
      end; $body$;
    $wrapper$,v_name,v_name||'_before_n58');
    execute pg_catalog.format('revoke all on function rakeezx.%I(text,text,text) from public,anon',v_name);
    execute pg_catalog.format('grant execute on function rakeezx.%I(text,text,text) to authenticated',v_name);
  end loop;
end $$;

create function rakeezx.n58_guard_calendar_contract() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_row jsonb; v_old jsonb; v_year rakeezx.years%rowtype;
  v_calendar rakeezx.calendars%rowtype; v_term rakeezx.terms%rowtype;
  v_year_id text; v_context jsonb; v_fresh_restore boolean;
begin
  if tg_op='INSERT' and auth.uid() is not null then new.owner_id:=auth.uid(); end if;
  v_row:=case when tg_op='DELETE' then pg_catalog.to_jsonb(old) else pg_catalog.to_jsonb(new) end;
  if tg_op='UPDATE' then
    v_old:=pg_catalog.to_jsonb(old);
    if (new.owner_id,new.id) is distinct from (old.owner_id,old.id) then
      raise exception using errcode='22023',message='N58_IMMUTABLE_RECORD_IDENTITY'; end if;
    -- Preserve the existing tombstone trigger's silent, immutable update result.
    if old.deleted_at is not null then return null; end if;
  end if;

  case tg_table_name
    when 'years' then v_year_id:=v_row->>'id';
    when 'terms','calendars','sections' then v_year_id:=v_row->>'year_id';
    when 'calendar_days' then
      select * into v_calendar from rakeezx.calendars where owner_id=(v_row->>'owner_id')::uuid
        and id=v_row->>'calendar_id';
      v_year_id:=v_calendar.year_id;
    when 'teachings' then
      select * into v_term from rakeezx.terms where owner_id=(v_row->>'owner_id')::uuid and id=v_row->>'term_id';
      v_year_id:=v_term.year_id;
    when 'sessions' then
      select t.* into v_term from rakeezx.terms t join rakeezx.teachings x
        on x.owner_id=t.owner_id and x.term_id=t.id
        where x.owner_id=(v_row->>'owner_id')::uuid and x.id=v_row->>'teaching_id';
      v_year_id:=v_term.year_id;
  end case;
  select * into v_year from rakeezx.years where owner_id=(v_row->>'owner_id')::uuid and id=v_year_id;
  v_fresh_restore:=rakeezx.n58_restore_creating_year((v_row->>'owner_id')::uuid,v_year_id);

  if tg_table_name='years' then
    if tg_op='DELETE' then
      if old.calendar_preset_id is not null then
        raise exception using errcode='22023',message='N58_SELECTED_YEAR_RETIREMENT_BLOCKED'; end if;
    else
      if new.calendar_preset_id is not null and not rakeezx.n58_valid_preset(new.calendar_preset_id,new.hijri_start,new.hijri_end) then
        raise exception using errcode='22023',message='N58_UNSUPPORTED_YEAR_PRESET'; end if;
      if tg_op='UPDATE' and old.calendar_preset_id is not null and
        (new.calendar_preset_id is null or new.deleted_at is not null or
          (new.hijri_start,new.hijri_end) is distinct from (old.hijri_start,old.hijri_end)) then
        raise exception using errcode='22023',message='N58_SELECTED_YEAR_IDENTITY_BLOCKED'; end if;
      if new.calendar_preset_id is not null and new.deleted_at is not null then
        raise exception using errcode='22023',message='N58_SELECTED_YEAR_RETIREMENT_BLOCKED'; end if;
      if new.calendar_preset_id is not null and not v_fresh_restore and
        (select count(*) from rakeezx.terms t where t.owner_id=new.owner_id and t.year_id=new.id
          and t."index" in (1,2) and t.deleted_at is null)<>2 then
        raise exception using errcode='22023',message='N58_EXISTING_TERMS_REQUIRED'; end if;
      if tg_op='UPDATE' and exists(select 1 from rakeezx.calendars c where c.owner_id=new.owner_id
        and c.year_id=new.id and c.preset_id is not null and
        not rakeezx.n58_valid_preset(c.preset_id,new.hijri_start,new.hijri_end)) then
        raise exception using errcode='22023',message='N58_SCOPED_YEAR_IDENTITY_BLOCKED'; end if;
    end if;
  elsif tg_table_name='calendars' then
    if tg_op='UPDATE' and (new.year_id,new.source,new.preset_id) is distinct from (old.year_id,old.source,old.preset_id) then
      raise exception using errcode='22023',message='N58_IMMUTABLE_CALENDAR_SCOPE'; end if;
    if tg_op='DELETE' then
      if old.preset_id is not null or v_year.calendar_preset_id is not null then
        raise exception using errcode='22023',message='N58_CALENDAR_HARD_DELETE_BLOCKED'; end if;
    else
      if new.preset_id is not null and (new.source<>'custom' or v_year.deleted_at is not null or
        not rakeezx.n58_valid_preset(new.preset_id,v_year.hijri_start,v_year.hijri_end)) then
        raise exception using errcode='22023',message='N58_INVALID_CUSTOM_SCOPE'; end if;
      if not v_fresh_restore then
        perform rakeezx.n58_validate_overrides(new.owner_id,new.year_id,new.preset_id,new.term_date_overrides);
      end if;
      if v_year.calendar_preset_id is not null and new.preset_id is null and not v_fresh_restore and
        (tg_op='INSERT' or (v_row-array['updated_at','client_updated_at','device_id','revision','field_revisions']) is distinct from
          (v_old-array['updated_at','client_updated_at','device_id','revision','field_revisions'])) then
        raise exception using errcode='22023',message='N58_LEGACY_CALENDAR_WRITE_BLOCKED'; end if;
    end if;
  elsif tg_table_name='calendar_days' then
    if tg_op='UPDATE' and (new.calendar_id,new.date) is distinct from (old.calendar_id,old.date) then
      raise exception using errcode='22023',message='N58_IMMUTABLE_DAY_IDENTITY'; end if;
    if v_year.calendar_preset_id is not null and not v_fresh_restore then
      if tg_op='DELETE' or v_calendar.preset_id is null or v_calendar.deleted_at is not null then
        if tg_op='UPDATE' and v_row-array['updated_at','client_updated_at','device_id','revision','field_revisions'] =
          v_old-array['updated_at','client_updated_at','device_id','revision','field_revisions'] then return new; end if;
        raise exception using errcode='22023',message='N58_UNSCOPED_DAY_WRITE_BLOCKED'; end if;
    end if;
  elsif tg_table_name='terms' then
    if tg_op='UPDATE' and (new.year_id,new."index") is distinct from (old.year_id,old."index") then
      raise exception using errcode='22023',message='N58_IMMUTABLE_TERM_IDENTITY'; end if;
    if v_year.calendar_preset_id is not null then
      if not v_fresh_restore and (tg_op='DELETE' or (tg_op='UPDATE' and new.deleted_at is not null)) then
        raise exception using errcode='22023',message='N58_TERM_RETIREMENT_BLOCKED'; end if;
      if not v_fresh_restore and ((tg_op='INSERT' and (new.start_date is not null or new.end_date is not null or new.calendar_id is not null)) or
        (tg_op='UPDATE' and (new.start_date,new.end_date,new.calendar_id) is distinct from (old.start_date,old.end_date,old.calendar_id))) then
        raise exception using errcode='22023',message='N58_USE_SCOPED_TERM_OVERRIDES'; end if;
    end if;
    -- An override cannot be orphaned even in a prepared, not-yet-selected scope.
    if tg_op='DELETE' or (tg_op='UPDATE' and new.deleted_at is not null) then
      if exists(select 1 from rakeezx.calendars c where c.owner_id=(v_row->>'owner_id')::uuid
        and c.year_id=v_year_id and c.deleted_at is null and c.term_date_overrides ? (v_row->>'id')) then
        raise exception using errcode='22023',message='N58_OVERRIDE_TERM_RETIREMENT_BLOCKED'; end if;
    end if;
  elsif tg_table_name in ('teachings','sections') then
    if tg_op='UPDATE' and (v_year.calendar_preset_id is not null or
      (tg_table_name='sections' and exists(select 1 from rakeezx.years y where y.owner_id=new.owner_id
        and y.id=v_old->>'year_id' and y.calendar_preset_id is not null)) or
      (tg_table_name='teachings' and exists(select 1 from rakeezx.terms t join rakeezx.years y
        on y.owner_id=t.owner_id and y.id=t.year_id where t.owner_id=new.owner_id
        and t.id=v_old->>'term_id' and y.calendar_preset_id is not null))) and ((tg_table_name='teachings' and
      (v_row->>'section_id',v_row->>'subject_id',v_row->>'term_id') is distinct from
      (v_old->>'section_id',v_old->>'subject_id',v_old->>'term_id')) or
      (tg_table_name='sections' and v_row->>'year_id' is distinct from v_old->>'year_id')) then
      -- Retain the stable parent identity used by recorded contexts/history.
      raise exception using errcode='22023',message='N58_IMMUTABLE_TEACHING_PARENT'; end if;
    if tg_table_name='teachings' and v_year.calendar_preset_id is not null and tg_op<>'DELETE' and
      not exists(select 1 from rakeezx.sections s where s.owner_id=(v_row->>'owner_id')::uuid and s.id=v_row->>'section_id' and s.year_id=v_year_id) then
      raise exception using errcode='22023',message='N58_TEACHING_YEAR_MISMATCH'; end if;
  elsif tg_table_name='sessions' and tg_op<>'DELETE' then
    if tg_op='UPDATE' then
      if new.calendar_context is distinct from old.calendar_context then
        raise exception using errcode='22023',message='N58_IMMUTABLE_SESSION_CONTEXT'; end if;
      if (old.calendar_context is not null or v_year.calendar_preset_id is not null or
        exists(select 1 from rakeezx.teachings x join rakeezx.terms t on t.owner_id=x.owner_id and t.id=x.term_id
          join rakeezx.years y on y.owner_id=t.owner_id and y.id=t.year_id
          where x.owner_id=old.owner_id and x.id=old.teaching_id and y.calendar_preset_id is not null)) and
        (new.teaching_id,new.date,new.period) is distinct from (old.teaching_id,old.date,old.period) then
        raise exception using errcode='22023',message='N58_IMMUTABLE_SESSION_IDENTITY'; end if;
    else
      v_context:=new.calendar_context;
      if v_context is null and v_year.calendar_preset_id is not null and not v_fresh_restore then
        raise exception using errcode='22023',message='N58_SESSION_CONTEXT_REQUIRED'; end if;
      if v_context is not null then
        if pg_catalog.jsonb_typeof(v_context)<>'object' or pg_catalog.octet_length(v_context::text)>2048 or
          not (v_context ?& array['yearId','termId','presetId','selectionRevision','kind','source']) or
          v_context-array['yearId','termId','presetId','selectionRevision','kind','source','label']<>'{}'::jsonb or
          pg_catalog.jsonb_typeof(v_context->'yearId')<>'string' or pg_catalog.jsonb_typeof(v_context->'termId')<>'string' or
          pg_catalog.jsonb_typeof(v_context->'presetId')<>'string' or pg_catalog.jsonb_typeof(v_context->'kind')<>'string' or
          pg_catalog.jsonb_typeof(v_context->'source')<>'string' or
          (v_context ? 'label' and (pg_catalog.jsonb_typeof(v_context->'label')<>'string' or pg_catalog.length(v_context->>'label')>500)) or
          pg_catalog.jsonb_typeof(v_context->'selectionRevision')<>'number' or
          (v_context->>'selectionRevision') !~ '^[1-9][0-9]{0,17}$' or
          v_context->>'yearId' is distinct from v_year_id or v_context->>'termId' is distinct from v_term.id or
          not rakeezx.n58_valid_preset(v_context->>'presetId',v_year.hijri_start,v_year.hijri_end) or
          v_context->>'kind' not in ('study','holiday','national','founding','exam','event','remote','suspension') or
          v_context->>'source' not in ('custom','official','default') or v_term.deleted_at is not null or v_year.deleted_at is not null or
          not exists(select 1 from rakeezx.teachings x where x.owner_id=new.owner_id and x.id=new.teaching_id and x.deleted_at is null) then
          raise exception using errcode='22023',message='N58_INVALID_SESSION_CONTEXT'; end if;
        if not v_fresh_restore and (v_year.calendar_preset_id is null or
          v_context->>'presetId' is distinct from v_year.calendar_preset_id or
          (v_context->>'selectionRevision')::bigint is distinct from (v_year.field_revisions->>'calendar_selection')::bigint) then
          raise exception using errcode='40001',message='N58_STALE_CALENDAR_SELECTION'; end if;
      end if;
    end if;
  end if;
  if tg_op='DELETE' then return old; else return new; end if;
end; $$;
revoke all on function rakeezx.n58_guard_calendar_contract() from public,anon,authenticated;

do $$ declare v_table text; begin
  foreach v_table in array array['years','terms','calendars','calendar_days','sessions','teachings','sections'] loop
    execute pg_catalog.format('create trigger "01_n58_calendar_contract" before insert or update or delete on rakeezx.%I
      for each row execute function rakeezx.n58_guard_calendar_contract()',v_table);
  end loop;
end $$;

-- Provisioning remains deliberately legacy/unselected. Its dynamic snapshots
-- include all new fields; ON CONFLICT DO NOTHING cannot erase a selection.
-- No official rows, dates, accounts, history or attendance are rewritten.
commit;
