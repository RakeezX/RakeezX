/** Actual boundaries + actual SQL. Every identity, event and crypto/sender port is fabricated. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createRegistrationBoundary } from '../../../drafts/n44-push/registration.mjs';
import { createDeliveryBoundary } from '../../../drafts/n44-push/delivery.mjs';
import { createPostgresRepository, SNAPSHOT_LIMITS } from '../../../drafts/n44-push/postgres-repository.mjs';
import { deliveryKey } from '../../../drafts/n44-push/shared.mjs';

const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const S='n44_push_draft';
const rid=n=>`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const fingerprint=n=>n.toString(16).padStart(64,'0');
const prefs=()=>({lesson:true,due:true,lessonMinutes:15,dueDays:[3,2,1,0],timezone:'Asia/Riyadh',quiet:null});
let now, callbacks=0, deleted=false;
const events=new Map();
const event=n=>{const p={id:`lesson:session-${n}:2026-10-17:12:00:13:00`,kind:'lesson',expiresAt:now+3600_000,actionPath:`/teaching/teaching-${n}/attendance?session=session-${n}`}; events.set(p.id,p); return p;};
const context=()=>({workspaceId:'workspace',deviceId:'device',active:true,sessionId:'session',sessionRevision:'revision',sessionExpiresAt:now+31*86400_000,consentRevision:'consent',pushConsent:true,preferences:prefs()});
const body=n=>({registrationId:rid(n),workspaceId:'workspace',deviceId:'device',sessionRevision:'revision',consent:{revision:'consent',push:true},subscription:{endpoint:'https://push.example.test/fabricated',keys:{p256dh:`BA${'A'.repeat(85)}`,auth:'A'.repeat(22)}}});
// Trusted fixture chooses owner/role OUTSIDE the repository. This is NOT real Auth.
function port(pool,owner,hook) {
  return {acquire:async()=>{
    const c=await pool.connect();
    return {query:async(text,values)=>{
      if(hook) {const answer=await hook({c,text,values}); if(answer) return answer;}
      const answer=await c.query(text,values);
      if(text.startsWith('begin')) {
        await c.query('set local role n44_repository_probe');
        await c.query("select set_config('n44.fixture_uid',$1,true)",[owner]);
      }
      return answer;
    },release:e=>c.release(e)};
  }};
}
function boundaries(repo,owner=A,n=1,fp=n,send=async()=> 'accepted') {
  const auth={ownerId:owner,sessionId:'session',sessionRevision:'revision',expiresAt:now+31*86400_000};
  const registration=createRegistrationBoundary({repository:repo,clock:()=>now,
    verifySession:async transport=>transport==='synthetic' ? {...auth} : null,
    protect:async()=>({sealed:'FAKE-SEALED-NOT-CRYPTO',fingerprint:fingerprint(fp),bindingFingerprint:fingerprint(999)}),
    approvedOrigins:['https://push.example.test']});
  const delivery=createDeliveryBoundary({repository:repo,clock:()=>now,
    recompute:(_tx,_r,id)=>deleted ? null : events.get(id),
    sender:{async send(value){callbacks++; return send(value);}}});
  return {auth,registration,delivery,register:()=>registration.register('synthetic',body(n)),
    revoke:()=>registration.revoke('synthetic',{registrationId:rid(n),workspaceId:'workspace',deviceId:'device'}),
    deliver:p=>delivery.deliver(owner,rid(n),p)};
}
async function putContext(repo,change={}) {return repo.writeContexts(A,tx=>tx.set('contexts',JSON.stringify(['workspace','device']),{...context(),...change}));}
async function check(report,name,fn) {const c={name,status:'RUNNING'}; report.cases.push(c); try {c.evidence=await fn();c.status='PASS';}catch(e){c.status='FAIL';c.sqlstate=e.code??null;throw e;}}
const status=async(p,expected)=>assert.equal((await p).status,expected);
async function waitForLock(admin,blocker,report,minimum=1) {
  const deadline=Date.now()+2500;
  while(Date.now()<deadline) {
    // PostgreSQL reports both hard and soft blockers. Later tuple-lock waiters
    // can name an earlier waiter rather than the original owner; follow the
    // bounded actual backend graph, do not require every edge to point to root.
    const r=await admin.query("select pid,application_name,wait_event_type,wait_event,pg_blocking_pids(pid) as blockers from pg_stat_activity where wait_event_type='Lock' and application_name like 'n44-repository-fixture-%'");
    const reachable=new Set([blocker]), connected=[];
    for(let i=0;i<12;i++) for(const row of r.rows) if(!reachable.has(row.pid) && row.blockers.some(pid=>reachable.has(pid))) {reachable.add(row.pid);connected.push(row);}
    if(new Set(connected.map(row=>row.application_name)).size>=minimum) {report.lockObservations.push(...connected);return;}
    report.lastLockSnapshot={root:blocker,rows:r.rows};
    await new Promise(resolve=>setTimeout(resolve,20));
  }
  assert.fail('two SQL backends did not exhibit the expected lock wait');
}
export async function qualify({a,b,sql,report,root,pool}) {
  report.cases=[];report.lockObservations=[];
  now=Date.now()+1000; report.fixtureNow=now;
  await a.query(`create role anon nologin nosuperuser nobypassrls; create role authenticated nologin nosuperuser nobypassrls;
    create role n44_repository_probe nologin nosuperuser nobypassrls inherit;
    grant authenticated to n44_repository_probe;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('n44.fixture_uid',true),'')::uuid$$;
    revoke all on schema auth from public; revoke all on function auth.uid() from public;
    grant usage on schema auth to n44_repository_probe; grant execute on function auth.uid() to n44_repository_probe;`);
  await a.query('insert into auth.users values ($1),($2)',[A,B]);
  await a.query(sql);
  // ONLY this new disposable database gets the separate trusted fixture capability.
  await a.query(`grant usage on schema ${S} to n44_repository_probe;
    grant select,insert,update,delete on all tables in schema ${S} to n44_repository_probe;`);
  const p1=pool(),p2=pool();
  report.repositorySessions=[];
  for(const p of [p1,p2]) {
    const c=await port(p,A).acquire();
    try {
      await c.query('begin');
      report.repositorySessions.push((await c.query('select pg_backend_pid() as pid,current_user as role,rolsuper,rolbypassrls from pg_roles where rolname=current_user')).rows[0]);
      await c.query('rollback');
    } finally {c.release();}
  }
  assert.notEqual(report.repositorySessions[0].pid,report.repositorySessions[1].pid);
  for(const session of report.repositorySessions) assert.deepEqual({...session,pid:0},{pid:0,role:'n44_repository_probe',rolsuper:false,rolbypassrls:false});
  const r1=createPostgresRepository(port(p1,A)),r2=createPostgresRepository(port(p2,A));
  const rb=createPostgresRepository(port(p2,B));
  await putContext(r1); await rb.writeContexts(B,tx=>tx.set('contexts',JSON.stringify(['workspace','device']),context()));
  const f=boundaries(r1),g=boundaries(r2);
  await check(report,'actual registration, original UUID replay, wrong identity, global claim conflict',async()=>{
    const role=await r1.atomic(A,tx=>tx.rows('registrations'));assert.deepEqual(role,[]);
    assert.ok(await r1.atomic(A,tx=>tx.time(0)) >= report.fixtureNow-1000);
    assert.deepEqual((await a.query("select rolsuper,rolbypassrls from pg_roles where rolname='n44_repository_probe'")).rows,[{rolsuper:false,rolbypassrls:false}]);
    await status(f.registration.register('bad',body(1)),'rejected');
    await status(f.register(),'registered');await status(g.register(),'registered');
    const other=boundaries(rb,B,2,1);await status(other.register(),'unavailable');
    assert.deepEqual(await rb.atomic(B,tx=>tx.rows('budgets')),[]);
    assert.equal((await a.query(`select count(*)::int as n from ${S}.registrations where owner_id=$1`,[B])).rows[0].n,0);
    await status(other.revoke(),'revoked');
    assert.equal(await rb.atomic(B,tx=>tx.get('registrations',rid(1))),undefined);
    await assert.rejects(rb.atomic(A,()=>true),/n44_repository_unavailable/);
    await status(f.registration.register('synthetic',{...body(1),sessionRevision:'stale'}),'rejected');
    await status(f.registration.revoke('synthetic',{registrationId:rid(1),workspaceId:'wrong',deviceId:'device'}),'rejected');
    const values=(await a.query(`select owner_id,registration_id from ${S}.endpoint_claims`)).rows;
    assert.deepEqual(values,[{owner_id:A,registration_id:rid(1)}]);
    return 'Actual register/replay succeeded; cross-owner unique loser rolled back generically; foreign read/revoke and RLS owner mismatch preserved original.';
  });
  await check(report,'20 concurrent actual boundary deliveries, commit-before-local-sender and PG wait',async()=>{
    const e=event(1); const before=callbacks;
    // Earlier deliberate errors discard connections. Complete identity checks on
    // each replacement BEFORE starting the short lock-observation phase.
    await Promise.all([r1.atomic(A,tx=>tx.time(now)),r2.atomic(A,tx=>tx.time(now))]);
    // Hold with a THIRD connection; both repositories must reach actual PostgreSQL.
    await b.query('begin'); await b.query(`select * from ${S}.owner_clock where owner_id=$1 for update`,[A]);
    const pid=(await b.query('select pg_backend_pid() as pid')).rows[0].pid;
    const observed=[];
    const observe=async()=>{
      const row=(await a.query(`select state,attempts from ${S}.deliveries where owner_id=$1 and event_id=$2`,[A,e.id])).rows[0];
      assert.deepEqual(row,{state:'sending',attempts:1}); observed.push(row); return 'accepted';
    };
    const x=boundaries(r1,A,1,1,observe),y=boundaries(r2,A,1,1,observe);
    const pending=Promise.all(Array.from({length:20},(_,i)=>(i%2?x:y).deliver(e)));
    try {await waitForLock(a,pid,report,2);assert.equal(callbacks,before);}finally{await b.query('commit');}
    const outcomes=await pending;
    assert.equal(outcomes.filter(o=>o.status==='sent').length,1);assert.equal(outcomes.filter(o=>o.status==='duplicate').length,19);
    assert.equal(callbacks-before,1);assert.equal(observed.length,1);
    const budgets=(await a.query(`select budget_key,count from ${S}.budgets where owner_id=$1 order by budget_key`,[A])).rows;
    assert.deepEqual(budgets,[{budget_key:'day:device',count:1},{budget_key:'hour:device',count:1},{budget_key:'owner-day',count:1},{budget_key:'register',count:1}]);
    return '20 calls, two independent pools; actual lock wait, one committed sending permit, one callback observing it from another connection, 19 duplicates, exact budget debits.';
  });
  await check(report,'current context, preference, consent, expiry, deleted event and owner-clock monotonicity',async()=>{
    const before=callbacks;
    for(const patch of [{active:false},{pushConsent:false},{sessionRevision:'new'},{consentRevision:'new'},
      {sessionExpiresAt:now-1},{preferences:{...prefs(),lesson:false}},
      {preferences:{...prefs(),quiet:{start:0,end:0}}}]) {
      await putContext(r1,patch);await status(g.deliver(event(events.size+1)),'suppressed');
    }
    await putContext(r1);deleted=true;await status(g.deliver(event(20)),'suppressed');deleted=false;
    const expired=event(21);expired.expiresAt=now-1;await status(g.deliver(expired),'rejected');
    const high=await r1.atomic(A,tx=>tx.time(now+1000));
    const later=await r2.atomic(A,tx=>tx.time(0));
    assert.ok(later>=high); // The authoritative database clock may advance.
    now=later;
    assert.equal(callbacks,before);
    return 'Existing boundaries reloaded committed active/revision/consent/preferences/expiry/quiet/event state and suppressed without a callback; persisted clock never decreased.';
  });
  await check(report,'owner-locked context writer serializes before reservation on another pool',async()=>{
    for(const change of [{active:false},{preferences:{...prefs(),lesson:false}}]) {
      await putContext(r1);
      let entered,release;
      const atLock=new Promise(r=>entered=r), gate=new Promise(r=>release=r);
      let blocker;
      const writer=createPostgresRepository(port(p1,A,async({c,text})=>{
        if(text.startsWith('select high_water_ms')) {
          const rows=await c.query(text,[A]);blocker=(await c.query('select pg_backend_pid() as pid')).rows[0].pid;
          entered();await gate;return rows;
        }
      }));
      const w=putContext(writer,change);await atLock;
      const before=callbacks, sending=g.deliver(event(events.size+30));
      try {await waitForLock(a,blocker,report);}finally{release();}
      await w;await status(sending,'suppressed');assert.equal(callbacks,before);
    }
    await putContext(r1);
    return 'Two observed backend lock waits: committed context revocation and preference disable each preceded subsequent reservation; zero sender callbacks.';
  });
  await check(report,'definitive retry, uncertain no replay, real SQL budget ceiling',async()=>{
    let outcome='not_accepted_retryable';
    const retrying=boundaries(r1,A,1,1,async()=>outcome),e=event(70);
    await status(retrying.deliver(e),'retry');await status(g.deliver(e),'backoff');
    // Anchor the synthetic advance to the actual committed DB-time receipt,
    // rather than assuming the database clock stopped during the sender await.
    now=Number((await a.query(`select next_at_ms::text from ${S}.deliveries where owner_id=$1 and event_id=$2`,[A,e.id])).rows[0].next_at_ms);
    assert.ok(Number.isSafeInteger(now));outcome='accepted';await status(retrying.deliver(e),'sent');
    const uncertain=boundaries(r2,A,1,1,async()=>{throw Error('fabricated uncertain');});
    const u=event(71);await status(uncertain.deliver(u),'uncertain');const before=callbacks;
    await status(f.deliver(u),'duplicate');assert.equal(callbacks,before);
    for(let i=0;i<8;i++) await f.deliver(event(80+i));
    const count=(await a.query(`select count from ${S}.budgets where owner_id=$1 and budget_key='hour:device'`,[A])).rows[0].count;
    assert.equal(count,6);
    await status(g.deliver(event(99)),'limited');
    return 'Actual retry/backoff then attempt 2 sent; thrown sender outcome persisted uncertain and never replayed; hour SQL counter capped at 6 and subsequent event limited.';
  });
  await check(report,'faults in begin/read/flush/rollback/commit, explicit bounded retries, ambiguous commit fencing',async()=>{
    now+=3600_000;
    const fault=(matches,{commitThenThrow=false,rollbackFails=false,code,always=false}={})=>{
      let fired=0,begins=0;
      const repo=createPostgresRepository(port(p2,A,async({c,text,values})=>{
        if(text.startsWith('begin')) begins++;
        if(rollbackFails && text==='rollback') {const e=new Error('fabricated rollback loss');throw e;}
        if(matches(text) && (always || fired===0)) {
          fired++;if(commitThenThrow) await c.query(text,values);
          if(code) { // A genuine PG ErrorResponse, inside a genuinely aborted SQL tx.
            await c.query(`do $$begin raise exception using errcode='${code}', message='synthetic'; end$$`);
          }
          throw Error('fabricated transport failure');
        }
      }));
      return {repo,get fired(){return fired;},get begins(){return begins;}};
    };
    for(const [label,predicate,opts] of [
      ['begin',t=>t.startsWith('begin'),{}],['read',t=>t.startsWith('select workspace_id'),{}],
      ['flush',t=>t.startsWith('insert into n44_push_draft.deliveries'),{}],
      ['commit before send',t=>t==='commit',{}],['rollback failure',t=>t.startsWith('insert into n44_push_draft.deliveries'),{rollbackFails:true}],
    ]) {
      const broken=fault(predicate,opts),test=boundaries(broken.repo),e=event(events.size+100),before=callbacks;
      await status(test.deliver(e),'unavailable');assert.equal(callbacks,before,label);assert.equal(broken.begins,1,label);
      assert.equal((await a.query(`select count(*)::int as n from ${S}.deliveries where event_id=$1`,[e.id])).rows[0].n,0,label);
    }
    for(const code of ['40001','40P01']) {
      const once=fault(t=>t.startsWith('select workspace_id'),{code});
      await once.repo.atomic(A,tx=>tx.time(now));assert.equal(once.fired,1);assert.equal(once.begins,2);
      const twice=fault(t=>t.startsWith('select workspace_id'),{code,always:true});
      await assert.rejects(twice.repo.atomic(A,tx=>tx.time(now)),/n44_repository_unavailable/);assert.equal(twice.begins,2);
    }
    const lost=fault(t=>t==='commit',{commitThenThrow:true}),e=event(300),before=callbacks;
    await status(boundaries(lost.repo).deliver(e),'unavailable');assert.equal(lost.begins,1);assert.equal(callbacks,before);
    assert.equal((await a.query(`select state from ${S}.deliveries where event_id=$1`,[e.id])).rows[0].state,'sending');
    await status(g.deliver(e),'duplicate');assert.equal(callbacks,before);
    report.restartEvent=e;
    report.restartRegistration=rid(1);
    report.restartBudget=(await a.query(`select budget_key,bucket::text,count,expires_at_ms::text from ${S}.budgets where owner_id=$1 order by budget_key`,[A])).rows;
    return 'No sender or durable row on begin/read/flush/rollback/pre-COMMIT failures. Real 40001/40P01 aborted tx retries once, repeated failures stop at two attempts. COMMIT-then-lost-ack retains sending; no retry or callback.';
  });
  await check(report,'sync contract, strict decoding, snapshot bounds, deep clones and exact endpoint release',async()=>{
    assert.throws(()=>r1.atomic('not-uuid',()=>true),/n44_repository_unavailable/);
    assert.throws(()=>r1.atomic(A,async()=>true),/n44_repository_unavailable/);
    await assert.rejects(r1.atomic(A,()=>r2.atomic(A,()=>true)),/n44_repository_unavailable/);
    await assert.rejects(r1.atomic(A,()=>Promise.resolve(1)),/n44_repository_unavailable/);
    await assert.rejects(r1.atomic(A,()=>Promise.reject(Error('fabricated async callback rejection'))),/n44_repository_unavailable/);
    let saved;
    await r1.atomic(A,tx=>{saved=tx;const r=tx.get('registrations',rid(1));r.state='dead';const p=tx.context('workspace','device');p.active=false;});
    assert.throws(()=>saved.rows('registrations'),/n44_repository_unavailable/);
    assert.equal(await r2.atomic(A,tx=>tx.get('registrations',rid(1)).state),'active');
    await assert.rejects(r1.atomic(A,tx=>tx.get('arbitrary_sql','x')),/n44_repository_unavailable/);
    await assert.rejects(r1.atomic(A,tx=>tx.set('budgets','owner-day',{bucket:1,count:1,expiresAt:Number.MAX_SAFE_INTEGER+1})),/n44_repository_unavailable/);
    await assert.rejects(r1.atomic(A,tx=>{const r=tx.get('registrations',rid(1));tx.set('registrations',rid(1),{...r,state:'unknown'});}),/n44_repository_unavailable/);
    await assert.rejects(r1.atomic(A,tx=>{
      const r=tx.rows('deliveries')[0];tx.set('deliveries','["noncanonical-key"]',r);
    }),/n44_repository_unavailable/);
    const previousBudgets=await r1.atomic(A,tx=>tx.entries('budgets'));
    await assert.rejects(r1.atomic(A,tx=>{tx.delete('budgets','owner-day');throw Error('fabricated synchronous failure');}),/n44_repository_unavailable/);
    assert.deepEqual(await r2.atomic(A,tx=>tx.entries('budgets')),previousBudgets);
    // Malformed persisted rows inserted only by fabricated administrative fixture.
    await a.query(`update ${S}.contexts set preferences='{"unknown":true}' where owner_id=$1`,[A]);
    await assert.rejects(r1.atomic(A,()=>true),/n44_repository_unavailable/);
    await a.query(`update ${S}.contexts set preferences=$2 where owner_id=$1`,[A,JSON.stringify(prefs())]);
    await a.query(`update ${S}.owner_clock set high_water_ms=9007199254740992 where owner_id=$1`,[A]);
    await assert.rejects(r1.atomic(A,()=>true),/n44_repository_unavailable/);
    await a.query(`update ${S}.owner_clock set high_water_ms=$2 where owner_id=$1`,[A,now]);
    // LIMIT+1 real SQL rows: the adapter must reject, not silently truncate.
    await a.query(`insert into ${S}.contexts select $1,'overflow-'||g,'device',true,'session','revision',$2,'consent',true,$3::jsonb from generate_series(1,$4) g`,[A,now+86400_000,JSON.stringify(prefs()),SNAPSHOT_LIMITS.contexts]);
    await assert.rejects(r1.atomic(A,()=>true),/n44_repository_unavailable/);
    await a.query(`delete from ${S}.contexts where owner_id=$1 and workspace_id like 'overflow-%'`,[A]);
    await r1.atomic(A,tx=>tx.releaseEndpoint(fingerprint(1),rid(999)));
    assert.equal((await a.query(`select registration_id from ${S}.endpoint_claims where owner_id=$1`,[A])).rows[0].registration_id,rid(1));
    return 'Synchronous-only/reentry/expired handle guards; detached clones; fixed tables; unsafe bigint and preference shape fail closed; actual LIMIT+1 overflow rejected; wrong UUID cannot release endpoint.';
  });
  // Reuse unchanged qualified source; do not rerun 16 memory cases or old raw SQL suite.
  const paths=['drafts/n44-push/registration.mjs','drafts/n44-push/delivery.mjs','drafts/n44-push/shared.mjs','drafts/n44-push/schema-proposal.sql',
    'src/lib/notification-push-core.js','src/lib/notification-state.js','src/lib/notification-center.js',
    'tests/n44-native-postgres-qualification.result.json','tests/n44-server-preactivation.test.mjs','tests/fixtures/n44-server-preactivation/fakes.mjs'];
  report.unchangedHashes={};
  for(const file of paths) {
    const bytes=await readFile(`${root}/${file}`);
    const base=execFileSync('git',['show',`${report.baseSha}:${file}`],{cwd:root,maxBuffer:2*1024*1024,windowsHide:true});
    assert.ok(bytes.equals(base),`unchanged ${file}`);report.unchangedHashes[file]=createHash('sha256').update(bytes).digest('hex');
  }
  const tracked=execFileSync('git',['ls-files','src','public','scripts','supabase','sw.js'],{cwd:root,encoding:'utf8',windowsHide:true}).trim().split(/\r?\n/);
  for(const file of tracked) if(/\.(?:mjs|cjs|js|ts|html)$/.test(file)) {
    const text=await readFile(`${root}/${file}`,'utf8');
    assert.ok(!/(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)['"][^'"\r\n]*n44-push\/postgres-repository/.test(text),`inactive ${file}`);
  }
  report.checks.push({name:'n44_real_postgres_repository_executes_existing_registration_delivery_boundaries',status:'PASS',evidence:'Actual unchanged boundaries + injected new SQL repository; registration/replay/owner/context/budgets/rollback/commit qualification in named cases. Synthetic non-superuser/NOBYPASSRLS role only; no hosted Auth.'});
}
export async function afterRestart({a,report,pool}) {
  const r=createPostgresRepository(port(pool(),A));
  const f=boundaries(r),before=callbacks,e=report.restartEvent;
  const registration=await r.atomic(A,tx=>tx.get('registrations',report.restartRegistration));
  assert.equal(registration.state,'active');
  assert.deepEqual((await a.query(`select budget_key,bucket::text,count,expires_at_ms::text from ${S}.budgets where owner_id=$1 order by budget_key`,[A])).rows,report.restartBudget);
  await status(f.deliver(e),'duplicate');assert.equal(callbacks,before);
  now+=31_000;await status(f.delivery.cleanup(A),'cleaned');
  assert.equal(await r.atomic(A,tx=>tx.get('deliveries',deliveryKey('workspace','device',e.id)).state),'uncertain');
  await status(f.deliver(e),'duplicate');assert.equal(callbacks,before);
  await status(f.revoke(),'revoked');await status(f.revoke(),'revoked');await status(f.register(),'rejected');
  const tomb=await r.atomic(A,tx=>tx.get('registrations',rid(1)));
  assert.equal(tomb.state,'revoked');assert.equal(tomb.sealed,null);assert.equal(tomb.fingerprint,null);assert.equal(tomb.bindingFingerprint,null);
  assert.equal((await a.query(`select count(*)::int as n from ${S}.endpoint_claims where owner_id=$1`,[A])).rows[0].n,0);
  const second=boundaries(r,A,2,1);await status(second.register(),'registered');
  await status(f.revoke(),'revoked');assert.equal(await r.atomic(A,tx=>tx.get('registrations',rid(2)).state),'active');
  // Cleanup actual delete methods with dependent context/registration still present.
  now+=33*86400_000;await status(f.delivery.cleanup(A),'cleaned');
  assert.equal(await r.atomic(A,tx=>tx.rows('registrations').length),0);
  assert.equal(await r.atomic(A,tx=>tx.rows('deliveries').length),0);
  assert.equal(await r.atomic(A,tx=>tx.entries('budgets').length),0);
  report.restart.evidence='New pools/repository retained registration, exact budgets and sending fence; same event no callback; cleanup sending→uncertain; revoke erased secrets/released endpoint; tombstone replay did not affect replacement; retention removed rows/budgets.';
  report.checks.push({name:'n44_two_repository_commit_fencing_current_context_budget_and_restart_guards',status:'PASS',evidence:`${report.cases.length} targeted cases PASS; ${report.lockObservations.length} SQL wait observations. ${report.restart.evidence} Controlled shutdown/restart, not crash/power-loss durability.`});
}
