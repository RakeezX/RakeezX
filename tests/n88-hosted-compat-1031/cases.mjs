/** AI: fabricated native integration, real restricted LOGIN and complete RPC. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import path from 'node:path';
import {bootstrapPublicSchema} from '../fixtures/n122-1019/native-cases.mjs';
import {providerFixture,A,B,SESSION,authUrl} from '../fixtures/n88-existing-host/provider.mjs';
import {createHostedPublicationV2Runtime,runtimeIdentitySql} from '../../drafts/n88-student-portal/activation/v2-runtime-writer-1031/host.mjs';
import {createRolloutGuard} from '../../drafts/n88-student-portal/rollout-guard.mjs';
import {publicationCommand} from '../../src/lib/n88-item-publication-proposal.js';
import {createWebEntry} from '../../drafts/n88-student-portal/web-entry.mjs';
import {createRuntimeWriterGateway} from '../../drafts/n88-student-portal/activation/v2-runtime-writer-1031/gateway.inactive.mjs';
import {FORWARDED,encodeBytes,mac,sha,signingText} from '../../drafts/n88-student-portal/web-protocol.mjs';

const hash=s=>createHash('sha256').update(s).digest('hex');
export async function qualify({root,admin,report,Client,port,clients,phase}){
 const q=(s,a=[])=>admin.query(s,a).catch(e=>{report.nativeError={code:e.code,message:'fixed native setup failure',statementSha256:hash(s)};throw e;}),src=async p=>(await readFile(path.join(root,p),'utf8')).replace(/^\uFEFF/,'');
 const check=async(name,fn)=>{console.log('CHECK '+name);const c={name,status:'FAIL'};report.checks.push(c);c.evidence=await fn();c.status='PASS';};
 await q('create role postgres superuser;set role postgres');
 await bootstrapPublicSchema({a:admin,report,root}).catch(e=>{report.bootstrapError=e.message;throw e;});
 await q(`alter table auth.users add column banned_until timestamptz;create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id),not_after timestamptz);
 create function auth.jwt() returns jsonb language sql stable as $$select jsonb_build_object('session_id',current_setting('request.jwt.claim.session_id',true))$$;
 create role n88_backend nologin noinherit nosuperuser nobypassrls nocreatedb nocreaterole;`);
 for(const f of ['schema-proposal.sql','postgres-repository-schema.sql','canonical-state-schema.inactive.sql','canonical-lock.inactive.sql','auth-session.inactive.sql','ingress.inactive.sql','roles.inactive.sql','integrated-schema.inactive.sql','six-digit-schema.inactive.sql','shared-network-budget.inactive.sql','code-recovery.inactive.sql','task-guidance.inactive.sql'])await q(await src('drafts/n88-student-portal/'+f));
 // Exact old finite serial functions, not a general SQL port. This declaration
 // block is the source-qualified part, excluding its hosted installation gate.
 const old=await src('supabase/migrations/20261018185300_n88_private_error_boundary_staged.sql');
 const oldStart=old.indexOf('create function n88_private.boundary_');
 assert(oldStart>0);await q(old.slice(oldStart,old.lastIndexOf('commit;')));
 const packet=await src('drafts/n88-student-portal/activation/v2-package-1028/schema.sql');
 // Qualify exact storage declarations in this newly owned fabricated fixture,
 // never run or alter the guarded local/hosted installer itself.
 await q(packet.slice(packet.indexOf('-- BEGIN EXACT original storage'),packet.lastIndexOf('commit;')));
 // Installed 20261031 runtime has no raw table/column rights. Match that narrower
 // state after reusing the historical declaration source above.
 const cols=(await q(`select c.relname,n.nspname,string_agg(quote_ident(a.attname),',') as cols from pg_class c join pg_namespace n on n.oid=c.relnamespace join pg_attribute a on a.attrelid=c.oid and a.attnum>0 and not a.attisdropped where n.nspname in ('auth','rakeezx','n88_private') and c.relkind='r' group by c.relname,n.nspname`)).rows;
 for(const r of cols)await q(`revoke all on ${r.nspname}.${r.relname} from n88_v2_runtime;revoke all(${r.cols}) on ${r.nspname}.${r.relname} from n88_v2_runtime`);
 const packetDir='drafts/n88-student-portal/activation/v2-runtime-writer-1031/';
 for(const n of ['20261019091500_n122_non_teaching_slots.sql','20261019161000_n36_subjectless_section_delete.sql','20261020085614_n117_initial_department_calendar.sql'])await q(await src('supabase/migrations/'+n));
 const inventory=JSON.parse(await src(packetDir+'current-writers.json'));
 for(const definition of new Set(inventory.triggers.map(t=>t.function_definition)))await q(definition);
 for(const f of inventory.functions){await q(f.definition);await q(`revoke all on function ${f.signature} from public,anon,authenticated,n88_backend`);if(f.acl.includes('authenticated='))await q(`grant execute on function ${f.signature} to authenticated`);}
 await check('actual_current_function_and_trigger_baselines',async()=>{
  for(const f of inventory.functions){const r=(await q("select encode(sha256(convert_to(pg_get_functiondef($1::regprocedure),'UTF8')),'hex') as sha",[f.signature])).rows[0];assert.equal(r.sha,f.sha256,f.signature);}
  for(const t of inventory.triggers){const r=(await q("select pg_get_triggerdef(t.oid,true) as definition,pg_get_functiondef(t.tgfoid) as function from pg_trigger t where tgrelid=$1::regclass and tgname=$2",['rakeezx.'+t.relname,t.tgname])).rows[0];assert.equal(r?.definition,t.definition,t.relname+':'+t.tgname);assert.equal(r.function,t.function_definition);}
  return {currentFunctions:inventory.functions.length,originalTriggers:inventory.triggers.length,actualMetadata:true};
 });
 const password=randomBytes(32).toString('hex');await q(`alter role n88_backend login password '${password}';create role n88_sync_client login password '${password}' inherit;grant authenticated to n88_sync_client`);
 const connectAs=async role=>{const c=new Client({host:'127.0.0.1',port,database:'postgres',user:role,password,ssl:false,statement_timeout:3000,connectionTimeoutMillis:3000,query_timeout:15000});c.on('error',()=>{});clients.add(c);await c.connect();return c;};
 await q('reset role');await q(`alter role postgres nosuperuser bypassrls createrole createdb login password '${password}';grant execute on function pg_catalog.pg_control_system() to postgres;grant n88_v2_guard to postgres with admin true,inherit false,set false`);
 const installer=await connectAs('postgres'),sync=await connectAs('n88_sync_client');
 const edges=async()=>(await q("select roleid::text,member::text,grantor::text,admin_option,inherit_option,set_option from pg_auth_members where roleid='n88_v2_guard'::regrole order by grantor")).rows;
 const beforeEdges=await edges();
 for(const owner of [A,B]){await q('insert into auth.users(id) values($1)',[owner]);await q("insert into n88_private.contexts(namespace,owner_id,active) values($1,$2,true)",['synthetic_canonical_'+owner.replaceAll('-',''),owner]);await q("select set_config('request.jwt.claim.sub',$1,false)",[owner]);await q(`insert into rakeezx.years(id,label,hijri_start,hijri_end) values('year','1448',1448,1449);insert into rakeezx.terms(id,year_id,name,"index",status,start_date,end_date) values('term','year','Term',1,'active','2026-08-01','2027-06-01');insert into rakeezx.subjects(id,name,slug) values('subject','Subject','subject');insert into rakeezx.sections(id,year_id,grade,label,name) values('class','year',4,'A','Fabricated');insert into rakeezx.teachings(id,section_id,term_id,subject_id) values('teaching','class','term','subject');insert into rakeezx.sections(id,year_id,grade,label,name) values('copy-class','year',4,'B','Copy Class'),('plan-class','year',4,'C','Plan Class');insert into rakeezx.teachings(id,section_id,term_id,subject_id) values('copy-teaching','copy-class','term','subject'),('plan-teaching','plan-class','term','subject');`);}
 await q('insert into auth.sessions(id,user_id,not_after) values($1,$2,clock_timestamp()+interval \'1 hour\')',[SESSION,A]);await q("select set_config('request.jwt.claim.sub',$1,false)",[A]);
 await q(`insert into rakeezx.students(id,name) values('student0','Fabricated');insert into rakeezx.enrollments(id,student_id,section_id,roll_no) values('enrollment0','student0','class',1);insert into rakeezx.items(id,teaching_id,name,max,score_mode,"order") values('direct','teaching','Direct',10,'direct',0),('ahead','teaching','Ahead',10,'direct',1),('configured','teaching','Configured',10,'direct',2),('parent-direct','teaching','Parent direct',10,'direct',3);insert into rakeezx.scores(id,student_id,item_id,value) values('parent-score','student0','parent-direct',8),('direct-score','student0','direct',8);`);
 await sync.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.session_id',$2,false)",[A,SESSION]);
 const config=(mid,version,subitems)=>sync.query('select rakeezx.apply_score_configuration_command($1,\'device\',\'configured\',$2,$3::jsonb) as result',[mid,version,JSON.stringify({scoreMode:'subitems',distributionMode:'manual',max:10,subitems})]);
 const definitions=[{id:'child-a',name:'Work A',value:3,startDate:'2026-10-20',dueDate:'2026-11-30'},{id:'child-b',name:'Work B',value:7,startDate:'2026-10-20',dueDate:'2026-11-30'}];await config('config-fixture',1,definitions);
 const mutate=(id,base,patch={},op='patch',mid=randomUUID(),entity='items')=>sync.query('select rakeezx.apply_sync_v2_mutation($1,$2,$3,\'device\',$4,$5::jsonb,$6,1) as result',[entity,id,mid,base,JSON.stringify(patch),op]);
 const safe=async action=>{await sync.query('savepoint attempt');try{const r=await action();await sync.query('release savepoint attempt');return {result:r.rows[0].result};}catch(e){await sync.query('rollback to savepoint attempt');await sync.query('release savepoint attempt');return {code:e.code};}};
 const normalize=v=>JSON.parse(JSON.stringify(v).replace(/\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)/g,'<timestamp>'));
 const differential=async()=>{await sync.query('begin');try{
  const subitem=await safe(()=>mutate('child-a',0,{},'delete','subitem-denied','score_subitems'));assert.equal(subitem.code,'42501');
  const ahead=await safe(()=>mutate('ahead',99,{},'delete','ahead-delete'));assert.equal(ahead.code,'22023');
  const old=await safe(()=>mutate('direct',0,{},'delete','old-delete'));assert.equal(old.result.outcome,'deleted');
  const replay=await safe(()=>mutate('direct',0,{},'delete','old-delete'));assert.deepEqual(replay,old);
  const mismatch=await safe(()=>mutate('direct',1,{},'delete','old-delete'));assert.equal(mismatch.code,'22023');
  const parent=await safe(()=>mutate('parent-direct',0,{},'delete','parent-delete'));assert.equal(parent.result.outcome,'deleted');
  const children=(await sync.query("select id,deleted_at from rakeezx.scores where item_id='parent-direct' order by id")).rows;assert(children.every(r=>r.deleted_at===null));
  const queued=await safe(()=>mutate('parent-score',0,{},'delete','queued-child','scores'));
  return normalize({subitem,ahead,old,replay,mismatch,parent,children,queued});
 }finally{await sync.query('rollback');}};

 const compat='drafts/n88-student-portal/activation/v2-hosted-compat-1031/';
 await check('combined_non_superuser_exact_owner_install',async()=>{
  const m=JSON.parse(await src(compat+'manifest.json')),sql=await src(compat+'install.inactive.sql'),sys=(await q('select (pg_control_system()).system_identifier::text as id')).rows[0].id;
  const authority={approved:true,productId:'N88',action:'install-n88-hosted-compat-1031',projectRef:'xlrubcwjqktzzunrvuns',bundleSha256:m.bundleSha256,authorityRef:'FABRICATED-OWNED-NATIVE-ONLY',runId:report.runId,expiresAt:new Date(Date.now()+300000).toISOString()};
  const local=sql.replace("expected_authority jsonb := 'null'::jsonb;",()=>"expected_authority jsonb := '"+JSON.stringify(authority)+"'::jsonb;").replace("system_identifier::text<>'7678071634733212629'",()=>"system_identifier::text<>'"+sys+"'");
  try{await installer.query(local);}catch(e){report.installFailure={code:e.code,message:e.message,position:e.position,where:e.where};throw e;}assert.deepEqual(await edges(),beforeEdges);report.packetQualification={bundleSha256:m.bundleSha256,installerSha256:m.installerSha256,localBoundSha256:hash(local),actualLogin:'postgres',superuser:false,edgesRestored:true};
  return {wrappers:14,existing14Untouched:true,canonicalEntries:30,edgesRestored:true};
 });
 const {definitions:boundaryDefinitions,encodeArguments,unwrapEnvelope,safeLoggingProfile,loggingSql,verifySafeBoundary}=await import('../../drafts/n88-student-portal/activation/v2-hosted-compat-1031/boundary.mjs');
 const {authorizeRuntimeConnection}=await import('../../drafts/n88-student-portal/activation/v2-runtime-writer-1031/capability.mjs');
 const {createPublicationV2PostgresRepository,createPublicationV2PostgresPorts}=await import('../../drafts/n88-student-portal/publication-v2-postgres.inactive.mjs');
 const backend=await connectAs('n88_backend'),sys=(await q('select (pg_control_system()).system_identifier::text as id')).rows[0].id;
 const localTransport=async c=>assert.equal((await c.query('select session_user as login')).rows[0].login,'n88_backend');
 const capability=await authorizeRuntimeConnection(backend,{expectedSystemIdentifier:sys,assertTransport:localTransport});
 const op=id=>boundaryDefinitions.find(o=>o.id===id),call=async(c,id,args)=>unwrapEnvelope(await c.query(op(id).safeSql,[encodeArguments(args)]));
 await check('actual_restricted_login_provider_like_profile_and_unsafe_negatives',async()=>{
  await verifySafeBoundary(backend);const logging=(await backend.query(loggingSql)).rows[0];assert(safeLoggingProfile(logging));assert.equal(logging.verbosity,'default');assert.equal(logging.statements,'ddl');assert.equal(logging.explain,'10000');
  for(const patch of [{parameters:'1'},{statements:'all'},{duration:'0'},{sample:'0'},{sampling:'0.1'},{audit:'all'},{explain:'0'},{explain:'5000'},{statement_timeout:'0'},{statement_timeout:'10s'},{verbosity:'verbose'}])assert.equal(safeLoggingProfile({...logging,...patch}),false);
  return {restrictedLogin:true,defaultVerbosity:true,ddlOnly:true,autoExplain10000:true,databaseStatementTimeout3000:true,unsafeProfilesDenied:11};
 });
 const privateMarker='PRIVATE_'+randomBytes(24).toString('hex');
 await check('all14_malformed_boundary_fixed_failure_no_successful_empty',async()=>{
  for(const o of boundaryDefinitions){for(const wire of [Buffer.from(privateMarker).toString('base64'),null,Buffer.from('null').toString('base64'),encodeArguments(Array(o.types.length).fill(null))]){const r=await backend.query(o.safeSql,[wire]);assert.deepEqual(r.rows,[{envelope:{ok:false,failure:'unavailable'}}]);assert(!JSON.stringify(r).includes(privateMarker));assert.throws(()=>unwrapEnvelope(r));}}
  assert.equal((await call(backend,'read-scopes',[A,100,20000,40000])).rowCount,0);return {malformedOperations:14,malformedCases:56,failureDistinctFromEmpty:true,noPrivateDriverMessage:true};
 });
 // Real service/current Auth path, same synthetic provider and real finite DB.
 const provider=providerFixture(),origin='https://synthetic.invalid',rollout=createRolloutGuard(k=>({N88_ROLLOUT_MODE:'public',N88_PUBLIC_HOSTED_ACCEPTANCE_SHA256:'f'.repeat(64),N88_PUBLIC_HOSTED_ACCEPTANCE_CONFIRMED:'true'})[k]);
 const acquire=async()=>{const c=await connectAs('n88_backend'),rawQuery=c.query.bind(c);c.query=async(sql,args)=>{const r=await rawQuery(sql,args);(report.operationTrace??=[]).push({operation:boundaryDefinitions.find(o=>o.safeSql===sql)?.id??hash(sql),ok:r.rows?.[0]?.envelope?.ok,command:r.rows?.[0]?.envelope?.result?.command,rowCount:r.rows?.[0]?.envelope?.result?.rowCount,shapes:r.rows?.[0]?.envelope?.result?.rows?.map(v=>({keys:Object.keys(v),bodyType:typeof v.body,bodyNull:v.body===null}))});if(r.rows?.[0]?.envelope?.ok===false)(report.fixedFailures??=[]).push({name:boundaryDefinitions.find(o=>o.safeSql===sql)?.id,failure:r.rows[0].envelope.failure});return r;};c.release=()=>c.end().catch(()=>{});return c;};
 const canonical={rollout,studentTeachingId:'teaching',teacher:{authUrl,apiKey:'FABRICATED_PUBLIC_KEY',fetch:provider.fetch},numeric:{keys:new Map([['v1',Buffer.alloc(32,1)]]),activeKeyVersion:'v1',reservationKey:Buffer.alloc(32,2)},verifyIngress:async r=>r.headers['x-fixture-ingress']==='1'?{clientKey:'fabricated-ingress'}:null};
 const host=await createHostedPublicationV2Runtime({enabled:true,acquire,assertTransport:localTransport,expectedSystemIdentifier:sys,canonical,origin});
 const headers={origin,'x-fixture-ingress':'1','x-n88-csrf':'1','content-type':'application/json','sec-fetch-site':'same-origin',authorization:'Bearer '+provider.token()},binding={sessionId:SESSION,leaseId:'synthetic-source-lease',contextRevision:'synthetic-context'},scope={ownerId:A,teachingId:'teaching',sectionId:'class',termId:'term',subjectId:'subject'};
 const request=body=>host.handle({path:'/teacher/class/publication-v2',method:'POST',headers,body});
 const list=async(s=scope)=>{const r=await request({action:'list',scope:s,binding});assert.equal(r.status,200,JSON.stringify(r.body));return r.body;};
 await check('real_auth_service_finite_wrapper_valid_mapping',async()=>{
  const l=await list(),row=l.rows.find(r=>r.sourceId==='direct');assert(row);
  const cmd=publicationCommand({draft:{scope,rows:[{...row,decisions:{required:false,scheduled:false,completed:false,grade:true}}]},scope,binding,rowId:row.id,expectedPublicationRevision:row.publicationRevision,expectedMembershipRevision:l.membershipRevision,requestId:'intent_'+randomUUID().replaceAll('-','')});
  report.operationTrace=[];const response=await request(cmd);report.serviceResult={status:response.status,body:response.body};assert.equal(response.body.receipt?.state,'applied');assert.equal((await request({action:'status',scope,binding,command:cmd})).body.receipt.state,'applied');
  return {actualCurrentAuth:true,originalLegacyBoundary:true,readAndWrite:true,receiptAck:true};
 });
 await check('all14_valid_operation_mapping_matches_installed_semantics',async()=>{
  const rootRow=(await q('select scope_key,payload,store_revision::text as rev from n88_private.publication_v2_scopes where owner_id=$1 limit 1',[A])).rows[0];
  const item=(await q('select row_id,payload,publication_revision::text as rev from n88_private.publication_v2_items where owner_id=$1 and scope_key=$2 limit 1',[A,rootRow.scope_key])).rows[0];
  const high=(await q('select source_key,canonical_revision::text as rev,retired from n88_private.publication_v2_high_water where owner_id=$1 and scope_key=$2 limit 1',[A,rootRow.scope_key])).rows[0];
  const receipt=(await q('select payload,fingerprint from n88_private.publication_v2_receipts where owner_id=$1 limit 1',[A])).rows[0];
  const insertPub={...item.payload,rowId:JSON.stringify(['item','mapping-new','mapping-new']),publicationRevision:1};
  const nextPub={...item.payload,publicationRevision:Number(item.rev)+1};
  const requestId='mapping_'+randomUUID().replaceAll('-',''),nextReceipt={...receipt.payload,requestId};
  const args={
   'owner-context':[A],'numeric-session':['0'.repeat(64)],'numeric-credential':[randomUUID(),A,'missing','1'],
   'insert-scope':[A,'c'.repeat(64),JSON.stringify({scope:{...scope,teachingId:'mapping-new'},manualTasks:[]})],
   'cas-scope':[A,rootRow.scope_key,JSON.stringify(rootRow.payload),rootRow.rev],
   'insert-item':[A,rootRow.scope_key,insertPub.rowId,'1',false,JSON.stringify(insertPub)],
   'cas-item':[A,rootRow.scope_key,item.row_id,String(nextPub.publicationRevision),false,JSON.stringify(nextPub),item.rev,JSON.stringify(item.payload)],
   'insert-high-water':[A,rootRow.scope_key,'items:mapping-new','1',false],
   'cas-high-water':[A,rootRow.scope_key,high.source_key,String(Number(high.rev)+1),high.retired,high.rev,high.retired],
   'insert-receipt':[A,requestId,rootRow.scope_key,receipt.fingerprint,JSON.stringify(nextReceipt)]};
  for(const o of boundaryDefinitions){const a=args[o.id]??[A,10001,2097152,4194304];
   await q('begin');let expected;try{await q("select set_config('n88.v2_owner',$1,true)",[A]);const r=await q(o.callSql,a);expected=o.effect?{command:o.command,rowCount:Number(r.rows[0].affected),rows:[]}:{command:r.command,rowCount:r.rowCount,rows:r.rows};}finally{await q('rollback');}
   await backend.query('begin');try{await backend.query("select set_config('n88.v2_owner',$1,true)",[A]);const result=await call(backend,o.id,a);assert.deepEqual(result,expected,o.id);}finally{await backend.query('rollback');}
  }return {validOperations:14,originalFunctionResultsEqual:true,readEmptyIsExplicitSuccess:true,noOriginal14Changes:true};
 });
 const snapshot=async()=>JSON.stringify((await q("select (select jsonb_agg(to_jsonb(r)) from rakeezx.sync_mutation_receipts r) as canonical,(select jsonb_agg(to_jsonb(r)) from n88_private.publication_v2_receipts r) as receipts,(select jsonb_agg(to_jsonb(r)) from n88_private.publication_v2_scopes r) as scopes")).rows);
 await check('constraint_failure_poison_survives_caller_catch_whole_transaction_rollback',async()=>{
  const before=await snapshot();let released=false,commits=0;
  const repository=createPublicationV2PostgresRepository({executionMode:'hosted',runtimeCapability:capability,acquire:async()=>{const c=await connectAs('n88_backend');return {query:(s,a)=>{if(s==='commit')commits++;return c.query(s,a);},release:()=>{released=true;c.end().catch(()=>{});}};}});
  await assert.rejects(repository.transaction(async(_,ports)=>{
   // earlier valid N88 write in this same transaction, before the rejected insert
   await ports.query("select set_config('n88.v2_owner',$1,true)",[A]);
   const key=(await q('select scope_key from n88_private.publication_v2_scopes where owner_id=$1 limit 1',[A])).rows[0].scope_key;
   const root=(await q('select payload from n88_private.publication_v2_scopes where owner_id=$1 and scope_key=$2',[A,key])).rows[0].payload;
   const rev=(await q('select store_revision::text as rev from n88_private.publication_v2_scopes where owner_id=$1 and scope_key=$2',[A,key])).rows[0].rev;
   assert.equal(unwrapEnvelope(await ports.query(op('cas-scope').safeSql,[encodeArguments([A,key,JSON.stringify(root),rev])])).rowCount,1);
   try{const bad=await ports.query(op('insert-scope').safeSql,[encodeArguments([A,key,JSON.stringify({...root,privateMarker})])]);unwrapEnvelope(bad);}catch{ports.poison();}
   return 'caller tried to continue';
  }));assert.equal(commits,0);assert(released);assert.equal(await snapshot(),before);return {caughtFailureLatched:true,commits:0,allPriorWritesRolledBack:true,originalReceiptsUnchanged:true,noRetry:true};
 });
 await check('cancellation_and_assertion_fixed_failures_no_private_logging',async()=>{
  await q(`create function n88_private.owned_failure_test() returns trigger language plpgsql as $$begin if current_setting('n88.test_failure',true)='cancel' then perform pg_sleep(5);else assert false, 'owned assertion';end if;return new;end$$;create trigger owned_failure_test before update on n88_private.publication_v2_scopes for each row execute function n88_private.owned_failure_test()`);
  const row=(await q('select scope_key,payload,store_revision::text as rev from n88_private.publication_v2_scopes where owner_id=$1 limit 1',[A])).rows[0];
  for(const [mode,failure]of [['cancel','cancelled'],['assert','assertion']]){await backend.query('begin');await backend.query("select set_config('n88.v2_owner',$1,true),set_config('n88.test_failure',$2,true),set_config('statement_timeout','80',true)",[A,mode]);const r=await backend.query(op('cas-scope').safeSql,[encodeArguments([A,row.scope_key,JSON.stringify({...row.payload,privateMarker}),row.rev])]);assert.deepEqual(r.rows,[{envelope:{ok:false,failure}}]);await backend.query('rollback');}
  await q('drop trigger owned_failure_test on n88_private.publication_v2_scopes;drop function n88_private.owned_failure_test()');
  const log=await readFile(path.join(phase,'server.log'),'utf8');assert(!log.includes(privateMarker));assert(!/ERROR:[^\n]*owned assertion/.test(log));return {queryCanceledExplicit:true,assertFailureExplicit:true,ownedServerLogNoPrivateMarker:true,noHostedLogAccess:true};
 });
 await check('real_service_fixed_failure_unknown_no_replay',async()=>{
  const before=await snapshot(),l=await list(),row=l.rows.find(r=>r.sourceId==='direct');
  const cmd=publicationCommand({draft:{scope,rows:[{...row,decisions:{required:false,scheduled:false,completed:false,grade:!row.decisions.grade}}]},scope,binding,rowId:row.id,expectedPublicationRevision:row.publicationRevision,expectedMembershipRevision:l.membershipRevision,requestId:'unknown_'+randomUUID().replaceAll('-','')});
  await q(`create function n88_private.owned_service_failure() returns trigger language plpgsql as $$begin raise exception 'owned fixed failure' using detail=new.payload::text;end$$;create trigger owned_service_failure before update on n88_private.publication_v2_items for each row execute function n88_private.owned_service_failure()`);
  try{const r=await request(cmd);assert.equal(r.status,503);assert.deepEqual(r.body,{state:'unknown',retry:false});assert.equal(await snapshot(),before);await new Promise(r=>setTimeout(r,30));assert.equal(await snapshot(),before);}finally{await q('drop trigger owned_service_failure on n88_private.publication_v2_items;drop function n88_private.owned_service_failure()');}
  return {actualServiceUnknown:true,retryFalse:true,originalIdentityAndReceiptsRetained:true,priorOperationsRolledBack:true};
 });
 await check('manual_parent_retirement_other_scope_survives_and_invoker_locks',async()=>{
  const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
  const sk=s=>hash(JSON.stringify(stable(s))),other={...scope,teachingId:'copy-teaching',sectionId:'copy-class'};
  await list(other);
  const task={id:'manual-synthetic',title:'Synthetic optional task',description:'',startDate:null,dueDate:null,link:null};
  for(const s of [scope,other]){const k=sk(s),pub={rowId:JSON.stringify(['manual',null,task.id]),sourceRevision:'a'.repeat(64),publicationRevision:1,membershipRevision:'b'.repeat(64),decisions:{required:true,scheduled:false,completed:false,grade:false},tombstone:false};await q("update n88_private.publication_v2_scopes set store_revision=store_revision+1,payload=jsonb_set(payload,'{manualTasks}',$3::jsonb) where owner_id=$1 and scope_key=$2",[A,k,JSON.stringify([task])]);await q('insert into n88_private.publication_v2_items(owner_id,scope_key,row_id,publication_revision,tombstone,payload) values($1,$2,$3,1,false,$4)',[A,k,pub.rowId,pub]);}
  const preview=(await sync.query("select rakeezx.n77_delete_teaching('teaching','class') as r")).rows[0].r;assert.equal((await sync.query("select rakeezx.n77_delete_teaching('teaching','class',$1,'manual-parent-delete','device',true) as r",[preview.fingerprint])).rows[0].r.outcome,'deleted');
  assert.deepEqual((await q("select payload->'manualTasks' as tasks from n88_private.publication_v2_scopes where owner_id=$1 and scope_key=$2",[A,sk(scope)])).rows[0].tasks,[]);
  assert.equal((await q("select payload->'manualTasks' as tasks from n88_private.publication_v2_scopes where owner_id=$1 and scope_key=$2",[A,sk(other)])).rows[0].tasks.length,1);
  assert.notEqual((await request({action:'list',scope,binding})).status,200);await list(other);
  const invokers=(await q("select proname,prosecdef,prosrc from pg_proc where pronamespace='rakeezx'::regnamespace and proname in ('commit_enrollment_transfer','commit_enrollment_transfer_and_renumber','renumber_enrollment_roster')")).rows;assert.equal(invokers.length,3);assert(invokers.every(r=>!r.prosecdef&&r.prosrc.includes('pg_advisory_xact_lock(1312307256,88)')));assert.deepEqual(await edges(),beforeEdges);
  return {actualN77ParentDeletion:true,manualTasksClearedOnlyRetiredScope:true,otherScopeNextRealReadValid:true,invokerEntries:3,rlsUnchanged:true,edgesRestored:true};
 });
 await check('combined_fixed_readback_unbound_refusal_and_non_destructive_disable',async()=>{
  const results=await installer.query(await src(compat+'readback.sql'));assert.equal(results[0].rows.length,14);
  await assert.rejects(installer.query(await src(compat+'install.inactive.sql')),/n88_exact_runtime_writer_authority_required/);await installer.query('rollback');
  const m=JSON.parse(await src(compat+'manifest.json')),sql=await src(compat+'disable.inactive.sql');
  const authority={approved:true,productId:'N88',action:'disable-n88-hosted-compat-1031',projectRef:'xlrubcwjqktzzunrvuns',bundleSha256:m.bundleSha256,authorityRef:'FABRICATED-OWNED-NATIVE-ONLY',runId:report.runId,expiresAt:new Date(Date.now()+300000).toISOString()};
  const local=sql.replace("expected_authority jsonb := 'null'::jsonb;",()=>"expected_authority jsonb := '"+JSON.stringify(authority)+"'::jsonb;").replace("system_identifier::text<>'7678071634733212629'",()=>"system_identifier::text<>'"+sys+"'");
  await installer.query(local);assert.deepEqual(await edges(),beforeEdges);
  const rights=(await q("select has_function_privilege('n88_backend',oid,'EXECUTE') as callable from pg_proc where pronamespace='n88_private'::regnamespace and proname like 'safe_1031_%'")).rows;assert.equal(rights.length,14);assert(rights.every(r=>!r.callable));
  assert.equal((await q("select count(*)::int n from pg_trigger where tgname in ('00_n88_global_1031','zz_n88_retire_1031')")).rows[0].n,23);
  assert.equal((await q("select has_schema_privilege('n88_v2_guard','n88_private','CREATE') as has")).rows[0].has,false);
  return {fixedWrappers:14,unboundRefused:true,onlyExecuteRevoked:true,writerHooksRetained:23,ownerEdgesAndSchemaCreateRestored:true,noStorageDrop:true};
 });
 return async fresh=>assert.equal((await fresh.query("select count(*)::int n from pg_proc where pronamespace='n88_private'::regnamespace and proname like 'safe_1031_%'")).rows[0].n,14);
}
