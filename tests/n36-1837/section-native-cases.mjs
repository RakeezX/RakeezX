// AI: bounded native PostgreSQL qualification, existing public schema bootstrap.
import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {bootstrapPublicSchema} from '../fixtures/n122-1019/native-cases.mjs';
import {appQualification} from './section-app.mjs';
import {deletionScope,visibleClosedTermReport} from '../../src/lib/restore-deletion-scope.js';
export const A='a7300000-0000-4000-8000-000000000001',B='b7300000-0000-4000-8000-000000000002';
export async function qualify({a,b,sql,report,root}){
 const q=(s,v=[])=>a.query(s,v),check=async(name,fn)=>{const c={name,status:'FAIL'};report.checks.push(c);await fn();c.status='PASS';console.log('PASS '+name);};
 const fail=async(fn,code='22023')=>{let actual;try{await fn();}catch(e){actual=e.code;}assert.equal(actual,code);};
 await bootstrapPublicSchema({a,report,root});await q(await readFile(root+'/supabase/migrations/20261019091500_n122_non_teaching_slots.sql','utf8'));
 const metadataSQL=`select p.proname,pg_catalog.pg_get_function_identity_arguments(p.oid) signature,p.prosrc,p.prosecdef,p.proconfig,p.proacl::text acl from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where n.nspname='rakeezx' and p.proname in ('lock_student_lifecycle','lock_student_lifecycle_statement','n77_delete_teaching','n77_guard_live_parent','apply_sync_v2_section_lifecycle_command','apply_sync_v2_section_lifecycle_command_before_student_0029','apply_sync_v2_mutation','n71_restore_canonical') order by p.proname`;
 report.prerequisites=(await q(metadataSQL)).rows;assert.equal(report.prerequisites.length,8);
 await q(sql);report.newFunction=(await q(`select p.prosrc,p.prosecdef,p.proconfig,p.proacl::text acl,pg_get_function_identity_arguments(p.oid) signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='rakeezx' and p.proname='n36_delete_subjectless_section'`)).rows[0];
 await q(`insert into auth.users(id) values('${A}'),('${B}');select set_config('request.jwt.claim.sub','${A}',false);
 insert into rakeezx.years(id,label,hijri_start,hijri_end) values('y','synthetic',1500,1501);
 insert into rakeezx.terms(id,year_id,name,"index",status) values('t','y','synthetic',1,'active'),('t2','y','closed synthetic',2,'closed');
 insert into rakeezx.sections(id,year_id,grade,label,name) values('s','y',5,'1','synthetic'),('outside','y',5,'2','synthetic');
 insert into rakeezx.subjects(id,name,slug) values('sub','synthetic','synthetic');
 insert into rakeezx.teachings(id,section_id,subject_id,term_id) values('historic','s','sub','t'),('kept','outside','sub','t');
 insert into rakeezx.students(id,name) values('shared','طالب مشترك'),('solo','طالب منفرد');
 insert into rakeezx.enrollments(id,student_id,section_id) values('en','shared','s'),('solo-en','solo','s'),('outside-en','shared','outside');
 insert into rakeezx.items(id,teaching_id,name,max) values('historic-item','historic','synthetic',10),('outside-item','kept','synthetic',10);
 insert into rakeezx.scores(id,item_id,student_id,value) values('history-score','historic-item','shared',8),('outside-score','outside-item','shared',9);
 select set_config('rakeezx.section_lifecycle_delete','on',false);select set_config('rakeezx.score_domain_write','on',false);
 update rakeezx.teachings set deleted_at=clock_timestamp() where id='historic';
 insert into rakeezx.closed_term_reports(id,term_id,year_id,version,source_manifest,payload,device_id) values('history','t','y',1,'[]','{"teachingDocuments":[]}','native');`);
 const history=(await q("select to_jsonb(r) r from rakeezx.closed_term_reports r where id='history'")).rows[0].r;
 const call=async(section='s',commit=false,plan=null,mid='delete-s',device='native')=>(await q('select rakeezx.n36_delete_subjectless_section($1,$2,$3,$4,$5,$6,$7) r',[section,'y','t',plan?.fingerprint??null,commit?mid:null,commit?device:null,commit])).rows[0].r;
 await q("select set_config('rakeezx.section_lifecycle_delete','off',false);select set_config('rakeezx.score_domain_write','off',false);set role authenticated");let plan;
 await check('owner_acl_context_and_no_live_teaching',async()=>{
  await q('set role anon');await fail(()=>call(),'42501');await q('reset role;set role authenticated');
  await q("select set_config('request.jwt.claim.sub','',false)");await fail(()=>call(),'42501');
  await q("select set_config('request.jwt.claim.sub',$1,false)",[B]);await fail(()=>call());
  await q("select set_config('request.jwt.claim.sub',$1,false)",[A]);await fail(()=>call('outside'));
  await fail(()=>q("select rakeezx.n36_delete_subjectless_section('s','y','t2')"));
  await q("select rakeezx.apply_sync_v2_section_lifecycle_command('fixture-archive','native','archive_class','s','2026-10-20',1000)");await fail(()=>call());
  await q("select rakeezx.apply_sync_v2_section_lifecycle_command('fixture-reopen','native','reopen_class','s',null,1001)");
  plan=await call();assert.equal(plan.selectedTeachingId,null);assert.deepEqual(plan.teachingIds,[]);assert.deepEqual(plan.cascadeTeachingIds,['historic']);
 });
 await check('stale_enrollment_and_new_teaching_rejected',async()=>{
  await q("reset role;update rakeezx.enrollments set roll_no=11 where id='en';set role authenticated");await fail(()=>call('s',true,plan,'stale-en'));
  plan=await call();await q("reset role;insert into rakeezx.teachings(id,section_id,subject_id,term_id) values('race-teaching','s','sub','t');set role authenticated");await fail(()=>call('s',true,plan,'stale-teaching'));
  await q("reset role;update rakeezx.teachings set deleted_at=clock_timestamp() where id='race-teaching';set role authenticated");plan=await call();
 });
 await check('owner_lock_serializes_concurrent_enrollment_then_fingerprint_fails',async()=>{
  await b.query("select set_config('request.jwt.claim.sub',$1,false)",[A]);await b.query("begin");await b.query("select rakeezx.lock_student_lifecycle($1)",[A]);
  let finished=false;const waiting=call('s',true,plan,'raced-en').then(v=>{finished=true;return v;},e=>{finished=true;return e;});
  await new Promise(r=>setTimeout(r,100));assert.equal(finished,false);
  await b.query("update rakeezx.enrollments set roll_no=12 where id='en';commit");const e=await waiting;assert.equal(e.code,'22023');plan=await call();
 });
 let receipt;
 await check('atomic_tombstones_exact_retry_changed_envelope_and_preserved_pupils_history',async()=>{
  receipt=await call('s',true,plan);assert.equal(receipt.outcome,'deleted');assert.deepEqual(receipt.orphanStudentIds,[]);
  assert.deepEqual(await call('s',true,plan),receipt);await fail(()=>call('s',true,plan,'delete-s','changed-device'));
  for(const [table,id]of [['sections','s'],['enrollments','en'],['enrollments','solo-en'],['items','historic-item'],['scores','history-score']])assert.ok((await q(`select deleted_at from rakeezx.${table} where id=$1`,[id])).rows[0].deleted_at);
  for(const [table,id]of [['students','shared'],['students','solo'],['enrollments','outside-en'],['scores','outside-score']])assert.equal((await q(`select deleted_at from rakeezx.${table} where id=$1`,[id])).rows[0].deleted_at,null);
  assert.deepEqual((await q("select to_jsonb(r) r from rakeezx.closed_term_reports r where id='history'")).rows[0].r,history);
  const canonical=(await q('select rakeezx.n71_restore_canonical(auth.uid()) r')).rows[0].r;assert.ok(canonical.sections.find(s=>s.id==='s').deleted_at);
  const scope=deletionScope({sections:[{id:'s'}],enrollments:[{id:'en',sectionId:'s'}]},{sections:[{id:'s',deleted:true}],teachings:[]});assert.equal(scope.deleted('enrollments','en'),true);
 });
 await check('unrelated_old_teaching_delete_and_prerequisites_unchanged',async()=>{
  assert.deepEqual((await q(metadataSQL)).rows,report.prerequisites);
  assert.equal((await q("select has_function_privilege('authenticated','rakeezx.n36_delete_subjectless_section(text,text,text,text,text,text,boolean)','EXECUTE') a,has_function_privilege('anon','rakeezx.n36_delete_subjectless_section(text,text,text,text,text,text,boolean)','EXECUTE') b")).rows[0].a,true);
 });
 await appQualification({a,root,report});
 report.sourceQualified=true;
}
