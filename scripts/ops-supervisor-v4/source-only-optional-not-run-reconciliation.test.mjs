import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { reconcilableCheckOutcomes } from './apply-reviewed-maintenance.mjs';
const root='C:/Users/Abody/Projects/RakeezX';
const id='continuous-n44-native-postgres-qualification-20261017';
const task=JSON.parse(fs.readFileSync(root+'/artifacts/ops-supervisor-v4/queue/'+id+'.json','utf8'));
const result=JSON.parse(fs.readFileSync(task.resultPath,'utf8'));
test('accepts only documented optional NOT_RUN on exact inert source receipt',()=>{
  assert.equal(reconcilableCheckOutcomes(task,result,task.deliveryReceipt),true);
});
for(const [name,mutate] of [
 ['required check not run',r=>r.checks.find(x=>x.name===task.requiredChecks[0]).status='NOT_RUN'],
 ['unknown optional not run',r=>r.checks.push({name:'unknown_optional',status:'NOT_RUN'})],
 ['real failure',r=>r.checks[0].status='FAIL'],
 ['live task',(_r,t)=>t.liveMutation=true],
 ['unverified source path',(_r,_t,d)=>d.evidence.production.assets=d.evidence.production.assets.filter(x=>x.repoPath!==task.verificationPaths[0])]
])test('rejects '+name,()=>{const r=structuredClone(result),t=structuredClone(task),d=structuredClone(task.deliveryReceipt);mutate(r,t,d);assert.equal(reconcilableCheckOutcomes(t,r,d),false);});
