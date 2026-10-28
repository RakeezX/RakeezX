/** AI-authored actual integrated-handler tests, fabricated ports only. No UI PASS. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createIntegratedService } from '../../drafts/n88-student-portal/integrated-service.mjs';
import { createMemoryRepository } from '../../drafts/n88-student-portal/memory-repository.mjs';
import { CANONICAL_PROJECTION_REQUIREMENTS } from '../../drafts/n88-student-portal/student-projection.mjs';
import { publicationCommand, reconcilePublication } from '../../src/lib/n88-item-publication-proposal.js';
import { fixture as legacyFixture } from '../n88-terminal-negative-20261028/fixture.mjs';

const scope = { ownerId: 'owner', teachingId: 'teaching', sectionId: 'section', termId: 'term', subjectId: 'subject' };
const binding = { sessionId: 'session', leaseId: 'local-echo-only', contextRevision: 'local-context' };
const privateFlags = { required: false, scheduled: false, completed: false, grade: false };
const ID = 'original_intent_00001';
const copy = v => structuredClone(v);
function fixture(n = 1, config = {}) {
  const row = (id, more = {}) => ({ id, ownerId: scope.ownerId, deleted: false, deletedAt: null, revision: '1', ...more });
  const c = Object.fromEntries(CANONICAL_PROJECTION_REQUIREMENTS.tables.map(t => [t, []]));
  c.years = [row('year', { status: 'active' })];
  c.terms = [row('term', { status: 'active', yearId: 'year', startDate: '2026-08-01', endDate: '2027-06-01' })];
  c.sections = [row('section', { status: 'active', yearId: 'year', name: 'Fabricated', grade: 4 })];
  c.teachings = [row('teaching', { sectionId: 'section', termId: 'term', subjectId: 'subject' })];
  c.students = Array.from({ length: n }, (_, i) => row('pupil' + i, { name: 'Fabricated ' + i, status: 'active' }));
  c.enrollments = c.students.map(s => row('enrollment-' + s.id, { studentId: s.id, sectionId: 'section', status: 'active', startDate: null, endDate: null }));
  c.items = [row('parent', { teachingId: 'teaching', name: 'Distribution', scoreMode: 'subitems', max: 10, order: 0 }),
    row('direct', { teachingId: 'teaching', name: 'Direct', scoreMode: 'direct', max: 10, order: 1 })];
  c.scoreSubitems = ['a', 'b'].map((id, i) => row(id, { itemId: 'parent', name: 'Task ' + id, value: 5, latePoints: 2,
    startDate: i ? null : '2026-10-20', dueDate: i ? null : '2026-10-30', order: i }));
  c.scoreSubitemCompletions = c.students.flatMap(s => c.scoreSubitems.map(d => row(s.id + d.id, {
    studentId: s.id, subitemId: d.id, checked: true, completionState: d.id === 'a' ? 'late' : 'regular' })));
  c.scores = c.students.flatMap((s, i) => [row(s.id + '-parent', { studentId: s.id, itemId: 'parent', value: 7, manualValue: null }),
    row(s.id + '-direct', { studentId: s.id, itemId: 'direct', value: i % 10 })]);
  const memory = createMemoryRepository({ scopes: [], receipts: [] });
  const state = { canonical: c, current: true, sessionId: binding.sessionId, ingress: true, rollback: false, lost: false, race: null, reads: 0, authCalls: 0 };
  const auth = { current: true, ownerId: scope.ownerId, sessionId: binding.sessionId };
  const ports = {
    transaction: action => memory.transaction(async draft => {
      const guards = [];
      const result = await action({ state: draft, beforeCommit: guard => guards.push(guard) });
      if (state.race) { const change = state.race; state.race = null; change(); }
      for (const guard of guards) await guard();
      if (state.rollback) { state.rollback = false; throw Error('synthetic rollback'); }
      return result;
    }).then(result => { if (state.lost) { state.lost = false; throw Error('synthetic lost ACK after COMMIT'); } return result; }),
    authenticate: async (request, _tx, role) => {
      state.authCalls++;
      if (!state.ingress || request.headers.authorization !== 'synthetic-token') return null;
      return { ...auth, current: state.current, sessionId: state.sessionId,
        ...(role === 'student' ? { scope: copy(scope), studentId: request.headers['synthetic-pupil'] ?? 'pupil0', enrollmentId: 'enrollment-' + (request.headers['synthetic-pupil'] ?? 'pupil0') } : {}) };
    },
    readCurrent: async () => { state.reads++; return { canonical: copy(state.canonical), now: '2026-10-28' }; },
  };
  const options = { origin: 'https://synthetic.invalid', executionMode: 'synthetic', publicationV2Enabled: true, publicationV2: ports,
    numericKey: Buffer.alloc(32, 1), reservationKey: Buffer.alloc(32, 2), recoveryKeys: new Map([['v1', Buffer.alloc(32, 3)]]), recoveryActiveKeyVersion: 'v1', ...config };
  const service = createIntegratedService(options, { verifyIngress: async () => null }, memory);
  const headers = { origin: options.origin, 'x-n88-csrf': '1', 'sec-fetch-site': 'same-origin', 'content-type': 'application/json', authorization: 'synthetic-token' };
  const request = (body, extra = {}) => service({ path: '/teacher/class/publication-v2', method: 'POST', headers: { ...headers, ...extra.headers }, body,
    ...Object.fromEntries(Object.entries(extra).filter(([k]) => k !== 'headers')) });
  const list = async () => { const r = await request({ action: 'list', scope: copy(scope), binding: copy(binding) }); assert.equal(r.status, 200); return r.body; };
  const command = (listed, row, decisions = { ...privateFlags, grade: true }, id = ID) => publicationCommand({
    draft: { scope: copy(scope), rows: [{ ...row, decisions }] }, scope, rowId: row.id, requestId: id,
    expectedPublicationRevision: row.publicationRevision, expectedMembershipRevision: listed.membershipRevision, binding });
  return { state, options, auth, ports, service, request, list, command, snapshot: memory.snapshot, mutate: fn => memory.transaction(fn),
    student: (i = 0) => service({ path: '/student/publication-v2/read', method: 'GET', headers: { ...headers, 'synthetic-pupil': 'pupil' + i } }) };
}
const applied = result => { assert.equal(result.status, 200); assert.equal(result.body.receipt.state, 'applied'); };
const rejected = result => { assert.equal(result.status, 200); assert.equal(result.body.receipt.state, 'rejected'); };
const rowOf = (list, source) => list.rows.find(r => r.sourceId === source);

for (const n of [0, 1, 30, 50]) {
  test(`actual handler fresh canonical IDs/dates, independent pupil privacy (${n})`, async () => {
    const f = fixture(n), listed = await f.list();
    assert.equal(listed.rows.length, 3); assert.equal(listed.inactive, true);
    assert(listed.rows.every(r => Object.values(r.decisions).every(v => !v)));
    assert.equal(rowOf(listed, 'a').startDate, '2026-10-20'); assert.equal(rowOf(listed, 'a').dueDate, '2026-10-30');
    assert.equal(rowOf(listed, 'b').dueDate, null); assert(!rowOf(listed, 'parent'));
    // Work-only child a, grade-only child b and direct item. Parent aggregate 7
    // must not appear when child's individual grade 2 remains hidden.
    applied(await f.request(f.command(listed, rowOf(listed, 'a'), { ...privateFlags, completed: true }, 'work_intent_00001')));
    applied(await f.request(f.command(listed, rowOf(listed, 'b'), { ...privateFlags, grade: true }, 'grade_intent_00001')));
    applied(await f.request(f.command(listed, rowOf(listed, 'direct'), { ...privateFlags, grade: true }, 'direct_intent_00001')));
    for (let i = 0; i < n; i++) {
      const result = await f.student(i); assert.equal(result.status, 200);
      assert.deepEqual(Object.keys(result.body).sort(), ['grades', 'work']);
      assert.deepEqual(result.body.grades.map(g => g.value), [5, i % 10]);
      assert(result.body.grades.every(g => Object.keys(g).sort().join(',') === 'id,title,value'));
      assert.equal(result.body.work.length, 1); assert.equal(result.body.work[0].title, 'Task a');
      assert.deepEqual(result.body.work[0].categories, ['completed']);
      assert(!JSON.stringify(result.body).match(/"(?:total|rank|raw|ownerId|enrollmentId|sourceRevision|manualValue|parent)":/));
    }
    assert.equal((await f.student(n)).status, 503);
  });
}

test('OFF default/server-owned synthetic switch; legacy list/issuer/negative terminal remain intact', async () => {
  for (const config of [{ publicationV2Enabled: undefined }, { publicationV2Enabled: false }, { executionMode: 'local' }, { executionMode: 'production' }]) {
    const f = fixture(1, config);
    const r = await f.request({ action: 'list', scope, binding, publicationV2Enabled: true, executionMode: 'synthetic' }, { path: '/teacher/class/publication-v2?enabled=true' });
    assert.equal(r.status, 401);
    assert.equal((await f.request({ action: 'list', scope, binding })).status, 401);
    assert.equal((await f.student()).status, 401);
    assert.equal(f.state.authCalls, 0); assert.deepEqual(f.snapshot(), { scopes: [], receipts: [] });
  }
  const legacy = legacyFixture(1), original = await legacy.input();
  assert.equal((await legacy.terminal(original)).body.data.state, 'closed');
  assert.equal((await legacy.request('issue-missing', original)).status, 409);
  assert.equal(legacy.snapshot().numericCredentials.length, 0);
});

test('receipt immutability, reordered bytes, concurrent CAS and owner-scoped original request', async () => {
  const f = fixture(), listed = await f.list(), command = f.command(listed, rowOf(listed, 'a'));
  const [a, b] = await Promise.all([f.request(command), f.request({ ...command, requestId: 'racing_intent_00002' })]);
  applied(a); rejected(b); assert.equal(f.snapshot().receipts.length, 2);
  const reordered = Object.fromEntries(Object.entries(command).reverse());
  assert.deepEqual((await f.request(reordered)).body.receipt, a.body.receipt);
  assert.equal((await f.request({ ...command, decisions: privateFlags })).status, 503);
  const later = await f.list(), next = f.command(later, rowOf(later, 'a'), privateFlags, 'withhold_intent_00002');
  applied(await f.request(next));
  const status = await f.request({ action: 'status', scope, binding, command });
  assert.deepEqual(status.body.receipt, a.body.receipt);
  assert.equal(status.body.fresh.publicationRevision, 2);
  assert.equal(reconcilePublication(command, scope, status.body.receipt, status.body.fresh, binding).state, 'unknown');
  assert.equal((await f.request({ action: 'status', scope, binding, command: { ...command, requestId: 'never_sent_intent_01' } })).status, 503);
  const originalReceipts = f.snapshot().receipts;
  f.auth.ownerId = 'other'; assert.equal((await f.request(command)).status, 503);
  assert.deepEqual(f.snapshot().receipts, originalReceipts);
});

test('lost ACK stays UNKNOWN; original status can confirm; rollback never gets receipt', async () => {
  const f = fixture(), listed = await f.list(), command = f.command(listed, rowOf(listed, 'a'));
  f.state.lost = true;
  assert.deepEqual((await f.request(command)).body, { state: 'unknown', retry: false });
  assert.equal(f.snapshot().receipts.length, 1);
  const found = await f.request({ action: 'status', scope, binding, command });
  assert.deepEqual(reconcilePublication(command, scope, found.body.receipt, found.body.fresh, binding), { state: 'confirmed', retry: false, publicationRevision: 1 });
  const g = fixture(), l = await g.list(), cmd = g.command(l, rowOf(l, 'a'));
  g.state.rollback = true; assert.equal((await g.request(cmd)).status, 503);
  assert.equal(g.snapshot().receipts.length, 0);
  assert.equal((await g.request({ action: 'status', scope, binding, command: cmd })).status, 503);
  assert.equal(g.snapshot().receipts.length, 0);
});

test('source rename/date/value/score revisions revoke choices; additions OFF and deletion permanent', async () => {
  for (const mutate of [c => { c.scoreSubitems[0].name = 'Renamed'; }, c => { c.scoreSubitems[0].dueDate = '2026-11-01'; },
    c => { c.scoreSubitems[0].value = 6; }, c => { c.scoreSubitemCompletions[0].completionState = 'regular'; },
    c => { c.scoreSubitemCompletions[0].revision = '2'; }, c => { c.items[0].revision = '2'; }]) {
    const f = fixture(), l = await f.list(), command = f.command(l, rowOf(l, 'a'));
    applied(await f.request(command)); mutate(f.state.canonical);
    const fresh = await f.list(); assert.equal(rowOf(fresh, 'a').decisions.grade, false);
    assert.equal(rowOf(fresh, 'a').publicationRevision, 2); assert.equal(rowOf(fresh, 'direct').publicationRevision, 0);
    assert.deepEqual((await f.student()).body.grades, []);
    const status = await f.request({ action: 'status', scope, binding, command }); assert.equal(status.body.fresh, null);
    assert.equal(status.body.receipt.state, 'applied');
  }
  const f = fixture(), l = await f.list(); applied(await f.request(f.command(l, rowOf(l, 'a'))));
  f.state.canonical.scoreSubitems[0].deleted = true; f.state.canonical.scoreSubitems[0].revision = '2';
  assert(!rowOf(await f.list(), 'a'));
  f.state.canonical.scoreSubitems[0].deleted = false; f.state.canonical.scoreSubitems[0].revision = '3';
  assert(!rowOf(await f.list(), 'a'));
  assert(f.snapshot().scopes[0].publications.find(p => p.rowId === rowOf(l, 'a').id).tombstone);
  const added = { ...f.state.canonical.scoreSubitems[0], id: 'new-source' }; f.state.canonical.scoreSubitems.push(added);
  const next = rowOf(await f.list(), 'new-source'); assert(next); assert.deepEqual(next.decisions, privateFlags);
  f.state.canonical.scoreSubitems[0].revision = '1'; assert.equal((await f.student()).status, 503);
});

test('actual COMMIT fences current session, term, section, source, membership and score races', async () => {
  const races = [f => { f.state.current = false; }, f => { f.state.sessionId = 'new-session'; },
    f => { f.state.canonical.terms[0].status = 'closed'; }, f => { f.state.canonical.teachings[0].sectionId = 'other'; },
    f => { f.state.canonical.teachings[0].subjectId = 'other'; }, f => { f.state.canonical.teachings[0].termId = 'other'; },
    f => { f.state.canonical.enrollments[0].endDate = '2026-10-28'; }, f => { f.state.canonical.students[0].status = 'archived'; },
    f => { f.state.canonical.scoreSubitems[0].deleted = true; }, f => { f.state.canonical.scores[0].value = 8; }];
  for (const race of races) {
    const f = fixture(), l = await f.list(), cmd = f.command(l, rowOf(l, 'a')), before = f.snapshot();
    f.state.race = () => race(f);
    assert.equal((await f.request(cmd)).status, 503); assert.deepEqual(f.snapshot(), before);
  }
  const f = fixture(), l = await f.list(), cmd = f.command(l, rowOf(l, 'a'));
  applied(await f.request(cmd)); f.state.canonical.enrollments[0].revision = '2';
  assert.deepEqual((await f.student()).body.grades, []);
});

test('teacher/student entry rejects untrusted scope, legacy flags, auth/CSRF and stale echo reconciliation', async () => {
  const changes = [c => { c.scope.ownerId = 'other'; }, c => { c.scope.teachingId = 'other'; }, c => { c.scope.sectionId = 'other'; },
    c => { c.scope.termId = 'other'; }, c => { c.scope.subjectId = 'other'; }, c => { c.binding.sessionId = 'other'; },
    c => { c.binding.extra = 'unsafe'; }, c => { c.fields = { grades: true }; }, c => { c.decisions.extra = true; }, c => { c.version = 1; }];
  for (const mutate of changes) {
    const f = fixture(), l = await f.list(), cmd = f.command(l, rowOf(l, 'a')); mutate(cmd);
    assert.equal((await f.request(cmd)).status, 503); assert.equal(f.snapshot().receipts.length, 0);
  }
  for (const headers of [{ authorization: 'forged' }, { origin: 'https://other.invalid' }, { 'x-n88-csrf': '0' }, { 'sec-fetch-site': 'cross-site' }]) {
    const f = fixture(), l = await f.list(), cmd = f.command(l, rowOf(l, 'a'));
    assert.notEqual((await f.request(cmd, { headers })).status, 200); assert.equal(f.snapshot().receipts.length, 0);
  }
  const f = fixture(), l = await f.list(), cmd = f.command(l, rowOf(l, 'a'));
  applied(await f.request(cmd));
  for (const field of ['leaseId', 'contextRevision']) {
    assert.equal((await f.request({ action: 'status', scope, binding: { ...binding, [field]: 'new-echo' }, command: cmd })).status, 503);
  }
  f.auth.ownerId = 'other'; assert.equal((await f.student()).status, 503);
});

test('manual teacher text/link/date normalization, CAS edit/delete and immutable tombstone', async () => {
  const f = fixture();
  const manualTask = { id: 'manual_1', title: '<img src=x onerror=alert(1)>', description: '<script>teacher text only</script>',
    startDate: '٢٠٢٦-١٠-٢٨', dueDate: '2026-10-30', link: 'https://example.invalid/lesson?x=1' };
  const preview = await f.request({ action: 'manual-preview', scope, binding, manualTask }); assert.equal(preview.status, 200);
  const row = preview.body.row;
  assert.equal(row.startDate, '2026-10-28'); assert.equal(row.title, manualTask.title);
  let cmd = f.command(preview.body, row, { ...privateFlags, required: true });
  applied(await f.request(cmd));
  let out = await f.student(); assert.equal(out.body.work[0].description, manualTask.description); assert.equal(out.body.grades.length, 0);
  const changed = { ...manualTask, title: 'Changed title', startDate: '2026-10-28', link: 'https://example.invalid/exam' };
  const p2 = await f.request({ action: 'manual-preview', scope, binding, manualTask: changed });
  cmd = f.command(p2.body, p2.body.row, { ...privateFlags, required: true }, 'manual_edit_intent_02');
  applied(await f.request(cmd));
  assert.equal((await f.student()).body.work[0].title, 'Changed title');
  const listed = await f.list(), saved = rowOf(listed, 'manual_1');
  const deletion = { ...f.command(listed, saved, privateFlags, 'manual_delete_intent_03'), action: 'item-publication-delete', manualTask: null };
  applied(await f.request(deletion)); assert.deepEqual((await f.student()).body.work, []);
  const p3 = await f.request({ action: 'manual-preview', scope, binding, manualTask: changed });
  assert.equal(p3.body.row.tombstone, true);
  rejected(await f.request(f.command(p3.body, p3.body.row, { ...privateFlags, required: true }, 'manual_resurrect_0004')));
});

test('server rejects unsafe URLs/limits/dates and manual grade disclosure without any fetch', async () => {
  const manual = { id: 'm', title: 'Task', description: '', startDate: null, dueDate: null, link: null };
  const bad = ['javascript:alert(1)', 'data:text/html,x', 'http://example.invalid', 'file:///x', '/relative', 'https://u:p@example.invalid',
    'https://@example.invalid', 'https://example.invalid/%0a', 'https://example.invalid/has space', 'https://example.invalid/\\x', 'https://example.invalid/' + 'x'.repeat(2048)];
  for (const link of bad) {
    const f = fixture(); const r = await f.request({ action: 'manual-preview', scope, binding, manualTask: { ...manual, link } });
    assert.equal(r.status, 503); assert.equal(f.snapshot().receipts.length, 0);
  }
  for (const extra of [{ title: 'x'.repeat(201) }, { description: 'x'.repeat(2001) }, { startDate: '2026-02-30' },
    { startDate: '2026-07-31' }, { dueDate: '2028-01-01' }, { startDate: '2026-10-30', dueDate: '2026-10-29' }, { extra: 'field' }]) {
    const f = fixture(); assert.equal((await f.request({ action: 'manual-preview', scope, binding, manualTask: { ...manual, ...extra } })).status, 503);
  }
  const f = fixture(), preview = await f.request({ action: 'manual-preview', scope, binding, manualTask: manual });
  const command = f.command(preview.body, preview.body.row, privateFlags); command.decisions.grade = true;
  rejected(await f.request(command));
});

test('no live storage/provider capability and no frontend/SW activation added', async () => {
  const source = await readFile(new URL('../../drafts/n88-student-portal/publication-v2-service.inactive.mjs', import.meta.url), 'utf8');
  assert(!source.match(/fetch\(|process\.env|\.query\(|localStorage|window\./));
  assert(source.includes("executionMode !== 'synthetic'"));
  // This assertion is scope evidence only; behavioral gates above exercise the handler.
});

test('direct score VALUE drift revokes only that row; fresh explicit intent shows own new score', async () => {
  const f = fixture(2), l = await f.list();
  applied(await f.request(f.command(l, rowOf(l, 'direct'))));
  f.state.canonical.scores.find(s => s.itemId === 'direct' && s.studentId === 'pupil0').value = 9;
  assert.deepEqual((await f.student()).body.grades, []);
  const next = await f.list(); assert.equal(rowOf(next, 'direct').publicationRevision, 2);
  assert.equal(rowOf(next, 'a').publicationRevision, 0);
  applied(await f.request(f.command(next, rowOf(next, 'direct'), { ...privateFlags, grade: true }, 'fresh_score_intent_02')));
  assert.equal((await f.student()).body.grades[0].value, 9);
  assert.equal((await f.student(1)).body.grades[0].value, 1);
});

test('membership removal/addition requires fresh choice; foreign/ambiguous/missing canonical families deny', async () => {
  const f = fixture(2), l = await f.list(); applied(await f.request(f.command(l, rowOf(l, 'a'))));
  f.state.canonical.enrollments[1].endDate = '2026-10-28';
  assert.deepEqual((await f.student()).body.grades, []); assert.equal((await f.student(1)).status, 503);
  const next = await f.list(); applied(await f.request(f.command(next, rowOf(next, 'a'), { ...privateFlags, grade: true }, 'new_roster_intent_02')));
  assert.equal((await f.student()).body.grades[0].value, 2);
  f.state.canonical.enrollments[1].endDate = null; f.state.canonical.enrollments[1].revision = '2';
  assert.deepEqual((await f.student(1)).body.grades, []);
  const malformed = [c => { delete c.logs; }, c => { c.students[0].ownerId = 'other'; },
    c => { c.enrollments.push({ ...c.enrollments[0], id: 'duplicate-current' }); },
    c => { c.scoreSubitems.push(copy(c.scoreSubitems[0])); }, c => { c.items[0].revision = 0; },
    c => { c.terms[0].startDate = '2027-01-01'; }, c => { c.sections[0].status = 'archived'; }];
  for (const change of malformed) {
    const g = fixture(); change(g.state.canonical);
    assert.equal((await g.request({ action: 'list', scope, binding })).status, 503);
    assert.equal((await g.student()).status, 503); assert.equal(g.snapshot().receipts.length, 0);
  }
});

test('legacy/malformed publication and receipt records cannot disclose or confirm', async () => {
  const f = fixture(), l = await f.list(), cmd = f.command(l, rowOf(l, 'a')); applied(await f.request(cmd));
  await f.mutate(db => { db.scopes[0].publications[0].decisions = { grades: true }; });
  assert.equal((await f.student()).status, 503);
  const g = fixture(), listed = await g.list(), command = g.command(listed, rowOf(listed, 'a')); applied(await g.request(command));
  await g.mutate(db => { db.receipts[0].receipt.state = 'legacy-committed'; });
  assert.equal((await g.request({ action: 'status', scope, binding, command })).status, 503);
});
