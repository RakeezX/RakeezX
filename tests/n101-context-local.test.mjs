import 'fake-indexeddb/auto';
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import * as db from '../src/lib/db.js';
import * as store from '../src/store.js';

global.document = {
  documentElement: {
    setAttribute() {},
    removeAttribute() {},
    classList: { add() {}, remove() {} },
  },
  querySelector: () => ({ setAttribute() {} }),
};
global.matchMedia = () => ({ matches: false });
after(() => { store.closeChannel(); db.closeDB(); });

test('N101 missing calendar parents stop the complete batch before memory or durable writes',async()=>{
  await db.clearAll();store.state.ready=false;await store.init();
  const before=await db.getAll('sessions'),outbox=await db.getAll('outbox'),memory=structuredClone(store.state.sessions),teachings=structuredClone(store.state.teachings);
  await assert.rejects(store.save({teachings:[{id:'invalid:teaching',termId:'missing:term',deleted:false}],sessions:[{id:'invalid:session',teachingId:'invalid:teaching',date:'2026-10-14',period:1,deleted:false}]}),/تعذّر تحديد تقويم الحصة/);
  assert.deepEqual(await db.getAll('sessions'),before);assert.deepEqual(await db.getAll('outbox'),outbox);assert.deepEqual(store.state.sessions,memory);assert.deepEqual(store.state.teachings,teachings);
});
