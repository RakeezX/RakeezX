/** AI: exact source/guard/read-only protocol checks. NO installer execution,
 * database, provider, real credentials, accounts, browser or network. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {runReadOnlyPreflight,readOnlyQueryPlan,readOnlyQueryPlanSha256,baselineInventorySql,verifyPinnedSources,sameTargetIdentity} from '../drafts/n88-student-portal/activation/v2-external-plan-1028/preflight.mjs';
import {assertVerifiedBoundary,privateQuery,boundaryCatalogSql} from '../drafts/n88-student-portal/activation/private-error-boundary.mjs';
const base=new URL('../',import.meta.url),dir='drafts/n88-student-portal/activation/v2-external-plan-1028/';
const read=p=>readFileSync(new URL(p,base),'utf8').replaceAll('\r\n','\n');
const sha=s=>createHash('sha256').update(s).digest('hex');
const manifest=JSON.parse(read(dir+'manifest.json')),sql=read(dir+'install.sql');
const packet=JSON.parse(read('drafts/n88-student-portal/activation/v2-package-1028/manifest.json'));
const identities=JSON.parse(read('drafts/n88-student-portal/activation/error-boundary-identities.json'));
test('exact immutable packet body, four relations/two roles/14 fixed functions; local gate unchanged',async()=>{
  const original=read('drafts/n88-student-portal/activation/v2-package-1028/schema.sql');
  const marker='-- BEGIN EXACT original storage proposal (transaction wrapper excluded)';
  const delta=original.slice(original.indexOf(marker)).replace(/commit;\s*$/,'');
  assert.equal(sha(delta),manifest.deltaSha256);assert(sql.includes(delta));assert(sql.includes(`-- BEGIN IMMUTABLE PACKAGE DELTA sha256:${manifest.deltaSha256}\n${delta}-- END IMMUTABLE PACKAGE DELTA`));
  assert.equal([...sql.matchAll(/^create table /gm)].length,4);assert.equal([...sql.matchAll(/^create role /gm)].length,2);assert.equal([...sql.matchAll(/^create function n88_private\.v2_/gm)].length,14);
  assert.equal(sha(original),packet.files['drafts/n88-student-portal/activation/v2-package-1028/schema.sql']);assert(original.includes('n88_v2_external_install_authority_required'));assert(!sql.includes('n88.v2_package_install'));
  assert.deepEqual(manifest.expectedFunctions,packet.functions);assert(await verifyPinnedSources());
});
test('unbound target/authority fail before DDL even if session attestation strings were set',()=>{
  assert.equal(manifest.target,null);assert.equal(manifest.preflightAuthority,null);assert.equal(manifest.installationAuthority,null);assert.equal(manifest.execute,false);
  const gate=sql.indexOf('n88_external_target_and_authority_unbound');assert(gate>=0&&gate<sql.indexOf('create schema'));
  assert(sql.includes("expected_target jsonb := 'null'::jsonb"));assert(sql.includes("expected_authority jsonb := 'null'::jsonb"));
  for(const required of ['n88_external_exact_authority_mismatch','n88_external_physical_target_or_role_mismatch','n88_external_prerequisite_inventory_changed','n88_external_collision_or_partial_state_readback_only','n88_external_fixed_function_readback_mismatch','n88_external_storage_rls_mismatch'])assert(sql.includes(required));
  assert(sql.includes(baselineInventorySql));assert.match(sql,/BEGIN ISOLATION LEVEL SERIALIZABLE/);assert.equal([...sql.matchAll(/^COMMIT;/gm)].length,1);
  assert.equal(sha(sql),manifest.installerSha256);assert.equal(sha(read(dir+'preflight.mjs')),manifest.preflightSha256);
});
test('default read-only runner does not acquire or query anything',async()=>{
  let acquired=0;const r=await runReadOnlyPreflight({acquireApprovedReadOnly:()=>{acquired++;throw Error('must-not-open');}});
  assert.equal(r.state,'NOT_RUN');assert.equal(r.queried,false);assert.equal(r.installationAuthorized,false);assert.equal(acquired,0);assert(r.missing.includes('exact_current_read_only_authority'));
});
test('inventory is exact bounded SELECT catalog metadata, no Auth/application row reads or control execution',()=>{
  assert.equal(readOnlyQueryPlan.length,9);assert.equal(readOnlyQueryPlanSha256,manifest.readOnlyQueryPlanSha256);
  for(const q of readOnlyQueryPlan){assert(q.sql.startsWith('select '));assert.equal(q.sha256,sha(q.sql));assert(q.maxRows<=256&&q.maxBytes<=524288);assert.doesNotMatch(q.sql,/;|\b(?:insert|update|delete|truncate|grant|revoke|set|begin|commit|rollback)\s+(?:into|table|role|local|transaction|all)\b/i);assert.doesNotMatch(q.sql,/\bfrom\s+(?:auth\.(?:users|sessions)|rakeezx\.[a-z_]+|n88_private\.[a-z_]+)/i);}
  assert(readOnlyQueryPlan.some(q=>q.sql.includes('pg_auth_members')&&q.sql.includes('rolbypassrls')));
  assert(readOnlyQueryPlan.some(q=>q.sql.includes('pg_policy')));assert(readOnlyQueryPlan.some(q=>q.sql.includes('pg_trigger')));assert(readOnlyQueryPlan.some(q=>q.sql.includes('has_table_privilege')));
  assert.equal(Object.isFrozen(readOnlyQueryPlan),true);
});
test('typed physical/database/role identity compares exact values independent of JSON field order',()=>{
  const identity={database_name:'fabricated',database_oid:'1234',current_role:'fabricated_reader',session_role:'fabricated_login',server_address:'192.0.2.1',server_port:5432,server_version_num:'170006',system_identifier:'1234567890123456789'};
  assert(sameTargetIdentity(identity,Object.fromEntries(Object.entries(identity).reverse())));
  for(const [key,value]of [['current_role','another'],['session_role','another'],['server_port','5432'],['database_oid',1234],['server_version_num','170007'],['system_identifier','1234567890123456790']])assert.equal(sameTargetIdentity(identity,{...identity,[key]:value}),false);
  assert.equal(sameTargetIdentity(identity,{...identity,extra:true}),false);assert.equal(sameTargetIdentity(identity,null),false);
});
const future=()=>{
  const approval={ref:'FABRICATED_READ_ONLY_APPROVAL',action:'read-only-v2-preflight',projectRef:manifest.historicalTargetHint.projectRef,expiresAt:Date.now()+60000};
  const binding={...manifest,target:{projectRef:approval.projectRef,databaseIdentity:{fabricated:true}},preflightAuthority:{ref:approval.ref}};
  return {approval,binding};
};
test('unchanged original finite boundary denies all nine proposed inventory queries locally; no SQL forwarded',async()=>{
  const calls=[];const client={query:async statement=>{calls.push(statement);assert.equal(statement,boundaryCatalogSql);return {rows:identities};}};
  await assertVerifiedBoundary(client);
  for(const q of readOnlyQueryPlan)await assert.rejects(privateQuery(client,q.sql,[]),{message:'n88_database_unavailable'});
  assert.deepEqual(calls,[boundaryCatalogSql]);assert.equal(sha(read('drafts/n88-student-portal/activation/private-error-boundary.mjs')),'58ae1bb5f128cf31998ed8ccfa8e372e4980fdbfcc611f8aef61e9dc3098d49e');
});
test('future read-only protocol records first exact denial, disposes owned port, and never retries/falls back',async()=>{
  const f=future(),calls=[];let disposed=0;
  const r=await runReadOnlyPreflight({...f,verifyReadAuthority:async()=>true,acquireApprovedReadOnly:async()=>({client:{query:async statement=>{calls.push(statement);assert.equal(statement,boundaryCatalogSql);return {rows:identities};}},dispose:async()=>{disposed++;}})});
  assert.equal(r.state,'DENIED');assert.equal(r.disposed,true);assert.equal(disposed,1);assert.deepEqual(calls,[boundaryCatalogSql]);assert.equal(r.denial.queryId,'target-identity');assert.equal(r.denial.error,'n88_database_unavailable');assert.equal(r.installationAuthorized,false);assert.deepEqual(r.inventory,[]);
  let reopened=0;const again=await runReadOnlyPreflight({...f,verifyReadAuthority:async()=>true,acquireApprovedReadOnly:async()=>{reopened++;}});assert.equal(again.error,'n88_external_read_authority_unavailable');assert.equal(reopened,0);
});
test('expired/foreign/mismatched/unverified read authority never acquires connection',async()=>{
  for(const change of [f=>{f.approval.expiresAt=0;},f=>{f.approval.projectRef='other';},f=>{f.binding.target.projectRef='other';f.approval.projectRef='other';},f=>{f.approval.action='install-storage-only';},f=>{f.binding.installerSha256='0'.repeat(64);}]){
    const f=future();change(f);let acquired=0;const r=await runReadOnlyPreflight({...f,verifyReadAuthority:async()=>true,acquireApprovedReadOnly:async()=>{acquired++;}});assert.equal(r.state,'DENIED');assert.equal(acquired,0);
  }
  const f=future();let acquired=0;await runReadOnlyPreflight({...f,verifyReadAuthority:async()=>false,acquireApprovedReadOnly:async()=>{acquired++;}});assert.equal(acquired,0);
});
test('boundary identity rejection cannot open alternate role/SQL path; sanitized exact error and cleanup',async()=>{
  const f=future(),calls=[];let disposed=0;const r=await runReadOnlyPreflight({...f,verifyReadAuthority:async()=>true,acquireApprovedReadOnly:async()=>({client:{query:async statement=>{calls.push(statement);return {rows:[]};}},dispose:async()=>{disposed++;}})});
  assert.equal(r.state,'DENIED');assert.equal(r.queried,true);assert.equal(r.error,'n88_external_preflight_unavailable');assert.equal(disposed,1);assert.deepEqual(calls,[boundaryCatalogSql]);
});
test('plan specifies exact absent permissions, nonexposure, collision and bounded disable limits',()=>{
  const plan=read(dir+'PLAN.md');for(const word of ['xlrubcwjqktzzunrvuns','NOT_RUN','NOT_ADMITTED','four','two','14','rollback','UNKNOWN','Sync/Delete','NO_CHANGE','nonexposure'])assert(plan.includes(word),word);
  assert.equal(manifest.changeSet.sourceAndAuthRowsChanged,0);assert.deepEqual(manifest.changeSet.canonicalWriterChanges,[]);assert.equal(manifest.changeSet.serviceActivation,false);
});
