import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { IDBFactory } from 'fake-indexeddb';
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';

import * as db from '../src/lib/db.js';
import { evaluateSectionCurriculumScope, evaluateTeachingCourseBinding } from '../src/lib/curriculum-context-v2.js';
import { createCurriculumV2StagingBridge } from '../src/lib/curriculum-v2-staging-bridge.js';
import { createCurriculumV2SyntheticCloudApplier, CURRICULUM_V2_SYNTHETIC_CLOUD_PROTOCOL } from '../src/lib/curriculum-v2-staging-cloud-apply.js';

globalThis.crypto ??= webcrypto;
const OWNER='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const academic = {
  years:[{id:'year:1448',label:'1448-1449',updatedAt:1}],
  sections:[{id:'sec:A',ownerId:OWNER,yearId:'year:1448',grade:4,label:'Z1',updatedAt:2}],
  subjects:[{id:'sub:science',name:'العلوم',updatedAt:3}],
  terms:[{id:'term:1',yearId:'year:1448',index:1,updatedAt:4}],
  teachings:[{id:'teaching:science',sectionId:'sec:A',subjectId:'sub:science',termId:'term:1',updatedAt:5}],
  students:[{id:'student:synthetic',name:'Synthetic child',updatedAt:6}],
  scores:[{id:'score:synthetic',itemId:'item:synthetic',studentId:'student:synthetic',value:17,updatedAt:7}],
};
const failure = code => e=>e?.code===code;
const stageSql=new URL('../docs/automation-evidence/20261026/curriculum_v2_staging_candidate_NOT_DEPLOYED.sql',import.meta.url);
const fixture = [
  'create schema auth; create role authenticated nologin; create role anon nologin; create schema rakeezx;',
  "create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;",
  'grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;',
  'create table rakeezx.years(owner_id uuid not null,id text not null,primary key(owner_id,id));',
  'create table rakeezx.subjects(owner_id uuid not null,id text not null,primary key(owner_id,id));',
  'create table rakeezx.sections(owner_id uuid not null,id text not null,year_id text not null,grade int,primary key(owner_id,id));',
  'create table rakeezx.teachings(owner_id uuid not null,id text not null,section_id text not null,subject_id text not null,term_id text not null,primary key(owner_id,id));'
].join('\n');
const insert = (pg,table,row) => {
  const cols=Object.keys(row);
  return pg.query('insert into rakeezx.'+table+' ('+cols.map(c=>'"'+c+'"').join(',')+
    ') values ('+cols.map((_,i)=>'$'+(i+1)).join(',')+')',Object.values(row));
};
const actor=(pg,id)=>pg.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);

test('two synthetic devices use Product IndexedDB + owner-RLS PostgreSQL staged snapshots (no live Cloud)',async t=>{
  const pg=new PGlite();
  const factoryA=new IDBFactory(),factoryB=new IDBFactory();
  const savedFactory=globalThis.indexedDB;
  let owner=OWNER,tickA=1793000100000,tickB=1793000100100;
  db.selectDatabase('rakeezx-demo');
  db.setProductWriteGuard(()=>{});
  const make=(factory,which)=>{
    db.closeDB();
    globalThis.indexedDB=factory;
    const clock=which==='A'?()=>++tickA:()=>++tickB;
    const bridge=createCurriculumV2StagingBridge({database:db,currentOwner:()=>owner,
      clock,allowSyntheticWrites:true});
    const applier=createCurriculumV2SyntheticCloudApplier({
      database:db,bridge,currentOwner:()=>owner,
    });
    return {bridge,applier};
  };
  const receipt={protocol:CURRICULUM_V2_SYNTHETIC_CLOUD_PROTOCOL,
    ownerId:OWNER,verified:true,fullSnapshot:true};
  async function pull() {
    return {
      scopes:(await pg.query('select * from rakeezx.section_curriculum_scopes order by id')).rows,
      bindings:(await pg.query('select * from rakeezx.teaching_course_bindings order by id')).rows,
    };
  }
  try {
    await pg.exec(fixture);
    await pg.query("insert into rakeezx.years(owner_id,id) values ($1,'year:1448'),($2,'year:1448')",[OWNER,OTHER]);
    await pg.query("insert into rakeezx.subjects(owner_id,id) values ($1,'sub:science'),($2,'sub:science')",[OWNER,OTHER]);
    await pg.query("insert into rakeezx.sections(owner_id,id,year_id,grade) values ($1,'sec:A','year:1448',4),($2,'sec:B','year:1448',4)",[OWNER,OTHER]);
    await pg.query("insert into rakeezx.teachings(owner_id,id,section_id,subject_id,term_id) values ($1,'teaching:science','sec:A','sub:science','term:1'),($2,'teaching:B','sec:B','sub:science','term:1')",[OWNER,OTHER]);
    await pg.exec(await readFile(stageSql,'utf8'));
    await pg.exec('set role authenticated;');
    await actor(pg,OWNER);
    const draft=evaluateSectionCurriculumScope({
      ownerId:OWNER,sectionId:'sec:A',yearId:'year:1448',
      program:'general',stage:'primary',level:'4',legacyGrade:4,
    });
    const course=evaluateTeachingCourseBinding({
      ownerId:OWNER,sectionScope:draft,sectionId:'sec:A',
      teachingId:'teaching:science',subjectId:'sub:science',
      termId:'term:1',name:'العلوم',
    });
    let deviceA=make(factoryA,'A');
    await db.putAcross(academic);
    await t.test('device A persists scope and binding with their pending synthetic Outbox',async()=>{
      await deviceA.bridge.saveScope(draft);
      await deviceA.bridge.saveBinding(course);
      const pending=await db.getAll('outbox');
      assert.equal(pending.length,2);
      assert.ok(pending.every(row=>row.protocol==='curriculum-v2-synthetic'&&row.state==='pending'));
      assert.equal((await db.getAll('scores'))[0].value,17);
    });
    await t.test('device A sends only the allowlisted V2 envelope into local owner-RLS PostgreSQL',async()=>{
      const preview=await deviceA.bridge.previewCloudRows(OWNER);
      assert.equal(preview.enabled,false);
      await insert(pg,'section_curriculum_scopes',preview.scopes[0]);
      await insert(pg,'teaching_course_bindings',preview.bindings[0]);
      assert.equal((await pull()).scopes.length,1);
    });
    await t.test('exact same server receipt acknowledges both pending rows on A',async()=>{
      const outcome=await deviceA.applier.applyFullSnapshot(OWNER,await pull(),receipt);
      assert.equal(outcome.acknowledgements,2);
      assert.equal(outcome.cloudActivated,false);
      assert.equal((await db.getAll('outbox')).length,0);
      assert.equal((await db.getAll('scores'))[0].value,17);
    });
    let deviceB=make(factoryB,'B');
    await db.putAcross(academic);
    await t.test('device B imports server records into real Product IndexedDB without touching scores',async()=>{
      const result=await deviceB.applier.applyFullSnapshot(OWNER,await pull(),receipt);
      assert.equal(result.scopes,1);assert.equal(result.bindings,1);
      const snap=await deviceB.bridge.snapshot(OWNER);
      assert.equal(snap.sectionCurriculumScopes[0].program,'general');
      assert.equal(snap.teachingCourseBindings[0].name,'العلوم');
      assert.equal((await db.getAll('outbox')).length,0);
      assert.equal((await db.getAll('scores'))[0].value,17);
    });
    await t.test('device B closes/reopens without losing its confirmed source context',async()=>{
      deviceB=make(factoryB,'B');
      assert.equal((await deviceB.bridge.snapshot(OWNER)).teachingCourseBindings[0].id,course.identity);
    });
    await t.test('fabricated receipt and wrong-account remote row are rejected without writes',async()=>{
      await assert.rejects(deviceB.applier.applyFullSnapshot(OWNER,await pull(),
        {...receipt,verified:false}),failure('CURRICULUM_V2_UNVERIFIED_SIMULATION_RECEIPT'));
      const tampered=await pull();
      tampered.scopes[0].owner_id=OTHER;
      await assert.rejects(deviceB.applier.applyFullSnapshot(OWNER,tampered,receipt),/V2_OWNER_CONTEXT_MISMATCH/);
      assert.equal((await db.getAll('scores'))[0].value,17);
    });
    await t.test('stale and contradictory server revision evidence fails closed',async()=>{
      const regressed=await pull();
      regressed.scopes[0].server_revision=0;
      await assert.rejects(deviceB.applier.applyFullSnapshot(OWNER,regressed,receipt),
        failure('CURRICULUM_V2_REMOTE_REVISION_INVALID'));
      const badClock=await pull();
      badClock.scopes[0].server_revision=2;
      await assert.rejects(deviceB.applier.applyFullSnapshot(OWNER,badClock,receipt),
        failure('CURRICULUM_V2_REMOTE_REVISION_TIME_CONFLICT'));
      const missingRevision=await pull();
      missingRevision.scopes[0].client_updated_at+=1;
      await assert.rejects(deviceB.applier.applyFullSnapshot(OWNER,missingRevision,receipt),
        failure('CURRICULUM_V2_REMOTE_SAME_REVISION_CONFLICT'));
      assert.equal((await db.getAll('outbox')).length,0);
      assert.equal((await db.getAll('scores'))[0].value,17);
    });
    await t.test('RLS and bridge reject a different owner looking at teacher A',async()=>{
      await actor(pg,OTHER);
      assert.equal((await pull()).scopes.length,0);
      owner=OTHER;
      await assert.rejects(deviceB.bridge.snapshot(OWNER),failure('CURRICULUM_V2_OWNER_CONTEXT_CHANGED'));
      owner=OWNER;await actor(pg,OWNER);
    });
    await t.test('device B offline successor remains queued through stale pull',async()=>{
      await deviceB.bridge.saveScope(draft);
      const pending=await db.getAll('outbox');
      assert.equal(pending.length,1);
      assert.equal(pending[0].baseRevision,1);
      const result=await deviceB.applier.applyFullSnapshot(OWNER,await pull(),receipt);
      assert.equal(result.localPending,1);
      assert.equal((await db.getAll('outbox')).length,1);
      assert.equal((await db.getAll('scores'))[0].value,17);
    });
    deviceA=make(factoryA,'A');
    await t.test('device A retires course then cohort, PG stores versioned tombstones',async()=>{
      tickA=tickB+1000;
      const link=await deviceA.bridge.retireBinding(OWNER,course.identity);
      const section=await deviceA.bridge.retireScope(OWNER,draft.identity);
      await pg.query("update rakeezx.teaching_course_bindings set deleted_at=$1,client_updated_at=$2,server_revision=2 where owner_id=$3 and id=$4",
        [link.deletedAt,link.updatedAt,OWNER,link.id]);
      await pg.query("update rakeezx.section_curriculum_scopes set deleted_at=$1,client_updated_at=$2,server_revision=2 where owner_id=$3 and id=$4",
        [section.deletedAt,section.updatedAt,OWNER,section.id]);
      const remote=await pull();
      const ack=await deviceA.applier.applyFullSnapshot(OWNER,remote,receipt);
      assert.equal(ack.acknowledgements,2);
      assert.equal((await db.getAll('outbox')).length,0);
    });
    deviceB=make(factoryB,'B');
    await t.test('device B cannot silently overwrite an unsent offline change with remote deletion',async()=>{
      const before=await deviceB.bridge.snapshot(OWNER);
      await assert.rejects(deviceB.applier.applyFullSnapshot(OWNER,await pull(),receipt),
        failure('CURRICULUM_V2_UNACKNOWLEDGED_LOCAL_CONFLICT'));
      assert.deepEqual(await deviceB.bridge.snapshot(OWNER),before);
      assert.equal((await db.getAll('outbox')).length,1);
      assert.equal((await db.getAll('scores'))[0].value,17);
    });
    deviceA=make(factoryA,'A');
    await t.test('device A restart retains both cloud-acknowledged tombstones, without resurrection',async()=>{
      const values=await deviceA.bridge.snapshot(OWNER);
      assert.equal(values.sectionCurriculumScopes[0].deleted,true);
      assert.equal(values.teachingCourseBindings[0].deleted,true);
      assert.equal((await db.getAll('scores'))[0].value,17);
      await assert.rejects(deviceA.bridge.saveScope(draft),
        failure('CURRICULUM_V2_TOMBSTONE_RESURRECTION'));
    });
  }finally{
    db.closeDB();db.setProductWriteGuard(null);globalThis.indexedDB=savedFactory;
    await pg.close();
  }
});
