import assert from 'node:assert/strict';
import { randomBytes, randomUUID, createHmac, createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { transaction, lockScope, login, loginLocked, read, revokeLocked, attempt } from './protocol.mjs';
const S='n88_private';
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const NA='n88_A_synthetic_namespace_000001', NB='n88_B_synthetic_namespace_000001';
const id=n=>`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const key=randomBytes(32); // In-memory ONLY, never written or printed.
const digest=(domain,...parts)=>createHmac('sha256',key).update(JSON.stringify(['n88-v2',domain,...parts])).digest('hex');
const token=n=>createHash('sha256').update(`SYNTHETIC-session-${n}`).digest('hex');
const credential=(n,extra={})=>({id:id(n),namespace:NA,owner_id:A,student_id:`student-${n}`,version:1,
  verifier:digest('code',NA,'1000'),entry_verifier:digest('entry',randomBytes(32).toString('base64url')),revoked_at:null,...extra});
const member=(c,extra={})=>({owner_id:c.owner_id,class_id:'term-1',student_id:c.student_id,enrollment_id:`enrollment-${c.student_id}-1`,revision:1,active:true,...extra});
const session=(n,c,m,extra={})=>({id:id(n),credential_id:c.id,namespace:c.namespace,owner_id:c.owner_id,
  class_id:m.class_id,student_id:c.student_id,enrollment_id:m.enrollment_id,version:c.version,
  membership_revision:m.revision,entry_verifier:c.entry_verifier,token_hash:token(n),
  expires_at:new Date(Date.now()+8*3600000).toISOString(),revoked_at:null,...extra});
const publication=(n,m,extra={})=>({id:id(n),owner_id:m.owner_id,class_id:m.class_id,student_id:m.student_id,
  enrollment_id:m.enrollment_id,source_teaching_id:'fabricated-teaching',source_item_id:`fabricated-${n}`,
  title:`Synthetic task ${n}`,instruction:'Fabricated only',deadline:null,status:'todo',published:true,...extra});

export async function qualify({a,b,sql,report}) {
  const q=(text,values=[])=>a.query(text,values);
  const row=async(text,values=[])=>(await q(text,values)).rows[0];
  const insert=(c,table,value)=>c.query(`insert into ${S}.${table} select * from json_populate_record(null::${S}.${table},$1)`,[JSON.stringify(value)]);
  async function check(name,fn){
    const item={name,status:'RUNNING'}; report.checks.push(item);
    try{item.evidence=await fn();item.status='PASS';}catch(e){item.status='FAIL';item.sqlstate=e.code??null;throw e;}
  }
  async function rollback(fn){await q('begin');try{return await fn();}finally{await q('rollback');}}
  async function negative(c,text,values,code,label){
    await c.query('savepoint negative');let actual;
    try{await c.query(text,values);}catch(e){actual=e.code;}
    await c.query('rollback to savepoint negative');await c.query('release savepoint negative');
    report.negativeSqlstates.push({label,expected:code,actual:actual??'NO_ERROR'});assert.equal(actual,code,label);
  }
  const negativeInsert=(table,value,code,label)=>negative(a,`insert into ${S}.${table} select * from json_populate_record(null::${S}.${table},$1)`,[JSON.stringify(value)],code,label);
  async function blocked(statement,values,settle,label){
    let done=false;
    const pending=b.query(statement,values).then(value=>{done=true;return{value};},error=>{done=true;return{error};});
    let observed;
    try{
      const until=Date.now()+1800;
      while(Date.now()<until&&!done){
        const r=await row('select pg_blocking_pids($1) as blockers,wait_event_type,wait_event from pg_stat_activity where pid=$1',[report.connections[1]]);
        if(r?.blockers.includes(report.connections[0])&&r.wait_event_type==='Lock'){observed=r;break;}
        await new Promise(resolve=>setTimeout(resolve,25));
      }
      assert.ok(observed,`actual independent SQL lock wait: ${label}`);
      report.blocking??=[];report.blocking.push({label,...observed});
      await settle();return await pending;
    }finally{
      // Release the first transaction even if the observation/assertion fails;
      // pending then settles within the SQL/client deadlines, never abandoned.
      if(!done){await q('rollback');await pending;}
    }
  }
  await check('actual_draft_transaction_rollback_catalog_pk_fk_unique_checks_indexes_rls',async()=>{
    await q('begin');await q(sql);await q('rollback');
    assert.equal((await row("select to_regnamespace('n88_private') as ns")).ns,null);
    await transaction(a,()=>q(sql));
    const tables=(await q(`select relname,relrowsecurity,relforcerowsecurity from pg_class where relnamespace='${S}'::regnamespace and relkind='r' order by relname`)).rows;
    assert.deepEqual(tables.map(t=>t.relname),['contexts','credentials','guess_budgets','memberships','publications','sessions']);
    assert.ok(tables.every(t=>t.relrowsecurity&&!t.relforcerowsecurity));
    const constraints=(await q(`select t.relname,c.conname,c.contype,pg_get_constraintdef(c.oid) as definition
      from pg_constraint c join pg_class t on t.oid=c.conrelid where t.relnamespace='${S}'::regnamespace order by t.relname,c.conname`)).rows;
    for(const table of tables)assert.equal(constraints.filter(c=>c.relname===table.relname&&c.contype==='p').length,1);
    assert.equal(constraints.filter(c=>c.contype==='f').length,4);
    const indexes=(await q('select indexname,indexdef from pg_indexes where schemaname=$1 order by indexname',[S])).rows;
    assert.match(indexes.find(i=>i.indexname==='n88_current_credential').indexdef,/UNIQUE.*owner_id, student_id.*WHERE \(revoked_at IS NULL\)/);
    for(const name of ['n88_session_credential','n88_session_retention','n88_published_student'])assert.ok(indexes.some(i=>i.indexname===name));
    const functions=(await row(`select count(*)::int as n from pg_proc where pronamespace='${S}'::regnamespace`)).n;
    const policies=(await row(`select count(*)::int as n from pg_policy where polrelid in(select oid from pg_class where relnamespace='${S}'::regnamespace)`)).n;
    assert.equal(functions,0);assert.equal(policies,0);
    report.catalog={tables,constraints,indexes,functions,policies};
    return{rollbackLeavesNoNamespace:true,tables:tables.length,primaryKeys:6,foreignKeys:4,constraints:constraints.length,indexes:indexes.length,rlsEnabled:6,forcedRls:0,policies,functions};
  });
  await q(`insert into ${S}.contexts values($1,$2,true),($3,$4,true)`,[NA,A,NB,B]);
  const stable=credential(1), old=member(stable), other=credential(2,{namespace:NB,owner_id:B,verifier:digest('code',NB,'1000')}), foreign=member(other,{class_id:'foreign-class'});
  await insert(a,'memberships',old);await insert(a,'memberships',foreign);
  await insert(a,'credentials',stable);await insert(a,'credentials',other);
  const oldSession=session(101,stable,old);await insert(a,'sessions',oldSession);
  await insert(a,'publications',publication(201,old));await insert(a,'publications',publication(202,foreign));
  await insert(a,'publications',publication(203,old,{published:false}));
  await check('actual_crossbinding_and_code_entry_session_uniqueness_constraints',()=>rollback(async()=>{
    await negative(a,`insert into ${S}.contexts values($1,$2,true)`,[NA,A],'23505','namespace PK');
    await negative(a,`insert into ${S}.contexts values($1,$2,true)`,['n88_duplicate_owner_namespace_00001',A],'23505','one namespace per owner');
    await negative(a,`insert into ${S}.contexts values($1,$2,true)`,['short',id(990)],'23514','namespace check');
    await negativeInsert('credentials',credential(3,{owner_id:B,verifier:digest('code',NA,'1002')}),'23503','credential namespace-owner crossbinding');
    await negativeInsert('credentials',credential(4,{student_id:stable.student_id,verifier:digest('code',NA,'9999')}),'23505','active owner-student uniqueness');
    await negativeInsert('credentials',credential(5),'23505','same namespace-PIN verifier collision');
    await q(`update ${S}.credentials set revoked_at=clock_timestamp() where id=$1`,[stable.id]);
    await negativeInsert('credentials',credential(6),'23505','namespace-PIN tombstone remains reserved');
    await negativeInsert('credentials',credential(7,{namespace:NB,owner_id:B,verifier:digest('code',NB,'9999'),entry_verifier:stable.entry_verifier}),'23505','global entry verifier including tombstone');
    // Artificial equal verifier bytes across namespaces are legal. Real HMACs of
    // the same PIN differ because their namespace is part of the keyed message.
    assert.notEqual(stable.verifier,other.verifier);
    await insert(a,'credentials',credential(8,{namespace:NB,owner_id:B,verifier:stable.verifier}));
    for(const [field,value] of Object.entries({namespace:NB,owner_id:B,credential_id:other.id,student_id:other.student_id,version:2,entry_verifier:other.entry_verifier,class_id:foreign.class_id,enrollment_id:foreign.enrollment_id})){
      await negativeInsert('sessions',session(110,stable,old,{[field]:value}),'23503',`session composite FK ${field}`);
    }
    await negativeInsert('sessions',session(111,other,foreign,{token_hash:oldSession.token_hash}),'23505','global session token hash');
    await negativeInsert('publications',publication(210,old,{owner_id:B}),'23503','publication foreign membership');
    for(const [table,value,label] of [
      ['memberships',member(stable,{class_id:'invalid-revision',revision:0}),'membership positive revision'],
      ['credentials',credential(20,{version:0,verifier:digest('code',NA,'9999')}),'credential positive version'],
      ['credentials',credential(21,{verifier:'raw-PIN-is-not-a-verifier'}),'HMAC verifier shape'],
      ['credentials',credential(22,{verifier:digest('code',NA,'9999'),entry_verifier:'raw-bookmark-is-not-a-verifier'}),'entry HMAC shape'],
      ['sessions',session(120,stable,old,{token_hash:'raw-token'}),'session hash shape'],
      ['publications',publication(220,old,{title:''}),'nonempty publication title'],
      ['publications',publication(221,old,{title:'x'.repeat(161)}),'publication title bound'],
      ['publications',publication(222,old,{instruction:'x'.repeat(501)}),'instruction bound'],
      ['publications',publication(223,old,{status:'private-grade'}),'publication status allowlist'],
      ['guess_budgets',{key:'synthetic-negative',count:-1,until_at:new Date().toISOString()},'nonnegative budget']
    ])await negativeInsert(table,value,'23514',label);
    // A losing sequence of collisions cannot overwrite the existing credential.
    for(let i=0;i<3;i++)await negativeInsert('credentials',credential(30+i),'23505',`bounded repeated collision ${i+1}`);
    assert.equal((await row(`select count(*)::int as n from ${S}.credentials where id=$1 and verifier=$2`,[stable.id,stable.verifier])).n,1);
    const columns=(await q('select table_name,column_name from information_schema.columns where table_schema=$1',[S])).rows;
    assert.ok(!columns.some(c=>/^(pin|code|entry_secret|bookmark|token|student_name)$/.test(c.column_name)));
    return{samePinAcrossOwnersNamespaceBound:true,equalVerifierBytesOnlyAcrossDifferentNamespaces:true,tombstonesReserved:true,rawCredentialColumns:0,collisionProbes:3,
      boundary:'SQL shape/unique/FK constraints; PIN length/generator, 128 draws and 9,000 exhaustion remain unchanged service/memory evidence, not SQL guards'};
  }));
  await check('private_public_only_anon_authenticated_nobypass_roles_denied_without_grants',async()=>{
    await q(`create role n88_public_probe nologin nosuperuser nobypassrls;
      create role anon nologin nosuperuser nobypassrls;
      create role authenticated nologin nosuperuser nobypassrls;`);
    const proofs=[];
    for(const role of ['n88_public_probe','anon','authenticated'])await rollback(async()=>{
      const privileges=await row(`select has_schema_privilege($1,$2,'USAGE') as usage,has_schema_privilege($1,$2,'CREATE') as create`,[role,S]);
      assert.deepEqual(privileges,{usage:false,create:false});
      for(const table of report.catalog.tables)for(const operation of ['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'])
        assert.equal((await row('select has_table_privilege($1,$2,$3) as p',[role,`${S}.${table.relname}`,operation])).p,false);
      await q(`set local role ${role}`);
      const identity=await row('select current_user as role,rolsuper,rolbypassrls from pg_roles where rolname=current_user');
      assert.equal(identity.rolsuper,false);assert.equal(identity.rolbypassrls,false);
      assert.equal((await row(`select count(*)::int as n from pg_class where relnamespace=$1::regnamespace and relowner=(select oid from pg_roles where rolname=current_user)`,[S])).n,0);
      for(const table of report.catalog.tables)await negative(a,`select * from ${S}.${table.relname}`,[],'42501',`${role} denied ${table.relname}`);
      proofs.push(identity);
    });
    report.privateRoles=proofs;
    return{roles:3,forbiddenTablePrivileges:126,schemaUsage:false,privateFunctions:0,negativeSelects:18,sqlstate:'42501',temporaryGrants:0,
      boundary:'effective ACL denial; ENABLE RLS with no policies, not positive owner RLS or real Auth proof'};
  });
  await check('two_real_backends_unique_reservation_wait_commit_23505_and_loser_rollback',async()=>{
    const winner=credential(40,{verifier:digest('code',NA,'9999')}), loser=credential(41,{verifier:winner.verifier});
    await q('begin');await b.query('begin');
    try{
      await insert(a,'credentials',winner);
      await insert(b,'memberships',member(loser));
      const result=await blocked(`insert into ${S}.credentials select * from json_populate_record(null::${S}.credentials,$1)`,[JSON.stringify(loser)],()=>q('commit'),'namespace + verifier reservation');
      assert.equal(result.error?.code,'23505');await b.query('rollback');
      report.negativeSqlstates.push({label:'real concurrent namespace verifier',expected:'23505',actual:result.error.code});
      assert.equal((await row(`select count(*)::int as n from ${S}.credentials where id=$1 and verifier=$2`,[winner.id,winner.verifier])).n,1);
      assert.equal((await row(`select count(*)::int as n from ${S}.credentials where id=$1`,[loser.id])).n,0);
      assert.equal((await row(`select count(*)::int as n from ${S}.memberships where student_id=$1`,[loser.student_id])).n,0);
      return{distinctBackendPids:report.connections,observedSqlLockWait:true,winnerCommits:1,loserSqlstate:'23505',loserPriorWritesRolledBack:true,winnerPreserved:true};
    }finally{await q('rollback');await b.query('rollback');}
  });
  const keys=[{key:digest('source','fabricated-source'),max:6},{key:digest('context',stable.entry_verifier),max:30},{key:'global',max:100},
    {key:digest('context-failure',stable.entry_verifier),max:60,failure:true},{key:'global-failure',max:500,failure:true}];
  await check('actual_sql_budget_sorted_locks_db_clock_mixed_attempts_failures_commit_limits',async()=>{
    for(const k of [...keys].sort((x,y)=>x.key.localeCompare(y.key)))await q(`insert into ${S}.guess_budgets values($1,0,clock_timestamp()+interval '15 minutes')`,[k.key]);
    await q('begin');await b.query('begin');
    try{
      await q(`select key from ${S}.guess_budgets where key=any($1::text[]) order by key for update`,[keys.map(k=>k.key)]);
      const r=await blocked(`select key from ${S}.guess_budgets where key=any($1::text[]) order by key for update`,[keys.map(k=>k.key)],()=>q('commit'),'sorted five-key budget reservation');
      assert.ok(r.value);await b.query('rollback');
    }finally{await q('rollback');await b.query('rollback');}
    const wrong=digest('code',NA,'1001'), outcomes=[];
    outcomes.push(await attempt(a,keys,stable,wrong));outcomes.push(await attempt(b,keys,stable,stable.verifier));
    await Promise.all([a,b].map(async(c,stream)=>{for(let i=0;i<5;i++)outcomes.push(await attempt(c,keys,stable,(i+stream)%2?wrong:stable.verifier));}));
    const accepted=outcomes.filter(r=>r.reserved),failures=accepted.filter(r=>!r.valid).length;
    assert.equal(accepted.length,6);assert.ok(failures>0&&failures<6);assert.ok(outcomes.filter(r=>!r.reserved).every(r=>!r.lookedUp));
    for(const k of keys)assert.equal((await row(`select count from ${S}.guess_budgets where key=$1`,[k.key])).count,k.failure?failures:6);
    // Each documented threshold denies before lookup; not just source=6.
    for(const limit of keys){
      await q(`update ${S}.guess_budgets set count=0`);
      await q(`update ${S}.guess_budgets set count=$2 where key=$1`,[limit.key,limit.max]);
      assert.deepEqual(await attempt(a,keys,stable,stable.verifier),{reserved:false,lookedUp:false});
      assert.equal((await row(`select sum(count)::int as n from ${S}.guess_budgets`)).n,limit.max);
    }
    await q(`update ${S}.guess_budgets set count=1000,until_at=clock_timestamp()-interval '1 second'`);
    assert.equal((await attempt(a,keys,stable,wrong)).valid,false);
    assert.equal((await attempt(b,keys,stable,stable.verifier)).valid,true);
    for(const k of keys)assert.equal((await row(`select count from ${S}.guess_budgets where key=$1`,[k.key])).count,k.failure?1:2);
    const windows=(await q(`select key,extract(epoch from(until_at-clock_timestamp()))::int as seconds from ${S}.guess_budgets`)).rows;
    for(const k of keys)assert.ok(Math.abs(windows.find(r=>r.key===k.key).seconds-(k.failure?86400:900))<10);
    return{requests:12,reservations:6,rejectedBeforeLookup:6,committedWrongPinFailures:failures,thresholds:keys.map(k=>k.max),expiryRollover:true,
      lockOrder:'key ASC, then DB clock; budget-only HMAC lookup probe',fixedPreprovisionedKeys:5,dynamicKeyCapAndPurge:'NOT_RUN; no production adapter claim'};
  });
  await check('stable_credential_second_term_exact_session_scope_and_fail_closed_protocol',async()=>{
    const before=(await q(`select * from ${S}.credentials where id=$1`,[stable.id])).rows;
    let projection=await read(a,stable,oldSession.token_hash);
    assert.deepEqual(projection.tasks.map(t=>t.id),[id(201)]);
    const current=member(stable,{class_id:'term-2',enrollment_id:'stable-student-term-2',revision:2});
    await transaction(a,async()=>{
      await lockScope(a,NA,A,stable.student_id);
      await q(`update ${S}.memberships set active=false where owner_id=$1 and student_id=$2`,[A,stable.student_id]);
      await insert(a,'memberships',current);await insert(a,'publications',publication(230,current,{status:'done'}));
      await insert(a,'publications',publication(231,current,{published:false}));
    });
    assert.equal(await read(a,stable,oldSession.token_hash),null);
    assert.equal(await login(a,stable,id(130),token(130)),1);
    projection=await read(b,stable,token(130));
    assert.deepEqual(projection.tasks.map(t=>t.id),[id(230)]);assert.deepEqual(projection.progress,{total:1,completed:1});
    assert.deepEqual(Object.keys(projection.tasks[0]).sort(),['deadline','id','instruction','status','title']);
    assert.deepEqual((await q(`select * from ${S}.credentials where id=$1`,[stable.id])).rows,before);
    assert.equal(await read(a,stable,token(130),other.entry_verifier),null);
    assert.equal(await read(a,other,oldSession.token_hash,other.entry_verifier),null);
    assert.equal(await login(a,other,id(131),token(131),stable.verifier),0);
    // Ended membership cannot be rescued by another durable identity/name clone.
    await q(`update ${S}.memberships set active=false where owner_id=$1 and student_id=$2`,[A,stable.student_id]);
    const clone=member({...stable,student_id:'different-id-same-display-name'},{class_id:'term-2'});await insert(a,'memberships',clone);
    assert.equal(await login(a,stable,id(132),token(132)),0);assert.equal(await read(a,stable,token(130)),null);
    await q(`update ${S}.memberships set active=true where owner_id=$1 and student_id=$2 and enrollment_id=$3`,[A,stable.student_id,current.enrollment_id]);
    await insert(a,'memberships',member(stable,{class_id:'ambiguous',enrollment_id:'ambiguous',revision:3}));
    assert.equal(await login(a,stable,id(133),token(133)),0);assert.equal(await read(a,stable,token(130)),null);
    await q(`update ${S}.memberships set active=false where enrollment_id='ambiguous'`);
    await q(`update ${S}.memberships set revision=3 where enrollment_id=$1`,[current.enrollment_id]);
    assert.equal(await read(a,stable,token(130)),null);
    await q(`update ${S}.memberships set revision=2 where enrollment_id=$1`,[current.enrollment_id]);
    await q(`update ${S}.publications set published=false where id=$1`,[id(230)]);
    assert.equal((await read(a,stable,token(130))).tasks.length,0);
    await q(`update ${S}.publications set published=true where id=$1`,[id(230)]);
    await q(`update ${S}.contexts set active=false where namespace=$1`,[NA]);
    assert.equal(await login(a,stable,id(134),token(134)),0);assert.equal(await read(a,stable,token(130)),null);
    await q(`update ${S}.contexts set active=true where namespace=$1`,[NA]);
    return{stableIdPinVerifierEntryVersionUnchanged:true,oldUnexpiredSessionDenied:true,newScopePublicationIds:[id(230)],exactProjection:true,
      denies:['ended membership','different student ID/name clone','cross-owner/entry','ambiguous active memberships','revision change','inactive context'],unpublishRechecked:true,
      boundary:'SQL test query protocol only; no canonical membership, teacher Auth, labels or service projection automatically implemented by constraints'};
  });
  await check('atomic_rotation_revoke_all_term_sessions_rollback_and_concurrent_login_revoke',async()=>{
    assert.equal(await login(a,stable,id(140),token(140)),1);
    const before=JSON.stringify((await q(`select id,revoked_at from ${S}.sessions where credential_id=$1 order by id`,[stable.id])).rows);
    const replacement=credential(60,{student_id:stable.student_id,version:2,verifier:digest('code',NA,'8888')});
    await rollback(async()=>{
      await lockScope(a,NA,A,stable.student_id);assert.equal(await revokeLocked(a,stable),3);await insert(a,'credentials',replacement);
      assert.equal((await row(`select count(*)::int as n from ${S}.sessions where credential_id=$1 and revoked_at is null`,[stable.id])).n,0);
    });
    assert.equal(JSON.stringify((await q(`select id,revoked_at from ${S}.sessions where credential_id=$1 order by id`,[stable.id])).rows),before);
    assert.equal((await row(`select count(*)::int as n from ${S}.credentials where id=$1 and revoked_at is null`,[stable.id])).n,1);
    assert.equal((await row(`select count(*)::int as n from ${S}.credentials where id=$1`,[replacement.id])).n,0);
    await transaction(a,async()=>{await lockScope(a,NA,A,stable.student_id);assert.equal(await revokeLocked(a,stable),3);await insert(a,'credentials',replacement);});
    for(const n of [101,130,140])assert.equal(await read(a,stable,token(n)),null);
    assert.equal(await login(a,stable,id(141),token(141)),0);
    assert.equal(await login(a,replacement,id(142),token(142)),1);
    assert.deepEqual((await read(a,replacement,token(142))).tasks.map(t=>t.id),[id(230)]);
    await transaction(a,async()=>{await lockScope(a,NA,A,stable.student_id);assert.equal(await revokeLocked(a,replacement),1);});
    assert.equal(await read(a,replacement,token(142)),null);assert.equal(await login(a,replacement,id(143),token(143)),0);
    const race=credential(70,{verifier:digest('code',NA,'7777')});await insert(a,'credentials',race);await insert(a,'memberships',member(race));
    assert.equal(await login(a,race,id(170),token(170)),1);
    await q('begin');await b.query('begin');
    try{
      await lockScope(a,NA,A,race.student_id);await revokeLocked(a,race);
      const r=await blocked(`select namespace from ${S}.contexts where namespace=$1 and owner_id=$2 for update`,[NA,A],()=>q('commit'),'revoke before concurrent login');
      assert.ok(r.value);await lockScope(b,NA,A,race.student_id);
      assert.equal(await loginLocked(b,race,id(171),token(171)),0);await b.query('commit');
    }finally{await q('rollback');await b.query('rollback');}
    assert.equal((await row(`select count(*)::int as n from ${S}.sessions where credential_id=$1 and revoked_at is null`,[race.id])).n,0);
    return{oldAndNewTermSessionsRevoked:3,replacementSessionRevoked:1,rotationRollbackRetainsOriginalCredentialAndSessions:true,
      concurrentRevokeThenLogin:'observed context lock wait; zero post-revoke session',lockOrder:'context → memberships → credentials → sessions',testAdapterOnly:true};
  });
  // Hash the entire persisted synthetic state, keeping HMACs/rows out of logs.
  const snapshot=async c=>{
    const state={};for(const table of report.catalog.tables)state[table.relname]=(await c.query(`select row_to_json(t) as row from ${S}.${table.relname} t order by row_to_json(t)::text`)).rows;
    return createHash('sha256').update(JSON.stringify(state)).digest('hex');
  };
  report.restartExpectedSha256=await snapshot(a);
  return async c=>{
    assert.equal(await snapshot(c),report.restartExpectedSha256);
    assert.equal(await read(c,stable,token(130)),null);
    for(const k of keys)assert.equal((await c.query(`select count from ${S}.guess_budgets where key=$1`,[k.key])).rows[0].count,k.failure?1:2);
    return{stateSha256:report.restartExpectedSha256,credentialsBudgetsRevocationsPersist:true,oldSessionStillDenied:true,
      boundary:'controlled clean stop/restart only; NOT crash/power-loss durability'};
  };
}

export async function inactiveBindings({root,report}){
  const git=args=>execFileSync('C:/Program Files/Git/cmd/git.exe',args,{cwd:root,maxBuffer:4*1024*1024});
  const previous=JSON.parse(await readFile(`${root}/tests/n88-real-pilot-final-policy-browser.json`,'utf8'));
  assert.ok(previous.checks.every(c=>c.status==='PASS'));assert.deepEqual(previous.failures,[]);
  const files=[...Object.keys(previous.testedSourceSha256),'tests/n88-real-pilot.test.mjs','docs/automation-evidence/20261017/N88_FINAL_APPROVED_PIN_AND_TERM_IDENTITY.md'];
  const hashes={};
  for(const file of files){
    const current=await readFile(`${root}/${file}`), base=git(['show',`${report.baseSha}:${file}`]);
    // Compare repository bytes using LF normalization for Windows Git worktrees.
    const normalized=current.toString('utf8').replace(/\r\n/g,'\n');
    assert.equal(normalized,base.toString('utf8').replace(/\r\n/g,'\n'),`${file} unchanged from base`);
    const hash=createHash('sha256').update(normalized).digest('hex');
    if(previous.testedSourceSha256[file])assert.equal(hash,previous.testedSourceSha256[file],`${file} prior rendered evidence binding`);
    hashes[file]=hash;
  }
  const changed=git(['diff',report.baseSha,'--name-only','--','src','public','sw.js','index.html','scripts','supabase']).toString().trim();
  assert.equal(changed,'','normal app/router/SW/service/import graph unchanged');
  let matches='';
  try{matches=git(['grep','-n','-E','n88-student-portal|n88-native-postgres-qualification','--','src','public','sw.js','index.html','scripts','supabase']).toString();}
  catch(e){if(e.status!==1)throw e;}
  const bindings=matches.split('\n').filter(line=>/\b(?:from\s*|import\s*\(?\s*|require\s*\(\s*)['"][^'"]*(?:n88-student-portal|n88-native-postgres-qualification)/.test(line));
  assert.deepEqual(bindings,[]); // Documentary ops references are not imports.
  report.reusedEvidence={normalizedLfSha256:hashes,priorNode:'17/17 memory/service checks per unchanged final-policy document, NOT rerun',priorBrowser:'2/2 final policy actual-app HTTP checks, NOT rerun',appServiceBindings:0,normalAppRouterSwChangedPaths:[]};
  report.boundaries={productionAsyncSqlAdapter:'NOT_IMPLEMENTED',canonicalTeacherAuthMembershipAdapter:'NOT_IMPLEMENTED',hostedSqlAuthRlsService:'NOT_RUN',realStudentAccess:'NOT_ACTIVATED',hostedIngressTlsLogsDevices:'NOT_RUN',crashPowerLossDurability:'NOT_RUN',productionDynamicBudgetKeyAdmissionPurge:'NOT_RUN'};
  return{sourceFiles:files.length,priorFinalPinTermSourceHashesMatch:true,normalAppRouterSwUnchanged:true,appServiceBindings:0,hostedAndProductionGatesExplicit:true};
}
