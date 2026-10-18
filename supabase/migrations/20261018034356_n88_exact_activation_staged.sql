-- AI-authored staged candidate. CLI v2.117.0 migration new, 2026-10-18. NEVER APPLIED.
-- Exact project xlrubcwjqktzzunrvuns; requires separate hosted approval and passing full preflight.
-- Fresh-only; no credentials, contexts, source rows, route, cron or Auth settings.
begin;
set local lock_timeout='1s';
set local statement_timeout='15s';
select pg_advisory_xact_lock(8800182026);
do $n88$ begin
if exists(select 1 from pg_namespace where nspname='n88_private') or exists(select 1 from pg_roles where rolname in ('n88_guard','n88_backend')) then raise exception 'N88 collision: never reapply/adopt existing private objects'; end if;
if to_regclass('supabase_migrations.schema_migrations') is not null then
  if exists(select 1 from supabase_migrations.schema_migrations where version='20261018034356') then raise exception 'N88 migration history collision'; end if;
end if;
if not exists(select 1 from information_schema.columns where table_schema='auth' and table_name='sessions' and column_name='id' and udt_name='uuid' and is_nullable='NO') then raise exception 'N88 column mismatch: auth.sessions.id'; end if;
if not exists(select 1 from information_schema.columns where table_schema='auth' and table_name='sessions' and column_name='user_id' and udt_name='uuid' and is_nullable='NO') then raise exception 'N88 column mismatch: auth.sessions.user_id'; end if;
if not exists(select 1 from information_schema.columns where table_schema='auth' and table_name='sessions' and column_name='not_after' and udt_name='timestamptz' and is_nullable='YES') then raise exception 'N88 column mismatch: auth.sessions.not_after'; end if;
if not exists(select 1 from information_schema.columns where table_schema='auth' and table_name='users' and column_name='id' and udt_name='uuid' and is_nullable='NO') then raise exception 'N88 column mismatch: auth.users.id'; end if;
if not exists(select 1 from information_schema.columns where table_schema='auth' and table_name='users' and column_name='banned_until' and udt_name='timestamptz' and is_nullable='YES') then raise exception 'N88 column mismatch: auth.users.banned_until'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='enrollments' and column_name='id' and udt_name='text' and is_nullable='NO') then raise exception 'N88 column mismatch: rakeezx.enrollments.id'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='enrollments' and column_name='owner_id' and udt_name='uuid' and is_nullable='NO') then raise exception 'N88 column mismatch: rakeezx.enrollments.owner_id'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='enrollments' and column_name='student_id' and udt_name='text' and is_nullable='NO') then raise exception 'N88 column mismatch: rakeezx.enrollments.student_id'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='enrollments' and column_name='section_id' and udt_name='text' and is_nullable='NO') then raise exception 'N88 column mismatch: rakeezx.enrollments.section_id'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='enrollments' and column_name='end_date' and udt_name='date' and is_nullable='YES') then raise exception 'N88 column mismatch: rakeezx.enrollments.end_date'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='enrollments' and column_name='status' and udt_name='text' and is_nullable='NO') then raise exception 'N88 column mismatch: rakeezx.enrollments.status'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='enrollments' and column_name='deleted_at' and udt_name='timestamptz' and is_nullable='YES') then raise exception 'N88 column mismatch: rakeezx.enrollments.deleted_at'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='enrollments' and column_name='revision' and udt_name='int8' and is_nullable='NO') then raise exception 'N88 column mismatch: rakeezx.enrollments.revision'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='items' and column_name='id' and udt_name='text' and is_nullable='NO') then raise exception 'N88 column mismatch: rakeezx.items.id'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='items' and column_name='owner_id' and udt_name='uuid' and is_nullable='NO') then raise exception 'N88 column mismatch: rakeezx.items.owner_id'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='items' and column_name='teaching_id' and udt_name='text' and is_nullable='NO') then raise exception 'N88 column mismatch: rakeezx.items.teaching_id'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='items' and column_name='name' and udt_name='text' and is_nullable='NO') then raise exception 'N88 column mismatch: rakeezx.items.name'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='items' and column_name='auto' and udt_name='text' and is_nullable='YES') then raise exception 'N88 column mismatch: rakeezx.items.auto'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='items' and column_name='deleted_at' and udt_name='timestamptz' and is_nullable='YES') then raise exception 'N88 column mismatch: rakeezx.items.deleted_at'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='items' and column_name='revision' and udt_name='int8' and is_nullable='NO') then raise exception 'N88 column mismatch: rakeezx.items.revision'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='sections' and column_name='id' and udt_name='text' and is_nullable='NO') then raise exception 'N88 column mismatch: rakeezx.sections.id'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='sections' and column_name='owner_id' and udt_name='uuid' and is_nullable='NO') then raise exception 'N88 column mismatch: rakeezx.sections.owner_id'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='sections' and column_name='year_id' and udt_name='text' and is_nullable='NO') then raise exception 'N88 column mismatch: rakeezx.sections.year_id'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='sections' and column_name='deleted_at' and udt_name='timestamptz' and is_nullable='YES') then raise exception 'N88 column mismatch: rakeezx.sections.deleted_at'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='sections' and column_name='revision' and udt_name='int8' and is_nullable='NO') then raise exception 'N88 column mismatch: rakeezx.sections.revision'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='sections' and column_name='status' and udt_name='text' and is_nullable='NO') then raise exception 'N88 column mismatch: rakeezx.sections.status'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='students' and column_name='id' and udt_name='text' and is_nullable='NO') then raise exception 'N88 column mismatch: rakeezx.students.id'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='students' and column_name='owner_id' and udt_name='uuid' and is_nullable='NO') then raise exception 'N88 column mismatch: rakeezx.students.owner_id'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='students' and column_name='name' and udt_name='text' and is_nullable='NO') then raise exception 'N88 column mismatch: rakeezx.students.name'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='students' and column_name='status' and udt_name='text' and is_nullable='NO') then raise exception 'N88 column mismatch: rakeezx.students.status'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='students' and column_name='deleted_at' and udt_name='timestamptz' and is_nullable='YES') then raise exception 'N88 column mismatch: rakeezx.students.deleted_at'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='students' and column_name='revision' and udt_name='int8' and is_nullable='NO') then raise exception 'N88 column mismatch: rakeezx.students.revision'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='teachings' and column_name='id' and udt_name='text' and is_nullable='NO') then raise exception 'N88 column mismatch: rakeezx.teachings.id'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='teachings' and column_name='owner_id' and udt_name='uuid' and is_nullable='NO') then raise exception 'N88 column mismatch: rakeezx.teachings.owner_id'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='teachings' and column_name='section_id' and udt_name='text' and is_nullable='NO') then raise exception 'N88 column mismatch: rakeezx.teachings.section_id'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='teachings' and column_name='term_id' and udt_name='text' and is_nullable='NO') then raise exception 'N88 column mismatch: rakeezx.teachings.term_id'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='teachings' and column_name='deleted_at' and udt_name='timestamptz' and is_nullable='YES') then raise exception 'N88 column mismatch: rakeezx.teachings.deleted_at'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='teachings' and column_name='revision' and udt_name='int8' and is_nullable='NO') then raise exception 'N88 column mismatch: rakeezx.teachings.revision'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='terms' and column_name='id' and udt_name='text' and is_nullable='NO') then raise exception 'N88 column mismatch: rakeezx.terms.id'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='terms' and column_name='owner_id' and udt_name='uuid' and is_nullable='NO') then raise exception 'N88 column mismatch: rakeezx.terms.owner_id'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='terms' and column_name='year_id' and udt_name='text' and is_nullable='NO') then raise exception 'N88 column mismatch: rakeezx.terms.year_id'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='terms' and column_name='status' and udt_name='text' and is_nullable='NO') then raise exception 'N88 column mismatch: rakeezx.terms.status'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='terms' and column_name='deleted_at' and udt_name='timestamptz' and is_nullable='YES') then raise exception 'N88 column mismatch: rakeezx.terms.deleted_at'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='terms' and column_name='revision' and udt_name='int8' and is_nullable='NO') then raise exception 'N88 column mismatch: rakeezx.terms.revision'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='years' and column_name='id' and udt_name='text' and is_nullable='NO') then raise exception 'N88 column mismatch: rakeezx.years.id'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='years' and column_name='owner_id' and udt_name='uuid' and is_nullable='NO') then raise exception 'N88 column mismatch: rakeezx.years.owner_id'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='years' and column_name='status' and udt_name='text' and is_nullable='NO') then raise exception 'N88 column mismatch: rakeezx.years.status'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='years' and column_name='deleted_at' and udt_name='timestamptz' and is_nullable='YES') then raise exception 'N88 column mismatch: rakeezx.years.deleted_at'; end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='years' and column_name='revision' and udt_name='int8' and is_nullable='NO') then raise exception 'N88 column mismatch: rakeezx.years.revision'; end if;
if not exists(select 1 from pg_constraint where conrelid='rakeezx.enrollments'::regclass and conname='enrollments_owner_id_fkey' and convalidated and not condeferrable and pg_get_constraintdef(oid)='FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE') then raise exception 'N88 constraint mismatch: enrollments_owner_id_fkey'; end if;
if not exists(select 1 from pg_constraint where conrelid='rakeezx.enrollments'::regclass and conname='enrollments_owner_id_section_id_fkey' and convalidated and not condeferrable and pg_get_constraintdef(oid)='FOREIGN KEY (owner_id, section_id) REFERENCES rakeezx.sections(owner_id, id) ON DELETE CASCADE') then raise exception 'N88 constraint mismatch: enrollments_owner_id_section_id_fkey'; end if;
if not exists(select 1 from pg_constraint where conrelid='rakeezx.enrollments'::regclass and conname='enrollments_owner_id_student_id_fkey' and convalidated and not condeferrable and pg_get_constraintdef(oid)='FOREIGN KEY (owner_id, student_id) REFERENCES rakeezx.students(owner_id, id) ON DELETE CASCADE') then raise exception 'N88 constraint mismatch: enrollments_owner_id_student_id_fkey'; end if;
if not exists(select 1 from pg_constraint where conrelid='rakeezx.enrollments'::regclass and conname='enrollments_pkey' and convalidated and not condeferrable and pg_get_constraintdef(oid)='PRIMARY KEY (owner_id, id)') then raise exception 'N88 constraint mismatch: enrollments_pkey'; end if;
if not exists(select 1 from pg_constraint where conrelid='rakeezx.items'::regclass and conname='items_owner_id_fkey' and convalidated and not condeferrable and pg_get_constraintdef(oid)='FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE') then raise exception 'N88 constraint mismatch: items_owner_id_fkey'; end if;
if not exists(select 1 from pg_constraint where conrelid='rakeezx.items'::regclass and conname='items_owner_id_teaching_id_fkey' and convalidated and not condeferrable and pg_get_constraintdef(oid)='FOREIGN KEY (owner_id, teaching_id) REFERENCES rakeezx.teachings(owner_id, id) ON DELETE CASCADE') then raise exception 'N88 constraint mismatch: items_owner_id_teaching_id_fkey'; end if;
if not exists(select 1 from pg_constraint where conrelid='rakeezx.items'::regclass and conname='items_pkey' and convalidated and not condeferrable and pg_get_constraintdef(oid)='PRIMARY KEY (owner_id, id)') then raise exception 'N88 constraint mismatch: items_pkey'; end if;
if not exists(select 1 from pg_constraint where conrelid='rakeezx.sections'::regclass and conname='sections_owner_id_fkey' and convalidated and not condeferrable and pg_get_constraintdef(oid)='FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE') then raise exception 'N88 constraint mismatch: sections_owner_id_fkey'; end if;
if not exists(select 1 from pg_constraint where conrelid='rakeezx.sections'::regclass and conname='sections_owner_id_year_id_fkey' and convalidated and not condeferrable and pg_get_constraintdef(oid)='FOREIGN KEY (owner_id, year_id) REFERENCES rakeezx.years(owner_id, id) ON DELETE CASCADE') then raise exception 'N88 constraint mismatch: sections_owner_id_year_id_fkey'; end if;
if not exists(select 1 from pg_constraint where conrelid='rakeezx.sections'::regclass and conname='sections_pkey' and convalidated and not condeferrable and pg_get_constraintdef(oid)='PRIMARY KEY (owner_id, id)') then raise exception 'N88 constraint mismatch: sections_pkey'; end if;
if not exists(select 1 from pg_constraint where conrelid='rakeezx.students'::regclass and conname='students_owner_id_fkey' and convalidated and not condeferrable and pg_get_constraintdef(oid)='FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE') then raise exception 'N88 constraint mismatch: students_owner_id_fkey'; end if;
if not exists(select 1 from pg_constraint where conrelid='rakeezx.students'::regclass and conname='students_pkey' and convalidated and not condeferrable and pg_get_constraintdef(oid)='PRIMARY KEY (owner_id, id)') then raise exception 'N88 constraint mismatch: students_pkey'; end if;
if not exists(select 1 from pg_constraint where conrelid='rakeezx.teachings'::regclass and conname='teachings_owner_id_fkey' and convalidated and not condeferrable and pg_get_constraintdef(oid)='FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE') then raise exception 'N88 constraint mismatch: teachings_owner_id_fkey'; end if;
if not exists(select 1 from pg_constraint where conrelid='rakeezx.teachings'::regclass and conname='teachings_owner_id_section_id_fkey' and convalidated and not condeferrable and pg_get_constraintdef(oid)='FOREIGN KEY (owner_id, section_id) REFERENCES rakeezx.sections(owner_id, id) ON DELETE CASCADE') then raise exception 'N88 constraint mismatch: teachings_owner_id_section_id_fkey'; end if;
if not exists(select 1 from pg_constraint where conrelid='rakeezx.teachings'::regclass and conname='teachings_owner_id_term_id_fkey' and convalidated and not condeferrable and pg_get_constraintdef(oid)='FOREIGN KEY (owner_id, term_id) REFERENCES rakeezx.terms(owner_id, id) ON DELETE CASCADE') then raise exception 'N88 constraint mismatch: teachings_owner_id_term_id_fkey'; end if;
if not exists(select 1 from pg_constraint where conrelid='rakeezx.teachings'::regclass and conname='teachings_pkey' and convalidated and not condeferrable and pg_get_constraintdef(oid)='PRIMARY KEY (owner_id, id)') then raise exception 'N88 constraint mismatch: teachings_pkey'; end if;
if not exists(select 1 from pg_constraint where conrelid='rakeezx.terms'::regclass and conname='terms_owner_id_fkey' and convalidated and not condeferrable and pg_get_constraintdef(oid)='FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE') then raise exception 'N88 constraint mismatch: terms_owner_id_fkey'; end if;
if not exists(select 1 from pg_constraint where conrelid='rakeezx.terms'::regclass and conname='terms_owner_id_year_id_fkey' and convalidated and not condeferrable and pg_get_constraintdef(oid)='FOREIGN KEY (owner_id, year_id) REFERENCES rakeezx.years(owner_id, id) ON DELETE CASCADE') then raise exception 'N88 constraint mismatch: terms_owner_id_year_id_fkey'; end if;
if not exists(select 1 from pg_constraint where conrelid='rakeezx.terms'::regclass and conname='terms_pkey' and convalidated and not condeferrable and pg_get_constraintdef(oid)='PRIMARY KEY (owner_id, id)') then raise exception 'N88 constraint mismatch: terms_pkey'; end if;
if not exists(select 1 from pg_constraint where conrelid='rakeezx.years'::regclass and conname='years_owner_id_fkey' and convalidated and not condeferrable and pg_get_constraintdef(oid)='FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE') then raise exception 'N88 constraint mismatch: years_owner_id_fkey'; end if;
if not exists(select 1 from pg_constraint where conrelid='rakeezx.years'::regclass and conname='years_pkey' and convalidated and not condeferrable and pg_get_constraintdef(oid)='PRIMARY KEY (owner_id, id)') then raise exception 'N88 constraint mismatch: years_pkey'; end if;
if not exists(select 1 from pg_class where oid='rakeezx.years'::regclass and relrowsecurity and relforcerowsecurity) then raise exception 'N88 forced RLS mismatch: years'; end if;
if not exists(select 1 from pg_class where oid='rakeezx.terms'::regclass and relrowsecurity and relforcerowsecurity) then raise exception 'N88 forced RLS mismatch: terms'; end if;
if not exists(select 1 from pg_class where oid='rakeezx.sections'::regclass and relrowsecurity and relforcerowsecurity) then raise exception 'N88 forced RLS mismatch: sections'; end if;
if not exists(select 1 from pg_class where oid='rakeezx.students'::regclass and relrowsecurity and relforcerowsecurity) then raise exception 'N88 forced RLS mismatch: students'; end if;
if not exists(select 1 from pg_class where oid='rakeezx.enrollments'::regclass and relrowsecurity and relforcerowsecurity) then raise exception 'N88 forced RLS mismatch: enrollments'; end if;
if not exists(select 1 from pg_class where oid='rakeezx.teachings'::regclass and relrowsecurity and relforcerowsecurity) then raise exception 'N88 forced RLS mismatch: teachings'; end if;
if not exists(select 1 from pg_class where oid='rakeezx.items'::regclass and relrowsecurity and relforcerowsecurity) then raise exception 'N88 forced RLS mismatch: items'; end if;
if not exists(select 1 from pg_constraint where conrelid='auth.users'::regclass and contype='p' and pg_get_constraintdef(oid)='PRIMARY KEY (id)' and convalidated and not condeferrable) then raise exception 'N88 Auth user PK prerequisite'; end if;
if not exists(select 1 from pg_constraint where conrelid='auth.sessions'::regclass and contype='p' and pg_get_constraintdef(oid)='PRIMARY KEY (id)' and convalidated and not condeferrable) then raise exception 'N88 Auth session PK prerequisite'; end if;
if not exists(select 1 from pg_constraint where conrelid='auth.sessions'::regclass and contype='f' and confrelid='auth.users'::regclass and pg_get_constraintdef(oid)='FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE' and convalidated and not condeferrable) then raise exception 'N88 Auth session FK prerequisite'; end if;
if (select count(*) from pg_class where oid in ('auth.users'::regclass,'auth.sessions'::regclass) and relrowsecurity and not relforcerowsecurity and relowner::regrole::text='supabase_auth_admin')<>2 then raise exception 'N88 managed Auth owner/RLS mismatch'; end if;
if exists(select 1 from pg_policies where schemaname='auth' and tablename in ('users','sessions')) then raise exception 'N88 managed Auth policy mismatch'; end if;
if current_user<>'postgres' or not exists(select 1 from pg_roles where rolname=current_user and rolbypassrls and not rolsuper and rolcreaterole) or pg_has_role('postgres','supabase_auth_admin','MEMBER') or has_schema_privilege('postgres','auth','CREATE') then raise exception 'N88 existing management capability mismatch'; end if;
if not has_column_privilege('postgres','auth.users','id','SELECT') or not has_column_privilege('postgres','auth.users','banned_until','SELECT') or not has_column_privilege('postgres','auth.users','id','UPDATE') or not has_column_privilege('postgres','auth.sessions','id','SELECT') or not has_column_privilege('postgres','auth.sessions','user_id','SELECT') or not has_column_privilege('postgres','auth.sessions','not_after','SELECT') or not has_column_privilege('postgres','auth.sessions','id','UPDATE') then raise exception 'N88 existing management exact Auth lock privileges unavailable'; end if;
end $n88$;
create role n88_backend nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;

-- BEGIN reviewed source schema-proposal.sql
-- AI: INACTIVE, UNAPPLIED private design, outside hosted migrations/functions.
-- N88 native qualification card permits this draft ONLY in a new owned fabricated
-- local PG17 cluster. See N88_NATIVE_POSTGRES_QUALIFICATION.md for actual evidence;
-- test-adapter protocols are not a production adapter or hosted activation grant.
-- NOT an adapter to the current canonical enrollment model. No hosted grants/RPCs.
-- Separately authorized migration must be CLI-generated and verified on disposable PG.
create schema n88_private;
revoke all on schema n88_private from public;
create table n88_private.contexts (
  namespace text primary key check(namespace ~ '^[A-Za-z0-9_-]{24,64}$'),
  owner_id uuid not null unique, active boolean not null default false,
  unique(namespace, owner_id)
);
create table n88_private.memberships (
  owner_id uuid not null, class_id text not null, student_id text not null,
  enrollment_id text not null, revision bigint not null check(revision >= 1),
  active boolean not null default false,
  primary key(owner_id,class_id,student_id,enrollment_id)
);
create table n88_private.credentials (
  id uuid primary key, namespace text not null, owner_id uuid not null,
  student_id text not null, version bigint not null check(version >= 1),
  verifier text not null check(verifier ~ '^[a-f0-9]{64}$'),
  entry_verifier text not null unique check(entry_verifier ~ '^[a-f0-9]{64}$'), revoked_at timestamptz,
  foreign key(namespace,owner_id) references n88_private.contexts(namespace,owner_id),
  -- Stable owner + durable student identity; NOT an old-term enrollment FK.
  -- Future adapter must verify this relationship against the canonical student store.
  unique(namespace,verifier), -- tombstones prevent reactivation of old codes
  unique(id,namespace,owner_id,student_id,version,entry_verifier)
);
create unique index n88_current_credential on n88_private.credentials
  (owner_id,student_id) where revoked_at is null;
create table n88_private.sessions (
  id uuid primary key, credential_id uuid not null, namespace text not null,
  owner_id uuid not null, class_id text not null, student_id text not null,
  enrollment_id text not null, version bigint not null, membership_revision bigint not null,
  entry_verifier text not null,
  token_hash text not null unique check(token_hash ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz not null, revoked_at timestamptz,
  foreign key(credential_id,namespace,owner_id,student_id,version,entry_verifier)
    references n88_private.credentials(id,namespace,owner_id,student_id,version,entry_verifier),
  foreign key(owner_id,class_id,student_id,enrollment_id)
    references n88_private.memberships(owner_id,class_id,student_id,enrollment_id)
); -- many sessions per credential; NO credential expiry/consumption
create index n88_session_credential on n88_private.sessions(credential_id);
create index n88_session_retention on n88_private.sessions(expires_at);
create table n88_private.publications (
  id uuid primary key, owner_id uuid not null, class_id text not null,
  student_id text not null, enrollment_id text not null,
  source_teaching_id text not null, source_item_id text not null,
  title text not null check(length(title) between 1 and 160),
  instruction text not null default '' check(length(instruction)<=500),
  deadline date, status text not null check(status in ('todo','working','done')),
  published boolean not null default false,
  foreign key(owner_id,class_id,student_id,enrollment_id)
    references n88_private.memberships(owner_id,class_id,student_id,enrollment_id)
); -- no grades/private notes/attendance in student projection
create index n88_published_student on n88_private.publications
  (owner_id,class_id,student_id,enrollment_id) where published;
create table n88_private.guess_budgets (
  key text primary key, count integer not null check(count >= 0), until_at timestamptz not null
); -- keys: server-HMAC source/context; global; context/global failure counters
alter table n88_private.contexts enable row level security;
alter table n88_private.memberships enable row level security;
alter table n88_private.credentials enable row level security;
alter table n88_private.sessions enable row level security;
alter table n88_private.publications enable row level security;
alter table n88_private.guess_budgets enable row level security;
revoke all on all tables in schema n88_private from public;
-- No policies/grants to frontend anon/authenticated; private schema unexposed.
-- Future backend repository implementation MUST:
-- 1. Verify current teacher Auth/session independently; ignore supplied owner/metadata.
-- 2. Lock a bounded shared budget keyspace in sorted order, BEFORE any context/code
--    lookup. Atomic all-attempt reservations: source 6/context 30/global 100 per 15m;
--    failed-attempt counters context 60/global 500 per 24h checked BEFORE lookup.
--    Unknown private entry/code uses identical status/body; failures must COMMIT counters.
--    Never roll counters back just because credentials failed. Max 10000 keys;
--    expiry cleanup + fail-closed admission; no reset on restart or instance switch.
-- 3. Lock context -> canonical membership -> credentials -> sessions in consistent
--    order for issue/rotate/revoke/login/read/publication/lifecycle. Read current
--    enrollment/student/class status and revision; this illustrative membership
--    table is NOT permission to use stale snapshot copies in a hosted adapter.
-- 4. Generate String(randomInt(1000,10000)) server-side; HMAC-SHA256(JSON array n88-v2/code/namespace/code)
--    Validate ^[1-9][0-9]{3}$ after Arabic/Persian digit normalization; never pad.
--    Exactly 9,000 possible codes, repeated digits permitted.
--    using injected secret in server secret storage, NEVER plain SHA of four digits.
--    Reserve namespace/verifier atomically, including tombstones (9,000 lifetime
--    values per owner). Max 128 random retries; exhaustion is generic/rollback.
--    Create a separate 256-bit private bookmarkable /s/<secret> per credential.
--    Store ONLY server-HMAC entry verifier, never raw link/PIN in DB or logs.
--    Resolve exact entry verifier BEFORE comparing its PIN; NO teacher-wide PIN lookup.
--    Rotate/revoke old credential + ALL sessions atomically; rollback exceptions.
--    Rotation replaces BOTH private link and PIN; all prior links/sessions fail.
-- 5. Credentials bind ONLY stable verified owner + durable student ID. No automatic
--    term/year/revision code or private bookmark reset. Every claim/read resolves
--    exactly ONE current active server-owned membership for that identity, otherwise
--    fail closed (never first-match or union). Term advancement requires independently
--    verified new membership; never enroll/publish as a side effect of login.
--    Login creates a NEW 256-bit session, bound to entry verifier/namespace/all four membership keys,
--    credential ID/version and CURRENT membership revision, expires after 8h.
--    Reads require that same scope/revision still be the unique current membership;
--    old sessions deny on change, relogin with unchanged link/code binds the new term.
--    Rotate/revoke through ANY current membership revokes the stable credential
--    and ALL its sessions, including old-term sessions.
-- 6. Every read rechecks current context/membership/credential/version/session and
--    published=true within same transaction. Require exact private entry verifier too. Return explicit title/instruction/
--    deadline/status + progress derived from same snapshot. No SELECT * response.
-- 7. Publish validates owner/member + canonical source item. No browser-selected
--    owner, no definer bypass or public service-role endpoint. Commit updates atomically.
-- 8. HTTPS-only private route/cookie; no-referrer/noindex/no-store, no analytics.
--    Disable/redact path/cookie/body logging at EVERY ingress/edge/error trace.
--    Private path intentionally persists for bookmarks/history; never log raw URL.
--    Public teacher namespace/student ID is NOT an entry credential.
-- 9. Durable rate-limit/proxy, transaction races, roles/RLS and canonical lifecycle
--    tests are REQUIRED before hosting. This draft deliberately grants no service role.

-- BEGIN reviewed source postgres-repository-schema.sql
-- AI: INACTIVE local pilot supplement; NOT a hosted migration or canonical resolver.
-- Apply only after schema-proposal.sql in the explicitly owned synthetic cluster.
-- Keep the original qualified schema unchanged; represent all existing service guards.
alter table n88_private.memberships
  add column status text not null check (status in ('active','inactive','ended')),
  add column end_date date,
  add column student_active boolean not null,
  add column class_active boolean not null,
  add column label text not null check (length(label) <= 300),
  add constraint n88_membership_active_projection check
    (active = (status = 'active' and end_date is null and student_active and class_active));

-- BEGIN reviewed source canonical-state-schema.inactive.sql
-- AI: additional INACTIVE proposal for a FRESH private projection only.
-- Original qualified SQL is retained. Existing private rows need a separately
-- approved backfill/revocation plan, never an invented default lineage stamp.
alter table n88_private.memberships add column canonical_stamp text not null check(canonical_stamp ~ '^[a-f0-9]{64}$');
alter table n88_private.sessions add column canonical_stamp text not null check(canonical_stamp ~ '^[a-f0-9]{64}$');

-- BEGIN reviewed source canonical-lock.inactive.sql
-- AI: INACTIVE prerequisite, not a migration and NEVER applied to hosted data.
-- Exact core FKs: all seven tables owner_id -> auth.users(id), NOT DEFERRABLE.
-- The owner key FOR UPDATE conflicts with FK KEY SHARE on inserts/key transfers,
-- even from noncooperating Sync writers. Existing/tombstoned rows are then locked
-- to cover UPDATE/restore/delete without any new FK check. No table SHARE lock.
-- Bound per-table lock count; any cap/timeout/deadlock aborts the whole transaction.
-- Managed Auth has RLS enabled/zero policies. A separate private exact-key helper
-- retains the EXISTING postgres management owner; guard/backend never gain bypass.
create function n88_private.lock_owner_key(p_owner uuid) returns void
language plpgsql security definer set search_path=pg_catalog as $$
begin
  if p_owner is null then raise exception 'n88_canonical_unavailable'; end if;
  perform id from auth.users where id=p_owner for update;
  if not found then raise exception 'n88_canonical_unavailable'; end if;
end;
$$;
revoke all on function n88_private.lock_owner_key(uuid) from public;
-- Backend gets EXECUTE + source SELECT only, no canonical/Auth UPDATE privileges.
create function n88_private.lock_canonical_sources(p_owner uuid,p_max integer) returns void
language plpgsql security definer set search_path = pg_catalog as $$
declare t text; n integer;
begin
  if p_owner is null or p_max is null or p_max<1 or p_max>10000 then raise exception 'n88_canonical_unavailable'; end if;
  perform set_config('n88.canonical_owner',p_owner::text,true);
  perform n88_private.lock_owner_key(p_owner);
  foreach t in array array['years','terms','sections','students','enrollments','teachings','items'] loop
    execute format('select count(*) from (select id from rakeezx.%I where owner_id=$1 order by id limit $2 for update) locked',t)
      into n using p_owner,p_max+1;
    if n>p_max then raise exception 'n88_canonical_unavailable'; end if;
  end loop;
end;
$$;
revoke all on function n88_private.lock_canonical_sources(uuid,integer) from public;
-- No frontend grant. Exact backend-role grant/owner set remains an activation diff.

-- BEGIN reviewed source auth-session.inactive.sql
-- AI: PROPOSAL ONLY. Never applied to hosted Auth. No tokens or user enumeration.
-- Existing supported management owner postgres (BYPASSRLS, NOT superuser) only.
-- Managed Auth tables retain their owner/RLS/zero policies. No new bypass grant.
-- Backend gets only exact-session helper EXECUTE, no Auth schema/table privileges.
create function n88_private.lock_current_session(p_user uuid,p_session uuid)
returns table(user_id uuid,session_id uuid)
language plpgsql security definer set search_path=pg_catalog as $$
begin
  perform u.id from auth.users u where u.id=p_user
    and (u.banned_until is null or u.banned_until<=clock_timestamp()) for share;
  if not found then return; end if;
  return query select s.user_id,s.id from auth.sessions s
    where s.id=p_session and s.user_id=p_user
    and (s.not_after is null or s.not_after>clock_timestamp()) for share of s;
end;
$$;
revoke all on function n88_private.lock_current_session(uuid,uuid) from public;
-- Migration must retain owner postgres; private EXECUTE only to n88_backend.
-- No refresh_tokens lookup, session writes, Auth setting or RLS change.

-- BEGIN reviewed source ingress.inactive.sql
-- AI: private source proposal ONLY; global N88 lock must already be held.
create table n88_private.ingress_receipts(nonce uuid primary key,expires_at bigint not null);
create index ingress_receipts_expiry on n88_private.ingress_receipts(expires_at);
revoke all on n88_private.ingress_receipts from public;
alter table n88_private.ingress_receipts enable row level security;
create function n88_private.consume_ingress(p_nonce uuid,p_expiry bigint) returns boolean
language plpgsql security definer set search_path=pg_catalog as $$
declare sec bigint:=extract(epoch from clock_timestamp())::bigint;
begin
  if p_nonce is null or p_expiry<=sec or p_expiry>sec+32 then return false; end if;
  delete from n88_private.ingress_receipts where expires_at<=sec;
  if (select count(*) from (select 1 from n88_private.ingress_receipts limit 10000) b)>=10000 then return false; end if;
  insert into n88_private.ingress_receipts values(p_nonce,p_expiry) on conflict do nothing;
  return found;
end;
$$;
revoke all on function n88_private.consume_ingress(uuid,bigint) from public;

-- BEGIN reviewed source roles.inactive.sql
-- AI: EXACT PROPOSAL ONLY; requires separate hosted schema/Auth permission.
-- Fresh private tables only; do not apply/reapply by guessing migration history.
create role n88_guard nologin noinherit;
-- Provision n88_backend LOGIN/password by the approved secret custodian, never SQL evidence.
-- No new subscription/account. n88_backend must be a narrowly scoped DB role,
-- not service_role/postgres. This script assumes that approved role exists.
grant usage on schema rakeezx,n88_private to n88_guard;
-- Existing postgres owner alone operates Auth exact-key locks under managed RLS.
-- Never create Auth policies, change its ownership or grant guard/backend bypass.
grant execute on function n88_private.lock_owner_key(uuid) to n88_guard;
grant select(owner_id,id),update(id) on rakeezx.years,rakeezx.terms,rakeezx.sections,
  rakeezx.students,rakeezx.enrollments,rakeezx.teachings,rakeezx.items to n88_guard;
grant select,insert,delete on n88_private.ingress_receipts to n88_guard;
create policy n88_guard_receipts on n88_private.ingress_receipts to n88_guard using(true) with check(true);
grant usage on schema n88_private,rakeezx to n88_backend;
grant select(owner_id,id,status,deleted_at,revision) on rakeezx.years to n88_backend;
grant select(owner_id,id,year_id,status,deleted_at,revision) on rakeezx.terms,rakeezx.sections to n88_backend;
grant select(owner_id,id,name,status,deleted_at,revision) on rakeezx.students to n88_backend;
grant select(owner_id,id,section_id,student_id,revision,status,end_date,deleted_at) on rakeezx.enrollments to n88_backend;
grant select(owner_id,id,section_id,term_id,deleted_at,revision) on rakeezx.teachings to n88_backend;
grant select(owner_id,id,teaching_id,name,auto,deleted_at,revision) on rakeezx.items to n88_backend;
grant select,insert,update,delete on n88_private.contexts,n88_private.memberships,n88_private.credentials,
  n88_private.sessions,n88_private.publications,n88_private.guess_budgets to n88_backend;
do $$ declare t text;begin
  foreach t in array array['contexts','memberships','credentials','sessions','publications','guess_budgets'] loop
    execute format('create policy n88_backend_only on n88_private.%I to n88_backend using(true) with check(true)',t);
  end loop;
end $$;
-- Canonical RLS remains enabled. These ADDED policies name only private roles;
-- original authenticated owner policies and all Sync guards remain unchanged.
-- GUC is transaction-local and set by the fixed owner-lock helper. The backend
-- is a trusted server role; it must never be issued to a browser or API caller.
do $$ declare t text;begin
  foreach t in array array['years','terms','sections','students','enrollments','teachings','items'] loop
    execute format('create policy n88_canonical_read on rakeezx.%I for select to n88_backend using(owner_id::text=current_setting(''n88.canonical_owner'',true))',t);
    execute format('create policy n88_guard_lock on rakeezx.%I to n88_guard using(owner_id::text=current_setting(''n88.canonical_owner'',true)) with check(false)',t);
  end loop;
end $$;
-- Helper ownership is NOT a login membership or a grant to browser roles.
-- Grant while existing postgres still owns the functions. Ownership transfer
-- rewrites the grantor for guard-owned helpers without requiring superuser.
grant execute on function n88_private.lock_canonical_sources(uuid,integer),
  n88_private.lock_current_session(uuid,uuid),n88_private.consume_ingress(uuid,bigint) to n88_backend;
grant create on schema n88_private to n88_guard;
-- PG17 CREATEROLE grants creator ADMIN but does not imply SET. Temporarily allow
-- ONLY existing postgres to transfer these two newly created private helpers.
grant n88_guard to postgres with set true;
alter function n88_private.lock_canonical_sources(uuid,integer) owner to n88_guard;
-- lock_owner_key and lock_current_session retain EXISTING postgres ownership.
alter function n88_private.consume_ingress(uuid,bigint) owner to n88_guard;
grant n88_guard to postgres with set false;
revoke create on schema n88_private from n88_guard;
-- Keep schema unexposed, no anon/authenticated grants. Backend has NO canonical
-- write/Auth/session-table access and no membership in n88_guard. Revoke inherited
-- privileges if existing role readback finds any; never silently broaden a role.

commit;
