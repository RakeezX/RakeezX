import test from 'node:test';
import assert from 'node:assert/strict';
import {planPortfolioCloudSync} from '../src/lib/portfolio-cloud-sync-contract.js';
import {executePreparedPortfolioSync} from '../src/lib/portfolio-cloud-transport.js';

const owner='11111111-1111-4111-8111-111111111111';
const year='teacher-year/1448';
const scope={type:'account',ownerId:owner,yearId:year,
  workspaceDatabase:'rakeezx-user-'+'a'.repeat(32)};
const picture=new Blob([Uint8Array.from([137,80,78,71,1,3,5,7])],{type:'image/png'});
const saved=()=>({
  payload:{photos:[['custom:09:one',[{id:'image-1',name:'example.png',bytes:picture.size}]]],
    customWitnesses:[{id:'custom:09:one',criterion:'09',sourceKind:'custom'}]},
  images:new Map([['image-1',{blob:picture}]]),
});
const makePlan=async()=>planPortfolioCloudSync({
  scope,authenticatedUserId:owner,confirmedServer:{
    status:'absent',verifiedRead:true,ownerId:owner,yearId:year,revision:0,
  },
  localBaseRemoteRevision:0,localRevision:1,savedDocument:saved(),
});
const receipt=plan=>({
  fromCanonicalReadback:true,ownerId:owner,yearId:year,status:'active',revision:1,
  payloadSha256:plan.payloadSha256,
  attachments:plan.attachments.map(a=>({...a,verifiedPrivateObject:true})),
});
function fakePort(plan) {
  const calls=[];
  const port={
    stagePrivateImage:async input=>{
      calls.push('stage');
      assert.equal(input.mode,'create_immutable');
      assert.equal(input.upsert,false);
      assert.equal(input.scope.ownerId,owner);
      assert.equal(input.object.id,'image-1');
      assert.equal(input.blob.type,'image/png');
    },
    verifyPrivateImage:async input=>{
      calls.push('verify');
      return {...input.object,ownerId:owner,yearId:year,verifiedPrivateObject:true};
    },
    commitMetadata:async input=>{
      calls.push('commit');
      assert.deepEqual(input.attachments,plan.attachments);
      assert.equal(input.expectedRemoteRevision,0);
      assert.equal(input.mode,'compare_and_swap');
      assert.equal(input.payloadSha256,plan.payloadSha256);
    },
    readCanonical:async input=>{
      calls.push('readback');
      assert.equal(input.expectedRevision,1);
      return receipt(plan);
    },
  };
  return {port,calls};
}
const rejects=async(fn,code)=>assert.rejects(fn,error=>error?.code===code);

test('private objects are verified before CAS metadata commit and canonical readback',async()=>{
  const plan=await makePlan(),{port,calls}=fakePort(plan);
  const ack=await executePreparedPortfolioSync({plan,images:saved().images,port});
  assert.equal(ack.status,'SYNCED_VERIFIED');
  assert.equal(ack.remoteRevision,1);
  assert.equal(ack.n71UnifiedBackupIncluded,false);
  assert.deepEqual(calls,['stage','verify','commit','readback']);
});
test('a stale or altered local image cannot start any upload',async()=>{
  const plan=await makePlan(),{port,calls}=fakePort(plan);
  await rejects(()=>executePreparedPortfolioSync({plan,images:new Map(),port}),
    'F09_CLOUD_ATTACHMENT_CHANGED');
  const altered=new Map([['image-1',{blob:new Blob([Uint8Array.from([5,6,7,8,9,0,1,2])],
    {type:'image/png'})}]]);
  await rejects(()=>executePreparedPortfolioSync({plan,images:altered,port}),
    'F09_CLOUD_ATTACHMENT_CHANGED');
  assert.deepEqual(calls,[]);
});
test('an unverified private blob blocks all metadata commits',async()=>{
  const plan=await makePlan(),{port,calls}=fakePort(plan);
  port.verifyPrivateImage=async input=>{
    calls.push('verify');
    return {...input.object,ownerId:owner,yearId:year,verifiedPrivateObject:false};
  };
  await rejects(()=>executePreparedPortfolioSync({plan,images:saved().images,port}),
    'F09_CLOUD_IMAGE_READBACK_UNVERIFIED');
  assert.deepEqual(calls,['stage','verify']);
});
test('an image from another account cannot be accepted by the sync transport',async()=>{
  const plan=await makePlan(),{port,calls}=fakePort(plan);
  port.verifyPrivateImage=async input=>{
    calls.push('verify');
    return {...input.object,ownerId:'22222222-2222-4222-8222-222222222222',
      yearId:year,verifiedPrivateObject:true};
  };
  await rejects(()=>executePreparedPortfolioSync({plan,images:saved().images,port}),
    'F09_CLOUD_IMAGE_READBACK_UNVERIFIED');
  assert.deepEqual(calls,['stage','verify']);
});
test('commit failure cannot be called synced even after a successful image upload',async()=>{
  const plan=await makePlan(),{port,calls}=fakePort(plan);
  port.commitMetadata=async()=>{calls.push('commit');throw new Error('synthetic conflict');};
  await assert.rejects(()=>executePreparedPortfolioSync({plan,images:saved().images,port}),
    /synthetic conflict/);
  assert.deepEqual(calls,['stage','verify','commit']);
});
test('missing canonical readback cannot become a successful synced receipt',async()=>{
  const plan=await makePlan(),{port,calls}=fakePort(plan);
  port.readCanonical=async()=>{calls.push('readback');return {
    fromCanonicalReadback:false,status:'active',ownerId:owner,yearId:year,revision:1,
  };};
  await rejects(()=>executePreparedPortfolioSync({plan,images:saved().images,port}),
    'F09_CLOUD_READBACK_INCOMPLETE');
  assert.deepEqual(calls,['stage','verify','commit','readback']);
});
test('NO_CHANGE never calls the network port or mutates data',async()=>{
  const first=await makePlan();
  const same=await planPortfolioCloudSync({
    scope,authenticatedUserId:owner,
    confirmedServer:{
      status:'active',verifiedRead:true,ownerId:owner,yearId:year,revision:2,
      payloadSha256:first.payloadSha256,
      attachments:first.attachments.map(a=>({...a,verifiedPrivateObject:true})),
    },
    localBaseRemoteRevision:2,localRevision:5,savedDocument:saved(),
  });
  const ack=await executePreparedPortfolioSync({plan:same,images:saved().images,port:null});
  assert.equal(ack.status,'UNCHANGED');
  assert.equal(ack.remoteRevision,2);
});
test('a missing private adapter is a hard failure without background retries',async()=>{
  const plan=await makePlan();
  await rejects(()=>executePreparedPortfolioSync({plan,images:saved().images}),
    'F09_CLOUD_PORT_UNAVAILABLE');
});
test('empty document still commits an authenticated metadata revision, with no blob calls',async()=>{
  const empty={payload:{photos:[],customWitnesses:[]},images:new Map()};
  const plan=await planPortfolioCloudSync({
    scope,authenticatedUserId:owner,confirmedServer:{
      status:'absent',verifiedRead:true,ownerId:owner,yearId:year,revision:0,
    },localBaseRemoteRevision:0,localRevision:1,savedDocument:empty,
  });
  const calls=[];
  const port={
    stagePrivateImage:async()=>{calls.push('stage');},
    verifyPrivateImage:async()=>{calls.push('verify');},
    commitMetadata:async()=>{calls.push('commit');},
    readCanonical:async()=>{calls.push('readback');return receipt(plan);},
  };
  const ack=await executePreparedPortfolioSync({plan,images:new Map(),port});
  assert.equal(ack.verified,true);
  assert.deepEqual(calls,['commit','readback']);
});
