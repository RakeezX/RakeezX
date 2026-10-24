/** AI: bounded public-client qualification; no service/native/fixture operations. */
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createBindingProofObserver} from '../../drafts/n88-student-portal/client/binding-proof.js';
import {createUnifiedStudentPortalClient,normalizeStudentCode} from '../../src/lib/student-portal-unified-client.js';
const dir='tests/n88-failure-capture-client-delivery-20261024/';
const qualified='169ba140ecbd8e8823427c9e6ad7f26941ebbfac',base='438ceffaf6aeab121c10f7a6e466aa41024a14a4';
export const hashes={
 'src/lib/student-portal-unified-client.js':'14e3c39335602f15dee4a1816724a78700a36cc90d1856f61816e8fd6c50718a',
 'drafts/n88-student-portal/client/binding-proof.js':'6e9582ff6f24e0d2ed959910bc214b920ea9e1bebf7657c7ee5f60f6cd4bbab6',
 'drafts/n88-student-portal/client/student-entry.js':'9c7768a245e06d11f8be9abf62d1397f43451cbd4cc9ef6e292572532177b732'
};
const sha=b=>createHash('sha256').update(b).digest('hex');
for(const [file,hash] of Object.entries(hashes)){
 assert.equal(sha(await readFile(file)),hash);
 assert.equal(sha(execFileSync('git',['show',qualified+':'+file])),hash);
}
// The two existing sources were unchanged between the independently observed
// qualification base and this published base. No later behavior was overwritten.
for(const file of Object.keys(hashes).filter(p=>!p.endsWith('binding-proof.js')))
 assert.deepEqual(execFileSync('git',['show',base+':'+file]),execFileSync('git',['show','98a4e76a46d6b921a17aa9909ce521f2597ca432:'+file]));
let now=1800000000000;
function setup({expiry=now+30000,challenge=randomUUID()}={}){
 const attrs=new Map(),root={isConnected:true,setAttribute:(k,v)=>attrs.set(k,v),removeAttribute:k=>attrs.delete(k)};
 let cleared=false;
 const observer=createBindingProofObserver({location:{hash:`#n88-binding=${challenge}.${expiry}`,pathname:'/student'},history:{replaceState(...args){assert.deepEqual(args,[null,'','/student']);cleared=true;}},root,now:()=>now});
 assert(cleared);
 const receipt={version:1,challengeHash:sha(challenge),status:503,phase:'snapshot',family:'database',sourcePin:'a'.repeat(64),mac:'b'.repeat(64)};
 return {attrs,root,observer,receipt};
}
const response=(receipt,status=503)=>new Response('PRIVATE_BODY_NEVER_READ',{status,headers:receipt===undefined?{}:{'x-n88-failure-correlation':typeof receipt==='string'?receipt:JSON.stringify(receipt)}});
const good=setup(),slot=good.observer.reserve();assert(slot);assert.equal(good.observer.reserve(),null);
for(const altered of [
 {...good.receipt,private:'forbidden'},{...good.receipt,sourceChecked:true},
 {...good.receipt,challengeHash:'c'.repeat(64)},{...good.receipt,status:401},
 {...good.receipt,phase:'private-sql'},{...good.receipt,family:'success'},
 {...good.receipt,sourcePin:'x-n88-source-IP-pseudonym'},{...good.receipt,mac:'bad'},
 {...good.receipt,version:2},null,[],{},'{broken','x'.repeat(851)
]){await slot.acceptFailure(response(altered),()=>true);assert.equal(good.attrs.size,0);}
await slot.acceptFailure(response(good.receipt),()=>false);assert.equal(good.attrs.size,0);
good.root.isConnected=false;await slot.acceptFailure(response(good.receipt),()=>true);assert.equal(good.attrs.size,0);good.root.isConnected=true;
await slot.acceptFailure(response(good.receipt),()=>true);assert.deepEqual(JSON.parse(good.attrs.get('data-n88-failure-correlation')),good.receipt);
assert(!good.attrs.has('data-n88-binding-proof'));
good.observer.retire();await slot.acceptFailure(response(good.receipt),()=>true);assert.equal(good.attrs.size,0);assert.equal(good.observer.reserve(),null);
const expiring=setup(),expiringSlot=expiring.observer.reserve();now+=30000;await expiringSlot.acceptFailure(response(expiring.receipt),()=>true);assert.equal(expiring.attrs.size,0);
assert.equal(setup({expiry:now}).observer,null);assert.equal(setup({expiry:now+300001}).observer,null);
// UNKNOWN/lost acknowledgement consumes the local reservation; no automatic retry.
for(const status of [401,503]){
 const s=setup();let calls=0,parsed=0;
 const client=createUnifiedStudentPortalClient({bindingProof:s.observer,fetch:async()=>{calls++;const r=response(s.receipt,status);r.json=async()=>{parsed++;throw Error('must not read error body');};return r;}});
 await assert.rejects(client.read(),e=>e.kind===(status===401?'session':'unavailable'));
 assert.equal(calls,1);assert.equal(parsed,0);assert.equal(client.getDiagnostic().httpStatusClass,status===401?'4xx':'5xx');
 if(status===503)assert(s.attrs.has('data-n88-failure-correlation'));
 client.dispose();assert.equal(s.attrs.size,0);
}
const unknown=setup();let calls=0;
const unknownClient=createUnifiedStudentPortalClient({bindingProof:unknown.observer,fetch:async()=>{calls++;return response(undefined);}});
await assert.rejects(unknownClient.read(),{kind:'unavailable'});assert.equal(calls,1);assert.equal(unknown.attrs.size,0);assert.equal(unknown.observer.reserve(),null);unknownClient.dispose();
assert.equal(normalizeStudentCode('١۲٣٤٥٦'),'123456');
const reused=['finite-guards.json','native-correlation.json','initial-envelope-expectation-failure.json'].map(name=>({path:'tests/n88-five-correlation-20261024/'+name,sha256:sha(execFileSync('git',['show',qualified+':tests/n88-five-correlation-20261024/'+name]))}));
await writeFile(dir+'provenance.json',JSON.stringify({aiAuthored:true,status:'PASS',qualifiedCandidate:qualified,publicationBase:base,dependencyHashes:hashes,exactSourceParity:true,laterClassUI:'Preserved: no class UI files modified',reusedImmutableEvidence:reused,trustBoundary:'Browser metadata is finite capture only, not MAC/source/actor verification. Original custody validates actual pin/readback and cryptography; x-n88-source is not sourceChecked.',publicPrivateBoundary:'Publisher must verify these three public repository assets and normal import path. Private /student embedded bundle is unchanged here; original custodian owns its separately authorized combined carrier transition.',offlineShell:'Read-only sw.js check: neither draft student entry nor binding-proof is in teacher SHELL; /student API route is bypassed; no new teacher startup dependency or SW behavior.',preservedOpen:['actual user student503','issuanceUNKNOWN','historical wrong-signature FAIL','transport401','whole N88'],providerOperations:0},null,2)+'\n');
await writeFile(dir+'client.json',JSON.stringify({aiAuthored:true,status:'PASS',renderedUI:false,checks:['exact three-file qualified source hashes and base parity','strict finite field/schema/status/challenge guards','current request, connected root, finite expiry and retirement','unknown nonce ACK consumes reservation without automatic retry','503 capture before ordinary unavailable rejection; no error body read or successful binding','401 remains session denial; code digit normalization preserved'],trust:'Capture does not attest source/MAC/owner; immutable original-custody evidence reused by exact dependency parity',providerOperations:0},null,2)+'\n');
console.log('PASS: finite failure capture and exact qualified public dependency parity');
