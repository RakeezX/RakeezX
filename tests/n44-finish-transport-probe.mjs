/** AI: one authorized synthetic unauthorized request per explicit path/phase. */
import assert from 'node:assert/strict';
import {writeFile,access} from 'node:fs/promises';
import {ROUTE} from '../drafts/n44-push/web-protocol.mjs';
import {id} from '../drafts/n44-push/shared.mjs';
const [path,phase]=process.argv.slice(2);
assert.ok(['status','context/read'].includes(path));assert.ok(['before','after'].includes(phase));
// The activated card's 2026-10-19T06:05:50.121Z repair approves context/read.
if(path==='context/read')assert.equal(process.argv[4],'PO_APPROVED_CONTEXT_READ');
const file='tests/n44-finish-transport.'+path.replace('/','-')+'.'+phase+'.json';
// Corrected preparation only. The consumed after request remains immutable;
// this script's existing-file guard prevents an automatic replacement probe.
const authorization='Bearer N44_FABRICATED_UNAUTHORIZED_20261019';
const probeBody=path==='context/read'?{workspaceId:'n44-synthetic-probe',deviceId:'n44-synthetic-probe'}:{};
if(path==='context/read'){
 assert.ok(ROUTE.test('/api/n44/'+path));assert.match(authorization,/^Bearer [A-Za-z0-9._-]{20,8192}$/);
 assert.equal(Object.keys(probeBody).sort().join(','),'deviceId,workspaceId');assert.ok(id(probeBody.workspaceId)&&id(probeBody.deviceId));
}
if(process.argv.includes('--validate-only')){console.log('PASS: corrected synthetic request shape prepared offline; no request sent and consumed phase not replenished.');process.exit(0);}
await assert.rejects(access(file),'Do not repeat a consumed probe');
const url='https://rakeezx.com/api/n44/'+path;
const r=await fetch(url,{method:'POST',redirect:'manual',cache:'no-store',signal:AbortSignal.timeout(20000),headers:{origin:'https://rakeezx.com','content-type':'application/json','x-n44-csrf':'1','sec-fetch-site':'same-origin',authorization},body:JSON.stringify(probeBody)});
const bytes=await r.text();let body;try{body=JSON.parse(bytes);}catch{}
const report={aiAuthored:true,taskId:'continuous-n44-cloudflare-redirect-transport-fix-20261019',runId:'0fcbdbd9-bd7c-44f2-aeec-11841077ffcc',recordedAt:new Date().toISOString(),phase,url,method:'POST',httpStatus:r.status,denied:[401,503].includes(r.status),bodyKeys:body&&typeof body==='object'?Object.keys(body).sort():[],privateValuesReturned:bytes!=='{"error":"unavailable"}',cacheControl:r.headers.get('cache-control'),requestOrigin:'https://rakeezx.com',csrfAndSameOriginProtocol:true,fakeUnauthorizedBearer:true,personalData:false,credentialsPersisted:false,requestBodyPersisted:false,probePathAllowed:path==='context/read'};
await writeFile(file,JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(report));
