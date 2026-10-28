/** AI: D107 inert Publisher source/Preview. No network, Auth, recipient lookup,
 * privileged command or sender port. Local preview states are never delivery.
 */
import { NOTIFICATION_CATEGORIES, NOTIFICATION_CHANNELS, notificationChannelDecision } from '../../src/lib/notification-preferences.js';
import { resolveNotificationSchedule } from '../../src/lib/notification-schedule.js';
import { quietNow } from './delivery.mjs';
export const PUBLISHER_ACTIONS=Object.freeze(['/','/settings','/settings/notifications']);
export const PUBLISHER_AUDIENCES=Object.freeze(['operator','selected','all','segment']);
const text=(value,max)=>typeof value==='string'&&value.trim().length>0&&value.length<=max&&!/[\u0000-\u0008\u000b-\u001f\u007f]/.test(value);
const keys=(value,expected)=>value&&Object.getPrototypeOf(value)===Object.prototype&&Reflect.ownKeys(value).length===expected.length&&expected.every(k=>Object.getOwnPropertyDescriptor(value,k)?.enumerable&&Object.hasOwn(Object.getOwnPropertyDescriptor(value,k),'value'));
export function validatePublisherDraft(value,now=Date.now()) {
  if(!keys(value,['title','body','category','critical','channels','audience','actionPath','start','expiry'])||
    !text(value.title,80)||!text(value.body,500)||!NOTIFICATION_CATEGORIES.includes(value.category)||typeof value.critical!=='boolean'||
    value.critical&&value.category!=='account'||!keys(value.channels,NOTIFICATION_CHANNELS)||
    !NOTIFICATION_CHANNELS.every(c=>typeof value.channels[c]==='boolean')||!Object.values(value.channels).some(Boolean)||
    !PUBLISHER_AUDIENCES.includes(value.audience)||!PUBLISHER_ACTIONS.includes(value.actionPath)||
    !keys(value.start,['mode','date','time','timezone'])||!['now','scheduled'].includes(value.start.mode)||
    !keys(value.expiry,['date','time','timezone']))return {status:'invalid'};
  const start=value.start.mode==='now'?{status:'resolved',epochMs:now}:resolveNotificationSchedule(value.start,now);
  const expiry=resolveNotificationSchedule(value.expiry,now);
  if(start.status!=='resolved')return {status:start.status};
  if(expiry.status!=='resolved')return {status:expiry.status};
  if(!Number.isSafeInteger(now)||start.epochMs<now||expiry.epochMs<=start.epochMs||expiry.epochMs-start.epochMs>7*86400000)return {status:'invalid_interval'};
  return {status:'valid',draft:structuredClone(value),startsAt:start.epochMs,expiresAt:expiry.epochMs};
}
/** Fixture selection is explicit and finite. Never enumerate a user/account API.
 * A future trusted server must resolve/authorize real audiences independently.
 */
export function previewPublisherDelivery(campaign,recipient,now) {
  if(!campaign||!Number.isSafeInteger(now)||!recipient?.synthetic||!['previewed','scheduled'].includes(campaign.state))return {status:'blocked'};
  if(now>=campaign.expiresAt)return {status:'expired'};
  if(now<campaign.startsAt)return {status:'scheduled'};
  const d=campaign.draft;
  if(d.audience==='segment')return {status:'audience_unavailable'};
  if(d.audience==='operator'&&!recipient.operator||d.audience==='selected'&&!recipient.selected)return {status:'outside_audience'};
  const channels=notificationChannelDecision(d,recipient.preferences,recipient.capabilities);
  if(!channels)return {status:'blocked'};
  if(quietNow(recipient.timing,now)!==false)channels.push=false;
  return {status:Object.values(channels).some(Boolean)?'preview_only':'suppressed',channels};
}
export function createPublisherPreparation({clock=Date.now,randomUUID=()=>crypto.randomUUID()}={}) {
  const drafts=new Map(),receipts=new Map();
  return Object.freeze({
    save(value) {
      if(drafts.size>=20)return {status:'capacity'};
      const checked=validatePublisherDraft(value,clock()); if(checked.status!=='valid')return {status:checked.status};
      const id=randomUUID(); if(drafts.has(id)||typeof id!=='string'||id.length>80)return {status:'invalid'};
      const campaign={id,state:value.start.mode==='scheduled'?'scheduled':'previewed',draft:checked.draft,startsAt:checked.startsAt,expiresAt:checked.expiresAt};
      drafts.set(id,campaign);return structuredClone(campaign);
    },
    get(id) { return structuredClone(drafts.get(id)??null); },
    cancel(id) {
      const c=drafts.get(id);if(!c||!['scheduled','previewed'].includes(c.state))return {status:'unchanged'};
      // This cancels a local preparation only; it never claims to recall a send.
      c.state='cancelled';return {status:'cancelled'};
    },
    preview(id,recipient) {
      const c=drafts.get(id);if(!c||!recipient?.synthetic||typeof recipient.key!=='string'||recipient.key.length>80)return {status:'blocked'};
      const result=previewPublisherDelivery(c,recipient,clock());
      if(result.status!=='preview_only')return result;
      const key=JSON.stringify([id,recipient.key]);
      if(receipts.has(key))return {status:'duplicate_preview',channels:receipts.get(key)};
      if(receipts.size>=100)return {status:'capacity'};
      receipts.set(key,result.channels);return result;
    },
    // Explicitly unavailable until a separately authorized server composition.
    publish: () => ({status:'server_authorization_required'}),
  });
}
