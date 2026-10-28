/** Original sender-material parsing shared with normal host initialization. */
import {Buffer} from 'node:buffer';
import {p256} from '@noble/curves/nist.js';
import {createPrivatePushPorts} from './private-runtime.mjs';
import {senderDiagnosticsUnsafe} from './audited-sender.mjs';
export function readSenderMaterial(text){
 const raw=JSON.parse(text),ring=x=>{if(!Array.isArray(x)||x.length<1||x.length>8)throw Error('n44_key_configuration');return new Map(x.map(([name,value])=>{if(!/^[a-f0-9]{64}$/.test(value))throw Error('n44_key_configuration');return[name,Buffer.from(value,'hex')];}));};
 const material={...raw,sealingKeys:ring(raw.sealingKeys),endpointHmacKeys:ring(raw.endpointHmacKeys),bindingHmacKeys:ring(raw.bindingHmacKeys),vapidKeys:new Map(raw.vapidKeys)};
 for(const v of material.vapidKeys.values())if(!p256.utils.isValidPrivateKey(Buffer.from(v.privateKey??'','base64url')))throw Error('n44_private_key_configuration');
 return material;
}
export function inspectSenderMaterial(readEnv){
 const result={materialReady:false,pairValid:false,senderConstructed:false,unsafeDiagnostics:senderDiagnosticsUnsafe()};let material,ports;
 try{
  if(result.unsafeDiagnostics||readEnv('N44_ENABLED')!=='true')return result;
  material=readSenderMaterial(readEnv('N44_CRYPTO_JSON'));
  const hostKeys=['N44_INGRESS_KEY','N44_SCHEDULER_KEY','N44_RATE_KEY'].map(name=>readEnv(name));
  if(hostKeys.some(v=>!/^[a-f0-9]{64}$/.test(v??'')))return result;
  const allKeys=[...hostKeys,...material.sealingKeys.values(),...material.endpointHmacKeys.values(),...material.bindingHmacKeys.values()].map(v=>typeof v==='string'?v:v.toString('hex'));
  if(new Set(allKeys).size!==allKeys.length)return result;
  const origins=JSON.parse(readEnv('N44_PROVIDER_ORIGINS_JSON'));if(!origins.includes('https://fcm.googleapis.com'))return result;
  result.materialReady=true;
  for(const v of material.vapidKeys.values()){const secret=Buffer.from(v.privateKey,'base64url');try{if(secret.length!==32||Buffer.from(p256.getPublicKey(secret,false)).toString('base64url')!==v.publicKey)return result;}finally{secret.fill(0);}}
  result.pairValid=true;
  // The exact enabled constructor is mandatory. Never use the disabled fallback.
  ports=createPrivatePushPorts({...material,providerOrigins:origins,enabled:true});
  result.senderConstructed=typeof ports.protect==='function'&&typeof ports.sender?.send==='function';
 }catch{}finally{ports?.close();if(material)for(const key of[...material.sealingKeys.values(),...material.endpointHmacKeys.values(),...material.bindingHmacKeys.values()])key.fill(0);}
 return result;
}
