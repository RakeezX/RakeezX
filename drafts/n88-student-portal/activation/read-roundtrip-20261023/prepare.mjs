/** AI-authored. Explicit INACTIVE source preparation only; no network/listener.
 * Output stays here. Applied migrations and active service inputs are immutable.
 */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
export const dir='drafts/n88-student-portal/activation/read-roundtrip-20261023/';
export const base='drafts/n88-student-portal/';
export const digest=s=>createHash('sha256').update(s).digest('hex');
const text=async f=>(await readFile(f,'utf8')).replaceAll('\r\n','\n');
export async function prepare(){
 const previous=JSON.parse(await readFile('tests/n88-read-roundtrip-outcome-20261023/result.json','utf8'));
 assert.equal(previous.status,'PASS');assert.equal(previous.measurements[0].queryCount,14);assert.equal(previous.measurements[1].queryCount,2);
 const source=await text(base+'integrated-service.mjs');assert.equal(digest(source),previous.sourceSha256);
 // Reuse the exact previously measured fixed experimental query builder.
 const experiment=await text('tests/n88-read-roundtrip-outcome-20261023/outcome.mjs');
 const pre=source.slice(source.indexOf('const sqlNames='),source.indexOf('export async function readCanonical'));
 const tables=['years','terms','sections','students','enrollments','teachings','items','scores','scoreSubitems','scoreSubitemCompletions','sessions','attendance','logs'];
 const sql=vm.runInNewContext(pre+'\nconst tables='+JSON.stringify(tables)+';\n'+experiment.slice(experiment.indexOf('function batchSql('),experiment.indexOf('async function experimentalRead'))+';[batchSql(false),batchSql(true)]');
 const operations=sql.map(query=>({sql:query,name:'boundary_'+digest(query).slice(0,24),parameters:['uuid','bigint','integer'],output:[{name:'table_index',type:'integer',oid:23},{name:'payload',type:'text',oid:25}],effect:false,voidResult:false,command:'SELECT'}));
 const reader=`async function readCanonical(ports,ownerId,listScopeOnly=false) {
  await ports.query(listScopeOnly ? 'select n88_private.lock_canonical_sources($1::uuid,$2::integer)' : 'select n88_private.lock_projection_sources($1::uuid,$2::integer)',[ownerId,2000]);
  const names=listScopeOnly ? ['terms','teachings'] : CANONICAL_PROJECTION_REQUIREMENTS.tables;
  const canonical=Object.fromEntries(names.map(t=>[t,[]]));let bytes=0;
  const result=await ports.query(listScopeOnly ? ${JSON.stringify(sql[1])} : ${JSON.stringify(sql[0])},[ownerId,2001,2*1024*1024]);
  for(const {table_index,payload} of result.rows) {
    const rows=canonical[names[table_index]];
    if(!Number.isInteger(table_index)||!rows||rows.length>=2000||typeof payload!=='string'||(bytes+=Buffer.byteLength(payload))>2*1024*1024)throw Error('n88_projection_bound');
    const row=Object.fromEntries(Object.entries(JSON.parse(payload)).map(([k,v])=>[camel(k),v]));
    row.deleted=row.deletedAt!==null;
    for(const k of numeric)if(row[k]!=null)row[k]=Number(row[k]);
    rows.push(row);
  }
  return canonical;
}`;
 const staged=source.slice(0,source.indexOf('export async function readCanonical'))+'export '+reader+'\n'+source.slice(source.indexOf('const fieldsOff='));
 await writeFile(dir+'integrated-service.mjs',staged.replaceAll("from './","from '../../"));
 const repository=await text(base+'postgres-repository.mjs');
 await writeFile(dir+'postgres-repository.mjs',repository.replace("from './activation/private-error-boundary.mjs'","from './private-error-boundary.mjs'").replace("from './web-protocol.mjs'","from '../../web-protocol.mjs'"));
 await writeFile(dir+'private-error-boundary.mjs',await text(base+'activation/private-error-boundary.mjs'));
 const original=JSON.parse(await text(base+'activation/error-boundary-contract.json'));
 const identities=JSON.parse(await text(base+'activation/error-boundary-identities.json'));
 const quote=s=>"'"+s.replaceAll("'","''")+"'";
 // Old catalog must match exactly BEFORE either new function exists. Reruns
 // reject; the custodian must read back exact candidate identities and skip an
 // already-applied change, never recreate/replace a function or rewrite history.
 const boundaryText=await text(base+'activation/private-error-boundary.mjs');
 const catalog=boundaryText.match(/export const boundaryCatalogSql=`([^]*?)`;/)[1];
 let ddl=`-- AI-authored INACTIVE candidate. No hosted execution authority.\nbegin;\nset local lock_timeout='2s';\nset local statement_timeout='30s';\ndo $preflight$ begin\nif current_user<>'postgres' or (select coalesce(jsonb_agg(to_jsonb(c) order by c.name),'[]'::jsonb) from (${catalog}) c) <> ${quote(JSON.stringify(identities))}::jsonb then raise exception 'n88_roundtrip_preimage_unavailable'; end if;\nend $preflight$;\n`;
 for(const op of operations){
  const body=op.sql.replace(/\$(\d+)/g,(_,n)=>'v'+n);
  ddl+=`create function n88_private.${op.name}(p1 text,p2 text,p3 text) returns table(table_index integer,payload text)\nlanguage plpgsql security invoker set search_path=pg_catalog\nas $n88_boundary$\n#variable_conflict use_column\ndeclare\nv1 uuid;v2 bigint;v3 integer;state text;\nbegin\nv1:=convert_from(decode(p1,'base64'),'UTF8')::uuid;\nv2:=convert_from(decode(p2,'base64'),'UTF8')::bigint;\nv3:=convert_from(decode(p3,'base64'),'UTF8')::integer;\nif v1 is null or v2 is distinct from 2001 or v3 is distinct from 2097152 then raise exception 'n88_projection_bound'; end if;\nreturn query ${body};\nexception when others or query_canceled or assert_failure then\nget stacked diagnostics state=returned_sqlstate;\nraise exception using errcode=state,message='n88_private_database_error',detail='',hint='';\nend;\n$n88_boundary$;\nrevoke all on function n88_private.${op.name}(text,text,text) from public,anon,authenticated;\ngrant execute on function n88_private.${op.name}(text,text,text) to n88_backend;\n`;
 }
 ddl+='commit;\n';await writeFile(dir+'additive-boundary.inactive.sql',ddl);
 const contract={...original,operations:[...original.operations,...operations],inactiveReadRoundtrip:{enabled:false,parentMigration:original.migration,additiveCandidate:{path:dir+'additive-boundary.inactive.sql',sha256:digest(ddl)},originalOperationCount:original.operations.length}};
 await writeFile(dir+'error-boundary-contract.json',JSON.stringify(contract,null,2)+'\n');
 const receipt=JSON.parse(await text('tests/n88-student-read-phase-latency-20261021/native-complete.json'));
 const native=await text(base+'activation/bundle/edge/index.mjs');assert.equal(digest(native),receipt.source);assert.equal(receipt.nativeVersion,63);
 // Verify recorded embedded originals before replacing exactly three spans.
 const contractStart='var error_boundary_contract_default = ',identityStart='var error_boundary_identities_default = ';
 const contractEnd='\n\n// drafts/n88-student-portal/activation/error-boundary-identities.json';
 const identityEnd='\n\n// drafts/n88-student-portal/activation/private-error-boundary.mjs';
 const embedded=(start,end)=>{const at=native.indexOf(start);assert(at>=0);const until=native.indexOf(end,at);assert(until>at);return vm.runInNewContext('('+native.slice(at+start.length,until).trim().replace(/;$/,'')+')');};
 assert.equal(JSON.stringify(embedded(contractStart,contractEnd)),JSON.stringify(original));
 assert.equal(JSON.stringify(embedded(identityStart,identityEnd)),JSON.stringify(identities));
 const inputs={};for(const f of [base+'integrated-service.mjs',base+'postgres-repository.mjs',base+'activation/private-error-boundary.mjs',base+'activation/error-boundary-contract.json',base+'activation/error-boundary-identities.json',base+'activation/bundle/edge/index.mjs','tests/n88-read-roundtrip-outcome-20261023/outcome.mjs','tests/n88-read-roundtrip-outcome-20261023/result.json'])inputs[f]=digest(await text(f));
 return {operations,original,identities,catalog,reader,native,contract,inputs,receipt,contractStart,contractEnd,identityStart,identityEnd};
}
export async function finish(p,catalogRows){
 const old=catalogRows.filter(r=>!p.operations.some(o=>o.name===r.name));assert.deepEqual(old,p.identities);
 assert.equal(catalogRows.length,p.identities.length+2);
 for(const r of catalogRows.filter(r=>p.operations.some(o=>o.name===r.name))){assert.equal(r.definer,false);assert.equal(r.owner,'postgres');assert.deepEqual(r.config,['search_path=pg_catalog']);assert.deepEqual(r.acl,['n88_backend:EXECUTE','postgres:EXECUTE']);}
 await writeFile(dir+'error-boundary-identities.json',JSON.stringify(catalogRows,null,2)+'\n');
 const spans=[{start:p.native.indexOf('async function readCanonical('),end:p.native.indexOf('var fieldsOff ='),replacement:p.reader+'\n'},
  {start:p.native.indexOf(p.contractStart),end:p.native.indexOf(p.contractEnd),replacement:p.contractStart+JSON.stringify(p.contract,null,2)+';'},
  {start:p.native.indexOf(p.identityStart),end:p.native.indexOf(p.identityEnd,p.native.indexOf(p.identityStart)),replacement:p.identityStart+JSON.stringify(catalogRows,null,2)+';'}];
 for(const s of spans)assert(s.start>=0&&s.end>s.start);
 let transformed=p.native;for(const s of [...spans].sort((a,b)=>b.start-a.start))transformed=transformed.slice(0,s.start)+s.replacement+transformed.slice(s.end);
 await writeFile(dir+'native63-candidate.inactive.mjs',transformed);
 const outputs={};for(const f of ['integrated-service.mjs','postgres-repository.mjs','private-error-boundary.mjs','additive-boundary.inactive.sql','error-boundary-contract.json','error-boundary-identities.json','native63-candidate.inactive.mjs'])outputs[f]=digest(await text(dir+f));
 const manifest={aiAuthored:true,inactive:true,enabled:false,taskId:'continuous-n88-read-roundtrip-outcome-20261023',runId:'fbc57f79-e4dc-461c-bca6-912edcd6ba5a',baseSha:'4ee4608c3a043f8ff27fd1c90d0ba652bc7e558b',priorCandidate:'9e95eb6d50eb1c1356d0a1fa306348520724c3e7',encoding:'UTF-8 LF',inputs:p.inputs,outputs,oldOperationCount:p.original.operations.length,newOperations:p.operations,recordedProvider:{receipt:'tests/n88-student-read-phase-latency-20261021/native-complete.json',source:p.receipt.source,version:63,freshReadback:false},nativeTransformSpans:spans.map(s=>({start:s.start,end:s.end,preimageSha256:digest(p.native.slice(s.start,s.end)),replacementSha256:digest(s.replacement)})),originalCustodian:{taskId:'continuous-n88-official-student-portal-activation-20261018',sessionId:'01a14fc3-b292-7390-9952-8549a286c80f',publicCard:'artifacts/ops-supervisor-v4/queue/continuous-n88-official-student-portal-activation-20261018.json',worktree:'C:/Users/Abody/Projects/RakeezX/.worktrees/continuous-n88-official-student-portal-activation-20261018',latestSourceGateTask:'continuous-n88-student-read-phase-latency-20261021',latestSourceGateSession:'01a15e63-ff70-7d02-b264-2631fc585456'},activation:{authorized:false,providerServiceOperations:0,requiresSeparateSensitiveAuthority:true,additiveFunctions:2,oldFunctionsAltered:0,appliedMigrationsChanged:0,activeSourcesChanged:0,uploadsPerformed:0,pinsUpdated:0}};
 await writeFile(dir+'manifest.json',JSON.stringify(manifest,null,2)+'\n');return manifest;
}
