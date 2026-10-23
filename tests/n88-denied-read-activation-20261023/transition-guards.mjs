/** AI: fabricated pure guard cases; no private material/provider or benchmark. */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {taskId,custodianSession,n44Task,n44Session,priorSource,successorSource,hash,canonical,nonPinDigest,reconstructExactChanges,qualifyConfigurationDelta,qualifyAuthority,qualifyReservation,qualifyNativePreflight} from '../../drafts/n88-student-portal/activation/denied-read-20261023/transition-guards.mjs';
const prior=canonical([{name:'N88_SERVICE_SOURCE_SHA',digest:hash(priorSource)},{name:'N88_CRITICAL',digest:hash('fabricated-fixed')},{name:'N44_SESSION_POLICY_JSON',digest:hash('fabricated-prior')}]);
const current=structuredClone(prior);current.find(r=>r.name==='N44_SESSION_POLICY_JSON').digest=hash('fabricated-current');
const keyset=hash(JSON.stringify(prior.map(r=>r.name)));
const certificate={taskId:n44Task,sessionId:n44Session,runId:'fabricated-run',candidateSha:'1'.repeat(40),certificateSha256:'2'.repeat(64),committed:true,producerFinished:true,publicOperationProofsVerified:true,beforeAggregate:nonPinDigest(prior),afterAggregate:nonPinDigest(current),keysetDigest:keyset,changes:[{name:'N44_SESSION_POLICY_JSON',previousDigest:hash('fabricated-prior'),currentDigest:hash('fabricated-current')}]};
assert.deepEqual(reconstructExactChanges(current,[certificate],keyset),prior);
for(const change of [c=>c.committed=false,c=>c.producerFinished=false,c=>c.publicOperationProofsVerified=false,c=>c.sessionId='foreign',c=>c.candidateSha='bad',c=>c.beforeAggregate='0'.repeat(64),c=>c.afterAggregate='0'.repeat(64),c=>c.keysetDigest='0'.repeat(64),c=>c.changes[0].name='N88_CRITICAL',c=>c.changes[0].name='N44_UNKNOWN',c=>c.changes[0].currentDigest='0'.repeat(64),c=>c.changes.push({...c.changes[0]}),c=>c.extra=true]){const c=structuredClone(certificate);change(c);assert.throws(()=>reconstructExactChanges(current,[c],keyset));}
const altered=structuredClone(current);altered.find(r=>r.name==='N88_CRITICAL').digest=hash('drift');assert.throws(()=>reconstructExactChanges(altered,[certificate],keyset));
assert.throws(()=>reconstructExactChanges([...current,{name:'UNKNOWN',digest:hash('extra')}],[certificate],keyset));
assert.throws(()=>qualifyConfigurationDelta({current,certificates:[certificate],expectedBaseline:nonPinDigest(prior),expectedKeyset:keyset}));
assert.throws(()=>qualifyConfigurationDelta({current,certificates:[]}));
const state={directSource:priorSource,directVerified:true,typedReadActivation:{migrationVerified:true,migrationVersion:'20261023070851'}};
assert.equal(qualifyReservation({state,history:[{taskId:'prior-consumed-task'}],markerExists:false}),true);
for(const options of [{markerExists:true},{history:[{taskId}]},{source:priorSource},{state:{...state,directSource:successorSource}},{state:{...state,loginDisarmed:true}},{state:{...state,typedReadActivation:{migrationVerified:false}}}])assert.throws(()=>qualifyReservation({state,history:[],markerExists:false,...options}));
const card=JSON.parse((await readFile('C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/'+taskId+'.json','utf8')).replace(/^\uFEFF/,''));
const binding={runId:'c0517e1d-9924-46ff-a881-aef0c4538cff',candidateSha:'3'.repeat(40),sessionId:custodianSession};assert.equal(qualifyAuthority(card,binding),true);
for(const mutation of [c=>c.preparationAuthority.newMigrations=1,c=>c.preparationAuthority.maxChangedNativeFunctionUploads=2,c=>c.preparationAuthority.realAccountReads=1,c=>c.sessionId='foreign',c=>c.preparationAuthority.resetConsumedMarkers=true]){const c=structuredClone(card);mutation(c);assert.throws(()=>qualifyAuthority(c,binding));}
const native={status:'ACTIVE',version:66,verifyJwt:false,source:priorSource,downloadedBytesExact:true,importMapExact:true,importMapDigest:'24ba16ed2214c582f8386253a2714917a669f74fd19b2d2e5ac339f6498b43c8',observedAt:new Date().toISOString()};
assert.equal(qualifyNativePreflight({native,configuration:{status:'PASS',pinDigest:hash(priorSource)}}),true);
for(const patch of [{version:67},{source:successorSource},{downloadedBytesExact:false},{importMapExact:false},{observedAt:'2000-01-01T00:00:00Z'},{verifyJwt:true}])assert.throws(()=>qualifyNativePreflight({native:{...native,...patch},configuration:{status:'PASS',pinDigest:hash(priorSource)}}));
assert.throws(()=>qualifyNativePreflight({native,configuration:{status:'PASS',pinDigest:hash(successorSource)}}));
assert.throws(()=>qualifyNativePreflight({native:{...native,importMapDigest:'0'.repeat(64)},configuration:{status:'PASS',pinDigest:hash(priorSource)}}));
const report={aiAuthored:true,status:'PASS',syntheticOnly:true,providerOperations:0,privateCustodyAccess:false,checks:['exact certificate reconstruction; uncommitted/active/foreign/tampered/unknown key and critical drift denied','fixed original baseline cannot be adopted or replaced','old consumed history retained; duplicate reservation/unknown outcome blocks replay','exact authority and source/native/map/freshness prerequisites'],actualCertificateVerified:false};
await writeFile('tests/n88-denied-read-activation-20261023/transition-guards.json',JSON.stringify(report,null,2)+'\n');console.log('PASS: exact pure transition/configuration/reservation guards; no provider operations.');
