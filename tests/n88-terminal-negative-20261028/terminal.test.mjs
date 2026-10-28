/** AI-authored bounded source tests; no live service or rendered-UI assertion. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fixture,binding,ID,deferred,A} from './fixture.mjs';
import {cancelOriginalIntentTransaction as cancel} from '../../drafts/n88-student-portal/receipt-terminal-review.inactive.mjs';
import {createClassPortalClient} from '../../src/lib/student-portal-class-client.js';
const closed=r=>{assert.equal(r.status,200);assert.deepEqual(r.body.data,{resolutionVersion:1,state:'closed',created:0,skipped:0,failed:0});};
const unknown=r=>{assert.equal(r.status,200);assert.deepEqual(r.body.data,{resolutionVersion:1,state:'unknown',created:0,skipped:0,failed:0});};
const journal=()=>{const values=new Map();return {values,getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};};

for(const n of [0,28,50]) {
 test(`negative terminal actual integrated service read-only/status and idempotent close (${n})`,async()=>{
  const f=fixture(n),input=await f.input(),before=f.snapshot();
  unknown(await f.terminal(input,'status'));assert.deepEqual(f.snapshot(),before);
  closed(await f.terminal(input));closed(await f.terminal(input));closed(await f.terminal(input,'status'));
  const after=f.snapshot();assert.equal(after.classReceipts.length,1);after.classReceipts=[];assert.deepEqual(after,before);
  assert.equal((await f.request('issue-missing',input)).status,409);
  assert.equal(f.snapshot().numericCredentials.length,0);
  assert.deepEqual(Object.keys(f.snapshot().classReceipts[0]).sort(),['binding','ownerId','requestId','results']);
 });
 test(`actual integrated old issuer/terminal both serialized lock orders (${n})`,async()=>{
  for(const first of ['close','issue']) {
   const f=fixture(n),input=await f.input(),hold=f.hold();
   const a=first==='close'?f.terminal(input):f.request('issue-missing',input);
   await hold.entered.promise;
   const b=first==='close'?f.request('issue-missing',input):f.terminal(input);
   hold.release.resolve();const [x,y]=await Promise.all([a,b]);
   if(first==='close'){closed(x);assert.equal(y.status,409);assert.equal(f.snapshot().numericCredentials.length,0);}
   else {assert.equal(x.status,200);assert.equal(x.body.data.created.length,n);unknown(y);assert.equal(f.snapshot().numericCredentials.length,n);}
   assert.equal(f.snapshot().classReceipts.length,1);
   const count=f.snapshot().numericCredentials.length;await f.request('issue-missing',input);assert.equal(f.snapshot().numericCredentials.length,count);
  }
 });
 test(`actual current class client synthetic transport original UNKNOWN -> close (${n})`,async()=>{
  const f=fixture(n),storage=journal(),context={...binding,enabled:true,validUntil:Date.now()+60000};let dropIssue=true;
  const client=createClassPortalClient({getContext:()=>context,storage,request:(url,init)=>{
   if(url.endsWith('/issue-missing')&&dropIssue){dropIssue=false;return {ok:false,status:503};}
   return f.clientTransport(url,init);
  }});
  const listed=await client.listClass(binding.teachingId);assert.equal(listed.students.length,n);
  await assert.rejects(async()=>client.issueMissingClassCodes(binding.teachingId,{requestId:ID,expectedRosterRevision:listed.rosterRevision}));
  assert.equal(f.snapshot().classReceipts.length,0);
  await client.listClass(binding.teachingId);assert.equal(client.resolutionState(binding.teachingId).eligible,true);
  const result=await client.closeUnknown(binding.teachingId);assert.equal(result.state,'closed');
  assert.equal(f.snapshot().numericCredentials.length,0);assert.equal(f.snapshot().classReceipts.length,1);
  assert.ok([...storage.values.values()].some(v=>JSON.parse(v).rows?.length===0));
 });
}

test('server authenticates signed current owner/session, never browser-local workspace proof',async()=>{
 for(const change of ['signature','foreign','banned','session','signed-other-session','expired-token','owner','inactive','class','term','teaching','ingress','csrf','origin','cross-site']) {
  const f=fixture(),input=await f.input();let body={},headers={};
  if(change==='signature')headers.authorization='Bearer '+f.provider.token().slice(0,-6)+'abcdef';
  if(change==='foreign')f.provider.foreign=true;
  if(change==='banned')f.provider.banned=true;
  if(change==='session')f.state.current=false;
  if(change==='signed-other-session')headers.authorization='Bearer '+f.provider.token({session_id:'22222222-2222-4222-8222-222222222222'});
  if(change==='expired-token')headers.authorization='Bearer '+f.provider.token({exp:Math.floor(Date.now()/1000)-1});
  if(change==='owner')body.binding={...binding,ownerId:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'};
  if(change==='inactive')f.state.active=false;
  if(change==='class')f.state.classId='another-class';
  if(change==='term')f.state.term='another-term';
  if(change==='teaching')f.state.teaching='another-teaching';
  if(change==='ingress')f.state.ingress=false;
  if(change==='csrf')headers['x-n88-csrf']='0';
  if(change==='origin')headers.origin='https://foreign.invalid';
  if(change==='cross-site')headers['sec-fetch-site']='cross-site';
  const result=await f.request('revoke',{...input,resolutionVersion:1,resolution:'close',...body},{headers});
  assert.notEqual(result.status,200,change);assert.equal(f.snapshot().classReceipts.length,0,change);
 }
 const f=fixture(),input=await f.input();
 // The server does not pretend these browser-writable correlations are verified.
 closed(await f.terminal(input,'close',{binding:{...binding,leaseId:'untrusted-new-local-value',contextRevision:'untrusted-local'}}));
 const receipt=JSON.stringify(f.snapshot().classReceipts[0]);assert.equal(receipt.includes('untrusted'),false);
 closed(await f.terminal(input,'status',{binding:{...binding,sessionId:binding.sessionId,leaseId:'another-local'}}));
 assert.ok(f.provider.calls.includes('/auth/v1/user'));
});

test('stale local response cannot settle the current client hint; no hidden retry',async()=>{
 const f=fixture(),storage=journal();let context={...binding,enabled:true,validUntil:Date.now()+60000},hold;
 const client=createClassPortalClient({getContext:()=>context,storage,request:async(url,init)=>{
  if(url.endsWith('/issue-missing'))return {ok:false,status:503};
  const response=await f.clientTransport(url,init);
  if(url.endsWith('/revoke')){hold.entered.resolve();await hold.release.promise;}
  return response;
 }});
 const listed=await client.listClass('teaching');await assert.rejects(async()=>client.issueMissingClassCodes('teaching',{requestId:ID,expectedRosterRevision:listed.rosterRevision}));
 await client.listClass('teaching');const before=[...storage.values.entries()].filter(([k])=>!k.endsWith(':terminal-v1'));
 hold={entered:deferred(),release:deferred()};const promise=client.closeUnknown('teaching');await hold.entered.promise;
 context={...context,leaseId:'new-local-workspace'};hold.release.resolve();await assert.rejects(promise,e=>e.code==='stale_context');
 assert.deepEqual([...storage.values.entries()].filter(([k])=>!k.endsWith(':terminal-v1')),before);
 assert.equal(f.snapshot().classReceipts.length,1);assert.equal(f.snapshot().numericCredentials.length,0);
});

test('current client preserves UNKNOWN on legacy/read/rollback/lost ACK and allows only one explicit status recovery',async()=>{
 for(const type of ['legacy','failRead','rollback','lost','malformed-ack']) {
  const f=fixture(28),storage=journal(),context={...binding,enabled:true,validUntil:Date.now()+60000},calls=[];
  const client=createClassPortalClient({getContext:()=>context,storage,request:async(url,init)=>{
   const body=JSON.parse(init.body);calls.push({action:url.split('/').at(-1),resolution:body.resolution});
   if(url.endsWith('/issue-missing'))return {ok:false,status:503};
   const response=await f.clientTransport(url,init);
   if(type==='malformed-ack'&&body.resolution==='close')return {...response,json:async()=>({...await response.json(),binding:{...binding,leaseId:'wrong-response-fence'}})};
   return response;
  }});
  const listed=await client.listClass('teaching');await assert.rejects(async()=>client.issueMissingClassCodes('teaching',{requestId:ID,expectedRosterRevision:listed.rosterRevision}));
  await client.listClass('teaching');
  const before=[...storage.values.entries()].filter(([k])=>!k.endsWith(':terminal-v1'));
  if(type==='legacy')await f.mutate(db=>db.classReceipts.push({ownerId:A,requestId:ID,binding:'a'.repeat(64),results:[]}));
  if(['failRead','rollback','lost'].includes(type))f.state[type]=true;
  if(type==='legacy')assert.equal((await client.closeUnknown('teaching')).state,'unknown');
  else await assert.rejects(async()=>client.closeUnknown('teaching'));
  assert.deepEqual([...storage.values.entries()].filter(([k])=>!k.endsWith(':terminal-v1')),before,type);
  await assert.rejects(async()=>client.closeUnknown('teaching'));
  assert.equal(calls.filter(c=>c.resolution==='close').length,1);
  f.state.failRead=false;
  const status=await client.recoverClosure('teaching');assert.equal(status.state,['lost','malformed-ack'].includes(type)?'closed':'unknown');
  await assert.rejects(async()=>client.recoverClosure('teaching'));
  assert.equal(calls.filter(c=>c.resolution==='status').length,1);assert.equal(f.snapshot().numericCredentials.length,0);
 }
});

test('source revision, membership ambiguity, drift and receipt mismatch fail closed',async()=>{
 for(const change of ['roster','credentials','teaching-revision','term-revision','membership','duplicate-membership','duplicate-enrollment','legacy','partial','malformed','duplicate-receipt','different-request-revision','inactive-context','absent-context']) {
  const f=fixture(),input=await f.input();
  if(change==='roster')input.expectedRosterRevision='c'.repeat(64);
  if(change==='credentials')input.expectedCredentialRevision='c'.repeat(64);
  if(change==='teaching-revision')f.state.teachingRevision='2';
  if(change==='term-revision')f.state.termRevision='2';
  if(change==='membership')f.state.source[0].revision='2';
  if(change==='duplicate-membership')f.state.source.push({...f.state.source[0],enrollment_id:'another-enrollment'});
  if(change==='duplicate-enrollment')f.state.source[1].enrollment_id=f.state.source[0].enrollment_id;
  if(change==='inactive-context')await f.mutate(db=>{db.contexts[0].active=false;});
  if(change==='absent-context')await f.mutate(db=>{db.contexts=[];});
  if(['legacy','partial','malformed','duplicate-receipt'].includes(change))await f.mutate(db=>{
   const row={ownerId:A,requestId:ID,binding:'a'.repeat(64),results:change==='malformed'?null:change==='partial'?[{studentId:'student-0',status:'created'}]:[]};
   db.classReceipts.push(row);if(change==='duplicate-receipt')db.classReceipts.push(structuredClone(row));
  });
  if(change==='different-request-revision'){closed(await f.terminal(input));input.expectedCredentialRevision='d'.repeat(64);}
  const before=f.snapshot(),result=await f.terminal(input);
  if(result.status===200)unknown(result);else assert.ok([401,503].includes(result.status));
  assert.deepEqual(f.snapshot(),before,change);
 }
});

test('read failure, rollback, lost ACK and actual Auth commit guard never return provisional closed',async()=>{
 for(const type of ['failRead','rollback','lost','guardFailure']) {
  const f=fixture(),input=await f.input(),before=f.snapshot();f.state[type]=true;
  const result=await f.terminal(input);assert.equal(result.status,503,type);assert.equal(result.body.data,undefined);
  assert.equal(f.snapshot().classReceipts.length,type==='lost'?1:0,type);
  f.state.failRead=false;f.state.guardFailure=false;f.state.current=true;
  const recovery=await f.terminal(input,'status');if(type==='lost')closed(recovery);else unknown(recovery);
  if(type!=='lost')assert.deepEqual(f.snapshot(),before);
 }
});

test('actual partial original issuance stays UNKNOWN and untouched; normal selective actions stay protected',async()=>{
 const f=fixture(3),input=await f.input();f.state.partial=true;
 const issued=await f.request('issue-missing',input);assert.equal(issued.status,200);assert.equal(issued.body.data.created.length,1);assert.equal(issued.body.data.failed.length,2);
 const before=f.snapshot();unknown(await f.terminal(input));assert.deepEqual(f.snapshot(),before);
 const g=fixture(1,{enabled:false}),i=await g.input();assert.equal((await g.request('issue-missing',i)).body.data.created.length,1);
 const listed=await g.request('list'),s=listed.body.data.students[0];
 const selective={studentId:s.studentId,enrollmentId:s.enrollmentId,revision:s.revision,credentialVersion:s.credentialVersion,requestId:'synthetic-selective-revoke-0001'};
 assert.equal((await g.request('revoke',{...selective,credentialVersion:0})).status,409);
 assert.equal((await g.request('rotate',{...selective,requestId:'synthetic-selective-rotate-0001'})).status,200);
 assert.equal((await g.request('revoke',selective)).status,409);
 assert.equal((await g.request('revoke',{...selective,credentialVersion:2})).body.data.revoked,true);
 assert.equal(g.snapshot().numericCredentials.filter(c=>c.revokedAt===null).length,0);
});

test('default OFF server switch and subtype shape never fall through to selective credential mutations',async()=>{
 for(const enabled of ['omitted',false,'true',null]) {
  const f=fixture(1,{enabled}),input=await f.input(),before=f.snapshot();
  assert.equal((await f.request('list',{reconciliationVersion:1,terminalResolutionVersion:1,terminalResolutionEnabled:true})).body.data.terminalResolution,undefined);
  assert.equal((await f.terminal(input)).status,401);assert.deepEqual(f.snapshot(),before);
 }
 const f=fixture(),input=await f.input(),before=f.snapshot();
 for(const extra of [{resolutionVersion:2},{resolution:'issue'},{studentId:'student-0'},{requestId:'short'}]) {
  const r=await f.terminal(input,'close',extra);if(r.status===200)unknown(r);else assert.equal(r.status,401);
 }
 assert.equal((await f.request('issue-missing',{...input,resolution:'close',resolutionVersion:1})).status,401);
 assert.deepEqual(f.snapshot(),before);
});

test('pure negative helper cannot attest browser fields, grant access, evict capacity or rewrite receipts',()=>{
 const a={...binding,current:true,members:[],rosterRevision:'a'.repeat(64),credentialRevision:'b'.repeat(64)};
 const r={requestId:ID,expectedRosterRevision:a.rosterRevision,expectedCredentialRevision:a.credentialRevision};
 const db={classReceipts:[]};assert.equal(cancel(db,a,r,'issue').state,'unknown');assert.equal(db.classReceipts.length,0);
 for(const field of ['ownerId','sessionId','teachingId','termId','classId'])assert.equal(cancel(db,{...a,[field]:''},r,'close').state,'unknown');
 db.classReceipts=Array.from({length:10000},(_,i)=>({ownerId:A,requestId:'other-'+i,binding:'a'.repeat(64),results:[]}));
 assert.equal(cancel(db,a,r,'close').state,'unknown');assert.equal(db.classReceipts.length,10000);
});

test('scoped source has no provider activation, SQL/schema edits or positive issuer changes',async()=>{
 const source=await readFile(new URL('../../drafts/n88-student-portal/integrated-service.mjs',import.meta.url),'utf8');
 assert.match(source,/const negativeTerminalEnabled=options\.terminalResolutionEnabled===true/);
 const helper=await readFile(new URL('../../drafts/n88-student-portal/receipt-terminal-review.inactive.mjs',import.meta.url),'utf8');
 const negative=helper.slice(helper.indexOf('export function cancelOriginalIntentTransaction'));
 assert.equal(/issueMember|rotateMember|revokeMember|fetch\(|console\.|process\.env/.test(negative),false);
});
