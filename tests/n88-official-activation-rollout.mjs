/** AI: synthetic policy regression only; not an operational service/UI PASS. */
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {createRolloutGuard} from '../drafts/n88-student-portal/rollout-guard.mjs';
const owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',other='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const binding={ownerId:owner,classId:'synthetic-class',teachingId:'synthetic-teaching',studentIds:['synthetic-one','synthetic-two']};
const env={N88_ROLLOUT_MODE:'pilot',N88_PILOT_BINDING:JSON.stringify(binding)};
const build=e=>createRolloutGuard(n=>e[n]);
const auth={current:true,ownerId:owner},scope={current:true,ownerId:owner,classId:binding.classId,teachingId:binding.teachingId};
const member={ownerId:owner,classId:binding.classId,studentId:binding.studentIds[0],status:'active',endDate:null,studentActive:true,classActive:true};
const guard=build(env);
assert.equal(guard.mode,'pilot');assert.equal(guard.admitsTeacher(auth,scope),true);assert.equal(guard.admitsStudent(member),true);
assert.equal(guard.admitsStudent({...member,studentId:binding.studentIds[1]}),true);
for(const [a,s]of [[null,scope],[{...auth,current:false},scope],[{...auth,ownerId:other},scope],[auth,{...scope,ownerId:other}],[auth,{...scope,current:false}],[auth,{...scope,classId:'other'}],[auth,{...scope,teachingId:'other'}]])assert.equal(guard.admitsTeacher(a,s),false);
for(const patch of [{ownerId:other},{studentId:'unknown'},{classId:'other'},{status:'inactive'},{endDate:'2026-10-19'},{studentActive:false},{classActive:false}])assert.equal(guard.admitsStudent({...member,...patch}),false);
for(const e of [{},{N88_ROLLOUT_MODE:'off'},{N88_ROLLOUT_MODE:'PILOT'},{N88_ROLLOUT_MODE:'unknown'},{N88_ROLLOUT_MODE:'public'}, {...env,N88_PILOT_BINDING:'{'}, {...env,N88_PILOT_BINDING:JSON.stringify({...binding,extra:true})}, {...env,N88_PILOT_BINDING:JSON.stringify({...binding,studentIds:['one','one']})}, {...env,N88_PILOT_BINDING:JSON.stringify({...binding,studentIds:['one','two','three']})}, {...env,N88_PILOT_BINDING:JSON.stringify({...binding,ownerId:'not-an-owner'})}]){const g=build(e);assert.equal(g.mode,'off');assert.equal(g.admitsTeacher(auth,scope),false);assert.equal(g.admitsStudent(member),false);}
assert.equal(createRolloutGuard(()=>{throw Error('synthetic read failure');}).mode,'off');
const publicGuard=build({N88_ROLLOUT_MODE:'public',N88_PUBLIC_HOSTED_ACCEPTANCE_SHA256:'a'.repeat(64),N88_PUBLIC_HOSTED_ACCEPTANCE_CONFIRMED:'true'});
assert.equal(publicGuard.admitsTeacher({...auth,ownerId:other},{...scope,ownerId:other}),true);
assert.equal(publicGuard.admitsTeacher(auth,{...scope,current:false}),false);
assert.equal(publicGuard.admitsStudent({...member,classActive:false}),false);
assert.deepEqual(Object.keys(guard).sort(),['mode','configured','allowsOwner','allowsMember','admitsTeacher','admitsStudent'].sort());
const receipt={taskId:'continuous-n88-official-student-portal-activation-20261018',runId:'288bf5d1-c519-414f-91c3-06442d6246ab',status:'PASS',scope:'Pure additional rollout admission with synthetic identities only',checks:['off/default/invalid fail closed','strict one-owner/exact-two-pupil config','verified current teacher and matching source required','wrong owner/source/pupil rejected','inactive/ended student rejected','public requires explicit hosted acceptance markers and retains source fences','private binding not exposed'],operationalServiceIntegration:'NOT_RUN',hostedOrRenderedUiProof:false,providerWrites:0};
await writeFile('tests/n88-official-activation-rollout.json',JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt));
