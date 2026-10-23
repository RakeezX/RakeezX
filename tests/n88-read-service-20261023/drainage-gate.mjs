import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {qualifyDrainage} from '../../drafts/n88-student-portal/activation/read-service-20261023/migration-activation.mjs';
const at=Date.now(),r={status:'PASS',nativeUploads:1,pinUpdates:1,verifiedAt:new Date(at).toISOString(),provider:{sourceExact:true,version:66,verifyJwt:false}};
assert.throws(()=>qualifyDrainage(r,at+409999),/drainage_not_established/);
assert.equal(qualifyDrainage(r,at+410000).maximumHostedWorkerLifetimeSeconds,400);
for(const patch of [{status:'FAIL'},{nativeUploads:0},{pinUpdates:0},{verifiedAt:'invalid'},{provider:{...r.provider,sourceExact:false}},{provider:{...r.provider,version:64}},{provider:{...r.provider,verifyJwt:true}}])assert.throws(()=>qualifyDrainage({...r,...patch},at+410000),/drainage_not_established/);
await writeFile(new URL('./drainage-gate-local.json',import.meta.url),JSON.stringify({aiAuthored:true,status:'PASS',syntheticOnly:true,checks:['no early DDL eligibility','410-second conservative boundary','unknown source/ACK/pin/version deny'],basis:'Documented global successful deployment and maximum hosted worker lifetime; not direct worker inventory',providerOperations:0},null,2)+'\n');
console.log('PASS: conservative documented-lifetime prerequisite; no provider/DDL.');
