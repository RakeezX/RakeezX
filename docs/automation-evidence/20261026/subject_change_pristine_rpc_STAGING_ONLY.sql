-- RAKEEZ Subject Change: STAGING-ONLY SQL DESIGN, NEVER APPLIED.
-- REQUIRES existing owner-scoped RLS, Sync V2 revision trigger and full
-- N71 restore compatibility BEFORE a real user-visible release.
-- Client pending-outbox/lease proof and durable idempotent receipts remain
-- external prerequisites; this function does not grant them.
--
-- This script is NOT placed in supabase/migrations. Apply only to disposable
-- PGlite fixtures; no live Supabase/Production service writes authorized.

begin;
create or replace function rakeezx.research_change_pristine_teaching_subject(
  p_teaching_id text,
  p_target_subject_id text,
  p_expected_revision bigint,
  p_client_updated_at bigint
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $rakeez_subject_research$
declare
  v_owner uuid := auth.uid();
  v_before rakeezx.teachings%rowtype;
  v_after rakeezx.teachings%rowtype;
  v_section rakeezx.sections%rowtype;
  v_term rakeezx.terms%rowtype;
  v_subject rakeezx.subjects%rowtype;
  v_year rakeezx.years%rowtype;
  v_source rakeezx.subjects%rowtype;
  v_store text;
  v_parent text;
  v_exists boolean;
  v_item_count bigint;
  v_exact_defaults bigint;
begin
  if v_owner is null then
    raise exception 'Authenticated owner is required'
      using errcode = '42501';
  end if;
  if p_teaching_id is null or p_target_subject_id is null or
     p_expected_revision is null or p_expected_revision < 1 or
     p_client_updated_at is null or p_client_updated_at < 1 then
    raise exception 'Invalid subject-change arguments'
      using errcode = '22023';
  end if;
  if p_teaching_id !~* '^tch:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    raise exception 'Legacy teaching identity cannot be reinterpreted'
      using errcode = '23514';
  end if;

  select * into v_before from rakeezx.teachings
   where owner_id = v_owner and id = p_teaching_id and deleted_at is null
   for update;
  if v_before.id is null then
    raise exception 'Teaching unavailable to this owner'
      using errcode = '42501';
  end if;
  if v_before.revision <> p_expected_revision then
    raise exception 'Teaching revision changed'
      using errcode = '40001';
  end if;
  if v_before.subject_id = p_target_subject_id then
    return pg_catalog.jsonb_build_object('protocol','RESEARCH_PRISTINE_SUBJECT_V1',
      'status','unchanged','teachingId',v_before.id,
      'revision',v_before.revision);
  end if;
  if v_before.client_updated_at is not null and
     p_client_updated_at <= v_before.client_updated_at then
    raise exception 'Client timestamp must advance'
      using errcode = '40001';
  end if;

  select * into v_section from rakeezx.sections
    where owner_id = v_owner and id = v_before.section_id and deleted_at is null;
  select * into v_term from rakeezx.terms
    where owner_id = v_owner and id = v_before.term_id and deleted_at is null;
  select * into v_year from rakeezx.years
    where owner_id = v_owner and id = v_section.year_id and deleted_at is null;
  select * into v_subject from rakeezx.subjects
    where owner_id = v_owner and id = p_target_subject_id and deleted_at is null;
  select * into v_source from rakeezx.subjects
    where owner_id = v_owner and id = v_before.subject_id and deleted_at is null;
  if v_section.id is null or v_term.id is null or v_year.id is null or
     v_source.id is null or v_subject.id is null or
     v_term.year_id <> v_section.year_id or
     v_section.status <> 'active' or v_term.status <> 'active' or
     v_year.status <> 'active' then
    raise exception 'Academic target is not an editable owned scope'
      using errcode = '42501';
  end if;
  -- Including deleted rows: do not steal or revive another generation.
  if exists (select 1 from rakeezx.teachings t
      where t.owner_id = v_owner and t.id <> v_before.id and
      t.section_id = v_before.section_id and t.term_id = v_before.term_id and
      t.subject_id = p_target_subject_id) then
    raise exception 'Target subject identity already exists'
      using errcode = '23505';
  end if;

  -- Hard fail when any domain required for history protection is absent.
  -- Unknown/deferred schema must be reconciled BEFORE activation.
  foreach v_store in array array[
    'score_subitems','scores','slots','sessions','session_roster_snapshots',
    'attendance','logs','notes','class_rules','class_goals',
    'class_charter_selections','group_arrangements','assignments',
    'submissions','closed_term_reports','teaching_course_bindings',
    'section_curriculum_scopes'
  ] loop
    if pg_catalog.to_regclass('rakeezx.' || v_store) is null then
      raise exception 'History domain not installed: %', v_store
        using errcode = '0A000';
    end if;
  end loop;

  -- All five default items must be exact and unmodified. Any tombstones
  -- or custom distribution/lesson pointers require a manual review.
  select pg_catalog.count(*),
    pg_catalog.count(*) filter (where deleted_at is null and
      unit_id is null and lesson_id is null and
      per_point=1 and penalty=1 and
      coalesce(score_mode,'direct')='direct' and
      distribution_mode is null and distribution_origin_id is null and
      portability_group_id is null and distribution_version=1 and (
        ("order"=0 and name='المشاركة والتفاعل' and max=10 and auto='participation') or
        ("order"=1 and name='الواجبات' and max=10 and auto is null) or
        ("order"=2 and name='الأنشطة والمشاريع' and max=20 and auto is null) or
        ("order"=3 and name='الاختبارات القصيرة' and max=20 and auto is null) or
        ("order"=4 and name='الاختبار النهائي' and max=40 and auto is null)
      ))
    into v_item_count,v_exact_defaults
  from rakeezx.items
  where owner_id=v_owner and teaching_id=v_before.id;
  if v_item_count <> 5 or v_exact_defaults <> 5 then
    raise exception 'Teaching score distribution is not pristine'
      using errcode = '23514';
  end if;

  -- Preserve ALL grade/subitem history, even tombstoned rows.
  if exists (select 1 from rakeezx.scores s
      join rakeezx.items i on i.owner_id=s.owner_id and i.id=s.item_id
      where s.owner_id=v_owner and i.teaching_id=v_before.id)
     or exists (select 1 from rakeezx.score_subitems si
      join rakeezx.items i on i.owner_id=si.owner_id and i.id=si.item_id
      where si.owner_id=v_owner and i.teaching_id=v_before.id) then
    raise exception 'Recorded grades or subitems require a separate review'
      using errcode = '23514';
  end if;

  -- Direct teaching history: any old row, including a tombstone, blocks.
  foreach v_store in array array[
    'slots','sessions','session_roster_snapshots','attendance','logs',
    'notes','class_rules','class_goals','class_charter_selections',
    'group_arrangements','assignments','teaching_course_bindings'
  ] loop
    execute pg_catalog.format(
      'select exists(select 1 from rakeezx.%I where owner_id=$1 and teaching_id=$2)',
      v_store) into v_exists using v_owner,v_before.id;
    if v_exists then
      raise exception 'Teaching has historical dependent records: %',v_store
        using errcode = '23514';
    end if;
  end loop;
  if exists (select 1 from rakeezx.section_curriculum_scopes s
      where s.owner_id=v_owner and s.section_id=v_before.section_id)
      or exists (select 1 from rakeezx.closed_term_reports r
      where r.owner_id=v_owner and r.term_id=v_before.term_id) then
    raise exception 'Curriculum scope or closed report requires reviewed transition'
      using errcode = '23514';
  end if;
  -- No row in assignments means no child submissions can legitimately
  -- belong here; incomplete/orphaned server data is a separate restore gate.

  -- The existing authoritative Sync V2 BEFORE UPDATE trigger stamps the
  -- revision. Never trust client-supplied revision or a local green status.
  update rakeezx.teachings t
     set subject_id=p_target_subject_id,
         client_updated_at=p_client_updated_at
   where t.owner_id=v_owner and t.id=v_before.id and
         t.revision=p_expected_revision and t.deleted_at is null
   returning * into v_after;
  if v_after.id is null or v_after.revision <> v_before.revision + 1 then
    raise exception 'Server revision receipt not exact'
      using errcode = '40001';
  end if;
  return pg_catalog.jsonb_build_object(
    'protocol','RESEARCH_PRISTINE_SUBJECT_V1',
    'status','changed', 'ownerId',v_owner,
    'teachingId',v_after.id,'sectionId',v_after.section_id,
    'termId',v_after.term_id,
    'previousSubjectId',v_before.subject_id,
    'subjectId',v_after.subject_id,
    'baseRevision',v_before.revision,
    'clientUpdatedAt',v_after.client_updated_at,
    'revision',v_after.revision);
end;
$rakeez_subject_research$;

revoke all on function rakeezx.research_change_pristine_teaching_subject(
  text,text,bigint,bigint) from public,anon;
grant execute on function rakeezx.research_change_pristine_teaching_subject(
  text,text,bigint,bigint) to authenticated;
commit;
