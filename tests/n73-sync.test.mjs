import test from 'node:test';
import assert from 'node:assert/strict';
import { device } from './n73-live/device.mjs';
import { encodeSyncV2Patch, decodeSyncV2Canonical } from '../src/lib/sync-v2.js';
const owner='a7300000-0000-4000-8000-000000000001';

test('durable distribution command retries exact envelope and adopts all canonical tombstones atomically', async () => {
  let calls=0; const sent=[];
  const actor=await device(owner,'local-A1',{ async applyScoreDistributionPlan(envelope) {
    sent.push(structuredClone(envelope)); calls++;
    if(calls===1) throw new Error('lost synthetic receipt');
    const row={owner_id:owner,revision:3,deleted_at:null};
    return {mutationId:envelope.mutationId,planId:envelope.planId,protocol:'N73_D119_V2',
      items:[{...row,id:'target',max:20,name:'Exam',teaching_id:'target-teaching'}],
      score_subitems:[{...row,id:'sub',item_id:'target',name:'Part',value:3,distribution_origin_id:'source-sub'}],
      score_subitem_completions:[{...row,id:'old-completion',subitem_id:'sub',student_id:'student',checked:true,deleted_at:'2026-10-12T12:00:00Z'}],
      scores:[{...row,id:'score',item_id:'target',student_id:'student',value:20}]};
  }});
  try {
    const queued=await actor.engine.queueCommand({store:'items',recordId:'teaching',command:'score:distribution_apply',patch:{planId:'p',token:'hash',confirmed:true}});
    assert.equal((await actor.database.getAll('items')).length,0);
    assert.equal((await actor.engine.dispatchPending()).failed,1);
    assert.equal((await actor.database.getAll('items')).length,0);
    assert.equal((await actor.engine.dispatchPending()).acknowledged,1);
    assert.deepEqual(sent[0],sent[1]);
    assert.equal((await actor.database.get('scores','score')).value,20);
    assert.equal((await actor.database.get('scoreSubitemCompletions','old-completion')).deleted,true);
    assert.equal((await actor.database.get('scoreSubitems','sub')).distributionOriginId,'source-sub');
    assert.equal(await actor.database.get('outbox',queued.id),undefined);
  } finally { await actor.close(); }
});

test('foreign owner or wrong plan receipt cannot partially replace local rows', async()=>{
  for(const bad of ['owner','plan']) {
    const actor=await device(owner,'bad-'+bad,{async applyScoreDistributionPlan(e){return {
      mutationId:e.mutationId,planId:bad==='plan'?'other':e.planId,protocol:'N73_D119_V2',
      items:[{id:'target',owner_id:bad==='owner'?'b7300000-0000-4000-8000-000000000002':owner,revision:2,max:20}],
      score_subitems:[],score_subitem_completions:[],scores:[]};}});
    try {
      await actor.database.put('items',{id:'target',max:25});
      await actor.engine.queueCommand({store:'items',recordId:'teaching',command:'score:distribution_apply',patch:{planId:'p',token:'hash',confirmed:true}});
      assert.equal((await actor.engine.dispatchPending()).acknowledged,0);
      assert.equal((await actor.database.get('items','target')).max,25);
      assert.equal((await actor.database.getAll('outbox')).length,1);
    } finally {await actor.close();}
  }
});

test('subitem origin survives canonical, backup patch and restore field serialization',()=>{
  const row={id:'sub',item_id:'target',name:'Part',value:3,order:0,distribution_version:2,distribution_origin_id:'source-sub',revision:2,deleted_at:null};
  const decoded=decodeSyncV2Canonical('scoreSubitems',row);
  assert.equal(decoded.distributionOriginId,'source-sub');
  assert.equal(encodeSyncV2Patch('scoreSubitems',decoded).distribution_origin_id,'source-sub');
});
