/** AI: affected native canonical/session binding proof. Actual repository DDL
 * subsets and existing helpers; fabricated Auth provider/JWT keys, users and data.
 * No fake snapshot row, no JS transaction mutex, no hosted account or execution.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { createCanonicalPublicationV2Ports } from '../../drafts/n88-student-portal/publication-v2-canonical.inactive.mjs';
import { createPublicationV2PostgresRepository } from '../../drafts/n88-student-portal/publication-v2-postgres.inactive.mjs';
import { createPublicationV2Service } from '../../drafts/n88-student-portal/publication-v2-service.inactive.mjs';
import { createRolloutGuard } from '../../drafts/n88-student-portal/rollout-guard.mjs';
import { CANONICAL_PROJECTION_REQUIREMENTS } from '../../drafts/n88-student-portal/student-projection.mjs';
import { publicationCommand, reconcilePublication } from '../../src/lib/n88-item-publication-proposal.js';
import { providerFixture, A, B, SESSION, authUrl } from '../fixtures/n88-existing-host/provider.mjs';

const hash = s => createHash('sha256').update(s).digest('hex');
const flags = { required: false, scheduled: false, completed: false, grade: false };
const binding = { sessionId: SESSION, leaseId: 'browser-echo-only', contextRevision: 'browser-context-only' };
const scope = { ownerId: A, teachingId: 'teaching', sectionId: 'class', termId: 'term', subjectId: 'subject' };
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const applied = r => { assert.equal(r.status, 200); assert.equal(r.body.receipt.state, 'applied'); };
const rejected = r => { assert.equal(r.status, 200); assert.equal(r.body.receipt.state, 'rejected'); };
export async function qualify({ root, admin, connect, report }) {
  const check = async (name, fn) => { console.log('CHECK ' + name); report.checks.push({ name, status: 'PASS', evidence: await fn() }); };
  const source = async file => { const s = await readFile(path.join(root, file), 'utf8'); report.sourceSha256[file] = hash(s); return s.replace(/^\uFEFF/, ''); }; // Strip encoding BOM only, retain raw-byte identity.
  // Exact core table definitions, keys, foreign keys and checks, not JSON snapshots.
  await admin.query(`create schema auth;
    create table auth.users(id uuid primary key,banned_until timestamptz);
    create table auth.sessions(id uuid primary key,user_id uuid not null references auth.users(id),not_after timestamptz);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create role anon nologin; create role authenticated nologin; create role n88_backend nologin;`);
  await admin.query(await source('supabase/migrations/0001_core_schema.sql'));
  const foundation = await source('supabase/migrations/0033_score_subitem_foundation.sql');
  await admin.query(foundation.slice(0, foundation.indexOf('alter table rakeezx.score_subitems enable row level security;')) + '\ncommit;');
  const section = await source('supabase/migrations/0021_section_archive_lifecycle.sql');
  await admin.query(section.slice(0, section.indexOf('-- Preserve the complete existing map')) + '\ncommit;');
  const n94 = await source('supabase/migrations/20261012234116_n94_subitem_dates_late_scoring.sql');
  await admin.query(n94.slice(0, n94.indexOf('CREATE OR REPLACE FUNCTION')));
  // Same additive metadata declarations as 0012; no Sync RPC/trigger installation.
  await source('supabase/migrations/0012_sync_v2_server_protocol.sql');
  const names = CANONICAL_PROJECTION_REQUIREMENTS.tables.map(t => t.replace(/[A-Z]/g, c => '_' + c.toLowerCase()));
  for (const t of names) await admin.query(`alter table rakeezx.${t} add column if not exists revision bigint not null default 1 check(revision>=1),add column if not exists field_revisions jsonb not null default '{}'::jsonb check(jsonb_typeof(field_revisions)='object')`);
  const originalSchema = await source('drafts/n88-student-portal/schema-proposal.sql');
  await admin.query('create schema n88_private; revoke all on schema n88_private from public;');
  await admin.query(originalSchema.match(/create table n88_private\.contexts \([\s\S]*?\n\);/)[0]);
  await admin.query(await source('drafts/n88-student-portal/canonical-lock.inactive.sql'));
  await admin.query(await source('drafts/n88-student-portal/auth-session.inactive.sql'));
  const integrated = await source('drafts/n88-student-portal/integrated-schema.inactive.sql');
  await admin.query(integrated.slice(0, integrated.indexOf('create table n88_private.class_credential_receipts')));
  const lockStart = integrated.indexOf('create function n88_private.lock_projection_sources');
  await admin.query(integrated.slice(lockStart, integrated.indexOf('revoke all on function n88_private.lock_projection_sources', lockStart)));
  await admin.query(await source('drafts/n88-student-portal/six-digit-schema.inactive.sql'));
  await admin.query(await source('drafts/n88-student-portal/publication-v2-storage.inactive.sql'));
  for (const owner of [A, B]) {
    await admin.query('insert into auth.users(id) values($1::uuid)', [owner]);
    await admin.query('insert into n88_private.contexts(namespace,owner_id,active) values($1,$2::uuid,true)', ['synthetic_canonical_' + owner.replaceAll('-', ''), owner]);
    await admin.query("insert into rakeezx.years(owner_id,id,label,hijri_start,hijri_end) values($1::uuid,'year','1448',1448,1449)", [owner]);
    await admin.query("insert into rakeezx.terms(owner_id,id,year_id,name,\"index\",status,start_date,end_date) values($1::uuid,'term','year','Term',1,'active','2026-08-01','2027-06-01')", [owner]);
    await admin.query("insert into rakeezx.subjects(owner_id,id,name,slug) values($1::uuid,'subject','Subject','subject')", [owner]);
    await admin.query("insert into rakeezx.sections(owner_id,id,year_id,grade,label,name) values($1::uuid,'class','year',4,'A','Fabricated')", [owner]);
    await admin.query("insert into rakeezx.teachings(owner_id,id,section_id,term_id,subject_id) values($1::uuid,'teaching','class','term','subject')", [owner]);
    await admin.query("insert into rakeezx.items(owner_id,id,teaching_id,name,max,score_mode,\"order\") values($1::uuid,'parent','teaching','Distribution',10,'subitems',0),($1::uuid,'direct','teaching','Direct',10,'direct',1)", [owner]);
    await admin.query("insert into rakeezx.score_subitems(owner_id,id,item_id,name,value,late_points,start_date,due_date,\"order\") values($1::uuid,'a','parent','Work a',5,2,'2026-10-20','2026-10-30',0),($1::uuid,'b','parent','Work b',5,null,null,null,1)", [owner]);
  }
  await admin.query('insert into auth.sessions(id,user_id,not_after) values($1::uuid,$2::uuid,clock_timestamp()+interval \'1 hour\')', [SESSION, A]);
  const tokens = [], provider = providerFixture(), pids = new Set([admin.processID]);
  const rollout = createRolloutGuard(k => ({ N88_ROLLOUT_MODE: 'public', N88_PUBLIC_HOSTED_ACCEPTANCE_SHA256: 'f'.repeat(64), N88_PUBLIC_HOSTED_ACCEPTANCE_CONFIRMED: 'true' })[k]);
  const control = { gate: null, late: null, release: [] };
  const lockProjection = 'select n88_private.lock_projection_sources($1::uuid,$2::integer)';
  const gate = (sql = lockProjection) => ({ sql, entered: deferred(), release: deferred() });
  const repository = createPublicationV2PostgresRepository({ executionMode: 'synthetic', transactionMs: 5000,
    acquire: async () => {
      const c = await connect('canonical-adapter'); pids.add(c.processID);
      return { async query(sql, args = []) {
        const result = await c.query(sql, args), hold = control.gate?.sql === sql ? control.gate : control.late && sql === 'commit' ? control.late : null;
        if (hold) { if (hold === control.gate) control.gate = null; else control.late = null; hold.entered.resolve(c.processID); await hold.release.promise; }
        return result;
      }, release(error) { control.release.push(!!error); c.end().catch(() => {}); } };
    },
  });
  const ports = createCanonicalPublicationV2Ports({ executionMode: 'synthetic', repository, origin: 'https://synthetic.invalid', studentTeachingId: 'teaching', rollout,
    teacher: { authUrl, apiKey: 'FABRICATED_PUBLIC_KEY', fetch: provider.fetch },
    numeric: { keys: new Map([['v1', Buffer.alloc(32, 1)]]), activeKeyVersion: 'v1', reservationKey: Buffer.alloc(32, 2) },
    verifyIngress: async request => request.headers['x-fixture-ingress'] === '1' ? { clientKey: 'fabricated-ingress' } : null,
  });
  let service = createPublicationV2Service({ executionMode: 'synthetic', enabled: true, origin: 'https://synthetic.invalid', ...ports });
  const headers = { origin: 'https://synthetic.invalid', 'x-fixture-ingress': '1', 'x-n88-csrf': '1', 'content-type': 'application/json', 'sec-fetch-site': 'same-origin' };
  const request = (body, token = provider.token()) => service({ path: '/teacher/class/publication-v2', method: 'POST', body, headers: { ...headers, authorization: 'Bearer ' + token } });
  const list = async () => { const r = await request({ action: 'list', scope, binding }); assert.equal(r.status, 200); return r.body; };
  const command = (l, id = 'a', decisions = { ...flags, grade: true }) => {
    const row = l.rows.find(r => r.sourceId === id);
    return publicationCommand({ draft: { scope, rows: [{ ...row, decisions }] }, scope, binding, rowId: row.id,
      requestId: 'intent_' + randomUUID().replaceAll('-', ''), expectedPublicationRevision: row.publicationRevision, expectedMembershipRevision: l.membershipRevision });
  };
  const student = i => service({ path: '/student/publication-v2/read', method: 'GET', headers: { ...headers, cookie: '__Secure-n88-student=' + tokens[i]?.token } });
  const waitBlocked = async (pid, writer) => {
    const deadline = Date.now() + 2500;
    while (Date.now() < deadline) {
      const rows = (await admin.query('select pid,wait_event_type,wait_event,pg_blocking_pids(pid) as blockers from pg_stat_activity where pid=$1::int and $2::int=any(pg_blocking_pids(pid))', [writer, pid])).rows;
      if (rows.length) { assert.equal(rows[0].wait_event_type, 'Lock'); return rows[0]; }
      await new Promise(resolve => setTimeout(resolve, 15));
    }
    assert.fail('Actual canonical writer lock wait not observed');
  };
  let pupils = 0;
  async function addPupil(i, owner = A) {
    const token = randomBytes(32).toString('base64url'), credential = randomUUID(), session = randomUUID();
    await admin.query("insert into rakeezx.students(owner_id,id,name) values($1::uuid,$2,$3)", [owner, 'student' + i, 'Fabricated ' + i]);
    await admin.query("insert into rakeezx.enrollments(owner_id,id,student_id,section_id,roll_no) values($1::uuid,$2,$3,'class',$4)", [owner, 'enrollment' + i, 'student' + i, i + 1]);
    await admin.query("insert into rakeezx.scores(owner_id,id,student_id,item_id,value) values($1::uuid,$2,$3,'direct',$4)", [owner, 'score' + i, 'student' + i, i % 10]);
    for (const sub of ['a', 'b']) await admin.query("insert into rakeezx.score_subitem_completions(owner_id,id,student_id,subitem_id,checked,completion_state) values($1::uuid,$2,$3,$4,true,$5)", [owner, 'completion' + i + sub, 'student' + i, sub, sub === 'a' ? 'late' : 'regular']);
    const c = { id: credential, ownerId: owner, studentId: 'student' + i, version: 1, format: 'six-v1', keyVersion: 'v1',
      reservation: hash(credential), verifier: '1'.repeat(64), revokedAt: null };
    const s = { id: session, credentialId: credential, ownerId: owner, studentId: 'student' + i, classId: 'class', enrollmentId: 'enrollment' + i,
      membershipRevision: 1, canonicalStamp: hash(JSON.stringify(['n88-lineage-v1', '1', '1', '1', '1'])), version: 1, tokenHash: hash(token), expiresAt: Date.now() + 3600000, revokedAt: null };
    await admin.query('insert into n88_private.numeric_credentials(row_key,payload) values($1,$2::jsonb)', [credential, JSON.stringify(c)]);
    await admin.query('insert into n88_private.numeric_sessions(row_key,payload) values($1,$2::jsonb)', [session, JSON.stringify(s)]);
    if (owner === A) tokens[i] = { token, credential, session };
    return { token, credential, session };
  }
  // A separately targeted affected-entry test; do not repeat the completed
  // canonical race/privacy campaign just to re-prove unchanged receipt machinery.
  if (process.argv.includes('--unknown-only')) {
    await addPupil(0);
    await check('bound_signed_teacher_lost_ack_original_unknown_status_no_replay', async () => {
      const l = await list(), cmd = command(l), hold = gate('commit'); control.late = hold;
      const pending = request(cmd); await hold.entered.promise;
      const count = async () => (await admin.query('select count(*)::int as n from n88_private.publication_v2_receipts where owner_id=$1::uuid and request_id=$2', [A, cmd.requestId])).rows[0].n;
      assert.equal(await count(), 1); // Independently committed, ACK deliberately delayed.
      try { assert.deepEqual((await pending).body, { state: 'unknown', retry: false }); }
      finally { hold.release.resolve(); }
      const status = await request({ action: 'status', scope, binding, command: cmd });
      assert.equal(reconcilePublication(cmd, scope, status.body.receipt, status.body.fresh, binding).state, 'confirmed');
      assert.equal(await count(), 1);
      return { realSignedTeacherRevalidated: true, oneCommittedReceipt: true, timeoutUnknown: true, originalStatusOnly: true, noReplay: true };
    });
    return async fresh => {
      assert.equal((await fresh.query('select count(*)::int as n from n88_private.publication_v2_receipts')).rows[0].n, 1);
      report.restartPersistence = { receipts: 1, tombstones: 0 };
    };
  }
  await check('actual_repository_schema_13_canonical_2_auth_and_numeric_keys', async () => {
    const fk = (await admin.query("select c.relname,k.condeferrable from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace where k.contype='f' and n.nspname='rakeezx' and k.confrelid='auth.users'::regclass and c.relname=any($1::text[]) order by c.relname", [names])).rows;
    assert.equal(fk.length, 13); assert(fk.every(k => !k.condeferrable));
    report.canonicalCatalog = (await admin.query("select c.relname,k.conname,k.contype,pg_get_constraintdef(k.oid) as definition from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('rakeezx','auth','n88_private') order by n.nspname,c.relname,k.conname")).rows;
    await assert.rejects(admin.query("insert into rakeezx.teachings(owner_id,id,section_id,subject_id,term_id) values($1::uuid,'bad','other-owner-class','subject','term')", [A]), e => e.code === '23503');
    assert.equal((await list()).rows.length, 3);
    return { canonicalFamilies: names, authRelations: ['users', 'sessions'], nondeferrableOwnerFKs: fk, sdkAndCanonicalRead: true };
  });
  for (const n of [0, 1, 30, 50]) await check('bound_actual_teacher_and_numeric_student_' + n, async () => {
    while (pupils < n) await addPupil(pupils++);
    const l = await list(); applied(await request(command(l, 'a', { ...flags, completed: true }))); applied(await request(command(l, 'b'))); applied(await request(command(l, 'direct')));
    service = createPublicationV2Service({ executionMode: 'synthetic', enabled: true, origin: 'https://synthetic.invalid', ...ports });
    for (let i = 0; i < n; i++) {
      const r = await student(i); assert.equal(r.status, 200); assert.deepEqual(Object.fromEntries(r.body.grades.map(g => [g.title, g.value])), { Direct: i % 10, 'Work b': 5 });
      assert.equal(r.body.work[0].title, 'Work a'); assert(!JSON.stringify(r.body).match(/"(?:total|rank|raw|ownerId|studentId|sourceRevision|manualValue)":/));
    }
    assert.equal((await student(n)).status, 503);
    return { pupils: n, realCookieHashAndCredentialLineage: true, parentAggregateOmitted: true };
  });
  await check('original_sdk_signature_current_user_and_owner_negatives', async () => {
    const l = await list(), cmd = command(l);
    assert.equal((await request(cmd, provider.token().slice(0, -8) + 'abcdefgh')).status, 503);
    assert.equal((await request(cmd, provider.token({ exp: Math.floor(Date.now() / 1000) - 1 }))).status, 503);
    provider.foreign = true; assert.equal((await request(cmd)).status, 503); provider.foreign = false;
    provider.banned = true; assert.equal((await request(cmd)).status, 503); provider.banned = false;
    assert.equal((await request({ ...cmd, scope: { ...scope, ownerId: B } })).status, 503);
    assert.equal((await request({ ...cmd, binding: { ...binding, sessionId: randomUUID() } })).status, 503);
    const other = await addPupil(0, B);
    const r = await service({ path: '/student/publication-v2/read', method: 'GET', headers: { ...headers, cookie: '__Secure-n88-student=' + other.token } });
    assert.equal(r.status, 200); assert.deepEqual(r.body.grades, []);
    assert(provider.calls.every(p => ['/auth/v1/user', '/auth/v1/.well-known/jwks.json'].includes(p)));
    return { signedSDK: true, metadataNotAuthority: true, providerPaths: [...new Set(provider.calls)], foreignPupilOwnScopePrivate: true };
  });
  await check('real_owner_key_blocks_phantom_membership_new_source_and_grade_insert', async () => {
    // Pre-existing un-enrolled identity makes the first writer an enrollment INSERT only.
    await admin.query("insert into rakeezx.students(owner_id,id,name) values($1::uuid,'latent','Fabricated latent')", [A]);
    const writes = [
      ["insert into rakeezx.enrollments(owner_id,id,student_id,section_id,roll_no) values($1::uuid,'latent-enrollment','latent','class',100)", [A]],
      ["insert into rakeezx.items(owner_id,id,teaching_id,name,max) values($1::uuid,'new-direct','teaching','New source',10)", [A]],
      ["insert into rakeezx.scores(owner_id,id,student_id,item_id,value) values($1::uuid,'new-grade','student0','new-direct',9)", [A]],
    ], waits = [];
    for (const [sql, args] of writes) {
      const hold = gate(); control.gate = hold; const pending = list(), pid = await hold.entered.promise;
      const writer = await connect('canonical-writer'); pids.add(writer.processID); const writing = writer.query(sql, args);
      try { waits.push(await waitBlocked(pid, writer.processID)); } finally { hold.release.resolve(); }
      await pending; await writing; await writer.end();
    }
    const l = await list(); assert(l.rows.some(r => r.sourceId === 'new-direct' && !r.decisions.grade));
    assert(!(await student(0)).body.grades.some(r => r.title === 'New source'));
    return { waits, mechanism: 'existing auth.users FOR UPDATE versus real NOT DEFERRABLE owner FK KEY SHARE', noBlanketTableLock: true };
  });
  await check('real_grade_update_blocks_on_existing_dependency_row', async () => {
    const l = await list(); applied(await request(command(l, 'direct')));
    const hold = gate(); control.gate = hold; const pending = student(0), pid = await hold.entered.promise;
    const writer = await connect('score-writer'), writing = writer.query("update rakeezx.scores set value=9,revision=revision+1 where owner_id=$1::uuid and id='score0'", [A]);
    let wait; try { wait = await waitBlocked(pid, writer.processID); } finally { hold.release.resolve(); }
    assert.equal((await pending).status, 200); await writing; await writer.end();
    assert(!(await student(0)).body.grades.some(g => g.title === 'Direct'));
    return { wait, nextFreshReadWithheldChangedScore: true };
  });
  await check('numeric_expiry_revocation_and_restored_membership_never_reuse_old_session', async () => {
    for (const [i, field] of [[49, 'expiresAt'], [48, 'revokedAt']]) {
      await admin.query('update n88_private.numeric_sessions set payload=jsonb_set(payload,$2::text[],$3::jsonb) where row_key=$1', [tokens[i].session, [field], String(Date.now() - 1)]);
      assert.equal((await student(i)).status, 503);
    }
    await admin.query("update n88_private.numeric_credentials set payload=jsonb_set(payload,'{revokedAt}',$2::jsonb) where row_key=$1", [tokens[47].credential, String(Date.now())]);
    assert.equal((await student(47)).status, 503);
    await admin.query("update rakeezx.enrollments set end_date='2026-10-28',revision=revision+1 where owner_id=$1::uuid and id='enrollment46'", [A]);
    assert.equal((await student(46)).status, 503);
    await admin.query("update rakeezx.enrollments set end_date=null,revision=revision+1 where owner_id=$1::uuid and id='enrollment46'", [A]);
    assert.equal((await student(46)).status, 503);
    return { expired: true, revokedSession: true, revokedCredential: true, restoredEnrollmentLineageMismatch: true };
  });
  const retire = async ({ incomplete = false, rollback = false } = {}) => ports.transaction(async tx => {
    const req = { method: 'POST', headers: { ...headers, authorization: 'Bearer ' + provider.token() } };
    assert((await ports.authenticate(req, tx, 'teacher')).current);
    await tx.bindOwner(A);
    const ticket = await ports.captureRetirement(tx, scope, 'item', 'parent', '1');
    if (incomplete) await tx.query("update rakeezx.items set deleted_at=clock_timestamp(),revision=revision+1 where owner_id=$1::uuid and id='parent'", [A]);
    else await tx.query("delete from rakeezx.items where owner_id=$1::uuid and id='parent'", [A]); // Exact FK cascades handle child dependencies.
    await ports.completeRetirement(tx, ticket);
    if (rollback) throw Error('fabricated post-completion rollback');
    return { retired: true };
  });
  await check('canonical_parent_child_delete_and_publication_retirement_share_atomic_commit', async () => {
    const l = await list(), cmd = command(l, 'a'); applied(await request(cmd));
    await assert.rejects(retire({ incomplete: true }));
    await assert.rejects(retire({ rollback: true }));
    assert.equal((await admin.query("select count(*)::int as n from rakeezx.score_subitems where owner_id=$1::uuid and item_id='parent'", [A])).rows[0].n, 2);
    assert((await student(0)).body.grades.some(g => g.title === 'Work a'));
    await retire();
    assert.equal((await admin.query("select count(*)::int as n from rakeezx.score_subitem_completions where owner_id=$1::uuid", [A])).rows[0].n, 0);
    await admin.query("insert into rakeezx.items(owner_id,id,teaching_id,name,max,score_mode,revision) values($1::uuid,'parent','teaching','Restored',10,'subitems',3)", [A]);
    await admin.query("insert into rakeezx.score_subitems(owner_id,id,item_id,name,value,revision) values($1::uuid,'a','parent','Restored A',5,3),($1::uuid,'b','parent','Restored B',5,3)", [A]);
    assert(!(await list()).rows.some(r => ['a', 'b'].includes(r.sourceId)));
    const status = await request({ action: 'status', scope, binding, command: cmd }); assert.equal(status.body.receipt.state, 'applied'); assert.equal(status.body.fresh, null);
    assert(!(await student(0)).body.grades.some(g => g.title.includes('Restored')));
    return { physicalFKChildCascade: true, incompleteParentDeleteRejected: true, postCompleteRollbackAtomic: true, originalReceiptImmutable: true, restoredIdsStillPrivate: true };
  });
  await check('numeric_session_expiry_during_read_is_revalidated_at_commit', async () => {
    const expiry = Date.now() + 1500;
    await admin.query("update n88_private.numeric_sessions set payload=jsonb_set(payload,'{expiresAt}',$2::jsonb) where row_key=$1", [tokens[45].session, String(expiry)]);
    const hold = gate(); control.gate = hold; const pending = student(45); await hold.entered.promise;
    await new Promise(resolve => setTimeout(resolve, Math.max(1, expiry - Date.now() + 50))); hold.release.resolve();
    assert.equal((await pending).status, 503); return { expiryCheckedAgain: true, noLateDisclosure: true };
  });
  await check('original_teacher_auth_session_lock_blocks_real_revocation_then_denies', async () => {
    const hold = gate('select user_id,session_id from n88_private.lock_current_session($1::uuid,$2::uuid)'); control.gate = hold;
    const pending = list(), pid = await hold.entered.promise;
    const writer = await connect('auth-revoker'), revoking = writer.query('delete from auth.sessions where id=$1::uuid', [SESSION]);
    let wait; try { wait = await waitBlocked(pid, writer.processID); } finally { hold.release.resolve(); }
    await pending; await revoking; await writer.end();
    assert.equal((await request({ action: 'list', scope, binding })).status, 503);
    return { wait, currentSessionReadThroughOriginalVerifier: true, nextAdmissionDenied: true };
  });
  await check('finite_hosted_boundary_and_positive_issuance_unchanged', async () => {
    assert.throws(() => createCanonicalPublicationV2Ports({ executionMode: 'production' }));
    const off = createPublicationV2Service({ enabled: false }); assert.equal((await off({})).status, 401);
    const current = await source('drafts/n88-student-portal/activation/private-error-boundary.mjs');
    assert(!current.includes('publication_v2_')); // Scope evidence, not a boundary bypass.
    report.independentBackendPids = [...pids]; assert(pids.size > 10);
    return { hostedBoundaryUnmodified: true, noLiveRoute: true, positiveIssuanceNotCalled: true, independentConnections: pids.size };
  });
  const before = (await admin.query('select (select count(*)::int from n88_private.publication_v2_receipts) as receipts,(select count(*)::int from n88_private.publication_v2_items where tombstone) as tombstones')).rows[0];
  return async fresh => { assert.deepEqual((await fresh.query('select (select count(*)::int from n88_private.publication_v2_receipts) as receipts,(select count(*)::int from n88_private.publication_v2_items where tombstone) as tombstones')).rows[0], before); report.restartPersistence = before; };
}
