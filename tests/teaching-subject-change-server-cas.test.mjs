import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const ID='tch:22222222-2222-4222-8222-222222222222';
const TARGET='sub:math',OLD='sub:science';
const sqlFile=new URL('../docs/automation-evidence/20261026/subject_change_pristine_rpc_STAGING_ONLY.sql',import.meta.url);
const historyNames=['slots','sessions','session_roster_snapshots','attendance','logs',
 'notes','class_rules','class_goals','class_charter_selections','group_arrangements',
 'assignments','teaching_course_bindings'];
const allNames=['years','terms','sections','subjects','teachings','students','enrollments',
 'items','scores','score_subitems',...historyNames,'submissions','closed_term_reports',
 'section_curriculum_scopes'];
const ddl=[
 'create schema auth; create role authenticated nologin; create role anon nologin;',
 'create schema rakeezx;',
 "create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;",
 'grant usage on schema auth to authenticated;',
 'grant execute on function auth.uid() to authenticated;',
 'create table rakeezx.years(owner_id uuid not null,id text not null,status text not null,deleted_at timestamptz,primary key(owner_id,id));',
 'create table rakeezx.terms(owner_id uuid not null,id text not null,year_id text not null,status text not null,deleted_at timestamptz,primary key(owner_id,id));',
 'create table rakeezx.sections(owner_id uuid not null,id text not null,year_id text not null,status text not null,deleted_at timestamptz,primary key(owner_id,id));',
 'create table rakeezx.subjects(owner_id uuid not null,id text not null,deleted_at timestamptz,primary key(owner_id,id));',
 'create table rakeezx.teachings(owner_id uuid not null,id text not null,section_id text not null,subject_id text not null,term_id text not null,revision bigint not null default 1,client_updated_at bigint,deleted_at timestamptz,primary key(owner_id,id),unique(owner_id,section_id,subject_id,term_id),foreign key(owner_id,subject_id) references rakeezx.subjects(owner_id,id));',
 'create table rakeezx.students(owner_id uuid not null,id text not null,name text not null,primary key(owner_id,id));',
 'create table rakeezx.enrollments(owner_id uuid not null,id text not null,section_id text not null,student_id text not null,primary key(owner_id,id));',
 'create table rakeezx.items(owner_id uuid not null,id text not null,teaching_id text not null,name text not null,max numeric not null,"order" int not null,auto text,per_point numeric not null default 1,penalty numeric not null default 1,unit_id text,lesson_id text,score_mode text,distribution_mode text,distribution_origin_id text,portability_group_id text,distribution_version bigint not null default 1,deleted_at timestamptz,primary key(owner_id,id));',
 'create table rakeezx.scores(owner_id uuid not null,id text not null,item_id text not null,value numeric,primary key(owner_id,id));',
 'create table rakeezx.score_subitems(owner_id uuid not null,id text not null,item_id text not null,primary key(owner_id,id));',
 ...historyNames.map(name=>'create table rakeezx.'+name+'(owner_id uuid not null,id text not null,teaching_id text not null,primary key(owner_id,id));'),
 'create table rakeezx.submissions(owner_id uuid not null,id text not null,assignment_id text not null,primary key(owner_id,id));',
 'create table rakeezx.closed_term_reports(owner_id uuid not null,id text not null,term_id text not null,primary key(owner_id,id));',
 'create table rakeezx.section_curriculum_scopes(owner_id uuid not null,id text not null,section_id text not null,primary key(owner_id,id));',
 "create function rakeezx.test_sync_v2_stamp_revision() returns trigger language plpgsql security invoker set search_path = '' as $$ begin if new.subject_id is distinct from old.subject_id then new.revision := old.revision+1; end if; return new; end $$;",
 'create trigger test_research_revision before update on rakeezx.teachings for each row execute function rakeezx.test_sync_v2_stamp_revision();',
 ...allNames.flatMap(n=>[
  'alter table rakeezx.'+n+' enable row level security;',
  'create policy '+n+'_owner on rakeezx.'+n+' for all to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));',
  'grant select,insert,update on rakeezx.'+n+' to authenticated;',
 ]),
 'grant usage on schema rakeezx to authenticated;',
].join('\n');
const actor=(db,id)=>db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);
const execSql=(db,sql,args=[])=>db.query(sql,args);
const err=(code)=>e=>{assert.equal(e?.code,code,e?.message);return true};
const call=(pg,id=ID,to=TARGET,revision=1,stamp=1100)=>
  execSql(pg,'select rakeezx.research_change_pristine_teaching_subject($1,$2,$3,$4) as receipt',
    [id,to,revision,stamp]);
const snapshot=async(pg)=>({
  teaching:(await pg.query('select id,subject_id,revision from rakeezx.teachings where owner_id=$1 and id=$2',[A,ID])).rows[0],
  grades:(await pg.query('select count(*)::int n from rakeezx.scores where owner_id=$1',[A])).rows[0].n,
  students:(await pg.query('select count(*)::int n from rakeezx.students where owner_id=$1',[A])).rows[0].n,
  enrollments:(await pg.query('select count(*)::int n from rakeezx.enrollments where owner_id=$1',[A])).rows[0].n,
});
async function withAdmin(pg,callback) {
 await pg.exec('reset role');
 try{return await callback();}
 finally {await pg.exec('set role authenticated');await actor(pg,A);}
}

test('subject correction server-CAS STAGING-ONLY proof: owned, pristine, fail-closed',async t=>{
 const pg=new PGlite();
 try {
   await pg.exec(ddl);
   await pg.query("insert into rakeezx.years(owner_id,id,status) values ($1,'y:1448','active'),($2,'y:1448','active')",[A,B]);
   await pg.query("insert into rakeezx.terms(owner_id,id,year_id,status) values ($1,'tm:1','y:1448','active'),($2,'tm:1','y:1448','active')",[A,B]);
   await pg.query("insert into rakeezx.sections(owner_id,id,year_id,status) values ($1,'sec:1','y:1448','active'),($2,'sec:1','y:1448','active')",[A,B]);
   await pg.query("insert into rakeezx.subjects(owner_id,id) values ($1,$3),($1,$4),($2,$3),($2,$4)",[A,B,OLD,TARGET]);
   await pg.query("insert into rakeezx.teachings(owner_id,id,section_id,subject_id,term_id,revision,client_updated_at) values ($1,$2,'sec:1',$3,'tm:1',1,1000),($4,'tch:33333333-3333-4333-8333-333333333333','sec:1',$3,'tm:1',1,1000)",[A,ID,OLD,B]);
   await pg.query("insert into rakeezx.students(owner_id,id,name) values ($1,'student:test','SYNTHETIC')",[A]);
   await pg.query("insert into rakeezx.enrollments(owner_id,id,section_id,student_id) values ($1,'en:1','sec:1','student:test')",[A]);
   const defaults=[
    ['المشاركة والتفاعل',10,'participation'],['الواجبات',10,null],
    ['الأنشطة والمشاريع',20,null],['الاختبارات القصيرة',20,null],['الاختبار النهائي',40,null],
   ];
   for(let i=0;i<defaults.length;i++)
     await pg.query('insert into rakeezx.items(owner_id,id,teaching_id,name,max,"order",auto) values($1,$2,$3,$4,$5,$6,$7)',
       [A,'item:'+i,ID,defaults[i][0],defaults[i][1],i,defaults[i][2]]);
   await pg.exec(await readFile(sqlFile,'utf8'));
   await pg.exec('set role authenticated');
   await actor(pg,A);
   await t.test('anonymous execution is denied',async()=>{
     await pg.exec('reset role; set role anon;');
     await assert.rejects(call(pg),err('42501'));
     await pg.exec('reset role; set role authenticated');await actor(pg,A);
   });
   await t.test('other owner cannot target account A Teaching or mutate its score history',async()=>{
     await actor(pg,B);
     await assert.rejects(call(pg),err('42501'));
     await actor(pg,A);
     assert.equal((await snapshot(pg)).teaching.subject_id,OLD);
   });
   await t.test('subject derived legacy ID cannot be converted into another subject',async()=>{
     await withAdmin(pg,async()=>{
       await pg.query("insert into rakeezx.teachings(owner_id,id,section_id,subject_id,term_id) values($1,'tch:sec:1|sub:science|tm:1','sec:1',$2,'tm:1')",[A,TARGET]);
     });
     await assert.rejects(call(pg,'tch:sec:1|sub:science|tm:1'),err('23514'));
     await withAdmin(pg,()=>pg.query("delete from rakeezx.teachings where owner_id=$1 and id='tch:sec:1|sub:science|tm:1'",[A]));
   });
   await t.test('stale server revision is a strict conflict, without changes',async()=>{
     await assert.rejects(call(pg,ID,TARGET,9),err('40001'));
     assert.equal((await snapshot(pg)).teaching.revision,1);
   });
   await t.test('default items edited blocks correction, even without scores',async()=>{
     await withAdmin(pg,()=>pg.query('update rakeezx.items set max=11 where owner_id=$1 and id=$2',[A,'item:1']));
     await assert.rejects(call(pg),err('23514'));
     await withAdmin(pg,()=>pg.query('update rakeezx.items set max=10 where owner_id=$1 and id=$2',[A,'item:1']));
   });
   await t.test('grades and linked history block correction without deleting anything',async()=>{
     await withAdmin(pg,()=>pg.query("insert into rakeezx.scores(owner_id,id,item_id,value) values($1,'score:1','item:0',20)",[A]));
     await assert.rejects(call(pg),err('23514'));
     await withAdmin(pg,()=>pg.query("delete from rakeezx.scores where owner_id=$1 and id='score:1'",[A]));
     await withAdmin(pg,()=>pg.query("insert into rakeezx.sessions(owner_id,id,teaching_id) values($1,'se:1',$2)",[A,ID]));
     await assert.rejects(call(pg),err('23514'));
     await withAdmin(pg,()=>pg.query("delete from rakeezx.sessions where owner_id=$1 and id='se:1'",[A]));
   });
   await t.test('V2 course binding and cohort scope block unreviewed relabel',async()=>{
     await withAdmin(pg,()=>pg.query("insert into rakeezx.section_curriculum_scopes(owner_id,id,section_id) values($1,'scope:1','sec:1')",[A]));
     await assert.rejects(call(pg),err('23514'));
     await withAdmin(pg,()=>pg.query("delete from rakeezx.section_curriculum_scopes where owner_id=$1 and id='scope:1'",[A]));
   });
   await t.test('target subject already attached to section+term cannot merge',async()=>{
     await withAdmin(pg,()=>pg.query("insert into rakeezx.teachings(owner_id,id,section_id,subject_id,term_id) values($1,'tch:44444444-4444-4444-8444-444444444444','sec:1',$2,'tm:1')",[A,TARGET]));
     await assert.rejects(call(pg),err('23505'));
     await withAdmin(pg,()=>pg.query("delete from rakeezx.teachings where owner_id=$1 and id='tch:44444444-4444-4444-8444-444444444444'",[A]));
   });
   await t.test('owned, empty Teaching correction updates only material, returns exact advanced server revision',async()=>{
     const before=await snapshot(pg);
     const receipt=(await call(pg)).rows[0].receipt;
     assert.equal(receipt.protocol,'RESEARCH_PRISTINE_SUBJECT_V1');
     assert.equal(receipt.status,'changed');
     assert.equal(receipt.ownerId,A);
     assert.equal(receipt.teachingId,ID);
     assert.equal(receipt.subjectId,TARGET);
     assert.equal(Number(receipt.baseRevision),1);
     assert.equal(Number(receipt.revision),2);
     const after=await snapshot(pg);
     assert.equal(after.teaching.subject_id,TARGET);
     assert.equal(Number(after.teaching.revision),2);
     assert.equal(after.students,before.students);
     assert.equal(after.enrollments,before.enrollments);
     assert.equal(after.grades,before.grades);
     assert.equal((await pg.query('select count(*)::int n from rakeezx.items where owner_id=$1 and teaching_id=$2',[A,ID])).rows[0].n,5);
   });
   await t.test('a repeat with stale revision does not apply or reassign records',async()=>{
     await assert.rejects(call(pg),err('40001'));
     const result=(await call(pg,ID,TARGET,2,1400)).rows[0].receipt;
     assert.equal(result.status,'unchanged');
     assert.equal(Number((await snapshot(pg)).teaching.revision),2);
   });
   await t.test('unknown domain makes the migration fail closed, not silently ignore records',async()=>{
     await withAdmin(pg,()=>pg.exec('drop table rakeezx.group_arrangements'));
     await assert.rejects(call(pg,ID,OLD,2,1500),err('0A000'));
     assert.equal((await snapshot(pg)).teaching.subject_id,TARGET);
   });
 } finally {await pg.close()}
});
