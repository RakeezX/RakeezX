import 'fake-indexeddb/auto';
import test, {before,after} from 'node:test';
import assert from 'node:assert/strict';
import {MemoryStorage} from './n73-live/local-env.mjs';
import * as store from '../src/store.js';
import * as cloud from '../src/lib/cloud.js';
import {prepareAccount,fixedNow} from './n44-fixture.mjs';
import {currentNotificationContext,currentNotificationEvents} from '../src/lib/notification-events.js';
import {LESSON_LEAD_MINUTES,DUE_STAGES,readNotificationTiming,writeNotificationTiming,readNotificationCategories,writeNotificationCategory,notificationNow,readNotificationPreferences,writeNotificationPreferences} from '../src/lib/notification-state.js';
import {createNotificationCenter,updateNotificationCenter,notificationSnapshot} from '../src/lib/notification-center.js';
globalThis.localStorage=new MemoryStorage();
globalThis.document={documentElement:{setAttribute(){},removeAttribute(){}},querySelector:()=>null};
globalThis.matchMedia=()=>({matches:false});
before(async()=>prepareAccount());after(()=>store.deactivateWorkspace());
const ctx=()=>currentNotificationContext(store,cloud);
test('all seven selected lead windows include exact boundary and exclude end, foreign/cancelled/archive',()=>{
 const context=ctx(),start=fixedNow+15*60000;
 for(const minutes of LESSON_LEAD_MINUTES){
  assert.equal(writeNotificationTiming(context,{lessonMinutes:minutes}),true);
  const events=now=>currentNotificationEvents(store,context,now).filter(e=>e.kind==='lesson');
  assert.equal(events(start-minutes*60000-1).length,0);
  assert.deepEqual(events(start-minutes*60000).map(e=>e.targetId),['n44-session']);
  assert.equal(events(start).length,1);assert.equal(events(start+45*60000).length,0);
 }
 writeNotificationTiming(context,{lessonMinutes:15});
});
test('each due stage independently selects exact ISO day, no previous/future catchup',()=>{
 const context=ctx();
 for(const day of DUE_STAGES){
  writeNotificationTiming(context,{dueDays:[day]});
  for(const date of [13,14,15,16,17,18]){
   const now=new Date(`2026-10-${date}T12:00:00+03:00`).getTime();
   const events=currentNotificationEvents(store,context,now).filter(e=>e.targetId==='n44-too-far');
   assert.equal(events.length,date===17-day?1:0);
   if(events.length) assert.ok(events[0].id.endsWith(`2026-10-17:2026-10-${date}`));
  }
 }
 writeNotificationTiming(context,{dueDays:[]});assert.equal(currentNotificationEvents(store,context,fixedNow).filter(e=>e.kind==='due').length,0);
 writeNotificationTiming(context,{dueDays:DUE_STAGES});
});
test('same scoped preference record preserves categories/timing; invalid and unavailable storage safe',()=>{
 const context=ctx();writeNotificationTiming(context,{lessonMinutes:60,dueDays:[0,2]});
 writeNotificationCategory(context,'lesson',false);
 assert.equal(readNotificationTiming(context).lessonMinutes,60);assert.deepEqual(readNotificationTiming(context).dueDays,[2,0]);
 writeNotificationTiming(context,{lessonMinutes:5});assert.equal(readNotificationCategories(context).lesson,false);
 for(const field of ['ownerId','workspaceId','deviceId']){
  const other={...context,[field]:'other'};assert.equal(readNotificationTiming(other).lessonMinutes,15);assert.deepEqual(readNotificationTiming(other).dueDays,DUE_STAGES);
 }
 for(const patch of [{lessonMinutes:7},{dueDays:[4]},{critical:false},{observedAt:NaN}])assert.equal(writeNotificationTiming(context,patch),false);
 assert.equal(writeNotificationTiming(null,{lessonMinutes:5}),false);
 assert.equal(writeNotificationTiming(context,{lessonMinutes:5},{getItem(){return null},setItem(){throw Error('quota')}}),false);
 assert.equal(readNotificationTiming(context,{getItem(){return '{bad'}}).lessonMinutes,15);
 writeNotificationCategory(context,'lesson',true);writeNotificationTiming(context,{lessonMinutes:15,dueDays:DUE_STAGES});
});
test('clock high-water survives reload, preference changes, owner/device switch; no read/dismiss resurrection',()=>{
 const context=ctx(),storage=new MemoryStorage();
 const events=currentNotificationEvents(store,context,fixedNow);
 let state=updateNotificationCenter(createNotificationCenter(context),context,{type:'receive',events},fixedNow);
 state=updateNotificationCenter(state,context,{type:'read',id:events[0].id},fixedNow);
 state=updateNotificationCenter(state,context,{type:'dismiss',id:events[1].id},fixedNow);
 writeNotificationPreferences(state,context,fixedNow,storage);
 notificationNow(context,fixedNow,storage);
 const future=fixedNow+12*86400000;notificationNow(context,future,storage);
 writeNotificationTiming(context,{lessonMinutes:60,dueDays:[0]},storage);
 assert.equal(notificationNow(context,fixedNow-86400000,storage),future);
 state=createNotificationCenter(context);state.preferences=readNotificationPreferences(context,notificationNow(context,fixedNow,storage),storage);
 state=updateNotificationCenter(state,context,{type:'receive',events},notificationNow(context,fixedNow,storage));
 assert.equal(notificationSnapshot(state,context,future).items.length,0);
 assert.equal(notificationNow({...context,ownerId:'B'},fixedNow,storage),fixedNow);
 assert.equal(notificationNow({...context,deviceId:'B'},fixedNow,storage),fixedNow);
 // A backwards local calendar date after a timezone change cannot replay an earlier day.
 writeNotificationTiming(context,{observedDate:'2026-10-15'});
 assert.deepEqual(currentNotificationEvents(store,context,fixedNow),[]);
});
test('DST fold and timezone reinterpretation retain stable read/dismiss identities',()=>{
 const previousTZ=process.env.TZ,context=ctx(),session=store.state.sessions.find(e=>e.id==='n44-session');
 const previous={date:session.date,startTime:session.startTime,endTime:session.endTime};
 try {
  Object.assign(session,{date:'2026-11-01',startTime:'01:30',endTime:'02:30'});
  writeNotificationTiming(context,{lessonMinutes:15,dueDays:DUE_STAGES});
  process.env.TZ='America/New_York';
  const now=new Date('2026-11-01T01:15:00').getTime();
  const event=currentNotificationEvents(store,context,now).find(e=>e.targetId===session.id);assert.ok(event);
  let state=updateNotificationCenter(createNotificationCenter(context),context,{type:'receive',events:[event]},now);
  state=updateNotificationCenter(state,context,{type:'read',id:event.id},now);
  const storage=new MemoryStorage();writeNotificationPreferences(state,context,now,storage);
  process.env.TZ='UTC';
  const movedNow=new Date('2026-11-01T01:15:00').getTime();
  const moved=currentNotificationEvents(store,context,movedNow).find(e=>e.targetId===session.id);assert.equal(moved.id,event.id);
  state=createNotificationCenter(context);state.preferences=readNotificationPreferences(context,movedNow,storage);
  state=updateNotificationCenter(state,context,{type:'receive',events:[moved]},movedNow);
  assert.equal(notificationSnapshot(state,context,movedNow).unread,0);
  state=updateNotificationCenter(state,context,{type:'dismiss',id:event.id},movedNow);
  writeNotificationPreferences(state,context,movedNow,storage);
  state=createNotificationCenter(context);state.preferences=readNotificationPreferences(context,movedNow-60000,storage);
  state=updateNotificationCenter(state,context,{type:'receive',events:[moved]},movedNow-60000);
  assert.equal(notificationSnapshot(state,context,movedNow-60000).items.length,0);
 } finally {Object.assign(session,previous);if(previousTZ===undefined)delete process.env.TZ;else process.env.TZ=previousTZ;}
});

test('selected lead spans local midnight without replaying the previous day',()=>{
 const context=ctx(),session=store.state.sessions.find(e=>e.id==='n44-session');
 const previous={date:session.date,startTime:session.startTime,endTime:session.endTime};
 try {
  Object.assign(session,{date:'2026-10-19',startTime:'00:30',endTime:'01:15'});
  writeNotificationTiming(context,{lessonMinutes:60});
  const now=new Date('2026-10-18T23:30:00').getTime();
  assert.equal(currentNotificationEvents(store,context,now-1).some(e=>e.targetId===session.id),false);
  const event=currentNotificationEvents(store,context,now).find(e=>e.targetId===session.id);
  assert.ok(event);assert.ok(event.id.includes('2026-10-19'));
  writeNotificationTiming(context,{lessonMinutes:30});
  assert.equal(currentNotificationEvents(store,context,now).some(e=>e.targetId===session.id),false);
 } finally {Object.assign(session,previous);writeNotificationTiming(context,{lessonMinutes:15});}
});
