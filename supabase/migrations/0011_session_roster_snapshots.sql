-- STU-HIST-01: immutable roster captured with the first attendance mutation.
-- One row contains one complete session roster so normal sync never exposes
-- a partially downloaded member list.

begin;

create table rakeezx.session_roster_snapshots (
  id                text not null,
  owner_id          uuid not null default auth.uid() references auth.users(id) on delete cascade,
  session_id        text not null,
  teaching_id       text not null,
  section_id        text not null,
  captured_at       timestamptz not null,
  members           jsonb not null default '[]'::jsonb check (jsonb_typeof(members) = 'array'),
  state             text not null default 'complete' check (state = 'complete'),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  client_updated_at bigint,
  device_id         text,
  deleted_at        timestamptz,
  primary key (owner_id, id),
  foreign key (owner_id, session_id) references rakeezx.sessions(owner_id, id) on delete cascade,
  foreign key (owner_id, teaching_id) references rakeezx.teachings(owner_id, id) on delete cascade,
  constraint session_roster_snapshots_session_uniq unique (owner_id, session_id)
);

create index session_roster_snapshots_sync_idx
  on rakeezx.session_roster_snapshots (owner_id, updated_at);
create index session_roster_snapshots_session_idx
  on rakeezx.session_roster_snapshots (owner_id, session_id);

create trigger session_roster_snapshots_owner before insert on rakeezx.session_roster_snapshots
  for each row execute function rakeezx.force_owner();
create trigger session_roster_snapshots_touch before insert or update on rakeezx.session_roster_snapshots
  for each row execute function rakeezx.touch_updated_at();

create or replace function rakeezx.guard_session_roster_snapshot()
returns trigger language plpgsql as $$
begin
  if old.deleted_at is not null and new.deleted_at is distinct from old.deleted_at then
    raise exception 'A deleted session roster snapshot cannot be restored';
  end if;
  if old.session_id is distinct from new.session_id
     or old.teaching_id is distinct from new.teaching_id
     or old.section_id is distinct from new.section_id
     or old.captured_at is distinct from new.captured_at
     or old.members is distinct from new.members
     or old.state is distinct from new.state then
    raise exception 'A session roster snapshot is immutable';
  end if;
  return new;
end;
$$;
create trigger session_roster_snapshots_immutable before update on rakeezx.session_roster_snapshots
  for each row execute function rakeezx.guard_session_roster_snapshot();

alter table rakeezx.session_roster_snapshots enable row level security;
alter table rakeezx.session_roster_snapshots force row level security;
create policy session_roster_snapshots_select on rakeezx.session_roster_snapshots for select to authenticated
  using (owner_id = (select auth.uid()));
create policy session_roster_snapshots_insert on rakeezx.session_roster_snapshots for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy session_roster_snapshots_update on rakeezx.session_roster_snapshots for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

commit;
