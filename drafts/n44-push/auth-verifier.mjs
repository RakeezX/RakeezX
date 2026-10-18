import { Buffer } from 'node:buffer';
/** AI: inactive server binding. Official SDK verifies signatures; never decode JWTs here. */
import { AuthClient } from '@supabase/auth-js';
const uuid = s => typeof s === 'string' && /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(s);
const fail = () => { throw Error('n44_auth_configuration'); };
export function createTeacherVerifier({authUrl,apiKey,fetch:send=globalThis.fetch,authDeadlineMs=2000,now=Date.now}) {
  const url=new URL(authUrl);
  if(url.origin!==authUrl || url.protocol!=='https:' || !apiKey || typeof send!=='function' ||
    !Number.isInteger(authDeadlineMs) || authDeadlineMs<20 || authDeadlineMs>5000) fail();
  const issuer=authUrl+'/auth/v1';
  return async (authorization,parentSignal,{query,beforeCommit}={}) => {
    if(typeof query!=='function' || typeof authorization!=='string' || !/^Bearer [A-Za-z0-9._-]{20,8192}$/.test(authorization)) return null;
    const token=authorization.slice(7),abort=new AbortController();
    const cancel=()=>abort.abort(); parentSignal?.addEventListener('abort',cancel,{once:true});
    if(parentSignal?.aborted) abort.abort();
    let expired=false;
    const timer=setTimeout(()=>{expired=true;abort.abort();},authDeadlineMs);
    const fence=()=>{if(expired || abort.signal.aborted) throw Error('n44_auth_unavailable');};
    try {
      // Only these two read-only provider paths. Bounded bytes/time, no redirects,
      // cookies, implicit session initialization, refresh, persistence or retries.
      const boundedFetch=async(target,init={})=>{
        fence(); const u=new URL(target);
        if(u.origin!==authUrl || ![issuer+'/user',issuer+'/.well-known/jwks.json'].includes(u.href) || (init.method && init.method!=='GET')) fail();
        const pending=send(u.href,{...init,redirect:'error',cache:'no-store',credentials:'omit',signal:abort.signal});
        const response=await Promise.race([pending,new Promise((_,reject)=>abort.signal.addEventListener('abort',()=>reject(Error('n44_auth_unavailable')),{once:true}))]);
        let n=0; const parts=[];
        const reader=response.body?.getReader();
        if(reader) try {for(;;){fence();const {done,value}=await reader.read();if(done)break;n+=value.length;if(n>65536)throw Error('n44_auth_unavailable');parts.push(value);}}
        finally {await reader.cancel().catch(()=>{});reader.releaseLock();}
        fence();return new Response(Buffer.concat(parts),{status:response.status,headers:response.headers});
      };
      const auth=new AuthClient({url:issuer,headers:{apikey:apiKey},fetch:boundedFetch,
        persistSession:false,autoRefreshToken:false,detectSessionInUrl:false,skipAutoInitialize:true,debug:false});
      const verified=await auth.getClaims(token); fence();
      if(verified.error || !verified.data?.claims) return null;
      // These are verified claims, including HS tokens (SDK verifies at Auth).
      const c=verified.data.claims,sec=Math.floor(now()/1000);
      if(c.iss!==issuer || !(c.aud==='authenticated' || Array.isArray(c.aud) && c.aud.length===1 && c.aud[0]==='authenticated') ||
        c.role!=='authenticated' || !uuid(c.sub) || !uuid(c.session_id) || c.is_anonymous===true ||
        !Number.isSafeInteger(c.exp) || c.exp<=sec || !Number.isSafeInteger(c.iat) || c.iat>sec || c.iat>=c.exp ||
        c.nbf!==undefined && (!Number.isSafeInteger(c.nbf) || c.nbf>sec)) return null;
      // Lock exact user/session before fresh getUser, so a concurrent ban/logout
      // cannot commit between that provider checkpoint and our portal commit.
      const current=await query('select user_id,session_id,not_after_ms from n44_push_draft.lock_current_session($1::uuid,$2::uuid)',[c.sub,c.session_id]); fence();
      const matches=result=>result.rows.length===1 && result.rows[0].user_id===c.sub && result.rows[0].session_id===c.session_id;
      if(!matches(current))return null;
      // Always a fresh server user lookup for the EXACT same bearer, even with JWKS.
      const fresh=await auth.getUser(token); fence();
      const user=fresh.data?.user;
      if(fresh.error || !user || user.id!==c.sub || user.is_anonymous===true || user.deleted_at ||
        user.banned_until && (!Number.isFinite(Date.parse(user.banned_until)) || Date.parse(user.banned_until)>now())) return null;
      // The helper returns exact ids, never a caller-supplied "current" boolean.
      // SHARE row lock survives through the enclosing portal commit (logout/delete waits).
      if(c.exp<=Math.floor(now()/1000)) return null;
      beforeCommit?.(async()=>{
        if(c.exp<=Math.floor(now()/1000))throw Error('n44_auth_expired');
        const result=await query('select user_id,session_id,not_after_ms from n44_push_draft.lock_current_session($1::uuid,$2::uuid)',[c.sub,c.session_id]);
        if(!matches(result))throw Error('n44_auth_expired');
      });
      const notAfter=current.rows[0].not_after_ms===null?Infinity:Number(current.rows[0].not_after_ms);
      if(notAfter!==Infinity&&!Number.isSafeInteger(notAfter))return null;
      return Object.freeze({ownerId:c.sub,sessionId:c.session_id,sessionRevision:c.session_id,expiresAt:c.exp*1000,
        backgroundExpiresAt:Math.min(now()+30*86400000,notAfter)});
    } catch {return null;}
    finally {clearTimeout(timer);abort.abort();parentSignal?.removeEventListener('abort',cancel);}
  };
}
