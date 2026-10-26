import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {IDBFactory} from 'fake-indexeddb';
import * as db from '../src/lib/db.js';
import {evaluateSectionCurriculumScope,evaluateTeachingCourseBinding} from '../src/lib/curriculum-context-v2.js';
import {createCurriculumV2StagingBridge} from '../src/lib/curriculum-v2-staging-bridge.js';
import {createN71V2DemoRestore} from '../src/lib/curriculum-v2-n71-demo-restore.js';
import {N71_V2_RESEARCH_STORES} from '../src/lib/curriculum-v2-n71-stage.js';
import {buildBackup,validateBackupIntegrity} from '../src/lib/export.js';
import {assertCurriculumV2CloudPayloadSupported} from '../src/lib/curriculum-v2-cloud-restore-gate.js';

globalThis.crypto ??= webcrypto;
const OWNER='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const factoryA=new IDBFactory(),factoryB=new IDBFactory(),factoryC=new IDBFactory();
const prevFactory=globalThis.indexedDB;
const yearId='y:1448-1449',sectionId='sec:synthetic-n71',termId='tm:one';
const teachingId='tch:synthetic-science',subjectId='sub:science';
const fail=code=>error=>error?.code===code;
let owner=OWNER,lease=true,clock=1793010203040;
db.selectDatabase('rakeezx-demo');
db.setProductWriteGuard(()=>{if(!lease)throw Object.assign(
  new Error('synthetic offline lease'),{code:'OFFLINE_LEASE_LIMITED'});});
function switchDevice(factory){ db.closeDB();globalThis.indexedDB=factory; }
const restore=createN71V2DemoRestore({
  database:db,currentOwner:()=>owner,enabled:true,
});
const baseline={
  years:[{id:yearId,ownerId:OWNER,label:'1448-1449',status:'active',updatedAt:100}],
  terms:[{id:termId,ownerId:OWNER,yearId,index:1,status:'active',updatedAt:101}],
  sections:[{id:sectionId,ownerId:OWNER,yearId,grade:4,label:'1',updatedAt:102}],
  subjects:[{id:subjectId,ownerId:OWNER,name:'العلوم',updatedAt:103}],
  teachings:[{id:teachingId,ownerId:OWNER,sectionId,termId,subjectId,updatedAt:104}],
  students:[{id:'student:n71',name:'طالب تجريبي',ownerId:OWNER,updatedAt:105}],
  enrollments:[{id:'enrollment:n71',sectionId,studentId:'student:n71',
    ownerId:OWNER,status:'active',updatedAt:106}],
  items:[{id:'item:n71',teachingId,max:20,ownerId:OWNER,updatedAt:107}],
  scores:[{id:'score:n71',itemId:'item:n71',studentId:'student:n71',
    value:16,ownerId:OWNER,updatedAt:108}],
};
const scopeDraft=evaluateSectionCurriculumScope({
 ownerId:OWNER,sectionId,yearId,program:'general',stage:'primary',
 level:'4',legacyGrade:4,
});
const bindingDraft=evaluateTeachingCourseBinding({
 ownerId:OWNER,sectionScope:scopeDraft,sectionId,teachingId,subjectId,
 termId,name:'العلوم',
});
const emptyCloud=()=>Object.fromEntries(N71_V2_RESEARCH_STORES.map(n=>[n,[]]));
test('real Product IndexedDB V5 Backup → synthetic N71 V2 fresh-device restore',async t=>{
 let bundle;
 try{
  switchDevice(factoryA);
  await db.clearAll();
  await db.putAcross(baseline);
  const bridge=createCurriculumV2StagingBridge({
    database:db,currentOwner:()=>owner,clock:()=>++clock,allowSyntheticWrites:true,
  });
  await bridge.saveScope(scopeDraft);
  await bridge.saveBinding(bindingDraft);
  bundle=await buildBackup({sourceOwnerId:OWNER,backupId:'n71-synthetic-real-backup'});
  await t.test('source contains legacy students and grades plus both V2 sidecars',async()=>{
    assert.equal((await validateBackupIntegrity(bundle)).integrity,'verified');
    assert.equal(bundle.data.scores[0].value,16);
    assert.equal(bundle.data.students[0].id,'student:n71');
    assert.equal(bundle.data.sectionCurriculumScopes.length,1);
    assert.equal(bundle.data.teachingCourseBindings.length,1);
    assert.equal('outbox' in bundle.data,false);
    assert.throws(()=>assertCurriculumV2CloudPayloadSupported(bundle),
      fail('CURRICULUM_V2_CLOUD_RESTORE_NOT_READY'));
  });
  switchDevice(factoryB);
  await db.clearAll();
  await t.test('fresh B atomically restores full Product domain after approved research-only preflight',async()=>{
    const receipt=await restore.intoFresh({
      ownerId:OWNER,payload:bundle,serverData:emptyCloud(),ownerHistoryRevision:'0',
    });
    assert.equal(receipt.status,'synthetic_restored');
    assert.equal(receipt.cloudRestoreSupported,false);
    assert.equal(receipt.serverConfirmed,false);
    assert.equal(receipt.manifestDigest.length,64);
    assert.equal((await db.getAll('students')).length,1);
    assert.equal((await db.getAll('scores'))[0].value,16);
    assert.equal((await db.getAll('enrollments'))[0].studentId,'student:n71');
    assert.equal((await db.getAll('sectionCurriculumScopes'))[0].id,scopeDraft.identity);
    assert.equal((await db.getAll('teachingCourseBindings'))[0].id,bindingDraft.identity);
    assert.equal((await db.getAll('outbox')).length,0);
  });
  await t.test('restarting B retains all restored identities, marks, and V6 course',async()=>{
    switchDevice(factoryB);
    assert.equal((await db.get('students','student:n71')).name,'طالب تجريبي');
    assert.equal((await db.get('scores','score:n71')).value,16);
    assert.equal((await db.get('sectionCurriculumScopes',scopeDraft.identity)).program,'general');
    assert.equal((await db.get('teachingCourseBindings',bindingDraft.identity)).name,'العلوم');
  });
  await t.test('B existing data cannot be overwritten or replayed as an empty account',async()=>{
    await assert.rejects(restore.intoFresh({
      ownerId:OWNER,payload:bundle,serverData:emptyCloud(),ownerHistoryRevision:'0',
    }),fail('N71_V2_FRESH_RECEIVER_REQUIRED'));
    assert.equal((await db.get('scores','score:n71')).value,16);
  });
  await t.test('owner switch denies reads/write intent without modifying student data',async()=>{
    owner=OTHER;
    await assert.rejects(restore.intoFresh({
      ownerId:OWNER,payload:bundle,serverData:emptyCloud(),ownerHistoryRevision:'0',
    }),fail('N71_V2_OWNER_CHANGED'));
    owner=OWNER;
    assert.equal((await db.get('scores','score:n71')).value,16);
  });
  switchDevice(factoryC);
  await db.clearAll();
  await t.test('Product offline lease blocks entire new restore (including sidecars)',async()=>{
    lease=false;
    await assert.rejects(restore.intoFresh({
      ownerId:OWNER,payload:bundle,serverData:emptyCloud(),ownerHistoryRevision:'0',
    }),fail('OFFLINE_LEASE_LIMITED'));
    lease=true;
    assert.equal((await db.getAll('students')).length,0);
    assert.equal((await db.getAll('scores')).length,0);
    assert.equal((await db.getAll('sectionCurriculumScopes')).length,0);
    assert.equal((await db.getAll('teachingCourseBindings')).length,0);
  });
  await t.test('incomplete provider snapshot cannot write any Product row',async()=>{
    const incomplete=emptyCloud();delete incomplete.teachingCourseBindings;
    await assert.rejects(restore.intoFresh({
      ownerId:OWNER,payload:bundle,serverData:incomplete,ownerHistoryRevision:'0',
    }),fail('N71_V2_SERVER_STORE_MISSING:teachingCourseBindings'));
    assert.deepEqual(await db.getAll('students'),[]);
  });
  await t.test('caller mutation while integrity is pending cannot change verified bytes',async()=>{
    const input=structuredClone(bundle);
    const remote=emptyCloud();
    const pending=restore.intoFresh({
      ownerId:OWNER,payload:input,serverData:remote,ownerHistoryRevision:'0',
    });
    // These input objects are deliberately mutated after the call, before
    // async SHA-256 validation finishes. Only the sealed copies may be used.
    input.data.scores[0].value=999;
    remote.students.push({id:'student:untrusted',ownerId:OWNER,
      name:'MUTATED AFTER VALIDATION START',updatedAt:150});
    const receipt=await pending;
    assert.equal(receipt.status,'synthetic_restored');
    assert.equal((await db.get('scores','score:n71')).value,16);
    assert.equal((await db.getAll('students')).length,1);
    assert.equal((await db.get('students','student:untrusted')),undefined);
    assert.equal((await db.getAll('teachingCourseBindings')).length,1);
    assert.deepEqual(await db.getAll('outbox'),[]);
  });
 }finally{
   db.closeDB();db.setProductWriteGuard(null);globalThis.indexedDB=prevFactory;
 }
});
