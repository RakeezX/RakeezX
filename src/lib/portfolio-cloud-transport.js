/**
 * Opt-in F09 cloud transport seam, NOT WIRED into the application.
 * Calls only injected, testable ports; has no Supabase client, URL, or secrets.
 * A real port must enforce authenticated owner RLS, immutable private storage,
 * optimistic metadata revisions, and server-side canonical readback.
 */
import {verifyPortfolioCloudReadback} from './portfolio-cloud-sync-contract.js';

const INVALID=code=>Object.assign(new Error(code),{code});
const toHex=a=>[...new Uint8Array(a)].map(n=>n.toString(16).padStart(2,'0')).join('');
const required=['stagePrivateImage','verifyPrivateImage','commitMetadata','readCanonical'];
function validatePort(port){
  if(!port||required.some(name=>typeof port[name]!=='function'))
    throw INVALID('F09_CLOUD_PORT_UNAVAILABLE');
}
function checkImageReceipt(expected,received,owner,year) {
  if(received?.verifiedPrivateObject!==true||
     received.ownerId?.toLowerCase()!==owner||
     received.yearId!==year||received.path!==expected.path||
     received.sha256!==expected.sha256||received.bytes!==expected.bytes)
    throw INVALID('F09_CLOUD_IMAGE_READBACK_UNVERIFIED');
}
async function preflight(plan,images){
  if(!(images instanceof Map)||images.size!==plan.attachments.length)
    throw INVALID('F09_CLOUD_ATTACHMENT_CHANGED');
  const ready=[];
  for(const image of plan.attachments){
    const source=images.get(image.id)?.blob;
    if(!(source instanceof Blob)||source.size!==image.bytes||
       source.type!==image.mimeType)
      throw INVALID('F09_CLOUD_ATTACHMENT_CHANGED');
    const hex=toHex(await crypto.subtle.digest('SHA-256',await source.arrayBuffer()));
    if(hex!==image.sha256)
      throw INVALID('F09_CLOUD_ATTACHMENT_CHANGED');
    ready.push([image,source]);
  }
  return ready;
}
/**
 * Returned receipt means actual canonical verification by the injected service
 * adapter, not upload completion, commit 2xx, local Preview, or metadata alone.
 * No local draft baseline should be advanced on any throw.
 */
export async function executePreparedPortfolioSync({plan,images,port}={}) {
  if(plan?.kind!=='RAKEEZ_F09_SYNC_PLAN_V1')
    throw INVALID('F09_CLOUD_PLAN_INVALID');
  if(plan.status==='NO_CHANGE')
    return verifyPortfolioCloudReadback(plan);
  if(plan.status!=='LOCAL_READY_NO_SERVICE_DEPLOY')
    throw INVALID('F09_CLOUD_PLAN_NOT_READY');
  validatePort(port);
  // Ensure no mutations begin when the local attachment set has changed since
  // the plan was built or a photo was deleted/altered.
  const photoBlobs=await preflight(plan,images);
  const confirmed=[];
  for(const [candidate,blob] of photoBlobs){
    await port.stagePrivateImage({
      scope:plan.scope,object:candidate,blob,mode:'create_immutable',
      upsert:false,
    });
    const proof=await port.verifyPrivateImage({
      scope:plan.scope,object:candidate,
    });
    checkImageReceipt(candidate,proof,plan.scope.ownerId,plan.scope.yearId);
    confirmed.push(candidate);
  }
  // Metadata must reference ONLY objects that were actually read back.
  await port.commitMetadata({
    scope:plan.scope,expectedRemoteRevision:plan.expectedRemoteRevision,
    payload:plan.payload,payloadSha256:plan.payloadSha256,
    attachments:confirmed,mode:'compare_and_swap',
  });
  // An RPC receipt, HTTP 200, or staged object alone is never sufficient.
  const canonical=await port.readCanonical({
    scope:plan.scope,expectedRevision:plan.expectedRemoteRevision+1,
  });
  return verifyPortfolioCloudReadback(plan,canonical);
}
