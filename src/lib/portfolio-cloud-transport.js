/**
 * Opt-in F09 cloud transport seam, NOT WIRED into the application.
 * Calls only injected, testable ports; has no Supabase client, URL, or secrets.
 * A real port must enforce authenticated owner RLS, immutable private storage,
 * optimistic metadata revisions, and server-side canonical readback.
 */
import {verifyPortfolioCloudReadback,assertPreparedPortfolioPlan,preparedPortfolioFiles} from './portfolio-cloud-sync-contract.js';

const INVALID=code=>Object.assign(new Error(code),{code});
function validatePort(port,hasPDF){
  const generic=typeof port?.stagePrivateFile==='function'&&typeof port?.verifyPrivateFile==='function';
  if(!port||typeof port.commitMetadata!=='function'||typeof port.readCanonical!=='function'||
     (!generic&&(hasPDF||typeof port.stagePrivateImage!=='function'||typeof port.verifyPrivateImage!=='function')))
    throw INVALID('F09_CLOUD_PORT_UNAVAILABLE');
  return generic?['stagePrivateFile','verifyPrivateFile']:['stagePrivateImage','verifyPrivateImage'];
}
function checkImageReceipt(expected,received,owner,year) {
  if(received?.verifiedPrivateObject!==true||
     received.ownerId?.toLowerCase()!==owner||
     received.yearId!==year||received.path!==expected.path||
     received.sha256!==expected.sha256||received.bytes!==expected.bytes||received.mimeType!==expected.mimeType)
    throw INVALID('F09_CLOUD_IMAGE_READBACK_UNVERIFIED');
}
/**
 * Returned receipt means actual canonical verification by the injected service
 * adapter, not upload completion, commit 2xx, local Preview, or metadata alone.
 * No local draft baseline should be advanced on any throw.
 */
export async function executePreparedPortfolioSync({plan,images,documents,port}={}) {
  assertPreparedPortfolioPlan(plan);
  if(plan?.kind!=='RAKEEZ_F09_SYNC_PLAN_V1')
    throw INVALID('F09_CLOUD_PLAN_INVALID');
  if(!['LOCAL_READY_NO_SERVICE_DEPLOY','NO_CHANGE'].includes(plan.status))
    throw INVALID('F09_CLOUD_PLAN_NOT_READY');
  // Even an unchanged plan must still refer to the same local source.
  let files;
  try{files=await preparedPortfolioFiles(plan,{images,documents});}
  catch{throw INVALID('F09_CLOUD_ATTACHMENT_CHANGED');}
  if(plan.status==='NO_CHANGE')return verifyPortfolioCloudReadback(plan);
  const [stage,verify]=validatePort(port,plan.attachments.some(a=>a.mimeType==='application/pdf'));
  // Ensure no mutations begin when the local attachment set has changed since
  // the plan was built or a photo was deleted/altered.
  const confirmed=[];
  for(const [candidate,blob] of files){
    await port[stage]({
      scope:plan.scope,object:candidate,blob,mode:'create_immutable',
      upsert:false,
    });
    const proof=await port[verify]({
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
