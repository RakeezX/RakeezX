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

// AI N126: generic private file seam; never a service adapter.
const pdf=new Blob(['%PDF-1.7\nsynthetic'],{type:'application/pdf'});
function savedPDF(){
  const r=saved();r.payload.documents=[['custom:09:one',[{id:'pdf-1',name:'private.pdf',note:'',bytes:pdf.size}]]];
  r.documents=new Map([['pdf-1',{blob:pdf,ownerId:owner,yearId:year}]]);
  return r;
}
const planPDF=r=>planPortfolioCloudSync({scope,authenticatedUserId:owner,
  confirmedServer:{status:'absent',verifiedRead:true,ownerId:owner,yearId:year,revision:0},
  localBaseRemoteRevision:0,localRevision:1,savedDocument:r});
function filePort(plan){
  const calls=[],blobs=[];
  return {calls,blobs,port:{
    stagePrivateFile:async input=>{
      calls.push('stage:'+input.object.id);blobs.push(input.blob);
      assert.equal(input.mode,'create_immutable');assert.equal(input.upsert,false);
      assert.equal(input.scope.ownerId,owner);assert.equal(input.scope.yearId,year);
    },
    verifyPrivateFile:async input=>{
      calls.push('verify:'+input.object.id);
      return {...input.object,ownerId:owner,yearId:year,verifiedPrivateObject:true};
    },
    commitMetadata:async input=>{
      calls.push('commit');assert.equal(input.expectedRemoteRevision,0);
      assert.equal(input.mode,'compare_and_swap');assert.deepEqual(input.attachments,plan.attachments);
      assert.deepEqual(input.payload,plan.payload);assert.equal(input.payloadSha256,plan.payloadSha256);
    },
    readCanonical:async()=>{calls.push('readback');return receipt(plan);},
  }};
}
test('generic image/PDF port stages immutable bytes then verifies every file before CAS',async()=>{
  const r=savedPDF(),p=await planPDF(r),f=filePort(p);
  const ack=await executePreparedPortfolioSync({plan:p,images:r.images,documents:r.documents,port:f.port});
  assert.equal(ack.status,'SYNCED_VERIFIED');assert.equal(ack.n71UnifiedBackupIncluded,false);
  assert.deepEqual(f.calls,['stage:image-1','verify:image-1','stage:pdf-1','verify:pdf-1','commit','readback']);
  assert.deepEqual(f.blobs,[picture,pdf]);
});
test('PDF plans cannot fall back to the legacy image-only port',async()=>{
  const r=savedPDF(),p=await planPDF(r),f=fakePort(p);
  await rejects(()=>executePreparedPortfolioSync({plan:p,images:r.images,documents:r.documents,port:f.port}),
    'F09_CLOUD_PORT_UNAVAILABLE');assert.deepEqual(f.calls,[]);
});
test('no upload for fabricated plans, missing server proof or changed local source',async()=>{
  const r=savedPDF(),p=await planPDF(r),f=filePort(p);
  for(const forged of [{...p},{...p,status:'NO_CHANGE'},{kind:p.kind,status:p.status}])
    await rejects(()=>executePreparedPortfolioSync({plan:forged,images:r.images,documents:r.documents,port:f.port}),
      'F09_CLOUD_PLAN_INVALID');
  await rejects(()=>planPortfolioCloudSync({scope,authenticatedUserId:owner,
    savedDocument:r,localRevision:1,localBaseRemoteRevision:0}),'F09_CLOUD_SERVER_SNAPSHOT_UNVERIFIED');
  const scenarios=[
    r=>{r.documents=undefined;},r=>r.documents.delete('pdf-1'),
    r=>r.documents.set('extra',{blob:pdf}),
    r=>r.documents.set('pdf-1',{blob:new Blob(['%PDF-1.7\naltered!!'],{type:'application/pdf'})}),
    r=>r.images.set('image-1',{blob:new Blob(['different'],{type:'image/png'})}),
    r=>{r.payload.documents=[];},r=>{r.payload.customWitnesses[0].criterion='10';},
    r=>{r.documents.get('pdf-1').ownerId='22222222-2222-4222-8222-222222222222';},
  ];
  for(const mutate of scenarios){
    const source=savedPDF(),plan=await planPDF(source),fp=filePort(plan);mutate(source);
    await rejects(()=>executePreparedPortfolioSync({plan,images:source.images,documents:source.documents,port:fp.port}),
      'F09_CLOUD_ATTACHMENT_CHANGED');assert.deepEqual(fp.calls,[]);
  }
  // Passing stale separate maps must not mask changes to the actual saved source.
  const source=savedPDF(),plan=await planPDF(source),fp=filePort(plan),oldDocs=new Map(source.documents);
  source.documents=new Map();
  await rejects(()=>executePreparedPortfolioSync({plan,images:source.images,documents:oldDocs,port:fp.port}),
    'F09_CLOUD_ATTACHMENT_CHANGED');assert.deepEqual(fp.calls,[]);assert.deepEqual(f.calls,[]);
});
test('failures in each file phase, CAS or canonical read propagate without a sync acknowledgement',async()=>{
  for(const phase of ['stagePrivateFile','verifyPrivateFile','commitMetadata','readCanonical']){
    const r=savedPDF(),p=await planPDF(r),f=filePort(p);
    f.port[phase]=async()=>{f.calls.push('failed:'+phase);throw new Error('synthetic '+phase);};
    await assert.rejects(()=>executePreparedPortfolioSync({plan:p,images:r.images,documents:r.documents,port:f.port}),
      new RegExp('synthetic '+phase));
    assert.equal(f.calls.at(-1),'failed:'+phase);
    if(phase==='stagePrivateFile'||phase==='verifyPrivateFile')assert.equal(f.calls.includes('commit'),false);
    if(phase==='commitMetadata')assert.equal(f.calls.includes('readback'),false);
  }
});
test('foreign, wrong-year, malformed or HTTP-only private file proofs stop metadata',async()=>{
  for(const change of [proof=>({...proof,ownerId:'22222222-2222-4222-8222-222222222222'}),
    proof=>({...proof,yearId:'foreign'}),proof=>({...proof,path:'foreign'}),
    proof=>({...proof,sha256:'0'.repeat(64)}),proof=>({...proof,bytes:1}),
    proof=>({...proof,mimeType:'text/plain'}),proof=>({...proof,verifiedPrivateObject:false}),
    ()=>({status:200}),()=>null]){
    const r=savedPDF(),p=await planPDF(r),f=filePort(p),verify=f.port.verifyPrivateFile;
    f.port.verifyPrivateFile=async input=>{
      const proof=await verify(input);return input.object.id==='pdf-1'?change(proof):proof;
    };
    await rejects(()=>executePreparedPortfolioSync({plan:p,images:r.images,documents:r.documents,port:f.port}),
      'F09_CLOUD_IMAGE_READBACK_UNVERIFIED');assert.equal(f.calls.includes('commit'),false);
  }
});
test('partial or HTTP-only canonical metadata never certifies PDF sync',async()=>{
  for(const change of [reply=>({...reply,attachments:reply.attachments.slice(0,1)}),
    reply=>({...reply,attachments:[reply.attachments[0],reply.attachments[0]]}),
    reply=>({...reply,ownerId:'22222222-2222-4222-8222-222222222222'}),
    reply=>({...reply,yearId:'wrong'}),reply=>({...reply,revision:0}),
    reply=>({...reply,status:'tombstoned'}),()=>({status:200})]){
    const r=savedPDF(),p=await planPDF(r),f=filePort(p);
    f.port.readCanonical=async()=>change(receipt(p));
    await rejects(()=>executePreparedPortfolioSync({plan:p,images:r.images,documents:r.documents,port:f.port}),
      'F09_CLOUD_READBACK_INCOMPLETE');
  }
});
test('source map edits during async preflight cannot start staging',async()=>{
  const r=savedPDF(),p=await planPDF(r),f=filePort(p);
  const pending=executePreparedPortfolioSync({plan:p,images:r.images,documents:r.documents,port:f.port});
  r.documents.clear();
  await rejects(()=>pending,'F09_CLOUD_ATTACHMENT_CHANGED');assert.deepEqual(f.calls,[]);
});
test('ports receive frozen metadata and captured immutable Blobs',async()=>{
  const r=savedPDF(),p=await planPDF(r),f=filePort(p),stage=f.port.stagePrivateFile;
  f.port.stagePrivateFile=async input=>{
    await stage(input);r.documents.clear();
    assert.throws(()=>{input.scope.yearId='foreign';},TypeError);
    assert.throws(()=>{input.object.path='foreign';},TypeError);
  };
  const ack=await executePreparedPortfolioSync({plan:p,images:r.images,documents:new Map(r.documents),port:f.port});
  assert.equal(ack.verified,true);assert.deepEqual(f.blobs,[picture,pdf]);
});

test('cloud modules stay inert outside their seam and paired tests',async()=>{
  const {readdir,readFile}=await import('node:fs/promises');
  async function walk(dir){
    for(const entry of await readdir(dir,{withFileTypes:true})){
      const path=new URL(entry.name+(entry.isDirectory()?'/':''),dir);
      if(entry.isDirectory())await walk(path);
      else if(/\.(?:js|mjs|html)$/.test(entry.name)&&!entry.name.startsWith('portfolio-cloud-')){
        const text=await readFile(path,'utf8');
        assert.doesNotMatch(text,/portfolio-cloud-(?:sync-contract|transport)(?:\.js)?/,'unexpected runtime reference: '+path);
      }
    }
  }
  await walk(new URL('../src/',import.meta.url));
  const sw=await readFile(new URL('../sw.js',import.meta.url),'utf8');
  assert.doesNotMatch(sw,/portfolio-cloud-(?:sync-contract|transport)/);
  for(const name of ['portfolio-cloud-sync-contract.js','portfolio-cloud-transport.js']){
    const text=await readFile(new URL('../src/lib/'+name,import.meta.url),'utf8');
    assert.doesNotMatch(text,/\b(?:fetch|XMLHttpRequest|WebSocket|createClient)\s*\(|https?:\/\//);
  }
});

test('PDF-only documents need no images but still need complete canonical proof',async()=>{
  const r=savedPDF();r.images=new Map();r.payload.photos=[];
  const p=await planPDF(r),f=filePort(p);
  const ack=await executePreparedPortfolioSync({plan:p,images:r.images,documents:r.documents,port:f.port});
  assert.equal(ack.verified,true);assert.deepEqual(f.calls,['stage:pdf-1','verify:pdf-1','commit','readback']);
});
test('CAS rejects a revision changed after the validated snapshot, with no canonical success',async()=>{
  const r=savedPDF(),p=await planPDF(r),f=filePort(p);
  const remoteRevision=1;
  f.port.commitMetadata=async input=>{
    f.calls.push('commit');
    if(input.expectedRemoteRevision!==remoteRevision)throw new Error('synthetic stale CAS');
  };
  await assert.rejects(()=>executePreparedPortfolioSync({plan:p,images:r.images,documents:r.documents,port:f.port}),
    /synthetic stale CAS/);assert.equal(f.calls.includes('readback'),false);
});
test('NO_CHANGE PDF plans revalidate local metadata and bytes before acknowledging',async()=>{
  const r=savedPDF(),first=await planPDF(r);
  const p=await planPortfolioCloudSync({scope,authenticatedUserId:owner,
    confirmedServer:{...receipt(first),verifiedRead:true},localBaseRemoteRevision:1,localRevision:2,savedDocument:r});
  assert.equal(p.status,'NO_CHANGE');
  assert.equal((await executePreparedPortfolioSync({plan:p,images:r.images,documents:r.documents})).status,'UNCHANGED');
  r.payload.documents=[];
  await rejects(()=>executePreparedPortfolioSync({plan:p,images:r.images,documents:r.documents}),
    'F09_CLOUD_ATTACHMENT_CHANGED');
});
