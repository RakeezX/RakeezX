-- 0457.3 authorized extra-term correction. The preceding 38 files are frozen.
begin;
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
  -- Same inclusive overlap rule as existing teacher date edits. Official 1/2
  -- use preset bounds; extras use only explicit override or existing raw bounds.
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
commit;
