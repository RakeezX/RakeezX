/** WNS WebPush qualification: mock socket only, zero real provider requests. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { approvedProviderOrigins, trustedSubscription } from '../drafts/n44-push/provider-policy.mjs';
import { WNS_WEBPUSH_ORIGIN } from '../drafts/n44-push/shared.mjs';
import { makeFixture } from './fixtures/n44-crypto-sender/fixture.mjs';

// Edge alternate-channel subscriptions use /w/; root / belongs to older WNS examples.
const ENDPOINT='https://wns2-ln2p.notify.windows.com/w/?token=OPAQUE_TEST_123%2FABC%3D';
test('Edge WNS requires explicit trusted provider, preserves opaque endpoint, encrypts VAPID and accepts 200', async()=>{
 const f=makeFixture({origin:WNS_WEBPUSH_ORIGIN,endpoint:ENDPOINT,wns:true});
 try {
  assert.deepEqual(approvedProviderOrigins([WNS_WEBPUSH_ORIGIN]),[WNS_WEBPUSH_ORIGIN]);
  assert.equal(trustedSubscription(f.subscription,[WNS_WEBPUSH_ORIGIN]).endpoint,ENDPOINT);
  assert.equal((await f.register()).status,'registered');
  assert.equal((await f.deliver()).status,'sent');
  assert.equal(f.transportFailure,undefined);
  assert.equal(f.networkCalls,1);
  assert.equal(f.transportChecks,1);
  assert.ok(f.requests.every(r=>r.destroyed));
 }finally{f.shutdown();}
});
test('WNS 200 not misclassified as acceptance on ordinary FCM',async()=>{
 const f=makeFixture();
 try{f.statusCode=200;assert.equal((await f.register()).status,'registered');
  assert.notEqual((await f.deliver()).status,'sent');assert.equal(f.networkCalls,1);
 }finally{f.shutdown();}
});
test('only approved WNS subdomain and bounded exact opaque query are allowed',()=>{
 const f=makeFixture({origin:WNS_WEBPUSH_ORIGIN,endpoint:ENDPOINT,wns:true});
 try{
   const bad=[
    'https://wns2-prod13.notify.windows.com.evil.test/?token=OPAQUE_TEST_123',
    'https://another.notify.windows.com/?token=OPAQUE_TEST_123',
    'https://notify.windows.com/?token=OPAQUE_TEST_123',
    'https://wns2-prod13.notify.windows.com/',
    'http://wns2-prod13.notify.windows.com/?token=OPAQUE_TEST_123',
    'https://wns2-prod13.notify.windows.com:8443/?token=OPAQUE_TEST_123',
    'https://wns2-prod13.notify.windows.com/admin?token=OPAQUE_TEST_123',
    'https://wns2-prod13.notify.windows.com/w/extra?token=OPAQUE_TEST_123',
    'https://wns2-prod13.notify.windows.com/w/?token=OPAQUE_TEST_123&admin=1',
    'https://wns2-prod13.notify.windows.com/w/?wrong=OPAQUE_TEST_123',
    'https://wns2-prod13.notify.windows.com/?token=OPAQUE_TEST_123#junk',
    'https://127.0.0.1/?token=OPAQUE_TEST_123',
    'https://wns2-prod13.notify.windows.com/?token=%0A',
    'https://wns2-prod13.notify.windows.com/?token=OPAQUE_TEST_123\\r\\n'
   ];
   for(const endpoint of bad)assert.throws(()=>trustedSubscription({...f.subscription,endpoint},[WNS_WEBPUSH_ORIGIN]),{message:'n44_crypto_unavailable'},endpoint);
   assert.throws(()=>trustedSubscription(f.subscription,[]),{message:'n44_crypto_unavailable'});
   assert.throws(()=>approvedProviderOrigins(['https://evil.notify.windows.com']),{message:'n44_crypto_unavailable'});
 }finally{f.shutdown();}
});
