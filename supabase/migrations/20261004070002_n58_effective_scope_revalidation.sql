-- N58 RED remediation: revalidate every effective preset scope after identity changes.
begin;
set local lock_timeout = '10s';

create or replace function rakeezx.n58_validate_overrides(p_owner uuid,p_year text,p_preset text,p_value jsonb)
returns void language plpgsql stable security definer set search_path='' as $$
declare v_entry record; v_index integer; v_start date; v_end date;
begin
  if p_value is null or pg_catalog.jsonb_typeof(p_value)<>'object' or
    pg_catalog.octet_length(p_value::text)>2048 then
    raise exception using errcode='22023',message='N58_INVALID_TERM_OVERRIDES'; end if;
  if p_preset is null then
    if p_value<>'{}'::jsonb then raise exception using errcode='22023',message='N58_UNSCOPED_TERM_OVERRIDES'; end if;
    return;
  end if;
  for v_entry in select * from pg_catalog.jsonb_each(p_value) loop
    select t."index" into v_index from rakeezx.terms t where t.owner_id=p_owner
      and t.year_id=p_year and t.id=v_entry.key and t.deleted_at is null;
    if v_index is null or v_index not between 1 and 6 or pg_catalog.jsonb_typeof(v_entry.value)<>'object' or
      not (v_entry.value ?& array['start_date','end_date']) or
      v_entry.value-array['start_date','end_date']<>'{}'::jsonb or
      pg_catalog.jsonb_typeof(v_entry.value->'start_date')<>'string' or
      pg_catalog.jsonb_typeof(v_entry.value->'end_date')<>'string' or
      (v_entry.value->>'start_date') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or
      (v_entry.value->>'end_date') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
      raise exception using errcode='22023',message='N58_INVALID_TERM_OVERRIDE_PAIR'; end if;
    begin
      v_start:=(v_entry.value->>'start_date')::date; v_end:=(v_entry.value->>'end_date')::date;
    exception when datetime_field_overflow or invalid_datetime_format then
      raise exception using errcode='22023',message='N58_INVALID_TERM_OVERRIDE_DATE';
    end;
    if v_start>v_end then raise exception using errcode='22023',message='N58_INVALID_TERM_OVERRIDE_PAIR'; end if;
  end loop;
  if exists(with effective as (
    select t.id,
      coalesce((p_value->t.id->>'start_date')::date,case t."index"
        when 1 then case p_preset when 'sa-general-1448-1449' then '2026-08-23'::date else '2026-08-30'::date end
        when 2 then '2027-01-17'::date else t.start_date end) s,
      coalesce((p_value->t.id->>'end_date')::date,case t."index"
        when 1 then '2027-01-07'::date
        when 2 then case p_preset when 'sa-general-1448-1449' then '2027-06-24'::date else '2027-07-01'::date end
        else t.end_date end) e
    from rakeezx.terms t where t.owner_id=p_owner and t.year_id=p_year and t.deleted_at is null
  ) select 1 from effective a join effective b on a.id<b.id
    where a.s<=b.e and b.s<=a.e) then
    raise exception using errcode='22023',message='N58_OVERLAPPING_TERM_OVERRIDES'; end if;
end; $$;
revoke all on function rakeezx.n58_validate_overrides(uuid,text,text,jsonb) from public,anon,authenticated;

create function rakeezx.n58_validate_effective_year(p_owner uuid,p_year text) returns void
language plpgsql stable security definer set search_path='' as $$
declare v_year rakeezx.years%rowtype; v_scope record;
begin
  select * into v_year from rakeezx.years where owner_id=p_owner and id=p_year;
  if not found or v_year.deleted_at is not null then return; end if;
  -- Even without a custom calendar, selection activates the official defaults.
  if v_year.calendar_preset_id is not null and not exists(
    select 1 from rakeezx.calendars c where c.owner_id=p_owner and c.year_id=p_year
      and c.preset_id=v_year.calendar_preset_id and c.deleted_at is null) then
    perform rakeezx.n58_validate_overrides(p_owner,p_year,v_year.calendar_preset_id,'{}'::jsonb);
  end if;
  for v_scope in select preset_id,term_date_overrides from rakeezx.calendars
    where owner_id=p_owner and year_id=p_year and preset_id is not null and deleted_at is null loop
    perform rakeezx.n58_validate_overrides(p_owner,p_year,v_scope.preset_id,v_scope.term_date_overrides);
  end loop;
end; $$;
revoke all on function rakeezx.n58_validate_effective_year(uuid,text) from public,anon,authenticated;

create function rakeezx.n58_revalidate_effective_scope_change() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_owner uuid; v_year text; v_stage record;
begin
  if tg_table_name='n58_restore_transactions' then
    -- The existing finalizer removes this marker only after all staged rows exist.
    for v_stage in select distinct o->>'recordId' year_id
      from rakeezx.sync_restore_stages s
      cross join lateral pg_catalog.jsonb_array_elements(s.operations) o
      where s.owner_id=old.owner_id and s.restore_id=old.restore_id
        and o->>'entity'='years' and o->>'operation'='create' loop
      perform rakeezx.n58_validate_effective_year(old.owner_id,v_stage.year_id);
    end loop;
    return old;
  end if;
  if tg_table_name='years' then
    v_owner:=new.owner_id; v_year:=new.id;
  elsif tg_op='DELETE' then
    v_owner:=old.owner_id; v_year:=old.year_id;
  else
    v_owner:=new.owner_id; v_year:=new.year_id;
  end if;
  if not rakeezx.n58_restore_creating_year(v_owner,v_year) then
    perform rakeezx.n58_validate_effective_year(v_owner,v_year);
  end if;
  if tg_op='DELETE' then return old; else return new; end if;
end; $$;
revoke all on function rakeezx.n58_revalidate_effective_scope_change() from public,anon,authenticated;

create trigger "99_n58_revalidate_year" after insert or update on rakeezx.years
  for each row execute function rakeezx.n58_revalidate_effective_scope_change();
create trigger "99_n58_revalidate_term" after insert or update or delete on rakeezx.terms
  for each row execute function rakeezx.n58_revalidate_effective_scope_change();
create trigger "99_n58_revalidate_calendar" after insert or update or delete on rakeezx.calendars
  for each row execute function rakeezx.n58_revalidate_effective_scope_change();
create trigger "99_n58_revalidate_restore" after delete on rakeezx.n58_restore_transactions
  for each row execute function rakeezx.n58_revalidate_effective_scope_change();
commit;
