/** AI: pin observed pre-repair defects; do not rerun against corrected source. */
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {createClassPortalClient} from '../../src/lib/student-portal-class-client.js';
const c={enabled:true,ownerId:'owner',leaseId:'workspace',sessionId:'session',teachingId:'t',classId:'c',termId:'term',contextRevision:'1',validUntil:Date.now()+60000};
const fields=Object.fromEntries(['name','class','grades','required','completed','scheduled'].map(k=>[k,false]));
let calls=[],release;
const request=async(u,i)=>{const b=JSON.parse(i.body);calls.push({u,b});if(u.endsWith('/list'))return {ok:true,json:async()=>({ack:true,binding:b.binding,requestId:null,data:{classId:'c',rosterRevision:'a'.repeat(64),credentialRevision:'b'.repeat(64),policyRevision:0,students:[],visibility:fields,reconciliation:b.reconcile.map(()=>({state:'unknown',created:0,skipped:0,failed:0}))}})};if(u.endsWith('/issue-missing'))await new Promise(ok=>release=ok);return {ok:false,status:503};};
const make=()=>createClassPortalClient({getContext:()=>c,request,storage:{getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}}});
const first=make(),r=await first.listClass('t');const pending=first.issueMissingClassCodes('t',{requestId:'uncertain-command-0001',expectedRosterRevision:r.rosterRevision});
await new Promise(ok=>setTimeout(ok,0));await make().listClass('t');assert.deepEqual(calls.at(-1).b.reconcile,[]);release();await assert.rejects(pending);
const guidance={subitemId:'task',sourceStamp:'a'.repeat(64),revision:0,executionInstructions:'private body',deliveryInstructions:'',confirmClear:false};
await assert.rejects(first.saveGuidance('t',guidance));await assert.rejects(first.saveGuidance('t',guidance));
const g=calls.filter(x=>x.u.endsWith('/guidance-save'));assert.equal(g.length,2);assert.equal(g[0].b.requestId,g[1].b.requestId);
await writeFile('tests/n88-uncertain-recovery-20261024/baseline.json',JSON.stringify({aiAuthored:true,status:'REPRODUCED',checks:['pending request not reserved durably before send; a fresh client reads reconcile[]','blocked storage does not prevent an untrackable mutation','guidance unknown retries replay same request ID'],sourceBase:'aa761cc6583385d0a5215c49324f68d20b0f8ba0',providerOperations:0},null,2)+'\n');
console.log('REPRODUCED pending/storage/replay defects');
