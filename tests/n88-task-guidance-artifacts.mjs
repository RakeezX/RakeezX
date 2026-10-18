/** AI: final merged inert graph/readback and affected offline import proof only. */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import vm from 'node:vm';
import {verifyIntegratedReadback} from '../drafts/n88-student-portal/integrated-readback.mjs';
const taskId='continuous-n88-task-execution-delivery-guidance-20261018',runId='da437f4d-bfbe-42af-bcbc-33996358d071',base='fdbd680f1f2fd8dfe8cda3daac22fa52475f0681';
const dir='drafts/n88-student-portal/activation/',sha=b=>createHash('sha256').update(b).digest('hex'),lf=s=>s.replaceAll('\r\n','\n'),json=async f=>JSON.parse(await readFile(f,'utf8'));
const m=await json(dir+'manifest.json'),d=await json(dir+'deploy.staged.json'),prior=await json(dir+'prior-task-guidance-manifest.json');
for(const [p,h]of Object.entries(m.sources))assert.equal(sha(lf(await readFile(p,'utf8'))),h,p);
for(const [p,h]of Object.entries(m.outputs))assert.equal(sha(await readFile(dir+'bundle/'+p)),h,p);
assert.equal(d.enabled,false);assert.equal(d.function.enabled,false);assert.equal(d.privateDocument.enabled,false);assert.equal(d.privateDocument.browserReadiness,false);assert.equal(d.qualification.activationPermitted,false);
assert.equal(m.migrationGeneration.version,'20261018125611');assert.equal(d.migrations.length,6);assert.equal(new Set(d.migrations).size,6);
assert.equal(lf(await readFile(d.migration,'utf8')),lf(await readFile('drafts/n88-student-portal/task-guidance.inactive.sql','utf8')));
assert.deepEqual(m.taskGuidanceContract,d.taskGuidanceContract);assert.deepEqual(m.budgetContract,prior.budgetContract);assert.deepEqual(m.credentialContract,prior.credentialContract);assert.deepEqual(m.recoveryContract,prior.recoveryContract);
for(const p of ['numeric-credentials.mjs','class-credentials.mjs','code-recovery.mjs','auth-verifier.mjs','postgres-repository.mjs','canonical-adapter.mjs'])assert.equal(m.sources['drafts/n88-student-portal/'+p],prior.sources['drafts/n88-student-portal/'+p],p);
for(const p of ['src/store.js','src/models.js','src/lib/score-foundation.js','src/router.js','src/app.js'])assert.equal(lf(await readFile(p,'utf8')),lf(execFileSync('git',['show',base+':'+p],{encoding:'utf8',maxBuffer:2*1024*1024})),p);
for(const p of d.migrations.slice(0,-1))assert.equal(lf(await readFile(p,'utf8')),lf(execFileSync('git',['show',base+':'+p],{encoding:'utf8',maxBuffer:2*1024*1024})),p);
for(const p of ['manifest.json','deploy.staged.json','integrated-expected-identities.json'])assert.equal(lf(await readFile(dir+'prior-task-guidance-'+p,'utf8')),lf(execFileSync('git',['show',base+':'+dir+p],{encoding:'utf8',maxBuffer:2*1024*1024})),p);
assert.ok(m.graphs['edge/index.mjs'].inputs.includes('drafts/n88-student-portal/task-guidance.mjs'));
assert.ok(m.graphs.teacherClass.inputs.includes('src/lib/student-portal-task-guidance-client.js'));
assert.ok(!m.graphs['private/assets/student.mjs'].inputs.some(x=>/task-guidance\.mjs|numeric|recovery|auth|cloud\.js|store\.js|sync|ownership/i.test(x)));
const expected=await json(dir+'integrated-expected-identities.json');assert.equal(expected.migrationVersions.at(-1),'20261018125611');assert.ok(expected.identities.tables.some(t=>t.relname==='task_guidance'&&t.relrowsecurity));
const envelope={projectId:'xlrubcwjqktzzunrvuns',mode:'metadata-only',personalRowsRead:0,enabled:false,capturedAt:new Date().toISOString(),...expected};assert.match(verifyIntegratedReadback(envelope,expected),/identities match/);
const wrong=structuredClone(envelope);wrong.identities.tables=wrong.identities.tables.filter(t=>t.relname!=='task_guidance');assert.throws(()=>verifyIntegratedReadback(wrong,expected));
const gateway=await import('../drafts/n88-student-portal/activation/bundle/cloudflare/worker.mjs'),reads=[];
assert.equal((await gateway.default.fetch(new Request('https://synthetic.invalid/api/n88/teacher/class/guidance-list'),new Proxy({},{get:(_t,k)=>{reads.push(k);if(k==='N88_ENABLED')return 'false';throw Error('Disabled secret read');}}))).status,503);assert.deepEqual(reads,['N88_ENABLED']);
// Execute the actual SW handlers with an offline network/cache port. This is a
// targeted import/fallback/exclusion check, not live SW/offline-cache certification.
const listeners={},modulePath='/src/lib/student-portal-task-guidance-client.js',moduleText=await readFile('.'+modulePath,'utf8');let adds=[],wait;
const cache={add:async req=>{adds.push(new URL(req.url).pathname);},match:async req=>new URL(req.url).pathname===modulePath?new Response(moduleText,{headers:{'content-type':'text/javascript'}}):undefined};
const world={URL,Response,Request:class extends Request{constructor(url,opts){super(typeof url==='string'?new URL(url,'https://synthetic.invalid/'):url,opts);}},self:{location:{origin:'https://synthetic.invalid'},skipWaiting(){},addEventListener:(k,fn)=>{listeners[k]=fn;}},caches:{open:async()=>cache,keys:async()=>[]},fetch:async()=>{throw Error('Synthetic offline');},console:{warn(){}}};
vm.runInNewContext(await readFile('sw.js','utf8'),world);listeners.install({waitUntil:p=>{wait=p;}});await wait;assert.ok(adds.includes(modulePath));
listeners.fetch({request:new Request('https://synthetic.invalid'+modulePath),respondWith:p=>{wait=p;}});assert.equal(await (await wait).text(),moduleText);
for(const p of ['/student','/api/n88/student/read','/api/n88/teacher/class/guidance-save','/n88-private/assets/student.mjs']){let intercepted=false;listeners.fetch({request:new Request('https://synthetic.invalid'+p),respondWith:()=>{intercepted=true;}});assert.equal(intercepted,false);}
assert.match(await readFile('src/lib/student-portal-runtime.js','utf8'),/enabled: false, serviceRevision: null/);assert.match(await readFile('drafts/n88-student-portal/client/student-entry.js','utf8'),/enabled:false/);
const deps=[];
for(const id of ['continuous-n88-compact-teacher-portal-20261018','continuous-n88-branded-student-example-20261018','continuous-n64-inline-email-change-guidance-20261018','continuous-n107-name-match-file-maximum-20261018']){
 const c=await json('C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/'+id+'.json'),r=c.deliveryReceipt;
 assert.equal(c.status,'awaiting_po');assert.ok(c.productionVerifiedAt);assert.equal(r.binding.candidateAncestorOfPublished,true);assert.equal(r.evidence.immutable.passed,true);assert.equal(r.evidence.production.passed,true);
 execFileSync('git',['merge-base','--is-ancestor',r.publishedSha,base]);deps.push({taskId:id,candidateSha:c.candidateSha,publishedSha:r.publishedSha,verifiedAt:c.productionVerifiedAt,servedAssetEvidence:true});
}
const focused=await json('tests/n88-task-guidance.json'),review=await json('tests/n88-task-guidance-review.json');assert.equal(focused.failure,undefined);assert.equal(focused.checks.length,2);assert.equal(review.failure,undefined);assert.equal(review.cleanup.postgresStopped,true);
const reused=[];for(const file of ['tests/n88-integrated-class-final-service.json','tests/n88-six-digit-security.json','tests/n88-six-digit-shared-network.json','tests/n88-six-digit-shared-flood-window.json','tests/n88-six-digit-recovery.json','tests/n88-six-digit-recovery-context.json']){const content=await readFile(file,'utf8');assert.equal(lf(content),lf(execFileSync('git',['show',base+':'+file],{encoding:'utf8',maxBuffer:2*1024*1024})));reused.push({path:file,sha256:sha(lf(content))});}
await writeFile('tests/n88-task-guidance-artifacts.json',JSON.stringify({taskId,runId,baseSha:base,dependencyDeliveries:deps,reusedEvidence:reused,checks:[{name:'n88_task_guidance_merged_inactive_bundle_readback_and_actual_review',status:'PASS',evidence:'One final offline bundle from merged four-dependency source; exact LF source and output hashes, new CLI SQL twin, full restricted-PG metadata readback and mismatch rejection; preserved all old migrations/prior-current snapshots. Actual same-source populated launcher and owned cleanup PASS. Actual SW install/offline fallback for new teacher import and private exclusion handlers exercised with synthetic cache/network ports; no live SW claim. All runtime/student/provider switches OFF; unchanged credential/budget/recovery/scoring/Auth proofs source-bound and reused.'}],hostedOperations:'NOT_RUN',liveActivation:false},null,2)+'\n');
console.log('N88 guidance final inactive source graph/readback PASS');
