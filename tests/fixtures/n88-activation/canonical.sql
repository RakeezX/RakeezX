-- AI: authored consumed-column/type/nullability/PK/FK replica. No provider SQL executed.
-- Auth owner/RLS/zero policies match hash-verified 03:46 addendum; no provider SQL executed.
create role anon nologin;create role authenticated nologin;
create role supabase_auth_admin nologin noinherit nobypassrls;
create role postgres nologin noinherit nosuperuser bypassrls createrole;
grant create on database postgres to postgres;
create schema auth;create table auth.users(id uuid primary key,banned_until timestamptz);
create table auth.sessions(id uuid primary key,user_id uuid not null references auth.users(id) on delete cascade,not_after timestamptz);
create schema rakeezx;
create table rakeezx.years(owner_id uuid not null,id text not null,status text not null,deleted_at timestamptz,revision int8 not null,primary key(owner_id,id),foreign key(owner_id) references auth.users(id) on delete cascade);
alter table rakeezx.years enable row level security;alter table rakeezx.years force row level security;
create table rakeezx.terms(owner_id uuid not null,id text not null,year_id text not null,status text not null,deleted_at timestamptz,revision int8 not null,primary key(owner_id,id),foreign key(owner_id) references auth.users(id) on delete cascade,foreign key(owner_id,year_id) references rakeezx.years(owner_id,id) on delete cascade);
alter table rakeezx.terms enable row level security;alter table rakeezx.terms force row level security;
create table rakeezx.sections(owner_id uuid not null,id text not null,year_id text not null,status text not null,deleted_at timestamptz,revision int8 not null,primary key(owner_id,id),foreign key(owner_id) references auth.users(id) on delete cascade,foreign key(owner_id,year_id) references rakeezx.years(owner_id,id) on delete cascade);
alter table rakeezx.sections enable row level security;alter table rakeezx.sections force row level security;
create table rakeezx.students(owner_id uuid not null,id text not null,name text not null,status text not null,deleted_at timestamptz,revision int8 not null,primary key(owner_id,id),foreign key(owner_id) references auth.users(id) on delete cascade);
alter table rakeezx.students enable row level security;alter table rakeezx.students force row level security;
create table rakeezx.enrollments(owner_id uuid not null,id text not null,section_id text not null,student_id text not null,revision int8 not null,status text not null,end_date date,deleted_at timestamptz,primary key(owner_id,id),foreign key(owner_id) references auth.users(id) on delete cascade,foreign key(owner_id,section_id) references rakeezx.sections(owner_id,id) on delete cascade,foreign key(owner_id,student_id) references rakeezx.students(owner_id,id) on delete cascade);
alter table rakeezx.enrollments enable row level security;alter table rakeezx.enrollments force row level security;
create table rakeezx.teachings(owner_id uuid not null,id text not null,section_id text not null,term_id text not null,deleted_at timestamptz,revision int8 not null,primary key(owner_id,id),foreign key(owner_id) references auth.users(id) on delete cascade,foreign key(owner_id,section_id) references rakeezx.sections(owner_id,id) on delete cascade,foreign key(owner_id,term_id) references rakeezx.terms(owner_id,id) on delete cascade);
alter table rakeezx.teachings enable row level security;alter table rakeezx.teachings force row level security;
create table rakeezx.items(owner_id uuid not null,id text not null,teaching_id text not null,name text not null,auto text,deleted_at timestamptz,revision int8 not null,primary key(owner_id,id),foreign key(owner_id) references auth.users(id) on delete cascade,foreign key(owner_id,teaching_id) references rakeezx.teachings(owner_id,id) on delete cascade);
alter table rakeezx.items enable row level security;alter table rakeezx.items force row level security;
insert into auth.users(id) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
insert into auth.sessions values('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',null);
insert into rakeezx.students(owner_id,id,name,status,revision) select id,'student','SYNTHETIC','active',1 from auth.users;
alter schema auth owner to supabase_auth_admin;
alter table auth.users owner to supabase_auth_admin;
alter table auth.sessions owner to supabase_auth_admin;
alter table auth.users enable row level security;
alter table auth.sessions enable row level security;
grant usage on schema auth to postgres;
grant select(id,banned_until),update(id) on auth.users to postgres;
grant select(id,user_id,not_after),update(id) on auth.sessions to postgres;
alter schema rakeezx owner to postgres;
do $$ declare t text;begin
  foreach t in array array['years','terms','sections','students','enrollments','teachings','items'] loop
    execute format('alter table rakeezx.%I owner to postgres',t);
  end loop;
end $$;
