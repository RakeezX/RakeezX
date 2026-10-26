import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {PGlite} from '@electric-sql/pglite';
const sourceFile=fileURLToPath(new URL('./curriculum_v2_sidecars_RESEARCH_ONLY.sql',import.meta.url));
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const fixture=[
'create schema auth;',
'create role authenticated nologin;',
'create role anon nologin;',
'create schema rakeezx;',
"create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;",
'grant usage on schema auth to authenticated;',
'grant execute on function auth.uid() to authenticated;',
'create table rakeezx.years(owner_id uuid not null,id text not null,primary key(owner_id,id));',
'create table rakeezx.subjects(owner_id uuid not null,id text not null,primary key(owner_id,id));',
'create table rakeezx.sections(owner_id uuid not null,id text not null,year_id text not null,grade int check(grade between 1 and 12),label text,primary key(owner_id,id),foreign key(owner_id,year_id) references rakeezx.years(owner_id,id));',
'create table rakeezx.teachings(owner_id uuid not null,id text not null,section_id text not null,subject_id text not null,term_id text not null,primary key(owner_id,id),foreign key(owner_id,section_id) references rakeezx.sections(owner_id,id),foreign key(owner_id,subject_id) references rakeezx.subjects(owner_id,id));'
].join('\n');
const scope=(o={})=>({
 id:'scope:A:one',owner_id:A,section_id:'sec:A',year_id:'y:1448-1449',
 program_key:'general',stage_key:'primary',level_key:'4',track_key:null,
 edition_key:'sncc-v6-114',client_updated_at:1000,...o
});
const binding=(o={})=>({
 id:'binding:A:one',owner_id:A,section_id:'sec:A',
 section_scope_id:'scope:A:one',teaching_id:'tch:A:science',
 subject_id:'sub:science',term_id:'tm:one',
 course_source_key:'sncc:v6:science:grade4',course_name:'العلوم',
 source_edition:'sixth',client_updated_at:1000,...o
});
const insert=(db,table,obj)=>{
 const names=Object.keys(obj);
 return db.query('insert into rakeezx.'+table+' ('+names.map(x=>'"'+x+'"').join(',')+
   ') values ('+names.map((_,i)=>'$'+(i+1)).join(',')+') returning id,owner_id',Object.values(obj));
};
const count=async(db,t)=>Number((await db.query('select count(*)::int as n from rakeezx.'+t)).rows[0].n);
const actor=(db,id)=>db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);
const err=(code)=>(e)=>{assert.equal(e.code,code,e.message);return true};
test('V2 owner-isolated research PostgreSQL schema in ephemeral PGlite',async(t)=>{
 const db=new PGlite();
 try{
  await db.exec(fixture);
  await db.query('insert into rakeezx.years(owner_id,id) values ($1,$3),($2,$3)',[A,B,'y:1448-1449']);
  await db.query('insert into rakeezx.subjects(owner_id,id) values ($1,$3),($2,$3)',[A,B,'sub:science']);
  await db.query("insert into rakeezx.sections(owner_id,id,year_id,grade,label) values ($1,'sec:A','y:1448-1449',4,'Z1'),($1,'sec:A2','y:1448-1449',4,'Z2'),($2,'sec:B','y:1448-1449',4,'Z1')",[A,B]);
  await db.query("insert into rakeezx.teachings(owner_id,id,section_id,subject_id,term_id) values ($1,'tch:A:science','sec:A','sub:science','tm:one'),($1,'tch:A:math','sec:A','sub:science','tm:one'),($1,'tch:A:extra','sec:A','sub:science','tm:one'),($2,'tch:B:science','sec:B','sub:science','tm:one')",[A,B]);
  await db.exec(await readFile(sourceFile,'utf8'));
  await db.exec('set role authenticated;');
  await actor(db,A);
  await t.test('RLS on both new tables',async()=>{
   const rows=(await db.query("select c.relname,c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='rakeezx' and c.relname in ('section_curriculum_scopes','teaching_course_bindings')")).rows;
   assert.equal(rows.length,2);assert.ok(rows.every(x=>x.relrowsecurity));
  });
  await t.test('owner creates scope in existing cohort',async()=>{
   const r=await insert(db,'section_curriculum_scopes',scope());
   assert.equal(r.rows[0].owner_id,A);assert.equal(await count(db,'section_curriculum_scopes'),1);
  });
  await t.test('owner cannot impersonate other owner',async()=>{
   await assert.rejects(insert(db,'section_curriculum_scopes',scope({owner_id:B,id:'scope:B:fake',section_id:'sec:B'})),err('42501'));
  });
  await t.test('owner cannot attach scope to someone else section',async()=>{
   await assert.rejects(insert(db,'section_curriculum_scopes',scope({id:'scope:A:bad',section_id:'sec:B'})),err('23503'));
  });
  await t.test('year must match existing section',async()=>{
   await assert.rejects(insert(db,'section_curriculum_scopes',scope({id:'scope:A:wrong-year',section_id:'sec:A2',year_id:'y:1490-1491'})),err('23503'));
  });
  await t.test('single active scope for one section',async()=>{
   await assert.rejects(insert(db,'section_curriculum_scopes',scope({id:'scope:A:duplicate',program_key:'tahfiz'})),err('23505'));
  });
  await t.test('binding owns a matching teaching and cohort',async()=>{
   const r=await insert(db,'teaching_course_bindings',binding());assert.equal(r.rows[0].owner_id,A);
  });
  await t.test('cross section course link rejected by foreign key',async()=>{
   await assert.rejects(insert(db,'teaching_course_bindings',binding({id:'bad:section',section_id:'sec:B'})),err('23514'));
  });
  await t.test('composite teaching FK rejects linking a B teaching as A',async()=>{
   await assert.rejects(insert(db,'teaching_course_bindings',binding({id:'bad:other-teaching',teaching_id:'tch:B:science'})),err('23503'));
  });
  await t.test('RLS hides A rows when switching to B',async()=>{
   await actor(db,B);
   assert.equal(await count(db,'section_curriculum_scopes'),0);
   assert.equal(await count(db,'teaching_course_bindings'),0);
   await actor(db,A);
  });
  await t.test('B can independently use equivalent grade label',async()=>{
   await actor(db,B);
   await insert(db,'section_curriculum_scopes',scope({owner_id:B,id:'scope:B:one',section_id:'sec:B',program_key:'tahfiz'}));
   assert.equal(await count(db,'section_curriculum_scopes'),1);
   await actor(db,A);assert.equal(await count(db,'section_curriculum_scopes'),1);
  });
  await t.test('one active binding per teaching',async()=>{
   await assert.rejects(insert(db,'teaching_course_bindings',binding({id:'binding:A:dup',course_name:'الرياضيات'})),err('23505'));
  });
  await t.test('two course teachings may share same cohort',async()=>{
   await insert(db,'teaching_course_bindings',binding({id:'binding:A:math',teaching_id:'tch:A:math',course_name:'الرياضيات'}));
   assert.equal(await count(db,'teaching_course_bindings'),2);
  });
  await t.test('course kind is checked by PostgreSQL',async()=>{
   await assert.rejects(insert(db,'teaching_course_bindings',binding({id:'binding:unknown-kind',teaching_id:'tch:A:extra',course_kind:'untrusted_kind'})),err('23514'));
   const r=await insert(db,'teaching_course_bindings',binding({id:'binding:A:extra',teaching_id:'tch:A:extra',course_kind:'learning_domain'}));
   assert.equal(r.rows[0].owner_id,A);
  });
  await t.test('active links block tombstone of parent scope',async()=>{
   await assert.rejects(db.query("update rakeezx.section_curriculum_scopes set deleted_at=now() where owner_id=$1 and id='scope:A:one'",[A]),err('23514'));
  });
  await t.test('retired course link permits one active replacement',async()=>{
   await db.query("update rakeezx.teaching_course_bindings set deleted_at=now() where owner_id=$1 and id='binding:A:one'",[A]);
   await insert(db,'teaching_course_bindings',binding({id:'binding:A:renewed'}));
   const r=(await db.query("select id,deleted_at from rakeezx.teaching_course_bindings where owner_id=$1 and teaching_id='tch:A:science'",[A])).rows;
   assert.equal(r.length,2);assert.equal(r.filter(x=>x.deleted_at===null).length,1);
  });
  await t.test('hard deletes denied to app role',async()=>{
   await assert.rejects(db.query('delete from rakeezx.section_curriculum_scopes where owner_id=$1',[A]),err('42501'));
   await assert.rejects(db.query('delete from rakeezx.teaching_course_bindings where owner_id=$1',[A]),err('42501'));
  });
  await t.test('owner ID reassignment rejected',async()=>{
   await assert.rejects(db.query('update rakeezx.section_curriculum_scopes set owner_id=$1 where owner_id=$2',[B,A]),err('42501'));
  });
  await t.test('version-sixth effective 1448 not assumed',async()=>{
   const r=(await db.query('select edition_year_verified from rakeezx.section_curriculum_scopes where owner_id=$1',[A])).rows;
   assert.equal(r[0].edition_year_verified,false);
  });
  await t.test('anon cannot read scoped curriculum',async()=>{
   await db.exec('reset role; set role anon;');
   await assert.rejects(db.query('select count(*) from rakeezx.section_curriculum_scopes'),err('42501'));
   await db.exec('reset role; set role authenticated;');
   await actor(db,A);
  });
 }finally{await db.close()}
});
