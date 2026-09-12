import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import {
  DELIVERY_POLICY,
  buildNotificationEmail,
  classifyProviderResult,
  formatRiyadhTime,
  resolveSupportContact,
  retryAt,
} from '../supabase/functions/support-notification-worker/core.mjs';

const OWNER = '11111111-1111-4111-8111-111111111111';
const coreMigration = await readFile(new URL('../supabase/migrations/0001_core_schema.sql', import.meta.url), 'utf8');
const supportMigration = await readFile(new URL('../supabase/migrations/0020_support_requests.sql', import.meta.url), 'utf8');
const notificationMigration = await readFile(new URL('../supabase/migrations/0027_support_notification_outbox.sql', import.meta.url), 'utf8');
const contactMigration = await readFile(new URL('../supabase/migrations/0028_support_notification_contact_identity.sql', import.meta.url), 'utf8');
let pg;

before(async () => {
  pg = new PGlite();
  await pg.exec(`
    create schema auth;
    create role authenticated;
    create role anon;
    create role service_role bypassrls;
    create table auth.users(id uuid primary key);
    create table auth.current_identity(id uuid not null);
    insert into auth.users values ('${OWNER}');
    insert into auth.current_identity values ('${OWNER}');
    create function auth.uid() returns uuid language sql stable security definer set search_path = ''
      as $$select id from auth.current_identity limit 1$$;
  `);
  await pg.exec(coreMigration.replace(/^\uFEFF/, ''));
  await pg.exec(supportMigration.replace(/^\uFEFF/, ''));
  await pg.exec(notificationMigration.replace(/^\uFEFF/, ''));
  await pg.exec(contactMigration.replace(/^\uFEFF/, ''));
});

after(async () => { await pg.close(); });

test('accepted request atomically creates exactly one private notification job', async () => {
  await pg.query(`insert into rakeezx.support_requests(id,type,message,diagnostics)
    values ('support:atomic', 'technical', 'اختبار آمن', '{"appVersion":"1.0.0"}')`);
  await pg.query(`select rakeezx.ensure_support_notification_job('${OWNER}', 'support:atomic')`);
  const jobs = (await pg.query(`select support_request_id,status,attempt_count from rakeezx.support_notification_outbox
    where support_request_id='support:atomic'`)).rows;
  assert.deepEqual(jobs, [{ support_request_id: 'support:atomic', status: 'pending', attempt_count: 0 }]);

  const privileges = (await pg.query(`select
    has_table_privilege('anon','rakeezx.support_notification_outbox','select') anon_select,
    has_table_privilege('authenticated','rakeezx.support_notification_outbox','select') authenticated_select,
    has_table_privilege('authenticated','rakeezx.support_notification_outbox','insert') authenticated_insert`)).rows[0];
  assert.deepEqual(privileges, { anon_select: false, authenticated_select: false, authenticated_insert: false });
  assert.equal((await pg.query(`select has_schema_privilege('service_role','rakeezx','usage') allowed`)).rows[0].allowed, true);
  assert.equal((await pg.query(`select has_table_privilege('service_role','rakeezx.support_requests','select') allowed`)).rows[0].allowed, true);
});

test('claim uses an exclusive lease and a delivered job is not claimed again', async () => {
  const first = (await pg.query(`select * from rakeezx.claim_support_notification_jobs(1,300)`)).rows;
  assert.equal(first.length, 1);
  assert.equal(first[0].support_request_id, 'support:atomic');
  assert.equal(first[0].attempt_count, 1);
  assert.match(first[0].lease_token, /^[a-f0-9]{32}$/);

  assert.equal((await pg.query(`select * from rakeezx.claim_support_notification_jobs(1,300)`)).rows.length, 0);
  const state = (await pg.query(`select rakeezx.complete_support_notification_job(
    '${OWNER}','support:atomic','${first[0].lease_token}','delivered',null,null
  ) state`)).rows[0].state;
  assert.equal(state, 'delivered');
  assert.equal((await pg.query(`select * from rakeezx.claim_support_notification_jobs(1,300)`)).rows.length, 0);
});

test('temporary failures retry with the same identity and never change the accepted request', async () => {
  await pg.query(`insert into rakeezx.support_requests(id,type,message)
    values ('support:retry', 'inquiry', 'طلب باقٍ في المصدر')`);
  const claimed = (await pg.query(`select * from rakeezx.claim_support_notification_jobs(1,300)`)).rows[0];
  const retryTime = new Date(Date.now() + 60_000).toISOString();
  const state = (await pg.query(`select rakeezx.complete_support_notification_job(
    '${OWNER}','support:retry','${claimed.lease_token}','temporary_failure','network','${retryTime}'
  ) state`)).rows[0].state;
  assert.equal(state, 'pending');
  assert.equal((await pg.query(`select count(*)::int count from rakeezx.support_requests where id='support:retry'`)).rows[0].count, 1);
  const job = (await pg.query(`select status,attempt_count,failure_category from rakeezx.support_notification_outbox
    where support_request_id='support:retry'`)).rows[0];
  assert.deepEqual(job, { status: 'pending', attempt_count: 1, failure_category: 'network' });
});

test('permanent failure exhausts and bounded attempts cannot retry forever', async () => {
  await pg.query(`insert into rakeezx.support_requests(id,type,message) values ('support:permanent','suggestion','اقتراح')`);
  const claimed = (await pg.query(`select * from rakeezx.claim_support_notification_jobs(1,300)`)).rows[0];
  const state = (await pg.query(`select rakeezx.complete_support_notification_job(
    '${OWNER}','support:permanent','${claimed.lease_token}','permanent_failure','configuration',null
  ) state`)).rows[0].state;
  assert.equal(state, 'exhausted');
  assert.equal((await pg.query(`select * from rakeezx.claim_support_notification_jobs(25,300)`)).rows.some((row) => row.support_request_id === 'support:permanent'), false);

  await pg.query(`insert into rakeezx.support_requests(id,type,message) values ('support:max-attempts','technical','تعذر مؤقت')`);
  await pg.query(`update rakeezx.support_notification_outbox set attempt_count=4 where support_request_id='support:max-attempts'`);
  const lastClaim = (await pg.query(`select * from rakeezx.claim_support_notification_jobs(1,300)`)).rows[0];
  assert.equal(lastClaim.attempt_count, 5);
  const exhausted = (await pg.query(`select rakeezx.complete_support_notification_job(
    '${OWNER}','support:max-attempts','${lastClaim.lease_token}','temporary_failure','provider_5xx','${new Date(Date.now() + 3600_000).toISOString()}'
  ) state`)).rows[0].state;
  assert.equal(exhausted, 'exhausted');
});

test('per-owner rate guard allows normal use but rejects unbounded hourly submission', async () => {
  await pg.query(`delete from rakeezx.support_requests where owner_id='${OWNER}'`);
  for (let index = 0; index < 10; index += 1) {
    await pg.query(`insert into rakeezx.support_requests(id,type,message) values ('support:rate-${index}','inquiry','طلب ${index}')`);
  }
  await assert.rejects(
    () => pg.query(`insert into rakeezx.support_requests(id,type,message) values ('support:rate-10','inquiry','طلب زائد')`),
    /SUPPORT_RATE_LIMITED/,
  );
  assert.equal((await pg.query(`select count(*)::int count from rakeezx.support_notification_outbox`)).rows[0].count, 10);
});

test('contact identity resolves only from server authorities and degrades independently', async () => {
  const contact = await resolveSupportContact(OWNER, {
    getAuthUser: async (ownerId) => ({ id: ownerId, email: 'Teacher@Example.test' }),
    getProfile: async () => ({ teacher_name: '  عبدالله\nالمعلّم  ' }),
  });
  assert.deepEqual(contact, { email: 'teacher@example.test', name: 'عبدالله المعلّم' });

  const emailOnly = await resolveSupportContact(OWNER, {
    getAuthUser: async () => ({ email: 'teacher@example.test' }),
    getProfile: async () => ({ teacher_name: '' }),
  });
  assert.deepEqual(emailOnly, { email: 'teacher@example.test', name: '' });

  const injected = await resolveSupportContact(OWNER, {
    getAuthUser: async () => ({ email: 'teacher@example.test\r\nBcc: attacker@example.test' }),
    getProfile: async () => ({ teacher_name: 'المعلّم\r\nBcc: attacker@example.test' }),
  });
  assert.deepEqual(injected, { email: '', name: 'المعلّم Bcc: attacker@example.test' });

  const unavailable = await resolveSupportContact(OWNER, {
    getAuthUser: async () => { throw new Error('auth unavailable'); },
    getProfile: async () => { throw new Error('profile unavailable'); },
  });
  assert.deepEqual(unavailable, { email: '', name: '' });
});

test('email builder emits fixed Arabic-first presentation and ignores browser-supplied identity', () => {
  const result = buildNotificationEmail({
    id: 'support:abc-123',
    owner_id: OWNER,
    email: 'browser-attacker@example.test',
    name: 'اسم غير موثوق',
    type: 'technical',
    message: 'سطر أول\nBcc: attacker@example.test',
    created_at: '2026-09-12T12:00:00.000Z',
    diagnostics: {
      appVersion: '1.0.0', buildSha: 'a'.repeat(64), routeCategory: 'support',
      browserVersion: 'token=secret', timezone: 'Asia/Riyadh',
      ownerId: OWNER, email: 'teacher@example.test', token: 'secret', rawOutbox: [{ id: 'private' }],
    },
  }, {
    to: 'internal@example.test',
    contact: { email: 'teacher@example.test', name: 'المعلّم عبدالله' },
  });
  assert.equal(result.ok, true);
  assert.equal(result.payload.from, 'RAKEEZ Support <support@rakeezx.com>');
  assert.deepEqual(result.payload.to, ['internal@example.test']);
  assert.equal(result.payload.subject, 'رَكيز المعلم — مشكلة تقنية — abc-123');
  assert.match(result.payload.text, /Bcc: attacker@example\.test/);
  assert.doesNotMatch(result.payload.subject, /Bcc|attacker|owner/i);
  assert.doesNotMatch(result.payload.text, new RegExp(`${OWNER}|browser-attacker@example|اسم غير موثوق|token|rawOutbox|private`, 'i'));
  assert.match(result.payload.text, /الاسم: المعلّم عبدالله/);
  assert.match(result.payload.text, /البريد: teacher@example\.test/);
  assert.match(result.payload.text, /الإصدار: 1\.0\.0/);
  assert.match(result.payload.text, /البناء: a{12}/);
  assert.doesNotMatch(result.payload.text, new RegExp(`a{13}`));
});

test('email contact fallback and Riyadh time remain safe and human-readable', () => {
  const formatted = formatRiyadhTime('2026-09-12T20:32:00.000Z');
  assert.match(formatted, /12|١٢/);
  assert.match(formatted, /سبتمبر/);
  assert.match(formatted, /2026|٢٠٢٦/);
  assert.match(formatted, /11|١١/);

  const result = buildNotificationEmail({
    id: 'support:fallback', type: 'inquiry', message: 'استفسار',
    created_at: '2026-09-12T20:32:00.000Z', diagnostics: {},
  }, { to: 'internal@example.test', contact: { email: 'reply@example.test', name: '' } });
  assert.match(result.payload.text, /البريد: reply@example\.test/);
  assert.doesNotMatch(result.payload.text, /الاسم:/);
  assert.match(result.payload.text, new RegExp(`الوقت: ${formatted.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));

  const noContact = buildNotificationEmail({
    id: 'support:no-contact', type: 'suggestion', message: 'اقتراح محفوظ',
    created_at: '2026-09-12T20:32:00.000Z', diagnostics: {},
  }, { to: 'internal@example.test', contact: {} });
  assert.equal(noContact.ok, true);
  assert.doesNotMatch(noContact.payload.text, /الاسم:|البريد:/);
});

test('worker operational logs never include contact identity or message content', async () => {
  const worker = await readFile(new URL('../supabase/functions/support-notification-worker/index.ts', import.meta.url), 'utf8');
  assert.match(worker, /auth\.admin\.getUserById\(ownerId\)/);
  assert.match(worker, /select\('teacher_name'\)/);
  const logCalls = [...worker.matchAll(/console\.(?:log|error)\(([^\n]+)\)/g)].map((match) => match[1]).join('\n');
  assert.doesNotMatch(logCalls, /contact|email|teacher_name|message|diagnostics|owner_id/i);
});

test('delivery classification and retry policy are bounded and deterministic', () => {
  assert.deepEqual(classifyProviderResult({ status: 200, body: { success: true, result: { delivered: ['internal@example.test'], queued: [] } } }), { outcome: 'delivered', category: null });
  assert.deepEqual(classifyProviderResult({ status: 429 }), { outcome: 'temporary_failure', category: 'rate_limited' });
  assert.deepEqual(classifyProviderResult({ status: 503 }), { outcome: 'temporary_failure', category: 'provider_5xx' });
  assert.deepEqual(classifyProviderResult({ status: 403 }), { outcome: 'permanent_failure', category: 'configuration' });
  assert.deepEqual(classifyProviderResult({ status: 200, body: { success: true, result: { permanent_bounces: ['internal@example.test'] } } }), { outcome: 'permanent_failure', category: 'provider_rejected' });
  assert.deepEqual(classifyProviderResult({ error: Object.assign(new Error('timeout'), { name: 'TimeoutError' }) }), { outcome: 'temporary_failure', category: 'timeout' });
  const now = new Date('2026-09-12T12:00:00.000Z');
  assert.equal(retryAt(1, now), '2026-09-12T12:01:00.000Z');
  assert.equal(retryAt(2, now), '2026-09-12T12:05:00.000Z');
  assert.equal(retryAt(3, now), '2026-09-12T12:15:00.000Z');
  assert.equal(retryAt(4, now), '2026-09-12T13:00:00.000Z');
  assert.deepEqual(DELIVERY_POLICY, {
    schedule: '* * * * *', leaseSeconds: 300, maxAttempts: 5,
    backoffSeconds: [60, 300, 900, 3600],
  });
});

test('notification infrastructure never exposes server secrets to frontend source', async () => {
  const frontend = await Promise.all([
    '../src/app.js', '../src/lib/support.js', '../src/views/support.js', '../src/generated/build-meta.generated.js',
  ].map((path) => readFile(new URL(path, import.meta.url), 'utf8')));
  assert.doesNotMatch(frontend.join('\n'), /CLOUDFLARE_EMAIL_API_TOKEN|SUPABASE_SERVICE_ROLE_KEY|SUPPORT_NOTIFICATION_SCHEDULER_SECRET|rakeezxteam@gmail\.com/i);
});

test('existing Support RLS contract remains insert-only for authenticated users', async () => {
  const policies = (await pg.query(`select polname as policyname,polcmd from pg_policy
    where polrelid='rakeezx.support_requests'::regclass order by polname`)).rows;
  assert.deepEqual(policies, [{ policyname: 'support_requests_insert', polcmd: 'a' }]);
  const privileges = (await pg.query(`select
    has_table_privilege('anon','rakeezx.support_requests','insert') anon_insert,
    has_table_privilege('authenticated','rakeezx.support_requests','insert') authenticated_insert,
    has_table_privilege('authenticated','rakeezx.support_requests','select') authenticated_select`)).rows[0];
  assert.deepEqual(privileges, { anon_insert: false, authenticated_insert: true, authenticated_select: false });
  assert.equal((await pg.query(`select has_table_privilege('service_role','rakeezx.profile','select') allowed`)).rows[0].allowed, true);
});
