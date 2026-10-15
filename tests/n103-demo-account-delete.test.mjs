import 'fake-indexeddb/auto';
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import * as db from '../src/lib/db.js';
import * as store from '../src/store.js';
import { n77Account, n77Foundation } from './n77-fixture.mjs';
import { createDemoPackage, previewDemoPackageDelete, deleteDemoPackage } from '../src/lib/demo.js';
import { setMockAuth } from '../src/lib/cloud.js';
import { demoDescriptor } from '../src/lib/workspaces.js';
const owner = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
globalThis.document = { documentElement:{ setAttribute(){}, removeAttribute(){}, classList:{add(){},remove(){}} }, querySelector:()=>({setAttribute(){}}) };
globalThis.matchMedia = () => ({matches:false});
Object.defineProperty(globalThis, 'navigator', {configurable:true,value:{onLine:true}});
globalThis.fetch = async () => { throw Error('N103 forbids network'); };
after(() => store.deactivateWorkspace());
const disk = async () => Object.fromEntries(await Promise.all(db.STORES.map(async name => [name, await db.getAll(name)])));
async function setup() {
  if (store.getActiveWorkspace()) { await db.clearAll(); store.deactivateWorkspace(); }
  await n77Account(owner); await n77Foundation();
  const first = await createDemoPackage(), second = await createDemoPackage();
  await db.put('students',{id:'real-student',name:'synthetic ordinary student',deleted:false});
  await db.put('scores',{id:'real-score',studentId:'real-student',itemId:'real-item',value:17,deleted:false});
  await db.put('outbox',{id:'preserved-outbox',ownerId:owner,command:'synthetic-existing'});
  return {first,second};
}
test('account exact manifest deletion preserves other package, ordinary student/grade and outbox; persisted refresh cannot resurrect', async () => {
  const {first,second} = await setup();
  const plan = await previewDemoPackageDelete(first.teaching.id), before = await disk();
  assert.equal(await deleteDemoPackage(first.packageId,plan),true);
  const after = await disk();
  for (const [name, rows] of Object.entries(before)) for (const row of rows) {
    const actual = after[name].find(r => r.id === row.id);
    if (row.id.startsWith('demo:'+first.packageId+':')) assert.equal(actual.deleted,true,row.id);
    else if (name !== 'meta') assert.deepEqual(actual,row,name+':'+row.id);
  }
  assert.equal(store.getTeaching(first.teaching.id),null);
  assert.ok(store.getTeaching(second.teaching.id));
  await store.refreshSyncedState();
  assert.equal(store.getTeaching(first.teaching.id),null);
  await assert.rejects(deleteDemoPackage(first.packageId,plan));
});
test('cancel/preview is read-only; absent, ambiguous, foreign and ordinary IDs fail closed', async () => {
  const {first} = await setup(); const before = await disk();
  await previewDemoPackageDelete(first.teaching.id); assert.deepEqual(await disk(),before);
  const original = await db.get('meta','demo:packages');
  for (const mutate of [
    m => { m.packages=[]; },
    m => { m.packages.push(structuredClone(m.packages[0])); },
    m => { m.packages[0].ownerId='foreign'; },
    m => { m.packages[0].owned.students.push('real-student'); },
    m => { m.packages[1].owned.students.push(m.packages[0].owned.students[0]); },
  ]) {
    const m = structuredClone(original); mutate(m); await db.put('meta',m);
    const snapshot = await disk();
    await assert.rejects(previewDemoPackageDelete(first.teaching.id)); assert.deepEqual(await disk(),snapshot);
  }
  await db.put('meta',original);
  await assert.rejects(previewDemoPackageDelete('real-teaching'));
});
test('changed manifest/row, shared real enrollment, archived/closed context, stale scope and owner switch cannot apply', async () => {
  for (const mode of ['manifest','row','shared','nested-share','archived','closed','scope','owner']) {
    const {first} = await setup(); const plan = await previewDemoPackageDelete(first.teaching.id);
    if (mode==='manifest') { const m=await db.get('meta','demo:packages'); m.updatedAt++; await db.put('meta',m); }
    if (mode==='row') { const r=await db.get('students',`demo:${first.packageId}:student:1`); await db.put('students',{...r,name:'changed'}); }
    if (mode==='shared') await db.put('enrollments',{id:'ordinary-shared-enrollment',studentId:`demo:${first.packageId}:student:1`,sectionId:'ordinary-class'});
    if (mode==='nested-share') await db.put('closedTermReports',{id:'ordinary-retained-report',payload:{students:[{id:`demo:${first.packageId}:student:1`}]}});
    if (mode==='archived') await db.put('sections',{...first.section,status:'archived'});
    if (mode==='closed') { const t=store.activeTerm(); await db.put('terms',{...t,status:'closed'}); }
    if (mode==='scope') store.state.teachings.push({id:'extra-subject',sectionId:first.section.id});
    if (mode==='owner') setMockAuth({id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'},{access_token:'foreign',user:{id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'}});
    const before=await disk(); await assert.rejects(deleteDemoPackage(first.packageId,plan)); assert.deepEqual(await disk(),before,mode);
  }
});
test('atomic failure leaves disk and memory intact, no false return after partial apply', async () => {
  const {first} = await setup(); const plan = await previewDemoPackageDelete(first.teaching.id);
  const before=await disk(), memory=structuredClone(store.state.students);
  const real= db.getActiveDatabaseName();
  db.setProductWriteGuard(() => { throw Error('synthetic transaction guard failure'); });
  try { await assert.rejects(deleteDemoPackage(first.packageId,plan),/synthetic transaction guard failure/); }
  finally { db.setProductWriteGuard(device => store.assertLeaseWritable(device)); }
  assert.equal(db.getActiveDatabaseName(),real); assert.deepEqual(await disk(),before); assert.deepEqual(store.state.students,memory);
});
test('standalone demo retains guarded existing local delete path; account cannot invoke it', async () => {
  const {first} = await setup();
  await assert.rejects(store.deleteDemoTeachingScope(first.teaching.id,first.section.id,'section'),/مساحة التجربة فقط/);
  store.deactivateWorkspace(); store.activateWorkspace(demoDescriptor()); await store.init();
  const pkg=await createDemoPackage();
  await store.deleteDemoTeachingScope(pkg.teaching.id,pkg.section.id,'section');
  assert.equal((await db.get('teachings',pkg.teaching.id)).deleted,true);
});
