/** AI-authored. Explicit scoped custodian; no operation at import.
 * Raw keys/passwords stay in memory/DPAPI or protected transient CLI files.
 * CLI args/output never carry a password, verifier or secret value.
 */
import assert from 'node:assert/strict';
import {pilotCorrectionRestoreReady} from './activation/pilot-ui-correction-gate.mjs';
import {CORRECTION1430,correction1430Gate} from './activation/correction-1430-gate.mjs';
import {STATIC1522,static1522Gate} from './activation/static-1522-gate.mjs';
import {STUDENT_PENDING_STATIC,runStudentPendingStaticPhase} from './activation/static-student-pending-20261021-gate.mjs';
import {STUDENT_QUIET_STATIC,runStudentQuietStaticPhase} from './activation/static-student-quiet-return-20261021-gate.mjs';
import {STUDENT_REOPEN_STATIC,runStudentReopenStaticPhase} from './activation/static-student-reopen-20261021-gate.mjs';
import {STUDENT_SESSION_STATIC,runStudentSessionStaticPhase} from './activation/static-student-session-20261021-gate.mjs';
import {randomBytes,generateKeyPairSync,privateDecrypt,createPrivateKey,constants,pbkdf2Sync,createHmac,createHash} from 'node:crypto';
import {spawnSync,execFileSync} from 'node:child_process';
import {readFile,writeFile,mkdir,unlink,readdir,rmdir,rm} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {pathToFileURL,fileURLToPath} from 'node:url';
import path from 'node:path';
import {serverFirst} from './activation/server-first.mjs';
import {createRolloutGuard} from './rollout-guard.mjs';
import {randomUUID,createPublicKey} from 'node:crypto';
const project='xlrubcwjqktzzunrvuns',run='4ddd5df2-933f-4754-8d04-0d27be47bcff';
const root=process.cwd(),base=path.resolve('drafts/n88-student-portal/activation'),phase=path.join(base,'owned-custody-'+run+'.tmp');
const marker={run,project,phase,purpose:'N88 restricted service custody and immutable recovery'};
const cli='C:/Users/Abody/AppData/Local/npm-cache/_npx/0e23c24576954b26/node_modules/supabase/dist/supabase.js';
const fail=code=>{throw Error(code);};
export function deriveScram(password,salt=randomBytes(16),iterations=16384){
 const salted=pbkdf2Sync(password,salt,iterations,32,'sha256'),client=createHmac('sha256',salted).update('Client Key').digest();
 try{return `SCRAM-SHA-256$${iterations}:${salt.toString('base64')}$${createHash('sha256').update(client).digest('base64')}:${createHmac('sha256',salted).update('Server Key').digest('base64')}`;}
 finally{salted.fill(0);client.fill(0);}
}
function dpapi(bytes,protect){
 const code=`Add-Type -AssemblyName System.Security; $n88Memory=New-Object System.IO.MemoryStream; [Console]::OpenStandardInput().CopyTo($n88Memory); $n88Bytes=$n88Memory.ToArray(); $n88Protected=[System.Security.Cryptography.ProtectedData]::${protect?'Protect':'Unprotect'}($n88Bytes,$null,[System.Security.Cryptography.DataProtectionScope]::CurrentUser); [Array]::Clear($n88Bytes,0,$n88Bytes.Length); [Console]::Write([Convert]::ToBase64String($n88Protected)); [Array]::Clear($n88Protected,0,$n88Protected.Length)`;
 const r=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',code],{input:bytes,windowsHide:true,timeout:15000,maxBuffer:262144});
 if(r.status!==0)fail('n88_dpapi_unavailable');
 const value=Buffer.from(r.stdout.toString().trim(),'base64');r.stdout.fill(0);r.stderr.fill(0);return value;
}
async function owned(){assert.deepEqual(JSON.parse(await readFile(path.join(phase,'owner.json'),'utf8')),marker);}
async function load(){await owned();const b=dpapi(await readFile(path.join(phase,'recovery.dpapi')),false);try{return JSON.parse(b.toString());}finally{b.fill(0);}}
async function save(state){await owned();const b=Buffer.from(JSON.stringify(state));try{await writeFile(path.join(phase,'recovery.dpapi'),dpapi(b,true));}finally{b.fill(0);}}
async function official(args){
 const r=spawnSync(process.execPath,[cli,...args],{windowsHide:true,timeout:30000,maxBuffer:1048576});
 // Even failure diagnostics may contain provider SQL detail. Never emit them.
 const status=r.status,raw=r.stdout.toString();r.stdout.fill(0);r.stderr.fill(0);
 if(status!==0)fail('n88_official_cli_failed_'+(status??'timeout'));
 try{return JSON.parse(raw);}catch{return null;}
}
async function sqlFile(text){
 await owned();const file=path.join(phase,'owned-input.sql');
 try{await writeFile(file,text,{flag:'wx'});return await official(['db','query','--linked','--project-ref',project,'--file',file,'--output','json']);}
 finally{await unlink(file).catch(e=>{if(e.code!=='ENOENT')throw e;});}
}
async function execute(action,value){
 if(['--student-pending-static-owned-preflight','--student-pending-static-read-native-before','--student-pending-static-read-native-after','--student-pending-static-preflight','--student-pending-static-begin','--student-pending-static-complete'].includes(action)){
  const c=STUDENT_PENDING_STATIC,currentRun=process.env.N88_STUDENT_PENDING_RUN_ID;
  if(path.resolve(root)!==path.resolve(c.originalRoot))fail('n88_student_static_original_root');
  const taskRoot=fileURLToPath(new URL('../../',import.meta.url));
  if(path.resolve(taskRoot)!==path.resolve(c.taskRoot))fail('n88_student_static_task_root');
  const runtime='C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/';
  const json=async file=>JSON.parse((await readFile(file,'utf8')).replace(/^\uFEFF/,''));
  const card=await json(runtime+'queue/'+c.task+'.json'),config=await json(runtime+'workflow-v5.json'),lease=await json(runtime+'leases/integration.json');
  const files={'prior-carrier.mjs':'tests/n88-student-reopen-end-guidance-20261021/carrier.mjs','configuration-preimage.json':'tests/n88-student-reopen-end-guidance-20261021/cloudflare-after.json','style.css':'drafts/n88-student-portal/activation/bundle/private/styles/student-portal-login.css','student.mjs':'drafts/n88-student-portal/activation/bundle/private/assets/student.mjs'};
  const locate=name=>{
   if(name.startsWith('owned/')&&/^owned\/student-pending-static-[a-f0-9]{40}-(attempt|complete)\.json$/.test(name))return path.join(phase,name.slice(6));
   if(!/^[a-z-]+\.(mjs|json|css)$/.test(name))fail('n88_student_static_file');
   return path.join(taskRoot,files[name]||c.evidence+name);
  };
  return runStudentPendingStaticPhase(action.slice('--student-pending-static-'.length),{
   card,run:currentRun,activationId:config.controller.activationId,lease,
   read:async name=>{if(name.startsWith('owned/'))await owned();return readFile(locate(name));},
   writeExclusive:async(name,bytes)=>{if(!name.startsWith('owned/'))fail('n88_student_static_write');await owned();await writeFile(locate(name),bytes,{flag:'wx'});},
   load:async()=>{try{return await load();}catch(e){if(['ENOENT','EACCES','EPERM'].includes(e.code))fail('n88_student_static_original_custody_'+e.code.toLowerCase());throw e;}},save,
   readPublicPin:async()=>{
    const rows=await official(['secrets','list','--project-ref',project,'--output','json']),list=Array.isArray(rows)?rows:rows?.rows;
    const found=list?.filter(r=>r.name==='N88_SERVICE_SOURCE_SHA');if(found?.length!==1)fail('n88_student_static_pin_identity');return found[0].value?.toLowerCase();
   },
   readNative:async(when,native)=>{
    const evidence=path.join(taskRoot,c.evidence),temporary=path.join(evidence,'native-'+c.run+'-'+when+'.tmp');
    if(!['before','after'].includes(when)||path.dirname(temporary)!==path.resolve(evidence))fail('n88_student_static_native_path');
    await mkdir(temporary,{recursive:false});
    try{
     const listed=await official(['functions','list','--project-ref',project,'--output','json']);
     const functions=Array.isArray(listed)?listed:listed?.functions,found=functions?.filter(f=>f.slug==='n88-student-portal'||f.name==='n88-student-portal');
     if(found?.length!==1||!Number.isInteger(found[0].version))fail('n88_student_static_native_metadata');
     await official(['functions','download','n88-student-portal','--project-ref',project,'--use-api','--workdir',temporary,'--output','json']);
     const matches=[],digest=bytes=>createHash('sha256').update(bytes).digest('hex');
     const visit=async dir=>{for(const entry of await readdir(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())await visit(file);else if(/\.(mjs|js|ts)$/.test(entry.name)){const bytes=await readFile(file);if(digest(bytes)===native)matches.push(bytes);}}};
     await visit(temporary);if(matches.length!==1)fail('n88_student_static_native_source_mismatch');
     const filename=when==='before'?'provider-native.mjs':'provider-native-after.mjs';
     await writeFile(path.join(evidence,filename),matches[0],{flag:'wx'});
     return {nativeSource:native,nativeVersion:found[0].version,sourceExact:true,verifyJwt:found[0].verify_jwt};
    }finally{
     if(path.dirname(temporary)!==path.resolve(evidence)||!path.resolve(temporary).startsWith(path.resolve(taskRoot)+path.sep))fail('n88_student_static_native_cleanup_path');
     await rm(temporary,{recursive:true});
    }
   },
   verifyCandidate:async candidate=>{
    execFileSync('git',['merge-base','--is-ancestor',candidate,'HEAD'],{cwd:taskRoot,windowsHide:true});
    const proof=await json(path.join(taskRoot,c.evidence+'qualification.json'));
    const paths=[...Object.keys(proof.changedSourceHashes),c.evidence+'carrier.mjs',c.evidence+'ui.json',c.evidence+'bundle-preparation.json',c.evidence+'transport.json',c.evidence+'qualification.json',files['prior-carrier.mjs'],files['configuration-preimage.json']];
    for(const file of paths){
     const expected=execFileSync('git',['show',candidate+':'+file],{cwd:taskRoot,maxBuffer:2097152}).toString().replaceAll('\r\n','\n');
     if((await readFile(path.join(taskRoot,file),'utf8')).replaceAll('\r\n','\n')!==expected)fail('n88_student_static_source_drift');
    }
   }
  });
 }
 if(['--student-quiet-static-owned-preflight','--student-quiet-static-read-native-before','--student-quiet-static-read-native-after','--student-quiet-static-preflight','--student-quiet-static-begin','--student-quiet-static-complete'].includes(action)){
  const c=STUDENT_QUIET_STATIC,currentRun=process.env.N88_STUDENT_QUIET_RUN_ID;
  if(path.resolve(root)!==path.resolve(c.originalRoot))fail('n88_student_static_original_root');
  const taskRoot=fileURLToPath(new URL('../../',import.meta.url));
  if(path.resolve(taskRoot)!==path.resolve(c.taskRoot))fail('n88_student_static_task_root');
  const runtime='C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/';
  const json=async file=>JSON.parse((await readFile(file,'utf8')).replace(/^\uFEFF/,''));
  const card=await json(runtime+'queue/'+c.task+'.json'),config=await json(runtime+'workflow-v5.json'),lease=await json(runtime+'leases/integration.json');
  const files={'prior-carrier.mjs':'tests/n88-student-pending-return-finite-diagnostic-20261021/carrier.mjs','configuration-preimage.json':'tests/n88-student-pending-return-finite-diagnostic-20261021/cloudflare-after.json','style.css':'drafts/n88-student-portal/activation/bundle/private/styles/student-portal-login.css','student.mjs':'drafts/n88-student-portal/activation/bundle/private/assets/student.mjs'};
  const locate=name=>{
   if(name.startsWith('owned/')&&/^owned\/student-quiet-static-[a-f0-9]{40}-(attempt|complete)\.json$/.test(name))return path.join(phase,name.slice(6));
   if(!/^[a-z-]+\.(mjs|json|css)$/.test(name))fail('n88_student_static_file');
   return path.join(taskRoot,files[name]||c.evidence+name);
  };
  return runStudentQuietStaticPhase(action.slice('--student-quiet-static-'.length),{
   card,run:currentRun,activationId:config.controller.activationId,lease,
   read:async name=>{if(name.startsWith('owned/'))await owned();return readFile(locate(name));},
   writeExclusive:async(name,bytes)=>{if(!name.startsWith('owned/'))fail('n88_student_static_write');await owned();await writeFile(locate(name),bytes,{flag:'wx'});},
   load:async()=>{try{return await load();}catch(e){if(['ENOENT','EACCES','EPERM'].includes(e.code))fail('n88_student_static_original_custody_'+e.code.toLowerCase());throw e;}},save,
   readPublicPin:async()=>{
    const rows=await official(['secrets','list','--project-ref',project,'--output','json']),list=Array.isArray(rows)?rows:rows?.rows;
    const found=list?.filter(r=>r.name==='N88_SERVICE_SOURCE_SHA');if(found?.length!==1)fail('n88_student_static_pin_identity');return found[0].value?.toLowerCase();
   },
   readNative:async(when,native)=>{
    const evidence=path.join(taskRoot,c.evidence),temporary=path.join(evidence,'native-'+c.run+'-'+when+'.tmp');
    if(!['before','after'].includes(when)||path.dirname(temporary)!==path.resolve(evidence))fail('n88_student_static_native_path');
    await mkdir(temporary,{recursive:false});
    try{
     const listed=await official(['functions','list','--project-ref',project,'--output','json']);
     const functions=Array.isArray(listed)?listed:listed?.functions,found=functions?.filter(f=>f.slug==='n88-student-portal'||f.name==='n88-student-portal');
     if(found?.length!==1||!Number.isInteger(found[0].version))fail('n88_student_static_native_metadata');
     await official(['functions','download','n88-student-portal','--project-ref',project,'--use-api','--workdir',temporary,'--output','json']);
     const matches=[],digest=bytes=>createHash('sha256').update(bytes).digest('hex');
     const visit=async dir=>{for(const entry of await readdir(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())await visit(file);else if(/\.(mjs|js|ts)$/.test(entry.name)){const bytes=await readFile(file);if(digest(bytes)===native)matches.push(bytes);}}};
     await visit(temporary);if(matches.length!==1)fail('n88_student_static_native_source_mismatch');
     const filename=when==='before'?'provider-native.mjs':'provider-native-after.mjs';
     await writeFile(path.join(evidence,filename),matches[0],{flag:'wx'});
     return {nativeSource:native,nativeVersion:found[0].version,sourceExact:true,verifyJwt:found[0].verify_jwt};
    }finally{
     if(path.dirname(temporary)!==path.resolve(evidence)||!path.resolve(temporary).startsWith(path.resolve(taskRoot)+path.sep))fail('n88_student_static_native_cleanup_path');
     await rm(temporary,{recursive:true});
    }
   },
   verifyCandidate:async candidate=>{
    execFileSync('git',['merge-base','--is-ancestor',candidate,'HEAD'],{cwd:taskRoot,windowsHide:true});
    const proof=await json(path.join(taskRoot,c.evidence+'qualification.json'));
    const paths=[...Object.keys(proof.changedSourceHashes),c.evidence+'carrier.mjs',c.evidence+'ui.json',c.evidence+'bundle-preparation.json',c.evidence+'qualification.json',files['prior-carrier.mjs'],files['configuration-preimage.json']];
    for(const file of paths){
     const expected=execFileSync('git',['show',candidate+':'+file],{cwd:taskRoot,maxBuffer:2097152}).toString().replaceAll('\r\n','\n');
     if((await readFile(path.join(taskRoot,file),'utf8')).replaceAll('\r\n','\n')!==expected)fail('n88_student_static_source_drift');
    }
   }
  });
 }
 if(['--student-reopen-static-owned-preflight','--student-reopen-static-read-native-before','--student-reopen-static-read-native-after','--student-reopen-static-preflight','--student-reopen-static-begin','--student-reopen-static-complete'].includes(action)){
  const c=STUDENT_REOPEN_STATIC,currentRun=process.env.N88_STUDENT_REOPEN_RUN_ID;
  if(path.resolve(root)!==path.resolve(c.originalRoot))fail('n88_student_static_original_root');
  const taskRoot=fileURLToPath(new URL('../../',import.meta.url));
  if(path.resolve(taskRoot)!==path.resolve(c.taskRoot))fail('n88_student_static_task_root');
  const runtime='C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/';
  const json=async file=>JSON.parse((await readFile(file,'utf8')).replace(/^\uFEFF/,''));
  const card=await json(runtime+'queue/'+c.task+'.json'),config=await json(runtime+'workflow-v5.json'),lease=await json(runtime+'leases/integration.json');
  const files={'prior-carrier.mjs':'tests/n88-student-session-quiet-progress-20261021/carrier.mjs','configuration-preimage.json':'tests/n88-student-session-quiet-progress-20261021/cloudflare-after.json','student.mjs':'drafts/n88-student-portal/activation/bundle/private/assets/student.mjs'};
  const locate=name=>{
   if(name.startsWith('owned/')&&/^owned\/student-reopen-static-[a-f0-9]{40}-(attempt|complete)\.json$/.test(name))return path.join(phase,name.slice(6));
   if(!/^[a-z-]+\.(mjs|json)$/.test(name))fail('n88_student_static_file');
   return path.join(taskRoot,files[name]||c.evidence+name);
  };
  return runStudentReopenStaticPhase(action.slice('--student-reopen-static-'.length),{
   card,run:currentRun,activationId:config.controller.activationId,lease,
   read:async name=>{if(name.startsWith('owned/'))await owned();return readFile(locate(name));},
   writeExclusive:async(name,bytes)=>{if(!name.startsWith('owned/'))fail('n88_student_static_write');await owned();await writeFile(locate(name),bytes,{flag:'wx'});},
   load:async()=>{try{return await load();}catch(e){if(['ENOENT','EACCES','EPERM'].includes(e.code))fail('n88_student_static_original_custody_'+e.code.toLowerCase());throw e;}},save,
   readPublicPin:async()=>{
    const rows=await official(['secrets','list','--project-ref',project,'--output','json']),list=Array.isArray(rows)?rows:rows?.rows;
    const found=list?.filter(r=>r.name==='N88_SERVICE_SOURCE_SHA');if(found?.length!==1)fail('n88_student_static_pin_identity');return found[0].value?.toLowerCase();
   },
   readNative:async(when,native)=>{
    const evidence=path.join(taskRoot,c.evidence),temporary=path.join(evidence,'native-'+c.run+'-'+when+'.tmp');
    if(!['before','after'].includes(when)||path.dirname(temporary)!==path.resolve(evidence))fail('n88_student_static_native_path');
    await mkdir(temporary,{recursive:false});
    try{
     const listed=await official(['functions','list','--project-ref',project,'--output','json']);
     const functions=Array.isArray(listed)?listed:listed?.functions,found=functions?.filter(f=>f.slug==='n88-student-portal'||f.name==='n88-student-portal');
     if(found?.length!==1||!Number.isInteger(found[0].version))fail('n88_student_static_native_metadata');
     await official(['functions','download','n88-student-portal','--project-ref',project,'--use-api','--workdir',temporary,'--output','json']);
     const matches=[],digest=bytes=>createHash('sha256').update(bytes).digest('hex');
     const visit=async dir=>{for(const entry of await readdir(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())await visit(file);else if(/\.(mjs|js|ts)$/.test(entry.name)){const bytes=await readFile(file);if(digest(bytes)===native)matches.push(bytes);}}};
     await visit(temporary);if(matches.length!==1)fail('n88_student_static_native_source_mismatch');
     const filename=when==='before'?'provider-native.mjs':'provider-native-after.mjs';
     await writeFile(path.join(evidence,filename),matches[0],{flag:'wx'});
     return {nativeSource:native,nativeVersion:found[0].version,sourceExact:true,verifyJwt:found[0].verify_jwt};
    }finally{
     if(path.dirname(temporary)!==path.resolve(evidence)||!path.resolve(temporary).startsWith(path.resolve(taskRoot)+path.sep))fail('n88_student_static_native_cleanup_path');
     await rm(temporary,{recursive:true});
    }
   },
   verifyCandidate:async candidate=>{
    execFileSync('git',['merge-base','--is-ancestor',candidate,'HEAD'],{cwd:taskRoot,windowsHide:true});
    const proof=await json(path.join(taskRoot,c.evidence+'qualification.json'));
    const paths=[...Object.keys(proof.changedSourceHashes),c.evidence+'carrier.mjs',c.evidence+'ui-student.json',c.evidence+'ui-teacher.json',c.evidence+'ui-additional.json',c.evidence+'ui-cooldown.json',c.evidence+'transport.json',c.evidence+'qualification.json',files['prior-carrier.mjs'],files['configuration-preimage.json']];
    for(const file of paths){
     const expected=execFileSync('git',['show',candidate+':'+file],{cwd:taskRoot,maxBuffer:2097152}).toString().replaceAll('\r\n','\n');
     if((await readFile(path.join(taskRoot,file),'utf8')).replaceAll('\r\n','\n')!==expected)fail('n88_student_static_source_drift');
    }
   }
  });
 }
 if(['--student-session-static-owned-preflight','--student-session-static-read-native-before','--student-session-static-read-native-after','--student-session-static-preflight','--student-session-static-begin','--student-session-static-complete'].includes(action)){
  const c=STUDENT_SESSION_STATIC,currentRun=process.env.N88_STUDENT_SESSION_RUN_ID;
  if(path.resolve(root)!==path.resolve(c.originalRoot))fail('n88_student_static_original_root');
  const taskRoot=fileURLToPath(new URL('../../',import.meta.url));
  if(path.resolve(taskRoot)!==path.resolve(c.taskRoot))fail('n88_student_static_task_root');
  const runtime='C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/';
  const json=async file=>JSON.parse((await readFile(file,'utf8')).replace(/^\uFEFF/,''));
  const card=await json(runtime+'queue/'+c.task+'.json'),config=await json(runtime+'workflow-v5.json'),lease=await json(runtime+'leases/integration.json');
  const files={'prior-carrier.mjs':'tests/n88-region-response-20261020/carrier.mjs','configuration-preimage.json':'tests/n88-region-response-20261020/provider-preflight.json','student.mjs':'drafts/n88-student-portal/activation/bundle/private/assets/student.mjs'};
  const locate=name=>{
   if(name.startsWith('owned/')&&/^owned\/student-session-static-[a-f0-9]{40}-(attempt|complete)\.json$/.test(name))return path.join(phase,name.slice(6));
   if(!/^[a-z-]+\.(mjs|json)$/.test(name))fail('n88_student_static_file');
   return path.join(taskRoot,files[name]||c.evidence+name);
  };
  return runStudentSessionStaticPhase(action.slice('--student-session-static-'.length),{
   card,run:currentRun,activationId:config.controller.activationId,lease,
   read:async name=>{if(name.startsWith('owned/'))await owned();return readFile(locate(name));},
   writeExclusive:async(name,bytes)=>{if(!name.startsWith('owned/'))fail('n88_student_static_write');await owned();await writeFile(locate(name),bytes,{flag:'wx'});},
   load:async()=>{try{return await load();}catch(e){if(['ENOENT','EACCES','EPERM'].includes(e.code))fail('n88_student_static_original_custody_'+e.code.toLowerCase());throw e;}},save,
   readPublicPin:async()=>{
    const rows=await official(['secrets','list','--project-ref',project,'--output','json']),list=Array.isArray(rows)?rows:rows?.rows;
    const found=list?.filter(r=>r.name==='N88_SERVICE_SOURCE_SHA');if(found?.length!==1)fail('n88_student_static_pin_identity');return found[0].value?.toLowerCase();
   },
   readNative:async(when,native)=>{
    const evidence=path.join(taskRoot,c.evidence),temporary=path.join(evidence,'native-'+c.run+'-'+when+'.tmp');
    if(!['before','after'].includes(when)||path.dirname(temporary)!==path.resolve(evidence))fail('n88_student_static_native_path');
    await mkdir(temporary,{recursive:false});
    try{
     const listed=await official(['functions','list','--project-ref',project,'--output','json']);
     const functions=Array.isArray(listed)?listed:listed?.functions,found=functions?.filter(f=>f.slug==='n88-student-portal'||f.name==='n88-student-portal');
     if(found?.length!==1||!Number.isInteger(found[0].version))fail('n88_student_static_native_metadata');
     await official(['functions','download','n88-student-portal','--project-ref',project,'--use-api','--workdir',temporary,'--output','json']);
     const matches=[],digest=bytes=>createHash('sha256').update(bytes).digest('hex');
     const visit=async dir=>{for(const entry of await readdir(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())await visit(file);else if(/\.(mjs|js|ts)$/.test(entry.name)){const bytes=await readFile(file);if(digest(bytes)===native)matches.push(bytes);}}};
     await visit(temporary);if(matches.length!==1)fail('n88_student_static_native_source_mismatch');
     const filename=when==='before'?'provider-native.mjs':'provider-native-after.mjs';
     await writeFile(path.join(evidence,filename),matches[0],{flag:'wx'});
     return {nativeSource:native,nativeVersion:found[0].version,sourceExact:true,verifyJwt:found[0].verify_jwt};
    }finally{
     if(path.dirname(temporary)!==path.resolve(evidence)||!path.resolve(temporary).startsWith(path.resolve(taskRoot)+path.sep))fail('n88_student_static_native_cleanup_path');
     await rm(temporary,{recursive:true});
    }
   },
   verifyCandidate:async candidate=>{
    execFileSync('git',['merge-base','--is-ancestor',candidate,'HEAD'],{cwd:taskRoot,windowsHide:true});
    const proof=await json(path.join(taskRoot,c.evidence+'qualification.json'));
    const paths=[...Object.keys(proof.changedSourceHashes),c.evidence+'carrier.mjs',c.evidence+'ui.json',c.evidence+'ui-extra.json',c.evidence+'qualification.json',files['prior-carrier.mjs'],files['configuration-preimage.json']];
    for(const file of paths){
     const expected=execFileSync('git',['show',candidate+':'+file],{cwd:taskRoot,maxBuffer:2097152}).toString().replaceAll('\r\n','\n');
     if((await readFile(path.join(taskRoot,file),'utf8')).replaceAll('\r\n','\n')!==expected)fail('n88_student_static_source_drift');
    }
   }
  });
 }
 if(['--static1522-preflight','--static1522-begin','--static1522-complete'].includes(action)){
  const c=STATIC1522,currentRun=process.env.N88_STATIC1522_RUN_ID;
  if(path.resolve(root)!==path.resolve(c.root))fail('n88_static1522_original_root');
  const q=JSON.parse(await readFile('C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/'+c.task+'.json','utf8')),review=static1522Gate(q,currentRun);
  const taskRoot=fileURLToPath(new URL('../../',import.meta.url)),local=p=>path.join(taskRoot,p),digest=x=>createHash('sha256').update(x).digest('hex');
  for(const [p,h]of Object.entries(review.sourcePins)){
   const bytes=(await readFile(local(p),'utf8')).replaceAll('\r\n','\n');
   if(digest(bytes)!==h||bytes!==execFileSync('git',['show',c.candidate+':'+p],{cwd:taskRoot,encoding:'utf8',maxBuffer:1048576}).replaceAll('\r\n','\n'))fail('n88_static1522_source_drift');
  }
  for(const [p,h]of Object.entries(review.packageOutputs)){
   const file='drafts/n88-student-portal/activation/bundle/'+p,bytes=await readFile(local(file));
   if(digest(bytes)!==h||!bytes.equals(execFileSync('git',['show',c.candidate+':'+file],{cwd:taskRoot,maxBuffer:8388608})))fail('n88_static1522_package_drift');
  }
  if(digest((await readFile(local('tests/n88-initial-continuity-1522-20261020/qualification.json'),'utf8')).replaceAll('\r\n','\n'))!==review.qualificationSha256)fail('n88_static1522_qualification_drift');
  const state=await load();if(state.loginDisarmed||state.directAuthRefused||!state.directVerified||state.directSource!==c.unchangedNative)fail('n88_static1522_owned_preimage');
  const rows=await official(['secrets','list','--project-ref',project,'--output','json']),list=Array.isArray(rows)?rows:rows?.rows;
  if(list?.filter(r=>r.name==='N88_SERVICE_SOURCE_SHA').length!==1||list.find(r=>r.name==='N88_SERVICE_SOURCE_SHA').value?.toLowerCase()!==digest(c.unchangedNative))fail('n88_static1522_pin_drift');
  const last=state.carrierCorrections?.at(-1);if(!last||last.source!==c.priorCarrier)fail('n88_static1522_carrier_history');
  const attempt=path.join(phase,'static1522-'+c.candidate+'-attempt.json'),complete=path.join(phase,'static1522-'+c.candidate+'-complete.json');
  const stamp={taskId:c.task,runId:currentRun,preparedCandidate:c.candidate,source:c.carrier,prior:c.priorCarrier,native:c.unchangedNative};
  if(action==='--static1522-preflight'){try{await readFile(attempt);fail('n88_static1522_attempt_consumed');}catch(e){if(e.code!=='ENOENT')throw e;}return {status:'PASS',originalOwner:true,nativePinUnchanged:true,historyPreimage:true,providerWrites:0};}
  const receipt=async name=>JSON.parse(await readFile(local('tests/n88-static-pending-delivery-20261020/'+name+'.json'),'utf8'));
  if(action==='--static1522-begin'){
   const r=await receipt('provider-preflight');if(r.source!==c.priorCarrier||!r.configurationVerified||r.native!==c.unchangedNative)fail('n88_static1522_provider_preimage');
   await writeFile(attempt,JSON.stringify(stamp)+'\n',{flag:'wx'});return {status:'PASS',attemptReserved:true};
  }
  assert.deepEqual(JSON.parse(await readFile(attempt,'utf8')),stamp);
  const r=await receipt('carrier-readback');if(r.source!==c.carrier||!r.sourceExact||!r.configurationUnchanged||!r.servedAssetsExact||r.native!==c.unchangedNative)fail('n88_static1522_readback');
  await writeFile(complete,JSON.stringify({...stamp,version:r.version})+'\n',{flag:'wx'});
  state.carrierCorrections=[...state.carrierCorrections,{...stamp,version:r.version}];await save(state);return {status:'PASS',historyAppended:true,nativePinUnchanged:true};
 }
 if(['--1430-preflight','--1430-begin-service','--1430-pin-service','--1430-begin-carrier','--1430-complete-carrier'].includes(action)){
  const c=CORRECTION1430,currentRun=process.env.N88_1430_RUN_ID;
  if(path.resolve(root)!==path.resolve('C:/Users/Abody/Projects/RakeezX/.worktrees/continuous-n88-official-student-portal-activation-20261018'))fail('n88_1430_original_root');
  const q=JSON.parse(await readFile('C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/'+c.task+'.json','utf8')),review=correction1430Gate(q,currentRun);
  const taskRoot=fileURLToPath(new URL('../../',import.meta.url)),local=rel=>path.join(taskRoot,rel),digest=x=>createHash('sha256').update(x).digest('hex');
  execFileSync('git',['merge-base','--is-ancestor',c.candidate,'HEAD'],{cwd:taskRoot,windowsHide:true});
  for(const [p,h]of Object.entries(review.sourcePins))if(digest((await readFile(local(p),'utf8')).replaceAll('\r\n','\n'))!==h)fail('n88_1430_source_drift');
  for(const [p,h]of Object.entries(review.packageOutputs))if(digest(await readFile(local('drafts/n88-student-portal/activation/bundle/'+p)))!==h)fail('n88_1430_package_drift');
  if(digest((await readFile(local('tests/n88-actual-1430-20261020/conclusion.json'),'utf8')).replaceAll('\r\n','\n'))!==review.localConclusionSha256)fail('n88_1430_local_conclusion_drift');
  const state=await load();if(state.loginDisarmed||state.directAuthRefused||!state.directVerified||![c.priorEdge,c.edge].includes(state.directSource))fail('n88_1430_owned_preimage');
  const markerFor=kind=>path.join(phase,'incident-1430-'+c.preparedRun+'-'+kind+'-attempt.json');
  const receipt=async name=>JSON.parse(await readFile(local('tests/n88-actual-1430-20261020/'+name+'.json'),'utf8'));
  const stamp={taskId:c.task,preparedRunId:c.preparedRun,runId:currentRun,candidateSha:c.candidate,edge:c.edge,carrier:c.carrier};
  const pin=async()=>{const rows=await official(['secrets','list','--project-ref',project,'--output','json']),list=Array.isArray(rows)?rows:rows?.rows;const found=list?.filter(r=>r.name==='N88_SERVICE_SOURCE_SHA');if(found?.length!==1)fail('n88_1430_pin_identity');return found[0].value?.toLowerCase();};
  if(action==='--1430-preflight'){
   if(state.directSource!==c.priorEdge||await pin()!==digest(c.priorEdge))fail('n88_1430_provider_preimage');
   return {status:'PASS',originalOwnedState:true,priorSourceMatches:true,readinessReplayed:false,providerWrites:0};
  }
  if(action==='--1430-begin-service'){
   const r=await receipt('provider-preflight');if(state.directSource!==c.priorEdge||r.edge!==c.priorEdge||r.nativeVersion!==51||r.carrier!==c.priorCarrier||!r.configurationVerified||await pin()!==digest(c.priorEdge))fail('n88_1430_native_preimage');
   await writeFile(markerFor('service'),JSON.stringify(stamp)+'\n',{flag:'wx'});return {status:'PASS',serviceAttemptReserved:true};
  }
  if(action==='--1430-pin-service'){
   assert.deepEqual(JSON.parse(await readFile(markerFor('service'),'utf8')),stamp);
   const r=await receipt('native-upload');if(r.edge!==c.edge||r.sourceExact!==true||r.verifyJwt!==false||r.version!==52)fail('n88_1430_native_readback');
   if(state.directSource!==c.priorEdge||await pin()!==digest(c.priorEdge))fail('n88_1430_pin_preimage');
   await writeFile(markerFor('pin'),JSON.stringify(stamp)+'\n',{flag:'wx'});
   const file=path.join(phase,'owned-1430-source.env');try{await writeFile(file,'N88_SERVICE_SOURCE_SHA='+c.edge+'\n',{flag:'wx'});await official(['secrets','set','--project-ref',project,'--env-file',file]);}finally{await unlink(file).catch(e=>{if(e.code!=='ENOENT')throw e;});}
   if(await pin()!==digest(c.edge))fail('n88_1430_pin_readback');
   state.sourceCorrections=[...(state.sourceCorrections||[]),{...stamp,prior:c.priorEdge,source:c.edge,nativeVersion:r.version}];state.directSource=c.edge;await save(state);return {status:'PASS',sourcePinReadback:true,source:c.edge,keysRolesSqlAuthUnchanged:true};
  }
  if(action==='--1430-begin-carrier'){
   const r=await receipt('provider-preflight');if(state.directSource!==c.edge||await pin()!==digest(c.edge)||r.carrier!==c.priorCarrier||!r.configurationVerified)fail('n88_1430_carrier_preimage');
   await writeFile(markerFor('carrier'),JSON.stringify(stamp)+'\n',{flag:'wx'});return {status:'PASS',carrierAttemptReserved:true};
  }
  assert.deepEqual(JSON.parse(await readFile(markerFor('carrier'),'utf8')),stamp);const r=await receipt('carrier-readback');
  if(r.source!==c.carrier||!r.sourceExact||!r.configurationUnchanged||!r.servedAssetsExact||state.directSource!==c.edge)fail('n88_1430_carrier_readback');
  await writeFile(markerFor('carrier-complete'),JSON.stringify({...stamp,version:r.version})+'\n',{flag:'wx'});state.carrierCorrections=[...(state.carrierCorrections||[]),{...stamp,prior:c.priorCarrier,source:c.carrier,version:r.version}];await save(state);return {status:'PASS',carrierHistoryAppended:true};
 }
 if(['--1336-source-preflight','--1336-pin-qualified-source'].includes(action)){
  const incidentRun='63d4981f-2d89-4240-acc3-26ea973b4f79',taskId='continuous-n88-hosted-failure-after-deadline-fix-20261020';
  const prior='420a57e65cc242652f266693c5280f9b112791cdeb556910f90796c39d5b0253',source='2d11d053328fdfb70a188d1c9db80b174e2ed27ccb0f5c009a1d12b1370320ea';
  if(path.resolve(root)!==path.resolve('C:/Users/Abody/Projects/RakeezX/.worktrees/continuous-n88-official-student-portal-activation-20261018')||process.env.N88_1336_RUN_ID!==incidentRun)fail('n88_1336_original_context_required');
  const card=JSON.parse(await readFile('C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/'+taskId+'.json','utf8'));
  if(card.id!==taskId||card.sessionId!=='01a14fc3-b292-7390-9952-8549a286c80f'||card.attempt?.runId!==incidentRun||card.liveAuthorizationRef!=='PO-20261020-N88-ACTUAL-HOSTED-FAILURE-EXACT-CORRECTION')fail('n88_1336_authority_mismatch');
  const manifest=JSON.parse(await readFile(new URL('./activation/manifest.json',import.meta.url),'utf8'));
  if(manifest.hosted1336?.source!==source||manifest.hosted1336?.priorSource!==prior||manifest.hosted1336?.privateAssetsChanged!==false)fail('n88_1336_source_identity');
  const state=await load();if(state.directSource!==prior||state.loginDisarmed||state.directAuthRefused||!state.directVerified)fail('n88_1336_owned_preimage_mismatch');
  const rows=await official(['secrets','list','--project-ref',project,'--output','json']),entries=Array.isArray(rows)?rows:rows?.rows;
  if(!Array.isArray(entries)||entries.filter(r=>r.name==='N88_SERVICE_SOURCE_SHA').length!==1||entries.find(r=>r.name==='N88_SERVICE_SOURCE_SHA').value?.toLowerCase()!==createHash('sha256').update(prior).digest('hex'))fail('n88_1336_provider_preimage_mismatch');
  if(action==='--1336-source-preflight')return {status:'PASS',originalOwnedState:true,sourcePreimageMatches:true,providerWrites:0,readinessReplayed:false};
  const receipt=JSON.parse(await readFile(new URL('./activation/service-native-1336.json',import.meta.url),'utf8'));
  if(receipt.projectId!==project||receipt.functionName!=='n88-student-portal'||receipt.sourceSha256!==source||receipt.sourceExact!==true||receipt.version!==50||receipt.verifyJwt!==false)fail('n88_1336_native_source_missing');
  await writeFile(path.join(phase,'incident-1336-source-pin-once.json'),JSON.stringify({taskId,runId:incidentRun,prior,source,nativeVersion:receipt.version})+'\n',{flag:'wx'});
  const file=path.join(phase,'owned-env.tmp');
  try{await writeFile(file,'N88_SERVICE_SOURCE_SHA='+source+'\n',{flag:'wx'});await official(['secrets','set','--project-ref',project,'--env-file',file]);}finally{await unlink(file).catch(e=>{if(e.code!=='ENOENT')throw e;});}
  const after=await official(['secrets','list','--project-ref',project,'--output','json']),list=Array.isArray(after)?after:after?.rows;
  if(!Array.isArray(list)||list.find(r=>r.name==='N88_SERVICE_SOURCE_SHA').value?.toLowerCase()!==createHash('sha256').update(source).digest('hex'))fail('n88_1336_pin_readback_mismatch');
  state.sourceCorrections=[...(state.sourceCorrections||[]),{runId:incidentRun,prior,source,nativeVersion:receipt.version}];state.directSource=source;await save(state);
  return {status:'PASS',source,nativeVersion:receipt.version,sourcePinReadback:true,readinessReplayed:false,keysRolesSqlAuthFixturesUnchanged:true};
 }
 if(action==='--1837-pin-qualified-source'){
  const incidentRun='0f958d3a-36e2-4a23-9c15-80f691f15ddc',taskId='continuous-n88-actual-teacher-and-brand-entry-20261019';
  if(path.resolve(root)!==path.resolve('C:/Users/Abody/Projects/RakeezX/.worktrees/continuous-n88-official-student-portal-activation-20261018')||process.env.N88_1837_RUN_ID!==incidentRun)fail('n88_1837_original_context_required');
  const card=JSON.parse(await readFile('C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/'+taskId+'.json','utf8'));
  if(card.id!==taskId||card.sessionId!=='01a14fc3-b292-7390-9952-8549a286c80f'||card.liveAuthorizationRef!=='PO-CURRENT-1837-N88-ACTUAL-FAILURE')fail('n88_1837_authority_mismatch');
  const receipt=JSON.parse(await readFile(new URL('./activation/service-native-1837.json',import.meta.url),'utf8'));
  const source='420a57e65cc242652f266693c5280f9b112791cdeb556910f90796c39d5b0253',prior='0bc4445ba591ead9e5fc9ea10cb96f0514e3581b3430d9e1e0e70630e558623c';
  if(receipt.projectId!==project||receipt.functionName!=='n88-student-portal'||receipt.sourceSha256!==source||receipt.sourceExact!==true||receipt.version<=47)fail('n88_1837_native_source_missing');
  const state=await load();if(state.directSource!==prior||state.loginDisarmed||state.directAuthRefused||!state.directVerified)fail('n88_1837_owned_preimage_mismatch');
  const rows=await official(['secrets','list','--project-ref',project,'--output','json']),entries=Array.isArray(rows)?rows:rows?.rows;
  if(!Array.isArray(entries)||entries.filter(r=>r.name==='N88_SERVICE_SOURCE_SHA').length!==1||entries.find(r=>r.name==='N88_SERVICE_SOURCE_SHA').value?.toLowerCase()!==createHash('sha256').update(prior).digest('hex'))fail('n88_1837_provider_preimage_mismatch');
  await writeFile(path.join(phase,'incident-1837-source-pin-once.json'),JSON.stringify({taskId,runId:incidentRun,prior,source,nativeVersion:receipt.version})+'\n',{flag:'wx'});
  const file=path.join(phase,'owned-env.tmp');
  try{await writeFile(file,'N88_SERVICE_SOURCE_SHA='+source+'\n',{flag:'wx'});await official(['secrets','set','--project-ref',project,'--env-file',file]);}finally{await unlink(file).catch(e=>{if(e.code!=='ENOENT')throw e;});}
  const after=await official(['secrets','list','--project-ref',project,'--output','json']),list=Array.isArray(after)?after:after?.rows;
  if(!Array.isArray(list)||list.find(r=>r.name==='N88_SERVICE_SOURCE_SHA').value?.toLowerCase()!==createHash('sha256').update(source).digest('hex'))fail('n88_1837_pin_readback_mismatch');
  state.sourceCorrections=[...(state.sourceCorrections||[]),{runId:incidentRun,prior,source,nativeVersion:receipt.version}];state.directSource=source;await save(state);
  return {status:'PASS',source,nativeVersion:receipt.version,sourcePinReadback:true,readinessReplayed:false,keysRolesSqlAuthFixturesUnchanged:true};
 }
 if(action==='--discard-empty-preparation'){
  // Only the exact fresh directory created by this run's failed module load;
  // no secrets/marker existed, and no recursive or process cleanup is used.
  const failure=JSON.parse(await readFile(path.join(base,'fresh-directory-initial-failure.json'),'utf8'));
  if(failure.runId!==run||failure.phase!==phase||failure.cause!=='PowerShell.Security module could not be loaded before Set-Acl execution')fail('n88_empty_preparation_ownership_missing');
  if((await readdir(phase)).length!==0)fail('n88_empty_preparation_not_empty');
  await rmdir(phase);return {emptyOwnedPreparationRemoved:true,recursiveDelete:false};
 }
 if(action==='--prepare-directory'){
  await mkdir(phase,{recursive:false});
  // Fresh directory only. No inherited/world access and no existing ACL edits.
  const ps=`$n88Dir=[Console]::In.ReadToEnd(); if(-not [System.IO.Directory]::Exists($n88Dir)){throw 'missing fresh directory'}; $n88Acl=New-Object System.Security.AccessControl.DirectorySecurity; $n88Acl.SetAccessRuleProtection($true,$false); $n88Identity=[System.Security.Principal.WindowsIdentity]::GetCurrent().User; $n88Rule=New-Object System.Security.AccessControl.FileSystemAccessRule($n88Identity,'FullControl','ContainerInherit,ObjectInherit','None','Allow'); $n88Acl.AddAccessRule($n88Rule); [System.IO.Directory]::SetAccessControl($n88Dir,$n88Acl); $n88Readback=[System.IO.Directory]::GetAccessControl($n88Dir); $n88Rules=@($n88Readback.GetAccessRules($true,$true,[System.Security.Principal.SecurityIdentifier])); if(-not $n88Readback.AreAccessRulesProtected -or $n88Rules.Count -ne 1 -or $n88Rules[0].IdentityReference -ne $n88Identity -or $n88Rules[0].FileSystemRights -ne [System.Security.AccessControl.FileSystemRights]::FullControl){throw 'fresh directory custody readback mismatch'}`;
  const sealed=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',ps],{input:phase,windowsHide:true,timeout:10000});if(sealed.status!==0)fail('n88_fresh_secret_directory_protection_failed');
  await writeFile(path.join(phase,'owner.json'),JSON.stringify(marker),{flag:'wx'});
  return {phase,freshProtectedDirectoryPrepared:true,secretValuesGenerated:false};
 }
 if(action==='--init'){
  const proof=JSON.parse(await readFile(path.join(base,'hosted-boundary-readback.json'),'utf8'));
  if(proof.status!=='PASS'||proof.projectId!==project||proof.privateQueriesAllowed!==false)fail('n88_hosted_boundary_gate_missing');
  await owned();
  try{await readFile(path.join(phase,'recovery.dpapi'));fail('n88_custody_already_initialized');}catch(e){if(e.code!=='ENOENT')throw e;}
  const {publicKey,privateKey}=generateKeyPairSync('rsa',{modulusLength:3072,publicExponent:65537});
  const der=privateKey.export({format:'der',type:'pkcs8'});
  const state={project,run,recipient:der.toString('base64'),password:randomBytes(32).toString('hex'),hmac:randomBytes(32).toString('hex'),numeric:randomBytes(32).toString('hex'),reservation:randomBytes(32).toString('hex'),recovery:randomBytes(32).toString('hex'),recoveryVersion:'n88_'+Date.now(),loginAttempted:false,loginVerified:false,installed:false};
  try{await save(state);}finally{der.fill(0);}
  return {publicJwk:publicKey.export({format:'jwk'}),phase,protection:'DPAPI CurrentUser + fresh directory current-user ACL',secretValuesReturned:false};
 }
 const state=await load();
 if(['--stage-final-source','--restage-final-source','--final-readiness','--enable-final-public','--read-final-config'].includes(action)){
  const activeRun='78c0cde1-994b-441a-9ab5-3ffb68508b66';
  const card=JSON.parse(await readFile('C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/continuous-n88-official-student-portal-activation-20261018.json','utf8'));
  const source=JSON.parse(await readFile(path.join(base,'manifest.json'),'utf8')).outputs['edge/index.mjs'];
  const hostedBytes=(await readFile(path.join(base,'served-hosted-78c0cde1.json'),'utf8')).replaceAll('\r\n','\n'),hosted=JSON.parse(hostedBytes),hostedHash=createHash('sha256').update(hostedBytes).digest('hex');
  const ui=JSON.parse(await readFile('tests/n88-official-activation-public-entry-ui.json','utf8')),protocol=JSON.parse(await readFile('tests/n88-official-activation-public-protocol.json','utf8'));
  if(JSON.parse(await readFile('tests/n88-official-activation-public-entry-service.json','utf8')).status!=='PASS')fail('n88_final_first_access_proof');
  if(process.env.N88_ACTIVATION_RUN_ID!==activeRun||card.requiredChecks?.length!==9||!JSON.stringify(card.stagePublicationHistory).includes('4adda44802b336997c6276693fc0791637bcfb42')||hosted.status!=='PASS'||!hosted.actualUi.sameValueVisibilitySubmit||hosted.actualUi.newFixtureOrCodeOperations!==0||ui.status!=='PASS'||protocol.status!=='PASS'||!state.replacementFixture?.configured||state.loginDisarmed||state.directAuthRefused||!state.directVerified)fail('n88_final_authority_or_proof_gate');
  const rows=await official(['secrets','list','--project-ref',project,'--output','json']);
  const entries=Array.isArray(rows)?rows:rows?.rows;
  const matches=(name,v)=>Array.isArray(entries)&&entries.filter(r=>r.name===name).length===1&&entries.find(r=>r.name===name).value?.toLowerCase()===createHash('sha256').update(v).digest('hex');
  const install=async env=>{const file=path.join(phase,'owned-env.tmp');try{await writeFile(file,env,{flag:'wx'});await official(['secrets','set','--project-ref',project,'--env-file',file]);}finally{await unlink(file).catch(e=>{if(e.code!=='ENOENT')throw e;});}};
  if(action==='--stage-final-source'||action==='--restage-final-source'){
   const restage=action==='--restage-final-source',previous=state.finalRelease;
   if(restage?(!previous?.inactiveReady||previous.enableAttempted||previous.priorStage||previous.source!=='87043cad23cb75545a990a2ac7d90bde01d44ee060a1fd71e8f64af9b60ad4e3'):!!previous)fail('n88_final_source_already_staged');
   if(source===state.directSource||!matches('N88_ENABLED',String(!restage))||!matches('N88_ROLLOUT_MODE','pilot')||!matches('N88_PILOT_BINDING',JSON.stringify(state.pilotBinding))||!matches('N88_SERVICE_SOURCE_SHA',state.directSource))fail('n88_final_source_preimage');
   state.finalRelease={runId:activeRun,priorSource:state.directSource,source,hostedHash,stageAttempted:true,...(restage?{priorStage:previous,repair:'First admitted public teacher private context; prior successful inactive readiness retained'}:{})};await save(state);
   await install('N88_ENABLED=false\nN88_SERVICE_SOURCE_SHA='+source+'\n');
   state.directSource=source;state.pilotEnabled=false;state.finalRelease.staged=true;await save(state);
   const result={runId:activeRun,source,enabled:false,mode:'pilot',sameProtectedBinding:true,keysRoleCredentialSqlOrFixtureChanged:false,hostedHash};await writeFile(path.join(base,'final-source-stage-78c0cde1.json'),JSON.stringify(result,null,2)+'\n');return result;
  }
  const f=state.finalRelease;
  if(!f?.staged||f.source!==source||state.directSource!==source||f.hostedHash!==hostedHash||!matches('N88_SERVICE_SOURCE_SHA',source))fail('n88_final_source_identity');
  if(action==='--enable-final-public'){
   if(f.enableAttempted||!f.inactiveReady||!matches('N88_ENABLED','false')||!matches('N88_ROLLOUT_MODE','pilot')||!matches('N88_PILOT_BINDING',JSON.stringify(state.pilotBinding)))fail('n88_final_public_preimage');
   const env={N88_ENABLED:'true',N88_ROLLOUT_MODE:'public',N88_PILOT_BINDING:'',N88_PUBLIC_HOSTED_ACCEPTANCE_SHA256:hostedHash,N88_PUBLIC_HOSTED_ACCEPTANCE_CONFIRMED:'true'};
   if(!createRolloutGuard(n=>env[n]).configured)fail('n88_final_public_schema');
   f.enableAttempted=true;await save(state);
   await install(Object.entries(env).map(([k,v])=>k+'='+v).join('\n')+'\n');
   f.publicEnabled=true;state.pilotEnabled=false;await save(state);
   return {runId:activeRun,source,mode:'public',enabled:true,temporaryProviderBindingCleared:true,priorBindingsRetainedEncrypted:true,hostedHash,keysRoleCredentialSqlOrFixtureChanged:false};
  }
  const live=f.publicEnabled===true;
  if(!matches('N88_ENABLED',String(live))||!matches('N88_ROLLOUT_MODE',live?'public':'pilot')||!matches('N88_PILOT_BINDING',live?'':JSON.stringify(state.pilotBinding))||!matches('N88_READINESS_ENABLED','true')||live&&(!matches('N88_PUBLIC_HOSTED_ACCEPTANCE_SHA256',hostedHash)||!matches('N88_PUBLIC_HOSTED_ACCEPTANCE_CONFIRMED','true')))fail('n88_final_config_mismatch');
  if(action==='--read-final-config'){
   const result={runId:activeRun,source,enabled:live,mode:live?'public':'pilot',sourceMatches:true,temporaryProviderBindingCleared:live,readinessEnabled:true,hostedHash,originalKeysRoleAndFixturePreserved:true,privateQueries:0,providerWrites:0,identifiersOrSecretsReturned:false};await writeFile(path.join(base,'final-config-78c0cde1.json'),JSON.stringify(result,null,2)+'\n');return result;
  }
  const checkpoint=live?'public':'inactive';if(f[checkpoint+'ReadinessAttempted'])fail('n88_final_readiness_consumed');f[checkpoint+'ReadinessAttempted']=true;await save(state);
  const origin='https://'+project+'.supabase.co',route='/functions/v1/n88-student-portal/readiness',time=String(Math.floor(Date.now()/1000)),nonce=randomUUID(),body='{}';
  const signature=createHmac('sha256',Buffer.from(state.hmac,'hex')).update(JSON.stringify(['n88-readiness-v1',origin,route,time,nonce,createHash('sha256').update(body).digest('hex')])).digest('hex');
  let result;
  try{
   const response=await fetch(origin+route,{method:'POST',headers:{'content-type':'application/json','x-n88-time':time,'x-n88-nonce':nonce,'x-n88-signature':signature},body,signal:AbortSignal.timeout(15000)});
   const data=await response.json(),names=['status','stage','loginExact','roleExact','upstreamSsl','clientTlsAuthorized','sourceBoundary','configurationReady','rolloutMode','rolloutConfigured','source','enabled','code'];
   if(Object.keys(data).some(k=>!names.includes(k)))fail('n88_final_unexpected_readiness_shape');
   result={runId:activeRun,projectId:project,httpStatus:response.status,...data,expectedSource:source,sourceMatches:data.source===source,privateMutations:0};
   const passed=response.status===200&&data.status==='ready'&&data.loginExact===true&&data.roleExact===true&&data.upstreamSsl===true&&data.clientTlsAuthorized===true&&data.sourceBoundary===true&&data.configurationReady===true&&data.rolloutConfigured===true&&data.rolloutMode===(live?'public':'pilot')&&data.source===source&&data.enabled===live;
   result.status=passed?'PASS':'FAIL';f[checkpoint+'Ready']=passed;
   if(!passed){await install('N88_ENABLED=false\n');f.publicEnabled=false;if(data.code==='28P01'){await sqlFile('alter role n88_backend nologin;');state.loginDisarmed=true;state.directAuthRefused=true;}}
  }catch(e){await install('N88_ENABLED=false\n');f.publicEnabled=false;result={runId:activeRun,status:'FAIL',code:'n88_final_readiness_unavailable',source,enabled:false,ownedFeatureDisabled:true};}
  await save(state);await writeFile(path.join(base,'final-'+checkpoint+'-readiness-78c0cde1.json'),JSON.stringify(result,null,2)+'\n');return result;
 }
 if(action==='--read-wake-pilot-config'||action==='--read-served-pilot-config'){
  const served=action==='--read-served-pilot-config';
  const activeRun=served?'78c0cde1-994b-441a-9ab5-3ffb68508b66':'f8356a7b-0f5d-4804-b1b7-10ff0a8c4043';
  const card=JSON.parse(await readFile('C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/continuous-n88-official-student-portal-activation-20261018.json','utf8'));
  const source=JSON.parse(await readFile(path.join(base,'manifest.json'),'utf8')).outputs['edge/index.mjs'];
  const stage=served?card.requiredChecks?.length===9&&JSON.stringify(card.stagePublicationHistory).includes('4adda44802b336997c6276693fc0791637bcfb42'):card.stagedActivation?.phase==='pilot'&&card.requiredChecks?.length===7&&card.stagedActivation?.finalRequiredChecks?.length===9;
  if(process.env.N88_ACTIVATION_RUN_ID!==activeRun||!stage||!state.replacementFixture?.configured||!state.replacementFixture.priorBinding||!state.pilotBinding||state.pilotBinding.studentIds?.length!==2||JSON.stringify(state.replacementFixture.newBinding)!==JSON.stringify(state.pilotBinding)||state.directAuthRefused||state.loginDisarmed||!state.directVerified||source!==state.directSource)fail('n88_wake_readback_preimage');
  const listed=await official(['secrets','list','--project-ref',project,'--output','json']),rows=Array.isArray(listed)?listed:listed?.rows;
  const matches=(name,v)=>Array.isArray(rows)&&rows.filter(r=>r.name===name).length===1&&rows.find(r=>r.name===name).value?.toLowerCase()===createHash('sha256').update(v).digest('hex');
  const result={runId:activeRun,readOnly:true,enabled:matches('N88_ENABLED','true'),pilotMode:matches('N88_ROLLOUT_MODE','pilot'),sameReplacementBinding:matches('N88_PILOT_BINDING',JSON.stringify(state.pilotBinding)),sameSource:matches('N88_SERVICE_SOURCE_SHA',source),readinessEnabled:matches('N88_READINESS_ENABLED','true'),source,activeOwners:1,activePupils:2,priorBindingRetainedEncrypted:true,providerWrites:0,privateQueries:0,identifiersOrValuesReturned:false};
  if(!result.enabled||!result.pilotMode||!result.sameReplacementBinding||!result.sameSource||!result.readinessEnabled)fail('n88_wake_pilot_config_mismatch');
  await writeFile(path.join(base,served?'served-pilot-config-78c0cde1.json':'wake-pilot-config-f8356a7b.json'),JSON.stringify(result,null,2)+'\n');return result;
 }
 if(action==='--rebind-replacement-pilot'){
  const activeRun='35395ae1-0dc1-4fd1-b598-5441b50a3f09';
  const card=JSON.parse(await readFile('C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/continuous-n88-official-student-portal-activation-20261018.json','utf8'));
  const authority=await readFile('C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/intake-evidence/po-20261019-followups/po-new-n88-test-account.json');
  if(process.env.N88_ACTIVATION_RUN_ID!==activeRun||card.preparationAuthority?.replacementTeacherFixture?.authorityEvidenceSha256!==createHash('sha256').update(authority).digest('hex')||card.requiredChecks?.length!==9||!state.pilotBinding||!state.pilotEnabled||!state.directVerified||state.loginDisarmed||state.directAuthRefused||state.replacementFixture)fail('n88_replacement_authority_preimage');
  const file=path.join(phase,'owned-replacement-source.json'),envFile=path.join(phase,'owned-env.tmp');
  try{
   const input=JSON.parse(await readFile(file,'utf8'));
   if(Object.keys(input).sort().join(',')!=='normalUiReloadAck,studentIds,teachingId'||input.normalUiReloadAck!==true||!/^tch:[a-f0-9-]{36}$/.test(input.teachingId)||!Array.isArray(input.studentIds)||input.studentIds.length!==2||new Set(input.studentIds).size!==2||input.studentIds.some(s=>!/^[a-f0-9-]{36}$/.test(s)))fail('n88_replacement_source_shape');
   const source=JSON.parse(await readFile(path.join(base,'manifest.json'),'utf8')).outputs['edge/index.mjs'];
   const listed=await official(['secrets','list','--project-ref',project,'--output','json']),rows=Array.isArray(listed)?listed:listed?.rows;
   const matches=(name,v)=>Array.isArray(rows)&&rows.filter(r=>r.name===name).length===1&&rows.find(r=>r.name===name).value?.toLowerCase()===createHash('sha256').update(v).digest('hex');
   if(source!==state.directSource||!matches('N88_ENABLED','true')||!matches('N88_ROLLOUT_MODE','pilot')||!matches('N88_PILOT_BINDING',JSON.stringify(state.pilotBinding))||!matches('N88_SERVICE_SOURCE_SHA',source))fail('n88_replacement_config_preimage');
   // Exact UI-created synthetic source only. Owner UUID stays inside this custodian.
   // No Auth/profile/session/token projection and no canonical write.
   const out=await sqlFile(`select t.owner_id::text as owner_id,t.section_id as class_id from rakeezx.teachings t join rakeezx.sections c on c.owner_id=t.owner_id and c.id=t.section_id join rakeezx.terms tm on tm.owner_id=t.owner_id and tm.id=t.term_id join rakeezx.years y on y.owner_id=c.owner_id and y.id=c.year_id where t.id='${input.teachingId}' and t.deleted_at is null and c.deleted_at is null and c.status='active' and tm.deleted_at is null and tm.status='active' and tm.year_id=c.year_id and y.deleted_at is null and y.status='active' and (select count(*) from rakeezx.enrollments e where e.owner_id=t.owner_id and e.section_id=c.id and e.deleted_at is null and e.status='active' and e.end_date is null)=2 and (select count(*) from rakeezx.enrollments e join rakeezx.students s on s.owner_id=e.owner_id and s.id=e.student_id where e.owner_id=t.owner_id and e.section_id=c.id and e.student_id in ('${input.studentIds[0]}','${input.studentIds[1]}') and e.deleted_at is null and e.status='active' and e.end_date is null and s.deleted_at is null and s.status='active' and s.name in ('طالب تجريبي أ','طالب تجريبي ب'))=2 and not exists(select 1 from rakeezx.enrollments e where e.owner_id=t.owner_id and e.student_id in ('${input.studentIds[0]}','${input.studentIds[1]}') and e.section_id<>c.id and e.deleted_at is null and e.status='active' and e.end_date is null);`);
   if(out?.rows?.length!==1||!/^[a-f0-9-]{36}$/.test(out.rows[0].owner_id)||typeof out.rows[0].class_id!=='string')fail('n88_replacement_exact_source_missing');
   const binding={ownerId:out.rows[0].owner_id,classId:out.rows[0].class_id,teachingId:input.teachingId,studentIds:input.studentIds};
   if(binding.ownerId===state.pilotBinding.ownerId||binding.classId===state.pilotBinding.classId||!createRolloutGuard(n=>({N88_ROLLOUT_MODE:'pilot',N88_PILOT_BINDING:JSON.stringify(binding)})[n]).configured)fail('n88_replacement_binding_invalid');
   state.replacementFixture={runId:activeRun,priorBinding:state.pilotBinding,newBinding:binding,source,configurationAttempted:true};await save(state);
   await writeFile(envFile,"N88_ENABLED=false\nN88_READINESS_ENABLED=true\nN88_ROLLOUT_MODE=pilot\nN88_PILOT_BINDING='"+JSON.stringify(binding)+"'\n",{flag:'wx'});
   await official(['secrets','set','--project-ref',project,'--env-file',envFile]);
   state.pilotBinding=binding;state.pilotEnabled=false;state.replacementFixture.configured=true;await save(state);
   const result={runId:activeRun,source,enabled:false,mode:'pilot',activeOwners:1,activePupils:2,priorBindingEncryptedAndRetained:true,exactUiSourceMatched:true,canonicalWrites:0,authRoleCredentialOrSqlChanges:0,identifiersReturned:false};
   await writeFile(path.join(base,'replacement-config-35395ae1.json'),JSON.stringify(result,null,2)+'\n');return result;
  }finally{for(const f of [file,envFile])await unlink(f).catch(e=>{if(e.code!=='ENOENT')throw e;});}
 }
 if(action==='--probe-original-pilot-dispatch'){
  if(!state.pilotEnabled||!state.directVerified||state.directAuthRefused||state.pilotDispatchProbeSource===state.directSource)fail('n88_pilot_dispatch_probe_gate');
  state.pilotDispatchProbeSource=state.directSource;await save(state);
  const time=String(Math.floor(Date.now()/1000)),nonce=randomUUID(),source='a'.repeat(64),body=Buffer.from('{}'),headers=['','','https://rakeezx.com','application/json','1','same-origin'],route='/api/n88/teacher/class/list';
  const signature=createHmac('sha256',Buffer.from(state.ingress,'hex')).update(JSON.stringify(['n88-ingress-v1','https://rakeezx.com',route,'POST',headers,createHash('sha256').update(body).digest('hex'),time,nonce,source])).digest('hex');
  const response=await fetch('https://'+project+'.supabase.co/functions/v1/n88-student-portal/dispatch',{method:'POST',headers:{'content-type':'application/json','x-n88-time':time,'x-n88-nonce':nonce,'x-n88-source':source,'x-n88-signature':signature},body:JSON.stringify({path:route,method:'POST',headers,body:body.toString('base64')}),signal:AbortSignal.timeout(15000)});
  const reply=await response.json();const result={source:state.directSource,httpStatus:response.status,serviceStatus:reply.status??null,genericDenial:reply.body?.error==='unavailable',noTeacherBindingOrTokenSent:true,privateQueries:0};await writeFile(path.join(base,'hosted-pilot-dispatch-probe.json'),JSON.stringify(result,null,2)+'\n');return result;
 }
 if(action==='--prepare-pilot-binding'){
  if(!state.directVerified||!state.installed||!state.preparationPaused||state.pilotBinding)fail('n88_pilot_binding_preimage');
  for(const name of ['service','ui'])if(JSON.parse(await readFile('tests/n88-official-activation-pilot-'+name+'.json','utf8')).status!=='PASS')fail('n88_pilot_local_gate');
  const file=path.join(phase,'owned-pilot-source.json');
  try{
   const input=JSON.parse(await readFile(file,'utf8'));
   if(Object.keys(input).sort().join(',')!=='classId,studentIds,teachingId'||!/^sec:[a-f0-9-]{36}$/.test(input.classId)||input.teachingId!=='tch:'+input.classId+'|sub:digital-skills|tm:y:1448-1449:1'||input.classId!=='sec:8d78704e-fd86-4b95-aa92-83957740daf6'||!Array.isArray(input.studentIds)||input.studentIds.length!==2||new Set(input.studentIds).size!==2||input.studentIds.some(s=>!/^[a-f0-9-]{36}$/.test(s)))fail('n88_pilot_source_shape');
   // Only owner UUID of this exact normal-UI observed source and these two
   // existing fabricated pupils. No Auth/profile/token/canonical payload projection.
   const out=await sqlFile(`select t.owner_id::text as owner_id from rakeezx.teachings t join rakeezx.sections c on c.owner_id=t.owner_id and c.id=t.section_id join rakeezx.terms tm on tm.owner_id=t.owner_id and tm.id=t.term_id join rakeezx.years y on y.owner_id=c.owner_id and y.id=c.year_id where t.id='${input.teachingId}' and t.section_id='${input.classId}' and t.deleted_at is null and c.deleted_at is null and c.status='active' and tm.deleted_at is null and tm.status='active' and tm.year_id=c.year_id and y.deleted_at is null and y.status='active' and (select count(*) from rakeezx.enrollments e join rakeezx.students s on s.owner_id=e.owner_id and s.id=e.student_id where e.owner_id=t.owner_id and e.section_id=c.id and e.student_id in ('${input.studentIds[0]}','${input.studentIds[1]}') and e.deleted_at is null and e.status='active' and e.end_date is null and s.deleted_at is null and s.status='active')=2 and not exists(select 1 from rakeezx.enrollments e where e.owner_id=t.owner_id and e.student_id in ('${input.studentIds[0]}','${input.studentIds[1]}') and e.section_id<>c.id and e.deleted_at is null and e.status='active' and e.end_date is null);`);
   if(out?.rows?.length!==1||!/^[a-f0-9-]{36}$/.test(out.rows[0].owner_id))fail('n88_pilot_exact_single_owner_missing');
   state.pilotBinding={...input,ownerId:out.rows[0].owner_id};
   if(!createRolloutGuard(n=>({N88_ROLLOUT_MODE:'pilot',N88_PILOT_BINDING:JSON.stringify(state.pilotBinding)})[n]).configured)fail('n88_pilot_binding_invalid');
   await save(state);return {bindingProtected:true,exactSourceOwnerMatches:1,students:2,newAuthUsers:0,canonicalWrites:0,identifiersReturned:false};
  }finally{await unlink(file).catch(e=>{if(e.code!=='ENOENT')throw e;});}
 }
 if(action==='--install-pilot-config'){
  if(!state.pilotBinding||!state.directVerified||!state.installed||state.pilotConfigured)fail('n88_pilot_configuration_gate');
  const source=JSON.parse(await readFile(path.join(base,'manifest.json'),'utf8')).outputs['edge/index.mjs'];
  const env={N88_ENABLED:'false',N88_READINESS_ENABLED:'true',N88_ROLLOUT_MODE:'pilot',N88_PILOT_BINDING:JSON.stringify(state.pilotBinding),N88_SERVICE_SOURCE_SHA:source};
  const file=path.join(phase,'owned-env.tmp');
  try{await writeFile(file,Object.entries(env).map(([k,v])=>k+'='+(k==='N88_PILOT_BINDING'?"'"+v+"'":JSON.stringify(v))).join('\n')+'\n',{flag:'wx'});await official(['secrets','set','--project-ref',project,'--env-file',file]);state.directSource=source;state.pilotConfigured=true;state.pilotConfigSerialization=2;await save(state);}
  finally{await unlink(file).catch(e=>{if(e.code!=='ENOENT')throw e;});}
  return {installed:true,enabled:false,rolloutMode:'pilot',source,protectedOwnerBinding:true,names:Object.keys(env),identifiersReturned:false};
 }
 if(action==='--repair-pilot-config-serialization'){
  const r=JSON.parse(await readFile(path.join(base,'hosted-pilot-readiness.initial-config-failure.json'),'utf8'));
  if(!state.pilotConfigured||state.pilotConfigSerialization||!state.pilotBinding||r.source!==state.directSource||r.rolloutMode!=='off'||r.rolloutConfigured!==false||r.enabled!==false||!r.sourceMatches)fail('n88_pilot_serialization_preimage');
  const file=path.join(phase,'owned-env.tmp');
  try{await writeFile(file,"N88_ENABLED=false\nN88_ROLLOUT_MODE=pilot\nN88_PILOT_BINDING='"+JSON.stringify(state.pilotBinding)+"'\n",{flag:'wx'});await official(['secrets','set','--project-ref',project,'--env-file',file]);state.pilotConfigSerialization=2;await save(state);}
  finally{await unlink(file).catch(e=>{if(e.code!=='ENOENT')throw e;});}
  return {sameBindingInstalled:true,serializationCorrected:true,credentialOrVerifierChanged:false,identifiersReturned:false};
 }
 if(action==='--restore-pilot-ui-correction'){
  const activeRun='75c77bea-eec3-4a4e-9749-42ab3982de7e';
  if(process.env.N88_ACTIVATION_RUN_ID!==activeRun||!state.pilotConfigured||!state.installed||state.loginDisarmed||state.directAuthRefused||!state.pilotBinding||state.pilotBinding.studentIds?.length!==2)fail('n88_pilot_correction_custody_gate');
  const source=JSON.parse(await readFile(path.join(base,'manifest.json'),'utf8')).outputs['edge/index.mjs'];
  const readiness=JSON.parse(await readFile(path.join(base,'hosted-pilot-readiness.json'),'utf8'));
  if(state.directVerified!==true||readiness.runId!==activeRun)fail('n88_pilot_correction_fresh_readiness_required');
  const history=(await readFile(path.join(base,'continuation-b324b7b5.json'),'utf8')).replaceAll('\r\n','\n');
  const card=JSON.parse(await readFile('C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/continuous-n88-official-student-portal-activation-20261018.json','utf8'));
  const listed=await official(['secrets','list','--project-ref',project,'--output','json']);
  const rows=Array.isArray(listed)?listed:listed?.rows;
  const matches=(name,value)=>Array.isArray(rows)&&rows.filter(r=>r.name===name).length===1&&rows.find(r=>r.name===name).value?.toLowerCase()===createHash('sha256').update(value).digest('hex');
  const guard={source,readiness,alreadyRestored:!!state.pilotUiCorrectionRestored,enabledOff:!state.pilotEnabled&&matches('N88_ENABLED','false'),modePilot:matches('N88_ROLLOUT_MODE','pilot'),bindingMatches:matches('N88_PILOT_BINDING',JSON.stringify(state.pilotBinding)),sourceMatches:source===state.directSource&&matches('N88_SERVICE_SOURCE_SHA',source),localUiPass:JSON.parse(await readFile('tests/n88-official-activation-current-entry-ui.json','utf8')).status==='PASS',localPackagePass:JSON.parse(await readFile('tests/n88-official-activation-current-package.json','utf8')).status==='PASS',historicalFailureMatches:createHash('sha256').update(history).digest('hex')==='28c72d3c892382a72ebbd985f16e3e131d5e26461dee5e2c79de53f3e28abb83',stageAuthorized:card.stagedActivation?.phase==='pilot'&&card.requiredChecks?.length===7&&card.stagedActivation?.finalRequiredChecks?.length===9&&card.objective?.includes('LATEST ONCE-ONLY VERIFIED PILOT UI CORRECTION STAGE')};
  if(!pilotCorrectionRestoreReady(guard))fail('n88_pilot_correction_preimage_mismatch');
  const file=path.join(phase,'owned-env.tmp');
  try{
   await writeFile(file,'N88_ENABLED=true\n',{flag:'wx'});await official(['secrets','set','--project-ref',project,'--env-file',file]);
   state.pilotEnabled=true;state.pilotUiCorrectionRestored={runId:activeRun,source};state.pilotLiveReadinessCalled=false;await save(state);
  }finally{await unlink(file).catch(e=>{if(e.code!=='ENOENT')throw e;});}
  return {runId:activeRun,enabled:true,rolloutMode:'pilot',publicEnabled:false,existingOwnerBindingUnchanged:true,students:2,credentialRoleSqlOrFixtureChanged:false,source,historicalFinalFailuresPreserved:true};
 }
 if(action==='--read-pilot-ui-correction-config'){
  if(!state.pilotUiCorrectionRestored||!state.pilotEnabled)fail('n88_pilot_correction_readback_gate');
  const listed=await official(['secrets','list','--project-ref',project,'--output','json']),rows=Array.isArray(listed)?listed:listed?.rows;
  const matches=(name,value)=>Array.isArray(rows)&&rows.filter(r=>r.name===name).length===1&&rows.find(r=>r.name===name).value?.toLowerCase()===createHash('sha256').update(value).digest('hex');
  const result={runId:state.pilotUiCorrectionRestored.runId,enabled:matches('N88_ENABLED','true'),pilotMode:matches('N88_ROLLOUT_MODE','pilot'),sameProtectedBinding:matches('N88_PILOT_BINDING',JSON.stringify(state.pilotBinding)),sameSource:matches('N88_SERVICE_SOURCE_SHA',state.directSource),publicEnabled:false,students:2,source:state.directSource,identifiersOrValuesReturned:false};
  if(!result.enabled||!result.pilotMode||!result.sameProtectedBinding||!result.sameSource)fail('n88_pilot_correction_config_readback_failed');
  await writeFile(path.join(base,'pilot-ui-correction-config-75c77bea.json'),JSON.stringify(result,null,2)+'\n');return result;
 }
 if(action==='--enable-pilot'){
  const r=JSON.parse(await readFile(path.join(base,'hosted-pilot-readiness.json'),'utf8'));
  if(!state.pilotConfigured||!state.directVerified||state.loginDisarmed||r.source!==state.directSource||r.rolloutMode!=='pilot'||!r.rolloutConfigured||!r.configurationReady||!r.sourceMatches)fail('n88_pilot_enable_gate');
  const file=path.join(phase,'owned-env.tmp');try{await writeFile(file,'N88_ENABLED=true\n',{flag:'wx'});await official(['secrets','set','--project-ref',project,'--env-file',file]);state.pilotEnabled=true;await save(state);}finally{await unlink(file).catch(e=>{if(e.code!=='ENOENT')throw e;});}
  return {enabled:true,rolloutMode:'pilot',publicMode:false,credentialChanged:false};
 }
 if(action==='--stage-pilot-source'){
  if(!state.pilotConfigured||!state.directVerified||state.directAuthRefused)fail('n88_pilot_source_gate');
  if(JSON.parse(await readFile('tests/n88-official-activation-pilot-entry.json','utf8')).status!=='PASS')fail('n88_pilot_entry_gate');
  const source=JSON.parse(await readFile(path.join(base,'manifest.json'),'utf8')).outputs['edge/index.mjs'];if(source===state.directSource)fail('n88_pilot_source_unchanged');
  const file=path.join(phase,'owned-env.tmp');try{await writeFile(file,'N88_ENABLED=false\nN88_SERVICE_SOURCE_SHA='+source+'\n',{flag:'wx'});await official(['secrets','set','--project-ref',project,'--env-file',file]);state.directSource=source;state.pilotEnabled=false;state.pilotLiveReadinessCalled=false;state.pilotSerializedReadinessCalled=false;await save(state);}finally{await unlink(file).catch(e=>{if(e.code!=='ENOENT')throw e;});}
  return {source,enabled:false,originalBindingAndCredentialUnchanged:true};
 }
 if(action==='--pause-owned-pilot'){
  const receipt=JSON.parse(await readFile(path.join(base,'hosted-journey-b324b7b5.json'),'utf8'));
  const source=JSON.parse(await readFile(path.join(base,'manifest.json'),'utf8')).outputs['edge/index.mjs'];
  if(!state.pilotConfigured||!state.pilotEnabled||!state.directVerified||source!==state.directSource||receipt.runId!=='b324b7b5-5bfa-4ddb-8a92-adde7e26fe04'||receipt.publicEnabled!==false)fail('n88_owned_pilot_pause_gate');
  const file=path.join(phase,'owned-env.tmp');
  try{await writeFile(file,'N88_ENABLED=false\n',{flag:'wx'});await official(['secrets','set','--project-ref',project,'--env-file',file]);state.pilotEnabled=false;state.pilotPausedForFrontendSource=source;await save(state);}
  finally{await unlink(file).catch(e=>{if(e.code!=='ENOENT')throw e;});}
  const result=await official(['secrets','list','--project-ref',project,'--output','json']);
  const rows=Array.isArray(result)?result:result?.rows;
  const confirmed=Array.isArray(rows)&&rows.filter(r=>r.name==='N88_ENABLED').length===1&&rows.find(r=>r.name==='N88_ENABLED').value?.toLowerCase()===createHash('sha256').update('false').digest('hex');
  const disposition={runId:receipt.runId,enabled:false,enabledFalseProviderDigestMatches:confirmed,rolloutMode:'pilot',publicEnabled:false,credentialOrRoleOrFixtureChanged:false,protectedTemporaryInputRemoved:true,source};
  await writeFile(path.join(base,'owned-pilot-pause-b324b7b5.json'),JSON.stringify(disposition,null,2)+'\n');
  if(!confirmed)fail('n88_owned_pilot_pause_readback_unconfirmed');return disposition;
 }
 if(action==='--read-owned-pilot-flag'){
  if(state.pilotEnabled||!state.pilotPausedForFrontendSource)fail('n88_owned_pause_readback_gate');
  const result=await official(['secrets','list','--project-ref',project,'--output','json']);const rows=Array.isArray(result)?result:result?.rows;
  const flag=rows?.find(r=>r.name==='N88_ENABLED');
  const matches=typeof flag?.value==='string'&&flag.value.toLowerCase()===createHash('sha256').update('false').digest('hex');
  const r={runId:'b324b7b5-5bfa-4ddb-8a92-adde7e26fe04',enabled:false,enabledFalseProviderDigestMatches:matches,providerDigestField:'value',rolloutMode:'pilot',publicEnabled:false,credentialOrRoleOrFixtureChanged:false,protectedTemporaryInputRemoved:true,source:state.directSource,initialPausedSource:state.pilotPausedForFrontendSource};
  if(!matches)fail('n88_owned_pause_digest_mismatch');await writeFile(path.join(base,'owned-pilot-pause-readback-b324b7b5.json'),JSON.stringify(r,null,2)+'\n');return r;
 }
 if(action==='--installed-names'){
  const result=await official(['secrets','list','--project-ref',project,'--output','json']);
  const rows=Array.isArray(result)?result:result?.rows;
  if(!Array.isArray(rows))fail('n88_secret_names_shape');
  return {names:rows.map(r=>r.name).filter(n=>n.startsWith('N88_')).sort(),valuesReturned:false};
 }
 if(action==='--pause-preparation'){
  if(!state.directVerified||!state.installed)fail('n88_preparation_pause_gate');
  const file=path.join(phase,'owned-env.tmp');
  try{await writeFile(file,'N88_ENABLED=false\nN88_READINESS_ENABLED=false\n',{flag:'wx'});await official(['secrets','set','--project-ref',project,'--env-file',file]);}
  finally{await unlink(file).catch(e=>{if(e.code!=='ENOENT')throw e;});}
  await sqlFile("do $$ begin if not exists(select 1 from pg_roles where rolname='n88_backend' and not rolinherit and not rolsuper and not rolbypassrls and not rolcreatedb and not rolcreaterole and not rolreplication and rolconnlimit=-1 and rolvaliduntil is null and rolconfig is null and not exists(select 1 from pg_auth_members where member=pg_roles.oid)) then raise exception 'n88_pause_role_mismatch'; end if; alter role n88_backend nologin; end $$;");
  state.loginDisarmed=true;state.preparationPaused=true;await save(state);
  await unlink(path.join(base,'public-provider-config.json'));
  return {productEnabled:false,signedReadinessEnabled:false,loginDisarmed:true,originalRecoveryRetained:true,temporaryProviderConfigRemoved:true};
 }
 if(action==='--recipient-public'){
  if(!state.directVerified||state.ingress||!state.recipient)fail('n88_ingress_recipient_gate');
  const der=Buffer.from(state.recipient,'base64');
  try{return {publicJwk:createPublicKey(createPrivateKey({key:der,format:'der',type:'pkcs8'})).export({format:'jwk'}),project,worker:'rakeez-n88-private-ingress'};}finally{der.fill(0);}
 }
 if(action==='--refresh-direct-source'){
  if(!state.directReadinessInstalled||(!state.loginDisarmed&&!state.directVerified)||state.directAuthRefused)fail('n88_direct_refresh_gate');
  const source=JSON.parse(await readFile(path.join(base,'manifest.json'),'utf8')).outputs['edge/index.mjs'];
  if(source===state.directSource)fail('n88_direct_source_unchanged');
  const file=path.join(phase,'owned-env.tmp');
  try{await writeFile(file,'N88_SERVICE_SOURCE_SHA='+source+'\nN88_ENABLED=false\nN88_READINESS_ENABLED=true\n',{flag:'wx'});await official(['secrets','set','--project-ref',project,'--env-file',file]);state.lastDirectSourceAttempt=state.directSource;state.directSource=source;await save(state);}
  finally{await unlink(file).catch(e=>{if(e.code!=='ENOENT')throw e;});}
  return {source,enabled:false,credentialChanged:false};
 }
 if(action==='--install-direct-readiness'){
  const d=state.restoredPublicDiagnostic;
  if(d?.status!=='PASS'||d.announcedIterations!==4096||d.expectedStoredIterations!==16384||!d.saltMatchesOwnStoredPublicChallenge||!d.strictTls||!d.hostnameVerified||d.proofSent||state.directReadinessInstalled)fail('n88_direct_readiness_gate');
  const m=JSON.parse(await readFile(path.join(base,'manifest.json'),'utf8')),source=m.outputs['edge/index.mjs'];
  const env={N88_ENABLED:'false',N88_READINESS_ENABLED:'true',N88_AUTH_URL:'https://'+project+'.supabase.co',N88_SERVICE_SOURCE_SHA:source,N88_HMAC_KEY:state.hmac,N88_DATABASE_URL:`postgresql://n88_backend:${state.password}@db.${project}.supabase.co:5432/postgres`,N88_DATABASE_CA_CERT:await readFile(path.join(base,'ca/supabase-prod-ca-2021.crt'),'utf8')};
  const file=path.join(phase,'owned-env.tmp');
  try{await writeFile(file,Object.entries(env).map(([k,v])=>k+'='+JSON.stringify(v)).join('\n')+'\n',{flag:'wx'});await official(['secrets','set','--project-ref',project,'--env-file',file]);state.directReadinessInstalled=true;state.directSource=source;await save(state);}
  finally{await unlink(file).catch(e=>{if(e.code!=='ENOENT')throw e;});}
  return {installed:true,enabled:false,readinessSigned:true,database:'official direct strictTLS',originalIterations:16384,credentialUnchanged:true,names:Object.keys(env),source};
 }
 if(action==='--arm-direct-login'){
  if(!state.directReadinessInstalled||state.directAuthRefused||(state.directLoginArmed&&(!state.loginDisarmed||(!state.directVerified&&state.lastDirectSourceAttempt===state.directSource))))fail('n88_direct_login_gate');
  await sqlFile("do $$ begin if not exists(select 1 from pg_roles where rolname='n88_backend' and not rolcanlogin and not rolinherit and not rolsuper and not rolbypassrls and not rolcreatedb and not rolcreaterole and not rolreplication and rolconnlimit=-1 and rolvaliduntil is null and rolconfig is null and not exists(select 1 from pg_auth_members where member=pg_roles.oid) and has_database_privilege('n88_backend','postgres','CONNECT')) then raise exception 'n88_direct_login_preimage'; end if; alter role n88_backend login; end $$;");
  state.directLoginArmed=true;state.loginDisarmed=false;await save(state);return {directLoginArmed:true,verifierOrPasswordChanged:false,membershipChanged:false};
 }
 if(action==='--enable-replacement-pilot'){
  const r=JSON.parse(await readFile(path.join(base,'replacement-readiness-35395ae1.json'),'utf8'));
  if(process.env.N88_ACTIVATION_RUN_ID!=='35395ae1-0dc1-4fd1-b598-5441b50a3f09'||!state.replacementFixture?.configured||state.replacementFixture.enabled||state.pilotEnabled||state.loginDisarmed||!state.directVerified||r.status!=='ready'||!r.sourceMatches||r.source!==state.directSource||r.enabled!==false||r.rolloutMode!=='pilot'||!r.rolloutConfigured||!r.configurationReady)fail('n88_replacement_enable_gate');
  const file=path.join(phase,'owned-env.tmp');
  try{await writeFile(file,'N88_ENABLED=true\n',{flag:'wx'});await official(['secrets','set','--project-ref',project,'--env-file',file]);state.pilotEnabled=true;state.replacementFixture.enabled=true;await save(state);}
  finally{await unlink(file).catch(e=>{if(e.code!=='ENOENT')throw e;});}
  return {enabled:true,mode:'pilot',activeOwners:1,activePupils:2,publicEnabled:false};
 }
 if(action==='--call-direct-readiness'||action==='--call-pilot-live-readiness'||action==='--replacement-readiness'||action==='--replacement-live-readiness'){
  const replacement=action.startsWith('--replacement-'),live=action==='--call-pilot-live-readiness'||action==='--replacement-live-readiness';
  if(replacement){
   if(process.env.N88_ACTIVATION_RUN_ID!=='35395ae1-0dc1-4fd1-b598-5441b50a3f09'||!state.replacementFixture?.configured||state.replacementFixture.source!==state.directSource||state.loginDisarmed||state.directAuthRefused||state.pilotEnabled!==live||state.replacementFixture[live?'liveReadinessCalled':'readinessCalled'])fail('n88_replacement_readiness_consumed');
   const listed=await official(['secrets','list','--project-ref',project,'--output','json']),rows=Array.isArray(listed)?listed:listed?.rows;
   const matches=(name,v)=>Array.isArray(rows)&&rows.filter(r=>r.name===name).length===1&&rows.find(r=>r.name===name).value?.toLowerCase()===createHash('sha256').update(v).digest('hex');
   if(!matches('N88_ENABLED',String(live))||!matches('N88_ROLLOUT_MODE','pilot')||!matches('N88_PILOT_BINDING',JSON.stringify(state.pilotBinding))||!matches('N88_SERVICE_SOURCE_SHA',state.directSource))fail('n88_replacement_config_readback');
   state.replacementFixture[live?'liveReadinessCalled':'readinessCalled']=true;
  }else if(live?(!state.pilotEnabled||state.pilotLiveReadinessCalled||state.directAuthRefused):(!state.directLoginArmed||state.directAuthRefused||(state.lastDirectSourceAttempt===state.directSource&&!(state.pilotConfigSerialization===2&&!state.pilotSerializedReadinessCalled))))fail('n88_direct_readiness_consumed');
  if(live)state.pilotLiveReadinessCalled=true;
  if(state.pilotConfigSerialization===2)state.pilotSerializedReadinessCalled=true;
  state.directReadinessCalled=true;state.lastDirectSourceAttempt=state.directSource;await save(state);
  const origin='https://'+project+'.supabase.co',route='/functions/v1/n88-student-portal/readiness',time=String(Math.floor(Date.now()/1000)),nonce=randomUUID(),body='{}';
  const signed=JSON.stringify(['n88-readiness-v1',origin,route,time,nonce,createHash('sha256').update(body).digest('hex')]);
  const signature=createHmac('sha256',Buffer.from(state.hmac,'hex')).update(signed).digest('hex');
  let receipt;
  try{
   const response=await fetch(origin+route,{method:'POST',headers:{'content-type':'application/json','x-n88-time':time,'x-n88-nonce':nonce,'x-n88-signature':signature},body,signal:AbortSignal.timeout(15000)});
   let data=await response.json();
   const names=['status','stage','loginExact','roleExact','upstreamSsl','clientTlsAuthorized','sourceBoundary','configurationReady','rolloutMode','rolloutConfigured','source','enabled','code'];
   if(Object.keys(data).some(k=>!names.includes(k)))data={status:'unavailable',stage:'entry',code:'n88_generic_entry_unavailable',enabled:false};
   receipt={runId:process.env.N88_ACTIVATION_RUN_ID??(state.pilotConfigured?'3576957c-1cf3-455d-8d62-150b1934b728':'9190735f-6ed0-4513-8ef1-5a3ef24ec6f8'),projectId:project,httpStatus:response.status,...data,expectedSource:state.directSource,sourceMatches:data.source===state.directSource,transport:'original Supabase Edge IPv6 -> official direct strictTLS',privateMutations:0};
   state.directVerified=response.status===200&&data.status==='ready'&&data.loginExact===true&&data.roleExact===true&&data.upstreamSsl===true&&data.clientTlsAuthorized===true&&data.sourceBoundary===true&&data.source===state.directSource&&data.enabled===live;
   if(data.code==='28P01')state.directAuthRefused=true;
   if(!state.directVerified){await sqlFile('alter role n88_backend nologin;');state.loginDisarmed=true;receipt.loginDisarmed=true;}
   await save(state);await writeFile(path.join(base,replacement?(live?'replacement-live-readiness-35395ae1.json':'replacement-readiness-35395ae1.json'):live?'hosted-pilot-live-readiness.json':state.pilotConfigured?'hosted-pilot-readiness.json':'hosted-direct-readiness.json'),JSON.stringify(receipt,null,2)+'\n');return receipt;
  }catch{
   await sqlFile('alter role n88_backend nologin;');state.loginDisarmed=true;await save(state);fail('n88_direct_readiness_failed_disarmed');
  }
 }
 if(action==='--server-first-restored'){
  if(state.restoredPublicChallengeConsumed||state.publicChallengeDiagnostic?.status!=='UNAVAILABLE'||state.publicChallengeDiagnostic?.code!=='XX000')fail('n88_restored_public_challenge_gate');
  const before=await sqlFile("select not rolcanlogin and not rolinherit and not rolsuper and not rolcreatedb and not rolcreaterole and not rolreplication and not rolbypassrls and rolconnlimit=-1 and rolvaliduntil is null and rolconfig is null and not exists(select 1 from pg_auth_members where member=pg_roles.oid) as disabled_exact from pg_roles where rolname='n88_backend';");
  if(before?.rows?.length!==1||before.rows[0].disabled_exact!==true)fail('n88_restored_public_challenge_preimage');
  const result=await sqlFile("select split_part(split_part(rolpassword,'$',2),':',2) as salt,split_part(split_part(rolpassword,'$',2),':',1) as iterations from pg_authid where rolname='n88_backend' and not rolcanlogin and split_part(rolpassword,'$',1)='SCRAM-SHA-256';");
  const challenge=result?.rows?.[0];if(result?.rows?.length!==1||challenge.iterations!=='16384'||!/^[A-Za-z0-9+/]{22}==$/.test(challenge.salt))fail('n88_restored_public_challenge_shape');
  state.restoredPublicChallengeConsumed=true;await save(state);
  try{
   await sqlFile("do $$ begin if not exists(select 1 from pg_roles where rolname='n88_backend' and not rolcanlogin and not rolinherit and not rolsuper and not rolbypassrls and not rolcreatedb and not rolcreaterole and not rolreplication and rolconnlimit=-1 and rolvaliduntil is null and rolconfig is null and not exists(select 1 from pg_auth_members where member=pg_roles.oid)) then raise exception 'n88_restore_preimage'; end if; alter role n88_backend login; end $$;");
   const diagnostic=await serverFirst({...challenge,ca:await readFile(path.join(base,'ca/supabase-prod-ca-2021.crt'),'utf8')});
   state.restoredPublicDiagnostic={runId:'9190735f-6ed0-4513-8ef1-5a3ef24ec6f8',projectId:project,...diagnostic,verifierWritten:false,temporaryLoginOnly:true};await save(state);
   await writeFile(path.join(base,'hosted-scram-restored-challenge.json'),JSON.stringify(state.restoredPublicDiagnostic,null,2)+'\n');
   return state.restoredPublicDiagnostic;
  }finally{await sqlFile('alter role n88_backend nologin;');state.loginDisarmed=true;await save(state);}
 }
 if(action==='--server-first'){
  if(state.publicChallengeConsumed)fail('n88_public_challenge_already_consumed');
  const q="select split_part(split_part(rolpassword,'$',2),':',2) as salt,split_part(split_part(rolpassword,'$',2),':',1) as iterations from pg_authid where rolname='n88_backend' and not rolcanlogin and not rolinherit and not rolsuper and not rolcreatedb and not rolcreaterole and not rolreplication and not rolbypassrls and rolconnlimit=-1 and rolvaliduntil is null and not exists(select 1 from pg_auth_members where member=pg_authid.oid) and split_part(rolpassword,'$',1)='SCRAM-SHA-256';";
  const result=await sqlFile(q),challenge=result?.rows?.[0];
  if(result?.rows?.length!==1||challenge.iterations!=='16384'||!/^[A-Za-z0-9+/]{22}==$/.test(challenge.salt))fail('n88_own_public_challenge_state_mismatch');
  state.publicChallengeConsumed=true;await save(state);
  const diagnostic=await serverFirst({...challenge,ca:await readFile(path.join(base,'ca/supabase-prod-ca-2021.crt'),'utf8')});
  const receipt={runId:'9190735f-6ed0-4513-8ef1-5a3ef24ec6f8',projectId:project,...diagnostic,verifierWritten:false,loginRestored:false};
  state.publicChallengeDiagnostic=receipt;await save(state);
  await writeFile(path.join(base,'hosted-scram-public-challenge.json'),JSON.stringify(receipt,null,2)+'\n');
  return receipt;
 }
 if(action==='--ingress'){
  if(state.ingress)fail('n88_ingress_already_bound');
  const der=Buffer.from(state.recipient,'base64');let plain;
  try{const key=createPrivateKey({key:der,format:'der',type:'pkcs8'});plain=privateDecrypt({key,oaepHash:'sha256',padding:constants.RSA_PKCS1_OAEP_PADDING},Buffer.from(value,'base64'));const envelope=JSON.parse(plain.toString());if(envelope.project!==project||envelope.worker!=='rakeez-n88-private-ingress'||!/^[a-f0-9]{64}$/.test(envelope.ingress))fail('n88_ingress_envelope_mismatch');state.ingress=envelope.ingress;delete state.recipient;await save(state);}
  finally{der.fill(0);plain?.fill(0);}return {ingressReceived:true,valuesReturned:false};
 }
 if(action==='--provision-login'){
  if(state.loginAttempted)fail('n88_login_attempt_already_consumed');
  const meta=await sqlFile("select rolcanlogin,rolsuper,rolbypassrls,rolcreatedb,rolcreaterole,rolreplication from pg_roles where rolname='n88_backend';");
  if(meta?.rows?.length!==1||Object.values(meta.rows[0]).some(Boolean))fail('n88_existing_role_not_fresh_restricted');
  state.loginAttempted=true;await save(state);
  await sqlFile(`alter role n88_backend nologin password '${deriveScram(state.password)}';`);
  state.passwordAcknowledged=true;await save(state);return {passwordAcknowledged:true,loginEnabled:false,verifierValuesReturned:false};
 }
 if(action==='--verify-credential'){
  if(!state.passwordAcknowledged||state.authenticationAttempted)fail('n88_credential_verification_gate');
  const ownedRole="rolname='n88_backend' and not rolcanlogin and not rolinherit and not rolsuper and not rolcreatedb and not rolcreaterole and not rolreplication and not rolbypassrls and rolconnlimit=-1 and rolvaliduntil is null and not exists(select 1 from pg_auth_members where member=pg_authid.oid)";
  const challenge=await sqlFile("select split_part(split_part(rolpassword,'$',2),':',2) as salt,split_part(split_part(rolpassword,'$',2),':',1) as iterations from pg_authid where "+ownedRole+" and split_part(rolpassword,'$',1)='SCRAM-SHA-256';");
  const c=challenge?.rows?.[0];
  if(challenge?.rows?.length!==1||c.iterations!=='16384'||!/^[A-Za-z0-9+/]{22}==$/.test(c.salt))fail('n88_public_challenge_shape');
  const salted=pbkdf2Sync(state.password,Buffer.from(c.salt,'base64'),16384,32,'sha256');
  const client=createHmac('sha256',salted).update('Client Key').digest();
  const stored=createHash('sha256').update(client).digest(),server=createHmac('sha256',salted).update('Server Key').digest();
  try{
   const comparison=await sqlFile(`select split_part(split_part(rolpassword,'$',2),':',2)='${c.salt}' as challenge_matches,split_part(split_part(rolpassword,'$',3),':',1)='${stored.toString('base64')}' as stored_matches,split_part(split_part(rolpassword,'$',3),':',2)='${server.toString('base64')}' as server_matches from pg_authid where ${ownedRole};`);
   if(comparison?.rows?.length!==1||Object.values(comparison.rows[0]).some(v=>v!==true))fail('n88_credential_equality_failed');
   state.credentialVerified=true;await save(state);
   return {storedKeyMatchesOriginalCredential:true,serverKeyMatchesOriginalCredential:true,loginEnabled:false,authenticationAttempts:0,secretValuesReturned:false};
  }finally{salted.fill(0);client.fill(0);stored.fill(0);server.fill(0);}
 }
 if(action==='--arm-login'){
  if(!state.credentialVerified||state.authenticationAttempted||state.loginAcknowledged)fail('n88_login_arm_gate');
  const result=await sqlFile("select rolcanlogin,rolinherit,rolsuper,rolbypassrls,rolcreatedb,rolcreaterole,rolreplication,rolconnlimit,rolvaliduntil,rolconfig,has_database_privilege('n88_backend','postgres','CONNECT') as database_connect,(select count(*)::int from pg_auth_members where member=pg_roles.oid) as memberships from pg_roles where rolname='n88_backend';");
  const r=result?.rows?.[0];
  if(result?.rows?.length!==1||!r||['rolcanlogin','rolinherit','rolsuper','rolbypassrls','rolcreatedb','rolcreaterole','rolreplication'].some(k=>r[k]!==false)||r.rolconnlimit!==-1||r.rolvaliduntil!==null||r.rolconfig!==null||r.memberships!==0||r.database_connect!==true)fail('n88_login_preconditions_failed');
  await sqlFile('alter role n88_backend login;');
  state.loginAcknowledged=true;await save(state);return {loginAcknowledged:true,connectPermission:true,noMemberships:true,authenticationAttempts:0};
 }
 if(action==='--check-session'){
  if(!state.loginAcknowledged||!state.credentialVerified||state.authenticationAttempted)fail('n88_initial_authentication_gate');
  const {Client}=createRequire(import.meta.url)('C:/Users/Abody/Projects/RakeezX/artifacts/n77-native-pg17/client/node_modules/pg');
  const ca=await readFile(path.join(base,'ca/supabase-prod-ca-2021.crt'),'utf8');
  const client=new Client({host:'aws-0-ap-south-1.pooler.supabase.com',port:5432,user:'n88_backend.'+project,password:state.password,database:'postgres',ssl:{ca,rejectUnauthorized:true,servername:'aws-0-ap-south-1.pooler.supabase.com',minVersion:'TLSv1.2'},connectionTimeoutMillis:5000,statement_timeout:3000,query_timeout:4000,application_name:'n88-private-server'});
  state.authenticationAttempted=true;await save(state);
  try{
   await client.connect();
   const session=(await client.query('select current_user as role,session_user as login,pg_backend_pid() as pid,(select ssl from pg_stat_ssl where pid=pg_backend_pid()) as upstream_ssl')).rows[0];
   if(session.role!=='n88_backend'||session.login!=='n88_backend'||!client.connection.stream.authorized||!session.upstream_ssl)fail('n88_restricted_tls_identity_failed');
   await client.query('begin');await client.query("set local search_path=pg_catalog");const current=(await client.query('select pg_backend_pid() as pid,current_user as role')).rows[0];await client.query('rollback');
   if(current.pid!==session.pid||current.role!==session.role)fail('n88_session_mode_identity_failed');
   // Exact actual source guard; only unused package imports are stubbed, not DB.
   const esbuild=createRequire(import.meta.url)('C:/Users/Abody/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/esbuild/lib/main.js');
   const unused={name:'unused-packages',setup(b){b.onResolve({filter:/^(pg|@supabase\/auth-js)$/},a=>({path:a.path,namespace:'unused',sideEffects:false}));b.onLoad({filter:/.*/,namespace:'unused'},()=>({contents:'export default {};export class AuthClient {}',loader:'js'}));}};
   const bundled=await esbuild.build({stdin:{contents:"export {assertPrivateDatabaseSession} from './drafts/n88-student-portal/existing-host.mjs';",resolveDir:root},bundle:true,format:'esm',platform:'node',write:false,plugins:[unused],logLevel:'silent'});
   const {assertPrivateDatabaseSession}=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].contents).toString('base64'));
   await assertPrivateDatabaseSession(client);state.loginVerified=true;await save(state);
   return {restrictedRoleVerified:true,sessionModeVerified:true,frontendTls:client.connection.stream.getProtocol(),upstreamSsl:session.upstream_ssl,actualSourceBoundaryAndCaptureGuard:true};
  }catch(e){
   state.initialConnectionFailure=/^[0-9A-Z]{5}$/.test(e.code??'')?e.code:'SOURCE_OR_TRANSPORT';
   await save(state);
   await sqlFile('alter role n88_backend nologin;');
   state.loginDisarmed=true;await save(state);
   await writeFile(path.join(base,'hosted-initial-session.json'),JSON.stringify({status:'FAIL',runId:run,projectId:project,sqlstate:state.initialConnectionFailure,authenticationAttempts:1,credentialEqualityPassed:true,loginDisarmed:true,retryForbidden:true,privateQueriesExecuted:false})+'\n');
   fail('n88_initial_session_'+state.initialConnectionFailure);
  }finally{await client.end().catch(()=>{});}
 }
 if(action==='--install-env'){
  if(!state.directVerified||!state.ingress||state.installed)fail('n88_install_gate_missing');
  const publicConfig=JSON.parse(await readFile(path.join(base,'public-provider-config.json'),'utf8'));
  if(publicConfig.project!==project||typeof publicConfig.authPublicKey!=='string')fail('n88_public_configuration_missing');
  const env={N88_ENABLED:'false',N88_READINESS_ENABLED:'true',N88_SERVICE_SOURCE_SHA:state.directSource,N88_PUBLIC_ORIGIN:'https://rakeezx.com',N88_AUTH_URL:'https://'+project+'.supabase.co',N88_AUTH_API_KEY:publicConfig.authPublicKey,N88_SERVICE_REVISION:'n88-integrated-class-v1',N88_DATABASE_URL:`postgresql://n88_backend:${state.password}@db.${project}.supabase.co:5432/postgres`,N88_DATABASE_CA_CERT:await readFile(path.join(base,'ca/supabase-prod-ca-2021.crt'),'utf8'),N88_HMAC_KEY:state.hmac,N88_NUMERIC_KEY:state.numeric,N88_RESERVATION_KEY:state.reservation,N88_INGRESS_KEY:state.ingress,N88_RECOVERY_ACTIVE_VERSION:state.recoveryVersion,N88_RECOVERY_VERSIONS:state.recoveryVersion,['N88_RECOVERY_KEY_'+state.recoveryVersion]:state.recovery};
  const file=path.join(phase,'owned-env.tmp');
  try{await writeFile(file,Object.entries(env).map(([k,v])=>k+'='+JSON.stringify(v)).join('\n')+'\n',{flag:'wx'});await official(['secrets','set','--project-ref',project,'--env-file',file]);state.installed=true;await save(state);}
  finally{await unlink(file).catch(e=>{if(e.code!=='ENOENT')throw e;});}
  return {installed:true,enabled:false,names:Object.keys(env),recoveryVersion:state.recoveryVersion,backup:'CurrentUser DPAPI immutable version material retained in owned protected custody; no plaintext temporary input retained'};
 }
 fail('n88_unknown_custodian_action');
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){try{console.log(JSON.stringify(await execute(process.argv[2],process.argv[3])));}catch(e){console.error(JSON.stringify({status:'FAIL',code:/^n88_[a-zA-Z0-9_]+$/.test(e.message)?e.message:'n88_custodian_failed_private_diagnostics_suppressed'}));process.exitCode=1;}}
