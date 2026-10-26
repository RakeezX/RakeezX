-- RESEARCH ONLY — NOT A PRODUCTION MIGRATION.
-- Target: existing RakeezX "rakeezx" schema. Tested solely on ephemeral PGlite.
-- Apply to live Supabase ONLY through a reviewed, authorized migration process.
-- Existing: sections(owner_id,id,year_id), teachings(owner_id,id,section_id).

begin;

-- PostgreSQL requires an exact UNIQUE reference target for composite FKs.
-- Existing owner/id PKs remain unchanged; these are redundant reference indexes.
create unique index if not exists sections_v2_owner_section_year_fk_uq
  on rakeezx.sections (owner_id, id, year_id);
create unique index if not exists teachings_v2_owner_teaching_section_fk_uq
  on rakeezx.teachings (owner_id, id, section_id);

create table if not exists rakeezx.section_curriculum_scopes (
  id text not null,
  owner_id uuid not null default auth.uid(),
  section_id text not null,
  year_id text not null,
  program_key text not null,
  stage_key text not null,
  level_key text not null,
  track_key text,
  edition_key text not null,
  edition_year_verified boolean not null default false,
  source_url text,
  review_status text not null default 'draft'
    check (review_status in ('draft','needs_review','teacher_reviewed')),
  client_updated_at bigint not null,
  device_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (owner_id, id),
  unique (owner_id, section_id, id),
  constraint curriculum_v2_section_year_fk foreign key (owner_id, section_id, year_id)
    references rakeezx.sections (owner_id, id, year_id) on delete cascade,
  constraint curriculum_v2_labels_valid check (
    length(btrim(program_key)) between 1 and 160
    and length(btrim(stage_key)) between 1 and 160
    and length(btrim(level_key)) between 1 and 160
    and length(btrim(edition_key)) between 1 and 160
    and (track_key is null or length(btrim(track_key)) between 1 and 160)
  )
);

-- One CURRENT programme/scope per real cohort. Historical tombstones remain.
create unique index if not exists curriculum_v2_one_active_scope_per_section_uq
  on rakeezx.section_curriculum_scopes (owner_id, section_id)
  where deleted_at is null;
create index if not exists curriculum_v2_scopes_owner_year_idx
  on rakeezx.section_curriculum_scopes (owner_id, year_id);

create table if not exists rakeezx.teaching_course_bindings (
  id text not null,
  owner_id uuid not null default auth.uid(),
  section_id text not null,
  section_scope_id text not null,
  teaching_id text not null,
  subject_id text not null,
  term_id text not null,
  course_source_key text not null,
  course_name text not null,
  course_kind text not null default 'course'
    check (course_kind in ('course','learning_domain','enrichment','national_identity')),
  source_page int check (source_page between 1 and 10000),
  source_url text,
  source_edition text not null,
  edition_year_verified boolean not null default false,
  review_status text not null default 'draft'
    check (review_status in ('draft','needs_review','teacher_reviewed')),
  client_updated_at bigint not null,
  device_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (owner_id, id),
  -- This FK simultaneously checks owner, cohort and selected teaching;
  -- the section_scope_id FK must point to the SAME owner's SAME cohort.
  constraint curriculum_v2_teaching_section_fk foreign key (owner_id, teaching_id, section_id)
    references rakeezx.teachings (owner_id, id, section_id) on delete cascade,
  constraint curriculum_v2_binding_scope_fk foreign key (owner_id, section_id, section_scope_id)
    references rakeezx.section_curriculum_scopes (owner_id, section_id, id) on delete cascade,
  constraint curriculum_v2_course_keys_ck check (
    length(btrim(course_source_key)) between 1 and 350
    and length(btrim(course_name)) between 1 and 240
    and length(btrim(source_edition)) between 1 and 160
  )
);
create unique index if not exists curriculum_v2_one_active_course_per_teaching_uq
  on rakeezx.teaching_course_bindings (owner_id, teaching_id)
  where deleted_at is null;

-- Prevent creating a new active teaching binding to a tombstoned scope.
-- This is SECURITY INVOKER (not DEFINER). It obeys owner RLS.
create or replace function rakeezx.curriculum_v2_assert_active_scope()
returns trigger language plpgsql security invoker set search_path = '' as $function$
begin
  if new.deleted_at is null and not exists (
    select 1 from rakeezx.section_curriculum_scopes s
    where s.owner_id = new.owner_id
      and s.id = new.section_scope_id
      and s.section_id = new.section_id
      and s.deleted_at is null
  ) then
    raise exception 'Active curriculum scope is required' using errcode = '23514';
  end if;
  return new;
end
$function$;
create trigger curriculum_v2_binding_active_scope
  before insert or update on rakeezx.teaching_course_bindings
  for each row execute function rakeezx.curriculum_v2_assert_active_scope();

-- Do not make an existing teaching binding silently orphaned through
-- tombstoning a linked curriculum scope.
create or replace function rakeezx.curriculum_v2_prevent_orphan_scope()
returns trigger language plpgsql security invoker set search_path = '' as $function$
begin
  if old.deleted_at is null and new.deleted_at is not null and exists (
    select 1 from rakeezx.teaching_course_bindings b
    where b.owner_id = new.owner_id and b.section_scope_id = new.id
      and b.deleted_at is null
  ) then
    raise exception 'Active course bindings must be retired first' using errcode = '23514';
  end if;
  return new;
end
$function$;
create trigger curriculum_v2_scope_lifecycle
  before update on rakeezx.section_curriculum_scopes
  for each row execute function rakeezx.curriculum_v2_prevent_orphan_scope();

-- The RLS predicates, not just grants, enforce owner isolation.
alter table rakeezx.section_curriculum_scopes enable row level security;
alter table rakeezx.teaching_course_bindings enable row level security;
create policy curriculum_v2_scopes_select on rakeezx.section_curriculum_scopes
  for select to authenticated using (owner_id = (select auth.uid()));
create policy curriculum_v2_scopes_insert on rakeezx.section_curriculum_scopes
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy curriculum_v2_scopes_update on rakeezx.section_curriculum_scopes
  for update to authenticated using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
create policy curriculum_v2_bindings_select on rakeezx.teaching_course_bindings
  for select to authenticated using (owner_id = (select auth.uid()));
create policy curriculum_v2_bindings_insert on rakeezx.teaching_course_bindings
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy curriculum_v2_bindings_update on rakeezx.teaching_course_bindings
  for update to authenticated using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- No hard DELETE: a tombstone must synchronize across devices.
revoke all on rakeezx.section_curriculum_scopes from public, anon;
revoke all on rakeezx.teaching_course_bindings from public, anon;
grant select,insert,update on rakeezx.section_curriculum_scopes to authenticated;
grant select,insert,update on rakeezx.teaching_course_bindings to authenticated;
grant usage on schema rakeezx to authenticated;
commit;
