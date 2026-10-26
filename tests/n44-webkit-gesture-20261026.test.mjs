import test from 'node:test';
import assert from 'node:assert/strict';
import { createECDH } from 'node:crypto';
import { createPushBrowser } from '../src/lib/notification-push-browser.js';
import { createPushClient } from '../src/lib/notification-push-client.js';

const ec = createECDH('prime256v1');
ec.generateKeys();
const publicKey = ec.getPublicKey().toString('base64url');
const context = { mode: 'account', verified: true, ownerId: 'owner-X',
  workspaceId: 'workspace-X', deviceId: 'device-X', authRevision: 'revision-X' };

test('native subscription starts synchronously inside user gesture after prior readiness', async () => {
  const events=[];
  let activated=false, permission='default', subscribed=false;
  const native={toJSON:()=>({endpoint:'https://web.push.apple.com/Q_TEST_ONLY'}),
    async unsubscribe(){events.push('unsubscribe');return true;}};
  const reg={
    active:{scriptURL:'https://rakeezx.com/sw.js'},
    pushManager:{
      async getSubscription(){events.push('existing');return null;},
      subscribe(options){
        events.push('native-subscribe');
        assert.equal(activated,true,'native call must be inside user click activation');
        assert.equal(options.userVisibleOnly,true);
        assert.equal(options.applicationServerKey.length,65);
        subscribed=true;
        permission='granted';
        return Promise.resolve(native);
      },
    },
  };
  const win={
    location:{origin:'https://rakeezx.com'},isSecureContext:true,
    atob:value=>Buffer.from(value,'base64').toString('binary'),
    PushManager:class PushManager{},
    MessageChannel:class MessageChannel{},
    get Notification(){return {get permission(){return permission;},requestPermission(){events.push('permission');throw Error('must not prompt separately');}};},
    navigator:{
      userActivation:{get isActive(){return activated;}},
      serviceWorker:{async getRegistration(){events.push('registration');return reg;}},
    },
  };
  const browser=createPushBrowser({window:win,publicKey,navigate:()=>{}});
  assert.equal(browser.supported(),true);
  await browser.existing(); // caller prepared and confirmed SW before the user clicked
  const gateway={
    async register(){events.push('remote-register');return true;},
    async remove(){events.push('remote-remove');return true;},
  };
  const client=createPushClient({browser,gateway,getVerifiedContext:()=>context,clock:Date.now,resolveAction:()=>null});
  activated=true;
  const pending=client.optIn(); // no await until native subscribe is invoked
  activated=false;
  assert.equal(subscribed,true);
  assert.equal((await pending).status,'subscribed');
  assert.deepEqual(events,['registration','existing','native-subscribe','remote-register']);
  assert.equal((await client.revoke()).status,'revoked');
  assert.ok(events.includes('unsubscribe'));
});

test('native subscribe refuses missing or expired gesture before creating a subscription', async () => {
  let calls=0;
  const win={
    location:{origin:'https://rakeezx.com'},isSecureContext:true,
    atob:value=>Buffer.from(value,'base64').toString('binary'),
    Notification:{permission:'granted'},PushManager:class PushManager{},MessageChannel:class MessageChannel{},
    navigator:{userActivation:{isActive:false},serviceWorker:{async getRegistration(){return {
      active:{scriptURL:'https://rakeezx.com/sw.js'},
      pushManager:{async getSubscription(){return null;},subscribe(){calls++;return Promise.resolve(null);}},
    };}}},
  };
  const browser=createPushBrowser({window:win,publicKey,navigate:()=>{}});
  await browser.existing();
  assert.throws(()=>browser.subscribeOnGesture(),/unavailable/);
  assert.equal(calls,0);
});

test('denied notification permission never creates native subscription', async () => {
  let calls=0;
  const browser={
    supported:()=>true,hasUserActivation:()=>true,permission:()=> 'denied',
    subscribeOnGesture(){calls++;return Promise.resolve(null);},
  };
  const client=createPushClient({browser,getVerifiedContext:()=>context,gateway:{},clock:Date.now,resolveAction:()=>null});
  assert.equal((await client.optIn()).status,'denied');
  assert.equal(calls,0);
});

test('owner switch during native subscription cleans the exact prior subscription without remote registration', async () => {
  let currentContext=context, complete;
  const signal=new Promise(resolve=>{complete=resolve;});
  let removed=0,registered=0;
  const subscription={
    toJSON:()=>({endpoint:'https://web.push.apple.com/Q_TEST_ONLY'}),
    async unsubscribe(){removed++;return true;},
  };
  const browser={
    supported:()=>true,hasUserActivation:()=>true,permission:()=> 'granted',
    subscribeOnGesture(){return signal;},
  };
  const gateway={async register(){registered++;return true;},async remove(){return true;}};
  const client=createPushClient({browser,gateway,getVerifiedContext:()=>currentContext,
    clock:Date.now,resolveAction:()=>null});
  const outcome=client.optIn();
  currentContext={...context,ownerId:'another-owner'};
  complete(subscription);
  assert.equal((await outcome).status,'stale_context');
  assert.equal(removed,1);
  assert.equal(registered,0);
});
