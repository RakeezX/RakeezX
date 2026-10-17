/** AI: actual service/SQL integration; entirely fabricated Auth/ingress/membership.
 * No HTTP listener, public collector, browser, real teacher or hosted service.
 */
import assert from 'node:assert/strict';
import { randomBytes, randomUUID, createHmac, createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createPostgresRepository } from '../../../drafts/n88-student-portal/postgres-repository.mjs';
import { createPortalService, POLICY } from '../../../drafts/n88-student-portal/service.mjs';

const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const NA='n88_A_synthetic_namespace_000001', NB='n88_B_synthetic_namespace_000001';
const origin='https://synthetic.invalid';
const limits={contexts:4,memberships:50,credentials:100,sessions:150,publications:100,rates:1000,total:1500,bytes:1024*1024,rowBytes:4096};
const timing={acquireMs:4000,transactionMs:9000,cleanupMs:400,statementMs:5000,lockMs:4000};
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return{promise,resolve};};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const enteredWithin=async p=>{let timer;try{return await Promise.race([p,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('synthetic_gate_not_entered')),12000);})]);}finally{clearTimeout(timer);}};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const member=(n,extra={})=>({ownerId:A,classId:'term-1',studentId:`fabricated-${n}`,enrollmentId:`enrollment-${n}-1`,revision:1,
  status:'active',endDate:null,studentActive:true,classActive:true,label:`SYNTHETIC ${n}`,...extra});
const publication=(m,extra={})=>({id:randomUUID(),...Object.fromEntries(['ownerId','classId','studentId','enrollmentId'].map(k=>[k,m[k]])),
  source:{teachingId:'fabricated-teaching',itemId:randomUUID()},title:'VISIBLE',instruction:'Fabricated instruction only',deadline:'2026-10-20',status:'todo',published:true,...extra});
const args=m=>({enrollmentId:m.enrollmentId,revision:m.revision});
const cookie=result=>{assert.equal(result.status,200);assert.ok(result.cookie);return result.cookie.split(';')[0];};
const denied=result=>{assert.equal(result.status,401);assert.deepEqual(result.body,{error:'unavailable'});};
const unavailable=result=>{assert.equal(result.status,503);assert.deepEqual(result.body,{error:'unavailable'});assert.equal(result.cookie,undefined);assert.equal(result.headers['Set-Cookie'],undefined);};

export async function qualify({a,b,sql,supplement,report,pool,root}) {
  const check=async(name,fn)=>{
    const item={name,status:'RUNNING'};report.checks.push(item);
    try{item.evidence=await fn();item.status='PASS';}catch(e){item.status='FAIL';throw e;}
  };
  // Fixture DDL only. All state writes below go through the SAME adapter lock.
  await a.query('begin');await a.query(sql);await a.query(supplement);await a.query('commit');
  const pa=pool(), pb=pool();
  const trace=[];
  const repo=(p,{bounds=limits,clock=timing,queryHook,acquireHook}={})=>createPostgresRepository({limits:bounds,timing:clock,
    acquire:async()=>{
      if(acquireHook) return acquireHook();
      const c=await p.connect();
      return {release:e=>c.release(e),query:async(text,values=[])=>{
        // Only fixed statement class is recorded, never values/private paths.
        trace.push(text.startsWith('select pg_advisory')?'lock':text.startsWith('select ')?'select':text.split(' ')[0]);
        if(queryHook) return queryHook(c,text,values);
        return c.query(text,values);
      }};
    }});
  const ra=repo(pa), rb=repo(pb);
  let time=Date.UTC(2026,9,17,12), draw=1000;
  const key=randomBytes(32), digest=(domain,...parts)=>createHmac('sha256',key).update(JSON.stringify(['n88-v2',domain,...parts])).digest('hex');
  const envelopes=new WeakMap();
  const service=(repository,options={})=>{
    const api=createPortalService({repository,origin,now:()=>time,secretKey:key,newCode:()=>String(draw++),
      verifyIngress:r=>envelopes.get(r)?.ingress,
      verifyTeacher:async r=>{if(options.authGate) await options.authGate(r);return envelopes.get(r)?.auth;},...options});
    return (path,{method='POST',body={},cookie='',owner=A,source='synthetic-default',authCurrent=true,headers={}}={})=>{
      const r={path,method,body,headers:{origin,'x-n88-csrf':'1','content-type':'application/json',cookie,...headers}};
      envelopes.set(r,{ingress:{clientKey:source},auth:owner?{ownerId:owner,sessionId:'fake-auth-only',current:authCurrent}:null});
      return api(r);
    };
  };
  const sa=service(ra), sb=service(rb);
  const get=()=>ra.transaction(db=>structuredClone(db));
  const write=fn=>ra.transaction(fn); // Owned canonical fixture writer, never HTTP authorization.
  const resetBudgets=()=>write(db=>{db.rates=[];});
  const issue=(s,m,extra={})=>s('/teacher/issue',{body:args(m),...extra});
  const claim=(s,c,extra={})=>s(`/s/${c.entrySecret}/claim`,{body:{code:c.code},...extra});
  const read=(s,c,token)=>s(`/s/${c.entrySecret}/read`,{method:'GET',cookie:token});
  const first=member(1), second=member(2), foreign=member(3,{ownerId:B,classId:'foreign'});
  const task=publication(first), hidden=publication(first,{title:'PRIVATE_UNPUBLISHED',published:false}),
    other=publication(second,{title:'PRIVATE_OTHER_STUDENT'}), alien=publication(foreign,{title:'PRIVATE_OTHER_OWNER'});
  await write(db=>{
    db.contexts.push({namespace:NA,ownerId:A,active:true},{namespace:NB,ownerId:B,active:true});
    db.memberships.push(first,second,foreign);db.publications.push(task,hidden,other,alien);
  });
  let credential, liveCookie;
  await check('actual_service_issue_claim_read_publish_rotate_revoke_and_projection',async()=>{
    let commitHeld=false, ack=false;
    const commitEntered=deferred(), releaseCommit=deferred();
    const fenced=service(repo(pool(),{queryHook:async(c,text,values)=>{
      if(text==='commit'){commitEntered.resolve();await releaseCommit.promise;const r=await c.query(text,values);ack=true;return r;}
      return c.query(text,values);
    }}));
    const pending=issue(fenced,first).then(r=>{commitHeld=true;return r;});
    await enteredWithin(commitEntered.promise);
    try {await wait(35);assert.equal(commitHeld,false);} finally {releaseCommit.resolve();}
    const issued=await pending;assert.equal(ack,true);assert.equal(issued.status,200);credential=issued.body;
    assert.match(credential.code,/^[1-9][0-9]{3}$/);
    const db=await get();const stored=db.credentials.find(c=>c.studentId===first.studentId);
    assert.equal(stored.verifier,digest('code',NA,credential.code));assert.equal(stored.entryVerifier,digest('entry',credential.entrySecret));
    assert.ok(!JSON.stringify(db).includes(credential.entrySecret));assert.ok(!Object.hasOwn(stored,'code'));
    liveCookie=cookie(await claim(sa,credential));
    const result=await read(sb,credential,liveCookie);assert.equal(result.status,200);
    assert.deepEqual(result.body,{tasks:[{id:task.id,title:task.title,instruction:task.instruction,status:task.status,deadline:task.deadline}],progress:{completed:0,total:1}});
    assert.equal(result.headers['Cache-Control'],'no-store, private');
    assert.equal((await sa('/teacher/publish',{body:{...args(first),publicationId:task.id,published:false,status:'done',title:'UPDATED'}})).status,200);
    assert.equal((await read(sb,credential,liveCookie)).body.tasks.length,0);
    assert.equal((await sa('/teacher/publish',{body:{...args(first),publicationId:task.id,published:true,status:'done',title:'UPDATED'}})).status,200);
    assert.equal((await read(sb,credential,liveCookie)).body.progress.completed,1);
    const rotated=(await issue(sb,first)).body;
    denied(await read(sa,credential,liveCookie));denied(await claim(sa,credential));
    const freshCookie=cookie(await claim(sb,rotated,{source:'rotate-source'}));
    assert.equal((await sa('/teacher/revoke',{body:args(first)})).status,200);
    denied(await read(sb,rotated,freshCookie));denied(await claim(sb,rotated,{source:'revoke-source'}));
    credential=(await issue(sa,first)).body; liveCookie=cookie(await claim(sa,credential,{source:'fresh'}));
    const revoked=(await get()).credentials.filter(c=>c.studentId===first.studentId&&c.revokedAt!==null);
    assert.equal(revoked.length,2);
    return{commitAckFenceObserved:true,storedOnlyVerifiers:true,exactPublishedProjection:true,rotationAndRevocation:true,tombstones:revoked.length};
  });

  await check('two_independent_pools_actual_advisory_wait_collision_and_unique_credentials',async()=>{
    const x=member(10),y=member(11);await write(db=>db.memberships.push(x,y));
    const gate=deferred(),entered=deferred();let call=0;
    const slow=service(ra,{newCode:()=> '5000',authGate:async()=>{entered.resolve();await gate.promise;}});
    const competing=service(rb,{newCode:()=>++call===1?'5000':'5001'});
    const p=issue(slow,x);await enteredWithin(entered.promise);
    const q=issue(competing,y);
    let proof;
    try {
      const until=Date.now()+2500;
      while(Date.now()<until){
        const r=await a.query("select pid,pg_blocking_pids(pid) as blockers,wait_event_type,wait_event from pg_stat_activity where application_name=$1 and wait_event_type='Lock'",[pb.fixtureName]);
        if(r.rows.length&&r.rows[0].blockers.length){proof=r.rows[0];break;}await wait(20);
      }
      assert.ok(proof,'independent PostgreSQL lock wait must be observed');
    } finally {gate.resolve();}
    const results=await Promise.all([p,q]);assert.ok(results.every(r=>r.status===200));assert.notEqual(results[0].body.code,results[1].body.code);
    assert.equal(call,2);
    report.blocking={...proof,independentPools:[pa.fixtureName,pb.fixtureName]};
    // Collision with revoked tombstone is also rejected; never reserve the old PIN.
    const tomb=(await get()).credentials.find(c=>c.studentId===x.studentId);
    assert.equal((await sa('/teacher/revoke',{body:args(x)})).status,200);
    let collisionCalls=0;
    const avoid=service(rb,{newCode:()=>++collisionCalls===1?results[0].body.code:'5002'});
    assert.equal((await issue(avoid,y)).status,200);assert.equal(collisionCalls,2);
    assert.ok((await get()).credentials.some(c=>c.id===tomb.id&&c.revokedAt!==null));
    return{observedLockWait:true,distinctBackends:true,collisionRetries:call,tombstoneReserved:true};
  });

  await check('actual_global_source_context_failure_debits_and_mixed_concurrent_limits',async()=>{
    await resetBudgets();trace.length=0;
    const unknown={entrySecret:randomBytes(32).toString('base64url'),code:'0007'};
    denied(await claim(sa,unknown,{source:'unknown'}));
    let db=await get();assert.equal(db.rates.find(r=>r.key==='global').count,1);assert.equal(db.rates.find(r=>r.key==='global-failure').count,1);
    const contextKey=digest('context',digest('entry',unknown.entrySecret)),sourceKey=digest('source','unknown');
    assert.equal(db.rates.find(r=>r.key===contextKey).count,1);assert.equal(db.rates.find(r=>r.key===sourceKey).count,1);
    assert.ok(trace.indexOf('lock')>=0&&trace.indexOf('lock')<trace.indexOf('select',trace.indexOf('lock')+1));
    // Instrument the actual service snapshot: sensitive collection access throws
    // unless all prelookup attempts already debited (not a replacement service).
    const guarded=service({transaction:fn=>ra.transaction(db=>{
      const probe=new Proxy(db,{get(target,k){
        if(['credentials','contexts','memberships'].includes(k)) {
          assert.equal(target.rates.find(r=>r.key==='global').count,2);
          assert.equal(target.rates.find(r=>r.key===sourceKey).count,2);
          assert.equal(target.rates.find(r=>r.key===contextKey).count,2);
        }return target[k];}});
      return fn(probe);
    })});
    denied(await claim(guarded,{...unknown,code:'9999'},{source:'unknown'}));
    await resetBudgets();
    // 12 simultaneous valid/invalid guesses, same source: precisely six admitted.
    const results=await Promise.all(Array.from({length:12},(_,i)=>claim(i%2?sa:sb,credential,{source:'same-source',body:{code:i%2?'0007':credential.code}})));
    db=await get();assert.equal(db.rates.find(r=>r.key==='global').count,POLICY.sourceAttempts);
    assert.equal(db.rates.find(r=>r.key===digest('source','same-source')).count,6);
    assert.equal(db.rates.find(r=>r.key===digest('context',digest('entry',credential.entrySecret))).count,6);
    const successes=results.filter(r=>r.status===200).length;assert.ok(successes>0&&successes<=6);
    assert.equal(db.rates.find(r=>r.key==='global-failure').count,6-successes);
    assert.equal(db.sessions.filter(s=>s.revokedAt===null).length>=successes,true);
    // Context cap with distinct sources, then global cap across unrelated entries.
    await resetBudgets();
    await Promise.all(Array.from({length:35},(_,i)=>claim(i%2?sa:sb,{...unknown,code:'0007'},{source:`context-${i}`})));
    db=await get();assert.equal(db.rates.find(r=>r.key==='global').count,30);assert.equal(db.rates.find(r=>r.key==='global-failure').count,30);
    await resetBudgets();
    // Seed near the true global limit through the same transaction, then race it.
    await write(db=>db.rates.push({key:'global',count:98,until:time+POLICY.rateWindowMs}));
    await Promise.all(Array.from({length:8},(_,i)=>claim(i%2?sa:sb,{entrySecret:randomBytes(32).toString('base64url'),code:'0007'},{source:`global-${i}`})));
    db=await get();assert.equal(db.rates.find(r=>r.key==='global').count,100);assert.equal(db.rates.find(r=>r.key==='global-failure').count,2);
    // Daily failure ceiling blocks even after the attempt window expires.
    await write(db=>{db.rates=[{key:'global-failure',count:POLICY.globalFailures,until:time+POLICY.failureWindowMs}];});
    denied(await claim(sa,credential,{source:'daily'}));assert.equal((await get()).rates.find(r=>r.key==='global-failure').count,500);
    await resetBudgets();
    return{unknownDebitsCommitted:true,beforeSensitiveLookup:true,mixedConcurrent:12,admitted:6,contextCap:30,globalCap:100,dailyFailureCap:500};
  });

  await check('actual_owner_entry_namespace_session_version_and_membership_guards',async()=>{
    denied(await issue(sa,first,{owner:B,body:{...args(first),ownerId:A}}));
    denied(await issue(sa,first,{authCurrent:false}));denied(await issue(sa,first,{owner:null}));
    denied(await sa('/teacher/publish',{body:{...args(first),publicationId:alien.id,published:true,status:'todo',title:'FORBIDDEN'}}));
    const foreignCredential=(await issue(sb,foreign,{owner:B})).body;
    const foreignCookie=cookie(await claim(sb,foreignCredential,{source:'foreign'}));
    denied(await read(sa,credential,foreignCookie));denied(await read(sb,foreignCredential,liveCookie));
    denied(await sa(`/s/${NA}/read`,{method:'GET',cookie:liveCookie}));
    denied(await claim(sa,{...foreignCredential,code:credential.code},{source:'foreign-wrong-code'}));
    const mutateCheck=async change=>{
      await write(change);denied(await read(sb,credential,liveCookie));
    };
    await mutateCheck(db=>{db.contexts.find(c=>c.ownerId===A).active=false;});
    await write(db=>{db.contexts.find(c=>c.ownerId===A).active=true;});
    await mutateCheck(db=>{db.memberships.find(m=>m.studentId===first.studentId).studentActive=false;});
    await write(db=>{db.memberships.find(m=>m.studentId===first.studentId).studentActive=true;});
    await mutateCheck(db=>{db.memberships.find(m=>m.studentId===first.studentId).classActive=false;});
    await write(db=>{db.memberships.find(m=>m.studentId===first.studentId).classActive=true;});
    // Session version corruption must fail FK at flush (no false read success).
    await assert.rejects(write(db=>{db.sessions.find(s=>s.tokenHash===sha(liveCookie.split('=')[1])).version++;}),/n88_repository_unavailable/);
    // A credential rotation (new version) demonstrably invalidates old sessions.
    const newCred=(await issue(sa,first)).body;denied(await read(sa,credential,liveCookie));
    credential=newCred;liveCookie=cookie(await claim(sb,credential,{source:'guards-new'}));
    const ambiguous=member(1,{classId:'ambiguous',enrollmentId:'ambiguous'});
    await write(db=>db.memberships.push(ambiguous));denied(await read(sa,credential,liveCookie));
    denied(await claim(sa,credential,{source:'ambiguous'}));
    await write(db=>{db.memberships=db.memberships.filter(m=>m.enrollmentId!=='ambiguous');});
    assert.equal((await read(sa,credential,liveCookie)).status,200);
    return{wrongOwnerAndAuth:true,foreignEntryCookie:true,inactiveContextStudentClass:true,versionFkRollback:true,ambiguousMembershipDenied:true,noPrivateProjectionOnDenial:true};
  });

  await check('actual_term_transition_and_login_rotate_revoke_serialization',async()=>{
    await resetBudgets();
    const old=credential, oldStored=(await get()).credentials.find(c=>c.entryVerifier===digest('entry',old.entrySecret));
    // Hold canonical transaction after changing membership. Concurrent service claim
    // must wait in PostgreSQL, then bind ONLY the committed second-term membership.
    const next={...first,classId:'term-2',enrollmentId:'enrollment-1-2',revision:2};
    const entered=deferred(),gate=deferred();
    const writer=write(async db=>{
      const m=db.memberships.find(m=>m.enrollmentId===first.enrollmentId);m.status='ended';m.endDate='2027-01-01';m.revision++;
      db.memberships.push(next);db.publications.push(publication(next,{title:'TERM_TWO'}));entered.resolve();await gate.promise;
    });
    await enteredWithin(entered.promise);
    let done=false;const login=claim(sb,old,{source:'term'}).then(r=>{done=true;return r;});
    try{await wait(45);assert.equal(done,false);}finally{gate.resolve();}
    await writer;const termCookie=cookie(await login);
    denied(await read(sa,old,liveCookie));
    const r=await read(sb,old,termCookie);assert.equal(r.status,200);assert.equal(r.body.tasks.length,1);assert.equal(r.body.tasks[0].title,'TERM_TWO');
    const stored=(await get()).credentials.find(c=>c.id===oldStored.id);assert.deepEqual(stored,oldStored);
    // Revoke holds lock before login: no successful session can escape.
    const entered2=deferred(),gate2=deferred();
    const revoker=service(ra,{authGate:async()=>{entered2.resolve();await gate2.promise;}});
    const revoking=revoker('/teacher/revoke',{body:args(next)});await enteredWithin(entered2.promise);
    const logging=claim(sb,old,{source:'revoke-race'});gate2.resolve();
    assert.equal((await revoking).status,200);denied(await logging);denied(await read(sa,old,termCookie));
    // Login before rotation commits a session, then rotation closes it atomically.
    const current=(await issue(sa,next)).body;
    const entered3=deferred(),gate3=deferred();let locked=false;
    const held=service(repo(pool(),{queryHook:async(c,text,values)=>{
      const result=await c.query(text,values);
      if(text.startsWith('select pg_advisory')&&!locked){locked=true;entered3.resolve();await gate3.promise;}
      return result;
    }}));
    const loggingFirst=claim(held,current,{source:'login-first'});await enteredWithin(entered3.promise);
    const rotating=issue(sb,next);gate3.resolve();
    const previousCookie=cookie(await loggingFirst), replacement=await rotating;assert.equal(replacement.status,200);
    denied(await read(sa,current,previousCookie));
    credential=replacement.body;liveCookie=cookie(await claim(sa,credential,{source:'replacement'}));
    return{stableCredentialId:true,unchangedPinAndEntryAcrossTerm:true,oldSessionDenied:true,currentScopeOnly:true,revokeBeforeLogin:true,loginBeforeRotate:true};
  });

  await check('async_callback_deadline_detachment_acquisition_flush_rollback_commit_faults',async()=>{
    const count=async()=>(await get()).credentials.length;
    let original=await count();
    const failing=service(ra,{newCode:()=>{throw Error('synthetic_callback_error');}});
    unavailable(await issue(failing,second));assert.equal(await count(),original);
    const current=await get();const before=sha(JSON.stringify(current));
    await assert.rejects(write(db=>{db.rates.push({key:'global',count:3,until:time+1000});throw Error('synthetic');}),/n88_repository_unavailable/);
    assert.equal(sha(JSON.stringify(await get())),before);
    // A real PG constraint failure on flush, and a true aborted COMMIT tag.
    let flushCalls=0;
    const flushFail=service(repo(pool(),{queryHook:async(c,text,values)=>{
      if(text.startsWith('insert into n88_private.credentials')) {flushCalls++;return c.query(text,values.map((v,i)=>i===5?'INVALID':v));}
      return c.query(text,values);
    }}));
    unavailable(await issue(flushFail,second));assert.equal(flushCalls,1);assert.equal(await count(),original);
    let commitCalls=0;
    const rolledBack=service(repo(pool(),{queryHook:async(c,text,values)=>{
      if(text==='commit') {commitCalls++;try{await c.query('select 1/0');}catch{} return c.query('commit');}
      return c.query(text,values);
    }}));
    unavailable(await issue(rolledBack,second));assert.equal(commitCalls,1);assert.equal(await count(),original);
    // Simulate lost acknowledgement AFTER real COMMIT. Committed row may exist;
    // service must never return code/cookie or silently replay/reissue it.
    let uncertainCalls=0;
    const uncertain=service(repo(pool(),{queryHook:async(c,text,values)=>{
      const r=await c.query(text,values);if(text==='commit'){uncertainCalls++;throw Error('synthetic_lost_ack');}return r;
    }}));
    unavailable(await issue(uncertain,second));assert.equal(uncertainCalls,1);assert.equal(await count(),original+1);
    original++;
    let delayedCalls=0;const entered=deferred(),gate=deferred();
    const timeoutPool=pool();const timeoutWarm=await timeoutPool.connect();timeoutWarm.release();
    const bounded=repo(timeoutPool,{clock:{...timing,acquireMs:180,transactionMs:180,statementMs:150,lockMs:100,cleanupMs:100}});
    // Warm physical connection so deliberate callback wait, not first-connect CIM,
    // is the lifecycle timeout under test.
    await bounded.transaction(()=>null);
    const late=service(bounded,{authGate:async()=>{entered.resolve();await gate.promise;},newCode:()=>{delayedCalls++;return '7777';}});
    const pending=issue(late,second);await enteredWithin(entered.promise);
    unavailable(await pending);const afterTimeout=await count();
    // A subsequent operation commits while old callback still waits.
    assert.equal((await issue(sb,second)).status,200);const subsequent=sha(JSON.stringify(await get()));
    gate.resolve();await wait(50);assert.equal(delayedCalls,1);
    assert.equal(sha(JSON.stringify(await get())),subsequent);assert.equal(afterTimeout,original);
    // Acquisition timeout destroys the exact late lease without executing work.
    const leaseGate=deferred();let lateReleased=false,callback=false;
    const timedAcquire=repo(pa,{clock:{...timing,acquireMs:30,transactionMs:200,statementMs:150,lockMs:100,cleanupMs:50},acquireHook:()=>leaseGate.promise});
    await assert.rejects(timedAcquire.transaction(()=>{callback=true;}),/n88_repository_unavailable/);
    leaseGate.resolve({query:()=>{throw Error('must not query');},release:e=>{lateReleased=!!e;}});await wait(20);
    assert.equal(lateReleased,true);assert.equal(callback,false);
    // Whole lifecycle deadline also covers a withheld COMMIT acknowledgement.
    const commitGate=deferred();let commitCount=0;
    const pc=pool();const warm=await pc.connect();warm.release();
    const commitTimeout=service(repo(pc,{clock:{...timing,acquireMs:200,transactionMs:250,statementMs:200,lockMs:150,cleanupMs:100},queryHook:async(c,text,values)=>{
      const result=await c.query(text,values);if(text==='commit'){commitCount++;await commitGate.promise;}return result;
    }}));
    const timeoutResult=await issue(commitTimeout,second);unavailable(timeoutResult);assert.equal(commitCount,1);commitGate.resolve();await wait(20);
    return{callbackExceptionRollback:true,realFlushFailure:true,rollbackCommitTagDenied:true,uncertainCommitNoReplay:uncertainCalls,
      asyncTimeoutDetached:true,lateCallbackCannotFlush:true,lateAcquisitionDestroyed:true,commitAckDeadline:true};
  });

  await check('bounded_snapshot_strict_mapping_retention_and_inactive_bindings',async()=>{
    await resetBudgets();
    const limited=repo(pa,{bounds:{...limits,memberships:1}});let called=false;
    await assert.rejects(limited.transaction(()=>{called=true;}),/n88_repository_unavailable/);assert.equal(called,false);
    const globalBound=repo(pa,{bounds:{...limits,total:2}});
    await assert.rejects(globalBound.transaction(()=>{}),/n88_repository_unavailable/);
    const byteBound=repo(pa,{bounds:{...limits,bytes:1024}});
    await assert.rejects(byteBound.transaction(()=>{}),/n88_repository_unavailable/);
    const badValues=[db=>{db.memberships[0].revision=Number.MAX_SAFE_INTEGER+1;},db=>{db.memberships[0].revision='1';},
      db=>{db.contexts[0].ownerId='untrusted';},db=>{db.memberships[0].endDate='2026-02-30';},
      db=>{db.memberships[0].studentActive=null;},db=>{db.publications[0].source={teachingId:'x',itemId:'x',extra:'PII'};},
      db=>{db.credentials=[];},db=>{db.rates.push({key:'global',count:-1,until:time});},
      db=>{db.sessions.push({...db.sessions[0],id:randomUUID(),expiresAt:Infinity});},
      db=>{db.memberships[0].label='x'.repeat(301);},db=>{db.memberships.push({...db.memberships[0]});}];
    for(const mutate of badValues) await assert.rejects(write(mutate),/n88_repository_unavailable/);
    // Real database bigint outside JS exact range: decoder must reject before callback.
    // Local fixture mutation still takes the same global lock; restore in finally.
    await a.query('begin');await a.query('select pg_advisory_xact_lock(1312307256,88)');
    await a.query('update n88_private.memberships set revision=$1 where owner_id=$2 and enrollment_id=$3',['9007199254740992',A,second.enrollmentId]);await a.query('commit');
    try{await assert.rejects(get(),/n88_repository_unavailable/);}finally{
      await a.query('begin');await a.query('select pg_advisory_xact_lock(1312307256,88)');
      await a.query('update n88_private.memberships set revision=1 where owner_id=$1 and enrollment_id=$2',[A,second.enrollmentId]);await a.query('commit');
    }
    const before=(await get()).credentials.map(c=>c.id);
    await write(db=>{db.rates.push({key:'global',count:3,until:time-1});db.sessions.push({...db.sessions[0],id:randomUUID(),tokenHash:sha('fabricated-expired'),expiresAt:time-1});});
    assert.equal((await sa('/teacher/students',{method:'GET'})).status,200);
    const after=await get();assert.equal(after.rates.some(r=>r.key==='global'),false);assert.equal(after.sessions.some(s=>s.expiresAt<=time||s.revokedAt!==null),false);
    assert.deepEqual(after.credentials.map(c=>c.id).sort(),before.sort());
    const base='98d8e7ab2905a2786461745af970f0b8f4fb9288';
    const git=(...args)=>execFileSync('C:/Program Files/Git/cmd/git.exe',args,{cwd:root,windowsHide:true,maxBuffer:4*1024*1024});
    const reused=['drafts/n88-student-portal/service.mjs','drafts/n88-student-portal/memory-repository.mjs','drafts/n88-student-portal/schema-proposal.sql',
      'tests/n88-native-postgres-qualification.result.json','tests/n88-real-pilot.test.mjs','tests/n88-real-pilot-final-policy-browser.json',
      'docs/automation-evidence/20261017/N88_FINAL_APPROVED_PIN_AND_TERM_IDENTITY.md'];
    report.reusedBindings={};
    for(const file of reused){const data=await readFile(`${root}/${file}`);assert.equal(sha(data.toString().replace(/\r\n/g,'\n')),sha(git('show',`${base}:${file}`).toString().replace(/\r\n/g,'\n')));report.reusedBindings[file]=sha(data);}
    const previous=JSON.parse(await readFile(`${root}/tests/n88-native-postgres-qualification.result.json`,'utf8'));assert.equal(previous.status,'PASS');
    const browser=JSON.parse(await readFile(`${root}/tests/n88-real-pilot-final-policy-browser.json`,'utf8'));
    assert.ok(browser); // prior browser proof is hash-bound, never described as a new UI run.
    assert.equal(git('diff',base,'--','src','public','sw.js','index.html','scripts','supabase').length,0);
    let entries='';
    try{entries=git('grep','-n','-E',"(import|require|from).*(n88-student-portal/postgres-repository)",'--','src','public','sw.js','index.html').toString();}
    catch(e){assert.equal(e.status,1);}
    assert.equal(entries,'');
    return{perTableAndGlobalAndByteFailClosed:true,invalidValues:badValues.length,unsafeSqlBigintRejected:true,
      expiredRatesSessionsCleaned:true,credentialTombstonesRetained:true,unchangedEvidenceBindings:reused.length,inactive:true};
  });

  // Persistence state is kept only in memory across the runner's owned stop/restart.
  await resetBudgets();
  const persisted=(await issue(sa,second)).body;
  const persistedCookie=cookie(await claim(sb,persisted,{source:'persisted-valid'}));
  denied(await claim(sa,{...persisted,code:'0007'},{source:'persisted-wrong'}));
  const snapshotBefore=await get();
  report.persistence={stateSha256:sha(JSON.stringify(snapshotBefore)),credentialVerifierCount:snapshotBefore.credentials.length,
    revokedCount:snapshotBefore.credentials.filter(c=>c.revokedAt!==null).length,globalCount:snapshotBefore.rates.find(r=>r.key==='global').count};
  return async freshPool=>{
    const rr=repo(freshPool), api=service(rr);
    await check('new_pool_service_after_controlled_stop_restart_persistence',async()=>{
      const after=await rr.transaction(db=>structuredClone(db));
      // Database SELECT order is unspecified: compare table sets by canonical row JSON.
      const canonical=db=>Object.fromEntries(Object.entries(db).map(([k,rows])=>[k,rows.map(r=>JSON.stringify(r)).sort()]));
      assert.deepEqual(canonical(after),canonical(snapshotBefore));
      assert.equal((await read(api,persisted,persistedCookie)).status,200);
      denied(await claim(api,{...persisted,code:'0007'},{source:'persisted-wrong'}));
      const debited=await rr.transaction(db=>structuredClone(db));assert.equal(debited.rates.find(r=>r.key==='global').count,3);
      const retired=snapshotBefore.credentials.find(c=>c.revokedAt!==null);assert.ok(retired);
      assert.equal(after.credentials.find(c=>c.id===retired.id).revokedAt,retired.revokedAt);
      assert.equal((await api('/teacher/revoke',{body:args(second)})).status,200);denied(await read(api,persisted,persistedCookie));
      return{sameDatabaseState:true,actualRead200:true,budgetContinuesAt:3,revocationPersists:true,newPoolAndService:true,controlledRestartOnly:true};
    });
  };
}
