-- Historical integrated schema source. Current installation MUST append six-digit-schema.inactive.sql; never rewrite staged history.
-- AI: UNAPPLIED additive proposal after the preserved 20261018034356 baseline. Local synthetic only.
-- AI-authored, UNAPPLIED local proposal. Not included in activation manifest.
-- After exact existing N88 private schema/roles; CLI-staged local integration only.
-- JSON payloads are bounded, typed by this server codec, and contain NO plaintext.
create table n88_private.numeric_credentials (
  row_key text primary key,
  payload jsonb not null check(jsonb_typeof(payload)='object' and octet_length(payload::text)<=2048),
  id uuid generated always as ((payload->>'id')::uuid) stored not null unique,
  owner_id uuid generated always as ((payload->>'ownerId')::uuid) stored not null,
  student_id text generated always as (payload->>'studentId') stored not null,
  version bigint generated always as ((payload->>'version')::bigint) stored not null,
  reservation text generated always as (payload->>'reservation') stored not null unique,
  revoked_at bigint generated always as ((payload->>'revokedAt')::bigint) stored,
  foreign key(owner_id) references n88_private.contexts(owner_id),
  unique(owner_id,student_id,version), unique(id,owner_id,student_id,version),
  check(row_key=payload->>'id' and version>=1 and length(student_id) between 1 and 240),
  check(reservation ~ '^[a-f0-9]{64}$' and coalesce(payload->>'verifier' ~ '^[a-f0-9]{64}$',false)),
  check(coalesce(payload->>'keyVersion' ~ '^[A-Za-z0-9_-]{1,40}$',false)),
  check(payload ?& array['id','ownerId','studentId','version','reservation','verifier','keyVersion','revokedAt']),
  check((payload - array['id','ownerId','studentId','version','reservation','verifier','keyVersion','revokedAt'])='{}'::jsonb)
);
create unique index numeric_one_active_student on n88_private.numeric_credentials(owner_id,student_id) where revoked_at is null;
create function n88_private.numeric_tombstone_guard() returns trigger language plpgsql set search_path=pg_catalog as $$
begin
  if TG_OP='DELETE' then raise exception 'n88_numeric_unavailable'; end if;
  if (new.payload-'revokedAt') is distinct from (old.payload-'revokedAt') or
     new.row_key<>old.row_key or old.payload->>'revokedAt' is not null or new.payload->>'revokedAt' is null then
    raise exception 'n88_numeric_unavailable';
  end if;
  return new;
end; $$;
revoke all on function n88_private.numeric_tombstone_guard() from public;
create trigger numeric_tombstones before update or delete on n88_private.numeric_credentials
  for each row execute function n88_private.numeric_tombstone_guard();

create table n88_private.numeric_sessions (
  row_key text primary key,
  payload jsonb not null check(jsonb_typeof(payload)='object' and octet_length(payload::text)<=4096),
  credential_id uuid generated always as ((payload->>'credentialId')::uuid) stored not null,
  owner_id uuid generated always as ((payload->>'ownerId')::uuid) stored not null,
  student_id text generated always as (payload->>'studentId') stored not null,
  version bigint generated always as ((payload->>'version')::bigint) stored not null,
  token_hash text generated always as (payload->>'tokenHash') stored not null unique,
  foreign key(credential_id,owner_id,student_id,version) references n88_private.numeric_credentials(id,owner_id,student_id,version),
  check(row_key=payload->>'id' and token_hash ~ '^[a-f0-9]{64}$'),
  check(payload ?& array['id','credentialId','ownerId','studentId','classId','enrollmentId','membershipRevision','canonicalStamp','version','tokenHash','expiresAt','revokedAt']),
  check((payload - array['id','credentialId','ownerId','studentId','classId','enrollmentId','membershipRevision','canonicalStamp','version','tokenHash','expiresAt','revokedAt'])='{}'::jsonb)
);
create table n88_private.numeric_rates (
  row_key text primary key,
  payload jsonb not null check(jsonb_typeof(payload)='object' and octet_length(payload::text)<=512),
  check(row_key=payload->>'key' and (row_key='global' or row_key ~ '^[a-f0-9]{64}$')),
  check((payload->>'count')::bigint>=0 and (payload->>'until')::bigint>0),
  check(payload ?& array['key','count','until'] and (payload-array['key','count','until'])='{}'::jsonb)
);
revoke all on n88_private.numeric_credentials,n88_private.numeric_sessions,n88_private.numeric_rates from public;
alter table n88_private.numeric_credentials enable row level security;
alter table n88_private.numeric_sessions enable row level security;
alter table n88_private.numeric_rates enable row level security;
create policy numeric_backend on n88_private.numeric_credentials to n88_backend using(true) with check(true);
create policy numeric_backend on n88_private.numeric_sessions to n88_backend using(true) with check(true);
create policy numeric_backend on n88_private.numeric_rates to n88_backend using(true) with check(true);
grant select,insert,update on n88_private.numeric_credentials to n88_backend;
grant select,insert,update,delete on n88_private.numeric_sessions,n88_private.numeric_rates to n88_backend;
-- No managed Auth/RLS changes, no canonical writes, no browser-role grants.

-- AI-authored, UNAPPLIED local proposal, after numeric-credentials.inactive.sql.
create table n88_private.class_credential_receipts (
  row_key text primary key,
  payload jsonb not null check(jsonb_typeof(payload)='object' and octet_length(payload::text)<=1048576),
  owner_id uuid generated always as ((payload->>'ownerId')::uuid) stored not null,
  request_id text generated always as (payload->>'requestId') stored not null,
  foreign key(owner_id) references n88_private.contexts(owner_id),
  unique(owner_id,request_id),
  check(request_id ~ '^[A-Za-z0-9_-]{16,100}$' and payload->>'binding' ~ '^[a-f0-9]{64}$'),
  check(jsonb_typeof(payload->'results')='array' and jsonb_array_length(payload->'results')<=2000),
  check(payload ?& array['ownerId','requestId','binding','results']),
  check((payload-array['ownerId','requestId','binding','results'])='{}'::jsonb)
);
create function n88_private.class_receipt_guard() returns trigger language plpgsql set search_path=pg_catalog as $$
declare r jsonb;
begin
  if TG_OP<>'INSERT' then raise exception 'n88_class_unavailable'; end if;
  for r in select value from jsonb_array_elements(new.payload->'results') loop
    if (r-array['studentId','enrollmentId','credentialVersion','status','reason'])<>'{}'::jsonb or
       not (r ?& array['studentId','enrollmentId','credentialVersion','status']) or
       coalesce(r->>'status','') not in ('created','skipped','failed') or
       (r ? 'reason' and coalesce(r->>'reason','') not in ('existing','revoked_rotate_required','revoked','unavailable')) then raise exception 'n88_class_unavailable'; end if;
  end loop;
  return new;
end; $$;
revoke all on function n88_private.class_receipt_guard() from public;
create trigger class_receipts_immutable before insert or update or delete on n88_private.class_credential_receipts
  for each row execute function n88_private.class_receipt_guard();
revoke all on n88_private.class_credential_receipts from public;
alter table n88_private.class_credential_receipts enable row level security;
create policy class_backend on n88_private.class_credential_receipts to n88_backend using(true) with check(true);
grant select,insert on n88_private.class_credential_receipts to n88_backend;
-- Receipts/reservations are never TTL-evicted. Capacity exhaustion fails closed;
-- archival/key migration needs its own exact design, not a silent retry/reset.

create table n88_private.class_visibility(owner_id uuid not null references n88_private.contexts(owner_id),class_id text not null,term_id text not null,payload jsonb not null check(jsonb_typeof(payload)='object' and octet_length(payload::text)<=2097152),primary key(owner_id,class_id,term_id));
revoke all on n88_private.class_visibility from public,anon,authenticated;
alter table n88_private.class_visibility enable row level security;
create policy class_visibility_backend on n88_private.class_visibility to n88_backend using(true) with check(true);
grant select,insert,update on n88_private.class_visibility to n88_backend;
create function n88_private.lock_projection_sources(p_owner uuid,p_max integer) returns void
language plpgsql security definer set search_path=pg_catalog as $$
declare t text;n integer;
begin
 if p_owner is null or p_max is null or p_max<1 or p_max>2000 then raise exception 'n88_projection_unavailable';end if;
 perform n88_private.lock_canonical_sources(p_owner,p_max);
 foreach t in array array['scores','score_subitems','score_subitem_completions','sessions','attendance','logs'] loop
  execute format('select count(*) from (select id from rakeezx.%I where owner_id=$1 order by id limit $2 for update) locked',t) into n using p_owner,p_max+1;
  if n>p_max then raise exception 'n88_projection_unavailable';end if;
 end loop;
end;$$;
revoke all on function n88_private.lock_projection_sources(uuid,integer) from public;
grant execute on function n88_private.lock_projection_sources(uuid,integer) to n88_backend;
grant select(owner_id,id),update(id) on rakeezx.scores,rakeezx.score_subitems,rakeezx.score_subitem_completions,rakeezx.sessions,rakeezx.attendance,rakeezx.logs to n88_guard;
do $$ declare t text;begin
 foreach t in array array['scores','score_subitems','score_subitem_completions','sessions','attendance','logs'] loop
  execute format('create policy n88_canonical_read on rakeezx.%I for select to n88_backend using(owner_id::text=current_setting(''n88.canonical_owner'',true))',t);
  execute format('create policy n88_guard_lock on rakeezx.%I to n88_guard using(owner_id::text=current_setting(''n88.canonical_owner'',true)) with check(false)',t);
 end loop;
end;$$;
grant create on schema n88_private to n88_guard;
grant n88_guard to postgres with set true;
alter function n88_private.lock_projection_sources(uuid,integer) owner to n88_guard;
grant n88_guard to postgres with set false;
revoke create on schema n88_private from n88_guard;
grant select(id,owner_id,revision,deleted_at,status) on rakeezx.years to n88_backend;
grant select(id,owner_id,revision,deleted_at,year_id,status,start_date,end_date) on rakeezx.terms to n88_backend;
grant select(id,owner_id,revision,deleted_at,year_id,status,archived_at,grade,label,name) on rakeezx.sections to n88_backend;
grant select(id,owner_id,revision,deleted_at,status,name) on rakeezx.students to n88_backend;
grant select(id,owner_id,revision,deleted_at,student_id,section_id,status,start_date,end_date) on rakeezx.enrollments to n88_backend;
grant select(id,owner_id,revision,deleted_at,section_id,term_id,subject_id) on rakeezx.teachings to n88_backend;
grant select(id,owner_id,revision,deleted_at,teaching_id,name,max,"order",auto,per_point,penalty,score_mode,portability_group_id) on rakeezx.items to n88_backend;
grant select(id,owner_id,revision,deleted_at,student_id,item_id,value,manual_value,derived_value) on rakeezx.scores to n88_backend;
grant select(id,owner_id,revision,deleted_at,item_id,name,value,"order",start_date,due_date,late_points) on rakeezx.score_subitems to n88_backend;
grant select(id,owner_id,revision,deleted_at,student_id,subitem_id,checked,completion_state) on rakeezx.score_subitem_completions to n88_backend;
grant select(id,owner_id,revision,deleted_at,teaching_id,date,status) on rakeezx.sessions to n88_backend;
grant select(id,owner_id,revision,deleted_at,student_id,teaching_id,session_id,status) on rakeezx.attendance to n88_backend;
grant select(id,owner_id,revision,deleted_at,student_id,teaching_id,kind,delta) on rakeezx.logs to n88_backend;
