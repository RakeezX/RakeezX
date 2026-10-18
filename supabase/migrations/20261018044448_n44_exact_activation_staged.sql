-- AI-authored staged candidate. CLI v2.117.0 migration new, 2026-10-18. NEVER APPLIED.
-- Exact project xlrubcwjqktzzunrvuns; requires separate hosted approval and passing full preflight.
-- Fresh-only; no credentials, contexts, source rows, route, cron or Auth settings.
begin;
set local lock_timeout='1s';
set local statement_timeout='15s';
select pg_advisory_xact_lock(4400182026);
do $n44$ begin
if exists(select 1 from pg_namespace where nspname='n44_push_draft') or exists(select 1 from pg_roles where rolname in ('n44_guard','n44_backend')) then raise exception 'N44 collision: never reapply/adopt existing private objects'; end if;
if to_regclass('supabase_migrations.schema_migrations') is not null then
  if exists(select 1 from supabase_migrations.schema_migrations where version='20261018044448') then raise exception 'N44 migration history collision'; end if;
end if;
if not exists(select 1 from information_schema.columns where table_schema='auth' and table_name='sessions' and column_name='id' and udt_name='uuid' and is_nullable='NO') then raise exception 'N44 column mismatch: auth.sessions.id'; end if;
if not exists(select 1 from information_schema.columns where table_schema='auth' and table_name='sessions' and column_name='user_id' and udt_name='uuid' and is_nullable='NO') then raise exception 'N44 column mismatch: auth.sessions.user_id'; end if;
if not exists(select 1 from information_schema.columns where table_schema='auth' and table_name='sessions' and column_name='not_after' and udt_name='timestamptz' and is_nullable='YES') then raise exception 'N44 column mismatch: auth.sessions.not_after'; end if;
if not exists(select 1 from information_schema.columns where table_schema='auth' and table_name='users' and column_name='id' and udt_name='uuid' and is_nullable='NO') then raise exception 'N44 column mismatch: auth.users.id'; end if;
if not exists(select 1 from information_schema.columns where table_schema='auth' and table_name='users' and column_name='banned_until' and udt_name='timestamptz' and is_nullable='YES') then raise exception 'N44 column mismatch: auth.users.banned_until'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='calendar_days' and column_name='id' and udt_name='text' and is_nullable='NO') then raise exception 'N44 column mismatch: rakeezx.calendar_days.id'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='calendar_days' and column_name='owner_id' and udt_name='uuid' and is_nullable='NO') then raise exception 'N44 column mismatch: rakeezx.calendar_days.owner_id'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='calendar_days' and column_name='calendar_id' and udt_name='text' and is_nullable='NO') then raise exception 'N44 column mismatch: rakeezx.calendar_days.calendar_id'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='calendar_days' and column_name='date' and udt_name='date' and is_nullable='NO') then raise exception 'N44 column mismatch: rakeezx.calendar_days.date'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='calendar_days' and column_name='kind' and udt_name='text' and is_nullable='NO') then raise exception 'N44 column mismatch: rakeezx.calendar_days.kind'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='calendar_days' and column_name='deleted_at' and udt_name='timestamptz' and is_nullable='YES') then raise exception 'N44 column mismatch: rakeezx.calendar_days.deleted_at'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='calendar_days' and column_name='revision' and udt_name='int8' and is_nullable='NO') then raise exception 'N44 column mismatch: rakeezx.calendar_days.revision'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='calendars' and column_name='id' and udt_name='text' and is_nullable='NO') then raise exception 'N44 column mismatch: rakeezx.calendars.id'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='calendars' and column_name='owner_id' and udt_name='uuid' and is_nullable='NO') then raise exception 'N44 column mismatch: rakeezx.calendars.owner_id'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='calendars' and column_name='year_id' and udt_name='text' and is_nullable='NO') then raise exception 'N44 column mismatch: rakeezx.calendars.year_id'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='calendars' and column_name='source' and udt_name='text' and is_nullable='NO') then raise exception 'N44 column mismatch: rakeezx.calendars.source'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='calendars' and column_name='deleted_at' and udt_name='timestamptz' and is_nullable='YES') then raise exception 'N44 column mismatch: rakeezx.calendars.deleted_at'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='calendars' and column_name='revision' and udt_name='int8' and is_nullable='NO') then raise exception 'N44 column mismatch: rakeezx.calendars.revision'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='calendars' and column_name='preset_id' and udt_name='text' and is_nullable='YES') then raise exception 'N44 column mismatch: rakeezx.calendars.preset_id'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='calendars' and column_name='term_date_overrides' and udt_name='jsonb' and is_nullable='NO') then raise exception 'N44 column mismatch: rakeezx.calendars.term_date_overrides'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='items' and column_name='id' and udt_name='text' and is_nullable='NO') then raise exception 'N44 column mismatch: rakeezx.items.id'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='items' and column_name='owner_id' and udt_name='uuid' and is_nullable='NO') then raise exception 'N44 column mismatch: rakeezx.items.owner_id'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='items' and column_name='teaching_id' and udt_name='text' and is_nullable='NO') then raise exception 'N44 column mismatch: rakeezx.items.teaching_id'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='items' and column_name='deleted_at' and udt_name='timestamptz' and is_nullable='YES') then raise exception 'N44 column mismatch: rakeezx.items.deleted_at'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='items' and column_name='revision' and udt_name='int8' and is_nullable='NO') then raise exception 'N44 column mismatch: rakeezx.items.revision'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='items' and column_name='score_mode' and udt_name='text' and is_nullable='NO') then raise exception 'N44 column mismatch: rakeezx.items.score_mode'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='score_subitems' and column_name='id' and udt_name='text' and is_nullable='NO') then raise exception 'N44 column mismatch: rakeezx.score_subitems.id'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='score_subitems' and column_name='owner_id' and udt_name='uuid' and is_nullable='NO') then raise exception 'N44 column mismatch: rakeezx.score_subitems.owner_id'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='score_subitems' and column_name='item_id' and udt_name='text' and is_nullable='NO') then raise exception 'N44 column mismatch: rakeezx.score_subitems.item_id'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='score_subitems' and column_name='deleted_at' and udt_name='timestamptz' and is_nullable='YES') then raise exception 'N44 column mismatch: rakeezx.score_subitems.deleted_at'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='score_subitems' and column_name='revision' and udt_name='int8' and is_nullable='NO') then raise exception 'N44 column mismatch: rakeezx.score_subitems.revision'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='score_subitems' and column_name='start_date' and udt_name='date' and is_nullable='YES') then raise exception 'N44 column mismatch: rakeezx.score_subitems.start_date'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='score_subitems' and column_name='due_date' and udt_name='date' and is_nullable='YES') then raise exception 'N44 column mismatch: rakeezx.score_subitems.due_date'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='sections' and column_name='id' and udt_name='text' and is_nullable='NO') then raise exception 'N44 column mismatch: rakeezx.sections.id'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='sections' and column_name='owner_id' and udt_name='uuid' and is_nullable='NO') then raise exception 'N44 column mismatch: rakeezx.sections.owner_id'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='sections' and column_name='year_id' and udt_name='text' and is_nullable='NO') then raise exception 'N44 column mismatch: rakeezx.sections.year_id'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='sections' and column_name='deleted_at' and udt_name='timestamptz' and is_nullable='YES') then raise exception 'N44 column mismatch: rakeezx.sections.deleted_at'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='sections' and column_name='revision' and udt_name='int8' and is_nullable='NO') then raise exception 'N44 column mismatch: rakeezx.sections.revision'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='sections' and column_name='status' and udt_name='text' and is_nullable='NO') then raise exception 'N44 column mismatch: rakeezx.sections.status'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='sessions' and column_name='id' and udt_name='text' and is_nullable='NO') then raise exception 'N44 column mismatch: rakeezx.sessions.id'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='sessions' and column_name='owner_id' and udt_name='uuid' and is_nullable='NO') then raise exception 'N44 column mismatch: rakeezx.sessions.owner_id'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='sessions' and column_name='teaching_id' and udt_name='text' and is_nullable='NO') then raise exception 'N44 column mismatch: rakeezx.sessions.teaching_id'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='sessions' and column_name='date' and udt_name='date' and is_nullable='NO') then raise exception 'N44 column mismatch: rakeezx.sessions.date'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='sessions' and column_name='start_time' and udt_name='time' and is_nullable='YES') then raise exception 'N44 column mismatch: rakeezx.sessions.start_time'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='sessions' and column_name='end_time' and udt_name='time' and is_nullable='YES') then raise exception 'N44 column mismatch: rakeezx.sessions.end_time'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='sessions' and column_name='status' and udt_name='text' and is_nullable='NO') then raise exception 'N44 column mismatch: rakeezx.sessions.status'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='sessions' and column_name='deleted_at' and udt_name='timestamptz' and is_nullable='YES') then raise exception 'N44 column mismatch: rakeezx.sessions.deleted_at'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='sessions' and column_name='revision' and udt_name='int8' and is_nullable='NO') then raise exception 'N44 column mismatch: rakeezx.sessions.revision'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='subjects' and column_name='id' and udt_name='text' and is_nullable='NO') then raise exception 'N44 column mismatch: rakeezx.subjects.id'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='subjects' and column_name='owner_id' and udt_name='uuid' and is_nullable='NO') then raise exception 'N44 column mismatch: rakeezx.subjects.owner_id'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='subjects' and column_name='deleted_at' and udt_name='timestamptz' and is_nullable='YES') then raise exception 'N44 column mismatch: rakeezx.subjects.deleted_at'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='subjects' and column_name='revision' and udt_name='int8' and is_nullable='NO') then raise exception 'N44 column mismatch: rakeezx.subjects.revision'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='teachings' and column_name='id' and udt_name='text' and is_nullable='NO') then raise exception 'N44 column mismatch: rakeezx.teachings.id'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='teachings' and column_name='owner_id' and udt_name='uuid' and is_nullable='NO') then raise exception 'N44 column mismatch: rakeezx.teachings.owner_id'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='teachings' and column_name='section_id' and udt_name='text' and is_nullable='NO') then raise exception 'N44 column mismatch: rakeezx.teachings.section_id'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='teachings' and column_name='subject_id' and udt_name='text' and is_nullable='NO') then raise exception 'N44 column mismatch: rakeezx.teachings.subject_id'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='teachings' and column_name='term_id' and udt_name='text' and is_nullable='NO') then raise exception 'N44 column mismatch: rakeezx.teachings.term_id'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='teachings' and column_name='deleted_at' and udt_name='timestamptz' and is_nullable='YES') then raise exception 'N44 column mismatch: rakeezx.teachings.deleted_at'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='teachings' and column_name='revision' and udt_name='int8' and is_nullable='NO') then raise exception 'N44 column mismatch: rakeezx.teachings.revision'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='terms' and column_name='id' and udt_name='text' and is_nullable='NO') then raise exception 'N44 column mismatch: rakeezx.terms.id'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='terms' and column_name='owner_id' and udt_name='uuid' and is_nullable='NO') then raise exception 'N44 column mismatch: rakeezx.terms.owner_id'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='terms' and column_name='year_id' and udt_name='text' and is_nullable='NO') then raise exception 'N44 column mismatch: rakeezx.terms.year_id'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='terms' and column_name='index' and udt_name='int4' and is_nullable='NO') then raise exception 'N44 column mismatch: rakeezx.terms.index'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='terms' and column_name='start_date' and udt_name='date' and is_nullable='YES') then raise exception 'N44 column mismatch: rakeezx.terms.start_date'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='terms' and column_name='end_date' and udt_name='date' and is_nullable='YES') then raise exception 'N44 column mismatch: rakeezx.terms.end_date'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='terms' and column_name='status' and udt_name='text' and is_nullable='NO') then raise exception 'N44 column mismatch: rakeezx.terms.status'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='terms' and column_name='deleted_at' and udt_name='timestamptz' and is_nullable='YES') then raise exception 'N44 column mismatch: rakeezx.terms.deleted_at'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='terms' and column_name='revision' and udt_name='int8' and is_nullable='NO') then raise exception 'N44 column mismatch: rakeezx.terms.revision'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='years' and column_name='id' and udt_name='text' and is_nullable='NO') then raise exception 'N44 column mismatch: rakeezx.years.id'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='years' and column_name='owner_id' and udt_name='uuid' and is_nullable='NO') then raise exception 'N44 column mismatch: rakeezx.years.owner_id'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='years' and column_name='hijri_start' and udt_name='int4' and is_nullable='NO') then raise exception 'N44 column mismatch: rakeezx.years.hijri_start'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='years' and column_name='hijri_end' and udt_name='int4' and is_nullable='NO') then raise exception 'N44 column mismatch: rakeezx.years.hijri_end'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='years' and column_name='status' and udt_name='text' and is_nullable='NO') then raise exception 'N44 column mismatch: rakeezx.years.status'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='years' and column_name='deleted_at' and udt_name='timestamptz' and is_nullable='YES') then raise exception 'N44 column mismatch: rakeezx.years.deleted_at'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='years' and column_name='revision' and udt_name='int8' and is_nullable='NO') then raise exception 'N44 column mismatch: rakeezx.years.revision'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='years' and column_name='calendar_preset_id' and udt_name='text' and is_nullable='YES') then raise exception 'N44 column mismatch: rakeezx.years.calendar_preset_id'; end if;
if not exists(select 1 from pg_constraint where conrelid='rakeezx.calendar_days'::regclass and conname='calendar_days_owner_id_calendar_id_fkey' and convalidated and not condeferrable and pg_get_constraintdef(oid)='FOREIGN KEY (owner_id, calendar_id) REFERENCES rakeezx.calendars(owner_id, id) ON DELETE CASCADE') then raise exception 'N44 constraint mismatch: calendar_days_owner_id_calendar_id_fkey'; end if;
if not exists(select 1 from pg_constraint where conrelid='rakeezx.calendar_days'::regclass and conname='calendar_days_owner_id_fkey' and convalidated and not condeferrable and pg_get_constraintdef(oid)='FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE') then raise exception 'N44 constraint mismatch: calendar_days_owner_id_fkey'; end if;
if not exists(select 1 from pg_constraint where conrelid='rakeezx.calendar_days'::regclass and conname='calendar_days_pkey' and convalidated and not condeferrable and pg_get_constraintdef(oid)='PRIMARY KEY (owner_id, id)') then raise exception 'N44 constraint mismatch: calendar_days_pkey'; end if;
if not exists(select 1 from pg_constraint where conrelid='rakeezx.calendars'::regclass and conname='calendars_owner_id_fkey' and convalidated and not condeferrable and pg_get_constraintdef(oid)='FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE') then raise exception 'N44 constraint mismatch: calendars_owner_id_fkey'; end if;
if not exists(select 1 from pg_constraint where conrelid='rakeezx.calendars'::regclass and conname='calendars_owner_id_year_id_fkey' and convalidated and not condeferrable and pg_get_constraintdef(oid)='FOREIGN KEY (owner_id, year_id) REFERENCES rakeezx.years(owner_id, id) ON DELETE CASCADE') then raise exception 'N44 constraint mismatch: calendars_owner_id_year_id_fkey'; end if;
if not exists(select 1 from pg_constraint where conrelid='rakeezx.calendars'::regclass and conname='calendars_pkey' and convalidated and not condeferrable and pg_get_constraintdef(oid)='PRIMARY KEY (owner_id, id)') then raise exception 'N44 constraint mismatch: calendars_pkey'; end if;
if not exists(select 1 from pg_constraint where conrelid='rakeezx.items'::regclass and conname='items_owner_id_fkey' and convalidated and not condeferrable and pg_get_constraintdef(oid)='FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE') then raise exception 'N44 constraint mismatch: items_owner_id_fkey'; end if;
if not exists(select 1 from pg_constraint where conrelid='rakeezx.items'::regclass and conname='items_owner_id_teaching_id_fkey' and convalidated and not condeferrable and pg_get_constraintdef(oid)='FOREIGN KEY (owner_id, teaching_id) REFERENCES rakeezx.teachings(owner_id, id) ON DELETE CASCADE') then raise exception 'N44 constraint mismatch: items_owner_id_teaching_id_fkey'; end if;
if not exists(select 1 from pg_constraint where conrelid='rakeezx.items'::regclass and conname='items_pkey' and convalidated and not condeferrable and pg_get_constraintdef(oid)='PRIMARY KEY (owner_id, id)') then raise exception 'N44 constraint mismatch: items_pkey'; end if;
if not exists(select 1 from pg_constraint where conrelid='rakeezx.score_subitems'::regclass and conname='score_subitems_owner_id_fkey' and convalidated and not condeferrable and pg_get_constraintdef(oid)='FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE') then raise exception 'N44 constraint mismatch: score_subitems_owner_id_fkey'; end if;
if not exists(select 1 from pg_constraint where conrelid='rakeezx.score_subitems'::regclass and conname='score_subitems_owner_id_item_id_fkey' and convalidated and not condeferrable and pg_get_constraintdef(oid)='FOREIGN KEY (owner_id, item_id) REFERENCES rakeezx.items(owner_id, id) ON DELETE CASCADE') then raise exception 'N44 constraint mismatch: score_subitems_owner_id_item_id_fkey'; end if;
if not exists(select 1 from pg_constraint where conrelid='rakeezx.score_subitems'::regclass and conname='score_subitems_pkey' and convalidated and not condeferrable and pg_get_constraintdef(oid)='PRIMARY KEY (owner_id, id)') then raise exception 'N44 constraint mismatch: score_subitems_pkey'; end if;
if not exists(select 1 from pg_constraint where conrelid='rakeezx.sections'::regclass and conname='sections_owner_id_fkey' and convalidated and not condeferrable and pg_get_constraintdef(oid)='FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE') then raise exception 'N44 constraint mismatch: sections_owner_id_fkey'; end if;
if not exists(select 1 from pg_constraint where conrelid='rakeezx.sections'::regclass and conname='sections_owner_id_year_id_fkey' and convalidated and not condeferrable and pg_get_constraintdef(oid)='FOREIGN KEY (owner_id, year_id) REFERENCES rakeezx.years(owner_id, id) ON DELETE CASCADE') then raise exception 'N44 constraint mismatch: sections_owner_id_year_id_fkey'; end if;
if not exists(select 1 from pg_constraint where conrelid='rakeezx.sections'::regclass and conname='sections_pkey' and convalidated and not condeferrable and pg_get_constraintdef(oid)='PRIMARY KEY (owner_id, id)') then raise exception 'N44 constraint mismatch: sections_pkey'; end if;
if not exists(select 1 from pg_constraint where conrelid='rakeezx.sessions'::regclass and conname='sessions_owner_id_fkey' and convalidated and not condeferrable and pg_get_constraintdef(oid)='FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE') then raise exception 'N44 constraint mismatch: sessions_owner_id_fkey'; end if;
if not exists(select 1 from pg_constraint where conrelid='rakeezx.sessions'::regclass and conname='sessions_owner_id_teaching_id_fkey' and convalidated and not condeferrable and pg_get_constraintdef(oid)='FOREIGN KEY (owner_id, teaching_id) REFERENCES rakeezx.teachings(owner_id, id) ON DELETE CASCADE') then raise exception 'N44 constraint mismatch: sessions_owner_id_teaching_id_fkey'; end if;
if not exists(select 1 from pg_constraint where conrelid='rakeezx.sessions'::regclass and conname='sessions_pkey' and convalidated and not condeferrable and pg_get_constraintdef(oid)='PRIMARY KEY (owner_id, id)') then raise exception 'N44 constraint mismatch: sessions_pkey'; end if;
if not exists(select 1 from pg_constraint where conrelid='rakeezx.subjects'::regclass and conname='subjects_owner_id_fkey' and convalidated and not condeferrable and pg_get_constraintdef(oid)='FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE') then raise exception 'N44 constraint mismatch: subjects_owner_id_fkey'; end if;
if not exists(select 1 from pg_constraint where conrelid='rakeezx.subjects'::regclass and conname='subjects_pkey' and convalidated and not condeferrable and pg_get_constraintdef(oid)='PRIMARY KEY (owner_id, id)') then raise exception 'N44 constraint mismatch: subjects_pkey'; end if;
if not exists(select 1 from pg_constraint where conrelid='rakeezx.teachings'::regclass and conname='teachings_owner_id_fkey' and convalidated and not condeferrable and pg_get_constraintdef(oid)='FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE') then raise exception 'N44 constraint mismatch: teachings_owner_id_fkey'; end if;
if not exists(select 1 from pg_constraint where conrelid='rakeezx.teachings'::regclass and conname='teachings_owner_id_section_id_fkey' and convalidated and not condeferrable and pg_get_constraintdef(oid)='FOREIGN KEY (owner_id, section_id) REFERENCES rakeezx.sections(owner_id, id) ON DELETE CASCADE') then raise exception 'N44 constraint mismatch: teachings_owner_id_section_id_fkey'; end if;
if not exists(select 1 from pg_constraint where conrelid='rakeezx.teachings'::regclass and conname='teachings_owner_id_subject_id_fkey' and convalidated and not condeferrable and pg_get_constraintdef(oid)='FOREIGN KEY (owner_id, subject_id) REFERENCES rakeezx.subjects(owner_id, id) ON DELETE CASCADE') then raise exception 'N44 constraint mismatch: teachings_owner_id_subject_id_fkey'; end if;
if not exists(select 1 from pg_constraint where conrelid='rakeezx.teachings'::regclass and conname='teachings_owner_id_term_id_fkey' and convalidated and not condeferrable and pg_get_constraintdef(oid)='FOREIGN KEY (owner_id, term_id) REFERENCES rakeezx.terms(owner_id, id) ON DELETE CASCADE') then raise exception 'N44 constraint mismatch: teachings_owner_id_term_id_fkey'; end if;
if not exists(select 1 from pg_constraint where conrelid='rakeezx.teachings'::regclass and conname='teachings_pkey' and convalidated and not condeferrable and pg_get_constraintdef(oid)='PRIMARY KEY (owner_id, id)') then raise exception 'N44 constraint mismatch: teachings_pkey'; end if;
if not exists(select 1 from pg_constraint where conrelid='rakeezx.terms'::regclass and conname='terms_owner_id_fkey' and convalidated and not condeferrable and pg_get_constraintdef(oid)='FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE') then raise exception 'N44 constraint mismatch: terms_owner_id_fkey'; end if;
if not exists(select 1 from pg_constraint where conrelid='rakeezx.terms'::regclass and conname='terms_owner_id_year_id_fkey' and convalidated and not condeferrable and pg_get_constraintdef(oid)='FOREIGN KEY (owner_id, year_id) REFERENCES rakeezx.years(owner_id, id) ON DELETE CASCADE') then raise exception 'N44 constraint mismatch: terms_owner_id_year_id_fkey'; end if;
if not exists(select 1 from pg_constraint where conrelid='rakeezx.terms'::regclass and conname='terms_pkey' and convalidated and not condeferrable and pg_get_constraintdef(oid)='PRIMARY KEY (owner_id, id)') then raise exception 'N44 constraint mismatch: terms_pkey'; end if;
if not exists(select 1 from pg_constraint where conrelid='rakeezx.years'::regclass and conname='years_owner_id_fkey' and convalidated and not condeferrable and pg_get_constraintdef(oid)='FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE') then raise exception 'N44 constraint mismatch: years_owner_id_fkey'; end if;
if not exists(select 1 from pg_constraint where conrelid='rakeezx.years'::regclass and conname='years_pkey' and convalidated and not condeferrable and pg_get_constraintdef(oid)='PRIMARY KEY (owner_id, id)') then raise exception 'N44 constraint mismatch: years_pkey'; end if;
if not exists(select 1 from pg_class where oid='rakeezx.sessions'::regclass and relrowsecurity and relforcerowsecurity) then raise exception 'N44 forced RLS mismatch: sessions'; end if;
if not exists(select 1 from pg_class where oid='rakeezx.score_subitems'::regclass and relrowsecurity and relforcerowsecurity) then raise exception 'N44 forced RLS mismatch: score_subitems'; end if;
if not exists(select 1 from pg_class where oid='rakeezx.items'::regclass and relrowsecurity and relforcerowsecurity) then raise exception 'N44 forced RLS mismatch: items'; end if;
if not exists(select 1 from pg_class where oid='rakeezx.years'::regclass and relrowsecurity and relforcerowsecurity) then raise exception 'N44 forced RLS mismatch: years'; end if;
if not exists(select 1 from pg_class where oid='rakeezx.sections'::regclass and relrowsecurity and relforcerowsecurity) then raise exception 'N44 forced RLS mismatch: sections'; end if;
if not exists(select 1 from pg_class where oid='rakeezx.subjects'::regclass and relrowsecurity and relforcerowsecurity) then raise exception 'N44 forced RLS mismatch: subjects'; end if;
if not exists(select 1 from pg_class where oid='rakeezx.calendars'::regclass and relrowsecurity and relforcerowsecurity) then raise exception 'N44 forced RLS mismatch: calendars'; end if;
if not exists(select 1 from pg_class where oid='rakeezx.calendar_days'::regclass and relrowsecurity and relforcerowsecurity) then raise exception 'N44 forced RLS mismatch: calendar_days'; end if;
if not exists(select 1 from pg_class where oid='rakeezx.terms'::regclass and relrowsecurity and relforcerowsecurity) then raise exception 'N44 forced RLS mismatch: terms'; end if;
if not exists(select 1 from pg_class where oid='rakeezx.teachings'::regclass and relrowsecurity and relforcerowsecurity) then raise exception 'N44 forced RLS mismatch: teachings'; end if;
if not has_column_privilege('postgres','auth.users','id','REFERENCES') then raise exception 'N44 existing management Auth REFERENCES prerequisite not verified; do not widen privileges automatically'; end if;
if not exists(select 1 from pg_constraint where conrelid='auth.users'::regclass and contype='p' and pg_get_constraintdef(oid)='PRIMARY KEY (id)' and convalidated and not condeferrable) then raise exception 'N44 Auth user PK prerequisite'; end if;
if not exists(select 1 from pg_constraint where conrelid='auth.sessions'::regclass and contype='p' and pg_get_constraintdef(oid)='PRIMARY KEY (id)' and convalidated and not condeferrable) then raise exception 'N44 Auth session PK prerequisite'; end if;
if not exists(select 1 from pg_constraint where conrelid='auth.sessions'::regclass and contype='f' and confrelid='auth.users'::regclass and pg_get_constraintdef(oid)='FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE' and convalidated and not condeferrable) then raise exception 'N44 Auth session FK prerequisite'; end if;
if (select count(*) from pg_class where oid in ('auth.users'::regclass,'auth.sessions'::regclass) and relrowsecurity and not relforcerowsecurity and relowner::regrole::text='supabase_auth_admin')<>2 then raise exception 'N44 managed Auth owner/RLS mismatch'; end if;
if exists(select 1 from pg_policies where schemaname='auth' and tablename in ('users','sessions')) then raise exception 'N44 managed Auth policy mismatch'; end if;
if current_user<>'postgres' or not exists(select 1 from pg_roles where rolname=current_user and rolbypassrls and not rolsuper and rolcreaterole) or pg_has_role('postgres','supabase_auth_admin','MEMBER') or has_schema_privilege('postgres','auth','CREATE') then raise exception 'N44 existing management capability mismatch'; end if;
if not has_column_privilege('postgres','auth.users','id','SELECT') or not has_column_privilege('postgres','auth.users','banned_until','SELECT') or not has_column_privilege('postgres','auth.users','id','UPDATE') or not has_column_privilege('postgres','auth.sessions','id','SELECT') or not has_column_privilege('postgres','auth.sessions','user_id','SELECT') or not has_column_privilege('postgres','auth.sessions','not_after','SELECT') or not has_column_privilege('postgres','auth.sessions','id','UPDATE') then raise exception 'N44 existing management exact Auth lock privileges unavailable'; end if;
end $n44$;
create role n44_backend nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
create role n44_guard nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;

-- Reviewed SQL composition; staged migration only, never applied hosted.
-- Requires separately approved actual schema mapping/roles and runtime RLS tests.
-- No exposed schema, user grants, service-role role, extension or hosted operation.

create schema n44_push_draft;
revoke all on schema n44_push_draft from public, anon, authenticated;
alter default privileges in schema n44_push_draft revoke execute on functions from public;

-- Lock this row FOR UPDATE before all owner-scoped context/registration/job/budget
-- operations, including logout and preference updates. Use one short transaction,
-- bounded statement/lock timeout, and retry serialization failures before sending.
create table n44_push_draft.owner_clock (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  high_water_ms bigint not null check (high_water_ms >= 0)
);
create table n44_push_draft.contexts (
  owner_id uuid not null references auth.users(id) on delete cascade,
  workspace_id text not null check (length(workspace_id) between 1 and 180),
  device_id text not null check (length(device_id) between 1 and 180),
  active boolean not null default false,
  session_id text not null check (length(session_id) between 1 and 180),
  session_revision text not null check (length(session_revision) between 1 and 180),
  session_expires_at_ms bigint not null,
  consent_revision text not null check (length(consent_revision) between 1 and 180),
  push_consent boolean not null default false,
  -- Authoritative, versioned server preference mapping still missing. No client
  -- permission to assert these context or session bindings, even for its own row.
  preferences jsonb not null check (jsonb_typeof(preferences) = 'object' and octet_length(preferences::text) <= 2048),
  primary key (owner_id, workspace_id, device_id)
);
create table n44_push_draft.registrations (
  owner_id uuid not null references auth.users(id) on delete cascade,
  registration_id uuid not null,
  workspace_id text not null,
  device_id text not null,
  session_id text not null,
  session_revision text not null,
  consent_revision text not null,
  state text not null check (state in ('active', 'revoked', 'dead')),
  expires_at_ms bigint not null check (expires_at_ms >= 0),
  -- Authenticated encryption envelope incl key version; encryption key external
  -- to this DB. Endpoint + p256dh + auth never stored as plaintext or query logs.
  sealed text check (octet_length(sealed) between 1 and 8192),
  fingerprint text check (fingerprint ~ '^[a-f0-9]{64}$'),
  binding_fingerprint text check (binding_fingerprint ~ '^[a-f0-9]{64}$'),
  primary key (owner_id, registration_id),
  foreign key (owner_id, workspace_id, device_id)
    references n44_push_draft.contexts(owner_id, workspace_id, device_id),
  check ((state = 'active' and sealed is not null and fingerprint is not null and binding_fingerprint is not null)
    or (state <> 'active' and sealed is null and fingerprint is null and binding_fingerprint is null))
);
create unique index one_active_context on n44_push_draft.registrations(owner_id, workspace_id, device_id) where state = 'active';
create index registration_expiry on n44_push_draft.registrations(owner_id, expires_at_ms);
-- Global HMAC uniqueness prevents cross-owner reuse. Releasing a claim must
-- match BOTH owner and original registration; never enumerate foreign claims.
create table n44_push_draft.endpoint_claims (
  fingerprint text primary key check (fingerprint ~ '^[a-f0-9]{64}$'),
  owner_id uuid not null,
  registration_id uuid not null,
  unique (owner_id, registration_id),
  foreign key (owner_id, registration_id)
    references n44_push_draft.registrations(owner_id, registration_id) on delete cascade
    deferrable initially deferred
);
create table n44_push_draft.deliveries (
  owner_id uuid not null references auth.users(id) on delete cascade,
  workspace_id text not null,
  device_id text not null,
  event_id text not null check (event_id ~ '^[a-zA-Z0-9_:%.-]{1,240}$'),
  registration_id uuid not null,
  kind text not null check (kind in ('lesson', 'due')),
  action_path text not null check (length(action_path) between 1 and 800),
  expires_at_ms bigint not null check (expires_at_ms >= 0),
  attempts smallint not null check (attempts between 0 and 3),
  state text not null check (state in ('sending', 'retry', 'sent', 'uncertain', 'suppressed', 'dead')),
  started_at_ms bigint not null,
  next_at_ms bigint not null,
  check (attempts > 0 or state = 'suppressed'),
  primary key (owner_id, workspace_id, device_id, event_id),
  -- No cascading registration FK: receipt survives early secret removal.
  check (started_at_ms < expires_at_ms)
);
create index retry_due on n44_push_draft.deliveries(owner_id, next_at_ms) where state = 'retry';
create index delivery_retention on n44_push_draft.deliveries(owner_id, expires_at_ms);
create table n44_push_draft.budgets (
  owner_id uuid not null references auth.users(id) on delete cascade,
  budget_key text not null check (length(budget_key) between 1 and 200),
  bucket bigint not null check (bucket >= 0),
  count integer not null check (count between 1 and 40),
  expires_at_ms bigint not null,
  primary key (owner_id, budget_key)
);

-- Defense in depth: no API grants below. Authenticated ownership does not grant
-- permission to write consent, contexts, keys, budgets or deliveries directly.
do $$
declare t text;
begin
  foreach t in array array['owner_clock','contexts','registrations','endpoint_claims','deliveries','budgets'] loop
    execute format('alter table n44_push_draft.%I enable row level security', t);
    execute format('alter table n44_push_draft.%I force row level security', t);
    execute format('revoke all on table n44_push_draft.%I from public, anon, authenticated', t);
  end loop;
end $$;
-- endpoint_claims' primary key is global; owner predicate needs its own index.
create index endpoint_owner on n44_push_draft.endpoint_claims(owner_id);

create function n44_push_draft.immutable_delivery() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if row(new.owner_id,new.workspace_id,new.device_id,new.event_id,new.registration_id,
         new.kind,new.action_path,new.expires_at_ms) is distinct from
     row(old.owner_id,old.workspace_id,old.device_id,old.event_id,old.registration_id,
         old.kind,old.action_path,old.expires_at_ms)
     or new.attempts < old.attempts or new.attempts > old.attempts + 1
     or (new.attempts > old.attempts and not (old.state = 'retry' and new.state = 'sending'))
     or (old.state = 'retry' and new.state = 'sending' and new.attempts <> old.attempts + 1)
     or (new.state = 'retry' and new.attempts >= 3)
     or (old.state in ('sent','uncertain','suppressed','dead') and new is distinct from old)
     or (old.state = 'sending' and new.state = 'sending' and new is distinct from old)
     or (old.state = 'retry' and new.state not in ('retry','sending','suppressed')) then
    raise exception using message = 'n44_transition_rejected';
  end if;
  return new;
end $$;
create trigger immutable_delivery before update on n44_push_draft.deliveries
for each row execute function n44_push_draft.immutable_delivery();
create function n44_push_draft.immutable_registration() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if row(new.owner_id,new.registration_id,new.workspace_id,new.device_id,new.session_id,
         new.session_revision,new.consent_revision,new.expires_at_ms) is distinct from
     row(old.owner_id,old.registration_id,old.workspace_id,old.device_id,old.session_id,
         old.session_revision,old.consent_revision,old.expires_at_ms)
     or (old.state <> 'active' and new is distinct from old)
     or (new.state = 'active' and row(new.sealed,new.fingerprint,new.binding_fingerprint)
       is distinct from row(old.sealed,old.fingerprint,old.binding_fingerprint)) then
    raise exception using message = 'n44_transition_rejected';
  end if;
  return new;
end $$;
create trigger immutable_registration before update on n44_push_draft.registrations
for each row execute function n44_push_draft.immutable_registration();
revoke all on all functions in schema n44_push_draft from public, anon, authenticated;


-- AI: FRESH PRIVATE PROPOSAL ONLY. Never applied remotely. Apply AFTER schema-proposal.sql.
-- Roles are deliberately unprivileged. Provision LOGIN password externally only after approval.


grant usage on schema n44_push_draft to n44_guard,n44_backend;
create table n44_push_draft.events (
 owner_id uuid not null references auth.users(id) on delete cascade,
 workspace_id text not null,device_id text not null,event_id text not null,
 source_kind text not null check(source_kind in ('lesson','due')),source_id text not null,
 source_stamp text not null check(source_stamp ~ '^[a-f0-9]{64}$'),
 due_at_ms bigint not null,expires_at_ms bigint not null,payload jsonb not null,
 primary key(owner_id,workspace_id,device_id,event_id),
 foreign key(owner_id,workspace_id,device_id) references n44_push_draft.contexts(owner_id,workspace_id,device_id),
 check(expires_at_ms>due_at_ms),check(octet_length(payload::text)<=2048));
create index events_due on n44_push_draft.events(due_at_ms,owner_id,workspace_id,device_id,event_id);
alter table n44_push_draft.owner_clock add column next_cleanup_ms bigint not null default 0;
create index cleanup_due on n44_push_draft.owner_clock(next_cleanup_ms,owner_id);
create table n44_push_draft.ingress_nonces(nonce uuid primary key,scope text not null check(scope in ('teacher','scheduler')),expires_at_ms bigint not null);
create index ingress_expiry on n44_push_draft.ingress_nonces(expires_at_ms);
create index ingress_scope on n44_push_draft.ingress_nonces(scope);
create table n44_push_draft.ingress_rates(key text primary key,kind text not null,bucket bigint not null,count integer not null,expires_at_ms bigint not null);
create index ingress_kind on n44_push_draft.ingress_rates(kind);
create index ingress_rate_expiry on n44_push_draft.ingress_rates(expires_at_ms);
-- Managed Auth RLS is enabled with zero policies. Its existing management
-- owner postgres already has BYPASSRLS (not superuser); no new bypass role,
-- Auth policy, Auth schema object or Auth ownership change is proposed.
-- Activation must read back postgres's exact column SELECT/UPDATE privileges.
-- Only the private helper uses those existing rights, and returns no tokens.
grant usage on schema n44_push_draft to postgres;
create function n44_push_draft.lock_current_session(p_user uuid,p_session uuid)
returns table(user_id uuid,session_id uuid,not_after_ms bigint) language plpgsql security definer set search_path=pg_catalog as $$
begin
 perform u.id from auth.users u where u.id=p_user and (u.banned_until is null or u.banned_until<=clock_timestamp()) for share;
 if not found then return; end if;
 return query select s.user_id,s.id,(extract(epoch from s.not_after)*1000)::bigint from auth.sessions s where s.user_id=p_user and s.id=p_session
 and (s.not_after is null or s.not_after>clock_timestamp()) for share of s;
end $$;
alter function n44_push_draft.lock_current_session(uuid,uuid) owner to postgres;
revoke all on function n44_push_draft.lock_current_session(uuid,uuid) from public,anon,authenticated,n44_guard;
grant execute on function n44_push_draft.lock_current_session(uuid,uuid) to n44_backend;
-- RLS private backend only. No authenticated membership or exposed private schema.
do $$ declare t text; begin
 foreach t in array array['owner_clock','contexts','registrations','endpoint_claims','deliveries','budgets','events','ingress_nonces','ingress_rates'] loop
 execute format('alter table n44_push_draft.%I enable row level security',t);
 execute format('alter table n44_push_draft.%I force row level security',t);
 execute format('revoke all on n44_push_draft.%I from public,anon,authenticated',t);
 execute format('grant select,insert,update,delete on n44_push_draft.%I to n44_backend',t);
 execute format('create policy private_backend on n44_push_draft.%I to n44_backend using (true) with check (true)',t);
 end loop;
end $$;

-- AI: inactive proposal; no hosted application.
grant usage on schema rakeezx to n44_guard;
grant select(id,owner_id,teaching_id,date,start_time,end_time,status,revision,deleted_at),update(id) on rakeezx.sessions to n44_guard;
create policy n44_guard_read on rakeezx.sessions to n44_guard using (owner_id::text=current_setting('n44.canonical_owner',true)) with check (false);
grant select(id,owner_id,item_id,start_date,due_date,revision,deleted_at),update(id) on rakeezx.score_subitems to n44_guard;
create policy n44_guard_read on rakeezx.score_subitems to n44_guard using (owner_id::text=current_setting('n44.canonical_owner',true)) with check (false);
grant select(id,owner_id,teaching_id,score_mode,revision,deleted_at),update(id) on rakeezx.items to n44_guard;
create policy n44_guard_read on rakeezx.items to n44_guard using (owner_id::text=current_setting('n44.canonical_owner',true)) with check (false);
grant select(id,owner_id,status,hijri_start,hijri_end,calendar_preset_id,revision,deleted_at),update(id) on rakeezx.years to n44_guard;
create policy n44_guard_read on rakeezx.years to n44_guard using (owner_id::text=current_setting('n44.canonical_owner',true)) with check (false);
grant select(id,owner_id,year_id,status,revision,deleted_at),update(id) on rakeezx.sections to n44_guard;
create policy n44_guard_read on rakeezx.sections to n44_guard using (owner_id::text=current_setting('n44.canonical_owner',true)) with check (false);
grant select(id,owner_id,revision,deleted_at),update(id) on rakeezx.subjects to n44_guard;
create policy n44_guard_read on rakeezx.subjects to n44_guard using (owner_id::text=current_setting('n44.canonical_owner',true)) with check (false);
grant select(id,owner_id,year_id,source,preset_id,term_date_overrides,revision,deleted_at),update(id) on rakeezx.calendars to n44_guard;
create policy n44_guard_read on rakeezx.calendars to n44_guard using (owner_id::text=current_setting('n44.canonical_owner',true)) with check (false);
grant select(id,owner_id,calendar_id,date,kind,revision,deleted_at),update(id) on rakeezx.calendar_days to n44_guard;
create policy n44_guard_read on rakeezx.calendar_days to n44_guard using (owner_id::text=current_setting('n44.canonical_owner',true)) with check (false);
grant select(id,owner_id,year_id,"index",status,start_date,end_date,revision,deleted_at),update(id) on rakeezx.terms to n44_guard;
create policy n44_guard_read on rakeezx.terms to n44_guard using (owner_id::text=current_setting('n44.canonical_owner',true)) with check (false);
grant select(id,owner_id,section_id,subject_id,term_id,revision,deleted_at),update(id) on rakeezx.teachings to n44_guard;
create policy n44_guard_read on rakeezx.teachings to n44_guard using (owner_id::text=current_setting('n44.canonical_owner',true)) with check (false);
-- AI: exact target + parent-key canonical read proposal; no full table/owner scan.
-- Immediate canonical PK/FKs and revision triggers are required readback identities.
create function n44_push_draft.read_source(p_owner uuid,p_kind text,p_id text) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare src jsonb; tch jsonb; sec jsonb; subj jsonb; yr jsonb; trm jsonb; cals jsonb; ds jsonb; ts jsonb;
 tid text; iid text; yid text; cid text; n integer;
begin
 perform set_config('n44.canonical_owner',p_owner::text,true);
 if p_kind='lesson' then
 select jsonb_build_object('id',id,'revision',revision::text,'deleted',deleted_at is not null,'teachingId',teaching_id,'date',date::text,'startTime',start_time::text,'endTime',end_time::text,'status',status),teaching_id into src,tid from rakeezx.sessions where owner_id=p_owner and id=p_id for share;
 elsif p_kind='due' then
 select jsonb_build_object('id',id,'revision',revision::text,'deleted',deleted_at is not null,'itemId',item_id,'startDate',start_date::text,'dueDate',due_date::text),item_id into src,iid from rakeezx.score_subitems where owner_id=p_owner and id=p_id for share;
 if not found then return null; end if;
 select src || jsonb_build_object('itemRevision',revision::text,'scoreMode',score_mode,'itemDeleted',deleted_at is not null),teaching_id into src,tid from rakeezx.items where owner_id=p_owner and id=iid for share;
 else return null; end if;
 if src is null or tid is null then return null; end if;
 select jsonb_build_object('id',id,'revision',revision::text,'deleted',deleted_at is not null,'sectionId',section_id,'subjectId',subject_id,'termId',term_id) into tch from rakeezx.teachings where owner_id=p_owner and id=tid for share;
 if not found then return null; end if;
 select jsonb_build_object('id',id,'revision',revision::text,'deleted',deleted_at is not null,'yearId',year_id,'status',status) into sec from rakeezx.sections where owner_id=p_owner and id=tch->>'sectionId' for share;
 if not found then return null; end if;
 select jsonb_build_object('id',id,'revision',revision::text,'deleted',deleted_at is not null) into subj from rakeezx.subjects where owner_id=p_owner and id=tch->>'subjectId' for share;
 if not found then return null; end if;
 select year_id into yid from rakeezx.terms where owner_id=p_owner and id=tch->>'termId';
 -- This single parent key fences new term/calendar inserts by immediate FK.
 select jsonb_build_object('id',id,'revision',revision::text,'deleted',deleted_at is not null,'status',status,'hijriStart',hijri_start,'hijriEnd',hijri_end,'calendarPresetId',calendar_preset_id) into yr from rakeezx.years where owner_id=p_owner and id=yid for update;
 if not found then return null; end if;
 select coalesce(jsonb_agg(x.v order by x.id),'[]'::jsonb),count(*) into ts,n from
 (select id,jsonb_build_object('id',id,'revision',revision::text,'deleted',deleted_at is not null,'yearId',year_id,'index',"index",'status',status,'startDate',start_date::text,'endDate',end_date::text) as v from rakeezx.terms where owner_id=p_owner and year_id=yid order by id limit 7 for share) x;
 if n>6 then raise exception 'n44_source_bound'; end if;
 select coalesce(jsonb_agg(x.v order by x.id),'[]'::jsonb),count(*) into cals,n from
 (select id,jsonb_build_object('id',id,'revision',revision::text,'deleted',deleted_at is not null,'yearId',year_id,'source',source,'presetId',preset_id,'termDateOverrides',term_date_overrides) as v from rakeezx.calendars where owner_id=p_owner and year_id=yid order by id limit 4 for update) x;
 if n>3 then raise exception 'n44_source_bound'; end if;
 -- Calendar parent locks fence inserts; bounded child locks fence edits/deletes.
 select coalesce(jsonb_agg(x.v order by x.id),'[]'::jsonb),count(*) into ds,n from
 (select d.id,jsonb_build_object('id',d.id,'revision',d.revision::text,'deleted',d.deleted_at is not null,'calendarId',d.calendar_id,'date',d.date::text,'kind',d.kind) as v from rakeezx.calendar_days d join rakeezx.calendars c on c.owner_id=d.owner_id and c.id=d.calendar_id
 where d.owner_id=p_owner and c.year_id=yid order by d.id limit 801 for share of d) x;
 if n>800 then raise exception 'n44_source_bound'; end if;
 return jsonb_build_object('source',src,'teaching',tch,'section',sec,'subject',subj,'year',yr,'terms',ts,'calendars',cals,'days',ds);
end $$;

revoke all on function n44_push_draft.read_source(uuid,text,text) from public;
grant execute on function n44_push_draft.read_source(uuid,text,text) to n44_backend;

grant create on schema n44_push_draft to n44_guard;
grant n44_guard to postgres with set true, inherit false;
alter function n44_push_draft.read_source(uuid,text,text) owner to n44_guard;
revoke create on schema n44_push_draft from n44_guard;
grant n44_guard to postgres with set false, inherit false;
commit;
