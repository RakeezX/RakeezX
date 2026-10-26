/** Synthetic transaction model + fake DNS/TLS transport; actual new Product ports. */
import assert from 'node:assert/strict';
import { createECDH, randomBytes, createPublicKey, verify } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';
import { checkServerIdentity } from 'node:tls';
import { fixture as priorFixture, RID, payload, NOW } from '../n44-server-preactivation/fakes.mjs';
import { createRegistrationBoundary } from '../../../drafts/n44-push/registration.mjs';
import { createDeliveryBoundary } from '../../../drafts/n44-push/delivery.mjs';
import { createSubscriptionProtector } from '../../../drafts/n44-push/subscription-protector.mjs';
import { createAuditedSender } from '../../../drafts/n44-push/audited-sender.mjs';
import { normalizePushPayload } from '../../../src/lib/notification-push-core.js';
export { RID, payload, NOW };
const require = createRequire(new URL('../../../drafts/n44-push/package.json',import.meta.url));
const ece = require('http_ece');
export const ORIGIN='https://fcm.googleapis.com';
export const PUBLIC={address:'142.250.190.10',family:4}; // Never contacted.
export function keys(syntheticScalar) {
  const ecdh=createECDH('prime256v1');
  if(syntheticScalar)ecdh.setPrivateKey(syntheticScalar);else ecdh.generateKeys();
  // OpenSSL may export a scalar without its leading zero octets. VAPID requires
  // a fixed 32-byte encoding (the upstream generator pads it for the same reason).
  const minimal=ecdh.getPrivateKey(),padded=Buffer.alloc(32);
  minimal.copy(padded,32-minimal.length);
  const privateKey=padded.toString('base64url');minimal.fill(0);padded.fill(0);
  return {ecdh,publicKey:ecdh.getPublicKey().toString('base64url'),
    privateKey};
}
export function cryptoConfig() {
  return {providerOrigins:[ORIGIN],activeKeyId:'seal-1',activeVapidKeyId:'vapid-1',sealingKeys:new Map([['seal-1',randomBytes(32)]]),
    fingerprintKeyId:'fp-1',endpointHmacKeys:new Map([['fp-1',randomBytes(32)]]),bindingHmacKeys:new Map([['fp-1',randomBytes(32)]])};
}
export function makeFixture(options={}) {
  const f=priorFixture(), receiver=keys(), signing=keys();
  f.cryptoConfig=cryptoConfig();
  if (options.origin) f.cryptoConfig.providerOrigins=[options.origin];
  f.subscription={endpoint:options.endpoint ?? ORIGIN+'/wp/SYNTHETIC-DO-NOT-SEND',
    keys:{p256dh:receiver.publicKey,auth:randomBytes(16).toString('base64url')}};
  f.vapid={subject:'mailto:synthetic@example.invalid',publicKey:signing.publicKey,privateKey:signing.privateKey};
  f.vapidKeys=new Map([['vapid-1',f.vapid]]);
  f.protector=createSubscriptionProtector(f.cryptoConfig);
  f.networkCalls=0; f.dnsCalls=0; f.transportChecks=0; f.requests=[]; f.responses=[]; f.receiver=receiver;
  f.resolve=async(host,dnsOptions)=>{
    f.dnsCalls++; assert.equal(host,new URL(f.subscription.endpoint).hostname); assert.deepEqual(dnsOptions,{all:true,verbatim:true});
    if(f.resolveHook)return f.resolveHook();
    return [{...PUBLIC}];
  };
  f.httpsRequest=(o,callback)=>{
    f.networkCalls++;
    // Any fixture assertion propagates to the test (sender normally hides errors).
    const check=fn=>{try{fn();}catch(e){f.transportFailure=e;throw e;}};
    check(()=>{
      assert.equal(o.hostname,new URL(f.subscription.endpoint).hostname);assert.equal(o.servername,o.hostname);
      assert.equal(o.port,443);assert.equal(o.protocol,'https:');assert.equal(o.method,'POST');
      assert.equal(o.path,new URL(f.subscription.endpoint).pathname+new URL(f.subscription.endpoint).search);
      if (options.wns) assert.equal(o.headers['X-WNS-Type'],'wns/raw');
      else assert.equal(o.headers['X-WNS-Type'],undefined);
      assert.equal(o.rejectUnauthorized,true);assert.equal(o.checkServerIdentity,checkServerIdentity);
      assert.equal(o.agent,false);assert.equal(o.autoSelectFamily,false);assert.equal(o.minVersion,'TLSv1.2');
      assert.equal(o.maxHeaderSize,8192); assert.equal(o.headers['Content-Encoding'],'aes128gcm');
      assert.equal(o.headers['Content-Type'],'application/octet-stream'); assert.equal(o.headers.Urgency,'normal');
      assert.ok(o.headers.TTL>0 && o.headers.TTL*1000<=f.event.expiresAt-f.now);
      assert.equal('proxy' in o,false);assert.equal('Authorization' in o.headers,true);
      // Invoking the exact connection lookup again cannot re-resolve DNS, even if
      // the resolver would now return private addresses (simulated rebinding).
      for(const opts of [{},{all:true}])o.lookup(o.hostname,opts,(e,address,family)=>{
        assert.equal(e,null);
        if(opts.all)assert.deepEqual(address,[f.pin??PUBLIC]);
        else {assert.equal(address,(f.pin??PUBLIC).address);assert.equal(family,(f.pin??PUBLIC).family);}
      });
      o.lookup('attacker.invalid',{},e=>assert.ok(e));
      if(options.assertCommitted)assert.equal([...f.state().deliveries.values()][0].state,'sending');
    });
    const req=new EventEmitter(); req.destroyed=false;
    req.destroy=()=>{req.destroyed=true;};
    req.end=body=>{
      check(()=>{
        assert.ok(Buffer.isBuffer(body));assert.equal(body.length,o.headers['Content-Length']);
        assert.equal(body.includes(Buffer.from('SYNTHETIC-DO-NOT-SEND')),false);
        const plaintext=ece.decrypt(body,{version:'aes128gcm',privateKey:receiver.ecdh,authSecret:f.subscription.keys.auth});
        try {
          const received=JSON.parse(plaintext.toString('utf8'));
          assert.deepEqual(received,f.event);assert.deepEqual(normalizePushPayload(received,f.now),f.event);
          f.received=received; // in memory only; never in public evidence
        } finally {plaintext.fill(0);}
        const auth=/^vapid t=([^,]+), k=(.+)$/.exec(o.headers.Authorization);assert.ok(auth);
        const expectedVapid=f.expectedVapid??f.vapid;
        assert.equal(auth[2],expectedVapid.publicKey);
        const [header,claims,signature]=auth[1].split('.');
        assert.equal(JSON.parse(Buffer.from(header,'base64url')).alg,'ES256');
        const jwt=JSON.parse(Buffer.from(claims,'base64url'));assert.equal(jwt.aud,new URL(f.subscription.endpoint).origin);assert.equal(jwt.sub,expectedVapid.subject);
        assert.ok(jwt.exp>Date.now()/1000 && jwt.exp<=Date.now()/1000+86400);
        const point=Buffer.from(expectedVapid.publicKey,'base64url');
        const publicKey=createPublicKey({format:'jwk',key:{kty:'EC',crv:'P-256',
          x:point.subarray(1,33).toString('base64url'),y:point.subarray(33).toString('base64url')}});
        assert.ok(verify('sha256',Buffer.from(header+'.'+claims),{key:publicKey,dsaEncoding:'ieee-p1363'},Buffer.from(signature,'base64url')));
        f.transportChecks++;
      });
      const respond=(code=f.statusCode??(options.wns?200:201))=>{
        const res=new EventEmitter();res.statusCode=code;res.destroyed=false;
        res.headers={location:'http://169.254.169.254/metadata'};
        res.destroy=()=>{res.destroyed=true;};f.responses.push(res);callback(res);
      };
      f.respond=respond;
      queueMicrotask(()=>{
        const socket=new EventEmitter();socket.authorized=f.tlsAuthorized??true;socket.remoteAddress=f.remoteAddress??(f.pin??PUBLIC).address;
        req.emit('socket',socket);socket.emit('secureConnect');
        if(f.requestError)req.emit('error',Error('PRIVATE endpoint keys NEVER REFLECT'));
        else if(f.sendHook)f.sendHook(respond);
        else if(!f.hang)respond();
      });
    };
    f.requests.push(req);return req;
  };
  f.senderOptions={enabled:true,providerOrigins:f.cryptoConfig.providerOrigins,protector:f.protector,vapidKeys:f.vapidKeys,
    clock:()=>f.now,resolve:(...args)=>f.resolve(...args),httpsRequest:(...args)=>f.httpsRequest(...args)};
  f.sender=createAuditedSender(f.senderOptions);
  f.event=payload();
  f.boundary=createRegistrationBoundary({repository:f.repository,verifySession:f.verifySession,
    protect:(...args)=>f.protector.protect(...args),clock:()=>f.now,approvedOrigins:f.cryptoConfig.providerOrigins});
  f.registration=f.boundary;
  const originalBody=f.body;f.body=()=>({...originalBody(),subscription:structuredClone(f.subscription)});
  f.delivery=createDeliveryBoundary({repository:f.repository,clock:()=>f.now,recompute:()=>f.event,
    sender:{send:(permit)=>f.sender.send(permit,{deadlineMs:f.deadlineMs??1000,signal:f.signal})}});
  f.shutdown=()=>{f.sender.close();f.protector.close();
    for(const key of [...f.cryptoConfig.sealingKeys.values(),...f.cryptoConfig.endpointHmacKeys.values(),...f.cryptoConfig.bindingHmacKeys.values()])key.fill(0);};
  return f;
}
