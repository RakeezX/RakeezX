import {credentialStateRevision} from './receipt-reconciliation.mjs';
/** AI-authored. Inactive composition ports for the EXISTING N88 transaction/service. */
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { PRIVATE_HEADERS } from './service.mjs';
import {createRolloutGuard} from './rollout-guard.mjs';
const fail=()=>{throw Error('n88_class_unavailable');};
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const active=m=>m.status==='active' && m.endDate===null && m.studentActive===true && m.classActive===true;
const id=value=>typeof value==='string' && value.length>0 && value.length<=240 && !value.includes('\0');
const requestId=value=>typeof value==='string' && /^[A-Za-z0-9_-]{16,100}$/.test(value);
const version=(db,m)=>Math.max(0,...db.numericCredentials.filter(c=>c.ownerId===m.ownerId && c.studentId===m.studentId).map(c=>c.version));
const live=(db,m)=>db.numericCredentials.some(c=>c.ownerId===m.ownerId && c.studentId===m.studentId && c.revokedAt===null);
const result=(status,body)=>({status,body,headers:{...PRIVATE_HEADERS}});
const denied=()=>result(401,{error:'unavailable'});
const replay=receipt=>receipt.results.map(r=>r.status==='created' ? {...r,status:'uncertain',recovery:'refresh_current_roster'} : {...r});
const summary=rows=>Object.fromEntries(['created','skipped','failed','uncertain'].map(s=>[s,rows.filter(r=>r.status===s).length]));

/** resolveClass must lock CURRENT canonical teaching/term/source under ports.query;
 * verifyTeacher uses existing current-server Auth verifier and beforeCommit guard.
 * Helpers MUST mutate only the supplied transaction state, never open transactions,
 * send responses, log secrets or call the old four-digit HTTP /teacher/issue route.
 * Bind request via forRequest(request) in existing authenticated/CSRF ingress handler.
 */
export function createClassCredentialOperations({repository,verifyTeacher,verifyIngress,origin,resolveClass,issueMember,rotateMember,revokeMember,rollout=createRolloutGuard()}) {
  if(!repository?.transaction || [verifyTeacher,verifyIngress,resolveClass,issueMember,rotateMember,revokeMember].some(f=>typeof f!=='function') ||
     new URL(origin).origin!==origin || !origin.startsWith('https://')) fail();
  return Object.freeze({forRequest(request) {
    async function run(action,teachingId,input={}) {
      try { return await repository.transaction(async(db,ports)=>{
        const ingress=await verifyIngress(request,ports),headers=request.headers || {};
        if(!ingress?.clientKey || headers['sec-fetch-site'] && headers['sec-fetch-site']!=='same-origin' ||
          action==='list' && request.method!=='GET' || action!=='list' && (request.method!=='POST' || headers.origin!==origin ||
          headers['x-n88-csrf']!=='1' || headers['content-type']!=='application/json')) return denied();
        const auth=await verifyTeacher(request,ports);
        if(!auth?.ownerId || !auth.sessionId || auth.current!==true || !rollout.allowsOwner(auth.ownerId) || typeof ports?.synchronizeOwner!=='function') return denied();
        const scope=await resolveClass(db,ports,auth,teachingId,input);
        if(!scope || scope.ownerId!==auth.ownerId || scope.current!==true || !id(scope.teachingId) || !id(scope.classId) || !id(scope.revision)) return denied();
        if(teachingId!==null && scope.teachingId!==teachingId) return denied();
        if(!rollout.admitsTeacher(auth,scope))return denied();
        await ports.synchronizeOwner(auth.ownerId);
        const members=db.memberships.filter(m=>m.ownerId===auth.ownerId && m.classId===scope.classId && active(m) && rollout.admitsStudent(m));
        if(members.length>2000 || new Set(members.map(m=>m.studentId)).size!==members.length) return denied();
        // Ambiguous current enrollment anywhere under this owner cannot issue a code.
        if(members.some(m=>db.memberships.filter(x=>x.ownerId===m.ownerId && x.studentId===m.studentId && active(x)).length!==1)) return denied();
        members.sort((a,b)=>a.studentId.localeCompare(b.studentId));
        const rosterRevision=hash([scope.teachingId,scope.revision,members.map(m=>[m.studentId,m.enrollmentId,m.revision,m.canonicalStamp])]);
        if(action==='list') return result(200,{teachingId:scope.teachingId,rosterRevision,students:members.map(m=>({studentId:m.studentId,
          enrollmentId:m.enrollmentId,revision:m.revision,label:m.label,credentialVersion:version(db,m),hasActiveCredential:live(db,m)}))});
        if(!requestId(input.requestId)) return denied();
        if(input.expectedCredentialRevision!==undefined&&!/^[a-f0-9]{64}$/.test(input.expectedCredentialRevision))return denied();
        const binding=hash([action,scope.teachingId,input.expectedRosterRevision??null,input.studentId??null,input.enrollmentId??null,input.revision??null,input.credentialVersion??null,...(input.expectedCredentialRevision===undefined?[]:[input.expectedCredentialRevision])]);
        const prior=db.classReceipts.find(r=>r.ownerId===auth.ownerId && r.requestId===input.requestId);
        if(prior) {
          if(!prior.results.every(r=>members.some(m=>m.studentId===r.studentId&&m.enrollmentId===r.enrollmentId)))return denied();
          if(prior.binding!==binding) return result(409,{error:'stale_request'});
          const rows=replay(prior);return result(200,{requestId:input.requestId,replayed:true,results:rows,counts:summary(rows)});
        }
        if(db.classReceipts.length>=10000) fail(); // fail closed, never evict an idempotency boundary
        if(action==='batch' && (input.expectedRosterRevision!==rosterRevision || input.expectedCredentialRevision!==undefined&&input.expectedCredentialRevision!==credentialStateRevision(db,members))) return result(409,{error:'roster_changed'});
        let selected=members;
        if(action!=='batch') {
          selected=members.filter(m=>m.studentId===input.studentId && m.enrollmentId===input.enrollmentId && m.revision===input.revision);
          if(selected.length!==1 || !Number.isSafeInteger(input.credentialVersion) || input.credentialVersion<0 || version(db,selected[0])!==input.credentialVersion) return result(409,{error:'member_changed'});
        }
        const rows=[],secrets=[];
        for(const m of selected) {
          const expectedVersion=version(db,m);
          const base={studentId:m.studentId,enrollmentId:m.enrollmentId,credentialVersion:expectedVersion};
          // Explicit revocation is never silently undone by a later missing-only batch.
          if(action==='batch' && expectedVersion>0) {rows.push({...base,status:'skipped',reason:live(db,m)?'existing':'revoked_rotate_required'});continue;}
          const rowCount=rows.length,secretCount=secrets.length;
          const before=structuredClone({credentials:db.numericCredentials,sessions:db.numericSessions});
          try {
            await ports.query('savepoint n88_member_recovery');
            const issued=await ({batch:issueMember,rotate:rotateMember,revoke:revokeMember}[action])(db,m,{expectedVersion},ports);
            if(action==='revoke') {
              if(issued?.revoked!==true || live(db,m)) fail();
              rows.push({...base,status:'skipped',reason:'revoked'});
            } else {
              if(!/^1[0-9]{5}$/.test(issued?.code || '') || issued.credentialVersion!==expectedVersion+1 || !live(db,m)) fail();
              rows.push({...base,credentialVersion:issued.credentialVersion,status:'created'});
              secrets.push({studentId:m.studentId,code:issued.code});
            }
            await ports.query('release savepoint n88_member_recovery');
          } catch {
            await ports.query('rollback to savepoint n88_member_recovery');
            await ports.query('release savepoint n88_member_recovery');
            rows.length=rowCount;secrets.length=secretCount;
            // Injected helpers are transaction-local only. Roll back this member's
            // tentative mutations; other members may succeed with honest partial counts.
            db.numericCredentials=before.credentials;db.numericSessions=before.sessions;
            rows.push({...base,status:'failed',reason:'unavailable'});
          }
        }
        db.classReceipts.push({ownerId:auth.ownerId,requestId:input.requestId,binding,results:structuredClone(rows)});
        return result(200,{requestId:input.requestId,replayed:false,results:rows,counts:summary(rows),secrets});
      }); } catch {return result(503,{error:'unavailable',outcome:'uncertain',recovery:'reload_with_same_request_id'});}
    }
    return Object.freeze({listClass:teachingId=>run('list',teachingId),
      issueMissingClassCodes:(teachingId,input)=>run('batch',teachingId,input),
      rotate:input=>run('rotate',null,input),revoke:input=>run('revoke',null,input)});
  }});
}

/** Concrete canonical resolver for current schema. Uses SAME source-lock protocol as
 * canonical-adapter; selective operations infer class from exact enrollment, never
 * from request owner. Teaching ambiguity requires explicit class-UI context binding.
 */
export function createPgClassResolver({teachingId:boundTeachingId}={}) {
  return async(db,ports,auth,teachingId,input)=>{
    const requested=teachingId ?? boundTeachingId;
    if(!id(requested) || typeof ports?.query!=='function') return null;
    // Establish the existing transaction-local owner/RLS fence before source reads.
    // Synchronization writes occur only AFTER this resolver and rollout admission.
    await ports.query('select n88_private.lock_canonical_sources($1::uuid,$2::integer)',[auth.ownerId,2000]);
    const r=await ports.query(`select t.id,t.section_id,t.revision::text as teaching_revision,
      term.revision::text as term_revision from rakeezx.teachings t
      join rakeezx.terms term on term.owner_id=t.owner_id and term.id=t.term_id
      join rakeezx.sections c on c.owner_id=t.owner_id and c.id=t.section_id
      join rakeezx.years y on y.owner_id=c.owner_id and y.id=c.year_id
      where t.owner_id=$1::uuid and t.id=$2 and t.deleted_at is null
        and term.deleted_at is null and term.status='active' and term.year_id=c.year_id
        and c.deleted_at is null and c.status='active' and y.deleted_at is null and y.status='active'`,[auth.ownerId,requested]);
    if(r.rows.length!==1) return null;
    const t=r.rows[0];
    if(teachingId===null && !db.memberships.some(m=>m.ownerId===auth.ownerId && m.classId===t.section_id && m.studentId===input.studentId && m.enrollmentId===input.enrollmentId && active(m))) return null;
    return {ownerId:auth.ownerId,classId:t.section_id,teachingId:t.id,current:true,revision:hash([t.teaching_revision,t.term_revision])};
  };
}

/** Extend existing restricted createPostgresRepository; same fenced query, global
 * advisory lock, canonical synchronization, Auth commit guards and COMMIT ACK.
 * New state never enters old repository snapshot codec. No nested transaction.
 */
export function withCredentialRepository(repository,{maxRows=10000,maxBytes=4*1024*1024}={}) {
  if(!repository?.transaction || !Number.isSafeInteger(maxRows) || maxRows<1 || maxRows>10000 || !Number.isSafeInteger(maxBytes) || maxBytes<1024 || maxBytes>16*1024*1024) fail();
  const tables={numericCredentials:'numeric_credentials',numericSessions:'numeric_sessions',numericRates:'numeric_rates',numericAttempts:'numeric_attempts',classReceipts:'class_credential_receipts'};
  // Capabilities never cross HTTP or survive process restart. Unknown COMMIT has
  // no capability, even if its session/receipt later exists in PG. No auto-recovery
  // refund: abandoned receipts expire with their original bounded windows.
  const proofs=new WeakSet();
  const api={
    // Existing global advisory lock + fenced COMMIT, without credential reads.
    claimAttempt:action=>repository.transaction(async(_db,ports)=>{
      const state={},original={};let bytes=0;
      for(const [name,table] of [['numericRates','numeric_rates'],['numericAttempts','numeric_attempts']]) {
        const r=await ports.query(`select case when octet_length(payload::text)<=$2 and sum(octet_length(payload::text)) over (rows unbounded preceding)<=$2 then payload else null end as payload from n88_private.${table} limit $1`,[maxRows+1,maxBytes-bytes]);
        if(r.rows.length>maxRows)fail();
        state[name]=r.rows.map(({payload})=>{if(!payload)fail();bytes+=Buffer.byteLength(JSON.stringify(payload));if(bytes>maxBytes)fail();return payload;});
        original[name]=structuredClone(state[name]);
      }
      const allowed=await action(state,ports);bytes=0;
      for(const [name,table] of [['numericRates','numeric_rates'],['numericAttempts','numeric_attempts']]) {
        if(state[name].length>maxRows)fail();
        const pk=r=>name==='numericRates'?r.key:r.id;
        const after=new Map(state[name].map(r=>[pk(r),r]));if(after.size!==state[name].length)fail();
        const before=new Map(original[name].map(r=>[pk(r),r]));
        for(const row of original[name])if(!after.has(pk(row)))if((await ports.query(`delete from n88_private.${table} where row_key=$1`,[pk(row)])).rowCount!==1)fail();
        for(const row of state[name]) {
          bytes+=Buffer.byteLength(JSON.stringify(row));if(bytes>maxBytes)fail();
          if(before.has(pk(row)) && JSON.stringify(before.get(pk(row)))===JSON.stringify(row))continue;
          if((await ports.query(`insert into n88_private.${table}(row_key,payload) values($1,$2::jsonb) on conflict(row_key) do update set payload=excluded.payload`,[pk(row),JSON.stringify(row)])).rowCount!==1)fail();
        }
      }
      return allowed;
    }),
    commitAttemptSession:async(id,action)=>{
      const committed=await api.transaction(async(db,ports)=>{
        const a=db.numericAttempts.find(a=>a.id===id);
        if(!a || a.sessionId!==null || a.settled)fail();
        const before=new Set(db.numericSessions.map(s=>s.id));
        const value=await action(db,ports);
        const fresh=db.numericSessions.filter(s=>!before.has(s.id));
        if(fresh.length>1)fail();
        if(fresh.length===1) {
          if(fresh[0].revokedAt!==null)fail();
          a.sessionId=fresh[0].id;
        }
        return {value,receipt:fresh.length?structuredClone(a):null};
      }); // returns only AFTER existing fenced durable COMMIT ACK
      const proof=committed.receipt?Object.freeze(committed.receipt):null;
      if(proof)proofs.add(proof);
      return {value:committed.value,proof};
    },
    settleAttempt:async(proof,time)=>{
      if(!proof || !proofs.has(proof) || !Number.isSafeInteger(time))return false;
      return api.transaction(async(db)=>{
        const a=db.numericAttempts.find(a=>a.id===proof.id);
        if(!a || a.settled || a.until<=time || JSON.stringify(a)!==JSON.stringify(proof) ||
          !db.numericSessions.some(s=>s.id===a.sessionId))return false;
        const buckets=a.buckets.map(b=>db.numericRates.find(r=>r.key===b.key && r.epoch===b.epoch && r.until===b.until && r.until>time));
        if(buckets.length!==2 || new Set(buckets).size!==2 || buckets.some(b=>!b || b.count<1))return false;
        for(const b of buckets)b.count--;
        a.settled=true;return true;
      }); // receipt and both debits settle atomically, under SAME global PG lock
    },
    transaction:action=>repository.transaction(async(db,ports)=>{
    if(typeof ports?.query!=='function') fail();
    const extra={},original={};let bytes=0;
    for(const [name,table] of Object.entries(tables)) {
      const r=await ports.query(`select case when octet_length(payload::text)<=$2 and sum(octet_length(payload::text)) over (rows unbounded preceding)<=$2 then payload else null end as payload from n88_private.${table} limit $1`,[maxRows+1,maxBytes-bytes]);
      if(r.rows.length>maxRows) fail();
      extra[name]=r.rows.map(r=>{if(!r.payload) fail();bytes+=Buffer.byteLength(JSON.stringify(r.payload));if(bytes>maxBytes) fail();return r.payload;});
      original[name]=structuredClone(extra[name]);
    }
    // Pass existing state by reference except extension keys, which old codec rejects.
    const state=new Proxy(extra,{get:(o,k)=>k in tables?o[k]:db[k],set:(o,k,v)=>{if(k in tables)o[k]=v;else db[k]=v;return true;}});
    const value=await action(state,ports);
    bytes=0;
    for(const [name,table] of Object.entries(tables)) {
      if(extra[name].length>maxRows) fail();
      const pk=r=>name==='classReceipts'?JSON.stringify([r.ownerId,r.requestId]):name==='numericRates'?r.key:r.id;
      const before=new Map(original[name].map(r=>[pk(r),r])),after=new Map(extra[name].map(r=>[pk(r),r]));
      if(after.size!==extra[name].length) fail();
      for(const [key,row] of before) if(!after.has(key)) {
        if(name==='numericCredentials' || name==='classReceipts') fail();
        if((await ports.query(`delete from n88_private.${table} where row_key=$1`,[key])).rowCount!==1) fail();
      }
      for(const [key,row] of after) {
        bytes+=Buffer.byteLength(JSON.stringify(row));if(bytes>maxBytes) fail();
        if(before.has(key) && JSON.stringify(before.get(key))===JSON.stringify(row)) continue;
        // SQL constraints protect permanent reservations and immutable receipts.
        const ack=before.has(key) ? await ports.query(`update n88_private.${table} set payload=$2::jsonb where row_key=$1`,[key,JSON.stringify(row)]) :
          await ports.query(`insert into n88_private.${table}(row_key,payload) values($1,$2::jsonb)`,[key,JSON.stringify(row)]);
        if(ack.rowCount!==1) fail();
      }
    }
    return value;
  })};
  return Object.freeze(api);
}
