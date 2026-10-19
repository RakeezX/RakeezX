/** AI-authored, INACTIVE server-only extension. No environment/network at import. */
import { randomInt, randomBytes, randomUUID, createHmac, createHash, timingSafeEqual } from 'node:crypto';
import { PRIVATE_HEADERS } from './service.mjs';
import {createRolloutGuard} from './rollout-guard.mjs';

export const CREDENTIAL_FORMAT = 'six-v1';
export const CREDENTIAL_CAPACITY = 100_000;
export const NUMERIC_POLICY = Object.freeze({ collisionBudget: 128, sessionMs: 8*60*60_000,
  windowMs: 15*60_000, clientAttempts: 6, globalAttempts: 100, maxRateKeys: 10000,
  sourceRequests: 120, globalRequests: 1200, maxAttempts: 10000 });
export const generateNumericCredential = () => '1' + String(randomInt(0, 100_000)).padStart(5, '0');
// Explicit paste policy: remove leading/trailing ASCII SPACE only. No other coercion.
export function normalizeNumericCredential(value) {
  if (typeof value !== 'string' || value.length > 80) return null;
  const code = value.replace(/^ +| +$/g, '');
  return /^1[0-9]{5}$/.test(code) ? code : null;
}
const fail = () => { throw Error('n88_numeric_unavailable'); };
const active = m => m?.status === 'active' && m.endDate === null && m.studentActive === true && m.classActive === true;
const identity = (a,b) => a.ownerId === b.ownerId && a.studentId === b.studentId;
const tokenHash = token => createHash('sha256').update(token).digest('hex');
const cookie = (value, age) => `__Secure-n88-student=${value}; Path=/api/n88/student; HttpOnly; Secure; SameSite=Strict; Max-Age=${age}`;
const denied = () => ({status:401, body:{error:'unavailable'}, cookie:cookie('',0)});
const response = r => ({...r, headers:{...PRIVATE_HEADERS,...(r.cookie ? {'Set-Cookie':r.cookie} : {})}});

/** One stable reservation key is required across verifier-key rotations. Never discard
 * retired reservations or change this key without a separately designed migration.
 * keys is a Map(version -> >=32-byte Buffer); activeKeyVersion selects new verifiers.
 */
export function createNumericCredentialOperations({ keys, activeKeyVersion, reservationKey,
  now = Date.now, generate = generateNumericCredential, rollout=createRolloutGuard() }) {
  if (!(keys instanceof Map) || !keys.size || !/^[A-Za-z0-9_-]{1,40}$/.test(activeKeyVersion || '') ||
      !keys.has(activeKeyVersion) || !Buffer.isBuffer(reservationKey) || reservationKey.length<32 ||
      [...keys].some(([v,k]) => !/^[A-Za-z0-9_-]{1,40}$/.test(v) || !Buffer.isBuffer(k) || k.length<32)) fail();
  keys = new Map([...keys].map(([v,k])=>[v,Buffer.from(k)])); reservationKey=Buffer.from(reservationKey);
  const mac = (key, domain, ...parts) => createHmac('sha256',key).update(JSON.stringify(['n88-numeric-v1',domain,...parts])).digest('hex');
  const reservation = code => mac(reservationKey,'global-reservation',code);
  const verifier = (code, c) => mac(keys.get(c.keyVersion),'credential',c.ownerId,c.studentId,c.version,code);
  function current(db,c) {
    if (!db.contexts.some(x=>x.ownerId===c.ownerId && x.active === true)) return null;
    const members=db.memberships.filter(m=>identity(m,c) && active(m));
    return members.length===1 ? members[0] : null;
  }
  function revokeCredential(db,c) {
    if(c.revokedAt===null) c.revokedAt=now();
    for(const s of db.numericSessions) if(s.credentialId===c.id && s.revokedAt===null) s.revokedAt=now();
  }
  function version(db,m) { return Math.max(0,...db.numericCredentials.filter(c=>identity(c,m)).map(c=>c.version)); }
  function check(db,m,expectedVersion) {
    if(!rollout.admitsStudent(m))fail();
    const canonical=current(db,m);
    if(!canonical || canonical.enrollmentId!==m.enrollmentId || canonical.revision!==m.revision ||
       canonical.canonicalStamp!==m.canonicalStamp || version(db,m)!==expectedVersion) fail();
  }
  function issue(db,m,expectedVersion,{rotate=false}={}) {
    check(db,m,expectedVersion);
    const previous=db.numericCredentials.filter(c=>identity(c,m) && c.revokedAt===null);
    if(previous.length>1 || previous.length && !rotate) fail();
    if(!Number.isSafeInteger(expectedVersion+1)) fail();
    // Historical tombstones stay reserved but do not count as six-digit occupancy.
    if(db.numericCredentials.filter(c=>c.format===CREDENTIAL_FORMAT).length>=CREDENTIAL_CAPACITY) fail();
    let code, reserved;
    for(let attempt=0;attempt<NUMERIC_POLICY.collisionBudget;attempt++) {
      code=generate(); if(typeof code!=='string' || !/^1[0-9]{5}$/.test(code)) fail();
      reserved=reservation(code);
      if(!db.numericCredentials.some(c=>c.reservation===reserved)) break;
      code=null;
    }
    if(!code) fail(); // no scan/sequential fallback, and old credential untouched
    const c={id:randomUUID(),ownerId:m.ownerId,studentId:m.studentId,version:expectedVersion+1,
      format:CREDENTIAL_FORMAT,keyVersion:activeKeyVersion,reservation:reserved,verifier:'',revokedAt:null};
    c.verifier=verifier(code,c);
    previous.forEach(c=>revokeCredential(db,c)); db.numericCredentials.push(c);
    return {code,credentialVersion:c.version}; // caller may expose ONLY after COMMIT ACK
  }
  const issueMember=(db,m,{expectedVersion})=>issue(db,m,expectedVersion);
  const rotateMember=(db,m,{expectedVersion})=>issue(db,m,expectedVersion,{rotate:true});
  const revokeMember=(db,m,{expectedVersion})=>{
    check(db,m,expectedVersion);
    for(const c of db.numericCredentials.filter(c=>identity(c,m))) revokeCredential(db,c);
    return {revoked:true,credentialVersion:expectedVersion};
  };

  /** Compose into SAME authenticated ingress/repository as existing service. ingress
   * consumes its signed replay receipt in the independently committed attempt phase for claims. No body/source fallback.
   * project is the existing bounded, explicitly teacher-published own-member projection.
   */
  function createStudentHandler({repository,verifyIngress,origin,project}) {
    if(!repository?.transaction || typeof verifyIngress!=='function' || typeof project!=='function' ||
       new URL(origin).origin!==origin || !origin.startsWith('https://')) fail();
    return async request => {
      try {
        const claim=(request.path==='/student/claim'||request.path==='/api/n88/student/claim')&&request.method==='POST';
        // Commit verified ingress and budgets BEFORE loading credential state.
        // Later authentication/session/source rollback cannot undo this debit.
        let attempt;
        if(claim) {
          if(typeof repository.claimAttempt!=='function' || typeof repository.commitAttemptSession!=='function' || typeof repository.settleAttempt!=='function')return response(denied());
          attempt=await repository.claimAttempt(async(db,ports)=>{
            const ingress=await verifyIngress(request,ports);
            if(!ingress?.clientKey)return false;
            const time=now();
            // Flood counts ALL requests and is never refunded. Guess counts include
            // provisional inflight requests, and only own COMMIT-proven success settles.
            db.numericRates=db.numericRates.filter(r=>r.until>time);
            db.numericAttempts=db.numericAttempts.filter(a=>a.until>time);
            const source=mac(reservationKey,'client-rate',ingress.clientKey);
            const get=(key,max)=>{
              let b=db.numericRates.find(b=>b.key===key);
              if(!b && db.numericRates.length<NUMERIC_POLICY.maxRateKeys)db.numericRates.push(b={key,count:0,until:time+NUMERIC_POLICY.windowMs,epoch:randomUUID()});
              if(b && !b.epoch)b.epoch=randomUUID(); // retain legacy counts/window
              return b;
            };
            let blocked=false;
            for(const [key,max] of [[mac(reservationKey,'source-flood',ingress.clientKey),NUMERIC_POLICY.sourceRequests],[mac(reservationKey,'global-flood'),NUMERIC_POLICY.globalRequests]]) {
              const b=get(key,max);if(!b || b.count>=max)blocked=true;
              if(b)b.count=Math.min(max,b.count+1);
            }
            if(blocked)return null;
            const budgets=[[source,NUMERIC_POLICY.clientAttempts],['global',NUMERIC_POLICY.globalAttempts]],buckets=[];
            for(const [key,max] of budgets) {
              const b=get(key,max);
              if(!b || b.count>=max) blocked=true;
              if(b)buckets.push(b);
            }
            // Exhaustion denies BEFORE lookup, without inventing an attempt/credit.
            if(blocked || db.numericAttempts.length>=NUMERIC_POLICY.maxAttempts)return null;
            for(const b of buckets)b.count++;
            const a={id:randomUUID(),buckets:buckets.map(({key,epoch,until})=>({key,epoch,until})),
              until:Math.max(...buckets.map(b=>b.until)),sessionId:null,settled:false};
            db.numericAttempts.push(a);return a.id;
          });
          if(!attempt)return response(denied());
        }
        const authenticate=async(db,ports)=>{
        const ingress=claim ? {clientKey:'prepaid'} : await verifyIngress(request,ports);
        const {headers={},method,body={}}=request;
        const path=request.path.startsWith('/student/')?'/api/n88'+request.path:request.path;
        if(!ingress?.clientKey || headers['sec-fetch-site'] && headers['sec-fetch-site']!=='same-origin' ||
           method==='POST' && (headers.origin!==origin || headers['x-n88-csrf']!=='1' || headers['content-type']!=='application/json')) return denied();
        const time=now();
        const token=/(?:^|;\s*)__Secure-n88-student=([A-Za-z0-9_-]{43})(?:;|$)/.exec(headers.cookie || '')?.[1];
        if(path==='/api/n88/student/claim' && method==='POST') {
          const code=normalizeNumericCredential(body.code);
          if(!code) return denied();
          const c=db.numericCredentials.find(c=>c.reservation===reservation(code));
          if(!c || c.revokedAt!==null || !keys.has(c.keyVersion) || !/^[a-f0-9]{64}$/.test(c.verifier) ||
             !timingSafeEqual(Buffer.from(c.verifier,'hex'),Buffer.from(verifier(code,c),'hex'))) return denied();
          if(typeof ports?.synchronizeOwner!=='function') fail();
          if(!rollout.allowsOwner(c.ownerId)||!db.memberships.some(m=>identity(m,c)&&rollout.allowsMember(m)))return denied();
          await ports.synchronizeOwner(c.ownerId);
          const m=current(db,c); if(!m||!rollout.admitsStudent(m)) return denied();
          if(token) for(const s of db.numericSessions) if(s.tokenHash===tokenHash(token)&&rollout.allowsMember(s)) s.revokedAt=time;
          const fresh=randomBytes(32).toString('base64url');
          db.numericSessions=db.numericSessions.filter(s=>!rollout.allowsMember(s)||s.expiresAt>time && s.revokedAt===null);
          if(db.numericSessions.length>=10000) fail();
          db.numericSessions.push({id:randomUUID(),credentialId:c.id,ownerId:c.ownerId,studentId:c.studentId,
            classId:m.classId,enrollmentId:m.enrollmentId,membershipRevision:m.revision,canonicalStamp:m.canonicalStamp,
            version:c.version,tokenHash:tokenHash(fresh),expiresAt:time+NUMERIC_POLICY.sessionMs,revokedAt:null});
          return {status:200,body:{claimed:true},cookie:cookie(fresh,NUMERIC_POLICY.sessionMs/1000)};
        }
        const s=token && db.numericSessions.find(s=>s.tokenHash===tokenHash(token));
        if(s&&!rollout.allowsMember(s))return denied();
        if(path==='/api/n88/student/end' && method==='POST') {
          if(s) s.revokedAt=time;
          return {status:200,body:{ended:true},cookie:cookie('',0)};
        }
        if(path!=='/api/n88/student/read' || method!=='GET' || !s || s.revokedAt!==null || s.expiresAt<=time) return denied();
        const c=db.numericCredentials.find(c=>c.id===s.credentialId && identity(c,s) && c.version===s.version && c.revokedAt===null);
        if(!c) return denied();
        if(typeof ports?.synchronizeOwner!=='function') fail();
        await ports.synchronizeOwner(c.ownerId);
        const m=current(db,c);
        if(!rollout.admitsStudent(m))return denied();
        if(!m || m.enrollmentId!==s.enrollmentId || m.classId!==s.classId || m.revision!==s.membershipRevision || m.canonicalStamp!==s.canonicalStamp) {
          s.revokedAt=time; return denied();
        }
        return {status:200,body:await project(db,m,ports)};
      };
        if(!claim)return response(await repository.transaction(authenticate));
        // The repository creates an opaque capability ONLY after acknowledged
        // COMMIT of a new session bound to this admission. No response flag is proof.
        const committed=await repository.commitAttemptSession(attempt,authenticate);
        if(committed.proof) {
          try{await repository.settleAttempt(committed.proof,now());}catch{/* conservative charge retention */}
        }
        return response(committed.value);
      } catch { return response(denied()); } // no SQL/error/credential enumeration
    };
  }
  return Object.freeze({issueMember,rotateMember,revokeMember,createStudentHandler});
}
