import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {evaluateSectionCurriculumScope,evaluateTeachingCourseBinding}
  from '../src/lib/curriculum-context-v2.js';
import {v2ScopeToCloud,v2BindingToCloud}
  from '../src/lib/curriculum-v2-sync-contract.js';

const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const DIGEST='a'.repeat(64);
const sourceURL=new URL('../docs/automation-evidence/20261026/curriculum_v2_staging_candidate_NOT_DEPLOYED.sql',import.meta.url);
const journalURL=new URL('../docs/automation-evidence/20261026/n71_v2_atomic_journal_RESEARCH_ONLY.sql',import.meta.url);
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
  'create table rakeezx.sections(owner_id uuid not null,id text not null,year_id text not null,grade int not null,label text,primary key(owner_id,id),foreign key(owner_id,year_id) references rakeezx.years(owner_id,id));',
  'create table rakeezx.teachings(owner_id uuid not null,id text not null,section_id text not null,subject_id text not null,term_id text not null,primary key(owner_id,id),foreign key(owner_id,section_id) references rakeezx.sections(owner_id,id));',
  'create table rakeezx.students(owner_id uuid not null,id text not null,name text,primary key(owner_id,id));',
  'create table rakeezx.scores(owner_id uuid not null,id text not null,value int,primary key(owner_id,id));',
].join('\n');
const pgOwner=(pg,id)=>pg.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);
const errorCode=(code)=>e=>{assert.equal(e?.code,code,e?.message);return true;};
function envelope(owner,{
  sectionId=owner===A?'sec:A':'sec:B',
  teachingId=owner===A?'tch:A:science':'tch:B:science',
  sourceSubjectId='sub:science',
  yearId='y:1448',
  termId='tm:1',
  scopeStamp=1000,
}={}){
  const scope=evaluateSectionCurriculumScope({
    ownerId:owner,sectionId,yearId,program:'general',stage:'primary',level:'4',legacyGrade:4,
  });
  assert.equal(scope.state,'draft');
  const binding=evaluateTeachingCourseBinding({
    ownerId:owner,sectionScope:scope,sectionId,teachingId,subjectId:sourceSubjectId,
    termId,name:'العلوم',
  });
  assert.equal(binding.state,'draft');
  const scopeRow=v2ScopeToCloud({...scope,id:scope.identity,updatedAt:scopeStamp},owner);
  const bindingRow=v2BindingToCloud({...binding,id:binding.identity,updatedAt:scopeStamp},owner);
  return {scopes:[scopeRow],bindings:[bindingRow]};
}
const sourceDigest=pg=>pg.query(
  'select rakeezx.n71_v2_research_source_digest() as digest'
).then(v=>v.rows[0].digest);
const stage=async(pg,id,payload,revision=7,hash=DIGEST,expectedDigest=null)=>{
  const digest=expectedDigest??await sourceDigest(pg);
  const result=await pg.query(
    'select rakeezx.n71_v2_research_stage($1,$2,$3,$4,$5) as data',
    [id,hash,revision,digest,JSON.stringify(payload)]);
  return result.rows[0].data;
};
const finalize=(pg,id,hash,backupHash=DIGEST)=>pg.query(
  'select rakeezx.n71_v2_research_finalize($1,$2,$3) as data',
  [id,backupHash,hash]).then(v=>v.rows[0].data);
async function privileged(pg,callback){
  await pg.exec('reset role');
  try{return await callback();}
  finally{await pg.exec('set role authenticated');await pgOwner(pg,A);}
}
const count=(pg,table,owner)=>pg.query(
  'select count(*)::int n from rakeezx.'+table+' where owner_id=$1',[owner])
  .then(v=>v.rows[0].n);

test('N71 V2 extension of original stage/finalize/receipt semantics — ephemeral PGlite',async t=>{
  const pg=new PGlite();
  try{
    await pg.exec(fixture);
    await pg.query("insert into rakeezx.years(owner_id,id) values($1,'y:1448'),($2,'y:1448')",[A,B]);
    await pg.query("insert into rakeezx.subjects(owner_id,id) values($1,'sub:science'),($1,'sub:math'),($2,'sub:science')",[A,B]);
    await pg.query("insert into rakeezx.sections(owner_id,id,year_id,grade,label) values($1,'sec:A','y:1448',4,'1'),($1,'sec:A2','y:1448',4,'2'),($2,'sec:B','y:1448',4,'1')",[A,B]);
    await pg.query("insert into rakeezx.teachings(owner_id,id,section_id,subject_id,term_id) values($1,'tch:A:science','sec:A','sub:science','tm:1'),($1,'tch:A2:science','sec:A2','sub:science','tm:1'),($2,'tch:B:science','sec:B','sub:science','tm:1')",[A,B]);
    await pg.query("insert into rakeezx.students(owner_id,id,name) values($1,'student:A','SYNTHETIC')",[A]);
    await pg.query("insert into rakeezx.scores(owner_id,id,value) values($1,'score:A',17)",[A]);
    await pg.exec(await readFile(sourceURL,'utf8'));
    await pg.exec(await readFile(journalURL,'utf8'));
    await pg.query('insert into rakeezx.n71_v2_research_owner_revision(owner_id,revision) values($1,7),($2,2)',[A,B]);
    await pg.exec('set role authenticated');
    await pgOwner(pg,A);
    const intent=envelope(A);
    let receiptStage;
    await t.test('anonymous cannot use either stage or finalize',async()=>{
      await pg.exec('reset role;set role anon');
      await assert.rejects(stage(pg,'n71:a1',intent),errorCode('42501'));
      await assert.rejects(finalize(pg,'n71:a1',DIGEST),errorCode('42501'));
      await pg.exec('reset role;set role authenticated');
      await pgOwner(pg,A);
    });
    await t.test('owner B cannot smuggle foreign sidecars or inspect A journal',async()=>{
      await pgOwner(pg,B);
      try{
        const claim=(await pg.query('select auth.uid()::text as owner')).rows[0].owner;
        assert.equal(claim,B,'test role must be B');
        await assert.rejects(stage(pg,'n71:b-forged',intent,2),errorCode('42501'));
        assert.equal(await count(pg,'n71_v2_research_journal',B),0);
      }finally{await pgOwner(pg,A);}
      assert.equal(await count(pg,'section_curriculum_scopes',A),0);
    });
    await t.test('staging stores a durable exact owner-bound envelope, writes no grades or sidecars',async()=>{
      receiptStage=await stage(pg,'n71:a1',intent);
      assert.equal(receiptStage.state,'staged');
      assert.equal(receiptStage.backupHash,DIGEST);
      assert.equal(receiptStage.stageHash.length,64);
      assert.equal(await count(pg,'n71_v2_research_journal',A),1);
      assert.equal(await count(pg,'section_curriculum_scopes',A),0);
      assert.equal(await count(pg,'teaching_course_bindings',A),0);
    });
    await t.test('authenticated cannot edit journal payload or owner CAS marker directly',async()=>{
      await assert.rejects(pg.query(
        "update rakeezx.n71_v2_research_owner_revision set revision=99 where owner_id=$1",[A]),
        errorCode('42501'));
      await assert.rejects(pg.query(
        "update rakeezx.n71_v2_research_journal set envelope='{}'::jsonb where owner_id=$1",
        [A]),errorCode('42501'));
      await assert.rejects(pg.query(
        "insert into rakeezx.n71_v2_research_journal(owner_id,restore_id,backup_hash,stage_hash,source_revision,envelope) values($1,'forged',$2,$2,7,'{}'::jsonb)",
        [A,DIGEST]),errorCode('42501'));
      const journal=(await pg.query(
        "select envelope from rakeezx.n71_v2_research_journal where owner_id=$1 and restore_id='n71:a1'",
        [A])).rows[0];
      assert.deepEqual(journal.envelope,intent);
    });
    await t.test('lost stage HTTP response: exact retry returns same hash, only one stage',async()=>{
      const second=await stage(pg,'n71:a1',intent);
      assert.deepEqual(second,receiptStage);
      assert.equal(await count(pg,'n71_v2_research_journal',A),1);
    });
    await t.test('same restore ID with modified content is never accepted',async()=>{
      const changed=structuredClone(intent);
      changed.scopes[0].review_status='teacher_reviewed';
      await assert.rejects(stage(pg,'n71:a1',changed),errorCode('22023'));
      assert.equal(await count(pg,'section_curriculum_scopes',A),0);
    });
    await t.test('unknown restore or incorrect stage hash cannot finalize',async()=>{
      await assert.rejects(finalize(pg,'n71:unknown',receiptStage.stageHash),errorCode('22023'));
      await assert.rejects(finalize(pg,'n71:a1','b'.repeat(64)),errorCode('22023'));
    });
    let done;
    await t.test('atomic finalize writes same-scope course and exactly one owner revision',async()=>{
      done=await finalize(pg,'n71:a1',receiptStage.stageHash);
      assert.equal(done.protocol,'N71_V2_RESEARCH_ONLY');
      assert.equal(done.restoreId,'n71:a1');
      assert.equal(done.receipt.status,'finalized');
      assert.equal(Number(done.ownerRevision),8);
      assert.equal(done.receipt.addedScopes,1);
      assert.equal(done.receipt.addedBindings,1);
      assert.equal(done.canonicalDigest.length,64);
      assert.equal(await count(pg,'section_curriculum_scopes',A),1);
      assert.equal(await count(pg,'teaching_course_bindings',A),1);
    });
    await t.test('lost finalize response: same request returns immutable receipt, no second write',async()=>{
      const retry=await finalize(pg,'n71:a1',receiptStage.stageHash);
      assert.deepEqual(retry,done);
      assert.equal(await count(pg,'section_curriculum_scopes',A),1);
      assert.equal(await count(pg,'teaching_course_bindings',A),1);
      const revision=(await pg.query('select revision from rakeezx.n71_v2_research_owner_revision where owner_id=$1',[A])).rows[0].revision;
      assert.equal(Number(revision),8);
    });
    await t.test('same scope restored under another ID fails uniqueness, leaves durable old history',async()=>{
      const dup=await stage(pg,'n71:a-duplicate',intent,8);
      await assert.rejects(finalize(pg,'n71:a-duplicate',dup.stageHash),errorCode('23505'));
      const stageRow=(await pg.query("select state from rakeezx.n71_v2_research_journal where restore_id='n71:a-duplicate'")).rows[0];
      assert.equal(stageRow.state,'staged');
      assert.equal(await count(pg,'teaching_course_bindings',A),1);
    });
    await t.test('other owner has independent namespace, RLS and a distinct durable receipt',async()=>{
      await pgOwner(pg,B);
      const target=envelope(B);
      const bStage=await stage(pg,'n71:b1',target,2,'b'.repeat(64));
      const bDone=await finalize(pg,'n71:b1',bStage.stageHash,'b'.repeat(64));
      assert.equal(Number(bDone.ownerRevision),3);
      assert.equal(await count(pg,'section_curriculum_scopes',B),1);
      assert.equal(await count(pg,'teaching_course_bindings',B),1);
      const rows=(await pg.query('select restore_id from rakeezx.n71_v2_research_journal')).rows;
      assert.deepEqual(rows.map(x=>x.restore_id),['n71:b1']);
      await pgOwner(pg,A);
    });
    await t.test('staged independent change cannot finalize over a changed owner marker',async()=>{
      const next=envelope(A,{sectionId:'sec:A2',teachingId:'tch:A2:science'});
      const saved=await stage(pg,'n71:a2',next,8,'c'.repeat(64));
      await privileged(pg,()=>pg.query('update rakeezx.n71_v2_research_owner_revision set revision=9 where owner_id=$1',[A]));
      await assert.rejects(finalize(pg,'n71:a2',saved.stageHash,'c'.repeat(64)),errorCode('40001'));
      assert.equal(await count(pg,'section_curriculum_scopes',A),1);
      assert.equal(await count(pg,'teaching_course_bindings',A),1);
    });
    await t.test('invalid course FK rolls back the new scope and retains the previous owner revision',async()=>{
      const invalid=envelope(A,{sectionId:'sec:A2',teachingId:'tch:A2:science'});
      invalid.bindings[0].subject_id='sub:math';
      const saved=await stage(pg,'n71:a3',invalid,9,'d'.repeat(64));
      await assert.rejects(finalize(pg,'n71:a3',saved.stageHash,'d'.repeat(64)),errorCode('23503'));
      assert.equal(await count(pg,'section_curriculum_scopes',A),1);
      assert.equal(await count(pg,'teaching_course_bindings',A),1);
    });
    await t.test('staging requires the canonical content digest, not revision alone',async()=>{
      const next=envelope(A,{sectionId:'sec:A2',teachingId:'tch:A2:science'});
      await assert.rejects(stage(pg,'n71:a-digest-old',next,9,'e'.repeat(64),
        '0'.repeat(64)),errorCode('40001'));
      const revision=(await pg.query(
        'select revision from rakeezx.n71_v2_research_owner_revision where owner_id=$1',[A])
      ).rows[0].revision;
      assert.equal(Number(revision),9);
    });
    await t.test('same owner revision with changed sidecar bytes blocks stale finalize',async()=>{
      const next=envelope(A,{sectionId:'sec:A2',teachingId:'tch:A2:science'});
      const saved=await stage(pg,'n71:a-content-drift',next,9,'e'.repeat(64));
      const before=(await pg.query(
        'select revision from rakeezx.n71_v2_research_owner_revision where owner_id=$1',[A]
      )).rows[0].revision;
      await pg.query(
        "update rakeezx.section_curriculum_scopes set review_status='needs_review',server_revision=2,client_updated_at=2001 where owner_id=$1",[A]);
      const after=(await pg.query(
        'select revision from rakeezx.n71_v2_research_owner_revision where owner_id=$1',[A]
      )).rows[0].revision;
      assert.equal(Number(before),Number(after));
      await assert.rejects(finalize(pg,'n71:a-content-drift',saved.stageHash,
        'e'.repeat(64)),errorCode('40001'));
      assert.equal(await count(pg,'section_curriculum_scopes',A),1);
      assert.equal(await count(pg,'teaching_course_bindings',A),1);
    });
    await t.test('scores and student IDs survive stage, finalize, replay and rejected operations',async()=>{
      await privileged(pg,async()=>{
        const rows=(await pg.query('select id,value from rakeezx.scores where owner_id=$1',[A])).rows;
        const students=(await pg.query('select id from rakeezx.students where owner_id=$1',[A])).rows;
        assert.deepEqual(rows,[{id:'score:A',value:17}]);
        assert.deepEqual(students,[{id:'student:A'}]);
        assert.equal((await pg.query('select revision from rakeezx.n71_v2_research_owner_revision where owner_id=$1',[A])).rows[0].revision,9);
      });
    });
  }finally{await pg.close();}
});
