/** AI: original custodian only; read-only preflight. No upload/pin/DDL implementation here. */
import assert from 'node:assert/strict';import path from 'node:path';import {fileURLToPath} from 'node:url';import {readFile,writeFile,mkdir,readdir,rm} from 'node:fs/promises';import {execFileSync} from 'node:child_process';import {hash} from './prepare.mjs';
import {loadSharedCertificate,verifySharedCertificate} from './shared-certificate.mjs';
const task='continuous-n88-typed-read-service-activation-20261023',session='01a14fc3-b292-7390-9952-8549a286c80f',project='xlrubcwjqktzzunrvuns',original='C:/Users/Abody/Projects/RakeezX/.worktrees/continuous-n88-official-student-portal-activation-20261018',runtime='C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/';
const deny=code=>{throw Error('n88_typed_'+code);};
const json=async p=>JSON.parse((await readFile(p,'utf8')).replace(/^\uFEFF/,''));
export async function guardCustodyContext(candidate){
 const root=fileURLToPath(new URL('../../../../',import.meta.url)),evidence=path.join(root,'tests/n88-read-service-20261023'),run=process.env.N88_TYPED_READ_RUN_ID;
 if(path.resolve(process.cwd())!==path.resolve(original)||process.env.N88_TYPED_READ_SESSION_ID!==session)deny('original_context');
 const card=await json(runtime+'queue/'+task+'.json'),workflow=await json(runtime+'workflow-v5.json'),a=card.preparationAuthority;
 if(card.status!=='running'||card.id!==task||card.productId!=='N88'||card.sessionId!==session||card.attempt?.runId!==run||!run||card.activationId!==workflow.controller.activationId||path.resolve(card.worktreePath)!==path.resolve(root))deny('card_identity');
 if(card.liveAuthorizationRef!=='PO-20261023-THREE-OUTCOMES-COMPLETE-BOUNDED-N88'||a.originalPrivateCustodianOnly!==session||a.maxChangedNativeFunctionUploads!==1||a.maxPublicSourcePinUpdates!==1||a.maxNewAppendOnlyMigrations!==1||a.realAccountReads!==0||a.realStudentTeacherWrites!==0||a.resetConsumedMarkers!==false||a.appendOnlyAttemptHistory!==true)deny('bounded_authority');
 for(const name of ['integration','live-mutation']){const l=await json(runtime+'leases/'+name+'.json');if(l.taskId!==task||l.owner?.token!==run||l.owner.type!=='worker'||l.resource!==name||l.activationId!==card.activationId)deny('lease_'+name);}
 if(!/^[a-f0-9]{40}$/.test(candidate??'')||execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim()!==candidate)deny('candidate');
 for(const file of ['drafts/n88-student-portal/official-activation.mjs',...['custody-preflight.mjs','config-provenance.mjs','shared-certificate.mjs','exact-delta.mjs','committed-certificate.mjs','catalog-preflight.mjs','catalog-identity.mjs','native-activation.mjs'].map(f=>'drafts/n88-student-portal/activation/read-service-20261023/'+f)]){
  if((await readFile(path.join(root,file),'utf8')).replaceAll('\r\n','\n')!==execFileSync('git',['show',candidate+':'+file],{cwd:root,encoding:'utf8',maxBuffer:2097152}).replaceAll('\r\n','\n'))deny('custody_gate_source_drift');
 }
 const stageDir=path.join(root,'drafts/n88-student-portal/activation/read-service-20261023'),manifest=await json(path.join(stageDir,'manifest.json'));
 for(const [file,h]of Object.entries(manifest.outputs))if(hash((await readFile(path.join(stageDir,file),'utf8')).replaceAll('\r\n','\n'))!==h)deny('qualified_source_drift');
 if((await json(path.join(evidence,'transition.json'))).status!=='PASS')deny('local_transition');
 const stamp={taskId:task,runId:run,candidateSha:candidate,sessionId:session,source:manifest.native,prior:manifest.priorNative,observedAt:new Date().toISOString(),providerWrites:0};
 return {root,evidence,run,manifest,stamp,card};
}
export async function runCustodyPreflight({candidate,load,official,reconcile=false,sharedCertificate=false}){
 const {root,evidence,run,manifest,stamp,card}=await guardCustodyContext(candidate);
 const receiptFile=path.join(evidence,'custodian-preflight-'+(sharedCertificate?'exact-delta-':reconcile?'reconciled-':'')+run+'.json');
 const shared=sharedCertificate?await loadSharedCertificate(card):null;
 let expectedVersion=sharedCertificate?64:63;
 if(reconcile){
  const prior=await json(path.join(evidence,'custodian-preflight-'+run+'.json')),observed=await json(path.join(evidence,'provider-metadata-reconciliation.json'));
  if(prior.code!=='n88_typed_fresh_function_identity'||prior.providerWrites!==0||observed.cliExit!==0||observed.selected?.length!==1||observed.selected[0].version!==64||observed.selected[0].verifyJwt!==false||observed.selected[0].status!=='ACTIVE'||observed.selected[0].importMap!==true)deny('metadata_reconciliation');
  expectedVersion=64; // Actual observed metadata only; source/config/pin guards remain exact.
 }
 try{
  const state=await load();if(state.directVerified!==true||state.loginDisarmed||state.directAuthRefused||state.directSource!==manifest.priorNative)deny('custody_preimage');
  const history=state.sourceCorrections??[];if(!Array.isArray(history)||history.some(r=>r.taskId===task))deny('consumed_history');
  const custody={originalCustodian:true,priorSourceMatches:true,historyCount:history.length,historyDigest:hash(JSON.stringify(history)),newTaskHistoryEntries:0};
  const raw=await official(['functions','list','--project-ref',project,'--output','json']),list=Array.isArray(raw)?raw:raw?.functions,found=list?.filter(f=>f.slug==='n88-student-portal'||f.name==='n88-student-portal');
  if(found?.length!==1||found[0].version!==expectedVersion||found[0].verify_jwt!==false)deny('fresh_function_identity');
  const temporary=path.join(evidence,'owned-provider-download-'+run+'.tmp');await mkdir(temporary,{recursive:false});
  let sourceExact=false,importMapDigest;
  try{
   await official(['functions','download','n88-student-portal','--project-ref',project,'--use-api','--workdir',temporary,'--output','json']);
   let matching=0,maps=0;const expectedMap=await json(path.join(root,'drafts/n88-student-portal/activation/bundle/edge/import_map.json'));
   const visit=async d=>{for(const f of await readdir(d,{withFileTypes:true})){const p=path.join(d,f.name);if(f.isDirectory())await visit(p);else{const bytes=await readFile(p);if(/\.(mjs|js|ts)$/.test(f.name)&&hash(bytes)===manifest.priorNative)matching++;if(f.name==='import_map.json'){const m=JSON.parse(bytes.toString());assert.deepEqual(m,expectedMap);importMapDigest=hash(JSON.stringify(m));maps++;}}}};await visit(temporary);if(matching!==1||maps!==1)deny('fresh_source_import_map');sourceExact=true;
  }finally{if(path.dirname(temporary)!==evidence||!path.basename(temporary).startsWith('owned-provider-download-'))deny('cleanup_owner');await rm(temporary,{recursive:true});}
  const rawConfig=await official(['secrets','list','--project-ref',project,'--output','json']),rows=Array.isArray(rawConfig)?rawConfig:rawConfig?.rows;
  if(!Array.isArray(rows))deny('config_shape');const entries=rows.map(r=>({name:r.name,digest:r.value??r.digest})).sort((a,b)=>a.name.localeCompare(b.name));
  if(entries.some(r=>typeof r.name!=='string'||!/^[a-f0-9]{64}$/i.test(r.digest??''))||new Set(entries.map(r=>r.name)).size!==entries.length)deny('config_fingerprints');
  const pin=entries.filter(r=>r.name==='N88_SERVICE_SOURCE_SHA');if(pin.length!==1||pin[0].digest.toLowerCase()!==hash(manifest.priorNative))deny('pin_preimage');
  const previous=await json(path.join(root,'tests/n88-student-read-phase-latency-20261021/native-pin.json'));
  const otherConfigDigest=hash(JSON.stringify(entries.filter(r=>r.name!=='N88_SERVICE_SOURCE_SHA')));
  let configurationReconciliation;
  if(shared){
   configurationReconciliation=verifySharedCertificate(entries,shared);
   const publicBytes=await readFile(path.join(root,'drafts/n44-push/activation/public-provider-config.json'));
   if(hash(publicBytes)!=='f38b4fee5713499f9bb1b63ba1843afe0a234bc8b17f98b238ab9911aa1fbd5a')deny('publishable_reference_bytes');
   const publicReference=JSON.parse(publicBytes.toString());
   if(publicReference.project!==project||publicReference.keyType!=='publishable'||publicReference.disabled!==false||publicReference.source!=='Actual Supabase get_publishable_keys; legacy disabled anon excluded'||typeof publicReference.authPublicKey!=='string'||entries.find(r=>r.name==='N88_AUTH_API_KEY')?.digest!==hash(publicReference.authPublicKey))deny('publishable_reference');
   configurationReconciliation.independentN88AuthApiKeyMatches=true;
  }else if(otherConfigDigest!==previous.provider.otherConfigDigest)deny('config_drift');
  if(importMapDigest!==previous.provider.importMapDigest)deny('config_drift');
  const result={...stamp,status:'PASS',custody,recordedHistoricalVersion:63,metadataReconciliation:reconcile,configurationReconciliation,provider:{source:manifest.priorNative,sourceExact,version:expectedVersion,verifyJwt:false,importMapDigest,pinDigest:pin[0].digest.toLowerCase(),otherConfigDigest},remaining:['exact catalog/history and carrier preflight','compatible upload/pin plus supported old-worker drainage evidence before DDL']};
  await writeFile(receiptFile,JSON.stringify(result,null,2)+'\n',{flag:'wx'});return result;
 }catch(e){const code=/^n88_[a-zA-Z0-9_]+$/.test(e.message)?e.message:'n88_typed_preflight_private_diagnostics_suppressed';await writeFile(receiptFile,JSON.stringify({...stamp,status:'FAIL',code,providerWrites:0,uploads:0,pinUpdates:0,migrations:0},null,2)+'\n',{flag:'wx'});throw Error(code);}
}
