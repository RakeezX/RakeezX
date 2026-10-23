import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {qualifyActivationReceipts} from '../../drafts/n88-student-portal/activation/read-service-20261023/native-activation.mjs';
const now=Date.now(),manifest={native:'synthetic-source'},run='synthetic-run',sha='a2d840e6b4b35f1be968f332773a78640a45b4529a54d3ae98c92fba3f47da50';
const input={manifest,run,now,before:{status:'PASS',runId:run,source:manifest.native,observedAt:new Date(now).toISOString(),configurationReconciliation:{status:'PASS'}},catalog:{status:'PASS',runId:run,source:manifest.native,mode:'serial',routineCount:76,newFunctionsPresent:false,exactPreparedMigrationPreviouslyApplied:false},carrier:{runId:run,qualification:{status:'PASS',sourceSha256:sha},rawProviderReadback:{sourceSha256:sha}}};
qualifyActivationReceipts(input);
for(const field of ['before','catalog','carrier']){const x=structuredClone(input);x[field].runId='foreign';assert.throws(()=>qualifyActivationReceipts(x),/prerequisite/);}
let x=structuredClone(input);x.before.configurationReconciliation.status='FAIL';assert.throws(()=>qualifyActivationReceipts(x),/config_prerequisite/);
x=structuredClone(input);x.now+=20*60*1000+1;assert.throws(()=>qualifyActivationReceipts(x),/config_prerequisite/);
x=structuredClone(input);x.catalog.mode='batch';assert.throws(()=>qualifyActivationReceipts(x),/catalog_prerequisite/);
x=structuredClone(input);x.catalog.exactPreparedMigrationPreviouslyApplied=true;assert.throws(()=>qualifyActivationReceipts(x),/catalog_prerequisite/);
x=structuredClone(input);x.carrier.rawProviderReadback.sourceSha256='foreign';assert.throws(()=>qualifyActivationReceipts(x),/carrier_prerequisite/);
await writeFile(new URL('./activation-gates-local.json',import.meta.url),JSON.stringify({aiAuthored:true,status:'PASS',syntheticOnly:true,checks:['qualified receipt combination','foreign runs deny','unclassified config deny','stale config deny','already-added catalog/history deny','carrier bytes mismatch deny'],providerOperations:0},null,2)+'\n');
console.log('PASS: activation receipt prerequisites; original wx reservation/ACK route retained.');
