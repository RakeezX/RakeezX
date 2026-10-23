/** AI: authentic private history mirror; exactly one distinct corrected invocation. */
import path from 'node:path';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,readdir,lstat,rm} from 'node:fs/promises';
import {guardCustodyContext} from './custody-preflight.mjs';
import {qualifyAuthenticMirror,qualifyCliPlan,fixedMigration} from './history-mirror.mjs';
import {qualifyDrainage} from './migration-activation.mjs';
import {canonicalCatalog} from './catalog-identity.mjs';
import {canonicalMetadata,nonPinDigest} from './config-provenance.mjs';
import {boundaryCatalogSql} from './private-error-boundary.mjs';
import {hash} from './prepare.mjs';
const project='xlrubcwjqktzzunrvuns',originalRun='c4fe03b0-3995-497f-bb84-245077a08f47';
const fail=c=>{throw Error('n88_typed_history_correction_'+c);};
const historySql="select version,coalesce(name,'') as name,cardinality(statements) as statement_count,encode(sha256(convert_to(coalesce(array_to_string(statements,E';\\n'),'')||E';\\n','UTF8')),'hex') as source_digest,encode(sha256(convert_to(coalesce(array_to_string(statements,E'\\n'),''),'UTF8')),'hex') as statements_digest from supabase_migrations.schema_migrations order by version";
export async function runHistoryCorrection({candidate,load,save,official,officialClassified,sqlFile,phase,protectFreshHistoryDirectory}){
 const {root,evidence,run,manifest,stamp,card}=await guardCustodyContext(candidate),a=card.preparationAuthority.migrationDirectoryCorrection;
 if(a?.originalAttemptConsumed!==true||a.previousDisposition!=='NOT_APPLIED'||a.maxCorrectedCliInvocations!==1||a.maxTotalAppliedNewMigrations!==1||a.exactExistingVersion!==fixedMigration.version||a.sqlHashUnchanged!==true||a.completeAuthenticHistoryRequired!==true||a.noHistoryRepair!==true||a.noNativeOrPinRetry!==true||a.realDenialStops!==true||a.privateHistoricalSqlExport!==false||manifest.sql!==fixedMigration.digest)fail('authority');
 const json=async p=>JSON.parse(await readFile(p,'utf8'));
 const notApplied=await json(path.join(evidence,'post-interruption-reconcile-5956e8fa-4884-4d0c-a8e9-5f6e4cfef70f.json')),native=await json(path.join(evidence,'native-pin-'+originalRun+'.json')),oldHistory=await json(path.join(evidence,'catalog-history-field-order-'+originalRun+'.json'));
 if(notApplied.migrationDisposition!=='NOT_APPLIED'||notApplied.migrationInvocationsAcrossRuns!==1||native.status!=='PASS'||native.source!==manifest.native)fail('preserved_disposition');
 const drainage=qualifyDrainage(native),state=await load();
 if(state.directSource!==manifest.native||!state.directVerified||state.loginDisarmed||state.directAuthRefused||state.typedReadActivation?.runId!==originalRun||state.typedReadActivation.migrationAttempted!==true||!state.typedReadActivation.pinVerified||state.typedReadActivation.migrationVerified||state.typedReadActivation.directoryCorrection||(state.typedReadCorrections??[]).length)fail('custody_or_consumed');
 const stage=path.join(root,'drafts/n88-student-portal/activation/read-service-20261023'),oldCatalog=await json(path.join(stage,'error-boundary-identities.json')),newCatalog=await json(path.join(stage,'typed-identities.json'));
 const readCatalog=async()=>canonicalCatalog((await sqlFile(boundaryCatalogSql))?.rows);
 const readHistory=async()=>{const r=await sqlFile(historySql);if(!Array.isArray(r?.rows))fail('history_shape');return r.rows;};
 const verifyService=async()=>{
  const raw=await official(['functions','list','--project-ref',project,'--output','json']),list=Array.isArray(raw)?raw:raw?.functions,found=list?.filter(f=>f.slug==='n88-student-portal'||f.name==='n88-student-portal');
  if(found?.length!==1||found[0].status!=='ACTIVE'||found[0].version!==66||found[0].verify_jwt!==false)fail('native_identity');
  const rawConfig=await official(['secrets','list','--project-ref',project,'--output','json']),entries=canonicalMetadata((Array.isArray(rawConfig)?rawConfig:rawConfig?.rows)?.map(r=>({name:r.name,digest:(r.value??r.digest)?.toLowerCase()})));
  if(nonPinDigest(entries)!==native.provider.otherConfigDigest||hash(JSON.stringify(entries.map(r=>r.name)))!==native.provider.keysetDigest||entries.find(r=>r.name==='N88_SERVICE_SOURCE_SHA')?.digest!==hash(manifest.native))fail('configuration_identity');
  return {source:manifest.native,version:66,verifyJwt:false,unchangedImmutableVersionSourceProofReused:true,otherConfigDigest:nonPinDigest(entries),keysetDigest:native.provider.keysetDigest,pinDigest:hash(manifest.native),importMapDigest:native.provider.importMapDigest};
 };
 const privateStage=path.join(phase,'typed-read-authentic-history-'+run+'.tmp'),owner={taskId:stamp.taskId,runId:run,candidateSha:candidate,purpose:'private authentic migration history mirror only'},filename=fixedMigration.version+'_'+fixedMigration.name+'.sql';
 let created=false,cleanup=false,correctedInvoked=false,mirror=null,plan=null,classification=null,provider=null,historyBefore=null,result=null,missingHistoricalSourceVersions=[];
 try{
  provider=await verifyService();assert.deepEqual(await readCatalog(),oldCatalog);historyBefore=await readHistory();
  const historicalN88=oldHistory.migrationHistory.map(r=>{const found=historyBefore.find(h=>h.version===r.version);return found?{name:found.name,version:found.version,statements_digest:found.statements_digest}:null;});assert.deepEqual(historicalN88,oldHistory.migrationHistory);
  if(historyBefore.some(r=>r.version===fixedMigration.version||r.name===fixedMigration.name))fail('target_already_applied');
  missingHistoricalSourceVersions=historyBefore.filter(r=>!Number.isInteger(r.statement_count)||r.statement_count<1).map(r=>r.version);
  // Validate authenticity/ordering before fetching. This does not create placeholders.
  const preliminaryLocal=[...historyBefore.map(r=>({version:r.version,name:r.name,digest:r.source_digest})),fixedMigration];qualifyAuthenticMirror(historyBefore,preliminaryLocal);
  if(path.dirname(privateStage)!==phase||!path.basename(privateStage).startsWith('typed-read-authentic-history-'))fail('private_stage_path');
  await mkdir(privateStage,{recursive:false});created=true;await protectFreshHistoryDirectory(privateStage);
  await writeFile(path.join(privateStage,'owner.json'),JSON.stringify(owner)+'\n',{flag:'wx'});
  await mkdir(path.join(privateStage,'supabase'),{recursive:false});
  await writeFile(path.join(privateStage,'supabase/config.toml'),'project_id = "'+project+'"\n[db.migrations]\nenabled = true\n',{flag:'wx'});
  const fetch=await officialClassified(['migration','fetch','--linked','--project-ref',project,'--workdir',privateStage,'--output-format','json']);
  if(!fetch.ok){classification={stage:'READ_ONLY_HISTORY_FETCH',exitCode:fetch.exitCode,category:fetch.category,rawDiagnosticsExported:false};fail('fetch_'+fetch.category.toLowerCase());}
  const afterFetch=await readHistory();assert.deepEqual(afterFetch,historyBefore);
  const migrationsDir=path.join(privateStage,'supabase/migrations'),files=await readdir(migrationsDir);
  if(files.length!==historyBefore.length)fail('fetched_count');
  const local=[];let totalBytes=0;
  for(const h of historyBefore){
   const name=h.version+'_'+h.name+'.sql';if(!files.includes(name))fail('fetched_name');const file=path.join(migrationsDir,name),s=await lstat(file);if(!s.isFile()||s.isSymbolicLink()||s.size>8388608||(totalBytes+=s.size)>67108864)fail('fetched_bounds');
   const bytes=await readFile(file);local.push({version:h.version,name:h.name,digest:hash(bytes)});bytes.fill(0);
  }
  const sql=await readFile(path.join(stage,'migration-workdir/supabase/migrations',filename));if(hash(sql)!==fixedMigration.digest)fail('target_bytes');await writeFile(path.join(migrationsDir,filename),sql,{flag:'wx'});sql.fill(0);
  local.push(fixedMigration);mirror=qualifyAuthenticMirror(historyBefore,local);
  const dry=await officialClassified(['db','push','--dry-run','--skip-vault','--linked','--project-ref',project,'--workdir',privateStage,'--output-format','json']);
  if(!dry.ok){classification={stage:'READ_ONLY_CLI_PLAN',exitCode:dry.exitCode,category:dry.category,rawDiagnosticsExported:false};fail('plan_'+dry.category.toLowerCase());}
  plan=qualifyCliPlan(dry.data,filename);
  assert.deepEqual(await readHistory(),historyBefore);assert.deepEqual(await readCatalog(),oldCatalog);assert.deepEqual(await verifyService(),provider);
  await writeFile(path.join(phase,'typed-read-service-20261023-corrected-attempt.json'),JSON.stringify({...stamp,originalAttemptPreserved:true,version:fixedMigration.version,sql:fixedMigration.digest,mirrorDigest:mirror.orderedHistoryDigest,plan})+'\n',{flag:'wx'});
  const correction={...stamp,kind:'authentic-history-directory-correction',attempted:true,originalAttemptPreserved:true};
  state.typedReadActivation.directoryCorrection=correction;state.typedReadCorrections=[...(state.typedReadCorrections??[]),correction];await save(state);
  correctedInvoked=true;
  const apply=await officialClassified(['migration','up','--linked','--project-ref',project,'--workdir',privateStage,'--output-format','json']);
  if(!apply.ok)classification={stage:'CORRECTED_MIGRATION_INVOCATION',exitCode:apply.exitCode,category:apply.category,rawDiagnosticsExported:false};
  const actual=await readCatalog(),historyAfter=await readHistory(),added=historyAfter.filter(r=>r.version===fixedMigration.version&&r.name===fixedMigration.name),unchanged=historyAfter.filter(r=>r.version!==fixedMigration.version);
  assert.deepEqual(unchanged,historyBefore);
  if(JSON.stringify(actual)!==JSON.stringify(newCatalog)||added.length!==1){result={...stamp,status:'BLOCKED',code:'n88_typed_corrected_migration_unconfirmed',classification,correctedInvocationAcknowledged:apply.ok,migrationDisposition:JSON.stringify(actual)===JSON.stringify(oldCatalog)&&added.length===0?'NOT_APPLIED':'UNKNOWN_OR_MIXED',routineCount:actual.length,oldHistoryUnchanged:true,automaticRetryAllowed:false};}
  else{
   assert.deepEqual(await verifyService(),provider);
   state.typedReadActivation.migrationVerified=true;state.typedReadActivation.migrationVersion=fixedMigration.version;state.typedReadActivation.completedAt=new Date().toISOString();state.typedReadActivation.directoryCorrection.completed=true;await save(state);
   result={...stamp,status:'PASS',provider,drainage,configurationUnchanged:true,catalogFingerprint:hash(JSON.stringify(actual)),routineCount:78,old76Unchanged:true,newFunctions:actual.filter(r=>!oldCatalog.some(o=>o.name===r.name)),migration:{version:added[0].version,name:added[0].name,statements_digest:added[0].statements_digest,source_digest:added[0].source_digest},priorHistoryUnchanged:true,fullHistoryBeforeDigest:hash(JSON.stringify(historyBefore)),fullHistoryAfterDigest:hash(JSON.stringify(historyAfter)),sqlSha256:fixedMigration.digest,correctedInvocationAcknowledged:apply.ok,classification,correctedMigrationInvocations:1,totalMigrationInvocationsAcrossRuns:2,appliedNewMigrations:1,nativeUploads:1,pinUpdates:1,realAccountReads:0,actualUserSpeed:'NOT_RUN'};
  }
 }catch(e){const code=/^n88_[a-zA-Z0-9_]+$/.test(e.message)?e.message:'n88_typed_history_correction_private_diagnostics_suppressed';result={...stamp,status:'BLOCKED',code,classification,correctedInvocationAttempted:correctedInvoked,automaticRetryAllowed:false,rawDiagnosticsExported:false};}
 finally{
  if(created){
   // Only this new owned staging is eligible. The previously refused cache is never read/touched.
   try{if(path.dirname(privateStage)!==phase||!path.basename(privateStage).startsWith('typed-read-authentic-history-'))fail('cleanup_path');
    const marker=await json(path.join(privateStage,'owner.json'));assert.deepEqual(marker,owner);await rm(privateStage,{recursive:true});cleanup=true;
   }catch{if(result)result.privateStagingCleanup='UNCONFIRMED; protected directory retained, no alternate cleanup';}
  }
 }
 result={...result,historyMirror:mirror,cliPlan:plan,metadataHistoryCount:historyBefore?.length??null,missingHistoricalSourceVersions,originalAttemptMarkerPreserved:true,correctedInvocationCount:correctedInvoked?1:0,privateHistoricalSqlExported:false,privateStagingRemoved:cleanup,refusedOldCacheUntouched:true,newNativeUploads:0,newPinUpdates:0,newCarrierUploads:0};
 await writeFile(path.join(evidence,'history-correction-'+run+'.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});return result;
}
