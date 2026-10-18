-- AI-authored INACTIVE proposal. Fresh CLI-staged amendment; local fabricated PG only.
-- Same trusted restricted backend and global repository fence. No public grants.
alter table n88_private.numeric_rates drop constraint numeric_rates_payload_check2;
alter table n88_private.numeric_rates add constraint numeric_rates_epoch_shape check (
  payload ?& array['key','count','until'] and
  (payload-array['key','count','until','epoch'])='{}'::jsonb and
  (not (payload ? 'epoch') or coalesce(payload->>'epoch' ~ '^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$',false))
);
-- Legacy charges/windows remain untouched; server assigns epoch on next admission.
create table n88_private.numeric_attempts (
  row_key text primary key,
  payload jsonb not null check(jsonb_typeof(payload)='object' and octet_length(payload::text)<=1024),
  check(row_key=payload->>'id' and row_key ~ '^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'),
  check(payload ?& array['id','buckets','until','sessionId','settled'] and
    (payload-array['id','buckets','until','sessionId','settled'])='{}'::jsonb),
  check(jsonb_typeof(payload->'buckets')='array' and jsonb_array_length(payload->'buckets')=2),
  check((payload->>'until')::bigint>0 and jsonb_typeof(payload->'settled')='boolean'),
  check(payload->>'sessionId' is null or payload->>'sessionId' ~ '^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'),
  check(not (payload->>'settled')::boolean or payload->>'sessionId' is not null)
);
create function n88_private.numeric_attempt_binding_guard() returns trigger language plpgsql set search_path=pg_catalog as $$
begin
  if new.row_key<>old.row_key or (new.payload-array['sessionId','settled']) is distinct from (old.payload-array['sessionId','settled']) or
    (old.payload->>'sessionId' is not null and new.payload->'sessionId' is distinct from old.payload->'sessionId') or
    ((old.payload->>'settled')::boolean and new.payload->'settled' is distinct from old.payload->'settled') then
    raise exception 'n88_numeric_unavailable';
  end if;
  return new;
end; $$;
revoke all on function n88_private.numeric_attempt_binding_guard() from public;
create trigger numeric_attempt_binding before update on n88_private.numeric_attempts
  for each row execute function n88_private.numeric_attempt_binding_guard();
revoke all on n88_private.numeric_attempts from public;
alter table n88_private.numeric_attempts enable row level security;
create policy numeric_backend on n88_private.numeric_attempts to n88_backend using(true) with check(true);
grant select,insert,update,delete on n88_private.numeric_attempts to n88_backend;
