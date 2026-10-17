-- AI: read-only DATA readback plan, not auto-run or hosted authority.
-- Execute as the proposed backend role after separately approved prerequisites.
-- ROLLBACK releases all locks; no source rows or credential values are returned.
begin;
set local statement_timeout='3s';
set local lock_timeout='1s';
-- No owner roster/session lookup. Separately approved fabricated fixture supplies
-- exact UUID args for lock_current_session/lock_canonical_sources behavior checks.
select owner_id,id,status,deleted_at,revision from rakeezx.years limit 0;
select owner_id,id,year_id,status,deleted_at,revision from rakeezx.terms limit 0;
select owner_id,id,year_id,status,deleted_at,revision from rakeezx.sections limit 0;
select owner_id,id,name,status,deleted_at,revision from rakeezx.students limit 0;
select owner_id,id,section_id,student_id,revision,status,end_date,deleted_at from rakeezx.enrollments limit 0;
select owner_id,id,section_id,term_id,deleted_at,revision from rakeezx.teachings limit 0;
select owner_id,id,teaching_id,name,auto,deleted_at,revision from rakeezx.items limit 0;
select namespace,owner_id,active from n88_private.contexts limit 0;
select owner_id,class_id,student_id,enrollment_id,revision,active,status,end_date,student_active,class_active,label,canonical_stamp from n88_private.memberships limit 0;
select id,namespace,owner_id,student_id,version,verifier,entry_verifier,revoked_at from n88_private.credentials limit 0;
select id,credential_id,namespace,owner_id,class_id,student_id,enrollment_id,version,membership_revision,entry_verifier,token_hash,expires_at,revoked_at,canonical_stamp from n88_private.sessions limit 0;
select id,owner_id,class_id,student_id,enrollment_id,source_teaching_id,source_item_id,title,instruction,deadline,status,published from n88_private.publications limit 0;
select key,count,until_at from n88_private.guess_budgets limit 0;
-- Read only fixed privilege facts; do not dump policies/roles/users/secrets.
select not has_schema_privilege('anon','n88_private','USAGE') as anon_private_schema_denied,
       not has_schema_privilege('authenticated','n88_private','USAGE') as authenticated_private_schema_denied;
-- Read as a separately authorized migration auditor (metadata only). An unexpected
-- FK/RLS/role/trigger identity is a prerequisite failure, never a flag to ignore.
select p.oid::regprocedure as helper,md5(pg_get_functiondef(p.oid)) as definition_identity,
  p.prosecdef,r.rolcanlogin,r.rolbypassrls
from pg_proc p join pg_roles r on r.oid=p.proowner
where p.oid in ('n88_private.lock_canonical_sources(uuid,integer)'::regprocedure,
  'n88_private.lock_current_session(uuid,uuid)'::regprocedure,'n88_private.consume_ingress(uuid,bigint)'::regprocedure);
select t.relname,count(c.oid) filter(where c.contype='f' and c.confrelid='auth.users'::regclass
  and not c.condeferrable and c.convalidated) as immediate_validated_owner_fks,t.relrowsecurity
from pg_class t left join pg_constraint c on c.conrelid=t.oid
where t.relnamespace='rakeezx'::regnamespace and t.relname in ('years','terms','sections','students','enrollments','teachings','items')
group by t.relname,t.relrowsecurity;
select not has_schema_privilege('n88_backend','auth','USAGE') as backend_auth_schema_denied,
  not has_table_privilege('n88_backend','auth.sessions','SELECT') as backend_session_scan_denied,
  not pg_has_role('n88_backend','n88_guard','MEMBER') as backend_guard_membership_denied;
select c.relname,t.tgname,md5(pg_get_triggerdef(t.oid)) as trigger_identity
from pg_trigger t join pg_class c on c.oid=t.tgrelid
where c.relnamespace='rakeezx'::regnamespace and c.relname in ('years','terms','sections','students','enrollments','teachings','items')
  and not t.tgisinternal;
rollback;
