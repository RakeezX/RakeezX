/** AI: explicit LOCAL SYNTHETIC host. No real Auth, users, secrets or sender.
 * The browser never supplies authority. Only this host's opaque transport can
 * enter the existing inactive authority contract. Do not install as a service.
 */
import {createPublisherAuthorityContract} from './publisher-authority.inactive.mjs';
import {defaultChannelPreferences,validChannelPreferences,NOTIFICATION_CATEGORIES,NOTIFICATION_CHANNELS} from '../../src/lib/notification-preferences.js';
import {validatePublisherDraft} from './publisher-model.mjs';
import {uuid,record,id} from './shared.mjs';
const FORMAT='n44-publisher-local-synthetic-v1';
const LABELS=Object.freeze({'sample-operator':'المشرف الاصطناعي','sample-a':'العينة أ','sample-b':'العينة ب'});
const empty=()=>({format:FORMAT,campaigns:[],receipts:[],audit:[],preferences:defaultChannelPreferences()});
export function createSyntheticPublisherHost({clock=Date.now,snapshot=null,persist=()=>{}}={}) {
  let state=empty(),tail=Promise.resolve();
  const started=clock(),transport=Object.freeze({});
  const authority={actorId:'synthetic-operator',sessionId:'synthetic-session',workspaceId:'synthetic-workspace',policyId:'synthetic-policy-v1',
    sessionExpiresAt:started+8*86400000,startsAt:started-1000,expiresAt:started+8*86400000,
    actions:['prepare','edit','list','inspect','cancel','reservePreview','completePreview'],
    audiences:['operator','selected','all'].map(kind=>({ref:'synthetic-'+kind,kind,maxRecipients:3})),
    categories:[...NOTIFICATION_CATEGORIES],channels:[...NOTIFICATION_CHANNELS],allowCritical:true,maxCampaigns:20};
  // Only host-produced synthetic state is restored; it is not an authority input.
  if(snapshot!==null) {
    if(!record(snapshot,['format','campaigns','receipts','audit','preferences'])||snapshot.format!==FORMAT||
      !Array.isArray(snapshot.campaigns)||snapshot.campaigns.length>20||!Array.isArray(snapshot.receipts)||snapshot.receipts.length>200||
      !Array.isArray(snapshot.audit)||snapshot.audit.length>200||!validChannelPreferences(snapshot.preferences))throw Error('invalid_local_snapshot');
    const ids=new Set();
    for(const c of snapshot.campaigns) {
      const allowed=['id','actorId','workspaceId','policyId','version','audienceRef','maxRecipients','draft','startsAt','expiresAt','state','reservationKey','audienceRevision','recipientCount','channelCounts','outcome'];
      const checked=validatePublisherDraft(c.draft,c.startsAt);
      if(!uuid(c.id)||ids.has(c.id)||c.actorId!==authority.actorId||c.workspaceId!==authority.workspaceId||c.policyId!==authority.policyId||
        Object.keys(c).some(key=>!allowed.includes(key))||c.audienceRef!=='synthetic-'+c.draft.audience||c.maxRecipients!==3||
        !Number.isSafeInteger(c.version)||c.version<1||!Number.isSafeInteger(c.startsAt)||!Number.isSafeInteger(c.expiresAt)||
        !['prepared','scheduled','cancelled','reserved_preview','completed_preview','uncertain_preview','expired'].includes(c.state)||
        checked.status!=='valid'||checked.startsAt!==c.startsAt||checked.expiresAt!==c.expiresAt||
        c.channelCounts&&(!record(c.channelCounts,NOTIFICATION_CHANNELS)||Object.values(c.channelCounts).some(n=>!Number.isInteger(n)||n<0||n>3))||
        c.recipientCount!==undefined&&(!Number.isInteger(c.recipientCount)||c.recipientCount<0||c.recipientCount>3)||
        c.outcome!==undefined&&!['accepted','not_accepted','unknown'].includes(c.outcome))throw Error('invalid_local_campaign');
      ids.add(c.id);
    }
    if(snapshot.receipts.some(r=>!Array.isArray(r)||r.length!==2||typeof r[0]!=='string'||r[0].length>400||!record(r[1],['fingerprint','status'])||!/^[a-f0-9]{64}$/.test(r[1].fingerprint)||typeof r[1].status!=='string')||
       snapshot.audit.some(a=>!record(a,['actorId','sessionId','workspaceId','policyId','campaignId','version','action','status','at','commandDigest'])||!ids.has(a.campaignId)||a.actorId!==authority.actorId||a.sessionId!==authority.sessionId||a.workspaceId!==authority.workspaceId||a.policyId!==authority.policyId||!authority.actions.includes(a.action)||!/^[a-f0-9]{64}$/.test(a.commandDigest)))throw Error('invalid_local_history');
    const receiptKeys=new Set();for(const [key,row]of snapshot.receipts){const [actor,command,...extra]=JSON.parse(key);if(actor!==authority.actorId||!id(command)||extra.length||receiptKeys.has(key)||row.status.length>40)throw Error('invalid_local_history');receiptKeys.add(key);}
    state=structuredClone(snapshot);
    // Lost preview completion is UNKNOWN; never infer success or replay on boot.
    for(const c of state.campaigns)if(c.state==='reserved_preview'){c.state='uncertain_preview';c.outcome='unknown';}
  }
  const commit=(next,fences=[])=>{const check=()=>{for(const f of fences)f();};check();const result=persist(structuredClone(next),check);if(result?.then)throw Error('synchronous_local_commit_required');state=next;};
  const serial=work=>{const pending=tail.then(work,work);tail=pending.catch(()=>{});return pending;};
  const repository={atomic:(workspace,work)=>serial(()=>{
    if(workspace!==authority.workspaceId)throw Error('synthetic_workspace_required');
    const next=structuredClone(state),campaigns=new Map(next.campaigns.map(c=>[c.id,c])),receipts=new Map(next.receipts),fences=[];
    const result=work({time:()=>clock(),get:id=>campaigns.get(id),put:(id,c)=>campaigns.set(id,c),count:()=>campaigns.size,
      list:()=>[...campaigns.values()],receipt:key=>receipts.get(key),remember:(key,row)=>receipts.set(key,row),
      auditCount:()=>next.audit.length,audit:row=>next.audit.push(row),auditRows:()=>next.audit,beforeCommit:fn=>fences.push(fn)});
    next.campaigns=[...campaigns.values()];next.receipts=[...receipts];
    if(JSON.stringify(next)!==JSON.stringify(state))commit(next,fences);else for(const fence of fences)fence();
    return result;
  })};
  const authorityPort={authorize:async supplied=>supplied===transport?structuredClone(authority):null,
    isCurrent:a=>JSON.stringify(a)===JSON.stringify(authority)};
  const contract=createPublisherAuthorityContract({hostAuthority:authorityPort,repository,clock,
    resolveSyntheticAudience:({kind,audienceRef})=>({kind,audienceRef,revision:'synthetic-roster-v1',recipients:
      Object.keys(LABELS).filter(key=>kind==='all'||kind==='operator'&&key==='sample-operator'||kind==='selected'&&key==='sample-a').map(key=>({
        synthetic:true,key,operator:key==='sample-operator',selected:key==='sample-a',preferences:structuredClone(state.preferences),
        capabilities:{verifiedAccount:true,pushConsent:key!=='sample-b',registrationCurrent:true,permission:key==='sample-b'?'denied':'granted',emailVerified:true,emailConsent:true},
        timing:{timezone:'Asia/Riyadh',quiet:null}}))})});
  const execute=command=>contract.execute(transport,command);
  const inspect=campaignId=>execute({action:'inspect',campaignId});
  return Object.freeze({
    async dispatch(raw) {
      if(!raw||typeof raw!=='object')return {status:'rejected'};
      if(raw.action==='list'&&record(raw,['action']))return execute(raw);
      if(raw.action==='inspect'&&record(raw,['action','campaignId']))return inspect(raw.campaignId);
      if(raw.action==='settings'&&record(raw,['action']))return {status:'synthetic_settings',preferences:structuredClone(state.preferences),recipients:LABELS};
      if(raw.action==='preferences'&&record(raw,['action','preferences'])&&validChannelPreferences(raw.preferences))return serial(()=>{
        const next=structuredClone(state);next.preferences=structuredClone(raw.preferences);commit(next);return {status:'saved_synthetic_preferences'};
      });
      if(raw.action==='save'&&record(raw,['action','campaignId','expectedVersion','idempotencyKey','draft'])) {
        return execute({action:'edit',campaignId:raw.campaignId,idempotencyKey:raw.idempotencyKey,
          expectedVersion:raw.expectedVersion,audienceRef:'synthetic-'+raw.draft?.audience,draft:raw.draft});
      }
      if(raw.action==='create'&&record(raw,['action','campaignId','idempotencyKey','draft']))return execute({action:'prepare',campaignId:raw.campaignId,idempotencyKey:raw.idempotencyKey,audienceRef:'synthetic-'+raw.draft?.audience,draft:raw.draft});
      if(raw.action==='cancel'&&record(raw,['action','campaignId','idempotencyKey']))return execute(raw);
      if(raw.action==='preview'&&record(raw,['action','campaignId','idempotencyKey','outcome'])&&['accepted','not_accepted','unknown'].includes(raw.outcome)) {
        const reserved=await execute({action:'reservePreview',campaignId:raw.campaignId,idempotencyKey:raw.idempotencyKey});
        if(!reserved.permit)return reserved;
        return execute({action:'completePreview',campaignId:raw.campaignId,idempotencyKey:raw.idempotencyKey+':complete',permit:reserved.permit,outcome:raw.outcome});
      }
      return {status:raw.action==='publish'?'live_publish_unavailable':'rejected'};
    },
    snapshot:()=>structuredClone(state),
  });
}
