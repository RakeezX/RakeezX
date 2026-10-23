/** AI: synthetic negative boundaries; no provider or custody access. */
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {hash} from '../../drafts/n88-student-portal/activation/read-service-20261023/prepare.mjs';
import {nonPinDigest} from '../../drafts/n88-student-portal/activation/read-service-20261023/config-provenance.mjs';
import {verifyExactDelta,producerTask,producerSession,historicalAggregate} from '../../drafts/n88-student-portal/activation/read-service-20261023/exact-delta.mjs';
const current=[{name:'N44_ONE_DEVICE_TEST_JSON',digest:hash('null')},{name:'N44_DELIVERY_ENABLED',digest:hash('false')},{name:'N88_HMAC_KEY',digest:hash('fabricated-only')},{name:'N88_SERVICE_SOURCE_SHA',digest:hash('fabricated-pin')}];
const binding={taskId:producerTask,sessionId:producerSession,runId:'synthetic-run',candidateSha:'a'.repeat(40),committed:true,publicProofsVerified:true};
const proof={taskId:binding.taskId,sessionId:binding.sessionId,runId:binding.runId,candidateSha:binding.candidateSha,currentAggregate:nonPinDigest(current),keysetDigest:hash(JSON.stringify(current.map(r=>r.name).sort((a,b)=>a.localeCompare(b)))),reconstructedAggregate:historicalAggregate,changes:[{name:'N44_ONE_DEVICE_TEST_JSON',priorDigest:hash('fabricated-approval'),currentDigest:hash('null')}]};
const run=(p=proof,c=current,b=binding)=>verifyExactDelta({current:c,proof:p,binding:b});
assert.throws(()=>run(),/reconstruction/); // Fabricated history can never reproduce fixed real baseline.
assert.throws(()=>run({...proof,extra:true}),/proof_shape/);
assert.throws(()=>run({...proof,sessionId:'foreign'}),/binding/);
assert.throws(()=>run(proof,current,{...binding,committed:false}),/binding/);
assert.throws(()=>run(proof,current,{...binding,publicProofsVerified:false}),/binding/);
assert.throws(()=>run({...proof,runId:'stale'}),/binding/);
assert.throws(()=>run({...proof,changes:[{...proof.changes[0],name:'N88_HMAC_KEY'}]}),/required_disarm/);
assert.throws(()=>run({...proof,changes:[...proof.changes,{name:'N44_UNKNOWN',priorDigest:hash('x'),currentDigest:hash('null')}]}),/change_identity/);
assert.throws(()=>run({...proof,changes:[{...proof.changes[0],currentDigest:hash('tampered')}]}),/disarmed_identity/);
assert.throws(()=>run({...proof,keysetDigest:hash('tampered')}),/current_identity/);
assert.throws(()=>run(proof,[...current,{name:'UNKNOWN_KEY',digest:hash('extra')}] ),/current_identity/);
assert.throws(()=>run(proof,current.map(r=>r.name==='N88_HMAC_KEY'?{...r,digest:hash('changed-critical')}:r)),/current_identity/);
assert.throws(()=>run(proof,current.filter(r=>r.name!=='N44_DELIVERY_ENABLED')),/current_identity/);
assert.throws(()=>run({...proof,changes:[proof.changes[0],proof.changes[0]]}),/changes_shape/);
assert.throws(()=>verifyExactDelta({current,proof,binding,expectedHistoricalAggregate:hash('new-baseline')}),/historical_identity/);
await writeFile(new URL('./exact-delta-local.json',import.meta.url),JSON.stringify({aiAuthored:true,status:'PASS',syntheticDataOnly:true,positiveHistoricalReconstruction:'NOT_RUN pending actual committed original certificate',negativeCases:15,protects:['fixed historical aggregate','finite exact keys','unknown/missing/critical drift','tampered shape/digest/keyset','foreign/stale/uncommitted/unproved binding'],providerOperations:0},null,2)+'\n');
console.log('PASS: fixed-baseline certificate negative boundaries; actual positive proof remains pending.');
