import test from 'node:test';
import assert from 'node:assert/strict';
import { BUILD_META } from '../src/lib/build-meta.js';
import { groupRejectedSyncErrors, sanitizeSupportDiagnostics, supportEnvironment } from '../src/lib/support.js';
import { buildNotificationEmail, validateSupportRequest } from '../supabase/functions/support-notification-worker/core.mjs';

const OWNER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const workspace = { type: 'account', ownershipState: 'claimed', syncEligible: true, authUserId: OWNER };
const rejected = (ownerId, code, store = 'sessions', message = 'N58_SESSION_CONTEXT_REQUIRED: SQL trace private@example.test') => ({
  protocol: 'v2', state: 'rejected', ownerId, store,
  lastError: { code, message },
  patch: { studentId: 'private' },
});

test('six owner-bound N58 session rejections produce one safe group', () => {
  const rows = Array.from({ length: 6 }, () => rejected(OWNER, '22023'));
  rows.push(rejected(OTHER, '22023'));
  rows.push(rejected(OWNER, '22023', 'scores', 'PRIVATE_SQL_ERROR student@example.test'));
  const groups = groupRejectedSyncErrors(rows, { workspace, ownerId: OWNER });
  assert.deepEqual(groups, [
    { code: 'N58_SESSION_CONTEXT_REQUIRED', area: 'sessions', count: 6 },
    { code: 'REJECTED_UNCLASSIFIED', area: 'other', count: 1 },
  ]);
  assert.doesNotMatch(JSON.stringify(groups), /SQL|private|student|score|11111111|22222222/i);
  assert.deepEqual(groupRejectedSyncErrors(rows, { workspace: { ...workspace, ownershipState: 'unclaimed' }, ownerId: OWNER }), []);
  assert.deepEqual(groupRejectedSyncErrors(rows, { workspace, ownerId: OTHER }), []);
  assert.deepEqual(groupRejectedSyncErrors(rows, { workspace: { type: 'legacy' }, ownerId: OWNER }), []);
});

test('client and Edge allowlists block injected codes, raw fields and invalid counts', () => {
  const input = {
    rejectedGroups: [
      { code: 'N58_SESSION_CONTEXT_REQUIRED', area: 'sessions', count: 6, message: 'SQL secret' },
      { code: 'PRIVATE_SQL_ERROR', area: 'sessions', count: 1 },
      { code: 'REJECTED_UNCLASSIFIED', area: 'other', count: 2, ownerId: OWNER },
      { code: 'N58_SESSION_CONTEXT_REQUIRED', area: 'sessions', count: 1_000_000 },
      { code: 'N58_SESSION_CONTEXT_REQUIRED', area: 'other', count: 1 },
    ],
    rawOutbox: [{ patch: 'secret' }],
    environment: 'production\nBcc: private@example.test',
    buildShaKind: 'git\nprivate',
  };
  const expected = [
    { code: 'N58_SESSION_CONTEXT_REQUIRED', area: 'sessions', count: 6 },
    { code: 'REJECTED_UNCLASSIFIED', area: 'other', count: 2 },
  ];
  assert.deepEqual(sanitizeSupportDiagnostics(input), { rejectedGroups: expected });
  const record = { id: 'support:n89', type: 'technical', message: 'Teacher intentionally wrote private@example.test',
    created_at: '2026-10-08T00:00:00Z', diagnostics: input };
  assert.deepEqual(validateSupportRequest(record).request.diagnostics, { rejectedGroups: expected });
  const email = buildNotificationEmail(record, { to: 'support@example.test' });
  assert.equal(email.ok, true);
  assert.match(email.payload.text, /N58_SESSION_CONTEXT_REQUIRED\) × 6/);
  assert.match(email.payload.text, /REJECTED_UNCLASSIFIED\) × 2/);
  assert.match(email.payload.text, /Teacher intentionally wrote private@example.test/);
  assert.doesNotMatch(email.payload.text, /PRIVATE_SQL_ERROR|SQL secret|rawOutbox|Bcc:/);
  assert.equal(sanitizeSupportDiagnostics({ rejectedGroups: Array.from({ length: 8 }, () => expected[0]) }).rejectedGroups.length, 5);
});

test('environment and build kind label the actual metadata without claiming a Git release', () => {
  assert.equal(supportEnvironment('https://rakeezx.com'), 'production');
  assert.equal(supportEnvironment('https://n89.rakeezx.pages.dev'), 'preview');
  for (const origin of ['http://rakeezx.com', 'https://rakeezx.com.evil.test',
    'https://rakeezx.pages.dev', 'https://other.pages.dev', 'http://n89.rakeezx.pages.dev']) {
    assert.equal(supportEnvironment(origin), 'other');
  }
  assert.equal(BUILD_META.buildShaKind, 'content');
  const diagnostics = sanitizeSupportDiagnostics({ buildSha: BUILD_META.buildSha,
    buildShaKind: BUILD_META.buildShaKind, environment: supportEnvironment('https://rakeezx.com') });
  const record = { id: 'support:build', type: 'technical', message: 'Build question',
    created_at: '2026-10-08T00:00:00Z', diagnostics };
  const email = buildNotificationEmail(record, { to: 'support@example.test' });
  assert.ok(email.payload.text.includes(`البصمة: ${BUILD_META.buildSha.slice(0, 12)}`));
  assert.match(email.payload.text, /البيئة: الإنتاج/);
  assert.doesNotMatch(email.payload.text, /إصدار Git/);
  const git = buildNotificationEmail({ ...record, diagnostics: { ...diagnostics, buildShaKind: 'git', environment: 'preview' } }, { to: 'support@example.test' });
  assert.ok(git.payload.text.includes(`Git: ${BUILD_META.buildSha.slice(0, 12)}`));
  assert.match(git.payload.text, /البيئة: المعاينة/);
});
