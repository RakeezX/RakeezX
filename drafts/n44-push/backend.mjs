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
import {deviceApproval,publicDeviceConfiguration,oneDeviceGuard} from './one-device-test.mjs';
const fail=()=>{throw Error('n44_unavailable');};
const exact=(v,keys)=>{if(!record(v,keys))fail();};
export function createBackend({acquire,authUrl,apiKey,fetch,providerOrigins,crypto,rateKey,deliveryEnabled=false,deviceTest=null,publicVapidKey=null,sessionPolicy,serviceSourceSha,now=Date.now}) {
 if(!supportedSessionPolicy(sessionPolicy,now(),serviceSourceSha))fail();
 const policy=Object.freeze(structuredClone(sessionPolicy));
 const testApproval=deviceTest&&structuredClone(deviceTest);
 const verify=createTeacherVerifier({authUrl,apiKey,fetch,now});
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
  for(const e of stored.rows){const ctx=state.contexts.get(JSON.stringify([e.workspace_id,e.device_id]));if(!ctx?.active)continue;
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
 const makeDelivery=(signal,oneDevice=false)=>{
  const fence=()=>{if(signal?.aborted||!supportedSessionPolicy(policy,now(),serviceSourceSha))fail();};
  const repository=createPostgresRepository({acquire,prepare:async(...args)=>{fence();const extension=await prepare(...args,signal);fence();return {...extension,async beforeCommit(){await extension.beforeCommit?.();fence();}};}});
  return createDeliveryBoundary({repository,clock:now,envelope:true,...(oneDevice?{beforePermit:oneDeviceGuard(testApproval),maxAttempts:1,bindingExpiresAt:testApproval.expiresAt}:{}),recompute:(tx,r,event,time)=>tx.sourceEvent(r,event,time),sender:{send(permit){if(signal?.aborted||oneDevice&&!deviceApproval(testApproval,now()))return 'uncertain';return crypto.sender.send(permit,{signal});}}});
 };
 // Both roles use a shared durable atomic upsert; raw IP/owner never used as rate keys.
 async function take(query,kind,key,limit) {
  const bucket=Math.floor(now()/60000),hash=createHmac('sha256',rateKey).update(JSON.stringify([kind,key])).digest('hex');
  // Per-kind advisory key serializes bounded rate-key admission across instances.
  await query('select pg_advisory_xact_lock(44001,hashtext($1))',[kind]);
  const keys=await query('select key from n44_push_draft.ingress_rates where kind=$1 limit 2049',[kind]);
  if(keys.rows.length>=2048&&!keys.rows.some(r=>r.key===hash))return false;
  const r=await query(`insert into n44_push_draft.ingress_rates(key,bucket,count,expires_at_ms,kind) values($1,$2,1,$3,$5)
   on conflict(key) do update set bucket=excluded.bucket,count=case when ingress_rates.bucket=excluded.bucket then ingress_rates.count+1 else 1 end,expires_at_ms=excluded.expires_at_ms
   where ingress_rates.bucket<>excluded.bucket or ingress_rates.count<$4 returning count`,[hash,bucket,(bucket+1)*60000,limit,kind]);
  return r.rows.length===1;
 }
 return Object.freeze({
 async ingress(e,signal) {return transaction(async({query})=>{
  if(Math.abs(now()-Number(e.time)*1000)>15000)return false;
  const scope=e.kind==='scheduler'?'scheduler':'teacher';
  // Dedicated scheduler capacity keeps bounded cleanup available under public saturation.
  await query('select pg_advisory_xact_lock(44002,hashtext($1))',[scope]);
  const entries=await query('select nonce from n44_push_draft.ingress_nonces where scope=$1 limit $2',[scope,scope==='teacher'?4097:129]);
  if(entries.rows.length>=(scope==='teacher'?4096:128))return false;
  const r=await query('insert into n44_push_draft.ingress_nonces(nonce,scope,expires_at_ms) values($1,$2,$3) on conflict do nothing returning nonce',[e.nonce,scope,Number(e.time)*1000+16000]);
  return r.rows.length===1 && (scope==='scheduler'?await take(query,'scheduler','n44',30):await take(query,'global','n44',3000) && await take(query,'peer',e.source,60));
 },signal);},
 async teacher(path,authorization,body,signal) {
  // Debit authenticated owner separately so rejected work cannot roll back its rate.
  return transaction(async(ports,c)=>{
   const verified=await verify(authorization,signal,ports);if(!verified)return {status:'rejected'};
   const auth={...verified,sessionRevision:policySessionRevision(verified.sessionId,policy)};
   const allowed=await transaction(({query})=>take(query,'owner',auth.ownerId,30),signal);if(!allowed)return {status:'limited'};
   // Existing repository commits a SAVEPOINT; outer Auth locks survive until durable response.
   const local=createPostgresRepository({acquire:async()=>({
    query(text,values){return text.startsWith('begin')?ports.query('savepoint n44_owner'):text==='commit'?ports.query('release savepoint n44_owner'):text==='rollback'?ports.query('rollback to savepoint n44_owner'):ports.query(text,values);},release(){}
   })});
   const scope=b=>{if(!id(b.workspaceId)||!id(b.deviceId))fail();};
   if(path==='/push/config') {
    exact(body,['workspaceId','deviceId']);scope(body);
    if(deliveryEnabled)return {status:'disabled'};
    return publicDeviceConfiguration(testApproval,auth.ownerId,body,publicVapidKey,serviceSourceSha,now());
   }
   if(path.startsWith('/push/')) {
    if(path==='/push/register'&&testApproval) {
     const a=deviceApproval(testApproval,now());
     if(!a||auth.ownerId!==a.ownerId||body.workspaceId!==a.workspaceId||body.deviceId!==a.deviceId)return {status:'disabled'};
     const previous=await local.atomic(auth.ownerId,tx=>tx.rows('registrations').some(r=>r.workspaceId===a.workspaceId&&r.deviceId===a.deviceId&&r.registrationId!==body.registrationId));
     if(previous)return {status:'disabled'};
    }
    if(path==='/push/revoke') {
     exact(body,['registrationId','workspaceId','deviceId']);scope(body);if(!uuid(body.registrationId))fail();
     // A fresh session may acknowledge an already retired ORIGINAL identity,
     // never remove an active registration belonging to another session.
     const retired=await local.atomic(auth.ownerId,tx=>{const r=tx.get('registrations',body.registrationId);
      return r && r.workspaceId===body.workspaceId&&r.deviceId===body.deviceId&&r.state!=='active';});
     if(retired)return {status:'revoked'};
    }
    const registration=createRegistrationBoundary({verifySession:async()=>auth,repository:local,protect:crypto.protect,clock:now,approvedOrigins:providerOrigins,receipt:true,failureProjection:true});
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
    if(!old.rows.length&&body.expectedStamp!==null)return {status:'stale'};
    await q('delete from n44_push_draft.events where owner_id=$1 and workspace_id=$2 and device_id=$3 and source_kind=$4 and source_id=$5',[auth.ownerId,body.workspaceId,body.deviceId,body.kind,body.sourceId]);
    for(const e of source?.events??[]){if(e.expiresAt<=now())continue;
     const {dueAt,...payload}=e;await q('insert into n44_push_draft.events values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[auth.ownerId,body.workspaceId,body.deviceId,e.id,body.kind,body.sourceId,source.stamp,dueAt,e.expiresAt,payload]);}
    const count=await q('select event_id from n44_push_draft.events where owner_id=$1 limit 101',[auth.ownerId]);if(count.rows.length>100)fail();
    return {status:'updated',sourceStamp:source?.stamp??null};
   }
   return {status:'rejected'};
  },signal);
 },
 async schedule({operation,cursor=null,limit=25},signal) {
  if(operation==='one-device-test') {
   const a=deviceApproval(testApproval,now());
   if(deliveryEnabled||!a?.target||cursor!==a.runId||limit!==1)return {status:'disabled'};
   const rows=await transaction(({query})=>query('select * from n44_push_draft.events where owner_id=$1 and workspace_id=$2 and device_id=$3 and event_id=$4',
    [a.ownerId,a.workspaceId,a.deviceId,a.target.eventId]),signal);
   const payload=normalizePushPayload(rows.rows?.[0]?.payload,now());
   if(!payload||payload.id!==a.target.eventId)return {status:'rejected'};
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
