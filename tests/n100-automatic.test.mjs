import 'fake-indexeddb/auto';
import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {fixture,owner,source,target,second} from './n100-account-fixture.mjs';
import {planScoreDistributionCopy,distributionCopyToken} from '../src/lib/score-distribution-copy.js';
import * as db from '../src/lib/db.js';
import * as store from '../src/store.js';
import {demoDescriptor} from '../src/lib/workspaces.js';
global.document={documentElement:{setAttribute(){},removeAttribute(){},classList:{add(){},remove(){}}},querySelector:()=>({setAttribute(){}})};
global.matchMedia=()=>({matches:false});
before(async()=>store.activateWorkspace(demoDescriptor()));
after(async()=>{store.closeChannel();await db.closeDB();});
const plan=rows=>planScoreDistributionCopy(rows,source,[target,second],{ownerId:owner,mode:'automatic-safe'});
test('automatic mixed targets preserve recorded labels/dates/history and zero while adding empty definitions',()=>{
  const rows=fixture();rows.scores.find(row=>row.id==='n73-cap').value=0;
  const review=plan(rows);
  assert.equal(review.targets.length,2);
  assert.equal(review.writes.scores.put.length,0);assert.equal(review.writes.scoreSubitemCompletions.put.length,0);
  const child=review.writes.scoreSubitems.put.find(row=>row.id==='n100-target-0');
  assert.equal(child.name,'اسم جديد 0');assert.equal(child.createdAt,Date.parse('2026-02-01'));
  assert.equal(child.dueDate,'2026-11-02');assert.equal(child.startDate,'2026-11-01');
  assert.ok(review.targets[1].impact.every(row=>row.created));
});
test('conflicting recorded max/count/weights/type/ambiguity retains only that parent and actual total',()=>{
  for(const change of [
    rows=>rows.items.find(row=>row.id==='n100-target').max=11,
    rows=>rows.scoreSubitems.find(row=>row.id==='n100-target-0').value=4,
    rows=>rows.scoreSubitems.find(row=>row.id==='n100-target-1').deleted=true,
    rows=>rows.items.find(row=>row.id==='n100-target').scoreMode='direct',
    rows=>rows.items.push({...rows.items.find(row=>row.id==='n100-target'),id:'duplicate'}),
  ]) {
    const rows=fixture();change(rows);rows.items.push({...rows.items.find(row=>row.id==='n73-source-exam'),id:'new-safe',name:'إضافة آمنة',max:3});
    const original=structuredClone(rows),review=plan(rows);
    assert.deepEqual(rows,original);
    assert.equal(review.targets[0].impact.find(row=>row.name==='الواجبات').retained,true);
    assert.ok(review.writes.items.put.some(row=>row.teachingId===target && row.id!=='n100-target'));
    assert.equal(review.writes.items.put.some(row=>row.id==='n100-target'),false);
    assert.equal(review.writes.scoreSubitems.put.some(row=>row.itemId==='n100-target'),false);
    assert.equal(review.writes.scores.put.length,0);
    const expected=rows.items.filter(row=>row.teachingId===target&&!row.deleted).reduce((sum,row)=>sum+row.max,0);
    assert.equal(review.targets[0].afterTotal,expected+3);
  }
});
test('blank incompatible definition may refresh; zero/manual/automatic records must be retained',()=>{
  for(const [value,manualValue,auto,retained] of [[null,null,null,false],[0,null,null,true],[null,0,null,true],[null,null,'attendance',true]]) {
    const rows=fixture(),item=rows.items.find(row=>row.id==='n73-target-exam');item.max=25;item.auto=auto;
    for(const score of rows.scores.filter(row=>row.itemId===item.id))Object.assign(score,{value,manualValue,derivedValue:null});
    const review=plan(rows),impact=review.targets[0].impact.find(row=>row.name===item.name);
    assert.equal(impact.retained===true,retained);
    if(!retained)assert.equal(review.writes.items.put.find(row=>row.id===item.id).max,20);
  }
});
test('stable origin outranks duplicate labels and does not create an ambiguous parent',()=>{
  const rows=fixture();rows.items.find(row=>row.id==='n100-target').distributionOriginId='n100-source';
  rows.items.push({...rows.items.find(row=>row.id==='n100-target'),id:'same-label-extra',distributionOriginId:null});
  const review=plan(rows);
  assert.equal(review.targets[0].impact.find(row=>row.name==='الواجبات').retained===true,false);
  assert.equal(review.writes.items.put.filter(row=>row.teachingId===target&&row.name==='الواجبات').length,1);
});
test('automatic synthetic review also binds authoritative participation/attendance events',()=>{
  const rows=fixture(),token=distributionCopyToken(rows,source,[target],'automatic-safe');
  rows.logs.push({id:'new-event',teachingId:target,studentId:'n73-student1',kind:'participation',delta:0});
  assert.notEqual(distributionCopyToken(rows,source,[target],'automatic-safe'),token);
  const afterLog=distributionCopyToken(rows,source,[target],'automatic-safe');
  rows.attendance=[{id:'new-attendance',teachingId:target,studentId:'n73-student1',status:'present'}];
  assert.notEqual(distributionCopyToken(rows,source,[target],'automatic-safe'),afterLog);
});
test('actual automatic Demo/store review rejects a gained zero across all targets before writing',async()=>{
  const rows=fixture();for(const records of Object.values(rows))for(const row of records){delete row.ownerId;delete row.serverCanonical;delete row.serverRevision;delete row.canonicalId;}
  await db.clearAll();for(const [name,records] of Object.entries(rows))await db.putMany(name,records);await store.init();
  const review=store.reviewScoreDistributionCopy(source,[target,second],{mode:'automatic-safe'});assert.equal(review.mode,'automatic-safe');
  const score=await db.get('scores','n100-unmarked-score');await db.put('scores',{...score,value:0});
  const before=await db.getAll('items');await assert.rejects(()=>store.applyReviewedScoreDistribution(source,[target,second],{expectedToken:review.token,confirmed:true,mode:'automatic-safe'}),/تغيّر/);
  assert.deepEqual(await db.getAll('items'),before);
});
