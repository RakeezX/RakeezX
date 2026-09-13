-- READ-ONLY metadata checks. No users, students or Product records are queried.
-- Confirm project reference xlrubcwjqktzzunrvuns in the dashboard first.

-- Expected: one table, both RLS flags true, zero policies.
select c.relname,c.relrowsecurity,c.relforcerowsecurity,
  (select count(*) from pg_policy p where p.polrelid=c.oid) policy_count
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='rakeezx' and c.relname='student_lifecycle_receipts';

-- Expected: owner_id uuid; mutation_id/student_id text; envelope/result jsonb;
-- created_at timestamptz. All NOT NULL; created_at defaults to clock_timestamp().
select column_name,data_type,is_nullable,column_default
from information_schema.columns
where table_schema='rakeezx' and table_name='student_lifecycle_receipts'
order by ordinal_position;

-- Expected: PK(owner_id,mutation_id), owner FK to auth.users ON DELETE CASCADE,
-- mutation_id length check 1..200. No existing Product constraint is changed.
select conname,pg_get_constraintdef(oid) definition
from pg_constraint where conrelid='rakeezx.student_lifecycle_receipts'::regclass and contype in ('p','f','c') order by conname;

-- Expected: all eight values false. Frontend cannot inspect/modify receipts.
select role_name,
  has_table_privilege(role_name,'rakeezx.student_lifecycle_receipts','SELECT') can_select,
  has_table_privilege(role_name,'rakeezx.student_lifecycle_receipts','INSERT') can_insert,
  has_table_privilege(role_name,'rakeezx.student_lifecycle_receipts','UPDATE') can_update,
  has_table_privilege(role_name,'rakeezx.student_lifecycle_receipts','DELETE') can_delete
from (values ('anon'),('authenticated')) roles(role_name);

-- Expected: authenticated true / anon false for the ONE public domain RPC.
select has_function_privilege('authenticated','rakeezx.apply_student_lifecycle_command(text,text,text,jsonb,bigint)','EXECUTE') authenticated,
  has_function_privilege('anon','rakeezx.apply_student_lifecycle_command(text,text,text,jsonb,bigint)','EXECUTE') anonymous;

-- Expected: seven new functions; empty search_path. Only the command RPC is
-- executable by authenticated. json_references_student is not SECURITY DEFINER.
select p.proname,pg_get_function_identity_arguments(p.oid) arguments,p.prosecdef,p.proconfig,
  has_function_privilege('authenticated',p.oid,'EXECUTE') authenticated_execute,
  has_function_privilege('anon',p.oid,'EXECUTE') anonymous_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='rakeezx' and p.proname in ('lock_student_lifecycle','json_references_student',
  'student_lifecycle_date','lock_student_lifecycle_statement',
  'guard_live_student_parent','pristine_student_blocker','apply_student_lifecycle_command')
order by p.proname;

-- Expected: 27 BEFORE STATEMENT gates, before any tuple/row-trigger locks.
-- Auth/Support/restore staging tables are intentionally excluded.
select c.relname,t.tgenabled,pg_get_triggerdef(t.oid) definition
from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
where n.nspname='rakeezx' and t.tgname='00_student_lifecycle_statement_lock' and not t.tgisinternal
order by c.relname;

-- Expected: three original SECURITY INVOKER compatibility RPCs, original
-- ACLs/signatures retained; first executable statement takes owner lock.
select p.proname,p.prosecdef,pg_get_functiondef(p.oid) definition
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='rakeezx' and p.proname in
  ('commit_enrollment_transfer','commit_enrollment_transfer_and_renumber','renumber_enrollment_roster')
order by p.proname;

-- Pure fixed-time conversion only: all four Saudi dates must be 2026-09-13.
-- DB timezone is informational; it cannot affect lifecycle dates.
select current_setting('TimeZone') database_timezone,
  rakeezx.student_lifecycle_date('2026-09-12T21:01:00Z'::timestamptz) at_0001,
  rakeezx.student_lifecycle_date('2026-09-12T23:59:00Z'::timestamptz) at_0259,
  rakeezx.student_lifecycle_date('2026-09-13T00:01:00Z'::timestamptz) at_0301,
  rakeezx.student_lifecycle_date('2026-09-13T10:00:00Z'::timestamptz) daytime;

-- Expected: 11 enabled BEFORE INSERT/UPDATE row triggers using the live-parent
-- guard. Their parent/snapshot/history checks depend on the table type.
select c.relname,t.tgenabled,pg_get_triggerdef(t.oid) definition
from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
where n.nspname='rakeezx' and t.tgname='00_student_lifecycle_safety' and not t.tgisinternal
order by c.relname;

-- Expected: 11 existing public RPC wrappers take the owner safety lock.
-- Their corresponding _before_student_0029 implementations remain present,
-- but are NOT executable by anon/authenticated. Review definitions for exact
-- comparison with the frozen migration; these contain code, not user records.
select p.proname,pg_get_function_identity_arguments(p.oid) arguments,p.prosecdef,p.proconfig,
  has_function_privilege('authenticated',p.oid,'EXECUTE') authenticated_execute,
  has_function_privilege('anon',p.oid,'EXECUTE') anonymous_execute,
  pg_get_functiondef(p.oid) definition
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='rakeezx' and (p.proname in (
  'apply_sync_v2_mutation','apply_sync_v2_enrollment_command','apply_sync_v2_attendance_command',
  'apply_sync_v2_fill_attendance_command','apply_sync_v2_class_goal_reward_command',
  'apply_sync_v2_closed_term_report_command','apply_sync_v2_lifecycle_command',
  'apply_sync_v2_section_lifecycle_command','apply_sync_v2_session_delete_command',
  'apply_sync_v2_teaching_creation_command','finalize_sync_v2_restore')
  or p.proname like '%\_before\_student\_0029' escape '\')
order by p.proname;

-- Full definitions of the two guards and domain command for exact review.
select pg_get_functiondef(p.oid) definition
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='rakeezx' and p.proname in (
  'guard_live_student_parent','pristine_student_blocker','apply_student_lifecycle_command')
order by p.proname;

-- Do NOT test behavior against real Product Owner records or invoke a delete.
-- Synthetic behavioral checks are deferred to the post-confirmation gate.
