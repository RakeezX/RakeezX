-- AI-authored UNAPPLIED proposal. Not a migration, not a service activation.
-- New private objects only. Never run against a hosted DB under this card.
-- Synthetic scratch tests may execute this file. No roles/policies/grants created.
begin;
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
commit;
