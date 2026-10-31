/** AI: offline exact versioned boundary generator; never executes SQL. */
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const dir=new URL('./',import.meta.url), sha=s=>createHash('sha256').update(s).digest('hex');
const packet=JSON.parse(await readFile(new URL('../v2-package-1028/boundary-operations.json',import.meta.url),'utf8'));
const definitions=packet.operations.map(o=>{
 const name='safe_1031_'+o.name.slice(3), args=o.types.map((t,i)=>`(a->>${i})::${t}`).join(',');
 const row=`jsonb_build_object(${o.output.map(f=>{const name=f.split(':')[0];return "'"+name+"',r."+name;}).join(',')})`;
 const result=o.effect?`jsonb_build_object('command','${o.command}','rowCount',coalesce(max(affected),0)::integer,'rows','[]'::jsonb)`:
 `jsonb_build_object('command','SELECT','rowCount',count(*)::integer,'rows',coalesce(jsonb_agg(${row}),'[]'::jsonb))`;
 const body=`
begin
 if p is null or length(p)>11184812 or p !~ '^[A-Za-z0-9+/]*={0,2}$' then raise exception 'n88_fixed_failure';end if;
 declare a jsonb;v jsonb;begin
 a:=convert_from(decode(p,'base64'),'UTF8')::jsonb;
 if jsonb_typeof(a)<>'array' or jsonb_array_length(a)<>${o.types.length} or exists(select 1 from jsonb_array_elements(a) x where jsonb_typeof(x) not in ('string','number','boolean')) then raise exception 'n88_fixed_failure';end if;
 select ${result} into v from n88_private.${o.name}(${args}) r;
 return jsonb_build_object('ok',true,'result',v);
 end;
 exception when query_canceled then return '{"ok":false,"failure":"cancelled"}'::jsonb;
 when assert_failure then return '{"ok":false,"failure":"assertion"}'::jsonb;
 when others then return '{"ok":false,"failure":"unavailable"}'::jsonb;
end
`;
 return {...o,safeName:name,safeSql:`select n88_private.${name}($1::text) as envelope`,body,bodySha256:sha(body)};
});
await writeFile(new URL('operations.json',dir),JSON.stringify({version:1,definitions},null,2)+'\n');
let sql='-- AI: versioned fixed14 wrappers. Decoding/casts and original execution are INSIDE protected blocks.\n';
for(const o of definitions)sql+=`create function n88_private.${o.safeName}(p text) returns jsonb language plpgsql security definer set search_path=pg_catalog as $safe$${o.body}$safe$;
revoke all on function n88_private.${o.safeName}(text) from public,anon,authenticated;
grant execute on function n88_private.${o.safeName}(text) to n88_backend;
`;
await writeFile(new URL('safe-boundary.sql',dir),sql);
