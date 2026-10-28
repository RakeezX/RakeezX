/** INACTIVE private sender. web-push generates encryption/VAPID bytes; Node HTTPS
 * owns exactly one nonredirecting, address-pinned TLS request. No internal retry. */
import webpush from 'web-push';
import { createECDH, timingSafeEqual } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { request } from 'node:https';
import { checkServerIdentity } from 'node:tls';
import { performance } from 'node:perf_hooks';
import { normalizePushPayload, normalizePushEnvelope } from '../../src/lib/notification-push-core.js';
import { approvedProviderOrigins, trustedSubscription, publicAddress, decode64, validatePoint } from './provider-policy.mjs';
import { consumeCommittedPermit } from './committed-permit.mjs';
import {nativeHttpExchange} from './native-http-transport.mjs';
import { WNS_WEBPUSH_ORIGIN, isWnsWebPushEndpoint } from './shared.mjs';


const fail = () => { throw Error('n44_sender_unavailable'); };
// http_ece deliberately has a diagnostic key logger. Never run it in that mode;
// remember import-time state as well because the library captures it on load.
const unsafeKeyLogAtImport = process.env.ECE_KEYLOG === '1';
const unsafeDiagnostics = () => unsafeKeyLogAtImport || process.env.ECE_KEYLOG === '1' ||
  process.execArgv.some(s=>s.startsWith('--tls-keylog')) || /(?:^|\s)--tls-keylog(?:[=\s]|$)/.test(process.env.NODE_OPTIONS??'');
export const senderDiagnosticsUnsafe=unsafeDiagnostics;
export function createAuditedSender({ enabled = false, providerOrigins = [], protector,
  vapidKeys, clock = Date.now, resolve = lookup, httpsRequest = request,
  nativeExchange = globalThis.Deno?.connect && httpsRequest===request ? nativeHttpExchange : null } = {}) {
  const origins = approvedProviderOrigins(providerOrigins);
  if (enabled !== true) return Object.freeze({send:async()=> 'uncertain',close(){}});
  const credentials=new Map();
  try {
    if (unsafeDiagnostics()) fail();
    if (!origins.length || typeof protector?.open !== 'function' || typeof clock !== 'function' ||
        typeof resolve !== 'function' || typeof httpsRequest !== 'function') fail();
    if (!(vapidKeys instanceof Map) || vapidKeys.size<1 || vapidKeys.size>8) fail();
    for (const [keyId,vapid] of vapidKeys) {
      if (typeof keyId!=='string' || !/^[A-Za-z0-9_-]{1,40}$/.test(keyId)) fail();
      validatePoint(vapid?.publicKey);
      const secret = decode64(vapid?.privateKey,32), pair = createECDH('prime256v1');
      try {
        pair.setPrivateKey(secret);
        if (!timingSafeEqual(pair.getPublicKey(),decode64(vapid.publicKey,65))) fail();
      } finally { secret.fill(0); }
      // A real, reviewed contact is injected later. No localhost or arbitrary schemes.
      const subject = new URL(vapid.subject);
      if (vapid.subject.length>512 || !['mailto:','https:'].includes(subject.protocol) ||
          subject.username || subject.password || subject.hash || subject.hostname==='localhost' ||
          (subject.protocol==='mailto:' && !/^[^\s?]+@[^\s?]+$/.test(subject.pathname))) fail();
      credentials.set(keyId,Object.freeze({subject:vapid.subject,publicKey:vapid.publicKey,privateKey:vapid.privateKey}));
    }
  } catch { fail(); }
  const active = new Set(); let closed = false;
  return Object.freeze({
    async send(permit,{signal,deadlineMs=10000,trace}={}) {
      const note=(key,value=true)=>{try{trace?.(key,value);}catch{}};
      // Consumed once, even on validation failure; a JSON/lookalike/replayed permit
      // cannot cause decryption. Issuer is used solely after the boundary commit.
      if (!consumeCommittedPermit(permit)) return 'uncertain';
      note('permit');
      const controller=new AbortController(); active.add(controller);
      let timer, req, res, done=false;
      const start=performance.now();
      const abort=()=>controller.abort();
      try {
        if (closed || unsafeDiagnostics() || signal?.aborted || !Number.isInteger(deadlineMs) || deadlineMs<1 || deadlineMs>10000) return 'uncertain';
        note('material');
        const payload=normalizePushPayload(permit.payload,clock());
        if (!payload) return 'uncertain';
        const allowedExpiry=Math.min(payload.expiresAt,permit.binding?.expiresAt??Infinity);
        const milliseconds=Math.min(deadlineMs,allowedExpiry-clock());
        if(milliseconds<1)return 'uncertain';
        timer=setTimeout(abort,milliseconds);
        signal?.addEventListener('abort',abort,{once:true});
        const check=()=>{if(closed || controller.signal.aborted || performance.now()-start>=milliseconds || clock()>=allowedExpiry) fail();};
        check();
        const opened=protector.open(permit.sealed,permit,{signal:controller.signal});
        const signing=credentials.get(opened?.vapidKeyId);
        if(!signing)fail();
        note('decrypt');
        const sub=trustedSubscription(opened.subscription,origins);
        const url=new URL(sub.endpoint);
        const wns=isWnsWebPushEndpoint(url) && origins.includes(WNS_WEBPUSH_ORIGIN);
        const cancel=new Promise((_,reject)=>controller.signal.addEventListener('abort',()=>reject(Error('n44_sender_unavailable')),{once:true}));
        const answers=await Promise.race([Promise.resolve().then(()=>resolve(url.hostname,{all:true,verbatim:true})),cancel]);
        check();
        // Reject a mixed public/private answer set, malformed answers and overflow.
        if (!Array.isArray(answers) || answers.length<1 || answers.length>16 ||
            answers.some(a=>!publicAddress(a.address,a.family))) fail();
        const pinned=Object.freeze({address:answers[0].address,family:answers[0].family});
        note('dns');
        const ttl=Math.floor((allowedExpiry-clock())/1000);
        if (ttl<1) fail();
        // Inner consumer schema stays allowlisted. The optional public binding
        // envelope carries no credential or private teacher/student content.
        const wire=permit.binding?normalizePushEnvelope({v:1,binding:permit.binding.id,expiresAt:permit.binding.expiresAt,event:payload},clock()):payload;
        if(!wire)fail();
        const details=webpush.generateRequestDetails(sub,JSON.stringify(wire),{
          vapidDetails:signing,TTL:ttl,contentEncoding:'aes128gcm',urgency:'normal',
        });
        if (details.endpoint!==sub.endpoint || details.method!=='POST' || !Buffer.isBuffer(details.body)) fail();
        check();
        // Recompute TTL after encryption too; it never outlives immutable expiry.
        details.headers.TTL=Math.min(ttl,Math.floor((allowedExpiry-clock())/1000));
        if(details.headers.TTL<1) fail();
        if (wns) {
          // Microsoft Edge WebPush WNS uses raw encrypted body with explicit type.
          // The endpoint query is an opaque capability: preserve it exactly.
          details.headers['X-WNS-Type']='wns/raw';
          details.headers['Content-Type']='application/octet-stream';
          // WNS WebPush rejects generic Urgency; retain it for other push services.
          delete details.headers.Urgency;
        }
        if(nativeExchange){
          const headers=Object.fromEntries(Object.entries(details.headers).filter(([k])=>k.toLowerCase()!=='content-length'));
          const result=await nativeExchange({hostname:url.hostname,pin:pinned,path:url.pathname+url.search,method:'POST',headers,body:details.body,signal:controller.signal,deadlineMs:milliseconds});
          note('tls',result.tlsVerified===true&&result.pinMatch===true);note('requestWritten',result.requestWritten===true);
          const code=result.statusCode;
          if(result.tlsVerified&&result.pinMatch&&result.requestWritten){note('providerStatusClass',code>=200&&code<600?Math.floor(code/100)+'xx':'none');note('providerAccepted',([201,202].includes(code)||wns&&code===200));}
          check();
          if(!result.tlsVerified||!result.pinMatch||!result.requestWritten||!result.closed)return 'uncertain';
          return ([201,202].includes(code)||wns&&code===200)?'accepted':code===404||code===410?code:code===429?'not_accepted_retryable':'uncertain';

        }
        return await new Promise(resolveOutcome=>{
          let verifiedSocket=false;
          const finish=outcome=>{
            if(done) return; done=true;
            controller.signal.removeEventListener('abort',stop);
            resolveOutcome(outcome);
            // Ignore bodies/Location/exception details; bound response processing.
            res?.destroy(); req?.destroy();
          };
          const stop=()=>finish('uncertain');
          controller.signal.addEventListener('abort',stop,{once:true});
          if(controller.signal.aborted){stop();return;}
          try {
            const options={protocol:'https:',hostname:url.hostname,port:443,
              path:url.pathname+url.search,method:'POST',headers:details.headers,
              servername:url.hostname,rejectUnauthorized:true,checkServerIdentity,
              minVersion:'TLSv1.2',agent:false,autoSelectFamily:false,family:pinned.family,
              maxHeaderSize:8192,signal:controller.signal,
              // The actual connection never performs a second DNS resolution.
              lookup(host,opts,callback){
                if(host!==url.hostname || controller.signal.aborted || !publicAddress(pinned.address,pinned.family)) {
                  callback(Error('n44_sender_unavailable'));return;
                }
                if(opts?.all) callback(null,[{...pinned}]); else callback(null,pinned.address,pinned.family);
              },
            };
            req=httpsRequest(options,response=>{
              res=response;
              const code=response.statusCode;
              if(verifiedSocket){note('providerStatusClass',code>=200&&code<600?Math.floor(code/100)+'xx':'none');note('providerAccepted',([201,202].includes(code)||wns&&code===200));}
              try {check();} catch {finish('uncertain');return;}
              if(!verifiedSocket){finish('uncertain');return;}
              // Only a definitive service rejection is retryable. 5xx, redirects,
              // malformed, truncated and all unknown-after-send remain uncertain.
              finish(([201,202].includes(code) || wns && code===200)?'accepted':code===404||code===410?code:
                code===429?'not_accepted_retryable':'uncertain');
            });
            req.on('error',()=>finish('uncertain'));
            req.on('socket',socket=>socket.once('secureConnect',()=>{
              try {
                check();
                if(socket.authorized!==true || socket.remoteAddress!==pinned.address){finish('uncertain');return;}
                verifiedSocket=true;
                note('tls');
                req.end(details.body);
                note('requestWritten');
              } catch {finish('uncertain');}
            }));
            // Unsupported runtimes must time out without releasing the payload.
            // A response alone is not evidence that the pinned TLS check ran.
            check();
          } catch {finish('uncertain');}
        });
      } catch {return 'uncertain';}
      finally {
        clearTimeout(timer); signal?.removeEventListener('abort',abort);
        controller.abort(); req?.destroy(); res?.destroy(); active.delete(controller);
      }
    },
    close(){closed=true; for(const c of active)c.abort(); credentials.clear();},
  });
}
