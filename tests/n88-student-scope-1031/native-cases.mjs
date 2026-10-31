/** AI: only the new combined inactive label-read composition on owned PG17. */
import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {randomBytes,createHash} from 'node:crypto';import path from 'node:path';
import {bootstrapPublicSchema} from '../fixtures/n122-1019/native-cases.mjs';
import {A,B} from '../fixtures/n88-existing-host/provider.mjs';
import {LABEL_READ} from '../../drafts/n88-student-portal/activation/v2-student-scope-1031/labels.mjs';
import {qualifyJourney} from './journey.mjs';
const sha=s=>createHash('sha256').update(s).digest('hex');
export async function qualify({root,admin,report,Client,port,clients}){
 const q=(s,a=[])=>admin.query(s,a),src=async p=>(await readFile(path.join(root,p),'utf8')).replace(/^\uFEFF/,'').replaceAll('\r\n','\n');
 const check=async(name,fn)=>{const r={name,status:'FAIL'};report.checks.push(r);r.evidence=await fn();r.status='PASS';};
 await q('create role postgres superuser;set role postgres');await bootstrapPublicSchema({a:admin,report,root});
 await q(`alter table auth.users add column banned_until timestamptz;create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id),not_after timestamptz);
 create function auth.jwt() returns jsonb language sql stable as $$select jsonb_build_object('session_id',current_setting('request.jwt.claim.session_id',true))$$;
 create role n88_backend nologin noinherit nosuperuser nobypassrls nocreatedb nocreaterole;`);
 for(const f of ['schema-proposal.sql','postgres-repository-schema.sql','canonical-state-schema.inactive.sql','canonical-lock.inactive.sql','auth-session.inactive.sql','ingress.inactive.sql','roles.inactive.sql','integrated-schema.inactive.sql','six-digit-schema.inactive.sql','shared-network-budget.inactive.sql','code-recovery.inactive.sql','task-guidance.inactive.sql'])await q(await src('drafts/n88-student-portal/'+f));
 const old=await src('supabase/migrations/20261018185300_n88_private_error_boundary_staged.sql');await q(old.slice(old.indexOf('create function n88_private.boundary_'),old.lastIndexOf('commit;')));
 const packet=await src('drafts/n88-student-portal/activation/v2-package-1028/schema.sql');await q(packet.slice(packet.indexOf('-- BEGIN EXACT original storage'),packet.lastIndexOf('commit;')));
 const cols=(await q(`select c.relname,n.nspname,string_agg(quote_ident(a.attname),',') as cols from pg_class c join pg_namespace n on n.oid=c.relnamespace join pg_attribute a on a.attrelid=c.oid and a.attnum>0 and not a.attisdropped where n.nspname in ('auth','rakeezx','n88_private') and c.relkind='r' group by c.relname,n.nspname`)).rows;
 for(const r of cols)await q(`revoke all on ${r.nspname}.${r.relname} from n88_v2_runtime;revoke all(${r.cols}) on ${r.nspname}.${r.relname} from n88_v2_runtime`);
 // Reuse the corrected predecessor fixture preimage, never its superseded writer.
 for(const n of ['20261019091500_n122_non_teaching_slots.sql','20261019161000_n36_subjectless_section_delete.sql','20261020085614_n117_initial_department_calendar.sql'])await q(await src('supabase/migrations/'+n));
 const inventory=JSON.parse(await src('drafts/n88-student-portal/activation/v2-runtime-writer-1031/current-writers.json'));
 for(const definition of new Set(inventory.triggers.map(t=>t.function_definition)))await q(definition);
 for(const f of inventory.functions){await q(f.definition);await q(`revoke all on function ${f.signature} from public,anon,authenticated,n88_backend`);if(f.acl.includes('authenticated='))await q(`grant execute on function ${f.signature} to authenticated`);}
 const password=randomBytes(32).toString('hex');await q(`alter role n88_backend login password '${password}';reset role;alter role postgres nosuperuser bypassrls createrole createdb login password '${password}';grant execute on function pg_catalog.pg_control_system() to postgres;grant n88_v2_guard to postgres with admin true,inherit false,set false;`);
 const connectAs=async user=>{const c=new Client({host:'127.0.0.1',port,database:'postgres',user,password,ssl:false,statement_timeout:3000,connectionTimeoutMillis:3000,query_timeout:12000});c.on('error',()=>{});clients.add(c);await c.connect();return c;};
 const installer=await connectAs('postgres'),sid='22222222-2222-4222-8222-222222222222',cid='33333333-3333-4333-8333-333333333333';
 const edges=async()=>(await q("select roleid::text,member::text,grantor::text,admin_option,inherit_option,set_option from pg_auth_members order by roleid,member,grantor")).rows;
 const beforeEdges=await edges(),subjectACL=(await q("select relacl::text as acl from pg_class where oid='rakeezx.subjects'::regclass")).rows[0].acl,functions=async()=>(await q("select proname,encode(sha256(convert_to(pg_get_functiondef(oid),'UTF8')),'hex') as hash from pg_proc where pronamespace='n88_private'::regnamespace and proname ~ '^v2_[a-f0-9]{24}$' order by proname")).rows,before14=await functions();
 const manifest=JSON.parse(await src('drafts/n88-student-portal/activation/v2-student-scope-1031/manifest.json')),sql=await src('drafts/n88-student-portal/activation/v2-student-scope-1031/install.inactive.sql');
 await check('combined_inactive_install_non_superuser_owner_admin_exact_delta',async()=>{
  assert.equal((await installer.query('select rolsuper from pg_roles where rolname=current_user')).rows[0].rolsuper,false);
  await assert.rejects(installer.query(sql),/authority_required/);await installer.query('rollback');
  const system=(await q('select (pg_control_system()).system_identifier::text as value')).rows[0].value;
  const authority={approved:true,productId:'N88',action:'install-n88-student-scope-1031',projectRef:'xlrubcwjqktzzunrvuns',bundleSha256:manifest.bundleSha256,authorityRef:'FABRICATED-OWNED-LOCAL-ONLY',runId:'9f046986-1f78-4ad5-a247-397a19fc7e66',expiresAt:new Date(Date.now()+300000).toISOString()};
  const bound=sql.replace("expected_authority jsonb := 'null'::jsonb;",()=>"expected_authority jsonb := '"+JSON.stringify(authority)+"'::jsonb;").replaceAll("system_identifier::text<>'7678071634733212629'","system_identifier::text<>'"+system+"'");
  await installer.query(bound);assert.deepEqual(await edges(),beforeEdges);assert.deepEqual(await functions(),before14);assert.equal(before14.length,14);
  const rb=(await q(await src('drafts/n88-student-portal/activation/v2-student-scope-1031/readback.sql'))).at?.(-1);
  report.exactLabelRead=(await q("select encode(sha256(convert_to(prosrc,'UTF8')),'hex') as hash,pg_get_userbyid(proowner) as owner from pg_proc where pronamespace='n88_private'::regnamespace and proname='safe_student_scope_labels_1031'")).rows[0];
  assert.equal(report.exactLabelRead.hash,manifest.labelRead.bodySha256);assert.equal(report.exactLabelRead.owner,'postgres');
  return {actualInstaller:'postgres',superuser:false,original14Unchanged:true,allTemporaryEdgesRestored:true,sourceInstallerSha256:sha(sql),localBoundSha256:sha(bound),hosted:false};
 });
 for(const owner of [A,B]){
  await q('insert into auth.users(id) values($1)',[owner]);await q("insert into n88_private.contexts(namespace,owner_id,active) values($1,$2,true)",['synthetic_scope_'+owner.replaceAll('-',''),owner]);
  await q("select set_config('request.jwt.claim.sub',$1,false)",[owner]);
  await q(`insert into rakeezx.years(id,label,hijri_start,hijri_end) values('year','1448',1448,1449);
   insert into rakeezx.terms(id,year_id,name,"index",status,start_date,end_date) values('term','year','الفصل الحقيقي',1,'active','2026-08-01','2027-06-01');
   insert into rakeezx.subjects(id,name,slug) values('custom','مادة مخصصة <b>نص</b>','custom');
   insert into rakeezx.sections(id,year_id,grade,label,name) values('class','year',4,'أ','مصطنع');
   insert into rakeezx.teachings(id,section_id,subject_id,term_id) values('teaching','class','custom','term');
   insert into rakeezx.students(id,name) values('pupil','مصطنع');
   insert into rakeezx.enrollments(id,student_id,section_id) values('enrollment','pupil','class');`);
 }
 const credential={id:cid,ownerId:A,studentId:'pupil',version:1,reservation:'a'.repeat(64),verifier:'b'.repeat(64),keyVersion:'v1',revokedAt:null,format:'six-v1'};
 const session={id:sid,credentialId:cid,ownerId:A,studentId:'pupil',classId:'class',enrollmentId:'enrollment',membershipRevision:1,canonicalStamp:'c'.repeat(64),version:1,tokenHash:'d'.repeat(64),expiresAt:Date.now()+3600000,revokedAt:null};
 await q('insert into n88_private.numeric_credentials(row_key,payload) values($1,$2)',[cid,credential]);await q('insert into n88_private.numeric_sessions(row_key,payload) values($1,$2)',[sid,session]);
 const backend=await connectAs('n88_backend'),call=async a=>(await backend.query(LABEL_READ.sql,[Buffer.from(JSON.stringify(a)).toString('base64')])).rows[0].envelope;
 await backend.query("select set_config('n88.v2_owner',$1,false)",[A]);
 await check('fixed_label_reader_exact_custom_labels_owner_class_denial_safe_errors',async()=>{
  const args=[A,'class',sid,'2026-10-31'],r=await call(args);assert.equal(r.ok,true);assert.deepEqual(r.result.rows,[{teaching_id:'teaching',subject_id:'custom',term_id:'term',subject_name:'مادة مخصصة <b>نص</b>',term_name:'الفصل الحقيقي'}]);
  for(const a of [[B,'class',sid,'2026-10-31'],[A,'foreign-class',sid,'2026-10-31'],['PRIVATE_MARKER','class',sid,'2026-10-31'],[A,'class',sid,'PRIVATE_MARKER']]){const out=await call(a);assert.equal(out.ok,false);assert(!JSON.stringify(out).includes('PRIVATE_MARKER'));}
  const malformed=(await backend.query(LABEL_READ.sql,['PRIVATE_MARKER'])).rows[0].envelope;assert.equal(malformed.ok,false);assert(!JSON.stringify(malformed).includes('PRIVATE_MARKER'));
  assert.equal((await q("select has_table_privilege('n88_backend','rakeezx.subjects','SELECT') as allowed")).rows[0].allowed,false);
  assert.equal((await q("select relacl::text as acl from pg_class where oid='rakeezx.subjects'::regclass")).rows[0].acl,subjectACL); // authenticated retains its original RLS-bound SELECT.
  for(const role of ['anon','authenticated'])assert.equal((await q("select has_function_privilege($1,'n88_private.safe_student_scope_labels_1031(text)','EXECUTE') as allowed",[role])).rows[0].allowed,false);
  return {boundedCustomLabels:true,foreignOwnerAndClassDenied:true,castsInsideSafeErrorBlock:true,rawReadsDenied:true,noPublicExecute:true};
 });
 await check('label_read_rollback_disable_and_restored_edges',async()=>{
  await installer.query('begin');await installer.query("update rakeezx.subjects set name='Temporary' where owner_id=$1 and id='custom'",[A]);await installer.query('rollback');assert.equal((await call([A,'class',sid,'2026-10-31'])).result.rows[0].subject_name,'مادة مخصصة <b>نص</b>');
  await installer.query('begin');await installer.query('revoke execute on function n88_private.safe_student_scope_labels_1031(text) from n88_backend');await installer.query('rollback');assert.equal((await call([A,'class',sid,'2026-10-31'])).ok,true);
  assert.deepEqual(await edges(),beforeEdges);assert.deepEqual(await functions(),before14);return {rollbackPreservesLabels:true,disablePermissionRollback:true,original14AndEdgesUnchanged:true};
 });
 await qualifyJourney({q,installer,connectAs,report,check,root});
 await check('exact_combined_disable_after_qualification',async()=>{
  const disable=await src('drafts/n88-student-portal/activation/v2-student-scope-1031/disable.inactive.sql');
  await assert.rejects(installer.query(disable),/authority_required/);await installer.query('rollback');
  const system=(await q('select (pg_control_system()).system_identifier::text as value')).rows[0].value;
  const authority={approved:true,productId:'N88',action:'disable-n88-student-scope-1031',projectRef:'xlrubcwjqktzzunrvuns',bundleSha256:manifest.bundleSha256,authorityRef:'FABRICATED-OWNED-LOCAL-ONLY',runId:'9f046986-1f78-4ad5-a247-397a19fc7e66',expiresAt:new Date(Date.now()+300000).toISOString()};
  const bound=disable.replace("expected_authority jsonb := 'null'::jsonb;",()=>"expected_authority jsonb := '"+JSON.stringify(authority)+"'::jsonb;").replaceAll("system_identifier::text<>'7678071634733212629'","system_identifier::text<>'"+system+"'");
  await installer.query(bound);assert.equal((await q("select has_function_privilege('n88_backend','n88_private.safe_student_scope_labels_1031(text)','EXECUTE') as allowed")).rows[0].allowed,false);
  assert.deepEqual(await edges(),beforeEdges);assert.deepEqual(await functions(),before14);
  return {unboundSourceRefuses:true,exactDisableAppliedOnlyToDisposableNativeFixture:true,labelExecuteRetired:true,original14Unchanged:true,temporaryEdgesRestored:true};
 });
}
