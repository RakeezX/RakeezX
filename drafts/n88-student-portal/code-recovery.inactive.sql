-- AI-authored UNAPPLIED fifth migration; CLI-generated version, local synthetic only.
begin;
set local lock_timeout='1s';
set local statement_timeout='15s';
select pg_advisory_xact_lock(1312307256,88);
create table n88_private.code_recovery (
 row_key text primary key,
 payload jsonb not null check(jsonb_typeof(payload)='object' and octet_length(payload::text)<=1024),
 credential_id uuid generated always as ((payload->>'credentialId')::uuid) stored not null,
 generation bigint generated always as ((payload->>'generation')::bigint) stored not null,
 key_version text generated always as (payload->>'keyVersion') stored not null,
 nonce text generated always as (payload->>'nonce') stored not null,
 foreign key(credential_id) references n88_private.numeric_credentials(id) deferrable initially deferred,
 unique(credential_id,generation), unique(key_version,nonce),
 check(row_key=payload->>'id' and generation>=1),
 check(payload ?& array['id','credentialId','generation','envelopeVersion','algorithm','keyVersion','nonce','ciphertext','tag']),
 check((payload-array['id','credentialId','generation','envelopeVersion','algorithm','keyVersion','nonce','ciphertext','tag'])='{}'::jsonb),
 check(coalesce(payload->>'envelopeVersion'='1' and payload->>'algorithm'='AES-256-GCM' and key_version ~ '^[A-Za-z0-9_-]{1,40}$' and nonce ~ '^[a-f0-9]{24}$' and payload->>'ciphertext' ~ '^[a-f0-9]{12}$' and payload->>'tag' ~ '^[a-f0-9]{32}$',false))
);
-- Append-only generations retain ALL nonce tombstones; no update/delete, even for revoked codes.
create function n88_private.recovery_immutable() returns trigger language plpgsql set search_path=pg_catalog as $$
begin raise exception 'n88_recovery_unavailable'; end; $$;
revoke all on function n88_private.recovery_immutable() from public;
create trigger recovery_immutable before update or delete on n88_private.code_recovery for each row execute function n88_private.recovery_immutable();
revoke all on n88_private.code_recovery from public,anon,authenticated;
alter table n88_private.code_recovery enable row level security;
create policy recovery_backend on n88_private.code_recovery to n88_backend using(true) with check(true);
grant select,insert on n88_private.code_recovery to n88_backend;
commit;
