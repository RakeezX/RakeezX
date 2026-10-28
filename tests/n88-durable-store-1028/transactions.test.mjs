/** AI: executable adapter + actual SQL in embedded PostgreSQL/PGlite 0.5.8.
 * ONE engine, ONE connection. JS acquisition queue is NOT independent PG proof.
 * No TCP, hosted credentials, browser, native process, account or provider calls.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { createPublicationV2PostgresPorts, createPublicationV2PostgresRepository } from '../../drafts/n88-student-portal/publication-v2-postgres.inactive.mjs';
import { createPublicationV2Service } from '../../drafts/n88-student-portal/publication-v2-service.inactive.mjs';
import { publicationCommand, reconcilePublication } from '../../src/lib/n88-item-publication-proposal.js';
import { CANONICAL_PROJECTION_REQUIREMENTS } from '../../drafts/n88-student-portal/student-projection.mjs';

const DDL = await readFile(new URL('../../drafts/n88-student-portal/publication-v2-storage.inactive.sql', import.meta.url), 'utf8');
const A = '11111111-1111-4111-8111-111111111111', B = '22222222-2222-4222-8222-222222222222';
const binding = { sessionId: 'synthetic-session', leaseId: 'echo-only', contextRevision: 'echo-context' };
const flags = { required: false, scheduled: false, completed: false, grade: false };
const clone = v => structuredClone(v);
const applied = r => { assert.equal(r.status, 200); assert.equal(r.body.receipt.state, 'applied'); };
const rejected = r => { assert.equal(r.status, 200); assert.equal(r.body.receipt.state, 'rejected'); };
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
function canonical(n, owner) {
  const row = (id, more = {}) => ({ id, ownerId: owner, deleted: false, deletedAt: null, revision: '1', ...more });
  const c = Object.fromEntries(CANONICAL_PROJECTION_REQUIREMENTS.tables.map(t => [t, []]));
  c.years = [row('year', { status: 'active' })];
  c.terms = [row('term', { status: 'active', yearId: 'year', startDate: '2026-08-01', endDate: '2027-06-01' })];
  c.sections = [row('section', { status: 'active', yearId: 'year', name: 'Fabricated', grade: 4 })];
  c.teachings = [row('teaching', { sectionId: 'section', termId: 'term', subjectId: 'subject' })];
  c.students = Array.from({ length: n }, (_, i) => row('pupil' + i, { name: 'Synthetic ' + i, status: 'active' }));
  c.enrollments = c.students.map(s => row('enrollment-' + s.id, { studentId: s.id, sectionId: 'section', status: 'active', startDate: null, endDate: null }));
  c.items = [row('parent', { teachingId: 'teaching', name: 'Distribution', scoreMode: 'subitems', max: 10, order: 0 }),
    row('direct', { teachingId: 'teaching', name: 'Direct', scoreMode: 'direct', max: 10, order: 1 })];
  c.scoreSubitems = ['a', 'b'].map((id, order) => row(id, { itemId: 'parent', name: 'Work ' + id, value: 5, latePoints: 2,
    startDate: '2026-10-20', dueDate: '2026-10-30', order }));
  c.scoreSubitemCompletions = c.students.flatMap(s => c.scoreSubitems.map(d => row(s.id + d.id, { studentId: s.id, subitemId: d.id, checked: true, completionState: d.id === 'a' ? 'late' : 'regular' })));
  c.scores = c.students.map((s, i) => row(s.id + '-direct', { studentId: s.id, itemId: 'direct', value: i % 10 }));
  return c;
}

async function fixture(t, n = 1) {
  const db = new PGlite(); t.after(() => db.close()); await db.exec(DDL);
  const control = { lost: false, failWrite: false, casMiss: false, race: null, pause: null, calls: [], releases: [], acquire: 0 };
  let tail = Promise.resolve();
  const acquire = async () => {
    const previous = tail, released = deferred(); tail = released.promise; await previous; control.acquire++;
    let closed = false;
    return { async query(sql, values = []) {
      control.calls.push(sql);
      if (control.pause && sql.startsWith('insert into n88_private.publication_v2_receipts')) {
        const pause = control.pause; control.pause = null; pause.entered.resolve(); await pause.release.promise;
      }
      if (control.casMiss && sql.startsWith('update n88_private.publication_v2_items')) { control.casMiss = false; return { rows: [], rowCount: 0 }; }
      if (control.failWrite && sql.startsWith('insert into n88_private.publication_v2_receipts')) { control.failWrite = false; throw Error('synthetic write failure'); }
      const result = await db.query(sql, values);
      if (control.race && sql.startsWith('insert into n88_private.publication_v2_receipts')) { const race = control.race; control.race = null; race(); }
      if (control.lost && sql === 'commit') { control.lost = false; throw Error('synthetic lost COMMIT ACK'); }
      return { rows: result.rows, rowCount: result.affectedRows ?? 0, command: sql.split(' ')[0].toUpperCase() };
    }, release(error) { assert.equal(closed, false, 'exclusive client released once'); closed = true; control.releases.push(!!error); released.resolve(); } };
  };
  const repository = createPublicationV2PostgresRepository({ executionMode: 'synthetic', acquire });
  function ownerFixture(owner) {
    const scope = { ownerId: owner, teachingId: 'teaching', sectionId: 'section', termId: 'term', subjectId: 'subject' };
    const state = { c: canonical(n, owner), current: true, sessionId: binding.sessionId };
    const ports = createPublicationV2PostgresPorts({ executionMode: 'synthetic', repository,
      authenticate: async (request, _tx, role) => request.headers.authorization !== 'synthetic-token' ? null : ({ current: state.current, ownerId: owner, sessionId: state.sessionId,
        ...(role === 'student' ? { scope, studentId: request.headers.pupil, enrollmentId: 'enrollment-' + request.headers.pupil } : {}) }),
      readCurrent: async () => ({ canonical: clone(state.c), now: '2026-10-28' }),
    });
    const makeService = () => createPublicationV2Service({ enabled: true, executionMode: 'synthetic', origin: 'https://synthetic.invalid', ...ports });
    let service = makeService();
    const headers = { origin: 'https://synthetic.invalid', authorization: 'synthetic-token', 'x-n88-csrf': '1', 'content-type': 'application/json', 'sec-fetch-site': 'same-origin' };
    const request = (body, extra = {}) => service({ path: '/teacher/class/publication-v2', method: 'POST', body, headers, ...extra });
    const list = async () => { const r = await request({ action: 'list', scope, binding }); assert.equal(r.status, 200); return r.body; };
    const command = (list, source = 'a', decisions = { ...flags, grade: true }, requestId = 'original_intent_0001') => {
      const row = list.rows.find(row => row.sourceId === source);
      return publicationCommand({ draft: { scope, rows: [{ ...row, decisions }] }, scope, rowId: row.id, requestId,
        expectedPublicationRevision: row.publicationRevision, expectedMembershipRevision: list.membershipRevision, binding });
    };
    return { scope, state, ports, request, list, command, refresh() { service = makeService(); },
      student: (i = 0) => service({ path: '/student/publication-v2/read', method: 'GET', headers: { ...headers, pupil: 'pupil' + i } }) };
  }
  return { db, control, repository, acquire, ownerFixture, ...ownerFixture(A) };
}

for (const n of [0, 1, 30, 50]) test(`embedded SQL actual handler persistence/CAS/receipt/privacy (${n})`, async t => {
  const f = await fixture(t, n), list = await f.list();
  assert.equal(list.rows.length, 3); assert(list.rows.every(r => Object.values(r.decisions).every(v => !v)));
  assert.equal(list.rows[0].startDate, '2026-10-20'); assert.equal(list.rows[0].dueDate, '2026-10-30');
  const command = f.command(list, 'a', { ...flags, completed: true }); applied(await f.request(command));
  applied(await f.request(f.command(list, 'b', { ...flags, grade: true }, 'other_item_intent_02')));
  f.refresh(); const fresh = await f.list(); assert.equal(fresh.rows[0].publicationRevision, 1);
  const repeated = await f.request(command); applied(repeated); assert.equal(repeated.body.receipt.publicationRevision, 1);
  assert.equal((await f.db.query('select count(*)::int as n from n88_private.publication_v2_receipts')).rows[0].n, 2);
  for (let i = 0; i < n; i++) {
    const r = await f.student(i); assert.equal(r.status, 200); assert.deepEqual(Object.keys(r.body).sort(), ['grades', 'work']);
    assert.deepEqual(r.body.grades.map(g => g.value), [5]); assert.equal(r.body.work.length, 1);
    assert.equal(r.body.work[0].title, 'Work a');
    assert(!JSON.stringify(r.body).match(/"(?:total|rank|raw|ownerId|studentId|sourceRevision|parent)":/));
  }
  assert.equal((await f.student(n)).status, 503);
});

test('embedded SQL CAS contenders in both intent orders, immutable original and fresh reconciliation', async t => {
  const f = await fixture(t);
  for (const order of [true, false]) {
    const list = await f.list();
    const on = f.command(list, 'a', { ...flags, grade: true }, 'intent_on_order_' + (order ? '01' : '02'));
    const off = f.command(list, 'a', flags, 'intent_off_order_' + (order ? '01' : '02'));
    const commands = order ? [on, off] : [off, on];
    const result = await Promise.all(commands.map(c => f.request(c))); applied(result[0]); rejected(result[1]);
    const original = clone(result[0].body.receipt);
    const next = await f.list(); applied(await f.request(f.command(next, 'a', flags, 'later_intent_order_' + (order ? '01' : '02'))));
    const status = await f.request({ action: 'status', scope: f.scope, binding, command: commands[0] });
    assert.deepEqual(status.body.receipt, original);
    assert.equal(reconcilePublication(commands[0], f.scope, status.body.receipt, status.body.fresh, binding).state, 'unknown');
    assert.equal((await f.request({ ...commands[0], decisions: { ...flags, scheduled: true } })).status, 503);
  }
});

test('SQL rollback of partially flushed writes, CAS miss and lost COMMIT ACK never replay', async t => {
  const f = await fixture(t), list = await f.list(), command = f.command(list);
  f.control.failWrite = true; assert.equal((await f.request(command)).status, 503);
  assert.equal((await f.db.query('select count(*)::int as n from n88_private.publication_v2_receipts')).rows[0].n, 0);
  assert.equal((await f.list()).rows[0].publicationRevision, 0);
  f.control.casMiss = true; assert.equal((await f.request(command)).status, 503);
  assert.equal((await f.list()).rows[0].publicationRevision, 0);
  f.control.lost = true; assert.equal((await f.request(command)).status, 503);
  assert.equal((await f.db.query('select count(*)::int as n from n88_private.publication_v2_receipts')).rows[0].n, 1);
  const inserts = f.control.calls.filter(s => s.startsWith('insert into n88_private.publication_v2_receipts')).length;
  f.refresh(); const status = await f.request({ action: 'status', scope: f.scope, binding, command });
  assert.equal(reconcilePublication(command, f.scope, status.body.receipt, status.body.fresh, binding).state, 'confirmed');
  assert.equal(f.control.calls.filter(s => s.startsWith('insert into n88_private.publication_v2_receipts')).length, inserts);
  assert(f.control.releases.includes(true));
});

test('owner-scoped SQL loads and writes never read another owner; forged owner/Auth and stale echo deny', async t => {
  const f = await fixture(t), a = await f.list(), ca = f.command(a); applied(await f.request(ca));
  const g = f.ownerFixture(B), b = await g.list(); assert(b.rows.every(r => !r.decisions.grade));
  assert.deepEqual((await g.student()).body.grades, []);
  applied(await g.request(g.command(b))); // same request ID allowed for different owner
  const receipts = await f.db.query('select owner_id,request_id from n88_private.publication_v2_receipts order by owner_id'); assert.equal(receipts.rows.length, 2);
  assert(f.control.calls.filter(s => s.startsWith('select case when octet_length(body)')).every(s => s.includes('where owner_id=$1::uuid')));
  assert.equal((await f.request({ ...ca, scope: { ...f.scope, ownerId: B } })).status, 503);
  f.state.current = false; assert.equal((await f.student()).status, 503); f.state.current = true;
  assert.equal((await f.request({ action: 'status', scope: f.scope, binding: { ...binding, leaseId: 'new-echo' }, command: ca })).status, 503);
  assert.equal((await f.request(ca, { headers: { origin: 'https://other.invalid' } })).status, 401);
});

test('durable source deletion in both orderings, restoration and high-water regression fail closed', async t => {
  const f = await fixture(t), l = await f.list(), command = f.command(l); applied(await f.request(command));
  f.state.c.scoreSubitems[0].deleted = true; f.state.c.scoreSubitems[0].revision = '2';
  assert.deepEqual((await f.student()).body.grades, []);
  const p = await f.db.query('select tombstone,publication_revision::text from n88_private.publication_v2_items where row_id=$1', [command.rowId]);
  assert.equal(p.rows[0].tombstone, true);
  f.refresh(); f.state.c.scoreSubitems[0].deleted = false; f.state.c.scoreSubitems[0].revision = '3';
  assert(!(await f.list()).rows.some(r => r.sourceId === 'a'));
  const status = await f.request({ action: 'status', scope: f.scope, binding, command }); assert.equal(status.body.fresh, null); assert.equal(status.body.receipt.state, 'applied');
  f.state.c.scoreSubitems[0].revision = '1'; assert.equal((await f.student()).status, 503);
  const g = f.ownerFixture(B), before = await g.list(), late = g.command(before);
  g.state.c.scoreSubitems[0].deleted = true; g.state.c.scoreSubitems[0].revision = '2';
  rejected(await g.request(late)); assert.deepEqual((await g.student()).body.grades, []);
});

test('last-moment fabricated Auth/source/score/term/member changes roll back SQL before COMMIT', async t => {
  const f = await fixture(t);
  const mutations = [() => { f.state.current = false; }, () => { f.state.sessionId = 'other-session'; },
    () => { f.state.c.terms[0].status = 'closed'; }, () => { f.state.c.teachings[0].sectionId = 'other'; },
    () => { f.state.c.scoreSubitems[0].deleted = true; }, () => { f.state.c.scores[0].value = 9; },
    () => { f.state.c.enrollments[0].endDate = '2026-10-28'; }];
  for (let i = 0; i < mutations.length; i++) {
    f.state.c = canonical(1, A); f.state.current = true; f.state.sessionId = binding.sessionId;
    const l = await f.list(), command = f.command(l, 'a', { ...flags, grade: true }, 'racing_intent_000' + i);
    f.control.race = mutations[i]; assert.equal((await f.request(command)).status, 503);
    assert.equal((await f.db.query('select count(*)::int as n from n88_private.publication_v2_receipts')).rows[0].n, 0);
  }
});

test('SQL enforces immutable receipts, tombstones, high-water and no removal/truncate', async t => {
  const f = await fixture(t), l = await f.list(); applied(await f.request(f.command(l)));
  for (const sql of [
    'update n88_private.publication_v2_receipts set payload=payload',
    'delete from n88_private.publication_v2_receipts', 'truncate n88_private.publication_v2_receipts',
    'delete from n88_private.publication_v2_items', 'delete from n88_private.publication_v2_scopes',
    'update n88_private.publication_v2_items set publication_revision=publication_revision',
    'update n88_private.publication_v2_high_water set canonical_revision=0',
    "update n88_private.publication_v2_items set publication_revision=publication_revision+1,payload=payload||'{\"decisions\":{\"grades\":true}}'::jsonb",
  ]) await assert.rejects(f.db.query(sql));
  f.state.c.scoreSubitems[0].deleted = true; f.state.c.scoreSubitems[0].revision = '2'; await f.list();
  await assert.rejects(f.db.query('update n88_private.publication_v2_high_water set retired=false where retired'));
  await assert.rejects(f.db.query('update n88_private.publication_v2_items set tombstone=false,publication_revision=publication_revision+1 where tombstone'));
  const acl = await f.db.query("select has_table_privilege('public',c.oid,'SELECT') as allowed from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='n88_private' and c.relkind='r'");
  assert(acl.rows.every(r => !r.allowed));
});

test('manual persistence/edit/delete uses CAS and permanent tombstone, no grade capability', async t => {
  const f = await fixture(t), manualTask = { id: 'manual_1', title: 'Teacher task', description: '<script>literal</script>', startDate: '2026-10-28', dueDate: null, link: 'https://example.invalid/lesson' };
  const preview = await f.request({ action: 'manual-preview', scope: f.scope, binding, manualTask }); assert.equal(preview.status, 200);
  const row = preview.body.row;
  const command = publicationCommand({ draft: { scope: f.scope, rows: [{ ...row, decisions: { ...flags, required: true } }] }, scope: f.scope,
    rowId: row.id, requestId: 'manual_intent_00001', expectedPublicationRevision: 0, expectedMembershipRevision: preview.body.membershipRevision, binding });
  applied(await f.request(command)); f.refresh(); assert.equal((await f.student()).body.work[0].description, manualTask.description);
  const list = await f.list(), deletion = f.command(list, 'manual_1', flags, 'delete_manual_00001'); deletion.action = 'item-publication-delete'; deletion.manualTask = null;
  applied(await f.request(deletion)); assert.deepEqual((await f.student()).body.work, []);
  const next = await f.request({ action: 'manual-preview', scope: f.scope, binding, manualTask }); assert(next.body.row.tombstone);
  const p = await f.db.query("select payload from n88_private.publication_v2_scopes"); assert.deepEqual(p.rows[0].payload.manualTasks, []);
});

test('no provisional ACK; retained transaction capabilities and post-action mutations are fenced', async t => {
  const f = await fixture(t), l = await f.list(), pause = { entered: deferred(), release: deferred() }; f.control.pause = pause;
  let settled = false; const result = f.request(f.command(l)).then(r => { settled = true; return r; });
  await pause.entered.promise; assert.equal(settled, false); pause.release.resolve(); applied(await result);
  let retained;
  await f.ports.transaction(async tx => { retained = tx; await tx.bindOwner(A); return { ok: true }; });
  assert.throws(() => retained.query('select 1'));
  assert.throws(() => f.ports.readCurrent(retained, { ownerId: A }, f.scope));
  await assert.rejects(f.ports.transaction(async tx => {
    await tx.bindOwner(A); tx.beforeCommit(() => { tx.state.receipts = []; }); return null;
  }));
});

test('missing schema/malformed legacy payload deny; OFF mode never acquires; no automatic installation', async t => {
  let acquired = 0;
  const off = createPublicationV2Service({ enabled: false, executionMode: 'synthetic', transaction: () => { acquired++; } });
  assert.equal((await off({ path: '/teacher/class/publication-v2' })).status, 401); assert.equal(acquired, 0);
  assert.throws(() => createPublicationV2PostgresRepository({ executionMode: 'production', acquire: () => {} }));
  const f = await fixture(t), l = await f.list(); applied(await f.request(f.command(l)));
  // Simulate a corrupt/legacy read at the driver boundary without changing constraints.
  const malformedRepository = { transaction: action => f.repository.transaction((db, ports) => action(db, { ...ports, query: async (sql, args) => {
    const result = await ports.query(sql, args);
    if (sql.includes('from n88_private.publication_v2_items')) result.rows[0].body = JSON.stringify({ scope_key: 'x', row_id: 'legacy', publication_revision: '1', tombstone: false, payload: { grades: true } });
    return result;
  } })) };
  const badPorts = createPublicationV2PostgresPorts({ executionMode: 'synthetic', repository: malformedRepository, authenticate: async () => null });
  await assert.rejects(badPorts.transaction(tx => tx.bindOwner(A)));
  await f.db.query('alter table n88_private.publication_v2_receipts rename to synthetic_unavailable');
  assert.equal((await f.student()).status, 503);
  assert.equal((await f.db.query("select count(*)::int as n from pg_tables where schemaname='n88_private' and tablename='publication_v2_receipts'")).rows[0].n, 0);
});

test('private retirement hook survives deletion/restoration between portal reads and rolls back atomically', async t => {
  const f = await fixture(t), l = await f.list(); applied(await f.request(f.command(l)));
  const k = (await f.db.query('select scope_key from n88_private.publication_v2_scopes')).rows[0].scope_key;
  await f.db.query('begin');
  await f.db.query('select n88_private.publication_v2_retire_source($1::uuid,$2,$3,$4,$5::bigint)', [A, k, 'scoreSubitems', 'a', '2']);
  await f.db.query('rollback');
  assert.equal((await f.student()).body.grades.length, 1);
  // Simulates a canonical lifecycle calling the internal hook; no actual trigger
  // on existing canonical tables is installed or claimed by this source proposal.
  await f.db.query('select n88_private.publication_v2_retire_source($1::uuid,$2,$3,$4,$5::bigint)', [A, k, 'items', 'parent', '2']);
  f.refresh(); f.state.c.items[0].revision = '3';
  assert.deepEqual((await f.student()).body.grades, []);
  assert(!(await f.list()).rows.some(r => ['a', 'b'].includes(r.sourceId)));
  await assert.rejects(f.db.query('select n88_private.publication_v2_retire_source($1::uuid,$2,$3,$4,$5::bigint)', [B, k, 'items', 'parent', '2']));
});

test('default canonical reader executes existing typed source SQL in the same owned SQL transaction', async t => {
  const f = await fixture(t);
  // Minimal exact source column fixtures for the existing readCanonical reader.
  // This synthetic lock stub proves query composition only, NOT independent locks.
  await f.db.exec(`create schema rakeezx;
    create function n88_private.lock_projection_sources(uuid,integer) returns void language sql as 'select';`);
  const extras = {
    years: 'status text', terms: 'year_id text,status text,start_date date,end_date date',
    sections: 'year_id text,status text,archived_at timestamptz,grade integer,label text,name text', students: 'status text,name text',
    enrollments: 'student_id text,section_id text,status text,start_date date,end_date date', teachings: 'section_id text,term_id text,subject_id text',
    items: 'teaching_id text,name text,max numeric,"order" integer,auto text,per_point numeric,penalty numeric,score_mode text,portability_group_id text',
    scores: 'student_id text,item_id text,value numeric,manual_value numeric,derived_value numeric',
    scoreSubitems: 'item_id text,name text,value numeric,"order" integer,start_date date,due_date date,late_points numeric',
    scoreSubitemCompletions: 'student_id text,subitem_id text,checked boolean,completion_state text',
    sessions: 'teaching_id text,date date,status text', attendance: 'student_id text,teaching_id text,session_id text,status text', logs: 'student_id text,teaching_id text,kind text,delta numeric',
  };
  for (const [name, columns] of Object.entries(extras)) {
    const sqlName = name.replace(/[A-Z]/g, c => '_' + c.toLowerCase());
    const fields = ['id', 'owner_id', 'revision', 'deleted_at', ...columns.split(',').map(c => c.split(' ')[0].replaceAll('"', ''))];
    await f.db.exec(`create table rakeezx.${sqlName}(id text primary key,owner_id uuid,revision bigint,deleted_at timestamptz,${columns})`);
    for (const r of f.state.c[name]) {
      const data = Object.fromEntries(Object.entries(r).map(([k, v]) => [k.replace(/[A-Z]/g, c => '_' + c.toLowerCase()), v]));
      await f.db.query(`insert into rakeezx.${sqlName}(${fields.map(k => '"' + k + '"').join(',')}) values(${fields.map((_, i) => '$' + (i + 1)).join(',')})`, fields.map(k => data[k] ?? null));
    }
  }
  const ports = createPublicationV2PostgresPorts({ executionMode: 'synthetic', repository: f.repository,
    authenticate: async () => ({ current: true, ownerId: A, sessionId: binding.sessionId }) });
  const service = createPublicationV2Service({ enabled: true, executionMode: 'synthetic', origin: 'https://synthetic.invalid', ...ports });
  const result = await service({ path: '/teacher/class/publication-v2', method: 'POST', body: { action: 'list', scope: f.scope, binding },
    headers: { origin: 'https://synthetic.invalid', 'x-n88-csrf': '1', 'content-type': 'application/json' } });
  assert.equal(result.status, 200); assert.equal(result.body.rows.length, 3);
  assert.equal(result.body.rows.find(row => row.sourceId === 'a').startDate, '2026-10-20');
  assert(f.control.calls.some(sql => sql.includes('lock_projection_sources')));
});

test('acquisition timeout destroys a late owned client once; no delayed SQL escapes', async () => {
  const lease = deferred(); let released = 0, queried = 0;
  const repository = createPublicationV2PostgresRepository({ executionMode: 'synthetic', transactionMs: 50, acquire: () => lease.promise });
  await assert.rejects(repository.transaction(() => { throw Error('must not enter'); }));
  lease.resolve({ query: async () => { queried++; }, release: error => { assert(error); released++; } });
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(released, 1); assert.equal(queried, 0);
});

test('independent-connection PostgreSQL contention/row-lock/deletion-hook proof', { skip: 'NOT_RUN: no native PostgreSQL tools; Docker engine unavailable. PGlite is a single embedded engine, not independent connections.' }, () => {});
