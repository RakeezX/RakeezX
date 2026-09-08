-- RAKEEZ X — SUPPORT-FEEDBACK-01C: private online-only request intake.
-- Promotion dependency: 0019_class_rules.sql must be recorded first. This
-- table is otherwise functionally independent from Class Rules and Sync V2.
set lock_timeout = '10s';

begin;

create table if not exists rakeezx.support_requests (
  id          text not null check (char_length(id) between 1 and 200),
  owner_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  type        text not null check (type in ('technical', 'suggestion', 'inquiry')),
  message     text not null check (char_length(btrim(message)) between 1 and 4000),
  diagnostics jsonb not null default '{}'::jsonb check (pg_catalog.jsonb_typeof(diagnostics) = 'object'),
  created_at  timestamptz not null default pg_catalog.now(),
  primary key (owner_id, id)
);

create index if not exists support_requests_owner_created_idx
  on rakeezx.support_requests (owner_id, created_at desc);

drop trigger if exists support_requests_owner on rakeezx.support_requests;
create trigger support_requests_owner before insert on rakeezx.support_requests
  for each row execute function rakeezx.force_owner();

alter table rakeezx.support_requests enable row level security;
alter table rakeezx.support_requests force row level security;
-- The teacher app may insert an own request, but has no browse/read/update/
-- delete surface. Staff access remains outside the teacher browser.
drop policy if exists support_requests_insert on rakeezx.support_requests;
create policy support_requests_insert on rakeezx.support_requests
  for insert to authenticated with check (owner_id = (select auth.uid()));

revoke all on table rakeezx.support_requests from public;
revoke all on table rakeezx.support_requests from anon;
revoke select, update, delete on table rakeezx.support_requests from authenticated;
grant insert on table rakeezx.support_requests to authenticated;

commit;
