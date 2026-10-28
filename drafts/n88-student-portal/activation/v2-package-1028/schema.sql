-- AI: INACTIVE LOCAL-GUARDED installation proposal. Never hosted under this card.
begin;
do $$begin
 if current_setting('n88.v2_package_install',true) is distinct from 'ee57b00d-1c90-4926-8819-77989368fcc1' or host(inet_server_addr()) is distinct from '127.0.0.1' or position('/artifacts/n88-backend-package-1028-' in replace(current_setting('data_directory'),chr(92),'/'))=0 then raise exception 'n88_v2_external_install_authority_required'; end if;
 if to_regrole('n88_v2_runtime') is not null or to_regclass('n88_private.publication_v2_scopes') is not null then raise exception 'n88_v2_install_collision_readback_required'; end if;
end$$;
-- BEGIN EXACT original storage proposal (transaction wrapper excluded)
-- AI-authored UNAPPLIED proposal. Not a migration, not a service activation.
-- New private objects only. Never run against a hosted DB under this card.
-- Synthetic scratch tests may execute this file. No roles/policies/grants created.
create schema if not exists n88_private;

create function n88_private.publication_v2_exact(v jsonb, keys text[]) returns boolean
language sql immutable strict security invoker set search_path=pg_catalog as $$
  select coalesce(jsonb_typeof(v)='object' and
    (select array_agg(k order by k) from jsonb_object_keys(v) k)=
    (select array_agg(k order by k) from unnest(keys) k), false)
$$;
create function n88_private.publication_v2_scope(v jsonb, owner uuid) returns boolean
language sql immutable strict security invoker set search_path=pg_catalog as $$
  select coalesce(n88_private.publication_v2_exact(v,array['ownerId','teachingId','sectionId','termId','subjectId']) and
    v->>'ownerId'=owner::text and not exists(select 1 from jsonb_each(v) x where jsonb_typeof(x.value)<>'string' or char_length(x.value#>>'{}') not between 1 and 200),false)
$$;
create function n88_private.publication_v2_flags(v jsonb) returns boolean
language sql immutable strict security invoker set search_path=pg_catalog as $$
  select coalesce(n88_private.publication_v2_exact(v,array['required','scheduled','completed','grade']) and
    not exists(select 1 from jsonb_each(v) x where jsonb_typeof(x.value)<>'boolean'),false)
$$;
create function n88_private.publication_v2_manual(v jsonb) returns boolean
language sql immutable strict security invoker set search_path=pg_catalog as $$
  select coalesce(jsonb_typeof(v)='array' and jsonb_array_length(v)<=2000 and not exists(
    select 1 from jsonb_array_elements(v) m where not n88_private.publication_v2_exact(m,array['id','title','description','startDate','dueDate','link']) or
      jsonb_typeof(m->'id')<>'string' or m->>'id' !~ '^[A-Za-z0-9_-]{1,100}$' or
      jsonb_typeof(m->'title')<>'string' or char_length(m->>'title') not between 1 and 200 or
      jsonb_typeof(m->'description')<>'string' or char_length(m->>'description')>2000 or
      not (m->'startDate'='null'::jsonb or jsonb_typeof(m->'startDate')='string' and m->>'startDate' ~ '^\d{4}-\d{2}-\d{2}$') or
      not (m->'dueDate'='null'::jsonb or jsonb_typeof(m->'dueDate')='string' and m->>'dueDate' ~ '^\d{4}-\d{2}-\d{2}$') or
      not (m->'link'='null'::jsonb or jsonb_typeof(m->'link')='string' and m->>'link' ~ '^https://' and char_length(m->>'link')<=2048)),false)
$$;

create table n88_private.publication_v2_scopes (
  owner_id uuid not null,
  scope_key text not null check(scope_key ~ '^[a-f0-9]{64}$'),
  store_revision bigint not null check(store_revision>0),
  payload jsonb not null check(octet_length(payload::text)<=2097152),
  primary key(owner_id,scope_key),
  check(n88_private.publication_v2_exact(payload,array['scope','manualTasks'])),
  check(n88_private.publication_v2_scope(payload->'scope',owner_id)),
  check(n88_private.publication_v2_manual(payload->'manualTasks'))
);
-- Canonical jsonb scope identity also unique: alternative scope-key spellings
-- cannot create a second row. Fixed-width built-in SHA-256 needs no extension.
create unique index publication_v2_scope_identity on n88_private.publication_v2_scopes
  (owner_id,(sha256(((payload->'scope')::text)::bytea)));

create table n88_private.publication_v2_items (
  owner_id uuid not null,
  scope_key text not null,
  row_id text not null check(octet_length(row_id) between 1 and 2000),
  publication_revision bigint not null check(publication_revision between 0 and 9007199254740991),
  tombstone boolean not null,
  payload jsonb not null check(octet_length(payload::text)<=16384),
  primary key(owner_id,scope_key,row_id),
  foreign key(owner_id,scope_key) references n88_private.publication_v2_scopes(owner_id,scope_key),
  check(n88_private.publication_v2_exact(payload,array['rowId','sourceRevision','publicationRevision','membershipRevision','decisions','tombstone'])),
  check(jsonb_typeof(payload->'rowId')='string' and payload->>'rowId'=row_id),
  check(jsonb_typeof(payload->'publicationRevision')='number' and (payload->>'publicationRevision')::bigint=publication_revision),
  check(jsonb_typeof(payload->'tombstone')='boolean' and (payload->>'tombstone')::boolean=tombstone),
  check(jsonb_typeof(payload->'sourceRevision')='string' and payload->>'sourceRevision' ~ '^[a-f0-9]{64}$'),
  check(jsonb_typeof(payload->'membershipRevision')='string' and payload->>'membershipRevision' ~ '^[a-f0-9]{64}$'),
  check(n88_private.publication_v2_flags(payload->'decisions')),
  check(not tombstone or payload->'decisions'='{"required":false,"scheduled":false,"completed":false,"grade":false}'::jsonb),
  check(jsonb_typeof(row_id::jsonb)='array' and jsonb_array_length(row_id::jsonb)=3 and row_id::jsonb->>0 in ('item','subitem','manual')),
  check(row_id::jsonb->>0<>'manual' or payload#>>'{decisions,grade}'='false'),
  check(row_id::jsonb->>0<>'item' or (payload#>>'{decisions,required}'='false' and payload#>>'{decisions,scheduled}'='false' and payload#>>'{decisions,completed}'='false'))
);
create table n88_private.publication_v2_high_water (
  owner_id uuid not null,
  scope_key text not null,
  source_key text not null check(char_length(source_key)<=220 and source_key ~ '^(items|scoreSubitems):.'),
  canonical_revision bigint not null check(canonical_revision>0),
  retired boolean not null,
  primary key(owner_id,scope_key,source_key),
  foreign key(owner_id,scope_key) references n88_private.publication_v2_scopes(owner_id,scope_key)
);
create table n88_private.publication_v2_receipts (
  owner_id uuid not null,
  request_id text not null check(request_id ~ '^[A-Za-z0-9_-]{16,100}$'),
  scope_key text not null,
  fingerprint text not null check(fingerprint ~ '^[a-f0-9]{64}$'),
  payload jsonb not null check(octet_length(payload::text)<=16384),
  primary key(owner_id,request_id),
  foreign key(owner_id,scope_key) references n88_private.publication_v2_scopes(owner_id,scope_key),
  check(n88_private.publication_v2_exact(payload,array['version','scope','binding','requestId','rowId','sourceRevision','state','publicationRevision'])),
  check(payload->'version'='2'::jsonb and n88_private.publication_v2_scope(payload->'scope',owner_id)),
  check(n88_private.publication_v2_exact(payload->'binding',array['sessionId','leaseId','contextRevision'])),
  check(jsonb_typeof(payload#>'{binding,sessionId}')='string' and char_length(payload#>>'{binding,sessionId}') between 1 and 200),
  check(jsonb_typeof(payload#>'{binding,leaseId}')='string' and char_length(payload#>>'{binding,leaseId}') between 1 and 200),
  check(jsonb_typeof(payload#>'{binding,contextRevision}')='string' and char_length(payload#>>'{binding,contextRevision}') between 1 and 200),
  check(jsonb_typeof(payload->'requestId')='string' and payload->>'requestId'=request_id),
  check(jsonb_typeof(payload->'rowId')='string' and octet_length(payload->>'rowId') between 1 and 2000),
  check(jsonb_typeof(payload->'sourceRevision')='string' and payload->>'sourceRevision' ~ '^[a-f0-9]{64}$'),
  check(jsonb_typeof(payload->'state')='string' and payload->>'state' in ('applied','rejected')),
  check(jsonb_typeof(payload->'publicationRevision')='number' and (payload->>'publicationRevision')::bigint between 0 and 9007199254740991)
);

-- No purge/reset path. Future approved retention must preserve unresolved UNKNOWN
-- identities and prevent old source/request IDs from being recycled.
create function n88_private.publication_v2_transition() returns trigger
language plpgsql security invoker set search_path=pg_catalog as $$
begin
  if TG_OP in ('DELETE','TRUNCATE') or TG_TABLE_NAME='publication_v2_receipts' then
    raise exception using errcode='23514', message='n88_v2_immutable_identity';
  end if;
  if NEW.owner_id<>OLD.owner_id or NEW.scope_key<>OLD.scope_key then
    raise exception using errcode='23514', message='n88_v2_scope_immutable';
  end if;
  if TG_TABLE_NAME='publication_v2_scopes' then
    if NEW.payload->'scope'<>OLD.payload->'scope' or NEW.store_revision<>OLD.store_revision+1 then
      raise exception using errcode='23514', message='n88_v2_scope_revision';
    end if;
  elsif TG_TABLE_NAME='publication_v2_items' then
    if NEW.row_id<>OLD.row_id or NEW.publication_revision<=OLD.publication_revision or OLD.tombstone and not NEW.tombstone then
      raise exception using errcode='23514', message='n88_v2_publication_revision';
    end if;
  elsif TG_TABLE_NAME='publication_v2_high_water' then
    if NEW.source_key<>OLD.source_key or NEW.canonical_revision<OLD.canonical_revision or OLD.retired and not NEW.retired then
      raise exception using errcode='23514', message='n88_v2_source_revision';
    end if;
  end if;
  return NEW;
end
$$;
create trigger publication_v2_scope_guard before update or delete on n88_private.publication_v2_scopes for each row execute function n88_private.publication_v2_transition();
create trigger publication_v2_item_guard before update or delete on n88_private.publication_v2_items for each row execute function n88_private.publication_v2_transition();
create trigger publication_v2_water_guard before update or delete on n88_private.publication_v2_high_water for each row execute function n88_private.publication_v2_transition();
create trigger publication_v2_receipt_guard before update or delete on n88_private.publication_v2_receipts for each row execute function n88_private.publication_v2_transition();
create trigger publication_v2_scope_truncate before truncate on n88_private.publication_v2_scopes for each statement execute function n88_private.publication_v2_transition();
create trigger publication_v2_item_truncate before truncate on n88_private.publication_v2_items for each statement execute function n88_private.publication_v2_transition();
create trigger publication_v2_water_truncate before truncate on n88_private.publication_v2_high_water for each statement execute function n88_private.publication_v2_transition();
create trigger publication_v2_receipt_truncate before truncate on n88_private.publication_v2_receipts for each statement execute function n88_private.publication_v2_transition();

-- Internal deletion-journal hook for a FUTURE authorized canonical lifecycle
-- integration. Call in the SAME canonical deletion transaction, with verified
-- owner/scope and OLD canonical identity/revision, never request-supplied facts.
-- Not attached to canonical tables here, not executable by browser roles.
-- This persists retirement even if deletion/restoration happens between reads.
create function n88_private.publication_v2_retire_source(p_owner uuid,p_scope text,p_family text,p_source text,p_revision bigint) returns void
language plpgsql security invoker set search_path=pg_catalog as $$
begin
  if p_family not in ('items','scoreSubitems') or p_revision<1 or p_revision is null or p_owner is null or
     p_scope is null or p_scope !~ '^[a-f0-9]{64}$' or p_source is null or char_length(p_source) not between 1 and 200 then
    raise exception using errcode='23514', message='n88_v2_retirement_unavailable';
  end if;
  perform pg_advisory_xact_lock(1312307256,88);
  perform 1 from n88_private.publication_v2_scopes where owner_id=p_owner and scope_key=p_scope for update;
  if not found then raise exception using errcode='23514', message='n88_v2_retirement_unavailable'; end if;
  insert into n88_private.publication_v2_high_water(owner_id,scope_key,source_key,canonical_revision,retired)
    values(p_owner,p_scope,p_family||':'||p_source,p_revision,true)
    on conflict(owner_id,scope_key,source_key) do update set canonical_revision=greatest(publication_v2_high_water.canonical_revision,excluded.canonical_revision),retired=true;
  -- Parent retirement includes all its children; no aggregate publication exists.
  update n88_private.publication_v2_items set publication_revision=publication_revision+1,tombstone=true,
    payload=payload||jsonb_build_object('publicationRevision',publication_revision+1,'tombstone',true,
      'decisions',jsonb_build_object('required',false,'scheduled',false,'completed',false,'grade',false))
    where owner_id=p_owner and scope_key=p_scope and not tombstone and
      (p_family='items' and row_id::jsonb->>1=p_source or p_family='scoreSubitems' and row_id::jsonb->>0='subitem' and row_id::jsonb->>2=p_source);
  update n88_private.publication_v2_scopes set store_revision=store_revision+1 where owner_id=p_owner and scope_key=p_scope;
end
$$;

revoke all on n88_private.publication_v2_scopes,n88_private.publication_v2_items,n88_private.publication_v2_high_water,n88_private.publication_v2_receipts from public;
revoke all on function n88_private.publication_v2_exact(jsonb,text[]),n88_private.publication_v2_scope(jsonb,uuid),n88_private.publication_v2_flags(jsonb),n88_private.publication_v2_manual(jsonb),n88_private.publication_v2_transition() from public;
revoke all on function n88_private.publication_v2_retire_source(uuid,text,text,text,bigint) from public;
-- Revoke only these new objects, including direct grants from existing defaults.
do $$
declare role_name text;
begin
  foreach role_name in array array['anon','authenticated'] loop
    if exists(select 1 from pg_catalog.pg_roles where rolname=role_name) then
      execute format('revoke all on n88_private.publication_v2_scopes,n88_private.publication_v2_items,n88_private.publication_v2_high_water,n88_private.publication_v2_receipts from %I',role_name);
      execute format('revoke all on function n88_private.publication_v2_exact(jsonb,text[]),n88_private.publication_v2_scope(jsonb,uuid),n88_private.publication_v2_flags(jsonb),n88_private.publication_v2_manual(jsonb),n88_private.publication_v2_transition() from %I',role_name);
      execute format('revoke all on function n88_private.publication_v2_retire_source(uuid,text,text,text,bigint) from %I',role_name);
    end if;
  end loop;
end
$$;

-- END EXACT original storage proposal
create role n88_v2_runtime nologin nosuperuser nobypassrls nocreatedb nocreaterole noinherit;
create role n88_v2_guard nologin nosuperuser nobypassrls nocreatedb nocreaterole noinherit;
grant usage on schema n88_private to n88_v2_guard,n88_v2_runtime;
grant usage on schema rakeezx to n88_v2_runtime;
grant select,update(namespace) on n88_private.contexts to n88_v2_guard;
grant select,update(row_key) on n88_private.numeric_sessions,n88_private.numeric_credentials to n88_v2_guard;
create policy v2_lookup on n88_private.contexts for select to n88_v2_guard using(true);
create policy v2_lock on n88_private.contexts for update to n88_v2_guard using(true) with check(false);
create policy v2_lookup on n88_private.numeric_sessions for select to n88_v2_guard using(true);
create policy v2_lock on n88_private.numeric_sessions for update to n88_v2_guard using(true) with check(false);
create policy v2_lookup on n88_private.numeric_credentials for select to n88_v2_guard using(true);
create policy v2_lock on n88_private.numeric_credentials for update to n88_v2_guard using(true) with check(false);
alter table n88_private.publication_v2_scopes enable row level security;
alter table n88_private.publication_v2_scopes force row level security;
create policy v2_owned on n88_private.publication_v2_scopes to n88_v2_guard using(owner_id::text=current_setting('n88.v2_owner',true)) with check(owner_id::text=current_setting('n88.v2_owner',true));
grant select,insert,update on n88_private.publication_v2_scopes to n88_v2_guard;
alter table n88_private.publication_v2_items enable row level security;
alter table n88_private.publication_v2_items force row level security;
create policy v2_owned on n88_private.publication_v2_items to n88_v2_guard using(owner_id::text=current_setting('n88.v2_owner',true)) with check(owner_id::text=current_setting('n88.v2_owner',true));
grant select,insert,update on n88_private.publication_v2_items to n88_v2_guard;
alter table n88_private.publication_v2_high_water enable row level security;
alter table n88_private.publication_v2_high_water force row level security;
create policy v2_owned on n88_private.publication_v2_high_water to n88_v2_guard using(owner_id::text=current_setting('n88.v2_owner',true)) with check(owner_id::text=current_setting('n88.v2_owner',true));
grant select,insert,update on n88_private.publication_v2_high_water to n88_v2_guard;
alter table n88_private.publication_v2_receipts enable row level security;
alter table n88_private.publication_v2_receipts force row level security;
create policy v2_owned on n88_private.publication_v2_receipts to n88_v2_guard using(owner_id::text=current_setting('n88.v2_owner',true)) with check(owner_id::text=current_setting('n88.v2_owner',true));
grant select,insert on n88_private.publication_v2_receipts to n88_v2_guard;
grant execute on function n88_private.publication_v2_exact(jsonb,text[]),n88_private.publication_v2_scope(jsonb,uuid),n88_private.publication_v2_flags(jsonb),n88_private.publication_v2_manual(jsonb) to n88_v2_guard;
grant execute on function n88_private.lock_current_session(uuid,uuid),n88_private.lock_canonical_sources(uuid,integer),n88_private.lock_projection_sources(uuid,integer) to n88_v2_runtime;
grant select(id,owner_id,revision,deleted_at,status) on rakeezx.years to n88_v2_runtime;
create policy v2_canonical_read on rakeezx.years for select to n88_v2_runtime using(owner_id::text=current_setting('n88.canonical_owner',true));
grant select(id,owner_id,revision,deleted_at,year_id,status,start_date,end_date) on rakeezx.terms to n88_v2_runtime;
create policy v2_canonical_read on rakeezx.terms for select to n88_v2_runtime using(owner_id::text=current_setting('n88.canonical_owner',true));
grant select(id,owner_id,revision,deleted_at,year_id,status,archived_at,grade,label,name) on rakeezx.sections to n88_v2_runtime;
create policy v2_canonical_read on rakeezx.sections for select to n88_v2_runtime using(owner_id::text=current_setting('n88.canonical_owner',true));
grant select(id,owner_id,revision,deleted_at,status,name) on rakeezx.students to n88_v2_runtime;
create policy v2_canonical_read on rakeezx.students for select to n88_v2_runtime using(owner_id::text=current_setting('n88.canonical_owner',true));
grant select(id,owner_id,revision,deleted_at,student_id,section_id,status,start_date,end_date) on rakeezx.enrollments to n88_v2_runtime;
create policy v2_canonical_read on rakeezx.enrollments for select to n88_v2_runtime using(owner_id::text=current_setting('n88.canonical_owner',true));
grant select(id,owner_id,revision,deleted_at,section_id,term_id,subject_id) on rakeezx.teachings to n88_v2_runtime;
create policy v2_canonical_read on rakeezx.teachings for select to n88_v2_runtime using(owner_id::text=current_setting('n88.canonical_owner',true));
grant select(id,owner_id,revision,deleted_at,teaching_id,name,max,"order",auto,per_point,penalty,score_mode,portability_group_id) on rakeezx.items to n88_v2_runtime;
create policy v2_canonical_read on rakeezx.items for select to n88_v2_runtime using(owner_id::text=current_setting('n88.canonical_owner',true));
grant select(id,owner_id,revision,deleted_at,student_id,item_id,value,manual_value,derived_value) on rakeezx.scores to n88_v2_runtime;
create policy v2_canonical_read on rakeezx.scores for select to n88_v2_runtime using(owner_id::text=current_setting('n88.canonical_owner',true));
grant select(id,owner_id,revision,deleted_at,item_id,name,value,"order",start_date,due_date,late_points) on rakeezx.score_subitems to n88_v2_runtime;
create policy v2_canonical_read on rakeezx.score_subitems for select to n88_v2_runtime using(owner_id::text=current_setting('n88.canonical_owner',true));
grant select(id,owner_id,revision,deleted_at,student_id,subitem_id,checked,completion_state) on rakeezx.score_subitem_completions to n88_v2_runtime;
create policy v2_canonical_read on rakeezx.score_subitem_completions for select to n88_v2_runtime using(owner_id::text=current_setting('n88.canonical_owner',true));
grant select(id,owner_id,revision,deleted_at,teaching_id,date,status) on rakeezx.sessions to n88_v2_runtime;
create policy v2_canonical_read on rakeezx.sessions for select to n88_v2_runtime using(owner_id::text=current_setting('n88.canonical_owner',true));
grant select(id,owner_id,revision,deleted_at,student_id,teaching_id,session_id,status) on rakeezx.attendance to n88_v2_runtime;
create policy v2_canonical_read on rakeezx.attendance for select to n88_v2_runtime using(owner_id::text=current_setting('n88.canonical_owner',true));
grant select(id,owner_id,revision,deleted_at,student_id,teaching_id,kind,delta) on rakeezx.logs to n88_v2_runtime;
create policy v2_canonical_read on rakeezx.logs for select to n88_v2_runtime using(owner_id::text=current_setting('n88.canonical_owner',true));
grant create on schema n88_private to n88_v2_guard;
-- owner-context; exact original SQL SHA256 f8a1689cd78951d7fc52ef91eb51423510f98cbf717a42c162572b2c69bf692b
create function n88_private.v2_f8a1689cd78951d7fc52ef91(p1 uuid) returns table(namespace text,owner_id uuid,active boolean) language sql security definer set search_path=pg_catalog as $v2$select namespace,owner_id,active from n88_private.contexts where owner_id=p1::uuid for share$v2$;
revoke all on function n88_private.v2_f8a1689cd78951d7fc52ef91(uuid) from public;
alter function n88_private.v2_f8a1689cd78951d7fc52ef91(uuid) owner to n88_v2_guard;
grant execute on function n88_private.v2_f8a1689cd78951d7fc52ef91(uuid) to n88_v2_runtime;
-- numeric-session; exact original SQL SHA256 7874a827dae2373223bc8adc67a2a30d158ed7e1e40183e72a8cff2c1df55a90
create function n88_private.v2_7874a827dae2373223bc8adc(p1 text) returns table(payload jsonb) language sql security definer set search_path=pg_catalog as $v2$select payload from n88_private.numeric_sessions where token_hash=p1 for share$v2$;
revoke all on function n88_private.v2_7874a827dae2373223bc8adc(text) from public;
alter function n88_private.v2_7874a827dae2373223bc8adc(text) owner to n88_v2_guard;
grant execute on function n88_private.v2_7874a827dae2373223bc8adc(text) to n88_v2_runtime;
-- numeric-credential; exact original SQL SHA256 6d27c8049efec0665b9d1f91f20f631f036ebb8403a3301bcc211176a6d1c751
create function n88_private.v2_6d27c8049efec0665b9d1f91(p1 uuid,p2 uuid,p3 text,p4 text) returns table(payload jsonb) language sql security definer set search_path=pg_catalog as $v2$select payload from n88_private.numeric_credentials where id=p1::uuid and owner_id=p2::uuid and student_id=p3 and version=p4::bigint for share$v2$;
revoke all on function n88_private.v2_6d27c8049efec0665b9d1f91(uuid,uuid,text,text) from public;
alter function n88_private.v2_6d27c8049efec0665b9d1f91(uuid,uuid,text,text) owner to n88_v2_guard;
grant execute on function n88_private.v2_6d27c8049efec0665b9d1f91(uuid,uuid,text,text) to n88_v2_runtime;
-- read-scopes; exact original SQL SHA256 e1b1c0927f6164faeccb760bbe7678f49ff4bfec39ac0e057b7be9b754ec33bf
create function n88_private.v2_e1b1c0927f6164faeccb760b(p1 uuid,p2 integer,p3 integer,p4 integer) returns table(body text) language sql security definer set search_path=pg_catalog as $v2$select case when octet_length(body)<=p3 and sum(octet_length(body)) over (rows unbounded preceding)<=p4 then body else null end as body from (select row_to_json(r)::text as body from (select scope_key,store_revision::text as store_revision,payload from n88_private.publication_v2_scopes where owner_id=p1::uuid order by scope_key limit p2) r) bounded$v2$;
revoke all on function n88_private.v2_e1b1c0927f6164faeccb760b(uuid,integer,integer,integer) from public;
alter function n88_private.v2_e1b1c0927f6164faeccb760b(uuid,integer,integer,integer) owner to n88_v2_guard;
grant execute on function n88_private.v2_e1b1c0927f6164faeccb760b(uuid,integer,integer,integer) to n88_v2_runtime;
-- read-items; exact original SQL SHA256 f46afed1e023d013cdabf257a722636fc6929997f1612d157d83327bae417a22
create function n88_private.v2_f46afed1e023d013cdabf257(p1 uuid,p2 integer,p3 integer,p4 integer) returns table(body text) language sql security definer set search_path=pg_catalog as $v2$select case when octet_length(body)<=p3 and sum(octet_length(body)) over (rows unbounded preceding)<=p4 then body else null end as body from (select row_to_json(r)::text as body from (select scope_key,row_id,publication_revision::text as publication_revision,tombstone,payload from n88_private.publication_v2_items where owner_id=p1::uuid order by scope_key,row_id limit p2) r) bounded$v2$;
revoke all on function n88_private.v2_f46afed1e023d013cdabf257(uuid,integer,integer,integer) from public;
alter function n88_private.v2_f46afed1e023d013cdabf257(uuid,integer,integer,integer) owner to n88_v2_guard;
grant execute on function n88_private.v2_f46afed1e023d013cdabf257(uuid,integer,integer,integer) to n88_v2_runtime;
-- read-high_water; exact original SQL SHA256 0dad27a56bfdc5bfab552235376bffb18292e9cfd59f29465272b0ba1bef11f3
create function n88_private.v2_0dad27a56bfdc5bfab552235(p1 uuid,p2 integer,p3 integer,p4 integer) returns table(body text) language sql security definer set search_path=pg_catalog as $v2$select case when octet_length(body)<=p3 and sum(octet_length(body)) over (rows unbounded preceding)<=p4 then body else null end as body from (select row_to_json(r)::text as body from (select scope_key,source_key,canonical_revision::text as canonical_revision,retired from n88_private.publication_v2_high_water where owner_id=p1::uuid order by scope_key,source_key limit p2) r) bounded$v2$;
revoke all on function n88_private.v2_0dad27a56bfdc5bfab552235(uuid,integer,integer,integer) from public;
alter function n88_private.v2_0dad27a56bfdc5bfab552235(uuid,integer,integer,integer) owner to n88_v2_guard;
grant execute on function n88_private.v2_0dad27a56bfdc5bfab552235(uuid,integer,integer,integer) to n88_v2_runtime;
-- read-receipts; exact original SQL SHA256 71a3e914da47cf1053850671fc8c2835603b1bc3490153fbb1784e773e0417eb
create function n88_private.v2_71a3e914da47cf1053850671(p1 uuid,p2 integer,p3 integer,p4 integer) returns table(body text) language sql security definer set search_path=pg_catalog as $v2$select case when octet_length(body)<=p3 and sum(octet_length(body)) over (rows unbounded preceding)<=p4 then body else null end as body from (select row_to_json(r)::text as body from (select request_id,scope_key,fingerprint,payload from n88_private.publication_v2_receipts where owner_id=p1::uuid order by request_id limit p2) r) bounded$v2$;
revoke all on function n88_private.v2_71a3e914da47cf1053850671(uuid,integer,integer,integer) from public;
alter function n88_private.v2_71a3e914da47cf1053850671(uuid,integer,integer,integer) owner to n88_v2_guard;
grant execute on function n88_private.v2_71a3e914da47cf1053850671(uuid,integer,integer,integer) to n88_v2_runtime;
-- insert-scope; exact original SQL SHA256 74c4aa4d430911e99002af80476a8c2647e430d81bd66eff0ce4ca1c1d7ddf12
create function n88_private.v2_74c4aa4d430911e99002af80(p1 uuid,p2 text,p3 text) returns table(affected bigint) language plpgsql security definer set search_path=pg_catalog as $v2$declare n bigint;begin insert into n88_private.publication_v2_scopes(owner_id,scope_key,store_revision,payload) values(p1::uuid,p2,1,p3::jsonb); GET DIAGNOSTICS n=ROW_COUNT; return query select n;end$v2$;
revoke all on function n88_private.v2_74c4aa4d430911e99002af80(uuid,text,text) from public;
alter function n88_private.v2_74c4aa4d430911e99002af80(uuid,text,text) owner to n88_v2_guard;
grant execute on function n88_private.v2_74c4aa4d430911e99002af80(uuid,text,text) to n88_v2_runtime;
-- cas-scope; exact original SQL SHA256 dbe074dae923ca8a3746d390240287893cd777e5f01b8b27fe07477aeda85df0
create function n88_private.v2_dbe074dae923ca8a3746d390(p1 uuid,p2 text,p3 text,p4 text) returns table(affected bigint) language plpgsql security definer set search_path=pg_catalog as $v2$declare n bigint;begin update n88_private.publication_v2_scopes set store_revision=store_revision+1,payload=p3::jsonb where owner_id=p1::uuid and scope_key=p2 and store_revision=p4::bigint; GET DIAGNOSTICS n=ROW_COUNT; return query select n;end$v2$;
revoke all on function n88_private.v2_dbe074dae923ca8a3746d390(uuid,text,text,text) from public;
alter function n88_private.v2_dbe074dae923ca8a3746d390(uuid,text,text,text) owner to n88_v2_guard;
grant execute on function n88_private.v2_dbe074dae923ca8a3746d390(uuid,text,text,text) to n88_v2_runtime;
-- insert-item; exact original SQL SHA256 a3e6d95cdff2d66f56ae84f6530f07f9bc970a014b2f3a25d31f548173d2c508
create function n88_private.v2_a3e6d95cdff2d66f56ae84f6(p1 uuid,p2 text,p3 text,p4 text,p5 boolean,p6 text) returns table(affected bigint) language plpgsql security definer set search_path=pg_catalog as $v2$declare n bigint;begin insert into n88_private.publication_v2_items(owner_id,scope_key,row_id,publication_revision,tombstone,payload) values(p1::uuid,p2,p3,p4::bigint,p5,p6::jsonb); GET DIAGNOSTICS n=ROW_COUNT; return query select n;end$v2$;
revoke all on function n88_private.v2_a3e6d95cdff2d66f56ae84f6(uuid,text,text,text,boolean,text) from public;
alter function n88_private.v2_a3e6d95cdff2d66f56ae84f6(uuid,text,text,text,boolean,text) owner to n88_v2_guard;
grant execute on function n88_private.v2_a3e6d95cdff2d66f56ae84f6(uuid,text,text,text,boolean,text) to n88_v2_runtime;
-- cas-item; exact original SQL SHA256 5d62e77b02ab6a1fb4e97688aa1810d3559d998a42ab85a04435819f19017f21
create function n88_private.v2_5d62e77b02ab6a1fb4e97688(p1 uuid,p2 text,p3 text,p4 text,p5 boolean,p6 text,p7 text,p8 text) returns table(affected bigint) language plpgsql security definer set search_path=pg_catalog as $v2$declare n bigint;begin update n88_private.publication_v2_items set publication_revision=p4::bigint,tombstone=p5,payload=p6::jsonb where owner_id=p1::uuid and scope_key=p2 and row_id=p3 and publication_revision=p7::bigint and payload=p8::jsonb; GET DIAGNOSTICS n=ROW_COUNT; return query select n;end$v2$;
revoke all on function n88_private.v2_5d62e77b02ab6a1fb4e97688(uuid,text,text,text,boolean,text,text,text) from public;
alter function n88_private.v2_5d62e77b02ab6a1fb4e97688(uuid,text,text,text,boolean,text,text,text) owner to n88_v2_guard;
grant execute on function n88_private.v2_5d62e77b02ab6a1fb4e97688(uuid,text,text,text,boolean,text,text,text) to n88_v2_runtime;
-- insert-high-water; exact original SQL SHA256 23ccfc1e16cd0b122d0cb3c342a2492cc10f5e108becfcd5b1955b3a42772c73
create function n88_private.v2_23ccfc1e16cd0b122d0cb3c3(p1 uuid,p2 text,p3 text,p4 text,p5 boolean) returns table(affected bigint) language plpgsql security definer set search_path=pg_catalog as $v2$declare n bigint;begin insert into n88_private.publication_v2_high_water(owner_id,scope_key,source_key,canonical_revision,retired) values(p1::uuid,p2,p3,p4::bigint,p5); GET DIAGNOSTICS n=ROW_COUNT; return query select n;end$v2$;
revoke all on function n88_private.v2_23ccfc1e16cd0b122d0cb3c3(uuid,text,text,text,boolean) from public;
alter function n88_private.v2_23ccfc1e16cd0b122d0cb3c3(uuid,text,text,text,boolean) owner to n88_v2_guard;
grant execute on function n88_private.v2_23ccfc1e16cd0b122d0cb3c3(uuid,text,text,text,boolean) to n88_v2_runtime;
-- cas-high-water; exact original SQL SHA256 94bb23dac56c2e002713130ac7ddb2c686561f7c1bbe1f1464a873629c5237fc
create function n88_private.v2_94bb23dac56c2e002713130a(p1 uuid,p2 text,p3 text,p4 text,p5 boolean,p6 text,p7 boolean) returns table(affected bigint) language plpgsql security definer set search_path=pg_catalog as $v2$declare n bigint;begin update n88_private.publication_v2_high_water set canonical_revision=p4::bigint,retired=p5 where owner_id=p1::uuid and scope_key=p2 and source_key=p3 and canonical_revision=p6::bigint and retired=p7; GET DIAGNOSTICS n=ROW_COUNT; return query select n;end$v2$;
revoke all on function n88_private.v2_94bb23dac56c2e002713130a(uuid,text,text,text,boolean,text,boolean) from public;
alter function n88_private.v2_94bb23dac56c2e002713130a(uuid,text,text,text,boolean,text,boolean) owner to n88_v2_guard;
grant execute on function n88_private.v2_94bb23dac56c2e002713130a(uuid,text,text,text,boolean,text,boolean) to n88_v2_runtime;
-- insert-receipt; exact original SQL SHA256 3b143936c792a16ff5425c3dd129c1065921837cfaa15fdcc018734517196acf
create function n88_private.v2_3b143936c792a16ff5425c3d(p1 uuid,p2 text,p3 text,p4 text,p5 text) returns table(affected bigint) language plpgsql security definer set search_path=pg_catalog as $v2$declare n bigint;begin insert into n88_private.publication_v2_receipts(owner_id,request_id,scope_key,fingerprint,payload) values(p1::uuid,p2,p3,p4,p5::jsonb); GET DIAGNOSTICS n=ROW_COUNT; return query select n;end$v2$;
revoke all on function n88_private.v2_3b143936c792a16ff5425c3d(uuid,text,text,text,text) from public;
alter function n88_private.v2_3b143936c792a16ff5425c3d(uuid,text,text,text,text) owner to n88_v2_guard;
grant execute on function n88_private.v2_3b143936c792a16ff5425c3d(uuid,text,text,text,text) to n88_v2_runtime;
revoke create on schema n88_private from n88_v2_guard;
commit;
