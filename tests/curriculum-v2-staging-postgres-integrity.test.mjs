import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const schemaFile = new URL('../docs/automation-evidence/20261026/curriculum_v2_staging_candidate_NOT_DEPLOYED.sql', import.meta.url);
const fixture = [
  'create schema auth;',
  'create role authenticated nologin;',
  'create role anon nologin;',
  'create schema rakeezx;',
  "create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;",
  'grant usage on schema auth to authenticated;',
  'grant execute on function auth.uid() to authenticated;',
  'create table rakeezx.years(owner_id uuid not null, id text not null, primary key(owner_id,id));',
  'create table rakeezx.subjects(owner_id uuid not null, id text not null, primary key(owner_id,id));',
  'create table rakeezx.sections(owner_id uuid not null,id text not null,year_id text not null,grade int not null,label text,primary key(owner_id,id),foreign key(owner_id,year_id) references rakeezx.years(owner_id,id));',
  'create table rakeezx.teachings(owner_id uuid not null,id text not null,section_id text not null,subject_id text not null,term_id text not null,primary key(owner_id,id),foreign key(owner_id,section_id) references rakeezx.sections(owner_id,id));',
  'create table rakeezx.students(owner_id uuid not null,id text not null, name text, primary key(owner_id,id));',
  'create table rakeezx.scores(owner_id uuid not null,id text not null,value int,primary key(owner_id,id));',
].join('\n');
const scope=(o={})=>({ id:'scope:A:one',owner_id:A,section_id:'sec:A',year_id:'y:1448-1449',
  program_key:'general',stage_key:'primary',level_key:'4',edition_key:'sncc-v6-114',client_updated_at:1000,...o });
const course=(o={})=>({ id:'course:A:science',owner_id:A,section_id:'sec:A',
  section_scope_id:'scope:A:one',teaching_id:'tch:A:science',subject_id:'sub:science',
  term_id:'tm:one',course_source_key:'sncc:science:4',course_name:'العلوم',
  source_edition:'sixth',client_updated_at:1000,...o });
function insert(pg,table,data){
  const columns=Object.keys(data);
  return pg.query('insert into rakeezx.'+table+' ('+columns.map(n=>'"'+n+'"').join(',')+
    ') values ('+columns.map((_,i)=>'$'+(i+1)).join(',')+') returning id,owner_id,server_revision',
    Object.values(data));
}
const act=(pg,owner)=>pg.query("select set_config('request.jwt.claim.sub',$1,false)",[owner]);
const failure=(code)=>e=>{assert.equal(e.code,code,e.message);return true;};

test('Curriculum V2 staging SQL: role, owner, relation, immutability and tombstone gates (local PGlite only)',async t=>{
  const pg=new PGlite();
  try {
    await pg.exec(fixture);
    await pg.query("insert into rakeezx.years(owner_id,id) values ($1,'y:1448-1449'),($2,'y:1448-1449')",[A,B]);
    await pg.query("insert into rakeezx.subjects(owner_id,id) values ($1,'sub:science'),($1,'sub:math'),($2,'sub:science')",[A,B]);
    await pg.query("insert into rakeezx.sections(owner_id,id,year_id,grade,label) values ($1,'sec:A','y:1448-1449',4,'Z1'),($2,'sec:B','y:1448-1449',4,'Z1')",[A,B]);
    await pg.query("insert into rakeezx.teachings(owner_id,id,section_id,subject_id,term_id) values ($1,'tch:A:science','sec:A','sub:science','tm:one'),($1,'tch:A:math','sec:A','sub:math','tm:one'),($1,'tch:A:term','sec:A','sub:science','tm:two'),($2,'tch:B:science','sec:B','sub:science','tm:one')",[A,B]);
    await pg.query("insert into rakeezx.students(owner_id,id,name) values ($1,'student:A','Synthetic')",[A]);
    await pg.query("insert into rakeezx.scores(owner_id,id,value) values ($1,'score:A',17)",[A]);
    await pg.exec(await readFile(schemaFile,'utf8'));
    await pg.exec('set role authenticated;');
    await act(pg,A);
    await t.test('new tables keep RLS and app has no hard DELETE privilege',async()=>{
      const rows=(await pg.query("select c.relname,c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='rakeezx' and c.relname in ('section_curriculum_scopes','teaching_course_bindings')")).rows;
      assert.equal(rows.length,2);
      assert.ok(rows.every(x=>x.relrowsecurity));
      const first=await insert(pg,'section_curriculum_scopes',scope());
      assert.equal(Number(first.rows[0].server_revision),1);
      await insert(pg,'teaching_course_bindings',course());
      await assert.rejects(pg.query('delete from rakeezx.section_curriculum_scopes where id=$1',['scope:A:one']),failure('42501'));
    });
    await t.test('composite FK rejects incorrect subject or term even for same teaching',async()=>{
      await assert.rejects(insert(pg,'teaching_course_bindings',
        course({id:'bad:subject',teaching_id:'tch:A:math',subject_id:'sub:science'})),failure('23503'));
      await assert.rejects(insert(pg,'teaching_course_bindings',
        course({id:'bad:term',teaching_id:'tch:A:term',term_id:'tm:one'})),failure('23503'));
    });
    await t.test('source keys and cohort identifiers cannot silently change',async()=>{
      await assert.rejects(pg.query("update rakeezx.section_curriculum_scopes set program_key='tahfiz',server_revision=2,client_updated_at=1001 where id='scope:A:one'"),failure('23514'));
      await assert.rejects(pg.query("update rakeezx.teaching_course_bindings set course_source_key='fake',server_revision=2,client_updated_at=1001 where id='course:A:science'"),failure('23514'));
    });
    await t.test('revision and clock must both advance atomically',async()=>{
      await assert.rejects(pg.query("update rakeezx.section_curriculum_scopes set review_status='teacher_reviewed' where id='scope:A:one'"),failure('40001'));
      await assert.rejects(pg.query("update rakeezx.section_curriculum_scopes set review_status='teacher_reviewed',server_revision=2,client_updated_at=999 where id='scope:A:one'"),failure('40001'));
      await pg.query("update rakeezx.section_curriculum_scopes set review_status='teacher_reviewed',server_revision=2,client_updated_at=1100 where id='scope:A:one'");
      await assert.rejects(pg.query("update rakeezx.section_curriculum_scopes set review_status='draft',server_revision=2,client_updated_at=1200 where id='scope:A:one'"),failure('40001'));
      const r=(await pg.query("select review_status,server_revision from rakeezx.section_curriculum_scopes where id='scope:A:one'")).rows[0];
      assert.equal(r.review_status,'teacher_reviewed');assert.equal(Number(r.server_revision),2);
    });
    await t.test('cannot claim official 1448 effective-year validation without new authority',async()=>{
      await assert.rejects(pg.query("update rakeezx.section_curriculum_scopes set edition_year_verified=true,server_revision=3,client_updated_at=1300 where id='scope:A:one'"),failure('23514'));
    });
    await t.test('RLS prevents B reading or changing A records; B can use same visible grade/label',async()=>{
      await act(pg,B);
      const found=(await pg.query("select count(*)::int n from rakeezx.section_curriculum_scopes")).rows[0];
      assert.equal(found.n,0);
      const modified=await pg.query("update rakeezx.section_curriculum_scopes set review_status='draft',server_revision=3,client_updated_at=1400 where id='scope:A:one'");
      assert.equal(modified.affectedRows,0);
      await assert.rejects(insert(pg,'section_curriculum_scopes',scope({id:'impersonation',owner_id:A})),failure('42501'));
      await insert(pg,'section_curriculum_scopes',scope({id:'scope:B:one',owner_id:B,section_id:'sec:B',program_key:'tahfiz'}));
      assert.equal((await pg.query('select count(*)::int n from rakeezx.section_curriculum_scopes')).rows[0].n,1);
      await act(pg,A);
    });
    await t.test('refuses tombstoning scope while an active binding remains',async()=>{
      await assert.rejects(pg.query("update rakeezx.section_curriculum_scopes set deleted_at=now(),server_revision=3,client_updated_at=1300 where id='scope:A:one'"),failure('23514'));
    });
    await t.test('requires binding tombstone first and never resurrects it',async()=>{
      await pg.query("update rakeezx.teaching_course_bindings set deleted_at=now(),server_revision=2,client_updated_at=1100 where id='course:A:science'");
      await assert.rejects(pg.query("update rakeezx.teaching_course_bindings set deleted_at=null,server_revision=3,client_updated_at=1200 where id='course:A:science'"),failure('23514'));
      await pg.query("update rakeezx.section_curriculum_scopes set deleted_at=now(),server_revision=3,client_updated_at=1300 where id='scope:A:one'");
      await assert.rejects(pg.query("update rakeezx.section_curriculum_scopes set deleted_at=null,server_revision=4,client_updated_at=1400 where id='scope:A:one'"),failure('23514'));
    });
    await t.test('never physically cascade-delete historical V2 identity from parent',async()=>{
      await pg.exec('reset role;');
      await assert.rejects(pg.query("delete from rakeezx.sections where owner_id=$1 and id='sec:A'",[A]),failure('23503'));
      await pg.exec('set role authenticated;');
      await act(pg,A);
    });
    await t.test('anonymous access is denied by privileges and RLS',async()=>{
      await pg.exec('reset role; set role anon;');
      await assert.rejects(pg.query('select * from rakeezx.section_curriculum_scopes'),failure('42501'));
      await pg.exec('reset role; set role authenticated;');
      await act(pg,A);
    });
    await t.test('student identities and grade values were not changed by the V2 operations',async()=>{
      await pg.exec('reset role;');
      const student=(await pg.query("select name from rakeezx.students where owner_id=$1 and id='student:A'",[A])).rows[0];
      const score=(await pg.query("select value from rakeezx.scores where owner_id=$1 and id='score:A'",[A])).rows[0];
      assert.equal(student.name,'Synthetic');assert.equal(score.value,17);
    });
  }finally{await pg.close()}
});
