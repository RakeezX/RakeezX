-- AI: read-only DATA readback plan, not auto-run or hosted authority.
-- Execute as the proposed backend role after separately approved prerequisites.
-- ROLLBACK releases all locks; no source rows or credential values are returned.
begin;
set local statement_timeout='3s';
set local lock_timeout='1s';
select n88_private.lock_canonical_sources();
select owner_id,id,status,deleted_at from rakeezx.years limit 0;
select owner_id,id,year_id,status,deleted_at from rakeezx.terms limit 0;
select owner_id,id,year_id,status,deleted_at from rakeezx.sections limit 0;
select owner_id,id,name,status,deleted_at from rakeezx.students limit 0;
select owner_id,id,section_id,student_id,revision,status,end_date,deleted_at from rakeezx.enrollments limit 0;
select owner_id,id,section_id,term_id,deleted_at from rakeezx.teachings limit 0;
select owner_id,id,teaching_id,name,auto,deleted_at from rakeezx.items limit 0;
select namespace,owner_id,active from n88_private.contexts limit 0;
select owner_id,class_id,student_id,enrollment_id,revision,active,status,end_date,student_active,class_active,label from n88_private.memberships limit 0;
select id,namespace,owner_id,student_id,version,verifier,entry_verifier,revoked_at from n88_private.credentials limit 0;
select id,credential_id,namespace,owner_id,class_id,student_id,enrollment_id,version,membership_revision,entry_verifier,token_hash,expires_at,revoked_at from n88_private.sessions limit 0;
select id,owner_id,class_id,student_id,enrollment_id,source_teaching_id,source_item_id,title,instruction,deadline,status,published from n88_private.publications limit 0;
select key,count,until_at from n88_private.guess_budgets limit 0;
-- Read only fixed privilege facts; do not dump policies/roles/users/secrets.
select not has_schema_privilege('anon','n88_private','USAGE') as anon_private_schema_denied,
       not has_schema_privilege('authenticated','n88_private','USAGE') as authenticated_private_schema_denied;
rollback;
