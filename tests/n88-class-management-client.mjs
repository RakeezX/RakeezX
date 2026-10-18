// AI: bounded transport negative tests; no real account, key, service or browser profile.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createClassPortalClient } from '../src/lib/student-portal-class-client.js';
import { context, createService, fields } from './fixtures/n88-class-management/server.mjs';
function setup(transform = a => a, timeoutMs=100) {
  let binding=context(), calls=[];const service=createService();
  const client=createClassPortalClient({getContext:()=>binding,timeoutMs,request:async(path,init)=>{
    calls.push({path,init});assert.equal(new URL(path,'http://127.0.0.1').search,'');
    assert.equal(init.cache,'no-store');assert.equal(init.redirect,'error');assert.equal(init.credentials,'same-origin');assert.equal(init.headers['X-N88-CSRF'],'1');
    const result=await service.respond(path.split('/').pop(),JSON.parse(init.body));
    return {ok:result.ok,json:async()=>transform(result.body,path)};
  }});
  return {client,calls,service,switch(update){binding={...binding,...update};}};
}
const batch=(r,requestId=crypto.randomUUID())=>({requestId,expectedRosterRevision:r.rosterRevision});
test('ACK batch only missing; partial failure is truthful, retry never rotates; fields CAS and selective versions',async()=>{
  const s=setup(),c=s.client;let r=await c.listClass('teaching-a');
  const first=await c.issueMissingClassCodes('teaching-a',batch(r));
  assert.deepEqual([first.created.length,first.skipped.length,first.failed.length,first.uncertain],[19,10,1,false]);
  assert.ok(first.created.every(e=>/^1[0-9]{11}$/.test(e.credential)));
  assert.throws(()=>c.issueMissingClassCodes('teaching-a',batch(r)),/review_required/);
  r=await c.listClass('teaching-a');const second=await c.issueMissingClassCodes('teaching-a',batch(r));
  assert.deepEqual([second.created.length,second.skipped.length],[1,29]);
  r=await c.listClass('teaching-a');assert.equal(r.students[0].credentialVersion,1);
  const selected=r.students[0],b=()=>({studentId:selected.studentId,enrollmentId:selected.enrollmentId,revision:selected.revision,credentialVersion:selected.credentialVersion,requestId:crypto.randomUUID()});
  assert.throws(()=>c.rotate({...b(),enrollmentId:'foreign'}),/review_required/);
  assert.throws(()=>c.rotate({...b(),revision:99}),/review_required/);
  const rotated=await c.rotate(b());assert.equal(rotated.rotated,true);
  r=await c.listClass('teaching-a');await c.revoke({...b(),credentialVersion:r.students[0].credentialVersion});
  r=await c.listClass('teaching-a');assert.equal(r.students[0].hasActiveCode,false);
  assert.throws(()=>c.saveVisibility('teaching-a',{policyRevision:0,fields:fields()}),/review_required/);
  assert.throws(()=>c.saveVisibility('teaching-a',{policyRevision:r.policyRevision,fields:{...fields(),unknown:true}}),/review_required/);
  const saved=await c.saveVisibility('teaching-a',{policyRevision:r.policyRevision,fields:{...fields(),grades:true}});assert.equal(saved.fields.grades,true);
  const writes=s.calls.filter(c=>!c.path.endsWith('/list'));
  assert.ok(writes.every(c=>Object.hasOwn(JSON.parse(c.init.body),'expectedRosterRevision')));
  assert.ok(s.calls.every(c=>!c.init.body.includes('credential"')));
});
test('no implicit readiness, wrong class/owner/session/lease/term, expired context and changed roster review',async()=>{
  await assert.rejects(createClassPortalClient().listClass('teaching-a'),/unavailable/);
  const s=setup();await assert.rejects(s.client.listClass('foreign'),/unavailable/);assert.equal(s.calls.length,0);
  for(const key of ['ownerId','sessionId','leaseId','termId','contextRevision','classId']){
    const v=setup();const r=await v.client.listClass('teaching-a');v.switch({[key]:'changed'});
    assert.throws(()=>v.client.issueMissingClassCodes('teaching-a',batch(r)),/review_required/);
  }
  s.switch({validUntil:0});await assert.rejects(s.client.listClass('teaching-a'),/unavailable/);
  const v=setup();const r=await v.client.listClass('teaching-a');assert.throws(()=>v.client.issueMissingClassCodes('teaching-a',{...batch(r),expectedRosterRevision:r.rosterRevision+1}),/review_required/);
});
test('strict response validation denies foreign ACK, unacknowledged success, secrets in roster, bad format, duplicate and existing-code replacement',async()=>{
  const mutations=[a=>({...a,ack:false}),a=>({...a,binding:{...a.binding,sessionId:'foreign'}}),a=>({...a,requestId:'wrong'}),a=>({...a,data:{...a.data,secret:'forbidden'}})];
  for(const change of mutations){const s=setup(change);await assert.rejects(s.client.listClass('teaching-a'),/invalid_ack/);}
  const changes=[a=>{a.data.created[0].credential='0000';},a=>{a.data.created[0].credential=100000000001;},a=>{a.data.created[0].studentId='student-0';},a=>{a.data.created.push(a.data.created[0]);},a=>{a.data.created[0].enrollmentId='foreign';},a=>{a.data.created[0].credentialVersion=0;},a=>{a.data.requestId='foreign';},a=>{a.data.failed=[];}];
  for(const change of changes){const s=setup((a,path)=>{if(!path.endsWith('/list'))change(a);return a;});const r=await s.client.listClass('teaching-a');await assert.rejects(s.client.issueMissingClassCodes('teaching-a',batch(r)),/invalid_ack/);}
});
test('timeout includes delayed JSON, request key cannot replay, concurrent writes denied; original transport error redacted',async()=>{
  const s=setup(async(a,path)=>path.endsWith('/list')?a:new Promise(()=>{}),20);
  const r=await s.client.listClass('teaching-a'),body=batch(r);
  const work=s.client.issueMissingClassCodes('teaching-a',body);
  assert.throws(()=>s.client.issueMissingClassCodes('teaching-a',batch(r)),/busy/);
  await assert.rejects(work,/uncertain/);
  const fresh=await s.client.listClass('teaching-a');assert.throws(()=>s.client.issueMissingClassCodes('teaching-a',{...body,expectedRosterRevision:fresh.rosterRevision}),/review_required/);
  let bad=false;const v=setup((a,path)=>{if(!path.endsWith('/list')){bad=true;throw Error('DO_NOT_EXPOSE_TRANSPORT_BODY');}return a;});
  const list=await v.client.listClass('teaching-a');await assert.rejects(v.client.issueMissingClassCodes('teaching-a',batch(list)),e=>e.message==='uncertain');assert.ok(bad);
});
test('owner switch during response JSON suppresses credential result; no optimistic visibility success',async()=>{
  let release;const s=setup((a,path)=>path.endsWith('/list')?a:new Promise(ok=>{release=()=>ok(a);}));
  const r=await s.client.listClass('teaching-a'),work=s.client.issueMissingClassCodes('teaching-a',batch(r));
  while(!release)await new Promise(ok=>setImmediate(ok));s.switch({ownerId:'other'});release();await assert.rejects(work,/stale_context/);
  const v=setup((a,path)=>{if(path.endsWith('/visibility'))a.data.fields.name=true;return a;});const list=await v.client.listClass('teaching-a');
  await assert.rejects(v.client.saveVisibility('teaching-a',{policyRevision:list.policyRevision,fields:fields()}),/invalid_ack/);
});
test('actual server roster CAS conflict and rejected HTTP cannot produce success or parse private error body',async()=>{
  const s=setup(),r=await s.client.listClass('teaching-a');
  const {enabled,validUntil,...binding}=context();
  await s.service.respond('issue-missing',{binding,teachingId:binding.teachingId,requestId:crypto.randomUUID(),expectedRosterRevision:r.rosterRevision});
  await assert.rejects(s.client.issueMissingClassCodes('teaching-a',batch(r)),/rejected/);
  let parsed=false;const client=createClassPortalClient({getContext:context,request:async()=>({ok:false,json:async()=>{parsed=true;throw Error('PRIVATE_ERROR_BODY');}})});
  await assert.rejects(client.listClass('teaching-a'),e=>e.message==='rejected');assert.equal(parsed,false);
});
