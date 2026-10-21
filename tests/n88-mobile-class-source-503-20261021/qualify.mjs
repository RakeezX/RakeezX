/** AI: exact changed-scope qualification; no provider/browser/process operations. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const base='0bca7554e60adca6b19ad804e4370874d9f5676b',ref='9c658ade13bddc0289f3e2cf3a7769533280c2ae',dir='tests/n88-mobile-class-source-503-20261021/';
const source='drafts/n88-student-portal/integrated-service.mjs',native='drafts/n88-student-portal/activation/bundle/edge/index.mjs',mf='drafts/n88-student-portal/activation/manifest.json';
const sha=b=>createHash('sha256').update(b).digest('hex'),lf=s=>s.replaceAll('\r\n','\n'),show=(r,p)=>execFileSync('git',['show',r+':'+p],{maxBuffer:2097152});
const read=async p=>lf(await readFile(p,'utf8')),report=async n=>JSON.parse(await read(dir+n+'.json'));
const previous=show(ref,native).toString('utf8'),current=await read(native);
assert.equal(sha(previous),'a5ca44450359a938128a99f2fa2bac274e9f88cc77d9d665c8e31ffcc67a88fe');
const oldLine='await ports.query("select n88_private.lock_projection_sources($1::uuid,$2::integer)", [ownerId, 2e3]);';
const newLine='await ports.query(listScopeOnly ? "select n88_private.lock_canonical_sources($1::uuid,$2::integer)" : "select n88_private.lock_projection_sources($1::uuid,$2::integer)", [ownerId, 2e3]);';
assert.equal(previous.split(oldLine).length,2);assert.equal(current.replace(newLine,oldLine),previous);
const sourceText=await read(source),sourceBase=lf(show(base,source).toString('utf8'));
const start=sourceText.indexOf('  // Admission reads only terms/teachings:'),end=sourceText.indexOf('  const canonical={};',start);
assert(start>0&&end>start);const undone=sourceText.slice(0,start)+"  await ports.query('select n88_private.lock_projection_sources($1::uuid,$2::integer)',[ownerId,2000]);\n"+sourceText.slice(end);
assert.equal(undone.replace('// the canonical source lock/bounds','// the complete source lock/bounds'),sourceBase);
const manifest=JSON.parse(await read(mf));assert.equal(manifest.outputs['edge/index.mjs'],sha(current));assert.equal(manifest.sources[source],sha(sourceText));
const oldManifest=JSON.parse(show(base,mf).toString('utf8'));for(const [p,h]of Object.entries(oldManifest.outputs))if(p!=='edge/index.mjs')assert.equal(manifest.outputs[p],h);
const red=await report('red-first'),nativeRed=await report('native-red-first'),green=await report('source-branch'),nativeGreen=await report('native-source-branch');
for(const r of [red,nativeRed]){assert.equal(r.status,'FAIL');assert.equal(r.failure.operation,'projection-only overbound list');assert.equal(r.fabricatedProjectionRows,2003);assert.deepEqual(r.projectionOnlyResult,{status:503,body:{error:'unavailable',stage:'source'}});assert.equal(r.cleanup.ownedNativePgClosed,true);assert.equal(r.cleanup.integrationLease,'RELEASED integration');}
assert.equal(nativeRed.nativeSha256,sha(previous));assert.equal(red.sourceSha256,sha(sourceBase));
for(const r of [green,nativeGreen]){assert.equal(r.status,'PASS');assert.equal(r.sourceSha256,sha(sourceText));assert.equal(r.cleanup.ownedNativePgClosed,true);assert.equal(r.cleanup.integrationLease,'RELEASED integration');}
assert.equal(nativeGreen.nativeSha256,sha(current));assert.equal(nativeGreen.checks.length,9);
const unchanged=['drafts/n88-student-portal/class-credentials.mjs','drafts/n88-student-portal/postgres-repository.mjs','drafts/n88-student-portal/canonical-adapter.mjs','drafts/n88-student-portal/auth-verifier.mjs','drafts/n88-student-portal/numeric-credentials.mjs','drafts/n88-student-portal/code-recovery.mjs','drafts/n88-student-portal/student-projection.mjs','drafts/n88-student-portal/visibility-policy.mjs','drafts/n88-student-portal/task-guidance.mjs','drafts/n88-student-portal/activation/private-error-boundary.mjs','drafts/n88-student-portal/activation/error-boundary-contract.json','drafts/n88-student-portal/activation/error-boundary-identities.json','drafts/n88-student-portal/activation/bundle/cloudflare/worker.mjs','drafts/n88-student-portal/activation/edge-request.mjs','src/lib/student-portal-runtime.js','src/lib/student-portal-class-client.js','sw.js'];
for(const p of unchanged)assert.equal(await read(p),lf(show(base,p).toString('utf8')),p);
const changed=execFileSync('git',['diff','--name-only',base],{encoding:'utf8'}).trim().split(/\r?\n/).filter(Boolean);
const untracked=execFileSync('git',['ls-files','--others','--exclude-standard'],{encoding:'utf8'}).trim().split(/\r?\n/).filter(Boolean);
for(const p of [...changed,...untracked])assert([source,native,mf,'docs/automation-evidence/20261021/N88_MOBILE_CLASS_SOURCE_503.md'].includes(p)||p.startsWith(dir),p);
for(const p of [source,native,dir+'source-branch.mjs',dir+'prepare-native.mjs',dir+'qualify.mjs'])execFileSync(process.execPath,['--check',p],{encoding:'utf8'});
execFileSync('git',['diff','--check'],{encoding:'utf8'});
const evidence={};for(const n of ['red-first','native-red-first','source-branch','native-source-branch','native-preparation'])evidence[n]={path:dir+n+'.json',sha256:sha(await readFile(dir+n+'.json'))};
const result={taskId:'continuous-n88-mobile-class-source-503-20261021',runId:'c7c4a888-7a84-4ca5-b5ce-58351c7b6dcb',baseSha:base,localStatus:'PASS',deliveryState:'BLOCKED',checks:[
 {name:'n88_source_503_exact_branch_red_first_and_safe_attribution',status:'PASS',evidence:'Original source and immutable provider-bound native59 both reproduce source503 with 2003 valid projection-only logs; corrected native/source pass. Actual account cause remains unproven.'},
 {name:'n88_list_scope_owner_canonical_membership_and_commit_fences',status:'PASS',evidence:'Native exact candidate on PG17: canonical-overbound, wrong-owner/session/Auth, stale term/class, current membership, concurrent revision lock and rollback/precommit/COMMIT guards.'},
 {name:'n88_full_projection_student_visibility_guidance_unchanged',status:'PASS',evidence:'Actual native student cookie read, visibility save and guidance-list retain full projection; overbound student read remains denied. Full default source remains byte-identical except admission lock selection.'},
 {name:'n88_failure_remains_private_bounded_and_truthful',status:'PASS',evidence:'No cap/retry/region/SQL/Auth/schema change; exact fixed source503/private headers retained; no secrets in evidence, no real request, no service/browser/UI acceptance claim.'},
 {name:'n88_changed_native_source_provider_pin_and_served_parity_if_needed',status:'NOT_RUN',evidence:'Required changed native upload, public source pin and provider/served parity not performed: final user instruction says do not push or deploy. No current attempt reserved or consumed.'}
],sourceSha256:sha(sourceText),priorNativeSha256:sha(previous),candidateNativeSha256:sha(current),exactSingleDeltaAgainstProviderBoundNative:true,evidence,unchanged,renderedUi:'NOT_RUN: no frontend change',realAccountCause:'NOT_PROVEN',providerOperations:0,cleanup:nativeGreen.cleanup};
await writeFile(dir+'qualification.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({localStatus:result.localStatus,deliveryState:result.deliveryState,checks:result.checks}));
