/** AI: actual pooled request-session composition; synthetic ports, no hosted SQL. */
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {prepareRequestSession} from '../drafts/n44-push/request-session.mjs';
import {assertRestrictedIdentity} from '../drafts/n44-push/database-transport.mjs';
import {requestFailure} from '../drafts/n44-push/runtime-failure.mjs';
let role='n44_service_login',privateChecks=0;const sql=[];
const client={connection:{stream:{authorized:true}},query:async q=>{sql.push(q);if(q==='reset role')role='n44_service_login';else if(q==='set role n44_backend')role='n44_backend';else if(q.startsWith('select session_user'))return {rows:[{login:'n44_service_login',role,ssl:role==='n44_service_login'?true:null}]};return {rows:[]};}};
const privateGuard=async(c,onSource)=>{assert.equal(role,'n44_backend');onSource();privateChecks++;};
await prepareRequestSession(client,'direct',privateGuard);assert.equal(role,'n44_backend');
// Reproduce the prior role-retained failure with the unchanged actual guard.
await assert.rejects(()=>assertRestrictedIdentity(client),e=>e.safeReadiness.upstreamSsl===false&&e.safeReadiness.loginExact&&e.safeReadiness.roleExact&&e.safeReadiness.clientTlsAuthorized);
await prepareRequestSession(client,'direct',privateGuard);assert.equal(role,'n44_backend');assert.equal(privateChecks,2);assert.equal(sql.filter(q=>q==='reset role').length,2);
for(const predicate of ['login','role','ssl','clientTls']){
 let reached=false;const c={connection:{stream:{authorized:predicate!=='clientTls'}},query:async q=>q.startsWith('select session_user')?{rows:[{login:predicate==='login'?'wrong':'n44_service_login',role:predicate==='role'?'wrong':'n44_service_login',ssl:predicate!=='ssl'}]}:{rows:[]}};
 await assert.rejects(()=>prepareRequestSession(c,'direct',async()=>{reached=true;}));assert.equal(reached,false);
}
const resetError={query:async()=>{throw Error('PRIVATE_RESET_FAILURE');}};let rejected;try{await prepareRequestSession(resetError,'direct',privateGuard);}catch(e){rejected=e;}assert.equal((await requestFailure(rejected).json()).body.phase,'set_role');
await writeFile('tests/n44-finish-runtime.pool-role.json',JSON.stringify({aiAuthored:true,runId:'6ab9a796-daf6-4d0b-999e-9abfc756f430',recordedAt:new Date().toISOString(),status:'PASS',evidence:'Actual shared request-session helper restores original login before each identity/TLS query, then re-enters private backend role. Reproduced retained-role SSL metadata-null denial; two sequential acquisitions pass all original guards. Each false guard and RESET ROLE failure still rejects before private work.',scope:'Injected ports; not an actual SQL visibility or hosted readiness proof',networkCalls:0},null,2)+'\n');console.log('Pool role restoration and negative guards PASS');
