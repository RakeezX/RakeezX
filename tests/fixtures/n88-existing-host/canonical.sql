-- AI: fabricated subset with ACTUAL non-deferrable core owner/composite FKs.
create schema auth;
create table auth.users(id uuid primary key);
insert into auth.users values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
create table auth.sessions(id uuid primary key,user_id uuid not null references auth.users(id) on delete cascade,not_after timestamptz);
insert into auth.sessions values('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',null);
create schema rakeezx;
create table rakeezx.years(owner_id uuid not null references auth.users(id) on delete cascade,id text,status text,deleted_at timestamptz,revision bigint not null default 1,primary key(owner_id,id));
create table rakeezx.terms(owner_id uuid not null references auth.users(id) on delete cascade,id text,year_id text,status text,deleted_at timestamptz,revision bigint not null default 1,primary key(owner_id,id),foreign key(owner_id,year_id) references rakeezx.years(owner_id,id) on delete cascade);
create table rakeezx.sections(owner_id uuid not null references auth.users(id) on delete cascade,id text,year_id text,status text,deleted_at timestamptz,revision bigint not null default 1,primary key(owner_id,id),foreign key(owner_id,year_id) references rakeezx.years(owner_id,id) on delete cascade);
create table rakeezx.students(owner_id uuid not null references auth.users(id) on delete cascade,id text,name text,status text,deleted_at timestamptz,revision bigint not null default 1,primary key(owner_id,id));
create table rakeezx.enrollments(owner_id uuid not null references auth.users(id) on delete cascade,id text,section_id text,student_id text,revision bigint not null,status text,end_date date,deleted_at timestamptz,primary key(owner_id,id),foreign key(owner_id,section_id) references rakeezx.sections(owner_id,id) on delete cascade,foreign key(owner_id,student_id) references rakeezx.students(owner_id,id) on delete cascade,unique(owner_id,student_id,section_id));
create table rakeezx.teachings(owner_id uuid not null references auth.users(id) on delete cascade,id text,section_id text,term_id text,deleted_at timestamptz,revision bigint not null default 1,primary key(owner_id,id),foreign key(owner_id,section_id) references rakeezx.sections(owner_id,id) on delete cascade,foreign key(owner_id,term_id) references rakeezx.terms(owner_id,id) on delete cascade);
create table rakeezx.items(owner_id uuid not null references auth.users(id) on delete cascade,id text,teaching_id text,name text,auto text,deleted_at timestamptz,revision bigint not null default 1,primary key(owner_id,id),foreign key(owner_id,teaching_id) references rakeezx.teachings(owner_id,id) on delete cascade);
-- Synthetic counterpart to 0012 revision stamps: every write advances revision.
create function rakeezx.fixture_revision() returns trigger language plpgsql as $$ begin new.revision:=old.revision+1;return new;end $$;
do $$ declare t text;begin foreach t in array array['years','terms','sections','students','enrollments','teachings','items'] loop execute format('create trigger fixture_revision before update on rakeezx.%I for each row execute function rakeezx.fixture_revision()',t);end loop;end $$;
insert into rakeezx.years values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','year','active',null);
insert into rakeezx.terms values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','term1','year','active',null),('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','term2','year','upcoming',null);
insert into rakeezx.sections values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','class1','year','active',null),('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','class2','year','active',null);
insert into rakeezx.students values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','student','SYNTHETIC STUDENT','active',null);
insert into rakeezx.enrollments values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','enrollment1','class1','student',1,'active',null,null);
insert into rakeezx.teachings values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','teaching1','class1','term1',null),('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','teaching2','class2','term2',null);
insert into rakeezx.items values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','item1','teaching1','CANONICAL TERM ONE',null,null),('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','item2','teaching2','CANONICAL TERM TWO',null,null);
insert into n88_private.contexts values('n88_runtime_synthetic_namespace_01','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);

insert into rakeezx.years values('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','year','active',null);
insert into rakeezx.sections values('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','class1','year','active',null);
insert into rakeezx.students values('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','student','OTHER SYNTHETIC','active',null);
insert into rakeezx.enrollments values('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','enrollment1','class1','student',1,'active',null,null);

-- Source RLS enabled just as in core schema; tested private role policies must work.
do $$ declare t text;begin foreach t in array array['years','terms','sections','students','enrollments','teachings','items'] loop execute format('alter table rakeezx.%I enable row level security',t);end loop;end $$;
