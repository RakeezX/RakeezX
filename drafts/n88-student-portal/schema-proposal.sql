-- AI: DESIGN ONLY, outside migrations/functions. Never apply from this card.
-- Canonical enrollment adapter is NOT yet bound. This table illustrates required
-- immutable source keys/revision predicates; production MUST read canonical live
-- owner/student/enrollment/section lifecycle, not a delayed publication snapshot.
-- Future migration filename must be Supabase CLI-generated after separate authority.
create schema n88_private;
revoke all on schema n88_private from public;
create table n88_private.memberships (
  owner_id uuid not null, class_id text not null, student_id text not null,
  enrollment_id text not null, revision bigint not null check (revision >= 1),
  active boolean not null default false,
  primary key (owner_id, class_id, student_id, enrollment_id)
);
create table n88_private.invites (
  id uuid primary key, owner_id uuid not null, class_id text not null,
  student_id text not null, enrollment_id text not null, membership_revision bigint not null,
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz not null, consumed_at timestamptz, revoked_at timestamptz,
  foreign key (owner_id,class_id,student_id,enrollment_id)
    references n88_private.memberships(owner_id,class_id,student_id,enrollment_id)
);
create unique index n88_one_current_invite on n88_private.invites
  (owner_id,class_id,student_id,enrollment_id) where revoked_at is null;
create index n88_invite_retention on n88_private.invites(expires_at);
create table n88_private.sessions (
  id uuid primary key, invite_id uuid not null unique references n88_private.invites(id),
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz not null, revoked_at timestamptz
);
create index n88_session_retention on n88_private.sessions(expires_at);
create table n88_private.publications (
  id uuid primary key, owner_id uuid not null, class_id text not null,
  student_id text not null, enrollment_id text not null,
  source_teaching_id text not null, source_item_id text not null,
  title text not null check(length(title) between 1 and 160),
  instruction text not null default '' check(length(instruction)<=500),
  deadline date, status text not null check(status in ('todo','working','done')),
  published boolean not null default false,
  result_published boolean not null default false, result_value numeric, result_max numeric,
  check (not result_published or (result_value is not null and result_max is not null and
    result_max > 0 and result_value between 0 and result_max)),
  foreign key (owner_id,class_id,student_id,enrollment_id)
    references n88_private.memberships(owner_id,class_id,student_id,enrollment_id)
);
create index n88_published_student on n88_private.publications
  (owner_id,class_id,student_id,enrollment_id) where published;
alter table n88_private.memberships enable row level security;
alter table n88_private.invites enable row level security;
alter table n88_private.sessions enable row level security;
alter table n88_private.publications enable row level security;
revoke all on all tables in schema n88_private from public;
-- No exposed-schema grants or RLS policies: default deny to frontend roles.
-- Backend-only proposal: exact hash is the capability, never a browser-callable RPC.
-- Entire transaction must use the same membership->invite->session lock order for
-- issue/reissue/revoke/end-enrollment; no network wait inside a DB transaction.
create function n88_private.claim_invite(p_hash text, p_session_id uuid, p_session_hash text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare i n88_private.invites%rowtype; m n88_private.memberships%rowtype;
begin
  if p_hash !~ '^[a-f0-9]{64}$' or p_session_hash !~ '^[a-f0-9]{64}$' then return null; end if;
  select * into i from n88_private.invites where token_hash=p_hash;
  if not found then return null; end if;
  select * into m from n88_private.memberships
    where owner_id=i.owner_id and class_id=i.class_id and student_id=i.student_id
      and enrollment_id=i.enrollment_id for update;
  if not found or not m.active or m.revision<>i.membership_revision then return null; end if;
  select * into i from n88_private.invites where token_hash=p_hash for update;
  if not found or i.revoked_at is not null or i.consumed_at is not null or i.expires_at<=clock_timestamp() then return null; end if;
  update n88_private.invites set consumed_at=clock_timestamp() where id=i.id;
  insert into n88_private.sessions(id,invite_id,token_hash,expires_at)
    values(p_session_id,i.id,p_session_hash,clock_timestamp()+interval '8 hours');
  return p_session_id;
end $$;
revoke all on function n88_private.claim_invite(text,uuid,text) from public;
-- No GRANT here. Future dedicated backend permission/role and exposed schema audit
-- require exact authorization. No SECURITY DEFINER teacher function or arbitrary
-- supplied-owner write endpoint. Teacher issue/revoke must independently verify
-- current Auth user and recheck canonical owner+membership+revision under lock.
-- READ transaction: session hash -> invite -> current canonical membership, require
-- session/ invite unrevoked, session unexpired, exact owner/class/student/enrollment
-- and original revision; SELECT only publications with all four exact keys AND
-- published=true. Return title/instruction/status/deadline + explicit result only,
-- derive progress from that same snapshot. Never SELECT * into an HTTP response.
