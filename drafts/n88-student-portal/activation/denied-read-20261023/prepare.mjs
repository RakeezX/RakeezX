/** AI: exact two-span native66 successor preparation; no provider/private state. */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const dir='drafts/n88-student-portal/activation/denied-read-20261023/';
const read=async p=>(await readFile(p,'utf8')).replaceAll('\r\n','\n');
const hash=s=>createHash('sha256').update(s).digest('hex');
const original=await read('drafts/n88-student-portal/activation/bundle/edge/index.mjs');
assert.equal(hash(original),'f14daf224dc27b1163d43ce39ada2fdf596acd3abb4af30579404ad4f5de6390');
const source=await read('drafts/n88-student-portal/integrated-service.mjs');
const helper=source.slice(source.indexOf('/** AI: a failed private read'),source.indexOf('export function createIntegratedService'));
assert(helper.includes('function createStudentReadBoundary('));
const before='function createIntegratedService(options, adapter, baseRepository) {';
const call='const student = credentials.createStudentHandler({ repository, verifyIngress:';
assert.equal(original.split(before).length,2);assert.equal(original.split(call).length,2);
const successor=original.replace(before,helper+before).replace(call,'const student = createStudentReadBoundary(credentials.createStudentHandler,{ repository, verifyIngress:');
const hashes={};
for(const p of ['drafts/n88-student-portal/postgres-repository.mjs','drafts/n88-student-portal/activation/private-error-boundary.mjs','drafts/n88-student-portal/activation/read-service-20261023/typed-read-operations.json','drafts/n88-student-portal/activation/read-service-20261023/typed-identities.json'])hashes[p]=hash(await read(p));
const manifest={aiAuthored:true,baseSha:'84a0e4cf197adaeeb3925a5400b6280d5ff14cfa',originalNative66Sha256:hash(original),successorSha256:hash(successor),integratedSourceSha256:hash(source),onlyNativeSpans:['add request-local read transaction error boundary','wrap integrated student handler construction'],unchangedSourceHashes:hashes,liveOperations:0};
if(process.argv.includes('--check')){
 assert.equal(await read(dir+'native66-successor.inactive.mjs'),successor);
 assert.deepEqual(JSON.parse(await read(dir+'manifest.json')),manifest);
 console.log('PASS: exact native66 two-span successor; original guard/SQL/repository unchanged');
}else{
 await writeFile(dir+'native66-successor.inactive.mjs',successor);
 await writeFile(dir+'manifest.json',JSON.stringify(manifest,null,2)+'\n');
}
