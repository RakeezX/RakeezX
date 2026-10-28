/** AI: finite original-host readback. Only existing typed SELECTs; always rollback. */
import {createHmac} from 'node:crypto';
import {createMobileTrialPreparation,mobileGrantDigest} from '../mobile-trial.inactive.mjs';
import {record} from '../shared.mjs';
import contract from './error-boundary-contract.json' with {type:'json'};
import {mac,sha} from '../web-protocol.mjs';
export const MOBILE_READBACK='n44-mobile-trial-readback-v1';
export const MOBILE_STAGES=Object.freeze(['baseline','android_registered','android_terminal','ios_registered','ios_terminal','ios_stopped','android_stopped','final']);
const fail=()=>{throw Error('n44_mobile_readback_unavailable');};
export function mobileReadbackScope(options,request,now){
 const g=options.mobileTrial;
 const mobile=createMobileTrialPreparation({trustedGrant:g,expectedGrantSha256:options.mobileGrantSha256,serviceSourceSha:options.serviceSourceSha,policyApprovalId:options.sessionPolicy?.approvalId});
 if(!mobile.configured||!record(request,['operation','cursor','limit'])||request.operation!==MOBILE_READBACK||request.limit!==1||
  !MOBILE_STAGES.some(s=>request.cursor===g.grantId+':'+s)||options.deliveryEnabled||options.deviceTest||options.operatorDisposal||options.currentInspection||
  !g.devices.every(d=>mobile.allowsScope(g.ownerId,{workspaceId:g.workspaceId,deviceId:d.deviceId},now)))return null;
 return g;
}
export const mobileReadbackPurpose=g=>MOBILE_READBACK+':'+mobileGrantDigest(g);
export async function signedMobileReadback(url,key,options,request,now=Date.now){
 const g=mobileReadbackScope(options,request,now());if(!g)fail();const u=new URL(url);
 if(u.origin!=='https://xlrubcwjqktzzunrvuns.supabase.co'||u.pathname!=='/functions/v1/n44-notifications/schedule'||u.search||u.hash||u.username||u.password)fail();
 const bytes=new TextEncoder().encode(JSON.stringify(request)),time=String(Math.floor(now()/1000)),nonce=crypto.randomUUID(),source=await mac(key,mobileReadbackPurpose(g));
 const signature=await mac(key,JSON.stringify(['n44-scheduler-v1',u.origin,u.pathname,await sha(bytes),time,nonce,source]));
 return new Request(url,{method:'POST',headers:{'content-type':'application/json','x-n44-time':time,'x-n44-nonce':nonce,'x-n44-source':source,'x-n44-signature':signature,'x-region':'ap-south-1'},body:bytes});
}
const queries=Object.fromEntries(['contexts','registrations','deliveries','budgets'].map(table=>{
 const found=contract.operations.filter(o=>o.sql.startsWith('select ')&&o.sql.includes(' from n44_push_draft.'+table+' where owner_id=$1 limit $2'));
 if(found.length!==1)fail();return [table,found[0].sql];
}));
export async function readMobileHosted(options,request,signal){
 const now=options.now??Date.now,g=mobileReadbackScope(options,request,now());if(!g)return {status:'disabled'};
 // acquire is the ORIGINAL host acquire: RESET ROLE, login/TLS, private-session,
 // exact typed-routine identities and ACL guards all run before this first query.
 const c=await options.acquire();let begun=false,rolledBack=false;
 const fence=()=>{if(signal?.aborted||!mobileReadbackScope(options,request,now()))fail();};
 const q=async(sql,values)=>{fence();const r=await c.query(sql,values);fence();return r;};
 try{
  await q('begin');begun=true;await q("set local statement_timeout='3000ms'");await q("set local lock_timeout='1000ms'");
  // Existing per-owner lock serializes this snapshot with ordinary registration,
  // consent and delivery writers. No owner-clock insert/update or ingress debit.
  const lock=await q('select high_water_ms::text as high_water_ms from n44_push_draft.owner_clock where owner_id=$1 for update',[g.ownerId]);if(lock.rows.length!==1)fail();
  const data={};for(const table of Object.keys(queries)){const r=await q(queries[table],[g.ownerId,257]);if(r.rows.length>256)fail();data[table]=r.rows;}
  const digest=value=>createHmac('sha256',options.rateKey).update(JSON.stringify(value)).digest('hex');
  const slots=g.devices.map((d,i)=>{
   const budget=op=>data.budgets.filter(b=>b.budget_key===`day:n44-mobile-v1:${g.grantId}:${i}:${op}`);
   const named=data.registrations.filter(r=>r.workspace_id===g.workspaceId&&r.device_id===d.deviceId);
   const adopted=named.filter(r=>budget('binding:'+r.registration_id).length===1);if(adopted.length>1)fail();
   const r=adopted[0]??null,contexts=data.contexts.filter(x=>x.workspace_id===g.workspaceId&&x.device_id===d.deviceId);if(contexts.length>1)fail();const ctx=contexts[0]??null;
   const jobs=data.deliveries.filter(j=>j.workspace_id===g.workspaceId&&j.device_id===d.deviceId);
   const terminal=['sent','uncertain','dead','suppressed'];const target=jobs.filter(j=>j.event_id===d.target.id);if(target.length>1)fail();
   const valid=!!r&&r.state==='active'&&Number(r.expires_at_ms)>now()&&!!r.sealed&&!!r.fingerprint&&!!r.binding_fingerprint&&ctx?.active===true&&ctx.push_consent===true&&Number(ctx.session_expires_at_ms)>now()&&r.session_id===ctx.session_id&&r.session_revision===ctx.session_revision&&r.consent_revision===ctx.consent_revision&&r.session_revision.endsWith(':'+g.policyApprovalId);
   const state=r?.state??'absent';if(!['absent','active','revoked','dead'].includes(state))fail();
   if(target[0]&&(!['pending','retry','sending',...terminal].includes(target[0].state)||!Number.isSafeInteger(target[0].attempts)||target[0].attempts<0||target[0].attempts>1))fail();
   return {slot:d.platform,registration:state,valid,activeNamedCount:named.filter(x=>x.state==='active').length,
    bindingPresent:!!r?.sealed&&!!r?.fingerprint&&!!r?.binding_fingerprint,registrationDigest:r?digest(r):null,
    registrationExpiresAt:r?Number(r.expires_at_ms):null,consent:ctx?.push_consent??null,
    preferencesDigest:ctx?digest(ctx.preferences):null,registrationSpent:budget('registration').length===1,providerSpent:budget('provider').length===1,
    pendingJobs:jobs.some(j=>!terminal.includes(j.state)),delivery:target[0]?.state??'absent',attempts:target[0]?.attempts??0};
  });
  // No raw IDs, sealed material, endpoints, keys, session fields or source fields.
  const response={status:'mobile-inspection',stage:request.cursor.slice(g.grantId.length+1),slots};fence();
  await c.query('rollback');rolledBack=true;return response;
 }finally{if(begun&&!rolledBack)await c.query('rollback').catch(()=>{});c.release();}
}
