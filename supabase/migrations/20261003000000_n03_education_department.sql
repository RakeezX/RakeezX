-- N03 local candidate. Apply only after the explicit live schema gate.
begin;

-- Exact dated Work snapshot. A later catalog change needs a separate migration.
create table rakeezx.education_departments (
  name text primary key
);
revoke all on table rakeezx.education_departments from public, anon, authenticated;
insert into rakeezx.education_departments(name) values
  ('الإدارة العامة للتعليم بمنطقة الرياض'),
  ('الإدارة العامة للتعليم بمحافظة جدة'),
  ('الإدارة العامة للتعليم بمنطقة المدينة المنورة'),
  ('إدارة التعليم بمحافظة الطائف'),
  ('الإدارة العامة للتعليم بمنطقة نجران'),
  ('الإدارة العامة للتعليم بمنطقة الجوف'),
  ('الإدارة العامة للتعليم بمنطقة حائل'),
  ('الإدارة العامة للتعليم بمنطقة الباحة'),
  ('إدارة التعليم بمحافظة رجال ألمع'),
  ('إدارة التعليم بمحافظة الدوادمي'),
  ('إدارة التعليم بمحافظة ينبع'),
  ('إدارة التعليم بمحافظة عنيزة'),
  ('إدارة التعليم بمحافظة المجمعة'),
  ('إدارة التعليم بمحافظة القنفذة'),
  ('إدارة التعليم بمحافظة الليث'),
  ('إدارة التعليم بمحافظة صبيا'),
  ('إدارة التعليم بمحافظة الخرج'),
  ('إدارة التعليم بمحافظة العلا'),
  ('إدارة التعليم بمحافظة حوطة بني تميم والحريق'),
  ('إدارة التعليم بمحافظة شقراء'),
  ('إدارة التعليم بمحافظة القويعية'),
  ('الإدارة العامة للتعليم بمنطقة مكة المكرمة'),
  ('الإدارة العامة للتعليم بمنطقة القصيم'),
  ('الإدارة العامة للتعليم بمحافظة الأحساء'),
  ('الإدارة العامة للتعليم بالمنطقة الشرقية'),
  ('الإدارة العامة للتعليم بمنطقة تبوك'),
  ('إدارة التعليم بمحافظة المخواة'),
  ('الإدارة العامة للتعليم بمنطقة جازان'),
  ('الإدارة العامة للتعليم بمنطقة الحدود الشمالية'),
  ('إدارة التعليم بمحافظة الرس'),
  ('إدارة التعليم بمحافظة سراة عبيدة'),
  ('إدارة التعليم بمحافظة مهد الذهب'),
  ('إدارة التعليم بمحافظة النماص'),
  ('إدارة التعليم بمحافظة وادي الدواسر'),
  ('إدارة التعليم بمحافظة بيشة'),
  ('إدارة التعليم بمحافظة البكيرية'),
  ('إدارة التعليم بمحافظة الأفلاج'),
  ('إدارة التعليم بمحافظة القريات'),
  ('إدارة التعليم بمحافظة محايل عسير'),
  ('إدارة التعليم بمحافظة الزلفي'),
  ('إدارة التعليم بمحافظة عفيف'),
  ('الإدارة العامة للتعليم بمنطقة عسير'),
  ('إدارة التعليم بمحافظة الغاط'),
  ('إدارة التعليم بمحافظة المذنب'),
  ('إدارة التعليم بمحافظة حفر الباطن'),
  ('إدارة التعليم بمحافظة ظهران الجنوب'),
  ('إدارة التعليم بمحافظة شرورة')
;

alter table rakeezx.profile
  add column education_department text,
  add constraint profile_education_department_official
    foreign key (education_department) references rakeezx.education_departments(name);

-- The Sync protocol already checks the field map before applying mutations.
-- Give this field its own conflict group and let the existing revision trigger
-- stamp it. All other entity maps and profile fields retain their meaning.
alter function rakeezx.sync_v2_field_map(text) rename to sync_v2_field_map_before_n03;
revoke all on function rakeezx.sync_v2_field_map_before_n03(text) from public, anon;
create function rakeezx.sync_v2_field_map(p_entity text)
returns jsonb language sql immutable set search_path = '' as $$
  select case when p_entity = 'profile'
    then rakeezx.sync_v2_field_map_before_n03(p_entity) ||
      '{"education_department":"education_department"}'::jsonb
    else rakeezx.sync_v2_field_map_before_n03(p_entity) end;
$$;
revoke all on function rakeezx.sync_v2_field_map(text) from public, anon;
grant execute on function rakeezx.sync_v2_field_map(text) to authenticated;

-- Preserve account routing/provisioning semantics and only extend the
-- owner-derived profile object returned by the current account contract.
alter function rakeezx.account_contract() rename to account_contract_before_n03;
revoke all on function rakeezx.account_contract_before_n03() from public, anon, authenticated;
create function rakeezx.account_contract()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_owner uuid := auth.uid(); v_base jsonb; v_department text;
begin
  if v_owner is null then
    raise exception using errcode='42501', message='Authentication required';
  end if;
  v_base := rakeezx.account_contract_before_n03();
  select education_department into v_department from rakeezx.profile where owner_id=v_owner;
  return pg_catalog.jsonb_set(v_base, '{profile,educationDepartment}',
    coalesce(pg_catalog.to_jsonb(v_department), 'null'::jsonb), true);
end;
$$;
revoke all on function rakeezx.account_contract() from public, anon;
grant execute on function rakeezx.account_contract() to authenticated;

commit;
