import typedReads from './read-service-20261023/typed-read-operations.json' with {type:'json'};
import typedIdentities from './read-service-20261023/typed-identities.json' with {type:'json'};
import metadataAuthority from './v2-external-plan-1028/read-authority.json' with {type:'json'};
/** AI-authored. Finite trusted operations, native typed results, bound ASCII wire.
 * No caller-supplied SQL reaches PostgreSQL; no JSON result conversion is added.
 */
import {Buffer} from 'node:buffer';
import {createHash} from 'node:crypto';
import contract from './error-boundary-contract.json' with {type:'json'};
import identities from './error-boundary-identities.json' with {type:'json'};
const fail=()=>{throw Error('n88_database_unavailable');};
const verified=new WeakMap();
const guidanceVerified=new WeakSet();
const guidanceOperations=new Map((contract.guidanceClosure?.operations??[]).map(o=>[o.sql,o]));
const operations=new Map(contract.operations.map(o=>[o.sql,o]));
const controls=new Set(contract.controls);
const typedOperations=new Map([...contract.operations,...typedReads].map(o=>[o.sql,o]));
// Named PO-approved metadata addition ONLY. The original statement/identity maps,
// controls, wrapper calls and all unrelated denials below remain unchanged.
const metadataOperations=new Map(metadataAuthority.operations.map(o=>[o.sql,o]));
const metadataReaders=new WeakMap(),metadataSpent=new WeakSet();
const metadataKeys=[
 ['database_name','database_oid','current_role','session_role','server_address','server_port','server_version_num','system_identifier'],
 ['rolname','rolsuper','rolbypassrls','rolinherit','rolcanlogin','rolcreatedb','rolcreaterole','memberships'],
 ['nspname','relname','relkind','owner','relrowsecurity','relforcerowsecurity','acl'],
 ['nspname','relname','columns','constraints','policies'],
 ['nspname','proname','arguments','definition','definer','owner','proconfig','acl'],
 ['nspname','relname','name','kind','definition','enabled'],
 ['nspname','relname','rolname','table_select','column_select','insert','update','column_update','delete','truncate'],
 ['nspname','owner','acl','anon_usage','authenticated_usage','configured_api_schemas'],['sha256'],
];
export function authorizeMetadataPreflight(client,context,{durationMs=metadataAuthority.maxDurationMs}={}) {
 if(!verified.has(client)||metadataSpent.has(client)||metadataOperations.size!==9||metadataAuthority.approved!==true||metadataAuthority.installationAuthorized!==false||
   context?.authorityRef!==metadataAuthority.authorityRef||context.evidenceSha256!==metadataAuthority.evidenceSha256||
   context.projectRef!==metadataAuthority.projectRef||context.providerEvidenceSha256!==metadataAuthority.providerEvidenceSha256||
   !Number.isSafeInteger(durationMs)||durationMs<1||durationMs>120000||Date.now()>=Date.parse(metadataAuthority.phaseDeadline))fail();
 for(const op of metadataAuthority.operations)if(createHash('sha256').update(op.sql).digest('hex')!==op.sha256||!op.sql.startsWith('select '))fail();
 metadataSpent.add(client);metadataReaders.set(client,{position:0,deadline:Math.min(Date.now()+durationMs,Date.parse(metadataAuthority.phaseDeadline))});
 return Object.freeze({authorityRef:context.authorityRef,projectRef:context.projectRef,statements:9});
}
export function closeMetadataPreflight(client){metadataReaders.delete(client);}
async function metadataRead(client,sql,values){
 const scope=metadataReaders.get(client),op=metadataOperations.get(sql);
 try{
  if(!scope||Date.now()>=scope.deadline||values.length!==0||metadataAuthority.operations[scope.position]?.sql!==sql)fail();
  const keys=metadataKeys[scope.position++]; // consume BEFORE dispatch; no repeat after lost result
  const r=await client.query(sql,[]);
  if(metadataReaders.get(client)!==scope||Date.now()>=scope.deadline||!r||r.command!=='SELECT'||!Array.isArray(r.rows)||r.rows.length>op.maxRows||r.rowCount!==r.rows.length||
    Buffer.byteLength(JSON.stringify(r.rows))>op.maxBytes||r.rows.some(row=>!row||Object.getPrototypeOf(row)!==Object.prototype||Object.keys(row).length!==keys.length||keys.some(k=>!Object.hasOwn(row,k))))fail();
  if(scope.position===9)metadataReaders.delete(client);
  return r;
 }catch(e){metadataReaders.delete(client);const error=Error('n88_database_unavailable');
  error.metadataDenial={queryId:op.id,sqlSha256:op.sha256,code:/^[A-Z0-9]{5}$/.test(e.code??'')?e.code:null,
    custodianError:typeof e.custodianError==='string'?e.custodianError.slice(0,512):null};throw error;}
}
export const boundaryCatalogSql=`select p.proname as name,encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex') as definition,
    pg_get_function_identity_arguments(p.oid) as arguments,p.prosecdef as definer,
    r.rolname as owner,p.proconfig as config,
    (select array_agg(coalesce(gr.rolname,'PUBLIC')||':'||a.privilege_type order by coalesce(gr.rolname,'PUBLIC'),a.privilege_type)
      from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a left join pg_roles gr on gr.oid=a.grantee) as acl
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_roles r on r.oid=p.proowner
    where n.nspname='n88_private' and p.proname like 'boundary_%' order by p.proname`;
export async function assertVerifiedBoundary(client) {
  verified.delete(client);
  guidanceVerified.delete(client);
  const r=await client.query(boundaryCatalogSql);
  if(identities.length!==76||operations.size!==76||typedIdentities.length!==78||typedOperations.size!==78)fail();
  const extension=contract.guidanceClosure;
  const extensionNames=new Set((extension?.identities??[]).map(r=>r.name));
  const extra=r.rows.filter(r=>extensionNames.has(r.name));
  if(extra.length) {
    if(extension?.sourceOnly!==true||extension.version!==1||guidanceOperations.size!==1||extra.length!==2||JSON.stringify(extra)!==JSON.stringify(extension.identities))fail();
    guidanceVerified.add(client);
  }
  const rows=JSON.stringify(r.rows.filter(r=>!extensionNames.has(r.name)));
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
  if(!verified.has(client) || !Array.isArray(values)){if(metadataSpent.has(client))metadataReaders.delete(client);fail();}
  if(metadataOperations.has(sql))return metadataRead(client,sql,values);
  // Opting an exclusive client into the NEW read phase never grants the legacy
  // mutation/control operations. Ordinary legacy clients retain their old path.
  if(metadataSpent.has(client)){metadataReaders.delete(client);fail();}
  if(controls.has(sql)) {
    if(sql.startsWith('select set_config')) {
      if(values.length!==3 || values.some(v=>typeof v!=='string'||!/^\d{1,5}$/.test(v)||Number(v)<1||Number(v)>60000))fail();
    } else if(values.length)fail();
    return client.query(sql,values);
  }
  const op=(verifiedBoundaryMode(client)==='batch'?typedOperations:operations).get(sql)??(guidanceVerified.has(client)?guidanceOperations.get(sql):undefined);
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
