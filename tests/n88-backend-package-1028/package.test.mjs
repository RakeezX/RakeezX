/** AI: affected inactive packet checks. No server/database/provider acquisition. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createInactivePublicationV2Host,ownLocalPublicationV2} from '../../drafts/n88-student-portal/publication-v2-host.inactive.mjs';
import {publicationV2FiniteCatalog as catalogue,publicationV2FiniteCatalogSha256} from '../../drafts/n88-student-portal/publication-v2-finite-catalog.inactive.mjs';
import {attachPublicationRetirement} from '../../drafts/n88-student-portal/activation/v2-package-1028/lifecycle-attach.inactive.mjs';
const root=new URL('../../',import.meta.url),packet='drafts/n88-student-portal/activation/v2-package-1028/';
const read=p=>readFileSync(new URL(p,root)),hash=b=>createHash('sha256').update(b).digest('hex');
const manifest=JSON.parse(read(packet+'manifest.json')),operations=JSON.parse(read(packet+'boundary-operations.json')).operations;
test('exact source packet hashes, catalogue and fourteen installed definition identities',()=>{
  assert.equal(manifest.inactive,true);assert.equal(manifest.catalogSha256,publicationV2FiniteCatalogSha256);
  assert.equal(manifest.sourceEncoding,'utf8-lf-preserve-bom');
  for(const [file,expected]of Object.entries(manifest.files)){
    const lf=read(file).toString().replaceAll('\r\n','\n');assert.equal(hash(lf),expected,file);
    assert.equal(hash(lf.replaceAll('\n','\r\n').replaceAll('\r\n','\n')),expected,'CRLF checkout '+file);
  }
  assert.equal(operations.length,14);assert.equal(manifest.functions.length,14);
  for(const o of operations){const original=catalogue.find(c=>c.id===o.id);assert.equal(o.sql,original.sql);assert.equal(o.sha256,hash(o.sql));assert.match(o.callSql,/^select \* from n88_private\.v2_[a-f0-9]{24}\(/);}
  assert(manifest.functions.every(f=>f.owner==='n88_v2_guard'&&f.definer&&f.config.length===1&&f.config[0]==='search_path=pg_catalog'&&f.acl.every(p=>/^(n88_v2_guard|n88_v2_runtime):EXECUTE$/.test(p))));
});
test('package has exact original four-table storage body, local-only install guard, small private roles',()=>{
  const sql=read(packet+'schema.sql').toString();const original=read('drafts/n88-student-portal/publication-v2-storage.inactive.sql').toString().replace(/^begin;\r?\n/m,'').replace(/commit;\s*$/,'');
  assert(sql.includes(original));assert.equal([...sql.matchAll(/^create table /gm)].length,4);assert.equal([...sql.matchAll(/^create function n88_private\.v2_/gm)].length,14);
  assert.match(sql,/n88_v2_external_install_authority_required/);assert.match(sql,/n88_v2_install_collision_readback_required/);
  for(const role of ['guard','runtime'])assert(sql.includes(`create role n88_v2_${role} nologin nosuperuser nobypassrls nocreatedb nocreaterole noinherit`));
  assert.equal([...sql.matchAll(/force row level security/g)].length,4);assert.doesNotMatch(sql,/grant .* to (?:public|anon|authenticated);/i);
  assert.match(sql,/revoke create on schema n88_private from n88_v2_guard/);assert.match(sql,/for update to n88_v2_guard using\(true\) with check\(false\)/);
});
test('default OFF performs no acquisition; enabled assembly rejects forged capabilities',async()=>{
  const off=await createInactivePublicationV2Host();const r=await off.handle({method:'GET',path:'/student/publication-v2/read',headers:{}});assert.equal(r.status,401);assert.deepEqual(r.body,{error:'unavailable'});
  for(const capability of [{},Object.freeze({}),null])await assert.rejects(createInactivePublicationV2Host({enabled:true,capability,canonical:{}}),/n88_v2_host_unavailable/);
  let connections=0;await assert.rejects(ownLocalPublicationV2({workspace:process.cwd(),phase:process.cwd(),taskId:'n88-backend-package-1028',runId:manifest.runId,ownerToken:'f'.repeat(36),connect:()=>{connections++;}}));assert.equal(connections,0);
});
test('actual native report proves private runtime and cleanup; mocks are not counted as PG',()=>{
  const r=JSON.parse(read('tests/n88-backend-package-1028/results.json'));assert.equal(r.status,'PASS');assert.equal(r.checks.length,10);assert(r.checks.every(c=>c.status==='PASS'));
  assert.equal(r.cleanup.stopped,true);assert.equal(r.cleanup.pidAbsent,true);assert.equal(r.cleanup.portFree,true);assert.equal(r.cleanup.ownedDataRemoved,true);assert.equal(r.leaseRelease,'RELEASED integration');
  assert.equal(r.localConfig.listen,'127.0.0.1');assert.equal(r.localConfig.password_encryption,'scram-sha-256');assert.match(r.serverVersion,/^PostgreSQL 17\.6 /);
  assert.equal(r.storageCatalog.length,4);assert(r.storageCatalog.every(t=>t.relrowsecurity&&t.relforcerowsecurity));assert.deepEqual(r.functions,manifest.functions);
  assert(r.nativePids.length>2);assert(r.restartPersistence.receipts>0&&r.restartPersistence.tombstones>=2&&r.restartPersistence.original_receipts===1);
});
test('existing hosted boundary is byte-identical and bridge remains the published implementation',()=>{
  assert.equal(hash(read('drafts/n88-student-portal/activation/private-error-boundary.mjs')),'58ae1bb5f128cf31998ed8ccfa8e372e4980fdbfcc611f8aef61e9dc3098d49e');
  const host=read('drafts/n88-student-portal/publication-v2-host.inactive.mjs').toString();assert.match(host,/createInactivePublicationV2FiniteBridge/);assert.doesNotMatch(host,/process\.env|fetch\(|\.listen\(|connectionString|privateQuery\(/);
  assert.equal(Object.keys(manifest.files).filter(p=>p.includes('finite-bridge')).length,1);
});
test('retirement attachment preserves original receipt ordering, guards and no-replay semantics',async()=>{
  const auth={ownerId:'owned',sessionId:'session',current:true},events=[];const tx={bindOwner:async()=>events.push('bind')};
  const ports={authenticate:async()=>auth,captureRetirement:async()=>{events.push('capture');return {};},completeRetirement:async()=>events.push('complete')};
  const command={ownerId:'owned',sessionId:'session',requestId:'original',scope:{ownerId:'owned'},kind:'item',sourceId:'item',expectedRevision:'1'};
  const lifecycle={validateOriginalCommand:async()=>{events.push('validate-original');return command;},findOriginalReceipt:async()=>{events.push('original-receipt');return null;},applyOriginalMutation:async()=>events.push('original-mutation'),writeOriginalReceipt:async()=>{events.push('write-original');return {applied:true};}};
  assert.deepEqual(await attachPublicationRetirement({tx,ports,lifecycle}),{applied:true});assert.deepEqual(events,['bind','validate-original','original-receipt','capture','original-mutation','complete','write-original']);
  events.length=0;lifecycle.findOriginalReceipt=async()=>({original:true});assert.deepEqual(await attachPublicationRetirement({tx,ports,lifecycle}),{original:true});assert.deepEqual(events,['bind','validate-original']);
  lifecycle.findOriginalReceipt=async()=>{throw Error('original-envelope-mismatch');};await assert.rejects(attachPublicationRetirement({tx,ports,lifecycle}),/original-envelope-mismatch/);
  lifecycle.validateOriginalCommand=async()=>({...command,ownerId:'foreign'});await assert.rejects(attachPublicationRetirement({tx,ports,lifecycle}),/n88_v2_lifecycle_unavailable/);
});
