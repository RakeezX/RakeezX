/** Next usable, INACTIVE host binding. Explicit config + existing trusted ports.
 * No env reads, host provisioning, listener, scheduler, Auth or service mutation. */
import { createSubscriptionProtector } from './subscription-protector.mjs';
import { createAuditedSender } from './audited-sender.mjs';
import { createRuntime } from './runtime-gateway.mjs';

export function createPrivatePushPorts({ enabled=false, providerOrigins=[], ...material }={},
  {clock,resolve,httpsRequest,nativeExchange}={}) {
  if(enabled!==true) return Object.freeze({
    protect(){throw Error('n44_crypto_disabled');},
    sender:Object.freeze({send:async()=> 'uncertain'}),close(){},
  });
  if(!(material.vapidKeys instanceof Map)||!material.vapidKeys.has(material.activeVapidKeyId))
    throw Error('n44_crypto_unavailable');
  const protector=createSubscriptionProtector({providerOrigins,...material});
  let sender;
  try {
    sender=createAuditedSender({enabled:true,providerOrigins,protector,vapidKeys:material.vapidKeys,clock,resolve,httpsRequest,nativeExchange});
  } catch {
    protector.close();throw Error('n44_crypto_unavailable');
  }
  return Object.freeze({protect:(...args)=>protector.protect(...args),sender,
    close(){sender.close();protector.close();}});
}

export function createPrivateRuntime(config={},ports={},material={},dependencies={}) {
  // Same exact provider policy serves registration and sender. Do not accept a
  // separate material.providerOrigins that could widen one side independently.
  const crypto=createPrivatePushPorts({...material,enabled:config.enabled===true&&config.deliveryEnabled===true,
    providerOrigins:config.providerOrigins??[]},dependencies);
  try {
    return createRuntime(config,{...ports,protect:crypto.protect,sender:crypto.sender,
      async close(){try{crypto.close();}finally{if(typeof ports.close==='function')await ports.close();}}});
  } catch {crypto.close();throw Error('n44_crypto_unavailable');}
}
