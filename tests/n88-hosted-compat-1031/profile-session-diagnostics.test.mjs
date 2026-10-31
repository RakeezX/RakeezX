/** AI: synthetic diagnostics only. No custody, connection or SQL is invoked. */
import test from 'node:test';import assert from 'node:assert/strict';
import {classifyProfileError,dispatchProfileStep,runId} from '../../drafts/n88-student-portal/activation/v2-hosted-compat-1031/profile-original-custodian.mjs';
test('Node network/TLS codes stay distinct from PostgreSQL SQLSTATE; private diagnostics never exported',()=>{
 const privateText='SYNTHETIC_PRIVATE_DSN_PASSWORD';
 for(const [code,category]of [['EPIPE','network'],['ENOTFOUND','network'],['ENETUNREACH','network'],['ERR_TLS_CERT_ALTNAME_INVALID','tls'],['28P01','postgres'],['42501','postgres'],['XX000','postgres']]){const r=classifyProfileError({code,message:privateText,stack:privateText,query:privateText});assert.deepEqual(r,{category,code});assert(!JSON.stringify(r).includes(privateText));}
 assert.deepEqual(classifyProfileError({code:'UNKNOWN_PRIVATE_CODE',message:privateText}),{category:'unknown',code:'UNCLASSIFIED'});
 assert.deepEqual(classifyProfileError({errors:[{code:'ENETUNREACH',message:privateText},{code:'ECONNREFUSED',message:privateText}]}),{category:'network',code:'AGGREGATE',codes:['ECONNREFUSED','ENETUNREACH']});
});
test('connect failure and BEGIN failure preserve different phases and dispatched/succeeded counts',async()=>{
 const fresh=()=>({connections:0,sqlAttempts:0,queries:0});
 const a=fresh();await assert.rejects(dispatchProfileStep(a,'restricted_connect',async()=>{throw Object.assign(Error('private'),{code:'EPIPE'});}));assert.equal(a.stage,'restricted_connect');assert.equal(a.connections,1);assert.equal(a.sqlAttempts,0);assert.equal(a.successes.connect,0);
 const b=fresh();await dispatchProfileStep(b,'restricted_connect',async()=>{});await assert.rejects(dispatchProfileStep(b,'transaction_begin',async()=>{throw Object.assign(Error('private'),{code:'42501'});}));assert.equal(b.stage,'transaction_begin');assert.equal(b.sqlAttempts,1);assert.equal(b.attempts.transaction,1);assert.equal(b.queries,0);assert.equal(b.successes.connect,1);assert.equal(b.successes.transaction,0);
});
test('each metadata dispatch is counted before failure; successful metadata only increments queries',async()=>{
 const r={connections:0,sqlAttempts:0,queries:0};await dispatchProfileStep(r,'identity_metadata',async()=>({rows:[]}));await assert.rejects(dispatchProfileStep(r,'settings_metadata',async()=>{throw Error('unknown');}));assert.equal(r.stage,'settings_metadata');assert.equal(r.sqlAttempts,2);assert.equal(r.attempts.metadata,2);assert.equal(r.queries,1);assert.equal(r.successes.metadata,1);assert.equal(runId,'269dc6b9-d3e1-4f2c-a5d3-14e741b2a92a');
});
