-- AI: fabricated current canonical columns, immediate owner/composite FKs, no real data.
create role anon nologin;create role authenticated nologin;
create schema auth;
create table auth.users(id uuid primary key,banned_until timestamptz);
create table auth.sessions(id uuid primary key,user_id uuid not null references auth.users(id) on delete cascade,not_after timestamptz);
create function auth.uid() returns uuid language sql stable as $$select null::uuid$$;
insert into auth.users(id) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
insert into auth.sessions values('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',null),('22222222-2222-4222-8222-222222222222','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',null);
create schema rakeezx;
create table rakeezx.years(owner_id uuid not null references auth.users(id) on delete cascade,id text not null,revision bigint not null default 1,deleted_at timestamptz,status text,hijri_start integer,hijri_end integer,calendar_preset_id text,primary key(owner_id,id));
alter table rakeezx.years enable row level security;
create table rakeezx.subjects(owner_id uuid not null references auth.users(id) on delete cascade,id text not null,revision bigint not null default 1,deleted_at timestamptz,primary key(owner_id,id));
alter table rakeezx.subjects enable row level security;
create table rakeezx.sections(owner_id uuid not null references auth.users(id) on delete cascade,id text not null,revision bigint not null default 1,deleted_at timestamptz,year_id text,status text,primary key(owner_id,id),foreign key(owner_id,year_id) references rakeezx.years(owner_id,id) on delete cascade);
alter table rakeezx.sections enable row level security;
create table rakeezx.terms(owner_id uuid not null references auth.users(id) on delete cascade,id text not null,revision bigint not null default 1,deleted_at timestamptz,year_id text,"index" integer,status text,start_date date,end_date date,primary key(owner_id,id),foreign key(owner_id,year_id) references rakeezx.years(owner_id,id) on delete cascade);
alter table rakeezx.terms enable row level security;
create table rakeezx.calendars(owner_id uuid not null references auth.users(id) on delete cascade,id text not null,revision bigint not null default 1,deleted_at timestamptz,year_id text,source text,preset_id text,term_date_overrides jsonb default '{}',primary key(owner_id,id),foreign key(owner_id,year_id) references rakeezx.years(owner_id,id) on delete cascade);
alter table rakeezx.calendars enable row level security;
create table rakeezx.calendar_days(owner_id uuid not null references auth.users(id) on delete cascade,id text not null,revision bigint not null default 1,deleted_at timestamptz,calendar_id text,date date,kind text,primary key(owner_id,id),foreign key(owner_id,calendar_id) references rakeezx.calendars(owner_id,id) on delete cascade);
alter table rakeezx.calendar_days enable row level security;
create table rakeezx.teachings(owner_id uuid not null references auth.users(id) on delete cascade,id text not null,revision bigint not null default 1,deleted_at timestamptz,section_id text,subject_id text,term_id text,primary key(owner_id,id),foreign key(owner_id,section_id) references rakeezx.sections(owner_id,id) on delete cascade,foreign key(owner_id,subject_id) references rakeezx.subjects(owner_id,id) on delete cascade,foreign key(owner_id,term_id) references rakeezx.terms(owner_id,id) on delete cascade);
alter table rakeezx.teachings enable row level security;
create table rakeezx.items(owner_id uuid not null references auth.users(id) on delete cascade,id text not null,revision bigint not null default 1,deleted_at timestamptz,teaching_id text,score_mode text,primary key(owner_id,id),foreign key(owner_id,teaching_id) references rakeezx.teachings(owner_id,id) on delete cascade);
alter table rakeezx.items enable row level security;
create table rakeezx.score_subitems(owner_id uuid not null references auth.users(id) on delete cascade,id text not null,revision bigint not null default 1,deleted_at timestamptz,item_id text,start_date date,due_date date,primary key(owner_id,id),foreign key(owner_id,item_id) references rakeezx.items(owner_id,id) on delete cascade);
alter table rakeezx.score_subitems enable row level security;
create table rakeezx.sessions(owner_id uuid not null references auth.users(id) on delete cascade,id text not null,revision bigint not null default 1,deleted_at timestamptz,teaching_id text,date date,start_time time,end_time time,status text,primary key(owner_id,id),foreign key(owner_id,teaching_id) references rakeezx.teachings(owner_id,id) on delete cascade);
alter table rakeezx.sessions enable row level security;

-- AI: mirror the observed managed Auth RLS/ownership and existing management capability.
create role supabase_auth_admin nologin nosuperuser nobypassrls;
create role postgres nologin nosuperuser bypassrls;
alter table auth.users add column phone text;
alter table auth.users add column email_change_confirm_status smallint default 0;
alter table auth.users add constraint users_phone_key unique(phone);
alter table auth.users add constraint users_email_change_confirm_status_check check(email_change_confirm_status between 0 and 2);
create table auth.oauth_clients(id uuid primary key);
alter table auth.sessions add column oauth_client_id uuid references auth.oauth_clients(id) on delete cascade;
alter table auth.sessions add column scopes text;
alter table auth.sessions add constraint sessions_scopes_length check(char_length(scopes)<=4096);
alter schema auth owner to supabase_auth_admin;
alter table auth.users owner to supabase_auth_admin;
alter table auth.sessions owner to supabase_auth_admin;
alter table auth.users enable row level security;
alter table auth.sessions enable row level security;
grant usage on schema auth to postgres;
grant select(id,banned_until),update(id) on auth.users to postgres;
grant select(id,user_id,not_after),update(id) on auth.sessions to postgres;
-- No Auth policies, FORCE/BYPASS changes, auth CREATE, auth membership, or new public reader.

alter role postgres createrole noinherit; grant create on database postgres to postgres; alter schema rakeezx owner to postgres;
