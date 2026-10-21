/** AI: prepare a NEW task/run gate from existing bounded original-custodian ports.
 * Historical gates/markers stay untouched. No provider operation at preparation. */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
const dir='tests/n88-student-read-phase-latency-20261021/',file='drafts/n88-student-portal/official-activation.mjs';
const p=JSON.parse(await readFile(dir+'package.json','utf8'));
const config={task:'continuous-n88-student-read-phase-latency-20261021',run:'2c1fb6b8-d4ce-428a-8539-65e83d5a6a86',session:'01a15e63-ff70-7d02-b264-2631fc585456',base:'e710fcbbf51fcaa59715e45e4aa15aaa353bb1e3',sourceCandidate:'c072fac17ca761751be88982b7ba75e4f0f3aa3f',prior:p.priorNative,source:p.native,originalRoot:'C:/Users/Abody/Projects/RakeezX/.worktrees/continuous-n88-official-student-portal-activation-20261018',taskRoot:process.cwd().replaceAll('\\','/'),authorization:'PO-20261021-N88-STUDENT-GET-MEASURED-LATENCY',evidence:dir};
let gate=(await readFile('tests/n88-mobile-class-source-503-20261021/native-gate.mjs','utf8')).replace(/export const MOBILE503=Object.freeze\(\{[\s\S]*?\n\}\);/,'export const LATENCY=Object.freeze('+JSON.stringify(config,null,2)+');').replaceAll('MOBILE503','LATENCY').replaceAll('mobile503Authority','latencyAuthority').replaceAll('runMobile503Phase','runLatencyNativePhase').replaceAll('mobile503','latency').replace("a?.kind==='PO-20261021-N88-actual-mobile-source-503'","a?.kind==='PO-20261021-N88-student-GET-measured-latency'").replace("['realAccountReads','realStudentTeacherWrites','maxSafeProviderAggregateWindows','maxChangedPrivateStaticUploads','newReadinessRequests','sqlAuthSchemaChanges','regionChanges']","['realAccountReads','realStudentTeacherWrites','newReadinessRequests','sqlAuthSchemaChanges','regionChanges']").replace('provider.version===59','provider.version===61');
gate=gate.replace("const state=await load();", "must(auditDiagnosticAuthority(p.card),'diagnostic_authority');\n const state=await load();");
gate+='\nfunction auditDiagnosticAuthority(card){const a=card.preparationAuthority;return a.diagnosticOnlyOnSuccessfulGet===true&&a.diagnosticOnlyFixedRoundedPhaseDurations===true&&a.maxChangedPrivateStaticUploads===1&&a.maxChangedStudentCarrierUploads===1;}\n';
await writeFile(dir+'native-gate.mjs',gate);
let official=await readFile(file,'utf8');assert(!official.includes('--latency-preflight'));
const start=official.indexOf(" if(['--mobile503-preflight'"),end=official.indexOf(" if(['--student-pending-static-owned-preflight'",start);assert(start>0&&end>start);
let branch=official.slice(start,end).replaceAll('MOBILE503','LATENCY').replaceAll('runMobile503Phase','runLatencyNativePhase').replaceAll('mobile503Digest','latencyDigest').replaceAll('N88_MOBILE503','N88_LATENCY').replaceAll('mobile503','latency');
const oldCompare="for(const file of ['drafts/n88-student-portal/integrated-service.mjs','drafts/n88-student-portal/activation/bundle/edge/index.mjs',c.evidence+'qualification.json',c.evidence+'native-source-branch.json'])";
const newCompare="for(const file of ['drafts/n88-student-portal/integrated-service.mjs','drafts/n88-student-portal/activation/bundle/edge/index.mjs',c.evidence+'diagnostic-qualification.json',c.evidence+'diagnostic-service.json'])";
assert(branch.includes(oldCompare));branch=branch.replace(oldCompare,newCompare).replaceAll("c.sourceCandidate+':'+file","checked+':'+file");
const oldProof="const proof=await json(path.join(evidence,'qualification.json'));if(proof.localStatus!=='PASS'||proof.candidateNativeSha256!==c.source||proof.priorNativeSha256!==c.prior)fail('n88_latency_local_proof');";
assert(branch.includes(oldProof));branch=branch.replace(oldProof,"const proof=await json(path.join(evidence,'diagnostic-qualification.json'));if(proof.localStatus!=='PASS'||proof.native!==c.source||proof.priorNative!==c.prior)fail('n88_latency_local_proof');");
official=official.slice(0,end)+branch+official.slice(end);
official=official.replace("import assert from 'node:assert/strict';","import assert from 'node:assert/strict';\nimport {LATENCY,runLatencyNativePhase,digest as latencyDigest} from '../../tests/n88-student-read-phase-latency-20261021/native-gate.mjs';");
await writeFile(file,official);console.log('prepared new native gate and original-custodian entry; no operations');
