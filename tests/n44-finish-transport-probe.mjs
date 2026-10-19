/** AI: one authorized synthetic unauthorized request per explicit path/phase. */
import assert from 'node:assert/strict';
import {writeFile,access} from 'node:fs/promises';
const [path,phase]=process.argv.slice(2);
assert.ok(['status','context/read'].includes(path));assert.ok(['before','after'].includes(phase));
// context/read requires the PO's explicit correction of the activated card probe.
if(path==='context/read')assert.equal(process.argv[4],'PO_APPROVED_CONTEXT_READ');
const file='tests/n44-finish-transport.'+path.replace('/','-')+'.'+phase+'.json';
await assert.rejects(access(file),'Do not repeat a consumed probe');
const url='https://rakeezx.com/api/n44/'+path;
const r=await fetch(url,{method:'POST',redirect:'manual',cache:'no-store',signal:AbortSignal.timeout(20000),headers:{origin:'https://rakeezx.com','content-type':'application/json','x-n44-csrf':'1','sec-fetch-site':'same-origin',authorization:'Bearer e30.e30.AA'},body:'{}'});
const bytes=await r.text();let body;try{body=JSON.parse(bytes);}catch{}
const report={aiAuthored:true,taskId:'continuous-n44-cloudflare-redirect-transport-fix-20261019',runId:'9485ed5a-6fed-4e65-a831-343a6bd11186',recordedAt:new Date().toISOString(),phase,url,method:'POST',httpStatus:r.status,denied:[401,503].includes(r.status),bodyKeys:body&&typeof body==='object'?Object.keys(body).sort():[],privateValuesReturned:bytes!=='{"error":"unavailable"}',cacheControl:r.headers.get('cache-control'),requestOrigin:'https://rakeezx.com',csrfAndSameOriginProtocol:true,fakeUnauthorizedBearer:true,personalData:false,credentialsPersisted:false,requestBodyPersisted:false,statusPathForwards:false};
await writeFile(file,JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(report));
