/** AI: exact routine catalog and migration metadata only; no data/DDL. */
import path from 'node:path';
import {readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {guardCustodyContext} from './custody-preflight.mjs';
import {boundaryCatalogSql} from './private-error-boundary.mjs';
import {hash} from './prepare.mjs';
export async function runCatalogPreflight({candidate,load,sqlFile}){
 const {root,evidence,run,stamp,manifest}=await guardCustodyContext(candidate);
 const receiptFile=path.join(evidence,'catalog-history-'+run+'.json');
 const json=async p=>JSON.parse(await readFile(p,'utf8'));
 const before=await json(path.join(evidence,'custodian-preflight-exact-delta-'+run+'.json'));
 if(before.status!=='PASS'||before.runId!==run||before.source!==manifest.native||before.configurationReconciliation?.status!=='PASS'||Date.now()-Date.parse(before.observedAt)>20*60*1000)throw Error('n88_typed_catalog_config_prerequisite');
 execFileSync('git',['merge-base','--is-ancestor',before.candidateSha,candidate],{cwd:root,stdio:'pipe'});
 const state=await load();if(state.directSource!==manifest.priorNative||state.directVerified!==true||state.loginDisarmed||state.directAuthRefused)throw Error('n88_typed_catalog_custody');
 try{
  const catalog=await sqlFile(boundaryCatalogSql);
  const old=await json(path.join(root,'drafts/n88-student-portal/activation/read-service-20261023/error-boundary-identities.json'));
  const next=await json(path.join(root,'drafts/n88-student-portal/activation/read-service-20261023/typed-identities.json'));
  const serialized=JSON.stringify(catalog?.rows);
  const mode=serialized===JSON.stringify(old)?'serial':serialized===JSON.stringify(next)?'batch':null;
  if(!mode)throw Error('n88_typed_actual_catalog_drift');
  const history=await sqlFile("select version,name,encode(sha256(convert_to(coalesce(array_to_string(statements,E'\\n'),''),'UTF8')),'hex') as statements_digest from supabase_migrations.schema_migrations where name like 'n88%' or version='20261023070851' order by version");
  if(!Array.isArray(history?.rows)||history.rows.some(r=>typeof r.version!=='string'||typeof r.name!=='string'||!/^[a-f0-9]{64}$/.test(r.statements_digest)))throw Error('n88_typed_history_shape');
  const typed=history.rows.filter(r=>r.version==='20261023070851'||r.name==='n88_fixed_typed_read_transition');
  if(mode==='serial'&&typed.length||mode==='batch'&&typed.length!==1)throw Error('n88_typed_history_catalog_mismatch');
  const result={...stamp,status:'PASS',mode,routineCount:catalog.rows.length,catalogFingerprint:hash(serialized),oldCatalogUnchanged:true,newFunctionsPresent:mode==='batch',migrationHistory:history.rows,migrationHistoryDigest:hash(JSON.stringify(history.rows)),exactPreparedMigrationPreviouslyApplied:mode==='batch',providerWrites:0,remaining:['unchanged current carrier parity','compatible native activation/pin and supported old-worker drainage before DDL']};
  await writeFile(receiptFile,JSON.stringify(result,null,2)+'\n',{flag:'wx'});return result;
 }catch(e){const code=/^n88_[a-zA-Z0-9_]+$/.test(e.message)?e.message:'n88_typed_catalog_private_diagnostics_suppressed';await writeFile(receiptFile,JSON.stringify({...stamp,status:'FAIL',code,providerWrites:0,uploads:0,pinUpdates:0,migrations:0},null,2)+'\n',{flag:'wx'});throw Error(code);}
}
