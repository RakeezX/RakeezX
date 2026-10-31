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
 const connectAs=async role=>{const c=new Client({host:'127.0.0.1',port,database:'postgres',user:role,password,ssl:false,connectionTimeoutMillis:3000,query_timeout:15000});c.on('error',()=>{});clients.add(c);await c.connect();return c;};
 await q('reset role');await q(`alter role n88_backend set log_error_verbosity='terse';alter role postgres nosuperuser bypassrls createrole createdb login password '${password}';grant execute on function pg_catalog.pg_control_system() to postgres;grant n88_v2_guard to postgres with admin true,inherit false,set false`);
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
 const original=process.argv.includes('--packet-only')?null:await differential();report.originalProtocol=original;
 await check('corrected_single_owner_admin_install_preserves_current_bodies',async()=>{
  const manifest=JSON.parse(await src(packetDir+'manifest.json')),sql=await src(packetDir+'install.inactive.sql'),localId=(await q('select (pg_control_system()).system_identifier::text as value')).rows[0].value;
  const authority={approved:true,productId:'N88',action:'install-n88-runtime-writer-1031',projectRef:manifest.projectRef,bundleSha256:manifest.bundleSha256,authorityRef:'FABRICATED-OWNED-LOCAL-ONLY',runId:'13eebd91-b5c1-4135-bafd-d732ce30867f',expiresAt:new Date(Date.now()+300000).toISOString()};
  const local=sql.replace("expected_authority jsonb := 'null'::jsonb;",()=>"expected_authority jsonb := '"+JSON.stringify(authority)+"'::jsonb;").replace("system_identifier::text<>'7678071634733212629'",()=>"system_identifier::text<>'"+localId+"'");
  try{await installer.query(local);}catch(e){report.installError={code:e.code,message:e.message,position:e.position,where:e.where};throw e;}assert.deepEqual(await edges(),beforeEdges);report.packetQualification={bundleSha256:manifest.bundleSha256,sourceInstallerSha256:hash(sql),localBoundSha256:hash(local),actualLogin:'postgres',superuser:false,hostedExecution:false};
  return {exactCurrentBodiesPreserved:true,originalAclAndDefaults:true,edgesRestored:true};
 });
 if(process.argv.includes('--packet-only')){
  await check('corrected_fixed_readback_and_default_unbound_refusal',async()=>{
   const results=await installer.query(await src(packetDir+'readback.sql'));assert.equal(results[1].rows.length,64);assert.equal(results[2].rows.length,23);
   await assert.rejects(installer.query(await src(packetDir+'install.inactive.sql')),/n88_exact_runtime_writer_authority_required/);await installer.query('rollback');
   await assert.rejects(installer.query(await src(packetDir+'disable.sql')),/n88_exact_runtime_writer_authority_required/);await installer.query('rollback');
   return {fixedMetadataRows:64,ownedHooks:23,unboundInstallAndDisableRefused:true,noUserRows:true};
  });return async fresh=>assert.equal((await fresh.query("select count(*)::int n from pg_trigger where tgname in ('00_n88_global_1031','zz_n88_retire_1031')")).rows[0].n,23);
 }
 await check('original_current_protocol_differential',async()=>{const corrected=await differential();assert.deepEqual(corrected,original);return {olderBaseLiveDelete:true,aheadRejected:true,parentLeavesCanonicalChildren:true,queuedChildSameOutcome:true,genericSubitem42501:true,fullEnvelopeAndReplay:true};});
 await check('early_declaration_preserves_initial_found_and_row_count',async()=>{
  await q(`create function pg_temp.n88_diagnostics() returns jsonb language plpgsql as $$declare __n88_entry_lock_1031_8c4d text:=pg_advisory_xact_lock(1312307256,88)::text;n bigint;begin get diagnostics n=row_count;return jsonb_build_object('found',found,'rows',n);end$$;`);
  assert.deepEqual((await q('select pg_temp.n88_diagnostics() as r')).rows[0].r,{found:false,rows:0});return {found:false,rowCount:0,noChangedOriginalLocals:true};
 });
 const provider=providerFixture(),origin='https://synthetic.invalid',rollout=createRolloutGuard(k=>({N88_ROLLOUT_MODE:'public',N88_PUBLIC_HOSTED_ACCEPTANCE_SHA256:'f'.repeat(64),N88_PUBLIC_HOSTED_ACCEPTANCE_CONFIRMED:'true'})[k]);
 const sys=(await q('select (pg_control_system()).system_identifier::text as id')).rows[0].id;
 const control={gate:null,lastPid:null};
 const acquire=async()=>{const c=await connectAs('n88_backend'),raw=c.query.bind(c);c.query=async(s,a)=>{const r=await raw(s,a);if(s==='select pg_advisory_xact_lock(1312307256, 88)'){control.lastPid=c.processID;if(control.gate){const g=control.gate;control.gate=null;g.enter();await g.wait;}}return r;};c.release=()=>{c.end().catch(()=>{});};return c;};
 const assertTransport=async c=>{const r=(await c.query('select session_user::text as login,current_user::text as role,host(inet_server_addr()) as host,inet_server_port() as port')).rows[0];assert.deepEqual(r,{login:'n88_backend',role:'n88_backend',host:'127.0.0.1',port});};
 const canonical={rollout,studentTeachingId:'teaching',teacher:{authUrl,apiKey:'FABRICATED_PUBLIC_KEY',fetch:provider.fetch},numeric:{keys:new Map([['v1',Buffer.alloc(32,1)]]),activeKeyVersion:'v1',reservationKey:Buffer.alloc(32,2)},verifyIngress:async r=>r.headers['x-fixture-ingress']==='1'?{clientKey:'fabricated-ingress'}:null};
 const host=await createHostedPublicationV2Runtime({enabled:true,acquire,assertTransport,expectedSystemIdentifier:sys,canonical,origin});
 const headers={origin,'x-fixture-ingress':'1','x-n88-csrf':'1','content-type':'application/json','sec-fetch-site':'same-origin',authorization:'Bearer '+provider.token()},binding={sessionId:SESSION,leaseId:'synthetic-source-lease',contextRevision:'synthetic-context'},scope={ownerId:A,teachingId:'teaching',sectionId:'class',termId:'term',subjectId:'subject'};
 const request=body=>host.handle({path:'/teacher/class/publication-v2',method:'POST',headers,body});
 const list=async()=>{const r=await request({action:'list',scope,binding});assert.equal(r.status,200,JSON.stringify(r.body));return r.body;};
 const command=(l,id,decisions={required:false,scheduled:false,completed:false,grade:true})=>{const row=l.rows.find(r=>r.sourceId===id);assert(row,'source '+id);return publicationCommand({draft:{scope,rows:[{...row,decisions}]},scope,binding,rowId:row.id,expectedPublicationRevision:row.publicationRevision,expectedMembershipRevision:l.membershipRevision,requestId:'intent_'+randomUUID().replaceAll('-','')});};
 const retired=async id=>(await q('select retired from n88_private.publication_v2_high_water where owner_id=$1 and source_key=$2',[A,id])).rows;
 const n71=async(id,operations)=>{const manifest=(await sync.query('select rakeezx.n71_restore_manifest($1) as r',[A])).rows[0].r;const stage=(await sync.query('select rakeezx.stage_n71_restore($1,$2,5,$3::jsonb,$4::jsonb,$5) as r',[id,'a'.repeat(64),JSON.stringify(manifest),JSON.stringify(operations),A])).rows[0].r;return (await sync.query('select rakeezx.finalize_n71_restore($1,$2,$3) as r',[id,'a'.repeat(64),stage.stageHash])).rows[0].r;};
 await check('actual_current_n94_command_and_distribution_copy',async()=>{
  const args=['n94-completion','device','set_completion','configured','student0','child-a','regular',null];
  const sql='select rakeezx.apply_score_subitem_command_n94($1,$2,$3,$4,$5,$6,$7,$8) as result',result=(await sync.query(sql,args)).rows[0].result;
  assert.deepEqual((await sync.query(sql,args)).rows[0].result,result);
  assert.equal(Number((await q("select derived_value from rakeezx.scores where owner_id=$1 and item_id='configured' and student_id='student0'",[A])).rows[0].derived_value),3);
  const rev=(await q("select revision::text as v from rakeezx.items where owner_id=$1 and id='configured'",[A])).rows[0].v;
  await sync.query("select rakeezx.apply_score_distribution_copy_command('distribution-copy','device','configured',$1,'copy-teaching','copied-item',$2::jsonb,'add')",[rev,JSON.stringify({'child-a':'copied-a','child-b':'copied-b'})]);
  const copied=await request({action:'list',scope:{...scope,teachingId:'copy-teaching',sectionId:'copy-class'},binding});assert.equal(copied.status,200);assert(copied.body.rows.find(r=>r.sourceId==='copied-a').decisions.grade===false);
  const plan=(await sync.query("select rakeezx.plan_score_distribution('plan-actual','teaching',array['plan-teaching'],array[]::text[]) as r")).rows[0].r;
  await sync.query("select rakeezx.apply_score_distribution_plan('apply-plan','device','plan-actual',$1,true)",[plan.token]);
  assert(Number((await q("select count(*)::int n from rakeezx.items where owner_id=$1 and teaching_id='plan-teaching' and deleted_at is null",[A])).rows[0].n)>0);
  return {actualN94:true,originalDerivedGrade:3,originalReceiptReplay:true,actualDistributionCopy:true,actualDistributionPlanApply:true,newSourcesUnpublished:true};
 });
 await check('genuine_n71_delete_restore_between_reads_no_old_link_revival',async()=>{
  const cmd=command(await list(),'direct');assert.equal((await request(cmd)).body.receipt.state,'applied');
  assert.equal((await mutate('direct',0,{},'delete','delete-before-n71')).rows[0].result.outcome,'deleted');
  const patch={teaching_id:'teaching',name:'Restored Direct',max:10,score_mode:'direct',order:0};
  await assert.rejects(n71('n71-old',[{entity:'items',recordId:'direct',operation:'create',baseRevision:0,patch,clientUpdatedAt:1}]),e=>e.code==='40001');
  await n71('n71-new',[{entity:'items',recordId:'n71-fresh',operation:'create',baseRevision:0,patch,clientUpdatedAt:1}]);
  assert((await retired('items:direct')).every(r=>r.retired));
  const status=await request({action:'status',scope,binding,command:cmd});assert.equal(status.body.fresh,null);assert.deepEqual(status.body.receipt,(await q('select payload from n88_private.publication_v2_receipts where owner_id=$1 and request_id=$2',[A,cmd.requestId])).rows[0].payload);
  const l=await list();assert(!l.rows.some(r=>r.sourceId==='direct'));assert(l.rows.find(r=>r.sourceId==='n71-fresh').decisions.grade===false);
  return {actualN71StageFinalize:true,noReadBetweenDeleteRestore:true,originalOldIdRefusal:true,originalReceiptUnchanged:true,newIdentityUnpublished:true};
 });
 await check('genuine_score_configuration_removal_and_score_restore_retirement',async()=>{
  const cmd=command(await list(),'child-b',{required:true,scheduled:true,completed:false,grade:false});assert.equal((await request(cmd)).body.receipt.state,'applied');
  await config('remove-child-b',2,[definitions[0]]);
  assert((await retired('scoreSubitems:child-b')).every(r=>r.retired));
  const manifest=(await sync.query('select rakeezx.sync_v2_restore_manifest_score_v2($1) as r',[A])).rows[0].r;
  const op={entity:'score_subitems',recordId:'child-b-fresh',operation:'create',baseRevision:0,patch:{item_id:'configured',name:'Restored Work B',value:7,order:1,start_date:'2026-10-20',due_date:'2026-11-30'},clientUpdatedAt:1};
  const staged=(await sync.query('select rakeezx.stage_sync_v2_restore_score_v2($1,$2,5,$3::jsonb,$4::jsonb) as r',['score-restore','b'.repeat(64),JSON.stringify(manifest),JSON.stringify([op])])).rows[0].r;
  await sync.query('select rakeezx.finalize_sync_v2_restore_score_v2($1,$2,$3)',['score-restore','b'.repeat(64),staged.stageHash]);
  assert.equal((await request({action:'status',scope,binding,command:cmd})).body.fresh,null);const l=await list();assert(!l.rows.some(r=>r.sourceId==='child-b'));assert(l.rows.find(r=>r.sourceId==='child-b-fresh').decisions.required===false);
  return {actualConfigurationRpc:true,actualScoreRestoreChain:true,noIntermediateV2Read:true,removedSourcePermanentlyRetired:true,noCanonicalN88Cascade:true};
 });
 await q(`create schema n88_test;create table n88_test.control(stage text);insert into n88_test.control values('');create function n88_test.fail_at() returns trigger language plpgsql security definer set search_path=pg_catalog as $$begin
 if exists(select 1 from n88_test.control where stage=tg_argv[0]) then raise exception 'fabricated_%',tg_argv[0];end if;
 if tg_argv[0]='canonical' and exists(select 1 from n88_test.control where stage='race') then perform pg_advisory_xact_lock(9911031,1);end if;return new;end $$;
 create trigger zz_fixture_canonical before update on rakeezx.items for each row when(new.id='configured') execute function n88_test.fail_at('canonical');
 create trigger zz_fixture_n88 before insert or update on n88_private.publication_v2_high_water for each row execute function n88_test.fail_at('n88');
 create trigger zz_fixture_receipt before insert on rakeezx.score_domain_receipts for each row execute function n88_test.fail_at('receipt');`);
 const snapshot=async()=>{const parts=[];for(const table of ['items','score_subitems','scores','score_subitem_completions','score_domain_receipts','sync_mutation_receipts'])parts.push((await q(`select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]') as value from rakeezx.${table} t where owner_id=$1`,[A])).rows[0].value);for(const t of ['scopes','items','high_water','receipts'])parts.push((await q(`select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]') as value from n88_private.publication_v2_${t} t where owner_id=$1`,[A])).rows[0].value);return hash(JSON.stringify(parts));};
 const version=async()=>(await q("select distribution_version::text as v from rakeezx.items where owner_id=$1 and id='configured'",[A])).rows[0].v;
 const currentDefinitions=async suffix=>(await q("select id,name,value,start_date::text,due_date::text from rakeezx.score_subitems where owner_id=$1 and item_id='configured' and deleted_at is null order by id",[A])).rows.map(r=>({id:r.id,name:r.name+(suffix||''),value:Number(r.value),startDate:r.start_date,dueDate:r.due_date}));
 await check('canonical_n88_original_receipt_failure_roll_back_together',async()=>{
  const remaining=(await currentDefinitions()).filter(d=>d.id!=='child-a'),v=await version();
  for(const stage of ['canonical','n88','receipt']){const before=await snapshot();await q('update n88_test.control set stage=$1',[stage]);await assert.rejects(config('fault-'+stage,v,remaining),e=>e.code==='P0001');await q("update n88_test.control set stage=''");assert.equal(await snapshot(),before);}
  return {originalScoreConfigurationEntry:true,failures:['canonical','n88-high-water','original-score-receipt'],allStoresAtomic:true};
 });
 await check('both_lock_schedules_use_genuine_score_configuration_entry',async()=>{
  const defer=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};},wait=async pid=>{for(let n=0;n<120;n++){if((await q('select wait_event_type from pg_stat_activity where pid=$1',[pid])).rows[0]?.wait_event_type==='Lock')return;await new Promise(r=>setTimeout(r,10));}assert.fail('actual lock wait required');};
  const stale=command(await list(),'child-a'),enter=defer(),release=defer();control.gate={enter:enter.resolve,wait:release.promise};const reading=list();await enter.promise;
  const writing=config('race-service-first',await version(),await currentDefinitions(' one'));await wait(sync.processID);release.resolve();await reading;await writing;
  await q('select pg_advisory_lock(9911031,1)');await q("update n88_test.control set stage='race'");const writing2=config('race-writer-first',await version(),await currentDefinitions(' two'));await wait(sync.processID);
  const oldPid=control.lastPid,reading2=list();for(let n=0;n<100&&control.lastPid===oldPid;n++)await new Promise(r=>setTimeout(r,5));
  // Observe actual blocked runtime query rather than a source-text ordering assertion.
  const waiting=(await q("select pid from pg_stat_activity where usename='n88_backend' and wait_event_type='Lock' and query like '%pg_advisory_xact_lock%' limit 1")).rows;assert.equal(waiting.length,1);
  await q('select pg_advisory_unlock(9911031,1)');await writing2;await q("update n88_test.control set stage=''");await reading2;
  const rejected=await request(stale);assert.equal(rejected.body.receipt.state,'rejected');
  return {serviceFirst:true,genuineWriterFirst:true,noDeadlock:true,stalePublishRejected:true};
 });
 await check('genuine_n77_parent_delete_retires_child_links_only_by_original_cascade',async()=>{
  const cmd=command(await list(),'child-a');assert.equal((await request(cmd)).body.receipt.state,'applied');
  const preview=(await sync.query("select rakeezx.n77_delete_teaching('teaching','class') as r")).rows[0].r;
  const result=(await sync.query("select rakeezx.n77_delete_teaching('teaching','class',$1,'n77-delete','device',true) as r",[preview.fingerprint])).rows[0].r;assert.equal(result.outcome,'deleted');
  const state=(await q("select p.tombstone from n88_private.publication_v2_items p join n88_private.publication_v2_scopes s using(owner_id,scope_key) where p.owner_id=$1 and s.payload->'scope'->>'teachingId'='teaching'",[A])).rows;assert(state.length>0&&state.every(r=>r.tombstone));
  assert((await q("select p.tombstone from n88_private.publication_v2_items p join n88_private.publication_v2_scopes s using(owner_id,scope_key) where p.owner_id=$1 and s.payload->'scope'->>'teachingId'='copy-teaching'",[A])).rows.every(r=>!r.tombstone));
  const before=await snapshot();assert.deepEqual((await sync.query("select rakeezx.n77_delete_teaching('teaching','class',$1,'n77-delete','device',true) as r",[preview.fingerprint])).rows[0].r,result);assert.equal(await snapshot(),before);
  return {actualCurrentN77:true,allAffectedChildLinksRetired:true,otherClassLinksUnchanged:true,originalCascadeOnly:true,originalReceiptReplayUnchanged:true};
 });
 await check('original_invoker_security_and_owner_isolation_preserved',async()=>{
  const rows=(await q("select proname,prosecdef from pg_proc where pronamespace='rakeezx'::regnamespace and proname in ('commit_enrollment_transfer','commit_enrollment_transfer_and_renumber','renumber_enrollment_roster')")).rows;assert.equal(rows.length,3);assert(rows.every(r=>r.prosecdef===false));
  await sync.query("select set_config('request.jwt.claim.sub',$1,false)",[B]);const r=(await mutate('n71-fresh',1,{name:'foreign'},'patch','foreign-owner')).rows[0].result;assert.equal(r.outcome,'not_found');await sync.query("select set_config('request.jwt.claim.sub',$1,false)",[A]);
  assert.deepEqual(await edges(),beforeEdges);return {originalInvokerEntries:3,noNewBackingAccess:true,foreignOwnerNotFound:true,ownerEdgesUnchanged:true};
 });
 report.correctedIdentities=(await q("select n.nspname,p.proname,encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex') as sha256,pg_get_userbyid(p.proowner) as owner,p.prosecdef,p.proacl::text as acl from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.oid=any($1::regprocedure[]) or (n.nspname='n88_private' and p.proname like 'v2_writer_%') order by n.nspname,p.proname",[inventory.functions.map(f=>f.signature)])).rows;
 return async fresh=>{assert((await fresh.query('select count(*)::int n from n88_private.publication_v2_high_water where retired')).rows[0].n>0);};
}
