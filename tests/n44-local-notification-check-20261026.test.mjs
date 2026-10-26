import { test } from 'node:test';
import assert from 'node:assert/strict';
import { showLocalNotificationCheck } from '../src/lib/notification-push-browser.js';

const make = (permission='granted',sw='https://rakeezx.com/sw.js') => {
 const calls = [];
 const reg = {active:{scriptURL:sw},showNotification:async (title,opts)=>{calls.push({title,opts});}};
 const win = {isSecureContext:true,Notification:{permission},location:{origin:'https://rakeezx.com'},
   navigator:{serviceWorker:{getRegistration:async path=>{assert.equal(path,'/');return reg;}}}};
 return {win,calls,reg};
};
test('explicit diagnostic requests only a generic on-device notification',async()=>{
 const {win,calls}=make();
 assert.equal(await showLocalNotificationCheck(win),'display_requested');
 assert.equal(calls.length,1);
 assert.match(calls[0].title,/ركيز|رَكيز/);
 assert.match(calls[0].opts.body,/اختبار محلي/);
 assert.equal(calls[0].opts.tag.startsWith('n44:'),false);
 assert.equal(Object.hasOwn(calls[0].opts,'data'),false);
});
test('permission not granted never requests service worker notification',async()=>{
 const {win,calls}=make('default');
 assert.equal(await showLocalNotificationCheck(win),'permission_unavailable');
 assert.equal(calls.length,0);
});
test('foreign service worker and wrong scope are never trusted',async()=>{
 for(const script of ['https://foreign.invalid/sw.js','https://rakeezx.com/admin/sw.js']){
  const {win,calls}=make('granted',script);
  assert.equal(await showLocalNotificationCheck(win),'worker_unavailable');
  assert.equal(calls.length,0);
 }
});
test('notification display failure stays reported without pretending OS arrival',async()=>{
 const {win,reg}=make();
 reg.showNotification=async()=>{throw Error('display failed');};
 assert.equal(await showLocalNotificationCheck(win),'unavailable');
});
