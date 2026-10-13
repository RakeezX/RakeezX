import 'fake-indexeddb/auto';
import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {fixture,owner,source,target,second} from './n100-account-fixture.mjs';
import {planScoreDistributionCopy} from '../src/lib/score-distribution-copy.js';
import * as db from '../src/lib/db.js';
import * as store from '../src/store.js';
import {demoDescriptor} from '../src/lib/workspaces.js';
global.document={documentElement:{setAttribute(){},removeAttribute(){},classList:{add(){},remove(){}}},querySelector:()=>({setAttribute(){}})};
global.matchMedia=()=>({matches:false});
before(async()=>store.activateWorkspace(demoDescriptor()));
after(async()=>{store.closeChannel();await db.closeDB();});
const review=current=>planScoreDistributionCopy(current,source,[target,second],{ownerId:owner,mode:'preserve-target'});
test('synthetic planner and real Demo store preserve target marks/IDs/history and actual new creation time',async()=>{
  const rows=fixture();for(const records of Object.values(rows))for(const row of records){delete row.ownerId;delete row.serverCanonical;delete row.serverRevision;delete row.canonicalId;}
  await db.clearAll();for(const [name,records] of Object.entries(rows))await db.putMany(name,records);await store.init();
  const scores=await db.getAll('scores'),completions=await db.getAll('scoreSubitemCompletions');
  const reviewed=store.reviewScoreDistributionCopy(source,[target,second],{mode:'preserve-target'});
  await assert.rejects(()=>store.applyReviewedScoreDistribution(source,[target,second],{expectedToken:reviewed.token,confirmed:true}),/تغيّر/);
  const beforeTime=Date.now();await store.applyReviewedScoreDistribution(source,[target,second],{expectedToken:reviewed.token,confirmed:true,mode:'preserve-target'});
  assert.deepEqual(await db.getAll('scores'),scores);assert.deepEqual(await db.getAll('scoreSubitemCompletions'),completions);
  const targetSub=await db.get('scoreSubitems','n100-target-0');assert.equal(targetSub.name,'اسم جديد 0');assert.equal(targetSub.startDate,'2026-11-01');assert.equal(targetSub.dueDate,'2026-11-02');assert.equal(targetSub.createdAt,Date.parse('2026-02-01'));
  const targetItemIds=new Set((await db.getAll('items')).filter(row=>row.teachingId===second).map(row=>row.id));
  for(const row of (await db.getAll('scoreSubitems')).filter(row=>targetItemIds.has(row.itemId)))assert.ok(row.createdAt>=beforeTime);
  await db.closeDB();await store.init();assert.equal(store.state.scores.find(row=>row.id==='n100-late').value,2);
  assert.equal(store.reviewScoreDistributionCopy(source,[target,second],{mode:'preserve-target'}).changedCount,0);
});
test('preservation rejects ambiguous origins/count/order/type/weight/name while definitions-only keeps legacy contract',()=>{
  for(const mutate of [
    rows=>rows.scoreSubitems.find(row=>row.id==='n100-target-0').value=4,
    rows=>rows.scoreSubitems.find(row=>row.id==='n100-target-0').latePoints=0,
    rows=>rows.scoreSubitems.find(row=>row.id==='n100-target-0').order=1,
    rows=>rows.scoreSubitems.find(row=>row.id==='n100-target-1').deleted=true,
    rows=>rows.items.find(row=>row.id==='n100-target').scoreMode='direct',
    rows=>rows.items.push({...rows.items.find(row=>row.id==='n100-target'),id:'duplicate',name:'  الواجبات  '}),
    rows=>rows.scoreSubitems.filter(row=>row.itemId==='n100-target').forEach(row=>row.distributionOriginId='n100-source-0'),
  ]) {
    const rows=fixture();mutate(rows);const before=structuredClone(rows),plan=review(rows);
    assert.deepEqual(rows,before);assert.equal(plan.excludedTargets.length,1);assert.equal(plan.excludedTargets[0].teachingId,target);
    for(const written of plan.writes.scoreSubitems.put)assert.notEqual(written.itemId,'n100-target');
    assert.equal(plan.writes.scores.put.length,0);assert.equal(plan.writes.scoreSubitemCompletions.put.length,0);
  }
  const rows=fixture();rows.items.find(row=>row.id==='n73-target-exam').max=25;rows.scores.find(row=>row.id==='n73-cap').value=23;
  const legacy=planScoreDistributionCopy(rows,source,[target],{ownerId:owner});
  assert.equal(legacy.writes.scores.put.find(row=>row.id==='n73-cap').value,20);
  assert.equal(review(rows).excludedTargets.length,1);
});
test('actual Demo transaction rejects stale grade/date evidence atomically for all targets',async()=>{
  const rows=fixture();for(const records of Object.values(rows))for(const row of records){delete row.ownerId;delete row.serverCanonical;delete row.serverRevision;}
  await db.clearAll();for(const [name,records] of Object.entries(rows))await db.putMany(name,records);await store.init();
  const review=store.reviewScoreDistributionCopy(source,[target,second],{mode:'preserve-target'});
  const sub=await db.get('scoreSubitems','n100-target-0');await db.put('scoreSubitems',{...sub,dueDate:'2026-12-01'});
  const before=await db.getAll('items');await assert.rejects(()=>store.applyReviewedScoreDistribution(source,[target,second],{expectedToken:review.token,mode:'preserve-target',confirmed:true}),/تغيّر/);
  assert.deepEqual(await db.getAll('items'),before);assert.equal((await db.getAll('items')).some(row=>row.teachingId===second),false);
});
