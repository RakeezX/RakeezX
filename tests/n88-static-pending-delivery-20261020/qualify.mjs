// AI: reuse exact immutable component proofs; no UI/service replay.
import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {execFileSync} from 'node:child_process';import {createHash} from 'node:crypto';
const prepared='7c4f8dbd15d1decc2045e322a4f0b2e9930fe687',dir='tests/n88-static-pending-delivery-20261020/',old='tests/n88-initial-continuity-1522-20261020/',lf=s=>s.replaceAll('\r\n','\n'),sha=x=>createHash('sha256').update(x).digest('hex');
const q=JSON.parse(await fs.readFile('C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/continuous-n88-deliver-qualified-pending-login-static-20261020.json','utf8')),r=q.preparationAuthority.reviewedStatic1522;
for(const [p,h]of Object.entries(r.sourcePins))assert.equal(sha(lf(await fs.readFile(p,'utf8'))),h,p);
for(const [p,h]of Object.entries(r.packageOutputs))assert.equal(sha(await fs.readFile('drafts/n88-student-portal/activation/bundle/'+p)),h,p);
for(const p of ['conclusion.json','ui.json','student.json','student.resume-counter-fixture-fail.json','provider-window.json','qualification.json'])assert.equal(lf(await fs.readFile(old+p,'utf8')),lf(execFileSync('git',['show',prepared+':'+old+p],{encoding:'utf8'})),p+' immutable');
assert.equal(sha(lf(await fs.readFile(old+'qualification.json','utf8'))),r.qualificationSha256);
assert.equal(JSON.parse(await fs.readFile(old+'conclusion.json','utf8')).checks[0].status,'FAIL');
const student=JSON.parse(await fs.readFile(old+'student.json','utf8'));assert.equal(student.status,'PASS');assert.equal(student.student.length,7);
const provider=JSON.parse(await fs.readFile(dir+'carrier-readback.json','utf8')),served=JSON.parse(await fs.readFile(dir+'served.json','utf8')),native=JSON.parse(await fs.readFile(dir+'native-readback.json','utf8'));
assert(provider.sourceExact&&provider.configurationUnchanged&&provider.servedAssetsExact);assert.equal(provider.source,r.carrier);assert.equal(served.sha256,r.student);assert.equal(served.status,'PASS');assert(served.privateHeaders);assert.equal(native.source,r.unchangedNative);assert.equal(native.version,53);
assert.equal(JSON.parse(await fs.readFile(dir+'gate.json','utf8')).status,'PASS');
const report={status:'PASS',scope:'PARTIAL_SUBFIX_ONLY',preparedCandidate:prepared,studentSevenCaseProof:'REUSED_UNCHANGED_PASS',singleOwnedErrorSubproof:'REUSED_UNCHANGED_PASS',originalActualTeacherCauseGate:'FAIL_PRESERVED',actualTeacherSuccess:'NOT_PROVEN',carrier:provider.source,version:provider.version,native: native.source,nativeVersion:53,uploads:1,nativeDeploys:0,publicPinChanges:0,readinessRequests:0,priorHTMLStrictByteComparison:'FAIL_PRESERVED',cleanup:'Integration lease released; no browser/server launched in this delivery phase'};
await fs.writeFile(dir+'conclusion.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
