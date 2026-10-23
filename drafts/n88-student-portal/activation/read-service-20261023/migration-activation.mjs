/** AI: exact new CLI migration only after compatible source and bounded worker lifetime. */
import path from 'node:path';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,readdir,rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {guardCustodyContext} from './custody-preflight.mjs';
import {hash} from './prepare.mjs';
import {canonicalMetadata,nonPinDigest} from './config-provenance.mjs';
import {canonicalCatalog} from './catalog-identity.mjs';
import {boundaryCatalogSql} from './private-error-boundary.mjs';
const project='xlrubcwjqktzzunrvuns',migrationVersion='20261023070851',migrationName='n88_fixed_typed_read_transition';
const deny=c=>{throw Error('n88_typed_migration_'+c);};
export function qualifyDrainage(receipt,now=Date.now()){
 const at=Date.parse(receipt.verifiedAt);
 if(receipt.status!=='PASS'||receipt.nativeUploads!==1||receipt.pinUpdates!==1||!receipt.provider?.sourceExact||receipt.provider.verifyJwt!==false||receipt.provider.version<65||!Number.isFinite(at)||now-at<410000)deny('drainage_not_established');
 return {method:'documented global successful deployment plus maximum hosted worker wall-clock lifetime',maximumHostedWorkerLifetimeSeconds:400,minimumElapsedSinceVerifiedNewSourceAndPinSeconds:410,actualElapsedSeconds:Math.floor((now-at)/1000),basis:['https://supabase.com/docs/guides/functions/deploy#step-4-verify-successful-deployment','https://supabase.com/docs/guides/functions/limits'],directWorkerInventoryObserved:false};
}
export async function runMigrationActivation({candidate,load,save,official,sqlFile,phase}){
 const {root,evidence,run,manifest,stamp}=await guardCustodyContext(candidate),stage=path.join(root,'drafts/n88-student-portal/activation/read-service-20261023');
 const json=async p=>JSON.parse(await readFile(p,'utf8'));
 const native=await json(path.join(evidence,'native-pin-'+run+'.json')),prior=await json(path.join(evidence,'catalog-history-field-order-'+run+'.json'));
 if(native.runId!==run||native.source!==manifest.native||prior.status!=='PASS'||prior.mode!=='serial')deny('prerequisite');
 execFileSync('git',['merge-base','--is-ancestor',native.candidateSha,candidate],{cwd:root,stdio:'pipe'});
 const drainage=qualifyDrainage(native);
 const state=await load();if(state.directSource!==manifest.native||state.typedReadActivation?.runId!==run||!state.typedReadActivation.pinVerified||state.typedReadActivation.migrationAttempted||!state.directVerified||state.loginDisarmed||state.directAuthRefused)deny('custody_or_consumed');
 const expectedOld=await json(path.join(stage,'error-boundary-identities.json')),expectedNew=await json(path.join(stage,'typed-identities.json'));
 const readCatalog=async()=>canonicalCatalog((await sqlFile(boundaryCatalogSql))?.rows);
 const readHistory=async()=>{
  const h=await sqlFile("select version,name,encode(sha256(convert_to(coalesce(array_to_string(statements,E'\\n'),''),'UTF8')),'hex') as statements_digest from supabase_migrations.schema_migrations where name like 'n88%' or version='20261023070851' order by version");
  if(!Array.isArray(h?.rows)||h.rows.some(r=>typeof r.version!=='string'||typeof r.name!=='string'||!/^[a-f0-9]{64}$/.test(r.statements_digest)))deny('history_shape');return h.rows;
 };
 const readConfig=async()=>{
  const raw=await official(['secrets','list','--project-ref',project,'--output','json']);const entries=canonicalMetadata((Array.isArray(raw)?raw:raw?.rows)?.map(r=>({name:r.name,digest:(r.value??r.digest)?.toLowerCase()})));
  if(nonPinDigest(entries)!==native.provider.otherConfigDigest||hash(JSON.stringify(entries.map(r=>r.name)))!==native.provider.keysetDigest||entries.find(r=>r.name==='N88_SERVICE_SOURCE_SHA')?.digest!==hash(manifest.native))deny('config_drift');return {nonPinDigest:nonPinDigest(entries),keysetDigest:native.provider.keysetDigest,pinDigest:hash(manifest.native)};
 };
 const readNative=async()=>{
  const raw=await official(['functions','list','--project-ref',project,'--output','json']),list=Array.isArray(raw)?raw:raw?.functions,found=list?.filter(f=>f.slug==='n88-student-portal'||f.name==='n88-student-portal');
  if(found?.length!==1||found[0].version!==native.provider.version||found[0].verify_jwt!==false||found[0].status!=='ACTIVE')deny('native_identity');
  return {version:found[0].version,source:manifest.native,verifyJwt:false};
 };
 const receiptFile=path.join(evidence,'migration-outcome-'+run+'.json');let invoked=false,acknowledgment='NOT_RUN',invocationFailure=null;
 try{
  const actualNative=await readNative(),configBefore=await readConfig();
  const temp=path.join(evidence,'owned-typed-migration-download-'+run+'.tmp');await mkdir(temp,{recursive:false});
  try{
   await official(['functions','download','n88-student-portal','--project-ref',project,'--use-api','--workdir',temp,'--output','json']);
   let sources=0,maps=0;const expectedMap=await json(path.join(root,'drafts/n88-student-portal/activation/bundle/edge/import_map.json'));
   const visit=async d=>{for(const f of await readdir(d,{withFileTypes:true})){const p=path.join(d,f.name);if(f.isDirectory())await visit(p);else{const b=await readFile(p);if(/\.(mjs|js|ts)$/.test(f.name)&&hash(b)===manifest.native)sources++;if(f.name==='import_map.json'){assert.deepEqual(JSON.parse(b.toString()),expectedMap);maps++;}}}};await visit(temp);if(sources!==1||maps!==1)deny('download_source_map');
  }finally{if(path.dirname(temp)!==path.resolve(evidence)||!path.basename(temp).startsWith('owned-typed-migration-download-'))deny('cleanup_owner');await rm(temp,{recursive:true});}
  assert.deepEqual(await readCatalog(),expectedOld);assert.deepEqual(await readHistory(),prior.migrationHistory);
  const workdir=path.join(stage,'migration-workdir'),file=path.join(workdir,'supabase/migrations',migrationVersion+'_'+migrationName+'.sql');
  if(hash(await readFile(file))!==manifest.sql)deny('sql_bytes');
  const files=await readdir(path.dirname(file));if(files.length!==1||files[0]!==path.basename(file))deny('migration_scope');
  await writeFile(path.join(phase,'typed-read-service-20261023-migration-attempt.json'),JSON.stringify({...stamp,migrationVersion,migrationName,sql:manifest.sql,drainage})+'\n',{flag:'wx'});
  state.typedReadActivation.migrationAttempted=true;await save(state);
  invoked=true;
  try{await official(['migration','up','--linked','--project-ref',project,'--workdir',workdir,'--yes','--output','json']);acknowledgment='CONFIRMED';}catch(e){acknowledgment='UNKNOWN';invocationFailure=/^n88_[a-zA-Z0-9_]+$/.test(e.message)?e.message:'n88_typed_migration_private_diagnostics_suppressed';}
  // One invocation only. Unknown outcomes are reconciled read-only, never applied again.
  const catalogAfter=await readCatalog(),historyAfter=await readHistory();assert.deepEqual(catalogAfter,expectedNew);
  const added=historyAfter.filter(r=>r.version===migrationVersion&&r.name===migrationName);
  if(added.length!==1)deny('history_ack');assert.deepEqual(historyAfter.filter(r=>r.version!==migrationVersion),prior.migrationHistory);
  const configAfter=await readConfig();assert.deepEqual(configAfter,configBefore);assert.deepEqual(await readNative(),actualNative);
  state.typedReadActivation.migrationVerified=true;state.typedReadActivation.migrationVersion=migrationVersion;state.typedReadActivation.completedAt=new Date().toISOString();await save(state);
  const result={...stamp,status:'PASS',drainage,provider:actualNative,configuration:configAfter,catalogFingerprint:hash(JSON.stringify(catalogAfter)),routineCount:catalogAfter.length,old76Unchanged:true,newFunctions:catalogAfter.filter(r=>!expectedOld.some(o=>o.name===r.name)),migration:added[0],historyBeforeDigest:hash(JSON.stringify(prior.migrationHistory)),historyAfterDigest:hash(JSON.stringify(historyAfter)),priorHistoryUnchanged:true,sqlSha256:manifest.sql,cliAcknowledgment:acknowledgment,invocationFailure,migrationInvocations:1,nativeUploads:1,pinUpdates:1,realAccountReads:0,actualUserSpeed:'NOT_RUN',completedAt:state.typedReadActivation.completedAt};
  await writeFile(receiptFile,JSON.stringify(result,null,2)+'\n',{flag:'wx'});return result;
 }catch(e){const code=/^n88_[a-zA-Z0-9_]+$/.test(e.message)?e.message:'n88_typed_migration_private_diagnostics_suppressed';await writeFile(receiptFile,JSON.stringify({...stamp,status:'FAIL',code,drainage,migrationInvoked:invoked,cliAcknowledgment:acknowledgment,invocationFailure,automaticRetryAllowed:false},null,2)+'\n',{flag:'wx'});throw Error(code);}
}
