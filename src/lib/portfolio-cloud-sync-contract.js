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
async function checkedAttachments({scope,payload,images}) {
  const expected=photoRefs(payload);
  if(!(images instanceof Map)||images.size!==expected.size)
    throw error('F09_CLOUD_ATTACHMENT_MISSING');
  const result=[];
  let bytes=0;
  const yearDigest=await textHash(scope.yearId);
  for(const id of [...expected.keys()].sort()){
    const saved=images.get(id),blob=saved?.blob;
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
  const server=checkedServer(confirmedServer,target);
  if(!isRevision(localBaseRemoteRevision)||!isRevision(localRevision)||
     localRevision<1||!savedDocument?.payload)
    throw error('F09_CLOUD_BASELINE_UNVERIFIED');
  if(server.status==='tombstoned')
    throw error('F09_CLOUD_TOMBSTONE');
  if(server.revision!==localBaseRemoteRevision)
    throw error('F09_CLOUD_CONCURRENT_CHANGE');
  const payload=savedDocument.payload;
  const payloadSha256=await dataHash(payload);
  const attachments=await checkedAttachments({
    scope:target,payload,images:savedDocument.images,
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
         !ALLOWED_IMAGE_TYPES.has(item.mimeType))
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
  return Object.freeze({
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
    stages:Object.freeze(['stage_immutable_private_images','verify_image_readback',
      'commit_metadata_with_remote_revision','verify_canonical_owner_readback']),
  });
}
/**
 * Result is intentionally fail-closed. Only the canonical server readback after
 * metadata commit may advance the saved remote baseline.
 */
export function verifyPortfolioCloudReadback(plan,reply) {
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
       actual.bytes!==expected.bytes)
      throw error('F09_CLOUD_READBACK_INCOMPLETE');
  }
  return Object.freeze({
    verified:true,status:'SYNCED_VERIFIED',remoteRevision:reply.revision,
    // A separate N71 adapter must still demonstrate backup/restore completeness.
    n71UnifiedBackupIncluded:false,
  });
}
