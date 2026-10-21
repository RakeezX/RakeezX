/** AI: only this task's original-custodian static phase; no upload/SQL/auth API. Caller owns phase leases. */
import {spawnSync} from 'node:child_process';import {writeFile} from 'node:fs/promises';import path from 'node:path';
import {STUDENT_PENDING_STATIC as c} from '../../drafts/n88-student-portal/activation/static-student-pending-20261021-gate.mjs';
const action=process.argv[2];if(!['owned-preflight','read-native-before','read-native-after','preflight','begin','complete'].includes(action))throw Error('bounded action required');
const r=spawnSync(process.execPath,[path.resolve('drafts/n88-student-portal/official-activation.mjs'),'--student-pending-static-'+action],{cwd:c.originalRoot,env:{...process.env,N88_STUDENT_PENDING_RUN_ID:c.run},encoding:'utf8',windowsHide:true,timeout:100000,maxBuffer:16384});
let reply;try{reply=JSON.parse((r.status===0?r.stdout:r.stderr).trim());}catch{reply={status:'FAIL',code:r.error?.code==='ETIMEDOUT'?'n88_custodian_timeout':'n88_custodian_unclassified'};}
const report={taskId:c.task,runId:c.run,preparedCandidate:c.candidate,observedAt:new Date().toISOString(),...reply};
const filename=({'begin':'static-reservation','complete':'static-delivery'})[action]||action;
await writeFile(c.evidence+filename+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(report));if(r.status!==0)process.exitCode=1;
