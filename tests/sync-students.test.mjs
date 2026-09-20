import test from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
global.document = { documentElement: { setAttribute: () => {}, removeAttribute: () => {}, classList: { add: () => {}, remove: () => {} } }, querySelector: () => ({ setAttribute: () => {} }) };
global.matchMedia = () => ({ matches: false });

import { setMockBackend, setMockAuth } from "../src/lib/cloud.js";
import * as sync from "../src/lib/sync.js";
import * as store from "../src/store.js";
import * as db from "../src/lib/db.js";
import { lifecycleServer, LifecycleBackend, OWNER } from './helpers/student-lifecycle-server.mjs';
import { makeEnrollment, makeSection, makeStudent } from '../src/models.js';

let backend, pg;
async function seedYear() {
  await pg.query(`insert into rakeezx.years(id,label,hijri_start,hijri_end,status)
    values('year1','سنة اختبار',1490,1491,'active')`);
}
async function assertBlockedEnrollment(missingStore, missingId) {
  const queue = (await db.getAll('outbox')).filter(row => row.store === 'enrollments');
  assert.equal(queue.length, 1);
  assert.equal(queue[0].state, 'blocked');
  assert.equal(queue[0].blockedReason, 'dependency-not-local-yet');
  assert.ok(queue[0].dependencies.some(dep => dep.store === missingStore && dep.recordId === missingId));
  assert.equal((await sync.getSyncOperationalSummary()).state, 'blocked');
  assert.equal((await backend.fetchRecords('enrollments')).length, 0, 'no orphan reaches server');
  assert.equal(backend.enrollmentUpserts, 0, 'unready enrollment is not dispatched');
  assert.ok(await db.get('enrollments', 'enr2'), 'local intent remains available for later reconciliation');
}

test("Sync Students & Enrollments Suite", async (t) => {
  t.beforeEach(async () => {
    setMockAuth(null, null);
    pg = await lifecycleServer({ migration32: true });
    backend = new LifecycleBackend(pg);
    setMockBackend(backend);
    await db.clearAll();
    store.state.ready = false;
    await store.init();
    setMockAuth({ id: OWNER }, { access_token: 'synthetic-student-sync' });
    sync.state.status = "idle";
    assert.equal(await sync.syncAll({ full: true }), true);
    assert.equal((await db.getAll('outbox')).length, 0);
    backend.enrollmentUpserts = 0;
  });

  t.afterEach(async () => {
    setMockAuth(null, null);
    setMockBackend(null);
    await pg?.close();
  });

  t.after(async () => {
    await db.closeDB();
    await store.closeChannel();
  });

  await t.test("Push local student and enrollment to cloud", async () => {
    await seedYear();
    assert.equal(await sync.syncAll({ full: true }), true);
    await store.save({
      sections: [makeSection({ id: 'sec1', yearId: 'year1', grade: 1, label: 'أ' })],
      students: [makeStudent({ id: 'std1', name: 'طالب اختبار' })],
      enrollments: [makeEnrollment({ id: 'enr1', studentId: 'std1', sectionId: 'sec1', rollNo: 1, startDate: '2026-08-01' })],
    });
    assert.equal(await sync.syncStudents(), true);

    assert.equal(backend.records["students"]?.length, 1);
    assert.equal(backend.records["students"][0].name, "طالب اختبار");

    assert.equal(backend.records["enrollments"]?.length, 1);
    assert.equal(backend.records["enrollments"][0].student_id, "std1");
    assert.equal(backend.records["enrollments"][0].section_id, "sec1");
    assert.equal((await db.getAll('outbox')).length, 0);
    assert.ok((await db.get('students', 'std1')).serverRevision >= 1);
    assert.ok((await db.get('enrollments', 'enr1')).serverRevision >= 1);
  });

  await t.test("Pull remote student and enrollment", async () => {
    await seedYear();
    await pg.exec(`insert into rakeezx.sections(id,year_id,grade,label,name) values('sec1','year1',1,'أ','فصل اختبار');
      insert into rakeezx.students(id,name,status) values('std2','طالب سحابي اصطناعي','active');
      insert into rakeezx.enrollments(id,student_id,section_id,roll_no,status) values('enr2','std2','sec1',1,'active')`);
    assert.equal(await sync.syncStudents(), true);

    const std = await db.get("students", "std2");
    assert.ok(std);
    assert.equal(std.name, "طالب سحابي اصطناعي");

    const enr = await db.get("enrollments", "enr2");
    assert.ok(enr);
    assert.equal(enr.studentId, "std2");
    assert.equal(enr.sectionId, "sec1");
    assert.ok(std.serverRevision >= 1);
    assert.ok(enr.serverRevision >= 1);
  });

  await t.test("Foreign key protection: missing student rejects enrollment before Sync", async () => {
    await seedYear();
    await pg.query(`insert into rakeezx.sections(id,year_id,grade,label,name) values('sec1','year1',1,'أ','فصل اختبار')`);
    assert.equal(await sync.syncAll({ full: true }), true);
    await assert.rejects(
      store.save({ enrollments: [makeEnrollment({ id: 'enr2', studentId: 'std_missing', sectionId: 'sec1', rollNo: 1 })] }),
      error => error.code === 'STUDENT_TOMBSTONED',
    );
    assert.equal(await db.get('enrollments', 'enr2'), undefined);
    assert.equal((await db.getAll('outbox')).length, 0, 'invalid enrollment never enters Sync');
    assert.equal(await sync.syncStudents(), true);
    assert.equal((await backend.fetchRecords('enrollments')).length, 0);
    assert.equal(backend.enrollmentUpserts, 0);
  });

  await t.test("Foreign key protection: missing section blocks enrollment without a server orphan", async () => {
    await pg.query(`insert into rakeezx.students(id,name,status) values('std2','طالب اختبار','active')`);
    assert.equal(await sync.syncAll({ full: true }), true);
    await store.save({ enrollments: [makeEnrollment({ id: 'enr2', studentId: 'std2', sectionId: 'sec_missing', rollNo: 1 })] });
    assert.equal(await sync.syncStudents(), true, 'healthy transport does not authorize unresolved enrollment');
    await assertBlockedEnrollment('sections', 'sec_missing');
  });
});
