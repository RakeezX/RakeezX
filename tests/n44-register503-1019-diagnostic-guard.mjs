/** AI: only new one-probe admission guard; no prior matrix or provider access. */
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {DIAGNOSTIC_SOURCE,assertDiagnosticAttempt} from '../drafts/n44-push/activation/register503-diagnostic-guard.mjs';
const allowed={source:DIAGNOSTIC_SOURCE,consumed:false,cleaned:true,targetBound:false,sends:0};assert.doesNotThrow(()=>assertDiagnosticAttempt(allowed));
for(const change of [{source:'f'.repeat(64)},{consumed:true},{cleaned:false},{targetBound:true},{sends:1}])assert.throws(()=>assertDiagnosticAttempt({...allowed,...change}),/n44_diagnostic_attempt_denied/);
await writeFile('tests/n44-register503-1019-diagnostic-guard.json',JSON.stringify({taskId:'continuous-n44-register503-existing-service-repair-20261019',runId:'3934ca4d-4107-470d-b214-070916b3d526',status:'PASS',sourceSha256:DIAGNOSTIC_SOURCE,checks:['exact_source_only','second_probe_denied','unclean_bound_or_send_state_denied'],scope:'New pure admission guard only. Existing exclusive encrypted fsync journal writer reused unchanged.',providerOperations:0},null,2)+'\n');console.log('PASS: exact-source admission; wrong-source/second-probe/unclean/bound/send denial');
