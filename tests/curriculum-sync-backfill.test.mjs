import 'fake-indexeddb/auto';
import test, { afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import * as cloud from '../src/lib/cloud.js';
import * as db from '../src/lib/db.js';
import * as store from '../src/store.js';
import {
  curriculumSnapshotHash, initializeCurriculumSyncGate, normalizedCurriculumSnapshot,
  submitCurriculumBootstrap,
} from '../src/lib/curriculum-bootstrap.js';
import { SYNC_V2_SCHEMAS, SYNC_V2_STORES } from '../src/lib/sync-v2.js';
import { makeLesson, makeSubject, makeUnit } from '../src/models.js';

global.document = {
  visibilityState: 'visible', documentElement: { setAttribute() {}, removeAttribute() {}, classList: { add() {}, remove() {} } },
  querySelector: () => ({ setAttribute() {} }), addEventListener() {},
};
global.matchMedia = () => ({ matches: false });

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const workspace = Object.freeze({
  id: 'account:a', type: 'account', authUserId: A, databaseName: 'rakeezx-user-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  ownershipState: 'claimed', syncEligible: true, broadcastChannelName: 'test:curriculum',
});

beforeEach(async () => {
  store.closeChannel(); db.closeDB();
  store.state.ready = false;
  store.activateWorkspace(workspace);
  cloud.setMockAuth({ id: A, email: 'a@example.test' }, { access_token: 'synthetic' });
  cloud.setMockBackend(null);
  await db.clearAll();
  await store.init();
  await db.clearStore('outbox');
});

afterEach(() => {
  cloud.setMockBackend(null); cloud.setMockAuth(null, null);
  store.closeChannel(); db.closeDB();
});

test('curriculum schemas preserve stable ids and dependency order without deferred stores', () => {
  assert.equal(SYNC_V2_SCHEMAS.units.entity, 'units');
  assert.equal(SYNC_V2_SCHEMAS.lessons.entity, 'lessons');
  assert.equal(SYNC_V2_SCHEMAS.units.references.subjectId, 'subjects');
  assert.equal(SYNC_V2_SCHEMAS.lessons.references.unitId, 'units');
  assert.ok(SYNC_V2_STORES.indexOf('subjects') < SYNC_V2_STORES.indexOf('units'));
  assert.ok(SYNC_V2_STORES.indexOf('units') < SYNC_V2_STORES.indexOf('lessons'));
  assert.equal(SYNC_V2_STORES.includes('assignments'), false);
  assert.equal(SYNC_V2_STORES.includes('submissions'), false);
});

test('normalized historical snapshot is deterministic and retains tombstones and ids', async () => {
  const unit = makeUnit({ id: 'unit:1', subjectId: 'subject:1', grade: 4, termIndex: 1, name: 'الوحدة', updatedAt: 10 });
  const lesson = makeLesson({ id: 'lesson:1', unitId: unit.id, name: 'الدرس', deleted: true, updatedAt: 11 });
  const left = normalizedCurriculumSnapshot({ units: [unit], lessons: [lesson] });
  const right = normalizedCurriculumSnapshot({ units: [{ ...unit }], lessons: [{ ...lesson }] });
  assert.deepEqual(left, right);
  assert.equal(left.units[0].id, unit.id);
  assert.equal(left.lessons[0].deleted, true);
  assert.equal(await curriculumSnapshotHash(left), await curriculumSnapshotHash(right));
});

test('ordinary curriculum writes stay local until this device is reconciled COMPLETE', async () => {
  const subject = { ...makeSubject({ id: 'subject:gate', name: 'علوم', slug: 'science' }), serverRevision: 1 };
  await store.save({ subjects: [subject] }, { queue: false });
  const historical = makeUnit({ id: 'unit:historical', subjectId: subject.id, grade: 4, termIndex: 1, name: 'قديمة' });
  assert.equal(await store.save({ units: [historical] }), true);
  assert.equal((await db.getAll('outbox')).some((row) => row.store === 'units'), false);

  await store.patchDevice({ curriculumSyncBootstrap: {
    version: 1, state: 'COMPLETE', reconciled: true, ownerId: A, bootstrapId: 'bootstrap:1',
  } }, { queue: false });
  initializeCurriculumSyncGate({ workspace, device: store.state.device });
  const current = makeUnit({ id: 'unit:current', subjectId: subject.id, grade: 4, termIndex: 1, name: 'جديدة' });
  assert.equal(await store.save({ units: [current] }), true);
  const entries = await db.getAll('outbox');
  assert.equal(entries.filter((row) => row.store === 'units').length, 1);
  assert.equal(entries.find((row) => row.store === 'units').ownerId, A);
});

test('reconciled COMPLETE device emits owner-bound unit/lesson create, patch, and tombstone exactly once', async () => {
  const subject = { ...makeSubject({ id: 'subject:ordinary', name: 'علوم', slug: 'ordinary-science' }), serverRevision: 1 };
  await store.save({ subjects: [subject] }, { queue: false });
  await store.patchDevice({ curriculumSyncBootstrap: {
    version: 1, state: 'COMPLETE', reconciled: true, ownerId: A, bootstrapId: 'bootstrap:ordinary',
  } }, { queue: false });
  initializeCurriculumSyncGate({ workspace, device: store.state.device });
  await db.clearStore('outbox');

  const createdUnit = makeUnit({ id: 'unit:ordinary', subjectId: subject.id, grade: 4, termIndex: 1, name: 'الأولى' });
  assert.equal(await store.save({ units: [createdUnit] }), true);
  assert.ok(await store.patch('units', createdUnit.id, { name: 'المحدثة' }));
  const createdLesson = makeLesson({ id: 'lesson:ordinary', unitId: createdUnit.id, name: 'الدرس' });
  assert.equal(await store.save({ lessons: [createdLesson] }), true);
  assert.ok(await store.softDelete('lessons', createdLesson.id));

  const commands = (await db.getAll('outbox')).filter((row) => ['units', 'lessons'].includes(row.store))
    .sort((left, right) => left.sequence - right.sequence);
  assert.deepEqual(commands.map((row) => [row.store, row.op]), [
    ['units', 'create'], ['units', 'patch'], ['lessons', 'create'], ['lessons', 'delete'],
  ]);
  assert.ok(commands.every((row) => row.ownerId === A));
});

test('bootstrap requires verified backup and matching claimed owner', async () => {
  const unit = makeUnit({ id: 'unit:auth', subjectId: 'subject:auth', grade: 4, termIndex: 1, name: 'وحدة' });
  await assert.rejects(submitCurriculumBootstrap({ workspace, deviceId: 'device:a', units: [unit], lessons: [], authoritative: true }),
    (error) => error.code === 'CURRICULUM_BOOTSTRAP_BACKUP_REQUIRED');
  cloud.setMockAuth({ id: B }, { access_token: 'synthetic-b' });
  await assert.rejects(submitCurriculumBootstrap({ workspace, deviceId: 'device:b', units: [unit], lessons: [], authoritative: true, backupVerified: true }),
    (error) => error.code === 'CURRICULUM_BOOTSTRAP_NOT_ELIGIBLE');
});

test('authoritative contribution uses one deterministic envelope and surfaces conflict unchanged', async () => {
  const calls = [];
  cloud.setMockBackend({
    async contributeCurriculumSyncBootstrap(envelope) {
      calls.push(structuredClone(envelope));
      return { state: 'CONFLICT', bootstrapId: envelope.bootstrapId,
        conflicts: [{ entity: 'units', id: envelope.units[0].id, reason: 'same-id-different-content' }] };
    },
  });
  const unit = makeUnit({ id: 'unit:conflict', subjectId: 'subject:conflict', grade: 4, termIndex: 1, name: 'نسخة أ' });
  const result = await submitCurriculumBootstrap({
    workspace, deviceId: 'device:a', bootstrapId: 'bootstrap:conflict', units: [unit], lessons: [],
    authoritative: true, backupVerified: true,
  });
  assert.equal(result.state, 'CONFLICT');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].units[0].id, unit.id);
  assert.equal(calls[0].authoritative, true);
});

test('migration is additive, owner-derived, locked, fail-closed, and exposes full versioned manifest', async () => {
  const sql = await readFile(new URL('../supabase/migrations/0031_curriculum_sync_v2.sql', import.meta.url), 'utf8');
  assert.match(sql, /add column if not exists revision bigint not null default 1/i);
  assert.match(sql, /field_revisions jsonb not null default '\{\}'::jsonb/i);
  assert.match(sql, /disable trigger units_touch[\s\S]*enable trigger units_touch/i);
  assert.match(sql, /enable row level security[\s\S]*force row level security/i);
  assert.match(sql, /v_owner uuid:=auth\.uid\(\)/i);
  assert.match(sql, /pg_advisory_xact_lock/i);
  assert.match(sql, /same-id-different-content/);
  assert.match(sql, /sync_v2_restore_entities_full[\s\S]*'subjects','units','lessons'/i);
  assert.match(sql, /revoke all on function rakeezx\.contribute_curriculum_sync_bootstrap[\s\S]*from public, anon/i);
  assert.doesNotMatch(sql, /assignments|submissions/);
});
