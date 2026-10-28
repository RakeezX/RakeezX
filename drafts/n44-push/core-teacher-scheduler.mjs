/** AI: finite integration guards for the existing scheduler/delivery transactions. */
import {createHash} from 'node:crypto';
import {id,uuid,record,rate} from './shared.mjs';
const DAY=86400000;
export function finiteScope(raw) {
 if(!record(raw,['grantId','ownerId','activatedAt','hardEnd','tickMs','tickCap','sendCap','targets']) || !uuid(raw.grantId)||!uuid(raw.ownerId)||
 ![raw.activatedAt,raw.hardEnd,raw.tickMs,raw.tickCap,raw.sendCap].every(Number.isSafeInteger)||raw.activatedAt<=0||raw.hardEnd<=raw.activatedAt||raw.hardEnd-raw.activatedAt>3600000||
 Math.floor(raw.activatedAt/DAY)!==Math.floor((raw.hardEnd-1)/DAY)||raw.tickMs<60000||raw.tickCap<1||raw.tickCap>20||raw.sendCap<1||raw.sendCap>20||
 !Array.isArray(raw.targets)||!raw.targets.length||raw.targets.length>20)throw Error('n44_finite_scope');
 const targets=raw.targets.map(t=>{
 if(!record(t,['workspaceId','deviceId','registrationId','sourceKind','sourceId','sourceStamp','eventId'])||![t.workspaceId,t.deviceId,t.sourceId].every(id)||!uuid(t.registrationId)||
 !['lesson','due'].includes(t.sourceKind)||!/^[a-f0-9]{64}$/.test(t.sourceStamp)||!/^([a-zA-Z0-9_:%.-]){1,240}$/.test(t.eventId))throw Error('n44_finite_target');
 return Object.freeze({...t});});
 if(new Set(targets.map(t=>JSON.stringify([t.workspaceId,t.deviceId,t.eventId]))).size!==targets.length)throw Error('n44_finite_duplicate');
 return Object.freeze({...raw,targets:Object.freeze(targets)});
}
export const finiteActive=(a,now)=>Number.isSafeInteger(now)&&now>=a.activatedAt&&now<a.hardEnd;
export function finiteGuards(a) {
 const prefix='day:core:'+a.grantId+':',binding=prefix+'bind:'+createHash('sha256').update(JSON.stringify(a)).digest('hex');
 function bind(tx,now) {
  if(!finiteActive(a,now))return false;
  if(tx.entries('budgets').some(([k])=>k.startsWith(prefix+'bind:')&&k!==binding))return false;
  if(!tx.get('budgets',binding))return rate(tx,binding,now,DAY,1);
  return true;
 }
 return Object.freeze({
  tick(tx,now){
   if(!bind(tx,now))return false;
   const slot=prefix+'tick:'+Math.floor((now-a.activatedAt)/a.tickMs);
   if(tx.get('budgets',slot)||!rate(tx,prefix+'ticks',now,DAY,a.tickCap))return false;
   return rate(tx,slot,now,DAY,1);
  },
  beforePermit(tx,owner,r,payload,now){
   if(owner!==a.ownerId||!a.targets.some(t=>t.workspaceId===r.workspaceId&&t.deviceId===r.deviceId&&t.registrationId===r.registrationId&&t.eventId===payload.id&&t.sourceKind===payload.kind)||!bind(tx,now))return false;
   return rate(tx,prefix+'sends',now,DAY,a.sendCap);
  }
 });
}
