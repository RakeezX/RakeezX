/** AI: one actual original-custodian read-only preflight, with owned phase lease cleanup. */
import {execFileSync,spawnSync} from 'node:child_process';
import {writeFile} from 'node:fs/promises';
import path from 'node:path';
import {STUDENT_SESSION_STATIC as c} from '../../drafts/n88-student-portal/activation/static-student-session-20261021-gate.mjs';
const root='C:/Users/Abody/Projects/RakeezX',taskFile=root+'/artifacts/ops-supervisor-v4/queue/'+c.task+'.json';
const report={taskId:c.task,runId:c.run,preparedCandidate:c.candidate,observedAt:new Date().toISOString(),status:'FAIL',staticUploads:0,nativeUploads:0,readinessRequests:0};
let owned=false;
const lease=action=>execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-File',root+'/scripts/ops-supervisor-v4/resource-lease.ps1','-Name','integration','-Action',action,'-TaskFile',taskFile,'-OwnerToken',c.run,'-WaitSeconds','0'],{encoding:'utf8',windowsHide:true,timeout:20000}).trim();
try{
 const admission=lease('acquire');if(!/^(ACQUIRED|ALREADY OWNED)/.test(admission))throw Error('n88_static_integration_lease_not_acquired');owned=true;report.leaseAcquired=true;
 const result=spawnSync(process.execPath,[path.resolve('drafts/n88-student-portal/official-activation.mjs'),'--student-session-static-owned-preflight'],{cwd:c.originalRoot,env:{...process.env,N88_STUDENT_SESSION_RUN_ID:c.run},encoding:'utf8',windowsHide:true,timeout:60000,maxBuffer:4096});
 report.exitCode=result.status;
 let reply;try{reply=JSON.parse((result.status===0?result.stdout:result.stderr).trim());}catch{reply={status:'FAIL',code:result.error?.code==='ETIMEDOUT'?'n88_original_custodian_timeout':'n88_original_custodian_unclassified'};}
 if(result.status===0&&reply.status==='PASS'){report.status='PASS';report.nativeSource=reply.nativeSource;report.publicPinMatches=reply.publicPinMatches;report.originalOwner=reply.originalOwner;report.attemptAvailable=reply.attemptAvailable;}
 else{report.code=/^n88_[a-zA-Z0-9_]+$/.test(reply.code||'')?reply.code:'n88_original_custodian_unclassified';process.exitCode=1;}
}catch(e){report.code=/^n88_[a-zA-Z0-9_]+$/.test(e.message||'')?e.message:'n88_static_phase_admission_failed';process.exitCode=1;}
finally{
 if(owned){try{const released=lease('release');report.leaseReleased=/^(RELEASED|Already free)/.test(released);}catch{report.leaseReleased=false;process.exitCode=1;}}
 await writeFile(c.evidence+'owned-preflight.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}
