// AI-authored bounded local application fixture; no real service, no guard override.
import * as cloud from '../../src/lib/cloud.js';
import * as db from '../../src/lib/db.js';
import * as store from '../../src/store.js';
import * as sync from '../../src/lib/sync.js';
export const control={mode:null,reads:0,markers:0,sends:0,renewed:false,delayMs:0,gate:null,startedAt:null};
export async function install(){
 await db.clearStore('outbox');await db.put('profile',{...store.state.profile,serverRevision:1});
 cloud.setMockBackend({getScoreFoundationCapability:()=>null,getUnifiedRestoreCapability:()=>null,
  async fetchRecords(){
   control.reads++;
   if(control.delayMs){const ms=control.delayMs;control.delayMs=0;await new Promise(r=>setTimeout(r,ms));}
   if(control.gate)await control.gate;
   if(control.mode==='403')throw Object.assign(Error('Synthetic permission denied'),{status:403});
   return [];
  },
  async fetchOwnerSyncMarker(){
   control.markers++;
   if(control.reads>0&&!control.renewed&&['renew','token'].includes(control.mode)){
    control.renewed=true;cloud.setMockAuth(cloud.user,{...cloud.session,access_token:control.mode==='token'?'synthetic-new-token':cloud.session.access_token});
   }
   return {protocol:'OWNER_SIGNAL_V1',ownerId:cloud.user.id,revision:'10'};
  },applySyncV2Mutation(){control.sends++;throw Error('Clean fixture cannot send');}});
 await store.patchDevice({}, {queue:false});
 await new Promise(r=>setTimeout(r,30));
}
export function start(mode,delayMs=0){
 Object.assign(control,{mode,delayMs,reads:0,markers:0,renewed:false,startedAt:performance.now()});
 globalThis.n130Run=sync.syncAll();
 return true;
}
export function snapshot(){return {elapsedMs:performance.now()-control.startedAt,summary:sync.getSyncOperationalSummarySnapshot(),reads:control.reads,markers:control.markers,sends:control.sends,renewed:control.renewed};}

globalThis.n130Snapshot=snapshot;
