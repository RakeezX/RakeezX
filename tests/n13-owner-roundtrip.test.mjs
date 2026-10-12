import 'fake-indexeddb/auto';
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as db from '../src/lib/db.js';
import * as store from '../src/store.js';
import * as cloud from '../src/lib/cloud.js';
import { n13Account } from './n13-fixture.mjs';
import { lifecycleServer, academicFixture, LifecycleBackend, OWNER } from './helpers/student-lifecycle-server.mjs';
import { createSyncV2Engine, decodeSyncV2Canonical } from '../src/lib/sync-v2.js';
import { runtimeSyncOwnershipGuard } from '../src/lib/sync-ownership.js';
import { makeSession } from '../src/models.js';

global.document = { documentElement: { setAttribute() {}, removeAttribute() {}, classList: { add() {}, remove() {} } }, querySelector: () => ({ setAttribute() {} }) };
global.matchMedia = () => ({ matches: false });
const B = '22222222-2222-4222-8222-222222222222';
let pg, backend, f, engine, lastEnvelope, calls = 0, loseResponse = false;
async function rpc(e) {
  return (await pg.query('select rakeezx.apply_sync_v2_teaching_creation_command($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9) result',
    [e.mutationId, e.deviceId, e.teachingId, e.sectionId, e.subjectId, e.termId, e.order, JSON.stringify(e.itemIds), e.clientUpdatedAt])).rows[0].result;
}
before(async () => {
  pg = await lifecycleServer();
  await pg.query('insert into auth.users values($1)', [B]);
  f = await academicFixture(pg, 'n13-roundtrip');
  await pg.query("insert into rakeezx.subjects(id,name,slug) values('n13-second','العلوم','n13-second'),('n13-third','الرياضيات','n13-third')");
  backend = new LifecycleBackend(pg);
  backend.applySyncV2TeachingCreationCommand = async e => {
    calls++; lastEnvelope = structuredClone(e);
    const result = await rpc(e);
    if (loseResponse) { loseResponse = false; throw new Error('Synthetic lost response after commit'); }
    return result;
  };
  cloud.setMockBackend(backend);
  await n13Account(OWNER);
  await db.clearAll(); store.state.ready = false; await store.init();
  const batch = {};
  for (const [name, table] of Object.entries({ years: 'years', terms: 'terms', subjects: 'subjects', sections: 'sections', teachings: 'teachings', students: 'students', enrollments: 'enrollments', items: 'items', sessions: 'sessions' })) {
    batch[name] = (await backend.fetchRecords(table)).map(row => decodeSyncV2Canonical(name, row));
  }
  await store.save(batch, { queue: false });
  await store.patchDevice({ activeYearId: f.year, activeTermId: f.term });
  await db.clearStore('outbox');
  engine = createSyncV2Engine({ ownershipGuard: runtimeSyncOwnershipGuard, currentAuthenticatedUserId: () => cloud.user?.id });
});
after(async () => { cloud.setMockBackend(null); cloud.setMockAuth(null, null); store.closeChannel(); db.closeDB(); await pg?.close(); });

test('isolated migrated RPC and lifecycle wrapper match saved deployed read-only definitions', async () => {
  const saved = JSON.parse(await readFile(new URL('../docs/automation-evidence/20261012/deployed-teaching-creation.readonly.json', import.meta.url), 'utf8'));
  const body = text => text.slice(text.indexOf('$function$') + 10, text.lastIndexOf('$function$')).replace(/\s+/g, ' ').trim();
  for (const entry of saved.functions) {
    const result = await pg.query('select pg_get_functiondef(oid) definition from pg_proc where proname=$1', [entry.proname]);
    assert.equal(result.rows.length, 1);
    assert.equal(body(result.rows[0].definition), body(entry.definition));
  }
});

test('store proof/outbox → cloud transport → deployed-equivalent RPC → V2 canonical receipt; retry after lost response/reload', async () => {
  const rosterBefore = await Promise.all(['sections', 'students', 'enrollments', 'sessions'].map(name => db.getAll(name)));
  const teaching = await store.createTeaching({ sectionId: f.section, subjectId: 'n13-second', termId: f.term });
  const [command] = await db.getAll('outbox');
  assert.equal(command.ownerId, OWNER); assert.equal(command.command, 'teaching:create');
  assert.equal(command.recordId, teaching.id);
  assert.equal(command.patch.sectionId, f.section);
  assert.equal(command.patch.subjectId, 'n13-second');
  assert.deepEqual(command.patch.itemIds, store.items(teaching.id).map(row => row.id));
  assert.equal(command.patch.itemIds.length, 5);
  loseResponse = true;
  const first = await engine.dispatchPending();
  assert.equal(first.failed, 1);
  const originalEnvelope = structuredClone(lastEnvelope);
  assert.equal((await pg.query('select count(*) from rakeezx.teachings where owner_id=$1 and section_id=$2 and subject_id=$3', [OWNER, f.section, 'n13-second'])).rows[0].count, 1);
  db.closeDB(); store.state.ready = false; await store.init();
  const retry = await engine.dispatchPending();
  assert.ok(retry.acknowledged >= 1); // Reload may also bootstrap an upcoming term.
  assert.equal(calls, 2, 'the teaching command was dispatched exactly once per attempt');
  assert.deepEqual(lastEnvelope, originalEnvelope, 'retry keeps the immutable envelope');
  assert.equal((await db.getAll('outbox')).some(row => row.command === 'teaching:create'), false);
  await store.refreshSyncedState();
  assert.ok(store.getTeaching(teaching.id).serverRevision > 0);
  assert.equal(store.items(teaching.id).length, 5);
  assert.deepEqual(await Promise.all(['sections', 'students', 'enrollments', 'sessions'].map(name => db.getAll(name))), rosterBefore);
  assert.equal((await store.createTeaching({ sectionId: f.section, subjectId: 'n13-second', termId: f.term })).id, teaching.id);
  const receipt = await rpc(originalEnvelope);
  assert.equal(receipt.canonicalTeaching.id, teaching.id);
  await assert.rejects(rpc({ ...originalEnvelope, order: originalEnvelope.order + 1 }), /different request/);
});

test('natural-identity retries adopt the server canonical Teaching/default IDs without cloning roster or old history', async () => {
  const original = { mutationId: 'n13-other-device', deviceId: 'n13-other-device', teachingId: 'n13-server-canonical', sectionId: f.section,
    subjectId: 'n13-third', termId: f.term, order: 2, itemIds: Array.from({ length: 5 }, (_, i) => `n13-canonical-item-${i}`), clientUpdatedAt: 10 };
  const canonical = await rpc(original);
  const local = await store.createTeaching({ sectionId: f.section, subjectId: 'n13-third', termId: f.term });
  assert.notEqual(local.id, original.teachingId);
  const retiredIds = store.items(local.id).map(row => row.id);
  const scoredItem = store.items(local.id).find(row => Number(row.order) === 1);
  const session = makeSession({ id: 'n13-pending-session', teachingId: local.id, date: '2026-09-10', period: 2 });
  const historyBefore = (await db.getAll('items')).filter(row => row.teachingId === f.teaching);
  await store.setScore(f.student, scoredItem.id, 7);
  const score = store.state.scores.find(row => row.studentId === f.student && row.itemId === scoredItem.id);
  await store.save({ sessions: [session] });
  const queued = await db.getAll('outbox');
  const lockedSession = queued.find(row => row.recordId === session.id);
  // A dispatched envelope must remain immutable even after its local parent converges.
  await db.put('outbox', { ...lockedSession, envelopeLocked: true, attemptCount: 1 });
  const push = await engine.dispatchPending({ maxMutations: 1 });
  assert.equal(push.acknowledged, 1);
  await store.refreshSyncedState();
  assert.equal(store.getTeaching(local.id), null);
  assert.equal(store.getTeaching(canonical.canonicalTeaching.id).sectionId, f.section);
  assert.deepEqual(store.items(original.teachingId).map(row => row.id).sort(), original.itemIds.slice().sort());
  const diskItems = await db.getAll('items');
  assert.equal(diskItems.some(row => retiredIds.includes(row.id)), false);
  assert.deepEqual(diskItems.filter(row => row.teachingId === f.teaching), historyBefore);
  assert.equal((await db.get('scores', score.id)).itemId, original.itemIds[1]);
  assert.equal((await db.get('scores', score.id)).value, 7);
  assert.equal((await db.get('sessions', session.id)).teachingId, original.teachingId);
  const outbox = await db.getAll('outbox');
  const scoreCommand = outbox.find(row => row.recordId === score.id);
  assert.equal(scoreCommand.ownerId, OWNER);
  assert.equal(scoreCommand.localPatch.itemId, original.itemIds[1]);
  assert.equal(scoreCommand.patch.item_id, original.itemIds[1]);
  assert.ok(scoreCommand.dependencies.some(row => row.store === 'items' && row.recordId === original.itemIds[1]));
  const sessionCommand = outbox.find(row => row.id === lockedSession.id);
  assert.equal(sessionCommand.state, 'blocked');
  assert.equal(sessionCommand.blockedReason, 'canonical-reference-remap-after-dispatch');
  assert.deepEqual(sessionCommand.patch, lockedSession.patch);
  assert.equal(sessionCommand.ownerId, OWNER);
  assert.equal(store.getTeaching(f.teaching).id, f.teaching);
  assert.equal(store.students(original.teachingId)[0].id, f.student);
  assert.equal((await store.createTeaching({ sectionId: f.section, subjectId: 'n13-third', termId: f.term })).id, original.teachingId);
});

test('owner B and missing Auth fail at RPC; mismatched authenticated local owner dispatches no commands', async () => {
  const e = { ...lastEnvelope, mutationId: 'n13-owner-denied' };
  await pg.query('update auth.current_identity set id=$1', [B]);
  await assert.rejects(rpc(e), /section is unavailable/);
  await pg.query('update auth.current_identity set id=null');
  await assert.rejects(rpc(e), /Authentication required/);
  await pg.query('update auth.current_identity set id=$1', [OWNER]);
  assert.equal((await pg.query("select count(*) from rakeezx.sync_mutation_receipts where mutation_id='n13-owner-denied'")).rows[0].count, 0);
  const other = await store.createSection({ grade: 6, label: 'owner-guard' });
  await store.createTeaching({ sectionId: other.id, subjectId: 'n13-second', termId: f.term });
  const count = calls;
  cloud.setMockAuth({ id: B }, { access_token: 'synthetic-owner-B' });
  const result = await engine.dispatchPending();
  assert.ok(result.blocked > 0); assert.equal(calls, count);
  assert.ok(store.getSection(f.section));
});
