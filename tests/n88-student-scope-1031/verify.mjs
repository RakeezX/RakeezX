/** AI: bounded syntax/scope/evidence seal. Does not rerun successful native/browser phases. */
import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';import {readFile,writeFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
const run=(p,a)=>execFileSync(p,a,{encoding:'utf8',windowsHide:true}),git=a=>run('git',a),dir='tests/n88-student-scope-1031/';
const task=JSON.parse(await readFile('C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/continuous-n88-student-scope-source-20261031.json','utf8'));
assert.equal(task.id,'continuous-n88-student-scope-source-20261031');assert.equal(task.attempt.runId,'9f046986-1f78-4ad5-a247-397a19fc7e66');assert.equal(task.model,'gpt-6.1-sol');assert.equal(task.effort,'medium');
assert.equal(git(['rev-parse','HEAD']).trim(),'5b77024e36f254a6568a0224abb9ea25d78698af');
const paths=[...new Set([...git(['diff','--name-only']).trim().split('\n'),...git(['ls-files','--others','--exclude-standard']).trim().split('\n')])].filter(Boolean).sort();
const allowed=p=>task.allowedPaths.some(a=>a.endsWith('/**')?p.startsWith(a.slice(0,-2)):p===a);
for(const p of paths)assert(allowed(p),'outside activated scope: '+p);
const hashes={},syntax=[];
for(const p of paths){if(p===dir+'verification.json')continue;const bytes=await readFile(p),text=bytes.toString('utf8');hashes[p]=createHash('sha256').update(/\.(?:m?js|css|sql|json|md)$/.test(p)?text.replaceAll('\r\n','\n'):bytes).digest('hex');if(/\.m?js$/.test(p)){run(process.execPath,['--check',p]);syntax.push(p);}}
run('git',['diff','--check']);
const native=JSON.parse(await readFile(dir+'results.json','utf8')),focused=JSON.parse(await readFile(dir+'focused-results.json','utf8'));
assert.equal(native.status,'PASS');assert.equal(native.checks.length,10);assert(native.checks.every(c=>c.status==='PASS'));assert.equal(focused.pass,8);assert.equal(focused.fail,0);
assert.equal(native.leaseRelease,'RELEASED integration');assert.equal(native.scopeHttpClosed,true);for(const k of ['stopped','pidAbsent','portFree','ownedDataRemoved'])assert.equal(native.cleanup[k],true);
const sql=JSON.parse(await readFile('drafts/n88-student-portal/activation/v2-student-scope-1031/manifest.json','utf8'));assert.equal(native.checks[0].evidence.sourceInstallerSha256,sql.installerSha256);
await writeFile(dir+'verification.json',JSON.stringify({taskId:task.id,runId:task.attempt.runId,baseSha:git(['rev-parse','HEAD']).trim(),status:'PASS',checkedAt:new Date().toISOString(),syntaxCount:syntax.length,scopePaths:paths,sourceSha256:hashes,reusedNativeResult:native.finishedAt,focusedTests:8,cleanup:native.cleanup,leaseRelease:native.leaseRelease,ownedHttpClosed:native.scopeHttpClosed,hostedOperations:0},null,2)+'\n');
console.log(JSON.stringify({status:'PASS',syntax:syntax.length,allowedPaths:paths.length,nativeChecks:10,focusedTests:8,ownedCleanup:true,hostedOperations:0}));
