// AI: exact-scope source and immutable qualification binding; no live operations.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const parent='f3eaef6dc3e268bb91de98c3b99e4df4714ccfe3',base='38d78c7acb51c22b2f845a0a3ce2deb7cecfae15',dir='tests/n88-validation-public-20261024/';
const hash=s=>createHash('sha256').update(s).digest('hex');
const object=p=>execFileSync('git',['cat-file','blob',parent+':'+p],{windowsHide:true,maxBuffer:4000000});
const bindingPath='drafts/n88-student-portal/activation/validation-family-20261024/candidate-binding.json';
const binding=JSON.parse(object(bindingPath));const reused={};
for(const [file,expected] of Object.entries(binding.evidenceHashes)){const actual=hash(object(file));assert.equal(actual,expected);reused[file]={sha256:actual,disposition:'REUSED immutable parent evidence; no native rerun or new live proof'};}
for(const file of ['drafts/n88-student-portal/activation/validation-family-20261024/qualification-manifest.json','drafts/n88-student-portal/activation/validation-family-20261024/delta-manifest.json',bindingPath,'tests/n88-five-correlation-20261024/validation-family-harness-failures.json'])reused[file]={sha256:hash(object(file)),disposition:'Original retained unchanged'};
const publicPaths=['drafts/n88-student-portal/cloudflare-entry.mjs','src/lib/student-portal-runtime.js','src/lib/support.js'];const sources={};
for(const file of publicPaths){sources[file]={normalizedSourceSha256:hash((await readFile(file,'utf8')).replaceAll('\r\n','\n')),servedProof:'NOT_RUN; sole publisher must bind deployed artifact and served bytes to this source'};}
const protectedPaths=['drafts/n88-student-portal/postgres-repository.mjs','drafts/n88-student-portal/integrated-service.mjs','drafts/n88-student-portal/web-entry.mjs','src/lib/student-portal-class-client.js','sw.js'];
for(const file of protectedPaths)assert.equal(execFileSync('git',['diff',base,'--',file],{encoding:'utf8'}),'');
const runtime=await readFile(publicPaths[1],'utf8'),old=execFileSync('git',['show',base+':'+publicPaths[1]],{encoding:'utf8'});assert.deepEqual(runtime.match(/^import .*$/gm),old.match(/^import .*$/gm));
const manifest={aiAuthored:true,taskId:'continuous-n88-validation-family-public-dependency-20261024',runId:'4b319ebd-0fa4-45c9-964e-1c8439e82d9b',baseSha:base,parentCandidate:parent,deltaBase:'bca2ab8a86eda286f6b26c7de93b7117812a7eb3',status:'SOURCECURRENT PASS',sources,protectedPathsUnchanged:protectedPaths,newStartupDependency:false,qualification:reused,nativeQualifiedArtifactSha256:'23ee1cb88197c5a3f34b88c7dd203d4f24c98c7894952439f52d1bf39033134e',parentDisposition:{state:'BLOCKED',hostedFamily:'UNKNOWN',nativeSuccessor:'NOT_VERIFIED',publicServedDependency:'NOT_VERIFIED',historicalCleanupDenial:'Immutable; no old fixture access/cleanup or reinterpretation of parent FAIL'},localReportSha256:hash(await readFile(dir+'current-public.json')),providerOperations:0};
await writeFile(dir+'qualification-manifest.json',JSON.stringify(manifest,null,2)+'\n');console.log('PASS: exact public vocabulary/scope, native and offline startup unchanged, immutable parent evidence hashes bound');
