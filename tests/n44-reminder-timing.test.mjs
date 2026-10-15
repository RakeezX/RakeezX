import 'fake-indexeddb/auto';
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryStorage } from './n73-live/local-env.mjs';
import * as store from '../src/store.js';
import * as cloud from '../src/lib/cloud.js';
import * as db from '../src/lib/db.js';
import { runtimeSyncOwnershipGuard } from '../src/lib/sync-ownership.js';
import { currentNotificationContext, currentNotificationEvents, notificationDestination } from '../src/lib/notification-events.js';
import { createNotificationCenter, updateNotificationCenter, notificationSnapshot, MAX_EVENT_AGE_MS } from '../src/lib/notification-center.js';
import { notificationStorageKey, readNotificationPreferences, writeNotificationPreferences } from '../src/lib/notification-state.js';
import { prepareAccount, fixedNow, owner, otherOwner } from './n44-fixture.mjs';
globalThis.localStorage = new MemoryStorage();
globalThis.document = { documentElement:{ setAttribute(){}, removeAttribute(){} }, querySelector:()=>null };
globalThis.matchMedia = () => ({ matches:false });
before(async () => { await prepareAccount(); });
after(() => { store.deactivateWorkspace(); });
const context = () => currentNotificationContext(store, cloud);
test('actual account store uses teaching date/year instead of stale selected calendar; no writes', async () => {
  const before = await db.getAll('outbox');
  const events = currentNotificationEvents(store, context(), fixedNow);
  assert.deepEqual(events.map(event => event.targetId), ['n44-session','n44-due','n44-soon','n44-too-far']);
  assert.match(events[0].title, /قريب/);
  assert.equal(currentNotificationEvents(store, context(), fixedNow+15*60000)[0].title, 'حصتك الحالية');
  assert.equal(currentNotificationEvents(store, context(), fixedNow+60*60000).some(event => event.kind==='lesson'), false);
  assert.equal(currentNotificationEvents(store, context(), new Date('2026-11-02T09:45:00+03:00').getTime()).length, 0);
  assert.deepEqual(await db.getAll('outbox'), before);
});
test('holidays resolve through actual teaching year; cancelled, deleted and foreign scope suppressed', () => {
  store.state.calendars.push({ id:'current-calendar', yearId:'n44-year', source:'custom' });
  store.state.calendarDays.push({ id:'holiday', calendarId:'current-calendar', date:'2026-10-14', kind:'holiday' });
  assert.equal(currentNotificationEvents(store, context(), fixedNow).some(event => event.kind==='lesson'), false);
  store.state.calendars.pop(); store.state.calendarDays.pop();
  const teaching = store.getTeaching('n44-teaching'); teaching.deleted = true;
  assert.deepEqual(currentNotificationEvents(store, context(), fixedNow), []); teaching.deleted = false;
});
test('owner/auth/guard/unknown/demo fail closed', () => {
  const ws = store.getActiveWorkspace(), session = cloud.session;
  cloud.setMockAuth({id:otherOwner}, { ...session, user:{id:otherOwner} }); assert.equal(context(), null);
  cloud.setMockAuth(session.user, session);
  localStorage.removeItem(cloud.AUTH_STORAGE_KEY); assert.equal(context(), null);
  localStorage.setItem(cloud.AUTH_STORAGE_KEY, JSON.stringify(session));
  runtimeSyncOwnershipGuard.setWorkspace({ ...ws, authUserId:otherOwner }); assert.equal(context(), null);
  runtimeSyncOwnershipGuard.setWorkspace(ws);
  assert.equal(currentNotificationContext(store, cloud, {getItem(){throw Error('denied');}}), null);
  assert.equal(currentNotificationEvents(store, {...context(), workspaceId:'unknown'}, fixedNow).length,0);
  assert.equal(createNotificationCenter({mode:'demo',verified:true,ownerId:owner,workspaceId:'demo',deviceId:'device'}).scope,null);
});
test('read/dismiss/dedup/expiry, clock adjustment, bounded private preferences, storage failure', () => {
  const ctx = context(), events = currentNotificationEvents(store, ctx, fixedNow);
  let state = updateNotificationCenter(createNotificationCenter(ctx),ctx,{type:'receive',events:[...events,...events]},fixedNow);
  assert.equal(notificationSnapshot(state,ctx,fixedNow).unread,4);
  state = updateNotificationCenter(state,ctx,{type:'read',id:events[0].id},fixedNow);
  state = updateNotificationCenter(state,ctx,{type:'dismiss',id:events[1].id},fixedNow);
  state = updateNotificationCenter(state,ctx,{type:'receive',events},fixedNow-60000);
  assert.equal(notificationSnapshot(state,ctx,fixedNow-60000).unread,2);
  assert.equal(writeNotificationPreferences(state,ctx,fixedNow),true);
  const saved = readNotificationPreferences(ctx,fixedNow);
  assert.deepEqual(saved,state.preferences);
  for (const row of saved) assert.deepEqual(Object.keys(row).sort(),['dismissedAt','id','readAt']);
  assert.notEqual(notificationStorageKey(ctx),notificationStorageKey({...ctx,ownerId:otherOwner}));
  assert.notEqual(notificationStorageKey(ctx),notificationStorageKey({...ctx,deviceId:'second-device'}));
  assert.equal(notificationStorageKey(null),null);
  assert.equal(readNotificationPreferences(ctx,fixedNow+MAX_EVENT_AGE_MS+1).length,0);
  assert.equal(writeNotificationPreferences(state,ctx,fixedNow,{setItem(){throw Error('quota');}}),false);
  assert.deepEqual(readNotificationPreferences(ctx,fixedNow,{getItem(){throw Error('denied');}}),[]);
  assert.equal(notificationSnapshot(state,{...ctx,ownerId:otherOwner},fixedNow).unread,0);
  assert.equal(notificationSnapshot(state,ctx,events[0].expiresAt).items.some(e=>e.kind==='lesson'),false);
  for(let i=0;i<120;i++) state=updateNotificationCenter(state,ctx,{type:'receive',events:[{...events[0],id:'lesson:'+i}]},fixedNow),
    state=updateNotificationCenter(state,ctx,{type:'read',id:'lesson:'+i},fixedNow);
  assert.equal(state.preferences.length,100);
});
test('allowlisted link revalidates actual deleted child/parent and never accepts URL text', () => {
  const ctx=context(),events=currentNotificationEvents(store,ctx,fixedNow);
  assert.match(notificationDestination(store,ctx,events[0].id,fixedNow),/^\/teaching\/n44-teaching\/attendance\?session=n44-session$/);
  assert.equal(notificationDestination(store,ctx,'https://evil.example',fixedNow),null);
  const child=store.state.scoreSubitems.find(r=>r.id==='n44-due');child.deleted=true;
  assert.equal(notificationDestination(store,ctx,events[1].id,fixedNow),null);child.deleted=false;
  const parent=store.state.items.find(r=>r.id==='n44-item');parent.deleted=true;
  assert.equal(notificationDestination(store,ctx,events[1].id,fixedNow),null);parent.deleted=false;
  parent.scoreMode='direct';assert.equal(notificationDestination(store,ctx,events[1].id,fixedNow),null);parent.scoreMode='subitems';
});

test('15 minute boundary and four exact daily stages, no catchup, local midnight expiry', () => {
  const ctx=context(), start=new Date('2026-10-14T10:00:00+03:00').getTime();
  assert.equal(currentNotificationEvents(store,ctx,start-15*60000-1).some(e=>e.kind==='lesson'),false);
  assert.equal(currentNotificationEvents(store,ctx,start-15*60000).some(e=>e.kind==='lesson'),true);
  assert.equal(currentNotificationEvents(store,ctx,start+45*60000).some(e=>e.kind==='lesson'),false);
  const ids=[];
  for(const day of [14,15,16,17]) {
    const now=new Date(`2026-10-${day}T12:00:00+03:00`).getTime();
    const event=currentNotificationEvents(store,ctx,now).find(e=>e.targetId==='n44-too-far');
    assert.ok(event);ids.push(event.id);
    assert.equal(event.expiresAt,new Date(`2026-10-${day+1}T00:00:00+03:00`).getTime());
    let state=updateNotificationCenter(createNotificationCenter(ctx),ctx,{type:'receive',events:[event,event]},now);
    state=updateNotificationCenter(state,ctx,{type:'dismiss',id:event.id},now);
    writeNotificationPreferences(state,ctx,now);
    state=createNotificationCenter(ctx);state.preferences=readNotificationPreferences(ctx,now-60000);
    state=updateNotificationCenter(state,ctx,{type:'receive',events:[event,event]},now-60000);
    assert.equal(notificationSnapshot(state,ctx,now-60000).items.length,0);
  }
  assert.equal(new Set(ids).size,4);
  for(const day of [13,18,19]) assert.equal(currentNotificationEvents(store,ctx,new Date(`2026-10-${day}T12:00:00+03:00`).getTime()).some(e=>e.targetId==='n44-too-far'),false);
});

test('daily identity survives forward day, backward day, owner switch and reload', () => {
  const ctx=context();let state=createNotificationCenter(ctx);
  const seen=[];
  for(const day of [14,15,14,15]) {
    const now=new Date(`2026-10-${day}T12:00:00+03:00`).getTime();
    const events=currentNotificationEvents(store,ctx,now).filter(e=>e.targetId==='n44-too-far');
    state.preferences=readNotificationPreferences(ctx,now);
    state=updateNotificationCenter(state,ctx,{type:'receive',events:[...events,...events]},now);
    assert.equal(notificationSnapshot(state,ctx,now).items.length,seen.includes(day)?0:1);
    if(!seen.includes(day)) {
      state=updateNotificationCenter(state,ctx,{type:'dismiss',id:events[0].id},now);
      writeNotificationPreferences(state,ctx,now);seen.push(day);
    }
    const foreign={...ctx,ownerId:otherOwner};
    assert.equal(notificationSnapshot(state,foreign,now).items.length,0);
    state=createNotificationCenter(ctx);
  }
});
