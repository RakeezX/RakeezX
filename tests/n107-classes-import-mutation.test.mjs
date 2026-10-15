// AI: actual account store + fake IndexedDB; no service, credentials or real data.
import 'fake-indexeddb/auto';
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import * as s from '../src/store.js';
import * as d from '../src/lib/db.js';
import * as c from '../src/lib/cloud.js';
import { runtimeOfflineLease } from '../src/lib/offline-lease.js';
import { accountWorkspaceDatabaseName } from '../src/lib/workspaces.js';
import { fixture, owner, foreignOwner } from './n73-account-flow-fixture.mjs';
import { classGroups, detectClassColumns } from '../src/lib/class-import-file.js';
import { makeSection, makeStudent, makeEnrollment } from '../src/models.js';
const storage = new Map();
global.localStorage = { getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k),key:i=>[...storage.keys()][i],get length(){return storage.size;} };
const group = (label='أ', name='طالب اصطناعي', grade=4) => {
  const rows = [['الصف','الفصل','المادة','اسم الطالب'],[grade,label,'الرياضيات',name]];
  return classGroups(rows,detectClassColumns(rows))[0];
};
async function prepare() {
  s.state.ready=false;s.closeChannel();d.closeDB();storage.clear();
  const rows=fixture(),receipt={ownerId:owner,contractVersion:1,foundationHash:'n107-synthetic'};
  rows.device[0].accountProvisioningReceipt=receipt;
  const session={access_token:'synthetic-only',user:{id:owner}};
  localStorage.setItem(c.AUTH_STORAGE_KEY,JSON.stringify(session));c.setMockAuth(session.user,session);
  s.activateWorkspace({id:'account:n107',type:'account',authUserId:owner,ownershipState:'claimed',syncEligible:true,
    databaseName:await accountWorkspaceDatabaseName(owner),broadcastChannelName:'n107-unit',workspaceKind:'account-provisioned',leaseGeneration:JSON.stringify([owner,null,null,receipt])});
  await d.clearAll();
  for(const name of d.STORES) {
    const records=rows[name]??[];
    s.state[name]=name==='device'||name==='profile'?records[0]:records;
    if(records.length)await d.putMany(name,records);
  }
  await runtimeOfflineLease().renew(async()=>({id:owner,source:'supabase-auth-user',verifiedAt:Date.now()}));s.state.ready=true;
}
const checkpoint=async()=>JSON.stringify(await Promise.all(['sections','subjects','teachings','students','enrollments','items','scores','outbox'].map(n=>d.getAll(n))));
after(()=>{s.closeChannel();d.closeDB();});
test('preview/cancel zero writes; one explicit group creates defaults and isolated names; replay adds nothing',async()=>{
  await prepare();const before=await checkpoint(),review=s.reviewClassImport(group());
  assert.equal(await checkpoint(),before);await s.confirmClassImport(review,false);assert.equal(await checkpoint(),before);
  const result=await s.confirmClassImport(review,true);assert.equal(result.added,1);assert.equal(s.students(result.teachingId).length,1);
  assert.ok(s.state.items.filter(row=>row.teachingId===result.teachingId).length>0);
  assert.equal(s.state.scores.length,4);const saved=await checkpoint();await s.confirmClassImport(review,true);assert.equal(await checkpoint(),saved);
  assert.throws(()=>s.reviewClassImport(group()));
  const second=await s.confirmClassImport(s.reviewClassImport(group('ب')),true);
  assert.notEqual(s.students(result.teachingId)[0].id,s.students(second.teachingId)[0].id);
  assert.equal((await d.getAll('scores')).length,4);
  assert.ok((await d.getAll('outbox')).every(row=>row.ownerId===owner));
});
test('no-name class, existing/archived rejection, same label in another year stays separate',async()=>{
  await prepare();s.state.sections.push({...s.state.sections[0],id:'old-year',yearId:'old',grade:4,label:'أ'});
  const result=await s.confirmClassImport(s.reviewClassImport(group('أ','')),true);assert.equal(result.added,0);
  const section=s.getSection(result.sectionId);section.status='archived';assert.throws(()=>s.reviewClassImport(group('أ')));
  assert.equal(s.getSection('old-year').yearId,'old');
});
test('actual owner/session/database/provenance/term gates reject before creating',async()=>{
  for(const kind of ['user','session','storage','database','provenance','year','term','closed','foreign-year','unready']) {
    await prepare();const review=s.reviewClassImport(group());const before=await checkpoint();
    if(kind==='user')c.setMockAuth({id:foreignOwner},c.session);
    if(kind==='session')c.setMockAuth(c.user,{...c.session});
    if(kind==='storage')localStorage.removeItem(c.AUTH_STORAGE_KEY);
    if(kind==='database'){d.closeDB();d.selectDatabase(await accountWorkspaceDatabaseName(foreignOwner));}
    if(kind==='provenance')s.state.device.accountProvisioningReceipt.ownerId=foreignOwner;
    if(kind==='year'){s.state.years.push({...s.activeYear(),id:'other'});s.state.device.activeYearId='other';}
    if(kind==='term')s.state.device.activeTermId=s.state.terms[1].id;
    if(kind==='closed')s.activeTerm().status='closed';
    if(kind==='foreign-year')s.activeYear().ownerId=foreignOwner;
    if(kind==='unready')s.state.ready=false;
    await assert.rejects(s.confirmClassImport(review,true),undefined,kind);
    if(kind==='database'){d.closeDB();d.selectDatabase(s.getActiveWorkspace().databaseName);}
    assert.equal(await checkpoint(),before,kind);
  }
});
test('partial failed teaching keeps exact section and names; fresh explicit retry creates no duplicate section/outbox',async()=>{
  await prepare();const review=s.reviewClassImport(group());
  const database=await d.openDB(),original=database.transaction.bind(database);
  let fail=true;
  database.transaction=function(names,...args){if(fail&&args[0]==='readwrite'&&Array.from(names).includes('items')){fail=false;throw Error('N107 synthetic teaching write failure');}return original(names,...args);};
  await assert.rejects(s.confirmClassImport(review,true));database.transaction=original;
  const partial=s.classImportReceipt(review);assert.ok(partial.sectionId);assert.equal(partial.teachingId,null);assert.deepEqual(partial.pendingNames,['طالب اصطناعي']);assert.equal(partial.added,0);
  const sectionCount=(await d.getAll('sections')).length;
  const complete=await s.confirmClassImport(review,true);assert.equal(complete.added,1);assert.equal((await d.getAll('sections')).length,sectionCount);
});
test('failure at student transaction preserves teaching/defaults, no hidden child writes; callback session drift stops next step',async()=>{
  await prepare();const review=s.reviewClassImport(group());const database=await d.openDB(),original=database.transaction.bind(database);let fail=true;
  database.transaction=function(names,...args){if(fail&&args[0]==='readwrite'&&Array.from(names).includes('students')&&!Array.from(names).includes('items')&&s.state.teachings.length>3){fail=false;throw Error('N107 synthetic student failure');}return original(names,...args);};
  await assert.rejects(s.confirmClassImport(review,true));database.transaction=original;
  const partial=s.classImportReceipt(review);assert.ok(partial.teachingId);assert.equal(partial.added,0);assert.equal(s.students(partial.teachingId).length,0);
  const items=JSON.stringify(s.state.items);await s.confirmClassImport(review,true);assert.equal(JSON.stringify(s.state.items),items);
  await prepare();const changed=s.reviewClassImport(group());let drift=true;
  const database2=await d.openDB(),original2=database2.transaction.bind(database2);
  database2.transaction=function(names,...args){const tx=original2(names,...args);if(drift&&args[0]==='readwrite'&&Array.from(names).includes('sections')&&s.state.sections.length>3){drift=false;tx.addEventListener('complete',()=>c.setMockAuth(c.user,{...c.session}));}return tx;};
  await assert.rejects(s.confirmClassImport(changed,true));database2.transaction=original2;
  assert.equal((await d.getAll('teachings')).length,3);assert.ok(s.classImportReceipt(changed).sectionId);
  // A fresh user review can accept the current same-owner session; no replay at callback time.
  s.refreshClassImportReview(changed);await s.confirmClassImport(changed,true);
  assert.equal(s.classImportReceipt(changed).added,1);
});
test('persisted cross-tab class, term and roster drift reject without relying on memory',async()=>{
  await prepare();let review=s.reviewClassImport(group());
  await d.put('sections',makeSection({yearId:s.activeYear().id,grade:4,label:'أ'}));
  let before=await checkpoint();await assert.rejects(s.confirmClassImport(review,true));assert.equal(await checkpoint(),before);
  await prepare();review=s.reviewClassImport(group());
  await d.put('device',{...s.state.device,activeTermId:s.state.terms[1].id});
  before=await checkpoint();await assert.rejects(s.confirmClassImport(review,true));assert.equal(await checkpoint(),before);
  await prepare();review=s.reviewClassImport(group());const database=await d.openDB(),original=database.transaction.bind(database);let fail=true;
  database.transaction=function(names,...args){if(fail&&args[0]==='readwrite'&&s.state.teachings.length>3&&!Array.from(names).includes('items')){fail=false;throw Error('Synthetic student failure');}return original(names,...args);};
  await assert.rejects(s.confirmClassImport(review,true));database.transaction=original;
  const sectionId=s.classImportReceipt(review).sectionId,student=makeStudent({name:'طالب اصطناعي'});
  await d.putAcross({students:[student],enrollments:[makeEnrollment({studentId:student.id,sectionId,rollNo:1})]});
  before=await checkpoint();await assert.rejects(s.confirmClassImport(review,true));assert.equal(await checkpoint(),before);
});
