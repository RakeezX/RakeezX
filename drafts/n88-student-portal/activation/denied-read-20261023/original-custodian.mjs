/** AI: original custody/CLI adapter. Explicit entry only; no calls at import. */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,readdir,rm,unlink,lstat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {spawnSync,execFileSync} from 'node:child_process';
import {createInheritedVerifier} from '../read-service-20261023/inherited-custody.mjs';
import {classifyCliFailure} from '../read-service-20261023/history-mirror.mjs';
import {taskId,custodianSession,projectId,priorSource,successorSource,hash,canonical,qualifyAuthority,qualifyConfigurationDelta} from './transition-guards.mjs';
import {loadRuntimePhase} from './runtime-phase.mjs';
import {qualifyRuntimeConfiguration,requireWholeTransitionEqual} from './runtime-configuration.mjs';
import {originalRuntimeExpectations} from './runtime-expectations.mjs';
import {runSuccessorTransition,reconcileSuccessor} from './activation-transition.mjs';
const original='C:/Users/Abody/Projects/RakeezX/.worktrees/continuous-n88-official-student-portal-activation-20261018',runtime='C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/';
const root=fileURLToPath(new URL('../../../../',import.meta.url)),directory=fileURLToPath(new URL('.',import.meta.url)),evidence=path.join(root,'tests/n88-denied-read-activation-20261023');
const phase=path.join(original,'drafts/n88-student-portal/activation/owned-custody-4ddd5df2-933f-4754-8d04-0d27be47bcff.tmp');
const cli='C:/Users/Abody/AppData/Local/npm-cache/_npx/0e23c24576954b26/node_modules/supabase/dist/supabase.js';
const deny=c=>{throw Error('n88_denied_custodian_'+c);};
const json=async p=>JSON.parse((await readFile(p,'utf8')).replace(/^\uFEFF/,''));
async function owned(){assert.deepEqual(await json(path.join(phase,'owner.json')),{run:'4ddd5df2-933f-4754-8d04-0d27be47bcff',project:projectId,phase,purpose:'N88 restricted service custody and immutable recovery'});}
function dpapi(bytes,protect){
 const script=`Add-Type -AssemblyName System.Security;$m=New-Object System.IO.MemoryStream;[Console]::OpenStandardInput().CopyTo($m);$b=$m.ToArray();$v=[System.Security.Cryptography.ProtectedData]::${protect?'Protect':'Unprotect'}($b,$null,[System.Security.Cryptography.DataProtectionScope]::CurrentUser);[Array]::Clear($b,0,$b.Length);[Console]::Write([Convert]::ToBase64String($v));[Array]::Clear($v,0,$v.Length)`;
 const r=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{input:bytes,windowsHide:true,timeout:15000,maxBuffer:262144});
 try{if(r.status!==0)deny('dpapi');return Buffer.from(r.stdout.toString().trim(),'base64');}finally{r.stdout?.fill(0);r.stderr?.fill(0);}
}
async function official(args){
 const pair=args.slice(0,2).join(' ');
 if(!['functions list','functions download','functions deploy','secrets list','secrets set'].includes(pair)||!args.includes(projectId))deny('cli_operation');
 if(pair.startsWith('functions ')&&pair!=='functions list'&&args[2]!=='n88-student-portal')deny('function_scope');
 const r=spawnSync(process.execPath,[cli,...args],{windowsHide:true,timeout:60000,maxBuffer:2097152});
 try{if(r.status!==0)deny('cli_'+classifyCliFailure({status:r.status,error:r.error,stdout:r.stdout.toString(),stderr:r.stderr.toString()}).category.toLowerCase());try{return JSON.parse(r.stdout.toString());}catch{return null;}}
 finally{r.stdout?.fill(0);r.stderr?.fill(0);}
}
export async function runOriginalCustodian(action,candidate){
 if(!['activate','reconcile'].includes(action))deny('action');
 const run=process.env.N88_DENIED_READ_RUN_ID,session=process.env.N88_DENIED_READ_SESSION_ID;
 if(path.resolve(process.cwd())!==path.resolve(original)||session!==custodianSession)deny('original_context');
 const card=await json(runtime+'queue/'+taskId+'.json');qualifyAuthority(card,{runId:run,candidateSha:candidate,sessionId:session});
 const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8',maxBuffer:2097152,stdio:['ignore','pipe','pipe']});
 if(git(['rev-parse','HEAD']).trim()!==candidate||path.resolve(card.worktreePath)!==path.resolve(root)||card.baseSha!=='08b8ab626180786f4f36255702f8384a42f06b07')deny('candidate');
 const sourcePaths=['transition-guards.mjs','committed-phase.mjs','activation-transition.mjs','original-custodian.mjs','runtime-phase.mjs','runtime-configuration.mjs','runtime-expectations.mjs','runtime-dependencies.mjs','manifest.json','shared-phase-binding.json'].map(p=>'drafts/n88-student-portal/activation/denied-read-20261023/'+p);
 sourcePaths.push('drafts/n88-student-portal/activation/read-service-20261023/inherited-custody.mjs','drafts/n88-student-portal/activation/read-service-20261023/history-mirror.mjs');
 for(const p of sourcePaths){if((await readFile(path.join(root,p),'utf8')).replaceAll('\r\n','\n')!==git(['show',candidate+':'+p]).replaceAll('\r\n','\n'))deny('committed_source');}
 const manifest=await json(path.join(directory,'manifest.json'));
 if(JSON.stringify(manifest)!==JSON.stringify(JSON.parse(git(['show','d27da1b34cb667be04d49efe354ee6ea811174ed:drafts/n88-student-portal/activation/denied-read-20261023/manifest.json']))))deny('pinned_manifest');
 for(const name of ['deno.json','deno.lock','import_map.json']){const p='drafts/n88-student-portal/activation/bundle/edge/'+name;if((await readFile(path.join(root,p),'utf8')).replaceAll('\r\n','\n')!==git(['show',card.baseSha+':'+p]).replaceAll('\r\n','\n'))deny('upload_config_preimage');}
 if(manifest.originalNative66Sha256!==priorSource||manifest.successorSha256!==successorSource||hash((await readFile(path.join(directory,'native66-successor.inactive.mjs'),'utf8')).replaceAll('\r\n','\n'))!==successorSource||hash((await readFile(path.join(root,'drafts/n88-student-portal/integrated-service.mjs'),'utf8')).replaceAll('\r\n','\n'))!==manifest.integratedSourceSha256)deny('qualified_source');
 for(const [p,h] of Object.entries(manifest.unchangedSourceHashes))if(hash((await readFile(path.join(root,p),'utf8')).replaceAll('\r\n','\n'))!==h)deny('unchanged_guard_source');
 const priorReceiptPath='tests/n88-read-service-20261023/history-correction-inherited-1593971e-7927-4c32-a307-e751d0b2c869.json';
 const priorBytes=git(['show',card.baseSha+':'+priorReceiptPath]),priorReceipt=JSON.parse(priorBytes);
 if((await readFile(path.join(root,priorReceiptPath),'utf8')).replaceAll('\r\n','\n')!==priorBytes.replaceAll('\r\n','\n')||priorReceipt.status!=='PASS'||priorReceipt.routineCount!==78||priorReceipt.old76Unchanged!==true||priorReceipt.priorHistoryUnchanged!==true||priorReceipt.sqlSha256!=='8e85df7c297b8c99bedd150a6fd28d3e9d8e1c9f0367ef465a7946edd970a96b'||priorReceipt.provider.source!==priorSource)deny('preserved_service_history');
 sourcePaths.push('tests/n88-denied-read-activation-20261023/runtime-dependencies.json');
 if((await readFile(path.join(root,sourcePaths.at(-1)),'utf8')).replaceAll('\r\n','\n')!==git(['show',candidate+':'+sourcePaths.at(-1)]).replaceAll('\r\n','\n'))deny('dependency_proof_bytes');
 const dependencyProof=await json(path.join(root,sourcePaths.at(-1)));
 const stamp={taskId,runId:run,sessionId:session,candidateSha:candidate,baseSha:card.baseSha,observedAt:new Date().toISOString(),source:successorSource,priorSource};
 const binding=await json(path.join(directory,'shared-phase-binding.json'));
 if(binding.taskId!==taskId||binding.baselineDigest!=='d1d4f974cc19ca49187f253766d90545a5002020c560ca1da64429e8e49a41af')deny('phase_binding');
 const runtimePhase=await loadRuntimePhase(binding),certificates=[runtimePhase.phase];
 const verifyCommittedPhase=async()=>{const fresh=await loadRuntimePhase(binding);assert.deepEqual(fresh,runtimePhase);};
 const verifyExclusivePhase=async()=>{
  const active=await json(runtime+'queue/'+taskId+'.json'),workflow=await json(runtime+'workflow-v5.json');qualifyAuthority(active,{runId:run,candidateSha:candidate,sessionId:session});
  const checkpoint=await json(active.attempt.checkpointPath);
  if(active.activationId!==workflow.controller.activationId||checkpoint.taskId!==taskId||checkpoint.runId!==run)deny('runner_identity');
  for(const name of ['integration','live-mutation']){const l=await json(runtime+'leases/'+name+'.json');if(l.taskId!==taskId||l.resource!==name||l.owner?.type!=='worker'||l.owner.token!==run||l.activationId!==active.activationId||l.owner.pid!==checkpoint.runnerPid||Date.parse(l.owner.createdAt)!==Date.parse(checkpoint.runnerCreatedAt))deny('exclusive_phase');}
 };
 await verifyExclusivePhase(); // no private/provider access before exact phase binding + leases
 const verifyIsolation=await createInheritedVerifier({phase,originalRoot:original,owned});await verifyIsolation();
 let expectations=null,wholeSnapshot=null;
 const load=async()=>{await verifyIsolation();const b=dpapi(await readFile(path.join(phase,'recovery.dpapi')),false);try{const state=JSON.parse(b.toString());const publicBytes=await readFile(path.join(root,'drafts/n44-push/activation/public-provider-config.json'));expectations=originalRuntimeExpectations(state,{ca:await readFile(path.join(root,'drafts/n88-student-portal/activation/ca/supabase-prod-ca-2021.crt'),'utf8'),publicConfig:JSON.parse(publicBytes.toString()),publicConfigBytesDigest:hash(publicBytes)});return state;}finally{b.fill(0);}};
 const save=async s=>{await verifyIsolation();const b=Buffer.from(JSON.stringify(s));try{await writeFile(path.join(phase,'recovery.dpapi'),dpapi(b,true));}finally{b.fill(0);}};
 const marker=path.join(phase,'denied-read-20261023-native-attempt.json');
 const expectedMap=await json(path.join(root,'drafts/n88-student-portal/activation/bundle/edge/import_map.json'));
 const withPublicWorkdir=async(kind,fn)=>{
  const dir=path.join(evidence,'owned-denied-'+kind+'-'+run+'.tmp');await mkdir(dir,{recursive:false});
  const owner={taskId,runId:run,candidateSha:candidate,purpose:kind};await writeFile(path.join(dir,'owner.json'),JSON.stringify(owner),{flag:'wx'});
  try{return await fn(dir);}finally{if(path.dirname(path.resolve(dir))!==path.resolve(evidence)||!path.basename(dir).startsWith('owned-denied-'))deny('cleanup_scope');assert.deepEqual(await json(path.join(dir,'owner.json')),owner);await rm(dir,{recursive:true});}
 };
 const readMetadata=async()=>{await verifyExclusivePhase();const raw=await official(['secrets','list','--project-ref',projectId,'--output','json']);return canonical((Array.isArray(raw)?raw:raw?.rows)?.map(r=>({name:r.name,digest:(r.value??r.digest)?.toLowerCase()})));};
 const readNative=async expected=>{
  await verifyExclusivePhase();const raw=await official(['functions','list','--project-ref',projectId,'--output','json']),found=(Array.isArray(raw)?raw:raw?.functions)?.filter(f=>f.slug==='n88-student-portal'||f.name==='n88-student-portal');
  if(found?.length!==1||found[0].status!=='ACTIVE'||found[0].verify_jwt!==false||!Number.isInteger(found[0].version))deny('native_metadata');
  let source=null;await withPublicWorkdir('download',async dir=>{
   await official(['functions','download','n88-student-portal','--project-ref',projectId,'--use-api','--workdir',dir,'--output','json']);
   let sources=0,maps=0;const visit=async d=>{for(const f of await readdir(d,{withFileTypes:true})){const p=path.join(d,f.name),s=await lstat(p);if(s.isSymbolicLink())deny('download_link');if(f.isDirectory())await visit(p);else if(f.name!=='owner.json'){const b=await readFile(p);if(/\.(mjs|js|ts)$/.test(f.name)&&[priorSource,successorSource].includes(hash(b))){source=hash(b);sources++;}if(f.name==='import_map.json'){assert.deepEqual(JSON.parse(b.toString()),expectedMap);maps++;}}}};await visit(dir);
   if(sources!==1||maps!==1||(expected&&source!==expected))deny('download_bytes');
  });
  return {status:found[0].status,version:found[0].version,verifyJwt:false,source,downloadedBytesExact:true,importMapExact:true,importMapDigest:hash(JSON.stringify(expectedMap)),observedAt:new Date().toISOString()};
 };
 const qualifyObservedMetadata=(rows,pin)=>{if(!expectations)deny('expected_before_comparison');if(wholeSnapshot)requireWholeTransitionEqual(wholeSnapshot,rows,pin);else wholeSnapshot=rows;return {...qualifyRuntimeConfiguration({current:rows,expectedRuntime:expectations.expected,n44ExpectedMap:runtimePhase.expectedMap,dependencyProof,expectedPin:pin}),runtimeProvenance:expectations.provenance,expectedBeforeComparison:true,n44Phase:runtimePhase.phase};};
 const ports={qualifyObservedMetadata,verifyCommittedPhase,verifyExclusivePhase,load,save,readMetadata,readNative,readNativeIdentity:()=>readNative(null),readQualifiedMetadata:async pin=>qualifyObservedMetadata(await readMetadata(),pin),uploadMarkerExists:async()=>{try{await lstat(marker);return true;}catch(e){if(e.code==='ENOENT')return false;throw e;}},reserveUpload:async r=>{await verifyIsolation();await writeFile(marker,JSON.stringify(r)+'\n',{flag:'wx'});},reservePin:async r=>{await verifyIsolation();await writeFile(path.join(phase,'denied-read-20261023-pin-attempt.json'),JSON.stringify(r)+'\n',{flag:'wx'});},
  uploadExactSuccessor:()=>withPublicWorkdir('upload',async dir=>{
   const bytes=Buffer.from((await readFile(path.join(directory,'native66-successor.inactive.mjs'),'utf8')).replaceAll('\r\n','\n'));if(hash(bytes)!==successorSource)deny('successor_bytes');
   const fdir=path.join(dir,'supabase/functions/n88-student-portal');await mkdir(fdir,{recursive:true});await writeFile(path.join(fdir,'index.mjs'),bytes,{flag:'wx'});
   for(const name of ['deno.json','deno.lock','import_map.json'])await writeFile(path.join(fdir,name),await readFile(path.join(root,'drafts/n88-student-portal/activation/bundle/edge',name)),{flag:'wx'});
   await writeFile(path.join(dir,'supabase/config.toml'),'project_id = "'+projectId+'"\n[functions.n88-student-portal]\nverify_jwt = false\nentrypoint = "./functions/n88-student-portal/index.mjs"\nimport_map = "./functions/n88-student-portal/import_map.json"\n',{flag:'wx'});
   await verifyExclusivePhase();await official(['functions','deploy','n88-student-portal','--project-ref',projectId,'--use-api','--no-verify-jwt','--workdir',dir,'--output','json']);
  }),setExactPublicPin:async()=>{
   await verifyIsolation();const p=path.join(phase,'denied-read-20261023-public-pin.env');
   try{await writeFile(p,'N88_SERVICE_SOURCE_SHA='+successorSource+'\n',{flag:'wx'});await verifyExclusivePhase();await official(['secrets','set','--project-ref',projectId,'--env-file',p]);}finally{await unlink(p).catch(e=>{if(e.code!=='ENOENT')throw e;});}
  }};
 if(action==='reconcile')await load();
 const outcome=action==='activate'?await runSuccessorTransition({stamp,certificates,ports}):await reconcileSuccessor({stamp,certificates,ports});
 outcome.catalogHistoryReference='tests/n88-read-service-20261023/history-correction-inherited-1593971e-7927-4c32-a307-e751d0b2c869.json';outcome.configurationPhaseBindings=binding;outcome.oldDeniedResourcesUntouched=true;
 await writeFile(path.join(evidence,action+'-'+run+'.json'),JSON.stringify(outcome,null,2)+'\n',{flag:'wx'});return outcome;
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){try{console.log(JSON.stringify(await runOriginalCustodian(process.argv[2],process.argv[3])));}catch(e){console.error(JSON.stringify({status:'BLOCKED',code:/^n88_[a-zA-Z0-9_]+$/.test(e.message)?e.message:'n88_denied_custodian_private_failure'}));process.exitCode=1;}}
