/** AI: native connections, no PGlite or JS mutex. Called only by run-local.mjs.
 * SQL-backed fake canonical snapshots/sessions are transaction-local readers.
 * They do NOT claim parity with deployed canonical writer/Auth integration.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { createPublicationV2PostgresPorts, createPublicationV2PostgresRepository } from '../../drafts/n88-student-portal/publication-v2-postgres.inactive.mjs';
import { createPublicationV2Service } from '../../drafts/n88-student-portal/publication-v2-service.inactive.mjs';
import { CANONICAL_PROJECTION_REQUIREMENTS } from '../../drafts/n88-student-portal/student-projection.mjs';
import { publicationCommand, reconcilePublication } from '../../src/lib/n88-item-publication-proposal.js';

const LOCK = 'select pg_advisory_xact_lock(1312307256, 88)';
const SOURCE = 'select payload from n88_local_fixture.sources where owner_id=$1::uuid for share';
const AUTH = 'select session_id,current from n88_local_fixture.sessions where owner_id=$1::uuid and session_id=$2 for share';
const flags = { required: false, scheduled: false, completed: false, grade: false };
const binding = { sessionId: 'fabricated-session', leaseId: 'local-echo', contextRevision: 'local-context' };
const clone = v => structuredClone(v);
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const intent = () => 'intent_' + randomUUID().replaceAll('-', '');
const applied = r => { assert.equal(r.status, 200); assert.equal(r.body.receipt.state, 'applied'); };
const rejected = r => { assert.equal(r.status, 200); assert.equal(r.body.receipt.state, 'rejected'); };
function canonical(n, owner) {
  const row = (id, more = {}) => ({ id, ownerId: owner, revision: '1', deleted: false, deletedAt: null, ...more });
  const c = Object.fromEntries(CANONICAL_PROJECTION_REQUIREMENTS.tables.map(t => [t, []]));
  c.years = [row('year', { status: 'active' })]; c.terms = [row('term', { yearId: 'year', status: 'active', startDate: '2026-08-01', endDate: '2027-06-01' })];
  c.sections = [row('section', { yearId: 'year', status: 'active', grade: 4, name: 'Fabricated' })];
  c.teachings = [row('teaching', { sectionId: 'section', termId: 'term', subjectId: 'subject' })];
  c.students = Array.from({ length: n }, (_, i) => row('pupil' + i, { name: 'Synthetic ' + i, status: 'active' }));
  c.enrollments = c.students.map(s => row('enrollment-' + s.id, { studentId: s.id, sectionId: 'section', status: 'active', startDate: null, endDate: null }));
  c.items = [row('parent', { teachingId: 'teaching', name: 'Distribution', scoreMode: 'subitems', max: 10, order: 0 }), row('direct', { teachingId: 'teaching', name: 'Direct', max: 10, scoreMode: 'direct', order: 1 })];
  c.scoreSubitems = ['a', 'b'].map((id, order) => row(id, { itemId: 'parent', name: 'Task ' + id, value: 5, latePoints: 2, startDate: '2026-10-20', dueDate: '2026-10-30', order }));
  c.scoreSubitemCompletions = c.students.flatMap(s => c.scoreSubitems.map(d => row(s.id + d.id, { studentId: s.id, subitemId: d.id, checked: true, completionState: d.id === 'a' ? 'late' : 'regular' })));
  c.scores = c.students.map((s, i) => row(s.id + '-direct', { studentId: s.id, itemId: 'direct', value: i % 10 }));
  return c;
}

export async function qualify({ root, admin, connect, report }) {
  const check = async (name, fn) => { console.log('CHECK ' + name); const evidence = await fn(); report.checks.push({ name, status: 'PASS', evidence }); };
  const ddl = await readFile(path.join(root, 'drafts/n88-student-portal/publication-v2-storage.inactive.sql'), 'utf8');
  await admin.query(ddl); // Exact proposal, scratch cluster ONLY.
  await admin.query(`create schema n88_local_fixture;
    create table n88_local_fixture.sources(owner_id uuid primary key,payload jsonb not null);
    create table n88_local_fixture.sessions(owner_id uuid primary key,session_id text not null,current boolean not null);`);
  const backendPids = new Set([admin.processID]); report.observerPid = admin.processID;
  const pause = () => ({ entered: deferred(), release: deferred(), sql: LOCK });
  const blocking = async (blocker, label = null) => {
    const until = Date.now() + 3000;
    while (Date.now() < until) {
      const rows = (await admin.query("select pid,wait_event_type,wait_event,pg_blocking_pids(pid) as blockers from pg_stat_activity where datname=current_database() and $1::int=any(pg_blocking_pids(pid)) and ($2::text is null or application_name=$2)", [blocker, label])).rows;
      if (rows.length) { assert(rows.every(r => r.pid !== blocker && r.wait_event_type === 'Lock')); return rows; }
      await new Promise(resolve => setTimeout(resolve, 15));
    }
    assert.fail('Expected actual PostgreSQL blocking relation was not observed');
  };
  async function fixture(n = 1, transactionMs = 5000) {
    const owner = randomUUID(), scope = { ownerId: owner, teachingId: 'teaching', sectionId: 'section', termId: 'term', subjectId: 'subject' };
    await admin.query('insert into n88_local_fixture.sources values($1::uuid,$2::jsonb)', [owner, JSON.stringify(canonical(n, owner))]);
    await admin.query('insert into n88_local_fixture.sessions values($1::uuid,$2,true)', [owner, binding.sessionId]);
    const control = { hold: null, late: null, cut: null, lockPids: [], receiptWrites: 0, released: [] };
    const acquire = async () => {
      const c = await connect('adapter'); backendPids.add(c.processID);
      return { async query(sql, values = []) {
        if (sql === LOCK) control.lockPids.push(c.processID);
        const result = await c.query(sql, values);
        if (sql.startsWith('insert into n88_private.publication_v2_receipts')) control.receiptWrites++;
        const gate = control.hold?.sql === sql ? control.hold :
          control.cut && sql.startsWith('insert into n88_private.publication_v2_receipts') ? control.cut :
          control.late && sql === 'commit' ? control.late : null;
        if (gate) { if (gate === control.hold) control.hold = null; else if (gate === control.cut) control.cut = null; else control.late = null;
          gate.entered.resolve(c.processID); await gate.release.promise; }
        return result;
      }, release(error) { control.released.push({ pid: c.processID, broken: !!error }); c.end().catch(() => {}); } };
    };
    const repository = createPublicationV2PostgresRepository({ executionMode: 'synthetic', acquire, transactionMs });
    const ports = createPublicationV2PostgresPorts({ executionMode: 'synthetic', repository,
      authenticate: async (request, tx, role) => {
        if (request.headers.authorization !== 'fixture-' + owner) return null;
        const r = (await tx.query(AUTH, [owner, binding.sessionId])).rows[0];
        return r ? { ownerId: owner, sessionId: r.session_id, current: r.current,
          ...(role === 'student' ? { scope, studentId: request.headers.pupil, enrollmentId: 'enrollment-' + request.headers.pupil } : {}) } : null;
      },
      readCurrent: async (tx, auth) => ({ canonical: (await tx.query(SOURCE, [auth.ownerId])).rows[0].payload, now: '2026-10-28' }),
    });
    const makeService = () => createPublicationV2Service({ executionMode: 'synthetic', enabled: true, origin: 'https://synthetic.invalid', ...ports });
    let service = makeService();
    const headers = { origin: 'https://synthetic.invalid', authorization: 'fixture-' + owner, 'x-n88-csrf': '1', 'content-type': 'application/json', 'sec-fetch-site': 'same-origin' };
    const request = body => service({ path: '/teacher/class/publication-v2', method: 'POST', headers, body });
    const list = async () => { const r = await request({ action: 'list', scope, binding }); assert.equal(r.status, 200); return r.body; };
    const command = (l, source = 'a', decisions = { ...flags, grade: true }) => {
      const r = l.rows.find(r => r.sourceId === source);
      return publicationCommand({ draft: { scope, rows: [{ ...r, decisions }] }, scope, rowId: r.id, binding, requestId: intent(),
        expectedPublicationRevision: r.publicationRevision, expectedMembershipRevision: l.membershipRevision });
    };
    return { owner, scope, control, ports, request, list, command, refresh() { service = makeService(); },
      student: (i = 0) => service({ path: '/student/publication-v2/read', method: 'GET', headers: { ...headers, pupil: 'pupil' + i } }),
      source: async () => (await admin.query('select payload from n88_local_fixture.sources where owner_id=$1::uuid', [owner])).rows[0].payload,
      saveSource: (c, data) => c.query('update n88_local_fixture.sources set payload=$2::jsonb where owner_id=$1::uuid', [owner, JSON.stringify(data)]),
      status: command => request({ action: 'status', scope, binding, command }),
      key: async () => (await admin.query('select scope_key from n88_private.publication_v2_scopes where owner_id=$1::uuid', [owner])).rows[0].scope_key,
    };
  }

  await check('native_exact_ddl_catalog_and_private_acl', async () => {
    const tables = (await admin.query("select c.relname,(select count(*)::int from aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a where a.grantee=0) as public_privileges from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='n88_private' and c.relkind='r' order by c.relname")).rows;
    assert.equal(tables.length, 4); assert(tables.every(r => r.public_privileges === 0));
    const functions = (await admin.query("select p.proname,p.prosecdef,encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex') as sha256 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='n88_private' order by p.proname")).rows;
    assert.equal(functions.length, 6); assert(functions.every(f => !f.prosecdef));
    const triggers = (await admin.query("select tgname from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='n88_private' and not t.tgisinternal order by tgname")).rows;
    assert.equal(triggers.length, 8);
    report.storageCatalog = { tables, functions, triggers, constraints: (await admin.query("select c.relname,k.conname,k.contype,pg_get_constraintdef(k.oid) as definition from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='n88_private' order by c.relname,k.conname")).rows };
    return { tables: 4, functions: 6, immutableTriggers: 8, ddlSha256: createHash('sha256').update(ddl).digest('hex') };
  });

  for (const n of [0, 1, 30, 50]) await check('native_actual_handler_owned_privacy_' + n, async () => {
    const f = await fixture(n), l = await f.list(); assert.equal(l.rows.length, 3); assert(l.rows.every(r => Object.values(r.decisions).every(v => !v)));
    applied(await f.request(f.command(l, 'a', { ...flags, completed: true })));
    applied(await f.request(f.command(l, 'b'))); applied(await f.request(f.command(l, 'direct')));
    f.refresh();
    for (let i = 0; i < n; i++) {
      const r = await f.student(i); assert.equal(r.status, 200); assert.deepEqual(Object.keys(r.body).sort(), ['grades', 'work']);
      assert.deepEqual(r.body.grades.map(g => g.value), [5, i % 10]); assert.equal(r.body.work[0].title, 'Task a');
      assert(!JSON.stringify(r.body).match(/"(?:total|rank|raw|ownerId|studentId|sourceRevision|parent)":/));
    }
    assert.equal((await f.student(n)).status, 503);
    return { pupils: n, freshNativeTransactions: true, parentAggregateHidden: true };
  });

  await check('native_independent_backends_actual_advisory_wait_both_CAS_orders', async () => {
    const f = await fixture(), evidence = [];
    for (const onFirst of [true, false]) {
      const l = await f.list(), a = f.command(l, 'a', onFirst ? { ...flags, grade: true } : flags), b = f.command(l, 'a', onFirst ? flags : { ...flags, grade: true });
      const gate = pause(); f.control.hold = gate;
      const first = f.request(a), pid = await gate.entered.promise;
      const second = f.request(b); let wait;
      try { wait = await blocking(pid); } finally { gate.release.resolve(); }
      const results = await Promise.all([first, second]); applied(results[0]); rejected(results[1]);
      const immutable = clone(results[0].body.receipt), next = await f.list(); applied(await f.request(f.command(next, 'a', flags)));
      const status = await f.status(a); assert.deepEqual(status.body.receipt, immutable);
      assert.equal(reconcilePublication(a, f.scope, status.body.receipt, status.body.fresh, binding).state, 'unknown');
      assert.equal((await f.request({ ...a, decisions: { ...flags, scheduled: true } })).status, 503);
      evidence.push({ firstPid: pid, blocked: wait, first: 'applied', second: 'rejected' });
    }
    return evidence;
  });

  await check('native_real_row_lock_fences_noncooperating_source_writer', async () => {
    const f = await fixture(), l = await f.list(), gate = pause(); gate.sql = SOURCE; f.control.hold = gate;
    const pending = f.request(f.command(l)), pid = await gate.entered.promise;
    const writer = await connect('source-writer'); backendPids.add(writer.processID);
    const data = await f.source(); data.scoreSubitems[0].value = 6; data.scoreSubitems[0].revision = '2';
    const writing = f.saveSource(writer, data); let wait;
    try { wait = await blocking(pid, 'n88-local-source-writer'); } finally { gate.release.resolve(); }
    applied(await pending); await writing; await writer.end();
    assert.deepEqual((await f.student()).body.grades, []);
    return { admittedReader: pid, blockedWriter: wait, nextReadWithheld: true, lockScope: 'synthetic canonical snapshot row, NOT hosted canonical tables' };
  });

  await check('native_stale_session_source_and_term_before_admission_fail_closed', async () => {
    const evidence = [];
    for (const kind of ['session', 'source', 'term']) {
      const f = await fixture(), l = await f.list(), command = f.command(l);
      const writer = await connect('stale-writer'); await writer.query('begin'); await writer.query(LOCK);
      if (kind === 'session') await writer.query('update n88_local_fixture.sessions set current=false where owner_id=$1::uuid', [f.owner]);
      else { const data = await f.source(); if (kind === 'source') data.scoreSubitems[0].revision = '2'; else data.terms[0].status = 'closed'; await f.saveSource(writer, data); }
      const pending = f.request(command); let wait;
      try { wait = await blocking(writer.processID); } finally { await writer.query('commit'); }
      const r = await pending; if (kind === 'source') rejected(r); else assert.equal(r.status, 503);
      assert.deepEqual((await f.student()).body.grades ?? [], []); await writer.end();
      evidence.push({ kind, wait, status: r.status });
    }
    return evidence;
  });

  await check('native_retirement_publication_both_lock_orders_and_atomic_rollback', async () => {
    const evidence = [];
    for (const publicationFirst of [true, false]) {
      const f = await fixture(), l = await f.list(), command = f.command(l), k = await f.key();
      const writer = await connect('retirement-writer');
      const deleted = await f.source(); deleted.items[0].deleted = true; deleted.items[0].revision = '2';
      deleted.scoreSubitems.forEach(s => { s.deleted = true; s.revision = '2'; });
      const retire = async () => {
        await f.saveSource(writer, deleted);
        await writer.query('select n88_private.publication_v2_retire_source($1::uuid,$2,$3,$4,$5::bigint)', [f.owner, k, 'items', 'parent', '2']);
      };
      await writer.query('begin'); await writer.query(LOCK); await retire(); await writer.query('rollback');
      assert((await f.list()).rows.some(r => r.sourceId === 'a'));
      let wait, result;
      if (publicationFirst) {
        const gate = pause(); f.control.hold = gate; const p = f.request(command), pid = await gate.entered.promise;
        const writing = (async () => { await writer.query('begin'); await writer.query(LOCK); await retire(); await writer.query('commit'); })();
        try { wait = await blocking(pid); } finally { gate.release.resolve(); }
        result = await p; applied(result); await writing;
      } else {
        await writer.query('begin'); await writer.query(LOCK); await retire(); const p = f.request(command);
        try { wait = await blocking(writer.processID); } finally { await writer.query('commit'); }
        result = await p; rejected(result);
      }
      await writer.end();
      const restored = canonical(1, f.owner); restored.items[0].revision = '3'; restored.scoreSubitems.forEach(s => { s.revision = '3'; });
      await f.saveSource(admin, restored); f.refresh();
      assert(!(await f.list()).rows.some(r => ['a', 'b'].includes(r.sourceId))); assert.deepEqual((await f.student()).body.grades, []);
      const status = await f.status(command); assert.equal(status.body.fresh, null); assert.equal(status.body.receipt.state, publicationFirst ? 'applied' : 'rejected');
      evidence.push({ publicationFirst, wait, tombstoneSurvivedRestore: true });
    }
    return evidence;
  });

  await check('native_backend_disconnect_rolls_back_uncommitted_flush_no_replay', async () => {
    const f = await fixture(), l = await f.list(), command = f.command(l), gate = pause(); f.control.cut = gate;
    const pending = f.request(command), pid = await gate.entered.promise;
    // This PID is the newly owned loopback connection, not an OS/user process.
    assert(backendPids.has(pid)); assert.equal((await admin.query('select pg_terminate_backend($1::int) as terminated', [pid])).rows[0].terminated, true);
    gate.release.resolve(); assert.equal((await pending).status, 503);
    assert.equal((await admin.query('select count(*)::int as n from n88_private.publication_v2_receipts where owner_id=$1::uuid', [f.owner])).rows[0].n, 0);
    assert.equal((await f.list()).rows.find(r => r.sourceId === 'a').publicationRevision, 0);
    const writes = f.control.receiptWrites; assert.equal((await f.status(command)).status, 503); assert.equal(f.control.receiptWrites, writes);
    return { terminatedOwnedBackend: pid, noReceiptOrPublicationCommitted: true, noAutomaticRetry: true };
  });

  await check('native_COMMIT_visible_before_late_ACK_timeout_original_status_only', async () => {
    const f = await fixture(1, 1200), l = await f.list(), command = f.command(l), gate = pause(); f.control.late = gate;
    let settled = false; const pending = f.request(command).then(r => { settled = true; return r; }); await gate.entered.promise;
    assert.equal(settled, false);
    assert.equal((await admin.query('select count(*)::int as n from n88_private.publication_v2_receipts where owner_id=$1::uuid and request_id=$2', [f.owner, command.requestId])).rows[0].n, 1);
    assert.equal((await pending).status, 503); gate.release.resolve();
    const writes = f.control.receiptWrites, status = await f.status(command);
    assert.equal(reconcilePublication(command, f.scope, status.body.receipt, status.body.fresh, binding).state, 'confirmed');
    assert.equal(f.control.receiptWrites, writes); assert(f.control.released.some(r => r.broken));
    return { commitIndependentlyObserved: true, timedOutUnconfirmed: true, originalReceiptConfirmedByFreshRead: true, writes };
  });

  await check('native_owner_scope_and_immutable_storage_negatives', async () => {
    const a = await fixture(), b = await fixture();
    const la = await a.list(), ca = a.command(la); applied(await a.request(ca)); await b.list();
    assert.deepEqual((await b.student()).body.grades, []);
    assert.equal((await b.request({ ...ca, binding })).status, 503);
    assert.equal((await a.request({ action: 'status', scope: a.scope, binding: { ...binding, leaseId: 'new-echo' }, command: ca })).status, 503);
    const negatives = [];
    for (const sql of ['update n88_private.publication_v2_receipts set payload=payload', 'delete from n88_private.publication_v2_receipts',
      'truncate n88_private.publication_v2_receipts', 'update n88_private.publication_v2_items set publication_revision=publication_revision',
      'update n88_private.publication_v2_high_water set canonical_revision=0']) {
      await assert.rejects(admin.query(sql), e => { negatives.push(e.code); return e.code === '23514'; });
    }
    let acquisitions = 0;
    const off = createPublicationV2Service({ enabled: false, transaction: () => { acquisitions++; } });
    assert.equal((await off({})).status, 401); assert.equal(acquisitions, 0);
    assert.throws(() => createPublicationV2PostgresRepository({ executionMode: 'production', acquire() {} }));
    return { separateOwners: true, changedEchoDenied: true, immutableSqlstates: negatives, defaultOff: true };
  });

  report.independentBackendPids = [...backendPids]; assert(backendPids.size > 3);
  const before = (await admin.query('select (select count(*)::int from n88_private.publication_v2_receipts) as receipts,(select count(*)::int from n88_private.publication_v2_items where tombstone) as tombstones')).rows[0];
  return async fresh => {
    const after = (await fresh.query('select (select count(*)::int from n88_private.publication_v2_receipts) as receipts,(select count(*)::int from n88_private.publication_v2_items where tombstone) as tombstones')).rows[0];
    assert.deepEqual(after, before); assert(after.receipts > 0 && after.tombstones > 0); report.restartPersistence = after;
  };
}
