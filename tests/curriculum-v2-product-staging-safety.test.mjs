import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto, createHash } from 'node:crypto';
import { indexedDB } from 'fake-indexeddb';
import * as db from '../src/lib/db.js';
import { evaluateSectionCurriculumScope, evaluateTeachingCourseBinding } from '../src/lib/curriculum-context-v2.js';
import { createCurriculumV2StagingBridge } from '../src/lib/curriculum-v2-staging-bridge.js';
import { assertCurriculumV2CloudPayloadSupported, assertCurriculumV2CloudRestoreSupported } from '../src/lib/curriculum-v2-cloud-restore-gate.js';
import { buildBackup, validateBackupIntegrity } from '../src/lib/export.js';
import { planCloudRestore, previewCloudRestore, restoreBackupToCloud, reconcileCanonicalRestore } from '../src/lib/backup-v2.js';

globalThis.indexedDB = indexedDB;
globalThis.crypto ??= webcrypto;
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const yearId = 'y:1448-1449';
const sectionId = 'sec:A';
const teachingId = 'tch:A:science';
const subjectId = 'sub:science';
const termId = 'tm:one';
const failCode = (code) => (error) => error?.code === code;
const baseline = {
  years: [{ id: yearId, label: '1448-1449', updatedAt: 100 }],
  sections: [{ id: sectionId, yearId, grade: 4, label: 'أ', name: 'رابع أ', updatedAt: 100 }],
  subjects: [{ id: subjectId, name: 'العلوم', updatedAt: 100 }],
  terms: [{ id: termId, yearId, index: 1, updatedAt: 100 }],
  teachings: [{ id: teachingId, sectionId, subjectId, termId, updatedAt: 100 }],
  students: [{ id: 'student-1', name: 'طالب اصطناعي فقط', updatedAt: 100 }],
  items: [{ id: 'item-1', teachingId, max: 20, updatedAt: 100 }],
  scores: [{ id: 'score-1', studentId: 'student-1', itemId: 'item-1', value: 16, updatedAt: 100 }],
};
async function oldV8Database() {
  // Upgrade path is realistic: the existing stores and records precede sidecars.
  await new Promise((resolve, reject) => {
    const r = indexedDB.open('rakeezx-demo', 8);
    r.onupgradeneeded = () => {
      for (const store of db.STORES) if (!['sectionCurriculumScopes', 'teachingCourseBindings'].includes(store))
        r.result.createObjectStore(store, { keyPath: 'id' });
    };
    r.onerror = () => reject(r.error);
    r.onsuccess = () => {
      const conn = r.result;
      const tx = conn.transaction(Object.keys(baseline), 'readwrite');
      for (const [name, rows] of Object.entries(baseline))
        for (const row of rows) tx.objectStore(name).put(row);
      tx.oncomplete = () => { conn.close(); resolve(); };
      tx.onerror = () => reject(tx.error);
    };
  });
}
const scope = (extra = {}) => evaluateSectionCurriculumScope({
  ownerId: A, sectionId, yearId, program: 'general', stage: 'primary',
  level: '4', legacyGrade: 4, ...extra,
});
const course = (scopeDraft, extra = {}) => evaluateTeachingCourseBinding({
  ownerId: A, sectionScope: scopeDraft, sectionId, teachingId, subjectId,
  termId, name: 'العلوم', ...extra,
});

test('V2 production-DB adapter is safely exercised ONLY on a synthetic demo workspace', async (t) => {
  let owner = A;
  let writeAllowed = true;
  let clock = 200;
  db.selectDatabase('rakeezx-demo');
  await oldV8Database();
  db.setProductWriteGuard(() => {
    if (!writeAllowed) throw Object.assign(new Error('Offline lease blocks Product writes'),
      { code: 'OFFLINE_LEASE_LIMITED' });
  });
  const bridge = createCurriculumV2StagingBridge({
    database: db, currentOwner: () => owner,
    clock: () => clock++, allowSyntheticWrites: true,
  });
  const disabled = createCurriculumV2StagingBridge({
    database: db, currentOwner: () => owner, allowSyntheticWrites: false,
  });
  try {
    await t.test('v8 to v9 IndexedDB upgrade preserves legacy students, grades and IDs', async () => {
      const connected = await db.openDB();
      assert.equal(connected.version, 9);
      assert.deepEqual((await db.getAll('students')).map((r) => r.id), ['student-1']);
      assert.deepEqual((await db.getAll('scores')).map((r) => r.value), [16]);
      assert.deepEqual((await db.getAll('sections')).map((r) => r.id), [sectionId]);
      assert.deepEqual((await db.getAll('teachings')).map((r) => r.id), [teachingId]);
      assert.deepEqual((await db.getAll('sectionCurriculumScopes')), []);
    });
    await t.test('synthetic activation required; account writes cannot use the bridge', async () => {
      await assert.rejects(disabled.saveScope(scope()), failCode('CURRICULUM_V2_STAGING_ONLY'));
    });
    await t.test('Product Offline Lease rejects write, without partial sidecar changes', async () => {
      writeAllowed = false;
      await assert.rejects(bridge.saveScope(scope()), failCode('OFFLINE_LEASE_LIMITED'));
      assert.deepEqual(await db.getAll('sectionCurriculumScopes'), []);
      writeAllowed = true;
    });
    const draft = scope();
    await t.test('stores the approved scope atomically alongside existing section/year', async () => {
      const saved = await bridge.saveScope(draft);
      assert.equal(saved.ownerId, A);
      assert.equal(saved.program, 'general');
      assert.equal(saved.legacyGrade, 4);
      assert.equal(saved.syncStatus, 'synthetic_staged_only');
      assert.equal((await bridge.snapshot(A)).sectionCurriculumScopes.length, 1);
      const queued = await db.getAll('outbox');
      assert.equal(queued.length, 1);
      assert.equal(queued[0].store, 'sectionCurriculumScopes');
      assert.equal(queued[0].protocol, 'curriculum-v2-synthetic');
    });
    await t.test('rejects foreign owner, missing legacy parent and mismatched grade', async () => {
      owner = B;
      await assert.rejects(bridge.snapshot(A), failCode('CURRICULUM_V2_OWNER_CONTEXT_CHANGED'));
      await assert.rejects(bridge.saveScope(draft), failCode('CURRICULUM_V2_OWNER_CONTEXT_CHANGED'));
      owner = A;
      const foreign = scope({ sectionId: 'sec:missing' });
      await assert.rejects(bridge.saveScope(foreign), failCode('CURRICULUM_V2_SECTION_MISSING'));
      const differentGrade = scope({ legacyGrade: 5 });
      assert.equal(differentGrade.state, 'blocked');
      await assert.rejects(bridge.saveScope(differentGrade), failCode('CURRICULUM_V2_OWNER_CONTEXT_CHANGED'));
      await assert.rejects(bridge.saveScope({ ...differentGrade, ownerId: A }), failCode('CURRICULUM_V2_SCOPE_DRAFT_INVALID'));
      const originalYear = await db.get('years', yearId);
      await db.put('years', { ...originalYear, ownerId: B });
      await assert.rejects(bridge.saveScope(draft), failCode('CURRICULUM_V2_OWNER_CONTEXT_CHANGED'));
      await db.put('years', originalYear);
    });
    await t.test('same section cannot silently mutate program and create duplicate identity', async () => {
      const altered = scope({ program: 'tahfiz' });
      assert.equal(altered.state, 'draft');
      await assert.rejects(bridge.saveScope(altered), failCode('CURRICULUM_V2_CONTEXT_CHANGE_REQUIRES_REVIEW'));
    });
    const courseDraft = course(draft);
    await t.test('course is bound to existing teaching, term, subject and V6 source', async () => {
      assert.equal(courseDraft.state, 'draft');
      const saved = await bridge.saveBinding(courseDraft);
      assert.equal(saved.teachingId, teachingId);
      assert.equal(saved.kind, 'course');
      assert.match(saved.sourceUrl, /sncc\.gov\.sa/);
      assert.equal((await db.getAll('outbox')).length, 2);
      const originalTeaching = await db.get('teachings', teachingId);
      await db.put('teachings', { ...originalTeaching, ownerId: B });
      await assert.rejects(bridge.saveBinding(courseDraft), failCode('CURRICULUM_V2_OWNER_CONTEXT_CHANGED'));
      await db.put('teachings', originalTeaching);
    });
    await t.test('cannot change course identity, bind foreign parent or retire active scope', async () => {
      await assert.rejects(bridge.retireScope(A, draft.identity), failCode('CURRICULUM_V2_ACTIVE_BINDINGS'));
      const altered = course(draft, { sectionId: 'sec:foreign' });
      assert.equal(altered.state, 'blocked');
      await assert.rejects(bridge.saveBinding(altered), failCode('CURRICULUM_V2_OWNER_CONTEXT_CHANGED'));
      await assert.rejects(bridge.saveBinding({ ...altered, ownerId: A }), failCode('CURRICULUM_V2_SCOPE_MISSING'));
      await assert.rejects(bridge.saveBinding({ ...courseDraft, state: 'blocked' }), failCode('CURRICULUM_V2_BINDING_DRAFT_INVALID'));
    });
    let backupBundle;
    await t.test('synthetic V2 checksum backup and cloud serialization keep scope/course links', async () => {
      backupBundle = await bridge.backup(A);
      assert.equal(backupBundle.format, 'RAKEEZ_CURRICULUM_V2_SYNTHETIC_V1');
      assert.equal(backupBundle.data.sectionCurriculumScopes.length, 1);
      assert.equal(backupBundle.data.teachingCourseBindings.length, 1);
      assert.match(backupBundle.sha256, /^[a-f0-9]{64}$/);
      const cloudPreview = await bridge.previewCloudRows(A);
      assert.equal(cloudPreview.enabled, false);
      assert.equal(cloudPreview.scopes[0].owner_id, A);
      assert.equal(cloudPreview.bindings[0].teaching_id, teachingId);
      assert.throws(() => bridge.pushToCloud(), failCode('CURRICULUM_V2_CLOUD_SCHEMA_NOT_VERIFIED'));
    });
    let productBackup;
    await t.test('ordinary V5 JSON backup includes sidecars, cryptographic integrity passes', async () => {
      productBackup = await buildBackup({ sourceOwnerId: A, backupId: 'synthetic-v2-test' });
      assert.equal(productBackup.version, 5);
      assert.equal(productBackup.data.sectionCurriculumScopes.length, 1);
      assert.equal(productBackup.data.teachingCourseBindings.length, 1);
      assert.deepEqual(await validateBackupIntegrity(productBackup).then(r => r.integrity), 'verified');
    });
    await t.test('cloud restore N71 hard-fails before source fetching or client mutations', async () => {
      assert.throws(() => assertCurriculumV2CloudPayloadSupported(productBackup),
        failCode('CURRICULUM_V2_CLOUD_RESTORE_NOT_READY'));
      assert.throws(() => planCloudRestore(productBackup, {}, { ownerId: A, ownerHistoryRevision: '0' }),
        failCode('CURRICULUM_V2_CLOUD_RESTORE_NOT_READY'));
      await assert.rejects(assertCurriculumV2CloudRestoreSupported({data:{}}, db),
        failCode('CURRICULUM_V2_CLOUD_RESTORE_NOT_READY'));
      let requests = 0;
      const ownerVerifier = async () => { requests++; return A; };
      await assert.rejects(previewCloudRestore(productBackup, { ownerVerifier }),
        failCode('CURRICULUM_V2_CLOUD_RESTORE_NOT_READY'));
      await assert.rejects(restoreBackupToCloud(productBackup, { ownerVerifier }),
        failCode('CURRICULUM_V2_CLOUD_RESTORE_NOT_READY'));
      await assert.rejects(reconcileCanonicalRestore(productBackup, null, { verifyOwner: ownerVerifier }),
        failCode('CURRICULUM_V2_CLOUD_RESTORE_NOT_READY'));
      assert.equal(requests, 0);
      assert.deepEqual((await db.getAll('scores')).map((r) => r.value), [16]);
    });
    await t.test('soft delete retains tombstones and rejects resurrection', async () => {
      const deletedBinding = await bridge.retireBinding(A, courseDraft.identity);
      assert.equal(deletedBinding.deleted, true);
      assert.equal(deletedBinding.deletedAt, new Date(deletedBinding.updatedAt).toISOString());
      const deletedScope = await bridge.retireScope(A, draft.identity);
      assert.equal(deletedScope.deleted, true);
      await assert.rejects(bridge.saveScope(draft), failCode('CURRICULUM_V2_TOMBSTONE_RESURRECTION'));
      await assert.rejects(bridge.saveBinding(courseDraft), failCode('CURRICULUM_V2_SCOPE_MISSING'));
      const queued = await db.getAll('outbox');
      assert.equal(queued.length, 2);
      assert.ok(queued.every(row => row.op === 'delete' && row.state === 'pending'));
    });
    await t.test('reopen database: tombstones, legacy students and scores survive', async () => {
      db.closeDB();
      const connected = await db.openDB();
      assert.equal(connected.version, 9);
      assert.equal((await bridge.snapshot(A)).teachingCourseBindings[0].deleted, true);
      assert.deepEqual((await db.getAll('students')).map((r) => r.id), ['student-1']);
      assert.deepEqual((await db.getAll('scores')).map((r) => r.value), [16]);
    });
    await t.test('backup import is atomic; rejects tampering, owner swap and existing records', async () => {
      await db.clearStore('sectionCurriculumScopes');
      await db.clearStore('teachingCourseBindings');
      await assert.rejects(bridge.restoreIntoEmpty(A, backupBundle),
        failCode('CURRICULUM_V2_RESTORE_PENDING_OUTBOX'));
      await db.clearStore('outbox');
      await assert.rejects(bridge.restoreIntoEmpty(A,{...backupBundle, sha256:'0'.repeat(64)}),
        failCode('CURRICULUM_V2_BACKUP_INTEGRITY_INVALID'));
      await assert.rejects(bridge.restoreIntoEmpty(B, backupBundle),
        failCode('CURRICULUM_V2_OWNER_CONTEXT_CHANGED'));
      const reseal = (change) => {
        const { sha256, ...payload } = structuredClone(backupBundle);
        change(payload.data);
        return { ...payload, sha256: createHash('sha256')
          .update(JSON.stringify(payload)).digest('hex') };
      };
      // A checksum is not an authorisation signature. Reject plausible,
      // re-hashed but invalid teacher data BEFORE the atomic transaction.
      for (const [mutate, expectedCode] of [
        [data => { data.teachingCourseBindings[0].courseKey = 'forged'; },
          'CURRICULUM_V2_BACKUP_COURSE_MISMATCH'],
        [data => { data.teachingCourseBindings[0].name = 'مقرر آخر'; },
          'CURRICULUM_V2_BACKUP_COURSE_MISMATCH'],
        [data => { data.sectionCurriculumScopes[0].sourceUrl = 'https://example.org/'; },
          'CURRICULUM_V2_BACKUP_SCOPE_MISMATCH'],
        [data => { data.teachingCourseBindings[0].deleted = true; },
          'CURRICULUM_V2_BACKUP_LIFECYCLE_INVALID'],
        [data => { data.teachingCourseBindings.push(
          { ...data.teachingCourseBindings[0], id: 'forged:duplicate' }); },
          'CURRICULUM_V2_BACKUP_LIFECYCLE_INVALID'],
      ]) {
        await assert.rejects(bridge.restoreIntoEmpty(A, reseal(mutate)), failCode(expectedCode));
        assert.deepEqual(await db.getAll('sectionCurriculumScopes'), []);
        assert.deepEqual(await db.getAll('teachingCourseBindings'), []);
        assert.deepEqual((await db.getAll('scores')).map(row => row.value), [16]);
      }
      const restored = await bridge.restoreIntoEmpty(A,backupBundle);
      assert.equal(restored.imported, 2);
      assert.equal(restored.synced, false);
      await assert.rejects(bridge.restoreIntoEmpty(A,backupBundle),
        failCode('CURRICULUM_V2_RESTORE_NOT_EMPTY'));
      assert.equal((await bridge.snapshot(A)).teachingCourseBindings[0].deleted,false);
      assert.deepEqual((await db.getAll('scores')).map((r) => r.value), [16]);
      assert.deepEqual((await db.getAll('students')).map((r) => r.id), ['student-1']);
    });
  } finally {
    db.closeDB();
    db.setProductWriteGuard(null);
  }
});