-- New accounts only. Existing profiles have NULL provisioning state and keep
-- their current claimed/restore contracts without any data rewrite.
begin;

alter table rakeezx.profile
  add column provisioning_state text,
  add column provisioning_version integer,
  add column provisioning_hash text,
  add column provisioning_manifest jsonb,
  add column provisioning_started_at timestamptz,
  add column provisioning_completed_at timestamptz,
  add constraint profile_provisioning_state_check
    check (provisioning_state is null or provisioning_state in
      ('PROFILE_REQUIRED', 'PROVISIONING_REQUIRED', 'PROVISIONING', 'READY')),
  add constraint profile_provisioning_version_check
    check (provisioning_version is null or provisioning_version = 1);

create function rakeezx.guard_account_provisioning_state()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  -- A caller may set a custom GUC; only a server-owned SECURITY DEFINER RPC
  -- may cross this guard. Direct authenticated table writes stay forbidden.
  if tg_op = 'INSERT' and
      (new.provisioning_state, new.provisioning_version, new.provisioning_hash, new.provisioning_manifest,
       new.provisioning_started_at, new.provisioning_completed_at)
      is distinct from (null::text, null::integer, null::text, null::jsonb, null::timestamptz, null::timestamptz) and
      (pg_catalog.current_setting('rakeezx.account_provisioning_control', true) is distinct from 'allow' or
       current_user <> (select pg_catalog.pg_get_userbyid(p.proowner) from pg_catalog.pg_proc p
         where p.oid = 'rakeezx.provision_account_workspace(jsonb)'::pg_catalog.regprocedure)) then
    raise exception using errcode = '42501', message = 'Provisioning state is server controlled';
  end if;
  if tg_op = 'UPDATE' and (new.provisioning_state, new.provisioning_version, new.provisioning_hash,
      new.provisioning_manifest,
      new.provisioning_started_at, new.provisioning_completed_at)
     is distinct from
     (old.provisioning_state, old.provisioning_version, old.provisioning_hash,
      old.provisioning_manifest,
      old.provisioning_started_at, old.provisioning_completed_at)
     and (pg_catalog.current_setting('rakeezx.account_provisioning_control', true) is distinct from 'allow' or
       current_user <> (select pg_catalog.pg_get_userbyid(p.proowner) from pg_catalog.pg_proc p
         where p.oid = 'rakeezx.provision_account_workspace(jsonb)'::pg_catalog.regprocedure)) then
    raise exception using errcode = '42501', message = 'Provisioning state is server controlled';
  end if;
  return new;
end;
$$;

create trigger profile_provisioning_guard
  before insert or update of provisioning_state, provisioning_version, provisioning_hash, provisioning_manifest,
    provisioning_started_at, provisioning_completed_at on rakeezx.profile
  for each row execute function rakeezx.guard_account_provisioning_state();

-- The receipt records immutable required IDs, not a client-controlled READY
-- flag. Later user-authored rows may coexist; missing required IDs fail closed.
create function rakeezx.account_provisioning_foundation_complete(p_owner uuid)
returns boolean language plpgsql stable security invoker set search_path = '' as $$
declare v_manifest jsonb;
begin
  select provisioning_manifest into v_manifest from rakeezx.profile
    where owner_id=p_owner and provisioning_state='READY' and provisioning_version=1;
  if v_manifest is null or pg_catalog.jsonb_typeof(v_manifest) <> 'object' then return false; end if;
  if coalesce(pg_catalog.jsonb_array_length(v_manifest->'years'),0) <> 1 or
      coalesce(pg_catalog.jsonb_array_length(v_manifest->'terms'),0) <> 2 or
      coalesce(pg_catalog.jsonb_array_length(v_manifest->'subjects'),0) <> 1 or
      coalesce(pg_catalog.jsonb_array_length(v_manifest->'calendars'),0) <> 1 or
      coalesce(pg_catalog.jsonb_array_length(v_manifest->'calendarDays'),0) < 1 or
      coalesce(pg_catalog.jsonb_array_length(v_manifest->'timeProfiles'),0) <> 4 then
    return false;
  end if;
  if exists(select 1 from pg_catalog.jsonb_array_elements_text(v_manifest->'years') id
      where not exists(select 1 from rakeezx.years r where r.owner_id=p_owner and r.id=id.value and r.deleted_at is null))
    or exists(select 1 from pg_catalog.jsonb_array_elements_text(v_manifest->'terms') id
      where not exists(select 1 from rakeezx.terms r where r.owner_id=p_owner and r.id=id.value and r.deleted_at is null))
    or exists(select 1 from pg_catalog.jsonb_array_elements_text(v_manifest->'subjects') id
      where not exists(select 1 from rakeezx.subjects r where r.owner_id=p_owner and r.id=id.value and r.deleted_at is null))
    or exists(select 1 from pg_catalog.jsonb_array_elements_text(v_manifest->'calendars') id
      where not exists(select 1 from rakeezx.calendars r where r.owner_id=p_owner and r.id=id.value and r.deleted_at is null))
    or exists(select 1 from pg_catalog.jsonb_array_elements_text(v_manifest->'calendarDays') id
      where not exists(select 1 from rakeezx.calendar_days r where r.owner_id=p_owner and r.id=id.value and r.deleted_at is null))
    or exists(select 1 from pg_catalog.jsonb_array_elements_text(v_manifest->'timeProfiles') id
      where not exists(select 1 from rakeezx.time_profiles r where r.owner_id=p_owner and r.id=id.value and r.deleted_at is null)) then
    return false;
  end if;
  return true;
end;
$$;

alter function rakeezx.account_contract() rename to account_contract_before_provisioning_0297;
alter function rakeezx.provision_account_profile() rename to provision_account_profile_before_provisioning_0297;
alter function rakeezx.complete_account_profile(text,text,text,text)
  rename to complete_account_profile_before_provisioning_0297;
revoke all on function rakeezx.account_contract_before_provisioning_0297() from public, anon, authenticated;
revoke all on function rakeezx.provision_account_profile_before_provisioning_0297() from public, anon, authenticated;
revoke all on function rakeezx.complete_account_profile_before_provisioning_0297(text,text,text,text)
  from public, anon, authenticated;

create function rakeezx.account_contract()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_owner uuid := auth.uid(); v_base jsonb; v_profile rakeezx.profile%rowtype;
begin
  if v_owner is null then raise exception using errcode='42501', message='Authentication required'; end if;
  v_base := rakeezx.account_contract_before_provisioning_0297();
  select * into v_profile from rakeezx.profile where owner_id = v_owner;
  return v_base || pg_catalog.jsonb_build_object('provisioning',
    case when v_profile.provisioning_state is null then null else pg_catalog.jsonb_build_object(
      'state', case when v_profile.provisioning_state='READY' and
        not rakeezx.account_provisioning_foundation_complete(v_owner)
        then 'PROVISIONING' else v_profile.provisioning_state end,
      'version', v_profile.provisioning_version,
      'foundationHash', v_profile.provisioning_hash
    ) end);
end;
$$;

create function rakeezx.provision_account_profile()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_owner uuid := auth.uid(); v_existed boolean;
begin
  if v_owner is null then raise exception using errcode='42501', message='Authentication required'; end if;
  select exists(select 1 from rakeezx.profile where owner_id=v_owner) into v_existed;
  perform rakeezx.provision_account_profile_before_provisioning_0297();
  if not v_existed then
    perform pg_catalog.set_config('rakeezx.account_provisioning_control','allow',true);
    update rakeezx.profile set provisioning_state='PROFILE_REQUIRED', provisioning_version=1
      where owner_id=v_owner and provisioning_state is null and profile_status='PENDING_PROFILE';
  end if;
  return rakeezx.account_contract();
end;
$$;

create function rakeezx.complete_account_profile(
  p_teacher_name text, p_phone text, p_teacher_form text, p_school_name text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_owner uuid := auth.uid();
begin
  if v_owner is null then raise exception using errcode='42501', message='Authentication required'; end if;
  if pg_catalog.btrim(coalesce(p_phone,'')) !~ '^05[0-9]{8}$' then
    raise exception using errcode='22023', message='Invalid Saudi mobile';
  end if;
  perform rakeezx.complete_account_profile_before_provisioning_0297(
    p_teacher_name,p_phone,p_teacher_form,p_school_name);
  perform pg_catalog.set_config('rakeezx.account_provisioning_control','allow',true);
  update rakeezx.profile set provisioning_state='PROVISIONING_REQUIRED'
    where owner_id=v_owner and provisioning_state='PROFILE_REQUIRED';
  return rakeezx.account_contract();
end;
$$;

create function rakeezx.begin_account_provisioning()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_owner uuid := auth.uid(); v_profile rakeezx.profile%rowtype;
begin
  if v_owner is null then raise exception using errcode='42501', message='Authentication required'; end if;
  select * into v_profile from rakeezx.profile where owner_id=v_owner for update;
  if v_profile.owner_id is null or v_profile.provisioning_state is null then
    raise exception using errcode='42501', message='Account is not a fresh provisioning candidate';
  end if;
  if v_profile.profile_status <> 'READY' or v_profile.teacher_name = '' or
      v_profile.phone !~ '^05[0-9]{8}$' or
      not exists(select 1 from rakeezx.account_access_grants
        where owner_id=v_owner and grant_type='beta_full' and status='active' and
          (expires_at is null or expires_at > now())) then
    raise exception using errcode='42501', message='Profile or Beta access is not ready';
  end if;
  if v_profile.provisioning_state='PROVISIONING_REQUIRED' then
    perform pg_catalog.set_config('rakeezx.account_provisioning_control','allow',true);
    update rakeezx.profile set provisioning_state='PROVISIONING', provisioning_started_at=now()
      where owner_id=v_owner;
  elsif v_profile.provisioning_state not in ('PROVISIONING','READY') then
    raise exception using errcode='42501', message='Profile completion is required';
  end if;
  return rakeezx.account_contract();
end;
$$;

-- Canonical foundation rows, including server revisions, are returned only to
-- the owner after the complete server checkpoint. No user-created rows exist.
create function rakeezx.account_provisioning_snapshot()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_owner uuid := auth.uid();
begin
  if v_owner is null or not rakeezx.account_provisioning_foundation_complete(v_owner) then
    raise exception using errcode='42501', message='Account provisioning is not ready';
  end if;
  return pg_catalog.jsonb_build_object(
    'profile', (select pg_catalog.jsonb_build_array(pg_catalog.to_jsonb(p)) from rakeezx.profile p where p.owner_id=v_owner),
    'years', (select coalesce(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(r) order by r.id),'[]'::jsonb) from rakeezx.years r where r.owner_id=v_owner),
    'terms', (select coalesce(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(r) order by r.id),'[]'::jsonb) from rakeezx.terms r where r.owner_id=v_owner),
    'subjects', (select coalesce(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(r) order by r.id),'[]'::jsonb) from rakeezx.subjects r where r.owner_id=v_owner),
    'calendars', (select coalesce(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(r) order by r.id),'[]'::jsonb) from rakeezx.calendars r where r.owner_id=v_owner),
    'calendar_days', (select coalesce(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(r) order by r.id),'[]'::jsonb) from rakeezx.calendar_days r where r.owner_id=v_owner),
    'time_profiles', (select coalesce(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(r) order by r.id),'[]'::jsonb) from rakeezx.time_profiles r where r.owner_id=v_owner)
  );
end;
$$;

create function rakeezx.provision_account_workspace(p_defaults jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := auth.uid(); v_profile rakeezx.profile%rowtype;
  v_year jsonb; v_calendar jsonb; v_subject jsonb; v_row jsonb;
  v_hash text; v_manifest jsonb;
begin
  if v_owner is null then raise exception using errcode='42501', message='Authentication required'; end if;
  select * into v_profile from rakeezx.profile where owner_id=v_owner for update;
  if v_profile.owner_id is null or v_profile.provisioning_state not in ('PROVISIONING','READY') or
      v_profile.profile_status <> 'READY' then
    raise exception using errcode='42501', message='Account provisioning has not begun';
  end if;
  if v_profile.provisioning_state='READY' and
      rakeezx.account_provisioning_foundation_complete(v_owner) then
    return pg_catalog.jsonb_build_object('contract',rakeezx.account_contract(),
      'snapshot',rakeezx.account_provisioning_snapshot());
  end if;
  if not exists(select 1 from rakeezx.account_access_grants where owner_id=v_owner and
      grant_type='beta_full' and status='active' and (expires_at is null or expires_at > now())) then
    raise exception using errcode='42501', message='Beta access is required';
  end if;
  if p_defaults is null or pg_catalog.jsonb_typeof(p_defaults) <> 'object' or
      pg_catalog.jsonb_array_length(p_defaults->'years') <> 1 or
      pg_catalog.jsonb_array_length(p_defaults->'terms') <> 2 or
      pg_catalog.jsonb_array_length(p_defaults->'subjects') <> 1 or
      pg_catalog.jsonb_array_length(p_defaults->'calendars') <> 1 or
      pg_catalog.jsonb_array_length(p_defaults->'timeProfiles') <> 4 or
      pg_catalog.jsonb_array_length(p_defaults->'calendarDays') < 1 then
    raise exception using errcode='22023', message='Invalid foundation shape';
  end if;
  if v_profile.provisioning_state='READY' and
      v_profile.provisioning_hash is distinct from pg_catalog.md5(p_defaults::text) then
    raise exception using errcode='42501', message='Provisioning repair snapshot mismatch';
  end if;
  v_year := p_defaults->'years'->0;
  v_calendar := p_defaults->'calendars'->0;
  v_subject := p_defaults->'subjects'->0;
  if v_year->>'id' <> 'y:1448-1449' or (v_year->>'hijriStart')::int <> 1448 or
      (v_year->>'hijriEnd')::int <> 1449 or v_year->>'status' <> 'active' or
      v_calendar->>'id' <> 'cal:y:1448-1449:preset:sa-western-1448-1449' or
      v_calendar->>'yearId' <> 'y:1448-1449' or
      v_calendar->>'source' <> 'preset:sa-western-1448-1449' or
      v_subject->>'id' <> 'sub:digital-skills' or v_subject->>'slug' <> 'digital-skills' or
      v_subject->>'name' <> 'المهارات الرقمية' then
    raise exception using errcode='22023', message='Invalid foundation identity';
  end if;
  -- A crash may leave a matching subset from an older interrupted flow. Only
  -- missing IDs can be inserted; conflicting or unrelated existing rows stop.
  if v_profile.provisioning_state<>'READY' and (
    exists(select 1 from rakeezx.years r where r.owner_id=v_owner and
      (r.id<>v_year->>'id' or r.deleted_at is not null or r.label is distinct from v_year->>'label' or
       r.hijri_start is distinct from (v_year->>'hijriStart')::int or
       r.hijri_end is distinct from (v_year->>'hijriEnd')::int or
       r."order" is distinct from (v_year->>'order')::int or r.status is distinct from v_year->>'status')) or
    exists(select 1 from rakeezx.calendars r where r.owner_id=v_owner and
      (r.id<>v_calendar->>'id' or r.deleted_at is not null or
       r.year_id is distinct from v_calendar->>'yearId' or r.source is distinct from 'moe' or
       r.label is distinct from v_calendar->>'label')) or
    exists(select 1 from rakeezx.subjects r where r.owner_id=v_owner and
      (r.id<>v_subject->>'id' or r.deleted_at is not null or
       r.name is distinct from v_subject->>'name' or r.slug is distinct from v_subject->>'slug')) or
    exists(select 1 from rakeezx.terms r where r.owner_id=v_owner and
      r.id not in (select value->>'id' from pg_catalog.jsonb_array_elements(p_defaults->'terms'))) or
    exists(select 1 from rakeezx.calendar_days r where r.owner_id=v_owner and
      r.id not in (select value->>'id' from pg_catalog.jsonb_array_elements(p_defaults->'calendarDays'))) or
    exists(select 1 from rakeezx.time_profiles r where r.owner_id=v_owner and
      r.id not in (select value->>'id' from pg_catalog.jsonb_array_elements(p_defaults->'timeProfiles')))) then
    raise exception using errcode='23505', message='Conflicting foundation requires explicit recovery';
  end if;
  for v_row in select value from pg_catalog.jsonb_array_elements(p_defaults->'terms') loop
    if v_row->>'yearId' <> v_year->>'id' or v_row->>'id' <>
        'tm:y:1448-1449:' || (v_row->>'index') or (v_row->>'index')::int not in (1,2) then
      raise exception using errcode='22023', message='Invalid term identity';
    end if;
    if v_profile.provisioning_state<>'READY' and exists(select 1 from rakeezx.terms r where r.owner_id=v_owner and r.id=v_row->>'id' and
      (r.deleted_at is not null or r.year_id is distinct from v_row->>'yearId' or
       r.name is distinct from v_row->>'name' or r."index" is distinct from (v_row->>'index')::int or
       r.start_date is distinct from nullif(v_row->>'startDate','')::date or
       r.end_date is distinct from nullif(v_row->>'endDate','')::date or
       r.status is distinct from v_row->>'status' or r.calendar_id is distinct from v_row->>'calendarId')) then
      raise exception using errcode='23505', message='Conflicting term requires explicit recovery';
    end if;
  end loop;
  for v_row in select value from pg_catalog.jsonb_array_elements(p_defaults->'calendarDays') loop
    if v_row->>'calendarId' <> v_calendar->>'id' or v_row->>'id' <>
        'cd:' || (v_calendar->>'id') || ':' || (v_row->>'date') then
      raise exception using errcode='22023', message='Invalid calendar day identity';
    end if;
    if v_profile.provisioning_state<>'READY' and exists(select 1 from rakeezx.calendar_days r where r.owner_id=v_owner and r.id=v_row->>'id' and
      (r.deleted_at is not null or r.calendar_id is distinct from v_row->>'calendarId' or
       r.date is distinct from (v_row->>'date')::date or r.kind is distinct from v_row->>'kind' or
       r.label is distinct from v_row->>'label')) then
      raise exception using errcode='23505', message='Conflicting calendar day requires explicit recovery';
    end if;
  end loop;
  for v_row in select value from pg_catalog.jsonb_array_elements(p_defaults->'timeProfiles') loop
    if v_row->>'id' not in ('time-profile:default:summer','time-profile:default:winter',
        'time-profile:default:ramadan','time-profile:default:hybrid') or
        pg_catalog.jsonb_typeof(v_row->'periods') <> 'array' or
        pg_catalog.jsonb_typeof(v_row->'overrides') <> 'object' then
      raise exception using errcode='22023', message='Invalid timing profile';
    end if;
    if v_profile.provisioning_state<>'READY' and exists(select 1 from rakeezx.time_profiles r where r.owner_id=v_owner and r.id=v_row->>'id' and
      (r.deleted_at is not null or r.name is distinct from v_row->>'name' or
       r."order" is distinct from (v_row->>'order')::int or r.periods is distinct from v_row->'periods' or
       r.overrides is distinct from v_row->'overrides' or
       r.active_from is distinct from nullif(v_row->>'activeFrom','')::date or
       r.active_to is distinct from nullif(v_row->>'activeTo','')::date)) then
      raise exception using errcode='23505', message='Conflicting timing profile requires explicit recovery';
    end if;
  end loop;
  if (select count(distinct value->>'id') from pg_catalog.jsonb_array_elements(p_defaults->'terms')) <> 2 or
      (select count(distinct value->>'id') from pg_catalog.jsonb_array_elements(p_defaults->'calendarDays')) <>
        pg_catalog.jsonb_array_length(p_defaults->'calendarDays') or
      (select count(distinct value->>'id') from pg_catalog.jsonb_array_elements(p_defaults->'timeProfiles')) <> 4 then
    raise exception using errcode='22023', message='Duplicate foundation identity';
  end if;

  insert into rakeezx.years(owner_id,id,label,hijri_start,hijri_end,"order",status)
    values(v_owner,v_year->>'id',v_year->>'label',(v_year->>'hijriStart')::int,
      (v_year->>'hijriEnd')::int,(v_year->>'order')::int,v_year->>'status')
    on conflict (owner_id,id) do nothing;
  insert into rakeezx.calendars(owner_id,id,year_id,source,label)
    values(v_owner,v_calendar->>'id',v_calendar->>'yearId','moe',v_calendar->>'label')
    on conflict (owner_id,id) do nothing;
  for v_row in select value from pg_catalog.jsonb_array_elements(p_defaults->'terms') loop
    insert into rakeezx.terms(owner_id,id,year_id,name,"index",start_date,end_date,status,calendar_id)
      values(v_owner,v_row->>'id',v_row->>'yearId',v_row->>'name',(v_row->>'index')::int,
        nullif(v_row->>'startDate','')::date,nullif(v_row->>'endDate','')::date,
        v_row->>'status',v_row->>'calendarId') on conflict (owner_id,id) do nothing;
  end loop;
  insert into rakeezx.subjects(owner_id,id,name,slug)
    values(v_owner,v_subject->>'id',v_subject->>'name',v_subject->>'slug')
    on conflict (owner_id,id) do nothing;
  for v_row in select value from pg_catalog.jsonb_array_elements(p_defaults->'calendarDays') loop
    insert into rakeezx.calendar_days(owner_id,id,calendar_id,date,kind,label)
      values(v_owner,v_row->>'id',v_row->>'calendarId',(v_row->>'date')::date,
        v_row->>'kind',v_row->>'label') on conflict (owner_id,id) do nothing;
  end loop;
  for v_row in select value from pg_catalog.jsonb_array_elements(p_defaults->'timeProfiles') loop
    insert into rakeezx.time_profiles(owner_id,id,name,"order",periods,overrides,active_from,active_to)
      values(v_owner,v_row->>'id',v_row->>'name',(v_row->>'order')::int,
        v_row->'periods',v_row->'overrides',nullif(v_row->>'activeFrom','')::date,
        nullif(v_row->>'activeTo','')::date) on conflict (owner_id,id) do nothing;
  end loop;
  v_hash := pg_catalog.md5(p_defaults::text);
  v_manifest := pg_catalog.jsonb_build_object(
    'years',pg_catalog.jsonb_build_array(v_year->>'id'),
    'calendars',pg_catalog.jsonb_build_array(v_calendar->>'id'),
    'subjects',pg_catalog.jsonb_build_array(v_subject->>'id'),
    'terms',(select pg_catalog.jsonb_agg(value->>'id') from pg_catalog.jsonb_array_elements(p_defaults->'terms')),
    'calendarDays',(select pg_catalog.jsonb_agg(value->>'id') from pg_catalog.jsonb_array_elements(p_defaults->'calendarDays')),
    'timeProfiles',(select pg_catalog.jsonb_agg(value->>'id') from pg_catalog.jsonb_array_elements(p_defaults->'timeProfiles')));
  perform pg_catalog.set_config('rakeezx.account_provisioning_control','allow',true);
  update rakeezx.profile set provisioning_state='READY', provisioning_version=1,
      provisioning_hash=v_hash, provisioning_manifest=v_manifest,
      provisioning_completed_at=coalesce(provisioning_completed_at,now()) where owner_id=v_owner;
  if not rakeezx.account_provisioning_foundation_complete(v_owner) then
    raise exception using errcode='23514', message='Incomplete account foundation cannot be READY';
  end if;
  return pg_catalog.jsonb_build_object('contract',rakeezx.account_contract(),
    'snapshot',rakeezx.account_provisioning_snapshot());
end;
$$;

revoke all on function rakeezx.guard_account_provisioning_state() from public, anon, authenticated;
revoke all on function rakeezx.account_provisioning_foundation_complete(uuid) from public, anon, authenticated;
revoke all on function rakeezx.account_contract() from public, anon;
revoke all on function rakeezx.provision_account_profile() from public, anon;
revoke all on function rakeezx.complete_account_profile(text,text,text,text) from public, anon;
revoke all on function rakeezx.begin_account_provisioning() from public, anon;
revoke all on function rakeezx.provision_account_workspace(jsonb) from public, anon;
revoke all on function rakeezx.account_provisioning_snapshot() from public, anon;
grant execute on function rakeezx.account_contract() to authenticated;
grant execute on function rakeezx.provision_account_profile() to authenticated;
grant execute on function rakeezx.complete_account_profile(text,text,text,text) to authenticated;
grant execute on function rakeezx.begin_account_provisioning() to authenticated;
grant execute on function rakeezx.provision_account_workspace(jsonb) to authenticated;
grant execute on function rakeezx.account_provisioning_snapshot() to authenticated;

commit;
