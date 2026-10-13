import {fixture as originalFixture,owner,capability as oldCapability} from './n73-account-flow-fixture.mjs';
import * as models from '../src/models.js';
import {planScoreDistributionCopy,distributionCopyToken} from '../src/lib/score-distribution-copy.js';
import {encodeSyncV2Patch,decodeSyncV2Canonical,SYNC_V2_SCHEMAS} from '../src/lib/sync-v2.js';
export {owner,foreignOwner,source,target,second,prepareAccount} from './n73-account-flow-fixture.mjs';
export const capability={...oldCapability,targetPreservationVersion:1};
export function fixture() {
  const rows=originalFixture(),owned=row=>({...row,ownerId:owner,serverRevision:1});
  rows.items.find(row=>row.id==='n73-target-exam').max=20;
  rows.scores.find(row=>row.id==='n73-cap').value=7;
  rows.students.push(owned(models.makeStudent({id:'n100-unmarked',name:'Synthetic unmarked'})));
  for(const [side,teaching] of [['source','n73-source'],['target','n73-target']]) {
    rows.items.push(owned(models.makeItem({id:'n100-'+side,teachingId:teaching,name:'الواجبات',max:10,order:2,scoreMode:'subitems',distributionMode:'manual'})));
    for(const index of [0,1]) rows.scoreSubitems.push(owned(models.makeScoreSubitem({id:'n100-'+side+'-'+index,itemId:'n100-'+side,
      name:(side==='source'?'اسم جديد ':'اسم سابق ')+index,value:index===0?3:2,latePoints:1,order:index,
      startDate:side==='source'?'2026-11-01':'2026-09-01',dueDate:side==='source'?'2026-11-02':'2026-09-02',
      createdAt:side==='source'?Date.parse('2026-01-01'):Date.parse('2026-02-01')})));
  }
  rows.scores.push(...[
    {id:'n100-source-score',itemId:'n100-source',studentId:'n73-student1',value:9,manualValue:6,derivedValue:3},
    {id:'n100-regular',itemId:'n100-target',studentId:'n73-student1',value:5,manualValue:2,derivedValue:3},
    {id:'n100-late',itemId:'n100-target',studentId:'n73-student2',value:2,manualValue:1,derivedValue:1},
    {id:'n100-unmarked-score',itemId:'n100-target',studentId:'n100-unmarked',value:null,manualValue:null,derivedValue:0}
  ].map(owned));
  rows.scoreSubitemCompletions.push(...[
    {id:'n100-source-c',studentId:'n73-student1',subitemId:'n100-source-0',checked:true,completionState:'regular'},
    {id:'n100-regular-c',studentId:'n73-student1',subitemId:'n100-target-0',checked:true,completionState:'regular'},
    {id:'n100-late-c',studentId:'n73-student2',subitemId:'n100-target-1',checked:true,completionState:'late'},
    {id:'n100-unmarked-c',studentId:'n100-unmarked',subitemId:'n100-target-0',checked:false,completionState:null}
  ].map(owned));
  // Account boot fixtures carry the same canonical baselines as an actual restore/pull.
  for(const [store,records] of Object.entries(rows)) if(SYNC_V2_SCHEMAS[store]) for(const row of records) {
    const canonical=decodeSyncV2Canonical(store,{...encodeSyncV2Patch(store,row),id:row.id,owner_id:owner,revision:row.serverRevision,
      deleted_at:null,created_at:row.createdAt?new Date(row.createdAt).toISOString():undefined});
    row.serverCanonical=canonical;row.canonicalId=row.id;
  }
  return rows;
}
// Bounded synthetic HTTP transport. Real account ownership/lease/Sync paths remain active.
export function syntheticService() {
  let current=fixture(),sequence=0,mode=null;
  const plans=new Map(),receipts=new Map(),evidence={plans:[],envelopes:[],commits:0};
  return {evidence,get current(){return current;},setMode(value){mode=value;},
    async request(name,input) {
      if(name==='fixture')return current;
      if(name==='auth')return {id:owner,source:'supabase-auth-user',verifiedAt:Date.now()};
      if(name==='capability')return mode==='old-capability'?oldCapability:capability;
      if(name==='plan') {
        evidence.plans.push(structuredClone(input));
        const plan=planScoreDistributionCopy(current,input.sourceTeachingId,input.targetTeachingIds,{ownerId:owner,
          removeItemIds:input.removeItemIds,mode:input.mode,id:()=> 'n100-new-'+(++sequence)});
        const publicPlan={...plan,protocol:'N73_D119_V2',planId:input.planId};delete publicPlan.writes;
        plans.set(input.planId,{plan,input});return publicPlan;
      }
      if(name==='apply') {
        evidence.envelopes.push(structuredClone(input));
        if(receipts.has(input.mutationId))return receipts.get(input.mutationId);
        const saved=plans.get(input.planId);
        if(!saved||saved.plan.token!==input.token||saved.plan.token!==distributionCopyToken(current,saved.input.sourceTeachingId,saved.input.targetTeachingIds,saved.input.mode)||mode==='stale-apply')throw Object.assign(Error('Synthetic stale distribution plan'),{status:409,code:'PT409'});
        if(saved.plan.requiresConfirmation&&!input.confirmed)throw Object.assign(Error('Confirmation required'),{status:400});
        const receipt={mutationId:input.mutationId,planId:input.planId,protocol:'N73_D119_V2'};
        for(const [store] of [['items'],['scores'],['scoreSubitems'],['scoreSubitemCompletions']]) {
          for(const written of saved.plan.writes[store].put) {
            const row={...written,ownerId:owner,serverRevision:(written.serverRevision??0)+1};
            const index=current[store].findIndex(old=>old.id===row.id);
            if(index<0)current[store].push(row);else current[store][index]=row;
          }
        }
        const accepted=new Set(saved.plan.targets.map(row=>row.teachingId));
        const items=new Set(current.items.filter(row=>accepted.has(row.teachingId)).map(row=>row.id));
        const subs=new Set(current.scoreSubitems.filter(row=>items.has(row.itemId)).map(row=>row.id));
        for(const [store,entity] of [['items','items'],['scores','scores'],['scoreSubitems','score_subitems'],['scoreSubitemCompletions','score_subitem_completions']]) {
          const rows=current[store].filter(row=>store==='items'?accepted.has(row.teachingId):store==='scoreSubitemCompletions'?subs.has(row.subitemId):items.has(row.itemId));
          receipt[entity]=rows.map(row=>({...encodeSyncV2Patch(store,row),id:row.id,owner_id:owner,revision:row.serverRevision,
            created_at:row.createdAt?new Date(row.createdAt).toISOString():undefined,deleted_at:row.deleted?'2026-10-13T00:00:00Z':null}));
        }
        evidence.commits++;receipts.set(input.mutationId,receipt);
        if(mode==='lost-receipt'){mode=null;throw Object.assign(Error('Synthetic lost receipt'),{status:503});}
        return receipt;
      }
      throw Error('Unknown synthetic endpoint');
    }
  };
}
