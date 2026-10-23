/** AI: one compatible upload and one public pin, original custody only. No SQL. */
import path from 'node:path';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,readdir,rm,unlink} from 'node:fs/promises';
import {guardCustodyContext} from './custody-preflight.mjs';
import {canonicalMetadata,nonPinDigest} from './config-provenance.mjs';
import {hash} from './prepare.mjs';
const project='xlrubcwjqktzzunrvuns';
const deny=c=>{throw Error('n88_typed_activation_'+c);};
export function qualifyActivationReceipts({before,catalog,carrier,manifest,run,now=Date.now()}){
 if(before.status!=='PASS'||before.runId!==run||before.source!==manifest.native||before.configurationReconciliation?.status!=='PASS'||!Number.isFinite(Date.parse(before.observedAt))||now-Date.parse(before.observedAt)>20*60*1000||now<Date.parse(before.observedAt))deny('config_prerequisite');
 if(catalog.status!=='PASS'||catalog.runId!==run||catalog.source!==manifest.native||catalog.mode!=='serial'||catalog.routineCount!==76||catalog.newFunctionsPresent!==false||catalog.exactPreparedMigrationPreviouslyApplied!==false)deny('catalog_prerequisite');
 if(carrier.qualification?.status!=='PASS'||carrier.runId!==run||carrier.qualification.sourceSha256!=='a2d840e6b4b35f1be968f332773a78640a45b4529a54d3ae98c92fba3f47da50'||carrier.rawProviderReadback.sourceSha256!==carrier.qualification.sourceSha256)deny('carrier_prerequisite');
}
export async function runNativeActivation({candidate,load,save,official,phase}){
 const {root,evidence,run,manifest,stamp}=await guardCustodyContext(candidate),stage=path.join(root,'drafts/n88-student-portal/activation/read-service-20261023');
 const json=async p=>JSON.parse(await readFile(p,'utf8'));
 const before=await json(path.join(evidence,'custodian-preflight-exact-delta-'+run+'.json')),catalog=await json(path.join(evidence,'catalog-history-field-order-'+run+'.json')),carrier=await json(path.join(evidence,'carrier-preflight-c4fe03b0.json'));
 qualifyActivationReceipts({before,catalog,carrier,manifest,run});
 const oldCarrier=await json(path.join(root,'tests/n88-student-read-phase-latency-20261021/transport-after.json'));
 assert.deepEqual(carrier.rawProviderReadback.settings,oldCarrier.provider.settings);
 assert.deepEqual(carrier.rawProviderReadback.routes,oldCarrier.provider.routes);
 assert.deepEqual(carrier.rawProviderReadback.subdomain,oldCarrier.provider.subdomain);
 if(carrier.rawProviderReadback.versions.length!==1||carrier.rawProviderReadback.versions[0].percentage!==100)deny('carrier_routing');
 const state=await load();
 if(state.directSource!==manifest.priorNative||!state.directVerified||state.loginDisarmed||state.directAuthRefused||state.typedReadActivation||(state.sourceCorrections??[]).some(r=>r.taskId===stamp.taskId))deny('custody_or_consumed');
 const expectedMap=JSON.parse(await readFile(path.join(root,'drafts/n88-student-portal/activation/bundle/edge/import_map.json'),'utf8'));
 const readConfig=async expectedPin=>{
  const raw=await official(['secrets','list','--project-ref',project,'--output','json']);
  const entries=canonicalMetadata((Array.isArray(raw)?raw:raw?.rows)?.map(r=>({name:r.name,digest:(r.value??r.digest)?.toLowerCase()})));
  if(nonPinDigest(entries)!==before.provider.otherConfigDigest||hash(JSON.stringify(entries.map(r=>r.name)))!==before.configurationReconciliation.keysetDigest||entries.find(r=>r.name==='N88_SERVICE_SOURCE_SHA')?.digest!==hash(expectedPin))deny('config_or_pin_drift');
  return {otherConfigDigest:nonPinDigest(entries),pinDigest:hash(expectedPin),keysetDigest:before.configurationReconciliation.keysetDigest};
 };
 const readNative=async source=>{
  const raw=await official(['functions','list','--project-ref',project,'--output','json']),functions=Array.isArray(raw)?raw:raw?.functions,found=functions?.filter(f=>f.slug==='n88-student-portal'||f.name==='n88-student-portal');
  if(found?.length!==1||found[0].status!=='ACTIVE'||found[0].verify_jwt!==false||!Number.isInteger(found[0].version)||found[0].version<64)deny('native_metadata');
  const temp=path.join(evidence,'owned-typed-read-download-'+run+'.tmp');await mkdir(temp,{recursive:false});
  try{
   await official(['functions','download','n88-student-portal','--project-ref',project,'--use-api','--workdir',temp,'--output','json']);
   let sources=0,maps=0;const visit=async d=>{for(const f of await readdir(d,{withFileTypes:true})){const p=path.join(d,f.name);if(f.isDirectory())await visit(p);else{const b=await readFile(p);if(/\.(mjs|js|ts)$/.test(f.name)&&hash(b)===source)sources++;if(f.name==='import_map.json'){assert.deepEqual(JSON.parse(b.toString()),expectedMap);maps++;}}}};await visit(temp);
   if(sources!==1||maps!==1)deny('native_source_map');
   return {source,sourceExact:true,version:found[0].version,verifyJwt:false,importMapDigest:hash(JSON.stringify(expectedMap)),updatedAt:found[0].updated_at??null};
  }finally{if(path.dirname(temp)!==path.resolve(evidence)||!path.basename(temp).startsWith('owned-typed-read-download-'))deny('cleanup_owner');await rm(temp,{recursive:true});}
 };
 const reservation=path.join(phase,'typed-read-service-20261023-native-attempt.json'),receipt=path.join(evidence,'native-pin-'+run+'.json');
 let uploadInvoked=false,pinInvoked=false;
 try{
  // The known provider source/config are rechecked immediately before reservation.
  await readNative(manifest.priorNative);await readConfig(manifest.priorNative);
  const native=Buffer.from((await readFile(path.join(stage,'native63-compatible.inactive.mjs'),'utf8')).replaceAll('\r\n','\n'));
  if(hash(native)!==manifest.native)deny('upload_bytes');
  await writeFile(reservation,JSON.stringify({...stamp,kind:'native-attempt',source:manifest.native})+'\n',{flag:'wx'});
  state.typedReadActivation={...stamp,nativeAttempted:true,pinAttempted:false,migrationAttempted:false};await save(state);
  const temp=path.join(evidence,'owned-typed-read-upload-'+run+'.tmp'),functionDir=path.join(temp,'supabase/functions/n88-student-portal');await mkdir(temp,{recursive:false});
  try{
   await mkdir(functionDir,{recursive:true});await writeFile(path.join(functionDir,'index.mjs'),native,{flag:'wx'});
   for(const name of ['deno.json','deno.lock','import_map.json'])await writeFile(path.join(functionDir,name),await readFile(path.join(root,'drafts/n88-student-portal/activation/bundle/edge',name)),{flag:'wx'});
   await writeFile(path.join(temp,'supabase/config.toml'),'project_id = "'+project+'"\n[functions.n88-student-portal]\nverify_jwt = false\nentrypoint = "./functions/n88-student-portal/index.mjs"\nimport_map = "./functions/n88-student-portal/import_map.json"\n',{flag:'wx'});
   uploadInvoked=true;await official(['functions','deploy','n88-student-portal','--project-ref',project,'--use-api','--no-verify-jwt','--workdir',temp,'--output','json']);
   state.typedReadActivation.uploadAcknowledgedAt=new Date().toISOString();await save(state);
  }finally{if(path.dirname(temp)!==path.resolve(evidence)||!path.basename(temp).startsWith('owned-typed-read-upload-'))deny('cleanup_owner');await rm(temp,{recursive:true});}
  const uploaded=await readNative(manifest.native);if(uploaded.version<=before.provider.version)deny('new_native_version');
  await readConfig(manifest.priorNative);
  await writeFile(path.join(phase,'typed-read-service-20261023-pin-attempt.json'),JSON.stringify({...stamp,kind:'pin-attempt',source:manifest.native})+'\n',{flag:'wx'});
  state.typedReadActivation.pinAttempted=true;await save(state);
  const pinFile=path.join(phase,'typed-read-service-20261023-public-pin.env');
  try{await writeFile(pinFile,'N88_SERVICE_SOURCE_SHA='+manifest.native+'\n',{flag:'wx'});pinInvoked=true;await official(['secrets','set','--project-ref',project,'--env-file',pinFile]);}finally{await unlink(pinFile).catch(e=>{if(e.code!=='ENOENT')throw e;});}
  const actual=await readNative(manifest.native),config=await readConfig(manifest.native);
  const verifiedAt=new Date().toISOString();state.directSource=manifest.native;state.sourceCorrections=[...(state.sourceCorrections??[]),{...stamp,prior:manifest.priorNative,source:manifest.native,nativeVersion:actual.version}];
  state.typedReadActivation={...state.typedReadActivation,pinVerified:true,nativeVersion:actual.version,verifiedAt};await save(state);
  const result={...stamp,status:'PASS',provider:{...actual,...config},uploadAcknowledgedAt:state.typedReadActivation.uploadAcknowledgedAt,verifiedAt,nativeUploads:1,pinUpdates:1,migrations:0,carrierUploads:0,drainage:'NOT_RUN; no DDL before supported gate',realAccountReads:0};
  await writeFile(receipt,JSON.stringify(result,null,2)+'\n',{flag:'wx'});return result;
 }catch(e){const code=/^n88_[a-zA-Z0-9_]+$/.test(e.message)?e.message:'n88_typed_activation_private_diagnostics_suppressed';await writeFile(receipt,JSON.stringify({...stamp,status:'FAIL',code,uploadInvoked,pinInvoked,migrations:0,unknownOutcomeRequiresReadOnlyReconciliation:true},null,2)+'\n',{flag:'wx'});throw Error(code);}
}
