-- AI-authored. Append-only N88 private typed error boundary. Original six migrations unchanged.
begin;
set local lock_timeout='2s';
set local statement_timeout='30s';
do $n88_preflight$ begin
 if current_user<>'postgres' or to_regclass('n88_private.task_guidance') is null
 or not exists(select 1 from pg_roles where rolname='n88_backend' and not rolsuper and not rolbypassrls and not rolcreaterole and not rolcreatedb and not rolreplication)
 or (select pg_get_userbyid(nspowner) from pg_namespace where nspname='n88_private') is distinct from 'postgres'
 or has_schema_privilege('anon','n88_private','usage') or has_schema_privilege('authenticated','n88_private','usage')
 or exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='n88_private' and p.proname like 'boundary_%') then
 raise exception 'n88_boundary_preflight_unavailable';
 end if;
end $n88_preflight$;
create function n88_private.boundary_7df61daf6fc50a8d06ed8a29(p1 text) returns table(affected bigint)
language plpgsql security invoker set search_path=pg_catalog
as $n88_boundary$
#variable_conflict use_column
declare
v1 text;
state text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::text;
delete from n88_private.class_credential_receipts where row_key=v1;
get diagnostics affected=row_count;
return next;
exception when others or query_canceled or assert_failure then
get stacked diagnostics state=returned_sqlstate;
raise exception using errcode=state,message='n88_private_database_error',detail='',hint='';
end;
$n88_boundary$;
revoke all on function n88_private.boundary_7df61daf6fc50a8d06ed8a29(text) from public,anon,authenticated;
grant execute on function n88_private.boundary_7df61daf6fc50a8d06ed8a29(text) to n88_backend;
create function n88_private.boundary_3d90c7fa0fac5598b1e1bb6c(p1 text) returns table(affected bigint)
language plpgsql security invoker set search_path=pg_catalog
as $n88_boundary$
#variable_conflict use_column
declare
v1 text;
state text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::text;
delete from n88_private.contexts where namespace=v1;
get diagnostics affected=row_count;
return next;
exception when others or query_canceled or assert_failure then
get stacked diagnostics state=returned_sqlstate;
raise exception using errcode=state,message='n88_private_database_error',detail='',hint='';
end;
$n88_boundary$;
revoke all on function n88_private.boundary_3d90c7fa0fac5598b1e1bb6c(text) from public,anon,authenticated;
grant execute on function n88_private.boundary_3d90c7fa0fac5598b1e1bb6c(text) to n88_backend;
create function n88_private.boundary_3212e88aaa7d7eb7950a7158(p1 text) returns table(affected bigint)
language plpgsql security invoker set search_path=pg_catalog
as $n88_boundary$
#variable_conflict use_column
declare
v1 uuid;
state text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::uuid;
delete from n88_private.credentials where id=v1;
get diagnostics affected=row_count;
return next;
exception when others or query_canceled or assert_failure then
get stacked diagnostics state=returned_sqlstate;
raise exception using errcode=state,message='n88_private_database_error',detail='',hint='';
end;
$n88_boundary$;
revoke all on function n88_private.boundary_3212e88aaa7d7eb7950a7158(text) from public,anon,authenticated;
grant execute on function n88_private.boundary_3212e88aaa7d7eb7950a7158(text) to n88_backend;
create function n88_private.boundary_0886008cf6c0da2968564042(p1 text) returns table(affected bigint)
language plpgsql security invoker set search_path=pg_catalog
as $n88_boundary$
#variable_conflict use_column
declare
v1 text;
state text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::text;
delete from n88_private.guess_budgets where key=v1;
get diagnostics affected=row_count;
return next;
exception when others or query_canceled or assert_failure then
get stacked diagnostics state=returned_sqlstate;
raise exception using errcode=state,message='n88_private_database_error',detail='',hint='';
end;
$n88_boundary$;
revoke all on function n88_private.boundary_0886008cf6c0da2968564042(text) from public,anon,authenticated;
grant execute on function n88_private.boundary_0886008cf6c0da2968564042(text) to n88_backend;
create function n88_private.boundary_8ab6a6674ff3f98609cccf79(p1 text,p2 text,p3 text,p4 text) returns table(affected bigint)
language plpgsql security invoker set search_path=pg_catalog
as $n88_boundary$
#variable_conflict use_column
declare
v1 uuid;
v2 text;
v3 text;
v4 text;
state text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::uuid;
v2:=convert_from(decode(p2,'base64'),'UTF8')::text;
v3:=convert_from(decode(p3,'base64'),'UTF8')::text;
v4:=convert_from(decode(p4,'base64'),'UTF8')::text;
delete from n88_private.memberships where owner_id=v1 and class_id=v2 and student_id=v3 and enrollment_id=v4;
get diagnostics affected=row_count;
return next;
exception when others or query_canceled or assert_failure then
get stacked diagnostics state=returned_sqlstate;
raise exception using errcode=state,message='n88_private_database_error',detail='',hint='';
end;
$n88_boundary$;
revoke all on function n88_private.boundary_8ab6a6674ff3f98609cccf79(text,text,text,text) from public,anon,authenticated;
grant execute on function n88_private.boundary_8ab6a6674ff3f98609cccf79(text,text,text,text) to n88_backend;
create function n88_private.boundary_541e1603c6f1fd9d4bfd9638(p1 text) returns table(affected bigint)
language plpgsql security invoker set search_path=pg_catalog
as $n88_boundary$
#variable_conflict use_column
declare
v1 text;
state text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::text;
delete from n88_private.numeric_attempts where row_key=v1;
get diagnostics affected=row_count;
return next;
exception when others or query_canceled or assert_failure then
get stacked diagnostics state=returned_sqlstate;
raise exception using errcode=state,message='n88_private_database_error',detail='',hint='';
end;
$n88_boundary$;
revoke all on function n88_private.boundary_541e1603c6f1fd9d4bfd9638(text) from public,anon,authenticated;
grant execute on function n88_private.boundary_541e1603c6f1fd9d4bfd9638(text) to n88_backend;
create function n88_private.boundary_bf3541bec260c19aeaf147e0(p1 text) returns table(affected bigint)
language plpgsql security invoker set search_path=pg_catalog
as $n88_boundary$
#variable_conflict use_column
declare
v1 text;
state text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::text;
delete from n88_private.numeric_credentials where row_key=v1;
get diagnostics affected=row_count;
return next;
exception when others or query_canceled or assert_failure then
get stacked diagnostics state=returned_sqlstate;
raise exception using errcode=state,message='n88_private_database_error',detail='',hint='';
end;
$n88_boundary$;
revoke all on function n88_private.boundary_bf3541bec260c19aeaf147e0(text) from public,anon,authenticated;
grant execute on function n88_private.boundary_bf3541bec260c19aeaf147e0(text) to n88_backend;
create function n88_private.boundary_f824c60ac8562824f8a15aeb(p1 text) returns table(affected bigint)
language plpgsql security invoker set search_path=pg_catalog
as $n88_boundary$
#variable_conflict use_column
declare
v1 text;
state text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::text;
delete from n88_private.numeric_rates where row_key=v1;
get diagnostics affected=row_count;
return next;
exception when others or query_canceled or assert_failure then
get stacked diagnostics state=returned_sqlstate;
raise exception using errcode=state,message='n88_private_database_error',detail='',hint='';
end;
$n88_boundary$;
revoke all on function n88_private.boundary_f824c60ac8562824f8a15aeb(text) from public,anon,authenticated;
grant execute on function n88_private.boundary_f824c60ac8562824f8a15aeb(text) to n88_backend;
create function n88_private.boundary_82d5bc8d4ddbfb141c068308(p1 text) returns table(affected bigint)
language plpgsql security invoker set search_path=pg_catalog
as $n88_boundary$
#variable_conflict use_column
declare
v1 text;
state text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::text;
delete from n88_private.numeric_sessions where row_key=v1;
get diagnostics affected=row_count;
return next;
exception when others or query_canceled or assert_failure then
get stacked diagnostics state=returned_sqlstate;
raise exception using errcode=state,message='n88_private_database_error',detail='',hint='';
end;
$n88_boundary$;
revoke all on function n88_private.boundary_82d5bc8d4ddbfb141c068308(text) from public,anon,authenticated;
grant execute on function n88_private.boundary_82d5bc8d4ddbfb141c068308(text) to n88_backend;
create function n88_private.boundary_7405cad4b228853c8a7a5267(p1 text) returns table(affected bigint)
language plpgsql security invoker set search_path=pg_catalog
as $n88_boundary$
#variable_conflict use_column
declare
v1 uuid;
state text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::uuid;
delete from n88_private.publications where id=v1;
get diagnostics affected=row_count;
return next;
exception when others or query_canceled or assert_failure then
get stacked diagnostics state=returned_sqlstate;
raise exception using errcode=state,message='n88_private_database_error',detail='',hint='';
end;
$n88_boundary$;
revoke all on function n88_private.boundary_7405cad4b228853c8a7a5267(text) from public,anon,authenticated;
grant execute on function n88_private.boundary_7405cad4b228853c8a7a5267(text) to n88_backend;
create function n88_private.boundary_d556945d2d95f6add8f9ccb4(p1 text) returns table(affected bigint)
language plpgsql security invoker set search_path=pg_catalog
as $n88_boundary$
#variable_conflict use_column
declare
v1 uuid;
state text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::uuid;
delete from n88_private.sessions where id=v1;
get diagnostics affected=row_count;
return next;
exception when others or query_canceled or assert_failure then
get stacked diagnostics state=returned_sqlstate;
raise exception using errcode=state,message='n88_private_database_error',detail='',hint='';
end;
$n88_boundary$;
revoke all on function n88_private.boundary_d556945d2d95f6add8f9ccb4(text) from public,anon,authenticated;
grant execute on function n88_private.boundary_d556945d2d95f6add8f9ccb4(text) to n88_backend;
create function n88_private.boundary_5bd93436112ac6e1081b19e5(p1 text,p2 text) returns table(affected bigint)
language plpgsql security invoker set search_path=pg_catalog
as $n88_boundary$
#variable_conflict use_column
declare
v1 text;
v2 jsonb;
state text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::text;
v2:=convert_from(decode(p2,'base64'),'UTF8')::jsonb;
insert into n88_private.class_credential_receipts(row_key,payload) values(v1,v2::jsonb);
get diagnostics affected=row_count;
return next;
exception when others or query_canceled or assert_failure then
get stacked diagnostics state=returned_sqlstate;
raise exception using errcode=state,message='n88_private_database_error',detail='',hint='';
end;
$n88_boundary$;
revoke all on function n88_private.boundary_5bd93436112ac6e1081b19e5(text,text) from public,anon,authenticated;
grant execute on function n88_private.boundary_5bd93436112ac6e1081b19e5(text,text) to n88_backend;
create function n88_private.boundary_3cfa500ea5d8a72f35432655(p1 text,p2 text) returns table(affected bigint)
language plpgsql security invoker set search_path=pg_catalog
as $n88_boundary$
#variable_conflict use_column
declare
v1 text;
v2 jsonb;
state text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::text;
v2:=convert_from(decode(p2,'base64'),'UTF8')::jsonb;
insert into n88_private.class_credential_receipts(row_key,payload) values(v1,v2::jsonb) on conflict(row_key) do update set payload=excluded.payload;
get diagnostics affected=row_count;
return next;
exception when others or query_canceled or assert_failure then
get stacked diagnostics state=returned_sqlstate;
raise exception using errcode=state,message='n88_private_database_error',detail='',hint='';
end;
$n88_boundary$;
revoke all on function n88_private.boundary_3cfa500ea5d8a72f35432655(text,text) from public,anon,authenticated;
grant execute on function n88_private.boundary_3cfa500ea5d8a72f35432655(text,text) to n88_backend;
create function n88_private.boundary_98693bf59f6ec88385d1a2e8(p1 text,p2 text,p3 text,p4 text) returns table(affected bigint)
language plpgsql security invoker set search_path=pg_catalog
as $n88_boundary$
#variable_conflict use_column
declare
v1 uuid;
v2 text;
v3 text;
v4 jsonb;
state text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::uuid;
v2:=convert_from(decode(p2,'base64'),'UTF8')::text;
v3:=convert_from(decode(p3,'base64'),'UTF8')::text;
v4:=convert_from(decode(p4,'base64'),'UTF8')::jsonb;
insert into n88_private.class_visibility(owner_id,class_id,term_id,payload) values(v1::uuid,v2,v3,v4::jsonb) on conflict(owner_id,class_id,term_id) do update set payload=excluded.payload;
get diagnostics affected=row_count;
return next;
exception when others or query_canceled or assert_failure then
get stacked diagnostics state=returned_sqlstate;
raise exception using errcode=state,message='n88_private_database_error',detail='',hint='';
end;
$n88_boundary$;
revoke all on function n88_private.boundary_98693bf59f6ec88385d1a2e8(text,text,text,text) from public,anon,authenticated;
grant execute on function n88_private.boundary_98693bf59f6ec88385d1a2e8(text,text,text,text) to n88_backend;
create function n88_private.boundary_ac418692d93da9a37ef4d438(p1 text,p2 text) returns table(affected bigint)
language plpgsql security invoker set search_path=pg_catalog
as $n88_boundary$
#variable_conflict use_column
declare
v1 text;
v2 jsonb;
state text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::text;
v2:=convert_from(decode(p2,'base64'),'UTF8')::jsonb;
insert into n88_private.code_recovery(row_key,payload) values(v1,v2::jsonb) on conflict(key_version,nonce) do nothing;
get diagnostics affected=row_count;
return next;
exception when others or query_canceled or assert_failure then
get stacked diagnostics state=returned_sqlstate;
raise exception using errcode=state,message='n88_private_database_error',detail='',hint='';
end;
$n88_boundary$;
revoke all on function n88_private.boundary_ac418692d93da9a37ef4d438(text,text) from public,anon,authenticated;
grant execute on function n88_private.boundary_ac418692d93da9a37ef4d438(text,text) to n88_backend;
create function n88_private.boundary_857bc5c5bf5d0480e3feddef(p1 text,p2 text,p3 text) returns table(affected bigint)
language plpgsql security invoker set search_path=pg_catalog
as $n88_boundary$
#variable_conflict use_column
declare
v1 text;
v2 uuid;
v3 boolean;
state text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::text;
v2:=convert_from(decode(p2,'base64'),'UTF8')::uuid;
v3:=convert_from(decode(p3,'base64'),'UTF8')::boolean;
insert into n88_private.contexts (namespace,owner_id,active) values (v1,v2,v3);
get diagnostics affected=row_count;
return next;
exception when others or query_canceled or assert_failure then
get stacked diagnostics state=returned_sqlstate;
raise exception using errcode=state,message='n88_private_database_error',detail='',hint='';
end;
$n88_boundary$;
revoke all on function n88_private.boundary_857bc5c5bf5d0480e3feddef(text,text,text) from public,anon,authenticated;
grant execute on function n88_private.boundary_857bc5c5bf5d0480e3feddef(text,text,text) to n88_backend;
create function n88_private.boundary_8505c9e47aa85eab7abcbe9a(p1 text,p2 text,p3 text,p4 text,p5 text,p6 text,p7 text,p8 text) returns table(affected bigint)
language plpgsql security invoker set search_path=pg_catalog
as $n88_boundary$
#variable_conflict use_column
declare
v1 uuid;
v2 text;
v3 uuid;
v4 text;
v5 bigint;
v6 text;
v7 text;
v8 timestamp with time zone;
state text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::uuid;
v2:=convert_from(decode(p2,'base64'),'UTF8')::text;
v3:=convert_from(decode(p3,'base64'),'UTF8')::uuid;
v4:=convert_from(decode(p4,'base64'),'UTF8')::text;
v5:=convert_from(decode(p5,'base64'),'UTF8')::bigint;
v6:=convert_from(decode(p6,'base64'),'UTF8')::text;
v7:=convert_from(decode(p7,'base64'),'UTF8')::text;
v8:=convert_from(decode(p8,'base64'),'UTF8')::timestamp with time zone;
insert into n88_private.credentials (id,namespace,owner_id,student_id,version,verifier,entry_verifier,revoked_at) values (v1,v2,v3,v4,v5,v6,v7,v8);
get diagnostics affected=row_count;
return next;
exception when others or query_canceled or assert_failure then
get stacked diagnostics state=returned_sqlstate;
raise exception using errcode=state,message='n88_private_database_error',detail='',hint='';
end;
$n88_boundary$;
revoke all on function n88_private.boundary_8505c9e47aa85eab7abcbe9a(text,text,text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function n88_private.boundary_8505c9e47aa85eab7abcbe9a(text,text,text,text,text,text,text,text) to n88_backend;
create function n88_private.boundary_ec7d0eb73f55bc0a5eb0503e(p1 text,p2 text,p3 text) returns table(affected bigint)
language plpgsql security invoker set search_path=pg_catalog
as $n88_boundary$
#variable_conflict use_column
declare
v1 text;
v2 integer;
v3 timestamp with time zone;
state text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::text;
v2:=convert_from(decode(p2,'base64'),'UTF8')::integer;
v3:=convert_from(decode(p3,'base64'),'UTF8')::timestamp with time zone;
insert into n88_private.guess_budgets (key,count,until_at) values (v1,v2,v3);
get diagnostics affected=row_count;
return next;
exception when others or query_canceled or assert_failure then
get stacked diagnostics state=returned_sqlstate;
raise exception using errcode=state,message='n88_private_database_error',detail='',hint='';
end;
$n88_boundary$;
revoke all on function n88_private.boundary_ec7d0eb73f55bc0a5eb0503e(text,text,text) from public,anon,authenticated;
grant execute on function n88_private.boundary_ec7d0eb73f55bc0a5eb0503e(text,text,text) to n88_backend;
create function n88_private.boundary_39534a0df755e773bcc021c2(p1 text,p2 text,p3 text,p4 text,p5 text,p6 text,p7 text,p8 text,p9 text,p10 text,p11 text,p12 text) returns table(affected bigint)
language plpgsql security invoker set search_path=pg_catalog
as $n88_boundary$
#variable_conflict use_column
declare
v1 uuid;
v2 text;
v3 text;
v4 text;
v5 bigint;
v6 text;
v7 date;
v8 boolean;
v9 boolean;
v10 text;
v11 text;
v12 boolean;
state text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::uuid;
v2:=convert_from(decode(p2,'base64'),'UTF8')::text;
v3:=convert_from(decode(p3,'base64'),'UTF8')::text;
v4:=convert_from(decode(p4,'base64'),'UTF8')::text;
v5:=convert_from(decode(p5,'base64'),'UTF8')::bigint;
v6:=convert_from(decode(p6,'base64'),'UTF8')::text;
v7:=convert_from(decode(p7,'base64'),'UTF8')::date;
v8:=convert_from(decode(p8,'base64'),'UTF8')::boolean;
v9:=convert_from(decode(p9,'base64'),'UTF8')::boolean;
v10:=convert_from(decode(p10,'base64'),'UTF8')::text;
v11:=convert_from(decode(p11,'base64'),'UTF8')::text;
v12:=convert_from(decode(p12,'base64'),'UTF8')::boolean;
insert into n88_private.memberships (owner_id,class_id,student_id,enrollment_id,revision,status,end_date,student_active,class_active,label,canonical_stamp,active) values (v1,v2,v3,v4,v5,v6,v7,v8,v9,v10,v11,v12);
get diagnostics affected=row_count;
return next;
exception when others or query_canceled or assert_failure then
get stacked diagnostics state=returned_sqlstate;
raise exception using errcode=state,message='n88_private_database_error',detail='',hint='';
end;
$n88_boundary$;
revoke all on function n88_private.boundary_39534a0df755e773bcc021c2(text,text,text,text,text,text,text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function n88_private.boundary_39534a0df755e773bcc021c2(text,text,text,text,text,text,text,text,text,text,text,text) to n88_backend;
create function n88_private.boundary_2a8e33366f34f64e735098e6(p1 text,p2 text) returns table(affected bigint)
language plpgsql security invoker set search_path=pg_catalog
as $n88_boundary$
#variable_conflict use_column
declare
v1 text;
v2 jsonb;
state text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::text;
v2:=convert_from(decode(p2,'base64'),'UTF8')::jsonb;
insert into n88_private.numeric_attempts(row_key,payload) values(v1,v2::jsonb);
get diagnostics affected=row_count;
return next;
exception when others or query_canceled or assert_failure then
get stacked diagnostics state=returned_sqlstate;
raise exception using errcode=state,message='n88_private_database_error',detail='',hint='';
end;
$n88_boundary$;
revoke all on function n88_private.boundary_2a8e33366f34f64e735098e6(text,text) from public,anon,authenticated;
grant execute on function n88_private.boundary_2a8e33366f34f64e735098e6(text,text) to n88_backend;
create function n88_private.boundary_529c57f7292a540a297bb56a(p1 text,p2 text) returns table(affected bigint)
language plpgsql security invoker set search_path=pg_catalog
as $n88_boundary$
#variable_conflict use_column
declare
v1 text;
v2 jsonb;
state text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::text;
v2:=convert_from(decode(p2,'base64'),'UTF8')::jsonb;
insert into n88_private.numeric_attempts(row_key,payload) values(v1,v2::jsonb) on conflict(row_key) do update set payload=excluded.payload;
get diagnostics affected=row_count;
return next;
exception when others or query_canceled or assert_failure then
get stacked diagnostics state=returned_sqlstate;
raise exception using errcode=state,message='n88_private_database_error',detail='',hint='';
end;
$n88_boundary$;
revoke all on function n88_private.boundary_529c57f7292a540a297bb56a(text,text) from public,anon,authenticated;
grant execute on function n88_private.boundary_529c57f7292a540a297bb56a(text,text) to n88_backend;
create function n88_private.boundary_9e91362aab78847b4a47db61(p1 text,p2 text) returns table(affected bigint)
language plpgsql security invoker set search_path=pg_catalog
as $n88_boundary$
#variable_conflict use_column
declare
v1 text;
v2 jsonb;
state text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::text;
v2:=convert_from(decode(p2,'base64'),'UTF8')::jsonb;
insert into n88_private.numeric_credentials(row_key,payload) values(v1,v2::jsonb);
get diagnostics affected=row_count;
return next;
exception when others or query_canceled or assert_failure then
get stacked diagnostics state=returned_sqlstate;
raise exception using errcode=state,message='n88_private_database_error',detail='',hint='';
end;
$n88_boundary$;
revoke all on function n88_private.boundary_9e91362aab78847b4a47db61(text,text) from public,anon,authenticated;
grant execute on function n88_private.boundary_9e91362aab78847b4a47db61(text,text) to n88_backend;
create function n88_private.boundary_b594ab1d10c68ceac544f2f4(p1 text,p2 text) returns table(affected bigint)
language plpgsql security invoker set search_path=pg_catalog
as $n88_boundary$
#variable_conflict use_column
declare
v1 text;
v2 jsonb;
state text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::text;
v2:=convert_from(decode(p2,'base64'),'UTF8')::jsonb;
insert into n88_private.numeric_credentials(row_key,payload) values(v1,v2::jsonb) on conflict(row_key) do update set payload=excluded.payload;
get diagnostics affected=row_count;
return next;
exception when others or query_canceled or assert_failure then
get stacked diagnostics state=returned_sqlstate;
raise exception using errcode=state,message='n88_private_database_error',detail='',hint='';
end;
$n88_boundary$;
revoke all on function n88_private.boundary_b594ab1d10c68ceac544f2f4(text,text) from public,anon,authenticated;
grant execute on function n88_private.boundary_b594ab1d10c68ceac544f2f4(text,text) to n88_backend;
create function n88_private.boundary_576116ad97aa1134011b5787(p1 text,p2 text) returns table(affected bigint)
language plpgsql security invoker set search_path=pg_catalog
as $n88_boundary$
#variable_conflict use_column
declare
v1 text;
v2 jsonb;
state text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::text;
v2:=convert_from(decode(p2,'base64'),'UTF8')::jsonb;
insert into n88_private.numeric_rates(row_key,payload) values(v1,v2::jsonb);
get diagnostics affected=row_count;
return next;
exception when others or query_canceled or assert_failure then
get stacked diagnostics state=returned_sqlstate;
raise exception using errcode=state,message='n88_private_database_error',detail='',hint='';
end;
$n88_boundary$;
revoke all on function n88_private.boundary_576116ad97aa1134011b5787(text,text) from public,anon,authenticated;
grant execute on function n88_private.boundary_576116ad97aa1134011b5787(text,text) to n88_backend;
create function n88_private.boundary_54df59eab3551edda375b0b3(p1 text,p2 text) returns table(affected bigint)
language plpgsql security invoker set search_path=pg_catalog
as $n88_boundary$
#variable_conflict use_column
declare
v1 text;
v2 jsonb;
state text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::text;
v2:=convert_from(decode(p2,'base64'),'UTF8')::jsonb;
insert into n88_private.numeric_rates(row_key,payload) values(v1,v2::jsonb) on conflict(row_key) do update set payload=excluded.payload;
get diagnostics affected=row_count;
return next;
exception when others or query_canceled or assert_failure then
get stacked diagnostics state=returned_sqlstate;
raise exception using errcode=state,message='n88_private_database_error',detail='',hint='';
end;
$n88_boundary$;
revoke all on function n88_private.boundary_54df59eab3551edda375b0b3(text,text) from public,anon,authenticated;
grant execute on function n88_private.boundary_54df59eab3551edda375b0b3(text,text) to n88_backend;
create function n88_private.boundary_0ea5712c847150d0ad160f76(p1 text,p2 text) returns table(affected bigint)
language plpgsql security invoker set search_path=pg_catalog
as $n88_boundary$
#variable_conflict use_column
declare
v1 text;
v2 jsonb;
state text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::text;
v2:=convert_from(decode(p2,'base64'),'UTF8')::jsonb;
insert into n88_private.numeric_sessions(row_key,payload) values(v1,v2::jsonb);
get diagnostics affected=row_count;
return next;
exception when others or query_canceled or assert_failure then
get stacked diagnostics state=returned_sqlstate;
raise exception using errcode=state,message='n88_private_database_error',detail='',hint='';
end;
$n88_boundary$;
revoke all on function n88_private.boundary_0ea5712c847150d0ad160f76(text,text) from public,anon,authenticated;
grant execute on function n88_private.boundary_0ea5712c847150d0ad160f76(text,text) to n88_backend;
create function n88_private.boundary_a71168a3808c25e88da242ab(p1 text,p2 text) returns table(affected bigint)
language plpgsql security invoker set search_path=pg_catalog
as $n88_boundary$
#variable_conflict use_column
declare
v1 text;
v2 jsonb;
state text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::text;
v2:=convert_from(decode(p2,'base64'),'UTF8')::jsonb;
insert into n88_private.numeric_sessions(row_key,payload) values(v1,v2::jsonb) on conflict(row_key) do update set payload=excluded.payload;
get diagnostics affected=row_count;
return next;
exception when others or query_canceled or assert_failure then
get stacked diagnostics state=returned_sqlstate;
raise exception using errcode=state,message='n88_private_database_error',detail='',hint='';
end;
$n88_boundary$;
revoke all on function n88_private.boundary_a71168a3808c25e88da242ab(text,text) from public,anon,authenticated;
grant execute on function n88_private.boundary_a71168a3808c25e88da242ab(text,text) to n88_backend;
create function n88_private.boundary_944e29878190b042600a43aa(p1 text,p2 text,p3 text,p4 text,p5 text,p6 text,p7 text,p8 text,p9 text,p10 text,p11 text,p12 text) returns table(affected bigint)
language plpgsql security invoker set search_path=pg_catalog
as $n88_boundary$
#variable_conflict use_column
declare
v1 uuid;
v2 uuid;
v3 text;
v4 text;
v5 text;
v6 text;
v7 text;
v8 text;
v9 text;
v10 date;
v11 text;
v12 boolean;
state text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::uuid;
v2:=convert_from(decode(p2,'base64'),'UTF8')::uuid;
v3:=convert_from(decode(p3,'base64'),'UTF8')::text;
v4:=convert_from(decode(p4,'base64'),'UTF8')::text;
v5:=convert_from(decode(p5,'base64'),'UTF8')::text;
v6:=convert_from(decode(p6,'base64'),'UTF8')::text;
v7:=convert_from(decode(p7,'base64'),'UTF8')::text;
v8:=convert_from(decode(p8,'base64'),'UTF8')::text;
v9:=convert_from(decode(p9,'base64'),'UTF8')::text;
v10:=convert_from(decode(p10,'base64'),'UTF8')::date;
v11:=convert_from(decode(p11,'base64'),'UTF8')::text;
v12:=convert_from(decode(p12,'base64'),'UTF8')::boolean;
insert into n88_private.publications (id,owner_id,class_id,student_id,enrollment_id,source_teaching_id,source_item_id,title,instruction,deadline,status,published) values (v1,v2,v3,v4,v5,v6,v7,v8,v9,v10,v11,v12);
get diagnostics affected=row_count;
return next;
exception when others or query_canceled or assert_failure then
get stacked diagnostics state=returned_sqlstate;
raise exception using errcode=state,message='n88_private_database_error',detail='',hint='';
end;
$n88_boundary$;
revoke all on function n88_private.boundary_944e29878190b042600a43aa(text,text,text,text,text,text,text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function n88_private.boundary_944e29878190b042600a43aa(text,text,text,text,text,text,text,text,text,text,text,text) to n88_backend;
create function n88_private.boundary_7f808429affeb651ad77cae5(p1 text,p2 text,p3 text,p4 text,p5 text,p6 text,p7 text,p8 text,p9 text,p10 text,p11 text,p12 text,p13 text,p14 text) returns table(affected bigint)
language plpgsql security invoker set search_path=pg_catalog
as $n88_boundary$
#variable_conflict use_column
declare
v1 uuid;
v2 uuid;
v3 text;
v4 uuid;
v5 text;
v6 text;
v7 text;
v8 bigint;
v9 bigint;
v10 text;
v11 text;
v12 timestamp with time zone;
v13 timestamp with time zone;
v14 text;
state text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::uuid;
v2:=convert_from(decode(p2,'base64'),'UTF8')::uuid;
v3:=convert_from(decode(p3,'base64'),'UTF8')::text;
v4:=convert_from(decode(p4,'base64'),'UTF8')::uuid;
v5:=convert_from(decode(p5,'base64'),'UTF8')::text;
v6:=convert_from(decode(p6,'base64'),'UTF8')::text;
v7:=convert_from(decode(p7,'base64'),'UTF8')::text;
v8:=convert_from(decode(p8,'base64'),'UTF8')::bigint;
v9:=convert_from(decode(p9,'base64'),'UTF8')::bigint;
v10:=convert_from(decode(p10,'base64'),'UTF8')::text;
v11:=convert_from(decode(p11,'base64'),'UTF8')::text;
v12:=convert_from(decode(p12,'base64'),'UTF8')::timestamp with time zone;
v13:=convert_from(decode(p13,'base64'),'UTF8')::timestamp with time zone;
v14:=convert_from(decode(p14,'base64'),'UTF8')::text;
insert into n88_private.sessions (id,credential_id,namespace,owner_id,class_id,student_id,enrollment_id,version,membership_revision,entry_verifier,token_hash,expires_at,revoked_at,canonical_stamp) values (v1,v2,v3,v4,v5,v6,v7,v8,v9,v10,v11,v12,v13,v14);
get diagnostics affected=row_count;
return next;
exception when others or query_canceled or assert_failure then
get stacked diagnostics state=returned_sqlstate;
raise exception using errcode=state,message='n88_private_database_error',detail='',hint='';
end;
$n88_boundary$;
revoke all on function n88_private.boundary_7f808429affeb651ad77cae5(text,text,text,text,text,text,text,text,text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function n88_private.boundary_7f808429affeb651ad77cae5(text,text,text,text,text,text,text,text,text,text,text,text,text,text) to n88_backend;
create function n88_private.boundary_0f039dccf91dfe6f4bc30ece(p1 text,p2 text,p3 text,p4 text,p5 text,p6 text) returns table(affected bigint)
language plpgsql security invoker set search_path=pg_catalog
as $n88_boundary$
#variable_conflict use_column
declare
v1 uuid;
v2 text;
v3 text;
v4 text;
v5 text;
v6 jsonb;
state text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::uuid;
v2:=convert_from(decode(p2,'base64'),'UTF8')::text;
v3:=convert_from(decode(p3,'base64'),'UTF8')::text;
v4:=convert_from(decode(p4,'base64'),'UTF8')::text;
v5:=convert_from(decode(p5,'base64'),'UTF8')::text;
v6:=convert_from(decode(p6,'base64'),'UTF8')::jsonb;
insert into n88_private.task_guidance(owner_id,class_id,term_id,teaching_id,subitem_id,payload) values(v1::uuid,v2,v3,v4,v5,v6::jsonb) on conflict(owner_id,class_id,term_id,teaching_id,subitem_id) do update set payload=excluded.payload;
get diagnostics affected=row_count;
return next;
exception when others or query_canceled or assert_failure then
get stacked diagnostics state=returned_sqlstate;
raise exception using errcode=state,message='n88_private_database_error',detail='',hint='';
end;
$n88_boundary$;
revoke all on function n88_private.boundary_0f039dccf91dfe6f4bc30ece(text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function n88_private.boundary_0f039dccf91dfe6f4bc30ece(text,text,text,text,text,text) to n88_backend;
create function n88_private.boundary_da25480fb483e6ce3d30f1a1() returns table(affected bigint)
language plpgsql security invoker set search_path=pg_catalog
as $n88_boundary$
#variable_conflict use_column
declare

state text;
begin

rollback;
get diagnostics affected=row_count;
return next;
exception when others or query_canceled or assert_failure then
get stacked diagnostics state=returned_sqlstate;
raise exception using errcode=state,message='n88_private_database_error',detail='',hint='';
end;
$n88_boundary$;
revoke all on function n88_private.boundary_da25480fb483e6ce3d30f1a1() from public,anon,authenticated;
grant execute on function n88_private.boundary_da25480fb483e6ce3d30f1a1() to n88_backend;
create function n88_private.boundary_ad2e84fec89ba9c5b1fd5f20(p1 text,p2 text,p3 text) returns table("payload" text)
language plpgsql security invoker set search_path=pg_catalog
as $n88_boundary$
#variable_conflict use_column
declare
v1 uuid;
v2 bigint;
v3 integer;
state text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::uuid;
v2:=convert_from(decode(p2,'base64'),'UTF8')::bigint;
v3:=convert_from(decode(p3,'base64'),'UTF8')::integer;
return query select case when octet_length(payload)<= v3 and sum(octet_length(payload)) over (rows unbounded preceding)<= v3 then payload else null end as payload from (select row_to_json(x)::text as payload from (select id,owner_id,revision::text as revision,deleted_at,item_id,name,value,"order",start_date,due_date,late_points from rakeezx.score_subitems where owner_id=v1::uuid order by id limit v2) x) bounded;
exception when others or query_canceled or assert_failure then
get stacked diagnostics state=returned_sqlstate;
raise exception using errcode=state,message='n88_private_database_error',detail='',hint='';
end;
$n88_boundary$;
revoke all on function n88_private.boundary_ad2e84fec89ba9c5b1fd5f20(text,text,text) from public,anon,authenticated;
grant execute on function n88_private.boundary_ad2e84fec89ba9c5b1fd5f20(text,text,text) to n88_backend;
create function n88_private.boundary_0e8834ccf4cac5f256e9a2ad(p1 text,p2 text,p3 text) returns table("payload" text)
language plpgsql security invoker set search_path=pg_catalog
as $n88_boundary$
#variable_conflict use_column
declare
v1 uuid;
v2 bigint;
v3 integer;
state text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::uuid;
v2:=convert_from(decode(p2,'base64'),'UTF8')::bigint;
v3:=convert_from(decode(p3,'base64'),'UTF8')::integer;
return query select case when octet_length(payload)<= v3 and sum(octet_length(payload)) over (rows unbounded preceding)<= v3 then payload else null end as payload from (select row_to_json(x)::text as payload from (select id,owner_id,revision::text as revision,deleted_at,section_id,term_id,subject_id from rakeezx.teachings where owner_id=v1::uuid order by id limit v2) x) bounded;
exception when others or query_canceled or assert_failure then
get stacked diagnostics state=returned_sqlstate;
raise exception using errcode=state,message='n88_private_database_error',detail='',hint='';
end;
$n88_boundary$;
revoke all on function n88_private.boundary_0e8834ccf4cac5f256e9a2ad(text,text,text) from public,anon,authenticated;
grant execute on function n88_private.boundary_0e8834ccf4cac5f256e9a2ad(text,text,text) to n88_backend;
create function n88_private.boundary_e42d2de24a5b2a9d458219d0(p1 text,p2 text,p3 text) returns table("payload" text)
language plpgsql security invoker set search_path=pg_catalog
as $n88_boundary$
#variable_conflict use_column
declare
v1 uuid;
v2 bigint;
v3 integer;
state text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::uuid;
v2:=convert_from(decode(p2,'base64'),'UTF8')::bigint;
v3:=convert_from(decode(p3,'base64'),'UTF8')::integer;
return query select case when octet_length(payload)<= v3 and sum(octet_length(payload)) over (rows unbounded preceding)<= v3 then payload else null end as payload from (select row_to_json(x)::text as payload from (select id,owner_id,revision::text as revision,deleted_at,status from rakeezx.years where owner_id=v1::uuid order by id limit v2) x) bounded;
exception when others or query_canceled or assert_failure then
get stacked diagnostics state=returned_sqlstate;
raise exception using errcode=state,message='n88_private_database_error',detail='',hint='';
end;
$n88_boundary$;
revoke all on function n88_private.boundary_e42d2de24a5b2a9d458219d0(text,text,text) from public,anon,authenticated;
grant execute on function n88_private.boundary_e42d2de24a5b2a9d458219d0(text,text,text) to n88_backend;
create function n88_private.boundary_7700d235b1326b49506b1222(p1 text,p2 text,p3 text) returns table("payload" text)
language plpgsql security invoker set search_path=pg_catalog
as $n88_boundary$
#variable_conflict use_column
declare
v1 uuid;
v2 bigint;
v3 integer;
state text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::uuid;
v2:=convert_from(decode(p2,'base64'),'UTF8')::bigint;
v3:=convert_from(decode(p3,'base64'),'UTF8')::integer;
return query select case when octet_length(payload)<= v3 and sum(octet_length(payload)) over (rows unbounded preceding)<= v3 then payload else null end as payload from (select row_to_json(x)::text as payload from (select id,owner_id,revision::text as revision,deleted_at,status,name from rakeezx.students where owner_id=v1::uuid order by id limit v2) x) bounded;
exception when others or query_canceled or assert_failure then
get stacked diagnostics state=returned_sqlstate;
raise exception using errcode=state,message='n88_private_database_error',detail='',hint='';
end;
$n88_boundary$;
revoke all on function n88_private.boundary_7700d235b1326b49506b1222(text,text,text) from public,anon,authenticated;
grant execute on function n88_private.boundary_7700d235b1326b49506b1222(text,text,text) to n88_backend;
create function n88_private.boundary_4f1ae4e620baf4b52e65c866(p1 text,p2 text,p3 text) returns table("payload" text)
language plpgsql security invoker set search_path=pg_catalog
as $n88_boundary$
#variable_conflict use_column
declare
v1 uuid;
v2 bigint;
v3 integer;
state text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::uuid;
v2:=convert_from(decode(p2,'base64'),'UTF8')::bigint;
v3:=convert_from(decode(p3,'base64'),'UTF8')::integer;
return query select case when octet_length(payload)<= v3 and sum(octet_length(payload)) over (rows unbounded preceding)<= v3 then payload else null end as payload from (select row_to_json(x)::text as payload from (select id,owner_id,revision::text as revision,deleted_at,student_id,item_id,value,manual_value,derived_value from rakeezx.scores where owner_id=v1::uuid order by id limit v2) x) bounded;
exception when others or query_canceled or assert_failure then
get stacked diagnostics state=returned_sqlstate;
raise exception using errcode=state,message='n88_private_database_error',detail='',hint='';
end;
$n88_boundary$;
revoke all on function n88_private.boundary_4f1ae4e620baf4b52e65c866(text,text,text) from public,anon,authenticated;
grant execute on function n88_private.boundary_4f1ae4e620baf4b52e65c866(text,text,text) to n88_backend;
create function n88_private.boundary_38603fea89bb426312fb13d0(p1 text,p2 text,p3 text) returns table("payload" text)
language plpgsql security invoker set search_path=pg_catalog
as $n88_boundary$
#variable_conflict use_column
declare
v1 uuid;
v2 bigint;
v3 integer;
state text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::uuid;
v2:=convert_from(decode(p2,'base64'),'UTF8')::bigint;
v3:=convert_from(decode(p3,'base64'),'UTF8')::integer;
return query select case when octet_length(payload)<= v3 and sum(octet_length(payload)) over (rows unbounded preceding)<= v3 then payload else null end as payload from (select row_to_json(x)::text as payload from (select id,owner_id,revision::text as revision,deleted_at,student_id,section_id,status,start_date,end_date from rakeezx.enrollments where owner_id=v1::uuid order by id limit v2) x) bounded;
exception when others or query_canceled or assert_failure then
get stacked diagnostics state=returned_sqlstate;
raise exception using errcode=state,message='n88_private_database_error',detail='',hint='';
end;
$n88_boundary$;
revoke all on function n88_private.boundary_38603fea89bb426312fb13d0(text,text,text) from public,anon,authenticated;
grant execute on function n88_private.boundary_38603fea89bb426312fb13d0(text,text,text) to n88_backend;
create function n88_private.boundary_2c10f3346e981b9ed2dc8305(p1 text,p2 text,p3 text) returns table("payload" text)
language plpgsql security invoker set search_path=pg_catalog
as $n88_boundary$
#variable_conflict use_column
declare
v1 uuid;
v2 bigint;
v3 integer;
state text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::uuid;
v2:=convert_from(decode(p2,'base64'),'UTF8')::bigint;
v3:=convert_from(decode(p3,'base64'),'UTF8')::integer;
return query select case when octet_length(payload)<= v3 and sum(octet_length(payload)) over (rows unbounded preceding)<= v3 then payload else null end as payload from (select row_to_json(x)::text as payload from (select id,owner_id,revision::text as revision,deleted_at,student_id,subitem_id,checked,completion_state from rakeezx.score_subitem_completions where owner_id=v1::uuid order by id limit v2) x) bounded;
exception when others or query_canceled or assert_failure then
get stacked diagnostics state=returned_sqlstate;
raise exception using errcode=state,message='n88_private_database_error',detail='',hint='';
end;
$n88_boundary$;
revoke all on function n88_private.boundary_2c10f3346e981b9ed2dc8305(text,text,text) from public,anon,authenticated;
grant execute on function n88_private.boundary_2c10f3346e981b9ed2dc8305(text,text,text) to n88_backend;
create function n88_private.boundary_7eaf0e6ad46189c16f430c17(p1 text,p2 text,p3 text) returns table("payload" text)
language plpgsql security invoker set search_path=pg_catalog
as $n88_boundary$
#variable_conflict use_column
declare
v1 uuid;
v2 bigint;
v3 integer;
state text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::uuid;
v2:=convert_from(decode(p2,'base64'),'UTF8')::bigint;
v3:=convert_from(decode(p3,'base64'),'UTF8')::integer;
return query select case when octet_length(payload)<= v3 and sum(octet_length(payload)) over (rows unbounded preceding)<= v3 then payload else null end as payload from (select row_to_json(x)::text as payload from (select id,owner_id,revision::text as revision,deleted_at,student_id,teaching_id,kind,delta from rakeezx.logs where owner_id=v1::uuid order by id limit v2) x) bounded;
exception when others or query_canceled or assert_failure then
get stacked diagnostics state=returned_sqlstate;
raise exception using errcode=state,message='n88_private_database_error',detail='',hint='';
end;
$n88_boundary$;
revoke all on function n88_private.boundary_7eaf0e6ad46189c16f430c17(text,text,text) from public,anon,authenticated;
grant execute on function n88_private.boundary_7eaf0e6ad46189c16f430c17(text,text,text) to n88_backend;
create function n88_private.boundary_4b08189b1399c922f5d61eb4(p1 text,p2 text,p3 text) returns table("payload" text)
language plpgsql security invoker set search_path=pg_catalog
as $n88_boundary$
#variable_conflict use_column
declare
v1 uuid;
v2 bigint;
v3 integer;
state text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::uuid;
v2:=convert_from(decode(p2,'base64'),'UTF8')::bigint;
v3:=convert_from(decode(p3,'base64'),'UTF8')::integer;
return query select case when octet_length(payload)<= v3 and sum(octet_length(payload)) over (rows unbounded preceding)<= v3 then payload else null end as payload from (select row_to_json(x)::text as payload from (select id,owner_id,revision::text as revision,deleted_at,student_id,teaching_id,session_id,status from rakeezx.attendance where owner_id=v1::uuid order by id limit v2) x) bounded;
exception when others or query_canceled or assert_failure then
get stacked diagnostics state=returned_sqlstate;
raise exception using errcode=state,message='n88_private_database_error',detail='',hint='';
end;
$n88_boundary$;
revoke all on function n88_private.boundary_4b08189b1399c922f5d61eb4(text,text,text) from public,anon,authenticated;
grant execute on function n88_private.boundary_4b08189b1399c922f5d61eb4(text,text,text) to n88_backend;
create function n88_private.boundary_c1e4d457aa8a6c7bd31e5277(p1 text,p2 text,p3 text) returns table("payload" text)
language plpgsql security invoker set search_path=pg_catalog
as $n88_boundary$
#variable_conflict use_column
declare
v1 uuid;
v2 bigint;
v3 integer;
state text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::uuid;
v2:=convert_from(decode(p2,'base64'),'UTF8')::bigint;
v3:=convert_from(decode(p3,'base64'),'UTF8')::integer;
return query select case when octet_length(payload)<= v3 and sum(octet_length(payload)) over (rows unbounded preceding)<= v3 then payload else null end as payload from (select row_to_json(x)::text as payload from (select id,owner_id,revision::text as revision,deleted_at,teaching_id,date,status from rakeezx.sessions where owner_id=v1::uuid order by id limit v2) x) bounded;
exception when others or query_canceled or assert_failure then
get stacked diagnostics state=returned_sqlstate;
raise exception using errcode=state,message='n88_private_database_error',detail='',hint='';
end;
$n88_boundary$;
revoke all on function n88_private.boundary_c1e4d457aa8a6c7bd31e5277(text,text,text) from public,anon,authenticated;
grant execute on function n88_private.boundary_c1e4d457aa8a6c7bd31e5277(text,text,text) to n88_backend;
create function n88_private.boundary_c365a70fb8ff3318f2e1f14c(p1 text,p2 text,p3 text) returns table("payload" text)
language plpgsql security invoker set search_path=pg_catalog
as $n88_boundary$
#variable_conflict use_column
declare
v1 uuid;
v2 bigint;
v3 integer;
state text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::uuid;
v2:=convert_from(decode(p2,'base64'),'UTF8')::bigint;
v3:=convert_from(decode(p3,'base64'),'UTF8')::integer;
return query select case when octet_length(payload)<= v3 and sum(octet_length(payload)) over (rows unbounded preceding)<= v3 then payload else null end as payload from (select row_to_json(x)::text as payload from (select id,owner_id,revision::text as revision,deleted_at,teaching_id,name,max,"order",auto,per_point,penalty,score_mode,portability_group_id from rakeezx.items where owner_id=v1::uuid order by id limit v2) x) bounded;
exception when others or query_canceled or assert_failure then
get stacked diagnostics state=returned_sqlstate;
raise exception using errcode=state,message='n88_private_database_error',detail='',hint='';
end;
$n88_boundary$;
revoke all on function n88_private.boundary_c365a70fb8ff3318f2e1f14c(text,text,text) from public,anon,authenticated;
grant execute on function n88_private.boundary_c365a70fb8ff3318f2e1f14c(text,text,text) to n88_backend;
create function n88_private.boundary_b75844e451c72d86ecce7361(p1 text,p2 text,p3 text) returns table("payload" text)
language plpgsql security invoker set search_path=pg_catalog
as $n88_boundary$
#variable_conflict use_column
declare
v1 uuid;
v2 bigint;
v3 integer;
state text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::uuid;
v2:=convert_from(decode(p2,'base64'),'UTF8')::bigint;
v3:=convert_from(decode(p3,'base64'),'UTF8')::integer;
return query select case when octet_length(payload)<= v3 and sum(octet_length(payload)) over (rows unbounded preceding)<= v3 then payload else null end as payload from (select row_to_json(x)::text as payload from (select id,owner_id,revision::text as revision,deleted_at,year_id,status,archived_at,grade,label,name from rakeezx.sections where owner_id=v1::uuid order by id limit v2) x) bounded;
exception when others or query_canceled or assert_failure then
get stacked diagnostics state=returned_sqlstate;
raise exception using errcode=state,message='n88_private_database_error',detail='',hint='';
end;
$n88_boundary$;
revoke all on function n88_private.boundary_b75844e451c72d86ecce7361(text,text,text) from public,anon,authenticated;
grant execute on function n88_private.boundary_b75844e451c72d86ecce7361(text,text,text) to n88_backend;
create function n88_private.boundary_218f1146d50bdae36e06ce85(p1 text,p2 text,p3 text) returns table("payload" text)
language plpgsql security invoker set search_path=pg_catalog
as $n88_boundary$
#variable_conflict use_column
declare
v1 uuid;
v2 bigint;
v3 integer;
state text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::uuid;
v2:=convert_from(decode(p2,'base64'),'UTF8')::bigint;
v3:=convert_from(decode(p3,'base64'),'UTF8')::integer;
return query select case when octet_length(payload)<= v3 and sum(octet_length(payload)) over (rows unbounded preceding)<= v3 then payload else null end as payload from (select row_to_json(x)::text as payload from (select id,owner_id,revision::text as revision,deleted_at,year_id,status,start_date,end_date from rakeezx.terms where owner_id=v1::uuid order by id limit v2) x) bounded;
exception when others or query_canceled or assert_failure then
get stacked diagnostics state=returned_sqlstate;
raise exception using errcode=state,message='n88_private_database_error',detail='',hint='';
end;
$n88_boundary$;
revoke all on function n88_private.boundary_218f1146d50bdae36e06ce85(text,text,text) from public,anon,authenticated;
grant execute on function n88_private.boundary_218f1146d50bdae36e06ce85(text,text,text) to n88_backend;
create function n88_private.boundary_7212828c13ad9de67788e95a(p1 text,p2 text,p3 text) returns table("bounded_row" text)
language plpgsql security invoker set search_path=pg_catalog
as $n88_boundary$
#variable_conflict use_column
declare
v1 bigint;
v2 integer;
v3 bigint;
state text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::bigint;
v2:=convert_from(decode(p2,'base64'),'UTF8')::integer;
v3:=convert_from(decode(p3,'base64'),'UTF8')::bigint;
return query select case when octet_length(payload)<=v2 and sum(octet_length(payload)) over (rows unbounded preceding)<=v3 then payload else null end as bounded_row from (select row_to_json(t)::text as payload from (select id,credential_id,namespace,owner_id,class_id,student_id,enrollment_id,version::text as version,membership_revision::text as membership_revision,entry_verifier,token_hash,(extract(epoch from expires_at)*1000)::text as expires_at,(extract(epoch from revoked_at)*1000)::text as revoked_at,canonical_stamp from n88_private.sessions limit v1) t) bounded;
exception when others or query_canceled or assert_failure then
get stacked diagnostics state=returned_sqlstate;
raise exception using errcode=state,message='n88_private_database_error',detail='',hint='';
end;
$n88_boundary$;
revoke all on function n88_private.boundary_7212828c13ad9de67788e95a(text,text,text) from public,anon,authenticated;
grant execute on function n88_private.boundary_7212828c13ad9de67788e95a(text,text,text) to n88_backend;
create function n88_private.boundary_b03c8ea8391678ae71b8031e(p1 text,p2 text,p3 text) returns table("bounded_row" text)
language plpgsql security invoker set search_path=pg_catalog
as $n88_boundary$
#variable_conflict use_column
declare
v1 bigint;
v2 integer;
v3 bigint;
state text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::bigint;
v2:=convert_from(decode(p2,'base64'),'UTF8')::integer;
v3:=convert_from(decode(p3,'base64'),'UTF8')::bigint;
return query select case when octet_length(payload)<=v2 and sum(octet_length(payload)) over (rows unbounded preceding)<=v3 then payload else null end as bounded_row from (select row_to_json(t)::text as payload from (select id,namespace,owner_id,student_id,version::text as version,verifier,entry_verifier,(extract(epoch from revoked_at)*1000)::text as revoked_at from n88_private.credentials limit v1) t) bounded;
exception when others or query_canceled or assert_failure then
get stacked diagnostics state=returned_sqlstate;
raise exception using errcode=state,message='n88_private_database_error',detail='',hint='';
end;
$n88_boundary$;
revoke all on function n88_private.boundary_b03c8ea8391678ae71b8031e(text,text,text) from public,anon,authenticated;
grant execute on function n88_private.boundary_b03c8ea8391678ae71b8031e(text,text,text) to n88_backend;
create function n88_private.boundary_529c1bf7ab8f896422e93ff3(p1 text,p2 text,p3 text) returns table("bounded_row" text)
language plpgsql security invoker set search_path=pg_catalog
as $n88_boundary$
#variable_conflict use_column
declare
v1 bigint;
v2 integer;
v3 bigint;
state text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::bigint;
v2:=convert_from(decode(p2,'base64'),'UTF8')::integer;
v3:=convert_from(decode(p3,'base64'),'UTF8')::bigint;
return query select case when octet_length(payload)<=v2 and sum(octet_length(payload)) over (rows unbounded preceding)<=v3 then payload else null end as bounded_row from (select row_to_json(t)::text as payload from (select id,owner_id,class_id,student_id,enrollment_id,source_teaching_id,source_item_id,title,instruction,deadline::text as deadline,status,published from n88_private.publications limit v1) t) bounded;
exception when others or query_canceled or assert_failure then
get stacked diagnostics state=returned_sqlstate;
raise exception using errcode=state,message='n88_private_database_error',detail='',hint='';
end;
$n88_boundary$;
revoke all on function n88_private.boundary_529c1bf7ab8f896422e93ff3(text,text,text) from public,anon,authenticated;
grant execute on function n88_private.boundary_529c1bf7ab8f896422e93ff3(text,text,text) to n88_backend;
create function n88_private.boundary_c17a55bfb4d6e130fbbe3e4d(p1 text,p2 text,p3 text) returns table("bounded_row" text)
language plpgsql security invoker set search_path=pg_catalog
as $n88_boundary$
#variable_conflict use_column
declare
v1 bigint;
v2 integer;
v3 bigint;
state text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::bigint;
v2:=convert_from(decode(p2,'base64'),'UTF8')::integer;
v3:=convert_from(decode(p3,'base64'),'UTF8')::bigint;
return query select case when octet_length(payload)<=v2 and sum(octet_length(payload)) over (rows unbounded preceding)<=v3 then payload else null end as bounded_row from (select row_to_json(t)::text as payload from (select key,count::text as count,(extract(epoch from until_at)*1000)::text as until_at from n88_private.guess_budgets limit v1) t) bounded;
exception when others or query_canceled or assert_failure then
get stacked diagnostics state=returned_sqlstate;
raise exception using errcode=state,message='n88_private_database_error',detail='',hint='';
end;
$n88_boundary$;
revoke all on function n88_private.boundary_c17a55bfb4d6e130fbbe3e4d(text,text,text) from public,anon,authenticated;
grant execute on function n88_private.boundary_c17a55bfb4d6e130fbbe3e4d(text,text,text) to n88_backend;
create function n88_private.boundary_6445f4cd91ac31e4400b91b5(p1 text,p2 text,p3 text) returns table("bounded_row" text)
language plpgsql security invoker set search_path=pg_catalog
as $n88_boundary$
#variable_conflict use_column
declare
v1 bigint;
v2 integer;
v3 bigint;
state text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::bigint;
v2:=convert_from(decode(p2,'base64'),'UTF8')::integer;
v3:=convert_from(decode(p3,'base64'),'UTF8')::bigint;
return query select case when octet_length(payload)<=v2 and sum(octet_length(payload)) over (rows unbounded preceding)<=v3 then payload else null end as bounded_row from (select row_to_json(t)::text as payload from (select namespace,owner_id,active from n88_private.contexts limit v1) t) bounded;
exception when others or query_canceled or assert_failure then
get stacked diagnostics state=returned_sqlstate;
raise exception using errcode=state,message='n88_private_database_error',detail='',hint='';
end;
$n88_boundary$;
revoke all on function n88_private.boundary_6445f4cd91ac31e4400b91b5(text,text,text) from public,anon,authenticated;
grant execute on function n88_private.boundary_6445f4cd91ac31e4400b91b5(text,text,text) to n88_backend;
create function n88_private.boundary_d77d8b0fcafaf2d6444a9283(p1 text,p2 text,p3 text) returns table("bounded_row" text)
language plpgsql security invoker set search_path=pg_catalog
as $n88_boundary$
#variable_conflict use_column
declare
v1 bigint;
v2 integer;
v3 bigint;
state text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::bigint;
v2:=convert_from(decode(p2,'base64'),'UTF8')::integer;
v3:=convert_from(decode(p3,'base64'),'UTF8')::bigint;
return query select case when octet_length(payload)<=v2 and sum(octet_length(payload)) over (rows unbounded preceding)<=v3 then payload else null end as bounded_row from (select row_to_json(t)::text as payload from (select owner_id,class_id,student_id,enrollment_id,revision::text as revision,status,end_date::text as end_date,student_active,class_active,label,canonical_stamp,active from n88_private.memberships limit v1) t) bounded;
exception when others or query_canceled or assert_failure then
get stacked diagnostics state=returned_sqlstate;
raise exception using errcode=state,message='n88_private_database_error',detail='',hint='';
end;
$n88_boundary$;
revoke all on function n88_private.boundary_d77d8b0fcafaf2d6444a9283(text,text,text) from public,anon,authenticated;
grant execute on function n88_private.boundary_d77d8b0fcafaf2d6444a9283(text,text,text) to n88_backend;
create function n88_private.boundary_5c9fc4857874ea5002e6604f(p1 text,p2 text,p3 text) returns table("payload" text)
language plpgsql security invoker set search_path=pg_catalog
as $n88_boundary$
#variable_conflict use_column
declare
v1 uuid[];
v2 bigint;
v3 integer;
state text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::uuid[];
v2:=convert_from(decode(p2,'base64'),'UTF8')::bigint;
v3:=convert_from(decode(p3,'base64'),'UTF8')::integer;
return query select case when octet_length(payload)<=v3 and sum(octet_length(payload)) over (rows unbounded preceding)<=v3 then payload else null end as payload
      from (select row_to_json(x)::text as payload from (
        select e.owner_id,e.id as enrollment_id,e.section_id,e.student_id,e.revision::text as revision,
          e.status,e.end_date::text as end_date,e.deleted_at is null as enrollment_present,
          s.status='active' and s.deleted_at is null as student_active,left(s.name,300) as label,
          c.status='active' and c.deleted_at is null and y.status='active' and y.deleted_at is null as class_active,
          s.revision::text as student_revision,c.revision::text as section_revision,y.revision::text as year_revision
        from rakeezx.enrollments e join rakeezx.students s on s.owner_id=e.owner_id and s.id=e.student_id
        join rakeezx.sections c on c.owner_id=e.owner_id and c.id=e.section_id
        join rakeezx.years y on y.owner_id=c.owner_id and y.id=c.year_id
        where e.owner_id=any(v1::uuid[]) order by e.owner_id,e.id limit v2
      ) x) bounded;
exception when others or query_canceled or assert_failure then
get stacked diagnostics state=returned_sqlstate;
raise exception using errcode=state,message='n88_private_database_error',detail='',hint='';
end;
$n88_boundary$;
revoke all on function n88_private.boundary_5c9fc4857874ea5002e6604f(text,text,text) from public,anon,authenticated;
grant execute on function n88_private.boundary_5c9fc4857874ea5002e6604f(text,text,text) to n88_backend;
create function n88_private.boundary_7dfce5786c5f02dcc6e78f35(p1 text,p2 text,p3 text) returns table("payload" text)
language plpgsql security invoker set search_path=pg_catalog
as $n88_boundary$
#variable_conflict use_column
declare
v1 uuid[];
v2 bigint;
v3 integer;
state text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::uuid[];
v2:=convert_from(decode(p2,'base64'),'UTF8')::bigint;
v3:=convert_from(decode(p3,'base64'),'UTF8')::integer;
return query select case when octet_length(payload)<=v3 and sum(octet_length(payload)) over (rows unbounded preceding)<=v3 then payload else null end as payload
      from (select row_to_json(x)::text as payload from (
        select i.owner_id,i.id as item_id,left(i.name,160) as title,t.id as teaching_id,t.section_id,
          i.revision::text as item_revision,t.revision::text as teaching_revision,term.revision::text as term_revision
        from rakeezx.items i join rakeezx.teachings t on t.owner_id=i.owner_id and t.id=i.teaching_id
        join rakeezx.terms term on term.owner_id=t.owner_id and term.id=t.term_id
        join rakeezx.sections c on c.owner_id=t.owner_id and c.id=t.section_id
        where i.owner_id=any(v1::uuid[]) and i.deleted_at is null and t.deleted_at is null
          and term.deleted_at is null and term.status='active' and term.year_id=c.year_id
          and i.auto is null order by i.owner_id,i.id limit v2
      ) x) bounded;
exception when others or query_canceled or assert_failure then
get stacked diagnostics state=returned_sqlstate;
raise exception using errcode=state,message='n88_private_database_error',detail='',hint='';
end;
$n88_boundary$;
revoke all on function n88_private.boundary_7dfce5786c5f02dcc6e78f35(text,text,text) from public,anon,authenticated;
grant execute on function n88_private.boundary_7dfce5786c5f02dcc6e78f35(text,text,text) to n88_backend;
create function n88_private.boundary_7241eedcf190b772374229ea(p1 text,p2 text) returns table("payload" jsonb)
language plpgsql security invoker set search_path=pg_catalog
as $n88_boundary$
#variable_conflict use_column
declare
v1 bigint;
v2 integer;
state text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::bigint;
v2:=convert_from(decode(p2,'base64'),'UTF8')::integer;
return query select case when octet_length(payload::text)<=v2 and sum(octet_length(payload::text)) over (rows unbounded preceding)<=v2 then payload else null end as payload from n88_private.class_credential_receipts limit v1;
exception when others or query_canceled or assert_failure then
get stacked diagnostics state=returned_sqlstate;
raise exception using errcode=state,message='n88_private_database_error',detail='',hint='';
end;
$n88_boundary$;
revoke all on function n88_private.boundary_7241eedcf190b772374229ea(text,text) from public,anon,authenticated;
grant execute on function n88_private.boundary_7241eedcf190b772374229ea(text,text) to n88_backend;
create function n88_private.boundary_663dba1cb7b909fd24ac94e2(p1 text,p2 text) returns table("payload" jsonb)
language plpgsql security invoker set search_path=pg_catalog
as $n88_boundary$
#variable_conflict use_column
declare
v1 bigint;
v2 integer;
state text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::bigint;
v2:=convert_from(decode(p2,'base64'),'UTF8')::integer;
return query select case when octet_length(payload::text)<=v2 and sum(octet_length(payload::text)) over (rows unbounded preceding)<=v2 then payload else null end as payload from n88_private.numeric_attempts limit v1;
exception when others or query_canceled or assert_failure then
get stacked diagnostics state=returned_sqlstate;
raise exception using errcode=state,message='n88_private_database_error',detail='',hint='';
end;
$n88_boundary$;
revoke all on function n88_private.boundary_663dba1cb7b909fd24ac94e2(text,text) from public,anon,authenticated;
grant execute on function n88_private.boundary_663dba1cb7b909fd24ac94e2(text,text) to n88_backend;
create function n88_private.boundary_fada095ce38b422ccf61f489(p1 text,p2 text) returns table("payload" jsonb)
language plpgsql security invoker set search_path=pg_catalog
as $n88_boundary$
#variable_conflict use_column
declare
v1 bigint;
v2 integer;
state text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::bigint;
v2:=convert_from(decode(p2,'base64'),'UTF8')::integer;
return query select case when octet_length(payload::text)<=v2 and sum(octet_length(payload::text)) over (rows unbounded preceding)<=v2 then payload else null end as payload from n88_private.numeric_credentials limit v1;
exception when others or query_canceled or assert_failure then
get stacked diagnostics state=returned_sqlstate;
raise exception using errcode=state,message='n88_private_database_error',detail='',hint='';
end;
$n88_boundary$;
revoke all on function n88_private.boundary_fada095ce38b422ccf61f489(text,text) from public,anon,authenticated;
grant execute on function n88_private.boundary_fada095ce38b422ccf61f489(text,text) to n88_backend;
create function n88_private.boundary_017a62b1b935f2eb760ae1e8(p1 text,p2 text) returns table("payload" jsonb)
language plpgsql security invoker set search_path=pg_catalog
as $n88_boundary$
#variable_conflict use_column
declare
v1 bigint;
v2 integer;
state text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::bigint;
v2:=convert_from(decode(p2,'base64'),'UTF8')::integer;
return query select case when octet_length(payload::text)<=v2 and sum(octet_length(payload::text)) over (rows unbounded preceding)<=v2 then payload else null end as payload from n88_private.numeric_rates limit v1;
exception when others or query_canceled or assert_failure then
get stacked diagnostics state=returned_sqlstate;
raise exception using errcode=state,message='n88_private_database_error',detail='',hint='';
end;
$n88_boundary$;
revoke all on function n88_private.boundary_017a62b1b935f2eb760ae1e8(text,text) from public,anon,authenticated;
grant execute on function n88_private.boundary_017a62b1b935f2eb760ae1e8(text,text) to n88_backend;
create function n88_private.boundary_e9d8defc0078b184176ffedf(p1 text,p2 text) returns table("payload" jsonb)
language plpgsql security invoker set search_path=pg_catalog
as $n88_boundary$
#variable_conflict use_column
declare
v1 bigint;
v2 integer;
state text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::bigint;
v2:=convert_from(decode(p2,'base64'),'UTF8')::integer;
return query select case when octet_length(payload::text)<=v2 and sum(octet_length(payload::text)) over (rows unbounded preceding)<=v2 then payload else null end as payload from n88_private.numeric_sessions limit v1;
exception when others or query_canceled or assert_failure then
get stacked diagnostics state=returned_sqlstate;
raise exception using errcode=state,message='n88_private_database_error',detail='',hint='';
end;
$n88_boundary$;
revoke all on function n88_private.boundary_e9d8defc0078b184176ffedf(text,text) from public,anon,authenticated;
grant execute on function n88_private.boundary_e9d8defc0078b184176ffedf(text,text) to n88_backend;
create function n88_private.boundary_f47daacda1442e346327b60d(p1 text,p2 text) returns table("accepted" boolean)
language plpgsql security invoker set search_path=pg_catalog
as $n88_boundary$
#variable_conflict use_column
declare
v1 uuid;
v2 bigint;
state text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::uuid;
v2:=convert_from(decode(p2,'base64'),'UTF8')::bigint;
return query select n88_private.consume_ingress(v1::uuid,v2::bigint) as accepted;
exception when others or query_canceled or assert_failure then
get stacked diagnostics state=returned_sqlstate;
raise exception using errcode=state,message='n88_private_database_error',detail='',hint='';
end;
$n88_boundary$;
revoke all on function n88_private.boundary_f47daacda1442e346327b60d(text,text) from public,anon,authenticated;
grant execute on function n88_private.boundary_f47daacda1442e346327b60d(text,text) to n88_backend;
create function n88_private.boundary_fd19cd46f568a4ae38795f6d(p1 text,p2 text) returns void
language plpgsql security invoker set search_path=pg_catalog
as $n88_boundary$
#variable_conflict use_column
declare
v1 uuid;
v2 integer;
state text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::uuid;
v2:=convert_from(decode(p2,'base64'),'UTF8')::integer;
perform n88_private.lock_canonical_sources(v1::uuid,v2::integer);
return;
exception when others or query_canceled or assert_failure then
get stacked diagnostics state=returned_sqlstate;
raise exception using errcode=state,message='n88_private_database_error',detail='',hint='';
end;
$n88_boundary$;
revoke all on function n88_private.boundary_fd19cd46f568a4ae38795f6d(text,text) from public,anon,authenticated;
grant execute on function n88_private.boundary_fd19cd46f568a4ae38795f6d(text,text) to n88_backend;
create function n88_private.boundary_522656818781827547d463af(p1 text,p2 text) returns void
language plpgsql security invoker set search_path=pg_catalog
as $n88_boundary$
#variable_conflict use_column
declare
v1 uuid;
v2 integer;
state text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::uuid;
v2:=convert_from(decode(p2,'base64'),'UTF8')::integer;
perform n88_private.lock_projection_sources(v1::uuid,v2::integer);
return;
exception when others or query_canceled or assert_failure then
get stacked diagnostics state=returned_sqlstate;
raise exception using errcode=state,message='n88_private_database_error',detail='',hint='';
end;
$n88_boundary$;
revoke all on function n88_private.boundary_522656818781827547d463af(text,text) from public,anon,authenticated;
grant execute on function n88_private.boundary_522656818781827547d463af(text,text) to n88_backend;
create function n88_private.boundary_b44d6bc61d9a2d54becc9173(p1 text,p2 text,p3 text) returns table("payload" jsonb)
language plpgsql security invoker set search_path=pg_catalog
as $n88_boundary$
#variable_conflict use_column
declare
v1 uuid;
v2 text;
v3 text;
state text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::uuid;
v2:=convert_from(decode(p2,'base64'),'UTF8')::text;
v3:=convert_from(decode(p3,'base64'),'UTF8')::text;
return query select payload from n88_private.class_visibility where owner_id=v1::uuid and class_id=v2 and term_id=v3;
exception when others or query_canceled or assert_failure then
get stacked diagnostics state=returned_sqlstate;
raise exception using errcode=state,message='n88_private_database_error',detail='',hint='';
end;
$n88_boundary$;
revoke all on function n88_private.boundary_b44d6bc61d9a2d54becc9173(text,text,text) from public,anon,authenticated;
grant execute on function n88_private.boundary_b44d6bc61d9a2d54becc9173(text,text,text) to n88_backend;
create function n88_private.boundary_36aea132fd3436ff82bed847(p1 text) returns table("payload" jsonb)
language plpgsql security invoker set search_path=pg_catalog
as $n88_boundary$
#variable_conflict use_column
declare
v1 uuid;
state text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::uuid;
return query select payload from n88_private.code_recovery where credential_id=v1::uuid order by generation desc limit 1;
exception when others or query_canceled or assert_failure then
get stacked diagnostics state=returned_sqlstate;
raise exception using errcode=state,message='n88_private_database_error',detail='',hint='';
end;
$n88_boundary$;
revoke all on function n88_private.boundary_36aea132fd3436ff82bed847(text) from public,anon,authenticated;
grant execute on function n88_private.boundary_36aea132fd3436ff82bed847(text) to n88_backend;
create function n88_private.boundary_c0c8bf88c9afd629c6d80e9f(p1 text,p2 text,p3 text,p4 text) returns table("subitem_id" text,"teaching_id" text,"bounded_payload" text)
language plpgsql security invoker set search_path=pg_catalog
as $n88_boundary$
#variable_conflict use_column
declare
v1 uuid;
v2 text;
v3 text;
v4 text;
state text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::uuid;
v2:=convert_from(decode(p2,'base64'),'UTF8')::text;
v3:=convert_from(decode(p3,'base64'),'UTF8')::text;
v4:=convert_from(decode(p4,'base64'),'UTF8')::text;
return query select subitem_id,teaching_id,case when sum(octet_length(payload::text)) over(order by teaching_id,subitem_id rows unbounded preceding)<=2097152 then payload::text else null end as bounded_payload from n88_private.task_guidance where owner_id=v1::uuid and class_id=v2 and term_id=v3 and (v4::text is null or teaching_id=v4) order by teaching_id,subitem_id limit 2001;
exception when others or query_canceled or assert_failure then
get stacked diagnostics state=returned_sqlstate;
raise exception using errcode=state,message='n88_private_database_error',detail='',hint='';
end;
$n88_boundary$;
revoke all on function n88_private.boundary_c0c8bf88c9afd629c6d80e9f(text,text,text,text) from public,anon,authenticated;
grant execute on function n88_private.boundary_c0c8bf88c9afd629c6d80e9f(text,text,text,text) to n88_backend;
create function n88_private.boundary_15ce9f3bf91799d8d16c15e4(p1 text,p2 text) returns table("id" text,"section_id" text,"teaching_revision" text,"term_revision" text)
language plpgsql security invoker set search_path=pg_catalog
as $n88_boundary$
#variable_conflict use_column
declare
v1 uuid;
v2 text;
state text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::uuid;
v2:=convert_from(decode(p2,'base64'),'UTF8')::text;
return query select t.id,t.section_id,t.revision::text as teaching_revision,
      term.revision::text as term_revision from rakeezx.teachings t
      join rakeezx.terms term on term.owner_id=t.owner_id and term.id=t.term_id
      join rakeezx.sections c on c.owner_id=t.owner_id and c.id=t.section_id
      join rakeezx.years y on y.owner_id=c.owner_id and y.id=c.year_id
      where t.owner_id=v1::uuid and t.id=v2 and t.deleted_at is null
        and term.deleted_at is null and term.status='active' and term.year_id=c.year_id
        and c.deleted_at is null and c.status='active' and y.deleted_at is null and y.status='active';
exception when others or query_canceled or assert_failure then
get stacked diagnostics state=returned_sqlstate;
raise exception using errcode=state,message='n88_private_database_error',detail='',hint='';
end;
$n88_boundary$;
revoke all on function n88_private.boundary_15ce9f3bf91799d8d16c15e4(text,text) from public,anon,authenticated;
grant execute on function n88_private.boundary_15ce9f3bf91799d8d16c15e4(text,text) to n88_backend;
create function n88_private.boundary_988735ac2a1a18389fa0bd91(p1 text,p2 text) returns table("user_id" uuid,"session_id" uuid)
language plpgsql security invoker set search_path=pg_catalog
as $n88_boundary$
#variable_conflict use_column
declare
v1 uuid;
v2 uuid;
state text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::uuid;
v2:=convert_from(decode(p2,'base64'),'UTF8')::uuid;
return query select user_id,session_id from n88_private.lock_current_session(v1::uuid,v2::uuid);
exception when others or query_canceled or assert_failure then
get stacked diagnostics state=returned_sqlstate;
raise exception using errcode=state,message='n88_private_database_error',detail='',hint='';
end;
$n88_boundary$;
revoke all on function n88_private.boundary_988735ac2a1a18389fa0bd91(text,text) from public,anon,authenticated;
grant execute on function n88_private.boundary_988735ac2a1a18389fa0bd91(text,text) to n88_backend;
create function n88_private.boundary_fbd717658ec0391f83b6ca1e(p1 text,p2 text) returns table(affected bigint)
language plpgsql security invoker set search_path=pg_catalog
as $n88_boundary$
#variable_conflict use_column
declare
v1 text;
v2 jsonb;
state text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::text;
v2:=convert_from(decode(p2,'base64'),'UTF8')::jsonb;
update n88_private.class_credential_receipts set payload=v2::jsonb where row_key=v1;
get diagnostics affected=row_count;
return next;
exception when others or query_canceled or assert_failure then
get stacked diagnostics state=returned_sqlstate;
raise exception using errcode=state,message='n88_private_database_error',detail='',hint='';
end;
$n88_boundary$;
revoke all on function n88_private.boundary_fbd717658ec0391f83b6ca1e(text,text) from public,anon,authenticated;
grant execute on function n88_private.boundary_fbd717658ec0391f83b6ca1e(text,text) to n88_backend;
create function n88_private.boundary_e132519164f58f14ceaa901e(p1 text,p2 text,p3 text) returns table(affected bigint)
language plpgsql security invoker set search_path=pg_catalog
as $n88_boundary$
#variable_conflict use_column
declare
v1 text;
v2 uuid;
v3 boolean;
state text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::text;
v2:=convert_from(decode(p2,'base64'),'UTF8')::uuid;
v3:=convert_from(decode(p3,'base64'),'UTF8')::boolean;
update n88_private.contexts set owner_id=v2,active=v3 where namespace=v1;
get diagnostics affected=row_count;
return next;
exception when others or query_canceled or assert_failure then
get stacked diagnostics state=returned_sqlstate;
raise exception using errcode=state,message='n88_private_database_error',detail='',hint='';
end;
$n88_boundary$;
revoke all on function n88_private.boundary_e132519164f58f14ceaa901e(text,text,text) from public,anon,authenticated;
grant execute on function n88_private.boundary_e132519164f58f14ceaa901e(text,text,text) to n88_backend;
create function n88_private.boundary_08056655f7c73fdf53693a15(p1 text,p2 text,p3 text,p4 text,p5 text,p6 text,p7 text,p8 text) returns table(affected bigint)
language plpgsql security invoker set search_path=pg_catalog
as $n88_boundary$
#variable_conflict use_column
declare
v1 uuid;
v2 text;
v3 uuid;
v4 text;
v5 bigint;
v6 text;
v7 text;
v8 timestamp with time zone;
state text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::uuid;
v2:=convert_from(decode(p2,'base64'),'UTF8')::text;
v3:=convert_from(decode(p3,'base64'),'UTF8')::uuid;
v4:=convert_from(decode(p4,'base64'),'UTF8')::text;
v5:=convert_from(decode(p5,'base64'),'UTF8')::bigint;
v6:=convert_from(decode(p6,'base64'),'UTF8')::text;
v7:=convert_from(decode(p7,'base64'),'UTF8')::text;
v8:=convert_from(decode(p8,'base64'),'UTF8')::timestamp with time zone;
update n88_private.credentials set namespace=v2,owner_id=v3,student_id=v4,version=v5,verifier=v6,entry_verifier=v7,revoked_at=v8 where id=v1;
get diagnostics affected=row_count;
return next;
exception when others or query_canceled or assert_failure then
get stacked diagnostics state=returned_sqlstate;
raise exception using errcode=state,message='n88_private_database_error',detail='',hint='';
end;
$n88_boundary$;
revoke all on function n88_private.boundary_08056655f7c73fdf53693a15(text,text,text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function n88_private.boundary_08056655f7c73fdf53693a15(text,text,text,text,text,text,text,text) to n88_backend;
create function n88_private.boundary_2743c40170e1429751d7cce8(p1 text,p2 text,p3 text) returns table(affected bigint)
language plpgsql security invoker set search_path=pg_catalog
as $n88_boundary$
#variable_conflict use_column
declare
v1 text;
v2 integer;
v3 timestamp with time zone;
state text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::text;
v2:=convert_from(decode(p2,'base64'),'UTF8')::integer;
v3:=convert_from(decode(p3,'base64'),'UTF8')::timestamp with time zone;
update n88_private.guess_budgets set count=v2,until_at=v3 where key=v1;
get diagnostics affected=row_count;
return next;
exception when others or query_canceled or assert_failure then
get stacked diagnostics state=returned_sqlstate;
raise exception using errcode=state,message='n88_private_database_error',detail='',hint='';
end;
$n88_boundary$;
revoke all on function n88_private.boundary_2743c40170e1429751d7cce8(text,text,text) from public,anon,authenticated;
grant execute on function n88_private.boundary_2743c40170e1429751d7cce8(text,text,text) to n88_backend;
create function n88_private.boundary_dc3c6d47e9eefd6fefb577c1(p1 text,p2 text,p3 text,p4 text,p5 text,p6 text,p7 text,p8 text,p9 text,p10 text,p11 text,p12 text) returns table(affected bigint)
language plpgsql security invoker set search_path=pg_catalog
as $n88_boundary$
#variable_conflict use_column
declare
v1 uuid;
v2 text;
v3 text;
v4 text;
v5 bigint;
v6 text;
v7 date;
v8 boolean;
v9 boolean;
v10 text;
v11 text;
v12 boolean;
state text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::uuid;
v2:=convert_from(decode(p2,'base64'),'UTF8')::text;
v3:=convert_from(decode(p3,'base64'),'UTF8')::text;
v4:=convert_from(decode(p4,'base64'),'UTF8')::text;
v5:=convert_from(decode(p5,'base64'),'UTF8')::bigint;
v6:=convert_from(decode(p6,'base64'),'UTF8')::text;
v7:=convert_from(decode(p7,'base64'),'UTF8')::date;
v8:=convert_from(decode(p8,'base64'),'UTF8')::boolean;
v9:=convert_from(decode(p9,'base64'),'UTF8')::boolean;
v10:=convert_from(decode(p10,'base64'),'UTF8')::text;
v11:=convert_from(decode(p11,'base64'),'UTF8')::text;
v12:=convert_from(decode(p12,'base64'),'UTF8')::boolean;
update n88_private.memberships set revision=v5,status=v6,end_date=v7,student_active=v8,class_active=v9,label=v10,canonical_stamp=v11,active=v12 where owner_id=v1 and class_id=v2 and student_id=v3 and enrollment_id=v4;
get diagnostics affected=row_count;
return next;
exception when others or query_canceled or assert_failure then
get stacked diagnostics state=returned_sqlstate;
raise exception using errcode=state,message='n88_private_database_error',detail='',hint='';
end;
$n88_boundary$;
revoke all on function n88_private.boundary_dc3c6d47e9eefd6fefb577c1(text,text,text,text,text,text,text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function n88_private.boundary_dc3c6d47e9eefd6fefb577c1(text,text,text,text,text,text,text,text,text,text,text,text) to n88_backend;
create function n88_private.boundary_8926885bfe3455b81ae48704(p1 text,p2 text) returns table(affected bigint)
language plpgsql security invoker set search_path=pg_catalog
as $n88_boundary$
#variable_conflict use_column
declare
v1 text;
v2 jsonb;
state text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::text;
v2:=convert_from(decode(p2,'base64'),'UTF8')::jsonb;
update n88_private.numeric_attempts set payload=v2::jsonb where row_key=v1;
get diagnostics affected=row_count;
return next;
exception when others or query_canceled or assert_failure then
get stacked diagnostics state=returned_sqlstate;
raise exception using errcode=state,message='n88_private_database_error',detail='',hint='';
end;
$n88_boundary$;
revoke all on function n88_private.boundary_8926885bfe3455b81ae48704(text,text) from public,anon,authenticated;
grant execute on function n88_private.boundary_8926885bfe3455b81ae48704(text,text) to n88_backend;
create function n88_private.boundary_f8de722d3598965d1cab8cd6(p1 text,p2 text) returns table(affected bigint)
language plpgsql security invoker set search_path=pg_catalog
as $n88_boundary$
#variable_conflict use_column
declare
v1 text;
v2 jsonb;
state text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::text;
v2:=convert_from(decode(p2,'base64'),'UTF8')::jsonb;
update n88_private.numeric_credentials set payload=v2::jsonb where row_key=v1;
get diagnostics affected=row_count;
return next;
exception when others or query_canceled or assert_failure then
get stacked diagnostics state=returned_sqlstate;
raise exception using errcode=state,message='n88_private_database_error',detail='',hint='';
end;
$n88_boundary$;
revoke all on function n88_private.boundary_f8de722d3598965d1cab8cd6(text,text) from public,anon,authenticated;
grant execute on function n88_private.boundary_f8de722d3598965d1cab8cd6(text,text) to n88_backend;
create function n88_private.boundary_81d29f136a65d7b7fb3e22b7(p1 text,p2 text) returns table(affected bigint)
language plpgsql security invoker set search_path=pg_catalog
as $n88_boundary$
#variable_conflict use_column
declare
v1 text;
v2 jsonb;
state text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::text;
v2:=convert_from(decode(p2,'base64'),'UTF8')::jsonb;
update n88_private.numeric_rates set payload=v2::jsonb where row_key=v1;
get diagnostics affected=row_count;
return next;
exception when others or query_canceled or assert_failure then
get stacked diagnostics state=returned_sqlstate;
raise exception using errcode=state,message='n88_private_database_error',detail='',hint='';
end;
$n88_boundary$;
revoke all on function n88_private.boundary_81d29f136a65d7b7fb3e22b7(text,text) from public,anon,authenticated;
grant execute on function n88_private.boundary_81d29f136a65d7b7fb3e22b7(text,text) to n88_backend;
create function n88_private.boundary_8c4937430e36c8e787e93929(p1 text,p2 text) returns table(affected bigint)
language plpgsql security invoker set search_path=pg_catalog
as $n88_boundary$
#variable_conflict use_column
declare
v1 text;
v2 jsonb;
state text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::text;
v2:=convert_from(decode(p2,'base64'),'UTF8')::jsonb;
update n88_private.numeric_sessions set payload=v2::jsonb where row_key=v1;
get diagnostics affected=row_count;
return next;
exception when others or query_canceled or assert_failure then
get stacked diagnostics state=returned_sqlstate;
raise exception using errcode=state,message='n88_private_database_error',detail='',hint='';
end;
$n88_boundary$;
revoke all on function n88_private.boundary_8c4937430e36c8e787e93929(text,text) from public,anon,authenticated;
grant execute on function n88_private.boundary_8c4937430e36c8e787e93929(text,text) to n88_backend;
create function n88_private.boundary_fa9d3af42f20a68890242235(p1 text,p2 text,p3 text,p4 text,p5 text,p6 text,p7 text,p8 text,p9 text,p10 text,p11 text,p12 text) returns table(affected bigint)
language plpgsql security invoker set search_path=pg_catalog
as $n88_boundary$
#variable_conflict use_column
declare
v1 uuid;
v2 uuid;
v3 text;
v4 text;
v5 text;
v6 text;
v7 text;
v8 text;
v9 text;
v10 date;
v11 text;
v12 boolean;
state text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::uuid;
v2:=convert_from(decode(p2,'base64'),'UTF8')::uuid;
v3:=convert_from(decode(p3,'base64'),'UTF8')::text;
v4:=convert_from(decode(p4,'base64'),'UTF8')::text;
v5:=convert_from(decode(p5,'base64'),'UTF8')::text;
v6:=convert_from(decode(p6,'base64'),'UTF8')::text;
v7:=convert_from(decode(p7,'base64'),'UTF8')::text;
v8:=convert_from(decode(p8,'base64'),'UTF8')::text;
v9:=convert_from(decode(p9,'base64'),'UTF8')::text;
v10:=convert_from(decode(p10,'base64'),'UTF8')::date;
v11:=convert_from(decode(p11,'base64'),'UTF8')::text;
v12:=convert_from(decode(p12,'base64'),'UTF8')::boolean;
update n88_private.publications set owner_id=v2,class_id=v3,student_id=v4,enrollment_id=v5,source_teaching_id=v6,source_item_id=v7,title=v8,instruction=v9,deadline=v10,status=v11,published=v12 where id=v1;
get diagnostics affected=row_count;
return next;
exception when others or query_canceled or assert_failure then
get stacked diagnostics state=returned_sqlstate;
raise exception using errcode=state,message='n88_private_database_error',detail='',hint='';
end;
$n88_boundary$;
revoke all on function n88_private.boundary_fa9d3af42f20a68890242235(text,text,text,text,text,text,text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function n88_private.boundary_fa9d3af42f20a68890242235(text,text,text,text,text,text,text,text,text,text,text,text) to n88_backend;
create function n88_private.boundary_a0e680634378c9709f443e76(p1 text,p2 text,p3 text,p4 text,p5 text,p6 text,p7 text,p8 text,p9 text,p10 text,p11 text,p12 text,p13 text,p14 text) returns table(affected bigint)
language plpgsql security invoker set search_path=pg_catalog
as $n88_boundary$
#variable_conflict use_column
declare
v1 uuid;
v2 uuid;
v3 text;
v4 uuid;
v5 text;
v6 text;
v7 text;
v8 bigint;
v9 bigint;
v10 text;
v11 text;
v12 timestamp with time zone;
v13 timestamp with time zone;
v14 text;
state text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::uuid;
v2:=convert_from(decode(p2,'base64'),'UTF8')::uuid;
v3:=convert_from(decode(p3,'base64'),'UTF8')::text;
v4:=convert_from(decode(p4,'base64'),'UTF8')::uuid;
v5:=convert_from(decode(p5,'base64'),'UTF8')::text;
v6:=convert_from(decode(p6,'base64'),'UTF8')::text;
v7:=convert_from(decode(p7,'base64'),'UTF8')::text;
v8:=convert_from(decode(p8,'base64'),'UTF8')::bigint;
v9:=convert_from(decode(p9,'base64'),'UTF8')::bigint;
v10:=convert_from(decode(p10,'base64'),'UTF8')::text;
v11:=convert_from(decode(p11,'base64'),'UTF8')::text;
v12:=convert_from(decode(p12,'base64'),'UTF8')::timestamp with time zone;
v13:=convert_from(decode(p13,'base64'),'UTF8')::timestamp with time zone;
v14:=convert_from(decode(p14,'base64'),'UTF8')::text;
update n88_private.sessions set credential_id=v2,namespace=v3,owner_id=v4,class_id=v5,student_id=v6,enrollment_id=v7,version=v8,membership_revision=v9,entry_verifier=v10,token_hash=v11,expires_at=v12,revoked_at=v13,canonical_stamp=v14 where id=v1;
get diagnostics affected=row_count;
return next;
exception when others or query_canceled or assert_failure then
get stacked diagnostics state=returned_sqlstate;
raise exception using errcode=state,message='n88_private_database_error',detail='',hint='';
end;
$n88_boundary$;
revoke all on function n88_private.boundary_a0e680634378c9709f443e76(text,text,text,text,text,text,text,text,text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function n88_private.boundary_a0e680634378c9709f443e76(text,text,text,text,text,text,text,text,text,text,text,text,text,text) to n88_backend;
commit;
