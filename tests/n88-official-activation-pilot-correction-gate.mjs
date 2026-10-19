/** AI: exact restoration preimage remains fail-closed; no provider/custody access. */
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {pilotCorrectionRestoreReady} from '../drafts/n88-student-portal/activation/pilot-ui-correction-gate.mjs';
const source='a'.repeat(64),gates=['enabledOff','modePilot','bindingMatches','sourceMatches','localUiPass','localPackagePass','historicalFailureMatches','stageAuthorized'];
const r={httpStatus:200,status:'ready',source,expectedSource:source,enabled:false,rolloutMode:'pilot',...Object.fromEntries(['loginExact','roleExact','upstreamSsl','clientTlsAuthorized','sourceBoundary','configurationReady','rolloutConfigured','sourceMatches'].map(k=>[k,true]))};
const input={source,readiness:r,alreadyRestored:false,...Object.fromEntries(gates.map(k=>[k,true]))};assert.equal(pilotCorrectionRestoreReady(input),true);
for(const k of gates)for(const value of [false,undefined,'true'])assert.equal(pilotCorrectionRestoreReady({...input,[k]:value}),false);
assert.equal(pilotCorrectionRestoreReady({...input,alreadyRestored:true}),false);
for(const change of [{source:'b'.repeat(64)},{enabled:true},{rolloutMode:'public'},{sourceBoundary:false},{upstreamSsl:false},{loginExact:false}])assert.equal(pilotCorrectionRestoreReady({...input,readiness:{...r,...change}}),false);
const result={runId:'75c77bea-eec3-4a4e-9749-42ab3982de7e',status:'PASS',checks:['exact current OFF/pilot/binding/source/local-proof/history/authority preimage','missing, malformed, mismatch, replay and non-strict TLS/source fail closed','no provider, credentials, database or fixture touched']};await writeFile('tests/n88-official-activation-pilot-correction-gate.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
