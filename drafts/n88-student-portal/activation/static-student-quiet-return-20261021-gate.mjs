/** AI: fresh static-only custody gate. No provider call, upload or secret at import. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
export const STUDENT_QUIET_STATIC=Object.freeze({
 task:'continuous-n88-student-quiet-fast-return-20261021',run:'f2a49542-bb75-4ad1-bc15-4a8290010e74',
 session:'01a15e1e-7273-76d3-8830-0e850ed05f13',candidate:'ee7a8713ce6b912710c082b876aad4d2ee89d071',
 base:'c6e91a85035e2d5f9403f002ffd8254392df2d34',
 originalRoot:'C:/Users/Abody/Projects/RakeezX/.worktrees/continuous-n88-official-student-portal-activation-20261018',
 taskRoot:'C:/Users/Abody/Projects/RakeezX/.worktrees/continuous-n88-student-quiet-fast-return-20261021',
 authorization:'PO-20261021-N88-STUDENT-QUIET-RETURN-STATIC',
 priorCarrier:'6978352dfa73746a9c4a2cc85e822545483427d4834f172a04abb963f136068e',
 carrier:'a2308758f0611510f04f71cee50f69ffe35b936183d8d3e20847304adfb67091',
 style:'2a67b8c32793d52b4e2f5daff17ac72f6775235b7d4862495c0963c714c5e7f9',
 student:'c5c5101e41afc253f2dbd770c0ddf93cb0cd1f9bbcded9d2aa1d5154a7b1abe3',
 evidence:'tests/n88-student-quiet-fast-return-20261021/'
});
export const staticDigest=bytes=>createHash('sha256').update(bytes).digest('hex');
const check=(condition,suffix)=>assert(condition,'n88_student_static_'+suffix);
export function studentQuietStaticGate(card,run,activationId,lease){
 const c=STUDENT_QUIET_STATIC,a=card.preparationAuthority;
 check(card.id===c.task&&card.productId==='N88'&&['running','delivery'].includes(card.status)&&card.sessionId===c.session&&card.attempt?.runId===run&&run===c.run,'identity');
 check(card.activationId===activationId&&typeof activationId==='string'&&activationId.length>0,'activation');
 check(card.baseSha===c.base&&card.worktreePath?.replaceAll('\\','/').replace(/\/$/,'').toLowerCase()===c.taskRoot.toLowerCase(),'worktree_base');
 check(card.liveAuthorizationRef===c.authorization&&a?.kind==='PO-20261021-N88-student-opening-and-return-feedback'&&a.publication===true,'authorization');
 for(const k of ['realAccountReads','realStudentTeacherWrites','sqlAuthSchemaChanges','regionChanges','nativeDeployments','publicPinChanges','newReadinessRequests'])check(a[k]===0,'boundary_'+k);
 check(a.providerServiceOperations===undefined||a.providerServiceOperations===0,'boundary_providerServiceOperations');
 check(a.maxChangedPrivateStaticUploads===1&&a.appendOnlyAttemptHistory===true&&a.resetConsumedMarkers===false,'static_boundary');
 check(a.maxChangedStudentCarrierUploads===1&&a.originalCustodianRoot===c.originalRoot,'original_custodian_authority');
 assert.deepEqual(a.officialCloudflareConnection,{serverName:'rakeez_cloudflare',endpoint:'https://mcp.cloudflare.com/mcp',sameSavedSessionReadOnlyCapabilityRequired:true,noRawSecretToolArguments:true},'n88_student_static_official_connection');
 const token=card.status==='delivery'?card.deliveryOwner?.instanceId:run;
 check(!!token&&lease?.version===2&&lease.resource==='integration'&&lease.taskId===c.task&&lease.activationId===activationId&&lease.owner?.token===token&&lease.owner?.type===(card.status==='delivery'?'controller':'worker'),'lease');
 return c;
}
export function verifyStudentStaticArtifacts(prior,prepared,student,style){
 const c=STUDENT_QUIET_STATIC;
 check(staticDigest(prior)===c.priorCarrier&&staticDigest(prepared)===c.carrier&&staticDigest(student)===c.student&&staticDigest(style)===c.style,'artifact_hash');
 const parse=source=>{const prefix='var privateAssets = Object.freeze(',start=source.indexOf(prefix)+prefix.length,end=source.indexOf(');',start);check(start>=prefix.length&&end>start,'asset_block');return JSON.parse(source.slice(start,end));};
 const before=parse(prior.toString()),after=parse(prepared.toString()),key='/n88-private/assets/student.mjs',css='/n88-private/styles/student-portal-login.css';
 assert.deepEqual(Object.keys(before),Object.keys(after));
 for(const name of Object.keys(before))if(name!==key&&name!==css)assert.deepEqual(before[name],after[name]);
 check(Buffer.from(after[key].base64,'base64').equals(Buffer.from(student)),'student_bytes');
 check(Buffer.from(after[css].base64,'base64').equals(Buffer.from(style)),'style_bytes');
 for(const name of [key,css])assert.deepEqual(Object.keys(after[name]),Object.keys(before[name]));
 for(const name of [key,css])check(after[name].type===before[name].type,'asset_type');
 check(prepared.toString().replace(after[key].base64,before[key].base64).replace(after[css].base64,before[css].base64)===prior.toString(),'non_static_bytes');
}
/** The original custodian supplies owned DPAPI/file/CLI ports. Test ports are synthetic.
 * No deploy/SQL/Auth/set-secret capability is accepted by this function. */
export async function runStudentQuietStaticPhase(action,{card,run,activationId,lease,read,writeExclusive,load,save,readPublicPin,readNative,verifyCandidate,now=Date.now}){
 const c=studentQuietStaticGate(card,run,activationId,lease);
 check(['owned-preflight','read-native-before','read-native-after','preflight','begin','complete'].includes(action),'action');
 await verifyCandidate(c.candidate);
 const json=async name=>JSON.parse((await read(name)).toString().replace(/^\uFEFF/,''));
 const stampName='student-quiet-static-'+c.candidate+'-attempt.json',completeName='student-quiet-static-'+c.candidate+'-complete.json';
 const absent=async name=>{try{await read('owned/'+name);check(false,'attempt_consumed');}catch(e){if(e.code!=='ENOENT')throw e;}};
 const state=await load();
 check(state.directVerified===true&&!state.directAuthRefused&&!state.loginDisarmed&&/^[a-f0-9]{64}$/.test(state.directSource||''),'original_native_state');
 const native=state.directSource;
 check(await readPublicPin()===staticDigest(native),'public_pin');
 verifyStudentStaticArtifacts(await read('prior-carrier.mjs'),await read('carrier.mjs'),await read('student.mjs'),await read('style.css'));
 if(action==='read-native-before'||action==='read-native-after'){
  if(action==='read-native-before'){await absent(stampName);await absent(completeName);}
  else{const stamp=await json('owned/'+stampName);check(stamp.runId===run&&stamp.native===native&&stamp.source===c.carrier,'native_readback_attempt');}
  check(typeof readNative==='function','native_readback_port');
  const result=await readNative(action==='read-native-before'?'before':'after',native);
  check(result.nativeSource===native&&result.sourceExact===true&&Number.isInteger(result.nativeVersion)&&result.nativeVersion>0,'native_provider_source');
  return {status:'PASS',taskId:c.task,runId:run,preparedCandidate:c.candidate,...result,providerWrites:0,readinessRequests:0};
 }
 if(action==='owned-preflight'){
  await absent(stampName);await absent(completeName);
  const history=state.carrierCorrections??[];check(Array.isArray(history),'history');
  check(!history.some(h=>h.taskId===c.task&&h.preparedCandidate===c.candidate),'history_consumed');
  return {status:'PASS',taskId:c.task,runId:run,preparedCandidate:c.candidate,nativeSource:native,publicPinMatches:true,originalOwner:true,attemptAvailable:true,providerWrites:0,readinessRequests:0};
 }
 const pre=await json('provider-preflight.json');
 const identity=r=>check(r.taskId===c.task&&r.runId===run&&r.preparedCandidate===c.candidate,'receipt_identity');
 const fresh=r=>{const at=Date.parse(r.observedAt),age=now()-at;check(Number.isFinite(at)&&age>=-30000&&age<=15*60*1000,'receipt_freshness');};
 identity(pre);if(action!=='complete')fresh(pre);
 check(pre.officialServer==='rakeez_cloudflare'&&pre.savedSession===c.session&&pre.sameSavedSessionReadOnlyCapabilityVerified===true,'official_saved_session');
 check(pre.nativeSource===native&&Number.isInteger(pre.nativeVersion)&&pre.nativeVersion>0&&typeof pre.carrierVersion==='string'&&pre.carrierVersion.length>0&&pre.carrierPercentage===100,'native_preimage');
 check(staticDigest(await read('provider-native.mjs'))===native&&staticDigest(await read('provider-preimage.mjs'))===c.priorCarrier,'provider_preimage_bytes');
 check(pre.settings&&pre.routes&&pre.subdomain,'configuration_preimage');
 const expectedConfiguration=await json('configuration-preimage.json');
 for(const key of ['settings','routes','subdomain'])assert.deepEqual(pre[key],expectedConfiguration[key],'n88_student_static_configuration_preimage');
 const history=state.carrierCorrections??[];check(Array.isArray(history),'history');
 const binding={taskId:c.task,runId:run,preparedCandidate:c.candidate,source:c.carrier,prior:c.priorCarrier,native,nativeVersion:pre.nativeVersion,priorVersion:pre.carrierVersion,preflightDigest:staticDigest(JSON.stringify(pre))};
 if(action!=='complete'){
  await absent(stampName);await absent(completeName);
  check(!history.some(h=>h.taskId===c.task&&h.preparedCandidate===c.candidate),'history_consumed');
  if(action==='preflight')return {status:'PASS',...binding,providerWrites:0,readinessRequests:0};
  const stamp={...binding,historyDigest:staticDigest(JSON.stringify(history)),reservedAt:new Date(now()).toISOString(),maxUploads:1};
  await writeExclusive('owned/'+stampName,JSON.stringify(stamp)+'\n');
  return {status:'PASS',...binding,attemptReserved:true,maxUploads:1};
 }
 const stamp=await json('owned/'+stampName);
 for(const [k,v]of Object.entries(binding))check(stamp[k]===v,'attempt_binding');
 check(stamp.maxUploads===1,'attempt_budget');
 const reservationTime=Date.parse(stamp.reservedAt),preflightTime=Date.parse(pre.observedAt);
 check(Number.isFinite(reservationTime)&&reservationTime>=preflightTime-30000&&reservationTime-preflightTime<=15*60*1000&&reservationTime<=now()+30000,'reservation_time');
 let recordedComplete;try{recordedComplete=await json('owned/'+completeName);}catch(e){if(e.code!=='ENOENT')throw e;}
 const receipt=await json('carrier-readback.json');identity(receipt);if(!recordedComplete)fresh(receipt);
 check(Date.parse(receipt.observedAt)>=reservationTime-30000,'readback_time');
 check(receipt.source===c.carrier&&typeof receipt.version==='string'&&receipt.version.length>0&&receipt.version!==pre.carrierVersion&&receipt.carrierPercentage===100&&receipt.uploads===1,'carrier_readback_identity');
 check(staticDigest(await read('provider-carrier.mjs'))===c.carrier,'carrier_readback_bytes');
 check(receipt.nativeSource===native&&receipt.nativeVersion===pre.nativeVersion,'native_unchanged');
 check(staticDigest(await read('provider-native-after.mjs'))===native,'native_readback_bytes');
 for(const key of ['settings','routes','subdomain'])assert.deepEqual(receipt[key],pre[key],'n88_student_static_configuration_changed');
 check(receipt.servedUrl==='https://rakeezx.com/n88-private/assets/student.mjs'&&receipt.servedStatus===200&&receipt.servedType==='text/javascript','served_identity');
 check(receipt.servedHeaders?.noStore===true&&receipt.servedHeaders?.noReferrer===true&&receipt.servedHeaders?.nosniff===true,'served_privacy');
 check(staticDigest(await read('served-student.mjs'))===c.student,'served_bytes');
 check(receipt.servedStyleUrl==='https://rakeezx.com/n88-private/styles/student-portal-login.css'&&receipt.servedStyleStatus===200&&receipt.servedStyleType==='text/css','served_style_identity');
 check(receipt.servedStyleHeaders?.noStore===true&&receipt.servedStyleHeaders?.noReferrer===true&&receipt.servedStyleHeaders?.nosniff===true,'served_style_privacy');
 check(staticDigest(await read('served-style.css'))===c.style,'served_style_bytes');
 const completed={...stamp,version:receipt.version,readbackDigest:staticDigest(JSON.stringify(receipt))};
 const entry={...binding,version:receipt.version};
 const existing=history.find(h=>h.taskId===c.task&&h.preparedCandidate===c.candidate);
 if(existing){assert.deepEqual(existing,entry);assert.deepEqual(await json('owned/'+completeName),completed);return {status:'PASS',sourceExact:true,servedAssetExact:true,alreadyRecorded:true};}
 check(staticDigest(JSON.stringify(history))===stamp.historyDigest,'history_changed');
 // An interrupted save can resume this exact verified completion, never upload again.
 if(recordedComplete)assert.deepEqual(recordedComplete,completed);else await writeExclusive('owned/'+completeName,JSON.stringify(completed)+'\n');
 state.carrierCorrections=[...history,entry];await save(state);
 return {status:'PASS',sourceExact:true,servedAssetExact:true,historyAppended:true,nativePinUnchanged:true};
}
