/** AI: actual service/canonical/storage/catalogue composition, fabricated ports.
 * No HTTP, database, provider client, persisted keys, accounts or UI claim. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createInactivePublicationV2FiniteBridge as bridge } from '../../drafts/n88-student-portal/publication-v2-finite-bridge.inactive.mjs';
import { publicationV2FiniteCatalog as catalog, publicationV2FiniteCatalogSha256 as identity } from '../../drafts/n88-student-portal/publication-v2-finite-catalog.inactive.mjs';
import { CANONICAL_PROJECTION_REQUIREMENTS } from '../../drafts/n88-student-portal/student-projection.mjs';
import { createRolloutGuard } from '../../drafts/n88-student-portal/rollout-guard.mjs';
import { publicationCommand } from '../../src/lib/n88-item-publication-proposal.js';
import { providerFixture, A, B, SESSION, authUrl } from '../fixtures/n88-existing-host/provider.mjs';

const origin = 'https://synthetic.invalid', copy = v => structuredClone(v);
const hash = v => createHash('sha256').update(v).digest('hex');
const scope = { ownerId: A, teachingId: 'teaching', sectionId: 'section', termId: 'term', subjectId: 'subject' };
const binding = { sessionId: SESSION, leaseId: 'echo-only', contextRevision: 'context-only' };
const flags = { required: false, scheduled: false, completed: false, grade: false };
const select = rows => ({ command: 'SELECT', rowCount: rows.length, rows });
const snake = r => Object.fromEntries(Object.entries(r).filter(([k]) => k !== 'deleted').map(([k, v]) => [k.replace(/[A-Z]/g, c => '_' + c.toLowerCase()), v]));

function fixture(options = {}) {
  const provider = providerFixture(); // Existing fabricated in-memory Auth helper; no real keys or I/O.
  const row = (id, more = {}) => ({ id, ownerId: A, revision: '1', deleted: false, deletedAt: null, ...more });
  const c = Object.fromEntries(CANONICAL_PROJECTION_REQUIREMENTS.tables.map(t => [t, []]));
  c.years = [row('year', { status: 'active' })];
  c.terms = [row('term', { yearId: 'year', status: 'active', startDate: '2026-08-01', endDate: '2027-06-01' })];
  c.sections = [row('section', { yearId: 'year', status: 'active', name: 'Fabricated' })];
  c.teachings = [row('teaching', { sectionId: 'section', termId: 'term', subjectId: 'subject' })];
  c.items = [row('direct', { teachingId: 'teaching', name: 'Direct', max: 10, scoreMode: 'direct', order: 0 })];
  if (options.student) {
    c.students = [row('pupil0', { name: 'Fabricated', status: 'active' })];
    c.enrollments = [row('enrollment', { studentId: 'pupil0', sectionId: 'section', status: 'active', endDate: null })];
    c.scores = [row('score', { studentId: 'pupil0', itemId: 'direct', value: 4 })];
  }
  const control = { calls: [], oldCalls: [], transactions: 0, commits: 0, rollbacks: 0, admission: null, stale: null, lost: false, malformed: null, ingress: true };
  const numericToken = 's'.repeat(43), credentialId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  control.numericSession = { id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', credentialId, ownerId: A, studentId: 'pupil0',
    classId: 'section', enrollmentId: 'enrollment', membershipRevision: 1,
    canonicalStamp: hash(JSON.stringify(['n88-lineage-v1', '1', '1', '1', '1'])), version: 1,
    tokenHash: hash(numericToken), expiresAt: Date.now() + 60000, revokedAt: null };
  control.numericCredential = { id: credentialId, ownerId: A, studentId: 'pupil0', version: 1, format: 'six-v1',
    reservation: 'a'.repeat(64), verifier: 'b'.repeat(64), keyVersion: 'v1', revokedAt: null };
  let stores = { scopes: [], items: [], high_water: [], receipts: [] };
  const repository = { async transaction(action) {
    control.transactions++;
    const draft = copy(stores), guards = [];
    const ports = {
      canonicalReadMode: () => 'serial', beforeCommit: fn => guards.push(fn),
      query: async (sql, args) => {
        control.oldCalls.push(sql);
        assert(!catalog.some(op => op.sql === sql), 'V2 cannot leak to old finite port');
        assert.deepEqual(args[0], sql.includes('any($1::uuid[])') ? [A] : A);
        if (sql.includes('lock_current_session')) return select([{ user_id: A, session_id: SESSION }]);
        if (sql.includes('lock_projection_sources') || sql.includes('lock_canonical_sources')) return select([]);
        if (sql.includes('from rakeezx.enrollments e join')) return select([{ payload: JSON.stringify({ owner_id: A,
          enrollment_id: 'enrollment', section_id: 'section', student_id: 'pupil0', revision: '1', status: 'active', end_date: null,
          enrollment_present: true, student_active: true, class_active: true, label: 'Fabricated', student_revision: '1', section_revision: '1', year_revision: '1' }) }]);
        if (sql.includes('from rakeezx.items i join')) return select([]); // No legacy publication needed for own-profile admission.
        const table = /from rakeezx\.([a-z_]+) where/.exec(sql)?.[1];
        assert(table, 'only actual bounded canonical reader SQL');
        const name = table.replace(/_([a-z])/g, (_, v) => v.toUpperCase());
        return select(c[name].map(r => ({ payload: JSON.stringify(snake(r)) })));
      },
      executePublicationV2: async (sql, args, signal) => {
        const op = catalog.find(op => op.sql === sql); assert(op); assert(signal instanceof AbortSignal);
        control.calls.push({ id: op.id, args: copy(args) });
        if (op.id === 'numeric-session') return select([{ payload: copy(control.numericSession) }]);
        if (op.id === 'numeric-credential') return select([{ payload: copy(control.numericCredential) }]);
        if (control.malformed === op.id) return select([{ body: ' '.repeat(2097153) }]);
        if (op.id === 'owner-context') return select([{ namespace: 'N'.repeat(24), owner_id: A, active: true }]);
        if (op.id.startsWith('read-')) return select(draft[op.id.slice(5)].map(r => ({ body: JSON.stringify(r) })));
        const table = op.id.endsWith('scope') ? 'scopes' : op.id.endsWith('item') ? 'items' : op.id.endsWith('high-water') ? 'high_water' : 'receipts';
        const rows = draft[table];
        const prior = rows.find(r => r.scope_key === args[1] && (table === 'scopes' || table === 'items' && r.row_id === args[2] || table === 'high_water' && r.source_key === args[2]));
        const value = table === 'scopes' ? { scope_key: args[1], store_revision: String(Number(prior?.store_revision ?? 0) + 1), payload: JSON.parse(args[2]) } :
          table === 'items' ? { scope_key: args[1], row_id: args[2], publication_revision: args[3], tombstone: args[4], payload: JSON.parse(args[5]) } :
          table === 'high_water' ? { scope_key: args[1], source_key: args[2], canonical_revision: args[3], retired: args[4] } :
          { request_id: args[1], scope_key: args[2], fingerprint: args[3], payload: JSON.parse(args[4]) };
        const cas = op.id.startsWith('cas-');
        const matches = !cas || prior && (table === 'scopes' ? prior.store_revision === args[3] : table === 'items' ?
          prior.publication_revision === args[6] && JSON.stringify(prior.payload) === JSON.stringify(JSON.parse(args[7])) : prior.canonical_revision === args[5] && prior.retired === args[6]);
        if (control.stale === op.id || !matches) return { command: 'UPDATE', rowCount: 0, rows: [] };
        if (cas) Object.assign(prior, value); else rows.push(value);
        return { command: cas ? 'UPDATE' : 'INSERT', rowCount: 1, rows: [] };
      },
    };
    if (options.absentPort) delete ports.executePublicationV2;
    try {
      const result = await action({}, ports);
      if (options.replayAction) await action({}, ports);
      if (control.race) await control.race();
      for (const guard of guards) await guard();
      stores = draft; control.commits++;
      if (control.lost) throw Error('fabricated_lost_ACK');
      return result;
    } catch (e) { control.rollbacks++; throw e; }
  } };
  const rollout = createRolloutGuard(k => ({ N88_ROLLOUT_MODE: 'pilot', N88_PILOT_BINDING: JSON.stringify({ ownerId: A,
    classId: 'section', teachingId: 'teaching', studentIds: ['pupil0', 'pupil1'] }) })[k]);
  const canonical = { rollout, studentTeachingId: 'teaching', teacher: { authUrl, apiKey: 'FABRICATED_PUBLIC_KEY', fetch: provider.fetch },
    numeric: { keys: new Map([['v1', Buffer.alloc(32, 1)]]), activeKeyVersion: 'v1', reservationKey: Buffer.alloc(32, 2) },
    verifyIngress: () => control.ingress ? { clientKey: 'synthetic-ingress' } : null };
  const token = provider.token({}, 'HS256');
  const service = bridge({ enabled: true, executionMode: 'synthetic', origin, catalogSha256: identity, repository, canonical,
    verifyAdmission: async (r, _ports, signal) => {
      assert(!signal.aborted);
      if (control.admissionHook) await control.admissionHook(r);
      if (r.method === 'GET') {
        const s = control.numericSession;
        // Trusted fixture is independently bound to the exact original session tuple;
        // the actual original numeric READ guard must still authenticate it.
        return { ownerId: A, sessionId: s.id, role: 'student', expiresAt: s.expiresAt, storageWrite: true,
          numeric: { tokenHash: hash(numericToken), credentialId, studentId: 'pupil0', version: '1' } };
      }
      assert.equal(r.headers.authorization, 'Bearer ' + token);
      return control.admission ?? { ownerId: A, sessionId: SESSION, role: 'teacher', expiresAt: Date.now() + 60000, numeric: null, storageWrite: true };
    }, ...options.bridge });
  // Admission expiry is fixed for a request, as required by the catalogue identity.
  control.admission = { ownerId: A, sessionId: SESSION, role: 'teacher', expiresAt: Date.now() + 60000, numeric: null, storageWrite: true };
  const request = (body, extra = {}) => service({ path: '/teacher/class/publication-v2', method: 'POST',
    headers: { origin, 'x-n88-csrf': '1', 'content-type': 'application/json', authorization: 'Bearer ' + token }, body: copy(body), ...extra });
  const listBody = { action: 'list', scope, binding };
  const list = () => request(listBody);
  const command = (l, requestId = 'bridge_intent_000001') => publicationCommand({ draft: { scope, rows: [{ ...l.body.rows[0], decisions: { ...flags, grade: true } }] },
    scope, binding, rowId: l.body.rows[0].id, requestId, expectedPublicationRevision: l.body.rows[0].publicationRevision, expectedMembershipRevision: l.body.membershipRevision });
  return { service, control, provider, c, request, list, listBody, command, snapshot: () => copy(stores),
    student: () => service({ path: '/student/publication-v2/read', method: 'GET', headers: { origin, 'x-n88-csrf': '1', cookie: '__Secure-n88-student=' + numericToken } }) };
}
const unknown = r => { assert.equal(r.status, 503); assert.deepEqual(r.body, { state: 'unknown', retry: false }); };

test('default OFF and every non-synthetic mode deny without constructing dependencies', async () => {
  for (const options of [{}, { executionMode: 'synthetic' }, ...['local', 'production', 'live', undefined].map(executionMode => ({ executionMode, enabled: true }))]) {
    const handler = bridge(options); assert.equal((await handler({})).status, 401);
  }
  assert.throws(() => bridge({ enabled: true, executionMode: 'synthetic', catalogSha256: 'wrong' }), /bridge_unavailable/);
});

test('actual canonical/Auth/service/storage/catalogue handler lists OFF, writes and reads immutable receipts', async () => {
  const f = fixture(), l = await f.list(); assert.equal(l.status, 200); assert.equal(l.body.inactive, true);
  assert.deepEqual(l.body.rows[0].decisions, flags);
  const cmd = f.command(l), result = await f.request(cmd); assert.equal(result.status, 200); assert.equal(result.body.receipt.state, 'applied');
  const saved = f.snapshot(), repeats = await f.request(cmd); assert.deepEqual(repeats.body.receipt, result.body.receipt);
  assert.deepEqual(f.snapshot(), saved);
  const changed = await f.request({ ...cmd, decisions: flags }); unknown(changed); assert.deepEqual(f.snapshot(), saved);
  const next = f.command(await f.list(), 'bridge_intent_000002'); next.decisions = flags;
  assert.equal((await f.request(next)).body.receipt.state, 'applied');
  const status = await f.request({ action: 'status', scope, binding, command: cmd });
  assert.deepEqual(status.body.receipt, result.body.receipt); assert.equal(status.body.fresh.publicationRevision, 2);
  assert(f.control.calls.some(c => c.id === 'cas-item')); assert(f.control.calls.some(c => c.id === 'insert-receipt'));
  assert(f.control.oldCalls.some(sql => sql.includes('lock_current_session')));
  assert(f.control.oldCalls.some(sql => sql.includes('from rakeezx.logs')));
});

test('unauthorized owner/session, stale expiry, missing ingress and altered source fail closed with no effects', async () => {
  for (const change of [f => { f.control.admission.ownerId = B; }, f => { f.control.admission.sessionId = 'other'; },
    f => { f.control.admission.expiresAt = 0; }, f => { f.control.ingress = false; }, f => { f.provider.denied = true; },
    f => { f.c.teachings[0].subjectId = 'foreign'; }, f => { f.c.items[0].ownerId = B; }]) {
    const f = fixture(); change(f); unknown(await f.list());
    assert(!f.control.calls.some(c => /^(insert|cas)-/.test(c.id))); assert.equal(f.snapshot().scopes.length, 0);
  }
  const f = fixture(); unknown(await f.request({ ...f.listBody, binding: { ...binding, sessionId: 'wrong' } }));
  assert(!f.control.calls.some(c => c.id.startsWith('insert-')));
});

test('missing named synthetic execution port never falls back to old hosted port', async () => {
  const f = fixture({ absentPort: true }); unknown(await f.list());
  assert.equal(f.control.calls.length, 0); assert.equal(f.control.oldCalls.length, 0); assert.equal(f.control.commits, 0);
});

test('actual original numeric READ accepts the bounded canonical wire codec; revoked/foreign/unknown fields deny', async () => {
  const f = fixture({ student: true }), l = await f.list();
  assert.equal((await f.request(f.command(l))).body.receipt.state, 'applied');
  const result = await f.student(); assert.equal(result.status, 200);
  assert.deepEqual(result.body.work, []); assert.deepEqual(result.body.grades.map(g => g.value), [4]);
  assert.deepEqual(Object.keys(result.body).sort(), ['grades', 'work']);
  assert(f.control.calls.some(c => c.id === 'numeric-session')); assert(f.control.calls.some(c => c.id === 'numeric-credential'));
  assert.equal(typeof f.control.numericSession.membershipRevision, 'number'); assert.equal(f.control.numericCredential.format, 'six-v1');
  for (const change of [g => { g.control.numericSession.revokedAt = Date.now(); },
    g => { g.control.numericSession.ownerId = B; }, g => { g.control.numericSession.membershipRevision = Number.MAX_SAFE_INTEGER + 1; },
    g => { g.control.numericSession.membershipRevision = '1'; }, g => { g.control.numericSession.extra = 'hidden'; },
    g => { g.control.numericCredential.format = 'future-format'; }, g => { g.control.numericCredential.extra = 'hidden'; },
    g => { g.control.numericCredential.revokedAt = Date.now(); }]) {
    const g = fixture({ student: true }); change(g); unknown(await g.student()); assert.equal(g.control.commits, 0);
  }
});

test('all exact 14 operations pass through the bridge from original adapters, without caller SQL', async () => {
  const f = fixture({ student: true }), l = await f.list();
  assert.equal((await f.request(f.command(l))).body.receipt.state, 'applied');
  f.c.items[0].revision = '2'; assert.equal((await f.list()).status, 200);
  assert.equal((await f.student()).status, 200);
  assert.deepEqual([...new Set(f.control.calls.map(c => c.id))].sort(), catalog.map(op => op.id).sort());
  const before = f.snapshot();
  unknown(await f.request({ ...f.listBody, sql: 'delete from anything', operation: 'caller-choice' }));
  assert.deepEqual(f.snapshot(), before);
});

test('overlapping requests cannot swap admission/request capabilities or replay transaction callbacks', async () => {
  const f = fixture(); let release, entered;
  const held = new Promise(resolve => { release = resolve; }), started = new Promise(resolve => { entered = resolve; });
  const seen = new Set(); let first;
  f.control.admissionHook = async r => {
    seen.add(r);
    if (r.marker === 'first') { first ??= r; assert.equal(r, first); entered(); await held; }
    else assert.equal(r.marker, 'second');
  };
  const pending = f.request(f.listBody, { marker: 'first' }); await started;
  try { assert.equal((await f.request(f.listBody, { marker: 'second' })).status, 200); }
  finally { release(); }
  assert.equal((await pending).status, 200); assert.equal(seen.size, 2);
  assert.equal(f.control.transactions, 2);
  const replay = fixture({ replayAction: true }); unknown(await replay.list());
  assert.equal(replay.control.calls.filter(c => c.id === 'owner-context').length, 1); // Replay rejects before COMMIT guards.
  assert.equal(replay.control.commits, 0); assert.equal(replay.snapshot().scopes.length, 0);
});

test('bounded output, stale storage CAS and absent storage entitlement roll back without receipt', async () => {
  const oversized = fixture(); oversized.control.malformed = 'read-scopes'; unknown(await oversized.list()); assert.equal(oversized.control.commits, 0);
  const f = fixture(), l = await f.list(), before = f.snapshot(); f.control.stale = 'cas-scope';
  unknown(await f.request(f.command(l))); assert.deepEqual(f.snapshot(), before); assert(!f.control.calls.some(c => c.id === 'insert-receipt'));
  const denied = fixture(), dl = await denied.list(); denied.control.admission.storageWrite = false;
  unknown(await denied.request(denied.command(dl))); assert.equal(denied.snapshot().receipts.length, 0);
});

test('COMMIT session/source races, lost ACK UNKNOWN and original status never replay effects', async () => {
  for (const race of [f => { f.control.admission.sessionId = 'revoked'; }, f => { f.c.items[0].name = 'Changed'; }]) {
    const f = fixture(), l = await f.list(), before = f.snapshot(); f.control.race = () => race(f);
    unknown(await f.request(f.command(l))); assert.deepEqual(f.snapshot(), before);
  }
  const f = fixture(), l = await f.list(), cmd = f.command(l); f.control.lost = true;
  unknown(await f.request(cmd)); const count = f.control.calls.filter(c => c.id === 'insert-receipt').length;
  assert.equal(count, 1); assert.equal(f.snapshot().receipts.length, 1);
  f.control.lost = false;
  const status = await f.request({ action: 'status', scope, binding, command: cmd });
  assert.equal(status.body.receipt.state, 'applied'); assert.equal(f.control.calls.filter(c => c.id === 'insert-receipt').length, count);
});

test('bridge operation budget and deadline are request-bound', async () => {
  const limited = fixture({ bridge: { maxOperations: 1 } }); unknown(await limited.list()); assert(limited.control.calls.length <= 1);
  let clock = Date.now(); const f = fixture({ bridge: { now: () => clock, budgetMs: 100 } });
  f.control.race = () => { clock += 101; }; unknown(await f.list()); assert.equal(f.control.commits, 0);
});

test('prior 17/17 source identities are unchanged; bridge has no caller SQL/network export or startup import', () => {
  const pins = {
    'publication-v2-finite-catalog.inactive.mjs': 'e9dec5fb83b1897a229e328c6b57ffd8a30ff7bf15f3c4a79bc7a98aa7f1f780',
    'publication-v2-canonical.inactive.mjs': '69d502ed38d5fbfd32f5a2114b44d42156f7eae295f1ba408dc9285e4ae0440b',
    'publication-v2-postgres.inactive.mjs': '0b38130ae2ecf097d72b92722d5157621f6dfa932b80b6079889c22b7edc32e0',
    'activation/private-error-boundary.mjs': '58ae1bb5f128cf31998ed8ccfa8e372e4980fdbfcc611f8aef61e9dc3098d49e',
  };
  for (const [file, pin] of Object.entries(pins)) assert.equal(hash(readFileSync(new URL('../../drafts/n88-student-portal/' + file, import.meta.url))), pin);
  assert.equal(hash(readFileSync(new URL('../n88-finite-catalog-1028/finite.test.mjs', import.meta.url))), 'd0fd4a954b9820ba6ead123ba8225032a62263b2b293292fac63b77eff4eb9f4');
  assert.equal(catalog.length, 14);
  const source = readFileSync(new URL('../../drafts/n88-student-portal/publication-v2-finite-bridge.inactive.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /process\.env|fetch\(|\.listen\(|privateQuery|acquire\(/);
  assert.deepEqual([...source.matchAll(/export function (\w+)/g)].map(m => m[1]), ['createInactivePublicationV2FiniteBridge']);
});
