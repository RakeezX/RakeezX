/** AI: local-only, one reversible delta over immutable provider-bound native59.
 * Never rebuild stale main dependencies over the served function; no upload/pin. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const ref='9c658ade13bddc0289f3e2cf3a7769533280c2ae',file='drafts/n88-student-portal/activation/bundle/edge/index.mjs',manifestFile='drafts/n88-student-portal/activation/manifest.json';
const sha=b=>createHash('sha256').update(b).digest('hex'),prior=execFileSync('git',['show',ref+':'+file],{maxBuffer:2097152}).toString('utf8');
const pin='a5ca44450359a938128a99f2fa2bac274e9f88cc77d9d665c8e31ffcc67a88fe';assert.equal(sha(prior),pin);
const nativeReceipt=JSON.parse(await readFile('tests/n88-student-pending-return-finite-diagnostic-20261021/read-native-before.json','utf8'));
assert.equal(nativeReceipt.nativeSource,pin);assert.equal(nativeReceipt.nativeVersion,59);assert.equal(nativeReceipt.sourceExact,true);
const ownedReceipt=JSON.parse(await readFile('tests/n88-student-session-quiet-progress-20261021/owned-preflight.json','utf8'));assert.equal(ownedReceipt.nativeSource,pin);assert.equal(ownedReceipt.publicPinMatches,true);
const before='async function readCanonical(ports, ownerId, listScopeOnly = false) {\n  await ports.query("select n88_private.lock_projection_sources($1::uuid,$2::integer)", [ownerId, 2e3]);';
const after='async function readCanonical(ports, ownerId, listScopeOnly = false) {\n  await ports.query(listScopeOnly ? "select n88_private.lock_canonical_sources($1::uuid,$2::integer)" : "select n88_private.lock_projection_sources($1::uuid,$2::integer)", [ownerId, 2e3]);';
assert.equal(prior.split(before).length,2);const next=prior.replace(before,after);assert.equal(next.replace(after,before),prior);assert.notEqual(sha(next),pin);
await writeFile(file,next);
const m=JSON.parse(await readFile(manifestFile,'utf8'));m.outputs['edge/index.mjs']=sha(next);
const source='drafts/n88-student-portal/integrated-service.mjs';m.sources[source]=sha((await readFile(source,'utf8')).replaceAll('\r\n','\n'));
m.mobileSource503Preparation={taskId:'continuous-n88-mobile-class-source-503-20261021',runId:'c7c4a888-7a84-4ca5-b5ce-58351c7b6dcb',baseSha:'0bca7554e60adca6b19ad804e4370874d9f5676b',immutableNativeRef:ref,priorNativeVersion:59,priorNativeSha256:pin,preparedNativeSha256:sha(next),delta:'Only readCanonical lock selection: canonical for list/credential admission, full projection otherwise',preservesServedNativeGraph:true,staleMainGraphNotRebuilt:true,publication:'NOT_RUN: final user instruction forbids push/deploy',providerPinUpdate:'NOT_RUN',providerServedParity:'NOT_RUN',realAccountCause:'NOT_PROVEN',realAccountRequests:0,providerWrites:0};
await writeFile(manifestFile,JSON.stringify(m,null,2)+'\n');await writeFile('tests/n88-mobile-class-source-503-20261021/native-preparation.json',JSON.stringify(m.mobileSource503Preparation,null,2)+'\n');console.log(JSON.stringify(m.mobileSource503Preparation));
