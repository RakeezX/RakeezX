/** AI: affected one-use orchestration/concurrency only, fabricated ports. */
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {runSuccessorTransition} from '../../drafts/n88-student-portal/activation/denied-read-20261023/activation-transition.mjs';
import {priorSource,successorSource,hash,taskId} from '../../drafts/n88-student-portal/activation/denied-read-20261023/transition-guards.mjs';
function fixture(fault){
 const state={directSource:priorSource,directVerified:true,typedReadActivation:{migrationVerified:true,migrationVersion:'20261023070851'},sourceCorrections:[{taskId:'older-consumed'}]},calls=[];let marker=false,pinMarker=false,version=66,pin=priorSource,reads=0;
 const config=expected=>({status:'PASS',pinDigest:hash(expected),currentNonPinDigest:fault==='config-drift'&&reads++?'changed':'fixed',keysetDigest:'fixed'});
 const ports={verifyCommittedPhase:async()=>{calls.push('phase');if(fault==='phase'||fault==='phase-mid'&&calls.filter(c=>c==='phase').length>3)throw Error('n88_test_uncommitted_phase');},verifyExclusivePhase:async()=>{calls.push('lease');if(fault==='lease')throw Error('n88_test_foreign_lease');},load:async()=>structuredClone(state),save:async s=>{Object.assign(state,structuredClone(s));calls.push('save');},uploadMarkerExists:async()=>marker,readQualifiedMetadata:async expected=>{calls.push('metadata');return config(expected);},readNative:async source=>({status:'ACTIVE',version,source,downloadedBytesExact:true,importMapExact:true,verifyJwt:false,observedAt:new Date().toISOString(),importMapDigest:'24ba16ed2214c582f8386253a2714917a669f74fd19b2d2e5ac339f6498b43c8'}),reserveUpload:async()=>{assert(!marker);marker=true;calls.push('reserve-upload');},reservePin:async()=>{assert(!pinMarker);pinMarker=true;calls.push('reserve-pin');},uploadExactSuccessor:async()=>{calls.push('upload');assert(marker);version=67;if(fault==='upload-unknown')throw Error('n88_test_unknown_upload_ack');},setExactPublicPin:async()=>{calls.push('pin');assert(pinMarker);pin=successorSource;version++;if(fault==='pin-unknown')throw Error('n88_test_unknown_pin_ack');}};
 return {ports,calls,state,getMarker:()=>marker,getPin:()=>pin};
}
const stamp={taskId,runId:'fabricated',candidateSha:'1'.repeat(40),sessionId:'fabricated'};
const good=fixture();const result=await runSuccessorTransition({stamp,certificates:[],ports:good.ports});assert.equal(result.status,'PASS');assert.equal(good.state.directSource,successorSource);assert.equal(good.state.sourceCorrections[0].taskId,'older-consumed');assert.equal(good.state.typedReadActivation.migrationVerified,true);assert.equal(good.calls.filter(c=>c==='upload').length,1);assert.equal(good.calls.filter(c=>c==='pin').length,1);
for(const fault of ['phase','lease','phase-mid','config-drift','upload-unknown','pin-unknown']){
 const f=fixture(fault),r=await runSuccessorTransition({stamp,certificates:[],ports:f.ports});assert.equal(r.status,'BLOCKED');assert.equal(r.automaticRetryAllowed,false);
 if(['phase','lease'].includes(fault))assert(!f.calls.includes('metadata')&&!f.calls.includes('upload')&&!f.calls.includes('pin'));
 if(['config-drift','phase-mid'].includes(fault))assert(!f.calls.includes('pin'));
 if(fault.includes('unknown')){assert(f.getMarker());const before=f.calls.filter(c=>['upload','pin'].includes(c)).length;const again=await runSuccessorTransition({stamp,certificates:[],ports:f.ports});assert.equal(again.status,'BLOCKED');assert.equal(f.calls.filter(c=>['upload','pin'].includes(c)).length,before);}
}
await writeFile('tests/n88-denied-read-activation-20261023/activation-transition.json',JSON.stringify({aiAuthored:true,status:'PASS',syntheticOnly:true,providerOperations:0,checks:['phase and exclusive lease precede provider calls','wx reservation precedes each single operation','concurrent non-pin change blocks pin','unknown upload/pin ACK consumes marker and prevents replay','old migration/source histories retained'],actualServiceProof:false},null,2)+'\n');
console.log('PASS: one-use activation, phase concurrency and ambiguous-ACK guards; fabricated ports only.');
