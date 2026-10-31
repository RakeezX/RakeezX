/** AI: corrected packet and reused evidence boundaries, no network or browser. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {verifyPackage,bindPackage} from '../../drafts/n88-student-portal/activation/v2-runtime-writer-1031/package.mjs';
const dir='drafts/n88-student-portal/activation/v2-runtime-writer-1031/',read=p=>fs.readFileSync(p,'utf8'),sha=s=>createHash('sha256').update(s).digest('hex');
test('current exact packet is the native-qualified delta, inactive and source-bound',async()=>{
 const {manifest:m,sql}=await verifyPackage(),native=JSON.parse(read('tests/n88-writer-compatibility-1031/packet-results.json'));
 assert.equal(native.status,'PASS');assert.equal(m.taskId,'continuous-n88-writer-compatibility-20261031');assert.equal(m.serviceEnabled,false);assert.equal(m.hostedExecuted,false);assert.equal(m.storageReinstall,false);
 assert.equal(m.delta.earlyEntries,30);assert.equal(m.delta.newWriterHelpers,3);assert.equal(m.delta.canonicalWritesByN88,0);assert.equal(m.delta.newRuntimeFixedExecute,14);assert.equal(m.delta.newCredentials,0);assert.equal(m.delta.rawTableGrants,0);
 assert.equal(sha(sql.replaceAll(m.bundleSha256,native.packetQualification.bundleSha256)),native.packetQualification.sourceInstallerSha256);
 const journey=JSON.parse(read('tests/n88-writer-compatibility-1031/results.json'));
 assert.equal(sha(sql.replaceAll(m.bundleSha256,journey.packetQualification.bundleSha256)),journey.packetQualification.sourceInstallerSha256,'full journey used the identical corrected SQL delta');
 assert.equal((await bindPackage()).inactive,true);await assert.rejects(bindPackage({operation:'arbitrary'}),/n88_exact_package_operation_required/);await assert.rejects(bindPackage({authorityPath:'tests/fake-authority.json',authoritySha256:'0'.repeat(64)}),/n88_original_authority_path_required/);
});
test('all original body bytes and metadata are represented; invoker entries stay invoker',()=>{
 const observed=JSON.parse(read(dir+'current-writers.json')),plan=JSON.parse(read(dir+'writer-baseline.json'));
 assert.equal(observed.functions.length,46);assert.equal(observed.triggers.length,150);assert.equal(plan.entries.length,30);assert.equal(plan.unchangedBackingChains.length,16);assert.equal(plan.newBackingEntries,0);
 for(const e of plan.entries){const original=observed.functions.find(f=>f.signature===e.signature);assert.equal(sha(original.definition),e.baselineSha256);assert.equal(sha(original.definition.split('AS $function$')[1].split('$function$')[0]),e.bodySha256);assert.equal(e.definer,original.prosecdef);assert.equal(e.arguments,original.arguments);assert.deepEqual(e.config,original.proconfig);assert.equal(e.acl,original.acl);}
 assert.equal(plan.entries.filter(e=>!e.definer).length,3);
});
test('reuse is byte-bound to the preserved runtime, Auth, LOGIN and gateway candidate',()=>{
 const paths=['host.mjs','capability.mjs','gateway.inactive.mjs','runtime-role.sql','disable.sql'].map(n=>dir+n).concat(['existing-host.mjs','web-entry.mjs','publication-v2-finite-bridge.inactive.mjs','publication-v2-finite-catalog.inactive.mjs','publication-v2-canonical.inactive.mjs','publication-v2-postgres.inactive.mjs','publication-v2-service.inactive.mjs','auth-verifier.mjs','numeric-credentials.mjs','activation/private-error-boundary.mjs','activation/database-transport.mjs'].map(n=>'drafts/n88-student-portal/'+n));
 for(const p of paths)assert.equal(read(p).replaceAll('\r\n','\n'),execFileSync('git',['show','0b17ef977446304f8236daf406575a717ce8471c:'+p],{encoding:'utf8'}).replaceAll('\r\n','\n'),p);
});
test('genuine native compatibility and cleanup proofs remain truthful',()=>{
 const r=JSON.parse(read('tests/n88-writer-compatibility-1031/results.json'));assert.equal(r.status,'PASS');assert.equal(r.checks.length,12);assert(r.checks.every(c=>c.status==='PASS'));assert(r.cleanup.pidAbsent&&r.cleanup.portFree&&r.cleanup.ownedDataRemoved);assert.equal(r.leaseRelease,'RELEASED integration');
 assert(r.originalProtocol.children.every(c=>c.deleted_at===null));assert.equal(r.originalProtocol.subitem.code,'42501');assert.equal(r.originalProtocol.ahead.code,'22023');
});
