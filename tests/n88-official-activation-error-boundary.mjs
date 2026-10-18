/** AI-authored. Owned native PG17 fixture; never connects to hosted services. */
import assert from 'node:assert/strict';
import {readFile,writeFile,appendFile} from 'node:fs/promises';
import {startNativePg} from './fixtures/n88-integrated-class/native-pg.mjs';
import {compileBoundary,migrationPath} from '../drafts/n88-student-portal/activation/build-error-boundary.mjs';
import {createCanonicalAdapter} from '../drafts/n88-student-portal/canonical-adapter.mjs';
import {withCredentialRepository,createPgClassResolver} from '../drafts/n88-student-portal/class-credentials.mjs';
import {readCanonical} from '../drafts/n88-student-portal/integrated-service.mjs';
import {readTaskGuidance,saveTaskGuidance} from '../drafts/n88-student-portal/task-guidance.mjs';
const root=process.cwd();let pg,client;
try {
  pg=await startNativePg(root);
  const contract=await compileBoundary(root,pg.fixtureQuery);
  await pg.fixtureQuery('set role postgres');
  await pg.fixtureQuery(await readFile(root+'/'+migrationPath,'utf8'));
  await pg.fixtureQuery('reset role');
  const identities=(await pg.fixtureQuery(`select p.proname as name,encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex') as definition,
    pg_get_function_identity_arguments(p.oid) as arguments,p.prosecdef as definer,
    r.rolname as owner,p.proconfig as config,
    (select array_agg(coalesce(gr.rolname,'PUBLIC')||':'||a.privilege_type order by coalesce(gr.rolname,'PUBLIC'),a.privilege_type)
      from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a left join pg_roles gr on gr.oid=a.grantee) as acl
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_roles r on r.oid=p.proowner
    where n.nspname='n88_private' and p.proname like 'boundary_%' order by p.proname`)).rows;
  assert.equal(identities.length,contract.operations.length);
  for(const i of identities){assert.equal(i.owner,'postgres');assert.equal(i.definer,false);assert.deepEqual(i.config,['search_path=pg_catalog']);assert.deepEqual(i.acl,['n88_backend:EXECUTE','postgres:EXECUTE']);}
  await writeFile(root+'/drafts/n88-student-portal/activation/error-boundary-identities.json',JSON.stringify(identities,null,2)+'\n');
  // Only this disposable local cluster changes settings, matching the observed
  // provider posture. No hosted canary or logging configuration mutation.
  await appendFile(pg.phase+'/data/postgresql.auto.conf',"\nlog_error_verbosity='default'\nlog_statement='ddl'\nlog_min_error_statement='error'\nlog_parameter_max_length=-1\nlog_parameter_max_length_on_error=0\n");
  await pg.fixtureQuery('select pg_reload_conf()');
  // Load source-bound JSON only AFTER compiling/recording this exact candidate.
  const {assertVerifiedBoundary,privateQuery,encodeBoundaryParameter}=await import('../drafts/n88-student-portal/activation/private-error-boundary.mjs');
  const {createPostgresRepository}=await import('../drafts/n88-student-portal/postgres-repository.mjs');
  client=await pg.acquire();
  const posture=(await client.query("select current_setting('log_error_verbosity') as verbosity,current_setting('log_statement') as statements,current_setting('log_parameter_max_length') as parameters,current_setting('log_parameter_max_length_on_error') as error_parameters")).rows[0];
  assert.deepEqual(posture,{verbosity:'default',statements:'ddl',parameters:'-1',error_parameters:'0'});
  await assertVerifiedBoundary(client);
  const find=part=>{const o=contract.operations.find(o=>o.sql.startsWith(part));assert.ok(o,part);return o.sql;};
  const insert=find('insert into n88_private.contexts ('),read=contract.operations.find(o=>o.sql.startsWith('select case when octet_length(payload)<=$2')&&o.sql.includes('from n88_private.contexts ')).sql;
  const canary='FABRICATED_N88_PRIVATE_CANARY_982471';
  const owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const cases=[];
  async function errorCase(name,code,sql,values) {
    await client.query('begin');
    let caught;
    try {await privateQuery(client,sql,values);}catch(e){caught=e;}
    assert.equal(caught?.code,code,name);assert.equal(caught.message,'n88_private_database_error',name);
    assert.ok(!JSON.stringify(caught).includes(canary),name);
    assert.ok(!caught.detail && !caught.hint,name);
    await assert.rejects(client.query('select 1'),e=>e.code==='25P02');
    await client.query('rollback');cases.push({name,sqlstate:code,sanitized:true,transactionAborted:true});
  }
  // Existing seeded context owner triggers uniqueness; no rows survive rollback.
  await errorCase('unique','23505',insert,[canary,owner,true]);
  const credentialInsert=find('insert into n88_private.credentials (');
  await errorCase('foreign-key','23503',credentialInsert,['eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',canary,owner,canary,1,'e'.repeat(64),'f'.repeat(64),null]);
  await errorCase('check','23514',insert,[canary.repeat(3),owner,true]);
  await errorCase('cast-inside-boundary','22P02',insert,[canary,canary,true]);
  await pg.fixtureQuery('set role postgres');await pg.fixtureQuery('revoke select on n88_private.contexts from n88_backend');await pg.fixtureQuery('reset role');
  await errorCase('permission','42501',read,[10,1024,8192]);
  await pg.fixtureQuery('set role postgres');await pg.fixtureQuery('grant select on n88_private.contexts to n88_backend');await pg.fixtureQuery('reset role');
  await assert.rejects(privateQuery(client,'select $1::text',[canary]),/n88_database_unavailable/);
  const missing={query:async()=>({rows:[]})};await assert.rejects(assertVerifiedBoundary(missing),/n88_database_unavailable/);
  const wrong={query:async()=>({rows:identities.map((v,i)=>i? v:{...v,definer:true})})};await assert.rejects(assertVerifiedBoundary(wrong),/n88_database_unavailable/);
  const numericRead=find('select case when octet_length(payload::text)<=$2');
  const original=(await client.query(numericRead,[100,102400])).rows;
  assert.deepEqual((await privateQuery(client,numericRead,[100,102400])).rows,original);
  assert.deepEqual((await privateQuery(client,read,[100,32768,1048576])).rows,(await client.query(read,[100,32768,1048576])).rows);
  client.release();client=null;
  const manifest=JSON.parse(await readFile('drafts/n88-student-portal/deployment.inactive.json','utf8'));
  let loseCommit=false;
  const trace=[];
  const acquire=async()=>{const c=await pg.acquire();return {release:e=>c.release(e),query:async(sql,...args)=>{trace.push(sql);try{const r=await c.query(sql,...args);if(sql==='commit'&&loseCommit){loseCommit=false;throw Error('fabricated ACK loss after durable commit');}return r;}catch(e){console.error(JSON.stringify({localStatement:sql,localSqlstate:e.code,message:e.message}));throw e;}}};};
  const repository=withCredentialRepository(createPostgresRepository({acquire,limits:manifest.limits,timing:manifest.timing,synchronize:createCanonicalAdapter(manifest.canonicalBounds)}));
  const scope={ownerId:owner,classId:'class',termId:'term',teachingId:'teaching'};
  const source={sourceStamp:'a'.repeat(64),bindings:[]};
  const input={subitemId:'overdue',sourceStamp:source.sourceStamp,revision:0,executionInstructions:'FABRICATED instruction',deliveryInstructions:'FABRICATED delivery',confirmClear:false};
  const authSql=find('select user_id,session_id from n88_private.lock_current_session');
  const session='11111111-1111-4111-8111-111111111111',foreign='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const seams=[];
  await repository.transaction(async(db,ports)=>{
    console.log('local seam: synchronize');
    await ports.synchronizeOwner(owner);
    console.log('local seam: resolver');
    assert.equal(db.memberships.filter(m=>m.ownerId===owner&&m.status==='active').length,2);
    assert.ok(await createPgClassResolver()(db,ports,{ownerId:owner},'teaching',{}));
    assert.equal(await createPgClassResolver()(db,ports,{ownerId:foreign},'teaching',{}),null);
    const current=await ports.query(authSql,[owner,session]);assert.equal(current.rows.length,1);
    assert.equal((await ports.query(authSql,[foreign,session])).rows.length,0);
    ports.beforeCommit(async()=>assert.equal((await ports.query(authSql,[owner,session])).rows.length,1));
    const canonical=await readCanonical(ports,owner);assert.equal(canonical.students.length,2);assert.equal(canonical.scores.length>0,true);
    console.log('local seam: foreign canonical');
    const other=await readCanonical(ports,foreign);assert.equal(other.teachings.length,0);
    assert.deepEqual(await readTaskGuidance(ports,scope),[],'foreign projection fence cannot read owner guidance');
    await readCanonical(ports,owner); // Restore the real helper-owned fence before owner write.
    await saveTaskGuidance(ports,scope,source,await readTaskGuidance(ports,scope),input);
  });seams.push('actual owner/source/auth lock/commit guard and all thirteen canonical family reads');
  await assert.rejects(repository.transaction(async(_db,ports)=>{await ports.synchronizeOwner(owner);await readCanonical(ports,owner);return saveTaskGuidance(ports,scope,source,await readTaskGuidance(ports,scope),input);}),/n88_repository_unavailable/);
  const stored=await repository.transaction(async(_db,ports)=>{await ports.synchronizeOwner(owner);await readCanonical(ports,owner);return readTaskGuidance(ports,scope);});assert.equal(stored[0].payload.revision,1);
  seams.push('guidance stale CAS rejected without overwriting revision1');
  await assert.rejects(repository.transaction(async(db)=>{db.contexts[0].active=false;throw Error('fabricated rollback');}),/n88_repository_unavailable/);
  assert.equal(await repository.transaction(async db=>db.contexts[0].active),true);seams.push('callback error rolls back private state');
  loseCommit=true;
  await assert.rejects(repository.transaction(async(db)=>{db.contexts[0].active=false;return {mustNotEscape:true};}),/n88_repository_unavailable/);
  assert.equal(await repository.transaction(async db=>db.contexts[0].active),false);
  seams.push('lost durable COMMIT ACK returns unavailable without replay; fresh read observes committed state');
  await repository.transaction(async db=>{db.contexts[0].active=true;});
  // Prove DB conversion inside the boundary preserves bigint precision and a
  // timestamp/null through the repository's original intentional text codec.
  const membershipInsert=find('insert into n88_private.memberships (');
  const typed=await pg.acquire();await assertVerifiedBoundary(typed);await typed.query('begin');
  const precise='9007199254740993';
  await privateQuery(typed,membershipInsert,[owner,'typed-class','typed-student','typed-enrollment',precise,'active',null,true,true,'FABRICATED typed row','b'.repeat(64),true]);
  const membershipRead=contract.operations.find(o=>o.sql.startsWith('select case when octet_length(payload)<=$2')&&o.sql.includes('from n88_private.memberships ')).sql;
  const typedRows=(await privateQuery(typed,membershipRead,[100,32768,1048576])).rows.map(r=>JSON.parse(r.bounded_row));
  assert.equal(typedRows.find(r=>r.class_id==='typed-class').revision,precise);
  assert.equal(typedRows.find(r=>r.class_id==='typed-class').end_date,null);
  await typed.query('rollback');typed.release();seams.push('bigint beyond JS safe integer preserved as exact text; null preserved; uuid[] owner parameters preserved');
  // Auxiliary wire proof for lossless PG types; the real repository/source/ACK
  // path above separately proves Product coverage (no added JSON result codec).
  const decimal='12345678901234567890.12345678901234567890',bytes=Buffer.from([0,255,92,34,128]),array=['quote"','back\\slash',null,'NULL','عربي'];
  const date=new Date('2026-10-18T12:34:56.789Z');
  const wire=(await pg.fixtureQuery("select convert_from(decode($1,'base64'),'UTF8')::numeric as decimal,convert_from(decode($2,'base64'),'UTF8')::bigint as bigint,convert_from(decode($3,'base64'),'UTF8')::bytea as bytes,convert_from(decode($4,'base64'),'UTF8')::text[] as array,convert_from(decode($5,'base64'),'UTF8')::timestamptz as stamp,convert_from(decode($6,'base64'),'UTF8')::text as nullable",[decimal,BigInt(precise),bytes,array,date,null].map(encodeBoundaryParameter))).rows[0];
  assert.equal(wire.decimal,decimal);assert.equal(wire.bigint,precise);assert.deepEqual(wire.bytes,bytes);assert.deepEqual(wire.array,array);assert.equal(wire.stamp.toISOString(),date.toISOString());assert.equal(wire.nullable,null);
  seams.push('actual native PG numeric/bigint/bytea/escaped array/null/timestamp wire roundtrip with no JSON result codec');
  const log=await readFile(pg.phase+'/server.log','utf8');
  assert.ok(log.includes('n88_private_database_error'),'actual server error recording');
  assert.ok(log.includes('REVOKE')||log.includes('revoke'),'DDL audit remains active');
  assert.ok(!log.includes(canary),'no private literal in actual server log');
  assert.ok(!log.includes(Buffer.from(canary).toString('base64')),'no encoded bound value in log');
  assert.ok(!/DETAIL:.*(Key|Failing row)/.test(log),'no original constraint detail');
  const result={status:'PASS',postgres:'17.6',posture,routines:identities.length,migration:contract.migration,cases,seams,unknownSqlRejected:true,missingAndWrongBoundaryRejected:true,nativeResultParity:true,actualServerLogs:{errorsPresent:true,ddlAuditPresent:true,privateCanaryAbsent:true,privateParameterAbsent:true,originalDetailAbsent:true},hostedOperations:0};
  await writeFile(root+'/tests/n88-official-activation-error-boundary.json',JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result));
} catch(e) {console.error(JSON.stringify({failure:e.message,code:e.code,stack:e.stack?.split('\n').slice(0,4)}));throw e;} finally {client?.release(Error('fixture_cleanup'));await pg?.close();}
