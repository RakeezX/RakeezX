/** AI: current 45-minute original-custodian relay; migration dispatch belongs to root only. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import manifest from './manifest.json' with {type:'json'};
import {taskId,runId,projectRef,sha,preSql,postSql,verifySources,loadSavedRecord,validatePre,validateOriginalTarget,bind,admit,validatePost,reconcileReadback,toolLifecycle,TOOL_WINDOW_MS} from './admission.mjs';
const root=fileURLToPath(new URL('../../../../',import.meta.url)),canonical='C:/Users/Abody/Projects/RakeezX';
const psExe='C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe';
const lease=(name,action)=>execFileSync(psExe,['-NoProfile','-NonInteractive','-ExecutionPolicy','RemoteSigned','-File',canonical+'/scripts/ops-supervisor-v4/resource-lease.ps1','-Name',name,'-Action',action,'-TaskFile',canonical+'/artifacts/ops-supervisor-v4/queue/'+taskId+'.json','-WaitSeconds','0','-OwnerToken',runId],{encoding:'utf8',windowsHide:true,timeout:15000}).trim();
const readbackOnly=process.argv[2]==='--readback-only';
if(path.resolve(process.cwd())!==path.resolve(root)||!['--window-original-custodian-files','--readback-only'].includes(process.argv[2])||process.argv[3])throw Error('n88_explicit_current_phase_required');
await verifySources();
const reconciliation=await readFile(manifest.originalReconciliation.path);
if(sha(reconciliation)!==manifest.originalReconciliation.sha256||JSON.parse(reconciliation).state!=='VERIFIED_NO_CHANGE'||JSON.parse(reconciliation).observerRunId!==runId)throw Error('n88_original_reconciliation_not_qualified');
const phase=path.join(root,'artifacts',taskId+'-'+runId+(readbackOnly?'-window-readback':'-window-v1')+'.tmp');
await mkdir(phase,{recursive:false});const owner={taskId,runId,pid:process.pid,token:randomUUID()};await writeFile(path.join(phase,'owner.json'),JSON.stringify(owner),{flag:'wx'});
const owned=async()=>{if(JSON.stringify(JSON.parse(await readFile(path.join(phase,'owner.json'),'utf8')))!==JSON.stringify(owner))throw Error('n88_relay_ownership');};
let seq=0,closed=false,admission,installationEmitted=false,record,activeLifecycle,activeRequest;const leases=[];
const deadline=new Date(Date.now()+TOOL_WINDOW_MS).toISOString();
const outcome={taskId,runId,projectRef,startedAt:new Date().toISOString(),toolWindowMs:TOOL_WINDOW_MS,deadline,serviceEnabled:false,installationEmitted:false,state:'PREPARING',readbacks:[]};
const checkpoint=async()=>{await owned();await writeFile(path.join(phase,'checkpoint.json'),JSON.stringify(outcome,null,2)+'\n');};
const optional=async file=>{try{return JSON.parse(await readFile(file,'utf8'));}catch(e){if(e.code==='ENOENT'||e instanceof SyntaxError)return null;throw e;}};
const client={async query(sql,args=[]){
 await owned();if(args.length||closed)throw Error('n88_relay_closed');
 const kind=sql===postSql?'read':sql===record?.operations[1].sql&&!readbackOnly?'migration':null;
 if(!kind)throw Error('n88_relay_statement_denied');
 const id=++seq,requestDeadline=kind==='migration'?deadline:new Date(Date.now()+TOOL_WINDOW_MS).toISOString();
 const lifecycle=toolLifecycle(Date.parse(requestDeadline));activeLifecycle=lifecycle;
 const request={id,taskId,runId,projectRef,kind,name:kind==='migration'?'n88_owner_admin_storage_window_20261031':null,sha256:sha(sql),sql,deadline:requestDeadline,originalCustodianOnly:true};
 activeRequest=request;
 if(kind==='migration'){
  if(installationEmitted)throw Error('n88_second_install_denied');installationEmitted=true;outcome.installationEmitted=true;
  await writeFile(path.join(phase,'install-intent.json'),JSON.stringify({taskId,runId,sha256:request.sha256,emittedAt:new Date().toISOString(),deadline}),{flag:'wx'});
 }
 await writeFile(path.join(phase,'request-'+id+'.json'),JSON.stringify(request),{flag:'wx'});
 outcome.state='AWAITING_CUSTODIAN';outcome.currentOperation={id,kind,sha256:request.sha256,deadline:requestDeadline};await checkpoint();
 console.log(JSON.stringify({type:'custodian-operation',id,kind,sha256:request.sha256,deadline:requestDeadline,requestPath:path.join(phase,'request-'+id+'.json'),responsePath:path.join(phase,'response-'+id+'.json'),claimPath:path.join(phase,kind==='migration'?'custodian-dispatch-claim.json':'custodian-read-claim-'+id+'.json')}));
 for(;;){
  await owned();const claim=await optional(path.join(phase,kind==='migration'?'custodian-dispatch-claim.json':'custodian-read-claim-'+id+'.json'));
  if(claim&&lifecycle.state==='AWAITING_CLAIM'){
   if(claim.taskId!==taskId||claim.runId!==runId||(claim.requestId??claim.id)!==id||(claim.sqlSha256??claim.sha256)!==request.sha256||claim.operator!=='root-connected-official-supabase-custodian')throw Error('n88_custodian_claim_binding');
   const claimTimeQualified=lifecycle.claim({claimedAt:claim.claimedAt});outcome.claimTimeQualified=claimTimeQualified;outcome.state=claimTimeQualified?'TOOL_PENDING':'TOOL_PENDING_CLAIM_TIME_UNRESOLVED';outcome.custodianClaim=claim;await checkpoint();
  }
  const response=await optional(path.join(phase,'response-'+id+'.json'));
  if(response){
   if(response.id!==id||response.runId!==runId||response.sha256!==request.sha256)throw Error('n88_response_binding');
   if(kind==='migration'&&lifecycle.canRelease)throw Error('n88_terminal_without_owned_claim');
   if(!lifecycle.canRelease)lifecycle.terminal();activeLifecycle=null;
   outcome.state='TOOL_TERMINAL';outcome.terminalOutcome={id,kind,ok:response.ok,receipt:response.receipt??null,error:response.error??null,observedAt:new Date().toISOString()};await checkpoint();
   if(response.ok!==true){const e=Error('n88_supported_custodian_terminal_failure');e.exactDenial=response.error;throw e;}
   return {rows:response.rows??[],receipt:response.receipt};
  }
  const state=lifecycle.tick();
  if(state==='EXPIRED_UNCLAIMED')throw Error('n88_tool_window_expired_unclaimed');
  if(state==='PENDING_AFTER_WINDOW'&&outcome.state!=='TOOL_PENDING_AFTER_WINDOW'){
   outcome.state='TOOL_PENDING_AFTER_WINDOW';outcome.disposition='Retain owned leases and relay until original call terminal; no new dispatch or replay.';await checkpoint();
   console.log(JSON.stringify({type:'custodian-pending-after-window',id,phase}));
  }
  // A pending owned call is never turned into timeout cleanup. Its terminal
  // response is retained even if it arrives after admission expiry.
  await new Promise(r=>setTimeout(r,250));
 }
}};
try{
 for(const name of readbackOnly?['integration']:['integration','live-mutation']){outcome[name+'Lease']=lease(name,'acquire');leases.push(name);}
 if(readbackOnly){record=await loadSavedRecord();admission=admit(client,record,{taskId,runId},{reconcile:true});}
 else{
  const evidence=await readFile(manifest.currentPreflight.path);if(sha(evidence)!==manifest.currentPreflight.sha256)throw Error('n88_current_preflight_changed');
  const saved=JSON.parse(evidence);if(saved.observerRunId!==runId||saved.sqlSha256!==sha(preSql)||saved.rows.length!==1)throw Error('n88_current_preflight_binding');
  const row=saved.rows[0];validatePre(row);validateOriginalTarget(row.target);record=await bind(row,deadline);outcome.boundInstallerSha256=record.boundInstallerSha256;
  const wrapped={query:async(sql,args)=>sql===preSql?{rows:[row]}:client.query(sql,args)};
  admission=admit(wrapped,record,{taskId,runId});await admission.query(preSql);
  const result=await admission.query(record.operations[1].sql);outcome.migrationReceipt=result.receipt;outcome.migrationAcknowledged=true;await checkpoint();
 }
 const post=await admission.query(postSql);outcome.readbacks.push(post.rows[0]);const assessment=await reconcileReadback(record,post.rows[0]);Object.assign(outcome,assessment);
}catch(e){outcome.state=installationEmitted?(outcome.terminalOutcome?.ok===false?'KNOWN_TERMINAL_FAILURE':outcome.migrationAcknowledged?'INSTALLED_READBACK_INCOMPLETE':'UNKNOWN'):'DENIED';outcome.error=e.message;outcome.exactDenial=e.exactDenial??null;}
finally{
 // Even a local protocol/IO failure cannot dispose resources while the
 // original claimed tool is still pending. Drain only its bound terminal file.
 if(activeLifecycle&&!activeLifecycle.canRelease){
  outcome.state='PENDING_DRAIN_AFTER_LOCAL_ERROR';await checkpoint();
  for(;;){
   const response=await optional(path.join(phase,'response-'+activeRequest.id+'.json'));
   if(response&&response.id===activeRequest.id&&response.runId===runId&&response.sha256===activeRequest.sha256){
    activeLifecycle.terminal();outcome.terminalOutcome={id:activeRequest.id,kind:activeRequest.kind,ok:response.ok,receipt:response.receipt??null,error:response.error??null,observedAt:new Date().toISOString()};
    outcome.state=response.ok===true?'TERMINAL_READBACK_REQUIRED':'KNOWN_TERMINAL_FAILURE';await checkpoint();break;
   }
   await new Promise(r=>setTimeout(r,250));
  }
 }
 closed=true;admission?.close();outcome.cleanup={relayClosed:true,leases:[]};
 for(const name of leases.reverse())try{outcome.cleanup.leases.push({name,result:lease(name,'release')});}catch(e){outcome.cleanup.leases.push({name,result:'FAIL'});}
 outcome.finishedAt=new Date().toISOString();await owned();await writeFile(path.join(phase,'report.json'),JSON.stringify(outcome,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({type:'custodian-result',state:outcome.state,reportPath:path.join(phase,'report.json')}));
}
