import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';

import { STORES } from '../src/lib/db.js';
import { createSyncV2Engine } from '../src/lib/sync-v2.js';
import { DEFAULT_TIME_PROFILES, makeTimeProfile } from '../src/models.js';

const clone = (value) => value == null ? value : structuredClone(value);

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error ?? new Error('transaction aborted'));
  });
}

class IsolatedIndexedDb {
  constructor(name) {
    this.name = name;
    this.factory = new IDBFactory();
    this.connection = null;
    this.failNextStore = null;
  }

  async open() {
    if (this.connection) return this.connection;
    const request = this.factory.open(this.name, 1);
    request.onupgradeneeded = () => {
      for (const store of STORES) request.result.createObjectStore(store, { keyPath: 'id' });
    };
    this.connection = await requestResult(request);
    return this.connection;
  }

  async getAll(store) {
    const connection = await this.open();
    return requestResult(connection.transaction(store, 'readonly').objectStore(store).getAll());
  }

  async get(store, id) {
    const connection = await this.open();
    return requestResult(connection.transaction(store, 'readonly').objectStore(store).get(id));
  }

  async applyBatch(batch, { prepare } = {}) {
    const names = Object.keys(batch);
    const connection = await this.open();
    const transaction = connection.transaction(names, 'readwrite');
    let failure;
    const completion = transactionDone(transaction);
    try {
      const current = {};
      for (const name of names) current[name] = await requestResult(transaction.objectStore(name).getAll());
      const writes = prepare ? prepare(current) : batch;
      if (!writes || typeof writes.then === 'function') throw new TypeError('prepare must be synchronous');
      for (const [name, operations] of Object.entries(writes)) {
        if (this.failNextStore === name) {
          this.failNextStore = null;
          throw new Error(`injected ${name} write failure`);
        }
        const store = transaction.objectStore(name);
        for (const id of operations.remove ?? []) store.delete(id);
        for (const record of operations.put ?? []) store.put(record);
      }
    } catch (error) {
      failure = error;
      transaction.abort();
    }
    try {
      await completion;
    } catch (error) {
      throw failure ?? error;
    }
  }

  close() {
    this.connection?.close();
    this.connection = null;
  }
}

const FIELD_GROUPS = {
  profile: { active_time_profile_id: 'timing_selection' },
  time_profiles: { active_from: 'activation', active_to: 'activation' },
  students: { name: 'name', note: 'note', status: 'status' },
  subjects: { name: 'name', slug: 'identity' },
  scores: { student_id: 'identity', item_id: 'identity', value: 'value' },
  teachings: { section_id: 'identity', subject_id: 'identity', term_id: 'identity', order: 'order' },
  sessions: { teaching_id: 'identity', date: 'identity', period: 'identity' },
  class_goals: {
    teaching_id: 'identity', run_id: 'goal', date: 'goal', session_id: 'goal', text: 'goal',
    preset_key: 'goal', duration_minutes: 'goal', reward_points: 'goal', state: 'goal',
    started_at: 'goal', completed_at: 'goal', reward_operation_id: 'goal',
  },
  class_charter_selections: { teaching_id: 'identity', selected_rule_ids: 'selection' },
  group_arrangements: { teaching_id: 'identity', groups: 'arrangement' },
};

class MemoryV2Server {
  constructor() {
    this.tables = new Map();
    this.receipts = new Map();
    this.calls = [];
  }

  table(entity) {
    if (!this.tables.has(entity)) this.tables.set(entity, new Map());
    return this.tables.get(entity);
  }

  naturalCanonical(entity, patch) {
    if (entity === 'subjects' && patch.slug != null) {
      return [...this.table(entity).values()].find((row) => row.slug === patch.slug) ?? null;
    }
    if (entity === 'sessions' && patch.teaching_id && patch.date && patch.period != null) {
      return [...this.table(entity).values()].find((row) =>
        row.teaching_id === patch.teaching_id && row.date === patch.date && row.period === patch.period,
      ) ?? null;
    }
    if (entity === 'group_arrangements' && patch.teaching_id) {
      return [...this.table(entity).values()].find((row) => row.teaching_id === patch.teaching_id) ?? null;
    }
    return null;
  }

  group(entity, field) {
    return FIELD_GROUPS[entity]?.[field] ?? field;
  }

  async applyMutation(envelope) {
    this.calls.push(clone(envelope));
    const previous = this.receipts.get(envelope.mutationId);
    if (previous) {
      assert.deepEqual(envelope, previous.envelope, 'a retried mutation must retain its exact envelope');
      return clone(previous.result);
    }

    const table = this.table(envelope.entity);
    let row = table.get(envelope.recordId) ?? null;
    let outcome = 'applied';
    let canonicalId = envelope.recordId;
    let appliedGroups = [];
    let conflictedGroups = [];

    if (envelope.operation === 'create') {
      const natural = this.naturalCanonical(envelope.entity, envelope.patch);
      if (natural && natural.id !== envelope.recordId) {
        row = natural;
        canonicalId = natural.id;
        outcome = natural.deleted_at ? 'tombstoned' : 'canonicalized';
        conflictedGroups = [natural.deleted_at ? '__deleted__' : '__canonical__'];
      } else if (row) {
        outcome = 'conflict';
        conflictedGroups = ['__record__'];
      } else {
        const groups = [...new Set(Object.keys(envelope.patch).map((field) => this.group(envelope.entity, field)))];
        row = {
          id: envelope.recordId,
          ...clone(envelope.patch),
          revision: 1,
          field_revisions: Object.fromEntries(groups.map((group) => [group, 1])),
          deleted_at: null,
          client_updated_at: envelope.clientUpdatedAt,
        };
        appliedGroups = groups;
        table.set(row.id, row);
      }
    } else if (!row) {
      outcome = 'not_found';
      conflictedGroups = ['__record__'];
    } else if (row.deleted_at && envelope.operation !== 'delete') {
      outcome = 'tombstoned';
      conflictedGroups = ['__deleted__'];
    } else if (envelope.operation === 'delete') {
      if (row.deleted_at) {
        outcome = 'already_deleted';
      } else {
        row = { ...row, deleted_at: new Date().toISOString(), revision: row.revision + 1 };
        table.set(row.id, row);
        outcome = 'deleted';
        appliedGroups = ['__deleted__'];
      }
    } else {
      const fields = Object.keys(envelope.patch);
      const groups = [...new Set(fields.map((field) => this.group(envelope.entity, field)))];
      conflictedGroups = groups.filter((group) => (row.field_revisions?.[group] ?? 1) > envelope.baseRevision);
      appliedGroups = groups.filter((group) => !conflictedGroups.includes(group));
      const effective = Object.fromEntries(fields.filter((field) => appliedGroups.includes(this.group(envelope.entity, field))).map((field) => [field, clone(envelope.patch[field])]));
      if (Object.keys(effective).length) {
        const revision = row.revision + 1;
        row = {
          ...row,
          ...effective,
          revision,
          field_revisions: {
            ...(row.field_revisions ?? {}),
            ...Object.fromEntries(appliedGroups.map((group) => [group, revision])),
          },
          client_updated_at: envelope.clientUpdatedAt,
        };
        table.set(row.id, row);
      }
      outcome = conflictedGroups.length ? (appliedGroups.length ? 'applied_with_conflicts' : 'conflict') : 'applied';
    }

    const result = {
      mutationId: envelope.mutationId,
      entity: envelope.entity,
      recordId: envelope.recordId,
      canonicalId: row?.id ?? canonicalId,
      outcome,
      appliedGroups,
      conflictedGroups,
      resultRevision: row?.revision ?? null,
      canonical: clone(row),
    };
    this.receipts.set(envelope.mutationId, { envelope: clone(envelope), result: clone(result) });
    return result;
  }

  async fetchRecords(entity) {
    return clone([...this.table(entity).values()]);
  }
}

let sequence = 0;
function makeClient(server, label, overrides = {}) {
  const database = new IsolatedIndexedDb(`sync-v2-${label}-${++sequence}`);
  let clock = 1_800_000_000_000;
  let ids = 0;
  const engine = createSyncV2Engine({
    database,
    transport: overrides.transport ?? server,
    now: () => ++clock,
    makeId: () => `${label}-${++ids}`,
  });
  return { database, engine };
}

async function seedAuthoritative(client, store, record) {
  const canonical = {
    ...record,
    canonicalId: record.id,
    serverRevision: 1,
    deleted: false,
  };
  await client.database.applyBatch({ [store]: {} }, {
    prepare: () => ({ [store]: { put: [{ ...canonical, serverCanonical: clone(canonical) }], remove: [] } }),
  });
}

async function queueDefaultTimeProfiles(client) {
  for (const [order, preset] of DEFAULT_TIME_PROFILES.entries()) {
    const record = makeTimeProfile({ ...preset, order });
    const { mutation } = await client.engine.commitMutation({
      store: 'timeProfiles', recordId: record.id, op: 'create', create: record,
    });
    await client.database.applyBatch({ outbox: {} }, {
      prepare(current) {
        const queued = current.outbox.find((row) => row.id === mutation.id);
        return { outbox: { put: queued ? [{ ...queued, bootstrap: true }] : [], remove: [] } };
      },
    });
  }
}

test('Sync V2 atomically persists optimistic data and a durable outbox mutation', async (t) => {
  const server = new MemoryV2Server();
  const client = makeClient(server, 'atomic');
  t.after(() => client.database.close());

  client.database.failNextStore = 'outbox';
  await assert.rejects(() => client.engine.commitMutation({
    store: 'students', recordId: 'student-1', op: 'create', patch: { name: 'Student A', note: '' },
  }), /injected outbox/);
  assert.equal(await client.database.get('students', 'student-1'), undefined);
  assert.equal((await client.database.getAll('outbox')).length, 0);

  const committed = await client.engine.commitMutation({
    store: 'students', recordId: 'student-1', op: 'create', patch: { name: 'Student A', note: '' },
  });
  assert.equal((await client.database.get('students', 'student-1')).name, 'Student A');
  assert.equal((await client.database.getAll('outbox'))[0].mutationId, committed.mutation.mutationId);
  assert.equal(await client.engine.ensureDeviceId(), committed.mutation.deviceId);
  assert.equal(await client.engine.ensureDeviceId(), committed.mutation.deviceId);
  const command = await client.engine.queueCommand({
    store: 'enrollments', recordId: 'enrollment-command', command: 'transfer',
    patch: { destinationSectionId: 'section-2' }, groups: ['membership'],
    dependencies: [{ store: 'students', recordId: 'student-1' }],
  });
  assert.equal(command.op, 'command');
  assert.equal(command.deviceId, committed.mutation.deviceId);
  assert.equal(command.state, 'pending');
});

test('class rules converge across three generic V2 clients and tombstones win on a fresh device', async (t) => {
  const server = new MemoryV2Server();
  const a = makeClient(server, 'class-rules-a');
  const b = makeClient(server, 'class-rules-b');
  const c = makeClient(server, 'class-rules-c');
  t.after(() => [a, b, c].forEach((client) => client.database.close()));

  const teaching = { id: 'rule-teaching', sectionId: 'section-1', subjectId: 'subject-1', termId: 'term-1', order: 0 };
  await Promise.all([seedAuthoritative(a, 'teachings', teaching), seedAuthoritative(b, 'teachings', teaching), seedAuthoritative(c, 'teachings', teaching)]);
  await a.engine.commitMutation({
    store: 'classRules', recordId: 'rule-1', op: 'create',
    patch: { teachingId: teaching.id, iconKey: 'star', text: 'قاعدة مشتركة' },
  });
  assert.equal((await a.engine.dispatchPending()).acknowledged, 1);
  await Promise.all([b.engine.pullStore('classRules'), c.engine.pullStore('classRules')]);
  await b.engine.commitMutation({ store: 'classRules', recordId: 'rule-1', op: 'patch', patch: { text: 'قاعدة معدلة' } });
  await c.engine.commitMutation({ store: 'classRules', recordId: 'rule-1', op: 'patch', patch: { iconKey: 'shield' } });
  await Promise.all([b.engine.dispatchPending(), c.engine.dispatchPending()]);
  await Promise.all([a.engine.pullStore('classRules'), b.engine.pullStore('classRules'), c.engine.pullStore('classRules')]);
  for (const client of [a, b, c]) {
    const record = await client.database.get('classRules', 'rule-1');
    assert.equal(record.text, 'قاعدة معدلة');
    assert.equal(record.iconKey, 'shield');
  }

  await a.engine.commitMutation({ store: 'classRules', recordId: 'rule-1', op: 'delete' });
  assert.equal((await a.engine.dispatchPending()).acknowledged, 1);
  await Promise.all([b.engine.pullStore('classRules'), c.engine.pullStore('classRules')]);
  for (const client of [b, c]) assert.equal((await client.database.get('classRules', 'rule-1')).deleted, true);
  assert.equal((await b.engine.status()).state, 'synced');
});

test('one teaching group arrangement canonicalizes and converges as one invariant field across three clients', async (t) => {
  const server = new MemoryV2Server();
  const a = makeClient(server, 'groups-a');
  const b = makeClient(server, 'groups-b');
  const c = makeClient(server, 'groups-c');
  const later = makeClient(server, 'groups-later');
  t.after(() => [a, b, c, later].forEach((client) => client.database.close()));

  const teaching = { id: 'groups-teaching', sectionId: 'section-1', subjectId: 'subject-1', termId: 'term-1', order: 0 };
  await Promise.all([a, b, c].map((client) => seedAuthoritative(client, 'teachings', teaching)));
  const creates = [
    [a, 'groups:a', [['student-1', 'student-2'], ['student-3']]],
    [b, 'groups:b', [['student-2'], ['student-1', 'student-3']]],
    [c, 'groups:c', [['student-3'], ['student-2', 'student-1']]],
  ];
  await Promise.all(creates.map(([client, id, groups]) => client.engine.commitMutation({
    store: 'groupArrangements', recordId: id, op: 'create', patch: { teachingId: teaching.id, groups },
  })));
  await Promise.all(creates.map(([client]) => client.engine.dispatchPending()));
  assert.equal(server.table('group_arrangements').size, 1, 'one canonical arrangement must survive a create race');
  const canonicalId = [...server.table('group_arrangements').keys()][0];
  await Promise.all([a, b, c].map((client) => client.engine.pullStore('groupArrangements')));
  for (const client of [a, b, c]) {
    assert.equal((await client.database.getAll('groupArrangements')).filter((row) => !row.deleted).length, 1);
    assert.ok(await client.database.get('groupArrangements', canonicalId));
  }

  await b.engine.commitMutation({
    store: 'groupArrangements', recordId: canonicalId, op: 'patch',
    patch: { groups: [['student-1'], ['student-2', 'student-3']] },
  });
  await c.engine.commitMutation({
    store: 'groupArrangements', recordId: canonicalId, op: 'patch',
    patch: { groups: [['student-3', 'student-1'], ['student-2']] },
  });
  await b.engine.dispatchPending();
  await c.engine.dispatchPending();
  await Promise.all([a, b, c].map((client) => client.engine.pullStore('groupArrangements')));
  for (const client of [a, b, c]) {
    assert.deepEqual((await client.database.get('groupArrangements', canonicalId)).groups,
      [['student-1'], ['student-2', 'student-3']], 'concurrent layouts must never field-merge');
  }

  await a.engine.commitMutation({ store: 'groupArrangements', recordId: canonicalId, op: 'delete' });
  assert.equal((await a.engine.dispatchPending()).acknowledged, 1);
  await later.engine.pullStore('groupArrangements');
  assert.equal((await later.database.get('groupArrangements', canonicalId)).deleted, true);
});

test('offline group arrangement edit remains durable and converges after reconnect', async (t) => {
  const server = new MemoryV2Server();
  let online = false;
  const transport = {
    fetchRecords: (entity) => server.fetchRecords(entity),
    applyMutation(envelope) {
      if (!online) throw new Error('offline');
      return server.applyMutation(envelope);
    },
  };
  const source = makeClient(server, 'groups-offline', { transport });
  const peer = makeClient(server, 'groups-peer');
  t.after(() => [source, peer].forEach((client) => client.database.close()));

  const teaching = { id: 'groups-offline-teaching', sectionId: 'section-1', subjectId: 'subject-1', termId: 'term-1', order: 0 };
  await Promise.all([source, peer].map((client) => seedAuthoritative(client, 'teachings', teaching)));
  const groups = [['student-1', 'student-2'], ['student-3']];
  const { mutation } = await source.engine.commitMutation({
    store: 'groupArrangements', recordId: 'groups:offline', op: 'create',
    patch: { teachingId: teaching.id, groups },
  });
  assert.equal((await source.engine.dispatchPending()).failed, 1);
  assert.equal((await source.database.getAll('outbox'))[0].mutationId, mutation.mutationId,
    'offline work must retain its original durable identity');

  online = true;
  assert.equal((await source.engine.dispatchPending()).acknowledged, 1);
  assert.equal((await source.database.getAll('outbox')).length, 0);
  await peer.engine.pullStore('groupArrangements');
  assert.deepEqual((await peer.database.get('groupArrangements', 'groups:offline')).groups, groups);
});

test('class Goal invariant fields and charter selection converge across devices without tombstone resurrection', async (t) => {
  const server = new MemoryV2Server();
  const a = makeClient(server, 'class-goal-a');
  const b = makeClient(server, 'class-goal-b');
  const c = makeClient(server, 'class-goal-c');
  const later = makeClient(server, 'class-goal-later');
  t.after(() => [a, b, c, later].forEach((client) => client.database.close()));

  const teaching = { id: 'goal-teaching', sectionId: 'section-1', subjectId: 'subject-1', termId: 'term-1', order: 0 };
  await Promise.all([a, b, c].map((client) => seedAuthoritative(client, 'teachings', teaching)));
  const original = {
    teachingId: teaching.id, runId: 'run-1', date: '2026-09-09', sessionId: null,
    text: 'الهدف الأصلي', presetKey: null, durationMinutes: 10, rewardPoints: 2,
    state: 'active', startedAt: 1_800_000_000_100, completedAt: null, rewardOperationId: null,
  };
  await a.engine.commitMutation({ store: 'classGoals', recordId: `class-goal:${teaching.id}`, op: 'create', patch: original });
  await a.engine.commitMutation({
    store: 'classCharterSelections', recordId: `class-charter-selection:${teaching.id}`, op: 'create',
    patch: { teachingId: teaching.id, selectedRuleIds: ['rule-a'] },
  });
  assert.equal((await a.engine.dispatchPending()).acknowledged, 2);
  await Promise.all([
    b.engine.pullStore('classGoals'), c.engine.pullStore('classGoals'),
    b.engine.pullStore('classCharterSelections'), c.engine.pullStore('classCharterSelections'),
  ]);

  await b.engine.commitMutation({
    store: 'classGoals', recordId: `class-goal:${teaching.id}`, op: 'patch',
    patch: { text: 'هدف الجهاز ب', rewardPoints: 3 },
  });
  await c.engine.commitMutation({
    store: 'classGoals', recordId: `class-goal:${teaching.id}`, op: 'patch',
    patch: { durationMinutes: 25, startedAt: 1_800_000_000_500 },
  });
  await b.engine.commitMutation({
    store: 'classCharterSelections', recordId: `class-charter-selection:${teaching.id}`, op: 'patch',
    patch: { selectedRuleIds: ['rule-a', 'rule-b'] },
  });
  await b.engine.dispatchPending();
  await c.engine.dispatchPending();
  await Promise.all([a, b, c].flatMap((client) => [client.engine.pullStore('classGoals'), client.engine.pullStore('classCharterSelections')]));
  for (const client of [a, b, c]) {
    const goal = await client.database.get('classGoals', `class-goal:${teaching.id}`);
    assert.deepEqual(
      { text: goal.text, rewardPoints: goal.rewardPoints, durationMinutes: goal.durationMinutes, startedAt: goal.startedAt },
      { text: 'هدف الجهاز ب', rewardPoints: 3, durationMinutes: 10, startedAt: original.startedAt },
      'one device must win the whole Goal invariant group; mixed timer/reward state is invalid',
    );
    assert.deepEqual((await client.database.get('classCharterSelections', `class-charter-selection:${teaching.id}`)).selectedRuleIds, ['rule-a', 'rule-b']);
  }

  await a.engine.commitMutation({ store: 'classGoals', recordId: `class-goal:${teaching.id}`, op: 'delete' });
  assert.equal((await a.engine.dispatchPending()).acknowledged, 1);
  await later.engine.pullStore('classGoals');
  assert.equal((await later.database.get('classGoals', `class-goal:${teaching.id}`)).deleted, true);
});

test('pull adopts an existing bootstrap identity and preserves a later local edit', async (t) => {
  const server = new MemoryV2Server();
  const client = makeClient(server, 'bootstrap-adoption');
  t.after(() => client.database.close());

  await client.engine.commitMutation({
    store: 'profile', recordId: 'profile', op: 'create',
    patch: { teacherName: '', schoolName: '', phone: '', reportPrincipalName: '' },
  });
  await client.database.applyBatch({ outbox: {} }, {
    prepare(current) {
      return { outbox: { put: current.outbox.map((mutation) => ({ ...mutation, bootstrap: true })), remove: [] } };
    },
  });
  await client.engine.commitMutation({
    store: 'profile', recordId: 'profile', op: 'patch', patch: { schoolName: 'Local School' },
  });
  server.table('profile').set('profile', {
    id: 'profile', teacher_name: 'Cloud Teacher', school_name: '', phone: '', report_principal_name: '',
    revision: 3, field_revisions: { teacher_name: 3, school_name: 1, phone: 1, report_principal_name: 1 },
    deleted_at: null, client_updated_at: 1_800_000_000_000,
  });

  await client.engine.pullStore('profile');
  const adopted = await client.database.get('profile', 'profile');
  assert.equal(adopted.teacherName, 'Cloud Teacher');
  assert.equal(adopted.schoolName, 'Local School');
  const [pending] = await client.database.getAll('outbox');
  assert.equal(pending.op, 'patch');
  assert.equal(pending.baseRevision, 3);
  assert.equal(server.calls.length, 0, 'the redundant bootstrap create must not reach the server');

  const pushed = await client.engine.dispatchPending();
  assert.equal(pushed.acknowledged, 1);
  assert.equal(server.table('profile').get('profile').school_name, 'Local School');
  assert.equal((await client.engine.status()).state, 'synced');
});

test('stable default Timing Profile identities converge across concurrent and later devices', async (t) => {
  const server = new MemoryV2Server();
  const clients = ['timing-a', 'timing-b', 'timing-c'].map((label) => makeClient(server, label));
  const later = makeClient(server, 'timing-later');
  t.after(() => [...clients, later].forEach((client) => client.database.close()));
  const expectedIds = DEFAULT_TIME_PROFILES.map((profile) => profile.id).sort();

  await Promise.all(clients.map((client) => queueDefaultTimeProfiles(client)));
  await Promise.all(clients.map((client) => client.engine.pullStore('timeProfiles')));
  await Promise.all(clients.map((client) => client.engine.dispatchPending()));
  await Promise.all(clients.map((client) => client.engine.pullStore('timeProfiles')));

  assert.equal(server.table('time_profiles').size, 4);
  for (const client of clients) {
    const rows = await client.database.getAll('timeProfiles');
    assert.deepEqual(rows.filter((row) => !row.deleted).map((row) => row.id).sort(), expectedIds);
    assert.equal(rows.some((row) => row.syncConflicts?.length), false);
    assert.equal((await client.engine.status()).state, 'synced');
  }
  assert.deepEqual(
    [...server.table('time_profiles').values()].map((row) => row.overrides?.config?.type).sort(),
    ['hybrid', 'ramadan', 'summer', 'winter'],
  );

  const custom = makeTimeProfile({ id: 'timing-custom', name: 'ملف مخصص', overrides: { config: { type: 'custom' } } });
  await clients[0].engine.commitMutation({
    store: 'timeProfiles', recordId: custom.id, op: 'create', create: custom,
  });
  await clients[0].engine.dispatchPending();
  assert.equal(server.table('time_profiles').size, 5);
  assert.equal(server.table('time_profiles').get(custom.id).name, 'ملف مخصص');

  const deletedId = DEFAULT_TIME_PROFILES[0].id;
  await clients[0].engine.commitMutation({ store: 'timeProfiles', recordId: deletedId, op: 'delete' });
  await clients[0].engine.dispatchPending();
  assert.ok(server.table('time_profiles').get(deletedId).deleted_at);

  await queueDefaultTimeProfiles(later);
  const serverCallsBeforePull = server.calls.length;
  await later.engine.pullStore('timeProfiles');
  assert.equal((await later.engine.dispatchPending()).attempted, 0);
  assert.equal(server.calls.length, serverCallsBeforePull, 'a later device must adopt without duplicate creates');
  const laterRows = await later.database.getAll('timeProfiles');
  assert.deepEqual(laterRows.filter((row) => !row.deleted).map((row) => row.id).sort(),
    [...expectedIds.filter((id) => id !== deletedId), custom.id].sort());
  assert.equal(laterRows.find((row) => row.id === deletedId)?.deleted, true);
  assert.equal(laterRows.some((row) => row.syncConflicts?.length), false);
  assert.equal(server.table('time_profiles').size, 5);
});

test('owner-global Timing Profile selection converges without bootstrap writes from old device preferences', async (t) => {
  const server = new MemoryV2Server();
  const a = makeClient(server, 'timing-selection-a');
  const b = makeClient(server, 'timing-selection-b');
  const fresh = makeClient(server, 'timing-selection-fresh');
  t.after(() => [a, b, fresh].forEach((client) => client.database.close()));

  await queueDefaultTimeProfiles(a);
  await a.engine.dispatchPending();
  server.table('profile').set('profile', {
    id: 'profile', teacher_name: '', school_name: '', phone: '', report_principal_name: '',
    active_time_profile_id: null, revision: 1,
    field_revisions: { teacher_name: 1, school_name: 1, phone: 1, report_principal_name: 1, timing_selection: 1 },
    deleted_at: null, client_updated_at: 1,
  });

  await Promise.all([a.engine.pullStore('profile'), a.engine.pullStore('timeProfiles'), b.engine.pullStore('profile'), b.engine.pullStore('timeProfiles')]);
  const winter = DEFAULT_TIME_PROFILES.find((profile) => profile.id.endsWith(':winter')).id;
  const ramadan = DEFAULT_TIME_PROFILES.find((profile) => profile.id.endsWith(':ramadan')).id;

  const aSelection = await a.engine.commitMutation({
    store: 'profile', recordId: 'profile', op: 'patch', patch: { activeTimeProfileId: winter },
  });
  const bConcurrentSelection = await b.engine.commitMutation({
    store: 'profile', recordId: 'profile', op: 'patch', patch: { activeTimeProfileId: ramadan },
  });
  assert.equal(aSelection.mutation.patch.active_time_profile_id, winter);
  assert.equal((await a.database.getAll('outbox')).length, 1, 'offline selection is durable before reconnect');
  await Promise.all([a.engine.dispatchPending(), b.engine.dispatchPending()]);
  await Promise.all([a.engine.pullStore('profile'), b.engine.pullStore('profile')]);
  assert.equal((await a.database.get('profile', 'profile')).activeTimeProfileId, winter);
  assert.equal((await b.database.get('profile', 'profile')).activeTimeProfileId, winter);
  assert.equal((await a.engine.status()).state, 'synced');
  assert.equal((await b.engine.status()).state, 'synced');

  const bSelection = await b.engine.commitMutation({
    store: 'profile', recordId: 'profile', op: 'patch', patch: { activeTimeProfileId: ramadan },
  });
  await b.engine.dispatchPending();
  await a.engine.pullStore('profile');
  assert.equal((await a.database.get('profile', 'profile')).activeTimeProfileId, ramadan);
  assert.equal(server.table('profile').get('profile').active_time_profile_id, ramadan);

  // A later device may bootstrap its four stable rows, but must only adopt the
  // owner selection it pulled; it never emits a selection from local defaults.
  await queueDefaultTimeProfiles(fresh);
  await fresh.engine.pullStore('profile');
  const pending = await fresh.database.getAll('outbox');
  assert.equal(pending.some((mutation) => mutation.store === 'profile'), false);
  assert.equal((await fresh.database.get('profile', 'profile')).activeTimeProfileId, ramadan);
  await fresh.engine.pullStore('timeProfiles');
  assert.equal((await fresh.database.getAll('timeProfiles')).filter((row) => !row.deleted).length, 4);
  assert.equal(bSelection.mutation.patch.active_time_profile_id, ramadan);
  assert.equal(bConcurrentSelection.mutation.patch.active_time_profile_id, ramadan);
});

test('Timing Profile effective dates converge through the ordinary activation group', async (t) => {
  const server = new MemoryV2Server();
  const a = makeClient(server, 'timing-dates-a');
  const b = makeClient(server, 'timing-dates-b');
  const fresh = makeClient(server, 'timing-dates-fresh');
  t.after(() => [a, b, fresh].forEach((client) => client.database.close()));
  const profile = makeTimeProfile({ ...DEFAULT_TIME_PROFILES[1], order: 1 });

  await a.engine.commitMutation({ store: 'timeProfiles', recordId: profile.id, op: 'create', create: profile });
  await a.engine.dispatchPending();
  await Promise.all([b.engine.pullStore('timeProfiles'), fresh.engine.pullStore('timeProfiles')]);

  const start = await a.engine.commitMutation({
    store: 'timeProfiles', recordId: profile.id, op: 'patch', patch: { activeFrom: '2026-09-01' },
  });
  assert.equal(start.mutation.patch.active_from, '2026-09-01');
  assert.equal((await a.database.getAll('outbox')).length, 1, 'offline start-date edit is durable');
  await a.engine.dispatchPending();
  await b.engine.pullStore('timeProfiles');
  assert.equal((await b.database.get('timeProfiles', profile.id)).activeFrom, '2026-09-01');

  const end = await b.engine.commitMutation({
    store: 'timeProfiles', recordId: profile.id, op: 'patch', patch: { activeTo: '2026-10-01' },
  });
  assert.equal(end.mutation.patch.active_to, '2026-10-01');
  await b.engine.dispatchPending();
  await a.engine.pullStore('timeProfiles');
  assert.deepEqual(
    [
      (await a.database.get('timeProfiles', profile.id)).activeFrom,
      (await a.database.get('timeProfiles', profile.id)).activeTo,
    ],
    ['2026-09-01', '2026-10-01'],
  );

  await fresh.engine.pullStore('timeProfiles');
  const freshProfile = await fresh.database.get('timeProfiles', profile.id);
  assert.equal(freshProfile.activeFrom, '2026-09-01');
  assert.equal(freshProfile.activeTo, '2026-10-01');
  assert.equal((await a.engine.status()).state, 'synced');
  assert.equal((await b.engine.status()).state, 'synced');
});

test('lost response retries the exact mutationId and clears one receipt without duplication', async (t) => {
  const server = new MemoryV2Server();
  let loseFirstResponse = true;
  const transport = {
    fetchRecords: (entity) => server.fetchRecords(entity),
    async applyMutation(envelope) {
      const result = await server.applyMutation(envelope);
      if (loseFirstResponse) {
        loseFirstResponse = false;
        throw new Error('response lost after commit');
      }
      return result;
    },
  };
  const client = makeClient(server, 'lost', { transport });
  t.after(() => client.database.close());

  const { mutation } = await client.engine.commitMutation({
    store: 'students', recordId: 'student-lost', op: 'create', patch: { name: 'Student Lost' },
  });
  assert.equal((await client.engine.dispatchPending()).failed, 1);
  assert.equal((await client.database.getAll('outbox')).length, 1);
  assert.equal((await client.engine.dispatchPending()).acknowledged, 1);
  assert.equal((await client.database.getAll('outbox')).length, 0);
  assert.equal(server.receipts.size, 1);
  assert.equal(server.table('students').size, 1);
  assert.equal(server.calls[0].mutationId, mutation.mutationId);
  assert.equal(server.calls[1].mutationId, mutation.mutationId);
});

test('automatic parent dependencies send the parent before its child', async (t) => {
  const server = new MemoryV2Server();
  const client = makeClient(server, 'dependency-order');
  t.after(() => client.database.close());

  await seedAuthoritative(client, 'sections', { id: 'section-order', yearId: 'year-order', grade: 4, label: 'A', name: '4/A', color: '#000', order: 0 });
  await seedAuthoritative(client, 'terms', { id: 'term-order', yearId: 'year-order', index: 1, name: 'Term', startDate: null, endDate: null, status: 'active', calendarId: null });
  const parent = await client.engine.commitMutation({ store: 'subjects', recordId: 'subject-order', op: 'create', patch: { name: 'Order', slug: 'order' } });
  const child = await client.engine.commitMutation({
    store: 'teachings', recordId: 'teaching-order', op: 'create',
    patch: { sectionId: 'section-order', subjectId: 'subject-order', termId: 'term-order', order: 0 },
  });
  assert.equal(child.mutation.dependencies[0].mutationId, parent.mutation.mutationId);
  assert.equal((await client.engine.dispatchPending()).acknowledged, 2);
  assert.deepEqual(server.calls.map((call) => call.entity), ['subjects', 'teachings']);
  assert.equal((await client.database.getAll('outbox')).length, 0);
});

test('a blocked child is durable, does not turn the run fatal, and automatically recovers after its parent arrives', async (t) => {
  const server = new MemoryV2Server();
  const client = makeClient(server, 'dependency-recovery');
  t.after(() => client.database.close());

  await seedAuthoritative(client, 'sections', { id: 'section-later', yearId: 'year-later', grade: 4, label: 'A', name: '4/A', color: '#000', order: 0 });
  await seedAuthoritative(client, 'terms', { id: 'term-later', yearId: 'year-later', index: 1, name: 'Term', startDate: null, endDate: null, status: 'active', calendarId: null });
  await client.engine.commitMutation({
    store: 'teachings', recordId: 'teaching-later', op: 'create',
    patch: { sectionId: 'section-later', subjectId: 'subject-later', termId: 'term-later', order: 0 },
  });
  await client.engine.commitMutation({ store: 'students', recordId: 'student-independent', op: 'create', patch: { name: 'Independent' } });

  const first = await client.engine.dispatchPending();
  assert.deepEqual(first, { attempted: 1, acknowledged: 1, failed: 0, blocked: 1 });
  assert.equal(server.table('students').get('student-independent').name, 'Independent');
  assert.equal((await client.engine.status()).state, 'blocked');
  assert.equal((await client.database.getAll('outbox'))[0].state, 'blocked');

  await client.engine.reconcilePull('subjects', [{ id: 'subject-later', name: 'Later', slug: 'later', revision: 1, deleted_at: null, client_updated_at: 1 }]);
  const recovered = await client.engine.dispatchPending();
  assert.equal(recovered.acknowledged, 1);
  assert.equal((await client.database.getAll('outbox')).length, 0);
  assert.equal((await client.engine.status()).state, 'synced');
  assert.equal(server.calls.at(-1).entity, 'teachings');
});

test('protocol-invalid work is durably rejected without a fatal sync state', async (t) => {
  const server = new MemoryV2Server();
  const transport = {
    fetchRecords: (entity) => server.fetchRecords(entity),
    applyMutation() {
      const error = new Error('invalid protocol field');
      error.status = 400;
      error.code = '22023';
      throw error;
    },
  };
  const client = makeClient(server, 'rejected', { transport });
  t.after(() => client.database.close());

  await client.engine.commitMutation({ store: 'students', recordId: 'student-rejected', op: 'create', patch: { name: 'Rejected' } });
  const result = await client.engine.dispatchPending();
  assert.deepEqual(result, { attempted: 1, acknowledged: 0, failed: 0, blocked: 1 });
  assert.equal((await client.database.getAll('outbox'))[0].state, 'rejected');
  const status = await client.engine.status();
  assert.equal(status.state, 'rejected');
  assert.equal(status.failed, 0);
  await client.engine.dispatchPending();
  assert.equal((await client.database.getAll('outbox'))[0].attemptCount, 1, 'rejected work is retained for diagnosis, not retried as a network failure');
});

test('different-field stale edits survive while same-field conflicts retain diagnostics and do not stop unrelated records', async (t) => {
  const server = new MemoryV2Server();
  const a = makeClient(server, 'fields-a');
  const b = makeClient(server, 'fields-b');
  const c = makeClient(server, 'fields-c');
  t.after(() => [a, b, c].forEach((client) => client.database.close()));

  await a.engine.commitMutation({ store: 'students', recordId: 'student-fields', op: 'create', patch: { name: 'Base', note: '' } });
  await a.engine.dispatchPending();
  await Promise.all([b.engine.pullStore('students'), c.engine.pullStore('students')]);

  await a.engine.commitMutation({ store: 'students', recordId: 'student-fields', op: 'patch', patch: { name: 'Name A' } });
  await a.engine.dispatchPending();
  await b.engine.commitMutation({ store: 'students', recordId: 'student-fields', op: 'patch', patch: { note: 'Note B' } });
  await b.engine.dispatchPending();
  assert.equal(server.table('students').get('student-fields').name, 'Name A');
  assert.equal(server.table('students').get('student-fields').note, 'Note B');

  await c.engine.commitMutation({ store: 'students', recordId: 'student-fields', op: 'patch', patch: { name: 'Name C' } });
  await c.engine.commitMutation({ store: 'students', recordId: 'student-unrelated', op: 'create', patch: { name: 'Unrelated' } });
  const result = await c.engine.dispatchPending();
  assert.equal(result.acknowledged, 2);
  assert.equal(server.table('students').get('student-unrelated').name, 'Unrelated');
  const local = await c.database.get('students', 'student-fields');
  assert.equal(local.name, 'Name A');
  assert.equal(local.note, 'Note B');
  assert.equal(local.syncConflicts.length, 1);
  assert.deepEqual(local.syncConflicts[0].groups, ['name']);
  assert.equal((await c.engine.status()).state, 'conflicted');
});

test('pull overlays pending patches and deletes, then converges to an authoritative tombstone', async (t) => {
  const server = new MemoryV2Server();
  const a = makeClient(server, 'overlay-a');
  const b = makeClient(server, 'overlay-b');
  t.after(() => [a, b].forEach((client) => client.database.close()));

  await a.engine.commitMutation({ store: 'students', recordId: 'student-overlay', op: 'create', patch: { name: 'Base', note: '' } });
  await a.engine.dispatchPending();
  await b.engine.pullStore('students');
  await b.engine.commitMutation({ store: 'students', recordId: 'student-overlay', op: 'patch', patch: { note: 'Pending B' } });
  await a.engine.commitMutation({ store: 'students', recordId: 'student-overlay', op: 'patch', patch: { name: 'Remote A' } });
  await a.engine.dispatchPending();
  await b.engine.pullStore('students');
  let local = await b.database.get('students', 'student-overlay');
  assert.equal(local.name, 'Remote A');
  assert.equal(local.note, 'Pending B');

  await b.engine.commitMutation({ store: 'students', recordId: 'student-overlay', op: 'delete' });
  await b.engine.pullStore('students');
  local = await b.database.get('students', 'student-overlay');
  assert.equal(local.deleted, true, 'a pending local delete must survive a pull');

  await a.engine.commitMutation({ store: 'students', recordId: 'student-overlay', op: 'delete' });
  await a.engine.dispatchPending();
  await b.engine.pullStore('students');
  assert.equal((await b.database.get('students', 'student-overlay')).deleted, true);
  const pushed = await b.engine.dispatchPending();
  assert.equal(pushed.acknowledged, 2);
  assert.equal((await b.database.getAll('outbox')).length, 0);
  assert.equal((await b.database.get('students', 'student-overlay')).deleted, true);
});

test('a delayed receipt cannot regress a newer authoritative pull revision', async (t) => {
  const server = new MemoryV2Server();
  let releaseReceipt;
  let receiptApplied;
  const release = new Promise((resolve) => { releaseReceipt = resolve; });
  const applied = new Promise((resolve) => { receiptApplied = resolve; });
  const delayedTransport = {
    fetchRecords: (entity) => server.fetchRecords(entity),
    async applyMutation(envelope) {
      const result = await server.applyMutation(envelope);
      receiptApplied();
      await release;
      return result;
    },
  };
  const a = makeClient(server, 'revision-a');
  const b = makeClient(server, 'revision-b', { transport: delayedTransport });
  t.after(() => [a, b].forEach((client) => client.database.close()));

  await a.engine.commitMutation({ store: 'students', recordId: 'student-revision', op: 'create', patch: { name: 'Base', note: '' } });
  await a.engine.dispatchPending();
  await b.engine.pullStore('students');
  await b.engine.commitMutation({ store: 'students', recordId: 'student-revision', op: 'patch', patch: { note: 'B note' } });
  const delayedDispatch = b.engine.dispatchPending();
  await applied;

  await a.engine.commitMutation({ store: 'students', recordId: 'student-revision', op: 'patch', patch: { name: 'A newer' } });
  await a.engine.dispatchPending();
  await b.engine.pullStore('students');
  assert.equal((await b.database.get('students', 'student-revision')).serverRevision, 3);

  releaseReceipt();
  await delayedDispatch;
  const local = await b.database.get('students', 'student-revision');
  assert.equal(local.serverRevision, 3);
  assert.equal(local.name, 'A newer');
  assert.equal(local.note, 'B note');
  assert.equal((await b.database.getAll('outbox')).length, 0);
});

test('canonical create remaps local identity and a dependent pending reference atomically', async (t) => {
  const server = new MemoryV2Server();
  const winner = makeClient(server, 'remap-winner');
  const loser = makeClient(server, 'remap-loser');
  t.after(() => [winner, loser].forEach((client) => client.database.close()));

  await winner.engine.commitMutation({ store: 'subjects', recordId: 'subject-a', op: 'create', patch: { name: 'Math', slug: 'math' } });
  await winner.engine.dispatchPending();
  const parent = await loser.engine.commitMutation({ store: 'subjects', recordId: 'subject-b', op: 'create', patch: { name: 'Math duplicate', slug: 'math' } });
  await seedAuthoritative(loser, 'sections', { id: 'section-x', yearId: 'year-x', grade: 4, label: 'A', name: '4/A', color: '#000', order: 0 });
  await seedAuthoritative(loser, 'terms', { id: 'term-x', yearId: 'year-x', index: 1, name: 'Term', startDate: null, endDate: null, status: 'active', calendarId: null });
  await loser.engine.commitMutation({
    store: 'teachings', recordId: 'teaching-b', op: 'create',
    patch: { sectionId: 'section-x', subjectId: 'subject-b', termId: 'term-x', order: 1 },
    dependencies: [{ store: 'subjects', recordId: 'subject-b', mutationId: parent.mutation.mutationId }],
  });
  const legacyOutbox = { id: 'subjects:subject-b', store: 'subjects', recordId: 'subject-b', op: 'patch', fields: ['name'] };
  await loser.database.applyBatch({ outbox: { put: [legacyOutbox], remove: [] } });

  assert.equal((await loser.engine.dispatchPending({ maxMutations: 1 })).acknowledged, 1);
  assert.equal(await loser.database.get('subjects', 'subject-b'), undefined);
  assert.equal((await loser.database.get('subjects', 'subject-a')).name, 'Math');
  assert.equal((await loser.database.get('teachings', 'teaching-b')).subjectId, 'subject-a');
  const childMutation = (await loser.database.getAll('outbox')).find((row) => row.protocol === 'v2');
  assert.equal(childMutation.localPatch.subjectId, 'subject-a');
  assert.equal(childMutation.patch.subject_id, 'subject-a');
  assert.equal(childMutation.dependencies[0].recordId, 'subject-a');
  assert.equal((await loser.database.get('subjects', 'subject-a')).syncConflicts, undefined);
  assert.deepEqual(await loser.database.get('outbox', legacyOutbox.id), legacyOutbox, 'V2 reconciliation must not convert or rewrite a V1 outbox entry');
});

test('each successful mutation is acknowledged before a later independent failure', async (t) => {
  const server = new MemoryV2Server();
  let failRecord = 'student-second';
  const transport = {
    fetchRecords: (entity) => server.fetchRecords(entity),
    applyMutation(envelope) {
      if (envelope.recordId === failRecord) throw new Error('temporary network failure');
      return server.applyMutation(envelope);
    },
  };
  const client = makeClient(server, 'ack', { transport });
  t.after(() => client.database.close());

  await client.engine.commitMutation({ store: 'students', recordId: 'student-first', op: 'create', patch: { name: 'First' } });
  await client.engine.commitMutation({ store: 'students', recordId: 'student-second', op: 'create', patch: { name: 'Second' } });
  await client.engine.commitMutation({ store: 'students', recordId: 'student-second', op: 'patch', patch: { note: 'After create' } });
  await client.engine.commitMutation({ store: 'students', recordId: 'student-third', op: 'create', patch: { name: 'Third' } });
  const firstRun = await client.engine.dispatchPending();
  assert.deepEqual(firstRun, { attempted: 3, acknowledged: 2, failed: 1, blocked: 1 });
  assert.equal((await client.database.getAll('outbox')).length, 2);
  assert.equal(server.calls.filter((call) => call.recordId === 'student-first').length, 1);
  assert.equal(server.calls.filter((call) => call.recordId === 'student-second').length, 0, 'the later mutation must stop behind the failed create');
  assert.equal(server.table('students').get('student-third').name, 'Third', 'an unrelated record must still progress');
  failRecord = null;
  await client.engine.dispatchPending();
  assert.equal(server.calls.filter((call) => call.recordId === 'student-first').length, 1, 'the acknowledged first mutation must not replay');
  assert.equal(server.table('students').get('student-second').note, 'After create');
  assert.equal((await client.database.getAll('outbox')).length, 0);
});

test('three isolated clients converge through sequential edit/pull/sync cycles', async (t) => {
  const server = new MemoryV2Server();
  const a = makeClient(server, 'three-a');
  const b = makeClient(server, 'three-b');
  const c = makeClient(server, 'three-c');
  t.after(() => [a, b, c].forEach((client) => client.database.close()));

  await a.engine.commitMutation({ store: 'students', recordId: 'student-three', op: 'create', patch: { name: 'A', note: '' } });
  await a.engine.dispatchPending();
  await b.engine.pullStore('students');
  await b.engine.commitMutation({ store: 'students', recordId: 'student-three', op: 'patch', patch: { note: 'B' } });
  await b.engine.dispatchPending();
  await c.engine.pullStore('students');
  await c.engine.commitMutation({ store: 'students', recordId: 'student-three', op: 'patch', patch: { status: 'active' } });
  await c.engine.dispatchPending();
  await Promise.all([a.engine.pullStore('students'), b.engine.pullStore('students'), c.engine.pullStore('students')]);
  for (const client of [a, b, c]) {
    const row = await client.database.get('students', 'student-three');
    assert.deepEqual({ name: row.name, note: row.note, status: row.status }, { name: 'A', note: 'B', status: 'active' });
  }
});

test('offline failure remains durable, reconnect succeeds, and score zero is distinct from null', async (t) => {
  const server = new MemoryV2Server();
  let online = false;
  const transport = {
    fetchRecords(entity) {
      if (!online) throw new Error('offline');
      return server.fetchRecords(entity);
    },
    applyMutation(envelope) {
      if (!online) throw new Error('offline');
      return server.applyMutation(envelope);
    },
  };
  const client = makeClient(server, 'offline', { transport });
  t.after(() => client.database.close());

  await seedAuthoritative(client, 'students', { id: 'student-z', name: 'Student Z', note: '', status: 'active' });
  await seedAuthoritative(client, 'items', { id: 'item-z', teachingId: 'teaching-z', name: 'Item Z', max: 10, order: 0, auto: null, perPoint: 1, penalty: 1, unitId: null, lessonId: null });
  await client.engine.commitMutation({ store: 'scores', recordId: 'score-zero', op: 'create', patch: { studentId: 'student-z', itemId: 'item-z', value: 0 } });
  assert.equal((await client.engine.dispatchPending()).failed, 1);
  assert.equal((await client.engine.status()).state, 'error');
  assert.equal((await client.database.get('scores', 'score-zero')).value, 0);

  online = true;
  assert.equal((await client.engine.dispatchPending()).acknowledged, 1);
  assert.equal(server.table('scores').get('score-zero').value, 0);
  await client.engine.commitMutation({ store: 'scores', recordId: 'score-zero', op: 'patch', patch: { value: null } });
  await client.engine.dispatchPending();
  assert.equal(server.table('scores').get('score-zero').value, null);
  await client.engine.pullStore('scores');
  assert.equal((await client.database.get('scores', 'score-zero')).value, null);
  assert.equal((await client.engine.status()).state, 'synced');
});

test('SESSION-AUTO V2 session shells canonicalize across devices, survive offline reconnect, and never resurrect after delete', async (t) => {
  const server = new MemoryV2Server();
  const a = makeClient(server, 'session-a');
  const b = makeClient(server, 'session-b');
  let online = false;
  const c = makeClient(server, 'session-offline', {
    transport: {
      fetchRecords(entity) {
        if (!online) throw new Error('offline');
        return server.fetchRecords(entity);
      },
      applyMutation(envelope) {
        if (!online) throw new Error('offline');
        return server.applyMutation(envelope);
      },
    },
  });
  t.after(() => [a, b, c].forEach((client) => client.database.close()));

  const teaching = { id: 'teaching-session', sectionId: 'section-session', subjectId: 'subject-session', termId: 'term-session', order: 0 };
  for (const client of [a, b, c]) await seedAuthoritative(client, 'teachings', teaching);
  const shell = { teachingId: teaching.id, date: '2026-09-06', period: 1, startTime: '07:00', endTime: '07:45', status: 'scheduled' };

  await a.engine.commitMutation({ store: 'sessions', recordId: 'session-a', op: 'create', create: { id: 'session-a', ...shell } });
  await b.engine.commitMutation({ store: 'sessions', recordId: 'session-b', op: 'create', create: { id: 'session-b', ...shell } });
  await a.engine.dispatchPending();
  await b.engine.dispatchPending();
  assert.equal(server.table('sessions').size, 1, 'two devices must converge on one logical shell');
  assert.equal((await b.database.get('sessions', 'session-a')).id, 'session-a');
  assert.equal(await b.database.get('sessions', 'session-b'), undefined);

  await c.engine.commitMutation({ store: 'sessions', recordId: 'session-offline', op: 'create', create: { id: 'session-offline', ...shell, date: '2026-09-07' } });
  assert.equal((await c.engine.dispatchPending()).failed, 1);
  assert.equal((await c.database.getAll('outbox')).length, 1, 'offline shell remains durable until reconnect');
  online = true;
  assert.equal((await c.engine.dispatchPending()).acknowledged, 1);
  assert.equal((await c.database.getAll('outbox')).length, 0);
  assert.equal(server.table('sessions').get('session-offline').date, '2026-09-07');

  await a.engine.commitMutation({ store: 'sessions', recordId: 'session-a', op: 'delete' });
  await a.engine.dispatchPending();
  await b.engine.commitMutation({ store: 'sessions', recordId: 'session-a', op: 'create', create: { id: 'session-a', ...shell } });
  await b.engine.dispatchPending();
  const deleted = server.table('sessions').get('session-a');
  assert.ok(deleted.deleted_at, 'a stale auto-create cannot resurrect the deleted shell');
  assert.equal((await b.database.get('sessions', 'session-a')).deleted, true);
});

test('enrollment command receipts reconcile canonical IDs and rewrite pending typed enrollment references', async (t) => {
  const receipts = new Map();
  const calls = [];
  const transport = {
    async applyEnrollmentCommand(envelope) {
      calls.push(clone(envelope));
      if (receipts.has(envelope.mutationId)) return clone(receipts.get(envelope.mutationId));
      const result = {
        mutationId: envelope.mutationId,
        command: envelope.command,
        outcome: 'applied',
        canonicalEnrollmentId: 'enrollment-canonical-y',
        enrollments: [
          { id: 'enrollment-x', student_id: 'student-enrollment', section_id: 'section-x', roll_no: 1, start_date: '2026-08-01', end_date: '2026-09-01', status: 'transferred', transfer_note: '', revision: 2, deleted_at: null },
          { id: 'enrollment-canonical-y', student_id: 'student-enrollment', section_id: 'section-y', roll_no: 1, start_date: '2026-09-01', end_date: null, status: 'active', transfer_note: '', revision: 2, deleted_at: null },
        ],
      };
      receipts.set(envelope.mutationId, result);
      return clone(result);
    },
    fetchRecords: async () => [],
  };
  const client = makeClient(null, 'enrollment-command', { transport });
  t.after(() => client.database.close());

  await seedAuthoritative(client, 'students', { id: 'student-enrollment', name: 'Student', note: '', status: 'active' });
  await seedAuthoritative(client, 'sections', { id: 'section-y', yearId: 'year-y', grade: 4, label: 'Y', name: '4/Y', color: '#000', order: 0 });
  await seedAuthoritative(client, 'enrollments', { id: 'enrollment-x', studentId: 'student-enrollment', sectionId: 'section-x', rollNo: 1, startDate: '2026-08-01', endDate: null, status: 'active', transferNote: '' });
  await client.engine.queueEnrollmentCommand({
    command: 'transfer', studentId: 'student-enrollment', sourceEnrollmentId: 'enrollment-x',
    destinationEnrollmentId: 'enrollment-local-y', destinationSectionId: 'section-y', date: '2026-09-01',
  });
  await client.engine.queueEnrollmentCommand({
    command: 'transfer', studentId: 'student-enrollment', sourceEnrollmentId: 'enrollment-local-y',
    destinationEnrollmentId: 'enrollment-local-z', destinationSectionId: 'section-y', date: '2026-09-02',
  });

  const first = await client.engine.dispatchPending({ maxMutations: 1 });
  assert.equal(first.acknowledged, 1);
  assert.equal((await client.database.get('enrollments', 'enrollment-local-y')), undefined);
  assert.equal((await client.database.get('enrollments', 'enrollment-canonical-y')).status, 'active');
  const pending = (await client.database.getAll('outbox')).find((row) => row.command === 'enrollment:transfer');
  assert.equal(pending.patch.sourceEnrollmentId, 'enrollment-canonical-y');
  assert.equal(calls.length, 1);
});

test('attendance commands wait for canonical parents, then reconcile the atomic snapshot receipt', async (t) => {
  const calls = [];
  const transport = {
    async applyAttendanceCommand(envelope) {
      calls.push(clone(envelope));
      return {
        mutationId: envelope.mutationId,
        outcome: 'applied', appliedGroups: ['status'], conflictedGroups: [],
        snapshot: {
          id: `srs:${envelope.sessionId}`, session_id: envelope.sessionId, teaching_id: 'teaching-attendance',
          section_id: 'section-attendance', captured_at: '2026-09-06T07:00:00Z',
          members: [{ studentId: envelope.studentId, rollNo: 1 }], state: 'complete', revision: 1, deleted_at: null,
        },
        attendance: {
          id: envelope.attendanceId, student_id: envelope.studentId, session_id: envelope.sessionId,
          teaching_id: 'teaching-attendance', date: '2026-09-06', status: envelope.patch.status,
          note: envelope.patch.note ?? '', revision: 1, deleted_at: null,
        },
      };
    },
    async applyMutation(envelope) {
      return { mutationId: envelope.mutationId, entity: envelope.entity, recordId: envelope.recordId, canonicalId: envelope.recordId, outcome: 'applied', appliedGroups: Object.keys(envelope.patch), conflictedGroups: [], resultRevision: 1, canonical: { id: envelope.recordId, ...envelope.patch, revision: 1, deleted_at: null } };
    },
    fetchRecords: async () => [],
  };
  const client = makeClient(null, 'attendance-command', { transport });
  t.after(() => client.database.close());
  await client.engine.queueAttendanceCommand({
    attendanceId: 'attendance-local', sessionId: 'session-attendance', studentId: 'student-attendance', patch: { status: 'present' },
  });
  await client.engine.commitMutation({ store: 'subjects', recordId: 'subject-unrelated', op: 'create', patch: { name: 'Unrelated', slug: 'unrelated' } });
  const blocked = await client.engine.dispatchPending();
  assert.equal(blocked.acknowledged, 1);
  assert.equal(blocked.blocked, 1);
  assert.equal((await client.engine.status()).state, 'blocked');

  await seedAuthoritative(client, 'students', { id: 'student-attendance', name: 'Student', note: '', status: 'active' });
  await seedAuthoritative(client, 'sessions', { id: 'session-attendance', teachingId: 'teaching-attendance', date: '2026-09-06', period: 1, status: 'scheduled' });
  const recovered = await client.engine.dispatchPending();
  assert.equal(recovered.acknowledged, 1);
  assert.equal(calls.length, 1);
  assert.equal((await client.database.get('attendance', 'attendance-local')).status, 'present');
  assert.equal((await client.database.get('sessionRosterSnapshots', 'srs:session-attendance')).members[0].studentId, 'student-attendance');
  assert.equal((await client.engine.status()).state, 'synced');
});

test('bulk attendance reconciliation replaces stale rows from both applied and skipped canonical receipt entries', async (t) => {
  const calls = [];
  const transport = {
    async applyFillAttendanceCommand(envelope) {
      calls.push(clone(envelope));
      return {
        mutationId: envelope.mutationId, outcome: 'applied',
        snapshot: { id: `srs:${envelope.sessionId}`, session_id: envelope.sessionId, teaching_id: 'teaching-fill', section_id: 'section-fill', captured_at: '2026-09-06T07:00:00Z', members: [{ studentId: 'student-fill-a', rollNo: 1 }, { studentId: 'student-fill-b', rollNo: 2 }], state: 'complete', revision: 4, deleted_at: null },
        applied: [{ id: 'attendance-fill-a', session_id: envelope.sessionId, student_id: 'student-fill-a', teaching_id: 'teaching-fill', date: '2026-09-06', status: 'present', note: '', revision: 6, field_revisions: { status: 6 }, deleted_at: null }],
        skipped: [{ id: 'attendance-fill-b', session_id: envelope.sessionId, student_id: 'student-fill-b', teaching_id: 'teaching-fill', date: '2026-09-06', status: 'absent', note: 'canonical', revision: 9, field_revisions: { status: 9, note: 8 }, bulkDisposition: 'skipped', deleted_at: null }],
      };
    },
    fetchRecords: async () => [],
  };
  const client = makeClient(null, 'fill-command', { transport });
  t.after(() => client.database.close());
  await seedAuthoritative(client, 'students', { id: 'student-fill-a', name: 'A', note: '', status: 'active' });
  await seedAuthoritative(client, 'students', { id: 'student-fill-b', name: 'B', note: '', status: 'active' });
  await seedAuthoritative(client, 'sessions', { id: 'session-fill', teachingId: 'teaching-fill', date: '2026-09-06', period: 1, status: 'scheduled' });
  await seedAuthoritative(client, 'attendance', { id: 'attendance-fill-b', sessionId: 'session-fill', studentId: 'student-fill-b', teachingId: 'teaching-fill', date: '2026-09-06', status: 'present', note: 'stale optimistic' });
  await client.engine.queueFillAttendanceCommand({ sessionId: 'session-fill', status: 'present', studentIds: ['student-fill-a', 'student-fill-b'] });
  const result = await client.engine.dispatchPending();
  assert.equal(result.acknowledged, 1);
  assert.equal(calls.length, 1);
  assert.equal((await client.database.get('attendance', 'attendance-fill-a')).status, 'present');
  const skipped = await client.database.get('attendance', 'attendance-fill-b');
  assert.deepEqual({ status: skipped.status, note: skipped.note, serverRevision: skipped.serverRevision, fieldRevisions: skipped.fieldRevisions }, { status: 'absent', note: 'canonical', serverRevision: 9, fieldRevisions: { status: 9, note: 8 } });
  assert.equal(skipped.bulkDisposition.outcome, 'skipped');
  assert.equal((await client.database.getAll('outbox')).length, 0);
});
