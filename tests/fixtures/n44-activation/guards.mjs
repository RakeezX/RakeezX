/** AI: affected activation/privilege checks against owned PostgreSQL, never hosted. */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
const dir='drafts/n44-push/activation/';
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const S='11111111-1111-4111-8111-111111111111';
export async function beforeApply({admin,report}) {
 const c=JSON.parse(await readFile(dir+'metadata-contract.json','utf8'));
 // Metadata values are validated comparison data, not executable provider definitions.
 for(const x of c.columns.filter(x=>x.schema==='rakeezx')) {
  assert.match(x.table,/^[a-z_]+$/);assert.match(x.column,/^[a-z_]+$/);
  if(x.nullable==='NO')await admin.query(`alter table rakeezx.${x.table} alter column "${x.column}" set not null`);
 }
 const tables=[...new Set(c.columns.filter(x=>x.schema==='rakeezx').map(x=>x.table))];
 for(const t of tables)await admin.query(`alter table rakeezx.${t} force row level security; alter table rakeezx.${t} owner to postgres`);
 // The old fixture omitted ON DELETE CASCADE on this real parent dependency.
 await admin.query('alter table rakeezx.score_subitems drop constraint score_subitems_owner_id_item_id_fkey; alter table rakeezx.score_subitems add foreign key(owner_id,item_id) references rakeezx.items(owner_id,id) on delete cascade');
 const migration=await readFile('supabase/migrations/20261018044448_n44_exact_activation_staged.sql','utf8');
 async function rejected(pattern,existingSchema=false) {
  await admin.query('set role postgres');
  await assert.rejects(admin.query(migration),pattern);await admin.query('rollback');await admin.query('reset role');
  assert.equal((await admin.query("select to_regnamespace('n44_push_draft') as n")).rows[0].n,existingSchema?'n44_push_draft':null);
 }
 await admin.query('alter table rakeezx.sessions alter column start_time type text');
 await rejected(/N44 column mismatch/);
 await admin.query('alter table rakeezx.sessions alter column start_time type time using start_time::time');
 await admin.query('alter table rakeezx.years no force row level security');
 await rejected(/N44 forced RLS mismatch/);
 await admin.query('alter table rakeezx.years force row level security');
 await admin.query('alter table rakeezx.terms alter constraint terms_owner_id_year_id_fkey deferrable');
 await rejected(/N44 constraint mismatch/);
 await admin.query('alter table rakeezx.terms alter constraint terms_owner_id_year_id_fkey not deferrable');
 await rejected(/N44 existing management Auth REFERENCES prerequisite/);
 // Explicit CONDITIONAL synthetic capability, absent from captured evidence. No hosted grant.
 await admin.query('grant references(id) on auth.users to postgres');
 await admin.query('create role n44_guard nologin');await rejected(/N44 collision/);await admin.query('drop role n44_guard');
 await admin.query('create schema n44_push_draft');await rejected(/N44 collision/,true);await admin.query('drop schema n44_push_draft');
 await admin.query('create schema supabase_migrations; create table supabase_migrations.schema_migrations(version text primary key); grant usage on schema supabase_migrations to postgres; grant select on supabase_migrations.schema_migrations to postgres');
 await admin.query("insert into supabase_migrations.schema_migrations values('20261018044448')");await rejected(/N44 migration history collision/);
 await admin.query('delete from supabase_migrations.schema_migrations');
 report.checks.push({name:'real_metadata_consumed_parity_and_fail_closed_preapply',status:'PASS',evidence:'Consumed types/nullability, composite PK/immediate parent FK topology and FORCE RLS mirrored; type drift, disabled FORCE, deferred FK, role/schema/version collision and missing existing REFERENCES reject atomically before private DDL. REFERENCES then explicitly simulated locally only: its hosted existence is NOT proven. No captured provider definition executed.'});
}
export async function journey({pool,admin,report}) {
 const pass=(name,evidence)=>report.checks.push({name,status:'PASS',evidence});
 const role=async(r,sql,args=[])=>{await admin.query('begin');try{await admin.query('set local role '+r);return await admin.query(sql,args);}finally{await admin.query('rollback');}};
 const denied=async(r,sql,args=[])=>assert.rejects(role(r,sql,args),e=>e.code==='42501');
 for(const r of ['anon','authenticated','n44_guard','n44_backend'])for(const table of ['auth.users','auth.sessions'])await denied(r,'select * from '+table);
 for(const r of ['anon','authenticated'])for(const helper of ["read_source($1::uuid,'lesson','s')",'lock_current_session($1::uuid,$2::uuid)'])await denied(r,'select * from n44_push_draft.'+helper,helper.startsWith('read_')?[A]:[A,S]);
 for(const r of ['anon','authenticated'])await denied(r,'select * from n44_push_draft.contexts');
 const identity=(await admin.query(await readFile(dir+'identities.inactive.sql','utf8'))).rows[0].identities;
 for(const r of identity.roles){for(const k of ['rolcanlogin','rolsuper','rolinherit','rolcreatedb','rolcreaterole','rolreplication','rolbypassrls'])assert.equal(r[k],false,k);}
 assert.ok(identity.memberships.every(m=>m.member==='postgres'&&['n44_guard','n44_backend'].includes(m.role)&&!m.set_option&&!m.inherit_option));
 assert.ok(Object.values(identity.negative_access).every(v=>v===false));
 assert.equal(identity.auth_policy_count,0);assert.equal(identity.management.superuser,false);
 assert.ok(identity.auth.every(t=>t.owner==='supabase_auth_admin'&&t.relrowsecurity&&!t.relforcerowsecurity));
 assert.ok(identity.tables.every(t=>t.relrowsecurity&&t.relforcerowsecurity&&t.independently_owned));
 assert.ok(identity.policies.filter(p=>p.schemaname==='n44_push_draft').every(p=>p.roles.join(',')==='n44_backend'));
 assert.equal(identity.helpers.find(h=>h.name==='read_source').owner,'n44_guard');
 assert.equal(identity.helpers.find(h=>h.name==='lock_current_session').owner,'postgres');
 pass('private_roles_managed_auth_and_negative_privileges','Exact migration executed as existing-style postgres NON-superuser/BYPASSRLS; new roles NOLOGIN/NOINHERIT/NOBYPASSRLS. Backend/guard/API roles cannot scan Auth; API roles cannot use private tables/helpers. Managed Auth ownership/RLS/zero policies unchanged; temporary guard SET/CREATE removed.');
 let q=await pool.query('select * from n44_push_draft.lock_current_session($1,$2)',[A,S]);assert.equal(q.rows[0].user_id,A);
 assert.equal((await pool.query('select * from n44_push_draft.lock_current_session($1,$2)',[B,S])).rowCount,0);
 await admin.query('update auth.users set banned_until=now()+interval \'1 hour\' where id=$1',[A]);
 assert.equal((await pool.query('select * from n44_push_draft.lock_current_session($1,$2)',[A,S])).rowCount,0);
 await admin.query('update auth.users set banned_until=null where id=$1',[A]);
 await admin.query('update auth.sessions set not_after=now()-interval \'1 hour\' where id=$1',[S]);
 assert.equal((await pool.query('select * from n44_push_draft.lock_current_session($1,$2)',[A,S])).rowCount,0);
 await admin.query('update auth.sessions set not_after=null where id=$1',[S]);
 pass('exact_session_helper_denies_wrong_owner_ban_and_expiry','Actual private helper returns exact original owner/session/not_after only; wrong owner, ban and expired session yield zero rows under real managed-Auth RLS replica.');
 for(const owner of [A,B]) {
  await admin.query("insert into rakeezx.years(owner_id,id,status,hijri_start,hijri_end,revision) values($1,'y','active',1448,1449,1)",[owner]);
  await admin.query("insert into rakeezx.subjects(owner_id,id,revision) values($1,'subject',1)",[owner]);
  await admin.query("insert into rakeezx.sections(owner_id,id,year_id,status,revision) values($1,'section','y','active',1)",[owner]);
  await admin.query("insert into rakeezx.terms(owner_id,id,year_id,\"index\",status,start_date,end_date,revision) values($1,'term','y',1,'active','2026-10-01','2026-12-01',1)",[owner]);
  await admin.query("insert into rakeezx.teachings(owner_id,id,section_id,subject_id,term_id,revision) values($1,'teaching','section','subject','term',1)",[owner]);
  await admin.query("insert into rakeezx.calendars(owner_id,id,year_id,source,term_date_overrides,revision) values($1,'calendar','y','custom','{}',1)",[owner]);
  await admin.query("insert into rakeezx.calendar_days(owner_id,id,calendar_id,date,kind,revision) values($1,'day','calendar','2026-10-18','study',1)",[owner]);
  await admin.query("insert into rakeezx.sessions(owner_id,id,teaching_id,date,start_time,end_time,status,revision) values($1,'session','teaching','2026-10-18','08:00','09:00','scheduled',1)",[owner]);
  await admin.query("insert into rakeezx.items(owner_id,id,teaching_id,score_mode,revision) values($1,'item','teaching','subitems',1)",[owner]);
  await admin.query("insert into rakeezx.score_subitems(owner_id,id,item_id,start_date,due_date,revision) values($1,'sub','item','2026-10-18','2026-10-20',1)",[owner]);
 }
 const source=async(kind,id)=>(await pool.query('select n44_push_draft.read_source($1,$2,$3) as s',[A,kind,id])).rows[0].s;
 const lesson=await source('lesson','session'),due=await source('due','sub');
 assert.equal(lesson.source.id,'session');assert.equal(lesson.days.length,1);assert.equal(due.source.scoreMode,'subitems');
 assert.equal(due.source.dueDate,'2026-10-20');assert.equal(await source('lesson','missing'),null);
 for(const t of ['sessions','years','calendars','score_subitems'])await denied('n44_backend','select * from rakeezx.'+t);
 await admin.query('begin');await admin.query('set local role n44_guard');
 await admin.query("select set_config('n44.canonical_owner',$1,true)",[A]);
 assert.equal((await admin.query('select id from rakeezx.sessions where owner_id=$1',[B])).rowCount,0);
 await assert.rejects(admin.query("update rakeezx.sessions set id=id where owner_id=$1",[A]),e=>e.code==='42501');await admin.query('rollback');
 assert.equal((await role('n44_guard','select id from rakeezx.sessions')).rowCount,0);
 await admin.query("update rakeezx.sessions set revision=revision+1 where owner_id=$1",[A]);
 assert.equal((await source('lesson','session')).source.revision,'2');
 await admin.query("delete from rakeezx.score_subitems where owner_id=$1",[A]);assert.equal(await source('due','sub'),null);
 pass('canonical_actual_schema_parent_calendar_and_read_only_guard','Exact SQL helper reads lesson and due through valid parent/child FK dependencies with FORCE RLS and calendar lineage. Owner B hidden, direct backend reads denied, guard UPDATE denied, owner GUC clears on rollback; changed revision and deleted child observed.');
 await admin.query('set role postgres');await assert.rejects(admin.query(await readFile('supabase/migrations/20261018044448_n44_exact_activation_staged.sql','utf8')),/N44 collision/);await admin.query('rollback');await admin.query('reset role');
 await writeFile(dir+'expected-identities.json',JSON.stringify({aiAuthored:true,localSyntheticOnly:true,identities:identity},null,2)+'\n');
 pass('fresh_only_collision_and_exact_metadata_readback','Reapplication rejects before DDL; catalog-only helper body/ACL/role/grant/policy/RLS identities exported from actual owned PG for later authorized readback. No hosted readback claim.');
}
