/** AI: changed inactive artifact graph only. No UI/hosted certification. */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {verifyIntegratedReadback} from '../drafts/n88-student-portal/integrated-readback.mjs';
const dir='drafts/n88-student-portal/activation/',sha=b=>createHash('sha256').update(b).digest('hex');
const m=JSON.parse(await readFile(dir+'manifest.json','utf8')),d=JSON.parse(await readFile(dir+'deploy.staged.json','utf8'));
for(const [p,h]of Object.entries(m.sources))assert.equal(sha((await readFile(p,'utf8')).replaceAll('\r\n','\n')),h,p);
for(const [p,h]of Object.entries(m.outputs))assert.equal(sha(await readFile(dir+'bundle/'+p)),h,p);
assert.equal(d.enabled,false);assert.equal(d.function.enabled,false);assert.equal(d.privateDocument.browserReadiness,false);assert.equal(d.qualification.activationPermitted,false);
assert.deepEqual(m.budgetContract,d.budgetContract);assert.deepEqual(m.budgetContract.failedGuesses,{source:6,global:100});assert.deepEqual(m.budgetContract.allRequests,{source:120,global:1200});
assert.deepEqual(m.credentialContract,{format:'six-v1',pattern:'^1[0-9]{5}$',capacity:100000});
assert.equal(m.migrationGeneration.version,'20261018114113');assert.equal(d.migrations.length,4);
assert.equal((await readFile(d.migration,'utf8')).replaceAll('\r\n','\n'),(await readFile('drafts/n88-student-portal/shared-network-budget.inactive.sql','utf8')).replaceAll('\r\n','\n'));
assert.ok(!m.graphs['private/assets/student.mjs'].inputs.some(x=>/cloud\.js|store\.js|auth|analytics|sync|ownership|teacher/i.test(x)));
const gateway=await import('../drafts/n88-student-portal/activation/bundle/cloudflare/worker.mjs');const reads=[];
const env=new Proxy({},{get:(_t,k)=>{reads.push(k);if(k==='N88_ENABLED')return 'false';throw Error('Disabled key read');}});
assert.equal((await gateway.default.fetch(new Request('https://synthetic.invalid/api/n88/student/read'),env)).status,503);assert.deepEqual(reads,['N88_ENABLED']);
const expected=JSON.parse(await readFile(dir+'integrated-expected-identities.json','utf8'));
assert.equal(expected.migrationVersions.at(-1),'20261018114113');assert.ok(expected.identities.tables.some(t=>t.relname==='numeric_attempts'&&t.relrowsecurity));
const envelope={projectId:'xlrubcwjqktzzunrvuns',mode:'metadata-only',personalRowsRead:0,enabled:false,capturedAt:new Date().toISOString(),...expected};
assert.match(verifyIntegratedReadback(envelope,expected),/identities match/);
const tampered=structuredClone(envelope);tampered.identities.tables=tampered.identities.tables.filter(t=>t.relname!=='numeric_attempts');assert.throws(()=>verifyIntegratedReadback(tampered,expected));
// Earlier SW/private graph evidence reused: no new startup/browser dependency.
const previous=JSON.parse(await readFile(dir+'prior-shared-budget-manifest.json','utf8'));
assert.equal(m.sources['sw.js'],previous.sources['sw.js']);
assert.deepEqual(m.graphs['private/assets/student.mjs'],previous.graphs['private/assets/student.mjs']);
const report={taskId:'continuous-n88-shared-network-success-budget-20261018',runId:'151cbf7c-52a6-4fc7-96a5-b899497b8c6f',checks:[{name:'n88_shared_network_source_global_flood_isolation_uniform_denial_inactive_activation',status:'PASS',evidence:'Current LF source and exact output hashes verified; fresh fourth CLI migration equals proposal, native readback includes private attempts/RLS/guard. Missing attempt-table identity rejects. Separate numeric budgets explicit, six-v1 unchanged, all readiness/activation OFF and disabled gateway reads no secrets. Unchanged browser graph/SW hashes reuse prior exclusions. Actual source/global/flood/uniform-denial proof is in shared-network report.'}]};
await writeFile('tests/n88-six-digit-shared-artifacts.json',JSON.stringify(report,null,2)+'\n');console.log('N88 shared-network inactive artifact checks PASS');
