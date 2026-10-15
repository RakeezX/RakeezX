import test from 'node:test';
import assert from 'node:assert/strict';
import { MemoryStorage } from './n73-live/local-env.mjs';
import { readNotificationCategories, writeNotificationCategory, notificationCategoryAllowed } from '../src/lib/notification-state.js';
const context={mode:'account',verified:true,ownerId:'synthetic-A',workspaceId:'workspace-A',deviceId:'device-A'};
test('category flags default on, reload, owner/workspace/device isolation, allowlisted payload',()=>{
 const storage=new MemoryStorage();
 assert.deepEqual(readNotificationCategories(context,storage),{lesson:true,due:true});
 assert.equal(writeNotificationCategory(context,'lesson',false,storage),true);
 assert.deepEqual(readNotificationCategories(context,storage),{lesson:false,due:true});
 assert.equal(writeNotificationCategory(context,'due',false,storage),true);
 for(const field of ['ownerId','workspaceId','deviceId'])assert.deepEqual(readNotificationCategories({...context,[field]:'other'},storage),{lesson:true,due:true});
 assert.equal(readNotificationCategories(context,storage).due,false);
 assert.equal(writeNotificationCategory(null,'lesson',false,storage),false);
 assert.equal(writeNotificationCategory({...context,verified:false},'lesson',false,storage),false);
 assert.equal(writeNotificationCategory(context,'critical',false,storage),false);
 assert.equal(writeNotificationCategory(context,'lesson','false',storage),false);
 assert.equal(notificationCategoryAllowed({kind:'lesson'},{lesson:false}),false);
 assert.equal(notificationCategoryAllowed({kind:'due'},{due:false}),false);
 for(const event of [{kind:'lesson',critical:true},{kind:'protection'},{kind:'lease'},{kind:'future-critical'}])assert.equal(notificationCategoryAllowed(event,{lesson:false,due:false}),true);
});
test('corrupt/unavailable storage defaults safely; failures never claim persistence',()=>{
 assert.deepEqual(readNotificationCategories(context,{getItem(){return '{bad';}}),{lesson:true,due:true});
 assert.deepEqual(readNotificationCategories(context,{getItem(){throw Error('denied');}}),{lesson:true,due:true});
 assert.equal(writeNotificationCategory(context,'due',false,{getItem(){return null;},setItem(){throw Error('quota');}}),false);
});
