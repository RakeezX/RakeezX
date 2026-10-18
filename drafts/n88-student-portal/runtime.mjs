/** AI: SOURCE ONLY. No listener, environment, credentials or network at import. */
import { Buffer } from 'node:buffer';
import { isIP } from 'node:net';
import { createIntegratedService } from './integrated-service.mjs';
import { createPostgresRepository } from './postgres-repository.mjs';
import { createCanonicalAdapter } from './canonical-adapter.mjs';
import { createHttpAdapter } from './http-adapter.mjs';
import { createTeacherVerifier } from './auth-verifier.mjs';
export { createTeacherVerifier } from './auth-verifier.mjs';
export const REQUIRED_ENV=Object.freeze(['N88_PUBLIC_ORIGIN','N88_DATABASE_URL','N88_HMAC_KEY','N88_AUTH_URL','N88_AUTH_API_KEY','N88_INGRESS_KEY']);
export function deploymentPreflight({origin,authUrl,apiKey,secretKey,acquire,canonicalReadback,privateIngressReadback,sourceOnly=true}) {
  if(sourceOnly!==false || typeof acquire!=='function' || canonicalReadback!==true || privateIngressReadback!==true ||
    !Buffer.isBuffer(secretKey) || secretKey.length<32 || typeof apiKey!=='string' || !apiKey ||
    ![origin,authUrl].every(u=>{try{const x=new URL(u);return x.origin===u && x.protocol==='https:' && !x.username && !x.password;}catch{return false;}})) throw Error('n88_activation_prerequisite_missing');
}
export function composeService(options,adapter) {
  deploymentPreflight(options);
  const repository=createPostgresRepository({acquire:options.acquire,limits:options.limits,timing:options.timing,
    synchronize:createCanonicalAdapter(options.canonicalBounds)});
  return createIntegratedService(options,adapter,repository);
}
/** Retained direct TLS adapter; Edge uses Web Request entry instead. */
export function composeRuntime(options) {
  let service;
  const adapter=createHttpAdapter({origin:options.origin,service:r=>service(r),verifyTeacher:createTeacherVerifier(options),
    trustedSocket:socket=>socket.encrypted===true && isIP(socket.remoteAddress)?{clientKey:socket.remoteAddress}:null});
  service=composeService(options,adapter);
  return Object.freeze({handle:adapter.handle});
}
