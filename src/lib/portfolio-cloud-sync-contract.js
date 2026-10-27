/**
 * F09 owner-scoped cloud sync preparation only. This module performs NO
 * network I/O, creates NO Supabase objects and never acknowledges persistence.
 * The Product's existing verified auth/lease and a server-side RLS contract
 * are prerequisites before any transport can use the resulting plan.
 */
const PLAN_KIND='RAKEEZ_F09_SYNC_PLAN_V1';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DB=/^rakeezx-user-[0-9a-f]{32}$/;
const HASH=/^[a-f0-9]{64}$/;
const ALLOWED_IMAGE_TYPES=new Set(['image/png','image/jpeg','image/webp']);
const MAX_IMAGE_BYTES=6*1024*1024;
const MAX_TOTAL_IMAGE_BYTES=100*1024*1024;
const MAX_IMAGES=180;
const MAX_PDF_BYTES=2*1024*1024;
const MAX_TOTAL_PDF_BYTES=12*1024*1024;
const preparedSources=new WeakMap();
const freeze=value=>{
  if(value&&typeof value==='object'){
    Object.values(value).forEach(freeze);Object.freeze(value);
  }
  return value;
};
const error=(code)=>Object.assign(new Error(code),{code});
const normalizedHash=v=>String(v||'').toLowerCase();
const canonical=value=>{
  if(Array.isArray(value))return value.map(canonical);
  if(value&&typeof value==='object')
    return Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])]));
  return value;
};
async function sha256(bytes){
  if(!globalThis.crypto?.subtle)throw error('F09_CRYPTO_UNAVAILABLE');
  const digest=await globalThis.crypto.subtle.digest('SHA-256',bytes);
  return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
const textHash=value=>sha256(new TextEncoder().encode(value));
const dataHash=value=>textHash(JSON.stringify(canonical(value)));
const isRevision=n=>Number.isSafeInteger(n)&&n>=0;
function authenticatedScope(scope,authUserId){
  if(scope?.type!=='account'||!DB.test(scope.workspaceDatabase??'')||
     !UUID.test(scope.ownerId??'')||!UUID.test(authUserId??'')||
     scope.ownerId.toLowerCase()!==authUserId.toLowerCase()||
     typeof scope.yearId!=='string'||!scope.yearId.trim()||scope.yearId.length>160)
    throw error('F09_CLOUD_OWNER_NOT_VERIFIED');
  return {
    ownerId:scope.ownerId.toLowerCase(),yearId:scope.yearId,
    workspaceDatabase:scope.workspaceDatabase,
  };
}
function checkedServer(server,scope){
  if(!server||server.verifiedRead!==true||
     !['absent','active','tombstoned'].includes(server.status)||
     server.ownerId?.toLowerCase()!==scope.ownerId||
     server.yearId!==scope.yearId||
     !isRevision(server.revision))
    throw error('F09_CLOUD_SERVER_SNAPSHOT_UNVERIFIED');
  if(server.status==='absent'&&server.revision!==0)
    throw error('F09_CLOUD_SERVER_SNAPSHOT_UNVERIFIED');
  if(server.status==='active'&&(server.revision<1||
     !HASH.test(normalizedHash(server.payloadSha256))||
     !Array.isArray(server.attachments)))
    throw error('F09_CLOUD_SERVER_SNAPSHOT_UNVERIFIED');
  return server;
}
function photoRefs(payload) {
  if(!payload||typeof payload!=='object'||!Array.isArray(payload.photos))
    throw error('F09_CLOUD_INVALID_DOCUMENT');
  const result=new Map();
  for(const entry of payload.photos){
    if(!Array.isArray(entry)||entry.length!==2||!Array.isArray(entry[1])||
       typeof entry[0]!=='string'||!entry[0])
      throw error('F09_CLOUD_INVALID_DOCUMENT');
    for(const item of entry[1]){
      if(!item||typeof item.id!=='string'||!item.id||result.has(item.id)||
         typeof item.name!=='string'||!Number.isSafeInteger(item.bytes)||
         item.bytes<1||item.bytes>MAX_IMAGE_BYTES)
        throw error('F09_CLOUD_INVALID_DOCUMENT');
      result.set(item.id,item);
    }
  }
  if(result.size>MAX_IMAGES)throw error('F09_CLOUD_ATTACHMENT_LIMIT');
  return result;
}
// Mirrors the saved, unpublished v2 support format without importing it into
// Product. Links remain metadata; URL parsing here never fetches a resource.
function documentRefs(payload,photos){
  const result=new Map(),seen=new Set(photos.keys());
  let total=0;
  for(const key of ['documents','links']){
    const groups=payload[key]===undefined?[]:payload[key];
    if(!Array.isArray(groups))throw error('F09_CLOUD_INVALID_DOCUMENT');
    const witnesses=new Set();
    for(const pair of groups){
      if(!Array.isArray(pair)||pair.length!==2||typeof pair[0]!=='string'||
         !pair[0]||witnesses.has(pair[0])||!Array.isArray(pair[1])||pair[1].length>3)
        throw error('F09_CLOUD_INVALID_DOCUMENT');
      witnesses.add(pair[0]);
      for(const item of pair[1]){
        if(!item||typeof item.id!=='string'||!item.id||item.id.length>160||
           seen.has(item.id)||typeof item.name!=='string'||item.name.length>70||
           typeof item.note!=='string'||item.note.length>120)
          throw error('F09_CLOUD_INVALID_DOCUMENT');
        seen.add(item.id);
        if(key==='links'){
          const text=typeof item.url==='string'?item.url.trim():'';
          let url;try{url=new URL(text);}catch{throw error('F09_CLOUD_INVALID_DOCUMENT');}
          if(text.length>2048||/[\s\u0000-\u001f\\]/.test(text)||
             !/^https:\/\//i.test(text)||url.protocol!=='https:'||url.username||url.password||!url.hostname)
            throw error('F09_CLOUD_INVALID_DOCUMENT');
          continue;
        }
        if(!Number.isSafeInteger(item.bytes)||item.bytes<8||item.bytes>MAX_PDF_BYTES)
          throw error('F09_CLOUD_ATTACHMENT_INVALID');
        total+=item.bytes;result.set(item.id,item);
      }
    }
  }
  if(result.size>12||total>MAX_TOTAL_PDF_BYTES)throw error('F09_CLOUD_ATTACHMENT_LIMIT');
  return result;
}
function checkedRecord(saved,scope,id){
  if(!saved||['ownerId','yearId','workspaceDatabase'].some(key=>
    saved[key]!==undefined&&saved[key]!==scope[key])||
    (saved.photoId!==undefined&&saved.photoId!==id))
    throw error('F09_CLOUD_ATTACHMENT_INVALID');
  return saved.blob;
}
async function checkedAttachments({scope,payload,images,documents}) {
  const expected=photoRefs(payload);
  const pdfs=documentRefs(payload,expected);
  if(!(images instanceof Map)||images.size!==expected.size)
    throw error('F09_CLOUD_ATTACHMENT_MISSING');
  if((documents!==undefined&&!(documents instanceof Map))||
     (documents?.size??0)!==pdfs.size||[...pdfs.keys()].some(id=>!documents?.has(id)))
    throw error('F09_CLOUD_ATTACHMENT_MISSING');
  const result=[];
  let bytes=0;
  const yearDigest=await textHash(scope.yearId);
  for(const id of [...expected.keys()].sort()){
    const blob=checkedRecord(images.get(id),scope,id);
    if(!(blob instanceof Blob)||!ALLOWED_IMAGE_TYPES.has(blob.type)||
       blob.size!==expected.get(id).bytes||blob.size>MAX_IMAGE_BYTES)
      throw error('F09_CLOUD_ATTACHMENT_INVALID');
    bytes+=blob.size;
    if(bytes>MAX_TOTAL_IMAGE_BYTES)throw error('F09_CLOUD_ATTACHMENT_LIMIT');
    const hash=await sha256(await blob.arrayBuffer());
    const objectId=await textHash(id);
    // No student name, teacher email, original filename or public URL in path.
    const path=scope.ownerId+'/years/'+yearDigest+'/f09/'+objectId+'/'+hash;
    result.push(Object.freeze({
      id,path,sha256:hash,bytes:blob.size,mimeType:blob.type,
    }));
  }
  for(const id of [...pdfs.keys()].sort()){
    const blob=checkedRecord(documents?.get(id),scope,id);
    if(!(blob instanceof Blob)||blob.type!=='application/pdf'||blob.size!==pdfs.get(id).bytes||
       blob.size<8||blob.size>MAX_PDF_BYTES||
       !/^%PDF-(?:1\.[0-7]|2\.0)/.test(new TextDecoder().decode(await blob.slice(0,8).arrayBuffer())))
      throw error('F09_CLOUD_ATTACHMENT_INVALID');
    const hash=await sha256(await blob.arrayBuffer());
    const objectId=await textHash(id);
    result.push(Object.freeze({id,path:scope.ownerId+'/years/'+yearDigest+'/f09/'+objectId+'/'+hash,
      sha256:hash,bytes:blob.size,mimeType:blob.type}));
  }
  return result;
}
/**
 * Deterministic plan against a PROVEN server snapshot. An upload must never
 * start on a guessed missing document or revive a server-side tombstone.
 * localBaseRemoteRevision is the explicit acknowledgement retained from the
 * previous successful remote readback; it is not the local IndexedDB revision.
 */
export async function planPortfolioCloudSync({
  scope,authenticatedUserId,confirmedServer,localBaseRemoteRevision,
  savedDocument,localRevision,
}={}){
  const target=authenticatedScope(scope,authenticatedUserId);
  // Detach the verified snapshot before the first hash awaits. Caller edits
  // must never change the owner, year or CAS revision of an accepted snapshot.
  const server=freeze(JSON.parse(JSON.stringify(checkedServer(confirmedServer,target))));
  if(!isRevision(localBaseRemoteRevision)||!isRevision(localRevision)||
     localRevision<1||!savedDocument?.payload)
    throw error('F09_CLOUD_BASELINE_UNVERIFIED');
  if(server.status==='tombstoned')
    throw error('F09_CLOUD_TOMBSTONE');
  if(server.revision!==localBaseRemoteRevision)
    throw error('F09_CLOUD_CONCURRENT_CHANGE');
  // Keep the source for pre-stage revalidation, but never expose mutable
  // metadata to a port or let later edits change what this plan acknowledges.
  const payload=freeze(JSON.parse(JSON.stringify(savedDocument.payload)));
  const payloadSha256=await dataHash(payload);
  const attachments=await checkedAttachments({
    scope:target,payload,images:savedDocument.images,documents:savedDocument.documents,
  });
  const current=new Map(attachments.map(x=>[x.id,x.sha256]));
  const remoteAttachments=server.attachments;
  if(server.status==='active'){
    const seen=new Set();
    for(const item of remoteAttachments){
      if(!item||typeof item.id!=='string'||!item.id||seen.has(item.id)||
         !HASH.test(normalizedHash(item.sha256))||
         typeof item.path!=='string'||!item.path||
         !Number.isSafeInteger(item.bytes)||item.bytes<1||
         !(ALLOWED_IMAGE_TYPES.has(item.mimeType)||item.mimeType==='application/pdf')||
         item.path!==target.ownerId+'/years/'+await textHash(target.yearId)+'/f09/'+await textHash(item.id)+'/'+normalizedHash(item.sha256)||
         item.bytes>(item.mimeType==='application/pdf'?MAX_PDF_BYTES:MAX_IMAGE_BYTES))
        throw error('F09_CLOUD_SERVER_SNAPSHOT_UNVERIFIED');
      seen.add(item.id);
    }
  }
  const remoteHash=normalizedHash(server.payloadSha256);
  const isSame=server.status==='active'&&remoteHash===payloadSha256&&
    Array.isArray(remoteAttachments)&&remoteAttachments.length===current.size&&
    remoteAttachments.every(a=>{
      const local=attachments.find(item=>item.id===a.id);
      return local&&a.verifiedPrivateObject===true&&
        a.path===local.path&&a.bytes===local.bytes&&
        a.mimeType===local.mimeType&&
        normalizedHash(a.sha256)===local.sha256;
    });
  const plan=Object.freeze({
    kind:PLAN_KIND,
    status:isSame?'NO_CHANGE':'LOCAL_READY_NO_SERVICE_DEPLOY',
    scope:Object.freeze({ownerId:target.ownerId,yearId:target.yearId}),
    expectedRemoteRevision:server.revision,
    localRevision,
    payload,
    payloadSha256,
    attachments:Object.freeze(attachments),
    // Required order; a transport receipt alone is not proof of completion.
    prerequisites:Object.freeze(['private_bucket_RLS','owner_year_metadata_RLS',
      'authenticated_session','offline_lease','versioned_service_readback']),
    stages:Object.freeze(['stage_immutable_private_files','verify_file_readback',
      'commit_metadata_with_remote_revision','verify_canonical_owner_readback']),
  });
  preparedSources.set(plan,{savedDocument,scope:target});
  return plan;
}
export function assertPreparedPortfolioPlan(plan){
  if(!preparedSources.has(plan))throw error('F09_CLOUD_PLAN_INVALID');
}
// All checks finish before the first port call. Immutable Blob references are
// captured as one batch, so a later map edit cannot substitute uploaded bytes.
export async function preparedPortfolioFiles(plan,{images,documents}={}){
  assertPreparedPortfolioPlan(plan);
  const {savedDocument,scope}=preparedSources.get(plan);
  const capture=(map)=>map instanceof Map?new Map([...map].map(([id,row])=>[id,{...row}])):map;
  const sourceImages=capture(savedDocument.images),sourceDocuments=capture(savedDocument.documents);
  const selectedImages=capture(images),selectedDocuments=capture(documents);
  const current=await checkedAttachments({scope,payload:plan.payload,images:sourceImages,documents:sourceDocuments});
  const selected=await checkedAttachments({scope,payload:plan.payload,images:selectedImages,documents:selectedDocuments});
  const stable=(actual,snapshot)=>actual===undefined?snapshot===undefined:
    actual instanceof Map&&snapshot instanceof Map&&actual.size===snapshot.size&&
    [...snapshot].every(([id,row])=>actual.get(id)?.blob===row.blob&&
      ['ownerId','yearId','workspaceDatabase','photoId'].every(k=>actual.get(id)?.[k]===row[k]));
  if(JSON.stringify(canonical(savedDocument.payload))!==JSON.stringify(canonical(plan.payload))||
     !stable(savedDocument.images,sourceImages)||!stable(savedDocument.documents,sourceDocuments)||
     !stable(images,selectedImages)||!stable(documents,selectedDocuments)||
     JSON.stringify(current)!==JSON.stringify(plan.attachments)||JSON.stringify(selected)!==JSON.stringify(plan.attachments))
    throw error('F09_CLOUD_ATTACHMENT_CHANGED');
  return plan.attachments.map(a=>[a,(a.mimeType==='application/pdf'?selectedDocuments:selectedImages).get(a.id).blob]);
}
/**
 * Result is intentionally fail-closed. Only the canonical server readback after
 * metadata commit may advance the saved remote baseline.
 */
export function verifyPortfolioCloudReadback(plan,reply) {
  assertPreparedPortfolioPlan(plan);
  if(plan?.kind!==PLAN_KIND)
    throw error('F09_CLOUD_PLAN_INVALID');
  if(plan.status==='NO_CHANGE')
    return Object.freeze({verified:true,status:'UNCHANGED',remoteRevision:plan.expectedRemoteRevision});
  if(plan.status!=='LOCAL_READY_NO_SERVICE_DEPLOY'||reply?.fromCanonicalReadback!==true||
     reply?.ownerId?.toLowerCase()!==plan.scope.ownerId||
     reply?.yearId!==plan.scope.yearId||
     reply?.status!=='active'||
     reply?.revision!==plan.expectedRemoteRevision+1||
     normalizedHash(reply?.payloadSha256)!==plan.payloadSha256||
     !Array.isArray(reply.attachments)||
     reply.attachments.length!==plan.attachments.length)
    throw error('F09_CLOUD_READBACK_INCOMPLETE');
  const received=new Map();
  for(const a of reply.attachments){
    if(!a||typeof a.id!=='string'||received.has(a.id)||
       typeof a.path!=='string'||!HASH.test(normalizedHash(a.sha256))||
       a.verifiedPrivateObject!==true)
      throw error('F09_CLOUD_READBACK_INCOMPLETE');
    received.set(a.id,a);
  }
  for(const expected of plan.attachments){
    const actual=received.get(expected.id);
    if(!actual||actual.path!==expected.path||
       normalizedHash(actual.sha256)!==expected.sha256||
       actual.bytes!==expected.bytes||actual.mimeType!==expected.mimeType)
      throw error('F09_CLOUD_READBACK_INCOMPLETE');
  }
  return Object.freeze({
    verified:true,status:'SYNCED_VERIFIED',remoteRevision:reply.revision,
    // A separate N71 adapter must still demonstrate backup/restore completeness.
    n71UnifiedBackupIncluded:false,
  });
}
