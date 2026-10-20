// AI: validate the saved single A/B trace; no browser, network or replay.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
const raw=JSON.parse(await readFile('tests/n107-independent-create-20261020/app-timing.json','utf8'));
assert.equal(raw.failures.length,1);assert.match(raw.failures[0],/evidence.after.totalMs<evidence.before.totalMs/);
for(const [variant,peak]of [['before',1],['after',2]]){
 const r=raw[variant];assert.equal(r.fixedDependencyMs,35);assert.equal(r.peak,peak);assert.equal(r.studentRequests,28);assert.equal(r.enrollmentRequests,28);assert.equal(r.gradeReceipts,1);
 const students=r.trace.filter(e=>e.phase==='mutation'&&e.entity==='students'),enrollments=r.trace.filter(e=>e.phase==='mutation'&&e.entity==='enrollments'),max=r.trace.find(e=>e.phase==='mutation'&&e.entity==='items'),grade=r.trace.find(e=>e.phase==='grade');
 assert.ok(Math.max(...students.map(e=>e.ack))<enrollments[0].start);assert.ok(Math.max(...enrollments.map(e=>e.ack))<max.start);assert.ok(max.ack<grade.start);assert.ok(grade.ack>grade.start);
}
assert.ok(raw.after.studentPhaseMs<raw.before.studentPhaseMs*0.8);
const proof={name:'n107_same_dependency_wait_benefit_and_ack_order',status:'PASS',beforeStudentPhaseMs:raw.before.studentPhaseMs,afterStudentPhaseMs:raw.after.studentPhaseMs,fixedDependencyMs:35,beforePeak:1,afterPeak:2,endToEndTiming:'NOT_RUN: capture unavailable; original harness total-time assertion FAIL retained in app-timing.json',scope:'Saved actual-app28/31 traces and existing DOM/store assertions completed before the optional total-time assertion; only student-phase benefit is qualified. No hosted speed claim.'};
await writeFile('tests/n107-independent-create-20261020/trace-proof.json',JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
