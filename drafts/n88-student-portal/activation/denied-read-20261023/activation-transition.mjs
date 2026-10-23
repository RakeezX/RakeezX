/** AI: one-use successor sequence through original custodian ports; no automatic retry. */
import {taskId,priorSource,successorSource,qualifyReservation,qualifyNativePreflight,qualifyConfigurationDelta} from './transition-guards.mjs';
const deny=c=>{throw Error('n88_denied_activation_'+c);};
export async function runSuccessorTransition({stamp,certificates,ports,versionProof}){
 let uploadInvoked=false,pinInvoked=false,before=null,after=null,configuration=null,state=null;
 const readConfig=async expectedPin=>{
  await ports.verifyCommittedPhase();await ports.verifyExclusivePhase();
  const proof=await ports.readQualifiedMetadata(expectedPin,certificates);
  if(configuration&&(proof.currentNonPinDigest!==configuration.currentNonPinDigest||proof.keysetDigest!==configuration.keysetDigest))deny('concurrent_configuration_change');
  return proof;
 };
 try{
  // A verified committed phase is required before even the first provider call.
  await ports.verifyCommittedPhase();await ports.verifyExclusivePhase();
  state=await ports.load();
  qualifyReservation({state,history:state.sourceCorrections??[],markerExists:await ports.uploadMarkerExists()});
  configuration=await readConfig(priorSource);
  before=await ports.readNative(priorSource);
  qualifyNativePreflight({native:before,configuration,versionProof});
  await ports.verifyExclusivePhase();await ports.verifyCommittedPhase();
  const record={...stamp,purpose:'qualified request-local failed-read session preservation',priorSource,source:successorSource,uploadAttempted:true,pinAttempted:false};
  await ports.reserveUpload(record); // exclusive wx marker precedes the invocation
  state.deniedReadTransitions=[...(state.deniedReadTransitions??[]),record];await ports.save(state);
  uploadInvoked=true;await ports.uploadExactSuccessor();
  after=await ports.readNative(successorSource);
  if(after.version<=before.version||after.status!=='ACTIVE'||after.downloadedBytesExact!==true||after.importMapExact!==true||after.verifyJwt!==false||after.importMapDigest!==before.importMapDigest)deny('uploaded_source_readback');
  await readConfig(priorSource);await ports.verifyExclusivePhase();
  await ports.reservePin({...record,pinAttempted:true,nativeVersion:after.version});
  state.deniedReadTransitions.at(-1).pinAttempted=true;await ports.save(state);
  pinInvoked=true;await ports.setExactPublicPin();
  const finalNative=await ports.readNative(successorSource),finalConfiguration=await readConfig(successorSource);
  if(![after.version,after.version+1].includes(finalNative.version)||finalNative.status!=='ACTIVE'||finalNative.verifyJwt!==false||!finalNative.downloadedBytesExact||!finalNative.importMapExact||finalNative.importMapDigest!==before.importMapDigest)deny('final_native_identity');
  state.directSource=successorSource;
  state.sourceCorrections=[...(state.sourceCorrections??[]),{...stamp,prior:priorSource,source:successorSource,nativeVersion:finalNative.version}];
  Object.assign(state.deniedReadTransitions.at(-1),{verified:true,nativeVersion:finalNative.version,verifiedAt:new Date().toISOString()});await ports.save(state);
  return {...stamp,status:'PASS',provider:{...finalNative,...finalConfiguration},uploadedVersion:after.version,pinVersionAdvance:finalNative.version-after.version,uploadInvoked,pinInvoked,nativeUploads:1,pinUpdates:1,providerWrites:2,oldHistoriesPreserved:true,catalogHistoryEvidenceReused:true,migrations:0,carrierUploads:0,realAccountReads:0,actualUserAcceptance:'NOT_RUN'};
 }catch(e){
  return {...stamp,status:'BLOCKED',code:/^n88_[a-zA-Z0-9_]+$/.test(e.message)?e.message:'n88_denied_activation_private_failure',uploadInvoked,pinInvoked,automaticRetryAllowed:false,unknownOutcomeRequiresReadOnlyReconciliation:uploadInvoked||pinInvoked,beforeNativeVersion:before?.version??null,observedSuccessorVersion:after?.version??null,migrations:0,carrierUploads:0,realAccountReads:0,actualUserAcceptance:'NOT_RUN'};
 }
}
export async function reconcileSuccessor({stamp,certificates,ports}){
 // Read-only operation. It never clears markers, changes state or completes a pin.
 await ports.verifyCommittedPhase();await ports.verifyExclusivePhase();
 const native=await ports.readNativeIdentity();
 if(![priorSource,successorSource].includes(native.source))deny('reconcile_unknown_source');
 const metadata=await ports.readMetadata();
 const candidates=[];
 for(const pin of [priorSource,successorSource])try{candidates.push(ports.qualifyObservedMetadata(metadata,pin));}catch{}
 if(candidates.length!==1)deny('reconcile_configuration');
 return {...stamp,status:'READ_ONLY_RECONCILED',provider:{...native,...candidates[0]},newProviderWrites:0,markersPreserved:true,automaticRetryAllowed:false,taskId};
}
