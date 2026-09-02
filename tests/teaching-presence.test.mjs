import test, {beforeEach, afterEach} from 'node:test';
import assert from 'node:assert/strict';
import * as cloud from '../src/lib/cloud.js';

const ownerId='test owner+&';
const id='tch:sec:123e4567-e89b-12d3-a456-426614174000|sub:اختبار|tm:test';
const row=(teachingId=id)=>({id:teachingId,owner_id:ownerId,section_id:'sec:B',subject_id:'sub:test',term_id:'tm:test',deleted_at:null});
const reply=(body,status=200)=>new Response(JSON.stringify(body),{status});
beforeEach(()=>{cloud.setMockBackend(null);cloud.setMockAuth({id:ownerId},{access_token:'TEST-token'});});
afterEach(()=>cloud.setMockAuth(null,null));

test('active teaching presence uses the effective single REST path, exact encoded owner/ID and no deleted filter',async(t)=>{
  let request;
  t.mock.method(globalThis,'fetch',async(url,options)=>{request={url:String(url),options};return reply([row()]);});
  assert.deepEqual(await cloud.fetchTeachingPresence(id),{authoritative:true,status:'present',row:row()});
  const url=new URL(request.url);
  assert.equal(url.pathname,'/rest/v1/teachings');
  assert.equal(url.searchParams.get('owner_id'),`eq.${ownerId}`);
  assert.equal(url.searchParams.get('id'),`eq.${id}`);
  assert.equal(url.searchParams.get('limit'),'1');
  assert.equal(url.searchParams.get('select'),'id,owner_id,section_id,subject_id,term_id,deleted_at');
  assert.equal(url.searchParams.has('deleted_at'),false);
  assert.ok(request.url.includes(`id=eq.${encodeURIComponent(id)}`));
  assert.ok(request.url.includes(`owner_id=eq.${encodeURIComponent(ownerId)}`));
  assert.equal(request.options.headers['Accept-Profile'],'rakeezx');
  assert.equal(request.options.headers.Authorization,'Bearer TEST-token');
});

test('successful empty exact owner query proves absence; another owner is outside its scope',async(t)=>{
  const other={...row(),owner_id:'different-owner'};
  t.mock.method(globalThis,'fetch',async(value)=>{
    const query=new URL(value).searchParams;
    return reply([other].filter(r=>`eq.${r.owner_id}`===query.get('owner_id')&&`eq.${r.id}`===query.get('id')));
  });
  assert.deepEqual(await cloud.fetchTeachingPresence(id),{authoritative:true,status:'absent',row:null});
});

test('tombstone remains authoritative present with its original deleted_at',async(t)=>{
  const deleted={...row(),deleted_at:'2026-08-01T00:00:00Z'};
  t.mock.method(globalThis,'fetch',async()=>reply([deleted]));
  assert.deepEqual(await cloud.fetchTeachingPresence(id),{authoritative:true,status:'present',row:deleted});
});

test('network and HTTP failures are unknown, never absent',async(t)=>{
  const mock=t.mock.method(globalThis,'fetch',async()=>{throw new Error('TEST offline');});
  const network=await cloud.fetchTeachingPresence(id);
  assert.deepEqual(network,{authoritative:false,status:'unknown',row:null,error:'TEST offline'});
  mock.mock.mockImplementation(async()=>reply({message:'TEST denied'},403));
  assert.deepEqual(await cloud.fetchTeachingPresence(id),{authoritative:false,status:'unknown',row:null,error:'TEST denied'});
});

test('missing authenticated owner/token does not issue a request or claim absence',async(t)=>{
  const spy=t.mock.method(globalThis,'fetch',async()=>reply([]));
  for(const [user,session] of [[null,null],[{id:ownerId},null],[{id:ownerId},{}],[null,{access_token:'TEST'}]]) {
    cloud.setMockAuth(user,session);
    const result=await cloud.fetchTeachingPresence(id);
    assert.equal(result.authoritative,false);assert.equal(result.status,'unknown');assert.equal(result.row,null);
  }
  assert.equal(spy.mock.callCount(),0);
});

test('malformed, wrong-owner/ID and changed-auth responses cannot authorize a rekey',async(t)=>{
  const mock=t.mock.method(globalThis,'fetch',async()=>reply([]));
  for(const body of [null,{},[null],[row(),row()],[{...row(),owner_id:'other'}],[{...row(),id:'other'}],[{...row(),deleted_at:undefined}]]) {
    mock.mock.mockImplementation(async()=>reply(body));
    const result=await cloud.fetchTeachingPresence(id);
    assert.equal(result.status,'unknown');assert.equal(result.authoritative,false);assert.equal(result.row,null);
  }
  mock.mock.mockImplementation(async()=>{cloud.setMockAuth({id:'changed-owner'},{access_token:'changed'});return reply([]);});
  assert.equal((await cloud.fetchTeachingPresence(id)).authoritative,false);
});

test('A/B evidence distinguishes safe parent presence prerequisites from both-remote ambiguity without any writes',async(t)=>{
  let remote=[row('TB')];
  const spy=t.mock.method(globalThis,'fetch',async(value,options)=>{
    assert.equal(options.method??'GET','GET');
    const query=new URL(value).searchParams;
    return reply(remote.filter(r=>`eq.${r.id}`===query.get('id')));
  });
  const a=await cloud.fetchTeachingPresence('TA'),b=await cloud.fetchTeachingPresence('TB');
  assert.equal(a.status,'absent');assert.equal(a.authoritative,true);
  assert.equal(b.status,'present');assert.equal(b.authoritative,true);assert.equal(b.row.deleted_at,null);
  // These are necessary, NOT sufficient: dependent history collisions must also be ruled out.
  remote=[row('TA'),row('TB')];
  const ambiguous=await Promise.all(['TA','TB'].map(cloud.fetchTeachingPresence));
  assert.equal(ambiguous.every(result=>result.authoritative&&result.status==='present'),true);
  assert.equal(spy.mock.callCount(),4);
});
