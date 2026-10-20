import assert from 'node:assert/strict';import {writeFile} from 'node:fs/promises';import {createClassPortalClient} from '../../src/lib/student-portal-class-client.js';
const binding={ownerId:'synthetic-owner',sessionId:'synthetic-session',leaseId:'lease',teachingId:'teaching',classId:'class',termId:'term',contextRevision:'1'},context={...binding,enabled:true,validUntil:Date.now()+120000};
const fields={name:false,class:false,grades:false,required:false,completed:false,scheduled:false},guidance={subitemId:'task',sourceStamp:'a'.repeat(64),revision:0,executionInstructions:'تعليمات مصطنعة',deliveryInstructions:'',confirmClear:false};
const seen=new Map();let held,retired=false;
const client=createClassPortalClient({getContext:()=>retired?null:context,request:async(path,init)=>{
 const body=JSON.parse(init.body),action=path.split('/').at(-1);let data;
 if(action==='list')data={classId:'class',rosterRevision:'b'.repeat(64),policyRevision:0,students:[],visibility:fields};
 else if(action==='guidance-list')data={tasks:[]};
 else {const history=seen.get(action)||[];history.push(body);seen.set(action,history);if(history.length===1)throw Error('synthetic unknown network result');if(action==='visibility')data={updated:true,policyRevision:1,fields:body.fields};else data={saved:true,subitemId:'task',revision:1,sourceStamp:guidance.sourceStamp};}
 return {ok:true,json:async()=>({ack:true,binding:body.binding,requestId:body.requestId??null,data})};
}});
await client.listClass('teaching');await assert.rejects(client.saveVisibility('teaching',{policyRevision:0,fields}),e=>e.code==='uncertain');await client.listClass('teaching');await client.saveVisibility('teaching',{policyRevision:0,fields});
await assert.rejects(client.saveGuidance('teaching',guidance),e=>e.code==='uncertain');await client.listGuidance('teaching');await client.saveGuidance('teaching',guidance);
for(const action of ['visibility','guidance-save']){const rows=seen.get(action);assert.equal(rows.length,2);assert.deepEqual(rows[0],rows[1]);}
retired=true;await assert.rejects(client.saveGuidance('teaching',guidance),e=>e.code==='unavailable');
await writeFile('tests/n88-actual-1430-20261020/save-identity.json',JSON.stringify({status:'PASS',scope:'Actual client methods, inert request seam, no network/send/mutation',checks:['Explicit reviewed visibility/guidance retry reuses exact original request ID/body after unknown outcome.','No background retry; valid bound ACK required; owner retirement denies further save.'],automaticRetries:0,persistentState:false},null,2)+'\n');
