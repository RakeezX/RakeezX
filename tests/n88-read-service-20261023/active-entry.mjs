/** AI: affected active import/dispatch binding only; fabricated wire, no provider/benchmark. */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as boundary from '../../drafts/n88-student-portal/activation/private-error-boundary.mjs';
import {readCanonical} from '../../drafts/n88-student-portal/integrated-service.mjs';
import {createPostgresRepository} from '../../drafts/n88-student-portal/postgres-repository.mjs';
const base='drafts/n88-student-portal/activation/read-service-20261023/';
const json=async p=>JSON.parse(await readFile(p,'utf8'));
assert.equal(typeof createPostgresRepository,'function');
const old=await json(base+'error-boundary-identities.json'),next=await json(base+'typed-identities.json'),typed=await json(base+'typed-read-operations.json');
const owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
for(const [catalog,mode] of [[old,'serial'],[next,'batch']]){
 const commands=[];const client={query:async(sql,args)=>{if(sql===boundary.boundaryCatalogSql)return {rows:catalog};commands.push({sql,args});return {rows:[]};}};
 await boundary.assertVerifiedBoundary(client);assert.equal(boundary.verifiedBoundaryMode(client),mode);
 const result=await readCanonical({canonicalReadMode:()=>boundary.verifiedBoundaryMode(client),query:(sql,args)=>boundary.privateQuery(client,sql,args)},owner,true);
 assert.deepEqual(result,{terms:[],teachings:[]});
 assert(commands.every(c=>c.sql.startsWith('select * from n88_private.boundary_')));
 assert(commands.every(c=>Buffer.from(c.args[0],'base64').toString()===owner));
 assert.equal(commands.some(c=>c.sql.includes(typed[1].name)),mode==='batch');
 await assert.rejects(()=>boundary.privateQuery(client,'select arbitrary_sql()'));
 if(mode==='serial')await assert.rejects(()=>boundary.privateQuery(client,typed[1].sql,[owner,2001,2097152]));
 catalog===next&&await assert.rejects(()=>readCanonical({canonicalReadMode:()=> 'unknown'},owner,true));
}
const drift=structuredClone(next);drift[0].owner='foreign';const invalid={query:async()=>({rows:drift})};
await assert.rejects(()=>boundary.assertVerifiedBoundary(invalid));assert.throws(()=>boundary.verifiedBoundaryMode(invalid));
const integration=await json('tests/n88-read-service-20261023/active-integration.json');
for(const [p,h] of Object.entries(integration.sourceHashes)){const bytes=(await readFile(p,'utf8')).replaceAll('\r\n','\n');assert.equal(createHash('sha256').update(bytes).digest('hex'),h);}
const report={aiAuthored:true,status:'PASS',fabricatedOnly:true,providerOperations:0,checks:['active import graph loads','active guarded serial and batch list dispatch preserve finite owner-bound wire','unknown SQL/mode/catalog denied','active source and native hashes match integrated qualified artifacts'],reused:'transition.json and staged-result.json retain actual PG17/service/session/grade/privacy/cancel/COMMIT proofs unchanged',hostedSpeedAcceptance:'NOT_RUN'};
await writeFile('tests/n88-read-service-20261023/active-entry.json',JSON.stringify(report,null,2)+'\n');
console.log('PASS: actual active import/guard/dispatch binding; no provider or benchmark.');
