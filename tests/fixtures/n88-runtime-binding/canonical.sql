-- AI fabricated canonical DATA SOURCE only. Exact queried columns/types from
-- core 0001 + revision 0012 + section lifecycle 0021. Not a replacement migration.
create schema rakeezx;
create table rakeezx.years(owner_id uuid,id text,status text,deleted_at timestamptz);
create table rakeezx.terms(owner_id uuid,id text,year_id text,status text,deleted_at timestamptz);
create table rakeezx.sections(owner_id uuid,id text,year_id text,status text,deleted_at timestamptz);
create table rakeezx.students(owner_id uuid,id text,name text,status text,deleted_at timestamptz);
create table rakeezx.enrollments(owner_id uuid,id text,section_id text,student_id text,revision bigint,status text,end_date date,deleted_at timestamptz);
create table rakeezx.teachings(owner_id uuid,id text,section_id text,term_id text,deleted_at timestamptz);
create table rakeezx.items(owner_id uuid,id text,teaching_id text,name text,auto text,deleted_at timestamptz);
insert into rakeezx.years values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','year','active',null);
insert into rakeezx.terms values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','term1','year','active',null),('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','term2','year','upcoming',null);
insert into rakeezx.sections values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','class1','year','active',null),('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','class2','year','active',null);
insert into rakeezx.students values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','student','SYNTHETIC STUDENT','active',null);
insert into rakeezx.enrollments values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','enrollment1','class1','student',1,'active',null,null);
insert into rakeezx.teachings values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','teaching1','class1','term1',null),('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','teaching2','class2','term2',null);
insert into rakeezx.items values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','item1','teaching1','CANONICAL TERM ONE',null,null),('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','item2','teaching2','CANONICAL TERM TWO',null,null);
insert into n88_private.contexts values('n88_runtime_synthetic_namespace_01','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
