/** AI-authored. Inactive composition ports for the EXISTING N88 transaction/service. */
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { PRIVATE_HEADERS } from './service.mjs';
const fail=()=>{throw Error('n88_class_unavailable');};
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const active=m=>m.status==='active' && m.endDate===null && m.studentActive===true && m.classActive===true;
const id=value=>typeof value==='string' && value.length>0 && value.length<=240 && !value.includes('\0');
const requestId=value=>typeof value==='string' && /^[A-Za-z0-9_-]{16,100}$/.test(value);
const version=(db,m)=>Math.max(0,...db.numericCredentials.filter(c=>c.ownerId===m.ownerId && c.studentId===m.studentId).map(c=>c.version));
const live=(db,m)=>db.numericCredentials.some(c=>c.ownerId===m.ownerId && c.studentId===m.studentId && c.revokedAt===null);
const result=(status,body)=>({status,body,headers:{...PRIVATE_HEADERS}});
const denied=()=>result(401,{error:'unavailable'});
const replay=receipt=>receipt.results.map(r=>r.status==='created' ? {...r,status:'uncertain',recovery:'deliberate_rotate_required'} : {...r});
const summary=rows=>Object.fromEntries(['created','skipped','failed','uncertain'].map(s=>[s,rows.filter(r=>r.status===s).length]));

/** resolveClass must lock CURRENT canonical teaching/term/source under ports.query;
 * verifyTeacher uses existing current-server Auth verifier and beforeCommit guard.
 * Helpers MUST mutate only the supplied transaction state, never open transactions,
 * send responses, log secrets or call the old four-digit HTTP /teacher/issue route.
 * Bind request via forRequest(request) in existing authenticated/CSRF ingress handler.
 */
export function createClassCredentialOperations({repository,verifyTeacher,verifyIngress,origin,resolveClass,issueMember,rotateMember,revokeMember}) {
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
        if(!auth?.ownerId || !auth.sessionId || auth.current!==true || typeof ports?.synchronizeOwner!=='function') return denied();
        await ports.synchronizeOwner(auth.ownerId);
        const scope=await resolveClass(db,ports,auth,teachingId,input);
        if(!scope || scope.ownerId!==auth.ownerId || scope.current!==true || !id(scope.teachingId) || !id(scope.classId) || !id(scope.revision)) return denied();
        if(teachingId!==null && scope.teachingId!==teachingId) return denied();
        const members=db.memberships.filter(m=>m.ownerId===auth.ownerId && m.classId===scope.classId && active(m));
        if(members.length>2000 || new Set(members.map(m=>m.studentId)).size!==members.length) return denied();
        // Ambiguous current enrollment anywhere under this owner cannot issue a code.
        if(members.some(m=>db.memberships.filter(x=>x.ownerId===m.ownerId && x.studentId===m.studentId && active(x)).length!==1)) return denied();
        members.sort((a,b)=>a.studentId.localeCompare(b.studentId));
        const rosterRevision=hash([scope.teachingId,scope.revision,members.map(m=>[m.studentId,m.enrollmentId,m.revision,m.canonicalStamp])]);
        if(action==='list') return result(200,{teachingId:scope.teachingId,rosterRevision,students:members.map(m=>({studentId:m.studentId,
          enrollmentId:m.enrollmentId,revision:m.revision,label:m.label,credentialVersion:version(db,m),hasActiveCredential:live(db,m)}))});
        if(!requestId(input.requestId)) return denied();
        const binding=hash([action,scope.teachingId,input.expectedRosterRevision??null,input.studentId??null,input.enrollmentId??null,input.revision??null,input.credentialVersion??null]);
        const prior=db.classReceipts.find(r=>r.ownerId===auth.ownerId && r.requestId===input.requestId);
        if(prior) {
          if(prior.binding!==binding) return result(409,{error:'stale_request'});
          const rows=replay(prior);return result(200,{requestId:input.requestId,replayed:true,results:rows,counts:summary(rows)});
        }
        if(db.classReceipts.length>=10000) fail(); // fail closed, never evict an idempotency boundary
        if(action==='batch' && input.expectedRosterRevision!==rosterRevision) return result(409,{error:'roster_changed'});
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
          const before=structuredClone({credentials:db.numericCredentials,sessions:db.numericSessions});
          try {
            const issued=await ({batch:issueMember,rotate:rotateMember,revoke:revokeMember}[action])(db,m,{expectedVersion});
            if(action==='revoke') {
              if(issued?.revoked!==true || live(db,m)) fail();
              rows.push({...base,status:'skipped',reason:'revoked'});
            } else {
              if(!/^1[0-9]{11}$/.test(issued?.code || '') || issued.credentialVersion!==expectedVersion+1 || !live(db,m)) fail();
              rows.push({...base,credentialVersion:issued.credentialVersion,status:'created'});
              secrets.push({studentId:m.studentId,code:issued.code});
            }
          } catch {
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
  const tables={numericCredentials:'numeric_credentials',numericSessions:'numeric_sessions',numericRates:'numeric_rates',classReceipts:'class_credential_receipts'};
  return Object.freeze({transaction:action=>repository.transaction(async(db,ports)=>{
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
  })});
}
