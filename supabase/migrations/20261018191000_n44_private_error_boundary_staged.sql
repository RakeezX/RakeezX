-- AI-authored. Append-only N44 private typed error boundary. Original activation migration unchanged.
begin;
set local lock_timeout='2s';
set local statement_timeout='30s';
do $n44_preflight$ begin
 if current_user<>'postgres' or to_regclass('n44_push_draft.contexts') is null
 or not exists(select 1 from pg_roles where rolname='n44_backend' and not rolsuper and not rolbypassrls and not rolcreaterole and not rolcreatedb and not rolreplication)
 or (select pg_get_userbyid(nspowner) from pg_namespace where nspname='n44_push_draft') is distinct from 'postgres'
 or has_schema_privilege('anon','n44_push_draft','usage') or has_schema_privilege('authenticated','n44_push_draft','usage')
 or exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='n44_push_draft' and p.proname like 'boundary_%') then
 raise exception 'n44_boundary_preflight_unavailable';
 end if;
end $n44_preflight$;
create function n44_push_draft.boundary_9e1807d6f453dbedb9809f39(p1 text,p2 text) returns table(affected bigint)
language plpgsql security invoker set search_path=pg_catalog
as $n44_boundary$
#variable_conflict use_column
declare
v1 uuid;
v2 text;
n44_error_sqlstate text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::uuid;
v2:=convert_from(decode(p2,'base64'),'UTF8')::text;
delete from n44_push_draft.budgets where owner_id=v1 and budget_key=v2;
get diagnostics affected=row_count;
return next;
exception when others or query_canceled or assert_failure then
get stacked diagnostics n44_error_sqlstate=returned_sqlstate;
raise exception using errcode=n44_error_sqlstate,message='n44_private_database_error',detail='',hint='';
end;
$n44_boundary$;
revoke all on function n44_push_draft.boundary_9e1807d6f453dbedb9809f39(text,text) from public,anon,authenticated;
grant execute on function n44_push_draft.boundary_9e1807d6f453dbedb9809f39(text,text) to n44_backend;
create function n44_push_draft.boundary_4d3cee78bbdb4f757213f84a(p1 text,p2 text) returns table(affected bigint)
language plpgsql security invoker set search_path=pg_catalog
as $n44_boundary$
#variable_conflict use_column
declare
v1 uuid;
v2 bigint;
n44_error_sqlstate text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::uuid;
v2:=convert_from(decode(p2,'base64'),'UTF8')::bigint;
delete from n44_push_draft.contexts where (owner_id,workspace_id,device_id) in
      (select c.owner_id,c.workspace_id,c.device_id from n44_push_draft.contexts c where c.owner_id=v1 and c.session_expires_at_ms<v2
       and not exists(select 1 from n44_push_draft.registrations r where r.owner_id=c.owner_id and r.workspace_id=c.workspace_id and r.device_id=c.device_id)
       and not exists(select 1 from n44_push_draft.events e where e.owner_id=c.owner_id and e.workspace_id=c.workspace_id and e.device_id=c.device_id)
       order by c.workspace_id,c.device_id limit 100);
get diagnostics affected=row_count;
return next;
exception when others or query_canceled or assert_failure then
get stacked diagnostics n44_error_sqlstate=returned_sqlstate;
raise exception using errcode=n44_error_sqlstate,message='n44_private_database_error',detail='',hint='';
end;
$n44_boundary$;
revoke all on function n44_push_draft.boundary_4d3cee78bbdb4f757213f84a(text,text) from public,anon,authenticated;
grant execute on function n44_push_draft.boundary_4d3cee78bbdb4f757213f84a(text,text) to n44_backend;
create function n44_push_draft.boundary_8d32ef84bf2998c8aec71bd2(p1 text,p2 text,p3 text) returns table(affected bigint)
language plpgsql security invoker set search_path=pg_catalog
as $n44_boundary$
#variable_conflict use_column
declare
v1 uuid;
v2 text;
v3 text;
n44_error_sqlstate text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::uuid;
v2:=convert_from(decode(p2,'base64'),'UTF8')::text;
v3:=convert_from(decode(p3,'base64'),'UTF8')::text;
delete from n44_push_draft.contexts where owner_id=v1 and workspace_id=v2 and device_id=v3;
get diagnostics affected=row_count;
return next;
exception when others or query_canceled or assert_failure then
get stacked diagnostics n44_error_sqlstate=returned_sqlstate;
raise exception using errcode=n44_error_sqlstate,message='n44_private_database_error',detail='',hint='';
end;
$n44_boundary$;
revoke all on function n44_push_draft.boundary_8d32ef84bf2998c8aec71bd2(text,text,text) from public,anon,authenticated;
grant execute on function n44_push_draft.boundary_8d32ef84bf2998c8aec71bd2(text,text,text) to n44_backend;
create function n44_push_draft.boundary_1f67d69c789e10b899db588c(p1 text,p2 text,p3 text,p4 text) returns table(affected bigint)
language plpgsql security invoker set search_path=pg_catalog
as $n44_boundary$
#variable_conflict use_column
declare
v1 uuid;
v2 text;
v3 text;
v4 text;
n44_error_sqlstate text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::uuid;
v2:=convert_from(decode(p2,'base64'),'UTF8')::text;
v3:=convert_from(decode(p3,'base64'),'UTF8')::text;
v4:=convert_from(decode(p4,'base64'),'UTF8')::text;
delete from n44_push_draft.deliveries where owner_id=v1 and workspace_id=v2 and device_id=v3 and event_id=v4;
get diagnostics affected=row_count;
return next;
exception when others or query_canceled or assert_failure then
get stacked diagnostics n44_error_sqlstate=returned_sqlstate;
raise exception using errcode=n44_error_sqlstate,message='n44_private_database_error',detail='',hint='';
end;
$n44_boundary$;
revoke all on function n44_push_draft.boundary_1f67d69c789e10b899db588c(text,text,text,text) from public,anon,authenticated;
grant execute on function n44_push_draft.boundary_1f67d69c789e10b899db588c(text,text,text,text) to n44_backend;
create function n44_push_draft.boundary_a100b221e6220eb46733c104(p1 text,p2 text,p3 text) returns table(affected bigint)
language plpgsql security invoker set search_path=pg_catalog
as $n44_boundary$
#variable_conflict use_column
declare
v1 uuid;
v2 text;
v3 uuid;
n44_error_sqlstate text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::uuid;
v2:=convert_from(decode(p2,'base64'),'UTF8')::text;
v3:=convert_from(decode(p3,'base64'),'UTF8')::uuid;
delete from n44_push_draft.endpoint_claims where owner_id=v1 and fingerprint=v2 and registration_id=v3;
get diagnostics affected=row_count;
return next;
exception when others or query_canceled or assert_failure then
get stacked diagnostics n44_error_sqlstate=returned_sqlstate;
raise exception using errcode=n44_error_sqlstate,message='n44_private_database_error',detail='',hint='';
end;
$n44_boundary$;
revoke all on function n44_push_draft.boundary_a100b221e6220eb46733c104(text,text,text) from public,anon,authenticated;
grant execute on function n44_push_draft.boundary_a100b221e6220eb46733c104(text,text,text) to n44_backend;
create function n44_push_draft.boundary_697dbe22cb8ee13cb70e0454(p1 text,p2 text) returns table(affected bigint)
language plpgsql security invoker set search_path=pg_catalog
as $n44_boundary$
#variable_conflict use_column
declare
v1 uuid;
v2 bigint;
n44_error_sqlstate text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::uuid;
v2:=convert_from(decode(p2,'base64'),'UTF8')::bigint;
delete from n44_push_draft.events where owner_id=v1 and expires_at_ms<v2;
get diagnostics affected=row_count;
return next;
exception when others or query_canceled or assert_failure then
get stacked diagnostics n44_error_sqlstate=returned_sqlstate;
raise exception using errcode=n44_error_sqlstate,message='n44_private_database_error',detail='',hint='';
end;
$n44_boundary$;
revoke all on function n44_push_draft.boundary_697dbe22cb8ee13cb70e0454(text,text) from public,anon,authenticated;
grant execute on function n44_push_draft.boundary_697dbe22cb8ee13cb70e0454(text,text) to n44_backend;
create function n44_push_draft.boundary_f12b405d648c662c0a1bf70b(p1 text,p2 text,p3 text,p4 text,p5 text) returns table(affected bigint)
language plpgsql security invoker set search_path=pg_catalog
as $n44_boundary$
#variable_conflict use_column
declare
v1 uuid;
v2 text;
v3 text;
v4 text;
v5 text;
n44_error_sqlstate text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::uuid;
v2:=convert_from(decode(p2,'base64'),'UTF8')::text;
v3:=convert_from(decode(p3,'base64'),'UTF8')::text;
v4:=convert_from(decode(p4,'base64'),'UTF8')::text;
v5:=convert_from(decode(p5,'base64'),'UTF8')::text;
delete from n44_push_draft.events where owner_id=v1 and workspace_id=v2 and device_id=v3 and source_kind=v4 and source_id=v5;
get diagnostics affected=row_count;
return next;
exception when others or query_canceled or assert_failure then
get stacked diagnostics n44_error_sqlstate=returned_sqlstate;
raise exception using errcode=n44_error_sqlstate,message='n44_private_database_error',detail='',hint='';
end;
$n44_boundary$;
revoke all on function n44_push_draft.boundary_f12b405d648c662c0a1bf70b(text,text,text,text,text) from public,anon,authenticated;
grant execute on function n44_push_draft.boundary_f12b405d648c662c0a1bf70b(text,text,text,text,text) to n44_backend;
create function n44_push_draft.boundary_f4119f9243f2c69562d54a9a(p1 text) returns table(affected bigint)
language plpgsql security invoker set search_path=pg_catalog
as $n44_boundary$
#variable_conflict use_column
declare
v1 bigint;
n44_error_sqlstate text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::bigint;
delete from n44_push_draft.ingress_nonces where nonce in(select nonce from n44_push_draft.ingress_nonces where expires_at_ms<v1 order by expires_at_ms limit 100 for update skip locked);
get diagnostics affected=row_count;
return next;
exception when others or query_canceled or assert_failure then
get stacked diagnostics n44_error_sqlstate=returned_sqlstate;
raise exception using errcode=n44_error_sqlstate,message='n44_private_database_error',detail='',hint='';
end;
$n44_boundary$;
revoke all on function n44_push_draft.boundary_f4119f9243f2c69562d54a9a(text) from public,anon,authenticated;
grant execute on function n44_push_draft.boundary_f4119f9243f2c69562d54a9a(text) to n44_backend;
create function n44_push_draft.boundary_958d83492a17880874f4d951(p1 text) returns table(affected bigint)
language plpgsql security invoker set search_path=pg_catalog
as $n44_boundary$
#variable_conflict use_column
declare
v1 bigint;
n44_error_sqlstate text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::bigint;
delete from n44_push_draft.ingress_rates where key in(select key from n44_push_draft.ingress_rates where expires_at_ms<v1 order by expires_at_ms limit 100 for update skip locked);
get diagnostics affected=row_count;
return next;
exception when others or query_canceled or assert_failure then
get stacked diagnostics n44_error_sqlstate=returned_sqlstate;
raise exception using errcode=n44_error_sqlstate,message='n44_private_database_error',detail='',hint='';
end;
$n44_boundary$;
revoke all on function n44_push_draft.boundary_958d83492a17880874f4d951(text) from public,anon,authenticated;
grant execute on function n44_push_draft.boundary_958d83492a17880874f4d951(text) to n44_backend;
create function n44_push_draft.boundary_0963bbb5e4e36d2618b76f49(p1 text,p2 text) returns table(affected bigint)
language plpgsql security invoker set search_path=pg_catalog
as $n44_boundary$
#variable_conflict use_column
declare
v1 uuid;
v2 uuid;
n44_error_sqlstate text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::uuid;
v2:=convert_from(decode(p2,'base64'),'UTF8')::uuid;
delete from n44_push_draft.registrations where owner_id=v1 and registration_id=v2;
get diagnostics affected=row_count;
return next;
exception when others or query_canceled or assert_failure then
get stacked diagnostics n44_error_sqlstate=returned_sqlstate;
raise exception using errcode=n44_error_sqlstate,message='n44_private_database_error',detail='',hint='';
end;
$n44_boundary$;
revoke all on function n44_push_draft.boundary_0963bbb5e4e36d2618b76f49(text,text) from public,anon,authenticated;
grant execute on function n44_push_draft.boundary_0963bbb5e4e36d2618b76f49(text,text) to n44_backend;
create function n44_push_draft.boundary_72b37da672df631cd5ffdf89(p1 text,p2 text,p3 text,p4 text,p5 text) returns table(affected bigint)
language plpgsql security invoker set search_path=pg_catalog
as $n44_boundary$
#variable_conflict use_column
declare
v1 uuid;
v2 text;
v3 bigint;
v4 integer;
v5 bigint;
n44_error_sqlstate text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::uuid;
v2:=convert_from(decode(p2,'base64'),'UTF8')::text;
v3:=convert_from(decode(p3,'base64'),'UTF8')::bigint;
v4:=convert_from(decode(p4,'base64'),'UTF8')::integer;
v5:=convert_from(decode(p5,'base64'),'UTF8')::bigint;
insert into n44_push_draft.budgets (owner_id,budget_key,bucket,count,expires_at_ms) values (v1,v2,v3,v4,v5) on conflict (owner_id,budget_key) do update set bucket=excluded.bucket,count=excluded.count,expires_at_ms=excluded.expires_at_ms;
get diagnostics affected=row_count;
return next;
exception when others or query_canceled or assert_failure then
get stacked diagnostics n44_error_sqlstate=returned_sqlstate;
raise exception using errcode=n44_error_sqlstate,message='n44_private_database_error',detail='',hint='';
end;
$n44_boundary$;
revoke all on function n44_push_draft.boundary_72b37da672df631cd5ffdf89(text,text,text,text,text) from public,anon,authenticated;
grant execute on function n44_push_draft.boundary_72b37da672df631cd5ffdf89(text,text,text,text,text) to n44_backend;
create function n44_push_draft.boundary_2d3d6a94c46add59c6218ca9(p1 text,p2 text,p3 text,p4 text,p5 text,p6 text,p7 text,p8 text,p9 text,p10 text) returns table(affected bigint)
language plpgsql security invoker set search_path=pg_catalog
as $n44_boundary$
#variable_conflict use_column
declare
v1 uuid;
v2 text;
v3 text;
v4 boolean;
v5 text;
v6 text;
v7 bigint;
v8 text;
v9 boolean;
v10 jsonb;
n44_error_sqlstate text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::uuid;
v2:=convert_from(decode(p2,'base64'),'UTF8')::text;
v3:=convert_from(decode(p3,'base64'),'UTF8')::text;
v4:=convert_from(decode(p4,'base64'),'UTF8')::boolean;
v5:=convert_from(decode(p5,'base64'),'UTF8')::text;
v6:=convert_from(decode(p6,'base64'),'UTF8')::text;
v7:=convert_from(decode(p7,'base64'),'UTF8')::bigint;
v8:=convert_from(decode(p8,'base64'),'UTF8')::text;
v9:=convert_from(decode(p9,'base64'),'UTF8')::boolean;
v10:=convert_from(decode(p10,'base64'),'UTF8')::jsonb;
insert into n44_push_draft.contexts (owner_id,workspace_id,device_id,active,session_id,session_revision,session_expires_at_ms,consent_revision,push_consent,preferences) values (v1,v2,v3,v4,v5,v6,v7,v8,v9,v10) on conflict (owner_id,workspace_id,device_id) do update set active=excluded.active,session_id=excluded.session_id,session_revision=excluded.session_revision,session_expires_at_ms=excluded.session_expires_at_ms,consent_revision=excluded.consent_revision,push_consent=excluded.push_consent,preferences=excluded.preferences;
get diagnostics affected=row_count;
return next;
exception when others or query_canceled or assert_failure then
get stacked diagnostics n44_error_sqlstate=returned_sqlstate;
raise exception using errcode=n44_error_sqlstate,message='n44_private_database_error',detail='',hint='';
end;
$n44_boundary$;
revoke all on function n44_push_draft.boundary_2d3d6a94c46add59c6218ca9(text,text,text,text,text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function n44_push_draft.boundary_2d3d6a94c46add59c6218ca9(text,text,text,text,text,text,text,text,text,text) to n44_backend;
create function n44_push_draft.boundary_57d83ba2323270546aa35a7a(p1 text,p2 text,p3 text,p4 text,p5 text,p6 text,p7 text,p8 text,p9 text,p10 text,p11 text,p12 text) returns table(affected bigint)
language plpgsql security invoker set search_path=pg_catalog
as $n44_boundary$
#variable_conflict use_column
declare
v1 uuid;
v2 text;
v3 text;
v4 text;
v5 uuid;
v6 text;
v7 text;
v8 bigint;
v9 smallint;
v10 text;
v11 bigint;
v12 bigint;
n44_error_sqlstate text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::uuid;
v2:=convert_from(decode(p2,'base64'),'UTF8')::text;
v3:=convert_from(decode(p3,'base64'),'UTF8')::text;
v4:=convert_from(decode(p4,'base64'),'UTF8')::text;
v5:=convert_from(decode(p5,'base64'),'UTF8')::uuid;
v6:=convert_from(decode(p6,'base64'),'UTF8')::text;
v7:=convert_from(decode(p7,'base64'),'UTF8')::text;
v8:=convert_from(decode(p8,'base64'),'UTF8')::bigint;
v9:=convert_from(decode(p9,'base64'),'UTF8')::smallint;
v10:=convert_from(decode(p10,'base64'),'UTF8')::text;
v11:=convert_from(decode(p11,'base64'),'UTF8')::bigint;
v12:=convert_from(decode(p12,'base64'),'UTF8')::bigint;
insert into n44_push_draft.deliveries (owner_id,workspace_id,device_id,event_id,registration_id,kind,action_path,expires_at_ms,attempts,state,started_at_ms,next_at_ms) values (v1,v2,v3,v4,v5,v6,v7,v8,v9,v10,v11,v12) on conflict (owner_id,workspace_id,device_id,event_id) do update set registration_id=excluded.registration_id,kind=excluded.kind,action_path=excluded.action_path,expires_at_ms=excluded.expires_at_ms,attempts=excluded.attempts,state=excluded.state,started_at_ms=excluded.started_at_ms,next_at_ms=excluded.next_at_ms;
get diagnostics affected=row_count;
return next;
exception when others or query_canceled or assert_failure then
get stacked diagnostics n44_error_sqlstate=returned_sqlstate;
raise exception using errcode=n44_error_sqlstate,message='n44_private_database_error',detail='',hint='';
end;
$n44_boundary$;
revoke all on function n44_push_draft.boundary_57d83ba2323270546aa35a7a(text,text,text,text,text,text,text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function n44_push_draft.boundary_57d83ba2323270546aa35a7a(text,text,text,text,text,text,text,text,text,text,text,text) to n44_backend;
create function n44_push_draft.boundary_571c1a4b4896750f1651fee0(p1 text,p2 text,p3 text) returns table(affected bigint)
language plpgsql security invoker set search_path=pg_catalog
as $n44_boundary$
#variable_conflict use_column
declare
v1 text;
v2 uuid;
v3 uuid;
n44_error_sqlstate text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::text;
v2:=convert_from(decode(p2,'base64'),'UTF8')::uuid;
v3:=convert_from(decode(p3,'base64'),'UTF8')::uuid;
insert into n44_push_draft.endpoint_claims(fingerprint,owner_id,registration_id) values (v1,v2,v3);
get diagnostics affected=row_count;
return next;
exception when others or query_canceled or assert_failure then
get stacked diagnostics n44_error_sqlstate=returned_sqlstate;
raise exception using errcode=n44_error_sqlstate,message='n44_private_database_error',detail='',hint='';
end;
$n44_boundary$;
revoke all on function n44_push_draft.boundary_571c1a4b4896750f1651fee0(text,text,text) from public,anon,authenticated;
grant execute on function n44_push_draft.boundary_571c1a4b4896750f1651fee0(text,text,text) to n44_backend;
create function n44_push_draft.boundary_08b402c7cddf335f98d6f8b1(p1 text,p2 text,p3 text,p4 text,p5 text,p6 text,p7 text,p8 text,p9 text,p10 text) returns table(affected bigint)
language plpgsql security invoker set search_path=pg_catalog
as $n44_boundary$
#variable_conflict use_column
declare
v1 uuid;
v2 text;
v3 text;
v4 text;
v5 text;
v6 text;
v7 text;
v8 bigint;
v9 bigint;
v10 jsonb;
n44_error_sqlstate text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::uuid;
v2:=convert_from(decode(p2,'base64'),'UTF8')::text;
v3:=convert_from(decode(p3,'base64'),'UTF8')::text;
v4:=convert_from(decode(p4,'base64'),'UTF8')::text;
v5:=convert_from(decode(p5,'base64'),'UTF8')::text;
v6:=convert_from(decode(p6,'base64'),'UTF8')::text;
v7:=convert_from(decode(p7,'base64'),'UTF8')::text;
v8:=convert_from(decode(p8,'base64'),'UTF8')::bigint;
v9:=convert_from(decode(p9,'base64'),'UTF8')::bigint;
v10:=convert_from(decode(p10,'base64'),'UTF8')::jsonb;
insert into n44_push_draft.events values(v1,v2,v3,v4,v5,v6,v7,v8,v9,v10);
get diagnostics affected=row_count;
return next;
exception when others or query_canceled or assert_failure then
get stacked diagnostics n44_error_sqlstate=returned_sqlstate;
raise exception using errcode=n44_error_sqlstate,message='n44_private_database_error',detail='',hint='';
end;
$n44_boundary$;
revoke all on function n44_push_draft.boundary_08b402c7cddf335f98d6f8b1(text,text,text,text,text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function n44_push_draft.boundary_08b402c7cddf335f98d6f8b1(text,text,text,text,text,text,text,text,text,text) to n44_backend;
create function n44_push_draft.boundary_2c43bf7a0025aee704aaf82a(p1 text,p2 text,p3 text) returns table("nonce" uuid)
language plpgsql security invoker set search_path=pg_catalog
as $n44_boundary$
#variable_conflict use_column
declare
v1 uuid;
v2 text;
v3 bigint;
n44_error_sqlstate text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::uuid;
v2:=convert_from(decode(p2,'base64'),'UTF8')::text;
v3:=convert_from(decode(p3,'base64'),'UTF8')::bigint;
return query insert into n44_push_draft.ingress_nonces(nonce,scope,expires_at_ms) values(v1,v2,v3) on conflict do nothing returning nonce;
exception when others or query_canceled or assert_failure then
get stacked diagnostics n44_error_sqlstate=returned_sqlstate;
raise exception using errcode=n44_error_sqlstate,message='n44_private_database_error',detail='',hint='';
end;
$n44_boundary$;
revoke all on function n44_push_draft.boundary_2c43bf7a0025aee704aaf82a(text,text,text) from public,anon,authenticated;
grant execute on function n44_push_draft.boundary_2c43bf7a0025aee704aaf82a(text,text,text) to n44_backend;
create function n44_push_draft.boundary_20790036fac6c275f03edd5b(p1 text,p2 text,p3 text,p4 text,p5 text) returns table("count" integer)
language plpgsql security invoker set search_path=pg_catalog
as $n44_boundary$
#variable_conflict use_column
declare
v1 text;
v2 bigint;
v3 bigint;
v4 integer;
v5 text;
n44_error_sqlstate text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::text;
v2:=convert_from(decode(p2,'base64'),'UTF8')::bigint;
v3:=convert_from(decode(p3,'base64'),'UTF8')::bigint;
v4:=convert_from(decode(p4,'base64'),'UTF8')::integer;
v5:=convert_from(decode(p5,'base64'),'UTF8')::text;
return query insert into n44_push_draft.ingress_rates(key,bucket,count,expires_at_ms,kind) values(v1,v2,1,v3,v5)
   on conflict(key) do update set bucket=excluded.bucket,count=case when ingress_rates.bucket=excluded.bucket then ingress_rates.count+1 else 1 end,expires_at_ms=excluded.expires_at_ms
   where ingress_rates.bucket<>excluded.bucket or ingress_rates.count<v4 returning count;
exception when others or query_canceled or assert_failure then
get stacked diagnostics n44_error_sqlstate=returned_sqlstate;
raise exception using errcode=n44_error_sqlstate,message='n44_private_database_error',detail='',hint='';
end;
$n44_boundary$;
revoke all on function n44_push_draft.boundary_20790036fac6c275f03edd5b(text,text,text,text,text) from public,anon,authenticated;
grant execute on function n44_push_draft.boundary_20790036fac6c275f03edd5b(text,text,text,text,text) to n44_backend;
create function n44_push_draft.boundary_57d6dbe5ee3c94681d78bab0(p1 text) returns table(affected bigint)
language plpgsql security invoker set search_path=pg_catalog
as $n44_boundary$
#variable_conflict use_column
declare
v1 uuid;
n44_error_sqlstate text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::uuid;
insert into n44_push_draft.owner_clock(owner_id,high_water_ms) values (v1,0) on conflict (owner_id) do nothing;
get diagnostics affected=row_count;
return next;
exception when others or query_canceled or assert_failure then
get stacked diagnostics n44_error_sqlstate=returned_sqlstate;
raise exception using errcode=n44_error_sqlstate,message='n44_private_database_error',detail='',hint='';
end;
$n44_boundary$;
revoke all on function n44_push_draft.boundary_57d6dbe5ee3c94681d78bab0(text) from public,anon,authenticated;
grant execute on function n44_push_draft.boundary_57d6dbe5ee3c94681d78bab0(text) to n44_backend;
create function n44_push_draft.boundary_833ceede5c0a62e801d753b1(p1 text,p2 text,p3 text,p4 text,p5 text,p6 text,p7 text,p8 text,p9 text,p10 text,p11 text,p12 text) returns table(affected bigint)
language plpgsql security invoker set search_path=pg_catalog
as $n44_boundary$
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
v9 bigint;
v10 text;
v11 text;
v12 text;
n44_error_sqlstate text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::uuid;
v2:=convert_from(decode(p2,'base64'),'UTF8')::uuid;
v3:=convert_from(decode(p3,'base64'),'UTF8')::text;
v4:=convert_from(decode(p4,'base64'),'UTF8')::text;
v5:=convert_from(decode(p5,'base64'),'UTF8')::text;
v6:=convert_from(decode(p6,'base64'),'UTF8')::text;
v7:=convert_from(decode(p7,'base64'),'UTF8')::text;
v8:=convert_from(decode(p8,'base64'),'UTF8')::text;
v9:=convert_from(decode(p9,'base64'),'UTF8')::bigint;
v10:=convert_from(decode(p10,'base64'),'UTF8')::text;
v11:=convert_from(decode(p11,'base64'),'UTF8')::text;
v12:=convert_from(decode(p12,'base64'),'UTF8')::text;
insert into n44_push_draft.registrations (owner_id,registration_id,workspace_id,device_id,session_id,session_revision,consent_revision,state,expires_at_ms,sealed,fingerprint,binding_fingerprint) values (v1,v2,v3,v4,v5,v6,v7,v8,v9,v10,v11,v12) on conflict (owner_id,registration_id) do update set workspace_id=excluded.workspace_id,device_id=excluded.device_id,session_id=excluded.session_id,session_revision=excluded.session_revision,consent_revision=excluded.consent_revision,state=excluded.state,expires_at_ms=excluded.expires_at_ms,sealed=excluded.sealed,fingerprint=excluded.fingerprint,binding_fingerprint=excluded.binding_fingerprint;
get diagnostics affected=row_count;
return next;
exception when others or query_canceled or assert_failure then
get stacked diagnostics n44_error_sqlstate=returned_sqlstate;
raise exception using errcode=n44_error_sqlstate,message='n44_private_database_error',detail='',hint='';
end;
$n44_boundary$;
revoke all on function n44_push_draft.boundary_833ceede5c0a62e801d753b1(text,text,text,text,text,text,text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function n44_push_draft.boundary_833ceede5c0a62e801d753b1(text,text,text,text,text,text,text,text,text,text,text,text) to n44_backend;
create function n44_push_draft.boundary_350c9c4a986b92433b3dd0eb(p1 text,p2 text,p3 text) returns table("ms" text)
language plpgsql security invoker set search_path=pg_catalog
as $n44_boundary$
#variable_conflict use_column
declare
v1 date;
v2 time without time zone;
v3 text;
n44_error_sqlstate text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::date;
v2:=convert_from(decode(p2,'base64'),'UTF8')::time without time zone;
v3:=convert_from(decode(p3,'base64'),'UTF8')::text;
return query select (extract(epoch from ((v1::date+v2::time) at time zone v3))*1000)::bigint::text as ms;
exception when others or query_canceled or assert_failure then
get stacked diagnostics n44_error_sqlstate=returned_sqlstate;
raise exception using errcode=n44_error_sqlstate,message='n44_private_database_error',detail='',hint='';
end;
$n44_boundary$;
revoke all on function n44_push_draft.boundary_350c9c4a986b92433b3dd0eb(text,text,text) from public,anon,authenticated;
grant execute on function n44_push_draft.boundary_350c9c4a986b92433b3dd0eb(text,text,text) to n44_backend;
create function n44_push_draft.boundary_93cef969458b6f604774a29e(p1 text,p2 text,p3 text,p4 text) returns table("owner_id" uuid,"workspace_id" text,"device_id" text,"event_id" text,"source_kind" text,"source_id" text,"source_stamp" text,"due_at_ms" bigint,"expires_at_ms" bigint,"payload" jsonb)
language plpgsql security invoker set search_path=pg_catalog
as $n44_boundary$
#variable_conflict use_column
declare
v1 uuid;
v2 text;
v3 text;
v4 text;
n44_error_sqlstate text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::uuid;
v2:=convert_from(decode(p2,'base64'),'UTF8')::text;
v3:=convert_from(decode(p3,'base64'),'UTF8')::text;
v4:=convert_from(decode(p4,'base64'),'UTF8')::text;
return query select * from n44_push_draft.events where owner_id=v1 and workspace_id=v2 and device_id=v3 and event_id=v4;
exception when others or query_canceled or assert_failure then
get stacked diagnostics n44_error_sqlstate=returned_sqlstate;
raise exception using errcode=n44_error_sqlstate,message='n44_private_database_error',detail='',hint='';
end;
$n44_boundary$;
revoke all on function n44_push_draft.boundary_93cef969458b6f604774a29e(text,text,text,text) from public,anon,authenticated;
grant execute on function n44_push_draft.boundary_93cef969458b6f604774a29e(text,text,text,text) to n44_backend;
create function n44_push_draft.boundary_4c02517c5dfbdffd1c5b454c(p1 text) returns table("owner_id" uuid,"workspace_id" text,"device_id" text,"event_id" text,"source_kind" text,"source_id" text,"source_stamp" text,"due_at_ms" bigint,"expires_at_ms" bigint,"payload" jsonb)
language plpgsql security invoker set search_path=pg_catalog
as $n44_boundary$
#variable_conflict use_column
declare
v1 uuid;
n44_error_sqlstate text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::uuid;
return query select * from n44_push_draft.events where owner_id=v1 order by workspace_id,device_id,event_id limit 101;
exception when others or query_canceled or assert_failure then
get stacked diagnostics n44_error_sqlstate=returned_sqlstate;
raise exception using errcode=n44_error_sqlstate,message='n44_private_database_error',detail='',hint='';
end;
$n44_boundary$;
revoke all on function n44_push_draft.boundary_4c02517c5dfbdffd1c5b454c(text) from public,anon,authenticated;
grant execute on function n44_push_draft.boundary_4c02517c5dfbdffd1c5b454c(text) to n44_backend;
create function n44_push_draft.boundary_7336f6d16dcf854f092f8756(p1 text,p2 text) returns table("budget_key" text,"bucket" text,"count" integer,"expires_at_ms" text)
language plpgsql security invoker set search_path=pg_catalog
as $n44_boundary$
#variable_conflict use_column
declare
v1 uuid;
v2 bigint;
n44_error_sqlstate text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::uuid;
v2:=convert_from(decode(p2,'base64'),'UTF8')::bigint;
return query select budget_key,bucket::text as bucket,count,expires_at_ms::text as expires_at_ms from n44_push_draft.budgets where owner_id=v1 limit v2;
exception when others or query_canceled or assert_failure then
get stacked diagnostics n44_error_sqlstate=returned_sqlstate;
raise exception using errcode=n44_error_sqlstate,message='n44_private_database_error',detail='',hint='';
end;
$n44_boundary$;
revoke all on function n44_push_draft.boundary_7336f6d16dcf854f092f8756(text,text) from public,anon,authenticated;
grant execute on function n44_push_draft.boundary_7336f6d16dcf854f092f8756(text,text) to n44_backend;
create function n44_push_draft.boundary_fccb5d5603d6024dad280c6a(p1 text,p2 text,p3 text,p4 text,p5 text) returns table("source_stamp" text)
language plpgsql security invoker set search_path=pg_catalog
as $n44_boundary$
#variable_conflict use_column
declare
v1 uuid;
v2 text;
v3 text;
v4 text;
v5 text;
n44_error_sqlstate text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::uuid;
v2:=convert_from(decode(p2,'base64'),'UTF8')::text;
v3:=convert_from(decode(p3,'base64'),'UTF8')::text;
v4:=convert_from(decode(p4,'base64'),'UTF8')::text;
v5:=convert_from(decode(p5,'base64'),'UTF8')::text;
return query select distinct source_stamp from n44_push_draft.events where owner_id=v1 and workspace_id=v2 and device_id=v3 and source_kind=v4 and source_id=v5;
exception when others or query_canceled or assert_failure then
get stacked diagnostics n44_error_sqlstate=returned_sqlstate;
raise exception using errcode=n44_error_sqlstate,message='n44_private_database_error',detail='',hint='';
end;
$n44_boundary$;
revoke all on function n44_push_draft.boundary_fccb5d5603d6024dad280c6a(text,text,text,text,text) from public,anon,authenticated;
grant execute on function n44_push_draft.boundary_fccb5d5603d6024dad280c6a(text,text,text,text,text) to n44_backend;
create function n44_push_draft.boundary_ed6266829f26128220d17b4f(p1 text,p2 text,p3 text,p4 text,p5 text,p6 text,p7 text,p8 text) returns table("owner_id" uuid,"workspace_id" text,"device_id" text,"event_id" text,"source_kind" text,"source_id" text,"source_stamp" text,"due_at_ms" bigint,"expires_at_ms" bigint,"payload" jsonb,"registration_id" uuid)
language plpgsql security invoker set search_path=pg_catalog
as $n44_boundary$
#variable_conflict use_column
declare
v1 bigint;
v2 bigint;
v3 uuid;
v4 text;
v5 text;
v6 text;
v7 uuid;
v8 bigint;
n44_error_sqlstate text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::bigint;
v2:=convert_from(decode(p2,'base64'),'UTF8')::bigint;
v3:=convert_from(decode(p3,'base64'),'UTF8')::uuid;
v4:=convert_from(decode(p4,'base64'),'UTF8')::text;
v5:=convert_from(decode(p5,'base64'),'UTF8')::text;
v6:=convert_from(decode(p6,'base64'),'UTF8')::text;
v7:=convert_from(decode(p7,'base64'),'UTF8')::uuid;
v8:=convert_from(decode(p8,'base64'),'UTF8')::bigint;
return query select e.*,r.registration_id from n44_push_draft.events e
   join n44_push_draft.registrations r on r.owner_id=e.owner_id and r.workspace_id=e.workspace_id and r.device_id=e.device_id
   left join n44_push_draft.deliveries d on d.owner_id=e.owner_id and d.workspace_id=e.workspace_id and d.device_id=e.device_id and d.event_id=e.event_id
   where e.due_at_ms<=v1 and e.expires_at_ms>v1 and r.state='active' and r.expires_at_ms>v1
   and (d.state is null or d.state='retry' and d.next_at_ms<=v1)
   and (e.due_at_ms,e.owner_id,e.workspace_id,e.device_id,e.event_id,r.registration_id)>(v2,v3::uuid,v4,v5,v6,v7::uuid)
   order by e.due_at_ms,e.owner_id,e.workspace_id,e.device_id,e.event_id,r.registration_id limit v8;
exception when others or query_canceled or assert_failure then
get stacked diagnostics n44_error_sqlstate=returned_sqlstate;
raise exception using errcode=n44_error_sqlstate,message='n44_private_database_error',detail='',hint='';
end;
$n44_boundary$;
revoke all on function n44_push_draft.boundary_ed6266829f26128220d17b4f(text,text,text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function n44_push_draft.boundary_ed6266829f26128220d17b4f(text,text,text,text,text,text,text,text) to n44_backend;
create function n44_push_draft.boundary_b7889ac22eace9e5a9d26592(p1 text) returns table("event_id" text)
language plpgsql security invoker set search_path=pg_catalog
as $n44_boundary$
#variable_conflict use_column
declare
v1 uuid;
n44_error_sqlstate text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::uuid;
return query select event_id from n44_push_draft.events where owner_id=v1 limit 101;
exception when others or query_canceled or assert_failure then
get stacked diagnostics n44_error_sqlstate=returned_sqlstate;
raise exception using errcode=n44_error_sqlstate,message='n44_private_database_error',detail='',hint='';
end;
$n44_boundary$;
revoke all on function n44_push_draft.boundary_b7889ac22eace9e5a9d26592(text) from public,anon,authenticated;
grant execute on function n44_push_draft.boundary_b7889ac22eace9e5a9d26592(text) to n44_backend;
create function n44_push_draft.boundary_0657f8ea1df759451545fc97(p1 text,p2 text) returns table("fingerprint" text,"registration_id" uuid)
language plpgsql security invoker set search_path=pg_catalog
as $n44_boundary$
#variable_conflict use_column
declare
v1 uuid;
v2 bigint;
n44_error_sqlstate text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::uuid;
v2:=convert_from(decode(p2,'base64'),'UTF8')::bigint;
return query select fingerprint,registration_id from n44_push_draft.endpoint_claims where owner_id=v1 limit v2;
exception when others or query_canceled or assert_failure then
get stacked diagnostics n44_error_sqlstate=returned_sqlstate;
raise exception using errcode=n44_error_sqlstate,message='n44_private_database_error',detail='',hint='';
end;
$n44_boundary$;
revoke all on function n44_push_draft.boundary_0657f8ea1df759451545fc97(text,text) from public,anon,authenticated;
grant execute on function n44_push_draft.boundary_0657f8ea1df759451545fc97(text,text) to n44_backend;
create function n44_push_draft.boundary_023fe46060e1428d8c69aecf() returns table("now_ms" text)
language plpgsql security invoker set search_path=pg_catalog
as $n44_boundary$
#variable_conflict use_column
declare

n44_error_sqlstate text;
begin

return query select floor(extract(epoch from clock_timestamp())*1000)::bigint::text as now_ms;
exception when others or query_canceled or assert_failure then
get stacked diagnostics n44_error_sqlstate=returned_sqlstate;
raise exception using errcode=n44_error_sqlstate,message='n44_private_database_error',detail='',hint='';
end;
$n44_boundary$;
revoke all on function n44_push_draft.boundary_023fe46060e1428d8c69aecf() from public,anon,authenticated;
grant execute on function n44_push_draft.boundary_023fe46060e1428d8c69aecf() to n44_backend;
create function n44_push_draft.boundary_357fab36c862af9b35603721(p1 text) returns table("high_water_ms" text)
language plpgsql security invoker set search_path=pg_catalog
as $n44_boundary$
#variable_conflict use_column
declare
v1 uuid;
n44_error_sqlstate text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::uuid;
return query select high_water_ms::text as high_water_ms from n44_push_draft.owner_clock where owner_id=v1 for update;
exception when others or query_canceled or assert_failure then
get stacked diagnostics n44_error_sqlstate=returned_sqlstate;
raise exception using errcode=n44_error_sqlstate,message='n44_private_database_error',detail='',hint='';
end;
$n44_boundary$;
revoke all on function n44_push_draft.boundary_357fab36c862af9b35603721(text) from public,anon,authenticated;
grant execute on function n44_push_draft.boundary_357fab36c862af9b35603721(text) to n44_backend;
create function n44_push_draft.boundary_09d8680e5bc700fdfd80e133(p1 text) returns table("key" text)
language plpgsql security invoker set search_path=pg_catalog
as $n44_boundary$
#variable_conflict use_column
declare
v1 text;
n44_error_sqlstate text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::text;
return query select key from n44_push_draft.ingress_rates where kind=v1 limit 2049;
exception when others or query_canceled or assert_failure then
get stacked diagnostics n44_error_sqlstate=returned_sqlstate;
raise exception using errcode=n44_error_sqlstate,message='n44_private_database_error',detail='',hint='';
end;
$n44_boundary$;
revoke all on function n44_push_draft.boundary_09d8680e5bc700fdfd80e133(text) from public,anon,authenticated;
grant execute on function n44_push_draft.boundary_09d8680e5bc700fdfd80e133(text) to n44_backend;
create function n44_push_draft.boundary_e5608f0030522cd46dc1e398(p1 text,p2 text,p3 text) returns table("source" jsonb)
language plpgsql security invoker set search_path=pg_catalog
as $n44_boundary$
#variable_conflict use_column
declare
v1 uuid;
v2 text;
v3 text;
n44_error_sqlstate text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::uuid;
v2:=convert_from(decode(p2,'base64'),'UTF8')::text;
v3:=convert_from(decode(p3,'base64'),'UTF8')::text;
return query select n44_push_draft.read_source(v1::uuid,v2::text,v3::text) as source;
exception when others or query_canceled or assert_failure then
get stacked diagnostics n44_error_sqlstate=returned_sqlstate;
raise exception using errcode=n44_error_sqlstate,message='n44_private_database_error',detail='',hint='';
end;
$n44_boundary$;
revoke all on function n44_push_draft.boundary_e5608f0030522cd46dc1e398(text,text,text) from public,anon,authenticated;
grant execute on function n44_push_draft.boundary_e5608f0030522cd46dc1e398(text,text,text) to n44_backend;
create function n44_push_draft.boundary_9f189e29d3d1075a21008022(p1 text,p2 text) returns table("nonce" uuid)
language plpgsql security invoker set search_path=pg_catalog
as $n44_boundary$
#variable_conflict use_column
declare
v1 text;
v2 bigint;
n44_error_sqlstate text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::text;
v2:=convert_from(decode(p2,'base64'),'UTF8')::bigint;
return query select nonce from n44_push_draft.ingress_nonces where scope=v1 limit v2;
exception when others or query_canceled or assert_failure then
get stacked diagnostics n44_error_sqlstate=returned_sqlstate;
raise exception using errcode=n44_error_sqlstate,message='n44_private_database_error',detail='',hint='';
end;
$n44_boundary$;
revoke all on function n44_push_draft.boundary_9f189e29d3d1075a21008022(text,text) from public,anon,authenticated;
grant execute on function n44_push_draft.boundary_9f189e29d3d1075a21008022(text,text) to n44_backend;
create function n44_push_draft.boundary_cb6b899cd42acdb1d185e923(p1 text,p2 text) returns table("owner_id" uuid)
language plpgsql security invoker set search_path=pg_catalog
as $n44_boundary$
#variable_conflict use_column
declare
v1 bigint;
v2 bigint;
n44_error_sqlstate text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::bigint;
v2:=convert_from(decode(p2,'base64'),'UTF8')::bigint;
return query select owner_id from n44_push_draft.owner_clock where next_cleanup_ms<=v1 order by next_cleanup_ms,owner_id limit v2 for update skip locked;
exception when others or query_canceled or assert_failure then
get stacked diagnostics n44_error_sqlstate=returned_sqlstate;
raise exception using errcode=n44_error_sqlstate,message='n44_private_database_error',detail='',hint='';
end;
$n44_boundary$;
revoke all on function n44_push_draft.boundary_cb6b899cd42acdb1d185e923(text,text) from public,anon,authenticated;
grant execute on function n44_push_draft.boundary_cb6b899cd42acdb1d185e923(text,text) to n44_backend;
create function n44_push_draft.boundary_eaec15024b66e2fdb8d82ac8(p1 text) returns table("owner_id" uuid)
language plpgsql security invoker set search_path=pg_catalog
as $n44_boundary$
#variable_conflict use_column
declare
v1 uuid;
n44_error_sqlstate text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::uuid;
return query select owner_id from n44_push_draft.owner_clock where owner_id=v1 for update;
exception when others or query_canceled or assert_failure then
get stacked diagnostics n44_error_sqlstate=returned_sqlstate;
raise exception using errcode=n44_error_sqlstate,message='n44_private_database_error',detail='',hint='';
end;
$n44_boundary$;
revoke all on function n44_push_draft.boundary_eaec15024b66e2fdb8d82ac8(text) from public,anon,authenticated;
grant execute on function n44_push_draft.boundary_eaec15024b66e2fdb8d82ac8(text) to n44_backend;
create function n44_push_draft.boundary_8c5c3b9f064a030860af0a50(p1 text) returns void
language plpgsql security invoker set search_path=pg_catalog
as $n44_boundary$
#variable_conflict use_column
declare
v1 text;
n44_error_sqlstate text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::text;
perform pg_advisory_xact_lock(44001,hashtext(v1));
return;
exception when others or query_canceled or assert_failure then
get stacked diagnostics n44_error_sqlstate=returned_sqlstate;
raise exception using errcode=n44_error_sqlstate,message='n44_private_database_error',detail='',hint='';
end;
$n44_boundary$;
revoke all on function n44_push_draft.boundary_8c5c3b9f064a030860af0a50(text) from public,anon,authenticated;
grant execute on function n44_push_draft.boundary_8c5c3b9f064a030860af0a50(text) to n44_backend;
create function n44_push_draft.boundary_60c5663ba998b06c67fa4941(p1 text) returns void
language plpgsql security invoker set search_path=pg_catalog
as $n44_boundary$
#variable_conflict use_column
declare
v1 text;
n44_error_sqlstate text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::text;
perform pg_advisory_xact_lock(44002,hashtext(v1));
return;
exception when others or query_canceled or assert_failure then
get stacked diagnostics n44_error_sqlstate=returned_sqlstate;
raise exception using errcode=n44_error_sqlstate,message='n44_private_database_error',detail='',hint='';
end;
$n44_boundary$;
revoke all on function n44_push_draft.boundary_60c5663ba998b06c67fa4941(text) from public,anon,authenticated;
grant execute on function n44_push_draft.boundary_60c5663ba998b06c67fa4941(text) to n44_backend;
create function n44_push_draft.boundary_08270c0bd4eb5e36c5b58065(p1 text,p2 text) returns table("registration_id" uuid,"workspace_id" text,"device_id" text,"session_id" text,"session_revision" text,"consent_revision" text,"state" text,"expires_at_ms" text,"sealed" text,"fingerprint" text,"binding_fingerprint" text)
language plpgsql security invoker set search_path=pg_catalog
as $n44_boundary$
#variable_conflict use_column
declare
v1 uuid;
v2 bigint;
n44_error_sqlstate text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::uuid;
v2:=convert_from(decode(p2,'base64'),'UTF8')::bigint;
return query select registration_id,workspace_id,device_id,session_id,session_revision,consent_revision,state,expires_at_ms::text as expires_at_ms,sealed,fingerprint,binding_fingerprint from n44_push_draft.registrations where owner_id=v1 limit v2;
exception when others or query_canceled or assert_failure then
get stacked diagnostics n44_error_sqlstate=returned_sqlstate;
raise exception using errcode=n44_error_sqlstate,message='n44_private_database_error',detail='',hint='';
end;
$n44_boundary$;
revoke all on function n44_push_draft.boundary_08270c0bd4eb5e36c5b58065(text,text) from public,anon,authenticated;
grant execute on function n44_push_draft.boundary_08270c0bd4eb5e36c5b58065(text,text) to n44_backend;
create function n44_push_draft.boundary_ad31702f95cafad7fa108a0b(p1 text,p2 text) returns table("user_id" uuid,"session_id" uuid,"not_after_ms" bigint)
language plpgsql security invoker set search_path=pg_catalog
as $n44_boundary$
#variable_conflict use_column
declare
v1 uuid;
v2 uuid;
n44_error_sqlstate text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::uuid;
v2:=convert_from(decode(p2,'base64'),'UTF8')::uuid;
return query select user_id,session_id,not_after_ms from n44_push_draft.lock_current_session(v1::uuid,v2::uuid);
exception when others or query_canceled or assert_failure then
get stacked diagnostics n44_error_sqlstate=returned_sqlstate;
raise exception using errcode=n44_error_sqlstate,message='n44_private_database_error',detail='',hint='';
end;
$n44_boundary$;
revoke all on function n44_push_draft.boundary_ad31702f95cafad7fa108a0b(text,text) from public,anon,authenticated;
grant execute on function n44_push_draft.boundary_ad31702f95cafad7fa108a0b(text,text) to n44_backend;
create function n44_push_draft.boundary_768e347f711092582bf45865(p1 text,p2 text) returns table("workspace_id" text,"device_id" text,"active" boolean,"session_id" text,"session_revision" text,"session_expires_at_ms" text,"consent_revision" text,"push_consent" boolean,"preferences" text)
language plpgsql security invoker set search_path=pg_catalog
as $n44_boundary$
#variable_conflict use_column
declare
v1 uuid;
v2 bigint;
n44_error_sqlstate text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::uuid;
v2:=convert_from(decode(p2,'base64'),'UTF8')::bigint;
return query select workspace_id,device_id,active,session_id,session_revision,session_expires_at_ms::text as session_expires_at_ms,consent_revision,push_consent,preferences::text as preferences from n44_push_draft.contexts where owner_id=v1 limit v2;
exception when others or query_canceled or assert_failure then
get stacked diagnostics n44_error_sqlstate=returned_sqlstate;
raise exception using errcode=n44_error_sqlstate,message='n44_private_database_error',detail='',hint='';
end;
$n44_boundary$;
revoke all on function n44_push_draft.boundary_768e347f711092582bf45865(text,text) from public,anon,authenticated;
grant execute on function n44_push_draft.boundary_768e347f711092582bf45865(text,text) to n44_backend;
create function n44_push_draft.boundary_fa37dbfb7c54ef1196b0e5fb(p1 text,p2 text) returns table("workspace_id" text,"device_id" text,"event_id" text,"registration_id" uuid,"kind" text,"action_path" text,"expires_at_ms" text,"attempts" smallint,"state" text,"started_at_ms" text,"next_at_ms" text)
language plpgsql security invoker set search_path=pg_catalog
as $n44_boundary$
#variable_conflict use_column
declare
v1 uuid;
v2 bigint;
n44_error_sqlstate text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::uuid;
v2:=convert_from(decode(p2,'base64'),'UTF8')::bigint;
return query select workspace_id,device_id,event_id,registration_id,kind,action_path,expires_at_ms::text as expires_at_ms,attempts,state,started_at_ms::text as started_at_ms,next_at_ms::text as next_at_ms from n44_push_draft.deliveries where owner_id=v1 limit v2;
exception when others or query_canceled or assert_failure then
get stacked diagnostics n44_error_sqlstate=returned_sqlstate;
raise exception using errcode=n44_error_sqlstate,message='n44_private_database_error',detail='',hint='';
end;
$n44_boundary$;
revoke all on function n44_push_draft.boundary_fa37dbfb7c54ef1196b0e5fb(text,text) from public,anon,authenticated;
grant execute on function n44_push_draft.boundary_fa37dbfb7c54ef1196b0e5fb(text,text) to n44_backend;
create function n44_push_draft.boundary_bb27477c2541b2ec5f1428a1(p1 text,p2 text) returns table(affected bigint)
language plpgsql security invoker set search_path=pg_catalog
as $n44_boundary$
#variable_conflict use_column
declare
v1 uuid;
v2 bigint;
n44_error_sqlstate text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::uuid;
v2:=convert_from(decode(p2,'base64'),'UTF8')::bigint;
update n44_push_draft.owner_clock set high_water_ms=v2 where owner_id=v1;
get diagnostics affected=row_count;
return next;
exception when others or query_canceled or assert_failure then
get stacked diagnostics n44_error_sqlstate=returned_sqlstate;
raise exception using errcode=n44_error_sqlstate,message='n44_private_database_error',detail='',hint='';
end;
$n44_boundary$;
revoke all on function n44_push_draft.boundary_bb27477c2541b2ec5f1428a1(text,text) from public,anon,authenticated;
grant execute on function n44_push_draft.boundary_bb27477c2541b2ec5f1428a1(text,text) to n44_backend;
create function n44_push_draft.boundary_34c39487076c19af0100723c(p1 text,p2 text) returns table(affected bigint)
language plpgsql security invoker set search_path=pg_catalog
as $n44_boundary$
#variable_conflict use_column
declare
v1 uuid;
v2 bigint;
n44_error_sqlstate text;
begin
v1:=convert_from(decode(p1,'base64'),'UTF8')::uuid;
v2:=convert_from(decode(p2,'base64'),'UTF8')::bigint;
update n44_push_draft.owner_clock set next_cleanup_ms=v2 where owner_id=v1;
get diagnostics affected=row_count;
return next;
exception when others or query_canceled or assert_failure then
get stacked diagnostics n44_error_sqlstate=returned_sqlstate;
raise exception using errcode=n44_error_sqlstate,message='n44_private_database_error',detail='',hint='';
end;
$n44_boundary$;
revoke all on function n44_push_draft.boundary_34c39487076c19af0100723c(text,text) from public,anon,authenticated;
grant execute on function n44_push_draft.boundary_34c39487076c19af0100723c(text,text) to n44_backend;
commit;
