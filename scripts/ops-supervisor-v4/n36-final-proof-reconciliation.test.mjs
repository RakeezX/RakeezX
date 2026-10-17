import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {reconcilableCheckOutcomes} from './apply-reviewed-maintenance.mjs';
const f=JSON.parse(fs.readFileSync(new URL('./n36-final-proof-reconciliation.fixture.json',import.meta.url),'utf8'));
test('retains exact N36 real native/account NOT_RUN while accepting complete inert publication',()=>assert.equal(reconcilableCheckOutcomes(f.task,f.result,f.task.deliveryReceipt),true));
for(const [name,mutate] of [
 ['required not run',(t,r)=>r.checks[0].status='NOT_RUN'],
 ['real failure',(t,r)=>r.checks[0].status='FAIL'],
 ['unknown optional',(t,r)=>r.checks.push({name:'unknown_optional',status:'NOT_RUN'})],
 ['other task',t=>t.id='continuous-n36-other'],
 ['live task',t=>t.liveMutation=true],
 ['missing served proof',(t,r,d)=>d.evidence.production.assets=d.evidence.production.assets.filter(a=>a.repoPath!==t.verificationPaths[0])]
])test('rejects '+name,()=>{const t=structuredClone(f.task),r=structuredClone(f.result),d=structuredClone(t.deliveryReceipt);mutate(t,r,d);assert.equal(reconcilableCheckOutcomes(t,r,d),false);});
