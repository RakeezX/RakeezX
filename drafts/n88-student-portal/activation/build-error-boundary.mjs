/** AI-authored. Local-only compiler for a finite, source-derived SQL contract.
 * PREPARE/Describe infer native PG types without executing a private operation.
 * Never run this compiler against a hosted database. No dynamic SQL in routines.
 */
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
const base='drafts/n88-student-portal/';
export const migrationPath='supabase/migrations/20261018185300_n88_private_error_boundary_staged.sql';
const hash=s=>createHash('sha256').update(s).digest('hex');
export async function sourceQueries(root) {
  const read=async f=>(await readFile(root+'/'+base+f,'utf8')).replaceAll('\r\n','\n');
  const repo=await read('postgres-repository.mjs');
  const pre=repo.slice(repo.indexOf('const unavailable'),repo.indexOf('const pk ='));
  const generated=vm.runInNewContext(pre+';queries',{Buffer});
  const queries=new Set(Object.values(generated).flatMap(Object.values));
  const controls=new Set(['begin isolation level read committed','commit','select pg_advisory_xact_lock(1312307256, 88)']);
  const files=['canonical-adapter.mjs','class-credentials.mjs','auth-verifier.mjs','web-entry.mjs','integrated-service.mjs','code-recovery.mjs','task-guidance.mjs','postgres-repository.mjs'];
  const integrated=await read('integrated-service.mjs');
  const {columns,sqlNames}=vm.runInNewContext(integrated.slice(integrated.indexOf('const sqlNames='),integrated.indexOf('export async function readCanonical'))+';({columns,sqlNames})');
  const evidence=[];
  for(const file of files) {
    const source=await read(file);evidence.push({file:base+file,sha256:hash(source)});
    for(const match of source.matchAll(/\bquery\(\s*(`[^`]*`|'[^']*'|"[^"]*")/g)) {
      const literal=match[1];
      let expansions;
      if(literal.includes('${selected}'))expansions=Object.keys(columns).map(table=>({table,sqlNames,selected:columns[table].replace(/\brevision\b/g,'revision::text as revision')}));
      else if(literal.includes('${table}'))expansions=['numeric_credentials','numeric_sessions','numeric_rates','numeric_attempts','class_credential_receipts'].map(table=>({table}));
      else expansions=[{}];
      for(const context of expansions) {
        const sql=vm.runInNewContext(literal,context);
        if(/^(savepoint |release savepoint |rollback to savepoint |begin |commit$|select set_config)/.test(sql))controls.add(sql);
        else queries.add(sql);
      }
    }
  }
  return {queries:[...queries].sort(),controls:[...controls].sort(),sources:evidence};
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
  const inventory=await sourceQueries(root),ops=[];let ddl=`-- AI-authored. Append-only N88 private typed error boundary. Original six migrations unchanged.
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
    ddl+=`create function n88_private.${name}(${args}) returns ${returns}\nlanguage plpgsql security invoker set search_path=pg_catalog\nas $n88_boundary$\n#variable_conflict use_column\ndeclare\n${locals}\nstate text;\nbegin\n${assignments}\n${action}\nexception when others or query_canceled or assert_failure then\nget stacked diagnostics state=returned_sqlstate;\nraise exception using errcode=state,message='n88_private_database_error',detail='',hint='';\nend;\n$n88_boundary$;\nrevoke all on function n88_private.${name}(${signature}) from public,anon,authenticated;\ngrant execute on function n88_private.${name}(${signature}) to n88_backend;\n`;
    ops.push({sql,name,parameters:d.types.map(oid=>types.get(oid)),output,effect,voidResult,command:sql.split(' ')[0].toUpperCase()});
  }
  ddl+='commit;\n';
  const contract={version:1,encoding:'bound-base64-pg-text-v1',...inventory,queries:undefined,operations:ops,migration:{path:migrationPath,sha256:hash(ddl)}};
  await writeFile(root+'/'+migrationPath,ddl);
  await writeFile(root+'/'+base+'activation/error-boundary-contract.json',JSON.stringify(contract,null,2)+'\n');
  return contract;
}
