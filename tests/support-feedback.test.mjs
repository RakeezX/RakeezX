import test, { after, afterEach, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import * as cloud from '../src/lib/cloud.js';
import { sanitizeSupportDiagnostics, submitSupportRequest } from '../src/lib/support.js';

const originalFetch = globalThis.fetch;
const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
const OWNER = '11111111-1111-4111-8111-111111111111';
const OTHER_OWNER = '22222222-2222-4222-8222-222222222222';
const coreMigration = await readFile(new URL('../supabase/migrations/0001_core_schema.sql', import.meta.url), 'utf8');
const supportMigration = await readFile(new URL('../supabase/migrations/0020_support_requests.sql', import.meta.url), 'utf8');
let pg;

before(async () => {
  pg = new PGlite();
  await pg.exec(`
    create schema auth;
    create role authenticated;
    create role anon;
    create table auth.users(id uuid primary key);
    create table auth.current_identity(id uuid not null);
    insert into auth.users values ('${OWNER}'), ('${OTHER_OWNER}');
    insert into auth.current_identity values ('${OWNER}');
    create function auth.uid() returns uuid language sql stable security definer set search_path = ''
      as $$select id from auth.current_identity limit 1$$;
  `);
  await pg.exec(coreMigration.replace(/^\uFEFF/, ''));
  await pg.exec(supportMigration.replace(/^\uFEFF/, ''));
});

after(async () => { await pg.close(); });

afterEach(() => {
  cloud.setMockAuth(null, null);
  globalThis.fetch = originalFetch;
  if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator);
  else delete globalThis.navigator;
});

test('support diagnostics retain only the documented allowlist and redact sensitive/raw fields', () => {
  const diagnostics = sanitizeSupportDiagnostics({
    timestamp: '2026-09-08T12:34:56.000Z', timezone: 'Asia/Riyadh', deviceCategory: 'mobile',
    browser: 'chrome', browserVersion: '140.0', mobile: true, viewport: { width: 393, height: 852 },
    pwaStandalone: true, online: true, syncState: 'pending', pendingMutations: 2, failedMutations: 0,
    pendingCount: 2, failedCount: 0, blockedCount: 1, rejectedCount: 0,
    historicalConflictCount: 3, actionableSyncIssue: true,
    lastSuccessfulSyncAt: '2026-09-08T12:30:00.000Z', routeCategory: 'classes',
    appVersion: '1.0.0', buildSha: 'a'.repeat(64), buildTimestamp: '2026-09-08T12:00:00.000Z',
    route: '#/classes/secret-teaching', ownerId: 'owner-secret', email: 'teacher@example.test',
    rawError: 'token=secret', stack: 'stack', supabaseUrl: 'https://candidate.example', token: 'secret',
  });
  assert.deepEqual(diagnostics, {
    appVersion: '1.0.0', buildSha: 'a'.repeat(64), buildTimestamp: '2026-09-08T12:00:00.000Z',
    timestamp: '2026-09-08T12:34:56.000Z', timezone: 'Asia/Riyadh', deviceCategory: 'mobile',
    browser: 'chrome', browserVersion: '140.0', mobile: true, viewport: { width: 400, height: 850 },
    pwaStandalone: true, online: true, syncState: 'pending', pendingMutations: 2, failedMutations: 0,
    pendingCount: 2, failedCount: 0, blockedCount: 1, rejectedCount: 0,
    historicalConflictCount: 3, actionableSyncIssue: true,
    lastSuccessfulSyncAt: '2026-09-08T12:30:00.000Z', routeCategory: 'classes',
  });
});

test('support diagnostics reject malformed or private Build Meta values', () => {
  assert.deepEqual(sanitizeSupportDiagnostics({
    appVersion: 'version from C:\\private\\repo',
    buildSha: 'development; token=secret',
    buildTimestamp: 'not-a-date',
    canonicalOrigin: 'https://user:password@example.test',
    branch: 'main', repository: 'private/repo', developerPath: 'C:\\Users\\Developer',
  }), {});
});

test('support submission is authenticated, online-only, direct, and never carries owner or unsafe diagnostics', async () => {
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: true } });
  cloud.setMockAuth({ id: 'owner-1' }, { access_token: 'test-token' });
  let captured;
  globalThis.fetch = async (url, options) => {
    captured = { url: String(url), options };
    return new Response(null, { status: 201 });
  };
  const result = await submitSupportRequest({
    type: 'technical', message: '  لا تظهر الصفحة  ',
    diagnostics: {
      appVersion: '1.0.0', buildSha: 'b'.repeat(40), buildTimestamp: '2026-09-08T12:00:00.000Z',
      syncState: 'error', pendingMutations: 3, pendingCount: 3, failedCount: 1, blockedCount: 0,
      rejectedCount: 0, historicalConflictCount: 2, actionableSyncIssue: true,
      routeCategory: 'settings', rawOutbox: [{ id: 'secret' }],
    },
  });
  assert.match(result.id, /^support:/);
  assert.match(captured.url, /\/rest\/v1\/support_requests$/);
  assert.equal(captured.options.headers.Authorization, 'Bearer test-token');
  assert.equal(captured.options.headers.apikey.startsWith('sb_publishable_'), true);
  const body = JSON.parse(captured.options.body);
  assert.deepEqual(body, {
    id: result.id, type: 'technical', message: 'لا تظهر الصفحة',
    diagnostics: {
      appVersion: '1.0.0', buildSha: 'b'.repeat(40), buildTimestamp: '2026-09-08T12:00:00.000Z',
      timestamp: body.diagnostics.timestamp, syncState: 'error', pendingMutations: 3,
      pendingCount: 3, failedCount: 1, blockedCount: 0, rejectedCount: 0,
      historicalConflictCount: 2, actionableSyncIssue: true, routeCategory: 'settings',
    },
  });
  assert.equal('owner_id' in body, false);
  assert.equal('rawOutbox' in body.diagnostics, false);
});

test('support submission rejects logged-out and offline states before any network request', async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; return new Response(null, { status: 201 }); };
  await assert.rejects(() => submitSupportRequest({ type: 'inquiry', message: 'استفسار' }), { code: 'AUTH_REQUIRED' });
  cloud.setMockAuth({ id: 'owner-1' }, { access_token: 'test-token' });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: false } });
  await assert.rejects(() => submitSupportRequest({ type: 'inquiry', message: 'استفسار' }), { code: 'OFFLINE' });
  assert.equal(calls, 0);
});

test('support migration creates an owner-derived private insert-only table with RLS and no anonymous grant', async () => {
  await pg.query(`insert into rakeezx.support_requests(id, type, message, diagnostics)
    values ('support:test', 'technical', 'طلب اختبار', '{"syncState":"synced"}'::jsonb)`);
  const row = (await pg.query(`select owner_id, diagnostics from rakeezx.support_requests where id = 'support:test'`)).rows[0];
  assert.equal(row.owner_id, OWNER, 'the server owner trigger must override browser-supplied ownership');
  assert.deepEqual(row.diagnostics, { syncState: 'synced' });
  const table = (await pg.query(`select relrowsecurity, relforcerowsecurity from pg_class where oid = 'rakeezx.support_requests'::regclass`)).rows[0];
  assert.deepEqual(table, { relrowsecurity: true, relforcerowsecurity: true });
  const policies = (await pg.query(`select polname as policyname, polcmd from pg_policy where polrelid = 'rakeezx.support_requests'::regclass order by polname`)).rows;
  assert.deepEqual(policies, [{ policyname: 'support_requests_insert', polcmd: 'a' }]);
  const privileges = (await pg.query(`select
    has_table_privilege('anon', 'rakeezx.support_requests', 'select') as anon_select,
    has_table_privilege('anon', 'rakeezx.support_requests', 'insert') as anon_insert,
    has_table_privilege('authenticated', 'rakeezx.support_requests', 'insert') as authenticated_insert,
    has_table_privilege('authenticated', 'rakeezx.support_requests', 'select') as authenticated_select`)).rows[0];
  assert.deepEqual(privileges, { anon_select: false, anon_insert: false, authenticated_insert: true, authenticated_select: false });
});
