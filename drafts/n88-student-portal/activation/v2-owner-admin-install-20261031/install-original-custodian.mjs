/** AI: explicit supported-custodian finite file relay. No credentials or SQL executor. */
import {readFile,writeFile,mkdir,unlink} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {taskId,runId,projectRef,sha,preSql,postSql,verifySources,loadSavedRecord,admitPre,validatePre,validateOriginalTarget,bind,admit,validatePost} from './admission.mjs';
const root=fileURLToPath(new URL('../../../../',import.meta.url));
const canonical='C:/Users/Abody/Projects/RakeezX';
const psExe='C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe';
const lease=(name,action)=>execFileSync(psExe,['-NoProfile','-NonInteractive','-ExecutionPolicy','RemoteSigned','-File',canonical+'/scripts/ops-supervisor-v4/resource-lease.ps1','-Name',name,'-Action',action,'-TaskFile',canonical+'/artifacts/ops-supervisor-v4/queue/'+taskId+'.json','-WaitSeconds','0','-OwnerToken',runId],{encoding:'utf8',windowsHide:true,timeout:15000}).trim();
if(path.resolve(process.cwd())!==path.resolve(root)||!['--original-custodian-files','--qualified-original-custodian-files','--reconcile-original-custodian-files'].includes(process.argv[2]))throw Error('n88_explicit_owned_relay_required');
await verifySources();
const reconcile=process.argv[2].startsWith('--reconcile');
const qualified=process.argv[2].startsWith('--qualified');
const afterLeaseFree=reconcile&&process.argv[3]==='--after-lease-free';
if(process.argv[3]&&!afterLeaseFree)throw Error('n88_phase_argument_denied');
const phase=path.join(root,'artifacts',taskId+'-'+runId+(reconcile?(afterLeaseFree?'-reconcile-lease-free':'-reconcile'):qualified?'-qualified-v1':'')+'.tmp');
await mkdir(phase,{recursive:false});const owner={taskId,runId,pid:process.pid,token:randomUUID()};await writeFile(path.join(phase,'owner.json'),JSON.stringify(owner),{flag:'wx'});
const owned=async()=>{if(JSON.stringify(JSON.parse(await readFile(path.join(phase,'owner.json'),'utf8')))!==JSON.stringify(owner))throw Error('n88_relay_ownership');};
let seq=0,closed=false,admission,installationDispatched=false;const leases=[],responses=[];
const deadline=new Date(Date.now()+8*60000).toISOString();
const outcome={taskId,runId,projectRef,startedAt:new Date().toISOString(),serviceEnabled:false,installationDispatched:false,readbacks:[]};
const client={async query(sql,args=[]){
 await owned();if(args.length||closed)throw Error('n88_relay_closed');
 const kind=sql===preSql||sql===postSql?'read':'migration';
 const id=++seq;const request={id,taskId,runId,projectRef,kind,name:kind==='migration'?'n88_owner_admin_storage_20261031':null,sha256:sha(sql),sql};
 if(kind==='migration'){
  if(installationDispatched)throw Error('n88_second_install_denied');installationDispatched=true;outcome.installationDispatched=true;
  await writeFile(path.join(phase,'install-intent.json'),JSON.stringify({taskId,runId,sha256:sha(sql),dispatchedAt:new Date().toISOString()}),{flag:'wx'});
 }
 await writeFile(path.join(phase,'request-'+id+'.json'),JSON.stringify(request),{flag:'wx'});
 console.log(JSON.stringify({type:'custodian-operation',id,kind,sha256:sha(sql),requestPath:path.join(phase,'request-'+id+'.json'),responsePath:path.join(phase,'response-'+id+'.json')}));
 const response=path.join(phase,'response-'+id+'.json');responses.push(response);
 while(!closed&&Date.now()<Date.parse(deadline)){
  try{const r=JSON.parse(await readFile(response,'utf8'));await owned();if(r.id!==id||r.runId!==runId||r.sha256!==request.sha256)throw Error('n88_response_binding');if(r.ok!==true){const e=Error('n88_supported_custodian_rejected');e.exactDenial=r.error;throw e;}return {rows:r.rows??[],receipt:r.receipt};}
  catch(e){if(e.code!=='ENOENT')throw e;}await new Promise(r=>setTimeout(r,50));
 }throw Error('n88_relay_deadline');
}};
try{
 for(const name of reconcile?['integration']:['integration','live-mutation']){outcome[name+'Lease']=lease(name,'acquire');leases.push(name);}
 if(reconcile){
  const record=await loadSavedRecord();
  admission=admit(client,record,{taskId,runId},{reconcile:true});const r=await admission.query(postSql);outcome.readbacks.push(r.rows[0]);
  try{outcome.readback=await validatePost(record,r.rows[0]);outcome.state='INSTALLED_STORAGE_ONLY';}catch(e){outcome.state=JSON.stringify(r.rows[0].snapshot)===JSON.stringify(record.originalSnapshot)?'VERIFIED_NO_CHANGE':'READBACK_INCOMPLETE';outcome.readbackError=e.message;}
 }else{
  let row;
  if(qualified){
   const {default:manifest}=await import('./manifest.json',{with:{type:'json'}});
   const evidence=await readFile(manifest.supportedPreflight.path);if(sha(evidence)!==manifest.supportedPreflight.sha256)throw Error('n88_saved_preflight_changed');
   const saved=JSON.parse(evidence);if(saved.taskId!==taskId||saved.runId!==runId||saved.sqlSha256!==sha(preSql)||saved.rows.length!==1)throw Error('n88_saved_preflight_binding');
   row=saved.rows[0];validatePre(row);validateOriginalTarget(row.target);outcome.reusedSupportedPreflight={sha256:sha(evidence),observationWindow:saved.observationWindow};
  }else row=await admitPre(client,{taskId,runId});
  outcome.readbacks.push(row);const record=await bind(row,deadline);
  // This fresh read was already consumed under the pre-admission. Exact same
  // bound preflight is not dispatched again; finite session begins at migration.
  const wrapped={query:async(sql,args)=>sql===preSql?{rows:[row]}:client.query(sql,args)};
  admission=admit(wrapped,record,{taskId,runId});await admission.query(preSql);
  const r=await admission.query(record.operations[1].sql);outcome.migrationReceipt=r.receipt;outcome.migrationAcknowledged=true;
  const post=await admission.query(postSql);outcome.readbacks.push(post.rows[0]);outcome.readback=await validatePost(record,post.rows[0]);outcome.state='INSTALLED_STORAGE_ONLY';
 }
}catch(e){outcome.state=installationDispatched?(outcome.migrationAcknowledged?'INSTALLED_READBACK_INCOMPLETE':'UNKNOWN'):'DENIED';outcome.error=e.message;outcome.exactDenial=e.exactDenial??null;}
finally{
 closed=true;admission?.close();outcome.cleanup={relayClosed:true,leases:[]};
 for(const name of leases.reverse())try{outcome.cleanup.leases.push({name,result:lease(name,'release')});}catch(e){outcome.cleanup.leases.push({name,result:'FAIL'});}
 for(const file of responses){await owned();try{await unlink(file);}catch(e){if(e.code!=='ENOENT')throw e;}}
 outcome.finishedAt=new Date().toISOString();await owned();await writeFile(path.join(phase,'report.json'),JSON.stringify(outcome,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({type:'custodian-result',state:outcome.state,reportPath:path.join(phase,'report.json')}));
}
