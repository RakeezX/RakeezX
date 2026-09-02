import test, { beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import * as db from '../src/lib/db.js';

beforeEach(() => db.clearAll());
after(() => db.closeDB());

test('shared static applyBatch preserves normal mixed operations and unrelated stores', async () => {
  await db.putAcross({ students:[{id:'test:old',name:'TEST old'}], notes:[{id:'test:note',text:'TEST history'}] });
  await db.applyBatch({ students:{remove:['test:old'],put:[{id:'test:new',name:'TEST new'}]}, scores:{put:[{id:'test:score',value:8}]} });
  assert.deepEqual(await db.getAll('students'), [{id:'test:new',name:'TEST new'}]);
  assert.deepEqual(await db.getAll('scores'), [{id:'test:score',value:8}]);
  assert.deepEqual(await db.getAll('notes'), [{id:'test:note',text:'TEST history'}]);
  db.closeDB();
  assert.equal((await db.get('scores','test:score')).value,8);
});

test('shared static batch rolls back queued deletes/writes after synchronous DataError and permits the next transaction', async () => {
  const original={id:'test:student',name:'TEST preserved'};
  await db.put('students',original);
  await assert.rejects(db.applyBatch({students:{remove:[original.id],put:[{id:'test:new'}]},scores:{put:[{value:8}]}}), {name:'DataError'});
  assert.deepEqual(await db.getAll('students'), [original]);
  assert.deepEqual(await db.getAll('scores'), []);
  await db.put('scores',{id:'test:valid',value:9});
  assert.equal((await db.get('scores','test:valid')).value,9);
});

test('prepared batch reads disk in its transaction and aborts if prepare throws', async () => {
  await db.put('students',{id:'test:student',name:'TEST latest'});
  await db.applyBatch({students:{}},{prepare(current){
    assert.equal(current.students[0].name,'TEST latest');
    return {students:{put:[{...current.students[0],name:'TEST edited'}]}};
  }});
  await assert.rejects(db.applyBatch({students:{}},{prepare(){throw new Error('TEST prepare failure');}}),/TEST prepare failure/);
  assert.equal((await db.get('students','test:student')).name,'TEST edited');
});

test('prepared batch rejects writes beyond the declared scope and asynchronous callbacks atomically', async () => {
  await assert.rejects(db.applyBatch({students:{}},{prepare(){return {students:{put:[{id:'test:rollback'}]},scores:{put:[{id:'test:invalid'}]}};}}),/outside transaction scope/);
  assert.deepEqual(await db.getAll('students'),[]);
  await assert.rejects(db.applyBatch({students:{}},{prepare:async()=>({})}),/synchronously/);
  assert.deepEqual(await db.getAll('students'),[]);
});
