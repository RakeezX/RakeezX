-- RAKEEZ X — SUPPORT-NOTIFICATION-V1-01
-- Private durable notification state, atomic enqueue, bounded abuse guard, and
-- service-only claim/completion RPCs. No Support content is duplicated here.
set lock_timeout = '10s';

begin;

create table if not exists rakeezx.support_notification_outbox (
  owner_id           uuid not null,
  support_request_id text not null,
  status             text not null default 'pending'
    check (status in ('pending', 'leased', 'delivered', 'exhausted')),
  attempt_count      integer not null default 0 check (attempt_count between 0 and 5),
  next_attempt_at    timestamptz not null default pg_catalog.now(),
  lease_token        text check (lease_token is null or char_length(lease_token) = 32),
  lease_expires_at   timestamptz,
  delivered_at       timestamptz,
  failure_category   text check (failure_category is null or failure_category in (
    'network', 'timeout', 'rate_limited', 'provider_5xx', 'provider_rejected',
    'invalid_request', 'authentication', 'configuration', 'request_missing', 'internal'
  )),
  created_at         timestamptz not null default pg_catalog.now(),
  updated_at         timestamptz not null default pg_catalog.now(),
  primary key (owner_id, support_request_id),
  foreign key (owner_id, support_request_id)
    references rakeezx.support_requests(owner_id, id) on delete cascade
);

create index if not exists support_notification_outbox_ready_idx
  on rakeezx.support_notification_outbox (next_attempt_at, created_at)
  where status in ('pending', 'leased');

alter table rakeezx.support_notification_outbox enable row level security;
alter table rakeezx.support_notification_outbox force row level security;
revoke all on table rakeezx.support_notification_outbox from public, anon, authenticated;
grant select, insert, update, delete on table rakeezx.support_notification_outbox to service_role;
grant usage on schema rakeezx to service_role;
grant select on table rakeezx.support_requests to service_role;

create or replace function rakeezx.guard_support_request_rate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_recent integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('support-rate:' || new.owner_id::text, 0)
  );
  select pg_catalog.count(*) into v_recent
  from rakeezx.support_requests
  where owner_id = new.owner_id
    and created_at >= pg_catalog.now() - interval '1 hour';
  if v_recent >= 10 then
    raise exception using errcode = '54000', message = 'SUPPORT_RATE_LIMITED';
  end if;
  return new;
end;
$$;
revoke all on function rakeezx.guard_support_request_rate() from public, anon, authenticated;

drop trigger if exists support_requests_rate_limit on rakeezx.support_requests;
create trigger support_requests_rate_limit before insert on rakeezx.support_requests
  for each row execute function rakeezx.guard_support_request_rate();

create or replace function rakeezx.ensure_support_notification_job(
  p_owner uuid,
  p_support_request_id text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_owner is null or coalesce(p_support_request_id, '') = '' then
    raise exception using errcode = '22023', message = 'Invalid support notification identity';
  end if;
  insert into rakeezx.support_notification_outbox(owner_id, support_request_id)
  values (p_owner, p_support_request_id)
  on conflict (owner_id, support_request_id) do nothing;
end;
$$;
revoke all on function rakeezx.ensure_support_notification_job(uuid, text) from public, anon, authenticated;
grant execute on function rakeezx.ensure_support_notification_job(uuid, text) to service_role;

create or replace function rakeezx.enqueue_support_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform rakeezx.ensure_support_notification_job(new.owner_id, new.id);
  return new;
end;
$$;
revoke all on function rakeezx.enqueue_support_notification() from public, anon, authenticated;

drop trigger if exists support_requests_notification_enqueue on rakeezx.support_requests;
create trigger support_requests_notification_enqueue after insert on rakeezx.support_requests
  for each row execute function rakeezx.enqueue_support_notification();

create or replace function rakeezx.claim_support_notification_jobs(
  p_limit integer default 10,
  p_lease_seconds integer default 300
) returns table (
  owner_id uuid,
  support_request_id text,
  lease_token text,
  attempt_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_limit < 1 or p_limit > 25 or p_lease_seconds < 60 or p_lease_seconds > 900 then
    raise exception using errcode = '22023', message = 'Invalid notification claim bounds';
  end if;
  return query
  with candidates as (
    select o.owner_id, o.support_request_id
    from rakeezx.support_notification_outbox o
    where o.attempt_count < 5
      and (
        (o.status = 'pending' and o.next_attempt_at <= pg_catalog.now())
        or (o.status = 'leased' and o.lease_expires_at <= pg_catalog.now())
      )
    order by o.next_attempt_at, o.created_at
    for update skip locked
    limit p_limit
  )
  update rakeezx.support_notification_outbox o
  set status = 'leased',
      attempt_count = o.attempt_count + 1,
      lease_token = pg_catalog.md5(pg_catalog.random()::text || pg_catalog.clock_timestamp()::text || o.support_request_id),
      lease_expires_at = pg_catalog.now() + pg_catalog.make_interval(secs => p_lease_seconds),
      failure_category = null,
      updated_at = pg_catalog.now()
  from candidates c
  where (o.owner_id, o.support_request_id) = (c.owner_id, c.support_request_id)
  returning o.owner_id, o.support_request_id, o.lease_token, o.attempt_count;
end;
$$;
revoke all on function rakeezx.claim_support_notification_jobs(integer, integer) from public, anon, authenticated;
grant execute on function rakeezx.claim_support_notification_jobs(integer, integer) to service_role;

create or replace function rakeezx.complete_support_notification_job(
  p_owner uuid,
  p_support_request_id text,
  p_lease_token text,
  p_outcome text,
  p_failure_category text default null,
  p_next_attempt_at timestamptz default null
) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare v_job rakeezx.support_notification_outbox%rowtype;
declare v_status text;
begin
  if p_outcome not in ('delivered', 'temporary_failure', 'permanent_failure') then
    raise exception using errcode = '22023', message = 'Invalid notification completion outcome';
  end if;
  if p_failure_category is not null and p_failure_category not in (
    'network', 'timeout', 'rate_limited', 'provider_5xx', 'provider_rejected',
    'invalid_request', 'authentication', 'configuration', 'request_missing', 'internal'
  ) then
    raise exception using errcode = '22023', message = 'Invalid notification failure category';
  end if;

  select * into v_job
  from rakeezx.support_notification_outbox
  where owner_id = p_owner and support_request_id = p_support_request_id
  for update;
  if not found or v_job.status <> 'leased' or v_job.lease_token is distinct from p_lease_token then
    raise exception using errcode = '40001', message = 'Notification lease is stale';
  end if;

  if p_outcome = 'delivered' then
    v_status := 'delivered';
    update rakeezx.support_notification_outbox
    set status = v_status, delivered_at = pg_catalog.now(), failure_category = null,
        lease_token = null, lease_expires_at = null, updated_at = pg_catalog.now()
    where owner_id = p_owner and support_request_id = p_support_request_id;
  elsif p_outcome = 'permanent_failure' or v_job.attempt_count >= 5 then
    v_status := 'exhausted';
    update rakeezx.support_notification_outbox
    set status = v_status, failure_category = coalesce(p_failure_category, 'internal'),
        lease_token = null, lease_expires_at = null, updated_at = pg_catalog.now()
    where owner_id = p_owner and support_request_id = p_support_request_id;
  else
    if p_next_attempt_at is null or p_next_attempt_at <= pg_catalog.now()
       or p_next_attempt_at > pg_catalog.now() + interval '24 hours' then
      raise exception using errcode = '22023', message = 'Invalid notification retry time';
    end if;
    v_status := 'pending';
    update rakeezx.support_notification_outbox
    set status = v_status, next_attempt_at = p_next_attempt_at,
        failure_category = coalesce(p_failure_category, 'internal'),
        lease_token = null, lease_expires_at = null, updated_at = pg_catalog.now()
    where owner_id = p_owner and support_request_id = p_support_request_id;
  end if;
  return v_status;
end;
$$;
revoke all on function rakeezx.complete_support_notification_job(uuid, text, text, text, text, timestamptz)
  from public, anon, authenticated;
grant execute on function rakeezx.complete_support_notification_job(uuid, text, text, text, text, timestamptz)
  to service_role;

commit;
