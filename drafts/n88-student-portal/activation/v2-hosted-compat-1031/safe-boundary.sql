-- AI: versioned fixed14 wrappers. Decoding/casts and original execution are INSIDE protected blocks.
create function n88_private.safe_1031_f8a1689cd78951d7fc52ef91(p text) returns jsonb language plpgsql security definer set search_path=pg_catalog as $safe$
begin
 if p is null or length(p)>11184812 or p !~ '^[A-Za-z0-9+/]*={0,2}$' then raise exception 'n88_fixed_failure';end if;
 declare a jsonb;v jsonb;begin
 a:=convert_from(decode(p,'base64'),'UTF8')::jsonb;
 if jsonb_typeof(a)<>'array' or jsonb_array_length(a)<>1 or exists(select 1 from jsonb_array_elements(a) x where jsonb_typeof(x) not in ('string','number','boolean')) then raise exception 'n88_fixed_failure';end if;
 select jsonb_build_object('command','SELECT','rowCount',count(*)::integer,'rows',coalesce(jsonb_agg(jsonb_build_object('namespace',r.namespace,'owner_id',r.owner_id,'active',r.active)),'[]'::jsonb)) into v from n88_private.v2_f8a1689cd78951d7fc52ef91((a->>0)::uuid) r;
 return jsonb_build_object('ok',true,'result',v);
 end;
 exception when query_canceled then return '{"ok":false,"failure":"cancelled"}'::jsonb;
 when assert_failure then return '{"ok":false,"failure":"assertion"}'::jsonb;
 when others then return '{"ok":false,"failure":"unavailable"}'::jsonb;
end
$safe$;
revoke all on function n88_private.safe_1031_f8a1689cd78951d7fc52ef91(text) from public,anon,authenticated;
grant execute on function n88_private.safe_1031_f8a1689cd78951d7fc52ef91(text) to n88_backend;
create function n88_private.safe_1031_7874a827dae2373223bc8adc(p text) returns jsonb language plpgsql security definer set search_path=pg_catalog as $safe$
begin
 if p is null or length(p)>11184812 or p !~ '^[A-Za-z0-9+/]*={0,2}$' then raise exception 'n88_fixed_failure';end if;
 declare a jsonb;v jsonb;begin
 a:=convert_from(decode(p,'base64'),'UTF8')::jsonb;
 if jsonb_typeof(a)<>'array' or jsonb_array_length(a)<>1 or exists(select 1 from jsonb_array_elements(a) x where jsonb_typeof(x) not in ('string','number','boolean')) then raise exception 'n88_fixed_failure';end if;
 select jsonb_build_object('command','SELECT','rowCount',count(*)::integer,'rows',coalesce(jsonb_agg(jsonb_build_object('payload',r.payload)),'[]'::jsonb)) into v from n88_private.v2_7874a827dae2373223bc8adc((a->>0)::text) r;
 return jsonb_build_object('ok',true,'result',v);
 end;
 exception when query_canceled then return '{"ok":false,"failure":"cancelled"}'::jsonb;
 when assert_failure then return '{"ok":false,"failure":"assertion"}'::jsonb;
 when others then return '{"ok":false,"failure":"unavailable"}'::jsonb;
end
$safe$;
revoke all on function n88_private.safe_1031_7874a827dae2373223bc8adc(text) from public,anon,authenticated;
grant execute on function n88_private.safe_1031_7874a827dae2373223bc8adc(text) to n88_backend;
create function n88_private.safe_1031_6d27c8049efec0665b9d1f91(p text) returns jsonb language plpgsql security definer set search_path=pg_catalog as $safe$
begin
 if p is null or length(p)>11184812 or p !~ '^[A-Za-z0-9+/]*={0,2}$' then raise exception 'n88_fixed_failure';end if;
 declare a jsonb;v jsonb;begin
 a:=convert_from(decode(p,'base64'),'UTF8')::jsonb;
 if jsonb_typeof(a)<>'array' or jsonb_array_length(a)<>4 or exists(select 1 from jsonb_array_elements(a) x where jsonb_typeof(x) not in ('string','number','boolean')) then raise exception 'n88_fixed_failure';end if;
 select jsonb_build_object('command','SELECT','rowCount',count(*)::integer,'rows',coalesce(jsonb_agg(jsonb_build_object('payload',r.payload)),'[]'::jsonb)) into v from n88_private.v2_6d27c8049efec0665b9d1f91((a->>0)::uuid,(a->>1)::uuid,(a->>2)::text,(a->>3)::text) r;
 return jsonb_build_object('ok',true,'result',v);
 end;
 exception when query_canceled then return '{"ok":false,"failure":"cancelled"}'::jsonb;
 when assert_failure then return '{"ok":false,"failure":"assertion"}'::jsonb;
 when others then return '{"ok":false,"failure":"unavailable"}'::jsonb;
end
$safe$;
revoke all on function n88_private.safe_1031_6d27c8049efec0665b9d1f91(text) from public,anon,authenticated;
grant execute on function n88_private.safe_1031_6d27c8049efec0665b9d1f91(text) to n88_backend;
create function n88_private.safe_1031_e1b1c0927f6164faeccb760b(p text) returns jsonb language plpgsql security definer set search_path=pg_catalog as $safe$
begin
 if p is null or length(p)>11184812 or p !~ '^[A-Za-z0-9+/]*={0,2}$' then raise exception 'n88_fixed_failure';end if;
 declare a jsonb;v jsonb;begin
 a:=convert_from(decode(p,'base64'),'UTF8')::jsonb;
 if jsonb_typeof(a)<>'array' or jsonb_array_length(a)<>4 or exists(select 1 from jsonb_array_elements(a) x where jsonb_typeof(x) not in ('string','number','boolean')) then raise exception 'n88_fixed_failure';end if;
 select jsonb_build_object('command','SELECT','rowCount',count(*)::integer,'rows',coalesce(jsonb_agg(jsonb_build_object('body',r.body)),'[]'::jsonb)) into v from n88_private.v2_e1b1c0927f6164faeccb760b((a->>0)::uuid,(a->>1)::integer,(a->>2)::integer,(a->>3)::integer) r;
 return jsonb_build_object('ok',true,'result',v);
 end;
 exception when query_canceled then return '{"ok":false,"failure":"cancelled"}'::jsonb;
 when assert_failure then return '{"ok":false,"failure":"assertion"}'::jsonb;
 when others then return '{"ok":false,"failure":"unavailable"}'::jsonb;
end
$safe$;
revoke all on function n88_private.safe_1031_e1b1c0927f6164faeccb760b(text) from public,anon,authenticated;
grant execute on function n88_private.safe_1031_e1b1c0927f6164faeccb760b(text) to n88_backend;
create function n88_private.safe_1031_f46afed1e023d013cdabf257(p text) returns jsonb language plpgsql security definer set search_path=pg_catalog as $safe$
begin
 if p is null or length(p)>11184812 or p !~ '^[A-Za-z0-9+/]*={0,2}$' then raise exception 'n88_fixed_failure';end if;
 declare a jsonb;v jsonb;begin
 a:=convert_from(decode(p,'base64'),'UTF8')::jsonb;
 if jsonb_typeof(a)<>'array' or jsonb_array_length(a)<>4 or exists(select 1 from jsonb_array_elements(a) x where jsonb_typeof(x) not in ('string','number','boolean')) then raise exception 'n88_fixed_failure';end if;
 select jsonb_build_object('command','SELECT','rowCount',count(*)::integer,'rows',coalesce(jsonb_agg(jsonb_build_object('body',r.body)),'[]'::jsonb)) into v from n88_private.v2_f46afed1e023d013cdabf257((a->>0)::uuid,(a->>1)::integer,(a->>2)::integer,(a->>3)::integer) r;
 return jsonb_build_object('ok',true,'result',v);
 end;
 exception when query_canceled then return '{"ok":false,"failure":"cancelled"}'::jsonb;
 when assert_failure then return '{"ok":false,"failure":"assertion"}'::jsonb;
 when others then return '{"ok":false,"failure":"unavailable"}'::jsonb;
end
$safe$;
revoke all on function n88_private.safe_1031_f46afed1e023d013cdabf257(text) from public,anon,authenticated;
grant execute on function n88_private.safe_1031_f46afed1e023d013cdabf257(text) to n88_backend;
create function n88_private.safe_1031_0dad27a56bfdc5bfab552235(p text) returns jsonb language plpgsql security definer set search_path=pg_catalog as $safe$
begin
 if p is null or length(p)>11184812 or p !~ '^[A-Za-z0-9+/]*={0,2}$' then raise exception 'n88_fixed_failure';end if;
 declare a jsonb;v jsonb;begin
 a:=convert_from(decode(p,'base64'),'UTF8')::jsonb;
 if jsonb_typeof(a)<>'array' or jsonb_array_length(a)<>4 or exists(select 1 from jsonb_array_elements(a) x where jsonb_typeof(x) not in ('string','number','boolean')) then raise exception 'n88_fixed_failure';end if;
 select jsonb_build_object('command','SELECT','rowCount',count(*)::integer,'rows',coalesce(jsonb_agg(jsonb_build_object('body',r.body)),'[]'::jsonb)) into v from n88_private.v2_0dad27a56bfdc5bfab552235((a->>0)::uuid,(a->>1)::integer,(a->>2)::integer,(a->>3)::integer) r;
 return jsonb_build_object('ok',true,'result',v);
 end;
 exception when query_canceled then return '{"ok":false,"failure":"cancelled"}'::jsonb;
 when assert_failure then return '{"ok":false,"failure":"assertion"}'::jsonb;
 when others then return '{"ok":false,"failure":"unavailable"}'::jsonb;
end
$safe$;
revoke all on function n88_private.safe_1031_0dad27a56bfdc5bfab552235(text) from public,anon,authenticated;
grant execute on function n88_private.safe_1031_0dad27a56bfdc5bfab552235(text) to n88_backend;
create function n88_private.safe_1031_71a3e914da47cf1053850671(p text) returns jsonb language plpgsql security definer set search_path=pg_catalog as $safe$
begin
 if p is null or length(p)>11184812 or p !~ '^[A-Za-z0-9+/]*={0,2}$' then raise exception 'n88_fixed_failure';end if;
 declare a jsonb;v jsonb;begin
 a:=convert_from(decode(p,'base64'),'UTF8')::jsonb;
 if jsonb_typeof(a)<>'array' or jsonb_array_length(a)<>4 or exists(select 1 from jsonb_array_elements(a) x where jsonb_typeof(x) not in ('string','number','boolean')) then raise exception 'n88_fixed_failure';end if;
 select jsonb_build_object('command','SELECT','rowCount',count(*)::integer,'rows',coalesce(jsonb_agg(jsonb_build_object('body',r.body)),'[]'::jsonb)) into v from n88_private.v2_71a3e914da47cf1053850671((a->>0)::uuid,(a->>1)::integer,(a->>2)::integer,(a->>3)::integer) r;
 return jsonb_build_object('ok',true,'result',v);
 end;
 exception when query_canceled then return '{"ok":false,"failure":"cancelled"}'::jsonb;
 when assert_failure then return '{"ok":false,"failure":"assertion"}'::jsonb;
 when others then return '{"ok":false,"failure":"unavailable"}'::jsonb;
end
$safe$;
revoke all on function n88_private.safe_1031_71a3e914da47cf1053850671(text) from public,anon,authenticated;
grant execute on function n88_private.safe_1031_71a3e914da47cf1053850671(text) to n88_backend;
create function n88_private.safe_1031_74c4aa4d430911e99002af80(p text) returns jsonb language plpgsql security definer set search_path=pg_catalog as $safe$
begin
 if p is null or length(p)>11184812 or p !~ '^[A-Za-z0-9+/]*={0,2}$' then raise exception 'n88_fixed_failure';end if;
 declare a jsonb;v jsonb;begin
 a:=convert_from(decode(p,'base64'),'UTF8')::jsonb;
 if jsonb_typeof(a)<>'array' or jsonb_array_length(a)<>3 or exists(select 1 from jsonb_array_elements(a) x where jsonb_typeof(x) not in ('string','number','boolean')) then raise exception 'n88_fixed_failure';end if;
 select jsonb_build_object('command','INSERT','rowCount',coalesce(max(affected),0)::integer,'rows','[]'::jsonb) into v from n88_private.v2_74c4aa4d430911e99002af80((a->>0)::uuid,(a->>1)::text,(a->>2)::text) r;
 return jsonb_build_object('ok',true,'result',v);
 end;
 exception when query_canceled then return '{"ok":false,"failure":"cancelled"}'::jsonb;
 when assert_failure then return '{"ok":false,"failure":"assertion"}'::jsonb;
 when others then return '{"ok":false,"failure":"unavailable"}'::jsonb;
end
$safe$;
revoke all on function n88_private.safe_1031_74c4aa4d430911e99002af80(text) from public,anon,authenticated;
grant execute on function n88_private.safe_1031_74c4aa4d430911e99002af80(text) to n88_backend;
create function n88_private.safe_1031_dbe074dae923ca8a3746d390(p text) returns jsonb language plpgsql security definer set search_path=pg_catalog as $safe$
begin
 if p is null or length(p)>11184812 or p !~ '^[A-Za-z0-9+/]*={0,2}$' then raise exception 'n88_fixed_failure';end if;
 declare a jsonb;v jsonb;begin
 a:=convert_from(decode(p,'base64'),'UTF8')::jsonb;
 if jsonb_typeof(a)<>'array' or jsonb_array_length(a)<>4 or exists(select 1 from jsonb_array_elements(a) x where jsonb_typeof(x) not in ('string','number','boolean')) then raise exception 'n88_fixed_failure';end if;
 select jsonb_build_object('command','UPDATE','rowCount',coalesce(max(affected),0)::integer,'rows','[]'::jsonb) into v from n88_private.v2_dbe074dae923ca8a3746d390((a->>0)::uuid,(a->>1)::text,(a->>2)::text,(a->>3)::text) r;
 return jsonb_build_object('ok',true,'result',v);
 end;
 exception when query_canceled then return '{"ok":false,"failure":"cancelled"}'::jsonb;
 when assert_failure then return '{"ok":false,"failure":"assertion"}'::jsonb;
 when others then return '{"ok":false,"failure":"unavailable"}'::jsonb;
end
$safe$;
revoke all on function n88_private.safe_1031_dbe074dae923ca8a3746d390(text) from public,anon,authenticated;
grant execute on function n88_private.safe_1031_dbe074dae923ca8a3746d390(text) to n88_backend;
create function n88_private.safe_1031_a3e6d95cdff2d66f56ae84f6(p text) returns jsonb language plpgsql security definer set search_path=pg_catalog as $safe$
begin
 if p is null or length(p)>11184812 or p !~ '^[A-Za-z0-9+/]*={0,2}$' then raise exception 'n88_fixed_failure';end if;
 declare a jsonb;v jsonb;begin
 a:=convert_from(decode(p,'base64'),'UTF8')::jsonb;
 if jsonb_typeof(a)<>'array' or jsonb_array_length(a)<>6 or exists(select 1 from jsonb_array_elements(a) x where jsonb_typeof(x) not in ('string','number','boolean')) then raise exception 'n88_fixed_failure';end if;
 select jsonb_build_object('command','INSERT','rowCount',coalesce(max(affected),0)::integer,'rows','[]'::jsonb) into v from n88_private.v2_a3e6d95cdff2d66f56ae84f6((a->>0)::uuid,(a->>1)::text,(a->>2)::text,(a->>3)::text,(a->>4)::boolean,(a->>5)::text) r;
 return jsonb_build_object('ok',true,'result',v);
 end;
 exception when query_canceled then return '{"ok":false,"failure":"cancelled"}'::jsonb;
 when assert_failure then return '{"ok":false,"failure":"assertion"}'::jsonb;
 when others then return '{"ok":false,"failure":"unavailable"}'::jsonb;
end
$safe$;
revoke all on function n88_private.safe_1031_a3e6d95cdff2d66f56ae84f6(text) from public,anon,authenticated;
grant execute on function n88_private.safe_1031_a3e6d95cdff2d66f56ae84f6(text) to n88_backend;
create function n88_private.safe_1031_5d62e77b02ab6a1fb4e97688(p text) returns jsonb language plpgsql security definer set search_path=pg_catalog as $safe$
begin
 if p is null or length(p)>11184812 or p !~ '^[A-Za-z0-9+/]*={0,2}$' then raise exception 'n88_fixed_failure';end if;
 declare a jsonb;v jsonb;begin
 a:=convert_from(decode(p,'base64'),'UTF8')::jsonb;
 if jsonb_typeof(a)<>'array' or jsonb_array_length(a)<>8 or exists(select 1 from jsonb_array_elements(a) x where jsonb_typeof(x) not in ('string','number','boolean')) then raise exception 'n88_fixed_failure';end if;
 select jsonb_build_object('command','UPDATE','rowCount',coalesce(max(affected),0)::integer,'rows','[]'::jsonb) into v from n88_private.v2_5d62e77b02ab6a1fb4e97688((a->>0)::uuid,(a->>1)::text,(a->>2)::text,(a->>3)::text,(a->>4)::boolean,(a->>5)::text,(a->>6)::text,(a->>7)::text) r;
 return jsonb_build_object('ok',true,'result',v);
 end;
 exception when query_canceled then return '{"ok":false,"failure":"cancelled"}'::jsonb;
 when assert_failure then return '{"ok":false,"failure":"assertion"}'::jsonb;
 when others then return '{"ok":false,"failure":"unavailable"}'::jsonb;
end
$safe$;
revoke all on function n88_private.safe_1031_5d62e77b02ab6a1fb4e97688(text) from public,anon,authenticated;
grant execute on function n88_private.safe_1031_5d62e77b02ab6a1fb4e97688(text) to n88_backend;
create function n88_private.safe_1031_23ccfc1e16cd0b122d0cb3c3(p text) returns jsonb language plpgsql security definer set search_path=pg_catalog as $safe$
begin
 if p is null or length(p)>11184812 or p !~ '^[A-Za-z0-9+/]*={0,2}$' then raise exception 'n88_fixed_failure';end if;
 declare a jsonb;v jsonb;begin
 a:=convert_from(decode(p,'base64'),'UTF8')::jsonb;
 if jsonb_typeof(a)<>'array' or jsonb_array_length(a)<>5 or exists(select 1 from jsonb_array_elements(a) x where jsonb_typeof(x) not in ('string','number','boolean')) then raise exception 'n88_fixed_failure';end if;
 select jsonb_build_object('command','INSERT','rowCount',coalesce(max(affected),0)::integer,'rows','[]'::jsonb) into v from n88_private.v2_23ccfc1e16cd0b122d0cb3c3((a->>0)::uuid,(a->>1)::text,(a->>2)::text,(a->>3)::text,(a->>4)::boolean) r;
 return jsonb_build_object('ok',true,'result',v);
 end;
 exception when query_canceled then return '{"ok":false,"failure":"cancelled"}'::jsonb;
 when assert_failure then return '{"ok":false,"failure":"assertion"}'::jsonb;
 when others then return '{"ok":false,"failure":"unavailable"}'::jsonb;
end
$safe$;
revoke all on function n88_private.safe_1031_23ccfc1e16cd0b122d0cb3c3(text) from public,anon,authenticated;
grant execute on function n88_private.safe_1031_23ccfc1e16cd0b122d0cb3c3(text) to n88_backend;
create function n88_private.safe_1031_94bb23dac56c2e002713130a(p text) returns jsonb language plpgsql security definer set search_path=pg_catalog as $safe$
begin
 if p is null or length(p)>11184812 or p !~ '^[A-Za-z0-9+/]*={0,2}$' then raise exception 'n88_fixed_failure';end if;
 declare a jsonb;v jsonb;begin
 a:=convert_from(decode(p,'base64'),'UTF8')::jsonb;
 if jsonb_typeof(a)<>'array' or jsonb_array_length(a)<>7 or exists(select 1 from jsonb_array_elements(a) x where jsonb_typeof(x) not in ('string','number','boolean')) then raise exception 'n88_fixed_failure';end if;
 select jsonb_build_object('command','UPDATE','rowCount',coalesce(max(affected),0)::integer,'rows','[]'::jsonb) into v from n88_private.v2_94bb23dac56c2e002713130a((a->>0)::uuid,(a->>1)::text,(a->>2)::text,(a->>3)::text,(a->>4)::boolean,(a->>5)::text,(a->>6)::boolean) r;
 return jsonb_build_object('ok',true,'result',v);
 end;
 exception when query_canceled then return '{"ok":false,"failure":"cancelled"}'::jsonb;
 when assert_failure then return '{"ok":false,"failure":"assertion"}'::jsonb;
 when others then return '{"ok":false,"failure":"unavailable"}'::jsonb;
end
$safe$;
revoke all on function n88_private.safe_1031_94bb23dac56c2e002713130a(text) from public,anon,authenticated;
grant execute on function n88_private.safe_1031_94bb23dac56c2e002713130a(text) to n88_backend;
create function n88_private.safe_1031_3b143936c792a16ff5425c3d(p text) returns jsonb language plpgsql security definer set search_path=pg_catalog as $safe$
begin
 if p is null or length(p)>11184812 or p !~ '^[A-Za-z0-9+/]*={0,2}$' then raise exception 'n88_fixed_failure';end if;
 declare a jsonb;v jsonb;begin
 a:=convert_from(decode(p,'base64'),'UTF8')::jsonb;
 if jsonb_typeof(a)<>'array' or jsonb_array_length(a)<>5 or exists(select 1 from jsonb_array_elements(a) x where jsonb_typeof(x) not in ('string','number','boolean')) then raise exception 'n88_fixed_failure';end if;
 select jsonb_build_object('command','INSERT','rowCount',coalesce(max(affected),0)::integer,'rows','[]'::jsonb) into v from n88_private.v2_3b143936c792a16ff5425c3d((a->>0)::uuid,(a->>1)::text,(a->>2)::text,(a->>3)::text,(a->>4)::text) r;
 return jsonb_build_object('ok',true,'result',v);
 end;
 exception when query_canceled then return '{"ok":false,"failure":"cancelled"}'::jsonb;
 when assert_failure then return '{"ok":false,"failure":"assertion"}'::jsonb;
 when others then return '{"ok":false,"failure":"unavailable"}'::jsonb;
end
$safe$;
revoke all on function n88_private.safe_1031_3b143936c792a16ff5425c3d(text) from public,anon,authenticated;
grant execute on function n88_private.safe_1031_3b143936c792a16ff5425c3d(text) to n88_backend;
