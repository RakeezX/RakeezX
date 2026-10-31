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
export async function qualify({root,admin,report,Client,port,clients}){
 const q=(s,a=[])=>admin.query(s,a).catch(e=>{report.nativeError={code:e.code,message:e.message,statementSha256:hash(s)};throw e;}),src=async p=>(await readFile(path.join(root,p),'utf8')).replace(/^\uFEFF/,'');
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
 // Runtime privilege delta is qualified below through a real non-superuser installer LOGIN.
 if(!process.argv.includes('--install-only'))await q(await src('drafts/n88-student-portal/activation/v2-runtime-writer-1031/writer-helpers.sql'));
 const observed=JSON.parse(await src('drafts/n88-student-portal/activation/v2-runtime-writer-1031/observed-writer.json'));
 // Repository wrapper LF == observed wrapper CRLF after normalization. Keep the
 // exact provider definition bytes in this fixture; no Product guard removed.
 for(const row of observed.rows)await q(row.definition);
 const baseline=(await q(`select encode(sha256(convert_to(pg_get_functiondef('rakeezx.apply_sync_v2_mutation(text,text,text,text,bigint,jsonb,text,bigint)'::regprocedure),'UTF8')),'hex') as hash`)).rows[0].hash;
 assert.equal(baseline,'76084d0bb32cad6751c2f02a7ed03269cba7be374c2f7248aef305f2b66bda11');report.writerBaseline={publicWrapper:baseline,sourceWrapperPreserved:true};
 if(!process.argv.includes('--install-only'))await q(await src('drafts/n88-student-portal/activation/v2-runtime-writer-1031/writer-replacement.sql'));
 const password=randomBytes(32).toString('hex');await q(`alter role n88_backend login password '${password}';create role n88_sync_client login password '${password}' inherit;grant authenticated to n88_sync_client`);
 const connectAs=async role=>{const c=new Client({host:'127.0.0.1',port,database:'postgres',user:role,password,ssl:false,connectionTimeoutMillis:3000,query_timeout:10000});c.on('error',()=>{});clients.add(c);await c.connect();return c;};
 await q('reset role');await q(`alter role n88_backend set log_error_verbosity='terse';alter role postgres nosuperuser bypassrls createrole createdb login password '${password}';grant execute on function pg_catalog.pg_control_system() to postgres;grant n88_v2_guard to postgres with admin true,inherit false,set false;`);
 const installer=await connectAs('postgres');const beforeEdges=(await q("select roleid::text,member::text,grantor::text,admin_option,inherit_option,set_option from pg_auth_members where roleid='n88_v2_guard'::regrole order by grantor")).rows;
 if(process.argv.includes('--install-only')){
  await check('full_exact_install_delta_single_native_transaction',async()=>{
   const m=JSON.parse(await src('drafts/n88-student-portal/activation/v2-runtime-writer-1031/manifest.json')),sql=await src('drafts/n88-student-portal/activation/v2-runtime-writer-1031/install.inactive.sql');
   const localId=(await q('select (pg_control_system()).system_identifier::text as value')).rows[0].value;
   const authority={approved:true,productId:'N88',action:'install-n88-runtime-writer-1031',projectRef:m.projectRef,bundleSha256:m.bundleSha256,authorityRef:'FABRICATED-OWNED-LOCAL-ONLY',runId:'fac941dc-b3df-4d7a-bf59-57918a1bb9d7',expiresAt:new Date(Date.now()+300000).toISOString()};
   const local=sql.replace("expected_authority jsonb := 'null'::jsonb;",()=>"expected_authority jsonb := '"+JSON.stringify(authority)+"'::jsonb;").replace("system_identifier::text<>'7678071634733212629'",()=>"system_identifier::text<>'"+localId+"'");
   assert(local!==sql);await installer.query(local);
   assert.deepEqual((await q("select roleid::text,member::text,grantor::text,admin_option,inherit_option,set_option from pg_auth_members where roleid='n88_v2_guard'::regrole order by grantor")).rows,beforeEdges);
   assert.equal((await q("select count(*)::int n from pg_proc where pronamespace='n88_private'::regnamespace and proname ~ '^v2_[a-f0-9]{24}$' and has_function_privilege('n88_backend',oid,'EXECUTE')")).rows[0].n,14);
   report.installQualification={sourceInstallerSha256:hash(sql),ownedLocalBoundSha256:hash(local),bundleSha256:m.bundleSha256,explicitLocalPhysicalIdBinding:true,actualInstallerLogin:'postgres',superuser:false,hostedExecution:false};
   return {singleBeginCommit:true,exactDeltaUnchanged:true,sevenPostidentitiesAndAcls:true,ownerEdgesRestored:true,noStorageReinstall:true};
  });return async fresh=>assert.equal((await fresh.query("select count(*)::int n from pg_proc where pronamespace='n88_private'::regnamespace and proname='v2_runtime_identity_1031'")).rows[0].n,1);
 }
 await installer.query('begin');try{await installer.query(await src('drafts/n88-student-portal/activation/v2-runtime-writer-1031/runtime-role.sql'));}catch(e){report.changedGrantError={code:e.code,message:e.message,where:e.where};throw e;}await installer.query('commit');
 assert.deepEqual((await q("select roleid::text,member::text,grantor::text,admin_option,inherit_option,set_option from pg_auth_members where roleid='n88_v2_guard'::regrole order by grantor")).rows,beforeEdges);report.changedGrantQualification={actualLogin:'postgres',superuser:false,grantor:'n88_v2_guard',membershipRestored:true,newLoginOrMembershipAtRest:false};
 if(process.argv.includes('--disable-only')){
  await check('exact_disable_existing_owner_transaction_and_rollback',async()=>{
   const sql=await src('drafts/n88-student-portal/activation/v2-runtime-writer-1031/disable.sql');
   await assert.rejects(installer.query(sql),/n88_exact_runtime_writer_authority_required/);await installer.query('rollback');
   const body=sql.slice(sql.indexOf('-- BEGIN EXACT DISABLE DELTA'),sql.indexOf('-- END EXACT DISABLE DELTA'));
   await installer.query('begin');await installer.query(body);
   assert.equal((await installer.query("select has_function_privilege('n88_backend','n88_private.v2_runtime_identity_1031()','EXECUTE') as allowed")).rows[0].allowed,false);
   assert.equal((await installer.query("select count(*)::int n from pg_proc where pronamespace='n88_private'::regnamespace and proname ~ '^v2_[a-f0-9]{24}$' and has_function_privilege('n88_backend',oid,'EXECUTE')")).rows[0].n,0);
   await installer.query('rollback');assert.deepEqual((await q("select roleid::text,member::text,grantor::text,admin_option,inherit_option,set_option from pg_auth_members where roleid='n88_v2_guard'::regrole order by grantor")).rows,beforeEdges);
   return {actualInstallerLogin:'postgres',superuser:false,allFifteenCallsRevoked:true,ownerEdgesRestored:true,rollbackRestoresPermissions:true,unboundHostedTargetRefused:true};
  });return async fresh=>assert.equal((await fresh.query("select has_function_privilege('n88_backend','n88_private.v2_runtime_identity_1031()','EXECUTE') as allowed")).rows[0].allowed,true);
 }
 const backend=await connectAs('n88_backend'),sync=await connectAs('n88_sync_client');
 const sys=(await q(`select (pg_control_system()).system_identifier::text as id`)).rows[0].id;
 const assertTransport=async c=>{const r=(await c.query('select current_user as role,session_user as login,host(inet_server_addr()) as host,inet_server_port() as port')).rows[0];assert.deepEqual(r,{role:'n88_backend',login:'n88_backend',host:'127.0.0.1',port});};
 await check('actual_restricted_login_reset_set_and_raw_privilege_denials',async()=>{
  await backend.query('reset role');await assertTransport(backend);
  for(const s of ['set role n88_v2_runtime','set role n88_v2_guard','set role n88_guard','set role n88_local_admin','select * from auth.users','select * from n88_private.publication_v2_items'])await assert.rejects(backend.query(s),e=>e.code==='42501');
  return {actualSessionUser:'n88_backend',resetRoleRetainsRestrictedLogin:true,noPrivilegedSetRole:true,noRawAuthOrV2:true};
 });
 for(const owner of [A,B]){
  await q('insert into auth.users(id) values($1)',[owner]);await q("insert into n88_private.contexts(namespace,owner_id,active) values($1,$2,true)",['synthetic_canonical_'+owner.replaceAll('-',''),owner]);
  await q(`select set_config('request.jwt.claim.sub',$1,false)`,[owner]);
  await q(`insert into rakeezx.years(id,label,hijri_start,hijri_end) values('year','1448',1448,1449);
   insert into rakeezx.terms(id,year_id,name,"index",status,start_date,end_date) values('term','year','Term',1,'active','2026-08-01','2027-06-01');
   insert into rakeezx.subjects(id,name,slug) values('subject','Subject','subject');insert into rakeezx.sections(id,year_id,grade,label,name) values('class','year',4,'A','Fabricated');
   insert into rakeezx.teachings(id,section_id,term_id,subject_id) values('teaching','class','term','subject');
   insert into rakeezx.items(id,teaching_id,name,max,score_mode,"order") values('direct','teaching','Direct',10,'direct',0);`);
 }
 await q('insert into auth.sessions(id,user_id,not_after) values($1,$2,clock_timestamp()+interval \'1 hour\')',[SESSION,A]);
 await q("select set_config('request.jwt.claim.sub',$1,false)",[A]);
 await q(`insert into rakeezx.students(id,name) values('student0','Fabricated');insert into rakeezx.enrollments(id,student_id,section_id,roll_no) values('enrollment0','student0','class',1);
 insert into rakeezx.scores(id,student_id,item_id,value) values('score0','student0','direct',8);
 begin;select set_config('rakeezx.score_domain_write','on',true);
 insert into rakeezx.items(id,teaching_id,name,max,score_mode,"order") values('cascade','teaching','Parent',10,'subitems',1);
 insert into rakeezx.score_subitems(id,item_id,name,value,"order",start_date,due_date) values('child-a','cascade','Work A',3,0,'2026-10-20','2026-11-30'),('child-b','cascade','Work B',7,1,'2026-10-20','2026-11-30');
 insert into rakeezx.score_subitem_completions(id,student_id,subitem_id,checked) values('ca','student0','child-a',true),('cb','student0','child-b',true);
 select rakeezx.recompute_subitem_score('${A}','cascade','student0','fixture');commit;`);
 const studentToken=randomBytes(32).toString('base64url'),credentialId=randomUUID(),numericSession=randomUUID();
 const credential={id:credentialId,ownerId:A,studentId:'student0',version:1,format:'six-v1',keyVersion:'v1',reservation:hash(credentialId),verifier:'1'.repeat(64),revokedAt:null};
 const numericPayload={id:numericSession,credentialId,ownerId:A,studentId:'student0',classId:'class',enrollmentId:'enrollment0',membershipRevision:1,canonicalStamp:hash(JSON.stringify(['n88-lineage-v1','1','1','1','1'])),version:1,tokenHash:hash(studentToken),expiresAt:Date.now()+3600000,revokedAt:null};
 await q('insert into n88_private.numeric_credentials(row_key,payload) values($1,$2::jsonb)',[credentialId,JSON.stringify(credential)]);await q('insert into n88_private.numeric_sessions(row_key,payload) values($1,$2::jsonb)',[numericSession,JSON.stringify(numericPayload)]);
 const provider=providerFixture(),origin='https://synthetic.invalid',rollout=createRolloutGuard(k=>({N88_ROLLOUT_MODE:'public',N88_PUBLIC_HOSTED_ACCEPTANCE_SHA256:'f'.repeat(64),N88_PUBLIC_HOSTED_ACCEPTANCE_CONFIRMED:'true'})[k]);
 const canonical={rollout,studentTeachingId:'teaching',teacher:{authUrl,apiKey:'FABRICATED_PUBLIC_KEY',fetch:provider.fetch},numeric:{keys:new Map([['v1',Buffer.alloc(32,1)]]),activeKeyVersion:'v1',reservationKey:Buffer.alloc(32,2)},verifyIngress:async r=>r.headers['x-fixture-ingress']==='1'?{clientKey:'fabricated-ingress'}:null};
 const calls=[],control={loseAck:false,gate:null};
 const acquire=async()=>{const c=await connectAs('n88_backend'),raw=c.query.bind(c);c.query=async(s,a)=>{calls.push(s);report.lastRuntimeSql={sha256:hash(s),prefix:s.slice(0,130)};report.runtimeTrace??=[];report.runtimeTrace.push(report.lastRuntimeSql);if(report.runtimeTrace.length>45)report.runtimeTrace.shift();let r;try{r=await raw(s,a);}catch(e){report.runtimeSqlError={code:e.code,message:e.message};throw e;}if(control.gate&&s==='select pg_advisory_xact_lock(1312307256, 88)'){const g=control.gate;control.gate=null;g.enter(c.processID);await g.wait;}if(s==='commit'&&control.loseAck){control.loseAck=false;throw Error('fabricated_lost_ack');}return r;};c.release=()=>{c.end().catch(()=>{});};return c;};
 const host=await createHostedPublicationV2Runtime({enabled:true,acquire,assertTransport,expectedSystemIdentifier:sys,canonical,origin});
 const headers={origin,'x-fixture-ingress':'1','x-n88-csrf':'1','content-type':'application/json','sec-fetch-site':'same-origin',authorization:'Bearer '+provider.token()};
 const binding={sessionId:SESSION,leaseId:'synthetic-v2-source-lease',contextRevision:'synthetic-context-v1'},scope={ownerId:A,teachingId:'teaching',sectionId:'class',termId:'term',subjectId:'subject'};
 const request=body=>host.handle({path:'/teacher/class/publication-v2',method:'POST',headers,body});
 const list=async()=>{const r=await request({action:'list',scope,binding});report.providerPaths=provider.calls;assert.equal(r.status,200,JSON.stringify(r.body));return r.body;};
 const command=(l,id='direct',decisions={required:false,scheduled:false,completed:false,grade:true})=>{const row=l.rows.find(r=>r.sourceId===id);assert(row);return publicationCommand({draft:{scope,rows:[{...row,decisions}]},scope,binding,rowId:row.id,expectedPublicationRevision:row.publicationRevision,expectedMembershipRevision:l.membershipRevision,requestId:'intent_'+randomUUID().replaceAll('-','')});};
 const student=()=>host.handle({path:'/student/publication-v2/read',method:'GET',headers:{...headers,cookie:'__Secure-n88-student='+studentToken}});
 await sync.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.session_id',$2,false)",[A,SESSION]);
 const mutate=async(id,base,patch={},op='patch',mutation=randomUUID())=>(await sync.query("select rakeezx.apply_sync_v2_mutation('items',$1,$2,'device',$3,$4::jsonb,$5,1) as result",[id,mutation,base,JSON.stringify(patch),op])).rows[0].result;
 const qualifyLostWriteAck=async id=>{
  const cmd=command(await list(),id),commits=calls.filter(s=>s==='commit').length;control.loseAck=true;
  const r=await request(cmd);assert.equal(r.status,503);assert.deepEqual(r.body,{state:'unknown',retry:false});assert.equal(calls.filter(s=>s==='commit').length,commits+1);
  const receipt=(await q('select payload from n88_private.publication_v2_receipts where owner_id=$1 and request_id=$2',[A,cmd.requestId])).rows[0].payload;assert.equal(receipt.state,'applied');
  const lookup=await request({action:'status',scope,binding,command:cmd});assert.equal(lookup.status,200);assert.deepEqual(lookup.body.receipt,receipt);
  assert.deepEqual((await q('select payload from n88_private.publication_v2_receipts where owner_id=$1 and request_id=$2',[A,cmd.requestId])).rows[0].payload,receipt);
  return {unknown:true,noAutomaticRetry:true,actualPublicationCommittedOnce:true,immutableOriginalReceipt:true,readOnlyStatusReconciles:true};
 };
 if(process.argv.includes('--ack-only')){await check('lost_actual_publication_write_ack_read_only_reconciliation',()=>qualifyLostWriteAck('direct'));return async fresh=>assert.equal((await fresh.query('select count(*)::int n from n88_private.publication_v2_receipts')).rows[0].n,1);}
 await check('actual_numeric_entry_current_pupil_privacy_and_independent_grades',async()=>{
  const l=await list();assert.equal((await request(command(l,'direct'))).body.receipt.state,'applied');
  assert.equal((await request(command(await list(),'child-a'))).body.receipt.state,'applied');
  const r=await student();assert.equal(r.status,200,JSON.stringify(r.body));assert.deepEqual(Object.fromEntries(r.body.grades.map(g=>[g.title,g.value])),{Direct:8,'Work A':3});
  assert(!JSON.stringify(r.body).match(/"(?:total|rank|raw|ownerId|studentId)":/));assert(!r.body.grades.some(g=>g.title==='Parent'||g.title==='Work B'));
  return {actualNumericRead:true,currentPupilOnly:true,withheldGradeAndAggregateAbsent:true};
 });
 await check('assembled_service_original_auth_and_full_rpc_edit_conflict_receipt',async()=>{
  const l=await list(),cmd=command(l);assert.equal((await request(cmd)).body.receipt.state,'applied');
  const rev=(await q("select revision::text from rakeezx.items where owner_id=$1 and id='direct'",[A])).rows[0].revision;
  const mid=randomUUID(),r=await mutate('direct',rev,{name:'Renamed'},'patch',mid);assert.equal(r.outcome,'applied');
  assert.deepEqual(await mutate('direct',rev,{name:'Renamed'},'patch',mid),r);
  await assert.rejects(mutate('direct',rev,{name:'Different'},'patch',mid),e=>e.code==='22023');
  const stale=await request({action:'status',scope,binding,command:cmd});assert.equal(stale.body.fresh,null);
  const conflict=await mutate('direct',rev,{name:'Stale'});assert.equal(conflict.outcome,'conflict');
  assert.equal((await q('select count(*)::int n from n88_private.publication_v2_items where owner_id=$1 and tombstone',[A])).rows[0].n,0);
  const privateBefore=(await q('select jsonb_agg(to_jsonb(p) order by row_id) as value from n88_private.publication_v2_items p where owner_id=$1',[A])).rows[0].value;
  const noOp=await mutate('direct',r.resultRevision,{name:'Renamed'});assert.equal(noOp.resultRevision,r.resultRevision);
  assert.deepEqual((await q('select jsonb_agg(to_jsonb(p) order by row_id) as value from n88_private.publication_v2_items p where owner_id=$1',[A])).rows[0].value,privateBefore);
  return {fullOriginalRpc:true,originalEnvelopeReplay:true,differingEnvelopeDenied:true,sourceEditInvalidates:true,conflictNoTombstone:true,noOpDoesNotInvalidate:true};
 });
 await check('full_rpc_delete_retirement_receipt_and_restore_no_revival',async()=>{
  const l=await list(),cmd=command(l);assert.equal((await request(cmd)).body.receipt.state,'applied');
  const before=(await q("select to_jsonb(i) row from rakeezx.items i where owner_id=$1 and id='direct'",[A])).rows[0].row;
  const result=await mutate('direct',before.revision,{},'delete');assert.equal(result.outcome,'deleted');
  assert.equal((await q('select count(*)::int n from n88_private.publication_v2_items where owner_id=$1 and tombstone',[A])).rows[0].n,1);
  assert.equal((await request({action:'status',scope,binding,command:cmd})).body.fresh,null);
  const manifest=(await sync.query('select rakeezx.sync_v2_restore_manifest_score_v2($1::uuid) as value',[A])).rows[0].value;
  const patch={teaching_id:'teaching',name:before.name,max:10,score_mode:'direct',order:0};
  const stage=async(id,recordId)=>(await sync.query('select rakeezx.stage_sync_v2_restore_score_v2($1,$2,5,$3::jsonb,$4::jsonb) as result',[id,'f'.repeat(64),JSON.stringify(manifest),JSON.stringify([{entity:'items',recordId,operation:'create',baseRevision:0,patch,clientUpdatedAt:1}])])).rows[0].result;
  await assert.rejects(stage('restore-old-id','direct'),e=>e.code==='40001');
  const staged=await stage('restore-new-id','direct-restored');
  const restored=(await sync.query('select rakeezx.finalize_sync_v2_restore_score_v2($1,$2,$3) as result',['restore-new-id','f'.repeat(64),staged.stageHash])).rows[0].result;
  assert(restored);assert.equal((await q("select count(*)::int n from rakeezx.items where owner_id=$1 and id='direct-restored' and deleted_at is null",[A])).rows[0].n,1);
  assert.equal((await list()).rows.some(r=>r.sourceId==='direct'),false);
  return {deleted:true,originalReceiptSameCommit:true,actualRestoreStageFinalize:true,oldIdRestoreRejected:true,newIdUnpublished:true,restoredOldLinkRetired:true};
 });
 await check('actual_signed_web_entry_original_ingress_owner_guard_and_default_off',async()=>{
  const ingressKey=randomBytes(32),deployment=JSON.parse(await src('drafts/n88-student-portal/deployment.inactive.json')),options={...deployment,origin,authUrl,apiKey:'FABRICATED_PUBLIC_KEY',fetch:provider.fetch,secretKey:randomBytes(32),ingressKey,numericKey:Buffer.alloc(32,1),reservationKey:Buffer.alloc(32,2),recoveryKeys:new Map([['v1',randomBytes(32)]]),recoveryActiveKeyVersion:'v1',rollout,acquire,sourceOnly:false,canonicalReadback:true,privateIngressReadback:true};
  const edge=createWebEntry({...options,publicationRuntime:{enabled:true,expectedSystemIdentifier:sys,assertTransport,studentTeachingId:'teaching'}}),off=createWebEntry(options);
  const signed=async body=>{const path='/api/n88/teacher/class/publication-v2',method='POST',h=new Headers(headers),bytes=new TextEncoder().encode(JSON.stringify(body)),time=String(Math.floor(Date.now()/1000)),nonce=randomUUID(),source='1'.repeat(64);
   const signature=await mac(ingressKey,signingText({origin,path,method,headers:h,bodyHash:await sha(bytes),time,nonce,source}));
   return new Request(authUrl+'/functions/v1/n88-student-portal/dispatch',{method:'POST',headers:{'content-type':'application/json','x-n88-time':time,'x-n88-nonce':nonce,'x-n88-source':source,'x-n88-signature':signature},body:JSON.stringify({path,method,headers:FORWARDED.map(n=>h.get(n)||''),body:encodeBytes(bytes)})});};
  const wire=await signed({action:'list',scope,binding});assert.equal((await off(wire.clone())).status,400);
  const reply=await(await edge(wire.clone())).json();assert.equal(reply.status,200,JSON.stringify(reply));
  const replay=await(await edge(wire.clone())).json();assert.notEqual(replay.status,200);
  const foreign=await(await edge(await signed({action:'list',scope:{...scope,ownerId:B},binding}))).json();assert.notEqual(foreign.status,200);
  let sends=0;const gateway=createRuntimeWriterGateway({fetch:async(url,init)=>{sends++;return edge(new Request(url,init));}});
  const external=()=>{const r=new Request(origin+'/api/n88/teacher/class/publication-v2',{method:'POST',headers:{...headers,'cf-connecting-ip':'192.0.2.31'},body:JSON.stringify({action:'list',scope,binding})});Object.defineProperty(r,'cf',{value:{tlsVersion:'TLSv1.3'}});return r;};
  const env={N88_ENABLED:'true',N88_PUBLIC_ORIGIN:origin,N88_EDGE_URL:authUrl+'/functions/v1/n88-student-portal',N88_INGRESS_KEY:ingressKey.toString('hex')};
  assert.notEqual((await gateway(external(),env)).status,200);assert.equal(sends,0);
  const carried=await gateway(external(),{...env,N88_PUBLICATION_V2_ENABLED:'true'});assert.equal(carried.status,200,await carried.clone().text());assert.equal(sends,1);
  const pupil=new Request(origin+'/api/n88/student/publication-v2/read',{headers:{origin,'x-n88-csrf':'1','sec-fetch-site':'same-origin','cf-connecting-ip':'192.0.2.31',cookie:'__Secure-n88-student='+studentToken}});Object.defineProperty(pupil,'cf',{value:{tlsVersion:'TLSv1.3'}});
  const pupilReply=await gateway(pupil,{...env,N88_PUBLICATION_V2_ENABLED:'true'});assert.equal(pupilReply.status,200,await pupilReply.clone().text());assert.equal(sends,2);
  return {realWebRequest:true,sourceHandlers:true,exactGatewayToActualEdge:true,signedIngressAndOriginalCurrentOwner:true,nonceReplayDenied:true,defaultOff:true,noRenderedUiClaim:true};
 });
 await check('genuine_rpc_grade4_guard_child_delete_recomputes_original_algorithm',async()=>{
  const score=(await q("select id,revision::text,derived_value from rakeezx.scores where owner_id=$1 and item_id='cascade'",[A])).rows[0];assert.equal(Number(score.derived_value),10);
  await assert.rejects(sync.query("select rakeezx.apply_sync_v2_mutation('scores',$1,$2,'device',$3,'{\"value\":99}'::jsonb,'patch',1)",[score.id,randomUUID(),score.revision]),e=>e.code==='42501');
  const row=(await q("select revision::text from rakeezx.score_subitems where owner_id=$1 and id='child-b'",[A])).rows[0];
  const result=(await sync.query("select rakeezx.apply_sync_v2_mutation('score_subitems','child-b',$1,'device',$2,'{}'::jsonb,'delete',1) result",[randomUUID(),row.revision])).rows[0].result;assert.equal(result.outcome,'deleted');
  assert.equal(Number((await q("select derived_value from rakeezx.scores where owner_id=$1 and item_id='cascade'",[A])).rows[0].derived_value),3);
  assert.equal((await student()).status,200);return {originalScoreGuardRetained:true,removedCompletionRetired:true,originalRecomputeResult:3};
 });
 await q(`create schema n88_test;create table n88_test.control(stage text);insert into n88_test.control values('');
 create function n88_test.fail_at() returns trigger language plpgsql security definer set search_path=pg_catalog as $$begin
 if exists(select 1 from n88_test.control where stage=tg_argv[0]) then raise exception 'fabricated_failure_%',tg_argv[0];end if;
 if tg_argv[0]='canonical' and exists(select 1 from n88_test.control where stage='timeout') then perform pg_sleep(0.3);end if;
 if tg_argv[0]='canonical' and exists(select 1 from n88_test.control where stage='race') then perform pg_advisory_xact_lock(9911031,1);end if;
 return new;end $$;
 create trigger zz_fixture_canonical before update on rakeezx.items for each row when (new.id='cascade' or new.id='direct-restored') execute function n88_test.fail_at('canonical');
 create trigger zz_fixture_v2 before update on n88_private.publication_v2_items for each row execute function n88_test.fail_at('v2');
 create trigger zz_fixture_receipt before insert on rakeezx.sync_mutation_receipts for each row execute function n88_test.fail_at('receipt');`);
 const snapshot=async()=>{const tables=['items','score_subitems','score_subitem_completions','scores','sync_mutation_receipts'];const parts=[];
  for(const t of tables)parts.push((await q(`select coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text),'[]') as rows from rakeezx.${t} x where owner_id=$1`,[A])).rows[0].rows);
  for(const t of ['scopes','items','high_water','receipts'])parts.push((await q(`select coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text),'[]') as rows from n88_private.publication_v2_${t} x where owner_id=$1`,[A])).rows[0].rows);return hash(JSON.stringify(parts));};
 await check('full_rpc_parent_children_v2_and_original_receipt_rollback_fault_points',async()=>{
  const rev=(await q("select revision::text from rakeezx.items where owner_id=$1 and id='cascade'",[A])).rows[0].revision;
  for(const stage of ['canonical','v2','receipt']){const before=await snapshot();await q('update n88_test.control set stage=$1',[stage]);await assert.rejects(mutate('cascade',rev,{},'delete'),e=>e.code==='P0001');await q("update n88_test.control set stage=''");assert.equal(await snapshot(),before);}
  const before=await snapshot();await q("update n88_test.control set stage='timeout'");await sync.query("set statement_timeout='100ms'");await assert.rejects(mutate('cascade',rev,{},'delete'),e=>e.code==='57014');await sync.query('reset statement_timeout');await q("update n88_test.control set stage=''");assert.equal(await snapshot(),before);
  return {injected:['after-child-before-parent','after-canonical-before-v2','after-v2-before-receipt'],timeoutRollback:true,allThreeStoresAtomic:true};
 });
 await check('independent_service_writer_connections_contend_in_both_orders',async()=>{
  const defer=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};
  const waitLock=async pid=>{for(let i=0;i<100;i++){if((await q("select wait_event_type from pg_stat_activity where pid=$1",[pid])).rows[0]?.wait_event_type==='Lock')return;await new Promise(r=>setTimeout(r,10));}assert.fail('expected actual PG lock wait');};
  const enter=defer(),release=defer();control.gate={enter:enter.resolve,wait:release.promise};const reading=list();await enter.promise;
  let rev=(await q("select revision::text from rakeezx.items where owner_id=$1 and id='direct-restored'",[A])).rows[0].revision;
  const writing=mutate('direct-restored',rev,{name:'Race one'});await waitLock(sync.processID);release.resolve();await reading;assert.equal((await writing).outcome,'applied');
  await q('select pg_advisory_lock(9911031,1)');await q("update n88_test.control set stage='race'");rev=(await q("select revision::text from rakeezx.items where owner_id=$1 and id='direct-restored'",[A])).rows[0].revision;
  const writing2=mutate('direct-restored',rev,{name:'Race two'});await waitLock(sync.processID);const reading2=list();await new Promise(r=>setTimeout(r,30));await q('select pg_advisory_unlock(9911031,1)');await writing2;await q("update n88_test.control set stage=''");await reading2;
  return {actualIndependentLoginConnections:true,serviceFirstWriterWaits:true,writerFirstServiceWaits:true};
 });
 await check('accepted_parent_delete_leaves_no_live_dependencies_and_receipt_replays_once',async()=>{
  const rev=(await q("select revision::text from rakeezx.items where owner_id=$1 and id='cascade'",[A])).rows[0].revision,mid=randomUUID();
  const r=await mutate('cascade',rev,{},'delete',mid);assert.equal(r.outcome,'deleted');const before=await snapshot();assert.deepEqual(await mutate('cascade',rev,{},'delete',mid),r);assert.equal(await snapshot(),before);
  assert.equal((await q("select (select count(*) from rakeezx.score_subitems where owner_id=$1 and item_id='cascade' and deleted_at is null)+(select count(*) from rakeezx.scores where owner_id=$1 and item_id='cascade' and deleted_at is null)+(select count(*) from rakeezx.score_subitem_completions where owner_id=$1 and subitem_id in ('child-a','child-b') and deleted_at is null) as n",[A])).rows[0].n,'0');
  await assert.rejects(sync.query("select rakeezx.apply_sync_v2_mutation('sections','class',$1,'device',1,'{}','delete',1)",[randomUUID()]),/n88_parent_has_live_children/);
  await assert.rejects(sync.query("select rakeezx.apply_sync_v2_mutation('subjects','subject',$1,'device',1,'{}','delete',1)",[randomUUID()]),/n88_parent_has_live_children/);
  return {noLiveChildren:true,unchangedReplay:true,parentOnlyDeleteRejected:true};
 });
 await check('cross_owner_conflict_and_current_session_negatives_do_not_retire',async()=>{
  const before=await snapshot(),bad=await request({action:'list',scope:{...scope,ownerId:B},binding});assert.notEqual(bad.status,200);assert.equal(await snapshot(),before);
  await q("update auth.sessions set not_after=clock_timestamp()-interval '1 second' where id=$1",[SESSION]);
  assert.notEqual((await request({action:'list',scope,binding})).status,200);await assert.rejects(mutate('direct-restored','1',{name:'expired'}));
  assert.equal(await snapshot(),before);await q("update auth.sessions set not_after=clock_timestamp()+interval '1 hour' where id=$1",[SESSION]);
  await sync.query("select set_config('request.jwt.claim.sub',$1,false)",[B]);await assert.rejects(mutate('direct','1',{name:'Foreign session'}),e=>e.code==='42501');await sync.query("select set_config('request.jwt.claim.sub',$1,false)",[A]);
  await q('delete from auth.sessions where id=$1',[SESSION]);assert.notEqual((await request({action:'list',scope,binding})).status,200);await assert.rejects(mutate('direct-restored','1',{name:'revoked'}));
  assert.equal(await snapshot(),before);await q('insert into auth.sessions(id,user_id,not_after) values($1,$2,clock_timestamp()+interval \'1 hour\')',[SESSION,A]);
  return {foreignOwnerRefused:true,actualRpcMismatchedOwnerSessionRefused:true,expiredAndRevokedSessionRefused:true,noPublicationOrCanonicalEffects:true};
 });
 await check('unknown_commit_ack_preserves_original_publication_outcome_no_blind_replay',async()=>{
  return qualifyLostWriteAck('direct-restored');
 });
 report.writerReadback=(await q(`select proname,encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex') as definition,pg_get_userbyid(proowner) as owner,prosecdef,proacl::text as acl from pg_proc p where p.pronamespace in ('rakeezx'::regnamespace,'n88_private'::regnamespace) and (proname in ('apply_sync_v2_mutation','apply_sync_v2_mutation_before_student_0029','v2_runtime_identity_1031') or proname like 'v2_writer_%') order by proname`)).rows;
 report.runtimeBoundary={serviceLogin:'n88_backend',existingCredentialsReused:true,roleSettings:{log_error_verbosity:'terse'},originalLegacyRightsUnchanged:true,newFixedExecute:14,newRawTableGrants:0};
 await check('exact_unbound_installer_refuses_and_postconditions_read_back',async()=>{
  await assert.rejects(q(await src('drafts/n88-student-portal/activation/v2-runtime-writer-1031/install.inactive.sql')),/n88_exact_runtime_writer_authority_required/);await q('rollback');
  await q('begin');await q(await src('drafts/n88-student-portal/activation/v2-runtime-writer-1031/post.sql'));
  return {unboundFullInstallerRefusedBeforeDelta:true,sevenExactDefinitionsOwnersAndAcls:true,noPermanentOwnerMembership:true,noHostedExecution:true};
 });
 return async fresh=>{assert((await fresh.query('select count(*)::int n from rakeezx.sync_mutation_receipts')).rows[0].n>=3);};
}
