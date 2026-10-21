/** AI: bounded unauthenticated reads of the two changed static code assets only. */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {STUDENT_PENDING_STATIC as c,staticDigest as sha} from '../../drafts/n88-student-portal/activation/static-student-pending-20261021-gate.mjs';
const dir=c.evidence,json=async file=>JSON.parse(await readFile(dir+file,'utf8'));
const [before,after,native,pre,upload]=await Promise.all(['cloudflare-before.json','cloudflare-after.json','read-native-after.json','provider-preflight.json','upload-response.json'].map(json));
for(const key of ['settings','routes','subdomain'])assert.deepEqual(after[key],before[key]);
assert.equal(native.nativeSource,pre.nativeSource);assert.equal(native.nativeVersion,pre.nativeVersion);
assert.equal(upload.success,true);assert.equal(upload.uploads,1);assert.equal(upload.sourceSha256,c.carrier);
assert.equal(after.sourceSha256,c.carrier);assert.notEqual(after.version.version_id,before.version.version_id);assert.equal(after.version.percentage,100);
const results=await Promise.allSettled([
 {key:'student',url:'https://rakeezx.com/n88-private/assets/student.mjs',hash:c.student,type:'text/javascript',file:'served-student.mjs'},
 {key:'style',url:'https://rakeezx.com/n88-private/styles/student-portal-login.css',hash:c.style,type:'text/css',file:'served-style.css'}
].map(async asset=>{
 const response=await fetch(asset.url,{credentials:'omit',cache:'no-store',redirect:'error',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(15000)});
 const bytes=Buffer.from(await response.arrayBuffer()),digest=sha(bytes),type=response.headers.get('content-type')?.split(';')[0];
 assert.equal(response.status,200);assert.equal(type,asset.type);assert.equal(digest,asset.hash);
 const headers={noStore:response.headers.get('cache-control')?.includes('no-store')===true,noReferrer:response.headers.get('referrer-policy')==='no-referrer',nosniff:response.headers.get('x-content-type-options')==='nosniff'};
 assert(Object.values(headers).every(Boolean));await writeFile(dir+asset.file,bytes,{flag:'wx'});
 return {key:asset.key,url:asset.url,status:response.status,type,hash:digest,headers};
}));
for(const result of results)if(result.status!=='fulfilled')throw result.reason;
const [student,style]=results.map(r=>r.value);
const receipt={taskId:c.task,runId:c.run,preparedCandidate:c.candidate,observedAt:new Date().toISOString(),nativeSource:native.nativeSource,nativeVersion:native.nativeVersion,source:after.sourceSha256,version:after.version.version_id,carrierPercentage:after.version.percentage,uploads:upload.uploads,...Object.fromEntries(['settings','routes','subdomain'].map(key=>[key,after[key]])),servedUrl:student.url,servedStatus:student.status,servedType:student.type,servedHeaders:student.headers,servedStyleUrl:style.url,servedStyleStatus:style.status,servedStyleType:style.type,servedStyleHeaders:style.headers};
await writeFile(dir+'carrier-readback.json',JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({status:'PASS',servedStudentSha256:student.hash,servedStyleSha256:style.hash,privacyHeadersExact:true,uploads:1}));
