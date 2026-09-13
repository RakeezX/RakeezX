# Migration 0030 — corrected frozen manual handoff (0087)

STATUS: PASS — LOCAL HANDOFF ONLY.
NO REMOTE MIGRATION. NO SOURCE PROMOTION. NO HISTORY REPAIR EXECUTED.

Production source remains `74309ac606321fc7d0a458b20bc7b98bc1cd49d5`.
Correct Production Supabase project: `xlrubcwjqktzzunrvuns`; Product schema: `rakeezx`.
Work-Active was neither read nor modified in this ticket. Do not apply SQL to another project.

## Live diagnosis and confirmed error sequence

Metadata-only inspection of `xlrubcwjqktzzunrvuns` confirms:
- Neither new 0030 function exists (including alternate signatures); no 0030 migration-history entry exists.
- Live execution source SHA256 after CRLF-to-LF normalization is `5160b50798e8c92c30d66d5db7dab31c8e636c5549e90f7bd4a57719f1054e32`, EXACTLY the approved 0029 and original PRECHECK expectation.
- SECURITY DEFINER, VOLATILE, empty search_path, non-strict, unsafe parallel, no defaults, jsonb result, postgres owner, unchanged five named arguments; ACL is owner + authenticated EXECUTE, no anon/PUBLIC EXECUTE.
- No renamed lifecycle implementation wrapper remains. Owner auth, supported commands, locks, pristine/source/revision/archive checks and receipt logic are unchanged.
- Revised live read-only PRECHECK succeeds. Security fingerprint remains `18fa8c7a905e4dc5072924798d8a4af3b1a750e744318128baae5e33aa28f8a6`.

No live semantic or privilege drift was found. Line endings are harmless formatting, not semantic drift.
Product Owner confirmed in 0087: PRECHECK passed, the then-frozen migration SHA was verified locally, and the migration file ALONE failed in the SQL Editor. No postcheck or combined script was run. Confirmed failure location: MIGRATION EXECUTION.
The retained old migration artifact does not contain the reported `MIGRATION_0030_VERIFY_DEFINITION_OR_PRIVILEGE_DRIFT` error string. This artifact discrepancy is a forensic limitation, NOT grounds to override the confirmed manual sequence or to infer unsafe live drift.
The exact historical false-positive branch cannot be reconstructed from retained files alone. The evidence rules out current live body/privilege drift; it does not prove that line endings caused the historical failure. A separate local postcheck-before-install reproduction has the same message but is NOT the confirmed incident's cause.
The corrected package verifies the actual approved baseline and deterministic transformation before DDL, normalizes only CRLF/LF, checks the compiled replacement exactly and verifies all five functions before COMMIT. No drift guard is removed or bypassed.
READY FOR MANUAL RETRY: YES, using only this corrected package and the mandatory precheck → complete migration → postcheck order. The unknown historical branch is recorded but does not prevent this independently validated, fail-closed retry.

No Product rows were inspected. No remote migration, history repair, live function alteration, source promotion or Work-Active access occurred.

## 0086 validation evidence

Focused client/server, frozen handoff and drift safety tests: 53/53 PASS.
Isolated real-PostgreSQL concurrency/two-device tests: 10/10 PASS.
Build Meta tests: 4/4 PASS. No second build was needed for migration/check-only changes; existing single-build evidence is retained.
Revised PRECHECK executed successfully against live catalogs; unchanged security fingerprint matched the saved manual value.
No live lifecycle or preview command was executed. 0087 confirms the prior sequence and releases the manual-retry hold; the migration/precheck/postcheck SQL bytes and their validation evidence are unchanged from 0086.

## Exact freeze

Filename: `supabase/migrations/0030_student_removal_preview.sql`

SHA256: `a368b7e343884a9406eda26206e13ecb36107cb70dd14525ce5dfbe778d68d4d`

Old migration SHA `e067c91fb3afec46096db130a59cf420f43aa258a7f93d8542e0a4591181d2ad` is INVALIDATED / SUPERSEDED. Do not apply that package.
This revision changes migration/precheck/postcheck safety checks only; installed preview/execution semantics remain the reviewed 0084 contract.
Any handed-off SQL file change invalidates this package freeze and requires a new reviewed handoff and SHA for the changed file. A migration change always requires a new migration SHA.

Precheck SQL SHA256: `e4cd9b6dcc1cfba2cdfeb11b55b1618e16393fbce9c678058d3eb5d2956474ea`.
Post-apply verification SQL SHA256: `7f9d01dc8c61deed3c0a1d35810d0c654750e3612b10c00c5af8d281e517306e`.
The SQL below is complete. Line endings may be normalized by the Dashboard; verification normalizes CRLF to LF only, not whitespace or SQL tokens.
Do not modify, partially run, remove the transaction, or automatically rerun this SQL.

## Installation effect and safety

Additive/non-destructive delivery: two functions added and one existing function narrowly refactored.
No Product/student row is read, inserted, rewritten, backfilled, ended, tombstoned or deleted DURING INSTALLATION.
Installation reads `pg_proc` metadata and existing function definition text only.
CREATE FUNCTION stores the preview/helper bodies; it does not execute their student queries.
No student lifecycle RPC, delete command, end-enrollment command or transfer is called during installation.
No tables, columns, indexes, policies, RLS settings or triggers are added/changed.

- NEW private `rakeezx.student_removal_source_blocker(uuid,text,text,bigint)`: exact source enrollment checks extracted from 0029. SECURITY DEFINER, empty search_path; PUBLIC/anon/authenticated EXECUTE revoked.
- NEW public-to-authenticated RPC `rakeezx.preview_student_removal(text,text,bigint)`: owner from auth.uid(), existing owner advisory boundary, readonly classification. SECURITY DEFINER, empty search_path, VOLATILE for fresh post-lock reads. Only explicit grant is authenticated EXECUTE; PUBLIC/anon revoked. No frontend table grants.
- CHANGED `rakeezx.apply_student_lifecycle_command(text,text,text,jsonb,bigint)`: existing end-enrollment source-check block calls the shared helper. Existing signature, ownership, ACL, receipts, command validation, locks, actual writes, rejection codes and pristine execution guard retained.
- UNCHANGED 0029 `pristine_student_blocker`, owner lock, guards/triggers and transfer RPCs.
- Database owners/privileged server operators retain normal administrative access. Verification permits existing service_role administrative ACLs, not extra frontend roles. No service-role credentials are introduced.

The source-check replacement is restricted to exactly one reviewed block. A missing/drifted block raises `MIGRATION_0030_SOURCE_CHECK_PRECONDITION_FAILED`.
The precheck AND installation verify complete normalized 0029 bodies, attributes and privileges before any DDL.
PRECHECK also dry-runs the exact definition transformation without executing DDL; only the reviewed post-transform body hash is accepted.
The replacement normalizes CRLF/LF in the original body, definition and replacement fragments. It requires exactly one source block and one body occurrence in the definition.
After CREATE OR REPLACE, the compiled body must equal the intended replacement exactly. The complete five-function postcondition runs INSIDE the migration transaction before COMMIT.
Failed compilation, no-op replacement, unexpected ACL/attribute/body changes all abort installation atomically.
Existing 0029 execution behavior is preserved; preview does not weaken or replace execution authorization.

## Transaction, locks and rollback boundaries

The entire installation is one explicit BEGIN/COMMIT transaction with LOCAL lock_timeout = 10 seconds.
Any precondition/DDL/permission/lock-timeout error aborts the transaction; none of the new functions/refactor becomes committed.
If the SQL Editor leaves an aborted transaction open, use `ROLLBACK;` to release it, then report the error; do not remove the checks.
Duplicate function creation on a repeated installation is also an error, not an idempotent replay.

Installation takes normal transactional catalog/DDL locks, NOT student/owner lifecycle locks and NOT Product row locks.
The installed preview takes only the existing owner-scoped advisory transaction lock during runtime, then fresh reads. It writes no Product rows or receipts.
That lock is released when the RPC transaction ends; preview reserves no future removal action.

Before COMMIT: ordinary transaction rollback reverses the whole installation.
After COMMIT: no automatic rollback/down migration is included. Technically reversible through a separately reviewed transaction restoring the exact prior execution body/ACL, removing the preview RPC and then its private helper. Never remove the helper while execution depends on it.
Do not run history repair --status reverted as a SQL rollback: history repair does not undo SQL.
Any post-COMMIT revert must be approved and coordinated with runtime source compatibility. No data recovery/undo promise is introduced.

## Exact manual order

1. Confirm the Dashboard is the Production project `xlrubcwjqktzzunrvuns`. Confirm 0029 is installed and no other database/security changes are being applied concurrently.
2. Run the complete `supabase/precheck-0030-student-removal-preview.sql` in the Dashboard. It is metadata-only and explicitly READ ONLY. Require `REVIEWED_0029_BASELINE_PASS` AND `DETERMINISTIC_SOURCE_TRANSFORM_PASS`; save its `security_metadata_sha256` result. Require the saved approved fingerprint `18fa8c7a905e4dc5072924798d8a4af3b1a750e744318128baae5e33aa28f8a6`; if it differs, STOP for metadata drift review before application, rather than silently rebaseline it.
3. If precheck fails or says 0030 already partly/fully exists: STOP, report results, and do not overwrite/reapply. Already-installed matching SQL needs verification/history alignment, not replay.
4. In a separate SQL Editor script, apply the COMPLETE frozen migration SQL below once. Do not combine or interleave precheck/postcheck with migration statements. Require successful COMMIT; internal postconditions must succeed before COMMIT.
5. Run the complete `supabase/verify-0030-student-removal-preview.sql`. Require `FROZEN_FUNCTION_DEFINITIONS_AND_PRIVILEGES_PASS` AND an identical `security_metadata_sha256` to step 2.
6. If either condition fails: STOP before history repair/source promotion. A fingerprint mismatch can also indicate concurrent unrelated administrative DDL; do not silently accept or rebaseline it.
7. Report successful application, both verification results, matching pre/post fingerprint and correct project to Codex. No real student commands are needed.
8. Only AFTER SQL and metadata verification both succeed, align migration history through the supported linked CLI below.
9. Verify normal history lists 0030 locally and remotely. Source promotion remains held until these gates succeed.

The security fingerprint covers schema/table/column ACLs, RLS/force-RLS, policies, default grants and triggers. It does NOT include function bodies: the separate function assertions and transformation dry run must also PASS. It reads catalogs only and returns a hash, not Product data.
Without the saved pre-apply fingerprint, post-apply function checks alone cannot prove unchanged grants/policies/triggers.

## Exact server preview contract

Inputs: student identity, exact current source enrollment identity, current source revision.
No client-selected outcome, owner, evidence payload, mutation ID or preview token is accepted.

Successful authenticated RPC returns ONLY `{ outcome, reason, retryable }`:

| outcome | reason | retryable |
| --- | --- | --- |
| delete_pristine | pristine | false |
| end_enrollment | history_exists | false |
| blocked | invalid_source | false |
| blocked | student_unavailable | true |
| blocked | student_deleted | false |
| blocked | stale_source | true |
| blocked | archived_enrollment | false |

Missing/wrong-owner identities share student_unavailable; no evidence rows or private contents are returned.
Unauthenticated/anon callers are denied, not given access to preview data.
Internal pristine reason categories (attendance, score, note, report, etc.) are reduced to history_exists.

Client helper additionally maps local protected evidence to `end_enrollment / local_protected_evidence / false` only after server establishes valid source and returns pristine.
Local readonly disk snapshots are taken before/after RPC; this-device local-only submissions arriving while waiting also prevent pristine classification.
Client blocked vocabulary additionally includes auth_required, offline, sync_not_ready, preview_unavailable. Errors are sanitized; offline outcome is never guessed.
Other-device local-only records cannot be queried; no global "never used" proof is claimed.
Retryable means a new preview may help after context changes, not a guarantee that mutation retry succeeds.

Preview performs ZERO Product mutation. It creates no receipt/checkpoint/lease and carries no stale authorization into execution.
Existing delete_pristine independently rechecks server/local pristine protection; end_enrollment independently rechecks active exact source/revision/archive conditions through the shared helper.
Another device can add protective history, transfer/end enrollment or delete after preview; execution can then reject/protect. A changed consequence requires refreshed preview/confirmation, not automatic client-selected fallback.

## Metadata-only verification scope

The post-apply file asserts all five relevant function identities, argument names/types, return types, language, SECURITY DEFINER, VOLATILE, empty search_path, no altered strict/set-returning/leakproof/default/parallel attributes, intended effective EXECUTE privileges and no unexpected overloads/frontend ACLs.
It checks exact SHA256 of each normalized stored function body, including the narrowly refactored execution definition and unchanged pristine/lock helpers.
Only CRLF-to-LF normalization is allowed; even a harmless body comment change fails the exact-definition gate.
No lifecycle commands or Product table rows are selected by either verification file.
The pre/post metadata fingerprints independently verify no unintended schema/table/column grants, policies or triggers changed.

## Migration-history alignment — DO NOT RUN NOW

From `D:\\Abdullah Projects\\RakeezX`, verify the existing link is `xlrubcwjqktzzunrvuns`.
After SQL application AND live metadata acceptance, run:

```powershell
supabase migration repair 0030 --status applied --linked
supabase migration list --linked
```

If CLI is normally invoked through npx, equivalent:
`npx supabase migration repair 0030 --status applied --linked`.

Repair marks the already-applied migration in tracking history ONLY; it does not apply SQL. Do not manually edit internal migration tables, use db push to replay the manual SQL, or repair history before verifying actual schema.
Existing CLI/management connectivity must be restored for this later step; nothing was retried or repaired remotely in 0085.

Supported references: [Supabase CLI migration repair](https://supabase.com/docs/reference/cli/su#supabase-migration-repair), [manual-history alignment guidance](https://supabase.com/docs/guides/deployment/database-migrations#step-3-if-the-migration-history-table-is-wrong).

## After Product Owner confirms manual application

- Read-only live metadata verification in the correct project, exact frozen intent plus saved security fingerprint.
- Supported history alignment only after acceptance; normal linked history check.
- Focused synthetic preview/client/server tests, stale-preview execution recheck and real local PostgreSQL two-device/concurrency tests.
- Preserve existing Production work and Work-Active. Reuse the single prior build only if candidate-bound evidence remains fresh; otherwise assess narrow revalidation.
- Commit/push narrow source only after migration/history gates; verify remote main and Cloudflare.
- Non-destructive Production boot/preview-availability smoke; never inspect or mutate Product Owner real student records.

Evidence retained from 0084: focused 46/46, two-device/concurrency 10/10, Build Meta 4/4, single build and diff check PASS.
0085 validates the manual scripts locally, including failures on source/security drift and unchanged Product/security metadata. No broad suites, build, source commit, push or deploy in this handoff ticket.

## FULL FROZEN MIGRATION SQL

```sql
-- STUDENT-REMOVAL-PREVIEW-RUNTIME-01. No Product writes or new table grants.
begin;
set local lock_timeout = '10s';

-- Full reviewed baseline + deterministic transformation checked BEFORE any DDL.
-- CRLF/LF normalization only; no SQL tokens, comments or safety guards removed.
do $verify$ declare v_expected record; v_p record; v_oid oid;
begin
  if to_regprocedure('rakeezx.preview_student_removal(text,text,bigint)') is not null or
    to_regprocedure('rakeezx.student_removal_source_blocker(uuid,text,text,bigint)') is not null then
    raise exception 'MIGRATION_0030_ALREADY_PARTLY_OR_FULLY_INSTALLED: verify, do not reapply';
  end if;
  for v_expected in select * from (values
    ('rakeezx.apply_student_lifecycle_command(text,text,text,jsonb,bigint)','p_mutation_id text, p_device_id text, p_command text, p_payload jsonb, p_client_updated_at bigint','jsonb','plpgsql',true,'5160b50798e8c92c30d66d5db7dab31c8e636c5549e90f7bd4a57719f1054e32'),
    ('rakeezx.pristine_student_blocker(uuid,text)','p_owner uuid, p_student text','text','plpgsql',false,'af73a98a6655ddc42955306050b6ff89d89acecc9ff52f56a5727d0616ead740'),
    ('rakeezx.lock_student_lifecycle(uuid)','p_owner uuid','void','sql',false,'ab2e662a0824b4dea26a6f0d8e64dd793a6a7d26317b291170c46683d5304906')
  ) expected(signature,arguments,result_type,language,authenticated_execute,source_sha256) loop
    v_oid:=to_regprocedure(v_expected.signature);
    if v_oid is null then raise exception 'MIGRATION_0030_VERIFY_MISSING: %',v_expected.signature; end if;
    select p.*,l.lanname into v_p from pg_proc p join pg_language l on l.oid=p.prolang where p.oid=v_oid;
    if not v_p.prosecdef or v_p.provolatile<>'v' or v_p.proisstrict or v_p.proretset or v_p.proleakproof or
      v_p.proparallel<>'u' or v_p.pronargdefaults<>0 or
      v_p.proconfig is distinct from array['search_path=""'] or
      v_p.lanname<>v_expected.language or pg_get_function_result(v_oid)<>v_expected.result_type or
      pg_get_function_identity_arguments(v_oid)<>v_expected.arguments or
      encode(sha256(convert_to(replace(v_p.prosrc,chr(13)||chr(10),chr(10)),'UTF8')),'hex')<>v_expected.source_sha256 or
      has_function_privilege('authenticated',v_oid,'execute')<>v_expected.authenticated_execute or
      has_function_privilege('anon',v_oid,'execute') or
      exists(select 1 from aclexplode(coalesce(v_p.proacl,acldefault('f',v_p.proowner))) a
        where a.privilege_type='EXECUTE' and (a.grantee=0 or (a.grantee<>v_p.proowner and
          not exists(select 1 from pg_roles r where r.oid=a.grantee and
            (r.rolname='service_role' or (r.rolname='authenticated' and v_expected.authenticated_execute)))))) or
      exists(select 1 from pg_roles r where r.oid=v_p.proowner and r.rolname in ('authenticated','anon')) or
      (select count(*) from pg_proc p where p.pronamespace=v_p.pronamespace and p.proname=v_p.proname)<>1 then
      raise exception using message=format('MIGRATION_0030_VERIFY_DEFINITION_OR_PRIVILEGE_DRIFT: %s',v_expected.signature),
        detail=jsonb_build_object('expected_source_sha256',v_expected.source_sha256,
          'actual_source_sha256',encode(sha256(convert_to(replace(v_p.prosrc,chr(13)||chr(10),chr(10)),'UTF8')),'hex'),
          'security_definer',v_p.prosecdef,'search_path',v_p.proconfig,
          'authenticated_execute',has_function_privilege('authenticated',v_oid,'execute'),
          'anon_execute',has_function_privilege('anon',v_oid,'execute'),
          'acl',v_p.proacl::text)::text;
    end if;
  end loop;
end; $verify$;

-- Dry-run the exact source transformation against catalogs only; no DDL/RPC.
do $transform_precheck$ declare v_body text; v_definition text; v_rewritten text;
  v_old text := $old$    if not found or v_e.deleted_at is not null or v_e.status<>'active' or v_e.revision<>v_expected then
      v_outcome:='rejected'; v_code:='STALE_SOURCE_ENROLLMENT';
    elsif exists(select 1 from rakeezx.sections where owner_id=v_owner and id=v_e.section_id and (deleted_at is not null or status='archived')) then
      v_outcome:='protected'; v_code:='ARCHIVED_ENROLLMENT';$old$;
  v_new text := $new$    v_code:=rakeezx.student_removal_source_blocker(v_owner,v_student,v_source,v_expected);
    if v_code='STALE_SOURCE_ENROLLMENT' then
      v_outcome:='rejected';
    elsif v_code='ARCHIVED_ENROLLMENT' then
      v_outcome:='protected';$new$;
begin
  v_old:=replace(v_old,chr(13)||chr(10),chr(10));
  v_new:=replace(v_new,chr(13)||chr(10),chr(10));
  select replace(prosrc,chr(13)||chr(10),chr(10)),
    replace(pg_get_functiondef(oid),chr(13)||chr(10),chr(10)) into v_body,v_definition
    from pg_proc where oid='rakeezx.apply_student_lifecycle_command(text,text,text,jsonb,bigint)'::regprocedure;
  if v_body is null or position(v_old in v_body)=0 or
    (length(v_body)-length(replace(v_body,v_old,'')))/length(v_old)<>1 or
    position(v_body in v_definition)=0 or
    (length(v_definition)-length(replace(v_definition,v_body,'')))/length(v_body)<>1 then
    raise exception using errcode='22023',message='MIGRATION_0030_SOURCE_CHECK_PRECONDITION_FAILED';
  end if;
  v_rewritten:=replace(v_body,v_old,v_new);
  if encode(sha256(convert_to(v_rewritten,'UTF8')),'hex')<>
    '70119b55eda351b980d3ff15d76bc7baa0f6db51a7fee0f054f23a5f4d8c9a10' then
    raise exception using errcode='22023',message='MIGRATION_0030_TRANSFORM_PREFLIGHT_FAILED';
  end if;
end; $transform_precheck$;

-- Exact existing end-enrollment checks, shared by preview and execution.
create function rakeezx.student_removal_source_blocker(
  p_owner uuid,p_student text,p_source text,p_revision bigint
) returns text language plpgsql security definer set search_path='' as $$
declare v_e rakeezx.enrollments%rowtype;
begin
  select * into v_e from rakeezx.enrollments where owner_id=p_owner and id=p_source and student_id=p_student;
  if not found or v_e.deleted_at is not null or v_e.status<>'active' or v_e.revision<>p_revision then
    return 'STALE_SOURCE_ENROLLMENT';
  elsif exists(select 1 from rakeezx.sections where owner_id=p_owner and id=v_e.section_id and (deleted_at is not null or status='archived')) then
    return 'ARCHIVED_ENROLLMENT';
  end if;
  return null;
end; $$;
revoke all on function rakeezx.student_removal_source_blocker(uuid,text,text,bigint) from public,anon,authenticated;

-- Reuse the helper without changing receipts, locks, writes or rejection codes.
-- Abort the whole additive installation if the reviewed 0029 body has drifted.
do $install$ declare v_body text; v_definition text; v_rewritten text;
  v_old text := $old$    if not found or v_e.deleted_at is not null or v_e.status<>'active' or v_e.revision<>v_expected then
      v_outcome:='rejected'; v_code:='STALE_SOURCE_ENROLLMENT';
    elsif exists(select 1 from rakeezx.sections where owner_id=v_owner and id=v_e.section_id and (deleted_at is not null or status='archived')) then
      v_outcome:='protected'; v_code:='ARCHIVED_ENROLLMENT';$old$;
  v_new text := $new$    v_code:=rakeezx.student_removal_source_blocker(v_owner,v_student,v_source,v_expected);
    if v_code='STALE_SOURCE_ENROLLMENT' then
      v_outcome:='rejected';
    elsif v_code='ARCHIVED_ENROLLMENT' then
      v_outcome:='protected';$new$;
begin
  v_old:=replace(v_old,chr(13)||chr(10),chr(10));
  v_new:=replace(v_new,chr(13)||chr(10),chr(10));
  select replace(prosrc,chr(13)||chr(10),chr(10)),
    replace(pg_get_functiondef(oid),chr(13)||chr(10),chr(10)) into v_body,v_definition
    from pg_proc where oid='rakeezx.apply_student_lifecycle_command(text,text,text,jsonb,bigint)'::regprocedure;
  if v_body is null or position(v_old in v_body)=0 or
    (length(v_body)-length(replace(v_body,v_old,'')))/length(v_old)<>1 or
    position(v_body in v_definition)=0 or
    (length(v_definition)-length(replace(v_definition,v_body,'')))/length(v_body)<>1 then
    raise exception using errcode='22023',message='MIGRATION_0030_SOURCE_CHECK_PRECONDITION_FAILED';
  end if;
  v_rewritten:=replace(v_body,v_old,v_new);
  if encode(sha256(convert_to(v_rewritten,'UTF8')),'hex')<>
    '70119b55eda351b980d3ff15d76bc7baa0f6db51a7fee0f054f23a5f4d8c9a10' then
    raise exception using errcode='22023',message='MIGRATION_0030_TRANSFORM_PREFLIGHT_FAILED';
  end if;
  execute replace(v_definition,v_body,v_rewritten);
  select replace(prosrc,chr(13)||chr(10),chr(10)) into v_body
    from pg_proc where oid='rakeezx.apply_student_lifecycle_command(text,text,text,jsonb,bigint)'::regprocedure;
  if v_body is distinct from v_rewritten then
    raise exception using errcode='22023',message='MIGRATION_0030_COMPILED_TRANSFORM_MISMATCH';
  end if;
end; $install$;

-- VOLATILE intentionally: after waiting for the existing owner boundary, each
-- read must see the latest committed authority, not a pre-lock stable snapshot.
-- Advisory locks serialize reads with 0029 execution; no Product row is written.
create function rakeezx.preview_student_removal(
  p_student_id text,p_source_enrollment_id text,p_source_revision bigint
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_owner uuid:=auth.uid(); v_s rakeezx.students%rowtype; v_block text;
begin
  if v_owner is null then raise exception using errcode='42501',message='Authentication required'; end if;
  if coalesce(p_student_id,'')='' or char_length(p_student_id)>200 or
    coalesce(p_source_enrollment_id,'')='' or char_length(p_source_enrollment_id)>200 or p_source_revision is null then
    return jsonb_build_object('outcome','blocked','reason','invalid_source','retryable',false);
  end if;
  perform rakeezx.lock_student_lifecycle(v_owner);
  select * into v_s from rakeezx.students where owner_id=v_owner and id=p_student_id;
  if not found then
    return jsonb_build_object('outcome','blocked','reason','student_unavailable','retryable',true);
  elsif v_s.deleted_at is not null then
    return jsonb_build_object('outcome','blocked','reason','student_deleted','retryable',false);
  end if;
  v_block:=rakeezx.student_removal_source_blocker(v_owner,p_student_id,p_source_enrollment_id,p_source_revision);
  if v_block='STALE_SOURCE_ENROLLMENT' then
    return jsonb_build_object('outcome','blocked','reason','stale_source','retryable',true);
  elsif v_block='ARCHIVED_ENROLLMENT' then
    return jsonb_build_object('outcome','blocked','reason','archived_enrollment','retryable',false);
  end if;
  if rakeezx.pristine_student_blocker(v_owner,p_student_id) is not null then
    return jsonb_build_object('outcome','end_enrollment','reason','history_exists','retryable',false);
  end if;
  return jsonb_build_object('outcome','delete_pristine','reason','pristine','retryable',false);
end; $$;
revoke all on function rakeezx.preview_student_removal(text,text,bigint) from public,anon;
grant execute on function rakeezx.preview_student_removal(text,text,bigint) to authenticated;
-- Verify compiled bodies, attributes and effective privileges BEFORE COMMIT.
-- A failure here rolls back helper, preview and execution refactor together.
do $verify$ declare v_expected record; v_p record; v_oid oid;
begin
  for v_expected in select * from (values
    ('rakeezx.apply_student_lifecycle_command(text,text,text,jsonb,bigint)','p_mutation_id text, p_device_id text, p_command text, p_payload jsonb, p_client_updated_at bigint','jsonb','plpgsql',true,'70119b55eda351b980d3ff15d76bc7baa0f6db51a7fee0f054f23a5f4d8c9a10'),
    ('rakeezx.pristine_student_blocker(uuid,text)','p_owner uuid, p_student text','text','plpgsql',false,'af73a98a6655ddc42955306050b6ff89d89acecc9ff52f56a5727d0616ead740'),
    ('rakeezx.lock_student_lifecycle(uuid)','p_owner uuid','void','sql',false,'ab2e662a0824b4dea26a6f0d8e64dd793a6a7d26317b291170c46683d5304906'),
    ('rakeezx.preview_student_removal(text,text,bigint)','p_student_id text, p_source_enrollment_id text, p_source_revision bigint','jsonb','plpgsql',true,'5e549845fc9145073c3cd1714eb395a49f15b0361150e90498b792e8a7476c9c'),
    ('rakeezx.student_removal_source_blocker(uuid,text,text,bigint)','p_owner uuid, p_student text, p_source text, p_revision bigint','text','plpgsql',false,'23ad1c8c356e604ea2fdce490fb2c143b92e96d20baa747f5e120867c03d5483')
  ) expected(signature,arguments,result_type,language,authenticated_execute,source_sha256) loop
    v_oid:=to_regprocedure(v_expected.signature);
    if v_oid is null then raise exception 'MIGRATION_0030_VERIFY_MISSING: %',v_expected.signature; end if;
    select p.*,l.lanname into v_p from pg_proc p join pg_language l on l.oid=p.prolang where p.oid=v_oid;
    if not v_p.prosecdef or v_p.provolatile<>'v' or v_p.proisstrict or v_p.proretset or v_p.proleakproof or
      v_p.proparallel<>'u' or v_p.pronargdefaults<>0 or
      v_p.proconfig is distinct from array['search_path=""'] or
      v_p.lanname<>v_expected.language or pg_get_function_result(v_oid)<>v_expected.result_type or
      pg_get_function_identity_arguments(v_oid)<>v_expected.arguments or
      encode(sha256(convert_to(replace(v_p.prosrc,chr(13)||chr(10),chr(10)),'UTF8')),'hex')<>v_expected.source_sha256 or
      has_function_privilege('authenticated',v_oid,'execute')<>v_expected.authenticated_execute or
      has_function_privilege('anon',v_oid,'execute') or
      exists(select 1 from aclexplode(coalesce(v_p.proacl,acldefault('f',v_p.proowner))) a
        where a.privilege_type='EXECUTE' and (a.grantee=0 or (a.grantee<>v_p.proowner and
          not exists(select 1 from pg_roles r where r.oid=a.grantee and
            (r.rolname='service_role' or (r.rolname='authenticated' and v_expected.authenticated_execute)))))) or
      exists(select 1 from pg_roles r where r.oid=v_p.proowner and r.rolname in ('authenticated','anon')) or
      (select count(*) from pg_proc p where p.pronamespace=v_p.pronamespace and p.proname=v_p.proname)<>1 then
      raise exception using message=format('MIGRATION_0030_VERIFY_DEFINITION_OR_PRIVILEGE_DRIFT: %s',v_expected.signature),
        detail=jsonb_build_object('expected_source_sha256',v_expected.source_sha256,
          'actual_source_sha256',encode(sha256(convert_to(replace(v_p.prosrc,chr(13)||chr(10),chr(10)),'UTF8')),'hex'),
          'security_definer',v_p.prosecdef,'search_path',v_p.proconfig,
          'authenticated_execute',has_function_privilege('authenticated',v_oid,'execute'),
          'anon_execute',has_function_privilege('anon',v_oid,'execute'),
          'acl',v_p.proacl::text)::text;
    end if;
  end loop;
end; $verify$;
commit;
```
