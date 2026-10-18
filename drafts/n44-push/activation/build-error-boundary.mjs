/** AI-authored. Local-only compiler for a finite, source-derived SQL contract.
 * PREPARE/Describe infer native PG types without executing a private operation.
 * Never run this compiler against a hosted database. No dynamic SQL in routines.
 */
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
const base='drafts/n44-push/';
export const migrationPath='supabase/migrations/20261018191000_n44_private_error_boundary_staged.sql';
const hash=s=>createHash('sha256').update(s).digest('hex');
export async function sourceQueries(root) {
 const files=['postgres-repository.mjs','backend.mjs','auth-verifier.mjs','canonical-source.mjs'];
 const sources=[],queries=new Set(),controls=new Set(['begin','rollback','commit','savepoint n44_owner','release savepoint n44_owner','rollback to savepoint n44_owner']);
 for(const file of files){
  const source=(await readFile(root+'/'+base+file,'utf8')).replaceAll('\r\n','\n');sources.push({file:base+file,sha256:hash(source)});
  if(file==='postgres-repository.mjs'){
   const segment=source.slice(source.indexOf('const columns ='),source.indexOf('function preferences'));
   const generated=vm.runInNewContext(segment+';queries');
   for(const sql of Object.values(generated).flatMap(Object.values))queries.add(sql);
  }
  for(const match of source.matchAll(/\b(?:query|q)\(\s*(`[^`]*`|'[^']*'|"[^"]*")/g)){
   const literal=match[1];if(literal.includes('$'+'{'))continue;
   const sql=vm.runInNewContext(literal);
   if(/^(savepoint |release savepoint |rollback to savepoint |begin|commit$|rollback$|set local )/.test(sql))controls.add(sql);else queries.add(sql);
  }
 }
 return {queries:[...queries].sort(),controls:[...controls].sort(),sources};
}
// pg's Parse/Describe path: no Bind/Execute and therefore no private read/write.
function describe(query,sql) {
  return new Promise((resolve,reject)=>{
    let fields=[],types=[],connection;
    const parameters=m=>{types=m.dataTypeIDs;};
    query({callback(e,result){e?reject(e):resolve(result);},submit(c){connection=c;c.on('parameterDescription',parameters);c.parse({text:sql,name:''});c.describe({type:'S',name:''});c.sync();},
      handleRowDescription(m){fields=m.fields;},handleReadyForQuery(){connection.removeListener('parameterDescription',parameters);this.callback(null,{fields,types});},
      handleError(e){connection?.removeListener('parameterDescription',parameters);this.callback(e);}});
  });
}
const qi=s=>'"'+s.replaceAll('"','""')+'"';
export async function compileBoundary(root,query) {
  const inventory=await sourceQueries(root),ops=[];let ddl=`-- AI-authored. Append-only N44 private typed error boundary. Original activation migration unchanged.
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
`;
  for(const sql of inventory.queries) {
    const d=await describe(query,sql);
    const oids=[...new Set([...d.types,...d.fields.map(f=>f.dataTypeID)])];
    const typeRows=(await query('select oid,format_type(oid,null) as name from pg_type where oid=any($1::oid[])',[oids])).rows;
    const types=new Map(typeRows.map(r=>[Number(r.oid),r.name]));
    const name='boundary_'+hash(sql).slice(0,24),args=d.types.map((_,i)=>`p${i+1} text`).join(','),signature=d.types.map(()=>'text').join(',');
    const output=d.fields.map(f=>({name:f.name,type:types.get(f.dataTypeID),oid:f.dataTypeID}));
    const effect=!output.length;
    const voidResult=output.length===1&&output[0].type==='void';
    const returns=effect?'table(affected bigint)':voidResult?'void':`table(${output.map(f=>qi(f.name)+' '+f.type).join(',')})`;
    const body=sql.replace(/\$(\d+)/g,(_,n)=>'v'+n);
    const locals=d.types.map((oid,i)=>`v${i+1} ${types.get(oid)};`).join('\n');
    // All casts INCLUDING uuid/json/array/text decoding happen inside EXCEPTION.
    const assignments=d.types.map((oid,i)=>`v${i+1}:=convert_from(decode(p${i+1},'base64'),'UTF8')::${types.get(oid)};`).join('\n');
    const action=effect?`${body};\nget diagnostics affected=row_count;\nreturn next;`:voidResult?`perform ${body.replace(/^select /,'')};\nreturn;`:`return query ${body};`;
    ddl+=`create function n44_push_draft.${name}(${args}) returns ${returns}\nlanguage plpgsql security invoker set search_path=pg_catalog\nas $n44_boundary$\n#variable_conflict use_column\ndeclare\n${locals}\nn44_error_sqlstate text;\nbegin\n${assignments}\n${action}\nexception when others or query_canceled or assert_failure then\nget stacked diagnostics n44_error_sqlstate=returned_sqlstate;\nraise exception using errcode=n44_error_sqlstate,message='n44_private_database_error',detail='',hint='';\nend;\n$n44_boundary$;\nrevoke all on function n44_push_draft.${name}(${signature}) from public,anon,authenticated;\ngrant execute on function n44_push_draft.${name}(${signature}) to n44_backend;\n`;
    ops.push({sql,name,parameters:d.types.map(oid=>types.get(oid)),output,effect,voidResult,command:sql.split(' ')[0].toUpperCase()});
  }
  ddl+='commit;\n';
  const contract={version:1,encoding:'bound-base64-pg-text-v1',...inventory,queries:undefined,operations:ops,migration:{path:migrationPath,sha256:hash(ddl)}};
  await writeFile(root+'/'+migrationPath,ddl);
  await writeFile(root+'/'+base+'activation/error-boundary-contract.json',JSON.stringify(contract,null,2)+'\n');
  return contract;
}
