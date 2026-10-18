/** AI: N44-only affected boundary proof; fabricated native PG, no hosted access. */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {compileBoundary,migrationPath} from '../../../drafts/n44-push/activation/build-error-boundary.mjs';
import {deriveScram} from '../../../scripts/n44-activation-custody.mjs';
import {randomBytes} from 'node:crypto';
import {createRequire} from 'node:module';
const base='drafts/n44-push/activation/';
const owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',foreign='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
export async function beforeApply({admin}) {
 const c=JSON.parse(await readFile(base+'metadata-contract.json','utf8'));
 for(const x of c.columns.filter(x=>x.schema==='rakeezx'&&x.nullable==='NO')){
  assert.match(x.table,/^[a-z_]+$/);assert.match(x.column,/^[a-z_]+$/);
  await admin.query(`alter table rakeezx.${x.table} alter column "${x.column}" set not null`);
 }
 for(const t of new Set(c.columns.filter(x=>x.schema==='rakeezx').map(x=>x.table)))
  await admin.query(`alter table rakeezx.${t} force row level security;alter table rakeezx.${t} owner to postgres`);
 await admin.query('alter table rakeezx.score_subitems drop constraint score_subitems_owner_id_item_id_fkey;alter table rakeezx.score_subitems add foreign key(owner_id,item_id) references rakeezx.items(owner_id,id) on delete cascade');
 // Mirror already-proven existing hosted capability, LOCAL fixture only.
 await admin.query('grant references(id) on auth.users to postgres');
}
export async function journey({pool,admin,report}) {
 const pass=(name,evidence)=>report.checks.push({name,status:'PASS',evidence});
 const contract=await compileBoundary(process.cwd(),admin.query.bind(admin));
 await admin.query('set role postgres');await admin.query(await readFile(migrationPath,'utf8'));await admin.query('reset role');
 // First import only after this run compiled and recorded its exact source.
 const boundarySource=await readFile(base+'private-error-boundary.mjs','utf8');
 const boundaryCatalogSql=boundarySource.match(/export const boundaryCatalogSql=`([^`]+)`;/)[1];
 const identities=(await admin.query(boundaryCatalogSql)).rows;
 assert.equal(identities.length,contract.operations.length);
 for(const x of identities){assert.equal(x.owner,'postgres');assert.equal(x.definer,false);assert.deepEqual(x.config,['search_path=pg_catalog']);assert.deepEqual(x.acl,['n44_backend:EXECUTE','postgres:EXECUTE']);}
 await writeFile(base+'error-boundary-identities.json',JSON.stringify(identities,null,2)+'\n');
 const {assertVerifiedBoundary,privateQuery,encodeBoundaryParameter}=await import('../../../drafts/n44-push/activation/private-error-boundary.mjs');
 const {createPostgresRepository}=await import('../../../drafts/n44-push/postgres-repository.mjs');
 const c=await pool.connect();
 try {
  const posture=(await c.query("select current_setting('log_error_verbosity') as verbosity,current_setting('log_statement') as statements,current_setting('log_parameter_max_length') as parameters,current_setting('log_parameter_max_length_on_error') as error_parameters")).rows[0];
  assert.deepEqual(posture,{verbosity:'default',statements:'ddl',parameters:'-1',error_parameters:'0'});report.posture=posture;
  await assertVerifiedBoundary(c);
  const find=part=>{const o=contract.operations.find(o=>o.sql.startsWith(part));assert.ok(o,part);return o.sql;};
  const clock=find('insert into n44_push_draft.owner_clock('),canary='FABRICATED_N44_PRIVATE_CANARY_734916';
  const cases=[];
  async function errorCase(name,code,sql,values){
   await c.query('begin');let e;try{await privateQuery(c,sql,values);}catch(x){e=x;}
   assert.equal(e?.code,code,name);assert.equal(e.message,'n44_private_database_error');assert.ok(!e.detail&&!e.hint);
   assert.ok(!JSON.stringify(e).includes(canary));await assert.rejects(c.query('select 1'),x=>x.code==='25P02');await c.query('rollback');cases.push({name,sqlstate:code});
  }
  await errorCase('cast-inside-boundary','22P02',clock,[canary]);
  await errorCase('foreign-key-detail','23503',clock,['eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee']);
  const rate=find('insert into n44_push_draft.ingress_nonces');
  await errorCase('check-detail','23514',rate,['33333333-3333-4333-8333-333333333333',canary,1]);
  await admin.query('set role postgres');await admin.query('revoke select on n44_push_draft.events from n44_backend');await admin.query('reset role');
  await errorCase('permission','42501',find('select * from n44_push_draft.events where owner_id=$1 order'),[owner]);
  await admin.query('set role postgres');await admin.query('grant select on n44_push_draft.events to n44_backend');await admin.query('reset role');
  await assert.rejects(privateQuery(c,'select $1::text',[canary]),/n44_database_unavailable/);
  await assert.rejects(assertVerifiedBoundary({query:async()=>({rows:[]})}),/n44_database_unavailable/);
  await assert.rejects(assertVerifiedBoundary({query:async()=>({rows:identities.map((x,i)=>i?x:{...x,definer:true})})}),/n44_database_unavailable/);
  pass('typed_private_errors_and_fail_closed_registry','Actual SQLSTATE22P02/23503/23514/42501 preserved with fixed message, no original DETAIL/HINT; transaction remains aborted. Unknown SQL and missing/altered catalog rejected before value transmission.');
  const session=find('select user_id,session_id,not_after_ms');
  assert.deepEqual((await privateQuery(c,session,[owner,'11111111-1111-4111-8111-111111111111'])).rows,(await c.query(session,[owner,'11111111-1111-4111-8111-111111111111'])).rows);
  assert.equal((await privateQuery(c,session,[foreign,'11111111-1111-4111-8111-111111111111'])).rowCount,0);
  const source=find('select n44_push_draft.read_source');
  assert.deepEqual((await privateQuery(c,source,[owner,'lesson','missing'])).rows,[{source:null}]);
  await admin.query("insert into rakeezx.years(owner_id,id,status,hijri_start,hijri_end,revision) values($1,'y','active',1448,1449,1)",[owner]);
  await admin.query("insert into rakeezx.subjects(owner_id,id,revision) values($1,'subject',1)",[owner]);
  await admin.query("insert into rakeezx.sections(owner_id,id,year_id,status,revision) values($1,'section','y','active',1)",[owner]);
  await admin.query("insert into rakeezx.terms(owner_id,id,year_id,\"index\",status,start_date,end_date,revision) values($1,'term','y',1,'active','2026-10-01','2026-12-01',1)",[owner]);
  await admin.query("insert into rakeezx.teachings(owner_id,id,section_id,subject_id,term_id,revision) values($1,'teaching','section','subject','term',1)",[owner]);
  await admin.query("insert into rakeezx.sessions(owner_id,id,teaching_id,date,start_time,end_time,status,revision) values($1,'session','teaching','2026-10-18','08:00','09:00','scheduled',1)",[owner]);
  const projected=await privateQuery(c,source,[owner,'lesson','session']);
  assert.equal(projected.rows[0].source.source.id,'session');
  assert.deepEqual(projected.rows,(await c.query(source,[owner,'lesson','session'])).rows);
  assert.deepEqual((await privateQuery(c,source,[foreign,'lesson','session'])).rows,[{source:null}]);
  const wall=find('select (extract(epoch');
  assert.deepEqual((await privateQuery(c,wall,['2026-10-18','08:00','Asia/Riyadh'])).rows,(await c.query(wall,['2026-10-18','08:00','Asia/Riyadh'])).rows);
  const nonce=find('insert into n44_push_draft.ingress_nonces');
  await c.query('begin');const n1=await privateQuery(c,nonce,['33333333-3333-4333-8333-333333333333','teacher',Date.now()+1000]);const n2=await privateQuery(c,nonce,['33333333-3333-4333-8333-333333333333','teacher',Date.now()+1000]);assert.equal(n1.rowCount,1);assert.equal(n2.rowCount,0);await c.query('rollback');
  pass('native_results_owner_source_and_nonce','Native uuid/null/bigint text/timezone results match original queries; original-session foreign-owner denial preserved, missing canonical source returns null; nonce ON CONFLICT idempotency rowCount1/0 preserved.');
  report.errorCases=cases;report.routines=identities.length;report.boundaryMigration=contract.migration;
 } finally {c.release();}
 const password=randomBytes(32).toString('hex'),verifier=deriveScram(password);
 await admin.query(`create role n44_service_login login nosuperuser nocreatedb nocreaterole noreplication nobypassrls noinherit password '${verifier}';grant n44_backend to n44_service_login with inherit false,set true,admin false;`);
 const {Client}=createRequire(import.meta.url)('C:/Users/Abody/Projects/RakeezX/artifacts/n77-native-pg17/client/node_modules/pg');
 const login=new Client({...pool.options,user:'n44_service_login',password});
 try{await login.connect();assert.equal((await login.query('select current_user as role')).rows[0].role,'n44_service_login');
  await assert.rejects(login.query('select owner_id from n44_push_draft.owner_clock'),e=>e.code==='42501');
  await login.query('set role n44_backend');await assertVerifiedBoundary(login);
  assert.equal((await login.query('select current_user as role')).rows[0].role,'n44_backend');
  await assert.rejects(login.query('select id from auth.users'),e=>e.code==='42501');
 }finally{await login.end();}
 const logBeforePrivate=await readFile(report.phase+'/server.log','utf8');assert.ok(logBeforePrivate.includes(verifier));assert.ok(!logBeforePrivate.includes(password));
 pass('client_scram_exact_noinherit_login_and_ddl_audit','Actual new local n44_service_login authenticates with in-memory256-bit password/client SCRAM; inherits no backend privilege before SET ROLE, cannot read Auth after SET, verifier DDL audit retained, original password absent from logs. No hosted secret or login yet.');
 let ack=false,commits=0;
 const acquire=async()=>{const raw=await pool.connect();try{await assertVerifiedBoundary(raw);}catch(e){raw.release(e);throw e;}
  return {release:e=>raw.release(e),async query(sql,values){
   const r=await privateQuery(raw,sql,values);if(sql==='commit'){commits++;if(ack){ack=false;throw Error('fabricated lost durable ACK');}}return r;
  }};
 };
 const repo=createPostgresRepository({acquire}),preferences={lesson:true,due:true,lessonMinutes:10,dueDays:[0],timezone:'Asia/Riyadh',quiet:null};
 const context={workspaceId:'w',deviceId:'d',active:true,sessionId:'11111111-1111-4111-8111-111111111111',sessionRevision:'r',sessionExpiresAt:Date.now()+60000,consentRevision:'v1',pushConsent:false,preferences};
 await repo.writeContexts(owner,tx=>tx.set('contexts','["w","d"]',context));
 assert.equal(await repo.atomic(foreign,tx=>tx.context('w','d')),null);
 assert.equal(await repo.writeContexts(owner,tx=>{if(tx.context('w','d').consentRevision!=='stale')return 'stale';tx.delete('contexts','["w","d"]');}),'stale');
 await assert.rejects(repo.writeContexts(owner,tx=>{tx.delete('contexts','["w","d"]');throw Error('fabricated rollback');}));
 assert.equal((await repo.atomic(owner,tx=>tx.context('w','d'))).consentRevision,'v1');
 const before=commits;ack=true;await assert.rejects(repo.writeContexts(owner,tx=>tx.set('contexts','["w","d"]',{...context,consentRevision:'v2'})),/n44_repository_unavailable/);assert.equal(commits,before+1);
 assert.equal((await repo.atomic(owner,tx=>tx.context('w','d'))).consentRevision,'v2');
 // A sequence survives subtransaction rollback, so the actual database raises
 // exactly one definitive serialization error INSIDE the typed UPDATE routine.
 await admin.query("create sequence n44_push_draft.fixture_retry_sequence;grant usage on sequence n44_push_draft.fixture_retry_sequence to n44_backend;create function n44_push_draft.fixture_retry() returns trigger language plpgsql as $$begin if nextval('n44_push_draft.fixture_retry_sequence')=1 then raise exception using errcode='40001',message='fixture serialization retry',detail='fixture fixed metadata';end if;return new;end$$;create trigger fixture_retry before update on n44_push_draft.owner_clock for each row execute function n44_push_draft.fixture_retry();");
 let workCalls=0;await repo.atomic(owner,tx=>{workCalls++;return tx.time(1);});assert.equal(workCalls,2);
 await admin.query('drop trigger fixture_retry on n44_push_draft.owner_clock;drop function n44_push_draft.fixture_retry();drop sequence n44_push_draft.fixture_retry_sequence');
 pass('repository_owner_clock_cas_retry_rollback_and_durable_ack','Actual repository through typed boundary: owner isolation, stale CAS, callback rollback, high-water clock, one definitive40001 retry and no replay/early result on lost durable COMMIT ACK.');
 const log=await readFile(report.phase?report.phase+'/server.log':process.cwd()+'/'+report.localPhase+'/server.log','utf8');
 assert.ok(log.includes('n44_private_database_error'));assert.ok(/CREATE|create/.test(log));
 assert.ok(!log.includes('FABRICATED_N44_PRIVATE_CANARY_734916'));assert.ok(!log.includes(Buffer.from('FABRICATED_N44_PRIVATE_CANARY_734916').toString('base64')));assert.ok(!/DETAIL:.*(Key|Failing row)/.test(log));
 pass('actual_server_log_privacy_with_error_and_ddl_audit','Actual owned PG17.6 server log retains errors and DDL under default/ddl/error-parameter0; fabricated literal and base64 canary and original constraint DETAIL absent. No hosted logger or privilege change.');
}
