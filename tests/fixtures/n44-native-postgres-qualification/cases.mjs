import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const rid = n => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const fp = n => n.toString(16).padStart(64, '0');
const S = 'n44_push_draft';
export async function qualify({ a, b, sql, report, root }) {
  const q = (text, values = []) => a.query(text, values);
  const scalar = async (text, values = []) => (await q(text, values)).rows[0];
  async function check(name, fn) {
    const entry = { name, status: 'RUNNING' }; report.checks.push(entry);
    try { entry.evidence = await fn(); entry.status = 'PASS'; }
    catch (e) { entry.status = 'FAIL'; entry.sqlstate = e.code ?? null; throw e; }
  }
  async function negative(client, text, values, code, label) {
    await client.query('savepoint negative');
    let actual;
    try { await client.query(text, values); } catch (e) { actual = e.code; }
    await client.query('rollback to savepoint negative');
    await client.query('release savepoint negative');
    report.negativeSqlstates.push({ label, expected: code, actual: actual ?? 'NO_ERROR' });
    assert.equal(actual, code, label);
  }
  async function rollback(fn) {
    await q('begin');
    try { return await fn(); } finally { await q('rollback'); }
  }
  async function context(c, owner, workspace, device = 'device') {
    await c.query(`insert into ${S}.contexts values ($1,$2,$3,true,'session','revision',9000000000000,'consent',true,'{}')`, [owner, workspace, device]);
  }
  async function registration(c, owner, workspace, n, fingerprint = n, device = 'device') {
    await c.query(`insert into ${S}.registrations values ($1,$2,$3,$4,'session','revision','consent','active',9000000000000,'SYNTHETIC-SEALED-NOT-CRYPTO',$5,$6)`, [owner, rid(n), workspace, device, fp(fingerprint), fp(999)]);
  }
  async function delivery(c, event, state = 'sending', attempts = 1, n = 1) {
    await c.query(`insert into ${S}.deliveries values ($1,'reserve','device',$2,$3,'lesson','/teaching/synthetic',9000000000000,$4,$5,1000,1000)`, [A, event, rid(n), attempts, state]);
  }
  // Only this freshly initialized cluster contains these synthetic Auth stubs.
  await q(`create role anon nologin nosuperuser nobypassrls;
    create role authenticated nologin nosuperuser nobypassrls;
    create role n44_public_probe nologin nosuperuser nobypassrls;
    create role n44_rls_probe nologin nosuperuser nobypassrls inherit;
    grant authenticated to n44_rls_probe;
    create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable security invoker
      set search_path='' as $$ select nullif(current_setting('n44.fixture_uid',true),'')::uuid $$;
    revoke all on schema auth from public;
    revoke all on function auth.uid() from public;`);
  await q('insert into auth.users values ($1),($2)', [A, B]);
  await check('actual_schema_apply_catalog_and_ddl_rollback', async () => {
    // Deliberate missing-role DDL failure inside the proposal's BEGIN must roll
    // back its schema/tables, not leave a partial installation.
    await q('alter role authenticated rename to n44_missing_auth');
    let code;
    try { await q(sql); } catch (e) { code = e.code; }
    await q('rollback');
    assert.equal(code, '42704');
    assert.equal((await scalar("select to_regnamespace('n44_push_draft') as ns")).ns, null);
    await q('alter role n44_missing_auth rename to authenticated');
    await q(sql);
    const tables = (await q(`select relname,relrowsecurity,relforcerowsecurity from pg_class where relnamespace='${S}'::regnamespace and relkind='r' order by relname`)).rows;
    assert.equal(tables.length, 6); assert.ok(tables.every(r => r.relrowsecurity && r.relforcerowsecurity));
    const policies = (await scalar(`select count(*)::int as n from pg_policy where polrelid in (select oid from pg_class where relnamespace='${S}'::regnamespace)`)).n;
    assert.equal(policies, 24);
    const triggers = (await q(`select p.proname,p.prosecdef,p.proconfig from pg_proc p where pronamespace='${S}'::regnamespace order by proname`)).rows;
    assert.equal(triggers.length, 2); assert.ok(triggers.every(r => !r.prosecdef && r.proconfig.includes('search_path=""')));
    const indexes = (await q(`select indexname,indexdef from pg_indexes where schemaname=$1 order by indexname`, [S])).rows;
    for (const name of ['one_active_context','retry_due','delivery_retention','registration_expiry','endpoint_owner']) assert.ok(indexes.some(r => r.indexname === name));
    assert.match(indexes.find(r => r.indexname === 'one_active_context').indexdef, /WHERE.*state.*active/);
    assert.match(indexes.find(r => r.indexname === 'retry_due').indexdef, /owner_id, next_at_ms.*WHERE.*retry/);
    const constraints = (await q(`select c.conname,c.contype,pg_get_constraintdef(c.oid) as definition from pg_constraint c join pg_class t on t.oid=c.conrelid where t.relnamespace='${S}'::regnamespace order by c.conname`)).rows;
    report.catalog = { tables, policies, triggers, indexes, constraints };
    return { tables: 6, forcedRls: 6, ownerPolicies: policies, invokerFunctions: 2, rollbackSqlstate: code, indexes: indexes.length, constraints: constraints.length };
  });
  await q(`insert into ${S}.owner_clock values ($1,0),($2,0)`, [A, B]);
  await context(a, A, 'reserve'); await registration(a, A, 'reserve', 1);

  await check('real_registration_and_delivery_constraints_and_triggers', () => rollback(async () => {
    await negative(a, `update ${S}.registrations set expires_at_ms=expires_at_ms+1 where owner_id=$1`, [A], 'P0001', 'registration immutable expiry');
    for (const field of ['registration_id','workspace_id','device_id','session_id','session_revision','consent_revision','sealed','fingerprint','binding_fingerprint']) {
      const value = field === 'registration_id' ? rid(999) : field.endsWith('fingerprint') ? fp(888) : 'changed';
      await negative(a, `update ${S}.registrations set ${field}=$2 where owner_id=$1`, [A,value], 'P0001', `registration immutable ${field}`);
    }
    await negative(a, `insert into ${S}.registrations select owner_id,$1,workspace_id,device_id,session_id,session_revision,consent_revision,state,expires_at_ms,sealed,fingerprint,binding_fingerprint from ${S}.registrations where owner_id=$2`, [rid(2), A], '23505', 'one active context unique index');
    await negative(a, `update ${S}.registrations set state='revoked' where owner_id=$1`, [A], '23514', 'revoked secret must be null');
    await q(`update ${S}.registrations set state='revoked',sealed=null,fingerprint=null,binding_fingerprint=null where owner_id=$1`, [A]);
    await negative(a, `update ${S}.registrations set state='active',sealed='fake',fingerprint=$2,binding_fingerprint=$2 where owner_id=$1`, [A,fp(1)], 'P0001', 'revoked tombstone cannot reactivate');
    await delivery(a, 'immutable');
    for (const [field,value] of [['expires_at_ms',9000000000001],['action_path','/changed'],['registration_id',rid(2)],['event_id','new'],['kind','due'],['workspace_id','new'],['device_id','new'],['owner_id',B]]) {
      await negative(a, `update ${S}.deliveries set ${field}=$1 where event_id='immutable'`, [value], 'P0001', `delivery immutable ${field}`);
    }
    await negative(a, `update ${S}.deliveries set attempts=2 where event_id='immutable'`, [], 'P0001', 'sending cannot increment attempts');
    for (const [event,attempt,state] of [['negative-attempt',-1,'suppressed'],['four-attempts',4,'sending'],['zero-sending',0,'sending']]) {
      await negative(a, `insert into ${S}.deliveries values ($1,'reserve','device',$2,$3,'lesson','/synthetic',9000000000000,$4,$5,1000,1000)`, [A,event,rid(1),attempt,state], '23514', event);
    }
    await delivery(a, 'zero-suppressed', 'suppressed', 0);
    await negative(a, `update ${S}.deliveries set state='sending',attempts=1 where event_id='zero-suppressed'`, [], 'P0001', 'suppressed terminal cannot restart');
    await q(`update ${S}.deliveries set state='retry',next_at_ms=61000 where event_id='immutable'`);
    // Concrete trigger defect probes: retries must consume exactly one attempt,
    // and a terminal attempt 3 may never re-enter retry.
    await negative(a, `update ${S}.deliveries set state='sending' where event_id='immutable'`, [], 'P0001', 'retry to sending requires attempt increment');
    await q(`update ${S}.deliveries set state='sending',attempts=2,started_at_ms=61000 where event_id='immutable'`);
    await q(`update ${S}.deliveries set state='retry',next_at_ms=181000 where event_id='immutable'`);
    await q(`update ${S}.deliveries set state='sending',attempts=3,started_at_ms=181000 where event_id='immutable'`);
    await negative(a, `update ${S}.deliveries set state='retry' where event_id='immutable'`, [], 'P0001', 'third attempt cannot re-enter retry');
    await q(`update ${S}.deliveries set state='sent' where event_id='immutable'`);
    for (const state of ['sent','uncertain','suppressed','dead']) {
      await delivery(a, `terminal-${state}`, state);
      await negative(a, `update ${S}.deliveries set next_at_ms=next_at_ms+1 where event_id=$1`, [`terminal-${state}`], 'P0001', `${state} immutable terminal`);
    }
    return { immutableRegistrationFields: 10, immutableDeliveryFields: 8, attempts: '0 suppressed / 1→2→3 fenced', terminalStates: 4 };
  }));

  await check('no_public_anon_authenticated_schema_table_function_privileges', async () => {
    const tables = report.catalog.tables.map(t => t.relname);
    for (const role of ['n44_public_probe','anon','authenticated']) await rollback(async () => {
      const privileges = (await q(`select has_schema_privilege($1,$2,'USAGE') as usage,
        has_function_privilege($1,'${S}.immutable_delivery()','EXECUTE') as delivery,
        has_function_privilege($1,'${S}.immutable_registration()','EXECUTE') as registration`, [role,S])).rows[0];
      assert.deepEqual(privileges, { usage:false, delivery:false, registration:false });
      for (const table of tables) for (const operation of ['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'])
        assert.equal((await scalar('select has_table_privilege($1,$2,$3) as p', [role,`${S}.${table}`,operation])).p, false);
      await q(`set local role ${role}`); await q("select set_config('n44.fixture_uid',$1,true)", [A]);
      for (const table of tables) await negative(a, `select * from ${S}.${table}`, [], '42501', `${role} private ${table} denied despite fabricated owner claim`);
      for (const fn of ['immutable_registration','immutable_delivery']) await negative(a, `select ${S}.${fn}()`, [], '42501', `${role} private function denied`);
    });
    const acl = (await q(`select p.proname,x.grantee,x.privilege_type from pg_proc p cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) x where pronamespace='${S}'::regnamespace`)).rows;
    assert.ok(acl.every(r => r.grantee !== 0));
    return { roles: 3, tables: 6, forbiddenTablePrivileges: 126, functionPublicExecute: false, sqlstate: '42501', note: 'grant proof, separate from RLS proof' };
  });

  await check('temporary_nonbypass_owner_rls_select_insert_update_reassign_delete', () => rollback(async () => {
    await q(`grant usage on schema ${S},auth to n44_rls_probe;
      grant execute on function auth.uid() to n44_rls_probe;
      grant select,insert,update,delete on all tables in schema ${S} to n44_rls_probe;`);
    await context(a, A, 'rls'); await context(a, B, 'rls');
    await registration(a, A, 'rls', 100); await registration(a, B, 'rls', 101);
    await q(`insert into ${S}.endpoint_claims values ($1,$2,$3),($4,$5,$6)`, [fp(100),A,rid(100),fp(101),B,rid(101)]);
    await q(`insert into ${S}.budgets values ($1,'rls',0,1,9999999999999),($2,'rls',0,1,9999999999999)`, [A,B]);
    for (const owner of [A,B]) await q(`insert into ${S}.deliveries values ($1,'rls','device','rls',$2,'lesson','/synthetic',9000000000000,1,'sending',1000,1000)`, [owner,rid(owner===A?100:101)]);
    await q('set local role n44_rls_probe');
    const role = await scalar('select current_user as role,rolsuper,rolbypassrls from pg_roles where rolname=current_user');
    assert.equal(role.role,'n44_rls_probe'); assert.equal(role.rolsuper,false); assert.equal(role.rolbypassrls,false);
    assert.equal((await scalar(`select count(*)::int as n from pg_class where relnamespace='${S}'::regnamespace and relowner=(select oid from pg_roles where rolname=current_user)`)).n,0);
    for (const owner of [A,B]) {
      await q("select set_config('n44.fixture_uid',$1,true)", [owner]);
      for (const { relname: table } of report.catalog.tables) {
        const visible = (await q(`select owner_id from ${S}.${table}`)).rows;
        assert.ok(visible.length > 0); assert.ok(visible.every(r=>r.owner_id===owner));
        assert.equal((await q(`update ${S}.${table} set owner_id=owner_id where owner_id<>$1`,[owner])).rowCount,0);
        assert.equal((await q(`delete from ${S}.${table} where owner_id<>$1`,[owner])).rowCount,0);
        assert.ok((await q(`update ${S}.${table} set owner_id=owner_id where owner_id=$1`,[owner])).rowCount>0);
      }
    }
    await q("select set_config('n44.fixture_uid',$1,true)",[A]);
    const rows = {
      owner_clock: { owner_id:A,high_water_ms:0 },
      contexts: { owner_id:A,workspace_id:'insert-rls',device_id:'device',active:true,session_id:'s',session_revision:'r',session_expires_at_ms:9000000000000,consent_revision:'c',push_consent:true,preferences:{} },
      registrations: { owner_id:A,registration_id:rid(102),workspace_id:'insert-rls',device_id:'device',session_id:'s',session_revision:'r',consent_revision:'c',state:'active',expires_at_ms:9000000000000,sealed:'fake',fingerprint:fp(102),binding_fingerprint:fp(999) },
      endpoint_claims: { fingerprint:fp(102),owner_id:A,registration_id:rid(102) },
      deliveries: { owner_id:A,workspace_id:'insert-rls',device_id:'device',event_id:'insert-rls',registration_id:rid(102),kind:'lesson',action_path:'/synthetic',expires_at_ms:9000000000000,attempts:1,state:'sending',started_at_ms:1000,next_at_ms:1000 },
      budgets: { owner_id:A,budget_key:'insert-rls',bucket:0,count:1,expires_at_ms:9000000000000 },
    };
    await q(`delete from ${S}.owner_clock where owner_id=$1`,[A]);
    for (const [table,row] of Object.entries(rows)) {
      const insert = `insert into ${S}.${table} select * from json_populate_record(null::${S}.${table},$1)`;
      await negative(a,insert,[JSON.stringify({...row,owner_id:B})],'42501',`${table} foreign INSERT WITH CHECK`);
      assert.equal((await q(insert,[JSON.stringify(row)])).rowCount,1);
      const triggerBound = ['registrations','deliveries'].includes(table);
      await negative(a,`update ${S}.${table} set owner_id=$1 where owner_id=$2`,[B,A],triggerBound?'P0001':'42501',`${table} owner reassignment ${triggerBound?'immutable trigger':'RLS WITH CHECK'}`);
    }
    // Delete dependents first; positive deletes execute as the non-owner role.
    for (const table of ['endpoint_claims','deliveries','registrations','contexts','budgets','owner_clock'])
      assert.ok((await q(`delete from ${S}.${table} where owner_id=$1`,[A])).rowCount>0);
    await q("select set_config('n44.fixture_uid','',true)");
    for (const {relname:table} of report.catalog.tables) assert.equal((await q(`select * from ${S}.${table}`)).rowCount,0);
    return { role, tables:6, owners:2, positiveCrud:true, foreignCrudDenied:true, missingUidSeesZero:true, grants:'fixture transaction only; rolled back' };
  }));
  assert.equal((await scalar(`select has_schema_privilege('n44_rls_probe',$1,'USAGE') as p`,[S])).p,false);

  // A real second backend must be observed waiting on the first, not merely
  // scheduled concurrently by JS. The observer is the lock-holding connection.
  async function blocked(first, second, statement, values, settle) {
    const secondPid = (await second.query('select pg_backend_pid() as pid')).rows[0].pid;
    let done = false;
    const pending = second.query(statement,values).then(value=>{done=true;return {value};},error=>{done=true;return {error};});
    let waiting;
    const until = Date.now()+1800;
    while(Date.now()<until && !done) {
      const r=(await first.query('select pg_blocking_pids($1) as blockers,wait_event_type,wait_event from pg_stat_activity where pid=$1',[secondPid])).rows[0];
      if(r?.blockers.includes(report.connections[0]) && r.wait_event_type==='Lock') { waiting=r; break; }
      await new Promise(resolve=>setTimeout(resolve,25));
    }
    assert.ok(waiting,'independent backend visibly blocked by first backend');
    report.blocking ??=[]; report.blocking.push(waiting);
    await settle();
    const result=await pending;
    return result;
  }
  await check('two_connection_active_context_and_global_endpoint_claim_races', async()=>{
    await context(a,A,'race-context');
    await q('begin'); await b.query('begin');
    try {
      await registration(a,A,'race-context',10);
      const result=await blocked(a,b,`insert into ${S}.registrations select owner_id,$1,workspace_id,device_id,session_id,session_revision,consent_revision,'active',session_expires_at_ms,'fake',$2,$2 from ${S}.contexts where owner_id=$3 and workspace_id='race-context'`,[rid(11),fp(11),A],()=>q('commit'));
      assert.equal(result.error?.code,'23505'); await b.query('rollback');
      report.negativeSqlstates.push({label:'concurrent active context',expected:'23505',actual:result.error.code});
    } finally { await q('rollback');await b.query('rollback'); }
    await context(a,A,'global');await context(a,B,'global');
    await q('begin');await b.query('begin');
    try {
      await registration(a,A,'global',20,200);await registration(b,B,'global',21,200);
      await q(`insert into ${S}.endpoint_claims values ($1,$2,$3)`,[fp(200),A,rid(20)]);
      const result=await blocked(a,b,`insert into ${S}.endpoint_claims values ($1,$2,$3)`,[fp(200),B,rid(21)],()=>q('commit'));
      assert.equal(result.error?.code,'23505');await b.query('rollback');
      assert.equal((await scalar(`select count(*)::int as n from ${S}.registrations where owner_id=$1 and registration_id=$2`,[B,rid(21)])).n,0);
      report.negativeSqlstates.push({label:'concurrent global endpoint',expected:'23505',actual:result.error.code});
      assert.equal((await q(`delete from ${S}.endpoint_claims where fingerprint=$1 and owner_id=$2 and registration_id=$3`,[fp(200),B,rid(20)])).rowCount,0);
      assert.equal((await q(`delete from ${S}.endpoint_claims where fingerprint=$1 and owner_id=$2 and registration_id=$3`,[fp(200),A,rid(21)])).rowCount,0);
      await context(a,A,'rollback');
      await q('begin');await registration(a,A,'rollback',22,201);
      await q(`insert into ${S}.endpoint_claims values ($1,$2,$3)`,[fp(201),A,rid(22)]);await q('rollback');
      assert.equal((await scalar(`select count(*)::int as n from ${S}.endpoint_claims where fingerprint=$1`,[fp(201)])).n,0);
      assert.equal((await scalar(`select count(*)::int as n from ${S}.registrations where registration_id=$1`,[rid(22)])).n,0);
      assert.equal((await scalar(`select count(*)::int as n from ${S}.endpoint_claims where fingerprint=$1 and owner_id=$2 and registration_id=$3`,[fp(200),A,rid(20)])).n,1);
    } finally { await q('rollback');await b.query('rollback'); }
    return { uniqueRaces:2, sqlstate:'23505', foreignRelease:0, rollbackPreservesOriginal:true, databaseBlockingObserved:true };
  });

  async function ownerLock(c, owner=A) {
    await c.query(`insert into ${S}.owner_clock values ($1,0) on conflict do nothing`,[owner]);
    const row=(await c.query(`select high_water_ms from ${S}.owner_clock where owner_id=$1 for update`,[owner])).rows[0];
    return row;
  }
  async function reserve(c,event,callback,abort=false) {
    await c.query('begin');let permit;
    try {
      await ownerLock(c);
      // Test-only explicit SQL, NOT repository.atomic or authoritative resolver.
      permit=await insertEligible(c,A,rid(1),event);
      if(abort) throw new Error('fabricated rollback');
      await c.query('commit');
    } catch(e) { await c.query('rollback'); if(abort)return false;throw e; }
    if(permit.rowCount) await callback(event); // Local recorded callback only.
    return permit.rowCount===1;
  }
  async function insertEligible(c,owner,registrationId,event) {
    return c.query(`insert into ${S}.deliveries
      select r.owner_id,r.workspace_id,r.device_id,$3,r.registration_id,'lesson','/synthetic',9000000000000,1,'sending',1000,1000
      from ${S}.registrations r join ${S}.contexts x using(owner_id,workspace_id,device_id)
      where r.owner_id=$1 and r.registration_id=$2 and r.state='active' and x.active and x.push_consent
      and x.session_id=r.session_id and x.session_revision=r.session_revision and x.consent_revision=r.consent_revision
      and r.expires_at_ms>(extract(epoch from clock_timestamp())*1000)::bigint
      and x.session_expires_at_ms>(extract(epoch from clock_timestamp())*1000)::bigint
      on conflict do nothing returning event_id`,[owner,registrationId,event]);
  }
  await check('twenty_first_reservations_two_backends_commit_fence_crash_and_pk',async()=>{
    await q('begin');await ownerLock(a);await b.query('begin');
    try {
      const result=await blocked(a,b,`select high_water_ms from ${S}.owner_clock where owner_id=$1 for update`,[A],()=>q('commit'));
      assert.ok(result.value);await b.query('rollback');
    }finally{await q('rollback');await b.query('rollback');}
    const callbacks=[];
    const callback=async event=>{
      // Other backend observes reservation only after COMMIT.
      const observer=await (event==='reserved-once'?b:a).query(`select state from ${S}.deliveries where owner_id=$1 and event_id=$2`,[A,event]);
      assert.equal(observer.rows[0]?.state,'sending');callbacks.push(event);
    };
    // Each connection has its own sequential command stream; both streams race
    // on real DB locks. There is no shared JS mutex or memory repository.
    let sent=0;
    await Promise.all([a,b].map(async(c,index)=>{
      for(let i=0;i<10;i++) if(await reserve(c,'reserved-once',async event=>{
        // Independent read on the same committed connection avoids queuing an
        // observer query inside the other connection's concurrently open tx.
        assert.equal((await c.query(`select state from ${S}.deliveries where owner_id=$1 and event_id=$2`,[A,event])).rows[0].state,'sending');
        callbacks.push(event);sent++;
      })) assert.ok(index===0||index===1);
    }));
    assert.equal(sent,1);assert.equal(callbacks.length,1);
    await reserve(a,'rolled-back-permit',callback,true);assert.equal(callbacks.length,1);
    assert.equal((await scalar(`select count(*)::int as n from ${S}.deliveries where event_id='rolled-back-permit'`)).n,0);
    await reserve(a,'crash-before-send',async()=>{}); // committed; process dies before callback
    await reserve(a,'crash-before-send',callback);assert.equal(callbacks.length,1);
    await reserve(a,'crash-after-send',callback);assert.equal(callbacks.length,2);
    await q(`update ${S}.deliveries set state='uncertain' where event_id in ('crash-before-send','crash-after-send') and state='sending'`);
    await reserve(b,'crash-after-send',callback);assert.equal(callbacks.length,2);
    await rollback(async()=>{
      await negative(a,`update ${S}.deliveries set state='sending',attempts=attempts+1 where event_id='crash-after-send'`,[],'P0001','uncertain cannot restart side effect');
      await negative(a,`insert into ${S}.deliveries select * from ${S}.deliveries where event_id='reserved-once'`,[],'23505','delivery four-column durable PK');
    });
    return { independentBackends:report.connections, concurrentStreams:2,reservations:20,committedPermits:1,initialLocalCallbacks:1,totalLocalCallbacks:2,externalSends:0,rollbackCallback:0,crashReplayCallbacks:0 };
  });
  await check('owner_clock_monotonic_and_bounded_budget_upserts',async()=>{
    async function debit(c,observed) {
      await c.query('begin');
      try {
        await ownerLock(c);
        const time=(await c.query(`update ${S}.owner_clock set high_water_ms=greatest(high_water_ms,$2,(extract(epoch from clock_timestamp())*1000)::bigint) where owner_id=$1 returning high_water_ms`,[A,observed])).rows[0].high_water_ms;
        const result=await c.query(`insert into ${S}.budgets values ($1,'bounded-hour',1,1,9000000000000)
          on conflict(owner_id,budget_key) do update set count=case when ${S}.budgets.bucket=excluded.bucket then ${S}.budgets.count+1 else 1 end,bucket=excluded.bucket
          where ${S}.budgets.bucket<>excluded.bucket or ${S}.budgets.count<6 returning count`,[A]);
        await c.query('commit');return {time:Number(time),accepted:result.rowCount===1};
      }catch(e){await c.query('rollback');throw e;}
    }
    const times=[],outcomes=[];
    await Promise.all([a,b].map(async(c,index)=>{for(let i=0;i<6;i++){const r=await debit(c,index?0:Date.now());times.push(r.time);outcomes.push(r.accepted);}}));
    assert.equal(outcomes.filter(Boolean).length,6);
    assert.equal((await scalar(`select count from ${S}.budgets where owner_id=$1 and budget_key='bounded-hour'`,[A])).count,6);
    const before=Number((await scalar(`select high_water_ms from ${S}.owner_clock where owner_id=$1`,[A])).high_water_ms);
    assert.ok((await debit(b,0)).time>=before);
    await rollback(async()=>{
      await negative(a,`update ${S}.budgets set count=41 where owner_id=$1`,[A],'23514','budget hard max40');
      await negative(a,`update ${S}.budgets set count=0 where owner_id=$1`,[A],'23514','budget minimum1');
      await q(`update ${S}.budgets set bucket=0,count=6 where owner_id=$1`,[A]);
      await q(`insert into ${S}.budgets values ($1,'bounded-hour',1,1,9000000000000) on conflict(owner_id,budget_key) do update set bucket=excluded.bucket,count=1`,[A]);
      assert.equal((await scalar(`select count from ${S}.budgets where owner_id=$1 and budget_key='bounded-hour'`,[A])).count,1);
    });
    return { concurrentDebits:12,accepted:6,limit:6,databaseTimeAndPersistedMaximum:true,oldClockCannotDecrease:true,bucketRollover:1,sqlstate:'23514' };
  });
  await check('original_revoke_secret_erasure_tombstone_new_registration_preserved',()=>rollback(async()=>{
    await context(a,A,'revoke');await registration(a,A,'revoke',30,300);
    await q(`insert into ${S}.endpoint_claims values ($1,$2,$3)`,[fp(300),A,rid(30)]);
    async function revoke(owner,n,session='session') {
      await ownerLock(a,owner);
      const original=(await q(`select * from ${S}.registrations where owner_id=$1 and registration_id=$2 and session_id=$3 and session_revision='revision' for update`,[owner,rid(n),session])).rows[0];
      if(!original || original.state!=='active')return 0;
      await q(`delete from ${S}.endpoint_claims where owner_id=$1 and registration_id=$2 and fingerprint=$3`,[owner,rid(n),original.fingerprint]);
      return (await q(`update ${S}.registrations set state='revoked',sealed=null,fingerprint=null,binding_fingerprint=null where owner_id=$1 and registration_id=$2`,[owner,rid(n)])).rowCount;
    }
    assert.equal(await revoke(B,30),0);assert.equal(await revoke(A,30,'new-session'),0);assert.equal(await revoke(A,30),1);
    await registration(a,A,'revoke',31,301);await q(`insert into ${S}.endpoint_claims values ($1,$2,$3)`,[fp(301),A,rid(31)]);
    assert.equal(await revoke(A,30),0);
    assert.equal((await scalar(`select state from ${S}.registrations where registration_id=$1`,[rid(31)])).state,'active');
    const original=await scalar(`select state,sealed,fingerprint,binding_fingerprint from ${S}.registrations where registration_id=$1`,[rid(30)]);
    assert.deepEqual(original,{state:'revoked',sealed:null,fingerprint:null,binding_fingerprint:null});
    await q(`update ${S}.registrations set state='dead',sealed=null,fingerprint=null,binding_fingerprint=null where registration_id=$1`,[rid(31)]);
    await negative(a,`update ${S}.registrations set sealed='resurrect' where registration_id=$1`,[rid(31)],'P0001','dead registration immutable');
    return { originalOnly:true,foreignOwnerAndSessionNoop:true,allSecretsNull:true,tombstoneReplayPreservesNewRegistration:true };
  }));
  await check('committed_revocation_and_context_switch_serialize_before_reservation',async()=>{
    for(const [index,change] of ['revoke','context-switch'].entries()) {
      const n=40+index,workspace=`serialize-${change}`;
      await context(a,A,workspace);await registration(a,A,workspace,n);
      await q('begin');await b.query('begin');
      try {
        await ownerLock(a);
        if(change==='revoke') await q(`update ${S}.registrations set state='revoked',sealed=null,fingerprint=null,binding_fingerprint=null where owner_id=$1 and registration_id=$2`,[A,rid(n)]);
        else await q(`update ${S}.contexts set session_revision='new-revision' where owner_id=$1 and workspace_id=$2`,[A,workspace]);
        const wait=await blocked(a,b,`select high_water_ms from ${S}.owner_clock where owner_id=$1 for update`,[A],()=>q('commit'));
        assert.ok(wait.value);
        const permit=await insertEligible(b,A,rid(n),`blocked-${change}`);
        assert.equal(permit.rowCount,0);await b.query('commit');
      }finally{await q('rollback');await b.query('rollback');}
    }
    return { committedRevocationBlocksLaterPermit:true,committedContextRevisionBlocksLaterPermit:true,realLockWaits:2,localCallbacks:0 };
  });
  await check('inactive_source_bindings_and_reused_mock_evidence',async()=>{
    const unchanged=['drafts/n44-push/registration.mjs','drafts/n44-push/delivery.mjs','drafts/n44-push/shared.mjs','tests/n44-server-preactivation.test.mjs','tests/fixtures/n44-server-preactivation/fakes.mjs','src/lib/notification-push-core.js','src/lib/notification-state.js','src/lib/notification-center.js'];
    const hashes={};
    for(const file of unchanged){
      const current=await readFile(`${root}/${file}`);
      const old=execFileSync('git',['show',`${report.baseSha}:${file}`],{cwd:root,maxBuffer:1024*1024});
      assert.ok(current.equals(old),`${file} must retain prior 16-test evidence binding`);
      hashes[file]=createHash('sha256').update(current).digest('hex');
    }
    let bindings='';
    try { bindings=execFileSync('git',['grep','-n','n44-push','--','src','public','sw.js','scripts','supabase'],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']}); }
    catch(e) { if(e.status!==1)throw e; }
    const imports=bindings.split('\n').filter(line=>/\b(?:from\s*|import\s*\(?\s*|require\s*\(\s*)['"][^'"]*n44-push/.test(line));
    assert.deepEqual(imports,[]); // Ops cards/source-only tests may name the path.
    return { unchangedSha256:hashes,priorEvidence:'docs/automation-evidence/20261017/N44_SERVER_PREACTIVATION_PACKAGE.md: 16/16 simulated tests PASS, reused not rerun',appServiceBindings:0 };
  });
}
