/** AI: one explicitly authorized changed-source synthetic probe per phase. No private values persisted. */
import assert from 'node:assert/strict';
import {writeFile,access} from 'node:fs/promises';
import {ROUTE} from '../drafts/n44-push/web-protocol.mjs';
import {identityProjection} from '../drafts/n44-push/runtime-failure.mjs';
import {id} from '../drafts/n44-push/shared.mjs';
const phase=process.argv[2];assert.ok(['diagnostic','final','predicate1','fix1','fix2','fix3'].includes(phase));
const path='/api/n44/context/read',authorization='Bearer N44_FABRICATED_UNAUTHORIZED_20261019',payload={workspaceId:'n44-synthetic-probe',deviceId:'n44-synthetic-probe'};
assert.ok(ROUTE.test(path));assert.match(authorization,/^Bearer [A-Za-z0-9._-]{20,8192}$/);assert.ok(!authorization.slice(7).includes('.'));assert.equal(Object.keys(payload).sort().join(','),'deviceId,workspaceId');assert.ok(id(payload.workspaceId)&&id(payload.deviceId));
const file='tests/n44-finish-runtime.'+phase+'.json';await assert.rejects(access(file),'Phase already consumed');
const started=Date.now(),url='https://rakeezx.com'+path;
const r=await fetch(url,{method:'POST',redirect:'manual',cache:'no-store',signal:AbortSignal.timeout(20000),headers:{origin:'https://rakeezx.com','content-type':'application/json','x-n44-csrf':'1','sec-fetch-site':'same-origin',authorization},body:JSON.stringify(payload)});
let b;try{b=await r.json();}catch{}
const phases=['configuration','configuration_origin','configuration_revision','configuration_policy','configuration_transport','configuration_crypto','configuration_provider','connect','identity','set_role','private_session','source','ingress','query','deadline'];
const report={taskId:'continuous-n44-cloudflare-redirect-transport-fix-20261019',runId:'6ab9a796-daf6-4d0b-999e-9abfc756f430',recordedAt:new Date().toISOString(),phase,url,method:'POST',httpStatus:r.status,elapsedMs:Date.now()-started,expectedContractStatus:400,bodyKeys:b&&typeof b==='object'?Object.keys(b).map(k=>['error','phase','status','identity'].includes(k)?k:'other').sort():[],identity:identityProjection(b?.identity),failurePhase:phases.includes(b?.phase)?b.phase:null,typedRejectedSession:r.status===400&&b?.status==='rejected'&&Object.keys(b).join(',')==='status',cacheControl:r.headers.get('cache-control'),completeSyntheticShapeValidatedOffline:true,noRealCredentialOrAccount:true,bodyOrBearerRecorded:false};
await writeFile(file,JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(report));
