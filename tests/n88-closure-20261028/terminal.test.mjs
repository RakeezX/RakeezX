/** AI-authored synthetic transaction tests. No provider, HTTP, browser or real IDs.
 * Reuses the application's memory transaction helper, actual class issuer,
 * numeric engine, receipt reconciler and client. This is not a rendered UI proof.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createMemoryRepository} from '../../drafts/n88-student-portal/memory-repository.mjs';
import {createClassCredentialOperations} from '../../drafts/n88-student-portal/class-credentials.mjs';
import {createNumericCredentialOperations} from '../../drafts/n88-student-portal/numeric-credentials.mjs';
import {credentialStateRevision,reconcileIssuanceReceipts} from '../../drafts/n88-student-portal/receipt-reconciliation.mjs';
import {createClassPortalClient} from '../../src/lib/student-portal-class-client.js';
import {reviewTerminalTransaction as terminal,reviewIssueAdmission as admit,recordReviewedCommit as record}
  from '../../drafts/n88-student-portal/receipt-terminal-review.inactive.mjs';

const NOW=1800000000000,R='a'.repeat(64),C='b'.repeat(64),ID='synthetic-original-0001';
const binding={ownerId:'synthetic-owner',sessionId:'synthetic-session',leaseId:'synthetic-lease',
  teachingId:'synthetic-teaching',classId:'synthetic-class',termId:'synthetic-term',contextRevision:'1'};
function data(n=28,extra={}) {
  const members=Array.from({length:n},(_,i)=>({ownerId:binding.ownerId,classId:binding.classId,
    studentId:`synthetic-student-${i}`,enrollmentId:`synthetic-enrollment-${i}`,revision:1,canonicalStamp:'synthetic-stamp',
    status:'active',endDate:null,studentActive:true,classActive:true,label:'Fabricated'}));
  return {db:{classReceipts:[],memberships:members,numericCredentials:[],numericSessions:[],numericRates:[],
    contexts:[{ownerId:binding.ownerId,active:true}]},
    v:{...binding,current:true,validUntil:NOW+1000,rosterRevision:R,credentialRevision:C,members,...extra},
    r:{binding:{...binding},requestId:ID,expectedRosterRevision:R,expectedCredentialRevision:C}};
}
const results=v=>v.members.map((m,i)=>({studentId:m.studentId,enrollmentId:m.enrollmentId,
  credentialVersion:i%3===0?1:0,status:['created','skipped','failed'][i%3]}));
const state=x=>x.state;
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};

// All provisional results stay inside this synthetic COMMIT boundary. Guards run
// immediately before state publication. A lost ACK preserves state but says UNKNOWN.
function harness(seed) {
  const memory=createMemoryRepository(seed);let fail=false,lost=false;
  return {snapshot:memory.snapshot,fail:()=>{fail=true;},lose:()=>{lost=true;},
    async transaction(action) {
      try {
        const value=await memory.transaction(async db=>{
          const guards=[];
          const out=await action(db,{query:async()=>({rows:[],rowCount:1}),synchronizeOwner:async()=>{},beforeCommit:g=>guards.push(g)});
          for(const g of guards)await g();
          if(fail){fail=false;throw Error('synthetic rollback');}
          return out;
        });
        if(lost){lost=false;throw Error('synthetic lost ACK');}
        return value;
      }catch{return {resolutionVersion:1,state:'unknown',created:0,skipped:0,failed:0};}
    }};
}

test('n88_terminal_unknown_not_absent_and_does_not_authorize_reissue',()=>{
  for(const n of [0,28,50]) {
    const {db,v,r}=data(n),before=structuredClone(db);
    for(let i=0;i<3;i++)assert.equal(state(terminal(db,v,r,'status',NOW)),'unknown');
    assert.deepEqual(db,before);
    const scope={ownerId:v.ownerId,classId:v.classId,teachingId:v.teachingId,current:true};
    assert.equal(reconcileIssuanceReceipts(db,scope,v.members,[{requestId:ID,expectedRosterRevision:R,expectedCredentialRevision:C}])[0].state,'unknown');
    assert.equal(state(terminal(db,v,r,'close',NOW)),'closed');
    assert.equal(admit(db,v,r,NOW).mayIssue,false);
    assert.equal(state(terminal(db,v,r,'status',NOW)),'closed');
    assert.equal(state(terminal(db,v,r,'close',NOW)),'closed');
    assert.equal(db.classReceipts.length,1);assert.deepEqual(db.numericCredentials,[]);
  }
});

for(const n of [0,28,50])test(`n88_terminal_close_late_inflight_original_request_cannot_recommit (${n})`,async()=>{
  // Exercise ACTUAL existing issuer and numeric engine against a tombstone. The
  // original may have reached ingress already, but cannot bypass the shared lock.
  const {db,v,r}=data(n),repo=harness(db);
  const rollout={allowsOwner:()=>true,admitsTeacher:()=>true,admitsStudent:()=>true};
  const numeric=createNumericCredentialOperations({keys:new Map([['synthetic',Buffer.alloc(32,7)]]),
    activeKeyVersion:'synthetic',reservationKey:Buffer.alloc(32,8),now:()=>NOW,rollout});
  const ops=createClassCredentialOperations({repository:repo,...numeric,rollout,origin:'https://synthetic.invalid',
    verifyIngress:async()=>({clientKey:'synthetic'}),
    verifyTeacher:async()=>({ownerId:v.ownerId,sessionId:v.sessionId,current:true}),
    resolveClass:async()=>({...v,revision:'synthetic-revision'})}).forRequest({method:'POST',
      headers:{origin:'https://synthetic.invalid','x-n88-csrf':'1','content-type':'application/json'}});
  const listed=await createClassCredentialOperations({repository:repo,...numeric,rollout,origin:'https://synthetic.invalid',
    verifyIngress:async()=>({clientKey:'synthetic'}),verifyTeacher:async()=>({ownerId:v.ownerId,sessionId:v.sessionId,current:true}),
    resolveClass:async()=>({...v,revision:'synthetic-revision'})}).forRequest({method:'GET'}).listClass(v.teachingId);
  assert.equal(listed.status,200);
  v.rosterRevision=r.expectedRosterRevision=listed.body.rosterRevision;
  v.credentialRevision=r.expectedCredentialRevision=credentialStateRevision(db,v.members);
  const started=deferred(),release=deferred();
  const delayedOriginal=(async()=>{started.resolve();await release.promise;
    return ops.issueMissingClassCodes(v.teachingId,r);})();
  await started.promise;
  const held=deferred(),unlock=deferred();
  const closing=repo.transaction(async draft=>{held.resolve();await unlock.promise;return terminal(draft,v,r,'close',NOW);});
  await held.promise;release.resolve();unlock.resolve();
  assert.equal(state(await closing),'closed');
  assert.equal((await delayedOriginal).status,409);
  assert.equal((await ops.issueMissingClassCodes(v.teachingId,r)).status,409);
  assert.equal(repo.snapshot().numericCredentials.length,0);
  assert.equal(repo.snapshot().classReceipts.length,1);
  const closeReceipt=repo.snapshot().classReceipts[0];
  // The unchanged old reconciler must NOT call this closed receipt committed.
  assert.equal(reconcileIssuanceReceipts(repo.snapshot(),{...v,current:true},v.members,
    [{requestId:ID,expectedRosterRevision:r.expectedRosterRevision,expectedCredentialRevision:r.expectedCredentialRevision}])[0].state,'unknown');
  assert.deepEqual(Object.keys(closeReceipt).sort(),['binding','ownerId','requestId','results']);
});

test('reviewed original holds lock before close; committed is never closed or issued twice',async()=>{
  for(const n of [0,28,50]) {
    const {db,v,r}=data(n),repo=harness(db),entered=deferred(),release=deferred();let issueCalls=0;
    const issue=repo.transaction(async draft=>{
      assert.equal(admit(draft,v,r,NOW).mayIssue,true);entered.resolve();await release.promise;
      issueCalls++;return record(draft,v,r,results(v),NOW);
    });
    await entered.promise;
    const closing=repo.transaction(draft=>terminal(draft,v,r,'close',NOW));
    release.resolve();assert.equal(state(await issue),'committed');assert.equal(state(await closing),'committed');
    assert.equal(admit(repo.snapshot(),v,r,NOW).mayIssue,false);assert.equal(issueCalls,1);
    assert.equal(repo.snapshot().classReceipts.length,1);
    const ack=await repo.transaction(draft=>terminal(draft,{...v,credentialRevision:'c'.repeat(64)},r,'status',NOW));
    assert.equal(ack.created+ack.skipped+ack.failed,n);
  }
});

test('actual old original already inside issuance wins lock; closure preserves legacy UNKNOWN and real commit',async()=>{
  for(const n of [0,28,50]) {
    const {db,v,r}=data(n),repo=harness(db),entered=deferred(),release=deferred();
    const rollout={allowsOwner:()=>true,admitsTeacher:()=>true,admitsStudent:()=>true};
    const numeric=createNumericCredentialOperations({keys:new Map([['synthetic',Buffer.alloc(32,7)]]),
      activeKeyVersion:'synthetic',reservationKey:Buffer.alloc(32,8),now:()=>NOW,rollout});
    let memberCalls=0;
    const module=createClassCredentialOperations({repository:repo,...numeric,rollout,origin:'https://synthetic.invalid',
      issueMember:async(...args)=>{memberCalls++;if(memberCalls===1){entered.resolve();await release.promise;}return numeric.issueMember(...args);},
      verifyIngress:async()=>({clientKey:'synthetic'}),
      verifyTeacher:async()=>({ownerId:v.ownerId,sessionId:v.sessionId,current:true}),
      resolveClass:async()=>({...v,revision:'synthetic-revision'})});
    const list=await module.forRequest({method:'GET'}).listClass(v.teachingId);
    v.rosterRevision=r.expectedRosterRevision=list.body.rosterRevision;
    v.credentialRevision=r.expectedCredentialRevision=credentialStateRevision(db,v.members);
    const writes=module.forRequest({method:'POST',headers:{origin:'https://synthetic.invalid','x-n88-csrf':'1','content-type':'application/json'}});
    const original=writes.issueMissingClassCodes(v.teachingId,r);
    if(n)await entered.promise;
    else await original; // an empty batch still commits an immutable receipt
    const closing=repo.transaction(d=>terminal(d,v,r,'close',NOW));release.resolve();
    assert.equal((await original).body.counts.created,n);
    assert.equal(state(await closing),'unknown'); // cannot invent the missing original session binding
    assert.equal(repo.snapshot().numericCredentials.length,n);
    assert.equal(repo.snapshot().classReceipts.length,1);
    const retry=await writes.issueMissingClassCodes(v.teachingId,r);
    assert.equal(retry.body.replayed,true);assert.equal(memberCalls,n);
    assert.equal(repo.snapshot().numericCredentials.length,n);
  }
});

test('n88_terminal_receipt_scope_owner_class_request_versions_and_ack',()=>{
  const f=data();terminal(f.db,f.v,f.r,'close',NOW);
  for(const key of Object.keys(binding)) {
    const r=structuredClone(f.r);r.binding[key]+='-different';
    assert.equal(state(terminal(f.db,f.v,r,'close',NOW)),'unknown');
    assert.equal(admit(f.db,f.v,r,NOW).mayIssue,false);
    // Changing both client and current server scope still cannot read old proof.
    assert.equal(state(terminal(f.db,{...f.v,[key]:r.binding[key]},r,'status',NOW)),'unknown');
  }
  for(const key of ['expectedRosterRevision','expectedCredentialRevision']) {
    const r={...f.r,[key]:'c'.repeat(64)};
    assert.equal(state(terminal(f.db,f.v,r,'close',NOW)),'unknown');
  }
  for(const requestId of ['', 'short', 'x'.repeat(101), 'invalid request id', 42])
    assert.equal(state(terminal(f.db,f.v,{...f.r,requestId},'close',NOW)),'unknown');
  for(const change of [{current:false},{validUntil:NOW},{validUntil:NOW-1},{rosterRevision:'c'.repeat(64)},
    {credentialRevision:'c'.repeat(64)}]) {
    const fresh=data();assert.equal(state(terminal(fresh.db,{...fresh.v,...change},fresh.r,'close',NOW)),'unknown');
    assert.equal(fresh.db.classReceipts.length,0);
  }
  assert.equal(f.db.classReceipts.length,1);
});

test('legacy, corrupted, partial and duplicate receipts remain UNKNOWN and immutable',()=>{
  const variants=[row=>({...row,binding:R}),row=>({...row,results:[...row.results,row.results[0]]}),
    row=>({...row,results:row.results.slice(1)}),row=>({...row,results:null}),
    row=>({...row,results:row.results.map((r,i)=>i? r : {...r,status:'uncertain'})}),
    row=>({...row,unexpected:true}),row=>({...row,results:row.results.map(r=>({...r,code:'forbidden'}))})];
  for(const corrupt of variants) {
    const {db,v,r}=data();record(db,v,r,results(v),NOW);db.classReceipts[0]=corrupt(db.classReceipts[0]);
    const before=structuredClone(db);
    assert.equal(state(terminal(db,v,r,'status',NOW)),'unknown');assert.equal(state(terminal(db,v,r,'close',NOW)),'unknown');
    assert.equal(admit(db,v,r,NOW).mayIssue,false);assert.deepEqual(db,before);
  }
  const {db,v,r}=data();record(db,v,r,results(v),NOW);db.classReceipts.push(structuredClone(db.classReceipts[0]));
  assert.equal(state(terminal(db,v,r,'close',NOW)),'unknown');assert.equal(admit(db,v,r,NOW).mayIssue,false);
  const fresh=data();assert.throws(()=>record(fresh.db,fresh.v,fresh.r,results(fresh.v).slice(1),NOW),/n88_terminal_review_denied/);
  assert.equal(fresh.db.classReceipts.length,0);
});

test('failed COMMIT, lost ACK, expiry/owner change at commit and status recovery',async()=>{
  for(const type of ['rollback','lost','expired','owner-changed']) {
    const {db,v,r}=data(),repo=harness(db);let current=true;
    if(type==='rollback')repo.fail();if(type==='lost')repo.lose();
    const ack=await repo.transaction((draft,ports)=>{
      ports.beforeCommit(()=>{if(!current)throw Error('synthetic auth/source changed');});
      const out=terminal(draft,v,r,'close',NOW);
      if(type==='expired'||type==='owner-changed')current=false;
      return out;
    });
    assert.equal(state(ack),'unknown');
    assert.equal(repo.snapshot().classReceipts.length,type==='lost'?1:0);
    const recovery=await repo.transaction(draft=>terminal(draft,v,r,'status',NOW));
    assert.equal(state(recovery),type==='lost'?'closed':'unknown');
    assert.equal(repo.snapshot().numericCredentials.length,0);
  }
});

test('concurrent distinct owners cannot settle or block each other; bounded receipts fail closed',async()=>{
  const a=data(),b=data();b.v.ownerId=b.r.binding.ownerId='synthetic-other-owner';
  b.v.members=b.v.members.map(m=>({...m,ownerId:b.v.ownerId}));
  const repo=harness(a.db);
  assert.deepEqual((await Promise.all([repo.transaction(d=>terminal(d,a.v,a.r,'close',NOW)),
    repo.transaction(d=>terminal(d,b.v,b.r,'close',NOW))])).map(state),['closed','closed']);
  assert.equal(repo.snapshot().classReceipts.length,2);
  const full=data();full.db.classReceipts=Array.from({length:10000},(_,i)=>({ownerId:'synthetic-capacity',requestId:`synthetic-capacity-${i}`,binding:R,results:[]}));
  assert.equal(state(terminal(full.db,full.v,full.r,'close',NOW)),'unknown');
  assert.equal(admit(full.db,full.v,full.r,NOW).mayIssue,false);assert.equal(full.db.classReceipts.length,10000);
  const many=data(2001);assert.equal(state(terminal(many.db,many.v,many.r,'close',NOW)),'unknown');
});

test('n88_terminal_inert_source_zero_auth_schema_real_service_and_no_ui_fake_success',async()=>{
  const integrated=await readFile(new URL('../../drafts/n88-student-portal/integrated-service.mjs',import.meta.url),'utf8');
  assert.ok(integrated.includes('data.credentialRevision=credentialStateRevision'));
  assert.ok(integrated.includes('data.reconciliation=reconcileIssuanceReceipts'));
  assert.equal(integrated.includes('terminalResolution'),false);
  const source=await readFile(new URL('../../drafts/n88-student-portal/receipt-terminal-review.inactive.mjs',import.meta.url),'utf8');
  assert.equal(/fetch\(|process\.env|console\.|node:(?:fs|http|net)|supabase|createServer/.test(source),false);
  // Actual client functions, mocked transport only. No rendered-UI PASS claimed.
  for(const n of [0,28,50]) {
    const saved=new Map(),calls=[],context={...binding,enabled:true,validUntil:Date.now()+60000};
    const storage={getItem:k=>saved.get(k)??null,setItem:(k,v)=>saved.set(k,v)};
    const client=createClassPortalClient({getContext:()=>context,storage,request:async(url,init)=>{
      const body=JSON.parse(init.body);calls.push(url);
      if(!url.endsWith('/list'))return {ok:false,status:503};
      const students=data(n).v.members.map(m=>({studentId:m.studentId,enrollmentId:m.enrollmentId,revision:1,
        label:'Fabricated',hasActiveCode:false,credentialVersion:0,recoveryStatus:'inactive',credential:null}));
      return {ok:true,status:200,json:async()=>({ack:true,binding:body.binding,requestId:null,data:{classId:binding.classId,
        rosterRevision:R,credentialRevision:C,policyRevision:0,visibility:Object.fromEntries(
          ['name','class','grades','required','completed','scheduled'].map(k=>[k,false])),students,
        reconciliation:body.reconcile.map(()=>({state:'unknown',created:0,skipped:0,failed:0}))}})};
    }});
    await client.listClass(binding.teachingId);
    await assert.rejects(async()=>client.issueMissingClassCodes(binding.teachingId,{requestId:ID,expectedRosterRevision:R}));
    const hints=[...saved.values()];
    const listing=await client.listClass(binding.teachingId);assert.equal(listing.students.length,n);
    assert.deepEqual([...saved.values()],hints);
    assert.equal(client.resolutionState(binding.teachingId).eligible,false);
    await assert.rejects(async()=>client.closeUnknown(binding.teachingId));
    await assert.rejects(async()=>client.issueMissingClassCodes(binding.teachingId,{requestId:'synthetic-replacement-0001',expectedRosterRevision:R}));
    assert.equal(calls.filter(x=>!x.endsWith('/list')).length,1);
  }
});
