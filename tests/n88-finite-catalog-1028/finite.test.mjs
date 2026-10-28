/** AI: NEW affected catalogue unit/contract proof only; no database/network/UI. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { publicationV2FiniteCatalog as catalog, publicationV2FiniteCatalogSha256 as identity,
  createInactivePublicationV2FiniteCatalog as createCatalog } from '../../drafts/n88-student-portal/publication-v2-finite-catalog.inactive.mjs';
import { createPublicationV2PostgresPorts } from '../../drafts/n88-student-portal/publication-v2-postgres.inactive.mjs';
import { assertVerifiedBoundary, privateQuery, boundaryCatalogSql } from '../../drafts/n88-student-portal/activation/private-error-boundary.mjs';

const owner = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', foreign = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const session = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', credentialId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const h = 'e'.repeat(64), stamp = 'f'.repeat(64), now = Date.parse('2026-10-28T12:00:00Z');
const stable = v => Array.isArray(v) ? v.map(stable) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, stable(v[k])])) : v;
const json = v => JSON.stringify(stable(v));
const sha = v => createHash('sha256').update(v).digest('hex');
const scope = { ownerId: owner, teachingId: 'teaching', sectionId: 'section', termId: 'term', subjectId: 'subject' };
const scopeKey = sha(json(scope));
const rowId = JSON.stringify(['subitem', 'item', 'work']);
const flags = { required: false, scheduled: false, completed: false, grade: false };
const publication = { rowId, sourceRevision: h, publicationRevision: 0, membershipRevision: stamp, decisions: flags, tombstone: false };
const receipt = { version: 2, scope, binding: { sessionId: session, leaseId: 'echo-only', contextRevision: 'context' }, requestId: 'request_000000001',
  rowId, sourceRevision: h, state: 'applied', publicationRevision: 1 };
const root = { scope, manualTasks: [] };
const teacher = { ownerId: owner, sessionId: session, role: 'teacher', expiresAt: now + 10000, numeric: null, storageWrite: true };
const student = { ...teacher, role: 'student', storageWrite: false,
  numeric: { tokenHash: h, credentialId, studentId: 'pupil', version: '1' } };
const numeric = { id: session, credentialId, ownerId: owner, studentId: 'pupil', classId: 'section', enrollmentId: 'enrollment',
  membershipRevision: '1', canonicalStamp: stamp, version: 1, tokenHash: h, expiresAt: now + 5000, revokedAt: null };
const credential = { id: credentialId, ownerId: owner, studentId: 'pupil', version: 1, reservation: stamp, verifier: h, keyVersion: 'v1', revokedAt: null };
const select = rows => ({ command: 'SELECT', rowCount: rows.length, rows });
const effect = op => ({ command: op.startsWith('insert-') ? 'INSERT' : 'UPDATE', rowCount: 1, rows: [] });
const args = {
  'owner-context': [owner], 'numeric-session': [h], 'numeric-credential': [credentialId, owner, 'pupil', '1'],
  ...Object.fromEntries(['scopes', 'items', 'high_water', 'receipts'].map(k => [`read-${k}`, [owner, 10001, 2097152, 4194304]])),
  'insert-scope': [owner, scopeKey, json(root)], 'cas-scope': [owner, scopeKey, json(root), '1'],
  'insert-item': [owner, scopeKey, rowId, '0', false, json(publication)],
  'cas-item': [owner, scopeKey, rowId, '1', false, json({ ...publication, publicationRevision: 1 }), '0', json(publication)],
  'insert-high-water': [owner, scopeKey, 'items:item', '1', false],
  'cas-high-water': [owner, scopeKey, 'items:item', '2', false, '1', false],
  'insert-receipt': [owner, receipt.requestId, scopeKey, h, json(receipt)],
};
const bodies = {
  'read-scopes': { scope_key: scopeKey, store_revision: '1', payload: root },
  'read-items': { scope_key: scopeKey, row_id: rowId, publication_revision: '0', tombstone: false, payload: publication },
  'read-high_water': { scope_key: scopeKey, source_key: 'items:item', canonical_revision: '1', retired: false },
  'read-receipts': { request_id: receipt.requestId, scope_key: scopeKey, fingerprint: h, payload: receipt },
};
const output = op => op === 'owner-context' ? select([{ namespace: 'N'.repeat(24), owner_id: owner, active: true }]) :
  op === 'numeric-session' ? select([{ payload: numeric }]) : op === 'numeric-credential' ? select([{ payload: credential }]) :
  op.startsWith('read-') ? select([{ body: JSON.stringify(bodies[op]) }]) : effect(op);
const opBySql = new Map(catalog.map(o => [o.sql, o]));
function fixture({ context = teacher, execute, verify, clock = () => now, budgetMs = 5000, maxOperations } = {}) {
  const calls = [];
  const api = createCatalog({ executionMode: 'synthetic', now: clock, budgetMs, maxOperations,
    verifyAdmission: verify ?? (() => structuredClone(context)),
    executeFixed: async (sql, a, signal) => { const op = opBySql.get(sql); assert.ok(op); calls.push({ op: op.id, args: a, signal });
      return execute ? execute(op.id, a, signal) : structuredClone(output(op.id)); },
  });
  const request = {};
  const run = async (id, values = args[id]) => api.execute(request, await api.prepare(request, { operation: id, args: values }));
  return { api, request, run, calls };
}
const unavailable = { message: 'n88_v2_catalog_unavailable' };
const prime = f => f.run('read-scopes');

test('14 unique immutable identities match the EXACT published SQL, no extra dispatch forms', () => {
  assert.equal(catalog.length, 14); assert.equal(opBySql.size, 14); assert.ok(Object.isFrozen(catalog));
  assert.equal(identity, sha(json(catalog)));
  const canonical = readFileSync(new URL('../../drafts/n88-student-portal/publication-v2-canonical.inactive.mjs', import.meta.url), 'utf8');
  const storage = readFileSync(new URL('../../drafts/n88-student-portal/publication-v2-postgres.inactive.mjs', import.meta.url), 'utf8');
  for (const op of catalog) {
    assert.ok(Object.isFrozen(op.parameters)); assert.equal(op.sha256, sha(op.sql));
    if (op.id.startsWith('read-')) {
      const table = op.id.slice(5), expected = {
        scopes: ['scope_key,store_revision::text as store_revision,payload', 'scope_key'],
        items: ['scope_key,row_id,publication_revision::text as publication_revision,tombstone,payload', 'scope_key,row_id'],
        high_water: ['scope_key,source_key,canonical_revision::text as canonical_revision,retired', 'scope_key,source_key'],
        receipts: ['request_id,scope_key,fingerprint,payload', 'request_id'],
      }[table];
      assert.ok(storage.includes(`'publication_v2_${table}', '${expected[0]}', '${expected[1]}'`));
      const template = /`select case when octet_length\(body\)[^`]+`/.exec(storage)?.[0].slice(1, -1);
      assert.equal(op.sql, template.replace('${cols}', expected[0]).replace('${table}', `publication_v2_${table}`).replace('${order}', expected[1]));
    } else assert.ok((op.id.includes('numeric') || op.id === 'owner-context' ? canonical : storage).includes(`'${op.sql}'`));
  }
  assert.equal(catalog[0].sha256, 'f8a1689cd78951d7fc52ef91eb51423510f98cbf717a42c162572b2c69bf692b');
  assert.equal(catalog[1].sha256, '7874a827dae2373223bc8adc67a2a30d158ed7e1e40183e72a8cff2c1df55a90');
  assert.equal(catalog[2].sha256, '6d27c8049efec0665b9d1f91f20f631f036ebb8403a3301bcc211176a6d1c751');
});

test('all fourteen fixed operations execute with detached typed inputs/results', async () => {
  for (const op of catalog) {
    const f = fixture({ context: op.id.startsWith('numeric-') ? student : teacher });
    if (op.effect && !op.id.endsWith('scope') || op.id.startsWith('read-') && op.id !== 'read-scopes') await prime(f);
    const result = await f.run(op.id); assert.deepEqual(result, output(op.id));
    assert.equal(f.calls.at(-1).op, op.id); assert.deepEqual(f.calls.at(-1).args, args[op.id]);
    assert.notEqual(f.calls.at(-1).args, args[op.id]);
  }
});

test('numeric bootstrap is lookup-only, bound to actual returned tuple; original Auth is still required for storage', async () => {
  const locator = { ownerId: null, sessionId: null, role: 'locator', expiresAt: now + 10000, storageWrite: false,
    numeric: { tokenHash: h, credentialId: null, studentId: null, version: null } };
  let context = locator;
  const f = fixture({ verify: () => context });
  await f.run('numeric-session'); await f.run('numeric-credential'); await f.run('owner-context');
  // This transition is the TRUSTED original handler's admission result, NOT a
  // catalogue inference. New tests fake that port; prior native Auth proof reused.
  context = student; await f.run('read-scopes');
  assert.deepEqual(f.calls.map(c => c.op), ['numeric-session', 'numeric-credential', 'owner-context', 'read-scopes']);
  const denied = fixture({ context: locator }); await denied.run('numeric-session');
  await assert.rejects(denied.run('read-scopes'), unavailable); assert.equal(denied.calls.length, 1);
  const early = fixture({ context: locator }); await assert.rejects(early.run('owner-context'), unavailable); assert.equal(early.calls.length, 0);
  const wrong = fixture({ context: locator }); await wrong.run('numeric-session');
  await assert.rejects(wrong.run('numeric-credential', [credentialId, owner, 'other-pupil', '1']), unavailable); assert.equal(wrong.calls.length, 1);
  let switched = locator;
  const mismatch = fixture({ verify: () => switched }); await mismatch.run('numeric-session');
  switched = { ...student, ownerId: foreign }; await assert.rejects(mismatch.run('read-scopes'), unavailable); assert.equal(mismatch.calls.length, 1);
});

test('published durable adapter generates all four reads and seven flush forms through executable catalogue', async () => {
  const db = { scopes: [], items: [], high_water: [], receipts: [] }, seen = new Set();
  const repository = { async transaction(action) {
    const f = fixture({ execute: (op, a) => {
      seen.add(op);
      if (op.startsWith('read-')) return select(db[op.slice(5)].map(r => ({ body: JSON.stringify(r) })));
      const table = op.endsWith('scope') ? 'scopes' : op.endsWith('item') ? 'items' : op.endsWith('high-water') ? 'high_water' : 'receipts';
      const r = table === 'scopes' ? { scope_key: a[1], store_revision: String(op.startsWith('insert-') ? 1 : Number(db.scopes[0].store_revision) + 1), payload: JSON.parse(a[2]) } :
        table === 'items' ? { scope_key: a[1], row_id: a[2], publication_revision: a[3], tombstone: a[4], payload: JSON.parse(a[5]) } :
        table === 'high_water' ? { scope_key: a[1], source_key: a[2], canonical_revision: a[3], retired: a[4] } :
        { request_id: a[1], scope_key: a[2], fingerprint: a[3], payload: JSON.parse(a[4]) };
      if (op.startsWith('insert-')) db[table].push(r); else db[table][0] = r;
      return effect(op);
    } });
    const guards = [];
    try {
      const value = await action({}, { query: async (sql, values) => {
        const id = opBySql.get(sql)?.id; assert.ok(id, 'published SQL must be exact'); return f.run(id, values);
      }, beforeCommit: fn => guards.push(fn), canonicalReadMode: () => 'serial' });
      for (const guard of guards) await guard(); return value;
    } finally { f.api.close(f.request); }
  } };
  const ports = createPublicationV2PostgresPorts({ executionMode: 'synthetic', repository, authenticate: () => teacher });
  await ports.transaction(async tx => {
    await tx.bindOwner(owner);
    tx.state.scopes.push({ scope, manualTasks: [], publications: [structuredClone(publication)], sourceVersions: [{ key: 'items:item', revision: '1', retired: false }] });
    tx.state.receipts.push({ ownerId: owner, requestId: receipt.requestId, fingerprint: h, receipt });
  });
  await ports.transaction(async tx => {
    await tx.bindOwner(owner); const s = tx.state.scopes[0];
    Object.assign(s.publications[0], { publicationRevision: 1, tombstone: true });
    Object.assign(s.sourceVersions[0], { revision: '2', retired: true });
  });
  assert.equal(seen.size, 11); assert.deepEqual([...seen].sort(), catalog.slice(3).map(o => o.id).sort());
  assert.equal(db.items[0].tombstone, true); assert.deepEqual(db.receipts[0].payload, receipt);
});

test('SQL/function/table/role selection, altered SQL and extra fields never reach executor', async () => {
  for (const operation of ['drop table public.students', catalog[0].sql, 'select pg_sleep(1)', 'commit', 'set role postgres', 'delete-receipt', 'retire-source']) {
    const f = fixture(); await assert.rejects(f.run(operation, []), unavailable); assert.equal(f.calls.length, 0);
  }
  for (const extra of [{ sql: catalog[0].sql }, { table: 'students' }, { role: 'postgres' }, { function: 'anything' }]) {
    const f = fixture(); await assert.rejects(f.api.prepare(f.request, { operation: 'owner-context', args: [owner], ...extra }), unavailable); assert.equal(f.calls.length, 0);
  }
});

test('foreign owner, malformed types, missing/extra parameters and overflow limits deny before dispatch', async () => {
  for (const op of catalog) {
    for (const values of [[], [...args[op.id], 'extra'], args[op.id].map((v, i) => i === 0 ? foreign : v)]) {
      const f = fixture({ context: op.id.startsWith('numeric-') ? student : teacher });
      await assert.rejects(f.run(op.id, values), unavailable); assert.equal(f.calls.length, 0);
    }
  }
  for (const a of [[owner, '10001', 2097152, 4194304], [owner, 10000, 2097152, 4194304], [owner, 10001, 2097153, 4194304],
    [owner, 10001, 2097152, 0], [owner, 10001, 2097152, 4194305], [owner, 10001, 2097152, NaN]]) {
    const f = fixture(); await assert.rejects(f.run('read-scopes', a), unavailable); assert.equal(f.calls.length, 0);
  }
  const f = fixture({ context: student });
  await assert.rejects(f.run('numeric-credential', [credentialId, owner, 'someone-else', '1']), unavailable);
});

test('every argument position rejects objects/coercion; queued parameters are detached from caller mutations', async () => {
  for (const op of catalog) for (let i = 0; i < args[op.id].length; i++) {
    const a = structuredClone(args[op.id]); a[i] = { value: a[i] };
    const f = fixture({ context: op.id.startsWith('numeric-') ? student : teacher });
    await assert.rejects(f.run(op.id, a), unavailable); assert.equal(f.calls.length, 0);
  }
  const f = fixture(), a = [owner];
  const ticket = await f.api.prepare(f.request, { operation: 'owner-context', args: a }); a[0] = foreign;
  await f.api.execute(f.request, ticket); assert.deepEqual(f.calls[0].args, [owner]);
  const b = fixture(), extra = [owner]; extra.sql = 'drop table';
  await assert.rejects(b.run('owner-context', extra), unavailable); assert.equal(b.calls.length, 0);
});

test('malformed or stale admission and false storage grant fail closed without auth replacement', async () => {
  for (const c of [{ ...teacher, ownerId: 'bad' }, { ...teacher, expiresAt: now }, { ...teacher, role: 'admin' }, { ...teacher, extra: true },
    { ...student, numeric: { ...student.numeric, version: '01' } }, null]) {
    const f = fixture({ context: c }); await assert.rejects(f.run('owner-context'), unavailable); assert.equal(f.calls.length, 0);
  }
  const f = fixture({ context: student }); await assert.rejects(f.run('insert-scope'), unavailable); assert.equal(f.calls.length, 0);
});

test('wrong request, spent ticket, duplicate write and post-close capabilities cannot execute/replay', async () => {
  const f = fixture(), ticket = await f.api.prepare(f.request, { operation: 'owner-context', args: [owner] });
  await assert.rejects(f.api.execute({}, ticket), unavailable); await assert.rejects(f.api.execute(f.request, ticket), unavailable); assert.equal(f.calls.length, 0);
  const g = fixture(), t = await g.api.prepare(g.request, { operation: 'owner-context', args: [owner] });
  await g.api.execute(g.request, t); await assert.rejects(g.api.execute(g.request, t), unavailable); assert.equal(g.calls.length, 1);
  const w = fixture(); await w.run('insert-scope'); await assert.rejects(w.run('insert-scope'), unavailable); assert.equal(w.calls.length, 1);
  const q = fixture(), tq = await q.api.prepare(q.request, { operation: 'owner-context', args: [owner] });
  q.api.close(q.request); await assert.rejects(q.api.execute(q.request, tq), unavailable); assert.equal(q.calls.length, 0);
});

test('fresh session/owner/permission revalidation before and after execution rejects drift', async () => {
  for (const changeAt of [2, 3]) {
    let verifications = 0;
    const f = fixture({ verify: () => ++verifications >= changeAt ? { ...teacher, sessionId: 'new-session' } : teacher });
    const t = await f.api.prepare(f.request, { operation: 'owner-context', args: [owner] });
    await assert.rejects(f.api.execute(f.request, t), unavailable); assert.equal(f.calls.length, changeAt === 2 ? 0 : 1);
    await assert.rejects(f.run('owner-context'), unavailable); // no automatic retry
  }
});

test('bounded budget, hung verifier/execute, late result and operation cap poison without retry', async () => {
  let release, signal;
  const f = fixture({ budgetMs: 20, clock: Date.now, context: { ...teacher, expiresAt: Date.now() + 10000 },
    execute: (_op, _a, s) => { signal = s; return new Promise(resolve => { release = resolve; }); } });
  const t = await f.api.prepare(f.request, { operation: 'owner-context', args: [owner] });
  await assert.rejects(f.api.execute(f.request, t), unavailable); assert.equal(signal.aborted, true);
  release(output('owner-context')); await assert.rejects(f.api.execute(f.request, t), unavailable); assert.equal(f.calls.length, 1);
  const v = fixture({ budgetMs: 10, verify: () => new Promise(() => {}) }); await assert.rejects(v.run('owner-context'), unavailable); assert.equal(v.calls.length, 0);
  const n = fixture({ maxOperations: 1 }); await n.run('owner-context'); await assert.rejects(n.run('owner-context'), unavailable); assert.equal(n.calls.length, 1);
});

test('immutable receipt/session binding, CAS revision, tombstone and high-water regressions reject', async () => {
  const invalid = [
    ['insert-receipt', [owner, receipt.requestId, scopeKey, h, json({ ...receipt, binding: { ...receipt.binding, sessionId: 'foreign-session' } })]],
    ['insert-receipt', [owner, receipt.requestId, scopeKey, h, json({ ...receipt, scope: { ...scope, ownerId: foreign } })]],
    ['cas-item', [...args['cas-item'].slice(0, 7), json({ ...publication, tombstone: true })]],
    ['cas-item', [owner, scopeKey, rowId, '0', false, json(publication), '0', json(publication)]],
    ['cas-high-water', [owner, scopeKey, 'items:item', '1', false, '2', false]],
    ['cas-high-water', [owner, scopeKey, 'items:item', '2', false, '1', true]],
    ['insert-high-water', [owner, scopeKey, 'items:item', '9223372036854775808', false]],
    ['insert-item', [owner, scopeKey, rowId, '0', false, json({ ...publication, total: 100 })]],
    ['insert-scope', [owner, scopeKey, '{"scope":null,"scope":null,"manualTasks":[]}']],
  ];
  for (const [op, a] of invalid) { const f = fixture(); await assert.rejects(f.run(op, a), unavailable); assert.equal(f.calls.length, 0); }
});

test('central manual-task date/link validators are reused; no link fetch/send', async () => {
  const task = { id: 'manual1', title: 'شرح', description: '', startDate: '2026-10-28', dueDate: '2026-10-29', link: 'https://example.test/lesson' };
  const f = fixture(); await f.run('insert-scope', [owner, scopeKey, json({ scope, manualTasks: [task] })]);
  for (const m of [{ ...task, link: 'javascript:alert(1)' }, { ...task, link: 'https://user:pass@example.test/' }, { ...task, dueDate: '2026-10-27' },
    { ...task, link: 'https://example.test/' + 'a'.repeat(2048) }, { ...task, extra: true }]) {
    const bad = fixture(); await assert.rejects(bad.run('insert-scope', [owner, scopeKey, json({ scope, manualTasks: [m] })]), unavailable); assert.equal(bad.calls.length, 0);
  }
});

test('strict result shapes, foreign numeric records, hidden aggregates, unknown scopes and row/byte overflow reject', async () => {
  const cases = [
    ['owner-context', { ...output('owner-context'), extra: true }],
    ['owner-context', select([{ namespace: 'N'.repeat(24), owner_id: foreign, active: true }])],
    ['owner-context', { command: 'SELECT', rowCount: 2, rows: [] }],
    ['owner-context', select(Array.from({ length: 2 }, () => output('owner-context').rows[0]))],
    ['numeric-session', select([{ payload: { ...numeric, ownerId: foreign } }])],
    ['numeric-session', select([{ payload: { ...numeric, id: credentialId } }])],
    ['numeric-credential', select([{ payload: { ...credential, verifier: 'plaintext' } }])],
    ['read-scopes', select([{ body: JSON.stringify({ ...bodies['read-scopes'], payload: { ...root, scope: { ...scope, ownerId: foreign } } }) }])],
    ['read-items', select([{ body: JSON.stringify({ ...bodies['read-items'], payload: { ...publication, hiddenGrade: 99, total: 100 } }) }])],
    ['read-high_water', select([{ body: JSON.stringify({ ...bodies['read-high_water'], scope_key: stamp }) }])],
    ['read-receipts', select([{ body: null }])],
    ['read-scopes', select(Array.from({ length: 10001 }, () => ({ body: '{}' })))],
    ['read-scopes', select([{ body: ' '.repeat(2097153) }])],
    ['insert-scope', { command: 'INSERT', rowCount: 0, rows: [] }],
    ['cas-scope', { command: 'UPDATE', rowCount: 2, rows: [] }],
    ['insert-scope', { command: 'INSERT', rowCount: 1, rows: [{ secret: 'not-returning' }] }],
  ];
  for (const [op, result] of cases) {
    const f = fixture({ context: op.startsWith('numeric-') ? student : teacher,
      execute: id => id === op ? result : output(id) });
    if (op.startsWith('read-') && op !== 'read-scopes') await prime(f);
    await assert.rejects(f.run(op), unavailable); await assert.rejects(f.run('owner-context'), unavailable);
  }
});

test('aggregate transfer budget denies excess even for individually valid bounded payloads', async () => {
  const bigRoot = { scope, manualTasks: Array.from({ length: 800 }, (_, i) => ({ id: `m${i}`, title: 'task', description: 'a'.repeat(2000), startDate: null, dueDate: null, link: null })) };
  const result = select([{ body: JSON.stringify({ ...bodies['read-scopes'], payload: bigRoot }) }]);
  const f = fixture({ execute: () => result });
  await f.run('read-scopes'); await f.run('read-scopes');
  await assert.rejects(f.run('read-scopes'), unavailable); assert.equal(f.calls.length, 3);
  const b = fixture({ execute: () => result });
  await assert.rejects(b.run('read-scopes', [owner, 10001, 2097152, 1000]), unavailable);
});

test('factory stays OFF, original hosted boundary/source identities unchanged; no route/import activation', () => {
  for (const executionMode of [undefined, 'local', 'production', 'live']) assert.throws(() => createCatalog({ executionMode, verifyAdmission: () => teacher, executeFixed: () => {} }), unavailable);
  const pinned = {
    'activation/private-error-boundary.mjs': '58ae1bb5f128cf31998ed8ccfa8e372e4980fdbfcc611f8aef61e9dc3098d49e',
    'publication-v2-canonical.inactive.mjs': '69d502ed38d5fbfd32f5a2114b44d42156f7eae295f1ba408dc9285e4ae0440b',
    'publication-v2-postgres.inactive.mjs': '0b38130ae2ecf097d72b92722d5157621f6dfa932b80b6079889c22b7edc32e0',
    'publication-v2-storage.inactive.sql': '399f6d5f513bf0fd3bb3bb9f8a206018e451ed9d6cc5d9a9b7fa89b3a81525c0',
    'integrated-service.mjs': '6348d080dc6364d8741be4699afe0f8e71954e3ff6ae4dfb4a1b3c0532caaf64',
  };
  for (const [path, hash] of Object.entries(pinned)) assert.equal(sha(readFileSync(new URL(`../../drafts/n88-student-portal/${path}`, import.meta.url))), hash, path);
  const source = readFileSync(new URL('../../drafts/n88-student-portal/publication-v2-finite-catalog.inactive.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /process\.env|privateQuery|fetch\(|from ['"].*private-error-boundary|\.listen\(/);
});

test('original executable finite boundary still rejects every V2 SQL even on a locally verified existing catalogue', async () => {
  // In-process synthetic transport ONLY. No native/hosted client or credentials.
  const oldIdentities = JSON.parse(readFileSync(new URL('../../drafts/n88-student-portal/activation/error-boundary-identities.json', import.meta.url), 'utf8'));
  const calls = [];
  const client = { query(sql) { calls.push(sql); assert.equal(sql, boundaryCatalogSql); return { rows: oldIdentities }; } };
  await assertVerifiedBoundary(client);
  for (const op of catalog) await assert.rejects(privateQuery(client, op.sql, args[op.id]), { message: 'n88_database_unavailable' });
  assert.deepEqual(calls, [boundaryCatalogSql]); // no V2 SQL forwarded
});
