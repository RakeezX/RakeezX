-- AI: private source proposal ONLY; global N88 lock must already be held.
create table n88_private.ingress_receipts(nonce uuid primary key,expires_at bigint not null);
create index ingress_receipts_expiry on n88_private.ingress_receipts(expires_at);
revoke all on n88_private.ingress_receipts from public;
alter table n88_private.ingress_receipts enable row level security;
create function n88_private.consume_ingress(p_nonce uuid,p_expiry bigint) returns boolean
language plpgsql security definer set search_path=pg_catalog as $$
declare sec bigint:=extract(epoch from clock_timestamp())::bigint;
begin
  if p_nonce is null or p_expiry<=sec or p_expiry>sec+32 then return false; end if;
  delete from n88_private.ingress_receipts where expires_at<=sec;
  if (select count(*) from (select 1 from n88_private.ingress_receipts limit 10000) b)>=10000 then return false; end if;
  insert into n88_private.ingress_receipts values(p_nonce,p_expiry) on conflict do nothing;
  return found;
end;
$$;
revoke all on function n88_private.consume_ingress(uuid,bigint) from public;
