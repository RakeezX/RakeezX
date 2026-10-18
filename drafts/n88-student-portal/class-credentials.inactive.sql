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
