/** AI: scoped static/bundle/SW checks only; explicitly not rendered UI acceptance. */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {offlineChecks} from './n88-client-binding-guards.mjs';
const checks=[],report={taskId:'continuous-n88-integrated-class-student-journey-20261018',runId:'c9f4a227-4930-456c-881d-6ffd2ce095fd',checks};
const dir='drafts/n88-student-portal/activation/',manifest=JSON.parse(await readFile(dir+'manifest.json','utf8'));
const hash=b=>createHash('sha256').update(b).digest('hex');
for(const [p,h]of Object.entries(manifest.sources))assert.equal(hash((await readFile(p,'utf8')).replaceAll('\r\n','\n')),h,p);
for(const [p,h]of Object.entries(manifest.outputs))assert.equal(hash(await readFile(dir+'bundle/'+p)),h,p);
const student=manifest.graphs['private/assets/student.mjs'];assert.deepEqual(student.imports,[]);
assert.ok(!student.inputs.some(x=>/cloud\.js|store\.js|runtime|auth|analytics|sync|ownership|teacher/i.test(x)));
assert.deepEqual(manifest.graphs['cloudflare/worker.mjs'].imports,[]);
const deployment=JSON.parse(await readFile(dir+'deploy.staged.json','utf8'));
assert.equal(deployment.enabled,false);assert.equal(deployment.function.enabled,false);assert.equal(deployment.privateDocument.browserReadiness,false);assert.equal(deployment.qualification.activationPermitted,false);
const worker=await import('../drafts/n88-student-portal/activation/bundle/cloudflare/worker.mjs');const reads=[];
const env=new Proxy({},{get(_t,k){reads.push(k);if(k==='N88_ENABLED')return 'false';throw Error('Disabled key read');}});
assert.equal((await worker.default.fetch(new Request('https://synthetic.invalid/api/n88/student/read'),env)).status,503);assert.deepEqual(reads,['N88_ENABLED']);
checks.push({name:'n88_current_inactive_bundle_hashes_and_private_student_graph',status:'PASS',evidence:`${Object.keys(manifest.sources).length} current LF source hashes and ${Object.keys(manifest.outputs).length} output hashes verified. Private student graph excludes account/Auth/store/analytics/Sync, no external imports. Generated gateway default OFF reads only N88_ENABLED. Activation qualification explicitly BLOCKED.`});
await offlineChecks(report);
const handlers={},source=await readFile('sw.js','utf8');const shell=vm.runInNewContext(source+';SHELL',{self:{addEventListener:(n,fn)=>{handlers[n]=fn;},location:{origin:'https://synthetic.invalid'}},console,URL,Request,Response,Set,Promise});
for(const p of ['src/lib/student-portal-class-client.js','src/views/student-portal-class.js','src/styles/student-portal-class.css'])assert.ok(shell.includes('./'+p));
for(const pathname of ['/student','/student/','/api/n88/student/read','/api/n88/teacher/class/list','/n88-private/assets/student.mjs']){
  let intercepted=false;handlers.fetch({request:{method:'GET',url:'https://synthetic.invalid'+pathname,mode:'navigate'},respondWith:()=>{intercepted=true;}});assert.equal(intercepted,false);
}
checks.push({name:'n88_new_teacher_shell_dependencies_and_universal_private_exclusions',status:'PASS',evidence:'Actual SW fetch handler in synthetic VM bypasses /student, /api/n88/student, teacher API and /n88-private assets; new class module/client/CSS present in shell. No live browser/SW-cache certification claimed.'});
await writeFile('tests/n88-integrated-class-artifacts.json',JSON.stringify(report,null,2)+'\n');console.log('N88 scoped static bundle/SW checks PASS; UI remains blocked.');
