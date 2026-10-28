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
/** AI: append-only INACTIVE synthetic closure compiler. Original migrations and
 * serial/typed identities are immutable. Never accepts a hosted connection.
 * caller supplies the owned native fixture, not a provider/client URL.
 */
export async function compileGuidanceBoundary(root,fixture) {
  if(!fixture?.phase?.includes('tests')||!fixture.identity||!Number.isInteger(fixture.port))throw Error('n88_local_fixture_required');
  const query=fixture.fixtureQuery;
  const integrated=(await readFile(root+'/'+base+'integrated-service.mjs','utf8')).replaceAll('\r\n','\n');
  const {columns,sqlNames}=vm.runInNewContext(integrated.slice(integrated.indexOf('const sqlNames='),integrated.indexOf('export async function readCanonical'))+';({columns,sqlNames})');
  const names=Object.keys(columns);
  const select=(table,predicate)=>`select ${columns[table].replace(/\brevision\b/g,'revision::text as revision')} from rakeezx.${sqlNames[table]||table} where owner_id=p_owner and (${predicate}) order by id limit 2001 for update`;
  const predicates=names.map((n,i)=>i<7?'true':n==='scoreSubitems'?'item_id=any(v_items)':n==='scores'?'student_id=any(v_students) and item_id=any(v_items)':n==='scoreSubitemCompletions'?'student_id=any(v_students) and subitem_id=any(v_subitems)':n==='attendance'?'student_id=any(v_students) and teaching_id=any(v_teachings)':'teaching_id=any(v_teachings)');
  const sql='select table_index,payload from n88_private.boundary_guidance_sources_v1($1::uuid,$2::text,$3::text)';
  const wrapper='boundary_'+hash(sql).slice(0,24);
  let ddl=`-- AI: INACTIVE N88 guidance closure v1. Synthetic PG only, NEVER hosted.
-- Not a migration. Original catalog/migrations remain immutable. No source writes.
-- Owner FOR UPDATE blocks owner-FK inserts. Existing core rows FOR UPDATE block
-- membership/teaching moves and child FK retargets; selected child row locks block
-- value/revision/deletion changes. Lock/statement deadlines abort, never truncate.
begin;
set local lock_timeout='2s';
set local statement_timeout='30s';
`;
  for(const n of names)ddl+=`grant select(${columns[n]}) on rakeezx.${sqlNames[n]||n} to n88_guard;\n`;
  ddl+=`create function n88_private.boundary_guidance_sources_v1(p_owner uuid,p_class text,p_term text)
returns table(table_index integer,payload text)
language plpgsql security definer set search_path=pg_catalog as $n88_guidance$
declare v_students text[];v_teachings text[];v_items text[];v_subitems text[];v_year text;v_grade integer;v_bytes integer:=0;v_count integer;state text;
begin
 if p_owner is null or p_class is null or p_term is null then raise exception 'n88_guidance_unavailable';end if;
 perform n88_private.lock_canonical_sources(p_owner,2000);
 select c.year_id,c.grade into strict v_year,v_grade from rakeezx.sections c
 join rakeezx.years y on y.owner_id=c.owner_id and y.id=c.year_id
 join rakeezx.terms t on t.owner_id=c.owner_id and t.year_id=c.year_id and t.id=p_term
 where c.owner_id=p_owner and c.id=p_class and c.status='active' and c.deleted_at is null and c.archived_at is null
 and y.status='active' and y.deleted_at is null and t.status='active' and t.deleted_at is null;
 select coalesce(array_agg(distinct e.student_id),'{}') into v_students from rakeezx.enrollments e
 join rakeezx.students s on s.owner_id=e.owner_id and s.id=e.student_id
 where e.owner_id=p_owner and e.section_id=p_class and e.status='active' and e.end_date is null and e.deleted_at is null and s.status='active' and s.deleted_at is null;
 -- Preserve all same-year enrollments/core rows for original uniqueness. Include
 -- transferred teacher context, not an invented empty portable-grade context.
 select coalesce(array_agg(t.id),'{}') into v_teachings from rakeezx.teachings t
 join rakeezx.sections c on c.owner_id=t.owner_id and c.id=t.section_id
 where t.owner_id=p_owner and t.term_id=p_term and (t.section_id=p_class or
 (c.year_id=v_year and c.grade is not distinct from v_grade and exists(select 1 from rakeezx.enrollments e
 where e.owner_id=p_owner and e.student_id=any(v_students) and e.section_id=c.id and e.status='transferred' and e.deleted_at is null)));
 select coalesce(array_agg(i.id),'{}') into v_items from rakeezx.items i where i.owner_id=p_owner and i.teaching_id=any(v_teachings);
`;
  // Lock definitions before selecting dependent completion IDs; parent locks also
  // exclude concurrent FK retargets. The owner key excludes new definitions.
  ddl+=`perform id from rakeezx.score_subitems where owner_id=p_owner and item_id=any(v_items) order by id limit 2001 for update;
 select coalesce(array_agg(id),'{}') into v_subitems from (select id from rakeezx.score_subitems where owner_id=p_owner and item_id=any(v_items) order by id limit 2001) x;
 if cardinality(v_subitems)>2000 then raise exception 'n88_projection_bound';end if;
`;
  names.forEach((n,i)=>{
    ddl+=`select count(*)::integer,coalesce(json_agg(x)::text,'[]') into v_count,payload from (${select(n,predicates[i])}) x;
 v_bytes:=v_bytes+octet_length(payload);
 if v_count>2000 or v_bytes>2097152 then raise exception 'n88_projection_bound';end if;
 table_index:=${i};return next;\n`;
  });
  ddl+=`exception when others or query_canceled or assert_failure then
 get stacked diagnostics state=returned_sqlstate;
 raise exception using errcode=state,message='n88_private_database_error',detail='',hint='';
end;
$n88_guidance$;
revoke all on function n88_private.boundary_guidance_sources_v1(uuid,text,text) from public,anon,authenticated;
grant execute on function n88_private.boundary_guidance_sources_v1(uuid,text,text) to n88_backend;
grant create on schema n88_private to n88_guard;
grant n88_guard to postgres with set true;
alter function n88_private.boundary_guidance_sources_v1(uuid,text,text) owner to n88_guard;
grant n88_guard to postgres with set false;
revoke create on schema n88_private from n88_guard;
create function n88_private.${wrapper}(p1 text,p2 text,p3 text) returns table(table_index integer,payload text)
language plpgsql security invoker set search_path=pg_catalog as $n88_wire$
declare state text;
begin
 return query select * from n88_private.boundary_guidance_sources_v1(convert_from(decode(p1,'base64'),'UTF8')::uuid,convert_from(decode(p2,'base64'),'UTF8'),convert_from(decode(p3,'base64'),'UTF8'));
exception when others or query_canceled or assert_failure then
 get stacked diagnostics state=returned_sqlstate;
 raise exception using errcode=state,message='n88_private_database_error',detail='',hint='';
end;
$n88_wire$;
revoke all on function n88_private.${wrapper}(text,text,text) from public,anon,authenticated;
grant execute on function n88_private.${wrapper}(text,text,text) to n88_backend;
commit;
`;
  await query('set role postgres');
  try{await query(ddl);}finally{await query('reset role');}
  const {boundaryCatalogSql}=await import('./private-error-boundary.mjs');
  const identities=(await query(boundaryCatalogSql)).rows.filter(r=>[wrapper,'boundary_guidance_sources_v1'].includes(r.name));
  if(identities.length!==2)throw Error('n88_guidance_catalog_unavailable');
  const contract=JSON.parse(await readFile(root+'/'+base+'activation/error-boundary-contract.json','utf8'));
  contract.guidanceClosure={version:1,sourceOnly:true,operations:[{sql,name:wrapper,parameters:['uuid','text','text'],output:[{name:'table_index',type:'integer',oid:23},{name:'payload',type:'text',oid:25}],effect:false,voidResult:false,command:'SELECT'}],identities,staging:{path:base+'guidance-closure.inactive.sql',sha256:hash(ddl)}};
  await writeFile(root+'/'+base+'guidance-closure.inactive.sql',ddl);
  await writeFile(root+'/'+base+'activation/error-boundary-contract.json',JSON.stringify(contract,null,2)+'\n');
  const catalog=JSON.parse(await readFile(root+'/'+base+'activation/official-source-catalog.json','utf8'));
  // Preserve the historical provider capture verbatim; this addendum is LOCAL,
  // not a claim of hosted presence or permission. Original identities stay pinned.
  catalog.inactiveGuidanceClosure={qualification:'synthetic-native-pg17-only',providerOperations:0,sourceOnly:true,staging:contract.guidanceClosure.staging,identities,consumedColumns:columns,closure:'Complete bounded core; current class/term plus transferred grade context; raw scores retained. Owner key, core and selected child row locks until transaction completion.'};
  await writeFile(root+'/'+base+'activation/official-source-catalog.json',JSON.stringify(catalog,null,2)+'\n');
  return contract.guidanceClosure;
}
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
