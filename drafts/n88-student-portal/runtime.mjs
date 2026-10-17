/** AI: SOURCE ONLY. Does not listen or read process.env/secrets at import time. */
import { isIP } from 'node:net';
import { createPortalService } from './service.mjs';
import { createPostgresRepository } from './postgres-repository.mjs';
import { createCanonicalAdapter } from './canonical-adapter.mjs';
import { createHttpAdapter } from './http-adapter.mjs';
const fail=()=>{throw Error('n88_activation_prerequisite_missing');};
export const REQUIRED_ENV=Object.freeze(['N88_PUBLIC_ORIGIN','N88_DATABASE_URL','N88_HMAC_KEY','N88_AUTH_URL','N88_AUTH_API_KEY']);
export function deploymentPreflight({origin,authUrl,apiKey,secretKey,acquire,verifyCurrentSession,canonicalReadback,privateIngressReadback,sourceOnly=true}) {
  if(sourceOnly!==false || typeof acquire!=='function' || typeof verifyCurrentSession!=='function' || canonicalReadback!==true || privateIngressReadback!==true ||
    !Buffer.isBuffer(secretKey) || secretKey.length<32 || typeof apiKey!=='string' || !apiKey ||
    ![origin,authUrl].every(u=>{try{const x=new URL(u);return x.origin===u && x.protocol==='https:' && !x.username && !x.password;}catch{return false;}})) fail();
}
/** Current Auth user verified by the Auth server, never JWT decode/user_metadata.
 * Current session resolver is a REQUIRED independently trusted port. The existing
 * browser session object is NOT that port. See activation.md for the missing hosted
 * integration; there is deliberately no claimed introspection endpoint/fallback.
 */
export function createTeacherVerifier({authUrl,apiKey,verifyCurrentSession,fetch:send=globalThis.fetch}) {
  if(typeof verifyCurrentSession!=='function' || typeof send!=='function' || new URL(authUrl).protocol!=='https:') fail();
  return async (authorization,signal)=>{
    if(typeof authorization!=='string' || !/^Bearer [A-Za-z0-9._~-]{20,8192}$/.test(authorization)) return null;
    const token=authorization.slice(7);
    const response=await send(authUrl+'/auth/v1/user',{method:'GET',headers:{apikey:apiKey,Authorization:authorization},
      redirect:'error',cache:'no-store',signal});
    if(!response.ok) return null;
    // Bounded streaming even if an upstream omits/lies about content-length.
    let bytes=0;const parts=[];
    for await(const part of response.body) {bytes+=part.length;if(bytes>65536)return null;parts.push(part);}
    const user=JSON.parse(Buffer.concat(parts).toString('utf8'));
    if(typeof user.id!=='string' || !/^[a-f0-9-]{36}$/.test(user.id) || user.deleted_at || user.banned_until && Date.parse(user.banned_until)>Date.now()) return null;
    const session=await verifyCurrentSession({token,userId:user.id,signal});
    if(!session || session.userId!==user.id || typeof session.sessionId!=='string' || !session.sessionId || session.current!==true) return null;
    return {ownerId:user.id,sessionId:session.sessionId,current:true};
  };
}
export function composeRuntime(options) {
  deploymentPreflight(options);
  const {acquire,limits,timing,origin,authUrl,apiKey,secretKey,verifyCurrentSession,fetch:send}=options;
  const repository=createPostgresRepository({acquire,limits,timing,synchronize:createCanonicalAdapter(options.canonicalBounds)});
  let service;
  const adapter=createHttpAdapter({origin,service:r=>service(r),
    verifyTeacher:createTeacherVerifier({authUrl,apiKey,verifyCurrentSession,fetch:send}),
    // Direct TLS socket only. A reverse proxy must use a separately reviewed,
    // authenticated transport port; forwarding headers never establish identity.
    trustedSocket:socket=>socket.encrypted===true && isIP(socket.remoteAddress)?{clientKey:socket.remoteAddress}:null});
  service=createPortalService({repository,origin,secretKey,verifyIngress:adapter.verifyIngress,verifyTeacher:adapter.verifyTeacher});
  return Object.freeze({handle:adapter.handle});
}
