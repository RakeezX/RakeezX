import {finiteScope,finiteActive,finiteGuards} from './core-teacher-scheduler.mjs';
import {CURRENT_INSPECTION,inspectionApproval,inspectionRequest,inspectCurrent} from './activation/current-hosted-inspection.mjs';
/** AI: concrete private DB/Auth/context/events/delivery composition. No hosted operation. */
import {supportedSessionPolicy,policySessionRevision} from './session-policy.mjs';
import {randomUUID,createHmac} from 'node:crypto';
import {createTeacherVerifier} from './auth-verifier.mjs';
import {createPostgresRepository} from './postgres-repository.mjs';
import {createRegistrationBoundary} from './registration.mjs';
import {createDeliveryBoundary,quietNow} from './delivery.mjs';
import {normalizePushPayload} from '../../src/lib/notification-push-core.js';
import {readSource,sourcePayload} from './canonical-source.mjs';
import {id,record,uuid,LIMITS} from './shared.mjs';
import {deviceApproval,publicDeviceConfiguration,oneDeviceGuard,admitDeviceRegistration,classifyDeviceRegistration} from './one-device-test.mjs';
import {DISPOSAL,DISPOSITION,disposalApproval,disposalRequest,disposeExactHosted} from './activation/hosted-disposal.mjs';
import {taggedConnectionCategory} from './runtime-failure.mjs';
import {pruneExpiredAdmission} from './expired-admission.mjs';
import {createAttemptTrace} from './attempt-trace.mjs';
import {createMobileTrialPreparation} from './mobile-trial.inactive.mjs';
const fail=()=>{throw Error('n44_unavailable');};
const exact=(v,keys)=>{if(!record(v,keys))fail();};
export function createBackend({acquire,authUrl,apiKey,fetch,providerOrigins,crypto,rateKey,deliveryEnabled=false,finiteScheduler=null,deviceTest=null,operatorDisposal=null,currentInspection=null,mobileTrial=null,mobileGrantSha256=null,publicVapidKey=null,sessionPolicy,serviceSourceSha,now=Date.now}) {
 if(!supportedSessionPolicy(sessionPolicy,now(),serviceSourceSha))fail();
 const policy=Object.freeze(structuredClone(sessionPolicy));
 const finite=finiteScheduler===null?null:finiteScope(finiteScheduler),finiteGuard=finite&&finiteGuards(finite);
 if(finite&&(deliveryEnabled||deviceTest||operatorDisposal||currentInspection||mobileTrial))fail();
 if(mobileTrial&&(deliveryEnabled||deviceTest||operatorDisposal||currentInspection))fail();
 const mobile=mobileTrial?createMobileTrialPreparation({trustedGrant:mobileTrial,expectedGrantSha256:mobileGrantSha256,serviceSourceSha,policyApprovalId:policy.approvalId}):null;
 const testApproval=deviceTest&&structuredClone(deviceTest);
 // Fourth authority is source-bound in trusted config; no browser-selected pin.
 if([3,4,5,6].includes(testApproval?.currentRequest?.v)&&testApproval.currentRequest.serviceSourceSha!==serviceSourceSha)fail();
 const inspection=currentInspection&&structuredClone(currentInspection),inspectionPermits=new WeakSet();
 const disposal=operatorDisposal&&structuredClone(operatorDisposal),disposalPermits=new WeakSet();
 const verify=createTeacherVerifier({authUrl,apiKey,fetch,now});
 // Repository beforeCommit precedes its typed write flush. Fence the actual
 // durable COMMIT too, without changing the historic transaction/SQL codec.
 const mobileAcquire=async signal=>{const c=await acquire();return {
  query(sql,values){if(sql==='commit'){if(signal?.aborted)fail();mobile.assertBeforeCommit(now());}return c.query(sql,values);},
  release:error=>c.release(error)
 };};
 async function transaction(work,signal) {
  const c=await acquire();let committed=false;
  const until=now()+12000,guards=[];
  const fence=()=>{if(signal?.aborted || now()>=until || !supportedSessionPolicy(policy,now(),serviceSourceSha))fail();};
  const query=async(...args)=>{fence();const r=await c.query(...args);fence();return r;};
  try {
   await query('begin');await query("set local statement_timeout='3000ms'");await query("set local lock_timeout='1000ms'");
   await query("set local idle_in_transaction_session_timeout='15000ms'");await query('set local synchronous_commit=on');
   const result=await work({query,beforeCommit:f=>guards.push(f)},c);
   for(const g of guards)await g();fence();await c.query('commit');committed=true;return result;
  } finally {if(!committed)await c.query('rollback').catch(()=>{});c.release();}
 }
 async function prepare(c,owner,state,signal) {
  const q=async(...args)=>{if(signal?.aborted)fail();const r=await c.query(...args);if(signal?.aborted)fail();return r;},events=new Map();
  for(const ctx of state.contexts.values())if(ctx.active){
   const live=await q('select user_id,session_id,not_after_ms from n44_push_draft.lock_current_session($1::uuid,$2::uuid)',[owner,ctx.sessionId]);
   if(live.rows.length!==1 || ctx.sessionExpiresAt<=now() || ctx.sessionRevision!==policySessionRevision(ctx.sessionId,policy))ctx.active=false;
   else if(live.rows[0].not_after_ms!==null)ctx.sessionExpiresAt=Math.min(ctx.sessionExpiresAt,Number(live.rows[0].not_after_ms));
  }
  const stored=await q('select * from n44_push_draft.events where owner_id=$1 order by workspace_id,device_id,event_id limit 101',[owner]);
  if(stored.rows.length>100)fail();
  const cache=new Map();
  for(const e of stored.rows){
   if(finite&&!finite.targets.some(t=>t.workspaceId===e.workspace_id&&t.deviceId===e.device_id&&t.eventId===e.event_id&&t.sourceKind===e.source_kind&&t.sourceId===e.source_id&&t.sourceStamp===e.source_stamp))continue;
   const ctx=state.contexts.get(JSON.stringify([e.workspace_id,e.device_id]));if(!ctx?.active)continue;
   const key=JSON.stringify([e.source_kind,e.source_id,ctx.preferences]);
   if(!cache.has(key))cache.set(key,await readSource(q,owner,e.source_kind,e.source_id,ctx.preferences));
   const fresh=cache.get(key);if(fresh?.stamp===e.source_stamp){const candidate=fresh.events.find(x=>x.id===e.event_id);if(candidate)events.set(JSON.stringify([e.workspace_id,e.device_id,e.event_id]),candidate);}
  }
  return {sourceEvent(r,eventId,time){return sourcePayload(events.get(JSON.stringify([r.workspaceId,r.deviceId,eventId])),time);},
   async beforeCommit(){for(const ctx of state.contexts.values())if(ctx.active){
    if(ctx.sessionExpiresAt<=now())fail();
    const live=await q('select user_id,session_id,not_after_ms from n44_push_draft.lock_current_session($1::uuid,$2::uuid)',[owner,ctx.sessionId]);if(live.rows.length!==1)fail();
   }}};
 }
 const makeDelivery=(signal,oneDevice=false,trace=null,finiteTick=false)=>{
  const fence=()=>{if(mobile)mobile.assertBeforeCommit(now());if(signal?.aborted||!supportedSessionPolicy(policy,now(),serviceSourceSha)||oneDevice&&[3,4,5,6].includes(testApproval?.currentRequest?.v)&&!deviceApproval(testApproval,now()))fail();};
  const repository=createPostgresRepository({acquire:mobile?()=>mobileAcquire(signal):acquire,prepare:async(...args)=>{fence();const extension=await prepare(...args,signal);fence();return {...extension,async beforeCommit(){await extension.beforeCommit?.();fence();}};}});
  const deliveryPorts={repository,clock:now,envelope:true,trace,...(finiteTick?{beforePermit:finiteGuard.beforePermit,maxAttempts:1,bindingExpiresAt:finite.hardEnd}:{}),...(oneDevice?{beforePermit:oneDeviceGuard(testApproval),maxAttempts:1,bindingExpiresAt:testApproval.expiresAt}:{}),recompute:(tx,r,event,time)=>tx.sourceEvent(r,event,time),sender:{send(permit){if(signal?.aborted||finiteTick&&!finiteActive(finite,now())||oneDevice&&!deviceApproval(testApproval,now()))return 'uncertain';return crypto.sender.send(permit,{signal,trace});}}};
  return mobile?mobile.compose({deliveryPorts}).delivery:createDeliveryBoundary(deliveryPorts);
 };
 // Both roles use a shared durable atomic upsert; raw IP/owner never used as rate keys.
 async function take(query,kind,key,limit) {
  const bucket=Math.floor(now()/60000),hash=createHmac('sha256',rateKey).update(JSON.stringify([kind,key])).digest('hex');
  // Per-kind advisory key serializes bounded rate-key admission across instances.
  await query('select pg_advisory_xact_lock(44001,hashtext($1))',[kind]);
  let keys=await query('select key from n44_push_draft.ingress_rates where kind=$1 limit 2049',[kind]);
  if(keys.rows.length>=2048&&!keys.rows.some(r=>r.key===hash)){await pruneExpiredAdmission(query,'rate',now());keys=await query('select key from n44_push_draft.ingress_rates where kind=$1 limit 2049',[kind]);}
  if(keys.rows.length>=2048&&!keys.rows.some(r=>r.key===hash))return false;
  const r=await query(`insert into n44_push_draft.ingress_rates(key,bucket,count,expires_at_ms,kind) values($1,$2,1,$3,$5)
   on conflict(key) do update set bucket=excluded.bucket,count=case when ingress_rates.bucket=excluded.bucket then ingress_rates.count+1 else 1 end,expires_at_ms=excluded.expires_at_ms
   where ingress_rates.bucket<>excluded.bucket or ingress_rates.count<$4 returning count`,[hash,bucket,(bucket+1)*60000,limit,kind]);
  return r.rows.length===1;
 }
 return Object.freeze({
 async ingress(e,signal) {
  const current=e.boundOperation===CURRENT_INSPECTION,bound=e.boundOperation!==undefined,a=bound?(current?inspectionApproval(inspection,serviceSourceSha,now()):disposalApproval(disposal,serviceSourceSha,now())):null;
  if(inspection&&e.kind==='scheduler'&&!current)return false;
  if(current&&(deliveryEnabled||deviceTest||operatorDisposal||!inspectionRequest(a,{operation:e.boundOperation,cursor:e.boundCursor,limit:e.boundLimit},e.nonce)))return false;
  if(bound&&!current&&(deliveryEnabled||!disposalRequest(a,{operation:e.boundOperation,cursor:e.boundCursor,limit:e.boundLimit},e.nonce)))return false;
  return transaction(async({query})=>{
  if(Math.abs(now()-Number(e.time)*1000)>15000)return false;
  if(current){const db=await query('select floor(extract(epoch from clock_timestamp())*1000)::bigint::text as now_ms');if(!inspectionApproval(a,serviceSourceSha,Number(db.rows?.[0]?.now_ms)))return false;}
  const scope=e.kind==='scheduler'?'scheduler':'teacher';
  // Dedicated scheduler capacity keeps bounded cleanup available under public saturation.
  await query('select pg_advisory_xact_lock(44002,hashtext($1))',[scope]);
  let entries=await query('select nonce from n44_push_draft.ingress_nonces where scope=$1 limit $2',[scope,scope==='teacher'?4097:129]);
  if(entries.rows.length>=(scope==='teacher'?4096:128)){await pruneExpiredAdmission(query,'nonce',now());entries=await query('select nonce from n44_push_draft.ingress_nonces where scope=$1 limit $2',[scope,scope==='teacher'?4097:129]);}
  if(entries.rows.length>=(scope==='teacher'?4096:128))return false;
  const r=await query('insert into n44_push_draft.ingress_nonces(nonce,scope,expires_at_ms) values($1,$2,$3) on conflict do nothing returning nonce',[e.nonce,scope,bound&&(current||e.boundOperation===DISPOSAL)?a.expiresAt:Number(e.time)*1000+16000]);
  const accepted=r.rows.length===1 && (scope==='scheduler'?await take(query,'scheduler','n44',30):await take(query,'global','n44',3000) && await take(query,'peer',e.source,60));
  if(accepted&&bound){const permit=Object.freeze({operation:e.boundOperation,cursor:e.boundCursor});(current?inspectionPermits:disposalPermits).add(permit);return permit;}
  return accepted;
 },signal);},
 async teacher(path,authorization,body,signal) {
  if(inspection&&(path==='/push/register'||path==='/context/update'&&body?.pushConsent!==false))return {status:'disabled'};
  // Debit authenticated owner separately so rejected work cannot roll back its rate.
  return transaction(async(ports,c)=>{
   const verified=await verify(authorization,signal,ports);if(!verified)return {status:'rejected'};
   const auth={...verified,sessionRevision:policySessionRevision(verified.sessionId,policy)};
   // Discovery may precede consent; every activating operation remains privately scoped.
   if(mobile&&(path==='/push/register'||path==='/context/update'&&body?.pushConsent!==false||path.startsWith('/events/'))){
    if(!mobile.allowsScope(auth.ownerId,body,now()))return {status:'disabled'};
    ports.beforeCommit(()=>mobile.assertBeforeCommit(now()));
   }
   const allowed=await transaction(({query})=>take(query,'owner',auth.ownerId,30),signal);if(!allowed)return {status:'limited'};
   // Existing repository commits a SAVEPOINT; outer Auth locks survive until durable response.
   const local=createPostgresRepository({acquire:async()=>({
    query(text,values){return text.startsWith('begin')?ports.query('savepoint n44_owner'):text==='commit'?ports.query('release savepoint n44_owner'):text==='rollback'?ports.query('rollback to savepoint n44_owner'):ports.query(text,values);},release(){}
   })});
   const scope=b=>{if(!id(b.workspaceId)||!id(b.deviceId))fail();};
   if(path==='/push/config') {
    exact(body,['workspaceId','deviceId']);scope(body);
    if(deliveryEnabled)return {status:'disabled'};
    if(mobile)return local.atomic(auth.ownerId,tx=>mobile.publicConfiguration(tx,auth,body,publicVapidKey,tx.time(now())));
    const configuration=publicDeviceConfiguration(testApproval,auth.ownerId,body,publicVapidKey,serviceSourceSha,now());
    if(configuration.status!=='ready')return configuration;
    const eligible=await local.atomic(auth.ownerId,tx=>classifyDeviceRegistration(tx,auth,body,testApproval,tx.time(now()),{preview:true}).allowed);
    return eligible?configuration:{status:'disabled'};
   }
   if(path.startsWith('/push/')) {
    if(path==='/push/register'&&!deliveryEnabled&&!testApproval&&!mobile?.configured)return {status:'disabled'};
    let admitRegistration;
    if(path==='/push/register'&&testApproval) {
     const a=deviceApproval(testApproval,now());
     if(!a||auth.ownerId!==a.ownerId||body.workspaceId!==a.workspaceId||body.deviceId!==a.deviceId)return {status:'disabled'};
     if([3,4,5,6].includes(a.currentRequest?.v))ports.beforeCommit(()=>{if(!deviceApproval(a,now()))fail();});
     // Preserve all identities, including tombstones, under the same owner lock
     // as registration. A separate full snapshot wastes15 serial roundtrips.
     admitRegistration=(tx,principal,request)=>admitDeviceRegistration(tx,principal,request,a,now());
    }
    if(path==='/push/revoke') {
     exact(body,['registrationId','workspaceId','deviceId']);scope(body);if(!uuid(body.registrationId))fail();
     // A fresh session may acknowledge an already retired ORIGINAL identity,
     // never remove an active registration belonging to another session.
     const retired=await local.atomic(auth.ownerId,tx=>{const r=tx.get('registrations',body.registrationId);
      return r && r.workspaceId===body.workspaceId&&r.deviceId===body.deviceId&&r.state!=='active';});
     if(retired)return {status:'revoked'};
    }
    const registrationPorts={verifySession:async()=>auth,repository:local,protect:crypto.protect,clock:now,approvedOrigins:providerOrigins,receipt:true,failureProjection:true,admitRegistration};
    const registration=mobile?mobile.compose({registrationPorts}).registration:createRegistrationBoundary(registrationPorts);
    return registration[path.endsWith('/register')?'register':'revoke'](null,body);
   }
   if(path==='/context/read'){
    exact(body,['workspaceId','deviceId']);scope(body);
    return local.atomic(auth.ownerId,tx=>{const ctx=tx.context(body.workspaceId,body.deviceId);if(ctx?.sessionId!==auth.sessionId||ctx.sessionRevision!==auth.sessionRevision||!ctx.active||ctx.sessionExpiresAt<=now())return {status:'absent',protocol:'n44-browser-v2',expectedRevision:ctx?.consentRevision??null};
     const r=tx.rows('registrations').find(r=>r.workspaceId===body.workspaceId&&r.deviceId===body.deviceId&&r.sessionRevision===auth.sessionRevision&&r.consentRevision===ctx.consentRevision&&r.state==='active'&&r.expiresAt>now());
     return {status:'current',protocol:'n44-browser-v2',context:ctx,registration:r?{registrationId:r.registrationId,expiresAt:r.expiresAt}:null};});
   }
   if(path==='/context/update'){
    exact(body,['workspaceId','deviceId','expectedRevision','preferences','pushConsent']);scope(body);if(typeof body.pushConsent!=='boolean')fail();
    return local.writeContexts(auth.ownerId,tx=>{
     const previous=tx.context(body.workspaceId,body.deviceId);
     if((previous?.consentRevision??null)!==body.expectedRevision)return {status:'stale'};
     const ctx={workspaceId:body.workspaceId,deviceId:body.deviceId,active:true,sessionId:auth.sessionId,sessionRevision:auth.sessionRevision,
      sessionExpiresAt:Math.min(now()+LIMITS.registrationMs,auth.backgroundExpiresAt),consentRevision:randomUUID(),pushConsent:body.pushConsent,preferences:body.preferences};
     // Existing repository validates the complete approved timing/quiet schema.
     tx.set('contexts',JSON.stringify([body.workspaceId,body.deviceId]),ctx);
     // Context changes retire subscriptions immediately, even across A -> B -> A.
     for(const r of tx.rows('registrations'))if(r.state==='active'&&r.workspaceId===body.workspaceId&&r.deviceId===body.deviceId){
      tx.releaseEndpoint(r.fingerprint,r.registrationId);tx.set('registrations',r.registrationId,{...r,state:'revoked',sealed:null,fingerprint:null,bindingFingerprint:null});}
     return {status:'updated',context:ctx};
    });
   }
   if(path==='/events/authorize') {
    exact(body,['workspaceId','deviceId','consentRevision','registrationId','event']);scope(body);
    const event=normalizePushPayload(body.event,now());if(!event)return {status:'rejected'};
    let context;
    await local.atomic(auth.ownerId,tx=>{
     const ctx=tx.context(body.workspaceId,body.deviceId);
     if(!ctx?.active||ctx.sessionId!==auth.sessionId||ctx.sessionRevision!==auth.sessionRevision||ctx.sessionExpiresAt<=now()||
       !ctx.pushConsent||ctx.consentRevision!==body.consentRevision||ctx.preferences[event.kind]!==true||quietNow(ctx.preferences,now())!==false)fail();
     if(!tx.rows('registrations').some(r=>r.registrationId===body.registrationId&&r.workspaceId===body.workspaceId&&r.deviceId===body.deviceId&&r.sessionId===auth.sessionId&&
       r.sessionRevision===auth.sessionRevision&&r.consentRevision===ctx.consentRevision&&r.state==='active'&&r.expiresAt>now()))fail();
     context=ctx;
    });
    const stored=await ports.query('select * from n44_push_draft.events where owner_id=$1 and workspace_id=$2 and device_id=$3 and event_id=$4',
      [auth.ownerId,body.workspaceId,body.deviceId,event.id]);
    const row=stored.rows[0];if(!row)return {status:'rejected'};
    const fresh=await readSource(ports.query,auth.ownerId,row.source_kind,row.source_id,context.preferences);
    const payload=sourcePayload(fresh?.stamp===row.source_stamp?fresh.events.find(e=>e.id===event.id):null,now());
    return {status:payload&&['id','kind','expiresAt','actionPath'].every(k=>payload[k]===event[k])?'authorized':'rejected'};
   }
   if(path==='/events/update') {
    exact(body,['workspaceId','deviceId','kind','sourceId','expectedStamp']);scope(body);if(!['lesson','due'].includes(body.kind)||!id(body.sourceId)||body.expectedStamp!==null&&!/^[a-f0-9]{64}$/.test(body.expectedStamp))fail();
    let context;
    await local.atomic(auth.ownerId,tx=>{const ctx=tx.context(body.workspaceId,body.deviceId);if(!ctx?.active||ctx.sessionId!==auth.sessionId||ctx.sessionRevision!==auth.sessionRevision||ctx.sessionExpiresAt<=now())fail();context=ctx;});
    // Owner row remains locked by outer transaction; canonical keys lock through commit.
    const q=ports.query,source=await readSource(q,auth.ownerId,body.kind,body.sourceId,context.preferences);
    const old=await q('select distinct source_stamp from n44_push_draft.events where owner_id=$1 and workspace_id=$2 and device_id=$3 and source_kind=$4 and source_id=$5',[auth.ownerId,body.workspaceId,body.deviceId,body.kind,body.sourceId]);
    if(old.rows.length && old.rows.some(r=>r.source_stamp!==body.expectedStamp))return {status:'stale',sourceStamp:old.rows.length===1?old.rows[0].source_stamp:null};
    if(!old.rows.length&&body.expectedStamp!==null)return {status:'stale',sourceStamp:null};
    await q('delete from n44_push_draft.events where owner_id=$1 and workspace_id=$2 and device_id=$3 and source_kind=$4 and source_id=$5',[auth.ownerId,body.workspaceId,body.deviceId,body.kind,body.sourceId]);
    let inserted=0;
    for(const e of source?.events??[]){if(e.expiresAt<=now())continue;
     const {dueAt,...payload}=e;await q('insert into n44_push_draft.events values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[auth.ownerId,body.workspaceId,body.deviceId,e.id,body.kind,body.sourceId,source.stamp,dueAt,e.expiresAt,payload]);inserted++;}
    const count=await q('select event_id from n44_push_draft.events where owner_id=$1 limit 101',[auth.ownerId]);if(count.rows.length>100)fail();
    return {status:'updated',sourceStamp:inserted?source.stamp:null};
   }
   return {status:'rejected'};
  },signal);
 },
 async schedule({operation,cursor=null,limit=25},signal,permit) {
  if(finite) {
   if(deliveryEnabled||operation!=='finite-due'||cursor!==null||limit!==1||!finiteActive(finite,now()))return {status:'disabled'};
   const repository=createPostgresRepository({acquire});
   const claimed=await repository.atomic(finite.ownerId,tx=>finiteGuard.tick(tx,tx.time(now())));
   if(!claimed)return {status:'completed',count:0,cursor:null};
   const outcomes=[];
   for(const t of finite.targets){
    if(signal?.aborted||!finiteActive(finite,now()))break;
    const rows=await transaction(({query})=>query('select * from n44_push_draft.events where owner_id=$1 and workspace_id=$2 and device_id=$3 and event_id=$4',[finite.ownerId,t.workspaceId,t.deviceId,t.eventId]),signal);
    const e=rows.rows?.[0];
    if(!e||e.source_kind!==t.sourceKind||e.source_id!==t.sourceId||e.source_stamp!==t.sourceStamp||Number(e.due_at_ms)>now())continue;
    const payload=normalizePushPayload(e.payload,now());
    if(payload&&payload.id===t.eventId)outcomes.push((await makeDelivery(signal,false,null,true).deliver(finite.ownerId,t.registrationId,payload)).status);
   }
   return {status:'completed',count:outcomes.length,outcomes,cursor:null};
  }

  if(mobile){
   // The Web entry has already checked the signature, clock, nonce and rate admission.
   // No caller-supplied owner/device/source is accepted by this closed schedule shape.
   if(permit!==true||!mobile.configured||operation!=='one-device-test'||limit!==1)return {status:'disabled'};
   const fence=()=>{if(signal?.aborted)fail();mobile.assertBeforeCommit(now());};
   const repository=createPostgresRepository({acquire:()=>mobileAcquire(signal),prepare:async()=>({beforeCommit:fence})});
   const target=await repository.atomic(mobile.ownerId,tx=>mobile.targetForOperation(tx,{operation,cursor,limit},tx.time(now())));
   if(!target)return {status:'disabled'};
   const rows=await transaction(({query,beforeCommit})=>{beforeCommit(fence);return query('select * from n44_push_draft.events where owner_id=$1 and workspace_id=$2 and device_id=$3 and event_id=$4',
    [target.ownerId,target.workspaceId,target.deviceId,target.eventId]);},signal);
   const payload=normalizePushPayload(rows.rows?.[0]?.payload,now());
   if(!payload||payload.id!==target.eventId)return {status:'rejected'};
   return makeDelivery(signal).deliver(target.ownerId,target.registrationId,payload);
  }
  if(inspection&&operation!==CURRENT_INSPECTION)return {status:'disabled'};
  if(operation===CURRENT_INSPECTION){
   const a=inspectionApproval(inspection,serviceSourceSha,now());
   if(deliveryEnabled||deviceTest||operatorDisposal||!a||cursor!==a.approvalId||limit!==1||!permit||!inspectionPermits.has(permit)||permit.operation!==operation||permit.cursor!==cursor)return {status:'disabled'};
   inspectionPermits.delete(permit);let rollbackAck=false,observed;
   const repository=createPostgresRepository({acquire:async()=>{const c=await acquire();return{query:async(sql,values)=>{if(sql==='commit')throw Error('n44_inspection_commit_denied');try{const r=await c.query(sql,values);if(sql==='rollback')rollbackAck=true;return r;}catch{throw Error('n44_inspection_no_retry');}},release:e=>c.release(e)};},prepare:async()=>({beforeCommit(){throw Error('n44_inspection_readonly_rollback');}})});
   await repository.writeContexts(a.ownerId,tx=>{observed=inspectCurrent(tx,a);return observed;}).catch(()=>{});
   return observed&&rollbackAck?observed:{status:'unavailable'};
  }
  if([DISPOSAL,DISPOSITION].includes(operation)){
   const a=disposalApproval(disposal,serviceSourceSha,now());
   if(deliveryEnabled||!a||cursor!==a.approvalId||limit!==1||!permit||!disposalPermits.has(permit)||permit.operation!==operation||permit.cursor!==cursor)return {status:'disabled'};
   disposalPermits.delete(permit);
   let rollbackAcknowledged=false,observed,connectionCategory;
   const repository=createPostgresRepository({acquire:async()=>{let c;try{c=await acquire();}catch(error){connectionCategory=taggedConnectionCategory(error);throw error;}return {query:async(sql,values)=>{try{if(sql==='commit'&&(signal?.aborted||!disposalApproval(disposal,serviceSourceSha,now())))fail();const r=await c.query(sql,values);if(sql==='rollback')rollbackAcknowledged=true;return r;}catch{throw Error('n44_disposal_no_automatic_retry');}},release:e=>c.release(e)};},prepare:async()=>({beforeCommit(){if(operation===DISPOSITION)throw Error('n44_disposition_readonly_rollback');if(signal?.aborted||!disposalApproval(disposal,serviceSourceSha,now()))fail();}})});
   if(operation===DISPOSAL){const result=await repository.writeContexts(a.ownerId,tx=>disposeExactHosted(tx,a));return {status:result.complete?'disposed':'blocked',disposition:result};}
   await repository.writeContexts(a.ownerId,tx=>{observed=disposeExactHosted(tx,a,{inspect:true});return observed;}).catch(()=>{});
   return observed&&rollbackAcknowledged?{status:'disposition',disposition:observed}:{status:'unavailable',...(connectionCategory&&disposalApproval(disposal,serviceSourceSha,now())?{connectionCategory}:{})};
  }
  if(operation==='one-device-test') {
   const a=deviceApproval(testApproval,now());
   if(deliveryEnabled||!a?.target||cursor!==a.runId||limit!==1)return {status:'disabled'};
   const rows=await transaction(({query})=>query('select * from n44_push_draft.events where owner_id=$1 and workspace_id=$2 and device_id=$3 and event_id=$4',
    [a.ownerId,a.workspaceId,a.deviceId,a.target.eventId]),signal);
   const payload=normalizePushPayload(rows.rows?.[0]?.payload,now());
   if(!payload||payload.id!==a.target.eventId)return {status:'rejected'};
   if(a.currentRequest){const trace=createAttemptTrace(),result=await makeDelivery(signal,true,trace.record).deliver(a.ownerId,a.target.registrationId,payload);return {...result,trace:trace.snapshot()};}
   return makeDelivery(signal,true).deliver(a.ownerId,a.target.registrationId,payload);
  }
  if(!deliveryEnabled)return {status:'disabled'};
  const delivery=makeDelivery(signal);
  if(!['due','cleanup'].includes(operation)||!Number.isInteger(limit)||limit<1||limit>25)fail();
  if(operation==='cleanup') {
   if(cursor!==null)fail();
   const owners=await transaction(async({query})=>{
    const r=await query('select owner_id from n44_push_draft.owner_clock where next_cleanup_ms<=$1 order by next_cleanup_ms,owner_id limit $2 for update skip locked',[now(),limit]);
    for(const r0 of r.rows)await query('update n44_push_draft.owner_clock set next_cleanup_ms=$2 where owner_id=$1',[r0.owner_id,now()+60000]);return r.rows;
   },signal);
   for(const r of owners){if(signal?.aborted)fail();const result=await delivery.cleanup(r.owner_id);if(result.status!=='cleaned')fail();
    await transaction(async({query})=>{await query('select owner_id from n44_push_draft.owner_clock where owner_id=$1 for update',[r.owner_id]);
     await query('delete from n44_push_draft.events where owner_id=$1 and expires_at_ms<$2',[r.owner_id,now()-86400000]);
     await query(`delete from n44_push_draft.contexts where (owner_id,workspace_id,device_id) in
      (select c.owner_id,c.workspace_id,c.device_id from n44_push_draft.contexts c where c.owner_id=$1 and c.session_expires_at_ms<$2
       and not exists(select 1 from n44_push_draft.registrations r where r.owner_id=c.owner_id and r.workspace_id=c.workspace_id and r.device_id=c.device_id)
       and not exists(select 1 from n44_push_draft.events e where e.owner_id=c.owner_id and e.workspace_id=c.workspace_id and e.device_id=c.device_id)
       order by c.workspace_id,c.device_id limit 100)`,[r.owner_id,now()-86400000]);},signal);}
   await transaction(async({query})=>{
    await query('delete from n44_push_draft.ingress_nonces where nonce in(select nonce from n44_push_draft.ingress_nonces where expires_at_ms<$1 order by expires_at_ms limit 100 for update skip locked)',[now()]);
    await query('delete from n44_push_draft.ingress_rates where key in(select key from n44_push_draft.ingress_rates where expires_at_ms<$1 order by expires_at_ms limit 100 for update skip locked)',[now()]);
   },signal);
   return {status:'completed',count:owners.length,cursor:null};
  }
  const first=[0,'00000000-0000-0000-0000-000000000000','','','','00000000-0000-0000-0000-000000000000'];
  if(cursor!==null&&(!Array.isArray(cursor)||cursor.length!==6||!Number.isSafeInteger(cursor[0])||cursor.slice(1).some(v=>typeof v!=='string'||v.length>240)))fail();
  const rows=await transaction(async({query})=>(await query(`select e.*,r.registration_id from n44_push_draft.events e
   join n44_push_draft.registrations r on r.owner_id=e.owner_id and r.workspace_id=e.workspace_id and r.device_id=e.device_id
   left join n44_push_draft.deliveries d on d.owner_id=e.owner_id and d.workspace_id=e.workspace_id and d.device_id=e.device_id and d.event_id=e.event_id
   where e.due_at_ms<=$1 and e.expires_at_ms>$1 and r.state='active' and r.expires_at_ms>$1
   and (d.state is null or d.state='retry' and d.next_at_ms<=$1)
   and (e.due_at_ms,e.owner_id,e.workspace_id,e.device_id,e.event_id,r.registration_id)>($2,$3::uuid,$4,$5,$6,$7::uuid)
   order by e.due_at_ms,e.owner_id,e.workspace_id,e.device_id,e.event_id,r.registration_id limit $8`,[now(),...(cursor??first),limit])).rows,signal);
  const outcomes=[];
  for(const e of rows){if(signal?.aborted)fail();outcomes.push((await delivery.deliver(e.owner_id,e.registration_id,e.payload)).status);}
  const last=rows.at(-1);return {status:'completed',count:rows.length,outcomes,cursor:rows.length===limit?[Number(last.due_at_ms),last.owner_id,last.workspace_id,last.device_id,last.event_id,last.registration_id]:null};
 }
 });
}
