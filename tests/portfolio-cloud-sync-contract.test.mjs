import test from 'node:test';
import assert from 'node:assert/strict';
import {
  planPortfolioCloudSync,verifyPortfolioCloudReadback,
} from '../src/lib/portfolio-cloud-sync-contract.js';

const UUID_A='11111111-1111-4111-8111-111111111111';
const UUID_B='22222222-2222-4222-8222-222222222222';
const YEAR='year:1448/الفصل الأول';
const scope={type:'account',ownerId:UUID_A,yearId:YEAR,
  workspaceDatabase:'rakeezx-user-'+'a'.repeat(32)};
const bytes=Uint8Array.from([137,80,78,71,13,10,26,10]);
const picture=new Blob([bytes],{type:'image/png'});
const record=()=>({
  payload:{
    photos:[['custom:09:record',[{id:'image-of-class',name:'private-student-photo.png',bytes:picture.size}]]],
    customWitnesses:[{id:'custom:09:record',criterion:'09',title:'Safe synthetic evidence'}],
    criterionNames:[],includedWitnesses:['custom:09:record'],excludedWitnesses:[],
  },
  images:new Map([['image-of-class',{blob:picture}]]),
});
const empty=()=>({
  payload:{photos:[],customWitnesses:[],includedWitnesses:[]},
  images:new Map(),
});
const absent=()=>({status:'absent',verifiedRead:true,ownerId:UUID_A,yearId:YEAR,revision:0});
const active=revision=>({status:'active',verifiedRead:true,ownerId:UUID_A,yearId:YEAR,
  revision,payloadSha256:'a'.repeat(64),attachments:[]});
const plan=(more={})=>planPortfolioCloudSync({
  scope,authenticatedUserId:UUID_A,confirmedServer:absent(),
  localBaseRemoteRevision:0,savedDocument:record(),localRevision:2,...more,
});
const rejects=async(action,code)=>assert.rejects(action,e=>e?.code===code);

test('owner/year verified and no public URL or filename leaks into object paths',async()=>{
  const result=await plan();
  assert.equal(result.kind,'RAKEEZ_F09_SYNC_PLAN_V1');
  assert.equal(result.status,'LOCAL_READY_NO_SERVICE_DEPLOY');
  assert.equal(result.scope.ownerId,UUID_A);
  assert.equal(result.scope.yearId,YEAR);
  assert.equal(result.expectedRemoteRevision,0);
  assert.equal(result.localRevision,2);
  assert.equal(result.attachments.length,1);
  assert.equal(result.attachments[0].bytes,picture.size);
  assert.equal(result.attachments[0].mimeType,'image/png');
  assert.match(result.attachments[0].sha256,/^[0-9a-f]{64}$/);
  assert.match(result.attachments[0].path,/^11111111-1111-4111-8111-111111111111\/years\/[0-9a-f]{64}\/f09\/[0-9a-f]{64}\/[0-9a-f]{64}$/);
  for(const forbidden of ['private-student-photo','الفصل','image-of-class','http','signed','blob:'])
    assert.equal(result.attachments[0].path.includes(forbidden),false);
  assert.equal(result.prerequisites.includes('private_bucket_RLS'),true);
  assert.equal(result.stages.at(-1),'verify_canonical_owner_readback');
});

test('demo, fabricated owner or unsupported database cannot prepare a cloud write',async()=>{
  await rejects(()=>plan({scope:{...scope,type:'demo'}}),'F09_CLOUD_OWNER_NOT_VERIFIED');
  await rejects(()=>plan({authenticatedUserId:UUID_B}),'F09_CLOUD_OWNER_NOT_VERIFIED');
  await rejects(()=>plan({scope:{...scope,workspaceDatabase:'rakeezx-demo'}}),'F09_CLOUD_OWNER_NOT_VERIFIED');
  await rejects(()=>plan({scope:{...scope,yearId:''}}),'F09_CLOUD_OWNER_NOT_VERIFIED');
});

test('require a read-verified remote baseline; never upsert over another tab or delete',async()=>{
  await rejects(()=>plan({confirmedServer:{...absent(),verifiedRead:false}}),'F09_CLOUD_SERVER_SNAPSHOT_UNVERIFIED');
  await rejects(()=>plan({confirmedServer:{...absent(),ownerId:UUID_B}}),'F09_CLOUD_SERVER_SNAPSHOT_UNVERIFIED');
  await rejects(()=>plan({confirmedServer:active(4),localBaseRemoteRevision:3}),'F09_CLOUD_CONCURRENT_CHANGE');
  await rejects(()=>plan({confirmedServer:active(4),localBaseRemoteRevision:0}),'F09_CLOUD_CONCURRENT_CHANGE');
  await rejects(()=>plan({confirmedServer:absent(),localBaseRemoteRevision:3}),'F09_CLOUD_CONCURRENT_CHANGE');
  await rejects(()=>plan({confirmedServer:{...absent(),status:'tombstoned',revision:5}}),'F09_CLOUD_TOMBSTONE');
  await rejects(()=>plan({localBaseRemoteRevision:null}),'F09_CLOUD_BASELINE_UNVERIFIED');
});

test('missing, corrupt or excessive photo content blocks metadata publication',async()=>{
  await rejects(()=>plan({savedDocument:{...record(),images:new Map()}}),'F09_CLOUD_ATTACHMENT_MISSING');
  const invalid=record();invalid.images.set('image-of-class',{blob:new Blob([bytes],{type:'text/plain'})});
  await rejects(()=>plan({savedDocument:invalid}),'F09_CLOUD_ATTACHMENT_INVALID');
  const wrong=record();wrong.payload.photos[0][1][0].bytes=6;
  await rejects(()=>plan({savedDocument:wrong}),'F09_CLOUD_ATTACHMENT_INVALID');
  const tooMany=empty();
  tooMany.payload.photos=[['x',Array.from({length:181},(_,n)=>({
    id:'p'+n,name:'a.png',bytes:1,
  }))]];
  tooMany.images=new Map(tooMany.payload.photos[0][1].map(x=>[x.id,{blob:new Blob([Uint8Array.from([1])],{type:'image/png'})}]));
  await rejects(()=>plan({savedDocument:tooMany}),'F09_CLOUD_ATTACHMENT_LIMIT');
});

test('staged upload and HTTP success alone never prove the metadata and images were read back',async()=>{
  const prepared=await plan();
  const expected=prepared.attachments[0];
  const complete={
    fromCanonicalReadback:true,status:'active',ownerId:UUID_A,yearId:YEAR,
    revision:1,payloadSha256:prepared.payloadSha256,
    attachments:[{...expected,verifiedPrivateObject:true}],
  };
  assert.equal(verifyPortfolioCloudReadback(prepared,complete).status,'SYNCED_VERIFIED');
  assert.equal(verifyPortfolioCloudReadback(prepared,complete).n71UnifiedBackupIncluded,false);
  for(const invalid of [
    {...complete,fromCanonicalReadback:false},
    {...complete,revision:0},
    {...complete,status:'staged'},
    {...complete,ownerId:UUID_B},
    {...complete,attachments:[{...expected,verifiedPrivateObject:false}]},
    {...complete,attachments:[{...expected,sha256:'a'.repeat(64),verifiedPrivateObject:true}]},
    {...complete,attachments:[]},
  ])assert.throws(()=>verifyPortfolioCloudReadback(prepared,invalid),
    e=>e.code==='F09_CLOUD_READBACK_INCOMPLETE');
});

test('unchanged canonical server content makes a NO_CHANGE plan without upload',async()=>{
  const prepared=await plan();
  const server={...active(3),payloadSha256:prepared.payloadSha256,
    attachments:prepared.attachments.map(x=>({...x,verifiedPrivateObject:true}))};
  const again=await plan({confirmedServer:server,localBaseRemoteRevision:3,localRevision:14});
  assert.equal(again.status,'NO_CHANGE');
  assert.deepEqual(verifyPortfolioCloudReadback(again).status,'UNCHANGED');
  const altered={...server,payloadSha256:'f'.repeat(64)};
  const change=await plan({confirmedServer:altered,localBaseRemoteRevision:3});
  assert.equal(change.status,'LOCAL_READY_NO_SERVICE_DEPLOY');
});

test('empty owner-bound portfolio has a valid zero-image plan but still needs a server readback',async()=>{
  const prepared=await plan({savedDocument:empty(),localRevision:1});
  assert.equal(prepared.attachments.length,0);
  assert.throws(()=>verifyPortfolioCloudReadback(prepared,{status:'active',revision:1}),
    e=>e.code==='F09_CLOUD_READBACK_INCOMPLETE');
  const actual={fromCanonicalReadback:true,ownerId:UUID_A,yearId:YEAR,
    status:'active',revision:1,payloadSha256:prepared.payloadSha256,attachments:[]};
  assert.equal(verifyPortfolioCloudReadback(prepared,actual).verified,true);
});

test('metadata without a verified private image is not a completed NO_CHANGE sync',async()=>{
  const current=await plan();
  const server={...active(1),payloadSha256:current.payloadSha256,
    attachments:current.attachments.map(a=>({...a,verifiedPrivateObject:false}))};
  const status=await plan({confirmedServer:server,localBaseRemoteRevision:1});
  assert.equal(status.status,'LOCAL_READY_NO_SERVICE_DEPLOY');
  const missing={...active(1),payloadSha256:current.payloadSha256};
  delete missing.attachments;
  await rejects(()=>plan({confirmedServer:missing,localBaseRemoteRevision:1}),
    'F09_CLOUD_SERVER_SNAPSHOT_UNVERIFIED');
});

// AI N126: synthetic v2 documents, independent of the blocked UI candidate.
const pdf=new Blob(['%PDF-1.7\nsynthetic bytes'],{type:'application/pdf'});
const pdfRecord=()=>{
  const r=record();
  r.payload.documents=[['custom:09:record',[{id:'pdf-private-id',name:'private.pdf',note:'',bytes:pdf.size}]]];
  r.payload.links=[['custom:09:record',[{id:'link-1',name:'Evidence',note:'',url:'https://example.invalid/evidence'}]]];
  r.documents=new Map([['pdf-private-id',{blob:pdf}]]);
  return r;
};
test('optional PDF and links keep v1 image paths and hash bytes without fetching links',async()=>{
  const old=await plan(),r=pdfRecord(),p=await plan({savedDocument:r});
  assert.deepEqual(p.attachments[0],old.attachments[0]);
  assert.equal(p.attachments.length,2);
  const a=p.attachments[1];
  assert.equal(a.mimeType,'application/pdf');
  assert.match(a.path,new RegExp('^'+UUID_A+'/years/[a-f0-9]{64}/f09/[a-f0-9]{64}/[a-f0-9]{64}$'));
  const digest=await crypto.subtle.digest('SHA-256',await pdf.arrayBuffer());
  assert.equal(a.sha256,Buffer.from(digest).toString('hex'));
  for(const text of ['private','pdf-private-id','example','http','1448'])assert.equal(a.path.includes(text),false);
  assert.equal(p.payload.links[0][1][0].url,r.payload.links[0][1][0].url);
  assert.throws(()=>{p.payload.documents[0][1][0].bytes=1;},TypeError);
});
test('PDF references without the corresponding complete map fail closed',async()=>{
  for(const replacement of [undefined,null,new Map(),new Map([['other',{blob:pdf}]])]){
    const r=pdfRecord();r.documents=replacement;
    await rejects(()=>plan({savedDocument:r}),'F09_CLOUD_ATTACHMENT_MISSING');
  }
  const r=pdfRecord();r.documents.set('extra',{blob:pdf});
  await rejects(()=>plan({savedDocument:r}),'F09_CLOUD_ATTACHMENT_MISSING');
});
test('PDF type, size, signature and source ownership are validated',async()=>{
  for(const blob of [new Blob(['%PDF-1.7'],{type:'text/plain'}),
    new Blob(['not a PDF signature'],{type:'application/pdf'}),
    new Blob(['%PDF-1.8'],{type:'application/pdf'}),
    new Blob(['%PDF-2.1'],{type:'application/pdf'}),
    new Blob(['%PDF-1.'],{type:'application/pdf'}),
    new Blob(['%PDF-1.7',new Uint8Array(2*1024*1024)],{type:'application/pdf'})]){
    const r=pdfRecord();r.documents.set('pdf-private-id',{blob});
    r.payload.documents[0][1][0].bytes=blob.size;
    await rejects(()=>plan({savedDocument:r}),'F09_CLOUD_ATTACHMENT_INVALID');
  }
  for(const row of [{blob:pdf,ownerId:UUID_B},{blob:pdf,yearId:'other'},
    {blob:pdf,workspaceDatabase:'rakeezx-user-'+'b'.repeat(32)},{blob:pdf,photoId:'wrong'}]){
    const r=pdfRecord();r.documents.set('pdf-private-id',row);
    await rejects(()=>plan({savedDocument:r}),'F09_CLOUD_ATTACHMENT_INVALID');
  }
  const r=pdfRecord();r.payload.documents[0][1][0].bytes++;
  await rejects(()=>plan({savedDocument:r}),'F09_CLOUD_ATTACHMENT_INVALID');
});
function pdfBatch(count,size=pdf.size){
  const r=empty();r.payload.documents=[];r.documents=new Map();
  const blob=new Blob(['%PDF-2.0',new Uint8Array(size-8)],{type:'application/pdf'});
  for(let n=0;n<count;n++){
    const group=Math.floor(n/3);
    if(n%3===0)r.payload.documents.push(['w'+group,[]]);
    r.payload.documents[group][1].push({id:'d'+n,name:'x.pdf',note:'',bytes:size});
    r.documents.set('d'+n,{blob});
  }
  return r;
}
test('PDF total/per-witness counts and byte boundaries match saved v2 limits',async()=>{
  assert.equal((await plan({savedDocument:pdfBatch(12)})).attachments.length,12);
  assert.equal((await plan({savedDocument:pdfBatch(6,2*1024*1024)})).attachments.length,6);
  await rejects(()=>plan({savedDocument:pdfBatch(13)}),'F09_CLOUD_ATTACHMENT_LIMIT');
  await rejects(()=>plan({savedDocument:pdfBatch(7,2*1024*1024)}),'F09_CLOUD_ATTACHMENT_LIMIT');
  const r=pdfBatch(4);r.payload.documents[0][1].push(...r.payload.documents.pop()[1]);
  await rejects(()=>plan({savedDocument:r}),'F09_CLOUD_INVALID_DOCUMENT');
});
test('duplicate, cross-type and malformed metadata cannot become cloud references',async()=>{
  const variants=[r=>r.payload.documents.push(r.payload.documents[0]),
    r=>r.payload.documents[0][1].push(r.payload.documents[0][1][0]),
    r=>r.payload.documents[0][1][0].id='image-of-class',
    r=>r.payload.links[0][1][0].id='pdf-private-id',
    r=>r.payload.documents={},r=>r.payload.documents=null,
    r=>r.payload.documents[0]=['x'],r=>r.payload.documents[0][1][0].note=null,
    r=>r.payload.links[0][1][0].url='javascript:alert(1)',
    r=>r.payload.links[0][1][0].url='https://user:pass@example.invalid'];
  for(const mutate of variants){const r=pdfRecord();mutate(r);
    await rejects(()=>plan({savedDocument:r}),'F09_CLOUD_INVALID_DOCUMENT');}
});
test('canonical PDF readback rejects partial, duplicate, foreign and malformed proofs',async()=>{
  const p=await plan({savedDocument:pdfRecord()});
  const complete={fromCanonicalReadback:true,status:'active',ownerId:UUID_A,yearId:YEAR,
    revision:1,payloadSha256:p.payloadSha256,attachments:p.attachments.map(a=>({...a,verifiedPrivateObject:true}))};
  assert.equal(verifyPortfolioCloudReadback(p,complete).verified,true);
  for(const bad of [{...complete,yearId:'other'}, {...complete,revision:2},
    {...complete,attachments:[complete.attachments[0],complete.attachments[0]]},
    ...['mimeType','path','sha256','bytes','verifiedPrivateObject'].map(key=>{
      const attachments=structuredClone(complete.attachments);delete attachments[1][key];return {...complete,attachments};
    })])assert.throws(()=>verifyPortfolioCloudReadback(p,bad),e=>e.code==='F09_CLOUD_READBACK_INCOMPLETE');
});
test('server snapshots reject wrong year, foreign paths, duplicate and malformed objects',async()=>{
  const p=await plan({savedDocument:pdfRecord()});
  const server={...active(1),payloadSha256:p.payloadSha256,attachments:p.attachments.map(a=>({...a,verifiedPrivateObject:true}))};
  for(const bad of [{...server,yearId:'other'}, {...server,attachments:[server.attachments[0],server.attachments[0]]},
    ...['path','mimeType','sha256','bytes'].map(key=>{
      const attachments=structuredClone(server.attachments);attachments[1][key]=key==='bytes'?0:'foreign';return {...server,attachments};
    })])await rejects(()=>plan({savedDocument:pdfRecord(),confirmedServer:bad,localBaseRemoteRevision:1}),
      'F09_CLOUD_SERVER_SNAPSHOT_UNVERIFIED');
  const same=await plan({savedDocument:pdfRecord(),confirmedServer:server,localBaseRemoteRevision:1});
  assert.equal(same.status,'NO_CHANGE');
  server.attachments[1].verifiedPrivateObject=false;
  assert.equal((await plan({savedDocument:pdfRecord(),confirmedServer:server,localBaseRemoteRevision:1})).status,
    'LOCAL_READY_NO_SERVICE_DEPLOY');
});

test('verified server snapshot cannot be changed during asynchronous planning',async()=>{
  const server=absent(),pending=plan({confirmedServer:server});
  server.ownerId=UUID_B;server.yearId='foreign';server.revision=44;server.status='tombstoned';
  const prepared=await pending;
  assert.equal(prepared.scope.ownerId,UUID_A);assert.equal(prepared.scope.yearId,YEAR);
  assert.equal(prepared.expectedRemoteRevision,0);
});
