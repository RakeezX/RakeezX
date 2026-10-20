// AI: derives the ONE CLI-created append migration from current released
// foundation implementation and the existing two approved preset definitions.
import fs from 'node:fs/promises';
import { buildAccountFoundationDefaults } from '../../src/lib/account-provisioning.js';
import { EDUCATION_DEPARTMENT_OPTIONS } from '../../src/lib/education-department-directory.js';
const file = 'supabase/migrations/20261020085614_n117_initial_department_calendar.sql';
const { preimages } = JSON.parse(await fs.readFile('tests/n117-20261020/local-service-definitions.json','utf8'));
const preimageGuard = preimages.map(({signature,body_md5}) => `  if (select md5(replace(prosrc,E'\\r\\n',E'\\n')) from pg_proc where oid='${signature}'::regprocedure) is distinct from '${body_md5}' then raise exception 'N117_SERVICE_PREIMAGE_DRIFT: ${signature}'; end if;`).join('\n');
const original = await fs.readFile('supabase/migrations/20260924003436_beta_new_account_provisioning.sql', 'utf8');
let provision = original.slice(original.indexOf('create function rakeezx.provision_account_workspace('), original.indexOf('\nrevoke all on function rakeezx.guard_account_provisioning_state'));
provision = provision.replace('create function', 'create or replace function');
provision = provision.replace('v_hash text; v_manifest jsonb;', 'v_hash text; v_manifest jsonb; v_preset text; v_expected jsonb; v_normalized jsonb; v_key text;');
provision = provision.replace('  select * into v_profile', '  perform rakeezx.lock_student_lifecycle(v_owner);\n  select * into v_profile');
const position = provision.indexOf('  if p_defaults is null');
const special = EDUCATION_DEPARTMENT_OPTIONS.filter(x => ['مكة المكرمة','جدة','المدينة المنورة','الطائف'].includes(x.shortLabel)).map(x=>`'${x.canonicalName}'`).join(',');
const normalized = id => Object.fromEntries(Object.entries(buildAccountFoundationDefaults(id)).map(([key, rows]) => [key, rows.map(({ updatedAt, ...row }) => row)]));
const validation = `  -- READY repair is kept behind the original immutable receipt/hash rules.
  -- Initial provisioning must never retag a previously committed foundation.
  if v_profile.provisioning_state='READY' then
    return rakeezx.provision_account_workspace_before_n117(p_defaults);
  end if;
  if v_profile.education_department is null or not exists(select 1 from rakeezx.education_departments where name=v_profile.education_department) then
    raise exception using errcode='22023', message='N117_DEPARTMENT_REQUIRED'; end if;
  v_preset:=case when v_profile.education_department in (${special}) then 'sa-western-1448-1449' else 'sa-general-1448-1449' end;
  v_expected:=case when v_preset='sa-western-1448-1449' then $western$${JSON.stringify(normalized('sa-western-1448-1449'))}$western$::jsonb
    else $general$${JSON.stringify(normalized('sa-general-1448-1449'))}$general$::jsonb end;
  if p_defaults is null or jsonb_typeof(p_defaults)<>'object' or (select array_agg(key order by key) from jsonb_each(p_defaults)) is distinct from (select array_agg(key order by key) from jsonb_each(v_expected)) then
    raise exception using errcode='22023', message='N117_INVALID_INITIAL_FOUNDATION'; end if;
  v_normalized:='{}'::jsonb;
  for v_key in select key from jsonb_each(v_expected) loop
    if jsonb_typeof(p_defaults->v_key)<>'array' then raise exception using errcode='22023',message='N117_INVALID_INITIAL_FOUNDATION'; end if;
    v_normalized:=jsonb_set(v_normalized,array[v_key],coalesce((select jsonb_agg(value-'updatedAt' order by ordinal) from jsonb_array_elements(p_defaults->v_key) with ordinality as x(value,ordinal)),'[]'::jsonb));
  end loop;
  if v_normalized is distinct from v_expected then raise exception using errcode='22023',message='N117_INITIAL_PRESET_MISMATCH'; end if;
  if exists(select 1 from rakeezx.years where owner_id=v_owner) or exists(select 1 from rakeezx.calendars where owner_id=v_owner)
    or exists(select 1 from rakeezx.terms where owner_id=v_owner) then
    raise exception using errcode='23505',message='N117_EXISTING_FOUNDATION_REQUIRES_RECOVERY'; end if;
`;
provision = provision.slice(0, position) + validation + provision.slice(position);
provision = provision.replace("v_calendar->>'id' <> 'cal:y:1448-1449:preset:sa-western-1448-1449'", "v_calendar->>'id' <> 'cal:y:1448-1449:preset:'||v_preset");
provision = provision.replace("v_calendar->>'source' <> 'preset:sa-western-1448-1449'", "v_calendar->>'source' <> 'preset:'||v_preset");
// Same supported canonical source codec: local preset:<id> -> server moe.
// N58 requires two terms before selection. No default preset is provisioned:
// assign the prevalidated selection ONLY to the row created by this transaction,
// before READY/commit/import. No existing year can enter this branch.
provision = provision.replace('  v_hash := pg_catalog.md5(p_defaults::text);', `  update rakeezx.years set calendar_preset_id=v_preset where owner_id=v_owner and id=v_year->>'id' and calendar_preset_id is null;
  v_hash := pg_catalog.md5(p_defaults::text);`);
const sql = `-- AI: N117 initial-only department/calendar. ONE append migration; no backfill.
begin;
set local lock_timeout='10s';
do $guard$ begin
${preimageGuard}
  if to_regprocedure('rakeezx.complete_account_profile_before_n117(text,text,text,text)') is not null or to_regprocedure('rakeezx.provision_account_workspace_before_n117(jsonb)') is not null then raise exception 'N117_ALREADY_APPLIED'; end if;
end $guard$;
-- No new tables/roles, Auth or RLS change. Existing private implementations
-- retain receipt recovery and four-argument existing-client compatibility.
alter function rakeezx.complete_account_profile(text,text,text,text) rename to complete_account_profile_before_n117;
revoke all on function rakeezx.complete_account_profile_before_n117(text,text,text,text) from public,anon,authenticated;
alter function rakeezx.provision_account_workspace(jsonb) rename to provision_account_workspace_before_n117;
revoke all on function rakeezx.provision_account_workspace_before_n117(jsonb) from public,anon,authenticated;

create function rakeezx.complete_account_profile(p_teacher_name text,p_phone text,p_teacher_form text,p_school_name text default null,p_education_department text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_owner uuid:=auth.uid(); v_profile rakeezx.profile%rowtype; v_department text;
begin
  if v_owner is null then raise exception using errcode='42501',message='Authentication required'; end if;
  perform rakeezx.lock_student_lifecycle(v_owner);
  select * into v_profile from rakeezx.profile where owner_id=v_owner for update;
  if not found then raise exception using errcode='42501',message='N117_PROFILE_CHECKPOINT_REQUIRED'; end if;
  if v_profile.provisioning_state in ('PROFILE_REQUIRED','PROVISIONING_REQUIRED','PROVISIONING') then
    v_department:=coalesce(p_education_department,v_profile.education_department);
    if v_department is null or not exists(select 1 from rakeezx.education_departments where name=v_department) then
      raise exception using errcode='22023',message='N117_DEPARTMENT_REQUIRED'; end if;
    if v_profile.provisioning_state='PROVISIONING' and v_profile.education_department is distinct from v_department then
      raise exception using errcode='22023',message='N117_INITIAL_DEPARTMENT_LOCKED'; end if;
    update rakeezx.profile set education_department=v_department where owner_id=v_owner;
  elsif p_education_department is not null and p_education_department is distinct from v_profile.education_department then
    raise exception using errcode='22023',message='N117_EXISTING_ACCOUNT_METADATA_ONLY';
  end if;
  perform rakeezx.complete_account_profile_before_n117(p_teacher_name,p_phone,p_teacher_form,p_school_name);
  return rakeezx.account_contract();
end $$;

${provision}
revoke all on function rakeezx.complete_account_profile(text,text,text,text,text) from public,anon;
grant execute on function rakeezx.complete_account_profile(text,text,text,text,text) to authenticated;
revoke all on function rakeezx.provision_account_workspace(jsonb) from public,anon;
grant execute on function rakeezx.provision_account_workspace(jsonb) to authenticated;
notify pgrst, 'reload schema';
commit;
`;
await fs.writeFile(file,sql);
console.log(file);
