/** AI: scoped original-boundary admission tests. In-process fabricated transport;
 * no hosted SQL, credentials, installer or native PG campaign. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {assertVerifiedBoundary,authorizeMetadataPreflight,closeMetadataPreflight,privateQuery,boundaryCatalogSql} from '../drafts/n88-student-portal/activation/private-error-boundary.mjs';
import {readOnlyQueryPlan,runAuthorizedReadPreflight} from '../drafts/n88-student-portal/activation/v2-external-plan-1028/preflight.mjs';
const read=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url),'utf8'));
const base='drafts/n88-student-portal/activation/';
const authority=read(base+'v2-external-plan-1028/read-authority.json'),contract=read(base+'error-boundary-contract.json');
const serial=read(base+'error-boundary-identities.json'),batch=read(base+'read-service-20261023/typed-identities.json'),typed=read(base+'read-service-20261023/typed-read-operations.json');
const context={authorityRef:authority.authorityRef,evidenceSha256:authority.evidenceSha256,providerEvidenceSha256:authority.providerEvidenceSha256,projectRef:authority.projectRef};
const keys=[['database_name','database_oid','current_role','session_role','server_address','server_port','server_version_num','system_identifier'],['rolname','rolsuper','rolbypassrls','rolinherit','rolcanlogin','rolcreatedb','rolcreaterole','memberships'],['nspname','relname','relkind','owner','relrowsecurity','relforcerowsecurity','acl'],['nspname','relname','columns','constraints','policies'],['nspname','proname','arguments','definition','definer','owner','proconfig','acl'],['nspname','relname','name','kind','definition','enabled'],['nspname','relname','rolname','table_select','column_select','insert','update','column_update','delete','truncate'],['nspname','owner','acl','anon_usage','authenticated_usage','configured_api_schemas'],['sha256']];
const identity={database_name:'fabricated',database_oid:'1234',current_role:'fabricated_reader',session_role:'fabricated_login',server_address:'192.0.2.1',server_port:5432,server_version_num:'170006',system_identifier:'1234567890123456789'};
const rows=i=>[i===0?identity:Object.fromEntries(keys[i].map(k=>[k,i===8?'a'.repeat(64):null]))];
const result=rows=>({command:'SELECT',rowCount:rows.length,rows});
async function client({definitions=serial,onQuery}={}){
  const calls=[];const c={query:async(sql,args=[])=>{calls.push({sql,args});if(sql===boundaryCatalogSql)return result(definitions);return onQuery?onQuery(sql,args):result(rows(readOnlyQueryPlan.findIndex(q=>q.sql===sql)));}};
  await assertVerifiedBoundary(c);return {c,calls};
}
function clock(t){t.mock.method(Date,'now',()=>Date.parse(authority.approvedAt)+60000);}
test('exact nine fixed read identities match original approved plan, metadata only',()=>{
  assert.equal(authority.operations.length,9);assert.deepEqual(authority.operations,readOnlyQueryPlan);assert.equal(authority.approved,true);assert.equal(authority.installationAuthorized,false);
  for(const q of authority.operations){assert(q.sql.startsWith('select '));assert.equal(createHash('sha256').update(q.sql).digest('hex'),q.sha256);}
});
test('named authority + verified original client admits all nine once in order',async t=>{
  clock(t);const {c,calls}=await client();authorizeMetadataPreflight(c,context);
  for(const q of readOnlyQueryPlan)assert.deepEqual((await privateQuery(c,q.sql,[])).rows,rows(readOnlyQueryPlan.indexOf(q)));
  assert.equal(calls.length,10);await assert.rejects(privateQuery(c,readOnlyQueryPlan[0].sql,[]),/n88_database_unavailable/);
  assert.throws(()=>authorizeMetadataPreflight(c,context),/n88_database_unavailable/);assert.equal(calls.length,10);
});
test('missing/foreign authority/provider and unverified clients cannot obtain admission',async t=>{
  clock(t);for(const change of [{},{...context,projectRef:'foreign'},{...context,evidenceSha256:'0'.repeat(64)},{...context,providerEvidenceSha256:'0'.repeat(64)}]){const {c,calls}=await client();assert.throws(()=>authorizeMetadataPreflight(c,change),/n88_database_unavailable/);await assert.rejects(privateQuery(c,readOnlyQueryPlan[0].sql),/n88_database_unavailable/);assert.equal(calls.length,1);}
  assert.throws(()=>authorizeMetadataPreflight({query:()=>{throw Error('not-called');}},context),/n88_database_unavailable/);
});
test('arbitrary SQL, changed literal, args, wrong order and legacy mutation/control deny in read phase',async t=>{
  clock(t);for(const [sql,args]of [['select 1',[]],[readOnlyQueryPlan[0].sql+' ',[]],[readOnlyQueryPlan[0].sql,['extra']],[readOnlyQueryPlan[0].sql,null],[readOnlyQueryPlan[1].sql,[]],['commit',[]],[contract.operations.find(o=>o.effect).sql,[]],['drop table rakeezx.students',[]]]){
    const {c,calls}=await client();authorizeMetadataPreflight(c,context);await assert.rejects(privateQuery(c,sql,args),/n88_database_unavailable/);assert.equal(calls.length,1);await assert.rejects(privateQuery(c,readOnlyQueryPlan[0].sql),/n88_database_unavailable/);
  }
});
test('server denial poisons the phase and preserves safe technical rejection, no retry',async t=>{
  clock(t);const {c,calls}=await client({onQuery:()=>{const e=Error('not-logged');e.code='42501';e.custodianError='ERROR: 42501: permission denied for function pg_control_system';throw e;}});authorizeMetadataPreflight(c,context);
  await assert.rejects(privateQuery(c,readOnlyQueryPlan[0].sql),e=>e.message==='n88_database_unavailable'&&e.metadataDenial.code==='42501'&&e.metadataDenial.queryId==='target-identity');
  await assert.rejects(privateQuery(c,readOnlyQueryPlan[0].sql),/n88_database_unavailable/);assert.equal(calls.length,2);
});
test('wrong output, extra fields, byte/row overflow and late/closed response fail closed',async t=>{
  clock(t);for(const output of [{command:'UPDATE',rowCount:1,rows:[identity]},result([{...identity,secret:'extra'}]),result([identity,identity]),result([{...identity,database_name:'x'.repeat(9000)}])]){
    const {c}=await client({onQuery:()=>output});authorizeMetadataPreflight(c,context);await assert.rejects(privateQuery(c,readOnlyQueryPlan[0].sql),/n88_database_unavailable/);
  }
  let release;const {c}=await client({onQuery:()=>new Promise(r=>release=()=>r(result([identity])))});authorizeMetadataPreflight(c,context);const p=privateQuery(c,readOnlyQueryPlan[0].sql);closeMetadataPreflight(c);release();await assert.rejects(p,/n88_database_unavailable/);
});
test('phase deadline rejects without transport or authority renewal',async t=>{
  clock(t);const {c,calls}=await client();authorizeMetadataPreflight(c,context,{durationMs:1});t.mock.method(Date,'now',()=>Date.parse(authority.approvedAt)+60002);
  await assert.rejects(privateQuery(c,readOnlyQueryPlan[0].sql),/n88_database_unavailable/);assert.equal(calls.length,1);
});
test('all original serial76 and typed78 statement identities retain original wrapper/parameter behavior',async()=>{
  for(const [definitions,operations]of [[serial,contract.operations],[batch,[...contract.operations,...typed].filter((o,i,a)=>a.findIndex(p=>p.sql===o.sql)===i)]]){
    let expected;const {c}=await client({definitions,onQuery:(sql,values)=>{assert.equal(sql,`select * from n88_private.${expected.name}(${values.map((_,i)=>'$'+(i+1)+'::text').join(',')})`);assert(values.every(v=>v===null));return expected.effect?{rows:[{affected:'0'}]}:result([]);}});
    assert.equal(operations.length,definitions===serial?76:78);
    for(const op of operations){expected=op;await privateQuery(c,op.sql,op.parameters.map(()=>null));}
    await assert.rejects(privateQuery(c,'select 1'),/n88_database_unavailable/);await assert.rejects(privateQuery(c,contract.operations[0].sql,[]),/n88_database_unavailable/);
  }
});
test('original controls and exact identity verification still reject old negatives',async()=>{
  await assert.rejects(assertVerifiedBoundary({query:async()=>result([])}),/n88_database_unavailable/);
  const calls=[];const {c}=await client({onQuery:(sql,args)=>{calls.push({sql,args});return result([]);}});
  await privateQuery(c,'begin isolation level read committed',[]);await privateQuery(c,'commit',[]);assert.equal(calls.length,2);
  await assert.rejects(privateQuery(c,'commit',['extra']),/n88_database_unavailable/);assert.equal(calls.length,2);
});
test('bound original runner uses original boundary, records actual discovery and closes owned phase',async t=>{
  clock(t);let disposed=0;const c={query:async(sql)=>sql===boundaryCatalogSql?result(serial):result(rows(readOnlyQueryPlan.findIndex(q=>q.sql===sql)))};
  const r=await runAuthorizedReadPreflight({acquireOriginalCustodian:async()=>({client:c,dispose:async()=>{disposed++;}})});
  assert.equal(r.state,'READ_ONLY_COMPLETE');assert.deepEqual(r.actualDatabaseIdentity,identity);assert.equal(r.inventory.length,9);assert.equal(r.disposed,true);assert.equal(disposed,1);assert.equal(r.installationAuthorized,false);
});
