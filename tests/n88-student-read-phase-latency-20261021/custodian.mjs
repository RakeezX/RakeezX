/** AI: exact phase launcher; no secret arguments, only original-custodian cwd. */
import {spawnSync} from 'node:child_process';import {writeFile} from 'node:fs/promises';import path from 'node:path';
import {LATENCY as c} from './native-gate.mjs';
const action=process.argv[2],candidate=process.argv[3];if(!['preflight','upload','pin','complete','static-preflight','static-begin','static-complete'].includes(action)||!/^[a-f0-9]{40}$/.test(candidate??''))throw Error('bounded phase and candidate required');
const r=spawnSync(process.execPath,[path.resolve('drafts/n88-student-portal/official-activation.mjs'),'--latency-'+action],{cwd:c.originalRoot,env:{...process.env,N88_LATENCY_RUN_ID:c.run,N88_LATENCY_CANDIDATE:candidate},encoding:'utf8',windowsHide:true,timeout:100000,maxBuffer:16384});
let reply;try{reply=JSON.parse((r.status===0?r.stdout:r.stderr).trim());}catch{reply={status:'FAIL',code:r.error?.code==='ETIMEDOUT'?'n88_latency_custodian_timeout':'n88_latency_custodian_unclassified'};}
const report={taskId:c.task,runId:c.run,candidateSha:candidate,observedAt:new Date().toISOString(),...reply};
await writeFile(c.evidence+'custodian-'+action+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(report));if(r.status!==0)process.exitCode=1;
