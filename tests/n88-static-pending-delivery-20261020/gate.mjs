// AI: pure authority gate checks only; no network or protected-state mutation.
import assert from 'node:assert/strict';import fs from 'node:fs/promises';
import {STATIC1522,static1522Gate} from '../../drafts/n88-student-portal/activation/static-1522-gate.mjs';
const q=JSON.parse(await fs.readFile('C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/'+STATIC1522.task+'.json','utf8'));
assert(static1522Gate(q,STATIC1522.run));let rejected=0;
for(const mutate of [x=>x.id='wrong',x=>x.status='pending',x=>x.sessionId='wrong',x=>x.attempt.runId='wrong',x=>x.preparationAuthority.reviewedStatic1522.preparedCandidateSha='wrong',x=>x.preparationAuthority.reviewedStatic1522.carrier='wrong',x=>x.preparationAuthority.reviewedStatic1522.priorCarrier='wrong',x=>x.preparationAuthority.reviewedStatic1522.unchangedNative='wrong',x=>x.preparationAuthority.reviewedStatic1522.nativeDeploys=1,x=>x.preparationAuthority.reviewedStatic1522.resetConsumedMarkers=true]){const bad=structuredClone(q);mutate(bad);assert.throws(()=>static1522Gate(bad,STATIC1522.run));rejected++;}
assert.throws(()=>static1522Gate(q,STATIC1522.run,true));rejected++;
const report={status:'PASS',positive:1,negative:rejected,scope:'Pure task/run/session/candidate/hash/preimage/boundary/consumed gate',protectedWrites:0};await fs.writeFile('tests/n88-static-pending-delivery-20261020/gate.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
