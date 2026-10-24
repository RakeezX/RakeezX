/** AI: affected transport contracts; no browser or hosted data. */
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {createClassPortalClient} from '../../src/lib/student-portal-class-client.js';
let context={enabled:true,ownerId:'synthetic',sessionId:'s',leaseId:'l',teachingId:'t',classId:'c',termId:'term',contextRevision:'1',validUntil:Date.now()+60000};
const lists=[],mutations=[];let requestCount=0;
const fields=Object.fromEntries(['name','class','grades','required','completed','scheduled'].map(k=>[k,false]));
const client=createClassPortalClient({getContext:()=>context,onListDiagnostic:v=>lists.push(v),onMutationDiagnostic:v=>mutations.push(v),request:async(u,i)=>{
 requestCount++;const b=JSON.parse(i.body);if(!u.endsWith('/list'))return {ok:false,status:503};
 return {ok:true,status:200,headers:new Headers({'x-n88-service-region':'ap-south-1'}),json:async()=>({ack:true,binding:b.binding,requestId:null,data:{classId:'c',rosterRevision:'a'.repeat(64),policyRevision:0,students:[],visibility:fields,credentialRevision:'b'.repeat(64),reconciliation:(b.reconcile||[]).map(()=>({state:'unknown',created:0,skipped:0,failed:0}))}})};
}});
const r=await client.listClass('t');
await assert.rejects(client.issueMissingClassCodes('t',{requestId:'synthetic-intent',expectedRosterRevision:r.rosterRevision}));
const before=mutations.at(-1);
assert.deepEqual(Object.keys(before).sort(),['action','code','elapsedMs','httpStatus','outcome','schema']);
assert.equal(before.schema,'n88-mutation-response-v1');assert.equal(before.code,'rejected');
assert(Number.isInteger(before.elapsedMs)&&before.elapsedMs>=0&&before.elapsedMs<=30000);assert.equal(before.httpStatus,503);assert.equal(before.action,'issue-missing');assert.equal(before.outcome,'unconfirmed');
const reviewed=await client.listClass('t');assert.equal(reviewed.reconciliation[0].state,'unknown');assert.equal(lists.at(-1).outcome,'success');assert.deepEqual(mutations.at(-1),before);assert.equal(requestCount,3);assert(!JSON.stringify(before).includes('synthetic'));
context={...context,ownerId:'other'};
// Preflight intentionally throws synchronously; the initial harness incorrectly
// used assert.rejects on this call. Preserve that harness correction explicitly.
assert.throws(()=>client.issueMissingClassCodes('t',{requestId:'another',expectedRosterRevision:r.rosterRevision}));assert.equal(requestCount,3);
// Retire after invocation but before the dispatch microtask; no old-owner command leaves the client.
let fenceContext={...context,ownerId:'fence-owner'},dispatches=0;
const fenced=createClassPortalClient({getContext:()=>fenceContext,request:async(u,i)=>{
 dispatches++;const b=JSON.parse(i.body);assert(u.endsWith('/list'));
 return {ok:true,status:200,json:async()=>({ack:true,binding:b.binding,requestId:null,data:{classId:'c',rosterRevision:'a'.repeat(64),policyRevision:0,students:[],visibility:fields,credentialRevision:'b'.repeat(64),reconciliation:[]}})};
}});
const snapshot=await fenced.listClass('t');
const retired=fenced.issueMissingClassCodes('t',{requestId:'retired-intent',expectedRosterRevision:snapshot.rosterRevision});
fenceContext={...fenceContext,ownerId:'replacement-owner'};
await assert.rejects(retired,{code:'stale_context'});assert.equal(dispatches,1);
await writeFile('tests/n88-five-ui-delivery-20261024/client.json',JSON.stringify({aiAuthored:true,status:'PASS',providerOperations:0,renderedUI:false,checks:['finite mutation failure distinct from successful list','unknown receipt remains unknown without replay','owner switch rejects old snapshot; invocation-to-microtask retirement prevents dispatch','no IDs/credentials/error bodies in finite metadata'],initialHarnessFailure:'assert.rejects could not catch the deliberately synchronous review_required preflight; corrected to assert.throws',requestCount},null,2)+'\n');
console.log('PASS: scoped client diagnostics and uncertainty/owner fences');
