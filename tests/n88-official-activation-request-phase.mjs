/** AI: fixed phase metadata only; never forward an exception, SQL or private value. */
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {createIntegratedService} from '../drafts/n88-student-portal/integrated-service.mjs';
import {createPostgresRepository} from '../drafts/n88-student-portal/postgres-repository.mjs';
import config from '../drafts/n88-student-portal/deployment.inactive.json' with {type:'json'};
const canary='FABRICATED_PRIVATE_DIAGNOSTIC_CANARY';
for(const supplied of ['acquire','begin','snapshot','operation',canary]){
 const e=Object.assign(Error(canary),{safeStage:supplied});
 const key=n=>Buffer.alloc(32,n);
 const service=createIntegratedService({origin:'https://rakeezx.com',numericKey:key(1),reservationKey:key(2),ingressKey:key(3),secretKey:key(4),recoveryKeys:new Map([['test',key(5)]]),recoveryActiveKeyVersion:'test'}, {verifyIngress:async()=>false}, {transaction:async()=>{throw e;}});
 const binding=Object.fromEntries(['ownerId','sessionId','leaseId','teachingId','classId','termId','contextRevision'].map(k=>[k,'synthetic']));
 const r=await service({path:'/teacher/class/list',method:'POST',body:{binding,teachingId:'synthetic'}});
 assert.equal(r.status,503);assert.equal(r.body.stage,['acquire','begin','snapshot'].includes(supplied)?supplied:'repository');
 assert.ok(!JSON.stringify(r).includes(canary));
}
const repository=createPostgresRepository({...config,acquire:async()=>{throw Error(canary);}});
await assert.rejects(repository.transaction(()=>{throw Error('must not run');}),e=>e.message==='n88_repository_unavailable'&&e.safeStage==='acquire'&&!JSON.stringify(e).includes(canary));
const r={runId:'b324b7b5-5bfa-4ddb-8a92-adde7e26fe04',status:'PASS',checks:['finite phase allowlist; raw error/canary suppressed','503 stays unavailable; callback cannot run after acquire failure','no SQL, role, Auth, private value or guard changes'],hostedProof:false};
await writeFile('tests/n88-official-activation-request-phase.json',JSON.stringify(r,null,2)+'\n');console.log(JSON.stringify(r));
