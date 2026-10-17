// AI: affected synthetic service + inert graph checks. NOT hosted SQL/RLS proof.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createHmac } from 'node:crypto';
import { createFixture } from './fixtures/n88-real-pilot/fixture.mjs';
import { POLICY, generateCode, hash } from '../drafts/n88-student-portal/service.mjs';
const entries = new WeakMap();
const entry = (f, member = f.member) => entries.get(f)?.get(member.enrollmentId) || 'x'.repeat(43);
const issue = async (f, member = f.member, extra = {}) => {
  const r = await f.request('/teacher/issue', { body: member, ...extra });
  if (r.status === 200) { if (!entries.has(f)) entries.set(f, new Map()); entries.get(f).set(member.enrollmentId, r.body.entrySecret); }
  return r;
};
const login = (f, code, extra = {}) => f.request('/s/' + (extra.entrySecret || entry(f)) + '/claim', { body: { code }, ...extra });
const read = (f, cookie, extra = {}) => f.request('/s/' + (extra.entrySecret || entry(f)) + '/read', { method: 'GET', cookie, ...extra });
const session = r => r.headers['Set-Cookie'].split(';')[0];
const deny = r => { assert.equal(r.status, 401); assert.deepEqual(r.body, { error: 'unavailable' }); };

test('final generator boundaries, no padding, invalid formats and Arabic/Persian equivalents', async () => {
  for (const boundary of [1000, 9999]) {
    assert.equal(generateCode((min, max) => { assert.equal(min, 1000); assert.equal(max, 10000); return boundary; }), String(boundary));
    const f = createFixture(undefined, { newCode: () => generateCode(() => boundary) });
    const issued = await issue(f); assert.equal(issued.body.code, String(boundary));
    for (const alphabet of ['٠١٢٣٤٥٦٧٨٩', '۰۱۲۳۴۵۶۷۸۹'])
      assert.equal((await login(f, String(boundary).replace(/[0-9]/g, d => alphabet[Number(d)]))).status, 200);
  }
  for (const code of ['0007','0074','0000','999','10000',' 1000','1000 ',1000,'٠٠٠٧']) {
    const f = createFixture(undefined, { newCode: () => '1000' }); await issue(f);
    deny(await login(f, code));
    assert.equal(f.repo.snapshot().sessions.length, 0);
    const g = createFixture(undefined, { newCode: () => code });
    assert.equal((await issue(g)).status, 503); assert.equal(g.repo.snapshot().credentials.length, 0);
  }
  // No requested pattern exclusions; repeated digits are legitimate.
  const f = createFixture(undefined, { newCode: () => '1111' });
  assert.equal((await issue(f)).body.code, '1111');
});

test('stable owner/student code and private bookmark survive verified second term; old scope never follows', async () => {
  const f = createFixture(), issued = await issue(f), code = issued.body.code, bookmark = issued.body.entrySecret;
  const old = session(await login(f, code)), oldSecond = session(await login(f, code));
  const credential = f.repo.snapshot().credentials[0];
  const next = await f.advanceToSecondTerm();
  deny(await read(f, old)); // still unexpired, but scope no longer current
  assert.deepEqual(f.repo.snapshot().credentials[0], credential);
  assert.equal(entry(f), bookmark);
  const fresh = session(await login(f, code));
  const data = (await read(f, fresh)).body;
  assert.deepEqual(data.tasks.map(t => t.id), ['term2-a']);
  assert.deepEqual(data.progress, { completed: 0, total: 1 });
  assert.doesNotMatch(JSON.stringify(data), /الأمان|PRIVATE|OTHER|UNPUBLISHED|result|attendance|studentId/);
  f.advance(POLICY.sessionMs + 1); deny(await read(f, fresh));
  const renewed = session(await login(f, code)); assert.equal((await read(f, renewed)).status, 200);
  // Simple revision update invalidates session only, never rotates the credential.
  await f.repo.transaction(db => { db.memberships.find(m => m.enrollmentId === next.enrollmentId).revision++; });
  deny(await read(f, renewed)); assert.equal((await login(f, code)).status, 200);
  assert.deepEqual(f.repo.snapshot().credentials[0], credential);
  next.revision++;
  // Teacher authority on NEW enrollment rotates stable credential and all old-term sessions.
  const rotated = await issue(f, next);
  assert.equal(rotated.status, 200); assert.notEqual(rotated.body.entrySecret, bookmark);
  assert.ok(f.repo.snapshot().sessions.every(s => s.credentialId !== credential.id || s.revokedAt != null));
  deny(await read(f, oldSecond, { entrySecret: bookmark }));
  deny(await login(f, rotated.body.code, { entrySecret: bookmark }));
  deny(await login(f, code, { entrySecret: rotated.body.entrySecret }));
  const current = session(await login(f, rotated.body.code, { entrySecret: rotated.body.entrySecret }));
  assert.equal((await f.request('/teacher/revoke', { body: next })).status, 200);
  deny(await read(f, current, { entrySecret: rotated.body.entrySecret }));
});

test('new-term teacher rotate/revoke retires every unexpired session across both term scopes', async () => {
  for (const action of ['issue', 'revoke']) {
    const codes = ['1000','1001'], f = createFixture(undefined, { newCode: () => codes.shift() });
    const issued = await issue(f), oldEntry = issued.body.entrySecret;
    const oldSessions = [session(await login(f, issued.body.code)), session(await login(f, issued.body.code))];
    const next = await f.advanceToSecondTerm();
    oldSessions.push(session(await login(f, issued.body.code)));
    assert.equal(f.repo.snapshot().sessions.length, 3);
    assert.ok(f.repo.snapshot().sessions.every(s => s.expiresAt > f.now() && s.revokedAt == null));
    const result = action === 'issue' ? await issue(f, next) : await f.request('/teacher/revoke', { body: next });
    assert.equal(result.status, 200);
    assert.equal(f.repo.snapshot().sessions.length, 3);
    assert.ok(f.repo.snapshot().sessions.every(s => s.revokedAt === f.now()));
    for (const cookie of oldSessions) deny(await read(f, cookie, { entrySecret: oldEntry }));
    deny(await login(f, issued.body.code, { entrySecret: oldEntry }));
  }
});

test('ended, ambiguous, name-clone/new-student/foreign-owner membership cannot carry identity', async () => {
  for (const mutation of [
    db => { db.memberships[0].status = 'ended'; },
    db => { db.memberships.push({ ...db.memberships[0], enrollmentId: 'second-active', classId: 'ambiguous' }); },
    db => { db.memberships[0].status = 'ended'; db.memberships.push({ ...db.memberships[1], studentId: 'name-clone', enrollmentId: 'name-clone-enrollment', label: db.memberships[0].label }); },
    db => { db.memberships[0].status = 'ended'; db.memberships.push({ ...db.memberships[0], status: 'active', ownerId: 'owner-b' }); },
    db => { db.memberships[0].studentId = 'replacement-with-same-name'; }
  ]) {
    const f = createFixture(), code = (await issue(f)).body.code, cookie = session(await login(f, code));
    await f.repo.transaction(mutation);
    const before = f.repo.snapshot();
    deny(await read(f, cookie)); deny(await login(f, code));
    assert.deepEqual(f.repo.snapshot().memberships, before.memberships);
    assert.deepEqual(f.repo.snapshot().publications, before.publications);
    assert.deepEqual(f.repo.snapshot().credentials, before.credentials);
  }
  // Ambiguity after a verified new-term session also denies; never union publications.
  const f = createFixture(), code = (await issue(f)).body.code;
  const next = await f.advanceToSecondTerm(), cookie = session(await login(f, code));
  await f.repo.transaction(db => db.memberships.push({ ...next, enrollmentId: 'ambiguous-term2' }));
  deny(await read(f, cookie)); deny(await login(f, code));
});
test('private individual entry never resolves another valid student PIN or public teacher context', async () => {
  const values = ['1007','1008','1009'];
  const f = createFixture(undefined, { newCode: () => values.shift() });
  const a = await issue(f), b = await issue(f, f.other);
  assert.notEqual(a.body.entrySecret, b.body.entrySecret);
  deny(await login(f, b.body.code));
  deny(await login(f, a.body.code, { entrySecret: b.body.entrySecret }));
  deny(await login(f, a.body.code, { entrySecret: f.namespace }));
  deny(await login(f, a.body.code, { entrySecret: f.member.enrollmentId }));
  const aSession = session(await login(f, a.body.code));
  const bSession = session(await login(f, b.body.code, { entrySecret: b.body.entrySecret }));
  deny(await read(f, aSession, { entrySecret: b.body.entrySecret }));
  deny(await read(f, bSession));
  assert.match(JSON.stringify((await read(f, aSession)).body), /الأمان الرقمي/);
  assert.match(JSON.stringify((await read(f, bSession, { entrySecret: b.body.entrySecret })).body), /OTHER_STUDENT/);
  const rotated = await issue(f);
  f.advance(POLICY.rateWindowMs); // separate rotation assertions from the admission-limit scenario
  for (const code of [a.body.code, rotated.body.code]) deny(await login(f, code, { entrySecret: a.body.entrySecret }));
  deny(await read(f, aSession, { entrySecret: a.body.entrySecret }));
  deny(await login(f, a.body.code));
  assert.equal((await login(f, rotated.body.code)).status, 200);
  const serialized = JSON.stringify(f.repo.snapshot());
  for (const r of [a,b,rotated]) assert.ok(!serialized.includes(r.body.entrySecret));
  const listing = JSON.stringify((await f.request('/teacher/students', { method: 'GET' })).body);
  for (const r of [a,b,rotated]) assert.ok(!listing.includes(r.body.entrySecret));
});
test('atomic same-owner collision retry, 128-attempt rollback, full 9000-value exhaustion', async () => {
  let calls = 0;
  const f = createFixture(undefined, { newCode: () => ++calls <= 2 ? '1007' : '1008' });
  const [a,b] = await Promise.all([issue(f), issue(f, f.other)]);
  assert.equal(calls, 3); assert.equal(a.body.code, '1007'); assert.equal(b.body.code, '1008');
  let tries = 0;
  const secretKey = Buffer.alloc(32, 23); // fabricated test key, never a hosting key
  const g = createFixture(undefined, { secretKey, newCode: () => { tries++; return '1000'; } });
  const first = await issue(g); assert.equal(first.body.code, '1000');
  const cookie = session(await login(g, first.body.code));
  let before = g.repo.snapshot(); tries = 0;
  const collision = await issue(g); assert.equal(collision.status, 503); assert.deepEqual(collision.body, { error: 'unavailable' });
  assert.equal(tries, 128); assert.deepEqual(g.repo.snapshot(), before);
  assert.equal((await read(g, cookie)).status, 200);
  await g.repo.transaction(db => { for (let n = 1001; n < 10000; n++) db.credentials.push({
    namespace: g.namespace, verifier: createHmac('sha256', secretKey).update(JSON.stringify(['n88-v2','code',g.namespace,String(n)])).digest('hex'),
    revokedAt: 1, version: 1, id: 'reserved-' + n }); });
  before = g.repo.snapshot(); tries = 0;
  const exhausted = await issue(g, g.other); assert.equal(exhausted.status, 503); assert.deepEqual(exhausted.body, collision.body);
  assert.equal(tries, 128); assert.deepEqual(g.repo.snapshot(), before);
  assert.equal((await login(g, first.body.code)).status, 200);
});
test('persistent four ASCII digits, no leading zero, collision retry, atomic rotation, hashed-only', async () => {
  for (let n = 0; n < 100; n++) assert.match(generateCode(), /^[1-9][0-9]{3}$/);
  const values = ['1007', '1007', '1008', '1007', '1008', '1009'];
  const f = createFixture(undefined, { newCode: () => values.shift() });
  const a = await issue(f), b = await issue(f, f.other), rotated = await issue(f);
  assert.equal(a.body.code, '1007'); assert.equal(b.body.code, '1008'); assert.equal(rotated.body.code, '1009');
  assert.equal(f.repo.snapshot().credentials.filter(c => c.revokedAt == null).length, 2);
  const state = JSON.stringify(f.repo.snapshot());
  for (const r of [a,b,rotated]) { assert.match(r.body.entrySecret, /^[A-Za-z0-9_-]{43}$/); assert.ok(!state.includes(r.body.entrySecret)); }
  for (const c of f.repo.snapshot().credentials) {
    assert.deepEqual(Object.keys(c).sort(), ['id','ownerId','studentId','namespace','verifier','entryVerifier','version','revokedAt'].sort());
    assert.match(c.verifier, /^[a-f0-9]{64}$/); assert.match(c.entryVerifier, /^[a-f0-9]{64}$/);
  }
  // A random HMAC can coincidentally contain a four-character PIN substring;
  // verify the stored schema and cryptographic verifier, not substring absence.
  for (const value of ['1007','1008','1009']) assert.ok(!state.includes(hash(value)));
  assert.ok(!state.includes('expiresAt')); assert.ok(!state.includes('consumedAt'));
  assert.ok(!JSON.stringify((await f.request('/teacher/students', { method: 'GET' })).body).includes('1009'));
});
test('same code separate sessions, beyond old 15m, expired session relogin, logout preserves code', async () => {
  const f = createFixture(), code = (await issue(f)).body.code;
  const a = await login(f, code), b = await login(f, code);
  assert.notEqual(session(a), session(b));
  f.advance(16 * 60_000); assert.equal((await login(f, code)).status, 200);
  assert.equal((await read(f, session(a))).status, 200);
  f.advance(POLICY.sessionMs); deny(await read(f, session(a)));
  const c = await login(f, code); assert.equal(c.status, 200);
  assert.equal((await f.request('/s/' + entry(f) + '/logout', { cookie: session(c) })).status, 200);
  deny(await read(f, session(c))); assert.equal((await login(f, code)).status, 200);
  assert.match(a.headers['Set-Cookie'], new RegExp(`^__Secure-n88=.*; Path=/api/n88/s/${entry(f)}; HttpOnly; Secure; SameSite=Strict; Max-Age=28800$`));
});
test('rotate/revoke immediately refuse old code AND every existing session; race + rollback', async () => {
  const f = createFixture(); let code = (await issue(f)).body.code;
  const oldCode = code, sessions = await Promise.all([login(f, code), login(f, code)]);
  code = (await issue(f)).body.code;
  for (const s of sessions) deny(await read(f, session(s)));
  deny(await login(f, oldCode));
  const current = await login(f, code); assert.equal(current.status, 200);
  const [r] = await Promise.all([login(f, code), f.request('/teacher/revoke', { body: f.member })]);
  if (r.status === 200) deny(await read(f, session(r)));
  deny(await read(f, session(current))); deny(await login(f, code));
  const before = f.repo.snapshot();
  await assert.rejects(f.repo.transaction(db => { db.credentials = []; throw Error('rollback'); }));
  assert.deepEqual(f.repo.snapshot(), before);
});
test('same PIN other teacher only resolves scoped student; owner/member/version and no PII', async () => {
  const f = createFixture(undefined, { newCode: () => '1123' });
  const code = (await issue(f)).body.code;
  assert.equal((await issue(f, f.foreign, { teacher: 'fabricated-teacher-b' })).status, 200);
  const a = await login(f, code), b = await login(f, code, { entrySecret: entry(f, f.foreign) });
  const aData = await read(f, session(a)), bData = await read(f, session(b), { entrySecret: entry(f, f.foreign) });
  assert.match(JSON.stringify(aData.body), /الأمان/); assert.match(JSON.stringify(bData.body), /OTHER_OWNER/);
  assert.doesNotMatch(JSON.stringify(aData.body), /PRIVATE|OTHER|UNPUBLISHED|result|ownerId|studentId|attendance/);
  deny(await read(f, session(a), { entrySecret: entry(f, f.foreign) }));
  await f.repo.transaction(db => { db.credentials[0].version++; }); deny(await read(f, session(a)));
  await f.repo.transaction(db => { db.memberships[2].status = 'ended'; });
  deny(await read(f, session(b), { entrySecret: entry(f, f.foreign) }));
});
test('verified current auth, forged owner/metadata and publication binding; unpublish reread', async () => {
  const f = createFixture();
  deny(await issue(f, f.foreign)); deny(await issue(f, { ...f.member, revision: 6 }));
  deny(await issue(f, f.member, { teacher: 'unknown' }));
  f.auth.get('fabricated-teacher-a').current = false; deny(await issue(f));
  f.auth.get('fabricated-teacher-a').current = true;
  const code = (await issue(f, { ...f.member, ownerId: 'owner-b', user_metadata: { ownerId: 'owner-b' } })).body.code;
  assert.equal(f.repo.snapshot().credentials[0].ownerId, 'owner-a');
  const cookie = session(await login(f, code));
  const update = { ...f.member, publicationId: 'published-a', title: 'تحديث المعلم', status: 'done', published: true };
  deny(await f.request('/teacher/publish', { body: { ...update, publicationId: 'other-owner' } }));
  assert.equal((await f.request('/teacher/publish', { body: update })).status, 200);
  assert.equal((await read(f, cookie)).body.progress.completed, 2);
  assert.match(JSON.stringify((await read(f, cookie)).body), /تحديث المعلم/);
  await f.request('/teacher/publish', { body: { ...update, published: false } });
  assert.doesNotMatch(JSON.stringify((await read(f, cookie)).body), /تحديث المعلم/);
  await f.repo.transaction(db => { db.memberships[0].revision++; }); deny(await read(f, cookie));
});
test('varying guesses/fabricated IP limited BEFORE credential lookup, unknown namespace generic', async () => {
  const f = createFixture();
  for (let n = 0; n < POLICY.sourceAttempts; n++) deny(await login(f, String(n).padStart(4, '0'), {
    headers: { 'x-forwarded-for': 'spoof-' + n, 'x-real-ip': 'fake-' + n } }));
  // Getter throws on lookup: exhausted admission MUST short-circuit even lookup access.
  const real = f.repo.transaction.bind(f.repo); let looked = false;
  f.repo.transaction = action => real(db => { Object.defineProperty(db, 'credentials', { get() { looked = true; throw Error('LOOKUP'); } }); return action(db); });
  deny(await login(f, '9999', { body: { code: '9999', sourceKey: 'new-client' }, headers: { 'x-forwarded-for': 'new' } }));
  assert.equal(looked, false);
  const unknown = createFixture();
  const a = await login(unknown, '9999'), b = await login(unknown, '9999', { entrySecret: 'z'.repeat(43) });
  assert.deepEqual(a.body, b.body); assert.equal(a.status, b.status);
  deny(await unknown.service({ path: '/s/' + entry(unknown) + '/claim', method: 'POST', sourceKey: 'forged', body: { code: '9999' } }));
});
test('distributed varying clients bounded by context/global/day failures; bounded memory fail-closed', async () => {
  const f = createFixture();
  for (let n = 0; n < POLICY.contextAttempts; n++) await login(f, String(n).padStart(4, '0'), { sourceKey: 'client-' + n });
  const count = f.repo.snapshot().rates.find(r => r.key === 'global').count;
  deny(await login(f, '9999', { sourceKey: 'another' }));
  assert.equal(f.repo.snapshot().rates.find(r => r.key === 'global').count, count);
  f.advance(POLICY.rateWindowMs);
  for (let n = 0; n < POLICY.contextAttempts; n++) await login(f, String(n).padStart(4, '0'), { sourceKey: 'client-' + n });
  f.advance(POLICY.rateWindowMs); deny(await login(f, '9999', { sourceKey: 'fresh' }));
  assert.equal(f.repo.snapshot().rates.find(r => r.key === 'global-failure').count, POLICY.contextFailures);
  const g = createFixture();
  for (let n = 0; n < POLICY.globalAttempts; n++) await login(g, '9999', { sourceKey: 'source-' + n, entrySecret: String(n).padStart(43, 'x') });
  const before = g.repo.snapshot().rates.find(r => r.key === 'global-failure').count;
  deny(await login(g, '9999', { sourceKey: 'last' }));
  assert.equal(g.repo.snapshot().rates.find(r => r.key === 'global-failure').count, before);
  const m = createFixture(); await m.repo.transaction(db => { db.rates = Array.from({ length: POLICY.maxRateKeys }, (_, n) => ({ key: String(n), count: 0, until: m.now() + 1000 })); });
  deny(await login(m, '9999')); assert.equal(m.repo.snapshot().rates.length, POLICY.maxRateKeys);
});
test('Origin/CSRF/content type fail closed; membership end and failed context switch clear old session', async () => {
  const f = createFixture(), code = (await issue(f)).body.code;
  for (const headers of [{ origin: 'https://other.invalid' }, { 'x-n88-csrf': '' }, { 'content-type': 'text/plain' }, { 'sec-fetch-site': 'cross-site' }]) deny(await login(f, code, { headers }));
  const cookie = session(await login(f, code));
  deny(await login(f, 'bad', { cookie })); deny(await read(f, cookie));
  const fresh = session(await login(f, code));
  await f.repo.transaction(db => { db.memberships[0].studentActive = false; });
  deny(await read(f, fresh)); deny(await login(f, code));
});
test('concurrent issue, independent logouts and canonical lifecycle refusals', async () => {
  const f = createFixture();
  const [old, current] = await Promise.all([issue(f), issue(f)]);
  assert.equal(f.repo.snapshot().credentials.filter(c => c.revokedAt == null).length, 1);
  deny(await login(f, old.body.code));
  const [a, b] = await Promise.all([login(f, current.body.code), login(f, current.body.code)]);
  await f.request('/s/' + entry(f) + '/logout', { cookie: session(a) });
  deny(await read(f, session(a))); assert.equal((await read(f, session(b))).status, 200);
  for (const change of [db => { db.memberships[0].classActive = false; }, db => { db.memberships[0].endDate = '2026-10-17'; },
    db => { db.memberships[0].ownerId = 'owner-b'; }, db => { db.contexts[0].active = false; }]) {
    const g = createFixture(), code = (await issue(g)).body.code, cookie = session(await login(g, code));
    await g.repo.transaction(change); deny(await read(g, cookie)); deny(await login(g, code));
  }
});
test('global failed-attempt budget persists across window resets and distributed namespaces', async () => {
  const f = createFixture();
  for (let window = 0; window < 5; window++) {
    for (let n = 0; n < POLICY.globalAttempts; n++) await login(f, '9999', {
      sourceKey: 'client-' + window + '-' + n, entrySecret: String(window * 100 + n).padStart(43, 'x') });
    f.advance(POLICY.rateWindowMs);
  }
  assert.equal(f.repo.snapshot().rates.find(r => r.key === 'global-failure').count, POLICY.globalFailures);
  deny(await login(f, '9999', { sourceKey: 'fresh', entrySecret: 'z'.repeat(43) }));
  assert.equal(f.repo.snapshot().rates.find(r => r.key === 'global-failure').count, POLICY.globalFailures);
});
test('inert production graph/demo/SW untouched; inactive schema outside deploy', async () => {
  async function files(dir) { return (await Promise.all((await readdir(dir, { withFileTypes: true })).map(e => e.isDirectory() ? files(dir + '/' + e.name) : [dir + '/' + e.name]))).flat(); }
  for (const file of ['index.html', 'sw.js', ...await files('src')]) {
    if (['src/lib/student-portal-client.js', 'src/views/student-portal.js'].includes(file)) continue;
    if (/\.(js|html|css)$/.test(file)) assert.doesNotMatch(await readFile(file, 'utf8'), /student-portal-client|views\/student-portal|n88-student-portal/, file);
  }
  for (const file of ['src/lib/student-portal-client.js','src/views/student-portal.js','drafts/n88-student-portal/teacher-controller.js'])
    assert.doesNotMatch(await readFile(file,'utf8'), /localStorage|sessionStorage|indexedDB|serviceWorker|cloud\.js|store\.js|user_metadata/);
  const sql = await readFile('drafts/n88-student-portal/schema-proposal.sql','utf8');
  assert.match(sql, /unique\(namespace,verifier\)/); assert.match(sql, /guess_budgets/);
  assert.doesNotMatch(sql, /consumed_at|claim_invite|security definer/);
});
