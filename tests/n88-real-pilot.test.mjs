import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createFixture } from './fixtures/n88-real-pilot/fixture.mjs';
import { POLICY, hash } from '../drafts/n88-student-portal/service.mjs';
import { createPortalService } from '../drafts/n88-student-portal/service.mjs';
import { takeInviteFragment } from '../src/lib/student-portal-client.js';
const issue = (f, member = f.member, extra = {}) => f.request('/teacher/issue', { body: member, ...extra });
const claim = (f, token, extra = {}) => f.request('/claim', { body: { token }, ...extra });
const read = (f, cookie, extra = {}) => f.request('/read', { method: 'GET', cookie, ...extra });
const session = r => r.headers['Set-Cookie'].split(';')[0];
const deny = r => { assert.equal(r.status, 401); assert.deepEqual(r.body, { error: 'unavailable' }); };

test('verified current teacher, exact member/revision; foreign, stale, refused and metadata spoof fail', async () => {
  const f = createFixture();
  deny(await issue(f, f.foreign));
  deny(await issue(f, { ...f.member, revision: 6 }));
  deny(await issue(f, f.member, { teacher: 'unknown' }));
  deny(await issue(f, f.member, { teacher: 'fabricated-teacher-b' }));
  f.auth.get('fabricated-teacher-a').current = false;
  deny(await issue(f, { ...f.member, ownerId: 'owner-b', user_metadata: { ownerId: 'owner-a' } }));
  f.auth.get('fabricated-teacher-a').current = true;
  const result = await issue(f, { ...f.member, ownerId: 'owner-b', studentId: 'foreign-student' });
  assert.equal(result.status, 200);
  assert.equal(f.repo.snapshot().invites[0].ownerId, 'owner-a');
  assert.equal(f.repo.snapshot().invites[0].studentId, 'student-a', 'client ids never select another student');
  await f.repo.transaction(db => { db.memberships[0].status = 'ended'; });
  deny(await claim(f, result.body.token)); deny(await issue(f));
});
test('256-bit random secret, hash-only state; secure cookie never returned as JSON; no raw auth data', async () => {
  const f = createFixture(), a = await issue(f), b = await issue(f);
  assert.match(b.body.token, /^[A-Za-z0-9_-]{43}$/); assert.notEqual(a.body.token, b.body.token);
  assert.equal(b.body.expiresAt, f.now() + POLICY.inviteMs);
  const state = JSON.stringify(f.repo.snapshot()); assert.ok(!state.includes(b.body.token));
  assert.ok(state.includes(hash(b.body.token)));
  const c = await claim(f, b.body.token);
  assert.deepEqual(c.body, { claimed: true });
  assert.match(c.headers['Set-Cookie'], /^__Host-n88=.*; Path=\/; HttpOnly; Secure; SameSite=Strict; Max-Age=28800$/);
  assert.ok(!JSON.stringify(f.repo.snapshot()).includes(session(c).split('=')[1]));
  assert.equal(c.headers['Cache-Control'], 'no-store, private');
  assert.equal(c.headers['Referrer-Policy'], 'no-referrer');
  assert.match(c.headers['X-Robots-Tag'], /noindex/);
});
test('real simultaneous service calls: exactly one session under one-process mutex; replay denied', async () => {
  const f = createFixture(), i = await issue(f);
  const results = await Promise.all(Array.from({ length: 20 }, (_, n) => claim(f, i.body.token, { sourceKey: 'racer-' + n })));
  assert.equal(results.filter(r => r.status === 200).length, 1);
  assert.equal(f.repo.snapshot().sessions.length, 1);
  results.filter(r => r.status !== 200).forEach(deny);
  deny(await claim(f, i.body.token));
});
test('concurrent reissues leave one current invite; revoke/claim contention cannot retain access', async () => {
  const f = createFixture();
  const issued = await Promise.all([issue(f), issue(f)]);
  assert.equal(f.repo.snapshot().invites.filter(i => i.revokedAt == null).length, 1);
  deny(await claim(f, issued[0].body.token));
  const [claimed] = await Promise.all([claim(f, issued[1].body.token), f.request('/teacher/revoke', { body: f.member })]);
  assert.equal(claimed.status, 200); deny(await read(f, session(claimed)));
});
test('expiry, revoke before/after claim, reissue, enrollment end/revision and owner/class context changes', async () => {
  for (const mutation of ['expiry', 'revoke', 'reissue', 'end', 'revision', 'owner', 'class', 'studentInactive', 'classInactive']) {
    const f = createFixture(), i = await issue(f), c = await claim(f, i.body.token), ck = session(c);
    if (mutation === 'expiry') f.advance(POLICY.sessionMs);
    if (mutation === 'revoke') assert.equal((await f.request('/teacher/revoke', { body: f.member })).status, 200);
    if (mutation === 'reissue') { const next = await issue(f); assert.equal(next.status, 200); deny(await claim(f, i.body.token)); }
    if (mutation === 'end') await f.repo.transaction(db => { db.memberships[0].endDate = '2026-10-17'; });
    if (mutation === 'revision') await f.repo.transaction(db => { db.memberships[0].revision++; });
    if (mutation === 'owner') await f.repo.transaction(db => { db.memberships[0].ownerId = 'other-owner'; });
    if (mutation === 'class') await f.repo.transaction(db => { db.memberships[0].classId = 'other-class'; });
    if (mutation === 'studentInactive') await f.repo.transaction(db => { db.memberships[0].studentActive = false; });
    if (mutation === 'classInactive') await f.repo.transaction(db => { db.memberships[0].classActive = false; });
    deny(await read(f, ck));
  }
  for (const kind of ['expired', 'revoked']) {
    const f = createFixture(), i = await issue(f);
    if (kind === 'expired') f.advance(POLICY.inviteMs);
    else await f.request('/teacher/revoke', { body: f.member });
    deny(await claim(f, i.body.token));
  }
});
test('minimal projection, default-off grades, exact student/owner, unpublish, explicit published result only', async () => {
  const f = createFixture(), i = await issue(f), c = await claim(f, i.body.token), ck = session(c);
  const data = (await read(f, ck)).body;
  assert.deepEqual(Object.keys(data).sort(), ['progress', 'tasks']);
  assert.deepEqual(data.progress, { completed: 1, total: 2 });
  assert.deepEqual(Object.keys(data.tasks[0]).sort(), ['deadline', 'id', 'instruction', 'status', 'title']);
  assert.doesNotMatch(JSON.stringify(data), /PRIVATE|OTHER|UNPUBLISHED|ownerId|studentId|result|attendance|label/);
  await f.repo.transaction(db => { db.publications[0].resultPublished = true; });
  assert.deepEqual((await read(f, ck)).body.tasks.find(t => t.id === 'published-a').result, { value: 8, max: 10 });
  await f.repo.transaction(db => { db.publications.forEach(p => { if (p.studentId === 'student-a') p.published = false; }); });
  assert.deepEqual((await read(f, ck)).body, { tasks: [], progress: { completed: 0, total: 0 } });
});
test('student context replacement revokes former cookie; logout and stale async auth are refused', async () => {
  const f = createFixture(), a = await issue(f), first = await claim(f, a.body.token), ck = session(first);
  const b = await issue(f, f.other), second = await claim(f, b.body.token, { cookie: ck });
  assert.equal(second.status, 200); deny(await read(f, ck));
  assert.ok((await read(f, session(second))).body.tasks.some(t => t.title === 'OTHER_STUDENT'));
  assert.equal((await f.request('/logout', { cookie: session(second) })).status, 200);
  deny(await read(f, session(second)));
  const hold = f.repo.transaction(async () => { await new Promise(resolve => setImmediate(resolve)); f.auth.delete('fabricated-teacher-a'); });
  const stale = issue(f); await hold; deny(await stale);
});
test('failed new-student claim also retires old session, never falls back to prior student', async () => {
  const f = createFixture(), a = await issue(f), c = await claim(f, a.body.token), ck = session(c);
  const failure = await claim(f, 'z'.repeat(43), { cookie: ck });
  deny(failure); assert.match(failure.headers['Set-Cookie'], /Max-Age=0$/);
  deny(await read(f, ck));
});
test('CSRF, request methods, generic failures, bounded source/token rates, retention and rollback', async () => {
  const f = createFixture();
  for (const headers of [{ origin: 'https://evil.invalid' }, { 'x-n88-csrf': '' }, { 'content-type': 'text/plain' }, { 'sec-fetch-site': 'cross-site' }]) deny(await issue(f, f.member, { headers }));
  deny(await claim(f, '123456')); deny(await claim(f, 'a'.repeat(43)));
  const i = await issue(f), c = await claim(f, i.body.token), ck = session(c);
  deny(await f.request('/submit', { cookie: ck }));
  deny(await f.request('/read', { cookie: ck, method: 'POST' }));
  for (let n = 0; n < POLICY.rateLimit; n++) await read(f, ck, { sourceKey: 'limited' });
  deny(await read(f, ck, { sourceKey: 'limited' }));
  assert.ok(f.repo.snapshot().rates.every(r => r.count <= POLICY.rateLimit + 1));
  const before = f.repo.snapshot();
  await assert.rejects(f.repo.transaction(db => { db.invites = []; throw Error('rollback'); }));
  assert.deepEqual(f.repo.snapshot(), before);
  f.advance(POLICY.sessionMs + POLICY.retentionMs);
  deny(await read(f, ck));
  assert.equal(f.repo.snapshot().invites.length, 0); assert.equal(f.repo.snapshot().sessions.length, 0);
  assert.ok(f.repo.snapshot().rates.length <= 1);
  await f.repo.transaction(db => { db.rates = Array.from({ length: POLICY.maxRateKeys }, (_, n) => ({ key: 'fabricated-' + n, count: 0, until: f.now() + POLICY.rateWindowMs })); });
  deny(await read(f, ck)); assert.equal(f.repo.snapshot().rates.length, POLICY.maxRateKeys);
});
test('repository/auth errors fail generically without exception/auth/token leakage', async () => {
  const unavailable = createPortalService({ repository: { async transaction() { throw Error('PRIVATE_BACKEND_DETAIL'); } },
    origin: 'https://pilot.invalid', verifyTeacher: async () => null });
  const result = await unavailable({});
  assert.equal(result.status, 503); assert.deepEqual(result.body, { error: 'unavailable' });
  assert.equal(result.headers['Cache-Control'], 'no-store, private');
});
test('fragment is removed before claim, full entropy only; no query retained', () => {
  let removed = false;
  const token = takeInviteFragment({ hash: '#invite=' + 'a'.repeat(43), pathname: '/student', search: '?bad=secret' },
    { replaceState(a, b, path) { assert.equal(path, '/student'); removed = true; } });
  assert.ok(removed); assert.equal(token.length, 43);
  assert.equal(takeInviteFragment({ hash: '#invite=123456', pathname: '/student' }, { replaceState() {} }), '');
});
test('inert production graph, accepted demo untouched; no registration/network/store dependencies', async () => {
  const forbiddenImports = /(?:student-portal-client|views\/student-portal|n88-student-portal)/;
  async function files(dir) { return (await Promise.all((await readdir(dir, { withFileTypes: true })).map(e => e.isDirectory() ? files(dir + '/' + e.name) : [dir + '/' + e.name]))).flat(); }
  for (const file of ['index.html', 'sw.js', ...await files('src')]) {
    if (['src/lib/student-portal-client.js', 'src/views/student-portal.js'].includes(file)) continue;
    if (/\.(js|html|css)$/.test(file)) assert.doesNotMatch(await readFile(file, 'utf8'), forbiddenImports, file);
  }
  for (const file of ['src/lib/student-portal-client.js', 'src/views/student-portal.js', 'drafts/n88-student-portal/teacher-controller.js']) {
    assert.doesNotMatch(await readFile(file, 'utf8'), /localStorage|sessionStorage|indexedDB|serviceWorker|cloud\.js|store\.js|node:crypto|user_metadata/);
  }
  const sql = await readFile('drafts/n88-student-portal/schema-proposal.sql', 'utf8');
  assert.match(sql, /token_hash text not null unique/); assert.match(sql, /invite_id uuid not null unique/);
  assert.match(sql, /security definer set search_path = ''/); assert.match(sql, /revoke all on function/);
});
