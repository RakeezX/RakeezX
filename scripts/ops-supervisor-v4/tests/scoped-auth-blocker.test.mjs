import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {Controller,readJson,writeJson,workerBlockerClass,classifyFailure} from '../controller.mjs';
async function fixture(t) {
 const runtime=await fs.mkdtemp(path.join(os.tmpdir(),'rakeez-task-auth-'));
 t.after(()=>fs.rm(runtime,{recursive:true,force:true}));
 await fs.mkdir(path.join(runtime,'queue'));await fs.mkdir(path.join(runtime,'attempt'));
 const task={id:'fixture-task',productId:'N58',activationId:'test-auth',status:'retry_wait',failureClass:'auth',lastFailure:'The exact synthetic pair is retired; the live gate is unproved.',retryAt:'2099-01-01T00:00:00Z',infrastructureRetries:1,sessionId:'saved-session',candidateSha:'a'.repeat(40),baseSha:'b'.repeat(40),attempt:{runId:'saved-run',startedAt:'2026-10-13T01:00:00Z',checkpointPath:path.join(runtime,'attempt/checkpoint.json'),outputPath:path.join(runtime,'attempt/result.json')},__file:path.join(runtime,'queue/fixture-task.json')};
 const checkpoint={taskId:task.id,runId:'saved-run',sessionId:task.sessionId,finishedAt:'2026-10-13T01:10:00Z',runnerPid:7000,runnerCreatedAt:'2026-10-13T01:00:00Z'};
 const result={taskId:task.id,runId:'saved-run',state:'BLOCKED',blockerType:'auth',blocker:task.lastFailure,summary:'No Product success claimed'};
 await writeJson(task.attempt.checkpointPath,checkpoint);await writeJson(task.attempt.outputPath,result);
 const controller=new Controller({runtime,repo:runtime},{testOnly:true,now:()=>Date.parse('2026-10-13T02:00:00Z'),inventory:async()=>[]});
 controller.config={maxWorkers:2,controller:{activationId:'test-auth'}};await controller.save(task);
 return {runtime,task,checkpoint,result,controller};
}
test('completed-worker auth is task scoped; engine auth and quota stay unchanged',()=>{
 assert.equal(workerBlockerClass({blockerType:'auth'}),'external');assert.equal(workerBlockerClass({blockerType:'implementation'}),'implementation');assert.equal(workerBlockerClass({blockerType:'quota'}),'quota');assert.equal(classifyFailure('Please sign in; authentication failed'),'auth');assert.equal(classifyFailure('usage limit exceeded'),'quota');
});
test('saved completed blocker parks only its task and preserves evidence',async t=>{
 const {task,controller}=await fixture(t),before=await fs.readFile(task.attempt.outputPath),attempt=structuredClone(task.attempt);
 assert.equal(await controller.isolateCompletedAuthBlocker(task,[]),true);assert.equal(task.status,'blocked');assert.equal(task.failureClass,'external');assert.equal(task.retryAt,null);assert.equal(task.sessionId,'saved-session');assert.equal(task.candidateSha,'a'.repeat(40));assert.deepEqual(task.attempt,attempt);assert.equal(task.failureReclassificationHistory.length,1);assert.deepEqual(await fs.readFile(task.attempt.outputPath),before);assert.equal((await readJson(task.__file)).status,'blocked');assert.equal(await controller.isolateCompletedAuthBlocker(task,[]),false);assert.equal(task.failureReclassificationHistory.length,1);
});
for(const change of ['run','task','unfinished','session','reason','runtime-error'])test('unproved '+change+' stays unchanged',async t=>{
 const {task,controller,checkpoint,result}=await fixture(t);
 if(change==='run')result.runId='other';if(change==='task')result.taskId='other';if(change==='unfinished')delete checkpoint.finishedAt;if(change==='session')checkpoint.sessionId='other';if(change==='reason')result.blocker='Different failure';if(change==='runtime-error')result.state='LOCAL_READY';
 await writeJson(task.attempt.checkpointPath,checkpoint);await writeJson(task.attempt.outputPath,result);assert.equal(await controller.isolateCompletedAuthBlocker(task,[]),false);assert.equal(task.status,'retry_wait');assert.equal(task.failureClass,'auth');
});
test('exact live old process prevents reconciliation',async t=>{
 const {task,controller}=await fixture(t);assert.equal(await controller.isolateCompletedAuthBlocker(task,[{pid:7000,createdAt:'2026-10-13T01:00:00Z',name:'powershell.exe',commandLine:'',parentPid:1}]),false);assert.equal(task.status,'retry_wait');
});
test('tick frees both independent slots without replaying fixture work',async t=>{
 const {task,controller}=await fixture(t),launches=[];
 controller.jobs=[task,...[1,2].map(n=>({id:'independent-'+n,productId:'N'+(96+n),activationId:'test-auth',status:'pending',releaseAuthority:'synthetic only',allowedPaths:['independent-'+n+'.js']}))];
 controller.loadConfig=async()=>{};controller.loadRecords=async()=>{};controller.loadJobs=async()=>{};controller.importCatalog=async()=>{};controller.reapFinishedLeases=async()=>{};controller.syncRecords=async()=>{};controller.snapshot=async()=>{};controller.launch=async task=>{launches.push(task.id);task.status='running';};
 await controller.tick();assert.deepEqual(launches,['independent-1','independent-2']);assert.equal(task.status,'blocked');assert.equal(task.failureClass,'external');
});
const missingTransport={state:'BLOCKED',blockerType:'network',blocker:"The local custodian lacks IPv6 connectivity to the project's direct database; the exact existing Session pooler host:port remains unavailable.",nextAction:"Resume only after receiving the project's provider-supplied Session pooler host:port without credentials, or a sanctioned IPv6-capable custodian."};
test('missing exact provider connection input is external while transient network failures retain retry',()=>{
 assert.equal(workerBlockerClass(missingTransport),'external');
 for(const blocker of ['DNS lookup timed out','Temporary TLS handshake failure','IPv6 connection reset; retry when service recovers'])assert.equal(workerBlockerClass({state:'BLOCKED',blockerType:'network',blocker}),'network');
 assert.equal(workerBlockerClass({...missingTransport,state:'LOCAL_READY'}),'network');
 assert.equal(workerBlockerClass({...missingTransport,nextAction:'Retry after the outage'}),'network');
});
test('a saved completed transport prerequisite is parked without another worker or changed evidence',async t=>{
 const {task,controller,result}=await fixture(t);
 Object.assign(task,{failureClass:'network',lastFailure:missingTransport.blocker,infrastructureRetries:3});Object.assign(result,missingTransport);
 await writeJson(task.attempt.outputPath,result);await controller.save(task);
 const before=await fs.readFile(task.attempt.outputPath),attempt=structuredClone(task.attempt);
 assert.equal(await controller.isolateCompletedAuthBlocker(task,[]),true);assert.equal(task.status,'blocked');assert.equal(task.failureClass,'external');assert.equal(task.retryAt,null);assert.equal(task.candidateSha,'a'.repeat(40));assert.deepEqual(task.attempt,attempt);assert.deepEqual(await fs.readFile(task.attempt.outputPath),before);assert.equal(task.failureReclassificationHistory[0].from,'network');assert.equal(task.failureReclassificationHistory[0].originalInfrastructureRetries,3);
});
test('a still active transport worker or changed result identity is never reclassified',async t=>{
 const {task,controller,result}=await fixture(t);Object.assign(task,{failureClass:'network',lastFailure:missingTransport.blocker});Object.assign(result,missingTransport);await writeJson(task.attempt.outputPath,result);
 assert.equal(await controller.isolateCompletedAuthBlocker(task,[{pid:7000,createdAt:'2026-10-13T01:00:00Z',name:'powershell.exe',commandLine:'',parentPid:1}]),false);
 result.runId='other';await writeJson(task.attempt.outputPath,result);assert.equal(await controller.isolateCompletedAuthBlocker(task,[]),false);assert.equal(task.status,'retry_wait');
});
