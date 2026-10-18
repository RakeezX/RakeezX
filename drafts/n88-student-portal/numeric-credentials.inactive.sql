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
