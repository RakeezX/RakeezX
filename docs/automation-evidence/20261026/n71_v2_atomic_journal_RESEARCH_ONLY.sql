-- N71 V2 ORIGINAL-PROTOCOL INCREMENT — RESEARCH ONLY. NEVER DEPLOYED.
-- Model the existing N71_V1 stage->finalize->durable receipt semantics for
-- TWO additive V2 sidecar tables, using the exact isolated V2 draft schema.
-- This is NOT a Production migration or replacement N71 RPC.
-- Runs ONLY inside an ephemeral PGlite test database.
begin;
create table rakeezx.n71_v2_research_owner_revision (
  owner_id uuid primary key,
  revision bigint not null default 0 check (revision >= 0)
);
create table rakeezx.n71_v2_research_journal (
  owner_id uuid not null,
  restore_id text not null,
  backup_hash text not null,
  stage_hash text not null,
  source_revision bigint not null,
  source_digest text not null check (source_digest ~ '^[0-9a-f]{64}$'),
  envelope jsonb not null,
  state text not null default 'staged'
    check (state in ('staged','finalized')),
  result jsonb,
  created_at timestamptz not null default clock_timestamp(),
  primary key(owner_id,restore_id),
  check (length(restore_id) between 1 and 160),
  check (stage_hash ~ '^[0-9a-f]{64}$'),
  check (backup_hash ~ '^[0-9a-f]{64}$')
);
alter table rakeezx.n71_v2_research_owner_revision enable row level security;
alter table rakeezx.n71_v2_research_journal enable row level security;
create policy n71_v2_research_owner_revision_only
  on rakeezx.n71_v2_research_owner_revision for all to authenticated
  using (owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
create policy n71_v2_research_journal_only
  on rakeezx.n71_v2_research_journal for all to authenticated
  using (owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
revoke all on rakeezx.n71_v2_research_owner_revision from public,anon,authenticated;
revoke all on rakeezx.n71_v2_research_journal from public,anon,authenticated;
grant select on rakeezx.n71_v2_research_owner_revision to authenticated;
grant select on rakeezx.n71_v2_research_journal to authenticated;

-- Server-computed SOURCE CONTENT fingerprint. Owner revision alone is not
-- proof that a direct owned update did not modify an existing sidecar.
create function rakeezx.n71_v2_research_source_digest(
  p_owner uuid default auth.uid()
) returns text
language plpgsql stable security definer set search_path = '' as $digest$
declare
  v_owner uuid:=auth.uid();
  v_manifest jsonb;
begin
  if v_owner is null or p_owner is distinct from v_owner then
    raise exception 'Source digest owner mismatch' using errcode='42501';
  end if;
  select pg_catalog.jsonb_build_object(
    'scopes',(select coalesce(pg_catalog.jsonb_agg(
        pg_catalog.to_jsonb(s) order by s.id),'[]'::jsonb)
      from rakeezx.section_curriculum_scopes s where s.owner_id=v_owner),
    'bindings',(select coalesce(pg_catalog.jsonb_agg(
        pg_catalog.to_jsonb(b) order by b.id),'[]'::jsonb)
      from rakeezx.teaching_course_bindings b where b.owner_id=v_owner)
  ) into v_manifest;
  return pg_catalog.encode(pg_catalog.sha256(
    pg_catalog.convert_to(v_manifest::text,'UTF8')),'hex');
end;
$digest$;

create function rakeezx.n71_v2_research_stage(
  p_restore_id text,
  p_backup_hash text,
  p_expected_owner_revision bigint,
  p_expected_source_digest text,
  p_envelope jsonb
) returns jsonb
language plpgsql security definer set search_path = '' as $stage$
declare
  v_owner uuid:=auth.uid();
  v_existing rakeezx.n71_v2_research_journal%rowtype;
  v_stage_hash text;
  v_owner_revision bigint;
  v_scopes int;
  v_bindings int;
begin
  if v_owner is null then
    raise exception 'Authenticated owner required' using errcode='42501';
  end if;
  if length(coalesce(p_restore_id,'')) not between 1 and 160
    or p_backup_hash !~ '^[0-9a-f]{64}$'
    or p_expected_owner_revision is null or p_expected_owner_revision<0
    or p_expected_source_digest !~ '^[0-9a-f]{64}$'
    or pg_catalog.jsonb_typeof(p_envelope)<>'object'
    or pg_catalog.jsonb_typeof(p_envelope->'scopes')<>'array'
    or pg_catalog.jsonb_typeof(p_envelope->'bindings')<>'array'
    or exists (select 1 from pg_catalog.jsonb_object_keys(p_envelope) k
      where k not in ('scopes','bindings')) then
    raise exception 'Invalid V2 staged envelope' using errcode='22023';
  end if;
  v_scopes:=pg_catalog.jsonb_array_length(p_envelope->'scopes');
  v_bindings:=pg_catalog.jsonb_array_length(p_envelope->'bindings');
  if v_scopes>1000 or v_bindings>3000 or
     v_scopes+v_bindings<1 or
     length(p_envelope::text)>500000 then
    raise exception 'V2 staged envelope exceeds declared bounds' using errcode='22023';
  end if;
  if exists (
    select 1 from (
      select r->>'id' id,count(*) n
        from pg_catalog.jsonb_array_elements(p_envelope->'scopes') r
        group by 1 having count(*)>1 or max(r->>'id') is null
      union all
      select r->>'id',count(*) from pg_catalog.jsonb_array_elements(p_envelope->'bindings') r
        group by 1 having count(*)>1 or max(r->>'id') is null
    ) invalid
  ) or exists (
    select 1 from pg_catalog.jsonb_array_elements(
      (p_envelope->'scopes')||(p_envelope->'bindings')) r
      where r->>'owner_id' is distinct from v_owner::text or
        (r->>'edition_year_verified')::boolean is distinct from false or
        r->>'deleted_at' is not null or
        (r->>'client_updated_at')::bigint is null or
        (r->>'client_updated_at')::bigint<=0
  ) then
    raise exception 'V2 staged rows are not owned live drafts' using errcode='42501';
  end if;
  v_stage_hash:=pg_catalog.encode(pg_catalog.sha256(
    pg_catalog.convert_to(
      'N71_V2_RESEARCH_1:'||v_owner::text||':'||p_restore_id||':'||
      p_backup_hash||':'||p_expected_owner_revision::text||':'||
      p_expected_source_digest||':'||p_envelope::text,'UTF8')),'hex');
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_owner::text||':N71_V2_RESEARCH',0));
  select * into v_existing from rakeezx.n71_v2_research_journal
    where owner_id=v_owner and restore_id=p_restore_id;
  if found then
    if (v_existing.backup_hash,v_existing.stage_hash,v_existing.source_revision)
       is distinct from (p_backup_hash,v_stage_hash,p_expected_owner_revision) then
      raise exception 'Restore ID reused with different content' using errcode='22023';
    end if;
    return pg_catalog.jsonb_build_object(
      'protocol','N71_V2_RESEARCH_ONLY','restoreId',p_restore_id,
      'backupHash',p_backup_hash,'stageHash',v_stage_hash,
      'sourceDigest',v_existing.source_digest,'state',v_existing.state);
  end if;
  select revision into v_owner_revision from rakeezx.n71_v2_research_owner_revision
    where owner_id=v_owner for update;
  if not found then
    raise exception 'Owner revision not verified' using errcode='42501';
  end if;
  if v_owner_revision<>p_expected_owner_revision or
     rakeezx.n71_v2_research_source_digest(v_owner) is distinct from p_expected_source_digest then
    raise exception 'Canonical source changed before N71 V2 stage' using errcode='40001';
  end if;
  insert into rakeezx.n71_v2_research_journal(
    owner_id,restore_id,backup_hash,stage_hash,source_revision,source_digest,envelope)
    values(v_owner,p_restore_id,p_backup_hash,v_stage_hash,
      p_expected_owner_revision,p_expected_source_digest,p_envelope);
  return pg_catalog.jsonb_build_object(
    'protocol','N71_V2_RESEARCH_ONLY','restoreId',p_restore_id,
    'backupHash',p_backup_hash,'stageHash',v_stage_hash,
    'sourceDigest',p_expected_source_digest,'state','staged');
end;
$stage$;


-- Same N71_V1 semantic: finalization is receipt-idempotent after commit.
-- This phase is INSERT-ONLY for verified new V2 scope/binding records; it does
-- not silently patch existing identities or revive deleted records.
create function rakeezx.n71_v2_research_finalize(
  p_restore_id text,
  p_backup_hash text,
  p_expected_stage_hash text
) returns jsonb
language plpgsql security definer set search_path = '' as $finalize$
declare
  v_owner uuid:=auth.uid();
  v_stage rakeezx.n71_v2_research_journal%rowtype;
  v_revision bigint;
  v_scopes int;
  v_bindings int;
  v_canonical jsonb;
  v_canonical_hash text;
  v_receipt jsonb;
begin
  if v_owner is null then
    raise exception 'Authenticated owner required' using errcode='42501';
  end if;
  if p_expected_stage_hash !~ '^[0-9a-f]{64}$'
    or p_backup_hash !~ '^[0-9a-f]{64}$'
    or length(coalesce(p_restore_id,'')) not between 1 and 160 then
    raise exception 'Invalid finalize request' using errcode='22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_owner::text||':N71_V2_RESEARCH',0));
  select * into v_stage from rakeezx.n71_v2_research_journal
    where owner_id=v_owner and restore_id=p_restore_id for update;
  if not found or (v_stage.backup_hash,v_stage.stage_hash)
    is distinct from (p_backup_hash,p_expected_stage_hash) then
    raise exception 'Unknown or mismatched staged restore' using errcode='22023';
  end if;
  if v_stage.state='finalized' then
    if v_stage.result is null or
      v_stage.result->>'protocol' is distinct from 'N71_V2_RESEARCH_ONLY' then
      raise exception 'Finalized receipt is inconsistent' using errcode='23514';
    end if;
    return v_stage.result;
  end if;
  select revision into v_revision from rakeezx.n71_v2_research_owner_revision
    where owner_id=v_owner for update;
  if not found then
    raise exception 'Owner revision unavailable' using errcode='42501';
  end if;
  if v_revision<>v_stage.source_revision or
     rakeezx.n71_v2_research_source_digest(v_owner) is distinct from v_stage.source_digest then
    raise exception 'Canonical source changed after N71 V2 staging'
      using errcode='40001';
  end if;

  -- PostgreSQL applies both batches atomically in ONE function statement.
  -- The V2 migration's owner/composite FKs and tombstone triggers enforce
  -- cohort/course identity; an invalid second INSERT rolls back the first.
  insert into rakeezx.section_curriculum_scopes (
    id,owner_id,section_id,year_id,program_key,stage_key,level_key,
    track_key,edition_key,source_url,client_updated_at,device_id
  )
  select x.id,v_owner,x.section_id,x.year_id,x.program_key,x.stage_key,
    x.level_key,x.track_key,x.edition_key,x.source_url,
    x.client_updated_at,'n71-v2-research:'||p_restore_id
  from pg_catalog.jsonb_to_recordset(v_stage.envelope->'scopes') as x(
    id text,owner_id uuid,section_id text,year_id text,program_key text,
    stage_key text,level_key text,track_key text,edition_key text,
    source_url text,client_updated_at bigint
  );
  get diagnostics v_scopes=row_count;
  insert into rakeezx.teaching_course_bindings (
    id,owner_id,section_id,section_scope_id,teaching_id,subject_id,
    term_id,course_source_key,course_name,course_kind,source_page,
    source_url,source_edition,client_updated_at,device_id
  )
  select x.id,v_owner,x.section_id,x.section_scope_id,
    x.teaching_id,x.subject_id,x.term_id,x.course_source_key,
    x.course_name,x.course_kind,x.source_page,x.source_url,
    x.source_edition,x.client_updated_at,
    'n71-v2-research:'||p_restore_id
  from pg_catalog.jsonb_to_recordset(v_stage.envelope->'bindings') as x(
    id text,owner_id uuid,section_id text,section_scope_id text,
    teaching_id text,subject_id text,term_id text,course_source_key text,
    course_name text,course_kind text,source_page int,source_url text,
    source_edition text,client_updated_at bigint
  );
  get diagnostics v_bindings=row_count;

  update rakeezx.n71_v2_research_owner_revision
    set revision=revision+1 where owner_id=v_owner
    returning revision into v_revision;

  select pg_catalog.jsonb_build_object(
    'scopes',(select coalesce(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(s) order by s.id),
      '[]'::jsonb) from rakeezx.section_curriculum_scopes s where s.owner_id=v_owner),
    'bindings',(select coalesce(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(b) order by b.id),
      '[]'::jsonb) from rakeezx.teaching_course_bindings b where b.owner_id=v_owner)
  ) into v_canonical;
  v_canonical_hash:=pg_catalog.encode(pg_catalog.sha256(
    pg_catalog.convert_to(v_canonical::text,'UTF8')),'hex');

  v_receipt:=pg_catalog.jsonb_build_object(
    'protocol','N71_V2_RESEARCH_ONLY',
    'restoreId',p_restore_id,
    'backupHash',p_backup_hash,
    'stageHash',p_expected_stage_hash,
    'ownerRevision',v_revision,
    'canonicalDigest',v_canonical_hash,
    'receipt',pg_catalog.jsonb_build_object(
      'restoreId',p_restore_id,'status','finalized',
      'addedScopes',v_scopes,'addedBindings',v_bindings)
  );
  update rakeezx.n71_v2_research_journal
    set state='finalized',result=v_receipt
    where owner_id=v_owner and restore_id=p_restore_id;
  return v_receipt;
end;
$finalize$;
revoke all on function rakeezx.n71_v2_research_source_digest(uuid)
  from public,anon,authenticated;
grant execute on function rakeezx.n71_v2_research_source_digest(uuid)
  to authenticated;
revoke all on function rakeezx.n71_v2_research_stage(text,text,bigint,text,jsonb)
  from public,anon,authenticated;
revoke all on function rakeezx.n71_v2_research_finalize(text,text,text)
  from public,anon,authenticated;
grant execute on function rakeezx.n71_v2_research_stage(text,text,bigint,text,jsonb)
  to authenticated;
grant execute on function rakeezx.n71_v2_research_finalize(text,text,text)
  to authenticated;
commit;
