/** AI: focused durable receipt, storage-fault and retirement checks. No service operations. */
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createClassPortalClient} from '../../src/lib/student-portal-class-client.js';
import {reconcileIssuanceReceipts} from '../../drafts/n88-student-portal/receipt-reconciliation.mjs';
const fields=Object.fromEntries(['name','class','grades','required','completed','scheduled'].map(k=>[k,false]));
const R='a'.repeat(64),C='b'.repeat(64),NEXT='c'.repeat(64),ID='synthetic-command-0001';
const checks=[];
function fixture(){
 let context={enabled:true,ownerId:'owner',leaseId:'workspace',sessionId:'session',teachingId:'t',classId:'c',termId:'term',contextRevision:'1',validUntil:Date.now()+60000},scope='database:generation1';
 const saved=new Map(),calls=[],diagnostics=[];let mode='unknown',mutation='failure',delay=null,rosterRevision=R,credentialRevision=C,failRead=false,failWrite=false,dropWrite=false,legacy=false,students=[];
 const storage={getItem(k){if(failRead)throw Error('private read failure');return saved.get(k)??null;},setItem(k,v){if(failWrite)throw Error('private write failure');if(!dropWrite)saved.set(k,v);}};
 const request=async(u,init)=>{
  const body=JSON.parse(init.body),action=u.split('/').at(-1);calls.push({action,body});
  if(delay)await delay(action,body);
  if(action==='list'){
   const data={classId:body.binding.classId,rosterRevision,policyRevision:0,students,visibility:{...fields}};
   if(!legacy)Object.assign(data,{credentialRevision,reconciliation:body.reconcile.map(()=>({state:mode,created:mode==='committed'?1:0,skipped:0,failed:0}))});
   return {ok:true,status:200,json:async()=>({ack:true,binding:body.binding,requestId:null,data})};
  }
  if(action==='guidance-list')return {ok:true,json:async()=>({ack:true,binding:body.binding,requestId:null,data:{tasks:[]}})};
  if(mutation==='failure')return {ok:false,status:503};
  const data=action==='guidance-save'?{saved:true,subitemId:body.guidance.subitemId,revision:body.guidance.revision+1,sourceStamp:body.guidance.sourceStamp}:action==='visibility'?{updated:true,policyRevision:1,fields:body.fields}: {requestId:body.requestId,created:[],skipped:[],failed:[],uncertain:mutation==='partial'};
  return {ok:true,status:200,json:async()=>({ack:true,binding:body.binding,requestId:mutation==='wrong-id'?'unrelated-command-0001':body.requestId,data})};
 };
 const make=()=>createClassPortalClient({getContext:()=>context,getReceiptScope:()=>scope,storage,request,timeoutMs:100,onMutationDiagnostic:v=>{if(v)diagnostics.push(v);}});
 const issue=async(client=make(),requestId=ID)=>{const r=await client.listClass('t');return client.issueMissingClassCodes('t',{requestId,expectedRosterRevision:r.rosterRevision});};
 return {make,issue,saved,calls,diagnostics,storage,get context(){return context;},set context(v){context=v;},set scope(v){scope=v;},set mode(v){mode=v;},set mutation(v){mutation=v;},set delay(v){delay=v;},set roster(v){rosterRevision=v;credentialRevision=NEXT;},set failRead(v){failRead=v;},set failWrite(v){failWrite=v;},set dropWrite(v){dropWrite=v;},set legacy(v){legacy=v;},set students(v){students=v;}};
}
async function check(name,fn){await fn();checks.push({name,status:'PASS'});}
const rejected=fn=>assert.rejects(async()=>fn());
const record=f=>JSON.parse([...f.saved.values()][0]);
const replace=(f,value)=>f.saved.set([...f.saved.keys()][0],JSON.stringify(value));
const commandCalls=f=>f.calls.filter(x=>!['list','guidance-list'].includes(x.action));
const guidance={subitemId:'private-target',sourceStamp:R,revision:0,executionInstructions:'PRIVATE GUIDANCE BODY',deliveryInstructions:'PRIVATE DELIVERY',confirmClear:false};
try{
 await check('pending reserve exists before request; fresh client reconciles original identity without replay',async()=>{
  const f=fixture();let release,started;const sent=new Promise(ok=>started=ok);
  f.delay=async action=>{if(action==='issue-missing'){started();await new Promise(ok=>release=ok);}};
  const pending=f.issue();await sent;
  assert.equal(record(f).rows[0].requestId,ID);
  const r=await f.make().listClass('t');assert.equal(r.reconciliation[0].state,'unknown');
  assert.deepEqual(f.calls.at(-1).body.reconcile,[{requestId:ID,expectedRosterRevision:R,expectedCredentialRevision:C}]);
  await rejected(()=>f.issue(f.make(),'replacement-command-0001'));assert.equal(commandCalls(f).length,1);release();await rejected(()=>pending);
 });
 await check('reload uses original versions; current roster/credential disagreement never resolves UNKNOWN',async()=>{
  const f=fixture();await rejected(()=>f.issue());f.roster=NEXT;
  const client=f.make(),r=await client.listClass('t');assert.equal(r.rosterRevision,NEXT);assert.equal(r.reconciliation[0].state,'unknown');assert.equal(f.calls.at(-1).body.reconcile[0].expectedRosterRevision,R);
  await rejected(()=>client.issueMissingClassCodes('t',{requestId:'replacement-command-0002',expectedRosterRevision:NEXT}));assert.equal(commandCalls(f).length,1);
 });
 await check('only exact authoritative committed receipt clears hint; current data is retained separately',async()=>{
  const f=fixture();await rejected(()=>f.issue());f.mode='committed';f.roster=NEXT;
  const r=await f.make().listClass('t');assert.equal(r.reconciliation[0].state,'committed');assert.equal(r.rosterRevision,NEXT);assert.deepEqual(r.students,[]);assert.deepEqual(r.visibility,fields);assert.deepEqual(record(f).rows,[]);
 });
 await check('existing typed server read proves only same owner/ID/teaching/original versions; absence never proves not-applied',async()=>{
  const scope={current:true,ownerId:'owner',classId:'c',teachingId:'t'},member={ownerId:'owner',classId:'c',studentId:'student',enrollmentId:'enrollment'},request={requestId:ID,expectedRosterRevision:R,expectedCredentialRevision:C};
  const binding=createHash('sha256').update(JSON.stringify(['batch','t',R,null,null,null,null,C])).digest('hex');
  const receipt={ownerId:'owner',requestId:ID,binding,results:[{studentId:'student',enrollmentId:'enrollment',status:'created'}]};
  const read=(receipts,input=request,s=scope,members=[member])=>reconcileIssuanceReceipts({classReceipts:receipts},s,members,[input])[0];
  assert.equal(read([receipt]).state,'committed');
  for(const r of [[],[{...receipt,ownerId:'foreign'}],[{...receipt,requestId:'different-command-0001'}],[{...receipt,binding:NEXT}],[{...receipt,results:[{studentId:'foreign',enrollmentId:'enrollment',status:'created'}]}],[receipt,receipt]])assert.equal(read(r).state,'unknown');
  assert.equal(read([receipt],{...request,expectedRosterRevision:NEXT}).state,'unknown');assert.equal(read([receipt],request,{...scope,teachingId:'other'}).state,'unknown');
 });
 await check('absence/not-applied unsupported state and legacy200 do not clear uncertainty',async()=>{
  const f=fixture();await rejected(()=>f.issue());f.mode='not-applied';await rejected(()=>f.make().listClass('t'));assert.equal(record(f).rows.length,1);
  f.legacy=true;await rejected(()=>f.make().listClass('t'));assert.equal(record(f).rows.length,1);
  f.legacy=false;f.mode='unknown';await f.make().listClass('t');assert.equal(record(f).rows.length,1);
 });
 await check('blocked reads, writes and failed reserve readback dispatch no mutation',async()=>{
  for(const fault of ['failRead','failWrite','dropWrite']){const f=fixture();f[fault]=true;await rejected(()=>f.issue());assert.equal(commandCalls(f).length,0);assert.equal(f.diagnostics.length,0);}
 });
 await check('cleanup storage failure retains UNKNOWN and blocks replacement without losing current fields',async()=>{
  const f=fixture();await rejected(()=>f.issue());f.mode='committed';f.failWrite=true;
  const r=await f.make().listClass('t');assert.equal(r.reconciliation[0].state,'committed');assert.equal(r.reconciliation.at(-1).state,'unknown');assert.deepEqual(r.visibility,fields);await rejected(()=>f.issue());assert.equal(commandCalls(f).length,1);
 });
 await check('malformed/foreign/oversized/versioned/future/duplicate/over-limit hints fail closed without leaking IDs into reads',async()=>{
  const variants=[r=>({...r,scope:'foreign-owner'}),r=>({...r,version:2}),r=>({...r,rows:[{...r.rows[0],credential:'123456'}]}),r=>({...r,rows:[{...r.rows[0],createdAt:Date.now()+86400000}]}),r=>({...r,rows:[{...r.rows[0],version:2}]}),r=>({...r,rows:Array(9).fill(r.rows[0])}),r=>({...r,rows:[r.rows[0],r.rows[0]]})];
  for(const mutate of variants){const f=fixture();await rejected(()=>f.issue());replace(f,mutate(record(f)));const r=await f.make().listClass('t');assert.deepEqual(f.calls.at(-1).body.reconcile,[]);assert.equal(r.reconciliation.at(-1).state,'unknown');await rejected(()=>f.issue());assert.equal(commandCalls(f).length,1);}
  for(const value of ['{','x'.repeat(8193)]){const f=fixture();await rejected(()=>f.issue());f.saved.set([...f.saved.keys()][0],value);const r=await f.make().listClass('t');assert.equal(r.reconciliation.at(-1).state,'unknown');await rejected(()=>f.issue());}
 });
 await check('expired hints retire lookup but never disappear or authorize replacement',async()=>{
  const f=fixture();await rejected(()=>f.issue());const r=record(f);r.rows[0].createdAt-=31*86400000;replace(f,r);
  const result=await f.make().listClass('t');assert.deepEqual(f.calls.at(-1).body.reconcile,[]);assert.equal(result.reconciliation.at(-1).state,'unknown');await rejected(()=>f.issue());assert.equal(record(f).rows.length,1);
 });
 await check('at most eight valid hints are sent through existing typed read and settled without mutation',async()=>{
  const f=fixture();await rejected(()=>f.issue());const r=record(f);r.rows=Array.from({length:8},(_,i)=>({...r.rows[0],requestId:'synthetic-command-000'+i}));replace(f,r);await f.make().listClass('t');assert.equal(f.calls.at(-1).body.reconcile.length,8);f.mode='committed';await f.make().listClass('t');assert.deepEqual(record(f).rows,[]);assert.equal(commandCalls(f).length,1);
 });
 await check('owner, workspace, class and term scopes never adopt foreign hints; returning owner recovers original',async()=>{
  for(const key of ['ownerId','leaseId','classId','termId','teachingId']){const f=fixture();await rejected(()=>f.issue());const old=f.context;f.context={...old,[key]:'foreign'};await f.make().listClass(f.context.teachingId);assert.deepEqual(f.calls.at(-1).body.reconcile,[]);f.context=old;await f.make().listClass('t');assert.equal(f.calls.at(-1).body.reconcile[0].requestId,ID);}
  const f=fixture();await rejected(()=>f.issue());f.scope='different-database:generation2';await f.make().listClass('t');assert.deepEqual(f.calls.at(-1).body.reconcile,[]);
 });
 await check('retired owner/session replies cannot settle prior hints; verified same-owner new session may read only',async()=>{
  for(const key of ['ownerId','sessionId','contextRevision']){const f=fixture();f.mutation='ack';let release,started;const sent=new Promise(ok=>started=ok);f.delay=async a=>{if(a==='issue-missing'){started();await new Promise(ok=>release=ok);}};
   const pending=f.issue();await sent;f.context={...f.context,[key]:'renewed'};release();await rejected(()=>pending);assert.equal(record(f).rows.length,1);
   if(key==='sessionId'){await f.make().listClass('t');assert.equal(f.calls.at(-1).body.binding.sessionId,'renewed');assert.equal(f.calls.at(-1).body.reconcile[0].requestId,ID);}
  }
 });
 await check('invocation-to-dispatch retirement and workspace-scope changes send no stale command',async()=>{
  for(const change of [f=>f.context={...f.context,ownerId:'retired'},f=>f.scope='retired-db']){const f=fixture(),c=f.make(),r=await c.listClass('t');const p=c.issueMissingClassCodes('t',{requestId:ID,expectedRosterRevision:r.rosterRevision});change(f);await rejected(()=>p);assert.equal(commandCalls(f).length,0);assert.equal(record(f).rows.length,1);}
 });
 await check('stale list cannot clear hint or expose old roster after scope retirement',async()=>{
  const f=fixture();await rejected(()=>f.issue());f.mode='committed';let release,started;const sent=new Promise(ok=>started=ok);f.delay=async a=>{if(a==='list'){started();await new Promise(ok=>release=ok);}};
  const read=f.make().listClass('t');await sent;f.context={...f.context,ownerId:'retired'};release();await rejected(()=>read);assert.equal(record(f).rows.length,1);
 });
 await check('wrong-ID ACK and partial issuance ACK never resolve hint',async()=>{
  for(const mode of ['wrong-id','partial']){const f=fixture();f.mutation=mode;if(mode==='wrong-id')await rejected(()=>f.issue());else assert.equal((await f.issue()).uncertain,true);assert.equal(record(f).rows.length,1);await rejected(()=>f.issue(f.make(),'replacement-command-0003'));assert.equal(commandCalls(f).length,1);}
 });
 await check('guidance UNKNOWN survives remount; same/different intent and list read never replay or replace',async()=>{
  const f=fixture();await rejected(()=>f.make().saveGuidance('t',guidance));
  assert.equal(record(f).rows[0].sourceStamp,R);assert.equal(record(f).rows[0].expectedRevision,0);
  for(const body of [guidance,{...guidance,executionInstructions:'different'}])await rejected(()=>f.make().saveGuidance('t',body));
  await f.make().listGuidance('t');const r=await f.make().listClass('t');assert.equal(r.reconciliation.at(-1).state,'unknown');assert.equal(commandCalls(f).length,1);
  const raw=JSON.stringify([...f.saved]);for(const privateValue of ['PRIVATE','private-target','executionInstructions','deliveryInstructions','synthetic-token','session'])assert(!raw.includes(privateValue));
 });
 await check('exact acknowledged guidance clears reservation without storing bodies; subsequent independent save allowed',async()=>{
  const f=fixture();f.mutation='ack';await f.make().saveGuidance('t',guidance);assert.deepEqual(record(f).rows,[]);await f.make().saveGuidance('t',{...guidance,revision:1});assert.equal(commandCalls(f).length,2);
 });
 await check('visibility unknown persists without field payload; fresh list retains actual loaded settings and prevents replacement',async()=>{
  const f=fixture(),c=f.make();await c.listClass('t');await rejected(()=>c.saveVisibility('t',{policyRevision:0,fields:{...fields,name:true}}));
  const r=await f.make().listClass('t');assert.deepEqual(r.visibility,fields);assert.equal(r.reconciliation.at(-1).state,'unknown');await rejected(()=>f.make().saveGuidance('t',guidance));assert.equal(commandCalls(f).length,1);assert(!JSON.stringify([...f.saved]).includes('fields'));
 });
 await check('selective rotate/revoke UNKNOWN persists without pupil/enrollment or credential payload',async()=>{
  for(const action of ['rotate','revoke']){const f=fixture();f.students=[{studentId:'PRIVATE_STUDENT',enrollmentId:'PRIVATE_ENROLLMENT',label:'PRIVATE_NAME',revision:1,credentialVersion:1,hasActiveCode:true,recoveryStatus:'recoverable',credential:'123456'}];const c=f.make();await c.listClass('t');await rejected(()=>c[action]({studentId:'PRIVATE_STUDENT',enrollmentId:'PRIVATE_ENROLLMENT',revision:1,credentialVersion:1,requestId:ID}));const r=await f.make().listClass('t');assert.equal(r.reconciliation.at(-1).state,'unknown');assert.equal(record(f).rows[0].action,action);for(const value of ['PRIVATE','123456'])assert(!JSON.stringify([...f.saved]).includes(value));await rejected(()=>f.issue(f.make(),'replacement-command-0004'));assert.equal(commandCalls(f).length,1);}
 });
 await check('normal exact acknowledged issuance and visibility settle their reservations',async()=>{
  const f=fixture();f.mutation='ack';await f.issue();assert.deepEqual(record(f).rows,[]);const c=f.make();await c.listClass('t');await c.saveVisibility('t',{policyRevision:0,fields:{...fields,name:true}});assert.deepEqual(record(f).rows,[]);assert.equal(commandCalls(f).length,2);
 });
 await check('finite diagnostics contain no persisted hint, owner, payload, request ID or secret',async()=>{
  const f=fixture();await rejected(()=>f.issue());const text=JSON.stringify(f.diagnostics);for(const value of [ID,'workspace','owner','private','binding','reconcile'])assert(!text.includes(value));assert.equal(f.diagnostics[0].outcome,'unconfirmed');
 });
 await check('timeout retains reservation; later response cannot resolve or replay it',async()=>{
  const f=fixture();f.mutation='ack';let release;f.delay=a=>a==='issue-missing'?new Promise(ok=>release=ok):undefined;await rejected(()=>f.issue());release();await new Promise(ok=>setTimeout(ok,0));assert.equal(record(f).rows.length,1);await rejected(()=>f.issue());assert.equal(commandCalls(f).length,1);
 });
}catch(e){checks.push({name:'failure',status:'FAIL',message:e.message,stack:e.stack});process.exitCode=1;console.error(e.stack);}
await writeFile('tests/n88-teacher-issuance-ux-20261028/client-result.json',JSON.stringify({aiAuthored:true,status:process.exitCode?'FAIL':'PASS',providerOperations:0,checks},null,2)+'\n');console.log(JSON.stringify(checks));
