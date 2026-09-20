begin;

alter table rakeezx.profile
  add column teacher_form text not null default 'masculine',
  add column profile_status text not null default 'PENDING_PROFILE';

alter table rakeezx.profile
  add constraint profile_teacher_form_check
    check (teacher_form in ('masculine', 'feminine')),
  add constraint profile_status_check
    check (profile_status in ('PENDING_PROFILE', 'READY'));

-- Existing accounts are grandfathered without blocking their current workspace.
-- Their existing values remain byte-for-byte unchanged; only the new contract
-- fields receive deterministic compatibility values.
update rakeezx.profile
   set teacher_form = 'masculine',
       profile_status = 'READY';

create table rakeezx.account_access_grants (
  owner_id    uuid not null references auth.users(id) on delete cascade,
  grant_type  text not null,
  status      text not null,
  starts_at   timestamptz not null default now(),
  expires_at  timestamptz,
  source      text not null,
  granted_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (owner_id, grant_type),
  constraint account_access_grants_type_check check (grant_type in ('beta_full')),
  constraint account_access_grants_status_check check (status in ('active')),
  constraint account_access_grants_source_check check (source in ('public_beta')),
  constraint account_access_grants_expiry_check check (expires_at is null or expires_at > starts_at)
);

create trigger account_access_grants_touch
  before update on rakeezx.account_access_grants
  for each row execute function rakeezx.touch_updated_at();

alter table rakeezx.account_access_grants enable row level security;
alter table rakeezx.account_access_grants force row level security;

create policy account_access_grants_select on rakeezx.account_access_grants
  for select to authenticated
  using (owner_id = (select auth.uid()));

revoke all on table rakeezx.account_access_grants from public, anon, authenticated;
grant select on table rakeezx.account_access_grants to authenticated;

-- Only accounts already represented by a RAKEEZ profile are backfilled. Future
-- authenticated accounts receive the same fixed grant through provisioning.
insert into rakeezx.account_access_grants (
  owner_id, grant_type, status, source, expires_at, granted_by
)
select owner_id, 'beta_full', 'active', 'public_beta', null, null
  from rakeezx.profile
on conflict (owner_id, grant_type) do nothing;

create function rakeezx.guard_profile_readiness()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_completion text := pg_catalog.current_setting('rakeezx.profile_completion', true);
begin
  if tg_op = 'INSERT' then
    new.profile_status := case when v_completion = 'ready' then 'READY' else 'PENDING_PROFILE' end;
  elsif new.profile_status is distinct from old.profile_status and v_completion is distinct from 'ready' then
    raise exception using errcode = '42501', message = 'Profile readiness is server controlled';
  end if;
  return new;
end;
$$;

create trigger profile_readiness_guard
  before insert or update of profile_status on rakeezx.profile
  for each row execute function rakeezx.guard_profile_readiness();

-- Extend the current Sync V2 profile contract without replacing later entity
-- wrappers installed by previous migrations.
alter function rakeezx.sync_v2_field_map(text)
  rename to sync_v2_field_map_before_profile_access_0032;

create function rakeezx.sync_v2_field_map(p_entity text)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case p_entity
    when 'profile' then '{
      "teacher_name":"teacher_name","school_name":"school_name","phone":"phone",
      "teacher_form":"teacher_form","report_principal_name":"report_principal_name",
      "active_time_profile_id":"timing_selection"
    }'::jsonb
    else rakeezx.sync_v2_field_map_before_profile_access_0032(p_entity)
  end;
$$;

revoke all on function rakeezx.sync_v2_field_map_before_profile_access_0032(text) from public;
revoke all on function rakeezx.sync_v2_field_map(text) from public;

create function rakeezx.account_contract()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_profile rakeezx.profile%rowtype;
  v_access rakeezx.account_access_grants%rowtype;
begin
  if v_owner is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  select * into v_profile from rakeezx.profile where owner_id = v_owner;
  select * into v_access
    from rakeezx.account_access_grants
   where owner_id = v_owner and grant_type = 'beta_full';

  return pg_catalog.jsonb_build_object(
    'ownerId', v_owner,
    'profileStatus', coalesce(v_profile.profile_status, 'PENDING_PROFILE'),
    'profile', pg_catalog.jsonb_build_object(
      'teacherName', coalesce(v_profile.teacher_name, ''),
      'phone', coalesce(v_profile.phone, ''),
      'teacherForm', coalesce(v_profile.teacher_form, 'masculine'),
      'schoolName', coalesce(v_profile.school_name, '')
    ),
    'access', case when v_access.owner_id is null then null else pg_catalog.jsonb_build_object(
      'grantType', v_access.grant_type,
      'status', v_access.status,
      'startsAt', v_access.starts_at,
      'expiresAt', v_access.expires_at,
      'source', v_access.source,
      'label', 'الوصول التجريبي المجاني'
    ) end
  );
end;
$$;

create function rakeezx.provision_account_profile()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
begin
  if v_owner is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  insert into rakeezx.profile (owner_id, teacher_form, profile_status)
  values (v_owner, 'masculine', 'PENDING_PROFILE')
  on conflict (owner_id) do nothing;

  insert into rakeezx.account_access_grants (
    owner_id, grant_type, status, source, expires_at, granted_by
  ) values (v_owner, 'beta_full', 'active', 'public_beta', null, null)
  on conflict (owner_id, grant_type) do nothing;

  return rakeezx.account_contract();
end;
$$;

create function rakeezx.complete_account_profile(
  p_teacher_name text,
  p_phone text,
  p_teacher_form text,
  p_school_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_name text := pg_catalog.btrim(coalesce(p_teacher_name, ''));
  v_phone text := pg_catalog.btrim(coalesce(p_phone, ''));
  v_form text := pg_catalog.btrim(coalesce(p_teacher_form, ''));
  v_school text := pg_catalog.btrim(coalesce(p_school_name, ''));
begin
  if v_owner is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;
  if v_name = '' then
    raise exception using errcode = '22023', message = 'Teacher name is required';
  end if;
  if v_phone = '' then
    raise exception using errcode = '22023', message = 'Phone is required';
  end if;
  if v_form not in ('masculine', 'feminine') then
    raise exception using errcode = '22023', message = 'Invalid teacher form';
  end if;

  perform pg_catalog.set_config('rakeezx.profile_completion', 'ready', true);
  insert into rakeezx.profile (
    owner_id, teacher_name, phone, teacher_form, school_name, profile_status
  ) values (
    v_owner, v_name, v_phone, v_form, v_school, 'READY'
  )
  on conflict (owner_id) do update set
    teacher_name = excluded.teacher_name,
    phone = excluded.phone,
    teacher_form = excluded.teacher_form,
    school_name = excluded.school_name,
    profile_status = 'READY';

  insert into rakeezx.account_access_grants (
    owner_id, grant_type, status, source, expires_at, granted_by
  ) values (v_owner, 'beta_full', 'active', 'public_beta', null, null)
  on conflict (owner_id, grant_type) do nothing;

  return rakeezx.account_contract();
end;
$$;

revoke all on function rakeezx.account_contract() from public, anon;
revoke all on function rakeezx.provision_account_profile() from public, anon;
revoke all on function rakeezx.complete_account_profile(text,text,text,text) from public, anon;
grant execute on function rakeezx.account_contract() to authenticated;
grant execute on function rakeezx.provision_account_profile() to authenticated;
grant execute on function rakeezx.complete_account_profile(text,text,text,text) to authenticated;

commit;
