import typedReads from './typed-read-operations.json' with {type:'json'};
import typedIdentities from './typed-identities.json' with {type:'json'};
/** AI-authored. Finite trusted operations, native typed results, bound ASCII wire.
 * No caller-supplied SQL reaches PostgreSQL; no JSON result conversion is added.
 */
import {Buffer} from 'node:buffer';
import contract from './error-boundary-contract.json' with {type:'json'};
import identities from './error-boundary-identities.json' with {type:'json'};
const fail=()=>{throw Error('n88_database_unavailable');};
const verified=new WeakMap();
const operations=new Map(contract.operations.map(o=>[o.sql,o]));
const controls=new Set(contract.controls);
const typedOperations=new Map([...contract.operations,...typedReads].map(o=>[o.sql,o]));
export const boundaryCatalogSql=`select p.proname as name,encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex') as definition,
    pg_get_function_identity_arguments(p.oid) as arguments,p.prosecdef as definer,
    r.rolname as owner,p.proconfig as config,
    (select array_agg(coalesce(gr.rolname,'PUBLIC')||':'||a.privilege_type order by coalesce(gr.rolname,'PUBLIC'),a.privilege_type)
      from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a left join pg_roles gr on gr.oid=a.grantee) as acl
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_roles r on r.oid=p.proowner
    where n.nspname='n88_private' and p.proname like 'boundary_%' order by p.proname`;
export async function assertVerifiedBoundary(client) {
  verified.delete(client);
  const r=await client.query(boundaryCatalogSql);
  if(identities.length!==76||operations.size!==76||typedIdentities.length!==78||typedOperations.size!==78)fail();
  const rows=JSON.stringify(r.rows);
  if(rows===JSON.stringify(identities))verified.set(client,'serial');
  else if(rows===JSON.stringify(typedIdentities))verified.set(client,'batch');
  else fail();
}
export function verifiedBoundaryMode(client){const mode=verified.get(client);if(!mode)fail();return mode;}
function pgText(value) {
  if(value===null)return null;
  if(typeof value==='string' || typeof value==='bigint' || typeof value==='boolean')return String(value);
  if(typeof value==='number' && Number.isFinite(value))return String(value);
  if(Buffer.isBuffer(value))return '\\x'+value.toString('hex');
  if(value instanceof Date && Number.isFinite(value.getTime()))return value.toISOString();
  if(Array.isArray(value))return '{'+value.map(v=>v===null?'NULL':Array.isArray(v)?pgText(v):'"'+pgText(v).replaceAll('\\','\\\\').replaceAll('"','\\"')+'"').join(',')+'}';
  fail();
}
export async function privateQuery(client,sql,values=[]) {
  if(!verified.has(client) || !Array.isArray(values))fail();
  if(controls.has(sql)) {
    if(sql.startsWith('select set_config')) {
      if(values.length!==3 || values.some(v=>typeof v!=='string'||!/^\d{1,5}$/.test(v)||Number(v)<1||Number(v)>60000))fail();
    } else if(values.length)fail();
    return client.query(sql,values);
  }
  const op=(verifiedBoundaryMode(client)==='batch'?typedOperations:operations).get(sql);
  if(!op || values.length!==op.parameters.length)fail();
  const wire=values.map(encodeBoundaryParameter);
  const result=await client.query(`select * from n88_private.${op.name}(${wire.map((_,i)=>'$'+(i+1)+'::text').join(',')})`,wire);
  if(op.effect) {
    const count=result.rows?.[0]?.affected;
    if(result.rows?.length!==1 || !/^\d+$/.test(count) || !Number.isSafeInteger(Number(count)))fail();
    return {...result,command:op.command,rowCount:Number(count),rows:[]};
  }
  if(op.voidResult)return {...result,rows:result.rows.map(()=>({[op.output[0].name]:''}))};
  return result;
}
export const encodeBoundaryParameter=value=>value===null?null:Buffer.from(pgText(value),'utf8').toString('base64');
